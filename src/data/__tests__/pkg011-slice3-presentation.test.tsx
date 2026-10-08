import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { brandAction } from '../../ui/system/tokens';
// The one primary action is the Press whose own surface is the brand surface (last style wins, as in React Native).
const surfaceOf = (style: unknown): unknown => Array.isArray(style) ? style.map(surfaceOf).filter(value => value !== undefined).pop()
  : style && typeof style === 'object' ? (style as { backgroundColor?: unknown }).backgroundColor : undefined;
import type { MojaPrijavaProjekcija, PrilikaProjekcija } from '../../contracts/projections';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return (props: any) => React.createElement('FlatList', props, props.ListHeaderComponent,
      props.data.length ? props.data.map((item: any) => React.createElement(React.Fragment, { key: props.keyExtractor(item) }, props.renderItem({ item }))) : props.ListEmptyComponent);
    if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import { MyApplicationsPresentation } from '../../ui/v2/MyApplicationsPresentation';
import { PublicNeedPresentation } from '../../ui/v2/PublicNeedPresentation';

let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAllByType('Press' as React.ElementType);
const labels = () => presses().map(node => node.props.accessibilityLabel);
const brand = () => presses().filter(node => surfaceOf(node.props.style) === brandAction.backgroundColor).map(node => node.props.accessibilityLabel);
const byLabel = (label: string) => presses().find(node => node.props.accessibilityLabel === label)!;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

const application = (id: string, stanje: MojaPrijavaProjekcija['stanje'], patch: Partial<MojaPrijavaProjekcija> = {}): MojaPrijavaProjekcija => ({
  prijavaId: id, potrebaId: 'need', potrebaRevizija: 2, prijavaRevizija: 2, prijavaVerzija: 1, stanje, naslov: `Unos ormara ${id}`, opis: 'Dvoje ljudi i trake.',
  cena: { iznos: 6000, valuta: 'RSD', prikaz: '6.000 RSD' }, pokrivaMesta: 2, napomena: '', podrucjeTekst: 'Novi Sad', vremeTekst: '20. septembar',
  dogovorId: stanje === 'SELECTED' ? 'agreement' : null, promenjenaPotreba: false, mozePovuci: stanje === 'SUBMITTED', traziPaznju: stanje === 'STALE_REVIEW_REQUIRED', ...patch });
const noop = () => {};
function Applications({ rows, loading = false }: { rows: MojaPrijavaProjekcija[]; loading?: boolean }) {
  return <MyApplicationsPresentation rows={rows} loading={loading} unavailable={false} message={null} notice={null} tab="all" onTab={noop}
    expanded={null} draft={null} busy={false} editingLoading={false} pending={false} canRetry={false} canReset={false}
    onRefresh={noop} onExplore={noop} onProfile={noop} onBack={noop} onReview={noop} onClose={noop} onEdit={noop} onChange={noop} onCancelEdit={noop}
    onKeep={noop} onUpdate={noop} onWithdraw={noop} onAgreement={noop} onTask={noop} onRetry={noop} onReset={noop} />;
}
test('Moje prijave names no app mode, offers tabs with counts as real tabs, and gives each application the actions its state allows', async () => {
  await act(async () => { tree = create(<Applications rows={[application('a', 'SUBMITTED'), application('b', 'SELECTED'), application('c', 'STALE_REVIEW_REQUIRED')]} />); });
  const copy = texts();
  expect(copy).toContain('Moje prijave'); expect(copy).not.toMatch(/Ja mogu|Meni treba/);
  for (const tab of ['Sve', 'Čeka te', 'Aktivne', 'Završene']) expect(byLabel(tab).props.accessibilityRole).toBe('tab');
  expect(byLabel('Sve').props.accessibilityState).toEqual({ selected: true });
  expect(copy).toContain('Poslata'); expect(copy).toContain('Izabrana'); expect(copy).toContain('Zadatak je izmenjen.'); expect(copy).toContain('6.000 RSD');
  expect(labels()).toContain('Otvori Dogovor: Unos ormara b'); expect(labels()).toContain('Povuci prijavu: Unos ormara a'); expect(labels()).toContain('Pregledaj izmene zadatka: Unos ormara c');
  // Review r4 item 1: the review foot's spoken name now starts with its visible words (WCAG 2.5.3); it was "Pregledaj izmene: …".
  // Every card is reachable as its own Task, and a list of applications spends no orange fill: the card
  // that wants you says so with its status line and its foot's orange dot (step 5c: no coloured card edge),
  // and one orange button per card would be five of them on the "Čeka te" tab. The screen's one brand
  // action lives in its empty state below.
  expect(labels()).toContain('Otvori zadatak: Unos ormara a');
  expect(brand()).toEqual([]);
});
test('Prijave loading shows placeholders and a spoken status; the empty state has one brand action', async () => {
  await act(async () => { tree = create(<Applications rows={[application('a', 'SUBMITTED')]} loading />); });
  expect(labels().some(label => String(label).startsWith('Povuci'))).toBe(false);
  // Review r4 item 9: "prijave" is lower case in the loading line, as everywhere else on the screen.
  expect(texts()).toContain('Učitavamo tvoje prijave…');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Applications rows={[]} />); });
  // Step 5c (2026-09-24) pinned the old first-run title "Tvoja sledeća prilika."; the empty state is now the one
  // StateView, in the words every list uses for its first run ("Još nemaš Dogovor", "Još nemaš Zadatak").
  expect(texts()).toContain('Još nemaš prijavu'); expect(brand()).toEqual(['Istraži zadatke']);
});

