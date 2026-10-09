import assert from 'node:assert/strict';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {responseFacts, sampleReadLevel} from './read-concurrency.mjs';

export const MIX = ['pageDefault', 'pageDefault', 'pageSecond', 'pageTextCiscenje', 'pageTextNoHit',
  'pagePlaceCity', 'mapDefault', 'mapDefault', 'mapCityDense', 'mapCityDense'];

export async function proveReadConcurrency({env, client, requests, report, write, verify, visible}) {
  assert.equal(env.DG_READ_CONCURRENCY, 'DISPOSABLE_READ_CONCURRENCY');
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.DB_URL);
  assert.equal(env.DB_URL, env.RU5_DEVICE_DB_URL);
  assert.equal(report.tasks, 40000);
  assert.equal(report.baseline.readerMd5, 'a9b0985991f4ebfe4e95143e5cf57222');
  assert.ok(!env.DG_AREA_EXPERIMENT, 'SEPARATE_EXPERIMENTS');
  const concurrency = report.readConcurrency = {state: 'RUNNING', levels: [], mix: MIX,
    sourceSha: report.sourceSha, syntheticTaskRows: 40000, scenarioAuthAccounts: 2, activeViewerAccounts: 1,
    plannedParallelRequests: [1, 4, 16, 32], sqlPublishedFixtures: true, schedulersPaused: true,
    lifecycleMutations: 0, providerCalls: 0, pushSends: 0, retries: 0,
    applicationDeadlineMs: 15000,
    deadlineSource: 'src/data/discoveryV1ClientTransport.ts: DISCOVERY_V1_READ_DEADLINE_MS=15_000. The proof permits90s to observe saturation; semantic PASS is not application responsiveness acceptance.',
    latencyScope: 'httpLatencyAll ends when the Supabase HTTP client returns (JSON decoding included); latencyAll additionally includes canonicalization/semantic verification. Hard client deadlines with no return are retained in latencyAll and timeout counts.',
    compared: 'Complete canonical JSON; only asOf and counts.observedAt omitted after timestamp validation; anchor, cursor, item and bucket order retained.',
    limits: 'Closed-loop clients on the same shared CI host as PostgreSQL/PostgREST; queuing and coordinated omission are not corrected. Not 40000 users, production capacity, lifecycle throughput, background-worker or native performance. CPU/loop metrics describe the Node generator only; JSON bytes are reserialized body sizes, not wire bytes. Client abort does not prove server cancellation.',
    host: {node: process.version, platform: process.platform, architecture: process.arch,
      logicalCpus: os.cpus().length, availableParallelism: os.availableParallelism(), memoryBytes: os.totalmem()},
    before: verify()};
  write();
  const call = async request => client.rpc('rpc_discovery_v1', {p_request: request}).abortSignal(AbortSignal.timeout(90000));
  try {
    for (const parallel of concurrency.plannedParallelRequests) {
      // Fresh complete oracle/anchor set per level, outside timed work. No retries even here.
      const cases = {};
      for (const name of [...new Set(MIX)].filter(n => n !== 'pageSecond')) {
        const request = structuredClone(requests[name]);
        const r = await call(request);
        assert.ok(!r.error, 'CONCURRENCY_ORACLE_HTTP_FAILED:' + name + ':' + r.status);
        const oracle = responseFacts(r.data, request);
        if (name === 'pageDefault') {
          assert.equal(oracle.rows, 50); assert.equal(r.data.hasMore, true); assert.ok(r.data.nextCursor);
          assert.equal(oracle.counted, visible(r.data.anchor, null), 'ORACLE_ALL_COUNT');
          const second = {...request, anchor: r.data.anchor, after: r.data.nextCursor};
          const r2 = await call(second);
          assert.ok(!r2.error, 'CONCURRENCY_SECOND_PAGE_ORACLE_FAILED');
          const secondFacts = responseFacts(r2.data, second);
          assert.equal(secondFacts.rows, 50); assert.equal(secondFacts.counted, oracle.counted);
          const firstIds = new Set(r.data.items.map(item => item.id));
          assert.equal(firstIds.size, 50);
          assert.equal(new Set(r2.data.items.map(item => item.id)).size, 50);
          assert.ok(r2.data.items.every(item => !firstIds.has(item.id)), 'PAGE_OVERLAP');
          cases.pageSecond = {name: 'pageSecond', request: second, oracle: secondFacts};
        }
        if (request.mode === 'MAP') assert.equal(oracle.members, visible(r.data.anchor, request.bounds), 'ORACLE_MAP_MEMBERS:' + name);
        if (name === 'pageTextNoHit') { assert.equal(oracle.rows, 0); assert.equal(oracle.counted, 0); }
        cases[name] = {name, request: {...request, anchor: r.data.anchor}, oracle};
      }
      const level = await sampleReadLevel({concurrency: parallel, cases: MIX.map(name => cases[name]),
        invoke: async (item, signal) => {
          const started = performance.now();
          const r = await client.rpc('rpc_discovery_v1', {p_request: item.request}).abortSignal(signal);
          const httpElapsedMs = performance.now() - started;
          if (r.error) return {ok: false, status: r.status, httpElapsedMs,
            code: r.status === 0 ? 'TRANSPORT' : /^[A-Z0-9_]{1,32}$/.test(r.error.code ?? '') ? r.error.code : 'HTTP_ERROR'};
          try {
            const facts = responseFacts(r.data, item.request);
            assert.equal(facts.digest, item.oracle.digest, 'FACTS_CHANGED');
            return {ok: true, status: r.status, jsonBytes: facts.jsonBytes, httpElapsedMs};
          } catch { return {ok: false, code: 'SEMANTIC_MISMATCH', status: r.status, httpElapsedMs}; }
        }});
      // Store no task IDs, request anchors, Auth tokens or response bodies.
      level.oracles = Object.fromEntries(Object.entries(cases).map(([name, c]) => [name, c.oracle]));
      concurrency.levels.push(level); write();
      assert.equal(level.result, 'PASS', 'READ_CONCURRENCY_FAILED:' + parallel);
      assert.equal(level.unconfirmedServerCancellations, 0);
      assert.equal(level.peakInFlight, parallel);
      assert.equal(level.stopReason, 'WINDOW_COMPLETE', 'READ_CONCURRENCY_INCOMPLETE_WINDOW');
      assert.ok(Object.values(level.byCase).every(c => c.started > 0), 'MIX_NOT_EXERCISED');
    }
    concurrency.after = verify();
    assert.deepEqual(concurrency.after, concurrency.before, 'CONCURRENCY_MOVED_FIDELITY');
    concurrency.state = 'SEMANTICS_PASS_PERFORMANCE_REPORTED';
  } catch (error) { concurrency.state = 'FAIL'; throw error; }
  finally { write(); }
}

export function readConcurrencySummary(result) {
  const lines = ['\n### Authenticated HTTP read concurrency', '', result.limits, '', result.latencyScope, '',
    '| Target parallel | Peak in flight | Mean in flight | Completed/s | Successful/s | Measured successes/failures | p50/p95/p99 ms (all) | Drain ms | State |',
    '|---:|---:|---:|---:|---:|---|---|---:|---|'];
  for (const level of result.levels) {
    const m = level.measured, p = m.latencyAll;
    lines.push(`| ${level.targetConcurrency} | ${level.peakInFlight} | ${level.averageInFlightDuringWindow} | ${level.completedRps} | ${level.successfulRps} | ${m.successful}/${m.failed} | ${p.p50Ms}/${p.p95Ms ?? 'insufficient samples'}/${p.p99Ms ?? 'insufficient samples'} | ${level.drainMs} | ${level.result} |`);
  }
  return lines.join('\n') + '\n';
}
