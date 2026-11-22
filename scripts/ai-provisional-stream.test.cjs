'use strict';
// Provisional assistant text: incremental JSON-string extraction, the display gate,
// the client decoder and both actual Edge handlers. Only HTTP is substituted; no
// provider, SQL mutation, account or paid call is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const ACCOUNT = id(1), CONVERSATION = id(2), REQUEST = id(3), TURN = id(4), ATTEMPT = id(5);

function sourceLoader(overrides, globals = {}) {
  const modules = new Map();
  function load(relative) {
    if (Object.hasOwn(overrides, relative)) return overrides[relative];
    const resolved = ['', '.ts', '.tsx', '.js', '.mjs'].map(ext => path.resolve(ROOT, relative + ext))
      .find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    assert.ok(resolved, 'Actual source module must exist: ' + relative);
    relative = path.relative(ROOT, resolved).replaceAll(path.sep, '/');
    if (Object.hasOwn(overrides, relative)) return overrides[relative];
    if (modules.has(relative)) return modules.get(relative).exports;
    const result = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
      fileName: resolved.endsWith('.mjs') ? resolved + '.ts' : resolved,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
    const mod = { exports: {} }; modules.set(relative, mod);
    const localRequire = name => name.startsWith('.')
      ? load(path.relative(ROOT, path.resolve(path.dirname(resolved), name)).replaceAll(path.sep, '/'))
      : Object.hasOwn(overrides, name) ? overrides[name] : require(name);
    new Function('require', 'module', 'exports', ...Object.keys(globals), result.outputText)
      (localRequire, mod, mod.exports, ...Object.values(globals));
    return mod.exports;
  }
  return load;
}
const helper = sourceLoader({})('supabase/functions/_shared/assistantMessageStream.ts');

function splitEverywhere(text, run) {
  for (let size = 1; size <= 7; size++) {
    const chunks = [];
    for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
    run(chunks, size);
  }
}

test('extractor equals JSON.parse for escapes, \\uXXXX, surrogate pairs and any chunking', () => {
  const messages = ['Dobar dan! Kada Vam odgovara?', 'Navodnici "unutra", kosa crta \\ i / i\ttab\nred.',
    'Emoji 🧑🏽‍🚀 i 👨‍👩‍👧‍👦, ćirilica Добар дан, kombinovano č.', ''];
  for (const message of messages) {
    const bodies = [
      JSON.stringify({ assistantMessage: message, safety: 'ALLOW', facts: [] }),
      // Not first, with decoy keys/strings and nested assistantMessage that must be ignored.
      JSON.stringify({ dialogue: { assistantMessage: 'nested decoy', note: '{"assistantMessage":"x"}' }, list: ['a', '}{'], assistantMessage: message, after: 'ignored' }),
      // Escape every non-ASCII unit as \uXXXX, including surrogate halves.
      JSON.stringify({ assistantMessage: message }).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')),
    ];
    for (const body of bodies) splitEverywhere(body, chunks => {
      const extractor = helper.createAssistantMessageExtractor();
      let decoded = '';
      for (const chunk of chunks) {
        const delta = extractor.push(chunk);
        if (delta) assert.ok(!/[\ud800-\udbff]$/.test(delta), 'a delta never ends inside a surrogate pair');
        decoded += delta;
      }
      assert.equal(decoded, JSON.parse(body).assistantMessage);
      assert.equal(extractor.complete(), true, 'stops at the closing quote');
      assert.equal(extractor.push('"more"}'), '', 'nothing after the closing quote is returned');
    });
  }
});

test('extractor rejects malformed or oversized assistant text instead of guessing', () => {
  for (const body of ['{"assistantMessage":"a\\x"}', '{"assistantMessage":"a\\u12g4"}', '{"assistantMessage":"a\u0001"}',
    '{"assistantMessage":"\\u0001"}', '}']) {
    assert.throws(() => helper.createAssistantMessageExtractor().push(body), /AI_STREAM_INVALID/);
  }
  assert.throws(() => helper.createAssistantMessageExtractor().push(JSON.stringify({ assistantMessage: 'a'.repeat(1201) })), /AI_STREAM_INVALID/);
});

function gated(text, chunkSize = 1) {
  const gate = helper.createProvisionalTextGate();
  let shown = '';
  for (let i = 0; i < text.length; i += chunkSize) shown += gate.push(text.slice(i, i + chunkSize));
  return { shown, closed: gate.closed() };
}

