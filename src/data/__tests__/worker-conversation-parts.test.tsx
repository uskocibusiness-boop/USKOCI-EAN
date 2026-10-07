import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The worker-profile conversation and its review, as parts (T4b1, 2026-10-07).
 *
 * M1: the title is "Radni profil", the latest question is the large one (`questionFocus`), and the "+" of the composer
 * opens the parts of the profile, each in its own editor. M2: every part of the review has "Izmeni"; it opens that part's
 * editor, and a change made there is followed by a FRESH review of the new proposal (one patch, one prepare, one read),
 * and the person lands on it. Back from such an editor returns to the review, not to the conversation. The guards of the
 * conversation itself are tested in worker-ai-conversation-recovery.test.tsx and are not repeated here.
 */
const mockAccount = '11111111-1111-4111-8111-111111111111', mockProfile = '22222222-2222-4222-8222-222222222222', mockConversation = '33333333-3333-4333-8333-333333333333';
const A = mockAccount, B = mockProfile, C = mockConversation;
const mockListeners = new Set<(s: string) => void>();
const mockApi = { read: jest.fn(), open: jest.fn(), send: jest.fn(), recoverTurn: jest.fn(), cancelTurn: jest.fn(), patch: jest.fn(), prepare: jest.fn(), save: jest.fn(), abandon: jest.fn() };
const mockJournal = { load: jest.fn(), save: jest.fn(), clear: jest.fn() };
const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(), setParams: jest.fn() };
const mockVoice = { controller: { cancel: jest.fn() }, state: { phase: 'IDLE' } };
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (['View', 'ScrollView', 'KeyboardAvoidingView', 'Switch', 'RefreshControl', 'TextInput'].includes(String(key))) return key;
  if (key === 'Platform') return { OS: 'android' };
  if (key === 'useWindowDimensions') return () => ({ width: 320, height: 640, scale: 2, fontScale: 1 });
  if (key === 'AppState') return { currentState: 'active', addEventListener: (_: string, fn: (s: string) => void) => { mockListeners.add(fn); return { remove: () => mockListeners.delete(fn) }; } };
  if (key === 'BackHandler') return { addEventListener: () => ({ remove: () => {} }) };
  return Reflect.get(target, key); } }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => ({ conversationId: mockConversation }),
  useFocusEffect: (fn: () => void) => require('react').useEffect(() => fn(), [fn]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: 1 }), sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: 1 }) }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
jest.mock('../workerAiClientService', () => ({ get workerAiClientService() { return mockApi; } }));
jest.mock('../workerAiTurnIntentJournal', () => ({ get workerAiTurnIntentJournal() { return mockJournal; } }));
jest.mock('../../features/voice/useHoldToTalk', () => ({ useHoldToTalk: () => mockVoice }));
jest.mock('../../ui/aiFirst/VoiceComposer', () => ({ VoiceComposer: 'VoiceComposer' }));
jest.mock('../../ui/aiFirst/AiConversationShell', () => ({ AiConversationShell: ({ actions, status, children, ...props }: any) =>
  require('react').createElement('Shell', props, status, actions, children) }));
jest.mock('../../ui/workerProfile/WorkerProfilePresentation', () => ({ WorkerProfileFrame: (props: any) =>
  require('react').createElement('Frame', props, props.children, props.footer), WorkerProfileStatus: 'Status' }));
jest.mock('../../ui/workerProfile/WorkerAiPresentation', () => ({ WorkerAiActivation: 'Activation', WorkerAiCard: 'Card', WorkerAiReviewDetails: 'Review',
  WorkerAiNotificationsNote: 'Note', WorkerAiManual: 'Manual' }));
