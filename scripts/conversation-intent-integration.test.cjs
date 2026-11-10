'use strict';
// Actual client stream, receipt adapters and one-use handoff. Only network,
// Supabase transport and the current Auth session are substituted. The corpus
// supplies controlled semantic results; it does NOT claim real-model accuracy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const ACCOUNT = id(1), CONVERSATION = id(2), REQUEST = id(3), TURN = id(4), ATTEMPT = id(5);
const SCHEMA = 'AI_CONVERSATION_INTENT_V1';
const compiled = new Map();

function sourceLoader(overrides, globals = {}) {
  const modules = new Map();
  function load(relative) {
    if (Object.hasOwn(overrides, relative)) return overrides[relative];
    const resolved = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts'].map(ext => path.resolve(ROOT, relative + ext))
      .find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    assert.ok(resolved, 'Actual source module must exist: ' + relative);
    relative = path.relative(ROOT, resolved).replaceAll(path.sep, '/');
    if (Object.hasOwn(overrides, relative)) return overrides[relative];
    if (modules.has(relative)) return modules.get(relative).exports;
    const source = fs.readFileSync(resolved, 'utf8'), key = relative + '\0' + source;
    if (!compiled.has(key)) {
      // .mjs forces ESM output even with module=CommonJS. Use a synthetic .ts
      // compiler filename only; module resolution and executed contents stay real.
      const result = ts.transpileModule(source, { fileName: resolved.endsWith('.mjs') ? resolved + '.ts' : resolved, reportDiagnostics: true,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
      assert.deepEqual((result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), []);
      compiled.set(key, result.outputText);
    }
    const mod = { exports: {} }; modules.set(relative, mod);
    const localRequire = name => name.startsWith('.')
      ? load(path.relative(ROOT, path.resolve(path.dirname(resolved), name)).replaceAll(path.sep, '/'))
      : Object.hasOwn(overrides, name) ? overrides[name] : require(name);
    new Function('require', 'module', 'exports', ...Object.keys(globals), compiled.get(key))
      (localRequire, mod, mod.exports, ...Object.values(globals));
    return mod.exports;
  }
  return load;
}

function needTurn(patch = {}) {
  return { conversationId: CONVERSATION, clientRequestId: REQUEST, state: 'SUCCEEDED', turnId: TURN,
    retryAllowed: false, receipt: { userMessageId: id(6), assistantMessageId: id(7), proposedCount: 0,
      safety: 'ALLOW', schemaVersion: 'NEED_FACT_V2', authoritative: true }, ...patch };
}
function workerTurn(patch = {}) {
  return { turnId: TURN, conversationId: CONVERSATION, clientRequestId: REQUEST, attemptId: ATTEMPT,
    state: 'SUCCEEDED', retryAllowed: false, authoritative: true, ...patch };
}
const hint = (kind, evidence) => ({ schemaVersion: SCHEMA, kind, evidence });
const event = (sequence, kind, extra = {}) => ({ conversationId: CONVERSATION, clientRequestId: REQUEST,
  turnId: TURN, attemptId: ATTEMPT, sequence, kind, ...extra });
function responseEvents(events, change = {}) {
  return new Response(events.map(value => 'data: ' + JSON.stringify(value) + '\n\n').join(''),
    { status: 200, headers: { 'content-type': 'text/event-stream' }, ...change });
}
function finalEvents(turn, intent, extra = {}) {
  return [event(1, 'accepted'), event(2, 'final', { turn, ...(intent ? { conversationIntent: intent } : {}), ...extra })];
}

function clientHarness(makeResponse, options = {}) {
  const session = { user: { id: ACCOUNT }, accountRevision: 5, session: { access_token: 'bounded-test-token' } };
  const requests = [], sdkWrites = [];
  const overrides = {
    'expo/fetch': { fetch: async (url, init) => {
      requests.push({ url, init });
      return makeResponse({ url, init, session });
    } },
    'src/store/sesija.ts': { sesijaSada: () => session },
    'src/data/publicSupabaseConfig.ts': { readPublicSupabaseConfig: () => ({ url: 'https://fixture.supabase.co', anonKey: 'public-fixture-key' }) },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => ({
      rpc: () => { throw new Error('UNEXPECTED_RPC'); },
      functions: { invoke: async (...args) => { sdkWrites.push(args); return { data: needTurn(), error: null }; } },
    }) },
    ...options.overrides,
  };
  const load = sourceLoader(overrides);
  async function send(domain, text, config = {}) {
    const received = [], deltas = [];
    const stream = { onText: value => deltas.push(value), ...(config.optOut ? {} : {
      onConversationIntent: intent => { received.push(intent); config.onHint?.(intent); },
    }), ...(config.signal ? { signal: config.signal } : {}) };
    const result = domain === 'NEED'
      ? await load('src/data/aiNeedV2Production.ts').aiNeedV2Production.sendMessage(CONVERSATION, text, REQUEST, stream)
      : await load('src/data/workerAiClientService.ts').workerAiClientService.send(CONVERSATION, text, REQUEST, stream);
    return { result, received, deltas };
  }
  return { load, send, session, requests, sdkWrites };
}

const corpus = [
  ['Predajem francuski preko interneta.', 'WORKER_OFFER', 'NEED', 'WORKER'],
  ['Ја нудим онлајн часове француског.', 'WORKER_OFFER', 'NEED', 'WORKER'],
  ['Treba mi neko da mi popravi slavinu.', 'NEED_REQUEST', 'WORKER', 'NEED'],
  ['Треба ми помоћ да ствари унесемо на четврти спрат.', 'NEED_REQUEST', 'WORKER', 'NEED'],
  ['Promenite termin postojećeg zadatka na petak.', 'NEED_EDIT', 'WORKER', 'NEED'],
  ['Takođe popravljam slavine.', 'WORKER_ADD_SERVICE', 'NEED', 'WORKER'],
  ['Сада радим и преводе.', 'WORKER_ADD_SERVICE', 'NEED', 'WORKER'],
  ['Додај и кошење траве.', 'WORKER_ADD_SERVICE', 'NEED', 'WORKER'],
  ['Više ne radim selidbe.', 'WORKER_REMOVE_SERVICE', 'NEED', 'WORKER'],
  ['Prevoz radim, ali utovar više ne.', 'WORKER_EDIT_SERVICE', 'NEED', 'WORKER'],
  ['Radnim danima mogu posle 15.', 'WORKER_AVAILABILITY', 'NEED', 'WORKER'],
  ['Radim u Novom Sadu i Beogradu.', 'WORKER_AREA', 'NEED', 'WORKER'],
  ['Kako se šalje prijava?', 'QUESTION', 'NEED', null],
  ['Да ли овде могу да нудим превоз?', 'QUESTION', 'WORKER', null],
  ['Imam kombi i radim prevoz, ali danas mi trebaju dvojica da istovarim nameštaj.', 'MIXED', 'NEED', null],
  ['Mislio sam evre.', 'CORRECTION', 'NEED', null],
  ['Не треба одвоз.', 'CORRECTION', 'WORKER', null],
  ['Promenio sam mišljenje.', 'UNCLEAR', 'NEED', null],
  ['Ćao.', 'CONTINUE', 'NEED', null], ['Da.', 'CONTINUE', 'WORKER', null],
  ['Ne.', 'CONTINUE', 'NEED', null], ['To je to.', 'CONTINUE', 'WORKER', null],
  ['Sutra.', 'CONTINUE', 'NEED', null], ['Posle četiri.', 'CONTINUE', 'WORKER', null],
  ['Nemam kombi.', 'CORRECTION', 'WORKER', null], ['Samo utovar.', 'CONTINUE', 'NEED', null],
  ['Može i petak.', 'CONTINUE', 'NEED', null], ['I subotu bih mogao.', 'CONTINUE', 'WORKER', null],
  ['Mogu da nosim stvari, utovaram i istovaram. Nemam kombi.', 'WORKER_OFFER', 'NEED', 'WORKER'],
  ['Kombi je moj, trebaju mi samo fizički radnici.', 'NEED_REQUEST', 'WORKER', 'NEED'],
];

test('controlled Serbian intent corpus crosses actual SSE and both owned receipt adapters without automatic writes', async () => {
  for (const [text, kind, domain, target] of corpus) {
    const intent = hint(kind, text);
    const turn = domain === 'NEED' ? needTurn() : workerTurn();
    const h = clientHarness(() => responseEvents(finalEvents(turn, intent)));
    const result = await h.send(domain, text);
    assert.equal(result.result.ok, true, text);
    assert.deepEqual(result.received, [intent], text);
    assert.equal(h.load('src/contracts/aiConversationIntent.ts').oppositeInterviewDomain(result.received[0], domain), target, text);
    assert.equal(h.requests.length, 1, 'no second model/transport request');
    assert.equal(h.requests[0].init.headers['x-uskoci-interview-intent'], 'v1');
    assert.deepEqual(JSON.parse(h.requests[0].init.body), { conversationId: CONVERSATION, clientRequestId: REQUEST, text });
    assert.deepEqual(h.sdkWrites, [], 'a suggestion never calls Save, Publish or profile activation');
  }
});

for (const domain of ['NEED', 'WORKER']) {
  const makeTurn = domain === 'NEED' ? needTurn : workerTurn;
  const text = domain === 'NEED' ? 'Predajem francuski preko interneta.' : 'Treba mi neko da popravi slavinu.';
  const intent = hint(domain === 'NEED' ? 'WORKER_OFFER' : 'NEED_REQUEST', text);
  test(`${domain}: old final and JSON replay keep the exact completed receipt without a fabricated hint`, async () => {
    for (const mode of ['legacy_sse', 'replay_json', 'opt_out']) {
      const turn = makeTurn();
      const h = clientHarness(() => mode === 'replay_json'
        ? new Response(JSON.stringify(turn), { headers: { 'content-type': 'application/json' } })
        : responseEvents(finalEvents(turn)));
      const result = await h.send(domain, text, { optOut: mode === 'opt_out' });
      assert.equal(result.result.ok, true, mode); assert.deepEqual(result.result.podatak, turn);
      assert.deepEqual(result.received, []);
      assert.equal(h.requests[0].init.headers['x-uskoci-interview-intent'], mode === 'opt_out' ? undefined : 'v1');
      assert.equal(h.requests.length, 1);
    }
  });
  test(`${domain}: final identity is insufficient until the complete existing receipt decoder succeeds`, async () => {
    const invalid = domain === 'NEED' ? makeTurn({ receipt: { ...needTurn().receipt, authoritative: false } }) : makeTurn({ authoritative: false });
    const h = clientHarness(() => responseEvents(finalEvents(invalid, intent)));
    const result = await h.send(domain, text);
    assert.equal(result.result.ok, false); assert.deepEqual(result.received, []);
    assert.equal(h.requests.length, 1);
  });
  test(`${domain}: an old-turn quote, wrong schema, invented kind or extra authority field cannot escape`, async () => {
    for (const bad of [hint(intent.kind, 'Tekst iz ranije poruke'), { ...intent, schemaVersion: 'AI_CONVERSATION_INTENT_V2' },
      hint('PUBLISH_NOW', text), { ...intent, authoritative: true }, hint(intent.kind, ''), hint(intent.kind, 'x'.repeat(501))]) {
      const h = clientHarness(() => responseEvents(finalEvents(makeTurn(), bad)));
      const result = await h.send(domain, text);
      assert.equal(result.result.ok, false); assert.deepEqual(result.received, []);
    }
  });
  test(`${domain}: unknown outcome and safe error never hand off or retry the model`, async () => {
    for (const events of [[event(1, 'accepted')], [event(1, 'accepted'), event(2, 'safe_error', { code: 'AI_TURN_NOT_CONFIRMED' })],
      finalEvents(makeTurn(), intent).concat(event(3, 'final', { turn: makeTurn(), conversationIntent: intent }))]) {
      const h = clientHarness(() => responseEvents(events)); const result = await h.send(domain, text);
      assert.equal(result.result.ok, false); assert.deepEqual(result.received, []); assert.equal(h.requests.length, 1);
    }
  });
  test(`${domain}: replaced attempt, other request and pre-final hint are rejected`, async () => {
    for (const bad of [event(2, 'final', { turn: makeTurn(), conversationIntent: intent, attemptId: id(50) }),
      event(2, 'final', { turn: makeTurn(), conversationIntent: intent, clientRequestId: id(51) }),
      event(2, 'text_delta', { text: 'Nacrt', conversationIntent: intent })]) {
      const h = clientHarness(() => responseEvents([event(1, 'accepted'), bad]));
      const result = await h.send(domain, text); assert.equal(result.result.ok, false); assert.deepEqual(result.received, []);
    }
  });
  test(`${domain}: account A-B-A generation and abort fence a late confirmed hint`, async () => {
    for (const mode of ['other_account', 'same_account_new_generation', 'aborted']) {
      const controller = new AbortController();
      const h = clientHarness(({ session }) => {
        if (mode === 'other_account') session.user = { id: id(80) };
        if (mode === 'same_account_new_generation') session.accountRevision += 2;
        if (mode === 'aborted') controller.abort();
        return responseEvents(finalEvents(makeTurn(), intent));
      });
      const result = await h.send(domain, text, { signal: controller.signal });
      assert.equal(result.result.ok, false); assert.deepEqual(result.received, []);
    }
  });
  test(`${domain}: suggestion callback failure does not turn confirmed server success into failure`, async () => {
    const h = clientHarness(() => responseEvents(finalEvents(makeTurn(), intent)));
    const result = await h.send(domain, text, { onHint: () => { throw Error('UI_RETIRED'); } });
    assert.equal(result.result.ok, true); assert.equal(result.received.length, 1);
  });
}

test('transport returns a validated advisory value but never invokes its callback before owned receipt validation', async () => {
  const text = 'Predajem francuski.', intent = hint('WORKER_OFFER', text);
  const h = clientHarness(() => responseEvents(finalEvents(needTurn(), intent)));
  let invoked = 0;
  const response = await h.load('src/data/aiNeedTurnStream.ts').requestAiTurnStream({
    url: 'https://fixture.supabase.co', anonKey: 'public', accessToken: 'fixture-token', conversationId: CONVERSATION,
    clientRequestId: REQUEST, text, current: () => true, deadline: Date.now() + 2000,
    onText() {}, onConversationIntent() { invoked++; },
  });
  assert.equal(invoked, 0); assert.deepEqual(response.conversationIntent, intent); assert.deepEqual(response.data, needTurn());
});

test('whitespace-only quote normalization preserves Serbian content and never transliterates or removes negation', () => {
  const { decodeAiConversationIntent } = sourceLoader({})('src/contracts/aiConversationIntent.ts');
  assert.ok(decodeAiConversationIntent(hint('WORKER_OFFER', 'Нудим часове'), 'Нудим\n  часове француског.'));
  assert.equal(decodeAiConversationIntent(hint('WORKER_OFFER', 'Nudim časove'), 'Нудим часове француског.'), null);
  assert.equal(decodeAiConversationIntent(hint('WORKER_OFFER', 'radim prevoz'), 'Ne radim utovar.'), null);
  assert.ok(decodeAiConversationIntent(hint('UNCLEAR', ''), 'Promenio sam mišljenje.'));
  assert.ok(decodeAiConversationIntent(hint('CONTINUE', ''), 'Da.'));
  assert.equal(decodeAiConversationIntent(hint('QUESTION', ''), 'Da li mogu?'), null);
});

test('confirmed semantic drafts preserve the whole statement and require the exact account, target and one-use token', () => {
  const handoff = sourceLoader({})('src/data/aiRoleHandoff.ts');
  const owner = { accountId: ACCOUNT, accountRevision: 5 }, token = id(90);
  for (const target of ['NEED', 'WORKER']) {
    const text = target === 'NEED' ? 'Kombi je moj, trebaju mi samo fizički radnici.' : 'Prevoz radim, ali utovar više ne.';
    assert.equal(handoff.stageAiRoleText({ ...owner, token, target, text }, 1000), true);
    const correct = target === 'NEED' ? handoff.takeNeedText : handoff.takeWorkerText;
    const wrong = target === 'NEED' ? handoff.takeWorkerText : handoff.takeNeedText;
    assert.equal(wrong({ ...owner, token }, 1001), null);
    assert.equal(correct({ ...owner, accountId: id(91), token }, 1001), null);
    assert.equal(correct({ ...owner, accountRevision: 6, token }, 1001), null);
    assert.equal(correct({ ...owner, token: id(92) }, 1001), null);
    assert.equal(correct({ ...owner, token, capacity: text.length - 1 }, 1001), null, 'occupied composer must not consume it');
    assert.equal(correct({ ...owner, token, capacity: text.length }, 1002), text);
    assert.equal(correct({ ...owner, token }, 1003), null);
  }
});

test('a newer user-approved handoff replaces the old one while wrong or expired tokens never expose it', () => {
  const handoff = sourceLoader({})('src/data/aiRoleHandoff.ts');
  const owner = { accountId: ACCOUNT, accountRevision: 5 };
  assert.equal(handoff.stageAiRoleText({ ...owner, token: id(93), target: 'NEED', text: 'Treba mi slavina.' }, 1000), true);
  assert.equal(handoff.stageAiRoleText({ ...owner, token: id(94), target: 'WORKER', text: 'Takođe popravljam slavine.' }, 1001), true);
  assert.equal(handoff.takeNeedText({ ...owner, token: id(93) }, 1002), null);
  assert.equal(handoff.takeWorkerText({ ...owner, token: id(94) }, 301002), null);
  assert.equal(handoff.takeWorkerText({ ...owner, token: id(94) }, 1003), null);
});

// These probes execute both complete Edge handlers, their real provider SSE
// decoder and the same guards that form SQL arguments. Only HTTP is fake: no
// provider, SQL mutation, account, paid call or production secrets are used.
function handlerHarness(domain, text, providerOutput, options = {}) {
  const calls = [], logs = [], handlers = [];
  let completedEnvelope = null;
  const singlePass = options.singlePass === true;
  const env = { SUPABASE_URL: 'https://leqcwgzvjsxugfgzdmth.supabase.co',
    SUPABASE_ANON_KEY: 'public-fixture', SUPABASE_SERVICE_ROLE_KEY: 'server-fixture',
    GEMINI_API_KEY: 'provider-fixture', GEMINI_MODEL: 'gemini-3.8-flash', AI_PROVIDER: 'gemini',
    USKOCI_GEMINI_PAID_TEST_ENABLED: 'true', USKOCI_TAXONOMY_DUAL_GEMINI: String(singlePass),
    USKOCI_TAXONOMY_ROLLOUT_SCOPE: 'DEV', USKOCI_TAXONOMY_ALLOWED_PROJECT_REF: 'leqcwgzvjsxugfgzdmth', ...options.env };
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  const processing = domain === 'NEED' ? needTurn({ state: 'PROCESSING', receipt: null }) : workerTurn({ state: 'PROCESSING' });
  const candidate = { displayName: 'QA Fixture', bio: '', skills: options.skills ?? [],
    location: { operatingCountryCode: 'RS', city: '', radiusKm: 0 },
    availability: { timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [] },
    tools: [], vehicles: [], licenses: [], teamCapacity: 1, workAreas: [] };
  const fetchMock = async (url, init = {}) => {
    const parsed = new URL(String(url)), name = parsed.pathname.split('/').at(-1);
    const args = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ url: parsed.origin + parsed.pathname, name, args, headers: new Headers(init.headers) });
    if (parsed.pathname === '/auth/v1/user') return options.authDenied ? json({}, 401) : json({ id: ACCOUNT });
    if (parsed.pathname === '/rest/v1/ai_conversations') return json([{ id: CONVERSATION, account_id: ACCOUNT, fact_schema_version: 'NEED_FACT_V2', status: 'OPEN' }]);
    if (parsed.hostname === 'generativelanguage.googleapis.com') {
      assert.equal(calls.filter(call => call.url.startsWith(parsed.origin)).length, 1, 'A single request cannot invoke a second model');
      const output = typeof providerOutput === 'function' ? providerOutput(args) : providerOutput;
      const value = { candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 30, totalTokenCount: 130 } };
      return new Response('data: ' + JSON.stringify(value) + '\n\n', { headers: { 'content-type': 'text/event-stream' } });
    }
    if (name === 'rpc_ai_claim_need_turn_v2_service') return json(options.replay ? { turn: needTurn(), claim: null } : {
      turn: processing, claim: { attemptId: ATTEMPT, leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        context: { schemaVersion: 'NEED_FACT_V2', history: options.history ?? [], activeFacts: options.activeFacts ?? [] } },
    });
    if (name === 'rpc_claim_worker_ai_turn_service') return json({ acquired: !options.replay, turn: options.replay ? workerTurn() : processing });
    if (name === 'rpc_read_worker_ai_context_service') return json({ schemaVersion: 'WORKER_PROFILE_V1', accountId: ACCOUNT,
      conversationId: CONVERSATION, status: 'OPEN', stale: false, safety: 'ALLOW', profileStatus: 'DRAFT', revision: options.revision ?? 1, candidate,
      messages: options.history ?? [{ role: 'USER', body: text, id: id(6) }],
      serviceModeContext: options.serviceModeContext ?? { schemaVersion: 'WORKER_SERVICE_MODE_CONTEXT_V1', revision: 1, savedServices: [], draftServices: [], unresolvedServices: candidate.skills } });
    if (name === 'rpc_ai_test_budget_reserve_service') return json({ admitted: true, replay: false, reservationId: id(10), code: 'AI_TEST_RESERVED' });
    if (name === 'rpc_ai_dispatch_need_turn_v2_service') return json(true);
    if (name === 'rpc_dispatch_worker_ai_turn_service') return json({ dispatched: true, turn: processing });
    if (name === 'rpc_taxonomy_fetch_snapshot_v1') {
      const categories = options.catalog ?? [{ categoryId: id(20), label: 'Fizička pomoć pri selidbi', parentId: null, isLeaf: true, aliases: [], modes: ['ON_SITE'] }];
      return json({ catalogVersion: 1, catalogFingerprint: 'fixture-catalog', count: categories.length, categories });
    }
    if (name === 'rpc_ai_read_first_plan_completion_service') {
      assert.equal(options.completionOutcome, 'LOST_ACK', 'Readback is allowed only in a declared recovery scenario');
      assert.ok(completedEnvelope, 'The fixture must first persist the exact completion');
      return json({ state: 'COMPLETED', envelope: completedEnvelope });
    }
    if (name === 'rpc_ai_test_record_usage_service') return json(true);
    if (['rpc_ai_fail_need_turn_v2_service', 'rpc_fail_worker_ai_turn_service'].includes(name)) return json(true);
    if (['rpc_ai_complete_need_turn_v2_service', 'rpc_ai_complete_need_turn_with_first_plan_service',
      'rpc_complete_worker_ai_turn_service', 'rpc_complete_worker_ai_turn_with_first_plan_service'].includes(name)) {
      if (options.completionFailure) return json({ message: 'FIXTURE_COMPLETION_UNAVAILABLE' }, 503);
      const completed = domain === 'NEED' ? needTurn({ receipt: { ...needTurn().receipt,
        proposedCount: args.p_proposals.length, safety: args.p_safety } }) : workerTurn();
      if (options.malformedReceipt) completed.authoritative = false;
      completedEnvelope = name.includes('first_plan') ? { completion: completed,
        firstPlan: { state: 'RESOLVED', authority: 'CATALOG_ONLY', applicability: 'NOT_EVALUATED' } } : completed;
      if (options.completionOutcome === 'LOST_ACK') throw new Error('FIXTURE_COMMITTED_ACK_LOST');
      return json(completedEnvelope);
    }
    throw new Error('Unexpected external call: ' + parsed.origin + parsed.pathname);
  };
  const load = sourceLoader({}, { Deno: { env: { get: name => env[name] }, serve: handler => handlers.push(handler) },
    fetch: fetchMock, console: Object.fromEntries(['log', 'info', 'warn', 'error'].map(name => [name, (...args) => logs.push(args)])) });
  load(domain === 'NEED' ? 'supabase/functions/uskoci-ai-interview/index.ts' : 'supabase/functions/uskoci-worker-interview/index.ts');
  assert.equal(handlers.length, 1);
  async function run() {
    const response = await handlers[0](new Request(env.SUPABASE_URL + '/functions/v1/fixture', { method: 'POST',
      headers: { Authorization: 'Bearer fixture-account-token', 'Content-Type': 'application/json', Accept: 'text/event-stream',
        ...(options.optOut ? {} : { 'x-uskoci-interview-intent': 'v1' }) },
      body: JSON.stringify({ conversationId: CONVERSATION, clientRequestId: REQUEST, text }) }));
    const raw = await response.text();
    const events = response.headers.get('content-type').includes('text/event-stream')
      ? raw.split('\n\n').filter(Boolean).map(part => JSON.parse(part.slice(6))) : [];
    const writes = calls.filter(call => /rpc_(?:ai_)?complete_(?:need|worker)_/.test(call.name));
    return { status: response.status, events, json: events.length ? null : JSON.parse(raw), calls, writes, logs };
  }
  return { run };
}

