'use strict';
// Actual Edge handler, deterministic RPC/provider seams, no network or hosted DB.
// This measures request counts and synthetic tick timings, not delivery capacity.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { edgeHarness } = require('./r09-push-fixture.cjs');
const before = JSON.parse(fs.readFileSync(path.join(__dirname, 'sql/capacity2_push_edge_v46_20261108.preimage.json'), 'utf8')).entrypoint;
const after = fs.readFileSync(path.join(__dirname, '../supabase/functions/uskoci-push-transport/index.ts'), 'utf8');
const digest = text => crypto.createHash('sha256').update(text).digest('hex');

async function scenario(size, variant, source) {
 const h = edgeHarness({ entrySource: source, providerDelay: 1 });
 for (let i = 0; i < size; i++) h.add('RECEIPT');
 const samples = [], cpuStart = process.cpuUsage(), started = performance.now();
 let peakRss = process.memoryUsage().rss;
 while (h.queues.RECEIPT.length) {
  const start = performance.now();
  const result = await (await h.invoke()).json();
  samples.push(performance.now() - start);
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
  assert.deepEqual(result.failures, { send: 0, receipt: 0 });
  assert.equal(result.processed.receipt, 100);
 }
 const elapsedMs = performance.now() - started, cpu = process.cpuUsage(cpuStart);
 samples.sort((a, b) => a - b);
 const pct = p => samples[Math.min(samples.length - 1, Math.ceil(samples.length * p) - 1)];
 const provider = h.calls.filter(c => c.url.endsWith('/getReceipts'));
 assert.equal(h.completed.length, size);
 assert.equal(new Set(h.completed.map(x => x.p_attempt_id)).size, size);
 return { variant, size, ticks: samples.length, processed: size, failures: 0, uniqueAttempts: size,
  receiptHttpCalls: provider.length, sqlHttpCalls: h.calls.filter(c => !c.url.startsWith('https://exp.host')).length,
  maxReceiptBatch: Math.max(...provider.map(c => c.args.ids.length)), totalElapsedMs: elapsedMs,
  syntheticTickP50Ms: pct(.5), syntheticTickP95Ms: pct(.95), syntheticTickP99Ms: pct(.99),
  harnessCpuUserMs: cpu.user / 1000, harnessCpuSystemMs: cpu.system / 1000, harnessPeakRssBytes: peakRss };
}

(async () => {
 const output = { schema: 'USKOCI_RECEIPT_BATCH_BENCHMARK_V1', executedAt: new Date().toISOString(),
  beforeSha256: digest(before), afterSha256: digest(after),
  boundary: 'Actual Edge handler with mock RPC and Expo; no hosted load, provider delivery, native device, DB CPU or queue-lag measurement.',
  syntheticProviderDelayMs: 1, unchanged: { sendTickLimit: 100, receiptTickLimit: 100, globalSqlLeaseLimit: 6, sendLanes: 4 },
  timingLimitations: 'Ticks run back to back without minute Cron or SQL throttles. One sample for 100; ten for 1000; one hundred for 10000. Harness CPU/RSS includes test arrays and transpilation; not server or phone resources.', scenarios: [] };
 for (const size of [100, 1000, 10000]) for (const [variant, source] of [['before', before], ['after', after]]) {
  const result = await scenario(size, variant, source);
  output.scenarios.push(result);
  console.log(JSON.stringify(result));
 }
 const destination = process.argv[2] ?? path.join(__dirname, 'capacity2-push-receipt-benchmark-20261108.json');
 fs.writeFileSync(destination, JSON.stringify(output, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
