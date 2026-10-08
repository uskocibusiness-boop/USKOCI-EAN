import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const aid = '11111111-1111-4111-8111-111111111111', gid = '22222222-2222-4222-8222-222222222222';
const rid = '33333333-3333-4333-8333-333333333333', asset = '44444444-4444-4444-8444-444444444444';
let mockAccount = aid, mockRevision = 0, mockFocused = true, mockVersion: number | null = 3, mockWritable = true;
const mockValues = new Map<string, string>(), mockPick = jest.fn(), mockUpload = jest.fn(), mockRead = jest.fn(), mockCancel = jest.fn(), mockList = jest.fn();
const mockSet = jest.fn(async (key: string, value: string) => { mockValues.set(key, value); });
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: async (key: string) => mockValues.get(key) ?? null,
  setItem: (...args: Parameters<typeof mockSet>) => mockSet(...args) }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }),
  sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }) }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => '33333333-3333-4333-8333-333333333333' }));
jest.mock('../../features/media/nativePhotoPicker', () => ({ pickPreparedPhoto: (...args: unknown[]) => mockPick(...args), photoSelectionMessage: () => 'Izbor nije pripremljen.' }));
jest.mock('../agreementPhotoClientService', () => ({ agreementPhotoClientService: {
  upload: (...args: unknown[]) => mockUpload(...args), read: (...args: unknown[]) => mockRead(...args), cancel: (...args: unknown[]) => mockCancel(...args),
  list: (...args: unknown[]) => mockList(...args),
} }));
import { useAgreementPhotos } from '../../hooks/useAgreementPhotos';
const ref = { agreementId: gid, agreementVersion: 3, clientRequestId: rid };
const photo = { assetId: asset, width: 1600, height: 1200, byteSize: 8, contentType: 'image/jpeg' as const };
const ready = { ...ref, accountId: aid, assetId: asset, state: 'READY', photo, attachedMessageId: null, authoritative: true };
const absent = { ...ready, assetId: null, photo: null, state: 'ABSENT' };
const prepared = { bytes: new ArrayBuffer(8), contentType: 'image/jpeg', width: 1600, height: 1200 };
let outboxState: { capturing: boolean; entries: any[] };
const outbox = { getSnapshot: () => outboxState };
let photos: ReturnType<typeof useAgreementPhotos>, tree: ReactTestRenderer;
function Harness() { photos = useAgreementPhotos(mockAccount, gid, mockVersion, mockWritable, outbox); return null; }
async function render() { await act(async () => { tree = create(<Harness />); }); }
const pick = async () => { await act(async () => { await photos.pick('LIBRARY'); }); };
function stored() { return JSON.parse([...mockValues.values()][0]).uploads; }
beforeEach(() => {
  jest.clearAllMocks(); mockValues.clear(); mockAccount = aid; mockRevision = 0; mockFocused = true; mockVersion = 3; mockWritable = true;
  outboxState = { capturing: false, entries: [] }; mockSet.mockImplementation(async (key, value) => { mockValues.set(key, value); });
  mockPick.mockResolvedValue(prepared); mockRead.mockResolvedValue({ ok: true, podatak: ready });
  mockUpload.mockResolvedValue({ ok: true, podatak: ready }); mockCancel.mockResolvedValue({ ok: true, podatak: { ...ready, state: 'CANCELLED', photo: null } });
  mockList.mockResolvedValue({ ok: true, podatak: [] });
});
afterEach(async () => { await act(async () => tree?.unmount()); });
it('persists opaque identity before upload and captures only READY assets with the accepted version', async () => {
  mockUpload.mockImplementation(async () => { expect(stored()).toEqual([ref]); return { ok: true, podatak: ready }; });
  await render(); expect(photos.ready).toBe(false); await pick();
  expect(photos.capture()).toEqual({ agreementVersion: 3, assetIds: [asset] });
  expect([...mockValues.values()][0]).not.toMatch(/bytes|uri|image\/jpeg|width|caption/);
  expect(mockUpload).toHaveBeenCalledWith(ref, prepared.bytes, expect.objectContaining({ accountId: aid, accountRevision: 0 }), expect.any(AbortSignal));
});
it('recovers untracked owner uploads by explicit selection, never by automatic upload or send', async () => {
  mockList.mockResolvedValue({ ok: true, podatak: [ready] }); await render();
  expect(photos.saved).toEqual([ready]); expect(photos.hasSelection).toBe(false); expect(photos.capture()).toBeNull();
  await act(async () => { await photos.restore(rid); }); expect(stored()).toEqual([ref]); expect(photos.capture()?.assetIds).toEqual([asset]);
  expect(mockUpload).not.toHaveBeenCalled(); expect(mockPick).not.toHaveBeenCalled();
});
it('restores an unknown upload after remount without pixels, automatic upload or a fresh key, then fences ABSENT by explicit cancel', async () => {
  mockRead.mockResolvedValue({ ok: true, podatak: absent }); mockUpload.mockResolvedValue({ ok: false, kod: 'UNKNOWN', poruka: 'Nije potvrđeno.' });
  await render(); await pick(); expect(photos.canRetry(rid)).toBe(true);
  await act(async () => tree.unmount()); await render();
  expect(photos.items[0].receipt?.state).toBe('ABSENT'); expect(photos.canRetry(rid)).toBe(false); expect(photos.ready).toBe(false);
  expect(mockUpload).toHaveBeenCalledTimes(1); expect(mockPick).toHaveBeenCalledTimes(1);
  await act(async () => { await photos.remove(ref); }); expect(stored()).toEqual([]);
  expect(mockCancel).toHaveBeenCalledWith(ref, expect.objectContaining({ accountId: aid }));
});
it('says plainly that it is not known whether a photo was sent, when its receipt cannot be read', async () => {
  await render(); await pick();
  mockRead.mockResolvedValue({ ok: false, poruka: 'Nije potvrđeno.' });
  await act(async () => { await photos.refresh(); });
  expect(photos.message).toBe('Ne znamo da li je fotografija poslata. Osveži fotografije pre novog izbora.');
});
it('does not erase an opaque intent after cancellation uncertainty or retry a PROCESSING storage dispatch', async () => {
  mockRead.mockResolvedValue({ ok: true, podatak: { ...ready, state: 'PROCESSING', photo: null } });
  await render(); await pick();
  await act(async () => { await photos.retry(ref); }); expect(mockUpload).toHaveBeenCalledTimes(1);
  mockCancel.mockResolvedValue({ ok: false, poruka: 'Ishod nije potvrđen.' });
  await act(async () => { await photos.remove(ref); }); expect(stored()).toEqual([ref]); expect(photos.hasSelection).toBe(true);
});
it('retires the upload journal only after an attached canonical receipt without confirming any outbox text', async () => {
  await render(); await pick();
  mockRead.mockResolvedValue({ ok: true, podatak: { ...ready, attachedMessageId: gid } });
  await act(async () => { await photos.refresh(); }); expect(stored()).toEqual([]); expect(photos.items).toEqual([]);
  expect(outboxState.entries).toEqual([]); expect(mockUpload).toHaveBeenCalledTimes(1);
});
it('cannot upload a picker result after account ABA or reuse a retained callback after blur/refocus', async () => {
  let resolve!: (value: unknown) => void; mockPick.mockReturnValue(new Promise(done => { resolve = done; }));
  await render(); const oldPick = photos.pick; let pending!: Promise<void>;
  await act(async () => { pending = photos.pick('LIBRARY'); }); mockRevision = 2;
  await act(async () => { resolve(prepared); await pending; }); expect(mockUpload).not.toHaveBeenCalled(); expect(mockSet).not.toHaveBeenCalled();
  mockFocused = false; await act(async () => tree.update(<Harness />)); mockFocused = true; await act(async () => tree.update(<Harness />));
  await act(async () => { await oldPick('CAMERA'); }); expect(mockPick).toHaveBeenCalledTimes(1);
});
it('keeps old prepared version visible but cannot retarget it to newer terms or cancel an outbox-reserved asset', async () => {
  await render(); await pick(); mockVersion = 4; await act(async () => tree.update(<Harness />));
  expect(photos.hasSelection).toBe(true); expect(photos.capture()).toBeNull(); expect(photos.canSubmit()).toBe(false);
  mockVersion = 3; await act(async () => tree.update(<Harness />));
  outboxState.capturing = true; await act(async () => { await photos.remove(ref); }); expect(mockCancel).not.toHaveBeenCalled();
  outboxState.capturing = false; outboxState.entries = [{ command: { photos: { agreementVersion: 3, assetIds: [asset] } } }];
  await act(async () => { await photos.remove(ref); }); expect(mockCancel).not.toHaveBeenCalled(); expect(photos.capture()).toBeNull();
});
it('keeps photo selection and Send fenced during an in-flight picker and on local journal failure', async () => {
  let resolve!: (value: unknown) => void; mockPick.mockReturnValue(new Promise(done => { resolve = done; }));
  await render(); const oldCanSubmit = photos.canSubmit; let pending!: Promise<void>;
  await act(async () => { pending = photos.pick('LIBRARY'); }); expect(oldCanSubmit()).toBe(false);
  mockSet.mockRejectedValue(new Error('disk details'));
  await act(async () => { resolve(prepared); await pending; }); expect(mockUpload).not.toHaveBeenCalled(); expect(photos.loaded).toBe(false);
  expect(photos.canSubmit()).toBe(false); expect(photos.message).not.toContain('disk details');
});
