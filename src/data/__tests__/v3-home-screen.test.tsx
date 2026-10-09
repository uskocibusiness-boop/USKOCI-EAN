import React, { type ComponentProps } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let mockSession = { user: { id: A }, accountRevision: 1 };
let mockFocused = true;
let mockAppState = 'active';
const mockAppStateListeners = new Set<(state: string) => void>();
let mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
/** The zone the phone says it is in: Serbian time unless a test says otherwise (Jest itself runs in UTC). */
let mockPhoneZone: string | undefined = 'Europe/Belgrade';
const mockSource = { mojePotrebe: jest.fn(), mojePrijave: jest.fn(), mojiDogovori: jest.fn(), paznjaZaPocetnu: jest.fn() };
const mockRouter = { navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'AppState') return { get currentState() { return mockAppState; },
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockAppStateListeners.add(listener); return { remove: () => mockAppStateListeners.delete(listener) };
    } };
  if (key === 'useWindowDimensions') return () => mockWindow;
  return ['View', 'ScrollView', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: (_target, key) => key === '__esModule' ? false : String(key) }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
// The route owns this data-reading child. Its account/focus lifecycle has a dedicated real-resource suite.
jest.mock('../../ui/system/ActualUserAvatar', () => ({ ActualUserAvatar: ({ onPress }: { onPress: () => void }) =>
  require('react').createElement('Press', { accessibilityRole: 'button', accessibilityLabel: 'Moj profil', onPress }) }));
jest.mock('../../ui/entry/BrandAssets', () => ({ BrandLockup: 'BrandLockup' }));
jest.mock('../../ui/home/HomeIllustration', () => ({ HomeIllustration: 'HomeIllustration' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
// The face of the other person in the Raspored block is read by the route's own element (a data client), exactly as the
// header's avatar is; the presentation's own stand-in is the Avatar. Both are host nodes here, so their props can be read.
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar' }));
jest.mock('../../ui/home/HomeLaunchArt', () => ({ HomeLaunchArt: 'HomeLaunchArt' }));
// "Slobodan sam sada" saves through the availability client, which the route loads only when the switch is touched.
const mockAvailability = { read: jest.fn(), save: jest.fn() };
jest.mock('../workerAvailabilityClientService', () => ({ workerAvailabilityClientService: mockAvailability }));
jest.mock('../../lib/vreme', () => ({ ...jest.requireActual('../../lib/vreme'), zonaTelefona: () => mockPhoneZone }));
// The device's own memory of what was hidden ("Kako radi"): in memory here, and able to fail like a device that cannot read or write.
const mockStored = new Map<string, string>();
let mockStorageDown = false;
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: (key: string) => mockStorageDown ? Promise.reject(new Error('storage offline')) : Promise.resolve(mockStored.get(key) ?? null),
  setItem: (key: string, value: string) => mockStorageDown ? Promise.reject(new Error('storage offline')) : Promise.resolve(void mockStored.set(key, value)),
} }));
import { StyleSheet } from 'react-native';
import { HomePresentation } from '../../ui/home/HomePresentation';
import { HOW_IT_WORKS_KEY, forgetHiddenHowItWorks } from '../../ui/home/HowItWorks';
import { composeHome, type HomeSnapshot } from '../homeSnapshot';
import Pocetna from '../../app/(app)/index';

let tree: ReactTestRenderer;
const need = (id: string, patch: object = {}) => ({ id, revizija: 1, naslov: `Moj ${id}`, stanje: 'OBJAVLJENA', vremeTekst: 'sutra',
  pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, brojPrijava: 0, ...patch });
const application = (id: string) => ({ prijavaId: id, potrebaId: `n-${id}`, stanje: 'SUBMITTED', naslov: `Tuđ ${id}`,
  cena: { prikaz: '2.500 RSD' }, promenjenaPotreba: false, traziPaznju: false, dogovorId: null });
const agreement = (id: string, mine: 'narucilac' | 'uskocer') => ({ id, naslov: `Dogovor ${id}`, stanje: 'CONFIRMED', vremeTekst: 'danas', problemOtvoren: false,
  ucesnici: [{ id: A, ime: 'Ja', uloga: mine, viSte: true }, { id: B, ime: 'Jelena', uloga: mine === 'narucilac' ? 'uskocer' : 'narucilac', viSte: false }] });
const text = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const action = (label: string) => ['Objavi zadatak', 'Uskoči i zaradi'].includes(label)
  ? tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0].props
  : tree.root.findByProps({ label }).props;
const row = (start: string) => tree.root.findAll(node => String(node.type) === 'Press' && (String(node.props.accessibilityLabel).startsWith(start) || String(node.props.accessibilityLabel).includes(`. ${start}`)))[0].props;
/** The Raspored card: the one press that opens the next Dogovor (a Dogovor row of any other kind has its own hint). */
const cards = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityHint === 'Otvara Dogovor.');
const render = async () => { await act(async () => { tree = create(<Pocetna />); }); };
/** The heading of a Section: its title, in the heading type, spoken as a header. */
const heading = (name: string) => tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header' && node.props.children === name);
/** "Ceo raspored" was the action at the end of the Raspored heading; since the blueprint of 8 Oct 2026 Raspored has one door, Dogovori, so Početna draws none. */
const planner = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Ceo raspored');
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

beforeEach(() => {
  jest.clearAllMocks(); mockSession = { user: { id: A }, accountRevision: 1 }; mockFocused = true;
  mockStored.clear(); mockStorageDown = false; forgetHiddenHowItWorks();
  mockAppState = 'active'; mockAppStateListeners.clear();
  mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 }; mockPhoneZone = 'Europe/Belgrade';
  mockSource.mojePotrebe.mockResolvedValue([]); mockSource.mojePrijave.mockResolvedValue([]); mockSource.mojiDogovori.mockResolvedValue([]);
  mockSource.paznjaZaPocetnu.mockResolvedValue({ rows: [], more: 0, asOf: '2026-09-22T10:00:00Z' });
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });

it('offers both things a person can start before any read has answered, and they go where they say', async () => {
  const wait = deferred<never[]>(); mockSource.mojePotrebe.mockReturnValue(wait.promise);
  await render();
  await act(async () => action('Objavi zadatak').onPress()); expect(mockRouter.navigate).toHaveBeenCalledWith('/nova');
  await act(async () => tree.unmount()); await render();
  await act(async () => action('Uskoči i zaradi').onPress()); expect(mockRouter.navigate).toHaveBeenCalledWith('/zadaci');
  await act(async () => wait.resolve([]));
});

// Owner's information architecture, 2026-09-23: Početna is the overview. My own tasks and my applications are two
// counted front doors instead of a preview of their rows. Raspored (owner, 2026-10-07) holds a card only for a next accepted
// appointment: a Dogovor with no accepted instant has no card (an active one whose term is not confirmed is counted in one
// quiet line instead, see below), and a Dogovor whose term the list did not even say is not counted as lacking one.
it('shows both sides of one account and gives an undated active Dogovor no card, so no next appointment is invented', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman')]); mockSource.mojePrijave.mockResolvedValue([application('polica')]);
  mockSource.mojiDogovori.mockResolvedValue([agreement('g-a', 'narucilac'), agreement('g-c', 'uskocer')]);
  await render();
  const copy = text();
  expect(copy).toContain('Moji zadaci'); expect(copy).toContain('1 aktivan');
  expect(copy).toContain('Moje prijave'); expect(copy).toContain('1 čeka odgovor');
  expect(copy).not.toContain('Aktivni Dogovor'); expect(copy).not.toContain('Sledeći Dogovor'); expect(copy).not.toContain('Raspored');
  expect(copy).not.toContain('Objavio si'); expect(copy).not.toContain('Uskočio si'); expect(copy).not.toContain('Svi Dogovori');
  expect(tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith('Dogovor g-'))).toHaveLength(0);
  expect(cards()).toHaveLength(0); expect(planner()).toHaveLength(0);
});

it('names and opens the upcoming accepted appointment ahead of work awaiting completion, day first in Serbian time', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-27T10:00:00Z'));
  mockSource.mojiDogovori.mockResolvedValue([
    { ...agreement('yesterday', 'narucilac'), stanje: 'AWAITING_REQUESTER', prihvacenPocetak: '2026-09-26T08:00:00Z' },
    { ...agreement('tomorrow', 'uskocer'), prihvacenPocetak: '2026-09-28T08:00:00Z', vremeTekst: '28. sep · 10:00' },
  ]);
  await render();
  expect(text()).toContain('Sledeće'); expect(text()).not.toContain('Raspored'); expect(text()).not.toContain('Sledeći Dogovor'); expect(text()).not.toContain('Aktivni Dogovor');
  // Sunday 27 September, 12:00 in Belgrade: the 28th is tomorrow, and the accepted start alone is "od", never an invented end.
  expect(text()).toContain('Sutra · od 10:00'); expect(text()).not.toContain('28. sep · 10:00'); expect(text()).not.toContain('Dogovor yesterday');
  expect(cards()).toHaveLength(1);
  expect(cards()[0].props.accessibilityLabel).toBe('Sutra, od 10:00. Dogovor tomorrow. Jelena, Uskačeš');
  await act(async () => cards()[0].props.onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'tomorrow' } });
});

it.each([[390, 1], [320, 2]])('keeps the appointment day, task, person and role readable and separately worded at %idp / font %i', async (width, fontScale) => {
  mockWindow = { width, height: 844, scale: 3, fontScale };
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-27T10:00:00Z'));
  const title = 'Popravka police u dnevnoj sobi i postavljanje velikog ogledala';
  const person = 'Jelena Petrović · Servis';
  const source = { ...agreement('agenda', 'uskocer'), naslov: title, vremeTekst: 'Fleksibilno · tokom sledeće nedelje',
    prihvacenPocetak: '2026-09-28T12:00:00Z', tacanTermin: { pocetak: '2026-09-28T12:00:00Z', kraj: '2026-09-28T14:00:00Z' } };
  source.ucesnici[1].ime = person;
  mockSource.mojiDogovori.mockResolvedValue([source]);
  await render();
  const card = cards()[0];
  const facts = card.findAll(node => String(node.type) === 'T');
  expect(facts.map(node => node.props.children)).toEqual(['Sutra · 14:00–16:00', title, person, 'Uskačeš']);
  expect(card.props.accessibilityLabel).toBe(`Sutra, od 14:00 do 16:00. ${title}. ${person}, Uskačeš`);
  expect(card.props.accessibilityHint).toBe('Otvara Dogovor.');
  // The day leads at either size; facts have no shortened text, decorative inset or fixed-height ancestor.
  for (const fact of facts) {
    expect(fact.props.numberOfLines).toBeUndefined(); expect(fact.props.allowFontScaling).not.toBe(false);
    for (let ancestor: ReactTestInstance | null = fact; ancestor && ancestor !== card.parent; ancestor = ancestor.parent) {
      const style = StyleSheet.flatten(ancestor.props.style) ?? {};
      expect(style.height).toBeUndefined(); expect(style.maxHeight).toBeUndefined();
    }
  }
  // The first line came from the accepted instants; the display sentence of the Dogovor never reaches the screen.
  expect(text()).not.toContain('Fleksibilno'); expect(text()).not.toContain('2026-09-28');
  await act(async () => card.props.onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'agenda' } });
});

