// DISCOVERY-GRAD load proof: what the city-aware place filter and the Serbian fold cost on many open tasks. Loopback only (never DEV).
// The SAME synthetic rows (labelled category 'DG load', written with triggers off: no product writer makes bulk rows, the reader only
// reads them) are measured with the DEV reader (OLD = the DISCOVERY-ZAMENE body) and with DISCOVERY-GRAD applied (NEW), as an
// authenticated viewer: server time of one call (median of 5), and the HTTP time of the PostgREST call the app makes (median of 3).
// Also: the fold per call, and the per-row cost of the days helper (the input of the speed proposal S3 in the README).
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {createFixtures} from '../ex06/lib/fixtures.mjs';
import {proveAreaDedup, areaExperimentSummary} from './area-dedup.proof.mjs';
import {readWithSocketRecovery} from './read-transport.mjs';

const {assert, sql, q, ok, env} = rt;
const DB = env.DB_URL;
assert.equal(DB, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const G = 'supabase/candidates/discovery-grad-20261008/';
const manifest = JSON.parse(fs.readFileSync(G + 'manifest.json', 'utf8'));
const out = env.DISCOVERY_GRAD_ARTIFACT_DIR;
const TASKS = Number(env.DG_LOAD_TASKS ?? 2000);
assert.ok(Number.isInteger(TASKS) && TASKS >= 2000 && TASKS <= 40000, 'BOUNDED_TASK_COUNT');
const BASELINE = env.DG_LOAD_MODE === 'deployed-baseline';
const HARD_S = 90;
const report = {unit: 'DISCOVERY-GRAD load', result: 'RUNNING', sourceSha: env.GITHUB_SHA, disposableOnly: true, liveAccess: false, providerCalls: 0, pushSends: 0,
  tasks: TASKS, checks: [], failures: [], load: {}};
const write = () => fs.writeFileSync(path.join(out, 'load-report.json'), JSON.stringify(report, null, 2) + '\n');
const pass = (name, detail) => { report.checks.push({name, result: 'PASS', ...(detail === undefined ? {} : {detail})}); write(); console.log('PASS ' + name); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function run(text, {timeoutS = HARD_S} = {}) {
  try {
    return {ok: true, output: execFileSync('psql', [DB, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'],
      {input: `set statement_timeout='${timeoutS}s';\nset lock_timeout='5s';\n${text}`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: (timeoutS + 30) * 1000, maxBuffer: 1 << 24}).trim()};
  } catch (error) {
    const detail = String(error.stderr ?? '') + String(error.message ?? '');
    return {ok: false, timedOut: /statement timeout|canceling statement|ETIMEDOUT/i.test(detail), error: detail.slice(-500)};
  }
}
const lastLine = text => text.split('\n').filter(Boolean).at(-1);

// ---------------------------------------------------------------- synthetic rows: cities with every spelling, parts of cities, no point, remote
const CITIES = [['Novi Sad', 45.27, 19.83], ['Beograd', 44.82, 20.46], ['Niš', 43.32, 21.90], ['Kragujevac', 44.01, 20.92], ['Subotica', 46.10, 19.67],
  ['Pančevo', 44.87, 20.64], ['Čačak', 43.89, 20.35], ['Kraljevo', 43.72, 20.69], ['Šabac', 44.75, 19.69], ['Zrenjanin', 45.38, 20.39],
  ['Kruševac', 43.58, 21.33], ['Inđija', 45.05, 20.08], ['Нови Сад', 45.27, 19.83], ['Cacak', 43.89, 20.35], ['novi sad', 45.27, 19.83]];
const AREAS = ['Liman', 'Detelinara', 'Grbavica', 'Centar', 'Vračar', 'Zemun', 'Novo naselje', 'Podbara', 'Salajka', 'Telep', 'Banovo brdo', 'Karaburma'];
const WORDS = ['Čišćenje stana', 'Selidba nameštaja', 'Košenje trave', 'Farbanje zidova', 'Montaža kuhinje', 'Popravka slavine', 'Dostava paketa',
  'Pranje prozora', 'Uređenje bašte', 'Đubrenje voćnjaka', 'Pomoć pri selidbi', 'Sečenje drva', 'Peglanje veša', 'Zamena brave', 'Nošenje kutija'];
const SKILLS = ['čišćenje', 'selidba', 'košenje', 'molerski radovi', 'montaža', 'vodoinstalater', 'dostava', 'baštovanstvo', 'električne instalacije', 'fizički poslovi'];
const arr = list => `array[${list.map(item => q(item)).join(',')}]`;
function seed(R) {
  const r = run(`begin; set local session_replication_role=replica;
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,required_tools,required_vehicles,
      required_licenses,minimum_experience_years,verified_identity_required,approximate_city,approximate_area,approximate_lat,approximate_lng,mode,required_slots,
      schedule_kind,starts_at,ends_at,execution_location_mode,task_country_code,task_timezone,response_deadline,published_at)
    select gen_random_uuid(),${q(R.id)}::uuid,${q(R.profileId)}::uuid,'PUBLISHED',
      (${arr(WORDS)})[1+(g%${WORDS.length})]||' '||g,'Sinteticki zadatak za merenje brzine DISCOVERY-GRAD.','DG load',
      array[(${arr(SKILLS)})[1+(g%${SKILLS.length})]],'{}','{}','{}',0,false,
      case when g%20=0 then '' else (${arr(CITIES.map(c => c[0]))})[1+(g%${CITIES.length})] end,
      case when g%20=0 or g%2=0 then '' else (${arr(AREAS)})[1+(g%${AREAS.length})] end,
      case when g%20=0 or g%13=0 then null else round(((${arr(CITIES.map(c => String(c[1])))})[1+(g%${CITIES.length})]::numeric+((g*7)%9-4)/100.0),2) end,
      case when g%20=0 or g%13=0 then null else round(((${arr(CITIES.map(c => String(c[2])))})[1+(g%${CITIES.length})]::numeric+((g*11)%9-4)/100.0),2) end,
      case when g%3=0 then 'MY_PRICE' else 'OFFERS' end,1+(g%3),
      case when g%20=0 then 'REMOTE_ANYTIME' else (array['FLEXIBLE','FLEXIBLE','TODAY_FLEXIBLE','FIXED_WINDOW','WEEK_FLEXIBLE'])[1+(g%5)] end,
      case when g%5=3 and g%20<>0 then date_trunc('hour',statement_timestamp())+interval '2 days 10 hours' end,
      case when g%5=3 and g%20<>0 then date_trunc('hour',statement_timestamp())+interval '2 days 12 hours' end,
      case when g%20=0 then 'REMOTE' else 'STATIONARY' end,'RS','Europe/Belgrade',statement_timestamp()+interval '2 days',statement_timestamp()-(g||' seconds')::interval
    from generate_series(1,${TASKS}) g;
    commit;
    analyze public.needs;`, {timeoutS: 180});
  assert.ok(r.ok, 'SEED_FAILED:' + r.error);
  return Number(sql(`select count(*) from public.needs where status in ('PUBLISHED','SELECTION') and published_at is not null and remaining_search_closed_at is null`));
}

// ---------------------------------------------------------------- reader calls as the signed-in viewer, timed on the server clock
// One backend per request kind: the first call is cold (the reader is compiled and planned in that backend), the next eleven are warm,
// as on a pooled PostgREST connection. medianMs / minMs over the eleven warm calls (a shared CI runner is noisy; the minimum is the
// least disturbed figure of CPU-bound work, the median the typical one).
const median = values => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
function measure(viewerId, request, runs = 11) {
  const claims = JSON.stringify({sub: viewerId, role: 'authenticated'});
  const r = run(`begin;
    select set_config('request.jwt.claims', ${q(claims)}, true);
    select set_config('request.jwt.claim.sub', ${q(viewerId)}, true);
    set local role authenticated;
    do $t$ declare t0 timestamptz; r jsonb; times jsonb:='[]'::jsonb; begin
      for i in 1..${runs + 1} loop
        t0:=clock_timestamp(); r:=public.rpc_discovery_v1(${q(JSON.stringify(request))}::jsonb);
        times:=times||to_jsonb(round((extract(epoch from clock_timestamp()-t0)*1000)::numeric,1));
      end loop;
      perform set_config('dg.last', jsonb_build_object('times', times,
        'version',r->'version','mode',r->'mode','anchor',r->'anchor',
        'memberCount',(select coalesce(sum(case when b->>'kind'='TASK' then 1 else (b->>'taskCount')::bigint end),0) from jsonb_array_elements(coalesce(r->'buckets','[]'::jsonb)) b),
        'rows', coalesce(jsonb_array_length(r->'items'), jsonb_array_length(r->'buckets'), 0),
        'counted', coalesce((r#>>'{counts,listed}')::bigint, (r#>>'{counts,mapped}')::bigint, (r#>>'{counts,everywhere}')::bigint, 0))::text, false); end $t$;
    select current_setting('dg.last');
    rollback;`);
  if (!r.ok) return {error: r.error, timedOut: r.timedOut};
  const x = JSON.parse(lastLine(r.output)), times = x.times.map(Number), warm = times.slice(1);
  return {coldMs: times[0], medianMs: median(warm), minMs: Math.min(...warm), maxMs: Math.max(...warm), rows: x.rows, counted: x.counted,
    version: x.version, mode: x.mode, anchor: x.anchor, memberCount: x.memberCount};
}
const FILTER = {text: '', price: 'all', where: 'any', places: 1, when: 'any', dates: null, place: null};
const WIDE = [18, 42, 23, 47];
const REQUESTS = {
  pageDefault: {mode: 'PAGE', filter: FILTER, anchor: null, scope: {kind: 'ALL'}, limit: 50, after: null},
  pageTextCiscenje: {mode: 'PAGE', filter: {...FILTER, text: 'ciscenje'}, anchor: null, scope: {kind: 'ALL'}, limit: 50, after: null},
  pageTextSelidba: {mode: 'PAGE', filter: {...FILTER, text: 'selidba'}, anchor: null, scope: {kind: 'ALL'}, limit: 50, after: null},
  pageTextNoHit: {mode: 'PAGE', filter: {...FILTER, text: 'xyzw'}, anchor: null, scope: {kind: 'ALL'}, limit: 50, after: null},
  pagePlaceCity: {mode: 'PAGE', filter: {...FILTER, place: 'Novi Sad'}, anchor: null, scope: {kind: 'ALL'}, limit: 50, after: null},
  pagePlaceLabel: {mode: 'PAGE', filter: {...FILTER, place: 'Liman, Novi Sad'}, anchor: null, scope: {kind: 'ALL'}, limit: 50, after: null},
  pagePlaceAndText: {mode: 'PAGE', filter: {...FILTER, place: 'Novi Sad', text: 'ciscenje'}, anchor: null, scope: {kind: 'ALL'}, limit: 50, after: null},
  pageAreaToday: {mode: 'PAGE', filter: {...FILTER, when: 'today'}, anchor: null, scope: {kind: 'AREA', bounds: [19.6, 45.1, 20.1, 45.4]}, limit: 50, after: null},
  mapDefault: {mode: 'MAP', filter: FILTER, anchor: null, bounds: WIDE, grid: 12},
  mapPlaceCity: {mode: 'MAP', filter: {...FILTER, place: 'Novi Sad'}, anchor: null, bounds: WIDE, grid: 12},
  placesDefault: {mode: 'PLACES', filter: FILTER, anchor: null, prefix: '', facetArea: null, limit: 30, after: null},
  placesPrefix: {mode: 'PLACES', filter: FILTER, anchor: null, prefix: 'nov', facetArea: null, limit: 30, after: null},
};
const NEW_ONLY = {placesCity: {...REQUESTS.placesDefault, groupBy: 'CITY'}, placesCityPrefix: {...REQUESTS.placesPrefix, groupBy: 'CITY'}};
function measureAll(viewerId, label, requests) {
  const result = {};
  for (const [key, request] of Object.entries(requests)) result[key] = measure(viewerId, request);
  report.load[label] = {...(report.load[label] ?? {}), ...result}; write();
  return result;
}
async function httpMs(client, request, runs = 3, expected = null) {
  const times = [];
  for (let i = 0; i < runs; i++) {
    const started = Date.now();
    const signal = AbortSignal.timeout(HARD_S * 1000);
    let recovery;
    const r = await readWithSocketRecovery(() => client.rpc('rpc_discovery_v1', {p_request: request}).abortSignal(signal), (state, response) => {
      if (state === 'RETRYING') {
        recovery = {phase: report.areaExperiment?.phase ? {...report.areaExperiment.phase} : {transport: 'BASELINE_HTTP'},
          mode: request.mode, sample: i + 1, initialElapsedMs: Date.now() - started, status: response.status,
          code: response.error.code, message: String(response.error.message ?? '').slice(0, 500),
          details: String(response.error.details ?? '').slice(0, 500), outcome: state};
        (report.httpTransportRecoveries ??= []).push(recovery);
      } else Object.assign(recovery, {outcome: state, finalStatus: response?.status ?? null, totalElapsedMs: Date.now() - started});
      write();
    });
    if (r.error) throw new Error('DISCOVERY_HTTP_FAILED:' + JSON.stringify({sample: i + 1, elapsedMs: Date.now() - started,
      status: r.status, statusText: r.statusText, code: r.error.code,
      message: String(r.error.message ?? '').slice(0, 500), details: String(r.error.details ?? '').slice(0, 500), hint: String(r.error.hint ?? '').slice(0, 250)}));
    if (expected) {
      const body = r.data;
      assert.equal(body?.version, 'DISCOVERY_V1'); assert.equal(body.mode, request.mode);
      const entries = request.mode === 'MAP' ? body.buckets : body.items;
      assert.ok(Array.isArray(entries)); assert.equal(entries.length, expected.rows);
      const counted = request.mode === 'MAP' ? body.counts?.mapped : request.mode === 'PAGE' ? body.counts?.listed : body.counts?.everywhere;
      assert.ok(Number.isSafeInteger(counted) && counted >= 0); assert.equal(counted, expected.counted);
      if (request.mode === 'MAP') {
        const members = entries.reduce((sum, b) => {
          assert.ok(['TASK', 'PLACE', 'CLUSTER'].includes(b.kind));
          const count = b.kind === 'TASK' ? 1 : b.taskCount;
          assert.ok(Number.isSafeInteger(count) && count > 0);
          return sum + count;
        }, 0);
        assert.equal(members, expected.memberCount);
      }
    }
    times.push(Date.now() - started);
  }
  return median(times);
}
/** One instrumented reader call. Transaction-local counters avoid cross-session flush races.
 * Keep overload identities and every observed helper. Total time includes children; never sum it across functions.
 */
function profile(viewerId, request) {
  const claims = JSON.stringify({sub: viewerId, role: 'authenticated'});
  const r = run(`begin; set local track_functions='all';
    select set_config('request.jwt.claims', ${q(claims)}, true);
    select set_config('request.jwt.claim.sub', ${q(viewerId)}, true);
    set local role authenticated;
    select length(public.rpc_discovery_v1(${q(JSON.stringify(request))}::jsonb)::text);
    reset role;
    select jsonb_build_object('trackFunctions',current_setting('track_functions'),
      'readerOid','public.rpc_discovery_v1(jsonb)'::regprocedure::oid,
      'functions',coalesce((select jsonb_agg(jsonb_build_object(
        'oid',s.funcid,'schema',s.schemaname,'name',s.funcname,
        'signature',s.funcid::regprocedure::text,'calls',s.calls,
        'selfMs',s.self_time,'totalMs',s.total_time) order by s.self_time desc,s.funcid)
        from pg_stat_xact_user_functions s where s.calls>0),'[]'::jsonb));
    rollback;`);
  assert.ok(r.ok, 'PROFILE_QUERY_FAILED:' + r.error);
  const result = JSON.parse(lastLine(r.output));
  assert.equal(result.trackFunctions, 'all');
  assert.ok(Array.isArray(result.functions));
  const reader = result.functions.find(f => f.oid === result.readerOid);
  assert.ok(reader, 'PROFILE_READER_MISSING');
  assert.equal(reader.calls, 1, 'PROFILE_NOT_ONE_READER_CALL');
  for (const f of result.functions) {
    assert.ok(Number.isSafeInteger(f.calls) && f.calls > 0);
    assert.ok(Number.isFinite(f.selfMs) && f.selfMs >= 0);
    assert.ok(Number.isFinite(f.totalMs) && f.totalMs >= 0);
  }
  return result;
}
function micro(label, inner, calls) {
  const r = run(`do $t$ declare t0 timestamptz:=clock_timestamp(); n bigint; begin ${inner}
    perform set_config('dg.micro', jsonb_build_object('ms', round((extract(epoch from clock_timestamp()-t0)*1000)::numeric,1), 'n', n)::text, false); end $t$;
    select current_setting('dg.micro');`);
  if (!r.ok) return {error: r.error};
  const x = JSON.parse(lastLine(r.output));
  return {...x, usPerCall: Math.round(x.ms * 1000 / calls * 100) / 100, calls};
}

// The 2026-10-09 run measures the already-applied reader, never optional S3. The historical comparative run below stays explicit.
async function deployedBaseline(viewer, requester, open) {
  report.mode = 'DEPLOYED_BASELINE';
  report.population = {tasks: TASKS, authAccounts: 2, simultaneousRequests: 1, lifecycleMutations: 0};
  report.limits = 'Synthetic bulk read fixture, serial SQL/HTTP samples on a shared CI runner. Not 40000 active users, whole-schema fidelity, lifecycle or native FPS.';
  const closure = () => sql('select jsonb_build_object(\'digest\',private.closure_source_digest_v5(),\'program\',private.closure_erasure_program_digest_v5(),\'ready\',private.retention_ai_source_ready())::text');
  const before = closure();
  assert.equal(Number(sql(`select count(*) from public.needs where requester_account_id=${q(requester.id)}::uuid and category='DG load'`)), TASKS, 'EXACT_SEED_SIZE');
  const visible = (extra = '') => {
    const claims = JSON.stringify({sub: viewer.id, role: 'authenticated'});
    const result = run(`begin; select set_config('request.jwt.claims',${q(claims)},true);
      select set_config('request.jwt.claim.sub',${q(viewer.id)},true); set local role authenticated;
      select count(*) from public.needs where status in ('PUBLISHED','SELECTION') and published_at is not null and remaining_search_closed_at is null ${extra}; rollback;`);
    assert.ok(result.ok, 'RLS_COUNT_FAILED');
    return Number(lastLine(result.output));
  };
  const verify = () => {
    const result = run(fs.readFileSync(G + 'postflight.readonly.sql', 'utf8'));
    assert.ok(result.ok, 'BASELINE_POSTFLIGHT_FAILED:' + result.error);
    const check = JSON.parse(lastLine(result.output));
    for (const key of ['readerAfter', 'helper', 'dependencies', 'certificateReady']) assert.equal(check[key], true, key);
    assert.equal(check.readerAcl, '{postgres=X/postgres,authenticated=X/postgres}');
    assert.equal(check.foldTruthTableMismatches, 0);
    assert.equal(closure(), before, 'BASELINE_MOVED_CERTIFICATE');
    return check;
  };
  execFileSync('psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', G + 'candidate.sql'], {stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000});
  report.baseline = {readerMd5: manifest.functions[0].after_md5, foldMd5: manifest.newFunctions[0].body_md5, before: verify()};
  assert.equal(report.baseline.readerMd5, 'a9b0985991f4ebfe4e95143e5cf57222');
  assert.equal(report.baseline.foldMd5, '41353abe05d434d513495ae5974b9802');
  pass('DEPLOYED_BASELINE_EXACT_BODY_ACL_DEPENDENCIES_CERTIFICATE');
  sql("notify pgrst, 'reload schema'"); await sleep(1500);
  const requests = {...REQUESTS, ...NEW_ONLY,
    pageRemote: {...REQUESTS.pageDefault, filter: {...FILTER, where: 'remote'}},
    mapCityDense: {...REQUESTS.mapDefault, bounds: [19.7, 45.15, 19.95, 45.4], grid: 16}};
  const measured = {}, http = {};
  for (const [key, request] of Object.entries(requests)) {
    const value = measure(viewer.id, request); measured[key] = value;
    assert.ok(!value.error, 'BASELINE_MEASUREMENT_FAILED:' + key + ':' + value.error);
    assert.equal(value.version, 'DISCOVERY_V1'); assert.equal(value.mode, request.mode);
    assert.ok(Number.isSafeInteger(value.rows) && value.rows >= 0 && Number.isSafeInteger(value.counted) && value.counted >= 0);
    // Keep the same snapshot time/cutoff and consume its short-lived anchor immediately.
    http[key] = await httpMs(viewer.client, {...request, anchor: value.anchor}, 3, value);
    assert.equal(typeof http[key], 'number', 'HTTP_MEASUREMENT_FAILED:' + key);
    report.load.DEPLOYED_BASELINE = measured; report.load.DEPLOYED_BASELINE_HTTP = http; write();
  }
  assert.ok(Object.values(measured).every(x => !x.error), 'BASELINE_MEASUREMENT_FAILED:' + JSON.stringify(measured));
  assert.equal(measured.pageDefault.counted, visible(`and published_at<=${q(measured.pageDefault.anchor.publishedThrough)}::timestamptz`), 'ALL_VISIBLE_TASKS_REACHABLE');
  assert.equal(measured.pageDefault.rows, 50, 'FULL_FIRST_PAGE');
  for (const key of ['mapDefault', 'mapCityDense']) {
    const [west, south, east, north] = requests[key].bounds;
    const count = visible(`and published_at<=${q(measured[key].anchor.publishedThrough)}::timestamptz and execution_location_mode is distinct from 'REMOTE' and approximate_lat between ${south} and ${north} and approximate_lng between ${west} and ${east}`);
    assert.ok(measured[key].rows > 0); assert.equal(measured[key].memberCount, count, 'MAP_MEMBERS:' + key);
  }
  assert.equal(measured.pageTextNoHit.counted, 0, 'NO_HIT_COUNT');
  assert.ok(measured.pagePlaceCity.counted > 0 && measured.pagePlaceCity.counted < open, 'CITY_FILTER');
  assert.ok(measured.pageTextCiscenje.counted > 0 && measured.pageTextCiscenje.counted < open, 'FOLD_SEARCH');
  assert.ok(measured.pageRemote.counted > 0 && measured.pageRemote.counted < open, 'REMOTE_FILTER');
  for (const [key, request] of Object.entries(requests)) {
    const limit = request.mode === 'MAP' ? 256 : request.limit;
    assert.ok(measured[key].rows <= limit, 'BOUNDED_RESPONSE:' + key);
  }
  pass('DEPLOYED_BASELINE_COUNTS_FILTERS_RESPONSE_BOUNDS', measured);
  report.load.DEPLOYED_BASELINE_HTTP = http;
  pass('DEPLOYED_BASELINE_AUTHENTICATED_HTTP', http);
  report.load.DEPLOYED_BASELINE_PROFILE = {};
  for (const key of ['pageDefault', 'pageTextCiscenje', 'pageTextNoHit', 'pagePlaceAndText']) {
    report.load.DEPLOYED_BASELINE_PROFILE[key] = profile(viewer.id, requests[key]); write();
  }
  pass('DEPLOYED_BASELINE_FOUR_REQUEST_PROFILES');
  report.baseline.after = verify();
  pass('DEPLOYED_BASELINE_POSTLOAD_FIDELITY');
  for (const relative of ['chain/chain-fidelity.json', 'predecessor-fidelity.json']) {
    const fidelity = JSON.parse(fs.readFileSync(path.join(out, relative), 'utf8'));
    assert.equal(fidelity.result, 'PASS', relative);
  }
  pass('DEPLOYED_BASELINE_RELEVANT_CHAIN_FIDELITY');
  const lines = ['### Applied Discovery reader: isolated ' + TASKS + '-task baseline', '', report.limits, '',
    '| Request | Cold SQL ms | Warm SQL median ms | Warm maximum ms | HTTP median ms | Rows | Count |', '|---|---:|---:|---:|---:|---:|---:|'];
  for (const [key, m] of Object.entries(measured)) lines.push(`| ${key} | ${m.coldMs} | ${m.medianMs} | ${m.maxMs} | ${http[key]} | ${m.rows} | ${m.counted} |`);
  lines.push('', '11 warm SQL samples and 3 HTTP samples per request; no concurrent-user or p95 capacity claim. S3 NOT applied. Provider calls=0, push sends=0.');
  lines.push('', '#### Transaction-local profiles', '', 'One extra instrumented call per request; not latency medians. Full function list is in JSON. Unobserved helpers are not assumed to cost zero.');
  for (const [key, profile] of Object.entries(report.load.DEPLOYED_BASELINE_PROFILE)) {
    lines.push('', '##### ' + key, '', '| Function | Calls | Self ms | Total ms (includes children) |', '|---|---:|---:|---:|');
    for (const f of profile.functions.slice(0, 8)) lines.push(`| ${f.signature} | ${f.calls} | ${f.selfMs} | ${f.totalMs} |`);
  }
  fs.writeFileSync(path.join(out, 'load-summary.md'), lines.join('\n') + '\n');
}

try {
  const fx = createFixtures(rt, {needPath: 'direct'});
  fx.pauseSchedulers();
  assert.equal(sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${q(manifest.functions[0].signature)})`), manifest.functions[0].before_md5);
  const R = await fx.createRequester({label: 'dg-load-requester'});
  const viewer = await fx.createRequester({label: 'dg-load-viewer'});
  const open = seed(R);
  report.load.openTasks = open; write();
  assert.ok(open >= TASKS);
  pass('DISCOVERY_GRAD_LOAD_SEEDED', {openTasks: open});
  if (BASELINE) {
    await deployedBaseline(viewer, R, open);
    if (env.DG_AREA_EXPERIMENT) await proveAreaDedup({env, run, sql, q, viewer, requester: R,
      requests: {...REQUESTS, ...NEW_ONLY, pageRemote: {...REQUESTS.pageDefault, filter: {...FILTER, where: 'remote'}},
        mapCityDense: {...REQUESTS.mapDefault, bounds: [19.7, 45.15, 19.95, 45.4], grid: 16}},
      measure, httpMs, profile, report, write, pass});
    if (report.areaExperiment) fs.appendFileSync(path.join(out, 'load-summary.md'), areaExperimentSummary(report.areaExperiment));
  } else {
  // per-call costs that explain the numbers: the days helper (every PAGE row computes it; the S3 proposal), the key helper (place filter)
  report.load.micro = {
    daysPerOpenTask: micro('p6_discovery_days', `select count(*) into n from public.needs x where x.status in ('PUBLISHED','SELECTION') and x.published_at is not null
      and public.p6_discovery_days(x.schedule_kind,x.starts_at,x.ends_at,x.task_timezone,statement_timestamp()) is not null;`, open),
    keyPerCall: micro('p6_discovery_key', `select count(*) into n from generate_series(1,20000) g where public.p6_discovery_key('Liman, Novi Sad '||g)<>'';`, 20000),
  };
  write();
  const old = measureAll(viewer.id, 'OLD', REQUESTS);
  const oldHttp = {pageDefault: await httpMs(viewer.client, REQUESTS.pageDefault), pageTextCiscenje: await httpMs(viewer.client, REQUESTS.pageTextCiscenje),
    pagePlaceCity: await httpMs(viewer.client, REQUESTS.pagePlaceCity), placesDefault: await httpMs(viewer.client, REQUESTS.placesDefault)};
  report.load.OLD_HTTP = oldHttp; write();
  assert.ok(Object.values(old).every(x => !x.error), 'OLD_MEASUREMENT_FAILED:' + JSON.stringify(old));
  report.load.profile = {OLD: {pagePlaceCity: profile(viewer.id, REQUESTS.pagePlaceCity), pageTextCiscenje: profile(viewer.id, REQUESTS.pageTextCiscenje)}}; write();
  pass('DISCOVERY_GRAD_LOAD_OLD_MEASURED', old);

  execFileSync('psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', G + 'candidate.sql'], {stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000});
  sql("notify pgrst, 'reload schema'");
  await sleep(1500);
  assert.equal(sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${q(manifest.functions[0].signature)})`), manifest.functions[0].after_md5);
  report.load.micro.foldPerCall = micro('discovery_fold_v1', `select count(*) into n from generate_series(1,20000) g where public.discovery_fold_v1('Čišćenje stana posle selidbe '||g)<>'';`, 20000);
  report.load.micro.placeKeyFoldPerCall = micro('fold(key)', `select count(*) into n from generate_series(1,20000) g where public.discovery_fold_v1(public.p6_discovery_key('Liman, Novi Sad '||g))<>'';`, 20000);
  write();
  const now = measureAll(viewer.id, 'NEW', {...REQUESTS, ...NEW_ONLY});
  const newHttp = {pageDefault: await httpMs(viewer.client, REQUESTS.pageDefault), pageTextCiscenje: await httpMs(viewer.client, REQUESTS.pageTextCiscenje),
    pagePlaceCity: await httpMs(viewer.client, REQUESTS.pagePlaceCity), placesDefault: await httpMs(viewer.client, REQUESTS.placesDefault),
    placesCity: await httpMs(viewer.client, NEW_ONLY.placesCity)};
  report.load.NEW_HTTP = newHttp; write();
  assert.ok(Object.values(now).every(x => !x.error), 'NEW_MEASUREMENT_FAILED:' + JSON.stringify(now));
  report.load.profile.NEW = {pagePlaceCity: profile(viewer.id, REQUESTS.pagePlaceCity), pageTextCiscenje: profile(viewer.id, REQUESTS.pageTextCiscenje),
    pageDefault: profile(viewer.id, REQUESTS.pageDefault)}; write();
  // what the change buys: the city filter lists the whole city, the fold finds the other spellings (counts, not milliseconds)
  report.load.found = {placeCity: {old: old.pagePlaceCity.counted, new: now.pagePlaceCity.counted}, textCiscenje: {old: old.pageTextCiscenje.counted, new: now.pageTextCiscenje.counted},
    placesRows: {old: old.placesDefault.rows, new: now.placesDefault.rows, city: now.placesCity.rows}};
  assert.ok(now.pagePlaceCity.counted > old.pagePlaceCity.counted, 'CITY_FILTER_DOES_NOT_WIDEN');
  assert.ok(now.pageTextCiscenje.counted > old.pageTextCiscenje.counted, 'FOLD_DOES_NOT_FIND_MORE');
  assert.equal(now.pageDefault.counted, old.pageDefault.counted);
  assert.equal(now.mapDefault.counted, old.mapDefault.counted);
  // no request without a word or a place pays for the change: the default reads stay within noise of the old ones (generous bound: CI varies)
  for (const key of ['pageDefault', 'mapDefault']) assert.ok(now[key].medianMs <= old[key].medianMs * 1.5 + 15, 'DEFAULT_READ_SLOWER:' + key + ' ' + JSON.stringify({old: old[key], now: now[key]}));
  pass('DISCOVERY_GRAD_LOAD_NEW_MEASURED_DEFAULT_READS_UNCHANGED', {old, now});

  // the optional part S3 on the same rows: the days only for a time filter
  execFileSync('psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', G + 's3-candidate.sql'], {stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000});
  assert.equal(sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${q(manifest.functions[0].signature)})`), manifest.optionalParts[0].functions[0].after_md5);
  const s3 = measureAll(viewer.id, 'NEW_S3', {...REQUESTS, ...NEW_ONLY});
  assert.ok(Object.values(s3).every(x => !x.error), 'S3_MEASUREMENT_FAILED:' + JSON.stringify(s3));
  for (const key of Object.keys(REQUESTS)) assert.equal(s3[key].counted, now[key].counted, 'S3_CHANGED_WHAT_IS_FOUND:' + key);
  report.load.profile.NEW_S3 = {pageDefault: profile(viewer.id, REQUESTS.pageDefault)};
  write();
  execFileSync('psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', G + 's3-revert.sql'], {stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000});
  assert.equal(sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${q(manifest.functions[0].signature)})`), manifest.functions[0].after_md5);
  pass('DISCOVERY_GRAD_LOAD_S3_MEASURED_SAME_RESULTS_REVERTED', s3);

  // revert under load: the reader is back to the DEV body; the same reads once more give the noise of this runner (OLD again)
  execFileSync('psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', G + 'revert.sql'], {stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000});
  assert.equal(sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${q(manifest.functions[0].signature)})`), manifest.functions[0].before_md5);
  const again = measureAll(viewer.id, 'OLD_AGAIN', REQUESTS);
  assert.ok(Object.values(again).every(x => !x.error), 'OLD_AGAIN_MEASUREMENT_FAILED:' + JSON.stringify(again));
  for (const key of Object.keys(REQUESTS)) assert.equal(again[key].counted, old[key].counted, 'REVERT_CHANGED_WHAT_IS_FOUND:' + key);
  pass('DISCOVERY_GRAD_LOAD_REVERTED_SAME_RESULTS_AS_OLD', again);

  const f1 = v => (v === undefined || v === null) ? 'n/a' : (typeof v === 'object' ? (v.error ? 'error' : (v.minMs === undefined ? String(v.medianMs) : `${v.medianMs} (${v.minMs})`)) : String(v));
  const lines = ['### DISCOVERY-GRAD load (disposable database, ' + open + ' open tasks; server time of one call as the signed-in viewer, median (minimum) of 11 warm calls, ms)', '',
    '| request | OLD (DEV body) | NEW (DISCOVERY-GRAD) | NEW + S3 (optional part) | OLD again (after the revert: runner noise) | listed / mapped / rows OLD -> NEW |', '|---|---|---|---|---|---|'];
  for (const key of [...Object.keys(REQUESTS), ...Object.keys(NEW_ONLY)]) {
    lines.push(`| ${key} | ${f1(old[key])} | ${f1(now[key])} | ${f1(s3[key])} | ${f1(again[key])} | ${old[key]?.counted ?? old[key]?.rows ?? '-'} -> ${now[key]?.counted ?? now[key]?.rows ?? '-'} |`);
  }
  lines.push('', '| PostgREST call (as the app, median of 3, ms) | OLD | NEW |', '|---|---|---|');
  for (const key of Object.keys(newHttp)) lines.push(`| ${key} | ${f1(oldHttp[key])} | ${f1(newHttp[key])} |`);
  const m = report.load.micro;
  lines.push('', `Per call: discovery_fold_v1 ${m.foldPerCall?.usPerCall} us, fold(p6_discovery_key) ${m.placeKeyFoldPerCall?.usPerCall} us, p6_discovery_key ${m.keyPerCall?.usPerCall} us; `
    + `p6_discovery_days ${m.daysPerOpenTask?.usPerCall} us per open task (${m.daysPerOpenTask?.ms} ms for all ${open}: what every PAGE pays today without a time filter, the S3 proposal).`);
  const prof = (state, key) => (report.load.profile?.[state]?.[key]?.functions ?? []).slice(0, 5).map(x => `${x.name} ${x.calls}x ${x.selfMs} ms`).join(', ');
  lines.push('', 'Function profile of ONE call (calls and self time, track_functions):', '',
    `- place "Novi Sad", OLD: ${prof('OLD', 'pagePlaceCity')}`, `- place "Novi Sad", NEW: ${prof('NEW', 'pagePlaceCity')}`,
    `- words "ciscenje", OLD: ${prof('OLD', 'pageTextCiscenje')}`, `- words "ciscenje", NEW: ${prof('NEW', 'pageTextCiscenje')}`,
    `- default page, NEW: ${prof('NEW', 'pageDefault')}`, `- default page, NEW + S3: ${prof('NEW_S3', 'pageDefault')}`);
  fs.writeFileSync(path.join(out, 'load-summary.md'), lines.join('\n') + '\n');
  }
  report.httpTransport = report.httpTransportRecoveries?.length ? 'PASS_WITH_RECORDED_SOCKET_RECOVERY' : 'ALL_FIRST_ATTEMPTS_SUCCEEDED';
  report.result = 'PASS'; write();
  fs.appendFileSync(path.join(out, 'load-summary.md'), `\nHTTP transport: ${report.httpTransport}; reconnects: ${report.httpTransportRecoveries?.length ?? 0}. Each sample includes the initial failed attempt and recovery in one shared deadline. No HTTP/API/timeout retries.\n`);
  console.log('PASS DISCOVERY_GRAD_LOAD');
} catch (error) {
  if (report.areaExperiment?.state === 'RUNNING') report.areaExperiment.state = 'FAIL';
  report.result = 'FAIL'; report.failures.push({name: 'LOAD', detail: String(error?.stack ?? error).slice(0, 2500)}); write();
  console.error('FAIL DISCOVERY_GRAD_LOAD ' + String(error?.stack ?? error).slice(0, 2500));
  process.exitCode = 1;
}
