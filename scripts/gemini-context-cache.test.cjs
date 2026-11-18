'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const loadCache = () => import('../supabase/functions/_shared/geminiContextCache.mjs');

const response = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' },
});
const options = (fetcher, overrides = {}) => ({
  geminiApiKey: 'unit-test-key',
  model: 'gemini-3.8-flash',
  purpose: 'NEED_SERVICE',
  catalogVersion: 17,
  catalogFingerprint: 'a'.repeat(32),
  systemInstructionParts: [{ text: 'NEED role instructions and the complete taxonomy tree.' }],
  fetcher,
  ...overrides,
});

test('creates one immutable cache and reuses it inside the Edge isolate', async () => {
  const { getOrCreateGeminiContextCache, clearActiveGeminiCacheHandles } = await loadCache();
  clearActiveGeminiCacheHandles();
  let listCalls = 0, createCalls = 0, createBody;
  const fetcher = async (url, init) => {
    if (init.method === 'GET') { listCalls += 1; return response({ cachedContents: [] }); }
    createCalls += 1;
    createBody = JSON.parse(init.body);
    return response({ name: 'cachedContents/need-v17', expireTime: new Date(Date.now() + 3600000).toISOString() });
  };
  const [first, second] = await Promise.all([
    getOrCreateGeminiContextCache(options(fetcher)),
    getOrCreateGeminiContextCache(options(fetcher)),
  ]);
  assert.equal(first, 'cachedContents/need-v17');
  assert.equal(second, first);
  assert.equal(listCalls, 1);
  assert.equal(createCalls, 1);
  assert.equal(createBody.model, 'models/gemini-3.8-flash');
  assert.equal(createBody.ttl, '3600s');
  assert.equal(createBody.systemInstruction.role, undefined);
  assert.match(createBody.displayName, /^uskoci-need_service-17-/);
  assert.equal(createBody.systemInstruction.parts[0].text, 'NEED role instructions and the complete taxonomy tree.');
  assert.equal(createBody.contents.length, 2);
  assert.equal(createBody.contents[0].role, 'user');
  assert.equal(createBody.contents[1].role, 'model');
  assert.match(createBody.systemInstruction.parts.at(-1).text, /system-generated bootstrap exchange/);
});

test('reuses the same provider cache after a cold Edge isolate restart', async () => {
  const { getOrCreateGeminiContextCache, clearActiveGeminiCacheHandles } = await loadCache();
  clearActiveGeminiCacheHandles();
  let saved;
  const createFetcher = async (url, init) => {
    if (init.method === 'GET') return response({ cachedContents: [] });
    saved = JSON.parse(init.body);
    return response({ name: 'cachedContents/shared-need', expireTime: new Date(Date.now() + 3600000).toISOString() });
  };
  assert.equal(await getOrCreateGeminiContextCache(options(createFetcher)), 'cachedContents/shared-need');
  clearActiveGeminiCacheHandles();
  let createCalls = 0;
  const reuseFetcher = async (url, init) => {
    if (init.method === 'GET') return response({ cachedContents: [{
      name: 'cachedContents/shared-need',
      displayName: saved.displayName,
      model: 'models/gemini-3.8-flash',
      expireTime: new Date(Date.now() + 3600000).toISOString(),
    }] });
    createCalls += 1;
    throw new Error('Should reuse the existing cache');
  };
  assert.equal(await getOrCreateGeminiContextCache(options(reuseFetcher)), 'cachedContents/shared-need');
  assert.equal(createCalls, 0);
});

test('NEED and WORKER or changed catalog/prompt fingerprints never share the same cache', async () => {
  const { getOrCreateGeminiContextCache, clearActiveGeminiCacheHandles } = await loadCache();
  clearActiveGeminiCacheHandles();
  let n = 0;
  const fetcher = async (url, init) => init.method === 'GET'
    ? response({ cachedContents: [] })
    : response({ name: 'cachedContents/cache-' + (++n), expireTime: new Date(Date.now() + 3600000).toISOString() });
  const need = await getOrCreateGeminiContextCache(options(fetcher));
  const worker = await getOrCreateGeminiContextCache(options(fetcher, { purpose: 'WORKER_CAPABILITY' }));
  const newer = await getOrCreateGeminiContextCache(options(fetcher, { catalogVersion: 18 }));
  const changedPrompt = await getOrCreateGeminiContextCache(options(fetcher, { systemInstructionParts: [{ text: 'Updated NEED instructions and tree.' }] }));
  assert.equal(need, 'cachedContents/cache-1');
  assert.equal(worker, 'cachedContents/cache-2');
  assert.equal(newer, 'cachedContents/cache-3');
  assert.equal(changedPrompt, 'cachedContents/cache-4');
});