/** The presentation on its own, with every callback a spy; `over` replaces any prop. */
const direct = async (home: HomeSnapshot | null, over: Partial<ComponentProps<typeof HomePresentation>> = {}) => {
  const handlers = { onOpen: jest.fn(), onPublish: jest.fn(), onEarn: jest.fn(), onProfile: jest.fn(), onRatings: jest.fn(),
    onMyTasks: jest.fn(), onMyApplications: jest.fn(), onRefresh: jest.fn() };
  await act(async () => { tree = create(<HomePresentation home={home} loading={false} refreshing={false} error={false} {...handlers} {...over} />); });
  return handlers;
};
const emptyHome = () => composeHome({ needs: { kind: 'known', value: [] }, applications: { kind: 'known', value: [] }, agreements: { kind: 'known', value: [] } },
  { kind: 'known', value: { rows: [], more: 0, asOf: '2026-09-22T10:00:00Z' } });

it('draws no block for a row that carries no Raspored words, and never builds a time from its detail', async () => {
  const home = emptyHome();
  const target = { kind: 'AGREEMENT' as const, agreementId: 'legacy' };
  home.firstRun = false;
  home.agreements = { kind: 'known', value: { more: 0, rows: [{ id: 'agreement:legacy', title: 'Dogovor legacy',
    detail: 'Jelena · vreme još nije određeno', target, upcoming: true }] } };
  await direct(home);
  expect(text()).not.toContain('Raspored'); expect(text()).not.toContain('Dogovor legacy'); expect(text()).not.toContain('vreme još nije određeno');
  expect(cards()).toHaveLength(0); expect(planner()).toHaveLength(0);
});

describe('the "Sledeće" block', () => {
  const planned = (patch: object = {}): HomeSnapshot => {
    const home = emptyHome();
    home.firstRun = false;
    home.agreements = { kind: 'known', value: { more: 0, rows: [{ id: 'agreement:soon', title: 'Montaža police u hodniku', detail: 'x', target: { kind: 'AGREEMENT', agreementId: 'soon' },
      upcoming: true, appointment: { timeText: '', counterpartName: 'Jelena Nikolić', roleLabel: 'Tvoj zadatak', counterpartProfileId: 'profile-j', counterpartInitials: 'JN' },
      raspored: { when: 'Danas · 14:00–16:00', spoken: 'Danas, od 14:00 do 16:00', more: 'Ove nedelje još 2 Dogovora', zone: null }, ...patch }] } };
    return home;
  };

  it('is headed "Sledeće" and reads day first, then the work, the person with their face, and the one grey line', async () => {
    await direct(planned(), { photo: (profileId, standIn) => React.createElement('ProfilePhoto', { profileId, size: 32, fallback: standIn }) });
    const card = cards()[0];
    expect(heading('Sledeće')).toHaveLength(1); expect(heading('Raspored')).toHaveLength(0);
    expect(card.findAll(node => String(node.type) === 'T').map(node => node.props.children)).toEqual([
      'Danas · 14:00–16:00', 'Montaža police u hodniku', 'Jelena Nikolić', 'Tvoj zadatak', 'Ove nedelje još 2 Dogovora']);
    expect(card.props.accessibilityLabel).toBe('Danas, od 14:00 do 16:00. Montaža police u hodniku. Jelena Nikolić, Tvoj zadatak. Ove nedelje još 2 Dogovora');
    // The time is the black first line and the largest word of the screen, in the voice of money (never a grey note), and the calendar stands
    // small at the end of its line ("Danas u 14", the owner's pick of 2026-10-08).
    const first = card.findAll(node => String(node.type) === 'T')[0];
    expect(first.props.variant).toBe('priceLarge'); expect(first.props.tone ?? 'ink').toBe('ink');
    expect(card.findAll(node => typeof node.type !== 'string' && node.props.kind === 'calendar' && node.props.size === 32)).toHaveLength(1);
    // The face: the route's own photo element with the person's profile id at 32 dp, and the stand-in (their initials) as its fallback.
    const photo = card.findByType('ProfilePhoto' as React.ElementType);
    expect(photo.props).toMatchObject({ profileId: 'profile-j', size: 32 });
    expect(photo.props.fallback.props).toMatchObject({ initials: 'JN', size: 32 });
  });

  it('draws the stand-in alone, never a photo read, when the server named no profile or the route hands over no photo', async () => {
    await direct(planned({ appointment: { timeText: '', counterpartName: 'Jelena Nikolić', roleLabel: null, counterpartProfileId: null, counterpartInitials: 'JN' } }),
      { photo: (profileId, standIn) => React.createElement('ProfilePhoto', { profileId, size: 32, fallback: standIn }) });
    expect(tree.root.findAllByType('ProfilePhoto' as React.ElementType)).toHaveLength(0);
    expect(tree.root.findByType('Avatar' as React.ElementType).props).toMatchObject({ initials: 'JN', size: 32 });
    await act(async () => tree.unmount());
    await direct(planned());
    expect(tree.root.findAllByType('ProfilePhoto' as React.ElementType)).toHaveLength(0);
    expect(tree.root.findByType('Avatar' as React.ElementType).props).toMatchObject({ initials: 'JN', size: 32 });
  });

  it('a missing name draws the person, not letters that belong to nobody, and an absent grey line draws nothing', async () => {
    await direct(planned({ appointment: { timeText: '', counterpartName: '', roleLabel: null, counterpartProfileId: null, counterpartInitials: null },
      raspored: { when: 'Sutra · od 10:00', spoken: 'Sutra, od 10:00', more: null, zone: null } }));
    const card = cards()[0];
    expect(card.findAll(node => String(node.type) === 'T').map(node => node.props.children)).toEqual(['Sutra · od 10:00', 'Montaža police u hodniku']);
    expect(card.findAllByType('Avatar' as React.ElementType)).toHaveLength(0);
    expect(card.props.accessibilityLabel).toBe('Sutra, od 10:00. Montaža police u hodniku');
  });

  it('has no way into the whole schedule (Raspored has one door, Dogovori), and the card opens the Dogovor', async () => {
    const handlers = await direct(planned());
    expect(planner()).toHaveLength(0);
    expect(tree.root.findAll(node => String(node.type) === 'Press' && /raspored/i.test(String(node.props.accessibilityLabel)))).toHaveLength(0);
    await act(async () => cards()[0].props.onPress());
    expect(handlers.onOpen).toHaveBeenCalledWith({ kind: 'AGREEMENT', agreementId: 'soon' });
  });

  it('is reached through the route: the card opens the Dogovor once, and the face is read by the route\'s own element', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-07T09:00:00Z'));
    const slot = { prihvacenPocetak: '2026-10-07T12:00:00Z', tacanTermin: { pocetak: '2026-10-07T12:00:00Z', kraj: '2026-10-07T14:00:00Z' } };
    const source = { ...agreement('today', 'narucilac'), ...slot };
    Object.assign(source.ucesnici[1], { profilId: 'profile-jelena', inicijali: 'J' });
    mockSource.mojiDogovori.mockResolvedValue([source, { ...agreement('flex', 'uskocer'), tacanTermin: null }]);
    await render();
    expect(text()).toContain('Danas · 14:00–16:00');
    // The card says the week and nothing about the Dogovori that have no day (they are listed in Raspored), and never "zadatak" for a Dogovor.
    expect(text()).not.toContain('bez tačnog termina'); expect(text()).not.toMatch(/zadatak bez|zadatka bez|zadataka bez/);
    expect(tree.root.findByType('ProfilePhoto' as React.ElementType).props).toMatchObject({ profileId: 'profile-jelena', size: 32 });
    expect(planner()).toHaveLength(0);
    await act(async () => cards()[0].props.onPress());
    expect(mockRouter.navigate).toHaveBeenCalledTimes(1); expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'today' } });
    // One navigation per focus is the guard's rule: a second press on the same screen goes nowhere.
    await act(async () => cards()[0].props.onPress());
    expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
  });

  it('tells a phone set to another zone which time this is, in words under the day, and says it aloud too', async () => {
    await direct(planned({ raspored: { when: 'Danas · 14:00–16:00', spoken: 'Danas, od 14:00 do 16:00', more: null, zone: 'Po vremenu u Srbiji' } }));
    const card = cards()[0];
    expect(card.findAll(node => String(node.type) === 'T').map(node => node.props.children).slice(0, 3))
      .toEqual(['Danas · 14:00–16:00', 'Po vremenu u Srbiji', 'Montaža police u hodniku']);
    expect(card.props.accessibilityLabel).toBe('Danas, od 14:00 do 16:00, po vremenu u Srbiji. Montaža police u hodniku. Jelena Nikolić, Tvoj zadatak');
    expect(card.props.accessibilityLabel).toContain('Srbiji');
  });

  it('through the route: the same time on a phone in another zone, said in words there and not on a phone in Serbian time', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-07T09:00:00Z'));
    mockSource.mojiDogovori.mockResolvedValue([{ ...agreement('today', 'uskocer'), prihvacenPocetak: '2026-10-07T12:00:00Z',
      tacanTermin: { pocetak: '2026-10-07T12:00:00Z', kraj: '2026-10-07T14:00:00Z' } }]);
    mockPhoneZone = 'America/New_York'; await render();
    expect(text()).toContain('Danas · 14:00–16:00'); expect(text()).toContain('Po vremenu u Srbiji');
    await act(async () => tree.unmount());
    mockPhoneZone = 'Europe/Belgrade'; await render();
    expect(text()).toContain('Danas · 14:00–16:00'); expect(text()).not.toContain('Po vremenu u Srbiji');
  });

  // The owner's phone, 8 Oct 2026: "Raspored — 1 Dogovor bez tačnog termina" under the doors was a weak row (and the Dogovor was asked about under
  // "Čeka te" in the same breath). With no appointment ahead there is NO block: a Dogovor with no day is asked for where it waits ("Predloži
  // termin") and listed in Raspored; Početna counts nothing of it.
  describe('without a card: an active Dogovor with no day to show it on', () => {
    const unconfirmed = (id: string, patch: object = {}) => ({ ...agreement(id, 'narucilac'), naslov: 'Krečenje stana u belo',
      vremeTekst: 'Termin nije potvrđen', prihvacenPocetak: null, tacanTermin: null, ...patch });
    const link = planner;
    // A confirmed Dogovor whose exact term ended on 6 October (the clock stands at 7 October, 11:00 in Belgrade) and that is not marked done.
    const overdue = (id: string, patch: object = {}) => ({ ...agreement(id, 'narucilac'), prihvacenPocetak: '2026-10-06T08:00:00Z',
      tacanTermin: { pocetak: '2026-10-06T08:00:00Z', kraj: '2026-10-06T09:00:00Z' }, ...patch });
    const NO_LINE = /bez tačnog termina|čeka završetak|čekaju završetak/;

    it('draws no block and no line of counts: the Dogovor is asked for once, under "Čeka te", and Raspored is not drawn', async () => {
      mockSource.mojiDogovori.mockResolvedValue([unconfirmed('krecenje')]);
      await render();
      expect(heading('Sledeće')).toHaveLength(0); expect(link()).toHaveLength(0); expect(cards()).toHaveLength(0);
      expect(text()).not.toMatch(NO_LINE); expect(text()).not.toContain('Termin nije potvrđen');
      expect(text().split('Krečenje stana u belo')).toHaveLength(2); expect(text()).toContain('Predloži termin');
      expect(text()).not.toContain('Aktivni Dogovor'); expect(text()).not.toContain('Sledeći Dogovor');
    });

    it.each([2, 5, 21])('counts none of %i of them, in any form', async count => {
      mockSource.mojiDogovori.mockResolvedValue(Array.from({ length: count }, (_, index) => unconfirmed(`n${index}`)));
      await render();
      expect(text()).not.toMatch(NO_LINE); expect(cards()).toHaveLength(0); expect(link()).toHaveLength(0);
    });

    it('says nothing of a confirmed Dogovor whose exact term has passed unfinished: no card, no line, no block', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-07T09:00:00Z'));
      mockSource.mojiDogovori.mockResolvedValue([overdue('a'), overdue('b')]);
      await render();
      expect(heading('Sledeće')).toHaveLength(0); expect(text()).not.toMatch(NO_LINE); expect(cards()).toHaveLength(0); expect(link()).toHaveLength(0);
    });

    it('with an appointment ahead the card says the week and nothing about the Dogovori that have no day', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-07T09:00:00Z'));
      mockSource.mojiDogovori.mockResolvedValue([{ ...agreement('today', 'narucilac'), prihvacenPocetak: '2026-10-07T12:00:00Z',
        tacanTermin: { pocetak: '2026-10-07T12:00:00Z', kraj: '2026-10-07T14:00:00Z' } }, unconfirmed('flex'), overdue('a'), overdue('b')]);
      await render();
      expect(cards()).toHaveLength(1);
      expect(text()).not.toMatch(NO_LINE); expect(cards()[0].props.accessibilityLabel).not.toMatch(NO_LINE);
    });

    it('draws nothing of the snapshot\'s quiet line: the snapshot may carry it, the screen has no place for it', async () => {
      const home = emptyHome();
      home.firstRun = false;
      home.agreements = { kind: 'known', value: { more: 0, quietLine: '2 Dogovora bez tačnog termina', rows: [{ id: 'agreement:krecenje', title: 'Krečenje stana u belo',
        detail: 'x', target: { kind: 'AGREEMENT', agreementId: 'krecenje' } }] } };
      await direct(home);
      expect(text()).not.toContain('Raspored'); expect(text()).not.toContain('bez tačnog termina'); expect(cards()).toHaveLength(0); expect(link()).toHaveLength(0);
    });

    it('is not drawn at all when no active Dogovor has lost its day: not for a finished one, one whose term the list did not say, or none', async () => {
      for (const arrange of [
        () => mockSource.mojiDogovori.mockResolvedValue([]),
        () => mockSource.mojiDogovori.mockResolvedValue([{ ...completed('d1'), tacanTermin: null }]),
        () => mockSource.mojiDogovori.mockResolvedValue([agreement('unknown', 'uskocer')]),
      ]) {
        arrange();
        await render();
        expect(text()).not.toContain('Raspored'); expect(text()).not.toContain('bez tačnog termina'); expect(link()).toHaveLength(0);
        await act(async () => tree.unmount());
      }
    });

    it('names a failed Dogovori read instead of a count', async () => {
      mockSource.mojiDogovori.mockRejectedValue(new Error('AGREEMENT_LIST_FAILED'));
      await render();
      expect(text()).toContain('Ne možemo da učitamo Dogovore.'); expect(text()).not.toContain('bez tačnog termina'); expect(link()).toHaveLength(0);
    });
  });

  it('a Dogovori read that failed says so under "Sledeće", never as an empty schedule', async () => {
    mockSource.mojiDogovori.mockRejectedValue(new Error('AGREEMENT_LIST_FAILED'));
    await render();
    expect(heading('Sledeće')).toHaveLength(1);
    expect(text()).toContain('Ne možemo da učitamo Dogovore.'); expect(cards()).toHaveLength(0);
    expect(planner()).toHaveLength(0);
  });
});

