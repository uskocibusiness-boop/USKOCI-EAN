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
const M = 'supabase/candidates/match-v1-20261007/', D = 'supabase/candidates/discovery-zamene-20261007/', Z = 'supabase/candidates/zone-perf-20261007/';
const mManifest = JSON.parse(fs.readFileSync(M + 'manifest.json', 'utf8'));
const zManifest = JSON.parse(fs.readFileSync(Z + 'manifest.json', 'utf8'));
const dManifest = JSON.parse(fs.readFileSync(D + 'manifest.json', 'utf8'));
const out = env.MATCH_V1_ARTIFACT_DIR;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = {unit: 'MATCH-V1 + DISCOVERY-ZAMENE', result: 'RUNNING', sourceSha: env.GITHUB_SHA, disposableOnly: true, actualAuth: true,
  actualPostgrest: true, actualDatabase: true, liveAccess: false, providerCalls: 0, pushSends: 0, checks: [], observations: {}};
const write = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const pass = (name, detail) => { report.checks.push({name, result: 'PASS', ...(detail === undefined ? {} : {detail})}); write(); console.log('PASS ' + name); };
const psqlFile = file => execFileSync('psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', file], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000});
// Long statements (ticks) get their own bound and their wall time is recorded.
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
const TZ = 'private.availability_timezone_valid(text)';
// The dispatch switch (owner policy 2026-10-07): one wave to every admitted worker (ALL, the default) or the ladder (LADDER); one row, no code change.
const DISPATCH_DEFAULT = mManifest.dispatchSwitch.default;
const dispatchRows = () => Number(sql(`select count(*) from private.marketplace_config where key='match_v1_dispatch'`));
const dispatchRow = () => JSON.parse(sql(`select value::text from private.marketplace_config where key='match_v1_dispatch'`));
const setDispatch = patch => sql(`update private.marketplace_config set value=value||${q(JSON.stringify(patch))}::jsonb, updated_at=statement_timestamp() where key='match_v1_dispatch'`);
const resetDispatch = () => sql(`update private.marketplace_config set value=${q(JSON.stringify(DISPATCH_DEFAULT))}::jsonb, updated_at=statement_timestamp() where key='match_v1_dispatch'`);

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
  // C5: a manual skill edit (the direct PostgREST UPDATE of workerProfileClientService) after the task found nobody (n), and after the wave of another
  // task (n2) has just been sent to its own worker (w2): the edited worker now fits both. In mode ALL a changed profile re-queues even n2 (there is
  // no wave window to wait for); in mode LADDER n2 sits inside a running wave window and is left alone (no wave is pulled forward).
  { const s = `mv1-c5-${tag}`, s2 = `mv1-c5b-${tag}`, other = `mv1-c5-other-${tag}`, w = await worker('c5', other), w2 = await worker('c5b', s2);
    const n = await make({skill: s}), n2 = await make({skill: s2});
    const t1 = tick();
    const first = fx.readSchedule(n.needId), firstN2 = fx.readSchedule(n2.needId);
    await ok(w.client.from('app_profiles').update({skills: [other, s, s2]}).eq('id', w.profileId).eq('account_id', w.id).eq('kind', 'WORKER').select('id').single());
    await sleep(32000);
    const second = tick();
    const d = delivered(n, w), dInsideWindow = delivered(n2, w);
    const third = tick();
    const last = fx.readSchedule(n.needId);
    o.manualEdit = {firstStatus: first.lastStatus, firstReason: first.lastReason, firstN2Status: firstN2.lastStatus, n2OwnWorkerDelivered: delivered(n2, w2),
      delivered: d, deliveredInsideRunningWindow: dInsideWindow, requeueAfterEdit: second.profileRequeue ?? null,
      requeueNextTick: third.profileRequeue ?? null, lastStatus: last.lastStatus, nextRunInFuture: last.nextRunAt ? Date.parse(last.nextRunAt) > Date.now() : null,
      ticks: [t1, second, third].map(t => ({wallMs: t.wallMs, processed: t.processed, sent: t.sent, stopped: t.stopped, failed: t.failed, deferred: t.deferred ?? null}))}; }
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
  assert.equal(o.manualEdit.firstN2Status, 'SENT'); assert.equal(o.manualEdit.n2OwnWorkerDelivered, true); assert.equal(o.manualEdit.deliveredInsideRunningWindow, false);
  pass(`MATCH_V1_${phase}_MANUAL_SKILL_EDIT_DOES_NOT_REQUEUE`);
}

