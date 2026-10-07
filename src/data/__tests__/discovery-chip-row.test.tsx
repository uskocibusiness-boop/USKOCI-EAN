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
import { DiscoveryChipRow, SCOPE_OPTIONS, filtersSpoken, filtersWords, type QuickChip } from '../../ui/v2/discovery/DiscoveryChipRow';
import { sys } from '../../ui/system/tokens';

/**
 * The one row of chips of the Zadaci screen (UX plan 2.13 and section P, variant B "filteri dole"): "Svi zadaci | Za mene" first
 * (built, not drawn), then "Filteri · N", then the quick filters that really exist. The same row stands over the map while the list is
 * lowered and in the list's sticky header from half height up; what is pinned here is what it says and what it never says.
 */
const press = jest.fn(), filters = jest.fn(), scope = jest.fn();
const chips = (): QuickChip[] => [
  { key: 'where:onsite', label: 'Na licu mesta', selected: true, onPress: () => press('onsite') },
  { key: 'price:OFFERS', label: 'Prima ponude', selected: false, onPress: () => press('offers') },
];
let tree: ReactTestRenderer;
const render = async (props: Partial<React.ComponentProps<typeof DiscoveryChipRow>> = {}) => act(async () => {
  tree = create(<DiscoveryChipRow filtersCount={0} onFilters={filters} chips={chips()} {...props} />);
});
const labels = () => tree.root.findAll(node => String(node.type) === 'Press' && typeof node.props.accessibilityLabel === 'string')
  .map(node => node.props.accessibilityLabel as string);
const button = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0] as ReactTestInstance;
const words = (node: ReactTestInstance) => node.findAllByType('T' as React.ElementType).flatMap(text => text.children.filter(child => typeof child === 'string')).join('');
beforeEach(() => { jest.clearAllMocks(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('the row is "Filteri" and the quick filters, in that order, and "U blizini" is not among them', async () => {
  await render();
  expect(labels()).toEqual(['Filteri', 'Na licu mesta', 'Prima ponude']);
  expect(labels()).not.toContain('U blizini'); // it moves the camera and filters nothing: it stands with the zoom buttons
  expect(tree.root.findByProps({ accessibilityLabel: 'Brzi filteri' })).toBeTruthy();
});

test('"Za mene" is built but not drawn: no scope, not even a lone "Svi zadaci", until the switch says the server has it', async () => {
  await render();
  expect(labels()).not.toContain('Svi zadaci'); expect(labels()).not.toContain('Za mene');
  expect(tree.root.findAllByProps({ accessibilityRole: 'tablist' })).toHaveLength(0);
  await act(async () => tree.update(<DiscoveryChipRow forMeAvailable={false} filtersCount={0} onFilters={filters} chips={chips()} />));
  expect(labels()).not.toContain('Za mene');
});

test('with the switch on, the scope comes first as one capsule of two tabs, and a tap on the other one asks for it', async () => {
  await render({ forMeAvailable: true, onScope: scope });
  expect(labels()).toEqual(['Svi zadaci', 'Za mene', 'Filteri', 'Na licu mesta', 'Prima ponude']);
  expect(SCOPE_OPTIONS.map(option => option.label)).toEqual(['Svi zadaci', 'Za mene']);
  expect(button('Svi zadaci').props).toMatchObject({ accessibilityRole: 'tab', accessibilityState: { selected: true } });
  expect(button('Za mene').props).toMatchObject({ accessibilityRole: 'tab', accessibilityState: { selected: false } });
  await act(async () => button('Za mene').props.onPress());
  expect(scope).toHaveBeenCalledWith('forMe');
  await act(async () => tree.update(<DiscoveryChipRow forMeAvailable scope="forMe" onScope={scope} filtersCount={0} onFilters={filters} chips={chips()} />));
  expect(button('Za mene').props.accessibilityState).toEqual({ selected: true });
  scope.mockClear();
  await act(async () => button('Za mene').props.onPress()); // the chosen one asks nothing
  expect(scope).not.toHaveBeenCalled();
});

test('"Filteri" always has its word, and the number of conditions that are on only when there are some', async () => {
  expect([filtersWords(0), filtersWords(1), filtersWords(12)]).toEqual(['Filteri', 'Filteri · 1', 'Filteri · 12']);
  expect([filtersSpoken(0), filtersSpoken(1), filtersSpoken(2), filtersSpoken(5)]).toEqual(['Filteri', 'Filteri, 1 aktivan', 'Filteri, 2 aktivna', 'Filteri, 5 aktivnih']);
  await render();
  expect(words(button('Filteri'))).toBe('Filteri');
  expect(button('Filteri').props.accessibilityState).toEqual({ selected: false });
  await act(async () => tree.update(<DiscoveryChipRow filtersCount={2} onFilters={filters} chips={chips()} />));
  expect(words(button('Filteri, 2 aktivna'))).toBe('Filteri · 2');
  expect(button('Filteri, 2 aktivna').props.accessibilityState).toEqual({ selected: true });
  expect(StyleSheet.flatten(button('Filteri, 2 aktivna').props.style)).toMatchObject({ backgroundColor: sys.color.wash, borderColor: sys.color.ink });
  await act(async () => button('Filteri, 2 aktivna').props.onPress());
  expect(filters).toHaveBeenCalledTimes(1);
  expect(button('Filteri, 2 aktivna').props.accessibilityHint).toBe('Otvara pretragu: gde, kada i uslovi.');
});

test('a quick chip is a toggle: spoken as selected or not, with a check on the chosen one, and its own callback', async () => {
  await render();
  expect(button('Na licu mesta').props.accessibilityState).toEqual({ selected: true });
  expect(button('Prima ponude').props.accessibilityState).toEqual({ selected: false });
  expect(button('Na licu mesta').findAll(node => String(node.type) === 'Check')).toHaveLength(1);
  expect(button('Prima ponude').findAll(node => String(node.type) === 'Check')).toHaveLength(0);
  await act(async () => button('Prima ponude').props.onPress());
  expect(press).toHaveBeenCalledWith('offers');
  expect(StyleSheet.flatten(button('Na licu mesta').props.style).minHeight).toBeGreaterThanOrEqual(48);
});

test('over the map the chips lift off the tiles; in the sheet\'s header they are flat with a hairline', async () => {
  await render({ surface: 'map' });
  expect(StyleSheet.flatten(button('Prima ponude').props.style).boxShadow ?? StyleSheet.flatten(button('Prima ponude').props.style).elevation).toBeTruthy();
  await act(async () => tree.update(<DiscoveryChipRow surface="sheet" filtersCount={0} onFilters={filters} chips={chips()} />));
  const flat = StyleSheet.flatten(button('Prima ponude').props.style);
  expect(flat.boxShadow).toBeUndefined(); expect(flat.elevation).toBeUndefined();
  expect(flat.borderColor).toBe(sys.color.lineStrong);
  // the sheet's row lines up with the cards under it
  expect(StyleSheet.flatten(tree.root.findByProps({ accessibilityLabel: 'Brzi filteri' }).props.contentContainerStyle).paddingHorizontal).toBe(sys.space.lg);
});

test('the row scrolls sideways and never takes a tap away from a chip (a keyboard over it does not swallow it)', async () => {
  await render();
  const rail = tree.root.findByProps({ accessibilityLabel: 'Brzi filteri' });
  expect(rail.props).toMatchObject({ horizontal: true, showsHorizontalScrollIndicator: false, keyboardShouldPersistTaps: 'handled' });
});
