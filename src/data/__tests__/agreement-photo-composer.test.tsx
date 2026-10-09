import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AgreementPhotosController } from '../../hooks/useAgreementPhotos';
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  return ['View', 'ScrollView', 'Modal', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('../../ui/system/PermissionRecovery', () => ({ PermissionRecovery: 'PermissionRecovery' }));
jest.mock('../../ui/media/PhotoAttachSheet', () => ({ PhotoAttachSheet: 'PhotoAttachSheet' }));
let mockReduced = false;
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-image', () => ({ Image: 'NativeImage' }));
const mockAsk = jest.fn(), mockConfirmOptions = jest.fn();
jest.mock('../../ui/system/ConfirmSheet', () => ({ useConfirmSheet: (options: unknown) => { mockConfirmOptions(options); return { ask: (...a: unknown[]) => mockAsk(...a), close: jest.fn(), open: false, sheet: null }; } }));
import { AgreementPhotoComposer, AgreementPhotoSheet, agreementPhotoReason } from '../../ui/media/AgreementPhotoComposer';
import { PhotoViewer } from '../../ui/media/PhotoViewer';
import { PHOTO_PERMISSION_MESSAGE } from '../../features/media/nativePhotoPicker';
import { photoLimits } from '../../ui/media/photoWords';
const gid = '22222222-2222-4222-8222-222222222222', rid = '33333333-3333-4333-8333-333333333333', asset = '44444444-4444-4444-8444-444444444444';
const ref = { agreementId: gid, agreementVersion: 2, clientRequestId: rid };
const receipt = { ...ref, accountId: gid, assetId: asset, state: 'READY' as const, attachedMessageId: null,
  photo: { assetId: asset, width: 1600, height: 900, byteSize: 30, contentType: 'image/jpeg' as const }, authoritative: true as const };
let tree: ReactTestRenderer, photos: AgreementPhotosController;
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const has = (label: string) => tree.root.findAllByProps({ accessibilityLabel: label }).length > 0;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(v => typeof v === 'string')).join(' ');
const draw = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const tray = (extra: Partial<React.ComponentProps<typeof AgreementPhotoComposer>> = {}) =>
  <AgreementPhotoComposer photos={photos} capturing={false} {...extra} />;
beforeEach(() => { mockAsk.mockReset(); mockConfirmOptions.mockReset(); mockReduced = false; photos = { agreementId: gid, loaded: true, busy: false, items: [], saved: [], message: null, available: true,
  hasSelection: false, selected: [], versionConflict: false, ready: false, capture: jest.fn(() => null), canSubmit: () => true,
  preview: () => undefined, reserved: () => false, canRetry: () => false, refresh: jest.fn().mockResolvedValue(undefined), pick: jest.fn().mockResolvedValue(undefined),
  retry: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined), restore: jest.fn().mockResolvedValue(undefined) }; });
afterEach(async () => { await act(async () => tree?.unmount()); });

// Owner, 2026-10-07: the Dogovor's photos use the same element as the task conversation: the shared sheet (Galerija, Kamera,
// one limits sentence), the shared tiles (corner X after a question, tap for the full-screen viewer), the same words.
it('the "+" is the shared sheet: one photo per pick, the Dogovor limits sentence, and the way back to earlier photos', async () => {
  const onClose = jest.fn(), onShowSaved = jest.fn();
  await draw(<AgreementPhotoSheet photos={photos} capturing={false} onClose={onClose} onShowSaved={onShowSaved} />);
  const sheet = () => tree.root.findByType('PhotoAttachSheet' as React.ElementType).props;
  expect(sheet()).toMatchObject({ multiple: false, remaining: 6, disabledReason: null, limits: photoLimits('AGREEMENT'), rows: [] });
  expect(photos.pick).not.toHaveBeenCalled();
  await act(async () => sheet().onPick('CAMERA')); expect(photos.pick).toHaveBeenCalledWith('CAMERA');
  photos = { ...photos, saved: [receipt], available: false, items: [{ ref, receipt: null }] };
  await act(async () => tree.update(<AgreementPhotoSheet photos={photos} capturing={false} onClose={onClose} onShowSaved={onShowSaved} />));
  expect(sheet().disabledReason).toBe('Sačekaj da se fotografija pošalje.');
  expect(sheet().rows).toHaveLength(1); expect(sheet().rows[0].label).toBe('Ranije pripremljene fotografije (1)');
  await act(async () => sheet().rows[0].onPress()); expect(onShowSaved).toHaveBeenCalledTimes(1);
});

it('says why the sources are grey by cause, and nothing while busy or when the read itself failed', () => {
  const six = Array.from({ length: 6 }, (_, n) => ({ ref: { ...ref, clientRequestId: `${rid.slice(0, -1)}${n}` }, receipt }));
  expect(agreementPhotoReason({ ...photos, available: false, items: six }, false)).toBe('Već je izabrano 6 fotografija.');
  expect(agreementPhotoReason({ ...photos, available: false }, false)).toBe('Osveži uslove Dogovora pre nove fotografije.');
  expect(agreementPhotoReason({ ...photos, available: false, loaded: false }, false)).toBeNull();
  expect(agreementPhotoReason({ ...photos, available: false, busy: true }, false)).toBeNull();
  expect(agreementPhotoReason(photos, false)).toBeNull();
});

