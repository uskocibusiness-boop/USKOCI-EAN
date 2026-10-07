import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const ID = '11111111-1111-4111-8111-111111111111', GENERATION = '22222222-2222-4222-8222-222222222222';
let mockSession = { user: { id: 'account-a' }, accountRevision: 1 }, mockFocused = true;
const mockStatus = jest.fn(), mockRequest = jest.fn(), mockPrepare = jest.fn(), mockCancel = jest.fn(), mockRevoke = jest.fn(), mockDownload = jest.fn(), mockSaveFile = jest.fn();
const mockRouter = { back: jest.fn() };
jest.mock('../dataExportClientService', () => ({ dataExportClientService: { readStatus: (...a: unknown[]) => mockStatus(...a),
  requestExport: (...a: unknown[]) => mockRequest(...a), prepareExport: (...a: unknown[]) => mockPrepare(...a),
  cancelExport: (...a: unknown[]) => mockCancel(...a), revokeExport: (...a: unknown[]) => mockRevoke(...a), downloadExport: (...a: unknown[]) => mockDownload(...a) } }));
jest.mock('../../lib/dataExportFile', () => ({ saveDataExportFile: (...a: unknown[]) => mockSaveFile(...a) }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useFocusEffect: (effect: () => void) =>
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('unexpected transport'); } }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' })); jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import ExportScreen from '../../app/(app)/profil/izvoz';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';
const ok = (podatak: unknown) => ({ ok: true, podatak });
const descriptor = () => ({ artifactAvailable: true, artifactGeneration: GENERATION, artifactExpiresAt: '2099-01-01T00:00:00Z', byteLength: 3, sha256: 'a'.repeat(64), md5: 'b'.repeat(32) });
const status = (state: string | null = null, fulfillment: unknown = null, key = 'existing-export-key') => ({ hasRequest: state !== null,
  request: state ? { receiptId: ID, clientRequestId: key, status: state, requestedAt: '2026-09-10T10:00:00Z', updatedAt: '2026-09-10T10:00:00Z',
    cancelledAt: state === 'CANCELLED' ? '2026-09-10T10:01:00Z' : null, completedAt: null, failureCode: null } : null,
  downloadAvailable: fulfillment !== null, fulfillment, serverFulfillmentRequired: true, externalDsrChannelReady: false });
