import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

let mockAccountId = 'account-a';
let mockEmail: string | undefined = 'ana@example.rs';
let mockAccountRevision = 1;
let mockIntent: 'narucilac' | 'uskocer' = 'narucilac';
const mockPostaviUlogu = jest.fn();
const mockSignOut = jest.fn();
const mockRouter = { navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockRefresh = jest.fn();
type Row = { ime: string | null; grad: string | null; profileId?: string; stanje?: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | null };
const identity: Row = { ime: 'Ana Petrović', grad: 'Novi Sad' };
let mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
let mockResource = { data: { identity, capability: null } as { identity: Row | null; capability: Row | null } | null,
  loading: false, error: false, refresh: mockRefresh };

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => mockWindow;
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccountId, email: mockEmail }, accountRevision: mockAccountRevision }),
  sesijaSada: () => ({ user: { id: mockAccountId }, accountRevision: mockAccountRevision }) }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent, postaviUlogu: (value: string) => mockPostaviUlogu(value) }));
jest.mock('../authClientService', () => ({ authClientService: { signOutLocal: (actor: unknown) => mockSignOut(actor) } }));
jest.mock('../ownProfileClientService', () => ({ ownProfileClientService: { read: jest.fn() } }));
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: () => mockResource }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
// The reputation reads its own resource; here it is a named element, so the hub is tested for where it places it and the
// line itself is tested directly in review-screen.test.tsx (review of step 9, 2026-09-24).
jest.mock('../../ui/reviews/AccountReputation', () => ({ AccountReputation: 'AccountReputation' }));
// "Moja statistika" reads its own resource (tested in profile-stats.test.tsx); here it is a named element, so the hub is tested for where it places it.
jest.mock('../../ui/profile/ProfileStats', () => ({ ProfileStats: 'ProfileStats' }));
// "Završeni Dogovori" reads its own resource (tested in profile-work-summary.test.tsx); here it is a named element with its way in.
jest.mock('../../ui/profile/ProfileWorkSummary', () => ({ ProfileWorkSummary: 'ProfileWorkSummary' }));

import Profil from '../../app/(app)/profil';
import { ProfileHub, type ProfileHubIdentity } from '../../ui/profile/ProfileHubPresentation';

let tree: ReactTestRenderer;
async function render() { await act(async () => { tree = create(<Profil />); }); }
const press = (label: string) => tree.root.findByProps({ accessibilityLabel: label }).props.onPress();
const logoutRow = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.testID === 'profile-logout')[0];
const logout = () => logoutRow().props.onPress();
/** The pin beside the place under the name (16 px); the rows draw theirs at 32. */
const placePins = () => tree.root.findAll(node => node.props?.kind === 'pin' && node.props?.size === 16);
const visibleText = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');

beforeEach(() => {
  jest.clearAllMocks();
  mockAccountId = 'account-a'; mockAccountRevision = 1; mockIntent = 'narucilac'; mockEmail = 'ana@example.rs';
  mockResource = { data: { identity, capability: null }, loading: false, error: false, refresh: mockRefresh };
  mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
  mockRouter.canGoBack.mockReturnValue(true);
  mockSignOut.mockResolvedValue(undefined);
});
afterEach(async () => { await act(async () => { tree?.unmount(); }); });

