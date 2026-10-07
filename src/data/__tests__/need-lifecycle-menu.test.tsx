import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PotrebaProjekcija } from '../../contracts/projections';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', N = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let mockSession = { user: { id: A }, accountRevision: 1 }, mockFocused = true;
let mockForeground = 'active';
const mockListeners = new Set<(state: string) => void>();
const mockStorage = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
const mockService = { cancelNeed: jest.fn(), deleteDraftNeed: jest.fn(), readCommandReceipt: jest.fn() };
const mockSource = { mojePotrebe: jest.fn() }, mockReplace = jest.fn(), mockPush = jest.fn(), mockActive = jest.fn(), mockRefresh = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: (...args: unknown[]) => mockStorage.getItem(...args), setItem: (...args: unknown[]) => mockStorage.setItem(...args),
  removeItem: (...args: unknown[]) => mockStorage.removeItem(...args),
} }));
jest.mock('../needLifecycleClientService', () => ({ ...jest.requireActual('../needLifecycleClientService'), needLifecycleClientService: {
  cancelNeed: (...args: unknown[]) => mockService.cancelNeed(...args), deleteDraftNeed: (...args: unknown[]) => mockService.deleteDraftNeed(...args),
  readCommandReceipt: (...args: unknown[]) => mockService.readCommandReceipt(...args),
} }));
jest.mock('../supabaseClient', () => ({ supabase: {} }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource }));
jest.mock('expo-router', () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args), push: (...args: unknown[]) => mockPush(...args) },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'View') return 'View';
  if (key === 'AppState') return { get currentState() { return mockForeground; }, addEventListener: (_name: string, listener: (state: string) => void) => {
    mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) };
  } };
  return Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { LIFECYCLE_CHECK_NOTICE_MS, NeedLifecycleActions, needLifecycleEntries, type NeedLifecycleMenu } from '../../ui/needs/NeedLifecycleActions';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';

/**
 * NeedLifecycleActions in the "···" placement (owner step 5b, 2026-09-24). The entries left the screen for the bar's menu;
 * the review is asked in a ConfirmSheet with the same words and the same submit; everything the person must see about a
 * command they sent stays on the screen. Since the review of step 5b this is the only placement; the retired inline one's
 * guards were moved onto it in v5-need-lifecycle-screen.
 */
let tree: ReactTestRenderer, need: PotrebaProjekcija, disabled = false;
const menu: { current: NeedLifecycleMenu | null } = { current: null };
const command = { needId: N, expectedRevision: 3, action: 'CANCEL', reason: '' };
const cancelled = { ok: true, podatak: { needId: N, revision: 3, status: 'CANCELLED', affectedResponses: 2, idempotentReplay: false } };
const page = () => <NeedLifecycleActions need={need} disabled={disabled} onActiveChange={mockActive} onRefresh={mockRefresh} menu={menu} />;
const render = async () => { await act(async () => { tree = create(page()); }); };
const refresh = async () => { await act(async () => tree.update(page())); };
const texts = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const actions = () => tree.root.findAll(node => node.type === ('Action' as React.ElementType)).map(node => node.props.label);
const sheets = () => tree.root.findAllByType(ConfirmSheet);
const pressIn = (testID: string) => act(async () => { sheets()[0].findByProps({ testID }).props.onPress(); });
const request = (action: 'CANCEL' | 'DELETE_DRAFT') => act(async () => { menu.current!.request(action); });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  jest.clearAllMocks(); for (const group of [mockStorage, mockService, mockSource]) for (const fn of Object.values(group)) fn.mockReset();
  mockSession = { user: { id: A }, accountRevision: 1 }; mockFocused = true; mockForeground = 'active'; disabled = false; menu.current = null;
  need = { id: N, revizija: 3, stanje: 'OBJAVLJENA', naslov: 'Pregledani zadatak', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2 } } as PotrebaProjekcija;
  mockStorage.getItem.mockResolvedValue(null); mockStorage.setItem.mockResolvedValue(undefined); mockStorage.removeItem.mockResolvedValue(undefined);
  mockService.cancelNeed.mockResolvedValue(cancelled);
  mockService.deleteDraftNeed.mockResolvedValue({ ok: true, podatak: { needId: N, revision: 3, deleted: true, idempotentReplay: false } });
  mockService.readCommandReceipt.mockResolvedValue({ ok: true, podatak: { state: 'NOT_CONFIRMED' } }); mockSource.mojePotrebe.mockResolvedValue([]);
});
afterEach(async () => { await act(async () => tree?.unmount()); mockListeners.clear(); jest.useRealTimers(); });

