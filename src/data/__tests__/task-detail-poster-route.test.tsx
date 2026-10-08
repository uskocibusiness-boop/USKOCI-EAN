import React from 'react';
jest.mock('../../ui/media/ContextPhotos', () => ({ NeedPhotos: 'NeedPhotos', ProfilePhoto: 'ProfilePhoto' }));
// The safety entry is the hook's own business (PKG-047); here it is a value the test moves, to see what the route shows.
let mockSafety: { onPress: () => void; busy: boolean; error: string | null } | undefined;
jest.mock('../../ui/safety/useSafetyEntry', () => ({ useSafetyEntry: () => mockSafety }));
// The public work-trust read of the poster (`usePublicWorkTrust`) is a read of its own: a screen suite stands in for it and records what it was asked.
const mockTrustAsked = jest.fn();
let mockTrust: unknown = null;
jest.mock('../../ui/profile/usePublicWorkTrust', () => ({ usePublicWorkTrust: (profileId: string | null) => { mockTrustAsked(profileId); return mockTrust; } }));
// The questions of the task have their own reader and their own suite (owner, 2026-10-07); this suite is about the poster.
jest.mock('../../ui/qa/useTaskQaInline', () => ({ useTaskQaInline: () => ({ state: { phase: 'idle' }, retry: () => undefined }) }));
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { PrilikaProjekcija } from '../../contracts/projections';
import { taskRelationIndex } from '../taskRelation';

let mockFocused = true;
const mockLoad = jest.fn(), mockRelations = jest.fn(), mockProfile = jest.fn();
const mockSource = { prilika: mockLoad, odnosiPremaZadacima: mockRelations, javniProfil: mockProfile };
const mockRouter = { navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return { addEventListener: () => ({ remove: () => undefined }) };
    if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter, useLocalSearchParams: () => ({ id: 'task-a' }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]),
}));
jest.mock('../../store/sesija', () => ({
  useSesija: () => ({ user: { id: 'account-a' }, sessionEpoch: 1, accountRevision: 1 }),
  sesijaSada: () => ({ user: { id: 'account-a' }, sessionEpoch: 1, accountRevision: 1 }),
}));
jest.mock('../../store/uloga', () => ({ useUloga: () => 'uskocer', ulogaSada: () => 'uskocer', useIzvor: () => mockSource }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));

import Detail from '../../app/(app)/prilike/[id]';
import { Avatar } from '../../ui/system/Avatar';

/**
 * The poster on a stranger's task, through the real route (review of step 5b, 2026-09-24): a poster without a photo is the
 * one Avatar with their letters, and a failed report or block is said once, where it belongs, and then let go.
 */
const detail = (patch: Partial<PrilikaProjekcija> = {}): PrilikaProjekcija => ({
  id: 'task-a', naslov: 'Zadatak task-a', statusTekst: 'Traži ponude', primaNovePrijave: true, rokZaPrijaveIso: null, podrucjeTekst: 'Centar, Novi Sad',
  vremeTekst: 'Fleksibilno', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: [],
  narucilacProfilId: 'requester-a', narucilacIme: 'Ana Anić', narucilacOcena: null, priblizno: null, ...patch,
});
let tree: ReactTestRenderer | undefined;
const render = async () => { await act(async () => { tree = create(<Detail />); }); };
const update = async () => { await act(async () => { tree!.update(<Detail />); }); };
const photos = (size: number) => tree!.root.findAll(node => node.type === ('ProfilePhoto' as React.ElementType) && node.props.size === size);
const failure = 'Korisnik trenutno nije dostupan.';
/** The failure as the task says it, under the poster: a danger-toned line, not the profile sheet's own alert. */
const shownUnderPoster = () => tree!.root.findAll((node: ReactTestInstance) => node.type === ('T' as React.ElementType)
  && node.props.tone === 'danger' && node.props.children === failure).length > 0;
const presentation = () => tree!.root.findAll(node => typeof node.props.onCloseRequesterProfile === 'function')[0];

beforeEach(() => {
  jest.clearAllMocks(); mockFocused = true; mockSafety = undefined; mockTrust = null;
  mockLoad.mockReset().mockResolvedValue(detail());
  mockRelations.mockReset().mockImplementation(async (ids: readonly string[]) => taskRelationIndex([], ids));
  mockProfile.mockReset().mockResolvedValue(null);
});
afterEach(async () => { await act(async () => { tree?.unmount(); }); tree = undefined; });

describe('the poster without a photo', () => {
  it('stands in with the one Avatar and the poster\'s letters on the row; the profile sheet keeps its own portrait', async () => {
    await render();
    const [row] = photos(56);
    expect(row.props).toMatchObject({ profileId: 'requester-a', initial: null });
    // ProfilePhoto draws `fallback` when there is no photo or it cannot be read; it used to draw its own 15 px glyph here.
    expect(row.props.fallback.type).toBe(Avatar);
    expect(row.props.fallback.props).toEqual({ size: 56, initials: 'AA' });
    // The sheet's 96 px portrait is not the row's: ProfilePhoto keeps its own large stand-in there.
    mockProfile.mockResolvedValue({ profilId: 'requester-a', ime: 'Ana Anić', grad: null, naslov: null, poverenje: null, biografija: null });
    await act(async () => { presentation().props.onRequesterProfile(); });
    await act(async () => { await Promise.resolve(); });
    // (Its size is the sheet's own choice, not the row's 56: the sheet's suite holds the number.)
    const portraits = tree!.root.findAll(node => node.type === ('ProfilePhoto' as React.ElementType) && node.props.size !== 56);
    expect(portraits).toHaveLength(1);
    expect(portraits[0].props).toMatchObject({ profileId: 'requester-a', initial: null, fallback: undefined });
  });

  it('draws a person, not invented letters, when the poster has no name', async () => {
    mockLoad.mockResolvedValue(detail({ narucilacIme: '' }));
    await render();
    expect(photos(56)[0].props.fallback.props).toEqual({ size: 56, initials: null });
  });

  // Review r3b (vd, should fix 4): the letters come from the copy on screen, so the last loaded copy shown after a failed
  // read keeps them beside the poster's own name instead of a drawn person.
  it('keeps the poster\'s letters on the last loaded copy while a read again fails', async () => {
    await render();
    mockLoad.mockRejectedValue(new Error('TASK_READ_FAILED'));
    await act(async () => { presentation().props.retry(); });
    await act(async () => { await Promise.resolve(); });
    expect(presentation().props).toMatchObject({ stale: true, error: true, missing: true });
    expect(photos(56)[0].props.fallback.props).toEqual({ size: 56, initials: 'AA' });
  });
});

