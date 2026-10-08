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
import { DiscoveryChipRow, FOR_ME, type QuickChip } from '../../ui/v2/discovery/DiscoveryChipRow';
import { materialControl, sys } from '../../ui/system/tokens';

/**
 * The one row of capsules over the map, under the search pill and the round filters button (UX plan 2.13 and section P; the owner's phone of 7 and 8 Oct 2026;
 * the approved plan, U1: "Za mene · Danas · Ovaj vikend · Na daljinu · Sa iznosom"). "Za mene" is a capsule that is on or off (built, not drawn, until the switch says
 * the server has it), then the quick filters that really exist. The filters are NOT a capsule any more: they have their own button beside the pill. It stands over the
 * map at every height of the list; what is pinned here is what it says and what it never says.
 */
const press = jest.fn(), scope = jest.fn(), leave = jest.fn();
const chips = (): QuickChip[] => [
  { key: 'when:today', label: 'Danas', selected: true, onPress: () => press('today') },
  { key: 'when:weekend', label: 'Ovaj vikend', selected: false, onPress: () => press('weekend') },
  { key: 'where:remote', label: 'Na daljinu', selected: false, onPress: () => press('remote') },
  { key: 'price:MY_PRICE', label: 'Sa iznosom', selected: false, onPress: () => press('amount') },
];
let tree: ReactTestRenderer;
const render = async (props: Partial<React.ComponentProps<typeof DiscoveryChipRow>> = {}) => act(async () => {
  tree = create(<DiscoveryChipRow chips={chips()} {...props} />);
});
const labels = () => tree.root.findAll(node => String(node.type) === 'Press' && typeof node.props.accessibilityLabel === 'string')
  .map(node => node.props.accessibilityLabel as string);
