import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockRead = jest.fn(), mockNavigate = jest.fn(), mockCancellations = jest.fn();
let mockSession = { user: { id: 'account-a' }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true;
let mockParams: { odeljak?: string } = {};
const mockSource = { mojiDogovori: () => mockRead() };
const mockListeners = new Set<(state: string) => void>();
const mockApp = { currentState: 'active', addEventListener: (_: string, fn: (state: string) => void) => {
  mockListeners.add(fn); return { remove: () => mockListeners.delete(fn) };
} };
jest.mock('expo-router', () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args), setParams: (params: { odeljak?: string }) => { mockParams = params; } },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, {
  get(target, key) { return key === 'AppState' ? mockApp : Reflect.get(target, key); },
}); });
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource, useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('../agreementCancellationClientService', () => ({ agreementCancellationService: { read: (...args: unknown[]) => mockCancellations(...args) } }));
jest.mock('../../ui/v2/AgreementCollectionPresentation', () => ({ AgreementCollectionPresentation: 'Agreements' }));
// This route suite isolates the whole presentation; its injected header/photo are separate UI leaves.
jest.mock('../../ui/system/ScreenHeader', () => ({ ScreenHeader: 'ScreenHeader' }));
jest.mock('../../ui/system/ActualUserAvatar', () => ({ ActualUserAvatar: 'ActualUserAvatar' }));
import Screen from '../../app/(app)/dogovori';
let tree: ReactTestRenderer;
const props = () => tree.root.findByType('Agreements' as React.ElementType).props;
const render = async () => act(async () => { tree = create(<Screen />); });
const update = async () => act(async () => tree.update(<Screen />));
const deferred = () => { let resolve!: (rows: any[]) => void; const promise = new Promise<any[]>(done => { resolve = done; }); return { resolve, promise }; };
beforeEach(() => {
  jest.useFakeTimers(); jest.spyOn(console, 'error').mockImplementation(() => {});
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true; mockApp.currentState = 'active';
  mockParams = {};
  mockRead.mockReset().mockImplementation(async () => [{ id: 'owned', verzija: 1 }]); mockNavigate.mockReset();
  mockCancellations.mockReset().mockResolvedValue({ ok: true, podatak: new Map() });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });

