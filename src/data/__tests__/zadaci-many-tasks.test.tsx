import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';
import { sys } from '../../ui/system/tokens';

/**
 * Zadaci with a thousand open tasks (UX plan 2.16 and section P, "mnogo zadataka"): the count says them with the thousands set apart, the
 * list says how it is ordered, a long list is read page by page and says so without moving its own end, and a parent that renders again
 * (a refresh, a fresh closure from the route) touches none of the rows. The map's own caps ("999+") are pinned with the markers.
 */
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  // One list component made once (a mock returned fresh from every read would remount the list on every render); it draws every row,
  // on purpose: it is the row's own props that must stay equal, not the list's rendering schedule.
  const List = ({ data, renderItem, keyExtractor, ListEmptyComponent, ListHeaderComponent, ...props }: any) =>
    React.createElement('List', { ...props, keyExtractor }, ListHeaderComponent, data.length
      ? data.map((item: any, index: number) => React.createElement(React.Fragment, { key: keyExtractor(item) }, renderItem({ item, index })))
      : ListEmptyComponent);
  const ModalMock = ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
  const KeyboardMock = { dismiss: jest.fn() };
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return List;
    if (key === 'Modal') return ModalMock;
    if (key === 'Keyboard') return KeyboardMock;
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('../../ui/Text', () => { const React = require('react'); return { T: jest.fn((props: any) => React.createElement('T', props)) }; });
jest.mock('../../ui/Press', () => { const React = require('react'); return { Press: jest.fn((props: any) => React.createElement('Press', props)) }; });
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/v2/DiscoveryMap', () => ({ DiscoveryMap: 'DiscoveryMap' }));
// The card itself is not what is checked here (its face is the card's own suites): a light card with the row's press surface and the one thing the
// list offers it, its age, so a thousand-task list can be drawn many times over and the cards can be seen asking.
jest.mock('../../ui/v2/TaskCard', () => {
  const React = require('react'), { Press } = require('../../ui/Press'), { T } = require('../../ui/Text'), { useTaskAge } = require('../../ui/v2/discovery/taskAge');
  return { TaskCard: React.memo(function MockCard({ item, onOpen }: any) {
    const age = useTaskAge(item.id);
    return React.createElement(Press, { accessibilityLabel: `Otvori priliku ${item.naslov}`, accessibilityRole: 'button', onPress: onOpen },
      React.createElement(T, null, item.naslov), age ? React.createElement(T, { testID: 'age' }, age) : null);
  }) };
});
import { Press } from '../../ui/Press';
import { PAGING_WORDS, DiscoveryPresentation, type DiscoveryV1PresentationSeam } from '../../ui/v2/DiscoveryPresentation';
import { NO_AGE } from '../../ui/v2/discovery/taskAge';

/** The rows the client holds: the P6 reader reads a long list page by page, so what is loaded is a few pages; the server's exact count is the thousand. */
const MANY = 120;
const task = (index: number): MarketplaceItem => ({ id: `task-${index}`, naslov: `Pomoć ${index}`, podrucjeTekst: 'Novi Sad', vremeTekst: 'Po dogovoru', uslovi: [],
  statusTekst: 'Otvoren', rezimCene: 'MY_PRICE', ponudjenaCena: { prikaz: '2.000 RSD' }, pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 },
  priblizno: { lat: 44.7 + (index % 50) / 100, lng: 19.7 + Math.floor(index / 50) / 100 } } as unknown as MarketplaceItem);
const seam = (patch: Partial<DiscoveryV1PresentationSeam> = {}): DiscoveryV1PresentationSeam => ({
  map: { markers: [], selectedKey: null, wholeBounds: [19, 44, 21, 46], onSelect: jest.fn() },
  peek: null, counts: { kind: 'exact_live', observedAt: '2026-10-07T10:00:00Z', mapped: MANY, listed: 1248, inArea: 1248, withoutPoint: 48, undated: 0 },
  pageHasMore: true, onArea: jest.fn(), onClearPeek: jest.fn(), onShowPlace: jest.fn(), onShowAll: jest.fn(), onNextPage: jest.fn(), ...patch,
});

