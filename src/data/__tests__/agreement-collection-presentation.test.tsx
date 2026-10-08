import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { DogovorProjekcija } from '../../contracts/projections';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return ({ data, renderItem, ListEmptyComponent, ...props }: any) => React.createElement('List', props,
      data.length ? data.map((item: any) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))) : ListEmptyComponent);
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import { AgreementCollectionPresentation, type AgreementCollectionSection } from '../../ui/v2/AgreementCollectionPresentation';
import { Segmented } from '../../ui/system/Segmented';
import { AgreementPeople, AgreementPersonBar } from '../../ui/v2/AgreementPresentation';
const agreement = (id: string, state: DogovorProjekcija['stanje'], requester = true): DogovorProjekcija => ({
  id, verzija: 3, naslov: `Posao ${id}`, stanje: state, cena: { iznos: 2500, valuta: 'RSD', prikaz: '2.500 RSD' },
  vremeTekst: '11. septembar · 10:00:00.000001–10:00:00.000009', putanjaTekst: 'Novi Sad',
  pokrivenost: { ukupno: 5, popunjeno: 3, preostalo: 2, udeo: .6 }, rezim: 'FIZICKI',
  ucesnici: [{ id: 'me', profilId: null, ime: 'Ja', inicijali: 'JA', uloga: requester ? 'narucilac' : 'uskocer', mesta: requester ? null : 3, viSte: true, telefon: null },
    { id: 'other', profilId: null, ime: 'Druga osoba', inicijali: 'DO', uloga: requester ? 'uskocer' : 'narucilac', mesta: requester ? 3 : null, viSte: false, telefon: 'PRIVATE_PHONE' }],
  kontakt: { mojTelefonPodeljen: false, njihovTelefon: 'PRIVATE_PHONE', lokacijaPostoji: true, tacnaLokacija: 'PRIVATE_ADDRESS', emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null, izmenaCeka: null, izvor: { zadatakId: null, prijavaId: null },
});
let rows: DogovorProjekcija[], loading: boolean, error: boolean, tree: ReactTestRenderer;
const open = jest.fn(), refresh = jest.fn(), tasks = jest.fn();
// "Now" for the day groups: Thursday 24 September 2026, 11:00 in Belgrade (09:00 UTC, CEST). The week is 21 to 27 September.
const NOW = new Date('2026-09-24T09:00:00Z');
function Screen() {
  const [section, setSection] = useState<AgreementCollectionSection>('active'), [confirmationOnly, setConfirmationOnly] = useState(false);
  return <AgreementCollectionPresentation items={rows} loading={loading} error={error} now={NOW}
    section={section} confirmationOnly={confirmationOnly} onSection={setSection} onConfirmationOnly={setConfirmationOnly}
    onOpen={open} onRefresh={refresh} onHome={tasks} onCalendar={() => {}} onProfile={() => {}} />;
}
const render = async () => act(async () => { tree = create(<Screen />); });
const tap = async (label: string) => act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress());
const titles = () => tree.root.findAllByType('Press' as React.ElementType).map(node => node.props.accessibilityLabel).filter(label => label?.startsWith('Otvori Dogovor'));
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {}); loading = error = false;
  rows = [agreement('confirmed', 'CONFIRMED'), agreement('waiting-mine', 'AWAITING_REQUESTER'), agreement('waiting-other', 'AWAITING_REQUESTER', false), agreement('done', 'COMPLETED'), agreement('cancelled', 'CANCELLED')];
  open.mockClear(); refresh.mockClear(); tasks.mockClear();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });
test('active and history preserve both actual participant roles; attention means my requester confirmation', async () => {
  await render(); expect(titles()).toHaveLength(3); // One list holds both sides of one account, and each row says which side from its own participants.
  // A number is drawn only for what needs the person: one Dogovor waits for my confirmation, and Istorija says no count at all.
  expect(tree.root.findByProps({ accessibilityLabel: 'Aktivni' }).props.accessibilityValue).toEqual({ text: '1 Dogovor čeka tebe' });
  expect(tree.root.findByProps({ accessibilityLabel: 'Istorija' }).props.accessibilityValue).toEqual({ text: '' });
  // The row carries the other person's photo and name, so the sentence beside it is about THEM,
  // third person — the same words the Dogovor itself uses in AgreementPeople. It used to read
  // "Milos SLJIVIC   Uskočio si": their name, then a sentence about me, with nothing to mark that
  // the subject had changed. Početna keeps the first person because it puts the relation first.
  expect(texts()).toContain('Traži pomoć'); expect(texts()).toContain('Uskače na tvoj zadatak');
  expect(texts()).not.toContain('Uskočio si'); expect(texts()).not.toContain('Objavio si');
  // The filter speaks to the person ("tvoju"), never in the first person ("moju").
  await tap('Čeka tvoju potvrdu'); expect(titles()).toEqual(['Otvori Dogovor Posao waiting-mine']);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Čeka moju potvrdu' })).toHaveLength(0);
  await tap('Čeka tvoju potvrdu'); await tap('Istorija'); expect(titles()).toEqual(['Otvori Dogovor Posao done', 'Otvori Dogovor Posao cancelled']);
  // Round-1 critique A11 (owner step 8): Aktivni and Istorija only. "Svi" repeated both sets and is gone.
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Svi' })).toHaveLength(0);
  // Nothing in history waits for a confirmation, so the filter is offered on Aktivni only.
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Čeka tvoju potvrdu' })).toHaveLength(0);
});
// Plan 2.6: Istorija has its own chips, "Sve · Završeni · Otkazani", and a cancelled Dogovor wears the one "Otkazan" chip.
test('Istorija offers Sve, Završeni and Otkazani, narrows the list by them and says when a chip holds nothing', async () => {
  rows = [agreement('done', 'COMPLETED'), agreement('off', 'CANCELLED'), agreement('done-2', 'COMPLETED'), agreement('live', 'CONFIRMED')];
  await render();
  // Aktivni has no history chips, and Istorija has no confirmation filter.
  expect(tree.root.findAllByProps({ accessibilityRole: 'radio' })).toHaveLength(0);
  await tap('Istorija');
  const chips = () => tree.root.findAllByProps({ accessibilityRole: 'radio' }).map(node => [node.props.accessibilityLabel, node.props.accessibilityState.checked]);
  expect(chips()).toEqual([['Sve', true], ['Završeni', false], ['Otkazani', false]]);
  expect(titles()).toEqual(['done', 'off', 'done-2'].map(id => `Otvori Dogovor Posao ${id}`));
  await tap('Završeni'); expect(chips()).toEqual([['Sve', false], ['Završeni', true], ['Otkazani', false]]);
  expect(titles()).toEqual(['Otvori Dogovor Posao done', 'Otvori Dogovor Posao done-2']);
  await tap('Otkazani'); expect(titles()).toEqual(['Otvori Dogovor Posao off']);
  expect(cardTexts('Posao off')).toContain('Otkazan');
  // A chip that holds nothing says so and leads back to "Sve", not to another empty view.
  rows = [agreement('done', 'COMPLETED'), agreement('live', 'CONFIRMED')];
  await act(async () => tree.update(<Screen />));
  expect(texts()).toContain('Nema otkazanih Dogovora');
  await act(async () => tree.root.findByProps({ label: 'Prikaži sve' }).props.onPress());
  expect(titles()).toEqual(['Otvori Dogovor Posao done']);
});
// Round 2c (verifier vf, must 2): since 2026-09-24 a missing name reaches the screens as an empty string. The card wrote
// `inicijali ?? '—'` (which lets '' through) and the Dogovor printed it bare, so both drew an empty green disc. The one
// Avatar draws the person instead, on the card, in the Dogovor's bar and in its people rows.
test('a person without a name gets the drawn person, never an empty disc, on the card, the bar and the people rows', async () => {
  const nameless = agreement('nameless', 'CONFIRMED');
  nameless.ucesnici = nameless.ucesnici.map(person => ({ ...person, inicijali: '' }));
  const discs = () => tree.root.findAll(node => typeof node.type !== 'string' && node.props.initials !== undefined && node.props.size !== undefined);
  const people = () => tree.root.findAll(node => typeof node.type !== 'string' && node.props.kind === 'person');
  const emptyLetters = () => tree.root.findAllByType('T' as React.ElementType).filter(node => node.children.length === 0 || node.children.every(child => child === ''));
  rows = [nameless]; await render();
  expect(discs().map(node => [node.props.initials, node.props.size])).toEqual([['', 40]]);
  expect(people()).toHaveLength(1); expect(emptyLetters()).toHaveLength(0);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<AgreementPersonBar person={nameless.ucesnici[1]} back={() => {}} />); });
  expect(discs().map(node => [node.props.initials, node.props.size])).toEqual([['', 40]]); expect(people()).toHaveLength(1);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<AgreementPeople agreement={nameless} />); });
  expect(discs().map(node => [node.props.initials, node.props.size])).toEqual([['', 56], ['', 56]]); expect(people()).toHaveLength(2);
  expect(emptyLetters()).toHaveLength(0);
});
test('reuses full accepted amount, precise interval and coverage, without exposing contact or exact address', async () => {
  rows = [agreement('remote', 'CONFIRMED')]; rows[0].rezim = 'DALJINSKI'; rows[0].putanjaTekst = 'REMOTE_MUST_HIDE_LOCATION';
  // The accepted term is one full line (round-1 critique B15; it used to be split into a day and a time under it),
  // and the interval keeps every microsecond it was agreed with.
  await render(); const text = texts(); expect(text).toContain('11. septembar · 10:00:00.000001–10:00:00.000009'); expect(text).toContain('2.500 RSD'); expect(text).toContain('3'); expect(text).toContain('osobe');
  // The amount stands alone on the card (the Dogovor itself says "Dogovoreno ukupno"); the ear still hears what it is.
  expect(text).not.toContain('ukupno'); expect(card('Posao remote').props.accessibilityValue.text).toContain('2.500 RSD ukupno');
  expect(text).toContain('Na daljinu'); expect(text).not.toMatch(/PRIVATE_|REMOTE_MUST_HIDE_LOCATION/);
  await tap('Otvori Dogovor Posao remote'); expect(open).toHaveBeenCalledWith(rows[0]);
});

test('leads with the person\'s face beside the work title (two lines at most) and "ime · uloga", then gives accepted facts the row width', async () => {
  const title = 'Popravka police u dnevnoj sobi i postavljanje velikog ogledala';
  rows = [{ ...agreement('work', 'CONFIRMED'), naslov: title }];
  await render();
  const body = card(title);
  const words = body.findAllByType('T' as React.ElementType);
  const heading = words.find(node => node.props.children === title)!;
  // Plan 2.6: black title, two lines at most; the person under it as "ime · uloga", in grey.
  expect(heading.props.numberOfLines).toBe(2);
  expect(heading.parent!.children[0]).toBe(heading);
  // (This Dogovor is for three people, so the count joins the same grey line: "ime · uloga · 3 osobe".)
  const copy = words.find(node => node.props.children === 'Druga osoba · Uskače na tvoj zadatak · 3 osobe')!;
  expect(copy.parent).toBe(heading.parent); expect(copy.props.tone).toBe('muted');
  const headRow = heading.parent!.parent!;
  expect(headRow.findAll(node => typeof node.type !== 'string' && node.props.initials === 'DO' && node.props.size === 40)).toHaveLength(1);
  // When and where is one grey line: the adapter's term (this Dogovor carries no accepted start), then the place.
  const term = words.find(node => node.props.children === `${rows[0].vremeTekst} · Novi Sad`)!;
  for (let ancestor = term.parent; ancestor && ancestor !== body; ancestor = ancestor.parent) {
    const style = StyleSheet.flatten(ancestor.props.style) ?? {};
    expect(style.borderLeftWidth ?? 0).toBe(0);
    expect(style.marginLeft ?? 0).toBe(0);
    expect(style.paddingLeft ?? 0).toBe(0);
  }
});
test.each(['loading', 'error'])('%s hides stale private rows and error retry uses actual callback', async state => {
  loading = state === 'loading'; error = state === 'error'; await render(); expect(titles()).toEqual([]);
  if (error) { await act(async () => tree.root.findByProps({ label: 'Pokušaj ponovo' }).props.onPress()); expect(refresh).toHaveBeenCalledTimes(1); }
});
test('empty history still offers a real task route, with no invented review or unread controls', async () => {
  rows = []; await render(); await tap('Istorija'); expect(texts()).toContain('Još nemaš Dogovor');
  await act(async () => tree.root.findByProps({ label: 'Idi na Početnu' }).props.onPress()); expect(tasks).toHaveBeenCalledTimes(1);
  expect(texts()).not.toMatch(/Oceni|nepročitan/);
});

