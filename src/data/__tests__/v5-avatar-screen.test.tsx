import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const OWNER = '11111111-1111-4111-8111-111111111111', PROFILE = '22222222-2222-4222-8222-222222222222';
const REQUEST = '33333333-3333-4333-8333-333333333333', ASSET = '44444444-4444-4444-8444-444444444444';
let mockSession = { user: { id: OWNER }, accountRevision: 1 }, mockFocused = true;
const mockPermission = 'Dozvoli pristup kameri u podešavanjima ili izaberi fotografiju iz galerije.';
let mockSelectionMessage = 'Nije pripremljeno.';
const mockJournal = new Map<string, string>(), mockSet = jest.fn(), mockPick = jest.fn(), mockRead = jest.fn();
const mockReceipt = jest.fn(), mockUpload = jest.fn(), mockApply = jest.fn(), mockClear = jest.fn(), mockDiscard = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: async (key: string) => mockJournal.get(key) ?? null, setItem: (...a: unknown[]) => mockSet(...a),
  removeItem: async (key: string) => { mockJournal.delete(key); } } }));
jest.mock('../mediaClientService', () => ({ mediaClientService: {
  readProfileAvatar: (...a: unknown[]) => mockRead(...a), readUploadCommand: (...a: unknown[]) => mockReceipt(...a),
  uploadAvatar: (...a: unknown[]) => mockUpload(...a), applyAvatar: (...a: unknown[]) => mockApply(...a),
  clearAvatar: (...a: unknown[]) => mockClear(...a), discardAvatar: (...a: unknown[]) => mockDiscard(...a) } }));
jest.mock('../../features/media/nativePhotoPicker', () => ({ pickPreparedPhoto: (...a: unknown[]) => mockPick(...a), photoSelectionMessage: () => mockSelectionMessage,
  get PHOTO_PERMISSION_MESSAGE() { return mockPermission; } }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ profileId: '22222222-2222-4222-8222-222222222222' }),
  router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => '33333333-3333-4333-8333-333333333333' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'Photo', mediaAssetId: (value: string) => value.split('/')[2] }));