test('the profile link `odeljak=istorija` opens the section of finished Dogovori, also when the tab is already mounted', async () => {
  await render(); expect(props().section).toBe('active');
  mockParams = { odeljak: 'istorija' }; await update(); expect(props().section).toBe('history');
});
test('opens on the history section when it is mounted with `odeljak=istorija`', async () => {
  mockParams = { odeljak: 'istorija' }; await render(); expect(props().section).toBe('history');
});
test('uses the existing owned read and opens the actual Agreement once', async () => {
  await render(); const shown = props(); await act(async () => { shown.onOpen(shown.items[0]); shown.onOpen(shown.items[0]); });
  expect(mockRead).toHaveBeenCalledTimes(1); expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'owned' } });
});
test('account ABA drops late private rows, old navigation and old filters', async () => {
  const late = deferred(); mockRead.mockReturnValueOnce(late.promise); await render(); const old = props();
  await act(async () => { old.onSection('history'); old.onConfirmationOnly(true); });
  mockSession = { user: { id: 'account-b' }, accountRevision: 2 }; await update();
  mockSession = { user: { id: 'account-a' }, accountRevision: 3 }; await update();
  // "Svi" is gone (round-1 critique A11); a retained section change is refused the same way.
  await act(async () => { late.resolve([{ id: 'retired-private' }]); old.onCalendar(); old.onSection('history'); });
  expect(props().items).toEqual([{ id: 'owned', verzija: 1 }]); expect(props().section).toBe('active');
  expect(props().confirmationOnly).toBe(false); expect(mockNavigate).not.toHaveBeenCalled();
});
test('refresh rejects a retained card even when the same Agreement ID returns at a new version', async () => {
  await render(); const old = props(); mockRead.mockResolvedValueOnce([{ id: 'owned', verzija: 2 }]);
  await act(async () => props().onRefresh()); await act(async () => old.onOpen(old.items[0]));
  expect(mockNavigate).not.toHaveBeenCalled(); await act(async () => props().onOpen(props().items[0]));
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});
test('refresh and retained card press in the same React batch cannot navigate', async () => {
  await render(); const old = props();
  await act(async () => { old.onRefresh(); old.onOpen(old.items[0]); });
  expect(mockNavigate).not.toHaveBeenCalled();
});
test('blur rejects actions and returning focus rereads and clears the navigation latch', async () => {
  await render(); const old = props(); await act(async () => old.onCalendar()); mockNavigate.mockClear();
  mockFocused = false; await update(); await act(async () => { old.onProfile(); old.onRefresh(); });
  expect(mockRead).toHaveBeenCalledTimes(1); mockFocused = true; await update();
  await act(async () => { old.onOpen(old.items[0]); props().onOpen(props().items[0]); });
  expect(mockRead).toHaveBeenCalledTimes(2); expect(mockNavigate).toHaveBeenCalledTimes(1);
});
test('background and an unfinished foreground refresh reject old actions', async () => {
  await render(); const old = props(); mockApp.currentState = 'background';
  await act(async () => { mockListeners.forEach(listener => listener('background')); old.onHome(); });
  expect(tree.root.findAllByType('Agreements' as React.ElementType)).toHaveLength(0);
  expect(mockNavigate).not.toHaveBeenCalled(); const pending = deferred(); mockRead.mockReturnValueOnce(pending.promise);
  mockApp.currentState = 'active'; await act(async () => mockListeners.forEach(listener => listener('active')));
  expect(props().items).toEqual([]); await act(async () => old.onOpen(old.items[0])); expect(mockNavigate).not.toHaveBeenCalled();
});
test.each(['active', 'history'] as const)('returning from a backgrounded Agreement keeps %s and its filter, but reloads private rows', async section => {
  await render();
  await act(async () => { props().onSection(section); props().onConfirmationOnly(true); });
  const old = props();
  await act(async () => old.onOpen(old.items[0]));
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'owned' } });
  mockFocused = false; await update();
  await act(async () => { mockApp.currentState = 'background'; mockListeners.forEach(listener => listener('background')); });
  expect(tree.root.findAllByType('Agreements' as React.ElementType)).toHaveLength(0);
  await act(async () => { old.onSection(section === 'active' ? 'history' : 'active'); old.onConfirmationOnly(false); });
  await act(async () => { mockApp.currentState = 'active'; mockListeners.forEach(listener => listener('active')); });
  // The mounted list is still behind the detail route; it must not read until focus returns.
  expect(mockRead).toHaveBeenCalledTimes(1);
  expect(props()).toMatchObject({ section, confirmationOnly: true, items: [], loading: true });
  const fresh = deferred(); mockRead.mockReturnValueOnce(fresh.promise);
  mockFocused = true; await update();
  expect(props()).toMatchObject({ section, confirmationOnly: true, items: [], loading: true });
  await act(async () => fresh.resolve([{ id: 'fresh-owned', verzija: 2 }]));
  expect(props()).toMatchObject({ section, confirmationOnly: true, items: [{ id: 'fresh-owned', verzija: 2 }] });
  mockNavigate.mockClear();
  await act(async () => { old.onOpen(old.items[0]); props().onOpen(props().items[0]); });
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'fresh-owned' } });
});
test('account ABA while backgrounded resets retained display choices before the fresh account read', async () => {
  await render(); await act(async () => { props().onSection('history'); props().onConfirmationOnly(true); });
  const old = props();
  await act(async () => { mockApp.currentState = 'background'; mockListeners.forEach(listener => listener('background')); });
  mockSession = { user: { id: 'account-b' }, accountRevision: 2 }; await update();
  mockSession = { user: { id: 'account-a' }, accountRevision: 3 }; await update();
  const fresh = deferred(); mockRead.mockReturnValueOnce(fresh.promise);
  await act(async () => { mockApp.currentState = 'active'; mockListeners.forEach(listener => listener('active')); });
  await act(async () => { old.onSection('history'); old.onConfirmationOnly(true); });
  expect(props()).toMatchObject({ section: 'active', confirmationOnly: false, items: [], loading: true });
  await act(async () => fresh.resolve([{ id: 'fresh-account', verzija: 1 }]));
  expect(props()).toMatchObject({ section: 'active', confirmationOnly: false, items: [{ id: 'fresh-account', verzija: 1 }] });
});
test('batched background and foreground retire the old read even with the same account', async () => {
  const late = deferred(); mockRead.mockReturnValueOnce(late.promise); await render(); const old = props();
  await act(async () => {
    mockApp.currentState = 'background'; mockListeners.forEach(listener => listener('background'));
    mockApp.currentState = 'active'; mockListeners.forEach(listener => listener('active'));
    old.onCalendar();
  });
  await act(async () => late.resolve([{ id: 'old-private' }]));
  expect(props().items).toEqual([{ id: 'owned', verzija: 1 }]); expect(mockNavigate).not.toHaveBeenCalled();
});
test('bounded read rejects a late result; explicit retry recovers without exposing raw errors', async () => {
  const late = deferred(); mockRead.mockReturnValueOnce(late.promise); await render();
  await act(async () => jest.advanceTimersByTime(15_001)); expect(props().loading).toBe(false); expect(props().error).toBe(true);
  await act(async () => late.resolve([{ id: 'late-private' }])); expect(props().items).toEqual([]);
  await act(async () => props().onRefresh()); expect(props().error).toBe(false); expect(props().items[0].id).toBe('owned');
});
// Round-1 critique A2 (owner step 8): the rating strip on a finished Dogovor's card goes straight to the rating, the
// route the Dogovor's own footer opens, behind the same guards as opening the card.
describe('the rating strip', () => {
  const finished = { id: '20000000-0000-4000-8000-000000000001', verzija: 1, stanje: 'COMPLETED', ocenaMoguca: true };
  beforeEach(() => { mockRead.mockImplementation(async () => [finished, { id: 'live', verzija: 1, stanje: 'CONFIRMED', ocenaMoguca: false }]); });
  test('opens the rating of that Dogovor once, saying where Back returns', async () => {
    await render(); const shown = props();
    await act(async () => { shown.onRate(shown.items[0]); shown.onRate(shown.items[0]); });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/oceni-dogovor', params: { agreementId: finished.id, from: 'dogovori' } });
  });
  test('refuses a Dogovor that has no rating to give, and a card from an older read', async () => {
    await render(); const old = props();
    await act(async () => old.onRate(old.items[1])); expect(mockNavigate).not.toHaveBeenCalled();
    mockRead.mockResolvedValueOnce([{ ...finished, verzija: 2 }]);
    await act(async () => props().onRefresh()); await act(async () => old.onRate(old.items[0]));
    expect(mockNavigate).not.toHaveBeenCalled();
    await act(async () => props().onRate(props().items[0])); expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
  test('is refused while the screen is not focused, in the background, or after the account changed', async () => {
    await render(); const old = props();
    mockFocused = false; await update(); await act(async () => old.onRate(old.items[0]));
    expect(mockNavigate).not.toHaveBeenCalled();
    mockFocused = true; await update(); const focused = props();
    mockApp.currentState = 'background'; await act(async () => focused.onRate(focused.items[0]));
    expect(mockNavigate).not.toHaveBeenCalled(); mockApp.currentState = 'active';
    mockSession = { user: { id: 'account-b' }, accountRevision: 2 }; await act(async () => focused.onRate(focused.items[0]));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
test('there is no mode to change: what used to reset the list on a switch now leaves its section and its callbacks alone', async () => {
  // Owner decision 1 (2026-09-19). One list holds both sides of one account, so nothing about the
  // app can change "which side" it is, and a Dogovor opened from either side resets nothing here.
  await render(); const old = props(); await act(async () => old.onSection('history')); mockIntent = 'uskocer'; await update();
  expect(props().section).toBe('history'); expect('requester' in props()).toBe(false); expect('intent' in props()).toBe(false);
  await act(async () => props().onHome()); expect(mockNavigate).toHaveBeenCalledWith('/');
});
// Plan 2.6: Istorija has its chips ("Sve · Završeni · Otkazani"). The choice is a display choice, kept like the section and the
// confirmation filter: through the foreground gate, retired with the account, and refused to a retained callback.
test('the Istorija chip is kept through the foreground gate, retired with the account, and refused to a retained callback', async () => {
  await render();
  expect(props().historyFilter).toBe('all');
  await act(async () => { props().onSection('history'); props().onHistoryFilter('cancelled'); });
  expect(props()).toMatchObject({ section: 'history', historyFilter: 'cancelled' });
  await act(async () => { mockApp.currentState = 'background'; mockListeners.forEach(listener => listener('background')); });
  expect(tree.root.findAllByType('Agreements' as React.ElementType)).toHaveLength(0);
  await act(async () => { mockApp.currentState = 'active'; mockListeners.forEach(listener => listener('active')); });
  expect(props()).toMatchObject({ section: 'history', historyFilter: 'cancelled' });
  const old = props();
  mockSession = { user: { id: 'account-b' }, accountRevision: 2 }; await update();
  expect(props()).toMatchObject({ section: 'active', historyFilter: 'all' });
  await act(async () => old.onHistoryFilter('completed'));
  expect(props().historyFilter).toBe('all');
  await act(async () => props().onHistoryFilter('completed'));
  expect(props().historyFilter).toBe('completed');
});
test('a blurred list refuses a chip press', async () => {
  await render(); const old = props();
  mockFocused = false; await update();
  await act(async () => old.onHistoryFilter('cancelled'));
  mockFocused = true; await update();
  expect(props().historyFilter).toBe('all');
});

// The empty list's two ways to a first Dogovor, and CANCEL-INFO (when, by whom and why a Dogovor was cancelled).
test('the empty list leads to the tasks and to publishing one, behind the same guards as every other press', async () => {
  await render(); const old = props();
  await act(async () => old.onTasks());
  expect(mockNavigate).toHaveBeenCalledWith('/zadaci'); mockNavigate.mockClear();
  mockFocused = false; await update(); await act(async () => old.onPublish());
  expect(mockNavigate).not.toHaveBeenCalled(); mockFocused = true; await update();
  await act(async () => props().onPublish());
  expect(mockNavigate).toHaveBeenCalledWith('/nova');
});
describe('who cancelled, when and why (CANCEL-INFO)', () => {
  const cancelled = { id: '20000000-0000-4000-8000-0000000000c1', verzija: 1, stanje: 'CANCELLED' };
  const answer = { agreementId: cancelled.id, cancelledAt: '2026-10-07T18:23:45+00:00', by: 'WORKER', byMe: true, reason: 'Promenio sam plan.', reasonState: 'KEPT' };
  beforeEach(() => { mockRead.mockImplementation(async () => [{ id: 'live', verzija: 1, stanje: 'CONFIRMED' }, cancelled]); });

  test('is asked for only when Istorija is on screen and holds a cancelled Dogovor, once, in one call, and handed to the list', async () => {
    mockCancellations.mockResolvedValue({ ok: true, podatak: new Map([[cancelled.id, answer]]) });
    await render();
    expect(mockCancellations).not.toHaveBeenCalled(); expect(props().cancellations).toBeNull();
    await act(async () => props().onSection('history'));
    expect(mockCancellations).toHaveBeenCalledTimes(1);
    expect(mockCancellations).toHaveBeenCalledWith([cancelled.id], { accountId: 'account-a', accountRevision: 1 });
    expect(props().cancellations.get(cancelled.id)).toEqual(answer);
    await act(async () => props().onHistoryFilter('cancelled')); await update();
    expect(mockCancellations).toHaveBeenCalledTimes(1);
  });

  test('is not asked for when nothing in the list is cancelled', async () => {
    mockRead.mockImplementation(async () => [{ id: 'live', verzija: 1, stanje: 'CONFIRMED' }]);
    await render(); await act(async () => props().onSection('history'));
    expect(mockCancellations).not.toHaveBeenCalled();
  });

  test('a read that fails, or throws, leaves the cards saying only "Otkazan": no cancellations are handed over', async () => {
    mockCancellations.mockResolvedValue({ ok: false, kod: 'CANCELLATION_READ_FAILED', poruka: 'x' });
    await render(); await act(async () => props().onSection('history'));
    expect(mockCancellations).toHaveBeenCalledTimes(1); expect(props().cancellations).toBeNull();
    mockCancellations.mockRejectedValue(new Error('boom'));
    await act(async () => { props().onSection('active'); }); await act(async () => { props().onSection('history'); });
    expect(props().cancellations).toBeNull();
  });
});

test('role survives background without a new filter read, retires on account ABA, and repeated total-history entry clears all narrowing', async () => {
 await render(); await act(async()=>props().onRoleFilter('uskocer'));
 expect(props().roleFilter).toBe('uskocer');expect(mockRead).toHaveBeenCalledTimes(1);
 await act(async()=>{mockApp.currentState='background';mockListeners.forEach(fn=>fn('background'));});
 await act(async()=>{mockApp.currentState='active';mockListeners.forEach(fn=>fn('active'));});
 expect(props().roleFilter).toBe('uskocer');
 for(let n=0;n<2;n++){
  await act(async()=>{props().onRoleFilter('uskocer');props().onHistoryFilter('cancelled');});
  mockParams={odeljak:'istorija'};await update();await update();
  expect(props()).toMatchObject({section:'history',roleFilter:'all',historyFilter:'all',confirmationOnly:false});
 }
 await act(async()=>props().onRoleFilter('uskocer'));const stale=props().onRoleFilter;
 mockSession={user:{id:'account-a'},accountRevision:3};await update();
 await act(async()=>stale('narucilac'));expect(props().roleFilter).toBe('all');
});
