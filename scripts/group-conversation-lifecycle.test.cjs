'use strict';
// Mounted production screen, controller and receipt service. Only native hosts,
// AsyncStorage and RPC transport are fixtures. This is not Android/DEV evidence.
const test = require('node:test');
const assert = require('node:assert/strict');
const { React, RTR, createHarness, deferred } = require('./ux-component-harness.cjs');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ACCOUNT = id(1), OTHER = id(2), AGREEMENT = id(3), GROUP = id(4);
const CREATED = '2026-11-10T00:00:00Z';

function harness(options = {}) {
  const session = { user: { id: ACCOUNT }, accountRevision: 1 };
  const state = { agreementId: AGREEMENT, groupId: GROUP, sendWait: null, sendError: false, storageWait: null,
    storageBeforeWait: null, removeBeforeWait: null, removeError: false, draftBeforeWait: null, draftAckBeforeWait: null,
    draftError: false, draftAckError: false, draftReadWait: null, journalError: false, messages: [], receipt: null,
    authWait: null, authError: false, eraseWait: null, eraseError: false, mapCleanupWait: null, contextError: false, readbackError: false,
    closingResult: { ok: true, podatak: { closing: false, execution: null } }, closingWait: null };
  // Command journals and draft payloads occupy separate real key namespaces.
  const calls = [], io = [], stored = options.stored ?? new Map(), drafts = options.drafts ?? new Map(), listeners = new Set(), Focus = React.createContext(true);
  let requestNumber = options.requestStart ?? 5;
  const app = { currentState: options.background ? 'background' : 'active', addEventListener: (_type, fn) => {
    listeners.add(fn); return { remove: () => listeners.delete(fn) };
  } };
  const storage = {
    getItem: async key => { if (key.startsWith('uskoci:group-draft:v1:') && state.draftReadWait) await state.draftReadWait.promise;
      return (key.startsWith('uskoci:group-draft:v1:') ? drafts : stored).get(key) ?? null; },
    setItem: async (key, value) => {
      io.push({ operation: 'set:start', key });
      if (key.startsWith('uskoci:group-draft:v1:')) {
        const acknowledged = JSON.parse(value).capture?.confirmed;
        if (state.draftBeforeWait) await state.draftBeforeWait.promise;
        if (acknowledged && state.draftAckBeforeWait) await state.draftAckBeforeWait.promise;
        if (state.draftError || acknowledged && state.draftAckError) throw Error('DRAFT_DISK_UNAVAILABLE');
        drafts.set(key, value); io.push({ operation: 'set:end', key }); return;
      }
      if (state.storageBeforeWait) await state.storageBeforeWait.promise;
      if (state.journalError) throw Error('JOURNAL_DISK_UNAVAILABLE');
      stored.set(key, value); if (state.storageWait) await state.storageWait.promise; io.push({ operation: 'set:end', key });
    },
    removeItem: async key => {
      io.push({ operation: 'remove:start', key });
      const wait = state.removeBeforeWait; state.removeBeforeWait = null;
      if (wait) await wait.promise;
      if (state.removeError) throw Error('DISK_UNAVAILABLE'); stored.delete(key);
    },
    getAllKeys: async () => [...stored.keys(), ...drafts.keys()],
    multiRemove: async keys => { io.push({ operation: 'erase:start', keys }); if (state.eraseWait) await state.eraseWait.promise;
      if (state.eraseError) throw Error('ERASE_DISK_UNAVAILABLE');
      for (const key of keys) { stored.delete(key); drafts.delete(key); } },
  };
  let service;
  const rpc = async (name, args) => {
    calls.push({ name, args });
    const accountId = args.p_expected_user_id;
    if (name === 'rpc_read_group_context_v5' && state.contextError) throw Error('CONTEXT_OFFLINE');
    if (name === 'rpc_read_group_command_v5' && state.readbackError) throw Error('READBACK_OFFLINE');
    if (name === 'rpc_read_group_context_v5') return { error: null, data: {
      accountId, agreementId: args.p_agreement_id, needId: id(6), available: true, authoritative: true,
      group: { groupId: state.groupId, title: 'Zajednički zadatak', canSend: true, terminal: false,
        role: 'PARTICIPANT', members: [{ accountId, profileId: id(7), displayName: 'Učesnik', role: 'PARTICIPANT' }],
        management: null, managementNextId: null, unreadCount: 0 },
    } };
    if (name === 'rpc_read_group_messages_v5') return { error: null, data: {
      accountId, groupId: args.p_group_id, messages: [...state.messages],
      nextBeforeSequence: null, nextAfterSequence: null, authoritative: true,
    } };
    if (name === 'rpc_read_group_command_v5') return { error: null, data: {
      accountId, groupId: args.p_group_id, clientRequestId: args.p_client_request_id,
      found: state.receipt !== null, receipt: state.receipt, authoritative: true,
    } };
    if (name === 'rpc_send_group_message_v5') {
      if (state.sendWait) await state.sendWait.promise;
      if (state.sendError) throw Error('TRANSPORT_LOST');
      const message = { messageId: id(8), sequence: '1', senderAccountId: accountId,
        body: args.p_body, createdAt: CREATED, mine: true };
      state.messages = [message];
      state.receipt = { accountId, groupId: args.p_group_id, clientRequestId: args.p_client_request_id,
        messageId: message.messageId, sequence: '1', bodySha256: service.groupBodyHash(args.p_body),
        createdAt: CREATED, idempotentReplay: false, authoritative: true };
      return { data: state.receipt, error: null };
    }
    throw Error('UNEXPECTED_RPC_' + name);
  };
  const navigation = [];
  const h = createHarness({
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    'src/store/sesija.ts': { useSesija: () => session, sesijaSada: () => session },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => ({ rpc, auth: {
      getSession: async () => ({ data: { session: { user: session.user } }, error: null }),
      signOut: async () => {
        calls.push({ name: 'auth.signOut' });
        if (!state.authError) { session.user = null; session.accountRevision++; }
        if (state.authWait) await state.authWait.promise;
        return { error: state.authError ? Error('AUTH_SIGNOUT_FAILED') : null };
      },
    } }) },
    'src/data/pushDeviceClientService.ts': { revokePushBeforeLogout: async () => undefined },
    'src/data/confirmedDiscoveryMapPlace.ts': { writeSettledMapPlace: async () => {
      if (state.mapCleanupWait) await state.mapCleanupWait.promise;
    } },
    'src/data/voiceMessagesGate.ts': { voiceMessagesBuilt: () => false },
    'src/data/accountClosingStanding.ts': { readAccountClosingStanding: async () => {
      if (state.closingWait) await state.closingWait.promise; return state.closingResult;
    } },
    'src/ui/closure/closureIntent.ts': { closureIntentJournal: { load: async () => null } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'src/ui/auth/AuthControls.tsx': { PrimaryButton: 'PrimaryButton' },
    'src/lib/idempotencija.ts': { noviUuidZahtevId: () => id(requestNumber++) },
    'expo-router': { useFocusEffect: callback => {
      const focused = React.useContext(Focus);
      React.useEffect(() => focused ? callback() : undefined, [focused, callback]);
    }, router: { push: value => navigation.push(value), replace: value => navigation.push(value),
      back: () => navigation.push('back'), canGoBack: () => true } },
    'src/ui/groups/GroupConversationPresentation.tsx': {
      GroupConversationPresentation: props => React.createElement('GroupConversationPresentation', props),
    },
    'src/ui/groups/ConversationChannels.tsx': { privateConversationChoices: context => [{ id: context.agreementId, name: 'Učesnik' }] },
    'src/ui/media/ContextPhotos.tsx': { ProfilePhoto: 'ProfilePhoto' },
    'src/ui/support/SupportContextEntry.tsx': { SupportContextEntry: 'SupportContextEntry' },
  });
  h.native.AppState = app;
  service = h.load('src/data/groupConversationService.ts');
  const Screen = h.load('src/ui/groups/GroupConversationScreen.tsx').GroupConversationScreen;
  let tree, focused = true;
  const element = () => React.createElement(Focus.Provider, { value: focused },
    React.createElement(Screen, { agreementId: state.agreementId }));
  const props = () => tree.root.findByType('GroupConversationPresentation').props;
  return { state, session, calls, io, stored, drafts, navigation, props, storage, load: h.load,
    count: name => calls.filter(call => call.name === name).length,
    async mount() { await RTR.act(async () => { tree = RTR.create(element()); }); },
    async render() { await RTR.act(async () => tree.update(element())); },
    async focus(value) { focused = value; await this.render(); },
    async activity(value) { await RTR.act(async () => {
      app.currentState = value; for (const listener of [...listeners]) listener(value);
    }); },
    async type(text) { await RTR.act(async () => props().onDraft(text)); },
    async send() { await RTR.act(async () => props().onSend()); },
    async refresh() { await RTR.act(async () => props().onRefresh()); },
    async resolve(wait) { await RTR.act(async () => wait.resolve()); },
    async close() { if (tree) await RTR.act(async () => tree.unmount()); assert.equal(listeners.size, 0); },
  };
}

