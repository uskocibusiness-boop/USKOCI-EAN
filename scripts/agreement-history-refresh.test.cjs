'use strict';
// Execute the actual model, history decoders and owned receipt fence. Only the
// RPC transport, current session and optional clock are fixtures. These tests
// measure client RPC counts, not hosted latency or Android rendering.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const MODEL = 'src/data/agreementHistoryModel.ts';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ACCOUNT = id(90001), OTHER = id(90002), AGREEMENT = id(90003);
const instant = n => `2026-11-08T00:00:00.${String(n).padStart(6, '0')}Z`;
const cursor = row => ({ createdAt: row.createdAt, messageId: row.messageId });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const compiled = new Map();

function row(n, voice = false) {
  return { messageId: id(n), agreementVersion: 1, senderAccountId: OTHER,
    clientMessageId: `fixture-message-${n}`, body: `Poruka ${n}`, createdAt: instant(n),
    kind: 'TEXT', mine: false, photos: [], ...(voice ? { voice: null } : {}) };
}
function harness(count = 50, { voice = false, position = { following: true }, fakeClock = false } = {}) {
  const session = { user: { id: ACCOUNT }, accountRevision: 1 };
  const account = { accountId: ACCOUNT, accountRevision: 1 };
  const state = { rows: Array.from({ length: count }, (_, i) => row(i + 1, voice)), position, current: true, override: null };
  const calls = [], cache = new Map(), timers = new Map();
  let statement = 0, clock = 0, timerId = 0;
  const globals = fakeClock ? {
    setTimeout: (fn, ms) => { const key = ++timerId; timers.set(key, { due: clock + ms, fn }); return key; },
    clearTimeout: key => timers.delete(key),
  } : {};
  const stubs = {
    'src/store/sesija.ts': { sesijaSada: () => session },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => { throw Error('UNEXPECTED_UNSCOPED_TRANSPORT'); } },
    'src/lib/vreme.ts': { vreme: value => value },
  };
  function load(name) {
    const filename = ['', '.ts', '.tsx', '.mjs', '/index.ts'].map(ext => path.join(ROOT, name + ext))
      .find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    assert.ok(filename, name);
    name = path.relative(ROOT, filename).replaceAll(path.sep, '/');
    if (stubs[name]) return stubs[name];
    if (cache.has(name)) return cache.get(name).exports;
    const source = name === MODEL && process.env.USKOCI_HISTORY_PREIMAGE
      ? execFileSync('git', ['show', `${process.env.USKOCI_HISTORY_PREIMAGE}:${name}`], { cwd: ROOT, encoding: 'utf8' })
      : fs.readFileSync(filename, 'utf8');
    const key = name + '\0' + source;
    if (!compiled.has(key)) {
      const result = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
      assert.deepEqual((result.diagnostics ?? []).filter(value => value.category === ts.DiagnosticCategory.Error), []);
      compiled.set(key, result.outputText);
    }
    const module = { exports: {} }; cache.set(name, module);
    new Function('require', 'module', 'exports', ...Object.keys(globals), compiled.get(key))(
      request => request.startsWith('.') ? load(path.relative(ROOT, path.resolve(path.dirname(filename), request)).replaceAll(path.sep, '/'))
        : require(request), module, module.exports, ...Object.values(globals));
    return module.exports;
  }
  const history = load('src/data/agreementMessageHistoryService.ts');
  function response(name, args, rows = state.rows, asOf = instant(500000 + ++statement)) {
    const envelope = { accountId: ACCOUNT, agreementId: AGREEMENT, asOf, authoritative: true };
    if (name.includes('messages_page')) {
      const eligible = args.p_before_id === null ? rows : rows.filter(item => history.compareAgreementMessageCursors(cursor(item),
        { createdAt: args.p_before_created_at, messageId: args.p_before_id }) < 0);
      const messages = eligible.slice(-args.p_limit);
      return { data: { ...envelope, schema: `AGREEMENT_MESSAGES_PAGE_V${voice ? 2 : 1}`, messages,
        olderCursor: eligible.length > messages.length ? cursor(messages[0]) : null }, error: null };
    }
    assert.match(name, /^rpc_read_agreement_message_window_v[12]$/);
    const target = rows.findIndex(item => item.messageId === args.p_target_message_id);
    if (target < 0) return { data: null, error: { message: 'CHAT_MESSAGE_NOT_AVAILABLE' } };
    const start = Math.max(0, target - args.p_before_count), end = Math.min(rows.length, target + args.p_after_count + 1);
    const messages = rows.slice(start, end);
    return { data: { ...envelope, schema: `AGREEMENT_MESSAGE_WINDOW_V${voice ? 2 : 1}`,
      targetMessageId: args.p_target_message_id, messages,
      beforeCursor: start ? cursor(messages[0]) : null, afterCursor: end < rows.length ? cursor(messages.at(-1)) : null }, error: null };
  }
  const port = history.createAgreementMessageHistoryService(async (name, args, signal) => {
    assert.equal(args.p_expected_user_id, ACCOUNT); assert.equal(args.p_agreement_id, AGREEMENT);
    assert.match(name, /^rpc_read_agreement_messages?_.*_v[12]$/);
    const call = { name, args, signal, result: structuredClone(response(name, args)) }; calls.push(call);
    return state.override ? state.override(call) : call.result;
  }, { voice });
  const model = load(MODEL).createAgreementHistoryModel({ account, agreementId: AGREEMENT, port,
    isCurrent: () => state.current && session.user?.id === ACCOUNT && session.accountRevision === account.accountRevision,
    position: () => state.position });
  return { model, calls, state, session, response, timers,
    numbers: () => model.snapshot().data?.map(item => Number(item.id.slice(-12))),
    append(from, through) { for (let n = from; n <= through; n++) state.rows.push(row(n, voice)); },
    resetCalls() { calls.length = 0; },
    advance(ms) {
      clock += ms;
      for (const [key, timer] of [...timers]) if (timer.due <= clock && timers.delete(key)) timer.fn();
    },
  };
}
const range = (from, through) => Array.from({ length: through - from + 1 }, (_, i) => from + i);

