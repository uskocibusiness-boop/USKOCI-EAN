import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const OWNER = '11111111-1111-4111-8111-111111111111', CID = '22222222-2222-4222-8222-222222222222';
const REQUEST = '33333333-3333-4333-8333-333333333333';
let mockSession = { user: { id: OWNER }, accountRevision: 1 }, mockFocused = true, mockParams: { conversationId?: string } = { conversationId: CID };
const mockGet = jest.fn(), mockSet = jest.fn(), mockRemoveJournal = jest.fn(), mockPick = jest.fn();
const mockRead = jest.fn(), mockReceipt = jest.fn(), mockUpload = jest.fn(), mockRemove = jest.fn(), mockBack = jest.fn(), mockCancel = jest.fn();
const mockReplace = jest.fn(), mockCanGoBack = jest.fn(() => true);
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: (...a: unknown[]) => mockGet(...a), setItem: (...a: unknown[]) => mockSet(...a), removeItem: (...a: unknown[]) => mockRemoveJournal(...a) } }));
jest.mock('../mediaClientService', () => ({ mediaClientService: {
  readTaskPhotos: (...a: unknown[]) => mockRead(...a), readUploadCommand: (...a: unknown[]) => mockReceipt(...a),
  uploadTaskPhoto: (...a: unknown[]) => mockUpload(...a), removeTaskPhoto: (...a: unknown[]) => mockRemove(...a),
  cancelUploadCommand: (...a: unknown[]) => mockCancel(...a) } }));
jest.mock('../../features/media/nativePhotoPicker', () => ({ pickPreparedPhotos: (...a: unknown[]) => mockPick(...a),
  photoSelectionMessage: () => 'Nije pripremljeno.', photoSelectionSkipped: (n: number) => `${n} nije dodato.` }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams,
  router: { canGoBack: () => mockCanGoBack(), back: () => mockBack(), replace: (...a: unknown[]) => mockReplace(...a) },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
const mockId = jest.fn(() => '33333333-3333-4333-8333-333333333333');
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => mockId() }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'Photo' }));
// The screen is the system's: the harness draws its bar, its content and, right after it, its foot, so the foot's one action stays findable;
// the real foot (with its reason above the action), sections and tiles are kept, and the action is the host whose props the tests read.
jest.mock('../../ui/system/Screen', () => ({ Screen: ({ header, footer, children }: { header?: unknown; footer?: unknown; children?: unknown }) =>
  require('react').createElement('Screen', null, header, children, footer) }));
