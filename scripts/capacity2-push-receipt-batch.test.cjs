'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { edgeHarness, sqlFixture } = require('./r09-push-fixture.cjs');

const receiptCalls = h => h.calls.filter(c => c.url.endsWith('/getReceipts'));
const sqlRpc = f => async (name, args, fallback) => {
 if (name === 'rpc_record_push_readiness') return fallback(name, args);
 if (name === 'rpc_claim_push_transport') return f.claim(args.p_kind);
 if (name === 'rpc_begin_push_send') return f.begin({ attemptId: args.p_attempt_id, leaseId: args.p_lease_id });
 if (name === 'rpc_complete_push_transport') return f.complete({ attemptId: args.p_attempt_id, leaseId: args.p_lease_id }, args.p_result, args.p_ticket_id);
 if (name === 'rpc_get_push_transport_metrics') return f.value('select public.rpc_get_push_transport_metrics() as value');
 assert.fail('Unexpected SQL RPC ' + name);
};

test('captured DEV v46 reproduces one HTTP request per receipt for the same 100-ticket burst', async () => {
 const previous = JSON.parse(readFileSync(path.join(__dirname, 'sql/capacity2_push_edge_v46_20261108.preimage.json'), 'utf8'));
 const h = edgeHarness({ entrySource: previous.entrypoint });
 for (let i = 0; i < 100; i++) h.add('RECEIPT');
 assert.equal((await (await h.invoke()).json()).processed.receipt, 100);
 assert.equal(receiptCalls(h).length, 100);
});

test('100 receipts use seventeen bounded HTTP batches and preserve individual settlement', async () => {
 const h = edgeHarness();
 for (let i = 0; i < 100; i++) h.add('RECEIPT');
 const result = await (await h.invoke()).json();
 assert.deepEqual(result.processed, { send: 0, receipt: 100 });
 assert.deepEqual(result.failures, { send: 0, receipt: 0 });
 assert.equal(receiptCalls(h).length, 17);
 assert.deepEqual(receiptCalls(h).map(c => c.args.ids.length), [...Array(16).fill(6), 4]);
 assert.equal(new Set(receiptCalls(h).flatMap(c => c.args.ids)).size, 100);
 assert.equal(new Set(h.completed.map(c => c.p_attempt_id)).size, 100);
 assert.ok(h.completed.every(c => c.p_result === 'PROVIDER_ACCEPTED'));
 assert.deepEqual(h.logs, []);
});

test('mixed unordered receipt outcomes settle only their own attempt, with missing and malformed entries pending', async () => {
 let tickets;
 const h = edgeHarness({ provider: async (call, { isSend, json }) => {
  assert.equal(isSend, false);
  assert.equal(call.args.ids.length, 6);
  return json({ data: {
   [tickets[5]]: { status: 'ok', unexpected: true },
   [tickets[4]]: { status: 'error', details: { error: 'UnknownProviderState' } },
   [tickets[3]]: { status: 'error', details: { error: 'MessageRateExceeded' } },
   [tickets[2]]: { status: 'error', details: { error: 'DeviceNotRegistered' } },
   [tickets[0]]: { status: 'ok' },
  } });
 } });
 const attempts = Array.from({ length: 6 }, () => h.add('RECEIPT'));
 tickets = attempts.map(a => a.ticketId);
 const result = await (await h.invoke()).json();
 const byId = new Map(h.completed.map(c => [c.p_attempt_id, c.p_result]));
 assert.deepEqual(attempts.map(a => byId.get(a.id)), [
  'PROVIDER_ACCEPTED', 'RECEIPT_PENDING', 'DEVICE_NOT_REGISTERED', 'RECEIPT_RATE_EXCEEDED', 'UNKNOWN', 'RECEIPT_PENDING',
 ]);
 assert.equal(result.processed.receipt, 6);
 assert.equal(receiptCalls(h).length, 1);
 assert.deepEqual(h.observations, ['TICK_DEGRADED']);
});

test('WAIT flushes already held receipts instead of waiting for its own leases', async () => {
 let claims = 0;
 const h = edgeHarness({ rpc: async (name, args, fallback) => {
  if (name === 'rpc_claim_push_transport' && args.p_kind === 'RECEIPT' && ++claims === 4)
   return { kind: 'WAIT', retryAfterMs: 250 };
  return fallback(name, args);
 } });
 for (let i = 0; i < 6; i++) h.add('RECEIPT');
 const result = await (await h.invoke()).json();
 assert.equal(result.processed.receipt, 6);
 assert.deepEqual(receiptCalls(h).map(c => c.args.ids.length), [3, 3]);
});