test('following refresh uses one real RPC and keeps ordered, server-confirmed TEXT/PHOTO/VOICE rows', async () => {
  const h = harness(50, { voice: true });
  await h.model.start(); h.resetCalls(); h.append(51, 53);
  h.state.rows.at(-2).kind = 'PHOTO';
  h.state.rows.at(-2).photos = [{ assetId: id(80001), width: 100, height: 80, byteSize: 1024, contentType: 'image/jpeg' }];
  Object.assign(h.state.rows.at(-1), { kind: 'VOICE', body: '', voice: { assetId: id(80002), durationMs: 1500, byteSize: 2048, contentType: 'audio/mp4' } });
  const gate = deferred(), begun = deferred();
  h.state.override = async call => { begun.resolve(); await gate.promise; return call.result; };
  const refresh = h.model.refresh(); await begun.promise;
  assert.deepEqual(h.numbers(), range(1, 50), 'arrival hint cannot display an unconfirmed message');
  gate.resolve(); await refresh;
  assert.equal(h.calls.length, 1, 'usual following refresh needs one page RPC');
  assert.match(h.calls[0].name, /messages_page_v2$/);
  assert.deepEqual(h.numbers(), range(1, 53));
  assert.equal(h.model.snapshot().data.at(-2).fotografije[0].assetId, id(80001));
  assert.equal(h.model.snapshot().data.at(-1).glas.assetId, id(80002));
  assert.equal(h.model.snapshot().newerCursor, null); assert.equal(h.model.snapshot().refreshError, false);
  h.model.stop();
});

test('newest-page refresh replaces changed or removed rows in its covered interval', async () => {
  const h = harness(80); await h.model.start(); h.resetCalls();
  h.state.rows = h.state.rows.filter(item => item.messageId !== id(65));
  h.state.rows.find(item => item.messageId === id(64)).body = 'Izmenjen prikaz sa servera';
  h.append(81, 81); await h.model.refresh();
  assert.equal(h.calls.length, 1);
  assert.equal(h.numbers().includes(65), false);
  assert.equal(h.model.snapshot().data.find(item => item.id === id(64)).telo, 'Izmenjen prikaz sa servera');
  assert.equal(h.numbers().at(-1), 81); h.model.stop();
});

