import { chromeJoin, capsuleCollapse } from '../../ui/v2/discovery/discoveryChrome';
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import { BAR_TOP, DiscoverySearchBar, NearbyNotice } from '../../ui/v2/discovery/DiscoverySearchBar';
import { FILTERS_HINT, SEARCH_HINT, SEARCH_PLACEHOLDER, filtersSpoken, searchWords } from '../../ui/v2/discovery/discoveryWords';
import { sys } from '../../ui/system/tokens';

/**
 * The top of the Zadaci map is one white search pill, the menu in it, and BESIDE it the round button of the filters (UX plan 2.19 and section P; the owner's phone of
 * 8 Oct 2026; the approved plan, U1): the pill is the SEARCH (a word and a place) and the button the FILTERS, which is why the magnifier never leads into the filters
 * and the button never into the search. Both stand at the top at every height of the list, and what hangs under them floats over the map without moving the list sheet's stops.
 */
const search = jest.fn(), clear = jest.fn(), more = jest.fn(), layout = jest.fn(), settings = jest.fn(), filters = jest.fn();
const props = () => ({ where: '„farbanje“ · Novi Sad', onSearch: search, onClearWhere: clear, onMore: more, onLayout: layout, filters: { count: 0, onPress: filters } });
let tree: ReactTestRenderer;
const render = async (extra: Partial<React.ComponentProps<typeof DiscoverySearchBar>> = {}) => act(async () => {
  tree = create(<DiscoverySearchBar {...props()} {...extra} />);
});
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const sized = (node: ReactTestInstance) => { let at: ReactTestInstance | null = node; while (at) { const style = StyleSheet.flatten(at.props.style); if (style?.width === 56) return style; at = at.parent; } return null; };
beforeEach(() => { jest.clearAllMocks(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('the pill says what is searched in ONE line, and the whole of it is spoken', async () => {
  await render();
  const summary = button('Pretraži zadatke');
  expect(summary.props.accessibilityValue.text).toBe(props().where);
  expect(summary.props.accessibilityHint).toBe(SEARCH_HINT);
  const words = summary.findAllByType('T' as React.ElementType);
  expect(words.map(text => text.props.numberOfLines)).toEqual([1]);
  expect(words.flatMap(text => text.children.filter(child => typeof child === 'string')).join('')).toBe(props().where);
  expect(words.every(text => text.props.allowFontScaling !== false && !text.props.adjustsFontSizeToFit)).toBe(true);
  await act(async () => summary.props.onPress());
  expect(search).toHaveBeenCalledTimes(1);
  expect(filters).not.toHaveBeenCalled(); // the pill never opens the filters
});

test('with nothing searched the pill is a place to start, quiet, and it claims nothing about which tasks the list holds', async () => {
  await render({ where: null, onClearWhere: undefined });
  const summary = button('Pretraži zadatke');
  expect(summary.props.accessibilityValue).toBeUndefined();
  const words = summary.findAllByType('T' as React.ElementType);
  expect(words.map(text => text.children)).toEqual([[SEARCH_PLACEHOLDER]]);
  // the two things a search is, the one thing the pill opens (the approved plan, U1)
  expect(SEARCH_PLACEHOLDER).toBe('Grad ili zadatak');
  expect(words[0].props).toMatchObject({ variant: 'body', tone: 'muted' });
  // the placeholder is not "Svi zadaci": the capsules and the count say which tasks the list is about
  expect(words[0].children).not.toContain('Svi zadaci');
});

test('the pill opens the search and says so: a word and a place, never the filters', async () => {
  await render();
  expect(SEARCH_HINT).toBe('Otvara pretragu po reči i mestu.');
  for (const filter of [/kada/i, /uslov/i, /filter/i, /cena/i, /iznos/i]) expect(SEARCH_HINT).not.toMatch(filter);
});

test('the filters are a separate round button beside the pill: as high as it, with the sliders, opening the filters and nothing of the search', async () => {
  await render();
  const open = button('Filteri');
  expect(open.props).toMatchObject({ testID: 'filters-button', accessibilityRole: 'button', accessibilityHint: FILTERS_HINT, accessibilityState: { selected: false } });
  expect(FILTERS_HINT).toBe('Otvara filtere: kada, gde i iznos.');
  // the search is the pill: what the button says it opens is the filters, never the words and the place
  expect(FILTERS_HINT).not.toMatch(/pretra/i);
  expect(sized(open)).toMatchObject({ width: 56, height: 56, borderRadius: sys.radius.pill });
  // it stands in the pill's own row, after the pill, and is not a part of the pill's press
  const row = tree.root.findByProps({ testID: 'discovery-search-row' });
  expect(row.findAllByProps({ testID: 'filters-button' })).toHaveLength(1);
  expect(button('Pretraži zadatke').findAllByProps({ testID: 'filters-button' })).toHaveLength(0);
  await act(async () => open.props.onPress());
  expect(filters).toHaveBeenCalledTimes(1);
  expect(search).not.toHaveBeenCalled();
  // no number while no condition is on
  expect(tree.root.findAllByProps({ testID: 'filters-count' })).toHaveLength(0);
});

test('the number of conditions that are on is said in the button, in words and in a small disc, and only when there are some', async () => {
  expect([filtersSpoken(0), filtersSpoken(1), filtersSpoken(2), filtersSpoken(5)]).toEqual(['Filteri', 'Filteri, 1 aktivan', 'Filteri, 2 aktivna', 'Filteri, 5 aktivnih']);
  await render({ filters: { count: 2, onPress: filters } });
  const open = button('Filteri, 2 aktivna');
  expect(open.props.accessibilityState).toEqual({ selected: true });
  const disc = tree.root.findByProps({ testID: 'filters-count' });
  expect(disc.findAllByType('T' as React.ElementType).flatMap(text => text.children).join('')).toBe('2');
  // the number is a figure, never only a colour; the disc is not a stop of its own (the button says it)
  expect(disc.props).toMatchObject({ pointerEvents: 'none', accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
  expect(StyleSheet.flatten(disc.props.style).minWidth).toBeGreaterThanOrEqual(20);
});

test('without the filters there is no button for them, and there is no "moja lokacija", no typing field and no old badge in the pill', async () => {
  await render({ filters: undefined });
  expect(tree.root.findAllByProps({ testID: 'filters-button' })).toHaveLength(0);
  for (const label of ['Uslovi pretrage', 'Moja lokacija', 'U blizini', 'Dodaj zadatak']) {
    expect([label, tree.root.findAllByProps({ accessibilityLabel: label }).length]).toEqual([label, 0]);
  }
  expect(tree.root.findAllByType('TextInput' as React.ElementType)).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'conditions-badge' })).toHaveLength(0);
});

test('the capsules stand under the pill and the button, inside what is measured; a notice hangs under them, outside it', async () => {
  const capsules = React.createElement('View', { testID: 'the-capsules' });
  await render({ chips: capsules, below: <NearbyNotice message="Tražimo tvoju lokaciju…" /> });
  const stack = tree.root.findByProps({ testID: 'discovery-search-stack' });
  const rowOfPill = tree.root.findByProps({ testID: 'discovery-search-row' });
  // pill and button, then capsules, in the measured stack; the notice is a sibling after it
  expect(stack.children.indexOf(rowOfPill as never)).toBe(0);
  expect(stack.findAllByProps({ testID: 'the-capsules' })).toHaveLength(1);
  const collapsing = stack.findByProps({ testID: 'discovery-collapsing-chips' });
  expect(collapsing.findAllByProps({ testID: 'the-capsules' })).toHaveLength(1);
  expect(stack.children.indexOf(collapsing.parent as never)).toBe(1);
  expect(StyleSheet.flatten(collapsing.parent!.props.style).overflow).toBe('hidden');
  expect(stack.findAllByProps({ testID: 'nearby-notice' })).toHaveLength(0);
  const bar = stack.parent!;
  expect(bar.children.indexOf(stack as never)).toBeLessThan(bar.children.findIndex(child => typeof child !== 'string' && child.type === NearbyNotice));
});

test('the pill\'s own × and the menu are full 48 touch targets, and the × is there only while the list is narrowed', async () => {
  await render();
  expect(StyleSheet.flatten(button('Prikaži sve zadatke').props.style)).toMatchObject({ width: 48, minHeight: 48 });
  expect(StyleSheet.flatten(button('Još mogućnosti').props.style)).toMatchObject({ width: 48, height: 48 });
  await act(async () => button('Prikaži sve zadatke').props.onPress());
  await act(async () => button('Još mogućnosti').props.onPress());
  expect(clear).toHaveBeenCalledTimes(1); expect(more).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<DiscoverySearchBar {...props()} onClearWhere={undefined} onMore={undefined} />));
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Prikaži sve zadatke' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Još mogućnosti' })).toHaveLength(0);
});

