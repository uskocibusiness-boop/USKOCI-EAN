import React from 'react';
import { AccessibilityInfo, Animated, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { BlurView } from 'expo-blur';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView, type PublicBounds } from '../marketplaceView';
import { discoveryV1SearchPreviewKey, type DiscoveryV1SearchSnapshot, type SearchPreviewView } from '../discoveryV1SearchOwner';
// The window the panel is drawn in: React Native's Jest default (a 2× text size) unless a test says otherwise.
let mockWindow = { width: 750, height: 1334, scale: 2, fontScale: 2 };
let mockKeyboardVisible = false;
const mockKeyboardDismiss = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  // One stable function: a new one on every read would be a new component type, and React would mount the panel again.
  const Modal = ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
  const Keyboard = { dismiss: () => mockKeyboardDismiss(), isVisible: () => mockKeyboardVisible };
  const useWindowDimensions = () => mockWindow;
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return Modal;
    if (key === 'Keyboard') return Keyboard;
    if (key === 'useWindowDimensions') return useWindowDimensions;
    return ['View', 'ScrollView', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
// No provider by default: the insets read 0, as under every other suite. A test that wants insets supplies a value.
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', SafeAreaInsetsContext: require('react').createContext(null) }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { DiscoverySearchPanel, NO_SEARCH, type DiscoveryV1SearchPanelSeam, type SearchDraft, type SearchReadiness, type SearchStep } from '../../ui/v2/discovery/DiscoverySearchPanel';
import { sys } from '../../ui/system/tokens';

/**
 * The Zadaci search panel as an Airbnb-style panel (owner, 2026-10-07): separate collapsible sections in the order Gde,
 * Kada, Šta, Cena, Broj ljudi, Način rada; one open at a time; a choice that completes a question opens the next; "Gde" is a
 * place list that fills the screen when it is scrolled; the screen behind is blurred where the platform can and dimmed where
 * it cannot, never a white page. Choices are a draft: the one green action applies it and counts it, "Poništi filtere"
 * empties it, × leaves the list as it was. "Gde" offers the places the tasks name and, under them, the biggest cities.
 */
// Thursday 24 September 2026, 10:00 in Belgrade: the 23rd is past, the 26th and 27th are the weekend.
const NOW = new Date('2026-09-24T08:00:00Z');
const day = (date: string) => ({ schedule: { kind: 'FIXED_WINDOW' as const, startsAt: `${date}T10:00:00+02:00`, endsAt: `${date}T12:00:00+02:00` } });
const row = (id: string, patch: Record<string, unknown> = {}): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`, podrucjeTekst: 'Liman, Novi Sad',
  vremeTekst: 'Po dogovoru', uslovi: [], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, priblizno: { lat: 45.25, lng: 19.84 }, taskTimezone: 'Europe/Belgrade',
  ...day('2026-09-26'), ...patch } as unknown as MarketplaceItem);
let rows: MarketplaceItem[] = [], view: MarketplaceView, mine: ReadonlySet<string> | undefined, mapArea: PublicBounds | null, start: SearchStep;
let readiness: SearchReadiness = 'ready', p6Search: DiscoveryV1SearchPanelSeam | undefined, reduced = true, canNearby = false;
let blurTarget: { current: null } | undefined;
const apply = jest.fn(), close = jest.fn();
let tree: ReactTestRenderer;
const panelOf = () => <DiscoverySearchPanel items={rows} view={view} mine={mine} now={NOW} mapArea={mapArea} blurTarget={blurTarget}
  start={start} reduced={reduced} readiness={readiness} p6Search={p6Search} canNearby={canNearby} onApply={apply} onClose={close} />;
const render = async () => act(async () => { tree = create(panelOf()); });
const byId = (testID: string) => tree.root.findAll(node => node.props.testID === testID)[0];
const byLabel = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label);
const tap = async (label: string) => act(async () => byLabel(label)[0].props.onPress());
const radio = (label: string | RegExp) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'radio'
  && (typeof label === 'string' ? node.props.accessibilityLabel === label : label.test(node.props.accessibilityLabel)));
const choose = async (label: string | RegExp) => act(async () => radio(label)[0].props.onPress());
const texts = (root: ReactTestInstance = tree.root) => root.findAllByType('T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
const stepIds: Record<string, SearchStep> = { 'search-place-toggle': 'gde', 'search-kada-toggle': 'kada', 'search-sta-toggle': 'sta',
  'search-cena-toggle': 'cena', 'search-koliko-toggle': 'koliko', 'search-kako-toggle': 'kako' };
const openStep = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityState?.expanded && stepIds[node.props.testID])
  .map(node => stepIds[node.props.testID]);
const placeValue = () => tree.root.findByProps({ testID: 'search-place-toggle' }).props.accessibilityValue.text;
const valueOf = (testID: string) => tree.root.findByProps({ testID }).props.accessibilityValue.text;
const dateValue = () => tree.root.findByProps({ testID: 'search-date-toggle' }).props.accessibilityValue.text;
/** Every row of "Gde" (a choice or a button leading on), in order. */
const placeRows = () => tree.root.findByProps({ accessibilityLabel: 'Mesta' })
  .findAll(node => String(node.type) === 'Press' && (node.props.accessibilityRole === 'radio' || node.props.accessibilityRole === 'button'));
const offered = () => placeRows().map(node => node.props.accessibilityLabel);
const show = () => tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.style !== undefined && node.props.kind === undefined)!;
const dayCell = (dayOfMonth: number) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'button'
  && new RegExp(`, ${dayOfMonth}\\. sep`).test(node.props.accessibilityLabel ?? ''))[0];
const lastDraft = (): SearchDraft => apply.mock.calls[apply.mock.calls.length - 1][0];
const typeWhere = async (text: string) => act(async () => tree.root.findByProps({ accessibilityLabel: 'Pretraži mesta' }).props.onChangeText(text));
/** The text field itself (the host element), not the component that draws it: both carry the test id. */
const whatField = () => tree.root.findAll(node => String(node.type) === 'TextInput' && node.props.testID === 'search-what-field')[0];
const typeWhat = async (text: string) => act(async () => whatField().props.onChangeText(text));
const dragList = async () => act(async () => tree.root.findByType('ScrollView' as React.ElementType).props.onScrollBeginDrag());
const sheetHeight = () => (StyleSheet.flatten(byId('search-sheet').props.style).height as unknown as { __getValue(): number }).__getValue();
/** The sheet's top corner: round at rest, square once it fills the screen. */
const sheetCorner = () => {
  const corner = StyleSheet.flatten(byId('search-sheet').props.style).borderTopLeftRadius as unknown;
  return typeof corner === 'number' ? corner : (corner as { __getValue(): number }).__getValue();
};
const withPlatform = async (os: 'android' | 'ios', version: number | string, body: () => Promise<void>) => {
  const was = { os: Object.getOwnPropertyDescriptor(Platform, 'OS'), version: Object.getOwnPropertyDescriptor(Platform, 'Version') };
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
  Object.defineProperty(Platform, 'Version', { configurable: true, value: version });
  try { await body(); } finally {
    if (was.os) Object.defineProperty(Platform, 'OS', was.os);
    if (was.version) Object.defineProperty(Platform, 'Version', was.version);
  }
};

/** Animations stand still until the test finishes them: what is asked of the driver is read, and what follows a finish is checked. */
type Run = { kind: 'timing' | 'spring'; value: Animated.Value; config: Record<string, unknown>; callback?: (result: { finished: boolean }) => void };
let runs: Run[] = [];
const holdAnimations = () => {
  runs = [];
  const make = (kind: Run['kind']) => (value: Animated.Value, config: Record<string, unknown>) => ({
    start: (callback?: Run['callback']) => { runs.push({ kind, value, config, callback }); }, stop: () => undefined, reset: () => undefined,
    _startNativeLoop: () => undefined, _isUsingNativeDriver: () => false,
  });
  jest.spyOn(Animated, 'timing').mockImplementation(make('timing') as never);
  jest.spyOn(Animated, 'spring').mockImplementation(make('spring') as never);
};
const finishAnimations = async () => act(async () => {
  for (const run of runs.filter(entry => entry.callback)) { run.value.setValue(Number(run.config.toValue)); const callback = run.callback!; run.callback = undefined; callback({ finished: true }); }
});

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  rows = [row('a'), row('b', { podrucjeTekst: 'Vračar, Beograd', priblizno: { lat: 44.8, lng: 20.48 } }),
    row('c', { podrucjeTekst: 'Liman,  Novi Sad', rezimCene: 'OFFERS', ponudjenaCena: undefined, ...day('2026-09-30') }),
    row('remote', { podrucjeTekst: 'Na daljinu', priblizno: null, detalji: { rezimLokacije: 'REMOTE' } }),
    row('mine', { podrucjeTekst: 'Zemun, Beograd' })];
  view = { ...initialMarketplaceView(), mode: 'map' }; mine = new Set(['mine']); mapArea = null; start = 'gde'; readiness = 'ready'; p6Search = undefined;
  reduced = true; canNearby = false; blurTarget = undefined;
  mockWindow = { width: 750, height: 1334, scale: 2, fontScale: 2 };
  apply.mockReset(); close.mockReset(); mockKeyboardVisible = false; mockKeyboardDismiss.mockReset();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });

const p6Snapshot = (patch: Partial<DiscoveryV1SearchSnapshot> = {}): DiscoveryV1SearchSnapshot => ({
  active: true, generation: 1, key: discoveryV1SearchPreviewKey({ ...view, placeSearch: '' } as SearchPreviewView, mapArea), status: 'ready', count: 37, undated: 6,
  availability: { hasKnownWorkMode: true, hasKnownSchedule: true, priceModes: ['MY_PRICE', 'OFFERS'] },
  places: [{ key: 'novi sad, liman', text: 'Novi Sad, Liman', count: 21 }, { key: 'beograd, vračar', text: 'Beograd, Vračar', count: 9 }],
  parts: [], placeHasMore: false, placePaging: false, everywhere: 80, inMapArea: mapArea ? 23 : null, facetError: false, ...patch,
});
const p6Seam = (snapshot: DiscoveryV1SearchSnapshot): DiscoveryV1SearchPanelSeam => ({
  snapshot, onDraft: jest.fn(), onNextPlaces: jest.fn(),
});

describe('the server preview (P6)', () => {
  test('count and locality suggestions come from the server preview, never the bounded loaded rows', async () => {
    rows = [row('only-loaded-row')]; mapArea = [19, 44, 21, 46]; p6Search = p6Seam(p6Snapshot());
    await render();
    expect(show().props.label).toBe('Prikaži 37 zadataka');
    expect(offered().slice(0, 4)).toEqual(['Svi zadaci, 80 zadataka', 'Ova oblast, 23 zadatka', 'Novi Sad, Liman, 21 zadatak', 'Beograd, Vračar, 9 zadataka']);
  });

  test('a stale preview shows loading and never falls back to local row counts', async () => {
    rows = [row('a'), row('b')]; p6Search = p6Seam(p6Snapshot({ key: 'old-key', count: 999 }));
    await render();
    expect(show().props).toMatchObject({ label: 'Učitavamo zadatke…', disabled: true });
    expect(offered()[0]).toBe('Svi zadaci');
    expect(texts()).not.toContain('999');
    // Nothing is said missing while the places are still read: no city claims "Još nema zadataka" yet.
    expect(texts()).not.toContain('Još nema zadataka');
  });

  test('a facet failure keeps the authoritative task count usable and does not fabricate place zeroes', async () => {
    p6Search = p6Seam(p6Snapshot({ facetError: true, places: [], everywhere: null, inMapArea: null, count: 14 }));
    await render();
    expect(show().props).toMatchObject({ label: 'Prikaži 14 zadataka', disabled: false });
    expect(texts()).toContain('Mesta trenutno nisu dostupna. Pretraga zadataka i dalje radi.');
    expect(offered()[0]).toBe('Svi zadaci');
    expect(texts()).not.toContain('Još nema zadataka');
  });

  test('place continuation and the draft preview are explicit server callbacks; the letters typed in "Gde" ask for places only', async () => {
    mapArea = [19, 44, 21, 46];
    const seam = p6Seam(p6Snapshot({ placeHasMore: true })); p6Search = seam;
    await render();
    expect(seam.onDraft).toHaveBeenCalledWith(expect.objectContaining({ query: '', placeSearch: '' }), mapArea);
    const more = tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === 'Prikaži još mesta')!;
    await act(async () => more.props.onPress()); expect(seam.onNextPlaces).toHaveBeenCalledTimes(1);
    await typeWhere('vrač');
    // The letters are the places' prefix. They never become the tasks' own text filter (that is "Šta").
    expect(seam.onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ query: '', placeSearch: 'vrač' }), mapArea);
    expect(show().props.label).toBe('Učitavamo zadatke…');
    await act(async () => tree.root.findByType('ScrollView' as React.ElementType).props.onScrollBeginDrag());
    await tap('Šta'); await typeWhat('selidba');
    expect(seam.onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'selidba', placeSearch: 'vrač' }), mapArea);
  });

  test('the draft preview follows the map area by value: an equal clone asks for nothing, another area asks once', async () => {
    mapArea = [19, 44, 21, 46];
    const seam = p6Seam(p6Snapshot()); p6Search = seam;
    await render();
    expect(seam.onDraft).toHaveBeenCalledTimes(1);
    // The route hands the panel a fresh clone of its view with every snapshot; the same area in another array is not a new question.
    for (let again = 0; again < 3; again++) { mapArea = [...mapArea!] as PublicBounds; await act(async () => tree.update(panelOf())); }
    expect(seam.onDraft).toHaveBeenCalledTimes(1);
    mapArea = [19.5, 44.5, 20.5, 45.5];
    await act(async () => tree.update(panelOf()));
    expect(seam.onDraft).toHaveBeenCalledTimes(2);
    expect(seam.onDraft).toHaveBeenLastCalledWith(expect.anything(), [19.5, 44.5, 20.5, 45.5]);
  });

  test('cities are not judged missing while more places are still to be read: they lead to the places that contain the name', async () => {
    const seam = p6Seam(p6Snapshot({ placeHasMore: true })); p6Search = seam;
    await render();
    expect(texts()).not.toContain('Još nema zadataka');
    const subotica = byLabel('Subotica')[0];
    expect(subotica.props).toMatchObject({ accessibilityRole: 'button', accessibilityHint: 'Prikazuje mesta u ovom gradu.' });
    await act(async () => subotica.props.onPress());
    expect(tree.root.findByProps({ accessibilityLabel: 'Pretraži mesta' }).props.value).toBe('Subotica');
    expect(openStep()).toEqual(['gde']);
    expect(seam.onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ placeSearch: 'Subotica' }), null);
  });
});

describe('a city asked of the server', () => {
  test('that the server does not know either says "Još nema zadataka", and can then be chosen as an ordinary place', async () => {
    p6Search = p6Seam(p6Snapshot({ placeHasMore: true }));
    await render();
    await act(async () => byLabel('Subotica')[0].props.onPress());
    // The server answers the letters typed: no place contains them, and there are no more to read.
    p6Search = p6Seam(p6Snapshot({ key: discoveryV1SearchPreviewKey({ ...view, placeSearch: 'Subotica' } as SearchPreviewView, mapArea),
      places: [], placeHasMore: false }));
    await act(async () => tree.update(panelOf()));
    expect(offered()).toEqual(['Subotica, Još nema zadataka']);
    await choose('Subotica, Još nema zadataka');
    expect(placeValue()).toBe('Subotica'); expect(openStep()).toEqual(['kada']);
    await act(async () => show().props.onPress());
    expect(lastDraft()).toMatchObject({ place: 'Subotica', query: '' });
  });

  test('that the server answers with its parts shows the parts, with their counts, and is not listed again', async () => {
    p6Search = p6Seam(p6Snapshot({ placeHasMore: true }));
    await render();
    // Not every place is read, so no total is claimed for the city: its row only says where its tasks are.
    await act(async () => byLabel('Beograd, Zadaci su po delovima grada')[0].props.onPress());
    p6Search = p6Seam(p6Snapshot({ key: discoveryV1SearchPreviewKey({ ...view, placeSearch: 'Beograd' } as SearchPreviewView, mapArea),
      places: [{ key: 'beograd, vračar', text: 'Beograd, Vračar', count: 9 }, { key: 'beograd, zemun', text: 'Beograd, Zemun', count: 4 }], placeHasMore: false }));
    await act(async () => tree.update(panelOf()));
    expect(offered()).toEqual(['Beograd, Vračar, 9 zadataka', 'Beograd, Zemun, 4 zadatka']);
  });
});

// DISCOVERY-GRAD (owner decision d14, applied to DEV 2026-10-08): the server's rows are CITIES, a city row is the ordinary place filter and its count is what it lists, and the
// parts of a city ("Liman, Novi Sad") come apart, under the cities, by the letters typed.
describe('the cities of "Gde" (P6)', () => {
  const cities = [{ key: 'novi sad', text: 'Novi Sad', count: 23 }, { key: 'beograd', text: 'Beograd', count: 13 }];
  const typedKey = (letters: string) => discoveryV1SearchPreviewKey({ ...view, placeSearch: letters } as SearchPreviewView, mapArea);

  test('the rows are cities with their counts, the group is named for them, and a city that has tasks is not offered again among the popular ones', async () => {
    p6Search = p6Seam(p6Snapshot({ places: cities }));
    await render();
    expect(texts()).toContain('Gradovi sa zadacima'); expect(texts()).not.toContain('Mesta sa zadacima');
    expect(offered().slice(0, 4)).toEqual(['Svi zadaci, 80 zadataka', 'Novi Sad, 23 zadatka', 'Beograd, 13 zadataka', 'Niš, Još nema zadataka']);
    expect(offered().filter(label => /^(Novi Sad|Beograd)/.test(label))).toHaveLength(2);
    await choose('Novi Sad, 23 zadatka');
    expect(placeValue()).toBe('Novi Sad'); expect(openStep()).toEqual(['kada']);
    await act(async () => show().props.onPress());
    expect(lastDraft()).toMatchObject({ place: 'Novi Sad', query: '' });
  });

  test('letters typed bring the parts of a city under the cities; a part is an ordinary place, and is not offered twice', async () => {
    p6Search = p6Seam(p6Snapshot({ places: cities }));
    await render();
    await typeWhere('lim');
    p6Search = p6Seam(p6Snapshot({ key: typedKey('lim'), places: [{ key: 'limanovci', text: 'Limanovci', count: 2 }],
      parts: [{ key: 'liman, novi sad', text: 'Liman, Novi Sad', count: 9 }, { key: 'limanovci', text: 'Limanovci', count: 2 }] }));
    await act(async () => tree.update(panelOf()));
    expect(texts()).toContain('Gradovi sa zadacima'); expect(texts()).toContain('Delovi grada');
    expect(offered()).toEqual(['Limanovci, 2 zadatka', 'Liman, Novi Sad, 9 zadataka']);
    await choose('Liman, Novi Sad, 9 zadataka');
    expect(placeValue()).toBe('Liman, Novi Sad');
    await act(async () => show().props.onPress());
    expect(lastDraft()).toMatchObject({ place: 'Liman, Novi Sad' });
  });

  test('without letters there are no parts, and nothing is said of them', async () => {
    p6Search = p6Seam(p6Snapshot({ places: cities, parts: [{ key: 'liman, novi sad', text: 'Liman, Novi Sad', count: 9 }] }));
    await render();
    expect(texts()).not.toContain('Delovi grada'); expect(offered().some(label => /^Liman/.test(label))).toBe(false);
  });

  test('the rows the server answers for the letters are not filtered again here, where "đ" folds to "d" and the server\'s fold says "dj"', async () => {
    p6Search = p6Seam(p6Snapshot({ places: cities }));
    await render();
    await typeWhere('djordje');
    p6Search = p6Seam(p6Snapshot({ key: typedKey('djordje'), places: [{ key: 'đorđe', text: 'Đorđe', count: 2 }] }));
    await act(async () => tree.update(panelOf()));
    expect(offered()).toEqual(['Đorđe, 2 zadatka']);
  });

  test('letters that find no city and no part say so, and offer the words search instead', async () => {
    p6Search = p6Seam(p6Snapshot({ places: cities }));
    await render();
    await typeWhere('zzz');
    p6Search = p6Seam(p6Snapshot({ key: typedKey('zzz'), places: [], parts: [] }));
    await act(async () => tree.update(panelOf()));
    expect(texts()).toContain('Nema takvog mesta.');
    expect(tree.root.findAllByType('Action' as React.ElementType).some(node => node.props.label === 'Traži „zzz“ u zadacima')).toBe(true);
  });
});

describe('the sections', () => {
  test('are separate cards in the order Gde, Kada, Šta, Cena, Broj ljudi, Način rada, with one open at a time', async () => {
    await render();
    expect(openStep()).toEqual(['gde']); expect(texts()).toContain('Pretraga');
    const order = tree.root.findAll(node => node.props.testID && /^search-step-/.test(node.props.testID)).map(node => node.props.testID);
    expect(order).toEqual(['search-step-gde', 'search-step-kada', 'search-step-sta', 'search-step-cena', 'search-step-koliko', 'search-step-kako']);
    expect(['Gde', 'Kada', 'Šta', 'Cena', 'Broj ljudi', 'Način rada'].map(label => byLabel(label).length)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(radio('Bilo kada')).toHaveLength(0);
    await tap('Kada'); expect(openStep()).toEqual(['kada']); expect(radio('Bilo kada')[0].props.accessibilityState.checked).toBe(true);
    await tap('Cena'); expect(openStep()).toEqual(['cena']); expect(radio('Sve')[0].props.accessibilityState.checked).toBe(true);
    await tap('Broj ljudi'); expect(openStep()).toEqual(['koliko']); expect(byLabel('Povećaj broj osoba')).toHaveLength(1);
    await tap('Način rada'); expect(radio('Bilo gde')[0].props.accessibilityState.checked).toBe(true);
    await tap('Šta'); expect(openStep()).toEqual(['sta']);
    expect(whatField().props).toMatchObject({ accessibilityLabel: 'Šta tražiš', placeholder: 'Npr. selidba, farbanje, košenje' });
    // Tapping an open section closes it: none is open, and everything stays chosen.
    await tap('Šta'); expect(openStep()).toEqual([]);
  });

  test('"Uslovi pretrage" opens the panel at Kada; a closed section says what is chosen in it', async () => {
    start = 'kada'; await render();
    expect(texts()).toContain('Filteri'); expect(openStep()).toEqual(['kada']);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži mesta' })).toHaveLength(0);
    expect([placeValue(), valueOf('search-sta-toggle'), valueOf('search-cena-toggle'), valueOf('search-koliko-toggle'), valueOf('search-kako-toggle')])
      .toEqual(['Svi zadaci', 'Bilo šta', 'Sve', '1 osoba', 'Bilo gde']);
    await tap('Datumi'); expect(openStep()).toEqual(['kada']);
    await tap('Gde'); expect(openStep()).toEqual(['gde']);
    expect(byLabel('Datumi')).toHaveLength(0);
    await tap('Kada'); expect(tree.root.findAllByProps({ testID: 'search-date-editor' })).toHaveLength(1);
    await tap('Datumi'); expect(openStep()).toEqual(['kada']);
    expect(tree.root.findAllByProps({ testID: 'search-date-editor' })).toHaveLength(0);
  });

  test('the wording is "ti": no "vas", no "posao", and the people section is "Broj ljudi"', async () => {
    await render();
    let everything = '';
    for (const step of ['Gde', 'Kada', 'Šta', 'Cena', 'Broj ljudi', 'Način rada']) {
      await tap(step);
      everything += ` | ${texts()} | ${tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string').map(node => node.props.accessibilityLabel).join(' | ')}`;
    }
    expect(everything).not.toMatch(/\bvas\b|\bvam\b|\bposao\b|\bposla\b|Koliko vas|Kako se radi/i);
    expect(everything).toContain('Prikazujemo zadatke koji imaju dovoljno slobodnih mesta za toliko ljudi.');
  });

  test('"Način rada" is offered only when a task says how it is done', async () => {
    rows = rows.filter(item => item.id !== 'remote'); await render();
    expect(tree.root.findAllByProps({ testID: 'search-step-kako' })).toHaveLength(0);
  });

  test('a choice made in one section stays chosen while others are open, and nothing is applied before "Prikaži"', async () => {
    view = { ...view, where: 'remote' }; await render();
    expect(placeValue()).toBe('Na daljinu');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Mesta' })).toHaveLength(0);
    expect(texts()).toContain('Zadaci na daljinu ne zavise od oblasti mape.');
    await tap('Kada'); await choose('Ovaj vikend');
    await tap('Način rada'); expect(radio('Na daljinu')[0].props.accessibilityState.checked).toBe(true);
    await tap('Kada'); expect(radio('Ovaj vikend')[0].props.accessibilityState).toEqual({ checked: true });
    await tap('Cena'); await choose('Prima ponude'); expect(valueOf('search-cena-toggle')).toBe('Prima ponude');
    await tap('Cena'); expect(radio('Prima ponude')[0].props.accessibilityState.checked).toBe(true);
    expect(apply).not.toHaveBeenCalled();
  });
});

