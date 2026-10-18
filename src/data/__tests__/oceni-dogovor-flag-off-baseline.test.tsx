import React from 'react';
import { TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/** Flag OFF keeps the rating contract: no written comment, explicit choice,
 * owned legacy request and authoritative saved result. Layout and brand colors may evolve. */
jest.setTimeout(60_000);
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', K = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', R = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const mockAccountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', mockAgreementId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const mockContext = jest.fn(), mockSubmit = jest.fn(), mockAgreement = jest.fn();
const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return { currentState: 'active', addEventListener: () => ({ remove: () => {} }) };
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => ({ agreementId: mockAgreementId }),
  useFocusEffect: (fn: () => void) => require('react').useEffect(fn, [fn]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccountId }, accountRevision: 1 }),
  sesijaSada: () => ({ user: { id: mockAccountId }, accountRevision: 1 }) }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected direct RPC in review presentation test'); } }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => ({ dogovor: (...args: unknown[]) => mockAgreement(...args) }) }));
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
// Named presentation dependencies keep this test focused on the rating contract.
jest.mock('../../ui/system/DetailTopBar', () => ({ DetailTopBar: 'DetailTopBar' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/system/SuccessMark', () => ({ SuccessMark: 'SuccessMark' }));
// Artwork and motion are covered by their component suites.
jest.mock('../../ui/reviews/RatingStar', () => ({ RatingStar: 'RatingStar', StarGlow: 'StarGlow', STARS_WIDTH: 272, STAR_SLOT: 48 }));
jest.mock('../../ui/system/Pecat', () => ({ Pecat: 'Pecat', PECAT_FALL_MS: 140 }));
jest.mock('../reviewsClientService', () => ({
  ...jest.requireActual('../reviewsClientService'),
  reviewsClientService: { context: (...args: unknown[]) => mockContext(...args), submit: (...args: unknown[]) => mockSubmit(...args), reputation: jest.fn() },
}));
import ReviewRoute from '../../app/(app)/oceni-dogovor';
import { REVIEW_TAGS } from '../reviewsClientService';

const context = () => ({ accountId: A, agreementId: D, targetAccountId: B, eligible: true, review: null,
  tagCatalog: { version: 'PRE_V3_REVIEW_TAGS_V1', maxTags: 3, tags: [...REVIEW_TAGS] }, authoritative: true });
const receipt = (command: Record<string, unknown>) => ({ ...command, reviewId: R, reviewerAccountId: A, createdAt: '2026-09-12T10:00:00Z', idempotentReplay: false, authoritative: true });
const person = (id: string, viSte: boolean, ime: string, uloga: 'narucilac' | 'uskocer') => ({ id, profilId: null, ime, inicijali: ime.slice(0, 1), uloga, mesta: null, viSte, telefon: null });
let tree: ReactTestRenderer;
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const action = (label: string) => tree.root.findByProps({ label });
const settle = async () => { await act(async () => {}); };
async function render() { await act(async () => { tree = create(<ReviewRoute />); }); await settle(); }
const text = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const noComment = () => {
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Komentar o saradnji')).toHaveLength(0);
  expect(text()).not.toContain('Tvoj komentar');
};

beforeEach(() => {
  delete process.env.EXPO_PUBLIC_D12_REVIEW_COMMENT;
  jest.clearAllMocks();
  mockAgreement.mockReset().mockResolvedValue({ id: D, naslov: '"Unos ormara"', ucesnici: [person(A, true, 'Ja Sam', 'uskocer'), person(B, false, 'Nikola Petrović', 'narucilac')] });
  mockContext.mockReset().mockResolvedValue({ ok: true, podatak: context() }); mockSubmit.mockReset();
});
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('with the comment flag off the rating retains its owned contract', () => {
  it('requires a rating, preserves the selected tag and shows only the confirmed saved result', async () => {
    await render();
    noComment();
    expect(action('Sačuvaj ocenu').props.disabled).toBe(true);
    for (let score = 1; score <= 5; score++) expect(button(`Ocena ${score} od 5`).props.accessibilityState.checked).toBe(false);
    expect(text()).toContain('Nikola Petrović');
    await act(async () => button('Ocena 4 od 5').props.onPress());
    await act(async () => button('Pouzdano').props.onPress());
    expect(button('Ocena 4 od 5').props.accessibilityState.checked).toBe(true);
    expect(button('Pouzdano').props.accessibilityState.checked).toBe(true);
    expect(action('Sačuvaj ocenu').props.disabled).toBe(false);
    expect(text()).not.toContain('Ocena je sačuvana.'); noComment();
    mockSubmit.mockImplementation(async (command: Record<string, unknown>) => ({ ok: true, podatak: receipt(command) }));
    mockContext.mockImplementation(async () => ({ ok: true, podatak: { ...context(), eligible: false,
      review: receipt({ agreementId: D, targetAccountId: B, rating: 4, tags: ['RELIABLE'], clientRequestId: K }) } }));
    await act(async () => action('Sačuvaj ocenu').props.onPress());
    await settle();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(mockSubmit.mock.calls[0][0]).toEqual({ agreementId: D, targetAccountId: B, rating: 4, tags: ['RELIABLE'], clientRequestId: K });
    expect(text()).toContain('Ocena je sačuvana.'); expect(text()).toContain('Tvoja ocena: 4 od 5');
    expect(text()).toContain('Pouzdano');
    expect(tree.root.findAllByProps({ label: 'Sačuvaj ocenu' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityRole: 'radio' })).toHaveLength(0);
    noComment();
  });

  it('asks the legacy pair and nothing else, with the legacy arguments', async () => {
    await render();
    expect(mockContext).toHaveBeenCalledWith(D, { accountId: A, accountRevision: 1 });
    await act(async () => button('Ocena 5 od 5').props.onPress());
    mockSubmit.mockResolvedValue({ ok: false, kod: 'REVIEW_OUTCOME_UNKNOWN', poruka: 'Proveri sačuvanu ocenu.' });
    await act(async () => action('Sačuvaj ocenu').props.onPress());
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(mockSubmit.mock.calls[0][0]).toEqual({ agreementId: D, targetAccountId: B, rating: 5, tags: [], clientRequestId: K });
    expect(Object.keys(mockSubmit.mock.calls[0][0]).sort()).toEqual(['agreementId', 'clientRequestId', 'rating', 'tags', 'targetAccountId']);
  });
});
