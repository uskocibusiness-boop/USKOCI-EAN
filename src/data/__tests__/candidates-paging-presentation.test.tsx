import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { KandidatProjekcija, PotrebaProjekcija } from '../../contracts/projections';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  // The list stand-in draws its header, its rows (or the empty view) and its FOOT, and keeps every other prop (onEndReached among them) for the test to read.
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
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' }, FadeIn: { duration: () => ({}) } }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }), useLocalSearchParams: () => ({}), useFocusEffect: () => undefined }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => ({}), useUloga: () => 'uskocer', ulogaSada: () => 'uskocer' }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: 'a' }, accountRevision: 1 }), sesijaSada: () => ({ user: { id: 'a' }, accountRevision: 1 }) }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action', ACTION_MIN_HEIGHT: 48 }));
jest.mock('../../ui/product/ProductDetails', () => ({ ProductHeader: 'Header' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/StateView', () => ({ StateView: 'StateView' }));
jest.mock('../../ui/v2/CandidateFace', () => ({ CandidateCard: 'Card', CandidateCompareCard: 'CompareCard', CandidatePerson: 'Person',
  UNPRICED: '—', candidateChip: () => 'application.sent', candidateStatus: () => '', candidateTime: () => '', candidateValue: () => '' }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
import { CandidateListPresentation, type CandidateSort, type CandidatesPaging } from '../../ui/v2/ApplicationSelectionPresentation';
import { prijava } from '../../ui/system/plural';

/**
 * EX-04 S4 (A11): what the list of applications says when it is read a page at a time. The rows are the ones loaded so far, in the whole-list order; the number the person is given is the
 * server's, never the number that happens to be loaded; "za izbor" is only said once every application is loaded; and the foot offers the next page (or says it failed and offers the same
 * call again). Without `paging` the list is exactly the whole list it always was.
 */
const need = { id: 'need-1', naslov: 'Unos ormara', pokrivenost: { ukupno: 3, preostalo: 3, popunjeno: 0 }, taskTimezone: 'Europe/Belgrade', vremeTekst: '20. sep · 10:00' } as unknown as PotrebaProjekcija;
const row = (id: string, patch: Partial<KandidatProjekcija> = {}): KandidatProjekcija => ({ prijavaId: id, radnikProfilId: `profile-${id}`, potrebaRevizija: 2, verzija: 1, hash: 'a'.repeat(64),
  ime: `Osoba ${id}`, inicijali: 'O', ocenaTekst: '—', recenzijeTekst: '0 završenih', cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' }, pokrivaMesta: 1, preostaloMesta: 3,
  dolazakTekst: '', prevozTekst: '', napomena: '', stanje: 'SELECTABLE', mozeIzabrati: true, ...patch }) as unknown as KandidatProjekcija;
const loadMore = jest.fn(), refresh = jest.fn();
const makePaging = (patch: Partial<CandidatesPaging> = {}): CandidatesPaging => ({ total: 120, hasMore: true, loadingMore: false, moreError: false, onLoadMore: loadMore, ...patch });
let candidates: KandidatProjekcija[], paging: CandidatesPaging | undefined, sort: CandidateSort | undefined;
let tree: ReactTestRenderer;
const element = () => <CandidateListPresentation need={need} candidates={candidates} open={jest.fn()} back={jest.fn()} refresh={refresh} paging={paging} sort={sort} />;
const render = async () => act(async () => { tree = create(element()); });
const rerender = async () => act(async () => tree.update(element()));
const list = () => tree.root.findByType('List' as React.ElementType);
const actions = () => tree.root.findAllByType('Action' as React.ElementType).map(node => node.props.label as string);
const action = (label: string) => tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === label)!;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')) as string[];
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); candidates = [row('a'), row('b'), row('c', { stanje: 'STALE', mozeIzabrati: false })]; paging = makePaging(); sort = undefined; loadMore.mockClear(); refresh.mockClear(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('without paging the list is the whole list: its own count with "za izbor", no button at its foot and no request for another page', async () => {
  paging = undefined; await render();
  expect(texts()).toContain(`${prijava(3)} · 2 za izbor`);
  expect(actions()).toEqual([]);
  expect(list().props.onEndReached).toBeUndefined();
});

test('the list is read again by pulling it down (no "Osveži prijave" button), and a read nobody pulled draws no spinner', async () => {
  paging = undefined; await render();
  expect(texts()).not.toContain('Osveži prijave'); expect(actions()).not.toContain('Osveži prijave');
  expect(list().props.refreshing).toBe(false); expect(typeof list().props.onRefresh).toBe('function');
  await act(async () => { list().props.onRefresh(); });
  expect(refresh).toHaveBeenCalledTimes(1);
});

test('read a page at a time the count is the server\'s, never the number loaded, and nothing is said about how many can be chosen while some are not loaded', async () => {
  await render();
  expect(texts()).toContain(prijava(120)); expect(texts().some(text => / · \d+ za izbor/.test(text))).toBe(false);   // the footnote about an offer that cannot be chosen is another sentence
  paging = makePaging({ total: 51 }); await rerender();
  expect(texts()).toContain(prijava(51));
  paging = makePaging({ total: null }); await rerender();   // before any first page answered, the loaded ones are all there is to count
  expect(texts()).toContain(prijava(3));
});

test('the foot offers the next page, and the end of the list asks for it by itself once', async () => {
  await render();
  expect(actions()).toEqual(['Prikaži još']);
  await act(async () => action('Prikaži još').props.onPress()); expect(loadMore).toHaveBeenCalledTimes(1);
  expect(list().props.onEndReached).toBe(loadMore); expect(list().props.onEndReachedThreshold).toBe(0.6);
});

test('while a page is read the foot says so, offers no second request and the end of the list asks for none', async () => {
  paging = makePaging({ loadingMore: true }); await render();
  expect(texts()).toContain('Učitavamo još prijava…'); expect(actions()).toEqual([]); expect(list().props.onEndReached).toBeUndefined();
});

test('a page that failed keeps the list, says so, and offers the same call again - the end of the list never retries it by itself', async () => {
  paging = makePaging({ moreError: true }); await render();
  expect(texts()).toContain('Ne možemo da učitamo ostale prijave.'); expect(actions()).toEqual(['Pokušaj ponovo']);
  expect(list().props.onEndReached).toBeUndefined();
  await act(async () => action('Pokušaj ponovo').props.onPress()); expect(loadMore).toHaveBeenCalledTimes(1);
});

test('a complete set says what a whole list says - the count of what is loaded and how many can be chosen - and has no foot to ask for more', async () => {
  paging = makePaging({ total: 3, hasMore: false }); await render();
  expect(texts()).toContain(`${prijava(3)} · 2 za izbor`);
  expect(actions()).toEqual([]); expect(list().props.onEndReached).toBeUndefined();
  expect(texts()).not.toContain('Učitavamo još prijava…');
});

test('the lowest price and the best rating are orders of the WHOLE list: while a page is still to come the control is not drawn, and a saved order is not applied', async () => {
  const priced = (id: string, iznos: number) => row(id, { cena: { iznos, valuta: 'RSD', prikaz: `${iznos} RSD` } });
  candidates = [priced('a', 9000), priced('b', 3000), priced('c', 5000)];
  const order = () => tree.root.findAllByType('Card' as React.ElementType).map(node => node.props.candidate.prijavaId);
  const control = () => tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith('Redosled prijava'));
  // A page is still to come: the server orders by arrival only, so no other order is offered and a saved one is not applied to the part that is loaded.
  sort = 'PRICE'; await render();
  expect(control()).toHaveLength(0); expect(order()).toEqual(['a', 'b', 'c']); expect(texts().join(' ')).not.toMatch(/važi samo za učitane/);
  // Whole: the control stands, in the draft's words, and the saved order is applied.
  paging = makePaging({ total: 3, hasMore: false }); await rerender();
  expect(control().map(node => node.props.accessibilityLabel)).toEqual(['Redosled prijava: Najniža cena']); expect(order()).toEqual(['b', 'c', 'a']);
  sort = undefined; await rerender(); expect(control().map(node => node.props.accessibilityLabel)).toEqual(['Redosled prijava: Najranije']);
});

test('every loaded application is a row, in the order it was given, and the rows keep their identity when a page is appended', async () => {
  await render();
  const cards = () => tree.root.findAllByType('Card' as React.ElementType).map(node => node.props.candidate.prijavaId);
  expect(cards()).toEqual(['a', 'b', 'c']);
  candidates = [...candidates, row('d'), row('e')]; await rerender();
  expect(cards()).toEqual(['a', 'b', 'c', 'd', 'e']);
  expect(texts()).toContain(prijava(120));
});