describe('the flow from one question to the next', () => {
  test('a choice that completes a question closes it and opens the next; typing and counting never do', async () => {
    await render();
    expect(openStep()).toEqual(['gde']);
    // Typing in "Gde" finds places and moves nothing.
    await typeWhere('lim'); expect(openStep()).toEqual(['gde']);
    await choose('Liman, Novi Sad, 2 zadatka');
    expect(placeValue()).toBe('Liman, Novi Sad'); expect(openStep()).toEqual(['kada']);
    await choose('Ovaj vikend'); expect(openStep()).toEqual(['sta']);
    // Typing a word moves nothing; "Gotovo" on the keyboard does.
    await typeWhat('pomoć'); expect(openStep()).toEqual(['sta']);
    await act(async () => whatField().props.onSubmitEditing()); expect(openStep()).toEqual(['cena']);
    await choose('Navedena cena'); expect(openStep()).toEqual(['koliko']);
    // The number of people is counted with several taps: it does not move on by itself.
    await act(async () => byLabel('Povećaj broj osoba')[0].props.onPress()); await act(async () => byLabel('Povećaj broj osoba')[0].props.onPress());
    expect(openStep()).toEqual(['koliko']); expect(texts()).toContain('3 osobe');
    // "Gotovo" says it is the number, and the last question opens.
    await act(async () => tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === 'Gotovo')!.props.onPress());
    expect(openStep()).toEqual(['kako']);
    await choose('Na licu mesta');
    // The last question closes: the footer's action is what is left.
    expect(openStep()).toEqual([]);
    expect(valueOf('search-kako-toggle')).toBe('Na licu mesta');
    expect(apply).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  });

  test('the first of the places chosen applies only on "Prikaži", and it carries the Šta word it was chosen beside', async () => {
    await render();
    await tap('Šta'); await typeWhat('pomoć'); await tap('Gde');
    await choose('Vračar, Beograd, 1 zadatak');
    expect(apply).not.toHaveBeenCalled();
    await act(async () => show().props.onPress());
    expect(lastDraft()).toMatchObject({ place: 'Vračar, Beograd', query: 'pomoć', area: null, pinPlace: null }); expect(close).toHaveBeenCalledTimes(1);
  });

  test('choosing "Svi zadaci" or the map\'s area keeps the word searched in "Šta"', async () => {
    mapArea = [19.8, 45.2, 19.9, 45.3]; view = { ...view, query: 'pomoć', place: 'Vračar, Beograd' }; await render();
    await choose(/^Svi zadaci/); expect(placeValue()).toBe('Svi zadaci'); expect(openStep()).toEqual(['kada']);
    await tap('Gde'); await choose(/^Ova oblast/); expect(placeValue()).toBe('Ova oblast');
    await act(async () => show().props.onPress());
    expect(lastDraft()).toMatchObject({ place: null, area: [19.8, 45.2, 19.9, 45.3], query: 'pomoć' });
  });

  test('with a screen reader on, a choice stays on its section: focus is not taken away', async () => {
    const reader = jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    const listeners: ((enabled: boolean) => void)[] = [], remove = jest.fn();
    const listen = jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, handler: (enabled: boolean) => void) => {
      if (event !== 'screenReaderChanged') return { remove: jest.fn() };
      listeners.push(handler); return { remove };
    }) as never);
    try {
      start = 'kada'; await render();
      await choose('Ovaj vikend');
      expect(openStep()).toEqual(['kada']);
      expect(radio('Ovaj vikend')[0].props.accessibilityState).toEqual({ checked: true });
      // Turning the screen reader off lets the next choice move on.
      await act(async () => listeners[0](false));
      await choose('Sutra'); expect(openStep()).toEqual(['sta']);
      await act(async () => tree.unmount());
      expect(remove).toHaveBeenCalledTimes(1);
    } finally { reader.mockRestore(); listen.mockRestore(); }
  });

  test('a section opened by a choice is scrolled to once it has arrived, and not after the person took hold of the list or with a screen reader', async () => {
    const frames: FrameRequestCallback[] = [], scrollTo = jest.fn();
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
    await act(async () => { tree = create(panelOf(), { createNodeMock: node => node.type === 'ScrollView' ? { scrollTo } : null }); });
    const settle = async () => act(async () => { frames.splice(0).forEach(frame => frame(0)); });
    await act(async () => byId('search-step-kada').props.onLayout({ nativeEvent: { layout: { y: 300 } } }));
    await act(async () => byId('search-step-sta').props.onLayout({ nativeEvent: { layout: { y: 380 } } }));
    await choose('Liman, Novi Sad, 2 zadatka'); await settle();
    expect(scrollTo).toHaveBeenCalledTimes(1); expect(scrollTo).toHaveBeenCalledWith({ y: 300 - sys.space.md, animated: false });
    // Opened by hand, the same.
    await tap('Šta'); await settle();
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 380 - sys.space.md, animated: false });
    // A hand on the list retires a reveal that is waiting for its frame.
    await tap('Kada'); await act(async () => tree.root.findByType('ScrollView' as React.ElementType).props.onScrollBeginDrag());
    scrollTo.mockClear(); await settle(); expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe('the place list in "Gde"', () => {
  test('offers every task, the places the loaded tasks name with their counts, and the biggest cities under them', async () => {
    await render();
    // Own tasks take part in the same count; remote words are not places. Two spellings of one place are one.
    expect(offered().slice(0, 4)).toEqual(['Svi zadaci, 5 zadataka', 'Liman, Novi Sad, 2 zadatka', 'Vračar, Beograd, 1 zadatak', 'Zemun, Beograd, 1 zadatak']);
    expect(offered().join(' ')).not.toMatch(/Na daljinu|Moja lokacija/);
    expect(texts()).toContain('Mesta sa zadacima'); expect(texts()).toContain('Popularni gradovi');
    // The two big cities whose tasks are under their parts lead to those parts; the rest are listed as having no task yet.
    expect(offered().slice(4, 7)).toEqual(['Beograd, 2 zadatka · po delovima grada', 'Novi Sad, 2 zadatka · po delovima grada', 'Niš, Još nema zadataka']);
    expect(offered().slice(6)).toEqual(['Niš', 'Kragujevac', 'Subotica', 'Pančevo', 'Čačak', 'Kraljevo', 'Smederevo', 'Šabac', 'Valjevo', 'Zrenjanin',
      'Leskovac', 'Kruševac', 'Sombor', 'Požarevac'].map(city => `${city}, Još nema zadataka`));
  });

  test('typing finds places and cities by their letters, with or without diacritics, and only finds: nothing is searched in the tasks', async () => {
    await render();
    await typeWhere('vrac');
    expect(offered()).toEqual(['Vračar, Beograd, 1 zadatak']);
    expect(texts()).not.toContain('Svi zadaci');
    await typeWhere('nis');
    expect(offered()).toEqual(['Niš, Još nema zadataka']);
    await typeWhere('beo');
    expect(offered()).toEqual(['Vračar, Beograd, 1 zadatak', 'Zemun, Beograd, 1 zadatak', 'Beograd, 2 zadatka · po delovima grada']);
    // The words that find tasks are another section's: the draft's word is untouched.
    await typeWhere('');
    await choose('Vračar, Beograd, 1 zadatak');
    await act(async () => show().props.onPress());
    expect(lastDraft().query).toBe('');
  });

  test('a city that has no task yet is a legal choice, and the one action says honestly that there is nothing yet', async () => {
    await render();
    await choose('Niš, Još nema zadataka');
    expect(placeValue()).toBe('Niš'); expect(openStep()).toEqual(['kada']);
    expect(show().props).toMatchObject({ label: 'Nema zadataka za ove uslove', disabled: true });
    // A grey action says why in a line above it (the foot every flow has), heard politely when it appears.
    const why = tree.root.findByProps({ testID: 'search-footer-reason' });
    expect(why.props.accessibilityLiveRegion).toBe('polite'); expect(why.children.join('')).toBe('Pokušaj sa širom oblašću ili drugim danom.');
    // It stays in the list, chosen, and can be taken away again.
    // Chosen, it is one of the places now (a place the conditions leave empty says so plainly) and stays removable.
    await tap('Gde'); expect(radio('Niš, Nema zadataka')[0].props.accessibilityState).toEqual({ checked: true });
    await choose(/^Svi zadaci/);
    expect(show().props).toMatchObject({ label: 'Prikaži 5 zadataka', disabled: false });
  });

  test('a city whose tasks are under its parts leads to those parts and cannot pretend to be all of them', async () => {
    await render();
    const beograd = byLabel('Beograd, 2 zadatka · po delovima grada')[0];
    expect(beograd.props).toMatchObject({ accessibilityRole: 'button', accessibilityHint: 'Prikazuje delove grada.' });
    expect(beograd.props.accessibilityState).toBeUndefined();
    await act(async () => beograd.props.onPress());
    // Its parts are what the list shows now, and the city is not listed again beside them.
    expect(offered()).toEqual(['Vračar, Beograd, 1 zadatak', 'Zemun, Beograd, 1 zadatak']);
    expect(tree.root.findByProps({ accessibilityLabel: 'Pretraži mesta' }).props.value).toBe('Beograd');
    expect(openStep()).toEqual(['gde']); expect(apply).not.toHaveBeenCalled();
    await choose('Zemun, Beograd, 1 zadatak'); expect(placeValue()).toBe('Zemun, Beograd');
  });

  test('a city that tasks name exactly is the ordinary place and is not repeated among the cities', async () => {
    rows = [row('ns', { podrucjeTekst: 'Novi Sad' }), row('ns2', { podrucjeTekst: 'Novi Sad' })]; await render();
    expect(offered().slice(0, 2)).toEqual(['Svi zadaci, 2 zadatka', 'Novi Sad, 2 zadatka']);
    expect(offered().filter(label => /^Novi Sad/.test(label))).toEqual(['Novi Sad, 2 zadatka']);
  });

  test('words that find no place offer to search them as a word of the tasks, which opens Šta', async () => {
    await render();
    await typeWhere('dosta');
    expect(texts()).toContain('Nema takvog mesta.');
    const bridge = tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === 'Traži „dosta“ u zadacima')!;
    await act(async () => bridge.props.onPress());
    expect(openStep()).toEqual(['sta']); expect(whatField().props.value).toBe('dosta');
    expect(valueOf('search-sta-toggle')).toBe('„dosta“');
    await tap('Gde'); expect(tree.root.findByProps({ accessibilityLabel: 'Pretraži mesta' }).props.value).toBe('');
  });

  test('the map\'s current area is offered once the map has settled somewhere, with what the list would then hold', async () => {
    mapArea = [19.8, 45.2, 19.9, 45.3]; await render();
    // The two public tasks (including mine) inside it and the online one, which no area leaves out.
    await choose('Ova oblast, 4 zadatka');
    await act(async () => show().props.onPress());
    expect(lastDraft()).toMatchObject({ place: null, area: [19.8, 45.2, 19.9, 45.3] });
  });

  test('"U blizini" is offered where the screen can move its map, is no filter, and moves the map only with the apply', async () => {
    await render(); expect(byLabel('U blizini')).toHaveLength(0);
    await act(async () => tree.unmount()); canNearby = true; await render();
    const nearby = radio('U blizini')[0];
    expect(nearby.props).toMatchObject({ accessibilityHint: 'Jednom koristi tvoju lokaciju da centrira mapu. Ne čuva je.' });
    await act(async () => nearby.props.onPress());
    expect(placeValue()).toBe('U blizini'); expect(openStep()).toEqual(['kada']); expect(apply).not.toHaveBeenCalled();
    expect(show().props.label).toBe('Prikaži 5 zadataka');
    await act(async () => show().props.onPress());
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ place: null, area: null }), { nearby: true });
    // Any other choice in "Gde" takes it back, and remote work has no position at all.
    apply.mockReset(); await act(async () => tree.unmount()); await render();
    await choose('U blizini'); await tap('Gde'); await choose('Liman, Novi Sad, 2 zadatka');
    await act(async () => show().props.onPress()); expect(apply.mock.calls[0][1]).toBeUndefined();
    await act(async () => tree.unmount()); await render();
    await tap('Način rada'); await choose('Na daljinu'); await tap('Gde');
    expect(byLabel('U blizini')).toHaveLength(0); expect(texts()).toContain('Zadaci na daljinu ne zavise od oblasti mape.');
  });

  test('"Poništi filtere" also forgets "U blizini", the letters typed and the words', async () => {
    canNearby = true; await render();
    await typeWhere('liman'); await tap('Šta'); await typeWhat('pomoć'); await tap('Gde'); await typeWhere('');
    await choose('U blizini');
    await act(async () => tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === 'Poništi filtere')!.props.onPress());
    expect(placeValue()).toBe('Svi zadaci'); expect(valueOf('search-sta-toggle')).toBe('Bilo šta');
    await act(async () => show().props.onPress()); expect(lastDraft()).toEqual(NO_SEARCH); expect(apply.mock.calls[0][1]).toBeUndefined();
  });
});