test('it reports the lower edge of the pill and its capsules, and nothing that hangs below them moves that edge', async () => {
  await render({ chips: <React.Fragment />, below: <React.Fragment><NearbyNotice message="Tražimo tvoju lokaciju…" /></React.Fragment> });
  const stack = tree.root.findByProps({ testID: 'discovery-search-stack' });
  await act(async () => stack.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 361, height: 124 } } }));
  expect(layout).toHaveBeenLastCalledWith(BAR_TOP + 124);
  // large text makes the pill taller: the edge follows the pill and the capsules alone
  await act(async () => stack.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 361, height: 144.4 } } }));
  expect(layout).toHaveBeenLastCalledWith(BAR_TOP + 145);
  // the notice is drawn after the stack, outside what is measured
  expect(stack.findAllByProps({ testID: 'nearby-notice' })).toHaveLength(0);
});

describe('what the pill says (searchWords)', () => {
  const none = { place: null, query: '', area: null, pinPlace: null };
  test('is nothing while nothing is searched, and never a filter', () => {
    expect(searchWords(none)).toBeNull();
    // "Na daljinu", "Za mene", the days and the price are capsules: the pill does not say them
    expect(searchWords({ ...none, where: 'remote', forMe: true } as never)).toBeNull();
  });
  test('is the words and then the place, in the order of the pill\'s own "Šta tražiš · Gde"; or one point, or the map\'s area', () => {
    expect(searchWords({ ...none, place: 'Novi Sad' })).toBe('Novi Sad');
    expect(searchWords({ ...none, query: ' farbanje ' })).toBe('„farbanje“');
    expect(searchWords({ ...none, place: 'Novi Sad', query: 'farbanje' })).toBe('„farbanje“ · Novi Sad');
    expect(searchWords({ ...none, pinPlace: '45.25,19.83' })).toBe('Na ovom mestu');
    expect(searchWords({ ...none, query: 'farbanje', pinPlace: '45.25,19.83' })).toBe('„farbanje“ · Na ovom mestu');
    expect(searchWords({ ...none, area: [19.7, 45.2, 19.9, 45.3] })).toBe('Ova oblast');
    // a place beats the area, as it always did: the list is narrowed to the place
    expect(searchWords({ ...none, place: 'Novi Sad', area: [19.7, 45.2, 19.9, 45.3] })).toBe('Novi Sad');
  });
});

