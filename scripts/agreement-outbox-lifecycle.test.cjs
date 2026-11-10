'use strict';
// Real local outbox/journals, Auth logout and mounted closing hook at inert native/SDK boundaries.
// No Android filesystem, authenticated backend, push or provider execution is claimed.
const test = require('node:test');
const assert = require('node:assert/strict');
const { React, RTR, createHarness, deferred } = require('./ux-component-harness.cjs');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ACCOUNT = id(1), OTHER = id(2), AGREEMENT = id(3);
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const stored = new Map(), io = [], sends = [], models = [];
  const session = { user: { id: ACCOUNT }, accountRevision: 1 };
  const state = { authWait: null, authError: false, writeWait: null, writePrefix: null, eraseError: false,
    sendWait: null, sendError: false, mapWait: null, closingWait: null, closingResult: { ok: true, podatak: { closing: false, execution: null } } };
  const storage = {
    getItem: async key => stored.get(key) ?? null,
    setItem: async (key, value) => { io.push({ kind: 'write:start', key });
      if (state.writeWait && key.startsWith(state.writePrefix)) await state.writeWait.promise;
      stored.set(key, value); io.push({ kind: 'write:end', key }); },
    removeItem: async key => { stored.delete(key); },
    getAllKeys: async () => [...stored.keys()],
    multiRemove: async keys => { io.push({ kind: 'erase', keys });
      if (state.eraseError) throw Error('DISK_ERASE_FAILED'); for (const key of keys) stored.delete(key); },
  };
  const h = createHarness({
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    'src/store/sesija.ts': { sesijaSada: () => session, useSesija: () => session },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => ({ auth: {
      getSession: async () => ({ data: { session: { user: session.user } }, error: null }),
      signOut: async () => { if (!state.authError) { session.user = null; session.accountRevision++; }
        if (state.authWait) await state.authWait.promise; return { error: state.authError ? Error('AUTH_SIGNOUT_FAILED') : null }; },
    } }) },
    'src/data/pushDeviceClientService.ts': { revokePushBeforeLogout: async () => undefined },
    'src/data/confirmedDiscoveryMapPlace.ts': { writeSettledMapPlace: async () => { if (state.mapWait) await state.mapWait.promise; } },
    'src/data/voiceMessagesGate.ts': { voiceMessagesBuilt: () => false },
    'src/data/accountClosingStanding.ts': { readAccountClosingStanding: async () => {
      if (state.closingWait) await state.closingWait.promise; return state.closingResult; } },
    'src/ui/closure/closureIntent.ts': { closureIntentJournal: { load: async () => null } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'src/ui/auth/AuthControls.tsx': { PrimaryButton: 'PrimaryButton' },
  });
  const outboxes = h.load('src/data/agreementOutbox.ts'), uploads = h.load('src/data/agreementPhotoJournal.ts');
  const model = (namespace = 'text', accountId = session.user.id, agreementId = AGREEMENT) => {
    const revision = session.accountRevision; let seq = 10;
    const outbox = outboxes.createAgreementOutbox({ accountId, agreementId, namespace, storage,
      isCurrent: () => session.user?.id === accountId && session.accountRevision === revision,
      canSendNew: () => true, newId: () => id(seq++), messagePort: { send: async command => {
        sends.push(command); if (state.sendWait) await state.sendWait.promise;
        if (state.sendError) throw Error('TRANSPORT_LOST'); return { messageId: id(90) }; } } });
    models.push(outbox); return outbox;
  };
  let tree;
  const useClosing = h.load('src/ui/auth/AccountClosingState.tsx').useAccountClosing;
  const Probe = ({ revision }) => React.createElement('ClosingProbe', useClosing({ accountId: ACCOUNT, accountRevision: revision }));
  return { stored, io, sends, session, state, storage, model, outboxes, uploads,
    auth: h.load('src/data/authClientService.ts').authClientService,
    async closing() { await RTR.act(async () => { tree = RTR.create(React.createElement(Probe, { revision: session.accountRevision })); }); },
    check() { return RTR.act(async () => tree.root.findByType('ClosingProbe').props.check()); },
    closingProps: () => tree.root.findByType('ClosingProbe').props,
    async close() { for (const m of models) m.stop(); if (tree) await RTR.act(async () => tree.unmount()); },
  };
}
const draftKey = (kind = 'text', account = ACCOUNT) => `uskoci:agreement-${kind === 'voice' ? 'voice-draft' : 'draft'}:v1:${account}:${AGREEMENT}`;
const outboxKey = (kind = 'text', account = ACCOUNT) => `uskoci:agreement-${kind === 'voice' ? 'voice-outbox' : 'outbox'}:v1:${account}:${AGREEMENT}`;
const closed = () => ({ ok: true, podatak: { closing: true, execution: { state: 'CLOSED', authoritative: true, accountId: ACCOUNT } } });

