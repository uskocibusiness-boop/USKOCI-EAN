import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockPublic = jest.fn(), mockNavigate = jest.fn(), mockPush = jest.fn(), mockReplace = jest.fn(), mockSwitch = jest.fn();
let mockSession = { user: { id: 'account-a' }, accountRevision: 1 }, mockIntent: 'narucilac' | 'uskocer' = 'uskocer', mockFocused = true;
const mockSource = { otvorenePrilike: (...args: unknown[]) => mockPublic(...args), mojePotrebe: async () => [], mojePrijave: async () => [] };
const mockApp = { currentState: 'active', addEventListener: () => ({ remove: () => {} }) };
jest.mock('expo-router', () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args), push: (...args: unknown[]) => mockPush(...args), replace: (...args: unknown[]) => mockReplace(...args) },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) { return key === 'AppState' ? mockApp : Reflect.get(target, key); } }); });
// This route suite supplies its source and session in memory. Keep the pure serverReceipt
// validators real, while preventing their unused transport import from starting Supabase Auth.
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected Supabase access in route test'); } }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource, useUloga: () => mockIntent, ulogaSada: () => mockIntent, postaviUlogu: (...args: unknown[]) => mockSwitch(...args) }));
// Zadaci renders DiscoveryPresentation since owner step 4 (2026-09-24): the same props under the same test name, so every
// guard below is asserted exactly as before. MarketplacePresentation is now Moji zadaci only and Zadaci never imports it,
// so it is no longer mocked here (review r3b).
jest.mock('../../ui/v2/DiscoveryPresentation', () => ({ DiscoveryPresentation: 'Marketplace' }));
import Public from '../../app/(app)/zadaci';

let tree: ReactTestRenderer;
const market = () => tree.root.findByType('Marketplace' as React.ElementType).props;
const render = async () => act(async () => { tree = create(<Public />); });
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); mockIntent = 'uskocer'; mockFocused = true; mockApp.currentState = 'active';
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockPublic.mockReset().mockResolvedValue([{ id: 'public' }]);
  mockNavigate.mockReset(); mockPush.mockReset(); mockReplace.mockReset(); mockSwitch.mockReset(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

// Owner decision 1 (2026-09-19) supersedes the sheet that asked a worker before "+" or "Moji" could
// switch the app into the requester mode. One account does all three things from here, directly.
test.each(['narucilac', 'uskocer'] as const)('"+" opens a new task directly and touches no mode, whatever the app last was (%s)', async last => {
  mockIntent = last; await render(); await act(async () => market().onNew());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/nova', params: { entryKey: expect.any(String) } });
  expect(mockPush).toHaveBeenCalledTimes(1); expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled(); expect(mockSwitch).not.toHaveBeenCalled();
});
// "Moji" was a callback the discovery screen never drew. Since the owner's information architecture of 2026-09-23 my
// own tasks are the "Moji zadaci" door on Početna, so Zadaci hands down no such switch and still touches no mode.
test.each(['narucilac', 'uskocer'] as const)('Zadaci carries no "Moji" switch and touches no mode (%s)', async last => {
  mockIntent = last; await render();
  expect(market().onSwitch).toBeUndefined();
  expect(mockNavigate).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled(); expect(mockSwitch).not.toHaveBeenCalled();
});
test('no sheet is ever mounted, so there is nothing to confirm after the account or the focus changes', async () => {
  await render(); expect(tree.root.findAllByType('Transition' as React.ElementType)).toHaveLength(0);
  const retained = market().onNew; mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  await act(async () => tree.update(<Public />)); await act(async () => retained());
  expect(mockNavigate).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled(); expect(mockSwitch).not.toHaveBeenCalled();
});
