'use strict';
// Production gallery and owned read hook; native hosts only. No Android/pixel claim.
const test = require('node:test');
const assert = require('node:assert/strict');
const { React, RTR, createHarness, deferred, mount, nodes, target, press, unmount } = require('./ux-component-harness.cjs');

const photos = [
  { assetId: 'portrait', width: 600, height: 1200, contentType: 'image/jpeg' },
  { assetId: 'panorama', width: 1600, height: 400, contentType: 'image/jpeg' },
];
const ok = (items = photos, needId = 'need') => ({ ok: true, podatak: { needId, photos: items, authoritative: true } });
const failure = { ok: false, kod: 'MEDIA_UNAVAILABLE', poruka: 'Fotografije nisu učitane.' };
function galleryHarness(read) {
  let session = { user: { id: 'account-a' }, accountRevision: 1 }, failedBytes = false;
  const h = createHarness({
    'expo-router': { useFocusEffect: cb => React.useEffect(cb, [cb]) },
    'src/store/sesija.ts': { useSesija: () => session, sesijaSada: () => session },
    'src/data/mediaClientService.ts': { mediaClientService: { readNeedPhotos: id => read(id, session.user.id) } },
    'src/ui/media/ownPhotoCache.ts': { ownPhotoCache: {} },
    'src/ui/media/AuthorizedPhoto.tsx': { AuthorizedPhoto: 'AuthorizedPhoto' },
    'src/ui/media/PhotoViewer.tsx': {
      PhotoPages: p => React.createElement('PhotoPages', p, failedBytes
        ? p.photos.map(item => React.createElement(React.Fragment, { key: item.assetId }, p.unavailable(item.assetId))) : null),
      PhotoViewer: 'PhotoViewer',
    },
  });
  return { NeedPhotos: h.load('src/ui/media/ContextPhotos.tsx').NeedPhotos,
    switchAccount: () => { session = { user: { id: 'account-b' }, accountRevision: 2 }; },
    failBytes: value => { failedBytes = value; } };
}
const pages = r => nodes(r, n => n.type === 'PhotoPages');
const status = r => nodes(r, n => n.props.testID === 'task-photo-status');

test('pending metadata is explicit; authoritative no-photo result leaves no gallery or empty frame', async () => {
  const waiting = deferred(); let reads = 0;
  const { NeedPhotos } = galleryHarness(() => { reads++; return waiting.promise; });
  const r = await mount(NeedPhotos, { needId: 'need' });
  assert.equal(status(r).length, 1);
  assert.equal(nodes(r, n => n.props.accessibilityState?.busy === true).length, 1);
  assert.equal(pages(r).length, 0);
  await RTR.act(async () => waiting.resolve(ok([])));
  assert.equal(status(r).length, 0); assert.equal(pages(r).length, 0);
  assert.equal(reads, 1);
  await unmount(r);
});

test('list failure stays distinct from no photos and only explicit retry reads again', async () => {
  let reads = 0;
  const { NeedPhotos } = galleryHarness(async () => ++reads === 1 ? failure : ok());
  const r = await mount(NeedPhotos, { needId: 'need' });
  assert.equal(reads, 1); assert.equal(status(r).length, 1); assert.equal(pages(r).length, 0);
  await press(target(r, 'Pokušajte ponovo'));
  assert.equal(reads, 2); assert.equal(status(r).length, 0);
  assert.deepEqual(pages(r)[0].props.photos, photos);
  assert.deepEqual(pages(r)[0].props.context, { needId: 'need' });
  await unmount(r);
});

test('if every image fails the gallery offers compact recovery instead of a large empty frame or false absence', async () => {
  let reads = 0;
  const h = galleryHarness(async () => { reads++; return ok(); }); h.failBytes(true);
  const r = await mount(h.NeedPhotos, { needId: 'need' });
  assert.equal(status(r).length, 1); assert.equal(pages(r).length, 0);
  assert.equal(reads, 1);
  h.failBytes(false); await press(target(r, 'Pokušajte ponovo'));
  assert.equal(status(r).length, 0); assert.equal(pages(r).length, 1);
  assert.equal(reads, 1, 'retry of failed bytes does not issue a new list mutation or unrelated read');
  assert.deepEqual(pages(r)[0].props.context, { needId: 'need' });
  await unmount(r);
});