// The letters that stand in the circle come from the profile's own name (a read of the requester profile, never of the stored photo).
const mockWho = jest.fn();
jest.mock('../ownProfileClientService', () => ({ ownProfileClientService: { read: (...a: unknown[]) => mockWho(...a) } }));
jest.mock('../../ui/settings/SettingsPresentation', () => ({ SettingsText: 'T', SettingsScreen: 'Screen', SettingsPanel: 'Panel', SettingsAction: 'Action' }));
import Route from '../../app/(app)/profil/fotografija';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';
const journalKey = `uskoci:media-upload:${OWNER}:AVATAR:${PROFILE}`;
const ok = (podatak: unknown) => ({ ok: true, podatak }), unknown = () => ({ ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
const photo = { bytes: new Uint8Array([1, 2, 3]).buffer, contentType: 'image/jpeg', width: 1, height: 1 };
const ref = `${OWNER}/v5/${ASSET}/${'a'.repeat(64)}.jpg`;
const asset = () => ({ assetId: ASSET, accountId: OWNER, scope: 'AVATAR', profileId: PROFILE, conversationId: null,
  clientRequestId: REQUEST, state: 'READY', selected: true, ref, sha256: 'a'.repeat(64), width: 1, height: 1, byteSize: 3, contentType: 'image/jpeg', authoritative: true });
const profile = (avatarPath: string | null = null) => ({ profileId: PROFILE, accountId: OWNER, avatarPath, authoritative: true });
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Route />); }); };
const action = (label: string) => tree.root.findByProps({ label }).props;
// The bar's "ⓘ" is an element in the screen's `right`: it is not text, and a React element cannot be stringified.
const dump = () => JSON.stringify(tree.toJSON(), (key, value) => key === 'right' ? '[right]' : value);
beforeEach(() => {
  jest.clearAllMocks(); mockJournal.clear();
  for (const m of [mockRead, mockReceipt, mockUpload, mockSet, mockPick, mockApply, mockDiscard]) m.mockReset();
  mockSession = { user: { id: OWNER }, accountRevision: 1 }; mockFocused = true; mockSelectionMessage = 'Nije pripremljeno.'; mockClear.mockReset();
  mockWho.mockReset().mockResolvedValue(null);
  mockSet.mockImplementation(async (key: string, value: string) => { mockJournal.set(key, value); });
  mockRead.mockResolvedValue(ok(profile())); mockReceipt.mockResolvedValue(ok(asset()));
  mockUpload.mockResolvedValue(ok(asset())); mockPick.mockResolvedValue(photo); mockApply.mockResolvedValue(unknown());
  mockDiscard.mockResolvedValue(ok({ assetId: ASSET, profileId: PROFILE, accountId: OWNER, discarded: true, authoritative: true }));
});
afterEach(async () => { await act(async () => tree?.unmount()); });
it('stages the chosen picture and publishes it only through the explicit profile action', async () => {
  await render(); const retained = action('Izaberi iz galerije').onPress;
  await act(async () => { void retained(); void retained(); });
  expect(mockUpload).toHaveBeenCalledTimes(1); expect(mockApply).not.toHaveBeenCalled();
  expect(mockUpload.mock.calls[0][0]).toMatchObject({ profileId: PROFILE, clientRequestId: REQUEST, bytes: photo.bytes });
  const stored = JSON.parse(mockJournal.get(journalKey)!); expect(stored).toEqual({ phase: 'UPLOAD', requestId: REQUEST, assetId: null, expectedPath: null });
  await act(async () => action('Sačuvaj fotografiju').onPress());
  expect(mockApply).toHaveBeenCalledWith({ profileId: PROFILE, assetId: ASSET, expectedAvatarPath: null });
});
it('restores an unknown apply by read only and replays its exact original avatar precondition', async () => {
  const prior = `${OWNER}/legacy.jpg`;
  mockJournal.set(journalKey, JSON.stringify({ phase: 'APPLY', requestId: REQUEST, assetId: ASSET, expectedPath: prior }));
  mockRead.mockResolvedValue(ok(profile(prior))); await render();
  expect(mockReceipt).toHaveBeenCalledWith(REQUEST); expect(mockApply).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
  await act(async () => action('Pošalji promenu ponovo').onPress());
  expect(mockApply).toHaveBeenCalledWith({ profileId: PROFILE, assetId: ASSET, expectedAvatarPath: prior });
});
it('retires a definitively rejected staged upload and never offers to apply it', async () => {
  mockJournal.set(journalKey, JSON.stringify({ phase: 'UPLOAD', requestId: REQUEST, assetId: null, expectedPath: null }));
  mockReceipt.mockResolvedValue(ok({ ...asset(), state: 'STAGED', selected: false, ref: null }));
  await render();
  expect(mockJournal.size).toBe(0); expect(action('Izaberi iz galerije').disabled).toBe(false);
  expect(tree.root.findAllByProps({ label: 'Sačuvaj fotografiju' })).toHaveLength(0);
  expect(dump()).toContain('Fotografija nije dodata.');
  expect(mockApply).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
});
it('retires the staged choice without applying it and prevents a retained apply callback', async () => {
  await render(); await act(async () => action('Izaberi iz galerije').onPress()); const apply = action('Sačuvaj fotografiju').onPress;
  await act(async () => action('Odustani od izabrane fotografije').onPress());
  expect(mockDiscard).toHaveBeenCalledWith({ assetId: ASSET, profileId: PROFILE }); expect(mockJournal.size).toBe(0);
  await act(async () => apply()); expect(mockApply).not.toHaveBeenCalled();
});
it.each(['MEDIA_INVALID_RESPONSE', 'MEDIA_UNCONFIRMED'])('retains a %s discard journal and retries the same asset and expected profile only after a read', async code => {
  mockDiscard.mockResolvedValueOnce({ ok: false, kod: code, poruka: 'Potvrda radnje nije stigla cela. Osveži prikaz pre ponovnog pokušaja.' });
  await render(); await act(async () => action('Izaberi iz galerije').onPress());
  await act(async () => action('Odustani od izabrane fotografije').onPress());
  const stored = mockJournal.get(journalKey);
  expect(JSON.parse(stored!)).toEqual({ phase: 'DISCARD', requestId: REQUEST, assetId: ASSET, expectedPath: null });
  expect(mockDiscard.mock.calls).toEqual([[{ assetId: ASSET, profileId: PROFILE }]]);
  expect(tree.root.findAllByProps({ label: 'Izaberi iz galerije' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ label: 'Pošalji promenu ponovo' })).toHaveLength(0);
  await act(async () => action('Proveri sačuvanu fotografiju').onPress());
  expect(mockJournal.get(journalKey)).toBe(stored); expect(mockDiscard).toHaveBeenCalledTimes(1);
  await act(async () => action('Pošalji promenu ponovo').onPress());
  expect(mockDiscard.mock.calls[1][0]).toEqual(mockDiscard.mock.calls[0][0]);
  expect(mockJournal.size).toBe(0); expect(mockUpload).toHaveBeenCalledTimes(1); expect(mockApply).not.toHaveBeenCalled(); expect(mockClear).not.toHaveBeenCalled();
});
it('restores a pending discard in its profile journal without another upload or automatic discard', async () => {
  const stored = JSON.stringify({ phase: 'DISCARD', requestId: REQUEST, assetId: ASSET, expectedPath: null });
  mockJournal.set(journalKey, stored); await render();
  expect(mockJournal.get(journalKey)).toBe(stored); expect(mockDiscard).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
  await act(async () => action('Pošalji promenu ponovo').onPress());
  expect(mockDiscard.mock.calls).toEqual([[{ assetId: ASSET, profileId: PROFILE }]]); expect(mockJournal.size).toBe(0);
});
it('does not send pixels when opaque intent persistence fails', async () => {
  mockSet.mockRejectedValue(new Error('unavailable')); await render();
  await act(async () => action('Izaberi iz galerije').onPress()); expect(mockUpload).not.toHaveBeenCalled(); expect(mockApply).not.toHaveBeenCalled();
});
it('clears a completed apply intent but renders newer current state without replaying the old picture', async () => {
  const newer = `${OWNER}/newer.jpg`;
  mockJournal.set(journalKey, JSON.stringify({ phase: 'APPLY', requestId: REQUEST, assetId: ASSET, expectedPath: null }));
  mockRead.mockResolvedValue(ok(profile(newer))); mockApply.mockResolvedValue(ok({ profileId: PROFILE, accountId: OWNER, assetId: ASSET, avatarPath: ref, saved: true, authoritative: true }));
  await render(); await act(async () => action('Pošalji promenu ponovo').onPress());
  expect(mockJournal.size).toBe(0); expect(mockApply).toHaveBeenCalledTimes(1); expect(mockUpload).not.toHaveBeenCalled();
  expect(action('Izaberi iz galerije').disabled).toBe(false);
});

