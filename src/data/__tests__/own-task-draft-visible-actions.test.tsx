import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

const NEED = '22222222-3333-4444-8555-666666666666';
const ACCOUNT = '11111111-2222-4333-8444-555555555555';
const CONVERSATION = '55555555-6666-4777-8888-999999999999';
let mockFocused = true;
const mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
const mockNeed = jest.fn(), mockSearch = jest.fn(), mockEdit = jest.fn(), mockMine = jest.fn(), mockReadiness = jest.fn();
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
  remainingSearchState: (...args: unknown[]) => mockSearch(...args), closeRemainingSearch: jest.fn(),
} }));
jest.mock('../needPublicationReadiness', () => ({ ...jest.requireActual('../needPublicationReadiness'),
  needPublicationReadiness: { read: (...args: unknown[]) => mockReadiness(...args) } }));
jest.mock('../needLifecycleClientService', () => ({ ...jest.requireActual('../needLifecycleClientService'), needLifecycleClientService: {
  cancelNeed: (...args: unknown[]) => mockLifecycle.cancelNeed(...args), deleteDraftNeed: (...args: unknown[]) => mockLifecycle.deleteDraftNeed(...args),
  readCommandReceipt: (...args: unknown[]) => mockLifecycle.readCommandReceipt(...args),
} }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected transport'); } }));
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
jest.mock('../../ui/qa/useTaskQaInline', () => ({ useTaskQaInline: () => ({ state: { phase: 'idle' }, retry: () => undefined }) }));
import Review from '../../app/(app)/potrebe/[id]/pregled';
import { ConfirmSheet, confirmFormOf } from '../../ui/system/ConfirmSheet';
import { brandAction, sys } from '../../ui/system/tokens';

/**
 * A DRAFT, on its own screen (owner's phone, 2026-10-07: "there is no easy way to delete it or edit it"). The ways to change or delete a draft
 * lived only behind the bar's "···". They stay there, and the same two are now ALSO drawn in plain sight at the end of the page: "Izmeni nacrt"
 * (white, never green) and, last and in the danger colour, "Obriši nacrt". Both call exactly what the menu rows call: the guarded edit and the
 * lifecycle's own deletion, which asks first in the centred dialog. The footer's one green action stays the only one.
 */
const need = (stanje = 'NACRT', patch: Record<string, unknown> = {}) => ({ id: NEED, revizija: 7, stanje, naslov: 'Pregledani Zadatak',
  opis: 'Opis', podrucjeTekst: 'Novi Sad', vremeTekst: 'Po dogovoru', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: [],
  brojPrijava: 0, ...patch });
const ok = (podatak: unknown) => ({ ok: true, podatak });
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Review />); }); };
const presses = () => tree.root.findAll(node => node.type === ('Press' as React.ElementType));
/** The page's own button of that name (the dialog's confirm carries the same words and a testID of its own). */
const row = (label: string) => presses().filter(node => node.props.accessibilityLabel === label && node.props.accessibilityRole === 'button' && !node.props.testID);
const menuItems = () => presses().filter(node => node.props.accessibilityRole === 'menuitem');
const surfaceOf = (style: unknown): unknown => Array.isArray(style) ? style.map(surfaceOf).filter(value => value !== undefined).pop()
  : style && typeof style === 'object' ? (style as { backgroundColor?: unknown }).backgroundColor : undefined;
const brand = () => presses().filter(node => surfaceOf(node.props.style) === brandAction.backgroundColor).map(node => node.props.accessibilityLabel);
const words = (node: ReactTestInstance) => StyleSheet.flatten(node.findByType('T' as React.ElementType).props.style) as { color?: string };
const sheets = () => tree.root.findAllByType(ConfirmSheet);
const inSheet = (testID: string) => act(async () => { sheets()[0].findByProps({ testID }).props.onPress(); });
beforeEach(() => {
  jest.clearAllMocks(); mockFocused = true;
  for (const mock of [mockNeed, mockSearch, mockEdit, mockMine, mockReadiness, ...Object.values(mockLifecycle), ...Object.values(mockStored)]) mock.mockReset();
  mockNeed.mockResolvedValue(need()); mockSearch.mockResolvedValue({ closed: false, closedAt: null }); mockMine.mockResolvedValue([]);
  mockReadiness.mockResolvedValue(ok({ kind: 'READY' }));
  mockEdit.mockResolvedValue(ok({ needId: NEED, conversationId: CONVERSATION, revision: 7, needStatus: 'DRAFT', authoritative: true }));
  mockStored.getItem.mockResolvedValue(null); mockStored.setItem.mockResolvedValue(undefined); mockStored.removeItem.mockResolvedValue(undefined);
  mockLifecycle.deleteDraftNeed.mockResolvedValue(ok({ needId: NEED, revision: 7, deleted: true, idempotentReplay: false }));
  mockLifecycle.readCommandReceipt.mockResolvedValue(ok({ state: 'NOT_CONFIRMED' }));
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('a draft draws "Izmeni nacrt" (white) and, last, "Obriši nacrt" (danger) in plain sight, under the footer\'s ONE green action', async () => {
  await render();
  expect(row('Izmeni nacrt')).toHaveLength(1); expect(row('Obriši nacrt')).toHaveLength(1);
  const order = presses().map(node => node.props.accessibilityLabel);
  // The edit, then the deletion, both after the content and before the footer's action; the deletion is the last of the page's own commands.
  expect(order.indexOf('Izmeni nacrt')).toBeLessThan(order.indexOf('Obriši nacrt'));
  expect(order.indexOf('Obriši nacrt')).toBeLessThan(order.indexOf('Pregledaj za objavu'));
  // White with a line, and ink words; the deletion has no fill and its words are the danger colour.
  expect(surfaceOf(row('Izmeni nacrt')[0].props.style)).toBe(sys.color.surface); expect(words(row('Izmeni nacrt')[0]).color).toBe(sys.color.ink);
  expect(surfaceOf(row('Obriši nacrt')[0].props.style)).toBe('transparent'); expect(words(row('Obriši nacrt')[0]).color).toBe(sys.color.danger);
  // The only green fill is the footer's one action.
  expect(brand()).toEqual(['Pregledaj za objavu']);
  // Each is at least a full 48 touch target.
  for (const label of ['Izmeni nacrt', 'Obriši nacrt']) expect(StyleSheet.flatten(row(label)[0].props.style).minHeight).toBeGreaterThanOrEqual(48);
});

it('they are ALSO behind the "···", as before, and both reach the same callbacks', async () => {
  await render();
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'Više radnji' }).props.onPress(); });
  expect(menuItems().map(item => item.props.accessibilityLabel)).toEqual(['Izmeni nacrt', 'Obriši nacrt']);
});

