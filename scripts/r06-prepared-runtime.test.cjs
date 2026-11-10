'use strict';
// Execute the current prepared-input helper and complete Need/Worker handlers.
// Prepare/read/dispatch/reservation use the guarded SQL in PGlite. Auth, claim
// acquisition, model and completion transport are explicit synthetic seams.
// A fresh module graph models loss of isolate memory; this is NOT live DEV,
// native PostgreSQL lock scheduling, real-provider accuracy or Android proof.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
const { fixture, candidate, input, A, C, R, ATT, T, TEXT } = require('./r06-pre-provider-input-fixture.cjs');
const ROOT = path.resolve(__dirname, '..');
const HELPER = 'supabase/functions/_shared/preparedAiInput.ts';
const PURPOSES = ['NEED_SERVICE', 'WORKER_CAPABILITY'];
const IDENTITY = { p_account_id: A, p_conversation_id: C, p_client_request_id: R };
const ORIGIN = 'https://leqcwgzvjsxugfgzdmth.supabase.co';
const COMPILED = new Map();
const clone = value => JSON.parse(JSON.stringify(value));
const table = purpose => purpose === 'NEED_SERVICE' ? 'private.ai_need_turn_commands' : 'private.worker_ai_turns';
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

function loadSource(globals = {}) {
  const modules = new Map();
  const load = relative => {
    const file = ['', '.ts', '.mjs', '.js', '/index.ts'].map(ext => relative + ext)
      .find(name => fs.existsSync(path.join(ROOT, name)) && fs.statSync(path.join(ROOT, name)).isFile());
    assert.ok(file, 'Actual source dependency exists: ' + relative);
    if (modules.has(file)) return modules.get(file).exports;
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8'), key = file + '\0' + source;
    if (!COMPILED.has(key)) {
      const result = ts.transpileModule(source, { fileName: file.endsWith('.mjs') ? file + '.ts' : file,
        reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
      assert.deepEqual((result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error), []);
      COMPILED.set(key, result.outputText);
    }
    const module = { exports: {} }; modules.set(file, module);
    const localRequire = name => {
      assert.ok(name.startsWith('.'), 'No unreviewed external dependency: ' + name);
      return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), name)));
    };
    new Function('require', 'module', 'exports', ...Object.keys(globals), COMPILED.get(key))
      (localRequire, module, module.exports, ...Object.values(globals));
    return module.exports;
  };
  return load;
}

async function sourceContext(f, purpose) {
  return purpose === 'NEED_SERVICE'
    ? f.value("select private.ai_need_turn_context($1)->'context' as value", [C])
    : f.value('select public.rpc_read_worker_ai_context_service($1,$2) as value', [A, C]);
}

async function preparedInput(f, purpose) {
  const value = input(purpose), context = await sourceContext(f, purpose);
  value.runtime = purpose === 'NEED_SERVICE'
    ? { schemaVersion: 'R06_NEED_RUNTIME_V1', sourceContext: context, singlePassActive: false,
      pendingClarificationHint: null, timeContext: { now: '2026-11-09T00:00:00Z' }, needsTree: false, maxProposals: 12 }
    : { schemaVersion: 'R06_WORKER_RUNTIME_V1', sourceContext: context, singlePassActive: false, pendingWorkerClarificationHint: null };
  return value;
}

function sqlRpc(f, calls = [], fault = {}) {
  let lostPrepare = false;
  return async (name, args) => {
    calls.push({ name, args: clone(args) });
    if (name === 'rpc_ai_read_prepared_input_service' && lostPrepare && fault.blockReadAfterPrepare)
      throw new Error('SYNTHETIC_PROCESS_LOST');
    let data;
    try {
      const ids = [args.p_account_id, args.p_conversation_id, args.p_client_request_id];
      if (name === 'rpc_ai_prepare_input_service') data = await f.value('select public.rpc_ai_prepare_input_service($1,$2,$3,$4,$5,$6) as value',
        [...ids, args.p_attempt_id, args.p_purpose, args.p_input]);
      else if (name === 'rpc_ai_read_prepared_input_service') data = await f.value('select public.rpc_ai_read_prepared_input_service($1,$2,$3,$4) as value', [...ids, args.p_purpose]);
      else if (name === 'rpc_ai_dispatch_prepared_input_service') data = await f.value('select public.rpc_ai_dispatch_prepared_input_service($1,$2,$3,$4,$5,$6) as value',
        [...ids, args.p_attempt_id, args.p_purpose, args.p_input_sha256]);
      else throw new Error('UNEXPECTED_SQL_RPC:' + name);
    } catch (error) {
      return { ok: false, status: 409, data: { code: error.code ?? 'SQL_ERROR', message: error.message } };
    }
    if (name === 'rpc_ai_prepare_input_service' && fault.losePrepareAck) {
      lostPrepare = true; throw new Error('SYNTHETIC_PREPARE_ACK_LOST');
    }
    if (name === 'rpc_ai_dispatch_prepared_input_service' && fault.loseDispatchAck)
      throw new Error('SYNTHETIC_DISPATCH_ACK_LOST');
    return { ok: true, status: 200, data };
  };
}

