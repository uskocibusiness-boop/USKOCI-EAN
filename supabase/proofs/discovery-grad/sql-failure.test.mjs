import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sqlFailure} from './sql-failure.mjs';
test('long PostgreSQL context retains the actual error and last exact probe', () => {
  const error = {status: 3, stderr: 'NOTICE: AREA_PROBE:unique:baseline:page:1\nNOTICE: AREA_PROBE:unique:baseline:places:2\nERROR: 57014: canceling statement due to statement timeout\n' + 'CONTEXT reader body\n'.repeat(500)};
  const result = sqlFailure(error, 180001);
  assert.equal(result.timedOut, true); assert.match(result.error, /57014/);
  assert.equal(result.diagnostic.lastProbe, 'NOTICE: AREA_PROBE:unique:baseline:places:2');
  assert.equal(result.status, 3); assert.equal(result.elapsedMs, 180001);
  assert.ok(result.diagnostic.stderrStart.length <= 1200); assert.ok(result.diagnostic.stderrEnd.length <= 700);
});
test('non-timeout SQL error is distinct from process deadline', () => {
  assert.equal(sqlFailure({status: 3, stderr: 'ERROR: 22023: invalid anchor'}, 3).timedOut, false);
  const killed = sqlFailure({code: 'ETIMEDOUT', signal: 'SIGTERM'}, 210000);
  assert.equal(killed.timedOut, true); assert.equal(killed.signal, 'SIGTERM'); assert.equal(killed.status, null);
});
test('arbitrary process message, argv, stdout and env are never included', () => {
  const result = sqlFailure({message: 'SECRET', stdout: 'SECRET', spawnargs: ['SECRET'], env: {KEY: 'SECRET'}}, 4);
  assert.ok(!JSON.stringify(result).includes('SECRET')); assert.equal(result.error, 'SQL_PROCESS_FAILED');
});
