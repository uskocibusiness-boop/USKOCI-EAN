'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { React, RTR, createHarness, deferred, mount, unmount } = require('./ux-component-harness.cjs');
const uuid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const accountId = uuid(1), agreementId = uuid(2);
function receipt(ref, state = 'READY') {
  const assetId = state === 'ABSENT' ? null : uuid(1000 + Number(ref.clientRequestId.slice(-6)));
  return { ...ref, accountId, assetId, state, attachedMessageId: null, authoritative: true,
    photo: state === 'READY' ? { assetId, width: 640, height: 480, byteSize: 32, contentType: 'image/jpeg' } : null };
}
const ok = podatak => ({ ok: true, podatak });
const unknown = () => ({ ok: false, kod: 'AGREEMENT_PHOTO_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
function hookFixture() {
  let current, key = 10, uploadResult, readResult, pending;
  const session = { user: { id: accountId }, accountRevision: 1 };
  const refs = new Map(), server = new Map(), calls = { upload: [], read: [], list: 0, pick: 0 };
  const service = {
    upload: async (ref, bytes, scope, signal) => {
      assert.ok(refs.has(ref.clientRequestId), 'journal must own the command before dispatch');
      calls.upload.push({ ref, bytes, scope, signal });
      if (pending) return pending.promise;
      const r = uploadResult ?? ok(receipt(ref));
      if (r.ok) server.set(ref.clientRequestId, r.podatak);
      return r;
    },
    read: async ref => { calls.read.push(ref); return readResult ?? ok(server.get(ref.clientRequestId) ?? receipt(ref, 'ABSENT')); },
    list: async () => { calls.list++; return ok([]); },
    cancel: async ref => { const r = receipt(ref, 'CANCELLED'); server.set(ref.clientRequestId, r); return ok(r); },
  };
  const h = createHarness({
    'expo-router': { useFocusEffect: cb => React.useEffect(cb, [cb]) },
    'src/store/sesija.ts': { useSesija: () => session, sesijaSada: () => session },
    'src/data/agreementPhotoClientService.ts': { agreementPhotoClientService: service },
    'src/data/agreementPhotoJournal.ts': { agreementPhotoJournal: {
      load: async () => [...refs.values()],
      save: async (_account, ref, valid) => { if (valid()) refs.set(ref.clientRequestId, ref); },
      clear: async (_account, ref, valid) => { if (valid()) refs.delete(ref.clientRequestId); },
    } },
    'src/features/media/nativePhotoPicker.ts': {
      pickPreparedPhoto: async () => { calls.pick++; return { bytes: new ArrayBuffer(32), width: 640, height: 480, contentType: 'image/jpeg' }; },
      photoSelectionMessage: () => 'Fotografija nije pripremljena.',
    },
    'src/lib/idempotencija.ts': { noviUuidZahtevId: () => uuid(++key) },
  });
  const { useAgreementPhotos } = h.load('src/hooks/useAgreementPhotos.ts');
  const outbox = { getSnapshot: () => ({ capturing: false, entries: [] }) };
  function Host() { current = useAgreementPhotos(accountId, agreementId, 1, true, outbox); return null; }
  return { Host, session, refs, calls, get current() { return current; },
    setUpload: r => { uploadResult = r; }, setRead: r => { readResult = r; },
    deferUpload: () => { pending = deferred(); return pending; } };
}
test('six successful photographs use six uploads, with no repeated status/inventory reads', async () => {
  const f = hookFixture(), r = await mount(f.Host, {});
  try {
    assert.equal(f.calls.list, 1, 'one initial recovery inventory');
    for (let i = 0; i < 6; i++) await RTR.act(async () => { await f.current.pick('LIBRARY'); });
    assert.equal(f.calls.upload.length, 6);
    assert.equal(f.calls.read.length, 0);
    assert.equal(f.calls.list, 1);
    assert.equal(f.refs.size, 6, 'confirmed uploads remain journaled until message attachment');
    assert.equal(f.current.capture().assetIds.length, 6);
    assert.equal(f.current.ready, true);
    await RTR.act(async () => { await f.current.pick('LIBRARY'); });
    assert.equal(f.calls.upload.length, 6, 'six-photo limit is unchanged');
    await RTR.act(async () => { await f.current.refresh(); });
    assert.equal(f.calls.read.length, 6, 'explicit refresh still reconciles every selected asset');
    assert.equal(f.calls.list, 2);
  } finally { await unmount(r); }
});
test('uncertain upload keeps its identity and performs readback without another upload', async () => {
  const f = hookFixture(); f.setUpload(unknown()); f.setRead(unknown());
  const r = await mount(f.Host, {});
  try {
    await RTR.act(async () => { await f.current.pick('LIBRARY'); });
    assert.equal(f.calls.upload.length, 1); assert.equal(f.calls.read.length, 1);
    assert.equal(f.refs.size, 1); assert.equal(f.current.capture(), null);
    await RTR.act(async () => { await f.current.pick('LIBRARY'); });
    assert.equal(f.calls.upload.length, 1, 'unknown state blocks a new selection');
    const ref = [...f.refs.values()][0]; f.setRead(ok(receipt(ref)));
    await RTR.act(async () => { await f.current.retry(ref); });
    assert.equal(f.calls.upload.length, 1, 'readback READY never resends bytes');
    assert.equal(f.current.capture().assetIds.length, 1);
  } finally { await unmount(r); }
});
test('only authoritative ABSENT permits explicit retry with the same command identity', async () => {
  const f = hookFixture(); f.setUpload(unknown());
  const r = await mount(f.Host, {});
  try {
    await RTR.act(async () => { await f.current.pick('LIBRARY'); });
    const ref = [...f.refs.values()][0]; f.setUpload(undefined);
    await RTR.act(async () => { await f.current.retry(ref); });
    assert.equal(f.calls.upload.length, 2);
    assert.deepEqual(f.calls.upload.map(c => c.ref), [ref, ref]);
    assert.equal(f.current.ready, true);
  } finally { await unmount(r); }
});
test('repeated send presses share the in-flight reservation; blur aborts and retains recovery identity', async () => {
  const f = hookFixture(), d = f.deferUpload(), r = await mount(f.Host, {});
  let first;
  await RTR.act(async () => { first = f.current.pick('LIBRARY'); await Promise.resolve(); await Promise.resolve(); });
  await RTR.act(async () => { await f.current.pick('LIBRARY'); });
  assert.equal(f.calls.upload.length, 1); assert.equal(f.calls.pick, 1);
  const call = f.calls.upload[0]; await unmount(r);
  assert.equal(call.signal.aborted, true); assert.equal(f.refs.size, 1);
  await RTR.act(async () => { d.resolve(ok(receipt(call.ref))); await first; });
  assert.equal(f.refs.size, 1, 'a late acknowledgement cannot erase the durable recovery key');
  assert.equal(f.calls.read.length, 0, 'blur cannot initiate new recovery reads');
});
test('a late upload after account switch cannot authorize the previous account capture', async () => {
  const f = hookFixture(), d = f.deferUpload(), r = await mount(f.Host, {});
  try {
    let pending;
    await RTR.act(async () => { pending = f.current.pick('LIBRARY'); await Promise.resolve(); await Promise.resolve(); });
    const ref = f.calls.upload[0].ref;
    f.session.user = { id: uuid(9) }; f.session.accountRevision = 2;
    await RTR.act(async () => { d.resolve(ok(receipt(ref))); await pending; });
    assert.equal(f.current.capture(), null); assert.equal(f.refs.size, 1);
    assert.equal(f.calls.read.length, 0);
  } finally { await unmount(r); }
});
function serviceFixture() {
  const calls = [], timers = [];
  const session = { user: { id: accountId }, accountRevision: 1 };
  let result;
  const h = createHarness({
    'src/store/sesija.ts': { sesijaSada: () => session },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => ({ functions: {
      invoke: async (name, options) => { calls.push({ name, ...options }); return typeof result === 'function' ? result(options) : result; },
    } }) },
  }, { 'src/data/serverReceipt.ts': {
    setTimeout: (fn, ms) => { const t = { fn, ms }; timers.push(t); return t; }, clearTimeout: () => {},
  } });
  return { service: h.load('src/data/agreementPhotoClientService.ts').agreementPhotoClientService, load: h.load, calls, timers, session,
    setResult: r => { result = r; } };
}
test('upload waits within a 55-second owner budget and forwards its cancellation signal', async () => {
  const f = serviceFixture(), ref = { agreementId, agreementVersion: 1, clientRequestId: uuid(10) };
  const d = deferred(); f.setResult(() => d.promise);
  const external = new AbortController();
  const pending = f.service.upload(ref, new ArrayBuffer(32), { accountId, accountRevision: 1 }, external.signal);
  assert.equal(f.timers[0].ms, 55_000);
  assert.notEqual(f.calls[0].signal, external.signal, 'transport uses the bounded owner signal');
  external.abort(); const r = await pending;
  assert.equal(r.ok, false); assert.equal(f.calls[0].signal.aborted, true);
  d.resolve({ data: receipt(ref), error: null });
});
test('owner timeout aborts upload but never reports server rollback or sends it again', async () => {
  const f = serviceFixture(), ref = { agreementId, agreementVersion: 1, clientRequestId: uuid(10) };
  const d = deferred(); f.setResult(() => d.promise);
  const pending = f.service.upload(ref, new ArrayBuffer(32)); f.timers[0].fn();
  const r = await pending;
  assert.equal(r.ok, false); assert.equal(r.kod, 'AGREEMENT_PHOTO_UNCONFIRMED');
  assert.equal(f.calls[0].signal.aborted, true); assert.equal(f.calls.length, 1);
  d.resolve({ data: receipt(ref), error: null });
});
test('upload rejects a receipt belonging to another account, agreement, command or malformed photo', async () => {
  const ref = { agreementId, agreementVersion: 1, clientRequestId: uuid(10) };
  for (const change of [{ accountId: uuid(9) }, { agreementId: uuid(9) }, { clientRequestId: uuid(9) },
    { authoritative: false }, { photo: { ...receipt(ref).photo, byteSize: 0 } }]) {
    const f = serviceFixture(); f.setResult({ data: { ...receipt(ref), ...change }, error: null });
    assert.equal((await f.service.upload(ref, new ArrayBuffer(32))).ok, false);
  }
});
test('ordinary status reads retain their 15-second budget and revoked access stays a failure', async () => {
  const f = serviceFixture(), ref = { agreementId, agreementVersion: 1, clientRequestId: uuid(10) };
  f.setResult({ data: null, error: { message: 'MEDIA_NOT_FOUND' } });
  const r = await f.service.read(ref);
  assert.equal(f.timers[0].ms, 15_000); assert.equal(r.ok, false); assert.equal(r.kod, 'MEDIA_NOT_FOUND');
});
for (const kind of ['TASK', 'AVATAR']) {
  test(kind + ' upload also shares the bounded owner cancellation without replay', async () => {
    const f = serviceFixture(), service = f.load('src/data/mediaClientService.ts');
    const d = deferred(); f.setResult(() => d.promise);
    const external = new AbortController();
    const input = { clientRequestId: uuid(11), bytes: new ArrayBuffer(32), contentType: 'image/jpeg' };
    const pending = kind === 'TASK'
      ? service.mediaClientService.uploadTaskPhoto({ ...input, conversationId: uuid(12) }, { signal: external.signal })
      : service.mediaClientService.uploadAvatar({ ...input, profileId: uuid(12) }, { signal: external.signal });
    assert.equal(f.timers[0].ms, 55_000); external.abort();
    assert.equal((await pending).ok, false); assert.equal(f.calls[0].signal.aborted, true);
    assert.equal(f.calls.length, 1); d.resolve({ data: null, error: null });
  });
}
