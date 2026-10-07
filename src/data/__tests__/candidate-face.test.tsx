import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import BottomSheet from '@gorhom/bottom-sheet';
import type { JavniProfilProjekcija, KandidatProjekcija, PotrebaProjekcija } from '../../contracts/projections';
import { sys } from '../../ui/system/tokens';

/**
 * Incoming applications and choosing a candidate (owner's step 7, 2026-09-24; the shared PrijavaCard since 2026-10-07). An
 * application is chosen as a person first, so its card leads with the state (the app's one chip), then the person — their
 * picture, name and the rating with the count it stands on — and then the facts in the one fixed order: the term, the price,
 * the people, their message; nothing on it is invented. Two applications are compared side by side only while each column
 * has at least 200 dp and a text size under Large, read rounded because Android hands Large over as 1.2999999523). The
 * application and the public profile are sheets of the one sheet engine, and the profile keeps its report-or-block entry.
 */
let mockWidth = 390, mockFontScale = 1;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  const Modal = ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
  const FlatList = (props: any) => React.createElement('FlatList', props, props.ListHeaderComponent,
    ...(props.data.length ? props.data.map((item: any, index: number) =>
      React.createElement(React.Fragment, { key: props.keyExtractor(item) }, props.renderItem({ item, index }))) : [props.ListEmptyComponent]),
    props.ListFooterComponent);
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return Modal;
    if (key === 'FlatList') return FlatList;
    if (key === 'useWindowDimensions') return () => ({ width: mockWidth, height: 800, scale: 2, fontScale: mockFontScale });
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
import { CandidateListPresentation, CandidateSelectionPresentation } from '../../ui/v2/ApplicationSelectionPresentation';
import { UNPRICED, candidateChip, candidateSpoken, candidateStatus, candidateTerm, candidateTrust, candidateValue, compareIdentityHeight, requesterPrijava } from '../../ui/v2/CandidateFace';
import { PublicProfileSheet } from '../../ui/system/PublicProfileSheet';
import { SuccessMark } from '../../ui/system/SuccessMark';

const need = { id: 'need-1', revizija: 3, naslov: 'Unos ormara', podrucjeTekst: 'Liman 2, Novi Sad', vremeTekst: '20. sep · 10:00–11:00', stanje: 'CEKA_PRIJAVE',
  pokrivenost: { ukupno: 3, preostalo: 3, popunjeno: 0, udeo: 0 }, rezimCene: 'OFFERS', taskTimezone: 'Europe/Belgrade' } as unknown as PotrebaProjekcija;
const k = (patch: Partial<KandidatProjekcija> = {}): KandidatProjekcija => ({ prijavaId: 'application-1', radnikProfilId: 'profile-1', potrebaRevizija: 3,
  verzija: 2, hash: 'a'.repeat(64), ime: 'Milan Petrović', inicijali: 'MP', ocenaTekst: '4,8', recenzijeTekst: '11 ocena',
  cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' }, pokrivaMesta: 2, preostaloMesta: 3, dolazakTekst: '', prevozTekst: '',
  napomena: 'Dolazimo sa trakama i kombijem.', stanje: 'SELECTABLE', mozeIzabrati: true, predlozeniPocetak: null, predlozeniKraj: null,
  dokazPrijave: { sema: 'APPLICATION_V1_SELF_DECLARED', kapacitetTima: 2, vestine: [], alati: ['Trake'], vozila: ['Kombi'], licence: [] }, razlogPreporuke: null, ...patch });

let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
afterEach(async () => { await act(async () => tree?.unmount()); mockWidth = 390; mockFontScale = 1; });
const noop = () => {};
const list = (candidates: KandidatProjekcija[]) => <CandidateListPresentation need={need} candidates={candidates} open={noop} back={noop} refresh={noop} />;
const texts = (root: ReactTestInstance = tree.root) => root.findAll(node => node.type === ('T' as unknown as React.ElementType))
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const pressNamed = (label: string) => tree.root.findAll(node => node.type === ('Press' as unknown as React.ElementType) && node.props.accessibilityLabel === label)[0];
/** The confirmation's own confirm: it shares its words with the green button that asked, so it is found by its testID. */
const confirmButton = () => tree.root.findAll(node => node.type === ('Press' as unknown as React.ElementType) && node.props.testID === 'confirm-sheet-confirm')[0];
const flat = (style: unknown) => Object.assign({}, ...[style].flat(4).filter(Boolean));
const stars = (root: ReactTestInstance) => root.findAll(node => node.type === ('FactArt' as unknown as React.ElementType) && node.props.kind === 'star');

