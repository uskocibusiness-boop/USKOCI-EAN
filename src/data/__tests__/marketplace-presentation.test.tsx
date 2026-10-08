import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';
import BottomSheet from '@gorhom/bottom-sheet';
import { sys } from '../../ui/system/tokens';
let mockReduced = false;
jest.mock('react-native', () => {
 const native = jest.requireActual('react-native'), React = require('react');
 // Native FlatList retains its scroll offset when data changes. Keep that state across renders so a new subset
 // cannot accidentally inherit the position of the old one; ordinary rereads must still keep the reading position.
 const List = React.forwardRef(({ data, renderItem, ListEmptyComponent, ListHeaderComponent, ...props }: any, ref: any) => {
  const [offset, setOffset] = React.useState(0);
  React.useImperativeHandle(ref, () => ({ scrollToOffset: ({ offset: next }: any) => setOffset(next) }), []);
  return React.createElement('List', { ...props, offset, hasHeader: ListHeaderComponent != null, onScroll: (event: any) => {
   setOffset(event.nativeEvent.contentOffset.y); props.onScroll?.(event);
  } }, ListHeaderComponent, data.length ? data.map((item: any) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))) : ListEmptyComponent);
 });
 return new Proxy(native, { get(target, key) {
  if (key === 'FlatList') return List;
  if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
  if (key === 'Keyboard') return { dismiss: jest.fn() };
  return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
 } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
// Reanimated is the shared Jest stand-in (__mocks__/react-native-reanimated.js): since review r3 item 9 the task card's
// frame is an Animated.View that gives under the finger, so a hand-written partial copy here no longer suffices.
// Reduced motion is read from the one store (ui/system/motion) since 2026-09-24, no longer from Reanimated.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { MarketplacePresentation } from '../../ui/v2/MarketplacePresentation';

/**
 * Moji zadaci (MarketplacePresentation). Since owner step 4 (2026-09-24) the Zadaci tab is DiscoveryPresentation, the map
 * under a list sheet, and this presentation draws only my own tasks. The discovery cases that used to live here moved
 * with the screen they guard (review r3b):
 *   - list/map switch, pin preview, "Pogledaj listu", hidden-own-tasks line: retired with the switch, and pinned as
 *     absent in discovery-presentation ("one screen", "my own tasks are simply not listed");
 *   - search over the map, applied price filter, area, filter draft, "Dodaj zadatak", pin card: discovery-presentation;
 *   - the discovery header name, stale cards while reading or failing, reduced motion, no GPS wording, the brand action
 *     in the filter sheet and "Obriši uslove" keeping the map: zadaci-guards-from-marketplace;
 *   - discovery cards carry no applications foot: marketplace-owned-screens and task-card-face.
 *
 * "Papir na stolu" (the owner's pick of 2026-10-08): my active tasks are in GROUPS by phase ("Čeka tvoj izbor", "Objavljeno",
 * "Dogovoreno"), under them two quiet rows, "Nacrti" and "Istorija", and there are no tabs and no count line. "Filteri" (search, the way of
 * pricing, "Čeka tvoj izbor") stays the one control of the bar, as it was: the look is A and the function is not lost. The first encounter is
 * the paper with the pin at 144 (the hero of `StateView`).
 */
const row = (id: string, patch = {}): MarketplaceItem => ({ id, revizija: 1, naslov: `Pomoć ${id}`, opis: '', stanje: 'OBJAVLJENA', podrucjeTekst: 'Novi Sad',
  vremeTekst: 'Po dogovoru', uslovi: ['Alat', 'Iskustvo', 'Prevoz'], rezimCene: 'MY_PRICE', ponudjenaCena: { prikaz: '2.000 RSD' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, brojPrijava: 0, brojPrijavaZaIzbor: 0, priblizno: null, ...patch } as MarketplaceItem);
const baseRows = () => [row('one'), row('two', { rezimCene: 'OFFERS' })];
let rows = baseRows(), loading = false, error = false;
let snapshot: MarketplaceView, initial: MarketplaceView; const open = jest.fn(), refresh = jest.fn(), newTask = jest.fn(), explore = jest.fn(), applications = jest.fn(); let allowNew = true, allowExplore = true;
let withBack = false; const back = jest.fn();
function Screen() { const [view, setView] = useState(initial); snapshot = view; return <MarketplacePresentation items={rows} loading={loading} error={error} view={view} onView={setView} onOpen={open} onRefresh={refresh} onProfile={() => {}} onNew={allowNew ? newTask : undefined} onExplore={allowExplore ? explore : undefined} onBack={withBack ? back : undefined} onApplications={applications} />; }
let tree: ReactTestRenderer;
// What is pressed, not what is only named alike: a row of facts says "Tražim ponude" too, and is not a button.
const press = (label: string) => tree.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0] ?? tree.root.findByProps({ accessibilityLabel: label });
const action = (label: string) => tree.root.findByProps({ label });
const tap = async (label: string) => act(async () => press(label).props.onPress());
const click = async (label: string) => act(async () => (label === 'Prikaži zadatke'
 ? tree.root.findAllByType('Action' as React.ElementType).find(node => /^Prikaži \d+ zadat/.test(node.props.label))!
 : action(label)).props.onPress());
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const words = () => tree.root.findAllByType('T' as React.ElementType).map(node => node.props.children);
const cards = () => tree.root.findAll(node => node.type === ('Press' as React.ElementType) && /^Otvori zadatak /.test(node.props.accessibilityLabel ?? ''));
const cardNames = () => cards().map(node => String(node.props.accessibilityLabel).replace('Otvori zadatak Pomoć ', ''));
/** The names of the groups, as drawn: a heading that is not the bar's. */
const headings = () => tree.root.findAllByType('T' as React.ElementType).filter(node => node.props.accessibilityRole === 'header' && /^(Čeka tvoj izbor|Objavljeno|Dogovoreno)/.test(String(node.props.children)));
const groups = () => headings().map(node => node.props.children);
const chips = () => tree.root.findAll(node => node.type === ('View' as React.ElementType) && node.props.testID === 'status-chip');
/** The picture the empty state draws: FactArt is memoised, so it is found by what it was asked to draw. */
const pictures = () => tree.root.findAll(node => typeof node.type !== 'string' && typeof node.props.kind === 'string' && typeof node.props.size === 'number');
const list = () => tree.root.findByType('List' as React.ElementType);
const scrollTo = async (y: number) => act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y } } }));
const render = async () => act(async () => { tree = create(<Screen />); });
const flatStyle = (node: { props: { style?: unknown } }) => (Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style.flat(3).filter(Boolean)) : node.props.style ?? {}) as Record<string, unknown>;
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); initial = initialMarketplaceView(); rows = baseRows(); loading = error = mockReduced = false; allowNew = allowExplore = true; withBack = false;
 open.mockClear(); refresh.mockClear(); newTask.mockClear(); explore.mockClear(); applications.mockClear(); back.mockClear(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const partial = { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 }, full = { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 };
/** One of every state: the groups, the drafts and the finished. */
const everyState = () => [row('draft', { stanje: 'NACRT' }), row('published', { stanje: 'OBJAVLJENA' }),
 row('choosing', { stanje: 'CEKA_PRIJAVE', brojPrijava: 3, brojPrijavaZaIzbor: 3 }), row('applied', { stanje: 'CEKA_PRIJAVE', brojPrijava: 1, brojPrijavaZaIzbor: 0 }),
 row('partial', { stanje: 'DELIMICNO_POPUNJENA', pokrivenost: partial, brojPrijavaZaIzbor: 0 }),
 row('partial-choosing', { stanje: 'DELIMICNO_POPUNJENA', pokrivenost: partial, brojPrijavaZaIzbor: 1 }),
 row('agreed', { stanje: 'POPUNJENA', pokrivenost: full }),
 row('now', { stanje: 'POPUNJENA', pokrivenost: full, schedule: { kind: 'FIXED_WINDOW', startsAt: hoursFromNow(-1), endsAt: hoursFromNow(1) } }),
 row('done', { stanje: 'ZATVORENA', kraj: 'COMPLETED' }), row('cancelled', { stanje: 'ZATVORENA', kraj: 'CANCELLED' }), row('expired', { stanje: 'ZATVORENA', kraj: 'EXPIRED' })];

describe('the groups by phase', () => {
 test('a task is in exactly one group, by what it is doing now; a group is named with how many it holds and each keeps the order of the list', async () => {
  rows = everyState(); await render();
  expect(groups()).toEqual(['Čeka tvoj izbor · 2', 'Objavljeno · 2', 'Dogovoreno · 3']);
  // Waiting for my choice: the one rule of the app (a place is open and applications are there to choose among), whatever the state calls itself.
  expect(cardNames()).toEqual(['choosing', 'partial-choosing', 'published', 'applied', 'partial', 'agreed', 'now']);
  // The spoken name of a group says the number as a word the reader can use.
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Čeka tvoj izbor, 2 zadatka' }).length).toBeGreaterThan(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Dogovoreno, 3 zadatka' }).length).toBeGreaterThan(0);
 });

 test('a group that holds nothing has no name, and drafts and finished tasks are in no group', async () => {
  rows = [row('published'), row('draft', { stanje: 'NACRT' }), row('done', { stanje: 'ZATVORENA', kraj: 'COMPLETED' })]; await render();
  expect(groups()).toEqual(['Objavljeno · 1']); expect(cardNames()).toEqual(['published']);
  await act(async () => tree.unmount()); rows = [row('agreed', { stanje: 'POPUNJENA', pokrivenost: full })]; await render();
  expect(groups()).toEqual(['Dogovoreno · 1']);
 });

 test('the group says the state, so the card does not wear the chip a second time, and it still says its state aloud and keeps HITNO', async () => {
  rows = [row('choosing', { stanje: 'CEKA_PRIJAVE', brojPrijava: 3, brojPrijavaZaIzbor: 3 }),
   row('urgent', { stanje: 'OBJAVLJENA', urgency: { level: 'HITNO', expiresAt: '2099-01-01T00:00:00Z' } })];
  await render();
  expect(chips()).toHaveLength(0); expect(words()).not.toContain('Bira se · 3'); expect(words()).not.toContain('Objavljen');
  expect(press('Otvori zadatak Pomoć choosing').props.accessibilityValue.text).toMatch(/^Bira se, 3, /);
  expect(words()).toContain('HITNO'); expect(press('Otvori zadatak Pomoć urgent').props.accessibilityValue.text.startsWith('HITNO, Objavljen, ')).toBe(true);
 });

 test('the name of a group is 12 above its first card and 24 below the last card of the one before; a card is 12 below the one above', async () => {
  rows = [row('choosing', { stanje: 'CEKA_PRIJAVE', brojPrijava: 3, brojPrijavaZaIzbor: 3 }), row('choosing-two', { stanje: 'CEKA_PRIJAVE', brojPrijava: 2, brojPrijavaZaIzbor: 2 }), row('published')];
  await render();
  const [first, second] = headings();
  expect(flatStyle(first)).toEqual({ paddingBottom: 12 });
  expect(flatStyle(second)).toEqual({ paddingTop: 24, paddingBottom: 12 });
  // The cell of a card: its own View above the card, with the 12 over it unless it is the first card of its group.
  const cell = (name: string) => { let up = press(`Otvori zadatak Pomoć ${name}`).parent!; while (up.parent && String(up.parent.type) !== 'List') up = up.parent; return flatStyle(up); };
  expect([cell('choosing'), cell('choosing-two'), cell('published')]).toEqual([{}, { paddingTop: 12 }, {}]);
 });
});

