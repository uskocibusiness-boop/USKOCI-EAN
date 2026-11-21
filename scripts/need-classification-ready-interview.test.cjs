'use strict';
// A ready NEED interview never ends in a silent PENDING_CLASSIFICATION state (owner rule
// 21.11.2026). Regression tests built from anonymized DEV row shapes of
// private.ai_task_reviews with classificationState='PENDING_CLASSIFICATION':
//  - 5097976c-…: need.category held a catalog UUID ("00000000-…-000000000103"),
//  - 9204e07e-… ("Izrada herbarijuma") / e975537c-… ("statiranje"): no decision in any turn,
//    final reply was the dead-end "Pregled još nije spreman",
//  - 9c75ed03-… / 1c4fa742-…: decision only in an earlier (CLARIFY/DEFERRED) turn.
// Runs the actual Edge handler with fake HTTP only: no Gemini, SQL or paid call.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const ACCOUNT = id(1), CONVERSATION = id(2), REQUEST = id(3), TURN = id(4), ATTEMPT = id(5);
const compiled = new Map();
const DEAD_END = /Pregled još nije spreman/;

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

function needHarness(text, providerOutput, options = {}) {
  const calls = [], logs = [], handlers = [];
  const env = { SUPABASE_URL: 'https://leqcwgzvjsxugfgzdmth.supabase.co', SUPABASE_ANON_KEY: 'public-fixture',
    SUPABASE_SERVICE_ROLE_KEY: 'server-fixture', GEMINI_API_KEY: 'provider-fixture', GEMINI_MODEL: 'gemini-3.8-flash',
    AI_PROVIDER: 'gemini', USKOCI_GEMINI_PAID_TEST_ENABLED: 'true', USKOCI_TAXONOMY_DUAL_GEMINI: 'true',
    USKOCI_TAXONOMY_ROLLOUT_SCOPE: 'DEV', USKOCI_TAXONOMY_ALLOWED_PROJECT_REF: 'leqcwgzvjsxugfgzdmth' };
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  const fetchMock = async (url, init = {}) => {
    const parsed = new URL(String(url)), name = parsed.pathname.split('/').at(-1);
    const args = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ url: parsed.origin + parsed.pathname, name, args });
    if (parsed.pathname === '/auth/v1/user') return json({ id: ACCOUNT });
    if (parsed.pathname === '/rest/v1/ai_conversations') return json([{ id: CONVERSATION, account_id: ACCOUNT, fact_schema_version: 'NEED_FACT_V2', status: 'OPEN' }]);
    if (parsed.hostname === 'generativelanguage.googleapis.com') {
      assert.equal(calls.filter(call => call.url.startsWith(parsed.origin)).length, 1, 'one Gemini call per message');
      const output = typeof providerOutput === 'function' ? providerOutput(args) : providerOutput;
      const value = { candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 30, totalTokenCount: 130 } };
      return new Response('data: ' + JSON.stringify(value) + '\n\n', { headers: { 'content-type': 'text/event-stream' } });
    }
    if (name === 'rpc_ai_claim_need_turn_v2_service') return json({ turn: needTurn({ state: 'PROCESSING', receipt: null }),
      claim: { attemptId: ATTEMPT, leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        context: { schemaVersion: 'NEED_FACT_V2', history: options.history ?? [], activeFacts: options.activeFacts ?? [] } } });
    if (name === 'rpc_ai_test_budget_reserve_service') return json({ admitted: true, replay: false, reservationId: id(10), code: 'AI_TEST_RESERVED' });
    if (name === 'rpc_ai_dispatch_need_turn_v2_service') return json(true);
    if (name === 'rpc_taxonomy_fetch_snapshot_v1') {
      const categories = options.catalog ?? [{ categoryId: id(20), label: 'Fizička pomoć pri selidbi', parentId: null, isLeaf: true, aliases: [], modes: ['ON_SITE'] }];
      return json({ catalogVersion: 17, catalogFingerprint: 'fixture-catalog', count: categories.length, categories });
    }
    if (name === 'rpc_ai_test_record_usage_service' || name === 'rpc_ai_fail_need_turn_v2_service') return json(true);
    if (['rpc_ai_complete_need_turn_v2_service', 'rpc_ai_complete_need_turn_with_first_plan_service'].includes(name)) {
      const completed = needTurn({ receipt: { ...needTurn().receipt, proposedCount: args.p_proposals.length, safety: args.p_safety } });
      return json(name.includes('first_plan') ? { completion: completed,
        firstPlan: { state: 'RESOLVED', authority: 'CATALOG_ONLY', applicability: 'NOT_EVALUATED' } } : completed);
    }
    throw new Error('Unexpected external call: ' + parsed.origin + parsed.pathname);
  };
  const load = sourceLoader({}, { Deno: { env: { get: name => env[name] }, serve: handler => handlers.push(handler) },
    fetch: fetchMock, console: Object.fromEntries(['log', 'info', 'warn', 'error'].map(name => [name, (...args) => logs.push(args)])) });
  load('supabase/functions/uskoci-ai-interview/index.ts');
  return { async run() {
    const response = await handlers[0](new Request(env.SUPABASE_URL + '/functions/v1/fixture', { method: 'POST',
      headers: { Authorization: 'Bearer fixture-account-token', 'Content-Type': 'application/json', Accept: 'text/event-stream',
        'x-uskoci-interview-intent': 'v1' },
      body: JSON.stringify({ conversationId: CONVERSATION, clientRequestId: REQUEST, text }) }));
    const raw = await response.text();
    const events = raw.split('\n\n').filter(Boolean).map(part => JSON.parse(part.slice(6)));
    const writes = calls.filter(call => /rpc_ai_complete_need_/.test(call.name));
    const provider = calls.filter(call => call.url.includes('generativelanguage'));
    return { status: response.status, events, calls, writes, provider, logs };
  } };
}

