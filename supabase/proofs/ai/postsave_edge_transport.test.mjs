// Execute the actual Edge handler and admission driver with synthetic HTTP only.
// No network, real service key, SQL, provider calls or deployment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const names = ['reconcile_reviewed_outbox', 'claim_reviewed_batches', 'commit_reviewed_batch', 'finalize_reviewed_batch'];
const rpcName = i => `rpc_taxonomy_${names[i]}_service`;
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const job = { id: id(1), ownerAccountId: id(2), requestKey: id(3), sourceReviewId: id(4),
  purpose: 'NEED_SERVICE', plans: [{ action: 'REUSE_EXISTING', service: 'Synthetic service', mode: 'ON_SITE', categoryId: id(5) }],
  leaseToken: id(6), attempts: 1 };
const receipt = { status: 'COMMITTED', items: [{ categoryId: id(5), mode: 'ON_SITE' }], catalogVersion: 1,
  capabilityAuthority: 'NONE', needRevisionAuthority: 'NONE', notificationAuthority: 'NONE', requiresBinding: true };
const json = data => new Response(JSON.stringify(data));
const turn = () => new Promise(resolve => setImmediate(resolve));

function fixture({ response, env: overrides = {} } = {}) {
  let handler;
  const calls = [], timers = new Set(), logs = [];
  const env = { SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'SYNTHETIC_PRIVATE_KEY_1234567890',
    USKOCI_TAXONOMY_POSTSAVE_WORKER_ENABLED: 'true', USKOCI_TAXONOMY_CATALOG_ONLY_ACK: 'true',
    USKOCI_TAXONOMY_BINDING_ENABLED: 'false', ...overrides };
  const context = vm.createContext({ Request, Response, URL, TextEncoder, TextDecoder, AbortController,
    console: { info: (...args) => logs.push(args), warn: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    setTimeout: (fn, ms) => { assert.equal(ms, 24000); timers.add(fn); return fn; }, clearTimeout: fn => timers.delete(fn),
    Deno: { env: { get: name => env[name] }, serve: fn => { handler = fn; } },
    fetch: async (url, init) => {
      const name = new URL(url).pathname.split('/').at(-1), args = JSON.parse(init.body);
      calls.push({ name, args, signal: init.signal });
      assert.equal(new URL(url).origin, 'https://synthetic.supabase.co');
      assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error');
      if (response) { const value = response(name, args, init); if (value !== undefined) return value; }
      if (name === rpcName(0)) return json(0);
      if (name === rpcName(1)) return json([job]);
      if (name === rpcName(2)) return json(receipt);
      if (name === rpcName(3)) return json({ outboxId: job.id, status: args.p_error_code === null ? 'COMMITTED'
        : args.p_error_code === 'TEMPORARY_UNAVAILABLE' ? 'RETRY' : 'REVIEW_REQUIRED' });
      assert.fail('Unexpected RPC');
    },
  });
  function evaluate(path, require) {
    const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      fileName: path.replace(/\.mjs$/, '.ts'), reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    });
    assert.deepEqual(compiled.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error), []);
    return new vm.Script(`(function(exports, require) { ${compiled.outputText}; return exports; })`)
      .runInContext(context)({}, require);
  }
  const driver = evaluate('../../functions/_shared/taxonomyPostSaveWorker.mjs', () => assert.fail('Unexpected import'));
  evaluate('../../functions/uskoci-taxonomy-postsave-worker/index.ts', name => {
    assert.equal(name, '../_shared/taxonomyPostSaveWorker.mjs'); return driver;
  });
  const invoke = (options = {}) => handler(new Request('https://synthetic.invalid', { method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY }, ...options }));
  return { calls, timers, logs, invoke, expire() { for (const timer of [...timers]) timer(); } };
}

async function retryReply(response) {
  const f = fixture({ response: name => name === rpcName(2) ? response : undefined });
  const out = await f.invoke();
  assert.equal(out.status, 200);
  const data = await out.json();
  assert.equal(data.retry, 1); assert.equal(data.admitted, 0); assert.equal(data.reviewRequired, 0);
  assert.equal(f.calls[2].args.p_request_key, job.requestKey);
  assert.equal(f.calls[3].args.p_lease_token, job.leaseToken);
  assert.equal(f.calls[3].args.p_error_code, 'TEMPORARY_UNAVAILABLE');
  assert.equal(f.calls.length, 4, 'no automatic commit retry or binder call');
  assert.equal(f.timers.size, 0); assert.deepEqual(f.logs, []);
  return f;
}

test('complete owned catalog-only tick preserves receipt/lease and no binding authority', async () => {
  const f = fixture(); const out = await f.invoke();
  assert.equal(out.status, 200);
  assert.deepEqual(await out.json(), { kind: 'CATALOG_ONLY_TICK', reconciled: 0, claimed: 1, admitted: 1,
    reviewRequired: 0, retry: 0, capabilityAuthority: 'NONE', needRevisionAuthority: 'NONE', notificationAuthority: 'NONE' });
  assert.deepEqual(f.calls.map(c => c.name), names.map((_, i) => rpcName(i)));
  assert.equal(f.timers.size, 0); assert.deepEqual(f.logs, []);
});

test('already cancelled caller cannot dispatch reconciliation or claim writes', async () => {
  const controller = new AbortController(); controller.abort();
  const f = fixture(); const out = await f.invoke({ signal: controller.signal });
  assert.equal(out.status, 503); assert.equal(f.calls.length, 0); assert.equal(f.timers.size, 0);
});