test('group: repeated active event retains the current conversation and typed draft without extra reads', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Nacrt koji još nije poslat.');
    const generation = h.props().listKey, reads = h.calls.length;
    await h.activity('active'); await h.activity('active');
    assert.equal(h.props().listKey, generation, 'the same foreground must not replace the active owner');
    assert.equal(h.calls.length, reads);
    assert.equal(h.props().draft, 'Nacrt koji još nije poslat.');
    assert.equal(h.props().state.phase, 'READY');
    assert.equal(h.stored.size, 0, 'an unsent draft is not a command');
  } finally { await h.close(); }
});

test('group: an unsent draft survives a cold screen remount without sending or creating a command', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Nacrt sačuvan za kasnije.');
    await h.close(); await h.mount();
    assert.equal(h.props().state.phase, 'READY');
    assert.equal(h.props().draft, 'Nacrt sačuvan za kasnije.');
    assert.equal(h.count('rpc_send_group_message_v5'), 0);
    assert.equal(h.stored.size, 0, 'an unsent draft never invents a send journal');
  } finally { await h.close(); }
});

test('group: invalid text never captures a journal; the editable draft and valid Serbian/emoji text are preserved', async () => {
  const h = harness();
  try {
    await h.mount();
    for (const text of ['Pozdrav\u0000svima', 'Pozdrav\ud800svima', 'Pozdrav\udfffsvima']) {
      await h.type(text); assert.equal(h.props().draftSendable, false);
      await h.send();
      assert.equal(h.props().state.phase, 'READY'); assert.equal(h.props().draft, text);
      assert.equal(h.stored.size, 0); assert.equal(h.count('rpc_send_group_message_v5'), 0);
    }
    await h.type('  Ћао свима! C\u030cujemo se sutra. 👨‍👩‍👧‍👦  ');
    assert.equal(h.props().draftSendable, true); await h.send();
    const sends = h.calls.filter(call => call.name === 'rpc_send_group_message_v5');
    assert.equal(sends.length, 1); assert.equal(sends[0].args.p_body, 'Ћао свима! Čujemo se sutra. 👨‍👩‍👧‍👦');
    assert.equal(h.props().state.phase, 'READY'); assert.equal(h.props().draft, '');
  } finally { await h.close(); }
});

test('group: repeated active during journal persistence does not cancel the admitted send', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Stižem uskoro.');
    h.state.storageWait = deferred(); await h.send();
    assert.equal(h.props().state.phase, 'SENDING');
    assert.equal(h.stored.size, 1);
    await h.activity('active');
    assert.equal(h.props().state.phase, 'SENDING');
    assert.equal(h.props().draft, 'Stižem uskoro.');
    await h.resolve(h.state.storageWait);
    assert.equal(h.count('rpc_send_group_message_v5'), 1);
    assert.equal(h.count('rpc_read_group_command_v5'), 0);
    assert.equal(h.props().state.phase, 'READY');
    assert.equal(h.props().state.messages[0].body, 'Stižem uskoro.');
    assert.equal(h.stored.size, 0);
  } finally { h.state.storageWait?.resolve(); await h.close(); }
});

test('group: repeated active while send response is pending preserves one command and its original text', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Vidimo se u deset.');
    h.state.sendWait = deferred(); await h.send();
    const generation = h.props().listKey;
    await h.activity('active');
    assert.equal(h.props().state.phase, 'SENDING');
    assert.equal(h.props().listKey, generation);
    assert.equal(h.props().draft, 'Vidimo se u deset.');
    assert.equal(h.count('rpc_send_group_message_v5'), 1);
    assert.equal(h.count('rpc_read_group_command_v5'), 0);
    await h.resolve(h.state.sendWait);
    assert.equal(h.props().state.phase, 'READY');
    assert.equal(h.props().draft, '');
    assert.equal(h.props().state.messages.length, 1);
    assert.equal(h.stored.size, 0);
  } finally { h.state.sendWait?.resolve(); await h.close(); }
});

test('group: real background retires late responses and reconciles the same journal on return without resending', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Poslata poruka.');
    h.state.sendWait = deferred(); await h.send();
    const previous = h.props(), generation = previous.listKey;
    await h.activity('inactive'); await h.activity('background');
    assert.equal(h.props().state.context, null); assert.equal(h.props().draft, '');
    await RTR.act(async () => { previous.onSend(); previous.onDraft('Zakašneli unos'); previous.onBack(); });
    await h.resolve(h.state.sendWait);
    assert.equal(h.stored.size, 1, 'an old owner cannot retire the durable command');
    assert.equal(h.props().state.context, null);
    assert.equal(h.count('rpc_send_group_message_v5'), 1); assert.deepEqual(h.navigation, []);
    await h.activity('active');
    assert.equal(h.props().listKey, generation + 1);
    assert.equal(h.count('rpc_read_group_command_v5'), 1);
    assert.equal(h.count('rpc_send_group_message_v5'), 1);
    assert.equal(h.props().state.phase, 'READY');
    assert.equal(h.props().state.messages[0].body, 'Poslata poruka.');
    assert.equal(h.stored.size, 0); assert.equal(h.props().draft, '');
    const reads = h.calls.length;
    await h.activity('active'); assert.equal(h.calls.length, reads);
  } finally { h.state.sendWait?.resolve(); await h.close(); }
});

test('group: real background and in-app Back preserve only the same unsent draft', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Moja sledeća poruka.');
    const old = h.props();
    await h.activity('background');
    await RTR.act(async () => old.onDraft('Nevažeći unos'));
    await h.activity('active'); assert.equal(h.props().draft, 'Moja sledeća poruka.');
    await h.focus(false); await h.focus(true);
    assert.equal(h.props().draft, 'Moja sledeća poruka.');
    assert.equal(h.count('rpc_send_group_message_v5'), 0); assert.equal(h.stored.size, 0);
  } finally { await h.close(); }
});

test('group: warm return retains the exact pending text after an unknown send without automatic resubmission', async () => {
  for (const leave of [h => h.activity('background'), h => h.focus(false)]) {
    const h = harness();
    try {
      await h.mount(); await h.type('  Stižem sa kutijama u deset.  ');
      h.state.sendWait = deferred(); h.state.sendError = true; await h.send();
      const journal = [...h.stored.values()][0];
      await leave(h); await h.resolve(h.state.sendWait);
      await h.activity('active'); await h.focus(true);
      assert.equal(h.props().state.phase, 'UNKNOWN');
      assert.equal(h.props().draft, '  Stižem sa kutijama u deset.  ');
      assert.equal(h.props().state.canRetry, true);
      assert.equal(h.count('rpc_send_group_message_v5'), 1, 'readback never repeats the write');
      assert.equal([...h.stored.values()][0], journal, 'the original command identity is preserved');
      assert.ok(!journal.includes('kutijama'), 'the command journal remains IDs/hash only; text has its separate draft namespace');
      h.state.sendError = false; h.state.sendWait = null;
      await h.send();
      assert.equal(h.count('rpc_send_group_message_v5'), 2, 'only an explicit retry writes');
      const sends = h.calls.filter(call => call.name === 'rpc_send_group_message_v5');
      assert.equal(sends[1].args.p_client_request_id, sends[0].args.p_client_request_id);
      assert.equal(sends[1].args.p_body, sends[0].args.p_body);
      assert.equal(h.props().state.phase, 'READY'); assert.equal(h.props().draft, '');
      await h.activity('background'); await h.activity('active');
      assert.equal(h.props().draft, '', 'confirmed text never reappears as a new draft');
    } finally { h.state.sendWait?.resolve(); await h.close(); }
  }
});

