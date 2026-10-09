// Bounded proof-only closed-loop HTTP sampler. No clients, credentials, DB writes or retries here.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {monitorEventLoopDelay, performance} from 'node:perf_hooks';

const round = n => Math.round(n * 100) / 100;
export function latencySummary(values) {
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  const at = p => n ? round(sorted[Math.ceil(p * n) - 1]) : null;
  return {samples: n, minMs: n ? round(sorted[0]) : null, p50Ms: at(.5),
    p95Ms: n >= 20 ? at(.95) : null, p99Ms: n >= 100 ? at(.99) : null,
    maxMs: n ? round(sorted[n - 1]) : null};
}
// JSONB key order is not a contract. Arrays, including their order, are a contract.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export function responseFacts(body, request) {
  assert.equal(body?.version, 'DISCOVERY_V1', 'BAD_VERSION');
  assert.equal(body.mode, request.mode, 'BAD_MODE');
  assert.ok(body.anchor && body.counts && typeof body.asOf === 'string', 'MISSING_ENVELOPE');
  assert.ok(Number.isFinite(Date.parse(body.asOf)) && Number.isFinite(Date.parse(body.counts.observedAt)), 'BAD_OBSERVATION_TIME');
  assert.equal(body.asOf, body.counts.observedAt, 'OBSERVATION_TIME_MISMATCH');
  if (request.anchor) assert.deepEqual(body.anchor, request.anchor, 'ANCHOR_CHANGED');
  const entries = body.mode === 'MAP' ? body.buckets : body.items;
  assert.ok(Array.isArray(entries), 'BAD_ENTRIES');
  assert.ok(entries.length <= (body.mode === 'MAP' ? 256 : request.limit), 'UNBOUNDED_RESPONSE');
  const counted = body.mode === 'MAP' ? body.counts.mapped : body.counts.listed;
  assert.ok(Number.isSafeInteger(counted) && counted >= 0, 'BAD_COUNT');
  let members = null;
  if (body.mode === 'MAP') {
    members = entries.reduce((sum, bucket) => {
      assert.ok(['TASK', 'PLACE', 'CLUSTER'].includes(bucket.kind), 'BAD_BUCKET_KIND');
      const n = bucket.kind === 'TASK' ? 1 : bucket.taskCount;
      assert.ok(Number.isSafeInteger(n) && n > 0, 'BAD_BUCKET_COUNT');
      return sum + n;
    }, 0);
    // mapped is the whole filtered population, including offscreen / no-point rows.
    // The proof caller separately binds bucket members to an authenticated SQL bounds oracle.
    assert.ok(members <= counted, 'MAP_MEMBERS_EXCEED_POPULATION');
  }
  // Only these two observation-clock fields vary between statements. Keep every fact,
  // anchor timestamp, deadline, acceptsApplications flag and the complete cursor.
  const {asOf, ...stable} = body;
  const {observedAt, ...counts} = body.counts;
  stable.counts = counts;
  return {rows: entries.length, counted, members,
    digest: createHash('sha256').update(JSON.stringify(canonical(stable))).digest('hex'),
    jsonBytes: Buffer.byteLength(JSON.stringify(body))};
}

function outcomeCounts(samples) {
  const codes = {};
  for (const s of samples) if (s.outcome !== 'SUCCESS') codes[s.code] = (codes[s.code] ?? 0) + 1;
  return {started: samples.length, completed: samples.length,
    successful: samples.filter(s => s.outcome === 'SUCCESS').length,
    failed: samples.filter(s => s.outcome !== 'SUCCESS').length,
    timedOut: samples.filter(s => s.outcome === 'TIMEOUT').length,
    aborted: samples.filter(s => s.outcome === 'ABORT').length, errors: codes,
    latencyAll: latencySummary(samples.map(s => s.elapsedMs)),
    latencySuccessful: latencySummary(samples.filter(s => s.outcome === 'SUCCESS').map(s => s.elapsedMs)),
    httpLatencyAll: latencySummary(samples.filter(s => s.httpElapsedMs !== null).map(s => s.httpElapsedMs)),
    httpBeyondApplicationDeadline: samples.filter(s => s.httpElapsedMs !== null && s.httpElapsedMs >= 15000).length,
    responseJsonBytes: samples.reduce((sum, s) => sum + (s.jsonBytes ?? 0), 0)};
}

/** invoke receives a bounded AbortSignal and returns only {ok,code,status,jsonBytes}.
 * Warmup is classified by admission time; its late completions never enter measured latency.
 * Outstanding work is drained; a timeout stops admission, and no next level is attempted.
 */