// Review r4 item 5: the states of Moje prijave that a later change could silently break.
describe('Moje prijave states', () => {
  type Overrides = Partial<React.ComponentProps<typeof MyApplicationsPresentation>>;
  const make = (patch: Overrides = {}) => <MyApplicationsPresentation rows={[]} loading={false} unavailable={false} message={null} notice={null} tab="all"
    onTab={noop} expanded={null} draft={null} busy={false} editingLoading={false} pending={false} canRetry={false} canReset={false}
    onRefresh={noop} onExplore={noop} onProfile={noop} onBack={noop} onReview={noop} onClose={noop} onEdit={noop} onChange={noop} onCancelEdit={noop}
    onKeep={noop} onUpdate={noop} onWithdraw={noop} onAgreement={noop} onTask={noop} onRetry={noop} onReset={noop} {...patch} />;
  const tabs = () => presses().filter(node => node.props.accessibilityRole === 'tab');

  test('with no application at all there are no tabs to switch between, only the first run', async () => {
    await act(async () => { tree = create(make()); });
    expect(tabs()).toHaveLength(0);
    expect(texts()).toContain('Još nemaš prijavu');
    await act(async () => tree.update(make({ rows: [application('a', 'SUBMITTED')] })));
    expect(tabs().map(node => node.props.accessibilityLabel)).toEqual(['Sve', 'Čeka te', 'Aktivne', 'Završene']);
  });

  test.each([
    ['attention', application('a', 'SUBMITTED'), 'Ništa te ne čeka'],
    ['active', application('a', 'WITHDRAWN', { mozePovuci: false }), 'Nema aktivnih prijava'],
    ['finished', application('a', 'SUBMITTED'), 'Nema završenih prijava'],
  ] as const)('an empty "%s" tab says so and leads back to all applications', async (tab, row, title) => {
    const onTab = jest.fn();
    await act(async () => { tree = create(make({ rows: [row], tab, onTab })); });
    expect(texts()).toContain(title);
    expect(labels().some(label => String(label).startsWith('Otvori zadatak'))).toBe(false);
    await act(async () => byLabel('Prikaži sve prijave').props.onPress());
    expect(onTab).toHaveBeenCalledWith('all');
  });

  // Verify r4b nit D: `busy` is a command (a write) in flight, not a read; the test's name says so now.
  test('a read that failed offers the retry and the way back, and the retry greys out while a command is in flight', async () => {
    const onRefresh = jest.fn(), onBack = jest.fn();
    await act(async () => { tree = create(make({ unavailable: true, onRefresh, onBack })); });
    expect(texts()).toContain('Prijave trenutno nisu dostupne');
    // The fallback names no cause nobody checked (review r4 item 4).
    expect(texts()).toContain('Pokušaj ponovo za trenutak.'); expect(texts()).not.toMatch(/internet/);
    expect(tabs()).toHaveLength(0);
    await act(async () => byLabel('Pokušaj ponovo').props.onPress());
    expect(onRefresh).toHaveBeenCalledTimes(1);
    // The bar's arrow and the state's quiet action both say "Nazad"; the state's is the second.
    const back = presses().filter(node => node.props.accessibilityLabel === 'Nazad');
    expect(back).toHaveLength(2);
    await act(async () => back[1].props.onPress());
    expect(onBack).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(make({ unavailable: true, busy: true, onRefresh, onBack })));
    expect(byLabel('Pokušaj ponovo').props.disabled).toBe(true);
  });

  test('a named application that has no review keeps its own foot action', async () => {
    await act(async () => { tree = create(make({ rows: [application('a', 'SUBMITTED'), application('c', 'STALE_REVIEW_REQUIRED')], expanded: 'a' })); });
    expect(labels()).toContain('Povuci prijavu: Unos ormara a');
    expect(labels()).toContain('Pregledaj izmene zadatka: Unos ormara c');
    expect(texts()).not.toContain('Aktuelni uslovi');
  });
});