function providerNeed(kind, text, patch = {}) {
  return { assistantMessage: 'Proverite sledeći korak.', safety: 'ALLOW',
    facts: [], dialogue: { next: 'ANSWER', questionKey: 'NONE', taskRelation: 'CONTINUE', priceUnit: 'UNSPECIFIED', schedulePattern: 'UNSPECIFIED' },
    conversationIntent: { kind, evidence: text }, ...patch };
}
function providerWorker(kind, text, patch = {}) {
  return { assistantMessage: 'Proverite sledeći korak.', safety: 'ALLOW', patch: { availability: null },
    availabilityChange: { kind: 'NONE', scope: 'NONE', evidence: '' }, serviceChanges: [], conversationIntent: { kind, evidence: text }, ...patch };
}

test('NEED actual Edge: complete REMOTE draft keeps a genuine scope question through one confirmed turn', async()=>{
  const text='Fotografiju ću poslati onlajn.';
  const reply='Da li želite samo uklanjanje pozadine ili i retuširanje fotografije?';
  const definitions=sourceLoader({})('src/contracts/needFactsV2.ts').NEED_FACT_V2_DEFINITIONS;
  const activeFacts=[
    ['need.title','Obrada fotografije'],['need.category','Obrada fotografija'],
    ['need.description','Potrebna je obrada jedne fotografije'],['need.people_needed',1],
    ['need.price_mode','OFFERS'],['need.schedule_kind','REMOTE_ANYTIME'],
    ['need.task_country_code','RS'],['need.task_geography',{mode:'REMOTE'}],['need.handoff',{required:false}],
  ].map(([fact_key,fact_value])=>({fact_key,fact_value,value_type:definitions[fact_key].valueType,
    display_value:typeof fact_value==='object'?JSON.stringify(fact_value):String(fact_value),
    fact_schema_version:'NEED_FACT_V2',status:'CONFIRMED',source:'USER',created_at:'2026-11-10T10:00:00Z'}));
  const before=JSON.stringify(activeFacts);
  const output=args=>providerNeed('CONTINUE',text,{safety:'CLARIFY',assistantMessage:reply,
    dialogue:{next:'ASK',questionKey:'need.description',taskRelation:'CONTINUE',priceUnit:'UNSPECIFIED',schedulePattern:'UNSPECIFIED'},
    ...(args.generationConfig.responseSchema.properties.taxonomyDecisions?{taxonomyDecisions:[]}:{}),
  });
  const result=await handlerHarness('NEED',text,output,{singlePass:true,activeFacts,
    catalog:[{categoryId:id(20),label:'Obrada fotografija',parentId:null,isLeaf:true,aliases:[],modes:['REMOTE']}],
  }).run();
  assert.equal(result.status,200,JSON.stringify(result.json));
  assert.equal(result.events.at(-1).kind,'final',JSON.stringify({events:result.events,logs:result.logs,calls:result.calls.map(c=>c.name)}));
  assert.equal(result.events.at(-1).turn.state,'SUCCEEDED');
  assert.equal(result.writes.length,1);
  assert.equal(result.writes[0].args.p_assistant_message,reply);
  assert.equal(result.writes[0].args.p_safety,'CLARIFY'); assert.deepEqual(result.writes[0].args.p_proposals,[]);
  assert.equal(JSON.stringify(activeFacts),before);
  assert.equal(result.calls.filter(call=>call.name.endsWith(':streamGenerateContent')).length,1);
  assert.equal(result.calls.filter(call=>call.name==='rpc_ai_dispatch_need_turn_v2_service').length,1);
  assert.equal(result.calls.filter(call=>call.name==='rpc_ai_test_record_usage_service').length,1);
  assert.equal(result.calls.some(call=>call.name==='rpc_ai_fail_need_turn_v2_service'),false);
});