export async function sampleReadLevel({concurrency, cases, invoke, warmupMs = 15000, windowMs = 60000,
  deadlineMs = 90000, maxMeasured = 2048, maxWarmup = 2048}) {
  assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 32);
  for (const n of [warmupMs, windowMs, deadlineMs, maxMeasured, maxWarmup]) assert.ok(Number.isFinite(n) && n > 0);
  assert.ok(deadlineMs <= 90000 && windowMs <= 60000 && warmupMs <= 15000);
  assert.ok(Number.isInteger(maxMeasured) && maxMeasured <= 2048 && Number.isInteger(maxWarmup) && maxWarmup <= 2048);
  assert.ok(cases.length > 0 && cases.every(c => /^[a-zA-Z0-9]+$/.test(c.name)));
  const samples = [], start = performance.now(), measureAt = start + warmupMs, end = measureAt + windowMs;
  const cpuStart = process.cpuUsage(), eluStart = performance.eventLoopUtilization();
  const loop = monitorEventLoopDelay({resolution: 20}); loop.enable();
  let inFlight = 0, peak = 0, area = 0, previous = start, sequence = 0, warmStarted = 0, measuredStarted = 0;
  let stop = false, capAt = null, failureAt = null;
  const occupancy = now => {
    area += Math.max(0, Math.min(now, end) - Math.max(previous, measureAt)) * inFlight;
    previous = now;
  };
  const worker = async () => {
    while (!stop) {
      const admitted = performance.now();
      if (admitted >= end) break;
      const measured = admitted >= measureAt;
      if (measured && measuredStarted >= maxMeasured) { capAt ??= admitted; break; }
      if (!measured && warmStarted >= maxWarmup) {
        await new Promise(resolve => setTimeout(resolve, Math.max(1, measureAt - admitted)));
        continue;
      }
      if (measured) measuredStarted++; else warmStarted++;
      const item = cases[sequence++ % cases.length], controller = new AbortController();
      let timer;
      occupancy(admitted); inFlight++; peak = Math.max(peak, inFlight);
      let result;
      try {
        // A hard promise deadline also bounds a broken adapter that ignores AbortSignal.
        result = await Promise.race([
          Promise.resolve().then(() => invoke(item, controller.signal)),
          new Promise(resolve => { timer = setTimeout(() => {
            controller.abort(); resolve({ok: false, outcome: 'TIMEOUT', code: 'CLIENT_DEADLINE'});
          }, deadlineMs); }),
        ]);
      } catch (error) {
        result = {ok: false, outcome: controller.signal.aborted ? 'TIMEOUT' : 'ERROR',
          code: controller.signal.aborted ? 'CLIENT_DEADLINE' : 'ADAPTER_THROW'};
      } finally { clearTimeout(timer); }
      const completed = performance.now(); occupancy(completed); inFlight--;
      const code = /^[A-Z0-9_]{1,48}$/.test(result?.code ?? '') ? result.code : 'UNCLASSIFIED';
      const outcome = result?.ok ? 'SUCCESS' : controller.signal.aborted ? 'TIMEOUT'
        : ['TIMEOUT', 'ABORT'].includes(result?.outcome) ? result.outcome : 'ERROR';
      samples.push({case: item.name, phase: measured ? 'MEASURED' : 'WARMUP',
        startMs: round(admitted - start), endMs: round(completed - start), elapsedMs: round(completed - admitted),
        outcome, ...(outcome === 'SUCCESS' ? {} : {code}),
        status: Number.isInteger(result?.status) ? result.status : null,
        httpElapsedMs: Number.isFinite(result?.httpElapsedMs) ? round(result.httpElapsedMs) : null,
        jsonBytes: Number.isSafeInteger(result?.jsonBytes) ? result.jsonBytes : 0});
      if (outcome !== 'SUCCESS') { stop = true; failureAt ??= completed; }
    }
  };
  await Promise.all(Array.from({length: concurrency}, worker));
  const finished = performance.now(); occupancy(finished); loop.disable();
  const warm = samples.filter(s => s.phase === 'WARMUP'), measured = samples.filter(s => s.phase === 'MEASURED');
  const elapsedWindow = Math.max(0, Math.min(finished, end) - measureAt);
  const during = samples.filter(s => s.endMs >= warmupMs && s.endMs < warmupMs + windowMs);
  const cpu = process.cpuUsage(cpuStart), elu = performance.eventLoopUtilization(eluStart);
  const output = {targetConcurrency: concurrency, peakInFlight: peak, averageInFlightDuringWindow: elapsedWindow ? round(area / elapsedWindow) : null,
    warmupMs, requestedWindowMs: windowMs, observedWindowMs: round(elapsedWindow),
    totalMs: round(finished - start), drainMs: round(Math.max(0, finished - end)), deadlineMs,
    stopReason: failureAt !== null ? 'FIRST_FAILURE_DRAINED' : capAt !== null ? 'SAMPLE_CAP_DRAINED' : 'WINDOW_COMPLETE',
    outstandingAtReturn: inFlight, maxMeasured, maxWarmup, retries: 0,
    unconfirmedServerCancellations: samples.filter(s => s.outcome === 'TIMEOUT' || s.outcome === 'ABORT').length,
    // Window throughput includes warmup-started completions crossing the measurement boundary.
    completionsDuringWindow: during.length, successfulCompletionsDuringWindow: during.filter(s => s.outcome === 'SUCCESS').length,
    completedRps: elapsedWindow ? round(during.length * 1000 / elapsedWindow) : null,
    successfulRps: elapsedWindow ? round(during.filter(s => s.outcome === 'SUCCESS').length * 1000 / elapsedWindow) : null,
    measured: outcomeCounts(measured), warmup: outcomeCounts(warm),
    byCase: Object.fromEntries([...new Set(cases.map(c => c.name))].map(name => [name, outcomeCounts(measured.filter(s => s.case === name))])),
    generator: {cpuUserMs: round(cpu.user / 1000), cpuSystemMs: round(cpu.system / 1000),
      eventLoopUtilization: round(elu.utilization), eventLoopDelayP99Ms: loop.count ? round(loop.percentile(99) / 1e6) : null,
      eventLoopDelayMaxMs: loop.count ? round(loop.max / 1e6) : null}, samples};
  output.result = warm.some(s => s.outcome !== 'SUCCESS') || measured.some(s => s.outcome !== 'SUCCESS') || !measured.length ? 'FAIL' : 'PASS';
  return output;
}