// 2026-09-24: removing the public photo asks first, in the app's own sheet; clear() keeps every guard and runs at confirm time.
it('asks before removing the profile photo and removes it only on the confirm', async () => {
  mockRead.mockResolvedValue(ok(profile(ref))); mockClear.mockResolvedValue(unknown()); await render();
  await act(async () => action('Ukloni fotografiju profila').onPress());
  expect(mockClear).not.toHaveBeenCalled(); expect(mockSet).not.toHaveBeenCalled();
  await act(async () => { tree.root.findByType(ConfirmSheet).findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress(); });
  expect(mockClear).toHaveBeenCalledTimes(1); expect(mockClear).toHaveBeenCalledWith({ profileId: PROFILE, expectedAvatarPath: ref });
});
it('a cancelled removal writes nothing', async () => {
  mockRead.mockResolvedValue(ok(profile(ref))); await render();
  await act(async () => action('Ukloni fotografiju profila').onPress());
  await act(async () => { tree.root.findByType(ConfirmSheet).findByProps({ testID: 'confirm-sheet-cancel' }).props.onPress(); });
  expect(mockClear).not.toHaveBeenCalled(); expect(mockSet).not.toHaveBeenCalled(); expect(mockJournal.size).toBe(0);
});
// Review of step 9 (2026-09-24): the denial used to settle as a failed command, which hid the gallery the message names and
// left only a read. Nothing was written, so it now keeps the choice open; the test asserted only the settings button.
it('a denied camera leads to the phone settings and keeps the gallery it names one tap away', async () => {
  mockPick.mockRejectedValueOnce(new Error('denied')); mockSelectionMessage = mockPermission; await render();
  await act(async () => action('Fotografiši').onPress());
  expect(tree.root.findAllByProps({ label: 'Podešavanja telefona' }).length).toBeGreaterThan(0);
  expect(action('Izaberi iz galerije').disabled).toBe(false); expect(action('Fotografiši').disabled).toBe(false);
  expect(tree.root.findAllByProps({ label: 'Proveri sačuvanu fotografiju' })).toHaveLength(0);
  expect(mockUpload).not.toHaveBeenCalled(); expect(mockSet).not.toHaveBeenCalled(); expect(mockRead).toHaveBeenCalledTimes(1);
  // The gallery works at once, without a read in between, and the message goes with the new choice.
  await act(async () => action('Izaberi iz galerije').onPress());
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByProps({ label: 'Podešavanja telefona' })).toHaveLength(0);
});
it('a picture over the size limit says so and keeps both ways to choose another', async () => {
  mockPick.mockRejectedValueOnce(new Error('size')); mockSelectionMessage = 'Izaberi fotografiju do 10 MB.'; await render();
  await act(async () => action('Izaberi iz galerije').onPress());
  expect(dump()).toContain('Izaberi fotografiju do 10 MB.');
  expect(tree.root.findAllByProps({ label: 'Podešavanja telefona' })).toHaveLength(0);
  expect(action('Izaberi iz galerije').disabled).toBe(false); expect(action('Fotografiši').disabled).toBe(false);
  expect(mockUpload).not.toHaveBeenCalled(); expect(mockSet).not.toHaveBeenCalled();
});
it('while a chosen picture is sent the screen says so, and never shows it as an unknown outcome', async () => {
  let finish!: (value: unknown) => void;
  mockUpload.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render();
  await act(async () => { void action('Izaberi iz galerije').onPress(); });
  expect(mockJournal.size).toBe(1); expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(action('Izaberi iz galerije').loading).toBe(true);
  expect(tree.root.findAllByProps({ label: 'Proveri sačuvanu fotografiju' })).toHaveLength(0);
  expect(dump()).toContain('Šaljemo fotografiju…');
  await act(async () => finish(ok(asset())));
  expect(action('Sačuvaj fotografiju').disabled).toBe(false);
  // The staged picture carries an element as a prop, so the words are read from the text nodes, not a JSON of the tree.
  const words = tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string'));
  expect(words).toContain('Još nije sačuvana'); expect(words).not.toContain('Šaljemo fotografiju…');
});
// Round 5c: every refusal on the phone stays in the choice, so the read after a refused command is a real check, and its
// button says the check the error above it asks for (it used to say "Nazad na izbor fotografije").
it('a refusal of a command that sent nothing asks for the check its error names, and the check brings the choice back', async () => {
  mockSet.mockRejectedValue(new Error('unavailable')); await render();
  await act(async () => action('Izaberi iz galerije').onPress());
  expect(mockUpload).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ label: 'Izaberi iz galerije' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ label: 'Nazad na izbor fotografije' })).toHaveLength(0);
  await act(async () => action('Proveri sačuvanu fotografiju').onPress());
  expect(mockRead).toHaveBeenCalledTimes(2); expect(action('Izaberi iz galerije').disabled).toBe(false);
});
// Round 5c: the retried upload resets the read flag while it is in flight; the pressed retry keeps its spinner instead of
// turning into a grey check that gives no reason.
it('a retried upload keeps its own button and spinner while it is sent', async () => {
  mockReceipt.mockResolvedValue(ok({ ...asset(), state: 'STAGED', ref: null }));
  await render(); await act(async () => action('Izaberi iz galerije').onPress());
  expect(mockUpload).toHaveBeenCalledTimes(1); expect(action('Pošalji promenu ponovo').loading).toBe(false);
  let finish!: (value: unknown) => void;
  mockUpload.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { void action('Pošalji promenu ponovo').onPress(); });
  expect(mockUpload).toHaveBeenCalledTimes(2);
  expect(action('Pošalji promenu ponovo').loading).toBe(true);
  expect(dump()).not.toContain('Proveri ishod pre novog izbora');
  await act(async () => finish(ok(asset())));
});
it('while a change is unresolved nothing new can be picked and the retry is the one filled action', async () => {
  mockJournal.set(journalKey, JSON.stringify({ phase: 'APPLY', requestId: REQUEST, assetId: ASSET, expectedPath: null }));
  await render();
  expect(tree.root.findAllByProps({ label: 'Izaberi iz galerije' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ label: 'Fotografiši' })).toHaveLength(0);
  const filled = tree.root.findAll(node => String(node.type) === 'Action' && (node.props.kind ?? 'primary') === 'primary').map(node => node.props.label);
  expect(filled).toEqual(['Pošalji promenu ponovo']);
});
// J13, owner's phone 8 Oct 2026: the face is a circle with the person's letters while the picture is on its way, and the explanation of the photo is
// behind the "ⓘ" in the bar, not a lock and a note under the buttons.
const who = (profileId: string) => ({ accountId: OWNER, profileId, kind: 'REQUESTER', ime: 'Ana Petrović', grad: null, stanje: 'ACTIVE' });
it("puts the letters of this profile's name in the circle when there is no picture, and the explanation behind the bar's ⓘ", async () => {
  mockWho.mockResolvedValue(who(PROFILE)); await render();
  expect(tree.root.findAll(node => String(node.type) === 'T' && node.children.includes('AP')).length).toBeGreaterThan(0);
  const info = tree.root.findByType('Screen' as never).props.right;
  expect(info.props.info).toEqual(['Najviše 10 MB.', 'Pre slanja uklanjamo podatke o mestu i vremenu snimanja.']);
  expect(dump()).not.toContain('Do 10 MB');
});
it("the letters of another profile's name are never lent to this circle", async () => {
  mockWho.mockResolvedValue(who('55555555-5555-4555-8555-555555555555')); await render();
  expect(tree.root.findAll(node => String(node.type) === 'T' && node.children.includes('AP'))).toHaveLength(0);
});