for(const text of [
  'Ne lektura, treba prevesti tekst na nemački. Ostalo zadržite.',
  'Уместо лектуре, треба превести текст на немачки. Остало задржите.',
])test('NEED actual Edge: natural service correction keeps classification in the same request: '+text, async()=>{
  const definitions=sourceLoader({})('src/contracts/needFactsV2.ts').NEED_FACT_V2_DEFINITIONS;
  const activeFacts=[
    ['need.title','Lektura teksta'],['need.category','Lektura'],['need.description','Potrebna je lektura teksta'],
    ['need.people_needed',1],['need.price_mode','MY_PRICE'],['need.price_rsd',1500],['need.price_basis','TOTAL'],
    ['need.schedule_kind','REMOTE_ANYTIME'],['need.task_country_code','RS'],
    ['need.task_geography',{mode:'REMOTE'}],['need.handoff',{required:false}],
  ].map(([fact_key,fact_value])=>({fact_key,fact_value,value_type:definitions[fact_key].valueType,
    display_value:typeof fact_value==='object'?JSON.stringify(fact_value):String(fact_value),
    fact_schema_version:'NEED_FACT_V2',status:'CONFIRMED',source:'USER',created_at:'2026-11-10T10:00:00Z'}));
  const before=JSON.stringify(activeFacts),service='Prevođenje teksta na nemački';
  const output=args=>providerNeed('NEED_EDIT',text,{
    assistantMessage:'U nacrtu je prevod na nemački. Ostali uslovi ostaju isti.',
    dialogue:{next:'ACK',questionKey:'NONE',taskRelation:'CONTINUE',priceUnit:'UNSPECIFIED',schedulePattern:'UNSPECIFIED'},
    facts:[['need.category',service],['need.description','Potrebno je prevesti tekst na nemački']]
      .map(([key,value])=>({key,valueJson:JSON.stringify(value),displayValue:value,confidence:1,evidence:text})),
    ...(args.generationConfig.responseSchema.properties.taxonomyDecisions?{taxonomyDecisions:[{
      service,mode:'REMOTE',action:'REUSE_EXISTING',categoryId:id(21),parentId:'',proposedPath:[],ambiguityPrompt:'',
      reason:'The supplied correction asks for translation into German, not proofreading.',
    }]}:{}),
  });
  const result=await handlerHarness('NEED',text,output,{singlePass:true,activeFacts,catalog:[
    {categoryId:id(20),label:'Lektura',parentId:null,isLeaf:true,aliases:[],modes:['REMOTE']},
    {categoryId:id(21),label:'Prevođenje',parentId:null,isLeaf:true,aliases:[],modes:['REMOTE']},
  ]}).run();
  const requests=result.calls.filter(call=>call.name.endsWith(':streamGenerateContent'));
  assert.equal(requests.length,1,'classification stays in the original model request');
  assert.ok(requests[0].args.generationConfig.responseSchema.properties.taxonomyDecisions,
    'the existing category must not hide classification from a natural or Cyrillic correction');
  assert.match(JSON.stringify(requests[0].args.systemInstruction),/Prevođenje/);
  assert.equal(result.events.at(-1)?.kind,'final',JSON.stringify({events:result.events,logs:result.logs}));
  assert.equal(result.writes.length,1);
  const args=result.writes[0].args;
  assert.equal(args.p_taxonomy_plan.proposals[0].service,service);
  assert.equal(args.p_taxonomy_plan.proposals[0].categoryId,id(21));
  assert.equal(args.p_taxonomy_plan.proposals[0].mode,'REMOTE');
  assert.deepEqual(args.p_proposals.map(p=>p.key),['need.category','need.description']);
  assert.equal(JSON.stringify(activeFacts),before);
  assert.equal(result.calls.filter(call=>call.name==='rpc_ai_dispatch_need_turn_v2_service').length,1);
  assert.equal(result.calls.filter(call=>call.name==='rpc_ai_test_record_usage_service').length,1);
});