it('a row only navigates, and to the exact place: a waiting choice opens its candidates, the two doors open my lists', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman', { brojPrijava: 2, brojPrijavaZaIzbor: 2 })]); mockSource.mojePrijave.mockResolvedValue([application('polica')]);
  mockSource.paznjaZaPocetnu.mockResolvedValue({ rows: [{ id: 'need:orman:applications', title: '2 prijave', detail: 'Moj orman · čeka tvoj izbor',
    target: { kind: 'CANDIDATES', needId: 'orman' } }], more: 0, asOf: '2026-09-22T10:00:00Z' });
  await render();
  expect(text()).toContain('Čeka te');
  await act(async () => row('2 prijave').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/kandidati', params: { id: 'orman' } });
  // The door counts by the list's own rule; that the task waits for a choice is said once, under "Čeka te".
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. 1 aktivan');
  await act(async () => tree.unmount()); await render();
  await act(async () => row('Moji zadaci').onPress());
  expect(mockRouter.navigate).toHaveBeenLastCalledWith('/potrebe');
  await act(async () => tree.unmount()); await render();
  await act(async () => row('Moje prijave').onPress());
  expect(mockRouter.navigate).toHaveBeenLastCalledWith('/moje-prijave');
});

it.each([[390, 1], [320, 2]])('separates the real attention task from its action without splitting or repeating its title at %idp / font %i', async (width, fontScale) => {
  mockWindow = { width, height: 844, scale: 3, fontScale };
  // An appointment lies ahead, so the waiting thing is a row of "Čeka te" (the task leads, the action is under it), not the record that leads when none does.
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-07T09:00:00Z'));
  mockSource.mojiDogovori.mockResolvedValue([{ ...agreement('today', 'narucilac'), prihvacenPocetak: '2026-10-07T12:00:00Z',
    tacanTermin: { pocetak: '2026-10-07T12:00:00Z', kraj: '2026-10-07T14:00:00Z' } }]);
  const taskTitle = 'Police · dnevna soba i veliko ogledalo';
  mockSource.paznjaZaPocetnu.mockResolvedValue({ rows: [{ id: 'application:changed:stale', title: 'Zadatak je izmenjen',
    taskTitle, detail: 'Pregledaj izmene pre odluke o prijavi.', target: { kind: 'APPLICATION', applicationId: 'changed' } }],
    more: 0, asOf: '2026-09-27T10:00:00Z' });
  await render();
  const attention = tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith('Zadatak je izmenjen'))[0];
  const facts = attention.findAll(node => String(node.type) === 'T');
  // The eye gets the task and the action; the sentence that said the action again is not drawn (8 Oct 2026), and a screen reader still hears it.
  expect(facts.map(node => node.props.children)).toEqual([taskTitle, 'Zadatak je izmenjen']);
  expect(attention.props.accessibilityLabel).toBe(`Zadatak je izmenjen. ${taskTitle}. Pregledaj izmene pre odluke o prijavi.`);
  expect(text()).not.toContain('Pregledaj izmene pre odluke o prijavi.');
  expect(text().split(taskTitle)).toHaveLength(2);
  for (const fact of facts) {
    expect(fact.props.numberOfLines).toBeUndefined(); expect(fact.props.allowFontScaling).not.toBe(false);
  }
  await act(async () => attention.props.onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/moje-prijave', params: { prijavaId: 'changed' } });
});