const need: PrilikaProjekcija = { id: 'need', naslov: 'Selidba stana', statusTekst: 'Traži ponude', primaNovePrijave: true, rokZaPrijaveIso: null, podrucjeTekst: 'Beograd, Vračar',
  vremeTekst: 'Sutra ujutru', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: ['Kombi'], narucilacProfilId: 'profile-1', narucilacIme: 'Ana', narucilacOcena: '4,8',
  priblizno: { lat: 44.8, lng: 20.47 }, rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 9000, valuta: 'RSD', prikaz: '9.000 RSD' }, opis: 'Dva sprata bez lifta.' };
const open = jest.fn(), close = jest.fn(), apply = jest.fn(), ownTask = jest.fn(), ownApplication = jest.fn();
function Detail({ canApply = true, profile = null, relation = { kind: 'NONE' } }: { canApply?: boolean; profile?: { loading: boolean; data: any } | null;
  relation?: import('../taskRelation').TaskRelation }) {
  return <PublicNeedPresentation need={need} loading={false} error={false} missing={false} stale={false} busy={false} canApply={canApply} canRetry
    relation={relation} onOwnTask={ownTask} onOwnApplication={ownApplication}
    back={noop} retry={noop} apply={apply} onRequesterProfile={open} requesterProfile={profile} onCloseRequesterProfile={close} />;
}
beforeEach(() => { for (const mock of [open, close, apply, ownTask, ownApplication]) mock.mockClear(); });
test('the public Task leads with its title and four facts, offers the requester profile, and has exactly one brand action while applications are open', async () => {
  await act(async () => { tree = create(<Detail />); });
  const copy = texts();
  // Recomposed from zero (owner, 2026-09-23): no status box repeating what the action already says ("Traži ponude" over
  // a fixed price of 9.000 RSD said the opposite of the price). Potrebno is heard as words, not as a slash.
  expect(copy).not.toContain('Traži ponude'); expect(copy).not.toContain('Prijave su otvorene');
  expect(copy).toContain('Selidba stana'); expect(copy).toContain('9.000 RSD'); expect(copy).toContain('0/2');
  // The facts are rows with one spoken sentence each (`FactRow`), in the order the page reads: the amount, where, when, how many.
  for (const fact of ['Cena: 9.000 RSD', 'Beograd, Vračar', 'Sutra ujutru', '2 osobe, 0/2 popunjeno']) {
    expect(tree.root.findAll(node => node.props.accessibilityLabel === fact)).not.toHaveLength(0);
  }
  expect(copy).toContain('Dva sprata bez lifta.'); expect(copy).toContain('Ana'); expect(copy).toContain('Ocena 4,8');
  expect(copy).toContain('Objavio');
  expect(brand()).toEqual(['Sastavi prijavu']);
  // Owner step 5b (2026-09-24): the poster row is heard as the person it is ("Ana, Ocena 4,8") and says
  // what a press does as its hint; it was heard as "Pogledaj javni profil" alone, without the name.
  expect(byLabel('Ana, Ocena 4,8').props.accessibilityHint).toBe('Otvara javni profil');
  await act(async () => byLabel('Ana, Ocena 4,8').props.onPress()); expect(open).toHaveBeenCalledTimes(1);
  await act(async () => byLabel('Sastavi prijavu').props.onPress()); expect(apply).toHaveBeenCalledTimes(1);
  // The place is said once in the facts and once as the map section; no disclosure repeats it a third time.
  expect(labels()).not.toContain('Mesto izvršenja'); expect(copy).not.toContain('Mesto izvršenja');
});
test('a task done in one place does not repeat its place under the map; a trip shows its stops in one line', async () => {
  const one = { ...need, podrucjeTekst: 'Novi Sad', detalji: { rezimLokacije: 'STATIONARY', geografija: { mode: 'STATIONARY', start: { city: 'Novi Sad', area: 'Novi Sad' } } } } as PrilikaProjekcija;
  await act(async () => { tree = create(<PublicNeedPresentation need={one} loading={false} error={false} missing={false} stale={false} busy={false}
    canApply canRetry relation={{ kind: 'NONE' }} onOwnTask={ownTask} onOwnApplication={ownApplication} back={noop} retry={noop} apply={apply} map={<></>} />); });
  expect(texts()).not.toContain('Na jednom mestu'); expect(texts()).not.toContain('Novi Sad · Novi Sad');
  await act(async () => tree.unmount());
  const trip = { ...need, podrucjeTekst: 'Kalenić', detalji: { rezimLokacije: 'POINT_TO_POINT', geografija: { mode: 'POINT_TO_POINT', start: { area: 'Kalenić' }, end: { city: 'Užice' } } } } as PrilikaProjekcija;
  await act(async () => { tree = create(<PublicNeedPresentation need={trip} loading={false} error={false} missing={false} stale={false} busy={false}
    canApply canRetry relation={{ kind: 'NONE' }} onOwnTask={ownTask} onOwnApplication={ownApplication} back={noop} retry={noop} apply={apply} map={<></>} />); });
  expect(texts()).toContain('Od mesta do mesta'); expect(texts()).toContain('Kalenić  →  Užice');
});
test('the server deadline for applications is said beside the action, only while a person can still apply', async () => {
  const withDeadline = { ...need, rokZaPrijaveIso: '2099-09-25T16:00:00Z' };
  await act(async () => { tree = create(<PublicNeedPresentation need={withDeadline} loading={false} error={false} missing={false} stale={false} busy={false}
    canApply canRetry relation={{ kind: 'NONE' }} onOwnTask={ownTask} onOwnApplication={ownApplication} back={noop} retry={noop} apply={apply} />); });
  expect(texts()).toMatch(/Prijave do 25\. sep( 2099)? · \d\d:00/);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<PublicNeedPresentation need={withDeadline} loading={false} error={false} missing={false} stale={false} busy={false}
    canApply={false} canRetry relation={{ kind: 'NONE' }} onOwnTask={ownTask} onOwnApplication={ownApplication} back={noop} retry={noop} apply={apply} />); });
  expect(texts()).not.toContain('Prijave do');
});
test('an open price is a word addressed to the person applying, never the amount\'s dress', async () => {
  await act(async () => { tree = create(<PublicNeedPresentation need={{ ...need, rezimCene: 'OFFERS', ponudjenaCena: undefined }} loading={false} error={false}
    missing={false} stale={false} busy={false} canApply canRetry relation={{ kind: 'NONE' }} onOwnTask={ownTask} onOwnApplication={ownApplication}
    back={noop} retry={noop} apply={apply} />); });
  // The word is the worker's ("Prima ponude"), in the heading type and never in the amount's.
  const price = tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.children === 'Prima ponude')[0];
  expect(price.props.children).toBe('Prima ponude'); expect(price.props.variant).toBe('heading');
  expect(texts()).not.toContain('RSD');
  expect(texts()).not.toContain('NaN');
  expect(texts()).toContain('Ukupan iznos predlažeš u prijavi.');
});
test('closed applications remove the brand action and say so; the requester profile sheet shows loading, then only server facts, and closes', async () => {
  await act(async () => { tree = create(<Detail canApply={false} profile={{ loading: true, data: null }} />); });
  // Owner step 5b (2026-09-24): the reason is one short line beside the way on ("Drugi zadaci" when the route gives one).
  expect(brand()).toEqual([]); expect(texts()).toContain('Nove prijave trenutno nisu dostupne'); expect(texts()).toContain('Učitavamo javni profil…');
  await act(async () => tree.update(<Detail canApply={false} profile={{ loading: false, data: { profilId: 'profile-1', uloga: 'narucilac', ime: 'Ana Anić', avatarPutanja: null, grad: 'Beograd', naslov: null, biografija: 'Volim red.',
    poverenje: { ocenaProsek: 4.8, brojRecenzija: 3, zavrseniBroj: 5, identitetVerifikovan: false, ocenaDostupna: true, recenzijeDostupne: true, verifikacijaIdentitetaDostupna: false } } }} />));
  const copy = texts();
  // Step 7 (2026-09-24): the sheet wrote the raw number ("4.8"); a rating is written the Serbian way, as on every row.
  // T4b1 (2026-10-07; `FactRow`s since 2026-10-08, F6): the rating and the finished tasks are rows with one spoken sentence each ("4,8 · 3 ocene", "Završeno 5 zadataka").
  const facts = tree.root.findByProps({ testID: 'public-profile-facts' }).findAll(node => typeof node.type === 'string' && node.props.accessible === true)
    .map(node => node.props.accessibilityLabel);
  expect(copy).toContain('Ana Anić'); expect(copy).toContain('Beograd'); expect(copy).toContain('Volim red.');
  expect(facts).toEqual(['4,8 · 3 ocene', 'Završeno 5 zadataka']);
  expect(copy).not.toContain('Identitet je potvrđen');
  await act(async () => byLabel('Zatvori javni profil').props.onPress()); expect(close).toHaveBeenCalledTimes(1);
});