test('late metadata from the previous account cannot create its gallery after account switch', async () => {
  const previous = deferred(), next = deferred(); const reads = [];
  const h = galleryHarness((id, account) => { reads.push([id, account]); return account === 'account-a' ? previous.promise : next.promise; });
  const r = await mount(h.NeedPhotos, { needId: 'need' });
  h.switchAccount();
  await RTR.act(async () => r.update(React.createElement(h.NeedPhotos, { needId: 'need' })));
  await RTR.act(async () => previous.resolve(ok()));
  assert.equal(pages(r).length, 0);
  await RTR.act(async () => next.resolve(ok([])));
  assert.equal(status(r).length, 0); assert.equal(pages(r).length, 0);
  assert.deepEqual(reads, [['need', 'account-a'], ['need', 'account-b']]);
  await unmount(r);
});

test('inline portrait and panorama preserve full content, measured pages and exact read context through resize', async () => {
  const h = createHarness({
    'src/ui/media/AuthorizedPhoto.tsx': { AuthorizedPhoto: 'AuthorizedPhoto' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'src/ui/system/ScreenChrome.tsx': { ChromeIconButton: 'ChromeIconButton' },
    'src/ui/system/motion.ts': { useReducedMotion: () => true },
  });
  const { PhotoPages } = h.load('src/ui/media/PhotoViewer.tsx');
  const context = { needId: 'need' }, chosen = [], opened = [];
  const r = await mount(PhotoPages, { context, photos, index: 1, onIndex: i => chosen.push(i), onOpen: i => opened.push(i) });
  const viewport = () => nodes(r, n => n.props.testID === 'task-photo-viewport')[0];
  await RTR.act(async () => viewport().props.onLayout({ nativeEvent: { layout: { width: 320, height: 240 } } }));
  const images = () => nodes(r, n => n.type === 'AuthorizedPhoto');
  assert.equal(images().length, 2);
  for (const item of images()) {
    assert.equal(item.props.contentFit, 'contain'); assert.equal(item.props.needId, 'need');
    assert.deepEqual(item.props.style, { width: 320, height: 240, aspectRatio: undefined, borderRadius: 0 });
  }
  await RTR.act(async () => images()[1].props.open.onPress()); assert.deepEqual(opened, [1]);
  await RTR.act(async () => viewport().props.onLayout({ nativeEvent: { layout: { width: 430, height: 322.5 } } }));
  const pager = nodes(r, n => n.props.testID === 'task-photo-pages')[0];
  assert.equal(pager.props.contentOffset.x, 430, 'resize retains selected photo');
  for (const item of images()) assert.equal(item.props.style.width, 430);
  await RTR.act(async () => pager.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 9999 } } }));
  assert.deepEqual(chosen, [1], 'settled page is clamped to existing photos');
  await unmount(r);
});

test('full viewer retains private context, uses Reduce Motion and closes through Android Back', async () => {
  const h = createHarness({
    'src/ui/media/AuthorizedPhoto.tsx': { AuthorizedPhoto: 'AuthorizedPhoto' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'src/ui/system/ScreenChrome.tsx': { ChromeIconButton: 'ChromeIconButton' },
    'src/ui/system/motion.ts': { useReducedMotion: () => true },
  }); h.native.Modal = 'Modal';
  const { PhotoViewer } = h.load('src/ui/media/PhotoViewer.tsx');
  const context = { agreementId: 'agreement', messageId: 'message' }; let closed = 0;
  const r = await mount(PhotoViewer, { context, photos, index: 1, onIndex() {}, onClose() { closed++; } });
  const viewport = nodes(r, n => n.props.testID === 'task-photo-viewer-viewport')[0];
  await RTR.act(async () => viewport.props.onLayout({ nativeEvent: { layout: { width: 360, height: 640 } } }));
  for (const item of nodes(r, n => n.type === 'AuthorizedPhoto')) {
    assert.equal(item.props.contentFit, 'contain'); assert.equal(item.props.agreementId, 'agreement');
    assert.equal(item.props.messageId, 'message'); assert.equal(item.props.open, undefined);
  }
  const modal = nodes(r, n => n.type === 'Modal')[0]; assert.equal(modal.props.animationType, 'none');
  await RTR.act(async () => modal.props.onRequestClose()); assert.equal(closed, 1);
  await unmount(r);
});
