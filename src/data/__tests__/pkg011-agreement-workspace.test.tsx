import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { poruka } from '../../ui/system/Poruka';
import { brandAction, sys } from '../../ui/system/tokens';
// The one primary action is the Press whose own surface is the brand surface (last style wins, as in React Native).
const surfaceOf = (style: unknown): unknown => Array.isArray(style) ? style.map(surfaceOf).filter(value => value !== undefined).pop()
  : style && typeof style === 'object' ? (style as { backgroundColor?: unknown }).backgroundColor : undefined;
const mockAccount = '10000000-0000-4000-8000-000000000001', mockOther = '10000000-0000-4000-8000-000000000002', mockAgreementId = '20000000-0000-4000-8000-000000000001';
const mockRouter = { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn() };
const mockNeedId = '30000000-0000-4000-8000-000000000001', mockApplicationId = '40000000-0000-4000-8000-000000000001';
const mockRead = jest.fn(), mockMessages = jest.fn(), mockMessagesRead = jest.fn();
const mockDisplayed = jest.fn();
let mockParams: Record<string, string> = { id: mockAgreementId };
let mockReducedMotion = false;
// These established assertions describe the roomy composition. The native Jest preset defaults to fontScale 2;
// choose this viewport explicitly and exercise the large-text composition separately below.
let mockWindow = { width: 390, height: 844, fontScale: 1, scale: 3 };
const mockSource = { dogovor: mockRead, poruke: mockMessages, oznaciZavrsetak: jest.fn(), potvrdiZavrsetak: jest.fn(), podeliTelefon: jest.fn(), opoziviTelefon: jest.fn(), oznaciPorukeProcitanim: mockMessagesRead };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'android' };
    if (key === 'useWindowDimensions') return () => mockWindow;
    if (key === 'AppState') return { currentState: 'active', addEventListener: () => ({ remove: () => {} }) };
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => effect(), [effect]) }));
jest.mock('../agreementClientService', () => ({ agreementProblemService: { submit: jest.fn(), read: jest.fn() } }));
jest.mock('../groupConversationService', () => ({ groupConversationService: { context: jest.fn().mockResolvedValue({ ok: true, podatak: { group: null } }) } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' } }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
// One store answers both names (ui/system/motion, 2026-09-24): mocking it covers useSystemReducedMotion and every
// component that reads useReducedMotion directly, so the whole tree sees the value this suite chose.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReducedMotion }));
// Keep the chat's presentation slot visible: compact identity/terms are children of its real history scroll.
jest.mock('../../ui/AgreementChat', () => ({ AgreementChat: (props: { context?: React.ReactNode }) =>
  require('react').createElement('AgreementChat', props, props.context) }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'PrivateMap' }));
// The account has a phone number unless a test says otherwise ("Podeli svoj broj" is offered only to an account that has one).
let mockAccountPhone: string | undefined = '+381601234567';
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount, phone: mockAccountPhone }, accountRevision: 0 }), sesijaSada: () => ({ user: { id: mockAccount, phone: mockAccountPhone }, accountRevision: 0 }) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource }));
jest.mock('../../hooks/useAgreementOutbox', () => ({ useAgreementOutbox: () => ({ model: { reconcile: jest.fn().mockResolvedValue(undefined) }, state: { phase: 'ready', entries: [] } }) }));
jest.mock('../../hooks/useAgreementPhotos', () => ({ useAgreementPhotos: () => ({ agreementId: mockAgreementId, loaded: true, busy: false, items: [] }) }));
jest.mock('../agreementMessageHistoryService', () => ({
  compareAgreementMessageCursors: (left: any, right: any) => left.createdAt.localeCompare(right.createdAt) || left.messageId.localeCompare(right.messageId),
  agreementMessageHistoryService: {
    page: async (id: string, _options: unknown, scope: any) => ({ ok: true, podatak: {
      accountId: scope.accountId, agreementId: id, messages: await mockMessages(id, scope.accountId), olderCursor: null,
      asOf: '2026-09-27T13:00:00.123456Z' } }),
    window: async (id: string, target: string, _options: unknown, scope: any) => ({ ok: true, podatak: {
      accountId: scope.accountId, agreementId: id, targetMessageId: target,
      messages: await mockMessages(id, scope.accountId), beforeCursor: null, afterCursor: null, asOf: '2026-09-27T13:00:00.123456Z' } }),
    markDisplayed: (...args: unknown[]) => mockDisplayed(...args),
  },
}));
// The own-review read behind "Oceni saradnju" (2026-09-23). Default: the rating is still due, as before.
const mockReviewContext = jest.fn();
jest.mock('../reviewsClientService', () => ({ reviewsClientService: { context: (...args: unknown[]) => mockReviewContext(...args) } }));
// When and by whom a cancelled Dogovor was cancelled (CANCEL-INFO): the real module reaches supabaseClient, like the review read above. Default: the server says nothing.
const mockCancellationRead = jest.fn();
jest.mock('../agreementCancellationClientService', () => ({
  agreementCancellationService: { read: (...args: unknown[]) => mockCancellationRead(...args) },
  cancellationOf: (all: Map<string, unknown> | null | undefined, id: string) => all?.get(id.toLowerCase()) ?? null,
}));
import Dogovor from '../../app/dogovor/[id]';
import { InfoButton } from '../../ui/system/InfoButton';

const base = (patch: Record<string, unknown> = {}, mine: 'narucilac' | 'uskocer' = 'narucilac') => ({
  id: mockAgreementId, naslov: 'Pomoć pri selidbi', stanje: 'CONFIRMED', verzija: 1, cena: { prikaz: '3.000 RSD' }, pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0 },
  ucesnici: [{ id: mockAccount, ime: 'Ana', inicijali: 'AN', uloga: mine, mesta: mine === 'uskocer' ? 1 : null, viSte: true },
    { id: mockOther, ime: 'Marko', inicijali: 'MA', uloga: mine === 'narucilac' ? 'uskocer' : 'narucilac', mesta: mine === 'narucilac' ? 1 : null, viSte: false }],
  hronologija: [{ vremeTekst: 'juče', tekst: 'Dogovor je potvrđen' }], kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: false },
  chatDostupan: true, vremeTekst: 'Fleksibilno', putanjaTekst: 'Beograd', problemOtvoren: false, rokPotvrdeIso: null, rezim: 'FIZICKI',
  radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: false, predlogIzmene: null },
  izvor: { zadatakId: mockNeedId, prijavaId: mockApplicationId }, ...patch });