test('gate releases only complete words, a prefix of the eventual message, without splitting graphemes', () => {
  const text = 'Razumem, treba Vam pomoć 🧑🏽‍🚀 oko selidbe u 15 časova sutra ujutru. Da li ima lifta?';
  for (const size of [1, 2, 3, 5, 11]) {
    const { shown, closed } = gated(text, size);
    assert.equal(closed, false);
    assert.ok(text.startsWith(shown) && shown.length > 20, JSON.stringify(shown));
    assert.ok(/\s$/.test(shown), 'only whitespace-terminated words are released');
  }
});

test('gate suppresses money, house numbers, street numbers and completion claims, even across chunks', () => {
  const sensitive = [
    ['Zabeležio sam budžet od 3 000 RSD za ceo posao. Da li', '3'],
    ['U redu, 50 € je okvirni iznos za ovaj posao danas.', '50'],
    ['Okvirno 2500 dinara po satu, da li Vam odgovara to?', '2500'],
    ['Cena od 1500 za ceo posao je zabeležena u nacrtu sada.', '1500'],
    ['Dolazim na Takovska 12 sutra ujutru, da li je to tačno?', '12'],
    ['Adresa je ulica Njegoševa broj 5 u centru grada danas.', '5'],
    ['Адреса је Булевар ослобођења 5а у центру, да ли тако?', '5'],
    ['Super, zadatak je objavljen i radnici ga vide odmah sada.', 'objavljen'],
    ['To je oko tri hiljade dinara za ceo posao, da li može?', 'hiljade'],
  ];
  for (const [text, forbidden] of sensitive) for (const size of [1, 4, 9]) {
    const { shown, closed } = gated(text, size);
    assert.equal(closed, true, text);
    assert.ok(!shown.includes(forbidden), `${JSON.stringify(shown)} must not include ${forbidden}`);
    assert.ok(text.startsWith(shown));
  }
  // Times and quantities are not addresses: they are shown once their context is complete.
  const safe = gated('Može sutra u 15 časova, za 2 osobe i oko 3 sata rada ukupno. ');
  assert.equal(safe.closed, false);
  assert.ok(safe.shown.includes('15 časova') && safe.shown.includes('3 sata'), safe.shown);
});

test('Gemini SSE adapter emits incremental assistant deltas that equal the final message', async () => {
  const message = 'Važi 🧑🏽‍🚀, pitam samo neophodno: \"kada\" Vam odgovara?';
  const body = JSON.stringify({ assistantMessage: message, safety: 'ALLOW', facts: [] });
  const pieces = []; for (let i = 0; i < body.length; i += 3) pieces.push(body.slice(i, i + 3));
  const events = pieces.map((text, index) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] },
    ...(index === pieces.length - 1 ? { finishReason: 'STOP' } : {}) }],
    ...(index === pieces.length - 1 ? { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } } : {}) }) + '\n\n').join('');
  const fetchMock = async () => new Response(events, { headers: { 'content-type': 'text/event-stream' } });
  const { streamGeminiTask } = sourceLoader({}, { fetch: fetchMock })('supabase/functions/_shared/geminiTaskStream.ts');
  const deltas = [];
  const raw = await streamGeminiTask({ url: 'https://generativelanguage.googleapis.com/x', key: 'k',
    body: JSON.stringify({ contents: [], generationConfig: {} }), onText: delta => deltas.push(delta) });
  assert.equal(raw, body);
  assert.ok(deltas.length > 5, 'text arrives incrementally, not once at the end');
  assert.equal(deltas.join(''), message);
});

// ---- client decoder -------------------------------------------------------
const clientLoad = sourceLoader({ 'expo/fetch': { fetch() { throw Error('NO_NETWORK'); } },
  'src/store/sesija.ts': { sesijaSada: () => null },
  'src/data/supabaseClient.ts': { supabaseKlijent: () => { throw Error('NO_SDK'); } } });
const { createAiTurnStreamDecoder } = clientLoad('src/data/aiNeedTurnStream.ts');
const ev = (sequence, kind, extra = {}, ids = {}) => ({ conversationId: CONVERSATION, clientRequestId: REQUEST,
  turnId: TURN, attemptId: ATTEMPT, sequence, kind, ...ids, ...extra });
const needTurn = (patch = {}) => ({ conversationId: CONVERSATION, clientRequestId: REQUEST, state: 'SUCCEEDED', turnId: TURN,
  retryAllowed: false, receipt: { userMessageId: id(6), assistantMessageId: id(7), proposedCount: 0, safety: 'ALLOW',
    schemaVersion: 'NEED_FACT_V2', authoritative: true }, ...patch });
function decoder() {
  const texts = [];
  const d = createAiTurnStreamDecoder({ conversationId: CONVERSATION, clientRequestId: REQUEST, current: () => true, onText: t => texts.push(t) });
  return { d, texts };
}

