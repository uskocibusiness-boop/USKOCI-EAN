'use strict';
// Production transports, routes and owned editor at inert native boundaries.
// These are local lifecycle proofs, not Android, DEV or provider evidence.
const test = require('node:test');
const assert = require('node:assert/strict');
const { React, RTR, createHarness, deferred } = require('./ux-component-harness.cjs');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ACCOUNT = id(1), CID = id(2), KEY = id(3), TURN = id(4), ATTEMPT = id(5);
const ok = podatak => ({ ok: true, podatak });
const capability = (state = 'PREPARED') => ({ schemaVersion: 'AI_PREPARED_RECOVERY_V1', conversationId: CID,
  clientRequestId: KEY, state, canResume: state === 'PREPARED', authoritative: true });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const turn = (domain, state = 'SUCCEEDED') => domain === 'Need'
  ? { conversationId: CID, clientRequestId: KEY, state, turnId: TURN, retryAllowed: false,
    receipt: state === 'SUCCEEDED' ? { userMessageId: id(8), assistantMessageId: id(9), proposedCount: 0,
      safety: 'ALLOW', schemaVersion: 'NEED_FACT_V2', authoritative: true } : null }
  : { turnId: TURN, conversationId: CID, clientRequestId: KEY, attemptId: ATTEMPT, state, retryAllowed: false, authoritative: true };
function stream(domain) {
  const event = (sequence, kind, extra = {}) => ({ conversationId: CID, clientRequestId: KEY, turnId: TURN,
    attemptId: ATTEMPT, sequence, kind, ...extra });
  return new Response([event(1, 'accepted'), event(2, 'text_delta', { text: 'Odgovor.' }),
    event(3, 'final', { turn: turn(domain) })].map(value => `data: ${JSON.stringify(value)}\n\n`).join(''),
  { headers: { 'content-type': 'text/event-stream' } });
}
function transportHarness(reply) {
  const session = { user: { id: ACCOUNT }, accountRevision: 1, session: { access_token: 'fixture-user-token' } };
  const requests = [];
  const h = createHarness({
    'expo/fetch': { fetch: async (url, init) => { const request = { url, init, body: JSON.parse(init.body) };
      requests.push(request); return reply(request); } },
    'src/store/sesija.ts': { sesijaSada: () => session },
    'src/data/publicSupabaseConfig.ts': { readPublicSupabaseConfig: () => ({ url: 'https://fixture.supabase.co', anonKey: 'public-fixture' }) },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => { throw Error('UNEXPECTED_SDK_OR_RPC'); } },
  });
  return { ...h, session, requests, Need: h.load('src/data/aiNeedV2Production.ts').aiNeedV2Production,
    Worker: h.load('src/data/workerAiClientService.ts').workerAiClientService };
}
for (const domain of ['Need', 'Worker']) {
  test(`${domain}: CHECK is IDs-only metadata; explicit RESUME reuses IDs and normal final decoder`, async () => {
    const h = transportHarness(({ body }) => body.mode === 'CHECK_PREPARED' ? json(capability()) : stream(domain));
    assert.deepEqual(await h[domain].checkPrepared(CID, KEY), ok(capability()));
    const deltas = [], hints = [];
    assert.deepEqual(await h[domain].resumePrepared(CID, KEY, { onText: value => deltas.push(value), onConversationIntent: value => hints.push(value) }), ok(turn(domain)));
    assert.deepEqual(deltas, ['Odgovor.']); assert.deepEqual(hints, []);
    assert.deepEqual(h.requests.map(r => r.body), ['CHECK_PREPARED', 'RESUME_PREPARED'].map(mode => ({ mode, conversationId: CID, clientRequestId: KEY })));
    assert.equal(new Headers(h.requests[0].init.headers).get('accept'), 'application/json');
    for (const request of h.requests) assert.equal(new Headers(request.init.headers).get('x-uskoci-interview-intent'), null);
  });
  test(`${domain}: malformed or foreign capability never authorizes resume`, async () => {
    const invalid = [{ ...capability(), conversationId: id(91) }, { ...capability(), clientRequestId: id(92) },
      { ...capability(), state: 'EXPIRED' }, { ...capability(), authoritative: false },
      { ...capability(), text: 'private saved content' }, { ...capability(), state: 'UNKNOWN' }];
    const h = transportHarness(() => json(invalid.shift()));
    while (invalid.length) assert.equal((await h[domain].checkPrepared(CID, KEY)).ok, false);
    assert.equal(h.requests.length, 6); assert.ok(h.requests.every(r => r.body.mode === 'CHECK_PREPARED'));
  });
  test(`${domain}: disabled, expired and dispatched capability remains read-only`, async () => {
    const states = ['UNAVAILABLE', 'ABSENT', 'CLOSED', 'READ_ONLY', 'EXPIRED', 'STALE', 'ERASED', 'NOT_ADMITTED'];
    const h = transportHarness(() => json(capability(states.shift())));
    for (let i = 0; i < 8; i++) { const result = await h[domain].checkPrepared(CID, KEY);
      assert.equal(result.ok, true); assert.equal(result.podatak.canResume, false); }
    assert.equal(h.requests.length, 8);
  });
  test(`${domain}: refused resume has no automatic retry or fallback send`, async () => {
    const h = transportHarness(() => json({ code: 'AI_PREPARED_RECOVERY_UNAVAILABLE' }, 409));
    assert.equal((await h[domain].resumePrepared(CID, KEY, { onText() {} })).ok, false);
    assert.equal(h.requests.length, 1); assert.equal(h.requests[0].body.mode, 'RESUME_PREPARED');
  });
  test(`${domain}: CHECK rejects event streams and a late response from an old account revision`, async () => {
    const pending = deferred(); let sse = true;
    const h = transportHarness(() => sse ? stream(domain) : pending.promise);
    assert.equal((await h[domain].checkPrepared(CID, KEY)).ok, false);
    sse = false; const read = h[domain].checkPrepared(CID, KEY);
    h.session.user = { id: id(99) }; h.session.accountRevision++;
    h.session.user = { id: ACCOUNT }; h.session.accountRevision++;
    pending.resolve(json(capability())); assert.equal((await read).ok, false);
    assert.equal(h.requests.length, 2);
  });
}