for (const domain of ['NEED', 'WORKER']) {
  test(`${domain} actual Edge: opposite, mixed, pure questions and unclear intent freeze malicious provider writes before SQL`, async () => {
    const cases = domain === 'NEED'
      ? [['WORKER_OFFER', 'Predajem francuski preko interneta.'], ['WORKER_ADD_SERVICE', 'Додај и кошење траве.'],
        ['MIXED', 'Nudim prevoz, ali treba mi pomoć za utovar.'], ['QUESTION', 'Da li ovde mogu da nudim prevoz?'], ['UNCLEAR', 'Promenio sam mišljenje.']]
      : [['NEED_REQUEST', 'Треба ми неко да поправи славину.'], ['NEED_EDIT', 'Promenite termin zadatka.'],
        ['MIXED', 'Radim prevoz, ali trebaju mi dvojica za utovar.'], ['QUESTION', 'Kako radi prijava za zadatak?'], ['UNCLEAR', 'Promenio sam mišljenje.']];
    for (const [kind, text] of cases) {
      const output = domain === 'NEED' ? providerNeed(kind, text, { facts: [{ key: 'need.price_rsd', valueJson: '1200', displayValue: '1200 RSD', evidence: text, confidence: 1 }], taxonomyDecisions: [{ invented: true }] })
        : providerWorker(kind, text, { patch: { availability: { availableNow: true }, skills: ['Prevoz kombijem'], bio: 'Imam kombi.',
          areaRequests: [{ invalidProviderArea: true }] }, serviceChanges: [{ action: 'ADD', service: 'Prevoz kombijem', replacement: '', evidence: text }],
          serviceModeChangesJson: '[{"invented":true}]', taxonomyDecisions: [{ invented: true }] });
      const result = await handlerHarness(domain, text, output, { singlePass: true }).run();
      assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ kind, events: result.events, logs: result.logs }));
      assert.equal(result.writes.length, 1);
      const args = result.writes[0].args;
      assert.deepEqual(domain === 'NEED' ? args.p_proposals : args.p_output.patch, domain === 'NEED' ? [] : {});
      assert.equal(Object.hasOwn(args, 'p_taxonomy_plan'), false);
      assert.equal(result.calls.filter(call => /streamGenerateContent/.test(call.name)).length, 1);
      assert.equal(result.calls.filter(call => /dispatch.*turn/.test(call.name)).length, 1);
      assert.equal(result.calls.some(call => /locationiq|geocod|resolve.*area|apply_legacy/.test(call.url)), false);
      assert.deepEqual(result.events.at(-1).conversationIntent, hint(kind, text));
    }
  });

  test(`${domain} actual Edge: old client wire and durable replay do not invent a semantic receipt`, async () => {
    const text = domain === 'NEED' ? 'Nudim časove francuskog.' : 'Treba mi pomoć za selidbu.';
    const kind = domain === 'NEED' ? 'WORKER_OFFER' : 'NEED_REQUEST';
    const provider = domain === 'NEED' ? providerNeed(kind, text) : providerWorker(kind, text);
    const old = await handlerHarness(domain, text, provider, { optOut: true }).run();
    assert.equal(old.events.at(-1)?.kind, 'final', JSON.stringify(old));
    assert.equal(Object.hasOwn(old.events.at(-1), 'conversationIntent'), false);
    const replay = await handlerHarness(domain, text, provider, { replay: true }).run();
    assert.equal(replay.status, 200); assert.deepEqual(replay.json, domain === 'NEED' ? needTurn() : workerTurn());
    assert.equal(replay.calls.some(call => /streamGenerateContent|dispatch|complete|budget/.test(call.name)), false);
  });

  test(`${domain} actual Edge: missing intent and safety holds cannot create facts or handoff authority`, async () => {
    const text = 'Novi zahtev za proveru.';
    for (const safety of ['ALLOW', 'REVIEW', 'BLOCK']) {
      const output = domain === 'NEED' ? providerNeed('WORKER_OFFER', text, { safety }) : providerWorker('NEED_REQUEST', text, { safety });
      if (safety === 'ALLOW') delete output.conversationIntent;
      const result = await handlerHarness(domain, text, output).run();
      assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
      assert.equal(Object.hasOwn(result.events.at(-1), 'conversationIntent'), false);
      const args = result.writes[0].args;
      assert.deepEqual(domain === 'NEED' ? args.p_proposals : args.p_output.patch, domain === 'NEED' ? [] : {});
      assert.equal(domain === 'NEED' ? args.p_safety : args.p_output.safety, safety === 'ALLOW' ? 'CLARIFY' : safety);
    }
  });

  test(`${domain} actual Edge: provider success plus failed completion has one dispatch and no final hint`, async () => {
    const text = domain === 'NEED' ? 'Predajem francuski.' : 'Treba mi majstor.';
    const provider = domain === 'NEED' ? providerNeed('WORKER_OFFER', text) : providerWorker('NEED_REQUEST', text);
    const result = await handlerHarness(domain, text, provider, { completionFailure: true }).run();
    assert.equal(result.events.at(-1)?.kind, 'safe_error');
    assert.equal(result.events.some(event => event.conversationIntent || event.kind === 'final'), false);
    assert.equal(result.calls.filter(call => /streamGenerateContent/.test(call.name)).length, 1);
    assert.equal(result.calls.filter(call => /dispatch.*turn/.test(call.name)).length, 1);
    assert.equal(result.calls.filter(call => /fail.*turn/.test(call.name)).length, 1);
    assert.equal(result.calls.some(call => /release_unused/.test(call.name)), false);
    assert.equal(result.calls.filter(call => call.name === 'rpc_ai_test_record_usage_service').length, 1);
  });
}

test('Worker actual Edge: ADD, REMOVE and scoped REPLACE preserve every unrelated saved service and never infer a van', async () => {
  const cases = [
    { text: 'Takođe popravljam slavine.', kind: 'WORKER_ADD_SERVICE', base: ['Prevoz', 'Utovar'], action: 'ADD', service: 'Popravka slavina', replacement: '', expected: ['Prevoz', 'Utovar', 'Popravka slavina'] },
    { text: 'Сада радим и преводе.', kind: 'WORKER_ADD_SERVICE', base: ['Košenje trave'], action: 'ADD', service: 'Prevođenje', replacement: '', expected: ['Košenje trave', 'Prevođenje'] },
    { text: 'Više ne radim selidbe.', kind: 'WORKER_REMOVE_SERVICE', base: ['Selidbe', 'Košenje trave'], action: 'REMOVE', service: 'Selidbe', replacement: '', expected: ['Košenje trave'] },
    { text: 'Prevoz radim, ali utovar više ne.', kind: 'WORKER_EDIT_SERVICE', base: ['Prevoz sa utovarom', 'Košenje trave'], action: 'REPLACE', service: 'Prevoz sa utovarom', replacement: 'Prevoz bez utovara', expected: ['Prevoz bez utovara', 'Košenje trave'] },
    { text: 'Mogu da nosim nameštaj, nemam kombi.', kind: 'WORKER_OFFER', base: [], action: 'ADD', service: 'Fizička pomoć pri selidbi', replacement: '', expected: ['Fizička pomoć pri selidbi'] },
  ];
  for (const c of cases) {
    const output = providerWorker(c.kind, c.text, { serviceChanges: [{ action: c.action, service: c.service, replacement: c.replacement, evidence: c.text }],
      taxonomyDecisions: [], serviceModeChangesJson: '[]' });
    const result = await handlerHarness('WORKER', c.text, output, { skills: c.base, singlePass: true }).run();
    assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
    assert.deepEqual(result.writes[0].args.p_output.patch, { skills: c.expected });
    assert.equal(result.calls.filter(call => /streamGenerateContent/.test(call.name)).length, 1);
    const modelInput = result.calls.find(call => /streamGenerateContent/.test(call.name)).args;
    for (const key of ['conversationIntent', 'serviceChanges', 'taxonomyDecisions', 'serviceModeChangesJson'])
      assert.ok(modelInput.generationConfig.responseSchema.required.includes(key), 'Natural edits get the complete schema: ' + key);
    assert.ok(modelInput.systemInstruction.parts.some(part => part.text.includes(id(20))), 'The same single model call receives the actual complete catalog');
  }
});

