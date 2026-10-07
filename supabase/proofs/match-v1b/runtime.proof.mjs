// MATCH-V1B disposable runtime proof: real Auth, real PostgREST, real database; loopback only; never DEV.
// The stack is applied in the planned order on the historical chain: ZONE-PERF, MATCH-V1 (+ the documented ceiling update), MATCH-V1B, DISCOVERY-ZAMENE;
// then reverted in the opposite order (catalog and certificate restored exactly).
//   FAIL before : with MATCH-V1 alone a task without a place goes to every matching worker at once.
//   PASS after  : waves (first 5, later 7 in the proof; 300 / 1,000 by default), pace, stop at N applications, ceiling, rotation, revision, back-off,
//                 daily cap (place-based and remote, urgent exempt), switch off = MATCH-V1, ladder untouched, named configuration errors, exact revert.
// Tasks are direct-insert fixtures (labelled); applications, selection, cancellation and the profile edit of the late worker go through the product.
import fs from 'node:fs';
import * as C from './common.mjs';
import {createFixtures} from '../ex06/lib/fixtures.mjs';

const {assert, sql, rows, q, randomUUID, ok, rt, run, applyFile, refused, bodyMd5, catalog, closure, conflicts40001, aclOf, row, setKnobs, dropKnobs, setCeiling, requeueWatermark, sleep} = C;
const {NIL, KEY, WAVE, TZ, Z, M, D, B, zManifest, mManifest, dManifest, bManifest} = C;
const {report, write, pass, fail} = C.makeReport('MATCH-V1B', 'v1b-report.json');
const fx = createFixtures(rt, {needPath: 'direct'});
const tag = randomUUID().slice(0, 8);
let R;   // the requester of every task

// ---------------------------------------------------------------- helpers
const count = text => Number(sql(text));
const idList = ids => 'array[' + ids.map(id => q(id) + '::uuid').join(',') + ']::uuid[]';
const sorted = ids => [...ids].sort();
const shape = result => Object.keys(result).sort();
const uuidsOf = needId => (needId ? needId : '');
const tick = (batch = 200) => {
  const result = run(`select private.dispatch_tick(${Number(batch)}, statement_timestamp())`, {timeoutS: 170});
  assert.ok(result.ok, 'TICK_FAILED:' + result.error);
  return JSON.parse(C.lastLine(result.output));
};
const deliveriesOf = needId => count(`select count(*) from public.opportunity_deliveries where need_id=${q(needId)}::uuid`);
const distinctAccountsOf = needId => count(`select count(distinct worker_account_id) from public.opportunity_deliveries where need_id=${q(needId)}::uuid`);
const eventsOf = (needId, urgency = null) => count(`select count(*) from public.user_activity_events where entity_id=${q(needId)}::uuid and event_type='OPPORTUNITY_AVAILABLE'${urgency ? ` and urgency=${q(urgency)}` : ''}`);
const notificationsOf = needId => count(`select count(*) from public.notification_deliveries d join public.user_activity_events e on e.id=d.event_id
  where e.entity_id=${q(needId)}::uuid and e.event_type='OPPORTUNITY_AVAILABLE'`);
/** Every round of a task with the workers it notified (sorted) and its window in minutes. */
const byRound = needId => rows(`select r.round_no, r.need_revision, r.status, r.stop_reason, r.batch_size, r.candidate_limit_used, r.budget_source, r.urgency,
    round(extract(epoch from (r.deadline_at - r.created_at)) / 60)::integer as window_minutes,
    coalesce((select array_agg(d.worker_profile_id order by d.worker_profile_id) from public.opportunity_deliveries d where d.dispatch_round_id = r.id), '{}'::uuid[]) as profiles
  from public.dispatch_rounds r where r.need_id = ${q(needId)}::uuid order by r.need_revision, r.round_no`);
/** The rotation of a task without a place over the given profiles: from the id of the task upwards, then the ones below it. */
const rotation = (needId, ids) => rows(`select id from public.app_profiles where id = any(${idList(ids)})
  order by case when id >= ${q(needId)}::uuid then 0 else 1 end, id`).map(r => r.id);
const profilesOfNeed = needId => rows(`select worker_profile_id from public.opportunity_deliveries where need_id=${q(needId)}::uuid`).map(r => r.worker_profile_id);
/** Time travel on the disposable database: the rounds of a task are N minutes older, and the task is due. */
const age = (needId, minutes) => sql(`update public.dispatch_rounds set created_at = created_at - interval '${Number(minutes)} minutes', deadline_at = deadline_at - interval '${Number(minutes)} minutes' where need_id = ${q(needId)}::uuid;
  update private.dispatch_schedule set next_run_at = statement_timestamp() - interval '1 second', locked_until = null where need_id = ${q(needId)}::uuid;`);
const isolate = ids => sql(`delete from private.dispatch_schedule where need_id <> all(${idList(ids)})`);
const closeNeeds = ids => ids.length && sql(`begin; set local session_replication_role=replica;
  update public.needs set status='CANCELLED' where id = any(${idList(ids)});
  delete from private.dispatch_schedule where need_id = any(${idList(ids)}); commit;`);
const minutesFromNow = iso => (Date.parse(iso) - Date.now()) / 60000;
const tracked = [];

async function task(title, skill, {remote = true, extra = {}} = {}) {
  const facts = {'need.title': title, 'need.description': 'Sinteticki zadatak MATCH-V1B dokaza na jednokratnoj bazi.', 'need.category': 'MATCH-V1B dokaz',
    'need.required_skills': [skill], 'need.required_tools': [], 'need.required_vehicles': [], 'need.minimum_experience_years': 0, 'need.people_needed': 1,
    'need.schedule_kind': remote ? 'REMOTE_ANYTIME' : 'FLEXIBLE', 'need.task_geography': remote ? {mode: 'REMOTE'} : {mode: 'STATIONARY', start: {city: 'Novi Sad'}},
    'need.price_mode': 'OFFERS', 'need.task_country_code': 'RS', ...extra};
  const made = await fx.createNeedFromFacts(R, facts, {path: 'direct'});
  tracked.push(made.needId);
  return made;
}
const remoteTask = (title, skill) => task(title, skill, {remote: true});
const placeTask = (title, skill) => task(title, skill, {remote: false});

/** A need row written by SQL (triggers off): the physical modes WITHOUT coordinates cannot be made by the fixtures. */
function insertNeed({title, skill, mode, lat = null, lng = null, schedule = 'REMOTE_ANYTIME'}) {
  const id = randomUUID();
  const result = run(`begin; set local session_replication_role=replica;
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,required_tools,required_vehicles,required_licenses,
      minimum_experience_years,verified_identity_required,approximate_city,approximate_area,approximate_lat,approximate_lng,mode,required_slots,schedule_kind,starts_at,ends_at,
      execution_location_mode,task_country_code,task_timezone,response_deadline,published_at)
    values (${q(id)}::uuid,${q(R.id)}::uuid,${q(R.profileId)}::uuid,'PUBLISHED',${q(title)},'Sinteticki zadatak MATCH-V1B dokaza.','MATCH-V1B dokaz',array[${q(skill)}],'{}','{}','{}',
      0,false,${mode === 'REMOTE' ? "''" : "'Novi Sad'"},'',${lat === null ? 'null' : lat},${lng === null ? 'null' : lng},'OFFERS',1,${q(schedule)},null,null,
      ${q(mode)},'RS','Europe/Belgrade',statement_timestamp()+interval '2 days',statement_timestamp());
    commit;`);
  assert.ok(result.ok, 'NEED_INSERT_FAILED:' + result.error);
  tracked.push(id);
  return id;
}