describe('what the screen no longer has, and what it has instead', () => {
 test('there are no tabs and no count line: a bar with the one control Filteri (its sheet closed), the groups and the two quiet rows', async () => {
  rows = everyState(); withBack = true; await render();
  for (const gone of ['Aktivni', 'Filteri, aktivni', 'Zatvori filtere', 'Pretraži zadatke']) expect(tree.root.findAllByProps({ accessibilityLabel: gone })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityRole: 'tablist' })).toHaveLength(0); expect(tree.root.findAllByProps({ testID: 'own-tasks-tabs' })).toHaveLength(0);
  expect(words()).not.toContain('7 zadataka'); expect(texts()).not.toContain('svi zadaci'); expect(texts()).not.toMatch(/Način cene|Svi načini/);
  expect(list().props.hasHeader).toBe(false);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Filteri' }).length).toBeGreaterThan(0);
  expect(press('Nacrti, 1 nacrt')).toBeTruthy(); expect(press('Istorija, 3 zadatka')).toBeTruthy();
 });

 test('the two rows say how many each holds, are drawn only when they hold some, and open that set in this screen', async () => {
  rows = [row('one'), row('draft', { stanje: 'NACRT' }), row('draft-two', { stanje: 'NACRT' })]; withBack = true; await render();
  expect(press('Nacrti, 2 nacrta').props.accessibilityHint).toBe('Otvara nacrte.'); expect(words()).toContain('2 nacrta');
  expect(tree.root.findAllByProps({ accessibilityHint: 'Otvara završene, otkazane i istekle zadatke.' })).toHaveLength(0);
  await act(async () => tree.unmount()); rows = [row('one'), row('done', { stanje: 'ZATVORENA', kraj: 'COMPLETED' })]; await render();
  expect(press('Istorija, 1 zadatak')).toBeTruthy(); expect(tree.root.findAllByProps({ accessibilityHint: 'Otvara nacrte.' })).toHaveLength(0);
  await act(async () => tree.unmount()); rows = [row('one')]; await render();
  expect(tree.root.findAllByProps({ accessibilityHint: 'Otvara nacrte.' })).toHaveLength(0); expect(texts()).not.toContain('Istorija');
 });

 test('a row opens its set: the bar says the name of the set, its cards are that set and the arrow of the bar comes back to the groups', async () => {
  rows = everyState(); withBack = true; await render();
  await tap('Nacrti, 1 nacrt');
  expect(snapshot.section).toBe('drafts'); expect(texts()).toContain('Nacrti'); expect(cardNames()).toEqual(['draft']); expect(groups()).toEqual([]);
  // The arrow that is drawn goes back to the groups, not out of the screen.
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Nazad' })).toHaveLength(1);
  await tap('Nazad'); expect(back).not.toHaveBeenCalled();
  expect(snapshot.section).toBe('active'); expect(groups().length).toBe(3);
  await tap('Istorija, 3 zadatka');
  expect(snapshot.section).toBe('history'); expect(cardNames()).toEqual(['done', 'cancelled', 'expired']);
  await tap('Nazad'); expect(snapshot.section).toBe('active');
  // Back on the groups, the arrow leaves the screen.
  await tap('Nazad'); expect(back).toHaveBeenCalledTimes(1);
 });

 test('in the list of drafts the card does not name its state (the list is that state), and in the history it does, because Istorija holds three different endings', async () => {
  rows = everyState(); initial.section = 'drafts'; await render();
  expect(chips()).toHaveLength(0); expect(words()).not.toContain('Nacrt');
  await act(async () => tree.unmount()); initial.section = 'history'; await render();
  expect(chips().map(node => node.props.accessibilityLabel)).toEqual(['Završen', 'Otkazan', 'Istekao']);
 });

 test('a task of a set the person is not looking at is not drawn, and a set that was opened starts at the top', async () => {
  rows = Array.from({ length: 30 }, (_, index) => row(`active-${index}`, { brojPrijavaZaIzbor: index % 2 }))
   .concat(Array.from({ length: 20 }, (_, index) => row(`draft-${index}`, { stanje: 'NACRT' })));
  await render(); await scrollTo(900); expect(list().props.offset).toBe(900);
  await tap('Nacrti, 20 nacrta');
  expect(cards().length).toBe(20); expect(cardNames().every(name => name.startsWith('draft-'))).toBe(true);
  expect(list().props.offset).toBe(0);
 });

 test('a reread and an unchanged list keep the reading position', async () => {
  rows = Array.from({ length: 30 }, (_, index) => row(`active-${index}`));
  await render(); await scrollTo(900);
  rows = rows.map(item => ({ ...item, brojPrijavaZaIzbor: 1 }));
  await act(async () => tree.update(<Screen />));
  expect(list().props.offset).toBe(900);
 });
});