describe('the place list fills the screen when it is scrolled', () => {
  test('rests at 85 % of the screen, grows to the full height at once on the first scroll, and a × brings it back', async () => {
    await render();
    expect(sheetHeight()).toBe(1134); expect(sheetCorner()).toBe(sys.radius.sheet);
    expect(byLabel('Zatvori pretragu')).toHaveLength(1); expect(texts()).toContain('Pretraga');
    await dragList();
    expect(sheetHeight()).toBe(1334); expect(sheetCorner()).toBe(0);
    expect(byLabel('Smanji spisak mesta')).toHaveLength(1); expect(byLabel('Zatvori pretragu')).toHaveLength(0);
    expect(byLabel('Smanji spisak mesta')[0].props.accessibilityHint).toBe('Vraća na pretragu.');
    expect(texts()).toContain('Gde');
    await tap('Smanji spisak mesta');
    expect(sheetHeight()).toBe(1134); expect(close).not.toHaveBeenCalled();
    expect(byLabel('Zatvori pretragu')).toHaveLength(1);
    await tap('Zatvori pretragu'); expect(close).toHaveBeenCalledTimes(1); expect(apply).not.toHaveBeenCalled();
  });

  test('only the place list grows: a scroll over another section leaves the sheet where it is', async () => {
    start = 'kada'; await render();
    await dragList(); expect(sheetHeight()).toBe(1134); expect(byLabel('Smanji spisak mesta')).toHaveLength(0);
  });

  test('choosing a place, or opening another section, brings the sheet back; Back brings it back before it closes', async () => {
    await render();
    await dragList(); await choose('Liman, Novi Sad, 2 zadatka'); expect(sheetHeight()).toBe(1134);
    await tap('Gde'); await dragList(); await tap('Cena'); expect(sheetHeight()).toBe(1134);
    await tap('Gde'); await dragList();
    const back = () => tree.root.findByType('Modal' as React.ElementType).props.onRequestClose();
    await act(async () => back()); expect(sheetHeight()).toBe(1134); expect(close).not.toHaveBeenCalled();
    await act(async () => back()); expect(close).toHaveBeenCalledTimes(1);
  });

  test('a tap on the blurred screen outside closes the panel and applies nothing, and brings back a sheet that fills the screen', async () => {
    await render();
    await dragList();
    await act(async () => byId('search-backdrop-press').props.onPress()); expect(close).not.toHaveBeenCalled(); expect(sheetHeight()).toBe(1134);
    await act(async () => byId('search-backdrop-press').props.onPress()); expect(close).toHaveBeenCalledTimes(1); expect(apply).not.toHaveBeenCalled();
  });

  test('is measured on the screen it opens on, below the status bar, with the footer above the bottom bar', async () => {
    await act(async () => { tree = create(<SafeAreaInsetsContext.Provider value={{ top: 30, bottom: 20, left: 0, right: 0 }}>{panelOf()}</SafeAreaInsetsContext.Provider>); });
    await act(async () => byId('search-root').props.onLayout({ nativeEvent: { layout: { height: 1000 } } }));
    expect(sheetHeight()).toBe(850);
    await dragList(); expect(sheetHeight()).toBe(970);
    expect(StyleSheet.flatten(byId('search-footer-slot').props.style).paddingBottom).toBe(20);
  });
});

