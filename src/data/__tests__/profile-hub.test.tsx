import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

// A screen test must not create a live client, even when CI supplies the app's public configuration.
const mockUnexpectedClient = jest.fn(() => { throw new Error('UNMOCKED_SCREEN_TRANSPORT'); });
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => mockUnexpectedClient() }));
// This suite checks where the face appears and which props it receives; own-photo-views tests its reader/cache.
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));

let mockAccountId = 'account-a';
let mockEmail: string | undefined = 'ana@example.rs';
let mockAccountRevision = 1;
let mockIntent: 'narucilac' | 'uskocer' = 'narucilac';
const mockPostaviUlogu = jest.fn();
const mockSignOut = jest.fn();
const mockRouter = { navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockRefresh = jest.fn(), mockWorkerProfile = jest.fn(), mockPublicProfile = jest.fn();
type Row = { ime: string | null; grad: string | null; profileId?: string; kind?: string; stanje?: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | null; vestine?: string[]; radijusKm?: number };
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
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent, postaviUlogu: (value: string) => mockPostaviUlogu(value),
  useIzvor: () => ({ mojRadnikProfil: mockWorkerProfile }) }));
jest.mock('../authClientService', () => ({ authClientService: { signOutLocal: (actor: unknown) => mockSignOut(actor) } }));
jest.mock('../ownProfileClientService', () => ({ ownProfileClientService: { read: jest.fn() } }));
jest.mock('../publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: (...args: unknown[]) => mockPublicProfile(...args) } }));
// The public profile as a sheet is tested on its own (public-profile-sheet.test.tsx); here it is a named element, so the hub is tested for when it opens it.
jest.mock('../../ui/system/PublicProfileSheet', () => ({ PublicProfileSheet: 'PublicProfileSheet' }));
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: () => mockResource }));
// What the rows "Podrška", "Blokirane osobe", "Izvoz podataka" and "Pravila i saglasnosti" say about themselves is read apart from the profile (hub-states.test.ts and
// use-hub-states.test.tsx test the mapping and the reads); here it is the value the screen is handed, so the hub is tested for the words it puts on its rows.
let mockHubStates: Record<string, unknown> = {};
jest.mock('../../ui/profile/useHubStates', () => ({ useHubStates: () => mockHubStates }));
// The version "O aplikaciji" says is the one the build records; here the build is a value the test sets.
let mockVersion: string | null = '1.4.2';
jest.mock('../../data/buildIdentity', () => ({ readBuildIdentity: () => ({ version: mockVersion }) }));
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
import { ProfilePhoto } from '../../ui/media/ContextPhotos';

let tree: ReactTestRenderer;
async function render() { await act(async () => { tree = create(<Profil />); }); }
const press = (label: string) => tree.root.findByProps({ accessibilityLabel: label }).props.onPress();
const logoutRow = () => tree.root.findAll(node => String(node.type) === 'Press' && ['Odjavi se', 'Sačekaj…'].includes(node.props.accessibilityLabel))[0];
const logout = () => logoutRow().props.onPress();
/** The pin beside the place under the name (16 px); the rows draw theirs at 32. */
const placePins = () => tree.root.findAll(node => node.props?.kind === 'pin' && node.props?.size === 16);
const visibleText = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');

beforeEach(() => {
  jest.clearAllMocks();
  mockAccountId = 'account-a'; mockAccountRevision = 1; mockIntent = 'narucilac'; mockEmail = 'ana@example.rs';
  mockResource = { data: { identity, capability: null }, loading: false, error: false, refresh: mockRefresh };
  mockHubStates = {}; mockVersion = '1.4.2';
  mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
  mockRouter.canGoBack.mockReturnValue(true);
  mockSignOut.mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => { tree?.unmount(); });
  expect(mockUnexpectedClient).not.toHaveBeenCalled();
});