// "Filteri" stays what it was (decision of 2026-10-08): the one control of the bar, with its sheet of search, the way of pricing and "Čeka tvoj izbor".
describe('Filteri, the one control of the bar', () => {
 test('search is one of the filters: it lives in the Filteri sheet and applies with the rest; clearing it keeps price, attention and section', async () => {
  initial.price = 'MY_PRICE';
  await render(); expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži zadatke' })).toHaveLength(0);
  // The one control of the bar is Filteri; there is no second control for search.
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraga' })).toHaveLength(0);
  await tap('Filteri, aktivni'); expect(press('Pretraži zadatke').props.autoFocus).toBeUndefined();
  await act(async () => press('Pretraži zadatke').props.onChangeText('Nema takvog posla'));
  expect(action('Prikaži 0 zadataka')).toBeTruthy();
  await click('Prikaži zadatke');
  expect(texts()).toContain('Nema zadataka u ovom prikazu');
  await tap('Filteri, aktivni'); expect(press('Pretraži zadatke').props.value).toBe('Nema takvog posla');
  await tap('Obriši pretragu'); await click('Prikaži zadatke');
  expect(snapshot).toMatchObject({ query: '', price: 'MY_PRICE', attention: false, section: 'active' });
  expect(press('Otvori zadatak Pomoć one')).toBeTruthy();
 });

 test('the control is drawn only when there is something to narrow down: not for a person with no task, nor while the tasks are read or failed', async () => {
  const control = () => tree.root.findAllByProps({ accessibilityLabel: 'Filteri' });
  await render(); expect(control().length).toBeGreaterThan(0);
  await act(async () => tree.unmount());
  rows = []; await render(); expect(control()).toHaveLength(0); expect(tree.root.findAllByProps({ accessibilityLabel: 'Filteri, aktivni' })).toHaveLength(0);
  await act(async () => tree.unmount());
  rows = baseRows(); loading = true; await render(); expect(control()).toHaveLength(0);
  await act(async () => tree.unmount());
  loading = false; error = true; await render(); expect(control()).toHaveLength(0);
  await act(async () => tree.unmount());
  // A refinement that came back empty keeps the control: it is how the refinement is cleared.
  error = false; rows = []; initial.price = 'OFFERS'; await render(); expect(press('Filteri, aktivni')).toBeTruthy();
 });

 test('it stands in the bar of the groups and in the bar of a set that was opened, and it narrows the set that is shown', async () => {
  rows = [row('one'), row('draft-a', { stanje: 'NACRT' }), row('draft-b', { stanje: 'NACRT' })]; withBack = true; await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Filteri' }).length).toBeGreaterThan(0);
  await tap('Nacrti, 2 nacrta');
  expect(texts()).toContain('Nacrti'); expect(cardNames()).toEqual(['draft-a', 'draft-b']);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Filteri' }).length).toBeGreaterThan(0);
  await tap('Filteri'); await act(async () => press('Pretraži zadatke').props.onChangeText('draft-b'));
  expect(action('Prikaži 1 zadatak')).toBeTruthy(); await click('Prikaži zadatke');
  expect(snapshot).toMatchObject({ section: 'drafts', query: 'draft-b' }); expect(cardNames()).toEqual(['draft-b']);
  // The bar still says the set and still has its way back, and the control says that a filter is on.
  expect(texts()).toContain('Nacrti'); expect(tree.root.findAllByProps({ accessibilityLabel: 'Filteri, aktivni' }).length).toBeGreaterThan(0);
  await tap('Nazad'); expect(snapshot.section).toBe('active');
 });

 test('while a filter is on the two quiet rows stay reachable and say only their names; a filter that came back empty draws its answer and no rows', async () => {
  rows = [row('one'), row('two', { rezimCene: 'OFFERS' }), row('draft', { stanje: 'NACRT' }), row('done', { stanje: 'ZATVORENA', kraj: 'COMPLETED' })]; await render();
  expect(press('Nacrti, 1 nacrt')).toBeTruthy(); expect(press('Istorija, 1 zadatak')).toBeTruthy();
  await tap('Filteri'); await tap('Tražim ponude'); await click('Prikaži zadatke');
  expect(cardNames()).toEqual(['two']); expect(groups()).toEqual(['Objavljeno · 1']);
  expect(press('Nacrti').props.accessibilityHint).toBe('Otvara nacrte.'); expect(press('Istorija')).toBeTruthy();
  expect(words()).not.toContain('1 nacrt'); expect(words()).not.toContain('1 zadatak');
  await tap('Filteri, aktivni'); await act(async () => press('Pretraži zadatke').props.onChangeText('nema takvog'));
  await click('Prikaži zadatke');
  expect(texts()).toContain('Nema zadataka u ovom prikazu'); expect(tree.root.findAllByProps({ accessibilityHint: 'Otvara nacrte.' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ label: 'Poništi filtere' }).length).toBeGreaterThan(0);
 });

 test('the filter sheet offers price modes as radios, closes without applying, and applies the working copy of search, price and attention together', async () => {
  await render(); await tap('Filteri'); await tap('Tražim ponude'); await tap('Zatvori filtere'); expect(snapshot.price).toBe('all');
  await tap('Filteri'); await tap('Navedena cena'); await act(async () => tree.root.findByType('Modal' as React.ElementType).props.onRequestClose()); expect(snapshot.price).toBe('all');
  await tap('Filteri'); await tap('Tražim ponude'); await click('Prikaži zadatke'); expect(snapshot.price).toBe('OFFERS');
  expect(press('Otvori zadatak Pomoć two')).toBeTruthy(); expect(tree.root.findAllByProps({ accessibilityLabel: 'Otvori zadatak Pomoć one' })).toHaveLength(0);
 });

 test('drag/backdrop closure discards filter drafts and opens nothing', async () => {
  await render(); await tap('Filteri'); await tap('Tražim ponude');
  expect(action('Prikaži 1 zadatak')).toBeTruthy();
  await act(async () => tree.root.findByType(BottomSheet).props.onClose());
  expect(snapshot.price).toBe('all'); expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(0);
  await tap('Filteri'); expect(press('Svi načini').props.accessibilityState.checked).toBe(true);
  expect(open).not.toHaveBeenCalled();
 });

 test('the count of the sheet uses the same search and section as Apply, including zero real matches', async () => {
  rows = [...baseRows(), row('three', { stanje: 'NACRT' })]; initial.query = 'Pomoć one';
  // A search that is set makes the control "on": the search is one of the filters.
  await render(); await tap('Filteri, aktivni'); expect(action('Prikaži 1 zadatak')).toBeTruthy();
  await tap('Tražim ponude'); expect(action('Prikaži 0 zadataka')).toBeTruthy();
  await click('Prikaži zadatke'); expect(snapshot).toMatchObject({ price: 'OFFERS', query: 'Pomoć one', section: 'active' });
  expect(texts()).toContain('Nema zadataka u ovom prikazu');
 });

 test.each(['section', 'search', 'price', 'attention'])('a changed %s starts its new task results at the top', async choice => {
  rows = Array.from({ length: 30 }, (_, index) => row(`active-${index}`, { brojPrijavaZaIzbor: index % 2, rezimCene: index % 2 ? 'OFFERS' : 'MY_PRICE' }))
   .concat(Array.from({ length: 20 }, (_, index) => row(`draft-${index}`, { stanje: 'NACRT' })));
  await render(); await scrollTo(900); expect(list().props.offset).toBe(900);
  if (choice === 'section') await tap('Nacrti, 20 nacrta');
  else if (choice === 'search') { await tap('Filteri'); await act(async () => press('Pretraži zadatke').props.onChangeText('active-1')); await click('Prikaži zadatke'); }
  else { await tap('Filteri'); await tap(choice === 'price' ? 'Tražim ponude' : 'Čeka tvoj izbor'); await click('Prikaži zadatke'); }
  expect(cards().length).toBeGreaterThan(5);
  expect(list().props.offset).toBe(0);
 });

 test('a reread and unchanged filter choices keep the task reading position', async () => {
  rows = Array.from({ length: 30 }, (_, index) => row(`active-${index}`));
  await render(); await scrollTo(900);
  rows = rows.map(item => ({ ...item, brojPrijavaZaIzbor: 1 }));
  await act(async () => tree.update(<Screen />));
  expect(list().props.offset).toBe(900);
  await tap('Filteri'); await tap('Zatvori filtere'); expect(list().props.offset).toBe(900);
  await tap('Filteri'); await tap('Tražim ponude'); await tap('Zatvori filtere');
  expect(list().props.offset).toBe(900);
  await tap('Filteri'); await click('Prikaži zadatke'); expect(list().props.offset).toBe(900);
 });

 test('"Čeka tvoj izbor" in the sheet is the first group: it narrows the groups to the tasks that wait for my choice, and the sheet can be cleared and applied again', async () => {
  const long = 'Pomoć pri prenošenju i raspoređivanju nameštaja u Novom Sadu '.repeat(3);
  rows = [row('one', { naslov: long, stanje: 'OBJAVLJENA', brojPrijava: 1 }), row('two', { stanje: 'OBJAVLJENA', brojPrijava: 2, brojPrijavaZaIzbor: 2 }), row('three', { stanje: 'NACRT', brojPrijava: 0 })];
  await render(); expect(texts()).toContain(long); await tap('Filteri'); await tap('Čeka tvoj izbor');
  expect(snapshot.attention).toBe(false); await click('Prikaži zadatke'); expect(snapshot.attention).toBe(true);
  expect(groups()).toEqual(['Čeka tvoj izbor · 1']); expect(cardNames()).toEqual(['two']);
  await tap('Filteri, aktivni'); await click('Poništi izbor'); await click('Prikaži zadatke');
  expect(snapshot.attention).toBe(false); expect(groups()).toEqual(['Čeka tvoj izbor · 1', 'Objavljeno · 1']);
 });

 test('attention and price are one filter draft: cancel, system back and reset have consistent effects', async () => {
  rows = [row('one', { stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 1 })];
  await render(); await tap('Filteri'); await tap('Čeka tvoj izbor'); await tap('Tražim ponude');
  await tap('Zatvori filtere'); expect(snapshot).toMatchObject({ attention: false, price: 'all' });
  await tap('Filteri'); await tap('Čeka tvoj izbor');
  await act(async () => tree.root.findByType('Modal' as React.ElementType).props.onRequestClose());
  expect(snapshot.attention).toBe(false);
  await tap('Filteri'); await tap('Čeka tvoj izbor'); await tap('Navedena cena'); await click('Prikaži zadatke');
  expect(snapshot).toMatchObject({ attention: true, price: 'MY_PRICE' });
  await tap('Filteri, aktivni'); await click('Poništi izbor');
  expect(snapshot).toMatchObject({ attention: true, price: 'MY_PRICE' });
  await click('Prikaži zadatke'); expect(snapshot).toMatchObject({ attention: false, price: 'all' });
 });

 test('reduced motion sheet is immediate; no unbound GPS, proximity or geocoding controls appear', async () => {
  mockReduced = true; await render(); await tap('Filteri'); expect(tree.root.findByType('Modal' as React.ElementType).props.animationType).toBe('none');
  expect(tree.root.findByType(BottomSheet).props.animateOnMount).toBe(false);
  expect(tree.root.findByType(BottomSheet).props.animationConfigs.duration).toBe(0);
  expect(JSON.stringify(tree.toJSON())).not.toMatch(/GPS|Moja lokacija|km od|geocod/i);
 });

 // Review r3 item 8: the box's corner is the named `check` token, not a magic 6 dressed up as a nested corner.
 test('"Čeka tvoj izbor" is a square checkbox, not a round radio', async () => {
  rows = [row('one', { stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 1 })]; await render(); await tap('Filteri');
  const box = press('Čeka tvoj izbor').findAllByType('View' as React.ElementType)[0];
  const radio = press('Svi načini').findAllByType('View' as React.ElementType)[0];
  expect(box.props.style[0]).toMatchObject({ width: 22, height: 22, borderRadius: sys.radius.check });
  expect(sys.radius.check).toBe(6);
  expect(radio.props.style[0]).toMatchObject({ width: 22, height: 22, borderRadius: 999 });
 });

 test('a narrowed list that came back empty still offers "Poništi filtere"', async () => {
  rows = [row('active', { stanje: 'OBJAVLJENA' })]; await render();
  await tap('Filteri'); await act(async () => press('Pretraži zadatke').props.onChangeText('nema takvog')); await click('Prikaži zadatke');
  expect(texts()).toContain('Nema zadataka u ovom prikazu'); expect(tree.root.findAllByProps({ label: 'Poništi filtere' }).length).toBeGreaterThan(0);
 });
});