test('an authoritative complete history can clear or replace every retained message without a window', async t => {
  for (const total of [0, 3]) await t.test(`replacement count ${total}`, async () => {
    const h = harness(); await h.model.start(); h.resetCalls();
    h.state.rows = Array.from({ length: total }, (_, i) => row(100 + i));
    await h.model.refresh();
    assert.equal(h.calls.length, 1); assert.deepEqual(h.numbers(), total ? range(100, 102) : []);
    assert.equal(h.model.snapshot().olderCursor, null); assert.equal(h.model.snapshot().newerCursor, null);
    assert.equal(h.model.snapshot().error, false); h.model.stop();
  });
});

test('a disconnected newest page falls back to the old tail and every unseen gap stays resumable', async () => {
  const h = harness(); await h.model.start(); h.resetCalls(); h.append(51, 200);
  await h.model.refresh();
  assert.equal(h.calls.length, 2); assert.match(h.calls[0].name, /messages_page/); assert.match(h.calls[1].name, /message_window/);
  assert.deepEqual(h.numbers(), range(1, 99));
  assert.equal(h.model.snapshot().newerCursor.messageId, id(99));
  for (let i = 0; i < 3; i++) await h.model.loadNewer();
  assert.deepEqual(h.numbers(), range(1, 200));
  assert.equal(h.model.snapshot().newerCursor, null);
  assert.equal(new Set(h.numbers()).size, 200); h.model.stop();
});

test('reading an older anchor keeps its window and a separate newest probe without jumping over the middle', async () => {
  const h = harness(300, { position: { following: false, anchor: { messageId: id(50) } } });
  await h.model.start(); h.resetCalls(); h.append(301, 310); await h.model.refresh();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].args.p_target_message_id, id(50));
  assert.deepEqual(h.numbers(), range(26, 75));
  assert.equal(h.model.snapshot().newerCursor.messageId, id(75));
  assert.equal(h.model.snapshot().olderCursor.messageId, id(26)); h.model.stop();
});

test('a stale concurrent newest probe cannot resurrect a row removed by a fresher anchor window', async () => {
  const h = harness(80, { position: { following: false, anchor: { messageId: id(50) } } });
  await h.model.start(); h.resetCalls(); const staleRows = structuredClone(h.state.rows);
  h.state.rows = h.state.rows.filter(item => item.messageId !== id(60));
  h.state.override = call => call.name.includes('messages_page')
    ? h.response(call.name, call.args, staleRows, instant(499999)) : call.result;
  await h.model.refresh();
  assert.equal(h.calls.length, 2); assert.equal(h.numbers().includes(60), false);
  assert.deepEqual(h.numbers(), range(26, 76).filter(n => n !== 60)); h.model.stop();
});

test('bounded history and a reading anchor moved during refresh preserve recoverable cursors', async () => {
  const h = harness(); await h.model.start();
  for (let n = 51; n < 296; n += 49) { h.append(n, n + 48); await h.model.refresh(); }
  assert.deepEqual(h.numbers(), range(96, 295));
  assert.equal(h.model.snapshot().olderCursor.messageId, id(96));
  h.resetCalls(); h.append(296, 344); const gate = deferred(), begun = deferred();
  h.state.override = async call => { begun.resolve(); await gate.promise; return call.result; };
  const refresh = h.model.refresh(); await begun.promise;
  h.state.position = { following: false, anchor: { messageId: id(100) } };
  gate.resolve(); await refresh;
  assert.equal(h.calls.length, 1); assert.equal(h.numbers().length, 200);
  assert.ok(h.numbers().includes(100)); assert.equal(h.model.snapshot().newerCursor.messageId, id(295));
  h.state.override = null; await h.model.loadNewer();
  assert.deepEqual(h.numbers(), range(145, 344)); assert.equal(h.model.snapshot().newerCursor, null); h.model.stop();
});

test('authority refusal from the single read removes the retained projection and dispatches no fallback', async t => {
  for (const code of ['MEDIA_NOT_FOUND', 'AUTH_REQUIRED', 'AUTH_CONTEXT_CHANGED', 'ACCOUNT_CLOSING']) await t.test(code, async () => {
    const h = harness(); await h.model.start(); h.resetCalls();
    h.state.override = () => ({ data: null, error: { message: code } }); await h.model.refresh();
    assert.equal(h.calls.length, 1); assert.equal(h.model.snapshot().data, null); assert.equal(h.model.snapshot().error, true); h.model.stop();
  });
});