// mode 'ALL' (the default of MATCH-V1: one wave to every admitted worker) or 'LADDER' (the waves of today: 5, 5, 10, 20)
function expectNew(o, mode) {
  const all = mode === 'ALL', after = all ? 'AFTER' : 'AFTER_LADDER';
  assert.equal(o.tools.responseAllowed, true); assert.deepEqual(o.tools.hard, []);
  assert.equal(o.tools.cheap, true); assert.equal(o.tools.delivered, true); assert.equal(o.tools.applied, true);
  pass(`MATCH_V1_${after}_TOOLS_REQUIRED_TASK_REACHES_AND_ACCEPTS_A_WORKER_WITHOUT_THEM`, {score: o.tools.score});
  assert.equal(o.experience.responseAllowed, true); assert.deepEqual(o.experience.hard, []); assert.equal(o.experience.cheap, true);
  assert.equal(o.experience.delivered, true); assert.equal(o.experience.applied, true);
  assert.equal(o.fee.dispatchEligible, true); assert.ok(!o.fee.soft.includes('BELOW_MINIMUM_FEE')); assert.equal(o.fee.cheap, true); assert.equal(o.fee.delivered, true);
  pass(`MATCH_V1_${after}_EXPERIENCE_AND_MINIMUM_FEE_NO_LONGER_BLOCK`);
  assert.equal(o.flexible.cheap, true); assert.equal(o.flexible.dispatchEligible, true); assert.equal(o.flexible.tier, 1); assert.equal(o.flexible.delivered, true);
  pass(`MATCH_V1_${after}_FLEXIBLE_REACHES_A_WORKER_WITH_ONLY_WEEKLY_RULES`);
  assert.deepEqual(o.today.cheap, {live: true, s1: true, s2: true, s3: true, s4: true, s5: true, none: false});
  assert.deepEqual(o.today.tiers, {live: 1, s1: 2, s2: 2, s3: 2, s4: 2, s5: 2, none: null});
  assert.ok(Object.entries(o.today.scores).every(([k, v]) => k === 'live' || v > o.today.scores.live), 'LIVE_WORKER_MUST_HAVE_THE_LOWEST_SCORE');
  assert.ok(o.today.waves.every(w => !w.added.includes('none') && !w.added.includes('foreign')));
  if (all) {
    // ONE wave to every worker the rule admits: the "Mogu odmah" worker (a little farther, lowest score) and the five schedule workers together; nothing is left for a second wave.
    assert.deepEqual(o.today.waves[0].added, ['live', 's1', 's2', 's3', 's4', 's5']);
    assert.equal(o.today.waves[1].inserted, 0); assert.equal(o.today.waves[2].inserted, 0);
    pass('MATCH_V1_AFTER_TODAY_EVERY_ADMITTED_WORKER_IN_THE_SAME_WAVE_MOGU_ODMAH_AND_SCHEDULE_TOGETHER', o.today);
  } else {
    assert.equal(o.today.waves[0].added.length, 5); assert.ok(o.today.waves[0].added.includes('live'));
    assert.equal(o.today.waves[1].added.length, 1); assert.ok(/^s[1-5]$/.test(o.today.waves[1].added[0]));
    assert.equal(o.today.waves[2].inserted, 0);
    pass('MATCH_V1_AFTER_LADDER_TODAY_MOGU_ODMAH_FIRST_THEN_SCHEDULE_COVERING_TODAY', o.today);
  }
  assert.equal(o.manualEdit.firstStatus, 'STOPPED'); assert.equal(o.manualEdit.delivered, true);
  assert.equal(o.manualEdit.firstN2Status, 'SENT'); assert.equal(o.manualEdit.n2OwnWorkerDelivered, true);
  assert.equal(o.manualEdit.requeueAfterEdit?.status, 'DONE'); assert.ok(o.manualEdit.requeueAfterEdit.queued >= 1);
  assert.equal(o.manualEdit.requeueNextTick?.queued ?? 0, 0); assert.equal(o.manualEdit.lastStatus, 'SENT'); assert.equal(o.manualEdit.nextRunInFuture, true);
  // a task whose wave has just been sent: re-queued by a changed profile in mode ALL (no wave window to wait for), left alone in the ladder (no wave is pulled forward)
  assert.equal(o.manualEdit.deliveredInsideRunningWindow, all);
  pass(`MATCH_V1_${after}_MANUAL_SKILL_EDIT_REQUEUES_ONCE_${all ? 'EVEN_RIGHT_AFTER_A_WAVE' : 'WITHOUT_PULLING_THE_WAVE_FORWARD'}`, o.manualEdit);
}