describe('the empty states', () => {
 test('a person with no task at all meets the paper with the pin at 144, one green action and one quiet way', async () => {
  withBack = true; rows = []; await render();
  expect(texts()).toContain('Još nemaš zadatak'); expect(texts()).toContain('Reci šta ti treba. Nacrt pregledaš pre objave.');
  expect(pictures().map(node => [node.props.kind, node.props.size])).toEqual([['publish', 144]]);
  await click('Objavi zadatak'); expect(newTask).toHaveBeenCalledTimes(1);
  await click('Pogledaj zadatke'); expect(explore).toHaveBeenCalledTimes(1);
  // The quiet way is drawn only when the screen can take the person there; a screen that cannot has the one green action.
  await act(async () => tree.unmount()); allowExplore = false; await render();
  expect(tree.root.findAllByProps({ label: 'Pogledaj zadatke' })).toHaveLength(0); expect(action('Objavi zadatak')).toBeTruthy();
  await act(async () => tree.unmount()); allowNew = false; await render();
  expect(tree.root.findAllByProps({ label: 'Objavi zadatak' })).toHaveLength(0);
 });

 test('nothing is active but there are drafts or finished tasks: it says so once, offers the next task and the two rows are right under it', async () => {
  rows = [row('draft', { stanje: 'NACRT' }), row('done', { stanje: 'ZATVORENA', kraj: 'COMPLETED' })]; await render();
  expect(texts()).toContain('Nema aktivnih zadataka'); expect(texts()).toContain('Nacrti i završeni zadaci su ispod.');
  expect(groups()).toEqual([]); expect(cards()).toHaveLength(0);
  expect(press('Nacrti, 1 nacrt')).toBeTruthy(); expect(press('Istorija, 1 zadatak')).toBeTruthy();
  await click('Objavi novi zadatak'); expect(newTask).toHaveBeenCalledTimes(1);
  // This is not a first encounter: the picture is the small one of the state, not the paper at 144.
  expect(pictures().every(node => node.props.size !== 144)).toBe(true);
 });

 test('an empty list of drafts or of the finished says what the set holds and offers no "Poništi filtere"', async () => {
  rows = [row('active', { stanje: 'OBJAVLJENA' })]; initial.section = 'drafts'; await render();
  expect(texts()).toContain('Nemaš nacrt'); expect(texts()).not.toContain('Nema zadataka u ovom prikazu'); expect(tree.root.findAllByProps({ label: 'Poništi filtere' })).toHaveLength(0);
  await act(async () => tree.unmount()); initial.section = 'history'; await render();
  expect(texts()).toContain('Istorija je prazna'); expect(texts()).toContain('Ovde su završeni, otkazani i istekli zadaci.'); expect(tree.root.findAllByProps({ label: 'Poništi filtere' })).toHaveLength(0);
 });

 test.each(['loading', 'error'])('%s removes stale cards and the two rows; retry is bound', async status => {
  rows = everyState(); loading = status === 'loading'; error = status === 'error'; await render();
  expect(cards()).toHaveLength(0); expect(groups()).toEqual([]); expect(tree.root.findAllByProps({ accessibilityHint: 'Otvara nacrte.' })).toHaveLength(0);
  if (error) { await click('Pokušaj ponovo'); expect(refresh).toHaveBeenCalledTimes(1); }
  else expect(texts()).toContain('Učitavamo zadatke…');
 });

 // Review r3 item 7: the filtered-empty view's one way forward clears what was chosen, and only that. Nothing on this screen narrows the list any more;
 // a caller that does still gets an honest answer and the way back.
 test('a view that a caller narrowed and that came back empty says so, and "Poništi filtere" clears search, price, attention and section and asks for nothing', async () => {
  Object.assign(initial, { query: 'Nema takvog posla', price: 'MY_PRICE', attention: true, section: 'drafts' });
  await render(); expect(texts()).toContain('Nema zadataka u ovom prikazu');
  await click('Poništi filtere');
  expect(snapshot).toEqual(initialMarketplaceView()); expect(press('Otvori zadatak Pomoć two')).toBeTruthy();
  expect(open).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
 });

 test('"Pokušaj ponovo" after a failed read asks for the list again and changes nothing else', async () => {
  error = true; initial.query = 'Pomoć'; initial.section = 'history'; await render();
  expect(texts()).toContain('Ne možemo da učitamo zadatke');
  await click('Pokušaj ponovo');
  expect(refresh).toHaveBeenCalledTimes(1); expect(snapshot).toMatchObject({ query: 'Pomoć', section: 'history' });
 });
});