jest.mock('../../ui/calendar/AvailabilityForm', () => ({ AvailabilityForm: 'Availability' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import Screen from '../../app/(app)/profil/razgovor';
import { ActionSheet } from '../../ui/system/ActionSheet';
import { Press } from '../../ui/Press';
import { brandAction } from '../../ui/system/tokens';
import { CalendarScreen } from '../../ui/calendar/CalendarControls';

const ok = (podatak: unknown) => ({ ok: true, podatak });
const availability = () => ({ timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [] });
const candidate = () => ({ displayName: 'Ana', bio: '', skills: ['Montaža'], tools: [], vehicles: [], licenses: [], teamCapacity: 1,
  location: { city: 'Novi Sad', operatingCountryCode: 'RS', radiusKm: 10, approximatePosition: null }, availability: availability() });
const snapshot = (revision = 0) => ({ schemaVersion: 'WORKER_PROFILE_V1', accountId: A, conversationId: C, profileId: B, status: 'OPEN', profileStatus: 'DRAFT',
  revision, candidate: candidate(), safety: 'ALLOW', stale: false, messages: [], turn: null, review: null, saved: null });
const reviewed = (revision = 0, activate = true) => ({ ...snapshot(revision), review: { reviewId: '44444444-4444-4444-8444-444444444444', revision,
  expiresAt: new Date(Date.now() + 60000).toISOString(), canAccept: true, activate } });

let tree: ReactTestRenderer;
const shell = () => tree.root.findByType('Shell' as never);
const frame = () => tree.root.findByType('Frame' as never);
const review = () => tree.root.findByType('Review' as never);
const manual = () => tree.root.findByType('Manual' as never);
const action = (label: string) => tree.root.findByProps({ label });
/** The rows of an open menu, once each (a Press is several nodes in the tree). */
const menuRows = () => tree.root.findAllByType(Press).filter(node => node.props.accessibilityRole === 'menuitem');
const menuRow = (label: string) => menuRows().find(node => node.props.accessibilityLabel === label)!;
const render = async () => { await act(async () => { tree = create(<Screen />); }); };
const click = async (label: string) => { await act(async () => { action(label).props.onPress(); }); };
const openReview = async () => {
  mockApi.prepare.mockResolvedValue(ok({})); mockApi.read.mockResolvedValue(ok(reviewed()));
  await act(async () => { shell().props.card(false).props.review(); });
};
beforeEach(() => {
  jest.clearAllMocks(); mockRouter.canGoBack.mockReturnValue(true);
  mockJournal.load.mockResolvedValue(null); mockJournal.save.mockResolvedValue(undefined); mockJournal.clear.mockResolvedValue(undefined);
  mockApi.read.mockResolvedValue(ok(snapshot())); mockApi.open.mockResolvedValue(ok(snapshot()));
  mockApi.recoverTurn.mockResolvedValue(ok({}));
});
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the conversation (M1)', () => {
  it('is titled "Radni profil", puts the latest question first, and offers the "+" for the parts', async () => {
    await render();
    expect(shell().props.title).toBe('Radni profil'); expect(shell().props.questionFocus).toBe(true);
    expect(shell().props.attach).toMatchObject({ label: 'Dodaj podatke', disabled: false });
    expect(shell().props.attach.hint).toBe('Veštine, područje, vreme, alat i vozilo.');
  });

  it('draws no "+" when the conversation cannot take anything more', async () => {
    mockApi.read.mockResolvedValue(ok({ ...snapshot(), status: 'COMPLETED' }));
    await render();
    expect(shell().props.attach).toBeUndefined();
  });

  it('the "+" lists the four parts, each opening its own editor and writing only through "Primeni"', async () => {
    await render();
    await act(async () => { shell().props.attach.onPress(); });
    expect(menuRows().map(row => row.props.accessibilityLabel)).toEqual(['Veštine', 'Područje rada', 'Kada imaš vremena', 'Alat i vozilo']);
    await act(async () => { menuRow('Veštine').props.onPress(); });
    expect(tree.root.findAllByType(ActionSheet)).toHaveLength(0);
    expect(manual().props.only).toBe('skills'); expect(frame().props.title).toBe('Veštine');
    expect(mockApi.patch).not.toHaveBeenCalled();
  });

  it('a part opened from the "+" applies one patch and returns to the conversation, without a review', async () => {
    await render();
    await act(async () => { shell().props.attach.onPress(); });
    await act(async () => { menuRow('Alat i vozilo').props.onPress(); });
    expect(manual().props.only).toBe('tools');
    mockApi.patch.mockResolvedValue(ok(snapshot(1)));
    await act(async () => { manual().props.apply({ tools: ['Bušilica'], vehicles: [] }); });
    expect(mockApi.patch).toHaveBeenCalledWith(C, 0, { tools: ['Bušilica'], vehicles: [] });
    expect(mockApi.prepare).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('Manual' as never)).toHaveLength(0); expect(shell()).toBeTruthy();
  });

  it('"Kada imaš vremena" opens the week, not a list', async () => {
    await render();
    await act(async () => { shell().props.attach.onPress(); });
    await act(async () => { menuRow('Kada imaš vremena').props.onPress(); });
    expect(tree.root.findByType(CalendarScreen).props.title).toBe('Dostupnost za rad');
    expect(tree.root.findAllByType('Manual' as never)).toHaveLength(0);
  });

  it('"···" still opens the whole manual form and the week, with no part', async () => {
    await render();
    await act(async () => { shell().props.onOptions(); });
    await act(async () => { menuRow('Ručno uredi podatke').props.onPress(); });
    expect(manual().props.only).toBeUndefined(); expect(frame().props.title).toBeUndefined();
  });
});