let tree: ReactTestRenderer;
let rows: MarketplaceItem[] = [], p6: DiscoveryV1PresentationSeam | undefined, initial: MarketplaceView, snapshot: MarketplaceView;
const open = jest.fn();
function Screen({ pass }: { pass: number }) {
  const [view, setView] = useState(initial); snapshot = view;
  // A fresh closure every render, exactly as the route hands them down.
  return <DiscoveryPresentation items={rows} loading={false} error={false} scopeKey="a:1" view={view} onView={setView} refreshing={pass > 1} p6Seam={p6}
    onOpen={item => open(item)} onRefresh={() => {}} onProfile={() => {}} onNew={() => {}} />;
}
const render = async (pass = 0) => act(async () => { tree = create(<Screen pass={pass} />); });
const list = () => tree.root.findByType('List' as React.ElementType);
const drawn = () => (Press as jest.Mock).mock.calls.filter(([props]) => /^Otvori priliku /.test(String(props.accessibilityLabel))).length;
const countLine = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.testID === 'list-count')[0];
const words = (node: { findAllByType: (type: React.ElementType) => { children: unknown[] }[] }) =>
  node.findAllByType('T' as React.ElementType).flatMap(text => text.children.filter(child => typeof child === 'string')) as string[];
const body = async (height = 800) => act(async () => tree.root.findByProps({ testID: 'discovery-body' }).props.onLayout({ nativeEvent: { layout: { height } } }));
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {}); (Press as jest.Mock).mockClear(); open.mockClear();
  initial = { ...initialMarketplaceView(), mode: 'map', sheet: 'half' }; p6 = seam(); rows = Array.from({ length: MANY }, (_, index) => task(index));
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });

test('a thousand tasks: the count is the server\'s exact one with the thousands set apart, and the list says it is read newest first', async () => {
  await render(); await body();
  expect(words(countLine())).toEqual(['1.248 zadataka', 'Najnovije prvo']);
  // Spoken with its context, and the order as its value.
  expect(countLine().props.accessibilityLabel).toBe('1.248 zadataka · 48 zadataka bez tačke na mapi');
  expect(countLine().props.accessibilityValue).toEqual({ text: 'Najnovije prvo' });
});

test('the order is said only when it is true and means something: the P6 page with more than one task', async () => {
  p6 = seam({ counts: { kind: 'exact_live', observedAt: '2026-10-07T10:00:00Z', mapped: 1, listed: 1, inArea: 1, withoutPoint: 0, undated: 0 } });
  rows = rows.slice(0, 1);
  await render(); await body();
  expect(words(countLine())).toEqual(['1 zadatak']); expect(countLine().props.accessibilityValue).toBeUndefined();
  await act(async () => tree.unmount());
  p6 = undefined; rows = Array.from({ length: 5 }, (_, index) => task(index)); await render(); await body();
  expect(words(countLine())).toEqual(['5 zadataka']); expect(countLine().props.accessibilityValue).toBeUndefined();
});

test('every row has a stable key of its own and the list is virtualised for a phone', async () => {
  await render(); await body();
  const keys = rows.map(item => list().props.keyExtractor(item));
  expect(new Set(keys).size).toBe(MANY);
  expect(keys[0]).toBe('task-0'); expect(keys[MANY - 1]).toBe(`task-${MANY - 1}`);
  expect(list().props).toMatchObject({ initialNumToRender: 6, maxToRenderPerBatch: 6, windowSize: 7 });
});