const definitions = sourceLoader({})('src/contracts/needFactsV2.ts').NEED_FACT_V2_DEFINITIONS;
const facts = entries => entries.map(([fact_key, fact_value]) => ({ fact_key, fact_value, value_type: definitions[fact_key].valueType,
  display_value: typeof fact_value === 'object' ? JSON.stringify(fact_value) : String(fact_value),
  fact_schema_version: 'NEED_FACT_V2', status: 'CONFIRMED', source: 'USER', created_at: '2026-11-14T00:55:00Z' }));
const dialogue = (next = 'REVIEW') => ({ next, questionKey: 'NONE', taskRelation: 'CONTINUE', priceUnit: 'UNSPECIFIED', schedulePattern: 'UNSPECIFIED' });
const provider = (text, patch = {}) => ({ assistantMessage: 'Hvala, imam sve potrebne podatke.', safety: 'ALLOW', facts: [],
  dialogue: dialogue(), conversationIntent: { kind: 'CONTINUE', evidence: text }, taxonomyDecisions: [], ...patch });
const fact = (key, value, displayValue, evidence) => ({ key, valueJson: JSON.stringify(value), displayValue, evidence, confidence: 1 });
const runtimeText = request => JSON.stringify(request.contents);

// DEV 9204e07e- shape (anonymized): complete REMOTE task with shipping handoff.
const herbarium = facts([['need.title', 'Kompletna izrada herbarijuma sa dostavom'], ['need.category', 'Izrada herbarijuma'],
  ['need.description', 'Potrebna je kompletna izrada herbarijuma i dostava gotovog rada.'], ['need.people_needed', 1],
  ['need.price_mode', 'OFFERS'], ['need.schedule_kind', 'FLEXIBLE'], ['need.starts_at', '2026-11-14T01:00:00+01:00'],
  ['need.ends_at', '2026-12-01T00:00:00+01:00'], ['need.task_country_code', 'RS'], ['need.task_geography', { mode: 'REMOTE' }],
  ['need.handoff', { required: true, shippingCountries: ['RS'] }]]);

test('DEV 9204e07e-: a ready interview without any decision ends with one concrete service question, never a dead end', async () => {
  const text = 'Pa najbolje ponude.';
  const result = await needHarness(text, provider(text), { activeFacts: herbarium }).run();
  assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify(result.logs));
  assert.equal(result.writes.length, 1);
  const message = result.writes[0].args.p_assistant_message;
  assert.doesNotMatch(message, DEAD_END);
  assert.equal(message, 'Da li je „Izrada herbarijuma“ tačan opis posla koji Vam treba? Ako nije, opišite posao svojim rečima.');
  assert.equal(result.provider.length, 1);
});

test('every turn with a known service and mode asks the model for its decision (request-local runtime reminder)', async () => {
  const text = 'Pa najbolje ponude.';
  const result = await needHarness(text, provider(text), { activeFacts: herbarium }).run();
  const request = result.provider[0].args;
  assert.ok(request.generationConfig.responseSchema.properties.taxonomyDecisions, 'decision schema present');
  assert.match(runtimeText(request), /Usluga ovog zadatka je „Izrada herbarijuma“ \(REMOTE\)\. taxonomyDecisions u ovom odgovoru mora/);
  assert.doesNotMatch(JSON.stringify(request.systemInstruction), /Usluga ovog zadatka je/, 'reminder is not part of the cached stable prefix');
  // DEV e975537c- shape: AREA_BASED is ON_SITE.
  const onSite = facts([['need.category', 'statiranje'], ['need.task_geography', { mode: 'AREA_BASED', start: { city: 'Novi Sad', label: 'Novi Sad' } }]]);
  const second = await needHarness(text, provider(text), { activeFacts: onSite }).run();
  assert.match(runtimeText(second.provider[0].args), /„statiranje“ \(ON_SITE\)/);
});