test('missing/foreign envelopes and HTTP errors never become a new SEND', async () => {
 for (const scenario of ['missing', 'foreign', '429', '500', 'timeout']) {
  const h = edgeHarness({
   setTimeout: (fn, ms, ...args) => setTimeout(fn, ms === 5000 ? 5 : ms, ...args),
   provider: async (call, { isSend, json }) => {
    assert.equal(isSend, false);
    if (scenario === 'timeout') return new Promise(() => {});
    if (scenario === '429' || scenario === '500') return json({}, Number(scenario));
    return json({ data: scenario === 'foreign' ? { unknown_ticket: { status: 'ok' } } : {} });
   },
  });
  for (let i = 0; i < 6; i++) h.add('RECEIPT');
  const result = await (await h.invoke()).json();
  assert.equal(result.processed.receipt, 6, scenario);
  assert.equal(receiptCalls(h).length, 1, scenario);
  assert.ok(h.completed.every(c => c.p_result === 'RECEIPT_PENDING'), scenario);
  assert.equal(h.calls.filter(c => c.url.endsWith('/send')).length, 0, scenario);
 }
});

test('one failed settlement does not discard the other known outcomes in its batch', async () => {
 let failed = false;
 const h = edgeHarness({ rpc: async (name, args, fallback) => {
  if (name === 'rpc_complete_push_transport' && !failed) { failed = true; throw new Error('lost database response'); }
  return fallback(name, args);
 } });
 for (let i = 0; i < 12; i++) h.add('RECEIPT');
 const result = await (await h.invoke()).json();
 assert.equal(receiptCalls(h).length, 1);
 assert.equal(result.processed.receipt, 5);
 assert.equal(result.failures.receipt, 1);
 assert.equal(h.queues.RECEIPT.length, 6, 'stop further claims after settlement failure');
 assert.equal(h.completed.length, 5);
 assert.deepEqual(h.observations, ['TICK_DEGRADED']);
});

test('expired batch leases never settle a stale provider response', async () => {
 const clock = { now: Date.now() };
 const h = edgeHarness({ clock, provider: async (call, { json }) => {
  clock.now += 10000;
  return json({ data: Object.fromEntries(call.args.ids.map(id => [id, { status: 'ok' }])) });
 } });
 for (let i = 0; i < 6; i++) h.add('RECEIPT', { expiry: new Date(clock.now + 1000).toISOString() });
 const result = await (await h.invoke()).json();
 assert.equal(receiptCalls(h).length, 1);
 assert.equal(h.completed.length, 0);
 assert.equal(result.failures.receipt, 6);
});

test('partial claim failure still settles the already collected receipt batch', async () => {
 let claims = 0;
 const h = edgeHarness({ rpc: async (name, args, fallback) => {
  if (name === 'rpc_claim_push_transport' && args.p_kind === 'RECEIPT' && ++claims === 4) throw new Error('claim connection failed');
  return fallback(name, args);
 } });
 for (let i = 0; i < 12; i++) h.add('RECEIPT');
 const result = await (await h.invoke()).json();
 assert.equal(result.processed.receipt, 3);
 assert.equal(result.failures.receipt, 1);
 assert.deepEqual(receiptCalls(h).map(c => c.args.ids.length), [3]);
 assert.equal(h.queues.RECEIPT.length, 9);
});

test('aborted receipt request cannot write any late settlement', async () => {
 const controller = new AbortController();
 let entered;
 const gate = new Promise(resolve => { entered = resolve; });
 const h = edgeHarness({ provider: async () => { entered(); return new Promise(() => {}); } });
 for (let i = 0; i < 6; i++) h.add('RECEIPT');
 const request = h.invoke(undefined, { signal: controller.signal });
 await gate; controller.abort();
 assert.equal((await request).status, 504);
 assert.equal(h.completed.length, 0);
});

test('single-target receipt remains exactly one admitted ticket and never scans global work', async () => {
 const h = edgeHarness();
 h.add('RECEIPT'); h.add('RECEIPT');
 const result = await (await h.invoke({ action: 'single_target_receipt', admissionId: randomUUID() })).json();
 assert.equal(result.kind, 'SINGLE_TARGET_COMPLETED');
 assert.equal(h.completed.length, 1);
 assert.equal(receiptCalls(h).length, 1);
 assert.equal(receiptCalls(h)[0].args.ids.length, 1);
 assert.equal(h.calls.some(c => c.url.endsWith('/rpc_claim_push_transport')), false);
 assert.deepEqual(h.observations, []);
});

