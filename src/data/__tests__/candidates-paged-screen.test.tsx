import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockNeed = jest.fn(), mockWhole = jest.fn(), mockViewed = jest.fn(), mockSelect = jest.fn();
type Read = { request: any; resolve: (page: any) => void; reject: (error: Error) => void };
let reads: Read[] = [];
const mockSource = { potreba: mockNeed, prijaveZaPotrebu: mockWhole, oznaciPrijavuVidjenom: mockViewed, izaberiPrijavu: mockSelect, javniProfil: jest.fn(),
  prijaveZaPotrebuStrana: (_id: string, request: any) => new Promise<any>((resolve, reject) => { reads.push({ request, resolve, reject }); }) };
const mockRouter = { navigate: jest.fn(), push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
let mockFocused = true, mockState = 'active';
let mockAccount = { user: { id: 'owner-a' }, accountRevision: 1 };
const mockListeners = new Set<(state: string) => void>();
const NEED_ID = '10000000-0000-4000-8000-000000000001';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'AppState') return { currentState: mockState, addEventListener: (_: string, listener: any) => { mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) }; } };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ id: NEED_ID }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockAccount, sesijaSada: () => mockAccount }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
jest.mock('../candidatesPagedGate', () => ({ candidatesPagedBuilt: () => true }));
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'Photo' }));
jest.mock('../../ui/safety/useSafetyEntry', () => ({ useSafetyEntry: () => ({}) }));
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar' }));
jest.mock('../../ui/v2/ApplicationSelectionPresentation', () => ({ CandidateListPresentation: 'List', CandidateSelectionPresentation: 'Selection', SelectionUnavailable: 'Unavailable' }));
import Screen from '../../app/(app)/potrebe/[id]/kandidati';

/**
 * EX-04 S4 (A11): the route of the applications to a task in a paged build. The editor keeps owning the read of the task, the revision check, the offer sheet and the one choice; the pager owns
 * the rows, the server's total and the next page. The order by price and the comparison read the rest of the set, an offer opens only from a row that is on screen, applications of two revisions
 * are never shown together, and nothing of another account or another focus is ever shown.
 */
const REVISION = 3;
const candidate = (id: string, patch: Record<string, unknown> = {}) => ({ prijavaId: id, radnikProfilId: `profile-${id}`, potrebaRevizija: REVISION, verzija: 2, hash: 'a'.repeat(64),
  ime: `Osoba ${id}`, inicijali: 'O', ocenaTekst: '—', recenzijeTekst: '0 završenih', cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' }, pokrivaMesta: 2, preostaloMesta: 3,
  dolazakTekst: '', prevozTekst: '', napomena: '', stanje: 'SELECTABLE', mozeIzabrati: true, ...patch });
const need = (revizija = REVISION) => ({ id: NEED_ID, revizija, naslov: 'Unos ormara', podrucjeTekst: 'Liman', vremeTekst: '20. sep · 10:00', stanje: 'CEKA_PRIJAVE',
  pokrivenost: { ukupno: 3, preostalo: 3, popunjeno: 0 }, rezimCene: 'OFFERS', taskTimezone: 'Europe/Belgrade' });
const page = (ids: string[], hasMore: boolean, total: number | null = null, patch: Record<string, unknown> = {}) => ({
  items: ids.map(id => candidate(id, patch)), hasMore, counts: total === null ? null : { total }, asOf: '2026-10-01T08:00:00.000000+00:00',
  cursor: ids.length ? { at: `2026-09-2${ids.length}T10:00:00+00:00`, id: ids[ids.length - 1] } : null });
let tree: ReactTestRenderer;
const list = () => tree.root.findAllByType('List' as React.ElementType)[0];
const props = () => list().props;
const unavailable = () => tree.root.findAllByType('Unavailable' as React.ElementType)[0];
const selection = () => tree.root.findAllByType('Selection' as React.ElementType)[0];
const ids = () => props().candidates.map((row: any) => row.prijavaId);
const render = async () => act(async () => { tree = create(<Screen />); });
const answer = async (index: number, value: any) => act(async () => { reads[index].resolve(value); });
const fail = async (index: number) => act(async () => { reads[index].reject(new Error('CANDIDATE_PAGE_UNAVAILABLE')); });
const background = async (state: string) => act(async () => { mockState = state; mockListeners.forEach(listener => listener(state)); });
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); jest.clearAllMocks(); reads = []; mockFocused = true; mockState = 'active';
  mockAccount = { user: { id: 'owner-a' }, accountRevision: 1 }; mockListeners.clear();
  mockNeed.mockImplementation(async () => need()); mockViewed.mockResolvedValue({ ok: true, podatak: null }); });