test('private outbox: late logout cannot erase new same-account text or voice drafts', async () => {
  const h = harness(); let logout, freshStart;
  try {
    const old = h.model(); await old.start(); await old.setDraft('Pre odjave.');
    h.state.authWait = deferred(); h.state.mapWait = deferred();
    logout = h.auth.signOutLocal({ accountId: ACCOUNT, accountRevision: 1 }); await tick();
    assert.equal(h.session.user, null);
    h.session.user = { id: ACCOUNT }; h.session.accountRevision++;
    const fresh = h.model(), voice = h.model('voice');
    let loaded = false; freshStart = Promise.all([fresh.start(), voice.start()]).then(() => { loaded = true; });
    await tick(); const loadedBeforeLogout = loaded;
    if (loadedBeforeLogout) { await fresh.setDraft('Nova privatna poruka.'); await voice.setDraft('Novi glasovni nacrt.'); }
    h.state.authWait.resolve(); await freshStart;
    if (!loadedBeforeLogout) {
      assert.equal(fresh.getSnapshot().draft, '');
      await fresh.setDraft('Nova privatna poruka.'); await voice.setDraft('Novi glasovni nacrt.');
    }
    h.state.mapWait.resolve(); await logout;
    assert.equal(JSON.parse(h.stored.get(draftKey()) ?? 'null')?.text, 'Nova privatna poruka.', 'old logout cannot erase the newer text');
    assert.equal(JSON.parse(h.stored.get(draftKey('voice')) ?? 'null')?.text, 'Novi glasovni nacrt.');
    assert.equal(loadedBeforeLogout, false, 'new incarnation waits for the old logout boundary');
    await old.setDraft('Kasni stari unos.');
    assert.equal(JSON.parse(h.stored.get(draftKey())).text, 'Nova privatna poruka.');
    assert.equal(h.sends.length, 0);
  } finally { h.state.authWait?.resolve(); h.state.mapWait?.resolve(); if (logout) await logout; if (freshStart) await freshStart; await h.close(); }
});

test('private outbox: current authoritative CLOSED purges text/voice, retires mounted writers and rejects a late send receipt', async () => {
  const h = harness(); let sending, voiceSending;
  try {
    const text = h.model(), voice = h.model('voice'); await text.start(); await voice.start();
    await text.setDraft('Poruka u letu.'); h.state.sendWait = deferred(); sending = text.sendDraft(); await tick();
    assert.equal(h.sends.length, 1);
    await text.setDraft('Noviji neposlati nacrt.');
    voiceSending = voice.sendVoice({ agreementVersion: 1, assetId: id(99) }); await tick();
    h.state.closingResult = closed(); await h.closing();
    assert.equal(h.stored.has(draftKey()), false); assert.equal(h.stored.has(outboxKey()), false);
    assert.equal(h.stored.has(outboxKey('voice')), false);
    assert.equal(text.getSnapshot().draft, ''); assert.equal(text.getSnapshot().entries.length, 0);
    await text.setDraft('Kasni upis posle zatvaranja.'); await text.sendDraft();
    h.state.sendWait.resolve(); await sending; await voiceSending;
    assert.equal(h.stored.has(draftKey()), false); assert.equal(h.stored.has(outboxKey()), false);
    assert.equal(h.sends.length, 2, 'no send is admitted after closure');
  } finally { h.state.sendWait?.resolve(); if (sending) await sending; if (voiceSending) await voiceSending; await h.close(); }
});

test('private outbox: failed Auth leaves old and queued new edits usable without erasure', async () => {
  const h = harness(); let logout, editing;
  try {
    const box = h.model(); await box.start(); await box.setDraft('Sačuvano pre pokušaja.');
    h.state.authError = true; h.state.authWait = deferred();
    logout = h.auth.signOutLocal({ accountId: ACCOUNT, accountRevision: 1 });
    const rejection = assert.rejects(logout, /AUTH_SIGNOUT_FAILED/); await tick();
    editing = box.setDraft('Novi tekst tokom neuspele odjave.');
    await tick(); assert.equal(JSON.parse(h.stored.get(draftKey())).text, 'Sačuvano pre pokušaja.');
    h.state.authWait.resolve(); await rejection; await editing;
    assert.equal(h.session.user.id, ACCOUNT);
    assert.equal(JSON.parse(h.stored.get(draftKey())).text, 'Novi tekst tokom neuspele odjave.');
    assert.equal(h.io.some(op => op.kind === 'erase'), false);
    await box.setDraft('Sledeća izmena radi.'); assert.equal(box.getSnapshot().draft, 'Sledeća izmena radi.');
  } finally { h.state.authWait?.resolve(); if (logout) await logout.catch(() => {}); if (editing) await editing; await h.close(); }
});