// ---------------------------------------------------------------- the dispatch policy (owner 2026-10-07): everyone at once by default, the ladder behind ONE row
// Thirteen real workers in Novi Sad plus one "late" worker in Nis (outside every circle until he moves), all with one unique skill: a "bilo kad" task of that
// skill is matched by the same thirteen workers in every state, so what the dispatch does with them is comparable between today's ladder and the new modes.
const pool = {late: null, lateMoved: false};
async function poolSetup() {
  const tag = randomUUID().slice(0, 8), skill = `mv1-pool-${tag}`;
  const spec = (label, city) => ({label: `mv1-pool-${label}-${tag}`, skills: [skill], radiusKm: 15, location: {city},
    availability: {timezone: 'Europe/Belgrade', availableNow: true, rules: [], windows: []}});
  const workers = [];
  for (let i = 0; i < 13; i++) workers.push(await fx.createWorker(spec(String(i), 'Novi Sad')));
  pool.late = await fx.createWorker(spec('late', 'Niš'));
  Object.assign(pool, {tag, skill, workers, index: new Map(workers.map((w, i) => [w.profileId, i]))});
  report.observations.pool = {workers: workers.length, late: 1}; write();
}
const poolNeed = label => fx.createNeedFromFacts(R, facts({phase: 'pool-' + label, skill: pool.skill}), {path: 'direct'});
const poolIndex = profileId => pool.index.get(profileId) ?? 99;   // 99 = the late worker
const countOf = text => Number(sql(text));
const eventCount = needId => countOf(`select count(*) from public.user_activity_events where entity_id=${q(needId)}::uuid and event_type='OPPORTUNITY_AVAILABLE'`);
const notificationCount = needId => countOf(`select count(*) from public.notification_deliveries d join public.user_activity_events e on e.id=d.event_id
  where e.entity_id=${q(needId)}::uuid and e.event_type='OPPORTUNITY_AVAILABLE'`);
/** Validity of the deliveries of a task, in minutes from their creation: {min, max, n}. */
const deliveryMinutes = needId => rows(`select round(extract(epoch from min(expires_at-created_at))/60)::integer as min, round(extract(epoch from max(expires_at-created_at))/60)::integer as max,
  count(*)::integer as n from public.opportunity_deliveries where need_id=${q(needId)}::uuid`)[0];
const notificationMinutes = needId => rows(`select round(extract(epoch from min(d.expires_at-d.created_at))/60)::integer as min, round(extract(epoch from max(d.expires_at-d.created_at))/60)::integer as max
  from public.notification_deliveries d join public.user_activity_events e on e.id=d.event_id where e.entity_id=${q(needId)}::uuid and e.event_type='OPPORTUNITY_AVAILABLE'`)[0];
/** Runs waves one task at a time (what the tick calls) until one sends nothing: [{status, reason, inserted, added: [pool indexes]}]. */
function waveSeries(needId, max = 6) {
  const out = [];
  for (let i = 0; i < max; i++) {
    const before = new Set(fx.readDeliveries(needId).map(d => d.worker_profile_id));
    const r = fx.runWave(needId);
    const added = fx.readDeliveries(needId).map(d => d.worker_profile_id).filter(id => !before.has(id)).map(poolIndex).sort((a, b) => a - b);
    out.push({status: r.status, reason: r.reason ?? null, inserted: r.inserted, added});
    if (r.status !== 'SENT') break;
  }
  return out;
}
const deliveredIndexes = needId => fx.readDeliveries(needId).map(d => poolIndex(d.worker_profile_id)).sort((a, b) => a - b);
const minutesFromNow = iso => (Date.parse(iso) - Date.now()) / 60000;

/** Today's ladder on the pool, with the DEV bodies: 5, 5, 3 and nothing; one tick reaches five of thirteen workers. */
async function ladderBaseline(phase) {
  const n = await poolNeed(phase + '-series'), series = waveSeries(n.needId);
  const nt = await poolNeed(phase + '-tick');
  tick();
  const afterTick = deliveredIndexes(nt.needId);
  const expected = pool.lateMoved ? [5, 5, 4, 0] : [5, 5, 3, 0];
  assert.deepEqual(series.map(w => w.added.length), expected, 'THE_LADDER_OF_TODAY_IS_NOT_5_5_REST');
  assert.equal(afterTick.length, 5, 'ONE_TICK_OF_THE_LADDER_REACHES_FIVE');
  return {series, afterTick};
}

