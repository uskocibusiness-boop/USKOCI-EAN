// ZONE-PERF disposable runtime proof: real Auth, real PostgREST, real database; loopback only. Never DEV.
//
// ONE function body is replaced: private.availability_timezone_valid(text). This proof shows, on a realistic seeded account (a requester with
// 44 tasks of every schedule kind, applications from four workers, 10 agreements):
//   BEFORE (the live body)  the Home / "Moji zadaci" readers reach the helper through the matcher and are slow;
//   APPLY                   exact post-image, metadata, ACL, closure certificate and errcode 40001 unchanged, a repeated application refused;
//   AFTER                   the same four readers, same payloads byte for byte (asOf aside), in milliseconds; the truth table is unchanged
//                           (27 probes + about 250 catalog names and their case / white space variants against an independent oracle);
//   ORDER                   MATCH-V1 applies on top of ZONE-PERF and on top of the live helper, and both orders revert exactly;
//   REVERT                  exact: catalog and certificate restored and the readers are slow again.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {createFixtures, weeklyRule} from '../ex06/lib/fixtures.mjs';

const {assert, sql, rows, q, randomUUID, ok, env} = rt;
const DB = env.DB_URL;
assert.equal(DB, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const Z = 'supabase/candidates/zone-perf-20261007/', M = 'supabase/candidates/match-v1-20261007/';
const zManifest = JSON.parse(fs.readFileSync(Z + 'manifest.json', 'utf8'));
const mManifest = JSON.parse(fs.readFileSync(M + 'manifest.json', 'utf8'));
const TZ = 'private.availability_timezone_valid(text)';
const fn = zManifest.functions[0];
assert.equal(fn.signature, TZ);
const out = env.MATCH_V1_ARTIFACT_DIR;
const md5 = text => createHash('md5').update(text).digest('hex');
const HARD_S = 90;
const report = {unit: 'ZONE-PERF', result: 'RUNNING', sourceSha: env.GITHUB_SHA, disposableOnly: true, actualAuth: true, actualPostgrest: true, actualDatabase: true,
  liveAccess: false, providerCalls: 0, pushSends: 0, checks: [], failures: [], observations: {}};
const write = () => fs.writeFileSync(path.join(out, 'zone-report.json'), JSON.stringify(report, null, 2) + '\n');
const pass = (name, detail) => { report.checks.push({name, result: 'PASS', ...(detail === undefined ? {} : {detail})}); write(); console.log('PASS ' + name); };

// ---------------------------------------------------------------- bounded SQL
function run(text, {timeoutS = HARD_S} = {}) {
  const started = Date.now();
  try {
    const output = execFileSync('psql', [DB, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'],
      {input: `set statement_timeout='${timeoutS}s';\nset lock_timeout='5s';\n${text}`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: (timeoutS + 30) * 1000, maxBuffer: 1 << 26}).trim();
    return {ok: true, output, wallMs: Date.now() - started};
  } catch (error) {
    const detail = String(error.stderr ?? '') + String(error.message ?? '');
    return {ok: false, timedOut: /statement timeout|canceling statement|ETIMEDOUT/i.test(detail), error: detail.slice(-600), wallMs: Date.now() - started};
  }
}
const lastLine = text => text.split('\n').filter(Boolean).at(-1);
const psqlFile = file => { const r = run(fs.readFileSync(file, 'utf8'), {timeoutS: 180}); assert.ok(r.ok, 'APPLY_FAILED:' + file + ':' + r.error); };
function refused(text, expected) {
  const r = run(text, {timeoutS: 180});
  assert.ok(!r.ok, 'NOT_REFUSED:' + expected);
  assert.ok(String(r.error).includes(expected), 'WRONG_REFUSAL ' + expected + ': ' + String(r.error).slice(-500));
}
const bodyMd5 = signature => sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${q(signature)})`);
const metadata = () => JSON.parse(sql(`select (to_jsonb(p)-'prosrc')::text from pg_proc p where p.oid=to_regprocedure(${q(TZ)})`));
const catalog = () => sql(`select md5(string_agg(p.oid::regprocedure::text||':'||md5(p.prosrc)||':'||((to_jsonb(p)-'prosrc'-'oid')::text)||':'||coalesce(obj_description(p.oid,'pg_proc'),''),E'\\n' order by p.oid::regprocedure::text))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')`);
const closure = () => rows(`select private.closure_source_digest_v5() as digest,private.closure_erasure_program_digest_v5() as program,
  (select sha256 from private.closure_source_v5 where singleton) as certificate,(select sha256 from private.closure_erasure_source_v5 where singleton) as erasure,
  private.retention_ai_source_ready() as ready`)[0];
const conflicts40001 = () => Number(sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosrc like '%40001%'`));

// ---------------------------------------------------------------- the helper itself: cost and truth table
const timedHelper = calls => {
  const r = run(`do $t$ declare t0 timestamptz:=clock_timestamp(); n bigint; begin
    select count(*) into n from generate_series(1,${calls}) g where private.availability_timezone_valid(case when g>0 then 'Europe/Belgrade' end);
    perform set_config('zp.helper', jsonb_build_object('ms', round((extract(epoch from clock_timestamp()-t0)*1000)::numeric,2), 'n', n)::text, false); end $t$;
    select current_setting('zp.helper');`);
  assert.ok(r.ok, 'HELPER_TIMING_FAILED:' + r.error);
  const v = JSON.parse(lastLine(r.output));
  return {calls, totalMs: v.ms, msPerCall: Math.round(v.ms / calls * 1000) / 1000, accepted: Number(v.n)};
};
const names = rows(`select name from pg_catalog.pg_timezone_names order by name`).map(r => r.name);
assert.ok(names.length > 500 && names.includes('Europe/Belgrade') && names.includes('UTC'));
const sampleNames = names.filter((_, i) => i % 24 === 0);
const EXTENDED = [...new Set([...zManifest.truthTableProbes, ...sampleNames.flatMap(n => [n, n.toLowerCase(), n.toUpperCase(), ' ' + n, n + ' ', n + 'x'])])];
/** The helper's answers against an independent oracle: the old expression written out and evaluated against the catalog directly (one hashed scan). */
function truthTable(values) {
  const r = run(`with probes as (select t.v, t.i from unnest(array[${values.map(v => v === null ? 'null' : q(v)).join(',')}]::text[]) with ordinality t(v,i))
    select jsonb_build_object('probes', count(*), 'accepted', count(*) filter (where new_answer),
      'mismatches', coalesce(jsonb_agg(jsonb_build_object('value', v, 'oracle', oracle_answer, 'helper', new_answer) order by i) filter (where oracle_answer is distinct from new_answer), '[]'::jsonb),
      'answers', jsonb_agg(new_answer order by i))
    from (select v, i, (v is not null and length(v)<=100 and (v='UTC' or position('/' in v)>0) and v not like 'posix/%' and v not like 'right/%'
        and v in (select z.name from pg_catalog.pg_timezone_names z)) as oracle_answer, private.availability_timezone_valid(v) as new_answer from probes) x;`, {timeoutS: 170});
  assert.ok(r.ok, 'TRUTH_TABLE_FAILED:' + r.error);
  return JSON.parse(lastLine(r.output));
}

// ---------------------------------------------------------------- the readers
const READERS = [
  {key: 'home', label: 'rpc_home_attention', call: 'public.rpc_home_attention()'},
  {key: 'needsPage', label: "rpc_list_my_needs_page('ALL', 30)", call: "public.rpc_list_my_needs_page('ALL', 30, null, null)"},
  {key: 'tasks', label: 'rpc_list_my_tasks', call: 'public.rpc_list_my_tasks()'},
  {key: 'agreements', label: "rpc_list_my_agreements_page('ALL', 30)", call: "public.rpc_list_my_agreements_page('ALL', 30, null, null)", control: true},
];
// DEV md5 of every function on the reader path (read-only readback of canonical DEV, 2026-10-07).
const NEEDS_PAGE_SIG = 'public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid)', OWN_COUNTS_SIG = 'private.own_task_counts(uuid)';
const READER_PINS = {
  'public.rpc_home_attention()': '1703b04e248759a19cbcc539621ed906',
  [NEEDS_PAGE_SIG]: '509d6c345c84cc6a597bde46d9ae6b75',
  'public.rpc_list_my_tasks()': '2a8ff0fa8a1211414e5e1fc69c6fb4f7',
  'public.rpc_list_my_agreements_page(text,integer,timestamp with time zone,uuid)': '5017f90ff8d9e5cd29ead0f88a6b0106',
  'public.rpc_read_task(uuid)': '1e01db5140248f27ab374187f01fded3',
  'public.selectable_application_count(needs)': 'fe53442f8b661d6f33d22a54e2a468a8',
  'private.need_candidate_states_v5(uuid)': '112ed258e838b2cae22b248ac94ebe7c',
  'private.need_candidate_states_v5(uuid,uuid[])': '20092ecb2a781776ddb0ce9c46ba8aa5',
  [OWN_COUNTS_SIG]: '01d695467d5fa39dec180086cb07de40',
};
const MEASURED_SIGS = ['public.rpc_home_attention()', NEEDS_PAGE_SIG, 'public.rpc_list_my_tasks()', 'public.rpc_list_my_agreements_page(text,integer,timestamp with time zone,uuid)', OWN_COUNTS_SIG];
const readerFidelity = () => Object.fromEntries(Object.entries(READER_PINS).map(([sig, dev]) => {
  const chain = sql(`select coalesce(md5(prosrc),'') from pg_proc where oid=to_regprocedure(${q(sig)})`);
  return [sig, {dev, chain: chain || null, equal: chain === dev}];
}));
const CALLS = 3;   // one cold call in a fresh backend, then two warm ones (the slow state costs seconds per call)
function readerRun(accountId, reader) {
  const claims = JSON.stringify({sub: accountId, role: 'authenticated'});
  const r = run(`begin;
    set local track_functions='all';
    select set_config('request.jwt.claims', ${q(claims)}, true);
    select set_config('request.jwt.claim.sub', ${q(accountId)}, true);
    set local role authenticated;
    do $t$ declare t0 timestamptz; r jsonb; first jsonb; ms numeric[]:='{}'; i integer;
    begin
      for i in 1..${CALLS} loop
        t0:=clock_timestamp(); r:=${reader.call}; ms:=ms||round((extract(epoch from clock_timestamp()-t0)*1000)::numeric,2);
        if i=1 then first:=r; end if;
      end loop;
      perform set_config('zp.ms', to_jsonb(ms)::text, false);
      perform set_config('zp.first', first::text, false);
    end $t$;
    reset role;
    select jsonb_build_object('ms', current_setting('zp.ms')::jsonb, 'payload', current_setting('zp.first')::jsonb, 'functions',
      (select coalesce(jsonb_agg(jsonb_build_object('name', schemaname||'.'||funcname, 'calls', calls, 'selfMs', round(self_time::numeric,1)) order by self_time desc), '[]'::jsonb)
         from (select * from pg_stat_xact_user_functions order by self_time desc limit 60) f));
    rollback;`, {timeoutS: 150});
  if (!r.ok) return {error: r.error, timedOut: r.timedOut};
  const v = JSON.parse(lastLine(r.output));
  const warm = v.ms.slice(1).sort((a, b) => a - b);
  const median = warm.length % 2 ? warm[(warm.length - 1) / 2] : (warm[warm.length / 2 - 1] + warm[warm.length / 2]) / 2;
  const callsOf = name => v.functions.find(f => f.name === name)?.calls ?? 0;
  return {coldMs: v.ms[0], warmMedianMs: Math.round(median * 100) / 100, warmMinMs: warm[0], allMs: v.ms, payload: v.payload, wallMs: r.wallMs,
    helperCalls: callsOf('private.availability_timezone_valid'), matcherCalls: callsOf('private.match_detail_without_calendar'),
    selectableCountCalls: callsOf('public.selectable_application_count'), top: v.functions.slice(0, 6)};
}
async function httpMs(account, name, args = {}) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try { const started = Date.now(); await ok(account.client.rpc(name, args)); runs.push(Date.now() - started); break; }
      catch (error) { if (attempt === 3) return {error: String(error).slice(0, 200)}; await new Promise(resolve => setTimeout(resolve, 2000)); }
    }
  }
  return runs.sort((a, b) => a - b)[1];
}
const httpSample = async account => ({home: await httpMs(account, 'rpc_home_attention'),
  needsPage: await httpMs(account, 'rpc_list_my_needs_page', {p_scope: 'ALL', p_limit: 30, p_before_at: null, p_before_id: null})});
const stripVolatile = value => {
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'asOf').map(([k, v]) => [k, stripVolatile(v)]));
  return value;
};
const firstDifference = (a, b, at = '$') => {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDifference(a[k], b[k], `${at}.${k}`); if (d) return d; }
  }
  return at;
};

// ---------------------------------------------------------------- the seeded account
const fx = createFixtures(rt, {needPath: 'direct'});
const allDays = () => [weeklyRule(randomUUID(), {weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00', endTime: '24:00', label: 'ZP svaki dan'})];
const KINDS = ['FLEXIBLE', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE', 'FIXED_WINDOW'];
async function seedAccount() {
  const skill = 'zp-' + randomUUID().slice(0, 8);
  const requester = await fx.createRequester({label: 'zp-requester'});
  const workers = [];
  for (let i = 0; i < 4; i++) {
    workers.push(await fx.createWorker({label: `zp-w${i}`, skills: [skill], radiusKm: 15, location: {city: 'Novi Sad'},
      availability: {timezone: 'Europe/Belgrade', availableNow: true, rules: allDays(), windows: []}}));
  }
  const needs = [];
  const day = 24 * 3600 * 1000;
  for (let i = 0; i < 44; i++) {
    const kind = KINDS[i % KINDS.length];
    const facts = {'need.title': `ZP zadatak ${i}`, 'need.description': 'Sinteticki zadatak ZONE-PERF dokaza na jednokratnoj bazi.', 'need.category': 'ZP dokaz',
      'need.required_skills': [skill], 'need.required_tools': [], 'need.required_vehicles': [], 'need.minimum_experience_years': 0, 'need.people_needed': 1,
      'need.schedule_kind': kind, 'need.task_geography': {mode: 'STATIONARY', start: {city: 'Novi Sad'}}, 'need.price_mode': 'OFFERS', 'need.task_country_code': 'RS'};
    let window = null;
    if (kind === 'FIXED_WINDOW') {
      const start = new Date(Math.ceil((Date.now() + (2 + i % 3) * day) / 3600000) * 3600000 + 10 * 3600000);
      window = {startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 2 * 3600000).toISOString()};
      facts['need.starts_at'] = window.startsAt; facts['need.ends_at'] = window.endsAt;
    }
    const need = await fx.createNeedFromFacts(requester, facts, {path: 'direct'});
    needs.push({...need, kind, window});
  }
  // 32 tasks get one application each; the first ten tasks without a fixed window then get theirs selected = 10 agreements, 22 applications stay selectable.
  const applications = new Map();
  for (let i = 0; i < 32; i++) {
    const w = workers[i % 4];
    const a = await fx.submitApplication(w, needs[i], {price: 3000, proposedStartAt: needs[i].window?.startsAt ?? null, proposedEndAt: needs[i].window?.endsAt ?? null});
    assert.ok(a.ok, 'APPLICATION_REFUSED:' + i + ':' + JSON.stringify(a.error));
    applications.set(`${i}:${w.id}`, a.data);
  }
  const agreed = [];
  for (let i = 0; i < 32 && agreed.length < 10; i++) {
    if (needs[i].kind === 'FIXED_WINDOW') continue;
    const w = workers[i % 4];
    await fx.selectResponse(requester, needs[i], applications.get(`${i}:${w.id}`));
    agreed.push(i);
  }
  assert.equal(agreed.length, 10);
  const shape = rows(`select count(*)::integer as needs,
      count(*) filter (where n.schedule_kind in ('TODAY_FLEXIBLE','TOMORROW_FLEXIBLE','WEEK_FLEXIBLE'))::integer as relative,
      count(*) filter (where n.schedule_kind='FIXED_WINDOW')::integer as fixed_window,
      (select count(*) from public.marketplace_responses r join public.needs x on x.id=r.need_id where x.requester_account_id=${q(requester.id)}::uuid)::integer as applications,
      (select count(*) from public.agreements a where a.requester_account_id=${q(requester.id)}::uuid)::integer as agreements,
      (select count(*) from public.needs x cross join lateral private.need_candidate_states_v5(x.id) c where x.requester_account_id=${q(requester.id)}::uuid and c.candidate_state='SELECTABLE')::integer as selectable_applications
    from public.needs n where n.requester_account_id=${q(requester.id)}::uuid`)[0];
  return {requester, workers, needs, shape};
}

// ---------------------------------------------------------------- measure the readers in the current state
function measureAll(account, label) {
  const result = {};
  for (const reader of READERS) {
    const m = readerRun(account.id, reader);
    assert.ok(!m.error, `${label}:${reader.label}:${m.timedOut ? 'TIMED_OUT' : 'FAILED'}:${m.error}`);
    result[reader.key] = m;
  }
  report.observations[label] = Object.fromEntries(READERS.map(r => [r.key, (({payload, ...rest}) => rest)(result[r.key])])); write();
  return result;
}
const gate = (name, good, detail) => { if (good) pass(name, detail); else { report.failures.push({name, detail}); write(); console.error('FAIL ' + name + ' ' + JSON.stringify(detail).slice(0, 600)); } };

let state = 'LIVE';
let baseCatalog = null, baseClosure = null;
try {
  fx.pauseSchedulers();
  baseCatalog = catalog(); baseClosure = closure();
  const base40001 = conflicts40001();
  assert.equal(baseClosure.ready, true);
  assert.equal(bodyMd5(TZ), fn.before_md5, 'PREDECESSOR_IS_NOT_THE_DEV_BODY');
  const baseMetadata = metadata();
  report.observations.chain = fx.chainCounts(); write();
  pass('ZONE_PERF_PREDECESSOR_IS_THE_DEV_BODY_AND_CERTIFICATE_READY', {helperMd5: fn.before_md5, certificate: baseClosure.certificate});

  const account = await seedAccount();
  report.observations.seededAccount = account.shape; write();
  assert.ok(account.shape.needs === 44 && account.shape.agreements === 10 && account.shape.relative >= 20 && account.shape.selectable_applications >= 16, 'SEEDED_ACCOUNT_NOT_REALISTIC:' + JSON.stringify(account.shape));
  pass('ZONE_PERF_SEEDED_A_REALISTIC_ACCOUNT_44_TASKS_ALL_SCHEDULE_KINDS_APPLICATIONS_10_AGREEMENTS', account.shape);
  const viewer = account.requester;

  // The readers are measured as they run on canonical DEV. The historical chain does not replay EX-04 S1 (it carries an older rpc_list_my_needs_page
  // that never reaches the matcher), so the two functions of that package are installed from the captured DEV text (md5 verified against DEV) when
  // the chain body differs. Everything else on the reader path is compared with the DEV md5 and reported.
  const readerFidelityBefore = readerFidelity();
  if (!readerFidelityBefore[NEEDS_PAGE_SIG].equal || !readerFidelityBefore[OWN_COUNTS_SIG].equal) psqlFile('supabase/proofs/zone-perf/dev-readers.sql');
  await fx.reloadSchema();
  const readerFidelityNow = readerFidelity();
  assert.deepEqual(closure(), baseClosure);
  baseCatalog = catalog();   // the baseline of every later revert: the chain plus the DEV reader bodies
  report.observations.readerFidelity = {chainBefore: readerFidelityBefore, measured: readerFidelityNow, differsFromDev: Object.entries(readerFidelityNow).filter(([, v]) => !v.equal).map(([k]) => k)}; write();
  gate('ZONE_PERF_THE_MEASURED_READERS_CARRY_THE_DEV_BODIES', MEASURED_SIGS.every(sig => readerFidelityNow[sig].equal),
    {installedFromDevReadback: [NEEDS_PAGE_SIG, OWN_COUNTS_SIG].filter(sig => !readerFidelityBefore[sig].equal), differsFromDev: report.observations.readerFidelity.differsFromDev});

  // ------------------------------------------------------------ BEFORE
  const helperBefore = timedHelper(30);
  const truthBefore = truthTable(EXTENDED);
  const before = measureAll(viewer, 'before');
  report.observations.httpBefore = await httpSample(viewer); write();
  report.observations.helperBefore = helperBefore; report.observations.truthBefore = {probes: truthBefore.probes, accepted: truthBefore.accepted, mismatches: truthBefore.mismatches}; write();
  assert.equal(truthBefore.mismatches.length, 0, 'ORACLE_DISAGREES_WITH_THE_LIVE_HELPER:' + JSON.stringify(truthBefore.mismatches.slice(0, 5)));
  gate('ZONE_PERF_BEFORE_THE_LIVE_HELPER_SCANS_THE_CATALOG_ON_EVERY_CALL', helperBefore.msPerCall >= 10 && helperBefore.accepted === helperBefore.calls, helperBefore);
  gate('ZONE_PERF_BEFORE_THE_READERS_REACH_THE_HELPER_THROUGH_THE_MATCHER',
    ['home', 'needsPage', 'tasks'].every(k => before[k].helperCalls > 0 && before[k].matcherCalls > 0) && before.agreements.helperCalls === 0,
    Object.fromEntries(READERS.map(r => [r.key, {helperCalls: before[r.key].helperCalls, matcherCalls: before[r.key].matcherCalls, selectableCountCalls: before[r.key].selectableCountCalls}])));

  // ------------------------------------------------------------ refusals leave nothing behind
  const candidate = fs.readFileSync(Z + 'candidate.sql', 'utf8');
  refused(candidate.replaceAll(fn.before_md5, '0'.repeat(32)), 'ZONE_PERF_PREDECESSOR_DRIFT');
  refused(candidate.replaceAll(fn.after_md5, '0'.repeat(32)), 'ZONE_PERF_PAYLOAD_DRIFT');
  refused(fs.readFileSync(Z + 'revert.sql', 'utf8'), 'ZONE_PERF_REVERT_PREIMAGE_DRIFT');
  assert.equal(catalog(), baseCatalog); assert.deepEqual(closure(), baseClosure);
  pass('ZONE_PERF_DRIFT_AND_REVERT_BEFORE_APPLY_REFUSALS_ARE_ATOMIC');

  // ------------------------------------------------------------ APPLY
  psqlFile(Z + 'candidate.sql'); state = 'ZONE_PERF';
  assert.equal(bodyMd5(TZ), fn.after_md5, 'POSTIMAGE');
  assert.deepEqual(metadata(), baseMetadata, 'HELPER_METADATA_CHANGED');
  assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001);
  refused(candidate, 'ZONE_PERF_ALREADY_APPLIED');
  const others = Number(sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')`));
  pass('ZONE_PERF_APPLIED_EXACT_BODY_SAME_METADATA_AND_ACL_CERTIFICATE_UNCHANGED_NO_NEW_40001', {certificate: baseClosure.certificate, functionsInCatalog: others, acl: metadata().proacl});
  const afterCatalog = catalog();

  // ------------------------------------------------------------ AFTER
  const truthAfter = truthTable(EXTENDED);
  assert.equal(truthAfter.mismatches.length, 0, 'TRUTH_TABLE_CHANGED:' + JSON.stringify(truthAfter.mismatches.slice(0, 5)));
  assert.deepEqual(truthAfter.answers, truthBefore.answers, 'ANSWERS_DIFFER_FROM_BEFORE');
  gate('ZONE_PERF_TRUTH_TABLE_UNCHANGED_PROBES_AND_CATALOG_NAMES_WITH_CASE_AND_WHITE_SPACE_VARIANTS',
    truthAfter.probes === EXTENDED.length && truthAfter.accepted === truthBefore.accepted,
    {probes: truthAfter.probes, accepted: truthAfter.accepted, probeAnswers: Object.fromEntries(zManifest.truthTableProbes.map((p, i) => [p === null ? 'NULL' : p.length > 20 ? `${p.slice(0, 8)}...(${p.length} chars)` : p, truthAfter.answers[i]]))});
  const helperAfter = timedHelper(2000);
  report.observations.helperAfter = helperAfter; write();
  gate('ZONE_PERF_AFTER_THE_PRODUCT_ZONE_COSTS_NO_CATALOG_SCAN', helperAfter.msPerCall < 0.5 && helperAfter.accepted === helperAfter.calls, {before: helperBefore.msPerCall, after: helperAfter.msPerCall, unit: 'ms per call'});
  const after = measureAll(viewer, 'after');
  for (const r of READERS) {
    const difference = firstDifference(stripVolatile(before[r.key].payload), stripVolatile(after[r.key].payload));
    assert.equal(difference, null, `PAYLOAD_DIFFERS:${r.label}:${difference}`);
  }
  pass('ZONE_PERF_PAYLOADS_OF_ALL_FOUR_READERS_IDENTICAL_BEFORE_AND_AFTER', Object.fromEntries(READERS.map(r => [r.key, JSON.stringify(stripVolatile(after[r.key].payload)).length + ' bytes, md5 ' + md5(JSON.stringify(stripVolatile(after[r.key].payload)))])));
  const table = Object.fromEntries(READERS.map(r => [r.key, {before: {cold: before[r.key].coldMs, warm: before[r.key].warmMedianMs}, after: {cold: after[r.key].coldMs, warm: after[r.key].warmMedianMs},
    helperCalls: {before: before[r.key].helperCalls, after: after[r.key].helperCalls}}]));
  report.observations.table = table; write();
  gate('ZONE_PERF_AFTER_THE_MATCHER_BACKED_READERS_ARE_FASTER_COLD_AND_WARM',
    ['home', 'needsPage', 'tasks'].every(k => after[k].warmMedianMs * 2 <= before[k].warmMedianMs && after[k].coldMs * 1.5 <= before[k].coldMs && after[k].helperCalls === before[k].helperCalls), table);
  gate('ZONE_PERF_AFTER_THE_AGREEMENTS_READER_THAT_NEVER_CALLS_THE_HELPER_IS_NOT_SLOWER',
    after.agreements.warmMedianMs <= before.agreements.warmMedianMs * 1.5 + 5 && after.agreements.helperCalls === 0, table.agreements);
  // the transport as the app sees it (Auth + HTTP + JSON), median of three, not a gate
  report.observations.httpAfter = await httpSample(viewer); write();

  // ------------------------------------------------------------ ORDER: MATCH-V1 on top of ZONE-PERF, and on top of the live helper
  const mCandidate = fs.readFileSync(M + 'candidate.sql', 'utf8');
  const mDep = mManifest.unchangedDependencies.find(d => d.signature === TZ);
  assert.equal(mDep.body_md5, fn.before_md5); assert.equal(mDep.alsoAcceptedAfterZonePerf, fn.after_md5);
  assert.ok(!mManifest.functions.some(f => f.signature === TZ));
  const mBodiesApplied = () => mManifest.functions.every(f => bodyMd5(f.signature) === f.after_md5);
  // A) ZONE-PERF first, MATCH-V1 second
  psqlFile(M + 'candidate.sql');
  assert.ok(mBodiesApplied()); assert.equal(bodyMd5(TZ), fn.after_md5, 'MATCH_V1_TOUCHED_THE_HELPER'); assert.deepEqual(closure(), baseClosure);
  refused(mCandidate, 'MATCH_V1_ALREADY_OR_PARTIALLY_APPLIED');
  psqlFile(M + 'revert.sql');
  assert.equal(catalog(), afterCatalog, 'ORDER_A_REVERT_OF_MATCH_V1_DID_NOT_RESTORE_THE_CATALOG'); assert.deepEqual(closure(), baseClosure);
  pass('ZONE_PERF_ORDER_A_ZONE_PERF_THEN_MATCH_V1_APPLIES_LEAVES_THE_HELPER_ALONE_AND_REVERTS_EXACTLY');
  // B) MATCH-V1 first (helper still the slow live body), ZONE-PERF second
  psqlFile(Z + 'revert.sql'); state = 'LIVE';
  assert.equal(catalog(), baseCatalog, 'ZONE_PERF_REVERT_DID_NOT_RESTORE_THE_CATALOG'); assert.deepEqual(closure(), baseClosure); assert.equal(bodyMd5(TZ), fn.before_md5);
  const truthReverted = truthTable(zManifest.truthTableProbes);
  assert.equal(truthReverted.mismatches.length, 0);
  psqlFile(M + 'candidate.sql');
  assert.ok(mBodiesApplied()); assert.equal(bodyMd5(TZ), fn.before_md5, 'MATCH_V1_TOUCHED_THE_HELPER_B');
  psqlFile(Z + 'candidate.sql'); state = 'ZONE_PERF';
  assert.equal(bodyMd5(TZ), fn.after_md5); assert.ok(mBodiesApplied()); assert.deepEqual(closure(), baseClosure);
  psqlFile(Z + 'revert.sql'); state = 'LIVE';
  psqlFile(M + 'revert.sql');
  assert.equal(catalog(), baseCatalog, 'ORDER_B_DID_NOT_RESTORE_THE_CATALOG'); assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001);
  pass('ZONE_PERF_ORDER_B_MATCH_V1_THEN_ZONE_PERF_APPLIES_AND_BOTH_REVERT_EXACTLY_CATALOG_AND_CERTIFICATE_RESTORED');

  // ------------------------------------------------------------ REVERT: slow again
  const reverted = measureAll(viewer, 'reverted');
  gate('ZONE_PERF_REVERTED_THE_READERS_ARE_SLOW_AGAIN_FAIL_AGAIN',
    ['home', 'needsPage', 'tasks'].every(k => reverted[k].warmMedianMs >= after[k].warmMedianMs * 2), {afterWarm: Object.fromEntries(READERS.map(r => [r.key, after[r.key].warmMedianMs])), revertedWarm: Object.fromEntries(READERS.map(r => [r.key, reverted[r.key].warmMedianMs]))});
  report.observations.auth = fx.authStats();
} catch (error) {
  report.failures.push({name: 'ZONE_PERF_RUN', detail: String(error?.stack ?? error).slice(0, 1800)});
  try { report.observations.backendsAtFailure = fx.diagnoseActiveBackends({terminate: false}); } catch { /* best effort */ }
  write();
  console.error('FAIL ZONE_PERF ' + report.failures.at(-1).detail);
} finally {
  try {
    if (state === 'ZONE_PERF') { psqlFile(Z + 'revert.sql'); state = 'LIVE'; }
  } catch (error) { report.failures.push({name: 'ZONE_PERF_REVERT', detail: String(error).slice(0, 500)}); }
  try {
    const anyMatch = mManifest.newFunctions.some(f => sql(`select to_regprocedure(${q(f.signature)}) is not null`) === 't');
    if (anyMatch) psqlFile(M + 'revert.sql');
    if (baseCatalog) { assert.equal(catalog(), baseCatalog); assert.deepEqual(closure(), baseClosure); pass('ZONE_PERF_ALL_STATES_REVERTED_CATALOG_AND_CERTIFICATE_RESTORED'); }
  } catch (error) { report.failures.push({name: 'ZONE_PERF_FINAL_STATE', detail: String(error).slice(0, 500)}); }
}