describe('what lies behind the panel', () => {
  const blurs = () => tree.root.findAll(node => node.type === BlurView);

  test('is blurred on Android 12 and newer, with the screen it opened over as the target', async () => {
    blurTarget = { current: null };
    for (const version of [31, 34, 36]) {
      await withPlatform('android', version, async () => {
        await render();
        expect(blurs()).toHaveLength(1);
        expect(blurs()[0].props).toMatchObject({ intensity: 35, tint: 'light', blurMethod: 'dimezisBlurViewSdk31Plus', blurTarget,
          blurReductionFactor: expect.any(Number) });
        expect(byId('search-dim-backdrop')).toBeDefined();
        await act(async () => tree.unmount());
      });
    }
  });

  test('is only dimmed on an older Android and without a target: a dim, never a white page', async () => {
    await withPlatform('android', 30, async () => {
      blurTarget = { current: null }; await render();
      expect(blurs()).toHaveLength(0);
      expect(StyleSheet.flatten(byId('search-dim-backdrop').props.style)).toMatchObject({ backgroundColor: sys.color.dim });
      expect(StyleSheet.flatten(byId('search-dim-backdrop').props.style).opacity).toBeUndefined();
      await act(async () => tree.unmount());
    });
    await withPlatform('android', 36, async () => {
      blurTarget = undefined; await render();
      expect(blurs()).toHaveLength(0); expect(byId('search-dim-backdrop')).toBeDefined();
    });
  });

  test('is not drawn white and does not hide the screen: the sheet leaves a visible strip of it, and the backdrop is decoration only', async () => {
    await withPlatform('android', 34, async () => {
      blurTarget = { current: null }; await render();
      expect(sheetHeight()).toBeLessThan(1334);
      const backdrop = byId('search-backdrop');
      expect(backdrop.props).toMatchObject({ pointerEvents: 'none', accessible: false, importantForAccessibility: 'no-hide-descendants' });
      expect(StyleSheet.flatten(byId('search-dim-backdrop').props.style).backgroundColor).not.toBe(sys.color.surface);
      expect(JSON.stringify(tree.toJSON())).not.toContain(sys.color.veil);
    });
  });

  test('the panel is a transparent modal without the platform\'s own fade: its motion is its own', async () => {
    await render();
    expect(tree.root.findByType('Modal' as React.ElementType).props).toMatchObject({ transparent: true, animationType: 'none', statusBarTranslucent: true });
    expect(byLabel('Zatvori pretragu')).toHaveLength(1);
    expect(byId('search-sheet').props).toMatchObject({ accessibilityViewIsModal: true, accessibilityLabel: 'Pretraga' });
  });
});