async function allModeCases() {
  const o = {};
  // ALL-1: one tick, every admitted worker, one round, no window between groups; deliveries and notifications stay valid for 24 hours
  { const n = await poolNeed('all'), t = tick();
    const d = fx.readDeliveries(n.needId), rounds = fx.readRounds(n.needId), sched = fx.readSchedule(n.needId);
    const valid = deliveryMinutes(n.needId), notificationValid = notificationMinutes(n.needId);
    const roundMinutes = countOf(`select round(extract(epoch from (deadline_at-statement_timestamp()))/60) from public.dispatch_rounds where need_id=${q(n.needId)}::uuid`);
    const again = fx.runWave(n.needId), lastRound = fx.readRounds(n.needId).at(-1);
    o.oneTick = {deliveries: d.length, rounds: rounds.map(r => ({status: r.status, batch: Number(r.batch_size), limit: Number(r.candidate_limit_used), source: r.budget_source})),
      events: eventCount(n.needId), notifications: notificationCount(n.needId), valid, notificationValid, roundMinutes, schedule: sched, again: {status: again.status, inserted: again.inserted, roundStopReason: lastRound.stop_reason},
      tickDeferred: t.deferred};
    assert.deepEqual(deliveredIndexes(n.needId), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'ONE_TICK_MUST_REACH_ALL_THIRTEEN');
    assert.equal(rounds.length, 1); assert.equal(rounds[0].status, 'SENT'); assert.equal(Number(rounds[0].batch_size), 500); assert.equal(Number(rounds[0].candidate_limit_used), 500);
    assert.equal(rounds[0].budget_source, 'FIXED');
    assert.equal(o.oneTick.events, 13); assert.equal(o.oneTick.notifications, 26, 'IN_APP and PUSH per worker');
    assert.ok(valid.n === 13 && valid.min >= 1438 && valid.max <= 1441, 'DELIVERIES_VALID_24_HOURS:' + JSON.stringify(valid));
    assert.ok(notificationValid.min >= 1438 && notificationValid.max <= 1441, 'NOTIFICATIONS_VALID_24_HOURS:' + JSON.stringify(notificationValid));
    assert.ok(roundMinutes >= 13 && roundMinutes <= 15, 'ROUND_WINDOW_IS_THE_CHECK_TIME:' + roundMinutes);
    assert.equal(sched.lastStatus, 'SENT'); const nextIn = minutesFromNow(sched.nextRunAt); assert.ok(nextIn > 12 && nextIn < 16, 'NEXT_CHECK:' + nextIn);
    assert.deepEqual(o.oneTick.again, {status: 'STOPPED', inserted: 0, roundStopReason: 'NO_ELIGIBLE_CANDIDATES'}); assert.equal(fx.readDeliveries(n.needId).length, 13);
    pass('MATCH_V1_ALL_ONE_TICK_REACHES_EVERY_ADMITTED_WORKER_IN_ONE_ROUND_EVENTS_AND_NOTIFICATIONS_VALID_24H', o.oneTick);
    o.needAll = n; }
  // ALL-2: the safety ceiling per task revision; above it nobody more is notified, the reason is recorded, raising it continues with the rest
  { const n = await poolNeed('ceiling');
    setDispatch({ceiling: 5});
    tick();
    const first = deliveredIndexes(n.needId), rounds1 = fx.readRounds(n.needId);
    const atCeiling = fx.runWave(n.needId);
    sql(`select private.enqueue_dispatch(${q(n.needId)}::uuid, statement_timestamp())`);
    tick();
    const sched = fx.readSchedule(n.needId), afterCheck = fx.readDeliveries(n.needId).length, rounds2 = fx.readRounds(n.needId).length;
    setDispatch({ceiling: 20});
    sql(`select private.enqueue_dispatch(${q(n.needId)}::uuid, statement_timestamp())`);
    tick();
    const rest = deliveredIndexes(n.needId), rounds3 = fx.readRounds(n.needId);
    resetDispatch();
    o.ceiling = {firstWave: first.length, round1: {batch: Number(rounds1[0].batch_size), limit: Number(rounds1[0].candidate_limit_used)}, atCeiling, scheduleReason: sched.lastReason, afterCheck,
      roundsAfterCheck: rounds2, afterRaise: rest.length, roundsAfterRaise: rounds3.length, round2: {batch: Number(rounds3[1].batch_size)}};
    assert.equal(first.length, 5); assert.equal(Number(rounds1[0].batch_size), 5); assert.equal(Number(rounds1[0].candidate_limit_used), 5);
    assert.equal(atCeiling.status, 'STOPPED'); assert.equal(atCeiling.reason, 'DELIVERY_CEILING_REACHED'); assert.equal(atCeiling.inserted, 0);
    assert.equal(atCeiling.ceiling, 5); assert.equal(atCeiling.deliveredBefore, 5);
    assert.equal(sched.lastStatus, 'STOPPED'); assert.equal(sched.lastReason, 'DELIVERY_CEILING_REACHED');
    assert.equal(afterCheck, 5); assert.equal(rounds2, 1, 'A_REFUSED_WAVE_WRITES_NO_ROUND');
    assert.deepEqual(rest, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]); assert.equal(rounds3.length, 2); assert.equal(Number(rounds3[1].batch_size), 15, 'THE_ROOM_LEFT_UNDER_THE_NEW_CEILING');
    assert.deepEqual(dispatchRow(), DISPATCH_DEFAULT);
    pass('MATCH_V1_ALL_CEILING_PER_REVISION_REFUSES_ABOVE_IT_RECORDS_THE_REASON_AND_CONTINUES_WHEN_RAISED', o.ceiling); }
  // ALL-3: configuration errors are named like the other dispatch settings; no row means the ladder of today
  { const n = await poolNeed('config'), refusedWith = patchOrRaw => {
      if (typeof patchOrRaw === 'string') sql(patchOrRaw); else setDispatch(patchOrRaw);
      let message = null;
      try { fx.runWave(n.needId); } catch (e) { message = String(e.message); }
      resetDispatch();
      return message; };
    const bad = {mode: refusedWith({mode: 'NOPE'}), ceilingZero: refusedWith({ceiling: 0}), ceilingTooBig: refusedWith({ceiling: 10001}), ceilingText: refusedWith({ceiling: 'abc'}),
      validZero: refusedWith({validMinutes: 0}), validTooBig: refusedWith({validMinutes: 10081}),
      notAnObject: refusedWith(`update private.marketplace_config set value='"ALL"'::jsonb where key='match_v1_dispatch'`)};
    for (const [k, v] of Object.entries(bad)) assert.ok(v && v.includes('DISPATCH_CONFIG_INVALID'), 'CONFIG_ERROR_NOT_NAMED:' + k + ':' + v);
    assert.equal(fx.readDeliveries(n.needId).length, 0, 'A_CONFIGURATION_ERROR_DELIVERS_NOTHING'); assert.deepEqual(dispatchRow(), DISPATCH_DEFAULT);
    sql(`delete from private.marketplace_config where key='match_v1_dispatch'`);
    const noRow = waveSeries(n.needId).map(w => w.added.length);
    sql(`insert into private.marketplace_config(key,value,updated_at) values('match_v1_dispatch',${q(JSON.stringify(DISPATCH_DEFAULT))}::jsonb,statement_timestamp())`);
    assert.deepEqual(noRow.slice(0, 3), [5, 5, 3], 'NO_ROW_MEANS_THE_LADDER'); assert.deepEqual(dispatchRow(), DISPATCH_DEFAULT);
    o.config = {errors: Object.fromEntries(Object.entries(bad).map(([k, v]) => [k, v.slice(-60)])), noRowWaves: noRow};
    pass('MATCH_V1_ALL_BAD_SWITCH_ROW_IS_A_NAMED_CONFIGURATION_ERROR_AND_NO_ROW_MEANS_THE_LADDER', o.config); }
  // ALL-4: the tick time budget; one heavy minute can never run into the statement timeout (the unstarted tasks are released and come first)
  { for (let i = 0; i < 8; i++) if (tick().claimed === 0) break;
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await poolNeed('budget-' + i)).needId);
    setDispatch({tickBudgetSeconds: 0.001});
    const t1 = tick();
    const sched1 = ids.map(id => fx.readSchedule(id)), delivered1 = ids.map(id => fx.readDeliveries(id).length);
    setDispatch({tickBudgetSeconds: 40});
    const t2 = tick();
    const delivered2 = ids.map(id => fx.readDeliveries(id).length);
    resetDispatch();
    o.tickBudget = {first: {claimed: t1.claimed, processed: t1.processed, deferred: t1.deferred, sent: t1.sent}, second: {claimed: t2.claimed, processed: t2.processed, deferred: t2.deferred},
      deliveredAfterFirst: delivered1, deliveredAfterSecond: delivered2};
    assert.equal(t1.claimed, 3); assert.equal(t1.processed, 1); assert.equal(t1.deferred, 2); assert.equal(t1.sent, 1);
    assert.equal(delivered1.filter(n => n > 0).length, 1, 'ONLY_ONE_TASK_STARTED');
    for (const [i, s] of sched1.entries()) if (delivered1[i] === 0) { assert.equal(s.queued, true); assert.equal(s.lockedUntil, null, 'DEFERRED_TASK_IS_RELEASED'); assert.ok(Date.parse(s.nextRunAt) <= Date.now() + 1000, 'AND_STILL_DUE'); }
    assert.equal(t2.processed, 2); assert.equal(t2.deferred, 0); assert.deepEqual(delivered2, [13, 13, 13]);
    pass('MATCH_V1_ALL_TICK_TIME_BUDGET_STARTS_NO_TASK_AFTER_IT_RELEASES_THE_REST_AND_THE_NEXT_TICK_FINISHES_THEM', o.tickBudget); }
  // ALL-5: an urgent task is valid only as long as its urgency, never the 24 hours
  { const n = await poolNeed('urgent');
    sql(`begin; set local session_replication_role=replica; update public.needs set urgent=true, urgent_activated_at=statement_timestamp(), urgent_expires_at=statement_timestamp()+interval '20 minutes' where id=${q(n.needId)}::uuid; commit;`);
    fx.runWave(n.needId);
    const valid = deliveryMinutes(n.needId), notificationValid = notificationMinutes(n.needId);
    const hitno = countOf(`select count(*) from public.user_activity_events where entity_id=${q(n.needId)}::uuid and event_type='OPPORTUNITY_AVAILABLE' and urgency='HITNO'`);
    o.urgent = {deliveries: valid.n, valid, notificationValid, hitnoEvents: hitno};
    assert.equal(valid.n, 13); assert.ok(valid.min >= 18 && valid.max <= 21, 'URGENT_VALID_UNTIL_THE_END_OF_THE_URGENCY:' + JSON.stringify(valid));
    assert.ok(notificationValid.max <= 21); assert.equal(hitno, 13);
    pass('MATCH_V1_ALL_URGENT_TASK_DELIVERIES_AND_NOTIFICATIONS_END_WITH_THE_URGENCY', o.urgent); }
  report.observations.allMode = o; write();
  return o;
}

