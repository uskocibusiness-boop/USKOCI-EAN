import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

let mockSession = { user: { id: 'account-a' }, accountRevision: 1 }, mockFocused = true, mockReduced = false;
const mockRead = jest.fn(), mockProfile = jest.fn(), mockScroll = jest.fn();
jest.mock('../mediaClientService', () => ({ mediaClientService: {
  readNeedPhotos: (...args: unknown[]) => mockRead(...args), readProfilePhoto: (...args: unknown[]) => mockProfile(...args),
} }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) =>
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/ScreenChrome', () => ({ ChromeIconButton: 'ChromeIconButton' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));

import { NeedPhotos, ProfilePhoto } from '../../ui/media/ContextPhotos';

const photos = [{ assetId: 'photo-a', width: 1000, height: 750, contentType: 'image/jpeg' },
  { assetId: 'photo-b', width: 900, height: 1200, contentType: 'image/jpeg' }];
const listing = (needId = 'need-a', entries = photos) => ({ ok: true, podatak: { needId, photos: entries, authoritative: true } });
let tree: ReactTestRenderer;
const host = (type: string) => tree.root.findAll(node => node.type === (type as React.ElementType));
const words = () => host('T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const byId = (testID: string) => tree.root.findByProps({ testID });
const render = async (element = <NeedPhotos needId="need-a" />) => {
  await act(async () => { tree = create(element, { createNodeMock: element => element.type === 'ScrollView' ? { scrollTo: mockScroll } : null }); });
};
const measure = async (testID: string, width = 280, height = 210) => {
  await act(async () => byId(testID).props.onLayout({ nativeEvent: { layout: { width, height, x: 0, y: 0 } } }));
};
const settle = async (testID: string, x: number) => {
  await act(async () => byId(testID).props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x, y: 0 } } }));
};
const open = async (page = 1) => {
  await act(async () => host('AuthorizedPhoto')[page - 1].props.open.onPress());
};
const modalPhotos = (): ReactTestInstance[] => host('Modal')[0].findAll(node => node.type === ('AuthorizedPhoto' as React.ElementType));