test('group: pending text restores only for the authenticated account and matching command, including a fresh account incarnation', async () => {
  for (const change of ['account', 'session', 'group', 'request', 'body']) {
    const h = harness();
    try {
      await h.mount(); await h.type('Privatna poruka sa nepoznatim ishodom.');
      h.state.sendError = true; await h.send();
      assert.equal(h.props().state.phase, 'UNKNOWN');
      await h.activity('background');
      if (change === 'account' || change === 'session') {
        if (change === 'account') h.session.user = { id: OTHER };
        h.session.accountRevision++;
        await h.render();
      } else if (change === 'group') {
        h.state.groupId = id(44);
      } else {
        const [key, value] = [...h.stored.entries()][0], journal = JSON.parse(value);
        h.stored.set(key, JSON.stringify({ ...journal,
          ...(change === 'request' ? { clientRequestId: id(55) } : { bodySha256: 'a'.repeat(64) }) }));
      }
      await h.activity('active');
      assert.equal(h.props().draft, change === 'session' ? 'Privatna poruka sa nepoznatim ishodom.' : '');
      assert.equal(h.count('rpc_send_group_message_v5'), 1);
    } finally { await h.close(); }
  }
});

test('group: leaving during journal persistence retains text and admits no delayed old-owner write', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Početak je u dvanaest.');
    h.state.storageWait = deferred(); await h.send();
    const journal = [...h.stored.values()][0];
    await h.activity('background'); await h.activity('active');
    assert.equal(h.props().state.phase, 'LOADING', 'visibility alone is not a completed storage operation');
    assert.equal([...h.stored.values()][0], journal);
    await h.resolve(h.state.storageWait); h.state.storageWait = null;
    assert.equal(h.props().state.phase, 'UNKNOWN');
    assert.equal(h.props().draft, 'Početak je u dvanaest.');
    assert.equal([...h.stored.values()][0], journal);
    assert.equal(h.count('rpc_send_group_message_v5'), 0);
    await h.send();
    assert.equal(h.count('rpc_send_group_message_v5'), 1);
    assert.equal(h.props().state.phase, 'READY'); assert.equal(h.props().draft, '');
  } finally { h.state.storageWait?.resolve(); await h.close(); }
});

test('group: returning before a journal write becomes visible waits for its identity instead of admitting a fresh command', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Sačuvajte originalni zahtev.');
    h.state.storageBeforeWait = deferred(); await h.send();
    assert.equal(h.stored.size, 0, 'the delayed disk write is not yet visible');
    assert.equal(h.props().state.phase, 'SENDING');
    await h.activity('background'); await h.activity('active');
    assert.equal(h.props().state.phase, 'LOADING', 'a replacement owner waits for the in-flight journal write');
    await h.send(); assert.equal(h.count('rpc_send_group_message_v5'), 0);
    await h.resolve(h.state.storageBeforeWait); h.state.storageBeforeWait = null;
    assert.equal(h.props().state.phase, 'UNKNOWN');
    assert.equal(h.props().draft, 'Sačuvajte originalni zahtev.');
    assert.equal(h.count('rpc_send_group_message_v5'), 0, 'the retired owner never dispatches');
    const journal = JSON.parse([...h.stored.values()][0]);
    await h.send();
    const sends = h.calls.filter(call => call.name === 'rpc_send_group_message_v5');
    assert.equal(sends.length, 1); assert.equal(sends[0].args.p_client_request_id, journal.clientRequestId);
    assert.equal(sends[0].args.p_body, 'Sačuvajte originalni zahtev.');
    assert.equal(h.props().state.phase, 'READY'); assert.equal(h.stored.size, 0);
  } finally { h.state.storageBeforeWait?.resolve(); await h.close(); }
});

test('group: delayed confirmed cleanup cannot erase a replacement owner\'s next command', async () => {
  const h = harness(); let cleanup;
  try {
    await h.mount(); await h.type('Prvobitna poruka.'); h.state.sendError = true; await h.send(); await h.refresh();
    await h.type('Druga, još neposlata poruka.');
    const journal = JSON.parse([...h.stored.values()][0]);
    h.state.receipt = { accountId: ACCOUNT, groupId: GROUP, clientRequestId: journal.clientRequestId,
      messageId: id(8), sequence: '1', bodySha256: journal.bodySha256,
      createdAt: CREATED, idempotentReplay: false, authoritative: true };
    cleanup = deferred(); h.state.removeBeforeWait = cleanup; await h.refresh();
    assert.equal(h.props().state.phase, 'CONFIRMED');
    await h.activity('background'); await h.activity('active');
    assert.equal(h.props().state.phase, 'LOADING', 'a new owner cannot overtake old confirmed cleanup');
    assert.equal(h.count('rpc_send_group_message_v5'), 1);
    await h.resolve(cleanup);
    assert.equal(h.props().state.phase, 'READY');
    assert.equal(h.props().draft, 'Druga, još neposlata poruka.');
    assert.equal(h.stored.size, 0);
    h.state.sendError = false; h.state.sendWait = deferred(); await h.send();
    const nextJournal = JSON.parse([...h.stored.values()][0]);
    assert.notEqual(nextJournal.clientRequestId, journal.clientRequestId);
    assert.equal(h.props().state.phase, 'SENDING');
    await h.activity('background'); await h.resolve(h.state.sendWait); await h.activity('active');
    assert.equal(h.props().state.phase, 'READY');
    assert.equal(h.props().draft, ''); assert.equal(h.stored.size, 0);
    assert.equal(h.count('rpc_send_group_message_v5'), 2);
  } finally { cleanup?.resolve(); h.state.sendWait?.resolve(); await h.close(); }
});

test('group: failed delayed storage releases recovery without a send or lost draft', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Nacrt ostaje kod Vas.');
    h.state.storageBeforeWait = deferred(); await h.send();
    await h.activity('background'); await h.activity('active');
    assert.equal(h.props().state.phase, 'LOADING');
    await RTR.act(async () => h.state.storageBeforeWait.reject(Error('DISK_UNAVAILABLE')));
    h.state.storageBeforeWait = null;
    assert.equal(h.props().state.phase, 'ERROR'); assert.equal(h.stored.size, 0);
    const capture = JSON.parse([...h.drafts.values()][0]).capture;
    await h.refresh();
    assert.equal(h.props().state.phase, 'UNKNOWN');
    assert.equal(JSON.parse([...h.stored.values()][0]).clientRequestId, capture.clientRequestId);
    assert.equal(h.props().draft, 'Nacrt ostaje kod Vas.');
    assert.equal(h.count('rpc_send_group_message_v5'), 0);
    await h.send(); assert.equal(h.count('rpc_send_group_message_v5'), 1);
    assert.equal(h.props().draft, ''); assert.equal(h.props().state.phase, 'READY');
  } finally { h.state.storageBeforeWait?.resolve(); await h.close(); }
});

test('group: a delayed journal of account A never blocks or supplies text to account B', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Privatni tekst prvog naloga.');
    h.state.storageBeforeWait = deferred(); await h.send();
    await h.activity('background'); h.session.user = { id: OTHER }; h.session.accountRevision++;
    await h.render(); await h.activity('active');
    assert.equal(h.props().state.phase, 'READY'); assert.equal(h.props().draft, '');
    assert.equal(h.props().state.context.accountId, OTHER);
    await h.resolve(h.state.storageBeforeWait); h.state.storageBeforeWait = null;
    assert.equal(h.props().state.phase, 'READY'); assert.equal(h.props().draft, '');
    assert.equal(h.count('rpc_send_group_message_v5'), 0);
    assert.equal(h.count('rpc_read_group_command_v5'), 0);
    assert.ok([...h.stored.keys()].every(key => key.includes(ACCOUNT)));
  } finally { h.state.storageBeforeWait?.resolve(); await h.close(); }
});

test('group: explicit saved-message retry keeps a newer draft and cannot change the original payload', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Prvobitna poruka.'); h.state.sendError = true; await h.send();
    await h.activity('background'); await h.activity('active');
    await h.type('Izmenjen neposlat unos.');
    await h.activity('background'); await h.activity('active');
    assert.equal(h.props().draft, 'Izmenjen neposlat unos.');
    assert.equal(h.props().retryBody, 'Prvobitna poruka.'); assert.equal(h.props().newerDraft, true);
    await h.send();
    const sends = h.calls.filter(call => call.name === 'rpc_send_group_message_v5');
    assert.equal(sends.length, 2);
    assert.equal(sends[1].args.p_body, sends[0].args.p_body);
    assert.equal(sends[1].args.p_client_request_id, sends[0].args.p_client_request_id);
    assert.equal(h.props().state.phase, 'UNKNOWN');
    assert.equal(h.props().draft, 'Izmenjen neposlat unos.');
  } finally { await h.close(); }
});

