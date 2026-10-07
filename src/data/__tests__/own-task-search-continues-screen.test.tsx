import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { NeedSearchState } from '../../contracts/needSearchRecovery';
import { brandAction } from '../../ui/system/tokens';

const NEED = '22222222-3333-4444-8555-666666666666';
const ACCOUNT = '11111111-2222-4333-8444-555555555555';
const mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
const mockNeed = jest.fn(), mockSearch = jest.fn(), mockRecoveryRead = jest.fn(), mockReopen = jest.fn();
const mockSource = { potreba: (...args: unknown[]) => mockNeed(...args) };
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
const mockAppState = { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) };
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined),
} }));
jest.mock('../../data', () => ({ aiNeedV2Izvor: { openEditConversation: jest.fn() } }));
jest.mock('../ru4Production', () => ({ ...jest.requireActual('../ru4Production'), ru4Production: {
  remainingSearchState: (...args: unknown[]) => mockSearch(...args), closeRemainingSearch: jest.fn(),
} }));
jest.mock('../needSearchRecoveryClientService', () => ({ ...jest.requireActual('../needSearchRecoveryClientService'), needSearchRecoveryClientService: {
  read: (...args: unknown[]) => mockRecoveryRead(...args), readReceipt: jest.fn(async () => ({ ok: true, podatak: { state: 'NOT_CONFIRMED' } })),
  reopen: (...args: unknown[]) => mockReopen(...args),
} }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected transport'); } }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => ({ id: NEED }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => effect(), [effect]),
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
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';

/**
 * The search for the missing places, as the owner's own task page tells it (owner, 2026-10-07). The page reads the search state the
 * screen already reads (`rpc_get_need_search_state`) and says what the task is doing now: after a Dogovor was cancelled it takes
 * applications again, or waits for the owner to open the search he closed. Nothing new is asked of the server; this is the route, with
 * the existing reads answered by fixtures.
 */
const surfaceOf = (style: unknown): unknown => Array.isArray(style) ? style.map(surfaceOf).filter(value => value !== undefined).pop()
  : style && typeof style === 'object' ? (style as { backgroundColor?: unknown }).backgroundColor : undefined;
const need = (patch: Record<string, unknown> = {}) => ({ id: NEED, revizija: 7, stanje: 'OBJAVLJENA', naslov: 'Pregledani zadatak', opis: 'Opis',
  podrucjeTekst: 'Novi Sad', vremeTekst: 'Po dogovoru', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: [], brojPrijava: 1,
  brojPrijavaZaIzbor: 0, ...patch });
const state = (patch: Partial<NeedSearchState> = {}): NeedSearchState => ({ schemaVersion: 1, authoritative: true, serverAsOf: '2026-10-07T10:00:00Z', needId: NEED,
  revision: 7, status: 'PUBLISHED', requiredSlots: 2, coveredSlots: 0, missingSlots: 2, searchAuthority: 'OPEN', closedAt: null, searchTimeAdmitted: true,
  canReopen: false, reason: 'SEARCH_ALREADY_OPEN', nextAction: 'SEARCH_IN_PROGRESS', agreementCount: 1, activeAgreementCount: 0, awaitingConfirmationCount: 0,
  openProblemCount: 0, ...patch });
const closedAndReopenable = (patch: Partial<NeedSearchState> = {}) => state({ searchAuthority: 'CLOSED', closedAt: '2026-10-07T09:00:00Z', canReopen: true,
  reason: 'CAN_REOPEN', nextAction: 'REOPEN_SEARCH', ...patch });
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Review />); }); };
const presses = () => tree.root.findAll(node => node.type === ('Press' as React.ElementType));
const brand = () => presses().filter(node => surfaceOf(node.props.style) === brandAction.backgroundColor).map(node => node.props.accessibilityLabel);
const chips = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'status-chip').map(node => node.props.accessibilityLabel);
const sentence = () => tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.testID === 'own-task-next')[0]?.props.children ?? null;
const texts = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
beforeEach(() => {
  jest.clearAllMocks();
  mockNeed.mockResolvedValue(need()); mockSearch.mockResolvedValue({ closed: false, closedAt: null });
  mockRecoveryRead.mockResolvedValue({ ok: true, podatak: state() });
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('after a Dogovor was cancelled and the search is open, the page says so and what the task does now', async () => {
  await render();
  expect(sentence()).toBe('Dogovor je otkazan. Tvoj zadatak opet prima prijave.');
  expect(chips()).toEqual(['Objavljen']); expect(brand()).toEqual([]);
  // Nothing was sent: this is the existing read, drawn.
  expect(mockReopen).not.toHaveBeenCalled();
});

it('where applications still wait, the one green action is another application, and it opens the same applications', async () => {
  mockNeed.mockResolvedValue(need({ stanje: 'CEKA_PRIJAVE', brojPrijava: 3, brojPrijavaZaIzbor: 2 }));
  await render();
  expect(chips()).toEqual(['Bira se, 2']);
  expect(String(sentence())).toMatch(/^Dogovor je otkazan\. Imaš 2 prijave\./);
  expect(brand()).toEqual(['Izaberi drugu prijavu, 2 prijave za izbor']);
  await act(async () => presses().find(node => node.props.accessibilityLabel === 'Izaberi drugu prijavu, 2 prijave za izbor')!.props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/kandidati', params: { id: NEED } });
});

it('before the search state is read the page makes no claim about the past', async () => {
  mockRecoveryRead.mockResolvedValue({ ok: false, kod: 'SEARCH_STATE_UNAVAILABLE', poruka: 'Podaci trenutno nisu dostupni.' });
  await render();
  expect(String(sentence() ?? '')).not.toMatch(/otkazan/);
});

it('a search the owner closed survives the cancellation: the page says the Dogovor ended and offers to open the search, in right grammar', async () => {
  mockSearch.mockResolvedValue({ closed: true, closedAt: '2026-10-07T09:00:00Z' });
  mockRecoveryRead.mockResolvedValue({ ok: true, podatak: closedAndReopenable() });
  await render();
  expect(sentence()).toBe('Dogovor je otkazan.');
  expect(texts()).toContain('0 od 2 dogovoreno · preostala potraga je zatvorena');
  expect(chips()).toEqual(['Objavljen']);
  expect(brand()).toEqual(['Ponovo traži ljude']);
  await act(async () => presses().find(node => node.props.accessibilityLabel === 'Ponovo traži ljude')!.props.onPress());
  const sheet = tree.root.findByType(ConfirmSheet);
  expect(sheet.props).toMatchObject({ title: 'Ponovo traži ljude?', confirmLabel: 'Nastavi potragu' });
  expect(sheet.props.message).toMatch(/^Nedostaju još 2 osobe\. Ponovo ćemo otvoriti potragu samo za tim mestima;/);
  expect(mockReopen).not.toHaveBeenCalled();
});

it.each([[1, /^Nedostaje još jedna osoba\. Ponovo ćemo otvoriti potragu za tim mestom;/], [3, /^Nedostaju još 3 osobe\./], [5, /^Nedostaje još 5 osoba\./]])(
  'asks to open the search for %i missing places with the verb that agrees with the number', async (missing, expected) => {
    mockNeed.mockResolvedValue(need({ pokrivenost: { ukupno: missing + 1, popunjeno: 1, preostalo: missing, udeo: 0.5 }, stanje: 'DELIMICNO_POPUNJENA' }));
    mockSearch.mockResolvedValue({ closed: true, closedAt: '2026-10-07T09:00:00Z' });
    mockRecoveryRead.mockResolvedValue({ ok: true, podatak: closedAndReopenable({ requiredSlots: missing + 1, coveredSlots: 1, missingSlots: missing, activeAgreementCount: 1 }) });
    await render();
    await act(async () => presses().find(node => node.props.accessibilityLabel === 'Ponovo traži ljude')!.props.onPress());
    expect(tree.root.findByType(ConfirmSheet).props.message).toMatch(expected);
  });

it('while the screen\'s own section speaks for the search, the page adds no second sentence about it, and the green action is the section\'s', async () => {
  mockNeed.mockResolvedValue(need({ stanje: 'POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 }, brojPrijava: 2 }));
  mockRecoveryRead.mockResolvedValue({ ok: true, podatak: state({ status: 'ACTIVE', coveredSlots: 2, missingSlots: 0, agreementCount: 2, activeAgreementCount: 2,
    awaitingConfirmationCount: 1, reason: 'NO_MISSING_CAPACITY', nextAction: 'OPEN_AGREEMENTS' }) });
  await render();
  expect(texts()).toContain('Potvrdi završetak zadatka');
  expect(chips()).toEqual(['Dogovoren']);
  expect(sentence()).toBeNull();
  expect(brand()).toEqual(['Otvori moje Dogovore']);
});
