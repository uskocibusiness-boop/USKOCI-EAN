import test from 'node:test';
import assert from 'node:assert/strict';
import {responseFacts, latencySummary, sampleReadLevel, readErrorKind} from './read-concurrency.mjs';

const request = {mode: 'PAGE', limit: 50, anchor: {timeAt: '2026-10-09T00:00:00.123456Z'}};
const page = {version: 'DISCOVERY_V1', mode: 'PAGE', asOf: '2026-10-09T00:00:01.123456Z', anchor: request.anchor,
  counts: {observedAt: '2026-10-09T00:00:01.123456Z', listed: 2},
  items: [{id: 'one', acceptsApplications: true}, {id: 'two'}], hasMore: true,
  nextCursor: {id: 'two', sortAt: '2026-10-08T20:00:00.123456Z', section: 0, scopeKey: 'original'}};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const levelArgs = {concurrency: 3, cases: [{name: 'page'}, {name: 'map'}], warmupMs: 30, windowMs: 70, deadlineMs: 200};

test('full-response digest masks only validated observation clocks, preserving facts, cursor, anchor and array order', () => {
  const original = responseFacts(page, request), same = structuredClone(page);
  same.asOf = same.counts.observedAt = '2026-10-09T00:00:02.123456Z';
  assert.equal(responseFacts(same, request).digest, original.digest);
  assert.equal(responseFacts(Object.fromEntries(Object.entries(same).reverse()), request).digest, original.digest);
  for (const mutate of [p => p.items.reverse(), p => p.items[0].acceptsApplications = false,
    p => p.nextCursor.sortAt = '2026-10-08T20:00:00.123000Z', p => p.counts.listed++]) {
    const changed = structuredClone(page); mutate(changed);
    assert.notEqual(responseFacts(changed, request).digest, original.digest);
  }
  const anchor = structuredClone(page); anchor.anchor.timeAt = '2026-10-09T00:00:00.123000Z';
  assert.throws(() => responseFacts(anchor, request), /ANCHOR_CHANGED/);
  assert.throws(() => responseFacts({...page, asOf: 'invalid'}, request), /BAD_OBSERVATION_TIME/);
  assert.throws(() => responseFacts({...page, asOf: '2026-10-09T00:00:03Z'}, request), /OBSERVATION_TIME_MISMATCH/);
});

test('MAP bucket members need not equal global mapped population, but cannot exceed it or use unknown kinds', () => {
  const map = {...page, mode: 'MAP', counts: {...page.counts, mapped: 10},
    buckets: [{kind: 'TASK'}, {kind: 'PLACE', taskCount: 3}, {kind: 'CLUSTER', taskCount: 4}]};
  const req = {...request, mode: 'MAP'};
  assert.equal(responseFacts(map, req).members, 8);
  assert.throws(() => responseFacts({...map, buckets: [{kind: 'OTHER', taskCount: 3}]}, req), /BAD_BUCKET_KIND/);
  assert.throws(() => responseFacts({...map, buckets: [{kind: 'PLACE', taskCount: 11}]}, req), /MAP_MEMBERS_EXCEED_POPULATION/);
});

test('percentiles disclose sample sufficiency and retain slow failures when supplied', () => {
  assert.equal(latencySummary([1, 2, 90000]).p95Ms, null);
  assert.equal(latencySummary([]).p50Ms, null);
  assert.deepEqual(latencySummary(Array.from({length: 100}, (_, i) => i + 1)),
    {samples: 100, minMs: 1, p50Ms: 50, p95Ms: 95, p99Ms: 99, maxMs: 100});
});

test('bounded closed loop measures actual in-flight work, separates warmup and retains the drain', async () => {
  let active = 0, peak = 0, calls = 0;
  const result = await sampleReadLevel({...levelArgs, invoke: async () => {
    active++; peak = Math.max(peak, active); calls++; await delay(12); active--;
    return {ok: true, status: 200, jsonBytes: 100};
  }});
  assert.equal(result.result, 'PASS'); assert.equal(peak, 3); assert.equal(result.peakInFlight, 3);
  assert.equal(active, 0); assert.equal(result.outstandingAtReturn, 0);
  assert.equal(result.stopReason, 'WINDOW_COMPLETE'); assert.equal(result.retries, 0);
  assert.ok(result.warmup.started > 0 && result.measured.started > 0);
  assert.equal(result.warmup.started + result.measured.started, calls);
  assert.equal(result.samples.length, calls);
  assert.ok(result.samples.filter(s => s.phase === 'MEASURED').every(s => s.startMs >= result.warmupMs));
  assert.ok(result.samples.every(s => s.startMs < result.warmupMs + result.requestedWindowMs));
  assert.ok(result.averageInFlightDuringWindow > 0 && result.averageInFlightDuringWindow <= 3);
  assert.equal(Object.values(result.byCase).reduce((sum, x) => sum + x.completed, 0), result.measured.completed);
});