describe('the candidate row', () => {
  it('leads with the state, then the person, then the term, the price, the people and the message, in one press', async () => {
    const opened: string[] = [];
    await act(async () => { tree = create(<CandidateListPresentation need={need} candidates={[k()]} open={candidate => opened.push(candidate.prijavaId)}
      back={noop} refresh={noop} />); });
    const row = pressNamed('Pogledaj prijavu: Milan Petrović');
    // Tree order is reading order: the state, the Avatar, the name, the rating, then the term, the amount and its basis, the people.
    const order = row.findAll(node => node.type === ('Avatar' as unknown as React.ElementType)
      || (node.type === ('T' as unknown as React.ElementType) && typeof node.props.children === 'string'))
      .map(node => node.type === ('Avatar' as unknown as React.ElementType) ? `avatar:${node.props.initials}` : node.props.children);
    // The rating line keeps its count whole when it wraps: no-break spaces inside the count and before the dot.
    expect(order).toEqual(['Poslata', 'avatar:MP', 'Milan Petrović', '4,8 · 11 ocena', '20. sep · 10:00–11:00', '4.500 RSD', 'ukupno', '2 osobe',
      'Dolazimo sa trakama i kombijem.']);
    const amount = row.findAll(node => node.props.children === '4.500 RSD')[0];
    expect(flat(amount.props.style).color).toBe(sys.color.money);
    // The full message is visible on the recomposed row, without a two-line clamp.
    expect(row.findAll(node => node.props.children === 'Dolazimo sa trakama i kombijem.')[0].props.numberOfLines).toBeUndefined();
    // No proposed interval: the term row is the task's own term, unmarked (the cards that differ are the proposals).
    expect(texts(row)).not.toContain('Predlog');
    // Essential facts remain available when the person has disabled screen-reader hints.
    expect(row.props.accessibilityValue.text).toBe('Poslata. Ocena 4,8, 11 ocena. Termin: 20. sep · 10:00–11:00. Ponuda: 4.500 RSD ukupno. 2 osobe. '
      + 'Poruka: „Dolazimo sa trakama i kombijem.“. Otvori prijavu za celu poruku.');
    expect(row.props.accessibilityHint).toBe('Otvara celu prijavu.');
    // One target: nothing inside the card is a press of its own, and the chip is not a stop of its own.
    expect(row.findAll(node => node.type === ('Press' as unknown as React.ElementType))).toHaveLength(1);
    expect(row.findAll(node => node.props.importantForAccessibility === 'no-hide-descendants' && node.props.accessibilityElementsHidden === true).length).toBeGreaterThan(0);
    await act(async () => row.props.onPress()); expect(opened).toEqual(['application-1']);
  });

  it('shows a proposed interval in Serbian time as the person\'s own proposal, and says why an application that cannot simply be chosen cannot', async () => {
    await render(list([k({ predlozeniPocetak: '2026-09-20T08:00:00Z', predlozeniKraj: '2026-09-20T09:00:00Z', stanje: 'STALE', mozeIzabrati: false })]));
    const row = pressNamed('Pogledaj prijavu: Milan Petrović');
    expect(texts(row)).toMatch(/Predlog: 20\. sep( 2026)? · 10:00–11:00/);
    // The state is still the one it was ("Poslata"); the line under it says what is new, in the warn colour.
    expect(texts(row).startsWith('Poslata Zadatak je izmenjen. Čekamo da osoba potvrdi prijavu.')).toBe(true);
    const status = row.findAll(node => node.props.children === 'Zadatak je izmenjen. Čekamo da osoba potvrdi prijavu.')[0];
    expect(flat(status.props.style).color).toBe(sys.color.warn);
    expect(row.props.accessibilityValue.text).toContain('Zadatak je izmenjen. Čekamo da osoba potvrdi prijavu.');
  });

  it('gives every application a state, in the owner\'s five words, and "Viđena" only once the server confirmed the view', async () => {
    const WORDS: [KandidatProjekcija['stanje'], string, string][] = [['SELECTABLE', 'Poslata', 'Viđena'], ['STALE', 'Poslata', 'Viđena'], ['OVERFILL', 'Poslata', 'Viđena'],
      ['SELECTED', 'Izabrana', 'Izabrana'], ['WITHDRAWN', 'Povučena', 'Povučena'], ['CLOSED', 'Nije izabrana', 'Nije izabrana'], ['FULL', 'Nije izabrana', 'Nije izabrana']];
    const chipWord = (row: ReactTestInstance) => row.findAll(node => node.type === ('View' as unknown as React.ElementType) && node.props.testID === 'status-chip')
      .map(node => node.props.accessibilityLabel);
    for (const [stanje, word, seen] of WORDS) {
      const application = k({ stanje, mozeIzabrati: stanje === 'SELECTABLE' });
      await render(<CandidateListPresentation need={need} candidates={[application]} open={noop} back={noop} refresh={noop} />);
      expect([stanje, chipWord(pressNamed('Pogledaj prijavu: Milan Petrović'))]).toEqual([stanje, [word]]);
      await act(async () => tree.update(<CandidateListPresentation need={need} candidates={[application]} open={noop} back={noop} refresh={noop}
        viewed={new Set(['application-1'])} />));
      expect([stanje, chipWord(pressNamed('Pogledaj prijavu: Milan Petrović'))]).toEqual([stanje, [seen]]);
      await act(async () => tree.unmount());
    }
    expect(new Set(WORDS.flatMap(([, word, seen]) => [word, seen]))).toEqual(new Set(['Poslata', 'Viđena', 'Izabrana', 'Nije izabrana', 'Povučena']));
    expect([candidateChip({ stanje: 'SELECTABLE' }), candidateChip({ stanje: 'SELECTABLE' }, true)]).toEqual(['application.sent', 'application.seen']);
  });

  it('builds the one model both lists draw, with only what the read carried', () => {
    const model = requesterPrijava(k({ napomena: '  ' }), { timezone: 'Europe/Belgrade', taskTerm: 'Sutra, fleksibilno', viewed: true, avatar: null });
    expect(model).toMatchObject({ status: 'application.seen', reason: null, term: 'Sutra, fleksibilno', people: '2 osobe', message: null,
      price: { kind: 'amount', amount: '4.500 RSD', basis: 'ukupno' }, who: { kind: 'person', name: 'Milan Petrović' } });
    expect(candidateTerm({ predlozeniPocetak: null, predlozeniKraj: null }, null, 'Sutra, fleksibilno')).toBe('Sutra, fleksibilno');
    expect(candidateTerm({ predlozeniPocetak: '2026-09-20T08:00:00Z', predlozeniKraj: '2026-09-20T09:00:00Z' }, 'Europe/Belgrade', 'x'))
      .toMatch(/^Predlog: 20\. sep( 2026)? · 10:00–11:00/);
    // An interval that is not one (the end before the start) is no proposal: the task's own term applies.
    expect(candidateTerm({ predlozeniPocetak: '2026-09-20T09:00:00Z', predlozeniKraj: '2026-09-20T08:00:00Z' }, 'Europe/Belgrade', 'Sutra, fleksibilno')).toBe('Sutra, fleksibilno');
    expect(candidateSpoken(k({ napomena: '' }), 'Sutra, fleksibilno', 'Europe/Belgrade'))
      .toBe('Poslata. Ocena 4,8, 11 ocena. Termin: Sutra, fleksibilno. Ponuda: 4.500 RSD ukupno. 2 osobe.');
  });

  it('says the reason only where the chip cannot: an application that is open, chosen or withdrawn needs none', () => {
    expect(candidateStatus({ stanje: 'SELECTABLE' })).toBeNull();
    expect(candidateStatus({ stanje: 'SELECTED' })).toBeNull();
    expect(candidateStatus({ stanje: 'WITHDRAWN' })).toBeNull();
    expect(candidateStatus({ stanje: 'STALE' })).toEqual({ text: 'Zadatak je izmenjen. Čekamo da osoba potvrdi prijavu.', tone: 'warn' });
    expect(candidateStatus({ stanje: 'OVERFILL' })).toEqual({ text: 'Više ljudi nego što je preostalo', tone: 'warn' });
    expect(candidateStatus({ stanje: 'CLOSED' })).toEqual({ text: 'Zadatak je zatvoren', tone: 'muted' });
    expect(candidateStatus({ stanje: 'FULL' })).toEqual({ text: 'Sva mesta su popunjena', tone: 'muted' });
  });

  it('never invents a rating or a count: a star only beside a figure, and a missing rating says it is missing', async () => {
    expect(candidateTrust({ ocenaTekst: '—', recenzijeTekst: '' })).toEqual({ star: false, text: 'Ocena nije dostupna', spoken: 'ocena nije dostupna' });
    expect(candidateTrust({ ocenaTekst: '—', recenzijeTekst: '3 završena zadatka' }).text).toBe('Ocena nije dostupna · 3 završena zadatka');
    expect(candidateTrust({ ocenaTekst: '4,8', recenzijeTekst: '' })).toEqual({ star: true, text: '4,8', spoken: 'ocena 4,8' });
    // The count is said in the words of the rating ("4,7 · 3 ocene"), and a counted zero is news, not an unavailable rating.
    expect(candidateTrust({ ocenaTekst: '4,7', recenzijeTekst: '3 ocene' })).toEqual({ star: true, text: '4,7 · 3 ocene', spoken: 'ocena 4,7, 3 ocene' });
    expect(candidateTrust({ ocenaTekst: '—', recenzijeTekst: '0 ocena' })).toEqual({ star: false, text: 'Još nema ocena', spoken: 'još nema ocena' });
    // A word where a figure should be ("Novo") is not a rating and gets no star.
    expect(candidateTrust({ ocenaTekst: 'Novo', recenzijeTekst: 'Nema ocena' }).star).toBe(false);
    await render(list([k({ prijavaId: 'a', ime: 'Ana', ocenaTekst: '—', recenzijeTekst: '' }), k({ prijavaId: 'b', ime: 'Bojan', ocenaTekst: '4,8', recenzijeTekst: '' })]));
    const ana = pressNamed('Pogledaj prijavu: Ana'), bojan = pressNamed('Pogledaj prijavu: Bojan');
    expect(stars(ana)).toHaveLength(0);
    expect(texts(ana)).toContain('Ocena nije dostupna'); expect(texts(ana)).not.toMatch(/recenzij|završen|\(\d+\)/);
    expect(stars(bojan)).toHaveLength(1);
    expect(bojan.findAll(node => node.props.children === '4,8')).toHaveLength(1); expect(texts(bojan)).not.toMatch(/recenzij|\(\d+\)/);
  });

  it('keeps the currency on an amount and never dresses a missing price as money: "Iznos nije sačuvan"', async () => {
    expect(candidateValue({ cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500' }, pokrivaMesta: 1 }))
      .toEqual({ kind: 'amount', amount: '4.500 RSD', basis: 'ukupno' });
    expect(candidateValue({ cena: { iznos: 0, valuta: 'RSD', prikaz: '' }, pokrivaMesta: 1 })).toEqual({ kind: 'unpriced' });
    expect(UNPRICED).toBe('Iznos nije sačuvan');
    await render(list([k({ cena: { iznos: 0, valuta: 'RSD', prikaz: '' } })]));
    const row = pressNamed('Pogledaj prijavu: Milan Petrović');
    const word = row.findAll(node => node.props.children === 'Iznos nije sačuvan')[0];
    expect(flat(word.props.style)).toMatchObject({ color: sys.color.muted });
    expect(flat(word.props.style).fontWeight).not.toBe('700');
    // No figure, no currency, no "ukupno": and never the old words for it.
    expect(texts(row)).not.toMatch(/RSD|ukupno|Cena nije navedena/);
    expect(row.props.accessibilityValue.text).toContain('Iznos nije sačuvan');
  });

  it('requests the portrait at the size of its stand-in in both list and comparison', async () => {
    const photo = jest.fn((_candidate: KandidatProjekcija, _size: number) => null);
    await render(<CandidateListPresentation need={need} candidates={[k(), k({ prijavaId: 'application-2' })]}
      open={noop} back={noop} refresh={noop} photo={photo} />);
    expect(photo.mock.calls.map(call => call[1])).toEqual([56, 56]);
    expect(tree.root.findAll(node => node.type === ('Avatar' as unknown as React.ElementType)).map(node => node.props.size)).toEqual([56, 56]);
    photo.mockClear();
    await act(async () => pressNamed('Uporedi').props.onPress());
    expect(photo.mock.calls.map(call => call[1])).toEqual([40, 40]);
    expect(tree.root.findAll(node => node.type === ('Avatar' as unknown as React.ElementType)).map(node => node.props.size)).toEqual([40, 40]);
    expect(pressNamed('Otvori prijavu: Milan Petrović').props.accessibilityValue.text).toContain('Ponuda: 4.500 RSD ukupno. 2 osobe');
  });

  it('keeps long terms separate from the name and lets the price and the people wrap at enlarged text', async () => {
    mockWidth = 320; mockFontScale = 2;
    await render(list([k({ ime: 'Aleksandra Stefanović-Radosavljević', pokrivaMesta: 123,
      cena: { iznos: 125000, valuta: 'RSD', prikaz: '125.000 RSD' } })]));
    const row = pressNamed('Pogledaj prijavu: Aleksandra Stefanović-Radosavljević');
    const amount = row.findAll(node => node.props.children === '125.000 RSD')[0];
    const basis = row.findAll(node => node.props.children === 'ukupno')[0];
    const people = row.findAll(node => node.props.children === '123 osobe')[0];
    expect(amount.props.numberOfLines).toBeUndefined(); expect(basis.props.numberOfLines).toBeUndefined(); expect(people.props.numberOfLines).toBeUndefined();
    expect(flat(amount.parent!.props.style).flexDirection).toBe('column');
    expect(texts(amount.parent!)).not.toContain('Aleksandra');
    expect(row.props.accessibilityValue.text).toContain('Ponuda: 125.000 RSD ukupno. 123 osobe');
  });

  it('draws the empty list as the one empty state, saying what happens next without promising anyone will apply', async () => {
    await render(list([]));
    expect(texts()).toContain('Još nema prijava');
    // Review r4 rk item 8: comparing needs two applications, so the empty list no longer promises it ("… i moći ćeš da je
    // uporediš pre izbora" was pinned here). It speaks of the application, not of "ponuda" (plan 2.12).
    expect(texts()).toContain('Kad neko pošalje prijavu za ovaj zadatak, videćeš je ovde.');
    expect(texts()).not.toContain('uporediš');
    expect(pressNamed('Osveži prijave')).toBeDefined();
  });
});

// Review r4 rk item 6: two columns hold their head to the height of the fullest one (the 40 px picture, a three-line name, a
// two-line rating, the state's 24 px chip and a two-line reason, with their gaps), at the text size in use.
it('holds a comparison header to the full name, rating, state and reason height', () => {
  expect(compareIdentityHeight(1)).toBe(40 + 3 * 6 + 8 + 3 * 21 + 2 * 20 + 24 + 2 * 20);
  expect(compareIdentityHeight(1.2)).toBe(Math.ceil(40 + 3 * 6 + 8 + (3 * 21 + 2 * 20 + 24 + 2 * 20) * 1.2));
  expect(compareIdentityHeight(1)).toBeGreaterThan(132);
});

describe('the comparison', () => {
  const columns = () => tree.root.findAll(node => node.type === ('FlatList' as unknown as React.ElementType))[0].props.numColumns;
  const compare = async () => { await act(async () => pressNamed('Uporedi').props.onPress()); };
  const two = [k({ stanje: 'WITHDRAWN', mozeIzabrati: false }), k({ prijavaId: 'application-2', ime: 'Ana Jovanović', inicijali: 'AJ', cena: { iznos: 3900, valuta: 'RSD', prikaz: '3.900 RSD' } })];

  it.each([
    ['the actual 361 dp phone at 1.15', 361, 1.15, 1],
    ['a 390 dp phone at normal text', 390, 1, 1],
    ['one dp below the two-column boundary', 451, 1, 1],
    ['two columns of exactly 200 dp', 452, 1, 2],
    ['just under Large with enough column width', 452, 1.29, 2],
    ['Android Large as it arrives (1.2999999523)', 452, 1.2999999523, 1],
    ['a 359 dp phone', 359, 1, 1],
  ])('follows the rounded text scale and the width: %s', async (_name, width, fontScale, expected) => {
    mockWidth = width; mockFontScale = fontScale;
    await render(list(two));
    await compare();
    expect(columns()).toBe(expected);
    expect(pressNamed('Otvori prijavu: Ana Jovanović')).toBeDefined();
    // Every column wears the state as the same chip, before its cells; the cells come in the card's order: term, offer, people.
    const withdrawn = texts(pressNamed('Otvori prijavu: Milan Petrović'));
    expect(withdrawn.split('Povučena')).toHaveLength(2);
    expect(withdrawn.indexOf('Povučena')).toBeLessThan(withdrawn.indexOf('Termin'));
    expect(withdrawn.indexOf('Termin')).toBeLessThan(withdrawn.indexOf('Ponuda'));
    expect(withdrawn.indexOf('Ponuda')).toBeLessThan(withdrawn.indexOf('Ljudi'));
    expect(withdrawn.indexOf('Ljudi')).toBeLessThan(withdrawn.indexOf('Poruka'));
    const ana = texts(pressNamed('Otvori prijavu: Ana Jovanović'));
    expect(ana).not.toContain('Povučena');
    // The person leads and the state follows them, in a comparison column.
    expect(ana.indexOf('Ana Jovanović')).toBeLessThan(ana.indexOf('Poslata'));
    expect(ana.indexOf('Poslata')).toBeLessThan(ana.indexOf('Termin'));
  });

  it('compares the same cells in the same rows and says a missing price in words, not as an amount', async () => {
    mockWidth = 452;
    await render(list([...two, k({ prijavaId: 'application-3', ime: 'Nikola Ilić', inicijali: 'NI', cena: { iznos: 0, valuta: 'RSD', prikaz: '' }, napomena: '' })]));
    await compare();
    const cells = (name: string) => pressNamed(`Otvori prijavu: ${name}`).findAll(node => node.type === ('T' as unknown as React.ElementType)
      && ['Termin', 'Ponuda', 'Ljudi', 'Poruka'].includes(node.props.children)).map(node => node.props.children);
    expect(cells('Milan Petrović')).toEqual(['Termin', 'Ponuda', 'Ljudi', 'Poruka']);
    expect(cells('Ana Jovanović')).toEqual(['Termin', 'Ponuda', 'Ljudi', 'Poruka']);
    // A column with no message has no "Poruka" cell, and a price that was not stored is a quiet word under "Ponuda".
    expect(cells('Nikola Ilić')).toEqual(['Termin', 'Ponuda', 'Ljudi']);
    const nikola = pressNamed('Otvori prijavu: Nikola Ilić');
    expect(texts(nikola)).toContain('Iznos nije sačuvan'); expect(texts(nikola)).not.toMatch(/RSD|Cena nije navedena/);
    expect(texts(pressNamed('Otvori prijavu: Ana Jovanović'))).toContain('3.900 RSD ukupno');
    // The term is the task's own unless the person proposed one, and a proposal says so.
    expect(texts(nikola)).toContain('20. sep · 10:00–11:00');
    await act(async () => tree.update(list([k({ predlozeniPocetak: '2026-09-20T08:00:00Z', predlozeniKraj: '2026-09-20T09:00:00Z' }),
      k({ prijavaId: 'application-2', ime: 'Ana Jovanović' })])));
    expect(texts(pressNamed('Otvori prijavu: Milan Petrović'))).toMatch(/Predlog: 20\. sep( 2026)? · 10:00–11:00/);
    expect(texts(pressNamed('Otvori prijavu: Ana Jovanović'))).not.toContain('Predlog');
  });

  it('gives a lone last offer the width of one column, not the whole row', async () => {
    mockWidth = 500;
    await render(list([...two, k({ prijavaId: 'application-3', ime: 'Nikola Ilić', inicijali: 'NI' })]));
    await compare();
    // (500 − 2 × 20 side padding − 12 gap) / 2 = 224, including the third offer alone on its row.
    const widths = tree.root.findAll(node => node.type === ('View' as unknown as React.ElementType) && flat(node.props.style).width === 224);
    expect(widths).toHaveLength(3);
  });

  it.each([
    ['at Large', 390, 1.2999999523, 'left'],
    ['on a 320 dp phone', 320, 1, 'left'],
    ['below the person on a 390 dp phone at normal text', 390, 1, 'left'],
  ])('places the total %s', async (_name, width, fontScale, align) => {
    mockWidth = width; mockFontScale = fontScale;
    await render(list([k()]));
    const row = pressNamed('Pogledaj prijavu: Milan Petrović');
    const amount = row.findAll(node => node.props.children === '4.500 RSD')[0];
    expect(flat(amount.props.style).textAlign).toBe(align);
  });
});

describe('the offer sheet', () => {
  const offer = (patch: Partial<React.ComponentProps<typeof CandidateSelectionPresentation>> = {}) =>
    <CandidateSelectionPresentation need={need} candidate={k()} back={noop} publicProfile={async () => null} choose={noop} busy={false}
      pending={false} uncertain={false} refresh={noop} error={null} confirmed={false} openAgreement={noop}
      readAgreement={async () => ({ ok: true, podatak: { dogovorId: null } })} openLinkedAgreement={noop} {...patch} />;
  const green = () => tree.root.findAll(node => node.type === ('Press' as unknown as React.ElementType)
    && flat(node.props.style).backgroundColor === sys.color.green).map(node => node.props.accessibilityLabel);

  it('is a sheet of the one engine with one green action that asks before it chooses', async () => {
    const choose = jest.fn();
    await render(offer({ choose }));
    expect(tree.root.findAllByType(BottomSheet)).toHaveLength(1);
    expect(green()).toEqual(['Izaberi ovu prijavu']);
    await act(async () => pressNamed('Izaberi ovu prijavu').props.onPress());
    // A question (a verb and a question mark) and under it what is accepted and what follows (plan 2.3), in a centred dialog.
    expect(choose).not.toHaveBeenCalled(); expect(texts()).toContain('Izabrati ovu prijavu?');
    expect(texts()).toContain('Prihvataš: 4.500 RSD ukupno · 2 osobe · 20. sep · 10:00–11:00. Dogovor odmah važi za obe strane. Termin izabrane osobe ponovo se proverava pri izboru.');
    expect(tree.root.findAll(node => node.props.testID === 'confirm-dialog')).toHaveLength(1);
    // Review r4 rk item 5: the confirm says the button's own words (it said "Izaberi ovu Prijavu").
    expect(confirmButton().props.accessibilityLabel).toBe('Izaberi ovu prijavu');
    await act(async () => confirmButton().props.onPress());
    expect(choose).toHaveBeenCalledTimes(1);
  });

  it('names the term that applies in the question: the person\'s own proposal, or else the task\'s', async () => {
    await render(offer({ candidate: k({ predlozeniPocetak: '2026-09-20T08:00:00Z', predlozeniKraj: '2026-09-20T09:00:00Z' }) }));
    await act(async () => pressNamed('Izaberi ovu prijavu').props.onPress());
    // On a phone that is not in Serbian time the term says so ("po vremenu u Srbiji"); in Serbian time it does not need to.
    expect(texts()).toMatch(/Prihvataš: 4\.500 RSD ukupno · 2 osobe · 20\. sep( 2026)? · 10:00–11:00( \(po vremenu u Srbiji\))?\. Dogovor odmah važi/);
  });

  // Review r4 rk item 9: a question asked about one exact application is retired the moment that application changes.
  it('retires an open question when the application changes, and the old question cannot choose', async () => {
    const choose = jest.fn();
    await render(offer({ choose }));
    await act(async () => pressNamed('Izaberi ovu prijavu').props.onPress());
    const retained = confirmButton().props.onPress;
    await act(async () => tree.update(offer({ choose, candidate: k({ verzija: 3 }) })));
    expect(tree.root.findAll(node => node.props.testID === 'confirm-sheet-confirm')).toHaveLength(0);
    await act(async () => retained());
    expect(choose).not.toHaveBeenCalled();
  });

  // Review r4 rk item 3: the name is the sheet's title — a real heading with the sheet's own × — and the row under it
  // keeps the picture and the rating, saying the name only to a screen reader.
  it('is titled with the person, with a visible close, and the profile row no longer repeats the name', async () => {
    const back = jest.fn();
    await render(offer({ back }));
    expect(tree.root.findAll(node => node.props.accessibilityRole === 'header' && node.props.children === 'Milan Petrović')).toHaveLength(1);
    const person = tree.root.findAll(node => node.type === ('Press' as unknown as React.ElementType) && node.props.accessibilityHint === 'Otvara javni profil')[0];
    expect(person.props.accessibilityLabel).toMatch(/^Milan Petrović, /);
    expect(texts(person)).not.toContain('Milan Petrović');
    // Verify r4c item 3: the row has a visible word, so it never reads as a dead row or a link to the rating.
    expect(texts(person)).toContain('Pogledaj profil');
    expect(person.findAll(node => node.props.accessibilityRole === 'header')).toHaveLength(0);
    expect(pressNamed('Zatvori prijavu')).toBeDefined();
  });

  it('says the state with the same chip as the card, and "Viđena" only when the view was confirmed', async () => {
    const chips = () => tree.root.findAll(node => node.type === ('View' as unknown as React.ElementType) && node.props.testID === 'status-chip')
      .map(node => node.props.accessibilityLabel);
    await render(offer());
    expect(chips()).toEqual(['Poslata']);
    await act(async () => tree.update(offer({ viewed: true })));
    expect(chips()).toEqual(['Viđena']);
    // The chip of the sheet is read (nothing else on the sheet says the state): it is not hidden from a screen reader.
    const chip = tree.root.findAll(node => node.type === ('View' as unknown as React.ElementType) && node.props.testID === 'status-chip')[0];
    let node: ReactTestInstance | null = chip, hidden = false;
    while (node) { if (node.props.importantForAccessibility === 'no-hide-descendants') hidden = true; node = node.parent; }
    expect(hidden).toBe(false);
    await act(async () => tree.update(offer({ candidate: k({ stanje: 'WITHDRAWN', mozeIzabrati: false }) })));
    expect(chips()).toEqual(['Povučena']);
    await act(async () => tree.update(offer({ candidate: k({ stanje: 'CLOSED', mozeIzabrati: false }) })));
    expect(chips()).toEqual(['Nije izabrana']); expect(texts()).toContain('Zadatak je zatvoren');
    await act(async () => tree.update(offer({ candidate: k({ stanje: 'SELECTED', mozeIzabrati: false }) })));
    expect(chips()).toEqual(['Izabrana']);
  });

  // Review r4 rk item 2: an outcome that was already confirmed when the sheet opened stands still (no spring, no haptic).
  it('plays the success mark only for a choice confirmed while the sheet is open', async () => {
    await render(offer({ confirmed: true }));
    expect(tree.root.findByType(SuccessMark).props.fresh).toBe(false);
    await act(async () => tree.unmount());
    await render(offer());
    await act(async () => tree.update(offer({ confirmed: true })));
    expect(tree.root.findByType(SuccessMark).props.fresh).toBe(true);
  });

  it('has no green action for an offer that cannot be chosen, and says why beside the one thing to do', async () => {
    const refresh = jest.fn();
    await render(offer({ candidate: k({ stanje: 'OVERFILL', mozeIzabrati: false }), refresh }));
    expect(green()).toEqual([]);
    expect(texts()).toContain('Više ljudi nego što je preostalo');
    await act(async () => pressNamed('Osveži prijave').props.onPress()); expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the exact full note and total-for-people terms on the offer while selection still waits for confirmation', async () => {
    const note = `  ${'Donosimo trake i zaštitu za nameštaj. '.repeat(12)}\nPozovite pre dolaska.  `;
    const choose = jest.fn();
    await render(offer({ candidate: k({ napomena: note }), choose }));
    const full = tree.root.findAll(node => node.type === ('T' as unknown as React.ElementType) && node.props.children === note)[0];
    expect(full.props.selectable).toBe(true); expect(full.props.numberOfLines).toBeUndefined();
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Ukupno za 2 osobe: 4.500 RSD')).toHaveLength(1);
    await act(async () => pressNamed('Izaberi ovu prijavu').props.onPress());
    expect(choose).not.toHaveBeenCalled();
    expect(texts()).toContain('Prihvataš: 4.500 RSD ukupno · 2 osobe · 20. sep · 10:00–11:00.');
    expect(texts()).toContain('Termin izabrane osobe ponovo se proverava pri izboru.');
  });
});

describe('the public profile sheet', () => {
  const profile = (): JavniProfilProjekcija => ({ profilId: 'profile-1', uloga: 'radnik', ime: 'Marko Marković', avatarPutanja: null, grad: 'Novi Sad',
    naslov: null, biografija: null, poverenje: { ocenaProsek: null, brojRecenzija: 0, zavrseniBroj: 2, identitetVerifikovan: false,
      ocenaDostupna: false, recenzijeDostupne: true, verifikacijaIdentitetaDostupna: false } } as unknown as JavniProfilProjekcija);

  it('is a sheet of the one engine titled with the name, and keeps its report-or-block entry with its states', async () => {
    const onPress = jest.fn(), onClose = jest.fn();
    await render(<PublicProfileSheet state={{ loading: false, data: profile() }} onClose={onClose} onRetry={noop} safety={{ onPress, busy: false, error: null }} />);
    expect(tree.root.findAllByType(BottomSheet)).toHaveLength(1);
    expect(texts()).toContain('Marko Marković'); expect(texts()).toContain('Još nema ocena'); expect(texts()).not.toContain('Javni profil');
    const entry = pressNamed('Prijavi ili blokiraj osobu: Marko Marković');
    expect(texts(entry)).toContain('Prijavi ili blokiraj osobu');
    await act(async () => entry.props.onPress()); expect(onPress).toHaveBeenCalledTimes(1);
    await act(async () => pressNamed('Zatvori javni profil').props.onPress()); expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data: profile() }} onClose={onClose} onRetry={noop}
      safety={{ onPress, busy: true, error: 'Korisnik trenutno nije dostupan.' }} />));
    const busy = pressNamed('Prijavi ili blokiraj osobu: Marko Marković');
    expect(busy.props.disabled).toBe(true); expect(texts(busy)).toContain('Otvaramo…');
    expect(tree.root.findAll(node => node.props.accessibilityRole === 'alert' && node.props.children === 'Korisnik trenutno nije dostupan.')).toHaveLength(1);
  });

  it('loads and fails the one way every screen does', async () => {
    const onRetry = jest.fn();
    await render(<PublicProfileSheet state={{ loading: true, data: null }} onClose={noop} onRetry={onRetry} />);
    expect(texts()).toContain('Učitavamo javni profil…');
    await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data: null }} onClose={noop} onRetry={onRetry} />));
    expect(texts()).toContain('Javni profil trenutno nije dostupan.');
    await act(async () => pressNamed('Pokušaj ponovo').props.onPress()); expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps the public portrait consistent with initials, and does not turn unavailable trust into a claim', async () => {
    const data = profile();
    data.poverenje = { ...data.poverenje, ocenaProsek: 4.9, brojRecenzija: 27, identitetVerifikovan: true,
      ocenaDostupna: false, recenzijeDostupne: false, verifikacijaIdentitetaDostupna: false };
    const photo = jest.fn((_id: string, _size?: number) => null);
    await render(<PublicProfileSheet state={{ loading: false, data }} onClose={noop} onRetry={noop} photo={photo} />);
    expect(photo).toHaveBeenCalledWith('profile-1', 96);
    // (T4b1, 2026-10-07: the rating is a row with its picture; "Ocena nije dostupna" says so.)
    expect(texts()).toContain('Ocena nije dostupna'); expect(texts()).not.toContain('4,9'); expect(texts()).not.toContain('27 ocena');
    expect(texts()).not.toContain('Identitet je potvrđen');
    await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data }} onClose={noop} onRetry={noop} />));
    const portrait = tree.root.findAll(node => node.props.testID === 'public-profile-portrait')[0];
    expect(flat(portrait.props.style)).toMatchObject({ width: 96, height: 96 });
    expect(texts(portrait)).toBe('MM');
    expect(portrait.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  // T4b1 (2026-10-07): the facts are rows (a picture and one sentence each), so they never need to stack; only the identity does.
  it.each([[320, 1], [390, 1.2999999523], [390, 2]])('draws the facts as rows at width %s and scale %s without clamping the biography', async (width, fontScale) => {
    mockWidth = width; mockFontScale = fontScale;
    const data = { ...profile(), biografija: 'Radim sa bratom. '.repeat(35) };
    await render(<PublicProfileSheet state={{ loading: false, data }} onClose={noop} onRetry={noop} />);
    const rating = tree.root.findAll(node => node.props.accessibilityLabel === 'Ocena: još nema ocena')[0];
    expect(flat(rating.props.style).flexDirection).toBe('row');
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Završeno 2 zadatka')).toHaveLength(1);
    const bio = tree.root.findAll(node => node.props.children === data.biografija)[0];
    expect(bio.props.numberOfLines).toBeUndefined(); expect(bio.props.selectable).toBe(true);
  });
});
