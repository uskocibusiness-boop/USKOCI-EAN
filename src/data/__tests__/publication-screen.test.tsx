import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const NEED = '22222222-3333-4444-8555-666666666666';
const ACCOUNT = '11111111-2222-4333-8444-555555555555';
const OTHER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const CONVERSATION = '55555555-6666-4777-8888-999999999999';
let mockId = NEED, mockIntent = 'narucilac', mockFocused = true;
let mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
const mockNeed = jest.fn(), mockSearch = jest.fn(), mockClose = jest.fn(), mockEdit = jest.fn();
const mockEvaluate = jest.fn(), mockPublish = jest.fn();
const mockSource = { potreba: (...args: unknown[]) => mockNeed(...args) };
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
const mockAppListeners = new Set<(state: string) => void>();
const mockAppState = { currentState: 'active', addEventListener: (_: string, fn: (state: string) => void) => {
  mockAppListeners.add(fn); return { remove: () => mockAppListeners.delete(fn) };
} };
// A fresh installation has no pending terminal command. Publication itself is
// exercised by v5-review-screen; this suite verifies the saved-Task bridge.
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined),
} }));
jest.mock('../../data', () => ({ aiNeedV2Izvor: { openEditConversation: (...args: unknown[]) => mockEdit(...args) } }));
jest.mock('../ru4Production', () => ({ ...jest.requireActual('../ru4Production'), ru4Production: {
  remainingSearchState: (...args: unknown[]) => mockSearch(...args), closeRemainingSearch: (...args: unknown[]) => mockClose(...args),
} }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected transport'); } }));
jest.mock('../publicationClientService', () => ({ ...jest.requireActual('../publicationClientService'), publicationClientService: {
  evaluate: (...args: unknown[]) => mockEvaluate(...args), publish: (...args: unknown[]) => mockPublish(...args),
} }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => ({ id: mockId }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]),
}));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent, useIzvor: () => mockSource }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return mockAppState;
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
// The questions of the task have their own reader and suite (owner, 2026-10-07: they are drawn on the task now). Here the reader is
// a value the test moves, to see what the screen does with it: which task it asks about, and where its presses go.
const mockQuestionsFor = jest.fn();
let mockQuestions: { state: unknown; retry: () => void } = { state: { phase: 'idle' }, retry: () => undefined };
jest.mock('../../ui/qa/useTaskQaInline', () => ({ useTaskQaInline: (...args: unknown[]) => { mockQuestionsFor(...args); return mockQuestions; } }));
import Review from '../../app/(app)/potrebe/[id]/pregled';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';
import { buildQaInline } from '../../ui/qa/taskQaInlineModel';

