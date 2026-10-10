import React from 'react';
import { Animated, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
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
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { DiscoverySearchPanel, NO_SEARCH, type DiscoveryV1SearchPanelSeam, type PanelMode, type SearchDraft, type SearchReadiness } from '../../ui/v2/discovery/DiscoverySearchPanel';
import type { RecentSearch } from '../../ui/v2/discovery/recentSearches';
import { sys } from '../../ui/system/tokens';

/**
 * The Zadaci search panel is TWO things (the owner's phone of 8 Oct 2026: "filteri odvojeni od pretrage"; the approved plan, U4 and U5). The SEARCH, opened by the pill, fills the
 * screen: a way back and the field "Šta tražiš" on top, "Gde" under it (every task, the work done remotely, the cities with how many tasks each, the biggest cities with none), and
 * what was searched before; a place or a search made before is the end of it, and applies at once. The FILTERS, opened by the round button beside the pill, rise as a sheet from
 * the bottom: Kada, Gde (how the work is done) and Iznos, a draft whose one green action says how many tasks the list will then show. Each takes away only its own half, and
 * × leaves the list as it was.
 */
// Thursday 24 September 2026, 10:00 in Belgrade: the 23rd is past, the 26th and 27th are the weekend.
const NOW = new Date('2026-09-24T08:00:00Z');
const day = (date: string) => ({ schedule: { kind: 'FIXED_WINDOW' as const, startsAt: `${date}T10:00:00+02:00`, endsAt: `${date}T12:00:00+02:00` } });
const row = (id: string, patch: Record<string, unknown> = {}): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`, podrucjeTekst: 'Liman, Novi Sad',
  vremeTekst: 'Po dogovoru', uslovi: [], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, priblizno: { lat: 45.25, lng: 19.84 }, taskTimezone: 'Europe/Belgrade',
  ...day('2026-09-26'), ...patch } as unknown as MarketplaceItem);
let rows: MarketplaceItem[] = [], view: MarketplaceView, mine: ReadonlySet<string> | undefined, mapArea: PublicBounds | null, mode: PanelMode, recent: readonly RecentSearch[];
let readiness: SearchReadiness = 'ready', p6Search: DiscoveryV1SearchPanelSeam | undefined, reduced = true;
let blurTarget: { current: null } | undefined;
const apply = jest.fn(), close = jest.fn(), openTask = jest.fn();
let tree: ReactTestRenderer;
const panelOf = () => <DiscoverySearchPanel items={rows} view={view} mine={mine} now={NOW} mapArea={mapArea} blurTarget={blurTarget}
  mode={mode} reduced={reduced} readiness={readiness} p6Search={p6Search} recent={recent} onApply={apply} onClose={close} onOpenTask={openTask} />;
const render = async () => act(async () => { tree = create(panelOf()); });
const byId = (testID: string) => tree.root.findAll(node => node.props.testID === testID)[0];
const byLabel = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label);
const tap = async (label: string) => act(async () => byLabel(label)[0].props.onPress());
const radio = (label: string | RegExp, within: ReactTestInstance = tree.root) => within.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'radio'
  && (typeof label === 'string' ? node.props.accessibilityLabel === label : label.test(node.props.accessibilityLabel)));
const choose = async (label: string | RegExp, within?: ReactTestInstance) => act(async () => radio(label, within)[0].props.onPress());
const texts = (root: ReactTestInstance = tree.root) => root.findAllByType('T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
const actions = () => tree.root.findAllByType('Action' as React.ElementType);
const actionNamed = (label: string) => actions().find(node => node.props.label === label)!;
const show = () => actions().find(node => node.props.style !== undefined && node.props.kind === undefined)!;
const lastDraft = (): SearchDraft => apply.mock.calls[apply.mock.calls.length - 1][0];
/** Every row of "Gde" (a choice or a button leading on), in order; the way back from the parts of a city is not a place. */
const placeRows = () => tree.root.findByProps({ accessibilityLabel: 'Mesta' })
  .findAll(node => String(node.type) === 'Press' && (node.props.accessibilityRole === 'radio' || node.props.accessibilityRole === 'button') && node.props.testID !== 'search-place-back');
const offered = () => placeRows().map(node => node.props.accessibilityLabel);
const recentRows = () => byId('search-recent')?.findAll(node => String(node.type) === 'Press').map(node => node.props.accessibilityLabel) ?? [];
/** The text field itself (the host element), not the component that draws it: both carry the test id. */
const whatField = () => tree.root.findAll(node => String(node.type) === 'TextInput' && node.props.testID === 'search-what-field')[0];
const typeWhat = async (text: string) => act(async () => whatField().props.onChangeText(text));
const dayCell = (dayOfMonth: number) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'button'
  && new RegExp(`, ${dayOfMonth}\\. sep`).test(node.props.accessibilityLabel ?? ''))[0];
const dateValue = () => tree.root.findByProps({ testID: 'search-date-toggle' }).props.accessibilityValue.text;
const sheetHeight = () => (StyleSheet.flatten(byId('search-sheet').props.style).height as unknown as { __getValue(): number }).__getValue();
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
  view = { ...initialMarketplaceView(), mode: 'map' }; mine = new Set(['mine']); mapArea = null; mode = 'search'; readiness = 'ready'; p6Search = undefined;
  reduced = true; blurTarget = undefined; recent = [];
  mockWindow = { width: 750, height: 1334, scale: 2, fontScale: 2 };
  apply.mockReset(); close.mockReset(); openTask.mockReset(); mockKeyboardVisible = false; mockKeyboardDismiss.mockReset();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });

const p6Snapshot = (patch: Partial<DiscoveryV1SearchSnapshot> = {}, within = ''): DiscoveryV1SearchSnapshot => ({
  active: true, generation: 1, key: discoveryV1SearchPreviewKey({ ...view, placeSearch: within } as SearchPreviewView, mapArea), status: 'ready', count: 37, undated: 6,
  availability: { hasKnownWorkMode: true, hasKnownSchedule: true, priceModes: ['MY_PRICE', 'OFFERS'] },
  places: [{ key: 'novi sad', text: 'Novi Sad', count: 21 }, { key: 'beograd', text: 'Beograd', count: 9 }],
  parts: [], placeHasMore: false, placePaging: false, everywhere: 80, inMapArea: mapArea ? 23 : null, facetError: false, ...patch,
});
const p6Seam = (snapshot: DiscoveryV1SearchSnapshot): DiscoveryV1SearchPanelSeam => ({ snapshot, onDraft: jest.fn(), onNextPlaces: jest.fn() });

const taskSuggestion = (): NonNullable<DiscoveryV1SearchSnapshot['tasks']>[number] => ({
  id: '11111111-1111-4111-8111-111111111111', revision: 4, title: 'Selidba polica', category: 'Selidbe',
  sortAt: NOW.toISOString(), publishedAt: NOW.toISOString(), status: 'PUBLISHED', urgent: false,
  scheduleKind: 'FLEXIBLE', startsAt: null, endsAt: null, executionLocationMode: 'STATIONARY',
  taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade', verifiedIdentityRequired: false,
  approximateCity: 'Novi Sad', approximateArea: 'Liman', pin: { lat: 45.25, lng: 19.84, precision: 'COARSE_1KM' },
  requiredSlots: 1, coveredSlots: 0, requiredSkills: [], requiredTools: [], requiredVehicles: [], requiredLicenses: [],
  minimumExperienceYears: null, priceMode: 'OFFERS', requesterPriceRsd: null, priceBasis: null,
  requesterProfileId: '22222222-2222-4222-8222-222222222222', responseDeadline: null, acceptsApplications: true,
  publicTopology: null, criticalConditions: null,
});

test('typing a city filters place suggestions and choosing it does not also search tasks for that city text', async () => {
  await render(); await typeWhat('Novi');
  expect(offered().some(name => name.includes('Beograd'))).toBe(false);
  await choose('Liman, Novi Sad, 2 zadatka');
  expect(lastDraft()).toMatchObject({ query: '', place: 'Liman, Novi Sad' });
});
test('returning to all cities preserves the previously committed task query, while explicitly clearing it does not', async () => {
  view = { ...view, query: 'pomoć' }; await render(); await typeWhat('Novi'); await tap('Svi gradovi');
  expect(whatField().props.value).toBe('pomoć');
  await choose('Vračar, Beograd, 1 zadatak'); expect(lastDraft().query).toBe('pomoć');
  await act(async () => tree.unmount()); await render(); await tap('Obriši reč'); await typeWhat('Novi');
  await choose('Liman, Novi Sad, 2 zadatka'); expect(lastDraft().query).toBe('');
});
test('a public task suggestion opens exactly once after the search has closed without applying its typed query', async () => {
  view = { ...view, query: 'selidba' }; reduced = false; holdAnimations();
  p6Search = p6Seam(p6Snapshot({ tasks: [taskSuggestion()] })); await render(); await finishAnimations();
  expect(texts()).toContain('Zadaci'); expect(texts()).toContain('Liman, Novi Sad');
  const pick = byLabel('Otvori zadatak: Selidba polica, Novi Sad')[0].props.onPress;
  await act(async () => { pick(); pick(); });
  expect(openTask).not.toHaveBeenCalled(); expect(apply).not.toHaveBeenCalled();
  await finishAnimations(); expect(close).toHaveBeenCalledTimes(1);
  expect(openTask).toHaveBeenCalledTimes(1);
  expect(openTask.mock.calls[0][0]).toMatchObject({ id: taskSuggestion().id, revision: 4, naslov: 'Selidba polica' });
});
test.each(['before click', 'during close'])('a stale suggestion cannot open a task %s', async boundary => {
  view = { ...view, query: 'selidba' }; reduced = false; holdAnimations();
  p6Search = p6Seam(p6Snapshot({ tasks: [taskSuggestion()] })); await render(); await finishAnimations();
  const pick = byLabel('Otvori zadatak: Selidba polica, Novi Sad')[0].props.onPress;
  if (boundary === 'during close') await act(async () => pick());
  p6Search = p6Seam(p6Snapshot({ status: 'loading', tasks: [] })); await act(async () => tree.update(panelOf()));
  if (boundary === 'before click') await act(async () => pick());
  await finishAnimations(); expect(openTask).not.toHaveBeenCalled(); expect(apply).not.toHaveBeenCalled();
});

describe('the SEARCH is a whole screen with a word, a place and what was searched before', () => {
  test('it fills the window with a way back and the field on top, "Gde" under them, and none of the filters', async () => {
    await render();
    expect(sheetHeight()).toBe(1334); expect(sheetCorner()).toBe(0);
    expect(byId('search-backdrop')).toBeUndefined(); // nothing of the map shows round it
    expect(byId('search-sheet').props).toMatchObject({ accessibilityViewIsModal: true, accessibilityLabel: 'Pretraga' });
    expect(StyleSheet.flatten(byId('search-sheet').props.style).backgroundColor).toBe(sys.color.surface);
    const header = byId('search-header');
    expect(header.findAll(node => String(node.type) === 'Press').map(node => node.props.accessibilityLabel)).toContain('Zatvori pretragu');
    expect(whatField().props).toMatchObject({ accessibilityLabel: 'Grad ili zadatak', placeholder: 'Grad ili naziv zadatka', autoFocus: false, returnKeyType: 'search' });
    expect(texts()).toContain('Mesta');
    expect(byLabel('Zatvori pretragu')).toHaveLength(1); expect(byLabel('Zatvori filtere')).toHaveLength(0);
    // the filters are the round button's: no days, no amount, no way of working here
    for (const filter of ['Kada', 'Iznos', 'Danas', 'Sutra', 'Sa iznosom', 'Datumi']) expect([filter, byLabel(filter).length + radio(filter).length]).toEqual([filter, 0]);
    expect(texts()).not.toMatch(/Kada|Iznos|Broj ljudi|Način rada/);
    // there is no place field: the words are typed in the one field above, and a letter never silently becomes a place
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži mesta' })).toHaveLength(0);
    expect(tree.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(1);
  });

  test('"Gde" offers every task, the work done remotely, the places the loaded tasks name with their counts, and the biggest cities under them', async () => {
    await render();
    // Own tasks take part in the same count; the remote word is not a place. Two spellings of one place are one.
    expect(offered().slice(0, 5)).toEqual(['Svi zadaci, 5 zadataka', 'Na daljinu, 1 zadatak', 'Liman, Novi Sad, 2 zadatka', 'Vračar, Beograd, 1 zadatak', 'Zemun, Beograd, 1 zadatak']);
    expect(texts()).toContain('Mesta sa zadacima'); expect(texts()).toContain('Popularni gradovi');
    // The two big cities whose tasks are under their parts lead to those parts; the rest are listed as having no task yet.
    expect(offered().slice(5, 8)).toEqual(['Beograd, 2 zadatka · po delovima grada', 'Novi Sad, 2 zadatka · po delovima grada', 'Niš, Još nema zadataka']);
    expect(offered().slice(7)).toEqual(['Niš', 'Kragujevac', 'Subotica', 'Pančevo', 'Čačak', 'Kraljevo', 'Smederevo', 'Šabac', 'Valjevo', 'Zrenjanin',
      'Leskovac', 'Kruševac', 'Sombor', 'Požarevac'].map(city => `${city}, Još nema zadataka`));
    // the number leads each row (one thing in bold), and "Na daljinu" has its picture only while its count is not known
    const figure = (label: string | RegExp) => radio(label)[0].findAll(node => String(node.type) === 'T' && node.props.variant === 'priceRow').map(node => node.props.children);
    expect(figure(/^Svi zadaci/)).toEqual([5]); expect(figure(/^Liman, Novi Sad/)).toEqual([2]); expect(figure(/^Na daljinu/)).toEqual([1]);
    expect(tree.root.findAllByType('FactArt' as React.ElementType)).toHaveLength(0);
  });

  test('"Na daljinu" is offered only where a task says how the work is done', async () => {
    rows = rows.filter(item => item.id !== 'remote'); await render();
    expect(offered()[0]).toBe('Svi zadaci, 4 zadatka');
    expect(offered().some(label => /^Na daljinu/.test(label))).toBe(false);
  });

  test('a place chosen from the rows consumes its typed name while preserving an already applied task query', async () => {
    view = { ...view, query: 'pomoć' }; await render();
    await typeWhat('Vračar');
    await choose('Vračar, Beograd, 1 zadatak');
    expect(apply).toHaveBeenCalledTimes(1);
    expect(lastDraft()).toMatchObject({ place: 'Vračar, Beograd', query: 'pomoć', area: null, pinPlace: null, where: 'any' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('"Svi zadaci" applies at once and takes the place, the area and the point away, and leaves the words and the filters as they were', async () => {
    view = { ...view, query: 'pomoć', place: 'Vračar, Beograd', area: [19.8, 45.2, 19.9, 45.3], pinPlace: '45.25,19.84', when: 'weekend', price: 'MY_PRICE' };
    await render();
    expect(radio(/^Vračar, Beograd/)[0].props.accessibilityState).toEqual({ checked: true });
    await choose(/^Svi zadaci/);
    expect(lastDraft()).toMatchObject({ place: null, area: null, pinPlace: null, query: 'pomoć', when: 'weekend', price: 'MY_PRICE', where: 'any' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('"Na daljinu" applies the work done remotely, which has no place; while it is chosen there are no cities to choose and the way to one is "Svi zadaci"', async () => {
    view = { ...view, place: 'Vračar, Beograd' }; await render();
    await choose(/^Na daljinu/);
    expect(lastDraft()).toMatchObject({ where: 'remote', place: null, area: null, pinPlace: null });
    await act(async () => tree.unmount()); apply.mockReset(); close.mockReset();
    view = { ...view, place: null, where: 'remote' }; await render();
    expect(radio(/^Na daljinu/)[0].props.accessibilityState).toEqual({ checked: true });
    expect(radio(/^Svi zadaci/)[0].props.accessibilityState).toEqual({ checked: false });
    // nothing else is offered: not a city, not a group of them, and a line says why
    expect(offered().map(label => label.replace(/, \d+ zadat.*$/, ''))).toEqual(['Svi zadaci', 'Na daljinu']);
    expect(texts()).toContain('Zadaci na daljinu nemaju mesto. Izaberi „Svi zadaci“ da biraš grad.');
    expect(texts()).not.toContain('Popularni gradovi'); expect(texts()).not.toContain('Još nema zadataka');
    await choose(/^Svi zadaci/);
    expect(lastDraft()).toMatchObject({ where: 'any', place: null });
  });

  test('the keyboard\'s search key and the green action apply the words, and the place chosen before; the action says how many tasks the list will show', async () => {
    view = { ...view, place: 'Liman, Novi Sad' }; await render();
    expect(show().props.label).toBe('Prikaži 2 zadatka');
    await typeWhat('pomoć a');
    expect(show().props.label).toBe('Prikaži 1 zadatak');
    expect(apply).not.toHaveBeenCalled();
    await act(async () => whatField().props.onSubmitEditing());
    expect(lastDraft()).toMatchObject({ query: 'pomoć a', place: 'Liman, Novi Sad' });
    expect(close).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount()); apply.mockReset(); close.mockReset();
    view = { ...view, place: null }; await render(); await typeWhat('pomoć');
    await act(async () => show().props.onPress());
    expect(lastDraft()).toMatchObject({ query: 'pomoć', place: null });
  });

  test('words that find nothing cannot be applied, from the keyboard either: the action says so and the list keeps what it had', async () => {
    await render(); await typeWhat('nema takvog zadatka');
    expect(show().props).toMatchObject({ label: 'Nema zadataka za ove uslove', disabled: true });
    await act(async () => whatField().props.onSubmitEditing());
    expect(apply).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
    await typeWhat('pomoć');
    await act(async () => whatField().props.onSubmitEditing());
    expect(lastDraft()).toMatchObject({ query: 'pomoć' }); expect(close).toHaveBeenCalledTimes(1);
  });

  test('a city whose tasks are under its parts leads to those parts and cannot pretend to be all of them; a part is the ordinary place; the back row returns', async () => {
    await render();
    const beograd = byLabel('Beograd, 2 zadatka · po delovima grada')[0];
    expect(beograd.props).toMatchObject({ accessibilityRole: 'button', accessibilityHint: 'Prikazuje delove grada.' });
    expect(beograd.props.accessibilityState).toBeUndefined();
    await act(async () => beograd.props.onPress());
    // Its parts are what the list shows now, the city is not listed again beside them, and nothing is applied by going into it.
    expect(offered()).toEqual(['Vračar, Beograd, 1 zadatak', 'Zemun, Beograd, 1 zadatak']);
    expect(byId('search-place-back').props).toMatchObject({ accessibilityLabel: 'Svi gradovi', accessibilityHint: 'Vraća na spisak gradova.' });
    expect(texts(byId('search-place-back'))).toBe('Beograd');
    expect(apply).not.toHaveBeenCalled();
    await act(async () => byId('search-place-back').props.onPress());
    expect(offered()[0]).toBe('Svi zadaci, 5 zadataka');
    await act(async () => byLabel('Beograd, 2 zadatka · po delovima grada')[0].props.onPress());
    await choose('Zemun, Beograd, 1 zadatak');
    expect(lastDraft()).toMatchObject({ place: 'Zemun, Beograd' });
  });

  test('a city that tasks name exactly is the ordinary place and is not repeated among the cities; a city with no task yet is a legal choice', async () => {
    rows = [row('ns', { podrucjeTekst: 'Novi Sad' }), row('ns2', { podrucjeTekst: 'Novi Sad' })]; await render();
    expect(offered().slice(0, 2)).toEqual(['Svi zadaci, 2 zadatka', 'Novi Sad, 2 zadatka']);
    expect(offered().filter(label => /^Novi Sad/.test(label))).toEqual(['Novi Sad, 2 zadatka']);
    await choose('Niš, Još nema zadataka');
    expect(lastDraft()).toMatchObject({ place: 'Niš' });
  });

  test('a place the other conditions leave empty says so, and the chosen place stays in the list so it can be taken away', async () => {
    view = { ...view, place: 'Niš', when: 'weekend' }; await render();
    expect(radio('Niš, Nema zadataka')[0].props.accessibilityState).toEqual({ checked: true });
    expect(show().props).toMatchObject({ label: 'Nema zadataka za ove uslove', disabled: true });
    const why = byId('search-footer-reason');
    expect(why.props.accessibilityLiveRegion).toBe('polite'); expect(why.children.join('')).toBe('Pokušaj sa širom oblašću ili drugim danom.');
    await choose(/^Svi zadaci/);
    expect(lastDraft()).toMatchObject({ place: null, when: 'weekend' });
  });

  test('what was searched before is a short list of rows: each applies its words and its place at once, and there is no list while there is nothing', async () => {
    await render(); expect(byId('search-recent')).toBeUndefined(); expect(texts()).not.toContain('Skorašnje pretrage');
    await act(async () => tree.unmount());
    recent = [{ query: 'selidba', place: 'Novi Sad' }, { query: 'farbanje', place: null }, { query: '', place: 'Beograd' }];
    view = { ...view, where: 'remote' };
    await render();
    expect(texts()).toContain('Skorašnje pretrage');
    expect(recentRows()).toEqual(['Skorašnje pretrage: „selidba“ · Novi Sad', 'Skorašnje pretrage: „farbanje“', 'Skorašnje pretrage: Beograd']);
    await act(async () => byLabel('Skorašnje pretrage: „selidba“ · Novi Sad')[0].props.onPress());
    // the place of the search takes the remote work back: a place and "Na daljinu" are not one search
    expect(lastDraft()).toMatchObject({ query: 'selidba', place: 'Novi Sad', area: null, pinPlace: null, where: 'any' });
    expect(close).toHaveBeenCalledTimes(1);
    expect(byLabel('Skorašnje pretrage: „farbanje“')[0].props.accessibilityRole).toBe('button');
  });

  test('"Očisti" takes away the words, the place and the remote work, and leaves the filters; it is not "Poništi", it applies nothing', async () => {
    view = { ...view, query: 'pomoć', place: 'Vračar, Beograd', when: 'weekend', price: 'MY_PRICE', where: 'remote' }; await render();
    expect(actionNamed('Očisti').props).toMatchObject({ kind: 'quiet' });
    expect(whatField().props.value).toBe('pomoć');
    await act(async () => actionNamed('Očisti').props.onPress());
    expect(apply).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
    expect(whatField().props.value).toBe('');
    expect(radio(/^Svi zadaci/)[0].props.accessibilityState).toEqual({ checked: true });
    await act(async () => show().props.onPress());
    expect(lastDraft()).toEqual({ ...NO_SEARCH, when: 'weekend', price: 'MY_PRICE' });
  });

  test('the way back leaves the list exactly as it was, and the words typed are not applied', async () => {
    await render(); await typeWhat('pomoć');
    await tap('Zatvori pretragu');
    expect(apply).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1);
  });

  test('Android Back dismisses the visible keyboard without losing what was typed, then closes when it is hidden', async () => {
    await withPlatform('android', 34, async () => {
      await render(); await typeWhat('Liman');
      mockKeyboardVisible = true;
      const requestClose = () => tree.root.findByType('Modal' as React.ElementType).props.onRequestClose();
      await act(async () => requestClose());
      expect(mockKeyboardDismiss).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled(); expect(apply).not.toHaveBeenCalled();
      expect(whatField().props.value).toBe('Liman');
      mockKeyboardVisible = false;
      await act(async () => requestClose());
      expect(close).toHaveBeenCalledTimes(1); expect(apply).not.toHaveBeenCalled();
    });
  });

  test('the words are "ti": no "vas", no "posao", and nothing of the old sections', async () => {
    recent = [{ query: 'selidba', place: 'Novi Sad' }];
    await render();
    const everything = ` | ${texts()} | ${tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string').map(node => node.props.accessibilityLabel).join(' | ')}`;
    expect(everything).not.toMatch(/\bvas\b|\bvam\b|\bposao\b|\bposla\b|Koliko vas|Kako se radi|Poništi pretragu|U blizini|Ova oblast/i);
  });
});