test('first transport failure ends admissions, drains existing calls and does not retry or leak arbitrary errors', async () => {
  let calls = 0, active = 0;
  const result = await sampleReadLevel({...levelArgs, invoke: async () => {
    const n = ++calls; active++; await delay(n === 1 ? 3 : 9); active--;
    return n === 1 ? {ok: false, status: 0, code: 'secret token value'} : {ok: true, status: 200};
  }});
  assert.equal(calls, 3); assert.equal(active, 0);
  assert.equal(result.result, 'FAIL'); assert.equal(result.stopReason, 'FIRST_FAILURE_DRAINED');
  assert.equal(result.warmup.failed, 1); assert.equal(result.warmup.successful, 2);
  assert.deepEqual(result.warmup.errors, {UNCLASSIFIED: 1}); assert.equal(result.retries, 0);
  assert.ok(!JSON.stringify(result).includes('secret'));
});

test('hard deadline aborts a hung adapter without pretending server cancellation was proved', async () => {
  let aborted = 0;
  const result = await sampleReadLevel({...levelArgs, deadlineMs: 12, invoke: (_, signal) => {
    signal.addEventListener('abort', () => aborted++);
    return new Promise(() => {});
  }});
  assert.equal(result.result, 'FAIL'); assert.equal(aborted, 3);
  assert.equal(result.warmup.timedOut, 3); assert.equal(result.unconfirmedServerCancellations, 3);
  assert.equal(result.samples.length, 3); assert.equal(result.stopReason, 'FIRST_FAILURE_DRAINED');
});

test('a measured HTTP failure remains in all-latency statistics and its response time is separate from validation', async () => {
  let calls = 0;
  const result = await sampleReadLevel({...levelArgs, concurrency: 1, warmupMs: 1, windowMs: 200,
    invoke: async () => {
      const n = ++calls; await delay(n === 1 ? 5 : 20);
      return n === 1 ? {ok: true, httpElapsedMs: 2} : {ok: false, status: 503, code: 'PGRST003', httpElapsedMs: 13};
    }});
  assert.equal(calls, 2); assert.equal(result.warmup.successful, 1);
  assert.equal(result.measured.failed, 1); assert.equal(result.measured.successful, 0);
  assert.equal(result.measured.latencyAll.samples, 1); assert.equal(result.measured.latencySuccessful.samples, 0);
  assert.equal(result.measured.httpLatencyAll.p50Ms, 13);
  assert.ok(result.measured.latencyAll.p50Ms >= 13);
  assert.deepEqual(result.measured.errors, {PGRST003: 1});
  assert.equal(result.result, 'FAIL');
});

test('measured cap is exact even when many workers complete together', async () => {
  const result = await sampleReadLevel({...levelArgs, warmupMs: 10, windowMs: 300, maxMeasured: 7,
    invoke: async () => { await delay(3); return {ok: true}; }});
  assert.equal(result.measured.started, 7); assert.equal(result.measured.completed, 7);
  assert.equal(result.stopReason, 'SAMPLE_CAP_DRAINED'); assert.equal(result.outstandingAtReturn, 0);
});

test('cancellation classification requires the exact server message and never retains raw content', async () => {
  assert.equal(readErrorKind({code:'57014',message:'canceling statement due to statement timeout'}),'SQL_STATEMENT_TIMEOUT');
  assert.equal(readErrorKind({code:'57014',message:'canceling statement due to user request'}),'SQL_CANCELLED_USER_REQUEST');
  assert.equal(readErrorKind({code:'57014',message:'other cancellation with secret'}),'SQL_CANCELLED_OTHER');
  assert.equal(readErrorKind({code:'55P03',message:'canceling statement due to lock timeout'}),'SQL_LOCK_TIMEOUT');
  assert.equal(readErrorKind({code:'XX000',message:'canceling statement due to statement timeout'}),'OTHER');
  const result=await sampleReadLevel({...levelArgs,concurrency:1,invoke:async()=>({ok:false,status:500,code:'57014',
    errorKind:readErrorKind({code:'57014',message:'canceling statement due to statement timeout'})})});
  assert.deepEqual(result.warmup.errorKinds,{SQL_STATEMENT_TIMEOUT:1});
  assert.equal(result.samples[0].errorKind,'SQL_STATEMENT_TIMEOUT');
  const untrusted=await sampleReadLevel({...levelArgs,concurrency:1,invoke:async()=>({ok:false,code:'57014',errorKind:'secret message'})});
  assert.deepEqual(untrusted.warmup.errorKinds,{OTHER:1});
  assert.ok(!JSON.stringify(untrusted).includes('secret'));
});