beforeEach(() => {
  jest.clearAllMocks(); mockRead.mockReset(); mockProfile.mockReset();
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockFocused = true; mockReduced = false;
  mockRead.mockImplementation(async (id: string) => listing(id));
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('uses measured width for each authorized page, updates the real counter, and keeps the chosen page on resizing', async () => {
  await render(); expect(host('AuthorizedPhoto')).toHaveLength(0);
  await measure('task-photo-viewport');
  expect(byId('task-photo-pages').props.pagingEnabled).toBe(true);
  expect(host('AuthorizedPhoto').map(node => [node.props.assetId, node.props.needId, node.props.style.width, node.props.style.height]))
    .toEqual([['photo-a', 'need-a', 280, 210], ['photo-b', 'need-a', 280, 210]]);
  expect(words()).toContain('1 / 2');
  await settle('task-photo-pages', 280); expect(words()).toContain('2 / 2');
  await measure('task-photo-viewport', 400, 300);
  expect(mockScroll).toHaveBeenLastCalledWith({ x: 400, animated: false });
  expect(host('AuthorizedPhoto')[0].props.style.width).toBe(400);
  await settle('task-photo-pages', 99999); expect(words()).toContain('2 / 2');
  await settle('task-photo-pages', -50); expect(words()).toContain('1 / 2');
});

it('opens the pressed photo in a full-screen authorized viewer and synchronizes the page when closed with Android Back', async () => {
  await render(); await measure('task-photo-viewport'); await settle('task-photo-pages', 280); await open(2);
  expect(host('Modal')[0].props).toMatchObject({ visible: true, presentationStyle: 'fullScreen', animationType: 'fade' });
  await measure('task-photo-viewer-viewport', 360, 540);
  expect(modalPhotos().map(node => [node.props.assetId, node.props.needId, node.props.contentFit])).toEqual([
    ['photo-a', 'need-a', 'contain'], ['photo-b', 'need-a', 'contain'],
  ]);
  expect(byId('task-photo-viewer-pages').props.contentOffset).toEqual({ x: 360, y: 0 });
  expect(tree.root.findByProps({ label: 'Sledeća fotografija' }).props.disabled).toBe(true);
  await act(async () => tree.root.findByProps({ label: 'Prethodna fotografija' }).props.onPress());
  expect(tree.root.findByProps({ label: 'Prethodna fotografija' }).props.disabled).toBe(true);
  await act(async () => host('Modal')[0].props.onRequestClose());
  expect(host('Modal')).toHaveLength(0); expect(words()).toContain('1 / 2');
  expect(byId('task-photo-pages').props.contentOffset).toEqual({ x: 0, y: 0 });
});

it('respects reduced motion and exposes an explicit close control', async () => {
  mockReduced = true; await render(); await measure('task-photo-viewport'); await open();
  expect(host('Modal')[0].props.animationType).toBe('none');
  await act(async () => tree.root.findByProps({ label: 'Zatvori fotografije' }).props.onPress());
  expect(host('Modal')).toHaveLength(0);
});

it('closes the viewer and retires old photos when the task or account revision changes', async () => {
  await render(); await measure('task-photo-viewport'); await open();
  mockRead.mockImplementation(async (id: string) => listing(id, [{ ...photos[0], assetId: 'photo-new' }]));
  await act(async () => tree.update(<NeedPhotos needId="need-b" />));
  expect(host('Modal')).toHaveLength(0); await measure('task-photo-viewport');
  expect(host('AuthorizedPhoto').map(node => [node.props.assetId, node.props.needId])).toEqual([['photo-new', 'need-b']]);
  await act(async () => host('AuthorizedPhoto')[0].props.open.onPress());
  mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  mockRead.mockImplementation(() => new Promise(() => {}));
  await act(async () => tree.update(<NeedPhotos needId="need-b" />));
  expect(host('Modal')).toHaveLength(0); expect(host('AuthorizedPhoto')).toHaveLength(0);
});

it('does not preserve an open native viewer after leaving the route', async () => {
  await render(); await measure('task-photo-viewport'); await open();
  mockFocused = false; await act(async () => tree.update(<NeedPhotos needId="need-a" />));
  expect(host('Modal')).toHaveLength(0); expect(host('AuthorizedPhoto')).toHaveLength(0);
});

it('draws nothing for an empty list and nothing for a read that failed (no sentence, no grey plate), and reads again the next time it is asked', async () => {
  mockRead.mockResolvedValue(listing('need-a', [])); await render();
  expect(tree.toJSON()).toBeNull();
  await act(async () => tree.update(<NeedPhotos needId="need-a" owned />));
  expect(tree.toJSON()).toBeNull(); expect(host('AuthorizedPhoto')).toHaveLength(0);
  // The owner's phone, 8 Oct 2026: a big grey plate with a dot stood where a photo that would not load should have been. A list that cannot be read is no gallery at all.
  mockRead.mockResolvedValue({ ok: false, kod: 'MEDIA_UNAVAILABLE', poruka: 'Nije dostupno.' });
  await act(async () => tree.update(<NeedPhotos needId="need-b" owned />));
  expect(tree.toJSON()).toBeNull(); expect(words()).not.toMatch(/nisu učitane|Još nema fotografija/); expect(tree.root.findAllByProps({ label: 'Učitaj fotografije' })).toHaveLength(0);
  mockRead.mockImplementation(async (id: string) => listing(id));
  await act(async () => tree.update(<NeedPhotos needId="need-c" owned />));
  await measure('task-photo-viewport'); expect(host('AuthorizedPhoto')).toHaveLength(2);
});

it('holds a picture of a photo in the page while the photo is read: never a spinner, never a bare grey plate', async () => {
  await render(); await measure('task-photo-viewport');
  for (const page of host('AuthorizedPhoto')) {
    expect(page.props.pending.type).toBe('FactArt'); expect(page.props.pending.props.kind).toBe('photo');
  }
});

it('leaves a page out when its photo cannot be read, and draws no gallery at all when no photo can be', async () => {
  await render(); await measure('task-photo-viewport');
  expect(host('AuthorizedPhoto')).toHaveLength(2); expect(words()).toContain('1 / 2');
  // What a page whose photo could not be read draws is a probe that tells the gallery, once, and draws nothing itself.
  const cannotRead = async (page: number) => act(async () => { create(host('AuthorizedPhoto')[page].props.unavailable); });
  await cannotRead(1);
  expect(host('AuthorizedPhoto').map(node => node.props.assetId)).toEqual(['photo-a']);
  // One photo is "1 / 1", which says nothing: no counter.
  expect(words()).not.toMatch(/\d \/ \d/);
  await cannotRead(0);
  expect(tree.toJSON()).toBeNull();
});

it('keeps the counter only for more than one photo', async () => {
  mockRead.mockImplementation(async (id: string) => listing(id, [photos[0]]));
  await render(); await measure('task-photo-viewport');
  expect(host('AuthorizedPhoto')).toHaveLength(1); expect(words()).not.toMatch(/\d \/ \d/);
});

it('keeps ProfilePhoto on its original authorized portrait contract', async () => {
  mockProfile.mockResolvedValue({ ok: true, podatak: { profileId: 'profile-a', photo: photos[0], authoritative: true } });
  await render(<ProfilePhoto profileId="profile-a" size={56} />);
  expect(mockRead).not.toHaveBeenCalled(); expect(mockProfile).toHaveBeenCalledWith('profile-a');
  expect(host('AuthorizedPhoto')[0].props).toMatchObject({ assetId: 'photo-a', profileId: 'profile-a', contentFit: 'cover',
    style: { width: 56, height: 56, borderRadius: 28, aspectRatio: 1 } });
  expect(host('Modal')).toHaveLength(0);
});