test('a parent that renders again, a refresh and a fresh closure touch none of the rows', async () => {
  await render(); await body();
  expect(drawn()).toBe(MANY);
  (Press as jest.Mock).mockClear();
  await act(async () => tree.update(<Screen pass={1} />));
  await act(async () => tree.update(<Screen pass={2} />)); // refreshing
  await act(async () => tree.update(<Screen pass={3} />));
  expect(drawn()).toBe(0);
  // The next page arrives at the end of the list: its rows are the only ones drawn.
  rows = [...rows, task(MANY), task(MANY + 1)];
  await act(async () => tree.update(<Screen pass={4} />));
  expect(drawn()).toBe(2);
  await act(async () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Otvori priliku Pomoć 0')[0].props.onPress());
  expect(open).toHaveBeenCalledWith(rows[0]);
});

test('the next page is asked for once at the end of the list, never while one is being read', async () => {
  await render(); await body();
  expect(typeof list().props.onEndReached).toBe('function');
  await act(async () => list().props.onEndReached());
  expect(p6!.onNextPage).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  p6 = seam({ loadingMore: true }); await render(); await body();
  expect(list().props.onEndReached).toBeUndefined();
  await act(async () => tree.unmount());
  p6 = seam({ pageHasMore: false }); await render(); await body();
  expect(list().props.onEndReached).toBeUndefined();
});

test('reading the next page is said over the list\'s end, in words, and it never becomes part of the list', async () => {
  p6 = seam({ loadingMore: true });
  await render(); await body();
  const note = () => tree.root.findAll(node => String(node.type) === 'View' && node.props.accessibilityLabel === PAGING_WORDS);
  expect(PAGING_WORDS).toBe('Učitavamo još zadataka…');
  expect(note()).toHaveLength(1);
  expect(note()[0].props).toMatchObject({ accessibilityLiveRegion: 'polite', pointerEvents: 'none' });
  // It stands outside the list, so the end the list measures (and the place a return restores to) does not move because of it.
  expect(list().findAllByProps({ accessibilityLabel: PAGING_WORDS })).toHaveLength(0);
  expect(list().props.ListFooterComponent).toBeNull();
  // It rides above the "Mapa" pill when the whole list is up, and is not shown while the sheet is lowered to its top line over the map.
  await act(async () => countLine().props.onPress()); // half -> full
  expect(note()).toHaveLength(1);
  expect(StyleSheet.flatten(note()[0].props.style).bottom).toBe(sys.space.base + 48 + sys.space.sm);
  await act(async () => countLine().props.onPress()); // full -> lowered
  expect(note()).toHaveLength(0);
  await act(async () => tree.update(<Screen pass={1} />));
  p6 = seam({ loadingMore: false }); await act(async () => tree.update(<Screen pass={2} />));
  expect(note()).toHaveLength(0);
});

test('the list offers the age of every task of its page to the cards, and none for a task it has no time for or when it does not read the time', async () => {
  // "pre 3 sata" is an answer for the same calendar day in Serbian time: on the real clock between 00:00 and 03:00 the same 180 minutes
  // read "juče" (the CI run of 2026-10-08 00:22 failed on it). Only the date is frozen, at noon; every timer stays real.
  jest.useFakeTimers({ now: new Date('2026-10-07T10:00:00Z'), doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame',
    'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  const minutes = (count: number) => new Date(Date.now() - count * 60_000).toISOString();
  p6 = seam({ published: new Map([['task-0', minutes(25)], ['task-1', minutes(180)]]) });
  await render(); await body();
  // The cards ask, the list answers: the first two say how old they are, the third has no time and says nothing.
  const ageOn = (title: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === `Otvori priliku ${title}`)[0]
    .findAll(node => String(node.type) === 'T' && node.props.testID === 'age').flatMap(node => node.children);
  expect(ageOn('Pomoć 0')).toEqual(['pre 25 min']); expect(ageOn('Pomoć 1')).toEqual(['pre 3 sata']); expect(ageOn('Pomoć 2')).toEqual([]);
  // The same map gives the same reader: a parent that merely renders does not ask a card to draw again.
  (Press as jest.Mock).mockClear();
  await act(async () => tree.update(<Screen pass={1} />));
  expect(drawn()).toBe(0);
  // The legacy reader does not read the time, and no age is invented for it.
  await act(async () => tree.unmount());
  p6 = undefined; await render(); await body();
  expect(ageOn('Pomoć 0')).toEqual([]); expect(ageOn('Pomoć 1')).toEqual([]);
  expect(NO_AGE('task-0')).toBeNull();
});
