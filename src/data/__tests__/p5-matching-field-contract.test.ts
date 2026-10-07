import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AI_PROPOSABLE_NEED_FACT_V2_KEYS, NEED_FACT_V2_DEFINITIONS } from '../../contracts/needFactsV2';

const root = join(__dirname, '..', '..', '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Historical P5 baseline matching contract (current WPP01 delta has a separate SQL proof)', () => {
  const dispatch = source('supabase/migrations/20260829211632_clean_dispatch_engine.sql');
  const selection = source('supabase/migrations/20260906010000_clean_ru5_selection_eligibility_revalidation.sql');
  const materialization = source('supabase/migrations/20260910130851_clean_w02_resolved_location_authority.sql');
  const start = dispatch.indexOf('create or replace function private.match_detail');
  const end = dispatch.indexOf('create or replace function', start + 40);
  const match = dispatch.slice(start, end > start ? end : undefined);

  it('materializes task capability facts into the Need columns matching reads', () => {
    for (const pair of [
      ["need.required_skills", 'required_skills'],
      ["need.required_tools", 'required_tools'],
      ["need.required_vehicles", 'required_vehicles'],
      ["need.required_licenses", 'required_licenses'],
      ["need.people_needed", 'required_slots'],
    ] as const) {
      expect(materialization).toContain(pair[0]); expect(materialization).toContain(pair[1]);
    }
  });

  it('uses worker capabilities, availability and radius for matching instead of profile decoration', () => {
    for (const token of ['p.skills', 'p.tools', 'p.vehicles', 'p.licenses', 'p.radius_km', 'p.available_now',
      'profile_availability_rules', 'profile_availability_windows']) expect(dispatch).toContain(token);
    expect(match).not.toMatch(/p\.display_name\b|p\.bio\b/);
  });

  it('revalidates team capacity at selection rather than pretending it is a ranking score', () => {
    expect(selection).toContain('v_ver.covered_slots > v_profile.team_capacity');
    expect(selection).toContain('TEAM_CAPACITY_EXCEEDED');
    expect(selection).toContain("private.match_detail(p_need_id, v_resp.worker_profile_id)");
  });
});

// ---------------------------------------------------------------------------------------------
// EX-06 / S05: field-to-consumer map. SOURCE-LEVEL pins only: text assertions on repository files,
// no SQL is executed and nothing here is live proof. The map is
// docs/implementation/product-v1-closure-20260926/finalization-20260927/ex06/EX06_FIELD_CONSUMER_MAP_20261001.md
// A change that adds a writer, a collector, a consumer or a new file touching one of these fields fails
// a test on purpose: update the map and this block together.
// ---------------------------------------------------------------------------------------------
const MAP_DOC = 'docs/implementation/product-v1-closure-20260926/finalization-20260927/ex06/EX06_FIELD_CONSUMER_MAP_20261001.md';
const DE = 'supabase/migrations/20260829211632_clean_dispatch_engine.sql';
const WAVE = 'supabase/migrations/20260829211956_clean_urgent_min_choice_floor.sql';
const W2C = 'supabase/migrations/20260909110000_clean_w02_calendar_authority.sql';
const W2I = 'supabase/migrations/20260909120000_clean_w02_calendar_interval_integrity.sql';
const W2F = 'supabase/migrations/20260909130000_clean_w02_flexible_calendar_scope.sql';
const W2A = 'supabase/migrations/20260909150000_clean_w02_persistent_availability_matching.sql';
const AV = 'supabase/migrations/20260909140000_clean_w02_availability_commands.sql';
const K31 = 'supabase/candidates/pkg031b_work_kinds_for_matching.sql';
const P27 = 'supabase/candidates/pkg027a_dispatch_keeps_looking.sql';
const X6 = 'supabase/candidates/ex06a_flexible_window.sql';
const X6R = 'supabase/candidates/ex06a_flexible_window_revert.sql';
const X7 = 'supabase/candidates/ex06b_alias_registry.sql';
const X7R = 'supabase/candidates/ex06b_alias_registry_revert.sql';
// Source-only F5 candidate/revert are inventoried because this test scans every SQL file.
// They are NOT part of the effective DEV chain until separately owner-approved and applied.
const X8 = 'supabase/candidates/ex06d_f5_already_applied_admission.sql';
const X8R = 'supabase/candidates/ex06d_f5_already_applied_admission_revert.sql';
// Frozen WPP01 forward/disposable/revert bodies retain the existing preference
// readers; they remove license/team gates, without adding preference writers.
const WPP01 = ['candidate.in-transaction.sql', 'candidate.sql', 'revert.sql']
  .map(name => `supabase/candidates/worker-personal-profile-20261003/${name}`);
