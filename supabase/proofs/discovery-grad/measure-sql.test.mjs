import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measureEnvelope, measureSql, measureProgress, measureResult} from './measure-sql.mjs';
import {sqlFailure} from './sql-failure.mjs';
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
for (const runs of [5, 11]) test(`one cold + ${runs} warm statements keep one connection and the first response anchor`, () => {
  const sql = measureSql({viewerId: 'viewer', request: {mode: 'PAGE', text: "O'Grad Љ", anchor: null}, runs, q});
  const blocks = [...sql.matchAll(/do \$dg_measure\$(.*?)end \$dg_measure\$;/gs)];
  assert.equal(blocks.length, runs + 1);
  for (const block of blocks) assert.equal(block[1].match(/public\.rpc_discovery_v1\(/g)?.length, 1);
  assert.equal(sql.match(/^begin;/gm)?.length, 1); assert.equal(sql.match(/^rollback;/gm)?.length, 1);
  assert.equal(sql.match(/req := req \|\| jsonb_build_object\('anchor',previous->'anchor'\)/g)?.length, runs);
  assert.equal(sql.match(/DG_MEASURE_ANCHOR_CHANGED/g)?.length, runs);
  assert.ok(!sql.includes(' loop')); assert.ok(!sql.includes('statement_timeout'));
  assert.ok(sql.includes("O''Grad Љ"));
});
test('statement and process deadlines are separate and bounded', () => {
  assert.deepEqual(measureEnvelope(6), {plannedSamples: 6, statementTimeoutS: 90, processTimeoutMs: 570000});
  assert.equal(measureEnvelope(12).processTimeoutMs, 1110000);
  for (const value of [0, 13, 2.5, '6']) assert.throws(() => measureEnvelope(value));
});
test('timeout retains only bounded process diagnostic and completed numeric markers', () => {
  const stderr = 'NOTICE:  00000: DG_MEASURE_BEGIN:0\nNOTICE:  00000: DG_MEASURE_DONE:0:15321.2\nNOTICE:  DG_MEASURE_BEGIN:1\nERROR:  57014: canceling statement due to statement timeout';
  const progress = measureProgress(stderr, 6);
  assert.deepEqual(progress, {valid: true, plannedSamples: 6, completedSamples: 1, activeSample: 1, completed: [{index: 0, elapsedMs: 15321.2}]});
  const result = measureResult({...sqlFailure({stderr, status: 3}, 105400), measurementProgress: progress}, 5);
  assert.equal(result.status, 3); assert.equal(result.elapsedMs, 105400); assert.equal(result.timedOut, true);
  assert.equal(result.measurementProgress.activeSample, 1); assert.match(result.error, /57014/);
  assert.equal(result.medianMs, undefined); assert.equal(result.plannedSamples, 6);
});
test('marker parser rejects malformed, duplicate, missing-start and out-of-range records without copying text', () => {
  for (const tail of ['DG_MEASURE_DONE:0:1', 'DG_MEASURE_BEGIN:8', 'DG_MEASURE_BEGIN:0:secret', 'DG_MEASURE_BEGIN:0\nNOTICE: DG_MEASURE_BEGIN:0', 'DG_MEASURE_BEGIN:0\nNOTICE: DG_MEASURE_DONE:0:NaN']) {
    const result = measureProgress('NOTICE: ' + tail, 6);
    assert.equal(result.valid, false); assert.ok(!JSON.stringify(result).includes('secret'));
  }
});
test('complete success separates the cold sample from five warm samples', () => {
  const result = measureResult({ok: true, output: 'claims\n' + JSON.stringify({times: [9999, 1, 9, 3, 2, 4], anchor: {timeAt: 'fixed'}, rows: 50})}, 5);
  assert.equal(result.coldMs, 9999); assert.equal(result.medianMs, 3); assert.equal(result.minMs, 1); assert.equal(result.maxMs, 9);
  assert.equal(result.completedSamples, 6); assert.deepEqual(result.anchor, {timeAt: 'fixed'});
});
test('partial or nonnumeric final JSON never produces a successful metric', () => {
  for (const times of [[1], [1, 2, 3, 4, 5, null], [1, 2, 3, 4, 5, '6'], [1, 2, 3, 4, 5, -1]]) {
    assert.throws(() => measureResult({ok: true, output: JSON.stringify({times})}, 5), /MEASURE_COMPLETE_TIMES/);
  }
});
