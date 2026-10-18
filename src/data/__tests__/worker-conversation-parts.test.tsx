import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { rememberAiCorrection } from '../aiCorrectionIntent';

/**
 * All normal edits select a topic in the same conversation without sending or
 * patching. Legacy editor cases below simulate an already-open panel solely to
 * preserve its existing recovery contract; they are not a new navigation path.
 */
const mockAccount = '11111111-1111-4111-8111-111111111111', mockProfile = '22222222-2222-4222-8222-222222222222', mockConversation = '33333333-3333-4333-8333-333333333333';
const A = mockAccount, B = mockProfile, C = mockConversation;
let mockRouteId = C;
let mockCorrection: string | undefined, mockFocused=true;
let mockRestoreLegacyPanel: ((panel: 'manual' | 'availability') => void) | null = null;
jest.mock('react', () => {
  const React = jest.requireActual('react');
  return { ...React, useState: (initial: unknown) => {
    const state = React.useState(initial);
    if (initial === 'chat') mockRestoreLegacyPanel = state[1];
    return state;
  } };
});
const mockListeners = new Set<(s: string) => void>();
const mockApi = { read: jest.fn(), open: jest.fn(), send: jest.fn(), recoverTurn: jest.fn(), cancelTurn: jest.fn(), patch: jest.fn(), prepare: jest.fn(), save: jest.fn(), abandon: jest.fn() };
const mockJournal = { load: jest.fn(), save: jest.fn(), clear: jest.fn() };
const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(), setParams: jest.fn(), push: jest.fn() };
// ONE NAME (owner, 8 Oct 2026): the profile is saved under the ACCOUNT's name; the hook is mocked (the real one reads the server). No name by default.
let mockAccountName: { state: 'loading' } | { state: 'error'; retry: () => void } | { state: 'ready'; name: string | null } = { state: 'ready', name: null };
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
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => ({ conversationId: mockRouteId,aiCorrection:mockCorrection }),
  useFocusEffect: (fn: () => void) => require('react').useEffect(() => mockFocused?fn():undefined, [fn,mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: 1 }), sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: 1 }) }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
jest.mock('../../ui/profile/useAccountName', () => ({ useAccountName: () => mockAccountName }));
jest.mock('../workerAiClientService', () => ({ get workerAiClientService() { return mockApi; },
  explicitWorkerModes: jest.requireActual('../workerAiClientService').explicitWorkerModes,
  workerExplicitModeReviewEnabled: () => false }));
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

const ok = (podatak: unknown) => ({ ok: true, podatak });
const availability = () => ({ timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [] });
const candidate = () => ({ displayName: 'Ana', bio: '', skills: ['Montaža'], tools: [], vehicles: [], licenses: [], teamCapacity: 1,
  location: { city: 'Novi Sad', operatingCountryCode: 'RS', radiusKm: 10, approximatePosition: null }, availability: availability() });
const snapshot = (revision = 0) => ({ schemaVersion: 'WORKER_PROFILE_V1', accountId: A, conversationId: C, profileId: B, status: 'OPEN', profileStatus: 'DRAFT',
  revision, candidate: candidate(), safety: 'ALLOW', stale: false, messages: [], turn: null, review: null, saved: null });
