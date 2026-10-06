import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let mockSession = { user: { id: A }, accountRevision: 1 };
let mockFocused = true;
let mockAppState = 'active';
const mockAppStateListeners = new Set<(state: string) => void>();
let mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
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
import { StyleSheet } from 'react-native';
import { HomePresentation } from '../../ui/home/HomePresentation';
import { composeHome } from '../homeSnapshot';
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
const row = (start: string) => tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith(start))[0].props;
const render = async () => { await act(async () => { tree = create(<Pocetna />); }); };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

beforeEach(() => {
  jest.clearAllMocks(); mockSession = { user: { id: A }, accountRevision: 1 }; mockFocused = true;
  mockAppState = 'active'; mockAppStateListeners.clear();
  mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
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
// counted front doors instead of a preview of their rows, and the one next Dogovor says what I am to it.
it('shows both sides of one account and labels an undated active Dogovor without inventing a next appointment', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman')]); mockSource.mojePrijave.mockResolvedValue([application('polica')]);
  mockSource.mojiDogovori.mockResolvedValue([agreement('g-a', 'narucilac'), agreement('g-c', 'uskocer')]);
  await render();
  const copy = text();
  expect(copy).toContain('Moji zadaci'); expect(copy).toContain('1 aktivan');
  expect(copy).toContain('Moje prijave'); expect(copy).toContain('1 aktivna');
  expect(copy).toContain('Aktivni Dogovor'); expect(copy).not.toContain('Sledeći Dogovor'); expect(copy).toContain('Tvoj zadatak');
  expect(copy).not.toContain('Objavio si'); expect(copy).not.toContain('Uskočio si');
  // One next Dogovor; the other is one tab away, and no "Svi Dogovori" link repeats the tab.
  expect(tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith('Dogovor g-c'))).toHaveLength(0);
  expect(copy).not.toContain('Svi Dogovori');
  await act(async () => row('Dogovor g-a').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'g-a' } });
});

it('names and opens the upcoming accepted appointment ahead of work awaiting completion', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-27T10:00:00Z'));
  mockSource.mojiDogovori.mockResolvedValue([
    { ...agreement('yesterday', 'narucilac'), stanje: 'AWAITING_REQUESTER', prihvacenPocetak: '2026-09-26T08:00:00Z' },
    { ...agreement('tomorrow', 'uskocer'), prihvacenPocetak: '2026-09-28T08:00:00Z', vremeTekst: '28. sep · 10:00' },
  ]);
  await render();
  expect(text()).toContain('Sledeći Dogovor'); expect(text()).not.toContain('Aktivni Dogovor');
  expect(text()).toContain('28. sep · 10:00'); expect(text()).not.toContain('Dogovor yesterday');
  await act(async () => row('Dogovor tomorrow').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'tomorrow' } });
});

it.each([[390, 1], [320, 2]])('keeps the appointment time, role, task and person readable and separately worded at %idp / font %i', async (width, fontScale) => {
  mockWindow = { width, height: 844, scale: 3, fontScale };
  const title = 'Popravka police u dnevnoj sobi i postavljanje velikog ogledala';
  const timeText = 'Fleksibilno · tokom sledeće nedelje';
  const person = 'Jelena Petrović · Servis';
  const source = { ...agreement('agenda', 'uskocer'), naslov: title, vremeTekst: timeText, pocinje: '2026-09-25T09:00:00Z' };
  source.ucesnici[1].ime = person;
  mockSource.mojiDogovori.mockResolvedValue([source]);
  await render();
  const card = tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith(title))[0];
  const facts = card.findAll(node => String(node.type) === 'T');
  expect(facts.map(node => node.props.children)).toEqual([title, timeText, person, 'Uskačeš']);
  expect(card.props.accessibilityLabel).toBe(`${title}. Uskačeš · ${person} · ${timeText}`);
  expect(card.props.accessibilityHint).toBe('Otvara Dogovor.');
  // Work leads the appointment at either size; facts have no shortened text, decorative inset or fixed-height ancestor.
  for (const fact of facts) {
    expect(fact.props.numberOfLines).toBeUndefined(); expect(fact.props.allowFontScaling).not.toBe(false);
    for (let ancestor: ReactTestInstance | null = fact; ancestor && ancestor !== card.parent; ancestor = ancestor.parent) {
      const style = StyleSheet.flatten(ancestor.props.style) ?? {};
      expect(style.height).toBeUndefined(); expect(style.maxHeight).toBeUndefined();
    }
  }
  expect(text()).not.toContain('2026-09-25');
  await act(async () => card.props.onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'agenda' } });
});