it('draws nothing of its own at rest: its entries live in the screen\'s "···"', async () => {
  await render();
  expect(texts()).toBe(''); expect(actions()).toEqual([]); expect(tree.root.findAll(node => node.type === ('View' as React.ElementType))).toHaveLength(0);
  expect(menu.current).not.toBeNull();
});

it('asks in a ConfirmSheet with its own words, persists before sending, sends once, and shows the outcome on the screen', async () => {
  await render(); await request('CANCEL');
  expect(sheets()).toHaveLength(1);
  // One sentence of consequence (what happens, and where it is found afterwards), and the reasons the server keeps with a cancellation as chips,
  // which is why this question is a bottom sheet (it carries content) and none of them is required.
  expect(sheets()[0].props).toMatchObject({ title: 'Otkaži zadatak?', confirmLabel: 'Otkaži zadatak', tone: 'danger',
    message: 'Zadatak više ne prima prijave, a poslate prijave se zatvaraju. Ostaje u istoriji.' });
  expect(sheets()[0].props.extra).toBeDefined();
  expect(sheets()[0].findAllByProps({ accessibilityRole: 'radio' }).map(node => node.props.accessibilityLabel))
    .toEqual(['Više mi ne treba', 'Rešeno je drugačije', 'Promenio se termin', 'Drugo']);
  expect(mockService.cancelNeed).not.toHaveBeenCalled(); expect(mockActive).toHaveBeenLastCalledWith(true);
  const stored = deferred<void>(); mockStorage.setItem.mockReturnValueOnce(stored.promise);
  await pressIn('confirm-sheet-confirm');
  expect(JSON.parse(mockStorage.setItem.mock.calls[0][1])).toEqual(command); expect(mockService.cancelNeed).not.toHaveBeenCalled();
  // The confirm is busy while the command runs; the sheet reports nothing itself.
  expect(sheets()[0].findByProps({ testID: 'confirm-sheet-confirm' }).props.accessibilityState).toEqual({ disabled: true, busy: true });
  await act(async () => stored.resolve());
  expect(mockService.cancelNeed.mock.calls).toEqual([[N, 3, '']]);
  expect(sheets()).toHaveLength(0);
  // The outcome in plain words since the review of step 5b (no "server" wording): what happened, not who said so.
  expect(texts()).toContain('Zadatak je otkazan.'); expect(texts()).not.toMatch(/server/i); expect(actions()).toContain('Moji zadaci');
  await act(async () => { tree.root.findByProps({ label: 'Moji zadaci' }).props.onPress(); });
  expect(mockReplace).toHaveBeenCalledWith('/potrebe');
});

it('a draft is deleted with its own words; an action the Task does not allow opens nothing', async () => {
  await render(); await request('DELETE_DRAFT'); expect(sheets()).toHaveLength(0);
  need = { ...need, stanje: 'NACRT' }; await refresh();
  // A draft is deleted, never cancelled: it was never published, so there is nobody to cancel it for.
  await request('CANCEL'); expect(sheets()).toHaveLength(0); expect(mockActive).toHaveBeenLastCalledWith(false);
  await request('DELETE_DRAFT');
  // A short question stays a centred dialog: its sentence is the consequence, and it asks for no reason, because a deletion takes none.
  expect(sheets()[0].props).toMatchObject({ title: 'Obriši nacrt?', confirmLabel: 'Obriši nacrt', tone: 'danger',
    message: 'Nacrt se briše zauvek i ne može da se vrati. Ako ima fotografije, prvo ih ukloni iz nacrta.' });
  expect(sheets()[0].props.extra).toBeUndefined();
  await pressIn('confirm-sheet-confirm');
  expect(mockService.deleteDraftNeed.mock.calls).toEqual([[N, 3, '']]); expect(mockService.cancelNeed).not.toHaveBeenCalled();
  expect(texts()).toContain('Nacrt je obrisan.'); expect(texts()).not.toMatch(/server/i);
});

