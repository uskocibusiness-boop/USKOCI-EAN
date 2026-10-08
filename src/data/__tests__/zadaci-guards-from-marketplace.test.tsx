import React, { useState } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import BottomSheet from '@gorhom/bottom-sheet';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';
import { brandAction } from '../../ui/system/tokens';
let mockReduced = false;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  const List = ({ data, renderItem, ListEmptyComponent, ...props }: any) => React.createElement('List', props,
    data.length ? data.map((item: any, index: number) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item, index }))) : ListEmptyComponent);
  const Modal = ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
  const Keyboard = { dismiss: () => undefined };
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return List;
    if (key === 'Modal') return Modal;
    if (key === 'Keyboard') return Keyboard;
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/v2/DiscoveryMap', () => ({ DiscoveryMap: 'DiscoveryMap' }));
jest.mock('../../ui/v2/discovery/nearbyLocation', () => ({ loadNearbyLocation: jest.fn() }));
import { DiscoveryPresentation } from '../../ui/v2/DiscoveryPresentation';
import { loadNearbyLocation } from '../../ui/v2/discovery/nearbyLocation';

/**
 * Guards that lived in the discovery branch of MarketplacePresentation (marketplace-presentation and pkg011-slice1)
 * until that branch was deleted (review r3b, 2026-09-24): the Zadaci tab has been DiscoveryPresentation since owner step 4,
 * so each assertion that was not already in discovery-presentation is kept here, on the screen it now guards. Nothing in
 * DiscoveryPresentation is changed by this file; it only renders it.
 */