test('group: confirming the old command preserves a different newer draft without reusing its identity', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Prvobitna poruka.'); h.state.sendError = true; await h.send();
    await h.refresh();
    await h.type('Druga, još neposlata poruka.');
    const journal = JSON.parse([...h.stored.values()][0]);
    h.state.messages = [{ messageId: id(8), sequence: '1', senderAccountId: ACCOUNT,
      body: 'Prvobitna poruka.', createdAt: CREATED, mine: true }];
    h.state.receipt = { accountId: ACCOUNT, groupId: GROUP, clientRequestId: journal.clientRequestId,
      messageId: id(8), sequence: '1', bodySha256: journal.bodySha256,
      createdAt: CREATED, idempotentReplay: false, authoritative: true };
    await h.refresh();
    assert.equal(h.props().state.phase, 'READY');
    assert.equal(h.props().draft, 'Druga, još neposlata poruka.');
    assert.equal(h.stored.size, 0);
    assert.equal(h.count('rpc_send_group_message_v5'), 1);
    await h.activity('background'); await h.activity('active');
    assert.equal(h.props().draft, 'Druga, još neposlata poruka.');
    h.state.sendError = false; await h.send();
    const sends = h.calls.filter(call => call.name === 'rpc_send_group_message_v5');
    assert.equal(sends.length, 2);
    assert.notEqual(sends[1].args.p_client_request_id, sends[0].args.p_client_request_id);
    assert.equal(sends[1].args.p_body, 'Druga, još neposlata poruka.');
    assert.equal(h.props().draft, '');
  } finally { await h.close(); }
});

test('group: a newer draft survives a confirmed old journal cleanup failure and gets a new identity only after retirement', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Prvobitna poruka.'); h.state.sendError = true; await h.send(); await h.refresh();
    await h.type('Druga, još neposlata poruka.');
    const journal = JSON.parse([...h.stored.values()][0]);
    h.state.messages = [{ messageId: id(8), sequence: '1', senderAccountId: ACCOUNT,
      body: 'Prvobitna poruka.', createdAt: CREATED, mine: true }];
    h.state.receipt = { accountId: ACCOUNT, groupId: GROUP, clientRequestId: journal.clientRequestId,
      messageId: id(8), sequence: '1', bodySha256: journal.bodySha256,
      createdAt: CREATED, idempotentReplay: false, authoritative: true };
    h.state.removeError = true; await h.refresh();
    assert.equal(h.props().state.phase, 'CONFIRMED'); assert.equal(h.stored.size, 1);
    assert.equal(h.props().draft, 'Druga, još neposlata poruka.');
    await h.activity('background'); await h.activity('active');
    assert.equal(h.props().state.phase, 'CONFIRMED');
    assert.equal(h.props().draft, 'Druga, još neposlata poruka.');
    assert.equal(h.count('rpc_send_group_message_v5'), 1);
    h.state.removeError = false;
    await RTR.act(async () => h.props().onAcknowledge());
    assert.equal(h.props().state.phase, 'READY'); assert.equal(h.stored.size, 0);
    assert.equal(h.props().draft, 'Druga, još neposlata poruka.');
    h.state.sendError = false; await h.send();
    const sends = h.calls.filter(call => call.name === 'rpc_send_group_message_v5');
    assert.equal(sends.length, 2);
    assert.notEqual(sends[1].args.p_client_request_id, journal.clientRequestId);
    assert.equal(sends[1].args.p_body, 'Druga, još neposlata poruka.');
    assert.equal(h.props().draft, '');
  } finally { await h.close(); }
});

test('group: confirmed recovery isolates accounts while allowing the same account to restore its durable newer draft', async () => {
  for (const change of ['account', 'session']) {
    const h = harness();
    try {
      await h.mount(); await h.type('Prvobitna poruka.'); h.state.sendError = true; await h.send(); await h.refresh();
      await h.type('Privatna nova poruka.');
      const journal = JSON.parse([...h.stored.values()][0]);
      h.state.receipt = { accountId: ACCOUNT, groupId: GROUP, clientRequestId: journal.clientRequestId,
        messageId: id(8), sequence: '1', bodySha256: journal.bodySha256,
        createdAt: CREATED, idempotentReplay: false, authoritative: true };
      h.state.removeError = true; await h.refresh();
      assert.equal(h.props().state.phase, 'CONFIRMED');
      await h.activity('background');
      if (change === 'account') h.session.user = { id: OTHER };
      h.session.accountRevision++; await h.render(); await h.activity('active');
      assert.equal(h.props().draft, change === 'session' ? 'Privatna nova poruka.' : '');
      assert.equal(h.count('rpc_send_group_message_v5'), 1);
    } finally { await h.close(); }
  }
});

test('group: account or group changes never restore a foreign draft or admit a captured action', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Privatni nacrt prvog naloga.'); const old = h.props();
    h.session.user = { id: OTHER }; h.session.accountRevision++;
    await h.render(); assert.equal(h.props().draft, '');
    await RTR.act(async () => { old.onSend(); old.onDraft('Zakašnjeli unos'); old.onBack(); });
    assert.equal(h.count('rpc_send_group_message_v5'), 0); assert.deepEqual(h.navigation, []);
    await h.type('Nacrt druge grupe.');
    h.state.agreementId = id(31); h.state.groupId = id(41); await h.render();
    assert.equal(h.props().draft, '');
    assert.equal(h.props().state.context.group.groupId, id(41));
    assert.equal(h.stored.size, 0);
  } finally { await h.close(); }
});

test('group: opening in background performs no reads before one actual foreground transition', async () => {
  const h = harness({ background: true });
  try {
    await h.mount(); assert.equal(h.calls.length, 0);
    await h.activity('background'); assert.equal(h.calls.length, 0);
    await h.activity('active'); assert.equal(h.props().state.phase, 'READY');
    assert.equal(h.count('rpc_read_group_context_v5'), 1); assert.equal(h.count('rpc_read_group_messages_v5'), 1);
    await h.activity('active'); assert.equal(h.count('rpc_read_group_context_v5'), 1);
    assert.equal(h.count('rpc_send_group_message_v5'), 0);
  } finally { await h.close(); }
});

// Each second harness has fresh production module state. Only disk and the
// explicit server fixture survive; this is a cold-process simulation, not adb.
test('group durable draft: cold restart preserves both original pending payload and the newer SENDING edit', async () => {
  const first = harness(); let cold;
  try {
    await first.mount(); await first.type('Prva poruka sa kutijama.');
    first.state.sendWait = deferred(); first.state.sendError = true; await first.send();
    assert.equal(first.props().state.phase, 'SENDING'); assert.equal(first.props().draftEditable, true);
    const command = JSON.parse([...first.stored.values()][0]);
    await first.type('Druga poruka sa ključevima.'); await first.send();
    assert.equal(first.count('rpc_send_group_message_v5'), 1, 'typing while pending does not admit another send');
    const saved = JSON.parse([...first.drafts.values()][0]);
    assert.equal(saved.capture.body, 'Prva poruka sa kutijama.'); assert.equal(saved.text, 'Druga poruka sa ključevima.');
    await first.close(); await first.resolve(first.state.sendWait);
    cold = harness({ stored: first.stored, drafts: first.drafts, requestStart: 50 }); await cold.mount();
    assert.equal(cold.props().state.phase, 'UNKNOWN'); assert.equal(cold.props().draft, saved.text);
    assert.equal(cold.props().retryBody, saved.capture.body); assert.equal(cold.props().newerDraft, true);
    assert.equal(cold.count('rpc_send_group_message_v5'), 0, 'cold recovery only reads');
    await cold.send();
    const replay = cold.calls.find(call => call.name === 'rpc_send_group_message_v5').args;
    assert.equal(replay.p_client_request_id, command.clientRequestId); assert.equal(replay.p_body, saved.capture.body);
    assert.equal(cold.props().draft, saved.text); assert.equal(cold.stored.size, 0);
    await cold.send();
    const next = cold.calls.filter(call => call.name === 'rpc_send_group_message_v5')[1].args;
    assert.notEqual(next.p_client_request_id, command.clientRequestId); assert.equal(next.p_body, saved.text);
  } finally { first.state.sendWait?.resolve(); await first.close(); if (cold) await cold.close(); }
});