// "Danas u 14" (owner's pick, 2026-10-08): the next appointment's time is the largest word and stands directly under the doors, before "Čeka te";
// with none ahead the first thing that waits takes its place as the one record, its number first, and the rest stay rows.
describe('what leads Početna', () => {
  const choice = { id: 'need:orman:applications', title: '2 prijave', taskTitle: 'Pomoć pri selidbi', detail: 'Čeka tvoj izbor.', target: { kind: 'CANDIDATES' as const, needId: 'orman' } };
  const term = { id: 'agreement:term', title: 'Predloži termin', taskTitle: 'Krečenje stana u belo', detail: 'Termin još nije dogovoren.', target: { kind: 'AGREEMENT_TERM' as const, agreementId: 'term' } };
  const waiting = (): HomeSnapshot => { const home = emptyHome(); home.firstRun = false; home.attention = [choice, term]; return home; };
  const headings = () => tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header').map(node => node.props.children);
  const dots = () => tree.root.findAll(node => node.props.testID === 'attention-dot');
  const largest = () => tree.root.findAll(node => String(node.type) === 'T' && node.props.variant === 'priceLarge').map(node => node.props.children);

  it('puts "Sledeće" before "Čeka te" when an appointment lies ahead, and then every waiting thing is a row', async () => {
    const home = waiting();
    home.agreements = { kind: 'known', value: { more: 0, rows: [{ id: 'agreement:soon', title: 'Montaža police u hodniku', detail: 'x', target: { kind: 'AGREEMENT', agreementId: 'soon' },
      upcoming: true, appointment: { timeText: '', counterpartName: 'Jelena Nikolić', roleLabel: 'Tvoj zadatak', counterpartProfileId: null, counterpartInitials: 'JN' },
      raspored: { when: 'Danas · 14:00–16:00', spoken: 'Danas, od 14:00 do 16:00', more: null, zone: null } }] } };
    await direct(home);
    expect(headings().filter(name => name === 'Sledeće' || name === 'Čeka te')).toEqual(['Sledeće', 'Čeka te']);
    // The time is the one largest word; both waiting things are rows (the task leads, the action under it), each with the orange dot.
    expect(largest()).toEqual(['Danas · 14:00–16:00']);
    expect(row('2 prijave').accessibilityLabel).toBe('2 prijave. Pomoć pri selidbi. Čeka tvoj izbor.');
    expect(dots()).toHaveLength(2);
  });

  it('with no appointment ahead the first thing that waits is the one record: its task first, the action and reason below, the others rows', async () => {
    const handlers = await direct(waiting());
    expect(headings().filter(name => name === 'Sledeće')).toHaveLength(0);
    const lead = row('2 prijave');
    expect(lead.accessibilityLabel).toBe('Pomoć pri selidbi. 2 prijave. Čeka tvoj izbor.');
    expect(tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === lead.accessibilityLabel)[0]
      .findAll(node => String(node.type) === 'T').map(node => [node.props.variant, node.props.children]))
      .toEqual([['heading', 'Pomoć pri selidbi'], ['note', '2 prijave · čeka tvoj izbor']]);
    // The next one is a row as always.
    expect(row('Predloži termin').accessibilityLabel).toBe('Predloži termin. Krečenje stana u belo. Termin još nije dogovoren.');
    expect(dots()).toHaveLength(2);
    await act(async () => lead.onPress());
    expect(handlers.onOpen).toHaveBeenCalledWith(choice.target);
  });

  it('a first thing that is not a count leads in the heading type; nothing leads while the attention read failed, nor when nothing waits', async () => {
    const home = waiting(); home.attention = [term];
    await direct(home);
    expect(largest()).toEqual([]);
    // The task leads; its specific action remains below and the full explanation stays in the spoken label.
    expect(text()).not.toContain('Termin još nije dogovoren.');
    expect(tree.root.findAll(node => String(node.type) === 'T' && node.props.variant === 'heading' && node.props.children === 'Krečenje stana u belo')).toHaveLength(1);
    await act(async () => tree.unmount());
    const failed = waiting(); failed.attentionState = 'unavailable'; failed.attention = []; failed.prompts = [];
    await direct(failed);
    expect(text()).toContain('Ne možemo da učitamo ono što te čeka.'); expect(dots()).toHaveLength(0);
    await act(async () => tree.unmount());
    const quiet = emptyHome(); quiet.firstRun = false;
    await direct(quiet);
    expect(text()).toContain('Ništa ne čeka tvoju odluku.'); expect(dots()).toHaveLength(0);
  });

  it('keeps the action when the task is unknown and lets a long task title grow without losing its destination', async () => {
    const home = waiting(); home.attention = [{ ...term, taskTitle: undefined }];
    const handlers = await direct(home);
    expect(tree.root.findAll(node => String(node.type) === 'T' && node.props.variant === 'heading').map(node => node.props.children)).toContain('Predloži termin');
    expect(text()).toContain('Termin još nije dogovoren.');
    await act(async () => row('Predloži termin').onPress()); expect(handlers.onOpen).toHaveBeenCalledWith(term.target);
    await act(async () => tree.unmount());
    const title = 'Pomoć pri selidbi teškog ormana i svih kutija sa četvrtog sprata bez lifta';
    home.attention = [{ ...choice, taskTitle: title }]; await direct(home);
    const heading = tree.root.findAll(node => String(node.type) === 'T' && node.props.children === title)[0];
    expect(heading.props.variant).toBe('heading'); expect(heading.props.numberOfLines).toBeUndefined();
    expect(heading.props.allowFontScaling).not.toBe(false); expect(text()).toContain('2 prijave · čeka tvoj izbor');
  });

  // The approved blueprint (8 Oct 2026, T3): "Čeka te" holds three things at most. What does not fit is counted, together with what the
  // server and the phone already said they left out, in the one grey line; a rating is a thing like the others and is counted when it does not fit.
  describe('holds three things at most', () => {
    const change = { id: 'agreement:change', title: 'Odgovori na predlog izmene', taskTitle: 'Montaža police', detail: 'Druga strana predlaže izmenu uslova.',
      target: { kind: 'AGREEMENT_CHANGE' as const, agreementId: 'change' } };
    const draft = { id: 'need:draft', title: 'Nastavi nacrt', taskTitle: 'Prevoz ormana', detail: 'Nacrt još nije objavljen.', target: { kind: 'NEED' as const, needId: 'draft' } };
    const moreLine = /I još\s+(\d+)\s+u tvojim zadacima, prijavama i Dogovorima\./;

    it('draws the first three and counts the draft and the ratings that do not fit', async () => {
      const home = waiting(); home.attention = [choice, term, change, draft]; home.ratingsDue = 2;
      await direct(home);
      expect(row('2 prijave')).toBeDefined(); expect(row('Predloži termin')).toBeDefined(); expect(row('Odgovori na predlog izmene')).toBeDefined();
      expect(text()).not.toContain('Nastavi nacrt'); expect(text()).not.toContain('Oceni 2 završena Dogovora');
      expect(text().match(moreLine)?.[1]).toBe('2');
    });

    it('draws a rating when there is room for it, and counts nothing', async () => {
      const home = waiting(); home.attention = [choice]; home.ratingsDue = 2;
      await direct(home);
      expect(text()).toContain('Oceni 2 završena Dogovora'); expect(text()).not.toMatch(moreLine);
    });

    it('adds what the server and the phone left out to what did not fit', async () => {
      const home = waiting(); home.attention = [choice, term, change, draft]; home.attentionMore = 5; home.prompts = []; home.promptsMore = 3;
      await direct(home);
      expect(text().match(moreLine)?.[1]).toBe(String(5 + 3 + 1));
    });

    it('counts a rating that did not fit as one thing, however many Dogovori it names', async () => {
      const home = waiting(); home.attention = [choice, term, change]; home.ratingsDue = 7;
      await direct(home);
      expect(text()).not.toContain('Oceni 7'); expect(text().match(moreLine)?.[1]).toBe('1');
    });
  });
});

it('"Moje aktivnosti" is no longer a destination: nothing on Početna leads there', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman')]); mockSource.mojePrijave.mockResolvedValue([application('polica')]);
  await render();
  expect(text()).not.toContain('Moje aktivnosti'); expect(text()).not.toContain('Vidi sve');
  // Every press on the screen, each on a fresh screen (one navigation per focus is the guard's rule).
  const labels = tree.root.findAll(node => String(node.type) === 'Press' && typeof node.props.onPress === 'function').map(node => String(node.props.accessibilityLabel));
  expect(labels.length).toBeGreaterThanOrEqual(5);
  for (const label of labels) {
    await act(async () => tree.unmount()); await render();
    await act(async () => row(label).onPress());
  }
  expect(mockRouter.navigate).toHaveBeenCalledTimes(labels.length);
  expect(mockRouter.navigate).not.toHaveBeenCalledWith('/moje-aktivnosti');
});

// Owner correction: equally prominent creation and discovery belong to the same account.
// Keep actionable names, untruncated text and usable personal-list targets without pinning a layout recipe.
it.each([[390, 1], [390, 1.2], [390, 1.2999999523], [320, 1], [320, 2]])(
  'keeps both launch actions readable and available at %idp / font %s', async (width, fontScale) => {
    mockWindow = { width, height: 844, scale: 3, fontScale };
    await render();
    for (const label of ['Objavi zadatak', 'Uskoči i zaradi']) {
      const entry = tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label);
      expect(entry).toHaveLength(1);
      expect(entry[0].props.accessibilityRole).toBe('button');
      expect(entry[0].props.onPress).toEqual(expect.any(Function));
      expect(entry[0].props.disabled).not.toBe(true);
      for (const fact of entry[0].findAll(node => String(node.type) === 'T')) {
        expect(fact.props.numberOfLines).toBeUndefined();
        expect(fact.props.allowFontScaling).not.toBe(false);
        for (let ancestor: ReactTestInstance | null = fact; ancestor && ancestor !== entry[0].parent; ancestor = ancestor.parent) {
          const style = StyleSheet.flatten(ancestor.props.style) ?? {};
          expect(style.height).toBeUndefined(); expect(style.maxHeight).toBeUndefined();
        }
      }
    }
  },
);

// Owner, 2026-10-07: the two doors are smaller, about 88 dp (the 64 dp picture between 12 dp of air), each with its
// intention and ONE line under it, still two equal big doors. Larger text grows both together instead of clipping them.
it('draws two equal doors about 88 dp high with a 64 dp picture, and larger text grows both together', async () => {
  const minHeights: Record<string, number[]> = {};
  for (const fontScale of [1, 1.15, 1.2999999523, 2]) {
    mockWindow = { width: 390, height: 844, scale: 3, fontScale };
    await act(async () => tree?.unmount()); await render();
    const doors = ['Objavi zadatak', 'Uskoči i zaradi'].map(label => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0]);
    const heights = doors.map(door => StyleSheet.flatten(door.props.style).minHeight as number);
    expect(heights[0]).toBe(heights[1]);
    minHeights[String(fontScale)] = heights;
    // The picture is 64 dp at every size; a door says its intention once, with one line under it.
    expect(tree.root.findAllByType('HomeLaunchArt' as React.ElementType).map(node => [node.props.kind, node.props.size])).toEqual([['publish', 64], ['discover', 64]]);
    for (const door of doors) expect(door.findAll(node => String(node.type) === 'T')).toHaveLength(2);
  }
  expect(minHeights['1']).toEqual([88, 88]); expect(minHeights['1.15']).toEqual([88, 88]);
  expect(minHeights['1.2999999523'][0]).toBeGreaterThan(88); expect(minHeights['2'][0]).toBeGreaterThan(minHeights['1.2999999523'][0]);
});

it('says the doors in "zadatak" and never "posao", in the hints too', async () => {
  await render();
  expect(text()).toContain('Opiši šta ti treba.'); expect(text()).toContain('Pronađi zadatak.');
  const hints = ['Objavi zadatak', 'Uskoči i zaradi'].map(label => action(label).accessibilityHint);
  expect(hints).toEqual(['Opiši šta ti treba.', 'Pronađi zadatak.']);
  expect(`${text()} ${hints.join(' ')}`).not.toMatch(/posao|poslov/i);
});