// "Dolazi kako je dogovoreno" (the owner's pick of 8 Oct 2026): the server's own percentage for the poster, read beside the task, handed to the page only as a percentage.
// A person with too few Dogovori, a hidden figure (the default today), an answer of nothing and a read that has not come back are all nothing, and nothing is made up.
describe('how reliably the poster comes as agreed', () => {
  const trust = (patch: Record<string, unknown> = {}) => ({ profileId: 'requester-a', self: false, visibility: 'PUBLIC', completedCount: 14, agreedCount: 16, reliabilityPercent: 88,
    reliabilityState: 'AVAILABLE', reliabilityMinimum: 5, memberSince: '2026-03-01', ...patch });
  const percent = () => presentation().props.reliabilityPercent;

  it('is read for the poster of a task that has been read, and handed to the page as the percentage the server gave', async () => {
    mockTrust = trust();
    await render();
    expect(percent()).toBe(88);
    expect(mockTrustAsked).toHaveBeenCalledWith('requester-a');
    // Nothing is asked for before the task is there: the read is for the person who posted it.
    expect(mockTrustAsked.mock.calls.some(([profileId]) => profileId === null)).toBe(true);
  });

  it.each([
    ['too few Dogovori', trust({ reliabilityState: 'TOO_FEW', reliabilityPercent: null })],
    ['a hidden figure, the default today', trust({ visibility: 'OWN_ONLY', agreedCount: null, reliabilityState: 'HIDDEN', reliabilityPercent: null, memberSince: null })],
    ['an answer of nothing, or a read that failed or has not come back', null],
  ])('says nothing for %s', async (_name, answer) => {
    mockTrust = answer;
    await render();
    expect(percent()).toBeNull();
  });
});

describe('a failed report or block from the task', () => {
  const settle = async (busy: boolean, error: string | null) => { mockSafety = { onPress: jest.fn(), busy, error }; await update(); };

  it('is said under the poster once the attempt has settled, and goes when the profile sheet closes', async () => {
    mockSafety = { onPress: jest.fn(), busy: false, error: null };
    await render();
    expect(shownUnderPoster()).toBe(false);
    await settle(true, null); expect(shownUnderPoster()).toBe(false);
    await settle(false, failure); expect(shownUnderPoster()).toBe(true);
    // With the person's profile open the sheet says it itself; closed, the line does not come back on its own.
    await act(async () => { presentation().props.onRequesterProfile(); });
    expect(shownUnderPoster()).toBe(false);
    await act(async () => { presentation().props.onCloseRequesterProfile(); });
    expect(shownUnderPoster()).toBe(false);
    // A new attempt that fails the same way is said again.
    await settle(true, null); await settle(false, failure);
    expect(shownUnderPoster()).toBe(true);
  });

  it('goes when the screen comes back into focus', async () => {
    mockSafety = { onPress: jest.fn(), busy: false, error: null };
    await render(); await settle(true, null); await settle(false, failure);
    expect(shownUnderPoster()).toBe(true);
    mockFocused = false; await update(); mockFocused = true; await update();
    expect(shownUnderPoster()).toBe(false);
  });

  // Review r3b (vd, fix first 1): the entry keeps its last error, and it is gone while no task is loaded (a return after
  // five minutes, the app back from the background, "Pokušaj ponovo"). When it comes back with that old error, nothing
  // was attempted, so nothing is said.
  it('does not come back by itself when the task is read again from empty', async () => {
    mockSafety = { onPress: jest.fn(), busy: false, error: null };
    await render(); await settle(true, null); await settle(false, failure);
    expect(shownUnderPoster()).toBe(true);
    mockFocused = false; await update(); mockFocused = true; await update();
    expect(shownUnderPoster()).toBe(false);
    mockSafety = undefined; await update();
    await settle(false, failure);
    expect(shownUnderPoster()).toBe(false);
    // A real new attempt is still said.
    await settle(true, null); await settle(false, failure);
    expect(shownUnderPoster()).toBe(true);
  });

  // Review r3b (vd, fix first 1): an error from the "···" attempt is the task's; the profile opens without it, so the sheet
  // does not raise it as its own alert before anything is pressed there.
  it('is not carried into the profile when the profile opens', async () => {
    mockSafety = { onPress: jest.fn(), busy: false, error: null };
    await render(); await settle(true, null); await settle(false, failure);
    expect(presentation().props.safety.error).toBe(failure);
    await act(async () => { presentation().props.onRequesterProfile(); });
    expect(presentation().props.safety.error).toBeNull();
  });
});