const row = (id: string, patch: Record<string, unknown> = {}): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`, podrucjeTekst: 'Novi Sad', vremeTekst: 'Po dogovoru',
  uslovi: [], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE', ponudjenaCena: { prikaz: '2.000 RSD' }, pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 },
  priblizno: { lat: 45.25, lng: 19.83 }, ...patch } as unknown as MarketplaceItem);
let rows: MarketplaceItem[] = [], loading = false, error = false;
let snapshot: MarketplaceView, initial: MarketplaceView;
const open = jest.fn(), refresh = jest.fn();
function Screen() {
  const [view, setView] = useState(initial); snapshot = view;
  return <DiscoveryPresentation items={rows} loading={loading} error={error} scopeKey="a:1" view={view} onView={setView}
    onOpen={open} onRefresh={refresh} onProfile={() => {}} onNew={() => {}} />;
}
let tree: ReactTestRenderer;
const render = async () => act(async () => { tree = create(<Screen />); });
const press = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const tap = async (label: string) => act(async () => press(label).props.onPress());
const click = async (label: string) => act(async () => tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === label)!.props.onPress());
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const cards = () => tree.root.findAll(node => String(node.type) === 'Press' && /^Otvori zadatak [^:]/.test(node.props.accessibilityLabel ?? ''));
/** A card's label is the command, its title and then everything it shows: the title is what a guard test reads. */
const titleOf = (node: ReactTestInstance) => String(node.props.accessibilityLabel).replace(/\. .*$/, '');
const maps = () => tree.root.findAllByType('DiscoveryMap' as React.ElementType);
// Discovery V47: the search is a panel over the map; its one green action says how many tasks it will show.
const showAction = () => tree.root.findAllByType('Action' as React.ElementType).find(node => /^Prikaži \d+ zadat|^Nema zadataka za ove uslove$/.test(node.props.label))!;
// The words that find tasks are typed in the field of the search, which fills the screen (the approved plan, U4).
const search = async (words: string) => {
  await tap('Pretraži zadatke');
  await act(async () => press('Šta tražiš').props.onChangeText(words));
  await act(async () => showAction().props.onPress());
};
// The one primary action is the element whose own surface is the brand surface (last style wins, as in React Native).
const surfaceOf = (style: unknown): unknown => Array.isArray(style) ? style.map(surfaceOf).filter(value => value !== undefined).pop()
  : style && typeof style === 'object' ? (style as { backgroundColor?: unknown }).backgroundColor : undefined;
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  initial = { ...initialMarketplaceView(), mode: 'map' }; rows = [row('one'), row('two', { priblizno: null, rezimCene: 'OFFERS' })];
  loading = error = mockReduced = false; open.mockClear(); refresh.mockClear();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

// From pkg011-slice1: the title is a header, it is the tab's own name and never an app mode. V41 (2026-09-23): the tab
// header draws the mark, and the name reaches a screen reader as the header's label.
test('Discovery leads with task search and no repeated wordmark or app-mode heading', async () => {
  await render();
  expect(tree.root.findAll(node => node.props.accessibilityRole === 'header' && node.props.accessibilityLabel === 'USKOČI, Zadaci')).toHaveLength(0);
  expect(press('Pretraži zadatke').props.accessibilityRole).toBe('button');
  expect(texts()).not.toContain('Uskoči i zaradi'); expect(texts()).not.toMatch(/Ja mogu|Meni treba/);
  expect(tree.root.findAll(node => String(node.props.accessibilityLabel).includes('Pronađi zadatak'))).toHaveLength(0);
  expect(tree.root.findAllByType('T' as React.ElementType).some(node => node.props.accessibilityRole === 'header' && node.children.includes('Mapa'))).toBe(false);
  expect(tree.root.findAllByType('T' as React.ElementType).some(node => node.props.accessibilityRole === 'header' && node.children.includes('Zadaci'))).toBe(false);
});

// From marketplace-presentation: search is there at once, without the keyboard jumping up over the map on arrival.
// Discovery V47: it is the pill over the map, one tap away, and there is no text field on the screen to take the keyboard.
test('search is available immediately without opening the keyboard', async () => {
  await render();
  expect(press('Pretraži zadatke').props.accessibilityRole).toBe('button');
  expect(tree.root.findAllByType('TextInput' as React.ElementType)).toHaveLength(0);
});

// From marketplace-presentation and pkg011-slice1: a read in flight or a failed read never leaves an old card or the old
// map on screen, and "Pokušaj ponovo" only asks for the list again.
test.each(['loading', 'error'])('%s removes stale cards and the map; retry is bound and changes nothing else', async status => {
  loading = status === 'loading'; error = status === 'error'; initial.query = 'Pomoć'; await render();
  expect(maps()).toHaveLength(0); expect(cards()).toHaveLength(0);
  if (loading) expect(texts()).toContain('Učitavamo zadatke…');
  if (error) {
    await click('Pokušaj ponovo');
    expect(refresh).toHaveBeenCalledTimes(1); expect(snapshot).toMatchObject({ query: 'Pomoć', mode: 'map' });
  }
});

// From marketplace-presentation: under reduced motion the search appears at once (Discovery V47: the panel that replaced
// the filter sheet). Nearby is now bound, but rendering or searching must not start native location.
test('reduced motion opens search at once; Nearby waits for its own tap and no distance/geocoder is invented', async () => {
  mockReduced = true; await render();
  await act(async () => tree.root.findByProps({ testID: 'discovery-body' }).props.onLayout({ nativeEvent: { layout: { height: 800 } } }));
  await tap('Pretraži zadatke'); // the search fills the screen: the field, then Gde
  const modal = tree.root.findByType('Modal' as React.ElementType);
  expect(modal.props.animationType).toBe('none');
  expect(modal.findAllByType(BottomSheet)).toHaveLength(0);
  // The control above the list ("Moja lokacija") is the map's button; the search has no position of its own, so "U blizini" is not one of the places to choose.
  const control = (label: string, role: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label && node.props.accessibilityRole === role);
  expect(control('Moja lokacija', 'button')).toHaveLength(1); expect(control('U blizini', 'radio')).toHaveLength(0);
  expect(loadNearbyLocation).not.toHaveBeenCalled();
  await act(async () => tree.root.findAllByType('Action' as React.ElementType).find(node => /^Prikaži \d+ zadat/.test(node.props.label))!.props.onPress());
  expect(loadNearbyLocation).not.toHaveBeenCalled(); // applying a search asks nothing of the phone
  expect(JSON.stringify(tree.toJSON())).not.toMatch(/GPS|km od|geocod/i);
});

// From pkg011-slice1: in the search panel (Discovery V47) the one filled green action is the one that applies it.
test('the filters offer the amount as radios and their apply action is the only brand action', async () => {
  await render(); await tap('Filteri');
  // The round button opens the filters: Kada, Gde (when a task says how the work is done) and Iznos, every choice in sight at once.
  const radio = tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'radio' && node.props.accessibilityLabel === 'Tražim ponude');
  expect(radio).toHaveLength(1);
  expect(tree.root.findByProps({ testID: 'filters-amount' })).toBeTruthy();
  const brand = tree.root.findAllByType('Action' as React.ElementType).filter(node => surfaceOf(node.props.style) === brandAction.backgroundColor);
  expect(brand.map(node => node.props.label)).toEqual(['Prikaži 2 zadatka']);
});

// From marketplace-presentation (review r3 item 7): the filtered-empty view's one way forward clears what was chosen,
// and only that. Where the map stands is not a filter, and neither is where the list sheet rests (Discovery V47 keeps
// it in the view).
test('"Poništi filtere" clears search, price and area but keeps the map and where it stands', async () => {
  const viewport = { center: [19.83, 45.25] as [number, number], zoom: 12, bounds: [19, 45, 20, 46] as [number, number, number, number] };
  Object.assign(initial, { query: 'Nema takvog posla', price: 'MY_PRICE', area: [19, 45, 20, 46], viewport });
  await render(); expect(texts()).toContain('Nema zadataka u ovom prikazu');
  await click('Poništi filtere');
  expect(snapshot).toEqual({ ...initialMarketplaceView(), mode: 'map', viewport, sheet: 'half' });
  const [map] = maps();
  expect(map.props.viewport).toEqual(viewport);
  expect(map.props.items.map((item: MarketplaceItem) => item.id)).toEqual(['one', 'two']);
  expect(open).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
});

// From marketplace-presentation (verifier r3b vc, fix 1): clearing the search takes the search away and nothing else.
// The searched words are said by the pill, and its × (the way back to every task) removes them: the price stays, and so does the map's area, which the list still follows.
test('removing the searched words keeps the price and the area', async () => {
  Object.assign(initial, { price: 'MY_PRICE', area: [19, 45, 20, 46] });
  await render();
  await search('Pomoć');
  expect(snapshot).toMatchObject({ query: 'Pomoć', price: 'MY_PRICE', area: [19, 45, 20, 46] });
  expect(press('Pretraži zadatke').props.accessibilityValue).toEqual({ text: '„Pomoć“' });
  await tap('Prikaži sve zadatke');
  expect(snapshot).toMatchObject({ query: '', price: 'MY_PRICE', area: [19, 45, 20, 46] });
  // Nothing but the map's area is said now, and the same × takes that away too.
  expect(press('Pretraži zadatke').props.accessibilityValue).toEqual({ text: 'Ova oblast' });
  await tap('Prikaži sve zadatke');
  expect(snapshot).toMatchObject({ query: '', price: 'MY_PRICE', area: null });
});

// From marketplace-presentation (verifier r3b vc, fix 1): removing the price filter keeps the search, the area, where the
// map stands and the mode.
test('removing the price filter keeps the search, the area, the map position and the mode', async () => {
  const viewport = { center: [19.83, 45.25] as [number, number], zoom: 12, bounds: [19, 45, 20, 46] as [number, number, number, number] };
  const area: [number, number, number, number] = [19, 45, 20, 46];
  Object.assign(initial, { price: 'OFFERS', query: 'Pomoć', area, viewport });
  await render();
  // Discovery V47: a price that is on is a chosen quick chip over the map, and the chip takes it away.
  const chip = tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Tražim ponude' && node.props.accessibilityState?.selected)[0];
  await act(async () => chip.props.onPress());
  expect(snapshot).toMatchObject({ price: 'all', query: 'Pomoć', area, viewport, mode: 'map' });
});

// From marketplace-presentation (verifier r3b vc, fix 1): with a search and a map area on, the filter sheet's count is
// the count of the list under that same search and area, not of every task. Discovery V47: under an area the list also
// keeps the tasks with no point on the map (here "two"), after the area's own, and the count counts them too.
test('with a search and a map area on, "Prikaži N zadataka" counts the list shown under them', async () => {
  rows = [row('one'), row('two', { priblizno: null, rezimCene: 'OFFERS' }), row('tri', { naslov: 'Selidba tri' }),
    row('četiri', { priblizno: { lat: 44.0, lng: 21.5 } }), row('pet', { priblizno: { lat: 45.3, lng: 19.9 } })];
  Object.assign(initial, { query: 'Pomoć', area: [19, 45, 20, 46] });
  await render();
  expect(cards().map(titleOf)).toEqual(['Otvori zadatak Pomoć one', 'Otvori zadatak Pomoć pet', 'Otvori zadatak Pomoć two']);
  // The list is lowered here (most tasks are on the map), so the row of chips stands over the map as well as in the sheet's header: the first one is the one in reach.
  await act(async () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Filteri')[0].props.onPress());
  expect(showAction().props.label).toBe('Prikaži 3 zadatka');
});
