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
  const state = { agreementId: AGREEMENT, groupId: GROUP, sendWait: null, sendError: false, storageWait: null, removeError: false, messages: [], receipt: null };
  const calls = [], stored = new Map(), listeners = new Set(), Focus = React.createContext(true);
  let requestNumber = 5;
  const app = { currentState: options.background ? 'background' : 'active', addEventListener: (_type, fn) => {
    listeners.add(fn); return { remove: () => listeners.delete(fn) };
  } };
  const storage = {
    getItem: async key => stored.get(key) ?? null,
    setItem: async (key, value) => { stored.set(key, value); if (state.storageWait) await state.storageWait.promise; },
    removeItem: async key => { if (state.removeError) throw Error('DISK_UNAVAILABLE'); stored.delete(key); },
  };
  let service;
  const rpc = async (name, args) => {
    calls.push({ name, args });
    const accountId = args.p_expected_user_id;
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
    '@react-native-async-storage/async-storage': storage,
    'src/store/sesija.ts': { useSesija: () => session, sesijaSada: () => session },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => ({ rpc }) },
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
  return { state, session, calls, stored, navigation, props,
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
      assert.ok(!journal.includes('kutijama'), 'pending text stays in memory only');
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

test('group: a pending draft never follows an account change or mismatched command', async () => {
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
      assert.equal(h.props().draft, '');
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
    assert.equal(h.props().state.phase, 'UNKNOWN');
    assert.equal(h.props().draft, 'Početak je u dvanaest.');
    assert.equal([...h.stored.values()][0], journal);
    await h.resolve(h.state.storageWait); h.state.storageWait = null;
    assert.equal(h.count('rpc_send_group_message_v5'), 0);
    await h.send();
    assert.equal(h.count('rpc_send_group_message_v5'), 1);
    assert.equal(h.props().state.phase, 'READY'); assert.equal(h.props().draft, '');
  } finally { h.state.storageWait?.resolve(); await h.close(); }
});

test('group: edited retry text survives warm return but cannot change the original command payload', async () => {
  const h = harness();
  try {
    await h.mount(); await h.type('Prvobitna poruka.'); h.state.sendError = true; await h.send();
    await h.activity('background'); await h.activity('active');
    await h.type('Izmenjen neposlat unos.');
    await h.activity('background'); await h.activity('active');
    assert.equal(h.props().draft, 'Izmenjen neposlat unos.');
    await h.send();
    assert.equal(h.count('rpc_send_group_message_v5'), 1);
    assert.equal(h.props().state.phase, 'UNKNOWN');
    assert.match(h.props().state.message, /Tekst se razlikuje/);
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

test('group: confirmed-journal recovery never carries a newer draft into a changed account or session', async () => {
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
      assert.equal(h.props().draft, '');
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