it('puts "Moji zadaci" and "Moje prijave" in one group of rows, with the screen\'s own gap above it and no heading or line of its own', async () => {
  await render();
  const mine = ['Moji zadaci', 'Moje prijave'].map(label => tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith(label))[0]);
  // The nearest drawn View above a row is its group; both rows must stand in the same one. (Booleans only: a failing
  // comparison of two test instances would print the whole fiber tree.)
  const groupOf = (press: ReactTestInstance) => { let node = press.parent; while (node && String(node.type) !== 'View') node = node.parent; return node; };
  const group = groupOf(mine[0]);
  expect(!!group && group === groupOf(mine[1])).toBe(true);
  // The space above a block is the Screen's (24 between blocks), so the group has no margin, no border and no title of its own.
  const style = StyleSheet.flatten(group!.props.style) ?? {};
  expect(style.marginTop).toBeUndefined(); expect(style.borderTopWidth).toBeUndefined();
  expect(group!.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header')).toHaveLength(0);
});

it('keeps personal-list targets generous while their counts remain independently named', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman')]);
  await render();
  for (const label of ['Moji zadaci. 1 aktivan', 'Moje prijave. Još nemaš prijavu']) {
    expect(StyleSheet.flatten(row(label).style).minHeight).toBeGreaterThanOrEqual(64);
  }
});

const completed = (id: string) => ({ ...agreement(id, 'uskocer'), stanje: 'COMPLETED', ocenaMoguca: true });

it('an incomplete rating read opens Dogovori without claiming zero, an exact total or the single known rating', async () => {
  mockSource.mojiDogovori.mockResolvedValue([completed('due'), { ...completed('unknown'), ocenaMoguca: false, stanjeProvereOcene: 'UNAVAILABLE' }]);
  await render(); expect(text()).toContain('Proveri ocene'); expect(text()).not.toContain('Oceni završen Dogovor');
  await act(async () => row('Proveri ocene u Dogovorima').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith('/dogovori');
});

// Copy updated 2026-09-24 (critique A1): the strip used to say "2 završena Dogovora čekaju tvoju ocenu"; it now leads
// with the verb. Two due still open the Dogovori, where each one waits.
it('names the completed Dogovori that wait for my rating once, verb first, with the count written once, and opens the Dogovori', async () => {
  mockSource.mojiDogovori.mockResolvedValue([completed('d1'), completed('d2')]);
  await render();
  // Seen on the emulator 2026-09-23 as "2 2 završena Dogovora": the count was written by plural() and again in front of it.
  expect(text()).toContain('Oceni 2 završena Dogovora'); expect(text()).not.toContain('2 2 ');
  // It waits for me, so it stands under "Čeka te"; with no next Dogovor there is no empty "Nemaš zakazan Dogovor." line.
  expect(text()).toContain('Čeka te'); expect(text()).not.toContain('Nemaš zakazan Dogovor'); expect(text()).not.toContain('Sledeći Dogovor');
  expect(row('Oceni 2 završena Dogovora').accessibilityHint).toBe('Otvara Dogovore.');
  await act(async () => row('Oceni 2 završena Dogovora').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith('/dogovori');
});

// Critique A1 (2026-09-24): the strip opened the Dogovori list, four taps from the rating. With exactly one due, the
// Dogovori read has already named it, so the rating opens directly, as the Dogovor screen itself opens it.
it('with exactly one Dogovor waiting for my rating, opens that rating in one tap', async () => {
  mockSource.mojiDogovori.mockResolvedValue([completed('d1'), { ...agreement('rated', 'uskocer'), stanje: 'COMPLETED', ocenaMoguca: false }]);
  await render();
  expect(text()).toContain('Oceni završen Dogovor');
  expect(row('Oceni završen Dogovor').accessibilityHint).toBe('Otvara ocenu saradnje.');
  await act(async () => row('Oceni završen Dogovor').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
  // Round 2c (verifier vf, must 1): the rating is told it was opened from Početna, so its way back names Početna.
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/oceni-dogovor', params: { agreementId: 'd1', from: 'pocetna' } });
});

it.each([[5, 'Oceni 5 završenih Dogovora'], [21, 'Oceni 21 završen Dogovor'], [22, 'Oceni 22 završena Dogovora']])(
  'writes %i due ratings in the Serbian form', async (count, expected) => {
    mockSource.mojiDogovori.mockResolvedValue(Array.from({ length: count }, (_, index) => completed(`d${index}`)));
    await render();
    expect(text()).toContain(expected);
  });

it('a section that failed says so and offers the read again; it is never drawn as nothing', async () => {
  mockSource.mojiDogovori.mockRejectedValue(new Error('AGREEMENT_LIST_FAILED')); mockSource.mojePotrebe.mockResolvedValue([need('orman')]);
  await render();
  expect(text()).toContain('Ne možemo da učitamo Dogovore.'); expect(text()).not.toContain('Nemaš aktivan Dogovor.');
  expect(text()).toContain('1 aktivan');
  await act(async () => action('Osveži pregled').onPress()); expect(mockSource.mojiDogovori).toHaveBeenCalledTimes(2);
});

it('offers one shared recovery for multiple unavailable sections and rejects duplicate retained retry taps', async () => {
  mockSource.mojiDogovori.mockRejectedValue(new Error('AGREEMENTS_FAILED'));
  mockSource.mojePrijave.mockRejectedValue(new Error('APPLICATIONS_FAILED'));
  mockSource.paznjaZaPocetnu.mockRejectedValue(new Error('ATTENTION_FAILED'));
  mockSource.mojePotrebe.mockResolvedValue([need('known')]);
  await render();
  expect(text()).toContain('Deo pregleda trenutno nije učitan.');
  expect(text()).toContain('Ne možemo da učitamo Dogovore.');
  expect(text()).toContain('Ne možemo da učitamo ono što te čeka.');
  // A read that failed is named where it failed; nothing here may read as "nothing waits".
  expect(text()).not.toContain('Ništa ne čeka tvoju odluku.');
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. Trenutno nedostupno');
  expect(tree.root.findAll(node => String(node.type) === 'Action' && node.props.label === 'Osveži pregled')).toHaveLength(1);
  expect(tree.root.findAllByProps({ label: 'Pokušaj ponovo' })).toHaveLength(0);
  const wait = deferred<never[]>(); mockSource.mojePotrebe.mockReturnValue(wait.promise);
  const retry = action('Osveži pregled').onPress;
  try {
    await act(async () => { retry(); retry(); });
    for (const read of Object.values(mockSource)) expect(read).toHaveBeenCalledTimes(2);
    expect(action('Osveži pregled')).toMatchObject({ loading: true, disabled: true });
    await act(async () => retry());
    for (const read of Object.values(mockSource)) expect(read).toHaveBeenCalledTimes(2);
    expect(action('Objavi zadatak')).toBeDefined(); expect(action('Uskoči i zaradi')).toBeDefined();
  } finally { await act(async () => wait.resolve([])); }
  expect(action('Osveži pregled')).toMatchObject({ loading: false, disabled: false });
});

it('a retry retained by the previous focus cannot start the shared read after returning Home', async () => {
  mockSource.mojiDogovori.mockRejectedValue(new Error('AGREEMENTS_FAILED'));
  await render();
  const retired = action('Osveži pregled').onPress;
  await act(async () => { mockFocused = false; tree.update(<Pocetna />); });
  await act(async () => { mockFocused = true; tree.update(<Pocetna />); });
  await act(async () => retired());
  for (const read of Object.values(mockSource)) expect(read).toHaveBeenCalledTimes(2);
  await act(async () => action('Osveži pregled').onPress());
  for (const read of Object.values(mockSource)) expect(read).toHaveBeenCalledTimes(3);
});

it('a failed foreground read can be retried while an abandoned older retry still waits, without its completion unlocking the new retry', async () => {
  mockSource.mojiDogovori.mockRejectedValue(new Error('AGREEMENTS_FAILED'));
  await render();
  const abandoned = deferred<never[]>(), currentRetry = deferred<never[]>();
  mockSource.mojePotrebe.mockReturnValueOnce(abandoned.promise);
  try {
    await act(async () => action('Osveži pregled').onPress());
    expect(mockSource.mojePotrebe).toHaveBeenCalledTimes(2);
    await act(async () => {
      mockAppState = 'background'; mockAppStateListeners.forEach(listener => listener('background'));
    });
    for (const read of Object.values(mockSource)) read.mockRejectedValue(new Error('FOREGROUND_READ_FAILED'));
    await act(async () => {
      mockAppState = 'active'; mockAppStateListeners.forEach(listener => listener('active'));
    });
    expect(text()).toContain('Pregled nije učitan. Proveri vezu i pokušaj ponovo.');
    expect(action('Osveži pregled')).toMatchObject({ loading: false, disabled: false });
    mockSource.mojePotrebe.mockReturnValueOnce(currentRetry.promise);
    const retry = action('Osveži pregled').onPress;
    await act(async () => retry());
    for (const read of Object.values(mockSource)) expect(read).toHaveBeenCalledTimes(4);
    // The all-failed foreground read has no snapshot to retain; recovery shows
    // the existing initial-load state rather than the partial-read retry row.
    expect(tree.root.findByType(HomePresentation).props).toMatchObject({ loading: true, refreshing: false, error: false });
    await act(async () => abandoned.resolve([]));
    await act(async () => retry());
    for (const read of Object.values(mockSource)) expect(read).toHaveBeenCalledTimes(4);
    expect(tree.root.findByType(HomePresentation).props).toMatchObject({ loading: true, error: false });
  } finally {
    await act(async () => { abandoned.resolve([]); currentRetry.resolve([]); });
  }
});

it('four failed reads are a failed screen, not an empty account, and the two doors never say zero', async () => {
  for (const read of Object.values(mockSource)) read.mockRejectedValue(new Error('READ_FAILED'));
  await render();
  expect(text()).toContain('Pregled nije učitan. Proveri vezu i pokušaj ponovo.');
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. Trenutno nedostupno');
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. Trenutno nedostupno');
  expect(text()).not.toMatch(/\b0\b/); expect(text()).not.toContain('Još nemaš');
  // No answer at all: neither "Čeka te" with its quiet "nothing" nor the steps of a new account may stand in for it.
  expect(text()).not.toContain('Ništa ne čeka tvoju odluku.'); expect(text()).not.toContain('Čeka te');
  expect(text()).not.toContain('Opiši zadatak'); expect(text()).not.toContain('Raspored');
  expect(action('Objavi zadatak')).toBeDefined();
});

it('one failed side says it is not loaded while the other is counted', async () => {
  mockSource.mojePrijave.mockRejectedValue(new Error('APPLICATIONS_FAILED')); mockSource.mojePotrebe.mockResolvedValue([need('orman'), need('nacrt', { stanje: 'NACRT' })]);
  await render();
  // The one draft is offered under "Čeka te" ("Nastavi nacrt") and still counted in its list: the row is the count of what it opens.
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. 1 aktivan · 1 nacrt');
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. Trenutno nedostupno');
});

// Serbian counts take three shapes by the last two digits (plural.ts): a final 1 but not 11, a final 2–4 but not
// 12–14, and everything else. 1 is covered above; 2, 5, 11 and 21 are the other edges.
it.each([
  [2, 'Moji zadaci. 2 aktivna · 2 nacrta', 'Moje prijave. 2 čekaju odgovor', 'Moje prijave. 2 prijave'],
  [5, 'Moji zadaci. 5 aktivnih · 5 nacrta', 'Moje prijave. 5 čeka odgovor', 'Moje prijave. 5 prijava'],
  [11, 'Moji zadaci. 11 aktivnih · 11 nacrta', 'Moje prijave. 11 čeka odgovor', 'Moje prijave. 11 prijava'],
  [21, 'Moji zadaci. 21 aktivan · 21 nacrt', 'Moje prijave. 21 čeka odgovor', 'Moje prijave. 21 prijava'],
])('the two doors write %i in its Serbian form', async (count, tasks, applications, waiting) => {
  const many = <Row,>(make: (index: number) => Row) => Array.from({ length: count }, (_, index) => make(index));
  mockSource.mojePotrebe.mockResolvedValue([...many(index => need(`a${index}`)), ...many(index => need(`d${index}`, { stanje: 'NACRT' }))]);
  mockSource.mojePrijave.mockResolvedValue(many(index => application(`p${index}`)));
  await render();
  expect(row('Moji zadaci').accessibilityLabel).toBe(tasks);
  expect(row('Moje prijave').accessibilityLabel).toBe(applications);
  // Applications that all wait for me are named by their number, never as "Nema aktivnih prijava".
  mockSource.mojePrijave.mockResolvedValue(many(index => ({ ...application(`w${index}`), traziPaznju: true })));
  await act(async () => tree.unmount()); await render();
  expect(row('Moje prijave').accessibilityLabel).toBe(waiting);
});

it('PKG-042: server attention and remaining rows stay visible without a misleading combined count when preview reads fail', async () => {
  for (const read of [mockSource.mojePotrebe, mockSource.mojePrijave, mockSource.mojiDogovori]) read.mockRejectedValue(new Error('READ_FAILED'));
  mockSource.paznjaZaPocetnu.mockResolvedValue({ rows: [{ id: 'application:server:stale', title: 'Zadatak je izmenjen',
    detail: 'Pregledaj uslove', target: { kind: 'APPLICATION', applicationId: 'server' } }], more: 12, asOf: '2026-09-22T10:00:00Z' });
  await render();
  expect(text()).toContain('Zadatak je izmenjen'); expect(text()).toMatch(/I još\s+12/);
  // The independent rating read is unknown; its recovery action shares this section.
  // Keep all server rows and its "12 more", without implying that 13 counts every action.
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Čeka te: 13 stavki' })).toHaveLength(0);
  expect(heading('Čeka te')).toHaveLength(1);

  await act(async () => row('Zadatak je izmenjen').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/moje-prijave', params: { prijavaId: 'server' } });
});

it('PKG-042: attention failure is explicit and never replaced with conclusions from old lists', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('old', { brojPrijava: 2, brojPrijavaZaIzbor: 2 })]);
  mockSource.paznjaZaPocetnu.mockRejectedValue(new Error('PRIVATE_BACKEND_ERROR'));
  await render();
  expect(text()).toContain('Ne možemo da učitamo ono što te čeka.');
  expect(text()).not.toContain('čeka tvoj izbor'); expect(text()).not.toContain('PRIVATE_BACKEND_ERROR');
  // "Čeka te" stays unavailable, and the door does not stand in for it: it counts the list, never what waits.
  expect(text()).not.toContain('čeka izbor');
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. 1 aktivan');
  await act(async () => action('Osveži pregled').onPress());
  expect(mockSource.paznjaZaPocetnu).toHaveBeenCalledTimes(2);
});

it('PKG-042: a known empty aggregate suppresses obsolete locally inferred attention', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('old', { brojPrijava: 7, brojPrijavaZaIzbor: 2 })]);
  mockSource.mojePrijave.mockResolvedValue([{ ...application('stara'), traziPaznju: true }]);
  await render();
  expect(mockSource.paznjaZaPocetnu).toHaveBeenCalledTimes(1);
  // Since 2026-10-07 "Čeka te" is always there once the reads answered: the known empty answer is said, once, quietly.
  expect(text()).toContain('Čeka te'); expect(text()).toContain('Ništa ne čeka tvoju odluku.'); expect(text()).toContain('1 aktivan');
  expect(text()).not.toContain('čeka tvoj izbor');
  // Neither door contradicts the known empty list with a count of its own of what waits.
  expect(text()).not.toContain('čeka izbor'); expect(text()).not.toContain('čeka te');
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. 1 aktivan');
  // The application is in the list's own "Čeka te" set, not in "Aktivne": the door names it without calling it inactive.
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. 1 prijava');
});

