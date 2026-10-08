import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
// The screen that saves, replaces or removes the profile photograph is the one place that knows the photograph the app remembered in memory
// (`ownPhotoCache`) is no longer the saved one. It says so the moment the change is saved, so the header and the profile never go on drawing the old face.
const OWNER = '11111111-1111-4111-8111-111111111111', PROFILE = '22222222-2222-4222-8222-222222222222';
const REQUEST = '33333333-3333-4333-8333-333333333333', ASSET = '44444444-4444-4444-8444-444444444444';
let mockSession = { user: { id: OWNER }, accountRevision: 1 }, mockFocused = true;
const mockJournal = new Map<string, string>(), mockSet = jest.fn(), mockPick = jest.fn(), mockRead = jest.fn();
const mockReceipt = jest.fn(), mockUpload = jest.fn(), mockApply = jest.fn(), mockClear = jest.fn(), mockDiscard = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: async (key: string) => mockJournal.get(key) ?? null, setItem: (...a: unknown[]) => mockSet(...a),
  removeItem: async (key: string) => { mockJournal.delete(key); } } }));
jest.mock('../mediaClientService', () => ({ mediaClientService: {
  readProfileAvatar: (...a: unknown[]) => mockRead(...a), readUploadCommand: (...a: unknown[]) => mockReceipt(...a),
  uploadAvatar: (...a: unknown[]) => mockUpload(...a), applyAvatar: (...a: unknown[]) => mockApply(...a),
  clearAvatar: (...a: unknown[]) => mockClear(...a), discardAvatar: (...a: unknown[]) => mockDiscard(...a) } }));
jest.mock('../../features/media/nativePhotoPicker', () => ({ pickPreparedPhoto: (...a: unknown[]) => mockPick(...a), photoSelectionMessage: () => 'Nije pripremljeno.',
  PHOTO_PERMISSION_MESSAGE: 'Dozvoli pristup kameri u podešavanjima ili izaberi fotografiju iz galerije.' }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ profileId: '22222222-2222-4222-8222-222222222222' }),
  router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => '33333333-3333-4333-8333-333333333333' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'Photo', mediaAssetId: (value: string) => value.split('/')[2] }));
jest.mock('../ownProfileClientService', () => ({ ownProfileClientService: { read: async () => null } }));
jest.mock('../../ui/settings/SettingsPresentation', () => ({ SettingsText: 'T', SettingsScreen: 'Screen', SettingsPanel: 'Panel', SettingsAction: 'Action' }));
import Route from '../../app/(app)/profil/fotografija';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';
import { ownPhotoCache } from '../../ui/media/ownPhotoCache';

