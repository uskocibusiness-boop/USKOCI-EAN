// Exact current task/worker handlers and shared code; every transport is synthetic.
// No remote DB/provider call, elapsed nine-second sleep or canonical writer proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOwnedIntakeHandler } from './owned_intake_edge_runtime.mjs';
import { loadWorkerRecoveryHandler } from './worker_recovery_edge_runtime.mjs';
import { withDialogue } from './dialogue_fixture.mjs';

const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const account = id(1), conversation = id(2), requestKey = id(3), turnId = id(4), attemptId = id(5), parentId = id(20);
const service = 'Izrada papirnih modela';
const userText = 'Izrađujem papirne modele na daljinu i šaljem poštom unutar Srbije.';
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(purpose, outcome = 'SUCCEEDED', { pendingHint = false, background = true } = {}) {
  const worker = purpose === 'worker';
  const calls = [], logs = [], waits = [], timers = new Map(), timerHistory = [];
  const bgStarted = deferred(), releaseBg = deferred(), releaseCompletion = deferred();
  const abort = new AbortController();
  let bgSignal, mainProviderCalls = 0, backgroundProviderCalls = 0, timerId = 0;
  const env = { SUPABASE_URL: 'https://leqcwgzvjsxugfgzdmth.supabase.co', SUPABASE_ANON_KEY: 'SYNTHETIC_PUBLIC',
    SUPABASE_SERVICE_ROLE_KEY: 'SYNTHETIC_SERVICE', AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'SYNTHETIC_PROVIDER',
    GEMINI_MODEL: 'gemini-3.8-flash', USKOCI_GEMINI_PAID_TEST_ENABLED: 'true' };
  const workerTurn = state => ({ turnId, conversationId: conversation, clientRequestId: requestKey, attemptId,
    state, retryAllowed: false, authoritative: true });
  const taskTurn = (state, body = {}) => ({ conversationId: conversation, clientRequestId: requestKey, state, turnId,
    retryAllowed: state === 'FAILED', receipt: state === 'SUCCEEDED' ? { userMessageId: id(6), assistantMessageId: id(7),
      proposedCount: body.p_proposals?.length ?? 0, safety: 'ALLOW', schemaVersion: 'NEED_FACT_V2', authoritative: true } : null });
  const snapshot = { catalogVersion: 7, catalogFingerprint: 'a'.repeat(32), categories: [{ categoryId: parentId,
    parentId: null, label: 'Ručni rad', aliases: [], path: ['Ručni rad'], isLeaf: true, modes: ['REMOTE'] }] };
  const modeContext = { schemaVersion: 'WORKER_SERVICE_MODE_CONTEXT_V1', revision: 0,
    savedServices: [], draftServices: [], unresolvedServices: [] };
  const mainOutput = worker ? { assistantMessage: 'Predlog usluge je u nacrtu.', safety: 'ALLOW', patch: { skills: [service] },
    availabilityChange: { kind: 'NONE', evidence: '' }, serviceModeChangesJson: JSON.stringify([{ service,
      modes: ['REMOTE'], evidence: userText, handoff: { required: true, shippingCountries: ['RS'] } }]) }
    : withDialogue({ safety: 'ALLOW', assistantMessage: 'Vrsta usluge je u nacrtu.', facts: [{ key: 'need.category',
      valueJson: JSON.stringify(service), displayValue: service, evidence: userText, confidence: 1 }] });
  if (!background) {
    if (worker) { mainOutput.patch = {}; mainOutput.serviceModeChangesJson = '[]'; }
    else mainOutput.facts = [];
  }
  const providerResponse = output => json({ candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] }, finishReason: 'STOP' }] });
  const fetch = async (input, init = {}) => {
    const url = String(input), body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, body, signal: init.signal, abortedAtCall: init.signal?.aborted });
    if (url.endsWith('/auth/v1/user')) return json({ id: account });
    if (url.includes('/ai_conversations?')) return json([{ id: conversation, account_id: account,
      status: 'OPEN', fact_schema_version: 'NEED_FACT_V2' }]);
    if (url.endsWith('/rpc_ai_claim_need_turn_v2_service')) return json({ turn: taskTurn('PROCESSING'), claim: { attemptId,
      leaseExpiresAt: '2099-10-27T12:00:00Z', context: { schemaVersion: 'NEED_FACT_V2', history: [], activeFacts: [{
        fact_key: 'need.task_geography', fact_value: { mode: 'REMOTE' }, value_type: 'JSON', display_value: 'Na daljinu',
        fact_schema_version: 'NEED_FACT_V2', status: 'CONFIRMED', source: 'EXPLICIT_USER_ANSWER', created_at: '2026-10-27T00:00:00Z',
      }] } } });
    if (url.endsWith('/rpc_claim_worker_ai_turn_service')) return json({ acquired: true, turn: workerTurn('PROCESSING') });
    if (url.endsWith('/rpc_read_worker_ai_context_service')) return json({ schemaVersion: 'WORKER_PROFILE_V1',
      accountId: account, conversationId: conversation, status: 'OPEN', stale: false, safety: 'ALLOW', revision: 0,
      serviceModeContext: modeContext, candidate: { skills: [], availability: { timezone: 'Europe/Belgrade', rules: [], windows: [] } },
      messages: [{ role: 'USER', body: userText }] });
    if (url.endsWith('/rpc_ai_dispatch_need_turn_v2_service')) return json(true);
    if (url.endsWith('/rpc_dispatch_worker_ai_turn_service')) return json({ dispatched: true, turn: workerTurn('PROCESSING') });
    if (url.endsWith('/rpc_ai_test_budget_reserve_service')) return json({ admitted: true, reservationId: id(8), replay: false, code: 'AI_TEST_RESERVED' });
    if (url.endsWith('/rpc_taxonomy_fetch_snapshot_v1')) return json(snapshot);
    if (url.endsWith('/rpc_taxonomy_get_unconsumed_turn_hint_service')) return json(pendingHint ? {
      conversationId: conversation, draftRevision: 0, service, mode: 'REMOTE',
      ambiguityPrompt: 'Koju vrstu papirnih modela izrađujete?', reason: 'Preciziranje obima usluge.',
    } : null);
    if (url.endsWith('/rpc_taxonomy_consume_turn_hint_revision_service')) return json({ consumed: 1, draftRevision: body.p_draft_revision });
    if (url.endsWith('/rpc_ai_fail_need_turn_v2_service')) return json(taskTurn('FAILED'));
    if (url.endsWith('/rpc_fail_worker_ai_turn_service')) return json(workerTurn('FAILED'));
    if (url.endsWith('/rpc_ai_test_record_usage_service')) return json({ recorded: true, authoritative: true,
      operationId: requestKey, promptTokens: body.p_prompt_tokens, outputTokens: body.p_output_tokens, totalTokens: body.p_total_tokens });
    if (/\/rpc_(?:ai_complete_need_turn_v2|complete_worker_ai_turn)_service$/.test(url)) {
      if (background) await bgStarted.promise;
      if (outcome === 'HOLD') await releaseCompletion.promise;
      if (outcome === 'ABORT') abort.abort();
      if (outcome === 'THROW' || outcome === 'ABORT') throw new Error('SYNTHETIC_COMPLETION_TRANSPORT');
      if (outcome === 'INVALID') return json({ invalid: true });
      return json(worker ? workerTurn(outcome === 'HOLD' ? 'SUCCEEDED' : outcome) : taskTurn(outcome === 'HOLD' ? 'SUCCEEDED' : outcome, body));
    }
    if (url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service')) return json({ action: 'HINT_CAPTURED', authority: 'NONE' });
    if (url.startsWith('https://generativelanguage.googleapis.com/')) {
      const background = !!body.generationConfig?.responseSchema?.properties?.decisions
        || !!body.generationConfig?.responseSchema?.properties?.items;
      if (background) {
        backgroundProviderCalls++;
        bgSignal = init.signal;
        init.signal.addEventListener('abort', () => releaseBg.resolve(), { once: true });
        bgStarted.resolve();
        await releaseBg.promise;
        if (init.signal.aborted) throw Object.assign(new Error('SYNTHETIC_BG_ABORT'), { name: 'AbortError' });
        const decision = { service, mode: 'REMOTE', action: 'CREATE_CHILD', parentId,
          reason: 'Nova konkretna usluga pod potvrđenim roditeljem.', handoffKind: 'SHIPPING_RS', handoffCity: '' };
        return providerResponse(worker ? { items: [decision] } : { decisions: [decision] });
      }
      mainProviderCalls++;
      if (url.includes(':streamGenerateContent')) return new Response('data: ' + JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(mainOutput) }] }, finishReason: 'STOP' }],
      }) + '\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
      return providerResponse(mainOutput);
    }
    assert.fail('Unexpected synthetic route: ' + new URL(url).pathname);
  };
  const loaded = (worker ? loadWorkerRecoveryHandler : loadOwnedIntakeHandler)({ fetch, env: name => env[name],
    log: value => logs.push(value), EdgeRuntime: { waitUntil: promise => waits.push(promise) },
    setTimeout: (fn, ms) => { const timer = { fn, ms, id: ++timerId }; timers.set(timer.id, timer); timerHistory.push(timer); return timer.id; },
    clearTimeout: handle => timers.delete(handle) });
  const request = new Request('https://edge.invalid', { method: 'POST', signal: abort.signal,
    headers: { Authorization: 'Bearer SYNTHETIC', Accept: 'text/event-stream', 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId: conversation, clientRequestId: requestKey, text: userText }) });
  const invoke = async () => {
    const response = await loaded.handler(request), reader = response.body.getReader(), decoder = new TextDecoder();
    // A disconnected caller stops reading; the worker intentionally stops emitting
    // on its aborted stream. Do not mistake that client disconnect for a BG leak.
    const cancelRead = () => { void reader.cancel(); };
    abort.signal.addEventListener('abort', cancelRead, { once: true });
    if (abort.signal.aborted) cancelRead();
    let text = '';
    try { for (;;) { const part = await reader.read(); if (part.done) break; text += decoder.decode(part.value, { stream: true }); } }
    finally { abort.signal.removeEventListener('abort', cancelRead); }
    return { status: response.status, text };
  };
  const captures = () => calls.filter(call => call.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'));
  const drain = async () => { releaseCompletion.resolve(); releaseBg.resolve(); for (let i = 0; i < 8; i++) await flush(); await Promise.all(waits); };
  return { ...loaded, invoke, bgStarted, releaseBg, releaseCompletion, abort, calls, logs, waits, timers, timerHistory, captures, drain,
    get bgSignal() { return bgSignal; }, get providerCalls() { return { main: mainProviderCalls, background: backgroundProviderCalls }; } };
}