describe('the review (M2)', () => {
  it('is titled "Tvoj radni profil", with the green save and "Nazad na razgovor" under it', async () => {
    await render(); await openReview();
    expect(frame().props.title).toBe('Tvoj radni profil');
    expect(action('Sačuvaj i aktiviraj profil').props.style).toBe(brandAction);
    expect(action('Nazad na razgovor').props.onPress).toBeInstanceOf(Function);
    expect(tree.root.findAllByProps({ label: 'Ručno uredi podatke' })).toHaveLength(0);
    expect(tree.root.findAllByType('Note' as never)).toHaveLength(1);
    await click('Nazad na razgovor');
    expect(tree.root.findAllByType('Review' as never)).toHaveLength(0); expect(shell()).toBeTruthy();
  });

  it('"Izmeni" at a part opens that part\'s editor; Back from it returns to the SAME review', async () => {
    await render(); await openReview();
    expect(typeof review().props.onEdit).toBe('function'); expect(review().props.editDisabled).toBe(false);
    await act(async () => { review().props.onEdit('skills'); });
    expect(manual().props.only).toBe('skills'); expect(frame().props.title).toBe('Veštine');
    await act(async () => { frame().props.back(); });
    expect(tree.root.findAllByType('Manual' as never)).toHaveLength(0); expect(review()).toBeTruthy();
    expect(mockApi.patch).not.toHaveBeenCalled(); expect(mockApi.prepare).toHaveBeenCalledTimes(1);
  });

  it('a change made from the review is followed by one fresh review of the new proposal, and lands on it', async () => {
    await render(); await openReview();
    mockApi.prepare.mockClear();
    await act(async () => { review().props.onEdit('area'); });
    expect(manual().props.only).toBe('area'); expect(frame().props.title).toBe('Područje');
    mockApi.patch.mockResolvedValue(ok(snapshot(1)));
    mockApi.read.mockResolvedValue(ok(reviewed(1)));
    await act(async () => { manual().props.apply({ location: { city: 'Zemun', operatingCountryCode: 'RS', radiusKm: 25 } }); });
    expect(mockApi.patch).toHaveBeenCalledTimes(1);
    expect(mockApi.patch).toHaveBeenCalledWith(C, 0, { location: { city: 'Zemun', operatingCountryCode: 'RS', radiusKm: 25 } });
    // The review is prepared for the NEW revision, with the activation the person had chosen, and read back before it is shown.
    expect(mockApi.prepare).toHaveBeenCalledTimes(1); expect(mockApi.prepare).toHaveBeenCalledWith(C, 1, true);
    expect(mockApi.patch.mock.invocationCallOrder[0]).toBeLessThan(mockApi.prepare.mock.invocationCallOrder[0]);
    expect(tree.root.findAllByType('Manual' as never)).toHaveLength(0); expect(review().props.review.revision).toBe(1);
    expect(frame().props.title).toBe('Tvoj radni profil');
  });

  it('the week changed from the review comes back to the review the same way', async () => {
    await render(); await openReview();
    mockApi.prepare.mockClear();
    await act(async () => { review().props.onEdit('time'); });
    expect(tree.root.findByType(CalendarScreen).props.title).toBe('Dostupnost za rad');
    mockApi.patch.mockResolvedValue(ok(snapshot(1))); mockApi.read.mockResolvedValue(ok(reviewed(1)));
    await act(async () => { tree.root.findByType('Availability' as never).props.onSave({ ...availability(), availableNow: true }); });
    expect(mockApi.patch).toHaveBeenCalledTimes(1); expect(mockApi.prepare).toHaveBeenCalledWith(C, 1, true);
    expect(review()).toBeTruthy();
  });

  it('keeps the activation the person chose when the profile is still a draft', async () => {
    mockApi.prepare.mockResolvedValue(ok({})); mockApi.read.mockResolvedValue(ok(reviewed(0, false)));
    await render(); await act(async () => { shell().props.card(false).props.review(); });
    mockApi.prepare.mockClear();
    await act(async () => { review().props.onEdit('identity'); });
    mockApi.patch.mockResolvedValue(ok(snapshot(1))); mockApi.read.mockResolvedValue(ok(reviewed(1, false)));
    await act(async () => { manual().props.apply({ displayName: 'Ana P.', bio: '' }); });
    expect(mockApi.prepare).toHaveBeenCalledWith(C, 1, false);
  });

  it('a patch that is refused or unconfirmed prepares nothing and keeps the editor with its error', async () => {
    await render(); await openReview();
    mockApi.prepare.mockClear();
    await act(async () => { review().props.onEdit('tools'); });
    mockApi.patch.mockResolvedValue({ ok: false, kod: 'UNKNOWN', poruka: 'Ishod nije potvrđen.' });
    await act(async () => { manual().props.apply({ tools: ['Bušilica'], vehicles: [] }); });
    expect(mockApi.prepare).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('Manual' as never)).toHaveLength(1);
    expect(tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children).join(' ')).toContain('Ishod nije potvrđen.');
  });

  it('a review that has expired cannot be edited: it is read again first', async () => {
    const stale = { ...reviewed(), review: { ...reviewed().review, expiresAt: new Date(Date.now() - 1000).toISOString() } };
    mockApi.prepare.mockResolvedValue(ok({})); mockApi.read.mockResolvedValue(ok(stale));
    await render(); await act(async () => { shell().props.card(false).props.review(); });
    expect(review().props.editDisabled).toBe(true);
    await act(async () => { review().props.onEdit('skills'); });
    expect(tree.root.findAllByType('Manual' as never)).toHaveLength(0); expect(review()).toBeTruthy();
  });

  it('after the save there is nothing left to edit: the saved profile is the one green next step', async () => {
    await render(); await openReview();
    const saved = { ...reviewed(), status: 'COMPLETED', saved: { reviewId: '44444444-4444-4444-8444-444444444444', conversationId: C, accountId: A, profileId: B, profileStatus: 'ACTIVE', saved: true, authoritative: true } };
    mockApi.save.mockResolvedValue(ok({})); mockApi.read.mockResolvedValue(ok(saved));
    await click('Sačuvaj i aktiviraj profil');
    expect(mockApi.save).toHaveBeenCalledTimes(1);
    expect(review().props.onEdit).toBeUndefined();
    expect(action('Otvori sačuvani profil').props.style).toBe(brandAction);
    expect(tree.root.findAllByProps({ label: 'Nazad na razgovor' })).toHaveLength(0);
  });
});