let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAll(node => String(node.type) === 'Press');
const brand = () => presses().filter(node => surfaceOf(node.props.style) === brandAction.backgroundColor).map(node => node.props.accessibilityLabel);
const labels = () => presses().map(node => node.props.accessibilityLabel);
async function render(workspace: Record<string, unknown>, messageRows: unknown[] = []) {
  mockRead.mockResolvedValue(workspace); mockMessages.mockResolvedValue(messageRows);
  await act(async () => { tree = create(<Dogovor />); });
}
beforeEach(() => { jest.clearAllMocks(); mockReducedMotion = false; mockParams = { id: mockAgreementId }; mockMessagesRead.mockResolvedValue(0);
  mockDisplayed.mockReset().mockResolvedValue({ ok: true, podatak: {} });
  mockWindow = { width: 390, height: 844, fontScale: 1, scale: 3 };
  mockReviewContext.mockReset().mockResolvedValue({ ok: true, podatak: { eligible: true, review: null } });
  mockCancellationRead.mockReset().mockResolvedValue({ ok: true, podatak: new Map() }); mockAccountPhone = '+381601234567'; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

const quietLine = () => tree.root.findAllByProps({ testID: 'agreement-quiet-line' }).map(node => node.props.children);
test('a confirmed Agreement with nothing to do shows no green action - one grey sentence of the state - and names the next step', async () => {
  await render(base());
  // Plan 2.6: when nothing waits for the person there is no button, and the conversation is not offered a second time: it is the Poruke tab.
  expect(brand()).toEqual([]); expect(labels()).not.toContain('Otvori poruke');
  expect(quietLine()).toEqual(['Čeka da Marko javi da je zadatak gotov.']);
  const copy = texts();
  // Recomposed (2026-09-23): the step is one line with a dot in the state's colour; no "Sledeći korak" eyebrow over it.
  // Round-1 critique A13 (owner step 8): the state is the step's title and the next step its sentence; the title
  // used to be the step, which the sentence under it then said again.
  expect(copy).toContain('Dogovoreno'); expect(copy).not.toContain('Sledeći korak'); expect(copy).not.toContain('Potvrdi završetak kada je zadatak obavljen');
  // The one who asked for the work is told whose move it is by the foot alone: the head adds no second sentence (J5).
  expect(copy).not.toContain('Završetak potvrđuješ kada je zadatak obavljen.');
  // What can be done is on the page as rows (J15, owner 2026-10-08), the four of them, and the bar of the overview has no "···".
  expect(labels()).toEqual(expect.arrayContaining(['Izmeni uslove', 'Prijavi problem', 'Otkaži Dogovor', 'Prijavi ili blokiraj osobu', 'Tok Dogovora']));
  expect(labels()).not.toContain('Više radnji');
  // The number and the place are ONE open section, not a closed "Kontakt" row and a closed "Lokacija i pristup" row.
  expect(copy).toContain('Kontakt i mesto'); expect(labels()).not.toContain('Kontakt'); expect(labels()).not.toContain('Lokacija i pristup');
  expect(copy).toContain('Broj druge strane'); expect(copy).toContain('Još nije podeljen.');
  // The timeline is progressive disclosure: collapsed until the user asks for it.
  expect(copy).not.toContain('Dogovor je potvrđen');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Tok Dogovora' }).props.onPress());
  expect(texts()).toContain('Dogovor je potvrđen');
});
test('when the server allows completion, completion is the brand action and the conversation stays one tap away', async () => {
  await render(base({ radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: true, izmenaNaCekanju: false, predlogIzmene: null } }));
  // The conversation is one tap away through the header icon; completion keeps the primary footer.
  expect(brand()).toEqual(['Potvrdi završetak']); expect(labels()).toContain('Poruke'); expect(labels()).not.toContain('Otvori poruke');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Potvrdi završetak' }).props.onPress());
  expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Da, potvrdi završetak' }).props.onPress());
  expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledWith(mockAgreementId);
});
test.each([false, true])('completion review uses the accepted facts, sends nothing on Back and respects reduced motion (%s)', async reduced => {
  mockReducedMotion = reduced;
  await render(base({ vremeTekst: '26. septembar, 10:00–12:00', cena: { prikaz: '4.200 RSD' },
    radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: true, izmenaNaCekanju: false, predlogIzmene: null } }));
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Potvrdi završetak' }).props.onPress());
  const modal = tree.root.findByType('Modal' as any);
  expect(modal.props.animationType).toBe(reduced ? 'none' : 'slide');
  expect(modal.findByProps({ accessibilityLabel: 'Dogovoreni termin: 26. septembar, 10:00–12:00' })).toBeTruthy();
  expect(modal.findByProps({ accessibilityLabel: 'Dogovoreno ukupno: 4.200 RSD' })).toBeTruthy();
  expect(texts()).toContain('Marko');
  const retained = tree.root.findByProps({ accessibilityLabel: 'Da, potvrdi završetak' }).props.onPress;
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Nazad na Dogovor' }).props.onPress());
  await act(async () => retained());
  expect(tree.root.findAllByType('Modal' as any)).toHaveLength(0);
  expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled(); expect(mockSource.oznaciZavrsetak).not.toHaveBeenCalled();
});
// The review the green button opens says ONE sentence of what happens (J5): what the other side gets to do, or what is being confirmed. What follows
// - the rating - is on the page they return to, and in the "ⓘ" of its head.
test.each([
  ['the worker', 'uskocer', 'radnje', 'Zadatak je gotov', 'Druga strana će dobiti zahtev da potvrdi završetak ili prijavi problem.', 'Dogovor zatim čeka potvrdu.'],
  ['the requester', 'narucilac', 'radnje', 'Potvrdi završetak', 'Potvrđuješ da je zadatak obavljen po prihvaćenim uslovima.', 'možeš da oceniš saradnju'],
] as const)('the completion review of %s is one sentence', async (_who, mine, _key, button, sentence, dropped) => {
  const allows = mine === 'uskocer' ? { mozeOznacitiZavrsetak: true, mozePotvrditiZavrsetak: false } : { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: true };
  await render(base({ radnje: { ...allows, izmenaNaCekanju: false, predlogIzmene: null } }, mine));
  await act(async () => tree.root.findByProps({ accessibilityLabel: button }).props.onPress());
  const modal = tree.root.findByType('Modal' as any);
  const said = modal.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
  expect(said).toContain(sentence); expect(said).not.toContain(dropped);
});
test('native Back dismisses a worker completion review without marking the work done', async () => {
  await render(base({ radnje: { mozeOznacitiZavrsetak: true, mozePotvrditiZavrsetak: false, izmenaNaCekanju: false, predlogIzmene: null } }, 'uskocer'));
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Zadatak je gotov' }).props.onPress());
  expect(texts()).toContain('Druga strana će dobiti zahtev da potvrdi završetak ili prijavi problem.');
  expect(labels()).toContain('Da, zadatak je gotov');
  await act(async () => tree.root.findByType('Modal' as any).props.onRequestClose());
  expect(mockSource.oznaciZavrsetak).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('Modal' as any)).toHaveLength(0);
});
test('a worker awaiting the requester sees the wait and the deadline; no completion action is offered', async () => {
  await render(base({ stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z' }, 'uskocer'));
  const copy = texts();
  // The state is said once, by the step (round-1 critique A13); the bar says who the other person is instead of
  // repeating it as "Čeka se potvrda završetka".
  expect(copy).toContain('Čeka se potvrda druge strane'); expect(copy).toContain('Bez odgovora se Dogovor zatvara sam.'); expect(copy).not.toContain('Čeka se potvrda završetka');
  expect(copy).toContain('Traži pomoć');
  // No button: the footer says in one grey sentence who the Dogovor waits for.
  expect(brand()).toEqual([]); expect(labels()).not.toContain('Zadatak je gotov'); expect(labels()).not.toContain('Otvori poruke');
  expect(quietLine()).toEqual(['Čeka da Marko potvrdi završetak.']);
});
test('after the worker says done the requester confirms or reports a problem; changes and cancelling are not offered (owner decision 2026-09-21)', async () => {
  await render(base({ stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z',
    radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: true, izmenaNaCekanju: false, predlogIzmene: null } }));
  expect(brand()).toEqual(['Potvrdi završetak']);
  expect(labels()).toContain('Prijavi problem'); expect(labels()).toContain('Prijavi ili blokiraj osobu');
  expect(labels()).not.toContain('Izmeni uslove'); expect(labels()).not.toContain('Otkaži Dogovor');
  // The worker in the same state keeps the rows: the owner's rule names the requester only.
  await act(async () => tree.unmount());
  await render(base({ stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z' }, 'uskocer'));
  expect(labels()).toContain('Izmeni uslove'); expect(labels()).toContain('Otkaži Dogovor');
});
test('a completed Agreement leads with the review; a cancelled one offers no action and says so', async () => {
  await render(base({ stanje: 'COMPLETED' }));
  expect(brand()).toEqual(['Oceni saradnju']); expect(texts()).toContain('Dogovor je završen'); expect(labels()).not.toContain('Trenutna lokacija osobe koja dolazi'); expect(labels()).not.toContain('Podeli svoju trenutnu lokaciju');
  // Nothing is left to change or cancel on a finished Dogovor, so no row leads to a screen without an action; the person can still be reported or blocked.
  expect(labels()).not.toContain('Izmeni uslove'); expect(labels()).not.toContain('Otkaži Dogovor'); expect(labels()).toContain('Prijavi ili blokiraj osobu');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Oceni saradnju' }).props.onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/oceni-dogovor', params: { agreementId: mockAgreementId } });
  await act(async () => tree.unmount());
  await render(base({ stanje: 'CANCELLED' }));
  // The state is said once, by the head; the foot has no second sentence for it and so draws no bar.
  expect(brand()).toEqual([]); expect(quietLine()).toEqual([]); expect(texts()).toContain('Dogovor je otkazan'); expect(texts().match(/Dogovor je otkazan/g)).toHaveLength(1);
  expect(tree.root.findAllByProps({ testID: 'agreement-action-footer' })).toHaveLength(0);
  expect(labels()).not.toContain('Prijavi problem'); expect(labels()).not.toContain('Izmeni uslove'); expect(labels()).not.toContain('Otkaži Dogovor'); expect(labels()).not.toContain('Otvori poruke');
});
// "Oceni saradnju" stayed on the footer after the rating was saved (phone, 2026-09-23). The route now asks the existing
// own-review read, inside its guarded workspace read, and offers the rating only while it can still be given.
describe('the rating is offered only while it is not given', () => {
  const ownReview = { reviewId: '50000000-0000-4000-8000-000000000001', agreementId: mockAgreementId, reviewerAccountId: mockAccount,
    targetAccountId: mockOther, rating: 5, tags: [], clientRequestId: '60000000-0000-4000-8000-000000000001', createdAt: '2026-09-23T10:00:00Z',
    idempotentReplay: false, authoritative: true };
  test('a saved rating takes the green action away, says the rating is kept, and finishes the step bar', async () => {
    mockReviewContext.mockResolvedValue({ ok: true, podatak: { accountId: mockAccount, agreementId: mockAgreementId, targetAccountId: mockOther,
      eligible: false, review: ownReview, authoritative: true } });
    await render(base({ stanje: 'COMPLETED' }));
    expect(mockReviewContext).toHaveBeenCalledWith(mockAgreementId, { accountId: mockAccount, accountRevision: 0 });
    expect(brand()).toEqual([]); expect(labels()).not.toContain('Oceni saradnju'); expect(labels()).not.toContain('Otvori poruke');
    expect(quietLine()).toEqual([]); expect(texts().match(/Dogovor je završen/g)).toHaveLength(1);
    expect(texts()).toContain('Tvoja ocena je sačuvana.');
    expect(tree.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityValue.text)
      .toBe('Dogovoreno: urađeno. Gotovo: urađeno. Potvrđeno: urađeno. Ocena: urađeno.');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
  test('a rating that can no longer be given is not offered either', async () => {
    mockReviewContext.mockResolvedValue({ ok: true, podatak: { eligible: false, review: null } });
    await render(base({ stanje: 'COMPLETED' }));
    expect(brand()).toEqual([]); expect(quietLine()).toEqual([]); expect(texts()).toContain('Dogovor je završen'); expect(texts()).not.toContain('Ocena pomaže drugima da izaberu.');
  });
  test('a due rating is the one brand action', async () => {
    await render(base({ stanje: 'COMPLETED' }));
    expect(brand()).toEqual(['Oceni saradnju']); expect(texts()).toContain('Ocena pomaže drugima da izaberu.');
  });
  test.each([['refused', () => mockReviewContext.mockResolvedValue({ ok: false, kod: 'REVIEW_READ_UNAVAILABLE', poruka: 'x' })],
    ['thrown', () => mockReviewContext.mockRejectedValue(new Error('offline'))]])(
    'a review read that did not answer (%s) keeps the rating on offer and never hides the Dogovor', async (_name, fail) => {
      fail();
      await render(base({ stanje: 'COMPLETED' }));
      expect(brand()).toEqual(['Oceni saradnju']); expect(texts()).toContain('Dogovor je završen');
    });
  test('the review read is asked only for a finished Dogovor', async () => {
    await render(base());
    await act(async () => tree.unmount());
    await render(base({ stanje: 'CANCELLED' }));
    expect(mockReviewContext).not.toHaveBeenCalled();
  });
  // The read runs before a finished Dogovor first shows, and a read that does not answer changes nothing, so it waits
  // 5 s, not the 15 s a command gets (review of plan step 0, 2026-09-24).
  test('a review read that hangs holds a finished Dogovor for 5 s at most, then keeps the rating on offer', async () => {
    jest.useFakeTimers();
    try {
      mockReviewContext.mockReturnValue(new Promise(() => {}));
      await render(base({ stanje: 'COMPLETED' }));
      expect(texts()).not.toContain('Dogovor je završen');
      await act(async () => { jest.advanceTimersByTime(4_999); });
      expect(texts()).not.toContain('Dogovor je završen');
      await act(async () => { jest.advanceTimersByTime(1); });
      expect(brand()).toEqual(['Oceni saradnju']); expect(texts()).toContain('Dogovor je završen');
    } finally { jest.useRealTimers(); }
  });
});
// A missing agreed amount printed "0 RSD" (plan step 0, 2026-09-23). The database allows only an amount above zero, so an
// empty or zero amount was never saved, and every Dogovor screen that shows the price says so in words.
describe('a Dogovor without a saved amount says so and never shows one', () => {
  const missing = { iznos: 0, valuta: 'RSD', prikaz: '' };
  // The basis now stands beside the amount as one word, "ukupno" (round-1 critique B17); it was a note under it.
  test('the overview writes it in words, with no "ukupno" beside it', async () => {
    await render(base({ cena: missing }));
    expect(texts()).toContain('Iznos nije sačuvan'); expect(texts()).not.toContain('0 RSD');
    expect(texts()).not.toContain('ukupno');
    expect(tree.root.findByProps({ accessibilityLabel: 'Cena: Iznos nije sačuvan' })).toBeTruthy();
    // The same overview with a saved amount keeps its basis, so the check above is about the missing amount only.
    await act(async () => tree.unmount());
    await render(base());
    expect(texts()).toContain('3.000 RSD'); expect(texts()).toContain('ukupno');
    expect(tree.root.findByProps({ accessibilityLabel: 'Dogovoreno ukupno: 3.000 RSD' })).toBeTruthy();
  });
  test('Poruke opens the accepted overview where the missing amount stays words, never an invented price', async () => {
    mockParams = { id: mockAgreementId, tab: 'poruke' };
    await render(base({ cena: missing }));
    expect(tree.root.findAllByType('AgreementChat' as any)).toHaveLength(1);
    expect(texts()).not.toContain('0 RSD');
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Dogovor: Pomoć pri selidbi. Marko' }).props.onPress());
    expect(tree.root.findAllByType('AgreementChat' as any)).toHaveLength(0);
    const summary = tree.root.findByProps({ accessibilityLabel: 'Cena: Iznos nije sačuvan' });
    const copy = summary.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join('');
    expect(copy).toContain('Iznos nije sačuvan'); expect(copy).not.toContain('0 RSD'); expect(copy).not.toContain('ukupno');
  });
  test('the completion review writes it as a label, never in the amount style', async () => {
    await render(base({ cena: missing, radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: true, izmenaNaCekanju: false, predlogIzmene: null } }));
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Potvrdi završetak' }).props.onPress());
    const modal = tree.root.findByType('Modal' as any);
    const fact = modal.findAll(node => node.props.label === 'Dogovoreno ukupno' && node.props.prominentAs !== undefined)[0];
    expect(fact.props.value).toBe('Iznos nije sačuvan'); expect(fact.props.prominentAs).toBe('label');
    expect(modal.findByProps({ accessibilityLabel: 'Dogovoreno ukupno: Iznos nije sačuvan' })).toBeTruthy();
    expect(texts()).not.toContain('0 RSD');
  });
});
// R19: ordinary chat keeps its true waiting notice and a header entry to all accepted terms. It no longer
// duplicates the accepted card above the transcript. Other-side waits and unknown ratings claim nothing.
describe('Poruke says what waits for me and keeps accepted terms one press away', () => {
  beforeEach(() => { mockParams = { id: mockAgreementId, tab: 'poruke' }; });
  // The fixtures are built when each test runs (`proposal` is declared further down this file).
  test.each([
    ['a completion the other side marked, as the requester', () => base({ stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z' }),
      'Završetak je označen i čeka tvoju potvrdu'],
    ['a change the other side proposed', () => base({ radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: true,
      predlogIzmene: proposal() } }), 'Predlog izmene čeka tvoj odgovor'],
    ['a finished Dogovor whose rating is due', () => base({ stanje: 'COMPLETED', chatDostupan: false }), 'Čeka tvoju ocenu'],
  ])('%s', async (_name, workspace, words) => {
    await render(workspace());
    expect(labels()).toContain('Dogovor: Pomoć pri selidbi. Marko');
    expect(texts()).toContain(words); expect(texts()).not.toContain('3.000 RSD');
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Dogovor: Pomoć pri selidbi. Marko' }).props.onPress());
    expect(tree.root.findAllByType('AgreementChat' as any)).toHaveLength(0);
    expect(tree.root.findByProps({ accessibilityLabel: 'Dogovoreno ukupno: 3.000 RSD' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Termin: Fleksibilno' })).toBeTruthy();
    // Approximate task context belongs to the source link, separate from accepted time and price.
    expect(tree.root.findByProps({ accessibilityLabel: 'Otvori zadatak: Pomoć pri selidbi. Beograd' })).toBeTruthy();
  });
  test.each([
    ['the worker, whose completion waits for the other side', () => base({ stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z' }, 'uskocer')],
    ['my own proposal', () => base({ radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: true,
      predlogIzmene: proposal({ moj: true, mozeOdgovoriti: false, mozePovuci: true }) } })],
    ['a rating the read could not answer for', () => { mockReviewContext.mockResolvedValue({ ok: false, kod: 'REVIEW_READ_UNAVAILABLE', poruka: 'x' });
      return base({ stanje: 'COMPLETED', chatDostupan: false }); }],
    ['a confirmed Dogovor with nothing to do', () => base()],
  ])('%s: no false waiting notice, and the accepted terms remain accessible', async (_name, workspace) => {
    await render(workspace());
    expect(labels()).toContain('Dogovor: Pomoć pri selidbi. Marko');
    expect(texts()).not.toContain('Završetak je označen i čeka tvoju potvrdu');
    expect(texts()).not.toContain('Predlog izmene čeka tvoj odgovor');
    expect(texts()).not.toContain('Čeka tvoju ocenu');
    expect(texts()).not.toContain('3.000 RSD');
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Dogovor: Pomoć pri selidbi. Marko' }).props.onPress());
    expect(tree.root.findByProps({ accessibilityLabel: 'Dogovoreno ukupno: 3.000 RSD' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Termin: Fleksibilno' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Otvori zadatak: Pomoć pri selidbi. Beograd' })).toBeTruthy();
  });
});
test('unconfirmed permissions keep completion closed and explain how to refresh, inside the next-step card', async () => {
  await render(base({ radnje: null }));
  // Nothing is offered and nothing is claimed: the footer stays silent, since the card above already says how to read the permissions again.
  expect(brand()).toEqual([]); expect(quietLine()).toEqual([]);
  expect(texts()).toContain('Ne možemo da proverimo da li možeš da završiš zadatak. Osveži Dogovor.');
  expect(labels()).toContain('Osveži Dogovor');
});

// A pending change blocks both completions. It used to be one grey sentence on this screen with
// nothing to press, and what it proposed lived behind the hub of the changes.
const proposal = (patch: Record<string, unknown> = {}) => ({ id: 'p1', moj: false, mozeOdgovoriti: true, mozePovuci: false,
  razlog: 'Ima više stvari nego što je rečeno.', izmene: [{ polje: 'Cena', sada: '3.000 RSD', predlog: '4.500 RSD' }], ...patch });
test('a change proposal waiting for my answer is the next step, says what it changes, and is the one brand action', async () => {
  await render(base({ radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: true, predlogIzmene: proposal() } }));
  const copy = texts();
  expect(copy).toContain('Predlog izmene čeka tvoj odgovor'); expect(copy).toContain('Cena'); expect(copy).toContain('3.000 RSD');
  expect(copy).toContain('4.500 RSD'); expect(copy).toContain('Ima više stvari nego što je rečeno.');
  expect(copy).toContain('Završetak je moguć tek kada se predlog prihvati, odbije ili povuče.');
  expect(brand()).toEqual(['Odgovori na predlog']); expect(labels()).toContain('Poruke');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Odgovori na predlog' }).props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/dogovor/[id]/izmene', params: { id: mockAgreementId } });
});
test('my own pending proposal is shown as mine and does not take the brand action from the conversation', async () => {
  await render(base({ radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: true,
    predlogIzmene: proposal({ moj: true, mozeOdgovoriti: false, mozePovuci: true }) } }));
  expect(texts()).toContain('Tvoj predlog izmene čeka odgovor'); expect(texts()).toContain('4.500 RSD');
  expect(brand()).toEqual([]); expect(labels()).toContain('Pogledaj predlog');
  expect(quietLine()).toEqual(['Čeka da Marko odgovori na tvoj predlog izmene.']);
});
test('a pending change whose content cannot be read still says it exists and leads to Izmene, inventing nothing', async () => {
  await render(base({ radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: true, predlogIzmene: null } }));
  expect(texts()).toContain('Predlog izmene čeka odgovor'); expect(labels()).toContain('Pogledaj predlog'); expect(brand()).toEqual([]);
  expect(quietLine()).toEqual(['Predlog izmene čeka odgovor.']);
});

// PKG-048 (F12 / D02): a Dogovor is the end of one lived flow, so it says where it came from. Each side
// opens its own end, and a server that does not carry the ids offers no invented destination.
// The task link leads the overview; accepted terms stay separate from its current-detail destination.
const row = (label: string) => presses().find(node => node.props.accessibilityLabel === label)!;
const rowTexts = (label: string) => row(label).findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string'));
test('the requester reaches the Zadatak this Dogovor grew out of, and is offered no Prijava of their own', async () => {
  await render(base());
  expect(labels()).toContain('Otvori zadatak: Pomoć pri selidbi. Beograd');
  // The row only leads to the task; the work's name is the head of the page and its place is a row of the terms.
  expect(rowTexts('Otvori zadatak: Pomoć pri selidbi. Beograd')).toEqual(['Otvori zadatak']);
  expect(tree.root.findByProps({ accessibilityLabel: 'Dogovoreno ukupno: 3.000 RSD' })).toBeTruthy();
  expect(tree.root.findByProps({ accessibilityLabel: 'Mesto: Beograd' })).toBeTruthy();
  expect(labels()).not.toContain('Zadatak');
  expect(labels()).not.toContain('Tvoja prijava'); expect(labels()).not.toContain('Prijava');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Otvori zadatak: Pomoć pri selidbi. Beograd' }).props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/pregled', params: { id: mockNeedId } });
});
test('the worker reaches the Prilika and the offer they sent', async () => {
  await render(base({}, 'uskocer'));
  expect(rowTexts('Otvori zadatak: Pomoć pri selidbi. Beograd')).toEqual(['Otvori zadatak']);
  expect(tree.root.findByProps({ accessibilityLabel: 'Dogovoreno ukupno: 3.000 RSD' })).toBeTruthy();
  expect(labels()).not.toContain('Zadatak'); expect(rowTexts('Tvoja prijava')).toEqual(['Tvoja prijava']);
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Otvori zadatak: Pomoć pri selidbi. Beograd' }).props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/prilike/[id]', params: { id: mockNeedId } });
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Tvoja prijava' }).props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/moje-prijave', params: { prijavaId: mockApplicationId } });
});
test.each([
  ['a reader that does not carry the links', { izvor: { zadatakId: null, prijavaId: null } }],
  ['a projection saved before the links existed', { izvor: undefined }],
])('%s offers no source row instead of one that leads nowhere', async (_label, patch) => {
  await render(base(patch, 'uskocer'));
  expect(labels()).not.toContain('Zadatak');
  expect(labels()).not.toContain('Otvori zadatak: Pomoć pri selidbi. Beograd');
  expect(labels()).not.toContain('Tvoja prijava');
  expect(tree.root.findByProps({ accessibilityLabel: 'Dogovoreno ukupno: 3.000 RSD' })).toBeTruthy();
  // The rest of the screen is unaffected.
  expect(labels()).toContain('Izmeni uslove');
});

