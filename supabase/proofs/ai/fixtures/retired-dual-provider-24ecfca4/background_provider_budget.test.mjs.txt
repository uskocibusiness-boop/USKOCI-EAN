// Real builders and production accounting under synthetic transport only.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { isProviderUsageLog } from './provider_usage_log_contract.mjs';
import { buildFullTreeTaxonomyProposals, buildWorkerFullTreeTaxonomyProposals } from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';

const categoryId = '11111111-1111-4111-8111-111111111111';
const service = 'Popravka sintetičkog uređaja';
let version = 9800000;
const identity = { accountId: '33333333-3333-4333-8333-333333333333',
  conversationId: '22222222-2222-4222-8222-222222222222', operationId: '44444444-4444-4444-8444-444444444444',
  supabaseUrl: 'https://accounting.invalid', serviceRoleKey: 'SYNTHETIC', model: 'gemini-3.8-flash' };
function productionBudget(purpose, logs = []) {
  const context = vm.createContext({ TextEncoder, TextDecoder, AbortController, crypto: webcrypto, setTimeout, clearTimeout,
    fetch: (...args) => fetch(...args), console: { info: (...args) => logs.push(JSON.parse(JSON.stringify(args))) } });
  const load = (file, require) => {
    const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    return new vm.Script(`(function(exports,require){${code};return exports;})`).runInContext(context)({}, require);
  };
  const availability = load('../../../src/contracts/aiAvailability.ts', () => assert.fail('unexpected availability import'));
  const stream = load('../../functions/_shared/geminiTaskStream.ts', name => {
    assert.equal(name, '../../../src/contracts/aiAvailability.ts'); return availability;
  });
  const base = load('../../functions/_shared/aiTestBudget.ts', () => assert.fail('unexpected budget import'));
  const api = load('../../functions/_shared/taxonomyProviderBudget.ts', name => {
    if (name === './geminiTaskStream.ts') return stream;
    assert.equal(name, './aiTestBudget.ts'); return base;
  });
  const input = { ...identity, purpose: purpose === 'need' ? 'NEED_INTAKE' : 'PROFILE' };
  return { api, input, budget: api.createBackgroundTaxonomyProviderBudget(input), logs };
}
function accountingTransport(t, { reply = envelope, admission, usageAck, provider } = {}) {
  const calls = [], reservations = new Map(), usage = new Map();
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const body = JSON.parse(init.body), name = new URL(url).pathname.split('/').at(-1);
    calls.push({ name, body, signal: init.signal });
    if (name === 'rpc_ai_test_budget_reserve_service') {
      assert.equal(body.p_account_id, identity.accountId);
      assert.equal(body.p_kind, 'LLM'); assert.equal(body.p_max_cost_microusd, 250000);
      if (admission) return admission(body, init);
      const replay = reservations.has(body.p_operation_id);
      const reservationId = reservations.get(body.p_operation_id) ?? '55555555-5555-4555-8555-555555555555';
      reservations.set(body.p_operation_id, reservationId);
      return Response.json({ admitted: !replay, reservationId, replay, code: replay ? 'AI_TEST_OPERATION_REPLAY' : 'AI_TEST_RESERVED' });
    }
    if (name === 'rpc_ai_test_record_usage_service') {
      assert.ok(reservations.has(body.p_operation_id));
      assert.ok(!usage.has(body.p_operation_id), 'one accounting write, no automatic replay');
      usage.set(body.p_operation_id, body);
      return usageAck ? usageAck(body, init) : Response.json({ operationId: body.p_operation_id, recorded: true, authoritative: true,
        promptTokens: body.p_prompt_tokens, outputTokens: body.p_output_tokens, totalTokens: body.p_total_tokens });
    }
    assert.ok(String(url).startsWith('https://generativelanguage.googleapis.com/'));
    return provider ? provider(init) : Response.json(reply());
  });
  return { calls, reservations, usage, providers: () => calls.filter(x => x.name.endsWith(':generateContent')) };
}
function fixture(purpose, providerBudget, extraMessages = []) {
  const catalogVersion = ++version;
  const args = { providerBudget, geminiKey: 'SYNTHETIC', geminiModel: 'gemini-3.8-flash',
    conversationId: '22222222-2222-4222-8222-222222222222', draftRevision: 4,
    rpc: async name => {
      assert.equal(name, 'rpc_taxonomy_fetch_snapshot_v1');
      return { ok: true, data: { catalogVersion, catalogFingerprint: String(catalogVersion), count: 1, categories: [
        { categoryId, parentId: null, isLeaf: true, label: 'Servis uređaja', aliases: [], modes: ['ON_SITE'],
          path: ['Servis uređaja'], pathIds: [categoryId] },
      ] } };
    } };
  const evidence = `${service} nudim kod klijenta.`;
  return signal => purpose === 'need'
    ? buildFullTreeTaxonomyProposals({ ...args, signal, items: [{ service, mode: 'ON_SITE' }] })
    : buildWorkerFullTreeTaxonomyProposals({ ...args, signal, skills: [service], messages: [{ role: 'USER', body: evidence }, ...extraMessages],
      serviceModeContext: { savedServices: [], draftServices: [] }, hasWorkAreas: true,
      serviceModeChangesJson: JSON.stringify([{ service, modes: ['ON_SITE'], evidence }]) });
}
function envelope() {
  const decision = { service, mode: 'ON_SITE', action: 'CREATE_CHILD', parentId: categoryId,
    reason: 'Konkretna nova usluga pod odgovarajućom postojećom granom.', handoffKind: 'NONE', handoffCity: '' };
  return { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ decisions: [decision], items: [decision] }) }] } }],
    usageMetadata: { promptTokenCount: 100, cachedContentTokenCount: 80, candidatesTokenCount: 20, thoughtsTokenCount: 7, totalTokenCount: 127 } };
}

