import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView, type OwnedTaskCounts } from '../marketplaceView';
let mockReduced = false;
jest.mock('react-native', () => {
 const native = jest.requireActual('react-native'), React = require('react');
 // The list stand-in draws its header, its rows (or the empty view) and its FOOT, and keeps every other prop for the test to read.
 const List = React.forwardRef(({ data, renderItem, ListEmptyComponent, ListHeaderComponent, ListFooterComponent, ...props }: any, ref: any) => {
  React.useImperativeHandle(ref, () => ({ scrollToOffset: () => {} }), []);
  return React.createElement('List', props, ListHeaderComponent, data.length ? data.map((item: any) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))) : ListEmptyComponent, ListFooterComponent);
 });
 return new Proxy(native, { get(target, key) {
  if (key === 'FlatList') return List;
  if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
  if (key === 'Keyboard') return { dismiss: jest.fn() };
  return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
 } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { MarketplacePresentation, type MarketplacePaging } from '../../ui/v2/MarketplacePresentation';

/**
 * EX-04 S1 (A09): what "Moji zadaci" says when it is read a page at a time. The tasks on screen are the ones loaded so far; every number the person
 * is given is the server's, never the number that happens to be loaded, and the foot offers the next page (or says it failed and offers the retry).
 */
const row = (id: string, patch = {}): MarketplaceItem => ({ id, revizija: 1, naslov: `Pomoć ${id}`, opis: '', stanje: 'OBJAVLJENA', podrucjeTekst: 'Novi Sad',
  vremeTekst: 'Po dogovoru', uslovi: ['Alat'], rezimCene: 'MY_PRICE', ponudjenaCena: { prikaz: '2.000 RSD' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, brojPrijava: 0, brojPrijavaZaIzbor: 0, priblizno: null, ...patch } as MarketplaceItem);
const COUNTS: OwnedTaskCounts = { total: 40, active: 12, waiting: 4, drafts: 3, history: 25 };
let rows: MarketplaceItem[], paging: MarketplacePaging | undefined, snapshot: MarketplaceView, initial: MarketplaceView, loading = false, error = false;
const loadMore = jest.fn();
const makePaging = (patch: Partial<MarketplacePaging> = {}): MarketplacePaging => ({ counts: COUNTS, hasMore: true, loadingMore: false, moreError: false, onLoadMore: loadMore, ...patch });
function Screen() { const [view, setView] = useState(initial); snapshot = view; return <MarketplacePresentation items={rows} loading={loading} error={error} view={view} onView={setView}
  onOpen={jest.fn()} onRefresh={jest.fn()} onProfile={jest.fn()} paging={paging} />; }
let tree: ReactTestRenderer;
const press = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const actions = () => tree.root.findAllByType('Action' as React.ElementType).map(node => node.props.label as string);
const action = (label: string) => tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === label)!;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const list = () => tree.root.findByType('List' as React.ElementType);
const render = async () => act(async () => { tree = create(<Screen />); });
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); initial = initialMarketplaceView(); rows = [row('one'), row('two')]; paging = makePaging(); loading = error = mockReduced = false; loadMore.mockClear(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('the badge on Aktivni is the server\'s count of tasks that wait for my choice, not what is loaded; unknown counts say nothing', async () => {
  rows = [row('waiting', { brojPrijavaZaIzbor: 3 }), row('plain')];
  await render(); expect(press('Aktivni').props.accessibilityValue).toEqual({ text: 'Za tvoj izbor: 4 zadatka' });
  paging = makePaging({ counts: null }); await act(async () => tree.update(<Screen />)); expect(press('Aktivni').props.accessibilityValue).toEqual({ text: '' });
  paging = makePaging({ counts: { ...COUNTS, waiting: 0 } }); await act(async () => tree.update(<Screen />)); expect(press('Aktivni').props.accessibilityValue).toEqual({ text: '' });
});

test('the line above the cards is the server\'s count of the set shown, whichever tab it is', async () => {
  await render(); expect(texts()).toContain('12 zadataka');
  await act(async () => press('Nacrti').props.onPress());
  expect(snapshot.section).toBe('drafts'); expect(texts()).toContain('3 zadatka');
  await act(async () => press('Istorija').props.onPress()); expect(texts()).toContain('25 zadataka');
});

test('a refined set has no number while the rest of it is still being read, and the exact one when it has been read to its end', async () => {
  initial.query = 'Pomoć one'; await render();
  expect(texts()).not.toMatch(/\d+ zadat/);
  paging = makePaging({ hasMore: false, counts: COUNTS }); await act(async () => tree.update(<Screen />));
  expect(texts()).toContain('1 zadatak');
  paging = makePaging({ hasMore: true, loadingMore: true }); await act(async () => tree.update(<Screen />)); expect(texts()).not.toMatch(/\d+ zadat/);
});

test('without counts the number is shown only once nothing more is to be read', async () => {
  paging = makePaging({ counts: null }); await render(); expect(texts()).not.toMatch(/\d+ zadat/);
  paging = makePaging({ counts: null, hasMore: false }); await act(async () => tree.update(<Screen />)); expect(texts()).toContain('2 zadatka');
});

test('the foot offers the next page, says it is reading, or says it failed and offers the same retry', async () => {
  await render(); expect(actions()).toContain('Prikaži još'); action('Prikaži još').props.onPress(); expect(loadMore).toHaveBeenCalledTimes(1);
  paging = makePaging({ loadingMore: true }); await act(async () => tree.update(<Screen />));
  expect(actions()).not.toContain('Prikaži još'); expect(texts()).toContain('Učitavamo još zadataka…');
  paging = makePaging({ moreError: true }); await act(async () => tree.update(<Screen />));
  expect(texts()).toContain('Ne možemo da učitamo ostale zadatke.'); expect(actions()).toContain('Pokušaj ponovo'); expect(actions()).not.toContain('Prikaži još');
  action('Pokušaj ponovo').props.onPress(); expect(loadMore).toHaveBeenCalledTimes(2);
  paging = makePaging({ hasMore: false }); await act(async () => tree.update(<Screen />));
  expect(actions()).not.toContain('Prikaži još'); expect(actions()).not.toContain('Pokušaj ponovo');
});

test('the end of the list asks for the next page only when there is one, nothing is being read and the last read did not fail', async () => {
  await render(); expect(list().props.onEndReached).toBe(loadMore);
  for (const patch of [{ hasMore: false }, { loadingMore: true }, { moreError: true }]) {
    paging = makePaging(patch); await act(async () => tree.update(<Screen />)); expect(list().props.onEndReached).toBeUndefined();
  }
});

test('nothing shown yet while more is being read says it is reading, never that there is nothing; a failed read says what the view says', async () => {
  initial.query = 'ne postoji'; await render(); expect(texts()).toContain('Učitavamo zadatke…'); expect(texts()).not.toContain('Nema zadataka u ovom prikazu');
  paging = makePaging({ hasMore: true, loadingMore: true }); await act(async () => tree.update(<Screen />)); expect(texts()).toContain('Učitavamo zadatke…');
  paging = makePaging({ hasMore: true, moreError: true }); await act(async () => tree.update(<Screen />)); expect(texts()).toContain('Nema zadataka u ovom prikazu');
  paging = makePaging({ hasMore: false }); await act(async () => tree.update(<Screen />)); expect(texts()).toContain('Nema zadataka u ovom prikazu');
});

test('the filter sheet promises no number while the set is incomplete, and the exact one when it is whole', async () => {
  await render(); await act(async () => press('Filteri').props.onPress());
  expect(actions()).toContain('Prikaži zadatke'); expect(actions().some(label => /^Prikaži \d+ zadat/.test(label))).toBe(false);
  paging = makePaging({ hasMore: false }); await act(async () => tree.update(<Screen />));
  expect(actions()).toContain('Prikaži 2 zadatka');
});

test('without the paging prop the list is the whole list: it counts itself and has no foot', async () => {
  paging = undefined; rows = [row('waiting', { brojPrijavaZaIzbor: 3 }), row('plain')];
  await render(); expect(press('Aktivni').props.accessibilityValue).toEqual({ text: 'Za tvoj izbor: 1 zadatak' });
  expect(texts()).toContain('2 zadatka'); expect(actions()).not.toContain('Prikaži još'); expect(list().props.onEndReached).toBeUndefined();
});