/** A worker who becomes eligible after the wave (a profile moved into the area) is reached by the next wave of the same task, even when three applications already exist. */
async function lateArrival(needAll) {
  for (const w of pool.workers.slice(0, 3)) { const a = await fx.submitApplication(w, needAll); assert.ok(a.ok, 'APPLICATION_REFUSED:' + JSON.stringify(a.error)); }
  await fx.setLocation(pool.late, {city: 'Novi Sad'}); pool.lateMoved = true;
  const t = tick();
  const d = deliveredIndexes(needAll.needId), rounds = fx.readRounds(needAll.needId), sched = fx.readSchedule(needAll.needId);
  // rounds: the first wave (13), the check that found nobody new (STOPPED), and the wave for the late worker (SENT, the room left under the ceiling of 500)
  const r = {deliveries: d.length, lateDelivered: d.includes(99), rounds: rounds.map(x => ({status: x.status, batch: Number(x.batch_size)})), scheduleStatus: sched.lastStatus, tickFailed: t.failed};
  assert.equal(d.length, 14); assert.ok(d.includes(99), 'THE_LATE_WORKER_MUST_BE_REACHED'); assert.equal(rounds.length, 3);
  assert.equal(rounds[1].status, 'STOPPED'); assert.equal(rounds[2].status, 'SENT'); assert.equal(Number(rounds[2].batch_size), 487, 'THE_ROOM_LEFT_UNDER_THE_CEILING');
  assert.equal(sched.lastStatus, 'SENT');
  report.observations.lateArrival = r; write();
  pass('MATCH_V1_ALL_LATE_WORKER_IS_REACHED_BY_THE_NEXT_WAVE_EVEN_AFTER_THREE_APPLICATIONS_NO_STOP_AFTER_N_RESPONSES', r);
}