it('an uncertain photo is a tile that says so; its X asks first, and only the answer removes it', async () => {
  photos.items = [{ ref, receipt: null }]; photos.available = false; photos.message = 'Ishod nije potvrđen.';
  await draw(tray());
  expect(photos.pick).not.toHaveBeenCalled(); expect(photos.refresh).not.toHaveBeenCalled();
  expect(texts()).toContain('Ne znamo da li je poslato'); expect(texts()).toContain('Ne znamo da li je fotografija poslata.');
  await act(async () => button('Ukloni pripremljenu fotografiju 1').props.onPress());
  expect(photos.remove).not.toHaveBeenCalled();
  expect(mockAsk.mock.calls[0][0]).toMatchObject({ title: 'Ukloniti fotografiju?', confirmLabel: 'Ukloni', tone: 'danger' });
  await act(async () => { await mockAsk.mock.calls[0][0].onConfirm(); }); expect(photos.remove).toHaveBeenCalledWith(ref);
  await act(async () => button('Proveri fotografije poruke').props.onPress()); expect(photos.refresh).toHaveBeenCalledTimes(1);
});

it('a ready photo opens the shared full-screen viewer in the Dogovor context; a reserved one has no X and no resend', async () => {
  photos.items = [{ ref, receipt }]; photos.canRetry = jest.fn(() => true);
  await draw(tray());
  const image = tree.root.findByType('AuthorizedPhoto' as React.ElementType);
  expect(image.props).toMatchObject({ assetId: asset, agreementId: gid });
  expect(has('Pošalji ponovo · fotografija 1')).toBe(false);
  await act(async () => image.props.open.onPress());
  expect(tree.root.findByType(PhotoViewer).props).toMatchObject({ context: { agreementId: gid }, photos: [{ assetId: asset }], title: 'Fotografije uz poruku' });
  photos = { ...photos, reserved: () => true };
  await act(async () => tree.update(tray()));
  expect(texts()).toContain('Fotografija je uz poruku. Prvo proveri da li je poslata.');
  expect(has('Ukloni pripremljenu fotografiju 1')).toBe(false); expect(has('Pošalji ponovo · fotografija 1')).toBe(false);
  expect(photos.remove).not.toHaveBeenCalled(); expect(photos.retry).not.toHaveBeenCalled();
});

it('a photo whose sending was not started is sent again from its own tile', async () => {
  photos.items = [{ ref, receipt: { ...receipt, assetId: null, state: 'ABSENT', photo: null } }]; photos.canRetry = () => true;
  await draw(tray());
  expect(texts()).toContain('Slanje fotografije nije započeto.');
  await act(async () => button('Pošalji ponovo · fotografija 1').props.onPress()); expect(photos.retry).toHaveBeenCalledWith(ref);
});

it('shows a changed Dogovor without dropping the photo, and the denied camera keeps the gallery as the way forward', async () => {
  photos.items = [{ ref, receipt }]; photos.versionConflict = true; photos.reserved = () => true;
  await draw(tray());
  expect(texts()).toContain('Uslovi Dogovora su se promenili');
  expect(photos.remove).not.toHaveBeenCalled(); expect(photos.pick).not.toHaveBeenCalled();
  photos = { ...photos, versionConflict: false, items: [], message: PHOTO_PERMISSION_MESSAGE };
  await act(async () => tree.update(tray()));
  const recovery = tree.root.findByType('PermissionRecovery' as React.ElementType).props;
  expect(recovery.alternative).toBe('Galerija');
  await act(async () => recovery.onAlternative()); expect(photos.pick).toHaveBeenCalledWith('LIBRARY');
});

it('earlier prepared photos come back only when asked for, without loading their pictures, and not past six', async () => {
  photos.saved = [receipt];
  await draw(tray());
  expect(has('Vrati sačuvanu fotografiju 1')).toBe(false);
  await act(async () => tree.update(tray({ showSaved: true, onHideSaved: jest.fn() })));
  expect(tree.root.findAllByType('AuthorizedPhoto' as React.ElementType)).toHaveLength(0);
  await act(async () => button('Vrati sačuvanu fotografiju 1').props.onPress()); expect(photos.restore).toHaveBeenCalledWith(rid);
  photos = { ...photos, available: false, items: Array.from({ length: 6 }, (_, n) => ({ ref: { ...ref, clientRequestId: `${rid.slice(0, -1)}${n}` }, receipt: null })) };
  await act(async () => tree.update(tray({ showSaved: true })));
  expect(button('Vrati sačuvanu fotografiju 1').props.disabled).toBe(true);
  expect(button('Vrati sačuvanu fotografiju 1').props.accessibilityHint).toBe('Već je izabrano 6 fotografija.');
  expect(photos.pick).not.toHaveBeenCalled();
});

// Reduced motion (owner rule, 2026-10-07): the sheet that opens from the "+" and the question before a photo is removed take the
// system setting from the one store, so a phone set to reduce motion gets no slide from either.
it.each([false, true])('the sheet and the removal question follow the reduced-motion setting of the system (%s)', async reduced => {
  mockReduced = reduced;
  await draw(<AgreementPhotoSheet photos={photos} capturing={false} onClose={jest.fn()} onShowSaved={jest.fn()} />);
  expect(tree.root.findByType('PhotoAttachSheet' as React.ElementType).props.reduced).toBe(reduced);
  await act(async () => tree.update(tray()));
  expect(mockConfirmOptions).toHaveBeenLastCalledWith({ reduced });
});


it('a sending preview shows progress rather than retry or an unknown result',async()=>{
 photos.busy=true;photos.sending=rid;photos.items=[{ref,receipt:null}];photos.preview=()=>new Uint8Array([255,216,255]).buffer;photos.canRetry=()=>true;
 await draw(tray());expect(texts()).toContain('Šalje se');expect(texts()).not.toContain('Pošalji ponovo');expect(texts()).not.toContain('Ne znamo da li');
 expect(button('Ukloni pripremljenu fotografiju 1').props.disabled).toBe(true);
});