jest.mock('../../ui/system/DetailTopBar', () => ({ DetailTopBar: 'DetailTopBar' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/system/PermissionRecovery', () => ({ PermissionRecovery: 'PermissionRecovery' }));
// The shared photo sheet is drawn by its own suite; here it is a host whose `onPick` is the screen's own.
jest.mock('../../ui/media/PhotoAttachSheet', () => ({ PhotoAttachSheet: 'PhotoAttachSheet' }));
jest.mock('expo-image', () => ({ Image: 'NativeImage' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
const mockAsk = jest.fn();
jest.mock('../../ui/system/ConfirmSheet', () => ({ useConfirmSheet: () => ({ ask: (...a: unknown[]) => mockAsk(...a), close: jest.fn(), open: false, sheet: null }) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(t, k) { return k === 'View' ? 'View' : Reflect.get(t, k); } }); });
import Route from '../../app/(app)/fotografije-zadatka';
import { PhotoViewer } from '../../ui/media/PhotoViewer';
import { FlowFooter } from '../../ui/system/FlowFooter';
const ok = (podatak: unknown) => ({ ok: true, podatak });
const absent = () => ({ ok: false, kod: 'MEDIA_NOT_FOUND', poruka: 'Fotografija nije dostupna.' });
const photo = { bytes: new Uint8Array([1, 2, 3]).buffer, contentType: 'image/jpeg', width: 1, height: 1 };
const selection = (...photos: unknown[]) => ({ photos: photos.length ? photos : [photo], rejected: 0, firstError: null });
const listing = () => ({ conversationId: CID, accountId: OWNER, photos: [], ready: true, authoritative: true });
function deferred() { let resolve!: (v: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Route />); }); };
const action = (label: string) => tree.root.findByProps({ label }).props;
const ADD = 'Dodaj fotografije';
/** Why the one green action is grey: the foot says it in a line ABOVE the action (the system's `FlowFooter reason`). */
const footReason = () => tree.root.findByType(FlowFooter).props.reason;
/** The footer's one action opens the shared sheet; the sheet's source is then chosen, as a person does. */
const choose = async (source: 'LIBRARY' | 'CAMERA' = 'LIBRARY') => {
  await act(async () => action(ADD).onPress());
  const sheet = tree.root.findByType('PhotoAttachSheet' as React.ElementType).props;
  await act(async () => { void sheet.onPick(source); });
};
beforeEach(() => {
  jest.clearAllMocks(); for (const m of [mockRead, mockReceipt, mockUpload, mockGet, mockSet, mockPick, mockCancel]) m.mockReset();
  mockSession = { user: { id: OWNER }, accountRevision: 1 }; mockFocused = true; mockParams = { conversationId: CID };
  mockCanGoBack.mockReturnValue(true);
  mockGet.mockResolvedValue(null); mockSet.mockResolvedValue(undefined); mockRead.mockResolvedValue(ok(listing()));
  mockReceipt.mockResolvedValue(absent()); mockPick.mockResolvedValue(selection()); mockUpload.mockResolvedValue({ ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
  mockCancel.mockResolvedValue({ ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
});
afterEach(async () => { await act(async () => tree?.unmount()); });
it('restores only the opaque upload identity and reads its result without resending or allocating a new photo', async () => {
  mockGet.mockResolvedValue(REQUEST); await render();
  expect(mockReceipt).toHaveBeenCalledWith(REQUEST); expect(mockUpload).not.toHaveBeenCalled();
  expect(mockPick).not.toHaveBeenCalled(); expect(action(ADD).disabled).toBe(true);
  expect(mockSet).not.toHaveBeenCalled();
});
it('retires a definitively rejected staged upload without claiming a photo was added or resending', async () => {
  mockGet.mockResolvedValue(REQUEST);
  mockReceipt.mockResolvedValue(ok({ scope: 'TASK', conversationId: CID, clientRequestId: REQUEST, state: 'STAGED', selected: false }));
  await render();
  expect(mockRemoveJournal).toHaveBeenCalledWith(`uskoci:media-upload:${OWNER}:TASK:${CID}`);
  expect(action(ADD).disabled).toBe(false);
  expect(JSON.stringify(tree.toJSON())).toContain('Fotografija nije dodata.');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Fotografija je dodata privatnom nacrtu.');
  expect(mockUpload).not.toHaveBeenCalled();
});
it('persists only the UUID before upload and retains identical bytes and identity after unknown I/O', async () => {
  const held = deferred(); mockUpload.mockReturnValueOnce(held.promise); await render();
  await act(async () => action(ADD).onPress());
  const retained = tree.root.findByType('PhotoAttachSheet' as React.ElementType).props.onPick;
  await act(async () => { void retained('LIBRARY'); void retained('LIBRARY'); });
  expect(mockUpload).toHaveBeenCalledTimes(1); expect(mockPick).toHaveBeenCalledTimes(1);
  expect(mockSet).toHaveBeenCalledWith(`uskoci:media-upload:${OWNER}:TASK:${CID}`, REQUEST);
  expect(mockSet.mock.invocationCallOrder[0]).toBeLessThan(mockUpload.mock.invocationCallOrder[0]);
  const original = mockUpload.mock.calls[0][0];
  await act(async () => held.resolve({ ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' }));
  expect(action(ADD).disabled).toBe(true); expect(mockReceipt).toHaveBeenCalledWith(REQUEST);
  await act(async () => action('Pošalji ponovo').onPress());
  expect(mockUpload).toHaveBeenCalledTimes(2); expect(mockUpload.mock.calls[1][0]).toEqual(original);
  expect(mockUpload.mock.calls[1][0].bytes).toBe(photo.bytes); expect(mockPick).toHaveBeenCalledTimes(1);
});
it('performs no upload when durable identity storage fails, including an explicit retry', async () => {
  mockSet.mockRejectedValue(new Error('unavailable')); await render();
  await choose();
  expect(mockUpload).not.toHaveBeenCalled();
  await act(async () => action('Proveri').onPress());
  await act(async () => action('Pošalji ponovo').onPress());
  expect(mockUpload).not.toHaveBeenCalled();
});
it('discards a picker result if the account changes before upload', async () => {
  const picked = deferred(); mockPick.mockReturnValueOnce(picked.promise); await render();
  await choose();
  mockSession = { user: { id: '44444444-4444-4444-8444-444444444444' }, accountRevision: 2 };
  await act(async () => { tree.update(<Route />); picked.resolve(selection()); });
  expect(mockUpload).not.toHaveBeenCalled(); expect(mockSet).not.toHaveBeenCalled();
});
it('does not start upload after account revision changes while the identity is being stored', async () => {
  const stored = deferred(); mockSet.mockReturnValueOnce(stored.promise); await render();
  await choose();
  mockSession = { user: { id: OWNER }, accountRevision: 3 };
  await act(async () => { tree.update(<Route />); stored.resolve(undefined); });
  expect(mockUpload).not.toHaveBeenCalled();
});
// Opened from a link on a cold start, the arrow used to replace to a blank new conversation.
it('the arrow with no screen behind it returns to this conversation; with one, it goes back', async () => {
  await render();
  const arrow = () => tree.root.findByType('DetailTopBar' as React.ElementType).props.onBack;
  mockCanGoBack.mockReturnValue(false); await act(async () => arrow()());
  expect(mockBack).not.toHaveBeenCalled(); expect(mockReplace).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: CID } });
  await act(async () => tree.unmount()); mockCanGoBack.mockReturnValue(true); await render(); await act(async () => arrow()());
  expect(mockBack).toHaveBeenCalledTimes(1); expect(mockReplace).toHaveBeenCalledTimes(1);
});
it('says why adding is grey once six photos are in the draft', async () => {
  const six = Array.from({ length: 6 }, (_, i) => ({ assetId: `6666666${i}-6666-4666-8666-666666666666`, state: 'READY' }));
  mockRead.mockResolvedValue(ok({ ...listing(), photos: six })); await render();
  expect(action(ADD).disabled).toBe(true);
  expect(footReason()).toBe('Dodato je najviše fotografija. Ukloni jednu da dodaš drugu.');
  expect(JSON.stringify(tree.toJSON())).toContain('6 fotografija od 6');
});
it('invalid conversation routes cause no photo reads, picker, or writes', async () => {
  mockParams = { conversationId: 'invalid' }; await render();
  expect(mockRead).not.toHaveBeenCalled(); expect(mockGet).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
  // There is no draft to add to: the screen says so, and has no foot with an action that could never work.
  expect(JSON.stringify(tree.toJSON())).toContain('Fotografije nisu dostupne');
  expect(tree.root.findAllByProps({ label: ADD })).toHaveLength(0); expect(tree.root.findAllByType(FlowFooter)).toHaveLength(0);
});
describe('PKG-008 safe exit from an unconfirmed Task photo upload (GAP-0036)', () => {
  const JOURNAL = `uskoci:media-upload:${OWNER}:TASK:${CID}`;
  const shown = () => JSON.stringify(tree.toJSON());
  const has = (label: string) => tree.root.findAllByProps({ label }).length > 0;
  const cancelled = (previousState: string | null = null, assetId: string | null = null) => ({ accountId: OWNER, conversationId: CID,
    clientRequestId: REQUEST, previousState, assetId, selected: false, cancelled: true, authoritative: true });
  // The durable journal is stateful: a confirmed removal is what a later read observes.
  beforeEach(() => { mockRemoveJournal.mockImplementation(async () => { mockGet.mockResolvedValue(null); }); });
  it('after remount without bytes and an absent command the user can explicitly cancel the original identity; nothing is erased before the server confirms', async () => {
    mockGet.mockResolvedValue(REQUEST); await render();
    expect(mockReceipt).toHaveBeenCalledWith(REQUEST);
    expect(action(ADD).disabled).toBe(true); expect(has('Pošalji ponovo')).toBe(false);
    expect(shown()).toContain('Slanje još nije primljeno'); expect(mockRemoveJournal).not.toHaveBeenCalled();
    mockCancel.mockResolvedValueOnce(ok(cancelled()));
    await act(async () => action('Odustani od slanja').onPress());
    expect(mockCancel).toHaveBeenCalledWith({ conversationId: CID, clientRequestId: REQUEST });
    expect(mockRemoveJournal).toHaveBeenCalledWith(JOURNAL);
    expect(action(ADD).disabled).toBe(false); expect(has('Odustani od slanja')).toBe(false);
    expect(shown()).toContain('Slanje je otkazano'); expect(mockUpload).not.toHaveBeenCalled(); expect(mockPick).not.toHaveBeenCalled();
    expect(mockRead).toHaveBeenCalledTimes(2);
  });
  it('an unconfirmed cancellation keeps the identity and the exit; only a confirmed cancellation clears it', async () => {
    mockGet.mockResolvedValue(REQUEST); await render();
    await act(async () => action('Odustani od slanja').onPress());
    expect(mockCancel).toHaveBeenCalledTimes(1); expect(mockRemoveJournal).not.toHaveBeenCalled();
    expect(action(ADD).disabled).toBe(true); expect(has('Odustani od slanja')).toBe(true);
    expect(shown()).toContain('Ishod nije potvrđen.');
    mockCancel.mockResolvedValueOnce(ok(cancelled()));
    await act(async () => action('Odustani od slanja').onPress());
    expect(mockRemoveJournal).toHaveBeenCalledWith(JOURNAL); expect(action(ADD).disabled).toBe(false);
  });
  it('cancelling a command the server already admitted deselects it and re-reads the draft', async () => {
    mockGet.mockResolvedValue(REQUEST); await render();
    mockCancel.mockResolvedValueOnce(ok(cancelled('PROCESSING', '55555555-5555-4555-8555-555555555555')));
    await act(async () => action('Odustani od slanja').onPress());
    expect(mockRemoveJournal).toHaveBeenCalledWith(JOURNAL); expect(shown()).toContain('nije u nacrtu');
    expect(mockRead).toHaveBeenCalledTimes(2); expect(action(ADD).disabled).toBe(false);
  });
  it('a same-session unknown ACK offers the same-key retry and the cancel; the cancel never resends', async () => {
    const held = deferred(); mockUpload.mockReturnValueOnce(held.promise); await render();
    await choose();
    await act(async () => held.resolve({ ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' }));
    expect(has('Pošalji ponovo')).toBe(true); expect(has('Odustani od slanja')).toBe(true);
    expect(shown()).toContain('Slanje još nije primljeno');
    mockCancel.mockResolvedValueOnce(ok(cancelled()));
    await act(async () => action('Odustani od slanja').onPress());
    expect(mockUpload).toHaveBeenCalledTimes(1); expect(mockRemoveJournal).toHaveBeenCalledWith(JOURNAL);
    expect(has('Pošalji ponovo')).toBe(false); expect(action(ADD).disabled).toBe(false);
  });
  it('a cancellation confirmed after the account changed erases nothing', async () => {
    mockGet.mockResolvedValue(REQUEST); await render();
    mockCancel.mockImplementationOnce(async () => { mockSession = { user: { id: '44444444-4444-4444-8444-444444444444' }, accountRevision: 2 }; return ok(cancelled()); });
    await act(async () => action('Odustani od slanja').onPress());
    expect(mockRemoveJournal).not.toHaveBeenCalled();
  });
  it('an unknown command read keeps the exit without claiming the server has no command', async () => {
    mockGet.mockResolvedValue(REQUEST); mockReceipt.mockResolvedValue({ ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
    await render();
    expect(shown()).toContain('Ne znamo da li je slanje uspelo.'); expect(shown()).not.toContain('Slanje još nije primljeno');
    expect(has('Odustani od slanja')).toBe(true); expect(has('Pošalji ponovo')).toBe(false);
    expect(mockRemoveJournal).not.toHaveBeenCalled(); expect(action(ADD).disabled).toBe(true);
  });
  it('a settled command on remount is retired without offering a cancel', async () => {
    mockGet.mockResolvedValue(REQUEST);
    mockReceipt.mockResolvedValue(ok({ scope: 'TASK', conversationId: CID, clientRequestId: REQUEST, state: 'READY', selected: true }));
    await render();
    expect(mockRemoveJournal).toHaveBeenCalledWith(JOURNAL); expect(has('Odustani od slanja')).toBe(false);
    expect(mockCancel).not.toHaveBeenCalled(); expect(shown()).toContain('Fotografija je dodata privatnom nacrtu.');
  });
  it('a corrupt journal value is discarded and the picker recovers without any command read', async () => {
    mockGet.mockResolvedValue('not-a-command-id'); await render();
    expect(mockReceipt).not.toHaveBeenCalled(); expect(mockRemoveJournal).toHaveBeenCalledWith(JOURNAL);
    expect(action(ADD).disabled).toBe(false); expect(shown()).toContain('nije mogao da se pročita');
  });
});

// Round 6 (objava): a photo is removed from its own tile after a question, never at once; every way out of an
// unconfirmed send is on screen at most once.
describe('round 6: the photo grid', () => {
  const READY = '77777777-7777-4777-8777-777777777777';
  // Tiles are measured: the harness gives the grid a width so the tiles are drawn.
  const lay = async () => { for (const node of tree.root.findAll(n => typeof n.props.onLayout === 'function'))
    await act(async () => node.props.onLayout({ nativeEvent: { layout: { width: 320, height: 0 } } })); };
  it('asks before removing a photo and removes it only on the confirm', async () => {
    mockRead.mockResolvedValue(ok({ ...listing(), photos: [{ assetId: READY, state: 'READY' }] }));
    mockRemove.mockResolvedValue(ok({ ...listing(), photos: [] }));
    await render(); await lay();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Ukloni fotografiju 1' }).props.onPress());
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(mockAsk.mock.calls[0][0]).toMatchObject({ title: 'Ukloniti fotografiju?', confirmLabel: 'Ukloni', tone: 'danger' });
    await act(async () => { await mockAsk.mock.calls[0][0].onConfirm(); });
    expect(mockRemove).toHaveBeenCalledWith({ conversationId: CID, assetId: READY });
    expect(JSON.stringify(tree.toJSON())).toContain('Fotografija je uklonjena iz nacrta.');
  });
  it('draws each way out of an unconfirmed send at most once, with a tile of its own', async () => {
    mockGet.mockResolvedValue(REQUEST); await render(); await lay();
    for (const label of ['Odustani od slanja', 'Proveri', 'Pošalji ponovo'])
      expect(tree.root.findAllByProps({ label }).length).toBeLessThanOrEqual(1);
    expect(JSON.stringify(tree.toJSON())).toContain('Ne znamo da li je poslato');
    expect(footReason()).toBe('Prvo završi ili otkaži nepotvrđeno slanje.');
  });
  it('an unconfirmed send keeps the server-owned cancel when the photo list read also fails', async () => {
    mockRead.mockResolvedValueOnce(ok(listing())).mockResolvedValue({ ok: false, kod: 'MEDIA_READ_FAILED', poruka: 'Fotografije nisu učitane.' });
    await render();
    await choose();
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByProps({ label: 'Odustani od slanja' })).toHaveLength(1);
    expect(tree.root.findAllByProps({ label: 'Proveri' })).toHaveLength(1);
    mockCancel.mockResolvedValueOnce(ok({ accountId: OWNER, conversationId: CID, clientRequestId: REQUEST, previousState: null,
      assetId: null, selected: false, cancelled: true, authoritative: true }));
    await act(async () => action('Odustani od slanja').onPress());
    expect(mockCancel).toHaveBeenCalledWith({ conversationId: CID, clientRequestId: REQUEST });
  });
  it('an empty draft says so and leaves the add action live', async () => {
    await render();
    expect(JSON.stringify(tree.toJSON())).toContain('Još nema fotografija');
    expect(action(ADD).disabled).toBe(false);
    expect(tree.root.findAllByProps({ label: 'Proveri' })).toHaveLength(0);
  });
});

// Owner, 2026-10-07: adding photos must make sense. Several from one gallery pick go up one after another, each with its own
// identity persisted before its bytes leave; a photo still processing is checked again by itself, for a bounded time.
describe('2026-10-07: one sequence, the bounded check and the shared viewer', () => {
  const ID = (n: number) => `3333333${n}-3333-4333-8333-333333333333`;
  const asset = (id: string, state = 'READY', assetId = `5555555${id.slice(7, 8)}-5555-4555-8555-555555555555`) =>
    ({ scope: 'TASK', conversationId: CID, clientRequestId: id, assetId, state, selected: true });
  const shown = () => JSON.stringify(tree.toJSON());
  it('sends the photos of one pick in order, each identity stored before its upload, and stops at an unconfirmed one', async () => {
    const order: string[] = [];
    mockId.mockReturnValueOnce(ID(1)).mockReturnValueOnce(ID(2)).mockReturnValueOnce(ID(3));
    const second = { ...photo, bytes: new Uint8Array([4]).buffer }, third = { ...photo, bytes: new Uint8Array([5]).buffer };
    mockPick.mockResolvedValueOnce(selection(photo, second, third));
    mockSet.mockImplementation(async (_key: string, id: string) => { order.push(`journal:${id}`); });
    mockUpload.mockImplementation(async (input: { clientRequestId: string }) => { order.push(`upload:${input.clientRequestId}`);
      return input.clientRequestId === ID(2) ? { ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' } : ok(asset(input.clientRequestId)); });
    await render(); await choose();
    expect(mockPick.mock.calls[0][2]).toMatchObject({ limit: 6 });
    // The second one is not confirmed: the third waits, and nothing is sent behind its back.
    expect(order).toEqual([`journal:${ID(1)}`, `upload:${ID(1)}`, `journal:${ID(2)}`, `upload:${ID(2)}`]);
    expect(mockUpload.mock.calls[1][0].bytes).toBe(second.bytes);
    for (const node of tree.root.findAll(n => typeof n.props.onLayout === 'function'))
      await act(async () => node.props.onLayout({ nativeEvent: { layout: { width: 320, height: 0 } } }));
    expect(shown()).toContain('Čeka'); expect(shown()).toContain('Ne znamo da li je poslato'); expect(action(ADD).disabled).toBe(true);
    // Its own exits are there; cancelling it stops the sequence it belonged to and says so.
    mockCancel.mockResolvedValueOnce(ok({ accountId: OWNER, conversationId: CID, clientRequestId: ID(2), previousState: null,
      assetId: null, selected: false, cancelled: true, authoritative: true }));
    await act(async () => action('Odustani od slanja').onPress());
    expect(mockCancel).toHaveBeenCalledWith({ conversationId: CID, clientRequestId: ID(2) });
    expect(mockUpload).toHaveBeenCalledTimes(2); expect(shown()).toContain('Ostale izabrane fotografije nisu poslate (1).');
    expect(shown()).not.toContain('Čeka');
  });
  it('a sequence that goes through ends with one sentence, and a resent unconfirmed photo continues the sequence', async () => {
    mockId.mockReturnValueOnce(ID(1)).mockReturnValueOnce(ID(2));
    mockPick.mockResolvedValueOnce(selection(photo, { ...photo, bytes: new Uint8Array([9]).buffer }));
    mockUpload.mockResolvedValueOnce({ ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' })
      .mockImplementation(async (input: { clientRequestId: string }) => ok(asset(input.clientRequestId)));
    await render(); await choose();
    expect(mockUpload).toHaveBeenCalledTimes(1);
    await act(async () => action('Pošalji ponovo').onPress());
    expect(mockUpload.mock.calls.map(call => call[0].clientRequestId)).toEqual([ID(1), ID(1), ID(2)]);
    expect(shown()).toContain('Dodato u privatni nacrt: 2 fotografije.');
  });
  it('checks a photo still processing every 3 s by itself, stops once it is ready, and gives up to a hand check after a minute', async () => {
    jest.useFakeTimers();
    try {
      mockId.mockReturnValue(ID(1));
      mockUpload.mockResolvedValueOnce(ok(asset(ID(1), 'PROCESSING')));
      mockReceipt.mockResolvedValue(ok(asset(ID(1), 'PROCESSING')));
      await render(); await choose();
      expect(shown()).toContain('Ne znamo da li je fotografija obrađena');
      const reads = mockReceipt.mock.calls.length;
      await act(async () => { jest.advanceTimersByTime(3000); });
      await act(async () => { await Promise.resolve(); });
      expect(mockReceipt.mock.calls.length).toBeGreaterThan(reads);
      // Twenty checks, then the person checks by hand.
      for (let tick = 0; tick < 25; tick++) { await act(async () => { jest.advanceTimersByTime(3000); }); }
      const spent = mockReceipt.mock.calls.length;
      expect(spent - reads).toBeLessThanOrEqual(20);
      await act(async () => { jest.advanceTimersByTime(30000); });
      expect(mockReceipt.mock.calls.length).toBe(spent);
      expect(tree.root.findAllByProps({ label: 'Proveri' })).toHaveLength(1);
      // A hand check that finds it ready retires the identity and the check.
      mockReceipt.mockResolvedValue(ok(asset(ID(1), 'READY')));
      await act(async () => action('Proveri').onPress());
      expect(mockRemoveJournal).toHaveBeenCalled(); expect(shown()).toContain('Fotografija je dodata privatnom nacrtu.');
    } finally { jest.useRealTimers(); }
  });
  it('opens a saved photo in the shared full-screen viewer', async () => {
    const READY_ID = '77777777-7777-4777-8777-777777777777';
    mockRead.mockResolvedValue(ok({ ...listing(), photos: [{ ...asset(ID(1)), assetId: READY_ID }] }));
    await render();
    for (const node of tree.root.findAll(n => typeof n.props.onLayout === 'function'))
      await act(async () => node.props.onLayout({ nativeEvent: { layout: { width: 320, height: 0 } } }));
    expect(tree.root.findAllByType(PhotoViewer)).toHaveLength(0);
    await act(async () => tree.root.findByType('Photo' as React.ElementType).props.open.onPress());
    expect(tree.root.findByType(PhotoViewer).props).toMatchObject({ photos: [{ assetId: READY_ID }], index: 0, title: 'Fotografije zadatka' });
  });
});
