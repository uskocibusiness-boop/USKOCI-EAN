// MATCH-V1B load proof: what does a task WITHOUT a place cost when 40,000 workers match it, and what does the per-worker daily cap cost?
// Real database on the loopback only (never DEV). Synthetic rows are written with triggers off (no product writer creates bulk rows; the readers only read
// them) and labelled 'V1B load'. Every measurement runs in ONE rolled-back transaction under its own hard statement_timeout; a timeout is RECORDED with its
// milliseconds, never thrown away. A measurement of the NEW code that does not complete fails the run.
//
// States measured on the SAME rows:  MV1 = ZONE-PERF + MATCH-V1 with the ceiling raised to 10,000 (what a remote task costs today: one wave to up to 10,000
// workers);  V1B = plus MATCH-V1B (waves of 300, then 1,000, up to 10,000; the daily cap off by default).
import fs from 'node:fs';
import path from 'node:path';
import * as C from './common.mjs';
import {createFixtures} from '../ex06/lib/fixtures.mjs';

const {assert, sql, rows, q, rt, run, applyFile, bodyMd5, catalog, closure, conflicts40001, setCeiling, requeueWatermark, lastLine, sleepSync} = C;
const {NIL, KEY, WAVE, TZ, Z, M, B, zManifest, mManifest, bManifest, out} = C;
const HARD_S = 90;
const WORKERS = 40000, RARE_EVERY = 800, PLACE_WORKERS = 8000, DRAFTS = 3000, EVENTS_PER_WORKER = 10, TICK_TASKS = 25;
const {report, write, pass, fail} = C.makeReport('MATCH-V1B load', 'v1b-load-report.json');
report.statementTimeoutSeconds = HARD_S;
report.load = {};
const L = report.load;

// ---------------------------------------------------------------- measuring helpers
/** SQL text: milliseconds since the plpgsql timestamp variable `v`, one decimal. */
const ms = v => `round((extract(epoch from clock_timestamp() - ${v}) * 1000)::numeric, 1)`;
const idArray = ids => 'array[' + ids.map(id => q(id) + '::uuid').join(',') + ']';
const countsSql = ids => `jsonb_build_object(
  'deliveries', (select count(*) from public.opportunity_deliveries where need_id = any(${idArray(ids)})),
  'events', (select count(*) from public.user_activity_events where entity_id = any(${idArray(ids)}) and event_type = 'OPPORTUNITY_AVAILABLE'),
  'notifications', (select count(*) from public.notification_deliveries d join public.user_activity_events e on e.id = d.event_id where e.entity_id = any(${idArray(ids)}) and e.event_type = 'OPPORTUNITY_AVAILABLE'),
  'rounds', (select count(*) from public.dispatch_rounds where need_id = any(${idArray(ids)})))`;
const SIZES = `jsonb_build_object('deliveries', pg_total_relation_size('public.opportunity_deliveries'), 'events', pg_total_relation_size('public.user_activity_events'),
  'notifications', pg_total_relation_size('public.notification_deliveries'), 'rounds', pg_total_relation_size('public.dispatch_rounds'))`;
const calls = name => `coalesce((select sum(calls) from pg_stat_xact_user_functions where funcname = '${name}'), 0)`;
const age = ids => `update public.dispatch_rounds set created_at = created_at - interval '31 minutes', deadline_at = deadline_at - interval '31 minutes' where need_id = any(${idArray(ids)});`;
/**
 * One rolled-back transaction. `work` is plpgsql that fills `out` (declared) and may use t0, t1, res, res2, w (a json array), k, c0, c1, c2, sz0, sz1.
 * setup: SQL before the block (same transaction); config: a patch of the dispatch row for this transaction only; track: per-function call counts.
 */
function probe(work, {timeoutS = HARD_S, config = null, setup = '', track = false} = {}) {
  const r = run(`begin;
    ${track ? "set local track_functions = 'all';" : ''}
    ${setup}
    ${config ? `update private.marketplace_config set value = value || ${q(JSON.stringify(config))}::jsonb where key = '${KEY}';` : ''}
    do $t$ declare t0 timestamptz; t1 timestamptz; res jsonb; res2 jsonb; res3 jsonb; out jsonb := '{}'::jsonb; w jsonb := '[]'::jsonb; k integer; c0 bigint; c1 bigint; c2 bigint; sz0 jsonb; sz1 jsonb;
    begin
      ${work}
      perform set_config('v1b.out', out::text, false);
    end $t$;
    select current_setting('v1b.out');
    rollback;`, {timeoutS});
  if (!r.ok) return {ok: false, timedOut: r.timedOut, error: r.error, wallMs: r.wallMs};
  return {ok: true, ...JSON.parse(lastLine(r.output)), wallMs: r.wallMs};
}
const brief = x => x?.ok ? x : {ok: false, timedOut: x?.timedOut ?? false, error: String(x?.error ?? '').slice(0, 300), wallMs: x?.wallMs};
const keep = (key, value) => { L[key] = value; write(); return value; };

// ---------------------------------------------------------------- synthetic rows
const needsInsert = (R, {category, skill, mode, lat = null, lng = null, count, schedule}) => `insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,required_tools,
    required_vehicles,required_licenses,minimum_experience_years,verified_identity_required,approximate_city,approximate_area,approximate_lat,approximate_lng,mode,required_slots,
    schedule_kind,starts_at,ends_at,execution_location_mode,task_country_code,task_timezone,response_deadline,published_at)
  select gen_random_uuid(),${q(R.id)}::uuid,${q(R.profileId)}::uuid,'PUBLISHED','${category} '||g,'Sinteticki zadatak za merenje.','${category}',array['${skill}'],'{}','{}','{}',0,false,
    ${mode === 'REMOTE' ? "''" : "'Novi Sad'"},'',${lat ?? 'null'},${lng ?? 'null'},'OFFERS',1,'${schedule}',null,null,'${mode}','RS','Europe/Belgrade',
    statement_timestamp() + interval '2 days', statement_timestamp() from generate_series(1,${count}) g;`;
