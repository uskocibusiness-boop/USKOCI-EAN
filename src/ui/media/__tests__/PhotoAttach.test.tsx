import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  return ['View', 'ScrollView', 'Modal', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('expo-image', () => ({ Image: 'NativeImage' }));
jest.mock('../../system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
const mockDismissed = jest.fn();
// The sheet engine is gorhom's; its own suite proves the motion and Back. Here `dismiss` starts the close and the test says
// when the sheet is gone (its `onClose`), as the engine does once the slide ends.
jest.mock('../../product/ProductSheet', () => ({ ProductSheet: ({ title, onClose, children }: { title?: string; onClose: () => void;
  children: (dismiss: () => void) => React.ReactNode }) => require('react').createElement('Sheet', { title, onClose },
  children(() => mockDismissed())) }));
import { PhotoAttachSheet } from '../PhotoAttachSheet';
import { PhotoAttachStrip, PhotoAttachTile, TILE_WORDS, type AttachTile } from '../PhotoAttachTiles';
import { PhotoViewer } from '../PhotoViewer';
import { PHOTO_WORDS, librarySubtitle, photoLimits, removalRequest, TASK_PHOTO_NOTICE } from '../photoWords';

let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(v => typeof v === 'string')).join(' ');
const row = (label: string) => tree.root.find(node => node.props.accessibilityRole === 'menuitem' && node.props.accessibilityLabel === label).props;
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the one attach sheet', () => {
  it('offers Galerija and Kamera in the same words, the free slots, the limits and the notice before any pick', async () => {
    const onPick = jest.fn(), onClose = jest.fn();
    await act(async () => { tree = create(<PhotoAttachSheet remaining={4} limits={photoLimits('TASK')} notice={TASK_PHOTO_NOTICE}
      onPick={onPick} onClose={onClose} />); });
    expect(tree.root.findByType('Sheet' as React.ElementType).props.title).toBe(PHOTO_WORDS.add);
    expect(row('Galerija').accessibilityHint).toBe('Izaberi do 4 fotografije');
    expect(row('Kamera').accessibilityHint).toBe('Fotografiši sada');
    expect(texts()).toContain(photoLimits('TASK')); expect(texts()).toContain(TASK_PHOTO_NOTICE);
    // The source runs once the sheet has gone, so the system picker never opens underneath it; a second tap does nothing.
    await act(async () => { row('Galerija').onPress(); row('Kamera').onPress(); });
    expect(mockDismissed).toHaveBeenCalledTimes(1); expect(onPick).not.toHaveBeenCalled();
    await act(async () => tree.root.findByType('Sheet' as React.ElementType).props.onClose());
    expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(onPick.mock.invocationCallOrder[0]);
    expect(onPick.mock.calls).toEqual([['LIBRARY']]);
  });
  it('one photo per pick where the caller sends one at a time; grey sources say why, once, and run nothing', async () => {
    const onPick = jest.fn();
    await act(async () => { tree = create(<PhotoAttachSheet multiple={false} remaining={5} disabledReason="Prvo sačekaj ishod fotografije koja se šalje."
      limits={photoLimits('AGREEMENT')} onPick={onPick} onClose={jest.fn()}
      rows={[{ key: 'saved', label: 'Ranije pripremljene fotografije (2)', onPress: jest.fn() }]} />); });
    expect(texts()).toContain('Izaberi jednu fotografiju');
    expect(row('Galerija').disabled).toBe(true); expect(row('Kamera').accessibilityHint).toBe('Prvo sačekaj ishod fotografije koja se šalje.');
    expect(texts().split('Prvo sačekaj ishod fotografije koja se šalje.')).toHaveLength(2);
    await act(async () => row('Galerija').onPress()); expect(onPick).not.toHaveBeenCalled();
    expect(row('Ranije pripremljene fotografije (2)').disabled).toBe(false);
  });
  it('promises no more than the free slots, in Serbian counts', () => {
    expect([1, 2, 5].map(librarySubtitle)).toEqual(['Izaberi jednu fotografiju', 'Izaberi do 2 fotografije', 'Izaberi do 5 fotografija']);
    expect(removalRequest('AGREEMENT', jest.fn())).toMatchObject({ title: 'Ukloniti fotografiju?', confirmLabel: 'Ukloni', tone: 'danger',
      message: 'Fotografija se uklanja iz poruke koju pripremaš.' });
  });
});