test('group durable draft: input waits for durable capture, then an identically retyped newer revision survives the old ACK', async () => {
  const h = harness(); let cold;
  try {
    await h.mount(); await h.type('Isti tekst, nova namera.');
    h.state.storageBeforeWait = deferred(); h.state.sendWait = deferred(); await h.send();
    assert.equal(h.props().draftEditable, false, 'initial capture owns the original field until its journal is durable');
    await h.type('Prerani unos'); assert.equal(h.props().draft, 'Isti tekst, nova namera.');
    await h.resolve(h.state.storageBeforeWait); h.state.storageBeforeWait = null;
    assert.equal(h.props().draftEditable, true);
    await h.type('Privremena izmena.'); await h.type('Isti tekst, nova namera.');
    const before = JSON.parse([...h.drafts.values()][0]); assert.ok(before.revision > before.capture.draftRevision);
    await h.resolve(h.state.sendWait);
    assert.equal(h.props().state.phase, 'READY'); assert.equal(h.props().draft, 'Isti tekst, nova namera.');
    assert.equal(h.count('rpc_send_group_message_v5'), 1); assert.equal(h.stored.size, 0);
    const after = JSON.parse([...h.drafts.values()][0]); assert.equal(after.capture.confirmed, true); assert.equal(after.capture.body, null);
    await h.close(); cold = harness({ stored: h.stored, drafts: h.drafts, requestStart: 50 }); await cold.mount();
    assert.equal(cold.props().draft, 'Isti tekst, nova namera.'); assert.equal(cold.count('rpc_send_group_message_v5'), 0);
  } finally { h.state.storageBeforeWait?.resolve(); h.state.sendWait?.resolve(); await h.close(); if (cold) await cold.close(); }
});

test('group: a new identical draft revision survives readback of an older unknown send', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Isti tekst u novoj poruci.'); h.state.sendError = true; await h.send(); await h.refresh();
    await h.type('Privremeno drugačiji unos.'); await h.type('Isti tekst u novoj poruci.');
    const command = JSON.parse([...h.stored.values()][0]);
    h.state.receipt = { accountId: ACCOUNT, groupId: GROUP, clientRequestId: command.clientRequestId,
      messageId: id(8), sequence: '1', bodySha256: command.bodySha256, createdAt: CREATED, idempotentReplay: false, authoritative: true };
    await h.refresh();
    assert.equal(h.props().state.phase, 'READY'); assert.equal(h.props().draft, 'Isti tekst u novoj poruci.');
    assert.equal(h.count('rpc_send_group_message_v5'), 1); assert.equal(h.stored.size, 0);
  } finally { await h.close(); }
});

test('group durable draft: crash after capture but before command journal reconstructs only the original identity', async () => {
  const first = harness(); let cold;
  try {
    await first.mount(); await first.type('Sačuvani zahtev pre prekida.'); first.state.journalError = true; await first.send();
    assert.equal(first.props().state.phase, 'ERROR'); assert.equal(first.stored.size, 0); assert.equal(first.count('rpc_send_group_message_v5'), 0);
    const capture = JSON.parse([...first.drafts.values()][0]).capture; assert.equal(capture.confirmed, false);
    await first.close(); cold = harness({ stored: first.stored, drafts: first.drafts, requestStart: 50 }); await cold.mount();
    const journal = JSON.parse([...cold.stored.values()][0]);
    assert.deepEqual(Object.keys(journal).sort(), ['bodySha256', 'clientRequestId', 'groupId', 'version']);
    assert.equal(journal.clientRequestId, capture.clientRequestId); assert.equal(journal.bodySha256, capture.bodySha256);
    assert.equal(cold.props().state.phase, 'UNKNOWN'); assert.equal(cold.count('rpc_send_group_message_v5'), 0);
    await cold.send(); const send = cold.calls.find(call => call.name === 'rpc_send_group_message_v5');
    assert.equal(send.args.p_client_request_id, capture.clientRequestId); assert.equal(send.args.p_body, capture.body);
  } finally { await first.close(); if (cold) await cold.close(); }
});

test('group durable draft: ACK disk failure retains the journal across cold restart and never converts confirmed text into a new send', async () => {
  const first = harness(); let cold;
  try {
    await first.mount(); await first.type('Potvrđeni tekst ostaje vezan za zahtev.'); first.state.draftAckError = true; await first.send();
    assert.equal(first.props().state.phase, 'CONFIRMED'); assert.equal(first.stored.size, 1);
    assert.equal(first.io.filter(op => op.operation === 'remove:start').length, 0, 'journal cleanup cannot precede durable ACK reconciliation');
    assert.equal(JSON.parse([...first.drafts.values()][0]).capture.confirmed, false);
    await first.close(); cold = harness({ stored: first.stored, drafts: first.drafts });
    cold.state.receipt = first.state.receipt; cold.state.messages = first.state.messages; cold.state.draftAckError = true; await cold.mount();
    assert.equal(cold.props().state.phase, 'CONFIRMED'); await cold.send();
    assert.equal(cold.count('rpc_send_group_message_v5'), 0); assert.equal(cold.stored.size, 1);
    cold.state.draftAckError = false; await RTR.act(async () => cold.props().onAcknowledge());
    assert.equal(cold.props().state.phase, 'READY'); assert.equal(cold.props().draft, ''); assert.equal(cold.stored.size, 0);
    const marker = JSON.parse([...cold.drafts.values()][0]).capture; assert.equal(marker.confirmed, true); assert.equal(marker.body, null);
    await cold.close(); await cold.mount(); assert.equal(cold.props().draft, ''); assert.equal(cold.count('rpc_send_group_message_v5'), 0);
  } finally { await first.close(); if (cold) await cold.close(); }
});

test('group durable draft: delayed ACK write keeps its command and cannot erase a newer edit made during reconciliation', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Prva potvrđena poruka.'); h.state.draftAckBeforeWait = deferred(); await h.send();
    assert.equal(h.props().state.phase, 'CONFIRMED'); assert.equal(h.stored.size, 1);
    assert.equal(h.io.filter(op => op.operation === 'remove:start').length, 0);
    await h.type('Unos za narednu poruku.');
    await h.activity('background'); await h.activity('active');
    assert.equal(h.props().state.phase, 'LOADING');
    await h.resolve(h.state.draftAckBeforeWait); h.state.draftAckBeforeWait = null;
    assert.equal(h.props().state.phase, 'READY'); assert.equal(h.props().draft, 'Unos za narednu poruku.');
    assert.equal(h.count('rpc_send_group_message_v5'), 1); assert.equal(h.stored.size, 0);
  } finally { h.state.draftAckBeforeWait?.resolve(); await h.close(); }
});

test('group durable draft: confirmed marker forbids retry when a leftover journal has no current server readback', async () => {
  const first = harness(); let cold;
  try {
    await first.mount(); await first.type('Već potvrđena poruka.'); first.state.removeError = true; await first.send();
    assert.equal(first.props().state.phase, 'CONFIRMED'); assert.equal(JSON.parse([...first.drafts.values()][0]).capture.confirmed, true);
    await first.close(); cold = harness({ stored: first.stored, drafts: first.drafts }); await cold.mount();
    assert.equal(cold.props().state.phase, 'UNKNOWN'); assert.equal(cold.props().state.canRetry, false);
    await cold.type('Već potvrđena poruka.'); await cold.send();
    assert.equal(cold.count('rpc_send_group_message_v5'), 0); assert.equal(cold.stored.size, 1);
    assert.equal(JSON.parse([...cold.drafts.values()][0]).capture.confirmed, true);
    const draft = cold.load('src/data/groupConversationDraft.ts').createGroupConversationDraft({
      accountId: ACCOUNT, agreementId: AGREEMENT, storage: cold.storage, owns: () => true });
    draft.activate(); await draft.load(GROUP);
    const journal = JSON.parse([...cold.stored.values()][0]);
    await assert.rejects(draft.capture(journal, 'Već potvrđena poruka.'), /GROUP_DRAFT_ALREADY_CONFIRMED/); draft.dispose();
  } finally { await first.close(); if (cold) await cold.close(); }
});

