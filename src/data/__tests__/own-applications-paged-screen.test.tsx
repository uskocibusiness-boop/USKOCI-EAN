import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockWhole = jest.fn(), mockWithdraw = jest.fn(), mockCommandState = jest.fn();
type Read = { request: any; resolve: (page: any) => void; reject: (error: Error) => void };
let reads: Read[] = [];
const mockSource = { mojePrijave: mockWhole, povuciPrijavu: mockWithdraw,
  mojePrijaveStrana: (request: any) => new Promise<any>((resolve, reject) => { reads.push({ request, resolve, reject }); }) };
const mockRouter = { navigate: jest.fn(), push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
let mockFocused = true, mockParams: { prijavaId?: string } = {}, mockState = 'active';
let mockAccount = { user: { id: 'owner-a' }, accountRevision: 1 };
const mockListeners = new Set<(state: string) => void>();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'AppState') return { currentState: mockState, addEventListener: (_: string, listener: any) => { mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) }; } };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, useUloga: () => 'uskocer', ulogaSada: () => 'uskocer' }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockAccount, sesijaSada: () => mockAccount }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
jest.mock('../ru4Production', () => ({ ru4Production: { resolveChangedApplication: jest.fn() } }));
jest.mock('../myApplicationsClientService', () => ({ readExistingApplicationInterval: jest.fn(), readApplicationCommandState: (...args: any[]) => mockCommandState(...args) }));
jest.mock('../ownApplicationsPagedGate', () => ({ ownApplicationsPagedBuilt: () => true }));
jest.mock('../../ui/v2/MyApplicationsPresentation', () => ({ MyApplicationsPresentation: 'Applications' }));
import Screen from '../../app/(app)/moje-prijave';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';

/**
 * EX-04 S2 (B10): the route of "Moje prijave" in a paged build. The editor keeps owning the read, the reconciliation and the commands; the pager owns the rows, the server's counts
 * and the next page. The tab follows the set, a destination named by a notification reads the rest of the set until it is met, a command refreshes the shown set and drops the others, and
 * nothing of another set, another account or another focus is ever shown.
 */
const COUNTS = { total: 5, attention: 1, active: 3, finished: 1 };
const application = (id: string, patch: Record<string, unknown> = {}) => ({ prijavaId: id, potrebaId: `need-${id}`, potrebaRevizija: 4, prijavaRevizija: 4, prijavaVerzija: 2,
  stanje: 'SUBMITTED', naslov: `Zadatak ${id}`, opis: '', cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' }, pokrivaMesta: 2, napomena: '', podrucjeTekst: 'Liman, Novi Sad',
  vremeTekst: '20. sep · 10:00', dogovorId: null, promenjenaPotreba: false, mozePovuci: true, traziPaznju: false, ...patch });
const page = (ids: string[], hasMore: boolean, counts: typeof COUNTS | null = null, rank = 1, patch: Record<string, unknown> = {}) => ({
  items: ids.map(id => application(id, patch)), hasMore, counts, asOf: '2026-10-01T08:00:00.000000+00:00',
  cursor: ids.length ? { at: `t-${ids[ids.length - 1]}`, id: ids[ids.length - 1], rank } : null });
let tree: ReactTestRenderer;
const props = () => tree.root.findByType('Applications' as React.ElementType).props;
const ids = () => props().rows.map((row: any) => row.prijavaId);
const render = async () => act(async () => { tree = create(<Screen />); });
const answer = async (index: number, value: any) => act(async () => { reads[index].resolve(value); });
const fail = async (index: number) => act(async () => { reads[index].reject(new Error('OWN_APPLICATIONS_PAGE_UNAVAILABLE')); });
const background = async (state: string) => act(async () => { mockState = state; mockListeners.forEach(listener => listener(state)); });
const sheet = () => tree.root.findByType(ConfirmSheet);
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); jest.clearAllMocks(); reads = []; mockFocused = true; mockState = 'active'; mockParams = {};
  mockAccount = { user: { id: 'owner-a' }, accountRevision: 1 }; mockListeners.clear();
  mockCommandState.mockResolvedValue({ ok: false, kod: 'APPLICATION_STATE_UNAVAILABLE', poruka: 'unavailable' });
  mockWithdraw.mockResolvedValue({ ok: true, podatak: { stanje: 'WITHDRAWN', verzija: 2 } }); });