for (const source of ['deadline', 'caller']) {
  test(`${source} abort settles a stalled response body and releases the running gate`, async () => {
    let cancelled = 0, first = true;
    const f = fixture({ response: name => {
      if (name === rpcName(0) && first) { first = false;
        return new Response(new ReadableStream({ cancel() { cancelled++; return new Promise(() => {}); } }));
      }
    } });
    const controller = new AbortController(); let result;
    const pending = f.invoke({ signal: controller.signal }).then(value => { result = value; });
    await turn();
    assert.equal((await f.invoke()).status, 429, 'only one active tick per instance');
    if (source === 'deadline') f.expire(); else controller.abort();
    await turn(); await turn();
    assert.ok(result, 'abort must settle without a cooperative body or cleanup promise');
    await pending;
    assert.equal(result.status, 503); assert.deepEqual(await result.json(), { code: 'TAXONOMY_INTERNAL_UNAVAILABLE' });
    assert.equal(cancelled, 1); assert.equal(f.calls.length, 1); assert.equal(f.timers.size, 0);
    assert.equal((await f.invoke()).status, 200, 'a new tick is allowed after cleanup');
  });
}

for (const stage of [2, 3]) {
  test(`deadline during ${names[stage]} never invents settlement and next claim reuses the same command`, async () => {
    let first = true, cancelled = 0;
    const f = fixture({ response: name => {
      if (name === rpcName(stage) && first) { first = false;
        return new Response(new ReadableStream({ cancel() { cancelled++; } }));
      }
    } });
    let result; const pending = f.invoke().then(value => { result = value; });
    await turn(); assert.equal(f.calls.length, stage + 1); f.expire();
    await turn(); await turn(); assert.ok(result); await pending;
    assert.equal(result.status, 503); assert.equal(cancelled, 1);
    assert.equal(f.calls.length, stage + 1, 'expired tick cannot dispatch another RPC');
    assert.equal(f.calls.filter(c => c.name === rpcName(3)).length, stage === 3 ? 1 : 0);
    const next = await f.invoke(); assert.equal(next.status, 200); assert.equal((await next.json()).admitted, 1);
    const commits = f.calls.filter(c => c.name === rpcName(2));
    assert.equal(commits.length, 2); assert.equal(commits[0].args.p_request_key, commits[1].args.p_request_key);
    assert.deepEqual(f.logs, []);
  });
}

for (const declared of ['32769', 'NaN', '-1', '9007199254740993']) {
  test(`invalid/oversized declared body ${declared} is cancelled and stays retryable`, async () => {
    let cancelled = 0;
    await retryReply(new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'content-length': declared } }));
    assert.equal(cancelled, 1);
  });
}

test('valid JSON with an incomplete declared uncompressed body is not a committed receipt', async () => {
  const raw = JSON.stringify(receipt);
  await retryReply(new Response(raw, { headers: { 'content-length': String(new TextEncoder().encode(raw).length + 1) } }));
});

for (const status of [408, 429, 500, 503]) {
  test(`HTTP ${status} after commit dispatch remains uncertain/retryable with the same key`, async () => {
    await retryReply(new Response('SYNTHETIC_PRIVATE_HTTP_ERROR', { status }));
  });
}

test('explicit nonretryable HTTP refusal preserves review-required outcome', async () => {
  const f = fixture({ response: name => name === rpcName(2) ? new Response(null, { status: 400 }) : undefined });
  const out = await f.invoke(); const data = await out.json();
  assert.equal(data.reviewRequired, 1); assert.equal(data.retry, 0); assert.equal(data.admitted, 0);
  assert.equal(f.calls[3].args.p_error_code, 'BATCH_REVIEW_REQUIRED');
});

for (const [label, response] of [
  ['invalid JSON', () => new Response('{')],
  ['invalid UTF-8', () => new Response(new Uint8Array([0xc3, 0x28]))],
  ['body stream rejection', () => new Response(new ReadableStream({ start(c) { c.error(Error('SYNTHETIC_PRIVATE_ERROR')); } }))],
  ['bodyless success', () => new Response(null)],
  ['decoded oversize', () => new Response(' '.repeat(32769))],
]) {
  test(`${label} is unknown transport, never a semantic rejection`, async () => { await retryReply(response()); });
}

for (const encoding of [null, 'gzip']) {
  test(`complete ${encoding ?? 'identity'} receipt at the decoded byte limit remains valid`, async () => {
    const empty = JSON.stringify({ ...receipt, padding: '' });
    const raw = JSON.stringify({ ...receipt, padding: 'x'.repeat(32768 - new TextEncoder().encode(empty).length) });
    const headers = encoding ? { 'content-length': '100', 'content-encoding': encoding } : { 'content-length': '32768' };
    const f = fixture({ response: name => name === rpcName(2) ? new Response(raw, { headers }) : undefined });
    const out = await f.invoke(); assert.equal(out.status, 200); assert.equal((await out.json()).admitted, 1);
  });
}

for (const flags of [
  { USKOCI_TAXONOMY_POSTSAVE_WORKER_ENABLED: 'false' }, { USKOCI_TAXONOMY_CATALOG_ONLY_ACK: 'false' },
]) {
  test(`existing explicit release gate ${Object.keys(flags)[0]} still disables all RPCs`, async () => {
    const f = fixture({ env: flags }); const out = await f.invoke();
    assert.deepEqual(await out.json(), { kind: 'DISABLED' }); assert.equal(f.calls.length, 0);
  });
}

test('wrong internal key is rejected before all RPCs', async () => {
  const f = fixture(); const out = await f.invoke({ headers: { apikey: 'WRONG' } });
  assert.equal(out.status, 403); assert.equal(f.calls.length, 0);
});
