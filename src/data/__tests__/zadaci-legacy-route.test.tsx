import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The legacy Zadaci route (the reader a build mounts when the P6 flag is off): what it hands the presentation and which of its
 * commands it lets through. It used to carry a second job, the landing of a task that had just been published; since 2026-10-07 a
 * confirmed publication lands on the task's own overview, so the route reads no publication hand-off and its tests are gone
 * (the work-area tests below are the ones that never depended on it). The reader choice is `discovery-v1-production-route`.
 */
const NEED = '11111111-1111-4111-8111-111111111111';
const ACCOUNT = '22222222-2222-4222-8222-222222222222';
const mockSource = { otvorenePrilike: jest.fn(), otvorenaPrilika: jest.fn(), odnosiPremaZadacima: jest.fn() };
let mockFocused = true;
let mockParams: Record<string, unknown> = {};
let mockHookCall = 0;
let mockRows: Record<string, unknown>[] = [];
let mockRelations: unknown = null;
let mockLoading = false, mockError = false;
const mockRefresh = jest.fn(async () => {});
const mockRelationsRefresh = jest.fn(async () => {});
const mockRouter = { navigate: jest.fn(), replace: jest.fn() };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected transport'); } }));
const mockAppListeners = new Set<(state: string) => void>();
const mockAppState = { currentState: 'active', addEventListener: (_: string, listener: (state: string) => void) => {
  mockAppListeners.add(listener); return { remove: () => mockAppListeners.delete(listener) };
} };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get: (target, key) => key === 'AppState' ? mockAppState : Reflect.get(target, key) });
});

jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockRouter.navigate(...args), replace: (...args: unknown[]) => mockRouter.replace(...args) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => (() => void) | void) => {
    const React = require('react');
    React.useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]);
  },
}));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'rs.uskoci.dev' } } }));
jest.mock('../../store/sesija', () => ({
  useSesija: () => ({ user: { id: ACCOUNT }, accountRevision: 1 }),
  sesijaSada: () => ({ user: { id: ACCOUNT }, accountRevision: 1 }),
}));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource }));
// The route reads two resources, in this order on every render: the collection, then the relation overlay.
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: () => {
  mockHookCall++;
  return mockHookCall % 2
    ? { data: mockRows, loading: mockLoading, refreshing: false, error: mockError, refresh: mockRefresh }
    : { data: mockRelations, loading: false, refreshing: false, error: false, refresh: mockRelationsRefresh };
} }));
jest.mock('../../ui/v2/DiscoveryPresentation', () => ({ DiscoveryPresentation: 'Discovery' }));
const mockWorkArea = { target: { key: 'work-area', bounds: [19, 44, 20, 45] }, retire: jest.fn(), handled: jest.fn() };
jest.mock('../../hooks/useDiscoveryWorkArea', () => ({ useDiscoveryWorkArea: () => mockWorkArea }));

import Zadaci from '../../app/(app)/zadaci';

let tree: ReactTestRenderer;
const render = async () => act(async () => { tree = create(<Zadaci />); });
const update = async () => act(async () => tree.update(<Zadaci />));
const discovery = () => tree.root.findByType('Discovery' as React.ElementType).props;
const relationIndex = (owned: string[]) => ({ owned: new Set(owned), applied: new Set<string>(),
  relation: (id: string) => ({ kind: owned.includes(id) ? 'OWNER' : 'NONE' }) });