it('PKG-042: a late private attention result from the previous account cannot appear after switching accounts', async () => {
  const late = deferred<unknown>(); mockSource.paznjaZaPocetnu.mockReturnValueOnce(late.promise);
  await render();
  mockSession = { user: { id: B }, accountRevision: 2 };
  await act(async () => tree.update(<Pocetna />));
  await act(async () => late.resolve({ rows: [{ id: 'private-a', title: 'PRIVATE_A_TASK', detail: '',
    target: { kind: 'NEED', needId: A } }], more: 0, asOf: '2026-09-22T10:00:00Z' }));
  expect(text()).not.toContain('PRIVATE_A_TASK');
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. Još nemaš zadatak');
});

it('a known empty account names both empty lists without invented zero statistics', async () => {
  await render();
  expect(text()).not.toMatch(/\b0\b/);
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. Još nemaš zadatak');
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. Još nemaš prijavu');
});

// Owner, 2026-10-07: "Čeka te" is always there once the reads answered. When nothing waits it is one grey row with the
// check, never a missing section (which read as a screen that had not loaded).
it('"Čeka te" is always there when the reads answered: nothing waiting is one quiet row, not a missing section', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman')]); // an account that already works
  await render();
  expect(heading('Čeka te')).toHaveLength(1);
  const quiet = tree.root.findAll(node => String(node.type) === 'T' && node.props.children === 'Ništa ne čeka tvoju odluku.');
  expect(quiet).toHaveLength(1); expect(quiet[0].props.numberOfLines).toBeUndefined();
  // The check is FactArt's own `check` in its quiet form (the row's tone), and the row is a statement, not a button.
  expect(tree.root.findAllByProps({ kind: 'check', muted: true }).length).toBeGreaterThan(0);
  expect(tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).includes('Ništa ne čeka'))).toHaveLength(0);
  // It carries no count, no rating strip and no "I još".
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Čeka te: 1 stavka' })).toHaveLength(0);
  expect(text()).not.toContain('Oceni'); expect(text()).not.toContain('I još');
});

it('says "nothing waits" only from answers that are known: a missing attention answer or an unknown rating count says so instead', async () => {
  // The rating count is unknown (the check of a finished Dogovor is unavailable): its own row, no claim of nothing.
  mockSource.mojiDogovori.mockResolvedValue([{ ...completed('unknown'), ocenaMoguca: false, stanjeProvereOcene: 'UNAVAILABLE' }]);
  await render();
  expect(text()).toContain('Proveri ocene'); expect(text()).not.toContain('Ništa ne čeka tvoju odluku.');
  await act(async () => tree.unmount());
  // A list that failed is named under its own door, while the server's own attention answer is known and empty.
  mockSource.mojiDogovori.mockResolvedValue([]); mockSource.mojePrijave.mockRejectedValue(new Error('APPLICATIONS_FAILED'));
  await render();
  expect(text()).toContain('Ništa ne čeka tvoju odluku.'); expect(text()).toContain('Deo pregleda trenutno nije učitan.');
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. Trenutno nedostupno');
});

it('what waits is still said, and the quiet row is not drawn beside it', async () => {
  mockSource.paznjaZaPocetnu.mockResolvedValue({ rows: [{ id: 'application:x:stale', title: 'Zadatak je izmenjen', detail: 'Pregledaj izmene.',
    target: { kind: 'APPLICATION', applicationId: 'x' } }], more: 0, asOf: '2026-09-22T10:00:00Z' });
  await render();
  expect(text()).toContain('Zadatak je izmenjen'); expect(text()).not.toContain('Ništa ne čeka tvoju odluku.');
  await act(async () => tree.unmount());
  mockSource.paznjaZaPocetnu.mockResolvedValue({ rows: [], more: 0, asOf: '2026-09-22T10:00:00Z' });
  mockSource.mojiDogovori.mockResolvedValue([completed('d1')]);
  await render();
  expect(text()).toContain('Oceni završen Dogovor'); expect(text()).not.toContain('Ništa ne čeka tvoju odluku.');
});