describe('the server preview (P6) of the search', () => {
  test('count and cities come from the server preview, never the bounded loaded rows', async () => {
    rows = [row('only-loaded-row')]; p6Search = p6Seam(p6Snapshot());
    await render();
    expect(show().props.label).toBe('Prikaži 37 zadataka');
    // the server has no count of the work done remotely, so none is said (a picture leads the row instead)
    expect(offered().slice(0, 4)).toEqual(['Svi zadaci, 80 zadataka', 'Na daljinu', 'Novi Sad, 21 zadatak', 'Beograd, 9 zadataka']);
    expect(texts()).toContain('Gradovi sa zadacima'); expect(texts()).not.toContain('Mesta sa zadacima');
    expect(radio('Na daljinu')[0].findAllByType('FactArt' as React.ElementType).map(node => node.props.kind)).toEqual(['remote']);
    await choose('Novi Sad, 21 zadatak');
    expect(lastDraft()).toMatchObject({ place: 'Novi Sad' });
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

  test('place continuation and the draft preview are explicit server callbacks; the city drilled into asks for its parts, and the words typed never become a place', async () => {
    mapArea = [19, 44, 21, 46];
    const seam = p6Seam(p6Snapshot({ placeHasMore: true })); p6Search = seam;
    await render();
    expect(seam.onDraft).toHaveBeenCalledWith(expect.objectContaining({ query: '', placeSearch: '' }), mapArea);
    await act(async () => actionNamed('Prikaži još mesta').props.onPress()); expect(seam.onNextPlaces).toHaveBeenCalledTimes(1);
    // The same typed input previews tasks and cities; neither selection is silently committed.
    await typeWhat('selidba');
    expect(seam.onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'selidba', placeSearch: 'selidba' }), mapArea);
    await typeWhat('');
    // Going into a city asks for the places that contain its name.
    await act(async () => byLabel('Subotica')[0].props.onPress());
    expect(seam.onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ query: '', placeSearch: 'Subotica' }), mapArea);
    expect(show().props.label).toBe('Učitavamo zadatke…');
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
    p6Search = p6Seam(p6Snapshot({ placeHasMore: true })); await render();
    expect(texts()).not.toContain('Još nema zadataka');
    expect(byLabel('Subotica')[0].props).toMatchObject({ accessibilityRole: 'button', accessibilityHint: 'Prikazuje mesta u ovom gradu.' });
  });

  test('a city that the server does not know either says "Još nema zadataka", and can then be chosen as an ordinary place', async () => {
    p6Search = p6Seam(p6Snapshot({ placeHasMore: true })); await render();
    await act(async () => byLabel('Subotica')[0].props.onPress());
    expect(byId('search-place-back').props.accessibilityLabel).toBe('Svi gradovi');
    // The server answers the letters of the city: no place contains them, and there are no more to read.
    p6Search = p6Seam(p6Snapshot({ places: [], placeHasMore: false }, 'Subotica'));
    await act(async () => tree.update(panelOf()));
    expect(offered()).toEqual(['Subotica, Još nema zadataka']);
    await choose('Subotica, Još nema zadataka');
    expect(lastDraft()).toMatchObject({ place: 'Subotica', query: '' });
  });

  test('a city the server answers with its parts shows the parts with their counts, and the city is not listed again', async () => {
    p6Search = p6Seam(p6Snapshot({ places: [{ key: 'novi sad', text: 'Novi Sad', count: 21 }], placeHasMore: true })); await render();
    await act(async () => byLabel('Beograd')[0].props.onPress());
    p6Search = p6Seam(p6Snapshot({ places: [{ key: 'beograd, vračar', text: 'Beograd, Vračar', count: 9 }, { key: 'beograd, zemun', text: 'Beograd, Zemun', count: 4 }],
      placeHasMore: false }, 'Beograd'));
    await act(async () => tree.update(panelOf()));
    expect(offered()).toEqual(['Beograd, Vračar, 9 zadataka', 'Beograd, Zemun, 4 zadatka']);
    await choose('Beograd, Zemun, 4 zadatka');
    expect(lastDraft()).toMatchObject({ place: 'Beograd, Zemun' });
  });

  test('the parts of a city are the server\'s area rows under the cities of the letters, an ordinary place each, and not offered twice', async () => {
    p6Search = p6Seam(p6Snapshot({ places: [{ key: 'beograd', text: 'Beograd', count: 13 }], placeHasMore: true })); await render();
    await act(async () => byLabel('Novi Sad')[0].props.onPress());
    p6Search = p6Seam(p6Snapshot({ places: [{ key: 'novi sad', text: 'Novi Sad', count: 23 }],
      parts: [{ key: 'liman, novi sad', text: 'Liman, Novi Sad', count: 9 }, { key: 'novi sad', text: 'Novi Sad', count: 23 }], placeHasMore: false }, 'Novi Sad'));
    await act(async () => tree.update(panelOf()));
    expect(texts()).toContain('Gradovi sa zadacima'); expect(texts()).toContain('Delovi grada');
    expect(offered()).toEqual(['Novi Sad, 23 zadatka', 'Liman, Novi Sad, 9 zadataka']);
    await choose('Liman, Novi Sad, 9 zadataka');
    expect(lastDraft()).toMatchObject({ place: 'Liman, Novi Sad' });
  });

  test.each([
    ['loading', 'Učitavamo zadatke…', true],
    ['error', 'Zadaci nisu učitani', true],
    ['pending', 'Prikaži zadatke', false],
  ] as const)('while the list is %s the panel counts nothing and its action says so', async (state, label, disabled) => {
    readiness = state; if (state !== 'pending') rows = [];
    await render();
    expect(show().props).toMatchObject({ label, disabled });
    expect(offered()[0]).toBe('Svi zadaci');
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

describe('the FILTERS are a sheet with the days, how the work is done and the amount', () => {
  const group = (id: string) => byId(id);
  const open = async (id: string) => { const toggle = byId(`${id}-toggle`); if (!toggle.props.accessibilityState.expanded) await act(async () => toggle.props.onPress()); };

  test('it rises from the bottom over a backdrop, with Kada, Gde and Iznos in that order, and nothing of the search', async () => {
    mode = 'filters'; await render();
    expect(sheetHeight()).toBe(1227); expect(sheetCorner()).toBe(sys.radius.sheet); // 92 %: separate sections leave room for the date grid
    expect(byId('search-backdrop')).toBeDefined();
    expect(byId('search-sheet').props).toMatchObject({ accessibilityViewIsModal: true, accessibilityLabel: 'Filteri' });
    expect(StyleSheet.flatten(byId('search-sheet').props.style)).toMatchObject({ backgroundColor: 'transparent', boxShadow: [], elevation: 0 });
    expect(byLabel('Zatvori filtere')).toHaveLength(1); expect(byLabel('Zatvori pretragu')).toHaveLength(0);
    const order = tree.root.findAll(node => String(node.type) === 'View' && /^filters-(when|where|amount)$/.test(node.props.testID ?? '')).map(node => node.props.testID);
    expect(order).toEqual(['filters-when', 'filters-where', 'filters-amount']);
    expect(texts()).toContain('Kada'); expect(texts()).toContain('Gde'); expect(texts()).toContain('Iznos');
    expect(texts()).not.toMatch(/Broj ljudi|Osoba|osoba|Redosled/);
    // the search is the pill's: no field, no places, no recent searches
    expect(whatField()).toBeUndefined(); expect(tree.root.findAllByProps({ accessibilityLabel: 'Mesta' })).toHaveLength(0);
    expect(radio('Svi zadaci')).toHaveLength(0);
    expect(actions().map(action => action.props.label)).toEqual(['Očisti', 'Prikaži 5 zadataka']);
  });

  test('"Gde" is offered only when a task says how the work is done, or when it is already chosen', async () => {
    rows = rows.filter(item => item.id !== 'remote'); mode = 'filters'; await render();
    expect(group('filters-where')).toBeUndefined();
    await act(async () => tree.unmount());
    view = { ...view, where: 'onsite' }; await render(); await open('filters-where');
    expect(radio('Na licu mesta', group('filters-where'))[0].props.accessibilityState.checked).toBe(true);
  });

  test('the choices are one row each and a draft: nothing is applied before "Prikaži", and the number follows the choice', async () => {
    mode = 'filters'; await render();
    await open('filters-amount');
    expect(radio('Svejedno', group('filters-amount'))[0].props.accessibilityState.checked).toBe(true);
    await open('filters-where');
    expect(radio('Svejedno', group('filters-where'))[0].props.accessibilityState.checked).toBe(true);
    await open('filters-when');
    await choose('Ovaj vikend', group('filters-when'));
    expect(radio('Ovaj vikend')[0].props.accessibilityState).toEqual({ checked: true });
    expect(show().props.label).toBe('Prikaži 4 zadatka');
    await open('filters-amount');
    expect(byId('filters-when-body')).toBeUndefined();
    expect(byId('filters-when-toggle').props.accessibilityValue.text).toContain('vikend');
    await choose('Tražim ponude', group('filters-amount'));
    expect(show().props).toMatchObject({ label: 'Nema zadataka za ove uslove', disabled: true });
    await choose('Sa iznosom', group('filters-amount'));
    expect(show().props.label).toBe('Prikaži 4 zadatka');
    expect(apply).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
    await act(async () => show().props.onPress());
    expect(lastDraft()).toMatchObject({ when: 'weekend', price: 'MY_PRICE', where: 'any', query: '', place: null });
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('a day that is chosen is taken away by tapping it again: there is no "any day" among the days', async () => {
    mode = 'filters'; await render();
    expect(radio('Bilo kada')).toHaveLength(0);
    await choose('Danas'); expect(radio('Danas')[0].props.accessibilityState).toEqual({ checked: true });
    await choose('Danas'); expect(radio('Danas')[0].props.accessibilityState).toEqual({ checked: false });
    await act(async () => show().props.onPress());
    expect(lastDraft().when).toBe('any');
  });

  test('a time the filters do not offer but the list is narrowed to (the week) is still a choice here, to be seen and taken away', async () => {
    view = { ...view, when: 'week' }; mode = 'filters'; await render();
    expect(radio('Ove nedelje')[0].props.accessibilityState).toEqual({ checked: true });
    // taken away, it is not one of the days the filters offer, so it is gone from the row
    await choose('Ove nedelje'); expect(radio('Ove nedelje')).toHaveLength(0);
    expect(radio('Danas').concat(radio('Sutra'), radio('Ovaj vikend')).every(chip => chip.props.accessibilityState.checked === false)).toBe(true);
    await act(async () => show().props.onPress());
    expect(lastDraft().when).toBe('any');
  });

  test('what the search left is applied as it was: the filters keep the word, the place and the area', async () => {
    view = { ...view, query: 'pomoć', place: 'Vračar, Beograd', price: 'MY_PRICE' }; mode = 'filters'; await render();
    await choose('Ovaj vikend');
    await act(async () => show().props.onPress());
    expect(lastDraft()).toMatchObject({ query: 'pomoć', place: 'Vračar, Beograd', when: 'weekend', price: 'MY_PRICE' });
  });

  test('choosing remote clears geographic scope in the draft, keeps the conditions, and applies only on confirmation', async () => {
    view = { ...view, place: 'Liman, Novi Sad', area: [19.8, 45.2, 19.9, 45.3], pinPlace: '45.25,19.84', price: 'MY_PRICE', query: 'Pomoć', places: 2 };
    mode = 'filters'; await render(); await open('filters-where'); await choose('Na daljinu', group('filters-where'));
    expect(show().props.label).toBe('Prikaži 1 zadatak');
    expect(apply).not.toHaveBeenCalled(); expect(view.pinPlace).toBe('45.25,19.84');
    await act(async () => show().props.onPress());
    expect(lastDraft()).toMatchObject({ where: 'remote', area: null, place: null, pinPlace: null, query: 'Pomoć', price: 'MY_PRICE', places: 2 });
  });

  test('"Očisti" empties the filters and counts again, and leaves the search; × leaves the list exactly as it was', async () => {
    view = { ...view, price: 'OFFERS', when: 'weekend', place: 'Vračar, Beograd', query: 'pomoć' }; mode = 'filters'; await render();
    expect(show().props).toMatchObject({ label: 'Nema zadataka za ove uslove', disabled: true });
    await act(async () => actionNamed('Očisti').props.onPress());
    // The place and the word are the search's: they stay, and the tasks of that place are what is counted.
    expect(show().props.label).toBe('Prikaži 1 zadatak');
    expect(radio('Ovaj vikend')[0].props.accessibilityState.checked).toBe(false);
    await open('filters-amount');
    expect(radio('Svejedno', group('filters-amount'))[0].props.accessibilityState.checked).toBe(true);
    await act(async () => show().props.onPress());
    expect(lastDraft()).toEqual({ ...NO_SEARCH, place: 'Vračar, Beograd', query: 'pomoć' });
    // A new panel starts from the list's own view again; × applies nothing.
    apply.mockReset(); close.mockReset(); await act(async () => tree.unmount()); await render();
    expect(radio('Ovaj vikend')[0].props.accessibilityState.checked).toBe(true);
    await tap('Zatvori filtere');
    expect(apply).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1);
  });

  test('a time of a range of days: two taps, the days between are shaded, "Gotovo" closes the calendar; a past day cannot be chosen and says so', async () => {
    mode = 'filters'; await render();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
    expect(texts()).toContain('Septembar 2026');
    const past = dayCell(23);
    expect(past.props.accessibilityLabel).toBe('Sreda, 23. sep, prošao dan');
    expect(past.props).toMatchObject({ disabled: true, accessibilityState: { disabled: true, selected: false } });
    expect(dayCell(24).props.accessibilityLabel).toBe('Četvrtak, 24. sep, danas');
    expect(actions().filter(node => node.props.label === 'Gotovo')).toHaveLength(0);
    // The first tap starts the range; it is already a choice of that one day, counted so (the four tasks of the 26th, including mine; the one of the 30th is not).
    await act(async () => dayCell(26).props.onPress());
    expect(texts()).toContain('Izaberi poslednji dan.');
    expect(dayCell(26).props.accessibilityState).toEqual({ disabled: false, selected: true });
    expect(show().props.label).toBe('Prikaži 4 zadatka');
    // The second tap ends it: the days between are shaded and both ends are chosen.
    await act(async () => dayCell(28).props.onPress());
    expect(dateValue()).toBe('26–28. sep');
    expect([26, 27, 28].map(n => dayCell(n).props.accessibilityState.selected)).toEqual([true, true, true]);
    expect(dayCell(29).props.accessibilityState.selected).toBe(false);
    expect(tree.root.findAll(node => node.props.testID === 'range-band')).toHaveLength(3);
    // A day before the pending start starts the range again.
    await act(async () => dayCell(30).props.onPress()); await act(async () => dayCell(25).props.onPress());
    expect(texts()).toContain('Izaberi poslednji dan.');
    await act(async () => actionNamed('Gotovo').props.onPress());
    expect(tree.root.findAllByProps({ testID: 'search-date-editor' })).toHaveLength(0);
    // the days replace the quick days
    expect(radio('Ovaj vikend')[0].props.accessibilityState.checked).toBe(false);
  });

  test('one tapped day applies as a one-day range, and the row and the draft say that day', async () => {
    mode = 'filters'; await render();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
    await act(async () => dayCell(30).props.onPress());
    expect(show().props.label).toBe('Prikaži 1 zadatak');
    expect(dateValue()).toBe('30. sep');
    await act(async () => show().props.onPress());
    expect(lastDraft()).toMatchObject({ dates: { from: '2026-09-30', to: '2026-09-30' }, when: 'any' });
  });

  test('tasks without a date are said, not hidden silently, when a time choice leaves them out', async () => {
    rows = [...rows, row('undated', { schedule: undefined }), row('incomplete', { schedule: { kind: 'FIXED_WINDOW', startsAt: null, endsAt: '2026-09-26T12:00:00+02:00' } })];
    mode = 'filters'; await render();
    expect(texts()).not.toMatch(/bez datuma/);
    await choose('Ovaj vikend');
    expect(texts()).toContain('2 zadatka bez datuma nisu u ovom izboru.');
  });

  test('the wording is "ti" and plain Serbian: no "vas", no "posao", no "server"', async () => {
    mode = 'filters'; await render();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
    const everything = ` | ${texts()} | ${tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string').map(node => node.props.accessibilityLabel).join(' | ')}`;
    expect(everything).not.toMatch(/\bvas\b|\bvam\b|\bposao\b|\bposla\b|server|Poništi/i);
  });

  test('the server preview counts the draft too: "Prikaži N" is the server\'s count, and the work done remotely is offered while the preview changes', async () => {
    mode = 'filters'; p6Search = p6Seam(p6Snapshot({ count: 12 })); await render();
    expect(show().props.label).toBe('Prikaži 12 zadataka');
    expect(group('filters-where')).toBeDefined();
    await choose('Ovaj vikend');
    // the draft changed: the preview that answers the old draft is not this one's
    expect(show().props).toMatchObject({ label: 'Učitavamo zadatke…', disabled: true });
    await act(async () => tree.unmount());
    p6Search = p6Seam(p6Snapshot({ availability: { hasKnownWorkMode: false, hasKnownSchedule: true, priceModes: ['MY_PRICE'] } })); await render();
    expect(group('filters-where')).toBeUndefined();
  });
});

describe('the layout at large text and in a narrow window', () => {
  test.each([[320, 1], [320, 2], [412, 1.3], [412, 2]])(
    'at %i dp / %s text, both footer actions have their own width without applying the draft during reflow', async (width, fontScale) => {
      mockWindow = { ...mockWindow, width: 412, fontScale: 1 }; await render();
      expect(StyleSheet.flatten(byId('search-actions').props.style).flexDirection).toBe('row');
      await typeWhat('Vračar');
      mockWindow = { ...mockWindow, width, fontScale };
      await act(async () => tree.update(panelOf()));
      expect(StyleSheet.flatten(byId('search-actions').props.style)).toMatchObject({ flexDirection: 'column', alignItems: 'stretch' });
      expect(StyleSheet.flatten(byId('search-show').props.style)).toMatchObject({ flex: 0, width: '100%' });
      expect(apply).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
      expect(show().props.label).toBe('Prikaži 1 zadatak');
      await act(async () => show().props.onPress());
      expect(lastDraft().query).toBe('Vračar'); expect(close).toHaveBeenCalledTimes(1);
    },
  );

  test('the filters\' labels can wrap, and the chosen circle of a day never spills out of its cell', async () => {
    mockWindow = { width: 320, height: 640, scale: 2, fontScale: 1.3 }; mode = 'filters'; await render();
    const chip = radio('Ovaj vikend')[0];
    expect(StyleSheet.flatten(chip.props.style).maxWidth).toBe('100%');
    expect(StyleSheet.flatten(chip.findByType('T' as React.ElementType).props.style).flexShrink).toBe(1);
    expect(chip.findByType('T' as React.ElementType).props.numberOfLines).toBeUndefined();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
    const grid = tree.root.findByProps({ testID: 'search-date-grid' });
    await act(async () => grid.props.onLayout({ nativeEvent: { layout: { width: 321, height: 300 } } }));
    await act(async () => dayCell(26).props.onPress());
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'range-end' }).props.style)).toMatchObject({ width: 40, height: 40, borderRadius: 20 });
    await act(async () => grid.props.onLayout({ nativeEvent: { layout: { width: 280, height: 300 } } }));
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'range-end' }).props.style)).toMatchObject({ width: 38, height: 38, borderRadius: 19 });
  });
});

