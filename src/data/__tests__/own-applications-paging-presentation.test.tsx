import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { MojaPrijavaProjekcija } from '../../contracts/projections';
import type { ApplicationCounts } from '../myApplicationsView';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  // The list stand-in draws its header, its rows (or the empty view) and its FOOT, and keeps every other prop for the test to read.
  const List = React.forwardRef(({ data, renderItem, keyExtractor, ListEmptyComponent, ListHeaderComponent, ListFooterComponent, ...props }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ scrollToOffset: () => {} }), []);
    return React.createElement('List', props, ListHeaderComponent, data.length ? data.map((item: any, index: number) => React.createElement(React.Fragment, { key: keyExtractor(item) },
      renderItem({ item, index }))) : ListEmptyComponent, ListFooterComponent);
  });
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'FlatList') return List;
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }), useLocalSearchParams: () => ({}), useFocusEffect: () => undefined }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => ({}), useUloga: () => 'uskocer', ulogaSada: () => 'uskocer' }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: 'a' }, accountRevision: 1 }), sesijaSada: () => ({ user: { id: 'a' }, accountRevision: 1 }) }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'Bell' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
import { MyApplicationsPresentation, type ApplicationsPaging, type ApplicationsTab } from '../../ui/v2/MyApplicationsPresentation';

/**
 * EX-04 S2 (B10): what "Moje prijave" says when it is read a page at a time. The applications on screen are the ones loaded so far of the tab's own set; every number the
 * person is given is the server's, never the number that happens to be loaded; a tab whose set is empty is not "no applications at all"; and the foot offers the next page (or
 * says it failed and offers the retry).
 */
const row = (id: string, patch: Partial<MojaPrijavaProjekcija> = {}): MojaPrijavaProjekcija => ({ prijavaId: id, potrebaId: `need-${id}`, potrebaRevizija: 2, prijavaRevizija: 2,
  prijavaVerzija: 1, stanje: 'SUBMITTED', naslov: `Unos ${id}`, opis: '', cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' }, pokrivaMesta: 2, napomena: '',
  podrucjeTekst: 'Liman, Novi Sad', vremeTekst: '20. sep · 10:00', dogovorId: null, promenjenaPotreba: false, mozePovuci: true, traziPaznju: false, ...patch });
const COUNTS: ApplicationCounts = { total: 40, attention: 4, active: 12, finished: 24 };
let rows: MojaPrijavaProjekcija[], paging: ApplicationsPaging | undefined, tab: ApplicationsTab, loading = false, unavailable = false;
const loadMore = jest.fn(), onTab = jest.fn(), onExplore = jest.fn();
const makePaging = (patch: Partial<ApplicationsPaging> = {}): ApplicationsPaging => ({ counts: COUNTS, hasMore: true, loadingMore: false, moreError: false, onLoadMore: loadMore, ...patch });
const props = () => ({ rows, loading, unavailable, message: null, notice: null, tab, onTab, expanded: null, draft: null, busy: false, editingLoading: false, pending: false,
  canRetry: false, canReset: false, onRefresh: jest.fn(), onExplore, onProfile: jest.fn(), onBack: jest.fn(), onReview: jest.fn(), onClose: jest.fn(), onEdit: jest.fn(),
  onChange: jest.fn(), onCancelEdit: jest.fn(), onKeep: jest.fn(), onUpdate: jest.fn(), onWithdraw: jest.fn(), onAgreement: jest.fn(), onRetry: jest.fn(), onReset: jest.fn(),
  onTask: jest.fn(), paging });
let tree: ReactTestRenderer;
const render = async () => act(async () => { tree = create(<MyApplicationsPresentation {...props()} />); });
const rerender = async () => act(async () => tree.update(<MyApplicationsPresentation {...props()} />));
const press = (label: string) => tree.root.findAllByProps({ accessibilityLabel: label })[0];
const tabs = () => tree.root.findAllByProps({ accessibilityRole: 'tab' }).map(node => node.props.accessibilityLabel as string);
const actions = () => tree.root.findAllByType('Action' as React.ElementType).map(node => node.props.label as string);
const action = (label: string) => tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === label)!;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const heads = () => tree.root.findAllByType('T' as React.ElementType).filter(node => node.props.accessibilityRole === 'header' && / · \d+$/.test(String(node.props.children)))
  .map(node => node.props.children as string);
