import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { aiTurnIntentJournal } from '../aiTurnIntentJournal';
import { readIntakeReviewReturn } from '../intakeReviewReturn';
jest.mock('@react-native-async-storage/async-storage', () => { const values = new Map<string, string>(); return { getItem: jest.fn(async (key: string) => values.get(key) ?? null), setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }), removeItem: jest.fn(async (key: string) => { values.delete(key); }), clear: jest.fn(async () => { values.clear(); }) }; });
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AiNeedV2Conversation } from '../../contracts/aiNeedV2';
import type { VoicePhase } from '../../features/voice/holdToTalk';
import { NEED_FACT_V2_DEFINITIONS, type NeedFactV2Key } from '../../contracts/needFactsV2';

let mockSession = { user: { id: 'aaaaaaaa-1111-4111-8111-111111111111' }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true;
let mockParams: { conversationId?: string | string[]; entryKey?: string | string[] } = {}, mockCounter = 0;
let mockReduced = false;
let mockVoicePhase: VoicePhase = 'IDLE';
let mockRealVoice = false;
let mockAppState = 'active';
const mockAppListeners = new Set<(state: string) => void>();
const mockPermission = jest.fn(), mockCapture = {
  start: jest.fn(), stopCapture: jest.fn(), finalize: jest.fn(), dispose: jest.fn(),
};
const mockCreateCapture = jest.fn();
jest.mock('../../features/voice/nativeSpeechAdapter', () => ({
  createNativeSpeechAdapter: () => ({ requestPermission: (...args: unknown[]) => mockPermission(...args),
    createCapture: (...args: unknown[]) => mockCreateCapture(...args) }),
}));
jest.mock('../supabaseClient', () => ({ supabaseKonfigurisan: () => false }));
const mockVoiceCancel = jest.fn(), mockVoiceOptions = jest.fn();
const mockCancel = jest.fn(), mockRecover = jest.fn();
const mockOpen = jest.fn(), mockLoad = jest.fn(), mockSend = jest.fn(), mockTurn = jest.fn(), mockAbandon = jest.fn();
const mockRouter = { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn(), push: jest.fn() };
jest.mock('../index', () => ({ aiNeedV2Izvor: { openConversation: (...args: unknown[]) => mockOpen(...args),
  loadConversation: (...args: unknown[]) => mockLoad(...args), sendMessage: (...args: unknown[]) => mockSend(...args),
  readTurn: (...args: unknown[]) => mockTurn(...args), recoverTurn: (...args: unknown[]) => mockRecover(...args), cancelTurn: (...args: unknown[]) => mockCancel(...args), abandonConversation: (...args: unknown[]) => mockAbandon(...args) } }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++mockCounter).padStart(12, '0')}` }));
jest.mock('../../features/voice/useHoldToTalk', () => ({ useHoldToTalk: (options: unknown) => {
  mockVoiceOptions(options);
  if (mockRealVoice) return jest.requireActual('../../features/voice/useHoldToTalk').useHoldToTalk(options);
  return { controller: { cancel: mockVoiceCancel, getSnapshot: () => ({ phase: mockVoicePhase }), subscribe: () => () => {} },
    state: { phase: mockVoicePhase } }; } }));
// The voice module has three parts since 2026-09-24 (the composer's microphone, its notice line and voice mode); the
// harness stands each in as a host element. Their own behaviour is in voice-composer-controls.test.tsx.
jest.mock('../../ui/aiFirst/VoiceComposer', () => ({ VoiceComposer: 'VoiceComposer', VoiceNotice: 'VoiceNotice', VoiceMode: 'VoiceMode', VoiceTranscript: 'VoiceTranscript',
  HOLD_HINT: 'Drži mikrofon dok govoriš, pa pusti da pošalješ.' }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'AppState') return { currentState: mockAppState, addEventListener: (_name: string, listener: (state: string) => void) => {
    mockAppListeners.add(listener); return { remove: () => mockAppListeners.delete(listener) };
  } };
  if (key === 'Keyboard') return { dismiss: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })) };
  // One setting, read the way the shell reads it now (useSystemReducedMotion: the startup snapshot, then the live OS value).
  // On a phone both come from the same switch; the harness makes them agree the same way.
  if (key === 'AccessibilityInfo') return { isReduceMotionEnabled: async () => mockReduced, addEventListener: () => ({ remove: () => undefined }) };
  if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 1, fontScale: 1 });
  return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
// The shell now reaches the sheet engine, which imports react-native-gesture-handler, and gesture-handler wraps one of its
// own views with `createAnimatedComponent` when it loads. The harness hands that component back unchanged.
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView', createAnimatedComponent: (component: unknown) => component },
  FadeIn: { duration: (duration: number) => ({ duration }) },
  // An entrance is a chain (`duration`, `easing`, `withInitialValues`), and its curve comes from Reanimated's own `Easing`.
  FadeInDown: { duration: (duration: number) => { const chain: Record<string, unknown> = { duration, easing: () => chain, withInitialValues: () => chain }; return chain; } },
  Easing: { bezier: () => (value: number) => value },
  useReducedMotion: () => mockReduced, useSharedValue: (value: number) => ({ value, get: () => value, set: (next: number) => { value = next; } }), cancelAnimation: jest.fn(),
  useAnimatedStyle: () => ({}), withDelay: (_d: number, value: unknown) => value,
  withRepeat: (value: unknown) => value, withTiming: (value: number) => value }));
// The options panel reads reduced motion from the one store (ui/system/motion) since 2026-09-24; the conversation shell
// still asks Reanimated, so both answer the same.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'SvgPath', Circle: 'SvgCircle', Ellipse: 'SvgEllipse', G: 'SvgGroup',
  Defs: 'SvgDefs', LinearGradient: 'SvgLinearGradient', Rect: 'SvgRect', Stop: 'SvgStop' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
// The point editor reaches the native map; the stand-in keeps its one contract that matters here: before confirmed
// points are thrown away it asks its own question (a ConfirmSheet it renders itself), and only the answer closes it.
jest.mock('../../ui/location/ConversationPointAsk', () => {
  const React = require('react');
  const { useConfirmSheet } = require('../../ui/system/ConfirmSheet');
  function PointAskStub(props: { conversationId: string; onClose: () => void; disabled?: boolean; onEditingChange?: (editing: boolean) => void }) {
    const confirmation = useConfirmSheet();
    return React.createElement(React.Fragment, null,
      React.createElement('PointAsk', props),
      React.createElement('Press', { accessibilityLabel: 'Kasnije', onPress: () => confirmation.ask({ title: 'Potvrđena tačka nije sačuvana',
        message: 'Ako sad izađeš, ova tačka se gubi.', cancelLabel: 'Nastavi potvrđivanje', confirmLabel: 'Izađi ipak', tone: 'danger',
        onConfirm: props.onClose }) }),
      confirmation.sheet);
  }
  return { __esModule: true, default: PointAskStub, ConversationPointAsk: PointAskStub };
});
// The conversation loads the point editor with React.lazy (a dynamic import, which Jest runs only with
// --experimental-vm-modules). It is the only lazy part of this screen, so the harness hands lazy the stand-in above.
jest.mock('react', () => ({ ...jest.requireActual('react'), lazy: () => require('../../ui/location/ConversationPointAsk').default }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
// Rule R5 (haptics are outcomes): the screen asks `ui/system/haptics` for an "error" tick when a command fails; the harness counts the asks.
const mockTick = jest.fn();
jest.mock('../../ui/system/haptics', () => ({ tick: (...a: unknown[]) => mockTick(...a), forgetTicks: jest.fn() }));
// The draft's photos (the "+" of the conversation): the task photo service and the picker stand in; the journal is the
// AsyncStorage map above.
const mockReadPhotos = jest.fn(), mockReadUpload = jest.fn(), mockUploadPhoto = jest.fn(), mockRemovePhoto = jest.fn(), mockPickPhotos = jest.fn();
jest.mock('../mediaClientService', () => ({ mediaClientService: { readTaskPhotos: (...a: unknown[]) => mockReadPhotos(...a),
  readUploadCommand: (...a: unknown[]) => mockReadUpload(...a), uploadTaskPhoto: (...a: unknown[]) => mockUploadPhoto(...a),
  removeTaskPhoto: (...a: unknown[]) => mockRemovePhoto(...a), cancelUploadCommand: jest.fn() } }));
jest.mock('../../features/media/nativePhotoPicker', () => ({ pickPreparedPhotos: (...a: unknown[]) => mockPickPhotos(...a),
  photoSelectionMessage: () => 'Fotografija nije pripremljena.', photoSelectionSkipped: () => '' }));
jest.mock('expo-image', () => ({ Image: 'NativeImage' }));
import Intake from '../../app/(app)/nova';
import { PhotoAttachSheet } from '../../ui/media/PhotoAttachSheet';
import { PhotoViewer } from '../../ui/media/PhotoViewer';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';
import { ActionSheet } from '../../ui/system/ActionSheet';
import BottomSheet from '@gorhom/bottom-sheet';
import { ProductSheet } from '../../ui/product/ProductSheet';
import { AiConversationShell } from '../../ui/aiFirst/AiConversationShell';
import { TASK_OPENINGS } from '../../ui/v2/IntakePresentation';
import { intakeLocationMemory } from '../../ui/v2/intakeLocationOrder';

beforeEach(() => { intakeLocationMemory('between-tests'); });

const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', other = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ok = <T,>(podatak: T) => ({ ok: true as const, podatak });
const unknown = () => ({ ok: false, kod: 'AI_TURN_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
function conversation(patch: Partial<AiNeedV2Conversation> = {}): AiNeedV2Conversation {
  return { conversationId: id, schemaVersion: 'NEED_FACT_V2', status: 'OPEN', messages: [], facts: [], safety: 'ALLOW',
    review: { conversationId: id, schemaVersion: 'NEED_FACT_V2', boundNeedId: null, canSaveDraft: false, missingRequired: [], facts: [] }, ...patch };
}
function publicFact(key: NeedFactV2Key, value: unknown): AiNeedV2Conversation['facts'][number] {
  const definition = NEED_FACT_V2_DEFINITIONS[key];
  return { id: key, key, value, displayValue: 'public display', valueType: definition.valueType, privacyClass: 'PUBLIC',
    requiredForDraft: definition.requiredForDraft, status: 'CONFIRMED', source: 'EXPLICIT_USER_ANSWER', evidence: null };
}
function completeFacts(title = 'Prenos ormara'): AiNeedV2Conversation['facts'] {
  return [publicFact('need.title', title), publicFact('need.description', 'Prevod kratkog uputstva.'), publicFact('need.category', 'Prevod'),
    publicFact('need.price_mode', 'OFFERS'), publicFact('need.people_needed', 1), publicFact('need.schedule_kind', 'WEEK_FLEXIBLE'),
    publicFact('need.task_country_code', 'RS'), publicFact('need.task_geography', { mode: 'REMOTE' })];
}
const noSummary = () => expect(tree.root.findAllByProps({ testID: 'intake-task-summary' })).toHaveLength(0);
it('shows one complete proposed task at the end, before explicit review confirmation', async () => {
  const facts = completeFacts().map(f => ({ ...f, status: 'NEEDS_CONFIRMATION' as const }));
  const data = conversation({ facts }); data.review.missingRequired = facts.map(f => f.key);
  mockLoad.mockResolvedValue(data); await resume();
  expect(tree.root.findAllByProps({ testID: 'ai-pinned-card' })).toHaveLength(0);
  expect(tree.root.findByProps({ testID: 'ai-end-card' }).findAll(node => typeof node.type === 'string' && node.props.testID === 'intake-task-summary')).toHaveLength(1);
  expect(data.review.canSaveDraft).toBe(false);
  expect(mockSend).not.toHaveBeenCalled();
});
it.each([
  ['amount missing', { 'need.price_mode': 'MY_PRICE' }, false],
  ['retired price mode', { 'need.price_mode': 'FASTEST' }, false],
  ['single person price', { 'need.price_mode': 'MY_PRICE', 'need.price_rsd': 3000 }, true],
  ['group basis missing', { 'need.price_mode': 'MY_PRICE', 'need.price_rsd': 3000, 'need.people_needed': 2 }, false],
  ['group price complete', { 'need.price_mode': 'MY_PRICE', 'need.price_rsd': 3000, 'need.people_needed': 2, 'need.price_basis': 'TOTAL' }, true],
  ['time missing', { 'need.schedule_kind': 'FIXED_WINDOW', 'need.starts_at': '2026-10-12T08:00:00Z' }, false],
  ['time reversed', { 'need.schedule_kind': 'FIXED_WINDOW', 'need.starts_at': '2026-10-12T08:00:00Z', 'need.ends_at': '2026-10-12T07:00:00Z' }, false],
  ['point missing', { 'need.task_geography': { mode: 'STATIONARY', start: { city: 'Novi Sad' } } }, false],
] as const)('waits for conditional data: %s', async (_label, patch, visible) => {
  const keys = Object.keys(patch);
  const facts = [...completeFacts().filter(f => !keys.includes(f.key)), ...Object.entries(patch).map(([key, value]) => publicFact(key as NeedFactV2Key, value))];
  mockLoad.mockResolvedValue(conversation({ facts })); await resume();
  expect(tree.root.findAllByProps({ testID: 'ai-end-card' }).length > 0).toBe(visible);
});
it.each([{ city: 'Novi Sad' }, { label: 'Novi Sad' }])('keeps private data out of a complete local summary: %j', async start => {
  const geography = { mode: 'STATIONARY', start }, address = 'Privatna 42';
  const facts = [...completeFacts().filter(f => f.key !== 'need.task_geography'), publicFact('need.task_geography', geography),
    { ...publicFact('need.exact_address', address), privacyClass: 'PRIVATE' as const },
    { ...publicFact('need.resolved_location', { version: 1, binding: { taskCountryCode: 'RS', geography, exactAddress: address },
      points: [{ slot: 'start', latitudeE6: 45255123, longitudeE6: 19841234, origin: { kind: 'MANUAL_PIN' } }] }), privacyClass: 'PRIVATE' as const }];
  mockLoad.mockResolvedValue(conversation({ facts })); await resume();
  const summary = tree.root.findByProps({ testID: 'intake-task-summary' });
  const words = summary.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
  expect(words).toContain('Novi Sad'); expect(words).not.toContain(address); expect(words).not.toContain('45255123');
});
it.each(['COMPLETED', 'ABANDONED'] as const)('does not restore a partial card for %s', async status => {
  mockLoad.mockResolvedValue(conversation({ status, facts: [publicFact('need.title', 'Prenos')] })); await resume(); noSummary();
});
it('keeps a complete finished task at the end with only one footer review action', async () => {
  mockLoad.mockResolvedValue(conversation({ status: 'COMPLETED', facts: completeFacts() })); await resume();
  expect(tree.root.findAllByProps({ testID: 'ai-end-card' })).toHaveLength(1);
  expect(tree.root.findByProps({ testID: 'intake-task-summary' }).findAllByProps({ label: 'Pregledaj zadatak' })).toHaveLength(0);
  expect(tree.root.findByProps({ testID: 'ai-footer-action' }).findAllByProps({ label: 'Pregledaj zadatak' })).toHaveLength(1);
});
function turn(requestId: string, state: string, retryAllowed = false) { return ok({ conversationId: id, clientRequestId: requestId,
  state, retryAllowed, turnId: state === 'ABSENT' ? null : other, receipt: state === 'SUCCEEDED' ? {
    userMessageId: id, assistantMessageId: other, proposedCount: 0, safety: 'ALLOW', schemaVersion: 'NEED_FACT_V2', authoritative: true } : null }); }
function deferred<T = unknown>() { let resolve!: (value: T) => void; let reject!: (value: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Intake />); }); };
const update = async () => { await act(async () => tree.update(<Intake />)); };
const button = (label: string) => tree.root.findByProps({ label }).props;
const input = () => tree.root.findByProps({ accessibilityLabel: 'Poruka za asistenta' }).props;
const field = () => tree.root.findAllByProps({ accessibilityLabel: 'Poruka za asistenta' });
const submit = () => tree.root.findByProps({ accessibilityLabel: mockSend.mock.calls.length ? 'Pošalji ponovo' : 'Pošalji poruku' }).props;
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
// Typing and speaking are two modes: the field opens when the keyboard is chosen, and a
// draft keeps it open. A test that types chooses it first, exactly as a person does.
const openKeyboard = async () => {
  if (tree.root.findAllByProps({ accessibilityLabel: 'Poruka za asistenta' }).length) return;
  const keyboard = tree.root.findByProps({ accessibilityLabel: 'Piši umesto da govoriš' }).props;
  await act(async () => keyboard.onPress());
};
const type = async (value = 'Treba preneti ormar sutra.') => { await openKeyboard(); await act(async () => input().onChangeText(value)); };
/**
 * A conversation exists once someone has said something into it (owner decision, 2026-09-18), so a
 * test that needs one either starts it by speaking, or comes back to one that already exists — the
 * two ways a person gets to a conversation with a row behind it.
 */
const start = async (body = 'Treba preneti ormar sutra.') => {
  await render(); await type(body); await act(async () => submit().onPress());
};
const resume = async () => { mockParams = { conversationId: id }; await render(); };
const blur = async () => { mockFocused = false; await update(); };
const focus = async () => { mockFocused = true; await update(); };
// Leaving the conversation is asked in an in-app ConfirmSheet (it was Alert.alert). `leaveSheet().props.onConfirm` is the
// screen's own answer, the closure the Alert used to get; the buttons are what a person presses.
const leaveSheet = () => tree.root.findByType(ConfirmSheet);
const leaveSheets = () => tree.root.findAllByType(ConfirmSheet);
const answer = (testID: 'confirm-sheet-confirm' | 'confirm-sheet-cancel') => leaveSheet().findByProps({ testID }).props.onPress();
const options = async () => { await act(async () => tree.root.findByProps({ accessibilityLabel: 'Opcije' }).props.onPress()); };
// The options panel became the app's "···" menu (ActionSheet, 2026-09-24): its rows are menu items, not V2Actions, and it
// closes without a choice the way a menu does (Back, a tap outside), which is its own onClose.
const menuItems = (label: string) => tree.root.findAll(node => node.props.accessibilityRole === 'menuitem' && node.props.accessibilityLabel === label);
const menuItem = (label: string) => { const [item] = menuItems(label); if (!item) throw new Error(`No menu item ${label}`); return item.props; };
const closeMenu = async () => { await act(async () => tree.root.findByType(ActionSheet).props.onClose()); };
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks(); for (const mock of [mockOpen, mockLoad, mockSend, mockTurn, mockAbandon, mockRecover, mockCancel]) mock.mockReset();
  mockSession = { user: { id: 'aaaaaaaa-1111-4111-8111-111111111111' }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true; mockParams = {}; mockCounter = 0;
  mockReduced = false;
  mockVoicePhase = 'IDLE';
  mockRealVoice = false; mockAppState = 'active'; mockAppListeners.clear();
  mockPermission.mockReset().mockResolvedValue('granted');
  mockCreateCapture.mockReset().mockReturnValue(mockCapture);
  mockCapture.start.mockReset().mockResolvedValue(undefined);
  mockCapture.finalize.mockReset().mockResolvedValue({ kind: 'final', text: 'Treba prevesti ormar.' });
  mockRouter.canGoBack.mockReturnValue(true); mockOpen.mockImplementation((requestId: string) => Promise.resolve(ok({ conversationId: id, clientRequestId: requestId })));
  mockLoad.mockResolvedValue(conversation()); mockSend.mockResolvedValue(unknown());
  mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'ABSENT', true)));
  mockRecover.mockImplementation(async (cid: string, requestId: string) => {
    const result = await mockTurn(cid, requestId);
    return result.ok ? recovery(result.podatak) : result;
  });
  mockCancel.mockResolvedValue(unknown());
  mockAbandon.mockResolvedValue(ok({ conversationId: id, status: 'ABANDONED', authoritative: true }));
  mockServerPhotos = [];
  mockReadPhotos.mockReset().mockImplementation(async (cid: string) => ok({ conversationId: cid, accountId: mockSession.user.id,
    photos: mockServerPhotos, ready: true, authoritative: true }));
  mockReadUpload.mockReset().mockResolvedValue({ ok: false, kod: 'MEDIA_NOT_FOUND', poruka: 'Fotografija nije dostupna.' });
  mockUploadPhoto.mockReset(); mockRemovePhoto.mockReset(); mockPickPhotos.mockReset();
});
let mockServerPhotos: unknown[] = [];
afterEach(async () => { await act(async () => tree?.unmount()); });

const voiceController = () => tree.root.findByType('VoiceComposer' as React.ElementType).props.controller;
it('starts the first speech gesture through the real hook/controller; only edited Send dispatches AI', async () => {
  mockRealVoice = true; await render();
  expect(mockOpen).not.toHaveBeenCalled(); expect(mockPermission).not.toHaveBeenCalled();
  const controller = voiceController();
  await act(async () => { expect(controller.begin('first-speech', 'accessible')).toBe(true); });
  expect(controller.getSnapshot().phase).toBe('LISTENING');
  expect(mockPermission.mock.invocationCallOrder[0]).toBeLessThan(mockOpen.mock.invocationCallOrder[0]);
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(mockCreateCapture.mock.calls[0][0].session).toMatchObject({ conversationId: id, accountRevision: 1,
    accountId: mockSession.user.id });
  expect(mockSend).not.toHaveBeenCalled(); expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await act(async () => controller.release('first-speech'));
  expect(input().value).toBe('Treba prevesti ormar.');
  expect(mockSend).not.toHaveBeenCalled();
  await type('Treba prevesti ormar u petak.'); await act(async () => submit().onPress());
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(mockSend.mock.calls[0].slice(0, 2)).toEqual([id, 'Treba prevesti ormar u petak.']);
});
it('denied microphone permission does not open a conversation or start a provider', async () => {
  mockRealVoice = true; mockPermission.mockResolvedValue('denied'); await render();
  await act(async () => { voiceController().begin('denied'); });
  expect(voiceController().getSnapshot()).toMatchObject({ phase: 'IDLE', error: 'MIC_PERMISSION_DENIED' });
  expect(mockOpen).not.toHaveBeenCalled(); expect(mockCreateCapture).not.toHaveBeenCalled();
});
it('preparation failure keeps the draft and same open key for an explicit retry', async () => {
  mockRealVoice = true; mockOpen.mockResolvedValueOnce(unknown()); await render();
  const controller = voiceController(); await type('Već ukucano.');
  await act(async () => { controller.begin('failed-open'); });
  expect(controller.getSnapshot()).toMatchObject({ phase: 'IDLE', error: 'VOICE_PREPARATION_FAILED' });
  expect(input().value).toBe('Već ukucano.');
  expect(mockCreateCapture).not.toHaveBeenCalled(); expect(mockSend).not.toHaveBeenCalled();
  await act(async () => { controller.begin('retry-open'); });
  expect(mockOpen.mock.calls[1]).toEqual(mockOpen.mock.calls[0]);
  expect(controller.getSnapshot().phase).toBe('LISTENING');
});
it('a pending preparation rejects duplicate gestures and a retained Send handler', async () => {
  mockRealVoice = true; const opened = deferred(); mockOpen.mockReturnValueOnce(opened.promise); await render();
  const controller = voiceController(); await type(); const send = submit().onPress;
  await act(async () => { controller.begin('first'); });
  await act(async () => { expect(controller.begin('duplicate')).toBe(false); void send(); });
  expect(mockOpen).toHaveBeenCalledTimes(1); expect(mockSend).not.toHaveBeenCalled();
  await act(async () => controller.release('first'));
  await act(async () => opened.resolve(ok({ conversationId: id, clientRequestId: mockOpen.mock.calls[0][0] })));
  expect(mockCreateCapture).not.toHaveBeenCalled(); expect(input().value).toBe('Treba preneti ormar sutra.');
});
it.each(['release', 'blur-refocus', 'account-ABA', 'background', 'back'] as const)(
  'a late first-speech opener after %s never starts capture', async reason => {
    mockRealVoice = true; const opened = deferred(); mockOpen.mockReturnValueOnce(opened.promise); await render();
    const controller = voiceController();
    await act(async () => { controller.begin('old-gesture'); });
    expect(controller.getSnapshot().phase).toBe('PREPARING');
    const key = mockOpen.mock.calls[0][0];
    if (reason === 'release') await act(async () => controller.release('old-gesture'));
    if (reason === 'blur-refocus') { await blur(); await focus(); }
    if (reason === 'account-ABA') { mockSession = { ...mockSession, accountRevision: 3 }; await update(); }
    if (reason === 'background') await act(async () => { mockAppState = 'background'; mockAppListeners.forEach(listener => listener('background')); });
    if (reason === 'back') await act(async () => tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress());
    await act(async () => opened.resolve(ok({ conversationId: id, clientRequestId: key })));
    expect(mockCreateCapture).not.toHaveBeenCalled(); expect(mockSend).not.toHaveBeenCalled();
    expect(controller.getSnapshot().phase).toBe('IDLE');
    if (reason === 'release') {
      await act(async () => { voiceController().begin('new-gesture'); });
      expect(mockOpen.mock.calls[1][0]).toBe(key);
      expect(voiceController().getSnapshot().phase).toBe('LISTENING');
    }
  });
it('first-speech preparation has a deadline; a late response cannot restart it', async () => {
  jest.useFakeTimers();
  try {
    mockRealVoice = true; const opened = deferred(); mockOpen.mockReturnValueOnce(opened.promise); await render();
    const controller = voiceController();
    await act(async () => { controller.begin('slow-open'); });
    await act(async () => { await jest.advanceTimersByTimeAsync(30000); });
    expect(controller.getSnapshot()).toMatchObject({ phase: 'IDLE', error: 'VOICE_PREPARATION_FAILED' });
    await act(async () => opened.resolve(ok({ conversationId: id, clientRequestId: mockOpen.mock.calls[0][0] })));
    expect(mockCreateCapture).not.toHaveBeenCalled(); expect(mockSend).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});

// Owner, 2026-09-23: what you say while holding the microphone is the message — it goes into the
// conversation when the finger lifts, and the typed draft stays untouched.
it('held speech is sent as its own message on release; the typed draft stays where it was', async () => {
  await render(); await type('Već ukucano.');
  const receive = mockVoiceOptions.mock.calls.at(-1)![0].onTranscript;
  await act(async () => expect(receive({ text: ' Treba mi prevoz. ', isCurrent: () => true, session: { mode: 'hold' } })).toBe(true));
  expect(mockSend).toHaveBeenCalledTimes(1); expect(mockSend.mock.calls[0][1]).toBe('Treba mi prevoz.');
  expect(input().value).toBe('Već ukucano.');
});
it.each([
  ['immediate success', 'Već ukucano.', 'Treba mi prevoz.'],
  ['unknown then success', 'Već ukucano.', 'Treba mi prevoz.'],
  ['explicit retry', 'Isti tekst.', 'Isti tekst.'],
])('CF01: spoken %s preserves the unrelated draft and the original command', async (outcome, draft, spoken) => {
  if (outcome === 'immediate success') {
    mockSend.mockImplementation((_id: string, _body: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
    mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
  }
  await render(); await type(draft);
  const receive = mockVoiceOptions.mock.calls.at(-1)![0].onTranscript;
  await act(async () => expect(receive({ text: spoken, isCurrent: () => true, session: { mode: 'hold' } })).toBe(true));
  const sent = mockSend.mock.calls[0].slice(0, 3);
  expect(sent.slice(0, 2)).toEqual([id, spoken]);
  if (outcome === 'explicit retry') {
    await act(async () => button('Proveri').onPress());
    mockSend.mockImplementation((_id: string, _body: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
    mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
    await act(async () => submit().onPress());
    expect(mockSend.mock.calls[1].slice(0, 3)).toEqual(sent);
  } else if (outcome === 'unknown then success') {
    mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
    await act(async () => button('Proveri').onPress());
  }
  expect(input().value).toBe(draft); expect(input().editable).toBe(true);
  expect(mockSend).toHaveBeenCalledTimes(outcome === 'explicit retry' ? 2 : 1);
  expect(await aiTurnIntentJournal.load(mockSession.user.id)).toBeNull();
});
it.each([
  ['typed', 'Noviji nacrt.', 'immediate success'],
  ['typed', '  Poslati nacrt.  ', 'immediate success'],
  ['spoken', 'Noviji nacrt.', 'immediate success'],
  ['typed', 'Noviji nacrt.', 'unknown then success'],
  ['typed', '  Poslati nacrt.  ', 'explicit retry'],
])('CF01: %s preserves a newer native edit during opening (%s; %s)', async (origin, freshDraft, outcome) => {
  const opening = deferred(); mockOpen.mockReturnValueOnce(opening.promise);
  if (outcome === 'immediate success') {
    mockSend.mockImplementation((_id: string, _body: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
    mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
  }
  await render(); await type('  Poslati nacrt.  ');
  // A native change already queued before the field became disabled can arrive while the first open awaits.
  const lateEdit = input().onChangeText;
  if (origin === 'typed') await act(async () => { void submit().onPress(); });
  else {
    const receive = mockVoiceOptions.mock.calls.at(-1)![0].onTranscript;
    await act(async () => expect(receive({ text: 'Govorna poruka.', isCurrent: () => true, session: { mode: 'hold' } })).toBe(true));
  }
  expect(mockSend).not.toHaveBeenCalled();
  await act(async () => { lateEdit('Promena tokom otvaranja.'); lateEdit(freshDraft); });
  expect(input().value).toBe(freshDraft);
  await act(async () => opening.resolve(ok({ conversationId: id, clientRequestId: mockOpen.mock.calls[0][0] })));
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend.mock.calls[0][1]).toBe(origin === 'typed' ? 'Poslati nacrt.' : 'Govorna poruka.');
  if (outcome === 'explicit retry') {
    await act(async () => button('Proveri').onPress());
    mockSend.mockImplementation((_id: string, _body: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
    mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
    await act(async () => submit().onPress());
    expect(mockSend.mock.calls[1].slice(0, 3)).toEqual(mockSend.mock.calls[0].slice(0, 3));
  } else if (outcome === 'unknown then success') {
    mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
    await act(async () => button('Proveri').onPress());
  }
  expect(input().value).toBe(freshDraft); expect(input().editable).toBe(true);
  expect(mockSend).toHaveBeenCalledTimes(outcome === 'explicit retry' ? 2 : 1);
});
it('CF01: a typed retry clears only its unchanged raw submitted draft', async () => {
  await render(); await type('  Poslati nacrt.  '); await act(async () => submit().onPress());
  await act(async () => button('Proveri').onPress());
  mockSend.mockImplementation((_id: string, _body: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
  mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
  await act(async () => submit().onPress());
  expect(mockSend).toHaveBeenCalledTimes(2);
  expect(mockSend.mock.calls[1].slice(0, 3)).toEqual(mockSend.mock.calls[0].slice(0, 3));
  expect(mockSend.mock.calls[1][1]).toBe('Poslati nacrt.');
  expect(input().value).toBe(''); expect(input().editable).toBe(true);
});
it.each(['typed', 'spoken'])('CF01: remounted %s intent restores only IDs and cannot clear a fresh draft', async origin => {
  await render(); await type('Private typed draft');
  if (origin === 'typed') await act(async () => submit().onPress());
  else {
    const receive = mockVoiceOptions.mock.calls.at(-1)![0].onTranscript;
    await act(async () => expect(receive({ text: 'Private spoken message', isCurrent: () => true, session: { mode: 'hold' } })).toBe(true));
  }
  const requestId = mockSend.mock.calls[0][2];
  expect(await aiTurnIntentJournal.load(mockSession.user.id)).toEqual({ accountId: mockSession.user.id, conversationId: id, clientRequestId: requestId });
  await act(async () => tree.unmount());
  mockTurn.mockResolvedValue(turn(requestId, 'SUCCEEDED'));
  await render(); await openKeyboard();
  expect(input().value).toBe(''); expect(input().editable).toBe(true);
  expect(await aiTurnIntentJournal.load(mockSession.user.id)).toBeNull();
  await type('Fresh draft after recovery'); await options();
  await act(async () => menuItem('Osveži razgovor').onPress());
  expect(input().value).toBe('Fresh draft after recovery'); expect(mockSend).toHaveBeenCalledTimes(1);
});
it('the accessible start/stop mode still hands speech to the draft for review; only explicit Send writes the AI intent', async () => {
  await render(); await type('Već ukucano.');
  const receive = mockVoiceOptions.mock.calls.at(-1)![0].onTranscript;
  await act(async () => expect(receive({ text: 'Treba mi prevoz.', isCurrent: () => true, session: { mode: 'accessible' } })).toBe(true));
  expect(input().value).toBe('Već ukucano.\nTreba mi prevoz.');
  expect(mockSend).not.toHaveBeenCalled(); expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await type('Treba mi prevoz u petak.');
  await act(async () => submit().onPress());
  expect(mockSend).toHaveBeenCalledTimes(1); expect(mockSend.mock.calls[0][1]).toBe('Treba mi prevoz u petak.');
});
it('held speech that is empty or over the limit is refused without a send, so the controller keeps it as fallback text', async () => {
  await render();
  const receive = mockVoiceOptions.mock.calls.at(-1)![0].onTranscript;
  await act(async () => expect(receive({ text: '   ', isCurrent: () => true, session: { mode: 'hold' } })).toBe(false));
  await act(async () => expect(receive({ text: 'a'.repeat(4001), isCurrent: () => true, session: { mode: 'hold' } })).toBe(false));
  expect(mockSend).not.toHaveBeenCalled();
});
it('accessible speech refuses a full draft without overwriting it or starting an AI request', async () => {
  await render(); await type('a'.repeat(3999));
  await act(async () => expect(mockVoiceOptions.mock.calls.at(-1)![0].onTranscript({ text: 'Još.', isCurrent: () => true, session: { mode: 'accessible' } })).toBe(false));
  expect(input().value).toBe('a'.repeat(3999)); expect(mockSend).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});
it.each(['stale-capture', 'blur-refocus', 'account-ABA'] as const)('rejects late speech from %s without changing the current draft', async reason => {
  await render(); await type('Aktuelni tekst'); const receive = mockVoiceOptions.mock.calls.at(-1)![0].onTranscript;
  if (reason === 'blur-refocus') { await blur(); await focus(); }
  if (reason === 'account-ABA') { mockSession = { ...mockSession, accountRevision: 3 }; await update(); }
  await openKeyboard();
  const before = input().value;
  await act(async () => expect(receive({ text: 'stari privatni govor', isCurrent: () => reason !== 'stale-capture' })).toBe(false));
  await openKeyboard();
  expect(input().value).toBe(before); expect(mockSend).not.toHaveBeenCalled(); expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('creates nothing until the first word, and then exactly one conversation', async () => {
  // Opening the screen used to open a row: 38 of 62 conversations had no message in them, one for
  // every time someone looked and left.
  await render();
  expect(mockOpen).not.toHaveBeenCalled(); expect(mockLoad).not.toHaveBeenCalled();
  await blur(); await focus();
  expect(mockOpen).not.toHaveBeenCalled();
  expect(text()).toContain('Reci šta ti treba.');

  await type(); await act(async () => submit().onPress());
  expect(mockOpen).toHaveBeenCalledTimes(1); expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend.mock.calls[0][0]).toBe(id);
  await blur(); await focus();
  expect(mockOpen).toHaveBeenCalledTimes(1); expect(mockAbandon).not.toHaveBeenCalled();
});
// UX needs R18: 38 of the first 62 conversations never received a word. The empty conversation offers whole sentences a person might say
// (what, when, where), not names of categories; one tap puts a sentence in the field for the person to finish.
it('offers three whole sentences before the first word; a tap puts one in the field and opens or sends nothing', async () => {
  await render();
  const drawn = (label: string) => tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityLabel === label);
  expect(TASK_OPENINGS).toHaveLength(3);
  for (const sentence of TASK_OPENINGS) { expect(drawn(sentence)).toHaveLength(1); expect(sentence).toMatch(/^Treba mi .{25,}\.$/); }
  expect(text()).toContain('Na primer');
  await act(async () => drawn(TASK_OPENINGS[0])[0].props.onPress());
  expect(input().value).toBe(`${TASK_OPENINGS[0]} `);
  expect(mockOpen).not.toHaveBeenCalled(); expect(mockSend).not.toHaveBeenCalled();
  // They are for the start only: with the first word sent, the thread has taken their place.
  await act(async () => submit().onPress());
  expect(drawn(TASK_OPENINGS[0])).toHaveLength(0); expect(drawn(TASK_OPENINGS[1])).toHaveLength(0);
});
// B0 / R5: a command that fails is felt once ("error"), at the moment its message appears, and the same message is not felt again on a re-render.
it('ticks "error" once when a command fails, and not again for the same message', async () => {
  mockOpen.mockResolvedValueOnce(unknown());
  await render(); await type(); mockTick.mockClear();
  await act(async () => submit().onPress());
  expect(text()).toContain('Ishod nije potvrđen');
  expect(mockTick.mock.calls.filter(call => call[0] === 'error')).toHaveLength(1);
  await update();
  expect(mockTick.mock.calls.filter(call => call[0] === 'error')).toHaveLength(1);
});
it('retains the owned open key after an unknown result and retries only by user action', async () => {
  mockOpen.mockResolvedValueOnce(unknown());
  await render(); await type(); await act(async () => submit().onPress());
  expect(mockOpen).toHaveBeenCalledTimes(1); expect(mockSend).not.toHaveBeenCalled();
  expect(text()).toContain('Ishod nije potvrđen');
  await act(async () => button('Proveri').onPress());
  await openKeyboard();
  // The typed words are still there: nothing was sent, so nothing was consumed.
  expect(input().value).toBe('Treba preneti ormar sutra.');
  await act(async () => submit().onPress());
  expect(mockOpen.mock.calls[1][0]).toBe(mockOpen.mock.calls[0][0]);
});
it('does not adopt a late open response on a blurred screen; the next send replays its original key', async () => {
  const old = deferred(); mockOpen.mockReturnValueOnce(old.promise);
  await render(); await type(); const send = submit().onPress;
  await act(async () => { void send(); });
  const key = mockOpen.mock.calls[0][0];
  await blur(); await act(async () => old.resolve(ok({ conversationId: other, clientRequestId: key })));
  expect(mockLoad).not.toHaveBeenCalled();
  await focus(); await type(); await act(async () => submit().onPress());
  expect(mockOpen.mock.calls[1][0]).toBe(key);
  // The conversation the screen now has is the one its own second open answered with, never the
  // one the abandoned first attempt came back with.
  await act(async () => button('Proveri').onPress());
  expect(mockLoad).toHaveBeenCalledWith(id); expect(mockLoad).not.toHaveBeenCalledWith(other);
});
it.each([['ambiguous', [id]], ['malformed', 'wrong']] as const)('rejects %s resume route without opening a replacement conversation', async (_label, value) => {
  mockParams = { conversationId: value as string | string[] }; await render();
  expect(mockOpen).not.toHaveBeenCalled(); expect(mockLoad).not.toHaveBeenCalled(); expect(text()).toContain('Razgovor trenutno nije dostupan');
});
it('keeps a failed resume as a read failure and does not create another conversation', async () => {
  mockParams = { conversationId: id }; mockLoad.mockRejectedValueOnce(new Error('private backend detail')); await render();
  expect(text()).not.toContain('private backend detail'); await act(async () => button('Pokušaj ponovo').onPress());
  expect(mockOpen).not.toHaveBeenCalled(); expect(mockLoad).toHaveBeenCalledTimes(2);
});
it('serializes two retained send taps before render and keeps the original body and key', async () => {
  const held = deferred(); mockSend.mockReturnValueOnce(held.promise); await render(); await type(); const send = submit().onPress;
  await act(async () => { void send(); void send(); }); expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend.mock.calls[0].slice(0,3)).toEqual([id, 'Treba preneti ormar sutra.', expect.stringMatching(/^[a-f0-9-]{36}$/)]);
  expect(typeof mockSend.mock.calls[0][3].onText).toBe('function');
  await act(async () => held.resolve(unknown())); expect(input().value).toBe('Treba preneti ormar sutra.'); expect(input().editable).toBe(false);
});
it('requires real readback after unknown and retries the same key/body only when the server permits', async () => {
  await render(); await type(); await act(async () => submit().onPress()); const sent = mockSend.mock.calls[0];
  await act(async () => submit().onPress()); expect(mockSend).toHaveBeenCalledTimes(1);
  await act(async () => button('Proveri').onPress()); expect(mockTurn).toHaveBeenCalledWith(id, sent[2]);
  await act(async () => input().onChangeText('different body')); expect(input().value).toBe(sent[1]);
  await act(async () => submit().onPress()); expect(mockSend.mock.calls[1].slice(0,3)).toEqual(sent.slice(0,3));
});
// Owner, phone test 2026-10-07: while "Stiže odgovor…" was on screen a grey box said "Ishod slanja nije potvrđen. Proveri ga
// pre sledeće poruke." with "Proveri ishod". The send was simply still running: the command had set its pending request,
// the last read still held no turn for it, so the status fell through every known branch to the unknown-outcome sentence.
// Unknown is a fact only once the call has settled without a confirmed outcome.
it.each(['first send', 'existing conversation'] as const)('shows no unknown-outcome box while the %s is in flight or streaming, only after it settles unconfirmed', async kind => {
  const held = deferred(); mockSend.mockReturnValueOnce(held.promise);
  if (kind === 'existing conversation') {
    mockLoad.mockResolvedValue(conversation({ messages: [{ id: other, fromAi: true, body: 'Šta ti treba?', safety: 'ALLOW', proposedFactIds: [] }] }));
    await resume();
  } else await render();
  await type(); await act(async () => { void submit().onPress(); });
  expect(mockSend).toHaveBeenCalledTimes(1);
  // The recovery is a `Surface`: the component and the view it draws both carry the testID, so only the drawn view is counted.
  const box = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'ai-recovery-in-thread');
  const settledOnly = () => {
    expect(text()).not.toContain('Ne znamo da li je poruka poslata'); expect(tree.root.findAllByProps({ label: 'Proveri' })).toHaveLength(0);
    expect(box()).toHaveLength(0); expect(tree.root.findAllByProps({ testID: 'ai-send-reason' })).toHaveLength(0);
  };
  expect(text()).toContain('Stiže odgovor…'); settledOnly();
  await act(async () => mockSend.mock.calls[0][3].onText('Evo, '));
  // Task intake waits for canonical geography before exposing a potentially premature next question.
  expect(text()).not.toContain('Evo, '); expect(text()).toContain('Stiže odgovor…'); settledOnly();
  await act(async () => held.resolve(unknown()));
  expect(text()).toContain('Ne znamo da li je poruka poslata.');
  expect(box()).toHaveLength(1); expect(button('Proveri').disabled).toBe(false);
  expect(mockSend).toHaveBeenCalledTimes(1);
});
// One sentence for "we are not sure the message arrived": the status line and the one button. The data layer's own sentence for the same fact
// ("Ishod radnje nije potvrđen. Osveži prikaz ...") is not drawn a second time above them, in other words and with another button's verb.
it('says a send that may not have arrived once, with the shared sentence and the one button', async () => {
  const GENERIC = 'Ishod radnje nije potvrđen. Osveži prikaz pre ponovnog pokušaja.';
  mockSend.mockResolvedValueOnce({ ok: false, kod: 'AI_TURN_SEND_UNCONFIRMED', poruka: GENERIC });
  await render(); await type(); await act(async () => submit().onPress());
  expect(text()).toContain('Ne znamo da li je poruka poslata.'); expect(text()).not.toContain(GENERIC);
  expect(button('Proveri').disabled).toBe(false);
});
it('keeps the line of any other failed send, even while the delivery is not known', async () => {
  const OTHER = 'Poruka nije poslata. Pokušaj ponovo.';
  mockSend.mockResolvedValueOnce({ ok: false, kod: 'AI_LOCAL_INTENT_NOT_SAVED', poruka: OTHER });
  await render(); await type(); await act(async () => submit().onPress());
  expect(text()).toContain(OTHER); expect(text()).toContain('Ne znamo da li je poruka poslata.');
});
it('keeps the retry, cancel and "Asistent još obrađuje" paths once a send has settled, and hides them again while the retry runs', async () => {
  await render(); await type(); await act(async () => submit().onPress());
  await act(async () => button('Proveri').onPress());
  expect(text()).toContain('Poruka je sačuvana za ponovni pokušaj.'); expect(button('Otkaži slanje poruke')).toBeDefined();
  const held = deferred(); mockSend.mockReturnValueOnce(held.promise);
  await act(async () => { void submit().onPress(); });
  expect(mockSend).toHaveBeenCalledTimes(2);
  expect(text()).not.toContain('Poruka je sačuvana za ponovni pokušaj.'); expect(text()).not.toContain('Ne znamo da li je poruka poslata');
  expect(tree.root.findAllByProps({ label: 'Otkaži slanje poruke' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'ai-recovery-in-thread' })).toHaveLength(0);
  mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'PROCESSING')));
  await act(async () => held.resolve(turn(mockSend.mock.calls[1][2], 'PROCESSING')));
  expect(text()).toContain('Asistent još obrađuje poruku. Sačekaj odgovor.'); expect(button('Proveri').disabled).toBe(false);
});
it('keeps an in-progress server receipt read-only and never polls or retries automatically', async () => {
  mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'PROCESSING')));
  await render(); await type(); await act(async () => submit().onPress()); await act(async () => button('Proveri').onPress());
  expect(submit().disabled).toBe(true); expect(text()).toContain('Asistent još obrađuje poruku'); expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockTurn).toHaveBeenCalledTimes(1);
});
it('resolves a lost success receipt using IDs, clears the sent draft and accepts a fresh next request', async () => {
  await render(); await type(); await act(async () => submit().onPress()); const old = mockSend.mock.calls[0][2];
  mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
  await act(async () => button('Proveri').onPress());
  // The readback clears the sent draft, which returns the composer to voice mode. The
  // invariant is unchanged: the draft is empty and still editable.
  await openKeyboard(); expect(input().value).toBe(''); expect(input().editable).toBe(true);
  await type('Druga poruka.'); await act(async () => tree.root.findByProps({ accessibilityLabel: 'Pošalji poruku' }).props.onPress());
  expect(mockSend.mock.calls[1][1]).toBe('Druga poruka.'); expect(mockSend.mock.calls[1][2]).not.toBe(old);
});
it('keeps pending intent across blur and reconciles before enabling another send', async () => {
  const held = deferred(); mockSend.mockReturnValueOnce(held.promise); await render(); await type();
  await act(async () => { void submit().onPress(); }); const key = mockSend.mock.calls[0][2]; await blur();
  await act(async () => held.resolve(unknown())); await focus(); expect(mockTurn).toHaveBeenCalledWith(id, key);
  expect(mockSend).toHaveBeenCalledTimes(1); expect(input().value).toBe('Treba preneti ormar sutra.');
});
it.each(['account ABA', 'route'] as const)('rejects retained send callbacks after %s changes', async change => {
  await render(); await type(); const retained = submit().onPress, oldInput = input().onChangeText;
  if (change === 'account ABA') mockSession = { user: { id: 'aaaaaaaa-1111-4111-8111-111111111111' }, accountRevision: 3 };
  if (change === 'route') mockParams = { conversationId: other };
  if (change === 'route') mockLoad.mockResolvedValue(conversation({ conversationId: other }));
  await update(); await act(async () => { oldInput('old private draft'); void retained(); });
  await openKeyboard();
  expect(mockSend).not.toHaveBeenCalled(); expect(input().value).toBe('');
});
// Owner decision 1 (2026-09-19): the app has no global mode, so nothing about one can retire an unsent
// message. This row used to sit in the table above as a reason to drop the send.
it('a flip of the retired app mode retires nothing: the retained send still goes out, once', async () => {
  await render(); await type(); const retained = submit().onPress;
  mockIntent = 'uskocer'; await update(); await act(async () => { void retained(); });
  expect(mockSend).toHaveBeenCalledTimes(1);
});
it('masks old private messages immediately after account ABA and ignores the late read', async () => {
  const held = deferred(); mockLoad.mockReturnValueOnce(held.promise); await resume();
  mockSession = { user: { id: 'aaaaaaaa-1111-4111-8111-111111111111' }, accountRevision: 3 }; await update();
  await act(async () => held.resolve(conversation({ messages: [{ id, body: 'old private account message', fromAi: false,
    safety: null, proposedFactIds: [] }] })));
  expect(text()).not.toContain('old private account message');
  // The new account reads the conversation for itself; nothing is created for either of them.
  expect(mockLoad).toHaveBeenCalledTimes(2); expect(mockOpen).not.toHaveBeenCalled();
});
it('does not read or navigate from a late send result after account change', async () => {
  const held = deferred(); mockSend.mockReturnValueOnce(held.promise); await render(); await type();
  await openKeyboard();
  await act(async () => { void submit().onPress(); }); const requestId = mockSend.mock.calls[0][2];
  mockSession = { user: { id: 'bbbbbbbb-1111-4111-8111-111111111111' }, accountRevision: 2 }; await update(); const reads = mockLoad.mock.calls.length;
  await act(async () => held.resolve(turn(requestId, 'SUCCEEDED')));
  expect(mockLoad).toHaveBeenCalledTimes(reads); expect(mockTurn).not.toHaveBeenCalled();
  await openKeyboard();
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(input().value).toBe('');
});
it('retires a confirmation callback after blur/refocus and never abandons on Back', async () => {
  await resume(); await options(); await act(async () => menuItem('Napusti razgovor').onPress());
  expect(leaveSheet().props).toMatchObject({ title: 'Napustiti razgovor?', cancelLabel: 'Nastavi razgovor', confirmLabel: 'Napusti razgovor', tone: 'danger' });
  const confirm = leaveSheet().props.onConfirm; await blur(); expect(leaveSheets()).toHaveLength(0); await focus();
  await act(async () => confirm()); expect(mockAbandon).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress());
  expect(mockRouter.back).toHaveBeenCalledTimes(1); expect(mockAbandon).not.toHaveBeenCalled();
});
it('cancelling the leave question keeps the conversation open and sends nothing', async () => {
  await resume(); await options(); await act(async () => menuItem('Napusti razgovor').onPress());
  await act(async () => answer('confirm-sheet-cancel'));
  expect(leaveSheets()).toHaveLength(0); expect(mockAbandon).not.toHaveBeenCalled(); expect(mockVoiceCancel).not.toHaveBeenCalled();
});
it('explicit abandonment uses the actual authority and becomes closed only after readback', async () => {
  await resume(); await options(); await act(async () => menuItem('Napusti razgovor').onPress()); expect(mockAbandon).not.toHaveBeenCalled();
  mockLoad.mockResolvedValue(conversation({ status: 'ABANDONED' }));
  await act(async () => answer('confirm-sheet-confirm'));
  expect(mockAbandon).toHaveBeenCalledWith(id); expect(leaveSheets()).toHaveLength(0); expect(text()).toContain('Razgovor je napušten.');
  // A conversation that is over takes no more words (the owner's phone, 8 Oct 2026): the field is gone, not disabled, and the way on is ON the screen, a new task.
  expect(field()).toHaveLength(0); expect(tree.root.findAllByProps({ label: 'Novi zadatak' }).length).toBeGreaterThan(0);
});
it('keeps the leave question open with a busy confirm while abandonment runs, and closes it once that settles', async () => {
  // The screen returns its command to the sheet; a `void` there would close the question before the command is sent.
  const held = deferred(); mockAbandon.mockReturnValueOnce(held.promise);
  await resume(); await options(); await act(async () => menuItem('Napusti razgovor').onPress());
  mockLoad.mockResolvedValue(conversation({ status: 'ABANDONED' }));
  await act(async () => answer('confirm-sheet-confirm'));
  expect(mockAbandon).toHaveBeenCalledTimes(1); expect(leaveSheets()).toHaveLength(1);
  expect(leaveSheet().findByProps({ testID: 'confirm-sheet-confirm' }).props.accessibilityState).toEqual({ disabled: true, busy: true });
  await act(async () => held.resolve(ok({ conversationId: id, status: 'ABANDONED', authoritative: true })));
  expect(leaveSheets()).toHaveLength(0); expect(text()).toContain('Razgovor je napušten.');
});
it.each(['PERMISSION_PENDING', 'PREPARING', 'STARTING', 'LISTENING', 'FINALIZING'] as const)('cancels %s capture before abandonment and removes its session scope after readback', async phase => {
  mockVoicePhase = phase; await resume();
  expect(mockVoiceOptions.mock.calls.at(-1)?.[0].conversationId()).toBe(id);
  await options(); await act(async () => menuItem('Napusti razgovor').onPress());
  mockLoad.mockResolvedValue(conversation({ status: 'ABANDONED' }));
  mockAbandon.mockImplementation(async () => {
    expect(mockVoiceCancel).toHaveBeenCalledWith('navigation');
    return ok({ conversationId: id, status: 'ABANDONED', authoritative: true });
  });
  await act(async () => answer('confirm-sheet-confirm'));
  expect(mockVoiceOptions.mock.calls.at(-1)?.[0].conversationId()).toBeNull();
  expect(tree.root.findAllByType('VoiceComposer' as React.ElementType)).toHaveLength(0);
  expect(mockSend).not.toHaveBeenCalled();
});
it.each(['COMPLETED', 'ABANDONED', 'BLOCK'])('does not retain a microphone scope after canonical %s readback', async state => {
  await resume();
  mockLoad.mockResolvedValue(conversation(state === 'BLOCK' ? { safety: 'BLOCK' } : { status: state as 'COMPLETED' | 'ABANDONED' }));
  await blur(); await focus();
  expect(mockVoiceOptions.mock.calls.at(-1)?.[0].conversationId()).toBeNull();
  expect(mockSend).not.toHaveBeenCalled();
});
it.each(['COMPLETED', 'ABANDONED'] as const)('keeps actual %s conversations read-only: no field and no microphone at all', async status => {
  mockLoad.mockResolvedValue(conversation({ status })); await resume();
  expect(field()).toHaveLength(0); expect(tree.root.findAllByType('VoiceComposer' as React.ElementType)).toHaveLength(0);
  await options();
  expect(menuItems('Napusti razgovor')).toHaveLength(0);
});
it.each(['COMPLETED', 'ABANDONED'] as const)('%s: the way on stays on the screen, not only in the "···"', async status => {
  const saved = conversation({ status, facts: [publicFact('need.title', 'Prenos ormara')] }); mockLoad.mockResolvedValue(saved); await resume();
  // With a review to open, it is the one green action; otherwise a new task is. The menu keeps its rows for the rare case.
  const onScreen = (label: string) => tree.root.findAllByProps({ label }).length;
  if (status === 'COMPLETED') { expect(onScreen('Pregledaj zadatak')).toBeGreaterThan(0); expect(onScreen('Novi zadatak')).toBe(0); }
  else { expect(onScreen('Novi zadatak')).toBeGreaterThan(0); expect(onScreen('Pregledaj zadatak')).toBe(0); }
  expect(tree.root.findAllByProps({ testID: 'intake-draft-review' })).toHaveLength(0);
});
it('does not expose abandonment for an edit conversation bound to a Zadatak', async () => {
  const data = conversation(); data.review.boundNeedId = other; mockLoad.mockResolvedValue(data); await resume(); await options();
  expect(menuItems('Napusti razgovor')).toHaveLength(0);
});

it('keeps the complete conversation without a premature pinned card', async () => {
  const messages = [
    { id: 'old-ai', fromAi: true, body: 'Ranije pitanje' }, { id: 'old-user', fromAi: false, body: 'Raniji odgovor' },
    { id: 'new-ai', fromAi: true, body: 'Koliko ljudi je potrebno?' }, { id: 'new-user', fromAi: false, body: 'Dve osobe.' },
  ].map(message => ({ ...message, safety: null, proposedFactIds: [] }));
  mockLoad.mockResolvedValue(conversation({ messages })); await resume();
  expect(text()).toContain('Koliko ljudi je potrebno?'); expect(text()).toContain('Dve osobe.');
  expect(text()).toContain('Ranije pitanje'); expect(text()).toContain('Raniji odgovor');
  const thread = tree.root.findByProps({ testID: 'ai-conversation-thread' });
  expect(thread.findAllByProps({ testID: 'intake-task-summary' })).toHaveLength(0);
  // The card is a `Surface` panel: the component and the view it draws both carry the testID, so only the drawn view is counted.
  expect(tree.root.findAllByProps({ testID: 'ai-pinned-card' })).toHaveLength(0); noSummary();
  expect(mockSend).not.toHaveBeenCalled(); expect(mockAbandon).not.toHaveBeenCalled();
});

it('keeps current facts in the card and review instead of attaching changed values to historical replies', async () => {
  const fact = publicFact('need.people_needed', 3);
  fact.displayValue = 'Tri osobe — nova vrednost';
  mockLoad.mockResolvedValue(conversation({ facts: [fact], messages: [{ id: 'older-ai', fromAi: true,
    body: 'Kada ti treba pomoć?', safety: 'ALLOW', proposedFactIds: [fact.id] }] }));
  await resume();
  const thread = tree.root.findByProps({ testID: 'ai-conversation-thread' });
  expect(text()).toContain('Kada ti treba pomoć?');
  expect(text()).not.toContain(fact.displayValue);
  expect(thread.findAll(node => String(node.props.accessibilityLabel ?? '').startsWith('Iz ovoga je uzeto:'))).toHaveLength(0);
  noSummary(); await options();
  await act(async () => menuItem('Pregledaj zadatak').onPress());
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pregled-zadatka', params: { conversationId: id, intakeReturn: expect.any(String) } });
});

it('does not present UNKNOWN facts as completed answers', async () => {
  const title = publicFact('need.title', 'Nepotvrđen naslov'); title.status = 'UNKNOWN';
  const draft = conversation({ facts: [title] }); draft.review.missingRequired = ['need.title'];
  mockLoad.mockResolvedValue(draft); await resume();
  noSummary(); expect(text()).not.toContain('Zadatak u nastajanju');
  expect(text()).not.toContain('Nepotvrđen naslov');
});

it('keeps private address and resolved coordinates out of the compact live card and preserves the review destination', async () => {
  const facts: AiNeedV2Conversation['facts'] = [
    { id: 'title', key: 'need.title', value: 'Unos ormara', displayValue: 'Unos ormara', valueType: 'TEXT', privacyClass: 'PUBLIC',
      requiredForDraft: true, status: 'NEEDS_CONFIRMATION', source: 'AI_INFERENCE', evidence: null },
    { id: 'address', key: 'need.exact_address', value: 'Privatna 42', displayValue: 'Privatna 42', valueType: 'TEXT', privacyClass: 'PRIVATE',
      requiredForDraft: false, status: 'CONFIRMED', source: 'EXPLICIT_USER_ANSWER', evidence: null },
    { id: 'points', key: 'need.resolved_location', value: { latitudeE6: 45255123 }, displayValue: '45255123', valueType: 'OBJECT', privacyClass: 'PRIVATE',
      requiredForDraft: false, status: 'CONFIRMED', source: 'EXPLICIT_USER_ANSWER', evidence: null },
  ];
  mockLoad.mockResolvedValue(conversation({ facts })); await resume();
  noSummary(); expect(text()).not.toMatch(/Spremno za pregled|\bNacrt\b/);
  expect(text()).not.toContain('Privatna 42'); expect(text()).not.toContain('45255123');
  // Only the title is public here: no row is drawn for a fact that is not there, and a private one is never a row.
  expect(tree.root.findAllByProps({ testID: 'intake-draft-details' })).toHaveLength(0);
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockSend).not.toHaveBeenCalled();
  expect(text()).not.toContain('Privatna 42'); expect(text()).not.toContain('45255123');
  noSummary();
  await options(); expect(menuItems('Pregledaj zadatak')).toHaveLength(1);
  const review = menuItem('Pregledaj zadatak');
  await act(async () => { review.onPress(); review.onPress(); });
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pregled-zadatka', params: { conversationId: id, intakeReturn: expect.any(String) } });
});

it('keeps partial proposals out of the conversation card while facts are gathered', async () => {
  // Nothing is filled at the start, so the full list is eight items — longest exactly when it helps
  // least, and it was being cut mid-word to fit two lines. The AI asks for them one at a time.
  const said = [{ id: other, body: 'Treba mi prevoz.', fromAi: false, safety: null, proposedFactIds: [] }];
  const eight = conversation({ messages: said });
  eight.review.missingRequired = ['need.title', 'need.description', 'need.category', 'need.price_mode',
    'need.schedule_kind', 'need.people_needed', 'need.task_country_code', 'need.task_geography'];
  mockLoad.mockResolvedValue(eight); await resume();
  // Review r4 ra item 4: people never see a category (owner, PKG-031), so it is never named as missing. These lines
  // pinned "Kategorija" among the missing things before.
  noSummary();
  expect(text()).not.toContain('Država zadatka'); expect(text()).not.toContain('Kategorija');

  // Three or fewer are all named: there is nothing to count.
  await act(async () => tree.unmount());
  const three = conversation({ messages: said });
  three.review.missingRequired = ['need.category', 'need.price_mode', 'need.people_needed', 'need.description'];
  mockLoad.mockResolvedValue(three); await resume();
  noSummary();
  expect(text()).not.toContain('i još'); expect(text()).not.toContain('Kategorija');

  // A title the AI has already proposed is the card's own heading. Listing it underneath as still
  // needed made the card contradict itself; confirming it is the review screen's job.
  await act(async () => tree.unmount());
  const titled = conversation({ messages: said, facts: [publicFact('need.title', 'Prenos ormara')] });
  titled.review.missingRequired = ['need.title', 'need.description'];
  mockLoad.mockResolvedValue(titled); await resume();
  noSummary();
  expect(text()).not.toContain('Još treba: Naslov');
});

// Review r4 ra item 4: while only the hidden category is missing, the card names nothing as missing and does not call
// the draft ready either; the separate review remains available for incomplete facts.
it('never names a category and does not call the draft ready while only the category is missing', async () => {
  const said = [{ id: other, body: 'Treba mi prevoz.', fromAi: false, safety: null, proposedFactIds: [] }];
  const hidden = conversation({ messages: said, facts: [publicFact('need.title', 'Prenos ormara')] });
  hidden.review.missingRequired = ['need.category'];
  mockLoad.mockResolvedValue(hidden); await resume();
  expect(text()).not.toContain('Kategorija'); expect(text()).not.toContain('Još treba');
  expect(text()).not.toContain('Sve traženo je uneto.');
  noSummary(); await options(); expect(menuItem('Pregledaj zadatak').disabled).toBe(false);
  await act(async () => tree.unmount());
  const done = conversation({ messages: said, facts: completeFacts() });
  mockLoad.mockResolvedValue(done); await resume();
  expect(text()).toContain('Pregledaj zadatak');
  expect(tree.root.findAllByProps({ testID: 'ai-footer-action' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'intake-draft-review' })).toHaveLength(0);
  const review = tree.root.findByProps({ testID: 'intake-task-summary' }).findByProps({ label: 'Pregledaj zadatak' });
  await act(async () => review.props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pregled-zadatka', params: { conversationId: id, intakeReturn: expect.any(String) } });
});

it.each(['new', 'new-entry', 'resumed'] as const)('preserves unsent text through ready review, return, edit and review again: %s', async kind => {
  mockParams = kind === 'resumed' ? { conversationId: id } : kind === 'new-entry' ? { entryKey: other } : {};
  const originalParams = { ...mockParams };
  mockLoad.mockResolvedValue(conversation({ facts: completeFacts() }));
  mockSend.mockImplementation((_id: string, _body: string, key: string) => Promise.resolve(turn(key, 'SUCCEEDED')));
  mockTurn.mockImplementation((_id: string, key: string) => Promise.resolve(turn(key, 'SUCCEEDED')));
  if (kind === 'resumed') await render(); else await start();
  const sends = mockSend.mock.calls.length;
  await type('Dopuna koju još nisam poslao.');
  expect(tree.root.findByProps({ testID: 'intake-task-summary' }).findAllByProps({ label: 'Pregledaj zadatak' })).toHaveLength(1);
  await act(async () => tree.root.findByProps({ testID: 'intake-task-summary' }).findByProps({ label: 'Pregledaj zadatak' }).props.onPress());
  const first = mockRouter.push.mock.calls.at(-1)![0].params;
  expect(Object.keys(first).sort()).toEqual(['conversationId', 'intakeReturn']);
  await blur();
  const retained = readIntakeReviewReturn(first.intakeReturn, first.conversationId)!;
  expect(retained.params).toEqual(originalParams);
  // A manual correction saved in the review must come back through the normal canonical read.
  mockLoad.mockResolvedValue(conversation({ facts: completeFacts('Prenos dva ormara') }));
  mockParams = { ...retained.params }; await focus();
  expect(readIntakeReviewReturn(first.intakeReturn, id)).toBeNull();
  expect(input().value).toBe('Dopuna koju još nisam poslao.');
  expect(text()).toContain('Prenos dva ormara');
  expect(tree.root.findByProps({ testID: 'intake-task-summary' }).findAllByProps({ label: 'Pregledaj zadatak' })).toHaveLength(1);
  expect(mockSend).toHaveBeenCalledTimes(sends);
  await type('Izmenjena neposlata dopuna.');
  await act(async () => tree.root.findByProps({ testID: 'intake-task-summary' }).findByProps({ label: 'Pregledaj zadatak' }).props.onPress());
  const second = mockRouter.push.mock.calls.at(-1)![0].params;
  expect(second.intakeReturn).not.toBe(first.intakeReturn);
  expect(readIntakeReviewReturn(second.intakeReturn, id)?.params).toEqual(originalParams);
  expect(input().value).toBe('Izmenjena neposlata dopuna.');
  expect(mockSend).toHaveBeenCalledTimes(sends);
});

it('retires the review return when the original intake unmounts', async () => {
  mockLoad.mockResolvedValue(conversation({ facts: completeFacts() }));
  await resume();
  await act(async () => tree.root.findByProps({ testID: 'intake-task-summary' }).findByProps({ label: 'Pregledaj zadatak' }).props.onPress());
  const token = mockRouter.push.mock.calls.at(-1)![0].params.intakeReturn;
  await blur(); expect(readIntakeReviewReturn(token, id)).not.toBeNull();
  await act(async () => tree.unmount());
  expect(readIntakeReviewReturn(token, id)).toBeNull();
});

// Review r4 ra item 9: a conversation that changes a published task says so on its card, in the menu's own words.
it('the card of a task being changed names its review the way the menu does and says "Izmena" in the title and to a screen reader, not over its name', async () => {
  const said = [{ id: other, body: 'Promeni vreme.', fromAi: false, safety: null, proposedFactIds: [] }];
  const bound = conversation({ messages: said, facts: completeFacts() }); bound.review.boundNeedId = other;
  mockLoad.mockResolvedValue(bound); await resume();
  expect(text()).toContain('Izmena'); expect(text()).not.toMatch(/\bNacrt\b/);
  expect(text()).toContain('Pregledaj izmene'); expect(text()).not.toContain('Pregledaj zadatak');
  expect(tree.root.findByProps({ testID: 'intake-task-summary' }).findByProps({ label: 'Pregledaj izmene' })).toBeDefined();
  expect(tree.root.findByProps({ testID: 'intake-draft-head' }).props.accessibilityLabel).toBe('Izmena zadatka, Prenos ormara');
});

// Safety remains visible even while the incomplete card is absent.
it('keeps the complete safety note visible outside a hidden card during a pending turn', async () => {
  const said = [{ id: other, body: 'Treba mi prevoz.', fromAi: false, safety: null, proposedFactIds: [] }];
  mockLoad.mockResolvedValue(conversation({ messages: said, safety: 'REVIEW', facts: [publicFact('need.title', 'Prenos ormara')] }));
  await resume(); noSummary();
  const alerts = () => tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.accessibilityRole === 'alert');
  expect(alerts()).toHaveLength(1); const safety = alerts()[0].props.children;
  expect(alerts()[0].props.numberOfLines).toBeUndefined();
  await type('Dodaj da je treći sprat.'); await act(async () => submit().onPress());
  noSummary(); expect(text()).toContain(safety); expect(mockRouter.push).not.toHaveBeenCalled();
});

const plus = () => tree.root.findByProps({ accessibilityLabel: 'Dodaj fotografije' }).props;
it('offers photos from the composer before and after the first word, inside the conversation, and options only with one', async () => {
  // Owner, 2026-10-07: the "+" works before the first word too. There is still no "···" then (2026-09-24): a menu of nothing.
  await render();
  const optionLabels = () => tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string')
    .map(node => node.props.accessibilityLabel).join(' ');
  expect(plus().accessibilityState).toEqual({ disabled: false });
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Opcije' })).toHaveLength(0);
  // Merely opening the sheet creates nothing.
  await act(async () => plus().onPress());
  expect(tree.root.findAllByType(PhotoAttachSheet)).toHaveLength(1); expect(mockOpen).not.toHaveBeenCalled();

  await act(async () => tree.unmount());
  await resume(); expect(menuItems('Napusti razgovor')).toHaveLength(0);
  await options();
  expect(menuItems('Dodaj fotografije')).toHaveLength(0); expect(menuItems('Fotografije zadatka')).toHaveLength(0);
  expect(optionLabels()).not.toMatch(/mikrofon|prilo[gž]|glasovn/i);
  expect(text()).toContain('Povratak čuva razgovor.');
  await closeMenu(); expect(mockAbandon).not.toHaveBeenCalled(); expect(leaveSheets()).toHaveLength(0);
  expect(tree.root.findAllByType(ActionSheet)).toHaveLength(0);
  // Adding is a sheet of this conversation (Galerija, Kamera), never a trip to another screen.
  await act(async () => plus().onPress());
  const sheet = tree.root.findByType(PhotoAttachSheet).props;
  expect(sheet).toMatchObject({ remaining: 6, disabledReason: null });
  expect(mockRouter.push).not.toHaveBeenCalled();
});

// Confirmed locations now remain in the same lazy surface as the incomplete ask.
// Its own suite proves preview/edit/clean-close; this screen owns visibility and competing actions.
it('keeps a saved place inline and brings a put-away point ask back from the menu', async () => {
  const geography = publicFact('need.task_geography', { mode: 'STATIONARY', start: { city: 'Novi Sad', area: 'Liman' } });
  const placed = { ...publicFact('need.resolved_location', { version: 1,
    binding: { taskCountryCode: 'RS', geography: geography.value, exactAddress: null },
    points: [{ slot: 'start', latitudeE6: 45230000, longitudeE6: 19830000, origin: { kind: 'MANUAL_PIN' } }] }), privacyClass: 'PRIVATE' as const };
  const said = [{ id: other, body: 'Treba mi prevoz.', fromAi: false, safety: null, proposedFactIds: [] }];
  mockLoad.mockResolvedValue(conversation({ facts: [geography, publicFact('need.task_country_code', 'RS'), placed], messages: said })); await resume();
  // A saved place is one line of the thread now (owner, 2026-10-07); its editor opens only when that line is tapped.
  expect(tree.root.findAllByType('PointAsk' as React.ElementType)).toHaveLength(0);
  expect(tree.root.find(node => typeof node.type === 'string' && node.props.testID === 'intake-place-line').props.accessibilityLabel)
    .toBe('Potvrđeno mesto: tačka na mapi');
  expect(text()).not.toContain('Proveri mesto na mapi, da onaj ko uskoči zna gde treba da dođe.');
  await options();
  expect(menuItems('Izmeni mesto na mapi')).toHaveLength(0); expect(menuItems('Mesto na mapi')).toHaveLength(0);
  expect(tree.root.findAll(node => node.type === ProductSheet && node.props.label === 'Mesto zadatka')).toHaveLength(0);
  await closeMenu();

  await act(async () => tree.unmount());
  mockLoad.mockResolvedValue(conversation({ facts: [geography], messages: said })); await resume();
  const asks = () => tree.root.findAllByType('PointAsk' as React.ElementType);
  // The ask is in the thread, beside the words: a menu row for it would do nothing.
  expect(asks()).toHaveLength(1);
  await options(); expect(menuItems('Mesto na mapi')).toHaveLength(0); await closeMenu();
  // Put away ("Kasnije", then the editor's own "Iza\u0111i ipak"), the ask gives way to its button and to the menu row.
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Kasnije' }).props.onPress());
  await act(async () => answer('confirm-sheet-confirm'));
  expect(asks()).toHaveLength(0);
  await options();
  await act(async () => menuItem('Mesto na mapi').onPress());
  await act(async () => { await Promise.resolve(); });
  expect(tree.root.findAllByType(ActionSheet)).toHaveLength(0);
  expect(asks()).toHaveLength(1);
  expect(mockSend).not.toHaveBeenCalled(); expect(mockAbandon).not.toHaveBeenCalled();
});

it('keeps a typed draft but prevents competing send, review and photo navigation during point editing', async () => {
  const geography = publicFact('need.task_geography', { mode: 'STATIONARY', start: { city: 'Novi Sad' } });
  mockLoad.mockResolvedValue(conversation({ facts: [geography], review: { ...conversation().review, canSaveDraft: true } }));
  await resume(); await type('Još jedna napomena');
  const send = submit().onPress;
  const photos = plus().onPress;
  await options(); const review = menuItem('Pregledaj zadatak').onPress; await closeMenu();
  const point = tree.root.findByType('PointAsk' as React.ElementType).props;
  await act(async () => point.onEditingChange(true));
  expect(input().value).toBe('Još jedna napomena');
  expect(submit().accessibilityState.disabled).toBe(true);
  // Retained callbacks from before the manual editor opened cannot bypass the interlock.
  await act(async () => { send(); photos(); review(); });
  expect(mockSend).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(PhotoAttachSheet)).toHaveLength(0);
  await act(async () => point.onEditingChange(false));
  expect(input().value).toBe('Još jedna napomena');
  expect(submit().accessibilityState.disabled).toBe(false);
});

// Owner, phone test 2026-10-07 ("Neću da mi na dnu stoji ništa... To ostane u četu i ide gore sa drugim porukama"): once the
// place is confirmed the conversation simply continues. The confirmation is ONE line of the message list, in the order it
// happened, and scrolls up with the messages; nothing about the place stays docked above the composer.
describe('the confirmed place is a line of the conversation', () => {
  const geography = { mode: 'STATIONARY', start: { city: 'Novi Sad', area: 'Rotkvarija' } };
  const provider = '65, Bulevar oslobođenja, MZ Žitni trg, Rotkvarija, Novi Sad, Grad Novi Sad, Južnobački okrug, Srbija';
  const message = (messageId: string, fromAi: boolean, body: string): AiNeedV2Conversation['messages'][number] => ({ id: messageId, fromAi, body, safety: null, proposedFactIds: [] });
  const before = [message('m1', true, 'Gde treba da se dođe?'), message('m2', false, 'Bulevar oslobođenja 65, Novi Sad')];
  const later = [message('m3', false, 'Sutra u deset.'), message('m4', true, 'Zapisao sam termin.')];
  type Pin = { latitudeE6: number; longitudeE6: number; origin: { kind: 'MANUAL_PIN' } | { kind: 'PROVIDER_CANDIDATE'; providerHint: string; candidateHint: string | null }; address?: string };
  const placed = (pin: Pin | null, messages: ReturnType<typeof message>[]) => {
    const exactAddress = pin?.address ?? null;
    const facts: AiNeedV2Conversation['facts'] = [publicFact('need.task_geography', geography), publicFact('need.task_country_code', 'RS')];
    if (exactAddress) facts.push({ ...publicFact('need.exact_address', exactAddress), privacyClass: 'PRIVATE' });
    if (pin) facts.push({ ...publicFact('need.resolved_location', { version: 1, binding: { taskCountryCode: 'RS', geography, exactAddress },
      points: [{ slot: 'start', ...pin }] }), privacyClass: 'PRIVATE' });
    return conversation({ facts, messages });
  };
  const fromProvider: Pin = { latitudeE6: 45_258_900, longitudeE6: 19_832_700, address: provider,
    origin: { kind: 'PROVIDER_CANDIDATE', providerHint: 'locationiq', candidateHint: null } };
  const movedByHand: Pin = { latitudeE6: 45_259_400, longitudeE6: 19_833_100, address: '67, Bulevar oslobođenja, Novi Sad', origin: { kind: 'MANUAL_PIN' } };
  // The drawn line (its host view), not the component that carries the same test id.
  const isLine = (node: { type: unknown; props: { testID?: unknown } }) => typeof node.type === 'string' && node.props.testID === 'intake-place-line';
  const line = () => tree.root.find(isLine);
  const flat = (node: ReturnType<typeof line>): string => node.children.map(child => typeof child === 'string' ? child : flat(child)).join('');
  const sentence = () => line().findAll(node => node.type === ('T' as React.ElementType) && node.props.tone === 'muted'
    && node.children.some(child => typeof child !== 'string')).map(flat);
  const order = () => tree.root.findByProps({ testID: 'ai-conversation-thread' }).findAll(node => isLine(node)
    || (typeof node.props.accessibilityLabel === 'string' && /^(Ti|USKOČI): /.test(node.props.accessibilityLabel)))
    .map(node => isLine(node) ? 'PLACE' : node.props.accessibilityLabel);
  const docked = () => ['ai-composer-footer', 'ai-pinned-card'].flatMap(region => tree.root.findAllByProps({ testID: region }))
    .flatMap(region => [...region.findAll(isLine), ...region.findAllByType('PointAsk' as React.ElementType)]);
  const ask = () => tree.root.findByType('PointAsk' as React.ElementType).props;
  const asks = () => tree.root.findAllByType('PointAsk' as React.ElementType);

  it('turns the confirmation into one line inside the message list, in order, and leaves nothing above the composer', async () => {
    mockLoad.mockResolvedValue(placed(null, before)); await resume();
    expect(asks()).toHaveLength(1);
    expect(tree.root.findByProps({ testID: 'ai-task-context' }).findAllByType('PointAsk' as React.ElementType)).toHaveLength(1);
    // The person confirms the proposed pin; the ask's own save hands the canonical readback to the screen.
    mockLoad.mockResolvedValue(placed(fromProvider, before));
    await act(async () => ask().onSaved());
    expect(asks()).toHaveLength(0); expect(tree.root.findAllByProps({ testID: 'ai-task-context' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ label: 'Pokaži mesto na mapi' })).toHaveLength(0);
    expect(tree.root.findByProps({ testID: 'ai-conversation-thread' }).findAll(isLine)).toHaveLength(1);
    expect(docked()).toHaveLength(0);
    expect(sentence()).toEqual(['Potvrđeno mesto: Bulevar oslobođenja 65, Novi Sad']);
    expect(line().props.accessibilityLabel).toBe(`Potvrđeno mesto: ${provider}`); // The whole label stays for a screen reader.
    expect(order()).toEqual(['USKOČI: Gde treba da se dođe?', 'Ti: Bulevar oslobođenja 65, Novi Sad', 'PLACE']);
    // The conversation continues below it.
    mockSend.mockImplementation((_id: string, _body: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
    mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
    mockLoad.mockResolvedValue(placed(fromProvider, [...before, ...later]));
    await type('Sutra u deset.'); await act(async () => submit().onPress());
    expect(order()).toEqual(['USKOČI: Gde treba da se dođe?', 'Ti: Bulevar oslobođenja 65, Novi Sad', 'PLACE',
      'Ti: Sutra u deset.', 'USKOČI: Zapisao sam termin.']);
    expect(docked()).toHaveLength(0); expect(tree.root.findAllByProps({ testID: 'ai-task-context' })).toHaveLength(0);
  });

  it('reopens the map editor from the line and returns to the line when it is closed', async () => {
    mockLoad.mockResolvedValue(placed(fromProvider, before)); await resume();
    expect(asks()).toHaveLength(0); expect(flat(line())).toContain('Izmeni');
    expect(line().props).toMatchObject({ accessibilityRole: 'button', accessibilityHint: 'Otvara mapu da promeniš mesto.' });
    await act(async () => line().props.onPress());
    expect(ask()).toMatchObject({ startEditing: true, conversationId: id });
    expect(tree.root.findByType(AiConversationShell).props).toMatchObject({ revealInteractiveContext: true });
    await act(async () => ask().onEditingChange(true));
    // While its editor is open the line stays in history but is not a second way in, and sending waits for the map.
    expect(line().props.onPress).toBeUndefined(); expect(flat(line())).not.toContain('Izmeni');
    expect(tree.root.findByType(AiConversationShell).props.interactiveContextKey).toBeDefined();
    await act(async () => { ask().onEditingChange(false); ask().onClose(); });
    expect(asks()).toHaveLength(0); expect(line().props.onPress).toBeDefined();
    expect(tree.root.findAllByProps({ label: 'Pokaži mesto na mapi' })).toHaveLength(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it.each(['new', 'resumed'])('keeps the next question after location confirmation through %s conversation and later resume', async entry => {
    const question = { ...message('next-price', true, 'Koliki iznos nudiš?'), proposedFactIds: ['need.task_geography'] };
    const initial = [...before, question];
    mockLoad.mockResolvedValue(placed(null, initial));
    if (entry === 'resumed') await resume();
    else {
      mockSend.mockImplementation((_id: string, _body: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
      mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
      await render(); await type('Bulevar oslobođenja 65, Novi Sad'); await act(async () => submit().onPress());
    }
    expect(order()).toEqual(['USKOČI: Gde treba da se dođe?', 'Ti: Bulevar oslobođenja 65, Novi Sad']);
    expect(asks()).toHaveLength(1);
    // Closing or saving without a confirmed canonical point cannot uncover the future question.
    await act(async () => ask().onSaved());
    expect(text()).not.toContain('Koliki iznos nudiš?');
    const withClarification = [...initial, message('place-reply', false, 'Kod ulaza.'), message('clarify-place', true, 'Pomeraj tačku do ulaza.')];
    mockLoad.mockResolvedValue(placed(null, withClarification));
    await act(async () => ask().onSaved());
    expect(text()).not.toContain('Koliki iznos nudiš?');
    mockLoad.mockResolvedValue(placed(fromProvider, withClarification));
    await act(async () => ask().onSaved());
    const expected = ['USKOČI: Gde treba da se dođe?', 'Ti: Bulevar oslobođenja 65, Novi Sad', 'Ti: Kod ulaza.',
      'USKOČI: Pomeraj tačku do ulaza.', 'PLACE', 'USKOČI: Koliki iznos nudiš?'];
    expect(order()).toEqual(expected);
    expect(asks()).toHaveLength(0);
    await act(async () => tree.unmount()); await resume();
    expect(order()).toEqual(expected);
  });

  it('acknowledges a pin the person moved with one local line at the point it happened, without an AI call', async () => {
    mockSend.mockImplementation((_id: string, _body: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
    mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
    mockLoad.mockResolvedValue(placed(fromProvider, before)); await resume();
    mockLoad.mockResolvedValue(placed(fromProvider, [...before, ...later]));
    await type('Sutra u deset.'); await act(async () => submit().onPress());
    expect(order()).toEqual(['USKOČI: Gde treba da se dođe?', 'Ti: Bulevar oslobođenja 65, Novi Sad', 'PLACE',
      'Ti: Sutra u deset.', 'USKOČI: Zapisao sam termin.']);
    const sends = mockSend.mock.calls.length;
    await act(async () => line().props.onPress());
    mockLoad.mockResolvedValue(placed(movedByHand, [...before, ...later]));
    await act(async () => ask().onSaved());
    expect(asks()).toHaveLength(0);
    expect(sentence()).toEqual(['U redu, mesto zadatka je sada: Bulevar oslobođenja 67, Novi Sad.']);
    expect(line().props.accessibilityLabel).toBe('U redu, mesto zadatka je sada: 67, Bulevar oslobođenja, Novi Sad');
    // The acknowledgement belongs where it happened: after the latest message, as the one line for this place.
    expect(order()).toEqual(['USKOČI: Gde treba da se dođe?', 'Ti: Bulevar oslobođenja 65, Novi Sad',
      'Ti: Sutra u deset.', 'USKOČI: Zapisao sam termin.', 'PLACE']);
    expect(mockSend).toHaveBeenCalledTimes(sends); expect(docked()).toHaveLength(0);
  });

  it('waits for both canonical route endpoints before releasing the next question', async () => {
    const route = { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad' }, end: { city: 'Beograd' } };
    const messages = [...before, { ...message('route-next', true, 'Koliko osoba treba?'), proposedFactIds: ['need.task_geography'] }];
    const state = (complete: boolean) => conversation({ messages, facts: [publicFact('need.task_country_code', 'RS'), publicFact('need.task_geography', route),
      { ...publicFact('need.resolved_location', { version: 1, binding: { taskCountryCode: 'RS', geography: route, exactAddress: null },
        points: [{ slot: 'start', latitudeE6: 45258900, longitudeE6: 19832700, origin: { kind: 'MANUAL_PIN' } },
          ...(complete ? [{ slot: 'end', latitudeE6: 44820000, longitudeE6: 20460000, origin: { kind: 'MANUAL_PIN' } }] : [])] }), privacyClass: 'PRIVATE' }] });
    mockLoad.mockResolvedValue(state(false)); await resume();
    expect(asks()).toHaveLength(1); expect(text()).not.toContain('Koliko osoba treba?');
    await act(async () => ask().onSaved());
    expect(text()).not.toContain('Koliko osoba treba?');
    mockLoad.mockResolvedValue(state(true)); await act(async () => ask().onSaved());
    expect(asks()).toHaveLength(0);
    expect(order().slice(-2)).toEqual(['PLACE', 'USKOČI: Koliko osoba treba?']);
  });

  it('closes a reopened editor once its save is confirmed, even when the same place was confirmed again', async () => {
    mockLoad.mockResolvedValue(placed(fromProvider, before)); await resume();
    await act(async () => line().props.onPress());
    expect(asks()).toHaveLength(1);
    await act(async () => ask().onSaved());
    expect(asks()).toHaveLength(0); expect(tree.root.findAllByProps({ testID: 'ai-task-context' })).toHaveLength(0);
    expect(sentence()).toEqual(['Potvrđeno mesto: Bulevar oslobođenja 65, Novi Sad']);
    expect(order()).toEqual(['USKOČI: Gde treba da se dođe?', 'Ti: Bulevar oslobođenja 65, Novi Sad', 'PLACE']);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('keeps the line but offers no edit while a send is in flight', async () => {
    const held = deferred(); mockSend.mockReturnValueOnce(held.promise);
    mockLoad.mockResolvedValue(placed(fromProvider, before)); await resume();
    await type('Još nešto.'); await act(async () => { void submit().onPress(); });
    expect(line().props.onPress).toBeUndefined(); expect(tree.root.findAllByProps({ testID: 'ai-recovery-in-thread' })).toHaveLength(0);
    await act(async () => held.resolve(turn(mockSend.mock.calls[0][2], 'SUCCEEDED')));
  });
});

it('does not treat old city coordinates as confirmed for a new city with the same slot', async () => {
  const oldGeography = { mode: 'STATIONARY', start: { city: 'Novi Sad' } };
  const geography = publicFact('need.task_geography', { mode: 'STATIONARY', start: { city: 'Beograd' } });
  const placed = publicFact('need.resolved_location', { version: 1,
    binding: { taskCountryCode: 'RS', geography: oldGeography, exactAddress: null },
    points: [{ slot: 'start', latitudeE6: 45230000, longitudeE6: 19830000, origin: { kind: 'MANUAL_PIN' } }] });
  mockLoad.mockResolvedValue(conversation({ facts: [geography, publicFact('need.task_country_code', 'RS'), placed] }));
  await resume();
  expect(text()).not.toContain('Proveri mesto na mapi, da onaj ko uskoči zna gde treba da dođe.');
  expect(tree.root.findByType('PointAsk' as React.ElementType).props.conversationId).toBeDefined();
  noSummary();
});

it('respects reduced motion for screen entry and the options panel', async () => {
  mockReduced = true; await render();
  expect(tree.root.findAllByType('AnimatedView' as React.ElementType)).toHaveLength(0);
  await act(async () => tree.unmount());
  // The options panel is the sheet engine since 2026-09-24: under reduced motion it opens without its settle.
  await resume(); await options();
  expect(tree.root.findByType(BottomSheet).props).toMatchObject({ animateOnMount: false, animationConfigs: { duration: 0 } });
});

it('shows actual typed fixed dates and times in Serbian time, in the app’s one format', async () => {
  mockLoad.mockResolvedValue(conversation({ facts: [...completeFacts().filter(f => f.key !== 'need.schedule_kind'), publicFact('need.schedule_kind', 'FIXED_WINDOW'),
    publicFact('need.starts_at', '2026-09-10T16:00:00Z'), publicFact('need.ends_at', '2026-09-10T17:00:00Z')] }));
  // Review r4 ra item 8: the card writes the window as every agreed term is written (src/lib/vreme.ts), read in Serbian
  // time and named so on a phone set elsewhere (the suite runs in UTC). It said "(vreme u Beogradu)" in a format of its own.
  await resume();
  expect(text()).toContain('10. sep · 18:00–19:00 (po vremenu u Srbiji)');
  expect(text()).not.toContain('vreme u Beogradu'); expect(text()).not.toContain('Tačan termin');
});
it('omits an incomplete fixed interval without inventing an end time', async () => {
  mockLoad.mockResolvedValue(conversation({ facts: [...completeFacts().filter(f => f.key !== 'need.schedule_kind'), publicFact('need.schedule_kind', 'FIXED_WINDOW'),
    publicFact('need.starts_at', '2026-09-10T16:00:00Z')] }));
  await resume();
  expect(text()).not.toContain('18:00'); expect(text()).not.toContain('Tačan termin');
});
it.each([[5, '5 osoba'], [11, '11 osoba'], [14, '14 osoba'], [22, '22 osobe']])('uses the correct people label for %s', async (count, label) => {
  mockLoad.mockResolvedValue(conversation({ facts: [...completeFacts().filter(f => f.key !== 'need.people_needed'), publicFact('need.people_needed', count)] }));
  await resume();
  expect(text()).toContain(label as string);
});

// Owner-requested pre-HTML stabilization: terminal conversation is not a dead end.
it.each(['COMPLETED', 'ABANDONED'] as const)('starts a separate owned Task after %s without changing the first one', async status => {
  const saved = conversation({ status }); saved.review.boundNeedId = status === 'COMPLETED' ? other : null;
  mockParams = { conversationId: id }; mockLoad.mockResolvedValue(saved); await resume();
  await options();
  const start = menuItem('Novi zadatak').onPress;
  await act(async () => { start(); start(); }); expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  const destination = mockRouter.replace.mock.calls[0][0];
  expect(destination.pathname).toBe('/nova'); expect(destination.params.conversationId).toBeUndefined();
  expect(destination.params.entryKey).toMatch(/^[a-f0-9-]{36}$/);
  mockParams = destination.params;
  mockOpen.mockImplementation(requestId => Promise.resolve(ok({ conversationId: other, clientRequestId: requestId })));
  mockLoad.mockResolvedValue(conversation({ conversationId: other })); await update();
  // The second Task is a blank screen until it is spoken to, exactly like the first one was.
  expect(mockOpen).not.toHaveBeenCalled();
  await openKeyboard();
  expect(input().value).toBe(''); expect(input().editable).toBe(true);
  expect(mockAbandon).not.toHaveBeenCalled(); expect(mockSend).not.toHaveBeenCalled();
  await blur(); await focus(); expect(mockOpen).not.toHaveBeenCalled();
  await type(); await act(async () => submit().onPress());
  expect(mockOpen).toHaveBeenCalledTimes(1); expect(mockSend.mock.calls[0][0]).toBe(other);
  expect(mockAbandon).not.toHaveBeenCalled();
});
it('retains the new owned-open request after an unknown second-Task open outcome', async () => {
  mockLoad.mockResolvedValue(conversation({ status: 'COMPLETED' })); await resume();
  await options();
  await act(async () => menuItem('Novi zadatak').onPress());
  mockParams = mockRouter.replace.mock.calls[0][0].params; mockOpen.mockResolvedValueOnce(unknown());
  await update();
  mockLoad.mockResolvedValue(conversation());
  await type(); await act(async () => submit().onPress());
  const key = mockOpen.mock.calls[0][0];
  // The outcome is unknown, so the retry asks for the same conversation rather than another one.
  await act(async () => button('Proveri').onPress());
  await type(); await act(async () => submit().onPress());
  expect(mockOpen.mock.calls[1][0]).toBe(key);
});
it('cannot use a retained new-Task action after losing its account or focus', async () => {
  mockLoad.mockResolvedValue(conversation({ status: 'COMPLETED' })); await resume();
  await options(); const old = menuItem('Novi zadatak').onPress; await blur(); await focus(); await act(async () => old());
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
it('does not advertise a new-Task bypass for an open safety-blocked conversation', async () => {
  mockLoad.mockResolvedValue(conversation({ safety: 'BLOCK' })); await resume();
  expect(menuItems('Novi zadatak')).toHaveLength(0);
  await options(); expect(menuItems('Novi zadatak')).toHaveLength(0);
});
it.each(['invalid', [id]])('rejects malformed new-entry key %s without creating a conversation', async entryKey => {
  mockParams = { entryKey }; await render(); expect(mockOpen).not.toHaveBeenCalled();
});
it('normal successful send clears the composer after the actual turn readback', async () => {
  mockSend.mockImplementation((_id: string, _body: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
  mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
  await render(); await type('  Treba preneti ormar sutra.  '); await act(async () => submit().onPress());
  expect(input().value).toBe(''); expect(input().editable).toBe(true); expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend.mock.calls[0][1]).toBe('Treba preneti ormar sutra.');
});

function recovery(status: ReturnType<typeof turn>['podatak'], cancelled = false, dispatched = false) {
  return ok({ accountId: mockSession.user.id, conversationId: id, clientRequestId: status.clientRequestId,
    conversationStatus: 'OPEN', turn: status, providerDispatched: dispatched, cancelled,
    canCancel: !cancelled && !dispatched && status.state !== 'SUCCEEDED', authoritative: true });
}
it('restores only the opaque pending IDs after remount before any open or provider request', async () => {
  await render(); await type('Private typed message'); await act(async () => submit().onPress());
  const requestId = mockSend.mock.calls[0][2];
  expect(await aiTurnIntentJournal.load(mockSession.user.id)).toEqual({ accountId: mockSession.user.id, conversationId: id, clientRequestId: requestId });
  expect(String(await AsyncStorage.getItem('uskoci.ai.turn.intent.v1.' + mockSession.user.id))).not.toContain('Private typed message');
  await act(async () => tree.unmount()); mockOpen.mockClear();
  await render(); expect(mockOpen).not.toHaveBeenCalled(); expect(mockRecover).toHaveBeenLastCalledWith(id, requestId);
  expect(mockSend).toHaveBeenCalledTimes(1); expect(input().value).toBe(''); expect(input().editable).toBe(false);
  expect(button('Otkaži slanje poruke')).toBeDefined();
});
it('restored absent intent is never auto retried and clears only after exact cancellation readback', async () => {
  const requestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  await aiTurnIntentJournal.save({ accountId: mockSession.user.id, conversationId: id, clientRequestId: requestId });
  await render(); expect(mockSend).not.toHaveBeenCalled();
  const cancelled = recovery(turn(requestId, 'FAILED', false).podatak, true);
  mockCancel.mockResolvedValue(cancelled); mockRecover.mockResolvedValue(cancelled);
  await act(async () => button('Otkaži slanje poruke').onPress());
  expect(mockCancel).toHaveBeenCalledWith(id, requestId); expect(await aiTurnIntentJournal.load(mockSession.user.id)).toBeNull();
  await openKeyboard();
  expect(input().editable).toBe(true); await type('Nova poruka');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Pošalji poruku' }).props.onPress());
  expect(mockSend.mock.calls[0][2]).not.toBe(requestId);
});
it('an older server returning unresolved dispatch cannot authorize journal retirement', async () => {
  const requestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const intent = { accountId: mockSession.user.id, conversationId: id, clientRequestId: requestId };
  await aiTurnIntentJournal.save(intent); await render();
  const dispatched = recovery(turn(requestId, 'PROCESSING', false).podatak, false, true);
  mockCancel.mockResolvedValue(dispatched); mockRecover.mockResolvedValue(dispatched);
  await act(async () => button('Otkaži slanje poruke').onPress());
  expect(await aiTurnIntentJournal.load(mockSession.user.id)).toEqual(intent);
  expect(input().editable).toBe(false); expect(tree.root.findAllByProps({ label: 'Otkaži slanje poruke' })).toHaveLength(0);
  expect(mockSend).not.toHaveBeenCalled();
});
it('canonical success after restart restores conversation and retires the UUID without another send', async () => {
  const requestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  await aiTurnIntentJournal.save({ accountId: mockSession.user.id, conversationId: id, clientRequestId: requestId });
  mockTurn.mockResolvedValue(turn(requestId, 'SUCCEEDED'));
  mockLoad.mockResolvedValue(conversation({ messages: [{ id, fromAi: false, body: 'Canonical private message', safety: null, proposedFactIds: [] }] }));
  await render(); expect(text()).toContain('Canonical private message'); expect(await aiTurnIntentJournal.load(mockSession.user.id)).toBeNull();
  await openKeyboard();
  expect(mockSend).not.toHaveBeenCalled(); expect(input().editable).toBe(true);
});
it('a known terminal failure restores a bound edit without abandoning it or resending automatically', async () => {
  const requestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  await aiTurnIntentJournal.save({ accountId: mockSession.user.id, conversationId: id, clientRequestId: requestId });
  mockRecover.mockResolvedValue(recovery(turn(requestId, 'FAILED', false).podatak, false, true));
  const bound = conversation(); bound.review.boundNeedId = other; mockLoad.mockResolvedValue(bound);
  await render();
  expect(await aiTurnIntentJournal.load(mockSession.user.id)).toBeNull();
  await openKeyboard();
  expect(input().editable).toBe(true); expect(mockSend).not.toHaveBeenCalled(); expect(mockAbandon).not.toHaveBeenCalled();
  expect(text()).toContain('Asistent nije uzeo u obzir prethodnu poruku.');
});
it('does not dispatch if opaque UUID persistence fails and keeps the unsent typed body', async () => {
  await render(); await type('Unsent private draft');
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('storage unavailable'));
  await act(async () => submit().onPress());
  expect(mockSend).not.toHaveBeenCalled(); expect(input().value).toBe('Unsent private draft');
});
it('rechecks account ABA after persistence before any network send', async () => {
  const held = deferred<void>();
  await render(); await type(); jest.mocked(AsyncStorage.setItem).mockImplementationOnce(() => held.promise);
  await act(async () => { void submit().onPress(); });
  mockSession = { user: { id: mockSession.user.id }, accountRevision: 3 }; await update();
  await act(async () => held.resolve()); expect(mockSend).not.toHaveBeenCalled();
});
it('routes a conflicting resumed conversation back to the pending UUID owner without sending', async () => {
  await aiTurnIntentJournal.save({ accountId: mockSession.user.id, conversationId: id, clientRequestId: other });
  mockParams = { conversationId: other }; await render();
  expect(mockOpen).not.toHaveBeenCalled(); expect(mockRecover).not.toHaveBeenCalled(); expect(mockLoad).not.toHaveBeenCalled();
  await act(async () => button('Otvori prethodni razgovor').onPress());
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: id } });
});
it('unknown cancellation response retains the exact UUID across another restart', async () => {
  const intent = { accountId: mockSession.user.id, conversationId: id, clientRequestId: other };
  await aiTurnIntentJournal.save(intent); await render(); await act(async () => button('Otkaži slanje poruke').onPress());
  expect(await aiTurnIntentJournal.load(mockSession.user.id)).toEqual(intent);
  await act(async () => tree.unmount()); await render();
  expect(mockRecover).toHaveBeenLastCalledWith(id, other); expect(mockSend).not.toHaveBeenCalled();
});
it('restored bound-edit dispatched exit explains retained cost and unlocks only after canonical cancellation', async()=>{
  const intent={accountId:mockSession.user.id,conversationId:id,clientRequestId:other};
  await aiTurnIntentJournal.save(intent);mockParams={conversationId:id};
  mockLoad.mockResolvedValue(conversation({review:{...conversation().review,boundNeedId:other}}));
  mockRecover.mockResolvedValue(ok({...recovery(turn(other,'PROCESSING').podatak,false,true).podatak,canCancel:true}));
  await render();expect(button('Odustani od odgovora').disabled).toBe(false);
  await openKeyboard();
  expect(text()).toContain('poruka je ipak poslata');expect(input().editable).toBe(false);
  const cancelled=recovery(turn(other,'FAILED').podatak,true,true);
  mockCancel.mockResolvedValue(cancelled);mockRecover.mockResolvedValue(cancelled);
  await act(async()=>button('Odustani od odgovora').onPress());
  expect(mockCancel).toHaveBeenCalledWith(id,other);expect(await aiTurnIntentJournal.load(intent.accountId)).toBeNull();
  await openKeyboard();
  expect(input().editable).toBe(true);expect(text()).toContain('Odgovor je zaustavljen. Poruka je ipak poslata');expect(mockSend).not.toHaveBeenCalled();
  await type('Izričita nova poruka');await act(async()=>tree.root.findByProps({accessibilityLabel:'Pošalji poruku'}).props.onPress());
  expect(mockSend).toHaveBeenCalledTimes(1);expect(mockSend.mock.calls[0][2]).not.toBe(other);
});
it('lost dispatched cancellation ACK preserves journal until restart reads its terminal receipt',async()=>{
  const intent={accountId:mockSession.user.id,conversationId:id,clientRequestId:other};await aiTurnIntentJournal.save(intent);
  mockRecover.mockResolvedValue(ok({...recovery(turn(other,'PROCESSING').podatak,false,true).podatak,canCancel:true}));
  await render();await act(async()=>button('Odustani od odgovora').onPress());
  await openKeyboard();
  expect(await aiTurnIntentJournal.load(intent.accountId)).toEqual(intent);expect(input().editable).toBe(false);
  await act(async()=>tree.unmount());mockRecover.mockResolvedValue(recovery(turn(other,'FAILED').podatak,true,true));await render();
  await openKeyboard();
  expect(await aiTurnIntentJournal.load(intent.accountId)).toBeNull();expect(input().editable).toBe(true);expect(mockSend).not.toHaveBeenCalled();
});
it('completion winning dispatched cancellation shows the actual result without claiming an owner exit',async()=>{
  const intent={accountId:mockSession.user.id,conversationId:id,clientRequestId:other};await aiTurnIntentJournal.save(intent);
  mockRecover.mockResolvedValue(ok({...recovery(turn(other,'PROCESSING').podatak,false,true).podatak,canCancel:true}));await render();
  const completed=recovery(turn(other,'SUCCEEDED').podatak,false,true);mockCancel.mockResolvedValue(completed);mockRecover.mockResolvedValue(completed);
  mockLoad.mockResolvedValue(conversation({messages:[{id:other,fromAi:true,body:'Stvarni završen odgovor',safety:'ALLOW',proposedFactIds:[]}]}));
  await act(async()=>button('Odustani od odgovora').onPress());
  expect(text()).toContain('Stvarni završen odgovor');expect(text()).not.toContain('Odgovor je zaustavljen. Poruka je ipak poslata');
  expect(await aiTurnIntentJournal.load(intent.accountId)).toBeNull();expect(mockSend).not.toHaveBeenCalled();
});
it('late dispatched cancellation after blur cannot retire the journal or load another conversation',async()=>{
  const intent={accountId:mockSession.user.id,conversationId:id,clientRequestId:other};await aiTurnIntentJournal.save(intent);
  mockRecover.mockResolvedValue(ok({...recovery(turn(other,'PROCESSING').podatak,false,true).podatak,canCancel:true}));await render();
  const held=deferred();mockCancel.mockReturnValue(held.promise);await act(async()=>button('Odustani od odgovora').onPress());
  await blur();const reads=mockLoad.mock.calls.length;await act(async()=>held.resolve(recovery(turn(other,'FAILED').podatak,true,true)));
  expect(await aiTurnIntentJournal.load(intent.accountId)).toEqual(intent);expect(mockLoad).toHaveBeenCalledTimes(reads);expect(mockSend).not.toHaveBeenCalled();
});

describe('conversation and current facts have separate presentation', () => {
  const said = (body: string, proposedFactIds: string[]) => ({ id: `m-${proposedFactIds.join('-') || 'none'}`,
    fromAi: true, body, safety: null, proposedFactIds });

  it('shows the typed title in the card without repeating its display label under the reply', async () => {
    mockLoad.mockResolvedValue(conversation({
      facts: completeFacts('Krečenje stana'),
      messages: [said('Zabeležio sam krečenje stana.', ['need.title'])],
    }));
    await resume();
    expect(text()).toContain('Krečenje stana');
    expect(text()).toContain('Zabeležio sam krečenje stana.');
    expect(text()).not.toContain('Naslov');
    expect(text()).not.toContain('public display');
  });

  it('keeps private facts out of the thread decorations', async () => {
    mockLoad.mockResolvedValue(conversation({
      facts: [{ id: 'address', key: 'need.exact_address', value: 'Lenke Dunđerski 11', displayValue: 'Lenke Dunđerski 11',
        valueType: 'TEXT', privacyClass: 'PRIVATE', requiredForDraft: false, status: 'CONFIRMED',
        source: 'EXPLICIT_USER_ANSWER', evidence: null }],
      messages: [said('Zapamtio sam adresu.', ['address'])],
    }));
    await resume();
    expect(text()).toContain('Zapamtio sam adresu.');
    expect(text()).not.toContain('Tačna adresa');
    expect(text()).not.toContain('Lenke Dunđerski 11');
  });

  it('says nothing under a turn that took nothing, and under the person\u2019s own words', async () => {
    mockLoad.mockResolvedValue(conversation({
      facts: completeFacts('Krečenje stana'),
      messages: [said('Pitanje bez izdvojenih podataka.', []),
        { id: 'mine', fromAi: false, body: 'Treba mi krečenje.', safety: null, proposedFactIds: ['need.title'] }],
    }));
    await render();
    expect(text()).not.toContain('Naslov');
  });
});


test('saved task photos stay visible from the facts through authorized asset references only when the photo read fails', async () => {
  const ref = `${id}/v5/${other}/${'a'.repeat(64)}.jpg`;
  mockReadPhotos.mockResolvedValue({ ok: false, kod: 'MEDIA_UNAVAILABLE', poruka: 'Fotografije nisu učitane.' });
  mockLoad.mockResolvedValue(conversation({ facts: [publicFact('need.public_photo_paths', [ref, ref, 'https://example.test/private.jpg'])] }));
  await resume();
  const thread = tree.root.findByProps({ testID: 'ai-conversation-thread' });
  const photos = thread.findAllByType('AuthorizedPhoto' as React.ElementType);
  expect(photos.map(photo => photo.props.assetId)).toEqual([other]);
  expect(text()).toContain('Dodata fotografija (1/6)'); expect(text()).toContain('Fotografije nisu učitane.');
  // The read failed (a read that did not arrive, not a send that is not known), so the way to try again is on screen, in the table's word for
  // it; nothing navigates away.
  mockReadPhotos.mockResolvedValue(ok({ conversationId: id, accountId: mockSession.user.id, photos: [], ready: true, authoritative: true }));
  await act(async () => tree.root.findByProps({ label: 'Pokušaj ponovo' }).props.onPress());
  expect(mockReadPhotos).toHaveBeenCalledTimes(2); expect(mockRouter.push).not.toHaveBeenCalled();
});

// Owner, 2026-10-07: "chat should use ready-made elements, e.g. adding photos must make sense". The "+" opens the shared sheet
// in the conversation; a chosen photo goes up through the task photo path and becomes a line of the thread where it was added.
describe('adding photos inside the conversation', () => {
  const photo = { bytes: new Uint8Array([255, 216, 255]).buffer, contentType: 'image/jpeg', width: 4, height: 3 };
  const message = (messageId: string, fromAi: boolean, body: string) => ({ id: messageId, fromAi, body, safety: null, proposedFactIds: [] });
  const isLine = (node: { type: unknown; props: { testID?: unknown } }) => typeof node.type === 'string' && node.props.testID === 'task-photo-line';
  const order = () => tree.root.findByProps({ testID: 'ai-conversation-thread' }).findAll(node => isLine(node)
    || (typeof node.props.accessibilityLabel === 'string' && /^(Ti|USKOČI): /.test(node.props.accessibilityLabel)))
    .map(node => isLine(node) ? 'PHOTOS' : node.props.accessibilityLabel);
  const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); }); };
  const uploaded = (assetId: string) => mockUploadPhoto.mockImplementation(async (input: { clientRequestId: string; conversationId: string }) => {
    const asset = { scope: 'TASK', conversationId: input.conversationId, clientRequestId: input.clientRequestId, assetId, state: 'READY', selected: true };
    mockServerPhotos = [...mockServerPhotos, asset]; return ok(asset);
  });

  it('before the first word, choosing Galerija opens the conversation with the screen\'s key, sends no AI turn, and adds the photo', async () => {
    const asset = 'dddddddd-dddd-4ddd-8ddd-000000000001';
    mockLoad.mockImplementation(async () => conversation());
    mockPickPhotos.mockResolvedValue({ photos: [photo], rejected: 0, firstError: null }); uploaded(asset);
    await render();
    await act(async () => plus().onPress());
    await act(async () => tree.root.findByType(PhotoAttachSheet).props.onPick('LIBRARY'));
    await flush();
    expect(mockOpen).toHaveBeenCalledTimes(1); expect(mockOpen.mock.calls[0][0]).toBe('aaaaaaaa-aaaa-4aaa-8aaa-000000000001');
    expect(mockPickPhotos).toHaveBeenCalledTimes(1); expect(mockPickPhotos.mock.calls[0][2]).toMatchObject({ limit: 6 });
    expect(mockUploadPhoto).toHaveBeenCalledTimes(1); expect(mockUploadPhoto.mock.calls[0][0]).toMatchObject({ conversationId: id, bytes: photo.bytes });
    expect(mockSend).not.toHaveBeenCalled();
    // Only the photo journal is written: no AI turn intent.
    expect(jest.mocked(AsyncStorage.setItem).mock.calls.map(([key]) => key).every(key => String(key).startsWith('uskoci:media-upload:'))).toBe(true);
    // The photo is in the thread, never docked above the composer, with one local caption and the shared viewer.
    const thread = tree.root.findByProps({ testID: 'ai-conversation-thread' });
    expect(thread.findAllByType('AuthorizedPhoto' as React.ElementType).map(node => node.props.assetId)).toEqual([asset]);
    expect(tree.root.findByProps({ testID: 'ai-composer-footer' }).findAllByType('AuthorizedPhoto' as React.ElementType)).toHaveLength(0);
    expect(text()).toContain('Dodata fotografija (1/6)');
    await act(async () => thread.findByType('AuthorizedPhoto' as React.ElementType).props.open.onPress());
    expect(tree.root.findByType(PhotoViewer).props).toMatchObject({ photos: [{ assetId: asset }], title: 'Fotografije zadatka' });
  });

  it('keeps the photos where they were added while the conversation goes on, and removes one only after a question', async () => {
    const asset = 'dddddddd-dddd-4ddd-8ddd-000000000002';
    const before = [message('pm1', true, 'Šta treba da se uradi?'), message('pm2', false, 'Popravka slavine.')];
    mockLoad.mockResolvedValue(conversation({ messages: before }));
    mockPickPhotos.mockResolvedValue({ photos: [photo], rejected: 0, firstError: null }); uploaded(asset);
    // A request identity of its own: where a photo sits is remembered per identity for the life of the app.
    mockCounter = 700;
    await resume();
    await act(async () => plus().onPress());
    await act(async () => tree.root.findByType(PhotoAttachSheet).props.onPick('LIBRARY'));
    await flush();
    expect(order()).toEqual(['USKOČI: Šta treba da se uradi?', 'Ti: Popravka slavine.', 'PHOTOS']);
    mockSend.mockImplementation((_id: string, _body: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
    mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
    mockLoad.mockResolvedValue(conversation({ messages: [...before, message('pm3', false, 'Sutra posle podne.'), message('pm4', true, 'Zapisao sam.')] }));
    await type('Sutra posle podne.'); await act(async () => submit().onPress());
    expect(order()).toEqual(['USKOČI: Šta treba da se uradi?', 'Ti: Popravka slavine.', 'PHOTOS', 'Ti: Sutra posle podne.', 'USKOČI: Zapisao sam.']);
    // The corner X asks first; only the answer removes the photo from the draft.
    mockRemovePhoto.mockResolvedValue(ok({ conversationId: id, accountId: mockSession.user.id, photos: [], ready: true, authoritative: true }));
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Ukloni fotografiju 1' }).props.onPress());
    expect(mockRemovePhoto).not.toHaveBeenCalled();
    expect(leaveSheet().props).toMatchObject({ title: 'Ukloniti fotografiju?', confirmLabel: 'Ukloni', tone: 'danger' });
    await act(async () => { await leaveSheet().props.onConfirm(); });
    expect(mockRemovePhoto).toHaveBeenCalledWith({ conversationId: id, assetId: asset });
    expect(order()).not.toContain('PHOTOS');
  });

  it('a denied camera keeps the gallery as the way forward, inside the conversation', async () => {
    mockLoad.mockResolvedValue(conversation({ messages: [message('pm5', true, 'Kako izgleda?')] }));
    mockPickPhotos.mockRejectedValue(Object.assign(new Error('PERMISSION'), { code: 'PERMISSION' }));
    await resume();
    await act(async () => plus().onPress());
    await act(async () => tree.root.findByType(PhotoAttachSheet).props.onPick('CAMERA'));
    await flush();
    const recovery = tree.root.findByProps({ testID: 'ai-conversation-thread' }).findByType(require('../../ui/system/PermissionRecovery').PermissionRecovery);
    expect(recovery.props.alternative).toBe('Galerija');
  });
});
