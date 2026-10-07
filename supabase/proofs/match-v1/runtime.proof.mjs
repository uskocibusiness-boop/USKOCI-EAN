// MATCH-V1 + DISCOVERY-ZAMENE disposable runtime proof: real Auth, real PostgREST, real database; loopback only.
// FAIL before (the DEV bodies) -> PASS after MATCH-V1 -> PASS after DISCOVERY-ZAMENE -> exact reverts -> FAIL again.
// No provider, device, push transport or DEV access. Tasks are direct-insert fixtures (labelled), except the
// POINT_TO_POINT task, which goes through the real product publication path (location review -> materialisation).
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {createFixtures, weeklyRule} from '../ex06/lib/fixtures.mjs';

const {assert, sql, rows, q, randomUUID, ok, env} = rt;
const DB = env.DB_URL;
assert.equal(DB, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const M = 'supabase/candidates/match-v1-20261007/', D = 'supabase/candidates/discovery-zamene-20261007/';
const mManifest = JSON.parse(fs.readFileSync(M + 'manifest.json', 'utf8'));
const dManifest = JSON.parse(fs.readFileSync(D + 'manifest.json', 'utf8'));
const out = env.MATCH_V1_ARTIFACT_DIR;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = {unit: 'MATCH-V1 + DISCOVERY-ZAMENE', result: 'RUNNING', sourceSha: env.GITHUB_SHA, disposableOnly: true, actualAuth: true,
  actualPostgrest: true, actualDatabase: true, liveAccess: false, providerCalls: 0, pushSends: 0, checks: [], observations: {}};
const write = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const pass = (name, detail) => { report.checks.push({name, result: 'PASS', ...(detail === undefined ? {} : {detail})}); write(); console.log('PASS ' + name); };
const psqlFile = file => execFileSync('psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', file], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000});
// Long statements (ticks, load measurements) get their own bound and their wall time is recorded.
function timedSql(text, timeout = 600000) {
  const started = Date.now();
  const output = execFileSync('psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At'], {input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout}).trim();
  return {output, ms: Date.now() - started};
}
function tick(batch = 200) {
  const {output, ms} = timedSql(`select private.dispatch_tick(${Number(batch)}, statement_timestamp())`);
  return {...JSON.parse(output.split('\n').at(-1)), wallMs: ms};
}
function refused(text, expected) {
  let error;
  try { execFileSync('psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1'], {input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 180000}); }
  catch (e) { error = e; }
  assert.ok(error, 'NOT_REFUSED:' + expected);
  assert.ok(String(error.stderr).includes(expected), 'WRONG_REFUSAL ' + expected + ': ' + String(error.stderr).slice(-700));
}
const catalog = () => sql(`select md5(string_agg(p.oid::regprocedure::text||':'||md5(p.prosrc)||':'||((to_jsonb(p)-'prosrc'-'oid')::text)||':'||coalesce(obj_description(p.oid,'pg_proc'),''),E'\\n' order by p.oid::regprocedure::text))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')`);
const closure = () => rows(`select private.closure_source_digest_v5() as digest,private.closure_erasure_program_digest_v5() as program,
  (select sha256 from private.closure_source_v5 where singleton) as certificate,(select sha256 from private.closure_erasure_source_v5 where singleton) as erasure,
  private.retention_ai_source_ready() as ready`)[0];
const conflicts40001 = () => Number(sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosrc like '%40001%'`));
const watermarkRows = () => Number(sql(`select count(*) from private.marketplace_config where key='match_v1_profile_requeue'`));
const bodyMd5 = signature => sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${q(signature)})`);