/** Synthetic workers (triggers off, labelled): only the rows the matcher reads. coords: worker i sits 0.01 degrees (about 1.1 km) farther from the centre of Novi Sad than worker i-1. */
function seedPool({label, count: n, skill, coords = false}) {
  const result = run(`begin; set local session_replication_role=replica;
    create temporary table mv1b_w on commit drop as select gen_random_uuid() as account_id, gen_random_uuid() as profile_id, g as i from generate_series(1,${n}) g;
    insert into auth.users(id,aud,role,email) select account_id,'authenticated','authenticated',${q(label)}||'-'||i||'@proof.invalid' from mv1b_w;
    insert into public.app_accounts(id,email) select account_id,${q(label)}||'-'||i||'@proof.invalid' from mv1b_w;
    insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,radius_km,available_now)
      select profile_id,account_id,'WORKER',${q(label)}||' '||i,'Novi Sad','ACTIVE',array[${q(skill)}],15,true from mv1b_w;
    ${coords ? `insert into public.worker_match_preferences(worker_profile_id,worker_account_id,approximate_lat,approximate_lng)
      select profile_id,account_id,round((45.27+i*0.01)::numeric,2),19.83 from mv1b_w;` : ''}
    commit;`, {timeoutS: 120});
  assert.ok(result.ok, 'SEED_FAILED:' + result.error);
  return rows(`select p.id as profile_id, p.account_id, (split_part(p.display_name,' ',2))::integer as i from public.app_profiles p
    where p.kind='WORKER' and p.display_name like ${q(label + ' %')} order by (split_part(p.display_name,' ',2))::integer`);
}
/** Existing events of a worker (triggers off): what the daily cap counts. hoursAgo: how old; type / urgency: which kind. */
const seedEvents = (accountId, {count: n, type = 'OPPORTUNITY_AVAILABLE', urgency = 'NORMAL', hoursAgo = 1}) => sql(`begin; set local session_replication_role=replica;
  insert into public.user_activity_events(recipient_user_id,recipient_role,event_type,entity_type,entity_id,entity_version,urgency,payload,dedupe_key,created_at)
  select ${q(accountId)}::uuid,'WORKER',${q(type)},'NEED',gen_random_uuid(),1,${q(urgency)},'{}'::jsonb,'mv1b-seed:'||gen_random_uuid()::text,
    statement_timestamp()-make_interval(hours => ${Number(hoursAgo)})-(g||' seconds')::interval from generate_series(1,${Number(n)}) g; commit;`);
/** Gives the worker room again: all his normal events become older than 24 hours. */
const freeWorker = accountId => sql(`update public.user_activity_events set created_at = created_at - interval '30 hours'
  where recipient_user_id=${q(accountId)}::uuid and event_type='OPPORTUNITY_AVAILABLE' and urgency='NORMAL'`);
const hasRoom = (accountId, cap) => sql(`select private.worker_notify_room_v1b(${q(accountId)}::uuid, ${cap === null ? 'null' : Number(cap)})`) === 't';

// The knobs every scenario starts from (the proof sizes: first wave 5, later waves 7; the real defaults are 300 and 1,000, measured by the load proof).
const TEST = {remoteWaves: true, remoteWaveSize: 5, remoteNextWaveSize: 7, remoteWaveMinutes: 30, remoteStopAfterResponses: 5, remoteCeiling: 10000, workerDailyCap: 1000};
const KNOWN = ['remoteWaves', 'remoteWaveSize', 'remoteNextWaveSize', 'remoteWaveMinutes', 'remoteStopAfterResponses', 'remoteCeiling', 'workerDailyCap'];
const normalise = () => {
  sql(`update private.marketplace_config set updated_at = statement_timestamp(), value = (
      select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb) from jsonb_each(value) as e(k, v)
       where not ((e.k like 'remote%' or e.k like 'worker%') and e.k not in (${KNOWN.map(q).join(',')}))) || ${q(JSON.stringify({...TEST, mode: 'ALL', ceiling: 10000}))}::jsonb
    where key=${q(KEY)}`);
  requeueWatermark(`statement_timestamp() + interval '2 hours'`);
};
async function scenario(name, fn) {
  try {
    normalise();
    await fn();
  } catch (error) {
    fail(name, String(error?.stack ?? error).slice(0, 1800));
  } finally {
    try { closeNeeds(tracked.splice(0)); } catch (error) { fail(name + '_CLEANUP', String(error).slice(0, 300)); }
  }
}
const waveError = needId => { try { fx.runWave(needId); return null; } catch (error) { return String(error.message); } };