function seed(R) {
  // 40,000 active workers who all do kind of work A (50 of them also do the rare kind B), 8,000 of them with an approximate point within about 12 km of Novi Sad,
  // 3,000 draft profiles, and ten events per worker (six new-task notifications and two urgent ones spread over ten days, two answers).
  const r = run(`begin; set local session_replication_role = replica;
  create temporary table v1b_w on commit drop as select gen_random_uuid() as account_id, gen_random_uuid() as profile_id, g as i from generate_series(1,${WORKERS}) g;
  insert into auth.users(id,aud,role,email) select account_id,'authenticated','authenticated','v1b-load-'||i||'@proof.invalid' from v1b_w;
  insert into public.app_accounts(id,email) select account_id,'v1b-load-'||i||'@proof.invalid' from v1b_w;
  insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,radius_km,available_now)
   select profile_id,account_id,'WORKER','V1B load '||i,'Novi Sad','ACTIVE',
     case when i % ${RARE_EVERY} = 0 then array['v1b-load-a','v1b-load-b'] else array['v1b-load-a'] end,15,true from v1b_w;
  insert into public.worker_match_preferences(worker_profile_id,worker_account_id,approximate_lat,approximate_lng)
   select profile_id,account_id,round((45.27+(i%10)*0.01)::numeric,2),round((19.83+((i/10)%10)*0.01)::numeric,2) from v1b_w where i <= ${PLACE_WORKERS};
  insert into public.user_activity_events(recipient_user_id,recipient_role,event_type,entity_type,entity_id,entity_version,urgency,payload,dedupe_key,created_at)
   select w.account_id,'WORKER',case when k <= 8 then 'OPPORTUNITY_AVAILABLE' else 'RESPONSE_NOT_SELECTED' end,'NEED',gen_random_uuid(),1,
     case when k between 7 and 8 then 'HITNO' else 'NORMAL' end,'{}'::jsonb,'v1b-seed:'||gen_random_uuid()::text,
     statement_timestamp() - (random() * 10 * 24 * 3600) * interval '1 second'
    from v1b_w w cross join generate_series(1,${EVENTS_PER_WORKER}) k;
  create temporary table v1b_d on commit drop as select gen_random_uuid() as account_id, gen_random_uuid() as profile_id, g as i from generate_series(1,${DRAFTS}) g;
  insert into public.app_accounts(id,email) select account_id,'v1b-draft-'||i||'@proof.invalid' from v1b_d;
  insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status) select profile_id,account_id,'WORKER','V1B draft '||i,'Novi Sad','DRAFT' from v1b_d;
  ${needsInsert(R, {category: 'V1B single a', skill: 'v1b-load-a', mode: 'REMOTE', count: 1, schedule: 'REMOTE_ANYTIME'})}
  ${needsInsert(R, {category: 'V1B single b', skill: 'v1b-load-b', mode: 'REMOTE', count: 1, schedule: 'REMOTE_ANYTIME'})}
  ${needsInsert(R, {category: 'V1B single place', skill: 'v1b-load-a', mode: 'STATIONARY', lat: 45.27, lng: 19.83, count: 1, schedule: 'FLEXIBLE'})}
  ${needsInsert(R, {category: 'V1B tick', skill: 'v1b-load-a', mode: 'REMOTE', count: TICK_TASKS, schedule: 'REMOTE_ANYTIME'})}
  commit;`, {timeoutS: 300});
  assert.ok(r.ok, 'SEED_FAILED:' + r.error);
  // the tables the readers use are vacuumed (hint bits, visibility) and analyzed, as a long-running server would have them
  const v = run('vacuum (analyze) public.app_profiles; vacuum (analyze) public.app_accounts; vacuum (analyze) public.worker_match_preferences; vacuum (analyze) public.user_activity_events; vacuum (analyze) public.needs;', {timeoutS: 300});
  assert.ok(v.ok, 'VACUUM_FAILED:' + v.error);
  return JSON.parse(lastLine(run(`select jsonb_build_object(
    'activeWorkers', (select count(*) from public.app_profiles where kind = 'WORKER' and profile_status = 'ACTIVE' and display_name like 'V1B load %'),
    'matchingKindA', (select count(*) from public.app_profiles where profile_status = 'ACTIVE' and skills && array['v1b-load-a']),
    'matchingKindB', (select count(*) from public.app_profiles where profile_status = 'ACTIVE' and skills && array['v1b-load-b']),
    'draftProfiles', (select count(*) from public.app_profiles where profile_status <> 'ACTIVE' and display_name like 'V1B draft %'),
    'workersWithPoint', (select count(*) from public.worker_match_preferences where approximate_geog is not null and worker_account_id in (select account_id from public.app_profiles where display_name like 'V1B load %')),
    'events', (select count(*) from public.user_activity_events where dedupe_key like 'v1b-seed:%'),
    'workersWithANormalEventInTheLastDay', (select count(distinct recipient_user_id) from public.user_activity_events where dedupe_key like 'v1b-seed:%' and event_type = 'OPPORTUNITY_AVAILABLE' and urgency = 'NORMAL' and created_at > statement_timestamp() - interval '24 hours'),
    'openTasks', (select count(*) from public.needs where category like 'V1B %'))`).output));
}
const idsOf = category => rows(`select id from public.needs where category = ${q(category)} order by id`).map(x => x.id);