// Owner, 2026-09-23: right after a completion the default tab said "Nema Dogovora u ovom prikazu" while the
// Dogovor waited for the person's rating one tab away.
test('a finished Dogovor that still waits for my rating stays among the active ones and says so; a rated one is history', async () => {
  rows = [{ ...agreement('done-unrated', 'COMPLETED'), ocenaMoguca: true }, agreement('done', 'COMPLETED')];
  // The foot is one line, the verb ("Oceni saradnju"); why it waits is the card's hint, and the chip says "Završen".
  await render(); expect(titles()).toEqual(['Otvori Dogovor Posao done-unrated']); expect(texts()).toContain('Oceni saradnju');
  expect(tree.root.findByProps({ accessibilityLabel: 'Otvori Dogovor Posao done-unrated' }).props.accessibilityHint).toBe('Oceni saradnju. Čeka tvoju ocenu');
  expect(texts()).not.toContain('Čeka tvoju ocenu');
  await tap('Istorija'); expect(titles()).toEqual(['Otvori Dogovor Posao done']); expect(texts()).not.toContain('Oceni saradnju');
});

test('an unavailable rating stays reachable from active work without claiming that a rating is due or already settled', async () => {
  rows = [{ ...agreement('unknown', 'COMPLETED'), ocenaMoguca: false, stanjeProvereOcene: 'UNAVAILABLE' }, agreement('done', 'COMPLETED')];
  await render(); expect(titles()).toEqual(['Otvori Dogovor Posao unknown']);
  expect(texts()).toContain('Proveri ocenu'); expect(texts()).not.toContain('Čeka tvoju ocenu');
  await tap('Otvori Dogovor Posao unknown'); expect(open).toHaveBeenCalledWith(rows[0]);
  await tap('Istorija'); expect(titles()).toEqual(['Otvori Dogovor Posao done']);
});

test('old unknown ratings cannot preempt accepted appointments or confirmed rating actions in Active', async () => {
  rows = [
    { ...agreement('old-unknown', 'COMPLETED'), stanjeProvereOcene: 'UNAVAILABLE', prihvacenPocetak: '2026-01-01T10:00:00Z' },
    { ...agreement('later', 'CONFIRMED'), prihvacenPocetak: '2026-09-26T10:00:00Z' },
    { ...agreement('due', 'COMPLETED'), ocenaMoguca: true, stanjeProvereOcene: 'DUE', prihvacenPocetak: '2026-09-24T10:00:00Z' },
    { ...agreement('soon', 'CONFIRMED'), prihvacenPocetak: '2026-09-25T10:00:00Z' },
    { ...agreement('no-term', 'CONFIRMED'), prihvacenPocetak: null },
  ];
  await render();
  // Both ratings have an orange foot, so both stand under "Čeka tebe", first; the one the read could not answer for comes after
  // the one that is really due, whatever its date. Then the days: tomorrow, this week, and no term last.
  expect(titles()).toEqual(['Otvori Dogovor Posao due', 'Otvori Dogovor Posao old-unknown', 'Otvori Dogovor Posao soon',
    'Otvori Dogovor Posao later', 'Otvori Dogovor Posao no-term']);
  expect(headers()).toEqual(['Čeka tebe', 'Sutra', 'Ove nedelje', 'Bez tačnog termina']);
});

