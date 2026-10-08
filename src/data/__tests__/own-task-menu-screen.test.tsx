import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const NEED = '22222222-3333-4444-8555-666666666666';
const ACCOUNT = '11111111-2222-4333-8444-555555555555';
const CONVERSATION = '55555555-6666-4777-8888-999999999999';
let mockFocused = true;
const mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
const mockNeed = jest.fn(), mockSearch = jest.fn(), mockClose = jest.fn(), mockEdit = jest.fn(), mockMine = jest.fn();
const mockLifecycle = { cancelNeed: jest.fn(), deleteDraftNeed: jest.fn(), readCommandReceipt: jest.fn() };
const mockStored = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
const mockSource = { potreba: (...args: unknown[]) => mockNeed(...args), mojePotrebe: (...args: unknown[]) => mockMine(...args) };
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
const mockAppState = { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) };
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: (...args: unknown[]) => mockStored.getItem(...args), setItem: (...args: unknown[]) => mockStored.setItem(...args),
  removeItem: (...args: unknown[]) => mockStored.removeItem(...args),
} }));
jest.mock('../../data', () => ({ aiNeedV2Izvor: { openEditConversation: (...args: unknown[]) => mockEdit(...args) } }));
jest.mock('../ru4Production', () => ({ ...jest.requireActual('../ru4Production'), ru4Production: {
  remainingSearchState: (...args: unknown[]) => mockSearch(...args), closeRemainingSearch: (...args: unknown[]) => mockClose(...args),
} }));
jest.mock('../needLifecycleClientService', () => ({ ...jest.requireActual('../needLifecycleClientService'), needLifecycleClientService: {
  cancelNeed: (...args: unknown[]) => mockLifecycle.cancelNeed(...args), deleteDraftNeed: (...args: unknown[]) => mockLifecycle.deleteDraftNeed(...args),
  readCommandReceipt: (...args: unknown[]) => mockLifecycle.readCommandReceipt(...args),
} }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected transport'); } }));
jest.mock('../publicationClientService', () => ({ ...jest.requireActual('../publicationClientService'), publicationClientService: {
  evaluate: jest.fn(), publish: jest.fn(),
} }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => ({ id: NEED }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]),
}));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useUloga: () => 'narucilac', ulogaSada: () => 'narucilac', useIzvor: () => mockSource }));
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
// The questions of the task have their own reader and suite (owner, 2026-10-07); this suite is about the "···" of the task.
jest.mock('../../ui/qa/useTaskQaInline', () => ({ useTaskQaInline: () => ({ state: { phase: 'idle' }, retry: () => undefined }) }));
import Review from '../../app/(app)/potrebe/[id]/pregled';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';
import { sys } from '../../ui/system/tokens';

/**
 * My own task through the real screen (owner step 5b, 2026-09-24): every change of the task sits behind the bar's "···",
 * and every row reaches the confirmation it always had: the edit its "Izmena Zadatka", closing the search its
 * "Ne traži više nikoga?", cancel and delete the lifecycle's own review; the Dogovori open as before. What happened to a
 * sent command is said on the screen. Nothing is sent before a confirm.
 */
