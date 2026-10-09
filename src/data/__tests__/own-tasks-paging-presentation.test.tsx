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
 * is given is the server's, never the number that happens to be loaded (a group's number only once the set was read to its end), and the foot offers
 * the next page (or says it failed and offers the retry), right after the last task and before the two rows of the other sets.
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

test('the two rows say how many drafts and finished tasks there are by the count of the server, not by what is loaded; unknown counts draw no row', async () => {
  await render(); expect(press('Nacrti, 3 nacrta').props.accessibilityHint).toBe('Otvara nacrte.'); expect(press('Istorija, 25 zadataka')).toBeTruthy();
  expect(texts()).toContain('3 nacrta'); expect(texts()).toContain('25 zadataka');
  paging = makePaging({ counts: null }); await act(async () => tree.update(<Screen />));
  expect(tree.root.findAllByProps({ accessibilityHint: 'Otvara nacrte.' })).toHaveLength(0); expect(texts()).not.toContain('Istorija');
  paging = makePaging({ counts: { ...COUNTS, drafts: 0 } }); await act(async () => tree.update(<Screen />));
  expect(tree.root.findAllByProps({ accessibilityHint: 'Otvara nacrte.' })).toHaveLength(0); expect(press('Istorija, 25 zadataka')).toBeTruthy();
});

test('a row of the other sets opens that set, whichever page is loaded: the section is the one the row names', async () => {
  await render();
  await act(async () => press('Nacrti, 3 nacrta').props.onPress()); expect(snapshot.section).toBe('drafts');
  await act(async () => press('Nazad').props.onPress()); expect(snapshot.section).toBe('active');
  await act(async () => press('Istorija, 25 zadataka').props.onPress()); expect(snapshot.section).toBe('history');
});

test('a group has no number in its name while the rest of the set is still being read, and the exact one when it has been read to its end', async () => {
  await render(); expect(texts()).toContain('Objavljeno'); expect(texts()).not.toMatch(/Objavljeno · \d/);
  paging = makePaging({ hasMore: false }); await act(async () => tree.update(<Screen />));
  expect(texts()).toContain('Objavljeno · 2');
  paging = makePaging({ hasMore: true, loadingMore: true }); await act(async () => tree.update(<Screen />)); expect(texts()).not.toMatch(/ · \d/);
});

test('a refined set has no number while the rest of it is still being read, and the exact one when it has been read to its end', async () => {
  initial.query = 'Pomoć one'; await render();
  expect(texts()).not.toMatch(/ · \d/);
  paging = makePaging({ hasMore: false, counts: COUNTS }); await act(async () => tree.update(<Screen />));
  expect(texts()).toContain('Objavljeno · 1');
});

test('without counts the number of a group is shown only once nothing more is to be read, and no row of the other sets is drawn', async () => {
  paging = makePaging({ counts: null }); await render(); expect(texts()).not.toMatch(/ · \d/); expect(texts()).not.toContain('Nacrti');
  paging = makePaging({ counts: null, hasMore: false }); await act(async () => tree.update(<Screen />)); expect(texts()).toContain('Objavljeno · 2');
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

test('a failed page cannot claim filtered results are empty; retry keeps the filters until a complete read confirms no match', async () => {
  initial.query = 'ne postoji'; await render(); expect(texts()).toContain('Učitavamo zadatke…'); expect(texts()).not.toContain('Nema zadataka u ovom prikazu');
  paging = makePaging({ hasMore: true, loadingMore: true }); await act(async () => tree.update(<Screen />)); expect(texts()).toContain('Učitavamo zadatke…');
  paging = makePaging({ hasMore: true, moreError: true }); await act(async () => tree.update(<Screen />));
  expect(texts()).toContain('Nismo učitali sve rezultate'); expect(texts()).not.toContain('Nema zadataka u ovom prikazu');
  expect(actions()).not.toContain('Poništi filtere');
  await act(async () => action('Pokušaj ponovo').props.onPress()); expect(loadMore).toHaveBeenCalledTimes(1);
  expect(snapshot.query).toBe('ne postoji');
  paging = makePaging({ hasMore: true, loadingMore: true }); await act(async () => tree.update(<Screen />));
  expect(texts()).toContain('Učitavamo zadatke…'); expect(actions()).not.toContain('Pokušaj ponovo');
  paging = makePaging({ hasMore: false }); await act(async () => tree.update(<Screen />)); expect(texts()).toContain('Nema zadataka u ovom prikazu');
});

test('retrying an empty filtered page can reveal a matching task without clearing the search', async () => {
  initial.query = 'selidba'; paging = makePaging({ moreError: true }); await render();
  expect(texts()).toContain('Nismo učitali sve rezultate');
  await act(async () => action('Pokušaj ponovo').props.onPress()); expect(loadMore).toHaveBeenCalledTimes(1);
  paging = makePaging({ loadingMore: true }); await act(async () => tree.update(<Screen />));
  rows = [...rows, row('match', { naslov: 'Selidba u subotu' })]; paging = makePaging({ hasMore: false });
  await act(async () => tree.update(<Screen />));
  expect(snapshot.query).toBe('selidba'); expect(texts()).toContain('Selidba u subotu');
  expect(texts()).not.toContain('Nismo učitali sve rezultate'); expect(texts()).not.toContain('Nema zadataka u ovom prikazu');
});

test.each(['active', 'drafts', 'history'] as const)('an unfiltered %s set with a failed page is unknown, including when other sets have counts', async section => {
  initial.section = section; rows = []; paging = makePaging({ moreError: true }); await render();
  expect(texts()).toContain('Nismo učitali sve rezultate');
  expect(texts()).not.toMatch(/Nema aktivnih zadataka|Nemaš nacrt|Istorija je prazna|Još nemaš zadatak/);
  await act(async () => action('Pokušaj ponovo').props.onPress()); expect(loadMore).toHaveBeenCalledTimes(1);
  expect(snapshot.section).toBe(section);
});

test('the filter sheet promises no number while the set is incomplete, and the exact one when it is whole', async () => {
  await render(); await act(async () => press('Filteri').props.onPress());
  expect(actions()).toContain('Prikaži zadatke'); expect(actions().some(label => /^Prikaži \d+ zadat/.test(label))).toBe(false);
  paging = makePaging({ hasMore: false }); await act(async () => tree.update(<Screen />));
  expect(actions()).toContain('Prikaži 2 zadatka');
});

test('without the paging prop the list is the whole list: it counts itself, has no foot and draws the rows of the other sets only when it holds some', async () => {
  paging = undefined; rows = [row('waiting', { brojPrijavaZaIzbor: 3 }), row('plain')];
  await render(); expect(texts()).toContain('Čeka tvoj izbor · 1'); expect(texts()).toContain('Objavljeno · 1');
  expect(actions()).not.toContain('Prikaži još'); expect(list().props.onEndReached).toBeUndefined();
  expect(tree.root.findAllByProps({ accessibilityHint: 'Otvara nacrte.' })).toHaveLength(0);
  rows = [...rows, row('draft', { stanje: 'NACRT' }), row('done', { stanje: 'ZATVORENA', kraj: 'COMPLETED' }), row('gone', { stanje: 'ZATVORENA', kraj: 'CANCELLED' })];
  await act(async () => tree.update(<Screen />));
  expect(texts()).toContain('1 nacrt'); expect(texts()).toContain('2 zadatka');
});