const optionsFor = (rpc, purpose, overrides = {}) => ({ rpc, identity: IDENTITY, purpose, userText: TEXT, ...overrides });
async function assertSingleReservation(f) {
  assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'), 1);
  assert.equal(await f.value('select reserved_microusd::int as value from private.ai_test_budget_v5'), 250000);
}

test('R06 prepared helper uses actual SQL for owned immutable recovery and one provider permission', async t => {
  const f = await fixture();
  try {
    await f.db.exec(candidate);
    await t.test('rollout requires the exact true value; absent/false do not activate', () => {
      const helper = loadSource()(HELPER);
      for (const value of [undefined, 'false', '', 'TRUE', '1']) assert.equal(helper.preparedAiInputEnabled(() => value), false);
      assert.equal(helper.preparedAiInputEnabled(() => 'true'), true);
    });
    for (const purpose of PURPOSES) {
      await t.test(`${purpose}: committed prepare with lost ACK recovers via one read and one reservation`, async () => {
        await f.seed(purpose);
        const calls = [], rpc = sqlRpc(f, calls, { losePrepareAck: true });
        const helper = loadSource()(HELPER), data = await preparedInput(f, purpose);
        const prepared = await helper.prepareAiInput({ ...optionsFor(rpc, purpose), attemptId: ATT, input: data });
        assert.equal(prepared.state, 'PREPARED'); assert.deepEqual(prepared.snapshot.input, data);
        assert.deepEqual(calls.map(c => c.name), ['rpc_ai_prepare_input_service', 'rpc_ai_read_prepared_input_service']);
        await assertSingleReservation(f);
      });
      await t.test(`${purpose}: new module recovers durable snapshot after prepare and read response loss`, async () => {
        await f.seed(purpose);
        const first = loadSource()(HELPER), rpc = sqlRpc(f, [], { losePrepareAck: true, blockReadAfterPrepare: true });
        const data = await preparedInput(f, purpose);
        await assert.rejects(first.prepareAiInput({ ...optionsFor(rpc, purpose), attemptId: ATT, input: data }), /SYNTHETIC_PROCESS_LOST/);
        const next = loadSource()(HELPER), recovered = await next.readPreparedInput(optionsFor(sqlRpc(f), purpose));
        assert.deepEqual(recovered.snapshot.input, data);
        const permission = await next.dispatchPreparedInput({ ...optionsFor(sqlRpc(f), purpose), prepared: recovered });
        assert.equal(permission.dispatched, true);
        assert.deepEqual(await loadSource()(HELPER).readPreparedInput(optionsFor(sqlRpc(f), purpose)), { state: 'READ_ONLY' });
        await assertSingleReservation(f);
      });
      await t.test(`${purpose}: lost dispatch ACK never grants retry permission or another reservation`, async () => {
        await f.seed(purpose);
        const helper = loadSource()(HELPER), rpc = sqlRpc(f), opts = optionsFor(rpc, purpose);
        const prepared = await helper.prepareAiInput({ ...opts, attemptId: ATT, input: await preparedInput(f, purpose) });
        await assert.rejects(helper.dispatchPreparedInput({ ...opts, rpc: sqlRpc(f, [], { loseDispatchAck: true }), prepared }), /ACK_LOST/);
        assert.deepEqual(await loadSource()(HELPER).readPreparedInput(optionsFor(sqlRpc(f), purpose)), { state: 'READ_ONLY' });
        assert.deepEqual(await helper.dispatchPreparedInput({ ...opts, prepared }), { state: 'READ_ONLY', dispatched: false });
        await assertSingleReservation(f);
      });
      await t.test(`${purpose}: changed text, account, attempt, model and source revision cannot replace the original`, async () => {
        await f.seed(purpose);
        const helper = loadSource()(HELPER), opts = optionsFor(sqlRpc(f), purpose), data = await preparedInput(f, purpose);
        await helper.prepareAiInput({ ...opts, attemptId: ATT, input: data });
        await assert.rejects(helper.readPreparedInput({ ...opts, userText: TEXT + ' altered' }), /SNAPSHOT_INVALID/);
        await assert.rejects(helper.readPreparedInput({ ...opts, identity: { ...IDENTITY, p_account_id: T } }), /READ_UNCONFIRMED/);
        await assert.rejects(helper.prepareAiInput({ ...opts, attemptId: T, input: data }), /PREPARE_REFUSED/);
        await assert.rejects(helper.prepareAiInput({ ...opts, attemptId: ATT, input: { ...data, model: 'unapproved-model' } }), /INPUT_INVALID/);
        const changed = clone(data); changed.runtime.sourceContext.extraUnownedFact = 'untrusted';
        await assert.rejects(helper.prepareAiInput({ ...opts, attemptId: ATT, input: changed }), /PREPARE_REFUSED/);
        await f.db.exec(purpose === 'NEED_SERVICE'
          ? `update ${table(purpose)} set context_hash=repeat('0',64)`
          : 'update private.worker_ai_sessions set revision=revision+1');
        assert.deepEqual(await helper.readPreparedInput(opts), { state: 'STALE' });
        await assertSingleReservation(f);
      });
      await t.test(`${purpose}: refreshed budget refusal still blocks dispatch after successful prepare`, async () => {
        await f.seed(purpose);
        const helper = loadSource()(HELPER), opts = optionsFor(sqlRpc(f), purpose);
        const prepared = await helper.prepareAiInput({ ...opts, attemptId: ATT, input: await preparedInput(f, purpose) });
        await f.db.exec('update private.ai_test_budget_v5 set enabled=false');
        assert.deepEqual(await helper.dispatchPreparedInput({ ...opts, prepared }), { state: 'NOT_ADMITTED', dispatched: false });
        assert.equal(await f.value(`select provider_dispatched as value from ${table(purpose)}`), false);
        await assertSingleReservation(f);
      });
    }
  } finally { await f.db.close(); }
});