// The earlier mutation corpus intentionally left every service unresolved. The
// cases below reach the actual single-pass builder and first-plan writer, with
// owned saved/draft bindings. SQL and provider boundaries remain fixtures.
const mutationCatalog = [
  { categoryId: id(20), label: 'Fizička pomoć pri selidbi', parentId: null, isLeaf: true, aliases: [], modes: ['ON_SITE'] },
  { categoryId: id(21), label: 'Lektura tekstova', parentId: null, isLeaf: true, aliases: [], modes: ['REMOTE', 'ON_SITE'] },
  { categoryId: id(22), label: 'Košenje trave', parentId: null, isLeaf: true, aliases: [], modes: ['ON_SITE'] },
  { categoryId: id(23), label: 'Selidbe sa prevozom', parentId: null, isLeaf: true, aliases: [], modes: ['ON_SITE'] },
];
const binding = (service, mode, categoryId, handoff) => ({ service, mode, categoryId, ...(handoff ? { handoff } : {}) });
const modeContext = (savedServices, draftServices = [], unresolvedServices = []) => ({
  schemaVersion: 'WORKER_SERVICE_MODE_CONTEXT_V1', revision: 1, savedServices, draftServices, unresolvedServices,
});
const reuseDecision = (service, mode, categoryId) => ({ service, mode, categoryId, action: 'REUSE_EXISTING',
  parentId: '', proposedPath: [], ambiguityPrompt: '', reason: 'Ista konkretna usluga i način rada u važećem katalogu.' });
const planBindings = result => result.writes[0].args.p_taxonomy_plan?.proposals.map(proposal =>
  binding(proposal.service, proposal.mode, proposal.categoryId, proposal.handoff));
const assertOnePaidAttempt = result => {
  assert.equal(result.calls.filter(call => /streamGenerateContent/.test(call.name)).length, 1);
  assert.equal(result.calls.filter(call => /dispatch.*turn/.test(call.name)).length, 1);
  assert.equal(result.calls.filter(call => call.name === 'rpc_ai_test_budget_reserve_service').length, 1);
  assert.equal(result.calls.filter(call => call.name === 'rpc_ai_test_record_usage_service').length, 1);
  assert.equal(result.calls.some(call => /(?:publish|activate|save_worker|release_unused)/.test(call.name)), false);
};

test('Worker actual Edge: adding explicit digital and physical work to a modeless legacy draft asks one named service, then accepts its short answer', async () => {
  const text='Želim da dodam izradu PowerPoint prezentacija onlajn I pomoć pri nošnju stvari pri selidbi. Nemam kombi. Postojeće usluge zadržite.';
  const old=['Kurirske dostave','Nabavka i kupovina','Fizička pomoć','Košenje trave','Utovar i istovar'];
  const digital='Izrada PowerPoint prezentacija',physical='Pomoć pri nošenju stvari pri selidbi';
  const catalog=[...mutationCatalog,
    {categoryId:id(24),label:digital,parentId:null,isLeaf:true,aliases:[],modes:['REMOTE']},
    {categoryId:id(25),label:'Kurirske dostave',parentId:null,isLeaf:true,aliases:[],modes:['ON_SITE']}];
  const output=providerWorker('WORKER_ADD_SERVICE',text,{
    assistantMessage:'Dodate su obe usluge. Sve je spremno za pregled.',
    patch:{availability:null,bio:'Izrađujem prezentacije onlajn i nosim stvari pri selidbi. Nemam kombi.'},
    serviceChanges:[digital,physical].map(service=>({action:'ADD',service,replacement:'',evidence:text})),
    serviceModeChangesJson:JSON.stringify([{service:digital,modes:['REMOTE'],evidence:text,handoff:{required:false}},
      {service:physical,modes:['ON_SITE'],evidence:text}]),
    taxonomyDecisions:[reuseDecision(digital,'REMOTE',id(24)),reuseDecision(physical,'ON_SITE',id(20))],
  });
  const result=await handlerHarness('WORKER',text,output,{singlePass:true,skills:old,
    serviceModeContext:modeContext([],[],old),catalog}).run();
  assert.equal(result.events.at(-1)?.kind,'final',JSON.stringify({events:result.events,logs:result.logs}));
  const saved=result.writes[0].args.p_output;
  assert.deepEqual(saved.patch.skills,[...old,digital,physical]);
  assert.match(saved.patch.bio,/Nemam kombi/);
  assert.equal(Object.hasOwn(saved.patch,'vehicles'),false);
  assert.equal(saved.assistantMessage,'Da li uslugu „Kurirske dostave“ pružate na lokaciji, onlajn ili na oba načina?');
  const newBindings=[binding(digital,'REMOTE',id(24),{required:false}),binding(physical,'ON_SITE',id(20))];
  assert.deepEqual(planBindings(result),newBindings,'Missing legacy choices do not erase independently supported new work');
  assertOnePaidAttempt(result);

  const reply='Na lokaciji.';
  const continuation=providerWorker('CONTINUE','',{
    serviceModeChangesJson:JSON.stringify([{service:old[0],modes:['ON_SITE'],evidence:reply}]),
    taxonomyDecisions:[reuseDecision(old[0],'ON_SITE',id(25))],
  });
  const next=await handlerHarness('WORKER',reply,continuation,{singlePass:true,skills:[...old,digital,physical],
    history:[{role:'USER',body:text},{role:'ASSISTANT',body:saved.assistantMessage},{role:'USER',body:reply}],
    serviceModeContext:modeContext([],newBindings,old),catalog}).run();
  assert.equal(next.events.at(-1)?.kind,'final',JSON.stringify({events:next.events,logs:next.logs}));
  assert.deepEqual(planBindings(next),[binding(old[0],'ON_SITE',id(25)),...newBindings]);
  assert.equal(next.writes[0].args.p_output.assistantMessage,'Da li uslugu „Nabavka i kupovina“ pružate na lokaciji, onlajn ili na oba načina?');
  assertOnePaidAttempt(next);
});

test('Worker actual Edge: empty mode metadata recovers quoted historical choices while a current explanation replaces only its broad service', async () => {
  const capture=JSON.parse(fs.readFileSync(path.join(ROOT,'scripts/sql/worker_catalog_conflict_20261109.preimage.json'),'utf8'));
  const old=capture.proposals.map(p=>p.service);
  const earlier='Prezentacije radim samo onlajn. Sve ostale navedene usluge radim isključivo na terenu u Novom Sadu. Nemam vozilo. Dostupan sam radnim danima od 9 do 17.';
  const text='Pod fizičkim poslovima mislim na ručno iznošenje kutija i nošenje nameštaja, bez prevoza. Sve ostale usluge i podatke zadržite.';
  const replacement='Ručno iznošenje kutija i nošenje nameštaja bez prevoza';
  const skills=old.map((service,i)=>i===2?replacement:service);
  const catalog=capture.catalog.categories.map(c=>({categoryId:c.id,label:c.label,parentId:c.parent_id,
    isLeaf:!capture.catalog.categories.some(child=>child.parent_id===c.id),aliases:[],
    modes:capture.catalog.modes.filter(m=>m.category_id===c.id).map(m=>m.execution_scope)}));
  const decisions=capture.proposals.map((p,i)=>reuseDecision(skills[i],p.mode,
    i===2?capture.proposals[6].categoryId:p.categoryId));
  const output=providerWorker('WORKER_EDIT_SERVICE',text,{
    serviceChanges:[{action:'REPLACE',service:old[2],replacement,evidence:text}],
    serviceModeChangesJson:JSON.stringify(skills.map((service,i)=>({service,modes:[capture.proposals[i].mode],
      evidence:i===2?text:earlier,...(i===5?{handoff:{required:false}}:{})}))),
    taxonomyDecisions:decisions,
  });
  const result=await handlerHarness('WORKER',text,args=>{
    const sent=JSON.stringify(args);
    assert.ok(sent.includes(earlier),'The original owned USER answer reaches the one provider call');
    assert.match(sent,/unresolvedServices means there is no current validated mode metadata, NOT that the person has not answered/);
    assert.match(sent,/CURRENT USER concretely explains the work meant by an existing broad label/);
    return output;
  },{singlePass:true,skills:old,revision:3,catalog,
    serviceModeContext:{...modeContext([],[],old),revision:3},
    history:[{role:'USER',body:earlier},{role:'ASSISTANT',body:'Pregled još nije spreman. Ne morate ponavljati već navedene podatke.'},
      {role:'USER',body:text}]}).run();
  assert.equal(result.events.at(-1)?.kind,'final',JSON.stringify({events:result.events,logs:result.logs}));
  assert.deepEqual(result.writes[0].args.p_output.patch,{skills});
  assert.deepEqual(planBindings(result),decisions.map((p,i)=>binding(p.service,p.mode,p.categoryId,i===5?{required:false}:undefined)));
  assert.equal(result.writes[0].args.p_taxonomy_plan.proposals.length,7);
  assert.equal(result.writes[0].args.p_taxonomy_plan.anchors.some(a=>a.categoryId===capture.proposals[2].categoryId),false,
    'The old broad or rejected category is not inherited by the replacement');
  assert.doesNotMatch(result.writes[0].args.p_output.assistantMessage,/Da li uslugu|na lokaciji, onlajn ili na oba/);
  assert.equal(result.writes[0].args.p_output.assistantMessage,'Podaci iz razgovora su sačuvani.');
  assertOnePaidAttempt(result);
  // Controlled model output proves the Edge contract, not natural model accuracy
  // or SQL readiness; the neutral prose never claims that the profile was saved.
});