test('private outbox: logout waits for an admitted storage write and preserves other accounts and group identities', async () => {
  const h = harness(); let editing, logout;
  try {
    const box = h.model(); await box.start();
    const otherKey = draftKey('text', OTHER), groupKey = `uskoci:group-message:v5:${ACCOUNT}:${AGREEMENT}`;
    h.stored.set(otherKey, 'OTHER_ACCOUNT_PAYLOAD'); h.stored.set(groupKey, 'GROUP_IDS_ONLY');
    h.state.writePrefix = draftKey(); h.state.writeWait = deferred();
    editing = box.setDraft('Spor lokalni upis.'); await tick();
    logout = h.auth.signOutLocal({ accountId: ACCOUNT, accountRevision: 1 }); await tick();
    assert.equal(h.io.some(op => op.kind === 'erase'), false);
    h.state.writeWait.resolve(); await editing; await logout;
    assert.equal(h.stored.has(draftKey()), false);
    assert.equal(h.stored.get(otherKey), 'OTHER_ACCOUNT_PAYLOAD'); assert.equal(h.stored.get(groupKey), 'GROUP_IDS_ONLY');
    await box.setDraft('Kasni upis.'); assert.equal(h.stored.has(draftKey()), false);
  } finally { h.state.writeWait?.resolve(); if (editing) await editing; if (logout) await logout; await h.close(); }
});

for (const kind of ['photos', 'voice']) {
  test(`private upload journal: ${kind} already-writing identity is removed after logout and never restored by that old call`, async () => {
    const h = harness(); let saving, logout;
    try {
      const journal = kind === 'photos' ? h.uploads.agreementPhotoJournal : h.uploads.agreementVoiceJournal;
      const prefix = `uskoci.agreement.${kind}.v1.${ACCOUNT}.`, key = prefix + AGREEMENT;
      h.state.writePrefix = prefix; h.state.writeWait = deferred();
      const ref = { agreementId: AGREEMENT, agreementVersion: 1, clientRequestId: id(20) };
      saving = journal.save(ACCOUNT, ref, () => h.session.user?.id === ACCOUNT && h.session.accountRevision === 1)
        .then(() => ({ ok: true }), error => ({ ok: false, error }));
      await tick();
      logout = h.auth.signOutLocal({ accountId: ACCOUNT, accountRevision: 1 }); await tick();
      assert.equal(h.io.some(op => op.kind === 'erase'), false);
      h.state.writeWait.resolve(); const result = await saving; await logout;
      assert.equal(h.stored.has(key), false, 'an already-started write cannot reappear after erasure');
      assert.equal(result.ok, false); assert.match(result.error.message, /SCOPE_CHANGED/);
      h.state.writeWait = null; h.session.user = { id: ACCOUNT }; h.session.accountRevision++;
      const freshRef = { ...ref, clientRequestId: id(21) };
      await journal.save(ACCOUNT, freshRef, () => true);
      assert.deepEqual(await journal.load(ACCOUNT, AGREEMENT), [freshRef]);
    } finally { h.state.writeWait?.resolve(); if (saving) await saving.catch(() => {}); if (logout) await logout; await h.close(); }
  });
}

test('private outbox: unrelated, stale, offline or nonauthoritative closing reads cannot erase local payloads', async () => {
  for (const condition of ['open', 'offline', 'executing', 'foreign', 'unconfirmed', 'account-return']) {
    const h = harness();
    try {
      const box = h.model(); await box.start(); await box.setDraft('Tekst ostaje bez potvrđenog zatvaranja.');
      h.state.closingResult = condition === 'offline' ? { ok: false, kod: 'OFFLINE', poruka: 'Offline.' }
        : condition === 'open' ? { ok: true, podatak: { closing: false, execution: null } }
        : { ok: true, podatak: { closing: true, execution: { state: condition === 'executing' ? 'EXECUTING' : 'CLOSED',
          authoritative: condition !== 'unconfirmed', accountId: condition === 'foreign' ? OTHER : ACCOUNT } } };
      if (condition === 'account-return') h.state.closingWait = deferred();
      await h.closing();
      if (condition === 'account-return') {
        h.session.user = { id: OTHER }; h.session.accountRevision++;
        h.session.user = { id: ACCOUNT }; h.session.accountRevision++;
        const fresh = h.model(); await fresh.start(); await fresh.setDraft('Novi tekst nove sesije.');
        await RTR.act(async () => h.state.closingWait.resolve());
        assert.equal(fresh.getSnapshot().draft, 'Novi tekst nove sesije.');
      }
      assert.equal(h.stored.has(draftKey()), true, condition); assert.equal(h.io.some(op => op.kind === 'erase'), false, condition);
    } finally { h.state.closingWait?.resolve(); await h.close(); }
  }
});