const journalKey = `uskoci:media-upload:${OWNER}:AVATAR:${PROFILE}`;
const ok = (podatak: unknown) => ({ ok: true, podatak }), unknown = () => ({ ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
const photo = { bytes: new Uint8Array([1, 2, 3]).buffer, contentType: 'image/jpeg', width: 1, height: 1 };
const ref = `${OWNER}/v5/${ASSET}/${'a'.repeat(64)}.jpg`;
const asset = () => ({ assetId: ASSET, accountId: OWNER, scope: 'AVATAR', profileId: PROFILE, conversationId: null,
  clientRequestId: REQUEST, state: 'READY', selected: true, ref, sha256: 'a'.repeat(64), width: 1, height: 1, byteSize: 3, contentType: 'image/jpeg', authoritative: true });
const profile = (avatarPath: string | null = null) => ({ profileId: PROFILE, accountId: OWNER, avatarPath, authoritative: true });
const saved = { profileId: PROFILE, accountId: OWNER, assetId: ASSET, avatarPath: ref, saved: true, authoritative: true };
const applying = () => mockJournal.set(journalKey, JSON.stringify({ phase: 'APPLY', requestId: REQUEST, assetId: ASSET, expectedPath: null }));
let tree: ReactTestRenderer, forget: jest.SpyInstance;
const render = async () => { await act(async () => { tree = create(<Route />); }); };
const action = (label: string) => tree.root.findByProps({ label }).props;

beforeEach(() => {
  jest.clearAllMocks(); mockJournal.clear();
  for (const m of [mockRead, mockReceipt, mockUpload, mockSet, mockPick, mockApply, mockDiscard, mockClear]) m.mockReset();
  mockSession = { user: { id: OWNER }, accountRevision: 1 }; mockFocused = true;
  mockSet.mockImplementation(async (key: string, value: string) => { mockJournal.set(key, value); });
  mockRead.mockResolvedValue(ok(profile())); mockReceipt.mockResolvedValue(ok(asset()));
  mockUpload.mockResolvedValue(ok(asset())); mockPick.mockResolvedValue(photo); mockApply.mockResolvedValue(unknown());
  mockClear.mockResolvedValue(unknown());
  mockDiscard.mockResolvedValue(ok({ assetId: ASSET, profileId: PROFILE, accountId: OWNER, discarded: true, authoritative: true }));
  forget = jest.spyOn(ownPhotoCache, 'forget');
});
afterEach(async () => { await act(async () => tree?.unmount()); forget.mockRestore(); });

it('forgets the remembered photograph the moment a new one is saved, and not while the answer is unknown', async () => {
  applying(); await render();
  await act(async () => action('Pošalji promenu ponovo').onPress());
  expect(mockApply).toHaveBeenCalledTimes(1); expect(forget).not.toHaveBeenCalled();
  await act(async () => action('Proveri sačuvanu fotografiju').onPress());
  mockApply.mockResolvedValue(ok(saved));
  await act(async () => action('Pošalji promenu ponovo').onPress());
  expect(mockApply).toHaveBeenCalledTimes(2); expect(forget).toHaveBeenCalledTimes(1);
});

it('forgets it the moment the photograph is removed, and not when the removal is refused', async () => {
  mockRead.mockResolvedValue(ok(profile(ref))); await render();
  const confirm = async () => {
    await act(async () => action('Ukloni fotografiju profila').onPress());
    await act(async () => { tree.root.findByType(ConfirmSheet).findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress(); });
  };
  await confirm();
  expect(mockClear).toHaveBeenCalledTimes(1); expect(forget).not.toHaveBeenCalled();
  await act(async () => action('Proveri sačuvanu fotografiju').onPress());
  mockClear.mockResolvedValue(ok(profile(null)));
  await act(async () => action('Pošalji promenu ponovo').onPress());
  expect(mockClear).toHaveBeenCalledTimes(2); expect(forget).toHaveBeenCalledTimes(1);
});

it('forgets it when a change whose outcome was unknown is found to be saved, and clears the journal as before', async () => {
  applying(); mockRead.mockResolvedValue(ok(profile(ref))); await render();
  expect(forget).toHaveBeenCalledTimes(1); expect(mockJournal.size).toBe(0);
  expect(mockApply).not.toHaveBeenCalled();
});

it('forgets it when the profile turns out to have been changed from somewhere else', async () => {
  applying(); await render();
  mockApply.mockResolvedValue({ ok: false, kod: 'MEDIA_VERSION_CONFLICT', poruka: 'Avatar je promenjen. Osveži profil.' });
  await act(async () => action('Pošalji promenu ponovo').onPress());
  expect(mockApply).toHaveBeenCalledTimes(1); expect(forget).toHaveBeenCalledTimes(1); expect(mockJournal.size).toBe(0);
});

it('leaves it alone when a chosen picture that was never saved is let go of: the saved photograph did not change', async () => {
  await render(); await act(async () => action('Izaberi iz galerije').onPress());
  await act(async () => action('Odustani od izabrane fotografije').onPress());
  expect(mockDiscard).toHaveBeenCalledTimes(1); expect(mockApply).not.toHaveBeenCalled(); expect(forget).not.toHaveBeenCalled();
});