function turn(purpose, state = 'PROCESSING') {
  return purpose === 'NEED_SERVICE'
    ? { conversationId: C, clientRequestId: R, state, turnId: T, retryAllowed: false,
      receipt: state === 'SUCCEEDED' ? { userMessageId: T, assistantMessageId: ATT, proposedCount: 0,
        safety: 'ALLOW', schemaVersion: 'NEED_FACT_V2', authoritative: true } : null }
    : { turnId: T, conversationId: C, clientRequestId: R, attemptId: ATT, state, retryAllowed: false, authoritative: true };
}
function providerOutput(purpose) {
  const intent = { kind: 'UNCLEAR', evidence: TEXT };
  return purpose === 'NEED_SERVICE'
    ? { assistantMessage: 'Možete li pojasniti šta Vam je potrebno?', safety: 'ALLOW', facts: [], conversationIntent: intent,
      dialogue: { next: 'ANSWER', questionKey: 'NONE', taskRelation: 'CONTINUE', priceUnit: 'UNSPECIFIED', schedulePattern: 'UNSPECIFIED' } }
    : { assistantMessage: 'Možete li pojasniti koju uslugu nudite?', safety: 'ALLOW', patch: { availability: null },
      availabilityChange: { kind: 'NONE', scope: 'NONE', evidence: '' }, serviceChanges: [], conversationIntent: intent };
}