const WPP01_POSTFLIGHT = 'supabase/candidates/worker-personal-profile-20261003/postflight.readonly.sql';
// WPP02-A worker personal V2 (NOT applied): preference and dispatch candidate with its compatible rollback, resume and canonical copies.
const WPP02 = (name: string) => `supabase/candidates/worker-personal-v2-20261003/${name}`;
const WPP02_CHAIN = ['candidate.sql', 'compatible-rollback.sql', 'resume.sql'].map(WPP02);
const WPP02_PREFS = ['candidate.sql', 'canonical.sql', 'compatible-rollback.sql', 'resume.sql'].map(WPP02);
// MATCH-V1 (owner 2026-10-07, NOT applied): ONE shared "Odgovara mi" rule (kind + area + time). The forward files carry the
// new bodies (no tool, vehicle, experience or fee gate), the revert the exact DEV bodies, pre/postflight only md5 pins.
const MV1 = (name: string) => `supabase/candidates/match-v1-20261007/${name}`;
const MV1_ALL = ['candidate.sql', 'candidate.in-transaction.sql', 'revert.sql', 'preflight.readonly.sql', 'postflight.readonly.sql'].map(MV1);
const MV1_BODIES = ['candidate.sql', 'candidate.in-transaction.sql', 'revert.sql'].map(MV1);
const R15 = 'supabase/operations/dev-alpha/ledger/20260917181212_dev_alpha_pkg015b_gap0042_world_boundary.sql';
const GW = 'supabase/migrations/20260910121926_clean_w02_regional_country_authority.sql';
const G173 = 'supabase/migrations/20260830173000_clean_authoritative_mutation_boundary.sql';
const G174 = 'supabase/migrations/20260830174000_clean_repair_authority_boundary.sql';
const RU1 = 'supabase/migrations/20260903165700_clean_ru1_worker_readiness.sql';
const OW = 'supabase/migrations/20260912220506_clean_v5_owned_worker_profile.sql';
const CAP = 'supabase/migrations/20260911174500_clean_pre_v3_worker_capacity.sql';
const SUB = 'supabase/migrations/20260905190000_clean_ru5_atomic_application_submit.sql';
const SEL = 'supabase/migrations/20260906100000_clean_p0d03_requester_connection_activation_v1.sql';
const EV = 'supabase/migrations/20260829210536_clean_emit_event_engine.sql';
const WI = 'supabase/functions/uskoci-worker-interview/index.ts';
const TI = 'supabase/functions/uskoci-ai-interview/index.ts';
const WP = 'src/data/workerProfileClientService.ts';
const AS = 'src/data/applicationSelectionClientService.ts';

const cache = new Map<string, string>();
/** Repository text with LF line endings (a Windows checkout may carry CRLF). */
const lf = (path: string): string => {
  let text = cache.get(path);
  if (text === undefined) { text = source(path).replace(/\r\n/g, '\n'); cache.set(path, text); }
  return text;
};
const listFiles = (dir: string, keep: (path: string) => boolean, found: string[] = []): string[] => {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { if (entry.name !== '__tests__' && entry.name !== 'node_modules') listFiles(path, keep, found); }
    else if (keep(path)) found.push(path);
  }
  return found;
};
const sqlIn = (dir: string) => listFiles(dir, path => path.endsWith('.sql'));
const migrationSql = () => sqlIn('supabase/migrations');
const patchSql = () => [...sqlIn('supabase/candidates'), ...sqlIn('supabase/operations/dev-alpha/ledger')];
const allSql = () => [...migrationSql(), ...patchSql()];
/** Client and Edge code that could collect or write a field (tests and docs excluded). */
const appCode = () => [
  ...listFiles('src', path => /\.tsx?$/.test(path) && !/\.test\./.test(path)),
  ...listFiles('supabase/functions', path => /\.(ts|mjs|js)$/.test(path)),
];
const mentioning = (files: string[], pattern: RegExp) => files.filter(file => pattern.test(lf(file))).sort();
const between = (text: string, from: string, to: string): string => {
  const start = text.indexOf(from);
  if (start < 0) throw new Error(`marker not found: ${from}`);
  const end = text.indexOf(to, start + from.length);
  if (end < 0) throw new Error(`end marker not found: ${to}`);
  return text.slice(start, end);
};
const codes = (text: string, list: 'hard' | 'disp') =>
  [...text.matchAll(new RegExp(`array_append\\(${list},'([A-Z_]+)'\\)`, 'g'))].map(found => found[1]).sort();
const count = (text: string, pattern: RegExp) => (text.match(new RegExp(pattern.source, 'g')) ?? []).length;