describe('real profile hub', () => {
  // Owner decision 1 (2026-09-19): one hub for one account. `mockIntent` stays in these tables as the
  // value the retired app mode last had; the hub must be the same hub whichever it was.
  it.each(['narucilac', 'uskocer'] as const)('keeps the existing notification entry in the one hub, whatever the app last was (%s)', async intent => {
    mockIntent = intent; await render();
    const open = tree.root.findByProps({ label: 'Podešavanja obaveštenja' }).props.onPress;
    await act(async () => { open(); open(); });
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/obavestenja']]);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  // T4a (2026-10-07): the planner is "Raspored" everywhere (the owner's answer to decision 3), also on the profile.
  it.each([['Radni profil', '/profil/radnik'], ['Područje rada', '/profil/lokacija'], ['Dostupnost', '/profil/dostupnost'], ['Raspored', '/raspored']])
    ('offers %s to every account, without entering any mode first', async (label, route) => {
      mockIntent = 'narucilac'; await render();
      await act(async () => tree.root.findByProps({ label }).props.onPress());
      expect(mockRouter.navigate.mock.calls).toEqual([[route]]);
    });

  it('calls the planner "Raspored" with its sentence "Dogovoreni termini", and no longer "Kalendar obaveza"', async () => {
    await render();
    const row = tree.root.findByProps({ label: 'Raspored' });
    expect(row.props.detail).toBe('Dogovoreni termini');
    expect(visibleText()).not.toContain('Kalendar'); expect(tree.root.findAllByProps({ label: 'Kalendar obaveza' })).toHaveLength(0);
  });

  it.each(['narucilac', 'uskocer'] as const)('opens privacy once, whatever the app last was (%s)', async intent => {
    mockIntent = intent;
    await render();
    const open = tree.root.findByProps({ label: 'Privatnost i podaci' }).props.onPress;
    await act(async () => { open(); open(); });
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/privatnost']]);
  });

  it.each(['narucilac', 'uskocer'] as const)('opens export once, whatever the app last was (%s)', async intent => {
    mockIntent = intent;
    await render();
    const open = tree.root.findByProps({ label: 'Izvoz podataka' }).props.onPress;
    await act(async () => { open(); open(); });
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/izvoz']]);
  });

  it('retires the captured export entry across an account incarnation change', async () => {
    await render();
    const open = tree.root.findByProps({ label: 'Izvoz podataka' }).props.onPress;
    mockAccountId = 'account-b'; mockAccountRevision = 2;
    mockAccountId = 'account-a'; mockAccountRevision = 3;
    await act(async () => open());
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('shows actual identity with no fabricated reputation or dead feature rows', async () => {
    await render();
    const rendered = visibleText();
    expect(rendered).toContain('Ana Petrović'); expect(rendered).toContain('Novi Sad');
    // 'Podešavanja' alone was in this list as a dead row; the hub now has a real row named
    // 'Podešavanja obaveštenja', so the guard names what it was actually guarding.
    for (const fake of ['Miloš', 'MŠ', '4,9', '18 recenzija', 'Javni profil']) expect(rendered).not.toContain(fake);
  });

  it('keeps missing identity distinct from loading and failed reads', async () => {
    mockResource.data = { identity: null, capability: null };
    await render();
    expect(visibleText()).toContain('Ime još nije uneto');
    mockResource = { ...mockResource, error: true };
    await act(async () => tree.update(<Profil />));
    expect(visibleText()).not.toContain('Ime još nije uneto');
    await act(async () => tree.root.findByProps({ label: 'Pokušaj ponovo' }).props.onPress());
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    mockResource = { ...mockResource, error: false, loading: true };
    await act(async () => tree.update(<Profil />));
    expect(visibleText()).toContain('Učitavamo profil');
  });

  it.each(['ready', 'error'] as const)('replaces loading accessibility semantics with a fresh %s host while keeping its controls reachable', async state => {
    const openPhoto = jest.fn(), retry = jest.fn();
    const show = (value: ProfileHubIdentity) => <ProfileHub identity={value} busy={false} open={jest.fn()}
      onBack={jest.fn()} onLogout={jest.fn()} logoutError={false} />;
    await act(async () => { tree = create(show({ state: 'loading' })); });
    const hub = tree.root;
    const loadingHost = tree.root.findByProps({ testID: 'profile-identity' });
    expect(loadingHost.props).toMatchObject({ accessible: true, accessibilityRole: 'progressbar',
      accessibilityLabel: 'Učitavamo profil', accessibilityState: { busy: true } });
    const value: ProfileHubIdentity = state === 'ready'
      ? { state: 'ready', name: 'Ana Petrović', place: 'Novi Sad', photo: <></>, photoReady: true, openPhoto, reputation: null }
      : { state: 'error', retry };
    await act(async () => tree.update(show(value)));
    expect(tree.root).toBe(hub);
    const settledHost = tree.root.findByProps({ testID: 'profile-identity' });
    expect(settledHost).not.toBe(loadingHost);
    expect(settledHost.props).toMatchObject({ accessible: false, accessibilityRole: 'none',
      accessibilityLabel: '', accessibilityState: { busy: false } });
    expect(settledHost.props.importantForAccessibility).not.toBe('no-hide-descendants');
    expect(settledHost.props.accessibilityElementsHidden).not.toBe(true);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Učitavamo profil' })).toHaveLength(0);
    if (state === 'ready') {
      const photo = settledHost.findByProps({ accessibilityLabel: 'Fotografija profila' });
      expect(photo.props).toMatchObject({ accessibilityRole: 'button', disabled: false, accessibilityState: { disabled: false } });
      expect(settledHost.findByProps({ accessibilityRole: 'header' }).props.children).toBe('Ana Petrović');
      await act(async () => photo.props.onPress());
      expect(openPhoto).toHaveBeenCalledTimes(1);
    } else {
      const button = settledHost.findByProps({ accessibilityRole: 'button', accessibilityLabel: 'Pokušaj ponovo' });
      expect(button.props.disabled).not.toBe(true);
      await act(async () => button.props.onPress());
      expect(retry).toHaveBeenCalledTimes(1);
    }
  });

  it('has no mode switch: nothing on the hub names, reads or sets one', async () => {
    await render();
    expect(tree.root.findAllByProps({ accessibilityRole: 'tablist' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Pređi na JA MOGU' })).toHaveLength(0);
    expect(visibleText()).not.toMatch(/JA MOGU|MENI TREBA/);
    expect(mockPostaviUlogu).not.toHaveBeenCalled();
  });

  it('says in every state whether tasks can be offered to me: not set up, a draft, active, suspended', async () => {
    // The not-set-up copy lost its grammatical gender ("nisi podesio", 2026-09-23); what it says is unchanged.
    await render(); expect(visibleText()).toContain('Radni profil još nije podešen.'); expect(visibleText()).not.toContain('podesio');
    for (const [stanje, copy] of [['DRAFT', 'Profil je nacrt'], ['ACTIVE', 'Profil je aktivan'], ['SUSPENDED', 'Radni profil je suspendovan. Obrati se podršci.']] as const) {
      mockResource = { ...mockResource, data: { identity, capability: { ime: 'Ana', grad: 'Novi Sad', stanje } } };
      await act(async () => tree.update(<Profil />)); expect(visibleText()).toContain(copy);
    }
  });

  it('opens the capability editor from the one hub, and with no history Back goes to Početna', async () => {
    await render();
    await act(async () => tree.root.findByProps({ label: 'Radni profil' }).props.onPress());
    expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/radnik');
    await act(async () => tree.unmount());
    mockRouter.canGoBack.mockReturnValue(false);
    await render();
    await act(async () => press('Nazad'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('does not let a stale press act on a newly signed-in account', async () => {
    await render();
    mockAccountId = 'account-b';
    await act(async () => { tree.root.findByProps({ label: 'Izvoz podataka' }).props.onPress(); logout(); });
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('returns to the actual source when navigation history is available', async () => {
    await render();
    await act(async () => press('Nazad'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('makes a failed local logout retryable without exposing the transport error', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('secret transport detail'));
    await render();
    await act(async () => logout());
    expect(visibleText()).toContain('Odjava nije uspela. Pokušaj ponovo.');
    expect(visibleText()).not.toContain('secret transport detail');
    await act(async () => logout());
    expect(mockSignOut).toHaveBeenCalledTimes(2);
    expect(visibleText()).not.toContain('Odjava nije uspela');
  });

  it('serializes local logout and ignores late failure after account changes', async () => {
    let reject!: (reason: Error) => void;
    mockSignOut.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    await render();
    const onPress = logoutRow().props.onPress;
    await act(async () => { onPress(); onPress(); });
    expect(mockSignOut.mock.calls).toEqual([[{ accountId: 'account-a', accountRevision: 1 }]]);
    mockAccountId = 'account-b';
    mockAccountRevision = 2;
    await act(async () => { tree.update(<Profil />); reject(new Error('late failure')); });
    expect(visibleText()).not.toContain('Odjava nije uspela');
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('blocks an old action after batched A→B→A even before React rerenders', async () => {
    await render();
    mockAccountId = 'account-b'; mockAccountRevision = 2;
    mockAccountId = 'account-a'; mockAccountRevision = 3;
    await act(async () => { tree.root.findByProps({ label: 'Izvoz podataka' }).props.onPress(); logout(); });
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  // 2026-09-24: the "Uredi" pill opened the same screen as the "Ime na profilu" row; one control per job.
  // T4a (2026-10-07): the one control is "Izmeni profil", because the screen it opens is more than the name.
  it('edits the profile through its one control, with no second edit control beside it', async () => {
    await render();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Uredi ime na profilu' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ label: 'Izmeni ime' })).toHaveLength(0);
    const pencil = tree.root.findByProps({ label: 'Izmeni profil' });
    expect(pencil.props.hint).toBe('Otvara izmenu fotografije, imena i opisa.');
    await act(async () => pencil.props.onPress());
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/podaci']]);
  });

  // T4a (2026-10-07): sentences that mean something lead to the place they speak of.
  it('hands the rating line a way in that opens "Ocene" once, and no longer hands it the comments', async () => {
    await render();
    const line = tree.root.findAll(node => String(node.type) === 'AccountReputation')[0];
    expect(line.props.accountId).toBe('account-a');
    expect(line.props.commentsProfileId).toBeUndefined(); expect(line.props.commentPhoto).toBeUndefined();
    await act(async () => { line.props.onOpen(); line.props.onOpen(); });
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/ocene']]);
  });

  it('opens the finished Dogovori from "Završeni Dogovori", on the section that holds them, once', async () => {
    await render();
    const summary = tree.root.findAll(node => typeof node.props.onOpen === 'function' && node.props.requesterProfileId !== undefined)[0];
    await act(async () => { summary.props.onOpen(); summary.props.onOpen(); });
    expect(mockRouter.navigate.mock.calls).toEqual([[{ pathname: '/dogovori', params: { odeljak: 'istorija' } }]]);
  });

  it('one way onward at a time: while a row is opening, the rating line and the summary open nothing more', async () => {
    await render();
    const line = tree.root.findAll(node => String(node.type) === 'AccountReputation')[0];
    const summary = tree.root.findAll(node => typeof node.props.onOpen === 'function' && node.props.requesterProfileId !== undefined)[0];
    await act(async () => { tree.root.findByProps({ label: 'Izvoz podataka' }).props.onPress(); line.props.onOpen(); summary.props.onOpen(); });
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/izvoz']]);
  });

  // Nothing in the app sets the requester city, so the place falls back to the work area and is never an invitation.
  it('shows the work-area city when the requester row has none, and no place line when neither has one', async () => {
    mockResource.data = { identity: { ime: 'Ana', grad: null }, capability: { ime: 'Ana', grad: 'Novi Sad', stanje: 'ACTIVE' } };
    await render();
    expect(visibleText()).toContain('Novi Sad'); expect(visibleText()).not.toContain('Grad još nije unet'); expect(placePins().length).toBeGreaterThan(0);
    mockResource = { ...mockResource, data: { identity: { ime: 'Ana', grad: null }, capability: { ime: 'Ana', grad: null, stanje: 'ACTIVE' } } };
    await act(async () => tree.update(<Profil />));
    expect(visibleText()).not.toContain('Novi Sad'); expect(visibleText()).not.toContain('Grad još nije unet');
    expect(placePins()).toHaveLength(0);
  });

  // The owner's phone (2026-10-07): his requester profile stores "NovI SAD" and the header showed it so. A city is SHOWN as a city is written;
  // what the profile stores is not touched, and a city that is already well written is shown byte for byte.
  it('shows a city typed with odd case tidied, in the header and in the work area, and a well-written one as it is', async () => {
    mockResource.data = { identity: { ime: 'Ana', grad: 'NovI SAD' }, capability: { ime: 'Ana', grad: 'NOVI SAD', stanje: 'ACTIVE' } };
    await render();
    expect(visibleText()).toContain('Novi Sad'); expect(visibleText()).not.toContain('NovI'); expect(visibleText()).not.toContain('NOVI');
    expect(tree.root.findByProps({ label: 'Područje rada' }).props.detail).toBe('Novi Sad');
    mockResource = { ...mockResource, data: { identity: { ime: 'Ana', grad: 'Sremska Kamenica' }, capability: { ime: 'Ana', grad: 'Beograd - Zemun', stanje: 'ACTIVE' } } };
    await act(async () => tree.update(<Profil />));
    expect(visibleText()).toContain('Sremska Kamenica');
    expect(tree.root.findByProps({ label: 'Područje rada' }).props.detail).toBe('Beograd - Zemun');
  });

  // UI/UX pass 2026-10-08: the face stands BESIDE the name (row); only the layout class (a window under 340 dp, text scale 1.3) puts it over.
  it.each([
    ['a phone of 390 dp', 390, 1, 'row'],
    ['a phone of 360 dp at the owner\'s text size (1.15)', 360, 1.15, 'row'],
    ['a phone of 320 dp', 320, 1, 'column'],
    ['Android Large text (1.2999999523)', 390, 1.2999999523, 'column'],
  ])('lays the identity out for %s', async (_name, width, fontScale, direction) => {
    mockWindow = { width, height: 844, scale: 3, fontScale };
    await render();
    const { StyleSheet } = jest.requireActual('react-native');
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'profile-identity' }).props.style).flexDirection).toBe(direction);
  });

  // Review of step 9: this used to lean on the suite-wide useFocusedResource mock feeding the profile object into the real
  // reputation. The reputation is now a named element here; that it never draws a non-reputation is tested on the line itself.
  it('places the account rating under the name of a read profile, and keeps it out of a failed or loading one', async () => {
    await render();
    const ratings = () => tree.root.findAll(node => String(node.type) === 'AccountReputation');
    expect(ratings().map(node => node.props.accountId)).toEqual(['account-a']);
    mockResource = { ...mockResource, error: true };
    await act(async () => tree.update(<Profil />));
    expect(ratings()).toHaveLength(0);
    mockResource = { ...mockResource, error: false, loading: true };
    await act(async () => tree.update(<Profil />));
    expect(ratings()).toHaveLength(0);
  });

  // Review of step 9: a status the app does not know (a closed profile, a new value) read as "Profil je aktivan.".
  it('says nothing about a work profile whose state it does not know, rather than calling it active', async () => {
    mockResource.data = { identity, capability: { ime: 'Ana', grad: 'Novi Sad', stanje: null } };
    await render();
    expect(visibleText()).not.toContain('Profil je aktivan'); expect(visibleText()).not.toContain('Profil je nacrt');
    expect(visibleText()).not.toContain('Radni profil još nije podešen');
  });

  it('says the work area is not set when a work profile has none, and says nothing without a work profile', async () => {
    mockResource.data = { identity, capability: { ime: 'Ana', grad: '  ', stanje: 'DRAFT' } };
    await render();
    const detail = () => tree.root.findByProps({ label: 'Područje rada' }).props.detail;
    expect(detail()).toBe('Nije podešeno');
    mockResource = { ...mockResource, data: { identity, capability: null } };
    await act(async () => tree.update(<Profil />));
    expect(detail()).toBeUndefined();
  });

  // Round 5c: the name is never cut (it used to stop at three lines, so a name over ~42 letters ended in "…"); it wraps beside the face.
  it('never cuts a long name: it wraps beside the face, and stands under it at a large text size', async () => {
    mockResource.data = { identity: { ime: 'Aleksandra Stefanović-Radosavljević', grad: 'Novi Sad' }, capability: null };
    await render();
    const { StyleSheet } = jest.requireActual('react-native');
    const direction = () => StyleSheet.flatten(tree.root.findByProps({ testID: 'profile-identity' }).props.style).flexDirection;
    const name = () => tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header'
      && node.children.includes('Aleksandra Stefanović-Radosavljević'))[0];
    expect(direction()).toBe('row');
    expect(name().props.numberOfLines).toBeUndefined();
    expect(name().props.variant).toBe('pageTitle');
    await act(async () => { tree.unmount(); });
    mockWindow = { ...mockWindow, fontScale: 1.3 };
    await render();
    expect(direction()).toBe('column');
    expect(name().props.numberOfLines).toBeUndefined();
  });

  // The name has the room at the owner's own text size (1.15) and at 1.2: the face stays beside it, the name wraps and is not cut.
  it('keeps a 21-letter name beside the face at 1.0, 1.15 and 1.2', async () => {
    mockResource.data = { identity: { ime: 'Milica Jovanović-Ilić', grad: 'Novi Sad' }, capability: null };
    const { StyleSheet } = jest.requireActual('react-native');
    const direction = () => StyleSheet.flatten(tree.root.findByProps({ testID: 'profile-identity' }).props.style).flexDirection;
    for (const fontScale of [1, 1.15, 1.2]) {
      mockWindow = { ...mockWindow, fontScale };
      await render();
      expect(direction()).toBe('row');
      await act(async () => { tree.unmount(); });
    }
  });

  it('ignores a late logout failure after batched A→B→A and admits a fresh current action', async () => {
    let reject!: (reason: Error) => void;
    mockSignOut.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    await render();
    await act(async () => logout());
    mockAccountId = 'account-b'; mockAccountRevision = 2;
    mockAccountId = 'account-a'; mockAccountRevision = 3;
    await act(async () => reject(new Error('old logout failure')));
    expect(visibleText()).not.toContain('Odjava nije uspela');
    await act(async () => tree.update(<Profil />));
    await act(async () => logout());
    expect(mockSignOut.mock.calls.at(-1)).toEqual([{ accountId: 'account-a', accountRevision: 3 }]);
  });
});

// UI/UX pass 2026-10-08 (F6, composition spec 4.14): the profile is one calm list of three named sections, with the identity as a face
// beside the name instead of a card, and every way onward a row of the one kind.
describe('the profile composed as one calm list', () => {
  const headers = () => tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header').map(node => node.children.join(''));
  const SECTIONS = ['Kako mogu da uskočim', 'Nalog i pomoć', 'Privatnost'];
  /** The position of a node in the order the screen draws things from the top. */
  const order = (predicate: (node: ReactTestInstance) => boolean) => tree.root.findAll(() => true).findIndex(predicate);
  const heading = (title: string) => order(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header' && node.children.join('') === title);

  it('names three sections, in the order a person needs them: how I can help, my account and help, privacy', async () => {
    await render();
    expect(headers().filter(title => SECTIONS.includes(title))).toEqual(SECTIONS);
  });

  it('puts the finished Dogovori before the sections, and the statistics between the work and the account, for an account with a work profile', async () => {
    mockResource.data = { identity: { ...identity, profileId: 'profile-r' }, capability: { ime: 'Ana', grad: 'Novi Sad', stanje: 'ACTIVE', profileId: 'profile-w' } };
    await render();
    const finished = order(node => String(node.type) === 'ProfileWorkSummary');
    const stats = order(node => String(node.type) === 'ProfileStats');
    expect(finished).toBeGreaterThan(-1); expect(stats).toBeGreaterThan(-1);
    expect(finished).toBeLessThan(heading('Kako mogu da uskočim'));
    expect(heading('Kako mogu da uskočim')).toBeLessThan(stats);
    expect(stats).toBeLessThan(heading('Nalog i pomoć'));
    expect(heading('Nalog i pomoć')).toBeLessThan(heading('Privatnost'));
  });

  it('draws no statistics for an account without a work profile: there is no work to count', async () => {
    await render();
    expect(tree.root.findAll(node => String(node.type) === 'ProfileStats')).toHaveLength(0);
    mockResource = { ...mockResource, data: { identity, capability: { ime: 'Ana', grad: 'Novi Sad', stanje: 'DRAFT' } } };
    await act(async () => tree.update(<Profil />));
    expect(tree.root.findAll(node => String(node.type) === 'ProfileStats')).toHaveLength(0);
  });

  it('draws no statistics while the profile is still reading or could not be read', async () => {
    mockResource.data = { identity, capability: { ime: 'Ana', grad: 'Novi Sad', stanje: 'ACTIVE', profileId: 'profile-w' } };
    mockResource = { ...mockResource, loading: true };
    await render();
    expect(tree.root.findAll(node => String(node.type) === 'ProfileStats')).toHaveLength(0);
    mockResource = { ...mockResource, loading: false, error: true };
    await act(async () => tree.update(<Profil />));
    expect(tree.root.findAll(node => String(node.type) === 'ProfileStats')).toHaveLength(0);
  });

  it('says the email under "Promeni lozinku", opens the screen once, and says nothing under it when the account has no email', async () => {
    await render();
    const row = () => tree.root.findByProps({ label: 'Promeni lozinku' });
    expect(row().props.detail).toBe('ana@example.rs');
    await act(async () => { row().props.onPress(); row().props.onPress(); });
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/lozinka']]);
    await act(async () => { tree.unmount(); });
    mockEmail = undefined;
    await render();
    expect(row().props.detail).toBeUndefined();
  });

  it('offers "Prijavi grešku u aplikaciji" beside "Podrška", and says the version is written by itself', async () => {
    await render();
    const row = tree.root.findByProps({ label: 'Prijavi grešku u aplikaciji' });
    expect(row.props.detail).toBe('Verzija aplikacije se upisuje sama.');
    await act(async () => row.props.onPress());
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/prijava-greske']]);
    const labels = tree.root.findAll(node => typeof node.props.label === 'string' && typeof node.props.onPress === 'function').map(node => node.props.label);
    expect(labels.indexOf('Podrška')).toBeLessThan(labels.indexOf('Prijavi grešku u aplikaciji'));
    expect(labels.indexOf('Prijavi grešku u aplikaciji')).toBeLessThan(labels.indexOf('O aplikaciji'));
  });

  it('marks the work profile with a dot while something waits for the person (not set up, a draft), and not otherwise', async () => {
    const attention = () => tree.root.findByProps({ label: 'Radni profil' }).props.attention;
    await render();
    expect(attention()).toBe(true);
    for (const [stanje, waits] of [['DRAFT', true], ['ACTIVE', false], ['SUSPENDED', false]] as const) {
      mockResource = { ...mockResource, data: { identity, capability: { ime: 'Ana', grad: 'Novi Sad', stanje } } };
      await act(async () => tree.update(<Profil />));
      expect([stanje, attention()]).toEqual([stanje, waits]);
    }
    mockResource = { ...mockResource, data: null, loading: true };
    await act(async () => tree.update(<Profil />));
    expect(attention()).toBe(false);
  });

  it('keeps the needed-once rows quiet: the privacy pictures go grey', async () => {
    await render();
    for (const label of ['Privatnost i podaci', 'Blokirane osobe', 'Izvoz podataka', 'Pravila i saglasnosti']) {
      expect([label, tree.root.findByProps({ label }).props.tone]).toEqual([label, 'quiet']);
    }
    for (const label of ['Radni profil', 'Podrška', 'Promeni lozinku']) expect([label, tree.root.findByProps({ label }).props.tone]).toEqual([label, 'default']);
  });

  it('ends with the red "Odjavi se" row, a command and not a way onward (no arrow), which waits while a row is opening', async () => {
    await render();
    const list = () => tree.root.findAll(node => node.props.testID === 'profile-logout' && node.props.tone === 'danger')[0];
    expect(list().props.title).toBe('Odjavi se');
    expect(logoutRow().findAll(node => node.props.name === 'caret-right')).toHaveLength(0);
    await act(async () => tree.root.findByProps({ label: 'Izvoz podataka' }).props.onPress());
    expect(list().props.title).toBe('Sačekaj…');
    expect(list().props.disabled).toBe(true);
  });

  it('says the sign-out failed above the row, as an alert in the danger colour, and does not draw it before', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('x'));
    await render();
    expect(tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'alert')).toHaveLength(0);
    await act(async () => logout());
    const alert = tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'alert')[0];
    expect(alert.props.tone).toBe('danger');
    expect(alert.children).toEqual(['Odjava nije uspela. Pokušaj ponovo.']);
  });

  it('draws the identity without a card: the face, the name at 28, the city as a note and the rating line in one block', async () => {
    await render();
    const identityBlock = tree.root.findByProps({ testID: 'profile-identity' });
    const name = identityBlock.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header')[0];
    expect(name.props.variant).toBe('pageTitle');
    expect(identityBlock.findAll(node => String(node.type) === 'T' && node.props.variant === 'note' && node.children.includes('Novi Sad'))).toHaveLength(1);
    expect(identityBlock.findAll(node => String(node.type) === 'AccountReputation')).toHaveLength(1);
    const { StyleSheet } = jest.requireActual('react-native');
    const style = StyleSheet.flatten(identityBlock.props.style);
    for (const key of ['borderWidth', 'borderColor', 'backgroundColor', 'padding', 'shadowOpacity', 'elevation']) expect([key, style[key]]).toEqual([key, undefined]);
  });

  it('says a missing name once, as a plain muted line, and not as a second 28 px title', async () => {
    mockResource.data = { identity: { ime: null, grad: null }, capability: null };
    await render();
    const missing = tree.root.findAll(node => String(node.type) === 'T' && node.children.includes('Ime još nije uneto'))[0];
    expect(missing.props).toMatchObject({ variant: 'title', tone: 'muted' });
  });
});