test('the full long title remains readable', async () => {
 const long = 'Pomoć pri prenošenju i raspoređivanju nameštaja u Novom Sadu '.repeat(3); rows = [row('one', { naslov: long, stanje: 'OBJAVLJENA', brojPrijava: 1 }), row('two', { stanje: 'NACRT', brojPrijava: 0 })];
 await render(); expect(texts()).toContain(long);
});

// Owner's information architecture, 2026-09-23: my own tasks are reached from Početna, where "Objavi zadatak" is.
// The orange "+" that floated over their cards covered a price, and the eyebrow "Moje aktivnosti" only said where you are.
test('my own tasks carry no floating creation action and no eyebrow; an empty list still offers the first task inline', async () => {
 withBack = true; rows = [row('one', { stanje: 'OBJAVLJENA', brojPrijava: 0 }), row('two', { stanje: 'OBJAVLJENA', brojPrijava: 0 })];
 await render();
 expect(press('Otvori zadatak Pomoć one')).toBeTruthy();
 expect(tree.root.findAllByProps({ accessibilityLabel: 'Dodaj zadatak' })).toHaveLength(0);
 expect(texts()).toContain('Moji zadaci'); expect(texts()).not.toContain('Moje aktivnosti');
 // Nothing of the retired discovery branch is drawn: no list/map switch and no map.
 for (const retired of ['Lista', 'Mapa', 'Prikaz zadataka', 'Pogledaj listu']) expect(tree.root.findAllByProps({ accessibilityLabel: retired })).toHaveLength(0);
 expect(tree.root.findAllByType('DiscoveryMap' as React.ElementType)).toHaveLength(0);
 await act(async () => tree.unmount()); rows = []; await render();
 // The same words as Početna's "Moji zadaci" door for an account with no task: "Zadatak" is the product's noun.
 expect(texts()).toContain('Još nemaš zadatak');
 await click('Objavi zadatak'); expect(newTask).toHaveBeenCalledTimes(1);
});

