import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { brandAction } from '../../ui/system/tokens';
// The one primary action is the Press whose own surface is the brand surface (last style wins, as in React Native).
const surfaceOf = (style: unknown): unknown => Array.isArray(style) ? style.map(surfaceOf).filter(value => value !== undefined).pop()
  : style && typeof style === 'object' ? (style as { backgroundColor?: unknown }).backgroundColor : undefined;
import type { DogovorProjekcija } from '../../contracts/projections';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return ({ data, renderItem, ListEmptyComponent, ...props }: any) => React.createElement('List', props, data.length ? data.map((item: any) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))) : ListEmptyComponent);
    if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
    if (key === 'Keyboard') return { dismiss: jest.fn() };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import { MarketplacePresentation } from '../../ui/v2/MarketplacePresentation';
import { AgreementCollectionPresentation, type AgreementCollectionSection } from '../../ui/v2/AgreementCollectionPresentation';

const row = (id: string, patch = {}): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`, podrucjeTekst: 'Novi Sad', vremeTekst: 'Po dogovoru', uslovi: [], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE', ponudjenaCena: { prikaz: '2.000 RSD' }, pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, priblizno: { lat: 45.25, lng: 19.83 }, ...patch } as unknown as MarketplaceItem);
const agreement = (id: string, state: DogovorProjekcija['stanje']): DogovorProjekcija => ({
  id, verzija: 1, naslov: `Posao ${id}`, stanje: state, cena: { iznos: 2500, valuta: 'RSD', prikaz: '2.500 RSD' }, vremeTekst: 'sutra 10:00', putanjaTekst: 'Novi Sad',
  pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 }, rezim: 'FIZICKI',
  ucesnici: [{ id: 'me', profilId: null, ime: 'Ja', inicijali: 'JA', uloga: 'narucilac', mesta: null, viSte: true, telefon: null }, { id: 'o', profilId: null, ime: 'Mila', inicijali: 'MI', uloga: 'uskocer', mesta: 1, viSte: false, telefon: null }],
  kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: false, tacnaLokacija: null, emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null, izmenaCeka: null, izvor: { zadatakId: null, prijavaId: null },
});
let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const labels = () => tree.root.findAllByType('Press' as React.ElementType).map(node => node.props.accessibilityLabel);
const roleOf = (label: string) => tree.root.findAllByType('Press' as React.ElementType).find(node => node.props.accessibilityLabel === label)!.props;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

// Moji zadaci is the whole of MarketplacePresentation since owner step 4 (2026-09-24); the discovery (Zadaci) halves of
// the cases below moved with that screen to zadaci-guards-from-marketplace, which renders DiscoveryPresentation.
function Marketplace({ rows, loading = false }: { rows: MarketplaceItem[]; loading?: boolean }) {
  const [view, setView] = useState<MarketplaceView>(initialMarketplaceView);
  return <MarketplacePresentation items={rows} loading={loading} error={false} view={view} onView={setView}
    onOpen={() => {}} onRefresh={() => {}} onProfile={() => {}} onNew={() => {}} />;
}
test('the header says what the list is in the name the product uses and never an app mode; the sections are real tabs', async () => {
  // The invariant is unchanged: the title is a header, and it is never an app mode. V41 (2026-09-23): the tab header
  // draws the mark, not the section name; the name reaches a screen reader as the header's label.
  await act(async () => { tree = create(<Marketplace rows={[row('one', { stanje: 'OBJAVLJENA', brojPrijava: 0 })]} />); });
  expect(tree.root.findAll(node => node.props.accessibilityRole === 'header' && String(node.props.accessibilityLabel).includes('Moji zadaci')).length).toBeGreaterThan(0);
  expect(texts()).not.toContain('Uskoči i zaradi'); expect(texts()).not.toMatch(/Ja mogu|Meni treba/);
  expect(roleOf('Aktivni').accessibilityRole).toBe('tab');
  // The list/map switch retired with discovery here (A5): no Lista, no Mapa.
  expect(labels()).not.toContain('Lista'); expect(labels()).not.toContain('Mapa');
});
test('loading shows placeholder geometry and a spoken status, never a stale card', async () => {
  await act(async () => { tree = create(<Marketplace rows={[row('one', { stanje: 'OBJAVLJENA', brojPrijava: 0 })]} loading />); });
  expect(labels().some(label => String(label).startsWith('Otvori'))).toBe(false);
  expect(texts()).toContain('Učitavamo zadatke…');
  expect(tree.root.findAllByProps({ importantForAccessibility: 'no-hide-descendants' }).length).toBeGreaterThan(0);
});
test('an owner draft continues its editing and never draws an application count; the draft word stands in every tab', async () => {
  await act(async () => { tree = create(<Marketplace rows={[row('d', { stanje: 'NACRT', brojPrijava: 0 })]} />); });
  await act(async () => roleOf('Nacrti').onPress());
  // One task card (step 5a, 2026-09-24): a draft draws no places and no application count; its one next step is to continue it.
  const copy = texts(); expect(copy).toContain('Nastavi uređivanje'); expect(copy).not.toMatch(/prijava|0 ?\/ ?2/);
  // Plan 2.2 (owner 2026-10-07; was, review r3 item 10: "Nacrt" not repeated under Nacrti): every row wears its state as the chip, in every
  // tab, because the tab no longer stands in for it. The whole word, not the "Nacrti" tab that contains it.
  expect(tree.root.findAllByType('T' as React.ElementType).some(node => node.props.children === 'Nacrt')).toBe(true);
  expect(roleOf('Otvori zadatak Pomoć d')).toBeTruthy();
  // Where the section does not name the state, the card says it just the same.
  await act(async () => roleOf('Aktivni').onPress());
  await act(async () => tree.root.findAll(node => node.props.label === 'Prikaži sve moje zadatke')[0].props.onPress());
  expect(tree.root.findAllByType('T' as React.ElementType).some(node => node.props.children === 'Nacrt')).toBe(true);
});
test('the filter sheet offers price modes as radios and the primary action is the only brand action', async () => {
  await act(async () => { tree = create(<Marketplace rows={[row('one', { stanje: 'OBJAVLJENA', brojPrijava: 0 })]} />); });
  await act(async () => roleOf('Filteri').onPress());
  expect(roleOf('Tražim ponude').accessibilityRole).toBe('radio'); expect(roleOf('Svi načini').accessibilityState).toEqual({ checked: true });
  const brand = tree.root.findAllByType('Press' as React.ElementType).filter(node => surfaceOf(node.props.style) === brandAction.backgroundColor);
  expect(brand.map(node => node.props.accessibilityLabel)).toEqual(['Prikaži 1 zadatak']);
});

function Agreements({ rows, loading = false }: { rows: DogovorProjekcija[]; loading?: boolean }) {
  const [section, setSection] = useState<AgreementCollectionSection>('active'), [only, setOnly] = useState(false);
  return <AgreementCollectionPresentation items={rows} loading={loading} error={false} section={section} confirmationOnly={only}
    onSection={setSection} onConfirmationOnly={setOnly} onOpen={() => {}} onRefresh={() => {}} onHome={() => {}} onCalendar={() => {}} onProfile={() => {}} />;
}
test('agreements are one list for both sides, keep the accepted facts, say the side on each row and mark an open problem in words', async () => {
  const rows = [agreement('a', 'CONFIRMED'), agreement('b', 'AWAITING_REQUESTER')]; rows[1].problemOtvoren = true;
  await act(async () => { tree = create(<Agreements rows={rows} />); });
  const copy = texts();
  // A card no longer says "1 osoba" beside the one person it already shows (round-1 critique A13, owner step 8).
  expect(copy).not.toContain('Tvoje saradnje'); expect(copy).not.toMatch(/Ja mogu|Meni treba/); expect(copy).toContain('2.500 RSD'); expect(copy).not.toContain('1 osoba');
  expect(tree.root.findAll(node => node.props.accessibilityRole === 'header' && String(node.props.accessibilityLabel).includes('Dogovori')).length).toBeGreaterThan(0);
  // Each card wears one state chip (plan 2.2): "Dogovoren" for the agreed one, "Čeka potvrdu" for the one that waits for the confirmation.
  expect(copy).toContain('Dogovoren'); expect(copy).toContain('Čeka potvrdu'); expect(copy).not.toContain('Čeka se potvrda završetka');
  expect(copy).toContain('Prijavljen je problem · pogledaj Dogovor');
  // Mila is the other side of this Dogovor, so the row says what Mila did, not what I did.
  expect(copy).toContain('Mila'); expect(copy).toContain('Uskače'); expect(copy).not.toContain('Objavio si'); expect(copy).not.toContain('Uskočio');
  expect(roleOf('Aktivni').accessibilityRole).toBe('tab'); expect(labels()).toContain('Raspored'); expect(labels()).not.toContain('Kalendar obaveza');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Agreements rows={rows} />); });
  expect(texts()).not.toContain('Tvoje saradnje'); expect(labels()).toContain('Raspored');
});
test('agreements loading shows placeholders and a spoken status without private rows', async () => {
  await act(async () => { tree = create(<Agreements rows={[agreement('a', 'CONFIRMED')]} loading />); });
  expect(labels().some(label => String(label).startsWith('Otvori Dogovor'))).toBe(false); expect(texts()).toContain('Učitavamo Dogovore…');
});
