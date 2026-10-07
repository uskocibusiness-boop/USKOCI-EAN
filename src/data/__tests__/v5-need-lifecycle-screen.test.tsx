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
import { NeedLifecycleActions, type NeedLifecycleMenu } from '../../ui/needs/NeedLifecycleActions';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';

/**
 * The lifecycle's guards through the one placement the app uses (review of step 5b, 2026-09-24). This suite used to press
 * the inline entries ("Obriši nacrt", "Otkazivanje zadatka", "Odustani") that NeedLifecycleActions drew on the screen. No
 * screen drew them any more, so that placement was retired and every guard here is now reached as the owner reaches it:
 * the screen's "···" calls `request`, the question is a ConfirmSheet, and a retained final tap is the sheet's own
 * `onConfirm` / `onCancel`, held and called after the state has moved on. The file keeps its name because the PKG-004
 * proof workflow runs it by path; only assertions about the retired inline look were dropped.
 */
let tree: ReactTestRenderer, need: PotrebaProjekcija, disabled = false;
const menu: { current: NeedLifecycleMenu | null } = { current: null };
const command = { needId: N, expectedRevision: 3, action: 'DELETE_DRAFT', reason: '' };
const receipt = { needId: N, revision: 3, deleted: true, idempotentReplay: false };
const success = { ok: true, podatak: receipt }, unknown = { ok: false, kod: 'UNKNOWN_OUTCOME', poruka: 'Ishod nije potvrđen.' };
const page = () => <NeedLifecycleActions need={need} disabled={disabled} onActiveChange={mockActive} onRefresh={mockRefresh} menu={menu} />;
const render = async () => { await act(async () => { tree = create(page()); }); };
const action = (label: string) => tree.root.findByProps({ label }).props;
const tap = async (label: string) => { await act(async () => action(label).onPress()); };
const refresh = async () => { await act(async () => tree.update(page())); };
const texts = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const sheets = () => tree.root.findAllByType(ConfirmSheet);
/** What the screen's "···" does for a row: ask the lifecycle, which asks the person. */
const ask = (kind: 'CANCEL' | 'DELETE_DRAFT') => act(async () => { menu.current!.request(kind); });
const inSheet = (testID: 'confirm-sheet-confirm' | 'confirm-sheet-cancel') => act(async () => { sheets()[0].findByProps({ testID }).props.onPress(); });
/** The answers of the open question, as its sheet holds them: a final tap that is still around after the state moved on. */
const retainedConfirm = () => sheets()[0].props.onConfirm as () => void | Promise<unknown>;
const retainedCancel = () => sheets()[0].props.onCancel as () => void;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  jest.clearAllMocks(); for (const group of [mockStorage, mockService, mockSource]) for (const fn of Object.values(group)) fn.mockReset();
  mockSession = { user: { id: A }, accountRevision: 1 }; mockFocused = true; mockForeground = 'active'; disabled = false; menu.current = null;
  need = { id: N, revizija: 3, stanje: 'NACRT', naslov: 'Pregledani zadatak', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2 } } as PotrebaProjekcija;
  mockStorage.getItem.mockResolvedValue(null); mockStorage.setItem.mockResolvedValue(undefined); mockStorage.removeItem.mockResolvedValue(undefined);
  mockService.deleteDraftNeed.mockResolvedValue(success); mockService.cancelNeed.mockResolvedValue({ ok: true, podatak: { needId: N, revision: 3, status: 'CANCELLED', affectedResponses: 2, idempotentReplay: false } });
  mockService.readCommandReceipt.mockResolvedValue({ ok: true, podatak: { state: 'NOT_CONFIRMED' } }); mockSource.mojePotrebe.mockResolvedValue([]);
});
afterEach(async () => { await act(async () => tree?.unmount()); mockListeners.clear(); });
it('reviews consequences, persists the frozen identity first and deduplicates retained final taps', async () => {
  await render(); expect(mockService.deleteDraftNeed).not.toHaveBeenCalled(); await ask('DELETE_DRAFT');
  expect(sheets()[0].props).toMatchObject({ title: 'Obriši nacrt?', confirmLabel: 'Obriši nacrt', tone: 'danger',
    message: 'Nacrt se briše zauvek i ne može da se vrati. Ako ima fotografije, prvo ih ukloni iz nacrta.' });
  const wait = deferred<void>(); mockStorage.setItem.mockReturnValue(wait.promise); const send = retainedConfirm();
  await act(async () => { void send(); void send(); }); expect(mockService.deleteDraftNeed).not.toHaveBeenCalled();
  expect(JSON.parse(mockStorage.setItem.mock.calls[0][1])).toEqual(command);
  await act(async () => wait.resolve()); expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
  expect(mockService.deleteDraftNeed).toHaveBeenCalledTimes(1); expect(mockService.deleteDraftNeed).toHaveBeenCalledWith(N, 3, '');
  expect(mockSource.mojePotrebe).toHaveBeenCalledTimes(1); expect(texts()).toContain('Nacrt je obrisan.');
  expect(action('Moji zadaci')).toBeDefined(); expect(mockReplace).not.toHaveBeenCalled();
  await tap('Moji zadaci'); expect(mockStorage.removeItem).toHaveBeenCalledTimes(1); expect(mockReplace).toHaveBeenCalledWith('/potrebe');
});
it('serves the owner of the Task: ownership is the whole condition, and there is no app mode beside it', async () => {
  // The Need it is handed came from the owner-only read and the server checks ownership again; nothing
  // else is consulted (owner decision 1, 2026-09-19: the app has no mode).
  await render();
  await ask('DELETE_DRAFT'); await inSheet('confirm-sheet-confirm');
  expect(mockService.deleteDraftNeed).toHaveBeenCalledWith(N, 3, '');
});
it('never cancels a draft: a draft is deleted, and the cancellation is not even asked', async () => {
  await render(); await ask('CANCEL'); expect(sheets()).toHaveLength(0);
  expect(mockStorage.setItem).not.toHaveBeenCalled(); expect(mockService.cancelNeed).not.toHaveBeenCalled();
});
it('keeps cancellation separate from deleting a published Task', async () => {
  need = { ...need, stanje: 'OBJAVLJENA' }; await render();
  await ask('DELETE_DRAFT'); expect(sheets()).toHaveLength(0);
  await ask('CANCEL'); expect(sheets()[0].props).toMatchObject({ title: 'Otkaži zadatak?', confirmLabel: 'Otkaži zadatak', tone: 'danger' });
  await inSheet('confirm-sheet-confirm');
  expect(mockService.cancelNeed).toHaveBeenCalledWith(N, 3, ''); expect(mockService.deleteDraftNeed).not.toHaveBeenCalled();
  expect(texts()).toContain('Zadatak je otkazan.');
});
it('asks nothing about a closed Task', async () => {
  need = { ...need, stanje: 'ZATVORENA' }; await render();
  await ask('CANCEL'); await ask('DELETE_DRAFT');
  expect(sheets()).toHaveLength(0); expect(texts()).toBe(''); expect(mockStorage.setItem).not.toHaveBeenCalled();
});
it('offers the existing Agreement path when places are already agreed', async () => {
  need = { ...need, pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } }; await render();
  await ask('CANCEL'); await ask('DELETE_DRAFT'); expect(sheets()).toHaveLength(0);
  await act(async () => { menu.current!.openAgreements(); }); expect(mockPush).toHaveBeenCalledWith('/dogovori');
  expect(mockService.cancelNeed).not.toHaveBeenCalled();
  // While another route action is busy the Dogovori wait too.
  mockPush.mockClear(); disabled = true; await refresh();
  await act(async () => { menu.current!.openAgreements(); }); expect(mockPush).not.toHaveBeenCalled();
});
it('does not send after choosing Odustani or while another route action is busy', async () => {
  await render(); await ask('DELETE_DRAFT');
  disabled = true; await refresh(); await inSheet('confirm-sheet-confirm');
  expect(mockStorage.setItem).not.toHaveBeenCalled(); expect(sheets()).toHaveLength(0);
  disabled = false; await refresh(); await ask('DELETE_DRAFT'); await inSheet('confirm-sheet-cancel');
  expect(mockStorage.setItem).not.toHaveBeenCalled(); expect(mockService.deleteDraftNeed).not.toHaveBeenCalled();
});
it('storage failure cannot become an untracked destructive command', async () => {
  mockStorage.setItem.mockRejectedValue(new Error('DISK_FULL')); await render(); await ask('DELETE_DRAFT'); await inSheet('confirm-sheet-confirm');
  expect(mockService.deleteDraftNeed).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
  expect(texts()).toContain('Zahtev nije poslat jer nije sačuvana njegova potvrda. Pokušaj ponovo.');
});
it('retires confirmation after Odustani and does not let an old cancel discard an unknown command', async () => {
  await render(); await ask('DELETE_DRAFT'); const oldSend = retainedConfirm();
  await inSheet('confirm-sheet-cancel'); await act(async () => { await oldSend(); }); expect(mockStorage.setItem).not.toHaveBeenCalled();
  await ask('DELETE_DRAFT'); const oldCancel = retainedCancel();
  mockService.deleteDraftNeed.mockResolvedValue(unknown); await inSheet('confirm-sheet-confirm'); await act(async () => oldCancel());
  expect(action('Proveri ishod')).toBeDefined(); expect(sheets()).toHaveLength(0);
  // The uncertain command owns the screen: nothing new can be asked over it.
  await ask('DELETE_DRAFT'); expect(sheets()).toHaveLength(0);
});
it('unknown command requires successful readback before an explicit identical retry', async () => {
  mockService.deleteDraftNeed.mockResolvedValueOnce(unknown); await render(); await ask('DELETE_DRAFT'); await inSheet('confirm-sheet-confirm');
  expect(action('Pošalji ponovo').disabled).toBe(true); await tap('Pošalji ponovo'); expect(mockService.deleteDraftNeed).toHaveBeenCalledTimes(1);
  await tap('Proveri ishod'); expect(mockService.readCommandReceipt).toHaveBeenCalledWith(command);
  expect(action('Pošalji ponovo').disabled).toBe(false); expect(mockService.deleteDraftNeed).toHaveBeenCalledTimes(1);
  await tap('Pošalji ponovo'); expect(mockService.deleteDraftNeed.mock.calls).toEqual([[N, 3, ''], [N, 3, '']]);
});
it('failed readback never licenses retry and missing list rows do not prove deletion', async () => {
  mockService.deleteDraftNeed.mockResolvedValue(unknown); mockService.readCommandReceipt.mockResolvedValue({ ok: false, kod: 'READ_FAILED', poruka: 'Nedostupno.' });
  await render(); await ask('DELETE_DRAFT'); await inSheet('confirm-sheet-confirm'); await tap('Proveri ishod'); await tap('Pošalji ponovo');
  expect(mockService.deleteDraftNeed).toHaveBeenCalledTimes(1); expect(mockSource.mojePotrebe).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ label: 'Moji zadaci' })).toHaveLength(0);
});
it('restores opaque command after recreation with a read only, even if current Need revision changed', async () => {
  need = { ...need, revizija: 4 }; mockStorage.getItem.mockResolvedValue(JSON.stringify(command));
  mockService.readCommandReceipt.mockResolvedValue({ ok: true, podatak: { state: 'CONFIRMED', confirmation: { action: 'DELETE_DRAFT', receipt: { ...receipt, idempotentReplay: true } } } });
  await render(); expect(mockService.readCommandReceipt).toHaveBeenCalledWith(command);
  expect(mockService.deleteDraftNeed).not.toHaveBeenCalled(); expect(action('Moji zadaci')).toBeDefined(); expect(texts()).toContain('Nacrt je obrisan.');
});
it.each(['corrupt', JSON.stringify({ ...command, needId: A }), JSON.stringify({ ...command, reason: 'private reason' })])(
  'corrupt or cross-Task restore stays fail closed: %s', async raw => {
    mockStorage.getItem.mockResolvedValue(raw); await render(); expect(action('Ponovo proveri prethodni zahtev')).toBeDefined();
    expect(mockService.readCommandReceipt).not.toHaveBeenCalled(); expect(mockService.deleteDraftNeed).not.toHaveBeenCalled();
    // Nothing new can be asked over a command that could not be checked.
    await ask('DELETE_DRAFT'); expect(sheets()).toHaveLength(0);
  });
