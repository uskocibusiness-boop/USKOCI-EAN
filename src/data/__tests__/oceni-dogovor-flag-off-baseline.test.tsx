import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * D12 flag OFF: the rating screen is the screen it was before the written comment existed. This file was recorded BEFORE the
 * comment client was written (its snapshot is the structure of the then-current screen, without styles), and it must pass
 * unchanged after it: a build without EXPO_PUBLIC_D12_REVIEW_COMMENT renders this tree, calls the legacy review pair only,
 * and draws no field, no row, no wrapper and no extra scroll behaviour.
 *
 * RE-RECORDED on 8 Oct 2026, on purpose: the owner picked a new look for the rating ("Zvezde kao nalepnice": the person's face over the
 * stars, the stars as 48 dp stickers) and for the saved rating ("Pilula pada, sjaj": the pill "Ocenjeno" and the glow). That changed the
 * structure of the screen by design, in every flag state alike; what this file keeps guarding is unchanged: with the flag off the
 * screen has no comment field, no extra row, no wrapper of the comment and no extra scroll behaviour.
 */
// A cold module graph under a loaded machine can take longer than the default five seconds; the snapshot is what is judged here, not the speed.
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
// The top bar, the action and the success mark belong to other work (the chrome, the action, the motion): named elements here, so the
// snapshot is the structure of the rating screen itself and a change to one of them does not move it.
jest.mock('../../ui/system/DetailTopBar', () => ({ DetailTopBar: 'DetailTopBar' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/system/SuccessMark', () => ({ SuccessMark: 'SuccessMark' }));
// The sticker stars, their glow and the pill "Ocenjeno" are drawn by their own components (the owner's picks of 8 Oct 2026): named elements
// here too, so the snapshot stays the structure of the rating screen and a change to a drawing or a motion does not move it.
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
/** The tree as drawn, without the styles and without anything that is a function or an element: what a person could tell apart. */
const isElement = (value: unknown) => !!value && typeof value === 'object' && /react\.(?:transitional\.)?element/.test(String((value as { $$typeof?: symbol }).$$typeof));
const structure = () => JSON.stringify(tree.toJSON(), (key, value) => key === 'style' ? undefined : isElement(value) ? '[element]' : value, 1);

beforeEach(() => {
  delete process.env.EXPO_PUBLIC_D12_REVIEW_COMMENT;
  jest.clearAllMocks();
  mockAgreement.mockReset().mockResolvedValue({ id: D, naslov: '"Unos ormara"', ucesnici: [person(A, true, 'Ja Sam', 'uskocer'), person(B, false, 'Nikola Petrović', 'narucilac')] });
  mockContext.mockReset().mockResolvedValue({ ok: true, podatak: context() }); mockSubmit.mockReset();
});
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('with the flag off the rating screen is the legacy screen', () => {
  it('draws the same tree before a choice, with a choice, and once saved', async () => {
    await render();
    expect(structure()).toMatchSnapshot('eligible, nothing chosen');
    await act(async () => button('Ocena 4 od 5').props.onPress());
    await act(async () => button('Pouzdano').props.onPress());
    expect(structure()).toMatchSnapshot('eligible, 4 stars and a tag');
    mockSubmit.mockImplementation(async (command: Record<string, unknown>) => ({ ok: true, podatak: receipt(command) }));
    mockContext.mockImplementation(async () => ({ ok: true, podatak: { ...context(), eligible: false,
      review: receipt({ agreementId: D, targetAccountId: B, rating: 4, tags: ['RELIABLE'], clientRequestId: K }) } }));
    await act(async () => action('Sačuvaj ocenu').props.onPress());
    await settle();
    expect(structure()).toMatchSnapshot('saved');
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