// Plan 2.6: Aktivni is groups, "Čeka tebe" first and always, then the days in Serbian time, each under its own heading.
const headers = () => tree.root.findAllByType('T' as React.ElementType).filter(node => node.props.accessibilityRole === 'header').map(node => node.props.children);
test('Aktivni is groups: Čeka tebe first, then Danas, Sutra, Ove nedelje, Kasnije and Bez tačnog termina, each with its heading', async () => {
  rows = [
    { ...agreement('no-term', 'CONFIRMED'), prihvacenPocetak: null },
    { ...agreement('later', 'CONFIRMED'), prihvacenPocetak: '2026-10-05T10:00:00Z' },
    { ...agreement('week', 'CONFIRMED'), prihvacenPocetak: '2026-09-27T10:00:00Z' },
    { ...agreement('tomorrow', 'CONFIRMED'), prihvacenPocetak: '2026-09-25T10:00:00Z' },
    { ...agreement('today', 'CONFIRMED'), prihvacenPocetak: '2026-09-24T14:00:00Z' },
    { ...agreement('waits', 'AWAITING_REQUESTER'), prihvacenPocetak: '2026-10-20T10:00:00Z' },
    agreement('over', 'COMPLETED'), agreement('off', 'CANCELLED'),
  ];
  await render();
  expect(headers()).toEqual(['Čeka tebe', 'Danas', 'Sutra', 'Ove nedelje', 'Kasnije', 'Bez tačnog termina']);
  expect(titles()).toEqual(['waits', 'today', 'tomorrow', 'week', 'later', 'no-term'].map(id => `Otvori Dogovor Posao ${id}`));
  // The rows of Istorija keep the server's order and carry no day headings.
  await tap('Istorija'); expect(headers()).toEqual([]);
  expect(titles()).toEqual(['over', 'off'].map(id => `Otvori Dogovor Posao ${id}`));
});
// Plan 2.6: the compact card says WHEN in Serbian time from the accepted instant, never from display text, and WHERE, in one grey line.
test('a card writes the accepted start as "Danas 14:00 · Novi Beograd", and the day after as "Sutra"', async () => {
  rows = [
    { ...agreement('t', 'CONFIRMED'), prihvacenPocetak: '2026-09-24T12:00:00Z', putanjaTekst: 'Novi Beograd', vremeTekst: 'IGNORED DISPLAY TEXT' },
    { ...agreement('m', 'CONFIRMED'), prihvacenPocetak: '2026-09-25T07:30:00Z', putanjaTekst: 'Zemun', vremeTekst: 'IGNORED DISPLAY TEXT' },
    { ...agreement('r', 'CONFIRMED'), rezim: 'DALJINSKI', prihvacenPocetak: '2026-09-26T07:00:00Z', putanjaTekst: 'SKRIVENO' },
  ];
  await render();
  expect(cardTexts('Posao t')).toContain('Danas 14:00 · Novi Beograd');
  expect(cardTexts('Posao m')).toContain('Sutra 09:30 · Zemun');
  expect(cardTexts('Posao r')).toContain('26. sep · 09:00 · Na daljinu');
  expect(cardTexts('Posao t')).not.toContain('IGNORED DISPLAY TEXT'); expect(cardTexts('Posao r')).not.toContain('SKRIVENO');
});
test('a card wears one state chip: Dogovoren, U toku, Čeka potvrdu, Završen or Otkazan, with its shape and word', async () => {
  const { STATUS_CHIPS } = require('../../ui/system/StatusChip');
  rows = [
    { ...agreement('agreed', 'CONFIRMED'), prihvacenPocetak: '2026-09-25T10:00:00Z' },
    { ...agreement('now', 'CONFIRMED'), prihvacenPocetak: '2026-09-24T08:00:00Z', tacanTermin: { pocetak: '2026-09-24T08:00:00Z', kraj: '2026-09-24T10:00:00Z' } },
    agreement('waits', 'AWAITING_REQUESTER'),
    { ...agreement('rate', 'COMPLETED'), ocenaMoguca: true },
    agreement('done', 'COMPLETED'), agreement('off', 'CANCELLED'),
  ];
  await render();
  const chipWord = (title: string) => card(title).findAllByType('T' as React.ElementType).map(node => node.props.children).filter(text => typeof text === 'string' && /^(Dogovoren|U toku|Čeka potvrdu|Završen|Otkazan)/.test(text));
  expect(chipWord('Posao agreed')).toEqual(['Dogovoren · izmenjeni uslovi']);
  expect(chipWord('Posao now')).toEqual(['U toku · izmenjeni uslovi']);
  expect(chipWord('Posao waits')).toEqual(['Čeka potvrdu · izmenjeni uslovi']);
  expect(chipWord('Posao rate')).toEqual(['Završen · izmenjeni uslovi']);
  expect(STATUS_CHIPS['task.now'].word).toBe('U toku');
  await tap('Istorija');
  expect(chipWord('Posao done')).toEqual(['Završen · izmenjeni uslovi']);
  expect(chipWord('Posao off')).toEqual(['Otkazan · izmenjeni uslovi']);
  // Nothing about who cancelled or when: the Dogovor carries none of it, and a card invents nothing.
  expect(cardTexts('Posao off')).not.toMatch(/Otkazao|Otkazala|otkazan\w* (od|u)|Razlog/);
});
test('a Dogovor whose day is behind us is not "Danas": it stands under "Ranije", before today\'s', async () => {
  rows = [{ ...agreement('yesterday', 'CONFIRMED'), prihvacenPocetak: '2026-09-23T10:00:00Z' }, { ...agreement('today', 'CONFIRMED'), prihvacenPocetak: '2026-09-24T14:00:00Z' }];
  await render();
  expect(headers()).toEqual(['Ranije', 'Danas']);
  expect(titles()).toEqual(['yesterday', 'today'].map(id => `Otvori Dogovor Posao ${id}`));
});

test('active order follows accepted instants after rescheduling, preserving offsets, microseconds and unknown order', async () => {
  rows = [
    { ...agreement('task-only', 'CONFIRMED'), pocinje: '2026-01-01T10:00:00Z' },
    { ...agreement('rescheduled-later', 'CONFIRMED'), pocinje: '2026-01-02T10:00:00Z', prihvacenPocetak: '2026-09-29T10:00:00Z' },
    { ...agreement('micro-later', 'CONFIRMED'), prihvacenPocetak: '2026-09-28T09:00:00.000002Z' },
    { ...agreement('earlier-offset', 'CONFIRMED'), pocinje: '2026-12-01T10:00:00Z', prihvacenPocetak: '2026-09-28T11:00:00.000001+02:00' },
    { ...agreement('same-instant', 'CONFIRMED'), prihvacenPocetak: '2026-09-28T09:00:00.000001Z' },
    { ...agreement('invalid', 'CONFIRMED'), pocinje: '2026-01-03T10:00:00Z', prihvacenPocetak: '2026-02-30T10:00:00Z' },
    { ...agreement('no-term', 'CONFIRMED'), prihvacenPocetak: null },
  ];
  await render();
  expect(titles()).toEqual(['earlier-offset', 'same-instant', 'micro-later', 'rescheduled-later', 'task-only', 'invalid', 'no-term']
    .map(id => `Otvori Dogovor Posao ${id}`));
});