it('a cancellation takes the reason the person chose, keeps it in the retained command, and sends exactly that; a chosen chip is chosen again to take it back', async () => {
  await render(); await request('CANCEL');
  const chip = (label: string) => sheets()[0].findByProps({ accessibilityLabel: label });
  await act(async () => { chip('Promenio se termin').props.onPress(); });
  expect(chip('Promenio se termin').props.accessibilityState).toEqual({ checked: true });
  await act(async () => { chip('Promenio se termin').props.onPress(); });
  expect(chip('Promenio se termin').props.accessibilityState).toEqual({ checked: false });
  await act(async () => { chip('Rešeno je drugačije').props.onPress(); });
  await pressIn('confirm-sheet-confirm');
  expect(JSON.parse(mockStorage.setItem.mock.calls[0][1])).toEqual({ ...command, reason: 'Rešeno je drugačije' });
  expect(mockService.cancelNeed.mock.calls).toEqual([[N, 3, 'Rešeno je drugačije']]);
});

it('a reason chosen in a question that was cancelled does not travel into the next one: it starts with none', async () => {
  await render(); await request('CANCEL');
  await act(async () => { sheets()[0].findByProps({ accessibilityLabel: 'Više mi ne treba' }).props.onPress(); });
  await pressIn('confirm-sheet-cancel'); expect(sheets()).toHaveLength(0);
  await request('CANCEL');
  expect(sheets()[0].findByProps({ accessibilityLabel: 'Više mi ne treba' }).props.accessibilityState).toEqual({ checked: false });
  await pressIn('confirm-sheet-confirm');
  expect(JSON.parse(mockStorage.setItem.mock.calls[0][1])).toEqual(command);
  expect(mockService.cancelNeed.mock.calls).toEqual([[N, 3, '']]);
});

it('restores only the command it stored: no reason, or one of the chips of a cancellation', async () => {
  const stored = (patch: object) => JSON.stringify({ ...command, ...patch });
  for (const [patch, restored] of [[{}, true], [{ reason: 'Promenio se termin' }, true], [{ reason: 'Drugo' }, true], [{ reason: 'nešto sasvim treće' }, false],
    [{ action: 'DELETE_DRAFT', reason: 'Promenio se termin' }, false]] as const) {
    mockStorage.getItem.mockReset(); mockStorage.getItem.mockResolvedValue(stored(patch)); mockService.readCommandReceipt.mockReset();
    mockService.readCommandReceipt.mockResolvedValue({ ok: true, podatak: { state: 'NOT_CONFIRMED' } });
    await render();
    expect([patch, mockService.readCommandReceipt.mock.calls.length > 0]).toEqual([patch, restored]);
    await act(async () => tree.unmount());
  }
});

it('cancelling the question sends nothing, frees the screen, and the question can be asked again', async () => {
  await render(); await request('CANCEL'); await pressIn('confirm-sheet-cancel');
  expect(sheets()).toHaveLength(0); expect(mockStorage.setItem).not.toHaveBeenCalled(); expect(mockService.cancelNeed).not.toHaveBeenCalled();
  expect(mockActive).toHaveBeenLastCalledWith(false); expect(texts()).toBe('');
  await request('CANCEL'); expect(sheets()).toHaveLength(1);
});

it('keeps an uncertain outcome and its recovery on the screen, never inside a sheet', async () => {
  mockService.cancelNeed.mockResolvedValue({ ok: false, kod: 'UNKNOWN_OUTCOME', poruka: 'Ishod nije potvrđen.' });
  await render(); await request('CANCEL'); await pressIn('confirm-sheet-confirm');
  expect(sheets()).toHaveLength(0);
  expect(actions()).toEqual(expect.arrayContaining(['Proveri ishod', 'Pošalji ponovo']));
  expect(tree.root.findByProps({ label: 'Pošalji ponovo' }).props.disabled).toBe(true);
  await act(async () => { tree.root.findByProps({ label: 'Proveri ishod' }).props.onPress(); });
  expect(mockService.readCommandReceipt).toHaveBeenCalledWith(command); expect(mockService.cancelNeed).toHaveBeenCalledTimes(1);
});