// B3a: loaded history is not a display receipt. Only the UI's measured IDs are admitted.
const messageRows = [{ id: '50000000-0000-4000-8000-000000000001', posiljalacAccountId: mockOther,
  posiljalacIme: 'Sagovornik', moja: false, telo: 'Stižem uskoro.', vremeTekst: '07:36', procitano: null,
  createdAt: '2026-09-27T07:36:00.123456Z', kind: 'TEXT' }];
test('showing a loaded Poruke tab sends no receipt until the actual incoming row is displayed', async () => {
  mockParams = { id: mockAgreementId, tab: 'poruke' };
  await render(base(), messageRows);
  expect(mockMessagesRead).not.toHaveBeenCalled(); expect(mockDisplayed).not.toHaveBeenCalled();
  const display = tree.root.findByType('AgreementChat' as any).props.onDisplayedMessageIds;
  await act(async () => display([messageRows[0].id]));
  expect(mockDisplayed).toHaveBeenCalledWith(mockAgreementId, [messageRows[0].id], { accountId: mockAccount, accountRevision: 0 });
  await act(async () => tree.update(<Dogovor />));
  expect(mockDisplayed).toHaveBeenCalledTimes(1); expect(mockMessagesRead).not.toHaveBeenCalled();
});
test('the Pregled tab settles nothing: the person has not read the messages there', async () => {
  await render(base(), messageRows);
  expect(mockMessagesRead).not.toHaveBeenCalled();
});
test('a refused settlement leaves the conversation exactly as it was', async () => {
  mockParams = { id: mockAgreementId, tab: 'poruke' };
  mockDisplayed.mockRejectedValue(new Error('MESSAGES_READ_UNCONFIRMED'));
  await render(base(), messageRows);
  const chat = tree.root.findByType('AgreementChat' as any);
  await act(async () => chat.props.onDisplayedMessageIds([messageRows[0].id]));
  expect(mockDisplayed).toHaveBeenCalledWith(mockAgreementId, [messageRows[0].id], { accountId: mockAccount, accountRevision: 0 });
  expect(mockMessagesRead).not.toHaveBeenCalled();
  expect(chat.props.messages).toEqual([{ ...messageRows[0], posiljalacIme: 'Marko' }]);
});