test('client accepts provisional deltas and old server shapes, then the final receipt', () => {
  const a = decoder();
  a.d.accept(ev(1, 'accepted')); a.d.accept(ev(2, 'text_delta', { text: 'Dobar ', provisional: true }));
  a.d.accept(ev(3, 'text_delta', { text: 'dan ', provisional: true })); a.d.accept(ev(4, 'final', { turn: needTurn() }));
  assert.deepEqual(a.texts, ['Dobar ', 'dan ']); assert.deepEqual(a.d.result(), needTurn());
  const old = decoder();
  old.d.accept(ev(1, 'accepted')); old.d.accept(ev(2, 'text_delta', { text: 'Potvrđen odgovor.' })); old.d.accept(ev(3, 'final', { turn: needTurn() }));
  assert.deepEqual(old.texts, ['Potvrđen odgovor.']);
});

test('client rejects ambiguous provisional markers, mixed text kinds and an older attempt', () => {
  for (const extra of [{ text: 'a', provisional: false }, { text: 'a', provisional: 'yes' }, { text: 'a', provisional: true, extra: 1 }]) {
    const c = decoder(); c.d.accept(ev(1, 'accepted'));
    assert.throws(() => c.d.accept(ev(2, 'text_delta', extra)), /AI_STREAM_INVALID/);
  }
  const mixed = decoder(); mixed.d.accept(ev(1, 'accepted')); mixed.d.accept(ev(2, 'text_delta', { text: 'a ', provisional: true }));
  assert.throws(() => mixed.d.accept(ev(3, 'text_delta', { text: 'Potvrđeno.' })), /AI_STREAM_INVALID/);
  const stale = decoder(); stale.d.accept(ev(1, 'accepted'));
  assert.throws(() => stale.d.accept(ev(2, 'text_delta', { text: 'stari ', provisional: true }, { attemptId: id(9) })), /AI_STREAM_INVALID/);
  assert.throws(() => stale.d.accept(ev(2, 'text_delta', { text: 'stari ', provisional: true }, { turnId: id(8) })), /AI_STREAM_INVALID/);
  assert.deepEqual(stale.texts, [], 'an older turn/attempt never reaches the bubble');
  const failed = decoder(); failed.d.accept(ev(1, 'accepted')); failed.d.accept(ev(2, 'text_delta', { text: 'Možda ', provisional: true }));
  failed.d.accept(ev(3, 'safe_error', { code: 'AI_TURN_NOT_CONFIRMED' }));
  assert.equal(failed.d.failed(), true); assert.equal(failed.d.result(), undefined, 'provisional text is never a result');
});