test('private outbox: disk erasure failure retires old writers, reports incomplete closure and does not undo successful logout', async () => {
  for (const action of ['closure', 'logout']) {
    const h = harness();
    try {
      const box = h.model(); await box.start(); await box.setDraft('Tekst na neispravnom disku.');
      const original = h.stored.get(draftKey()); h.state.eraseError = true;
      if (action === 'closure') { h.state.closingResult = closed(); await h.closing(); assert.match(h.closingProps().message, /nisu potpuno uklonjeni/); }
      else { await h.auth.signOutLocal({ accountId: ACCOUNT, accountRevision: 1 }); assert.equal(h.session.user, null); }
      assert.equal(box.getSnapshot().draft, '');
      await box.setDraft('Stari upis posle brisanja.'); assert.equal(h.stored.get(draftKey()), original);
      assert.equal(h.sends.length, 0);
    } finally { await h.close(); }
  }
});

test('private outbox: cold recovery and delayed receipt preserve a newer identical draft without automatically resending', async () => {
  const h = harness(); let sending;
  try {
    const first = h.model(); await first.start(); await first.setDraft('Identična poruka.');
    h.state.sendWait = deferred(); sending = first.sendDraft(); await tick();
    assert.equal(h.sends.length, 1); const command = h.sends[0];
    await first.setDraft('Identična poruka.'); first.stop();
    const cold = h.model(); await cold.start();
    assert.equal(cold.getSnapshot().draft, 'Identična poruka.'); assert.equal(cold.getSnapshot().entries[0].state, 'unknown');
    assert.equal(h.sends.length, 1);
    h.state.sendWait.resolve(); await sending;
    assert.equal(cold.getSnapshot().entries[0].state, 'confirmed'); assert.equal(cold.getSnapshot().draft, 'Identična poruka.');
    await cold.reconcile([{ senderAccountId: ACCOUNT, clientMessageId: command.clientMessageId, messageId: id(90), body: command.body }]);
    assert.equal(cold.getSnapshot().draft, 'Identična poruka.'); assert.equal(h.sends.length, 1);
  } finally { h.state.sendWait?.resolve(); if (sending) await sending; await h.close(); }
});

test('private outbox: ordinary text and voice send/retry remain isolated, and acknowledged cache pruning does not deadlock', async () => {
  const h = harness();
  try {
    const box = h.model(), voice = h.model('voice'); await box.start(); await voice.start();
    for (let i = 0; i < 52; i++) { await box.setDraft(`Poruka ${i}.`); await box.sendDraft(); }
    assert.equal(box.getSnapshot().draft, ''); assert.equal(box.getSnapshot().entries.length, 50);
    assert.ok(box.getSnapshot().entries.every(entry => entry.state === 'confirmed'));
    await voice.sendVoice({ agreementVersion: 1, assetId: id(99) });
    assert.equal(voice.getSnapshot().entries.length, 1); assert.equal(voice.getSnapshot().entries[0].state, 'confirmed');
    assert.equal(h.sends.length, 53); assert.equal(h.stored.has(outboxKey()), true); assert.equal(h.stored.has(outboxKey('voice')), true);
    await voice.retry(voice.getSnapshot().entries[0].command.clientMessageId); assert.equal(h.sends.length, 53);
  } finally { await h.close(); }
});

test('private outbox: an unresolved ordinary message retry preserves its command identity and newest draft', async () => {
  const h = harness();
  try {
    const box = h.model(); await box.start(); await box.setDraft('Prethodna poruka.');
    h.state.sendError = true; await box.sendDraft();
    const first = box.getSnapshot().entries[0]; assert.equal(first.state, 'unknown');
    await box.setDraft('Novi unos ostaje.'); h.state.sendError = false;
    await box.retry(first.command.clientMessageId);
    assert.equal(h.sends.length, 2); assert.deepEqual(h.sends[1], h.sends[0]);
    assert.equal(box.getSnapshot().entries[0].state, 'confirmed'); assert.equal(box.getSnapshot().draft, 'Novi unos ostaje.');
    await box.retry(first.command.clientMessageId); assert.equal(h.sends.length, 2);
  } finally { await h.close(); }
});