const file = () => ({ receiptId: ID, artifactGeneration: GENERATION, bytes: new Uint8Array([1, 2, 3]), byteLength: 3, sha256: 'a'.repeat(64), md5: 'b'.repeat(32) });
function deferred<T = unknown>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<ExportScreen />); }); };
const update = async () => { await act(async () => tree.update(<ExportScreen />)); };
const button = (label: string) => tree.root.findByProps({ label });
const tap = async (label: string) => { await act(async () => { await button(label).props.onPress(); }); };
const texts = () => tree.root.findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
// The confirmations were Alert.alert and are an in-app ConfirmSheet now. `confirm()` is its confirm button; `retained()` is
// the screen's own answer as the sheet holds it (the closure the Alert used to get), fired after the screen retired it.
const sheet = () => tree.root.findByType(ConfirmSheet);
const sheets = () => tree.root.findAllByType(ConfirmSheet);
const confirm = () => sheet().findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress;
const retained = () => sheet().props.onConfirm;
beforeEach(() => {
  jest.clearAllMocks(); for (const mock of [mockStatus, mockRequest, mockPrepare, mockCancel, mockRevoke, mockDownload, mockSaveFile]) mock.mockReset();
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockFocused = true;
  mockStatus.mockResolvedValue(ok(status())); mockRequest.mockImplementation(async key => ok({ receiptId: ID, clientRequestId: key, status: 'REQUESTED', requestedAt: '2026-09-10T10:00:00Z', idempotentReplay: false }));
  mockPrepare.mockResolvedValue(ok({ receiptId: ID, kind: 'NOT_READY', code: 'POLICY_NOT_READY' }));
  mockCancel.mockResolvedValue(ok({ receiptId: ID, status: 'CANCELLED' })); mockRevoke.mockResolvedValue(ok({ receiptId: ID, revoked: true }));
  mockDownload.mockImplementation(async () => ok(file())); mockSaveFile.mockResolvedValue({ status: 'SAVED', fileName: 'safe.json' });
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });
it('reads actual account status without requesting or preparing on mount', async () => {
  await render(); expect(mockStatus).toHaveBeenCalledTimes(1); expect(button('Zatraži izvoz')).toBeTruthy();
  expect(mockRequest).not.toHaveBeenCalled(); expect(mockPrepare).not.toHaveBeenCalled(); expect(mockDownload).not.toHaveBeenCalled();
});
it('keeps one actual primary action outside scrolling content and cancellation secondary', async () => {
  mockStatus.mockResolvedValue(ok(status('REQUESTED'))); await render();
  const footer = tree.root.findByProps({ testID: 'settings-primary-footer' });
  expect(footer.findAll(node => node.type === 'Press' as React.ElementType).map(node => node.props.accessibilityLabel))
    .toEqual(['Pripremi kopiju']);
  expect(footer.findAllByProps({ label: 'Otkaži zahtev' })).toHaveLength(0);
  const scroll = tree.root.findByType('ScrollView' as React.ElementType);
  expect(scroll.findAllByProps({ label: 'Otkaži zahtev' }).length).toBeGreaterThan(0);
  expect(mockPrepare).not.toHaveBeenCalled(); expect(mockCancel).not.toHaveBeenCalled();
});
it('keeps the primary footer absent while the account export state is unresolved', async () => {
  const pending = deferred(); mockStatus.mockReturnValueOnce(pending.promise); await render();
  expect(tree.root.findAllByProps({ testID: 'settings-primary-footer' })).toHaveLength(0);
  expect(tree.root.findByProps({ accessibilityLabel: 'Učitavanje stanja izvoza' })).toBeTruthy();
  expect(mockRequest).not.toHaveBeenCalled(); expect(mockPrepare).not.toHaveBeenCalled();
});
it('serializes request double taps and reads back the accepted request', async () => {
  const pending = deferred(); mockRequest.mockReturnValueOnce(pending.promise); await render(); const action = button('Zatraži izvoz').props.onPress;
  await act(async () => { void action(); void action(); }); expect(mockRequest).toHaveBeenCalledTimes(1);
  const key = mockRequest.mock.calls[0][0]; mockStatus.mockResolvedValue(ok(status('REQUESTED', null, key)));
  await act(async () => pending.resolve(ok({ receiptId: ID, clientRequestId: key, status: 'REQUESTED' })));
  expect(texts()).toContain('Zahtev za izvoz je zabeležen'); expect(button('Pripremi kopiju')).toBeTruthy(); expect(mockPrepare).not.toHaveBeenCalled();
});
// Round 2c (verifier va, item 7): the retained key is set before the write, so the very first request read "Ponovi isti
// zahtev" beside its spinner, as if it were a retry. Round 5c: the button keeps its own words with the spinner.
it('keeps the first request\'s own words with a spinner while it runs, never that it repeats one', async () => {
  const pending = deferred(); mockRequest.mockReturnValueOnce(pending.promise); await render();
  await act(async () => { void button('Zatraži izvoz').props.onPress(); });
  expect(button('Zatraži izvoz').props).toMatchObject({ loading: true, disabled: true });
  expect(tree.root.findAllByProps({ label: 'Pošalji ponovo' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ label: 'Slanje zahteva…' })).toHaveLength(0);
  const key = mockRequest.mock.calls[0][0]; mockStatus.mockResolvedValue(ok(status('REQUESTED', null, key)));
  await act(async () => pending.resolve(ok({ receiptId: ID, clientRequestId: key, status: 'REQUESTED' })));
  expect(button('Pripremi kopiju').props.loading).toBe(false);
});
it('a repeated request keeps "Ponovi isti zahtev" with its spinner while it runs', async () => {
  mockRequest.mockRejectedValueOnce(new Error('lost')); await render(); await tap('Zatraži izvoz'); await tap('Osveži stanje');
  const pending = deferred(); mockRequest.mockReturnValueOnce(pending.promise);
  await act(async () => { void button('Pošalji ponovo').props.onPress(); });
  expect(button('Pošalji ponovo').props).toMatchObject({ loading: true, disabled: true });
  const key = mockRequest.mock.calls[1][0]; mockStatus.mockResolvedValue(ok(status('REQUESTED', null, key)));
  await act(async () => pending.resolve(ok({ receiptId: ID, clientRequestId: key, status: 'REQUESTED' })));
});
it('preparing and saving keep their words with a spinner while they run', async () => {
  const prepared = deferred(); mockPrepare.mockReturnValueOnce(prepared.promise);
  mockStatus.mockResolvedValue(ok(status('REQUESTED'))); await render();
  await act(async () => { void button('Pripremi kopiju').props.onPress(); });
  expect(button('Pripremi kopiju').props).toMatchObject({ loading: true, disabled: true });
  expect(tree.root.findAllByProps({ label: 'Radnja je u toku…' })).toHaveLength(0);
  await act(async () => prepared.resolve(ok({ receiptId: ID, kind: 'NOT_READY', code: 'POLICY_NOT_READY' })));
  await act(async () => tree.unmount());
  const downloaded = deferred(); mockDownload.mockReturnValueOnce(downloaded.promise);
  mockStatus.mockResolvedValue(ok(status('READY', descriptor()))); await render();
  await act(async () => { void button('Preuzmi i sačuvaj').props.onPress(); });
  expect(button('Preuzmi i sačuvaj').props).toMatchObject({ loading: true, disabled: true });
  expect(tree.root.findAllByProps({ label: 'Preuzimanje i čuvanje…' })).toHaveLength(0);
  await act(async () => downloaded.resolve(ok(file())));
});
it('retains the same request key after unknown outcome and requires readback', async () => {
  mockRequest.mockRejectedValueOnce(new Error('private SQL detail')); await render(); await tap('Zatraži izvoz'); const key = mockRequest.mock.calls[0][0];
  expect(texts()).not.toContain('private SQL'); expect(tree.root.findAllByProps({ label: 'Pošalji ponovo' })).toHaveLength(0);
  await tap('Osveži stanje'); await tap('Pošalji ponovo'); expect(mockRequest).toHaveBeenLastCalledWith(key);
});
it('presents POLICY_NOT_READY without a fabricated READY or download', async () => {
  mockStatus.mockResolvedValue(ok(status('REQUESTED'))); await render(); await tap('Pripremi kopiju');
  expect(mockPrepare).toHaveBeenCalledWith(ID); expect(texts()).toContain('Priprema kopije trenutno nije dostupna');
  expect(tree.root.findAllByProps({ label: 'Preuzmi i sačuvaj' })).toHaveLength(0); expect(mockDownload).not.toHaveBeenCalled();
});
it('reads actual availability after a READY preparation receipt rather than manufacturing it', async () => {
  mockStatus.mockResolvedValueOnce(ok(status('REQUESTED'))).mockResolvedValue(ok(status('READY')));
  mockPrepare.mockResolvedValue(ok({ receiptId: ID, kind: 'READY' })); await render(); await tap('Pripremi kopiju');
  expect(tree.root.findAllByProps({ label: 'Preuzmi i sačuvaj' })).toHaveLength(0); expect(button('Zatraži novu kopiju')).toBeTruthy();
});
it.each(['account', 'incarnation', 'blur'])('rejects a retained cancellation after %s changes', async change => {
  mockStatus.mockResolvedValue(ok(status('REQUESTED'))); await render(); await tap('Otkaži zahtev'); const old = retained();
  if (change === 'account') mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  else if (change === 'incarnation') mockSession = { user: { id: 'account-a' }, accountRevision: 3 };
  else { mockFocused = false; await update(); expect(sheets()).toHaveLength(0); mockFocused = true; await update(); }
  await act(async () => old()); expect(mockCancel).not.toHaveBeenCalled();
});
it('cancelling the question sends nothing, and the same question can be asked again', async () => {
  mockStatus.mockResolvedValue(ok(status('REQUESTED'))); await render(); await tap('Otkaži zahtev');
  await act(async () => { sheet().findByProps({ testID: 'confirm-sheet-cancel' }).props.onPress(); });
  expect(sheets()).toHaveLength(0); expect(mockCancel).not.toHaveBeenCalled();
  // The cancel path released the dialog token: the question opens again and its answer runs once.
  await tap('Otkaži zahtev'); await act(async () => { confirm()(); }); expect(mockCancel).toHaveBeenCalledTimes(1);
});
it('cancels only after explicit confirmation and refetches the real cancelled state', async () => {
  mockStatus.mockResolvedValueOnce(ok(status('REQUESTED'))).mockResolvedValue(ok(status('CANCELLED')));
  await render(); await tap('Otkaži zahtev'); expect(mockCancel).not.toHaveBeenCalled();
  expect(sheet().props).toMatchObject({ title: 'Otkaži zahtev?', confirmLabel: 'Otkaži zahtev', cancelLabel: 'Odustani', tone: 'danger' });
  const action = confirm();
  await act(async () => { action(); action(); }); expect(mockCancel).toHaveBeenCalledTimes(1); expect(texts()).toContain('Zahtev je otkazan');
});
it('the screen\'s own answer, fired twice in one tick, cancels once: the screen\'s guards and the editor\'s write lock', async () => {
  // The test above presses the sheet's button, which the sheet itself runs only once. This one calls the answer the screen
  // handed the sheet twice: the second call is refused by the screen's own guards (the token it retired, `canAct`) or by
  // the editor's write lock, whichever comes first. It does not single out the token; the next test does.
  mockStatus.mockResolvedValueOnce(ok(status('REQUESTED'))).mockResolvedValue(ok(status('CANCELLED')));
  await render(); await tap('Otkaži zahtev'); const answer = retained();
  await act(async () => { answer(); answer(); }); expect(mockCancel).toHaveBeenCalledTimes(1);
});
it('an answer kept after the question was cancelled sends nothing: the dialog token is the fence', async () => {
  // Round 2c (verifier vs, must 2): nothing else is in flight here (no editor write, no sheet latch on this closure), so
  // only the screen's dialog token can refuse it. It fails when `dialog.current !== token ||` is removed.
  mockStatus.mockResolvedValueOnce(ok(status('REQUESTED'))).mockResolvedValue(ok(status('CANCELLED')));
  await render(); await tap('Otkaži zahtev'); const answer = retained();
  await act(async () => { sheet().findByProps({ testID: 'confirm-sheet-cancel' }).props.onPress(); });
  expect(sheets()).toHaveLength(0);
  await act(async () => { answer(); }); expect(mockCancel).not.toHaveBeenCalled();
});
it('keeps the question open with a busy confirm while the cancellation runs, and closes it once it settles', async () => {
  const cancelled = deferred(); mockCancel.mockReturnValueOnce(cancelled.promise);
  mockStatus.mockResolvedValueOnce(ok(status('REQUESTED'))).mockResolvedValue(ok(status('CANCELLED')));
  await render(); await tap('Otkaži zahtev'); await act(async () => { confirm()(); });
  expect(mockCancel).toHaveBeenCalledTimes(1); expect(sheets()).toHaveLength(1);
  expect(sheet().findByProps({ testID: 'confirm-sheet-confirm' }).props.accessibilityState).toEqual({ disabled: true, busy: true });
  await act(async () => cancelled.resolve(ok({ receiptId: ID, status: 'CANCELLED' })));
  expect(sheets()).toHaveLength(0); expect(texts()).toContain('Zahtev je otkazan');
});
it('does not report saved or open a picker until explicit download completes and actual local save succeeds', async () => {
  const downloaded = deferred(), saved = deferred(); mockDownload.mockReturnValueOnce(downloaded.promise); mockSaveFile.mockReturnValueOnce(saved.promise);
  mockStatus.mockResolvedValue(ok(status('READY', descriptor()))); await render(); expect(mockDownload).not.toHaveBeenCalled();
  const action = button('Preuzmi i sačuvaj').props.onPress; await act(async () => { void action(); void action(); });
  expect(mockDownload).toHaveBeenCalledTimes(1); expect(mockSaveFile).not.toHaveBeenCalled(); expect(texts()).not.toContain('Kopija je sačuvana');
  await act(async () => downloaded.resolve(ok(file()))); expect(mockSaveFile).toHaveBeenCalledTimes(1); expect(texts()).not.toContain('Kopija je sačuvana');
  await act(async () => saved.resolve({ status: 'SAVED', fileName: 'safe.json' })); expect(texts()).toContain('Kopija je sačuvana u izabranoj fascikli');
});
it.each(['account', 'blur'])('retires pending picker ownership after %s changes', async change => {
  const saved = deferred(); mockSaveFile.mockReturnValueOnce(saved.promise); mockStatus.mockResolvedValue(ok(status('READY', descriptor())));
  await render(); await act(async () => { void button('Preuzmi i sačuvaj').props.onPress(); });
  const options = mockSaveFile.mock.calls[0][0]; expect(options.isCurrent()).toBe(true);
  if (change === 'account') mockSession = { user: { id: 'account-b' }, accountRevision: 2 }; else mockFocused = false;
  await update(); expect(options.isCurrent()).toBe(false); expect(options.signal.aborted).toBe(true);
  await act(async () => saved.resolve({ status: 'SAVED' })); expect(texts()).not.toContain('Kopija je sačuvana');
});
it.each(['account', 'incarnation', 'blur'])('discards and zeroes a late successful download after %s changes without opening a picker', async change => {
  const downloaded = deferred(), bytes = file(); mockDownload.mockReturnValueOnce(downloaded.promise);
  mockStatus.mockResolvedValue(ok(status('READY', descriptor())));
  await render(); await act(async () => { void button('Preuzmi i sačuvaj').props.onPress(); });
  if (change === 'account') mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  else if (change === 'incarnation') mockSession = { user: { id: 'account-a' }, accountRevision: 3 };
  else { mockFocused = false; await update(); }
  await act(async () => downloaded.resolve(ok(bytes)));
  expect(bytes.bytes).toEqual(new Uint8Array(3)); expect(mockSaveFile).not.toHaveBeenCalled();
  expect(texts()).not.toContain('Kopija je sačuvana');
});
it.each([{ artifactGeneration: ID }, { sha256: 'c'.repeat(64) }, { byteLength: 2 }])('does not open the picker for a mismatched artifact %s', async change => {
  mockStatus.mockResolvedValue(ok(status('READY', descriptor()))); mockDownload.mockResolvedValue(ok({ ...file(), ...change }));
  await render(); await tap('Preuzmi i sačuvaj'); expect(mockSaveFile).not.toHaveBeenCalled(); expect(texts()).toContain('Preuzeta kopija nije potvrđena');
});
it.each(['CANCELLED', 'FAILED', 'DOWNLOAD_STARTED'])('does not claim a saved file after %s', async result => {
  mockStatus.mockResolvedValue(ok(status('READY', descriptor()))); mockSaveFile.mockResolvedValue({ status: result });
  await render(); await tap('Preuzmi i sačuvaj'); expect(texts()).not.toContain('Kopija je sačuvana');
});
it('requires an owned readback after an unknown download response before any second download', async () => {
  mockStatus.mockResolvedValue(ok(status('READY', descriptor()))); mockDownload.mockRejectedValueOnce(new Error('private storage error'));
  await render(); const old = button('Preuzmi i sačuvaj').props.onPress; await act(async () => old());
  expect(texts()).not.toContain('private storage'); await act(async () => old()); expect(mockDownload).toHaveBeenCalledTimes(1);
  await tap('Osveži stanje'); await tap('Preuzmi i sačuvaj'); expect(mockDownload).toHaveBeenCalledTimes(2);
});
it('never downloads an expired descriptor, even from a retained enabled callback', async () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-10T10:00:00Z'));
  mockStatus.mockResolvedValue(ok(status('READY', { ...descriptor(), artifactExpiresAt: '2026-09-10T10:00:01Z' })));
  await render(); const old = button('Preuzmi i sačuvaj').props.onPress;
  await act(async () => jest.advanceTimersByTime(1001)); await act(async () => old()); expect(mockDownload).not.toHaveBeenCalled();
});
it('revokes the server copy only after confirmation and explains that existing local files remain', async () => {
  mockStatus.mockResolvedValueOnce(ok(status('READY', descriptor()))).mockResolvedValue(ok(status('EXPIRED')));
  await render(); await tap('Opozovi kopiju'); expect(sheet().props.message).toContain('Već sačuvani fajlovi');
  await act(async () => confirm()()); expect(mockRevoke).toHaveBeenCalledWith(ID); expect(mockSaveFile).not.toHaveBeenCalled();
  expect(texts()).toContain('Preuzimanje kopije je opozvano');
});
// Round 5: the outcome of the footer action is said right above that action, in the colour of what happened.
it('says a saved copy above the button that saved it, in the confirmation colour', async () => {
  mockStatus.mockResolvedValue(ok(status('READY', descriptor()))); await render(); await tap('Preuzmi i sačuvaj');
  const footer = tree.root.findByProps({ testID: 'settings-primary-footer' });
  const line = footer.findAll(node => node.type === 'T' as React.ElementType && node.props.children === 'Kopija je sačuvana u izabranoj fascikli.');
  expect(line).toHaveLength(1); expect(line[0].props).toMatchObject({ tone: 'success', accessibilityLiveRegion: 'polite' });
});
it('says an unconfirmed copy as a failure, and a withdrawal is drawn apart from the harmless refresh', async () => {
  mockStatus.mockResolvedValue(ok(status('READY', descriptor()))); mockDownload.mockResolvedValue(ok({ ...file(), sha256: 'c'.repeat(64) }));
  await render(); expect(button('Opozovi kopiju').props.kind).toBe('destructive');
  await tap('Preuzmi i sačuvaj');
  const line = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.children === 'Preuzeta kopija nije potvrđena. Osveži stanje.');
  expect(line).toHaveLength(1); expect(line[0].props).toMatchObject({ tone: 'danger', accessibilityRole: 'alert' });
});
it('the steps never call a cancelled request the active step', async () => {
  mockStatus.mockResolvedValue(ok(status('CANCELLED'))); await render();
  const steps = tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string' && /^(Zahtev|Priprema kopije|Preuzimanje), /.test(node.props.accessibilityLabel))
    .map(node => node.props.accessibilityLabel as string);
  expect(steps[0]).toMatch(/^Zahtev, zaustavljeno. Zahtev je otkazan. /); expect(steps.slice(1).every(label => label.includes(', sledi.'))).toBe(true);
  expect(button('Zatraži novu kopiju')).toBeTruthy();
});
// Round 5 review: a preparation that has not started was spoken "u toku".
it('the step that waits for the person is spoken as next, never as running', async () => {
  mockStatus.mockResolvedValue(ok(status('REQUESTED'))); await render();
  const labels = tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string' && /^Priprema kopije, /.test(node.props.accessibilityLabel))
    .map(node => node.props.accessibilityLabel as string);
  expect(labels).toEqual(['Priprema kopije, na redu. Priprema još nije pokrenuta.']);
  expect(labels.join(' ')).not.toContain('u toku');
});
// UI/UX pass 2026-10-07 (team T4c): the state of the export is one chip word, and nothing implies a file where there is none.
const chip = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'status-chip').map(node => node.props.accessibilityLabel as string);
it.each([
  ['no request yet', null, null, 'Nije traženo'], ['requested', 'REQUESTED', null, 'Zahtev poslat'], ['preparing', 'PROCESSING', null, 'U pripremi'],
  ['ready and saveable', 'READY', descriptor(), 'Spremno'], ['ready but never verified', 'READY', null, 'Nije dostupno'],
  ['expired', 'EXPIRED', null, 'Isteklo'], ['failed', 'FAILED', null, 'Nije uspelo'], ['cancelled', 'CANCELLED', null, 'Otkazano'],
] as const)('the export that is %s is one chip word: %s', async (_name, state, fulfillment, word) => {
  mockStatus.mockResolvedValue(ok(status(state, fulfillment))); await render();
  expect(chip()).toEqual([word]);
  // The chip is a mark and its word, never colour alone.
  expect(tree.root.findAll(node => node.props.testID === 'status-mark').length).toBeGreaterThan(0);
});
it('a copy whose availability has run out says "Isteklo" before the server does, and offers no withdrawal of a file that is gone', async () => {
  mockStatus.mockResolvedValue(ok(status('READY', { ...descriptor(), artifactExpiresAt: '2000-01-01T00:00:00Z' }))); await render();
  expect(chip()).toEqual(['Isteklo']);
  expect(tree.root.findAllByProps({ label: 'Opozovi kopiju' })).toHaveLength(0); expect(tree.root.findAllByProps({ label: 'Preuzmi i sačuvaj' })).toHaveLength(0);
  expect(button('Zatraži novu kopiju')).toBeTruthy();
});
it('the sentence about keeping a copy is said only when there is a copy to keep', async () => {
  mockStatus.mockResolvedValue(ok(status('REQUESTED'))); await render();
  expect(texts()).not.toContain('Čuvaj kopiju na mestu');
  await act(async () => tree.unmount());
  mockStatus.mockResolvedValue(ok(status('READY', descriptor()))); await render();
  expect(texts()).toContain('Čuvaj kopiju na mestu'); expect(texts()).not.toContain('stvarna kopija');
});
it('a re-read keeps the card and the footer on screen: the action waits grey and says why, and only the first read is a skeleton', async () => {
  mockStatus.mockResolvedValue(ok(status('READY', descriptor()))); await render();
  const again = deferred(); mockStatus.mockReturnValueOnce(again.promise);
  await act(async () => { void button('Osveži stanje').props.onPress(); });
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Učitavanje stanja izvoza' })).toHaveLength(0);
  expect(chip()).toEqual(['Spremno']);
  expect(button('Preuzmi i sačuvaj').props).toMatchObject({ disabled: true, reason: 'Učitavamo stanje…' });
  expect(button('Osveži stanje').props.loading).toBe(true);
  await act(async () => button('Preuzmi i sačuvaj').props.onPress()); expect(mockDownload).not.toHaveBeenCalled();
  await act(async () => again.resolve(ok(status('READY', descriptor()))));
  expect(button('Preuzmi i sačuvaj').props).toMatchObject({ disabled: false, reason: null }); expect(button('Osveži stanje').props.loading).toBe(false);
});
it('a read that fails says what happened with one retry, and offers no chip over a state that is not known', async () => {
  mockStatus.mockResolvedValue({ ok: false, kod: 'X', poruka: 'Stanje trenutno nije dostupno.' }); await render();
  expect(texts()).toContain('Stanje izvoza nije učitano'); expect(texts()).toContain('Stanje trenutno nije dostupno.');
  expect(chip()).toEqual([]); expect(tree.root.findAllByProps({ label: 'Osveži stanje' })).toHaveLength(1);
});