describe('motion', () => {
  test('the sheet rises on the sheet spring, the backdrop fades in, and under reduced motion nothing is asked of the driver', async () => {
    holdAnimations(); reduced = false; await render();
    const spring = runs.find(run => run.kind === 'spring' && run.config.toValue === 0)!;
    expect(spring.config).toMatchObject({ ...sys.motion.sheetSpring, useNativeDriver: true });
    const fade = runs.find(run => run.kind === 'timing' && run.config.toValue === 1 && run.config.useNativeDriver === true && run.config.duration === sys.motion.enter);
    expect(fade).toBeDefined();
    await act(async () => tree.unmount()); runs = []; reduced = true; await render();
    // Only the section carets (their own small turn) may ask: the sheet and its backdrop do not move.
    expect(runs.filter(run => run.kind === 'spring' || run.config.duration === sys.motion.enter || run.config.duration === sys.motion.sheetClose)).toHaveLength(0);
    expect(sheetHeight()).toBe(1134);
  });

  test('it closes on the short timing and tells the screen only once it is gone; reduced motion closes at once', async () => {
    holdAnimations(); reduced = false; await render();
    await finishAnimations(); runs = [];
    await tap('Zatvori pretragu');
    const leaving = runs.filter(run => run.kind === 'timing' && run.config.useNativeDriver === true);
    expect(leaving.map(run => run.config.duration)).toEqual([sys.motion.sheetClose, sys.motion.sheetClose]);
    expect(close).not.toHaveBeenCalled();
    await finishAnimations(); expect(close).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount()); close.mockReset(); runs = []; reduced = true; await render();
    await tap('Zatvori pretragu'); expect(close).toHaveBeenCalledTimes(1);
    expect(runs.filter(run => run.config.duration === sys.motion.sheetClose)).toHaveLength(0);
  });

  test('the way out never depends on the animation callback', async () => {
    jest.useFakeTimers();
    holdAnimations(); reduced = false; await render();
    await tap('Zatvori pretragu'); expect(close).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(sys.motion.sheetClose + 300); });
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('once the panel has begun to leave nothing in it is acted on again: the draft is applied once and the panel closes once', async () => {
    holdAnimations(); reduced = false; await render(); await finishAnimations();
    await act(async () => show().props.onPress());
    await act(async () => show().props.onPress());
    await tap('Zatvori pretragu');
    const avoider = tree.root.findAll(node => node.type === KeyboardAvoidingView)[0];
    expect(avoider.props.pointerEvents).toBe('none');
    expect(apply).toHaveBeenCalledTimes(1);
    await finishAnimations(); await finishAnimations();
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('"Prikaži" applies the draft at once, behind the leaving sheet, and the screen is told it is closed only afterwards', async () => {
    holdAnimations(); reduced = false; await render();
    await finishAnimations();
    await act(async () => show().props.onPress());
    expect(apply).toHaveBeenCalledTimes(1); expect(close).not.toHaveBeenCalled();
    await finishAnimations(); expect(close).toHaveBeenCalledTimes(1);
  });

  test('a section opens and closes over the short timings on the deceleration curve; the sheet grows on the sheet spring', async () => {
    holdAnimations(); reduced = false; await render();
    // The screen's real size arrives while the sheet rises: the height is put there, not moved.
    await act(async () => byId('search-root').props.onLayout({ nativeEvent: { layout: { height: 1334 } } }));
    expect(runs.filter(run => run.kind === 'spring' && run.config.useNativeDriver === false)).toHaveLength(0);
    await finishAnimations(); runs = [];
    await tap('Kada');
    // Kada is mounted at once, to be measured; Gde is leaving.
    expect(radio('Bilo kada')).toHaveLength(1);
    await act(async () => byId('search-collapse-kada-natural').props.onLayout({ nativeEvent: { layout: { height: 180 } } }));
    const opening = runs.find(run => run.kind === 'timing' && run.config.useNativeDriver === false && run.config.toValue === 180)!;
    expect(opening.config.duration).toBe(sys.motion.enter);
    const leaving = runs.find(run => run.kind === 'timing' && run.config.useNativeDriver === false && run.config.toValue === 0)!;
    expect(leaving.config.duration).toBe(sys.motion.exit);
    expect(radio(/^Svi zadaci/)).toHaveLength(1);
    await finishAnimations(); expect(radio(/^Svi zadaci/)).toHaveLength(0); expect(openStep()).toEqual(['kada']);
    runs = [];
    await tap('Gde'); await dragList();
    expect(runs.find(run => run.kind === 'spring' && run.config.toValue === 1334)!.config).toMatchObject({ ...sys.motion.sheetSpring, useNativeDriver: false });
  });
});

describe('the dates', () => {
  test('a range needs two taps; "Gotovo" confirms it and opens Šta; a past day cannot be chosen and says so', async () => {
    start = 'kada'; await render();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
    expect(texts()).toContain('Septembar 2026');
    const past = dayCell(23);
    expect(past.props.accessibilityLabel).toBe('Sreda, 23. sep, prošao dan');
    expect(past.props).toMatchObject({ disabled: true, accessibilityState: { disabled: true, selected: false } });
    expect(dayCell(24).props.accessibilityLabel).toBe('Četvrtak, 24. sep, danas');
    expect(tree.root.findAllByType('Action' as React.ElementType).filter(node => node.props.label === 'Gotovo')).toHaveLength(0);
    // The first tap starts the range and nothing moves on; it is already a choice of that one day, and counted so (the
    // four tasks of the 26th, including mine; the one of the 30th is not).
    await act(async () => dayCell(26).props.onPress());
    expect(openStep()).toEqual(['kada']); expect(texts()).toContain('Izaberi poslednji dan.');
    expect(dayCell(26).props.accessibilityState).toEqual({ disabled: false, selected: true });
    expect(show().props.label).toBe('Prikaži 4 zadatka');
    // The second tap ends it without moving the calendar: the days between are shaded and both ends are chosen.
    await act(async () => dayCell(28).props.onPress());
    expect(openStep()).toEqual(['kada']);
    expect(dateValue()).toBe('26–28. sep');
    expect([26, 27, 28].map(n => dayCell(n).props.accessibilityState.selected)).toEqual([true, true, true]);
    expect(dayCell(29).props.accessibilityState.selected).toBe(false);
    expect(tree.root.findAll(node => node.props.testID === 'range-band')).toHaveLength(3);
    expect(show().props.label).toBe('Prikaži 4 zadatka');
    // A day before the pending start starts the range again.
    await act(async () => dayCell(30).props.onPress()); await act(async () => dayCell(25).props.onPress());
    expect(openStep()).toEqual(['kada']); expect(texts()).toContain('Izaberi poslednji dan.');
    const done = tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === 'Gotovo')!;
    await act(async () => done.props.onPress());
    expect(openStep()).toEqual(['sta']); expect(tree.root.findAllByProps({ testID: 'search-date-editor' })).toHaveLength(0);
  });

  test('one tapped day applies as a one-day range, and the section and the draft say that day', async () => {
    start = 'kada'; await render();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
    await act(async () => dayCell(30).props.onPress());
    expect(show().props.label).toBe('Prikaži 1 zadatak');
    expect(dateValue()).toBe('30. sep');
    await act(async () => show().props.onPress());
    expect(lastDraft()).toMatchObject({ dates: { from: '2026-09-30', to: '2026-09-30' }, when: 'any' });
  });

  test('tasks without a date are said, not hidden silently, when a time choice leaves them out', async () => {
    rows = [...rows, row('undated', { schedule: undefined }), row('incomplete', { schedule: { kind: 'FIXED_WINDOW', startsAt: null, endsAt: '2026-09-26T12:00:00+02:00' } })];
    start = 'kada'; await render();
    expect(texts()).not.toMatch(/bez datuma/);
    await choose('Ovaj vikend');
    // The choice opened the next section; the note belongs to Kada and shows when it is open again.
    await tap('Kada');
    expect(texts()).toContain('2 zadatka bez datuma nisu u ovom izboru.');
  });
});