test('group durable draft: local save retry preserves editable text and makes cold recovery possible without any send', async () => {
  const first = harness(); let cold;
  try {
    await first.mount(); first.state.draftError = true; await first.type('Nacrt tokom greške diska.');
    assert.equal(first.props().state.phase, 'READY'); assert.equal(first.props().draft, 'Nacrt tokom greške diska.');
    assert.ok(first.props().draftError); assert.equal(first.props().draftSaving, false); assert.equal(first.drafts.size, 0);
    first.state.draftError = false; await RTR.act(async () => first.props().onSaveDraft());
    assert.equal(first.props().draftError, null); assert.equal(first.count('rpc_send_group_message_v5'), 0); assert.equal(first.stored.size, 0);
    await first.close(); cold = harness({ stored: first.stored, drafts: first.drafts }); await cold.mount();
    assert.equal(cold.props().draft, 'Nacrt tokom greške diska.'); assert.equal(cold.count('rpc_send_group_message_v5'), 0);
  } finally { await first.close(); if (cold) await cold.close(); }
});

const draftKey = (accountId = ACCOUNT, agreementId = AGREEMENT, groupId = GROUP) => `uskoci:group-draft:v1:${accountId}:${agreementId}:${groupId}`;
const draftRow = (patch = {}) => ({ version: 1, accountId: ACCOUNT, agreementId: AGREEMENT, groupId: GROUP,
  revision: 1, text: 'Lični nacrt.', capture: null, ...patch });
function modelFor(h, accountId = h.session.user.id, agreementId = AGREEMENT) {
  const revision = h.session.accountRevision;
  const model = h.load('src/data/groupConversationDraft.ts').createGroupConversationDraft({ accountId, agreementId, storage: h.storage,
    owns: () => h.session.user?.id === accountId && h.session.accountRevision === revision });
  model.activate(); return model;
}

test('group durable draft: account switch fences late writes and callbacks without letting another account see the text', async () => {
  const h = harness(); let pending;
  try {
    await h.mount(); pending = deferred(); h.state.draftBeforeWait = pending;
    await h.type('Tekst naloga A pre promene.'); const old = h.props();
    assert.equal(h.drafts.size, 0);
    h.session.user = { id: OTHER }; h.session.accountRevision++; await h.render();
    assert.equal(h.props().state.phase, 'READY'); assert.equal(h.props().draft, '');
    h.state.draftBeforeWait = null; await h.type('Sopstveni tekst naloga B.');
    await RTR.act(async () => { old.onDraft('Zakašnjeli unos starog A.'); old.onSaveDraft(); });
    h.session.user = { id: ACCOUNT }; h.session.accountRevision++; await h.render();
    assert.equal(h.props().state.phase, 'LOADING', 'the new A reader waits for a previously admitted native write');
    await h.resolve(pending);
    assert.equal(h.props().draft, 'Tekst naloga A pre promene.');
    await h.type('Novi unos naloga A.');
    assert.equal(JSON.parse(h.drafts.get(draftKey())).text, 'Novi unos naloga A.');
    assert.equal(JSON.parse(h.drafts.get(draftKey(OTHER))).text, 'Sopstveni tekst naloga B.');
    assert.equal(h.count('rpc_send_group_message_v5'), 0);
  } finally { pending?.resolve(); await h.close(); }
});

test('group durable draft: explicit logout waits for admitted writes, erases only its draft namespace and cannot be rewritten by old callbacks', async () => {
  const h = harness(); let pending, logout;
  try {
    await h.mount(); h.drafts.set(draftKey(OTHER), JSON.stringify(draftRow({ accountId: OTHER, text: 'Privatni tekst B.' })));
    await h.type('Prva nepotvrđena poruka.'); h.state.sendError = true; await h.send();
    const command = [...h.stored.values()][0]; pending = deferred(); h.state.draftBeforeWait = pending;
    await h.type('Noviji unos koji odlazi sa nalogom.'); const old = h.props();
    const auth = h.load('src/data/authClientService.ts').authClientService;
    await RTR.act(async () => { logout = auth.signOutLocal({ accountId: ACCOUNT, accountRevision: 1 }); });
    assert.equal(h.session.user, null); assert.equal(h.io.filter(op => op.operation === 'erase:start').length, 0);
    await RTR.act(async () => { old.onDraft('Zakasneli pokušaj.'); old.onSaveDraft(); });
    await h.resolve(pending); await logout;
    assert.equal(h.drafts.has(draftKey()), false); assert.equal(h.drafts.has(draftKey(OTHER)), true);
    assert.equal([...h.stored.values()][0], command, 'the four-field idempotency journal does not hold text and remains intact');
    h.session.user = { id: ACCOUNT }; h.session.accountRevision++; h.state.draftBeforeWait = null; await h.render();
    assert.equal(h.props().draft, ''); assert.equal(h.props().retryBody, undefined);
    assert.equal(h.count('rpc_send_group_message_v5'), 1);
  } finally { pending?.resolve(); if (logout) await logout; await h.close(); }
});

test('group durable draft: a late old logout cannot erase or retire a newer login of the same account', async () => {
  const h = harness(); let logout;
  try {
    await h.mount(); await h.type('Nacrt pre izričite odjave.');
    h.state.authWait = deferred(); h.state.mapCleanupWait = deferred();
    const auth = h.load('src/data/authClientService.ts').authClientService;
    await RTR.act(async () => { logout = auth.signOutLocal({ accountId: ACCOUNT, accountRevision: 1 }); });
    assert.equal(h.count('auth.signOut'), 1); assert.equal(h.session.user, null);
    h.session.user = { id: ACCOUNT }; h.session.accountRevision++; await h.render();
    assert.equal(h.props().state.phase, 'LOADING', 'a new same-UID reader waits for the captured logout boundary');
    await h.resolve(h.state.authWait);
    assert.equal(h.props().state.phase, 'READY'); assert.equal(h.props().draft, '');
    await h.type('Novi nacrt posle nove prijave.');
    await h.resolve(h.state.mapCleanupWait); await logout;
    assert.equal(h.props().draft, 'Novi nacrt posle nove prijave.');
    assert.equal(JSON.parse(h.drafts.get(draftKey())).text, 'Novi nacrt posle nove prijave.');
    await h.type('I sledeća izmena radi.'); assert.equal(JSON.parse(h.drafts.get(draftKey())).text, 'I sledeća izmena radi.');
  } finally { h.state.authWait?.resolve(); h.state.mapCleanupWait?.resolve(); if (logout) await logout; await h.close(); }
});

test('group durable draft: rejected Auth logout cancels the reserved erasure and releases ordinary save operations', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Nacrt ostaje dok je nalog prijavljen.'); h.state.authError = true;
    const auth = h.load('src/data/authClientService.ts').authClientService;
    await assert.rejects(auth.signOutLocal({ accountId: ACCOUNT, accountRevision: 1 }), /AUTH_SIGNOUT_FAILED/);
    assert.equal(h.session.user.id, ACCOUNT); assert.equal(h.drafts.size, 1);
    await h.type('Unos posle neuspele odjave.');
    assert.equal(JSON.parse(h.drafts.get(draftKey())).text, 'Unos posle neuspele odjave.');
    assert.equal(h.io.filter(op => op.operation === 'erase:start').length, 0);
  } finally { await h.close(); }
});

test('group durable draft: corrupt or foreign records and confirmed-command mismatches fail closed without deleting their evidence', async () => {
  const bodies = [
    '{broken', JSON.stringify(draftRow({ accountId: OTHER })), JSON.stringify(draftRow({ agreementId: id(33) })),
    JSON.stringify(draftRow({ groupId: id(44) })), JSON.stringify(draftRow({ revision: -1 })),
    JSON.stringify({ ...draftRow(), unrecognized: true }),
    JSON.stringify(draftRow({ capture: { clientRequestId: id(5), bodySha256: '0'.repeat(64), draftRevision: 1, confirmed: false, body: 'Pogrešan otisak.' } })),
    JSON.stringify(draftRow({ capture: { clientRequestId: id(5), bodySha256: '0'.repeat(64), draftRevision: 1, confirmed: true, body: 'Potvrđeni tekst ne ostaje u capture-u.' } })),
  ];
  for (const body of bodies) {
    const h = harness({ drafts: new Map([[draftKey(), body]]) });
    try { await h.mount(); assert.equal(h.props().state.phase, 'ERROR'); assert.equal(h.props().draft, '');
      await h.send(); assert.equal(h.count('rpc_send_group_message_v5'), 0); assert.equal(h.drafts.get(draftKey()), body);
    } finally { await h.close(); }
  }
  for (const confirmed of [false, true]) {
    const h = harness(), hash = h.load('src/data/groupConversationService.ts').groupBodyHash('Lični nacrt.');
    h.drafts.set(draftKey(), JSON.stringify(draftRow({ capture: { clientRequestId: id(5), bodySha256: hash,
      draftRevision: 1, confirmed, body: confirmed ? null : 'Lični nacrt.' } })));
    h.stored.set(`uskoci:group-message:v5:${ACCOUNT}:${AGREEMENT}`, JSON.stringify({ version: 1, groupId: GROUP, clientRequestId: id(55), bodySha256: hash }));
    try { await h.mount(); assert.equal(h.props().state.phase, 'ERROR'); assert.equal(h.props().state.canRetry, false);
      assert.equal(h.props().draft, ''); await h.send(); assert.equal(h.count('rpc_send_group_message_v5'), 0); assert.equal(h.drafts.size, 1);
    } finally { await h.close(); }
  }
});

