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

const {assert, sql, q, ok, env} = rt;
const DB = env.DB_URL;
assert.equal(DB, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const G = 'supabase/candidates/discovery-grad-20261008/';
const manifest = JSON.parse(fs.readFileSync(G + 'manifest.json', 'utf8'));
const out = env.DISCOVERY_GRAD_ARTIFACT_DIR;
const TASKS = Number(env.DG_LOAD_TASKS ?? 2000);
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
// One backend per request kind: the first call is cold (the reader is compiled and planned in that backend), the next five are warm,
// as on a pooled PostgREST connection. medianMs = median of the five warm calls.
const median = values => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
function measure(viewerId, request, runs = 5) {
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
        'rows', coalesce(jsonb_array_length(r->'items'), jsonb_array_length(r->'buckets'), 0),
        'counted', coalesce((r#>>'{counts,listed}')::bigint, (r#>>'{counts,mapped}')::bigint, (r#>>'{counts,everywhere}')::bigint, 0))::text, false); end $t$;
    select current_setting('dg.last');
    rollback;`);
  if (!r.ok) return {error: r.error, timedOut: r.timedOut};
  const x = JSON.parse(lastLine(r.output)), times = x.times.map(Number), warm = times.slice(1);
  return {coldMs: times[0], medianMs: median(warm), maxMs: Math.max(...warm), rows: x.rows, counted: x.counted};
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
async function httpMs(client, request, runs = 3) {
  const times = [];
  for (let i = 0; i < runs; i++) {
    const started = Date.now();
    const r = await client.rpc('rpc_discovery_v1', {p_request: request});
    if (r.error) return {error: r.error.message};
    times.push(Date.now() - started);
  }
  return median(times);
}
function micro(label, inner, calls) {
  const r = run(`do $t$ declare t0 timestamptz:=clock_timestamp(); n bigint; begin ${inner}
    perform set_config('dg.micro', jsonb_build_object('ms', round((extract(epoch from clock_timestamp()-t0)*1000)::numeric,1), 'n', n)::text, false); end $t$;
    select current_setting('dg.micro');`);
  if (!r.ok) return {error: r.error};
  const x = JSON.parse(lastLine(r.output));
  return {...x, usPerCall: Math.round(x.ms * 1000 / calls * 100) / 100, calls};
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

  // revert under load: the reader is back to the DEV body; the same reads once more give the noise of this runner (OLD again)
  execFileSync('psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', G + 'revert.sql'], {stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000});
  assert.equal(sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${q(manifest.functions[0].signature)})`), manifest.functions[0].before_md5);
  const again = measureAll(viewer.id, 'OLD_AGAIN', REQUESTS);
  assert.ok(Object.values(again).every(x => !x.error), 'OLD_AGAIN_MEASUREMENT_FAILED:' + JSON.stringify(again));
  for (const key of Object.keys(REQUESTS)) assert.equal(again[key].counted, old[key].counted, 'REVERT_CHANGED_WHAT_IS_FOUND:' + key);
  pass('DISCOVERY_GRAD_LOAD_REVERTED_SAME_RESULTS_AS_OLD', again);

  const f1 = v => (v === undefined || v === null) ? 'n/a' : (typeof v === 'object' ? (v.error ? 'error' : String(v.medianMs)) : String(v));
  const lines = ['### DISCOVERY-GRAD load (disposable database, ' + open + ' open tasks; server time of one call as the signed-in viewer, median of 5 warm calls, ms)', '',
    '| request | OLD (DEV body) | NEW (DISCOVERY-GRAD) | OLD again (after the revert: runner noise) | listed / mapped / rows OLD -> NEW |', '|---|---|---|---|---|'];
  for (const key of [...Object.keys(REQUESTS), ...Object.keys(NEW_ONLY)]) {
    lines.push(`| ${key} | ${f1(old[key])} | ${f1(now[key])} | ${f1(again[key])} | ${old[key]?.counted ?? old[key]?.rows ?? '-'} -> ${now[key]?.counted ?? now[key]?.rows ?? '-'} |`);
  }
  lines.push('', '| PostgREST call (as the app, median of 3, ms) | OLD | NEW |', '|---|---|---|');
  for (const key of Object.keys(newHttp)) lines.push(`| ${key} | ${f1(oldHttp[key])} | ${f1(newHttp[key])} |`);
  const m = report.load.micro;
  lines.push('', `Per call: discovery_fold_v1 ${m.foldPerCall?.usPerCall} us, fold(p6_discovery_key) ${m.placeKeyFoldPerCall?.usPerCall} us, p6_discovery_key ${m.keyPerCall?.usPerCall} us; `
    + `p6_discovery_days ${m.daysPerOpenTask?.usPerCall} us per open task (${m.daysPerOpenTask?.ms} ms for all ${open}: what every PAGE pays today without a time filter, the S3 proposal).`);
  fs.writeFileSync(path.join(out, 'load-summary.md'), lines.join('\n') + '\n');
  report.result = 'PASS'; write();
  console.log('PASS DISCOVERY_GRAD_LOAD');
} catch (error) {
  report.result = 'FAIL'; report.failures.push({name: 'LOAD', detail: String(error?.stack ?? error).slice(0, 2500)}); write();
  console.error('FAIL DISCOVERY_GRAD_LOAD ' + String(error?.stack ?? error).slice(0, 2500));
  process.exitCode = 1;
}