it('keeps a legacy HomeRow readable and navigable without parsing its detail into appointment facts', async () => {
  const home = composeHome({ needs: { kind: 'known', value: [] }, applications: { kind: 'known', value: [] },
    agreements: { kind: 'known', value: [] } });
  const target = { kind: 'AGREEMENT' as const, agreementId: 'legacy' };
  const detail = 'Jelena · vreme još nije određeno';
  home.firstRun = false;
  home.agreements = { kind: 'known', value: { more: 0, rows: [{ id: 'agreement:legacy', title: 'Dogovor legacy', detail, target }] } };
  const onOpen = jest.fn();
  await act(async () => { tree = create(<HomePresentation home={home} loading={false} refreshing={false} error={false}
    onOpen={onOpen} onPublish={jest.fn()} onEarn={jest.fn()} onProfile={jest.fn()} onRatings={jest.fn()}
    onMyTasks={jest.fn()} onMyApplications={jest.fn()} onRefresh={jest.fn()} />); });
  const card = tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith('Dogovor legacy'))[0];
  expect(card.findAll(node => String(node.type) === 'T').map(node => node.props.children)).toEqual(['Dogovor legacy', detail]);
  await act(async () => card.props.onPress());
  expect(onOpen).toHaveBeenCalledWith(target);
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
  const taskTitle = 'Police · dnevna soba i veliko ogledalo';
  mockSource.paznjaZaPocetnu.mockResolvedValue({ rows: [{ id: 'application:changed:stale', title: 'Zadatak je izmenjen',
    taskTitle, detail: 'Pregledaj izmene pre odluke o prijavi.', target: { kind: 'APPLICATION', applicationId: 'changed' } }],
    more: 0, asOf: '2026-09-27T10:00:00Z' });
  await render();
  const attention = tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith('Zadatak je izmenjen'))[0];
  const facts = attention.findAll(node => String(node.type) === 'T');
  expect(facts.map(node => node.props.children)).toEqual([taskTitle, 'Zadatak je izmenjen', 'Pregledaj izmene pre odluke o prijavi.']);
  expect(attention.props.accessibilityLabel).toBe(`Zadatak je izmenjen. ${taskTitle}. Pregledaj izmene pre odluke o prijavi.`);
  expect(text().split(taskTitle)).toHaveLength(2);
  for (const fact of facts) {
    expect(fact.props.numberOfLines).toBeUndefined(); expect(fact.props.allowFontScaling).not.toBe(false);
  }
  await act(async () => attention.props.onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/moje-prijave', params: { prijavaId: 'changed' } });
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
  expect(text()).toContain('Dogovori trenutno nisu učitani.'); expect(text()).not.toContain('Nemaš aktivan Dogovor.');
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
  expect(text()).toContain('Dogovori trenutno nisu učitani.');
  expect(text()).toContain('Podaci o obavezama trenutno nisu učitani.');
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. Trenutno nisu učitane');
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
    expect(text()).toContain('Pregled trenutno nije učitan.');
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
  expect(text()).toContain('Pregled trenutno nije učitan.');
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. Trenutno nisu učitani');
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. Trenutno nisu učitane');
  expect(text()).not.toMatch(/\b0\b/); expect(text()).not.toContain('Još nemaš');
  expect(action('Objavi zadatak')).toBeDefined();
});

it('one failed side says it is not loaded while the other is counted', async () => {
  mockSource.mojePrijave.mockRejectedValue(new Error('APPLICATIONS_FAILED')); mockSource.mojePotrebe.mockResolvedValue([need('orman'), need('nacrt', { stanje: 'NACRT' })]);
  await render();
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. 1 aktivan · 1 nacrt');
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. Trenutno nisu učitane');
});

// Serbian counts take three shapes by the last two digits (plural.ts): a final 1 but not 11, a final 2–4 but not
// 12–14, and everything else. 1 is covered above; 2, 5, 11 and 21 are the other edges.
it.each([
  [2, 'Moji zadaci. 2 aktivna · 2 nacrta', 'Moje prijave. 2 aktivne', 'Moje prijave. 2 prijave'],
  [5, 'Moji zadaci. 5 aktivnih · 5 nacrta', 'Moje prijave. 5 aktivnih', 'Moje prijave. 5 prijava'],
  [11, 'Moji zadaci. 11 aktivnih · 11 nacrta', 'Moje prijave. 11 aktivnih', 'Moje prijave. 11 prijava'],
  [21, 'Moji zadaci. 21 aktivan · 21 nacrt', 'Moje prijave. 21 aktivna', 'Moje prijave. 21 prijava'],
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
  expect(tree.root.findByProps({ accessibilityLabel: 'Čeka te' }).props).toMatchObject({ accessible: true, accessibilityRole: 'header' });

  await act(async () => row('Zadatak je izmenjen').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/moje-prijave', params: { prijavaId: 'server' } });
});

it('PKG-042: attention failure is explicit and never replaced with conclusions from old lists', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('old', { brojPrijava: 2, brojPrijavaZaIzbor: 2 })]);
  mockSource.paznjaZaPocetnu.mockRejectedValue(new Error('PRIVATE_BACKEND_ERROR'));
  await render();
  expect(text()).toContain('Podaci o obavezama trenutno nisu učitani.');
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
  expect(text()).not.toContain('Čeka te'); expect(text()).toContain('1 aktivan');
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
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. Još nemaš Zadatak');
});

it('a known empty account names both empty lists without invented zero statistics', async () => {
  await render();
  expect(text()).not.toMatch(/\b0\b/);
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. Još nemaš Zadatak');
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. Još nemaš prijavu');
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
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. Još nemaš Zadatak');
});

it('an account with a withdrawn application says no active applications, not no application history', async () => {
  mockSource.mojePrijave.mockResolvedValue([{ ...application('stara'), stanje: 'WITHDRAWN' }]);
  await render();
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. Nema aktivnih prijava');
  expect(text()).not.toContain('Još nemaš prijavu');
});

it('a failed refresh never claims an empty account and keeps both new start tiles available', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman')]);
  await render();
  for (const read of Object.values(mockSource)) read.mockRejectedValue(new Error('READ_FAILED'));
  const refresh = tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl.props.onRefresh;
  await act(async () => refresh());
  expect(text()).toContain('Pregled trenutno nije učitan.');

  expect(action('Objavi zadatak')).toBeDefined(); expect(action('Uskoči i zaradi')).toBeDefined();
  await act(async () => action('Uskoči i zaradi').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith('/zadaci');
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