test('foreign or non-authoritative receipts cannot inject messages through the optimized path', async t => {
  for (const field of ['accountId', 'agreementId', 'authoritative']) await t.test(field, async () => {
    const h = harness(); await h.model.start(); h.resetCalls(); h.append(51, 51);
    h.state.override = call => ({ data: { ...call.result.data, [field]: field === 'authoritative' ? false : id(88888) }, error: null });
    await h.model.refresh();
    assert.equal(h.calls.length, 2, 'invalid newest data still uses the established window fallback');
    assert.deepEqual(h.numbers(), range(1, 50)); assert.equal(h.model.snapshot().refreshError, true); h.model.stop();
  });
});

test('failed newest transport retains the valid window fallback and visible retry state', async () => {
  const h = harness(); await h.model.start(); h.resetCalls(); h.append(51, 51);
  h.state.override = call => { if (call.name.includes('messages_page')) throw Error('fixture offline'); return call.result; };
  await h.model.refresh();
  assert.equal(h.calls.length, 2); assert.deepEqual(h.numbers(), range(1, 51));
  assert.equal(h.model.snapshot().refreshError, true); assert.equal(h.model.snapshot().error, false); h.model.stop();
});

test('retired visits and changed sessions cannot publish a late page or start gap fallback', async t => {
  for (const retirement of ['blur', 'account']) await t.test(retirement, async () => {
    const h = harness(); await h.model.start(); h.resetCalls(); h.append(51, 200);
    const gate = deferred(), begun = deferred();
    h.state.override = async call => { begun.resolve(); await gate.promise; return call.result; };
    const refresh = h.model.refresh(); await begun.promise;
    if (retirement === 'account') { h.session.user.id = OTHER; h.session.accountRevision++; h.model.forget(); }
    else h.model.stop();
    gate.resolve(); await refresh;
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0].signal.aborted, true);
    assert.deepEqual(h.numbers(), retirement === 'account' ? undefined : range(1, 50)); h.model.stop();
  });
});

test('showLatest supersedes an older pending refresh and only its authorized page is published', async () => {
  const h = harness(); await h.model.start(); h.resetCalls(); h.append(51, 200);
  const gate = deferred(), begun = deferred();
  h.state.override = async call => { if (h.calls.length === 1) { begun.resolve(); await gate.promise; } return call.result; };
  const refresh = h.model.refresh(); await begun.promise;
  h.append(201, 205); await h.model.showLatest(); gate.resolve(); await refresh;
  assert.equal(h.calls.length, 2); assert.deepEqual(h.numbers(), range(156, 205)); h.model.stop();
});

test('simultaneous refresh hints share one flight and one trailing authoritative page', async () => {
  const h = harness(); await h.model.start(); h.resetCalls(); h.append(51, 51);
  const gate = deferred(), begun = deferred();
  h.state.override = async call => { if (h.calls.length === 1) { begun.resolve(); await gate.promise; } return call.result; };
  const refresh = h.model.refresh(); await begun.promise;
  const duplicates = Array.from({ length: 100 }, () => h.model.refresh('silent'));
  assert.ok(duplicates.every(value => value === refresh));
  h.append(52, 52); gate.resolve(); await Promise.all([refresh, ...duplicates]);
  assert.equal(h.calls.length, 2); assert.deepEqual(h.numbers(), range(1, 52)); h.model.stop();
});

test('the existing 15-second deadline bounds the whole refresh and forbids late fallback dispatch', async () => {
  const h = harness(50, { fakeClock: true }); await h.model.start(); h.resetCalls(); h.append(51, 200);
  const gate = deferred(), begun = deferred();
  h.state.override = async call => { begun.resolve(); await gate.promise; return call.result; };
  const refresh = h.model.refresh(); await begun.promise; h.advance(15000); await refresh;
  assert.deepEqual(h.numbers(), range(1, 50)); assert.equal(h.model.snapshot().refreshError, true);
  assert.equal(h.calls[0].signal.aborted, true); gate.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(h.calls.length, 1); assert.equal(h.timers.size, 0); h.model.stop();
});
