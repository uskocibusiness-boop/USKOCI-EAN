import React from 'react';
import { AppState } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockFocused = true;
let mockSession: { user: { id: string } | null; accountRevision: number } = { user: { id: 'account-a' }, accountRevision: 1 };
let mockNow = 1_000_000;
const mockReadMedia = jest.fn();
const mockReadProfile = jest.fn();
jest.mock('../../../data/mediaClientService', () => ({ mediaClientService: {
  readMedia: (...args: unknown[]) => mockReadMedia(...args), readProfilePhoto: (...args: unknown[]) => mockReadProfile(...args),
} }));
jest.mock('../../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => unknown) => require('react').useEffect(
  () => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('expo-image', () => ({ Image: 'NativeImage' }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  // Kept inside the factory: the real supabase client, imported by the code under test, subscribes to AppState while the modules load.
  const listeners = new Set<(state: string) => void>();
  const state = {
    currentState: 'active',
    addEventListener: (_event: string, listener: (next: string) => void) => { listeners.add(listener); return { remove: () => listeners.delete(listener) }; },
    /** The operating system tells the app it moved to another state. */
    emit: (next: string) => { state.currentState = next; listeners.forEach(listener => listener(next)); },
  };
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return state;
    return ['View', 'ActivityIndicator', 'ScrollView', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../system/Glyph', () => ({ Glyph: 'Glyph' }));
jest.mock('../../system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../system/ScreenChrome', () => ({ ChromeIconButton: 'ChromeIconButton' }));
jest.mock('../../system/motion', () => ({ useReducedMotion: () => false }));

import { AuthorizedPhoto } from '../AuthorizedPhoto';
import { ProfilePhoto } from '../ContextPhotos';
import { jpegDataUri } from '../jpegDataUri';
import { OWN_PHOTO_FRESH_MS, OWN_PHOTO_KEEP_MS, ownPhotoCache } from '../ownPhotoCache';

/** Counts how often the letter that stands in for a face is drawn: a face that is remembered must never draw it, not even for one render. */
let standIns = 0;
const StandIn = () => { standIns++; return null; };

const bytesOf = (n: number) => new Uint8Array([255, 216, 255, n, 255, 217]).buffer;
const uriOf = (n: number) => jpegDataUri(bytesOf(n));
const picture = (assetId: string, n = 1) => ({ ok: true, podatak: { assetId, contentType: 'image/jpeg', bytes: bytesOf(n) } });
const failure = { ok: false, kod: 'MEDIA_UNAVAILABLE', poruka: 'Nije dostupno.' };
const described = (profileId: string, assetId: string | null) => ({ ok: true, podatak: { profileId, authoritative: true,
  photo: assetId ? { assetId, width: 800, height: 800, contentType: 'image/jpeg' } : null } });
const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>(done => { resolve = done; });
  return { promise, resolve };
};
const fakeAppState = AppState as unknown as { currentState: string; emit: (state: string) => void };
const appState = async (state: string) => { await act(async () => fakeAppState.emit(state)); };

let tree: ReactTestRenderer;
const host = (type: string) => tree.root.findAllByType(type as React.ElementType);
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const update = async (element: React.ReactElement) => { await act(async () => tree.update(element)); };
const leave = async () => { await act(async () => tree.unmount()); };
const shownUri = () => host('NativeImage')[0]?.props.source.uri;

const face = (extra: Partial<React.ComponentProps<typeof AuthorizedPhoto>> = {}) =>
  <AuthorizedPhoto assetId="asset-a" profileId="profile-a" label="Profilna fotografija" pending={<StandIn />} {...extra} />;
const profile = (extra: Partial<React.ComponentProps<typeof ProfilePhoto>> = {}) =>
  <ProfilePhoto profileId="profile-a" size={48} fallback={<StandIn />} {...extra} />;

beforeEach(() => {
  mockFocused = true; fakeAppState.currentState = 'active'; mockNow = 1_000_000; standIns = 0;
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 };
  jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
  mockReadMedia.mockReset().mockResolvedValue(picture('asset-a', 1));
  mockReadProfile.mockReset().mockResolvedValue(described('profile-a', 'asset-a'));
  ownPhotoCache.forget();
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });

describe('AuthorizedPhoto, own', () => {
  it('reads the photograph once and draws it on the very first render of every later visit, with no read and no stand-in', async () => {
    await render(face({ own: true }));
    expect(mockReadMedia).toHaveBeenCalledTimes(1); expect(shownUri()).toBe(uriOf(1));
    await leave(); standIns = 0;
    await render(face({ own: true }));
    expect(mockReadMedia).toHaveBeenCalledTimes(1); expect(shownUri()).toBe(uriOf(1));
    expect(standIns).toBe(0); expect(host('ActivityIndicator')).toHaveLength(0);
    // The same picture is still the one that is read with the exact context it had: nothing but the key changed.
    expect(mockReadMedia.mock.calls[0].slice(0, 2)).toEqual(['asset-a', { profileId: 'profile-a' }]);
  });

  it('keeps drawing it while the screen is out of focus and asks nothing when focus returns', async () => {
    await render(face({ own: true })); standIns = 0;
    mockFocused = false; await update(face({ own: true }));
    expect(shownUri()).toBe(uriOf(1));
    mockFocused = true; await update(face({ own: true }));
    expect(shownUri()).toBe(uriOf(1)); expect(mockReadMedia).toHaveBeenCalledTimes(1); expect(standIns).toBe(0);
  });

  it('never remembers anybody else\'s photograph: every visit reads it again and draws the stand-in meanwhile', async () => {
    await render(face()); await leave(); standIns = 0;
    const held = deferred(); mockReadMedia.mockReturnValueOnce(held.promise);
    await render(face());
    expect(mockReadMedia).toHaveBeenCalledTimes(2); expect(host('NativeImage')).toHaveLength(0); expect(standIns).toBeGreaterThan(0);
    await act(async () => held.resolve(picture('asset-a', 1)));
    expect(shownUri()).toBe(uriOf(1));
  });

  it('draws nothing of another account or revision from memory, even when the first account comes back', async () => {
    await render(face({ own: true }));
    mockSession = { user: { id: 'account-b' }, accountRevision: 2 }; mockReadMedia.mockReturnValueOnce(new Promise(() => {}));
    await update(face({ own: true }));
    expect(host('NativeImage')).toHaveLength(0); expect(mockReadMedia).toHaveBeenCalledTimes(2);
    mockSession = { user: { id: 'account-a' }, accountRevision: 3 }; mockReadMedia.mockReturnValueOnce(new Promise(() => {}));
    await update(face({ own: true }));
    expect(host('NativeImage')).toHaveLength(0); expect(mockReadMedia).toHaveBeenCalledTimes(3);
  });

  it('keeps the context in the key: the same asset in another profile\'s context, and another asset, are read and never drawn as this one', async () => {
    await render(face({ own: true }));
    mockReadMedia.mockResolvedValueOnce(picture('asset-a', 2));
    await update(face({ own: true, profileId: 'profile-b' }));
    expect(mockReadMedia).toHaveBeenCalledTimes(2); expect(shownUri()).toBe(uriOf(2));
    mockReadMedia.mockResolvedValueOnce(picture('asset-b', 3));
    await update(face({ own: true, assetId: 'asset-b' }));
    expect(mockReadMedia).toHaveBeenCalledTimes(3); expect(shownUri()).toBe(uriOf(3));
  });

  it.each(['background', 'inactive'])('forgets the picture when the app goes to %s', async state => {
    await render(face({ own: true })); await leave();
    await appState(state); await appState('active');
    const held = deferred(); mockReadMedia.mockReturnValueOnce(held.promise); standIns = 0;
    await render(face({ own: true }));
    expect(mockReadMedia).toHaveBeenCalledTimes(2); expect(host('NativeImage')).toHaveLength(0); expect(standIns).toBeGreaterThan(0);
  });

  it('gives a read that finishes after the app left the front to its own screen, but does not remember it', async () => {
    const held = deferred(); mockReadMedia.mockReturnValueOnce(held.promise);
    await render(face({ own: true }));
    await appState('background'); await appState('active');
    await act(async () => held.resolve(picture('asset-a', 1)));
    expect(shownUri()).toBe(uriOf(1));
    await leave();
    mockReadMedia.mockReturnValueOnce(new Promise(() => {}));
    await render(face({ own: true }));
    expect(mockReadMedia).toHaveBeenCalledTimes(2); expect(host('NativeImage')).toHaveLength(0);
  });

  it('remembers neither a picture that cannot be drawn nor a read that failed', async () => {
    await render(face({ own: true }));
    await act(async () => host('NativeImage')[0].props.onError({ error: 'decoder detail' }));
    expect(host('NativeImage')).toHaveLength(0);
    await leave(); mockReadMedia.mockResolvedValueOnce(failure);
    await render(face({ own: true }));
    expect(mockReadMedia).toHaveBeenCalledTimes(2); expect(host('NativeImage')).toHaveLength(0);
    await leave(); mockReadMedia.mockResolvedValueOnce(picture('asset-a', 1));
    await render(face({ own: true }));
    expect(mockReadMedia).toHaveBeenCalledTimes(3); expect(shownUri()).toBe(uriOf(1));
  });

  it('opens the viewer from a remembered picture exactly as from a read one', async () => {
    const open = { label: 'Otvori', onPress: jest.fn() };
    await render(face({ own: true, open })); await leave();
    await render(face({ own: true, open }));
    await act(async () => host('Press')[0].props.onPress());
    expect(open.onPress).toHaveBeenCalledTimes(1); expect(mockReadMedia).toHaveBeenCalledTimes(1);
  });
});

describe('ProfilePhoto, own', () => {
  it('asks for the description and the picture once, then draws the face at once on every later visit with no stand-in', async () => {
    await render(profile({ own: true }));
    expect(mockReadProfile).toHaveBeenCalledTimes(1); expect(mockReadMedia).toHaveBeenCalledTimes(1); expect(shownUri()).toBe(uriOf(1));
    await leave(); standIns = 0;
    await render(profile({ own: true }));
    expect(mockReadProfile).toHaveBeenCalledTimes(1); expect(mockReadMedia).toHaveBeenCalledTimes(1);
    expect(shownUri()).toBe(uriOf(1)); expect(standIns).toBe(0);
    expect(host('NativeImage')[0].props.style).toMatchObject({ width: '100%', height: '100%' });
  });

  it('draws no stand-in when a mounted face loses and regains focus, and asks nothing', async () => {
    await render(profile({ own: true })); standIns = 0;
    mockFocused = false; await update(profile({ own: true }));
    expect(shownUri()).toBe(uriOf(1));
    mockFocused = true; await update(profile({ own: true }));
    expect(shownUri()).toBe(uriOf(1)); expect(standIns).toBe(0);
    expect(mockReadProfile).toHaveBeenCalledTimes(1); expect(mockReadMedia).toHaveBeenCalledTimes(1);
  });

  it('reads another person\'s face again on every visit, as it always did', async () => {
    await render(profile()); await leave(); await render(profile());
    expect(mockReadProfile).toHaveBeenCalledTimes(2); expect(mockReadMedia).toHaveBeenCalledTimes(2);
    expect(ownPhotoCache.description({ accountId: 'account-a', accountRevision: 1 }, 'profile-a')).toBeUndefined();
  });

  it('draws a description older than ten minutes while it is asked again, and keeps the picture when it is the same photograph', async () => {
    await render(profile({ own: true })); await leave();
    mockNow += OWN_PHOTO_FRESH_MS + 1; standIns = 0;
    const held = deferred(); mockReadProfile.mockReturnValueOnce(held.promise);
    await render(profile({ own: true }));
    expect(mockReadProfile).toHaveBeenCalledTimes(2); expect(shownUri()).toBe(uriOf(1)); expect(standIns).toBe(0);
    await act(async () => held.resolve(described('profile-a', 'asset-a')));
    expect(mockReadMedia).toHaveBeenCalledTimes(1); expect(shownUri()).toBe(uriOf(1)); expect(standIns).toBe(0);
    // Asked again, so it is recent again: the next visit asks nothing.
    await leave(); await render(profile({ own: true }));
    expect(mockReadProfile).toHaveBeenCalledTimes(2);
  });

  it('forgets a description older than thirty minutes: the stand-in stands in while it is asked again', async () => {
    await render(profile({ own: true })); await leave();
    mockNow += OWN_PHOTO_KEEP_MS + 1; standIns = 0;
    mockReadProfile.mockReturnValueOnce(new Promise(() => {}));
    await render(profile({ own: true }));
    expect(mockReadProfile).toHaveBeenCalledTimes(2); expect(host('NativeImage')).toHaveLength(0); expect(standIns).toBeGreaterThan(0);
  });

  it('forgets the photograph when the answer says there is none, and draws the stand-in from then on', async () => {
    await render(profile({ own: true })); await leave();
    mockNow += OWN_PHOTO_FRESH_MS + 1; standIns = 0;
    mockReadProfile.mockResolvedValueOnce(described('profile-a', null));
    await render(profile({ own: true }));
    expect(host('NativeImage')).toHaveLength(0); expect(standIns).toBeGreaterThan(0);
    await leave(); standIns = 0;
    mockReadProfile.mockResolvedValue(described('profile-a', null));
    await render(profile({ own: true }));
    expect(host('NativeImage')).toHaveLength(0); expect(standIns).toBeGreaterThan(0);
    expect(ownPhotoCache.image({ accountId: 'account-a', accountRevision: 1 }, 'profile-a', 'asset-a')).toBeUndefined();
  });

  it('reads the picture of a new photograph and drops the old one, which is drawn only until the new description arrives', async () => {
    await render(profile({ own: true })); await leave();
    mockNow += OWN_PHOTO_FRESH_MS + 1;
    const held = deferred(); mockReadProfile.mockReturnValueOnce(held.promise);
    mockReadMedia.mockResolvedValueOnce(picture('asset-b', 2));
    await render(profile({ own: true }));
    expect(shownUri()).toBe(uriOf(1));
    await act(async () => held.resolve(described('profile-a', 'asset-b')));
    expect(mockReadMedia).toHaveBeenCalledTimes(2); expect(mockReadMedia.mock.calls[1][0]).toBe('asset-b');
    expect(shownUri()).toBe(uriOf(2));
    expect(ownPhotoCache.image({ accountId: 'account-a', accountRevision: 1 }, 'profile-a', 'asset-a')).toBeUndefined();
  });

  it('does not draw an earlier answer of a face that stays mounted once the app was told the photograph changed', async () => {
    await render(profile({ own: true }));
    ownPhotoCache.forget();
    mockFocused = false; await update(profile({ own: true }));
    const held = deferred(); mockReadProfile.mockReturnValueOnce(held.promise); standIns = 0;
    mockFocused = true; await update(profile({ own: true }));
    expect(host('NativeImage')).toHaveLength(0); expect(standIns).toBeGreaterThan(0);
    mockReadMedia.mockResolvedValueOnce(picture('asset-b', 2));
    await act(async () => held.resolve(described('profile-a', 'asset-b')));
    expect(shownUri()).toBe(uriOf(2));
  });

  it('draws nothing of another account from memory', async () => {
    await render(profile({ own: true }));
    mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
    mockReadProfile.mockReturnValueOnce(new Promise(() => {})); standIns = 0;
    await update(profile({ own: true }));
    expect(host('NativeImage')).toHaveLength(0); expect(standIns).toBeGreaterThan(0); expect(mockReadProfile).toHaveBeenCalledTimes(2);
  });

  it('passes `own` down to the picture, and only when asked', async () => {
    await render(profile({ own: true }));
    expect(tree.root.findByType(AuthorizedPhoto).props.own).toBe(true);
    await leave(); await render(profile());
    expect(tree.root.findByType(AuthorizedPhoto).props.own).toBe(false);
  });
});