// One task card (step 5a, 2026-09-24): on my own list the card's foot goes straight to the applications waiting for my
// choice, with the very row that was pressed; the body still opens the task. Since 2026-10-07 the foot is the ONE next step in grey words.
test('my own task\'s foot opens its applications with that row; the body still opens the task', async () => {
 withBack = true; rows = [row('one', { stanje: 'CEKA_PRIJAVE', brojPrijava: 3, brojPrijavaZaIzbor: 2 }), row('two', { stanje: 'OBJAVLJENA', brojPrijava: 0, brojPrijavaZaIzbor: 0 })];
 await render();
 const foot = 'Pogledaj prijave, 2 prijave. Zadatak: Pomoć one';
 expect(tree.root.findAllByProps({ accessibilityLabel: foot }).length).toBeGreaterThan(0);
 expect(press(foot).props.accessibilityHint).toBe('Otvara prijave za izbor.');
 await tap(foot); expect(applications).toHaveBeenCalledWith(rows[0]); expect(open).not.toHaveBeenCalled();
 await tap('Otvori zadatak Pomoć one'); expect(open).toHaveBeenCalledWith(rows[0]); expect(applications).toHaveBeenCalledTimes(1);
 // The line is data in grey words, and the foot says it as it is written: no "N prijava čeka izbor", no "Čeka prijave" that reads as "has none".
 expect(texts()).toContain('2 prijave');
 expect(texts()).not.toMatch(/čeka izbor|čekaju izbor|Čeka prijave/);
 // Nothing to choose is said quietly and is not a target.
 expect(texts()).toContain('Još nema prijava'); expect(texts()).not.toMatch(/zvonc|Vidiš ih|Uporedi ih/);
 expect(tree.root.findAll(node => String(node.props.accessibilityLabel).includes('Pomoć two') && node.props.accessibilityLabel !== 'Otvori zadatak Pomoć two' && typeof node.props.onPress === 'function')).toHaveLength(0);
});