describe('real profile hub', () => {
  // Owner decision 1 (2026-09-19): one hub for one account. `mockIntent` stays in these tables as the
  // value the retired app mode last had; the hub must be the same hub whichever it was.
  it.each(['narucilac', 'uskocer'] as const)('keeps the existing notification entry in the one hub, whatever the app last was (%s)', async intent => {
    mockIntent = intent; await render();
    const open = tree.root.findByProps({ label: 'Obaveštenja' }).props.onPress;
    await act(async () => { open(); open(); });
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/obavestenja']]);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('offers the work profile to every account, without entering any mode first', async () => {
    mockIntent = 'narucilac'; await render();
    await act(async () => tree.root.findByProps({ label: 'Radni profil' }).props.onPress());
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/radnik']]);
  });

  // 8 Oct 2026 (owner's phone, "ista stvar na više mesta"): the area and the week live in the work profile and the plan lives in Dogovori, so the
  // profile does not repeat any of the three as a row of its own.
  it('does not repeat the area, the week or the planner: they are in the work profile and in Dogovori', async () => {
    await render();
    for (const label of ['Područje rada', 'Dostupnost', 'Raspored']) expect([label, tree.root.findAllByProps({ label })]).toEqual([label, []]);
    expect(visibleText()).not.toContain('Kalendar'); expect(tree.root.findAllByProps({ label: 'Kalendar obaveza' })).toHaveLength(0);
    expect(visibleText()).not.toContain('Dogovoreni termini');
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

  // 8 Oct 2026: the one line under "Radni profil" is its state, its first skill (and how many more) and its area, and nothing that explains itself.
  const detail = () => tree.root.findByProps({ label: 'Radni profil' }).props.detail;
  it('says in one line whether tasks can be offered to me: not set up, a draft, active, suspended', async () => {
    // The not-set-up copy lost its grammatical gender ("nisi podesio", 2026-09-23); what it says is unchanged.
    await render(); expect(detail()).toBe('Još nije podešen'); expect(visibleText()).not.toContain('podesio');
    for (const [stanje, copy] of [['DRAFT', 'Nacrt · Novi Sad'], ['ACTIVE', 'Aktivan · Novi Sad'], ['SUSPENDED', 'Suspendovan. Obrati se podršci.']] as const) {
      mockResource = { ...mockResource, data: { identity, capability: { ime: 'Ana', grad: 'Novi Sad', stanje } } };
      await act(async () => tree.update(<Profil />)); expect(detail()).toBe(copy);
    }
  });

  it('names the skills and the area in that line: the first skill and how many more, the city and its radius', async () => {
    mockResource.data = { identity, capability: { ime: 'Ana', grad: 'Novi sad', stanje: 'ACTIVE', vestine: ['Moleraj', 'Keramika', 'Parket'], radijusKm: 100 } };
    await render();
    expect(detail()).toBe('Aktivan · Moleraj +2 · Novi Sad, 100 km');
    mockResource = { ...mockResource, data: { identity, capability: { ime: 'Ana', grad: '  ', stanje: 'DRAFT', vestine: [], radijusKm: 20 } } };
    await act(async () => tree.update(<Profil />));
    expect(detail()).toBe('Nacrt');
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
  // T4a (2026-10-07): the one control opens more than the name. 8 Oct 2026 (the approved draft of the product, P1): it is named after the screen it opens,
  // "Lični podaci", because the name is changed there and nowhere else ("jedno ime za sve").
  it('edits the profile through its one control, with no second edit control beside it', async () => {
    await render();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Uredi ime na profilu' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ label: 'Izmeni ime' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ label: 'Izmeni profil' })).toHaveLength(0);
    const pencil = tree.root.findByProps({ label: 'Lični podaci' });
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
    expect(detail()).toBe('Aktivan · Novi Sad');
    mockResource = { ...mockResource, data: { identity: { ime: 'Ana', grad: 'Sremska Kamenica' }, capability: { ime: 'Ana', grad: 'Beograd - Zemun', stanje: 'ACTIVE' } } };
    await act(async () => tree.update(<Profil />));
    expect(visibleText()).toContain('Sremska Kamenica');
    expect(detail()).toBe('Aktivan · Beograd - Zemun');
  });

  // The owner's phone, 8 Oct 2026: the header said "Novi Sad" and the rows under it "Novi sad" (the work area's city was typed with a small "s").
  it('shows "Novi sad" typed with a small "s" as "Novi Sad" in the header and in the work profile line alike', async () => {
    mockResource.data = { identity: { ime: 'Ana', grad: 'Novi sad' }, capability: { ime: 'Ana', grad: 'Novi sad', stanje: 'ACTIVE' } };
    await render();
    expect(visibleText()).toContain('Novi Sad'); expect(visibleText()).not.toContain('Novi sad');
    expect(detail()).toBe('Aktivan · Novi Sad');
  });

  // 8 Oct 2026 ("Lice i tri broja"): the face stands OVER the name, centred, whatever the window and the text size; nothing stacks differently.
  it.each([
    ['a phone of 390 dp', 390, 1],
    ['a phone of 360 dp at the owner\'s text size (1.15)', 360, 1.15],
    ['a phone of 320 dp', 320, 1],
    ['Android Large text (1.2999999523)', 390, 1.2999999523],
  ])('lays the identity out as one centred column for %s', async (_name, width, fontScale) => {
    mockWindow = { width, height: 844, scale: 3, fontScale };
    await render();
    const { StyleSheet } = jest.requireActual('react-native');
    const style = StyleSheet.flatten(tree.root.findByProps({ testID: 'profile-identity' }).props.style);
    expect(style.alignItems).toBe('center');
    expect(style.flexDirection).toBeUndefined();
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
    expect(detail()).toBeUndefined();
    expect(visibleText()).not.toContain('Aktivan'); expect(visibleText()).not.toContain('Nacrt'); expect(visibleText()).not.toContain('Još nije podešen');
  });

  it('says nothing under the work profile while the read runs or failed: there is nothing true to say yet', async () => {
    mockResource = { ...mockResource, data: null, loading: true };
    await render(); expect(detail()).toBeUndefined();
    mockResource = { ...mockResource, loading: false, error: true };
    await act(async () => tree.update(<Profil />)); expect(detail()).toBeUndefined();
  });

  // Round 5c: the name is never cut (it used to stop at three lines, so a name over ~42 letters ended in "…"); it wraps, centred under the face.
  it('never cuts a long name: it wraps, centred under the face, at an ordinary and at a large text size', async () => {
    mockResource.data = { identity: { ime: 'Aleksandra Stefanović-Radosavljević', grad: 'Novi Sad' }, capability: null };
    await render();
    const { StyleSheet } = jest.requireActual('react-native');
    const align = () => StyleSheet.flatten(tree.root.findByProps({ testID: 'profile-identity' }).props.style).alignItems;
    const name = () => tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header'
      && node.children.includes('Aleksandra Stefanović-Radosavljević'))[0];
    expect(align()).toBe('center');
    expect(name().props.numberOfLines).toBeUndefined();
    expect(name().props.variant).toBe('pageTitle');
    expect(StyleSheet.flatten(name().props.style).textAlign).toBe('center');
    await act(async () => { tree.unmount(); });
    mockWindow = { ...mockWindow, fontScale: 1.3 };
    await render();
    expect(align()).toBe('center');
    expect(name().props.numberOfLines).toBeUndefined();
  });

  // The name has the room at the owner's own text size (1.15) and at 1.2: the face stays over it, the name is centred and is not cut.
  it('keeps a 21-letter name centred under the face at 1.0, 1.15 and 1.2', async () => {
    mockResource.data = { identity: { ime: 'Milica Jovanović-Ilić', grad: 'Novi Sad' }, capability: null };
    const { StyleSheet } = jest.requireActual('react-native');
    const align = () => StyleSheet.flatten(tree.root.findByProps({ testID: 'profile-identity' }).props.style).alignItems;
    for (const fontScale of [1, 1.15, 1.2]) {
      mockWindow = { ...mockWindow, fontScale };
      await render();
      expect(align()).toBe('center');
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

// UI/UX pass 2026-10-08 (F6, composition spec 4.14): the profile is one calm list of named sections, with the identity as a face
// over the name instead of a card, and every way onward a row of the one kind. The owner's phone the same day: "Uskakanje" holds only the
// work profile, "Nalog" the sign-in and what belongs to the account, "Pomoć" support and the bug report, "Privatnost" what is public and kept;
// nothing is said twice (the approved draft of the product, P1).
describe('the profile composed as one calm list', () => {
  const headers = () => tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header').map(node => node.children.join(''));
  const SECTIONS = ['Uskakanje', 'Nalog', 'Pomoć', 'Privatnost'];
  /** The position of a node in the order the screen draws things from the top. */
  const order = (predicate: (node: ReactTestInstance) => boolean) => tree.root.findAll(() => true).findIndex(predicate);
  const heading = (title: string) => order(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header' && node.children.join('') === title);

  it('names four sections, in the order a person needs them: jumping in, the account, help, privacy', async () => {
    await render();
    expect(headers().filter(title => SECTIONS.includes(title))).toEqual(SECTIONS);
  });

  // The approved draft, P1: what stands in each section, row by row, in the order it is drawn.
  it('puts in each section exactly the rows of the approved draft, and "O aplikaciji" alone after them', async () => {
    mockResource.data = { identity: { ...identity, profileId: 'profile-r', kind: 'REQUESTER' }, capability: null };
    await render();
    const rows = tree.root.findAll(node => typeof node.props.label === 'string' && (typeof node.props.onPress === 'function' || node.props.value !== undefined))
      .map(node => node.props.label as string);
    const unique = rows.filter((label, at) => rows.indexOf(label) === at);
    expect(unique.filter(label => ['Kako te drugi vide', 'Radni profil', 'E-pošta', 'Obaveštenja', 'Promeni lozinku', 'Podrška', 'Prijavi grešku',
      'Privatnost i podaci', 'Blokirane osobe', 'Izvoz podataka', 'Pravila i saglasnosti', 'O aplikaciji'].includes(label))).toEqual([
      'Kako te drugi vide', 'Radni profil', 'E-pošta', 'Obaveštenja', 'Promeni lozinku', 'Podrška', 'Prijavi grešku',
      'Privatnost i podaci', 'Blokirane osobe', 'Izvoz podataka', 'Pravila i saglasnosti', 'O aplikaciji']);
    // "Kako te drugi vide" belongs to the person, not to a setting: it stands under the figures, before the first section.
    expect(heading('Uskakanje')).toBeGreaterThan(order(node => node.props.label === 'Kako te drugi vide'));
    expect(order(node => node.props.label === 'Kako te drugi vide')).toBeGreaterThan(order(node => node.props.testID === 'profile-figures'));
    // The sections are each other's neighbours in the draft's order.
    const at = (label: string) => order(node => node.props.label === label && (typeof node.props.onPress === 'function' || node.props.value !== undefined));
    expect(heading('Nalog')).toBeLessThan(at('E-pošta')); expect(at('Promeni lozinku')).toBeLessThan(heading('Pomoć'));
    expect(heading('Pomoć')).toBeLessThan(at('Podrška')); expect(at('Prijavi grešku')).toBeLessThan(heading('Privatnost'));
    expect(heading('Privatnost')).toBeLessThan(at('Privatnost i podaci')); expect(at('Pravila i saglasnosti')).toBeLessThan(at('O aplikaciji'));
    expect(headers()).not.toContain('O aplikaciji');
  });

  it('puts the three figures, the rating, finished and reliability, in one row under the name and before the sections, for an account with a work profile', async () => {
    mockResource.data = { identity: { ...identity, profileId: 'profile-r' }, capability: { ime: 'Ana', grad: 'Novi Sad', stanje: 'ACTIVE', profileId: 'profile-w' } };
    await render();
    const name = order(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header' && node.children.includes('Ana Petrović'));
    const rating = order(node => String(node.type) === 'AccountReputation');
    const finished = order(node => String(node.type) === 'ProfileWorkSummary');
    const stats = order(node => String(node.type) === 'ProfileStats');
    expect(rating).toBeGreaterThan(-1); expect(finished).toBeGreaterThan(-1); expect(stats).toBeGreaterThan(-1);
    expect(name).toBeLessThan(rating);
    expect(rating).toBeLessThan(finished); expect(finished).toBeLessThan(stats);
    expect(stats).toBeLessThan(heading('Uskakanje'));
    expect(heading('Uskakanje')).toBeLessThan(heading('Nalog'));
    expect(heading('Nalog')).toBeLessThan(heading('Privatnost'));
    const row = tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'profile-figures')[0];
    const { StyleSheet } = jest.requireActual('react-native');
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
    expect(row.findAll(node => ['AccountReputation', 'ProfileWorkSummary', 'ProfileStats'].includes(String(node.type))).map(node => String(node.type)))
      .toEqual(['AccountReputation', 'ProfileWorkSummary', 'ProfileStats']);
  });

  it('draws no section "Završeni Dogovori" and no section "Moja statistika" any more: the figures replace them', async () => {
    mockResource.data = { identity: { ...identity, profileId: 'profile-r' }, capability: { ime: 'Ana', grad: 'Novi Sad', stanje: 'ACTIVE', profileId: 'profile-w' } };
    await render();
    expect(headers()).not.toContain('Završeni Dogovori'); expect(headers()).not.toContain('Moja statistika');
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

  // The sign-in is said ONCE, as a quiet row of "Nalog" (a label and its value, no arrow, no press); "Promeni lozinku" says nothing under it.
  it('says the e-mail once, as a quiet row of the account, opens "Promeni lozinku" once, and draws no e-mail row when the account has none', async () => {
    await render();
    const row = () => tree.root.findByProps({ label: 'Promeni lozinku' });
    const email = () => tree.root.findAll(node => node.props.label === 'E-pošta' && node.props.value !== undefined);
    expect(email().map(node => node.props.value)).toEqual(['ana@example.rs']);
    expect(email()[0].props.onPress).toBeUndefined();
    expect(row().props.detail).toBeUndefined();
    await act(async () => { row().props.onPress(); row().props.onPress(); });
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/lozinka']]);
    await act(async () => { tree.unmount(); });
    mockEmail = undefined;
    await render();
    expect(email()).toHaveLength(0);
  });

  it('offers "Prijavi grešku" beside "Podrška", in the section "Pomoć", with no sentence under it', async () => {
    await render();
    expect(tree.root.findAllByProps({ label: 'Prijavi grešku u aplikaciji' })).toHaveLength(0);
    const row = tree.root.findByProps({ label: 'Prijavi grešku' });
    expect(row.props.detail).toBeUndefined();
    expect(visibleText()).not.toContain('upisuje sama');
    await act(async () => row.props.onPress());
    expect(mockRouter.navigate.mock.calls).toEqual([['/profil/prijava-greske']]);
    const labels = tree.root.findAll(node => typeof node.props.label === 'string' && typeof node.props.onPress === 'function').map(node => node.props.label);
    expect(labels.indexOf('Podrška')).toBeLessThan(labels.indexOf('Prijavi grešku'));
    expect(labels.indexOf('Prijavi grešku')).toBeLessThan(labels.indexOf('O aplikaciji'));
  });

  // The approved draft, P1: "Podrška (broj otvorenih)", "Blokirane osobe (Nema / 2)", "Izvoz podataka (Nije tražen)", "Pravila i saglasnosti (Još nisu objavljena)",
  // "O aplikaciji (Verzija 1.0.0)". A state that could not be read has no word, and no row says "nije dostupno" in its place (J4).
  describe('the state some rows say about themselves', () => {
    const value = (label: string) => tree.root.findByProps({ label }).props.value;
    it('says, from what the app read, how many requests are open, how many people are blocked, where the export is and what the rules are', async () => {
      mockHubStates = { support: 2, blocked: { count: 3, more: false }, exportPhase: 'READY_AVAILABLE', legal: 'PENDING' };
      await render();
      expect(value('Podrška')).toBe('2 otvorena zahteva');
      expect(value('Blokirane osobe')).toBe('3');
      expect(value('Izvoz podataka')).toBe('Spreman');
      expect(value('Pravila i saglasnosti')).toBe('Čekaju tvoju saglasnost');
      expect(value('O aplikaciji')).toBe('Verzija 1.4.2');
    });

    it('says "Nema" for nobody blocked, "Nije tražen" for an export nobody asked for, and the rules that are not published yet, and nothing for no open request', async () => {
      mockHubStates = { support: 0, blocked: { count: 0, more: false }, exportPhase: 'NONE', legal: 'UNPUBLISHED' };
      await render();
      expect(value('Podrška')).toBeUndefined();
      expect(value('Blokirane osobe')).toBe('Nema'); expect(value('Izvoz podataka')).toBe('Nije tražen'); expect(value('Pravila i saglasnosti')).toBe('Još nisu objavljena');
    });

    it('says a count with its Serbian shape, and "50+" when another page of the blocked follows', async () => {
      mockHubStates = { support: 1, blocked: { count: 50, more: true } };
      await render();
      expect(value('Podrška')).toBe('1 otvoren zahtev'); expect(value('Blokirane osobe')).toBe('50+');
      mockHubStates = { support: 5, blocked: { count: 1, more: false } };
      await act(async () => tree.update(<Profil />));
      expect(value('Podrška')).toBe('5 otvorenih zahteva'); expect(value('Blokirane osobe')).toBe('1');
    });

    it('says nothing on a row whose state could not be read, and invents no "nije dostupno" in its place', async () => {
      mockHubStates = {}; mockVersion = null;
      await render();
      for (const label of ['Podrška', 'Blokirane osobe', 'Izvoz podataka', 'Pravila i saglasnosti', 'O aplikaciji']) expect([label, value(label)]).toEqual([label, undefined]);
      expect(visibleText()).not.toMatch(/nije dostupn/i);
    });

    it('opens each of those rows once, whatever it says', async () => {
      mockHubStates = { support: 2, blocked: { count: 1, more: false }, exportPhase: 'PROCESSING', legal: 'ACCEPTED' };
      await render();
      const open = tree.root.findByProps({ label: 'Blokirane osobe' }).props.onPress;
      await act(async () => { open(); open(); });
      expect(mockRouter.navigate.mock.calls).toEqual([['/profil/blokirani']]);
    });
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

  // The owner's phone: the privacy rows had grey pictures and the password had a green one, "dve različite brave". Every row has the same kind of
  // picture, and each of the eleven rows has its own, so the lock is the password's and nothing else's.
  it('draws every row with its own picture in the same colour: no grey set, and one lock on the whole screen', async () => {
    await render();
    const labels = ['Radni profil', 'Kako te drugi vide', 'Obaveštenja', 'Promeni lozinku', 'Podrška', 'Prijavi grešku', 'O aplikaciji',
      'Privatnost i podaci', 'Blokirane osobe', 'Izvoz podataka', 'Pravila i saglasnosti'];
    mockResource.data = { identity: { ...identity, profileId: 'profile-r', kind: 'REQUESTER' }, capability: null };
    await act(async () => tree.update(<Profil />));
    const kinds = labels.map(label => {
      const row = tree.root.findByProps({ label });
      expect([label, row.props.tone]).toEqual([label, undefined]);
      return (row.props.icon as { props: { kind: string } }).props.kind;
    });
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds.filter(kind => kind === 'lock')).toEqual(['lock']);
    expect(kinds[labels.indexOf('Promeni lozinku')]).toBe('lock');
  });

  it('ends with the red "Odjavi se" as a command across the whole width (no arrow: it opens nothing), which waits while a row is opening', async () => {
    await render();
    const { StyleSheet } = jest.requireActual('react-native');
    expect(logoutRow().props.accessibilityLabel).toBe('Odjavi se');
    expect(logoutRow().findAll(node => node.props.name === 'caret-right')).toHaveLength(0);
    expect(StyleSheet.flatten(logoutRow().props.style).alignSelf).toBe('stretch');
    const word = logoutRow().findAll(node => String(node.type) === 'T')[0];
    expect(StyleSheet.flatten(word.props.style).textAlign).toBe('center');
    await act(async () => tree.root.findByProps({ label: 'Izvoz podataka' }).props.onPress());
    expect(logoutRow().props.accessibilityLabel).toBe('Sačekaj…');
    expect(logoutRow().props.disabled).toBe(true);
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

  it('draws the identity without a card: the face, the name at 28 and the city as a note in one centred block, the rating being the first figure outside it', async () => {
    await render();
    const identityBlock = tree.root.findByProps({ testID: 'profile-identity' });
    const name = identityBlock.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header')[0];
    expect(name.props.variant).toBe('pageTitle');
    expect(identityBlock.findAll(node => String(node.type) === 'T' && node.props.variant === 'note' && node.children.includes('Novi Sad'))).toHaveLength(1);
    expect(identityBlock.findAll(node => String(node.type) === 'AccountReputation')).toHaveLength(0);
    const figures = tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'profile-figures')[0];
    expect(figures.findAll(node => String(node.type) === 'AccountReputation')).toHaveLength(1);
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

// "Kako te drugi vide" (Airbnb's standard, 8 Oct 2026): the person's own public profile, as the same sheet everyone else is shown, opened only by a press.
describe('"Kako te drugi vide"', () => {
  const sheet = () => tree.root.findAll(node => String(node.type) === 'PublicProfileSheet')[0];
  const row = () => tree.root.findAllByProps({ label: 'Kako te drugi vide' })[0];
  const ownRow = (patch: Partial<Row> = {}): Row => ({ ime: 'Ana Petrović', grad: 'Novi Sad', profileId: 'profile-r', kind: 'REQUESTER', ...patch });
  const publicProfile = (profilId: string) => ({ profilId, uloga: 'narucilac', ime: 'Ana Petrović', avatarPutanja: null, grad: 'Novi Sad', naslov: null, biografija: null,
    poverenje: { ocenaProsek: null, brojRecenzija: 0, zavrseniBroj: 0, identitetVerifikovan: false, ocenaDostupna: false, recenzijeDostupne: true, verifikacijaIdentitetaDostupna: true } });

  it('is a row of the account once the profile is read and there is a profile to open, and not before', async () => {
    mockResource.data = { identity: ownRow(), capability: null };
    await render(); expect(row()).toBeTruthy();
    mockResource = { ...mockResource, data: { identity: { ime: 'Ana Petrović', grad: 'Novi Sad' }, capability: null } };
    await act(async () => tree.update(<Profil />)); expect(row()).toBeUndefined();
    mockResource = { ...mockResource, data: { identity: ownRow(), capability: null }, loading: true };
    await act(async () => tree.update(<Profil />)); expect(row()).toBeUndefined();
  });

  it('opens the sheet at once, reads the public profile of the person once, and shows it when it arrives', async () => {
    mockResource.data = { identity: ownRow(), capability: null };
    mockPublicProfile.mockResolvedValue(publicProfile('profile-r'));
    await render(); expect(sheet()).toBeUndefined();
    await act(async () => { row().props.onPress(); });
    expect(mockPublicProfile).toHaveBeenCalledTimes(1); expect(mockPublicProfile.mock.calls[0][0]).toBe('profile-r');
    expect(sheet().props.state.loading).toBe(false); expect(sheet().props.state.data.profilId).toBe('profile-r');
    // It is a sheet over the screen, not a way onward: nothing else on the hub is opened, and the hub stays usable under it.
    expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(logoutRow().props.disabled).not.toBe(true);
    await act(async () => { sheet().props.onClose(); });
    expect(sheet()).toBeUndefined();
  });

  it('reads the work profile of an account whose work profile is active, because that is the person others look at', async () => {
    mockResource.data = { identity: ownRow(), capability: { ime: 'Ana', grad: 'Novi Sad', stanje: 'ACTIVE', profileId: 'profile-w' } };
    mockPublicProfile.mockResolvedValue(publicProfile('profile-w'));
    await render(); await act(async () => { row().props.onPress(); });
    expect(mockPublicProfile.mock.calls[0][0]).toBe('profile-w');
    await act(async () => { sheet().props.onClose(); });
    mockResource = { ...mockResource, data: { identity: ownRow(), capability: { ime: 'Ana', grad: 'Novi Sad', stanje: 'DRAFT', profileId: 'profile-w' } } };
    mockPublicProfile.mockResolvedValue(publicProfile('profile-r'));
    await act(async () => tree.update(<Profil />)); await act(async () => { row().props.onPress(); });
    expect(mockPublicProfile.mock.calls[1][0]).toBe('profile-r');
  });

  it('says a profile that could not be read as an unavailable one, and ignores an answer that arrives after the sheet was closed', async () => {
    mockResource.data = { identity: ownRow(), capability: null };
    mockPublicProfile.mockRejectedValueOnce(new Error('transport'));
    await render(); await act(async () => { row().props.onPress(); });
    expect(sheet().props.state).toEqual({ loading: false, data: null });
    await act(async () => { sheet().props.onClose(); });
    let answer!: (value: unknown) => void;
    mockPublicProfile.mockReturnValueOnce(new Promise(done => { answer = done; }));
    await act(async () => { row().props.onPress(); });
    expect(sheet().props.state.loading).toBe(true);
    await act(async () => { sheet().props.onClose(); });
    await act(async () => { answer(publicProfile('profile-r')); });
    expect(sheet()).toBeUndefined();
  });

  it('does not open for a press kept from another account', async () => {
    mockResource.data = { identity: ownRow(), capability: null };
    await render(); const open = row().props.onPress;
    mockAccountId = 'account-b'; mockAccountRevision = 2;
    await act(async () => { open(); });
    expect(mockPublicProfile).not.toHaveBeenCalled(); expect(sheet()).toBeUndefined();
  });

  // The face on the hub and the face in the sheet are the person's own, so the app remembers them in memory (ownPhotoCache): coming back to the profile
  // draws the photograph at once instead of the letters that stand in for it while it is read.
  it("draws the person's own photograph, on the hub and in the sheet, as one to be remembered", async () => {
    mockResource.data = { identity: ownRow(), capability: null };
    mockPublicProfile.mockResolvedValue(publicProfile('profile-r'));
    await render();
    expect(tree.root.findByType(ProfilePhoto).props).toMatchObject({ profileId: 'profile-r', own: true });
    await act(async () => { row().props.onPress(); });
    expect(sheet().props.photo('profile-r', 96).props).toMatchObject({ profileId: 'profile-r', size: 96, own: true });
  });
});
