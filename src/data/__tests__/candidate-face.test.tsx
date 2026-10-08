import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import BottomSheet from '@gorhom/bottom-sheet';
import type { JavniProfilProjekcija, KandidatProjekcija, PotrebaProjekcija } from '../../contracts/projections';
import { sys } from '../../ui/system/tokens';

/**
 * Incoming applications and choosing a candidate (owner's step 7, 2026-09-24; the shared PrijavaCard since 2026-10-07; one
 * `Surface record` since 2026-10-08). An application is chosen as a person first, so its card leads with the state (the app's one
 * chip), then the person — their picture, name and the rating with the count it stands on — and then the facts in the one fixed
 * order: the offer and the people on one line, the term only when the person proposed one, what the person has, their message
 * (two lines of it); nothing on it is invented. Two applications are compared side by side only while each column has at least
 * 200 dp and a text size under Large, read rounded because Android hands Large over as 1.2999999523). The application and the
 * public profile are sheets of the one sheet engine, and the profile keeps its report-or-block entry.
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
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar', FaceEdge: 'FaceEdge', FACE_EDGE: 2 }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
import { CandidateListPresentation, CandidateSelectionPresentation, MEASURE_BEST_RATING, MEASURE_LOWEST_PRICE, candidateMeasures, candidateRatingFigure,
  sortCandidates } from '../../ui/v2/ApplicationSelectionPresentation';
import { UNPRICED, candidateChip, candidateHas, candidateSpoken, candidateStatus, candidateTerm, candidateTrust, candidateValue, compareIdentityHeight, requesterPrijava,
  splitAmount } from '../../ui/v2/CandidateFace';
import { DogovorenoMoment } from '../../ui/v2/DogovorenoMoment';
import { PublicProfileSheet } from '../../ui/system/PublicProfileSheet';

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
  it('leads with the person and the total in one row, then the term, the people, what the person has and the message, in one press', async () => {
    const opened: string[] = [];
    await act(async () => { tree = create(<CandidateListPresentation need={need} candidates={[k()]} open={candidate => opened.push(candidate.prijavaId)}
      back={noop} refresh={noop} />); });
    const row = pressNamed('Pogledaj prijavu: Milan Petrović');
    // Tree order is reading order ("Ponude preko stola"): the Avatar, the name, the rating and the total at the end of the row (the figure, then
    // the currency with what it buys), then the term (the task's own when the person proposed none), the people, what the person has and the
    // message in quotes. An application that was simply sent wears no chip: every application of the list was sent.
    const order = row.findAll(node => node.type === ('Avatar' as unknown as React.ElementType)
      || (node.type === ('T' as unknown as React.ElementType) && typeof node.props.children === 'string'))
      .map(node => node.type === ('Avatar' as unknown as React.ElementType) ? `avatar:${node.props.initials}` : node.props.children);
    // The rating line keeps its count whole when it wraps: no-break spaces inside the count and before the dot.
    expect(order).toEqual(['avatar:MP', 'Milan Petrović', '4,8 · 11 ocena', '4.500', 'RSD ukupno', '20. sep · 10:00–11:00', '2 osobe',
      'Ima: Kombi · Trake', '„Dolazimo sa trakama i kombijem.“']);
    // The figure is the card's money (the weight of its right side); the currency and what it buys are a quiet word under it.
    const amount = row.findAll(node => node.props.children === '4.500')[0];
    expect(amount.props.variant).toBe('priceSmall'); expect(flat(amount.props.style).color).toBe(sys.color.money);
    expect(row.findAll(node => node.props.children === 'RSD ukupno')[0].props).toMatchObject({ variant: 'meta', tone: 'muted' });
    // The message is two lines of the row; the whole of it opens with the application (the spoken text says so).
    expect(row.findAll(node => node.props.children === '„Dolazimo sa trakama i kombijem.“')[0].props.numberOfLines).toBe(2);
    // No proposed interval: the task's own term is what applies, and it is on every card (a proposal says so: the next test).
    expect(texts(row)).not.toContain('Može:'); expect(texts(row)).toContain('20. sep · 10:00–11:00');
    // Essential facts remain available when the person has disabled screen-reader hints.
    expect(row.props.accessibilityValue.text).toBe('Poslata. Ocena 4,8, 11 ocena. Termin: 20. sep · 10:00–11:00. Ponuda: 4.500 RSD ukupno. 2 osobe. '
      + 'Ima: Kombi · Trake. Poruka: „Dolazimo sa trakama i kombijem.“. Otvori prijavu za celu poruku.');
    expect(row.props.accessibilityHint).toBe('Otvara celu prijavu.');
    // One target: nothing inside the card is a press of its own (and a chip, when there is one, is not a stop of its own: the state test).
    expect(row.findAll(node => node.type === ('Press' as unknown as React.ElementType))).toHaveLength(1);
    await act(async () => row.props.onPress()); expect(opened).toEqual(['application-1']);
  });

  it('has the foot "Izaberi" as a target of its own under the body, only for an application that can be chosen now, and it opens the application', async () => {
    const opened: string[] = [];
    await act(async () => { tree = create(<CandidateListPresentation need={need} candidates={[k(), k({ prijavaId: 'application-2', ime: 'Nikola Ilić', stanje: 'STALE', mozeIzabrati: false }),
      k({ prijavaId: 'application-3', ime: 'Ana Jovanović', stanje: 'SELECTED', mozeIzabrati: false })]} open={candidate => opened.push(candidate.prijavaId)} back={noop} refresh={noop} />); });
    const foot = pressNamed('Izaberi: Milan Petrović');
    expect(foot).toBeDefined(); expect(texts(foot)).toBe('Izaberi');
    expect(pressNamed('Izaberi: Nikola Ilić')).toBeUndefined(); expect(pressNamed('Izaberi: Ana Jovanović')).toBeUndefined();
    // It is not inside the body (the body is one press; a press inside a press does nothing on a phone).
    expect(pressNamed('Pogledaj prijavu: Milan Petrović').findAll(node => node === foot)).toHaveLength(0);
    await act(async () => foot.props.onPress()); expect(opened).toEqual(['application-1']);
  });

  it('shows a proposed interval in Serbian time as the person\'s own proposal, and says why an application that cannot simply be chosen cannot', async () => {
    await render(list([k({ predlozeniPocetak: '2026-09-20T08:00:00Z', predlozeniKraj: '2026-09-20T09:00:00Z', stanje: 'STALE', mozeIzabrati: false })]));
    const row = pressNamed('Pogledaj prijavu: Milan Petrović');
    expect(texts(row)).toMatch(/Može: 20\. sep( 2026)? · 10:00–11:00/);
    // A sent application wears no chip; the reason the server gives is the card's one mark, a dot and the words in the warn colour.
    expect(texts(row)).not.toContain('Poslata'); expect(texts(row)).toContain('Zadatak je izmenjen. Čekamo da osoba potvrdi prijavu.');
    const status = row.findAll(node => node.props.children === 'Zadatak je izmenjen. Čekamo da osoba potvrdi prijavu.')[0];
    expect(flat(status.props.style).color).toBe(sys.color.warn);
    expect(row.props.accessibilityValue.text).toContain('Zadatak je izmenjen. Čekamo da osoba potvrdi prijavu.');
  });

  it('draws the state chip only when it says something: not "Poslata" (every application of the list was sent), always "Viđena", "Izabrana", "Nije izabrana" and "Povučena"', async () => {
    // [state, the chip a sent application wears (none), the chip once the server confirmed the view]
    const WORDS: [KandidatProjekcija['stanje'], string | null, string][] = [['SELECTABLE', null, 'Viđena'], ['STALE', null, 'Viđena'], ['OVERFILL', null, 'Viđena'],
      ['SELECTED', 'Izabrana', 'Izabrana'], ['WITHDRAWN', 'Povučena', 'Povučena'], ['CLOSED', 'Nije izabrana', 'Nije izabrana'], ['FULL', 'Nije izabrana', 'Nije izabrana']];
    const chipWord = (row: ReactTestInstance) => row.findAll(node => node.type === ('View' as unknown as React.ElementType) && node.props.testID === 'status-chip')
      .map(node => node.props.accessibilityLabel);
    for (const [stanje, word, seen] of WORDS) {
      const application = k({ stanje, mozeIzabrati: stanje === 'SELECTABLE' });
      await render(<CandidateListPresentation need={need} candidates={[application]} open={noop} back={noop} refresh={noop} />);
      expect([stanje, chipWord(pressNamed('Pogledaj prijavu: Milan Petrović'))]).toEqual([stanje, word ? [word] : []]);
      await act(async () => tree.update(<CandidateListPresentation need={need} candidates={[application]} open={noop} back={noop} refresh={noop}
        viewed={new Set(['application-1'])} />));
      const row = pressNamed('Pogledaj prijavu: Milan Petrović');
      expect([stanje, chipWord(row)]).toEqual([stanje, [seen]]);
      // The card is one stop and is heard once: the chip inside it is hidden from a screen reader, and the spoken text says the same word.
      expect(row.findAll(node => node.props.importantForAccessibility === 'no-hide-descendants' && node.props.accessibilityElementsHidden === true).length).toBeGreaterThan(0);
      expect(row.props.accessibilityValue.text.startsWith(`${seen}.`)).toBe(true);
      await act(async () => tree.unmount());
    }
    expect(new Set(WORDS.flatMap(([, word, seen]) => [word, seen]))).toEqual(new Set([null, 'Viđena', 'Izabrana', 'Nije izabrana', 'Povučena']));
    expect([candidateChip({ stanje: 'SELECTABLE' }), candidateChip({ stanje: 'SELECTABLE' }, true)]).toEqual(['application.sent', 'application.seen']);
  });

  // "Ponude preko stola": one mark per card for what the whole list says by comparing, and only when it is true and the list is whole.
  it('says "Najniža cena" and "Najbolja ocena" only among the applications that can still be chosen, and only for a list that is whole', () => {
    const cheap = k({ prijavaId: 'cheap', cena: { iznos: 3900, valuta: 'RSD', prikaz: '3.900 RSD' }, ocenaTekst: '—', recenzijeTekst: '' });
    const best = k({ prijavaId: 'best', ocenaTekst: '4,9', recenzijeTekst: '12 ocena' });
    const other = k({ prijavaId: 'other', ocenaTekst: '4,2', recenzijeTekst: '5 ocena', cena: { iznos: 6000, valuta: 'RSD', prikaz: '6.000 RSD' } });
    const marks = candidateMeasures([cheap, best, other], true);
    expect([marks.get('cheap'), marks.get('best'), marks.get('other')]).toEqual([MEASURE_LOWEST_PRICE, MEASURE_BEST_RATING, undefined]);
    expect([MEASURE_LOWEST_PRICE, MEASURE_BEST_RATING]).toEqual(['Najniža cena', 'Najbolja ocena']);
    // A list that is not whole says nothing: a lower price or a better rating may be on the page that was not read.
    expect(candidateMeasures([cheap, best, other], false).size).toBe(0);
    // One application is not the lowest of anything; one rating is not the best of anything; nobody is ranked who cannot be chosen.
    expect(candidateMeasures([cheap], true).size).toBe(0);
    expect(candidateMeasures([cheap, best], true).get('best')).toBeUndefined();
    const withdrawn = k({ prijavaId: 'gone', stanje: 'WITHDRAWN', mozeIzabrati: false, cena: { iznos: 1000, valuta: 'RSD', prikaz: '1.000 RSD' } });
    expect(candidateMeasures([withdrawn, cheap, best], true).get('gone')).toBeUndefined();
    expect(candidateMeasures([withdrawn, cheap, best], true).get('cheap')).toBe(MEASURE_LOWEST_PRICE);
    // An amount nobody stored is not a price: it is never the lowest.
    const unpriced = k({ prijavaId: 'free', cena: { iznos: 0, valuta: 'RSD', prikaz: '' } });
    expect(candidateMeasures([unpriced, cheap, best], true).get('free')).toBeUndefined();
    // A tie is a tie: both are said.
    const twin = k({ prijavaId: 'twin', cena: { iznos: 3900, valuta: 'RSD', prikaz: '3.900 RSD' } });
    expect([candidateMeasures([cheap, twin, best], true).get('cheap'), candidateMeasures([cheap, twin, best], true).get('twin')]).toEqual([MEASURE_LOWEST_PRICE, MEASURE_LOWEST_PRICE]);
    // The lowest price takes the one mark when an application is both.
    const both = k({ prijavaId: 'both', cena: { iznos: 3000, valuta: 'RSD', prikaz: '3.000 RSD' }, ocenaTekst: '5', recenzijeTekst: '20 ocena' });
    expect(candidateMeasures([both, best, other], true).get('both')).toBe(MEASURE_LOWEST_PRICE);
  });

  it('draws the list\'s mark on the card as a dot and the words, green for an advantage, and says it to a screen reader last', async () => {
    const cheap = k({ prijavaId: 'cheap', ime: 'Ana', cena: { iznos: 3900, valuta: 'RSD', prikaz: '3.900 RSD' }, ocenaTekst: '—', recenzijeTekst: '', napomena: '' });
    await render(list([cheap, k({ prijavaId: 'dear', ime: 'Bojan' })]));
    const row = pressNamed('Pogledaj prijavu: Ana');
    const mark = row.findAll(node => node.props.children === 'Najniža cena')[0];
    expect(mark.props.variant).toBe('note'); expect(flat(mark.props.style).color).toBe(sys.color.ink);
    expect(row.findAll(node => flat(node.props.style).backgroundColor === sys.color.green && flat(node.props.style).width === sys.space.sm)).toHaveLength(1);
    expect(row.props.accessibilityValue.text.endsWith('2 osobe. Ima: Kombi · Trake. Najniža cena.')).toBe(true);
    expect(texts(pressNamed('Pogledaj prijavu: Bojan'))).not.toContain('Najniža cena');
    // Page by page, the list is not whole: the mark is not said until every application has been read.
    await act(async () => tree.unmount());
    await render(<CandidateListPresentation need={need} candidates={[cheap, k({ prijavaId: 'dear', ime: 'Bojan' })]} open={noop} back={noop} refresh={noop}
      paging={{ total: 5, hasMore: true, loadingMore: false, moreError: false, onLoadMore: noop }} />);
    expect(texts(pressNamed('Pogledaj prijavu: Ana'))).not.toContain('Najniža cena');
  });

  it('splits an amount into its figure and its currency, whatever it is written with', () => {
    expect(splitAmount('4.500 RSD')).toEqual(['4.500', 'RSD']);
    expect(splitAmount('1.250.000 RSD')).toEqual(['1.250.000', 'RSD']);
    expect(splitAmount('4.500')).toEqual(['4.500', '']);
  });

  it('builds the one model both lists draw, with only what the read carried', () => {
    const model = requesterPrijava(k({ napomena: '  ' }), { timezone: 'Europe/Belgrade', taskTerm: 'Sutra, fleksibilno', viewed: true, avatar: null });
    expect(model).toMatchObject({ status: 'application.seen', reason: null, term: 'Sutra, fleksibilno', showTerm: false, people: '2 osobe', message: null,
      has: { art: 'vehicle', text: 'Ima: Kombi · Trake' }, price: { kind: 'amount', amount: '4.500 RSD', basis: 'ukupno' }, who: { kind: 'person', name: 'Milan Petrović' } });
    // The term is on the card only when the person proposed one; what they have is only what they declared (a vehicle first, then the tools).
    expect(requesterPrijava(k({ predlozeniPocetak: '2026-09-20T08:00:00Z', predlozeniKraj: '2026-09-20T09:00:00Z' }), { timezone: 'Europe/Belgrade', taskTerm: 'x', avatar: null }).showTerm).toBe(true);
    expect(candidateHas(k({ dokazPrijave: { sema: 'APPLICATION_V1_SELF_DECLARED', kapacitetTima: 1, vestine: ['Farbanje'], alati: ['Trake', ' '], vozila: [], licence: [] } })))
      .toEqual({ art: 'tool', text: 'Ima: Trake' });
    expect(candidateHas(k({ dokazPrijave: { sema: 'APPLICATION_V1_SELF_DECLARED', kapacitetTima: 1, vestine: ['Farbanje'], alati: [], vozila: [], licence: [] } }))).toBeNull();
    expect(candidateTerm({ predlozeniPocetak: null, predlozeniKraj: null }, null, 'Sutra, fleksibilno')).toBe('Sutra, fleksibilno');
    expect(candidateTerm({ predlozeniPocetak: '2026-09-20T08:00:00Z', predlozeniKraj: '2026-09-20T09:00:00Z' }, 'Europe/Belgrade', 'x'))
      .toMatch(/^Može: 20\. sep( 2026)? · 10:00–11:00/);
    // An interval that is not one (the end before the start) is no proposal: the task's own term applies.
    expect(candidateTerm({ predlozeniPocetak: '2026-09-20T09:00:00Z', predlozeniKraj: '2026-09-20T08:00:00Z' }, 'Europe/Belgrade', 'Sutra, fleksibilno')).toBe('Sutra, fleksibilno');
    expect(candidateSpoken(k({ napomena: '' }), 'Sutra, fleksibilno', 'Europe/Belgrade'))
      .toBe('Poslata. Ocena 4,8, 11 ocena. Termin: Sutra, fleksibilno. Ponuda: 4.500 RSD ukupno. 2 osobe. Ima: Kombi · Trake.');
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

  it('keeps the currency on an amount and never dresses a missing price as money: "Cena nije navedena"', async () => {
    expect(candidateValue({ cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500' }, pokrivaMesta: 1 }))
      .toEqual({ kind: 'amount', amount: '4.500 RSD', basis: 'ukupno' });
    expect(candidateValue({ cena: { iznos: 0, valuta: 'RSD', prikaz: '' }, pokrivaMesta: 1 })).toEqual({ kind: 'unpriced' });
    expect(UNPRICED).toBe('Cena nije navedena');
    await render(list([k({ cena: { iznos: 0, valuta: 'RSD', prikaz: '' } })]));
    const row = pressNamed('Pogledaj prijavu: Milan Petrović');
    const word = row.findAll(node => node.props.children === 'Cena nije navedena')[0];
    // The quiet `note` type in the muted tone: never the amount's `priceRow` weight, ink or figures.
    expect(word.props).toMatchObject({ variant: 'note', tone: 'muted' }); expect(word.props.variant).not.toBe('priceRow');
    // No figure, no currency, no "ukupno": and never the old words for it.
    expect(texts(row)).not.toMatch(/RSD|ukupno|Iznos nije sačuvan/);
    expect(row.props.accessibilityValue.text).toContain('Cena nije navedena');
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
    const amount = row.findAll(node => node.props.children === '125.000')[0];
    const basis = row.findAll(node => node.props.children === 'RSD ukupno')[0];
    const people = row.findAll(node => node.props.children === '123 osobe')[0];
    expect(amount.props.numberOfLines).toBeUndefined(); expect(basis.props.numberOfLines).toBeUndefined(); expect(people.props.numberOfLines).toBeUndefined();
    // Enlarged, the total stands under the person (a column that starts at the person's own edge), never squeezed beside a long name.
    expect(flat(amount.parent!.props.style).alignItems).toBe('flex-start');
    expect(texts(amount.parent!)).not.toContain('Aleksandra');
    expect(row.props.accessibilityValue.text).toContain('Ponuda: 125.000 RSD ukupno. 123 osobe');
  });

  it('draws the empty list as the one empty state: a picture and the one fact, with no promise and no button', async () => {
    await render(list([]));
    expect(texts()).toContain('Još nema prijava');
    // Review r4 rk item 8: comparing needs two applications, so the empty list never promises it. The owner's phone, 8 Oct 2026: no sentence says what
    // will happen next ("Kad neko pošalje prijavu…") and there is no "Osveži prijave": the list is read again by pulling it down.
    expect(texts()).not.toMatch(/Kad neko|videćeš|uporediš/);
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Osveži prijave')).toHaveLength(0);
  });
});

// Review r4 rk item 6: two columns hold their head to the height of the fullest one (the 40 px picture, a three-line name, a
// two-line rating, the state's 24 px chip and a two-line reason, with their gaps), at the text size in use.
it('holds a comparison header to the full name, rating, state and reason height', () => {
  // The picture, the gaps between its parts, and (at the text size in use) a three-line name, a two-line rating, the 24 dp chip and a two-line reason.
  const text = 3 * sys.type.heading.lineHeight! + 2 * sys.type.note.lineHeight! + 24 + 2 * sys.type.note.lineHeight!;
  expect(compareIdentityHeight(1)).toBe(40 + 3 * sys.space.sm + sys.space.sm + text);
  expect(compareIdentityHeight(1.2)).toBe(Math.ceil(40 + 3 * sys.space.sm + sys.space.sm + text * 1.2));
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
    // Every column wears the state as the same chip, before its cells; the cells come in the card's order: term, offer, people, what the person has.
    const withdrawn = texts(pressNamed('Otvori prijavu: Milan Petrović'));
    expect(withdrawn.split('Povučena')).toHaveLength(2);
    expect(withdrawn.indexOf('Povučena')).toBeLessThan(withdrawn.indexOf('Termin'));
    expect(withdrawn.indexOf('Termin')).toBeLessThan(withdrawn.indexOf('Ponuda'));
    expect(withdrawn.indexOf('Ponuda')).toBeLessThan(withdrawn.indexOf('Ljudi'));
    expect(withdrawn.indexOf('Ljudi')).toBeLessThan(withdrawn.indexOf('Ima'));
    expect(withdrawn.indexOf('Ima')).toBeLessThan(withdrawn.indexOf('Poruka'));
    const ana = texts(pressNamed('Otvori prijavu: Ana Jovanović'));
    expect(ana).not.toContain('Povučena');
    // The person leads and the state follows them, in a comparison column.
    expect(ana.indexOf('Ana Jovanović')).toBeLessThan(ana.indexOf('Poslata'));
    expect(ana.indexOf('Poslata')).toBeLessThan(ana.indexOf('Termin'));
  });

  it('compares the same cells in the same rows and says a missing price in words, not as an amount', async () => {
    mockWidth = 452;
    const nothing = { sema: 'APPLICATION_V1_SELF_DECLARED' as const, kapacitetTima: 2, vestine: [], alati: [], vozila: [], licence: [] };
    await render(list([...two, k({ prijavaId: 'application-3', ime: 'Nikola Ilić', inicijali: 'NI', cena: { iznos: 0, valuta: 'RSD', prikaz: '' }, napomena: '', dokazPrijave: nothing })]));
    await compare();
    const cells = (name: string) => pressNamed(`Otvori prijavu: ${name}`).findAll(node => node.type === ('T' as unknown as React.ElementType)
      && ['Termin', 'Ponuda', 'Ljudi', 'Ima', 'Poruka'].includes(node.props.children)).map(node => node.props.children);
    expect(cells('Milan Petrović')).toEqual(['Termin', 'Ponuda', 'Ljudi', 'Ima', 'Poruka']);
    expect(cells('Ana Jovanović')).toEqual(['Termin', 'Ponuda', 'Ljudi', 'Ima', 'Poruka']);
    // A column with no message has no "Poruka" cell, one that declared nothing has no "Ima" cell, and a price that was not stored is a quiet
    // word under "Ponuda".
    expect(cells('Nikola Ilić')).toEqual(['Termin', 'Ponuda', 'Ljudi']);
    const nikola = pressNamed('Otvori prijavu: Nikola Ilić');
    expect(texts(nikola)).toContain('Cena nije navedena'); expect(texts(nikola)).not.toMatch(/RSD|Iznos nije sačuvan/);
    expect(texts(pressNamed('Otvori prijavu: Ana Jovanović'))).toContain('Kombi · Trake');
    expect(texts(pressNamed('Otvori prijavu: Ana Jovanović'))).toContain('3.900 RSD ukupno');
    // The term is the task's own unless the person proposed one, and a proposal says so.
    expect(texts(nikola)).toContain('20. sep · 10:00–11:00');
    await act(async () => tree.update(list([k({ predlozeniPocetak: '2026-09-20T08:00:00Z', predlozeniKraj: '2026-09-20T09:00:00Z' }),
      k({ prijavaId: 'application-2', ime: 'Ana Jovanović' })])));
    expect(texts(pressNamed('Otvori prijavu: Milan Petrović'))).toMatch(/Može: 20\. sep( 2026)? · 10:00–11:00/);
    expect(texts(pressNamed('Otvori prijavu: Ana Jovanović'))).not.toContain('Može:');
  });

  it('gives a lone last offer the width of one column, not the whole row', async () => {
    mockWidth = 500;
    await render(list([...two, k({ prijavaId: 'application-3', ime: 'Nikola Ilić', inicijali: 'NI' })]));
    await compare();
    // (500 − 2 × 20 side padding − 12 gap) / 2 = 224, including the third offer alone on its row.
    const widths = tree.root.findAll(node => node.type === ('View' as unknown as React.ElementType) && flat(node.props.style).width === 224);
    expect(widths).toHaveLength(3);
  });

  // The total is the card's right side, in the row of the person; large text and a narrow window stack it under the person instead.
  it.each([
    ['under the person at Large', 390, 1.2999999523, 'flex-start'],
    ['under the person on a 320 dp phone', 320, 1, 'flex-start'],
    ['at the end of the person\'s row on a 390 dp phone at normal text', 390, 1, 'flex-end'],
    ['at the end of the person\'s row on the actual 361 dp phone at 1.15', 361, 1.15, 'flex-end'],
  ])('places the total %s', async (_name, width, fontScale, align) => {
    mockWidth = width; mockFontScale = fontScale;
    await render(list([k()]));
    const row = pressNamed('Pogledaj prijavu: Milan Petrović');
    const amount = row.findAll(node => node.props.children === '4.500')[0];
    expect(flat(amount.parent!.props.style).alignItems).toBe(align);
  });
});

describe('the order of the applications', () => {
  const a = k({ prijavaId: 'a', ime: 'Ana', ocenaTekst: '4,5', recenzijeTekst: '10 ocena' }), b = k({ prijavaId: 'b', ime: 'Bojan', ocenaTekst: '4,9', recenzijeTekst: '1 ocena' }),
    c = k({ prijavaId: 'c', ime: 'Cvetko', ocenaTekst: '4,9', recenzijeTekst: '7 ocena' }), d = k({ prijavaId: 'd', ime: 'Dragan', ocenaTekst: '—', recenzijeTekst: '' }),
    e = k({ prijavaId: 'e', ime: 'Emil', ocenaTekst: '4,5', recenzijeTekst: '10 ocena' });
  const names = () => tree.root.findAll(node => node.type === ('Press' as unknown as React.ElementType) && String(node.props.accessibilityLabel).startsWith('Pogledaj prijavu: '))
    .map(node => String(node.props.accessibilityLabel).slice('Pogledaj prijavu: '.length));

  it('reads the rating and the count it stands on from the words of the read, and no rating is no figure (never a bad one)', () => {
    expect(candidateRatingFigure({ ocenaTekst: '4,8', recenzijeTekst: '11 ocena' })).toEqual({ rating: 4.8, count: 11 });
    expect(candidateRatingFigure({ ocenaTekst: '5', recenzijeTekst: '2 recenzije' })).toEqual({ rating: 5, count: 2 });
    expect(candidateRatingFigure({ ocenaTekst: '4.5', recenzijeTekst: '' })).toEqual({ rating: 4.5, count: 0 });
    for (const word of ['—', 'Novo', '', 'Još nema ocena']) expect(candidateRatingFigure({ ocenaTekst: word, recenzijeTekst: '3 ocene' })).toBeNull();
  });

  it('puts the best rated first, then the one that stands on more ratings, then the earlier one; nobody without a rating comes before anybody with one', () => {
    const all = [a, b, c, d, e];
    expect(sortCandidates(all, 'RATING').map(candidate => candidate.prijavaId)).toEqual(['c', 'b', 'a', 'e', 'd']);
    expect(sortCandidates(all, 'PRICE').map(candidate => candidate.prijavaId)).toEqual(['a', 'b', 'c', 'd', 'e']);
    // The default is the list exactly as the server sent it: the same array, so it draws what it always drew.
    expect(sortCandidates(all, 'ARRIVAL')).toBe(all);
    expect(all.map(candidate => candidate.prijavaId)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('offers "Najbolja ocena" beside the other two orders and orders the loaded list by it, without a new read', async () => {
    const refresh = jest.fn();
    await render(<CandidateListPresentation need={need} candidates={[a, b, c, d, e]} open={noop} back={noop} refresh={refresh} />);
    expect(names()).toEqual(['Ana', 'Bojan', 'Cvetko', 'Dragan', 'Emil']);
    await act(async () => pressNamed('Redosled prijava: Najranije').props.onPress());
    expect(['Najranije', 'Najniža cena', 'Najbolja ocena'].map(label => pressNamed(label) !== undefined)).toEqual([true, true, true]);
    await act(async () => pressNamed('Najbolja ocena').props.onPress());
    expect(names()).toEqual(['Cvetko', 'Bojan', 'Ana', 'Emil', 'Dragan']);
    expect(pressNamed('Redosled prijava: Najbolja ocena')).toBeDefined(); expect(refresh).not.toHaveBeenCalled();
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
    expect(green()).toEqual(['Izaberi osobu']);
    await act(async () => pressNamed('Izaberi osobu').props.onPress());
    // A question (a verb and a question mark) and under it what is accepted and what follows (plan 2.3), in a centred dialog.
    expect(choose).not.toHaveBeenCalled(); expect(texts()).toContain('Izabrati ovu osobu?');
    expect(texts()).toContain('Prihvataš: 4.500 RSD ukupno · 2 osobe · 20. sep · 10:00–11:00. Dogovor odmah važi za obe strane. Pri izboru proveravamo da li izabrana osoba i dalje ima slobodan termin.');
    expect(tree.root.findAll(node => node.props.testID === 'confirm-dialog')).toHaveLength(1);
    // Review r4 rk item 5: the confirm says the button's own words (it said "Izaberi ovu Prijavu").
    expect(confirmButton().props.accessibilityLabel).toBe('Izaberi osobu');
    await act(async () => confirmButton().props.onPress());
    expect(choose).toHaveBeenCalledTimes(1);
  });

  it('names the term that applies in the question: the person\'s own proposal, or else the task\'s', async () => {
    await render(offer({ candidate: k({ predlozeniPocetak: '2026-09-20T08:00:00Z', predlozeniKraj: '2026-09-20T09:00:00Z' }) }));
    await act(async () => pressNamed('Izaberi osobu').props.onPress());
    // On a phone that is not in Serbian time the term says so ("po vremenu u Srbiji"); in Serbian time it does not need to.
    expect(texts()).toMatch(/Prihvataš: 4\.500 RSD ukupno · 2 osobe · 20\. sep( 2026)? · 10:00–11:00( \(po vremenu u Srbiji\))?\. Dogovor odmah važi/);
  });

  // Review r4 rk item 9: a question asked about one exact application is retired the moment that application changes.
  it('retires an open question when the application changes, and the old question cannot choose', async () => {
    const choose = jest.fn();
    await render(offer({ choose }));
    await act(async () => pressNamed('Izaberi osobu').props.onPress());
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
    // The Dogovor is made: the sheet gives way to the moment "Dogovoreno!" (the next tests), and the old line is not said any more.
    await act(async () => tree.update(offer({ confirmed: true })));
    expect(tree.root.findAllByType(BottomSheet)).toHaveLength(0);
    expect(texts()).toContain('Dogovoreno!'); expect(texts()).not.toContain('Dogovor je sklopljen.');
  });

  // Review r4 rk item 2: an outcome that was already confirmed when the sheet opened stands still (no meeting, no haptic).
  it('plays the moment only for a choice confirmed while the sheet is open', async () => {
    await render(offer({ confirmed: true }));
    expect(tree.root.findByType(DogovorenoMoment).props.fresh).toBe(false);
    await act(async () => tree.unmount());
    await render(offer());
    expect(tree.root.findAllByType(DogovorenoMoment)).toHaveLength(0);
    await act(async () => tree.update(offer({ confirmed: true })));
    expect(tree.root.findByType(DogovorenoMoment).props.fresh).toBe(true);
  });

  // "Dogovoreno!" (owner's pick "Susret dva lica", with his addition: the task's title under the faces): two faces, the title, the word, three
  // rows, and the one green way on, which is the sheet's own `Otvori Dogovor` with its guard.
  it('is a whole screen of two faces, the task\'s title, the word, the two of you, the term and the amount, and one green way on', async () => {
    const openAgreement = jest.fn(), back = jest.fn();
    await render(offer({ confirmed: true, pending: true, openAgreement, back,
      publicPhoto: (profileId, size) => React.createElement('Photo' as unknown as React.ElementType, { profileId, size }), ownFace: React.createElement('Own' as unknown as React.ElementType) }));
    const moment = tree.root.findByType(DogovorenoMoment);
    expect(moment.props).toMatchObject({ people: 'Ti i Milan Petrović', taskTitle: 'Unos ormara', term: '20. sep · 10:00–11:00', amount: '4.500 RSD ukupno', fresh: false });
    // Reading order: the task's title under the faces, then the word, then the three rows and the action.
    expect(texts().replace(/\s+/g, ' ')).toBe('Unos ormara Dogovoreno! Ti i Milan Petrović 20. sep · 10:00–11:00 4.500 RSD ukupno Otvori Dogovor');
    // Yours is the face the screen handed in; theirs is the portrait at 72 by their public profile; nothing else is invented.
    expect(tree.root.findAllByType('Own' as unknown as React.ElementType)).toHaveLength(1);
    expect(tree.root.findAllByType('Photo' as unknown as React.ElementType).map(node => node.props)).toEqual([{ profileId: 'profile-1', size: 72 }]);
    // The word is announced when it has just happened; the whole screen is a modal whose Android Back is the screen's Back.
    expect(tree.root.findAll(node => node.props.children === 'Dogovoreno!')[0].props.accessibilityRole).toBe('header');
    const screen = tree.root.findByType('Modal' as unknown as React.ElementType);
    await act(async () => screen.props.onRequestClose());
    expect(back).toHaveBeenCalledTimes(1);
    expect(green()).toEqual(['Otvori Dogovor']);
    await act(async () => pressNamed('Otvori Dogovor').props.onPress()); expect(openAgreement).toHaveBeenCalledTimes(1);
  });

  it('draws the faces it has: the drawn person for yours when the screen has none, the letters for theirs without a public portrait', async () => {
    await render(offer({ confirmed: true, pending: true }));
    const faces = tree.root.findAll(node => node.type === ('Avatar' as unknown as React.ElementType)).map(node => [node.props.initials, node.props.size]);
    expect(faces).toEqual([[null, 72], ['MP', 72]]);
    expect(texts()).toContain('Ti i Milan Petrović');
  });

  it('takes the chosen person\'s face from the screen when it is handed one, before their public portrait and before their letters', async () => {
    const publicPhoto = jest.fn((_profileId: string, _size?: number) => React.createElement('Portrait' as unknown as React.ElementType));
    await render(offer({ confirmed: true, pending: true, publicPhoto, themFace: React.createElement('Them' as unknown as React.ElementType) }));
    expect(tree.root.findAllByType('Them' as unknown as React.ElementType)).toHaveLength(1);
    expect(tree.root.findAllByType('Portrait' as unknown as React.ElementType)).toHaveLength(0);
    expect(publicPhoto).not.toHaveBeenCalled();
    // Without it the public portrait at 72 stands in, and without that their letters.
    await act(async () => tree.unmount());
    await render(offer({ confirmed: true, pending: true, publicPhoto }));
    expect(publicPhoto).toHaveBeenCalledWith('profile-1', 72);
    expect(tree.root.findAllByType('Portrait' as unknown as React.ElementType)).toHaveLength(1);
  });

  it('says "Vas dvoje" when the read could not give the person\'s name, never "Ti i Ime nije dostupno", and says a missing amount in words', async () => {
    await render(offer({ confirmed: true, pending: true, candidate: k({ ime: 'Ime nije dostupno', inicijali: '', cena: { iznos: 0, valuta: 'RSD', prikaz: '' } }) }));
    expect(texts()).toContain('Vas dvoje'); expect(texts()).not.toContain('Ime nije dostupno'); expect(texts()).toContain('Cena nije navedena');
    expect(tree.root.findAll(node => node.type === ('Avatar' as unknown as React.ElementType)).map(node => node.props.initials)).toEqual([null, null]);
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
    await act(async () => pressNamed('Izaberi osobu').props.onPress());
    expect(choose).not.toHaveBeenCalled();
    expect(texts()).toContain('Prihvataš: 4.500 RSD ukupno · 2 osobe · 20. sep · 10:00–11:00.');
    expect(texts()).toContain('Pri izboru proveravamo da li izabrana osoba i dalje ima slobodan termin.');
  });
});

// R24 (PROFILE-TRUST): "Dolazi kako je dogovoreno N%" is the server's to give, for this viewer, and the owner's privacy switch decides it.
// The offer reads the person's trust block when their public profile is opened, hands it to the profile sheet, and draws nothing of its own.
describe('the trust block of the person, which the server gives or does not', () => {
  const person = () => tree.root.findAll(node => node.type === ('Press' as unknown as React.ElementType) && node.props.accessibilityHint === 'Otvara javni profil')[0];
  const profile = (): JavniProfilProjekcija => ({ profilId: 'profile-1', uloga: 'radnik', ime: 'Milan Petrović', avatarPutanja: null, grad: 'Novi Sad', naslov: null, biografija: null,
    poverenje: { ocenaProsek: 4.8, brojRecenzija: 11, zavrseniBroj: 9, identitetVerifikovan: false, ocenaDostupna: true, recenzijeDostupne: true, verifikacijaIdentitetaDostupna: false } } as unknown as JavniProfilProjekcija);
  const trust = (patch: Record<string, unknown> = {}) => ({ profileId: 'profile-1', self: false, visibility: 'PUBLIC', completedCount: 9, agreedCount: 10, reliabilityPercent: 90,
    reliabilityState: 'AVAILABLE', reliabilityMinimum: 5, memberSince: '2026-03-01', ...patch }) as never;
  const sheet = (publicTrust?: (profileId: string) => Promise<never | null>) =>
    <CandidateSelectionPresentation need={need} candidate={k()} back={noop} publicProfile={async () => profile()} publicTrust={publicTrust} choose={noop} busy={false}
      pending={false} uncertain={false} refresh={noop} error={null} confirmed={false} openAgreement={noop}
      readAgreement={async () => ({ ok: true, podatak: { dogovorId: null } })} openLinkedAgreement={noop} />;
  const open = async () => { await act(async () => { person().props.onPress(); }); await act(async () => {}); };

  it('reads it for that profile when the profile is opened, and the profile sheet says what the server returned: the percentage, the count, since when', async () => {
    const publicTrust = jest.fn(async (_profileId: string) => trust());
    await render(sheet(publicTrust));
    expect(publicTrust).not.toHaveBeenCalled();
    await open();
    expect(publicTrust).toHaveBeenCalledTimes(1); expect(publicTrust).toHaveBeenCalledWith('profile-1');
    // 8 Oct 2026 ("Lice i tri broja"): the percentage is the third figure of the sheet ("90 %" with its words under it), the rest are confirmations.
    expect(texts()).toContain('90 %'); expect(texts()).toContain('dolazi kako je dogovoreno');
    expect(texts()).toContain('Dogovoreno 10 zadataka'); expect(texts()).toContain('Na USKOČI-ju od marta 2026');
  });

  it('draws nothing at all when the server hides it from this viewer (the default today), when it has nothing to say, and when there is too little to say a percentage', async () => {
    for (const answer of [trust({ reliabilityState: 'HIDDEN', agreedCount: null, reliabilityPercent: null, memberSince: null, visibility: 'OWN_ONLY' }), null]) {
      await render(sheet(async () => answer));
      await open();
      expect(texts()).toContain('Milan Petrović'); expect(texts()).not.toMatch(/Dolazi kako je dogovoreno|Dogovoreno \d|Na USKOČI/);
      await act(async () => tree.unmount());
    }
    // Too few Dogovori for a percentage: the profile says so in its own words; the offer adds none.
    await render(sheet(async () => trust({ reliabilityState: 'TOO_FEW', reliabilityPercent: null, agreedCount: 2 })));
    await open();
    expect(texts()).not.toContain('90 %'); expect(texts()).not.toMatch(/\d+ ?%/);
  });

  it('never delays or fails the profile: a read that fails, that throws at once or that never answers leaves the profile as it is', async () => {
    for (const publicTrust of [async () => { throw new Error('PRIVATE_SQL_DETAILS'); }, () => { throw new Error('PRIVATE_SQL_DETAILS'); }, () => new Promise<never>(() => {})] as const) {
      await render(sheet(publicTrust as never));
      await open();
      expect(texts()).toContain('Novi Sad'); expect(texts()).not.toContain('Javni profil trenutno nije dostupan.'); expect(texts()).not.toContain('PRIVATE_SQL_DETAILS');
      await act(async () => tree.unmount());
    }
  });

  it('drops an answer that comes after the profile was closed, and a profile without a trust read is exactly what it was', async () => {
    let answer!: (value: never) => void;
    await render(sheet(() => new Promise<never>(resolve => { answer = resolve; })));
    await open();
    await act(async () => pressNamed('Zatvori javni profil').props.onPress());
    await act(async () => answer(trust()));
    expect(texts()).not.toMatch(/Dolazi kako je dogovoreno|Dogovoreno \d/);
    await act(async () => tree.unmount());
    await render(sheet(undefined));
    await open();
    expect(texts()).toContain('Novi Sad'); expect(texts()).not.toMatch(/Dolazi kako je dogovoreno/);
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
    expect(texts()).toContain('Marko Marković'); expect(texts()).toContain('Nova ocena'); expect(texts()).toContain('još nema ocena'); expect(texts()).not.toContain('Javni profil');
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
    expect(photo).toHaveBeenCalledWith('profile-1', 72);
    // (8 Oct 2026: a rating the server says is not available is not drawn at all: no figure, no word about it.)
    expect(texts()).not.toContain('Ocena nije dostupna'); expect(texts()).not.toContain('Nova ocena'); expect(texts()).not.toContain('4,9'); expect(texts()).not.toContain('27 ocena');
    expect(texts()).not.toContain('Identitet je potvrđen');
    await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data }} onClose={noop} onRetry={noop} />));
    const portrait = tree.root.findAll(node => node.props.testID === 'public-profile-portrait')[0];
    // The face is the one stand-in (`Avatar`, here a named element) at 72, with the initials of the name, inside the sticker edge.
    expect(portrait.findAll(node => String(node.type) === 'Avatar').map(node => [node.props.initials, node.props.size])).toEqual([['MM', 72]]);
    expect(portrait.findAll(node => String(node.type) === 'FaceEdge')).toHaveLength(1);
    expect(portrait.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  // T4b1 (2026-10-07; `FactRow`s since 2026-10-08; the three figures since 8 Oct 2026): the figures share one row and the confirmations are rows, so nothing needs to stack.
  it.each([[320, 1], [390, 1.2999999523], [390, 2]])('draws the facts as rows at width %s and scale %s without clamping the biography', async (width, fontScale) => {
    mockWidth = width; mockFontScale = fontScale;
    const data = { ...profile(), biografija: 'Radim sa bratom. '.repeat(35) };
    await render(<PublicProfileSheet state={{ loading: false, data }} onClose={noop} onRetry={noop} />);
    const rating = tree.root.findAll(node => node.type === ('View' as unknown as React.ElementType) && node.props.testID === 'public-profile-figure-rating')[0];
    expect(rating.props.accessibilityLabel).toBe('Nova ocena još nema ocena');
    const figures = tree.root.findAll(node => node.type === ('View' as unknown as React.ElementType) && node.props.testID === 'public-profile-figures')[0];
    expect(flat(figures.props.style).flexDirection).toBe('row');
    expect(tree.root.findAll(node => node.props.accessibilityLabel === '2 završena')).toHaveLength(1);
    const bio = tree.root.findAll(node => node.props.children === data.biografija)[0];
    expect(bio.props.numberOfLines).toBeUndefined(); expect(bio.props.selectable).toBe(true);
  });
});
