'use strict';
// Actual Auth, file and native-audio adapters at inert Expo filesystem/audio seams.
// No Android filesystem, microphone, physical playback or hosted session claim.
const test = require('node:test');
const assert = require('node:assert/strict');
const { React, RTR, createHarness, deferred } = require('./ux-component-harness.cjs');
const ACCOUNT = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const data = new Map(), stored = new Map(), directories = new Set(['file:///cache']);
  const removed = [], recorders = [], players = [], listeners = new Set(), models = [];
  const session = { user: { id: ACCOUNT }, accountRevision: 1 };
  const state = { authWait: null, authError: false, mapWait: null, prepareWait: null, stopWait: null, releaseError: false, eraseError: false,
    closingWait: null, closingResult: { ok: true, podatak: { closing: false, execution: null } } };
  const uri = parts => parts.map(x => typeof x === 'string' ? x : x.uri).reduce((a, x, i) =>
    i === 0 ? x.replace(/\/$/, '') : a + '/' + x.replace(/^\/|\/$/g, ''), '');
  class File {
    constructor(...parts) { this.uri = uri(parts); }
    get name() { return this.uri.split('/').at(-1); }
    get exists() { return data.has(this.uri); }
    get size() { return data.get(this.uri)?.byteLength || 0; }
    create() { if (!data.has(this.uri)) data.set(this.uri, new Uint8Array()); }
    write(bytes) { data.set(this.uri, new Uint8Array(bytes)); }
    delete() { if (state.eraseError) throw Error('DISK_ERASE_FAILED'); removed.push(this.uri); data.delete(this.uri); }
    async arrayBuffer() { return data.get(this.uri).slice().buffer; }
    moveSync(destination) { data.set(destination.uri, data.get(this.uri)); data.delete(this.uri); this.uri = destination.uri; }
  }
  class Directory {
    constructor(...parts) { this.uri = uri(parts); }
    get exists() { return directories.has(this.uri) || [...data.keys()].some(x => x.startsWith(this.uri + '/')); }
    create() { directories.add(this.uri); }
    delete() { if (state.eraseError) throw Error('DISK_ERASE_FAILED'); for (const key of [...data.keys()]) if (key.startsWith(this.uri + '/')) new File(key).delete(); directories.delete(this.uri); }
    list() { return [...data.keys()].filter(x => x.startsWith(this.uri + '/') && !x.slice(this.uri.length + 1).includes('/')).map(x => new File(x)); }
  }
  class Recorder {
    constructor() {
      this.uri = 'file:///cache/Audio/recording-00000000-0000-4000-8000-' + String(recorders.length + 1).padStart(12, '0') + '.m4a';
      this.recording = false; this.released = false; recorders.push(this);
    }
    async prepareToRecordAsync() {
      if (state.prepareWait) await state.prepareWait.promise;
      new Directory('file:///cache/Audio').create(); data.set(this.uri, new Uint8Array([1, 2, 3]));
    }
    record() { this.recording = true; }
    getStatus() { return { isRecording: this.recording, canRecord: !this.released }; }
    addListener() { return { remove() {} }; }
    async stop() { if (state.stopWait) await state.stopWait.promise; this.recording = false; }
    release() { if (state.releaseError) throw Error('NATIVE_RELEASE_FAILED'); this.recording = false; this.released = true; }
  }
  const storage = { getItem: async key => stored.get(key) ?? null, setItem: async (key, value) => stored.set(key, value),
    removeItem: async key => stored.delete(key), getAllKeys: async () => [...stored.keys()], multiRemove: async keys => { for (const key of keys) stored.delete(key); } };
  const native = { ...createHarness().native, Platform: { OS: 'android', isTV: false },
    AppState: { currentState: 'active', addEventListener: (_, listener) => { listeners.add(listener); return { remove: () => listeners.delete(listener) }; } } };
  const h = createHarness({
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    'react-native': native,
    'expo-file-system': { File, Directory, Paths: { cache: { uri: 'file:///cache/' } } },
    'expo-audio': {
      getRecordingPermissionsAsync: async () => ({ granted: true, canAskAgain: true }), setAudioModeAsync: async () => {}, AudioModule: { AudioRecorder: Recorder },
      createAudioPlayer: () => { const player = { removed: false, currentStatus: { isLoaded: true, duration: 3, currentTime: 0, playing: false },
        addListener: () => ({ remove() {} }), remove() { if (state.releaseError) throw Error('NATIVE_RELEASE_FAILED'); this.removed = true; },
        play() { this.currentStatus.playing = true; }, pause() { this.currentStatus.playing = false; }, async seekTo(value) { this.currentStatus.currentTime = value; } };
      players.push(player); return player; },
    },
    'src/store/sesija.ts': { sesijaSada: () => session },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => ({ auth: {
      getSession: async () => ({ data: { session: { user: session.user } }, error: null }),
      signOut: async () => { if (!state.authError) { session.user = null; session.accountRevision++; }
        if (state.authWait) await state.authWait.promise; return { error: state.authError ? Error('AUTH_SIGNOUT_FAILED') : null }; },
    } }) },
    'src/data/pushDeviceClientService.ts': { revokePushBeforeLogout: async () => undefined },
    'src/data/confirmedDiscoveryMapPlace.ts': { writeSettledMapPlace: async () => { if (state.mapWait) await state.mapWait.promise; } },
    'src/data/voiceMessagesGate.ts': { voiceMessagesBuilt: () => true },
    'src/data/accountClosingStanding.ts': { readAccountClosingStanding: async () => {
      if (state.closingWait) await state.closingWait.promise; return state.closingResult; } },
    'src/ui/closure/closureIntent.ts': { closureIntentJournal: { load: async () => null } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'src/ui/auth/AuthControls.tsx': { PrimaryButton: 'PrimaryButton' },
    'src/ui/permissions/permissionAsk.ts': { permissionAsk: { hasHost: () => false } },
  });
  const files = h.load('src/features/voiceMessages/nativeVoiceFiles.ts');
  const adapters = h.load('src/features/voiceMessages/nativeAudioAdapters.ts');
  let tree;
  const useClosing = h.load('src/ui/auth/AccountClosingState.tsx').useAccountClosing;
  function Probe({ revision }) { return React.createElement('ClosingProbe', useClosing({ accountId: ACCOUNT, accountRevision: revision })); }
  return { state, session, data, removed, recorders, players, listeners, files,
    auth: h.load('src/data/authClientService.ts').authClientService,
    recorder() { const r = adapters.createNativeVoiceRecorder(); models.push(() => r.cancel()); return r; },
    player() { const p = adapters.createNativeVoicePlayer(); models.push(() => p.release()); return p; },
    write: name => files.nativeVoiceFiles.writeTemp(name, new Uint8Array([1, 2, 3]).buffer),
    signIn(account = ACCOUNT) { session.user = { id: account }; session.accountRevision++; },
    logout: () => h.load('src/data/authClientService.ts').authClientService.signOutLocal({ accountId: session.user.id, accountRevision: session.accountRevision }),
    async closing() { await RTR.act(async () => { tree = RTR.create(React.createElement(Probe, { revision: session.accountRevision })); }); },
    closingProps: () => tree.root.findByType('ClosingProbe').props,
    async close() { state.authWait?.resolve(); state.mapWait?.resolve(); state.prepareWait?.resolve(); state.stopWait?.resolve(); state.closingWait?.resolve();
      await Promise.allSettled(models.map(stop => stop())); if (tree) await RTR.act(async () => tree.unmount()); },
  };
}

