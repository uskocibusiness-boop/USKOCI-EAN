// Real active builders, synthetic catalog/provider only. No model calls or SQL writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFullTreeTaxonomyProposals, buildWorkerFullTreeTaxonomyProposals } from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';

const MAX_BYTES = 524288;
const categoryId = '11111111-1111-4111-8111-111111111111';
const service = 'Popravka klima';
const encoder = new TextEncoder();
let version = 9200000;
const decision = { service, mode: 'ON_SITE', action: 'CREATE_CHILD', parentId: categoryId,
  handoffKind: 'NONE', handoffCity: '', reason: 'Jasna nova usluga pod postojećom granom.' };
const modelText = JSON.stringify({ decisions: [decision], items: [decision] });
function envelope({ finishReason = 'STOP', parts = [{ text: modelText }], padding = '' } = {}) {
  return JSON.stringify({ candidates: [{ finishReason, content: { parts } }], padding });
}
function fixture(t, purpose, provider) {
  const catalogVersion = ++version;
  const calls = [], warnings = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => { calls.push(init); return provider(); });
  t.mock.method(console, 'warn', (...values) => warnings.push(values));
  const args = {
    rpc: async name => {
      assert.equal(name, 'rpc_taxonomy_fetch_snapshot_v1');
      return { ok: true, data: { catalogVersion, catalogFingerprint: String(catalogVersion), count: 1, categories: [
        { categoryId, parentId: null, isLeaf: true, label: 'Servis klima', aliases: [], modes: ['ON_SITE'],
          path: ['Servis klima'], pathIds: [categoryId] },
      ] } };
    },
    geminiKey: 'synthetic', geminiModel: 'synthetic', conversationId: 'synthetic-transport', draftRevision: 4,
  };
  const evidence = 'Popravke klima nudim kod klijenta.';
  return { calls, warnings, run: signal => purpose === 'need'
    ? buildFullTreeTaxonomyProposals({ ...args, signal, items: [{ service, mode: 'ON_SITE' }] })
    : buildWorkerFullTreeTaxonomyProposals({ ...args, signal, skills: [service], messages: [{ role: 'USER', body: evidence }],
      hasWorkAreas: true, serviceModeContext: { savedServices: [], draftServices: [] },
      serviceModeChangesJson: JSON.stringify([{ service, modes: ['ON_SITE'], evidence }]) }) };
}
function assertFailure(result, f, code, status = 'RETRYABLE_PROVIDER') {
  assert.deepEqual(result.proposals, []);
  assert.deepEqual(result.clarifications, []);
  assert.equal(result.clarificationHint, null);
  assert.deepEqual(result.failures, [{ code, status }]);
  assert.equal(f.calls.length, 1, 'no automatic paid retry');
  assert.deepEqual(f.warnings, [['BG_TAXONOMY_PROVIDER_FAILURE', status, code]], 'no provider body/prose in diagnostics');
}
function openResponse(headers, status = 200) {
  let cancelled = 0;
  const response = new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers, status });
  return { response, cancelled: () => cancelled };
}

