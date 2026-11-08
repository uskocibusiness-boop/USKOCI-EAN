'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function loader(stubs = {}) {
 const cache = new Map();
 function load(file) {
  file = path.resolve(ROOT, file);
  if (!path.extname(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
  if (cache.has(file)) return cache.get(file).exports;
  const source = fs.readFileSync(file, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
   target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const mod = { exports: {} }; cache.set(file, mod);
  const requireLocal = request => {
   if (Object.hasOwn(stubs, request)) return stubs[request];
   if (request.startsWith('.')) return load(path.resolve(path.dirname(file), request));
   throw Error('Unstubbed dependency: ' + request);
  };
  new Function('require', 'module', 'exports', compiled)(requireLocal, mod, mod.exports);
  return mod.exports;
 }
 return load;
}
const audioReady = Object.freeze({ messageSounds: true, notificationSounds: true, confirmed: true, pending: false, error: false });
const AndroidImportance = { UNKNOWN: 0, UNSPECIFIED: 1, NONE: 2, MIN: 3, LOW: 4, DEFAULT: 5, HIGH: 6, MAX: 7 };
function notification(n, { transport = 'transport-' + n, event = 'MESSAGE_RECEIVED', sound = 'default', generic = false } = {}) {
 const title = event === 'MESSAGE_RECEIVED' ? 'Nova poruka u Dogovoru' : 'Novi zadatak za Vas';
 const body = event === 'MESSAGE_RECEIVED' ? 'Imate novu poruku.' : 'Pojavio se novi zadatak koji može da Vam odgovara.';
 return { request: { identifier: transport, trigger: { type: 'push' }, content: { title, body, sound,
  data: generic ? { kind: 'INBOX' } : { kind: 'INBOX', eventType: event, eventId: id(n) } } } };
}
function policy() {
 const time = { now: 1000 };
 const { createForegroundAlertPolicy } = loader()('src/ui/notifications/foregroundAlertPolicy.ts');
 return { decide: createForegroundAlertPolicy(() => time.now), time };
}

test('foreground event plays once across distinct Expo transport identifiers; later message is independent', () => {
 const p = policy();
 assert.equal(p.decide(notification(1), true, audioReady).shouldPlaySound, true);
 p.time.now += 2000;
 assert.deepEqual(p.decide(notification(1, { transport: 'retry-ticket' }), true, audioReady),
  { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false });
 assert.equal(p.decide(notification(2), true, audioReady).shouldPlaySound, true);
});

test('burst creates one native sound, preserves later visible messages and consumes suppressed repeats', () => {
 const p = policy();
 assert.equal(p.decide(notification(1), true, audioReady).shouldPlaySound, true);
 p.time.now += 100;
 const next = p.decide(notification(2), true, audioReady);
 assert.equal(next.shouldShowList, true); assert.equal(next.shouldPlaySound, false);
 p.time.now += 1000;
 assert.equal(p.decide(notification(2, { transport: 'retry' }), true, audioReady).shouldPlaySound, false);
 assert.equal(p.decide(notification(3), true, audioReady).shouldPlaySound, true);
});

test('clock rollback cannot mute all new messages while the previous sound time catches up', () => {
 const p = policy(); p.time.now = 3601000;
 assert.equal(p.decide(notification(1), true, audioReady).shouldPlaySound, true);
 p.time.now = 1000;
 assert.equal(p.decide(notification(2), true, audioReady).shouldPlaySound, true);
 p.time.now = 1100;
 assert.equal(p.decide(notification(3), true, audioReady).shouldPlaySound, false);
 p.time.now = 2000;
 assert.equal(p.decide(notification(4), true, audioReady).shouldPlaySound, true);
});

test('message and other foreground sound controls are separate, and muted events are not replayed on enabling', () => {
 const p = policy();
 assert.equal(p.decide(notification(1), true, { ...audioReady, messageSounds: false }).shouldPlaySound, false);
 assert.equal(p.decide(notification(2, { event: 'OPPORTUNITY_AVAILABLE' }), true, { ...audioReady, messageSounds: false }).shouldPlaySound, true);
 p.time.now += 1000;
 assert.equal(p.decide(notification(1), true, audioReady).shouldPlaySound, false);
 assert.equal(p.decide(notification(3, { event: 'OPPORTUNITY_AVAILABLE' }), true, { ...audioReady, notificationSounds: false }).shouldPlaySound, false);
 assert.equal(p.decide(notification(4), true, { ...audioReady, notificationSounds: false }).shouldPlaySound, true);
});

test('silent source, unconfirmed persistence and pending local write cannot become audible', () => {
 for (const state of [{ ...audioReady, confirmed: false }, { ...audioReady, pending: true }, { ...audioReady, error: true }]) {
  assert.equal(policy().decide(notification(1), true, state).shouldPlaySound, false);
 }
 assert.equal(policy().decide(notification(1, { sound: null }), true, audioReady).shouldPlaySound, false);
});

test('background/stale scope, history-shaped records and unsafe payloads cannot produce an alert', () => {
 const p = policy();
 assert.equal(p.decide(notification(1), false, audioReady).shouldShowBanner, false);
 assert.equal(p.decide({ messageId: id(1), body: 'history' }, true, audioReady).shouldPlaySound, false);
 const privatePayload = notification(2); privatePayload.request.content.body = 'A private address';
 assert.equal(p.decide(privatePayload, true, audioReady).shouldPlaySound, false);
 const local = notification(3); local.request.trigger.type = 'timeInterval';
 assert.equal(p.decide(local, true, audioReady).shouldPlaySound, false);
});

test('legacy generic notification preserves transport-level dedupe without treating it as a message identity', () => {
 const p = policy();
 assert.equal(p.decide(notification(1, { generic: true }), true, audioReady).shouldPlaySound, true);
 p.time.now += 1000;
 assert.equal(p.decide(notification(1, { generic: true }), true, audioReady).shouldPlaySound, false);
 assert.equal(p.decide(notification(2, { generic: true }), true, audioReady).shouldPlaySound, true);
});

function audioStore(storage, timeout) {
 return loader({ '@react-native-async-storage/async-storage': storage })('src/data/foregroundNotificationAudio.ts')
  .createForegroundAudioStore(storage, timeout);
}

test('audio choices persist offline and become confirmed only after readback', async () => {
 let stored = null; const writes = [];
 const disk = { getItem: async () => stored, setItem: async (key, value) => { writes.push([key, value]); stored = value; } };
 const store = audioStore(disk);
 assert.equal(store.snapshot().confirmed, false);
 await store.load(); assert.equal(store.snapshot().confirmed, true);
 await store.save({ messageSounds: false, notificationSounds: true });
 assert.equal(store.snapshot().messageSounds, false); assert.equal(writes.length, 1);
 const restarted = audioStore(disk); await restarted.load();
 assert.equal(restarted.snapshot().messageSounds, false); assert.equal(restarted.snapshot().notificationSounds, true);
});

test('unconfirmed write offers read-only reconciliation and never reports a requested value as saved', async () => {
 let writes = 0; const original = JSON.stringify({ messageSounds: true, notificationSounds: true });
 const store = audioStore({ getItem: async () => original, setItem: async () => { writes++; } });
 await store.load(); await store.save({ messageSounds: false, notificationSounds: true });
 assert.equal(store.snapshot().confirmed, false); assert.equal(store.snapshot().error, true);
 assert.equal(store.snapshot().messageSounds, true);
 await store.refresh(); assert.equal(store.snapshot().confirmed, true); assert.equal(writes, 1);
});

test('timed-out local write stays fenced until settled; late completion cannot race a second write', async () => {
 let stored = null, writes = 0; const pending = deferred();
 const store = audioStore({ getItem: async () => stored, setItem: async (_key, value) => {
  writes++; await pending.promise; stored = value;
 } }, 5);
 await store.load(); await store.save({ messageSounds: false, notificationSounds: true });
 assert.equal(store.snapshot().confirmed, false);
 await store.refresh(); assert.equal(store.snapshot().confirmed, false);
 await store.save({ messageSounds: true, notificationSounds: false }); assert.equal(writes, 1);
 pending.resolve(); await Promise.resolve(); await store.refresh();
 assert.equal(store.snapshot().confirmed, true); assert.equal(store.snapshot().messageSounds, false);
});

test('malformed or failed local read is muted and recoverable without replacing existing data', async () => {
 let value = '{invalid', writes = 0;
 const store = audioStore({ getItem: async () => value, setItem: async () => { writes++; } });
 await store.load(); assert.equal(store.snapshot().confirmed, false); assert.equal(store.snapshot().error, true);
 value = JSON.stringify({ messageSounds: false, notificationSounds: false });
 await store.refresh(); assert.equal(store.snapshot().confirmed, true); assert.equal(writes, 0);
});

test('synchronous storage bridge failures cannot strand the single flight or prevent read-only recovery', async () => {
 for (const operation of ['get', 'set']) {
  let fail = true, stored = null;
  const disk = { getItem: () => {
   if (operation === 'get' && fail) throw Error('sync get failure');
   return Promise.resolve(stored);
  }, setItem: (_key, value) => {
   if (operation === 'set' && fail) throw Error('sync set failure');
   stored = value; return Promise.resolve();
  } };
  const store = audioStore(disk); await store.load();
  if (operation === 'set') await store.save({ messageSounds: false, notificationSounds: true });
  assert.equal(store.snapshot().error, true);
  fail = false; await store.refresh();
  assert.equal(store.snapshot().confirmed, true);
  await store.save({ messageSounds: false, notificationSounds: false });
  assert.equal(store.snapshot().confirmed, true); assert.equal(store.snapshot().messageSounds, false);
 }
});

test('system sound readback observes the existing default channel without changing permission, vibration or routing', async () => {
 let permission = { granted: true }, channel = { id: 'default', importance: 5, sound: 'custom', enableVibrate: false };
 const reads = [];
 const { readNativeNotificationAudio } = loader({
  'react-native': { Platform: { OS: 'android' } },
  'expo-notifications': { AndroidImportance,
   getPermissionsAsync: async () => permission,
   getNotificationChannelAsync: async value => { reads.push(value); return channel; } },
 })('src/data/nativeNotificationAudio.ts');
 assert.deepEqual(await readNativeNotificationAudio(), { kind: 'CHANNEL', enabled: true, sound: true, vibration: false });
 channel = { id: 'default', importance: 5, sound: null, enableVibrate: true };
 assert.deepEqual(await readNativeNotificationAudio(), { kind: 'CHANNEL', enabled: true, sound: false, vibration: true });
 channel = { id: 'default', importance: 2, sound: 'default', enableVibrate: true };
 assert.deepEqual(await readNativeNotificationAudio(), { kind: 'CHANNEL', enabled: false, sound: false, vibration: false });
 permission = { granted: false };
 assert.deepEqual(await readNativeNotificationAudio(), { kind: 'DENIED' }); assert.equal(reads.length, 3);
 permission = { granted: true }; channel = null;
 assert.deepEqual(await readNativeNotificationAudio(), { kind: 'CHANNEL_MISSING' });
 assert.deepEqual(reads, ['default', 'default', 'default', 'default']);
});

test('malformed native channel or permission never becomes a confirmed sound/vibration setting', async () => {
 let permission = { granted: true }, channel;
 const { readNativeNotificationAudio } = loader({
  'react-native': { Platform: { OS: 'android' } }, 'expo-notifications': { AndroidImportance,
   getPermissionsAsync: async () => permission, getNotificationChannelAsync: async () => channel },
 })('src/data/nativeNotificationAudio.ts');
 const good = { id: 'default', importance: 5, sound: 'default', enableVibrate: true };
 for (const bad of [{ sound: undefined }, { sound: '' }, { sound: false }, { importance: undefined },
  { importance: 0 }, { importance: 1 }, { importance: -1 }, { importance: '5' },
  { enableVibrate: undefined }, { enableVibrate: 1 }, { id: 'different' }]) {
  channel = { ...good, ...bad };
  await assert.rejects(readNativeNotificationAudio(), /NATIVE_NOTIFICATION_AUDIO_UNCONFIRMED/);
 }
 channel = good;
 for (const bad of [undefined, null, {}, { granted: 'true' }]) {
  permission = bad;
  await assert.rejects(readNativeNotificationAudio(), /NATIVE_NOTIFICATION_AUDIO_UNCONFIRMED/);
 }
});

test('original native sound assets reproduce exactly, use bounded mono PCM and contain no clipping', () => {
 const { CUES, SAMPLE_RATE, synthesize } = require('./notification-audio-assets.cjs');
 for (const cue of CUES) {
  const bytes = fs.readFileSync(path.join(ROOT, 'assets/audio', cue.file));
  assert.deepEqual(bytes, synthesize(cue));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  assert.equal(bytes.readUInt16LE(20), 1); assert.equal(bytes.readUInt16LE(22), 1);
  assert.equal(bytes.readUInt32LE(24), SAMPLE_RATE); assert.equal(bytes.readUInt16LE(34), 16);
  assert.ok(cue.duration > 0 && cue.duration < 0.5);
  let peak = 0;
  for (let i = 44; i < bytes.length; i += 2) peak = Math.max(peak, Math.abs(bytes.readInt16LE(i)));
  assert.ok(peak > 500 && peak < 16000, `bounded synthesized level: ${peak}`);
  assert.equal(bytes.readInt16LE(44), 0); assert.equal(bytes.readInt16LE(bytes.length - 2), 0);
 }
});

test('installed Expo Android sound plugin copies exact originals into native raw resources', () => {
 const os = require('node:os');
 const { SOUND_ASSETS } = require('./notification-audio-assets.cjs');
 const { setNotificationSounds } = require('expo-notifications/plugin/build/withNotificationsAndroid');
 const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'uskoci-notification-audio-'));
 try {
  for (const asset of SOUND_ASSETS) {
   const target = path.join(fixture, asset); fs.mkdirSync(path.dirname(target), { recursive: true });
   fs.copyFileSync(path.join(ROOT, asset), target);
  }
  setNotificationSounds(fixture, SOUND_ASSETS);
  for (const asset of SOUND_ASSETS) assert.deepEqual(
   fs.readFileSync(path.join(fixture, 'android/app/src/main/res/raw', path.basename(asset))),
   fs.readFileSync(path.join(ROOT, asset)));
  assert.throws(() => setNotificationSounds(fixture, ['./missing.wav']), /copying Android notification sounds/);
 } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});