// Design proposal N4 (owner, 2026-10-07): an account with nothing in it yet sees the two doors and ONE quiet row, "Kako radi",
// three short steps with a "Sakrij"; the row goes by itself with the first draft, application or Dogovor, and once hidden it
// never returns.
describe('a brand-new account', () => {
  const how = () => tree.root.findAll(node => String(node.type) === 'View' && node.props.testID === 'how-it-works');
  const steps = () => tree.root.findAll(node => String(node.type) === 'View' && String(node.props.accessibilityLabel).startsWith('1. Objavi ili pronađi'));
  const hide = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Sakrij')[0];
  const STEP_WORDS = ['Objavi ili pronađi', 'Zadatak', 'Dogovori se', 'Prijava i poruke', 'Oceni', 'Posle završetka'];
  it('sees one row "Kako radi" under the two doors, and no "Čeka te" (nothing could wait yet)', async () => {
    await render();
    expect(how()).toHaveLength(1);
    expect(heading('Kako radi')).toHaveLength(1);
    for (const word of STEP_WORDS) expect(text()).toContain(word);
    expect(text()).not.toContain('Čeka te'); expect(text()).not.toContain('Ništa ne čeka tvoju odluku.');
    // The old unlabelled steps are gone with their words.
    for (const old of ['Opiši zadatak', 'Izaberi prijavu', 'Dogovor i ocena']) expect(text()).not.toContain(old);
    expect(steps()).toHaveLength(1);
    expect(steps()[0].props).toMatchObject({ accessible: true,
      accessibilityLabel: '1. Objavi ili pronađi, Zadatak. 2. Dogovori se, Prijava i poruke. 3. Oceni, Posle završetka.' });
    expect(StyleSheet.flatten(steps()[0].props.style).flexDirection).toBe('row');
    // Three pictures of 32 dp, one per step; the only thing that can be pressed in the row is "Sakrij", and the doors stay.
    expect([...new Set(steps()[0].findAllByProps({ size: 32 }).filter(node => typeof node.type !== 'string').map(node => node.props.kind))])
      .toEqual(['publish', 'agreements', 'star']);
    expect(steps()[0].findAll(node => String(node.type) === 'Press')).toHaveLength(0);
    expect(how()[0].findAll(node => String(node.type) === 'Press').map(node => node.props.accessibilityLabel)).toEqual(['Sakrij']);
    expect(action('Objavi zadatak')).toBeDefined(); expect(action('Uskoči i zaradi')).toBeDefined();
  });

  it('keeps every word at 12 px or more and "Sakrij" at 48 dp, and never names the sides of a task', async () => {
    await render();
    const styled = how()[0].findAll(node => String(node.type) === 'T');
    expect(styled.length).toBeGreaterThan(0);
    for (const node of styled) expect(node.props.variant === undefined || ['heading', 'copy', 'note', 'meta'].includes(node.props.variant)).toBe(true);
    const style = StyleSheet.flatten(hide().props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(48); expect(style.minWidth).toBeGreaterThanOrEqual(48);
    expect(hide().props.accessibilityRole).toBe('button');
    for (const word of ['Naručilac', 'Uskočer', 'posao', 'poslovi']) expect(text()).not.toContain(word);
  });

  it.each([[390, 1.3], [320, 1]])('stacks the steps in a column when there is no room for a row (%idp / font %s)', async (width, fontScale) => {
    mockWindow = { width, height: 844, scale: 3, fontScale };
    await render();
    expect(StyleSheet.flatten(steps()[0].props.style).flexDirection).toBe('column');
    expect(steps()[0].findAll(node => String(node.type) === 'T').map(node => node.props.children)).toEqual(STEP_WORDS);
  });

  it('is hidden with one touch, remembered on the device, and never comes back', async () => {
    await render();
    await act(async () => hide().props.onPress());
    expect(how()).toHaveLength(0); expect(text()).not.toContain('Kako radi');
    expect(mockStored.get(HOW_IT_WORKS_KEY)).toBe('1');
    // The same screen opened again, as on the next launch: the memory is read, and the row stays gone.
    await act(async () => tree.unmount()); await render();
    expect(how()).toHaveLength(0);
    // ... and as on a later run of the app, when only the device's memory is left.
    forgetHiddenHowItWorks();
    await act(async () => tree.unmount()); await render();
    expect(how()).toHaveLength(0); expect(action('Objavi zadatak')).toBeDefined();
  });

  it('is not drawn when the device already remembers it was hidden', async () => {
    mockStored.set(HOW_IT_WORKS_KEY, '1');
    await render();
    expect(how()).toHaveLength(0); expect(text()).not.toContain('Kako radi');
    expect(action('Objavi zadatak')).toBeDefined(); expect(action('Uskoči i zaradi')).toBeDefined();
  });

  it('still hides when the device cannot write, for as long as the app runs, and shows once more if it cannot read either', async () => {
    mockStorageDown = true;
    await render();
    // Nothing could be read: the row is shown (an unreadable receipt is not a reason to withhold it) ...
    expect(how()).toHaveLength(1);
    await act(async () => hide().props.onPress());
    // ... and a hide that could not be written still holds: the screen does not break, and the row does not come back this run.
    expect(how()).toHaveLength(0);
    await act(async () => tree.unmount()); await render();
    expect(how()).toHaveLength(0);
    forgetHiddenHowItWorks();
    await act(async () => tree.unmount()); await render();
    expect(how()).toHaveLength(1);
  });

  it.each([
    ['a first draft', () => mockSource.mojePotrebe.mockResolvedValue([need('nacrt', { stanje: 'NACRT' })])],
    ['a first application', () => mockSource.mojePrijave.mockResolvedValue([application('p')])],
    ['a first Dogovor', () => mockSource.mojiDogovori.mockResolvedValue([agreement('d', 'uskocer')])],
    ['a first thing that waits', () => mockSource.paznjaZaPocetnu.mockResolvedValue({ rows: [{ id: 'need:n:applications', title: '1 prijava', detail: 'x',
      target: { kind: 'CANDIDATES', needId: 'n' } }], more: 0, asOf: '2026-09-22T10:00:00Z' })],
  ])('the row is gone with %s', async (_name, arrange) => {
    arrange();
    await render();
    expect(how()).toHaveLength(0); expect(text()).not.toContain('Kako radi'); expect(text()).toContain('Čeka te');
  });

  it('never sees it while a read is missing: a failed read is not an empty account', async () => {
    mockSource.mojePrijave.mockRejectedValue(new Error('APPLICATIONS_FAILED'));
    await render();
    expect(how()).toHaveLength(0); expect(text()).not.toContain('Kako radi');
  });
});

it('while the first read is on its way it shows the doors, the heading and one row of what will come, and the two lists without a count', async () => {
  const handlers = await direct(null, { loading: true });
  // The skeleton has the geometry of what is coming: the heading and two rows (picture slot, two lines), breathing as one.
  expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Učitavanje' && node.props.accessible === true).length).toBeGreaterThan(0);
  expect(text()).not.toContain('Čeka te'); expect(text()).not.toContain('Ništa ne čeka tvoju odluku.'); expect(text()).not.toContain('Opiši zadatak');
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci'); expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave');
  await act(async () => action('Objavi zadatak').onPress()); expect(handlers.onPublish).toHaveBeenCalledTimes(1);
});

it('keeps the same launch targets mounted as the initial overview read completes', async () => {
  const wait = deferred<never[]>(); mockSource.mojePotrebe.mockReturnValue(wait.promise);
  await render();
  const before = ['Objavi zadatak', 'Uskoči i zaradi'].map(label => tree.root.findAll(
    node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0]);
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci');
  await act(async () => wait.resolve([]));
  before.forEach((entry, index) => expect(tree.root.findAll(node => String(node.type) === 'Press'
    && node.props.accessibilityLabel === ['Objavi zadatak', 'Uskoči i zaradi'][index])[0]).toBe(entry));
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. Još nemaš zadatak');
});

it('an account with a withdrawn application says that none waits for an answer, not that it has no application history', async () => {
  mockSource.mojePrijave.mockResolvedValue([{ ...application('stara'), stanje: 'WITHDRAWN' }]);
  await render();
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. Nijedna ne čeka odgovor');
  expect(text()).not.toContain('Još nemaš prijavu');
});

it('a failed refresh never claims an empty account: the last overview stays, one line says so, and both start tiles stay available (R31)', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman')]);
  await render();
  for (const read of Object.values(mockSource)) read.mockRejectedValue(new Error('READ_FAILED'));
  const refresh = tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl.props.onRefresh;
  await act(async () => refresh());
  // What was read before is still what is shown; the line says it is the last one, and the one action reads again.
  expect(text()).toContain('Nema veze. Prikazano je poslednje učitano.'); expect(text()).toContain('1 aktivan');
  expect(text()).not.toContain('Pregled nije učitan'); expect(action('Osveži pregled')).toBeDefined();

  expect(action('Objavi zadatak')).toBeDefined(); expect(action('Uskoči i zaradi')).toBeDefined();
  await act(async () => action('Uskoči i zaradi').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith('/zadaci');
});

// The white dot on the owner's phone (8 Oct 2026) was Android's pull spinner, raised by a read nobody pulled. Only a pull raises it.
it('raises the pull spinner for a pull only: a read the screen runs for another reason does not draw it', async () => {
  const handlers = await direct(emptyHome(), { refreshing: true });
  const control = () => tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl.props;
  expect(control().refreshing).toBe(false);
  await act(async () => control().onRefresh());
  expect(handlers.onRefresh).toHaveBeenCalledTimes(1);
  expect(control().refreshing).toBe(true);
  await act(async () => tree.update(<HomePresentation home={emptyHome()} loading={false} refreshing={false} error={false} {...handlers} />));
  expect(control().refreshing).toBe(false);
});

it('through the route: a pull reads again under the spinner, and the spinner goes with the read', async () => {
  await render();
  const control = () => tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl.props;
  expect(control().refreshing).toBe(false);
  const wait = deferred<never[]>(); mockSource.mojePotrebe.mockReturnValue(wait.promise);
  await act(async () => control().onRefresh());
  expect(control().refreshing).toBe(true);
  await act(async () => wait.resolve([]));
  expect(control().refreshing).toBe(false);
});

it('logout of A and login of B never shows A, and a late answer for A cannot paint over B', async () => {
  const late = deferred<unknown[]>(); mockSource.mojePotrebe.mockReturnValueOnce(late.promise);
  await render();
  mockSession = { user: { id: B }, accountRevision: 2 }; mockSource.mojePotrebe.mockResolvedValue([need('b-task')]);
  await act(async () => tree.update(<Pocetna />));
  // A's late list holds two tasks, B's one: only B's count may stand.
  await act(async () => late.resolve([need('a-private'), need('a-second')]));
  expect(text()).not.toContain('2 aktivna'); expect(text()).toContain('1 aktivan');
});

it('returning Home enables current navigation while its silent refresh waits, without reviving a retired callback', async () => {
  await render();
  const retired = action('Uskoči i zaradi').onPress;
  await act(async () => { mockFocused = false; tree.update(<Pocetna />); });
  const wait = deferred<never[]>(); mockSource.mojePotrebe.mockReturnValue(wait.promise);
  try {
    await act(async () => { mockFocused = true; tree.update(<Pocetna />); });
    expect(mockSource.mojePotrebe).toHaveBeenCalledTimes(2);
    await act(async () => retired());
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    await act(async () => action('Uskoči i zaradi').onPress());
    expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).toHaveBeenCalledWith('/zadaci');
  } finally {
    await act(async () => wait.resolve([]));
  }
});