// ---------------------------------------------------------------- the run
const fx = createFixtures(rt, {needPath: 'direct'});
let state = 'BASE';
let baseCatalog = null, baseClosure = null, base40001 = null;
const section = (name, fn) => {
  try { return fn(); } catch (error) { fail(name, String(error?.stack ?? error).slice(0, 800)); return null; }
};
try {
  fx.pauseSchedulers();
  baseCatalog = catalog(); baseClosure = closure(); base40001 = conflicts40001();
  assert.equal(baseClosure.ready, true);
  assert.equal(bodyMd5(TZ), zManifest.functions[0].before_md5);
  for (const f of mManifest.functions) assert.equal(bodyMd5(f.signature), f.before_md5, 'PREDECESSOR:' + f.signature);
  const R = await fx.createRequester({label: 'v1b-load-requester'});
  applyFile(Z + 'candidate.sql'); state = 'ZONE';
  applyFile(M + 'candidate.sql'); state = 'MV1';
  setCeiling(10000);
  assert.deepEqual(C.row(), {mode: 'ALL', ceiling: 10000, validMinutes: 1440, tickBudgetSeconds: 40, owner: 'MATCH-V1 2026-10-07'});
  keep('sizes', seed(R));
  L.sizes.workersTotal = Number(sql(`select count(*) from public.app_profiles where kind = 'WORKER'`));
  pass('MATCH_V1B_LOAD_ROWS_SEEDED_VACUUMED_AND_ANALYZED', L.sizes);
  const [A] = idsOf('V1B single a'), [Bt] = idsOf('V1B single b'), [P] = idsOf('V1B single place'), ticks = idsOf('V1B tick');
  // the profile re-queue is not what this measures: its watermark sits ahead of the freshly inserted profiles, and no task is queued
  requeueWatermark(`statement_timestamp() + interval '2 hours'`);
  assert.ok(run('delete from private.dispatch_schedule;').ok);
  // the rule is the rule: a sample of the workers fits A, only the rare ones fit B
  const sample = JSON.parse(lastLine(run(`select jsonb_build_object(
    'firstA', (select count(*) filter (where private.worker_need_match_v1(${q(A)}::uuid, s.id)) from (select id from public.app_profiles where display_name like 'V1B load %' order by id limit 300) s),
    'sampleB', (select count(*) filter (where private.worker_need_match_v1(${q(Bt)}::uuid, s.id)) from (select id from public.app_profiles where display_name like 'V1B load %' order by id limit 300) s),
    'rareB', (select count(*) filter (where private.worker_need_match_v1(${q(Bt)}::uuid, s.id)) from (select id from public.app_profiles where display_name like 'V1B load %' and skills && array['v1b-load-b']) s))`).output));
  assert.equal(sample.firstA, 300); assert.equal(sample.rareB, Math.floor(WORKERS / RARE_EVERY));
  L.sizes.ruleSample = sample;

  // ---- MV1 alone: what a task without a place costs today (one wave to up to 10,000 workers) and what a rare-kind task costs
  section('MV1', () => {
    const ids = [A];
    L.mv1 = {
      oneWaveAtTheCeiling: brief(probe(`t0 := clock_timestamp(); res := private.dispatch_next_wave(${q(A)}::uuid);
        out := out || jsonb_build_object('ms', ${ms('t0')}, 'status', res->>'status', 'inserted', (res->>'inserted')::integer, 'batch', res->>'batchSize', 'counts', ${countsSql(ids)});`, {timeoutS: 150})),
      rareKind: brief(probe(`t0 := clock_timestamp(); res := private.dispatch_next_wave(${q(Bt)}::uuid);
        out := out || jsonb_build_object('ms1', ${ms('t0')}, 'inserted1', (res->>'inserted')::integer);
        t0 := clock_timestamp(); res2 := private.dispatch_next_wave(${q(Bt)}::uuid);
        out := out || jsonb_build_object('ms2', ${ms('t0')}, 'inserted2', (res2->>'inserted')::integer, 'reason2', res2->>'reason');`)),
      placeRetrieval1000: brief(probe(`t0 := clock_timestamp(); select count(*) into c0 from private.candidate_profile_ids(${q(P)}::uuid, 1000);
        out := out || jsonb_build_object('ms', ${ms('t0')}, 'rows', c0);`)),
    };
    write();
  });

  // ---- MV1 + MATCH-V1B
  section('V1B', () => {
    applyFile(B + 'candidate.sql'); state = 'V1B';
    assert.equal(bodyMd5(WAVE), bManifest.functions[0].after_md5);
    assert.deepEqual(closure(), baseClosure);
    const row = C.row();
    assert.equal(row.remoteWaves, true); assert.equal(row.remoteWaveSize, 300); assert.equal(row.remoteNextWaveSize, 1000); assert.equal(row.workerDailyCap, 1000);
    const ids = [A];
    const age1 = age(ids);
    // (1) the series: 300, then 1,000 every 30 minutes, up to the ceiling of 10,000, then the refusal; rows, bytes and milliseconds per wave
    L.series = brief(probe(`
      sz0 := ${SIZES};
      for k in 1..14 loop
        if k > 1 then ${age1} end if;
        t0 := clock_timestamp();
        res := private.dispatch_next_wave(${q(A)}::uuid);
        w := w || jsonb_build_array(jsonb_build_object('k', k, 'ms', ${ms('t0')}, 'status', res->>'status', 'reason', res->>'reason', 'inserted', coalesce((res->>'inserted')::integer, 0),
          'batch', res->>'batchSize', 'before', res->>'deliveredBefore', 'total', res->>'deliveredTotal'));
        exit when res->>'status' <> 'SENT';
      end loop;
      sz1 := ${SIZES};
      out := out || jsonb_build_object('waves', w, 'sizesBefore', sz0, 'sizesAfter', sz1, 'counts', ${countsSql(ids)},
        'distinctAccounts', (select count(distinct worker_account_id) from public.opportunity_deliveries where need_id = ${q(A)}::uuid));
      -- the retrieval of the next 1,000 with 10,000 workers already notified: the MATCH-V1 function re-evaluates them, the walk of this package skips them by an index probe
      t0 := clock_timestamp(); select count(*) into c0 from private.candidate_profile_ids(${q(A)}::uuid, 1000);
      out := out || jsonb_build_object('mv1RetrievalMs', ${ms('t0')}, 'mv1RetrievalRows', c0);
      t0 := clock_timestamp(); select count(*) into c1 from private.remote_wave_candidates_v1b(${q(A)}::uuid, 1000, null);
      out := out || jsonb_build_object('walkMs', ${ms('t0')}, 'walkRows', c1);`, {timeoutS: 170}));
    write();
    // (2) calls per wave: a wave evaluates about the workers it notifies, not the 40,000 profiles (cap off, then cap 1 where about 47 % of the workers are at the cap)
    const callsWork = `
      for k in 1..3 loop
        if k > 1 then ${age1} end if;
        c0 := ${calls('dispatch_cheap_candidate_admitted')}; c1 := ${calls('match_detail')}; c2 := ${calls('worker_notify_room_v1b')};
        t0 := clock_timestamp();
        res := private.dispatch_next_wave(${q(A)}::uuid);
        w := w || jsonb_build_array(jsonb_build_object('k', k, 'ms', ${ms('t0')}, 'inserted', (res->>'inserted')::integer, 'workerDailyCap', res->'workerDailyCap',
          'cheapCalls', ${calls('dispatch_cheap_candidate_admitted')} - c0, 'detailCalls', ${calls('match_detail')} - c1, 'roomCalls', ${calls('worker_notify_room_v1b')} - c2));
      end loop;
      out := out || jsonb_build_object('waves', w, 'counts', ${countsSql(ids)});`;
    L.callsCapOff = brief(probe(callsWork, {track: true, config: {workerDailyCap: 1000}}));
    L.callsCap3 = brief(probe(callsWork, {track: true, config: {workerDailyCap: 3}}));
    L.callsCap1 = brief(probe(callsWork + `
      out := out || jsonb_build_object('deliveredToCappedWorkers', (select count(*) from public.opportunity_deliveries d join v1b_capped c on c.account_id = d.worker_account_id where d.need_id = ${q(A)}::uuid));`, {
      track: true, config: {workerDailyCap: 1},
      setup: `create temporary table v1b_capped on commit drop as select distinct recipient_user_id as account_id from public.user_activity_events
        where recipient_role = 'WORKER' and event_type = 'OPPORTUNITY_AVAILABLE' and urgency = 'NORMAL' and created_at > statement_timestamp() - interval '24 hours';`}));
    write();
    // (3) everybody is at the cap: the worst case for the walk is a task that visits all 40,000 profiles and notifies nobody
    L.allCapped = brief(probe(`t0 := clock_timestamp(); res := private.dispatch_next_wave(${q(A)}::uuid);
        out := out || jsonb_build_object('ms', ${ms('t0')}, 'status', res->>'status', 'reason', res->>'reason', 'inserted', (res->>'inserted')::integer, 'counts', ${countsSql(ids)});`, {
      config: {workerDailyCap: 1},
      setup: `insert into public.user_activity_events(recipient_user_id,recipient_role,event_type,entity_type,entity_id,entity_version,urgency,payload,dedupe_key,created_at)
        select account_id,'WORKER','OPPORTUNITY_AVAILABLE','NEED',gen_random_uuid(),1,'NORMAL','{}'::jsonb,'v1b-allcap:'||gen_random_uuid()::text,statement_timestamp() - interval '1 minute'
          from public.app_profiles where display_name like 'V1B load %';`}));
    write();
    // (4) a task few workers fit (kind B, 50 of 40,000): the first check finds them, the next one walks all profiles for nobody, an immediate third one only waits
    L.rareKind = brief(probe(`
      t0 := clock_timestamp(); res := private.dispatch_next_wave(${q(Bt)}::uuid);
      out := out || jsonb_build_object('ms1', ${ms('t0')}, 'inserted1', (res->>'inserted')::integer, 'exhausted1', res->'exhausted');
      ${age([Bt])}
      t0 := clock_timestamp(); res2 := private.dispatch_next_wave(${q(Bt)}::uuid);
      out := out || jsonb_build_object('ms2', ${ms('t0')}, 'status2', res2->>'status', 'reason2', res2->>'reason', 'inserted2', (res2->>'inserted')::integer);
      t0 := clock_timestamp(); res3 := private.dispatch_next_wave(${q(Bt)}::uuid);
      out := out || jsonb_build_object('ms3', ${ms('t0')}, 'waiting3', res3->'waiting', 'inserted3', (res3->>'inserted')::integer, 'counts', ${countsSql([Bt])});`));
    write();
    // (5) the tick: 25 tasks, each with 40,000 matching workers: first waves of 300, then the second waves of 1,000 under the 40 s budget of the tick
    const arr = idArray(ticks);
    L.tick = brief(probe(`
      ${ticks.map(id => `perform private.enqueue_dispatch(${q(id)}::uuid, statement_timestamp());`).join('\n      ')}
      t0 := clock_timestamp(); res := private.dispatch_tick(25, statement_timestamp());
      out := out || jsonb_build_object('tick1', jsonb_build_object('ms', ${ms('t0')}, 'claimed', res->'claimed', 'processed', res->'processed', 'sent', res->'sent', 'deferred', res->'deferred', 'failed', res->'failed'),
        'afterTick1', ${countsSql(ticks)});
      ${age(ticks)}
      update private.dispatch_schedule set next_run_at = statement_timestamp() - interval '1 second', locked_until = null where need_id = any(${arr});
      t0 := clock_timestamp(); res2 := private.dispatch_tick(25, statement_timestamp());
      out := out || jsonb_build_object('tick2', jsonb_build_object('ms', ${ms('t0')}, 'claimed', res2->'claimed', 'processed', res2->'processed', 'sent', res2->'sent', 'deferred', res2->'deferred', 'failed', res2->'failed'),
        'afterTick2', ${countsSql(ticks)});`, {timeoutS: 170}));
    write();
    // (6) the cap probe by itself: one count per candidate, index-friendly (20,000 workers, then the plan of one probe)
    const capMicro = run(`do $t$ declare t0 timestamptz := clock_timestamp(); n bigint; m bigint; begin
        select count(*), count(*) filter (where private.worker_notify_room_v1b(s.account_id, 3)) into n, m
          from (select account_id from public.app_profiles where display_name like 'V1B load %' order by id limit 20000) s;
        perform set_config('v1b.out', jsonb_build_object('calls', n, 'withRoom', m, 'ms', ${ms('t0')})::text, false); end $t$;
      select current_setting('v1b.out');`);
    L.capMicro = capMicro.ok ? JSON.parse(lastLine(capMicro.output)) : brief(capMicro);
    const account = sql(`select account_id from public.app_profiles where display_name = 'V1B load 7'`);
    const plan = run(`explain (analyze, buffers, costs off, timing off, summary off)
      select count(*) from (select 1 from public.user_activity_events e where e.recipient_user_id = ${q(account)}::uuid and e.recipient_role = 'WORKER'
        and e.created_at > statement_timestamp() - interval '24 hours' and e.event_type = 'OPPORTUNITY_AVAILABLE' and e.urgency = 'NORMAL' limit 3) counted;`);
    L.capPlan = plan.ok ? plan.output.split('\n').map(line => line.trim()) : plan.error;
    const walkPlan = run(`explain (analyze, buffers, costs off, timing off, summary off)
      select p.id, p.account_id from public.app_profiles p
       where p.kind = 'WORKER' and p.profile_status = 'ACTIVE' and p.id >= '80000000-0000-0000-0000-000000000000'::uuid
         and not exists (select 1 from public.opportunity_deliveries od where od.worker_account_id = p.account_id and od.need_id = ${q(A)}::uuid and od.need_revision = 1)
       order by p.id limit 500;`);
    L.walkPlan = walkPlan.ok ? walkPlan.output.split('\n').map(line => line.trim()) : walkPlan.error;
    write();
    // (7) a task WITH a place: the nearest first, with and without the cap (function level, then one whole wave of 1,000)
    L.place = {
      retrieval: brief(probe(`
        t0 := clock_timestamp(); select count(*) into c0 from private.candidate_profile_ids(${q(P)}::uuid, 1000); out := out || jsonb_build_object('mv1Ms', ${ms('t0')}, 'mv1Rows', c0);
        t0 := clock_timestamp(); select count(*) into c0 from private.candidate_profile_ids_v1b(${q(P)}::uuid, 1000, null); out := out || jsonb_build_object('twinNullMs', ${ms('t0')}, 'twinNullRows', c0);
        t0 := clock_timestamp(); select count(*) into c0 from private.candidate_profile_ids_v1b(${q(P)}::uuid, 1000, 3); out := out || jsonb_build_object('twinCap3Ms', ${ms('t0')}, 'twinCap3Rows', c0);
        t0 := clock_timestamp(); select count(*) into c0 from private.candidate_profile_ids_v1b(${q(P)}::uuid, 1000, 1); out := out || jsonb_build_object('twinCap1Ms', ${ms('t0')}, 'twinCap1Rows', c0);`)),
      waveCapOff: brief(probe(`t0 := clock_timestamp(); res := private.dispatch_next_wave(${q(P)}::uuid);
        out := out || jsonb_build_object('ms', ${ms('t0')}, 'inserted', (res->>'inserted')::integer, 'remote', res->'remote', 'mode', res->>'mode', 'counts', ${countsSql([P])});`, {config: {ceiling: 1000}})),
      waveCap3: brief(probe(`t0 := clock_timestamp(); res := private.dispatch_next_wave(${q(P)}::uuid);
        out := out || jsonb_build_object('ms', ${ms('t0')}, 'inserted', (res->>'inserted')::integer, 'remote', res->'remote', 'mode', res->>'mode', 'counts', ${countsSql([P])});`, {config: {ceiling: 1000, workerDailyCap: 3}})),
    };
    write();
  });
} catch (error) {
  fail('LOAD_SETUP', String(error?.stack ?? error).slice(0, 1000));
} finally {
  // exact reverts, whatever happened above
  try {
    if (state === 'V1B') { applyFile(B + 'revert.sql'); state = 'MV1'; }
    if (state === 'MV1') { applyFile(M + 'revert.sql'); state = 'ZONE'; }
    if (state === 'ZONE') { applyFile(Z + 'revert.sql'); state = 'BASE'; }
  } catch (error) { fail('REVERT', String(error).slice(0, 500)); }
  try {
    if (baseCatalog) {
      assert.equal(catalog(), baseCatalog); assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001);
      pass('MATCH_V1B_LOAD_STATES_REVERTED_CATALOG_AND_CERTIFICATE_RESTORED');
    }
  } catch (error) { fail('REVERT_STATE', String(error).slice(0, 500)); }
}