const list = () => tree.root.findByType('List' as React.ElementType);
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); rows = [row('one'), row('two')]; paging = makePaging(); tab = 'all'; loading = unavailable = false;
  loadMore.mockClear(); onTab.mockClear(); onExplore.mockClear(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('the count beside each tab is the server\'s, never the number loaded; unknown counts say nothing', async () => {
  await render();
  expect(tabs()).toEqual(['Sve', 'Čeka te', 'Aktivne', 'Završene']);
  expect(press('Sve').props.accessibilityValue).toEqual({ text: '40 prijava' }); expect(press('Čeka te').props.accessibilityValue).toEqual({ text: '4 prijave' });
  expect(press('Aktivne').props.accessibilityValue).toEqual({ text: '12 prijava' }); expect(press('Završene').props.accessibilityValue).toEqual({ text: '24 prijave' });
  paging = makePaging({ counts: null }); await rerender();
  for (const label of ['Sve', 'Čeka te', 'Aktivne', 'Završene']) expect(press(label).props.accessibilityValue).toEqual({ text: '' });
  paging = makePaging({ counts: { total: 3, attention: 0, active: 3, finished: 0 } }); await rerender();
  expect(press('Čeka te').props.accessibilityValue).toEqual({ text: '' }); expect(press('Aktivne').props.accessibilityValue).toEqual({ text: '3 prijave' });
});

test('a tab whose set is empty is not "no applications at all": the tabs stay and the empty set says what it is', async () => {
  rows = []; tab = 'attention'; await render();
  expect(tabs()).toEqual(['Sve', 'Čeka te', 'Aktivne', 'Završene']);
  expect(texts()).toContain('Ništa te ne čeka'); expect(texts()).not.toContain('Još nemaš prijavu');
  action('Prikaži sve prijave').props.onPress(); expect(onTab).toHaveBeenCalledWith('all');
  tab = 'finished'; await rerender(); expect(texts()).toContain('Nema završenih prijava');
});

test('with no application at all there are no tabs, only the first-run state; a complete set is parted into groups, not tabs', async () => {
  rows = []; paging = makePaging({ counts: { total: 0, attention: 0, active: 0, finished: 0 }, hasMore: false }); await render();
  expect(tabs()).toEqual([]); expect(texts()).toContain('Još nemaš prijavu'); action('Pronađi zadatak').props.onPress(); expect(onExplore).toHaveBeenCalledTimes(1);
  rows = [row('one')]; paging = makePaging({ counts: null, hasMore: false }); await rerender(); expect(tabs()).toHaveLength(0); expect(heads()).toEqual(['Čeka odgovor · 1']);
});

// The approved draft U8: groups need EVERY application of the set. A page still to come is parted by the server's own sets (the chips), never by what happens to be loaded;
// a complete set is parted into the three groups; and a set other than "Sve" keeps the chips, so the way back to "Sve" is there.
test('groups are drawn only for a complete set: a page still to come keeps the server\'s chips, a shown set other than Sve keeps its way back', async () => {
  await render();
  expect(heads()).toEqual([]); expect(tabs()).toEqual(['Sve', 'Čeka te', 'Aktivne', 'Završene']); expect(texts()).toContain('40 prijava');
  paging = makePaging({ hasMore: false }); await rerender();
  expect(tabs()).toEqual([]); expect(heads()).toEqual(['Čeka odgovor · 2']); expect(texts()).not.toContain('40 prijava');
  tab = 'finished'; await rerender();
  expect(tabs()).toEqual(['Sve', 'Čeka te', 'Aktivne', 'Završene']);
});

test('the tab rail stays mounted through a page read, preserving its native scroll position; a failed read offers retry', async () => {
  await render();
  const rail = tree.root.findByProps({ accessibilityRole: 'tablist' });
  tab = 'finished'; loading = true; rows = []; await rerender();
  expect(tree.root.findByProps({ accessibilityRole: 'tablist' })).toBe(rail);
  expect(press('Završene').props.accessibilityState).toEqual({ selected: true });
  expect(texts()).toContain('Učitavamo tvoje prijave…');
  expect(texts()).not.toContain('Unos one');
  loading = false; rows = [row('closed', { stanje: 'WITHDRAWN', mozePovuci: false })]; await rerender();
  expect(tree.root.findByProps({ accessibilityRole: 'tablist' })).toBe(rail);
  expect(texts()).toContain('Unos closed');
  loading = false; unavailable = true; rows = []; await rerender(); expect(texts()).toContain('Prijave trenutno nisu dostupne'); expect(actions()).toContain('Pokušaj ponovo');
});

test('the foot offers the next page, says it is reading, or says it failed and offers the same retry', async () => {
  await render(); expect(actions()).toContain('Prikaži još'); action('Prikaži još').props.onPress(); expect(loadMore).toHaveBeenCalledTimes(1);
  paging = makePaging({ loadingMore: true }); await rerender();
  expect(actions()).not.toContain('Prikaži još'); expect(texts()).toContain('Učitavamo još prijava…');
  paging = makePaging({ moreError: true }); await rerender();
  expect(texts()).toContain('Ne možemo da učitamo ostale prijave.'); expect(actions()).toContain('Pokušaj ponovo'); expect(actions()).not.toContain('Prikaži još');
  action('Pokušaj ponovo').props.onPress(); expect(loadMore).toHaveBeenCalledTimes(2);
  paging = makePaging({ hasMore: false }); await rerender();
  expect(actions()).not.toContain('Prikaži još'); expect(actions()).not.toContain('Pokušaj ponovo');
});

test('the end of the list asks for the next page only when there is one, nothing is being read and the last read did not fail', async () => {
  await render(); expect(list().props.onEndReached).toBe(loadMore);
  for (const patch of [{ hasMore: false }, { loadingMore: true }, { moreError: true }]) {
    paging = makePaging(patch); await rerender(); expect(list().props.onEndReached).toBeUndefined();
  }
});

test('the foot is drawn only under applications that are shown: not while reading, not when the read failed, not under an empty set', async () => {
  loading = true; await render(); expect(actions()).not.toContain('Prikaži još');
  loading = false; unavailable = true; await rerender(); expect(actions()).not.toContain('Prikaži još');
  unavailable = false; rows = []; await rerender(); expect(actions()).not.toContain('Prikaži još');
});

test('without the paging prop the list is the whole list: its groups count themselves and it has no foot', async () => {
  paging = undefined; rows = [row('waiting', { stanje: 'SELECTED', traziPaznju: true, mozePovuci: false, dogovorId: 'agreement' }), row('open'), row('closed', { stanje: 'WITHDRAWN', mozePovuci: false })];
  await render();
  expect(tabs()).toEqual([]); expect(heads()).toEqual(['Čeka odgovor · 1', 'Izabrana · 1', 'Završene · 1']);
  expect(actions()).not.toContain('Prikaži još'); expect(list().props.onEndReached).toBeUndefined();
});