test('preview config embeds original resources only under r2 while existing default routing and production gate remain', () => {
 const { spawnSync } = require('node:child_process');
 const check = spawnSync(process.execPath, ['-e', `
  const assert = require('node:assert/strict');
  const config = require('./app.json').expo;
  const resolved = require('./app.config.js')({config});
  assert.equal(resolved.runtimeVersion, 'uskoci-v1-preview-r2');
  assert.equal(require('./app.config.js').otaConfig.PRODUCTION_RUNTIME, 'uskoci-v1-production-r1');
  const plugin = resolved.plugins.find(p => Array.isArray(p) && p[0] === 'expo-notifications');
  assert.deepEqual(plugin[1].sounds, require('./scripts/notification-audio-assets.cjs').SOUND_ASSETS);
  assert.equal(plugin[1].defaultChannel, undefined);
 `], { cwd: ROOT, env: { ...process.env, EAS_BUILD_PROFILE: 'preview', USKOCI_OTA_TARGET: 'preview',
  USKOCI_PUSH_PROOF_BUILD: '0', EXPO_PUBLIC_USKOCI_DEV_AUTO_PUSH_ENROLL: '0' }, encoding: 'utf8' });
 assert.equal(check.status, 0, check.stderr);
});

test('actual PushRuntime checks active scope and rejects retained callbacks after account change/logout', async () => {
 const effects = [], refs = []; let cursor = 0, handler, appStateListener;
 const session = { user: { id: id(900) }, accountRevision: 1, sessionEpoch: 1 };
 const app = { currentState: 'active', addEventListener: (_name, callback) => { appStateListener = callback; return { remove() {} }; } };
 const notifications = { setNotificationHandler: value => { handler = value; },
  addNotificationResponseReceivedListener: () => ({ remove() {} }), addPushTokenListener: () => ({ remove() {} }),
  getLastNotificationResponseAsync: async () => null, clearLastNotificationResponseAsync: async () => {} };
 const load = loader({
  react: { useRef: value => refs[cursor++] ??= { current: value }, useEffect: effect => { effects.push(effect); } },
  'react-native': { AppState: app, Platform: { OS: 'android' } }, 'expo-notifications': notifications,
  'expo-router': { router: { navigate() { throw Error('Unexpected navigation'); } } },
  '../../store/pendingRoute': { pendingRoute: {} }, '../../store/messagePushIntent': { messagePushIntent: { snapshot: () => null, clear() {} }, ownsMessagePush: () => false },
  '../../store/sesija': { useSesija: () => session, sesijaSada: () => session },
  '../../data/nativePushDevice': { nativePushDevice: async () => { throw Error('No registration'); } },
  '../../data/pushDeviceClientService': { pushDeviceClientService: { sessionDevice: async () => ({ ok: false }) }, revokePushBeforeLogout() {} },
  '../../data/foregroundNotificationAudio': { foregroundNotificationAudio: { load: async () => {}, snapshot: () => audioReady } },
 });
 const { PushRuntime } = load('src/ui/notifications/PushRuntime.tsx');
 PushRuntime({ ready: true }); const cleanup = effects.shift()();
 const retained = handler.handleNotification;
 assert.equal((await retained(notification(1))).shouldPlaySound, true);
 assert.equal((await retained(notification(1, { transport: 'redelivery' }))).shouldPlaySound, false);
 app.currentState = 'background'; appStateListener('background');
 assert.equal((await retained(notification(2))).shouldShowBanner, false);
 app.currentState = 'active'; appStateListener('active');
 session.user = { id: id(901) }; session.accountRevision++;
 assert.equal((await retained(notification(3))).shouldPlaySound, false);
 session.user = null;
 assert.equal((await retained(notification(4))).shouldShowBanner, false);
 cleanup(); assert.equal(handler, null);
 assert.equal((await retained(notification(5))).shouldPlaySound, false);
});