// UI/UX pass, 2026-10-08 (F1): "Početna ne laže". What waits for me that only the Dogovori and own-task reads can tell stands in "Čeka te" after the
// server's rows, each one opens the place that settles it, and the calm sentence is never said over any of them.
describe('what the phone adds to "Čeka te" (R02, a change to answer, R18) and what it asks of the work profile (R20, R06)', () => {
  const profileRead = jest.fn();
  beforeEach(() => {
    (mockSource as Record<string, unknown>).mojRadnikProfil = profileRead;
    profileRead.mockReset(); profileRead.mockResolvedValue(null);
    mockAvailability.read.mockReset(); mockAvailability.save.mockReset();
  });
  afterEach(() => { delete (mockSource as Record<string, unknown>).mojRadnikProfil; });
  const termless = (id: string, patch: object = {}) => ({ ...agreement(id, 'narucilac'), naslov: 'Krečenje stana u belo', vremeTekst: 'Termin nije potvrđen',
    prihvacenPocetak: null, tacanTermin: null, izmenaCeka: null, ...patch });
  const week = { timezone: 'Europe/Belgrade', rules: [], windows: [] };
  const available = (value: boolean) => ({ ...week, availableNow: value, accountId: A, profileId: 'p1', revision: 'rev-1' });
  const switchNode = () => tree.root.findAll(node => node.props.accessibilityLabel === 'Mogu odmah' && typeof node.props.onValueChange === 'function')[0];

  it('asks for a term where a confirmed Dogovor has none, opens the form that proposes one, and no longer says that nothing waits (R02)', async () => {
    mockSource.mojiDogovori.mockResolvedValue([termless('krecenje')]);
    await render();
    expect(heading('Čeka te')).toHaveLength(1);
    expect(text()).toContain('Krečenje stana u belo'); expect(text()).toContain('Predloži termin');
    // The action and the task, and nothing else the eye has to read twice (the owner's phone, 8 Oct 2026): the sentence that repeated the
    // action is in the label a screen reader hears, and nowhere else. With no appointment ahead this is the one record that leads: the action
    // first, as a heading.
    expect(text()).not.toContain('Termin još nije dogovoren.');
    expect(tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).includes('Predloži termin'))[0]
      .findAll(node => String(node.type) === 'T').map(node => node.props.children)).toEqual(['Krečenje stana u belo', 'Predloži termin']);
    expect(text()).not.toContain('Ništa ne čeka tvoju odluku.');
    expect(row('Predloži termin').accessibilityLabel).toBe('Krečenje stana u belo. Predloži termin. Termin još nije dogovoren.');
    await act(async () => row('Predloži termin').onPress());
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]/izmene', params: { id: 'krecenje', start: 'propose' } });
  });

  it('puts the change the other side proposed before the term, and opens the changes screen for it', async () => {
    mockSource.mojiDogovori.mockResolvedValue([termless('a'), termless('b', { naslov: 'Montaža police', izmenaCeka: { predlogId: 'p', mojPredlog: false } })]);
    await render();
    const labels = tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).includes('Odgovori na predlog')
      || String(node.type) === 'Press' && String(node.props.accessibilityLabel).includes('Predloži termin')).map(node => String(node.props.accessibilityLabel));
    expect(labels).toEqual(['Montaža police. Odgovori na predlog izmene. Druga strana predlaže izmenu uslova.',
      'Predloži termin. Krečenje stana u belo. Termin još nije dogovoren.']);
    await act(async () => row('Odgovori na predlog izmene').onPress());
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]/izmene', params: { id: 'b' } });
  });

  it('never says what it cannot know: a Dogovor the list did not read the terms of, one with a start, a finished one, or my own waiting proposal', async () => {
    mockSource.mojiDogovori.mockResolvedValue([agreement('unread', 'uskocer'), termless('lone', { prihvacenPocetak: '2026-10-07T12:00:00Z' }),
      termless('done', { stanje: 'COMPLETED', ocenaMoguca: false }), termless('mine', { izmenaCeka: { predlogId: 'p', mojPredlog: true } })]);
    await render();
    expect(text()).not.toContain('Predloži termin'); expect(text()).not.toContain('Odgovori na predlog');
    expect(text()).toContain('Ništa ne čeka tvoju odluku.');
  });

  it('does not say that nothing waits while the Dogovori could not be read: only they can tell whether a term is missing', async () => {
    mockSource.mojiDogovori.mockRejectedValue(new Error('AGREEMENT_LIST_FAILED'));
    await render();
    expect(text()).not.toContain('Ništa ne čeka tvoju odluku.'); expect(text()).toContain('Ne možemo da učitamo Dogovore.');
  });

  it('offers the draft to continue and opens it (R18); a draft without a title, and a published task, are not offered', async () => {
    mockSource.mojePotrebe.mockResolvedValue([need('n1', { stanje: 'NACRT', naslov: 'Prevoz ormana iz Novog Sada' }), need('n2', { stanje: 'NACRT', naslov: '' }), need('n3')]);
    await render();
    expect(row('Nastavi nacrt').accessibilityLabel).toBe('Prevoz ormana iz Novog Sada. Nastavi nacrt. Nacrt još nije objavljen.');
    expect(tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).includes('Nastavi nacrt'))).toHaveLength(1);
    // Two lines, not three: the task and "Nastavi nacrt" (the owner's phone said the draft twice, "Nastavi nacrt / Nacrt još nije objavljen.").
    expect(text()).not.toContain('Nacrt još nije objavljen.');
    // Two drafts here (one of them has no title to name it by), so the door says how many there are.
    expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. 1 aktivan · 2 nacrta');
    await act(async () => row('Nastavi nacrt').onPress());
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/pregled', params: { id: 'n1' } });
  });

  it('counts the drafts in the door when there are more than the one that "Čeka te" offers, and when none is offered', async () => {
    mockSource.mojePotrebe.mockResolvedValue([need('a'), need('n1', { stanje: 'NACRT', naslov: 'Prevoz ormana iz Novog Sada' }), need('n4', { stanje: 'NACRT', naslov: 'Drugi nacrt' })]);
    await render();
    expect(row('Nastavi nacrt')).toBeDefined(); expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. 1 aktivan · 2 nacrta');
    await act(async () => tree.unmount());
    // A draft that nothing offers (it has no title to name it by) is still a draft of the list, and the door counts it.
    mockSource.mojePotrebe.mockResolvedValue([need('a'), need('n2', { stanje: 'NACRT', naslov: '' })]);
    await render();
    expect(tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).includes('Nastavi nacrt'))).toHaveLength(0);
    expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. 1 aktivan · 1 nacrt');
  });

  it.each([['an account with no work profile', null], ['a profile that is still a draft', { stanje: 'DRAFT', dostupanOdmah: false }]])(
    'says what the work profile is for and opens its conversation for %s (R20)', async (_name, profile) => {
      profileRead.mockResolvedValue(profile);
      await render();
      expect(row('Podesi radni profil').accessibilityLabel).toBe('Podesi radni profil. Dobijaš zadatke koji ti odgovaraju.');
      expect(text()).toContain('Dobijaš zadatke koji ti odgovaraju.');
      expect(switchNode()).toBeUndefined();
      await act(async () => row('Podesi radni profil').onPress());
      expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/razgovor');
    });

  it.each([['an active profile', { stanje: 'ACTIVE', dostupanOdmah: false }], ['a suspended one', { stanje: 'SUSPENDED', dostupanOdmah: false }]])(
    'asks nothing about the work profile of %s, and a profile that could not be read is not said to be missing', async (_name, profile) => {
      profileRead.mockResolvedValue(profile);
      await render();
      expect(text()).not.toContain('Podesi radni profil');
      await act(async () => tree.unmount());
      profileRead.mockRejectedValue(new Error('PROFILE_FAILED'));
      await render();
      expect(text()).not.toContain('Podesi radni profil'); expect(text()).not.toContain('Deo pregleda');
    });

  // The owner's phone, 8 Oct 2026: "Slobodan sam sada / Uključeno. Važi dok ga ne isključiš." was a masculine form and a second name for what
  // Dostupnost calls "Mogu odmah". The row is called what Dostupnost calls it, and says "Uključeno" or nothing.
  it('draws the "Mogu odmah" switch only for an active profile, saves the saved week with only the status changed, and says "Uključeno" once it is on (R06)', async () => {
    profileRead.mockResolvedValue({ stanje: 'ACTIVE', dostupanOdmah: false });
    mockAvailability.read.mockResolvedValue({ ok: true, podatak: available(false) });
    mockAvailability.save.mockResolvedValue({ ok: true, podatak: { saved: true, idempotentReplay: false, availability: available(true) } });
    await render();
    expect(text()).toContain('Mogu odmah'); expect(text()).not.toContain('Slobodan sam'); expect(text()).not.toContain('Uključi kad možeš da kreneš odmah.');
    expect(text()).not.toContain('Uključeno');
    expect(switchNode().props.value).toBe(false);
    await act(async () => switchNode().props.onValueChange(true));
    expect(mockAvailability.read).toHaveBeenCalledTimes(1);
    expect(mockAvailability.save).toHaveBeenCalledWith({ expectedRevision: 'rev-1', value: { ...week, availableNow: true } });
    expect(switchNode().props.value).toBe(true); expect(switchNode().props.disabled).toBeFalsy();
    expect(text()).toContain('Uključeno'); expect(text()).not.toContain('Važi dok ga ne isključiš.');
  });

  it('shows the switch at work while it saves, ignores a second touch, and returns it to where it was, saying so, when the save is not confirmed', async () => {
    profileRead.mockResolvedValue({ stanje: 'ACTIVE', dostupanOdmah: true });
    const read = deferred<unknown>(); mockAvailability.read.mockReturnValue(read.promise);
    await render();
    expect(switchNode().props.value).toBe(true);
    await act(async () => switchNode().props.onValueChange(false));
    expect(switchNode().props.value).toBe(false); expect(switchNode().props.disabled).toBe(true); expect(text()).toContain('Čuvamo…');
    await act(async () => switchNode().props.onValueChange(true));
    expect(mockAvailability.read).toHaveBeenCalledTimes(1);
    await act(async () => read.resolve({ ok: false, kod: 'WORKER_AVAILABILITY_READ_FAILED', poruka: 'x' }));
    expect(switchNode().props.value).toBe(true); expect(switchNode().props.disabled).toBeFalsy();
    expect(text()).toContain('Nije sačuvano. Pokušaj ponovo.'); expect(mockAvailability.save).not.toHaveBeenCalled();
    // A conflict or a refusal at the save says the same, and the next read of the screen is the truth again.
    mockAvailability.read.mockResolvedValue({ ok: true, podatak: available(true) });
    mockAvailability.save.mockResolvedValue({ ok: false, kod: 'AVAILABILITY_VERSION_CONFLICT', poruka: 'x' });
    await act(async () => switchNode().props.onValueChange(false));
    expect(switchNode().props.value).toBe(true); expect(text()).toContain('Nije sačuvano. Pokušaj ponovo.');
  });
});
