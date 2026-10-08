import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { brandAction } from '../../ui/system/tokens';

const NEED = '22222222-3333-4444-8555-666666666666';
const ACCOUNT = '11111111-2222-4333-8444-555555555555';
const CONVERSATION = '55555555-6666-4777-8888-999999999999';
const mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
const mockNeed = jest.fn(), mockSearch = jest.fn(), mockEdit = jest.fn(), mockReadiness = jest.fn();
const mockSource = { potreba: (...args: unknown[]) => mockNeed(...args) };
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
const mockAppState = { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) };
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined),
} }));
jest.mock('../../data', () => ({ aiNeedV2Izvor: { openEditConversation: (...args: unknown[]) => mockEdit(...args) } }));
jest.mock('../ru4Production', () => ({ ...jest.requireActual('../ru4Production'), ru4Production: {
  remainingSearchState: (...args: unknown[]) => mockSearch(...args), closeRemainingSearch: jest.fn(),
} }));
jest.mock('../needPublicationReadiness', () => ({ ...jest.requireActual('../needPublicationReadiness'),
  needPublicationReadiness: { read: (...args: unknown[]) => mockReadiness(...args) } }));
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

/**
 * A draft the publication gate holds back, through the real route (owner, 2026-10-07; plan 3.5): the one action follows the reason.
 * What only waits has no green action and offers to read again, and reading again ASKS THE GATE AGAIN: the same revision of the same
 * task would otherwise never ask a second time, and "Osveži zadatak" would change nothing on the screen.
 */
const surfaceOf = (style: unknown): unknown => Array.isArray(style) ? style.map(surfaceOf).filter(value => value !== undefined).pop()
  : style && typeof style === 'object' ? (style as { backgroundColor?: unknown }).backgroundColor : undefined;
const draft = () => ({ id: NEED, revizija: 7, stanje: 'NACRT', naslov: 'Pregledani zadatak', opis: 'Opis', podrucjeTekst: 'Novi Sad', vremeTekst: 'Po dogovoru',
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: [], brojPrijava: 0 });
const ok = (podatak: unknown) => ({ ok: true, podatak });
const held = (code: string) => ok({ kind: 'NOT_READY', code, missingSlots: [] });
function deferred<T = unknown>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Review />); }); };
const presses = () => tree.root.findAll(node => node.type === ('Press' as React.ElementType));
const brand = () => presses().filter(node => surfaceOf(node.props.style) === brandAction.backgroundColor).map(node => node.props.accessibilityLabel);
const texts = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
beforeEach(() => {
  jest.clearAllMocks();
  for (const mock of [mockReadiness, mockEdit]) mock.mockReset();
  mockNeed.mockResolvedValue(draft()); mockSearch.mockResolvedValue({ closed: false, closedAt: null });
  mockEdit.mockResolvedValue(ok({ needId: NEED, conversationId: CONVERSATION, revision: 7, needStatus: 'DRAFT', authoritative: true }));
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('a draft that only waits has no green action, says why, and "Osveži zadatak" asks the gate again without a flash of the green review', async () => {
  const again = deferred();
  mockReadiness.mockResolvedValueOnce(held('PUBLIC_MEDIA_NOT_READY')).mockReturnValueOnce(again.promise);
  await render();
  expect(mockReadiness).toHaveBeenCalledTimes(1); expect(mockReadiness).toHaveBeenCalledWith(NEED, 7);
  expect(texts()).toContain('Fotografije se još obrađuju'); expect(brand()).toEqual([]);
  await act(async () => tree.root.findByProps({ label: 'Osveži' }).props.onPress());
  // The gate was asked again. Until it answers, the old answer stays: the page never offers the green review in the middle of a wait.
  expect(mockReadiness).toHaveBeenCalledTimes(2);
  expect(texts()).toContain('Fotografije se još obrađuju'); expect(brand()).toEqual([]);
  await act(async () => again.resolve(ok({ kind: 'READY' })));
  expect(texts()).not.toContain('Fotografije se još obrađuju');
  expect(brand()).toEqual(['Pregledaj za objavu']);
});

it('a draft that is still held after reading again stays as it was', async () => {
  mockReadiness.mockResolvedValue(held('POLICY_NOT_READY'));
  await render();
  await act(async () => tree.root.findByProps({ label: 'Osveži' }).props.onPress());
  expect(mockReadiness).toHaveBeenCalledTimes(2);
  expect(texts()).toContain('Nije do tebe. Nacrt je sačuvan, pokušaj kasnije.'); expect(brand()).toEqual([]);
});

it('a draft whose place is missing opens the conversation where it is asked for, and not the review', async () => {
  mockReadiness.mockResolvedValue(held('LOCATION_INCOMPLETE'));
  await render();
  expect(brand()).toEqual(['Otvori razgovor i dopuni']);
  await act(async () => presses().find(node => node.props.accessibilityLabel === 'Otvori razgovor i dopuni')!.props.onPress());
  expect(mockEdit).toHaveBeenCalledWith(NEED);
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: CONVERSATION } });
});

it('a draft the gate has not been asked about, or could not answer, reviews as it always did', async () => {
  mockReadiness.mockResolvedValue({ ok: false, kod: 'NEED_PUBLICATION_READINESS_READ_FAILED', poruka: 'Nije učitano.' });
  await render();
  expect(brand()).toEqual(['Pregledaj za objavu']);
  await act(async () => presses().find(node => node.props.accessibilityLabel === 'Pregledaj za objavu')!.props.onPress());
  expect(mockEdit).toHaveBeenCalledWith(NEED);
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pregled-zadatka', params: { conversationId: CONVERSATION } });
});