// ---------------------------------------------------------------- verdict: the NEW code must finish every measurement, be flat across waves and be cheap per cap probe
const gate = (name, good, detail) => { if (good) pass(name, detail); else fail(name, detail); };
const okAll = (...xs) => xs.every(x => x?.ok === true);
const num = (v, d = 1e12) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const sum = list => list.reduce((a, b) => a + b, 0);
if (L.series || L.tick || L.rareKind) {
  const s = L.series, waves = s?.waves ?? [];
  gate('LOAD_V1B_EVERY_MEASUREMENT_COMPLETED_WITHIN_THE_HARD_TIMEOUT',
    okAll(L.series, L.callsCapOff, L.callsCap3, L.callsCap1, L.allCapped, L.rareKind, L.tick, L.place?.retrieval, L.place?.waveCapOff, L.place?.waveCap3) && L.capMicro?.calls > 0,
    Object.fromEntries(Object.entries({series: L.series, callsCapOff: L.callsCapOff, callsCap3: L.callsCap3, callsCap1: L.callsCap1, allCapped: L.allCapped, rareKind: L.rareKind, tick: L.tick,
      placeRetrieval: L.place?.retrieval, placeWaveCapOff: L.place?.waveCapOff, placeWaveCap3: L.place?.waveCap3}).map(([k, x]) => [k, x?.ok ? 'ok' : (x?.timedOut ? 'STATEMENT TIMEOUT' : String(x?.error).slice(0, 160))])));
  const planned = [300, ...Array(9).fill(1000), 700];
  gate('LOAD_V1B_A_REMOTE_TASK_WITH_40000_MATCHING_WORKERS_IS_SENT_IN_11_WAVES_300_THEN_1000_TO_THE_CEILING_OF_10000_AND_THEN_REFUSED',
    L.sizes?.matchingKindA === WORKERS && waves.length === 12 && waves.slice(0, 11).every((x, i) => x.status === 'SENT' && x.inserted === planned[i]) && waves[11]?.status === 'STOPPED'
      && waves[11].reason === 'DELIVERY_CEILING_REACHED' && s?.counts?.deliveries === 10000 && s.distinctAccounts === 10000,
    {matching: L.sizes?.matchingKindA, waves: waves.map(x => `${x.inserted}${x.status === 'SENT' ? '' : ' ' + x.reason}`), deliveries: s?.counts?.deliveries, distinct: s?.distinctAccounts});
  gate('LOAD_V1B_ROWS_PER_NOTIFIED_WORKER_ARE_FOUR_AND_ONE_ROUND_PER_WAVE',
    s?.counts?.deliveries === 10000 && s.counts.events === 10000 && s.counts.notifications === 20000 && s.counts.rounds === 11,
    {...s?.counts, bytesAfterMinusBefore: s ? Object.fromEntries(Object.keys(s.sizesAfter ?? {}).map(k => [k, s.sizesAfter[k] - s.sizesBefore[k]])) : null});
  const msOf = i => waves[i]?.ms ?? 1e12;
  const later = waves.slice(2, 10).map(x => x.ms);
  gate('LOAD_V1B_EVERY_WAVE_COSTS_SECONDS_AND_THE_LATE_WAVES_COST_NO_MORE_THAN_THE_EARLY_ONES',
    msOf(0) < 10000 && waves.slice(0, 11).every(x => num(x.ms) < 20000) && Math.max(...later) <= 2 * msOf(1) + 1500,
    {firstWave300Ms: msOf(0), secondWave1000Ms: msOf(1), tenthWave1000Ms: msOf(9), lastWave700Ms: msOf(10), maxOfWaves3to10: Math.max(...later), totalMs: Math.round(sum(waves.map(x => x.ms)))});
  gate('LOAD_V1B_THE_WALK_SKIPS_THE_NOTIFIED_AND_IS_NOT_SLOWER_THAN_THE_MATCH_V1_RETRIEVAL_WITH_10000_ALREADY_NOTIFIED',
    s?.walkRows === 1000 && s.mv1RetrievalRows === 1000 && num(s.walkMs) <= num(s.mv1RetrievalMs) * 1.5 + 2000,
    {walkMs: s?.walkMs, mv1RetrievalMs: s?.mv1RetrievalMs, walkRows: s?.walkRows});
  const c = x => x?.waves ?? [];
  gate('LOAD_V1B_A_WAVE_EVALUATES_ABOUT_THE_WORKERS_IT_NOTIFIES_NOT_THE_PROFILES_OF_THE_SERVER',
    c(L.callsCapOff).length === 3 && c(L.callsCapOff).every(x => x.cheapCalls >= x.inserted && x.cheapCalls <= x.inserted + 5 && x.detailCalls >= x.inserted && x.detailCalls <= x.inserted + 5 && x.roomCalls === 0)
      && c(L.callsCapOff).map(x => x.inserted).join() === '300,1000,1000',
    {cap_off: c(L.callsCapOff).map(x => ({inserted: x.inserted, cheapCalls: x.cheapCalls, detailCalls: x.detailCalls, roomCalls: x.roomCalls, ms: x.ms}))});
  gate('LOAD_V1B_DAILY_CAP_PROBE_RUNS_ONLY_WHEN_THE_CAP_IS_ON_AND_SKIPPED_WORKERS_NEVER_REACH_THE_PREFILTER',
    c(L.callsCap3).every(x => x.roomCalls >= x.inserted) && c(L.callsCap1).length === 3 && c(L.callsCap1).every(x => x.inserted > 0 && x.roomCalls > x.inserted && x.cheapCalls <= x.inserted + 5)
      && L.callsCap1.deliveredToCappedWorkers === 0,
    {cap3: c(L.callsCap3).map(x => ({inserted: x.inserted, roomCalls: x.roomCalls, ms: x.ms})), cap1: c(L.callsCap1).map(x => ({inserted: x.inserted, roomCalls: x.roomCalls, cheapCalls: x.cheapCalls, ms: x.ms})),
      deliveredToCappedWorkers: L.callsCap1?.deliveredToCappedWorkers, workersWithANormalEventInTheLastDay: L.sizes?.workersWithANormalEventInTheLastDay});
  const m = L.capMicro, perCall = m?.calls ? m.ms / m.calls : 1e9;
  const planText = Array.isArray(L.capPlan) ? L.capPlan.join('\n') : String(L.capPlan);
  gate('LOAD_V1B_CAP_PROBE_IS_ONE_INDEX_RANGE_AND_COSTS_MICROSECONDS_PER_WORKER',
    perCall < 0.25 && /activity_[a-z_]*idx/.test(planText) && !/Seq Scan/.test(planText),
    {callsMeasured: m?.calls, totalMs: m?.ms, msPerCall: Math.round(perCall * 1000) / 1000, plan: L.capPlan});
  const off2 = c(L.callsCapOff)[1]?.ms, cap3_2 = c(L.callsCap3)[1]?.ms, cap1_2 = c(L.callsCap1)[1]?.ms;
  gate('LOAD_V1B_CAP_ADDS_LITTLE_TO_A_WAVE_OF_1000_AT_CAP_3_AND_STAYS_BOUNDED_AT_CAP_1',
    num(cap3_2) <= num(off2) * 1.3 + 500 && num(cap1_2) <= num(off2) * 1.6 + 1500,
    {secondWave1000Ms: {capOff: off2, cap3: cap3_2, cap1: cap1_2}});
  const ac = L.allCapped;
  gate('LOAD_V1B_WORST_CASE_EVERYBODY_AT_THE_CAP_VISITS_ALL_40000_PROFILES_IN_SECONDS_AND_NOTIFIES_NOBODY',
    ac?.ok === true && ac.status === 'STOPPED' && ac.reason === 'NO_ELIGIBLE_CANDIDATES' && ac.inserted === 0 && num(ac.ms) < 30000 && ac.counts?.deliveries === 0,
    {ms: ac?.ms, status: ac?.status, reason: ac?.reason});
  const rk = L.rareKind, mk = L.mv1?.rareKind;
  const rareFound = Math.floor(WORKERS / RARE_EVERY);
  gate('LOAD_V1B_A_TASK_FEW_WORKERS_FIT_FINDS_THEM_AND_THE_NEXT_CHECK_WALKS_ALL_PROFILES_IN_SECONDS_AND_THE_THIRD_ONLY_WAITS',
    rk?.ok === true && rk.inserted1 === rareFound && num(rk.ms1) < 45000 && rk.status2 === 'STOPPED' && rk.reason2 === 'NO_ELIGIBLE_CANDIDATES' && rk.inserted2 === 0 && num(rk.ms2) < 45000
      && rk.waiting3 === true && rk.inserted3 === 0 && num(rk.ms3) < 100,
    {found: rk?.inserted1, firstCheckMs: rk?.ms1, emptyCheckMs: rk?.ms2, waitingMs: rk?.ms3, matchV1Alone: mk?.ok ? {firstCheckMs: mk.ms1, repeatedCheckMs: mk.ms2} : null});
  const t = L.tick;
  gate('LOAD_V1B_A_TICK_OF_25_REMOTE_TASKS_WITH_40000_MATCHING_WORKERS_STAYS_WITHIN_ITS_TIME_BUDGET_AND_FINISHES_ITS_TASKS',
    t?.ok === true && t.tick1.claimed === TICK_TASKS && t.tick1.processed + t.tick1.deferred === t.tick1.claimed && t.tick1.failed === 0 && num(t.tick1.ms) < 70000
      && t.tick2.claimed === TICK_TASKS && t.tick2.processed + t.tick2.deferred === t.tick2.claimed && t.tick2.failed === 0 && num(t.tick2.ms) < 70000,
    {tick1: t?.tick1, tick2: t?.tick2, afterTick1: t?.afterTick1, afterTick2: t?.afterTick2});
  const pr = L.place;
  gate('LOAD_V1B_A_TASK_WITH_A_PLACE_KEEPS_THE_NEAREST_FIRST_PATH_AND_THE_CAP_ADDS_LITTLE',
    okAll(pr?.retrieval, pr?.waveCapOff, pr?.waveCap3) && pr.retrieval.mv1Rows === 1000 && pr.retrieval.twinNullRows === 1000 && pr.retrieval.twinCap3Rows === 1000 && pr.retrieval.twinCap1Rows === 1000
      && num(pr.retrieval.twinNullMs) <= num(pr.retrieval.mv1Ms) * 1.2 + 300 && num(pr.retrieval.twinCap3Ms) <= num(pr.retrieval.mv1Ms) * 1.5 + 600
      && pr.waveCapOff.inserted === 1000 && pr.waveCap3.inserted === 1000 && pr.waveCapOff.remote === null && pr.waveCap3.remote === null && num(pr.waveCap3.ms) <= num(pr.waveCapOff.ms) * 1.3 + 800,
    {retrieval: pr?.retrieval, waveCapOffMs: pr?.waveCapOff?.ms, waveCap3Ms: pr?.waveCap3?.ms, matchV1AloneRetrieval1000Ms: L.mv1?.placeRetrieval1000?.ms});
}
report.result = report.failures.length === 0 ? 'PASS' : 'FAIL';
write();