test('routes drop the preview on failure; canonical readback replaces it on success', () => {
  const nova = fs.readFileSync(path.join(ROOT, 'src/app/(app)/nova.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const worker = fs.readFileSync(path.join(ROOT, 'src/app/(app)/profil/razgovor.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(nova, /if \(!result\.ok\) \{\n(?:\s*\/\/.*\n)*\s*setStreamingText\(''\);/);
  assert.ok(nova.includes("if (!sent.ok) setStreamingText('');"));
  assert.equal((worker.match(/if\(!sent\.ok\)setStream\(''\);/g) ?? []).length, 2);
});

// ---- actual Edge handlers -------------------------------------------------
function handlerHarness(domain, message, options = {}) {
  const calls = [], handlers = [], background = [];
  const env = { SUPABASE_URL: 'https://leqcwgzvjsxugfgzdmth.supabase.co', SUPABASE_ANON_KEY: 'public-fixture',
    SUPABASE_SERVICE_ROLE_KEY: 'server-fixture', GEMINI_API_KEY: 'provider-fixture', GEMINI_MODEL: 'gemini-3.8-flash',
    AI_PROVIDER: 'gemini', USKOCI_GEMINI_PAID_TEST_ENABLED: 'true', USKOCI_TAXONOMY_DUAL_GEMINI: String(options.singlePass === true),
    USKOCI_TAXONOMY_ROLLOUT_SCOPE: 'DEV', USKOCI_TAXONOMY_ALLOWED_PROJECT_REF: 'leqcwgzvjsxugfgzdmth' };
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  const processing = domain === 'NEED' ? needTurn({ state: 'PROCESSING', receipt: null })
    : { turnId: TURN, conversationId: CONVERSATION, clientRequestId: REQUEST, attemptId: ATTEMPT, state: 'PROCESSING', retryAllowed: false, authoritative: true };
  const output = options.output ? options.output : domain === 'NEED'
    ? { assistantMessage: message, safety: 'ALLOW', facts: [], dialogue: { next: 'ANSWER', questionKey: 'NONE', taskRelation: 'CONTINUE', priceUnit: 'UNSPECIFIED', schedulePattern: 'UNSPECIFIED' },
      conversationIntent: { kind: 'CONTINUE', evidence: '' } }
    : { assistantMessage: message, safety: 'ALLOW', patch: { availability: null }, availabilityChange: { kind: 'NONE', scope: 'NONE', evidence: '' },
      serviceChanges: [], conversationIntent: { kind: 'CONTINUE', evidence: '' } };
  const fetchMock = async (url, init = {}) => {
    const parsed = new URL(String(url)), name = parsed.pathname.split('/').at(-1);
    const args = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ name, args });
    if (parsed.pathname === '/auth/v1/user') return json({ id: ACCOUNT });
    if (parsed.pathname === '/rest/v1/ai_conversations') return json([{ id: CONVERSATION, account_id: ACCOUNT, fact_schema_version: 'NEED_FACT_V2', status: 'OPEN' }]);
    if (parsed.hostname === 'generativelanguage.googleapis.com') {
      await options.beforeProvider?.();
      if (init.signal?.aborted) throw new Error('aborted');
      const body = JSON.stringify(typeof output === 'function' ? output(args) : output), pieces = [];
      for (let i = 0; i < body.length; i += 4) pieces.push(body.slice(i, i + 4));
      const sse = pieces.map((text, index) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] },
        ...(index === pieces.length - 1 ? { finishReason: 'STOP' } : {}) }],
        ...(index === pieces.length - 1 ? { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 30, totalTokenCount: 130 } } : {}) }) + '\n\n').join('');
      return new Response(sse, { headers: { 'content-type': 'text/event-stream' } });
    }
    if (name === 'rpc_ai_claim_need_turn_v2_service') return json({ turn: processing, claim: { attemptId: ATTEMPT,
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(), context: { schemaVersion: 'NEED_FACT_V2', history: options.history ?? [], activeFacts: options.activeFacts ?? [] } } });
    if (name === 'rpc_claim_worker_ai_turn_service') return json({ acquired: true, turn: processing });
    if (name === 'rpc_read_worker_ai_context_service') return json({ schemaVersion: 'WORKER_PROFILE_V1', accountId: ACCOUNT,
      conversationId: CONVERSATION, status: 'OPEN', stale: false, safety: 'ALLOW', profileStatus: 'DRAFT', revision: 1,
      candidate: { displayName: 'QA', bio: '', skills: [], location: { operatingCountryCode: 'RS', city: '', radiusKm: 0 },
        availability: { timezone: 'Europe/Belgrade', rules: [], windows: [] }, tools: [], vehicles: [], workAreas: [] },
      messages: [{ role: 'USER', body: 'Zdravo', id: id(6) }] });
    if (name === 'rpc_ai_test_budget_reserve_service') return json({ admitted: true, replay: false, reservationId: id(10), code: 'AI_TEST_RESERVED' });
    if (name === 'rpc_ai_dispatch_need_turn_v2_service' || name === 'rpc_dispatch_worker_ai_turn_service') {
      await options.beforeDispatchAck?.();
      return json(domain === 'NEED' ? true : { dispatched: true, turn: processing });
    }
    if (name === 'rpc_ai_test_record_usage_service') return json(true);
    if (name === 'rpc_ai_fail_need_turn_v2_service' || name === 'rpc_fail_worker_ai_turn_service') return json(true);
    if (name === 'rpc_taxonomy_fetch_snapshot_v1') return json({ catalogVersion: 17, catalogFingerprint: 'fixture-catalog',
      count: (options.catalog ?? []).length, categories: options.catalog ?? [] });
    if (name === 'rpc_ai_complete_need_turn_with_first_plan_service') return json({ completion: needTurn({ receipt: { ...needTurn().receipt,
      proposedCount: args.p_proposals.length, safety: args.p_safety } }), firstPlan: { state: 'RESOLVED', authority: 'CATALOG_ONLY', applicability: 'NOT_EVALUATED' } });
    if (name === 'rpc_ai_complete_need_turn_v2_service') return json(needTurn({ receipt: { ...needTurn().receipt, proposedCount: args.p_proposals.length, safety: args.p_safety } }));
    if (name === 'rpc_complete_worker_ai_turn_service') return json({ ...processing, state: 'SUCCEEDED' });
    throw new Error('Unexpected external call: ' + parsed.pathname);
  };
  const quiet = Object.fromEntries(['log', 'info', 'warn', 'error'].map(level => [level, () => {}]));
  const load = sourceLoader({}, { Deno: { env: { get: key => env[key] }, serve: handler => handlers.push(handler) }, fetch: fetchMock, console: quiet });
  const previous = globalThis.EdgeRuntime;
  globalThis.EdgeRuntime = { waitUntil: promise => { background.push(promise); } };
  const exported = load(domain === 'NEED' ? 'supabase/functions/uskoci-ai-interview/index.ts' : 'supabase/functions/uskoci-worker-interview/index.ts');
  const handler = handlers[0] ?? exported.handleWorkerInterview;
  return {
    calls, background,
    async start({ provisional = true, signal } = {}) {
      return handler(new Request(env.SUPABASE_URL + '/functions/v1/fixture', { method: 'POST', signal,
        headers: { Authorization: 'Bearer fixture-token', 'Content-Type': 'application/json', Accept: 'text/event-stream',
          ...(provisional ? { 'x-uskoci-ai-provisional-stream': 'v1' } : {}) },
        body: JSON.stringify({ conversationId: CONVERSATION, clientRequestId: REQUEST, text: options.text ?? 'Zdravo' }) }));
    },
    async settle() { await Promise.allSettled(background); await new Promise(resolve => setTimeout(resolve, 20)); await Promise.allSettled(background); },
    restore() { globalThis.EdgeRuntime = previous; },
  };
}
const parseEvents = raw => raw.split('\n\n').filter(Boolean).map(part => JSON.parse(part.slice(6)));
const persisted = calls => calls.filter(call => /^rpc_(?:ai_)?complete_/.test(call.name));

