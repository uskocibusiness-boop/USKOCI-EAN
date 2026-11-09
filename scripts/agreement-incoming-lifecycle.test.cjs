'use strict';
// Mounted production route + useOwnedEditor + incoming hook/coalescer + actual
// invalidation service. Only native/navigation hosts, RPC/channel transport and
// unrelated media/group/history boundaries are fixtures. Not Android or DEV QA.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const { ROOT, React, RTR, createHarness, deferred, mount, nodes, unmount } = require('./ux-component-harness.cjs');
const ROUTE = 'src/app/dogovor/[id].tsx';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ACCOUNT = id(1), OTHER = id(2), AGREEMENT = id(3);
const tick = () => new Promise(resolve => setImmediate(resolve));

async function harness(options = {}) {
  let session = { user: { id: ACCOUNT }, session: { user: { id: ACCOUNT } }, accountRevision: 1, sessionEpoch: 1 };
  let focused = true;
  const sessionListeners = new Set(), focusListeners = new Set(), activityListeners = new Set();
  const channels = [], reads = [], historyReads = [], mutations = [], acknowledgements = [], navigation = [];
  const state = { hold: null, fail: false, data: {
    id: AGREEMENT, verzija: 1, naslov: 'Probni Dogovor', stanje: options.status ?? 'CONFIRMED', chatDostupan: options.chatAvailable !== false,
    izvor: { zadatakId: id(4), prijavaId: id(5) }, rezim: 'DALJINSKI', vremeTekst: 'Po dogovoru',
    cena: { iznos: 1000, valuta: 'RSD', jedinica: 'TOTAL' }, pokrivenost: { ukupno: 1, popunjeno: 1 },
    kontakt: { lokacijaPostoji: false }, problemOtvoren: false,
    radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: false },
    ucesnici: [{ id: ACCOUNT, viSte: true, uloga: 'narucilac', ime: 'Vlasnik' },
      { id: OTHER, viSte: false, uloga: 'uskocer', ime: 'Izvršilac' }],
  } };
  const source = { poreklo: 'supabase', dogovor: async asked => {
    assert.equal(asked, AGREEMENT);
    const call = { snapshot: structuredClone(state.data), fail: state.fail, hold: state.hold }; reads.push(call);
    if (call.hold) await call.hold.promise;
    if (call.fail) throw Error('fixture offline');
    return call.snapshot;
  }, oznaciZavrsetak: async () => { mutations.push('complete'); }, potvrdiZavrsetak: async () => { mutations.push('confirm'); } };
  const history = { data: [], loading: false, error: false,
    refresh: async mode => { historyReads.push(mode); }, loadOlder: async () => {}, loadNewer: async () => {}, showLatest: async () => {} };
  const outbox = { reconcile: async () => {}, setDraft: async () => { mutations.push('draft'); } };
  const outboxState = { phase: 'ready', entries: [], draft: '' };
  const app = { currentState: 'active', addEventListener: (_event, fn) => {
    activityListeners.add(fn); return { remove: () => activityListeners.delete(fn) };
  } };
  const client = { channel: topic => {
    const channel = { topic, removed: false, changes: [], system: null, subscribed: null,
      on(type, filter, fn) { if (type === 'system') this.system = fn; else this.changes.push({ filter, fn }); return this; },
      subscribe(fn) { this.subscribed = fn; return this; } };
    channels.push(channel); return channel;
  }, removeChannel: channel => { channel.removed = true; } };
  const h = createHarness({
    'src/store/sesija.ts': { sesijaSada: () => session, useSesija: () => React.useSyncExternalStore(
      fn => { sessionListeners.add(fn); return () => sessionListeners.delete(fn); }, () => session, () => session) },
    'src/store/uloga.ts': { useIzvor: () => source },
    'expo-router': { router: { canGoBack: () => false, push: value => navigation.push(value), replace: value => navigation.push(value), navigate: value => navigation.push(value) },
      useLocalSearchParams: () => ({ id: AGREEMENT, tab: options.tab }),
      useFocusEffect: fn => {
        const active = React.useSyncExternalStore(cb => { focusListeners.add(cb); return () => focusListeners.delete(cb); }, () => focused, () => focused);
        React.useEffect(() => active ? fn() : undefined, [active, fn]);
      } },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => client },
    'expo-notifications': { addNotificationReceivedListener: () => ({ remove() {} }), addNotificationsDroppedListener: () => ({ remove() {} }) },
    'src/ui/notifications/publicInboxCopy.ts': { publicInboxNotificationId: () => null },
    'src/hooks/useAgreementHistory.ts': { useAgreementHistory: () => history },
    'src/hooks/useAgreementOutbox.ts': { useAgreementOutbox: () => ({ model: outbox, state: outboxState }) },
    'src/hooks/useAgreementPhotos.ts': { useAgreementPhotos: () => ({}) },
    'src/ui/groups/useGroupContext.ts': { useGroupContext: () => ({ context: null, current: () => true }) },
    'src/data/agreementMessageHistoryService.ts': { agreementMessageHistoryService: { markDisplayed: async () => { acknowledgements.push('ack'); } } },
    'src/data/needSearchRecoveryClientService.ts': { needSearchRecoveryClientService: { read: async () => ({ ok: false }) } },
    'src/data/agreementCancellationClientService.ts': { agreementCancellationService: { read: async () => ({ ok: false }) }, cancellationOf: () => null },
    'src/data/agreementClientService.ts': { agreementProblemService: { read: async () => ({ ok: false }) }, knownProblemRefusal: () => false },
    'src/data/reviewsClientService.ts': { reviewsClientService: { context: async () => ({ ok: false }) } },
    'src/data/needDetailPresentation.ts': { needScheduleText: () => 'Po dogovoru' },
    'src/ui/system/motion.ts': { useReducedMotion: () => true },
  });
  h.native.AppState = app; h.native.KeyboardAvoidingView = 'KeyboardAvoidingView';
  h.native.Keyboard = { isVisible: () => false, dismiss() {} };
  h.native.BackHandler = { addEventListener: () => ({ remove() {} }) };
  h.stubs['react-native-safe-area-context'] = { SafeAreaView: h.host('SafeAreaView') };
  for (const [file, exports] of [
    ['src/ui/agreements/AgreementOverview.tsx', ['AgreementOverview']],
    ['src/ui/agreements/AgreementCompletionReview.tsx', ['AgreementCompletionReview']],
    ['src/ui/agreements/AgreementOverviewParts.tsx', ['AgreementStatusView', 'AgreementProblemForm', 'AgreementProblemNote', 'AgreementProblemUnknown', 'AgreementProblemExits']],
    ['src/ui/v2/AgreementThreadPresentation.tsx', ['AgreementThreadPresentation']],
    ['src/ui/system/ActionSheet.tsx', ['ActionSheet']], ['src/ui/system/ScreenChrome.tsx', ['ChromeIconButton']],
    ['src/ui/system/Poruka.tsx', ['PorukaHost']], ['src/ui/product/ProductDetails.tsx', ['ProductHeader']],
    ['src/ui/groups/GroupConversationEntry.tsx', ['GroupConversationEntry']],
    ['src/ui/groups/ConversationChannels.tsx', ['ConversationChannels']],
  ]) h.stubs[file] = Object.fromEntries(exports.map(name => [name, h.host(name)]));
  h.stubs['src/ui/groups/ConversationChannels.tsx'].privateConversationChoices = () => [];
  h.stubs['src/ui/agreements/agreementListModel.ts'] = { cancellationDetailsOf: () => null };
  h.stubs['src/ui/v2/AgreementPresentation.tsx'] = { AgreementTabs: h.host('AgreementTabs'), AgreementPersonBar: h.host('AgreementPersonBar'), isNoTermText: () => true };
  h.stubs['src/ui/agreements/AgreementWorkspace.tsx'] = { WorkspaceFooter: h.host('WorkspaceFooter'), agreementNextStep: () => null,
    agreementQuietLine: () => 'Dogovor je potvrđen.', agreementStepsInfo: () => null, agreementWaitsForMe: () => null };
  // Load the exact current/preimage route with the same dependency loader. This
  // lets the regression execute old behavior without modifying runtime files.
  const sourceText = process.env.USKOCI_INCOMING_PREIMAGE
    ? execFileSync('git', ['show', `${process.env.USKOCI_INCOMING_PREIMAGE}:${ROUTE}`], { cwd: ROOT, encoding: 'utf8' })
    : fs.readFileSync(path.join(ROOT, ROUTE), 'utf8');
  const compiled = ts.transpileModule(sourceText, { fileName: ROUTE, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  const routeModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(request => {
    if (Object.hasOwn(h.stubs, request)) return h.stubs[request];
    if (!request.startsWith('.')) return require(request);
    const base = path.resolve(ROOT, path.dirname(ROUTE), request);
    const filename = ['', '.ts', '.tsx', '/index.ts'].map(ext => base + ext).find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    assert.ok(filename, request); return h.load(path.relative(ROOT, filename));
  }, routeModule, routeModule.exports);
  const tree = await mount(routeModule.exports.default, {});
  const props = name => nodes(tree, node => node.type === name)[0]?.props;
  const flush = () => RTR.act(async () => { await tick(); });
  return { tree, state, channels, reads, historyReads, mutations, acknowledgements, navigation, props, flush,
    live: () => channels.filter(channel => !channel.removed),
    async join(channel = channels.at(-1)) { await RTR.act(async () => { channel.subscribed('SUBSCRIBED'); await tick(); }); },
    async ready(channel = channels.at(-1)) { await RTR.act(async () => { channel.system({ extension: 'postgres_changes', status: 'ok' }); await tick(); }); },
    async focus(value) { await RTR.act(async () => { focused = value; for (const fn of [...focusListeners]) fn(); await tick(); }); },
    async activity(value) { await RTR.act(async () => { app.currentState = value; for (const fn of [...activityListeners]) fn(value); await tick(); }); },
    async account(value = OTHER, sessionOnly = false) { await RTR.act(async () => {
      session = { ...session, user: { id: value }, session: { user: { id: value } },
        accountRevision: session.accountRevision + (sessionOnly ? 0 : 1), sessionEpoch: session.sessionEpoch + 1 };
      for (const fn of [...sessionListeners]) fn(); await tick();
    }); },
    async stop() { await unmount(tree); assert.equal(channels.filter(channel => !channel.removed).length, 0); },
  };
}

test('mounted Dogovor keeps one channel across SUBSCRIBED refresh instead of loading/rejoin/read loop', async () => {
  const h = await harness();
  try {
    // Drive newly joined channels as a real SDK would. The old route creates a
    // replacement after each settled read, so three joins reproduce the loop.
    const seen = new Set();
    for (let round = 0; round < 3; round++) {
      h.state.hold = deferred();
      for (const channel of [...h.live()]) if (!seen.has(channel)) { seen.add(channel); await h.join(channel); }
      // Preserve the real asynchronous transport boundary: loading renders
      // before the server answers. An immediately resolved stub masks the bug.
      await RTR.act(async () => { h.state.hold.resolve(); await tick(); });
      h.state.hold = null; await h.flush();
    }
    assert.equal(h.channels.length, 1, 'read state must not recreate its own incoming owner');
    assert.equal(h.live().length, 1); assert.equal(h.reads.length, 2, 'initial workspace + one join read');
    assert.equal(h.props('WorkspaceFooter').statusText, null);
    assert.equal(h.props('AgreementOverview').enabled, true);
    assert.deepEqual(h.mutations, []); assert.deepEqual(h.acknowledgements, []);
  } finally { await h.stop(); }
});

test('pending workspace read keeps its channel but still fences menu actions; settlement enables them', async () => {
  const h = await harness();
  try {
    h.state.hold = deferred(); await h.join();
    assert.equal(h.channels.length, 1); assert.equal(h.live().length, 1);
    assert.equal(h.props('WorkspaceFooter').statusText, 'Osvežavamo…');
    assert.equal(h.props('AgreementOverview').enabled, false);
    const opener = nodes(h.tree, node => node.type === 'ChromeIconButton' && node.props.label === 'Opcije Dogovora')[0];
    await RTR.act(async () => opener.props.onPress());
    assert.ok(h.props('ActionSheet').actions.every(action => action.disabled));
    await RTR.act(async () => { h.state.hold.resolve(); await tick(); });
    assert.equal(h.props('WorkspaceFooter').statusText, null);
    assert.ok(h.props('ActionSheet').actions.every(action => !action.disabled));
    assert.equal(h.channels.length, 1);
  } finally { await h.stop(); }
});

test('Poruke join refreshes workspace and message history in parallel without sending or acknowledging', async () => {
  const h = await harness({ tab: 'poruke' });
  try {
    h.state.hold = deferred(); await h.join();
    assert.equal(h.reads.length, 2); assert.deepEqual(h.historyReads, ['silent'], 'history does not wait for a slow workspace RPC');
    assert.equal(h.props('AgreementThreadPresentation').chat.writable, false);
    await RTR.act(async () => { h.state.hold.resolve(); await tick(); });
    assert.equal(h.props('AgreementThreadPresentation').chat.writable, true);
    assert.equal(h.channels.length, 1); assert.deepEqual(h.mutations, []); assert.deepEqual(h.acknowledgements, []);
    await RTR.act(async () => h.props('AgreementThreadPresentation').onOverview());
    assert.equal(h.channels.length, 1, 'changing inner tab is not a channel identity change');
  } finally { await h.stop(); }
});

test('completed read-only chat still refreshes its workspace but cannot refresh a disallowed conversation', async () => {
  const h = await harness({ tab: 'poruke', status: 'COMPLETED', chatAvailable: false });
  try {
    await h.join(); assert.equal(h.channels.length, 1); assert.equal(h.reads.length, 2);
    assert.deepEqual(h.historyReads, []); assert.equal(h.props('AgreementThreadPresentation').chat.writable, false);
    assert.deepEqual(h.mutations, []); assert.deepEqual(h.acknowledgements, []);
  } finally { await h.stop(); }
});

test('blur, background and a renewed session retire old callbacks and restore only one scoped channel', async () => {
  const h = await harness();
  try {
    let old = h.live()[0], before = h.reads.length;
    await h.focus(false); await h.join(old); assert.equal(h.live().length, 0); assert.equal(h.reads.length, before);
    await h.focus(true); assert.equal(h.live().length, 1);
    old = h.live()[0]; before = h.reads.length;
    await h.activity('background'); await h.join(old); assert.equal(h.live().length, 0); assert.equal(h.reads.length, before);
    await h.activity('active'); assert.equal(h.live().length, 1);
    old = h.live()[0]; await h.account(ACCOUNT, true); before = h.reads.length;
    await h.join(old); assert.equal(h.reads.length, before); assert.equal(h.live().length, 1);
    await h.join(); assert.equal(h.props('AgreementOverview').enabled, true);
  } finally { await h.stop(); }
});

test('account replacement and foreign participant projection cannot revive the old incoming owner', async () => {
  const h = await harness();
  try {
    const old = h.live()[0]; h.state.hold = deferred(); await h.join(old);
    await h.account(OTHER); const before = h.reads.length;
    await h.join(old); await RTR.act(async () => { h.state.hold.resolve(); await tick(); });
    assert.equal(h.reads.length, before); assert.equal(h.live().length, 0);
    assert.deepEqual(h.mutations, []); assert.deepEqual(h.acknowledgements, []);
  } finally { await h.stop(); }
});

test('server cancellation closes the owner and a lost workspace authority does not silently enable actions', async () => {
  for (const outcome of ['cancelled', 'failed']) {
    const h = await harness();
    try {
      const old = h.live()[0];
      if (outcome === 'cancelled') { h.state.data.stanje = 'CANCELLED'; h.state.data.chatDostupan = false; }
      else h.state.fail = true;
      await h.join(old); const before = h.reads.length;
      assert.equal(h.live().length, 0); await h.join(old); assert.equal(h.reads.length, before);
      if (outcome === 'failed') { assert.equal(h.props('AgreementOverview'), undefined); assert.equal(h.props('AgreementStatusView').error, true); }
      assert.deepEqual(h.mutations, []); assert.deepEqual(h.acknowledgements, []);
    } finally { await h.stop(); }
  }
});