describe('the frame, the backdrop and the motion', () => {
  const blurs = () => tree.root.findAll(node => node.type === BlurView);

  test('the filters\' backdrop is blurred on Android 12 and newer, with the screen it opened over as the target; the search has none', async () => {
    blurTarget = { current: null }; mode = 'filters';
    for (const version of [31, 34, 36]) {
      await withPlatform('android', version, async () => {
        await render();
        expect(blurs()).toHaveLength(1);
        expect(blurs()[0].props).toMatchObject({ intensity: 35, tint: 'light', blurMethod: 'dimezisBlurViewSdk31Plus', blurTarget, blurReductionFactor: expect.any(Number) });
        expect(byId('search-dim-backdrop')).toBeDefined();
        await act(async () => tree.unmount());
      });
    }
    mode = 'search'; await withPlatform('android', 34, async () => { await render(); expect(blurs()).toHaveLength(0); expect(byId('search-dim-backdrop')).toBeUndefined(); });
  });

  test('it is only dimmed on an older Android and without a target: a dim, never a white page', async () => {
    mode = 'filters';
    await withPlatform('android', 30, async () => {
      blurTarget = { current: null }; await render();
      expect(blurs()).toHaveLength(0);
      expect(StyleSheet.flatten(byId('search-dim-backdrop').props.style)).toMatchObject({ backgroundColor: sys.color.dim });
      await act(async () => tree.unmount());
    });
    await withPlatform('android', 36, async () => {
      blurTarget = undefined; await render();
      expect(blurs()).toHaveLength(0); expect(byId('search-dim-backdrop')).toBeDefined();
    });
  });

  test('a tap on the blurred screen outside closes the filters and applies nothing; the sheet leaves a visible strip of the screen, and the backdrop is decoration only', async () => {
    mode = 'filters'; await render();
    expect(sheetHeight()).toBeLessThan(1334);
    expect(byId('search-backdrop').props).toMatchObject({ pointerEvents: 'none', accessible: false, importantForAccessibility: 'no-hide-descendants' });
    await act(async () => byId('search-backdrop-press').props.onPress());
    expect(close).toHaveBeenCalledTimes(1); expect(apply).not.toHaveBeenCalled();
  });

  test('the frame is measured on the screen it opens on: the search clears the status bar, the filters leave it room, and the foot clears the bottom bar', async () => {
    await act(async () => { tree = create(<SafeAreaInsetsContext.Provider value={{ top: 30, bottom: 20, left: 0, right: 0 }}>{panelOf()}</SafeAreaInsetsContext.Provider>); });
    await act(async () => byId('search-root').props.onLayout({ nativeEvent: { layout: { height: 1000 } } }));
    expect(sheetHeight()).toBe(1000);
    expect(StyleSheet.flatten(byId('search-header').props.style).paddingTop).toBe(30);
    expect(StyleSheet.flatten(byId('search-footer-slot').props.style).paddingBottom).toBe(20);
    await act(async () => tree.unmount()); mode = 'filters';
    await act(async () => { tree = create(<SafeAreaInsetsContext.Provider value={{ top: 30, bottom: 20, left: 0, right: 0 }}>{panelOf()}</SafeAreaInsetsContext.Provider>); });
    await act(async () => byId('search-root').props.onLayout({ nativeEvent: { layout: { height: 1000 } } }));
    expect(sheetHeight()).toBe(920);
    await act(async () => byId('search-root').props.onLayout({ nativeEvent: { layout: { height: 400 } } }));
    expect(sheetHeight()).toBe(354); // status bar plus 16 dp wins over the percentage
  });

  test('the panel is a transparent modal without the platform\'s own fade: its motion is its own', async () => {
    await render();
    expect(tree.root.findByType('Modal' as React.ElementType).props).toMatchObject({ transparent: true, animationType: 'none', statusBarTranslucent: true });
  });

  test('the sheet rises on the sheet spring, the backdrop fades in, and under reduced motion nothing is asked of the driver', async () => {
    mode = 'filters'; holdAnimations(); reduced = false; await render();
    const spring = runs.find(run => run.kind === 'spring' && run.config.toValue === 0)!;
    expect(spring.config).toMatchObject({ ...sys.motion.sheetSpring, useNativeDriver: true });
    const fade = runs.find(run => run.kind === 'timing' && run.config.toValue === 1 && run.config.useNativeDriver === true && run.config.duration === sys.motion.enter);
    expect(fade).toBeDefined();
    await act(async () => tree.unmount()); runs = []; reduced = true; await render();
    expect(runs.filter(run => run.kind === 'spring' || run.config.duration === sys.motion.enter || run.config.duration === sys.motion.sheetClose)).toHaveLength(0);
    expect(sheetHeight()).toBe(1227);
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
    mode = 'filters'; holdAnimations(); reduced = false; await render();
    await finishAnimations();
    await act(async () => show().props.onPress());
    expect(apply).toHaveBeenCalledTimes(1); expect(close).not.toHaveBeenCalled();
    await finishAnimations(); expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('the parts of the panel', () => {
  test('failed preview retries the same choices without applying or closing the panel', async () => {
    mode = 'filters'; view = { ...view, query: 'selidba', where: 'remote', price: 'OFFERS' };
    const seam = p6Seam(p6Snapshot({ status: 'error', count: null })); p6Search = seam;
    await render();
    expect(show().props).toMatchObject({ label: 'Pokušaj ponovo', disabled: false });
    await act(async () => show().props.onPress());
    expect(seam.onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'selidba', where: 'remote', price: 'OFFERS' }), mapArea);
    expect(apply).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
    p6Search = { ...seam, snapshot: p6Snapshot({ count: 12 }) };
    await act(async () => tree.update(panelOf()));
    expect(show().props).toMatchObject({ label: 'Prikaži 12 zadataka', disabled: false });
  });

  test('the narrow search retains one input line and keeps typed text and clear available', async () => {
    mockWindow = { width: 361, height: 779, scale: 3.5, fontScale: 1.15 };
    await render();
    expect(whatField().props).toMatchObject({ multiline: false, numberOfLines: 1, placeholder: 'Grad ili naziv zadatka' });
    await typeWhat('Pomoć pri preseljenju u Novi Sad');
    expect(whatField().props.value).toBe('Pomoć pri preseljenju u Novi Sad');
    await tap('Obriši reč'); expect(whatField().props.value).toBe('');
  });
  test('a chosen chip has a neutral well, ink edge and words, and a confirmation tick; a chosen day is written in onDark', async () => {
    mode = 'filters'; await render();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
    await act(async () => dayCell(26).props.onPress());
    const end = tree.root.findByProps({ testID: 'range-end' });
    expect(StyleSheet.flatten(end.findByType('T' as React.ElementType).props.style).color).toBe(sys.color.onDark);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
    await choose('Sutra');
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
    mode = 'filters'; await render();
    expect(byId('search-show').props.accessibilityLiveRegion).toBe('polite');
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
    const month = tree.root.findAllByType('T' as React.ElementType).find(node => node.children.includes('Septembar 2026'))!;
    expect(month.props.accessibilityLiveRegion).toBe('polite');
    await act(async () => dayCell(26).props.onPress());
    const prompt = tree.root.findAllByType('T' as React.ElementType).find(node => node.children.join('') === 'Izaberi poslednji dan.')!;
    expect(prompt.props.accessibilityLiveRegion).toBe('polite');
  });

  test('the place rows take no touch beyond themselves, and the field is the system\'s one field in the bundled regular face', async () => {
    await render();
    for (const place of placeRows()) expect(place.props.hitSlop).toBe(0);
    const field = tree.root.findAll(node => String(node.type) === 'View' && StyleSheet.flatten(node.props.style)?.minHeight === 52)[0];
    expect(StyleSheet.flatten(field.props.style)).toMatchObject({ borderColor: sys.color.lineStrong, borderRadius: sys.radius.control });
    const input = StyleSheet.flatten(whatField().props.style);
    expect(input.fontFamily).toBe('Inter-Regular'); expect(input.fontWeight).toBeUndefined();
    await typeWhat('vrač');
    const clear = byLabel('Obriši reč')[0];
    expect(clear.props.hitSlop).toBe(0); expect(StyleSheet.flatten(clear.props.style)).toMatchObject({ width: 48, height: 48 });
  });

  test('the foot is the flow foot: the quiet reset and the one green action, with the reason above when it cannot be pressed', async () => {
    mode = 'filters'; await render();
    const foot = tree.root.findAll(node => String(node.type) === 'View' && node.props.testID === 'search-footer')[0];
    expect(StyleSheet.flatten(foot.props.style)).toMatchObject({ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 8 });
    expect(tree.root.findAllByProps({ testID: 'search-footer-reason' })).toHaveLength(0);
    expect(foot.findAllByType('Action' as React.ElementType).map(action => action.props.label)).toEqual(['Očisti', 'Prikaži 5 zadataka']);
    await act(async () => tree.unmount());
    view = { ...view, price: 'OFFERS', when: 'weekend', place: 'Vračar, Beograd' }; await render();
    expect(byId('search-footer-reason').children.join('')).toBe('Pokušaj sa širom oblašću ili drugim danom.');
    expect(show().props.disabled).toBe(true);
  });
});

// HONOR 2026-10-09: premature autoFocus drew a cursor without opening the keyboard.
it('focuses search once after the native Modal is shown and never after closing or unmount', async () => {
  mode = 'search';
  const focus = jest.fn();
  await act(async () => { tree = create(panelOf(), { createNodeMock: element => (element.props as { testID?: string }).testID === 'search-what-field' ? { focus } : null }); });
  const onShow = tree.root.findByType('Modal' as React.ElementType).props.onShow;
  expect(focus).not.toHaveBeenCalled();
  await act(async () => onShow());
  expect(focus).toHaveBeenCalledTimes(1);
  await act(async () => onShow());
  expect(focus).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  await act(async () => onShow());
  expect(focus).toHaveBeenCalledTimes(1);
});
it('a late native shown event cannot reopen the keyboard after search close', async () => {
  mode = 'search'; const focus = jest.fn();
  await act(async () => { tree = create(panelOf(), { createNodeMock: element => (element.props as { testID?: string }).testID === 'search-what-field' ? { focus } : null }); });
  const onShow = tree.root.findByType('Modal' as React.ElementType).props.onShow;
  await tap('Zatvori pretragu');
  await act(async () => onShow());
  expect(focus).not.toHaveBeenCalled();
});
it('filters never request the search keyboard when the native Modal appears', async () => {
  mode = 'filters'; await render();
  expect(tree.root.findByType('Modal' as React.ElementType).props.onShow).toBeUndefined();
});