test('"Moja lokacija" says why it could not help in a quiet live line, with the way to the settings when that is the remedy', async () => {
  await act(async () => { tree = create(<NearbyNotice message="Dozvoli lokaciju u podešavanjima ili pomeri mapu ručno." onSettings={settings} />); });
  const notice = tree.root.findByProps({ testID: 'nearby-notice' });
  expect(notice.props.accessibilityLiveRegion).toBe('polite');
  expect(notice.findAllByType('T' as React.ElementType)[0].children).toEqual(['Dozvoli lokaciju u podešavanjima ili pomeri mapu ručno.']);
  expect(StyleSheet.flatten(button('Podešavanja lokacije').props.style).minHeight).toBe(48);
  await act(async () => button('Podešavanja lokacije').props.onPress());
  expect(settings).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<NearbyNotice message="Tražimo tvoju lokaciju…" />));
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Podešavanja lokacije' })).toHaveLength(0);
});

test('fractional native stops fully join paint and hide capsules within the final layout dp', () => {
  expect(chromeJoin(72.2, 72, 66)).toBe(1);
  expect(capsuleCollapse(65.8, 66)).toBe(66);
  expect(chromeJoin(74, 72, 66)).toBeLessThan(1);
  expect(capsuleCollapse(64, 66)).toBe(64);
});
test('FULL white backing starts at map top outside the offset search bar', async () => {
  await render({ motion: { sheetTop: { value: 72 } as never, offset: { value: 66 } as never, compactTop: 72, capsules: 66, hidden: true }, chips: <React.Fragment /> });
  const backing = tree.root.findByProps({ testID: 'discovery-chrome-backing' });
  expect(StyleSheet.flatten(backing.props.style).top).toBe(0);
  const stack = tree.root.findByProps({ testID: 'discovery-search-stack' });
  expect(stack.parent!.findAllByProps({ testID: 'discovery-chrome-backing' })).toHaveLength(0);
  expect(tree.root.findByProps({ testID: 'discovery-collapsing-chips' }).props.importantForAccessibility).toBe('no-hide-descendants');
});