test('provider cache failure safely falls back to the inline instruction path', async () => {
  const { getOrCreateGeminiContextCache, clearActiveGeminiCacheHandles } = await loadCache();
  clearActiveGeminiCacheHandles();
  const fetcher = async (url, init) => init.method === 'GET'
    ? response({ cachedContents: [] })
    : response({ error: 'not cached' }, 400);
  assert.equal(await getOrCreateGeminiContextCache(options(fetcher)), null);
});

test('prepared-input validation accepts a cachedContent reference without accepting mixed request shapes', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const ts = require('typescript');
  const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/_shared/preparedAiInput.ts'), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const vm = require('node:vm');
  const exports = {};
  vm.runInNewContext(js, { exports, require, crypto: globalThis.crypto });
  const identity = {
    p_account_id: '11111111-1111-4111-8111-111111111111',
    p_conversation_id: '22222222-2222-4222-8222-222222222222',
    p_client_request_id: '33333333-3333-4333-8333-333333333333',
  };
  const input = {
    schemaVersion: 'R06_TEXT_INPUT_V1',
    model: 'gemini-3.8-flash',
    userText: 'Treba mi čišćenje stana.',
    providerRequest: {
      cachedContent: 'cachedContents/test-cache',
      contents: [{ role: 'user', parts: [{ text: 'Treba mi čišćenje stana.' }] }],
      generationConfig: {
        temperature: 0.7, maxOutputTokens: 2048, responseMimeType: 'application/json',
        responseSchema: { type: 'OBJECT' }, thinkingConfig: { thinkingBudget: 0 },
      },
    },
    catalog: null,
    runtime: {
      schemaVersion: 'R06_NEED_RUNTIME_V1', sourceContext: {}, singlePassActive: true,
      pendingClarificationHint: null, timeContext: {}, needsTree: true, maxProposals: 12,
    },
  };
  const hash = 'a'.repeat(64);
  const snapshot = {
    schemaVersion: 'R06_PREPARED_TEXT_V1', purpose: 'NEED_SERVICE',
    accountId: identity.p_account_id, conversationId: identity.p_conversation_id,
    clientRequestId: identity.p_client_request_id,
    turnId: '44444444-4444-4444-8444-444444444444',
    attemptId: '55555555-5555-4555-8555-555555555555',
    sourceIdentity: hash, sourceContext: {},
    input, reservationId: '66666666-6666-4666-8666-666666666666',
    instructionSha256: hash, schemaSha256: hash, catalogSha256: hash,
  };
  const rpc = async name => name === 'rpc_ai_prepare_input_service'
    ? { ok: true, status: 200, data: { state: 'PREPARED', replay: false, inputSha256: hash } }
    : { ok: true, status: 200, data: { state: 'PREPARED', inputSha256: hash, snapshot } };
  const prepared = await exports.prepareAiInput({
    rpc, identity, purpose: 'NEED_SERVICE', userText: input.userText,
    attemptId: snapshot.attemptId, input,
  });
  assert.equal(prepared.snapshot.input.providerRequest.cachedContent, 'cachedContents/test-cache');
  const mixedInput = JSON.parse(JSON.stringify(input));
  mixedInput.providerRequest.systemInstruction = { parts: [{ text: 'must not coexist with cachedContent' }] };
  await assert.rejects(exports.prepareAiInput({
    rpc, identity, purpose: 'NEED_SERVICE', userText: input.userText,
    attemptId: snapshot.attemptId, input: mixedInput,
  }), /R06_INPUT_INVALID/);
});