describe('EX-06 S05 field-to-consumer map: effective matcher chain and gate classes (source text, not live proof)', () => {
  const matcher = between(lf(DE), 'create or replace function private.match_detail(nid uuid, pid uuid)',
    'comment on function private.match_detail(uuid,uuid)');
  const hard = between(matcher, '-- TVRDE kapije', '-- MEKE kapije');
  const soft = between(matcher, '-- MEKE kapije', '-- Bodovanje');
  const prefilter = between(lf(DE), 'create or replace function private.dispatch_cheap_candidate_admitted',
    'create or replace function private.candidate_profile_ids');

  it('baseline matcher: the HARD set (blocks dispatch AND manual application) is exactly the mapped set', () => {
    expect(codes(hard, 'hard')).toEqual([
      'ACCOUNT_OR_PROFILE_RESTRICTED', 'OWN_NEED', 'IDENTITY_VERIFICATION_NOT_ADMITTED', 'MISSING_REQUIRED_TOOL',
      'MISSING_REQUIRED_LICENSE', 'MISSING_REQUIRED_VEHICLE', 'INSUFFICIENT_EXPERIENCE', 'PROFILE_EXCLUSION'].sort());
    expect(matcher).toMatch(/'responseAllowed', cardinality\(hard\) = 0/);
  });

  it('baseline matcher: the SOFT set (blocks automatic dispatch only) is exactly the mapped set', () => {
    expect(codes(soft, 'disp')).toEqual([
      'CURRENT_AVAILABILITY_PAUSED', 'AVAILABILITY_FRESHNESS_EXPIRED', 'PROACTIVE_NOTIFICATIONS_PAUSED',
      'SAME_DAY_URGENT_NOTIFICATIONS_PAUSED', 'SERVICE_NOT_IN_WORK_PROFILE', 'OUTSIDE_AVAILABILITY',
      'OUTSIDE_PREFERRED_RADIUS', 'BELOW_MINIMUM_FEE'].sort());
    expect(matcher).toMatch(/'dispatchEligible', cardinality\(hard\) = 0 and cardinality\(disp\) = 0/);
    // No soft code is a hard code and vice versa: tools/licences/vehicles/experience/exclusions never relax for a manual application.
    expect(codes(soft, 'disp').filter(code => codes(hard, 'hard').includes(code))).toEqual([]);
  });

  it('effective chain: the W02 availability patch drops the freshness code and moves the schedule to worker_dispatch_time_admitted', () => {
    const w2a = lf(W2A);
    expect(count(w2a, /AVAILABILITY_FRESHNESS_EXPIRED/)).toBe(1); // only inside the replaced anchor
    expect(w2a).toContain("replacement:='  sched := private.worker_dispatch_time_admitted(nid,pid);';");
    expect(w2a).toMatch(/private\.availability_is_future\(n\.schedule_kind,n\.starts_at,n\.ends_at,statement_timestamp\(\)\)\s+then disp := array_append\(disp,'CURRENT_AVAILABILITY_PAUSED'\)/);
    expect(w2a).toContain("replacement:='      and private.worker_dispatch_time_admitted(nid,pid)';");
    expect(w2a).toMatch(/comment on column public\.app_profiles\.available_now_expires_at is\s+'Retired expiry metadata/);
  });

  it('effective chain: CALENDAR_CONFLICT is a HARD blocker added by the wrapper and only a fixed window supplies the interval', () => {
    const w2i = lf(W2I);
    expect(w2i).toMatch(/result:=private\.match_detail_without_calendar\(nid,pid\);/);
    expect(w2i).toContain('"CALENDAR_CONFLICT"');
    expect(w2i).toMatch(/jsonb_set\(result,'\{responseAllowed\}','false'::jsonb,true\)/);
    expect(lf(W2F)).toMatch(/where n\.id=nid and n\.schedule_kind='FIXED_WINDOW'/);
  });

  it('effective chain: the patch chain of the matcher bodies is an exact list of files (a new patch must be added to the map)', () => {
    expect(mentioning(allSql(), /match_detail_without_calendar/)).toEqual([
      'supabase/candidates/pkg023c_public_pin_100m.sql', // comment only: "matching ... not touched"
      K31,
      'supabase/candidates/pkg035a_selectable_application_counts.sql', // md5 pin and reader only
      X6, X6R, // EX-06 ex06a: ONE anchored edit of the match_detail_without_calendar body (a window-less TOMORROW/WEEK task counts as future availability for CURRENT_AVAILABILITY_PAUSED), NOT APPLIED to DEV, and its exact inverse
      X7, X7R, // EX-06 ex06b: only pins the callers match_detail_without_calendar and dispatch_cheap_candidate_admitted by md5 (it changes private.work_kinds_v5 and adds configuration rows), NOT APPLIED to DEV, and its exact inverse
      W2C, W2I, W2A, ...WPP01, WPP01_POSTFLIGHT, ...WPP02_CHAIN, ...MV1_ALL].sort());
    // ex06a also pins the pre-image of dispatch_cheap_candidate_admitted (md5 row only; it changes neither this function nor the prefilter)
    expect(mentioning(allSql(), /dispatch_cheap_candidate_admitted/)).toEqual([DE, K31, R15, W2A, X6, X6R, X7, X7R, X8, X8R, ...WPP01, WPP01_POSTFLIGHT, ...WPP02_CHAIN, ...MV1_ALL].sort());
    const wrappers = mentioning(migrationSql(), /create or replace function private\.match_detail\(/);
    expect(wrappers[wrappers.length - 1]).toBe(W2F);
    const waves = mentioning(migrationSql(), /create or replace function private\.dispatch_next_wave\(/);
    expect(waves[waves.length - 1]).toBe(WAVE);
  });

  it('PKG-031b service match compares required_skills (never the category); the category only meets exclusions', () => {
    for (const text of [matcher, lf(K31)]) {
      const statements = [...text.matchAll(/svc\s*:=[^;]*;/g)].map(found => found[0]);
      expect(statements.length).toBeGreaterThan(0);
      for (const statement of statements) expect(statement).not.toContain('n.category');
    }
    expect(lf(K31)).toContain('private.work_kinds_v5(p.skills) && private.work_kinds_v5(n.required_skills)');
    expect(lf(K31)).toContain('private.work_kinds_v5(p.exclusions) && private.work_kinds_v5(array_prepend(n.category, n.required_skills))');
    // tools, vehicles and licences are exact lower-cased containment: no kinds arm for them (X-06)
    expect(lf(K31)).not.toMatch(/work_kinds_v5\(p\.(tools|vehicles|licenses)/);
    expect(matcher).toContain('toolsok := private.lower_arr(p.tools) @> private.lower_arr(n.required_tools);');
  });

  it('every consumer cited in the map exists in the cited source file', () => {
    const consumers: ReadonlyArray<readonly [string, string, RegExp]> = [
      ['worker skills: SOFT service gate', DE, /svc := cardinality\(n\.required_skills\) = 0\s+or private\.lower_arr\(p\.skills\) && private\.lower_arr\(n\.required_skills\)/],
      ['worker skills: PREFILTER', DE, /and \(cardinality\(n\.required_skills\) = 0\s+or private\.lower_arr\(p\.skills\) && private\.lower_arr\(n\.required_skills\)\)/],
      ['worker skills: SCORE capability 30', DE, /if svc then reasons := array_append\(reasons,'SERVICE_MATCH'\); cap := 30; end if;/],
      ['worker tools: HARD', DE, /if not toolsok then hard := array_append\(hard,'MISSING_REQUIRED_TOOL'\)/],
      ['worker tools: PREFILTER', DE, /and private\.lower_arr\(p\.tools\) @> private\.lower_arr\(n\.required_tools\)/],
      ['worker vehicles: HARD', DE, /vehok := private\.lower_arr\(p\.vehicles\) @> private\.lower_arr\(n\.required_vehicles\);/],
      ['worker vehicles: PREFILTER', DE, /and private\.lower_arr\(p\.vehicles\) @> private\.lower_arr\(n\.required_vehicles\)/],
      ['worker licenses: HARD', DE, /licok := private\.lower_arr\(p\.licenses\) @> private\.lower_arr\(n\.required_licenses\);/],
      ['worker licenses: PREFILTER', DE, /and private\.lower_arr\(p\.licenses\) @> private\.lower_arr\(n\.required_licenses\)/],
      ['resources: SCORE 15', DE, /if toolsok and licok and vehok then reasons := array_append\(reasons,'RESOURCES_MATCH'\); rs := 15; end if;/],
      ['worker radius_km: SOFT', DE, /effective_radius := private\.effective_radius_km\(p\.radius_km\);/],
      ['worker preference point: SOFT distance', DE, /dist := private\.haversine_km\(n\.approximate_lat, n\.approximate_lng,\s+pref\.approximate_lat, pref\.approximate_lng\);/],
      ['worker city: SOFT fallback', DE, /lower\(coalesce\(n\.approximate_city,''\)\) = lower\(coalesce\(p\.city,''\)\)/],
      ['task REMOTE bypasses the radius gate', DE, /if n\.execution_location_mode = 'REMOTE' then\s+dist := null; radiusok := true;/],
      ['worker timezone', DE, /tz := coalesce\(nullif\(pref\.timezone,''\), 'Europe\/Belgrade'\);/],
      ['worker available_now / schedule: SOFT via the W02 admission', W2A, /sched := private\.worker_dispatch_time_admitted\(nid,pid\);/],
      ['worker rules and windows feed the admission', W2A, /profile_availability_windows w[\s\S]*profile_availability_rules r/],
      ['worker rating: SCORE reliability', DE, /rels := round\(greatest\(0, least\(100, coalesce\(p\.rating_worker\*20, 50\)\)\)\/10, 1\);/],
      ['worker profile status: HARD', DE, /if p\.profile_status <> 'ACTIVE' then hard := array_append\(hard,'ACCOUNT_OR_PROFILE_RESTRICTED'\)/],
      ['own task: HARD', DE, /if n\.requester_account_id = p\.account_id then hard := array_append\(hard,'OWN_NEED'\)/],
      ['G04 exclusions: HARD', DE, /if private\.lower_arr\(p\.exclusions\) && private\.lower_arr\(array_prepend\(n\.category, n\.required_skills\)\)\s+then hard := array_append\(hard,'PROFILE_EXCLUSION'\)/],
      ['G04 exclusions: PREFILTER', DE, /and not \(private\.lower_arr\(p\.exclusions\)\s+&& private\.lower_arr\(array_prepend\(n\.category, n\.required_skills\)\)\)/],
      ['G04 exclusions: kinds arm', K31, /private\.work_kinds_v5\(p\.exclusions\) && private\.work_kinds_v5\(array_prepend\(n\.category, n\.required_skills\)\)/],
      ['G04 minimum_fee_rsd: SOFT', DE, /coalesce\(p\.minimum_fee_rsd,0\) = 0\s+or \(n\.requester_price_rsd is not null and n\.requester_price_rsd >= p\.minimum_fee_rsd\)/],
      ['G04 minimum_fee_rsd: SOFT code', DE, /if not feeok then disp := array_append\(disp,'BELOW_MINIMUM_FEE'\)/],
      ['G04 minimum_fee_rsd: PREFILTER', DE, /and \(n\.mode = 'OFFERS' or coalesce\(p\.minimum_fee_rsd,0\) = 0/],
      ['G04 years_experience: HARD', DE, /coalesce\(p\.years_experience,0\) >= n\.minimum_experience_years/],
      ['G04 years_experience: HARD code', DE, /if not expok\s+then hard := array_append\(hard,'INSUFFICIENT_EXPERIENCE'\)/],
      ['G04 years_experience: PREFILTER', DE, /or coalesce\(p\.years_experience,0\) >= n\.minimum_experience_years\)/],
      ['G04 proactive_notifications: SOFT', DE, /if not coalesce\(pref\.proactive_notifications,true\) then disp := array_append\(disp,'PROACTIVE_NOTIFICATIONS_PAUSED'\)/],
      ['G04 proactive_notifications: PREFILTER', DE, /and coalesce\(pref\.proactive_notifications, true\) = true/],
      ['G04 same_day_urgent_notifications: SOFT (match_detail only)', DE, /and not coalesce\(pref\.same_day_urgent_notifications,true\)\s+then disp := array_append\(disp,'SAME_DAY_URGENT_NOTIFICATIONS_PAUSED'\)/],
      ['G04 identity: HARD', DE, /if n\.verified_identity_required and not private\.identity_admitted\(p\.account_id\)\s+then hard := array_append\(hard,'IDENTITY_VERIFICATION_NOT_ADMITTED'\)/],
      ['G04 identity: PREFILTER', DE, /and \(not n\.verified_identity_required or private\.identity_admitted\(p\.account_id\)\)/],
      ['task required_slots: wave bookkeeping', WAVE, /remaining := greatest\(0, n\.required_slots - selected\);/],
      ['wave takes only dispatchEligible candidates', WAVE, /where coalesce\(\(s\.detail->>'dispatchEligible'\)::boolean, false\)/],
      ['team capacity: APP at submit', SUB, /if p_covered_slots > v_profile\.team_capacity then/],
      ['team capacity: APP at selection', SEL, /if v_ver\.covered_slots > v_profile\.team_capacity then/],
      ['PKG-027a requeue: availability writer', P27, /public\.rpc_save_worker_availability\(text,jsonb\)/],
      ['PKG-015b same-world prefilter', R15, /and private\.accounts_same_world\(n\.requester_account_id, p\.account_id\)/],
    ];
    for (const [label, file, pattern] of consumers) {
      try { expect(lf(file)).toMatch(pattern); }
      catch (error) { throw new Error(`consumer missing: ${label} in ${file}\n${String(error)}`); }
    }
  });

  it('prefilter predicates match the map: team capacity, same-day urgent and calendar are NOT prefilter conditions', () => {
    expect(prefilter).not.toMatch(/team_capacity|same_day_urgent_notifications|calendar|rating_worker/);
    expect(matcher).not.toMatch(/team_capacity/);
  });
});

describe('EX-06 S05 field-to-consumer map: consumer-without-collector findings G04-1..G04-9 (source text, not live proof)', () => {
  const sourceFields: Array<[string, RegExp, string[]]> = [
    // [field, pattern, the exact list of SQL files that mention it (migrations, candidates, applied-ledger SQL)]
    ['app_profiles.exclusions', /\bp\.exclusions\b|\bexclusions\s+text\[\]|'exclusions'|\bexclusions\s*=/, [
      'supabase/migrations/20260825115040_cloud_profile_foundation_1_3b.sql', // table definition
      DE, // matcher + prefilter readers
      'supabase/migrations/20260913081147_clean_v5_event_bound_account_erasure.sql', // closure reset to {}
      'supabase/candidates/chat_voice_b1_revert.sql', // copy of the erasure body
      'supabase/candidates/pkg023c_public_pin_100m.sql', // copy of the erasure body (NOT applied)
      'supabase/candidates/d12_review_comment_revert.sql', // D12 revert: byte copy of the pre-image of closure_redaction_patch_v5 (the profile reset text), NOT applied
      K31, ...WPP01, // kinds arm; WPP01 retains those readers
      WPP02('candidate.sql'), // WPP02-A candidate (NOT applied) keeps the reader
      ...MV1_BODIES, // MATCH-V1 (NOT applied) keeps the exclusion reader in the shared rule
    ]],
    ['app_profiles.minimum_fee_rsd', /minimum_fee_rsd/, [
      ...WPP01, WPP02('candidate.sql'), MV1('revert.sql'), // MATCH-V1: only its exact revert still names the retired gate
      'supabase/migrations/20260825115040_cloud_profile_foundation_1_3b.sql', DE,
      'supabase/migrations/20260913081147_clean_v5_event_bound_account_erasure.sql',
      'supabase/candidates/chat_voice_b1_revert.sql', 'supabase/candidates/pkg023c_public_pin_100m.sql',
      'supabase/candidates/d12_review_comment_revert.sql', // D12 revert: copy of the erasure body (pre-image of closure_redaction_patch_v5), NOT applied
    ]],
    ['app_profiles.years_experience', /years_experience/, [
      ...WPP01, WPP02('candidate.sql'), MV1('revert.sql'), // MATCH-V1: only its exact revert still names the retired gate
      'supabase/migrations/20260825115040_cloud_profile_foundation_1_3b.sql', DE,
      G173, // superseded guard that forced it to 0
      G174, // comment: self-declared fields pass through freely
      'supabase/migrations/20260913081147_clean_v5_event_bound_account_erasure.sql',
      'supabase/candidates/chat_voice_b1_revert.sql', 'supabase/candidates/pkg023c_public_pin_100m.sql',
      'supabase/candidates/d12_review_comment_revert.sql', // D12 revert: copy of the erasure body (pre-image of closure_redaction_patch_v5), NOT applied
    ]],
    ['worker_match_preferences.proactive_notifications', /proactive_notifications/, [
      'supabase/migrations/20260829211203_clean_geo_foundation_repair.sql', DE, ...WPP01, ...WPP02_PREFS, ...MV1_BODIES]],
    ['worker_match_preferences.same_day_urgent_notifications', /same_day_urgent_notifications/, [
      'supabase/migrations/20260829211203_clean_geo_foundation_repair.sql', DE, ...WPP01, ...WPP02_PREFS, ...MV1_BODIES]],
    ['worker_match_preferences.buffer_minutes (X-01: no collector, no consumer)', /buffer_minutes/, [
      'supabase/migrations/20260829211203_clean_geo_foundation_repair.sql', WPP02('candidate.sql')]],
    ['private.identity_admitted (G04-8)', /identity_admitted/, [DE,
      ...WPP01, WPP02('candidate.sql'), ...MV1_ALL,
      X6, // EX-06 ex06a: a header COMMENT only ("the unchanged helpers ... identity_admitted ... are not pinned"); the candidate neither reads nor changes the function, NOT applied
    ]],
  ];

  it.each(sourceFields)(
    'no client, Edge or later SQL file collects or writes %s; the SQL files that mention it are exactly the mapped list', (_field, pattern, files) => {
      expect(mentioning(appCode(), pattern)).toEqual([]);
      expect(mentioning(allSql(), pattern)).toEqual([...files].sort());
    });

  it('G04-1/2/4: the worker AI schema, its server allow-list and the manual writer carry none of the unconsumed fields', () => {
    // WPP01 retires license/team proposals, while V1 SQL/wire compatibility
    // retains the older nine-key envelope. Do not conflate those two boundaries.
    const providerList = "'displayName','bio','skills','tools','vehicles','location','availability'";
    const legacyList = "'displayName','bio','skills','tools','vehicles','licenses','teamCapacity','location','availability'";
    expect(lf(WI)).toContain(`[${providerList}].includes(k)`);
    expect(lf(WI)).not.toContain(`[${legacyList}].includes(k)`);
    expect(lf(OW)).toContain(`patch-array[${legacyList}]<>'{}'::jsonb`);
    expect(lf(WI)).not.toMatch(/exclusions|minimum_?[Ff]ee|years_?[Ee]xperience|proactive|sameDayUrgent|bufferMinutes/);
    expect(lf(OW)).not.toMatch(/exclusions|minimum_fee|years_experience|proactive|same_day_urgent|buffer_minutes/);
    expect(lf(WP)).toContain("['ime','grad','biografija','vestine','alati','vozila','licence','dostupanOdmah','radijusKm','kapacitetTima','capacityRevision','zavrsi']");
    expect(lf(WP)).toContain("{ vestine: 'skills', alati: 'tools', vozila: 'vehicles', licence: 'licenses' }");
    expect(lf(WP)).toContain("{ ime: 'display_name', biografija: 'bio' }");
    expect(lf(WP)).not.toMatch(/exclusions|minimum_fee|years_experience|proactive/);
    // the owner editor read model carries none of them either (and says why it hides matching preferences)
    expect(lf(CAP)).toContain('It intentionally does not expose private matching-preference data.');
    expect(between(lf(CAP), 'create function public.rpc_get_worker_profile_for_edit()', 'revoke all on function public.rpc_get_worker_profile_for_edit()'))
      .not.toMatch(/exclusions|minimum_fee|years_experience|proactive/);
  });

  it('G04-3 CORRECTED: the client-write-forced-to-0 guard is superseded; the effective guard does not touch years_experience', () => {
    expect(lf(G173)).toMatch(/new\.years_experience := 0;/); // the stale source of the claim
    expect(lf(G174)).toMatch(/years_experience, team_capacity\) pass through freely/); // its replacement
    const guards = mentioning(migrationSql(), /create or replace function private\.guard_profile_write\(\)/);
    expect(guards[guards.length - 1]).toBe(GW); // effective definition
    expect(mentioning(patchSql(), /function private\.guard_profile_write\(/)).toEqual([]);
    const effective = between(lf(GW), 'create or replace function private.guard_profile_write()', 'create or replace function private.guard_need_write()');
    expect(effective).not.toMatch(/years_experience|minimum_fee_rsd|exclusions/);
    // ...and the owner keeps UPDATE on the table (own-row policy), so the three columns are writable by a hand-made client call
    expect(lf(RU1)).toMatch(/grant select, insert, update on table public\.app_profiles\s+to authenticated;/);
    expect(lf('supabase/migrations/20260825115040_cloud_profile_foundation_1_3b.sql')).toMatch(/CREATE POLICY app_profiles_update_own ON public\.app_profiles\s+FOR UPDATE TO authenticated/);
  });

  it('G04-5: need.minimum_experience_years is AI-proposable, hard for every worker, and the interview never asks for it', () => {
    expect(AI_PROPOSABLE_NEED_FACT_V2_KEYS).toEqual(expect.arrayContaining([
      'need.minimum_experience_years', 'need.category', 'need.required_skills', 'need.required_tools',
      'need.required_vehicles', 'need.required_licenses', 'need.critical_conditions']));
    // Historical registry remains readable; current interviews retire licence requirements.
    expect(lf(TI)).toContain("AI_PROPOSABLE_NEED_FACT_V2_KEYS.filter(key => key !== 'need.required_licenses')");
    expect(lf(TI)).toContain("key: { type: 'STRING', enum: INTERVIEW_NEED_FACT_V2_KEYS }");
    expect(lf(TI)).toContain("if (key === 'need.minimum_experience_years') return Number(value) >= 0 && Number(value) <= 60;");
    // X-10: the facts the interview still asks for are not the matcher inputs
    const asked = between(lf(TI), "const missing = ['need.description'", ".filter(key => !facts.has(key));");
    expect(asked).toMatch(/need\.description[\s\S]*need\.people_needed[\s\S]*need\.price_mode[\s\S]*need\.schedule_kind[\s\S]*need\.task_country_code[\s\S]*need\.task_geography/);
    expect(asked).not.toMatch(/required_skills|required_tools|required_vehicles|required_licenses|minimum_experience|need\.category/);
  });

  it('G04-6: the client ships PROFILE_EXCLUSION (and INSUFFICIENT_EXPERIENCE) copy although no screen can create either input', () => {
    const client = lf(AS);
    expect(client).toMatch(/PROFILE_EXCLUSION: 'Ovaj posao je m[^']*radnom profilu\.'/);
    expect(client).toMatch(/INSUFFICIENT_EXPERIENCE: 'Navedeno iskustvo[^']*'/);
    expect(client).toMatch(/'INSUFFICIENT_EXPERIENCE', 'PROFILE_EXCLUSION', 'CALENDAR_CONFLICT'/);
    expect(client).toMatch(/profileBlockers = new Set<ApplicationEligibilityBlocker>\(\[[^\]]*'PROFILE_EXCLUSION'/);
    // no creator exists (see the writer scan above): the copy is the only client mention of an exclusion
    expect(mentioning(appCode(), /PROFILE_EXCLUSION/)).toEqual([AS]);
  });

  it('G04-7: a task with no required skills passes the service gate for every worker; skills are not required for a draft', () => {
    expect(NEED_FACT_V2_DEFINITIONS['need.required_skills'].requiredForDraft).toBe(false);
    expect(NEED_FACT_V2_DEFINITIONS['need.category'].requiredForDraft).toBe(true);
    expect(lf(DE)).toMatch(/svc := cardinality\(n\.required_skills\) = 0/);
    expect(lf(K31)).toMatch(/svc := cardinality\(n\.required_skills\) = 0/);
  });

  it('G04-8: the identity gate is a fail-closed placeholder, defined once; the AI cannot create the requirement', () => {
    expect(between(lf(DE), 'create or replace function private.identity_admitted', 'comment on function private.identity_admitted'))
      .toMatch(/returns boolean language sql immutable[\s\S]*select false;/);
    expect(lf(DE)).toContain('FAIL-CLOSED PLACEHOLDER');
    expect(NEED_FACT_V2_DEFINITIONS['need.verified_identity_required']).toMatchObject({ manualOnly: true });
    expect(AI_PROPOSABLE_NEED_FACT_V2_KEYS).not.toContain('need.verified_identity_required');
    expect(lf(TI)).toContain('throw new Error(\'AI_MANUAL_ONLY_FACT_REJECTED\');');
  });

  it('G04-9: team capacity is an application-time check (submit, selection) and absent from the whole matcher chain', () => {
    expect(lf(SUB)).toContain("message='TEAM_CAPACITY_EXCEEDED'");
    expect(lf(SEL)).toContain("raise exception 'TEAM_CAPACITY_EXCEEDED'");
    expect(lf(SEL)).toContain('v_match := private.match_detail(p_need_id, v_resp.worker_profile_id);');
    expect(lf(W2I)).toContain('v_match := private.match_detail_for_calendar_interval(p_need_id, p_worker_profile_id,');
  });
});

describe('EX-06 S05 field-to-consumer map: collected-without-consumer and dead rows (NONE class)', () => {
  const chain = [DE, WAVE, W2C, W2I, W2F, W2A, K31, P27];

  it.each([
    ['team_capacity (APP only)', /team_capacity/],
    ['need.critical_conditions (X-03)', /critical_conditions/],
    ['need.price_basis (X-03; APP only)', /price_basis/],
    ['task_country_code (X-02)', /task_country_code/],
    ['operating_country_code (X-02)', /operating_country_code/],
    ['buffer_minutes (X-01)', /buffer_minutes/],
    ['display_name / bio / headline / portfolio (presentation)', /\bp\.(display_name|bio|headline|portfolio)\b/],
    ['the user-facing notification switch (X-04)', /notification_preferences|opportunities_enabled/],
  ])('no matcher-chain file reads %s', (_label, pattern) => {
    expect(mentioning(chain, pattern)).toEqual([]);
  });

  it('X-04: the user-facing opportunity switch is consumed at delivery time (emit_event), not by the matcher', () => {
    expect(lf(EV)).toContain("when p_event_type = 'OPPORTUNITY_AVAILABLE' then 'opportunities'");
    expect(lf(EV)).toContain('when not v_cat_on then \'CATEGORY_OFF\' else \'IN_APP_OFF\' end');
    expect(lf(WAVE)).toContain("p_event_type => 'OPPORTUNITY_AVAILABLE'");
  });

  it('X-05: the dispatch requeue is called from exactly four writers (availability, location, capacity, first activation), none for the four capability lists', () => {
    expect(count(lf(P27), /perform private\.requeue_open_needs_for_worker_v5\(/)).toBe(4);
    expect(lf(P27)).toMatch(/\(8,\s*'public\.rpc_complete_worker_profile\(uuid\)'/);
    // the AI save updates the four lists with a plain UPDATE and no requeue; the manual path is a direct table UPDATE
    expect(between(lf(OW), 'update public.app_profiles set display_name=value', 'where id=p.id;')).not.toMatch(/requeue/);
    expect(lf(WP)).toContain("supabase.from('app_profiles').update(patch)");
  });

  it('X-07: the experience gate reads years_experience while the editor offers only a free-text bio labelled "O tvom iskustvu"', () => {
    expect(lf('src/ui/workerProfile/WorkerProfilePresentation.tsx')).toContain('label="O tvom iskustvu"');
    expect(lf(DE)).toMatch(/coalesce\(p\.years_experience,0\) >= n\.minimum_experience_years/);
  });

  it('country is collected by the worker AI and review but only read by the location document and exports', () => {
    expect(lf(WI)).toContain('location: obj({ operatingCountryCode: string, city: string, radiusKm: integer })');
    expect(lf(OW)).toContain("missing:=missing||'\"Država i mesto rada\"'::jsonb");
  });
});

describe('EX-06 S05 field-to-consumer map: the repository text reproduces the md5 recorded on DEV (replay, still not a live read)', () => {
  // The effective matcher and guard bodies are patch chains. Replaying the patches on the repository text and hashing
  // the result must give the md5 that the DEV function surface of 2026-09-19 and the PKG-031 receipt of 2026-09-21
  // recorded, so the map describes the bodies that were actually applied then. Later DEV changes are not excluded.
  const SURFACE = 'supabase/proofs/pkg023f_closure_recert/evidence/dev_surface_20260919_after_pkg023abd.txt';
  const RECEIPT = 'supabase/operations/dev-alpha/ledger/20260921_pkg031_application.receipt.json';
  const ERASURE = 'supabase/migrations/20260913081147_clean_v5_event_bound_account_erasure.sql';
  const SA = 'supabase/migrations/20260911174600_clean_pre_v3_worker_single_authority.sql';
  const md5 = (text: string) => createHash('md5').update(text, 'utf8').digest('hex');
  const bodyOf = (text: string, header: string, delimiter: string): string => {
    const at = text.indexOf(header);
    if (at < 0) throw new Error(`header not found: ${header}`);
    const open = text.indexOf(delimiter, at) + delimiter.length;
    return text.slice(open, text.indexOf(delimiter, open));
  };
  const patchOnce = (body: string, anchor: string, replacement: string): string => {
    expect(body.split(anchor).length - 1).toBe(1); // the anchors are unique, as the migrations assert
    return body.replace(anchor, () => replacement);
  };
  const surfaceMd5 = (signature: string): string => {
    const found = lf(SURFACE).match(new RegExp(`^function:${signature.replace(/[().]/g, '\\$&')}[^:]*:([0-9a-f]{32}):`, 'm'));
    if (!found) throw new Error(`not in the recorded surface: ${signature}`);
    return found[1];
  };
  const receiptMd5 = (name: string): string => JSON.parse(lf(RECEIPT)).bodiesAfterOnDev[name];
  /** ERASURE:404-407 wraps every closure-relation trigger function after its first BEGIN. */
  const closureWrap = (prosrc: string): string => {
    const first = /\bbegin\b/i.exec(prosrc);
    if (!first) throw new Error('no BEGIN');
    const prefix = `${first[0]}\n if auth.role()='service_role' then\n  if TG_OP in ('UPDATE','DELETE') and private.closure_redaction_allowed_v5(TG_RELID,TG_OP,to_jsonb(OLD),case when TG_OP='UPDATE' then to_jsonb(NEW) else null end) then\n   if TG_OP='DELETE' then return OLD;end if;return NEW;\n  end if;\n end if;\n`;
    return prosrc.slice(0, first.index) + prefix + prosrc.slice(first.index + first[0].length);
  };
  const w2a = lf(W2A);
  const k31 = lf(K31);
  const anchors = [...w2a.matchAll(/anchor:=\$code\$([\s\S]*?)\$code\$;/g)].map(found => found[1]);
  const replacements = [...w2a.matchAll(/replacement:=\$code\$([\s\S]*?)\$code\$;/g)].map(found => found[1]);
  const kinds = [...k31.matchAll(/\$a\$([\s\S]*?)\$a\$,\s*\$b\$([\s\S]*?)\$b\$/g)].map(found => [found[1], found[2]] as const);

  it('match_detail_without_calendar: baseline, + W02 availability patch, + PKG-031b equal the recorded md5 values', () => {
    let body = bodyOf(lf(DE), 'create or replace function private.match_detail(nid uuid, pid uuid)', '$$');
    expect(md5(body)).toBe('599721689b8b89d2316f990231567b92'); // the W2A:9 predecessor pin
    body = patchOnce(body, '  sched := private.schedule_fit(pid, n.starts_at, n.ends_at, tz);', '  sched := private.worker_dispatch_time_admitted(nid,pid);');
    body = patchOnce(body, anchors[0], replacements[0]);
    expect(md5(body)).toBe(surfaceMd5('private.match_detail_without_calendar')); // DEV surface 2026-09-19
    expect(kinds.length).toBe(4);
    body = patchOnce(body, kinds[0][0], kinds[0][1]);
    body = patchOnce(body, kinds[1][0], kinds[1][1]);
    expect(md5(body)).toBe(receiptMd5('private.match_detail_without_calendar')); // PKG-031 receipt, 2026-09-21
    expect(md5(body)).toBe('9180606a038f3606b0906ab4aefdd0c1');
  });

  it('dispatch_cheap_candidate_admitted: baseline, + W02 availability + PKG-015b same world, + PKG-031b equal the recorded md5 values', () => {
    let body = bodyOf(lf(DE), 'create or replace function private.dispatch_cheap_candidate_admitted', '$$');
    expect(md5(body)).toBe('60806a6d33ae95f882f75d2d540a2603'); // the W2A:11 predecessor pin
    body = patchOnce(body, anchors[1], '      and private.worker_dispatch_time_admitted(nid,pid)');
    const owner = '      and p.account_id <> n.requester_account_id\n';
    body = patchOnce(body, owner, `${owner}      and private.accounts_same_world(n.requester_account_id, p.account_id)\n`);
    expect(md5(body)).toBe(surfaceMd5('private.dispatch_cheap_candidate_admitted')); // DEV surface 2026-09-19
    body = patchOnce(body, kinds[2][0], kinds[2][1]);
    body = patchOnce(body, kinds[3][0], kinds[3][1]);
    expect(md5(body)).toBe(receiptMd5('private.dispatch_cheap_candidate_admitted')); // PKG-031 receipt, 2026-09-21
    expect(md5(body)).toBe('0132fae38c75947179b4d389edc1e1f0');
  });

  it('the profile guards on DEV (G04-3 correction) are the repository bodies plus the closure wrapper; identity_admitted is the fail-closed body', () => {
    const guard = bodyOf(lf(GW), 'create or replace function private.guard_profile_write()', '$function$');
    expect(md5(guard)).not.toBe(surfaceMd5('private.guard_profile_write')); // the plain body is not what runs ...
    expect(md5(closureWrap(guard))).toBe(surfaceMd5('private.guard_profile_write')); // ... the wrapped one is
    expect(lf(ERASURE)).toContain("d:=replace(d,f.prosrc,regexp_replace(f.prosrc,'\\mBEGIN\\M',prefix,'i'));");
    for (const name of ['guard_worker_fact_authority', 'guard_worker_preference_authority']) {
      const body = bodyOf(lf(SA), `create function private.${name}()`, '$function$');
      expect(md5(closureWrap(body))).toBe(surfaceMd5(`private.${name}`));
    }
    expect(md5(bodyOf(lf(DE), 'create or replace function private.identity_admitted', '$$'))).toBe(surfaceMd5('private.identity_admitted'));
    expect(guard).not.toMatch(/years_experience|minimum_fee_rsd|exclusions/);
  });
});

describe('EX-06 S05 field-to-consumer map document stays in step with the pins', () => {
  const doc = () => lf(MAP_DOC);

  it.each([
    ['G04-1', 'CONFIRMED'], ['G04-2', 'CONFIRMED'], ['G04-3', 'CORRECTED'], ['G04-4', 'CONFIRMED'], ['G04-5', 'CONFIRMED'],
    ['G04-6', 'CONFIRMED'], ['G04-7', 'CONFIRMED'], ['G04-8', 'CONFIRMED'], ['G04-9', 'CONFIRMED'],
  ])('the map records %s with the verdict %s', (id, verdict) => {
    expect(doc()).toMatch(new RegExp(`\\| ${id} \\|[^\\n]*\\*\\*${verdict}`));
  });

  it('the map lists every additional finding and every decision item, and labels itself source text', () => {
    for (const id of ['X-01', 'X-02', 'X-03', 'X-04', 'X-05', 'X-06', 'X-07', 'X-08', 'X-09', 'X-10',
      'D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06', 'D-07', 'D-08', 'D-09', 'D-10', 'D-11', 'D-12']) {
      expect(doc()).toContain(`| ${id} |`);
    }
    expect(doc()).toContain('source text, not live proof');
    expect(doc()).toContain('md5 replay');
    for (const family of ['### F1.', '### F2.', '### F3.', '### F4.', '### F5.', '### F6.', '### F7.', '### F8.']) {
      expect(doc()).toContain(family);
    }
  });
});