// Plan 2.2 and 3.5 (owner 2026-10-07): every row of my own tasks wears the app's one chip, in the owner's eight words, where no group says it (the list of
// all of them, the history: Istorija holds three different endings). "Čeka prijave" is not one of them.
test('every row says its state with the chip, in the owner\'s eight words, where the list has no group, and the ending of a closed task is the one the server sent', async () => {
 rows = everyState().filter(item => item.id !== 'applied' && item.id !== 'partial-choosing');
 initial.section = 'all'; await render();
 const chipLabels = () => chips().map(node => node.props.accessibilityLabel);
 // The chip's accessible name is "word" or "word, detail"; the tree order is the list's order.
 expect(chipLabels()).toEqual(['Nacrt', 'Objavljen', 'Bira se, 3', 'Dogovoren, 1 od 2', 'Dogovoren', 'U toku', 'Završen', 'Otkazan', 'Istekao']);
 expect(words()).toEqual(expect.arrayContaining(['Bira se · 3', 'Dogovoren · 1 od 2']));
 // No row is without a state, and none says what the server never said: not "Zatvoren", not "Čeka prijave", not "Termin je sada".
 expect(words()).not.toContain('Zatvoren'); expect(texts()).not.toMatch(/Čeka prijave|Termin je sada|Delimično popunjen|Popunjen/);
 expect(cards()).toHaveLength(9);
 // One line of data, where there is one; what the chip already says is not said again and nothing explains.
 expect(texts()).toContain('Još nema prijava'); expect(texts()).toContain('3 prijave');
 expect(texts()).not.toMatch(/zvonc|Dogovor vidiš|Nastavi uređivanje|Sva mesta su dogovorena|Dogovoreni termin je počeo|Otkazan zadatak ne prima|Rok za prijave je istekao|Čekaš/);
 // The view of all of them has no tab, so the bar says what it is.
 expect(texts()).toContain('Svi zadaci');
});
test('a closed task whose ending was not carried, and an archived one, get no chip they could not stand behind, and no card is lost', async () => {
 rows = [row('unknown', { stanje: 'ZATVORENA' }), row('archived', { stanje: 'ZATVORENA', kraj: 'ARCHIVED' })]; initial.section = 'history'; await render();
 expect(cards()).toHaveLength(2);
 expect(chips()).toHaveLength(0);
 expect(texts()).toContain('Zadatak je zatvoren.'); expect(texts()).toContain('Zadatak je u arhivi.'); expect(words()).not.toContain('Zatvoren');
});