test('group durable draft: offline context never exposes stored text, and unknown readback never automatically resends it', async () => {
  const first = harness(); let cold;
  try {
    await first.mount(); await first.type('Original koji još nema potvrdu.'); first.state.sendError = true; await first.send();
    await first.type('Naredni nacrt.'); await first.close();
    cold = harness({ stored: first.stored, drafts: first.drafts }); cold.state.contextError = true; await cold.mount();
    assert.equal(cold.props().state.phase, 'UNKNOWN'); assert.equal(cold.props().state.context, null); assert.equal(cold.props().draft, '');
    cold.state.contextError = false; cold.state.readbackError = true; await cold.refresh();
    assert.equal(cold.props().state.phase, 'UNKNOWN'); assert.equal(cold.props().state.canRetry, false);
    assert.equal(cold.props().draft, 'Naredni nacrt.'); await cold.type('Nacrt može da se dopuni tokom provere.'); await cold.send();
    assert.equal(cold.count('rpc_send_group_message_v5'), 0);
    cold.state.readbackError = false; await cold.refresh(); assert.equal(cold.props().state.canRetry, true);
    assert.equal(cold.props().retryBody, 'Original koji još nema potvrdu.'); assert.equal(cold.count('rpc_send_group_message_v5'), 0);
  } finally { await first.close(); if (cold) await cold.close(); }
});

test('group durable draft: late disk read preserves a newer local edit and a stale instance cannot overwrite a later durable revision', async () => {
  const h = harness(), first = modelFor(h); let second, readWait;
  try {
    await first.load(GROUP); first.change('Prva verzija.'); await first.flush();
    readWait = deferred(); h.state.draftReadWait = readWait; const loading = first.load(GROUP);
    first.change('Noviji lokalni unos.'); h.state.draftReadWait = null; readWait.resolve(); await loading; await first.flush();
    assert.equal(first.getSnapshot().text, 'Noviji lokalni unos.');
    second = modelFor(h); await second.load(GROUP); second.change('Još noviji vlasnik.'); await second.flush();
    first.change('Zakašnjeli stari vlasnik.'); await assert.rejects(first.flush(), /GROUP_DRAFT_CHANGED/);
    assert.equal(first.getSnapshot().text, 'Zakašnjeli stari vlasnik.', 'failed overwrite keeps its own RAM text for recovery');
    assert.ok(first.getSnapshot().error); assert.equal(JSON.parse(h.drafts.get(draftKey())).text, 'Još noviji vlasnik.');
  } finally { readWait?.resolve(); first.dispose(); second?.dispose(); }
});

test('group durable draft: authoritative CLOSED retires mounted writers before disk erasure and preserves another account', async () => {
  const h = harness(), draft = modelFor(h); let tree, pending;
  const useClosing = h.load('src/ui/auth/AccountClosingState.tsx').useAccountClosing;
  function Probe() { return React.createElement('ClosingProbe', useClosing({ accountId: ACCOUNT, accountRevision: 1 })); }
  try {
    await draft.load(GROUP); draft.change('Nacrt naloga koji se zatvara.'); await draft.flush();
    h.drafts.set(draftKey(OTHER), JSON.stringify(draftRow({ accountId: OTHER, text: 'Tuđi nacrt ostaje.' })));
    await RTR.act(async () => { tree = RTR.create(React.createElement(Probe)); });
    pending = deferred(); h.state.draftBeforeWait = pending; draft.change('Već započeti lokalni upis.');
    await new Promise(resolve => setImmediate(resolve));
    h.state.closingResult = { ok: true, podatak: { closing: true, execution: { state: 'CLOSED', authoritative: true, accountId: ACCOUNT } } };
    await RTR.act(async () => tree.root.findByType('ClosingProbe').props.check());
    assert.equal(tree.root.findByType('ClosingProbe').props.closing, true);
    assert.equal(draft.getSnapshot().loaded, false, 'the screen below the overlay is retired even while the session identity is unchanged');
    draft.change('Ne sme ponovo da nastane.'); assert.equal(draft.getSnapshot().text, '');
    assert.equal(h.io.filter(op => op.operation === 'erase:start').length, 0, 'purge waits for accepted native writes');
    await RTR.act(async () => pending.resolve());
    assert.equal(h.drafts.has(draftKey()), false); assert.equal(h.drafts.has(draftKey(OTHER)), true);
    draft.change('Još jedan zakašnjeli pokušaj.'); await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.drafts.has(draftKey()), false);
  } finally { pending?.resolve(); draft.dispose(); if (tree) await RTR.act(async () => tree.unmount()); }
});

test('group durable draft: stale CLOSED after A to B to A cannot retire the new incarnation before React effects catch up', async () => {
  const h = harness(), oldDraft = modelFor(h); let tree, fresh;
  const useClosing = h.load('src/ui/auth/AccountClosingState.tsx').useAccountClosing;
  function Probe() { return React.createElement('ClosingProbe', useClosing({ accountId: ACCOUNT, accountRevision: 1 })); }
  try {
    await oldDraft.load(GROUP); oldDraft.change('Stariji nacrt.'); await oldDraft.flush();
    await RTR.act(async () => { tree = RTR.create(React.createElement(Probe)); });
    h.state.closingWait = deferred(); await RTR.act(async () => tree.root.findByType('ClosingProbe').props.check());
    h.session.user = { id: OTHER }; h.session.accountRevision++;
    h.session.user = { id: ACCOUNT }; h.session.accountRevision++;
    fresh = modelFor(h); await fresh.load(GROUP); fresh.change('Novi nacrt nove prijave.'); await fresh.flush();
    h.state.closingResult = { ok: true, podatak: { closing: true, execution: { state: 'CLOSED', authoritative: true, accountId: ACCOUNT } } };
    await RTR.act(async () => h.state.closingWait.resolve());
    assert.equal(fresh.getSnapshot().loaded, true); assert.equal(fresh.getSnapshot().text, 'Novi nacrt nove prijave.');
    assert.equal(JSON.parse(h.drafts.get(draftKey())).text, 'Novi nacrt nove prijave.');
    assert.equal(h.io.filter(op => op.operation === 'erase:start').length, 0);
  } finally { h.state.closingWait?.resolve(); oldDraft.dispose(); fresh?.dispose(); if (tree) await RTR.act(async () => tree.unmount()); }
});

test('group durable draft: only current authoritative CLOSED erases text, and an erasure failure gives the available logout action', async () => {
  for (const condition of ['open', 'offline', 'executing', 'foreign', 'unconfirmed', 'erase-fails']) {
    const h = harness(), draft = modelFor(h); let tree;
    const useClosing = h.load('src/ui/auth/AccountClosingState.tsx').useAccountClosing;
    function Probe() { return React.createElement('ClosingProbe', useClosing({ accountId: ACCOUNT, accountRevision: 1 })); }
    try {
      await draft.load(GROUP); draft.change('Sačuvan nacrt.'); await draft.flush();
      h.state.closingResult = condition === 'offline' ? { ok: false, kod: 'OFFLINE', poruka: 'Offline.' }
        : condition === 'open' ? { ok: true, podatak: { closing: false, execution: null } }
        : { ok: true, podatak: { closing: true, execution: { state: condition === 'executing' ? 'EXECUTING' : 'CLOSED',
          authoritative: condition !== 'unconfirmed', accountId: condition === 'foreign' ? OTHER : ACCOUNT } } };
      h.state.eraseError = condition === 'erase-fails';
      await RTR.act(async () => { tree = RTR.create(React.createElement(Probe)); });
      assert.equal(h.drafts.size, 1);
      if (condition === 'erase-fails') {
        assert.equal(draft.getSnapshot().loaded, false); assert.match(tree.root.findByType('ClosingProbe').props.message, /Odjavite se/);
        assert.doesNotMatch(tree.root.findByType('ClosingProbe').props.message, /proverite stanje/);
      } else { assert.equal(draft.getSnapshot().text, 'Sačuvan nacrt.'); assert.equal(h.io.filter(op => op.operation === 'erase:start').length, 0); }
    } finally { draft.dispose(); if (tree) await RTR.act(async () => tree.unmount()); }
  }
});