for (const domain of ['NEED', 'WORKER']) {
  test(`${domain} actual Edge: opted-in client sees gated provisional text before final; persistence uses the guarded message`, async () => {
    const message = 'Razumem, rado ću pomoći oko toga. Kada Vam odgovara da počnemo sa poslom?';
    const h = handlerHarness(domain, message);
    try {
      const events = parseEvents(await (await h.start()).text()); await h.settle();
      const provisional = events.filter(e => e.kind === 'text_delta');
      assert.ok(provisional.length >= 3, JSON.stringify(events.map(e => e.kind)));
      assert.ok(provisional.every(e => e.provisional === true));
      assert.ok(message.startsWith(provisional.map(e => e.text).join('')));
      assert.equal(events.at(-1).kind, 'final');
      assert.ok(events.findIndex(e => e.kind === 'final') > events.findLastIndex(e => e.kind === 'text_delta'));
      const writes = persisted(h.calls); assert.equal(writes.length, 1);
      const stored = domain === 'NEED' ? writes[0].args.p_assistant_message : writes[0].args.p_output.assistantMessage;
      assert.equal(typeof stored, 'string');
      assert.ok(!JSON.stringify(writes[0].args).includes('"provisional"'), 'provisional flag/text is never persisted');
    } finally { h.restore(); }
  });

  test(`${domain} actual Edge: legacy client keeps the exact previous event shape`, async () => {
    const message = 'Razumem, rado ću pomoći oko toga. Kada Vam odgovara da počnemo?';
    const h = handlerHarness(domain, message);
    try {
      const events = parseEvents(await (await h.start({ provisional: false })).text()); await h.settle();
      assert.ok(events.every(e => !Object.hasOwn(e, 'provisional')));
      assert.deepEqual(events.map(e => e.kind), domain === 'NEED' ? ['accepted', 'final'] : ['accepted', 'text_delta', 'final']);
    } finally { h.restore(); }
  });

  test(`${domain} actual Edge: provisional money text is suppressed; final still arrives`, async () => {
    const h = handlerHarness(domain, 'Zabeležio sam budžet od 3000 RSD za ceo posao. Da li je to u redu za Vas danas?');
    try {
      const events = parseEvents(await (await h.start()).text()); await h.settle();
      const shown = events.filter(e => e.kind === 'text_delta').map(e => e.text).join('');
      assert.ok(!/3000|RSD/.test(shown), shown);
      assert.equal(events.at(-1).kind, 'final');
    } finally { h.restore(); }
  });

  test(`${domain} actual Edge: disconnect after dispatch still completes the paid answer in SQL, once`, async () => {
    const client = new AbortController();
    let response;
    const h = handlerHarness(domain, 'Razumem. Kada Vam odgovara da počnemo?', {
      beforeProvider: async () => { client.abort(); await response?.body?.cancel().catch(() => undefined); },
    });
    try {
      response = await h.start({ signal: client.signal });
      await h.settle();
      for (let i = 0; i < 50 && !persisted(h.calls).length; i++) { await new Promise(resolve => setTimeout(resolve, 10)); await h.settle(); }
      assert.equal(h.calls.filter(call => call.name.endsWith(':streamGenerateContent')).length, 1, 'one provider call');
      assert.equal(persisted(h.calls).length, 1, 'the dispatched answer is completed, not wasted');
      assert.equal(h.calls.some(call => /fail_(?:need|worker)/.test(call.name)), false, 'the dispatched attempt is not retired');
      assert.equal(h.calls.filter(call => call.name === 'rpc_ai_test_record_usage_service').length, 1);
    } finally { h.restore(); }
  });

  test(`${domain} actual Edge: disconnect before dispatch ACK never reaches the provider`, async () => {
    const client = new AbortController();
    const h = handlerHarness(domain, 'Razumem.', { beforeDispatchAck: async () => { client.abort(); } });
    try {
      const response = await h.start({ signal: client.signal });
      await response.text().catch(() => '');
      await h.settle();
      assert.equal(h.calls.filter(call => call.name.endsWith(':streamGenerateContent')).length, 0);
      assert.equal(persisted(h.calls).length, 0);
    } finally { h.restore(); }
  });
}

