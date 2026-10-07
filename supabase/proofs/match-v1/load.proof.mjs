// MATCH-V1 + DISCOVERY-ZAMENE load proof: how fast are dispatch, matching, "Za mene" and the profile re-queue with many workers and tasks?
// Real database on the loopback only (never DEV). Synthetic rows are written with triggers off (no product writer creates bulk rows;
// the readers only read them) and labelled 'MV1 load' / 'MV1 disc' / 'MV1 draft'. Every measurement runs under its own statement_timeout
// (HARD_S) and in small chunks under a total budget: a timeout or an exhausted budget is RECORDED with the partial rows and milliseconds,
// never thrown away. A measurement of the NEW code that does not complete fails the run.
//
// States measured on the SAME rows:  OLD = the live DEV bodies;  OLD_TZ = the live bodies with ONLY the shared zone helper replaced
// (separates the zone fix from the rule rewrite);  NEW = MATCH-V1;  NEW_DZ = MATCH-V1 + DISCOVERY-ZAMENE.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {createFixtures} from '../ex06/lib/fixtures.mjs';

const {assert, sql, rows, q, ok, env} = rt;
const DB = env.DB_URL;
assert.equal(DB, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const M = 'supabase/candidates/match-v1-20261007/', D = 'supabase/candidates/discovery-zamene-20261007/';
const mManifest = JSON.parse(fs.readFileSync(M + 'manifest.json', 'utf8'));
const dManifest = JSON.parse(fs.readFileSync(D + 'manifest.json', 'utf8'));
const mPatches = JSON.parse(fs.readFileSync(M + 'patches.json', 'utf8'));
const mLive = JSON.parse(fs.readFileSync(M + 'live-functions.json', 'utf8'));
const out = env.MATCH_V1_ARTIFACT_DIR;
const md5 = text => createHash('md5').update(text).digest('hex');
const sleepSync = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const HARD_S = 90;       // statement_timeout of every single statement
const BUDGET_S = 180;    // total budget of one measurement family (all its chunks)
const WORKERS = 300, LOAD_TASKS = 100, DISC_TASKS = 900, DRAFTS = 3000;
const TZ = 'private.availability_timezone_valid(text)';
const tzOld = mLive.find(f => f.signature === TZ).body;
const tzNew = mPatches.find(p => p.signature === TZ).after;
const NIL = '00000000-0000-0000-0000-000000000000';
const report = {unit: 'MATCH-V1 load', result: 'RUNNING', sourceSha: env.GITHUB_SHA, disposableOnly: true, liveAccess: false, providerCalls: 0, pushSends: 0,
  statementTimeoutSeconds: HARD_S, budgetSeconds: BUDGET_S, checks: [], failures: [], load: {}};
const write = () => fs.writeFileSync(path.join(out, 'load-report.json'), JSON.stringify(report, null, 2) + '\n');
const pass = (name, detail) => { report.checks.push({name, result: 'PASS', ...(detail === undefined ? {} : {detail})}); write(); console.log('PASS ' + name); };
const fail = (name, detail) => { report.failures.push({name, detail}); write(); console.error('FAIL ' + name + ' ' + JSON.stringify(detail).slice(0, 600)); };

// ---------------------------------------------------------------- bounded SQL
function run(text, {timeoutS = HARD_S} = {}) {
  const started = Date.now();
  try {
    const output = execFileSync('psql', [DB, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'],
      {input: `set statement_timeout='${timeoutS}s';\nset lock_timeout='5s';\n${text}`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: (timeoutS + 30) * 1000, maxBuffer: 1 << 24}).trim();
    return {ok: true, output, wallMs: Date.now() - started};
  } catch (error) {
    const detail = String(error.stderr ?? '') + String(error.message ?? '');
    return {ok: false, timedOut: /statement timeout|canceling statement|ETIMEDOUT/i.test(detail), error: detail.slice(-500), wallMs: Date.now() - started};
  }
}
const lastLine = text => text.split('\n').filter(Boolean).at(-1);
// A DO block that times its inner SQL on the server clock and hands {ms, n, m} back through a session setting.
const timedBlock = inner => `do $t$ declare t0 timestamptz:=clock_timestamp(); n bigint:=0; m bigint:=0; begin ${inner}
  perform set_config('mv1.last', jsonb_build_object('ms', round((extract(epoch from clock_timestamp()-t0)*1000)::numeric,1), 'n', n, 'm', m)::text, false); end $t$;
select current_setting('mv1.last');`;
function timed(inner, {timeoutS = HARD_S, before = '', rollback = false} = {}) {
  const r = run((rollback ? 'begin;\n' : '') + before + timedBlock(inner) + (rollback ? '\nrollback;' : ''), {timeoutS});
  return r.ok ? {ok: true, ...JSON.parse(lastLine(r.output)), wallMs: r.wallMs} : r;
}
/**
 * One measurement = a list of chunks, each its own statement under the hard timeout, all under one total budget.
 * unit 'pair' / 'call': milliseconds per row counted in n; unit 'task': milliseconds per finished chunk.
 */
function chunked(label, unit, items, makeInner, {budgetS = BUDGET_S, rollback = false, before = ''} = {}) {
  const started = Date.now();
  const res = {label, unit, chunksPlanned: items.length, chunksDone: 0, n: 0, m: 0, ms: 0, timedOut: false, budgetExhausted: false, error: null};
  for (const item of items) {
    const left = budgetS - (Date.now() - started) / 1000;
    if (left <= 1) { res.budgetExhausted = true; break; }
    const r = timed(makeInner(item), {timeoutS: Math.min(HARD_S, Math.ceil(left) + 5), rollback, before});
    if (!r.ok) { res.timedOut = r.timedOut; res.error = r.error; break; }
    res.chunksDone += 1; res.n += r.n; res.m += r.m; res.ms += r.ms;
  }
  res.complete = res.chunksDone === res.chunksPlanned && !res.timedOut && !res.budgetExhausted;
  res.wallMs = Date.now() - started;
  const base = unit === 'task' ? res.chunksDone : res.n;
  res.msPerUnit = base > 0 ? Math.round(res.ms / base * 100) / 100 : null;
  return res;
}
const brief = r => ({complete: r.complete, timedOut: r.timedOut, budgetExhausted: r.budgetExhausted, chunks: `${r.chunksDone}/${r.chunksPlanned}`,
  n: r.n, matched: r.m, ms: Math.round(r.ms), msPerUnit: r.msPerUnit, unit: r.unit, ...(r.error ? {error: r.error} : {})});

// ---------------------------------------------------------------- state changes
const swapZoneHelper = (from, to) => {
  const r = run(`do $s$ declare o oid:=to_regprocedure(${q(TZ)}); body text; def text; begin
    select prosrc into body from pg_proc where oid=o;
    if md5(body) is distinct from ${q(md5(from))} then raise exception 'SWAP_PREIMAGE_DRIFT'; end if;
    def:=pg_get_functiondef(o); execute replace(def, body, $swap$${to}$swap$);
    if (select md5(prosrc) from pg_proc where oid=o) is distinct from ${q(md5(to))} then raise exception 'SWAP_POSTIMAGE_DRIFT'; end if;
  end $s$;`);
  assert.ok(r.ok, 'SWAP_FAILED:' + r.error);
};
const applyFile = file => { const r = run(fs.readFileSync(file, 'utf8'), {timeoutS: 180}); assert.ok(r.ok, 'APPLY_FAILED:' + file + ':' + r.error); };
const bodyMd5 = signature => sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${q(signature)})`);
const catalog = () => sql(`select md5(string_agg(p.oid::regprocedure::text||':'||md5(p.prosrc)||':'||((to_jsonb(p)-'prosrc'-'oid')::text)||':'||coalesce(obj_description(p.oid,'pg_proc'),''),E'\\n' order by p.oid::regprocedure::text))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')`);
const closure = () => rows(`select private.closure_source_digest_v5() as digest,private.closure_erasure_program_digest_v5() as program,
  (select sha256 from private.closure_source_v5 where singleton) as certificate,private.retention_ai_source_ready() as ready`)[0];

// ---------------------------------------------------------------- synthetic rows
const POOL = "array['fizicki poslovi','selidba','ciscenje stana','montaza namestaja','sitne popravke','molerski radovi','dostava','uredjenje baste','mv1-load-a','mv1-load-b']";
function needsInsert(R, category, count, spread) {
  return `insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,required_tools,required_vehicles,
    required_licenses,minimum_experience_years,verified_identity_required,approximate_city,approximate_area,approximate_lat,approximate_lng,mode,required_slots,
    schedule_kind,starts_at,ends_at,execution_location_mode,task_country_code,task_timezone,response_deadline,published_at)
   select gen_random_uuid(),${q(R.id)}::uuid,${q(R.profileId)}::uuid,'PUBLISHED','${category} '||g,'Sinteticki zadatak za merenje brzine.','${category}',
    array[(${POOL})[1+(g%10)]],'{}','{}','{}',0,false,'Novi Sad','',
    round((45.27+((g*29)%${spread * 2}-${spread})/100.0)::numeric,2),round((19.83+((g*41)%${spread * 2}-${spread})/100.0)::numeric,2),'OFFERS',1,
    (array['FLEXIBLE','FLEXIBLE','TODAY_FLEXIBLE','FIXED_WINDOW','FLEXIBLE'])[1+(g%5)],
    case when g%5=3 then date_trunc('hour',statement_timestamp())+interval '2 days 10 hours' end,
    case when g%5=3 then date_trunc('hour',statement_timestamp())+interval '2 days 12 hours' end,
    'STATIONARY','RS','Europe/Belgrade',statement_timestamp()+interval '2 days',statement_timestamp()
   from generate_series(1,${count}) g;`;
}
function seed(R) {
  const r = run(`begin; set local session_replication_role=replica;
  create temporary table mv1_w on commit drop as select gen_random_uuid() as account_id, gen_random_uuid() as profile_id, g as i from generate_series(1,${WORKERS}) g;
  insert into public.app_accounts(id,email) select account_id,'mv1-load-'||i||'@proof.invalid' from mv1_w;
  insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,radius_km,available_now)
   select profile_id,account_id,'WORKER','MV1 load '||i,'Novi Sad','ACTIVE',array[(${POOL})[1+(i%10)]],(array[10,15,25,50])[1+(i%4)],i%2=0 from mv1_w;
  insert into public.worker_match_preferences(worker_profile_id,worker_account_id,approximate_lat,approximate_lng)
   select profile_id,account_id,round((45.27+((i*37)%80-40)/100.0)::numeric,2),round((19.83+((i*53)%80-40)/100.0)::numeric,2) from mv1_w;
  insert into public.profile_availability_rules(profile_id,weekdays,start_time,end_time,starts_on,label)
   select profile_id,array[0,1,2,3,4,5,6],'08:00','20:00',case when i=1 then date '2015-01-01' when i=2 then current_date else date '2026-01-01' end,'MV1 load'
   from mv1_w where i%3<>0 or i<=2;
  create temporary table mv1_d on commit drop as select gen_random_uuid() as account_id, gen_random_uuid() as profile_id, g as i from generate_series(1,${DRAFTS}) g;
  insert into public.app_accounts(id,email) select account_id,'mv1-draft-'||i||'@proof.invalid' from mv1_d;
  insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status) select profile_id,account_id,'WORKER','MV1 draft '||i,'Novi Sad','DRAFT' from mv1_d;
  ${needsInsert(R, 'MV1 load', LOAD_TASKS, 30)}
  ${needsInsert(R, 'MV1 disc', DISC_TASKS, 100)}
  commit;
  analyze public.app_accounts; analyze public.app_profiles; analyze public.worker_match_preferences; analyze public.profile_availability_rules; analyze public.needs;`, {timeoutS: 180});
  assert.ok(r.ok, 'SEED_FAILED:' + r.error);
  return JSON.parse(lastLine(run(`select jsonb_build_object('workerProfiles',(select count(*) from public.app_profiles where kind='WORKER'),
    'activeWorkers',(select count(*) from public.app_profiles where kind='WORKER' and profile_status='ACTIVE'),
    'draftProfiles',(select count(*) from public.app_profiles where kind='WORKER' and profile_status<>'ACTIVE'),
    'workersWithPoint',(select count(*) from public.worker_match_preferences where approximate_geog is not null),
    'weeklyRules',(select count(*) from public.profile_availability_rules),
    'loadTasks',(select count(*) from public.needs where category='MV1 load'),'discoveryTasks',(select count(*) from public.needs where category='MV1 disc'),
    'openTasks',(select count(*) from public.needs where status in ('PUBLISHED','SELECTION') and published_at is not null),
    'tasksWithoutPoint',(select count(*) from public.needs where category like 'MV1 %' and approx_geog is null))`).output));
}
const loadTasks = () => rows(`select id from public.needs where category='MV1 load' order by id`).map(r => r.id);
const workerSet = (limit, offset = 0) => `(select id from public.app_profiles where display_name like 'MV1 load %' and kind='WORKER' order by id limit ${limit} offset ${offset}) p`;

// ---------------------------------------------------------------- measurements of one state
function measureState(key, tasks, {workersPerChunk, taskCount, detailedTasks, ruleTasks = 0, slowTask}) {
  const set = {};
  const chunksFor = ts => ts.flatMap(t => Array.from({length: Math.ceil(WORKERS / workersPerChunk)}, (_, k) => [t, k * workersPerChunk]));
  const pair = (label, fn, ts) => chunked(label, 'pair', chunksFor(ts), ([t, off]) =>
    `select count(*), count(*) filter (where ${fn('t.id', 'p.id')}) into n, m from (select ${q(t)}::uuid as id) t cross join ${workerSet(workersPerChunk, off)};`);
  set.prefilter = brief(pair('prefilter', (a, b) => `private.dispatch_cheap_candidate_admitted(${a},${b})`, tasks.slice(0, taskCount)));
  set.detailed = brief(pair('detailed matcher', (a, b) => `(private.match_detail(${a},${b})->>'dispatchEligible')::boolean`, tasks.slice(0, detailedTasks)));
  if (ruleTasks) set.rule = brief(pair('rule', (a, b) => `private.worker_need_match_v1(${a},${b})`, tasks.slice(0, ruleTasks)));
  set.retrieval = brief(chunked('candidate retrieval (40)', 'task', tasks.slice(0, taskCount),
    t => `select count(*) into n from private.candidate_profile_ids(${q(t)}::uuid, 40); m:=n;`));
  set.wave = brief(chunked('one dispatch wave (rolled back)', 'task', tasks.slice(0, taskCount),
    t => `n:=coalesce((private.dispatch_next_wave(${q(t)}::uuid)->>'inserted')::bigint,0);`, {rollback: true}));
  set.retrievalSlowTask = brief(chunked('retrieval of a task few workers fit', 'task', [slowTask],
    t => `select count(*) into n from private.candidate_profile_ids(${q(t)}::uuid, 40); m:=n;`));
  report.load[key] = {...(report.load[key] ?? {}), ...set}; write();
  return set;
}
/** Function-level profile (track_functions) of one workload: where the time goes, by self time, and how often the named functions ran. */
function profile(label, inner) {
  run('select pg_stat_reset();');
  const r = run(`set track_functions='all';
${timedBlock(inner)}`);
  sleepSync(1500);   // the backend flushes its function statistics when it exits
  const top = run(`select coalesce(jsonb_agg(x),'[]'::jsonb) from (select funcname, calls, round(total_time::numeric,1) as total_ms, round(self_time::numeric,1) as self_ms
    from pg_stat_user_functions order by self_time desc limit 12) x;`);
  const named = run(`select coalesce(jsonb_object_agg(funcname, jsonb_build_object('calls', calls, 'total_ms', round(total_time::numeric,1), 'self_ms', round(self_time::numeric,1))),'{}'::jsonb)
    from pg_stat_user_functions where funcname in ('dispatch_cheap_candidate_admitted','worker_dispatch_time_admitted','availability_timezone_valid','work_kinds_v5',
      'worker_need_fit_v1','worker_need_time_tier_v1','worker_need_match_v1','match_detail','match_detail_without_calendar','lower_arr','accounts_same_world');`);
  return {label, workload: r.ok ? JSON.parse(lastLine(r.output)) : {error: r.error}, top: top.ok ? JSON.parse(lastLine(top.output)) : {error: top.error},
    named: named.ok ? JSON.parse(lastLine(named.output)) : {error: named.error}};
}
const callsOf = (prof, name) => prof?.named?.[name]?.calls ?? 0;
const microZone = calls => brief(chunked('zone helper', 'call', [1], () =>
  `select count(*) into n from generate_series(1,${calls}) g where private.availability_timezone_valid(case when g>0 then 'Europe/Belgrade' end); m:=n;`));
const microPeriods = (workerId, calls) => brief(chunked('worker_available_periods', 'pair', [workerId], w =>
  `select count(*), count(*) filter (where private.worker_available_periods(${q(w)}::uuid, ts.t, ts.t + interval '2 hours', 'Europe/Belgrade') <> '{}'::tstzmultirange)
   into n, m from (select statement_timestamp() + interval '2 days' + (g||' minutes')::interval as t from generate_series(1,${calls}) g) ts;`));
function prefilterPlan(needId, profileId) {
  const body = sql(`select prosrc from pg_proc where oid=to_regprocedure('private.dispatch_cheap_candidate_admitted(uuid,uuid)')`);
  const query = body.replace(/--[^\n]*/g, '').replace(/\bnid\b/g, q(needId) + '::uuid').replace(/\bpid\b/g, q(profileId) + '::uuid');
  const r = run(`explain (analyze, costs off, timing off, summary off) ${query}`);
  return r.ok ? r.output.split('\n').filter(line => /One-Time Filter|Join Filter|Filter:|Result|Index/.test(line)).map(line => line.trim()).slice(0, 10) : r.error;
}

// ---------------------------------------------------------------- Za mene: SQL time as an authenticated viewer
function discoveryMs(viewerId, request) {
  const claims = JSON.stringify({sub: viewerId, role: 'authenticated'});
  const r = run(`begin;
    select set_config('request.jwt.claims', ${q(claims)}, true);
    select set_config('request.jwt.claim.sub', ${q(viewerId)}, true);
    set local role authenticated;
    do $t$ declare t0 timestamptz; r jsonb; begin t0:=clock_timestamp(); r:=public.rpc_discovery_v1(${q(JSON.stringify(request))}::jsonb);
      perform set_config('mv1.last', jsonb_build_object('ms', round((extract(epoch from clock_timestamp()-t0)*1000)::numeric,1),
        'n', coalesce(jsonb_array_length(r->'items'), jsonb_array_length(r->'buckets'), 0),
        'counted', coalesce((r#>>'{counts,listed}')::bigint,(r#>>'{counts,mapped}')::bigint,0))::text, false); end $t$;
    select current_setting('mv1.last');
    rollback;`);
  return r.ok ? JSON.parse(lastLine(r.output)) : {error: r.error, timedOut: r.timedOut};
}
const FILTER = {text: '', price: 'all', where: 'any', places: 1, when: 'any', dates: null, place: null};
const BOUNDS = [18, 42, 23, 47];
function discoveryAt(viewerId, label) {
  const median = request => {
    const runs = [0, 1, 2].map(() => discoveryMs(viewerId, request));
    if (runs.some(r => r.error)) return runs.find(r => r.error);
    const ms = runs.map(r => r.ms).sort((a, b) => a - b);
    return {medianMs: ms[1], maxMs: ms[2], rows: runs.at(-1).n, counted: runs.at(-1).counted};
  };
  const result = {
    openTasks: Number(sql(`select count(*) from public.needs where status in ('PUBLISHED','SELECTION') and published_at is not null`)),
    pageDefault: median({mode: 'PAGE', filter: FILTER, anchor: null, scope: {kind: 'ALL'}, limit: 100, after: null}),
    pageForMe: median({mode: 'PAGE', filter: {...FILTER, forMe: true}, anchor: null, scope: {kind: 'ALL'}, limit: 100, after: null}),
    mapDefault: median({mode: 'MAP', filter: FILTER, anchor: null, bounds: BOUNDS, grid: 12}),
    mapForMe: median({mode: 'MAP', filter: {...FILTER, forMe: true}, anchor: null, bounds: BOUNDS, grid: 12}),
  };
  report.load.discovery = {...(report.load.discovery ?? {}), [label]: result}; write();
  return result;
}
const setDiscStatus = status => assert.ok(run(`set session_replication_role=replica; update public.needs set status='${status}' where category='MV1 disc';`).ok, 'DISC_STATUS_FAILED');

// ---------------------------------------------------------------- the run
const fx = createFixtures(rt, {needPath: 'direct'});
let state = 'OLD';
let baseCatalog = null, baseClosure = null;
const section = (name, fn) => {
  try { return fn(); } catch (error) { fail(name, String(error?.stack ?? error).slice(0, 800)); return null; }
};
try {
  fx.pauseSchedulers();
  baseCatalog = catalog(); baseClosure = closure();
  assert.equal(baseClosure.ready, true);
  for (const f of mManifest.functions) assert.equal(bodyMd5(f.signature), f.before_md5, 'PREDECESSOR:' + f.signature);
  assert.equal(bodyMd5(dManifest.functions[0].signature), dManifest.functions[0].before_md5);
  const R = await fx.createRequester({label: 'mv1-load-requester'});
  const viewer = await fx.createWorker({label: 'mv1-load-viewer', skills: ['fizicki poslovi'], radiusKm: 25, location: {city: 'Novi Sad'},
    availability: {timezone: 'Europe/Belgrade', availableNow: true, rules: [], windows: []}});
  report.load.sizes = seed(R); write();
  pass('MATCH_V1_LOAD_ROWS_SEEDED_AND_ANALYZED', report.load.sizes);
  const tasks = loadTasks();
  const slowTask = sql(`select id from public.needs where category='MV1 load' and required_skills=array['mv1-load-a'] order by id limit 1`);
  const draftProfile = sql(`select id from public.app_profiles where kind='WORKER' and profile_status<>'ACTIVE' and display_name like 'MV1 draft %' order by id limit 1`);
  const ageWorkers = rows(`select p.id, r.starts_on::text as starts_on from public.app_profiles p join public.profile_availability_rules r on r.profile_id=p.id
    where p.display_name in ('MV1 load 1','MV1 load 2') order by p.display_name`);
  const sample = {taskCount: 5, detailedTasks: 5, slowTask};
  const retrievalOf = task => `select count(*) into n from private.candidate_profile_ids(${q(task)}::uuid, 40); m:=n;`;

  // ---- OLD: the live bodies. Small sample; every statement is bounded and chunked by 25 workers.
  section('OLD', () => {
    report.load.OLD = {zoneHelper: microZone(5)};
    measureState('OLD', tasks, {workersPerChunk: 25, taskCount: 1, detailedTasks: 1, slowTask});
    report.load.OLD.prefilterPlanForDraftProfile = prefilterPlan(tasks[0], draftProfile);
    report.load.OLD.profileRetrievalSlowTask = profile('OLD retrieval of one task', retrievalOf(slowTask));
    write();
  });

  // ---- OLD_TZ: the live bodies with ONLY the shared zone helper replaced.
  section('OLD_TZ', () => {
    swapZoneHelper(tzOld, tzNew); state = 'OLD_TZ';
    report.load.OLD_TZ = {zoneHelper: microZone(2000)};
    measureState('OLD_TZ', tasks, {workersPerChunk: WORKERS, ...sample});
    report.load.OLD_TZ.profileRetrievalSlowTask = profile('OLD_TZ retrieval of one task', retrievalOf(slowTask));
    report.load.OLD_TZ.profileDetailed = profile('OLD_TZ detailed matcher, 1 task x all workers',
      `select count(*) into n from ${workerSet(WORKERS)} where (private.match_detail(${q(tasks[0])}::uuid, p.id)->>'dispatchEligible')::boolean is not null;`);
    report.load.OLD_TZ.ageOfRule = {old2015: microPeriods(ageWorkers[0].id, 300), startsToday: microPeriods(ageWorkers[1].id, 300), rows: ageWorkers};
    swapZoneHelper(tzNew, tzOld); state = 'OLD';
    write();
  });
  if (state === 'OLD_TZ') { swapZoneHelper(tzNew, tzOld); state = 'OLD'; }

  // ---- NEW: MATCH-V1.
  section('NEW', () => {
    applyFile(M + 'candidate.sql'); state = 'NEW';
    for (const f of mManifest.functions) assert.equal(bodyMd5(f.signature), f.after_md5, 'POSTIMAGE:' + f.signature);
    assert.deepEqual(closure(), baseClosure);
    report.load.NEW = {zoneHelper: microZone(2000)};
    measureState('NEW', tasks, {workersPerChunk: WORKERS, taskCount: LOAD_TASKS, detailedTasks: 20, ruleTasks: LOAD_TASKS, slowTask});
    measureState('NEW_SAME_SAMPLE', tasks, {workersPerChunk: WORKERS, ...sample});   // the very pairs and tasks OLD_TZ measured
    report.load.NEW.prefilterPlanForDraftProfile = prefilterPlan(tasks[0], draftProfile);
    report.load.NEW.profileRetrievalSlowTask = profile('NEW retrieval of one task', retrievalOf(slowTask));
    report.load.NEW.profileDetailed = profile('NEW detailed matcher, 1 task x all workers',
      `select count(*) into n from ${workerSet(WORKERS)} where (private.match_detail(${q(tasks[0])}::uuid, p.id)->>'dispatchEligible')::boolean is not null;`);
    report.load.NEW.profileRule = profile('NEW rule, 5 tasks x all workers',
      `select count(*) into n from (select id from public.needs where category='MV1 load' order by id limit 5) t cross join ${workerSet(WORKERS)} where private.worker_need_match_v1(t.id, p.id);`);
    report.load.NEW.ageOfRule = {old2015: microPeriods(ageWorkers[0].id, 300), startsToday: microPeriods(ageWorkers[1].id, 300)};
    // Profile re-queue. Idle = no profile newer than the watermark (the watermark sits at the newest profile); a full batch = the cap of 100 profiles.
    run(`delete from private.dispatch_schedule;
      update private.marketplace_config set value=jsonb_build_object('after',(select max(updated_at) from public.app_profiles),'afterAccount','ffffffff-ffff-ffff-ffff-ffffffffffff')
       where key='match_v1_profile_requeue';`);
    report.load.NEW.requeueIdle = brief(chunked('requeue, nothing changed', 'call', [1], () =>
      `for i in 1..20 loop perform private.requeue_changed_worker_profiles_v1(statement_timestamp()); end loop; n:=20; m:=n;`));
    // Every seeded worker profile is older than 30 seconds: with the watermark before them, one call handles a FULL batch (the cap of 100 profiles).
    report.load.NEW.requeueFullBatch = brief(chunked('requeue, a full batch of 100 changed profiles', 'task', [1], () =>
      `select coalesce((x->>'queued')::bigint,0), coalesce((x->>'profiles')::bigint,0) into n, m from (select private.requeue_changed_worker_profiles_v1(statement_timestamp()) as x) s;`,
      {rollback: true, before: `update private.marketplace_config set value=jsonb_build_object('after',(select min(updated_at) from public.app_profiles where display_name like 'MV1 load %')-interval '1 second','afterAccount','${NIL}')
         where key='match_v1_profile_requeue';
`}));
    report.load.NEW.tickEmptyQueue = brief(chunked('dispatch tick, empty queue', 'call', [1], () =>
      `for i in 1..5 loop perform private.dispatch_tick(25, statement_timestamp()); end loop; n:=5; m:=n;`));
    write();
  });

  // ---- NEW_DZ: "Za mene" at 100 and at 1000 open tasks.
  section('NEW_DZ', () => {
    applyFile(D + 'candidate.sql'); state = 'NEW_DZ';
    assert.deepEqual(closure(), baseClosure);
    setDiscStatus('DRAFT');
    discoveryAt(viewer.id, 'open100');
    setDiscStatus('PUBLISHED');
    discoveryAt(viewer.id, 'open1000');
  });
  // the same requests end to end through PostgREST (Auth + HTTP), as the app sends them
  if (state === 'NEW_DZ') {
    try {
      report.load.discovery = {...(report.load.discovery ?? {}), http: {}};
      const http = async (label, request) => {
        const runs = [];
        for (let i = 0; i < 3; i++) { const started = Date.now(); await ok(viewer.client.rpc('rpc_discovery_v1', {p_request: request})); runs.push(Date.now() - started); }
        report.load.discovery.http[label] = runs.sort((a, b) => a - b)[1];
      };
      await http('pageDefault@1000', {mode: 'PAGE', filter: FILTER, anchor: null, scope: {kind: 'ALL'}, limit: 100, after: null});
      await http('pageForMe@1000', {mode: 'PAGE', filter: {...FILTER, forMe: true}, anchor: null, scope: {kind: 'ALL'}, limit: 100, after: null});
      write();
    } catch (error) { fail('DISCOVERY_HTTP', String(error).slice(0, 400)); }
  }
} catch (error) {
  fail('LOAD_SETUP', String(error?.stack ?? error).slice(0, 1000));
} finally {
  // exact reverts, whatever happened above
  try {
    if (state === 'NEW_DZ') { applyFile(D + 'revert.sql'); state = 'NEW'; }
    if (state === 'NEW') { applyFile(M + 'revert.sql'); state = 'OLD'; }
    if (state === 'OLD_TZ') { swapZoneHelper(tzNew, tzOld); state = 'OLD'; }
  } catch (error) { fail('REVERT', String(error).slice(0, 500)); }
  try {
    if (baseCatalog) { assert.equal(catalog(), baseCatalog); assert.deepEqual(closure(), baseClosure); pass('MATCH_V1_LOAD_STATES_REVERTED_CATALOG_AND_CERTIFICATE_RESTORED'); }
  } catch (error) { fail('REVERT_STATE', String(error).slice(0, 500)); }
}

// ---------------------------------------------------------------- verdict, honest: the NEW code must finish every measurement and be fast
const L = report.load;
const per = (key, name) => L[key]?.[name]?.msPerUnit ?? null;
const gate = (name, good, detail) => { if (good) pass(name, detail); else fail(name, detail); };
const complete = (key, names) => names.every(name => L[key]?.[name]?.complete === true);
if (L.NEW) {
  gate('LOAD_NEW_EVERY_MEASUREMENT_COMPLETED_WITHIN_THE_HARD_TIMEOUT',
    complete('NEW', ['prefilter', 'detailed', 'rule', 'retrieval', 'wave', 'retrievalSlowTask']) && complete('NEW_SAME_SAMPLE', ['prefilter', 'detailed', 'retrieval', 'wave']),
    Object.fromEntries(['prefilter', 'detailed', 'rule', 'retrieval', 'wave'].map(k => [k, `${L.NEW[k]?.chunks} timedOut=${L.NEW[k]?.timedOut} budget=${L.NEW[k]?.budgetExhausted}`])));
  gate('LOAD_NEW_ZONE_HELPER_IS_NOT_A_CATALOG_SCAN', (L.NEW.zoneHelper?.msPerUnit ?? 99) < 2, {newMsPerCall: L.NEW.zoneHelper?.msPerUnit, oldMsPerCall: L.OLD?.zoneHelper?.msPerUnit});
  gate('LOAD_NEW_PREFILTER_AND_MATCHER_PER_PAIR_MILLISECONDS', (per('NEW', 'prefilter') ?? 99) < 3 && (per('NEW', 'detailed') ?? 99) < 6,
    {prefilter: per('NEW', 'prefilter'), detailed: per('NEW', 'detailed'), rule: per('NEW', 'rule')});
  gate('LOAD_NEW_RETRIEVAL_AND_WAVE_PER_TASK_MILLISECONDS', (per('NEW', 'retrieval') ?? 99999) < 1000 && (per('NEW', 'wave') ?? 99999) < 2000,
    {retrieval: per('NEW', 'retrieval'), wave: per('NEW', 'wave')});
  if (L.OLD_TZ?.prefilter?.complete && L.OLD_TZ?.detailed?.complete) {
    gate('LOAD_NEW_IS_NOT_SLOWER_THAN_THE_OLD_RULE_WITH_THE_SAME_ZONE_FIX_ON_THE_SAME_PAIRS',
      (per('NEW_SAME_SAMPLE', 'prefilter') ?? 99) <= per('OLD_TZ', 'prefilter') * 1.25 + 0.3 && (per('NEW_SAME_SAMPLE', 'detailed') ?? 99) <= per('OLD_TZ', 'detailed') * 1.25 + 0.3,
      {oldWithZoneFix: {prefilter: per('OLD_TZ', 'prefilter'), detailed: per('OLD_TZ', 'detailed')}, new: {prefilter: per('NEW_SAME_SAMPLE', 'prefilter'), detailed: per('NEW_SAME_SAMPLE', 'detailed')}});
  }
  const draftVisitsNew = callsOf(L.NEW.profileRetrievalSlowTask, 'dispatch_cheap_candidate_admitted');
  gate('LOAD_NEW_RETRIEVAL_VISITS_NO_DRAFT_PROFILES', draftVisitsNew > 0 && draftVisitsNew <= WORKERS + 5,
    {cheapCallsNew: draftVisitsNew, cheapCallsOld: callsOf(L.OLD?.profileRetrievalSlowTask, 'dispatch_cheap_candidate_admitted'), activeWorkers: WORKERS, draftProfiles: DRAFTS});
  gate('LOAD_REQUEUE_IDLE_AND_A_FULL_BATCH_ARE_CHEAP',
    L.NEW.requeueIdle?.complete && L.NEW.requeueIdle.msPerUnit < 250 && L.NEW.requeueFullBatch?.complete && L.NEW.requeueFullBatch.ms < 3000,
    {idleMsPerCall: L.NEW.requeueIdle?.msPerUnit, fullBatchMs: L.NEW.requeueFullBatch?.ms, fullBatchQueued: L.NEW.requeueFullBatch?.n, fullBatchProfiles: L.NEW.requeueFullBatch?.matched, tickEmptyQueueMsFor5: L.NEW.tickEmptyQueue?.ms});
}
if (L.discovery?.open1000) {
  const d = L.discovery.open1000;
  gate('LOAD_FOR_ME_READ_AT_1000_OPEN_TASKS', !d.pageForMe?.error && d.pageForMe.medianMs < 5000 && !d.mapForMe?.error && d.mapForMe.medianMs < 5000,
    {pageDefault: d.pageDefault?.medianMs, pageForMe: d.pageForMe?.medianMs, mapDefault: d.mapDefault?.medianMs, mapForMe: d.mapForMe?.medianMs, at100: L.discovery.open100, http: L.discovery.http});
}
report.result = report.failures.length === 0 ? 'PASS' : 'FAIL';
write();

// ---------------------------------------------------------------- markdown summary for the job page
const f1 = v => (v === null || v === undefined) ? 'n/a' : (typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v));
const cell = (key, name) => {
  const r = L[key]?.[name];
  return r ? `${f1(r.msPerUnit)}${r.complete ? '' : ` (partial ${r.chunks}${r.timedOut ? ', statement timeout' : ''}${r.budgetExhausted ? ', budget' : ''})`}` : 'n/a';
};
const disc = k => { const d = L.discovery?.[k]; return d ? `| ${f1(d.openTasks)} open tasks | ${f1(d.pageDefault?.medianMs)} ms | ${f1(d.pageForMe?.medianMs)} ms (${f1(d.pageForMe?.counted)} match) | ${f1(d.mapDefault?.medianMs)} ms | ${f1(d.mapForMe?.medianMs)} ms |` : `| ${k} | n/a | n/a | n/a | n/a |`; };
const lines = [
  '### MATCH-V1 load proof (disposable database, synthetic rows)', '',
  `Rows: ${f1(L.sizes?.activeWorkers)} active workers, ${f1(L.sizes?.draftProfiles)} draft profiles, ${f1(L.sizes?.loadTasks)} dispatch tasks, ${f1(L.sizes?.openTasks)} open tasks in all. Hard statement timeout ${HARD_S} s per statement, budget ${BUDGET_S} s per measurement.`, '',
  '| measure | unit | OLD (live DEV bodies) | OLD + zone fix only | NEW (MATCH-V1) |', '|---|---|---|---|---|',
  `| zone helper | ms/call | ${cell('OLD', 'zoneHelper')} | ${cell('OLD_TZ', 'zoneHelper')} | ${cell('NEW', 'zoneHelper')} |`,
  `| prefilter (notification) | ms/pair | ${cell('OLD', 'prefilter')} | ${cell('OLD_TZ', 'prefilter')} | ${cell('NEW_SAME_SAMPLE', 'prefilter')} (same pairs), ${cell('NEW', 'prefilter')} (all) |`,
  `| detailed matcher | ms/pair | ${cell('OLD', 'detailed')} | ${cell('OLD_TZ', 'detailed')} | ${cell('NEW_SAME_SAMPLE', 'detailed')} (same pairs), ${cell('NEW', 'detailed')} (20 tasks) |`,
  `| shared rule ("Za mene") | ms/pair | n/a | n/a | ${cell('NEW', 'rule')} |`,
  `| candidate retrieval (40) | ms/task | ${cell('OLD', 'retrieval')} | ${cell('OLD_TZ', 'retrieval')} | ${cell('NEW_SAME_SAMPLE', 'retrieval')} (same tasks), ${cell('NEW', 'retrieval')} (${f1(L.NEW?.retrieval?.chunks)}) |`,
  `| one wave, rolled back | ms/task | ${cell('OLD', 'wave')} | ${cell('OLD_TZ', 'wave')} | ${cell('NEW_SAME_SAMPLE', 'wave')} (same tasks), ${cell('NEW', 'wave')} (${f1(L.NEW?.wave?.chunks)}) |`,
  `| retrieval, a task few workers fit | ms/task | ${cell('OLD', 'retrievalSlowTask')} | ${cell('OLD_TZ', 'retrievalSlowTask')} | ${cell('NEW', 'retrievalSlowTask')} |`,
  '', '| profile re-queue and tick (NEW) | ms |', '|---|---|',
  `| re-queue, nothing changed | ${cell('NEW', 'requeueIdle')} per call |`, `| re-queue, a full batch of 100 changed profiles | ${f1(L.NEW?.requeueFullBatch?.ms)} (queued ${f1(L.NEW?.requeueFullBatch?.n)}) |`,
  `| dispatch tick, empty queue | ${f1(L.NEW?.tickEmptyQueue?.ms)} for 5 ticks |`,
  '', '| "Za mene" read (SQL, authenticated role, median of 3) | PAGE default | PAGE forMe | MAP default | MAP forMe |', '|---|---|---|---|---|',
  disc('open100'), disc('open1000'),
  '', `Through PostgREST at 1000 open tasks (median of 3): PAGE default ${f1(L.discovery?.http?.['pageDefault@1000'])} ms, PAGE forMe ${f1(L.discovery?.http?.['pageForMe@1000'])} ms.`,
  '', `Result: ${report.result}${report.failures.length ? ' — failures: ' + report.failures.map(x => x.name).join(', ') : ''}`,
];
fs.writeFileSync(path.join(out, 'load-summary.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
process.exitCode = report.result === 'PASS' ? 0 : 1;