function routeHarness(domain, options = {}) {
  const state = { status: 'PROCESSING', providerDispatched: false, cancelled: false, capability: 'PREPARED',
    refusal: false, responseLostAfterSuccess: false, ...options };
  let resumeWait = null, checkWait = null, journalSaveWait = null, namePatchWait = null, normalSendWait = null,
    journalValue = { accountId: ACCOUNT, conversationId: CID, clientRequestId: KEY };
  const calls = [], listeners = new Set(), Focus = React.createContext(true);
  const transport = transportHarness(async ({ body }) => {
    if (body.mode === 'CHECK_PREPARED') {
      if (checkWait) { const wait = checkWait; checkWait = null; await wait.promise; }
      return json(capability(state.capability));
    }
    assert.equal(body.mode, 'RESUME_PREPARED');
    if (resumeWait) await resumeWait.promise;
    if (state.refusal) return json({ code: 'AI_CREDITS_UNAVAILABLE' }, 503);
    state.status = 'SUCCEEDED'; state.providerDispatched = true;
    return state.responseLostAfterSuccess ? json({ code: 'AI_CREDITS_UNAVAILABLE' }, 503) : stream(domain);
  });
  const unexpected = name => () => { calls.push(name); throw Error('UNEXPECTED_' + name); };
  const profile = { displayName: state.alignAccountName ? 'Ranije ime' : 'Milan', bio: '', skills: [], tools: [], vehicles: [], licenses: [], teamCapacity: 1, workAreas: [],
    location: { city: '', operatingCountryCode: null, radiusKm: 1, approximatePosition: null },
    availability: { timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [] } };
  const needSnapshot = () => ({ conversationId: CID, schemaVersion: 'NEED_FACT_V2', status: 'OPEN', safety: 'ALLOW', facts: [],
    messages: state.status === 'SUCCEEDED' ? [{ id: id(8), body: 'Originalna poruka.', fromAi: false }, { id: id(9), body: 'Potvrđen odgovor.', fromAi: true }] : [],
    review: { conversationId: CID, schemaVersion: 'NEED_FACT_V2', boundNeedId: null, canSaveDraft: false, missingRequired: [], facts: [] } });
  const workerSnapshot = () => ({ schemaVersion: 'WORKER_PROFILE_V1', accountId: ACCOUNT, conversationId: CID, profileId: id(6), revision: 1,
    status: 'OPEN', stale: false, safety: 'ALLOW', profileStatus: 'DRAFT', candidate: profile, review: null, saved: null,
    messages: state.status === 'SUCCEEDED' ? [{ id: id(8), role: 'USER', body: 'Originalna poruka.', sequence: 1 },
      { id: id(9), role: 'ASSISTANT', body: 'Potvrđen odgovor.', sequence: 2 }] : [],
    turn: { ...turn('Worker', state.status), clientRequestId: state.lastRequestId ?? KEY } });
  const api = { checkPrepared: transport[domain].checkPrepared, resumePrepared: transport[domain].resumePrepared,
    recoverTurn: async (cid, key) => { calls.push('recover'); assert.equal(cid, CID); assert.equal(key, KEY);
      return ok({ accountId: ACCOUNT, conversationId: CID, clientRequestId: KEY, conversationStatus: 'OPEN',
        turn: turn(domain, state.status), providerDispatched: state.providerDispatched, cancelled: state.cancelled,
        canCancel: false, authoritative: true, ...(domain === 'Worker' ? { schemaVersion: 'WORKER_PROFILE_V1', profileId: id(6), retryAllowed: false } : {}) }); },
    loadConversation: async () => { calls.push('read'); return needSnapshot(); },
    read: async () => { calls.push('read'); return ok(workerSnapshot()); },
    send: async (cid, body, key) => {
      if (!state.normalSend) return unexpected('send')();
      calls.push('send'); assert.equal(cid, CID); assert.equal(key, id(80));
      assert.equal(body, 'Treba mi pomoć oko nošenja.');
      if (normalSendWait) await normalSendWait.promise;
      state.status = 'SUCCEEDED'; state.providerDispatched = true; state.lastRequestId = key;
      return ok({ ...turn('Worker'), clientRequestId: key });
    }, sendMessage: async (cid, body, key) => {
      if (!state.normalSend) return unexpected('sendMessage')();
      calls.push('sendMessage'); assert.equal(cid, CID); assert.equal(key, id(80));
      assert.equal(body, 'Treba mi pomoć oko nošenja.');
      return { ok: false, kod: 'AI_CREDITS_UNAVAILABLE', poruka: 'AI trenutno nije dostupan.' };
    }, open: unexpected('open'), openConversation: unexpected('openConversation'),
    prepare: unexpected('prepare'), patch: async (cid, revision, value) => {
      if (!state.alignAccountName) return unexpected('patch')();
      calls.push('namePatch'); assert.equal(cid, CID); assert.equal(revision, 1);
      assert.deepEqual(value, { displayName: 'Milan' });
      if (namePatchWait) await namePatchWait.promise;
      profile.displayName = 'Milan'; return ok(workerSnapshot());
    }, save: unexpected('save'), abandon: unexpected('abandon'), cancelTurn: unexpected('cancelTurn'),
  };
  const journal = { load: async account => account === ACCOUNT ? journalValue : null,
    save: async value => { if (!state.normalSend) return unexpected('journalSave')();
      calls.push('journalSave'); if (journalSaveWait) await journalSaveWait.promise; journalValue = { ...value }; },
    clear: async value => { assert.deepEqual(value, journalValue);
      calls.push('journalClear'); journalValue = null; } };
  const app = { currentState: 'active', addEventListener: (_type, fn) => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } };
  const voice = { state: { phase: 'IDLE' }, controller: { getSnapshot: () => voice.state, cancel() {}, subscribe: () => () => {} } };
  const confirm = { close() {}, ask: unexpected('confirm'), sheet: null };
  const photos = { loaded: true, busy: false, working: false, unconfirmed: false, continueReason: null, canContinue: () => true,
    items: [], readError: false, pick: unexpected('pick') };
  const host = name => props => React.createElement(name, props, props.children, props.header, props.footer,
    props.footerAction, props.actions, props.status);
  const overrides = {
    'expo-router': { useLocalSearchParams: () => ({ conversationId: CID }), useFocusEffect: callback => {
      const focused = React.useContext(Focus); React.useEffect(() => focused ? callback() : undefined, [focused, callback]); },
      router: { setParams() {}, replace: unexpected('replace'), push: unexpected('push'), back() {}, canGoBack: () => true } },
    'src/store/sesija.ts': { useSesija: () => transport.session, sesijaSada: () => transport.session },
    'src/data/index.ts': { aiNeedV2Izvor: api },
    'src/data/supabaseClient.ts': { supabaseKlijent: unexpected('supabase') },
    'src/data/workerAiClientService.ts': { workerAiClientService: api, WORKER_AI_READ_TRANSPORT_UNAVAILABLE: 'WORKER_AI_READ_TRANSPORT_UNAVAILABLE' },
    'src/data/aiTurnIntentJournal.ts': { aiTurnIntentJournal: journal },
    'src/data/workerAiTurnIntentJournal.ts': { workerAiTurnIntentJournal: journal },
    'src/data/aiTaskReviewClientService.ts': { aiTaskReviewClientService: { prepare: unexpected('taskPrepare'), readLatest: unexpected('readLatest') } },
    'src/data/aiRoleHandoff.ts': { takeNeedText: () => null, takeWorkerText: () => null, isExplicitWorkerOffer: () => false,
      stageAiRoleText: unexpected('handoff'), stageWorkerText: unexpected('handoff') },
    'src/data/aiCorrectionIntent.ts': { takeAiCorrection: () => null },
    'src/data/locationDialogueClientService.ts': { locationDialogueEnabled: () => false },
    'src/data/intakeReviewReturn.ts': { retireIntakeReviewReturn() {}, rememberIntakeReviewReturn: unexpected('reviewReturn') },
    'src/data/workerExecutionModeClientService.ts': { inferWorkerExecutionModes: () => [], workerExecutionModeClientService: {} },
    'src/data/reviewFactProblem.ts': { reviewFactProblem: () => null },
    'src/data/aiNeedV2Ui.ts': { safetyMessage: () => null },
    'src/lib/location.ts': { normalizeNeedLocation: () => null, pointsMissing: () => ({ total: 0, done: 0 }) },
    'src/lib/idempotencija.ts': { noviUuidZahtevId: () => { calls.push('newId'); return id(80); } },
    'src/features/voice/useHoldToTalk.ts': { useHoldToTalk: () => voice },
    'src/ui/v2/draftSummary.ts': { completeDraftProposal: () => false,
      publicSummary: () => ({ title: null, zone: '', value: null, people: null }) },
    'src/ui/profile/useAccountName.ts': { useAccountName: () => ({ state: 'ready', name: 'Milan' }) },
    'src/ui/media/useTaskPhotoUploads.ts': { useTaskPhotoUploads: () => photos },
    'src/ui/system/ConfirmSheet.tsx': { useConfirmSheet: () => confirm },
    'src/ui/system/haptics.ts': { tick() {} },
    'src/ui/system/motion.ts': { useReducedMotion: () => false },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
  };
  for (const [file, exports] of Object.entries({
    'src/ui/aiFirst/AiConversationShell.tsx': ['AiConversationShell'],
    'src/ui/system/ActionSheet.tsx': ['ActionSheet'], 'src/ui/system/ScreenChrome.tsx': ['ScreenChrome'],
    'src/ui/system/FactRow.tsx': ['FactRow'], 'src/ui/system/StateView.tsx': ['StateView'],
    'src/ui/media/AuthorizedPhoto.tsx': ['AuthorizedPhoto'], 'src/ui/media/PhotoAttachSheet.tsx': ['PhotoAttachSheet'],
    'src/ui/media/TaskPhotoLine.tsx': ['TaskPhotoLine'], 'src/ui/location/ConfirmedPlaceLine.tsx': ['ConfirmedPlaceLine'],
    'src/ui/v2/TaskFace.tsx': ['CardTitle'], 'src/ui/workerProfile/WorkerProfilePresentation.tsx': ['WorkerProfileFrame', 'WorkerProfileStatus'],
    'src/ui/workerProfile/WorkerAiPresentation.tsx': ['WorkerAiActivation', 'WorkerAiNotificationsNote', 'WorkerAiReviewDetails'],
  })) overrides[file] = Object.fromEntries(exports.map(name => [name, host(name)]));
  const h = createHarness(overrides); h.stubs['react-native'] = { ...h.native, AppState: app, Keyboard: { dismiss() {} } };
  h.stubs['src/ui/system/tokens.ts'].sys.conversation = {};
  const Route = h.load(domain === 'Need' ? 'src/app/(app)/nova.tsx' : 'src/app/(app)/profil/razgovor.tsx').default;
  let tree, focused = true;
  const element = () => React.createElement(Focus.Provider, { value: focused }, React.createElement(Route));
  const actions = label => tree.root.findAll(node => node.type === 'V2Action' && node.props.label === label);
  return { state, transport, calls, voice, journal: () => journalValue,
    async mount() { await RTR.act(async () => { tree = RTR.create(element()); }); },
    async render() { await RTR.act(async () => tree.update(element())); },
    async focus(value) { focused = value; await this.render(); },
    async background(value) { app.currentState = value; await RTR.act(async () => { for (const fn of listeners) fn(value); }); },
    shell: () => tree.root.findByType('AiConversationShell'),
    resume: () => actions('Nastavite odgovor'),
    async pressResume() { const buttons = this.resume(); assert.equal(buttons.length, 1); assert.equal(buttons[0].props.disabled, false);
      await RTR.act(async () => buttons[0].props.onPress()); },
    async check() { const buttons = domain === 'Need' ? actions('Proverite') : actions('Proverite razgovor');
      assert.equal(buttons.length, 1); await RTR.act(async () => buttons[0].props.onPress()); },
    copy: () => tree.root.findAll(node => node.type === 'T').flatMap(node => [node.props.children].flat(Infinity)).filter(value => typeof value === 'string'),
    holdResume() { resumeWait = deferred(); return resumeWait; }, holdCheck() { checkWait = deferred(); return checkWait; },
    holdJournalSave() { journalSaveWait = deferred(); return journalSaveWait; },
    holdNamePatch() { namePatchWait = deferred(); return namePatchWait; },
    holdNormalSend() { normalSendWait = deferred(); return normalSendWait; },
    async close() { if (tree) await RTR.act(async () => tree.unmount()); assert.equal(listeners.size, 0); },
  };
}
test('Need: ordinary send captured before background cannot create a turn after foreground returns', async () => {
  const h = routeHarness('Need', { status: 'SUCCEEDED', providerDispatched: true });
  try {
    await h.mount(); assert.equal(h.journal(), null);
    await RTR.act(async () => h.shell().props.onChange('Treba mi pomoć oko nošenja.'));
    assert.equal(h.shell().props.canSend, true);
    const send = h.shell().props.onSend;
    const ids = h.calls.filter(call => call === 'newId').length;
    await h.background('background'); assert.equal(h.shell().props.canSend, false);
    await h.background('active'); assert.equal(h.shell().props.canSend, true);
    await RTR.act(async () => send());
    assert.equal(h.calls.includes('journalSave'), false);
    assert.equal(h.calls.includes('sendMessage'), false);
    assert.equal(h.calls.filter(call => call === 'newId').length, ids);
    assert.equal(h.shell().props.value, 'Treba mi pomoć oko nošenja.');
  } finally { await h.close(); }
});
test('Need: background while persisting an ordinary turn keeps its journal and draft without starting the provider', async () => {
  for (const returnToActive of [false, true]) {
    const h = routeHarness('Need', { status: 'SUCCEEDED', providerDispatched: true, normalSend: true });
    try {
      await h.mount(); await RTR.act(async () => h.shell().props.onChange('Treba mi pomoć oko nošenja.'));
      const wait = h.holdJournalSave();
      await RTR.act(async () => h.shell().props.onSend());
      assert.equal(h.calls.filter(call => call === 'journalSave').length, 1);
      assert.equal(h.calls.includes('sendMessage'), false);
      const ids = h.calls.filter(call => call === 'newId').length;
      await h.background('background');
      if (returnToActive) await h.background('active');
      await RTR.act(async () => wait.resolve());
      assert.equal(h.calls.includes('sendMessage'), false, 'foreground cannot revive the retired send');
      assert.deepEqual(h.journal(), { accountId: ACCOUNT, conversationId: CID, clientRequestId: id(80) });
      assert.equal(h.shell().props.value, 'Treba mi pomoć oko nošenja.');
      assert.equal(h.shell().props.canSend, false);
      assert.equal(h.calls.filter(call => call === 'newId').length, ids);
      assert.equal(h.calls.filter(call => call === 'journalClear').length, 1, 'only the old confirmed turn was cleared at mount');
    } finally { await h.close(); }
  }
});
test('Need: a current foreground send persists its IDs and dispatches once without automatic retry after refusal', async () => {
  const h = routeHarness('Need', { status: 'SUCCEEDED', providerDispatched: true, normalSend: true });
  try {
    await h.mount(); await RTR.act(async () => h.shell().props.onChange('Treba mi pomoć oko nošenja.'));
    await h.background('background'); await h.background('active');
    const send = h.shell().props.onSend;
    await RTR.act(async () => send());
    assert.equal(h.calls.filter(call => call === 'sendMessage').length, 1);
    assert.equal(h.calls.filter(call => call === 'journalSave').length, 1);
    assert.deepEqual(h.journal(), { accountId: ACCOUNT, conversationId: CID, clientRequestId: id(80) });
    assert.equal(h.shell().props.value, 'Treba mi pomoć oko nošenja.');
    await RTR.act(async () => send());
    assert.equal(h.calls.filter(call => call === 'sendMessage').length, 1);
    assert.equal(h.calls.filter(call => call === 'journalSave').length, 1);
  } finally { await h.close(); }
});
for (const transition of ['background', 'background-return', 'account-return']) {
  test(`Worker: name alignment cannot revive an ordinary send after ${transition}`, async () => {
    const h = routeHarness('Worker', { status: 'SUCCEEDED', providerDispatched: true, normalSend: true, alignAccountName: true });
    const patch = h.holdNamePatch(), network = h.holdNormalSend();
    try {
      await h.mount(); assert.equal(h.journal(), null);
      await RTR.act(async () => h.shell().props.onChange('Treba mi pomoć oko nošenja.'));
      assert.equal(h.shell().props.canSend, true);
      await RTR.act(async () => h.shell().props.onSend());
      assert.equal(h.calls.filter(call => call === 'namePatch').length, 1);
      assert.equal(h.calls.includes('journalSave'), false);
      const ids = h.calls.filter(call => call === 'newId').length;
      if (transition === 'account-return') {
        h.transport.session.user = { id: id(99) }; h.transport.session.accountRevision++;
        h.transport.session.user = { id: ACCOUNT }; h.transport.session.accountRevision++;
      } else {
        await h.background('background');
        if (transition === 'background-return') await h.background('active');
      }
      await RTR.act(async () => patch.resolve());
      assert.equal(h.calls.includes('send'), false, 'a retired action must never dispatch a provider request');
      assert.equal(h.calls.includes('journalSave'), false, 'name alignment alone must not create a new AI request');
      assert.equal(h.calls.filter(call => call === 'newId').length, ids);
      assert.equal(h.journal(), null);
      if (transition === 'background-return') {
        assert.equal(h.shell().props.value, 'Treba mi pomoć oko nošenja.');
        await h.check();
        assert.equal(h.shell().props.canSend, true, 'fresh authoritative read enables an explicit new send');
      }
    } finally { await h.close(); await RTR.act(async () => { patch.resolve(); network.resolve(); }); }
  });
}
test('Worker: current name alignment preserves one explicit send and clears only its confirmed draft', async () => {
  const h = routeHarness('Worker', { status: 'SUCCEEDED', providerDispatched: true, normalSend: true, alignAccountName: true });
  const patch = h.holdNamePatch(), network = h.holdNormalSend();
  try {
    await h.mount(); await RTR.act(async () => h.shell().props.onChange('Treba mi pomoć oko nošenja.'));
    const send = h.shell().props.onSend;
    await RTR.act(async () => { send(); send(); });
    assert.equal(h.calls.filter(call => call === 'namePatch').length, 1);
    assert.equal(h.calls.includes('send'), false);
    await h.background('active'); // A duplicate native event is not a new foreground generation.
    await RTR.act(async () => patch.resolve());
    assert.equal(h.calls.filter(call => call === 'journalSave').length, 1);
    assert.equal(h.calls.filter(call => call === 'send').length, 1);
    assert.deepEqual(h.journal(), { accountId: ACCOUNT, conversationId: CID, clientRequestId: id(80) });
    assert.equal(h.shell().props.value, 'Treba mi pomoć oko nošenja.');
    await RTR.act(async () => network.resolve());
    assert.equal(h.journal(), null);
    assert.equal(h.shell().props.value, '', 'only the confirmed typed revision is cleared');
    assert.equal(h.calls.filter(call => call === 'journalClear').length, 2, 'initial recovery plus this exact success');
    assert.equal(h.calls.filter(call => call === 'send').length, 1);
  } finally { await h.close(); await RTR.act(async () => { patch.resolve(); network.resolve(); }); }
});

