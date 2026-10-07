import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import { BAR_TOP, DiscoverySearchBar, NearbyNotice } from '../../ui/v2/discovery/DiscoverySearchBar';

/**
 * The top of the Zadaci map is one white search pill and the menu beside it (UX plan 2.19 and section P): the SUMMARY of the search,
 * at the top at every height of the list. The filters are not here (they are the row of chips, `discovery-chip-row`), and what hangs
 * under the pill floats over the map without moving the list sheet's stops.
 */
const search = jest.fn(), clear = jest.fn(), more = jest.fn(), layout = jest.fn(), settings = jest.fn();
const props = () => ({ where: 'Petrovaradin, Novi Sad', conditions: 'Sutra · Prima ponude · Za 2 i više', onSearch: search, onClearWhere: clear,
  onMore: more, onLayout: layout });
let tree: ReactTestRenderer;
const render = async (extra: Partial<React.ComponentProps<typeof DiscoverySearchBar>> = {}) => act(async () => {
  tree = create(<DiscoverySearchBar {...props()} {...extra} />);
});
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
beforeEach(() => { jest.clearAllMocks(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('the pill says the search in ONE line, where first and the rest quieter, and the whole of it is spoken', async () => {
  await render();
  const summary = button('Pretraži zadatke');
  expect(summary.props.accessibilityValue.text).toBe(`${props().where}, ${props().conditions}`);
  expect(summary.props.accessibilityHint).toBe('Otvara pretragu: gde, kada i uslovi.');
  const words = summary.findAllByType('T' as React.ElementType);
  expect(words.map(text => text.props.numberOfLines)).toEqual([1, undefined]);
  expect(words[1].parent).toBe(words[0]);
  expect(words.flatMap(text => text.children.filter(child => typeof child === 'string')).join('')).toBe(`${props().where} · ${props().conditions}`);
  expect(words.every(text => text.props.allowFontScaling !== false && !text.props.adjustsFontSizeToFit)).toBe(true);
  await act(async () => summary.props.onPress());
  expect(search).toHaveBeenCalledTimes(1);
});

test('there is no filters button, no chip, no "U blizini" and no typing field in the bar: they live low, in the row of chips', async () => {
  await render();
  for (const label of ['Uslovi pretrage', 'Filteri', 'U blizini', 'Brzi filteri', 'Dodaj zadatak']) {
    expect([label, tree.root.findAllByProps({ accessibilityLabel: label }).length]).toEqual([label, 0]);
  }
  expect(tree.root.findAllByType('TextInput' as React.ElementType)).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'conditions-badge' })).toHaveLength(0);
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

test('it reports the pill\'s lower edge, and nothing that hangs below it moves that edge', async () => {
  await render({ below: <React.Fragment><NearbyNotice message="Tražimo tvoju lokaciju…" /></React.Fragment> });
  const row = tree.root.findByProps({ testID: 'discovery-search-row' });
  await act(async () => row.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 361, height: 56 } } }));
  expect(layout).toHaveBeenLastCalledWith(BAR_TOP + 56);
  // large text makes the pill taller: the edge follows the pill alone
  await act(async () => row.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 361, height: 76.4 } } }));
  expect(layout).toHaveBeenLastCalledWith(BAR_TOP + 77);
  // the notice is drawn after the row, in the bar, outside what is measured
  const bar = row.parent!;
  expect(bar.children.indexOf(row as never)).toBeLessThan(bar.children.findIndex(child => typeof child !== 'string' && child.type === NearbyNotice));
  expect(row.findAllByProps({ testID: 'nearby-notice' })).toHaveLength(0);
});

test('"U blizini" says why it could not help in a quiet live line, with the way to the settings when that is the remedy', async () => {
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