// A read that was never answered would keep its 15 s bound timer alive: answer what is left, then unmount.
afterEach(async () => { await act(async () => { reads.forEach(read => read.resolve(page([], false, null))); }); if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('focus reads the first page of Sve once, never the whole list, and hands the presentation the applications, the server counts and the paging', async () => {
  await render();
  expect(reads).toHaveLength(1); expect(reads[0].request).toEqual({ scope: 'ALL', limit: 30, cursor: null }); expect(mockWhole).not.toHaveBeenCalled();
  expect(props()).toMatchObject({ loading: true, tab: 'all' }); expect(ids()).toEqual([]);   // loading wins over the (not yet known) availability, as in the whole-list screen
  await answer(0, page(['a', 'b'], true, COUNTS));
  expect(props()).toMatchObject({ loading: false, unavailable: false }); expect(ids()).toEqual(['a', 'b']);
  expect(props().paging).toMatchObject({ counts: COUNTS, hasMore: true, loadingMore: false, moreError: false });
  expect(reads).toHaveLength(1);
});

test('the next page is read from the last application with its rank and appended; a failed one keeps the list and the same call retries it', async () => {
  await render(); await answer(0, page(['a'], true, COUNTS, 0));
  await act(async () => props().paging.onLoadMore());
  expect(reads[1].request).toEqual({ scope: 'ALL', limit: 30, cursor: { at: 't-a', id: 'a', rank: 0 } }); expect(props().paging.loadingMore).toBe(true);
  await fail(1);
  expect(props().paging).toMatchObject({ moreError: true, loadingMore: false }); expect(ids()).toEqual(['a']); expect(props().unavailable).toBe(false);
  await act(async () => props().paging.onLoadMore()); await answer(2, page(['b'], false));
  expect(ids()).toEqual(['a', 'b']); expect(props().paging.hasMore).toBe(false);
});

test('a tab is a set of its own: it reads that set, shows nothing of another set while it loads, and keeps what a tab already held', async () => {
  await render(); await answer(0, page(['a', 'b', 'c'], false, COUNTS));
  await act(async () => props().onTab('attention'));
  expect(reads[1].request).toEqual({ scope: 'ATTENTION', limit: 30, cursor: null }); expect(props()).toMatchObject({ tab: 'attention', loading: true }); expect(ids()).toEqual([]);
  await answer(1, page(['a'], false, COUNTS, 0));
  expect(props()).toMatchObject({ loading: false }); expect(ids()).toEqual(['a']);
  await act(async () => props().onTab('all'));
  expect(props()).toMatchObject({ tab: 'all', loading: false }); expect(ids()).toEqual(['a', 'b', 'c']);   // what the tab held, at once
  expect(reads[2].request.scope).toBe('ALL');   // and a quiet re-read
  await act(async () => props().onTab('finished')); await act(async () => props().onTab('active'));
  expect(reads.map(read => read.request.scope)).toEqual(['ALL', 'ATTENTION', 'ALL', 'HISTORY', 'ACTIVE']);
});

test('a pull to refresh reads the first page again from the top while what is on screen stays', async () => {
  await render(); await answer(0, page(['a'], true, COUNTS));
  await act(async () => props().onRefresh());
  expect(reads[1].request).toEqual({ scope: 'ALL', limit: 30, cursor: null }); expect(props()).toMatchObject({ loading: false }); expect(ids()).toEqual(['a']);
  await answer(1, page(['a', 'z'], false, COUNTS)); expect(ids()).toEqual(['a', 'z']);
});

test('a first page that fails is an unavailable screen with a retry that reads again', async () => {
  await render(); await fail(0);
  expect(props()).toMatchObject({ unavailable: true }); expect(ids()).toEqual([]);
  await act(async () => props().onRefresh());
  expect(reads).toHaveLength(2); expect(reads[1].request).toEqual({ scope: 'ALL', limit: 30, cursor: null });
  await answer(1, page(['a'], false, COUNTS)); expect(props()).toMatchObject({ unavailable: false, loading: false }); expect(ids()).toEqual(['a']);
});

test('an application named by a notification: the rest of the set is read until it is met, it is focused once, and until then it is never called missing', async () => {
  mockParams = { prijavaId: 'target' };
  await render(); await answer(0, page(['a', 'b'], true, COUNTS));
  expect(props().requestedId).toBeNull(); expect(props().focusId).toBeNull();
  expect(reads).toHaveLength(2); expect(reads[1].request.cursor).toEqual({ at: 't-b', id: 'b', rank: 1 });   // read without being asked
  await answer(1, page(['target', 'c'], true));
  expect(props()).toMatchObject({ focusId: 'target', tab: 'all' }); expect(reads).toHaveLength(2);   // met: nothing more is read for it
  expect(props().requestedId).toBeNull();   // the set is still incomplete, so it is not asked to be called missing or found
});

test('a destination that is not in the set once the set is complete is reported as such, and only on the tab that holds every application', async () => {
  mockParams = { prijavaId: 'ghost' };
  await render(); await answer(0, page(['a'], true, COUNTS)); await answer(1, page(['b'], false));
  expect(reads).toHaveLength(2); expect(props().requestedId).toBe('ghost'); expect(props().focusId).toBeNull(); expect(ids()).toEqual(['a', 'b']);
  await act(async () => props().onTab('active'));
  expect(props().requestedId).toBeNull();   // another tab's set is not the place to look
});

test('a notification takes the screen to Sve even when another tab was on', async () => {
  await render(); await answer(0, page(['a'], false, COUNTS));
  await act(async () => props().onTab('finished')); expect(props().tab).toBe('finished'); await answer(1, page([], false, COUNTS, 2));
  mockParams = { prijavaId: 'a' }; await act(async () => tree.update(<Screen />));
  expect(props().tab).toBe('all');
});

test('a command refreshes the shown set and drops the sets that are not shown: another tab is read as new, never shown stale', async () => {
  await render(); await answer(0, page(['a', 'b'], false, COUNTS));
  await act(async () => props().onTab('active')); await answer(1, page(['a', 'b'], false, COUNTS));
  await act(async () => props().onTab('all')); await answer(2, page(['a', 'b'], false, COUNTS));
  const target = props().rows[0];
  await act(async () => props().onWithdraw(target));
  const open = sheet(); expect(open.props).toMatchObject({ title: 'Povući prijavu?', confirmLabel: 'Povuci prijavu' });
  await act(async () => open.findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress());
  expect(mockWithdraw).toHaveBeenCalledTimes(1);
  expect(reads[3].request).toEqual({ scope: 'ALL', limit: 30, cursor: null });   // the read that follows the confirmed command
  await answer(3, { ...page(['a', 'b'], false, COUNTS), items: [application('a', { stanje: 'WITHDRAWN', mozePovuci: false }), application('b')] });
  expect(props().rows[0]).toMatchObject({ prijavaId: 'a', stanje: 'WITHDRAWN' });
  await act(async () => props().onTab('active'));
  expect(props()).toMatchObject({ tab: 'active', loading: true }); expect(ids()).toEqual([]);   // not the stale set
  expect(reads[4].request.scope).toBe('ACTIVE');
});

test('another account is another screen: what the first account was reading is never shown to the second, and a late answer changes nothing', async () => {
  await render();
  mockAccount = { user: { id: 'owner-b' }, accountRevision: 1 };
  await act(async () => tree.update(<Screen />));
  expect(reads).toHaveLength(2); expect(props()).toMatchObject({ loading: true }); expect(ids()).toEqual([]);
  await answer(0, page(['secret-of-a'], false, COUNTS)); expect(ids()).toEqual([]);
  await answer(1, page(['b1'], false, COUNTS)); expect(ids()).toEqual(['b1']);
});

test('the app leaving the foreground forgets what was read; coming back reads it again from nothing', async () => {
  await render(); await answer(0, page(['a'], false, COUNTS));
  await background('background');
  expect(ids()).toEqual([]); expect(props().paging.counts).toBeNull();
  await background('active');
  expect(reads).toHaveLength(2); expect(props().loading).toBe(true);
  await answer(1, page(['a'], false, COUNTS)); expect(ids()).toEqual(['a']);
});