for (const next of [ACCOUNT, OTHER]) test('voice logout: late old cleanup preserves ' + (next === ACCOUNT ? 'same-account new session' : 'different account') + ' files and recording', async () => {
  const h = harness(); let logout;
  try {
    const old = await h.write('old.m4a');
    h.state.mapWait = deferred(); logout = h.logout(); await tick(); await tick(); assert.equal(h.session.user, null);
    h.signIn(next); const fresh = await h.write('new-session.m4a'), recorder = h.recorder(); await recorder.start(); const current = h.recorders.at(-1);
    assert.equal(current.recording, true); h.state.mapWait.resolve(); await logout;
    assert.equal(h.data.has(fresh), true, 'old logout cannot erase the new session download');
    assert.equal(current.recording, true, 'old logout cannot stop the new recorder');
    assert.equal(h.data.has(current.uri), true); assert.equal(h.data.has(old), false, 'old content must still be erased');
  } finally { h.state.mapWait?.resolve(); if (logout) await logout; await h.close(); }
});

for (const next of [ACCOUNT, OTHER]) test('voice logout: pre-Auth reservation holds new ' + (next === ACCOUNT ? 'same-account' : 'foreign-account') + ' work until old content is erased', async () => {
  const h = harness(); let logout, writing, starting;
  try {
    const old = await h.write('old.m4a'); h.state.authWait = deferred(); logout = h.logout(); await tick();
    assert.equal(h.session.user, null); h.signIn(next);
    let written = false, started = false;
    writing = h.write('new.m4a').then(uri => { written = true; return uri; });
    const recorder = h.recorder(); starting = recorder.start().then(() => { started = true; }); await tick();
    assert.equal(written, false); assert.equal(started, false); assert.equal(h.recorders.length, 0);
    assert.equal(h.data.has(old), true, 'reserve is not a decision to delete');
    h.state.authWait.resolve(); const fresh = await writing; await starting; await logout;
    assert.equal(h.data.has(old), false); assert.equal(h.data.has(fresh), true); assert.equal(h.recorders[0].recording, true);
  } finally { h.state.authWait?.resolve(); await Promise.allSettled([logout, writing, starting]); await h.close(); }
});

