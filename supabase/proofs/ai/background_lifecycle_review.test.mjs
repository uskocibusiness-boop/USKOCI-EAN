// Executes background persistence and the current post-save Edge source offline.
// No database/provider writes, account data or notifications.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as worker from '../../functions/_shared/taxonomyPostSaveWorker.mjs';
import { persistClarificationHint, persistConsumeClarificationHint,
  getUnconsumedClarificationHint, storeClarificationHint }
  from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';

const hint = conversationId => ({ conversationId, draftRevision: 4, service: 'Krečenje', mode: null,
  ambiguityPrompt: 'Koju prostoriju treba okrečiti?', reason: 'Potrebno je utvrditi obim posla.' });

for (const [label, response] of [
  ['null', null], ['empty', {}], ['boolean', true], ['missing revision', { stored: true }],
  ['wrong revision', { stored: true, draftRevision: 5 }],
  ['string revision', { stored: true, draftRevision: '4' }],
  ['false stored', { stored: false, draftRevision: 4 }],
  ['nonboolean stored', { stored: 1, draftRevision: 4 }],
  ['wrapped error', { ok: false, data: { stored: true, draftRevision: 4 } }],
  ['wrapped empty', { ok: true, data: {} }],
]) {
  test(`hint store ${label} ACK cannot report persistence or warm cache`, async () => {
    const value = hint('store-ack-' + label);
    assert.equal(await persistClarificationHint(async () => response, value), false);
    assert.equal(getUnconsumedClarificationHint(value.conversationId, 4), null);
  });
}

for (const [label, response] of [
  ['null', null], ['empty', {}], ['boolean', true], ['missing revision', { consumed: 1 }],
  ['wrong revision', { consumed: 1, draftRevision: 5 }],
  ['string revision', { consumed: 1, draftRevision: '4' }],
  ['negative count', { consumed: -1, draftRevision: 4 }],
  ['fractional count', { consumed: 0.5, draftRevision: 4 }],
  ['string count', { consumed: '1', draftRevision: 4 }],
  ['missing count', { draftRevision: 4 }],
  ['wrapped error', { ok: false, data: { consumed: 1, draftRevision: 4 } }],
  ['wrapped empty', { ok: true, data: {} }],
]) {
  test(`hint consume ${label} ACK cannot report success or erase cache`, async () => {
    const value = hint('consume-ack-' + label);
    storeClarificationHint(value.conversationId, 4, value);
    assert.equal(await persistConsumeClarificationHint(async () => response, value.conversationId, 4, value.service), false);
    assert.equal(getUnconsumedClarificationHint(value.conversationId, 4)?.service, value.service);
  });
}

for (const wrapped of [false, true]) {
  const transport = ack => wrapped ? { ok: true, data: ack } : ack;
  test(`hint store valid ${wrapped ? 'wrapped' : 'direct'} ACK preserves normalized text and exact revision`, async () => {
    const value = { ...hint('valid-store-' + wrapped), reason: '🧑'.repeat(301) };
    let received;
    assert.equal(await persistClarificationHint(async (name, args) => {
      assert.equal(name, 'rpc_taxonomy_store_classification_turn_hint_service');
      received = args;
      return transport({ stored: true, draftRevision: args.p_draft_revision });
    }, value), true);
    const cached = getUnconsumedClarificationHint(value.conversationId, 4);
    assert.equal(cached.reason, received.p_reason);
    assert.equal(Array.from(cached.reason).length, 300);
    assert.equal(received.p_mode, null);
    assert.equal(received.p_draft_revision, 4);
    assert.equal(getUnconsumedClarificationHint(value.conversationId, 5), null);
  });
  for (const consumed of [0, 1]) {
    test(`hint consume valid ${wrapped ? 'wrapped' : 'direct'} count=${consumed} ACK consumes only exact revision`, async () => {
      const value = hint(`valid-consume-${wrapped}-${consumed}`);
      storeClarificationHint(value.conversationId, 4, value);
      storeClarificationHint(value.conversationId, 5, value);
      assert.equal(await persistConsumeClarificationHint(async (name, args) => {
        assert.equal(name, 'rpc_taxonomy_consume_turn_hint_revision_service');
        assert.equal(args.p_draft_revision, 4);
        return transport({ consumed, draftRevision: 4 });
      }, value.conversationId, 4, value.service), true);
      assert.equal(getUnconsumedClarificationHint(value.conversationId, 4), null);
      assert.equal(getUnconsumedClarificationHint(value.conversationId, 5)?.service, value.service);
    });
  }
}

test('thrown hint consume transport failure leaves the local hint available', async () => {
  const value = hint('consume-thrown');
  storeClarificationHint(value.conversationId, 4, value);
  assert.equal(await persistConsumeClarificationHint(async () => { throw new Error('SYNTHETIC_FAILURE'); },
    value.conversationId, 4, value.service), false);
  assert.equal(getUnconsumedClarificationHint(value.conversationId, 4)?.service, value.service);
});