// V41 (owner, 2026-09-23): the underlined tabs carry their counts, and a foot on a card appears only when that
// Dogovor waits for me. Round-1 critique A11 (owner step 8): the line under the tabs that counted again is gone.
const card = (title: string) => tree.root.findAllByType('Press' as React.ElementType).find(node => node.props.accessibilityLabel === `Otvori Dogovor ${title}`)!;
const cardTexts = (title: string) => card(title).findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
test('the two sets are equal halves that never scroll, and only what waits for me carries a number, once the read settles', async () => {
  await render();
  // Composition spec 4.8: two sets of equal width in one row - not content-sized, never a scroller, nothing cut off.
  expect(tree.root.findByType(Segmented).props.contentSized).toBeUndefined();
  expect(tree.root.findByType(Segmented).props.scroll).toBeUndefined();
  // The number is the count of the first group ("Čeka tebe") and is orange; Istorija is never counted, and no line counts again.
  expect(tree.root.findByType(Segmented).props.options.map((option: { key: string; badge?: number; badgeTone?: string }) => [option.key, option.badge, option.badgeTone]))
    .toEqual([['active', 1, 'attention'], ['history', undefined, undefined]]);
  expect(texts()).not.toContain('3 Dogovora'); expect(texts()).not.toContain('2 Dogovora');
  // Nothing waits for me: no number at all (a zero on a badge reads as news).
  rows = rows.filter(row => row.id !== 'waiting-mine');
  await act(async () => tree.update(<Screen />));
  expect(tree.root.findByType(Segmented).props.options.map((option: { badge?: number }) => option.badge)).toEqual([undefined, undefined]);
  await act(async () => tree.unmount()); loading = true; await render();
  expect(tree.root.findByType(Segmented).props.options.every((option: { badge?: number }) => option.badge === undefined)).toBe(true);
});
test('the number on Aktivni is the size of the group "Čeka tebe", and a screen reader hears it with the verb of its count', async () => {
  rows = [{ ...agreement('a', 'CONFIRMED'), izmenaCeka: { predlogId: 'p', mojPredlog: false } }, agreement('b', 'AWAITING_REQUESTER'),
    { ...agreement('c', 'COMPLETED'), ocenaMoguca: true }, agreement('plain', 'CONFIRMED')];
  await render();
  expect(headers()[0]).toBe('Čeka tebe');
  expect(tree.root.findByProps({ accessibilityLabel: 'Aktivni' }).props.accessibilityValue).toEqual({ text: '3 Dogovora čekaju tebe' });
  expect(tree.root.findByType(Segmented).props.options[0].badge).toBe(3);
});
test('only a Dogovor that waits for me carries the strip, in the order the Dogovor itself leads with', async () => {
  rows = [{ ...agreement('change', 'CONFIRMED'), izmenaCeka: { predlogId: 'p1', mojPredlog: false } },
    { ...agreement('mine', 'CONFIRMED'), izmenaCeka: { predlogId: 'p2', mojPredlog: true } },
    agreement('confirm', 'AWAITING_REQUESTER'), { ...agreement('blocked', 'AWAITING_REQUESTER'), izmenaCeka: { predlogId: 'p3', mojPredlog: true } },
    agreement('worker-waits', 'AWAITING_REQUESTER', false), agreement('plain', 'CONFIRMED')];
  await render();
  expect(cardTexts('Posao change')).toContain('Odgovori na predlog izmene'); expect(card('Posao change').props.accessibilityHint).toBe('Odgovori na predlog izmene. Prihvaćeni uslovi važe dok ne odgovoriš.');
  // My own proposal waits for the other side: said quietly, never as my task.
  expect(cardTexts('Posao mine')).toContain('Tvoja izmena čeka odgovor'); expect(card('Posao mine').props.accessibilityHint).toBeUndefined();
  expect(cardTexts('Posao confirm')).toContain('Potvrdi završetak'); expect(cardTexts('Posao confirm')).toContain('Čeka potvrdu');
  // A pending change blocks completion, so no strip asks for a confirmation the server would refuse.
  expect(cardTexts('Posao blocked')).not.toContain('Potvrdi završetak');
  expect(cardTexts('Posao worker-waits')).toContain('Čeka potvrdu'); expect(card('Posao worker-waits').props.accessibilityHint).toBeUndefined();
  // The chip is orange only for the confirmation that is mine; the same words wait quietly for the other side's.
  const { STATUS_TONES } = require('../../ui/system/StatusChip');
  const ground = (title: string) => StyleSheet.flatten(card(title).findByProps({ testID: 'status-chip' }).props.style).backgroundColor;
  expect(ground('Posao confirm')).toBe(STATUS_TONES.attention.ground);
  expect(ground('Posao worker-waits')).toBe(STATUS_TONES.neutral.ground);
  expect(ground('Posao plain')).toBe(STATUS_TONES.green.ground);
  expect(card('Posao plain').props.accessibilityHint).toBeUndefined(); expect(cardTexts('Posao plain')).not.toMatch(/Potvrdi|Odgovori|Oceni|Čeka/);
});
test('a term that is missing stays one sentence and a missing place or amount is said in words, never as a value', async () => {
  rows = [{ ...agreement('bare', 'CONFIRMED'), vremeTekst: 'Termin nije potvrđen', putanjaTekst: '', cena: { iznos: Number.NaN, valuta: 'RSD', prikaz: '' } }];
  await render(); const text = cardTexts('Posao bare');
  expect(text).toContain('Termin nije dogovoren'); expect(text).not.toContain('Termin nije potvrđen'); expect(text).toContain('Mesto nije navedeno'); expect(text).toContain('Iznos nije sačuvan');
  expect(text).not.toContain('ukupno');
});
// Round-1 critique A3: a finished or cancelled Dogovor that never had a time is not waiting for one.
test.each(['COMPLETED', 'CANCELLED'] as const)('a %s Dogovor without a time says "Bez tačnog termina", never "Termin nije potvrđen"', async state => {
  rows = [{ ...agreement('over', state), vremeTekst: 'Termin nije potvrđen' }];
  await render(); await tap('Istorija');
  const text = cardTexts('Posao over');
  expect(text).toContain('Bez tačnog termina'); expect(text).not.toContain('Termin nije potvrđen');
  // The spoken card says the same words as the drawn one.
  expect(card('Posao over').props.accessibilityValue.text).toContain('Bez tačnog termina');
});
// Round-1 critique B15: the date broke over three lines beside the amount. It is one full line now, and the zone note a
// phone set outside Serbia carries stands on a quiet line of its own.
test('the term is one full line and its zone note stands on its own line', async () => {
  rows = [{ ...agreement('zone', 'CONFIRMED'), vremeTekst: '24. sep · 17:00–19:00 (po vremenu u Srbiji)' }];
  await render();
  const lines = card('Posao zone').findAllByType('T' as React.ElementType).map(node => node.children.filter(child => typeof child === 'string').join(''));
  // The time and the place are one grey line (plan 2.6); the zone note a phone outside Serbia carries is a quiet line of its own.
  expect(lines).toContain('24. sep · 17:00–19:00 · Novi Sad'); expect(lines).toContain('Po vremenu u Srbiji');
  expect(lines.some(line => line.includes('(po vremenu u Srbiji)'))).toBe(false);
});
// Round-1 critique B16: the whole card is the press, so it draws no caret of its own.
test('a card draws no caret; the body is the one press that opens the Dogovor', async () => {
  const { CaretRight } = require('phosphor-react-native');
  await render();
  expect(tree.root.findAllByType(CaretRight)).toHaveLength(0);
});
// Round-1 critique A13 applied to the card: "1 osoba" beside the one person the card already shows said them twice.
test('a card says how many people only when it is more than the one person it shows', async () => {
  rows = [{ ...agreement('one', 'CONFIRMED'), pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 } }, agreement('three', 'CONFIRMED')];
  await render();
  // The count joins the grey line under the title ("ime · uloga · 3 osobe"): the accepted total is for all of them.
  expect(cardTexts('Posao one')).not.toContain('1 osoba');
  expect(cardTexts('Posao three')).toContain('3 osobe');
  expect(card('Posao three').findAllByType('T' as React.ElementType).some(node => node.props.children === 'Druga osoba · Uskače na tvoj zadatak · 3 osobe')).toBe(true);
});