describe('the draft', () => {
  test('"Broj ljudi" counts from one: minus cannot go below one, and the count stays directly editable', async () => {
    start = 'koliko'; await render();
    const minus = () => byLabel('Smanji broj osoba')[0], plus = () => byLabel('Povećaj broj osoba')[0];
    expect(texts()).toContain('1 osoba');
    expect(minus().props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
    expect(show().props.label).toBe('Prikaži 5 zadataka');
    await act(async () => plus().props.onPress()); await act(async () => plus().props.onPress());
    expect(texts()).toContain('3 osobe'); expect(openStep()).toEqual(['koliko']);
    expect(minus().props.disabled).toBe(false);
    // No task here has three open places: the one green action says so and cannot be pressed.
    expect(show().props).toMatchObject({ label: 'Nema zadataka za ove uslove', disabled: true });
    await act(async () => minus().props.onPress());
    expect(show().props).toMatchObject({ label: 'Prikaži 5 zadataka', disabled: false });
    await act(async () => show().props.onPress());
    expect(lastDraft().places).toBe(2);
  });

  test('choosing remote clears geographic scope in the draft, keeps the conditions, and applies only on confirmation', async () => {
    view = { ...view, place: 'Liman, Novi Sad', area: [19.8, 45.2, 19.9, 45.3], pinPlace: '45.25,19.84', price: 'MY_PRICE', query: 'Pomoć', places: 2 };
    await render(); await tap('Način rada'); await choose('Na daljinu');
    expect(show().props.label).toBe('Prikaži 1 zadatak');
    expect(placeValue()).toBe('Na daljinu');
    expect(apply).not.toHaveBeenCalled(); expect(view.pinPlace).toBe('45.25,19.84');
    await act(async () => show().props.onPress());
    expect(lastDraft()).toMatchObject({ where: 'remote', area: null, place: null, pinPlace: null, query: 'Pomoć', price: 'MY_PRICE', places: 2 });
  });

  test('"Poništi filtere" empties the draft and counts every task again; × leaves the list exactly as it was', async () => {
    view = { ...view, price: 'OFFERS', when: 'weekend', place: 'Vračar, Beograd' }; await render();
    expect(show().props).toMatchObject({ label: 'Nema zadataka za ove uslove', disabled: true });
    await act(async () => tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === 'Poništi filtere')!.props.onPress());
    expect(show().props.label).toBe('Prikaži 5 zadataka');
    for (const [group, choice] of [['Kada', 'Bilo kada'], ['Način rada', 'Bilo gde'], ['Cena', 'Sve']]) {
      await tap(group); expect(radio(choice)[0].props.accessibilityState.checked).toBe(true);
    }
    await tap('Broj ljudi'); expect(texts()).toContain('1 osoba');
    await act(async () => show().props.onPress());
    expect(lastDraft()).toEqual(NO_SEARCH);
    // A new panel starts from the list's own view again; × applies nothing.
    apply.mockReset(); close.mockReset(); await act(async () => tree.unmount()); await render();
    await tap('Kada'); expect(radio('Ovaj vikend')[0].props.accessibilityState.checked).toBe(true);
    await tap('Gde');
    await choose(/^Svi zadaci/);
    await tap('Zatvori pretragu');
    expect(apply).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1);
  });

  test('Android Back dismisses the visible keyboard without losing the draft, then closes when it is hidden', async () => {
    await withPlatform('android', 34, async () => {
      await render();
      const input = tree.root.findByProps({ accessibilityLabel: 'Pretraži mesta' });
      await typeWhere('Liman');
      mockKeyboardVisible = true;
      const requestClose = () => tree.root.findByType('Modal' as React.ElementType).props.onRequestClose();
      await act(async () => requestClose());
      expect(mockKeyboardDismiss).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled(); expect(apply).not.toHaveBeenCalled();
      const retained = tree.root.findByProps({ accessibilityLabel: 'Pretraži mesta' });
      expect(retained).toBe(input); expect(retained.props.value).toBe('Liman');
      expect(openStep()).toEqual(['gde']); expect(view.query).toBe('');
      mockKeyboardVisible = false;
      await act(async () => requestClose());
      expect(close).toHaveBeenCalledTimes(1); expect(apply).not.toHaveBeenCalled();
      expect(mockKeyboardDismiss).toHaveBeenCalledTimes(1);
    });
  });

  // Review of V47, item 1: nothing is counted before the list is known. While it is read, or when it could not be read,
  // "Gde" says no count at all (never "0 zadataka") and the one action says why it cannot be pressed; while only what is
  // mine is still read, the action applies the draft without a number.
  test.each([
    ['loading', 'Učitavamo zadatke…', true],
    ['error', 'Zadaci nisu učitani', true],
    ['pending', 'Prikaži zadatke', false],
  ] as const)('while the list is %s the panel counts nothing and its action says so', async (state, label, disabled) => {
    readiness = state; if (state !== 'pending') rows = []; mapArea = [19.8, 45.2, 19.9, 45.3];
    await render();
    expect(show().props).toMatchObject({ label, disabled });
    expect(offered()[0]).toBe('Svi zadaci'); expect(offered()).toContain('Ova oblast');
    expect(offered().slice(0, 2).join(' ')).not.toMatch(/zadat/);
    expect(texts()).not.toMatch(/\d+ zadat/);
    // No city is said to have no tasks while nothing is known.
    expect(texts()).not.toContain('Još nema zadataka');
    if (state === 'pending') {
      await act(async () => show().props.onPress());
      expect(apply).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1);
    }
    // Once the list is known, the counts are back.
    readiness = 'ready'; await act(async () => tree.update(panelOf()));
    expect(radio(/^Svi zadaci/)[0].props.accessibilityLabel).toMatch(/^Svi zadaci, (\d+ zadat|Nema zadataka)/);
  });
});

