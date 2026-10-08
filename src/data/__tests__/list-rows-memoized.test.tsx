import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DogovorProjekcija, MojaPrijavaProjekcija } from '../../contracts/projections';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';

/**
 * A list on a phone re-renders far more often than its rows change: every keystroke in the search,
 * every pull to refresh, every fresh closure the route hands down. The rows are memoised so that
 * none of that reaches them; this counts how often each row's press surface is drawn.
 *
 * The FlatList here calls `renderItem` for every item on every render, on purpose: it is the
 * row's own props that must stay equal, not the list's rendering schedule.
 */
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  // One component per name, made once: a mock returned fresh from every property read would be a
  // new component type on every render and remount the list, which is exactly what is measured here.
  const List = ({ data, renderItem, keyExtractor, ListEmptyComponent, ListHeaderComponent, ...props }: any) =>
    React.createElement('List', props, ListHeaderComponent, data.length
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
// Reanimated is the shared Jest stand-in (__mocks__/react-native-reanimated.js): the task card's frame is an
// Animated.View that gives under the finger (review r3 item 9) and Zadaci's list sheet reads a shared value, which the
// hand-written partial copy this file had did not provide. It passes `entering` through, as that copy did.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
// Both are counted: `Press` for a whole row, `T` for the memoised text inside a card whose shell must re-render.
jest.mock('../../ui/Text', () => { const React = require('react'); return { T: jest.fn((props: any) => React.createElement('T', props)) }; });
jest.mock('../../ui/Press', () => { const React = require('react'); return { Press: jest.fn((props: any) => React.createElement('Press', props)) }; });
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('../../ui/v2/DiscoveryMap', () => ({ DiscoveryMap: 'DiscoveryMap' }));
import { Press } from '../../ui/Press';
import { T } from '../../ui/Text';
import { DiscoveryPresentation } from '../../ui/v2/DiscoveryPresentation';
import { MarketplacePresentation } from '../../ui/v2/MarketplacePresentation';
import { AgreementCollectionPresentation } from '../../ui/v2/AgreementCollectionPresentation';
import { MyApplicationsPresentation } from '../../ui/v2/MyApplicationsPresentation';

let tree: ReactTestRenderer;
/** How many times a row's press surface has been drawn since the counter was cleared. */
const drawn = (prefix: string) => (Press as jest.Mock).mock.calls.filter(([props]) => String(props.accessibilityLabel).startsWith(prefix)).length;
/** How many times a piece of text has been drawn since the counter was cleared. */
const written = (text: string) => (T as unknown as jest.Mock).mock.calls.filter(([props]) => props.children === text).length;
const list = () => tree.root.findByType('List' as React.ElementType);
const field = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
/** A task's row by its command and title: a card in Zadaci goes on to say everything it shows ("Otvori zadatak Pomoć two. 2.000 RSD, ..."), a row in Moji zadaci does not. */
const rowOf = (root: { findAll: (test: (node: any) => boolean) => any[] }, prefix: string, title: string) => root.findAll(node => String(node.type) === 'Press'
  && (node.props.accessibilityLabel === `${prefix} ${title}` || String(node.props.accessibilityLabel).startsWith(`${prefix} ${title}. `)))[0];
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); (Press as jest.Mock).mockClear(); (T as unknown as jest.Mock).mockClear(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

// Zadaci has been DiscoveryPresentation (the map under a list sheet) since owner step 4, 2026-09-24, and Moji zadaci is
// what MarketplacePresentation still draws. Both lists keep the same three guards, each on the screen that now has it.
describe.each([
  ['Zadaci', 'Otvori zadatak'],
  ['Moji zadaci', 'Otvori zadatak'],
] as const)('%s', (screen, prefix) => {
  const discovery = screen === 'Zadaci';
  const task = (id: string): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`, podrucjeTekst: 'Novi Sad', vremeTekst: 'Po dogovoru', uslovi: ['Alat'], statusTekst: 'Otvoren',
    rezimCene: 'MY_PRICE', ponudjenaCena: { prikaz: '2.000 RSD' }, pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, priblizno: { lat: 45.25, lng: 19.83 },
    ...(discovery ? {} : { revizija: 1, opis: '', stanje: 'OBJAVLJENA', brojPrijava: 0, brojPrijavaZaIzbor: 0 }) } as MarketplaceItem);
  let rows: MarketplaceItem[]; const open = jest.fn(); let snapshot: MarketplaceView;
  function Screen({ pass }: { pass: number }) {
    const [view, setView] = useState(discovery ? () => ({ ...initialMarketplaceView(), mode: 'map' as const }) : initialMarketplaceView); snapshot = view;
    // Fresh closures every render, exactly as the route hands them down.
    return discovery
      ? <DiscoveryPresentation items={rows} loading={false} error={false} scopeKey="a:1" view={view} onView={setView} refreshing={pass > 1}
        onOpen={item => open(item)} onRefresh={() => {}} onProfile={() => {}} onNew={() => {}} />
      : <MarketplacePresentation items={rows} loading={false} error={false} view={view} onView={setView} refreshing={pass > 1}
        onOpen={item => open(item)} onRefresh={() => {}} onProfile={() => {}} onNew={() => {}} />;
  }
  beforeEach(() => { rows = [task('one'), task('two'), task('three')]; open.mockClear(); });

  test('rows are drawn once and stay drawn: typing in the search, a parent render and a fresh onOpen closure touch none of them', async () => {
    await act(async () => { tree = create(<Screen pass={0} />); });
    expect(drawn(prefix)).toBe(3);
    await act(async () => tree.update(<Screen pass={1} />));
    // Moji zadaci keeps its search in the Filteri sheet (it is one of the filters, 2026-10-08). Zadaci opens its search panel from the
    // pill over the map (Discovery V47): the words are a draft in both, and the list takes them when the one action applies them.
    if (discovery) {
      await act(async () => field('Pretraži zadatke').props.onPress());
      await act(async () => field('Šta').props.onPress());
      await act(async () => field('Šta tražiš').props.onChangeText('Pomoć'));
      await act(async () => tree.root.findAllByType('Action' as React.ElementType).find(node => /^Prikaži \d+ zadat/.test(node.props.label))!.props.onPress());
    } else {
      await act(async () => field('Filteri').props.onPress());
      await act(async () => field('Pretraži zadatke').props.onChangeText('Pomoć'));
      await act(async () => tree.root.findAllByType('Action' as React.ElementType).find(node => /^Prikaži \d+ zadat/.test(node.props.label))!.props.onPress());
    }
    expect(snapshot.query).toBe('Pomoć');
    expect(drawn(prefix)).toBe(3);
    // The stable function still reaches the route's latest closure with the very row that was pressed.
    await act(async () => rowOf(tree.root, prefix, 'Pomoć two').props.onPress());
    expect(open).toHaveBeenCalledWith(rows[1]);
  });

  test('a row that arrives is the only one drawn again, and it is the only one that animates', async () => {
    await act(async () => { tree = create(<Screen pass={0} />); });
    rows = [...rows, task('four')];
    await act(async () => tree.update(<Screen pass={1} />));
    expect(drawn(prefix)).toBe(4);
    const entering = tree.root.findAll(node => typeof node.type === 'string' && !!node.props.entering);
    expect(entering).toHaveLength(1);
    expect(rowOf(entering[0], prefix, 'Pomoć four')).toBeTruthy();
  });

  test('the list is virtualised for a phone screen with a stable key per task', async () => {
    await act(async () => { tree = create(<Screen pass={0} />); });
    expect(list().props).toMatchObject({ initialNumToRender: 6, maxToRenderPerBatch: 6, windowSize: 7 });
    expect(typeof list().props.removeClippedSubviews).toBe('boolean');
  });
});

describe('Dogovori', () => {
  const agreement = (id: string): DogovorProjekcija => ({
    id, verzija: 1, naslov: `Posao ${id}`, stanje: 'CONFIRMED', cena: { iznos: 2500, valuta: 'RSD', prikaz: '2.500 RSD' },
    vremeTekst: '11. septembar · 10–12h', putanjaTekst: 'Novi Sad', pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: .5 }, rezim: 'FIZICKI',
    ucesnici: [{ id: 'me', profilId: null, ime: 'Ja', inicijali: 'JA', uloga: 'narucilac', mesta: null, viSte: true, telefon: null },
      { id: 'other', profilId: null, ime: 'Druga osoba', inicijali: 'DO', uloga: 'uskocer', mesta: 1, viSte: false, telefon: null }],
    kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true, tacnaLokacija: null, emailNijeDeljen: true },
    chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null, izmenaCeka: null, izvor: { zadatakId: null, prijavaId: null },
  });
  let rows: DogovorProjekcija[]; const open = jest.fn();
  function Screen({ pass }: { pass: number }) {
    return <AgreementCollectionPresentation items={rows} loading={false} error={false} refreshing={pass > 1} section="active" confirmationOnly={false}
      onSection={() => {}} onConfirmationOnly={() => {}} onOpen={item => open(item)} onRefresh={() => {}} onHome={() => {}} onCalendar={() => {}} onProfile={() => {}} />;
  }
  beforeEach(() => { rows = [agreement('a'), agreement('b'), agreement('c')]; open.mockClear(); });

  test('a parent render, a fresh onOpen closure and a pull to refresh draw no row again; the press still opens the right Dogovor', async () => {
    await act(async () => { tree = create(<Screen pass={0} />); });
    expect(drawn('Otvori Dogovor')).toBe(3);
    await act(async () => tree.update(<Screen pass={1} />));
    await act(async () => tree.update(<Screen pass={2} />));
    expect(drawn('Otvori Dogovor')).toBe(3);
    await act(async () => field('Otvori Dogovor Posao b').props.onPress());
    expect(open).toHaveBeenCalledWith(rows[1]);
    expect(list().props).toMatchObject({ initialNumToRender: 6, maxToRenderPerBatch: 6, windowSize: 7 });
  });
});

describe('Moje prijave', () => {
  const application = (id: string): MojaPrijavaProjekcija => ({
    prijavaId: id, potrebaId: 'need', potrebaRevizija: 2, prijavaRevizija: 2, prijavaVerzija: 1, stanje: 'SUBMITTED', naslov: `Unos ormara ${id}`, opis: '',
    cena: { iznos: 6000, valuta: 'RSD', prikaz: '6.000 RSD' }, pokrivaMesta: 2, napomena: '', podrucjeTekst: 'Novi Sad', vremeTekst: '20. septembar',
    dogovorId: null, promenjenaPotreba: false, mozePovuci: true, traziPaznju: false,
  } as MojaPrijavaProjekcija);
  let rows: MojaPrijavaProjekcija[]; const task = jest.fn(), withdraw = jest.fn();
  function Screen({ pass }: { pass: number }) {
    const noop = () => {};
    return <MyApplicationsPresentation rows={rows} loading={false} unavailable={false} message={pass > 1 ? 'Poruka' : null} notice={null} tab="all" onTab={noop}
      expanded={null} draft={null} busy={false} editingLoading={false} pending={false} canRetry={false} canReset={false}
      onRefresh={noop} onExplore={noop} onProfile={noop} onBack={noop} onReview={noop} onClose={noop} onEdit={noop} onChange={noop} onCancelEdit={noop}
      onKeep={noop} onUpdate={noop} onWithdraw={p => withdraw(p)} onAgreement={noop} onTask={p => task(p)} onRetry={noop} onReset={noop} />;
  }
  beforeEach(() => { rows = [application('x'), application('y')]; task.mockClear(); withdraw.mockClear(); });

  // This route is not keyed by account, and its own suite requires that a handle captured before an
  // account change is refused by the guards of the render that made it. So the card keeps fresh
  // handlers on purpose and it is the card's text that must not be drawn again.
  test('a parent render with fresh handler closures and a new message above the list draw no card text again; presses reach the handlers', async () => {
    await act(async () => { tree = create(<Screen pass={0} />); });
    expect(written('Unos ormara x')).toBe(1); expect(written('Unos ormara y')).toBe(1);
    await act(async () => tree.update(<Screen pass={1} />));
    await act(async () => tree.update(<Screen pass={2} />));
    expect(written('Unos ormara x')).toBe(1); expect(written('Unos ormara y')).toBe(1);
    // The card says the term once per application (and no place: the title names the task); a re-render draws it no more.
    expect(written('20. septembar')).toBe(2); expect(written('Novi Sad')).toBe(0);
    await act(async () => field('Otvori zadatak: Unos ormara y').props.onPress());
    expect(task).toHaveBeenCalledWith(rows[1]);
    // Step 5c: withdrawing is the card's quiet foot link (its own press), no longer a V2Action button inside the card,
    // so it is found by its spoken name alone.
    await act(async () => field('Povuci prijavu: Unos ormara x').props.onPress());
    expect(withdraw).toHaveBeenCalledWith(rows[0]);
    expect(list().props).toMatchObject({ initialNumToRender: 6, maxToRenderPerBatch: 6, windowSize: 7 });
    // Android FlatList detaches off-screen cells by default; the expanded review holds text inputs, so it says no.
    expect(list().props.removeClippedSubviews).toBe(false);
  });
});