// ---- stuck classification: CREATE_CHILD repeating its parent (DEV 1c4fa742, 20.11.2026) ----
const ROOT_ID = '00000000-0000-4000-8000-000000000001', PARENT_ID = '00000000-0000-4000-8000-000000000017';
const SERVICE = 'Statiranje i pomoć na snimanju', PARENT_LABEL = 'Potrčko, svakodnevna pomoć i briga';
const fixtureCatalog = [
  { categoryId: ROOT_ID, label: 'Pomoć i usluge', parentId: null, isLeaf: false, aliases: [], modes: [] },
  { categoryId: PARENT_ID, label: PARENT_LABEL, parentId: ROOT_ID, isLeaf: true, aliases: [], modes: ['ON_SITE'] },
];
const observedDecision = { service: SERVICE, mode: 'ON_SITE', action: 'CREATE_CHILD', categoryId: '', parentId: PARENT_ID,
  proposedPath: [PARENT_LABEL, SERVICE], ambiguityPrompt: '',
  reason: 'Statiranje i asistencija na snimanju spota je fizička/praktična ispomoć na terenu.' };
const taxonomy = sourceLoader({})('supabase/functions/_shared/backgroundTaxonomyArchitect.mjs');

test('CREATE_CHILD that repeats its parent/ancestors keeps only the new labels (no SQL CATALOG_CONFLICT)', async () => {
  const catalog = taxonomy.indexFullCatalog(17, 'a'.repeat(32), fixtureCatalog, true);
  for (const proposedPath of [[PARENT_LABEL, SERVICE], ['Pomoć i usluge', PARENT_LABEL, SERVICE], [SERVICE]]) {
    const normalized = taxonomy.normalizeCreateChildDecision({ ...observedDecision, proposedPath }, catalog);
    assert.equal(normalized.action, 'CREATE_CHILD');
    assert.deepEqual(normalized.proposedPath, [SERVICE]);
  }
  // The leaf itself named as the only path element is reuse of that leaf, revalidated later.
  const same = taxonomy.normalizeCreateChildDecision({ ...observedDecision, service: PARENT_LABEL, proposedPath: [PARENT_LABEL] }, catalog);
  assert.equal(same.action, 'REUSE_EXISTING'); assert.equal(same.categoryId, PARENT_ID); assert.deepEqual(same.proposedPath, []);
  // Other actions are untouched.
  // A new branch whose first label already exists is re-anchored below that node.
  const branch = taxonomy.normalizeTaxonomyDecision({ ...observedDecision, action: 'CREATE_NEW_BRANCH', parentId: '' }, catalog);
  assert.equal(branch.action, 'CREATE_CHILD'); assert.equal(branch.parentId, PARENT_ID); assert.deepEqual(branch.proposedPath, [SERVICE]);
  // A "new" service that already exists anywhere is reused; a missing mode is an explicit extension.
  const elsewhere = taxonomy.normalizeTaxonomyDecision({ ...observedDecision, service: PARENT_LABEL, parentId: ROOT_ID,
    proposedPath: ['Nešto novo', PARENT_LABEL] }, catalog);
  assert.equal(elsewhere.action, 'REUSE_EXISTING'); assert.equal(elsewhere.categoryId, PARENT_ID);
  const remote = taxonomy.normalizeTaxonomyDecision({ ...observedDecision, service: PARENT_LABEL, mode: 'REMOTE', proposedPath: [PARENT_LABEL] }, catalog);
  assert.equal(remote.action, 'EXTEND_MODE');
  // REUSE/EXTEND are aligned with the leaf's real modes instead of failing in SQL (MODE_UNRESOLVED).
  const reuse = { ...observedDecision, service: PARENT_LABEL, action: 'REUSE_EXISTING', categoryId: PARENT_ID, parentId: '', proposedPath: [] };
  assert.equal(taxonomy.normalizeTaxonomyDecision({ ...reuse, mode: 'REMOTE' }, catalog).action, 'EXTEND_MODE');
  assert.equal(taxonomy.normalizeTaxonomyDecision({ ...reuse, action: 'EXTEND_MODE' }, catalog).action, 'REUSE_EXISTING');
  // Ambiguous duplicate labels are never guessed.
  const twice = taxonomy.indexFullCatalog(17, 'a'.repeat(32), [...fixtureCatalog,
    { categoryId: '00000000-0000-4000-8000-000000000099', label: PARENT_LABEL, parentId: null, isLeaf: true, aliases: [], modes: ['ON_SITE'] }], true);
  const ambiguous = { ...observedDecision, action: 'CREATE_NEW_BRANCH', parentId: '' };
  assert.deepEqual(taxonomy.normalizeTaxonomyDecision(ambiguous, twice), ambiguous);
  const built = await taxonomy.buildFullTreeTaxonomyProposals({ suppliedCatalog: catalog, suppliedDecisions: [observedDecision],
    items: [{ service: SERVICE, mode: 'ON_SITE' }], conversationId: CONVERSATION, draftRevision: 2 });
  assert.equal(built.proposals.length, 1);
  assert.deepEqual(built.proposals[0].proposedPath, [SERVICE]);
  assert.equal(built.proposals[0].parentId, PARENT_ID);
  // SQL taxonomy_resolve_turn_catalog_v1 raises CATALOG_CONFLICT when a path label is an
  // existing category whose parent differs from the walked parent; none may remain.
  const existing = new Set(fixtureCatalog.map(node => taxonomy.normalizedClassificationIdentity(node.label)));
  assert.ok(built.proposals[0].proposedPath.every(label => !existing.has(taxonomy.normalizedClassificationIdentity(label))));
});