// Round-1 critique A2 and B1 (owner step 8): the "Oceni saradnju" strip looked like a button and opened the Dogovor. It
// is its own press now, straight to the rating the route guards, drawn on white under a hairline with an orange dot.
describe('the rating strip is a press of its own', () => {
  const rate = jest.fn();
  const flat = (style: unknown): Record<string, unknown> => Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : (style as Record<string, unknown>) ?? {};
  function Rated() {
    return <AgreementCollectionPresentation items={rows} loading={false} error={false} section="active" confirmationOnly={false}
      onSection={() => {}} onConfirmationOnly={() => {}} onOpen={open} onRate={rate} onRefresh={refresh} onHome={tasks}
      onCalendar={() => {}} onProfile={() => {}} />;
  }
  beforeEach(() => { rate.mockClear(); rows = [{ ...agreement('done-unrated', 'COMPLETED'), ocenaMoguca: true }, agreement('plain', 'CONFIRMED')]; });
  test('it is labelled with the Dogovor, goes to the rating with that Dogovor, and never opens the Dogovor', async () => {
    await act(async () => { tree = create(<Rated />); });
    const strip = tree.root.findByProps({ accessibilityLabel: 'Oceni saradnju, Posao done-unrated' });
    expect(strip.type).toBe('Press'); expect(strip.props.accessibilityRole).toBe('button');
    await act(async () => strip.props.onPress());
    expect(rate).toHaveBeenCalledTimes(1); expect(rate).toHaveBeenCalledWith(rows[0]); expect(open).not.toHaveBeenCalled();
    // The strip is a sibling of the body, never inside it, and the body no longer speaks the rating as its own hint.
    expect(card('Posao done-unrated').findAllByProps({ accessibilityLabel: 'Oceni saradnju, Posao done-unrated' })).toHaveLength(0);
    expect(card('Posao done-unrated').props.accessibilityHint).toBeUndefined();
    expect(cardTexts('Posao done-unrated')).not.toContain('Oceni saradnju');
    await act(async () => card('Posao done-unrated').props.onPress()); expect(open).toHaveBeenCalledWith(rows[0]); expect(rate).toHaveBeenCalledTimes(1);
    // Only a Dogovor that waits for my rating has the strip.
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Oceni saradnju, Posao plain' })).toHaveLength(0);
  });
  test('it is drawn on white under a hairline with an 8 dp orange dot and warn words; the card keeps its plain edge', async () => {
    const { sys } = require('../../ui/system/tokens');
    await act(async () => { tree = create(<Rated />); });
    const strip = tree.root.findByProps({ accessibilityLabel: 'Oceni saradnju, Posao done-unrated' });
    // The rule separates the independent target. Colour belongs to the actual next action, not a tinted panel.
    expect(flat(strip.props.style)).toMatchObject({ borderTopWidth: 1, borderTopColor: sys.color.line, minHeight: 48 });
    expect(flat(strip.props.style).backgroundColor).toBe(sys.color.surface);
    const dots = strip.findAll(node => typeof node.type === 'string' && flat(node.props.style).backgroundColor === sys.color.orange);
    expect(dots).toHaveLength(1); expect(flat(dots[0].props.style)).toMatchObject({ width: 8, height: 8 });
    const words = strip.findAllByType('T' as React.ElementType).find(node => node.children.includes('Oceni saradnju'))!;
    expect(flat(words.props.style).color).toBe(sys.color.warn);
    // No orange card edge and no orange fill anywhere on the list: the dot is the only orange. (The one other orange of the screen is the
    // count on the tab "Aktivni", for what waits for me; it is the control's, not the list's.)
    const tabs = new Set(tree.root.findByType(Segmented).findAll(() => true));
    const fills = tree.root.findAll(node => !tabs.has(node) && typeof node.type === 'string' && [sys.color.orange, sys.color.orangeSoft, sys.color.orangeHalo]
      .includes(flat(node.props.style).backgroundColor as string) && flat(node.props.style).width !== 8);
    expect(fills).toHaveLength(0);
    expect(tree.root.findAll(node => [sys.color.orange, sys.color.orangeHalo].includes(flat(node.props.style).borderColor as string))).toHaveLength(0);
  });
});