const button = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0] as ReactTestInstance;
beforeEach(() => { jest.clearAllMocks(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('the row is the quick filters in the order they are given, and there is no "Filteri" capsule and no "moja lokacija" among them', async () => {
  await render();
  expect(labels()).toEqual(['Danas', 'Ovaj vikend', 'Na daljinu', 'Sa iznosom']);
  // the filters have their own round button beside the pill; the capsule row never opens them
  expect(labels()).not.toContain('Filteri');
  expect(labels().filter(label => /^Filteri/.test(label))).toEqual([]);
  expect(labels()).not.toContain('Moja lokacija'); // it moves the camera and filters nothing: it stands above the list
  expect(labels()).not.toContain('U blizini');
  const rail = tree.root.findByProps({ accessibilityLabel: 'Brzi filteri' });
  expect(rail.props.testID).toBe('discovery-chips');
});

test('"Za mene" is built but not drawn: no capsule, and never a "Svi zadaci" beside it, until the switch says the server has it', async () => {
  await render();
  expect(labels()).not.toContain(FOR_ME); expect(labels()).not.toContain('Svi zadaci');
  await act(async () => tree.update(<DiscoveryChipRow forMeAvailable={false} chips={chips()} />));
  expect(labels()).not.toContain(FOR_ME);
});

test('with the switch on, "Za mene" is ONE capsule before the others: a tap turns it on, a tap on it turns it off, and "Svi zadaci" is nowhere', async () => {
  await render({ forMeAvailable: true, onScope: scope });
  expect(labels()).toEqual(['Za mene', 'Danas', 'Ovaj vikend', 'Na daljinu', 'Sa iznosom']);
  expect(labels()).not.toContain('Svi zadaci');
  expect(tree.root.findAllByProps({ accessibilityRole: 'tablist' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityRole: 'tab' })).toHaveLength(0);
  expect(button('Za mene').props).toMatchObject({ testID: 'chip-for-me', accessibilityRole: 'button', accessibilityState: { selected: false } });
  await act(async () => button('Za mene').props.onPress());
  expect(scope).toHaveBeenLastCalledWith('forMe');
  await act(async () => tree.update(<DiscoveryChipRow forMeAvailable scope="forMe" onScope={scope} chips={chips()} />));
  expect(button('Za mene').props.accessibilityState).toEqual({ selected: true });
  // on, it has a tick and a recessed well, like every capsule that is on
  expect(button('Za mene').findAll(node => String(node.type) === 'Check')).toHaveLength(1);
  expect(StyleSheet.flatten(button('Za mene').props.style).boxShadow ?? StyleSheet.flatten(button('Za mene').props.style).elevation).toBeDefined();
  scope.mockClear();
  await act(async () => button('Za mene').props.onPress());
  expect(scope).toHaveBeenLastCalledWith('all'); // the capsule that is on takes itself away
});

test('a quick capsule is a toggle: spoken as selected or not, with a tick on the chosen one, and its own callback', async () => {
  await render();
  expect(button('Danas').props.accessibilityState).toEqual({ selected: true });
  expect(button('Na daljinu').props.accessibilityState).toEqual({ selected: false });
  expect(button('Danas').findAll(node => String(node.type) === 'Check')).toHaveLength(1);
  expect(button('Na daljinu').findAll(node => String(node.type) === 'Check')).toHaveLength(0);
  await act(async () => button('Sa iznosom').props.onPress());
  expect(press).toHaveBeenCalledWith('amount');
  await act(async () => button('Na daljinu').props.onPress());
  expect(press).toHaveBeenLastCalledWith('remote');
  expect(StyleSheet.flatten(button('Danas').props.style).minHeight).toBeGreaterThanOrEqual(48);
});

test('a capsule that is on and has its own ✕ ("Nisu na mapi") shows the ✕ instead of a tick, and a tap takes it away', async () => {
  const off: QuickChip = { key: 'offMap', label: 'Nisu na mapi', selected: true, removable: true, hint: 'Isključuje ovaj izbor.', onPress: leave };
  await render({ forMeAvailable: true, chips: [off, ...chips()] });
  expect(labels()).toEqual(['Za mene', 'Nisu na mapi', 'Danas', 'Ovaj vikend', 'Na daljinu', 'Sa iznosom']);
  expect(button('Nisu na mapi').props).toMatchObject({ accessibilityState: { selected: true }, accessibilityHint: 'Isključuje ovaj izbor.' });
  expect(button('Nisu na mapi').findAll(node => String(node.type) === 'X')).toHaveLength(1);
  expect(button('Nisu na mapi').findAll(node => String(node.type) === 'Check')).toHaveLength(0);
  await act(async () => button('Nisu na mapi').props.onPress());
  expect(leave).toHaveBeenCalledTimes(1);
});

test('every capsule lifts off the map tiles (white, raised) and is at least 48 high, whether it is on or not', async () => {
  await render({ forMeAvailable: true, scope: 'forMe' });
  for (const label of ['Za mene', 'Danas', 'Ovaj vikend', 'Na daljinu', 'Sa iznosom']) {
    const style = StyleSheet.flatten(button(label).props.style);
    expect([label, style.minHeight]).toEqual([label, 48]);
    expect(style.borderRadius).toBe(sys.radius.pill);
  }
  const resting = StyleSheet.flatten(button('Sa iznosom').props.style);
  expect(resting).toMatchObject({ backgroundColor: sys.color.surface });
  expect(resting.boxShadow ?? resting.elevation).toEqual(materialControl.raised.boxShadow ?? materialControl.raised.elevation);
});

test('the row scrolls sideways and never takes a tap away from a capsule (a keyboard over it does not swallow it)', async () => {
  await render();
  const rail = tree.root.findByProps({ accessibilityLabel: 'Brzi filteri' });
  expect(rail.props).toMatchObject({ horizontal: true, showsHorizontalScrollIndicator: false, keyboardShouldPersistTaps: 'handled' });
  // it lines up with the edge of the map's tools (16), like the pill above it
  expect(StyleSheet.flatten(rail.props.contentContainerStyle).paddingHorizontal).toBe(sys.space.base);
});