describe('the shared tiles', () => {
  const bytes = new Uint8Array([255, 216, 255]).buffer;
  it('says each state in its words, draws a picked photo from memory, and keeps the X readable when grey', async () => {
    const tiles: AttachTile[] = [{ key: 'q', state: { kind: 'QUEUED' }, preview: bytes, onRemove: jest.fn() },
      { key: 's', state: { kind: 'SENDING' }, preview: bytes }, { key: 'p', state: { kind: 'PROCESSING' } },
      { key: 'u', state: { kind: 'UNCONFIRMED' } }, { key: 'f', state: { kind: 'FAILED' }, onRemove: jest.fn(), removeDisabled: true }];
    await act(async () => { tree = create(<>{tiles.map((tile, index) => <PhotoAttachTile key={tile.key} tile={tile} index={index} size={104} />)}</>); });
    for (const kind of ['QUEUED', 'SENDING', 'PROCESSING', 'UNCONFIRMED', 'FAILED'] as const) expect(texts()).toContain(TILE_WORDS[kind]);
    expect(tree.root.findAllByType('NativeImage' as React.ElementType)[0].props).toMatchObject({ cachePolicy: 'none',
      source: { uri: expect.stringMatching(/^data:image\/jpeg;base64,/) } });
    expect(tree.root.findByProps({ accessibilityLabel: 'Ukloni fotografiju 5' }).props).toMatchObject({ disabled: true,
      accessibilityState: { disabled: true } });
    expect(tree.root.findByProps({ accessibilityLabel: 'Fotografija 3: Obrađuje se…' })).toBeTruthy();
  });
  // The corner X is a 48 dp target around a 32 dp circle: the words of a tile that has one used to run under it (a 104 dp tile with two lines
  // of words and a retry line). Now they start below the circle, and the picture that would have stood beside them is left out.
  it('the words of a tile that has an X start below its circle, and a tile without an X keeps its picture', async () => {
    const flat = (node: { props: { style?: unknown } }) => (Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style.flat(3).filter(Boolean)) : node.props.style) as { paddingTop?: number };
    const stateOf = (renderer: ReactTestRenderer) => renderer.root.findAll(node => node.type === ('View' as React.ElementType) && node.props.pointerEvents === 'none')[0];
    await act(async () => { tree = create(<PhotoAttachTile tile={{ key: 'f', state: { kind: 'FAILED' }, onRemove: jest.fn() }} index={0} size={104} />); });
    expect(flat(stateOf(tree)).paddingTop).toBe(40);
    expect(tree.root.findAllByType('T' as React.ElementType)).toHaveLength(1);
    await act(async () => tree.unmount());
    await act(async () => { tree = create(<PhotoAttachTile tile={{ key: 'u', state: { kind: 'UNCONFIRMED' } }} index={0} size={104} />); });
    expect(flat(stateOf(tree)).paddingTop).not.toBe(40);
  });
  it('a tile that can be sent again is one target that says so', async () => {
    const onRetry = jest.fn();
    await act(async () => { tree = create(<PhotoAttachTile tile={{ key: 'f', state: { kind: 'FAILED' }, onRetry }} index={0} size={104} />); });
    const press = tree.root.findByProps({ accessibilityLabel: `${PHOTO_WORDS.retry} · fotografija 1` });
    expect(press.props.accessibilityHint).toBe(TILE_WORDS.FAILED);
    await act(async () => press.props.onPress()); expect(onRetry).toHaveBeenCalledTimes(1);
  });
  it('a saved photo opens the one viewer at its own place among the saved ones', async () => {
    const tiles: AttachTile[] = [{ key: 'a', state: { kind: 'READY', assetId: 'asset-a' } }, { key: 'q', state: { kind: 'QUEUED' } },
      { key: 'b', state: { kind: 'READY', assetId: 'asset-b' } }];
    await act(async () => { tree = create(<PhotoAttachStrip tiles={tiles} context={{ agreementId: 'agreement-a' }} viewerTitle="Fotografije uz poruku" />); });
    const photos = tree.root.findAllByType('AuthorizedPhoto' as React.ElementType);
    expect(photos.map(photo => [photo.props.assetId, photo.props.agreementId])).toEqual([['asset-a', 'agreement-a'], ['asset-b', 'agreement-a']]);
    await act(async () => photos[1].props.open.onPress());
    expect(tree.root.findByType(PhotoViewer).props).toMatchObject({ index: 1, title: 'Fotografije uz poruku',
      photos: [{ assetId: 'asset-a' }, { assetId: 'asset-b' }], context: { agreementId: 'agreement-a' } });
    await act(async () => tree.root.findByType(PhotoViewer).props.onClose());
    expect(tree.root.findAllByType(PhotoViewer)).toHaveLength(0);
  });
});
