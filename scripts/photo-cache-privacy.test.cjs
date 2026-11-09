'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { React, RTR, createHarness, mount, unmount } = require('./ux-component-harness.cjs');
const { createPhotoMemoryCache } = createHarness().load('src/ui/media/photoMemoryCache.ts');
test('photo cache enforces both byte and entry budgets and evicts least recently used data', () => {
  const c = createPhotoMemoryCache(20, 2, 100), mark = c.mark();
  c.set('a', '12345', mark, 0); c.set('b', '67890', mark, 0);
  assert.equal(c.retainedBytes, 20); assert.equal(c.size, 2);
  assert.equal(c.get('a', 1), '12345'); c.set('c', 'abcde', mark, 2);
  assert.equal(c.get('b', 3), undefined); assert.equal(c.get('a', 3), '12345');
  assert.equal(c.retainedBytes, 20); assert.equal(c.size, 2);
  c.set('huge', 'x'.repeat(11), mark, 4);
  assert.equal(c.get('huge', 4), undefined); assert.equal(c.retainedBytes, 20);
});
test('expired, future-dated and replaced photos release the retained byte budget', () => {
  const c = createPhotoMemoryCache(100, 10, 100), mark = c.mark();
  c.set('a', '12345', mark, 0); c.set('a', '12', mark, 10);
  assert.equal(c.retainedBytes, 4); assert.equal(c.size, 1);
  assert.equal(c.get('a', 110), undefined); assert.equal(c.retainedBytes, 0);
  c.set('a', '12345', mark, 200);
  assert.equal(c.get('a', 199), undefined); assert.equal(c.retainedBytes, 0);
});
test('background invalidation prevents late network reads from repopulating the cache', () => {
  const c = createPhotoMemoryCache(100, 10, 100), mark = c.mark();
  c.set('a', '12345', mark, 0); c.clear(); c.set('late', '12345', mark, 1);
  assert.equal(c.retainedBytes, 0); assert.equal(c.size, 0);
  c.set('fresh', '12345', c.mark(), 2); assert.equal(c.retainedBytes, 10);
});
test('forget evicts only the failed binding and releases its bytes without clearing other reads', () => {
  const c = createPhotoMemoryCache(100, 10, 100), mark = c.mark();
  c.set('failed', '12345', mark, 0); c.set('other', 'abc', mark, 0);
  c.forget('failed');
  assert.equal(c.get('failed', 1), undefined);
  assert.equal(c.get('other', 1), 'abc');
  assert.equal(c.retainedBytes, 6); assert.equal(c.size, 1);
  c.forget('failed');
  assert.equal(c.retainedBytes, 6);
  c.set('other-in-flight', 'xy', mark, 2);
  assert.equal(c.get('other-in-flight', 3), 'xy');
  assert.equal(c.retainedBytes, 10);
});
test('a decoded image failure is read again after gallery retry while unrelated cached photos remain', async () => {
  const reads = [];
  const session = { user: { id: 'owner' }, accountRevision: 1 };
  const h = createHarness({
    'expo-router': { useFocusEffect: cb => React.useEffect(cb, [cb]) },
    'expo-image': { Image: 'ExpoImage' },
    'src/store/sesija.ts': { sesijaSada: () => session, useSesija: () => session },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => { throw Error('unexpected direct transport'); } },
    'src/data/mediaClientService.ts': { mediaClientService: { readMedia: async assetId => {
      reads.push(assetId);
      return { ok: true, podatak: { bytes: new Uint8Array([255,216,255,217]).buffer } };
    } } },
  });
  const { AuthorizedPhoto } = h.load('src/ui/media/AuthorizedPhoto.tsx');
  const failedProps = { assetId: 'failed', needId: 'need', label: 'Fotografija zadatka' };
  const otherProps = { assetId: 'other', needId: 'need', label: 'Druga fotografija zadatka' };
  let failed = await mount(AuthorizedPhoto, failedProps);
  let other = await mount(AuthorizedPhoto, otherProps);
  assert.deepEqual(reads, ['failed', 'other']);
  await RTR.act(async () => failed.root.findByType('ExpoImage').props.onError());
  assert.equal(failed.root.findAllByType('ExpoImage').length, 0);
  // NeedPhotos removes failed pages. Its explicit retry remounts the same asset.
  await unmount(failed); failed = await mount(AuthorizedPhoto, failedProps);
  assert.deepEqual(reads, ['failed', 'other', 'failed']);
  assert.equal(failed.root.findAllByType('ExpoImage').length, 1);
  await unmount(other); other = await mount(AuthorizedPhoto, otherProps);
  assert.deepEqual(reads, ['failed', 'other', 'failed']);
  assert.equal(other.root.findAllByType('ExpoImage').length, 1);
  await unmount(failed); await unmount(other);
});
for (const privateContext of [{ agreementId: 'agreement', messageId: 'message' }, { caseId: 'case' }]) {
  test('private media rechecks access on a new visit and never displays cached bytes after denial: ' + JSON.stringify(privateContext), async () => {
    let reads = 0, allowed = true;
    const session = { user: { id: 'owner' }, accountRevision: 1 };
    const h = createHarness({
      'expo-router': { useFocusEffect: cb => React.useEffect(cb, [cb]) },
      'expo-image': { Image: 'ExpoImage' },
      'src/store/sesija.ts': { sesijaSada: () => session, useSesija: () => session },
      'src/data/supabaseClient.ts': { supabaseKlijent: () => { throw Error('unexpected direct transport'); } },
      'src/ui/media/ownPhotoCache.ts': { ownPhotoCache: {
        image: () => { throw Error('private media must not use the avatar cache'); }, mark: () => 0,
      } },
      'src/data/mediaClientService.ts': { mediaClientService: { readMedia: async () => {
        reads++; return allowed ? { ok: true, podatak: { bytes: new Uint8Array([255,216,255,217]).buffer } }
          : { ok: false, kod: 'MEDIA_NOT_FOUND', poruka: 'Fotografija nije dostupna.' };
      } } },
    });
    const { AuthorizedPhoto } = h.load('src/ui/media/AuthorizedPhoto.tsx');
    const props = { assetId: 'asset', label: 'Privatna fotografija', own: true, ...privateContext };
    let r = await mount(AuthorizedPhoto, props);
    assert.equal(reads, 1); assert.equal(r.root.findAllByType('ExpoImage').length, 1);
    await unmount(r); allowed = false; r = await mount(AuthorizedPhoto, props);
    assert.equal(reads, 2); assert.equal(r.root.findAllByType('ExpoImage').length, 0);
    await unmount(r);
  });
}