async function handlerHarness(f, purpose, options = {}) {
  const calls = [], logs = [], handlers = [], background = [];
  const sql = sqlRpc(f, [], options);
  const env = { SUPABASE_URL: ORIGIN, SUPABASE_ANON_KEY: 'public-fixture', SUPABASE_SERVICE_ROLE_KEY: 'server-fixture',
    GEMINI_API_KEY: 'provider-fixture', GEMINI_MODEL: 'gemini-3.8-flash', AI_PROVIDER: 'gemini',
    USKOCI_GEMINI_PAID_TEST_ENABLED: 'true', USKOCI_TAXONOMY_DUAL_GEMINI: 'true', USKOCI_TAXONOMY_ROLLOUT_SCOPE: 'DEV',
    USKOCI_TAXONOMY_ALLOWED_PROJECT_REF: 'leqcwgzvjsxugfgzdmth',
    ...(options.enabled === false ? {} : { USKOCI_AI_PREPARED_INPUT_ENABLED: 'true' }), ...options.env };
  const fetchMock = async (raw, init = {}) => {
    const url = new URL(raw), name = url.pathname.split('/').at(-1);
    const args = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ name, args, origin: url.origin });
    if (url.origin === 'https://generativelanguage.googleapis.com') {
      assert.match(name, /:streamGenerateContent$/);
      if (options.loseProviderResponse) throw new Error('SYNTHETIC_PROVIDER_RESPONSE_LOST');
      const output = providerOutput(purpose);
      const data = { candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 30, totalTokenCount: 130 } };
      return new Response('data: ' + JSON.stringify(data) + '\n\n', { headers: { 'content-type': 'text/event-stream' } });
    }
    assert.equal(url.origin, ORIGIN, 'No external network request escapes this fixture');
    if (url.pathname === '/auth/v1/user') return json({ id: options.account ?? A });
    if (url.pathname === '/rest/v1/ai_conversations') return json([{ id: C, account_id: options.account ?? A, fact_schema_version: 'NEED_FACT_V2', status: 'OPEN' }]);
    if (name === 'rpc_ai_claim_need_turn_v2_service' || name === 'rpc_claim_worker_ai_turn_service') {
      if ((args.p_user_message ?? args.p_text) !== TEXT) return json({ message: 'AI_REQUEST_ID_REUSED' }, 409);
      const command = await f.value(`select to_jsonb(t) as value from ${table(purpose)} t`);
      const acquired = !command.prepared_at && !command.provider_dispatched;
      const currentTurn = turn(purpose, command.state);
      if (purpose === 'WORKER_CAPABILITY') return json({ acquired, turn: currentTurn });
      return json({ turn: currentTurn, claim: acquired ? { attemptId: ATT, leaseExpiresAt: command.lease_expires_at,
        context: await sourceContext(f, purpose) } : null });
    }
    if (name.startsWith('rpc_ai_') && /(?:prepare_input|read_prepared_input|dispatch_prepared_input)_service$/.test(name)) {
      if (options.missingPreparedRpc) return json({ code: 'PGRST202', message: 'Synthetic missing prepared RPC' }, 404);
      const result = await sql(name, args); return json(result.data, result.status);
    }
    if (name === 'rpc_read_worker_ai_context_service') return json(await sourceContext(f, purpose));
    if (name === 'rpc_taxonomy_fetch_snapshot_v1') {
      const categories = [{ categoryId: T, label: options.catalogLabel ?? 'Lektura tekstova', parentId: null,
        isLeaf: true, aliases: [], modes: ['REMOTE'] }];
      return json({ catalogVersion: options.catalogVersion ?? 1, catalogFingerprint: 'a'.repeat(32), count: 1, categories });
    }
    if (name === 'rpc_ai_test_budget_reserve_service') return json(await f.value('select public.rpc_ai_test_budget_reserve_service($1,$2,$3,$4) as value',
      [args.p_account_id, args.p_operation_id, args.p_kind, args.p_max_cost_microusd]));
    if (name === 'rpc_ai_dispatch_need_turn_v2_service') return json(await f.dispatch(purpose));
    if (name === 'rpc_dispatch_worker_ai_turn_service') {
      const value = await f.dispatch(purpose); return json({ dispatched: value.dispatched, turn: turn(purpose) });
    }
    if (name === 'rpc_ai_test_record_usage_service') return json(true);
    if (name === 'rpc_ai_fail_need_turn_v2_service' || name === 'rpc_fail_worker_ai_turn_service') {
      await f.db.exec(`update ${table(purpose)} set state='FAILED'`); return json(true);
    }
    if (/^rpc_(?:ai_)?complete_(?:need|worker)_/.test(name)) {
      const completed = turn(purpose, 'SUCCEEDED');
      if (purpose === 'NEED_SERVICE') completed.receipt.safety = args.p_safety;
      if (purpose === 'NEED_SERVICE') await f.db.query(`update ${table(purpose)} set state='SUCCEEDED',receipt=$1`, [completed.receipt]);
      else await f.db.exec(`update ${table(purpose)} set state='SUCCEEDED'`);
      return json(name.includes('first_plan') ? { completion: completed,
        firstPlan: { state: 'RESOLVED', authority: 'CATALOG_ONLY', applicability: 'NOT_EVALUATED' } } : completed);
    }
    throw new Error('Unexpected transport seam: ' + name);
  };
  const ActualDate = Date, offset = options.clockOffsetMs ?? 0;
  class FixtureDate extends ActualDate {
    constructor(...args) { super(...(args.length ? args : [ActualDate.now() + offset])); }
    static now() { return ActualDate.now() + offset; }
  }
  const loader = loadSource({ Deno: { env: { get: name => env[name] }, serve: handler => handlers.push(handler) },
    fetch: fetchMock, Date: FixtureDate, crypto: webcrypto, EdgeRuntime: { waitUntil: promise => background.push(promise) },
    console: Object.fromEntries(['log', 'warn', 'error', 'info'].map(name => [name, (...args) => logs.push(args)])) });
  loader(purpose === 'NEED_SERVICE' ? 'supabase/functions/uskoci-ai-interview/index.ts' : 'supabase/functions/uskoci-worker-interview/index.ts');
  assert.equal(handlers.length, 1);
  return { calls, logs, async run(text = TEXT, requestOptions = {}) {
    const response = await handlers[0](new Request(ORIGIN + '/functions/v1/fixture', { method: 'POST',
      headers: { authorization: 'Bearer synthetic-test-token', 'content-type': 'application/json',
        accept: options.stream === false ? 'application/json' : 'text/event-stream', 'x-uskoci-interview-intent': 'v1' },
      body: JSON.stringify(requestOptions.mode
        ? { mode: requestOptions.mode, conversationId: C, clientRequestId: R, ...requestOptions.extra }
        : { conversationId: C, clientRequestId: R, text }) }));
    const raw = await response.text(); await Promise.allSettled(background);
    const events = response.headers.get('content-type')?.includes('text/event-stream')
      ? raw.split('\n\n').filter(Boolean).map(part => JSON.parse(part.slice(6))) : [];
    return { status: response.status, events, json: events.length ? null : JSON.parse(raw), calls, logs };
  } };
}

