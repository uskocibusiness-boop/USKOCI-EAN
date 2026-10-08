import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView, type OwnedTaskCounts } from '../marketplaceView';
import { layout } from '../../ui/system/layout';
import { sys } from '../../ui/system/tokens';
import { OWN_TASK_TABS, ownTaskTabs } from '../../ui/v2/ownTaskTabs';
import type { MarketplacePaging } from '../../ui/v2/MarketplacePresentation';

/**
 * Moji zadaci, the one control row (UI/UX pass, plan item 8.1, 2026-10-02; composition spec 4.5, 2026-10-08). On the owner's phone (361 dp
 * wide, text scale 1.15) the first look of the wave-1 build spent 172 dp on a bar, a row of tabs and a toolbar before the first card, and
 * cut the third tab to "Istorij". What this file pins:
 *
 *  1. STRUCTURE: under the bar there is ONE control row, the three tabs on `Segmented`'s equal-width track (each a third of the width,
 *     48 dp high, a word that does not fit goes to a second line, nothing scrolls), and nothing else stands in it. The one control of the
 *     bar is "Filteri" (search is one of the filters and lives in its sheet), and how many tasks the set shows is the first line of the
 *     list, not a row of its own.
 *  2. THE COUNTS are the ones the screen already has (the server's counts of a paged build, otherwise the list it holds), never invented:
 *     nothing for zero, nothing while they are unknown. Only what waits for the person's choice is DRAWN (the orange number on "Aktivni");
 *     the counts of the other two sets are spoken, so a screen reader hears "2 nacrta" and the eye is not given a number it did not need.
 *
 * It is structure, not a render: only a phone shows a pixel.
 */
let mockWidth = 361.14, mockScale = 1.15;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  // The list stand-in draws its header, its rows (or the empty view) and its foot, and says whether it was given a header.
  const List = React.forwardRef(({ data, renderItem, ListEmptyComponent, ListHeaderComponent, ListFooterComponent, ...props }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ scrollToOffset: () => {} }), []);
    return React.createElement('List', { ...props, hasHeader: ListHeaderComponent != null }, ListHeaderComponent,
      data.length ? data.map((item: any) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))) : ListEmptyComponent, ListFooterComponent);
  });
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: mockWidth, height: 900, scale: 2, fontScale: mockScale });
    if (key === 'FlatList') return List;
    if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
    if (key === 'Keyboard') return { dismiss: jest.fn() };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { MarketplacePresentation } from '../../ui/v2/MarketplacePresentation';