const reviewed = (revision = 0, activate = true) => ({ ...snapshot(revision), review: { reviewId: '44444444-4444-4444-8444-444444444444', revision,
  expiresAt: new Date(Date.now() + 60000).toISOString(), canAccept: true, activate, missingRequired: [], profile: candidate() } });

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
const restoreLegacyManual = async () => { await act(async () => { mockRestoreLegacyPanel!('manual'); }); };
const click = async (label: string) => { await act(async () => { action(label).props.onPress(); }); };
const openReview = async () => {
  mockApi.prepare.mockResolvedValue(ok({})); mockApi.read.mockResolvedValue(ok(reviewed()));
  await act(async () => { shell().props.card(false).props.review(); });
};
beforeEach(() => {
  jest.clearAllMocks(); mockRouteId = C; mockRouter.canGoBack.mockReturnValue(true); mockAccountName = { state: 'ready', name: null };
  mockCorrection=undefined;mockFocused=true;mockRestoreLegacyPanel=null;
  mockJournal.load.mockResolvedValue(null); mockJournal.save.mockResolvedValue(undefined); mockJournal.clear.mockResolvedValue(undefined);
  mockApi.read.mockResolvedValue(ok(snapshot())); mockApi.open.mockResolvedValue(ok(snapshot()));
  mockApi.recoverTurn.mockResolvedValue(ok({}));
});
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the conversation (M1)', () => {
  it('consumes a new saved-profile topic on refocus of the same route, preserving unsent text',async()=>{
    await render();await act(async()=>shell().props.onChange('Moj neposlati odgovor'));
    mockFocused=false;await act(async()=>tree.update(<Screen/>));
    mockCorrection=rememberAiCorrection({accountId:A,accountRevision:1},'worker.identity')!.token;
    await act(async()=>tree.update(<Screen/>));
    mockFocused=true;await act(async()=>tree.update(<Screen/>));
    expect(shell().props.correction.target).toBe('worker.identity');expect(shell().props.value).toBe('Moj neposlati odgovor');
    expect(shell().props.conversationKey).toBe(C);expect(mockApi.open).not.toHaveBeenCalled();expect(mockApi.send).not.toHaveBeenCalled();
  });
  it('is titled "Radni profil", puts the latest question first, and offers the "+" for the parts', async () => {
    await render();
    expect(shell().props.title).toBe('Radni profil'); expect(shell().props.questionFocus).toBe(true);
    expect(shell().props.attach).toMatchObject({ label: 'Šta želiš da izmeniš?', disabled: false });
    expect(shell().props.attach.hint).toBe('Izaberi temu i nastavi isti razgovor.');
  });

  it('draws no "+" when the conversation cannot take anything more', async () => {
    mockApi.read.mockResolvedValue(ok({ ...snapshot(), status: 'COMPLETED' }));
    await render();
    expect(shell().props.attach).toBeUndefined();
  });

  it('the "+" selects a conversation topic without modifying or sending a draft', async () => {
    await render();
    await act(async () => shell().props.onChange('Moj nezavršen odgovor'));
    await act(async () => { shell().props.attach.onPress(); });
    expect(menuRows().map(row => row.props.accessibilityLabel)).toEqual(['Usluge koje nudiš', 'Područje rada', 'Kada imaš vremena', 'Alat i vozilo']);
    await act(async () => { menuRow('Usluge koje nudiš').props.onPress(); });
    expect(tree.root.findAllByType(ActionSheet)).toHaveLength(0);
    expect(shell().props.correction.target).toBe('worker.skills');
    expect(shell().props.value).toBe('Moj nezavršen odgovor');
    expect(tree.root.findAllByType('Manual' as never)).toHaveLength(0);
    expect(mockApi.patch).not.toHaveBeenCalled(); expect(mockApi.send).not.toHaveBeenCalled();
  });

  it('equipment is an optional topic and dismissing it preserves the unsent message', async () => {
    await render();
    await act(async () => { shell().props.attach.onPress(); });
    await act(async () => { menuRow('Alat i vozilo').props.onPress(); });
    expect(shell().props.correction.target).toBe('worker.tools');
    await act(async () => shell().props.onChange('Imam bušilicu.'));
    await act(async () => shell().props.correction.onDismiss());
    expect(shell().props.correction).toBeUndefined(); expect(shell().props.value).toBe('Imam bušilicu.');
    expect(mockApi.patch).not.toHaveBeenCalled(); expect(mockApi.send).not.toHaveBeenCalled();
    expect(mockApi.prepare).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('Manual' as never)).toHaveLength(0); expect(shell()).toBeTruthy();
  });

  it('"Kada imaš vremena" opens a topic in the same conversation', async () => {
    await render();
    await act(async () => { shell().props.attach.onPress(); });
    await act(async () => { menuRow('Kada imaš vremena').props.onPress(); });
    expect(shell().props.correction.target).toBe('worker.time');
    expect(tree.root.findAllByType('Manual' as never)).toHaveLength(0);
  });

  it.each([['O meni', 'worker.identity'], ['Raspored i dostupnost', 'worker.time']] as const)(
    '"···" selects %s in the same conversation without overwriting or sending the draft', async (label, target) => {
    await render();
    await act(async () => shell().props.onChange('Moj neposlati odgovor'));
    await act(async () => { shell().props.onOptions(); });
    expect(menuRows().map(row => row.props.accessibilityLabel)).toEqual(['O meni', 'Raspored i dostupnost']);
    await act(async () => { menuRow(label).props.onPress({ nativeEvent: {} }); });
    expect(shell().props.correction.target).toBe(target);
    expect(shell().props.conversationKey).toBe(C);
    expect(shell().props.value).toBe('Moj neposlati odgovor');
    expect(tree.root.findAllByType(ActionSheet)).toHaveLength(0);
    expect(tree.root.findAllByType('Manual' as never)).toHaveLength(0);
    expect(tree.root.findAllByType('Availability' as never)).toHaveLength(0);
    expect(mockApi.patch).not.toHaveBeenCalled(); expect(mockApi.send).not.toHaveBeenCalled();
    expect(mockApi.open).not.toHaveBeenCalled(); expect(mockApi.prepare).not.toHaveBeenCalled();
  });

  it.each(['O meni', 'Raspored i dostupnost'])(
    'rejects a retained %s menu action after leaving and refocusing', async label => {
    await render();
    await act(async () => shell().props.onChange('Sačuvaj moj neposlati tekst'));
    await act(async () => shell().props.onOptions());
    const retained = tree.root.findByType(ActionSheet).props.actions.find((item: { label: string }) => item.label === label).onPress;
    await act(async () => { mockFocused = false; tree.update(<Screen />); });
    await act(async () => { mockFocused = true; tree.update(<Screen />); });
    await act(async () => retained());
    expect(shell().props.correction).toBeUndefined();
    expect(shell().props.value).toBe('Sačuvaj moj neposlati tekst');
    expect(mockApi.send).not.toHaveBeenCalled(); expect(mockApi.patch).not.toHaveBeenCalled();
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

  it('"Izmeni" returns to the same conversation and preserves its unsent draft', async () => {
    await render(); await act(async () => shell().props.onChange('Nezavršen odgovor')); await openReview();
    expect(typeof review().props.onEdit).toBe('function'); expect(review().props.editDisabled).toBe(false);
    await act(async () => { review().props.onEdit('skills'); });
    expect(shell().props.correction.target).toBe('worker.skills'); expect(shell().props.conversationKey).toBe(C);
    expect(shell().props.value).toBe('Nezavršen odgovor');
    expect(tree.root.findAllByType('Manual' as never)).toHaveLength(0);
    expect(mockApi.send).not.toHaveBeenCalled(); expect(mockApi.open).not.toHaveBeenCalled();
    expect(mockApi.patch).not.toHaveBeenCalled(); expect(mockApi.prepare).toHaveBeenCalledTimes(1);
  });

  it('an explicit AI correction is followed by a fresh review of its new revision', async () => {
    await render(); await openReview();
    mockApi.prepare.mockClear();
    await act(async () => { review().props.onEdit('area'); });
    expect(shell().props.correction.target).toBe('worker.area');
    mockApi.send.mockResolvedValue(ok({})); mockApi.read.mockResolvedValue(ok(snapshot(1)));
    await act(async () => shell().props.onChange('Radim u Zemunu i okolini do 25 km.'));
    await act(async () => shell().props.onSend());
    expect(mockApi.send).toHaveBeenCalledWith(C,'Radim u Zemunu i okolini do 25 km.',expect.any(String),expect.any(Object));
    expect(mockApi.patch).not.toHaveBeenCalled();
    mockApi.read.mockResolvedValue(ok(reviewed(1)));
    await act(async () => shell().props.card(false).props.review());
    // The review is prepared for the NEW revision, with the activation the person had chosen, and read back before it is shown.
    expect(mockApi.prepare).toHaveBeenCalledTimes(1); expect(mockApi.prepare).toHaveBeenCalledWith(C, 1, true);
    expect(mockApi.send.mock.invocationCallOrder[0]).toBeLessThan(mockApi.prepare.mock.invocationCallOrder[0]);
    expect(tree.root.findAllByType('Manual' as never)).toHaveLength(0); expect(review().props.review.revision).toBe(1);
    expect(frame().props.title).toBe('Tvoj radni profil');
  });

  it('time correction starts no calendar patch or provider request merely by selecting it', async () => {
    await render(); await openReview();
    mockApi.prepare.mockClear();
    await act(async () => { review().props.onEdit('time'); });
    expect(shell().props.correction.target).toBe('worker.time');
    expect(mockApi.patch).not.toHaveBeenCalled(); expect(mockApi.prepare).not.toHaveBeenCalled(); expect(mockApi.send).not.toHaveBeenCalled();
  });

  it('keeps the activation the person chose when the profile is still a draft', async () => {
    mockApi.prepare.mockResolvedValue(ok({})); mockApi.read.mockResolvedValue(ok(reviewed(0, false)));
    await render(); await act(async () => { shell().props.card(false).props.review(); });
    mockApi.prepare.mockClear();
    await act(async () => { review().props.onEdit('identity'); });
    mockApi.send.mockResolvedValue(ok({})); mockApi.read.mockResolvedValue(ok(snapshot(1)));
    await act(async () => shell().props.onChange('U opisu napiši da radim sa bratom.'));
    await act(async () => shell().props.onSend());
    mockApi.read.mockResolvedValue(ok(reviewed(1,false)));
    await act(async () => shell().props.card(false).props.review());
    expect(mockApi.prepare).toHaveBeenCalledWith(C, 1, false);
  });

  it('a patch that is refused or unconfirmed prepares nothing and keeps the editor with its error', async () => {
    await render(); await openReview();
    mockApi.prepare.mockClear();
    await act(async () => { review().props.onEdit('tools'); });
    await restoreLegacyManual();
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

// ONE NAME (owner, 8 Oct 2026, "Može, dobro vam jedno ime za sve."): the work profile is saved under the name of the ACCOUNT, whatever the assistant proposed or
// the profile carried. The assistant is not asked for it and the review has no row for it: the route puts the account's name into the proposal before the review is made.
describe('one name: the review is made under the account\'s name', () => {
  // The conversation is read as it stands (revision 0, the assistant's name "Ana"); what is read after the review is made is `after`.
  const open = async (after: unknown = reviewed()) => {
    await render(); mockApi.read.mockResolvedValue(ok(after));
    await act(async () => { shell().props.card(false).props.review(); });
  };

  it('patches the account\'s name into a proposal that carries another, then makes the same review for the revision that patch made', async () => {
    mockAccountName = { state: 'ready', name: 'Milos' };   // the proposal says "Ana"
    mockApi.patch.mockResolvedValue(ok(snapshot(1))); mockApi.prepare.mockResolvedValue(ok({}));
    await open(reviewed(1));
    expect(mockApi.patch).toHaveBeenCalledTimes(1); expect(mockApi.patch).toHaveBeenCalledWith(C, 0, { displayName: 'Milos' });
    expect(mockApi.prepare).toHaveBeenCalledTimes(1); expect(mockApi.prepare).toHaveBeenCalledWith(C, 1, true);
    expect(mockApi.patch.mock.invocationCallOrder[0]).toBeLessThan(mockApi.prepare.mock.invocationCallOrder[0]);
    expect(review()).toBeTruthy();
  });

  it('sends nothing extra when the proposal already carries the account\'s name', async () => {
    mockAccountName = { state: 'ready', name: 'Ana' };
    mockApi.prepare.mockResolvedValue(ok({}));
    await open();
    expect(mockApi.patch).not.toHaveBeenCalled(); expect(mockApi.prepare).toHaveBeenCalledWith(C, 0, true);
  });

  it.each([['an account with no name', { state: 'ready', name: null }], ['a name that could not be read', { state: 'error', retry: () => {} }],
    ['a name that is still being read', { state: 'loading' }]] as const)('makes the review as before for %s: nothing is patched, and no name is made up', async (_label, value) => {
    mockAccountName = value as typeof mockAccountName;
    mockApi.prepare.mockResolvedValue(ok({}));
    await open();
    expect(mockApi.patch).not.toHaveBeenCalled(); expect(mockApi.prepare).toHaveBeenCalledWith(C, 0, true);
  });

  it('a name patch that is refused or unconfirmed prepares nothing and opens no review', async () => {
    mockAccountName = { state: 'ready', name: 'Milos' };
    mockApi.patch.mockResolvedValue({ ok: false, kod: 'UNKNOWN', poruka: 'Ishod nije potvrđen.' });
    await open();
    expect(mockApi.prepare).not.toHaveBeenCalled(); expect(tree.root.findAllByType('Review' as never)).toHaveLength(0);
  });

  it('puts the account\'s name into any other change of the proposal too, while it carries another, and never over a name the patch itself carries', async () => {
    mockAccountName = { state: 'ready', name: 'Milos' };
    mockApi.patch.mockResolvedValue(ok(snapshot(1))); mockApi.prepare.mockResolvedValue(ok({}));
    await open();
    mockApi.patch.mockClear(); mockApi.prepare.mockClear();
    await act(async () => { review().props.onEdit('area'); });
    await restoreLegacyManual();
    mockApi.patch.mockResolvedValue(ok(snapshot(1))); mockApi.read.mockResolvedValue(ok(reviewed(1)));
    await act(async () => { manual().props.apply({ location: { city: 'Zemun', operatingCountryCode: 'RS', radiusKm: 25 } }); });
    expect(mockApi.patch).toHaveBeenCalledTimes(1);
    expect(mockApi.patch).toHaveBeenCalledWith(C, 0, { location: { city: 'Zemun', operatingCountryCode: 'RS', radiusKm: 25 }, displayName: 'Milos' });
    expect(mockApi.prepare).not.toHaveBeenCalled();
  });

  it('the review of an account that has no name at all says so and leads to the one place it is written', async () => {
    const lacking = { ...reviewed(), review: { ...reviewed().review, missingRequired: ['Ime'], canAccept: false } };
    mockApi.prepare.mockResolvedValue(ok({})); mockApi.read.mockResolvedValue(ok(lacking));
    await render(); await act(async () => { shell().props.card(false).props.review(); });
    expect(review().props.onAddName).toBeInstanceOf(Function);
    await act(async () => { review().props.onAddName(); });
    expect(mockRouter.push).toHaveBeenCalledWith('/profil/podaci'); expect(mockApi.patch).not.toHaveBeenCalled();
  });

  it('once the account has a name, the review that still lacks it is no longer valid: a fresh one puts the name in', async () => {
    const lacking = { ...reviewed(), review: { ...reviewed().review, missingRequired: ['Ime'], canAccept: false } };
    mockApi.prepare.mockResolvedValue(ok({})); mockApi.read.mockResolvedValue(ok(lacking));
    await render(); await act(async () => { shell().props.card(false).props.review(); });
    expect(review().props.editDisabled).toBe(false);
    mockAccountName = { state: 'ready', name: 'Milos' };   // added meanwhile, in "Lični podaci"
    await act(async () => tree.update(<Screen />));
    expect(review().props.editDisabled).toBe(true); expect(review().props.onAddName).toBeUndefined();
    mockApi.patch.mockResolvedValue(ok(snapshot(1))); mockApi.read.mockResolvedValue(ok(reviewed(1)));
    await click('Učitaj novi pregled');
    expect(mockApi.patch).toHaveBeenCalledWith(C, 0, { displayName: 'Milos' }); expect(mockApi.prepare).toHaveBeenLastCalledWith(C, 1, true);
    expect(review().props.review.missingRequired).toEqual([]);
  });
});


describe('activation choice belongs to the conversation', () => {
  const prepareFalse = async () => {
    mockApi.prepare.mockImplementation(async (_cid, revision, activate) => {
      mockApi.read.mockResolvedValue(ok(reviewed(revision, activate))); return ok({});
    });
    await render(); await act(async () => shell().props.card(false).props.review());
    await act(async () => tree.root.findByType('Activation' as never).props.change(false));
    expect(review().props.review.activate).toBe(false);
    await click('Nazad na razgovor'); mockApi.prepare.mockClear();
  };
  it('keeps an explicit draft choice on Back then review, without saving', async () => {
    await prepareFalse(); await act(async () => shell().props.card(false).props.review());
    expect(mockApi.prepare).toHaveBeenCalledWith(C, 0, false);
    expect(action('Sačuvaj profil')).toBeTruthy(); expect(mockApi.save).not.toHaveBeenCalled();
  });
  it('retains false when a candidate patch retires the frozen review', async () => {
    await prepareFalse();
    await act(async () => shell().props.attach.onPress());
    await act(async () => menuRow('Alat i vozilo').props.onPress());
    await restoreLegacyManual();
    mockApi.patch.mockResolvedValue(ok(snapshot(1)));
    await act(async () => manual().props.apply({ tools: ['Bušilica'], vehicles: [] }));
    await act(async () => shell().props.card(false).props.review());
    expect(mockApi.prepare).toHaveBeenCalledWith(C, 1, false);
    expect(mockApi.save).not.toHaveBeenCalled();
  });
  it('keeps the draft choice after a conversation turn retires the review', async () => {
    await prepareFalse();
    mockApi.send.mockResolvedValue(ok({})); mockApi.read.mockResolvedValue(ok(snapshot(1)));
    await act(async () => shell().props.onChange('Dodaj da radim vikendom.'));
    await act(async () => shell().props.onSend());
    expect(mockApi.send).toHaveBeenCalledTimes(1);
    await act(async () => shell().props.card(false).props.review());
    expect(mockApi.prepare).toHaveBeenCalledWith(C, 1, false); expect(mockApi.save).not.toHaveBeenCalled();
  });
  it('does not inherit false after leaving and opening a different conversation', async () => {
    await prepareFalse();
    const other = '55555555-5555-4555-8555-555555555555';
    mockApi.read.mockResolvedValue(ok({ ...snapshot(), conversationId: other }));
    mockApi.prepare.mockResolvedValue(ok({})); mockRouteId = other;
    await act(async () => tree.update(<Screen />));
    await act(async () => shell().props.card(false).props.review());
    expect(mockApi.prepare).toHaveBeenCalledWith(other, 0, true);
  });
});