const providers = result => result.calls.filter(c => /:streamGenerateContent$/.test(c.name));
const assertFinal = result => assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ status: result.status,
  events: result.events, json: result.json, calls: result.calls.map(c => c.name), logs: result.logs }));

test('R06 actual Need and Worker handlers reconnect a durable text turn without rebuilding or repeating the model call', async t => {
  const f = await fixture();
  try {
    await f.db.exec(candidate);
    // The existing SQL fixture intentionally has a minimal service-mode seam.
    // Supply its complete current wire shape for the real Worker decoder; the
    // actual read-context, prepared owner checks and dispatch remain unchanged.
    await f.db.exec(`create or replace function private.worker_ai_service_mode_context_v1(p_account_id uuid,p_conversation_id uuid)
      returns jsonb language sql stable security definer set search_path=pg_catalog as $$
      select jsonb_build_object('schemaVersion','WORKER_SERVICE_MODE_CONTEXT_V1','revision',s.revision,
        'savedServices','[]'::jsonb,'draftServices','[]'::jsonb,'unresolvedServices','[]'::jsonb)
      from private.worker_ai_sessions s where s.account_id=p_account_id and s.conversation_id=p_conversation_id $$;`);
    for (const purpose of PURPOSES) {
      if (purpose === 'NEED_SERVICE') await t.test('NEED_SERVICE: known missing provider key before preparation retires the owned attempt', async () => {
        await f.seed(purpose);
        const result = await (await handlerHarness(f, purpose, { stream: false, env: { GEMINI_API_KEY: '' } })).run();
        assert.equal(result.status, 503);
        assert.equal(providers(result).length, 0);
        assert.equal(result.calls.some(c => /prepare_input_service|budget_reserve/.test(c.name)), false);
        assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'), 0);
        assert.equal(result.calls.filter(c => c.name === 'rpc_ai_fail_need_turn_v2_service').length, 1);
        assert.equal(await f.value(`select state as value from ${table(purpose)}`), 'FAILED');
      });
      await t.test(`${purpose}: default-off keeps the existing budget and dispatch path`, async () => {
        await f.seed(purpose);
        const result = await (await handlerHarness(f, purpose, { enabled: false })).run();
        assertFinal(result); assert.equal(providers(result).length, 1);
        assert.equal(result.calls.filter(c => c.name === 'rpc_ai_test_budget_reserve_service').length, 1);
        assert.equal(result.calls.some(c => /prepared_input|prepare_input/.test(c.name)), false);
        await assertSingleReservation(f);
      });
      await t.test(`${purpose}: durable path writes exact provider input before the only model request`, async () => {
        await f.seed(purpose);
        const result = await (await handlerHarness(f, purpose)).run();
        assertFinal(result); assert.equal(providers(result).length, 1);
        const preparation = result.calls.find(c => c.name === 'rpc_ai_prepare_input_service');
        assert.ok(preparation);
        assert.deepEqual(providers(result)[0].args, preparation.args.p_input.providerRequest);
        assert.ok(result.calls.indexOf(preparation) < result.calls.indexOf(providers(result)[0]));
        assert.equal(result.calls.filter(c => c.name === 'rpc_ai_dispatch_prepared_input_service').length, 1);
        assert.equal(result.calls.some(c => c.name === 'rpc_ai_test_budget_reserve_service'), false);
        await assertSingleReservation(f);
      });
      await t.test(`${purpose}: fresh handler resumes after prepare ACK loss using frozen prompt/catalog/time`, async () => {
        await f.seed(purpose);
        const first = await (await handlerHarness(f, purpose, { losePrepareAck: true, blockReadAfterPrepare: true })).run();
        assert.equal(providers(first).length, 0);
        const preparation = first.calls.find(c => c.name === 'rpc_ai_prepare_input_service'); assert.ok(preparation);
        assert.equal(await f.value(`select state as value from ${table(purpose)}`), 'PROCESSING');
        const resumed = await (await handlerHarness(f, purpose, { catalogLabel: 'NEW CATALOG MUST NOT REPLACE SNAPSHOT', catalogVersion: 99, clockOffsetMs: 1000 })).run();
        assertFinal(resumed); assert.equal(providers(resumed).length, 1);
        assert.deepEqual(providers(resumed)[0].args, preparation.args.p_input.providerRequest);
        assert.equal(resumed.calls.some(c => /fetch_snapshot|query_catalog|prepare_input_service|budget_reserve/.test(c.name)), false);
        const again = await (await handlerHarness(f, purpose)).run();
        assert.equal(providers(again).length, 0); await assertSingleReservation(f);
      });
      await t.test(`${purpose}: lost dispatch ACK stays read-only on a fresh invocation`, async () => {
        await f.seed(purpose);
        const first = await (await handlerHarness(f, purpose, { loseDispatchAck: true })).run();
        assert.equal(providers(first).length, 0);
        assert.equal(await f.value(`select provider_dispatched as value from ${table(purpose)}`), true);
        const next = await (await handlerHarness(f, purpose)).run();
        assert.equal(providers(next).length, 0);
        assert.equal(next.calls.some(c => /dispatch|budget_reserve|prepare_input_service/.test(c.name)), false);
        await assertSingleReservation(f);
      });
      await t.test(`${purpose}: missing prepared RPC never falls back to old reservation or provider dispatch`, async () => {
        await f.seed(purpose);
        const result = await (await handlerHarness(f, purpose, { missingPreparedRpc: true })).run();
        assert.equal(providers(result).length, 0);
        assert.equal(result.calls.some(c => /budget_reserve|dispatch_(?:need|worker)_ai|dispatch_need_turn/.test(c.name)), false);
        assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'), 0);
      });
      await t.test(`${purpose}: uncertain provider response keeps the original dispatch and cannot repeat a paid attempt`, async () => {
        await f.seed(purpose);
        const first = await (await handlerHarness(f, purpose, { loseProviderResponse: true })).run();
        assert.equal(providers(first).length, 1);
        assert.notEqual(first.events.at(-1)?.kind, 'final');
        const next = await (await handlerHarness(f, purpose)).run();
        assert.equal(providers(next).length, 0);
        assert.equal(await f.value(`select provider_dispatched as value from ${table(purpose)}`), true);
        await assertSingleReservation(f);
      });
      await t.test(`${purpose}: two freshly loaded handlers receive at most one SQL dispatch permission`, async () => {
        await f.seed(purpose);
        const [a, b] = await Promise.all([handlerHarness(f, purpose), handlerHarness(f, purpose)]);
        const results = await Promise.all([a.run(), b.run()]);
        assert.equal(results.reduce((sum, result) => sum + providers(result).length, 0), 1);
        assert.ok(results.some(result => result.events.at(-1)?.kind === 'final'));
        await assertSingleReservation(f);
      });
      await t.test(`${purpose}: journal IDs alone can check and resume a prepared input without another claim or reservation`, async () => {
        await f.seed(purpose);
        const first = await (await handlerHarness(f, purpose, { losePrepareAck: true, blockReadAfterPrepare: true })).run();
        assert.equal(providers(first).length, 0);
        const frozen = first.calls.find(c => c.name === 'rpc_ai_prepare_input_service').args.p_input;
        const before = await f.value(`select to_jsonb(t) as value from ${table(purpose)} t`);
        const live = await handlerHarness(f, purpose, { catalogVersion: 99, clockOffsetMs: 1000 });
        const checked = await live.run(undefined, { mode: 'CHECK_PREPARED' });
        assert.deepEqual(checked.json, { schemaVersion: 'AI_PREPARED_RECOVERY_V1', conversationId: C,
          clientRequestId: R, state: 'PREPARED', canResume: true, authoritative: true });
        assert.equal(checked.events.length, 0);
        assert.deepEqual(await f.value(`select to_jsonb(t) as value from ${table(purpose)} t`), before, 'CHECK cannot mutate the command');
        assert.equal(checked.calls.some(c => /claim|dispatch|complete|budget|prepare_input_service/.test(c.name)), false);
        for (let index = 0; index < 7; index++) {
          const repeatedCheck = await live.run(undefined, { mode: 'CHECK_PREPARED' });
          assert.equal(repeatedCheck.status, 200, 'Read-only checks do not consume the inference rate window');
          assert.equal(repeatedCheck.json.canResume, true);
        }
        const resumed = await live.run(undefined, { mode: 'RESUME_PREPARED' });
        assertFinal(resumed); assert.equal(providers(resumed).length, 1);
        assert.deepEqual(providers(resumed)[0].args, frozen.providerRequest);
        assert.equal(resumed.calls.some(c => /claim|fetch_snapshot|query_catalog|prepare_input_service|budget_reserve|read_worker_ai_context/.test(c.name)), false);
        assert.equal(resumed.events.some(event => Object.hasOwn(event, 'conversationIntent')), false, 'ID-only recovery cannot manufacture a client-verifiable handoff');
        const completedCheck = await (await handlerHarness(f, purpose)).run(undefined, { mode: 'CHECK_PREPARED' });
        assert.equal(completedCheck.json.canResume, false); assert.equal(completedCheck.json.state, 'READ_ONLY');
        const repeated = await (await handlerHarness(f, purpose)).run(undefined, { mode: 'RESUME_PREPARED' });
        assert.equal(repeated.status, 409); assert.equal(providers(repeated).length, 0);
        await assertSingleReservation(f);
      });
      await t.test(`${purpose}: disabled, absent or unavailable prepared recovery never creates a command or paid request`, async () => {
        for (const options of [{ enabled: false }, {}, { missingPreparedRpc: true }, { env: { GEMINI_API_KEY: '' } }]) {
          await f.seed(purpose);
          const before = await f.value(`select to_jsonb(t) as value from ${table(purpose)} t`);
          const checked = await (await handlerHarness(f, purpose, options)).run(undefined, { mode: 'CHECK_PREPARED' });
          if (options.missingPreparedRpc) assert.equal(checked.status, 409);
          else assert.equal(checked.json.canResume, false);
          const resumed = await (await handlerHarness(f, purpose, options)).run(undefined, { mode: 'RESUME_PREPARED' });
          assert.equal(resumed.status, 409);
          for (const result of [checked, resumed]) {
            assert.equal(providers(result).length, 0);
            assert.equal(result.calls.some(c => /claim|dispatch|complete|budget|prepare_input_service/.test(c.name)), false);
          }
          assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'), 0);
          assert.deepEqual(await f.value(`select to_jsonb(t) as value from ${table(purpose)} t`), before);
        }
      });
      await t.test(`${purpose}: ID-only recovery rejects foreign ownership, closed/stale/expired/erased snapshots and text substitution`, async () => {
        const cases = [
          { options: { account: T } },
          { sql: `update ${table(purpose)} set state='FAILED',cancelled_at=clock_timestamp()` },
          { sql: `update ${table(purpose)} set lease_expires_at=clock_timestamp()-interval '1 second'` },
          { sql: `update ${table(purpose)} set prepared_input=null,prepared_input_sha256=null` },
          { sql: purpose === 'NEED_SERVICE' ? `update ${table(purpose)} set context_hash=repeat('0',64)` : 'update private.worker_ai_sessions set revision=revision+1' },
        ];
        for (const invalid of cases) {
          await f.seed(purpose);
          await (await handlerHarness(f, purpose, { losePrepareAck: true, blockReadAfterPrepare: true })).run();
          if (invalid.sql) await f.db.exec(invalid.sql);
          const checked = await (await handlerHarness(f, purpose, invalid.options)).run(undefined, { mode: 'CHECK_PREPARED' });
          assert.ok(checked.status === 409 || checked.json.canResume === false);
          const resumed = await (await handlerHarness(f, purpose, invalid.options)).run(undefined, { mode: 'RESUME_PREPARED' });
          assert.equal(resumed.status, 409); assert.equal(providers(resumed).length, 0);
          assert.equal(resumed.calls.some(c => /claim|dispatch|budget|prepare_input_service/.test(c.name)), false);
          await assertSingleReservation(f);
        }
        await f.seed(purpose);
        for (const mode of ['CHECK_PREPARED', 'RESUME_PREPARED']) {
          const invalid = await (await handlerHarness(f, purpose)).run(undefined, { mode, extra: { text: 'Substitute text is forbidden' } });
          assert.equal(invalid.status, 400); assert.equal(invalid.calls.length, 0);
        }
      });
      await t.test(`${purpose}: a lost identifier-only dispatch acknowledgement stays read-only after restart`, async () => {
        await f.seed(purpose);
        await (await handlerHarness(f, purpose, { losePrepareAck: true, blockReadAfterPrepare: true })).run();
        const lost = await (await handlerHarness(f, purpose, { loseDispatchAck: true })).run(undefined, { mode: 'RESUME_PREPARED' });
        assert.equal(providers(lost).length, 0);
        assert.equal(await f.value(`select provider_dispatched as value from ${table(purpose)}`), true);
        const checked = await (await handlerHarness(f, purpose)).run(undefined, { mode: 'CHECK_PREPARED' });
        assert.equal(checked.json.state, 'READ_ONLY'); assert.equal(checked.json.canResume, false);
        const retry = await (await handlerHarness(f, purpose)).run(undefined, { mode: 'RESUME_PREPARED' });
        assert.equal(retry.status, 409); assert.equal(providers(retry).length, 0);
        await assertSingleReservation(f);
      });
      await t.test(`${purpose}: concurrent identifier-only resumes and revoked admission cannot bypass the dispatch owner`, async () => {
        await f.seed(purpose);
        await (await handlerHarness(f, purpose, { losePrepareAck: true, blockReadAfterPrepare: true })).run();
        const pair = await Promise.all([handlerHarness(f, purpose), handlerHarness(f, purpose)]);
        const results = await Promise.all(pair.map(h => h.run(undefined, { mode: 'RESUME_PREPARED' })));
        assert.equal(results.reduce((sum, result) => sum + providers(result).length, 0), 1);
        assert.equal(results.filter(result => result.events.at(-1)?.kind === 'final').length, 1);
        await assertSingleReservation(f);
        await f.seed(purpose);
        await (await handlerHarness(f, purpose, { losePrepareAck: true, blockReadAfterPrepare: true })).run();
        const checked = await (await handlerHarness(f, purpose)).run(undefined, { mode: 'CHECK_PREPARED' });
        assert.equal(checked.json.canResume, true);
        await f.db.exec('update private.ai_test_budget_v5 set enabled=false');
        const refused = await (await handlerHarness(f, purpose)).run(undefined, { mode: 'RESUME_PREPARED' });
        assert.equal(providers(refused).length, 0); assert.notEqual(refused.events.at(-1)?.kind, 'final');
        assert.equal(await f.value(`select provider_dispatched as value from ${table(purpose)}`), false);
        await assertSingleReservation(f);
      });
    }
  } finally { await f.db.close(); }
});