const row = (id: string, patch = {}): MarketplaceItem => ({ id, revizija: 1, naslov: `Pomoć ${id}`, opis: '', stanje: 'OBJAVLJENA', podrucjeTekst: 'Novi Sad',
  vremeTekst: 'Po dogovoru', uslovi: ['Alat'], rezimCene: 'MY_PRICE', ponudjenaCena: { prikaz: '2.000 RSD' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, brojPrijava: 0, brojPrijavaZaIzbor: 0, priblizno: null, ...patch } as MarketplaceItem);
/** Two active tasks (one waits for my choice), two drafts, three closed: what the whole-list build counts for itself. */
const wholeList = () => [row('a1', { brojPrijavaZaIzbor: 2 }), row('a2'), row('d1', { stanje: 'NACRT' }), row('d2', { stanje: 'NACRT' }),
  row('h1', { stanje: 'ZATVORENA' }), row('h2', { stanje: 'ZATVORENA' }), row('h3', { stanje: 'ZATVORENA' })];
const SERVER: OwnedTaskCounts = { total: 40, active: 12, waiting: 4, drafts: 3, history: 25 };
let rows: MarketplaceItem[] = wholeList(), paging: MarketplacePaging | undefined, loading = false, error = false, snapshot: MarketplaceView;
const makePaging = (counts: OwnedTaskCounts | null): MarketplacePaging => ({ counts, hasMore: false, loadingMore: false, moreError: false, onLoadMore: jest.fn() });
function Screen({ initial = initialMarketplaceView() }: { initial?: MarketplaceView }) {
  const [view, setView] = useState(initial); snapshot = view;
  return <MarketplacePresentation items={rows} loading={loading} error={error} view={view} onView={setView} onOpen={jest.fn()} onRefresh={jest.fn()}
    onProfile={jest.fn()} paging={paging} />;
}
let tree: ReactTestRenderer;
const render = async (width = 361.14, scale = 1.15, initial?: MarketplaceView) => {
  mockWidth = width; mockScale = scale; await act(async () => { tree = create(<Screen initial={initial} />); });
};
const rerender = async (width: number, scale: number) => { mockWidth = width; mockScale = scale; await act(async () => tree.update(<Screen />)); };
const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const byId = (id: string) => tree.root.findByProps({ testID: id });
const PRESS = 'Press' as React.ElementType, T_ = 'T' as React.ElementType, VIEW = 'View' as React.ElementType;
const pressIn = (scope: ReactTestInstance, label: string) => scope.findAll(node => node.type === PRESS && node.props.accessibilityLabel === label);
const tabPresses = () => byId('own-tasks-tabs').findAll(node => node.type === PRESS && node.props.accessibilityRole === 'tab');
const tab = (label: string) => tabPresses().find(node => node.props.accessibilityLabel === label)!;
/** The number drawn in a tab: the badge text is a `T` of the `label` variant inside the pill. */
const badgeOf = (label: string) => tab(label).findAll(node => node.type === T_ && node.props.variant === 'label').map(node => node.props.children);
const textsIn = (scope: ReactTestInstance) => scope.findAll(node => node.type === T_).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ').replace(/\s+/g, ' ');
/** The size a drawn word has: its own style, else the variant's. */
const sizeOf = (node: ReactTestInstance) => (style(node).fontSize ?? (sys.type as Record<string, { fontSize?: number }>)[node.props.variant ?? 'body']?.fontSize) as number;
const ancestorsOf = (node: ReactTestInstance) => { const found: ReactTestInstance[] = []; for (let up = node.parent; up; up = up.parent) found.push(up); return found; };

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  rows = wholeList(); paging = undefined; loading = error = false; mockWidth = 361.14; mockScale = 1.15;
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

/** The window and the text size: what a phone is to this row. The owner's HONOR is 361.14 dp at 1.15. */
const GRID: readonly [width: number, scale: number][] = [320, 361.14, 411].flatMap(width => [1, 1.15, 1.3].map(scale => [width, scale] as [number, number]));

/* ---------------------------------------------------------------------------------------------------------- structure */

describe('one control row holds the three tabs and nothing else', () => {
  /** The defect itself, found without any test id: the first-look build had ONE row holding the tablist and both round buttons. */
  it('no row holds the tabs and the control together (at the owner\'s phone the third tab was cut to "Istorij" by the search button)', async () => {
    await render();
    const tablist = tree.root.findByProps({ accessibilityRole: 'tablist' });
    const sharedRows = ancestorsOf(tablist).filter(node => style(node).flexDirection === 'row' && pressIn(node, 'Filteri').length > 0);
    expect(sharedRows).toHaveLength(0);
  });

  it('draws Aktivni, Nacrti and Istorija as real tabs in a row of their own; the one control, Filteri, is in the bar and search is not a control of its own', async () => {
    await render();
    const tabs = byId('own-tasks-tabs');
    expect(tabPresses().map(node => node.props.accessibilityLabel)).toEqual(['Aktivni', 'Nacrti', 'Istorija']);
    expect(tabs.findAll(node => node.props.accessibilityRole === 'tablist')).toHaveLength(1);
    expect(pressIn(tabs, 'Filteri')).toHaveLength(0);
    expect(pressIn(tree.root, 'Filteri')).toHaveLength(1);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraga' })).toHaveLength(0);
    // The control row stands under the bar and over the list.
    const order = tree.root.findAll(node => node.props.testID === 'own-tasks-tabs' || node.type === ('List' as React.ElementType)).map(node => node.props.testID ?? 'list');
    expect(order).toEqual(['own-tasks-tabs', 'list']);
  });

  it('gives the tabs equal shares of the whole row and never a scroller: a word that does not fit goes to a second line, not off the edge', async () => {
    await render();
    const tabs = byId('own-tasks-tabs');
    // The row pads the screen's edge each side (20), like the list under it, and 8 under the bar.
    expect(style(tabs)).toMatchObject({ paddingHorizontal: layout.gutter, paddingTop: sys.space.sm }); expect(layout.gutter).toBe(20);
    expect(StyleSheet.flatten(tree.root.findByType('List' as React.ElementType).props.contentContainerStyle)).toMatchObject({ paddingHorizontal: layout.gutter });
    expect(tabs.findAllByType('ScrollView' as React.ElementType)).toHaveLength(0);
    const track = tabs.findByProps({ accessibilityRole: 'tablist' });
    expect(style(track)).toMatchObject({ flexDirection: 'row', backgroundColor: sys.color.control });
    for (const press of tabPresses()) {
      expect(style(press)).toMatchObject({ flexGrow: 1, flexBasis: 0, minHeight: 48, flexWrap: 'wrap' });
      for (const word of press.findAll(node => node.type === T_ && node.props.variant === 'meta')) expect(word.props.numberOfLines).toBeUndefined();
    }
  });

  it('how many tasks the set shows is the list\'s first line (its header), not a row of its own and not part of the control row', async () => {
    await render();
    const list = tree.root.findByType('List' as React.ElementType);
    expect(list.props.hasHeader).toBe(true);
    expect(textsIn(list)).toContain('2 zadatka');
    expect(textsIn(byId('own-tasks-tabs'))).not.toMatch(/\d+ zadat/);
    expect(textsIn(byId('own-tasks-count'))).toBe('2 zadatka');
  });

  it('keeps the commands: tapping a tab and the filters work, with the same spoken names', async () => {
    await render();
    await act(async () => tab('Nacrti').props.onPress()); expect(snapshot.section).toBe('drafts');
    await act(async () => tab('Aktivni').props.onPress()); expect(snapshot.section).toBe('active');
    await act(async () => pressIn(tree.root, 'Filteri')[0].props.onPress());
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Svi načini' }).length).toBeGreaterThan(0);
    // Search is the first thing in the sheet, with the rest of the filters.
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži zadatke' }).length).toBeGreaterThan(0);
  });
});

describe('the one control is touchable and says what it is', () => {
  it.each(GRID)('at %s dp and text scale %s the control keeps a 44 dp touch target, the tabs 44 dp, and no word on the row is under 12 px', async (width, scale) => {
    await render(width, scale);
    const control = pressIn(tree.root, 'Filteri')[0], box = style(control);
    expect([(box.height ?? box.minHeight) as number >= 44, (box.width ?? box.minWidth) as number >= 44]).toEqual([true, true]);
    for (const word of byId('own-tasks-tabs').findAll(node => node.type === T_)) expect([word.props.children, sizeOf(word) >= 12]).toEqual([word.props.children, true]);
    for (const press of tabPresses()) expect(style(press).minHeight as number).toBeGreaterThanOrEqual(44);
  });

  it('the filters carry the word beside the drawing (a bare sliders icon says nothing); the spoken name says when a filter is on, and the control is then "on"', async () => {
    await render();
    const control = pressIn(tree.root, 'Filteri')[0];
    expect(control.findAll(node => node.type === T_ && node.props.children === 'Filteri')).toHaveLength(1);
    expect(control.props.accessibilityState).toEqual({ selected: false });
    await act(async () => { tree.unmount(); });
    await render(361.14, 1.15, { ...initialMarketplaceView(), price: 'OFFERS' });
    expect(pressIn(tree.root, 'Filteri, aktivni')).toHaveLength(1);
    expect(pressIn(tree.root, 'Filteri, aktivni')[0].props.accessibilityState).toEqual({ selected: true });
    // A search that is on counts too: it is one of the filters now.
    await act(async () => { tree.unmount(); });
    await render(361.14, 1.15, { ...initialMarketplaceView(), query: 'police' });
    expect(pressIn(tree.root, 'Filteri, aktivni')).toHaveLength(1);
  });
});

/* ---------------------------------------------------------------------------------------------------------- the counts */

describe('the numbers on the tabs: only what waits for the person is drawn', () => {
  it('Aktivni carries the orange count of the tasks that wait for my choice, and nothing else is drawn; the other counts are spoken', () => {
    const tabs = ownTaskTabs(SERVER);
    expect(tabs.map(option => option.label)).toEqual(OWN_TASK_TABS.map(option => option.label));
    expect(tabs.map(option => option.badge)).toEqual([4, 3, 25]);
    expect(tabs.map(option => option.badgeTone)).toEqual(['attention', undefined, undefined]);
    expect(tabs.map(option => option.badgeLabel)).toEqual(['Za tvoj izbor: 4 zadatka', '3 nacrta', '25 zadataka']);
  });

  it('says nothing for a count that is zero or not known, and never draws a number over an unknown', () => {
    expect(ownTaskTabs(null).map(option => [option.badge, option.badgeTone, option.badgeLabel])).toEqual([[undefined, undefined, undefined], [undefined, undefined, undefined], [undefined, undefined, undefined]]);
    expect(ownTaskTabs({ total: 3, active: 3, waiting: 0, drafts: 0, history: 0 }).map(option => option.badge)).toEqual([undefined, undefined, undefined]);
    expect(ownTaskTabs({ total: 3, active: 2, waiting: 1, drafts: 0, history: 1 }).map(option => option.badge)).toEqual([1, undefined, 1]);
  });

  it('a whole-list build counts the list it holds: the orange number is what waits, the other tabs say how many they hold, aloud', async () => {
    await render();
    expect(badgeOf('Aktivni')).toEqual(['1']); expect(badgeOf('Nacrti')).toEqual([]); expect(badgeOf('Istorija')).toEqual([]);
    expect(tab('Aktivni').props.accessibilityValue).toEqual({ text: 'Za tvoj izbor: 1 zadatak' });
    expect(tab('Nacrti').props.accessibilityValue).toEqual({ text: '2 nacrta' });
    expect(tab('Istorija').props.accessibilityValue).toEqual({ text: '3 zadatka' });
  });

  it.each(GRID)('at %s dp and text scale %s the same numbers stand on the same tabs: the layout never takes a number away', async (width, scale) => {
    await render(width, scale);
    expect([badgeOf('Aktivni'), badgeOf('Nacrti'), badgeOf('Istorija')]).toEqual([['1'], [], []]);
    expect(tabPresses().map(node => node.props.accessibilityLabel)).toEqual(['Aktivni', 'Nacrti', 'Istorija']);
  });

  it('a paged build shows the server\'s counts, never the number that happens to be loaded, and nothing while they are unknown', async () => {
    paging = makePaging(SERVER); rows = [row('only')];
    await render();
    expect(badgeOf('Aktivni')).toEqual(['4']); expect(badgeOf('Nacrti')).toEqual([]); expect(badgeOf('Istorija')).toEqual([]);
    expect(tab('Nacrti').props.accessibilityValue).toEqual({ text: '3 nacrta' });
    expect(tab('Istorija').props.accessibilityValue).toEqual({ text: '25 zadataka' });
    paging = makePaging(null); await rerender(361.14, 1.15);
    for (const label of ['Aktivni', 'Nacrti', 'Istorija']) expect([label, badgeOf(label), tab(label).props.accessibilityValue]).toEqual([label, [], { text: '' }]);
  });

  it('shows no number for an empty set', async () => {
    rows = [row('a1'), row('h1', { stanje: 'ZATVORENA' })];
    await render();
    expect(badgeOf('Aktivni')).toEqual([]); expect(badgeOf('Nacrti')).toEqual([]); expect(badgeOf('Istorija')).toEqual([]);
    expect(tab('Aktivni').props.accessibilityValue).toEqual({ text: '' }); expect(tab('Istorija').props.accessibilityValue).toEqual({ text: '1 zadatak' });
  });

  it('says nothing while the list is being read or failed to read', async () => {
    loading = true; await render();
    for (const label of ['Aktivni', 'Nacrti', 'Istorija']) expect([label, badgeOf(label), tab(label).props.accessibilityValue]).toEqual([label, [], { text: '' }]);
    loading = false; error = true; await rerender(361.14, 1.15);
    for (const label of ['Aktivni', 'Nacrti', 'Istorija']) expect([label, badgeOf(label), tab(label).props.accessibilityValue]).toEqual([label, [], { text: '' }]);
  });

  it('the count line says how many the set shows and does not name a set the tab above already names; only the view without a tab does', async () => {
    await render();
    const line = () => textsIn(byId('own-tasks-count'));
    expect(line()).toBe('2 zadatka');
    await act(async () => tab('Nacrti').props.onPress());
    expect(line()).toBe('2 zadatka');
    await act(async () => tab('Istorija').props.onPress());
    expect(line()).toBe('3 zadatka');
    await act(async () => { tree.unmount(); });
    await render(361.14, 1.15, { ...initialMarketplaceView(), section: 'all' });
    expect(tabPresses().every(node => node.props.accessibilityState.selected === false)).toBe(true);
    expect(line()).toBe('7 zadataka · svi zadaci');
  });

  it('the pill of the orange count is the one place a tab draws a number, in the orange of what waits', async () => {
    await render();
    const pill = tab('Aktivni').findAll(node => node.type === VIEW && style(node).backgroundColor === sys.color.orange)[0];
    expect(pill).toBeDefined();
    expect(style(pill)).toMatchObject({ minWidth: 24, height: 24, borderRadius: sys.radius.badge });
  });
});