// A read that was never answered would keep its 15 s bound timer alive: answer what is left, then unmount.
afterEach(async () => { await act(async () => { reads.forEach(read => read.resolve(page([], false, 0))); }); if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('focus reads the task and the first page once, never the whole list, and hands the list the applications, the server\'s total and the paging', async () => {
  await render();
  expect(mockNeed).toHaveBeenCalledTimes(1); expect(reads).toHaveLength(1); expect(reads[0].request).toEqual({ limit: 50, cursor: null }); expect(mockWhole).not.toHaveBeenCalled();
  expect(unavailable().props).toMatchObject({ loading: true }); expect(list()).toBeUndefined();
  await answer(0, page(['a', 'b'], true, 120));
  expect(unavailable()).toBeUndefined(); expect(ids()).toEqual(['a', 'b']);
  expect(props().paging).toMatchObject({ total: 120, hasMore: true, loadingMore: false, moreError: false });
  expect(reads).toHaveLength(1);
});

test('the next page is read from the last application of the page before and appended; a failed one keeps the list and the same call retries it', async () => {
  await render(); await answer(0, page(['a', 'b'], true, 120));
  await act(async () => props().paging.onLoadMore());
  expect(reads[1].request).toEqual({ limit: 50, cursor: { at: '2026-09-22T10:00:00+00:00', id: 'b' } }); expect(props().paging.loadingMore).toBe(true);
  await fail(1);
  expect(props().paging).toMatchObject({ moreError: true, loadingMore: false }); expect(ids()).toEqual(['a', 'b']); expect(unavailable()).toBeUndefined();
  await act(async () => props().paging.onLoadMore()); expect(reads).toHaveLength(3);
  await answer(2, page(['c'], false)); expect(ids()).toEqual(['a', 'b', 'c']); expect(props().paging).toMatchObject({ hasMore: false, moreError: false, total: 120 });
});

test('a first page that fails is an unavailable screen with a retry that reads the task and the page again', async () => {
  await render(); await fail(0);
  expect(unavailable().props).toMatchObject({ loading: false }); expect(unavailable().props.message).toMatch(/nije moguće učitati/); expect(list()).toBeUndefined();
  await act(async () => unavailable().props.retry());
  expect(reads).toHaveLength(2); expect(mockNeed).toHaveBeenCalledTimes(2); expect(reads[1].request).toEqual({ limit: 50, cursor: null });
  await answer(1, page(['a'], false, 1)); expect(ids()).toEqual(['a']);
});

test('applications of another revision than the task\'s are refused as the whole list refuses them, and the retry reads again', async () => {
  await render(); await answer(0, page(['a'], false, 1, { potrebaRevizija: REVISION - 1 }));
  expect(unavailable().props).toMatchObject({ loading: false, message: 'Zadatak se upravo promenio. Učitaj prijave ponovo.' }); expect(list()).toBeUndefined();
  await act(async () => unavailable().props.retry());
  await answer(1, page(['a'], false, 1)); expect(ids()).toEqual(['a']);
});

test('a later page read after the task changed is never shown beside the first: the screen says the task changed and a retry starts again from the top', async () => {
  await render(); await answer(0, page(['a', 'b'], true, 120));
  await act(async () => props().paging.onLoadMore());
  mockNeed.mockImplementation(async () => need(REVISION + 1));
  await answer(1, page(['c'], false, null, { potrebaRevizija: REVISION + 1 }));
  expect(unavailable().props).toMatchObject({ loading: false, message: 'Zadatak se upravo promenio. Učitaj prijave ponovo.' }); expect(list()).toBeUndefined();
  await act(async () => unavailable().props.retry());
  expect(reads[2].request).toEqual({ limit: 50, cursor: null });   // from the top: a pull to refresh, not the page after the one that changed
  await answer(2, page(['a', 'b', 'c'], false, 3, { potrebaRevizija: REVISION + 1 }));
  expect(ids()).toEqual(['a', 'b', 'c']); expect(unavailable()).toBeUndefined();
});

test('the order by price reads the rest of the set, a page at a time, and not one page more once it is complete; the arrival order asks for nothing', async () => {
  await render(); await answer(0, page(['a', 'b'], true, 5));
  expect(reads).toHaveLength(1);   // only looking asks for nothing
  await act(async () => props().onSort('PRICE'));
  expect(props().sort).toBe('PRICE'); expect(reads).toHaveLength(2); expect(reads[1].request.cursor).toMatchObject({ id: 'b' });
  await answer(1, page(['c', 'd'], true)); expect(reads).toHaveLength(3);
  await answer(2, page(['e'], false)); expect(ids()).toEqual(['a', 'b', 'c', 'd', 'e']); expect(reads).toHaveLength(3); expect(props().paging.hasMore).toBe(false);
});

test('leaving the order by price before the page lands: that page lands, and no further one is asked for', async () => {
  await render(); await answer(0, page(['a'], true, 4));
  await act(async () => props().onSort('PRICE')); expect(reads).toHaveLength(2);
  await act(async () => props().onSort('ARRIVAL'));
  await answer(1, page(['b'], true)); expect(reads).toHaveLength(2); expect(ids()).toEqual(['a', 'b']); expect(props().paging.hasMore).toBe(true);
});

test('the comparison reads the rest of the set too, and closing it stops the reading', async () => {
  await render(); await answer(0, page(['a'], true, 3));
  await act(async () => props().onComparison(true));
  expect(props().comparison).toBe(true); expect(reads).toHaveLength(2);
  await act(async () => props().onComparison(false));
  await answer(1, page(['b'], true)); expect(reads).toHaveLength(2); expect(ids()).toEqual(['a', 'b']);
});

test('an offer opens only from a row that is on screen - one of a later page included - and marks it seen once', async () => {
  await render(); await answer(0, page(['a'], true, 3));
  await act(async () => props().paging.onLoadMore()); await answer(1, page(['b'], false));
  const later = props().candidates[1];
  await act(async () => props().open({ ...later, prijavaId: 'ghost' }));
  expect(selection()).toBeUndefined(); expect(mockViewed).not.toHaveBeenCalled();
  await act(async () => props().open(later));
  expect(selection().props.candidate).toBe(later); expect(mockViewed).toHaveBeenCalledWith('b'); expect(list()).toBeDefined();
});

test('a choice made on a row of a later page carries that row\'s exact binding, shows its outcome and reads nothing again', async () => {
  mockSelect.mockResolvedValue({ ok: true, podatak: { dogovorId: 'agreement-1' } });
  await render(); await answer(0, page(['a'], true, 3));
  await act(async () => props().paging.onLoadMore()); await answer(1, page(['b'], false));
  await act(async () => props().open(props().candidates[1]));
  await act(async () => { await selection().props.choose(); });
  expect(mockSelect).toHaveBeenCalledTimes(1);
  expect(mockSelect.mock.calls[0][0]).toMatchObject({ potrebaId: NEED_ID, potrebaRevizija: REVISION, prijavaId: 'b', prijavaVerzija: 2, prijavaHash: 'a'.repeat(64), mesta: 2 });
  expect(selection().props).toMatchObject({ confirmed: true, pending: true });
  expect(reads).toHaveLength(2); expect(mockNeed).toHaveBeenCalledTimes(1);
});

test('"Osveži prijave" reads the task and the first page again from the top; the pages loaded after it are asked for again', async () => {
  await render(); await answer(0, page(['a', 'b'], true, 120));
  await act(async () => props().paging.onLoadMore()); await answer(1, page(['c'], true));
  expect(ids()).toEqual(['a', 'b', 'c']);
  await act(async () => props().refresh());
  expect(mockNeed).toHaveBeenCalledTimes(2); expect(reads[2].request).toEqual({ limit: 50, cursor: null });
  await answer(2, page(['a', 'b', 'z'], true, 121));
  expect(ids()).toEqual(['a', 'b', 'z']); expect(props().paging).toMatchObject({ total: 121, hasMore: true });
});

test('the app leaving the foreground forgets the rows (the recents photograph), and coming back reads the task and the first page again', async () => {
  await render(); await answer(0, page(['a', 'b'], true, 3));
  await background('background');
  expect(list()).toBeUndefined(); expect(unavailable().props).toMatchObject({ loading: true });
  await background('active');
  expect(reads).toHaveLength(2); expect(reads[1].request).toEqual({ limit: 50, cursor: null });
  expect(list()).toBeUndefined();   // nothing is shown while it is read again
  await answer(1, page(['a', 'b', 'c'], false, 3)); expect(ids()).toEqual(['a', 'b', 'c']);
});

test('another account never sees the rows of the one before it: it has a pager of its own and reads from the top', async () => {
  await render(); await answer(0, page(['a', 'b'], true, 3));
  mockAccount = { user: { id: 'owner-b' }, accountRevision: 2 };
  await act(async () => tree.update(<Screen />));
  expect(list()).toBeUndefined();
  expect(reads).toHaveLength(2); expect(reads[1].request).toEqual({ limit: 50, cursor: null });
  await answer(0, page(['stale'], false, 1));   // the old account's page lands late: discarded
  expect(list()).toBeUndefined();
  await answer(1, page(['x'], false, 1)); expect(ids()).toEqual(['x']);
});