for (const purpose of ['need', 'worker']) {
  test(`${purpose}: complete STOP joins text parts and split UTF-8, excluding thoughts`, async t => {
    const middle = Math.floor(modelText.length / 2);
    const bytes = encoder.encode(envelope({ parts: [{ text: modelText.slice(0, middle) },
      { text: 'PRIVATE_THOUGHT_MUST_NOT_PARSE', thought: true }, { text: modelText.slice(middle) }], padding: 'Čć💡' }));
    let offset = 0;
    const f = fixture(t, purpose, () => new Response(new ReadableStream({ pull(controller) {
      if (offset === bytes.length) controller.close();
      else controller.enqueue(bytes.slice(offset, ++offset));
    } }), { headers: { 'content-length': String(bytes.length) } }));
    const result = await f.run();
    assert.equal(result.proposals.length, 1);
    assert.equal(result.proposals[0].service, service);
    assert.equal(result.proposals[0].mode, 'ON_SITE');
    assert.deepEqual(result.failures, []);
    assert.equal(f.calls.length, 1);
  });

  test(`${purpose}: exact byte limit remains valid`, async t => {
    const raw = envelope({ padding: 'x'.repeat(MAX_BYTES - encoder.encode(envelope()).byteLength) });
    assert.equal(encoder.encode(raw).byteLength, MAX_BYTES);
    const f = fixture(t, purpose, () => new Response(raw, { headers: { 'content-length': String(MAX_BYTES) } }));
    const result = await f.run();
    assert.equal(result.proposals.length, 1);
    assert.deepEqual(result.failures, []);
  });

  test(`${purpose}: compressed Content-Length is not treated as decoded byte length`, async t => {
    const f = fixture(t, purpose, () => new Response(envelope(), { headers: { 'content-encoding': 'gzip', 'content-length': '100' } }));
    const result = await f.run();
    assert.equal(result.proposals.length, 1);
    assert.deepEqual(result.failures, []);
  });

  for (const finishReason of [undefined, '', null]) {
    test(`${purpose}: missing or empty STOP (${String(finishReason)}) never creates a proposal`, async t => {
      const data = JSON.parse(envelope()); data.candidates[0].finishReason = finishReason;
      const f = fixture(t, purpose, () => new Response(JSON.stringify(data)));
      assertFailure(await f.run(), f, 'PROVIDER_INCOMPLETE_RESULT');
    });
  }

  for (const [finishReason, code, status] of [
    ['MAX_TOKENS', 'PROVIDER_TRUNCATED', 'RETRYABLE_PROVIDER'],
    ['SAFETY', 'PROVIDER_REFUSED', 'PROVIDER_PERMANENT_FAILURE'],
  ]) {
    test(`${purpose}: non-STOP ${finishReason} preserves the existing failure class`, async t => {
      const f = fixture(t, purpose, () => new Response(envelope({ finishReason })));
      assertFailure(await f.run(), f, code, status);
    });
  }

  test(`${purpose}: decoded byte cap rejects oversized multibyte JSON without Content-Length`, async t => {
    const raw = envelope({ padding: '💡'.repeat(MAX_BYTES / 4) });
    assert.ok(raw.length < MAX_BYTES, 'a character-count limit would incorrectly admit this response');
    assert.ok(encoder.encode(raw).byteLength > MAX_BYTES);
    const f = fixture(t, purpose, () => new Response(raw));
    assertFailure(await f.run(), f, 'PROVIDER_BODY_TOO_LARGE');
  });

  for (const [header, code] of [[String(MAX_BYTES + 1), 'PROVIDER_BODY_TOO_LARGE'], ['invalid', 'PROVIDER_INVALID_CONTENT_LENGTH']]) {
    test(`${purpose}: declared body limit ${header} cancels unread body`, async t => {
      const body = openResponse({ 'content-length': header });
      const f = fixture(t, purpose, () => body.response);
      assertFailure(await f.run(), f, code);
      assert.equal(body.cancelled(), 1);
    });
  }

  test(`${purpose}: uncompressed declared truncation rejects otherwise valid JSON`, async t => {
    const raw = envelope();
    const f = fixture(t, purpose, () => new Response(raw, { headers: { 'content-length': String(encoder.encode(raw).byteLength + 10) } }));
    assertFailure(await f.run(), f, 'PROVIDER_INCOMPLETE_RESPONSE');
  });

  test(`${purpose}: invalid UTF-8 inside an otherwise valid JSON string is rejected`, async t => {
    const bytes = Buffer.concat([Buffer.from('{"private":"'), Buffer.from([0xff]), Buffer.from('","payload":null,' + envelope().slice(1))]);
    const f = fixture(t, purpose, () => new Response(bytes));
    assertFailure(await f.run(), f, 'PROVIDER_INVALID_JSON');
  });

  test(`${purpose}: truncated JSON remains a technical failure`, async t => {
    const f = fixture(t, purpose, () => new Response(envelope().slice(0, -1)));
    assertFailure(await f.run(), f, 'PROVIDER_INVALID_JSON');
  });

  test(`${purpose}: interrupted body remains a technical failure`, async t => {
    const f = fixture(t, purpose, () => new Response(new ReadableStream({ start(controller) {
      controller.error(new Error('PRIVATE_BODY_READ_DIAGNOSTIC'));
    } })));
    assertFailure(await f.run(), f, 'PROVIDER_INVALID_JSON');
  });

  for (const [status, classification] of [[429, 'RETRYABLE_PROVIDER'], [403, 'PROVIDER_PERMANENT_FAILURE']]) {
    test(`${purpose}: HTTP ${status} cancels body without reading provider details`, async t => {
      const body = openResponse({}, status);
      const f = fixture(t, purpose, () => body.response);
      assertFailure(await f.run(), f, `PROVIDER_HTTP_${status}`, classification);
      assert.equal(body.cancelled(), 1);
    });
  }

  test(`${purpose}: external abort bounds a noncooperative reader/cancel and rejects its late body`, { timeout: 2000 }, async t => {
    const caller = new AbortController();
    const response = new Response(new ReadableStream());
    let entered, finish, cancellations = 0;
    const reading = new Promise(resolve => { entered = resolve; });
    const pendingRead = new Promise(resolve => { finish = resolve; });
    const getReader = response.body.getReader.bind(response.body);
    t.mock.method(response.body, 'getReader', () => {
      const reader = getReader();
      t.mock.method(reader, 'read', () => { entered(); return pendingRead; });
      t.mock.method(reader, 'cancel', () => { cancellations++; return new Promise(() => {}); });
      return reader;
    });
    const removed = t.mock.method(caller.signal, 'removeEventListener');
    const f = fixture(t, purpose, () => response);
    const pending = f.run(caller.signal);
    await reading;
    caller.abort();
    const result = await pending;
    assertFailure(result, f, 'PROVIDER_ABORTED');
    assert.equal(f.calls[0].signal, caller.signal, 'the existing lifecycle owner is forwarded, not replaced');
    assert.equal(cancellations, 1);
    assert.equal(removed.mock.callCount(), 1);
    finish({ done: false, value: encoder.encode(envelope()) });
    await Promise.resolve();
    assert.deepEqual(result.proposals, []);
    assert.equal(f.calls.length, 1);
  });
}