test('voice logout: Auth failure cancels reservation without stopping old audio or deleting content', async () => {
  const h = harness(); let logout, writing;
  try {
    const old = await h.write('old.m4a'), recorder = h.recorder(); await recorder.start(); const native = h.recorders[0];
    h.state.authError = true; h.state.authWait = deferred(); logout = h.logout(); const rejected = assert.rejects(logout, /AUTH_SIGNOUT_FAILED/); await tick();
    let written = false; writing = h.write('during-attempt.m4a').then(uri => { written = true; return uri; }); await tick();
    assert.equal(written, false); assert.equal(native.recording, true); assert.equal(h.removed.length, 0);
    h.state.authWait.resolve(); await rejected; const after = await writing;
    assert.equal(h.session.user.id, ACCOUNT); assert.equal(native.recording, true); assert.equal(h.data.has(old), true);
    assert.equal(h.data.has(after), true); assert.equal(h.data.has(native.uri), true); assert.equal(h.removed.length, 0);
    const player = h.player(); await player.load(after); await player.play(); assert.equal(h.players.at(-1).removed, false);
  } finally { h.state.authWait?.resolve(); await Promise.allSettled([logout, writing]); await h.close(); }
});

for (const stage of ['prepare', 'stop']) test('voice logout: new session during old native ' + stage + ' waits for late SDK output and cleanup', async () => {
  const h = harness(); let logout, oldWork, writing, starting;
  try {
    const old = await h.write('old.m4a'), recorder = h.recorder();
    if (stage === 'prepare') { h.state.prepareWait = deferred(); oldWork = recorder.start(); }
    else { await recorder.start(); h.state.stopWait = deferred(); oldWork = recorder.stop(); }
    const oldResult = oldWork.then(() => ({ success: true }), error => ({ error })); await tick();
    const oldNative = h.recorders[0]; assert.ok(oldNative);
    logout = h.logout(); await tick(); h.signIn(OTHER);
    let written = false, started = false;
    writing = h.write('new.m4a').then(uri => { written = true; return uri; });
    const next = h.recorder(); starting = next.start().then(() => { started = true; }); await tick();
    assert.equal(written, false); assert.equal(started, false); assert.equal(h.recorders.length, 1);
    assert.equal(h.data.has(old), true, 'no cache removal while a native owner is unresolved');
    h.state.prepareWait?.resolve(); h.state.stopWait?.resolve();
    assert.ok((await oldResult).error, 'retired native work cannot publish a successful recording');
    const fresh = await writing; await starting; await logout;
    assert.equal(oldNative.released, true); assert.equal(h.data.has(oldNative.uri), false); assert.equal(h.data.has(old), false);
    assert.equal(h.data.has(fresh), true); assert.equal(h.recorders[1].recording, true); assert.equal(h.data.has(h.recorders[1].uri), true);
  } finally { h.state.prepareWait?.resolve(); h.state.stopWait?.resolve(); await Promise.allSettled([logout, oldWork, writing, starting]); await h.close(); }
});

