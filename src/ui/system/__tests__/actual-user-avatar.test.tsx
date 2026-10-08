import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { OwnProfileIdentity } from '../../../data/ownProfileClientService';

let mockAccountId = 'account-a';
let mockRevision = 1;
let mockFocused = true;
let mockAppState = 'active';
const mockListeners = new Set<(state: string) => void>();
const mockRead = jest.fn<Promise<OwnProfileIdentity | null>, [string, string]>();
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const state = {
    get currentState() { return mockAppState; },
    addEventListener: (_event: string, fn: (state: string) => void) => {
      mockListeners.add(fn); return { remove: () => mockListeners.delete(fn) };
    },
  };
  return new Proxy(actual, { get: (target, key) => key === 'AppState' ? state : Reflect.get(target, key) });
});
jest.mock('expo-router', () => ({ useFocusEffect: (fn: () => void | (() => void)) => {
  require('react').useEffect(() => mockFocused ? fn() : undefined, [fn, mockFocused]);
} }));
jest.mock('../../../store/sesija', () => ({
  useSesija: () => ({ user: { id: mockAccountId }, accountRevision: mockRevision }),
  sesijaSada: () => ({ user: { id: mockAccountId }, accountRevision: mockRevision }),
}));
jest.mock('../../../data/ownProfileClientService', () => ({ ownProfileClientService: {
  read: (account: string, intent: string) => mockRead(account, intent),
} }));
jest.mock('../../media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../Avatar', () => ({ Avatar: 'Avatar' }));

import { ActualUserAvatar } from '../ActualUserAvatar';
import { ownPhotoCache } from '../../media/ownPhotoCache';

let tree: ReactTestRenderer;
const open = jest.fn();
const identity = (accountId = mockAccountId, name = 'Ana Petrović'): OwnProfileIdentity => ({
  accountId, profileId: `profile-${accountId}`, kind: 'REQUESTER', ime: name, grad: null, stanje: null,
});
const deferred = () => {
  let resolve!: (value: OwnProfileIdentity | null) => void;
  const promise = new Promise<OwnProfileIdentity | null>(done => { resolve = done; });
  return { promise, resolve };
};
const render = async () => { await act(async () => { tree = create(<ActualUserAvatar onPress={open} />); }); };
const update = async () => { await act(async () => { tree.update(<ActualUserAvatar onPress={open} />); }); };
const photos = () => tree.root.findAllByType('ProfilePhoto' as React.ElementType);
const button = () => tree.root.findByType('Press' as React.ElementType);
const appState = async (state: string) => { await act(async () => {
  mockAppState = state; mockListeners.forEach(fn => fn(state));
}); };
beforeEach(() => {
  mockAccountId = 'account-a'; mockRevision = 1; mockFocused = true; mockAppState = 'active';
  mockRead.mockReset(); open.mockReset(); mockListeners.clear();
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('keeps profile navigation available before identity arrives and uses the authorized profile ID', async () => {
  const pending = deferred(); mockRead.mockReturnValueOnce(pending.promise);
  await render();
  expect(photos()).toHaveLength(0);
  expect(tree.root.findByType('Avatar' as React.ElementType).props.initials).toBeNull();
  await act(async () => button().props.onPress());
  expect(open).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(identity()));
  expect(mockRead.mock.calls).toEqual([['account-a', 'narucilac']]);
  // The header shows the person's own face: it asks to be remembered in memory, so coming back to a tab never shows the letter in its place.
  expect(photos()[0].props).toMatchObject({ profileId: 'profile-account-a', size: 48, own: true });
  expect(photos()[0].props.fallback.props.initials).toBe('AP');
  expect(button().props.accessibilityValue).toEqual({ text: 'Ana Petrović' });
});

it('reads the worker fallback only after an authoritative missing requester, never after an error', async () => {
  mockRead.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...identity(), kind: 'WORKER' });
  await render();
  expect(mockRead.mock.calls).toEqual([['account-a', 'narucilac'], ['account-a', 'uskocer']]);
  expect(photos()).toHaveLength(1);
  await act(async () => tree.unmount());
  mockRead.mockReset().mockRejectedValueOnce(new Error('OWN_PROFILE_READ_FAILED'));
  await render();
  expect(mockRead.mock.calls).toEqual([['account-a', 'narucilac']]);
  expect(photos()).toHaveLength(0);
  expect(button().props.accessibilityValue).toBeUndefined();
});

it('cannot republish an old account after A to B to A, including a changed session revision', async () => {
  const oldA = deferred(), currentA = deferred();
  mockRead.mockReturnValueOnce(oldA.promise).mockResolvedValueOnce(identity('account-b')).mockReturnValueOnce(currentA.promise);
  await render();
  mockAccountId = 'account-b'; mockRevision++; await update();
  expect(photos()[0].props.profileId).toBe('profile-account-b');
  mockAccountId = 'account-a'; mockRevision++; await update();
  expect(photos()).toHaveLength(0);
  await act(async () => oldA.resolve(identity('account-a', 'Old identity')));
  expect(photos()).toHaveLength(0);
  await act(async () => currentA.resolve(identity('account-a', 'Current identity')));
  expect(button().props.accessibilityValue).toEqual({ text: 'Current identity' });
});

it('clears a loaded photo immediately when the same account receives a new revision', async () => {
  const refreshed = deferred();
  mockRead.mockResolvedValueOnce(identity()).mockReturnValueOnce(refreshed.promise);
  await render(); expect(photos()).toHaveLength(1);
  mockRevision++; await update();
  expect(photos()).toHaveLength(0);
  expect(button().props.accessibilityValue).toBeUndefined();
  await act(async () => refreshed.resolve(identity('account-a', 'Reauthorized identity')));
  expect(button().props.accessibilityValue).toEqual({ text: 'Reauthorized identity' });
});

it('retires a pending read on blur before fallback and reads the current identity after focus returns', async () => {
  const old = deferred(); mockRead.mockReturnValueOnce(old.promise).mockResolvedValueOnce(identity());
  await render(); mockFocused = false; await update();
  await act(async () => old.resolve(null));
  expect(mockRead.mock.calls).toEqual([['account-a', 'narucilac']]);
  expect(photos()).toHaveLength(0);
  mockFocused = true; await update();
  expect(photos()[0].props.profileId).toBe('profile-account-a');
});

it('forgets the visible photo on background and ignores an older read after foreground resumes', async () => {
  const old = deferred(), fresh = deferred();
  mockRead.mockResolvedValueOnce(identity()).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  await render(); expect(photos()).toHaveLength(1);
  await appState('background'); expect(photos()).toHaveLength(0);
  await appState('active');
  await appState('background'); await appState('active');
  await act(async () => old.resolve(identity('account-a', 'Old identity')));
  expect(photos()).toHaveLength(0);
  await act(async () => fresh.resolve(identity('account-a', 'Fresh identity')));
  expect(button().props.accessibilityValue).toEqual({ text: 'Fresh identity' });
});

it('forgets the photographs the app remembers when its account goes away, and forgets nothing when it is only drawn again for the same account', async () => {
  const forget = jest.spyOn(ownPhotoCache, 'forget');
  mockRead.mockResolvedValue(identity());
  await render(); await act(async () => tree.unmount());
  expect(forget).not.toHaveBeenCalled();
  await render();
  mockAccountId = 'account-b'; mockRevision++; await update();
  expect(forget).toHaveBeenCalledTimes(1);
  forget.mockRestore();
});