test('NEED actual Edge: the observed conversation persists a resolvable CREATE_CHILD plan', async () => {
  const definitions = sourceLoader({})('src/contracts/needFactsV2.ts').NEED_FACT_V2_DEFINITIONS;
  const activeFacts = [
    ['need.title', 'Statiranje na snimanju spota'], ['need.category', SERVICE],
    ['need.description', 'Potrebno je 20 osoba za statiranje i pomoć oko snimanja spota u Novom Sadu'], ['need.people_needed', 20],
    ['need.price_mode', 'MY_PRICE'], ['need.price_rsd', 5000], ['need.price_basis', 'PER_PERSON'],
    ['need.task_country_code', 'RS'], ['need.task_geography', { mode: 'STATIONARY', start: { city: 'Novi Sad', area: 'Sajam', label: 'Sajam' } }],
  ].map(([fact_key, fact_value]) => ({ fact_key, fact_value, value_type: definitions[fact_key].valueType,
    display_value: typeof fact_value === 'object' ? JSON.stringify(fact_value) : String(fact_value),
    fact_schema_version: 'NEED_FACT_V2', status: 'CONFIRMED', source: 'USER', created_at: '2026-11-20T20:03:00Z' }));
  const output = args => ({ assistantMessage: 'Okupljanje je kod Sajma u Novom Sadu. Proverite pregled zadatka.', safety: 'ALLOW', facts: [],
    dialogue: { next: 'REVIEW', questionKey: 'NONE', taskRelation: 'CONTINUE', priceUnit: 'UNSPECIFIED', schedulePattern: 'UNSPECIFIED' },
    conversationIntent: { kind: 'CONTINUE', evidence: '' },
    ...(args.generationConfig.responseSchema.properties.taxonomyDecisions ? { taxonomyDecisions: [observedDecision] } : {}) });
  const h = handlerHarness('NEED', '', { singlePass: true, catalog: fixtureCatalog, activeFacts, output,
    text: 'Okupljali bi se kod sajma u novom sadu' });
  try {
    const events = parseEvents(await (await h.start({ provisional: false })).text()); await h.settle();
    assert.equal(events.at(-1).kind, 'final', JSON.stringify(events));
    const writes = persisted(h.calls);
    assert.equal(writes.length, 1); assert.equal(writes[0].name, 'rpc_ai_complete_need_turn_with_first_plan_service');
    const plan = writes[0].args.p_taxonomy_plan;
    assert.equal(plan.proposals[0].action, 'CREATE_CHILD');
    assert.equal(plan.proposals[0].parentId, PARENT_ID);
    assert.deepEqual(plan.proposals[0].proposedPath, [SERVICE]);
    assert.notEqual(writes[0].args.p_assistant_message, 'Hvala, sve sam zapisao 🙂 Pregled još nije spreman, ali ne morate ništa da ponavljate.');
  } finally { h.restore(); }
});