// ---------------------------------------------------------------- markdown summary for the job page
const f1 = v => (v === null || v === undefined) ? 'n/a' : (typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v));
const lines = [];
const wv = L.series?.waves ?? [];
lines.push('### MATCH-V1B load proof (disposable database, synthetic rows)', '',
  `Rows: ${f1(L.sizes?.activeWorkers)} active workers who all do kind of work A (${f1(L.sizes?.matchingKindB)} also kind B), ${f1(L.sizes?.workersWithPoint)} with an approximate point, ${f1(L.sizes?.draftProfiles)} draft profiles, ${f1(L.sizes?.events)} events (${f1(L.sizes?.workersWithANormalEventInTheLastDay)} workers have a new-task notification from the last 24 hours). Hard statement timeout ${HARD_S} s.`, '');
if (L.mv1?.oneWaveAtTheCeiling?.ok) {
  const x = L.mv1.oneWaveAtTheCeiling;
  lines.push(`MATCH-V1 alone, ceiling 10,000 (what a task without a place costs without this package): ONE wave notifies ${f1(x.inserted)} workers in ${f1(x.ms)} ms (${f1(x.counts?.deliveries)} deliveries, ${f1(x.counts?.events)} events, ${f1(x.counts?.notifications)} notification rows).`, '');
}
lines.push('Remote task in waves (MATCH-V1B), one rolled-back transaction, server time per wave:', '', '| wave | notified | total | ms | ms per worker |', '|---|---|---|---|---|');
for (const x of wv) lines.push(`| ${x.k} | ${f1(x.inserted)}${x.status === 'SENT' ? '' : ' (' + x.reason + ')'} | ${f1(x.total ?? x.before)} | ${f1(x.ms)} | ${x.inserted ? f1(x.ms / x.inserted) : 'n/a'} |`);
if (L.series?.counts) {
  const s = L.series, d = k => (s.sizesAfter?.[k] ?? 0) - (s.sizesBefore?.[k] ?? 0);
  lines.push('', `To the ceiling: ${f1(s.counts.deliveries)} deliveries, ${f1(s.counts.events)} events, ${f1(s.counts.notifications)} notification rows, ${f1(s.counts.rounds)} rounds (4 rows per worker + 1 per wave). Bytes added (tables + indexes): deliveries ${f1(d('deliveries'))}, events ${f1(d('events'))}, notifications ${f1(d('notifications'))}, rounds ${f1(d('rounds'))}: ${f1(Math.round((d('deliveries') + d('events') + d('notifications') + d('rounds')) / Math.max(s.counts.deliveries, 1)))} bytes per notified worker.`,
    `Retrieval of the next 1,000 with 10,000 already notified: MATCH-V1 function ${f1(s.mv1RetrievalMs)} ms, walk of this package ${f1(s.walkMs)} ms.`);
}
const cw = x => (x?.waves ?? []).map(w => `${w.inserted}: ${w.ms} ms, ${w.cheapCalls} prefilter, ${w.detailCalls} matcher, ${w.roomCalls} cap probes`).join('; ');
lines.push('', 'Calls per wave (first three waves; the cap off is the default):', '',
  `- cap off: ${cw(L.callsCapOff) || 'n/a'}`, `- cap 3: ${cw(L.callsCap3) || 'n/a'}`, `- cap 1 (${f1(L.sizes?.workersWithANormalEventInTheLastDay)} of ${f1(L.sizes?.activeWorkers)} workers at the cap): ${cw(L.callsCap1) || 'n/a'}; delivered to capped workers: ${f1(L.callsCap1?.deliveredToCappedWorkers)}`);
