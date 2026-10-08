import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockMine = jest.fn(), mockPublic = jest.fn(), mockRelations = jest.fn(), mockNavigate = jest.fn();
let mockTraceParam: unknown, mockPackage = 'rs.uskoci.dev';
jest.mock('expo-constants', () => ({ __esModule: true, get default() { return { expoConfig: { android: { package: mockPackage } } }; } }));
let mockSession = { user: { id: 'account-a' }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true;
const mockSource = { mojePotrebe: (...args: unknown[]) => mockMine(...args), otvorenePrilike: (...args: unknown[]) => mockPublic(...args),
  odnosiPremaZadacima: (...args: unknown[]) => mockRelations(...args) };
const mockListeners = new Set<(state: string) => void>();
const mockApp = { currentState: 'active', addEventListener: (_: string, fn: (state: string) => void) => { mockListeners.add(fn); return { remove: () => mockListeners.delete(fn) }; } };
jest.mock('expo-router', () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args) }, useLocalSearchParams: () => ({ discoveryTrace: mockTraceParam }), useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) { return key === 'AppState' ? mockApp : Reflect.get(target, key); } }); });
// The screens below use mockSource. Keep serverReceipt's validation code real, and fail
// explicitly if an isolated route unexpectedly tries to call the Supabase transport.
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected Supabase access in route test'); } }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource, useUloga: () => mockIntent, ulogaSada: () => mockIntent, postaviUlogu: jest.fn() }));
jest.mock('../../ui/v2/MarketplacePresentation', () => ({ MarketplacePresentation: 'Marketplace' }));
// Zadaci renders DiscoveryPresentation since owner step 4 (2026-09-24): the same props under the same test name, so every
// guard below is asserted exactly as before.
jest.mock('../../ui/v2/DiscoveryPresentation', () => ({ DiscoveryPresentation: 'Marketplace' }));
import Owned from '../../app/(app)/potrebe';
// Discovery is the Zadaci tab since 2026-09-23; /prilike and /mapa only redirect to it (retired-discovery-routes.test).
import Public from '../../app/(app)/zadaci';
const SharedMap = Public;
import { taskRelationIndex } from '../taskRelation';
const deferred = () => { let resolve!: (rows: any[]) => void; const promise = new Promise<any[]>(done => { resolve = done; }); return { promise, resolve }; };
let tree: ReactTestRenderer, Component: typeof Owned;
const props = () => tree.root.findByType('Marketplace' as React.ElementType).props;
const render = async () => act(async () => { tree = create(<Component />); });
const update = async () => act(async () => tree.update(<Component />));
const traceEvent = (call: unknown[]) => JSON.parse(String(call[0]).replace(/^\[USKOCI_DISCOVERY_TRACE\] /, ''));
beforeEach(() => { jest.useFakeTimers(); jest.spyOn(console, 'error').mockImplementation(() => {}); mockTraceParam = undefined; mockPackage = 'rs.uskoci.dev'; Component = Public; mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true; mockApp.currentState = 'active'; mockMine.mockReset().mockResolvedValue([{ id: 'mine' }]); mockPublic.mockReset().mockResolvedValue([{ id: 'public' }]); mockRelations.mockReset().mockImplementation(async (ids: readonly string[]) => taskRelationIndex([], ids)); mockNavigate.mockReset(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });

test.each([
 ['rs.uskoci.dev', undefined], ['rs.uskoci.dev', '0'], ['rs.uskoci.dev', ['1']],
 ['rs.uskoci.preview', '1'], ['rs.uskoci', '1'], ['different.dev', '1'],
])('native trace stays absent for package %s and query %s even in the test DEV runtime', async (pkg, query) => {
 const logged = jest.spyOn(console, 'info').mockImplementation(() => {});
 mockPackage = pkg as string; mockTraceParam = query; await render();
 expect(props().trace).toBeUndefined(); expect(logged).not.toHaveBeenCalled();
});

test('opted-in DEV trace records accepted and rejected view writes without any task, query or account data', async () => {
 const logged = jest.spyOn(console, 'info').mockImplementation(() => {});
 mockTraceParam = '1'; mockPublic.mockResolvedValue([{ id: 'never-log-id', naslov: 'never-log-title' }]); await render();
 const old = props();
 await act(async () => old.onView({ ...old.view, query: 'never-log-query', selectedId: 'never-log-selected', listOffset: 160, sheet: 'full' }));
 mockFocused = false; await update();
 await act(async () => old.onView({ ...old.view, query: 'never-log-retired', listOffset: 0 }));
 mockFocused = true; await update();
 const events = logged.mock.calls.map(traceEvent);
 expect(events).toEqual(expect.arrayContaining([
  expect.arrayContaining(['route-trace']), [expect.any(Number), 'route-view', true, 0, 160, 2],
  [expect.any(Number), 'route-view', false, 160, 0, -1], [expect.any(Number), 'route-focus', 160, 2],
 ]));
 expect(props().view.listOffset).toBe(160);
 expect(JSON.stringify(logged.mock.calls)).not.toMatch(/never-log|account-a|public/);
 expect(events.every(event => event.slice(2).every((value: unknown) => typeof value === 'boolean' || typeof value === 'number'))).toBe(true);
});

test('DEV trace rejects unsafe payloads, caps noisy samples and retains room for pre-open and Back before the total cap', async () => {
 const logged = jest.spyOn(console, 'info').mockImplementation(() => {});
 mockTraceParam = '1'; await render(); const trace = props().trace;
 const before = logged.mock.calls.length;
 for (const values of [['secret'], [{ accountId: 'secret' }], [Infinity], [NaN], Array(21).fill(1)]) trace('preopen', ...values);
 trace('secret-event', 1); expect(logged).toHaveBeenCalledTimes(before);
 for (let i = 0; i < 200; i++) trace('scroll', i);
 const samples = logged.mock.calls.map(traceEvent).filter(event => event[1] === 'scroll');
 expect(samples).toHaveLength(32);
 trace('preopen', 160, 160, true, 2); trace('route-blur', 160, 2); trace('route-focus', 160, 2);
 expect(logged.mock.calls.slice(-3).map(call => traceEvent(call)[1])).toEqual(['preopen', 'route-blur', 'route-focus']);
 for (let i = 0; i < 200; i++) trace('preopen', i);
 expect(logged).toHaveBeenCalledTimes(120);
 expect(logged.mock.calls.every(call => call.length === 1 && String(call[0]).startsWith('[USKOCI_DISCOVERY_TRACE] '))).toBe(true);
});

test('removing the explicit trace query disables retained diagnostic callbacks', async () => {
 const logged = jest.spyOn(console, 'info').mockImplementation(() => {});
 mockTraceParam = '1'; await render(); const oldTrace = props().trace;
 mockTraceParam = undefined; await update(); logged.mockClear();
 oldTrace('preopen', 160); expect(props().trace).toBeUndefined(); expect(logged).not.toHaveBeenCalled();
});
test.each(['owned', 'public'])('%s uses its existing source read and actual detail route; rapid second tap navigates once', async kind => {
 Component = kind === 'owned' ? Owned : Public; await render(); const item = props().items[0]; await act(async () => { props().onOpen(item); props().onOpen(item); });
 expect(mockNavigate).toHaveBeenCalledTimes(1); expect(mockNavigate).toHaveBeenCalledWith({ pathname: kind === 'owned' ? '/potrebe/[id]/pregled' : '/prilike/[id]', params: { id: item.id } });
 expect(kind === 'owned' ? mockMine : mockPublic).toHaveBeenCalledTimes(1);
});
test('account ABA clears filters and rejects retired data/callbacks even with same account ID', async () => {
 const late = deferred(); mockPublic.mockReturnValueOnce(late.promise); await render(); const old = props(); await act(async () => old.onView({ ...old.view, query: 'old', mode: 'list' }));
 mockSession = { user: { id: 'account-b' }, accountRevision: 2 }; await update(); mockSession = { user: { id: 'account-a' }, accountRevision: 3 }; await update();
 await act(async () => { late.resolve([{ id: 'old' }]); old.onView({ ...old.view, query: 'late' }); old.onOpen({ id: 'old' }); });
 expect(props().items).toEqual([{ id: 'public' }]); expect(props().view.query).toBe(''); expect(props().view.mode).toBe('map'); expect(mockNavigate).not.toHaveBeenCalled();
});
test('blur rejects actions and returning focus rereads/reset navigation; old callback remains invalid', async () => {
 await render(); const old = props(); mockFocused = false; await update(); await act(async () => { old.onOpen(old.items[0]); old.onView({ ...old.view, query: 'blurred' }); }); expect(mockNavigate).not.toHaveBeenCalled();
 mockFocused = true; await update(); await act(async () => { old.onOpen(old.items[0]); props().onOpen(props().items[0]); }); expect(mockNavigate).toHaveBeenCalledTimes(1); expect(mockPublic).toHaveBeenCalledTimes(2);
});
test('background actions and stale pre-refresh card cannot navigate; foreground read recovers', async () => {
 await render(); const old = props(); mockApp.currentState = 'background'; await act(async () => old.onOpen(old.items[0])); expect(mockNavigate).not.toHaveBeenCalled();
 const pending = deferred(); mockPublic.mockReturnValueOnce(pending.promise); mockApp.currentState = 'active'; await act(async () => { mockListeners.forEach(listener => listener('active')); }); expect(props().loading).toBe(true);
 await act(async () => old.onOpen(old.items[0])); expect(mockNavigate).not.toHaveBeenCalled(); await act(async () => pending.resolve([{ id: 'new' }])); await act(async () => old.onOpen(old.items[0])); expect(mockNavigate).not.toHaveBeenCalled();
});
test('hung source fails at bounded deadline; late completion is ignored and explicit retry succeeds', async () => {
 const pending = deferred(); mockPublic.mockReturnValueOnce(pending.promise); await render(); await act(async () => jest.advanceTimersByTime(15_001)); expect(props().error).toBe(true); expect(props().items).toEqual([]);
 await act(async () => pending.resolve([{ id: 'late' }])); expect(props().error).toBe(true); expect(props().items).toEqual([]);
 await act(async () => props().onRefresh()); expect(props().error).toBe(false); expect(props().items).toEqual([{ id: 'public' }]);
});
// Owner decision 1 (2026-09-19). A switch of the app's mode used to empty the search, reset the map
// and retire every callback here. There is no mode now, so opening something from "the other side"
// and coming back finds the screen exactly as it was left.
test('a flip of the retired app mode resets nothing: the search stays, the new-task entry stays, and callbacks still work', async () => {
 await render(); const old = props(); await act(async () => old.onView({ ...old.view, query: 'kept query' })); mockIntent = 'uskocer'; await update();
 expect(props().view.query).toBe('kept query'); expect(typeof props().onNew).toBe('function');
 await act(async () => old.onOpen(old.items[0])); expect(mockNavigate).toHaveBeenCalledTimes(1);
});
// "Papir na stolu" (2026-10-08): the first encounter of Moji zadaci has a quiet way, "Pogledaj zadatke", to other people's tasks; it is the route's command and
// has the guard of every press here: the focused screen, the account, the foreground, once per focus.
test('Moji zadaci hands the presentation the quiet way to the tasks of others: it opens Zadaci once, and a blurred or backgrounded screen refuses it', async () => {
 Component = Owned; await render();
 expect(typeof props().onExplore).toBe('function');
 await act(async () => props().onExplore());
 expect(mockNavigate).toHaveBeenCalledTimes(1); expect(mockNavigate).toHaveBeenCalledWith('/zadaci');
 await act(async () => props().onExplore()); expect(mockNavigate).toHaveBeenCalledTimes(1);
 await act(async () => tree.unmount()); mockNavigate.mockReset(); mockApp.currentState = 'background'; await render();
 await act(async () => props().onExplore()); expect(mockNavigate).not.toHaveBeenCalled();
 await act(async () => tree.unmount()); mockApp.currentState = 'active'; mockFocused = false; await render();
 await act(async () => props().onExplore()); expect(mockNavigate).not.toHaveBeenCalled();
});
test('discovery labels my own task and the one I applied to, asks only about the tasks on screen, and a failed read labels nothing', async () => {
 mockPublic.mockResolvedValue([{ id: 'mine' }, { id: 'applied' }, { id: 'other' }]);
 mockRelations.mockImplementation(async (ids: readonly string[]) => taskRelationIndex([
   { needId: 'mine', relation: 'OWNER', applicationId: null, applicationState: null, agreementId: null },
   { needId: 'applied', relation: 'APPLIED', applicationId: 'a1', applicationState: 'SUBMITTED', agreementId: null },
   // A withdrawn application is not a standing relation: that task is open to apply to again.
   { needId: 'other', relation: 'APPLIED', applicationId: 'a2', applicationState: 'WITHDRAWN', agreementId: null },
 ], ids));
 await render();
 // The overlay covers the page and nothing else: the whole task list is never read for a label.
 expect(mockRelations).toHaveBeenCalledWith(['mine', 'applied', 'other'], { signal: expect.any(AbortSignal) });
 expect(mockMine).not.toHaveBeenCalled();
 expect([...props().relations.owned]).toEqual(['mine']); expect([...props().relations.applied]).toEqual(['applied']);
 await act(async () => tree.unmount());
 mockRelations.mockRejectedValue(new Error('TASK_RELATIONS_READ_FAILED')); await render();
 expect(props().items).toHaveLength(3); expect(props().relations).toBeUndefined();
});
// Relations are labels only: the public rows remain usable while the overlay loads or fails.
test('discovery says while the labels for the tasks on screen are still being read, and a failed read is not pending', async () => {
 let answer!: (index: unknown) => void;
 mockPublic.mockResolvedValue([{ id: 'mine' }, { id: 'other' }]);
 mockRelations.mockImplementation(async (ids: readonly string[]) => ids.length ? new Promise(done => { answer = done; }) : taskRelationIndex([], ids));
 await render();
 expect(props().items).toHaveLength(2); expect(props().relationsPending).toBe(true); expect(props().relations).toBeUndefined();
 await act(async () => props().onOpen(props().items[1])); expect(mockNavigate).toHaveBeenCalledTimes(1); // opening never waits for labels
 await act(async () => answer(taskRelationIndex([{ needId: 'mine', relation: 'OWNER', applicationId: null, applicationState: null, agreementId: null }], ['mine', 'other'])));
 expect(props().relationsPending).toBe(false); expect([...props().relations.owned]).toEqual(['mine']);
 await act(async () => tree.unmount());
 mockRelations.mockRejectedValue(new Error('TASK_RELATIONS_READ_FAILED')); await render();
 expect(props().relationsPending).toBe(false); expect(props().relations).toBeUndefined();
});
// Review r3b: the labels read has the list read's 15 s limit. A read that never answers would otherwise stay pending for
// good, and the count, the sheet's start and the map would wait for it forever.
test('a labels read that never answers fails at the same bounded deadline and is then not pending; the list stays', async () => {
 mockPublic.mockResolvedValue([{ id: 'mine' }, { id: 'other' }]);
 mockRelations.mockImplementation(async (ids: readonly string[]) => ids.length ? new Promise(() => undefined) : taskRelationIndex([], ids));
 await render();
 expect(props().items).toHaveLength(2); expect(props().relationsPending).toBe(true);
 await act(async () => jest.advanceTimersByTime(14_999)); expect(props().relationsPending).toBe(true);
 await act(async () => jest.advanceTimersByTime(1)); await act(async () => undefined);
 expect(props().relationsPending).toBe(false); expect(props().relations).toBeUndefined();
 expect(props().items).toHaveLength(2); expect(props().error).toBe(false);
});
test.each(['narucilac', 'uskocer'])('central map opens actual public pins whatever the app last was (%s) and retains its camera across detail focus', async intent => {
 Component = SharedMap; mockIntent = intent; await render();
 expect(props().view.mode).toBe('map'); expect(mockPublic).toHaveBeenCalledTimes(1);
 const viewport = { center: [19.83, 45.25], zoom: 13, bounds: [19, 45, 20, 46] };
 await act(async () => props().onView({ ...props().view, viewport, selectedId: 'public' }));
 mockFocused = false; await update(); mockFocused = true; await update();
 expect(props().view.viewport).toEqual(viewport); expect(props().view.selectedId).toBe('public');
 await act(async () => props().onOpen(props().items[0]));
 expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/prilike/[id]', params: { id: 'public' } });
});
// One task card (step 5a, 2026-09-24): my own task's foot goes straight to the applications waiting for my choice, the
// same direct entry Početna and the notifications use, behind the same navigation guard as opening the task.
test('my own task opens its waiting applications once, through the same guard, and only for a task of the latest read', async () => {
 Component = Owned; await render(); const item = props().items[0];
 await act(async () => { props().onApplications(item); props().onApplications(item); props().onOpen(item); });
 expect(mockNavigate).toHaveBeenCalledTimes(1);
 expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/kandidati', params: { id: 'mine' } });
 await act(async () => tree.unmount()); mockNavigate.mockReset(); await render();
 // A card that is not in the latest read, a blurred screen and a backgrounded app are all refused.
 await act(async () => props().onApplications({ id: 'stale' })); expect(mockNavigate).not.toHaveBeenCalled();
 const old = props(); mockFocused = false; await update(); await act(async () => old.onApplications(old.items[0])); expect(mockNavigate).not.toHaveBeenCalled();
 mockFocused = true; await update(); mockApp.currentState = 'background'; await act(async () => props().onApplications(props().items[0]));
 expect(mockNavigate).not.toHaveBeenCalled();
 mockApp.currentState = 'active'; await act(async () => props().onApplications(props().items[0]));
 expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/kandidati', params: { id: 'mine' } });
});
test('discovery hands no applications foot to its cards', async () => {
 await render(); expect(props().onApplications).toBeUndefined();
});

test('joint refresh recovers a failed relation read for identical IDs and keeps the current view', async () => {
 mockPublic.mockResolvedValue([{ id: 'mine' }, { id: 'other' }]);
 mockRelations.mockImplementation(async (ids: readonly string[]) => {
   if (!ids.length) return taskRelationIndex([], ids);
   throw new Error('TASK_RELATIONS_READ_FAILED');
 });
 await render();
 expect(props().relationsError).toBe(true); expect(props().relationsPending).toBe(false);
 const view = { ...props().view, query: 'kept', selectedId: 'mine', viewport: { center: [19.8, 45.2], zoom: 13, bounds: [19, 45, 20, 46] } };
 await act(async () => props().onView(view));
 let answer!: (value: ReturnType<typeof taskRelationIndex>) => void;
 mockRelations.mockImplementation((ids: readonly string[]) => ids.length ? new Promise(done => { answer = done; }) : Promise.resolve(taskRelationIndex([], ids)));
 const before = mockRelations.mock.calls.length, reads = mockPublic.mock.calls.length;
 await act(async () => props().onRefresh());
 expect(mockRelations).toHaveBeenCalledTimes(before + 1); expect(mockPublic).toHaveBeenCalledTimes(reads + 1);
 expect(props().items).toEqual([{ id: 'mine' }, { id: 'other' }]); expect(props().relationsPending).toBe(true);
 await act(async () => answer(taskRelationIndex([{ needId: 'mine', relation: 'OWNER' }], ['mine', 'other'])));
 expect(props().relationsError).toBe(false); expect(props().relations.relation('mine').kind).toBe('OWNER');
 expect(props().relations.relation('other').kind).toBe('NONE'); expect(props().relations.relation('unasked').kind).toBe('UNKNOWN');
 expect(props().view).toEqual(view);
 await act(async () => props().onOpen({ id: 'mine' }));
 expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/pregled', params: { id: 'mine' } });
});

test('changed public IDs retire the previous relation answer and read the new coverage', async () => {
 let oldAnswer!: (value: ReturnType<typeof taskRelationIndex>) => void;
 mockPublic.mockResolvedValueOnce([{ id: 'old' }]).mockResolvedValue([{ id: 'new' }]);
 mockRelations.mockImplementation((ids: readonly string[]) => ids.includes('old')
   ? new Promise(done => { oldAnswer = done; }) : Promise.resolve(taskRelationIndex([], ids)));
 await render(); expect(props().relationsPending).toBe(true);
 await act(async () => props().onRefresh());
 expect(props().items).toEqual([{ id: 'new' }]); expect(props().relations.relation('new').kind).toBe('NONE');
 await act(async () => oldAnswer(taskRelationIndex([{ needId: 'old', relation: 'OWNER' }], ['old'])));
 expect(props().relations.relation('old').kind).toBe('UNKNOWN'); expect([...props().relations.owned]).toEqual([]);
});

test('late account-A ownership cannot relabel the same task after account ABA or refresh through an old callback', async () => {
 let oldAnswer!: (value: ReturnType<typeof taskRelationIndex>) => void;
 mockPublic.mockResolvedValue([{ id: 'same' }]);
 mockRelations.mockImplementation((ids: readonly string[]) => ids.length && mockSession.accountRevision === 1
   ? new Promise(done => { oldAnswer = done; }) : Promise.resolve(taskRelationIndex([], ids)));
 await render(); const old = props();
 mockSession = { user: { id: 'account-b' }, accountRevision: 2 }; await update();
 mockSession = { user: { id: 'account-a' }, accountRevision: 3 }; await update();
 const reads = mockRelations.mock.calls.length;
 await act(async () => { oldAnswer(taskRelationIndex([{ needId: 'same', relation: 'OWNER' }], ['same'])); old.onRefresh(); });
 expect(mockRelations).toHaveBeenCalledTimes(reads);
 expect(props().relations.relation('same').kind).toBe('NONE');
 await act(async () => props().onOpen({ id: 'same' }));
 expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/prilike/[id]', params: { id: 'same' } });
});

test.each(['blur', 'background'])('a late ownership read is retired after %s and the next foreground read owns the labels', async leaving => {
 let oldAnswer!: (value: ReturnType<typeof taskRelationIndex>) => void;
 mockPublic.mockResolvedValue([{ id: 'same' }]);
 mockRelations.mockImplementation((ids: readonly string[]) => ids.length
   ? new Promise(done => { oldAnswer = done; }) : Promise.resolve(taskRelationIndex([], ids)));
 await render(); const old = props();
 if (leaving === 'blur') { mockFocused = false; await update(); }
 else { mockApp.currentState = 'background'; await act(async () => mockListeners.forEach(listener => listener('background'))); }
 const reads = mockRelations.mock.calls.length;
 await act(async () => { oldAnswer(taskRelationIndex([{ needId: 'same', relation: 'OWNER' }], ['same'])); old.onRefresh(); });
 expect(mockRelations).toHaveBeenCalledTimes(reads); expect(props().relations).toBeUndefined();
 mockRelations.mockImplementation(async (ids: readonly string[]) => taskRelationIndex([], ids));
 if (leaving === 'blur') { mockFocused = true; await update(); }
 else { mockApp.currentState = 'active'; await act(async () => mockListeners.forEach(listener => listener('active'))); }
 expect(props().relations.relation('same').kind).toBe('NONE');
});

test('timed-out ownership cannot replace a successful explicit retry when its late answer arrives', async () => {
 let oldAnswer!: (value: ReturnType<typeof taskRelationIndex>) => void;
 mockPublic.mockResolvedValue([{ id: 'same' }]);
 mockRelations.mockImplementation((ids: readonly string[]) => ids.length
   ? new Promise(done => { oldAnswer = done; }) : Promise.resolve(taskRelationIndex([], ids)));
 await render(); await act(async () => jest.advanceTimersByTime(15_000));
 expect(props().relationsError).toBe(true); expect(props().items).toEqual([{ id: 'same' }]);
 mockRelations.mockImplementation(async (ids: readonly string[]) => taskRelationIndex([], ids));
 await act(async () => props().onRefresh());
 await act(async () => oldAnswer(taskRelationIndex([{ needId: 'same', relation: 'OWNER' }], ['same'])));
 expect(props().relations.relation('same').kind).toBe('NONE'); expect(props().relationsError).toBe(false);
});