test('a decision in the ready turn is validated and sent with the first-plan writer (the server can resolve it)', async () => {
  const text = 'Pa najbolje ponude.';
  const output = provider(text, { taxonomyDecisions: [{ service: 'Izrada herbarijuma', mode: 'REMOTE', action: 'CREATE_CHILD',
    categoryId: '', parentId: id(30), proposedPath: ['Izrada herbarijuma'], ambiguityPrompt: '', reason: 'Školski i hobi radovi po porudžbini.' }] });
  const result = await needHarness(text, output, { activeFacts: herbarium,
    catalog: [{ categoryId: id(30), label: 'Školski i kreativni radovi', parentId: null, isLeaf: false, aliases: [], modes: [] },
      { categoryId: id(31), label: 'Izrada maketa', parentId: id(30), isLeaf: true, aliases: [], modes: ['REMOTE', 'ON_SITE'] }] }).run();
  assert.equal(result.writes.length, 1, JSON.stringify(result.logs));
  assert.equal(result.writes[0].name, 'rpc_ai_complete_need_turn_with_first_plan_service');
  const plan = result.writes[0].args.p_taxonomy_plan;
  assert.equal(plan.proposals[0].service, 'Izrada herbarijuma');
  assert.equal(plan.proposals[0].action, 'CREATE_CHILD');
  assert.equal(plan.proposals[0].parentId, id(30));
});

test('DEV 5097976c-: a catalog UUID is never accepted as need.category; the human display label is kept', async () => {
  const text = 'Od sutra pa do kraja godine';
  const uuid = '00000000-0000-4000-8000-000000000103';
  const result = await needHarness(text, provider(text, { assistantMessage: 'Razumeo sam, krečenje stana u Novom Sadu.',
    facts: [fact('need.category', uuid, 'Krečenje i moleraj', 'Krecenje stana je u pitanju')] }), {
    activeFacts: facts([['need.task_geography', { mode: 'STATIONARY', start: { city: 'Novi Sad', area: 'Dositejeva' } }]]),
    catalog: [{ categoryId: uuid, label: 'Krečenje i moleraj', parentId: null, isLeaf: true, aliases: [], modes: ['ON_SITE'] }] }).run();
  assert.equal(result.writes.length, 1, JSON.stringify(result.logs));
  const category = result.writes[0].args.p_proposals.find(item => item.key === 'need.category');
  assert.equal(category.value, 'Krečenje i moleraj');
  assert.ok(!JSON.stringify(result.writes[0].args.p_proposals).includes(uuid));
  // Classification binds the human label (catalog match), not the UUID.
  assert.equal(result.writes[0].args.p_taxonomy_plan?.proposals?.[0]?.service, 'Krečenje i moleraj');
});

test('a technical need.category without a human label is dropped; a stored UUID asks for the work in plain words', async () => {
  const text = 'Da.';
  const uuid = '00000000-0000-4000-8000-000000000103';
  const dropped = await needHarness(text, provider(text, { assistantMessage: 'Zabeleženo.', dialogue: dialogue('ACK'),
    facts: [fact('need.category', uuid, uuid, text), fact('need.people_needed', 1, '1', text)] })).run();
  assert.deepEqual(dropped.writes[0].args.p_proposals.map(item => item.key), ['need.people_needed']);
  for (const technical of ['krecenje_i_moleraj', 'need.category', 'CAT_103']) {
    const result = await needHarness(text, provider(text, { assistantMessage: 'Zabeleženo.', dialogue: dialogue('ACK'),
      facts: [fact('need.category', technical, technical, text)] })).run();
    assert.deepEqual(result.writes[0].args.p_proposals, [], technical);
  }
  // Existing DEV row: the stored fact is already a UUID and the model does not fix it.
  const stored = facts([['need.category', uuid], ['need.task_geography', { mode: 'STATIONARY', start: { city: 'Novi Sad', area: 'Dositejeva' } }]]);
  const result = await needHarness(text, provider(text), { activeFacts: stored }).run();
  assert.match(runtimeText(result.provider[0].args), /need\.category je tehnički identifikator/);
  assert.equal(result.writes[0].args.p_assistant_message, 'Kako biste jednom rečenicom opisali posao koji Vam treba?');
  assert.equal(result.writes[0].name, 'rpc_ai_complete_need_turn_v2_service', 'no plan is built for a technical identifier');
});