describe('the layout at large text and in a narrow window', () => {
  test('place and condition labels can wrap, and the chosen circle never spills out of its cell', async () => {
    mockWindow = { width: 320, height: 640, scale: 2, fontScale: 1 }; start = 'kada'; await render();
    const place = () => tree.root.findByProps({ testID: 'search-place-toggle' });
    expect(StyleSheet.flatten(place().props.style).flexDirection).toBe('row');
    await act(async () => tree.unmount());
    mockWindow = { width: 320, height: 640, scale: 2, fontScale: 1.3 }; await render();
    const [label, value] = place().findAllByType('T' as React.ElementType);
    expect(label.parent).toBe(value.parent);
    expect(StyleSheet.flatten(value.parent!.props.style)).toMatchObject({ flex: 1, minWidth: 0 });
    expect(value.props.numberOfLines).toBeUndefined();
    const chip = radio('Narednih 7 dana')[0];
    expect(StyleSheet.flatten(chip.props.style).maxWidth).toBe('100%');
    expect(StyleSheet.flatten(chip.findByType('T' as React.ElementType).props.style).flexShrink).toBe(1);
    expect(chip.findByType('T' as React.ElementType).props.numberOfLines).toBeUndefined();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
    const grid = tree.root.findByProps({ testID: 'search-date-grid' });
    expect(typeof grid.props.onLayout).toBe('function');
    // A roomy window (a 361 dp phone less the list's 20 dp edges is 321 across, 45 a day): the circle stops at its 40.
    await act(async () => grid.props.onLayout({ nativeEvent: { layout: { width: 321, height: 300 } } }));
    await act(async () => dayCell(26).props.onPress());
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'range-end' }).props.style)).toMatchObject({ width: 40, height: 40, borderRadius: 20 });
    // This 320 dp window less the same edges is 280 across, 40 a day: the circle is 38, 2 narrower than its cell.
    await act(async () => grid.props.onLayout({ nativeEvent: { layout: { width: 280, height: 300 } } }));
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'range-end' }).props.style)).toMatchObject({ width: 38, height: 38, borderRadius: 19 });
    await act(async () => grid.props.onLayout({ nativeEvent: { layout: { width: 266, height: 300 } } }));
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'range-end' }).props.style)).toMatchObject({ width: 36, height: 36, borderRadius: 18 });
  });

  test('the 361dp phone gives the people label its own row without changing the draft or footer behavior', async () => {
    start = 'koliko';
    mockWindow = { ...mockWindow, width: 411, fontScale: 1 }; await render();
    const layout = () => StyleSheet.flatten(tree.root.findByProps({ testID: 'search-people-layout' }).props.style);
    expect(layout().flexDirection).toBe('row');
    await tap('Povećaj broj osoba');
    mockWindow = { ...mockWindow, width: 361, fontScale: 1.15 };
    await act(async () => tree.update(panelOf()));
    expect(layout()).toMatchObject({ flexDirection: 'column', alignItems: 'stretch' });
    expect(StyleSheet.flatten(byLabel('Povećaj broj osoba')[0].parent!.props.style).width).toBe('100%');
    expect(texts()).toContain('2 osobe');
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'search-actions' }).props.style).flexDirection).toBe('row');
    expect(apply).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
    await act(async () => show().props.onPress());
    expect(lastDraft().places).toBe(2); expect(close).toHaveBeenCalledTimes(1);
  });

  test.each([[320, 1], [320, 2], [412, 1.3], [412, 2]])(
    'at %i dp / %s text, both footer actions have their own width without applying the draft during reflow', async (width, fontScale) => {
      start = 'sta';
      mockWindow = { ...mockWindow, width: 412, fontScale: 1 }; await render();
      expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'search-actions' }).props.style).flexDirection).toBe('row');
      await typeWhat('Vračar');
      mockWindow = { ...mockWindow, width, fontScale };
      await act(async () => tree.update(panelOf()));
      expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'search-actions' }).props.style)).toMatchObject({ flexDirection: 'column', alignItems: 'stretch' });
      expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'search-show' }).props.style)).toMatchObject({ flex: 0, width: '100%' });
      expect(apply).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
      expect(show().props.label).toBe('Prikaži 1 zadatak');
      await act(async () => show().props.onPress());
      expect(lastDraft().query).toBe('Vračar'); expect(close).toHaveBeenCalledTimes(1);
    },
  );
});

