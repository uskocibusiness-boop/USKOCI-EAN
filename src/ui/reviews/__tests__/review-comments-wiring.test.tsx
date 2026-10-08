import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * Where the "Komentari" section of a profile is wired (D12). Until 2026-10-07 it stood under the rating line of `AccountReputation`
 * on the profile; the rating line is now a way in to "Ocene" (T4a), and the comments live there, in "Primljene" (tested in
 * `ratings-route.test.tsx`). What is judged here is that the profile no longer carries them, what it hands the rating line instead,
 * and that the line itself still reads exactly as it did. The section itself is tested in `review-comments-section.test.tsx`.
 */
jest.setTimeout(60_000);
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', PROFILE = '99999999-9999-4999-8999-999999999999';
const mockAccountId = A;
const mockReputation = jest.fn(), mockUseFocused = jest.fn();
let mockRealReputation = true;
const mockRouter = { navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
type Row = { ime: string | null; grad: string | null; profileId?: string; stanje?: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | null };
let mockIdentity: Row = { ime: 'Ana Petrović', grad: 'Novi Sad', profileId: PROFILE };
let mockResource: { data: { identity: Row | null; capability: Row | null } | null; loading: boolean; error: boolean; refresh: jest.Mock } =
  { data: { identity: mockIdentity, capability: null }, loading: false, error: false, refresh: jest.fn() };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('../../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccountId }, accountRevision: 1 }), sesijaSada: () => ({ user: { id: mockAccountId }, accountRevision: 1 }) }));
jest.mock('../../../data/supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected direct call in a wiring test'); } }));
jest.mock('../../../data/reviewsClientService', () => ({
  ...jest.requireActual('../../../data/reviewsClientService'),
  reviewsClientService: { reputation: (...args: unknown[]) => mockReputation(...args) },
}));
jest.mock('../../../data/authClientService', () => ({ authClientService: { signOutLocal: jest.fn() } }));
jest.mock('../../../data/ownProfileClientService', () => ({ ownProfileClientService: { read: jest.fn() } }));
jest.mock('../../../hooks/useFocusedResource', () => ({ useFocusedResource: (load: unknown) => mockUseFocused(load) }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));
jest.mock('../ReviewCommentsSection', () => ({ ReviewCommentsSection: 'ReviewCommentsSection' }));
// `AccountReputation` is the real component in the first block and a named element in the second (the profile screen only hands it props).
jest.mock('../AccountReputation', () => {
  const actual = jest.requireActual('../AccountReputation');
  return { ...actual, AccountReputation: (props: Record<string, unknown>) => {
    const React = require('react');
    return mockRealReputation ? React.createElement(actual.AccountReputation, props) : React.createElement('AccountReputation', props);
  } };
});
import { AccountReputation } from '../AccountReputation';
import Profil from '../../../app/(app)/profil';

const FLAG = 'EXPO_PUBLIC_D12_REVIEW_COMMENT';
let tree: ReactTestRenderer;
const hosts = (name: string) => tree.root.findAll(node => String(node.type) === name);
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')) as string[];
beforeEach(() => {
  jest.clearAllMocks(); delete process.env[FLAG]; mockRealReputation = true;
  mockReputation.mockResolvedValue({ ok: true, podatak: { accountId: A, reviewCount: 12, averageRating: 4.8, state: 'RATED', authoritative: true } });
  mockUseFocused.mockImplementation(() => ({ data: { accountId: A, reviewCount: 12, averageRating: 4.8, state: 'RATED', authoritative: true }, loading: false, error: false, refresh: jest.fn() }));
  mockIdentity = { ime: 'Ana Petrović', grad: 'Novi Sad', profileId: PROFILE };
  mockResource = { data: { identity: mockIdentity, capability: null }, loading: false, error: false, refresh: jest.fn() };
});
afterEach(async () => { delete process.env[FLAG]; await act(async () => tree?.unmount()); });

describe('the rating figure of the account reputation', () => {
  const draw = async (props: Record<string, unknown> = {}) => { await act(async () => { tree = create(<AccountReputation accountId={A} {...props} />); }); };

  it.each([[undefined], ['1']])('carries no comments under it, with the build flag %p: they moved to "Ocene"', async value => {
    if (value) process.env[FLAG] = value;
    await draw();
    expect(texts()).toEqual(['4,8', '12 ocena']);
    expect(hosts('ReviewCommentsSection')).toHaveLength(0);
  });

  it('is only a figure without a way in, and a button that says where it goes with one', async () => {
    await draw();
    expect(hosts('Press')).toHaveLength(0);
    await act(async () => tree.unmount());
    const open = jest.fn();
    await draw({ onOpen: open });
    const [press] = hosts('Press');
    expect(press.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Ocena 4,8, 12 ocena', accessibilityHint: 'Otvara ocene.' });
    expect(texts()).toEqual(['4,8', '12 ocena']);
    await act(async () => press.props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('stays a refresh cell when the rating cannot be read: the way in is for a figure that has an answer', async () => {
    mockUseFocused.mockImplementation(() => ({ data: null, loading: false, error: true, refresh: jest.fn() }));
    const open = jest.fn();
    await draw({ onOpen: open });
    expect(texts()).toContain('Ocene trenutno nisu dostupne.');
    const [press] = hosts('Press');
    expect(press.props.accessibilityLabel).toBe('Osveži ocene');
    await act(async () => press.props.onPress());
    expect(open).not.toHaveBeenCalled();
  });
});

describe('what the profile screen hands the reputation', () => {
  // The profile screen reads its own profile through the same hook; here it answers with the profile and the reputation is a named element.
  beforeEach(() => { mockRealReputation = false; mockUseFocused.mockImplementation(() => mockResource); });
  const render = async () => { await act(async () => { tree = create(<Profil />); }); };

  it('the account, on the identity\'s own edge, and a way in to "Ocene"; the comments are no longer handed down', async () => {
    await render();
    const reputations = hosts('AccountReputation');
    expect(reputations).toHaveLength(1);
    expect(reputations[0].props).toMatchObject({ accountId: A });
    expect(reputations[0].props.centered).toBeUndefined();
    expect(typeof reputations[0].props.onOpen).toBe('function');
    expect(reputations[0].props.commentsProfileId).toBeUndefined(); expect(reputations[0].props.commentPhoto).toBeUndefined();
    await act(async () => reputations[0].props.onOpen());
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/ocene']]);
  });

  it('a profile that has not been read still has the way in: the ratings belong to the account, not to a profile row', async () => {
    mockResource = { data: { identity: { ime: 'Ana', grad: null }, capability: null }, loading: false, error: false, refresh: jest.fn() };
    mockUseFocused.mockImplementation(() => mockResource);
    await render();
    expect(typeof hosts('AccountReputation')[0].props.onOpen).toBe('function');
  });
});