// Round-1 critique A12: the header is profile · mark · bell on all three tabs; the calendar is a view of these Dogovori,
// so it ends the Aktivni/Istorija tab row as a quiet icon with the same spoken label.
test('the header is profile, mark and bell only, and the calendar ends the tab row under the same label', async () => {
  const calendar = jest.fn();
  await act(async () => { tree = create(<AgreementCollectionPresentation items={rows} loading={false} error={false} section="active"
    confirmationOnly={false} onSection={() => {}} onConfirmationOnly={() => {}} onOpen={open} onRefresh={refresh} onHome={tasks}
    onCalendar={calendar} onProfile={() => {}} />); });
  const { ScreenChrome } = require('../../ui/system/ScreenChrome');
  const bar = tree.root.findByType(ScreenChrome);
  expect(bar.props).toMatchObject({ variant: 'root', title: 'Dogovori' });
  expect(bar.props.right).toBeUndefined();
  expect(bar.findAll(node => node.props.accessibilityLabel === 'Raspored')).toHaveLength(0);
  // The calendar stands in the same row as the two sets, after them. The sets are equal halves of the room that is left, and
  // never slide sideways (composition spec 4.8): the control is cut off by nothing, at any text size.
  const scroller = tree.root.findByType(Segmented).parent!;
  expect(tree.root.findByType(Segmented).props.scroll).toBeUndefined();
  expect(scroller.type).toBe('View');
  const tabRow = scroller.parent!;
  const entry = tabRow.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityLabel === 'Raspored');
  expect(entry).toHaveLength(1);
  expect(tabRow.children.map(child => typeof child === 'string' ? child : child === scroller ? 'tabs' : child.props.label))
    .toEqual(['tabs', 'Raspored']);
  // Composition spec 4.8: the planner's entry is the calendar as an icon button, 48 dp, in the same row; its word is its spoken
  // label (the plan's pill with the word beside the glyph is what pushed "Istorija" out of the row).
  const pill = tabRow.children.find(child => typeof child !== 'string' && child !== scroller) as ReactTestInstance;
  expect(pill.props).toMatchObject({ glyph: 'calendar', label: 'Raspored' }); expect(pill.props.caption).toBeUndefined();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Raspored' }).filter(node => node.type === ('Press' as React.ElementType))).toHaveLength(1);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Kalendar obaveza' })).toHaveLength(0);
  await act(async () => entry[0].props.onPress());
  expect(calendar).toHaveBeenCalledTimes(1);
});

// Review r3 item 7: the filtered-empty view's one way forward must clear BOTH the set and the confirmation filter,
// or it could land on another empty view. With "Svi" gone (A11) it leads to the set that holds Dogovori.
test('an empty set leads to the set that holds Dogovori and turns the confirmation filter off', async () => {
  const onSection = jest.fn(), onConfirmationOnly = jest.fn();
  rows = [agreement('done', 'COMPLETED')];
  await act(async () => { tree = create(<AgreementCollectionPresentation items={rows} loading={false} error={false} section="active"
    confirmationOnly onSection={onSection} onConfirmationOnly={onConfirmationOnly} onOpen={open} onRefresh={refresh} onHome={tasks}
    onCalendar={() => {}} onProfile={() => {}} />); });
  expect(texts()).toContain('Nijedan Dogovor ne čeka tvoju potvrdu');
  await act(async () => tree.root.findByProps({ label: 'Pogledaj istoriju' }).props.onPress());
  expect(onSection).toHaveBeenCalledTimes(1); expect(onSection).toHaveBeenCalledWith('history');
  expect(onConfirmationOnly).toHaveBeenCalledTimes(1); expect(onConfirmationOnly).toHaveBeenCalledWith(false);
  expect(refresh).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
  // Through the real screen state the same press leaves a list, not another empty view.
  await act(async () => tree.unmount());
  await render();
  expect(texts()).toContain('Nema aktivnih Dogovora');
  await act(async () => tree.root.findByProps({ label: 'Pogledaj istoriju' }).props.onPress());
  expect(titles()).toEqual(['Otvori Dogovor Posao done']);
  // And back: an empty history leads to the active Dogovori.
  await act(async () => tree.unmount());
  rows = [agreement('live', 'CONFIRMED')]; await render(); await tap('Istorija');
  expect(texts()).toContain('Još nema završenih Dogovora');
  await act(async () => tree.root.findByProps({ label: 'Pogledaj aktivne Dogovore' }).props.onPress());
  expect(titles()).toEqual(['Otvori Dogovor Posao live']);
});