it('"Obriši nacrt" in plain sight asks in the centred dialog of the menu row, sends nothing before the confirm, and "Odustani" sends nothing at all', async () => {
  await render();
  await act(async () => { row('Obriši nacrt')[0].props.onPress(); });
  expect(sheets()).toHaveLength(1);
  expect(sheets()[0].props).toMatchObject({ title: 'Obriši nacrt?', confirmLabel: 'Obriši nacrt', tone: 'danger',
    message: 'Nacrt se briše zauvek i ne može da se vrati. Ako ima fotografije, prvo ih ukloni iz nacrta.' });
  expect(confirmFormOf(sheets()[0].props)).toBe('dialog');
  expect(sheets()[0].findByProps({ testID: 'confirm-sheet-cancel' }).props.accessibilityLabel).toBe('Odustani');
  expect(mockStored.setItem).not.toHaveBeenCalled(); expect(mockLifecycle.deleteDraftNeed).not.toHaveBeenCalled();
  await inSheet('confirm-sheet-cancel');
  expect(sheets()).toHaveLength(0); expect(mockStored.setItem).not.toHaveBeenCalled(); expect(mockLifecycle.deleteDraftNeed).not.toHaveBeenCalled();
  expect(row('Obriši nacrt')[0].props.disabled).toBe(false);
});

it('the confirm sends the lifecycle\'s own deletion once, bound to the revision that was read, and says "Nacrt je obrisan." under the title', async () => {
  await render();
  await act(async () => { row('Obriši nacrt')[0].props.onPress(); });
  await inSheet('confirm-sheet-confirm');
  expect(mockStored.setItem).toHaveBeenCalledTimes(1);
  expect(mockLifecycle.deleteDraftNeed.mock.calls).toEqual([[NEED, 7, '']]);
  expect(sheets()).toHaveLength(0);
  const copy = tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string'));
  expect(copy).toContain('Nacrt je obrisan.');
});

it('"Izmeni nacrt" in plain sight opens the conversation, exactly as the menu row does', async () => {
  await render();
  await act(async () => { row('Izmeni nacrt')[0].props.onPress(); });
  expect(mockEdit).toHaveBeenCalledWith(NEED);
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: CONVERSATION } });
  expect(sheets()).toHaveLength(0);
});

it('while the screen works they wait grey, and a press kept from before does nothing', async () => {
  await render();
  const kept = { edit: row('Izmeni nacrt')[0].props.onPress, remove: row('Obriši nacrt')[0].props.onPress };
  await act(async () => { row('Obriši nacrt')[0].props.onPress(); });
  // The question is open: the screen is busy, so both are grey and neither does anything.
  expect(row('Izmeni nacrt')[0].props.disabled).toBe(true); expect(row('Obriši nacrt')[0].props.disabled).toBe(true);
  await act(async () => { kept.edit(); kept.remove(); });
  expect(mockEdit).not.toHaveBeenCalled(); expect(sheets()).toHaveLength(1);
});

it('a draft the gate asks to complete in the conversation has that as its green action, so "Izmeni nacrt" is not drawn twice; the deletion stays', async () => {
  mockReadiness.mockResolvedValue(ok({ kind: 'NOT_READY', code: 'LOCATION_INCOMPLETE', missingSlots: [] }));
  await render();
  expect(brand()).toEqual(['Otvori razgovor i dopuni']);
  expect(row('Izmeni nacrt')).toHaveLength(0); expect(row('Obriši nacrt')).toHaveLength(1);
});

it.each([
  ['a published task', need('OBJAVLJENA')], ['a task with applications', need('CEKA_PRIJAVE', { brojPrijava: 2, brojPrijavaZaIzbor: 2 })],
  ['a closed task', need('ZATVORENA')],
])('%s has its own "···" and draws neither row', async (_name, shown) => {
  mockNeed.mockResolvedValue(shown);
  await render();
  expect(row('Izmeni nacrt')).toHaveLength(0); expect(row('Obriši nacrt')).toHaveLength(0);
});

it('a draft that cannot be deleted (a place is agreed) keeps the edit and draws no deletion, as the menu does', async () => {
  mockNeed.mockResolvedValue(need('NACRT', { pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } }));
  await render();
  expect(row('Obriši nacrt')).toHaveLength(0);
});

it('draws nothing while the task is loading or cannot be read', async () => {
  mockNeed.mockResolvedValue(null);
  await render();
  expect(row('Izmeni nacrt')).toHaveLength(0); expect(row('Obriši nacrt')).toHaveLength(0);
});