it('server stale rejection needs a fresh review and cannot force replay', async () => {
  mockService.deleteDraftNeed.mockResolvedValue({ ok: false, kod: 'STALE_REVIEW_REQUIRED', poruka: 'Osveži zadatak.' });
  await render(); await ask('DELETE_DRAFT'); await inSheet('confirm-sheet-confirm');
  expect(tree.root.findAllByProps({ label: 'Pošalji ponovo' })).toHaveLength(0); await tap('Učitaj aktuelni zadatak');
  expect(mockRefresh).toHaveBeenCalledTimes(1); expect(mockService.deleteDraftNeed).toHaveBeenCalledTimes(1);
});
it.each(['blur', 'account', 'background'])('fences pending persistence and retained handlers after %s', async change => {
  const wait = deferred<void>(); mockStorage.setItem.mockReturnValue(wait.promise);
  await render(); await ask('DELETE_DRAFT'); const send = retainedConfirm(); await act(async () => { void send(); });
  if (change === 'blur') { mockFocused = false; await refresh(); }
  else if (change === 'account') { mockSession = { user: { id: N }, accountRevision: 2 }; await refresh(); }
  else { await act(async () => { mockForeground = 'background'; for (const listener of mockListeners) listener('background'); }); }
  // The open question went with the scope it was asked in.
  expect(sheets()).toHaveLength(0);
  await act(async () => { wait.resolve(); void send(); }); expect(mockService.deleteDraftNeed).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});
it('late receipt after blur cannot refresh collection or navigate; refocus restores via readback', async () => {
  const wait = deferred<typeof success>(); mockService.deleteDraftNeed.mockReturnValue(wait.promise);
  await render(); await ask('DELETE_DRAFT'); await inSheet('confirm-sheet-confirm'); mockFocused = false; await refresh();
  await act(async () => wait.resolve(success)); expect(mockSource.mojePotrebe).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
  mockStorage.getItem.mockResolvedValue(JSON.stringify(command)); mockFocused = true; await refresh();
  expect(mockService.readCommandReceipt).toHaveBeenCalledWith(command); expect(mockService.deleteDraftNeed).toHaveBeenCalledTimes(1);
});
it('retained final callback cannot accept an unseen newer Need revision', async () => {
  await render(); await ask('DELETE_DRAFT'); const send = retainedConfirm();
  need = { ...need, revizija: 4 }; await refresh(); await act(async () => { await send(); }); expect(mockStorage.setItem).not.toHaveBeenCalled();
});