test('real SQL leases and mixed SEND/RECEIPT worker preserve six-lease ceiling and recover an uncommitted settle', async () => {
 const f = await sqlFixture();
 try {
  await f.db.exec(f.candidate);
  for (let i = 0; i < 8; i++) await f.delivery(await f.recipient());
  for (let i = 0; i < 8; i++) {
   const claim = await f.claim('SEND');
   await f.begin(claim); await f.complete(claim, 'TICKET', 'batch_fixture_' + i);
  }
  await f.db.exec("update notification_push_attempts set next_attempt_at=clock_timestamp()-interval '1 second';");
  let failed = false, peakLeases = 0;
  const adapter = sqlRpc(f);
  const h = edgeHarness({ rpc: async (name, args, fallback) => {
   if (name === 'rpc_complete_push_transport' && !failed) { failed = true; throw new Error('process stopped before SQL settle'); }
   const value = await adapter(name, args, fallback);
   if (name === 'rpc_claim_push_transport') peakLeases = Math.max(peakLeases, await f.value('select count(*)::integer as value from notification_push_attempts where lease_until>clock_timestamp()'));
   return value;
  } });
  const first = await (await h.invoke()).json();
  assert.equal(first.failures.receipt, 1);
  assert.equal(first.processed.receipt, 5);
  assert.equal(peakLeases, 6);
  assert.equal(receiptCalls(h).length, 1);
  assert.equal(await f.value("select count(*)::integer as value from notification_push_attempts where transport_state='RECEIPT_LEASED'"), 1);
  await f.db.exec("update notification_push_attempts set lease_until=clock_timestamp()-interval '1 second' where transport_state='RECEIPT_LEASED';");
  const second = await (await h.invoke()).json();
  assert.deepEqual(second.processed, { send: 0, receipt: 3 });
  assert.deepEqual(second.failures, { send: 0, receipt: 0 });
  assert.equal(await f.value("select count(*)::integer as value from notification_push_attempts where transport_state='PROVIDER_ACCEPTED' and send_count=1"), 8);
  assert.equal(await f.value('select count(*)::integer as value from notification_deliveries where delivered_at is not null'), 0);
  assert.equal(h.calls.filter(c => c.url.endsWith('/send')).length, 0, 'recover only receipts, never resend ticketed messages');
 } finally { await f.db.close(); }
});

test('real SQL mixed queues keep four SEND lanes progressing while receipt batches flush at the shared ceiling', async () => {
 const f = await sqlFixture();
 try {
  await f.db.exec(f.candidate);
  for (let i = 0; i < 12; i++) {
   await f.delivery(await f.recipient());
   const c = await f.claim('SEND');
   await f.begin(c); await f.complete(c, 'TICKET', 'mixed_fixture_' + i);
  }
  await f.db.exec("update notification_push_attempts set next_attempt_at=clock_timestamp()-interval '1 second';");
  for (let i = 0; i < 12; i++) await f.delivery(await f.recipient());
  let peakLeases = 0;
  const adapter = sqlRpc(f);
  const h = edgeHarness({ providerDelay: 5, rpc: async (name, args, fallback) => {
   const value = await adapter(name, args, fallback);
   if (name === 'rpc_claim_push_transport') peakLeases = Math.max(peakLeases, await f.value('select count(*)::integer as value from notification_push_attempts where lease_until>clock_timestamp()'));
   return value;
  } });
  const result = await (await h.invoke()).json();
  assert.deepEqual(result.processed, { send: 12, receipt: 12 });
  assert.deepEqual(result.failures, { send: 0, receipt: 0 });
  assert.ok(peakLeases <= 6);
  assert.ok(h.peakSend > 1 && h.peakSend <= 4);
  assert.ok(receiptCalls(h).length < 12);
  assert.ok(receiptCalls(h).every(c => c.args.ids.length <= 6));
  assert.equal(await f.value("select count(*)::integer as value from notification_push_attempts where send_count=1"), 24);
  assert.equal(await f.value("select count(*)::integer as value from notification_push_attempts where transport_state='PROVIDER_ACCEPTED'"), 12);
 } finally { await f.db.close(); }
});

test('synthetic 100/1000/10000 receipt bursts retain every ticket across bounded ticks', async t => {
 for (const size of [100, 1000, 10000]) {
  const h = edgeHarness({ providerDelay: 0 });
  for (let i = 0; i < size; i++) h.add('RECEIPT');
  const durations = [], started = performance.now();
  while (h.queues.RECEIPT.length) {
   const before = performance.now();
   const result = await (await h.invoke()).json();
   durations.push(performance.now() - before);
   assert.equal(result.processed.receipt, 100);
   assert.deepEqual(result.failures, { send: 0, receipt: 0 });
  }
  durations.sort((a, b) => a - b);
  const pct = p => durations[Math.min(durations.length - 1, Math.ceil(durations.length * p) - 1)];
  assert.equal(h.completed.length, size);
  assert.equal(new Set(h.completed.map(c => c.p_attempt_id)).size, size);
  assert.equal(receiptCalls(h).length, size / 100 * 17);
  t.diagnostic(JSON.stringify({ boundary: 'actual handler; mock RPC and provider; no live throughput claim', size,
   ticks: durations.length, providerCalls: receiptCalls(h).length, elapsedMs: performance.now() - started,
   tickP50Ms: pct(.5), tickP95Ms: pct(.95), tickP99Ms: pct(.99) }));
 }
});