test('voice logout: captured player is released and a new player survives later logout cleanup', async () => {
  const h = harness(); let logout;
  try {
    const old = await h.write('old.m4a'), before = h.player(); await before.load(old); await before.play(); const oldNative = h.players[0];
    h.state.mapWait = deferred(); logout = h.logout(); await tick(); await tick();
    assert.equal(oldNative.removed, true); assert.equal(h.data.has(old), false); h.signIn(OTHER);
    const fresh = await h.write('new.m4a'), after = h.player(); await after.load(fresh); await after.play(); const next = h.players[1];
    h.state.mapWait.resolve(); await logout;
    assert.equal(next.removed, false); assert.equal(h.data.has(fresh), true); assert.equal(next.currentStatus.playing, true);
    await assert.rejects(() => before.load(fresh), /RETIRED/, 'a retired adapter cannot borrow the next session files');
  } finally { h.state.mapWait?.resolve(); if (logout) await logout; await h.close(); }
});

test('voice erasure: pre-boundary queued work cannot revive after confirmation; cancellation preserves it', async () => {
  for (const confirm of [true, false]) {
    const h = harness(); let starting, writing;
    try {
      const recorder = h.recorder(); starting = recorder.start(); writing = h.write('queued-before.m4a');
      const results = Promise.allSettled([starting, writing]);
      const boundary = h.files.prepareVoiceFileErasure(); await boundary[confirm ? 'confirm' : 'cancel']();
      const settled = await results;
      assert.ok(settled.every(result => result.status === (confirm ? 'rejected' : 'fulfilled')));
      assert.equal(h.recorders.length, confirm ? 0 : 1);
      assert.equal(h.data.has('file:///cache/uskoci-voice/queued-before.m4a'), !confirm);
      if (confirm) { await assert.rejects(() => recorder.start(), /RETIRED/); assert.equal(h.recorders.length, 0); }
    } finally { await Promise.allSettled([starting, writing]); await h.close(); }
  }
});

test('voice logout: failed native release preserves the active file and denies new audio work without undoing Auth logout', async () => {
  const h = harness();
  try {
    const old = await h.write('old.m4a'), recorder = h.recorder(); await recorder.start(); const native = h.recorders[0];
    h.state.releaseError = true; await h.logout(); assert.equal(h.session.user, null); h.signIn(OTHER);
    assert.equal(native.released, false); assert.equal(h.data.has(native.uri), true); assert.equal(h.data.has(old), true);
    await assert.rejects(() => h.write('new.m4a'), /VOICE_ERASURE_INCOMPLETE/);
    await assert.rejects(() => h.recorder().start(), /VOICE_ERASURE_INCOMPLETE/); assert.equal(h.recorders.length, 1);
    assert.equal(h.data.has('file:///cache/uskoci-voice/new.m4a'), false);
  } finally { await h.close(); }
});