beforeEach(() => {
  mockAppState.currentState = 'active'; mockAppListeners.clear();
  mockFocused = true; mockParams = {};
  mockHookCall = 0; mockRows = []; mockRelations = null; mockLoading = false; mockError = false;
  mockSource.otvorenaPrilika.mockReset(); mockSource.otvorenePrilike.mockReset();
  mockRefresh.mockClear(); mockRelationsRefresh.mockClear(); mockRouter.navigate.mockClear(); mockRouter.replace.mockClear();
  mockWorkArea.retire.mockClear(); mockWorkArea.handled.mockClear();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('the collection, its reading and its failure reach the presentation as they are, with the same empty list while nothing is read', async () => {
  mockRows = [{ id: 'a' }, { id: 'b' }];
  await render();
  expect(discovery().items).toEqual(mockRows);
  expect(discovery()).toMatchObject({ loading: false, error: false, scopeKey: `${ACCOUNT}:1` });
  expect(discovery().collectionStatus).toBeUndefined();
  mockLoading = true; mockError = true; await update();
  expect(discovery()).toMatchObject({ loading: true, error: true });
});

test('a task opens its public detail, and its own overview when the relation overlay says it is mine', async () => {
  mockRows = [{ id: 'other' }, { id: 'mine' }];
  mockRelations = relationIndex(['mine']);
  await render();
  await act(async () => discovery().onOpen(mockRows[0]));
  expect(mockRouter.navigate).toHaveBeenLastCalledWith({ pathname: '/prilike/[id]', params: { id: 'other' } });
  mockFocused = false; await update(); mockFocused = true; await update(); // a fresh visit lets the next command through
  await act(async () => discovery().onOpen(mockRows[1]));
  expect(mockRouter.navigate).toHaveBeenLastCalledWith({ pathname: '/potrebe/[id]/pregled', params: { id: 'mine' } });
  expect(mockRouter.navigate).toHaveBeenCalledTimes(2);
});

test.each(['loading', 'error'])('a task is not opened while the collection is %s, nor one that the read does not hold', async state => {
  mockRows = [{ id: 'a' }];
  mockLoading = state === 'loading'; mockError = state === 'error';
  await render();
  await act(async () => discovery().onOpen(mockRows[0]));
  expect(mockRouter.navigate).not.toHaveBeenCalled();
  mockLoading = false; mockError = false; await update();
  await act(async () => discovery().onOpen({ id: 'unknown' }));
  expect(mockRouter.navigate).not.toHaveBeenCalled();
});

test('one command at a time: a second destination is let through only on a fresh visit', async () => {
  await render();
  await act(async () => { discovery().onProfile(); discovery().onNotifications(); discovery().onNew(); });
  expect(mockRouter.navigate.mock.calls).toEqual([['/profil']]);
  mockFocused = false; await update(); mockFocused = true; await update();
  await act(async () => discovery().onNew());
  expect(mockRouter.navigate.mock.calls).toEqual([['/profil'], ['/nova']]);
});

test('a refresh reads the collection and the relations again, and only while this visit is in front', async () => {
  await render();
  await act(async () => discovery().onRefresh());
  expect(mockRefresh).toHaveBeenCalledWith(true); expect(mockRelationsRefresh).toHaveBeenCalledWith(true);
  const old = discovery().onRefresh;
  mockFocused = false; await update();
  mockRefresh.mockClear(); mockRelationsRefresh.mockClear();
  await act(async () => old());
  expect(mockRefresh).not.toHaveBeenCalled(); expect(mockRelationsRefresh).not.toHaveBeenCalled();
});

test('publication parameters in the address are ignored: no exact read, no landing, no publication prop', async () => {
  mockParams = { publishedNeedId: NEED, publishedRevision: '1', publishedHandoff: 'publication-1' };
  mockRows = [{ id: NEED, priblizno: { lat: 44.8, lng: 20.4 } }];
  await render();
  expect(mockSource.otvorenaPrilika).not.toHaveBeenCalled();
  expect(discovery().publicationFocus).toBeUndefined();
  expect(discovery().publicationUnavailable).toBeUndefined();
  expect(discovery().onOpenPublishedTask).toBeUndefined();
  expect(discovery().items).toEqual(mockRows);
  expect(discovery().initialWorkArea).toBe(mockWorkArea.target);
});

test('P5 work-area: the route passes the optional camera without changing any applied criterion', async () => {
  await render(); const original = discovery().view;
  expect(discovery().initialWorkArea).toBe(mockWorkArea.target);
  await act(async () => discovery().onInitialWorkAreaHandled('work-area'));
  expect(mockWorkArea.handled).toHaveBeenCalledWith('work-area'); expect(discovery().view).toBe(original);
});

test('P5 work-area: explicit intent retires the seed and stale visit callbacks do not', async () => {
  await render(); const old = discovery().onUserIntent;
  mockFocused = false; await update(); mockFocused = true; await update();
  await act(async () => old()); expect(mockWorkArea.retire).not.toHaveBeenCalled();
  await act(async () => discovery().onUserIntent()); expect(mockWorkArea.retire).toHaveBeenCalledTimes(1);
});
