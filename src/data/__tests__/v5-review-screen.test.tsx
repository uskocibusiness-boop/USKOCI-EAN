import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AiTaskPublicationCommand, AiTaskReviewEnvelope } from '../aiTaskReviewClientService';
import type { NeedLocationInput } from '../../contracts/location';
import { rememberIntakeReviewReturn, retireIntakeReviewReturn } from '../intakeReviewReturn';
import { PUBLISHED_MOMENT_MS } from '../../ui/objava/PublishedMoment';
import { APPLICATION_PROMISE } from '../ownTaskStanding';

const OWNER = '11111111-1111-4111-8111-111111111111', OTHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONVERSATION = '22222222-2222-4222-8222-222222222222', REVIEW = '33333333-3333-4333-8333-333333333333';
const NEED = '55555555-5555-4555-8555-555555555555';
let mockSession = { user: { id: OWNER }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true, mockCounter = 0;
let mockParams: { conversationId?: string | string[]; intakeReturn?: string | string[] } = { conversationId: CONVERSATION };
const mockLatest = jest.fn(), mockRead = jest.fn(), mockPrepare = jest.fn(), mockAccept = jest.fn(), mockResume = jest.fn();
const mockNeed = jest.fn(), mockCorrect = jest.fn(), mockOpenEdit = jest.fn(), mockAlert = jest.fn(), mockDraft = jest.fn();
const mockLocationRead = jest.fn(), mockLocationSave = jest.fn(), mockCancelResolver = jest.fn();
const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockHardwareBack = new Set<() => boolean>();
jest.mock('../aiTaskReviewClientService', () => ({ aiTaskReviewClientService: {
  readLatest: (...args: unknown[]) => mockLatest(...args), read: (...args: unknown[]) => mockRead(...args),
  prepare: (...args: unknown[]) => mockPrepare(...args), acceptAndPublish: (...args: unknown[]) => mockAccept(...args),
  resume: (...args: unknown[]) => mockResume(...args), acceptAsDraft: (...args: unknown[]) => mockDraft(...args),
} }));
jest.mock('../index', () => ({ izvor: { potreba: (...args: unknown[]) => mockNeed(...args) },
  aiNeedV2Izvor: { correctFact: (...args: unknown[]) => mockCorrect(...args), openEditConversation: (...args: unknown[]) => mockOpenEdit(...args) } }));
jest.mock('../locationClientService', () => ({ needLocationClientService: {
  read: (...args: unknown[]) => mockLocationRead(...args), save: (...args: unknown[]) => mockLocationSave(...args),
} }));
jest.mock('../productionLocationResolver', () => ({ createProductionLocationResolver: () => ({ cancel: mockCancelResolver }) }));
jest.mock('../../ui/location/NeedLocationForm', () => ({ NeedLocationForm: 'LocationForm' }));
jest.mock('../../ui/aiFirst/ResponseDeadlineEditor', () => ({ ResponseDeadlineEditor: 'DeadlineEditor' }));
jest.mock('../../ui/calendar/CalendarControls', () => ({ CivilField: 'CivilField' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto', mediaAssetId: () => null }));
// The preview's read-only public map is MapLibre; the harness draws it as a host element.
jest.mock('../../ui/location/LocationMapPreview', () => ({ LocationMapPreview: 'LocationMapPreview' }));
jest.mock('../../ui/system/SuccessMark', () => ({ SuccessMark: 'SuccessMark' }));
jest.mock('../../ui/support/SupportContextEntry', () => ({ SupportContextEntry: 'SupportContextEntry' }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++mockCounter).padStart(12, '0')}` }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'Alert') return { alert: (...args: unknown[]) => mockAlert(...args) };
  if (key === 'BackHandler') return { addEventListener: (_: string, handler: () => boolean) => {
    mockHardwareBack.add(handler); return { remove: () => mockHardwareBack.delete(handler) }; } };
  return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import ReviewRoute from '../../app/(app)/pregled-zadatka';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { sys } from '../../ui/system/tokens';

const ok = (podatak: unknown) => ({ ok: true, podatak });
const unknownOutcome = () => ({ ok: false, kod: 'TASK_REVIEW_OUTCOME_UNCONFIRMED', poruka: 'Ishod objave nije potvrđen.' });
function review(): AiTaskReviewEnvelope {
  return { reviewId: REVIEW, accountId: OWNER, conversationId: CONVERSATION, schemaVersion: 'NEED_FACT_V2', draftId: null, draftRevision: 0,
    displayedContentDigest: 'a'.repeat(64), factsRevision: 'b'.repeat(64), sourceTurnRevision: 2, geographyRevision: 'c'.repeat(64),
    expiresAt: '2026-10-01T00:00:00Z', responseDeadline: null, location: null, canAccept: true, safety: 'ALLOW', missingRequired: [],
    publicProjection: [{ id: 'title', key: 'need.title', value: 'Prenos ormara', displayValue: 'Prenos ormara',
      privacyClass: 'PUBLIC', source: 'AI_INFERENCE', status: 'NEEDS_CONFIRMATION' }],
    ownerPrivateProjection: [{ id: 'address', key: 'need.exact_address', value: 'Privatna 42', displayValue: 'Privatna 42',
      privacyClass: 'PRIVATE', source: 'EXPLICIT_USER_ANSWER', status: 'NEEDS_CONFIRMATION' }],
  };
}
function command(state: AiTaskPublicationCommand['state'] = 'ACCEPTED'): AiTaskPublicationCommand {
  return { reviewId: REVIEW, clientRequestId: '44444444-4444-4444-8444-444444444444', needId: NEED, needRevision: 1,
    state, evaluation: null, published: state === 'PUBLISHED' ? { needId: NEED, status: 'PUBLISHED',
      publishedAt: '2026-09-12T12:00:01Z', responseDeadline: null, idempotentReplay: false } : null, authoritative: true };
}
function location(label: string): NeedLocationInput {
  const geography = { mode: 'STATIONARY' as const, start: { city: 'Beograd', area: label } };
  const exactAddress = `Adresa ${label}`;
  return { taskCountryCode: 'RS', geography, exactAddress, accessNotes: null,
    resolvedLocation: { version: 1, binding: { taskCountryCode: 'RS', geography, exactAddress },
      points: [{ slot: 'start', latitudeE6: 44810000, longitudeE6: 20460000, origin: { kind: 'MANUAL_PIN' } }] } };
}
function locatedReview(value: NeedLocationInput, geographyRevision = 'c'.repeat(64)): AiTaskReviewEnvelope {
  return { ...review(), location: value, geographyRevision,
    ownerPrivateProjection: [{ ...review().ownerPrivateProjection[0], value: value.exactAddress!, displayValue: value.exactAddress! }] };
}
const canonicalLocation = (value: NeedLocationInput, revision = 'c'.repeat(64)) => ({
  accountId: OWNER, conversationId: CONVERSATION, editable: true, confirmed: false, revision, value,
});
const notReadyCommand = (): AiTaskPublicationCommand => ({ ...command('EVALUATED'), evaluation: {
  kind: 'NOT_READY', needId: NEED, needRevision: 1, authoritativeDecision: false, code: 'EVALUATOR_UNAVAILABLE',
} });
function deferred<T = unknown>() { let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<ReviewRoute />); }); };
const update = async () => { await act(async () => tree.update(<ReviewRoute />)); };
/** A command of the review: a button (`label`) or a word at the end of a line or a row (a `Press` named by its `accessibilityLabel`: "Uredi mesto", "Izmeni, Naslov"). */
const commands = (label: string) => tree.root.findAll(node => node.props?.label === label
  || (node.type === ('Press' as React.ElementType) && node.props?.accessibilityLabel === label));
const action = (label: string) => { const found = commands(label); if (found.length !== 1) throw new Error(`${found.length} commands named "${label}"`); return found[0].props; };
const publish = () => tree.root.findByProps({ accessibilityLabel: 'Objavi zadatak' }).props;
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const blur = async () => { mockFocused = false; await update(); };
const focus = async () => { mockFocused = true; await update(); };
beforeEach(() => {
  jest.clearAllMocks();
  for (const mock of [mockLatest, mockRead, mockPrepare, mockAccept, mockResume, mockNeed, mockCorrect, mockOpenEdit, mockLocationRead, mockLocationSave, mockDraft]) mock.mockReset();
  mockSession = { user: { id: OWNER }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true; mockCounter = 0;
  mockParams = { conversationId: CONVERSATION };
  mockLatest.mockResolvedValue(ok(null)); mockRead.mockResolvedValue(ok({ review: review(), command: null }));
  mockPrepare.mockResolvedValue(ok(review())); mockAccept.mockResolvedValue(unknownOutcome()); mockResume.mockResolvedValue(unknownOutcome());
  mockNeed.mockResolvedValue({ id: NEED, narucilacId: OWNER, revizija: 1, stanje: 'OBJAVLJENA' });
  mockLocationRead.mockResolvedValue(ok({ conversationId: CONVERSATION, revision: 'location-r1', value: null, authoritative: true }));
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it.each([{}, { entryKey: OTHER }, { conversationId: CONVERSATION }])('returns to the exact retained intake identity: %j', async params => {
  const handoff = rememberIntakeReviewReturn({ accountId: OWNER, accountRevision: 1 }, CONVERSATION, params)!;
  mockParams.intakeReturn = handoff.token;
  await render();
  const back = tree.root.findByProps({ accessibilityLabel: 'Nazad u razgovor' }).props.onPress;
  await act(async () => { back(); back(); });
  expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/nova', params });
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockCorrect).not.toHaveBeenCalled();
  retireIntakeReviewReturn(handoff);
});

it.each(['direct', 'external', 'retired', 'wrong-conversation', 'switch', 'ABA'] as const)(
  'opens the canonical conversation when the review has no current retained intake: %s', async kind => {
    const handoff = rememberIntakeReviewReturn({ accountId: OWNER, accountRevision: 1 },
      kind === 'wrong-conversation' ? OTHER : CONVERSATION, {})!;
    if (kind !== 'direct') mockParams.intakeReturn = kind === 'external' ? 'external-token' : handoff.token;
    if (kind === 'retired') retireIntakeReviewReturn(handoff);
    if (kind === 'switch') mockSession = { user: { id: OTHER }, accountRevision: 2 };
    if (kind === 'ABA') mockSession = { user: { id: OWNER }, accountRevision: 3 };
    await render();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Nazad u razgovor' }).props.onPress());
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: CONVERSATION } });
    expect(mockAccept).not.toHaveBeenCalled(); expect(mockCorrect).not.toHaveBeenCalled();
    retireIntakeReviewReturn(handoff);
  });

it.each(['blur', 'switch', 'ABA'] as const)('rejects a retained review Back callback after %s', async change => {
  const handoff = rememberIntakeReviewReturn({ accountId: OWNER, accountRevision: 1 }, CONVERSATION, {})!;
  mockParams.intakeReturn = handoff.token; await render();
  const back = tree.root.findByProps({ accessibilityLabel: 'Nazad u razgovor' }).props.onPress;
  if (change === 'blur') { await blur(); await focus(); }
  else { mockSession = { user: { id: change === 'switch' ? OTHER : OWNER }, accountRevision: change === 'switch' ? 2 : 3 }; await update(); }
  await act(async () => back());
  expect(mockRouter.replace).not.toHaveBeenCalled();
  retireIntakeReviewReturn(handoff);
});

it('prepares the displayed public and private review with one publish action and no per-fact confirmation', async () => {
  await render();
  expect(mockLatest).toHaveBeenCalledWith(CONVERSATION);
  expect(mockPrepare).toHaveBeenCalledWith({ conversationId: CONVERSATION, responseDeadline: null });
  expect(text()).toContain('Prenos ormara'); expect(text()).toContain('Privatni podaci'); expect(text()).toContain('Privatna 42');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Objavi zadatak' })).toHaveLength(1);
  expect(publish().disabled).toBe(false);
  const labels = tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string').map(node => node.props.accessibilityLabel).join(' ');
  expect(labels).not.toMatch(/potvrdi|prihvati podatak/i);
  expect(mockCorrect).not.toHaveBeenCalled(); expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
  expect(mockAlert).not.toHaveBeenCalled();
});

it('says it is confirming changes when the review belongs to a task that already exists', async () => {
  // The conversation offers "Pregledaj izmene" for a bound Need; this screen then said
  // "Objavi zadatak", as if the task were being created now. The server never confused the two:
  // accepting a bound review confirms an edit rather than creating a draft.
  const bound = { ...review(), draftId: NEED, draftRevision: 4 };
  mockRead.mockResolvedValue(ok({ review: bound, command: null })); mockPrepare.mockResolvedValue(ok(bound));
  await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Objavi zadatak' })).toHaveLength(0);
  expect(tree.root.findByProps({ accessibilityLabel: 'Potvrdi izmene i objavi' }).props.disabled).toBe(false);
  // The eyebrow that said "Izmena postojećeg zadatka" is no longer drawn (owner, 2026-09-23); the title below already says it is a review of changes.
  expect(text()).toContain('Pregled izmena');

  // A task being published for the first time still reads as a first publication.
  await act(async () => tree.unmount());
  mockRead.mockResolvedValue(ok({ review: review(), command: null })); mockPrepare.mockResolvedValue(ok(review()));
  await render();
  expect(publish().disabled).toBe(false);
  /* the eyebrow "Ti odlučuješ šta objavljuješ" is no longer drawn (owner, 2026-09-23) */ 
});

it('serializes retained taps to one immutable review command and freezes an unknown result until explicit readback', async () => {
  const held = deferred(); mockAccept.mockReturnValueOnce(held.promise); await render(); const retained = publish().onPress;
  await act(async () => { void retained(); void retained(); });
  expect(mockAccept).toHaveBeenCalledTimes(1);
  expect(mockAccept.mock.calls[0][0]).toEqual({ review: review(), clientRequestId: expect.stringMatching(/^[a-f0-9-]{36}$/) });
  await act(async () => held.resolve(unknownOutcome())); expect(publish().disabled).toBe(true);
  await act(async () => retained()); expect(mockAccept).toHaveBeenCalledTimes(1); expect(mockRead).not.toHaveBeenCalled();
  mockRead.mockResolvedValue(ok({ review: review(), command: command('UNKNOWN_OUTCOME') }));
  // What is not known is checked with the table's one word, "Proveri".
  await act(async () => action('Proveri').onPress());
  expect(mockRead).toHaveBeenCalledWith(REVIEW); expect(mockLatest).toHaveBeenCalledTimes(1);
  expect(mockResume).not.toHaveBeenCalled(); expect(mockAccept).toHaveBeenCalledTimes(1);
  expect(text()).toContain('Ne znamo da li je zadatak objavljen'); expect(mockAlert).not.toHaveBeenCalled();
});

it.each(['ACCEPTED', 'EVALUATING', 'UNKNOWN_OUTCOME'] as const)('restores %s on a fresh screen by read only without automatically resuming publication', async state => {
  mockLatest.mockResolvedValue(ok({ review: review(), command: command(state) })); await render();
  expect(mockPrepare).not.toHaveBeenCalled(); expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Objavi zadatak' })).toHaveLength(0);
  expect(text()).not.toContain('Zadatak je objavljen.');
  expect(tree.root.findAllByProps({ label: 'Izmeni zadatak' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ label: 'Otvori zadatak' })).toHaveLength(0);
  if (state === 'ACCEPTED') {
    // ACCEPTED is a private draft with nothing after it confirmed; the button says so.
    await act(async () => action('Objavi ovaj nacrt').onPress());
    expect(mockResume).toHaveBeenCalledWith(command(state)); expect(mockAccept).not.toHaveBeenCalled();
  }
});

it('opens the existing saved draft explicitly after a terminal NOT_READY without retrying evaluation or publication', async () => {
  const stored = notReadyCommand();
  mockLatest.mockResolvedValue(ok({ review: review(), command: stored }));
  mockOpenEdit.mockResolvedValue(ok({ conversationId: OTHER }));
  await render();
  expect(text()).toContain('privatan nacrt');
  for (const resumeLabel of ['Nastavi objavu', 'Objavi ovaj nacrt']) expect(tree.root.findAllByProps({ label: resumeLabel })).toHaveLength(0);
  expect(mockOpenEdit).not.toHaveBeenCalled();
  const retained = action('Izmeni zadatak').onPress;
  await act(async () => { void retained(); void retained(); });
  expect(mockOpenEdit).toHaveBeenCalledTimes(1); expect(mockOpenEdit).toHaveBeenCalledWith(NEED);
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: OTHER } });
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
});

it('ignores a retained NOT_READY edit after changing account, including its late result', async () => {
  const held = deferred();
  mockLatest.mockResolvedValue(ok({ review: review(), command: notReadyCommand() }));
  mockOpenEdit.mockReturnValueOnce(held.promise);
  await render(); const retained = action('Izmeni zadatak').onPress;
  await act(async () => { void retained(); });
  mockSession = { user: { id: OTHER }, accountRevision: 2 }; await update();
  await act(async () => { void retained(); held.resolve(ok({ conversationId: OTHER })); });
  expect(mockOpenEdit).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
});

it.each([
  ['different Need', { id: OTHER, revizija: 1, stanje: 'OBJAVLJENA' }],
  ['different revision', { id: NEED, revizija: 2, stanje: 'OBJAVLJENA' }],
  ['private draft', { id: NEED, revizija: 1, stanje: 'NACRT' }],
  ['missing Need', null],
])('does not label a stored receipt published before matching Need readback: %s', async (_case, value) => {
  mockLatest.mockResolvedValue(ok({ review: review(), command: command('PUBLISHED') })); mockNeed.mockResolvedValue(value);
  await render(); expect(mockNeed).toHaveBeenCalledWith(NEED);
  expect(text()).toContain('Objava je zabeležena. Ponovo učitaj zadatak');
  expect(text()).not.toContain('Zadatak je objavljen.'); expect(tree.root.findAllByProps({ label: 'Otvori zadatak' })).toHaveLength(0);
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
});

it('shows publication only after the current owned Need revision and published state are read, then opens the task\'s own overview', async () => {
  const held = deferred(); mockLatest.mockResolvedValue(ok({ review: review(), command: command('PUBLISHED') })); mockNeed.mockReturnValueOnce(held.promise);
  await render(); expect(text()).not.toContain('Zadatak je objavljen.');
  await act(async () => held.resolve({ id: NEED, narucilacId: OWNER, revizija: 1, stanje: 'CEKA_PRIJAVE' }));
  expect(text()).toContain('Zadatak je objavljen.'); const retained = action('Otvori zadatak').onPress;
  await act(async () => { retained(); retained(); });
  expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  // The owner lands on the task's own overview (2026-10-07), proved by the hand-off, and not on the Zadaci map.
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/pregled', params: { id: NEED } });
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
});

it.each(['blur', 'account ABA', 'account switch', 'route'] as const)('rejects retained publish and late callbacks after %s', async change => {
  const held = deferred(); mockAccept.mockReturnValueOnce(held.promise); await render(); const retained = publish().onPress;
  await act(async () => { void retained(); });
  if (change === 'blur') await blur();
  else {
    if (change === 'account ABA') mockSession = { user: { id: OWNER }, accountRevision: 3 };
    if (change === 'account switch') mockSession = { user: { id: OTHER }, accountRevision: 2 };
    if (change === 'route') mockParams = { conversationId: OTHER };
    await update();
  }
  const reads = mockRead.mock.calls.length;
  await act(async () => { held.resolve(ok(command('PUBLISHED'))); await retained(); });
  expect(mockAccept).toHaveBeenCalledTimes(1); expect(mockRead).toHaveBeenCalledTimes(reads);
  expect(mockNeed).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(text()).not.toContain('Zadatak je objavljen.');
});

it('refocuses after a lost acceptance using its retained review identity without a second acceptance', async () => {
  const held = deferred(); mockAccept.mockReturnValueOnce(held.promise); await render();
  await act(async () => { void publish().onPress(); }); await blur();
  await act(async () => held.resolve(unknownOutcome()));
  mockRead.mockResolvedValue(ok({ review: review(), command: command('ACCEPTED') })); await focus();
  expect(mockRead).toHaveBeenCalledWith(REVIEW); expect(mockAccept).toHaveBeenCalledTimes(1); expect(mockResume).not.toHaveBeenCalled();
});

it('passes reviewOnly to the location editor and prepares the proposed location without saving canonical facts', async () => {
  await render();
  const retainedPublish = publish().onPress;
  await act(async () => action('Dodaj mesto').onPress());
  const form = tree.root.findByType('LocationForm' as React.ElementType).props;
  expect(form.reviewOnly).toBe(true); expect(form.review.revision).toBe('location-r1');
  // The place is its own step: no publish is drawn under it, and one kept from before still publishes nothing.
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Objavi zadatak' })).toHaveLength(0);
  await act(async () => retainedPublish()); expect(mockAccept).not.toHaveBeenCalled();
  const value = { taskCountryCode: 'RS', geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null, resolvedLocation: null };
  await act(async () => form.onSave(value));
  expect(mockPrepare).toHaveBeenLastCalledWith({ conversationId: CONVERSATION, responseDeadline: null,
    location: { expectedRevision: 'location-r1', value } });
  expect(mockLocationSave).not.toHaveBeenCalled(); expect(mockCorrect).not.toHaveBeenCalled();
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('LocationForm' as React.ElementType)).toHaveLength(0);
});

it('restores a server-reviewed location B after a real remount while canonical facts still contain A', async () => {
  const a = location('A'), b = location('B');
  const saved = { ...locatedReview(b), reviewId: OTHER };
  mockLocationRead.mockResolvedValue(ok(canonicalLocation(a)));
  mockPrepare.mockResolvedValue(ok(locatedReview(a)));
  await render(); await act(async () => action('Uredi mesto').onPress());
  mockPrepare.mockResolvedValue(ok(saved));
  await act(async () => tree.root.findByType('LocationForm' as React.ElementType).props.onSave(b));
  expect(text()).toContain('Adresa B');
  expect(mockLocationSave).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
  mockLatest.mockResolvedValue(ok({ review: saved, command: null }));
  mockPrepare.mockImplementation(async (input: { location?: { value: NeedLocationInput } }) =>
    ok(locatedReview(input.location?.value ?? a)));
  await render();
  expect(mockPrepare).toHaveBeenLastCalledWith({ conversationId: CONVERSATION, responseDeadline: null,
    location: { expectedRevision: saved.geographyRevision, value: b } });
  expect(text()).toContain('Adresa B'); expect(text()).not.toContain('Adresa A');
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
});

it('keeps the reviewed location across an unrelated title revision and accepts only the newly prepared review', async () => {
  const b = location('B'), saved = locatedReview(b);
  const updated = { ...saved, reviewId: OTHER, factsRevision: 'd'.repeat(64), sourceTurnRevision: 3,
    publicProjection: [{ ...saved.publicProjection[0], value: 'Novi naslov', displayValue: 'Novi naslov' }] };
  mockLatest.mockResolvedValue(ok({ review: saved, command: null }));
  mockLocationRead.mockResolvedValue(ok(canonicalLocation(location('A'))));
  mockPrepare.mockResolvedValue(ok(updated));
  await render();
  expect(mockPrepare).toHaveBeenLastCalledWith({ conversationId: CONVERSATION, responseDeadline: null,
    location: { expectedRevision: saved.geographyRevision, value: b } });
  expect(text()).toContain('Novi naslov'); expect(text()).toContain('Adresa B');
  expect(mockAccept).not.toHaveBeenCalled();
  await act(async () => publish().onPress());
  expect(mockAccept.mock.calls[0][0].review).toEqual(updated);
});

it('shows a geographical conflict with the current C review instead of replaying old B over a newer location', async () => {
  const b = location('B'), c = location('C'), revision = 'd'.repeat(64);
  mockLatest.mockResolvedValue(ok({ review: locatedReview(b), command: null }));
  mockLocationRead.mockResolvedValue(ok(canonicalLocation(c, revision)));
  mockPrepare.mockResolvedValue(ok(locatedReview(c, revision)));
  await render();
  expect(mockPrepare).toHaveBeenLastCalledWith({ conversationId: CONVERSATION, responseDeadline: null });
  expect(text()).toContain('Mesto je promenjeno posle prethodnog pregleda.');
  expect(text()).toContain('Adresa C'); expect(text()).not.toContain('Adresa B');
  expect(publish().disabled).toBe(false); expect(commands('Uredi mesto')).toHaveLength(1);
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockLocationSave).not.toHaveBeenCalled();
  await act(async () => action('Uredi mesto').onPress());
  expect(tree.root.findByType('LocationForm' as React.ElementType).props.review.value).toEqual(c);
});

it('preserves a server CAS conflict after recovery read without silently retrying with a newer location', async () => {
  const saved = locatedReview(location('B'));
  mockLatest.mockResolvedValue(ok({ review: saved, command: null }));
  mockLocationRead.mockResolvedValue(ok(canonicalLocation(location('A'))));
  mockPrepare.mockResolvedValue({ ok: false, kod: 'LOCATION_VERSION_CONFLICT', poruka: 'Mesto je promenjeno. Pregledaj novu lokaciju.' });
  await render();
  expect(mockPrepare).toHaveBeenCalledTimes(1);
  expect(mockPrepare).toHaveBeenCalledWith({ conversationId: CONVERSATION, responseDeadline: null,
    location: { expectedRevision: saved.geographyRevision, value: saved.location } });
  expect(text()).toContain('Mesto je promenjeno. Pregledaj novu lokaciju.');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Objavi zadatak' })).toHaveLength(0);
  expect(mockAccept).not.toHaveBeenCalled();
});

it('never opens an old reviewed place with a newer canonical revision', async () => {
  const a = location('A'), b = location('B'), nextRevision = 'd'.repeat(64);
  mockPrepare.mockResolvedValue(ok(locatedReview(a)));
  await render();
  // Another session changed the location after this review was displayed.
  mockLocationRead.mockResolvedValue(ok(canonicalLocation(b, nextRevision)));
  mockPrepare.mockResolvedValue(ok(locatedReview(b, nextRevision)));
  await act(async () => action('Uredi mesto').onPress());
  expect(tree.root.findAllByType('LocationForm' as React.ElementType)).toHaveLength(0);
  expect(text()).toContain('Mesto se promenilo posle otvaranja pregleda.');
  expect(text()).toContain('Adresa B'); expect(text()).not.toContain('Adresa A');
  expect(mockPrepare).toHaveBeenLastCalledWith({ conversationId: CONVERSATION, responseDeadline: null });
  await act(async () => action('Uredi mesto').onPress());
  expect(tree.root.findByType('LocationForm' as React.ElementType).props.review).toMatchObject({ value: b, revision: nextRevision });
  expect(mockLocationSave).not.toHaveBeenCalled(); expect(mockAccept).not.toHaveBeenCalled();
});

it('coalesces double opening and prevents accepting while the fresh location read is pending', async () => {
  const held = deferred(), a = location('A');
  mockPrepare.mockResolvedValue(ok(locatedReview(a))); await render();
  mockLocationRead.mockReturnValueOnce(held.promise);
  const open = action('Uredi mesto').onPress, accept = publish().onPress;
  await act(async () => { void open(); void open(); void accept(); });
  expect(mockLocationRead).toHaveBeenCalledTimes(1); expect(mockAccept).not.toHaveBeenCalled();
  expect(publish().disabled).toBe(true);
  await act(async () => held.resolve(ok(canonicalLocation(a))));
  expect(tree.root.findByType('LocationForm' as React.ElementType).props.review.value).toEqual(a);
});

it('a retired location read cannot release a later visit opening lock', async () => {
  const old = deferred(), fresh = deferred(), a = location('A');
  mockPrepare.mockResolvedValue(ok(locatedReview(a))); await render();
  mockLocationRead.mockReturnValueOnce(old.promise);
  await act(async () => { void action('Uredi mesto').onPress(); });
  await blur(); await focus();
  mockLocationRead.mockReturnValueOnce(fresh.promise);
  await act(async () => { void action('Uredi mesto').onPress(); });
  await act(async () => old.resolve(ok(canonicalLocation(a))));
  expect(tree.root.findAllByType('LocationForm' as React.ElementType)).toHaveLength(0);
  expect(publish().disabled).toBe(true);
  await act(async () => fresh.resolve(ok(canonicalLocation(a))));
  expect(tree.root.findByType('LocationForm' as React.ElementType).props.review.value).toEqual(a);
});

it('recovers a retained local B proposal after an external C revision on the next explicit refresh', async () => {
  const a = location('A'), b = location('B'), c = location('C');
  const saved = locatedReview(a), newer = locatedReview(c, 'd'.repeat(64));
  mockLatest.mockResolvedValue(ok({ review: saved, command: null }));
  mockLocationRead.mockResolvedValue(ok(canonicalLocation(a)));
  mockPrepare.mockResolvedValue(ok(saved));
  await render(); await act(async () => action('Uredi mesto').onPress());
  // C wins after the read but before preparing B: the first CAS failure is not
  // hidden, and the same mounted screen still holds its local B proposal.
  mockPrepare.mockResolvedValueOnce({ ok: false, kod: 'LOCATION_VERSION_CONFLICT', poruka: 'Mesto je promenjeno. Pregledaj novu lokaciju.' });
  await act(async () => tree.root.findByType('LocationForm' as React.ElementType).props.onSave(b));
  expect(mockPrepare).toHaveBeenLastCalledWith({ conversationId: CONVERSATION, responseDeadline: null,
    location: { expectedRevision: saved.geographyRevision, value: b } });
  expect(text()).toContain('Mesto je promenjeno. Pregledaj novu lokaciju.');
  expect(mockPrepare).toHaveBeenCalledTimes(2);
  mockLocationRead.mockResolvedValue(ok(canonicalLocation(c, newer.geographyRevision)));
  mockPrepare.mockResolvedValue(ok(newer));
  await act(async () => action('Proveri').onPress());
  expect(mockPrepare).toHaveBeenCalledTimes(3);
  expect(mockPrepare).toHaveBeenLastCalledWith({ conversationId: CONVERSATION, responseDeadline: null });
  expect(text()).toContain('Adresa C'); expect(text()).toContain('Mesto je promenjeno posle prethodnog pregleda.');
  // A form bound to A must not remain editable above the new C review.
  expect(tree.root.findAllByType('LocationForm' as React.ElementType)).toHaveLength(0);
  expect(publish().disabled).toBe(false);
  await act(async () => action('Uredi mesto').onPress());
  expect(tree.root.findByType('LocationForm' as React.ElementType).props.review.value).toEqual(c);
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockLocationSave).not.toHaveBeenCalled();
});

it.each(['blur', 'account ABA', 'route'] as const)('does not prepare from a late recovered geographical read after %s', async change => {
  const held = deferred();
  mockLatest.mockResolvedValue(ok({ review: locatedReview(location('B')), command: null }));
  mockLocationRead.mockReturnValueOnce(held.promise);
  await render(); expect(mockPrepare).not.toHaveBeenCalled();
  mockLatest.mockResolvedValue(ok(null));
  if (change === 'blur') await blur();
  else {
    if (change === 'account ABA') mockSession = { user: { id: OWNER }, accountRevision: 3 };
    if (change === 'route') mockParams = { conversationId: OTHER };
    await update();
  }
  const preparations = mockPrepare.mock.calls.length;
  await act(async () => held.resolve(ok(canonicalLocation(location('A')))));
  expect(mockPrepare).toHaveBeenCalledTimes(preparations);
  expect(text()).not.toContain('Adresa B'); expect(mockAccept).not.toHaveBeenCalled();
});

it('prepares a new immutable review for an explicit deadline without publishing while the editor is open', async () => {
  await render(); const retainedPublish = publish().onPress, retainedLocation = action('Dodaj mesto').onPress;
  await act(async () => action('Uredi rok za prijave').onPress());
  expect(publish().disabled).toBe(true);
  await act(async () => { void retainedPublish(); void retainedLocation(); });
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockLocationRead).not.toHaveBeenCalled();
  const deadline = '2026-10-12T10:15:00.000Z';
  mockPrepare.mockResolvedValue(ok({ ...review(), reviewId: OTHER, responseDeadline: deadline }));
  await act(async () => tree.root.findByType('DeadlineEditor' as React.ElementType).props.apply(deadline));
  expect(mockPrepare).toHaveBeenLastCalledWith({ conversationId: CONVERSATION, responseDeadline: deadline });
  expect(tree.root.findAllByType('DeadlineEditor' as React.ElementType)).toHaveLength(0);
  // A deadline is a term other people read: Serbian time, said so on a phone in another zone (jest runs in UTC).
  expect(text()).toMatch(/Rok: 12\. okt( \d{4})? · 12:15 \(po vremenu u Srbiji\)/);
  expect(publish().disabled).toBe(false); expect(mockAccept).not.toHaveBeenCalled();
  await act(async () => publish().onPress());
  expect(mockAccept.mock.calls[0][0].review).toMatchObject({ reviewId: OTHER, responseDeadline: deadline });
});

it('restores the server review deadline and allows its explicit removal without inventing a duration', async () => {
  const deadline = '2026-10-12T10:15:00.000Z';
  mockLatest.mockResolvedValue(ok({ review: { ...review(), responseDeadline: deadline }, command: null }));
  mockPrepare.mockResolvedValue(ok({ ...review(), responseDeadline: deadline }));
  await render();
  expect(mockPrepare).toHaveBeenCalledWith({ conversationId: CONVERSATION, responseDeadline: deadline });
  await act(async () => action('Uredi rok za prijave').onPress());
  const form = tree.root.findByType('DeadlineEditor' as React.ElementType).props;
  expect(form.value).toBe(deadline);
  mockPrepare.mockResolvedValue(ok(review()));
  await act(async () => form.apply(null));
  expect(mockPrepare).toHaveBeenLastCalledWith({ conversationId: CONVERSATION, responseDeadline: null });
  expect(text()).toContain('Zadatak sa tačnim terminom se zatvara kad termin prođe');
  expect(mockAccept).not.toHaveBeenCalled();
});

it.each([undefined, 'malformed', [CONVERSATION]])('invalid conversation route performs no review or publication I/O', async value => {
  mockParams = { conversationId: value }; await render();
  expect(mockLatest).not.toHaveBeenCalled(); expect(mockPrepare).not.toHaveBeenCalled();
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
});

// Owner decision d07 (2026-10-07): support has no duty operator yet, and the sentence under the status says so. A request to support
// stood right beneath it ("Zatraži pregled podrške"). While nobody is on duty the task held for a manual check offers ONLY the way
// that works: "Izmeni zadatak". The entry comes back with the one line `SUPPORT_HAS_DUTY_OPERATOR` (reviewOutcome.test).
it('a task held for a manual check says nobody is on duty and offers only "Izmeni zadatak", never a request to support', async () => {
  const evaluated = { ...command('EVALUATED'), evaluation: { kind: 'DECISION', decision: { outcome: 'REVIEW' } } };
  mockLatest.mockResolvedValue(ok({ review: review(), command: evaluated })); mockOpenEdit.mockResolvedValue(ok({ conversationId: OTHER }));
  await render();
  expect(text()).toContain('Zadatak zahteva ručnu proveru i još nije objavljen.');
  expect(text()).toContain('Podrška još nema dežurnog operatera');
  expect(tree.root.findAllByType('SupportContextEntry' as React.ElementType)).toHaveLength(0);
  expect(tree.root.findAllByProps({ label: 'Obrati se podršci' })).toHaveLength(0);
  expect(text()).not.toContain('Obrati se podršci');
  // One green action, the way that works; the check of the outcome stands beside it in white.
  expect(tree.root.findAllByProps({ label: 'Izmeni zadatak' })).toHaveLength(1);
  expect(StyleSheet.flatten(action('Izmeni zadatak').style).backgroundColor).toBe(sys.color.green);
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
  await act(async () => action('Izmeni zadatak').onPress());
  expect(mockOpenEdit).toHaveBeenCalledWith(NEED);
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: OTHER } });
});
it.each(['CLARIFY', 'BLOCK', 'ALLOW', 'NOT_READY', 'UNKNOWN_OUTCOME'] as const)('does not claim the REVIEW support entry for %s', async outcome => {
  const stored = outcome === 'NOT_READY' ? notReadyCommand() : outcome === 'UNKNOWN_OUTCOME' ? command('UNKNOWN_OUTCOME')
    : { ...command('EVALUATED'), evaluation: { kind: 'DECISION', decision: { outcome } } };
  mockLatest.mockResolvedValue(ok({ review: review(), command: stored })); await render();
  expect(tree.root.findAllByType('SupportContextEntry' as React.ElementType)).toHaveLength(0);
});

const identityLabel = 'Ukloni uslov i nastavi';
const identityReview = (value = true): AiTaskReviewEnvelope => ({ ...review(), publicProjection: [
  ...review().publicProjection, { id: 'identity-fact', key: 'need.verified_identity_required', value,
    displayValue: value ? 'Da' : 'Ne', privacyClass: 'PUBLIC', source: 'SYSTEM_DERIVED', status: 'CONFIRMED' },
] });

it('blocks even an old canAccept=true identity requirement and explains unavailable verification without changing it', async () => {
  mockPrepare.mockResolvedValue(ok(identityReview())); await render();
  expect(text()).toContain('učesnici navode sami');
  expect(text()).toContain('nije dostupna'); expect(publish().disabled).toBe(true);
  await act(async () => publish().onPress()); expect(mockAccept).not.toHaveBeenCalled(); expect(mockCorrect).not.toHaveBeenCalled();
  expect(action(identityLabel).disabled).toBe(false);
});

it('serializes explicit false correction and requires fresh authoritative review before publication is enabled', async () => {
  const write = deferred(), fresh = deferred(); mockCorrect.mockReturnValue(write.promise);
  mockPrepare.mockResolvedValueOnce(ok(identityReview())).mockReturnValueOnce(fresh.promise); await render();
  const retained = action(identityLabel).onPress;
  await act(async () => { void retained(); void retained(); });
  expect(mockCorrect).toHaveBeenCalledTimes(1); expect(mockCorrect).toHaveBeenCalledWith('identity-fact', false, 'Ne');
  expect(publish().disabled).toBe(true); expect(mockAccept).not.toHaveBeenCalled();
  await act(async () => write.resolve(ok({}))); expect(publish().disabled).toBe(true);
  expect(mockPrepare).toHaveBeenCalledTimes(2);
  await act(async () => fresh.resolve(ok(identityReview(false)))); expect(publish().disabled).toBe(false);
  expect(tree.root.findAllByProps({ label: identityLabel })).toHaveLength(0);
  await act(async () => retained()); expect(mockCorrect).toHaveBeenCalledTimes(1); expect(mockAccept).not.toHaveBeenCalled();
});

it('keeps unknown identity correction visible and frozen until explicit read, without retry or publication', async () => {
  mockPrepare.mockResolvedValue(ok(identityReview())); mockCorrect.mockResolvedValue(unknownOutcome()); await render();
  const retained = action(identityLabel).onPress; await act(async () => retained());
  expect(action(identityLabel).disabled).toBe(true); expect(publish().disabled).toBe(true);
  await act(async () => retained()); expect(mockCorrect).toHaveBeenCalledTimes(1); expect(mockPrepare).toHaveBeenCalledTimes(1);
  mockPrepare.mockResolvedValue(ok(identityReview(false)));
  await act(async () => action('Proveri').onPress());
  expect(publish().disabled).toBe(false); expect(mockCorrect).toHaveBeenCalledTimes(1); expect(mockAccept).not.toHaveBeenCalled();
});

it.each(['blur-focus', 'account-ABA'] as const)('fences a retained correction and its late ACK after %s', async boundary => {
  const write = deferred(); mockPrepare.mockResolvedValue(ok(identityReview())); mockCorrect.mockReturnValue(write.promise); await render();
  const retained = action(identityLabel).onPress; await act(async () => { void retained(); });
  if (boundary === 'blur-focus') { await blur(); await focus(); }
  else { mockSession = { user: { id: OTHER }, accountRevision: 2 }; await update();
    mockSession = { user: { id: OWNER }, accountRevision: 3 }; await update(); }
  const readCount = mockPrepare.mock.calls.length;
  await act(async () => { await retained(); write.resolve(ok({})); });
  expect(mockPrepare).toHaveBeenCalledTimes(readCount); expect(mockCorrect).toHaveBeenCalledTimes(1);
  expect(publish().disabled).toBe(true); expect(action(identityLabel).disabled).toBe(false);
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
});

it.each(['ACCEPTED', 'EVALUATED'] as const)('offers exact owned edit for historical true %s, with no unavailable paid resume', async state => {
  const stored = state === 'ACCEPTED' ? command(state) : { ...command(state), evaluation: { kind: 'DECISION', decision: { outcome: 'ALLOW' } } };
  mockLatest.mockResolvedValue(ok({ review: identityReview(), command: stored }));
  mockOpenEdit.mockResolvedValue(ok({ conversationId: CONVERSATION })); await render();
  for (const resumeLabel of ['Nastavi objavu', 'Objavi ovaj nacrt']) expect(tree.root.findAllByProps({ label: resumeLabel })).toHaveLength(0);
  expect(mockCorrect).not.toHaveBeenCalled(); await act(async () => action('Izmeni zadatak').onPress());
  expect(mockOpenEdit).toHaveBeenCalledWith(NEED); expect(mockResume).not.toHaveBeenCalled();
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: CONVERSATION } });
});

it.each(['EVALUATING', 'UNKNOWN_OUTCOME'] as const)('does not turn historical true %s into permission to edit or retry', async state => {
  mockLatest.mockResolvedValue(ok({ review: identityReview(), command: command(state) })); await render();
  expect(tree.root.findAllByProps({ label: 'Izmeni zadatak' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ label: identityLabel })).toHaveLength(0);
  for (const resumeLabel of ['Nastavi objavu', 'Objavi ovaj nacrt']) expect(tree.root.findAllByProps({ label: resumeLabel })).toHaveLength(0);
  expect(mockOpenEdit).not.toHaveBeenCalled(); expect(mockCorrect).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
});

// The review was a table: twelve identical two-line rows, four of them saying "Nema navedenih
// stavki", each with its own Izmeni, under a section header rather than under the task. These
// pin the composition that replaced it, so the wall cannot come back unnoticed.
describe('the review reads as a task', () => {
  const withEmpties = (): AiTaskReviewEnvelope => ({ ...review(), publicProjection: [
    ...review().publicProjection,
    { id: 'skills', key: 'need.required_skills', value: [], displayValue: '—',
      privacyClass: 'PUBLIC', source: 'SYSTEM_DERIVED', status: 'CONFIRMED' },
    { id: 'tools', key: 'need.required_tools', value: [], displayValue: '—',
      privacyClass: 'PUBLIC', source: 'SYSTEM_DERIVED', status: 'CONFIRMED' },
    { id: 'category', key: 'need.category', value: 'Selidbe i transport', displayValue: 'Selidbe i transport',
      privacyClass: 'PUBLIC', source: 'SYSTEM_DERIVED', status: 'CONFIRMED' },
  ] });

  it('leads with the task, not with a heading about the task', async () => {
    mockPrepare.mockResolvedValue(ok(review()));
    await render();
    expect(text()).toContain('Prenos ormara');
    // "Ovako će drugi videti zadatak" was a sentence about where the person is (plan 2.17, 3.3): the card shows the task as it will look.
    expect(text()).not.toContain('Ovako će drugi videti zadatak');
    // The correction of the title is a row of "Detalji" like every other fact, not a lonely button under the card (composition spec 4.6).
    expect(commands('Izmeni naslov')).toHaveLength(0);
    expect(commands('Izmeni, Naslov')).toHaveLength(1);
    const order = (value: string) => text().indexOf(value);
    expect(order('Prenos ormara')).toBeLessThan(order('Još treba'));
    expect(order('Još treba')).toBeLessThan(order('Detalji'));
  });

  it('names what is not stated in one line instead of a row each', async () => {
    mockPrepare.mockResolvedValue(ok(withEmpties()));
    await render();
    const copy = text();
    expect(copy).toContain('Nije navedeno');
    // A filled category is not a row either: people never see it (owner decision 2026-09-21).
    expect(copy).not.toContain('Selidbe i transport');
    // Two empty facts, one line, and no repetition of the empty marker.
    expect(copy.split('Nije navedeno').length - 1).toBe(1);
  });

  it('opens them on request, so nothing is hidden from what is being accepted', async () => {
    mockPrepare.mockResolvedValue(ok(withEmpties()));
    await render();
    // One line of the same list, "Nije navedeno · Alati · Vozila · Prikaži": its word opens them as rows.
    const opener = commands('Prikaži, Nije navedeno')[0];
    expect(opener).toBeDefined();
    await act(async () => { opener.props.onPress(); });
    expect(text()).not.toContain('Nije navedeno');
  });
});

// "Izmeni" on a moment or a list used to call back() and leave the review without a word, because
// the only editor was a text box. These pin the two editors that replaced that exit.
function scheduledReview(): AiTaskReviewEnvelope {
  const base = review();
  return { ...base, publicProjection: [...base.publicProjection,
    { id: 'start', key: 'need.starts_at', value: '2026-10-03T15:00:00.000Z', displayValue: 'subota u 17', privacyClass: 'PUBLIC',
      source: 'AI_INFERENCE', status: 'NEEDS_CONFIRMATION' },
    { id: 'skills', key: 'need.required_skills', value: ['Prevoz, utovar', 'Montaža'], displayValue: 'prevoz i montaža', privacyClass: 'PUBLIC',
      source: 'AI_INFERENCE', status: 'NEEDS_CONFIRMATION' }] };
}
const rowEdit = (label: string) => tree.root.findByProps({ accessibilityLabel: `Izmeni, ${label}` }).props;
const field = (label: string) => tree.root.findByProps({ label }).props;
it('corrects a moment with the pickers, in place, and sends the resolved instant', async () => {
  mockPrepare.mockResolvedValue(ok(scheduledReview())); mockCorrect.mockResolvedValue(ok({})); await render();
  await act(async () => rowEdit('Početak').onPress());
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(field('Početak: datum').value).toBe('2026-10-03'); expect(field('Početak: vreme').value).toBe('17:00');
  await act(async () => field('Početak: datum').onChange('2026-10-04'));
  await act(async () => field('Početak: vreme').onChange('09:30:00'));
  await act(async () => action('Sačuvaj ispravku').onPress());
  expect(mockCorrect).toHaveBeenCalledTimes(1);
  expect(mockCorrect).toHaveBeenCalledWith('start', '2026-10-04T07:30:00.000Z', '2026-10-04 09:30');
});
it('saving a moment nobody moved sends the stored instant byte for byte', async () => {
  mockPrepare.mockResolvedValue(ok(scheduledReview())); mockCorrect.mockResolvedValue(ok({})); await render();
  await act(async () => rowEdit('Početak').onPress());
  await act(async () => action('Sačuvaj ispravku').onPress());
  expect(mockCorrect).toHaveBeenCalledWith('start', '2026-10-03T15:00:00.000Z', '2026-10-03T15:00:00.000Z');
});
it('corrects a list item by item and keeps a word typed but not yet added', async () => {
  mockPrepare.mockResolvedValue(ok(scheduledReview())); mockCorrect.mockResolvedValue(ok({})); await render();
  await act(async () => rowEdit('Veštine').onPress());
  expect(mockRouter.replace).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Ukloni: Montaža' }).props.onPress());
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Nova stavka: Veštine' }).props.onChangeText('  Bušenje '));
  await act(async () => action('Sačuvaj ispravku').onPress());
  expect(mockCorrect).toHaveBeenCalledTimes(1);
  expect(mockCorrect.mock.calls[0][0]).toBe('skills');
  expect(mockCorrect.mock.calls[0][1]).toEqual(['Prevoz, utovar', 'Bušenje']);
});

// "Sačuvaj nacrt": the engine could always keep a reviewed task as a private draft without asking
// for publication, and no screen let a person ask for that.
it('saves the reviewed task as a private draft without asking for publication, then offers to publish that draft', async () => {
  mockPrepare.mockResolvedValue(ok({ ...review(), location: location('Liman') }));
  mockDraft.mockImplementation(async () => { mockRead.mockResolvedValue(ok({ review: { ...review(), location: location('Liman') }, command: command('ACCEPTED') })); return ok(command('ACCEPTED')); });
  await render();
  await act(async () => action('Sačuvaj nacrt').onPress());
  expect(mockDraft).toHaveBeenCalledTimes(1); expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
  expect(mockDraft.mock.calls[0][0].review.reviewId).toBe(REVIEW);
  expect(text()).toContain('Sačuvano kao privatan nacrt. Zadatak nije objavljen.');
  expect(tree.root.findAllByProps({ label: 'Sačuvaj nacrt' })).toHaveLength(0);
  // Publishing it later is the stored command's resume, which the ACCEPTED restore test above covers.
  expect(action('Objavi ovaj nacrt').disabled).toBe(false);
  // Nothing was published, so the check is not called a check of the publication.
  expect(tree.root.findAllByProps({ label: 'Proveri' })).toHaveLength(0);
  expect(action('Osveži').disabled).toBe(false);
  await act(async () => action('Otvori moje zadatke').onPress()); expect(mockRouter.replace).toHaveBeenCalledWith('/potrebe');
});
// Round 2c (verifier va, must 1): loading is the write the action started. "Objavi zadatak" read the editor's busy flag,
// which every save sets, so it spun and was spoken as busy while a draft or a corrected fact was being saved.
it('spins "Objavi zadatak" only for the publish itself: while a draft saves it waits grey and is not busy', async () => {
  const publishPress = () => tree.root.findByProps({ accessibilityLabel: 'Objavi zadatak' });
  const spinners = () => publishPress().findAllByType('ActivityIndicator' as React.ElementType);
  const fill = () => StyleSheet.flatten(publish().style).backgroundColor;
  const draft = deferred(); mockDraft.mockReturnValueOnce(draft.promise);
  await render();
  await act(async () => { void action('Sačuvaj nacrt').onPress(); });
  expect(mockDraft).toHaveBeenCalledTimes(1);
  expect(publish().accessibilityState).toEqual({ disabled: true }); expect(publish().disabled).toBe(true);
  expect(spinners()).toHaveLength(0); expect(fill()).toBe(sys.color.wash);
  await act(async () => { draft.resolve(unknownOutcome()); });
  await act(async () => tree.unmount());
  const held = deferred(); mockAccept.mockReturnValueOnce(held.promise);
  await render();
  await act(async () => { void publish().onPress(); });
  expect(mockAccept).toHaveBeenCalledTimes(1);
  expect(publish().accessibilityState).toEqual({ disabled: true, busy: true });
  expect(spinners()).toHaveLength(1); expect(fill()).toBe(sys.color.green);
  await act(async () => { held.resolve(unknownOutcome()); });
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Objavi zadatak' }).flatMap(node => node.findAllByType('ActivityIndicator' as React.ElementType))).toHaveLength(0);
});
it('does not offer a draft while the review cannot be accepted, or when it edits a task that already exists', async () => {
  mockPrepare.mockResolvedValue(ok({ ...review(), canAccept: false, missingRequired: ['need.category'] }));
  await render(); expect(tree.root.findAllByProps({ label: 'Sačuvaj nacrt' })).toHaveLength(0);
  await act(async () => tree.unmount());
  mockPrepare.mockResolvedValue(ok({ ...review(), location: location('Liman'), draftId: NEED, draftRevision: 1 })); await render();
  expect(tree.root.findAllByProps({ label: 'Sačuvaj nacrt' })).toHaveLength(0);
});
// Owner decision 1 (2026-09-19): the app has no global mode. This used to be a row of the table above.
it('a flip of the retired app mode retires nothing: a publish in flight still lands on this review', async () => {
  const held = deferred(); mockAccept.mockReturnValueOnce(held.promise); await render(); const retained = publish().onPress;
  await act(async () => { void retained(); }); mockIntent = 'uskocer'; await update();
  const reads = mockRead.mock.calls.length;
  await act(async () => { held.resolve(ok(command('PUBLISHED'))); });
  expect(mockAccept).toHaveBeenCalledTimes(1); expect(mockRead.mock.calls.length).toBeGreaterThan(reads);
});

// Round 6 (objava): the review as the moment of truth. What still blocks publication is listed with its way to the fix,
// the category is never named, the conversation is reached by the arrow or a "Još treba" row, the success spring is
// kept for a publication confirmed on this screen, and the place is its own step that Android Back leaves.
describe('round 6: the publish review', () => {
  it('never names the category; a hidden missing fact reads as more about the work, and its row returns to the conversation', async () => {
    mockPrepare.mockResolvedValue(ok({ ...review(), canAccept: false, missingRequired: ['need.category'] }));
    await render();
    expect(text()).not.toContain('Kategorija');
    expect(text()).toContain('Treba još malo o samom zadatku.');
    expect(text()).toContain('Prvo uradi ono što piše pod „Još treba“.');
    expect(publish().disabled).toBe(true);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Treba još malo o samom zadatku.' }).props.onPress());
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: CONVERSATION } });
  });

  it('lists a missing place as a row that opens the place step, and draws no separate "Izmeni u razgovoru" or "Dopuni u razgovoru" button beside it', async () => {
    await render();
    expect(text()).toContain('Mesto na mapi nije potvrđeno.');
    // The retired buttons stay retired. The way out of this row is the row itself, which says "Dodaj mesto" under its sentence (2026-10-07), and the
    // one labelled way back to the conversation is "Izmeni zadatak" under the publish (review-exits-and-place.test).
    expect(tree.root.findAllByProps({ label: 'Izmeni u razgovoru' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ label: 'Dopuni u razgovoru' })).toHaveLength(0);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Mesto na mapi nije potvrđeno.' }).props.onPress());
    expect(mockLocationRead).toHaveBeenCalledWith(CONVERSATION);
    expect(tree.root.findAllByType('LocationForm' as React.ElementType)).toHaveLength(1);
  });

  it('shows a restored publication still, and springs only for a publication confirmed on this screen', async () => {
    mockLatest.mockResolvedValue(ok({ review: review(), command: command('PUBLISHED') }));
    await render();
    expect(text()).toContain('Zadatak je objavljen.');
    expect(tree.root.findByType('SuccessMark' as React.ElementType).props.fresh).toBe(false);
    await act(async () => tree.unmount());
    mockLatest.mockResolvedValue(ok(null));
    mockAccept.mockImplementation(async () => { mockRead.mockResolvedValue(ok({ review: review(), command: command('PUBLISHED') })); return ok(command('PUBLISHED')); });
    await render();
    await act(async () => publish().onPress());
    expect(text()).toContain('Zadatak je objavljen.');
    expect(tree.root.findByType('SuccessMark' as React.ElementType).props.fresh).toBe(true);
  });

  it('Android Back in the place step closes it without saving, and is released afterwards', async () => {
    await render(); await act(async () => action('Dodaj mesto').onPress());
    expect(tree.root.findAllByType('LocationForm' as React.ElementType)).toHaveLength(1);
    expect(mockHardwareBack.size).toBe(1);
    await act(async () => { for (const handler of [...mockHardwareBack]) expect(handler()).toBe(true); });
    expect(tree.root.findAllByType('LocationForm' as React.ElementType)).toHaveLength(0);
    expect(mockCancelResolver).toHaveBeenCalled(); expect(mockLocationSave).not.toHaveBeenCalled(); expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(mockHardwareBack.size).toBe(0);
  });

  it('the place step can be left after an unconfirmed outcome, and the review keeps its recovery', async () => {
    mockLocationRead.mockResolvedValue(ok(canonicalLocation(location('A'))));
    mockPrepare.mockResolvedValue(ok(locatedReview(location('A'))));
    await render(); await act(async () => action('Uredi mesto').onPress());
    mockPrepare.mockResolvedValueOnce(unknownOutcome());
    await act(async () => tree.root.findByType('LocationForm' as React.ElementType).props.onSave(location('B')));
    expect(tree.root.findAllByType('LocationForm' as React.ElementType)).toHaveLength(1);
    await act(async () => { for (const handler of [...mockHardwareBack]) handler(); });
    expect(tree.root.findAllByType('LocationForm' as React.ElementType)).toHaveLength(0);
    expect(action('Proveri').disabled).toBe(false);
    expect(mockLocationSave).not.toHaveBeenCalled(); expect(mockAccept).not.toHaveBeenCalled();
  });

  it('shows the time rows without seconds and money with its grouping and currency', async () => {
    const base = review();
    mockPrepare.mockResolvedValue(ok({ ...base, publicProjection: [...base.publicProjection,
      { id: 'mode', key: 'need.price_mode', value: 'MY_PRICE', displayValue: 'Moja cena', privacyClass: 'PUBLIC', source: 'AI_INFERENCE', status: 'CONFIRMED' },
      { id: 'price', key: 'need.price_rsd', value: 1500, displayValue: '1500', privacyClass: 'PUBLIC', source: 'AI_INFERENCE', status: 'CONFIRMED' },
      { id: 'start', key: 'need.starts_at', value: '2026-10-03T15:00:00.000Z', displayValue: 'subota', privacyClass: 'PUBLIC', source: 'AI_INFERENCE', status: 'CONFIRMED' }] }));
    await render();
    expect(text()).toContain('1.500 RSD');
    expect(text()).not.toMatch(/17:00:00/);
    expect(text()).toMatch(/3\. okt( \d{4})? · 17:00/);
  });
});

// The price mode, the price basis and the kind of time were corrected in a text box where the person had to type a word
// the parser knew ("Moja cena"), and the amount in the same box. They are now pill chips and a digits-only RSD field.
// The saved patch is what the box sent: the value, with the chosen label (or the typed digits) as its display text.
describe('enum facts are chosen and the amount is typed as digits', () => {
  type Fact = AiTaskReviewEnvelope['publicProjection'][number];
  const fact = (id: string, key: Fact['key'], value: unknown, displayValue: string): Fact =>
    ({ id, key, value, displayValue, privacyClass: 'PUBLIC', source: 'AI_INFERENCE', status: 'CONFIRMED' }) as Fact;
  const priced = (mode: unknown, amount: unknown, extra: Fact[] = []): AiTaskReviewEnvelope => ({ ...review(), publicProjection: [
    ...review().publicProjection, fact('mode', 'need.price_mode', mode, String(mode)), fact('price', 'need.price_rsd', amount, String(amount)), ...extra] });
  const chip = (label: string) => tree.root.findByProps({ accessibilityRole: 'radio', accessibilityLabel: label }).props;
  const chips = () => tree.root.findAll(node => node.props?.accessibilityRole === 'radio' && typeof node.type === 'string');
  const amountField = () => tree.root.findByProps({ accessibilityLabel: 'Iznos u dinarima' }).props;
  const freeText = (label: string) => tree.root.findAllByProps({ accessibilityLabel: `Nova vrednost: ${label}` });

  it('changes the price mode with a chip and saves the same patch the typed word did', async () => {
    mockPrepare.mockResolvedValue(ok(priced('MY_PRICE', 1500))); mockCorrect.mockResolvedValue(ok({})); await render();
    await act(async () => rowEdit('Cena').onPress());
    expect(freeText('Cena')).toHaveLength(0);
    expect(chips().map(node => node.props.accessibilityLabel)).toEqual(['Moja cena', 'Ponude']);
    expect(chip('Moja cena').accessibilityState).toMatchObject({ checked: true });
    expect(chip('Ponude').accessibilityState).toMatchObject({ checked: false });
    await act(async () => chip('Ponude').onPress());
    expect(chip('Ponude').accessibilityState).toMatchObject({ checked: true });
    await act(async () => action('Sačuvaj ispravku').onPress());
    expect(mockCorrect).toHaveBeenCalledTimes(1);
    // Typing "Ponude" into the old box sent exactly this.
    expect(mockCorrect).toHaveBeenCalledWith('mode', 'OFFERS', 'Ponude');
  });

  it('saves an untouched choice as the old seeded box did', async () => {
    mockPrepare.mockResolvedValue(ok(priced('MY_PRICE', 1500))); mockCorrect.mockResolvedValue(ok({})); await render();
    await act(async () => rowEdit('Cena').onPress());
    await act(async () => action('Sačuvaj ispravku').onPress());
    expect(mockCorrect).toHaveBeenCalledWith('mode', 'MY_PRICE', 'Moja cena');
  });

  it.each([
    ['Termin', fact('kind', 'need.schedule_kind', 'FLEXIBLE', 'kad stigneš'), 'Sutra', ['kind', 'TOMORROW_FLEXIBLE', 'Sutra']],
    ['Osnova cene', fact('basis', 'need.price_basis', 'TOTAL', 'ukupno'), 'Po osobi', ['basis', 'PER_PERSON', 'Po osobi']],
  ] as const)('changes %s with a chip', async (label, extra, choice, call) => {
    mockPrepare.mockResolvedValue(ok(priced('MY_PRICE', 1500, [extra]))); mockCorrect.mockResolvedValue(ok({})); await render();
    await act(async () => rowEdit(label).onPress());
    expect(freeText(label)).toHaveLength(0);
    await act(async () => chip(choice).onPress());
    await act(async () => action('Sačuvaj ispravku').onPress());
    expect(mockCorrect).toHaveBeenCalledWith(...call);
  });

  it('offers the six kinds of time and no urgency', async () => {
    mockPrepare.mockResolvedValue(ok(priced('MY_PRICE', 1500, [fact('kind', 'need.schedule_kind', 'FLEXIBLE', 'x')]))); await render();
    await act(async () => rowEdit('Termin').onPress());
    const labels = chips().map(node => node.props.accessibilityLabel);
    // The nearest first, the open ones after.
    expect(labels).toEqual(['Danas', 'Sutra', 'Ove nedelje', 'Tačan termin', 'Fleksibilno', 'Daljinski bilo kada']);
    expect(chip('Fleksibilno').accessibilityState).toMatchObject({ checked: true });
    expect(labels.join(' ')).not.toMatch(/hitno/i);
  });

  it('starts a retired price mode on no choice and asks for one instead of saving it', async () => {
    mockPrepare.mockResolvedValue(ok(priced('FASTEST', null))); await render();
    await act(async () => rowEdit('Cena').onPress());
    expect(chips().every(node => node.props.accessibilityState.checked === false)).toBe(true);
    await act(async () => action('Sačuvaj ispravku').onPress());
    expect(mockCorrect).not.toHaveBeenCalled();
    expect(text()).toContain('Izaberi jednu od ponuđenih mogućnosti.');
  });

  it('corrects the amount with digits only, grouped as Serbian writes them, and saves the typed number', async () => {
    mockPrepare.mockResolvedValue(ok(priced('MY_PRICE', 1500))); mockCorrect.mockResolvedValue(ok({})); await render();
    await act(async () => rowEdit('Iznos').onPress());
    expect(freeText('Iznos')).toHaveLength(0);
    expect(amountField().value).toBe('1.500'); expect(amountField().keyboardType).toBe('number-pad');
    expect(text()).toContain('RSD');
    // The field hands back "1.5002" when a 2 is typed after the shown "1.500": read as the digits, regrouped.
    await act(async () => amountField().onChangeText('1.5002'));
    expect(amountField().value).toBe('15.002');
    await act(async () => amountField().onChangeText('25.000'));
    expect(amountField().value).toBe('25.000');
    // A decimal comma is not guessed at: the number stays and the field says why.
    await act(async () => amountField().onChangeText('25.000,5'));
    expect(amountField().value).toBe('25.000'); expect(text()).toContain('bez zareza');
    await act(async () => action('Sačuvaj ispravku').onPress());
    expect(mockCorrect).toHaveBeenCalledTimes(1);
    // Typing "25000" into the old box sent exactly this.
    expect(mockCorrect).toHaveBeenCalledWith('price', 25000, '25000');
  });

  it('an emptied amount is empty, never a 0, and is not saved', async () => {
    mockPrepare.mockResolvedValue(ok(priced('MY_PRICE', 1500))); await render();
    await act(async () => rowEdit('Iznos').onPress());
    await act(async () => amountField().onChangeText(''));
    expect(amountField().value).toBe(''); expect(amountField().placeholder).toBe('Upiši iznos');
    await act(async () => action('Sačuvaj ispravku').onPress());
    expect(mockCorrect).not.toHaveBeenCalled(); expect(text()).toContain('Upiši iznos u dinarima.');
  });

  it('keeps the server range refusal of the parser for an amount out of range', async () => {
    mockPrepare.mockResolvedValue(ok(priced('MY_PRICE', 1500))); await render();
    await act(async () => rowEdit('Iznos').onPress());
    await act(async () => amountField().onChangeText('0'));
    await act(async () => action('Sačuvaj ispravku').onPress());
    expect(mockCorrect).not.toHaveBeenCalled(); expect(text()).toContain('Iznos mora biti između 1 i 100.000.000 RSD.');
  });

  it('under "Ponude" shows no amount anywhere, and its editor leads to the price mode instead of saving one', async () => {
    mockPrepare.mockResolvedValue(ok(priced('OFFERS', 1500))); await render();
    expect(text()).not.toContain('1.500'); expect(text()).toContain('Bez iznosa: tražiš ponude');
    await act(async () => rowEdit('Iznos').onPress());
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Iznos u dinarima' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ label: 'Sačuvaj ispravku' })).toHaveLength(0);
    expect(text()).not.toContain('1.500'); expect(text()).toContain('Tražiš ponude, pa zadatak nema iznos');
    await act(async () => action('Izaberi način cene').onPress());
    expect(chip('Ponude').accessibilityState).toMatchObject({ checked: true });
    await act(async () => chip('Moja cena').onPress());
    expect(mockCorrect).not.toHaveBeenCalled();
  });

  it('says a missing "Moja cena" amount in words where the number would stand', async () => {
    mockPrepare.mockResolvedValue(ok(priced('MY_PRICE', null))); await render();
    expect(text()).toContain('Iznos još nije unet');
    expect(text()).not.toMatch(/\b0 RSD/);
  });
});

// The "Objavljeno" moment (plan 2.9 and 3.3, owner 2026-10-07). A publication confirmed on this screen used to be replaced by the jump
// to the map in the same breath, so nobody ever saw it. Now a calm moment holds for PUBLISHED_MOMENT_MS (at least 1,2 s), a tap or Android
// Back continues at once, a screen reader is not hurried, and the owner lands on the task's OWN overview, not on the Zadaci map. Every
// fence of the hand-off (focus, account, the read-back of the exact revision) is the one it was.
describe('the Objavljeno moment', () => {
  const OVERVIEW = { pathname: '/potrebe/[id]/pregled', params: { id: NEED } };
  const published = () => ok({ review: review(), command: command('PUBLISHED') });
  const publishHere = async (bound?: AiTaskReviewEnvelope) => {
    const shown = bound ?? review();
    mockLatest.mockResolvedValue(ok(null)); mockPrepare.mockResolvedValue(ok(shown)); mockRead.mockResolvedValue(ok({ review: shown, command: null }));
    mockAccept.mockImplementation(async () => {
      mockRead.mockResolvedValue(ok({ review: shown, command: command('PUBLISHED') })); mockLatest.mockResolvedValue(ok({ review: shown, command: command('PUBLISHED') }));
      return ok(command('PUBLISHED'));
    });
    await render();
    await act(async () => (bound ? tree.root.findByProps({ accessibilityLabel: 'Potvrdi izmene i objavi' }).props : publish()).onPress());
  };
  const advance = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
  const reader = (on: boolean) => jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(on);
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('holds at least 1,2 s: the mark, what happened, what comes next and ONE green way on, then continues by itself to the overview', async () => {
    expect(PUBLISHED_MOMENT_MS).toBeGreaterThanOrEqual(1200);
    await publishHere();
    expect(mockAccept).toHaveBeenCalledTimes(1);
    // What the moment promises is the app's one promise (`APPLICATION_PROMISE`, F3's R12): "Javićemo ti" only the day push is sent.
    expect(text()).toContain('Zadatak je objavljen.'); expect(text()).toContain(APPLICATION_PROMISE.published);
    expect(tree.root.findByType('SuccessMark' as React.ElementType).props).toMatchObject({ fresh: true, size: 96 });
    expect(tree.root.findAllByProps({ label: 'Otvori zadatak' })).toHaveLength(1);
    expect(action('Otvori zadatak').kind).toBe('primary');
    // The review under it is gone: a finished publication has nothing left to change here, and no second action is offered.
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Objavi zadatak' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ label: 'Sačuvaj nacrt' })).toHaveLength(0);
    expect(tree.root.findAll(node => node.props?.accessibilityLabel === 'Nazad u razgovor')).toHaveLength(0);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await advance(PUBLISHED_MOMENT_MS - 1);
    expect(mockRouter.replace).not.toHaveBeenCalled(); expect(text()).toContain('Zadatak je objavljen.');
    await advance(1);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1); expect(mockRouter.replace).toHaveBeenCalledWith(OVERVIEW);
    expect(mockAccept).toHaveBeenCalledTimes(1); expect(mockResume).not.toHaveBeenCalled();
  });

  it('never takes the owner to the Zadaci map', async () => {
    await publishHere(); await advance(PUBLISHED_MOMENT_MS * 2);
    for (const [route] of mockRouter.replace.mock.calls) expect(JSON.stringify(route)).not.toContain('zadaci');
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('a tap continues at once, and only once, even if the timer comes after it', async () => {
    await publishHere();
    const tap = action('Otvori zadatak').onPress;
    await act(async () => { tap(); tap(); });
    expect(mockRouter.replace).toHaveBeenCalledTimes(1); expect(mockRouter.replace).toHaveBeenCalledWith(OVERVIEW);
    await advance(PUBLISHED_MOMENT_MS * 2); expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });

  it('Android Back goes where the moment goes, and not back into the finished conversation', async () => {
    await publishHere();
    expect(mockHardwareBack.size).toBe(1);
    const handled: boolean[] = [];
    await act(async () => { for (const handler of [...mockHardwareBack]) handled.push(handler()); });
    expect(handled).toEqual([true]);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1); expect(mockRouter.replace).toHaveBeenCalledWith(OVERVIEW);
  });

  it('a screen reader is not hurried: the moment waits for the person to continue', async () => {
    const spy = reader(true);
    try {
      await publishHere(); await advance(PUBLISHED_MOMENT_MS * 4);
      expect(mockRouter.replace).not.toHaveBeenCalled(); expect(text()).toContain('Zadatak je objavljen.');
      await act(async () => action('Otvori zadatak').onPress());
      expect(mockRouter.replace).toHaveBeenCalledTimes(1); expect(mockRouter.replace).toHaveBeenCalledWith(OVERVIEW);
    } finally { spy.mockRestore(); }
  });

  it('a changed account takes the moment and its continuation with it: nothing opens for the new account', async () => {
    await publishHere();
    mockSession = { user: { id: OTHER }, accountRevision: 2 }; await update();
    await advance(PUBLISHED_MOMENT_MS * 2);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('after a blur the fences still hold, and the way on is the explicit one when the screen is back', async () => {
    await publishHere();
    await blur(); await advance(PUBLISHED_MOMENT_MS * 2);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await focus();
    await act(async () => action('Otvori zadatak').onPress());
    expect(mockRouter.replace).toHaveBeenCalledTimes(1); expect(mockRouter.replace).toHaveBeenCalledWith(OVERVIEW);
    expect(mockAccept).toHaveBeenCalledTimes(1);
  });

  it('confirming the changes of a task that already exists says so, with no promise of a first application, and lands on the same overview', async () => {
    await publishHere({ ...review(), draftId: NEED, draftRevision: 4 });
    expect(text()).toContain('Izmene su objavljene.'); expect(text()).toContain('Prijave stižu ovde.');
    expect(text()).not.toContain('Javićemo ti');
    await advance(PUBLISHED_MOMENT_MS);
    expect(mockRouter.replace).toHaveBeenCalledWith(OVERVIEW);
  });

  it('a restored publication shows no moment and does not move by itself: it keeps its explicit "Otvori zadatak"', async () => {
    mockLatest.mockResolvedValue(published());
    await render(); await advance(PUBLISHED_MOMENT_MS * 4);
    expect(text()).toContain('Zadatak je objavljen.');
    expect(tree.root.findByType('SuccessMark' as React.ElementType).props.fresh).toBe(false);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await act(async () => action('Otvori zadatak').onPress());
    expect(mockRouter.replace).toHaveBeenCalledTimes(1); expect(mockRouter.replace).toHaveBeenCalledWith(OVERVIEW);
  });

  it('a publication that is not confirmed shows no moment', async () => {
    mockLatest.mockResolvedValue(ok(null));
    await render();
    await act(async () => publish().onPress());   // the default acceptance answers "unknown outcome"
    await advance(PUBLISHED_MOMENT_MS * 2);
    expect(text()).not.toContain('Zadatak je objavljen.'); expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('SuccessMark' as React.ElementType)).toHaveLength(0);
  });
});