const fx = createFixtures(rt, {needPath: 'direct'});
const FILTER = {text: '', price: 'all', where: 'any', places: 1, when: 'any', dates: null, place: null};
const BOUNDS = [18, 42, 23, 47];
const NOVI_SAD = {lat: 45.27, lng: 19.83}, BEOGRAD = {lat: 44.82, lng: 20.46};
const disc = (actor, request) => actor.client.rpc('rpc_discovery_v1', {p_request: request});
const strip = response => { const copy = structuredClone(response); delete copy.asOf; if (copy.counts) delete copy.counts.observedAt; return copy; };
async function pageAll(actor, filter, scope = {kind: 'ALL'}) {
  let anchor = null, after = null, first = null;
  const items = [];
  for (let i = 0; i < 100; i++) {
    const page = await ok(disc(actor, {mode: 'PAGE', filter, anchor, scope, limit: 100, after}));
    first ??= page; anchor = page.anchor; items.push(...page.items);
    if (!page.hasMore) break;
    after = page.nextCursor;
  }
  return {first, items, ids: items.map(item => item.id).sort()};
}
const dowBelgrade = () => Number(sql(`select extract(dow from (statement_timestamp() at time zone 'Europe/Belgrade'))::integer`));
const allDays = () => [weeklyRule(randomUUID(), {weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00', endTime: '24:00', label: 'MATCH-V1 svaki dan'})];
const otherDay = () => [weeklyRule(randomUUID(), {weekdays: [(dowBelgrade() + 3) % 7], startTime: '00:00', endTime: '24:00', label: 'MATCH-V1 drugi dan'})];

function facts({phase, skill, tools = [], vehicles = [], exp = 0, mode = 'OFFERS', price, kind = 'FLEXIBLE', city = 'Novi Sad', geography}) {
  return {'need.title': `MATCH-V1 ${phase} zadatak`, 'need.description': 'Sinteticki zadatak MATCH-V1 dokaza na jednokratnoj bazi.',
    'need.category': 'MATCH-V1 dokaz', 'need.required_skills': [skill], 'need.required_tools': tools, 'need.required_vehicles': vehicles,
    'need.minimum_experience_years': exp, 'need.people_needed': 1, 'need.schedule_kind': kind,
    'need.task_geography': geography ?? {mode: 'STATIONARY', start: {city}}, 'need.price_mode': mode,
    ...(price ? {'need.price_rsd': price} : {}), 'need.task_country_code': 'RS'};
}

let R;
async function matchingCases(phase) {
  const tag = `${phase}-${randomUUID().slice(0, 8)}`, o = {};
  const worker = (label, skill, {availableNow = true, rules = [], city = 'Novi Sad', bypass} = {}) => fx.createWorker({label: `mv1-${label}-${tag}`,
    skills: [skill], radiusKm: 15, location: {city}, availability: {timezone: 'Europe/Belgrade', availableNow, rules, windows: []}, ...(bypass ? {bypass} : {})});
  const cheap = (n, w) => sql(`select private.dispatch_cheap_candidate_admitted(${q(n.needId)}::uuid,${q(w.profileId)}::uuid)`) === 't';
  const delivered = (n, w) => fx.readDeliveries(n.needId).some(d => d.worker_profile_id === w.profileId);
  const make = spec => fx.createNeedFromFacts(R, facts({phase, ...spec}), {path: 'direct'});
  // C1: a task that names tools and a vehicle; the worker has neither.
  { const s = `mv1-c1-${tag}`, w = await worker('c1', s), n = await make({skill: s, tools: ['Busilica'], vehicles: ['Kombi']});
    const m = fx.readMatch(n.needId, w.profileId), c = cheap(n, w); fx.runWave(n.needId);
    const d = delivered(n, w), a = await fx.submitApplication(w, n);
    o.tools = {responseAllowed: m.responseAllowed, hard: m.hardBlockers, cheap: c, delivered: d, applied: a.ok, refusal: a.ok ? null : a.error.message, score: m.score}; }
  // C2a: five years of experience asked; the worker has none recorded.
  { const s = `mv1-c2a-${tag}`, w = await worker('c2a', s), n = await make({skill: s, exp: 5});
    const m = fx.readMatch(n.needId, w.profileId), c = cheap(n, w); fx.runWave(n.needId);
    const d = delivered(n, w), a = await fx.submitApplication(w, n);
    o.experience = {responseAllowed: m.responseAllowed, hard: m.hardBlockers, cheap: c, delivered: d, applied: a.ok, refusal: a.ok ? null : a.error.message}; }
  // C2b: MY_PRICE 2000 RSD; the worker's (bypassed, no product writer) minimum fee is 5000 RSD.
  { const s = `mv1-c2b-${tag}`, w = await worker('c2b', s, {bypass: {minimumFeeRsd: 5000}}), n = await make({skill: s, mode: 'MY_PRICE', price: 2000});
    const m = fx.readMatch(n.needId, w.profileId), c = cheap(n, w); fx.runWave(n.needId);
    o.fee = {dispatchEligible: m.dispatchEligible, soft: m.dispatchBlockers, cheap: c, delivered: delivered(n, w)}; }
  // C3: "bilo kad" and a worker with only a weekly schedule ("Mogu odmah" off).
  { const s = `mv1-c3-${tag}`, w = await worker('c3', s, {availableNow: false, rules: allDays()}), n = await make({skill: s});
    const m = fx.readMatch(n.needId, w.profileId), c = cheap(n, w); fx.runWave(n.needId);
    o.flexible = {dispatchEligible: m.dispatchEligible, soft: m.dispatchBlockers, tier: m.timeTier ?? null, cheap: c, delivered: delivered(n, w)}; }
  // C4: "danas": one "Mogu odmah" worker a little farther (lower score), five schedule workers, one with no time today.
  { const s = `mv1-c4-${tag}`;
    const live = await worker('c4-live', s, {availableNow: true, city: 'Petrovaradin'});
    const sched = [];
    for (let i = 1; i <= 5; i++) sched.push(await worker(`c4-s${i}`, s, {availableNow: false, rules: allDays()}));
    const none = await worker('c4-none', s, {availableNow: false, rules: otherDay()});
    const n = await make({skill: s, kind: 'TODAY_FLEXIBLE'});
    const label = new Map([[live.profileId, 'live'], ...sched.map((w, i) => [w.profileId, 's' + (i + 1)]), [none.profileId, 'none']]);
    const m = w => fx.readMatch(n.needId, w.profileId);
    const cheapOf = Object.fromEntries([live, ...sched, none].map(w => [label.get(w.profileId), cheap(n, w)]));
    const tiers = Object.fromEntries([live, ...sched, none].map(w => [label.get(w.profileId), m(w).timeTier ?? null]));
    const scores = Object.fromEntries([live, ...sched].map(w => [label.get(w.profileId), Number(m(w).score)]));
    const waves = [];
    for (let i = 0; i < 3; i++) {
      const before = new Set(fx.readDeliveries(n.needId).map(d => d.worker_profile_id));
      const result = fx.runWave(n.needId);
      const added = fx.readDeliveries(n.needId).map(d => d.worker_profile_id).filter(id => !before.has(id)).map(id => label.get(id) ?? 'foreign').sort();
      waves.push({status: result.status, inserted: result.inserted, added});
    }
    o.today = {cheap: cheapOf, tiers, scores, waves}; }
  // C5: a manual skill edit (the direct PostgREST UPDATE of workerProfileClientService) after the task found nobody.
  { const s = `mv1-c5-${tag}`, other = `mv1-c5-other-${tag}`, w = await worker('c5', other), n = await make({skill: s});
    const t1 = tick();
    const first = fx.readSchedule(n.needId);
    await ok(w.client.from('app_profiles').update({skills: [other, s]}).eq('id', w.profileId).eq('account_id', w.id).eq('kind', 'WORKER').select('id').single());
    await sleep(32000);
    const second = tick();
    const d = delivered(n, w);
    const third = tick();
    const last = fx.readSchedule(n.needId);
    o.manualEdit = {firstStatus: first.lastStatus, firstReason: first.lastReason, delivered: d, requeueAfterEdit: second.profileRequeue ?? null,
      requeueNextTick: third.profileRequeue ?? null, lastStatus: last.lastStatus, nextRunInFuture: last.nextRunAt ? Date.parse(last.nextRunAt) > Date.now() : null,
      ticks: [t1, second, third].map(t => ({wallMs: t.wallMs, processed: t.processed, sent: t.sent, stopped: t.stopped, failed: t.failed}))}; }
  report.observations[phase] = o; write();
  return o;
}

function expectOld(o, phase) {
  assert.equal(o.tools.responseAllowed, false); assert.ok(o.tools.hard.includes('MISSING_REQUIRED_TOOL') && o.tools.hard.includes('MISSING_REQUIRED_VEHICLE'));
  assert.equal(o.tools.cheap, false); assert.equal(o.tools.delivered, false); assert.equal(o.tools.applied, false);
  pass(`MATCH_V1_${phase}_TOOLS_AND_VEHICLE_BLOCK_DISPATCH_AND_APPLICATION`, o.tools.refusal);
  assert.equal(o.experience.responseAllowed, false); assert.ok(o.experience.hard.includes('INSUFFICIENT_EXPERIENCE'));
  assert.equal(o.experience.cheap, false); assert.equal(o.experience.applied, false); assert.equal(o.experience.delivered, false);
  assert.equal(o.fee.dispatchEligible, false); assert.ok(o.fee.soft.includes('BELOW_MINIMUM_FEE')); assert.equal(o.fee.cheap, false); assert.equal(o.fee.delivered, false);
  pass(`MATCH_V1_${phase}_EXPERIENCE_AND_MINIMUM_FEE_BLOCK`);
  assert.equal(o.flexible.cheap, false); assert.equal(o.flexible.dispatchEligible, false); assert.equal(o.flexible.delivered, false);
  pass(`MATCH_V1_${phase}_FLEXIBLE_NEEDS_MOGU_ODMAH_SCHEDULE_ONLY_WORKER_NOT_REACHED`, o.flexible.soft);
  assert.deepEqual(o.today.cheap, {live: true, s1: false, s2: false, s3: false, s4: false, s5: false, none: false});
  assert.deepEqual(o.today.waves[0].added, ['live']);
  pass(`MATCH_V1_${phase}_TODAY_ONLY_MOGU_ODMAH_NO_SCHEDULE_WAVE`, o.today.waves);
  assert.equal(o.manualEdit.firstStatus, 'STOPPED'); assert.equal(o.manualEdit.delivered, false); assert.equal(o.manualEdit.requeueAfterEdit, null);
  pass(`MATCH_V1_${phase}_MANUAL_SKILL_EDIT_DOES_NOT_REQUEUE`);
}

function expectNew(o) {
  assert.equal(o.tools.responseAllowed, true); assert.deepEqual(o.tools.hard, []);
  assert.equal(o.tools.cheap, true); assert.equal(o.tools.delivered, true); assert.equal(o.tools.applied, true);
  pass('MATCH_V1_AFTER_TOOLS_REQUIRED_TASK_REACHES_AND_ACCEPTS_A_WORKER_WITHOUT_THEM', {score: o.tools.score});
  assert.equal(o.experience.responseAllowed, true); assert.deepEqual(o.experience.hard, []); assert.equal(o.experience.cheap, true);
  assert.equal(o.experience.delivered, true); assert.equal(o.experience.applied, true);
  assert.equal(o.fee.dispatchEligible, true); assert.ok(!o.fee.soft.includes('BELOW_MINIMUM_FEE')); assert.equal(o.fee.cheap, true); assert.equal(o.fee.delivered, true);
  pass('MATCH_V1_AFTER_EXPERIENCE_AND_MINIMUM_FEE_NO_LONGER_BLOCK');
  assert.equal(o.flexible.cheap, true); assert.equal(o.flexible.dispatchEligible, true); assert.equal(o.flexible.tier, 1); assert.equal(o.flexible.delivered, true);
  pass('MATCH_V1_AFTER_FLEXIBLE_REACHES_A_WORKER_WITH_ONLY_WEEKLY_RULES');
  assert.deepEqual(o.today.cheap, {live: true, s1: true, s2: true, s3: true, s4: true, s5: true, none: false});
  assert.deepEqual(o.today.tiers, {live: 1, s1: 2, s2: 2, s3: 2, s4: 2, s5: 2, none: null});
  assert.ok(Object.entries(o.today.scores).every(([k, v]) => k === 'live' || v > o.today.scores.live), 'LIVE_WORKER_MUST_HAVE_THE_LOWEST_SCORE');
  assert.equal(o.today.waves[0].added.length, 5); assert.ok(o.today.waves[0].added.includes('live'));
  assert.equal(o.today.waves[1].added.length, 1); assert.ok(/^s[1-5]$/.test(o.today.waves[1].added[0]));
  assert.ok(o.today.waves.every(w => !w.added.includes('none') && !w.added.includes('foreign')));
  assert.equal(o.today.waves[2].inserted, 0);
  pass('MATCH_V1_AFTER_TODAY_MOGU_ODMAH_FIRST_THEN_SCHEDULE_COVERING_TODAY', o.today);
  assert.equal(o.manualEdit.firstStatus, 'STOPPED'); assert.equal(o.manualEdit.delivered, true);
  assert.equal(o.manualEdit.requeueAfterEdit?.status, 'DONE'); assert.ok(o.manualEdit.requeueAfterEdit.queued >= 1);
  assert.equal(o.manualEdit.requeueNextTick?.queued ?? 0, 0); assert.equal(o.manualEdit.lastStatus, 'SENT'); assert.equal(o.manualEdit.nextRunInFuture, true);
  pass('MATCH_V1_AFTER_MANUAL_SKILL_EDIT_REQUEUES_ONCE_WITHOUT_PULLING_THE_WAVE_FORWARD', o.manualEdit);
}

async function zaMeneSetup() {
  const ZR = await fx.createRequester({label: 'mv1-zm-requester', world: 'TEST'});
  const s = `mv1-zm-${randomUUID().slice(0, 8)}`;
  const Z = await fx.createWorker({label: 'mv1-zm-worker', world: 'TEST', skills: [s], radiusKm: 15, location: {city: 'Novi Sad'},
    availability: {timezone: 'Europe/Belgrade', availableNow: false, rules: otherDay(), windows: []}});
  const direct = spec => fx.createNeedFromFacts(ZR, facts({phase: 'za-mene', ...spec}), {path: 'direct'});
  const t = {};
  t.z1 = await direct({skill: s});
  t.z2 = await direct({skill: s, tools: ['Busilica'], vehicles: ['Kombi']});
  t.z3 = await direct({skill: s + '-drugo'});
  t.z4 = await direct({skill: s, city: 'Niš'});
  t.z5 = await direct({skill: s, kind: 'TODAY_FLEXIBLE'});
  t.z7 = await direct({skill: s, kind: 'REMOTE_ANYTIME', geography: {mode: 'REMOTE'}});
  // The real publication path: confirmed location review with a start and an end pin -> materialize_resolved_location.
  t.z6 = await fx.createNeedFromFacts(ZR, {'need.title': 'MATCH-V1 prevoz od tacke do tacke',
    'need.description': 'Sinteticki prevoz kutija iz Novog Sada u Beograd, MATCH-V1 dokaz.', 'need.category': 'Selidba i prevoz',
    'need.required_skills': [s], 'need.people_needed': 1, 'need.schedule_kind': 'FLEXIBLE', 'need.price_mode': 'OFFERS', 'need.task_country_code': 'RS',
    'need.task_geography': {mode: 'POINT_TO_POINT', start: {label: 'Liman', city: 'Novi Sad'}, end: {label: 'Centar', city: 'Beograd'}}}, {path: 'product'});
  for (const key of Object.keys(t)) delete t[key].intent;
  // Nothing dispatches these tasks during the proof: Z stays undelivered, so the dispatch prefilter reads the bare rule.
  fx.retireFixtures({needs: Object.values(t).map(n => n.needId)});
  return {ZR, Z, s, t};
}
const zIds = zs => Object.fromEntries(Object.entries(zs.t).map(([k, n]) => [k, n.needId]));

async function p2pChecks(zs, label) {
  const all = await pageAll(zs.Z, FILTER);
  const item = all.items.find(x => x.id === zs.t.z6.needId);
  assert.ok(item, 'P2P_TASK_NOT_LISTED');
  assert.deepEqual(item.pin, {lat: NOVI_SAD.lat, lng: NOVI_SAD.lng, precision: 'COARSE_1KM'});
  const atStart = await pageAll(zs.Z, FILTER, {kind: 'POINT_MEMBERS', point: NOVI_SAD});
  const atEnd = await pageAll(zs.Z, FILTER, {kind: 'POINT_MEMBERS', point: BEOGRAD});
  assert.ok(atStart.ids.includes(zs.t.z6.needId)); assert.ok(!atEnd.ids.includes(zs.t.z6.needId));
  const map = await ok(disc(zs.Z, {mode: 'MAP', filter: FILTER, anchor: null, bounds: BOUNDS, grid: 12}));
  assert.ok(map.buckets.some(b => b.point.lat === NOVI_SAD.lat && b.point.lng === NOVI_SAD.lng));
  pass(`DISCOVERY_${label}_POINT_TO_POINT_TASK_ON_THE_MAP_AT_ITS_APPROXIMATE_START_POINT`, {pin: item.pin});
}

const predicate = (needId, profileId) => sql(`select private.worker_need_match_v1(${q(needId)}::uuid,${q(profileId)}::uuid)`) === 't';
async function forMeRefusedAsUnknownKey(zs, label) {
  const r = await disc(zs.Z, {mode: 'PAGE', filter: {...FILTER, forMe: true}, anchor: null, scope: {kind: 'ALL'}, limit: 10, after: null});
  assert.ok(r.error); assert.equal(r.error.message, 'P6_INVALID_FILTER');
  pass(`DISCOVERY_${label}_FOR_ME_KEY_REFUSED_AS_UNKNOWN_FILTER`);
}
async function snapshotDefault(zs) {
  const page = await ok(disc(zs.Z, {mode: 'PAGE', filter: FILTER, anchor: null, scope: {kind: 'ALL'}, limit: 100, after: null}));
  const map = await ok(disc(zs.Z, {mode: 'MAP', filter: FILTER, anchor: null, bounds: BOUNDS, grid: 12}));
  const places = await ok(disc(zs.Z, {mode: 'PLACES', filter: FILTER, anchor: null, prefix: '', facetArea: null, limit: 30, after: null}));
  return {page, map, places};
}
async function replayDefault(zs, snapshot, filter = FILTER) {
  return {
    page: await ok(disc(zs.Z, {mode: 'PAGE', filter, anchor: snapshot.page.anchor, scope: {kind: 'ALL'}, limit: 100, after: null})),
    map: await ok(disc(zs.Z, {mode: 'MAP', filter, anchor: snapshot.map.anchor, bounds: BOUNDS, grid: 12})),
    places: await ok(disc(zs.Z, {mode: 'PLACES', filter, anchor: snapshot.places.anchor, prefix: '', facetArea: null, limit: 30, after: null})),
  };
}
const sameResponses = (a, b) => { for (const k of ['page', 'map', 'places']) assert.deepEqual(strip(b[k]), strip(a[k]), 'RESPONSE_CHANGED:' + k); };

// ---------------------------------------------------------------- load measurement (old bodies vs MATCH-V1, same data)
// Synthetic SQL rows, labelled: 300 ACTIVE workers around Novi Sad (10 kinds of work, radius 10-50 km, half "Mogu odmah",
// two thirds with a weekly schedule) and 100 open tasks (FLEXIBLE, TODAY_FLEXIBLE, a future FIXED_WINDOW). Written with
// triggers off because no product writer creates bulk rows; the matcher only reads them. Disposable database only.
const LOAD_WORKERS = 300, LOAD_TASKS = 100;
const POOL = "array['fizicki poslovi','selidba','ciscenje stana','montaza namestaja','sitne popravke','molerski radovi','dostava','uredjenje baste','mv1-load-a','mv1-load-b']";
function seedLoad() {
  timedSql(`begin; set local session_replication_role=replica;
  create temporary table mv1_load on commit drop as select gen_random_uuid() as account_id, gen_random_uuid() as profile_id, g as i from generate_series(1,${LOAD_WORKERS}) g;
  insert into public.app_accounts(id,email) select account_id,'mv1-load-'||i||'@proof.invalid' from mv1_load;
  insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,radius_km,available_now)
   select profile_id,account_id,'WORKER','MV1 load '||i,'Novi Sad','ACTIVE',array[(${POOL})[1+(i%10)]],(array[10,15,25,50])[1+(i%4)],i%2=0 from mv1_load;
  insert into public.worker_match_preferences(worker_profile_id,worker_account_id,approximate_lat,approximate_lng)
   select profile_id,account_id,round((45.27+((i*37)%80-40)/100.0)::numeric,2),round((19.83+((i*53)%80-40)/100.0)::numeric,2) from mv1_load;
  insert into public.profile_availability_rules(profile_id,weekdays,start_time,end_time,starts_on,label)
   select profile_id,array[0,1,2,3,4,5,6],'08:00','20:00','2026-01-01','MV1 load' from mv1_load where i%3<>0;
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,required_tools,required_vehicles,
    required_licenses,minimum_experience_years,verified_identity_required,approximate_city,approximate_area,approximate_lat,approximate_lng,mode,required_slots,
    schedule_kind,starts_at,ends_at,execution_location_mode,task_country_code,task_timezone,response_deadline,published_at)
   select gen_random_uuid(),${q(R.id)}::uuid,${q(R.profileId)}::uuid,'PUBLISHED','MV1 opterecenje '||g,'Sinteticki zadatak za merenje brzine.','MV1 load',
    array[(${POOL})[1+(g%10)]],'{}','{}','{}',0,false,'Novi Sad','',
    round((45.27+((g*29)%60-30)/100.0)::numeric,2),round((19.83+((g*41)%60-30)/100.0)::numeric,2),'OFFERS',1,
    (array['FLEXIBLE','FLEXIBLE','TODAY_FLEXIBLE','FIXED_WINDOW','FLEXIBLE'])[1+(g%5)],
    case when g%5=3 then date_trunc('hour',statement_timestamp())+interval '2 days 10 hours' end,
    case when g%5=3 then date_trunc('hour',statement_timestamp())+interval '2 days 12 hours' end,
    'STATIONARY','RS','Europe/Belgrade',statement_timestamp()+interval '2 days',statement_timestamp()
   from generate_series(1,${LOAD_TASKS}) g;
  commit;`);
}
const MS_FN = `create function pg_temp.mv1_ms(q text) returns jsonb language plpgsql as $f$
declare t timestamptz:=clock_timestamp(); n bigint;
begin execute q into n; return jsonb_build_object('ms',round((extract(epoch from clock_timestamp()-t)*1000)::numeric,1),'rows',n); end $f$;`;
const TASKS20 = `(select id from public.needs where category='MV1 load' order by id limit 20)`;
const LOADW = `(select id from public.app_profiles where display_name like 'MV1 load %')`;
function measureLoad(newCode) {
  const sizes = JSON.parse(timedSql(`select jsonb_build_object('workerProfiles',(select count(*) from public.app_profiles where kind='WORKER'),
    'activeWorkers',(select count(*) from public.app_profiles where kind='WORKER' and profile_status='ACTIVE'),
    'workersWithPoint',(select count(*) from public.worker_match_preferences where approximate_geog is not null),
    'openTasks',(select count(*) from public.needs where status in ('PUBLISHED','SELECTION')),'loadTasks',(select count(*) from public.needs where category='MV1 load'))`).output);
  const read = JSON.parse(timedSql(`${MS_FN}
  select jsonb_build_object(
   'candidateRetrievalAllLoadTasks',pg_temp.mv1_ms($q$select count(*) from public.needs n cross join lateral private.candidate_profile_ids(n.id,40) c where n.category='MV1 load'$q$),
   'prefilter20x300',pg_temp.mv1_ms($q$select count(*) filter (where private.dispatch_cheap_candidate_admitted(n.id,p.id)) from ${TASKS20} n cross join ${LOADW} p$q$),
   'detailedMatcher20x300',pg_temp.mv1_ms($q$select count(*) filter (where (private.match_detail(n.id,p.id)->>'dispatchEligible')::boolean) from ${TASKS20} n cross join ${LOADW} p$q$)
   ${newCode ? `,'rule20x300',pg_temp.mv1_ms($q$select count(*) filter (where private.worker_need_match_v1(n.id,p.id)) from ${TASKS20} n cross join ${LOADW} p$q$)
   ,'draftProfiles',(select count(*) from public.app_profiles where kind='WORKER' and profile_status<>'ACTIVE')
   ,'fullRuleOnEveryDraftProfileOneTask',pg_temp.mv1_ms($q$select count(*) filter (where (private.worker_need_fit_v1(t.id,p.id,false)->>'matches')::boolean) from (select id from public.needs where category='MV1 load' order by id limit 1) t cross join public.app_profiles p where p.kind='WORKER' and p.profile_status<>'ACTIVE'$q$)
   ,'prefilterOnEveryDraftProfileOneTask',pg_temp.mv1_ms($q$select count(*) filter (where private.dispatch_cheap_candidate_admitted(t.id,p.id)) from (select id from public.needs where category='MV1 load' order by id limit 1) t cross join public.app_profiles p where p.kind='WORKER' and p.profile_status<>'ACTIVE'$q$)` : ''});`).output.split('\n').at(-1));
  const waves = JSON.parse(timedSql(`begin;
  ${MS_FN}
  select pg_temp.mv1_ms($q$select count(*) from (select private.dispatch_next_wave(id) as r from public.needs where category='MV1 load') x where x.r->>'status'='SENT'$q$);
  rollback;`).output.split('\n').filter(Boolean).at(-1));
  const result = {sizes, ...read, wavesAllLoadTasksRolledBack: waves};
  if (newCode) {
    result.profileRequeue50ChangedWorkers = JSON.parse(timedSql(`begin;
    ${MS_FN}
    set local session_replication_role=replica;
    update public.app_profiles set updated_at=statement_timestamp()-interval '40 seconds' where id in (select id from ${LOADW} x order by id limit 50);
    update private.marketplace_config set value=jsonb_set(value,'{after}',to_jsonb(statement_timestamp()-interval '10 minutes')) where key='match_v1_profile_requeue';
    set local session_replication_role=origin;
    select pg_temp.mv1_ms($q$select (private.requeue_changed_worker_profiles_v1(statement_timestamp())->>'queued')::bigint$q$);
    rollback;`).output.split('\n').filter(Boolean).at(-1));
  }
  const perTask = (entry, n) => entry ? Math.round(entry.ms / n * 10) / 10 : null;
  result.perLoadTaskMs = {candidateRetrieval: perTask(result.candidateRetrievalAllLoadTasks, sizes.loadTasks), wave: perTask(waves, sizes.loadTasks)};
  result.perPairMs = {prefilter: perTask(read.prefilter20x300, 20 * LOAD_WORKERS), detailedMatcher: perTask(read.detailedMatcher20x300, 20 * LOAD_WORKERS),
    ...(read.rule20x300 ? {rule: perTask(read.rule20x300, 20 * LOAD_WORKERS)} : {})};
  return result;
}
// The prefilter plan for a DRAFT profile: a parameter-only rule call is a One-Time Filter (runs before the status filter);
// MATCH-V1 passes the row columns, so the rule becomes a Join Filter that a DRAFT row never reaches.
function prefilterPlan(body, needId, profileId) {
  const query = body.replace(/--[^\n]*/g, '').replace(/\bnid\b/g, q(needId) + '::uuid').replace(/\bpid\b/g, q(profileId) + '::uuid');
  const plan = timedSql(`explain (analyze, costs off, timing off, summary off) ${query}`).output;
  return plan.split('\n').filter(line => /One-Time Filter|Join Filter|Filter:|Index Scan|Result/.test(line)).map(line => line.trim()).slice(0, 12);
}

try {
  const paused = fx.pauseSchedulers();
  report.observations.schedulers = paused;
  const baseCatalog = catalog(), baseClosure = closure(), base40001 = conflicts40001();
  assert.equal(baseClosure.ready, true); assert.equal(watermarkRows(), 0);
  for (const f of mManifest.functions) assert.equal(bodyMd5(f.signature), f.before_md5, 'PREDECESSOR:' + f.signature);
  assert.equal(bodyMd5(dManifest.functions[0].signature), dManifest.functions[0].before_md5);
  report.observations.chain = fx.chainCounts();
  pass('MATCH_V1_PREDECESSOR_BODIES_EQUAL_DEV_AND_CERTIFICATE_READY');
  R = await fx.createRequester({label: 'mv1-requester'});

  // ---------------------------------------------------------------- BEFORE (the DEV bodies)
  expectOld(await matchingCases('before'), 'BEFORE');
  const zs = await zaMeneSetup();
  report.observations.zaMeneTasks = zIds(zs);
  await p2pChecks(zs, 'BEFORE');
  await forMeRefusedAsUnknownKey(zs, 'BEFORE');

  // ---------------------------------------------------------------- refusals leave nothing behind
  const candidate = fs.readFileSync(M + 'candidate.sql', 'utf8');
  refused(candidate.replace(mManifest.functions.at(-1).before_md5, '0'.repeat(32)), 'MATCH_V1_PREDECESSOR_DRIFT');
  // The same pin inside the replacement loop: four bodies are already replaced when the last one refuses; all roll back.
  const lastPin = mManifest.functions.at(-1).before_md5, second = candidate.indexOf(lastPin, candidate.indexOf(lastPin) + 1);
  assert.ok(second > 0);
  refused(candidate.slice(0, second) + '0'.repeat(32) + candidate.slice(second + 32), 'MATCH_V1_PREIMAGE_DRIFT');
  refused(candidate.replace(mManifest.unchangedDependencies[0].body_md5, '0'.repeat(32)), 'MATCH_V1_DEPENDENCY_DRIFT');
  refused(fs.readFileSync(D + 'candidate.sql', 'utf8'), 'DISCOVERY_ZAMENE_REQUIRES_MATCH_V1');
  assert.equal(catalog(), baseCatalog); assert.deepEqual(closure(), baseClosure); assert.equal(watermarkRows(), 0);
  pass('MATCH_V1_DRIFT_AND_ORDER_REFUSALS_ARE_ATOMIC');

  // ---------------------------------------------------------------- MATCH-V1
  psqlFile(M + 'candidate.sql');
  for (const f of mManifest.functions) assert.equal(bodyMd5(f.signature), f.after_md5, 'POSTIMAGE:' + f.signature);
  for (const f of mManifest.newFunctions) assert.equal(bodyMd5(f.signature), f.body_md5, 'NEW:' + f.signature);
  for (const f of mManifest.unchangedDependencies) assert.equal(bodyMd5(f.signature), f.body_md5, 'DEPENDENCY:' + f.signature);
  assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001); assert.equal(watermarkRows(), 1);
  pass('MATCH_V1_APPLIED_EXACT_BODIES_CERTIFICATE_UNCHANGED_NO_NEW_40001', {certificate: baseClosure.certificate});
  refused(candidate, 'MATCH_V1_ALREADY_OR_PARTIALLY_APPLIED');
  await fx.reloadSchema();
  expectNew(await matchingCases('after'));
  await forMeRefusedAsUnknownKey(zs, 'AFTER_MATCH_V1');
  const ids = zIds(zs), Zp = zs.Z.profileId;
  const expected = {z1: true, z2: true, z3: false, z4: false, z5: false, z6: true, z7: true};
  const got = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, predicate(id, Zp)]));
  assert.deepEqual(got, expected);
  for (const [k, id] of Object.entries(ids)) {
    const cheap = sql(`select private.dispatch_cheap_candidate_admitted(${q(id)}::uuid,${q(Zp)}::uuid)`) === 't';
    const detail = fx.readMatch(id, Zp);
    assert.equal(cheap, got[k], 'PREFILTER_IS_NOT_THE_RULE:' + k);
    assert.equal(detail.dispatchEligible, got[k], 'DISPATCH_IS_NOT_THE_RULE:' + k);
    assert.equal(detail.responseAllowed, true, 'MANUAL_APPLICATION_MUST_STAY_OPEN:' + k);
  }
  pass('MATCH_V1_ONE_RULE_FOR_PREFILTER_DISPATCH_AND_PREDICATE_MANUAL_APPLICATION_OPEN', got);

  // ---------------------------------------------------------------- DISCOVERY-ZAMENE
  const snapshot = await snapshotDefault(zs);
  psqlFile(D + 'candidate.sql');
  assert.equal(bodyMd5(dManifest.functions[0].signature), dManifest.functions[0].after_md5);
  for (const f of dManifest.newFunctions) assert.equal(bodyMd5(f.signature), f.body_md5);
  assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001);
  refused(fs.readFileSync(D + 'candidate.sql', 'utf8'), 'DISCOVERY_ZAMENE_ALREADY_OR_PARTIALLY_APPLIED');
  await fx.reloadSchema();
  pass('DISCOVERY_ZAMENE_APPLIED_EXACT_BODIES_CERTIFICATE_UNCHANGED');
  sameResponses(snapshot, await replayDefault(zs, snapshot));
  sameResponses(snapshot, await replayDefault(zs, snapshot, {...FILTER, forMe: false}));
  pass('DISCOVERY_ZAMENE_DEFAULT_AND_FORME_FALSE_RESPONSES_BYTE_EQUAL_TO_P6_V3');
  const all = await pageAll(zs.Z, FILTER), mine = await pageAll(zs.Z, {...FILTER, forMe: true});
  const want = all.ids.filter(id => predicate(id, Zp)).sort();
  assert.deepEqual(mine.ids, want);
  for (const k of ['z1', 'z2', 'z6', 'z7']) assert.ok(mine.ids.includes(ids[k]), 'FOR_ME_MISSES:' + k);
  for (const k of ['z3', 'z4', 'z5']) assert.ok(!mine.ids.includes(ids[k]) && all.ids.includes(ids[k]), 'FOR_ME_LEAKS:' + k);
  assert.ok(Object.values(ids).every(id => all.ids.includes(id)), 'DEFAULT_MUST_LIST_EVERY_TASK');
  assert.notEqual(mine.first.filterKey, all.first.filterKey);
  const mapAll = await ok(disc(zs.Z, {mode: 'MAP', filter: FILTER, anchor: null, bounds: BOUNDS, grid: 12}));
  const mapMine = await ok(disc(zs.Z, {mode: 'MAP', filter: {...FILTER, forMe: true}, anchor: null, bounds: BOUNDS, grid: 12}));
  assert.equal(Number(mapAll.counts.mapped), all.ids.length); assert.equal(Number(mapMine.counts.mapped), mine.ids.length);
  const minePoints = new Set(mine.items.filter(x => x.pin).map(x => `${x.pin.lat}:${x.pin.lng}`));
  assert.ok(mapMine.buckets.every(b => b.kind === 'CLUSTER' || minePoints.has(`${b.point.lat}:${b.point.lng}`)), 'FOR_ME_MAP_SHOWS_A_FOREIGN_POINT');
  const placesMine = await ok(disc(zs.Z, {mode: 'PLACES', filter: {...FILTER, forMe: true}, anchor: null, prefix: '', facetArea: null, limit: 30, after: null}));
  assert.equal(Number(placesMine.counts.everywhere), mine.ids.length);
  pass('DISCOVERY_ZAMENE_FOR_ME_IS_EXACTLY_THE_RULE_SET_DEFAULT_IS_ALL', {all: all.ids.length, forMe: mine.ids.length, mappedForMe: mapMine.counts.mapped});
  const noProfile = await disc(R, {mode: 'PAGE', filter: {...FILTER, forMe: true}, anchor: null, scope: {kind: 'ALL'}, limit: 10, after: null});
  assert.equal(noProfile.error?.message, 'P6_FOR_ME_PROFILE_REQUIRED'); assert.equal(noProfile.error?.details, 'NOT_ACTIVE'); assert.equal(noProfile.error?.code, '22023');
  const badType = await disc(zs.Z, {mode: 'PAGE', filter: {...FILTER, forMe: 'da'}, anchor: null, scope: {kind: 'ALL'}, limit: 10, after: null});
  assert.equal(badType.error?.message, 'P6_INVALID_FILTER');
  pass('DISCOVERY_ZAMENE_NO_ACTIVE_PROFILE_REFUSED_WITH_A_CLEAR_CODE');
  await p2pChecks(zs, 'AFTER');

  // ---------------------------------------------------------------- exact reverts
  refused(fs.readFileSync(M + 'revert.sql', 'utf8'), 'MATCH_V1_REVERT_REQUIRES_DISCOVERY_ZAMENE_REVERT_FIRST');
  psqlFile(D + 'revert.sql');
  assert.equal(bodyMd5(dManifest.functions[0].signature), dManifest.functions[0].before_md5);
  sameResponses(snapshot, await replayDefault(zs, snapshot));
  await forMeRefusedAsUnknownKey(zs, 'AFTER_DZ_REVERT');
  psqlFile(M + 'revert.sql');
  assert.equal(catalog(), baseCatalog); assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001); assert.equal(watermarkRows(), 0);
  pass('MATCH_V1_AND_DISCOVERY_ZAMENE_EXACT_REVERT_CATALOG_AND_CERTIFICATE_RESTORED');
  await fx.reloadSchema();
  expectOld(await matchingCases('reverted'), 'REVERTED');

  // ---------------------------------------------------------------- load: old bodies vs MATCH-V1 (+ DISCOVERY-ZAMENE), same data
  seedLoad();
  const cheapSig = 'private.dispatch_cheap_candidate_admitted(uuid,uuid)';
  const cheapBody = () => sql(`select prosrc from pg_proc where oid=to_regprocedure(${q(cheapSig)})`);
  const loadTask = sql(`select id from public.needs where category='MV1 load' order by id limit 1`);
  const draftProfile = sql(`select id from public.app_profiles where kind='WORKER' and profile_status<>'ACTIVE' order by id limit 1`);
  const load = {old: measureLoad(false)};
  load.old.prefilterPlanForDraftProfile = prefilterPlan(cheapBody(), loadTask, draftProfile);
  report.observations.load = load; write();
  psqlFile(M + 'candidate.sql'); psqlFile(D + 'candidate.sql');
  await fx.reloadSchema();
  load.new = measureLoad(true);
  load.new.prefilterPlanForDraftProfile = prefilterPlan(cheapBody(), loadTask, draftProfile);
  report.observations.load = load; write();
  const viewer = await fx.createWorker({label: 'mv1-load-viewer', skills: ['fizicki poslovi'], radiusKm: 25, location: {city: 'Novi Sad'},
    availability: {timezone: 'Europe/Belgrade', availableNow: true, rules: [], windows: []}});
  async function timedDiscovery(request) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const started = Date.now(), response = await ok(disc(viewer, request));
      runs.push({ms: Date.now() - started, mapped: Number(response.counts?.mapped ?? response.counts?.everywhere ?? -1)});
    }
    return {medianMs: runs.map(r => r.ms).sort((a, b) => a - b)[1], mapped: runs.at(-1).mapped};
  }
  load.new.discoveryHttp = {
    pageAll: await timedDiscovery({mode: 'PAGE', filter: FILTER, anchor: null, scope: {kind: 'ALL'}, limit: 100, after: null}),
    pageForMe: await timedDiscovery({mode: 'PAGE', filter: {...FILTER, forMe: true}, anchor: null, scope: {kind: 'ALL'}, limit: 100, after: null}),
    mapAll: await timedDiscovery({mode: 'MAP', filter: FILTER, anchor: null, bounds: BOUNDS, grid: 12}),
    mapForMe: await timedDiscovery({mode: 'MAP', filter: {...FILTER, forMe: true}, anchor: null, bounds: BOUNDS, grid: 12}),
  };
  report.observations.load = load; write();
  psqlFile(D + 'revert.sql'); psqlFile(M + 'revert.sql');
  assert.equal(catalog(), baseCatalog); assert.deepEqual(closure(), baseClosure); assert.equal(watermarkRows(), 0);
  assert.ok(!load.new.prefilterPlanForDraftProfile.some(line => /One-Time Filter: .*worker_need_match_v1/.test(line)), 'RULE_IS_A_ONE_TIME_FILTER');
  assert.ok(load.new.perLoadTaskMs.wave < 2000 && load.new.perLoadTaskMs.candidateRetrieval < 2000, 'WAVE_TOO_SLOW');
  assert.ok(load.new.discoveryHttp.pageForMe.medianMs < 5000, 'FOR_ME_TOO_SLOW');
  pass('MATCH_V1_LOAD_TIMINGS_OLD_AND_NEW_ON_THE_SAME_DATA', {sizes: load.new.sizes, oldPerTask: load.old.perLoadTaskMs, newPerTask: load.new.perLoadTaskMs,
    oldPerPair: load.old.perPairMs, newPerPair: load.new.perPairMs, discoveryHttp: load.new.discoveryHttp, requeue: load.new.profileRequeue50ChangedWorkers});
  report.observations.auth = fx.authStats();
  report.result = 'PASS'; write();
  console.log('PASS MATCH_V1_DISCOVERY_ZAMENE_RUNTIME');
} catch (error) {
  report.result = 'FAIL'; report.failure = String(error?.stack ?? error).slice(0, 2500);
  // Which statements were still running or waiting (disposable database only; never terminated here).
  try { report.observations.backendsAtFailure = fx.diagnoseActiveBackends({terminate: false}); } catch { /* diagnostics are best effort */ }
  write();
  console.error('FAIL MATCH_V1 ' + report.failure);
  process.exitCode = 1;
}