function need(revizija = 7, stanje = 'NACRT') {
  return { id: NEED, revizija, stanje, naslov: 'Pregledani Zadatak', opis: 'Opis', podrucjeTekst: 'Novi Sad',
    vremeTekst: 'Po dogovoru', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: [], brojPrijava: 0 };
}
const ok = (podatak: unknown) => ({ ok: true, podatak });
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Review />); }); };
const update = async () => { await act(async () => tree.update(<Review />)); };
const button = (label: string) => tree.root.findByProps({ label });
const press = (accessibilityLabel: string) => tree.root.findByProps({ accessibilityLabel });
const texts = () => tree.root.findAll(node => node.type === 'T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const tap = async (label: string) => { await act(async () => { await button(label).props.onPress(); }); };
// Owner step 5b (2026-09-24): changing the task (edit, closing the remaining search, cancel, delete) moved from buttons at
// the end of the screen into the bar's "···". A person opens the menu and picks the row; the row runs once the menu has
// gone and reaches the same guarded callback and the same confirmation the button did. A draft ALSO draws "Izmeni nacrt" and "Obriši nacrt" as
// visible rows (owner, 2026-10-07), so the row of the menu is the one that has the menu item's role.
const fromMenu = async (label: string) => {
  await act(async () => { press('Više radnji').props.onPress(); });
  await act(async () => { tree.root.findByProps({ accessibilityLabel: label, accessibilityRole: 'menuitem' }).props.onPress(); });
};
// The confirmations were Alert.alert and are an in-app ConfirmSheet now. `confirmation()` is its confirm button, pressed
// the way a person presses it; `retainedAnswer()` is the screen's own answer as the sheet holds it (the closure the Alert
// used to get), for a test that fires it after the screen has retired the question.
const sheet = () => tree.root.findByType(ConfirmSheet);
const sheets = () => tree.root.findAllByType(ConfirmSheet);
const confirmation = () => sheet().findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress;
const retainedAnswer = () => sheet().props.onConfirm;
const confirm = async () => { const action = confirmation(); await act(async () => { action(); }); };
const readback = async (label = 'Pokušaj ponovo') => { await act(async () => { await press(label).props.onPress(); }); };
async function appState(state: string) { await act(async () => { mockAppState.currentState = state;
  [...mockAppListeners].forEach(listener => listener(state)); }); }
beforeEach(() => {
  jest.clearAllMocks();
  for (const mock of [mockNeed, mockSearch, mockClose, mockEdit, mockEvaluate, mockPublish]) mock.mockReset();
  mockId = NEED; mockIntent = 'narucilac'; mockFocused = true; mockAppState.currentState = 'active'; mockAppListeners.clear();
  mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
  mockNeed.mockResolvedValue(need()); mockSearch.mockResolvedValue({ closed: false, closedAt: null });
  mockEdit.mockResolvedValue(ok({ needId: NEED, conversationId: CONVERSATION, revision: 7, needStatus: 'DRAFT', authoritative: true })); mockClose.mockResolvedValue(ok(null));
  mockQuestions = { state: { phase: 'idle' }, retry: () => undefined };
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });

describe('V5 saved Task enters the same single acceptance review', () => {
  it('opens the authoritative owned review without a provider call, publication or extra confirmation', async () => {
    await render(); expect(mockEdit).not.toHaveBeenCalled();
    await tap('Pregledaj za objavu');
    expect(mockEdit).toHaveBeenCalledWith(NEED);
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pregled-zadatka', params: { conversationId: CONVERSATION } });
    expect(mockEvaluate).not.toHaveBeenCalled(); expect(mockPublish).not.toHaveBeenCalled(); expect(sheets()).toHaveLength(0);
  });
  it('keeps manual conversation editing available without a separate draft confirmation', async () => {
    await render(); await fromMenu('Izmeni nacrt');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: CONVERSATION } });
    expect(sheets()).toHaveLength(0); expect(mockPublish).not.toHaveBeenCalled();
  });
  it('serializes retained double taps and navigates only after an exact server receipt', async () => {
    const pending = deferred(); mockEdit.mockReturnValueOnce(pending.promise); await render();
    const action = button('Pregledaj za objavu').props.onPress;
    await act(async () => { action(); action(); });
    expect(mockEdit).toHaveBeenCalledTimes(1); expect(mockRouter.push).not.toHaveBeenCalled();
    await act(async () => pending.resolve(ok({ needId: NEED, conversationId: CONVERSATION, revision: 7, needStatus: 'DRAFT', authoritative: true })));
    expect(mockRouter.push).toHaveBeenCalledTimes(1); expect(mockPublish).not.toHaveBeenCalled();
  });
  it.each([
    ['foreign Task', { needId: OTHER }], ['missing conversation', { conversationId: null }],
    ['invalid conversation', { conversationId: 'not-a-uuid' }], ['missing authority', { authoritative: false }],
    ['unsupported status', { needStatus: 'CANCELLED' }], ['invalid revision', { revision: 0 }],
  ])('rejects %s in a successful-looking open receipt', async (_, patch) => {
    mockEdit.mockResolvedValue(ok({ needId: NEED, conversationId: CONVERSATION, revision: 7, needStatus: 'DRAFT', authoritative: true, ...patch }));
    await render(); await tap('Pregledaj za objavu');
    expect(mockRouter.push).not.toHaveBeenCalled(); expect(texts()).toContain('Ne znamo da li se izmena otvorila'); expect(mockPublish).not.toHaveBeenCalled();
  });
  it.each([{ revision: 8 }, { needStatus: 'PUBLISHED' }])('requires a fresh read if Task revision or draft status changed: %j', async patch => {
    mockEdit.mockResolvedValue(ok({ needId: NEED, conversationId: CONVERSATION, revision: 7, needStatus: 'DRAFT', authoritative: true, ...patch }));
    await render(); await tap('Pregledaj za objavu');
    expect(mockRouter.push).not.toHaveBeenCalled(); expect(texts()).toContain('Zadatak se promenio');
  });
  it.each(['account before render', 'account incarnation', 'blur and return', 'background and return', 'route'])('retires a retained review callback after %s', async reason => {
    await render(); const retained = button('Pregledaj za objavu').props.onPress;
    if (reason === 'account before render') mockSession = { user: { id: OTHER }, accountRevision: 2 };
    else if (reason === 'account incarnation') mockSession = { user: { id: ACCOUNT }, accountRevision: 3 };
    else if (reason === 'blur and return') { mockFocused = false; await update(); mockFocused = true; await update(); }
    else if (reason === 'background and return') { await appState('background'); await appState('active'); }
    else { mockId = OTHER; mockNeed.mockResolvedValue({ ...need(), id: OTHER }); await update(); }
    await act(async () => retained()); expect(mockEdit).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
  });
  it.each(['account', 'blur', 'background'] as const)('ignores a late server-opened review after %s changes', async reason => {
    const pending = deferred(); mockEdit.mockReturnValueOnce(pending.promise); await render(); await tap('Pregledaj za objavu');
    if (reason === 'account') { mockSession = { user: { id: OTHER }, accountRevision: 2 }; await update(); }
    else if (reason === 'blur') { mockFocused = false; await update(); } else await appState('background');
    await act(async () => pending.resolve(ok({ needId: NEED, conversationId: CONVERSATION, revision: 7, needStatus: 'DRAFT', authoritative: true })));
    expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockPublish).not.toHaveBeenCalled();
  });
  it.each(['rejected', 'thrown'])('requires readback after an unknown open outcome: %s', async kind => {
    if (kind === 'rejected') mockEdit.mockResolvedValueOnce({ ok: false, kod: 'UNKNOWN', poruka: 'Otvaranje nije potvrđeno.' });
    else mockEdit.mockRejectedValueOnce(new Error('private SQL secret'));
    await render(); await tap('Pregledaj za objavu');
    expect(mockRouter.push).not.toHaveBeenCalled(); expect(texts()).not.toContain('private SQL');
    expect(tree.root.findAllByProps({ label: 'Pregledaj za objavu' })).toHaveLength(0);
    await readback('Osveži zadatak'); await tap('Pregledaj za objavu'); expect(mockEdit).toHaveBeenCalledTimes(2);
  });
  it.each(['Need', 'remaining search'] as const)('bounds a hanging %s read and retires its late result', async source => {
    jest.useFakeTimers(); const pending = deferred();
    if (source === 'Need') mockNeed.mockReturnValueOnce(pending.promise); else mockSearch.mockReturnValueOnce(pending.promise);
    await render(); await act(async () => { jest.advanceTimersByTime(15_000); });
    expect(texts()).toContain('Učitavanje traje predugo');
    mockNeed.mockResolvedValue({ ...need(8), naslov: 'Sveže učitani Zadatak' }); await readback();
    await act(async () => pending.resolve(source === 'Need' ? { ...need(), naslov: 'Zastareli Zadatak' } : { closed: true }));
    expect(texts()).toContain('Sveže učitani Zadatak'); expect(texts()).not.toContain('Zastareli Zadatak');
    mockEdit.mockResolvedValue(ok({ needId: NEED, conversationId: CONVERSATION, revision: 8, needStatus: 'DRAFT', authoritative: true }));
    await tap('Pregledaj za objavu'); expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });
  it('validates the route before reads, and offers the owner review to the owner whatever the app last was', async () => {
    // Owner decision 1 (2026-09-19). The review used to be withheld from an owner standing in the
    // other app mode. Ownership is settled by the owner-only read and by the server, not by a mode.
    mockId = 'invalid'; await render(); expect(mockNeed).not.toHaveBeenCalled();
    mockId = NEED; mockIntent = 'radnik'; await update();
    expect(tree.root.findAllByProps({ label: 'Pregledaj za objavu' })).toHaveLength(1);
  });
  it('preserves partial-search closure with one confirmed command and actual reread', async () => {
    mockNeed.mockResolvedValue({ ...need(7, 'DELIMICNO_POPUNJENA'), pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
    await render(); await fromMenu('Ne traži više nikoga'); expect(mockClose).not.toHaveBeenCalled(); mockSearch.mockResolvedValue({ closed: true });
    const action = confirmation(); await act(async () => { action(); action(); });
    expect(mockClose).toHaveBeenCalledTimes(1); expect(mockClose).toHaveBeenCalledWith(NEED, 7, expect.any(String)); expect(mockNeed).toHaveBeenCalledTimes(2);
  });
  it('the screen\'s own answer, fired twice in one tick, closes the search once: the screen\'s guards and the editor\'s write lock', async () => {
    // Pressing the sheet's confirm twice is stopped by the sheet itself. This calls the answer the screen handed the sheet
    // twice: the second call is refused by the screen's own guards (the token it retired, `canAct`) or by the editor's
    // write lock, whichever comes first. It does not single out the token; the next test does.
    mockNeed.mockResolvedValue({ ...need(7, 'DELIMICNO_POPUNJENA'), pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
    await render(); await fromMenu('Ne traži više nikoga'); mockSearch.mockResolvedValue({ closed: true });
    const answer = retainedAnswer(); await act(async () => { answer(); answer(); });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
  it('an answer kept after the question was cancelled closes nothing: the dialog token is the fence', async () => {
    // Round 2c (verifier vs, must 2): nothing else is in flight here (no editor write, no sheet latch on this closure), so
    // only the screen's dialog token can refuse it. It fails when `dialog.current !== confirmation ||` is removed.
    mockNeed.mockResolvedValue({ ...need(7, 'DELIMICNO_POPUNJENA'), pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
    // Reached through the "···" (owner step 5b), as the other tests here: this one came from round 2c alongside step 5b
    // and still pressed the retired button, so it failed on the integrated base. The fence it proves is unchanged.
    await render(); await fromMenu('Ne traži više nikoga'); mockSearch.mockResolvedValue({ closed: true });
    const answer = retainedAnswer();
    await act(async () => { sheet().findByProps({ testID: 'confirm-sheet-cancel' }).props.onPress(); });
    expect(sheets()).toHaveLength(0);
    await act(async () => { answer(); }); expect(mockClose).not.toHaveBeenCalled();
  });
  it('keeps the question open with a busy confirm while the search is being closed, and closes it once that settles', async () => {
    mockNeed.mockResolvedValue({ ...need(7, 'DELIMICNO_POPUNJENA'), pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
    const closing = deferred(); mockClose.mockReturnValueOnce(closing.promise);
    await render(); await fromMenu('Ne traži više nikoga'); mockSearch.mockResolvedValue({ closed: true }); await confirm();
    expect(mockClose).toHaveBeenCalledTimes(1); expect(sheets()).toHaveLength(1);
    expect(sheet().findByProps({ testID: 'confirm-sheet-confirm' }).props.accessibilityState).toEqual({ disabled: true, busy: true });
    await act(async () => closing.resolve(ok(null)));
    expect(sheets()).toHaveLength(0); expect(mockNeed).toHaveBeenCalledTimes(2);
  });
  it.each([
    ['NO_REMAINING_SEARCH', 'Sva mesta su već popunjena. Učitaj aktuelno stanje zadatka.'],
    ['STALE_REVIEW_REQUIRED', 'Zadatak je izmenjen. Pregledaj važeće uslove.'],
    ['ACCOUNT_CLOSING', 'Radnja je zaustavljena zbog postupka zatvaranja naloga. Osveži prikaz.'],
  ])('shows the answered remaining-search refusal on the real screen: %s', async (kod, poruka) => {
    mockNeed.mockResolvedValue({ ...need(7, 'DELIMICNO_POPUNJENA'), pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
    mockClose.mockResolvedValue({ ok: false, kod, poruka });
    await render(); await fromMenu('Ne traži više nikoga'); await confirm();
    expect(texts()).toContain(poruka); expect(texts()).not.toContain('Ne znamo da li je potraga zatvorena');
    expect(mockClose).toHaveBeenCalledTimes(1); expect(mockNeed).toHaveBeenCalledTimes(1);
  });
  it('cancelling a confirmation sends nothing, and the same question can be asked again', async () => {
    mockNeed.mockResolvedValue({ ...need(7, 'DELIMICNO_POPUNJENA'), pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
    await render(); await fromMenu('Ne traži više nikoga');
    // Closing the search cannot be undone, so its confirm is drawn as the destructive one (as izvoz's withdrawals are).
    expect(sheet().props).toMatchObject({ title: 'Ne traži više nikoga?', confirmLabel: 'Zatvori potragu', cancelLabel: 'Odustani', tone: 'danger' });
    await act(async () => { sheet().findByProps({ testID: 'confirm-sheet-cancel' }).props.onPress(); });
    expect(sheets()).toHaveLength(0); expect(mockClose).not.toHaveBeenCalled();
    // The cancel path released the screen's dialog token, so the question opens again and its answer runs once.
    mockSearch.mockResolvedValue({ closed: true }); await fromMenu('Ne traži više nikoga'); await confirm();
    expect(mockClose).toHaveBeenCalledTimes(1); expect(sheets()).toHaveLength(0);
  });
  it('keeps an unknown remaining-search result uncertain instead of echoing arbitrary text', async () => {
    mockNeed.mockResolvedValue({ ...need(7, 'DELIMICNO_POPUNJENA'), pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
    mockClose.mockResolvedValue({ ok: false, kod: 'UNRECOGNIZED', poruka: 'PRIVATE_SQL' });
    await render(); await fromMenu('Ne traži više nikoga'); await confirm();
    expect(texts()).toContain('Ne znamo da li je potraga zatvorena'); expect(texts()).not.toContain('PRIVATE_SQL');
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
  it.each(['edit', 'remaining search'] as const)('retires retained published %s confirmation on blur', async action => {
    mockNeed.mockResolvedValue(action === 'edit' ? need(7, 'OBJAVLJENA')
      : { ...need(7, 'DELIMICNO_POPUNJENA'), pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
    await render(); await fromMenu(action === 'edit' ? 'Izmeni zadatak' : 'Ne traži više nikoga');
    // Opening the edit can be walked back; closing the search cannot.
    expect(sheet().props.tone).toBe(action === 'edit' ? 'default' : 'danger');
    const retained = retainedAnswer(); mockFocused = false; await update(); expect(sheets()).toHaveLength(0);
    mockFocused = true; await update();
    await act(async () => retained()); expect(mockEdit).not.toHaveBeenCalled(); expect(mockClose).not.toHaveBeenCalled();
  });
});

describe('V2 saved Need presentation', () => {
  it('shows every authoritative requirement and every public location stop immediately, with no disclosure', async () => {
    mockNeed.mockResolvedValue({ ...need(), opis: 'Čćšžđ '.repeat(800), rezimCene: 'OFFERS', taskCountryCode: 'RS',
      vremeTekst: '10. sep 2026 · 18:00 – 10. sep 2026 · 19:00 (Europe/Belgrade)',
      schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-09-10T16:00:00Z', endsAt: '2026-09-10T17:00:00Z' },
      detalji: { kategorija: 'Prevoz', geografija: { mode: 'MULTI_STOP', start: { city: 'Novi Sad' },
        waypoints: [{ city: 'Beočin' }, { city: 'Petrovaradin' }], end: { city: 'Kamenica' } }, rezimLokacije: 'MULTI_STOP',
        zahtevi: { vestine: [], alati: ['Alat, jedan', 'Alat, jedan'], vozila: [], dozvole: ['B kategorija'],
          bitniUslovi: ['Bez lifta'], iskustvoGodina: 3, potvrdjenIdentitet: true } } });
    await render();
    // The category is not shown to people (owner decision 2026-09-21); the server reads it only to match.
    expect(texts()).not.toContain('Prevoz'); expect(texts()).toContain('Tražim ponude');
    expect(texts()).toContain('19:00'); expect(texts()).toContain('Čćšžđ '.repeat(800));
    for (const value of ['Alat, jedan', 'B kategorija', 'Bez lifta', '3 god.', 'Potreban je potvrđen identitet']) expect(texts()).toContain(value);
    // Recomposed from zero (2026-09-23): the route's public stops are part of the one place section, not behind a
    // "Mesto izvršenja" row that repeated the place a third time.
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Mesto izvršenja')).toHaveLength(0);
    // One line in the order of the trip, each stop's role heard rather than printed.
    expect(texts()).toContain('Novi Sad  →  Beočin  →  Petrovaradin  →  Kamenica'); expect(texts()).toContain('Više stanica · Srbija');
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Više stanica: Polazište Novi Sad, Stanica 1 Beočin, Stanica 2 Petrovaradin, Odredište Kamenica, Srbija')).not.toHaveLength(0);
    // A list reads as chips under its label, each item once per stored value, never a bullet under a bullet (2026-09-23).
    expect(texts()).not.toContain('•');
    // The place and the requirements are both visible at once.
    expect(texts()).toContain('Petrovaradin');
    for (const value of ['Alat, jedan', 'B kategorija', 'Bez lifta', '3 god.', 'Potreban je potvrđen identitet']) expect(texts()).toContain(value);
    expect(mockEvaluate).not.toHaveBeenCalled(); expect(mockPublish).not.toHaveBeenCalled();
    expect(texts()).not.toContain('Revizija 7');
  });
  it('keeps one primary review action outside the scroll with bottom safe area', async () => {
    await render(); const action = button('Pregledaj za objavu');
    let parent = action.parent;
    while (parent) { expect(parent.type).not.toBe('ScrollView'); parent = parent.parent; }
    expect(tree.root.findByType('SafeAreaView' as React.ElementType).props.edges).toEqual(['top', 'bottom', 'left', 'right']);
    expect(tree.root.findAllByProps({ label: 'Pregledaj za objavu' })).toHaveLength(1);
    expect(tree.root.findAllByProps({ label: 'Pregledaj prijave' })).toHaveLength(0);
    expect(texts()).not.toContain('HITNO');
    // A draft is private and nobody can have asked about it: no questions section, and nothing is read for it.
    expect(texts()).not.toContain('Pitanja i odgovori'); expect(mockQuestionsFor).toHaveBeenLastCalledWith(null, 7);
  });
  it('does not display a raw transport secret attached outside the public projection', async () => {
    mockNeed.mockResolvedValue({ ...need(), need_sensitive: { exact_address: 'SECRET address', exact_lat: 45.123456 }, resolved_location: 'SECRET pin' });
    await render();
    expect(texts()).not.toMatch(/SECRET|45.123456/);
    // Without a stored public structure the place is the approximate area the facts already name; nothing else is drawn.
    expect(texts()).toContain('Novi Sad');
  });
  it('provides the real candidates route after publication and no duplicate publication action', async () => {
    mockNeed.mockResolvedValue({ ...need(7, 'OBJAVLJENA'), brojPrijava: 3 }); await render();
    expect(tree.root.findAllByProps({ label: 'Objavi Zadatak' })).toHaveLength(0);
    // The read carries no selectable count here, so the page counts the total and says that it is the total: "Pogledaj", never
    // "Uporedi", and no number is drawn on the button.
    expect(texts()).toContain('Imaš 3 prijave. Pogledaj ih.');
    expect(button('Pogledaj prijave').props.count).toBeUndefined();
    expect(tree.root.findAll(node => node.type === 'Press' as React.ElementType
      && node.props.accessibilityLabel === 'Pogledaj prijave, ukupno 3 prijave')).toHaveLength(1);
    await tap('Pogledaj prijave');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/kandidati', params: { id: NEED } });
  });
  // Owner, 2026-10-07: "u pregledu zadatka treba da se vidi pitanja koja je neko postavio, a na koja je odgovorio vlasnik zadatka".
  // The questions were a link at the end of the overview; they are drawn on it now, and the whole thread (answering, the rest) is
  // still the screen it always was, opened by the same route with the same identity.
  const question = (n: number, patch: Record<string, unknown> = {}) => ({ questionId: `00000000-0000-4000-8000-00000000000${n}`, needRevision: 7,
    questionText: `Pitanje ${n}?`, status: 'PENDING_ANSWER', createdAt: '2026-10-04T08:00:00Z', answerVersion: null, answerText: null, edited: false, ...patch });
  const ownerSees = (rows: unknown[]) => ({ retry: jest.fn(), state: { phase: 'ready',
    ...buildQaInline({ mode: 'OWNER', needRevision: 7, canAsk: false, canComposeAnswer: true }, rows as never[]) } });
  const pressHost = (accessibilityLabel: string) => tree.root.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === accessibilityLabel);
  it('reads the questions of a published task on the overview, for this task and this version, and none for a draft', async () => {
    mockNeed.mockResolvedValue(need(7, 'OBJAVLJENA'));
    mockQuestions = ownerSees([question(1, { status: 'ANSWERED_PUBLIC', answerVersion: 1, answerText: 'Nema lifta.' }), question(2)]);
    await render();
    expect(mockQuestionsFor).toHaveBeenLastCalledWith(NEED, 7);
    const all = texts();
    expect(all).toContain('Pitanja i odgovori'); expect(all).toContain('2 pitanja · 1 odgovoreno');
    expect(all).toContain('Pitanje 2?'); expect(all).toContain('Čeka odgovor'); expect(all).toContain('Tvoj odgovor'); expect(all).toContain('Nema lifta.');
    // The waiting question comes first, and the section sits with the work, before the place.
    expect(all.indexOf('Pitanje 2?')).toBeLessThan(all.indexOf('Pitanje 1?'));
    expect(all.indexOf('Opis')).toBeLessThan(all.indexOf('Pitanja i odgovori'));
  });
  it('answering a waiting question opens the whole thread of this task once, with whose task it is', async () => {
    mockNeed.mockResolvedValue(need(7, 'OBJAVLJENA')); mockQuestions = ownerSees([question(1)]);
    await render();
    const answer = pressHost('Odgovori na pitanje: Pitanje 1?')[0].props.onPress;
    await act(async () => { answer(); answer(); });
    expect(mockRouter.push.mock.calls).toEqual([[{ pathname: '/pitanja-zadatka', params: { needId: NEED, own: '1' } }]]);
    expect(mockPublish).not.toHaveBeenCalled();
  });
  it('opens Task-scoped questions with the loaded identity and rejects a callback after blur', async () => {
    mockNeed.mockResolvedValue(need(7, 'OBJAVLJENA')); mockQuestions = ownerSees([1, 2, 3, 4].map(n => question(n)));
    await render(); const retained = press('Prikaži sva pitanja (4)').props.onPress;
    mockFocused = false; await update(); mockFocused = true; await update();
    await act(async () => retained()); expect(mockRouter.push).not.toHaveBeenCalled();
    await act(async () => press('Prikaži sva pitanja (4)').props.onPress());
    // The link says these are the questions of my own task, so the way back needs no app mode.
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pitanja-zadatka', params: { needId: NEED, own: '1' } });
    expect(mockPublish).not.toHaveBeenCalled();
  });
  it('a questions read that failed is said on the section and reads again on request; the overview itself still works', async () => {
    const retry = jest.fn();
    mockNeed.mockResolvedValue(need(7, 'OBJAVLJENA')); mockQuestions = { retry, state: { phase: 'error', message: 'Pitanja trenutno nisu učitana.' } };
    await render();
    expect(texts()).toContain('Pitanja trenutno nisu učitana.'); expect(texts()).not.toContain('Još nema pitanja');
    await tap('Učitaj pitanja ponovo');
    expect(retry).toHaveBeenCalledTimes(1); expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockNeed).toHaveBeenCalledTimes(1);
  });
  it('while an action runs on the overview the section cannot open the thread, and can again once it has settled', async () => {
    mockNeed.mockResolvedValue({ ...need(7, 'DELIMICNO_POPUNJENA'), pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
    mockQuestions = ownerSees([1, 2, 3, 4].map(n => question(n)));
    const closing = deferred(); mockClose.mockReturnValueOnce(closing.promise);
    await render();
    expect(pressHost('Prikaži sva pitanja (4)')[0].props.disabled).toBe(false);
    await fromMenu('Ne traži više nikoga'); mockSearch.mockResolvedValue({ closed: true }); await confirm();
    expect(pressHost('Prikaži sva pitanja (4)')[0].props.disabled).toBe(true);
    const kept = pressHost('Prikaži sva pitanja (4)')[0].props.onPress;
    await act(async () => kept()); expect(mockRouter.push).not.toHaveBeenCalled();
    await act(async () => closing.resolve(ok(null)));
    expect(pressHost('Prikaži sva pitanja (4)')[0].props.disabled).toBe(false);
  });
  // Opened from a notification on a cold start, the arrow used to call back() into an empty stack and do nothing.
  it('the arrow with no screen behind it lands on the owner\'s tasks; with one, it goes back', async () => {
    await render(); const arrow = () => tree.root.findAll(node => node.props?.accessibilityLabel === 'Nazad')[0].props.onPress;
    mockRouter.canGoBack.mockReturnValueOnce(false); await act(async () => arrow()());
    expect(mockRouter.back).not.toHaveBeenCalled(); expect(mockRouter.replace).toHaveBeenCalledWith('/potrebe');
    await act(async () => tree.unmount()); await render(); await act(async () => arrow()());
    expect(mockRouter.back).toHaveBeenCalledTimes(1); expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });
});