describe('the parts of the panel', () => {
  test('a chosen chip has a neutral well, ink edge and words, and a confirmation tick; a chosen day is written in onDark', async () => {
    start = 'kada'; await render();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
    await act(async () => dayCell(26).props.onPress());
    const end = tree.root.findByProps({ testID: 'range-end' });
    expect(StyleSheet.flatten(end.findByType('T' as React.ElementType).props.style).color).toBe(sys.color.onDark);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
    await choose('Sutra');
    await tap('Kada');
    const chip = radio('Sutra')[0], style = StyleSheet.flatten(chip.props.style);
    expect(style).toMatchObject({ backgroundColor: sys.color.wash, borderWidth: 1, borderColor: sys.color.ink });
    expect(style.backgroundColor).not.toBe(sys.color.green);
    expect(chip.findByType('Check' as React.ElementType).props.color).toBe(sys.color.ink);
    expect(StyleSheet.flatten(chip.findByType('T' as React.ElementType).props.style).color).toBe(sys.color.ink);
    const free = StyleSheet.flatten(radio('Danas')[0].props.style);
    // Selected and free chips keep the same inset; the selection border does not move their words.
    expect(Number(free.borderWidth) + Number(free.paddingHorizontal)).toBe(Number(style.borderWidth) + Number(style.paddingHorizontal));
  });

  test('what changes is heard: the action\'s count, the month and the prompt for the last day are polite live regions', async () => {
    start = 'kada'; await render();
    expect(tree.root.findByProps({ testID: 'search-show' }).props.accessibilityLiveRegion).toBe('polite');
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
    const month = tree.root.findAllByType('T' as React.ElementType).find(node => node.children.includes('Septembar 2026'))!;
    expect(month.props.accessibilityLiveRegion).toBe('polite');
    await act(async () => dayCell(26).props.onPress());
    const prompt = tree.root.findAllByType('T' as React.ElementType).find(node => node.children.join('') === 'Izaberi poslednji dan.')!;
    expect(prompt.props.accessibilityLiveRegion).toBe('polite');
  });

  test('the clear-text buttons and the place rows take no touch beyond themselves, and the fields are the system\'s one field', async () => {
    await render();
    await typeWhere('vrač');
    const clear = byLabel('Obriši pretragu mesta')[0];
    expect(clear.props.hitSlop).toBe(0); expect(StyleSheet.flatten(clear.props.style)).toMatchObject({ width: 48, height: 48 });
    for (const place of placeRows()) expect(place.props.hitSlop).toBe(0);
    const field = tree.root.findAll(node => String(node.type) === 'View' && StyleSheet.flatten(node.props.style)?.minHeight === 52)[0];
    expect(StyleSheet.flatten(field.props.style)).toMatchObject({ borderColor: sys.color.lineStrong, borderRadius: sys.radius.control });
  });

  test('search text uses the bundled regular face without asking the platform to synthesize its weight', async () => {
    await render();
    const style = StyleSheet.flatten(tree.root.findByProps({ accessibilityLabel: 'Pretraži mesta' }).props.style);
    expect(style.fontFamily).toBe('Inter-Regular');
    expect(style.fontWeight).toBeUndefined();
  });

  test('every section is a button that says whether it is expanded, with its chosen value spoken', async () => {
    view = { ...view, price: 'OFFERS' }; await render();
    for (const [id, label] of [['search-place-toggle', 'Gde'], ['search-kada-toggle', 'Kada'], ['search-sta-toggle', 'Šta'], ['search-cena-toggle', 'Cena'],
      ['search-koliko-toggle', 'Broj ljudi'], ['search-kako-toggle', 'Način rada']]) {
      const header = tree.root.findByProps({ testID: id });
      expect(header.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: label });
      expect(header.props.accessibilityState).toEqual({ expanded: id === 'search-place-toggle' });
    }
    expect(valueOf('search-cena-toggle')).toBe('Prima ponude');
  });
});

// UI/UX pass 2026-10-08 (composition spec 4.3): the sections are rows of one list, not six cards, and the foot is the one every flow has.
describe('the panel is a list of rows with the foot every flow has', () => {
  const header = (testID: string) => StyleSheet.flatten(tree.root.findByProps({ testID }).props.style);
  const rules = () => tree.root.findAll(node => String(node.type) === 'View' && node.props.pointerEvents === 'none'
    && StyleSheet.flatten(node.props.style)?.height === 1 && StyleSheet.flatten(node.props.style)?.backgroundColor === sys.color.line);

  test('a closed section is a row of at least 56 dp with no card around it, and the list stands 20 from the edge', async () => {
    start = 'kada'; await render();
    for (const id of ['search-place-toggle', 'search-kada-toggle', 'search-sta-toggle', 'search-cena-toggle', 'search-koliko-toggle', 'search-kako-toggle']) {
      expect(header(id)).toMatchObject({ minHeight: 56, flexDirection: 'row', paddingVertical: 12 });
      expect(header(id).borderWidth).toBeUndefined(); expect(header(id).borderRadius).toBeUndefined();
    }
    for (const step of ['gde', 'kada', 'sta', 'cena', 'koliko', 'kako']) {
      const section = StyleSheet.flatten(byId(`search-step-${step}`).props.style);
      expect(section?.borderWidth).toBeUndefined(); expect(section?.backgroundColor).toBeUndefined();
    }
    expect(StyleSheet.flatten(tree.root.findByType('ScrollView' as React.ElementType).props.contentContainerStyle)).toMatchObject({ paddingHorizontal: 20 });
    // Each name is in the row's own type, 16 at 600, and no section carries a picture of its own.
    expect(tree.root.findAllByType('FactArt' as React.ElementType)).toHaveLength(0);
  });

  test('the sections part with a short inset line, and the last one has none; an open section keeps its name and shows what it holds below', async () => {
    start = 'kada'; await render();
    expect(rules()).toHaveLength(5);
    expect(byId('search-step-kako').findAll(node => String(node.type) === 'View' && node.props.pointerEvents === 'none')).toHaveLength(0);
    // Open, a section does not repeat its choice beside the name: it is what is open under it.
    const kada = tree.root.findByProps({ testID: 'search-kada-toggle' });
    expect(kada.findAllByType('T' as React.ElementType)).toHaveLength(1);
  });

  test('a closed section says its choice as a quiet note beside the caret, in one line with the name when it fits', async () => {
    start = 'kada'; view = { ...view, price: 'OFFERS' }; await render();
    const cena = tree.root.findByProps({ testID: 'search-cena-toggle' });
    const [name, choice] = cena.findAllByType('T' as React.ElementType);
    expect(name.props.variant).toBe('bodyStrong');
    expect(choice.props).toMatchObject({ variant: 'note', tone: 'muted' });
    expect(choice.children.join('')).toBe('Prima ponude');
    expect(name.parent).toBe(choice.parent);
  });

  test('the foot is the flow foot: the quiet reset and the one green action, with the reason above when it cannot be pressed', async () => {
    start = 'kada'; await render();
    const foot = tree.root.findAll(node => String(node.type) === 'View' && node.props.testID === 'search-footer')[0];
    expect(StyleSheet.flatten(foot.props.style)).toMatchObject({ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 8 });
    expect(tree.root.findAllByProps({ testID: 'search-footer-reason' })).toHaveLength(0);
    expect(foot.findAllByType('Action' as React.ElementType).map(action => action.props.label)).toEqual(['Poništi filtere', 'Prikaži 5 zadataka']);
    view = { ...view, price: 'OFFERS', when: 'weekend', place: 'Vračar, Beograd' };
    await act(async () => tree.update(panelOf()));
    await act(async () => tree.unmount()); await render();
    expect(tree.root.findByProps({ testID: 'search-footer-reason' }).children.join('')).toBe('Pokušaj sa širom oblašću ili drugim danom.');
    expect(show().props.disabled).toBe(true);
  });
});