// Actual production presentation and composer; native rendering/scrolling stay inert.
function mountedGroupPresentationReview() {
  const host=name=>props=>React.createElement(name,props,props.children,props.right);
  const noop=()=>{};
  const h=createHarness({
    'phosphor-react-native':{Users:host('Users'),PaperPlaneTilt:host('PaperPlaneTilt')},
    'react-native-safe-area-context':{SafeAreaView:host('SafeAreaView'),useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})},
    'src/ui/interFont.ts':{withInter:value=>value},
    'src/ui/system/ScreenChrome.tsx':{ScreenChrome:host('ScreenChrome'),ChromeIconButton:host('ChromeIconButton')},
    'src/ui/system/StateView.tsx':{StateView:host('StateView')},
    'src/ui/v2/QuietReadState.tsx':{QuietReadState:host('QuietReadState')},
    'src/ui/messages/MessageBubbles.tsx':{TextBubble:host('TextBubble')},
    'src/ui/messages/MessageMark.tsx':{MessageMark:host('MessageMark')},
    'src/ui/groups/ConversationChannels.tsx':{ConversationChannels:host('ConversationChannels')},
    'src/ui/product/ProductSheet.tsx':{ProductSheet:host('ProductSheet')},
    'src/ui/groups/useGroupReading.ts':{GROUP_READING_POSITION:{minIndexForVisible:0},useGroupReading:()=>({
      list:React.useRef(null),onVisible:noop,chooseLatest:noop,readOlder:noop,cover:noop,onHeaderLayout:noop,
      onLayout:noop,onScroll:noop,onContentSizeChange:noop,onScrollBeginDrag:noop,onScrollEndDrag:noop,
      onMomentumScrollBegin:noop,onMomentumScrollEnd:noop,showLatest:false,readingLost:false,
    })},
    'src/ui/auth/AuthControls.tsx':{PrimaryButton:host('PrimaryButton')},
  });
  h.native.FlatList=host('FlatList');h.native.KeyboardAvoidingView=host('KeyboardAvoidingView');
  const Group=h.load('src/ui/groups/GroupConversationPresentation.tsx').GroupConversationPresentation;
  const Closing=h.load('src/ui/auth/AccountClosingState.tsx').AccountClosingScreen;
  const account='00000000-0000-4000-8000-000000000001',agreement='00000000-0000-4000-8000-000000000003',groupId='00000000-0000-4000-8000-000000000004';
  const group={groupId,title:'Zajednički zadatak',canSend:true,terminal:false,role:'PARTICIPANT',members:[],management:null,managementNextId:null,unreadCount:0};
  const state={phase:'READY',context:{accountId:account,agreementId:agreement,needId:'00000000-0000-4000-8000-000000000006',available:true,authoritative:true,group},messages:[],before:null,olderPageUnavailable:false,journal:null,receipt:null,canRetry:false,message:null};
  const defaultProps={state,draft:'Novija poruka',draftLength:12,draftSendable:true,showPeople:false,listKey:1,
    viewability:{viewAreaCoveragePercentThreshold:60,minimumViewTime:600},onVisible:noop,onBack:noop,onTogglePeople:noop,
    onRefresh:noop,onOlder:noop,onManagementNext:noop,onOpenAgreement:noop,onDraft:noop,onSend:noop,onAcknowledge:noop};
  return { Group, Closing, state, defaultProps };
}

test('group: actual composer separates local typing, stored-message retry and receipt recovery', async () => {
  const { Group, state, defaultProps } = mountedGroupPresentationReview();
  const cases = [
    { label: 'capture pending', phase: 'SENDING', editable: false, send: false },
    { label: 'server pending', phase: 'SENDING', editable: true, send: false },
    { label: 'unknown without retry', phase: 'UNKNOWN', editable: true, send: false, check: true },
    { label: 'retry saved original', phase: 'UNKNOWN', editable: true, send: true, retry: true },
    { label: 'confirmed cleanup', phase: 'CONFIRMED', editable: true, send: false, ack: true },
    { label: 'local save failed', phase: 'READY', editable: true, send: true, save: true },
  ];
  for (const item of cases) {
    const calls = { send: 0, edit: [], check: 0, ack: 0, save: 0 };
    let tree;
    await RTR.act(async () => { tree = RTR.create(React.createElement(Group, {
      ...defaultProps, state: { ...state, phase: item.phase, canRetry: !!item.retry },
      draft: 'Noviji neposlat unos.', draftEditable: item.editable,
      ...(item.retry ? { retryBody: 'Prvobitna poruka.', newerDraft: true } : {}),
      ...(item.save ? { draftError: 'Nacrt nije sačuvan na ovom uređaju.', draftSaving: false } : {}),
      onSend: () => calls.send++, onDraft: value => calls.edit.push(value),
      onRefresh: () => calls.check++, onAcknowledge: () => calls.ack++, onSaveDraft: () => calls.save++,
    })); });
    try {
      const native = predicate => tree.root.findAll(node => typeof node.type === 'string' && predicate(node));
      const field = native(node => node.type === 'TextInput');
      assert.equal(field.length, 1, item.label); assert.equal(field[0].props.editable, item.editable, item.label);
      const send = native(node => node.type === 'Press'); assert.equal(send.length, 1);
      assert.equal(send[0].props.disabled, !item.send, item.label);
      assert.equal(send[0].props.accessibilityState.disabled, !item.send);
      if (item.editable) {
        await RTR.act(async () => field[0].props.onChangeText('Sledeća poruka.'));
        assert.deepEqual(calls.edit, ['Sledeća poruka.']); assert.equal(calls.send, 0);
      }
      if (item.retry) {
        assert.equal(send[0].props.accessibilityLabel, 'Ponovite slanje prethodne poruke');
        assert.equal(field[0].props.value, 'Noviji neposlat unos.');
        assert.ok(native(node => node.type === 'T' && React.Children.toArray(node.props.children).includes('Prvobitna poruka.')).length);
      }
      for (const [flag, label] of [['check','Proverite potvrdu slanja'], ['ack','Nastavite razgovor'], ['save','Sačuvajte nacrt ponovo']]) {
        if (!item[flag]) continue;
        const action = native(node => node.type === 'V2Action' && node.props.label === label);
        assert.equal(action.length, 1); assert.equal(!!action[0].props.disabled, false);
        await RTR.act(async () => action[0].props.onPress());
        assert.equal(calls[flag], 1); assert.equal(calls.send, 0);
      }
      if (item.save) assert.equal(native(node => node.props.accessibilityRole === 'alert').length, 1);
    } finally { await RTR.act(async () => tree.unmount()); }
  }
});

test('group: closed-account draft cleanup error offers the stated formal sign-out action', async () => {
  const { Closing } = mountedGroupPresentationReview();
  let tree, signOut = 0, check = 0;
  await RTR.act(async () => { tree = RTR.create(React.createElement(Closing, {
    execution: { state: 'CLOSED' }, working: null,
    message: 'Lokalni nacrti nisu potpuno uklonjeni. Odjavite se da uređaj ponovo pokuša da ih ukloni.',
    onSignOut: () => signOut++, onCheck: () => check++, onSupport: () => {},
  })); });
  try {
    const native = predicate => tree.root.findAll(node => typeof node.type === 'string' && predicate(node));
    assert.equal(native(node => node.props.accessibilityRole === 'alert').length, 1);
    const buttons = native(node => node.type === 'PrimaryButton'); assert.equal(buttons.length, 1);
    assert.equal(buttons[0].props.title, 'Odjavite se sa ovog uređaja'); assert.equal(buttons[0].props.disabled, false);
    assert.equal(native(node => node.props.title === 'Proverite stanje' || node.props.label === 'Proverite stanje').length, 0);
    await RTR.act(async () => buttons[0].props.onPress()); assert.equal(signOut, 1); assert.equal(check, 0);
  } finally { await RTR.act(async () => tree.unmount()); }
});