// ---------------------------------------------------------------- main
let baseCatalog = null;
try {
  fx.pauseSchedulers();
  baseCatalog = catalog();
  const baseClosure = closure(), base40001 = conflicts40001();
  assert.equal(baseClosure.ready, true);
  assert.equal(bodyMd5(TZ), zManifest.functions[0].before_md5, 'PREDECESSOR:' + TZ);
  for (const f of mManifest.functions) assert.equal(bodyMd5(f.signature), f.before_md5, 'PREDECESSOR:' + f.signature);
  report.observations.chain = fx.chainCounts();
  pass('MATCH_V1B_CHAIN_PREDECESSORS_ARE_THE_DEV_BODIES_AND_CERTIFICATE_READY');

  // the planned order: ZONE-PERF (done on DEV), MATCH-V1, and the documented one-row update the coordinator sets right after it
  applyFile(Z + 'candidate.sql');
  const catAfterZone = catalog();
  applyFile(M + 'candidate.sql');
  const catAfterMv1 = catalog();
  setCeiling(10000);
  const mv1Row = row();
  assert.deepEqual(mv1Row, {mode: 'ALL', ceiling: 10000, validMinutes: 1440, tickBudgetSeconds: 40, owner: 'MATCH-V1 2026-10-07'});
  requeueWatermark(`statement_timestamp() + interval '2 hours'`);
  await fx.reloadSchema();
  pass('MATCH_V1B_ZONE_PERF_AND_MATCH_V1_APPLIED_IN_THE_PLANNED_ORDER_CEILING_10000_BY_THE_DOCUMENTED_UPDATE', mv1Row);

  R = await fx.createRequester({label: 'mv1b-requester'});
  fx.parkForeign({schedule: true});
  const skillP = 'mv1b-p-' + tag, skillQ = 'mv1b-q-' + tag;
  const real = [];
  for (let i = 0; i < 6; i++) {
    real.push(await fx.createWorker({label: `mv1b-w${i}`, skills: [skillP], radiusKm: 15, location: {city: 'Novi Sad'},
      availability: {timezone: 'Europe/Belgrade', availableNow: true, rules: [], windows: []}}));
  }
  const synth = seedPool({label: 'mv1b-p-' + tag, count: 24, skill: skillP});
  const poolIds = [...real.map(w => w.profileId), ...synth.map(s => s.profile_id)];
  const placePool = seedPool({label: 'mv1b-q-' + tag, count: 8, skill: skillQ, coords: true});
  const rankOf = new Map(placePool.map(p => [p.profile_id, p.i]));
  assert.equal(poolIds.length, 30);
  requeueWatermark(`statement_timestamp() + interval '2 hours'`);

  // ---------------------------------------------------------------- BEFORE: MATCH-V1 alone (the thing the owner does not want for a task without a place)
  const tb1 = await remoteTask('MV1B osnovni zadatak', skillP);
  const b1 = fx.runWave(tb1.needId);
  assert.equal(b1.status, 'SENT'); assert.equal(b1.inserted, 30); assert.equal(b1.batchSize, 10000); assert.equal(b1.candidateLimit, 10000);
  assert.equal(b1.mode, 'ALL'); assert.equal(b1.ceiling, 10000); assert.equal(b1.deliveredBefore, 0);
  assert.equal(byRound(tb1.needId).length, 1);
  const b1Shape = shape(b1);
  pass('MATCH_V1B_BEFORE_A_TASK_WITHOUT_A_PLACE_GOES_TO_ALL_30_MATCHING_WORKERS_IN_ONE_WAVE', {inserted: b1.inserted, events: eventsOf(tb1.needId), notificationRows: notificationsOf(tb1.needId)});
  const tp1 = await placeTask('MV1B mesto osnovni', skillQ);
  const b2 = fx.runWave(tp1.needId);
  assert.equal(b2.inserted, 8); assert.equal(b2.batchSize, 10000); assert.equal(b2.mode, 'ALL');
  const b2Shape = shape(b2);
  applyFile(M + 'switch-ladder-on.sql');
  const tl1 = await remoteTask('MV1B lestvica osnovni', skillP);
  const ladderBefore = [], ladderShapeBefore = [];
  for (let i = 0; i < 6; i++) {
    const r = fx.runWave(tl1.needId);
    if (r.status !== 'SENT') break;
    ladderBefore.push(r.inserted); ladderShapeBefore.push(shape(r));
  }
  applyFile(M + 'switch-ladder-off.sql');
  assert.deepEqual(ladderBefore.slice(0, 2), [5, 5], 'THE_LADDER_STARTS_WITH_5_5');
  assert.ok(ladderBefore.length >= 3 && ladderBefore.reduce((a, b) => a + b, 0) <= 30, 'THE_LADDER_REACHES_THE_POOL_IN_GROUPS');
  pass('MATCH_V1B_BEFORE_PLACE_TASK_AND_THE_LADDER_RECORDED_AS_THE_BASELINE', {placeInserted: b2.inserted, ladder: ladderBefore});
  closeNeeds(tracked.splice(0));

  // ---------------------------------------------------------------- refusals leave nothing behind, then APPLY
  const candidate = fs.readFileSync(B + 'candidate.sql', 'utf8');
  const catBefore = catalog(), rowBefore = row();
  refused(candidate.replaceAll(bManifest.functions[0].before_md5, '0'.repeat(32)), 'MATCH_V1B_PREDECESSOR_DRIFT');
  refused(candidate.replaceAll(bManifest.pinnedDependencies[0].body_md5, '0'.repeat(32)), 'MATCH_V1B_DEPENDENCY_DRIFT');
  sql(`update private.marketplace_config set value = value || '{"remoteWavesX": 1}'::jsonb where key=${q(KEY)}`);
  refused(candidate, 'MATCH_V1B_ALREADY_OR_PARTIALLY_APPLIED');
  dropKnobs('remoteWavesX');
  refused(fs.readFileSync(B + 'revert.sql', 'utf8'), 'MATCH_V1B_REVERT_NEW_FUNCTION_DRIFT');
  refused(fs.readFileSync(B + 'switch-remote-waves-off.sql', 'utf8'), 'MATCH_V1B_SWITCH_EXPECTS_REMOTE_WAVES_ON');
  assert.equal(catalog(), catBefore); assert.deepEqual(row(), rowBefore); assert.deepEqual(closure(), baseClosure);
  pass('MATCH_V1B_DRIFT_REPEAT_AND_REVERT_BEFORE_APPLY_REFUSALS_ARE_ATOMIC');

  applyFile(B + 'candidate.sql');
  assert.equal(bodyMd5(WAVE), bManifest.functions[0].after_md5, 'POSTIMAGE');
  for (const f of bManifest.newFunctions) {
    assert.equal(bodyMd5(f.signature), f.body_md5, 'NEW:' + f.signature);
    assert.equal(aclOf(f.signature), '{postgres=X/postgres}', 'ACL:' + f.signature);
  }
  for (const pin of bManifest.pinnedDependencies) assert.equal(bodyMd5(pin.signature), pin.body_md5, 'DEPENDENCY:' + pin.signature);
  const rowAfter = row();
  assert.deepEqual(rowAfter, {...rowBefore, remoteWaves: true, remoteWaveSize: 300, remoteNextWaveSize: 1000, remoteWaveMinutes: 30, remoteStopAfterResponses: 5, remoteCeiling: 10000, workerDailyCap: 1000});
  assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001);
  refused(candidate, 'MATCH_V1B_ALREADY_OR_PARTIALLY_APPLIED');
  refused(fs.readFileSync(M + 'revert.sql', 'utf8'), 'MATCH_V1_REVERT_PREIMAGE_DRIFT');
  const catAfterV1b = catalog();
  await fx.reloadSchema();
  pass('MATCH_V1B_APPLIED_EXACT_BODIES_ACL_DEFAULT_KNOBS_MERGED_INTO_THE_ROW_CERTIFICATE_UNCHANGED_NO_NEW_40001', {row: rowAfter, certificate: baseClosure.certificate});

  // ---------------------------------------------------------------- scenarios
  await scenario('MATCH_V1B_ROTATION_AND_TWIN_EQUIVALENCE', async () => {
    const t = await remoteTask('MV1B rotacija', skillP);
    const seq = ids => ids.map(r => r.worker_profile_id ?? r.pid);
    const mv1 = seq(rows(`select worker_profile_id from private.candidate_profile_ids(${q(t.needId)}::uuid, 100) with ordinality as x(worker_profile_id, n) order by n`));
    const twinNull = seq(rows(`select worker_profile_id from private.candidate_profile_ids_v1b(${q(t.needId)}::uuid, 100, null) with ordinality as x(worker_profile_id, n) order by n`));
    const twinCap = seq(rows(`select worker_profile_id from private.candidate_profile_ids_v1b(${q(t.needId)}::uuid, 100, 1000) with ordinality as x(worker_profile_id, n) order by n`));
    const walk = seq(rows(`select pid from private.remote_wave_candidates_v1b(${q(t.needId)}::uuid, 100, null) with ordinality as x(pid, uid, detail, n) order by n`));
    assert.equal(mv1.length, 30);
    assert.deepEqual(mv1, rotation(t.needId, poolIds), 'MATCH_V1_ROTATION_IS_THE_FORMULA');
    assert.deepEqual(twinNull, mv1); assert.deepEqual(twinCap, mv1); assert.deepEqual(walk, mv1);
    const p = await placeTask('MV1B mesto rotacija', skillQ);
    const placeMv1 = seq(rows(`select worker_profile_id from private.candidate_profile_ids(${q(p.needId)}::uuid, 100) with ordinality as x(worker_profile_id, n) order by n`));
    const placeTwin = seq(rows(`select worker_profile_id from private.candidate_profile_ids_v1b(${q(p.needId)}::uuid, 100, 1000) with ordinality as x(worker_profile_id, n) order by n`));
    assert.equal(placeMv1.length, 8); assert.deepEqual(placeTwin, placeMv1); assert.deepEqual(placeMv1.map(id => rankOf.get(id)), [1, 2, 3, 4, 5, 6, 7, 8], 'nearest first');
    pass('MATCH_V1B_THE_WALK_AND_THE_CAP_AWARE_TWIN_RETURN_EXACTLY_THE_ROTATION_OF_MATCH_V1', {remote: mv1.length, place: placeMv1.length});
  });

  await scenario('MATCH_V1B_LATE_WORKER_PROFILE_CHANGE_BETWEEN_WAVES', async () => {
    setKnobs({remoteWaveSize: 3, remoteNextWaveSize: 3});
    const skillL = 'mv1b-l-' + tag, otherL = 'mv1b-lo-' + tag;
    const lp = seedPool({label: 'mv1b-l-' + tag, count: 6, skill: skillL});
    const late = await fx.createWorker({label: 'mv1b-late', skills: [otherL], radiusKm: 15, location: {city: 'Novi Sad'}, availability: {timezone: 'Europe/Belgrade', availableNow: true, rules: [], windows: []}});
    const t = await remoteTask('MV1B kasni radnik', skillL);
    isolate([t.needId]);
    const first = tick();
    assert.equal(first.sent, 1); assert.equal(deliveriesOf(t.needId), 3);
    requeueWatermark(`statement_timestamp() - interval '1 minute'`);
    let edited;
    for (let attempt = 0; attempt < 4 && !edited; attempt++) {
      edited = await late.client.from('app_profiles').update({skills: [otherL, skillL]}).eq('id', late.profileId).eq('account_id', late.id).eq('kind', 'WORKER').select('id').single();
      if (edited.error && /fetch failed/i.test(String(edited.error.message))) { edited = null; await sleep(2500); }
    }
    assert.ok(edited && !edited.error, 'LATE_WORKER_PROFILE_EDIT_FAILED');
    await sleep(32000);
    const second = tick();
    assert.ok(second.profileRequeue?.status === 'DONE' && second.profileRequeue.profiles >= 1 && second.profileRequeue.queued >= 1, 'REQUEUE:' + JSON.stringify(second.profileRequeue));
    assert.equal(deliveriesOf(t.needId), 3, 'A_CHANGED_PROFILE_MUST_NOT_PULL_THE_NEXT_WAVE_FORWARD');
    const s = fx.readSchedule(t.needId);
    const due = minutesFromNow(s.nextRunAt);
    assert.ok(due > 24 && due < 31 && s.lastStatus === 'SENT' && s.attempts === 0, 'SCHEDULE:' + JSON.stringify(s));
    requeueWatermark(`statement_timestamp() + interval '2 hours'`);
    const sizes = [];
    for (let i = 0; i < 6; i++) {
      age(t.needId, 31);
      const r = fx.runWave(t.needId);
      if (r.status !== 'SENT') { assert.equal(r.reason, 'NO_ELIGIBLE_CANDIDATES'); break; }
      sizes.push(r.inserted);
    }
    const all = profilesOfNeed(t.needId);
    assert.deepEqual(sizes, [3, 1], 'WAVES_AFTER_THE_FIRST');
    assert.equal(all.length, 7); assert.equal(new Set(all).size, 7);
    assert.ok(all.includes(late.profileId), 'THE_LATE_WORKER_IS_REACHED');
    assert.deepEqual(sorted(all), sorted([...lp.map(p => p.profile_id), late.profileId]));
    pass('MATCH_V1B_LATE_WORKER_IS_NOT_SKIPPED_AND_A_CHANGED_PROFILE_NEVER_PULLS_A_WAVE_FORWARD', {waves: [3, ...sizes], requeue: second.profileRequeue});
  });

  await scenario('MATCH_V1B_WAVES_PACE_STOP_AND_RESUME', async () => {
    const t = await remoteTask('MV1B talasi', skillP);
    const rot = rotation(t.needId, poolIds);
    isolate([t.needId]);
    const tk = tick();
    assert.equal(tk.sent, 1); assert.equal(tk.processed, 1);
    let rs = byRound(t.needId);
    assert.equal(rs.length, 1); assert.equal(rs[0].batch_size, 5); assert.equal(rs[0].candidate_limit_used, 5); assert.equal(rs[0].budget_source, 'FIXED'); assert.equal(rs[0].window_minutes, 30);
    assert.deepEqual(rs[0].profiles, sorted(rot.slice(0, 5)), 'WAVE_1_IS_THE_FIRST_5_OF_THE_ROTATION');
    assert.equal(eventsOf(t.needId), 5); assert.equal(notificationsOf(t.needId), 10);
    const validity = rows(`select round(extract(epoch from (max(expires_at - created_at))) / 60)::integer as max, round(extract(epoch from (min(expires_at - created_at))) / 60)::integer as min
      from public.opportunity_deliveries where need_id=${q(t.needId)}::uuid`)[0];
    assert.ok(validity.min >= 1438 && validity.max <= 1441, 'VALID_24_HOURS:' + JSON.stringify(validity));
    const s1 = fx.readSchedule(t.needId);
    assert.ok(minutesFromNow(s1.nextRunAt) > 28 && minutesFromNow(s1.nextRunAt) < 31 && s1.lastStatus === 'SENT' && s1.attempts === 0, 'SCHEDULE:' + JSON.stringify(s1));
    // whoever wakes the task up, the next wave is not earlier than the interval
    const early = fx.runWave(t.needId);
    assert.equal(early.status, 'SENT'); assert.equal(early.inserted, 0); assert.equal(early.waiting, true);
    assert.ok(minutesFromNow(early.deadlineAt) > 28 && minutesFromNow(early.deadlineAt) < 31);
    for (let i = 0; i < 3; i++) {
      sql(`select private.enqueue_dispatch(${q(t.needId)}::uuid, statement_timestamp())`);
      const woken = tick();
      assert.equal(woken.sent, 1);
      const s = fx.readSchedule(t.needId);
      assert.ok(minutesFromNow(s.nextRunAt) > 25 && minutesFromNow(s.nextRunAt) < 31 && s.attempts === 0, 'RE-QUEUED_TASK_IS_DUE_AT_THE_WAVE_TIME:' + JSON.stringify(s));
    }
    assert.equal(byRound(t.needId).length, 1); assert.equal(deliveriesOf(t.needId), 5);
    pass('MATCH_V1B_WAVE_1_IS_THE_FIRST_OF_THE_ROTATION_AND_NOBODY_PULLS_WAVE_2_BEFORE_THE_INTERVAL', {wave1: 5, events: 5, notificationRows: 10, validityMinutes: validity});
    // wave 2: only after the interval (the tick finds the task due), the next 7, no duplicates
    age(t.needId, 31);
    const tk2 = tick();
    assert.equal(tk2.claimed, 1); assert.equal(tk2.sent, 1); assert.equal(tk2.failed, 0);
    rs = byRound(t.needId);
    assert.equal(rs.length, 2); assert.equal(rs[1].round_no, 2); assert.equal(rs[1].batch_size, 7); assert.equal(rs[1].candidate_limit_used, 7); assert.equal(rs[1].window_minutes, 30);
    const s3 = fx.readSchedule(t.needId);
    assert.ok(minutesFromNow(s3.nextRunAt) > 28 && minutesFromNow(s3.nextRunAt) < 31 && s3.attempts === 0 && s3.lastStatus === 'SENT', 'SCHEDULE_AFTER_WAVE_2:' + JSON.stringify(s3));
    assert.deepEqual(rs[1].profiles, sorted(rot.slice(5, 12)), 'WAVE_2_CONTINUES_THE_ROTATION');
    assert.equal(deliveriesOf(t.needId), 12); assert.equal(distinctAccountsOf(t.needId), 12);
    pass('MATCH_V1B_WAVE_2_COMES_AFTER_THE_INTERVAL_WITH_THE_NEXT_WORKERS_OF_THE_SAME_ROTATION_NO_DUPLICATES', {first: 5, next: 7});
    // five applications: the waves stop; one withdrawn: they go on
    const apps = [];
    for (const w of real.slice(0, 5)) {
      const a = await fx.submitApplication(w, t);
      assert.ok(a.ok, 'APPLICATION_REFUSED:' + JSON.stringify(a.error));
      apps.push(a.data);
    }
    age(t.needId, 31);
    const stopped = fx.runWave(t.needId);
    assert.equal(stopped.status, 'STOPPED'); assert.equal(stopped.reason, 'REMOTE_RESPONSE_TARGET_REACHED'); assert.equal(stopped.inserted, 0); assert.equal(stopped.activeResponses, 5);
    assert.equal(byRound(t.needId).length, 2); assert.equal(deliveriesOf(t.needId), 12);
    sql(`select private.enqueue_dispatch(${q(t.needId)}::uuid, statement_timestamp())`);
    tick();
    const s2 = fx.readSchedule(t.needId);
    assert.equal(s2.lastStatus, 'STOPPED'); assert.equal(s2.lastReason, 'REMOTE_RESPONSE_TARGET_REACHED'); assert.ok(s2.attempts >= 1 && s2.queued);
    pass('MATCH_V1B_WAVES_STOP_AT_5_APPLICATIONS_NOTHING_IS_SENT_AND_NO_ROUND_IS_WRITTEN', {reason: stopped.reason});
    await fx.withdrawApplication(real[4], apps[4]);
    age(t.needId, 31);
    const resumed = fx.runWave(t.needId);
    assert.equal(resumed.status, 'SENT'); assert.equal(resumed.inserted, 7); assert.equal(resumed.round, 3);
    assert.deepEqual(byRound(t.needId)[2].profiles, sorted(rot.slice(12, 19)));
    assert.equal(distinctAccountsOf(t.needId), 19);
    pass('MATCH_V1B_WAVES_GO_ON_WHEN_AN_APPLICATION_IS_WITHDRAWN_FEWER_THAN_5', {wave3: 7});
  });

  await scenario('MATCH_V1B_WAVES_STOP_WHEN_AGREED_OR_CANCELLED', async () => {
    const agreed = await remoteTask('MV1B dogovoren', skillP);
    isolate([agreed.needId]);
    tick();
    assert.equal(deliveriesOf(agreed.needId), 5);
    const a = await fx.submitApplication(real[0], agreed);
    assert.ok(a.ok, JSON.stringify(a.error));
    await fx.selectResponse(R, agreed, a.data);
    age(agreed.needId, 31);
    const r1 = fx.runWave(agreed.needId);
    assert.equal(r1.status, 'STOPPED'); assert.ok(['SLOTS_FILLED', 'NEED_NOT_OPEN'].includes(r1.reason), r1.reason); assert.equal(r1.inserted, 0);
    sql(`select private.enqueue_dispatch(${q(agreed.needId)}::uuid, statement_timestamp())`);
    tick();
    assert.equal(fx.readSchedule(agreed.needId).queued, false, 'THE_QUEUE_ROW_IS_GONE_FOR_AN_AGREED_TASK');
    assert.equal(deliveriesOf(agreed.needId), 5);
    const cancelled = await remoteTask('MV1B otkazan', skillP);
    fx.runWave(cancelled.needId);
    await fx.cancelNeed(R, cancelled);
    age(cancelled.needId, 31);
    const r2 = fx.runWave(cancelled.needId);
    assert.equal(r2.status, 'STOPPED'); assert.equal(r2.reason, 'NEED_NOT_OPEN'); assert.equal(deliveriesOf(cancelled.needId), 5);
    pass('MATCH_V1B_WAVES_STOP_FOR_GOOD_WHEN_THE_TASK_IS_AGREED_OR_CANCELLED', {agreed: r1.reason, cancelled: r2.reason});
  });

  await scenario('MATCH_V1B_DIFFERENT_TASKS_START_AT_DIFFERENT_WORKERS', async () => {
    const starts = [];
    for (let i = 0; i < 6; i++) {
      const t = await remoteTask('MV1B pocetak ' + i, skillP);
      const rot = rotation(t.needId, poolIds);
      const r = fx.runWave(t.needId);
      assert.equal(r.inserted, 5);
      assert.deepEqual(sorted(profilesOfNeed(t.needId)), sorted(rot.slice(0, 5)), 'THE_FIRST_WAVE_STARTS_AT_THE_ID_OF_THE_TASK');
      starts.push(rot[0]);
    }
    assert.ok(new Set(starts).size >= 2, 'ALL_TASKS_STARTED_AT_THE_SAME_WORKER');
    pass('MATCH_V1B_THE_ROTATION_IS_SEEDED_BY_THE_ID_OF_THE_TASK_DIFFERENT_TASKS_START_AT_DIFFERENT_WORKERS', {distinctStarts: new Set(starts).size, tasks: starts.length});
  });

  await scenario('MATCH_V1B_ONE_TICK_HANDLES_SEVERAL_REMOTE_TASKS_AND_THE_NEXT_ONE_FINDS_NOTHING_DUE', async () => {
    const ts = [];
    for (let i = 0; i < 4; i++) ts.push(await remoteTask('MV1B vise zadataka ' + i, skillP));
    isolate(ts.map(t => t.needId));
    const t1 = tick();
    assert.equal(t1.claimed, 4); assert.equal(t1.processed, 4); assert.equal(t1.sent, 4); assert.equal(t1.failed, 0); assert.equal(t1.deferred, 0);
    for (const t of ts) { assert.equal(deliveriesOf(t.needId), 5); assert.equal(byRound(t.needId).length, 1); }
    const t2 = tick();
    assert.equal(t2.claimed, 0, 'NOTHING_IS_DUE_BEFORE_THE_WAVE_TIME');
    for (const t of ts) age(t.needId, 31);
    const t3 = tick();
    assert.equal(t3.claimed, 4); assert.equal(t3.sent, 4); assert.equal(t3.failed, 0);
    for (const t of ts) { assert.equal(deliveriesOf(t.needId), 12); assert.equal(distinctAccountsOf(t.needId), 12); assert.equal(byRound(t.needId).length, 2); }
    pass('MATCH_V1B_ONE_TICK_SENDS_THE_FIRST_WAVE_OF_FOUR_REMOTE_TASKS_THE_NEXT_TICK_FINDS_NOTHING_DUE_AND_THE_SECOND_WAVE_COMES_WITH_THE_INTERVAL', {firstTick: {claimed: t1.claimed, sent: t1.sent}, idleTick: {claimed: t2.claimed}, secondTick: {claimed: t3.claimed, sent: t3.sent}});
  });

  await scenario('MATCH_V1B_CEILING_IS_THE_BRAKE', async () => {
    setKnobs({remoteCeiling: 13});
    const t = await remoteTask('MV1B granica', skillP);
    const seq = [];
    for (let i = 0; i < 4; i++) {
      const r = fx.runWave(t.needId);
      seq.push(r.status === 'SENT' ? r.inserted : r.reason);
      age(t.needId, 31);
    }
    assert.deepEqual(seq, [5, 7, 1, 'DELIVERY_CEILING_REACHED']);
    assert.equal(byRound(t.needId).length, 3, 'A_REFUSED_WAVE_WRITES_NO_ROUND'); assert.equal(deliveriesOf(t.needId), 13);
    const refusedWave = fx.runWave(t.needId);
    assert.equal(refusedWave.remote, true); assert.equal(refusedWave.ceiling, 13); assert.equal(refusedWave.deliveredBefore, 13);
    setKnobs({remoteCeiling: 20});
    age(t.needId, 31);
    const more = fx.runWave(t.needId);
    assert.equal(more.inserted, 7); assert.equal(distinctAccountsOf(t.needId), 20);
    pass('MATCH_V1B_REMOTE_CEILING_STOPS_THE_WAVES_AND_RAISING_IT_CONTINUES', {sequence: seq});
  });

  await scenario('MATCH_V1B_A_PHYSICAL_TASK_WITHOUT_COORDINATES_IS_SENT_IN_WAVES', async () => {
    const noCoordinates = insertNeed({title: 'MV1B bez koordinata', skill: skillP, mode: 'STATIONARY', schedule: 'FLEXIBLE'});
    const r = fx.runWave(noCoordinates);
    assert.equal(r.remote, true); assert.equal(r.inserted, 5); assert.equal(r.candidateRetrieval, 'REMOTE_ROTATION_WAVES');
    const withCoordinates = insertNeed({title: 'MV1B sa koordinatama', skill: skillQ, mode: 'STATIONARY', lat: 45.27, lng: 19.83, schedule: 'FLEXIBLE'});
    const p = fx.runWave(withCoordinates);
    assert.equal(p.remote, undefined); assert.equal(p.inserted, 8);
    pass('MATCH_V1B_A_TASK_WITHOUT_A_PLACE_IS_REMOTE_OR_WITHOUT_COORDINATES_A_TASK_WITH_A_PLACE_KEEPS_THE_ONE_WAVE', {withoutCoordinates: r.inserted, withCoordinates: p.inserted});
  });

  await scenario('MATCH_V1B_A_NEW_REVISION_STARTS_THE_ROTATION_AGAIN', async () => {
    const t = await remoteTask('MV1B revizija', skillP);
    const a = fx.runWave(t.needId);
    assert.equal(a.inserted, 5);
    const first = [...profilesOfNeed(t.needId)];
    sql(`begin; set local session_replication_role=replica; update public.needs set revision = revision + 1 where id=${q(t.needId)}::uuid; commit;`);
    const b = fx.runWave(t.needId);
    assert.equal(b.status, 'SENT'); assert.equal(b.round, 1); assert.equal(b.deliveredBefore, 0); assert.equal(b.inserted, 5);
    const rs = byRound(t.needId);
    assert.equal(rs.length, 2); assert.deepEqual(rs[1].profiles, rs[0].profiles, 'THE_NEW_REVISION_STARTS_AT_THE_SAME_PLACE_OF_THE_ROTATION');
    assert.equal(deliveriesOf(t.needId), 10); assert.deepEqual(sorted(first), rs[0].profiles);
    pass('MATCH_V1B_A_TASK_REVISION_STARTS_A_NEW_ROTATION_WITH_THE_FIRST_WAVE_SIZE', {revision2Wave1: b.inserted});
  });

  await scenario('MATCH_V1B_A_CHECK_THAT_FINDS_NOBODY_BACKS_OFF_LIKE_THE_TICK', async () => {
    const skill3 = 'mv1b-s3-' + tag;
    seedPool({label: 'mv1b-s3-' + tag, count: 3, skill: skill3});
    const t = await remoteTask('MV1B iscrpljen', skill3);
    const first = fx.runWave(t.needId);
    assert.equal(first.inserted, 3); assert.equal(first.exhausted, true); assert.equal(first.batchSize, 5);
    const gaps = [];
    for (const minutes of [31, 6, 6, 6, 9]) {
      age(t.needId, minutes);
      const r = fx.runWave(t.needId);
      assert.equal(r.status, 'STOPPED'); assert.equal(r.reason, 'NO_ELIGIBLE_CANDIDATES'); assert.equal(r.inserted, 0);
      const last = byRound(t.needId).at(-1);
      assert.equal(last.status, 'STOPPED'); assert.equal(last.stop_reason, 'NO_ELIGIBLE_CANDIDATES');
      gaps.push(last.window_minutes);
      const again = fx.runWave(t.needId);
      assert.equal(again.waiting, true, 'A_SECOND_CHECK_IS_PACED'); assert.equal(byRound(t.needId).length, gaps.length + 1);
    }
    assert.deepEqual(gaps, [5, 5, 5, 8, 16], 'THE_BACK_OFF_OF_THE_TICK');
    pass('MATCH_V1B_EMPTY_CHECKS_ARE_PACED_5_5_5_8_16_MINUTES_AS_THE_TICK_PACES_EVERY_TASK_THAT_FOUND_NOBODY', {minutes: gaps});
  });

  await scenario('MATCH_V1B_URGENT_REMOTE_TASK_USES_THE_URGENT_WINDOW_AND_ENDS_WITH_THE_URGENCY', async () => {
    const t = await remoteTask('MV1B hitno', skillP);
    sql(`begin; set local session_replication_role=replica; update public.needs set urgent=true, urgent_activated_at=statement_timestamp(), urgent_expires_at=statement_timestamp()+interval '20 minutes' where id=${q(t.needId)}::uuid; commit;`);
    const r = fx.runWave(t.needId);
    assert.equal(r.urgency, 'URGENT'); assert.equal(r.inserted, 5);
    assert.equal(byRound(t.needId)[0].window_minutes, 3, 'THE_URGENT_WINDOW');
    assert.equal(eventsOf(t.needId, 'HITNO'), 5);
    const validity = rows(`select round(extract(epoch from min(expires_at - created_at)) / 60)::integer as min, round(extract(epoch from max(expires_at - created_at)) / 60)::integer as max
      from public.opportunity_deliveries where need_id=${q(t.needId)}::uuid`)[0];
    assert.ok(validity.min >= 18 && validity.max <= 21, 'VALID_UNTIL_THE_END_OF_THE_URGENCY:' + JSON.stringify(validity));
    pass('MATCH_V1B_URGENT_REMOTE_TASK_3_MINUTE_WINDOW_HITNO_EVENTS_VALID_UNTIL_THE_END_OF_THE_URGENCY', {validity});
  });

  await scenario('MATCH_V1B_PLACE_BASED_TASKS_ARE_UNCHANGED', async () => {
    const t = await placeTask('MV1B mesto nepromenjeno', skillQ);
    const r = fx.runWave(t.needId);
    assert.equal(r.inserted, 8); assert.equal(r.batchSize, 10000); assert.equal(r.mode, 'ALL'); assert.equal(r.remote, undefined);
    assert.deepEqual(shape(r), b2Shape, 'THE_RESULT_HAS_EXACTLY_THE_KEYS_OF_MATCH_V1');
    assert.equal(byRound(t.needId).length, 1); assert.equal(eventsOf(t.needId), 8);
    setCeiling(5);
    const limited = await placeTask('MV1B mesto granica', skillQ);
    const lr = fx.runWave(limited.needId);
    assert.equal(lr.inserted, 5);
    assert.deepEqual(profilesOfNeed(limited.needId).map(id => rankOf.get(id)).sort((a, b) => a - b), [1, 2, 3, 4, 5], 'THE_NEAREST_FIVE');
    pass('MATCH_V1B_A_TASK_WITH_A_PLACE_KEEPS_THE_ONE_WAVE_THE_KEYS_AND_THE_GLOBAL_CEILING_OF_MATCH_V1', {wave: r.inserted, ceilingFive: lr.inserted});
  });

  await scenario('MATCH_V1B_DAILY_CAP_REMOTE_SKIPS_WITHOUT_USING_UP_THE_CEILING_AND_PICKS_UP_LATER', async () => {
    setKnobs({workerDailyCap: 3, remoteWaveSize: 8, remoteNextWaveSize: 8, remoteCeiling: 8});
    const skill = 'mv1b-c-' + tag;
    const pc = seedPool({label: 'mv1b-c-' + tag, count: 10, skill});
    seedEvents(pc[0].account_id, {count: 3, hoursAgo: 2});                      // capped
    seedEvents(pc[5].account_id, {count: 3, hoursAgo: 23});                     // capped (23 hours ago is inside the window)
    seedEvents(pc[1].account_id, {count: 2, hoursAgo: 2});                      // room
    seedEvents(pc[2].account_id, {count: 5, urgency: 'HITNO', hoursAgo: 2});    // urgent events are not counted
    seedEvents(pc[3].account_id, {count: 6, type: 'RESPONSE_RECEIVED', hoursAgo: 2});   // other types are not counted
    seedEvents(pc[4].account_id, {count: 3, hoursAgo: 25});                     // older than 24 hours is not counted
    assert.deepEqual(pc.map(p => hasRoom(p.account_id, 3)), [false, true, true, true, true, false, true, true, true, true]);
    assert.ok(pc.every(p => hasRoom(p.account_id, null)), 'A_NULL_CAP_MEANS_NO_CAP');
    const t = await remoteTask('MV1B kapa', skill);
    const r = fx.runWave(t.needId);
    assert.equal(r.inserted, 8, 'SKIPPED_WORKERS_DO_NOT_USE_UP_THE_CEILING');
    assert.deepEqual(sorted(profilesOfNeed(t.needId)), sorted(pc.filter((_, i) => i !== 0 && i !== 5).map(p => p.profile_id)));
    // the cap only holds the notification back: the capped worker still fits the task, so the map, the list and "Za mene" show it to him
    assert.equal(sql(`select private.worker_need_match_v1(${q(t.needId)}::uuid, ${q(pc[0].profile_id)}::uuid)`), 't', 'A_CAPPED_WORKER_STILL_FITS_THE_TASK');
    age(t.needId, 31);
    assert.equal(fx.runWave(t.needId).reason, 'DELIVERY_CEILING_REACHED');
    freeWorker(pc[0].account_id); setKnobs({remoteCeiling: 9}); age(t.needId, 31);
    const r2 = fx.runWave(t.needId);
    assert.equal(r2.inserted, 1); assert.deepEqual(profilesOfNeed(t.needId).includes(pc[0].profile_id), true);
    assert.equal(profilesOfNeed(t.needId).includes(pc[5].profile_id), false, 'STILL_CAPPED');
    freeWorker(pc[5].account_id); setKnobs({remoteCeiling: 10}); age(t.needId, 31);
    const r3 = fx.runWave(t.needId);
    assert.equal(r3.inserted, 1);
    assert.equal(distinctAccountsOf(t.needId), 10); assert.equal(deliveriesOf(t.needId), 10, 'NEVER_TWICE_FOR_THE_SAME_REVISION');
    pass('MATCH_V1B_DAILY_CAP_REMOTE_WAVES_SKIP_A_CAPPED_WORKER_FREE_THE_PLACE_AND_PICK_HIM_UP_WHEN_HE_HAS_ROOM', {wave1: r.inserted, laterPickups: [r2.inserted, r3.inserted]});
  });

  await scenario('MATCH_V1B_DAILY_CAP_PLACE_BASED_SKIPS_AND_THE_NEXT_NEAREST_TAKES_THE_PLACE', async () => {
    setKnobs({workerDailyCap: 3});
    setCeiling(6);
    const skill = 'mv1b-cp-' + tag;
    const pp = seedPool({label: 'mv1b-cp-' + tag, count: 8, skill, coords: true});
    seedEvents(pp[1].account_id, {count: 3, hoursAgo: 2});   // rank 2
    seedEvents(pp[3].account_id, {count: 3, hoursAgo: 2});   // rank 4
    const t = await placeTask('MV1B mesto kapa', skill);
    const r = fx.runWave(t.needId);
    const ranks = () => profilesOfNeed(t.needId).map(id => pp.find(p => p.profile_id === id).i).sort((a, b) => a - b);
    assert.equal(r.inserted, 6); assert.deepEqual(ranks(), [1, 3, 5, 6, 7, 8], 'THE_NEAREST_SIX_WITH_ROOM');
    freeWorker(pp[1].account_id); setCeiling(7);
    const r2 = fx.runWave(t.needId);
    assert.equal(r2.inserted, 1); assert.deepEqual(ranks(), [1, 2, 3, 5, 6, 7, 8]);
    freeWorker(pp[3].account_id); setCeiling(8);
    const r3 = fx.runWave(t.needId);
    assert.equal(r3.inserted, 1); assert.deepEqual(ranks(), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(distinctAccountsOf(t.needId), deliveriesOf(t.needId));
    pass('MATCH_V1B_DAILY_CAP_PLACE_BASED_TASK_SKIPS_THE_CAPPED_NEAREST_AND_THE_NEXT_WORKER_TAKES_THE_PLACE', {wave: r.inserted, pickups: [r2.inserted, r3.inserted]});
  });

  await scenario('MATCH_V1B_DAILY_CAP_HOLDS_ACROSS_TASKS_IN_ONE_TICK', async () => {
    // the point of the cap: a worker is not flooded when many new tasks fit him at once. Four workers, cap 2, three tasks, ONE tick.
    setKnobs({workerDailyCap: 2});
    const skill = 'mv1b-ct-' + tag;
    const pk = seedPool({label: 'mv1b-ct-' + tag, count: 4, skill});
    const ts = [];
    for (let i = 0; i < 3; i++) ts.push(await remoteTask('MV1B kapa vise zadataka ' + i, skill));
    isolate(ts.map(t => t.needId));
    const tk = tick();
    assert.equal(tk.claimed, 3); assert.equal(tk.processed, 3); assert.equal(tk.failed, 0);
    const per = ts.map(t => deliveriesOf(t.needId)).sort((a, b) => a - b);
    assert.deepEqual(per, [0, 4, 4], 'THE_THIRD_TASK_FINDS_EVERY_WORKER_AT_THE_CAP');
    for (const w of pk) {
      assert.equal(count(`select count(*) from public.user_activity_events where recipient_user_id=${q(w.account_id)}::uuid and event_type='OPPORTUNITY_AVAILABLE' and urgency='NORMAL'`), 2, 'EXACTLY_THE_CAP');
    }
    const starved = ts.find(t => deliveriesOf(t.needId) === 0);
    const sch = fx.readSchedule(starved.needId);
    assert.equal(sch.lastStatus, 'STOPPED'); assert.equal(sch.lastReason, 'NO_ELIGIBLE_CANDIDATES'); assert.ok(sch.attempts >= 1 && sch.queued);
    // a worker gets room (his notifications of the last day become older than 24 hours): the next check of the third task reaches him
    freeWorker(pk[0].account_id);
    age(starved.needId, 31);
    const later = fx.runWave(starved.needId);
    assert.equal(later.status, 'SENT'); assert.equal(later.inserted, 1); assert.deepEqual(profilesOfNeed(starved.needId), [pk[0].profile_id]);
    pass('MATCH_V1B_DAILY_CAP_HOLDS_ACROSS_TASKS_IN_ONE_TICK_THE_THIRD_TASK_WAITS_AND_REACHES_A_WORKER_WHEN_HE_HAS_ROOM_AGAIN', {deliveriesPerTask: per, eventsPerWorker: 2});
  });

  await scenario('MATCH_V1B_DAILY_CAP_IGNORES_URGENT_TASKS_AND_URGENT_EVENTS_ARE_NOT_COUNTED', async () => {
    setKnobs({workerDailyCap: 3});
    const skill = 'mv1b-cu-' + tag;
    const pu = seedPool({label: 'mv1b-cu-' + tag, count: 4, skill});
    seedEvents(pu[0].account_id, {count: 3, hoursAgo: 2});
    assert.equal(hasRoom(pu[0].account_id, 3), false);
    const urgent = await remoteTask('MV1B kapa hitno', skill);
    sql(`begin; set local session_replication_role=replica; update public.needs set urgent=true, urgent_activated_at=statement_timestamp(), urgent_expires_at=statement_timestamp()+interval '20 minutes' where id=${q(urgent.needId)}::uuid; commit;`);
    const ru = fx.runWave(urgent.needId);
    assert.equal(ru.inserted, 4, 'AN_URGENT_TASK_REACHES_THE_CAPPED_WORKER_TOO'); assert.equal(eventsOf(urgent.needId, 'HITNO'), 4);
    assert.equal(hasRoom(pu[0].account_id, 3), false, 'STILL_CAPPED_BY_HIS_NORMAL_EVENTS_ONLY');
    assert.equal(hasRoom(pu[1].account_id, 3), true, 'URGENT_EVENTS_ARE_NOT_COUNTED');
    const normal = await remoteTask('MV1B kapa obican', skill);
    const rn = fx.runWave(normal.needId);
    assert.equal(rn.inserted, 3); assert.equal(profilesOfNeed(normal.needId).includes(pu[0].profile_id), false);
    pass('MATCH_V1B_DAILY_CAP_URGENT_TASKS_ARE_NOT_CAPPED_AND_URGENT_NOTIFICATIONS_ARE_NOT_COUNTED', {urgentWave: ru.inserted, normalWave: rn.inserted});
  });

  await scenario('MATCH_V1B_DAILY_CAP_IS_OFF_BY_DEFAULT_AND_DOES_NOT_TOUCH_THE_LADDER', async () => {
    const skill = 'mv1b-co-' + tag;
    const po = seedPool({label: 'mv1b-co-' + tag, count: 3, skill});
    seedEvents(po[0].account_id, {count: 50, hoursAgo: 2});
    const offCfg = JSON.parse(sql(`select private.dispatch_config_v1b(value)::text from private.marketplace_config where key=${q(KEY)}`));
    assert.deepEqual(offCfg, {remoteWaves: true, workerDailyCap: null}, 'CAP_1000_IS_OFF');
    const t = await remoteTask('MV1B kapa iskljucena', skill);
    assert.equal(fx.runWave(t.needId).inserted, 3, 'A_WORKER_WITH_50_EVENTS_IS_STILL_NOTIFIED_WHEN_THE_CAP_IS_OFF');
    // the cap is a knob of mode ALL: the ladder reaches a capped worker
    setKnobs({workerDailyCap: 3});
    assert.equal(hasRoom(po[0].account_id, 3), false);
    applyFile(M + 'switch-ladder-on.sql');
    const lt = await remoteTask('MV1B kapa lestvica', skill);
    const lr = fx.runWave(lt.needId);
    applyFile(M + 'switch-ladder-off.sql');
    assert.equal(lr.inserted, 3); assert.ok(profilesOfNeed(lt.needId).includes(po[0].profile_id), 'THE_LADDER_IS_UNTOUCHED');
    pass('MATCH_V1B_DAILY_CAP_DEFAULT_1000_IS_OFF_AND_THE_LADDER_IS_NOT_CAPPED', {offConfig: offCfg});
  });

  await scenario('MATCH_V1B_SWITCH_OFF_IS_MATCH_V1_AND_A_BAD_KNOB_CANNOT_BE_SWITCHED_ON', async () => {
    applyFile(B + 'switch-remote-waves-off.sql');
    assert.equal(row().remoteWaves, false);
    refused(fs.readFileSync(B + 'switch-remote-waves-off.sql', 'utf8'), 'MATCH_V1B_SWITCH_EXPECTS_REMOTE_WAVES_ON');
    const t = await remoteTask('MV1B prekidac isključen', skillP);
    const r = fx.runWave(t.needId);
    assert.equal(r.inserted, 30); assert.equal(r.batchSize, 10000); assert.deepEqual(shape(r), b1Shape, 'EXACTLY_THE_RESULT_OF_MATCH_V1_MODE_ALL');
    assert.equal(byRound(t.needId).length, 1);
    setKnobs({remoteWaveSize: 0});
    refused(fs.readFileSync(B + 'switch-remote-waves-on.sql', 'utf8'), 'DISPATCH_CONFIG_INVALID');
    assert.equal(row().remoteWaves, false);
    setKnobs({remoteWaveSize: 5});
    applyFile(B + 'switch-remote-waves-on.sql');
    assert.equal(row().remoteWaves, true);
    refused(fs.readFileSync(B + 'switch-remote-waves-on.sql', 'utf8'), 'MATCH_V1B_SWITCH_EXPECTS_REMOTE_WAVES_OFF');
    const w = await remoteTask('MV1B prekidac ukljucen', skillP);
    assert.equal(fx.runWave(w.needId).inserted, 5);
    pass('MATCH_V1B_SWITCH_OFF_REMOTE_TASKS_ARE_EXACTLY_MATCH_V1_MODE_ALL_SWITCH_ON_WAVES_AGAIN_BAD_KNOBS_REFUSED', {offWave: r.inserted});
  });

  await scenario('MATCH_V1B_THE_LADDER_IS_UNTOUCHED', async () => {
    applyFile(M + 'switch-ladder-on.sql');
    setKnobs({remoteWaveSize: 0, remoteNextWaveSize: 'x', workerDailyCap: 0, remoteWavesZ: 1});   // knobs of mode ALL: the ladder never looks at them
    const t = await remoteTask('MV1B lestvica nepromenjena', skillP);
    const sizes = [], shapes = [];
    for (let i = 0; i < 6; i++) {
      const r = fx.runWave(t.needId);
      if (r.status !== 'SENT') break;
      sizes.push(r.inserted); shapes.push(shape(r));
    }
    applyFile(M + 'switch-ladder-off.sql');
    assert.deepEqual(sizes, ladderBefore, 'THE_SAME_GROUPS_AS_BEFORE_MATCH_V1B');
    assert.deepEqual(shapes, ladderShapeBefore, 'THE_SAME_RESULT_KEYS_AS_BEFORE_MATCH_V1B');
    pass('MATCH_V1B_THE_LADDER_GIVES_THE_SAME_GROUPS_AND_RESULTS_AS_BEFORE_AND_IGNORES_EVERY_NEW_KNOB', {sizes});
  });

  await scenario('MATCH_V1B_BAD_KNOBS_ARE_THE_NAMED_CONFIGURATION_ERROR', async () => {
    const bad = [
      ['remoteWaveSize 0', {remoteWaveSize: 0}], ['remoteWaveSize 10001', {remoteWaveSize: 10001}], ['remoteNextWaveSize text', {remoteNextWaveSize: 'x'}],
      ['remoteNextWaveSize fraction', {remoteNextWaveSize: 1.5}], ['remoteWaveMinutes 1441', {remoteWaveMinutes: 1441}], ['remoteStopAfterResponses 0', {remoteStopAfterResponses: 0}],
      ['remoteCeiling 10001', {remoteCeiling: 10001}], ['remoteCeiling fraction', {remoteCeiling: 5.5}], ['remoteWaves text', {remoteWaves: 'yes'}],
      ['workerDailyCap 0', {workerDailyCap: 0}], ['workerDailyCap 1001', {workerDailyCap: 1001}], ['workerDailyCap text', {workerDailyCap: '10'}], ['workerDailyCap null', {workerDailyCap: null}],
      ['misspelt remote knob', {remoteWavesX: 1}], ['misspelt worker knob', {workerDailyCapp: 5}],
    ];
    const results = {};
    for (const [name, patch] of bad) {
      const place = await placeTask('MV1B pogresna vrednost ' + name, skillQ);
      setKnobs(patch);
      const message = waveError(place.needId);
      assert.ok(message && message.includes('DISPATCH_CONFIG_INVALID'), 'NOT_THE_NAMED_ERROR:' + name + ':' + message);
      assert.equal(deliveriesOf(place.needId), 0, 'A_CONFIGURATION_ERROR_DELIVERS_NOTHING:' + name);
      results[name] = 'DISPATCH_CONFIG_INVALID';
      normalise();
    }
    // a missing cap is the same error; a bad remote knob is harmless while the waves are switched off
    const t = await placeTask('MV1B bez kape', skillQ);
    dropKnobs('workerDailyCap');
    assert.ok(waveError(t.needId)?.includes('DISPATCH_CONFIG_INVALID'));
    normalise();
    setKnobs({remoteWaves: false, remoteWaveSize: 0});
    const u = await remoteTask('MV1B iskljuceno ignorise', skillP);
    assert.equal(fx.runWave(u.needId).inserted, 30);
    pass('MATCH_V1B_EVERY_BAD_OR_MISSPELT_KNOB_IS_DISPATCH_CONFIG_INVALID_AND_NOTHING_IS_DELIVERED', {cases: Object.keys(results).length + 1});
  });

  await scenario('MATCH_V1B_DISCOVERY_ZAMENE_APPLIES_AFTER_AND_REVERTS_BEFORE', async () => {
    applyFile(D + 'candidate.sql');
    assert.equal(bodyMd5(dManifest.functions[0].signature), dManifest.functions[0].after_md5);
    assert.equal(bodyMd5(WAVE), bManifest.functions[0].after_md5);
    assert.deepEqual(closure(), baseClosure);
    applyFile(D + 'revert.sql');
    assert.equal(bodyMd5(dManifest.functions[0].signature), dManifest.functions[0].before_md5);
    pass('MATCH_V1B_DISCOVERY_ZAMENE_APPLIES_ON_TOP_AND_REVERTS_LEAVING_MATCH_V1B_IN_PLACE', {certificate: baseClosure.certificate});
  });

  // ---------------------------------------------------------------- exact reverts: MATCH-V1B, then MATCH-V1, then ZONE-PERF (the opposite order of the application)
  try {
    normalise();
    const gone = signatures => signatures.every(signature => sql(`select to_regprocedure(${q(signature)}) is null`) === 't');
    applyFile(B + 'revert.sql');
    assert.equal(bodyMd5(WAVE), bManifest.functions[0].before_md5, 'THE_MATCH_V1_WAVE_BODY_IS_BACK');
    assert.ok(gone(bManifest.newFunctions.map(f => f.signature)), 'THE_FIVE_NEW_FUNCTIONS_ARE_DROPPED');
    assert.equal(catalog(), catAfterMv1, 'CATALOG_EXACTLY_AS_BEFORE_MATCH_V1B');
    assert.deepEqual(row(), rowBefore, 'ROW_EXACTLY_AS_BEFORE_MATCH_V1B');
    assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001);
    refused(fs.readFileSync(B + 'revert.sql', 'utf8'), 'MATCH_V1B_REVERT_NEW_FUNCTION_DRIFT');
    {
      const t = await remoteTask('MV1B posle povratka', skillP);
      const r = fx.runWave(t.needId);
      assert.equal(r.inserted, 30); assert.equal(r.batchSize, 10000); assert.equal(r.remote, undefined); assert.deepEqual(shape(r), b1Shape);
      closeNeeds(tracked.splice(0));
    }
    pass('MATCH_V1B_REVERT_IS_EXACT_CATALOG_ROW_AND_CERTIFICATE_AS_BEFORE_AND_A_REMOTE_TASK_GOES_TO_EVERYONE_AGAIN', {certificate: baseClosure.certificate});
    // the same package through the in-transaction artifact (what a migration runner wraps in its own transaction), then reverted again
    const viaTransaction = run('begin;\n' + fs.readFileSync(B + 'candidate.in-transaction.sql', 'utf8') + '\ncommit;', {timeoutS: 180});
    assert.ok(viaTransaction.ok, 'IN_TRANSACTION_ARTIFACT_FAILED:' + viaTransaction.error);
    assert.equal(catalog(), catAfterV1b, 'THE_TWO_ARTIFACTS_LEAVE_THE_SAME_CATALOG');
    assert.deepEqual(row(), rowAfter);
    applyFile(B + 'revert.sql');
    assert.equal(catalog(), catAfterMv1); assert.deepEqual(row(), rowBefore); assert.deepEqual(closure(), baseClosure);
    pass('MATCH_V1B_IN_TRANSACTION_ARTIFACT_APPLIES_TO_THE_SAME_CATALOG_AND_REVERTS_EXACTLY');
    applyFile(M + 'revert.sql');
    assert.equal(catalog(), catAfterZone, 'CATALOG_EXACTLY_AS_BEFORE_MATCH_V1');
    assert.equal(Number(sql(`select count(*) from private.marketplace_config where key in ('match_v1_profile_requeue','match_v1_dispatch')`)), 0);
    assert.deepEqual(closure(), baseClosure);
    applyFile(Z + 'revert.sql');
    assert.equal(catalog(), baseCatalog, 'CATALOG_EXACTLY_AS_BEFORE_THE_WHOLE_STACK');
    assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001);
    pass('MATCH_V1B_THEN_MATCH_V1_THEN_ZONE_PERF_REVERTED_IN_THE_OPPOSITE_ORDER_THE_CATALOG_IS_THE_ONE_OF_THE_HISTORICAL_CHAIN', {certificate: baseClosure.certificate});
  } catch (error) {
    fail('MATCH_V1B_REVERTS', String(error?.stack ?? error).slice(0, 2500));
  }
  report.observations.auth = fx.authStats();
} catch (error) {
  fail('MATCH_V1B_RUN', String(error?.stack ?? error).slice(0, 2500));
  try { report.observations.backendsAtFailure = fx.diagnoseActiveBackends({terminate: false}); } catch { /* best effort */ }
}
report.result = report.failures.length === 0 ? 'PASS' : 'FAIL';
write();
console.log(`${report.result} MATCH-V1B runtime: ${report.checks.length} checks, ${report.failures.length} failures`);
process.exitCode = report.result === 'PASS' ? 0 : 1;
