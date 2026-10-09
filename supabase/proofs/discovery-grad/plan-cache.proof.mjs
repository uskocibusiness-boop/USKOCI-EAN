// Opt-in, loopback-only diagnosis. A successful diagnostic is not a performance or promotion PASS.
import assert from 'node:assert/strict';
import {spawnSync, execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {measureProgress} from './measure-sql.mjs';

export const PLAN_MODES = ['auto', 'force_custom_plan', 'force_generic_plan'];
const LOCAL_DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const READER = 'a9b0985991f4ebfe4e95143e5cf57222';
const BUDGET_MS = 15 * 60 * 1000;
const TRACE_CONFIG = `load 'auto_explain';
set local auto_explain.log_analyze=on;
set local auto_explain.log_buffers=on;
set local auto_explain.log_timing=off;
set local auto_explain.log_nested_statements=on;
set local auto_explain.log_parameter_max_length=0;
set local auto_explain.log_format=json;
set local auto_explain.log_level=notice;
set local auto_explain.log_min_duration=1;`;

export function planSessionSql({mode, viewerId, request, oracle, q, trace = false}) {
  assert.ok(PLAN_MODES.includes(mode), 'PLAN_MODE_NOT_ALLOWED');
  assert.equal(request.mode, 'PLACES');
  assert.equal(oracle.mode, 'PLACES');
  assert.ok(oracle.anchor && typeof oracle.anchor === 'object');
  const calls = Array.from({length: trace ? 1 : 6}, (_, i) => `do $dg_plan$
declare r jsonb; t timestamptz; ms numeric; expected jsonb:=${q(JSON.stringify(oracle))}::jsonb;
begin
  if current_setting('plan_cache_mode')<>${q(mode)} or current_user<>'authenticated'
     or pg_backend_pid()::text<>current_setting('dg.plan_pid') then raise exception 'DG_PLAN_SESSION_CHANGED'; end if;
  raise notice 'DG_MEASURE_BEGIN:${i}';
  t:=clock_timestamp();
  r:=public.rpc_discovery_v1(${q(JSON.stringify({...request, anchor: oracle.anchor}))}::jsonb);
  ms:=round((extract(epoch from clock_timestamp()-t)*1000)::numeric,1);
  if r->>'version' is distinct from 'DISCOVERY_V1' or r->>'mode' is distinct from 'PLACES' or r#>>'{counts,kind}' is distinct from 'exact_live'
     or r->'anchor' is distinct from expected->'anchor' or jsonb_typeof(r#>'{counts,everywhere}') is distinct from 'number'
     or jsonb_typeof(r->'asOf') is distinct from 'string' or r->'asOf' is distinct from r#>'{counts,observedAt}' then
    raise exception 'DG_PLAN_ENVELOPE_CHANGED'; end if;
  if not isfinite((r->>'asOf')::timestamptz) or (r->>'asOf')::timestamptz is distinct from statement_timestamp() then
    raise exception 'DG_PLAN_OBSERVATION_CLOCK_CHANGED'; end if;
  if (r-'asOf')#-'{counts,observedAt}' is distinct from (expected-'asOf')#-'{counts,observedAt}' then
    raise exception 'DG_PLAN_RESPONSE_CHANGED'; end if;
  perform set_config('dg.plan_times',(current_setting('dg.plan_times')::jsonb||to_jsonb(ms))::text,true);
  raise notice 'DG_MEASURE_DONE:${i}:%',ms;
end $dg_plan$;`);
  return `begin;
${trace ? TRACE_CONFIG : ''}
set local plan_cache_mode=${q(mode)};
select set_config('request.jwt.claims',${q(JSON.stringify({sub: viewerId, role: 'authenticated'}))},true);
select set_config('request.jwt.claim.sub',${q(viewerId)},true);
set local role authenticated;
select set_config('dg.plan_pid',pg_backend_pid()::text,true);
select set_config('dg.plan_times','[]',true);
select 'DG_PLAN_ENV '||jsonb_build_object('mode',current_setting('plan_cache_mode'),'role',current_user,
  'serverVersion',current_setting('server_version_num'),'statementTimeout',current_setting('statement_timeout'),
  'lockTimeout',current_setting('lock_timeout'),'jit',current_setting('jit'),'workMem',current_setting('work_mem'))::text;
${calls.join('\n')}
select 'DG_PLAN_RESULT '||jsonb_build_object('sessionStable',true,'times',current_setting('dg.plan_times')::jsonb)::text;
rollback;`;
}

export function planResult(child, elapsedMs, trace = false) {
  const progress = measureProgress(child.stderr, trace ? 1 : 6);
  const readMarker = marker => {
    const line = String(child.stdout ?? '').split('\n').find(line => line.startsWith(marker));
    return line ? JSON.parse(line.slice(marker.length)) : null;
  };
  const environment = readMarker('DG_PLAN_ENV '), result = readMarker('DG_PLAN_RESULT ');
  const stderr = String(child.stderr ?? '');
  const sqlstate = stderr.match(/(?:ERROR|FATAL):\s+([A-Z0-9]{5}):/)?.[1] ?? null;
  const failure = child.status === 0 ? null : child.error?.code === 'ETIMEDOUT' ? 'PROCESS_BUDGET'
    : /canceling statement due to statement timeout/.test(stderr) ? 'STATEMENT_TIMEOUT'
    : /DG_PLAN_RESPONSE_CHANGED/.test(stderr) ? 'RESPONSE_CHANGED'
    : /DG_PLAN_ENVELOPE_CHANGED/.test(stderr) ? 'ENVELOPE_CHANGED'
    : /DG_PLAN_SESSION_CHANGED/.test(stderr) ? 'SESSION_CHANGED' : 'SQL_OR_PROCESS_FAILURE';
  if (!failure) {
    assert.equal(progress.valid, true); assert.equal(progress.completedSamples, trace ? 1 : 6);
    assert.equal(result?.sessionStable, true);
    assert.deepEqual(result.times, progress.completed.map(x => x.elapsedMs));
  }
  if (progress.activeSample !== null || progress.completedSamples > 0) {
    assert.ok(PLAN_MODES.includes(environment?.mode)); assert.equal(environment.role, 'authenticated');
    assert.equal(environment.statementTimeout, '90s'); assert.equal(environment.lockTimeout, '5s');
  }
  return {environment, elapsedMs, progress, sessionStable: result?.sessionStable === true,
    completedResponseComparisons: progress.completedSamples, failure, sqlstate,
    status: child.status, processCode: child.error?.code === 'ETIMEDOUT' ? 'ETIMEDOUT' : null};
}

export async function provePlanCache({env, run, sql, q, viewer, requester, request, report, write, verify, closure}) {
  assert.equal(env.DB_URL, LOCAL_DB); assert.equal(env.DG_PLAN_CACHE_DIAGNOSTIC, 'DISPOSABLE_PLAN_CACHE');
  assert.ok(!env.DG_AREA_EXPERIMENT && !env.DG_READ_CONCURRENCY, 'EXCLUSIVE_DIAGNOSTIC');
  const identity = () => sql(`select jsonb_build_object('body',md5(prosrc),'owner',proowner,'securityDefiner',prosecdef,
    'config',proconfig,'acl',proacl,'comment',obj_description(oid,'pg_proc'))::text from pg_proc
    where oid='public.rpc_discovery_v1(jsonb)'::regprocedure`);
  const before = identity(), certificate = closure(); assert.equal(JSON.parse(before).body, READER);
  const proof = report.planCacheDiagnostic = {state: 'RUNNING', readerMd5: READER, budgetMs: BUDGET_MS,
    budgetScope: 'Fixture, oracle and sampling/trace workload; postflight is separately measured with existing bounded SQL deadlines.',
    fixture: 'All 40000 DG load rows have unique areas; separate from the 27-marked-row area corpus.',
    limits: 'Two Auth accounts, one SQL reader at a time. No HTTP/concurrency/capacity proof. Modes also affect helper plans. No candidate installed.',
    semanticComparison: 'Full JSON except validated asOf and counts.observedAt; same complete oracle anchor. Not a new unmasked semantic proof.',
    modes: {}, traces: {}};
  write();
  const started = Date.now();
  try {
  proof.phase = {stage: 'fixture'}; write();
  const seeded = run(`begin; set local session_replication_role=replica;
    update public.needs set approximate_area='Jedinstvena lokacija '||id::text
    where requester_account_id=${q(requester.id)}::uuid and category='DG load'; commit; analyze public.needs;`);
  assert.ok(seeded.ok, 'PLAN_FIXTURE_FAILED');
  proof.taskCount = Number(sql(`select count(*) from public.needs where requester_account_id=${q(requester.id)}::uuid and category='DG load'`));
  assert.equal(proof.taskCount, 40000);
  proof.phase = {stage: 'oracle'}; write();
  const cold = run(`begin; select set_config('request.jwt.claims',${q(JSON.stringify({sub: viewer.id, role: 'authenticated'}))},true);
    select set_config('request.jwt.claim.sub',${q(viewer.id)},true); set local role authenticated;
    do $dg_oracle$ declare r jsonb; begin
      r:=public.rpc_discovery_v1(${q(JSON.stringify(request))}::jsonb);
      if jsonb_typeof(r->'asOf') is distinct from 'string' or r->'asOf' is distinct from r#>'{counts,observedAt}' then
        raise exception 'DG_PLAN_ORACLE_CLOCK_CHANGED'; end if;
      if not isfinite((r->>'asOf')::timestamptz) or (r->>'asOf')::timestamptz is distinct from statement_timestamp() then
        raise exception 'DG_PLAN_ORACLE_CLOCK_CHANGED'; end if;
      perform set_config('dg.plan_oracle',r::text,true);
    end $dg_oracle$;
    select current_setting('dg.plan_oracle'); rollback;`);
  proof.oracleRead = {ok: cold.ok, elapsedMs: cold.elapsedMs ?? null,
    sqlstate: cold.error?.match(/(?:ERROR|FATAL):\s+([A-Z0-9]{5}):/)?.[1] ?? null,
    failure: cold.ok ? null : cold.timedOut ? 'SQL_OR_PROCESS_TIMEOUT' : 'SQL_OR_PROCESS_FAILURE'}; write();
  assert.ok(cold.ok, 'PLAN_ORACLE_FAILED');
  const oracle = JSON.parse(cold.output.split('\n').filter(Boolean).at(-1));
  assert.equal(oracle.mode, 'PLACES'); assert.equal(oracle.version, 'DISCOVERY_V1');
  assert.equal(typeof oracle.asOf, 'string'); assert.equal(oracle.asOf, oracle.counts.observedAt);
  assert.ok(Number.isSafeInteger(oracle.counts.everywhere) && oracle.counts.everywhere >= 0);
  assert.ok(Array.isArray(oracle.items) && oracle.items.length > 0 && oracle.items.length <= request.limit);
  proof.oracle = {sha256: createHash('sha256').update(JSON.stringify(oracle)).digest('hex'), rows: oracle.items.length,
    everywhere: oracle.counts.everywhere, anchorSha256: createHash('sha256').update(JSON.stringify(oracle.anchor)).digest('hex')};
  const execute = (mode, trace) => {
    const remaining = BUDGET_MS - (Date.now() - started);
    assert.ok(remaining > 1000, 'PLAN_DIAGNOSTIC_BUDGET_EXHAUSTED');
    const script = planSessionSql({mode, viewerId: viewer.id, request, oracle, q, trace});
    const t = Date.now();
    const child = spawnSync('psql', [LOCAL_DB, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], {
      input: `set statement_timeout='90s'; set lock_timeout='5s';\n${script}`, encoding: 'utf8',
      timeout: Math.min(remaining, trace ? 120000 : 570000), maxBuffer: 1 << 25,
    });
    const metric = planResult(child, Date.now() - t, trace);
    (trace ? proof.traces : proof.modes)[mode] = metric; write();
    if (trace) {
      try {
        metric.nativePlans = JSON.parse(execFileSync('python3', ['supabase/proofs/discovery-grad/plan-cache-trace.py'], {
          input: child.stderr, encoding: 'utf8', timeout: Math.min(10000, Math.max(1, BUDGET_MS - (Date.now() - started))), maxBuffer: 1 << 22}));
      } catch {
        metric.traceStatus = 'TRACE_PARSE_FAILED'; write(); throw new Error('PLAN_TRACE_PARSE_FAILED');
      }
      metric.traceStatus = metric.nativePlans.length ? 'CAPTURED' : metric.failure === 'STATEMENT_TIMEOUT' ? 'PLAN_NOT_CAPTURED_AFTER_TIMEOUT' : 'PLAN_NOT_CAPTURED';
    }
    return metric;
  };
    for (const mode of PLAN_MODES) { proof.phase = {stage: 'timing', mode}; write(); proof.modes[mode] = execute(mode, false); write(); }
    // Instrumented calls are independent fresh sessions, excluded from timing samples.
    for (const mode of ['force_custom_plan', 'force_generic_plan']) {
      proof.phase = {stage: 'native_trace', mode}; write(); proof.traces[mode] = execute(mode, true); write();
    }
    const metrics = [...Object.values(proof.modes), ...Object.values(proof.traces)];
    assert.ok(metrics.every(m => !m.failure || m.failure === 'STATEMENT_TIMEOUT'), 'PLAN_UNEXPECTED_FAILURE');
    proof.state = metrics.some(m => m.failure) ? 'DIAGNOSTIC_COMPLETE_WITH_TIMEOUTS' : 'DIAGNOSTIC_COMPLETE';
  } finally {
    proof.elapsedMs = Date.now() - started; const postflightStarted = Date.now();
    proof.identityUnchanged = identity() === before; proof.certificateUnchanged = closure() === certificate;
    proof.postflight = verify(); proof.postflightElapsedMs = Date.now() - postflightStarted; write();
    assert.ok(proof.identityUnchanged && proof.certificateUnchanged, 'PLAN_DIAGNOSTIC_CHANGED_AUTHORITY');
  }
}