for (const purpose of ['need', 'worker']) {
  test(`${purpose}: actual BG dispatch reserves first and reports its own usage once`, async t => {
    const events = [], reports = [];
    const providerBudget = {
      beforeAttempt: async () => { events.push('reserve'); return { reservationId: 'BG_RESERVATION' }; },
      onAttempt: async report => { events.push('usage'); reports.push(report); },
    };
    t.mock.method(globalThis, 'fetch', async () => { events.push('provider'); return new Response(JSON.stringify(envelope())); });
    const result = await fixture(purpose, providerBudget)();
    assert.deepEqual(events, ['reserve', 'provider', 'usage']);
    assert.equal(result.proposals.length, 1);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].reservationId, 'BG_RESERVATION');
    assert.deepEqual(reports[0].usageMetadata, envelope().usageMetadata);
    assert.equal(reports[0].dispatched, true);
  });

  test(`${purpose}: real budget and usage parser account BG thinking/cache without touching foreground`, async t => {
    const p = productionBudget(purpose), io = accountingTransport(t);
    const result = await fixture(purpose, p.budget)();
    assert.equal(result.proposals.length, 1);
    assert.deepEqual(io.calls.map(x => x.name), ['rpc_ai_test_budget_reserve_service', 'gemini-3.8-flash:generateContent', 'rpc_ai_test_record_usage_service']);
    const operation = io.calls[0].body.p_operation_id;
    assert.notEqual(operation, identity.operationId);
    assert.equal(operation, await p.api.backgroundTaxonomyOperationId(p.input));
    assert.equal(io.usage.get(operation).p_prompt_tokens, 100, 'cached 80 is already within prompt 100');
    assert.equal(io.usage.get(operation).p_output_tokens, 27, 'candidate 20 plus thought 7');
    assert.equal(io.usage.get(operation).p_total_tokens, 127);
    assert.equal(p.logs.length, 1); assert.ok(isProviderUsageLog(p.logs[0]));
    for (const privateValue of [...Object.values(identity), service]) assert.ok(!JSON.stringify(p.logs).includes(privateValue) || privateValue === identity.model);
  });

  for (const usageMetadata of [undefined, {}, { promptTokenCount: 100, candidatesTokenCount: 20, totalTokenCount: 127 }]) {
    test(`${purpose}: missing/malformed usage stays UNKNOWN and never writes zero or releases`, async t => {
      const p = productionBudget(purpose), io = accountingTransport(t, { reply: () => ({ ...envelope(), usageMetadata }) });
      const result = await fixture(purpose, p.budget)();
      assert.equal(result.proposals.length, 1); assert.equal(io.reservations.size, 1); assert.equal(io.usage.size, 0);
      assert.equal(io.calls.length, 2); assert.equal(p.logs[0][1].usageComplete, false);
      const replay = p.api.createBackgroundTaxonomyProviderBudget(p.input);
      const repeated = await fixture(purpose, replay)();
      assert.equal(repeated.proposals.length, 0); assert.equal(io.providers().length, 1, 'durable reservation rejects a fresh-instance replay');
      assert.equal(io.usage.size, 0);
    });
  }

  test(`${purpose}: valid usage is settled even when STOP or model JSON is invalid`, async t => {
    const p = productionBudget(purpose), data = envelope(); data.candidates[0].finishReason = 'MAX_TOKENS';
    const io = accountingTransport(t, { reply: () => data });
    const result = await fixture(purpose, p.budget)();
    assert.equal(result.proposals.length, 0); assert.equal(io.usage.size, 1);
    assert.equal(p.logs[0][1].outcome, 'FAILED'); assert.equal(p.logs[0][1].usageComplete, true);
  });

  for (const kind of ['missing', 'denied', 'uncertain']) {
    test(`${purpose}: ${kind} admission never dispatches Gemini`, async t => {
      const p = productionBudget(purpose);
      const io = accountingTransport(t, { admission: () => {
        if (kind === 'uncertain') throw new Error('SYNTHETIC_LOST_ACK');
        return Response.json({ admitted: false, replay: false, reservationId: null, code: 'AI_TEST_BUDGET_EXHAUSTED' });
      } });
      const result = await fixture(purpose, kind === 'missing' ? undefined : p.budget)();
      assert.equal(result.proposals.length, 0); assert.equal(io.providers().length, 0); assert.equal(io.usage.size, 0);
      assert.equal(io.calls.length, kind === 'missing' ? 0 : 1);
    });
  }

  test(`${purpose}: lost usage ACK preserves valid result without retry or refund`, async t => {
    const retained = [], priorRuntime = globalThis.EdgeRuntime;
    globalThis.EdgeRuntime = { waitUntil: promise => retained.push(promise) };
    t.after(() => { if (priorRuntime === undefined) delete globalThis.EdgeRuntime; else globalThis.EdgeRuntime = priorRuntime; });
    const p = productionBudget(purpose);
    const io = accountingTransport(t, { usageAck: () => { throw new Error('SYNTHETIC_COMMITTED_ACK_LOST'); } });
    const warnings = []; t.mock.method(console, 'warn', (...values) => warnings.push(values));
    const result = await fixture(purpose, p.budget)();
    assert.equal(retained.length, 1, 'settlement remains alive independently of the semantic result');
    await Promise.all(retained);
    assert.equal(result.proposals.length, 1); assert.equal(io.calls.length, 3); assert.equal(io.usage.size, 1);
    assert.deepEqual(warnings, [['BG_TAXONOMY_ACCOUNTING_UNCONFIRMED']]);
  });

  test(`${purpose}: provider transport loss keeps its own hold UNKNOWN`, async t => {
    const p = productionBudget(purpose), io = accountingTransport(t, { provider: () => { throw new Error('SYNTHETIC_PRIVATE_PROVIDER_ERROR'); } });
    const result = await fixture(purpose, p.budget)();
    assert.equal(result.proposals.length, 0); assert.equal(io.reservations.size, 1); assert.equal(io.usage.size, 0);
    assert.equal(io.providers().length, 1); assert.equal(p.logs[0][1].usageComplete, false);
    assert.ok(!JSON.stringify(p.logs).includes('SYNTHETIC_PRIVATE_PROVIDER_ERROR'));
  });

  test(`${purpose}: aborted noncooperative headers settle UNKNOWN; late response cannot resume`, async t => {
    const p = productionBudget(purpose), abort = new AbortController();
    let started, late, cancelled = 0;
    const dispatched = new Promise(resolve => { started = resolve; });
    const io = accountingTransport(t, { provider: () => { started(); return new Promise(resolve => { late = resolve; }); } });
    const pending = fixture(purpose, p.budget)(abort.signal);
    await dispatched; abort.abort();
    const result = await pending;
    assert.equal(result.proposals.length, 0); assert.equal(io.usage.size, 0); assert.equal(p.logs[0][1].usageComplete, false);
    late(new Response(new ReadableStream({ cancel() { cancelled++; } })));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    assert.equal(cancelled, 1); assert.equal(io.providers().length, 1); assert.equal(p.logs.length, 1);
  });
}