for (const purpose of ['task', 'worker']) {
  for (const outcome of ['THROW', 'INVALID', 'ABORT', ...(purpose === 'task' ? ['PROCESSING', 'FAILED'] : [])]) {
    test(`${purpose}: ${outcome} completion aborts already-started classification without capturing`, { timeout: 5000 }, async t => {
      const f = fixture(purpose, outcome, { pendingHint: true });
      t.after(() => f.drain());
      const result = await f.invoke();
      assert.deepEqual(f.providerCalls, { main: 1, background: 1 });
      assert.equal(f.captures().length, 0);
      assert.equal(f.calls.filter(call => call.url.endsWith('/rpc_taxonomy_consume_turn_hint_revision_service')).length, 0);
      t.diagnostic(JSON.stringify({ purpose, outcome, bgAborted: f.bgSignal?.aborted,
        backgroundTimers: f.timerHistory.filter(timer => timer.ms === 9000).length, waitUntilCalls: f.waits.length }));
      assert.equal(f.bgSignal.aborted, true, 'unconfirmed completion must retire its background controller');
      assert.ok(!result.text.includes('"kind":"final"'));
      assert.equal([...f.timers.values()].filter(timer => timer.ms === 9000).length, 0);
      await f.drain();
      assert.equal(f.captures().length, 0, 'late background result cannot capture an unconfirmed turn');
    });
  }

  test(`${purpose}: confirmed completion detaches live background until capture then clears its deadline`, { timeout: 5000 }, async t => {
    const f = fixture(purpose);
    t.after(() => f.drain());
    const result = await f.invoke();
    assert.deepEqual(f.providerCalls, { main: 1, background: 1 });
    assert.ok(result.text.includes('"kind":"final"'));
    assert.equal(f.bgSignal.aborted, false, 'normal stream close cannot cancel confirmed background work');
    assert.equal(f.captures().length, 0);
    assert.equal(f.waits.length, 1, 'the unfinished background promise must be registered with EdgeRuntime');
    f.abort.abort();
    assert.equal(f.bgSignal.aborted, false, 'confirmed background is no longer owned by the request signal');
    f.releaseBg.resolve();
    await f.drain();
    assert.equal(f.captures().length, 1);
    assert.equal([...f.timers.values()].filter(timer => timer.ms === 9000).length, 0);
  });

  test(`${purpose}: background deadline starts before held completion, not after it`, { timeout: 5000 }, async t => {
    const f = fixture(purpose, 'HOLD', { pendingHint: true });
    const running = f.invoke();
    t.after(async () => { await f.drain(); await running; });
    await f.bgStarted.promise;
    const deadline = [...f.timers.values()].find(timer => timer.ms === 9000);
    assert.ok(deadline, 'background provider already started: its total time budget must already exist');
    deadline.fn();
    assert.equal(f.bgSignal.aborted, true);
    f.releaseCompletion.resolve();
    await running;
    await f.drain();
    assert.equal(f.captures().length, 0);
    const consumed = f.calls.filter(call => call.url.endsWith('/rpc_taxonomy_consume_turn_hint_revision_service'));
    assert.equal(consumed.length, 1, 'confirmed turn metadata survives the exhausted classifier budget');
    assert.deepEqual(consumed[0].body, { p_conversation_id: conversation, p_draft_revision: 0, p_service: service });
    assert.equal(consumed[0].abortedAtCall, false);
  });

  test(`${purpose}: request abort cancels classification immediately while completion is held`, { timeout: 5000 }, async t => {
    const f = fixture(purpose, 'HOLD');
    const running = f.invoke();
    t.after(async () => { await f.drain(); await running; });
    await f.bgStarted.promise;
    assert.equal(f.bgSignal.aborted, false);
    f.abort.abort();
    assert.equal(f.bgSignal.aborted, true, 'BG cancellation cannot wait for a completion response');
    assert.equal([...f.timers.values()].filter(timer => timer.ms === 9000).length, 0);
    f.releaseCompletion.resolve();
    await running;
    await f.drain();
    assert.equal(f.captures().length, 0);
  });

  test(`${purpose}: successful no-background turn still consumes only its prior revision hint`, { timeout: 5000 }, async t => {
    const f = fixture(purpose, 'SUCCEEDED', { pendingHint: true, background: false });
    t.after(() => f.drain());
    const result = await f.invoke();
    assert.ok(result.text.includes('"kind":"final"'));
    assert.deepEqual(f.providerCalls, { main: 1, background: 0 });
    await f.drain();
    const consumed = f.calls.filter(call => call.url.endsWith('/rpc_taxonomy_consume_turn_hint_revision_service'));
    assert.equal(consumed.length, 1);
    assert.deepEqual(consumed[0].body, { p_conversation_id: conversation, p_draft_revision: 0, p_service: service });
    assert.equal(consumed[0].abortedAtCall, false);
    assert.equal(f.captures().length, 0);
    assert.equal(f.timerHistory.filter(timer => timer.ms === 9000).length, 0);
  });
}