// ---------------------------------------------------------------- verdict and the table for the job page
report.result = report.failures.length === 0 ? 'PASS' : 'FAIL';
write();
const t = report.observations.table, b = report.observations.before, a = report.observations.after, rv = report.observations.reverted;
const f1 = v => (v === undefined || v === null) ? 'n/a' : String(Math.round(v * 10) / 10);
const row = r => t && b && a ? `| ${r.label} | ${f1(b[r.key].coldMs)} | ${f1(b[r.key].warmMedianMs)} | ${f1(a[r.key].coldMs)} | ${f1(a[r.key].warmMedianMs)} | ${f1(b[r.key].warmMedianMs / Math.max(a[r.key].warmMedianMs, 0.1))}x | ${b[r.key].helperCalls} | ${rv ? f1(rv[r.key].warmMedianMs) : 'n/a'} |` : `| ${r.label} | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`;
const lines = [
  '### ZONE-PERF disposable proof (realistic seeded account, real Auth and PostgREST)', '',
  `Seeded account: ${JSON.stringify(report.observations.seededAccount ?? {})}.`, '',
  `Zone helper: ${f1(report.observations.helperBefore?.msPerCall)} ms per call before, ${f1(report.observations.helperAfter?.msPerCall)} ms after. Truth table: ${report.observations.truthBefore?.probes ?? 'n/a'} probes (the 27 of the manifest plus catalog names with case and white space variants) against an independent oracle, mismatches ${JSON.stringify(report.observations.truthBefore?.mismatches ?? 'n/a')}.`, '',
  '| reader (server execution, ms) | BEFORE cold | BEFORE warm | AFTER cold | AFTER warm | warm speed-up | helper calls per call | REVERTED warm |', '|---|---|---|---|---|---|---|---|',
  ...READERS.map(row), '',
  `Through PostgREST as the app calls it (Auth + HTTP + JSON, median of 3): rpc_home_attention ${JSON.stringify(report.observations.httpBefore?.home ?? 'n/a')} ms before, ${JSON.stringify(report.observations.httpAfter?.home ?? 'n/a')} ms after; rpc_list_my_needs_page ${JSON.stringify(report.observations.httpBefore?.needsPage ?? 'n/a')} ms before, ${JSON.stringify(report.observations.httpAfter?.needsPage ?? 'n/a')} ms after.`, '',
  `Result: ${report.result}${report.failures.length ? ' - failures: ' + report.failures.map(x => x.name).join(', ') : ''}`,
];
fs.writeFileSync(path.join(out, 'zone-summary.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
process.exitCode = report.result === 'PASS' ? 0 : 1;