test('Worker historical mode recovery still rejects assistant-only quotes, invented evidence and historical service renaming', async () => {
  const service='Košenje trave',text='Sve ostale usluge i podatke zadržite.',earlier='Košenje trave radim isključivo na terenu.';
  for(const history of [[{role:'ASSISTANT',body:earlier},{role:'USER',body:text}],
    [{role:'USER',body:'Košenje trave još nisam odredio.'},{role:'USER',body:text}]]){
    const output=providerWorker('CONTINUE','',{
      serviceModeChangesJson:JSON.stringify([{service,modes:['ON_SITE'],evidence:earlier}]),
      taxonomyDecisions:[reuseDecision(service,'ON_SITE',id(22))],
    });
    const result=await handlerHarness('WORKER',text,output,{singlePass:true,skills:[service],history,
      serviceModeContext:modeContext([],[],[service]),catalog:mutationCatalog}).run();
    assert.equal(result.events.at(-1)?.kind,'final');
    assert.equal(result.writes[0].name,'rpc_complete_worker_ai_turn_service');
    assert.equal(Object.hasOwn(result.writes[0].args,'p_taxonomy_plan'),false);
    assertOnePaidAttempt(result);
  }
  const old='Fizički poslovi',past='Pod fizičkim poslovima mislim na nošenje kutija bez prevoza.';
  const result=await handlerHarness('WORKER',text,providerWorker('CONTINUE','',{
    serviceChanges:[{action:'REPLACE',service:old,replacement:'Nošenje kutija bez prevoza',evidence:past}],
    serviceModeChangesJson:'[]',taxonomyDecisions:[],
  }),{singlePass:true,skills:[old],history:[{role:'USER',body:past},{role:'USER',body:text}],
    serviceModeContext:modeContext([],[],[old]),catalog:mutationCatalog}).run();
  assert.equal(result.events.at(-1)?.kind,'final');
  assert.equal(Object.hasOwn(result.writes[0].args.p_output.patch,'skills'),false,
    'Historical mode evidence does not relax current-user authority for service edits');
  assert.equal(Object.hasOwn(result.writes[0].args,'p_taxonomy_plan'),false);
  assertOnePaidAttempt(result);
});

for (const recovery of [false, true]) test('Worker actual Edge: ADD keeps an unrelated BOTH identity, including lost completion ACK=' + recovery, async () => {
  const text = 'Takođe kosim travu na lokaciji, uz postojeću lekturu.', service = 'Košenje trave';
  const saved = [binding('Lektura', 'REMOTE', id(21), { required: false }), binding('Lektura', 'ON_SITE', id(21))];
  const output = providerWorker('WORKER_ADD_SERVICE', text, {
    serviceChanges: [{ action: 'ADD', service, replacement: '', evidence: text }],
    serviceModeChangesJson: JSON.stringify([{ service, modes: ['ON_SITE'], evidence: text }]),
    taxonomyDecisions: [reuseDecision(service, 'ON_SITE', id(22)),
      // Unsolicited reclassification of a preserved synonym must be ignored.
      reuseDecision('Lektura', 'REMOTE', id(23))],
  });
  const result = await handlerHarness('WORKER', text, output, { singlePass: true, skills: ['Lektura'],
    serviceModeContext: modeContext(saved), catalog: mutationCatalog,
    ...(recovery ? { completionOutcome: 'LOST_ACK' } : {}) }).run();
  assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
  assert.deepEqual(result.writes[0].args.p_output.patch, { skills: ['Lektura', service] });
  assert.deepEqual(planBindings(result), [...saved, binding(service, 'ON_SITE', id(22))]);
  assert.equal(result.writes[0].name, 'rpc_complete_worker_ai_turn_with_first_plan_service');
  assert.equal(result.writes.length, 1, 'Lost acknowledgement uses the persisted exact result, never a second writer');
  assert.equal(result.calls.filter(call => call.name === 'rpc_ai_read_first_plan_completion_service').length, recovery ? 1 : 0);
  if (recovery) assert.deepEqual(result.calls.find(call => call.name === 'rpc_ai_read_first_plan_completion_service').args,
    { p_writer: result.writes[0].name, p_arguments: result.writes[0].args });
  assertOnePaidAttempt(result);
});

test('Worker actual Edge: REMOVE does not restore the removed service or an intentionally removed half of BOTH', async () => {
  const text = 'Više ne kosim travu, lekturu nastavljam.', remaining = binding('Lektura', 'REMOTE', id(21), { required: false });
  const saved = [remaining, binding('Lektura', 'ON_SITE', id(21)), binding('Košenje trave', 'ON_SITE', id(22))];
  const output = providerWorker('WORKER_REMOVE_SERVICE', text, {
    serviceChanges: [{ action: 'REMOVE', service: 'Košenje trave', replacement: '', evidence: text }],
    serviceModeChangesJson: '[]', taxonomyDecisions: [reuseDecision('Košenje trave', 'ON_SITE', id(22))],
  });
  const result = await handlerHarness('WORKER', text, output, { singlePass: true, skills: ['Lektura', 'Košenje trave'],
    serviceModeContext: modeContext(saved, [remaining]), catalog: mutationCatalog }).run();
  assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
  assert.deepEqual(result.writes[0].args.p_output.patch, { skills: ['Lektura'] });
  assert.deepEqual(planBindings(result), [remaining]);
  assertOnePaidAttempt(result);
});

test('Worker actual Edge: scoped REPLACE removes transport identity, keeps unrelated work and never invents a van', async () => {
  const text = 'Selidbe radim samo kao fizička pomoć na lokaciji. Nemam kombi.', service = 'Fizička pomoć pri selidbi';
  const retained = binding('Košenje trave', 'ON_SITE', id(22));
  const output = providerWorker('WORKER_EDIT_SERVICE', text, {
    serviceChanges: [{ action: 'REPLACE', service: 'Selidbe sa prevozom', replacement: service, evidence: text }],
    serviceModeChangesJson: JSON.stringify([{ service, modes: ['ON_SITE'], evidence: text }]),
    taxonomyDecisions: [reuseDecision(service, 'ON_SITE', id(20)), reuseDecision('Selidbe sa prevozom', 'ON_SITE', id(23))],
  });
  const result = await handlerHarness('WORKER', text, output, { singlePass: true, skills: ['Selidbe sa prevozom', retained.service],
    serviceModeContext: modeContext([binding('Selidbe sa prevozom', 'ON_SITE', id(23)), retained]), catalog: mutationCatalog }).run();
  assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
  assert.deepEqual(result.writes[0].args.p_output.patch, { skills: [service, retained.service] });
  assert.deepEqual(planBindings(result), [binding(service, 'ON_SITE', id(20)), retained]);
  assert.equal(result.writes[0].args.p_taxonomy_plan.anchors.some(anchor => anchor.categoryId === id(23)), false);
  assertOnePaidAttempt(result);
});

test('Worker actual Edge: incomplete new BOTH never becomes partial authority beside an unaffected saved service', async () => {
  const text = 'Dodajem lekturu preko interneta i uživo na lokaciji.', service = 'Lektura';
  const retained = binding('Košenje trave', 'ON_SITE', id(22));
  const output = providerWorker('WORKER_ADD_SERVICE', text, {
    serviceChanges: [{ action: 'ADD', service, replacement: '', evidence: text }],
    serviceModeChangesJson: JSON.stringify([{ service, modes: ['REMOTE', 'ON_SITE'], evidence: text, handoff: { required: false } }]),
    taxonomyDecisions: [reuseDecision(service, 'REMOTE', id(21))],
  });
  const result = await handlerHarness('WORKER', text, output, { singlePass: true, skills: [retained.service],
    serviceModeContext: modeContext([retained]), catalog: mutationCatalog }).run();
  assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
  assert.deepEqual(result.writes[0].args.p_output.patch, { skills: [retained.service, service] });
  assert.deepEqual(planBindings(result), [retained], 'Unresolved BOTH is kept out of the plan as one complete service');
  assert.match(result.writes[0].args.p_output.assistantMessage, /Pregled još nije spreman/);
  assertOnePaidAttempt(result);
});

test('Worker actual Edge: removing the last saved service creates no replacement or taxonomy authority', async () => {
  const text = 'Više ne nudim lekturu.', service = 'Lektura';
  const output = providerWorker('WORKER_REMOVE_SERVICE', text, {
    serviceChanges: [{ action: 'REMOVE', service, replacement: '', evidence: text }], serviceModeChangesJson: '[]',
    taxonomyDecisions: [reuseDecision(service, 'REMOTE', id(21))],
  });
  const result = await handlerHarness('WORKER', text, output, { singlePass: true, skills: [service],
    serviceModeContext: modeContext([binding(service, 'REMOTE', id(21), { required: false })]), catalog: mutationCatalog }).run();
  assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
  assert.deepEqual(result.writes[0].args.p_output.patch, { skills: [] });
  assert.equal(result.writes[0].name, 'rpc_complete_worker_ai_turn_service');
  assert.equal(Object.hasOwn(result.writes[0].args, 'p_taxonomy_plan'), false);
  assertOnePaidAttempt(result);
});

test('Worker actual Edge: mismatched removals, stale evidence and legacy full-list overwrite keep existing services', async () => {
  const text = 'Više ne radim selidbe.', base = ['Prevoz', 'Utovar'];
  for (const extra of [
    { serviceChanges: [{ action: 'REMOVE', service: 'Selidbe', replacement: '', evidence: text }] },
    { serviceChanges: [{ action: 'REMOVE', service: 'Prevoz', replacement: '', evidence: 'Ranije sam radio prevoz.' }] },
    { patch: { availability: null, skills: ['Selidbe'], bio: 'Radim samo selidbe.' }, serviceChanges: [] },
  ]) {
    const result = await handlerHarness('WORKER', text, providerWorker('WORKER_REMOVE_SERVICE', text, extra), { skills: base }).run();
    assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
    assert.deepEqual(result.writes[0].args.p_output.patch, {});
    assert.equal(result.writes[0].args.p_output.safety, 'CLARIFY');
  }
});

test('Worker actual Edge: a recurring statement cannot become today-only availability even under a mislabeled DATED plan', async () => {
  for (const text of ['Dostupan sam svakog dana od 8 do 22.', 'Доступан сам сваког дана од 8 до 22.']) {
    for (const scope of ['WEEKLY', 'DATED']) {
      const availability = { windowsUpsert: [{ id: null, startsAt: '2026-11-07T07:00:00Z',
        endsAt: '2026-11-07T21:00:00Z', state: 'AVAILABLE', label: 'Danas' }] };
      const result = await handlerHarness('WORKER', text, providerWorker('WORKER_AVAILABILITY', text, {
        patch: { availability }, availabilityChange: { kind: 'PATCH', scope, evidence: text },
      }), { skills: ['Lektura tekstova'] }).run();
      assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
      assert.deepEqual(result.writes[0].args.p_output.patch, {}, 'No dated window may reach the canonical writer');
      assert.equal(result.writes[0].args.p_output.safety, 'CLARIFY');
      assert.equal(result.calls.filter(call => /streamGenerateContent/.test(call.name)).length, 1);
    }
  }
});