for (const domain of ['Need', 'Worker']) {
  test(`${domain}: actual cold screen reads only, actual explicit button resumes once and canonical success clears its journal`, async () => {
    const h = routeHarness(domain);
    try {
      await h.mount(); assert.equal(h.resume().length, 1); assert.equal(h.resume()[0].props.disabled, false);
      assert.deepEqual(h.transport.requests.map(r => r.body.mode), ['CHECK_PREPARED']);
      assert.deepEqual(Object.keys(h.journal()).sort(), ['accountId', 'clientRequestId', 'conversationId']);
      const idsBefore = h.calls.filter(call => call === 'newId').length;
      const button = h.resume()[0].props.onPress, wait = h.holdResume();
      await RTR.act(async () => { button(); button(); });
      assert.equal(h.transport.requests.filter(r => r.body.mode === 'RESUME_PREPARED').length, 1);
      assert.equal(h.resume().length, 0, 'no second action while the command is running');
      await RTR.act(async () => wait.resolve());
      assert.equal(h.journal(), null); assert.equal(h.calls.filter(call => call === 'journalClear').length, 1);
      assert.equal(h.calls.filter(call => call === 'newId').length, idsBefore, 'resume never mints a replacement key');
      assert.equal(h.shell().props.messages.at(-1).body, 'Potvrđen odgovor.');
      assert.equal(h.resume().length, 0);
    } finally { await h.close(); }
  });
  test(`${domain}: refused resume stays visible and retains IDs even after PROCESSING readback`, async () => {
    const h = routeHarness(domain, { refusal: true });
    try {
      await h.mount(); await h.pressResume();
      assert.ok(h.copy().some(copy => /AI trenutno nije dostupan/.test(copy)), JSON.stringify(h.copy()));
      assert.equal(h.journal().clientRequestId, KEY); assert.equal(h.calls.includes('journalClear'), false);
      assert.equal(h.transport.requests.filter(r => r.body.mode === 'RESUME_PREPARED').length, 1);
      await h.check(); assert.equal(h.transport.requests.filter(r => r.body.mode === 'RESUME_PREPARED').length, 1);
      h.state.cancelled = true; await h.check(); assert.equal(h.resume().length, 0);
      assert.equal(h.journal(), null, 'only canonical cancellation retires the pending key');
    } finally { await h.close(); }
  });
  test(`${domain}: canonical success supersedes a lost resume response`, async () => {
    const h = routeHarness(domain, { responseLostAfterSuccess: true });
    try { await h.mount(); await h.pressResume(); assert.equal(h.journal(), null);
      assert.ok(!h.copy().some(copy => /AI trenutno nije dostupan/.test(copy))); assert.equal(h.resume().length, 0);
    } finally { await h.close(); }
  });
  test(`${domain}: voice and background disable the actual action; stale focus/foreground callbacks cannot resume`, async () => {
    const h = routeHarness(domain);
    try {
      await h.mount(); const old = h.resume()[0].props.onPress;
      h.voice.state = { phase: 'RECORDING' }; await h.render(); assert.equal(h.resume()[0].props.disabled, true);
      await RTR.act(async () => old()); assert.equal(h.transport.requests.some(r => r.body.mode === 'RESUME_PREPARED'), false);
      h.voice.state = { phase: 'IDLE' }; await h.render();
      await h.background('background'); assert.ok(!h.resume().length || h.resume()[0].props.disabled);
      await h.background('active'); await RTR.act(async () => old());
      assert.equal(h.transport.requests.some(r => r.body.mode === 'RESUME_PREPARED'), false);
      const beforeBlur = h.resume()[0].props.onPress;
      await h.focus(false); await h.focus(true); await RTR.act(async () => beforeBlur());
      assert.equal(h.transport.requests.some(r => r.body.mode === 'RESUME_PREPARED'), false);
      assert.equal(h.resume().length, 1, 'a fresh focused read restores the current action');
    } finally { await h.close(); }
  });
  test(`${domain}: a late capability cannot survive blur or newer cancelled state`, async () => {
    const h = routeHarness(domain); const wait = h.holdCheck();
    try {
      await h.mount(); await h.focus(false); h.state.cancelled = true; await h.focus(true);
      await RTR.act(async () => wait.resolve()); assert.equal(h.resume().length, 0); assert.equal(h.journal(), null);
      assert.equal(h.transport.requests.some(r => r.body.mode === 'RESUME_PREPARED'), false);
    } finally { await h.close(); }
  });
  test(`${domain}: a captured resume action cannot survive account A to B to A`, async () => {
    const h = routeHarness(domain);
    try {
      await h.mount(); const press = h.resume()[0].props.onPress;
      h.transport.session.user = { id: id(99) }; h.transport.session.accountRevision++;
      h.transport.session.user = { id: ACCOUNT }; h.transport.session.accountRevision++;
      await RTR.act(async () => press());
      assert.equal(h.transport.requests.some(r => r.body.mode === 'RESUME_PREPARED'), false);
      assert.equal(h.journal().clientRequestId, KEY);
    } finally { await h.close(); }
  });
  test(`${domain}: background during resume aborts local painting, retains IDs and requires canonical readback`, async () => {
    const h = routeHarness(domain);
    try {
      await h.mount(); const wait = h.holdResume();
      await RTR.act(async () => h.resume()[0].props.onPress());
      await h.background('background'); await h.background('active');
      await RTR.act(async () => wait.resolve());
      assert.equal(h.journal().clientRequestId, KEY, 'a late transport result cannot retire the journal');
      assert.equal(h.shell().props.streamingText, '');
      assert.equal(h.transport.requests.filter(r => r.body.mode === 'RESUME_PREPARED').length, 1);
      await h.check(); assert.equal(h.journal(), null);
      assert.equal(h.shell().props.messages.at(-1).body, 'Potvrđen odgovor.');
    } finally { await h.close(); }
  });
  test(`${domain}: off/expired/dispatched recovery never exposes the resume button`, async () => {
    for (const options of [{ capability: 'UNAVAILABLE' }, { capability: 'EXPIRED' }, { capability: 'READ_ONLY' },
      { capability: 'ERASED' }, { providerDispatched: true }, { status: 'FAILED' }]) {
      const h = routeHarness(domain, options);
      try { await h.mount(); assert.equal(h.resume().length, 0, JSON.stringify(options));
        assert.ok(h.transport.requests.every(r => r.body.mode === 'CHECK_PREPARED'));
        if (options.providerDispatched || options.status === 'FAILED') assert.equal(h.transport.requests.length, 0);
      } finally { await h.close(); }
    }
  });
}