const need = (stanje = 'OBJAVLJENA', patch: Record<string, unknown> = {}) => ({ id: NEED, revizija: 7, stanje, naslov: 'Pregledani Zadatak',
  opis: 'Opis', podrucjeTekst: 'Novi Sad', vremeTekst: 'Po dogovoru', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: [],
  brojPrijava: 0, ...patch });
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Review />); }); };
const press = (accessibilityLabel: string) => tree.root.findByProps({ accessibilityLabel });
const texts = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const rows = () => tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityRole === 'menuitem');
const openMenu = async () => { await act(async () => { press('Više radnji').props.onPress(); }); };
const choose = async (label: string) => { await openMenu(); await act(async () => { rows().find(row => row.props.accessibilityLabel === label)!.props.onPress(); }); };
const sheets = () => tree.root.findAllByType(ConfirmSheet);
const inSheet = (testID: string) => act(async () => { sheets()[0].findByProps({ testID }).props.onPress(); });
beforeEach(() => {
  jest.clearAllMocks(); mockFocused = true;
  for (const mock of [mockNeed, mockSearch, mockClose, mockEdit, mockMine, ...Object.values(mockLifecycle), ...Object.values(mockStored)]) mock.mockReset();
  mockNeed.mockResolvedValue(need()); mockSearch.mockResolvedValue({ closed: false, closedAt: null }); mockMine.mockResolvedValue([]);
  mockEdit.mockResolvedValue({ ok: true, podatak: { needId: NEED, conversationId: CONVERSATION, revision: 7, needStatus: 'PUBLISHED', authoritative: true } });
  mockStored.getItem.mockResolvedValue(null); mockStored.setItem.mockResolvedValue(undefined); mockStored.removeItem.mockResolvedValue(undefined);
  mockLifecycle.cancelNeed.mockResolvedValue({ ok: true, podatak: { needId: NEED, revision: 7, status: 'CANCELLED', affectedResponses: 0, idempotentReplay: false } });
  mockLifecycle.deleteDraftNeed.mockResolvedValue({ ok: true, podatak: { needId: NEED, revision: 7, deleted: true, idempotentReplay: false } });
  mockLifecycle.readCommandReceipt.mockResolvedValue({ ok: true, podatak: { state: 'NOT_CONFIRMED' } });
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('a published task: the edit reaches "Izmena Zadatka", the cancel its own review, and the outcome is said on the screen', async () => {
  await render();
  expect(texts()).not.toContain('Upravljanje zadatkom');
  await openMenu();
  expect(rows().map(row => row.props.accessibilityLabel)).toEqual(['Izmeni zadatak', 'HITNO', 'Otkaži zadatak']);
  await act(async () => { rows()[0].props.onPress(); });
  expect(sheets()[0].props).toMatchObject({ title: 'Izmena zadatka', tone: 'default' });
  await inSheet('confirm-sheet-cancel'); expect(mockEdit).not.toHaveBeenCalled();
  await choose('Otkaži zadatak');
  expect(sheets()).toHaveLength(1);
  expect(sheets()[0].props).toMatchObject({ title: 'Otkaži zadatak?', confirmLabel: 'Otkaži zadatak', tone: 'danger' });
  // While the question is open the screen is busy: the one action says so and the "···" cannot be opened again.
  expect(press('Više radnji').props.disabled).toBe(true);
  expect(mockLifecycle.cancelNeed).not.toHaveBeenCalled();
  await inSheet('confirm-sheet-confirm');
  expect(mockStored.setItem).toHaveBeenCalledTimes(1); expect(mockLifecycle.cancelNeed.mock.calls).toEqual([[NEED, 7, '']]);
  expect(sheets()).toHaveLength(0);
  // The outcome in plain words since the review of step 5b (no "server" wording).
  expect(texts()).toContain('Zadatak je otkazan.');
  await act(async () => { tree.root.findByProps({ label: 'Moji zadaci' }).props.onPress(); });
  expect(mockRouter.replace).toHaveBeenCalledWith('/potrebe');
});

it('a draft: the edit opens the conversation directly, delete asks with its own words, and "Odustani" sends nothing', async () => {
  mockNeed.mockResolvedValue(need('NACRT'));
  mockEdit.mockResolvedValue({ ok: true, podatak: { needId: NEED, conversationId: CONVERSATION, revision: 7, needStatus: 'DRAFT', authoritative: true } });
  await render();
  await openMenu();
  // A draft offers ONLY the deletion (plan 2.3): it was never published, so "Otkaži zadatak" beside "Obriši nacrt" asked a person to choose
  // between ending the same unpublished thing two ways. The deletion is last and drawn in the danger colour.
  expect(rows().map(row => row.props.accessibilityLabel)).toEqual(['Izmeni nacrt', 'Obriši nacrt']);
  for (const row of rows().slice(1)) expect(StyleSheet.flatten(row.findByType('T' as React.ElementType).props.style).color).toBe(sys.color.danger);
  await act(async () => { rows()[1].props.onPress(); });
  expect(sheets()[0].props).toMatchObject({ title: 'Obriši nacrt?', confirmLabel: 'Obriši nacrt', tone: 'danger' });
  await inSheet('confirm-sheet-cancel');
  expect(sheets()).toHaveLength(0); expect(mockStored.setItem).not.toHaveBeenCalled(); expect(mockLifecycle.deleteDraftNeed).not.toHaveBeenCalled();
  // The screen is free again: its one action is back and the menu opens.
  expect(tree.root.findAllByProps({ label: 'Pregledaj za objavu' })).toHaveLength(1);
  expect(press('Više radnji').props.disabled).toBe(false);
  await choose('Izmeni nacrt');
  expect(sheets()).toHaveLength(0);
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: CONVERSATION } });
});

it('a partly agreed task: closing the search reaches its question, and the Dogovori open as they did', async () => {
  mockNeed.mockResolvedValue(need('DELIMICNO_POPUNJENA', { pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } }));
  await render();
  await openMenu();
  expect(rows().map(row => row.props.accessibilityLabel)).toEqual(['HITNO', 'Otvori moje Dogovore', 'Ne traži više nikoga']);
  // Why there is no "Otkaži zadatak" is said where it is seen, under the Dogovori row (review of step 5b), not only heard.
  const agreementsRow = rows().find(row => row.props.accessibilityLabel === 'Otvori moje Dogovore')!;
  expect(agreementsRow.findAll(node => node.type === ('T' as React.ElementType)).map(node => node.props.children))
    .toEqual(['Otvori moje Dogovore', 'Postojeći Dogovori se otkazuju zasebno.']);
  expect(agreementsRow.props.accessibilityHint).toBe('Postojeći Dogovori se otkazuju zasebno.');
  await act(async () => { rows().find(row => row.props.accessibilityLabel === 'Ne traži više nikoga')!.props.onPress(); });
  expect(sheets()[0].props).toMatchObject({ title: 'Ne traži više nikoga?', confirmLabel: 'Zatvori potragu', tone: 'danger' });
  await inSheet('confirm-sheet-cancel'); expect(mockClose).not.toHaveBeenCalled();
  await choose('Otvori moje Dogovore');
  expect(mockRouter.push).toHaveBeenCalledWith('/dogovori');
  expect(mockLifecycle.cancelNeed).not.toHaveBeenCalled();
});

it('an uncertain cancel keeps its recovery on the screen under the title, with no sheet left open', async () => {
  mockLifecycle.cancelNeed.mockResolvedValue({ ok: false, kod: 'UNKNOWN_OUTCOME', poruka: 'Ishod nije potvrđen.' });
  await render(); await choose('Otkaži zadatak'); await inSheet('confirm-sheet-confirm');
  expect(sheets()).toHaveLength(0);
  expect(tree.root.findAllByProps({ label: 'Proveri da li je uspelo' })).toHaveLength(1);
  expect(tree.root.findAllByProps({ label: 'Pošalji ponovo' })).toHaveLength(1);
  const all = texts();
  expect(all.lastIndexOf('Pregledani Zadatak')).toBeLessThan(all.indexOf('Ponovno slanje je dostupno tek posle uspešne provere.'));
  expect(all.indexOf('Ponovno slanje je dostupno tek posle uspešne provere.')).toBeLessThan(all.indexOf('Po dogovoru'));
});
