import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * "Ocene" (T4a, 2026-10-07): where the rating line of the profile leads. Two tabs in the owner's words, "Primljene" and "Date".
 * Primljene shows what the backend answers about the person's own account (the average with its count and, in a build with
 * the written comments, the comments); the individual ratings behind the average are not listed because the backend has no read for
 * them. Date lists the ratings the person gave, read from their finished Dogovori only when the tab is opened.
 */
jest.setTimeout(60_000);
const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', THEM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', PROFILE = '99999999-9999-4999-8999-999999999999';
const FLAG = 'EXPO_PUBLIC_D12_REVIEW_COMMENT';
let mockSession = { user: { id: ME }, accountRevision: 1 };
let mockParams: Record<string, string> = {};
const mockRouter = { navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
const mockReputation = jest.fn(), mockOwn = jest.fn(), mockAgreements = jest.fn(), mockContext = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]) }));
jest.mock('../../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../../data/supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected direct call in a route test'); } }));
jest.mock('../../../data/reviewsClientService', () => ({ ...jest.requireActual('../../../data/reviewsClientService'),
  reviewsClientService: { reputation: (...a: unknown[]) => mockReputation(...a) } }));
jest.mock('../../../data/ownProfileClientService', () => ({ ownProfileClientService: { read: (...a: unknown[]) => mockOwn(...a) } }));
jest.mock('../../../data/agreementClientService', () => ({ agreementClientService: { mojiDogovori: (...a: unknown[]) => mockAgreements(...a) } }));
jest.mock('../../../data/reviewCommentsClientService', () => ({ reviewCommentsClientService: { context: (...a: unknown[]) => mockContext(...a) } }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../v2/V2Action', () => ({ V2Action: 'Button' }));
jest.mock('../../media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));
jest.mock('../ReviewCommentsSection', () => ({ ReviewCommentsSection: 'ReviewCommentsSection' }));
import Ocene from '../../../app/(app)/profil/ocene';
import { trenutak } from '../../../lib/trenutak';

let tree: ReactTestRenderer;
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const render = async () => { await act(async () => { tree = create(<Ocene />); await flush(); }); };
const hosts = (name: string) => tree.root.findAll(node => String(node.type) === name);
const texts = () => hosts('T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
const press = (label: string) => hosts('Press').find(node => node.props.accessibilityLabel === label)!;
const button = (label: string) => hosts('Button').find(node => node.props.label === label)!;
const tab = (label: string) => press(label);
const reputation = (reviewCount: number, averageRating: number | null) => ({ ok: true, podatak: { accountId: ME, reviewCount, averageRating,
  state: reviewCount ? 'RATED' : 'NO_REVIEWS', authoritative: true } });
const agreement = (id: string, patch: Record<string, unknown> = {}) => ({ id, naslov: `Selidba ${id}`, stanje: 'COMPLETED', ucesnici: [
  { id: ME, profilId: 'p-me', ime: 'Ja', inicijali: 'J', uloga: 'narucilac' }, { id: THEM, profilId: 'p-them', ime: 'Marko Marković', inicijali: 'MM', uloga: 'uskocer' }], ...patch });
const review = (id: string, rating: number, createdAt: string, comment?: string) => ({ ok: true, podatak: { accountId: ME, agreementId: id, targetAccountId: THEM, eligible: false,
  review: { reviewId: `r${id}`, agreementId: id, reviewerAccountId: ME, targetAccountId: THEM, rating, tags: [], createdAt, comment }, authoritative: true } });
const unrated = (id: string) => ({ ok: true, podatak: { accountId: ME, agreementId: id, targetAccountId: THEM, eligible: true, review: null, authoritative: true } });

beforeEach(() => {
  jest.clearAllMocks(); delete process.env[FLAG]; mockParams = {}; mockSession = { user: { id: ME }, accountRevision: 1 };
  mockRouter.canGoBack.mockReturnValue(true);
  mockReputation.mockReset().mockResolvedValue(reputation(4, 5));
  mockOwn.mockReset().mockImplementation(async (_account: string, intent: string) => intent === 'narucilac' ? { profileId: PROFILE, ime: 'Ana', grad: null, kind: 'REQUESTER', stanje: null } : null);
  mockAgreements.mockReset().mockResolvedValue([]);
  mockContext.mockReset();
});
afterEach(async () => { delete process.env[FLAG]; await act(async () => tree?.unmount()); });

describe('the two tabs', () => {
  it('are "Primljene" and "Date", exactly, and the screen opens on the first', async () => {
    await render();
    expect(hosts('Press').filter(node => node.props.accessibilityRole === 'tab').map(node => node.props.accessibilityLabel)).toEqual(['Primljene', 'Date']);
    expect(tab('Primljene').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(tab('Date').props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
    expect(texts()).toContain('Ocene');
  });

  it('opens on "Date" when the link names it, and on "Primljene" when it names that', async () => {
    mockParams = { tab: 'date' }; await render();
    expect(tab('Date').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    await act(async () => tree.unmount());
    mockParams = { tab: 'primljene' }; await render();
    expect(tab('Primljene').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  });

  it('goes back to where the person came from, or to the profile when nothing is behind', async () => {
    await render();
    await act(async () => press('Nazad').props.onPress());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
    mockRouter.canGoBack.mockReturnValue(false); mockRouter.back.mockClear();
    await render();
    await act(async () => press('Nazad').props.onPress());
    expect(mockRouter.replace).toHaveBeenCalledWith('/profil');
  });
});

describe('Primljene', () => {
  it('shows the average with its count, in the one spelling the profile uses, and says what it is', async () => {
    mockReputation.mockResolvedValue(reputation(4, 5)); await render();
    expect(texts()).toContain('5,0 · 4 ocene'); expect(texts()).toContain('Prosek svih ocena na tvom nalogu.');
    expect(mockReputation).toHaveBeenCalledWith(ME);
  });

  it('reads as a still bar while it reads, never as "no ratings"', async () => {
    mockReputation.mockReturnValue(new Promise(() => undefined)); await render();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Učitavamo ocene' })).toHaveLength(1);
    expect(texts()).not.toContain('Još nema ocena');
  });

  it('says there are no ratings yet, and how they come', async () => {
    mockReputation.mockResolvedValue(reputation(0, null)); await render();
    expect(texts()).toContain('Još nema ocena'); expect(texts()).toContain('Ocene stižu posle završenih Dogovora.');
    expect(texts()).not.toContain('0,0');
  });

  it('says it could not read, offers the read again, and does not read a failure as zero', async () => {
    mockReputation.mockResolvedValueOnce({ ok: false, kod: 'REPUTATION_NOT_AVAILABLE', poruka: 'x' });
    await render();
    expect(texts()).toContain('Ocene trenutno nisu dostupne'); expect(texts()).not.toContain('Još nema ocena');
    await act(async () => { button('Pokušaj ponovo').props.onPress(); await flush(); });
    expect(mockReputation).toHaveBeenCalledTimes(2); expect(texts()).toContain('5,0 · 4 ocene');
  });

  it('draws no individual rating it does not have, and promises nothing it cannot keep', async () => {
    await render();
    const all = texts();
    expect(all).not.toMatch(/anonim|server|Pojedinačn/i);
    expect(hosts('ReviewCommentsSection')).toHaveLength(0);
  });

  it('lists the written comments about the person only in a build with them, under the profile of the account', async () => {
    process.env[FLAG] = '1'; await render();
    const sections = hosts('ReviewCommentsSection');
    expect(sections).toHaveLength(1);
    expect(sections[0].props.profileId).toBe(PROFILE);
    expect(mockOwn).toHaveBeenCalledWith(ME, 'narucilac');
    // The reviewer's photo is the profile photo as everywhere, at the size the section asks for, with the stand-in it hands over.
    const element = sections[0].props.photo('88888888-8888-4888-8888-888888888888', 40, 'stand-in') as React.ReactElement<Record<string, unknown>>;
    expect(element.type).toBe('ProfilePhoto');
    expect(element.props).toEqual({ profileId: '88888888-8888-4888-8888-888888888888', size: 40, fallback: 'stand-in' });
  });

  it('without the flag nothing is read for the comments, and the work profile\'s id stands in when the person has no requester profile', async () => {
    await render();
    expect(mockOwn).not.toHaveBeenCalled(); expect(hosts('ReviewCommentsSection')).toHaveLength(0);
    await act(async () => tree.unmount());
    process.env[FLAG] = '1';
    mockOwn.mockImplementation(async (_account: string, intent: string) => intent === 'uskocer' ? { profileId: 'work-profile' } : null);
    await render();
    expect(hosts('ReviewCommentsSection')[0].props.profileId).toBe('work-profile');
  });

  it('lists the comments even when the average cannot be read: the two reads do not depend on each other', async () => {
    process.env[FLAG] = '1'; mockReputation.mockResolvedValue({ ok: false, kod: 'REPUTATION_NOT_AVAILABLE', poruka: 'x' });
    await render();
    expect(texts()).toContain('Ocene trenutno nisu dostupne'); expect(hosts('ReviewCommentsSection')).toHaveLength(1);
  });

  it('lists no comments for a person who has no profile to list them under', async () => {
    process.env[FLAG] = '1'; mockOwn.mockResolvedValue(null);
    await render();
    expect(hosts('ReviewCommentsSection')).toHaveLength(0);
  });
});

describe('Date', () => {
  const OLD = '2025-03-14T10:00:00Z', NEWER = '2025-06-02T09:00:00Z';
  const open = async () => { await act(async () => { tab('Date').props.onPress(); await flush(); }); };

  it('reads nothing until the tab is opened, and then the Dogovori without the rating enrichment, once', async () => {
    await render();
    expect(mockAgreements).not.toHaveBeenCalled(); expect(mockContext).not.toHaveBeenCalled();
    await open();
    expect(mockAgreements.mock.calls).toEqual([[{ includeRatings: false }]]);
    // And going back and forth keeps what was read: the tab is not read again.
    await act(async () => { tab('Primljene').props.onPress(); await flush(); });
    await open();
    expect(mockAgreements).toHaveBeenCalledTimes(1);
  });

  it('asks about the finished Dogovori only, and lists the ratings given, newest first, each with the other side, the stars and the day', async () => {
    mockAgreements.mockResolvedValue([agreement('a'), agreement('b', { stanje: 'CONFIRMED' }), agreement('c'), agreement('d')]);
    mockContext.mockImplementation(async (id: string) => id === 'a' ? review('a', 4, OLD) : id === 'c' ? review('c', 5, NEWER, 'Sve po dogovoru.') : unrated(id));
    await render(); await open();
    expect(mockContext.mock.calls.map(call => call[0]).sort()).toEqual(['a', 'c', 'd']);
    const rows = hosts('Press').filter(node => node.props.accessibilityHint === 'Otvara Dogovor.');
    expect(rows.map(node => node.props.accessibilityLabel)).toEqual([
      `Ocena 5 od 5. Marko Marković. Selidba c. ${trenutak(NEWER)!.dan}`, `Ocena 4 od 5. Marko Marković. Selidba a. ${trenutak(OLD)!.dan}`]);
    expect(texts()).toContain('Marko Marković'); expect(texts()).toContain('Selidba c'); expect(texts()).toContain(trenutak(NEWER)!.dan);
    // A written comment is drawn outside the row's own press (it has a control of its own).
    expect(texts()).toContain('Sve po dogovoru.'); expect(rows[0].findAll(node => String(node.type) === 'T' && node.children.includes('Sve po dogovoru.'))).toHaveLength(0);
  });

  it('opens the Dogovor of a row, once', async () => {
    mockAgreements.mockResolvedValue([agreement('a')]); mockContext.mockResolvedValue(review('a', 4, OLD));
    await render(); await open();
    const row = hosts('Press').find(node => node.props.accessibilityHint === 'Otvara Dogovor.')!;
    await act(async () => { row.props.onPress(); row.props.onPress(); });
    expect(mockRouter.navigate.mock.calls).toEqual([[{ pathname: '/dogovor/[id]', params: { id: 'a' } }]]);
  });

  it('says there are no ratings given yet, and where they will appear', async () => {
    mockAgreements.mockResolvedValue([agreement('a')]); mockContext.mockResolvedValue(unrated('a'));
    await render(); await open();
    expect(texts()).toContain('Još nema datih ocena'); expect(texts()).toContain('Ocene koje ostaviš posle završenog Dogovora pojaviće se ovde.');
  });

  it('says it could not read the Dogovori and offers the read again', async () => {
    mockAgreements.mockRejectedValueOnce(new Error('AGREEMENT_LIST_FAILED')); mockAgreements.mockResolvedValue([agreement('a')]);
    mockContext.mockResolvedValue(review('a', 3, OLD));
    await render(); await open();
    expect(texts()).toContain('Date ocene nisu učitane'); expect(texts()).not.toContain('Još nema datih ocena');
    await act(async () => { button('Pokušaj ponovo').props.onPress(); await flush(); });
    expect(texts()).toContain('Selidba a');
  });

  it('counts a receipt it could not read as one it could not read, shows the rest, and reads exactly those again', async () => {
    mockAgreements.mockResolvedValue([agreement('a'), agreement('b')]);
    mockContext.mockImplementation(async (id: string) => id === 'b' ? { ok: false, kod: 'REVIEW_READ_UNAVAILABLE', poruka: 'x' } : review('a', 4, OLD));
    await render(); await open();
    expect(texts()).toContain('Selidba a'); expect(texts()).toContain('Ne možemo da učitamo ocene za 1 Dogovor.');
    expect(texts()).not.toContain('Još nema datih ocena');
    mockContext.mockClear(); mockContext.mockImplementation(async () => review('b', 2, NEWER));
    await act(async () => { button('Pokušaj ponovo').props.onPress(); await flush(); });
    expect(mockContext.mock.calls).toEqual([['b']]);
    expect(texts()).toContain('Selidba b'); expect(texts()).not.toContain('Ne možemo da učitamo');
  });

  it('reads the finished Dogovori fifteen at a time and offers the older ones', async () => {
    const list = Array.from({ length: 20 }, (_, index) => agreement(`d${index}`));
    mockAgreements.mockResolvedValue(list);
    mockContext.mockImplementation(async (id: string) => review(id, 5, `2025-0${1 + (Number(id.slice(1)) % 9)}-10T10:00:00Z`));
    await render(); await open();
    expect(mockContext).toHaveBeenCalledTimes(15);
    expect(button('Prikaži starije')).toBeDefined();
    await act(async () => { button('Prikaži starije').props.onPress(); await flush(); });
    expect(mockContext).toHaveBeenCalledTimes(20);
    expect(hosts('Button').filter(node => node.props.label === 'Prikaži starije')).toHaveLength(0);
  });

  it('does not invent the other side: a Dogovor that does not name them has a row without a name, said as such', async () => {
    mockAgreements.mockResolvedValue([agreement('a', { ucesnici: [] })]); mockContext.mockResolvedValue(review('a', 4, OLD));
    await render(); await open();
    expect(texts()).toContain('Ime nije dostupno');
  });

  it('is not shown for another account: a new account starts with nothing read', async () => {
    mockAgreements.mockResolvedValue([agreement('a')]); mockContext.mockResolvedValue(review('a', 4, OLD));
    await render(); await open();
    expect(mockAgreements).toHaveBeenCalledTimes(1);
    mockSession = { user: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }, accountRevision: 2 };
    await act(async () => { tree.update(<Ocene />); await flush(); });
    expect(texts()).not.toContain('Selidba a');
    expect(tab('Primljene').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  });
});