test('Worker actual Edge: paused now toggle is rejected without changing weekly or current saved data', async () => {
  const text = 'Dostupan sam svakog dana od 8 do 22 po vremenu Beograda. Trenutno sam dostupan.';
  const availability = { timezone: 'Europe/Belgrade', availableNow: true, ruleChanges: [{ ruleId: null,
    weekdays: [0, 1, 2, 3, 4, 5, 6], value: { startTime: '08:00', endTime: '22:00', startsOn: '2026-11-07',
      endsOn: null, label: 'Svakog dana', active: true } }] };
  const result = await handlerHarness('WORKER', text, providerWorker('WORKER_AVAILABILITY', text, {
    patch: { availability }, availabilityChange: { kind: 'PATCH', scope: 'MIXED', evidence: text },
  }), { skills: ['Lektura tekstova'] }).run();
  assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
  assert.deepEqual(result.writes[0].args.p_output.patch, {}, 'The paused immediate feature cannot change any calendar facts');
  assert.equal(result.writes[0].args.p_output.safety, 'CLARIFY');
  assert.equal(result.calls.filter(call => /streamGenerateContent/.test(call.name)).length, 1);
  const request = result.calls.find(call => /streamGenerateContent/.test(call.name)).args;
  assert.ok(request.generationConfig.responseSchema.properties.availabilityChange.required.includes('scope'));
  assert.ok(!request.generationConfig.responseSchema.properties.availabilityChange.properties.scope.enum.includes('NOW'));
});

test('Worker actual Edge: historical availability evidence cannot authorize a new calendar change', async () => {
  const previous = 'Sada sam dostupan.', text = 'Dodaj i prevode.';
  const result = await handlerHarness('WORKER', text, providerWorker('WORKER_ADD_SERVICE', text, {
    patch: { availability: { availableNow: true } },
    serviceChanges: [{ action: 'ADD', service: 'Prevođenje', replacement: '', evidence: text }],
    availabilityChange: { kind: 'PATCH', scope: 'NOW', evidence: previous },
  }), { skills: ['Lektura tekstova'], history: [{ role: 'USER', body: previous, id: id(55) }] }).run();
  assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
  assert.deepEqual(result.writes[0].args.p_output.patch, { skills: ['Lektura tekstova', 'Prevođenje'] });
  assert.equal(result.writes[0].args.p_output.safety, 'CLARIFY');
});

// Execute only the real route-owned closure/commit block with explicit refs.
// This checks authority races without claiming a renderer or native UI test.
function routeFragment(relative, choose, scope, expression = true) {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  const ast = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = [];
  const visit = node => { const chosen = choose(node, ast); if (chosen) matches.push(chosen.getText(ast)); ts.forEachChild(node, visit); };
  visit(ast); assert.equal(matches.length, 1, 'One real route fragment must match in ' + relative);
  const raw = expression ? 'module.exports = (' + matches[0] + ');' : 'module.exports = () => {' + matches[0] + '};';
  const output = ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('scope', 'module', 'with (scope) {' + output + '}')(scope, module);
  return module.exports;
}
const routePath = domain => domain === 'NEED' ? 'src/app/(app)/nova.tsx' : 'src/app/(app)/profil/razgovor.tsx';

for (const domain of ['NEED', 'WORKER']) {
  test(`${domain} real route handoff closure rejects retained onPress after blur, background and foreground replacement`, () => {
    const staged = [], pushed = [], foreground = {}, generation = { current: foreground };
    let current = true;
    const scope = { canAct: () => current, enabled: true, writable: true, currentRoleSuggestion: { text: 'Potpuna korisnička poruka.' },
      accountId: ACCOUNT, accountRevision: 5, request: { current: null }, pending: { current: null }, draftText: { current: '' },
      voice: { controller: { getSnapshot: () => ({ phase: 'IDLE' }) } }, noviUuidZahtevId: () => id(14),
      stageAiRoleText: value => { staged.push(value); return true; }, navigate: go => go(), leave: go => go(),
      router: { push: value => pushed.push(value) }, restartOwner: generation, foregroundGeneration: generation,
      renderedForeground: foreground };
    const name = domain === 'NEED' ? 'openSuggestedWorker' : 'openSuggestedNeed';
    const action = routeFragment(routePath(domain), node => ts.isVariableDeclaration(node) && node.name.getText() === name ? node.initializer : null, scope);
    current = false; action(); assert.equal(staged.length, 0, 'stale account/focus cannot navigate');
    current = true; generation.current = null; action(); assert.equal(staged.length, 0, 'background cannot navigate before rerender');
    generation.current = {}; action(); assert.equal(staged.length, 0, 'returning active never revives the old handler');
    generation.current = foreground; scope.draftText.current = 'Nov neposlat nacrt'; action(); assert.equal(staged.length, 0);
    scope.draftText.current = ''; scope.request.current = {}; scope.pending.current = {}; action(); assert.equal(staged.length, 0);
    scope.request.current = null; scope.pending.current = null; action();
    assert.deepEqual(staged, [{ token: id(14), text: 'Potpuna korisnička poruka.', target: domain === 'NEED' ? 'WORKER' : 'NEED', accountId: ACCOUNT, accountRevision: 5 }]);
    assert.equal(pushed.length, 1);
    assert.equal(JSON.stringify(pushed).includes('Potpuna korisnička poruka.'), false, 'The route gets a token, never private draft text');
  });

  test(`${domain} real route canonical gate refuses stale, blocked, image and unrelated receipt content`, () => {
    const intentApi = sourceLoader({})('src/contracts/aiConversationIntent.ts');
    const body = 'Cela izvorna poruka.', changes = [], foreground = {};
    const canonical = domain === 'NEED' ? { conversationId: CONVERSATION, safety: 'ALLOW', messages: [
      { id: id(6), body, fromAi: false }, { id: id(7), body: 'Predlog', fromAi: true }] }
      : { conversationId: CONVERSATION, safety: 'ALLOW', turn: workerTurn(), messages: [
        { id: id(6), body, role: 'USER' }, { id: id(7), body: 'Predlog', role: 'ASSISTANT' }] };
    let current = true;
    const scope = { isCurrent: () => current, current: () => current, presence: foreground, restartOwner: { current: foreground },
      abort: { signal: { aborted: false } }, controller: { signal: { aborted: false } },
      semanticHint: { value: hint(domain === 'NEED' ? 'WORKER_OFFER' : 'NEED_REQUEST', body) },
      oppositeInterviewDomain: intentApi.oppositeInterviewDomain, command: { id: REQUEST, body, text: body },
      id: CONVERSATION, data: { conversationId: CONVERSATION }, setRoleSuggestion: value => changes.push(value),
      nextRead: { ok: true, podatak: { conversation: canonical } },
      result: domain === 'NEED' ? { ok: true, podatak: needTurn() } : { ok: true, podatak: canonical },
      sent: { ok: true, podatak: workerTurn() } };
    const commit = routeFragment(routePath(domain), (node, ast) => ts.isIfStatement(node)
      && node.expression.getText(ast).includes('semanticHint.value') && node.thenStatement.getText(ast).includes('setRoleSuggestion(') ? node : null, scope, false);
    current = false; commit(); assert.equal(changes.length, 0); current = true;
    canonical.safety = 'REVIEW'; commit(); assert.equal(changes.length, 0); canonical.safety = 'ALLOW';
    canonical.messages[0].body = 'Druga poruka.'; commit(); assert.equal(changes.length, 0); canonical.messages[0].body = body;
    if (domain === 'NEED') {
      scope.command.image = { base64: 'fixture', mimeType: 'image/jpeg' }; commit(); assert.equal(changes.length, 0); delete scope.command.image;
      scope.restartOwner.current = {}; commit(); assert.equal(changes.length, 0); scope.restartOwner.current = foreground;
      canonical.messages[1].id = id(15); commit(); assert.equal(changes.length, 0); canonical.messages[1].id = id(7);
    } else {
      canonical.turn.clientRequestId = id(15); commit(); assert.equal(changes.length, 0); canonical.turn.clientRequestId = REQUEST;
      canonical.turn.turnId = id(15); commit(); assert.equal(changes.length, 0); canonical.turn.turnId = TURN;
      scope.controller.signal.aborted = true; commit(); assert.equal(changes.length, 0); scope.controller.signal.aborted = false;
    }
    commit(); assert.equal(changes.length, 1); assert.equal(changes[0].text, body);
    assert.equal(changes[0].assistantMessageId, id(7));
  });

  test(`${domain} real receiving effect appends an unsent draft once and never consumes an overflowing transfer`, () => {
    const handoff = sourceLoader({})('src/data/aiRoleHandoff.ts'), token = id(18), text = 'Izvorna poruka za drugi razgovor.';
    let rendered = '';
    const scope = { roleHandoff: token, accountId: ACCOUNT, accountRevision: 5, canSubmit: true, writable: true, data: { conversationId: CONVERSATION },
      focus: { current: {} }, active: { current: true }, restartOwner: { current: {} }, request: { current: null }, pending: { current: null },
      owns: () => true, sesijaSada: () => ({ user: { id: ACCOUNT }, accountRevision: 5 }), draftText: { current: 'z'.repeat(3990) },
      draftRevision: { current: 8 }, takeNeedText: handoff.takeNeedText, takeWorkerText: handoff.takeWorkerText,
      setUnos: value => { rendered = value; }, setInput: value => { rendered = value; }, showPanel: () => {} };
    const effect = routeFragment(routePath(domain), (node, ast) => ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
      && node.arguments[0]?.getText(ast).includes(domain === 'NEED' ? 'takeNeedText(' : 'takeWorkerText(') ? node.arguments[0] : null, scope);
    assert.equal(handoff.stageAiRoleText({ token, text, target: domain, accountId: ACCOUNT, accountRevision: 5 }), true);
    effect(); assert.equal(rendered, ''); assert.equal(scope.draftRevision.current, 8);
    scope.draftText.current = 'Već napisano'; effect();
    assert.equal(rendered, 'Već napisano\n' + text); assert.equal(scope.draftRevision.current, 9);
    effect(); assert.equal(scope.draftRevision.current, 9, 'the same navigation token is consumed once');
  });
}

