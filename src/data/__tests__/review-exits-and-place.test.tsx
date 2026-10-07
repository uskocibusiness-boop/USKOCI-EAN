import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AiTaskPublicationCommand, AiTaskReviewEnvelope } from '../aiTaskReviewClientService';
import type { NeedLocationInput } from '../../contracts/location';
import type { NeedTaskGeography } from '../../contracts/needFactsV2';
import { rememberIntakeReviewReturn, retireIntakeReviewReturn } from '../intakeReviewReturn';

const OWNER = '11111111-1111-4111-8111-111111111111', OTHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONVERSATION = '22222222-2222-4222-8222-222222222222', REVIEW = '33333333-3333-4333-8333-333333333333';
const NEED = '55555555-5555-4555-8555-555555555555';
let mockSession = { user: { id: OWNER }, accountRevision: 1 }, mockFocused = true, mockCounter = 0;
let mockParams: { conversationId?: string | string[]; intakeReturn?: string | string[] } = { conversationId: CONVERSATION };
const mockLatest = jest.fn(), mockRead = jest.fn(), mockPrepare = jest.fn(), mockAccept = jest.fn(), mockResume = jest.fn();
const mockNeed = jest.fn(), mockCorrect = jest.fn(), mockOpenEdit = jest.fn(), mockDraft = jest.fn(), mockAbandon = jest.fn(), mockPoruka = jest.fn();
const mockLocationRead = jest.fn(), mockLocationSave = jest.fn(), mockCancelResolver = jest.fn();
const mockDelete = jest.fn(), mockReceipt = jest.fn(), mockStored = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }, mockMine = jest.fn();
const mockRouter = { replace: jest.fn(), push: jest.fn() };
// The lifecycle's own deletion of a private draft (it persists its command, sends it once and recovers an unconfirmed outcome) runs for real.
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: (...args: unknown[]) => mockStored.getItem(...args), setItem: (...args: unknown[]) => mockStored.setItem(...args),
  removeItem: (...args: unknown[]) => mockStored.removeItem(...args),
} }));
jest.mock('../needLifecycleClientService', () => ({ ...jest.requireActual('../needLifecycleClientService'), needLifecycleClientService: {
  cancelNeed: jest.fn(), deleteDraftNeed: (...args: unknown[]) => mockDelete(...args), readCommandReceipt: (...args: unknown[]) => mockReceipt(...args),
} }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected transport'); } }));
jest.mock('../aiTaskReviewClientService', () => ({ aiTaskReviewClientService: {
  readLatest: (...args: unknown[]) => mockLatest(...args), read: (...args: unknown[]) => mockRead(...args),
  prepare: (...args: unknown[]) => mockPrepare(...args), acceptAndPublish: (...args: unknown[]) => mockAccept(...args),
  resume: (...args: unknown[]) => mockResume(...args), acceptAsDraft: (...args: unknown[]) => mockDraft(...args),
} }));
jest.mock('../index', () => ({ izvor: { potreba: (...args: unknown[]) => mockNeed(...args) },
  aiNeedV2Izvor: { correctFact: (...args: unknown[]) => mockCorrect(...args), openEditConversation: (...args: unknown[]) => mockOpenEdit(...args),
    abandonConversation: (...args: unknown[]) => mockAbandon(...args) } }));
jest.mock('../locationClientService', () => ({ needLocationClientService: {
  read: (...args: unknown[]) => mockLocationRead(...args), save: (...args: unknown[]) => mockLocationSave(...args),
} }));
jest.mock('../productionLocationResolver', () => ({ createProductionLocationResolver: () => ({ cancel: mockCancelResolver }) }));
jest.mock('../../ui/location/NeedLocationForm', () => ({ NeedLocationForm: 'LocationForm' }));
jest.mock('../../ui/aiFirst/ResponseDeadlineEditor', () => ({ ResponseDeadlineEditor: 'DeadlineEditor' }));
jest.mock('../../ui/calendar/CalendarControls', () => ({ CivilField: 'CivilField' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto', mediaAssetId: () => null }));
jest.mock('../../ui/location/LocationMapPreview', () => ({ LocationMapPreview: 'LocationMapPreview' }));
jest.mock('../../ui/system/SuccessMark', () => ({ SuccessMark: 'SuccessMark' }));
jest.mock('../../ui/support/SupportContextEntry', () => ({ SupportContextEntry: 'SupportContextEntry' }));
// The outcome bar is a store and a host; the screen only calls `show`, and this is what it asked.
jest.mock('../../ui/system/Poruka', () => ({ poruka: { show: (...args: unknown[]) => mockPoruka(...args) } }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
// One source object for good: the lifecycle re-arms its focus effect whenever `useIzvor()` hands it a different one.
const mockSource = { mojePotrebe: (...args: unknown[]) => mockMine(...args) };
jest.mock('../../store/uloga', () => ({ useUloga: () => 'narucilac', ulogaSada: () => 'narucilac', useIzvor: () => mockSource }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++mockCounter).padStart(12, '0')}` }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import ReviewRoute from '../../app/(app)/pregled-zadatka';
import { ConfirmSheet, confirmFormOf } from '../../ui/system/ConfirmSheet';
import { sys } from '../../ui/system/tokens';

/**
 * The review before publishing, as the owner meets it (owner, 2026-10-07):
 *
 * - PLACE. He typed "Lenke Dunđerski 11, Novi Sad", moved the pin elsewhere, and after publishing the task still said "Lenke Dunđerski".
 *   The geography's words (label, city, area) are written from the first text and are PUBLIC; they do not follow a pin. So the private
 *   half of the review reads the place from the confirmed point, and the public half says what the published task will say.
 * - WAYS OUT. "There is no easy way to delete it or edit it; to go back to the chat to edit it - at least I do not see that function
 *   easily." "Izmeni zadatak" and "Obriši nacrt" stand under the one green action, and nothing is sent before a confirm.
 */
const ADDRESS = '6, Pavla Ivića, Jugovićevo, MZ Jugovićevo, Novi Sad, Grad Novi Sad, Južnobački upravni okrug, Vojvodina, 21137, Srbija';
const END_ADDRESS = '12, Dositejeva, Stari grad, Novi Sad, Grad Novi Sad, Južnobački upravni okrug, Vojvodina, 21101, Srbija';
const ok = (podatak: unknown) => ({ ok: true, podatak });
const unknownOutcome = () => ({ ok: false, kod: 'TASK_REVIEW_OUTCOME_UNCONFIRMED', poruka: 'Ishod objave nije potvrđen.' });
type Fact = AiTaskReviewEnvelope['publicProjection'][number];
const fact = (id: string, key: Fact['key'], value: unknown, privacyClass: 'PUBLIC' | 'PRIVATE' = 'PUBLIC'): Fact =>
  ({ id, key, value, displayValue: String(value), privacyClass, source: 'AI_INFERENCE', status: 'CONFIRMED' }) as Fact;
const STATIONARY: NeedTaskGeography = { mode: 'STATIONARY', start: { city: 'Novi Sad', label: 'Lenke Dunđerski' } };
const ROUTE: NeedTaskGeography = { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad', label: 'Lenke Dunđerski' }, end: { city: 'Novi Sad', label: 'Dositejeva' } };
type Pin = NonNullable<NonNullable<NeedLocationInput['resolvedLocation']>['points']>[number];
const MANUAL_START: Pin = { slot: 'start', latitudeE6: 45_261_418, longitudeE6: 19_800_509, origin: { kind: 'MANUAL_PIN' }, address: ADDRESS };
const PROVIDER_END: Pin = { slot: 'end', latitudeE6: 45_251_000, longitudeE6: 19_845_000,
  origin: { kind: 'PROVIDER_CANDIDATE', providerHint: 'locationiq', candidateHint: null }, address: END_ADDRESS };
function located(geography: NeedTaskGeography, points: readonly Pin[], exactAddress: string | null = ADDRESS): NeedLocationInput {
  return { taskCountryCode: 'RS', geography, exactAddress, accessNotes: null,
    resolvedLocation: points.length ? { version: 1, binding: { taskCountryCode: 'RS', geography, exactAddress }, points } : null };
}
function review(patch: Partial<AiTaskReviewEnvelope> = {}, location: NeedLocationInput | null = null): AiTaskReviewEnvelope {
  const geography = location?.geography ?? STATIONARY;
  return { reviewId: REVIEW, accountId: OWNER, conversationId: CONVERSATION, schemaVersion: 'NEED_FACT_V2', draftId: null, draftRevision: 0,
    displayedContentDigest: 'a'.repeat(64), factsRevision: 'b'.repeat(64), sourceTurnRevision: 2, geographyRevision: 'c'.repeat(64),
    expiresAt: '2026-10-01T00:00:00Z', responseDeadline: null, location, canAccept: true, safety: 'ALLOW', missingRequired: [],
    publicProjection: [fact('title', 'need.title', 'Prenos ormara'), fact('geography', 'need.task_geography', geography)],
    ownerPrivateProjection: location?.exactAddress ? [fact('address', 'need.exact_address', location.exactAddress, 'PRIVATE')] : [], ...patch };
}
function command(state: AiTaskPublicationCommand['state'] = 'ACCEPTED'): AiTaskPublicationCommand {
  return { reviewId: REVIEW, clientRequestId: '44444444-4444-4444-8444-444444444444', needId: NEED, needRevision: 1,
    state, evaluation: null, published: null, authoritative: true };
}
function deferred<T = unknown>() { let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<ReviewRoute />); }); };
const update = async () => { await act(async () => tree.update(<ReviewRoute />)); };
const blur = async () => { mockFocused = false; await update(); };
const actions = () => tree.root.findAll(node => node.type === ('Action' as React.ElementType));
const labels = () => actions().map(node => node.props.label as string);
const action = (label: string) => tree.root.findByProps({ label }).props;
const absent = (label: string) => tree.root.findAllByProps({ label }).length === 0;
const publish = () => tree.root.findByProps({ accessibilityLabel: 'Objavi zadatak' }).props;
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
/** The words between two headings of the review: the public half and the private half of the place. */
const between = (from: string, to: string) => { const copy = text(); return copy.slice(copy.indexOf(from), copy.indexOf(to, copy.indexOf(from) + 1)); };
const sheets = () => tree.root.findAllByType(ConfirmSheet);
const inSheet = (testID: string) => act(async () => { sheets()[0].findByProps({ testID }).props.onPress(); });
const greenPresses = () => tree.root.findAll(node => node.type === ('Press' as React.ElementType)
  && StyleSheet.flatten(node.props.style)?.backgroundColor === sys.color.green).map(node => node.props.accessibilityLabel);
const greenActions = () => actions().filter(node => node.props.kind === 'primary' || StyleSheet.flatten(node.props.style)?.backgroundColor === sys.color.green)
  .map(node => node.props.label);
/** The task a review is bound to, as the owner-only read returns it: a published one by default, a private draft when asked. */
const boundNeed = (stanje = 'OBJAVLJENA', patch: Record<string, unknown> = {}) => ({ id: NEED, revizija: 7, stanje, naslov: 'Prenos ormara', opis: 'Opis',
  podrucjeTekst: 'Novi Sad', vremeTekst: 'Po dogovoru', pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, uslovi: [], brojPrijava: 0, ...patch });
beforeEach(() => {
  jest.clearAllMocks();
  for (const mock of [mockLatest, mockRead, mockPrepare, mockAccept, mockResume, mockNeed, mockCorrect, mockOpenEdit, mockLocationRead, mockLocationSave,
    mockDraft, mockAbandon, mockPoruka, mockDelete, mockReceipt, mockMine, ...Object.values(mockStored)]) mock.mockReset();
  mockSession = { user: { id: OWNER }, accountRevision: 1 }; mockFocused = true; mockCounter = 0;
  mockParams = { conversationId: CONVERSATION };
  mockLatest.mockResolvedValue(ok(null)); mockRead.mockResolvedValue(ok({ review: review(), command: null }));
  mockPrepare.mockResolvedValue(ok(review())); mockAccept.mockResolvedValue(unknownOutcome()); mockResume.mockResolvedValue(unknownOutcome());
  mockLocationRead.mockResolvedValue(ok({ conversationId: CONVERSATION, revision: 'location-r1', value: null, authoritative: true }));
  mockAbandon.mockResolvedValue(ok({ conversationId: CONVERSATION, status: 'ABANDONED', authoritative: true, idempotentReplay: false }));
  mockNeed.mockResolvedValue(boundNeed());
  mockStored.getItem.mockResolvedValue(null); mockStored.setItem.mockResolvedValue(undefined); mockStored.removeItem.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(ok({ needId: NEED, revision: 7, deleted: true, idempotentReplay: false }));
  mockReceipt.mockResolvedValue(ok({ state: 'NOT_CONFIRMED' })); mockMine.mockResolvedValue([]);
});
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the place the owner confirmed is read from the confirmed point, not from the words of the first text', () => {
  const showing = async (location: NeedLocationInput | null) => {
    const shown = review({}, location);
    mockPrepare.mockResolvedValue(ok(shown)); mockRead.mockResolvedValue(ok({ review: shown, command: null }));
    await render();
  };

  it('one place, pin moved: the private half leads with "Pavla Ivića 6, Novi Sad" and never with the old street', async () => {
    await showing(located(STATIONARY, [MANUAL_START]));
    const priv = between('Privatni podaci', 'Fotografije');
    expect(priv).toContain('Pavla Ivića 6, Novi Sad');
    expect(priv).not.toContain('Lenke Dunđerski');
    // The long rows keep the whole address: the short line is a summary and removes nothing.
    expect(priv).toContain(ADDRESS);
    // It is the first thing in the private half, before the exact address row.
    expect(priv.indexOf('Pavla Ivića 6, Novi Sad')).toBeLessThan(priv.indexOf('Tačna adresa'));
  });

  it('the public half says what the published task will say: the stored words, with no street of the pin and no house number', async () => {
    await showing(located(STATIONARY, [MANUAL_START]));
    const pub = between('Vide svi', 'Privatni podaci');
    // What a stranger reads once published: the words of the topology (this is where the old street is visible BEFORE publishing).
    expect(pub).toContain('Mesto: Lenke Dunđerski · Novi Sad');
    expect(pub).not.toContain('Pavla'); expect(pub).not.toMatch(/\b6,/); expect(pub).not.toContain(ADDRESS);
  });

  it('a route with two points: each role has its own short line, in route order, and the public half keeps the stored stops', async () => {
    await showing(located(ROUTE, [MANUAL_START, PROVIDER_END], null));
    const priv = between('Privatni podaci', 'Fotografije');
    expect(priv).toContain('Polazište'); expect(priv).toContain('Pavla Ivića 6, Novi Sad');
    expect(priv).toContain('Odredište'); expect(priv).toContain('Dositejeva 12, Novi Sad');
    expect(priv.indexOf('Pavla Ivića 6, Novi Sad')).toBeLessThan(priv.indexOf('Dositejeva 12, Novi Sad'));
    expect(priv).not.toContain('Lenke Dunđerski');
    const pub = between('Vide svi', 'Privatni podaci');
    expect(pub).toContain('Polazište: Lenke Dunđerski · Novi Sad'); expect(pub).toContain('Odredište: Dositejeva · Novi Sad');
    expect(pub).not.toContain('Pavla'); expect(pub).not.toContain('Dositejeva 12');
  });

  it('a route with only its start confirmed has one private line; the unconfirmed end is not given the old words as if it were confirmed', async () => {
    await showing(located(ROUTE, [MANUAL_START], null));
    const priv = between('Privatni podaci', 'Fotografije');
    expect(priv).toContain('Pavla Ivića 6, Novi Sad'); expect(priv).not.toContain('Dositejeva');
  });

  it('no confirmed point: no private place line, and the public half is exactly what it was', async () => {
    await showing(located(STATIONARY, [], null));
    expect(text()).not.toContain('Pavla'); expect(text()).not.toContain('Tačka na mapi');
    expect(between('Vide svi', 'Privatni podaci')).toContain('Mesto: Lenke Dunđerski · Novi Sad');
  });

  it('a hand-placed pin with no address says only "Tačka na mapi": the old street is exactly what such a pin outdates', async () => {
    await showing(located(STATIONARY, [{ ...MANUAL_START, address: undefined }], null));
    const priv = between('Privatni podaci', 'Fotografije');
    expect(priv).toContain('Tačka na mapi'); expect(priv).not.toContain('Lenke Dunđerski');
  });

  it('a place whose words add nothing to the area line draws no extra public line', async () => {
    await showing(located({ mode: 'STATIONARY', start: { city: 'Novi Sad' } }, [MANUAL_START]));
    expect(between('Vide svi', 'Privatni podaci')).not.toContain('Mesto:');
  });

  it('remote work has no place lines at all', async () => {
    const remote: NeedTaskGeography = { mode: 'REMOTE' };
    const shown = review({ publicProjection: [fact('title', 'need.title', 'Prenos ormara'), fact('geography', 'need.task_geography', remote)] }, null);
    mockPrepare.mockResolvedValue(ok(shown)); await render();
    expect(text()).not.toContain('Mesto:'); expect(text()).not.toContain('Tačka na mapi');
  });
});

describe('the ways out of a review that is not published yet', () => {
  it('draws "Izmeni zadatak" (white, not green), "Sačuvaj nacrt" and, last, "Obriši nacrt" in the danger colour, under ONE green action', async () => {
    await render();
    expect(labels().slice(-3)).toEqual(['Izmeni zadatak', 'Sačuvaj nacrt', 'Obriši nacrt']);
    expect(action('Izmeni zadatak')).toMatchObject({ kind: 'secondary', tone: 'neutral' });
    expect(action('Sačuvaj nacrt').kind).toBe('quiet');
    expect(action('Obriši nacrt').kind).toBe('destructive');
    // The only green fill on the screen is the publish.
    expect(greenPresses()).toEqual(['Objavi zadatak']); expect(greenActions()).toEqual([]);
    // They are enabled on a review that is ready, and each is at least a full touch target (V2Action's own 48).
    for (const label of ['Izmeni zadatak', 'Sačuvaj nacrt', 'Obriši nacrt']) expect(action(label).disabled).toBe(false);
  });

  it('a review that cannot be accepted yet still offers the edit and the deletion, but not the saving of a draft', async () => {
    mockPrepare.mockResolvedValue(ok(review({ canAccept: false, missingRequired: ['need.title'] }))); await render();
    expect(labels().slice(-2)).toEqual(['Izmeni zadatak', 'Obriši nacrt']); expect(absent('Sačuvaj nacrt')).toBe(true);
    // The publish waits grey (with its reason), so there is no green fill at all, and still nothing else is green.
    expect(publish().disabled).toBe(true); expect(greenPresses()).toEqual([]); expect(greenActions()).toEqual([]);
  });

  it('the changes of a task that already exists offer the edit only: there is no draft to delete, and nothing to save as one', async () => {
    const bound = review({ draftId: NEED, draftRevision: 4 }); mockPrepare.mockResolvedValue(ok(bound)); mockRead.mockResolvedValue(ok({ review: bound, command: null }));
    await render();
    expect(action('Izmeni zadatak').kind).toBe('secondary'); expect(absent('Obriši nacrt')).toBe(true); expect(absent('Sačuvaj nacrt')).toBe(true);
    expect(tree.root.findByProps({ accessibilityLabel: 'Potvrdi izmene i objavi' })).toBeDefined();
    expect(greenPresses()).toEqual(['Potvrdi izmene i objavi']);
  });

  it.each(['ACCEPTED', 'EVALUATING', 'UNKNOWN_OUTCOME'] as const)('a stored %s command is left to its own recovery: no deletion here and no second "Izmeni zadatak"', async state => {
    mockLatest.mockResolvedValue(ok({ review: review(), command: command(state) })); await render();
    expect(absent('Obriši nacrt')).toBe(true); expect(absent('Izmeni zadatak')).toBe(true);
  });

  it('a held task keeps its single green "Izmeni zadatak" and offers no deletion beside it', async () => {
    const held = { ...command('EVALUATED'), evaluation: { kind: 'NOT_READY', needId: NEED, needRevision: 1, authoritativeDecision: false, code: 'EVALUATOR_UNAVAILABLE' } };
    mockLatest.mockResolvedValue(ok({ review: review(), command: held })); await render();
    expect(tree.root.findAllByProps({ label: 'Izmeni zadatak' })).toHaveLength(1);
    expect(StyleSheet.flatten(action('Izmeni zadatak').style).backgroundColor).toBe(sys.color.green);
    expect(absent('Obriši nacrt')).toBe(true);
  });

  describe('"Izmeni zadatak" returns to the conversation, which keeps the draft', () => {
    it.each([{}, { entryKey: OTHER }, { conversationId: CONVERSATION }])('with the exact retained intake identity %j, once, sending nothing', async params => {
      const handoff = rememberIntakeReviewReturn({ accountId: OWNER, accountRevision: 1 }, CONVERSATION, params)!;
      mockParams.intakeReturn = handoff.token;
      await render();
      const edit = action('Izmeni zadatak').onPress;
      await act(async () => { edit(); edit(); });
      expect(mockRouter.replace).toHaveBeenCalledTimes(1);
      expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/nova', params });
      expect(mockAccept).not.toHaveBeenCalled(); expect(mockDraft).not.toHaveBeenCalled(); expect(mockAbandon).not.toHaveBeenCalled();
      expect(mockCorrect).not.toHaveBeenCalled(); expect(sheets()).toHaveLength(0);
      retireIntakeReviewReturn(handoff);
    });

    it('opens the canonical conversation when the review was reached directly', async () => {
      await render();
      await act(async () => action('Izmeni zadatak').onPress());
      expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: CONVERSATION } });
    });
  });

  describe('"Obriši nacrt" asks first, in the centred dialog, and sends nothing before the confirm', () => {
    it('names the draft, says what happens in one sentence, and offers the danger confirm and a quiet "Odustani"', async () => {
      await render();
      await act(async () => action('Obriši nacrt').onPress());
      expect(sheets()).toHaveLength(1);
      expect(sheets()[0].props).toMatchObject({ title: 'Obrisati nacrt „Prenos ormara“?', confirmLabel: 'Obriši nacrt', tone: 'danger',
        message: 'Zadatak se neće objaviti, a razgovor o njemu više ne možeš da nastaviš.' });
      // A short question is a centred dialog, never a bottom sheet; "Odustani" is the default quiet way out.
      expect(confirmFormOf(sheets()[0].props)).toBe('dialog');
      expect(sheets()[0].props.cancelLabel).toBeUndefined();
      expect(sheets()[0].findByProps({ testID: 'confirm-sheet-cancel' }).props.accessibilityLabel).toBe('Odustani');
      expect(sheets()[0].findByProps({ testID: 'confirm-sheet-confirm' }).props.accessibilityLabel).toBe('Obriši nacrt');
      expect(mockAbandon).not.toHaveBeenCalled(); expect(mockPoruka).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('"Odustani" sends nothing, closes the question and frees the screen', async () => {
      await render();
      await act(async () => action('Obriši nacrt').onPress());
      await inSheet('confirm-sheet-cancel');
      expect(sheets()).toHaveLength(0);
      expect(mockAbandon).not.toHaveBeenCalled(); expect(mockPoruka).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
      for (const label of ['Izmeni zadatak', 'Sačuvaj nacrt', 'Obriši nacrt']) expect(action(label).disabled).toBe(false);
      // It can be asked again.
      await act(async () => action('Obriši nacrt').onPress());
      expect(sheets()).toHaveLength(1);
    });

    it('a title is kept short in the question, and a draft without one is asked about plainly', async () => {
      const long = 'Prenos ormara sa trećeg sprata zgrade bez lifta u staroj gradskoj jezgri, uz pomoć dve osobe';
      mockPrepare.mockResolvedValue(ok(review({ publicProjection: [fact('title', 'need.title', long)] }))); await render();
      await act(async () => action('Obriši nacrt').onPress());
      const title = sheets()[0].props.title as string;
      expect(title.startsWith('Obrisati nacrt „Prenos ormara sa trećeg sprata')).toBe(true); expect(title).toContain('…“?');
      expect(title.length).toBeLessThan(90);
      await act(async () => tree.unmount());
      mockPrepare.mockResolvedValue(ok(review({ publicProjection: [] }))); await render();
      await act(async () => action('Obriši nacrt').onPress());
      expect(sheets()[0].props.title).toBe('Obrisati nacrt?');
    });

    it('the confirm leaves the conversation through the one command the server has, says "Nacrt je obrisan." with no "Vrati", and goes home', async () => {
      await render();
      await act(async () => action('Obriši nacrt').onPress());
      await inSheet('confirm-sheet-confirm');
      expect(mockAbandon).toHaveBeenCalledTimes(1); expect(mockAbandon).toHaveBeenCalledWith(CONVERSATION);
      // There is no way to undo it, so the bar offers none.
      expect(mockPoruka).toHaveBeenCalledTimes(1);
      expect(mockPoruka).toHaveBeenCalledWith({ text: 'Nacrt je obrisan.', confirmed: true });
      expect(mockPoruka.mock.calls[0][0].action).toBeUndefined();
      expect(mockRouter.replace).toHaveBeenCalledTimes(1); expect(mockRouter.replace).toHaveBeenCalledWith('/');
      expect(mockAccept).not.toHaveBeenCalled(); expect(mockDraft).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
      expect(sheets()).toHaveLength(0);
    });

    it('a refusal or a lost answer shows no success and does not leave: the screen asks to read the outcome again', async () => {
      mockAbandon.mockResolvedValue({ ok: false, kod: 'CONVERSATION_NOT_ABANDONABLE', poruka: 'Ovaj razgovor više ne može da se napusti. Proveri njegovo stanje.' });
      await render();
      await act(async () => action('Obriši nacrt').onPress());
      await inSheet('confirm-sheet-confirm');
      expect(mockAbandon).toHaveBeenCalledTimes(1);
      expect(mockPoruka).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
      expect(text()).toContain('Ovaj razgovor više ne može da se napusti.');
      // Nothing more is sent until the outcome is read: the exits wait grey, and the explicit read is offered.
      for (const label of ['Izmeni zadatak', 'Sačuvaj nacrt', 'Obriši nacrt']) expect(action(label).disabled).toBe(true);
      expect(action('Učitaj pregled i proveri ishod').disabled).toBe(false);
    });
  });

  describe('they wait while a command runs, and ignore a press kept from before', () => {
    it('while the publish is in flight: all three are grey and do nothing', async () => {
      const held = deferred(); mockAccept.mockReturnValueOnce(held.promise);
      await render();
      const kept = { edit: action('Izmeni zadatak').onPress, save: action('Sačuvaj nacrt').onPress, remove: action('Obriši nacrt').onPress };
      await act(async () => { void publish().onPress(); });
      for (const label of ['Izmeni zadatak', 'Sačuvaj nacrt', 'Obriši nacrt']) expect(action(label).disabled).toBe(true);
      await act(async () => { kept.edit(); kept.save(); kept.remove(); });
      expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockDraft).not.toHaveBeenCalled(); expect(sheets()).toHaveLength(0);
      expect(mockAbandon).not.toHaveBeenCalled(); expect(mockAccept).toHaveBeenCalledTimes(1);
      await act(async () => held.resolve(unknownOutcome()));
    });

    it('while the deletion is in flight: nothing else can be sent, and a second confirm sends no second command', async () => {
      const held = deferred(); mockAbandon.mockReturnValueOnce(held.promise);
      await render();
      const kept = { edit: action('Izmeni zadatak').onPress, remove: action('Obriši nacrt').onPress };
      await act(async () => action('Obriši nacrt').onPress());
      const confirm = sheets()[0].props.onConfirm as () => unknown;
      await inSheet('confirm-sheet-confirm');
      expect(mockAbandon).toHaveBeenCalledTimes(1);
      for (const label of ['Izmeni zadatak', 'Sačuvaj nacrt', 'Obriši nacrt']) expect(action(label).disabled).toBe(true);
      expect(publish().disabled).toBe(true);
      await act(async () => { kept.edit(); kept.remove(); void confirm(); void publish().onPress(); });
      expect(mockAbandon).toHaveBeenCalledTimes(1); expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockAccept).not.toHaveBeenCalled();
      await act(async () => held.resolve(ok({ conversationId: CONVERSATION, status: 'ABANDONED', authoritative: true, idempotentReplay: false })));
      expect(mockRouter.replace).toHaveBeenCalledTimes(1); expect(mockRouter.replace).toHaveBeenCalledWith('/');
    });

    it('while a correction, the place or the deadline is open they are grey too', async () => {
      await render();
      await act(async () => action('Uredi rok za prijave').onPress());
      for (const label of ['Izmeni zadatak', 'Sačuvaj nacrt', 'Obriši nacrt']) expect(action(label).disabled).toBe(true);
      const kept = action('Obriši nacrt').onPress;
      await act(async () => kept());
      expect(sheets()).toHaveLength(0); expect(mockAbandon).not.toHaveBeenCalled();
    });

    it.each(['blur', 'account switch', 'route'] as const)('an open question is taken away with its screen after %s, and a kept confirm sends nothing', async change => {
      await render();
      await act(async () => action('Obriši nacrt').onPress());
      const kept = sheets()[0].props.onConfirm as () => unknown;
      if (change === 'blur') await blur();
      else {
        if (change === 'account switch') mockSession = { user: { id: OTHER }, accountRevision: 2 };
        if (change === 'route') mockParams = { conversationId: OTHER };
        await update();
      }
      await act(async () => { void kept(); });
      expect(mockAbandon).not.toHaveBeenCalled(); expect(mockPoruka).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
      if (change === 'blur') expect(sheets()).toHaveLength(0);
    });
  });
});

/**
 * A DRAFT opened from "Moji zadaci > Nacrti > Pregledaj za objavu" (owner's phone, 2026-10-07, the build before this fix): the review was titled
 * "Pregled izmena" and its button said "Potvrdi izmene i objavi", words of an edit on a FIRST publication, and it offered no text action to delete
 * the draft or to edit the whole task. Such a review is bound to a task that exists (`draftId`), and that task is a private draft: it is the first
 * publication, it can be edited in the conversation, and it is deleted by the lifecycle's own command, as on the draft's own screen.
 */
describe('a private draft reviewed for its first publication', () => {
  // A ready one: its place is confirmed, so nothing stands in the way and the caption says what the tap does.
  const DRAFT_REVIEW = () => review({ draftId: NEED, draftRevision: 7 }, located(STATIONARY, [MANUAL_START]));
  const open = async (need: unknown = boundNeed('NACRT'), shown: AiTaskReviewEnvelope = DRAFT_REVIEW()) => {
    mockNeed.mockResolvedValue(need); mockPrepare.mockResolvedValue(ok(shown)); mockRead.mockResolvedValue(ok({ review: shown, command: null }));
    await render();
  };
  const asked = (testID: string) => act(async () => { sheets()[0].findByProps({ testID }).props.onPress(); });

  it('says it is a review before publishing: "Pregled zadatka" and "Objavi zadatak", never the words of an edit', async () => {
    await open();
    expect(mockNeed).toHaveBeenCalledWith(NEED);
    expect(text()).toContain('Pregled zadatka'); expect(text()).not.toContain('Pregled izmena');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Objavi zadatak' })).toHaveLength(1);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Potvrdi izmene i objavi' })).toHaveLength(0);
    expect(text()).toContain('Ovim prihvataš prikazanu verziju i tražiš objavu.'); expect(text()).not.toContain('potvrđuješ ovu verziju');
    expect(publish().disabled).toBe(false);
  });

  it.each([
    ['a published task being changed', () => Promise.resolve(boundNeed('OBJAVLJENA'))], ['a task with applications', () => Promise.resolve(boundNeed('CEKA_PRIJAVE'))],
    ['a task that cannot be read', () => Promise.reject(new Error('NEED_READ_FAILED'))], ['a task that is not there', () => Promise.resolve(null)],
    ['another task', () => Promise.resolve({ ...boundNeed('NACRT'), id: OTHER })],
  ])('keeps the words of an edit for %s, and offers no deletion', async (_name, read) => {
    mockNeed.mockImplementation(read);
    const shown = DRAFT_REVIEW(); mockPrepare.mockResolvedValue(ok(shown)); await render();
    expect(text()).toContain('Pregled izmena');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Potvrdi izmene i objavi' })).toHaveLength(1);
    expect(action('Izmeni zadatak').kind).toBe('secondary'); expect(absent('Obriši nacrt')).toBe(true); expect(absent('Sačuvaj nacrt')).toBe(true);
    expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  });

  it('offers "Izmeni zadatak" (to the conversation) and, last, "Obriši nacrt", under ONE green action, and no "Sačuvaj nacrt": the draft already exists', async () => {
    await open();
    expect(labels().slice(-2)).toEqual(['Izmeni zadatak', 'Obriši nacrt']); expect(absent('Sačuvaj nacrt')).toBe(true);
    expect(action('Izmeni zadatak')).toMatchObject({ kind: 'secondary', tone: 'neutral' }); expect(action('Obriši nacrt').kind).toBe('destructive');
    expect(greenPresses()).toEqual(['Objavi zadatak']); expect(greenActions()).toEqual([]);
    await act(async () => action('Izmeni zadatak').onPress());
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: CONVERSATION } });
    expect(mockAbandon).not.toHaveBeenCalled(); expect(mockAccept).not.toHaveBeenCalled();
  });

  it('"Obriši nacrt" asks in the centred dialog of the draft\'s own screen and sends nothing before the confirm; "Odustani" sends nothing at all', async () => {
    await open();
    await act(async () => action('Obriši nacrt').onPress());
    expect(sheets()).toHaveLength(1);
    expect(sheets()[0].props).toMatchObject({ title: 'Obriši nacrt?', confirmLabel: 'Obriši nacrt', tone: 'danger',
      message: 'Nacrt se briše zauvek i ne može da se vrati. Ako ima fotografije, prvo ih ukloni iz nacrta.' });
    expect(confirmFormOf(sheets()[0].props)).toBe('dialog');
    expect(sheets()[0].findByProps({ testID: 'confirm-sheet-cancel' }).props.accessibilityLabel).toBe('Odustani');
    // While the question is on, the rest waits: nothing is published or edited under it.
    expect(publish().disabled).toBe(true); expect(action('Izmeni zadatak').disabled).toBe(true);
    expect(mockStored.setItem).not.toHaveBeenCalled(); expect(mockDelete).not.toHaveBeenCalled();
    await asked('confirm-sheet-cancel');
    expect(sheets()).toHaveLength(0); expect(mockStored.setItem).not.toHaveBeenCalled(); expect(mockDelete).not.toHaveBeenCalled();
    expect(publish().disabled).toBe(false); expect(action('Obriši nacrt').disabled).toBe(false);
  });

  it('the confirm deletes THE DRAFT TASK through the lifecycle command (not the conversation), says so on the screen and leads to "Moji zadaci"', async () => {
    await open();
    await act(async () => action('Obriši nacrt').onPress());
    await asked('confirm-sheet-confirm');
    // Persisted first, then sent once, bound to the revision that was read.
    expect(mockStored.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockStored.setItem.mock.calls[0][1])).toEqual({ action: 'DELETE_DRAFT', needId: NEED, expectedRevision: 7, reason: '' });
    expect(mockDelete.mock.calls).toEqual([[NEED, 7, '']]);
    expect(mockAbandon).not.toHaveBeenCalled(); expect(mockAccept).not.toHaveBeenCalled(); expect(sheets()).toHaveLength(0);
    expect(text()).toContain('Nacrt je obrisan.');
    // The draft is gone: nothing else on this screen can be sent, and the one way on is the list of tasks.
    expect(publish().disabled).toBe(true); expect(action('Izmeni zadatak').disabled).toBe(true); expect(action('Obriši nacrt').disabled).toBe(true);
    await act(async () => action('Moji zadaci').onPress());
    expect(mockRouter.replace).toHaveBeenCalledWith('/potrebe');
    expect(mockStored.removeItem).toHaveBeenCalled();
  });

  it('a refusal is said in plain words (the draft still has photos) and the screen is not left grey: "Učitaj aktuelni zadatak" reads it again', async () => {
    mockDelete.mockResolvedValue({ ok: false, kod: 'DRAFT_MEDIA_CLEANUP_REQUIRED', poruka: 'Ukloni fotografije iz nacrta pre brisanja.' });
    await open();
    await act(async () => action('Obriši nacrt').onPress());
    await asked('confirm-sheet-confirm');
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(text()).toContain('Ukloni fotografije iz nacrta pre brisanja.');
    expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockPoruka).not.toHaveBeenCalled();
    const reads = mockPrepare.mock.calls.length;
    await act(async () => action('Učitaj aktuelni zadatak').onPress());
    expect(mockPrepare.mock.calls.length).toBeGreaterThan(reads);
    expect(publish().disabled).toBe(false); expect(action('Obriši nacrt').disabled).toBe(false);
  });

  it('a press kept from before sends nothing while the deletion is in flight, and the question is taken away with its screen', async () => {
    const held = deferred(); mockDelete.mockReturnValueOnce(held.promise);
    await open();
    const kept = { edit: action('Izmeni zadatak').onPress, remove: action('Obriši nacrt').onPress };
    await act(async () => kept.remove());
    await asked('confirm-sheet-confirm');
    expect(mockDelete).toHaveBeenCalledTimes(1);
    await act(async () => { kept.edit(); kept.remove(); void publish().onPress(); });
    expect(mockDelete).toHaveBeenCalledTimes(1); expect(mockAccept).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
    await act(async () => held.resolve(ok({ needId: NEED, revision: 7, deleted: true, idempotentReplay: false })));
    expect(text()).toContain('Nacrt je obrisan.');
  });

  it('publishing the draft says "Zadatak je objavljen." and promises applications as a first publication does, not "Izmene su objavljene."', async () => {
    jest.useFakeTimers();
    try {
      const shown = DRAFT_REVIEW(); const published = { ...command('PUBLISHED'), published: { needId: NEED, status: 'PUBLISHED', publishedAt: '2026-09-12T12:00:01Z',
        responseDeadline: null, idempotentReplay: false } };
      mockNeed.mockResolvedValue(boundNeed('NACRT')); mockPrepare.mockResolvedValue(ok(shown)); mockRead.mockResolvedValue(ok({ review: shown, command: null }));
      mockAccept.mockImplementation(async () => {
        mockNeed.mockResolvedValue(boundNeed('OBJAVLJENA', { revizija: 1 }));
        mockRead.mockResolvedValue(ok({ review: shown, command: published })); mockLatest.mockResolvedValue(ok({ review: shown, command: published }));
        return ok(published);
      });
      await render();
      await act(async () => publish().onPress());
      expect(text()).toContain('Zadatak je objavljen.'); expect(text()).toContain('Prijave stižu ovde. Javićemo ti.');
      expect(text()).not.toContain('Izmene su objavljene.');
    } finally { jest.useRealTimers(); }
  });
});

/**
 * "Još treba" (owner's phone, 2026-10-07): "Početak termina je već prošao. Izmeni termin u pregledu, pa objavi." was a sentence with a faint arrow beside
 * a grey publish. Each row now says the word of its way out under its sentence, and that way opens right there.
 */
describe('the way out of every blocker is a visible action', () => {
  const PASSED = (extra: Fact[] = []) => review({ publicProjection: [fact('title', 'need.title', 'Prevoz od Petrovaradina do centra Novog Sada'),
    fact('geography', 'need.task_geography', STATIONARY), fact('mode', 'need.price_mode', 'OFFERS'), fact('kind', 'need.schedule_kind', 'FIXED_WINDOW'),
    fact('start', 'need.starts_at', '2020-10-06T14:00:00.000Z'), fact('end', 'need.ends_at', '2020-10-06T14:30:00.000Z'), ...extra] });
  const rowOf = (words: string) => tree.root.findByProps({ accessibilityLabel: words });

  it('a time that has passed says "Izmeni termin" and opens the time editor of that very row, in place', async () => {
    mockPrepare.mockResolvedValue(ok(PASSED())); await render();
    const row = rowOf('Početak termina je već prošao. Izmeni termin u pregledu, pa objavi.');
    expect(row.props.accessibilityHint).toBe('Izmeni termin');
    expect(row.findAll(node => node.type === ('T' as React.ElementType)).map(node => node.props.children)).toEqual([
      'Početak termina je već prošao. Izmeni termin u pregledu, pa objavi.', 'Izmeni termin']);
    // The grey publish still says why; the row is the way out, and it is open to the touch.
    expect(publish().disabled).toBe(true); expect(row.props.disabled).toBe(false);
    expect(tree.root.findAllByProps({ label: 'Početak: datum' })).toHaveLength(0);
    await act(async () => row.props.onPress());
    expect(tree.root.findByProps({ label: 'Početak: datum' }).props.value).toBe('2020-10-06');
    expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockCorrect).not.toHaveBeenCalled();
  });

  it('names the word of each other row, and a row that goes to the conversation or to the place says so', async () => {
    mockPrepare.mockResolvedValue(ok(review({ missingRequired: ['need.title'], canAccept: false, safety: 'BLOCK' }))); await render();
    const words = (text: string) => rowOf(text).findAll(node => node.type === ('T' as React.ElementType)).map(node => node.props.children);
    expect(words('Sadržaj ne može da se objavi u ovom obliku.')).toEqual(['Sadržaj ne može da se objavi u ovom obliku.', 'Izmeni u razgovoru']);
    expect(words('Nedostaje: Naslov.')).toEqual(['Nedostaje: Naslov.', 'Dopuni u razgovoru']);
    expect(words('Mesto na mapi nije potvrđeno.')).toEqual(['Mesto na mapi nije potvrđeno.', 'Dodaj mesto']);
    await act(async () => rowOf('Nedostaje: Naslov.').props.onPress());
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: CONVERSATION } });
  });

  it('a missing amount says "Unesi iznos" and opens the amount editor', async () => {
    mockPrepare.mockResolvedValue(ok(review({ publicProjection: [fact('title', 'need.title', 'Prenos ormara'), fact('mode', 'need.price_mode', 'MY_PRICE'),
      fact('price', 'need.price_rsd', null)] })));
    await render();
    const row = rowOf('Unesi iznos ili izaberi prikupljanje ponuda.');
    expect(row.findAll(node => node.type === ('T' as React.ElementType)).map(node => node.props.children).pop()).toBe('Unesi iznos');
    await act(async () => row.props.onPress());
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Iznos u dinarima' })).toHaveLength(1);
  });

  it('a fact problem whose row this screen does not have goes to the conversation instead of being a row that does nothing', async () => {
    // A fixed time with no start at all: the row to edit does not exist here.
    mockPrepare.mockResolvedValue(ok(review({ publicProjection: [fact('title', 'need.title', 'Prenos ormara'), fact('mode', 'need.price_mode', 'OFFERS'),
      fact('kind', 'need.schedule_kind', 'FIXED_WINDOW')] })));
    await render();
    const row = rowOf('Tačan termin mora imati početak i kraj, a kraj mora biti posle početka.');
    expect(row.props.accessibilityHint).toBe('Dopuni u razgovoru');
    await act(async () => row.props.onPress());
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: CONVERSATION } });
  });

  it('while another editor is open the rows wait grey, and so does their word', async () => {
    mockPrepare.mockResolvedValue(ok(PASSED())); await render();
    const words = 'Početak termina je već prošao. Izmeni termin u pregledu, pa objavi.';
    const wordColour = () => StyleSheet.flatten(rowOf(words).findAll(node => node.type === ('T' as React.ElementType)).pop()!.props.style).color;
    expect(wordColour()).toBe(sys.color.green);
    await act(async () => action('Uredi rok za prijave').onPress());
    expect(rowOf(words).props.disabled).toBe(true); expect(wordColour()).toBe(sys.color.muted);
    const kept = rowOf(words).props.onPress;
    await act(async () => kept());
    expect(tree.root.findAllByProps({ label: 'Početak: datum' })).toHaveLength(0);
  });
});

describe('the whole title is read before publishing', () => {
  it('is never cut with an ellipsis: the card asks for no line limit', async () => {
    const long = 'Prevoz od Petrovaradina do centra Novog Sada sa dva kofera i jednom kutijom koja ne sme da se okreće, uz pomoć vozača';
    mockPrepare.mockResolvedValue(ok(review({ publicProjection: [fact('title', 'need.title', long)] }))); await render();
    const title = tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.children === long);
    expect(title.length).toBeGreaterThan(0);
    for (const node of title) expect(node.props.numberOfLines).toBeUndefined();
  });
});