it('keeps a storage failure on the screen after the question has closed, and never sends an untracked command', async () => {
  mockStorage.setItem.mockRejectedValue(new Error('DISK_FULL'));
  await render(); await request('CANCEL'); await pressIn('confirm-sheet-confirm');
  expect(sheets()).toHaveLength(0); expect(mockService.cancelNeed).not.toHaveBeenCalled();
  expect(texts()).toContain('Zahtev nije poslat jer nije sačuvana njegova potvrda. Pokušaj ponovo.');
  expect(actions()).toContain('Ponovo proveri prethodni zahtev');
});

it('retires an open question on blur and on background; its retained answer then sends nothing', async () => {
  await render(); await request('CANCEL'); const retained = sheets()[0].props.onConfirm;
  mockFocused = false; await refresh(); expect(sheets()).toHaveLength(0);
  await act(async () => { await retained(); }); expect(mockStorage.setItem).not.toHaveBeenCalled(); expect(mockService.cancelNeed).not.toHaveBeenCalled();
  mockFocused = true; await refresh(); await request('CANCEL'); expect(sheets()).toHaveLength(1);
  await act(async () => { mockForeground = 'background'; for (const listener of mockListeners) listener('background'); });
  expect(sheets()).toHaveLength(0); expect(mockService.cancelNeed).not.toHaveBeenCalled();
});

it('a newer version of the task that arrived under the open question is not what was confirmed: nothing is sent', async () => {
  await render(); await request('CANCEL');
  need = { ...need, revizija: 4 }; await refresh();
  await pressIn('confirm-sheet-confirm');
  expect(mockStorage.setItem).not.toHaveBeenCalled(); expect(mockService.cancelNeed).not.toHaveBeenCalled();
  expect(sheets()).toHaveLength(0); expect(mockActive).toHaveBeenLastCalledWith(false);
  // Asked again, about the version on the screen now, it sends that version.
  await request('CANCEL'); await pressIn('confirm-sheet-confirm');
  expect(mockService.cancelNeed.mock.calls).toEqual([[N, 4, '']]);
});

it('follows the route\'s busy flag, and opens nothing while another action runs', async () => {
  disabled = true; await render(); await request('CANCEL'); expect(sheets()).toHaveLength(0);
});

it('says a retained command is being checked only once the check takes long enough to be seen', async () => {
  jest.useFakeTimers();
  const read = deferred<string | null>(); mockStorage.getItem.mockReturnValue(read.promise);
  await render();
  expect(texts()).not.toContain('Proveravamo prethodni zahtev…');
  await act(async () => { jest.advanceTimersByTime(LIFECYCLE_CHECK_NOTICE_MS); });
  expect(texts()).toContain('Proveravamo prethodni zahtev…');
  await act(async () => read.resolve(null));
  expect(texts()).toBe('');
});

it('opens the Dogovori for a task with agreed places, and the handle goes with the component', async () => {
  need = { ...need, stanje: 'DELIMICNO_POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1 } } as PotrebaProjekcija;
  await render(); await request('CANCEL'); expect(sheets()).toHaveLength(0);
  await act(async () => { menu.current!.openAgreements(); }); expect(mockPush).toHaveBeenCalledWith('/dogovori');
  await act(async () => tree.unmount()); expect(menu.current).toBeNull();
  tree = undefined as unknown as ReactTestRenderer;
});

it('offers the "···" the entries the Task allows: agreed places go through the Dogovori, a closed task offers nothing', () => {
  const base = { id: N, revizija: 3, naslov: 'x', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2 } } as PotrebaProjekcija;
  expect(needLifecycleEntries(null)).toEqual({ deleteDraft: false, cancel: false, agreements: false });
  // A draft offers ONLY the deletion: the two side by side asked a person to choose between ending the same unpublished thing two ways.
  expect(needLifecycleEntries({ ...base, stanje: 'NACRT' })).toEqual({ deleteDraft: true, cancel: false, agreements: false });
  expect(needLifecycleEntries({ ...base, stanje: 'OBJAVLJENA' })).toEqual({ deleteDraft: false, cancel: true, agreements: false });
  expect(needLifecycleEntries({ ...base, stanje: 'ZATVORENA' })).toEqual({ deleteDraft: false, cancel: false, agreements: false });
  expect(needLifecycleEntries({ ...base, stanje: 'DELIMICNO_POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1 } } as PotrebaProjekcija))
    .toEqual({ deleteDraft: false, cancel: false, agreements: true });
});