test('Need fast-path confirmation cannot navigate through a retained callback from a previous foreground generation', () => {
  const foreground = {}, staged = [];
  const scope = { canAct: () => true, request: { current: null }, accountId: ACCOUNT, accountRevision: 5,
    renderedForeground: foreground, restartOwner: { current: null }, body: 'Nudim časove.',
    voice: { controller: { getSnapshot: () => ({ phase: 'IDLE' }) } }, noviUuidZahtevId: () => id(19),
    stageWorkerText: value => { staged.push(value); return true; }, navigate: go => go(), router: { push: () => {} } };
  const confirm = routeFragment(routePath('NEED'), (node, ast) => ts.isPropertyAssignment(node) && node.name.getText(ast) === 'onConfirm'
    && node.initializer.getText(ast).includes('stageWorkerText(') ? node.initializer : null, scope);
  confirm(); assert.equal(staged.length, 0); scope.restartOwner.current = {}; confirm(); assert.equal(staged.length, 0);
  scope.restartOwner.current = foreground; confirm(); assert.equal(staged.length, 1);
});

test('production intake uses its own exact-project admission before one paid provider dispatch', async () => {
  const text = 'Koji podatak još nedostaje?';
  const env = { SUPABASE_URL: 'https://fvyqqudqvizjrxaflhex.supabase.co',
    USKOCI_TAXONOMY_ROLLOUT_SCOPE: 'PROD', USKOCI_TAXONOMY_ALLOWED_PROJECT_REF: 'fvyqqudqvizjrxaflhex',
    USKOCI_GEMINI_PAID_TEST_ENABLED: 'false', USKOCI_GEMINI_PRODUCTION_ENABLED: 'true' };
  for (const domain of ['NEED', 'WORKER']) {
    const output = domain === 'NEED' ? providerNeed('QUESTION', text) : providerWorker('QUESTION', text);
    const admitted = await handlerHarness(domain, text, output, { env, singlePass: true }).run();
    assert.equal(admitted.calls.filter(call => call.name === 'rpc_ai_test_budget_reserve_service').length, 1);
    assert.equal(admitted.calls.filter(call => call.url.includes('googleapis.com')).length, 1);
    for (const rejectedEnv of [
      { USKOCI_GEMINI_PRODUCTION_ENABLED: 'false' },
      { USKOCI_TAXONOMY_ALLOWED_PROJECT_REF: 'leqcwgzvjsxugfgzdmth' },
    ]) {
      const rejected = await handlerHarness(domain, text, output, { env: { ...env, ...rejectedEnv }, singlePass: true }).run();
      assert.equal(rejected.calls.some(call => call.url.includes('googleapis.com')), false);
    }
  }
});

test('Worker actual Edge: finish-only keeps the exact owned mode and cannot invent a new mode', async () => {
  const text='To je to.',service='Lektura',retained=binding(service,'REMOTE',id(21),{required:false});
  const output=providerWorker('CONTINUE',text,{
    assistantMessage:'U redu, sada radite samo na lokaciji.',
    serviceModeChangesJson:JSON.stringify([{service,modes:['ON_SITE'],evidence:text}]),
    taxonomyDecisions:[reuseDecision(service,'ON_SITE',id(21))],
  });
  const result=await handlerHarness('WORKER',text,output,{singlePass:true,skills:[service],
    serviceModeContext:modeContext([retained]),catalog:mutationCatalog}).run();
  assert.equal(result.events.at(-1)?.kind,'final',JSON.stringify({events:result.events,logs:result.logs}));
  assert.deepEqual(result.writes[0].args.p_output.patch,{});
  assert.deepEqual(planBindings(result),[retained]);
  assert.doesNotMatch(result.writes[0].args.p_output.assistantMessage,/samo na lokaciji/);
  assertOnePaidAttempt(result);
});

test('Worker actual Edge: finish-only can recover an earlier explicit unresolved mode without inventing one', async () => {
  const text='Хвала, то је то.',service='Lektura',prior='Nudim lekturu tekstova isključivo preko interneta, bez lične predaje.';
  const output=providerWorker('CONTINUE',text,{
    serviceModeChangesJson:JSON.stringify([{service,modes:['REMOTE'],evidence:prior,handoff:{required:false}}]),
    taxonomyDecisions:[reuseDecision(service,'REMOTE',id(21))],
  });
  const result=await handlerHarness('WORKER',text,output,{singlePass:true,skills:[service],
    serviceModeContext:modeContext([],[],[service]),catalog:mutationCatalog,
    history:[{role:'USER',body:prior},{role:'ASSISTANT',body:'Da li želite još nešto da dodate?'},{role:'USER',body:text}],
  }).run();
  assert.equal(result.events.at(-1)?.kind,'final',JSON.stringify({events:result.events,logs:result.logs}));
  assert.deepEqual(result.writes[0].args.p_output.patch,{});
  assert.deepEqual(planBindings(result),[binding(service,'REMOTE',id(21),{required:false})]);
  assertOnePaidAttempt(result);
});

test('Worker actual Edge: an explicit mode correction after a finish phrase still reaches the owned plan', async () => {
  const text='To je to, ali lekturu ipak radim samo na lokaciji.',service='Lektura';
  const output=providerWorker('CORRECTION',text,{
    serviceModeChangesJson:JSON.stringify([{service,modes:['ON_SITE'],evidence:text}]),
    taxonomyDecisions:[reuseDecision(service,'ON_SITE',id(21))],
  });
  const result=await handlerHarness('WORKER',text,output,{singlePass:true,skills:[service],
    serviceModeContext:modeContext([binding(service,'REMOTE',id(21),{required:false})]),catalog:mutationCatalog}).run();
  assert.equal(result.events.at(-1)?.kind,'final',JSON.stringify({events:result.events,logs:result.logs}));
  assert.deepEqual(planBindings(result),[binding(service,'ON_SITE',id(21))]);
  assertOnePaidAttempt(result);
});

for(const text of ['Promeni na 1.500.','Промени на 1.500.']) test('NEED actual Edge: amount-only correction preserves hourly price terms: '+text,async()=>{
  const definitions=sourceLoader({})('src/contracts/needFactsV2.ts').NEED_FACT_V2_DEFINITIONS;
  const activeFacts=[
    ['need.title','Lektura teksta'],['need.category','Lektura'],['need.description','Potrebna je lektura teksta'],
    ['need.people_needed',2],['need.price_mode','MY_PRICE'],['need.price_rsd',1200],['need.price_basis','HOURLY'],
    ['need.schedule_kind','REMOTE_ANYTIME'],['need.task_country_code','RS'],
    ['need.task_geography',{mode:'REMOTE'}],['need.handoff',{required:false}],
  ].map(([fact_key,fact_value])=>({fact_key,fact_value,value_type:definitions[fact_key].valueType,
    display_value:typeof fact_value==='object'?JSON.stringify(fact_value):String(fact_value),
    fact_schema_version:'NEED_FACT_V2',status:'CONFIRMED',source:'USER',created_at:'2026-11-10T10:00:00Z'}));
  const before=JSON.stringify(activeFacts);
  const output=providerNeed('NEED_EDIT',text,{
    assistantMessage:'Cena je sada ukupno 1500 RSD za jednu osobu.',
    dialogue:{next:'ACK',questionKey:'NONE',taskRelation:'CONTINUE',priceUnit:'WHOLE_JOB',schedulePattern:'UNSPECIFIED'},
    facts:[['need.price_rsd',1500],['need.price_basis','TOTAL'],['need.people_needed',1]]
      .map(([key,value])=>({key,valueJson:JSON.stringify(value),displayValue:String(value),confidence:1,evidence:text})),
    taxonomyDecisions:[],
  });
  const result=await handlerHarness('NEED',text,output,{singlePass:true,activeFacts,
    history:[{role:'ASSISTANT',body:'Koju cenu u dinarima po osobi po satu želite da postavite?',sequence_no:1}],
    catalog:[{categoryId:id(21),label:'Lektura',parentId:null,isLeaf:true,aliases:[],modes:['REMOTE']}],
  }).run();
  assert.equal(result.events.at(-1)?.kind,'final',JSON.stringify({events:result.events,logs:result.logs}));
  assert.equal(result.writes.length,1);
  assert.deepEqual(result.writes[0].args.p_proposals.map(p=>[p.key,p.value]),[['need.price_rsd',1500]]);
  assert.doesNotMatch(result.writes[0].args.p_assistant_message,/ukupno|za jednu osobu/);
  assert.equal(JSON.stringify(activeFacts),before);
  assertOnePaidAttempt(result);
});

test('Worker actual Edge: finish-only preserves one genuine missing work-area question', async () => {
  const text='To je to.',service='Košenje trave',question='U kom gradu i području želite da radite?';
  const output=providerWorker('CONTINUE',text,{safety:'CLARIFY',assistantMessage:question,
    serviceModeChangesJson:'[]',taxonomyDecisions:[],
  });
  const result=await handlerHarness('WORKER',text,output,{singlePass:true,skills:[service],
    serviceModeContext:modeContext([binding(service,'ON_SITE',id(22))]),catalog:mutationCatalog}).run();
  assert.equal(result.events.at(-1)?.kind,'final',JSON.stringify({events:result.events,logs:result.logs}));
  assert.deepEqual(result.writes[0].args.p_output.patch,{});
  assert.equal(result.writes[0].args.p_output.assistantMessage,question);
  assert.equal(result.writes[0].args.p_output.safety,'CLARIFY');
  assertOnePaidAttempt(result);
});

test('Worker actual Edge: finishing never confirms Save or bypasses REVIEW', async () => {
  for(const safety of ['ALLOW','REVIEW']) {
    const text='Сачувај профил.',service='Lektura';
    const output=providerWorker('CONTINUE',text,{safety,assistantMessage:'Profil je sačuvan i aktiviran.',
      serviceModeChangesJson:'[]',taxonomyDecisions:[],
    });
    const result=await handlerHarness('WORKER',text,output,{singlePass:true,skills:[service],
      serviceModeContext:modeContext([binding(service,'REMOTE',id(21),{required:false})]),catalog:mutationCatalog}).run();
    assert.equal(result.events.at(-1)?.kind,'final',JSON.stringify({events:result.events,logs:result.logs}));
    assert.deepEqual(result.writes[0].args.p_output.patch,{});
    assert.equal(result.writes[0].args.p_output.safety,safety);
    assert.doesNotMatch(result.writes[0].args.p_output.assistantMessage,/Profil je sačuvan|aktiviran/);
    assertOnePaidAttempt(result);
  }
});