test('an empty Poruke history does not acknowledge messages that were never shown', async () => {
  mockParams = { id: mockAgreementId, tab: 'poruke' };
  await render(base());
  expect(mockMessagesRead).not.toHaveBeenCalled();
  expect(tree.root.findAll(node => String(node.type) === 'AgreementChat')).toHaveLength(1);
});

// V41 (owner, 2026-09-23): the top bar names the person the Dogovor is with, the same on both tabs. Round-1 critique
// A13 (owner step 8): what they are to me stands under the name; the state is said once, by the step.
const headers = () => tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header').map(node => node.children.join(''));
const bar = () => tree.root.findAll(node => node.props.variant === 'detail' && typeof node.type !== 'string')[0];
test('the top bar keeps the other person on both views, then Back returns to the overview before leaving', async () => {
  await render(base());
  expect(headers()).toContain('Marko'); expect(headers()).not.toContain('Dogovor'); expect(texts()).toContain('Dogovoreno');
  expect(bar().props.subtitle).toBe('Uskače na tvoj zadatak');
  // Match the state text itself, not the accepted-price label "Dogovoreno ukupno".
  // (The step bar draws "Dogovoreno" as its first step; the state is said in words once, by the step card's title.)
  expect(tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header' && node.children.join('') === 'Dogovoreno')).toHaveLength(1);
  // No rating is invented for a person the Dogovor carries none for.
  expect(texts()).not.toContain('Još nema ocena');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Poruke' }).props.onPress());
  expect(headers()).toContain('Marko'); expect(headers()).not.toContain('Poruke');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress());
  expect(mockRouter.back).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('AgreementChat' as any)).toHaveLength(0);
  expect(tree.root.findByProps({ accessibilityLabel: 'Dogovoreno ukupno: 3.000 RSD' })).toBeTruthy();
  expect(headers()).toContain('Marko');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress());
  expect(mockRouter.back).toHaveBeenCalledTimes(1); expect(mockRouter.replace).not.toHaveBeenCalled();
});
describe('the compact conversation keeps complete identity and accepted terms reachable', () => {
  beforeEach(() => {
    mockWindow = { width: 320, height: 718, fontScale: 2, scale: 3 };
    mockParams = { id: mockAgreementId, tab: 'poruke' };
  });
  test.each([
    ['saved', { prikaz: '3.000 RSD' }, '3.000 RSD'],
    ['missing', { iznos: 0, valuta: 'RSD', prikaz: '' }, 'Iznos nije sačuvan'],
  ])('keeps the %s amount truthful and returns to its accepted overview', async (kind, cena, amount) => {
    await render(base({ cena, vremeTekst: '26. sep · 10:00–12:00 (po vremenu u Srbiji)' }));
    const chat = tree.root.findByType('AgreementChat' as any);
    expect(chat.props.compact).toBe(true);
    const context = chat.findByProps({ testID: 'agreement-thread-context' });
    const amountLabel = kind === 'missing' ? 'Cena' : 'Dogovoreno ukupno';
    expect(context.findByProps({ accessibilityLabel: `${amountLabel}: ${amount}` })).toBeTruthy();
    expect(context.findByProps({ accessibilityLabel: 'Termin: 26. sep · 10:00–12:00, Po vremenu u Srbiji' })).toBeTruthy();
    expect(headers()).toContain('Marko');
    expect(texts()).toContain('Uskače na tvoj zadatak');
    expect(texts()).not.toContain('Još nema ocena');
    if (kind === 'missing') {
      expect(texts()).not.toContain('0 RSD');
      expect(texts()).not.toContain('ukupno');
    }
    expect(tree.root.findByProps({ accessibilityLabel: 'Poruke: Marko' })).toBeTruthy();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Uslovi Dogovora: Pomoć pri selidbi' }).props.onPress());
    expect(tree.root.findAllByType('AgreementChat' as any)).toHaveLength(0);
    expect(tree.root.findByProps({ accessibilityLabel: `${amountLabel}: ${amount}` })).toBeTruthy();
    expect(labels()).toContain('Poruke');
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(mockMessages).toHaveBeenCalledTimes(1);
  });
  test('names the real waiting action without losing accepted terms, and compact Back visits the overview before leaving', async () => {
    await render(base({ stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z' }));
    const waiting = 'Završetak je označen i čeka tvoju potvrdu';
    expect(labels()).toContain(`Uslovi Dogovora: Pomoć pri selidbi. ${waiting}`);
    expect(texts()).toContain(waiting);
    expect(texts()).toContain('3.000 RSD');
    expect(headers()).toContain('Marko');
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress());
    expect(mockRouter.back).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('AgreementChat' as any)).toHaveLength(0);
    expect(tree.root.findByProps({ accessibilityLabel: 'Dogovoreno ukupno: 3.000 RSD' })).toBeTruthy();
    expect(headers()).toContain('Marko');
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

test('a Dogovor that does not name the other side keeps the word Dogovor and says its state once, in the step', async () => {
  const lone = base({ stanje: 'AWAITING_REQUESTER' }, 'uskocer') as { ucesnici: { viSte: boolean }[] };
  await render({ ...lone, ucesnici: lone.ucesnici.filter(person => person.viSte) });
  expect(headers()).toContain('Dogovor'); expect(texts()).toContain('Čeka se potvrda druge strane');
  expect(texts()).not.toContain('Čeka se potvrda završetka');
});

// The 1:1 overview keeps identity in the bar and no duplicated participants block. Accepted covered people
// remain explicit beside the total, including one person; a group retains its participant details.
describe('the overview of a 1:1 Dogovor says each thing once', () => {
  const people = () => texts().match(/Ti · (tražiš pomoć|uskačeš)/g) ?? [];
  test('it omits a duplicated participants block but states accepted people; a group Dogovor keeps both', async () => {
    await render(base());
    expect(people()).toHaveLength(0); expect(texts()).toContain('1 osoba');
    expect(tree.root.findAll(node => String(node.type) === 'View' && node.props.accessibilityLabel === 'Ljudi: 1 osoba')).toHaveLength(1);
    await act(async () => tree.unmount());
    await render(base({ pokrivenost: { ukupno: 3, popunjeno: 2, preostalo: 1 } }));
    expect(people()).toEqual(['Ti · tražiš pomoć']); expect(texts()).toContain('Uskače');
    expect(tree.root.findAll(node => String(node.type) === 'View' && node.props.accessibilityLabel === 'Ljudi: 2 osobe')).toHaveLength(1);
  });
  test('the terms are rows of the one list: the term and its zone are one sentence, the place and the people have their own rows, and nothing is drawn twice', async () => {
    await render(base({ vremeTekst: '26. sep · 10:00–12:00 (po vremenu u Srbiji)' }));
    expect(tree.root.findByProps({ accessibilityLabel: 'Termin: 26. sep · 10:00–12:00 (po vremenu u Srbiji)' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Mesto: Beograd' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Ljudi: 1 osoba' })).toBeTruthy();
    expect(headers().filter(word => word === 'Uslovi')).toHaveLength(1);
  });
  test('the conversation\'s compact context keeps the facts at 24 px drawings and rows of at least 36, with the zone of the term on a separate line', async () => {
    // At the owner's largest text the context joins the conversation's own scroll (it stands in the bar when there is room).
    mockParams = { id: mockAgreementId, tab: 'poruke' }; mockWindow = { width: 320, height: 718, fontScale: 2, scale: 3 };
    await render(base({ vremeTekst: '26. sep · 10:00–12:00 (po vremenu u Srbiji)' }));
    const fact = tree.root.findAll(node => String(node.type) === 'View' && node.props.accessibilityLabel === 'Termin: 26. sep · 10:00–12:00, Po vremenu u Srbiji')[0];
    const flat = (style: unknown): Record<string, unknown> => Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : (style as Record<string, unknown>) ?? {};
    expect(flat(fact.props.style).minHeight).toBe(36);
    expect(fact.findAll(node => node.props.kind === 'calendar' && typeof node.type !== 'string')[0].props.size).toBe(24);
    const lines = fact.findAll(node => String(node.type) === 'T').map(node => node.children.filter(child => typeof child === 'string').join(''));
    // The small label stays spoken only ("Termin: ..."); what is drawn is the value and, under it, the zone.
    expect(lines).toEqual(['26. sep · 10:00–12:00', 'Po vremenu u Srbiji']);
  });
  test.each(['COMPLETED', 'CANCELLED'])('a %s Dogovor without a time says "Bez tačnog termina"', async state => {
    await render(base({ stanje: state, vremeTekst: 'Termin nije potvrđen' }));
    expect(texts()).toContain('Bez tačnog termina'); expect(texts()).not.toContain('Termin nije potvrđen'); expect(texts()).not.toContain('Termin još nije dogovoren');
  });
  // Both spellings of the adapter's sentence are understood: a read from before 2026-10-08 still says "nije potvrđen".
  test.each(['Termin nije dogovoren', 'Termin nije potvrđen'])('an active Dogovor without a time says it was not agreed (%s) and offers to propose one (R02)', async spelling => {
    await render(base({ vremeTekst: spelling }));
    expect(tree.root.findByProps({ accessibilityLabel: 'Termin: Nije dogovoren' })).toBeTruthy();
    expect(texts()).not.toContain('Termin nije potvrđen');
    expect(headers()).toContain('Termin još nije dogovoren');
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Predloži termin' }).props.onPress());
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/dogovor/[id]/izmene', params: { id: mockAgreementId, start: 'propose' } });
  });
  test.each([
    ['a Dogovor with a term', { vremeTekst: '26. sep · 10:00–12:00' }],
    ['a finished one', { stanje: 'COMPLETED', vremeTekst: 'Termin nije dogovoren' }],
    ['one with a change proposal waiting', { vremeTekst: 'Termin nije dogovoren', radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: true, predlogIzmene: { id: 'p1', moj: true, mozeOdgovoriti: false, mozePovuci: true, razlog: null, izmene: [] } } }],
    ['one with a problem open', { vremeTekst: 'Termin nije dogovoren', problemOtvoren: true }],
  ])('%s does not show the note about the missing term', async (_label, patch) => {
    await render(base(patch));
    expect(tree.root.findAllByProps({ testID: 'agreement-term-note' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Predloži termin' })).toHaveLength(0);
  });
});

// The adapter can only say "Ja" or "Sagovornik"; the workspace knows who the other person is, and a bubble carries that name.
test('a bubble from the other person carries their name from the workspace, not the adapter label', async () => {
  mockParams = { id: mockAgreementId, tab: 'poruke' };
  mockRead.mockResolvedValue(base());
  mockMessages.mockResolvedValue([
    { id: '50000000-0000-4000-8000-000000000001', posiljalacAccountId: mockOther, posiljalacIme: 'Sagovornik', moja: false, telo: 'Cao', vremeTekst: '07:36', procitano: null },
    { id: '50000000-0000-4000-8000-000000000002', posiljalacAccountId: mockAccount, posiljalacIme: 'Ja', moja: true, telo: 'Ok', vremeTekst: '07:49', procitano: null }]);
  await act(async () => { tree = create(<Dogovor />); });
  const chat = tree.root.findAll(node => String(node.type) === 'AgreementChat')[0];
  expect(chat.props.messages.map((message: { posiljalacIme: string }) => message.posiljalacIme)).toEqual(['Marko', 'Ja']);
});

test.each(['narucilac', 'uskocer'] as const)('retired current-location sharing is absent for %s; exact task-location disclosure remains', async role => {
  await render(base({ kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true } }, role));
  expect(labels()).not.toContain('Trenutna lokacija osobe koja dolazi');
  expect(labels()).not.toContain('Podeli svoju trenutnu lokaciju');
  // The place is part of the one open section "Kontakt i mesto": its private location is read and drawn there, never in a row of its own.
  expect(texts()).toContain('Kontakt i mesto');
  expect(labels()).not.toContain('Lokacija i pristup'); expect(labels()).not.toContain('Kontakt');
  expect(labels()).toContain('Osveži dozvolu za lokaciju');
});

// ---------------------------------------------------------------------------------------------------------------------
// Plan 2.6, the Dogovor: a step bar from the STATE, the "···" menu, a grey sentence where no button belongs, one open section
// for the number and the place, and one outcome bar after the number is shared.
// ---------------------------------------------------------------------------------------------------------------------
const stepsBar = () => tree.root.findByProps({ accessibilityRole: 'progressbar' });
const menuRows = () => presses().filter(node => node.props.accessibilityRole === 'menuitem');
const menuLabels = () => menuRows().map(node => node.props.accessibilityLabel);
const openMenu = async () => { await act(async () => tree.root.findByProps({ accessibilityLabel: 'Više radnji' }).props.onPress()); };
const chooseRow = async (label: string) => { await openMenu(); await act(async () => menuRows().find(row => row.props.accessibilityLabel === label)!.props.onPress()); };
const physical = { kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true } };

describe('the step bar under the tabs, from the state of the Dogovor', () => {
  test('stands first on the overview, ahead of the task and everything else, at the step the Dogovor is at', async () => {
    await render(base({}, 'uskocer'));
    const overview = tree.root.findByType('ScrollView' as any);
    expect((overview.children[0] as ReactTestInstance).findByProps({ testID: 'agreement-steps' })).toBeTruthy();
    expect(stepsBar().props.accessibilityLabel).toBe('Koraci Dogovora');
    expect(stepsBar().props.accessibilityValue).toEqual({ min: 1, max: 4, now: 2,
      text: 'Dogovoreno: urađeno. Gotovo: trenutni korak. Potvrđeno: na redu. Ocena: na redu.' });
    // The bar is not the history: the history holds one event, and the bar still says where the Dogovor stands.
    expect(base().hronologija).toHaveLength(1);
  });

  test('stands at the confirmation once the work is reported done, and the REAL deadline is said once, by the head - the bar adds no line of its own', async () => {
    await render(base({ stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z' }, 'uskocer'));
    expect(stepsBar().props.accessibilityValue.now).toBe(3);
    // (The phone in Jest is in UTC, so the zone is named in the sentence; on a phone in Serbia it is the time alone.)
    expect(texts()).toMatch(/Do 18\. sep( 2026)? · 12:00( \(po vremenu u Srbiji\))?\. Bez odgovora se Dogovor zatvara sam\./);
    expect(tree.root.findAllByProps({ testID: 'agreement-steps-note' })).toHaveLength(0);
    expect(texts()).not.toMatch(/Potvrda do|48\s?h/);
    // Before the work is reported done there is no deadline to name, and the one sentence never promised hours.
    await act(async () => tree.unmount());
    await render(base({}, 'uskocer'));
    expect(tree.root.findAllByProps({ testID: 'agreement-steps-note' })).toHaveLength(0);
    expect(texts()).toContain('Kad završiš, dodirni „Zadatak je gotov“.');
    expect(texts()).not.toContain('Druga strana tada potvrđuje završetak'); expect(texts()).not.toMatch(/48\s?h/);
  });

  test('says that the automatic completion is stopped while a problem is open, instead of a deadline - once, and not again in the bar or the note', async () => {
    const { agreementProblemService } = require('../agreementClientService');
    agreementProblemService.read.mockResolvedValue({ ok: true, podatak: { agreementId: mockAgreementId, agreementVersion: 1, state: 'ABSENT', report: null } });
    await render(base({ stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z', problemOtvoren: true }, 'uskocer'));
    expect(texts().match(/automatski završetak je zaustavljen/gi)).toHaveLength(1);
    expect(texts()).toContain('Prijavljen je problem — automatski završetak je zaustavljen.');
    expect(tree.root.findAllByProps({ testID: 'agreement-steps-note' })).toHaveLength(0);
  });

  test('stands at the rating when it is due', async () => {
    await render(base({ stanje: 'COMPLETED' }));
    expect(stepsBar().props.accessibilityValue.now).toBe(4);
    expect(stepsBar().props.accessibilityValue.text).toBe('Dogovoreno: urađeno. Gotovo: urađeno. Potvrđeno: urađeno. Ocena: trenutni korak.');
  });

  test('is grey as a whole when cancelled, with one line that says so', async () => {
    await render(base({ stanje: 'CANCELLED' }));
    expect(stepsBar().props.accessibilityValue).toEqual({ text: 'Dogovor je otkazan.' });
    expect(tree.root.findByProps({ testID: 'agreement-steps-cancelled' }).props.children).toBe('Otkazano');
    const greens = tree.root.findByProps({ testID: 'agreement-steps' }).findAll(node => typeof node.type === 'string'
      && [StyleSheet.flatten(node.props.style)?.backgroundColor, StyleSheet.flatten(node.props.style)?.borderColor].includes(sys.color.green));
    expect(greens).toHaveLength(0);
  });
});

describe('the actions of the overview are rows of the page, and the "···" is the conversation\'s', () => {
  afterEach(async () => { await act(async () => poruka.hide()); });
  const press = async (label: string) => { await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress()); };
  const pageRows = (): string[] => ['Izmeni uslove', 'Prijavi problem', 'Otkaži Dogovor', 'Prijavi ili blokiraj osobu'].filter(label => labels().includes(label));

  test('the overview has no menu: its four actions stand on the page, the calm ones before the two in red, and "Izmeni" is not repeated in the title of the terms', async () => {
    await render(base());
    expect(labels()).not.toContain('Više radnji'); expect(menuRows()).toHaveLength(0);
    expect(pageRows()).toEqual(['Izmeni uslove', 'Prijavi problem', 'Otkaži Dogovor', 'Prijavi ili blokiraj osobu']);
    expect(labels().filter(label => label === 'Izmeni uslove')).toHaveLength(1); expect(labels()).not.toContain('Izmeni');
    const redWords = tree.root.findAll(node => String(node.type) === 'T' && node.props.tone === 'danger').map(node => node.children.join(''));
    expect(redWords).toEqual(['Otkaži Dogovor', 'Prijavi ili blokiraj osobu']);
  });

  test('is shorter where less can be done: no change or cancel for the requester once the work is reported done, only the safety row on a Dogovor that is over', async () => {
    await render(base(physical, 'uskocer'));
    expect(pageRows()).toEqual(['Izmeni uslove', 'Prijavi problem', 'Otkaži Dogovor', 'Prijavi ili blokiraj osobu']);
    await act(async () => tree.unmount());
    await render(base({ ...physical, stanje: 'AWAITING_REQUESTER' }));
    expect(pageRows()).toEqual(['Prijavi problem', 'Prijavi ili blokiraj osobu']);
    await act(async () => tree.unmount());
    await render(base({ stanje: 'COMPLETED' }));
    expect(pageRows()).toEqual(['Prijavi ili blokiraj osobu']);
  });

  test('"Izmeni uslove" and "Otkaži Dogovor" open the form they name, each from its row; the hub is only for answering a proposal', async () => {
    await render(base());
    await press('Izmeni uslove');
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/dogovor/[id]/izmene', params: { id: mockAgreementId, start: 'propose' } });
    await press('Otkaži Dogovor');
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/dogovor/[id]/izmene', params: { id: mockAgreementId, start: 'cancel' } });
    expect(mockRouter.push).toHaveBeenCalledTimes(2);
  });

  test('"Prijavi ili blokiraj osobu" opens the safety screen for this person and this Dogovor', async () => {
    await render(base());
    await press('Prijavi ili blokiraj osobu');
    expect(mockRouter.navigate).toHaveBeenLastCalledWith({ pathname: '/bezbednost', params: { targetAccountId: mockOther, agreementId: mockAgreementId } });
  });

  test('"Prijavi problem" opens the form for it in place of its row and sends nothing; an open problem takes the row away', async () => {
    const { agreementProblemService } = require('../agreementClientService');
    await render(base());
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Opiši problem' })).toHaveLength(0);
    await press('Prijavi problem');
    expect(tree.root.findByProps({ accessibilityLabel: 'Opiši problem' })).toBeTruthy();
    expect(labels()).not.toContain('Prijavi problem');
    // The form stands between the calm action and the red ones.
    const order = presses().map(node => node.props.accessibilityLabel);
    expect(order.indexOf('Izmeni uslove')).toBeLessThan(order.indexOf('Pošalji prijavu problema'));
    expect(order.indexOf('Pošalji prijavu problema')).toBeLessThan(order.indexOf('Otkaži Dogovor'));
    expect(agreementProblemService.submit).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
    agreementProblemService.read.mockResolvedValue({ ok: true, podatak: { agreementId: mockAgreementId, agreementVersion: 1, state: 'ABSENT', report: null } });
    await render(base({ problemOtvoren: true }));
    expect(labels()).not.toContain('Prijavi problem');
    // While the ways on after a problem stand, "Otkaži Dogovor" is theirs alone: one place for one action.
    expect(labels().filter(label => label === 'Otkaži Dogovor')).toHaveLength(1);
    expect(texts()).toContain('Šta dalje');
  });

  describe('the conversation\'s "···" (T3c): the same entries, one tap from Poruke', () => {
    beforeEach(() => { mockParams = { id: mockAgreementId, tab: 'poruke' }; });

    test('lists the rare actions in the plan\'s order, the two that end something last and in the danger colour', async () => {
      await render(base(physical));
      await openMenu();
      expect(menuLabels()).toEqual(['Izmeni uslove', 'Podeli svoj broj', 'Podeli lokaciju', 'Prijavi problem', 'Otkaži Dogovor', 'Prijavi ili blokiraj osobu']);
      const ink = (row: ReactTestInstance) => (StyleSheet.flatten(row.findByType('T' as any).props.style) as { color?: string } | undefined)?.color;
      expect(menuRows().map(ink)).toEqual([sys.color.ink, sys.color.ink, sys.color.ink, sys.color.ink, sys.color.danger, sys.color.danger]);
    });

    test('is shorter where less can be done: no location for the worker, no change or cancel for the requester once the work is reported done', async () => {
      await render(base(physical, 'uskocer'));
      await openMenu();
      expect(menuLabels()).toEqual(['Izmeni uslove', 'Podeli svoj broj', 'Prijavi problem', 'Otkaži Dogovor', 'Prijavi ili blokiraj osobu']);
      await act(async () => tree.unmount());
      await render(base({ ...physical, stanje: 'AWAITING_REQUESTER' }));
      await openMenu();
      expect(menuLabels()).toEqual(['Podeli svoj broj', 'Podeli lokaciju', 'Prijavi problem', 'Prijavi ili blokiraj osobu']);
    });

    test('is only the safety entry on a finished Dogovor, and the number entry reads for what it will do', async () => {
      await render(base({ stanje: 'COMPLETED' }));
      await openMenu();
      expect(menuLabels()).toEqual(['Prijavi ili blokiraj osobu']);
      await act(async () => tree.unmount());
      await render(base({ kontakt: { mojTelefonPodeljen: true, njihovTelefon: null, lokacijaPostoji: false } }));
      await openMenu();
      expect(menuLabels()).toContain('Opozovi deljenje broja'); expect(menuLabels()).not.toContain('Podeli svoj broj');
    });

    test('has no menu at all for a Dogovor that does not name the other side and offers nothing', async () => {
      const lone = base({ stanje: 'COMPLETED' }) as { ucesnici: { viSte: boolean }[] };
      await render({ ...lone, ucesnici: lone.ucesnici.filter(person => person.viSte) });
      expect(labels()).not.toContain('Više radnji');
    });

    test('"Izmeni uslove" and "Otkaži Dogovor" open the form they name, exactly as the rows of the overview do', async () => {
      await render(base());
      await chooseRow('Izmeni uslove');
      expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/dogovor/[id]/izmene', params: { id: mockAgreementId, start: 'propose' } });
      await chooseRow('Otkaži Dogovor');
      expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/dogovor/[id]/izmene', params: { id: mockAgreementId, start: 'cancel' } });
    });

    test('"Prijavi ili blokiraj osobu" goes where the overview\'s own row goes', async () => {
      await render(base());
      await chooseRow('Prijavi ili blokiraj osobu');
      expect(mockRouter.navigate).toHaveBeenLastCalledWith({ pathname: '/bezbednost', params: { targetAccountId: mockOther, agreementId: mockAgreementId } });
    });

    test('"Prijavi problem" takes the person to the overview, opens the form for it there and sends nothing; an open problem takes the entry away', async () => {
      const { agreementProblemService } = require('../agreementClientService');
      await render(base());
      expect(tree.root.findAllByProps({ accessibilityLabel: 'Opiši problem' })).toHaveLength(0);
      await chooseRow('Prijavi problem');
      expect(tree.root.findByProps({ accessibilityLabel: 'Opiši problem' })).toBeTruthy();
      expect(agreementProblemService.submit).not.toHaveBeenCalled();
      await act(async () => tree.unmount());
      agreementProblemService.read.mockResolvedValue({ ok: true, podatak: { agreementId: mockAgreementId, agreementVersion: 1, state: 'ABSENT', report: null } });
      await render(base({ problemOtvoren: true }));
      await openMenu();
      expect(menuLabels()).not.toContain('Prijavi problem');
    });

    test('"Podeli lokaciju" takes the requester to the section where the share state is read, and sends nothing', async () => {
      await render(base(physical));
      await chooseRow('Podeli lokaciju');
      expect(labels()).toContain('Osveži dozvolu za lokaciju');
      expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });
});

describe('sharing the number asks nothing and says what happened once the server has confirmed it', () => {
  afterEach(async () => { await act(async () => poruka.hide()); });
  const shared = (flag: boolean) => base({ kontakt: { mojTelefonPodeljen: flag, njihovTelefon: null, lokacijaPostoji: false } });

  test('the section\'s row shares it, the bar says so with "Vrati", and "Vrati" withdraws it and says that, without another "Vrati"', async () => {
    mockSource.podeliTelefon.mockResolvedValue({ ok: true, podatak: null }); mockSource.opoziviTelefon.mockResolvedValue({ ok: true, podatak: null });
    await render(base());
    mockRead.mockResolvedValue(shared(true));
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Podeli svoj broj' }).props.onPress());
    expect(mockSource.podeliTelefon).toHaveBeenCalledWith(mockAgreementId);
    expect(poruka.current()).toMatchObject({ text: 'Broj je podeljen. Marko ga sada vidi.', confirmed: true, action: { label: 'Vrati' } });
    expect(labels()).toContain('Opozovi deljenje broja');
    mockRead.mockResolvedValue(shared(false));
    await act(async () => tree.root.findByProps({ testID: 'poruka-action' }).props.onPress());
    expect(mockSource.opoziviTelefon).toHaveBeenCalledWith(mockAgreementId);
    expect(poruka.current()).toMatchObject({ text: 'Deljenje broja je opozvano.', confirmed: true });
    expect(poruka.current()?.action).toBeUndefined();
    expect(labels()).toContain('Podeli svoj broj');
  });

  test('the row says what it does by its title and states the fact when the number is shared; no sentence explains the sharing on the page', async () => {
    await render(base());
    expect(texts()).not.toContain('Deljenje je odvojeno u oba smera');
    expect(tree.root.findByProps({ accessibilityLabel: 'Podeli svoj broj' }).props.accessibilityHint).toBe('Deljenje je odvojeno u oba smera: druga strana ne deli automatski svoj broj.');
    await act(async () => tree.unmount());
    await render(shared(true));
    expect(texts()).toContain('Druga strana vidi tvoj broj.');
  });

  test('the section\'s own button does the same thing, and withdrawing says it and offers "Vrati" too', async () => {
    mockSource.opoziviTelefon.mockResolvedValue({ ok: true, podatak: null }); mockSource.podeliTelefon.mockResolvedValue({ ok: true, podatak: null });
    await render(shared(true));
    mockRead.mockResolvedValue(shared(false));
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Opozovi deljenje broja' }).props.onPress());
    expect(mockSource.opoziviTelefon).toHaveBeenCalledTimes(1);
    expect(poruka.current()).toMatchObject({ text: 'Deljenje broja je opozvano.', action: { label: 'Vrati' } });
    mockRead.mockResolvedValue(shared(true));
    await act(async () => tree.root.findByProps({ testID: 'poruka-action' }).props.onPress());
    expect(mockSource.podeliTelefon).toHaveBeenCalledWith(mockAgreementId);
  });

  test('the conversation\'s menu shares it too, with the same command', async () => {
    mockSource.podeliTelefon.mockResolvedValue({ ok: true, podatak: null });
    mockParams = { id: mockAgreementId, tab: 'poruke' };
    await render(base());
    mockRead.mockResolvedValue(shared(true));
    await chooseRow('Podeli svoj broj');
    expect(mockSource.podeliTelefon).toHaveBeenCalledWith(mockAgreementId);
  });

  test('a refused command shows no success bar, and says the refusal in the app\'s own words', async () => {
    mockSource.podeliTelefon.mockResolvedValue({ ok: false, kod: 'NOPE', poruka: 'adapter text' });
    await render(base());
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Podeli svoj broj' }).props.onPress());
    expect(poruka.current()).toBeNull();
    expect(texts()).toContain('Ne znamo da li je promena sačuvana');
    expect(texts()).not.toContain('adapter text');
  });

  test('the outcome bar is drawn by this screen\'s own host, since the screen covers the navigator that has the other one', async () => {
    mockSource.podeliTelefon.mockResolvedValue({ ok: true, podatak: null });
    await render(base());
    mockRead.mockResolvedValue(shared(true));
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Podeli svoj broj' }).props.onPress());
    expect(tree.root.findAllByProps({ testID: 'poruka-action' }).length).toBeGreaterThan(0);
  });
});

// The coordinator, 8 Oct 2026: on the Dogovor one sentence or nothing, and how it goes - "Zadatak je gotov", the confirmation, the rating - one tap away, behind an "ⓘ".
describe('how a Dogovor goes is behind an "ⓘ" at its head, for a side of a Dogovor that is still open', () => {
  const goes = () => tree.root.findAllByType(InfoButton).filter(node => node.props.title === 'Kako ide Dogovor');
  test.each([
    ['the worker, the work agreed', () => base({}, 'uskocer'), true],
    ['the requester, the work agreed', () => base(), false],
    ['the worker, waiting for the confirmation', () => base({ stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z' }, 'uskocer'), true],
    ['the requester, the confirmation theirs', () => base({ stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z' }), false],
  ])('%s: one ⓘ, in the words of its own side', async (_name, workspace, worker) => {
    await render(workspace());
    expect(goes()).toHaveLength(1);
    expect(labels()).toContain('Objašnjenje: Kako ide Dogovor');
    expect(goes()[0].props.lines[0]).toBe(worker ? 'Kad završiš zadatak, dodirni „Zadatak je gotov“.' : 'Osoba koja uskače javlja da je zadatak gotov.');
    // The page itself says at most the one sentence of the next step: none of the lines behind the ⓘ is on it.
    for (const line of goes()[0].props.lines as string[]) expect(texts()).not.toContain(line);
  });

  test.each(['COMPLETED', 'CANCELLED'])('a %s Dogovor has none: there is nothing left to explain', async stanje => {
    await render(base({ stanje }));
    expect(goes()).toHaveLength(0);
  });

  test('the worker is told on the page only which button ends the work, and the one who asked for it nothing at all', async () => {
    await render(base({}, 'uskocer'));
    expect(texts()).toContain('Kad završiš, dodirni „Zadatak je gotov“.');
    await act(async () => tree.unmount());
    await render(base());
    expect(texts()).not.toContain('dodirni „Zadatak je gotov“'); expect(quietLine()).toEqual(['Čeka da Marko javi da je zadatak gotov.']);
  });

  test('sharing the number has its ⓘ beside the title of the contact, and the row says only what it does', async () => {
    await render(base());
    expect(tree.root.findAllByType(InfoButton).map(node => node.props.title)).toContain('Kako se deli broj');
    expect(texts()).not.toContain('Kad podeliš svoj broj, druga strana ne deli automatski svoj.');
  });
});

describe('nothing but the action that waits is green', () => {
  const waits = { radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: true, izmenaNaCekanju: false, predlogIzmene: null } };
  const workerWaits = { radnje: { mozeOznacitiZavrsetak: true, mozePotvrditiZavrsetak: false, izmenaNaCekanju: false, predlogIzmene: null } };
  test.each([
    ['agreed, nothing allowed', base(), 0], ['the requester may confirm', base(waits), 1],
    ['the worker may report done', base(workerWaits, 'uskocer'), 1], ['a rating is due', base({ stanje: 'COMPLETED' }), 1], ['cancelled', base({ stanje: 'CANCELLED' }), 0],
  ] as const)('%s: %i green action(s)', async (_name, workspace, green) => {
    await render(workspace as never);
    expect(brand()).toHaveLength(green);
  });
});