test('voice erasure: failed disk purge can retry and never removes foreign SDK cache leaves', async () => {
  const h = harness();
  try {
    const old = await h.write('old.m4a');
    const foreign = ['file:///cache/Audio/foreign.m4a', 'file:///cache/ExpoAudio/recording-00000000-0000-4000-8000-000000000090.wav', 'file:///cache/photos/image.jpg'];
    for (const uri of foreign) h.data.set(uri, new Uint8Array([1]));
    h.state.eraseError = true; await h.logout(); h.signIn();
    assert.equal(h.data.has(old), true); await assert.rejects(() => h.write('blocked.m4a'), /VOICE_ERASURE_INCOMPLETE/);
    h.state.eraseError = false; await h.files.nativeVoiceFiles.purgeAll();
    assert.equal(h.data.has(old), false); for (const uri of foreign) assert.equal(h.data.has(uri), true);
    const fresh = await h.write('after-retry.m4a'); assert.equal(h.data.has(fresh), true);
  } finally { h.state.eraseError = false; await h.close(); }
});

test('voice CLOSED: authoritative current closure erases cache and retires mounted native writers', async () => {
  const h = harness();
  try {
    const old = await h.write('closed.m4a'), recorder = h.recorder(); await recorder.start(); const native = h.recorders[0];
    h.state.closingResult = { ok: true, podatak: { closing: true, execution: { state: 'CLOSED', authoritative: true, accountId: ACCOUNT } } };
    await h.closing();
    assert.equal(h.data.has(old), false, 'CLOSED must erase actual voice bytes without requiring logout');
    assert.equal(h.data.has(native.uri), false); assert.equal(native.released, true);
    await assert.rejects(() => recorder.start(), /RETIRED/); assert.equal(h.closingProps().message, null);
  } finally { await h.close(); }
});

test('voice CLOSED: stale account incarnation, foreign receipt and unconfirmed closure cannot purge', async () => {
  for (const variant of ['A-B-A', 'foreign', 'unconfirmed', 'executing', 'offline']) {
    const h = harness();
    try {
      const file = await h.write('current.m4a'), recorder = h.recorder(); await recorder.start(); const native = h.recorders[0];
      h.state.closingResult = variant === 'offline' ? { ok: false, kod: 'OFFLINE' }
        : { ok: true, podatak: { closing: true, execution: { state: variant === 'executing' ? 'EXECUTING' : 'CLOSED',
          authoritative: variant !== 'unconfirmed', accountId: variant === 'foreign' ? OTHER : ACCOUNT } } };
      if (variant === 'A-B-A') h.state.closingWait = deferred();
      await h.closing();
      if (variant === 'A-B-A') { h.signIn(OTHER); h.signIn(ACCOUNT); await RTR.act(async () => { h.state.closingWait.resolve(); await tick(); }); }
      assert.equal(h.data.has(file), true, variant); assert.equal(native.recording, true, variant); assert.equal(native.released, false, variant);
    } finally { await h.close(); }
  }
});

test('voice CLOSED: disk failure reports incomplete local erasure and never claims removed bytes', async () => {
  const h = harness();
  try {
    const file = await h.write('closed.m4a'), recorder = h.recorder(); await recorder.start();
    h.state.eraseError = true;
    h.state.closingResult = { ok: true, podatak: { closing: true, execution: { state: 'CLOSED', authoritative: true, accountId: ACCOUNT } } };
    await h.closing();
    assert.equal(h.data.has(file), true); assert.match(h.closingProps().message, /nisu potpuno uklonjeni/);
    assert.equal(h.recorders[0].recording, false); await assert.rejects(() => h.write('blocked.m4a'), /VOICE_ERASURE_INCOMPLETE/);
  } finally { h.state.eraseError = false; await h.close(); }
});