if (L.capMicro?.calls) lines.push('', `Cap probe by itself: ${f1(L.capMicro.calls)} calls in ${f1(L.capMicro.ms)} ms = ${f1(Math.round(L.capMicro.ms / L.capMicro.calls * 1000) / 1000)} ms per worker. Plan: ${(Array.isArray(L.capPlan) ? L.capPlan : []).slice(0, 8).join(' | ')}`);
if (L.allCapped?.ok) lines.push(`Everybody at the cap (worst case): ${f1(L.allCapped.ms)} ms, ${L.allCapped.reason}, ${f1(L.allCapped.inserted)} notified.`);
if (L.rareKind?.ok) lines.push(`Rare kind (${f1(L.rareKind.inserted1)} of ${f1(L.sizes?.workersTotal)} profiles fit): first check ${f1(L.rareKind.ms1)} ms, empty check ${f1(L.rareKind.ms2)} ms, immediate third check ${f1(L.rareKind.ms3)} ms (waiting). MATCH-V1 alone: ${f1(L.mv1?.rareKind?.ms1)} ms and ${f1(L.mv1?.rareKind?.ms2)} ms.`);
if (L.tick?.ok) lines.push(`Tick of ${TICK_TASKS} tasks: first waves ${f1(L.tick.tick1.ms)} ms (processed ${f1(L.tick.tick1.processed)}, deferred ${f1(L.tick.tick1.deferred)}), second waves ${f1(L.tick.tick2.ms)} ms (processed ${f1(L.tick.tick2.processed)}, deferred ${f1(L.tick.tick2.deferred)}).`);
if (L.place?.retrieval?.ok) lines.push(`Task with a place (nearest first, 1,000): MATCH-V1 ${f1(L.place.retrieval.mv1Ms)} ms, twin without cap ${f1(L.place.retrieval.twinNullMs)} ms, cap 3 ${f1(L.place.retrieval.twinCap3Ms)} ms, cap 1 ${f1(L.place.retrieval.twinCap1Ms)} ms; whole wave of 1,000: cap off ${f1(L.place.waveCapOff?.ms)} ms, cap 3 ${f1(L.place.waveCap3?.ms)} ms.`);
lines.push('', `Result: ${report.result}${report.failures.length ? ' - failures: ' + report.failures.map(x => x.name).join(', ') : ''}`);
fs.writeFileSync(path.join(out, 'v1b-load-summary.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
process.exitCode = report.result === 'PASS' ? 0 : 1;