/** The ladder, switched on by the documented one-row update, is today's ladder: the same workers in the same groups, the throttle after three responses, the 15-minute window. */
async function ladderModeCases(baseline) {
  const o = {};
  { const n = await poolNeed('ladder'), series = waveSeries(n.needId);
    o.series = series.map(w => ({inserted: w.inserted, added: w.added, status: w.status, reason: w.reason}));
    assert.deepEqual(series.map(w => w.added.length), [5, 5, 3, 0]);
    assert.deepEqual(series.map(w => w.added), baseline.series.map(w => w.added), 'THE_LADDER_PICKS_OTHER_WORKERS_THAN_TODAYS_LADDER');
    assert.deepEqual(series.slice(0, 3).map(w => w.status), ['SENT', 'SENT', 'SENT']);
    const valid = deliveryMinutes(n.needId); o.validity = valid; assert.ok(valid.max <= 16 && valid.min >= 14, 'LADDER_DELIVERIES_LAST_ONE_WINDOW:' + JSON.stringify(valid));
    pass('MATCH_V1_LADDER_ON_SAME_GROUPS_5_5_REST_SAME_WORKERS_AS_TODAYS_LADDER_15_MINUTE_VALIDITY', o); }
  { const n = await poolNeed('ladder-stop'), w1 = fx.runWave(n.needId), w2 = fx.runWave(n.needId);
    const notified = new Set(fx.readDeliveries(n.needId).map(d => d.worker_profile_id));
    for (const w of pool.workers.filter(w => notified.has(w.profileId)).slice(0, 3)) { const a = await fx.submitApplication(w, n); assert.ok(a.ok, 'APPLICATION_REFUSED:' + JSON.stringify(a.error)); }
    const w3 = fx.runWave(n.needId);
    o.stopAfterThree = {w1: w1.inserted, w2: w2.inserted, w3: {status: w3.status, reason: w3.reason, inserted: w3.inserted}, deliveries: fx.readDeliveries(n.needId).length};
    assert.equal(w1.inserted, 5); assert.equal(w2.inserted, 5); assert.equal(w3.status, 'STOPPED'); assert.equal(w3.reason, 'RESPONSE_TARGET_AND_COVERAGE_REACHED'); assert.equal(w3.inserted, 0);
    assert.equal(o.stopAfterThree.deliveries, 10);
    pass('MATCH_V1_LADDER_ON_STOPS_AFTER_THREE_RESPONSES_AS_TODAY', o.stopAfterThree); }
  { const n = await poolNeed('ladder-tick'); tick();
    const d = deliveredIndexes(n.needId), rounds = fx.readRounds(n.needId);
    o.oneTick = {delivered: d.length, rounds: rounds.length, batch: Number(rounds[0].batch_size)};
    assert.equal(d.length, 5); assert.equal(rounds.length, 1); assert.equal(Number(rounds[0].batch_size), 5);
    pass('MATCH_V1_LADDER_ON_ONE_TICK_REACHES_THE_FIRST_GROUP_OF_FIVE_ONLY', o.oneTick); }
  report.observations.ladderMode = o; write();
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
  // Today's dispatch on thirteen matching workers: the ladder. FAIL before: one tick reaches five of them, the rest wait for later waves.
  await poolSetup();
  const ladderToday = await ladderBaseline('before');
  report.observations.ladderToday = {series: ladderToday.series.map(w => ({inserted: w.inserted, added: w.added, status: w.status, reason: w.reason})), oneTick: ladderToday.afterTick};
  pass('MATCH_V1_BEFORE_THE_LADDER_OF_TODAY_5_5_REST_AND_ONE_TICK_REACHES_FIVE_OF_THIRTEEN_WORKERS', report.observations.ladderToday);

  // ---------------------------------------------------------------- refusals leave nothing behind
  const candidate = fs.readFileSync(M + 'candidate.sql', 'utf8');
  // a stray switch row is a partial application: named, atomic
  sql(`insert into private.marketplace_config(key,value,updated_at) values('match_v1_dispatch','{"mode":"LADDER"}'::jsonb,statement_timestamp())`);
  refused(candidate, 'MATCH_V1_ALREADY_OR_PARTIALLY_APPLIED');
  sql(`delete from private.marketplace_config where key='match_v1_dispatch'`);
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
  // ZONE-PERF first, as planned (its own proof: supabase/proofs/zone-perf): the shared zone helper stops scanning the zone catalog. MATCH-V1 accepts the helper in either state.
  psqlFile(Z + 'candidate.sql');
  assert.equal(bodyMd5(TZ), zManifest.functions[0].after_md5); assert.deepEqual(closure(), baseClosure);
  pass('MATCH_V1_ZONE_PERF_APPLIED_FIRST_AS_PLANNED_CERTIFICATE_UNCHANGED', {helperMd5: zManifest.functions[0].after_md5});
  psqlFile(M + 'candidate.sql');
  for (const f of mManifest.functions) assert.equal(bodyMd5(f.signature), f.after_md5, 'POSTIMAGE:' + f.signature);
  for (const f of mManifest.newFunctions) assert.equal(bodyMd5(f.signature), f.body_md5, 'NEW:' + f.signature);
  for (const f of mManifest.unchangedDependencies) assert.ok([f.body_md5, f.alsoAcceptedAfterZonePerf].filter(Boolean).includes(bodyMd5(f.signature)), 'DEPENDENCY:' + f.signature);
  assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001); assert.equal(watermarkRows(), 1);
  assert.deepEqual(dispatchRow(), DISPATCH_DEFAULT); assert.equal(dispatchRows(), 1);
  pass('MATCH_V1_APPLIED_EXACT_BODIES_CERTIFICATE_UNCHANGED_NO_NEW_40001_DISPATCH_SWITCH_ROW_IS_THE_DEFAULT', {certificate: baseClosure.certificate, dispatch: dispatchRow()});
  refused(candidate, 'MATCH_V1_ALREADY_OR_PARTIALLY_APPLIED');
  assert.equal(bodyMd5(TZ), zManifest.functions[0].after_md5, 'MATCH_V1_TOUCHED_THE_ZONE_HELPER');
  await fx.reloadSchema();
  // ---- mode ALL, the default of the owner policy 2026-10-07: one wave to every admitted worker
  expectNew(await matchingCases('after'), 'ALL');
  const allMode = await allModeCases();
  // ---- the ladder, switched on by ONE row with the documented SQL (no code change), then off again
  refused(fs.readFileSync(M + 'switch-ladder-off.sql', 'utf8'), 'MATCH_V1_SWITCH_EXPECTS_MODE_LADDER');
  psqlFile(M + 'switch-ladder-on.sql');
  assert.equal(dispatchRow().mode, 'LADDER'); assert.equal(dispatchRow().ceiling, 500);
  refused(fs.readFileSync(M + 'switch-ladder-on.sql', 'utf8'), 'MATCH_V1_SWITCH_EXPECTS_MODE_ALL');
  expectNew(await matchingCases('after-ladder'), 'LADDER');
  await ladderModeCases(ladderToday);
  psqlFile(M + 'switch-ladder-off.sql');
  assert.deepEqual(dispatchRow(), DISPATCH_DEFAULT);
  pass('MATCH_V1_LADDER_SWITCH_ON_AND_OFF_BY_ONE_ROW_THE_SWITCH_SCRIPTS_GUARD_THEIR_STARTING_MODE', {on: 'switch-ladder-on.sql', off: 'switch-ladder-off.sql'});
  await lateArrival(allMode.needAll);
  // The first-refusal evaluation (prefilter, "Za mene") and the full one (detailed matcher) must agree on every pair on this chain.
  const consistency = rows(`select count(*)::integer as pairs, count(*) filter (where (private.worker_need_fit_v1(n.id,p.id,true)->>'matches')
      is distinct from (private.worker_need_fit_v1(n.id,p.id,false)->>'matches'))::integer as mismatches,
    count(*) filter (where (private.worker_need_fit_v1(n.id,p.id,true)->>'matches')::boolean)::integer as matching
    from public.needs n cross join public.app_profiles p where p.kind='WORKER' and n.status in ('PUBLISHED','SELECTION')`)[0];
  assert.ok(consistency.pairs > 100 && consistency.matching > 0 && consistency.mismatches === 0, 'FIT_MODES_DISAGREE:' + JSON.stringify(consistency));
  pass('MATCH_V1_FIRST_REFUSAL_AND_FULL_EVALUATION_AGREE_ON_EVERY_PAIR', consistency);
  // The re-queue cursor: 250 profiles that share ONE updated_at (a bulk UPDATE) are handled 100 per tick, none skipped, none repeated.
  const cursorRun = JSON.parse(timedSql(`begin;
    set local session_replication_role=replica;
    create temporary table mv1_cursor on commit drop as select gen_random_uuid() as account_id, gen_random_uuid() as profile_id, g as i from generate_series(1,250) g;
    insert into public.app_accounts(id,email) select account_id,'mv1-cursor-'||i||'@proof.invalid' from mv1_cursor;
    insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,radius_km,available_now,updated_at)
     select profile_id,account_id,'WORKER','MV1 cursor '||i,'Novi Sad','ACTIVE',array['mv1-cursor'],15,false,statement_timestamp()-interval '5 minutes' from mv1_cursor;
    set local session_replication_role=origin;
    do $t$
    declare r jsonb; seq jsonb:='[]'::jsonb; others bigint; after_at timestamptz:=statement_timestamp()-interval '10 minutes';
    begin
      select count(*) into others from public.app_profiles p where p.kind='WORKER' and p.profile_status='ACTIVE' and p.display_name not like 'MV1 cursor %'
        and p.updated_at>after_at and p.updated_at<=statement_timestamp()-interval '30 seconds';
      update private.marketplace_config set value=jsonb_build_object('after',after_at,'afterAccount','00000000-0000-0000-0000-000000000000') where key='match_v1_profile_requeue';
      for i in 1..5 loop
        r:=private.requeue_changed_worker_profiles_v1(statement_timestamp());
        seq:=seq||jsonb_build_array(r->'profiles');
      end loop;
      perform set_config('mv1.cursor', jsonb_build_object('others',others,'seq',seq,
        'afterAccount',(select value->>'afterAccount' from private.marketplace_config where key='match_v1_profile_requeue'))::text, false);
    end $t$;
    select current_setting('mv1.cursor');
    rollback;`).output.split('\n').filter(Boolean).at(-1));
  const cursorTotal = 250 + Number(cursorRun.others);
  assert.deepEqual(cursorRun.seq, [Math.min(100, cursorTotal), Math.min(100, Math.max(0, cursorTotal - 100)), Math.max(0, Math.min(100, cursorTotal - 200)), Math.max(0, cursorTotal - 300), 0], 'REQUEUE_CURSOR_SEQUENCE');
  assert.equal(cursorRun.afterAccount, '00000000-0000-0000-0000-000000000000');
  assert.equal(watermarkRows(), 1);
  pass('MATCH_V1_REQUEUE_CURSOR_100_PER_TICK_TIES_NEITHER_SKIPPED_NOR_REPEATED', cursorRun);
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
  assert.equal(bodyMd5(TZ), zManifest.functions[0].after_md5, 'MATCH_V1_REVERT_TOUCHED_THE_ZONE_HELPER');
  psqlFile(Z + 'revert.sql');
  assert.equal(catalog(), baseCatalog); assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001); assert.equal(watermarkRows(), 0);
  assert.equal(dispatchRows(), 0, 'THE_REVERT_REMOVES_THE_SWITCH_ROW');
  pass('ZONE_PERF_MATCH_V1_AND_DISCOVERY_ZAMENE_EXACT_REVERT_CATALOG_AND_CERTIFICATE_RESTORED');
  await fx.reloadSchema();
  expectOld(await matchingCases('reverted'), 'REVERTED');
  // the revert restores today's ladder: the same groups of the same thirteen (now fourteen) workers
  const ladderReverted = await ladderBaseline('reverted');
  report.observations.ladderReverted = {series: ladderReverted.series.map(w => ({inserted: w.inserted, added: w.added, status: w.status, reason: w.reason})), oneTick: ladderReverted.afterTick};
  pass('MATCH_V1_REVERTED_RESTORES_TODAYS_LADDER_5_5_REST_AND_ONE_TICK_REACHES_FIVE', report.observations.ladderReverted);

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