// CANCEL-INFO (applied to canonical DEV 2026-10-07): a cancelled Dogovor says when, by whom and why, in one grey line, once the server
// has answered; until then, or if it never does, the chip alone says "Otkazan" and nothing is guessed.
describe('a cancelled Dogovor says when, by whom and why', () => {
  const answer = (id: string, patch: Record<string, unknown> = {}) => ({ agreementId: id, cancelledAt: '2026-09-23T10:00:00Z', by: 'WORKER', byMe: true,
    reason: 'Promenio sam plan.', reasonState: 'KEPT', ...patch });
  function Cancelled({ cancellations }: { cancellations?: Map<string, any> | null }) {
    return <AgreementCollectionPresentation items={rows} loading={false} error={false} section="history" confirmationOnly={false} now={NOW}
      onSection={() => {}} onConfirmationOnly={() => {}} onOpen={open} onRefresh={refresh} onHome={tasks} onCalendar={() => {}} onProfile={() => {}}
      cancellations={cancellations} />;
  }
  beforeEach(() => { rows = [agreement('off', 'CANCELLED'), agreement('over', 'COMPLETED')]; });

  test('writes "Otkazano {datum} · {ko} · {razlog}" under the chip, for the cancelled one only', async () => {
    await act(async () => { tree = create(<Cancelled cancellations={new Map([['off', answer('off')], ['over', answer('over')]])} />); });
    expect(cardTexts('Posao off')).toContain('Otkazano 23. sep · 12:00 · Ti · Promenio sam plan.');
    // A finished Dogovor is not cancelled, whatever a map says about its id.
    expect(cardTexts('Posao over')).not.toContain('Otkazano');
    expect(card('Posao off').props.accessibilityValue.text).toContain('Otkazano 23. sep · 12:00 · Ti · Promenio sam plan.');
  });

  test('names the other person when they cancelled, and says why a reason is missing', async () => {
    await act(async () => { tree = create(<Cancelled cancellations={new Map([['off', answer('off', { by: 'REQUESTER', byMe: false, reason: null, reasonState: 'NOT_KEPT' })]])} />); });
    expect(cardTexts('Posao off')).toContain('Otkazano 23. sep · 12:00 · Druga osoba · Razlog nije sačuvan');
    await act(async () => tree.update(<Cancelled cancellations={new Map([['off', answer('off', { by: null, byMe: null, reason: null, reasonState: 'REMOVED' })]])} />));
    expect(cardTexts('Posao off')).toContain('Otkazano 23. sep · 12:00 · Razlog je uklonjen');
  });

  test('says only "Otkazan" - the chip - when the server has said nothing about it, and invents nothing', async () => {
    for (const cancellations of [undefined, null, new Map()]) {
      await act(async () => { tree = create(<Cancelled cancellations={cancellations} />); });
      expect(cardTexts('Posao off')).not.toMatch(/Otkazano|Razlog|Ti ·/); expect(cardTexts('Posao off')).toContain('Otkazan');
      await act(async () => tree.unmount());
    }
  });
});

// Composition spec T7: an empty list names the next step, and there are two ways a Dogovor begins.
describe('the empty list leads to the two ways a Dogovor begins', () => {
  test('offers the tasks and publishing when the route can take the person there; Početna stays as the way back only without them', async () => {
    const onTasks = jest.fn(), onPublish = jest.fn();
    rows = [];
    await act(async () => { tree = create(<AgreementCollectionPresentation items={rows} loading={false} error={false} section="active" confirmationOnly={false}
      onSection={() => {}} onConfirmationOnly={() => {}} onOpen={open} onRefresh={refresh} onHome={tasks} onCalendar={() => {}} onProfile={() => {}}
      onTasks={onTasks} onPublish={onPublish} />); });
    await act(async () => tree.root.findByProps({ label: 'Pogledaj zadatke' }).props.onPress()); expect(onTasks).toHaveBeenCalledTimes(1);
    await act(async () => tree.root.findByProps({ label: 'Objavi zadatak' }).props.onPress()); expect(onPublish).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByProps({ label: 'Idi na Početnu' })).toHaveLength(0); expect(tasks).not.toHaveBeenCalled();
    // Only the tasks, no way to publish: the quiet way is Početna.
    await act(async () => tree.update(<AgreementCollectionPresentation items={rows} loading={false} error={false} section="active" confirmationOnly={false}
      onSection={() => {}} onConfirmationOnly={() => {}} onOpen={open} onRefresh={refresh} onHome={tasks} onCalendar={() => {}} onProfile={() => {}} onTasks={onTasks} />));
    expect(tree.root.findAllByProps({ label: 'Pogledaj zadatke' })).toHaveLength(1); expect(tree.root.findAllByProps({ label: 'Idi na Početnu' })).toHaveLength(1);
    expect(tree.root.findAllByProps({ label: 'Objavi zadatak' })).toHaveLength(0);
  });
});

// M-02 (motion spec 2026-10-07): rows arrive only when they are news. After a skeleton the first rows (never more than six) settle in once;
// a list that was already there, and a change of set or filter, stay still.
test('the first rows after a skeleton arrive once, at most six; a warm list and a change of set do not move', async () => {
  const arriving = () => tree.root.findAll(node => String(node.type) === 'View' && node.props.entering !== undefined).length;
  rows = []; loading = true; await render();
  expect(arriving()).toBe(0);
  loading = false;
  rows = Array.from({ length: 9 }, (_, index) => agreement(`row-${index}`, 'CONFIRMED'));
  await act(async () => tree.update(<Screen />));
  expect(arriving()).toBeGreaterThan(0); expect(arriving()).toBeLessThanOrEqual(6);
  await act(async () => tree.unmount());
  // Warm: the rows were there when the screen opened, so there is nothing to tell by moving.
  rows = [agreement('warm', 'CONFIRMED'), agreement('over', 'COMPLETED')];
  await render();
  expect(arriving()).toBe(0);
  await tap('Istorija'); expect(arriving()).toBe(0);
});

// M-02 (motion spec 2026-10-07): rows arrive only when they are news. After a skeleton the first rows (never more than six) settle in once;
// a list that was already there, and a change of set or filter, stay still.
test('the first rows after a skeleton arrive once, at most six; a warm list and a change of set do not move', async () => {
  const arriving = () => tree.root.findAll(node => String(node.type) === 'View' && node.props.entering !== undefined).length;
  rows = []; loading = true; await render();
  expect(arriving()).toBe(0);
  loading = false;
  rows = Array.from({ length: 9 }, (_, index) => agreement(`row-${index}`, 'CONFIRMED'));
  await act(async () => tree.update(<Screen />));
  expect(arriving()).toBeGreaterThan(0); expect(arriving()).toBeLessThanOrEqual(6);
  await act(async () => tree.unmount());
  // Warm: the rows were there when the screen opened, so there is nothing to tell by moving.
  rows = [agreement('warm', 'CONFIRMED'), agreement('over', 'COMPLETED')];
  await render();
  expect(arriving()).toBe(0);
  await tap('Istorija'); expect(arriving()).toBe(0);
});