// Owner decision 1 (2026-09-19): the one action on a task somebody else can see is chosen by what I
// am to that task. It used to be chosen by the mode of the app, and an open task told a person
// standing in the other mode to go and change it in Profil.
test('my own task offers my view of it, never an application to myself', async () => {
  await act(async () => { tree = create(<Detail relation={{ kind: 'OWNER' }} />); });
  expect(texts()).toContain('Ovo je tvoj zadatak.'); expect(labels()).not.toContain('Sastavi prijavu');
  await act(async () => byLabel('Otvori svoj zadatak').props.onPress()); expect(ownTask).toHaveBeenCalledTimes(1); expect(apply).not.toHaveBeenCalled();
});
test('a task I applied to offers my application, and my Dogovor once I am chosen', async () => {
  await act(async () => { tree = create(<Detail relation={{ kind: 'APPLIED', applicationId: 'a1', agreementId: null }} />); });
  expect(texts()).toContain('Tvoja prijava na ovaj zadatak je već poslata.'); expect(labels()).not.toContain('Sastavi prijavu');
  await act(async () => byLabel('Pogledaj svoju prijavu').props.onPress()); expect(ownApplication).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Detail relation={{ kind: 'APPLIED', applicationId: 'a1', agreementId: 'g1' }} />); });
  expect(labels()).toContain('Otvori Dogovor');
});
test('a relation that could not be read is never treated as not applied: no application is offered, only the check again', async () => {
  await act(async () => { tree = create(<Detail relation={{ kind: 'UNKNOWN' }} />); });
  expect(labels()).not.toContain('Sastavi prijavu'); expect(labels()).toContain('Proveri ponovo');
  expect(texts()).not.toMatch(/JA MOGU|MENI TREBA|Profilu/);
});