test('BG identity is stable across restart/case, distinct across account/conversation/request/purpose and foreground tool rounds', async () => {
  const p = productionBudget('need'), id = await p.api.backgroundTaxonomyOperationId(p.input);
  assert.match(id, /^[0-9a-f-]{14}8[0-9a-f-]{21}$/);
  assert.equal(await p.api.backgroundTaxonomyOperationId({ ...p.input, operationId: p.input.operationId.toUpperCase() }), id);
  for (const key of ['accountId', 'conversationId', 'operationId']) {
    assert.notEqual(await p.api.backgroundTaxonomyOperationId({ ...p.input, [key]: '77777777-7777-4777-8777-777777777777' }), id);
  }
  assert.notEqual(await p.api.backgroundTaxonomyOperationId({ ...p.input, purpose: 'PROFILE' }), id);
  for (const attempt of [1, 2, 3, 4]) assert.notEqual(await p.api.taxonomyRoundOperationId(identity.accountId, identity.conversationId, identity.operationId, attempt), id);
});

test('Need exact catalog match and validated novel cache hit acquire no extra budget', async t => {
  const p = productionBudget('need'), io = accountingTransport(t);
  const run = fixture('need', p.budget);
  await run(); await run();
  assert.equal(io.calls.length, 3, 'cached decision does not reserve again');
  const exact = await buildFullTreeTaxonomyProposals({ geminiKey: 'SYNTHETIC', geminiModel: identity.model,
    providerBudget: { beforeAttempt: () => assert.fail('exact match must not reserve'), onAttempt: () => assert.fail('no attempt') },
    items: [{ service, mode: 'ON_SITE' }], rpc: async () => ({ ok: true, data: { catalogVersion: ++version,
      catalogFingerprint: String(version), count: 1, categories: [{ categoryId, parentId: null, isLeaf: true,
        label: service, aliases: [], modes: ['ON_SITE'], path: [service], pathIds: [categoryId] }] } }) });
  assert.equal(exact.proposals[0].categoryId, categoryId); assert.equal(io.calls.length, 3);
});

test('oversized BG request is rejected before reservation or provider dispatch', async t => {
  const p = productionBudget('worker'), io = accountingTransport(t);
  const result = await fixture('worker', p.budget, [{ role: 'USER', body: 'x'.repeat(262144) }])();
  assert.equal(result.proposals.length, 0); assert.equal(result.failures[0].code, 'PROVIDER_REQUEST_TOO_LARGE');
  assert.equal(io.calls.length, 0);
});

test('count-only logger failure cannot skip the actual BG usage writer', async t => {
  const p = productionBudget('worker', { push() { throw new Error('SYNTHETIC_LOG_FAILURE'); } });
  const io = accountingTransport(t);
  const result = await fixture('worker', p.budget)();
  assert.equal(result.proposals.length, 1); assert.equal(io.usage.size, 1); assert.equal(io.calls.length, 3);
});