test('NEED actual Edge: a per-person payment after a budget question is a price, not a question about the number', async () => {
  const text = 'Placam za svakom po 5000';
  const output = { assistantMessage: 'Zabeležio sam iznos po osobi. U kom delu grada je zadatak?', safety: 'ALLOW',
    facts: [['need.price_mode', 'MY_PRICE'], ['need.price_rsd', 5000], ['need.price_basis', 'PER_PERSON']]
      .map(([key, value]) => ({ key, valueJson: JSON.stringify(value), displayValue: String(value), confidence: 1, evidence: text })),
    dialogue: { next: 'ASK', questionKey: 'need.task_geography', taskRelation: 'CONTINUE', priceUnit: 'UNSPECIFIED', schedulePattern: 'UNSPECIFIED' },
    conversationIntent: { kind: 'CONTINUE', evidence: '' } };
  const history = [{ role: 'USER', body: '27.12.2026', sequence_no: 1 },
    { role: 'ASSISTANT', body: 'Zabeležio sam datum. Imate li predviđeni okvirni budžet za ovaj angažman ili želite da Vam zainteresovani pošalju ponude?', sequence_no: 2 }];
  for (const message of [output.assistantMessage, 'Zabeležio sam 5000 RSD po osobi. U kom delu grada je zadatak?']) {
    const h = handlerHarness('NEED', '', { output: { ...output, assistantMessage: message }, history, text });
    try {
      const events = parseEvents(await (await h.start({ provisional: false })).text()); await h.settle();
      assert.equal(events.at(-1).kind, 'final');
      const write = persisted(h.calls)[0].args;
      assert.notEqual(write.p_assistant_message, 'Samo da proverim: na šta se odnosi taj broj, na cenu, broj ljudi ili nešto drugo?');
      assert.ok(write.p_proposals.some(p => p.key === 'need.price_rsd' && p.value === 5000), JSON.stringify(write.p_proposals));
    } finally { h.restore(); }
  }
});

test('NEED actual Edge: an unclassified but clear service gets one concrete question, never the dead-end state', async () => {
  const definitions = sourceLoader({})('src/contracts/needFactsV2.ts').NEED_FACT_V2_DEFINITIONS;
  const activeFacts = [['need.title', 'Statiranje'], ['need.category', SERVICE], ['need.description', 'Statiranje na snimanju spota'],
    ['need.people_needed', 20], ['need.task_country_code', 'RS'],
    ['need.task_geography', { mode: 'STATIONARY', start: { city: 'Novi Sad', area: 'Sajam', label: 'Sajam' } }]]
    .map(([fact_key, fact_value]) => ({ fact_key, fact_value, value_type: definitions[fact_key].valueType,
      display_value: typeof fact_value === 'object' ? JSON.stringify(fact_value) : String(fact_value),
      fact_schema_version: 'NEED_FACT_V2', status: 'CONFIRMED', source: 'USER', created_at: '2026-11-20T20:03:00Z' }));
  const output = { assistantMessage: 'Sve je spremno za pregled.', safety: 'ALLOW', facts: [], taxonomyDecisions: [],
    dialogue: { next: 'REVIEW', questionKey: 'NONE', taskRelation: 'CONTINUE', priceUnit: 'UNSPECIFIED', schedulePattern: 'UNSPECIFIED' },
    conversationIntent: { kind: 'CONTINUE', evidence: '' } };
  const h = handlerHarness('NEED', '', { singlePass: true, catalog: fixtureCatalog, activeFacts, output, text: 'To je to' });
  try {
    const events = parseEvents(await (await h.start({ provisional: false })).text()); await h.settle();
    assert.equal(events.at(-1).kind, 'final');
    const message = persisted(h.calls)[0].args.p_assistant_message;
    assert.notEqual(message, 'Hvala, sve sam zapisao 🙂 Pregled još nije spreman, ali ne morate ništa da ponavljate.');
    assert.ok(message.includes(SERVICE) && message.includes('?'), message);
  } finally { h.restore(); }
});