test('location (map) turns carry the decision schema and the same first-plan writer path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'supabase/functions/uskoci-ai-interview/index.ts'), 'utf8');
  assert.match(source, /const factSchema = schemaVersion === NEED_FACT_SCHEMA_V2\s*\?\s*\(locationContext \? locationProviderSchema\(v2ProviderSchema\(maxProposals\)\)/);
  assert.match(source, /const responseSchema = singlePass \? withSinglePassTaxonomySchema\(factSchema\) : factSchema;/,
    'the taxonomy schema wraps the location schema too');
  assert.match(source, /if \(singlePassActive && aiTurn\.intentAllowsChanges && \['ALLOW','CLARIFY'\]\.includes\(aiTurn\.safety\)\) \{/,
    'classification is not skipped for location turns');
  assert.match(source, /\(locationContext \? 'rpc_ai_complete_need_location_turn_with_first_plan_service'/);
  assert.match(source, /needClassificationReminder\(/, 'the per-turn reminder is built for map turns as well');
});

// Client: the chat shows one concrete question instead of a silent "not ready".
const readiness = () => sourceLoader({
  'src/data/reviewFactProblem': { reviewFactProblem: () => null },
  'src/lib/location': { normalizeNeedLocation: () => null, pointsMissing: () => ({ total: 0, done: 0 }) },
  'src/ui/v2/draftSummary': { completeDraftProposal: () => true },
})('src/features/ai/intake/intakeReviewReadiness.ts');
const conversation = category => ({ conversationId: CONVERSATION, status: 'OPEN', safety: 'ALLOW', messages: [],
  facts: category === undefined ? [] : [{ id: id(40), key: 'need.category', value: category, status: 'NEEDS_CONFIRMATION' }] });

test('client: a pending classification after a ready interview becomes the one concrete chat question', () => {
  const { taskReviewPreparationMessage } = readiness();
  const pending = { classificationState: 'PENDING_CLASSIFICATION', missingRequired: [] };
  assert.equal(taskReviewPreparationMessage(pending, conversation('Statiranje i pomoć na snimanju')),
    'Da li je „Statiranje i pomoć na snimanju“ tačan opis posla koji Vam treba? Ako nije, opišite posao svojim rečima.');
  assert.equal(taskReviewPreparationMessage(pending, conversation('00000000-0000-4000-8000-000000000103')),
    'Kako biste jednom rečenicom opisali posao koji Vam treba?');
  assert.equal(taskReviewPreparationMessage({ missingRequired: [] }, conversation('Lektura i korektura teksta')),
    'Da li je „Lektura i korektura teksta“ tačan opis posla koji Vam treba? Ako nije, opišite posao svojim rečima.');
  for (const state of ['READY', 'REVIEW_REQUIRED', 'STALE_CATALOG', 'CATALOG_UNAVAILABLE', 'SERVICE_MODE_CONFIRMATION_REQUIRED', 'UNKNOWN_FUTURE']) {
    for (const missingRequired of [[], ['need.price_rsd']]) {
      const message = taskReviewPreparationMessage({ classificationState: state, missingRequired }, conversation('Lektura'));
      assert.ok(message && message.length > 10, state); assert.doesNotMatch(message, DEAD_END, state);
    }
  }
  const nova = fs.readFileSync(path.join(ROOT, 'src/app/(app)/nova.tsx'), 'utf8');
  assert.doesNotMatch(nova, DEAD_END, 'NEED chat never shows the silent not-ready copy');
  assert.match(nova, /taskReviewPreparationMessage\(prepared\.podatak, next\)/);
});

test('client and Edge agree on what is a human service label', () => {
  const client = readiness();
  const edge = sourceLoader({})('supabase/functions/_shared/singlePassTaxonomy.mjs');
  const corpus = ['Izrada herbarijuma', 'statiranje', 'Krečenje i moleraj', 'Časovi francuskog jezika', 'IT podrška', '3D štampa',
    'Лектура текста', '00000000-0000-4000-8000-000000000103', 'Krečenje 00000000-0000-4000-8000-000000000103',
    'krecenje_i_moleraj', 'need.category', 'CAT_103', '12345', 'ab', '', '   ', 'x'.repeat(121), '<b>Lektura</b>', null, 42];
  for (const value of corpus) assert.equal(client.humanServiceLabel(value), edge.humanServiceLabel(value), String(value));
  assert.equal(edge.humanServiceLabel('00000000-0000-4000-8000-000000000103'), null);
  assert.equal(edge.humanServiceLabel(' Izrada herbarijuma '), 'Izrada herbarijuma');
  for (const value of ['Izrada herbarijuma', '00000000-0000-4000-8000-000000000103', ''])
    assert.equal(client.serviceConfirmationQuestion(value), edge.serviceConfirmationQuestion(value));
});
