import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PLAN_MODES, planSessionSql, planResult} from './plan-cache.proof.mjs';
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
const fixture = {viewerId: 'local-test-viewer', request: {mode: 'PLACES', prefix: "O'Grad"},
  oracle: {mode: 'PLACES', anchor: {timeAt: 'fixed'}, items: [], counts: {everywhere: 40000}}, q};
const env = 'DG_PLAN_ENV ' + JSON.stringify({mode: 'auto', role: 'authenticated', statementTimeout: '90s', lockTimeout: '5s'}) + '\n';
test('each mode uses a new invocation with six separate calls, shared anchor/oracle and transaction-local settings', () => {
  for (const mode of PLAN_MODES) {
    const sql = planSessionSql({...fixture, mode});
    assert.equal(sql.match(/do \$dg_plan\$/g)?.length, 6);
    assert.equal(sql.match(/r:=public.rpc_discovery_v1/g)?.length, 6);
    assert.equal(sql.match(/DG_PLAN_RESPONSE_CHANGED/g)?.length, 6);
    assert.equal(sql.match(/DG_PLAN_SESSION_CHANGED/g)?.length, 6);
    assert.ok(sql.includes("set local plan_cache_mode='" + mode + "'"));
    assert.ok(sql.includes("O''Grad")); assert.ok(sql.endsWith('rollback;'));
    assert.ok(!sql.includes('auto_explain')); assert.ok(!sql.includes('statement_timeout='));
    assert.ok(sql.includes("{counts,everywhere}")); assert.ok(!sql.includes("{counts,listed}"));
    assert.ok(sql.includes("isfinite((r->>'asOf')::timestamptz)"));
    assert.ok(sql.includes("(r->>'asOf')::timestamptz is distinct from statement_timestamp()"));
  }
});
test('mode injection and non-PLACES admission fail before generating SQL', () => {
  for (const mode of ['', 'auto; ALTER SYSTEM', 'DEFAULT']) assert.throws(() => planSessionSql({...fixture, mode}));
  assert.throws(() => planSessionSql({...fixture, mode: 'auto', request: {mode: 'PAGE'}}));
});
test('instrumented trace has just one separate call and disables parameter/timing logs', () => {
  const sql = planSessionSql({...fixture, mode: 'force_custom_plan', trace: true});
  assert.equal(sql.match(/r:=public.rpc_discovery_v1/g)?.length, 1);
  assert.ok(sql.includes('auto_explain.log_parameter_max_length=0'));
  assert.ok(sql.includes('auto_explain.log_timing=off'));
  assert.ok(sql.includes('auto_explain.log_buffers=on'));
});
test('sixth-call timeout retains completed samples, never stderr/query payload or a partial successful metric', () => {
  const stderr = Array.from({length: 5}, (_, i) => `NOTICE: DG_MEASURE_BEGIN:${i}\nNOTICE: DG_MEASURE_DONE:${i}:3000`).join('\n')
    + '\nNOTICE: DG_MEASURE_BEGIN:5\nERROR: 57014: canceling statement due to statement timeout\nQUERY: SECRET_RAW_LITERAL';
  const result = planResult({status: 3, stdout: env, stderr}, 105000);
  assert.equal(result.failure, 'STATEMENT_TIMEOUT'); assert.equal(result.sqlstate, '57014');
  assert.equal(result.progress.completedSamples, 5); assert.equal(result.progress.activeSample, 5);
  assert.equal(result.completedResponseComparisons, 5); assert.equal(result.sessionStable, false);
  assert.ok(!JSON.stringify(result).includes('SECRET_RAW_LITERAL'));
});
test('successful metrics require all comparisons, matching timings and session continuity', () => {
  const stderr = Array.from({length: 6}, (_, i) => `NOTICE: DG_MEASURE_BEGIN:${i}\nNOTICE: DG_MEASURE_DONE:${i}:${i+1}`).join('\n');
  const stdout = env + 'DG_PLAN_RESULT ' + JSON.stringify({sessionStable: true, times: [1,2,3,4,5,6]});
  assert.equal(planResult({status: 0, stdout, stderr}, 21).failure, null);
  assert.throws(() => planResult({status: 0, stdout: env, stderr}, 21));
  assert.throws(() => planResult({status: 0, stdout, stderr: stderr.replace('DONE:5:6', 'DONE:5:8')}, 21));
});
test('process timeout and semantic errors are distinct and never accepted as SQL timeout', () => {
  assert.equal(planResult({status: null, error: {code: 'ETIMEDOUT'}}, 900000).failure, 'PROCESS_BUDGET');
  assert.equal(planResult({status: 3, stderr: 'ERROR: P0001: DG_PLAN_RESPONSE_CHANGED'}, 12).failure, 'RESPONSE_CHANGED');
});