const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const job = { id: id(1), ownerAccountId: id(2), requestKey: id(3), sourceReviewId: id(4),
  purpose: 'NEED_SERVICE', leaseToken: id(5), attempts: 1,
  plans: [{ service: 'Krečenje', mode: 'ON_SITE', action: 'REUSE_EXISTING', categoryId: id(6), catalogVersion: 3 }] };
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
function fixture(commitResponse) {
  const calls = [];
  const secret = 'SYNTHETIC_SERVICE_KEY_NOT_A_REAL_KEY';
  const env = { SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SERVICE_ROLE_KEY: secret,
    USKOCI_TAXONOMY_POSTSAVE_WORKER_ENABLED: 'true', USKOCI_TAXONOMY_CATALOG_ONLY_ACK: 'true',
    USKOCI_TAXONOMY_BINDING_ENABLED: 'false' };
  let handler;
  const context = vm.createContext({ Request, Response, URL, TextEncoder, TextDecoder, AbortController,
    setTimeout, clearTimeout, exports: {},
    Deno: { env: { get: name => env[name] }, serve: value => { handler = value; } },
    require: name => { assert.equal(name, '../_shared/taxonomyPostSaveWorker.mjs'); return worker; },
    fetch: async (url, init) => {
      const name = new URL(url).pathname.split('/').at(-1);
      const args = JSON.parse(init.body);
      calls.push({ name, args });
      if (name === 'rpc_taxonomy_reconcile_reviewed_outbox_service') return json(0);
      if (name === 'rpc_taxonomy_claim_reviewed_batches_service') return json([job]);
      if (name === 'rpc_taxonomy_commit_reviewed_batch_service') return commitResponse();
      if (name === 'rpc_taxonomy_finalize_reviewed_batch_service') return json({ outboxId: job.id,
        status: args.p_error_code === 'TEMPORARY_UNAVAILABLE' ? 'RETRY' : 'REVIEW_REQUIRED' });
      assert.fail('Unexpected RPC: ' + name);
    },
  });
  const source = readFileSync(new URL('../../functions/uskoci-taxonomy-postsave-worker/index.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInContext(outputText, context);
  return { calls, invoke: () => handler(new Request('https://synthetic.invalid/internal', {
    method: 'POST', headers: { apikey: secret },
  })) };
}

for (const [kind, response] of [
  ['malformed JSON', () => new Response('{')],
  ['invalid UTF-8', () => new Response(new Uint8Array([0xff]))],
  ['response-body transport failure', () => new Response(new ReadableStream({
    start(controller) { controller.error(new Error('SYNTHETIC_PRIVATE_TRANSPORT_DETAIL')); },
  }))],
]) {
  test(`post-save ${kind} keeps the same signed job retryable`, async () => {
    const f = fixture(response);
    const responseValue = await f.invoke();
    assert.equal(responseValue.status, 200);
    const outcome = await responseValue.json();
    const finalize = f.calls.find(call => call.name === 'rpc_taxonomy_finalize_reviewed_batch_service');
    assert.equal(finalize.args.p_error_code, 'TEMPORARY_UNAVAILABLE');
    assert.equal(finalize.args.p_outbox_id, job.id);
    assert.equal(finalize.args.p_lease_token, job.leaseToken);
    assert.equal(outcome.retry, 1);
    assert.equal(outcome.reviewRequired, 0);
    assert.equal(f.calls.filter(call => call.name === 'rpc_taxonomy_commit_reviewed_batch_service').length, 1);
  });
}

for (const [status, expected] of [[400, 'BATCH_REVIEW_REQUIRED'], [403, 'BATCH_REVIEW_REQUIRED'],
  [429, 'TEMPORARY_UNAVAILABLE'], [503, 'TEMPORARY_UNAVAILABLE']]) {
  test(`post-save HTTP ${status} keeps its existing semantic/transport classification`, async () => {
    const f = fixture(() => new Response(JSON.stringify({ code: 'BATCH_SEMANTIC_IDENTITY_MISMATCH' }), { status }));
    const result = await (await f.invoke()).json();
    assert.equal(f.calls.find(call => call.name === 'rpc_taxonomy_finalize_reviewed_batch_service').args.p_error_code, expected);
    assert.equal(result.reviewRequired, expected === 'BATCH_REVIEW_REQUIRED' ? 1 : 0);
    assert.equal(result.retry, expected === 'TEMPORARY_UNAVAILABLE' ? 1 : 0);
  });
}

test('post-save oversized streamed receipt is still bounded and cancels its reader', async () => {
  let cancelled = false;
  const f = fixture(() => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(32769)); },
    cancel() { cancelled = true; },
  })));
  const result = await (await f.invoke()).json();
  assert.equal(result.retry, 1);
  assert.equal(result.admitted, 0);
  assert.equal(cancelled, true);
});

test('post-save declared oversized receipt remains retryable without reading it', async () => {
  let readerCreated = false;
  const f = fixture(() => {
    const response = new Response('{}', { headers: { 'Content-Length': '32769' } });
    response.body.getReader = () => { readerCreated = true; throw new Error('UNEXPECTED_BODY_READ'); };
    return response;
  });
  const result = await (await f.invoke()).json();
  assert.equal(result.retry, 1);
  assert.equal(result.admitted, 0);
  assert.equal(readerCreated, false);
});
