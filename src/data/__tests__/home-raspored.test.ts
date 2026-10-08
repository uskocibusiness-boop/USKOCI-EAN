import type { DogovorProjekcija } from '../../contracts/projections';
import { calendarInstant } from '../../lib/calendarTime';
import { composeHome, type HomeReads, type HomeRow } from '../homeSnapshot';
import { acceptedTerm, awaitingFinishCount, dayWord, inWeek, looseLine, moreLine, notOver, rasporedOf, rasporedWhen, serbianWeek, withoutTermCount } from '../../ui/home/raspored';

/**
 * Raspored on Početna (owner, 2026-10-07): the next accepted appointment is told day first, in Serbian time, from its
 * accepted instants. Jest runs with TZ=UTC, so every expectation below that holds also proves that the phone's own zone
 * is never read: a Belgrade midnight is 22:00 or 23:00 UTC, and "Danas" is decided there.
 */
const ME = 'me', OTHER = 'other', FACE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const at = (iso: string) => new Date(iso);
const window = (pocetak: string, kraj: string) => ({ pocetak, kraj });
const term = (start: string, end?: string) => acceptedTerm({ prihvacenPocetak: start, tacanTermin: end ? window(start, end) : null })!;

const agreement = (id: string, patch: Partial<DogovorProjekcija> = {}, mine: 'narucilac' | 'uskocer' = 'uskocer'): DogovorProjekcija => ({
  id, verzija: 1, naslov: `Dogovor ${id}`, stanje: 'CONFIRMED', cena: { iznos: 3000, valuta: 'RSD', prikaz: '3.000 RSD' }, vremeTekst: 'Fleksibilno',
  putanjaTekst: '', pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 },
  ucesnici: [{ id: ME, profilId: null, ime: 'Ja', inicijali: 'JA', uloga: mine, mesta: null, viSte: true, telefon: null },
    { id: OTHER, profilId: FACE, ime: 'Jelena Petrović', inicijali: 'JP', uloga: mine === 'narucilac' ? 'uskocer' : 'narucilac', mesta: 1, viSte: false, telefon: null }],
  rezim: 'FIZICKI', kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true, tacnaLokacija: null, emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null, izmenaCeka: null,
  izvor: { zadatakId: null, prijavaId: null }, ...patch });
/** An accepted exact window, the way the Dogovori read carries it: the start twice (accepted start and window) and the end. */
const exact = (id: string, start: string, end: string, patch: Partial<DogovorProjekcija> = {}) =>
  agreement(id, { prihvacenPocetak: start, tacanTermin: window(start, end), ...patch });
const known = <T,>(value: T) => ({ kind: 'known' as const, value });
const reads = (agreements: DogovorProjekcija[]): HomeReads => ({ needs: known([]), applications: known([]), agreements: known(agreements) });
const rows = (home: ReturnType<typeof composeHome>): HomeRow[] => home.agreements.kind === 'known' ? home.agreements.value.rows : [];
/** The quiet line of Raspored without a card, or undefined when the snapshot has none. */
const loose = (home: ReturnType<typeof composeHome>) => home.agreements.kind === 'known' ? home.agreements.value.quietLine : undefined;
/** An active Dogovor whose accepted term has no start and no end ("Termin nije potvrđen"): the list carries `tacanTermin: null` for it. */
const unconfirmed = (id: string, patch: Partial<DogovorProjekcija> = {}) =>
  agreement(id, { vremeTekst: 'Termin nije potvrđen', prihvacenPocetak: null, tacanTermin: null, ...patch });
/** A confirmed Dogovor whose exact term ended on 6 October (before every "now" below) and that nobody has marked done. */
const overdue = (id: string, patch: Partial<DogovorProjekcija> = {}) => exact(id, '2026-10-06T08:00:00Z', '2026-10-06T09:00:00Z', patch);

describe('dayWord: a civil day as seen from today, in words', () => {
  it.each([
    ['2026-10-07', 'Danas'], ['2026-10-08', 'Sutra'], ['2026-10-06', 'Juče'],
    // Two to six days ahead the weekday names the day; a week away it would name two, so the date is said too.
    ['2026-10-09', 'Petak'], ['2026-10-13', 'Utorak'], ['2026-10-14', 'Sreda, 14. okt'], ['2026-10-05', 'Ponedeljak, 5. okt'],
  ])('%s from Wednesday 2026-10-07 is %j', (day, word) => { expect(dayWord(day, '2026-10-07')).toBe(word); });

  it('says the year only when it is not the current one, and counts across the new year', () => {
    expect(dayWord('2027-01-01', '2026-12-31')).toBe('Sutra');
    expect(dayWord('2027-01-05', '2026-12-31')).toBe('Utorak');
    expect(dayWord('2027-01-14', '2026-12-31')).toBe('Četvrtak, 14. jan 2027');
    expect(dayWord('2026-12-24', '2026-12-31')).toBe('Četvrtak, 24. dec');
  });
});

describe('rasporedWhen: the first line, day first, in Serbian time', () => {
  const now = at('2026-10-07T09:00:00Z');
  it.each([
    ['today', '2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z', 'Danas · 14:00–16:00', 'Danas, od 14:00 do 16:00'],
    ['tomorrow', '2026-10-08T07:30:00Z', '2026-10-08T08:00:00Z', 'Sutra · 09:30–10:00', 'Sutra, od 09:30 do 10:00'],
    ['a weekday', '2026-10-09T15:00:00Z', '2026-10-09T16:00:00Z', 'Petak · 17:00–18:00', 'Petak, od 17:00 do 18:00'],
    ['a week away', '2026-10-14T06:00:00Z', '2026-10-14T07:00:00Z', 'Sreda, 14. okt · 08:00–09:00', 'Sreda, 14. okt, od 08:00 do 09:00'],
    ['a window across midnight', '2026-10-07T20:00:00Z', '2026-10-07T23:30:00Z', 'Danas · 22:00 – sutra 01:30', 'Danas, od 22:00 do sutra 01:30'],
    ['both ends in the same minute', '2026-10-07T12:00:10Z', '2026-10-07T12:00:50Z', 'Danas · 14:00', 'Danas, 14:00'],
  ])('%s', (_name, start, end, text, spoken) => {
    expect(rasporedWhen(term(start, end), now)).toEqual({ text, spoken });
  });

  it('keeps one stored bound as one bound: the end is never invented', () => {
    expect(rasporedWhen(term('2026-10-08T08:00:00Z'), now)).toEqual({ text: 'Sutra · od 10:00', spoken: 'Sutra, od 10:00' });
  });

  it('decides "Danas" and "Sutra" at the Serbian midnight, not the phone\'s and not UTC\'s (summer time, UTC+2)', () => {
    const night = term('2026-10-07T22:00:00Z', '2026-10-07T23:00:00Z'); // 00:00–01:00 on 8 October in Belgrade
    expect(rasporedWhen(night, at('2026-10-07T21:59:59Z'))?.text).toBe('Sutra · 00:00–01:00');
    expect(rasporedWhen(night, at('2026-10-07T22:00:00Z'))?.text).toBe('Danas · 00:00–01:00');
    // One second before that midnight is still 7 October in Belgrade, though it is 22:00 on 7 October in UTC too: a window
    // that starts there and crosses the midnight says both days.
    const late = term('2026-10-07T21:59:59Z', '2026-10-07T22:30:00Z');
    expect(rasporedWhen(late, at('2026-10-07T12:00:00Z'))?.text).toBe('Danas · 23:59 – sutra 00:30');
    // 22:30 UTC is 00:30 the next day in Belgrade: tomorrow, though UTC still calls it today.
    expect(rasporedWhen(term('2026-10-07T22:30:00Z', '2026-10-07T23:30:00Z'), at('2026-10-07T12:00:00Z'))?.text).toBe('Sutra · 00:30–01:30');
  });

  it('decides it at the Serbian midnight in winter too (UTC+1) and across the new year', () => {
    const night = term('2026-12-31T23:00:00Z', '2027-01-01T00:00:00Z'); // 00:00–01:00 on 1 January in Belgrade
    expect(rasporedWhen(night, at('2026-12-31T22:30:00Z'))?.text).toBe('Sutra · 00:00–01:00');
    expect(rasporedWhen(night, at('2026-12-31T23:00:00Z'))?.text).toBe('Danas · 00:00–01:00');
    expect(rasporedWhen(night, at('2026-12-31T22:59:59Z'))?.text).toBe('Sutra · 00:00–01:00');
  });

  it('names both offsets when a clock change falls inside the window, so equal clocks are not a window of no length', () => {
    // 25 October 2026, 03:00 summer time becomes 02:00: 00:30Z is 02:30 (UTC+2) and 01:30Z is 02:30 again (UTC+1).
    expect(rasporedWhen(term('2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z'), at('2026-10-24T10:00:00Z'))?.text)
      .toBe('Sutra · 02:30 (UTC+02:00)–02:30 (UTC+01:00)');
    // 29 March 2026, 02:00 becomes 03:00: 00:30Z is 01:30 (UTC+1), 01:30Z is 03:30 (UTC+2).
    expect(rasporedWhen(term('2026-03-29T00:30:00Z', '2026-03-29T01:30:00Z'), at('2026-03-28T10:00:00Z'))?.text)
      .toBe('Sutra · 01:30 (UTC+01:00)–03:30 (UTC+02:00)');
  });

  it('is null when "now" cannot be read, never a made-up day', () => {
    expect(rasporedWhen(term('2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z'), new Date(Number.NaN))).toBeNull();
  });
});

describe('acceptedTerm and notOver: which instants a Dogovor can be placed by', () => {
  it('prefers the exact window, falls back to the accepted start alone, and has nothing when neither is readable', () => {
    expect(acceptedTerm({ prihvacenPocetak: '2026-10-07T12:00:00Z', tacanTermin: window('2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z') }))
      .toMatchObject({ start: '2026-10-07T12:00:00Z', end: '2026-10-07T14:00:00Z' });
    expect(acceptedTerm({ prihvacenPocetak: '2026-10-07T12:00:00Z', tacanTermin: null })).toMatchObject({ start: '2026-10-07T12:00:00Z', end: null, endAt: null });
    expect(acceptedTerm({ prihvacenPocetak: '2026-10-07T12:00:00Z' })).toMatchObject({ end: null });
    expect(acceptedTerm({ prihvacenPocetak: null, tacanTermin: null })).toBeNull();
    expect(acceptedTerm({})).toBeNull();
    expect(acceptedTerm({ prihvacenPocetak: 'not-a-date', tacanTermin: undefined })).toBeNull();
    // A window whose end does not follow its start is not a window; the accepted start still stands, alone.
    expect(acceptedTerm({ prihvacenPocetak: '2026-10-07T12:00:00Z', tacanTermin: window('2026-10-07T12:00:00Z', '2026-10-07T12:00:00Z') }))
      .toMatchObject({ end: null });
    // An end with no start is not placed on any day.
    expect(acceptedTerm({ prihvacenPocetak: null, tacanTermin: window('x', '2026-10-07T14:00:00Z') })).toBeNull();
  });

  it('is not over while its start is ahead or its window is under way, and over at the end of the window', () => {
    const now = (iso: string) => calendarInstant(iso)!;
    const slot = term('2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z'), lone = term('2026-10-07T12:00:00Z');
    expect([notOver(slot, now('2026-10-07T11:59:59Z')), notOver(slot, now('2026-10-07T13:00:00Z')), notOver(slot, now('2026-10-07T13:59:59Z'))]).toEqual([true, true, true]);
    expect([notOver(slot, now('2026-10-07T14:00:00Z')), notOver(slot, now('2026-10-07T15:00:00Z'))]).toEqual([false, false]);
    // A lone start is a point: it is ahead until it has passed.
    expect([notOver(lone, now('2026-10-07T12:00:00Z')), notOver(lone, now('2026-10-07T12:00:01Z'))]).toEqual([true, false]);
  });
});

describe('the Serbian week and what lies in it', () => {
  const at22 = (iso: string) => calendarInstant(iso)!;
  it('runs from the Monday midnight to the next, in Serbian time', () => {
    expect(serbianWeek(at('2026-10-07T09:00:00Z'))).toEqual({ from: at22('2026-10-04T22:00:00Z'), to: at22('2026-10-11T22:00:00Z') });
    // Sunday 23:59:59 in Belgrade is still that week; one second later is the next one.
    expect(serbianWeek(at('2026-10-11T21:59:59Z'))).toEqual({ from: at22('2026-10-04T22:00:00Z'), to: at22('2026-10-11T22:00:00Z') });
    expect(serbianWeek(at('2026-10-11T22:00:00Z'))).toEqual({ from: at22('2026-10-11T22:00:00Z'), to: at22('2026-10-18T22:00:00Z') });
  });
  it('is 169 hours long where the autumn clock change falls, and 167 where the spring one does', () => {
    expect(serbianWeek(at('2026-10-21T10:00:00Z'))).toEqual({ from: at22('2026-10-18T22:00:00Z'), to: at22('2026-10-25T23:00:00Z') });
    expect(serbianWeek(at('2026-03-25T10:00:00Z'))).toEqual({ from: at22('2026-03-22T23:00:00Z'), to: at22('2026-03-29T22:00:00Z') });
  });
  it('is null when "now" cannot be read', () => { expect(serbianWeek(new Date(Number.NaN))).toBeNull(); });

  it('counts a window that overlaps the week and a lone start that falls inside it, and nothing at the edges that only touches', () => {
    const week = serbianWeek(at('2026-10-07T09:00:00Z'))!;
    expect(inWeek(term('2026-10-04T22:00:00Z', '2026-10-04T23:00:00Z'), week)).toBe(true); // starts at the first midnight
    expect(inWeek(term('2026-10-04T21:00:00Z', '2026-10-04T22:00:00Z'), week)).toBe(false); // ends at the first midnight
    expect(inWeek(term('2026-10-04T21:00:00Z', '2026-10-04T22:00:01Z'), week)).toBe(true); // one second inside
    expect(inWeek(term('2026-10-11T21:59:00Z', '2026-10-11T22:30:00Z'), week)).toBe(true); // starts a minute before the last midnight
    expect(inWeek(term('2026-10-11T22:00:00Z', '2026-10-11T23:00:00Z'), week)).toBe(false); // starts at the last midnight
    expect(inWeek(term('2026-10-04T22:00:00Z'), week)).toBe(true);
    expect(inWeek(term('2026-10-11T22:00:00Z'), week)).toBe(false);
  });
});

// Coordinator, 2026-10-07: what is counted is Dogovori, so every part says "Dogovor/Dogovora", never "zadatak".
describe('moreLine: the one grey line, each part left out when it is zero', () => {
  it.each([
    [0, 0, 0, null],
    [2, 1, 0, 'Ove nedelje još 2 Dogovora · 1 Dogovor bez tačnog termina'],
    [1, 0, 0, 'Ove nedelje još 1 Dogovor'],
    [0, 3, 0, '3 Dogovora bez tačnog termina'],
    [5, 5, 0, 'Ove nedelje još 5 Dogovora · 5 Dogovora bez tačnog termina'],
    [11, 12, 0, 'Ove nedelje još 11 Dogovora · 12 Dogovora bez tačnog termina'],
    [21, 22, 0, 'Ove nedelje još 21 Dogovor · 22 Dogovora bez tačnog termina'],
    [4, 24, 0, 'Ove nedelje još 4 Dogovora · 24 Dogovora bez tačnog termina'],
    [2, 1, 1, 'Ove nedelje još 2 Dogovora · 1 Dogovor bez tačnog termina · 1 Dogovor čeka završetak'],
    [0, 0, 3, '3 Dogovora čekaju završetak'],
    [1, 0, 2, 'Ove nedelje još 1 Dogovor · 2 Dogovora čekaju završetak'],
    [0, 1, 1, '1 Dogovor bez tačnog termina · 1 Dogovor čeka završetak'],
  ])('%i this week, %i without a term, %i waiting to be finished', (week, without, awaiting, line) => {
    expect(moreLine(week, without, awaiting)).toBe(line);
  });

  // The verb agrees with the count the way the noun does (plural.ts is the one rule; "dolazi 5 osoba" has the same shape).
  it.each([
    [1, '1 Dogovor čeka završetak'], [2, '2 Dogovora čekaju završetak'], [3, '3 Dogovora čekaju završetak'], [4, '4 Dogovora čekaju završetak'],
    [5, '5 Dogovora čeka završetak'], [11, '11 Dogovora čeka završetak'], [12, '12 Dogovora čeka završetak'], [14, '14 Dogovora čeka završetak'],
    [21, '21 Dogovor čeka završetak'], [22, '22 Dogovora čekaju završetak'], [24, '24 Dogovora čekaju završetak'], [25, '25 Dogovora čeka završetak'],
    [101, '101 Dogovor čeka završetak'], [102, '102 Dogovora čekaju završetak'], [111, '111 Dogovora čeka završetak'], [112, '112 Dogovora čeka završetak'],
  ])('%i waiting to be finished is written %j', (count, line) => { expect(moreLine(0, 0, count)).toBe(line); });

  it('never calls an agreement a "zadatak", whatever the counts', () => {
    for (const week of [0, 1, 2, 5]) for (const without of [0, 1, 3, 11]) for (const awaiting of [0, 1, 2, 5]) {
      expect(moreLine(week, without, awaiting) ?? '').not.toMatch(/zadat/i);
    }
  });
});

// Coordinator, 2026-10-07: with no appointment ahead, the Dogovori that have no day in the schedule (no exact term, or a
// confirmed one whose exact term has passed unfinished) are still counted in one quiet line, so an agreement never vanishes.
describe('looseLine: the quiet line of Raspored without a card', () => {
  it.each([
    [0, 0, null],
    [1, 0, '1 Dogovor bez tačnog termina'], [2, 0, '2 Dogovora bez tačnog termina'], [4, 0, '4 Dogovora bez tačnog termina'],
    [5, 0, '5 Dogovora bez tačnog termina'], [11, 0, '11 Dogovora bez tačnog termina'], [12, 0, '12 Dogovora bez tačnog termina'],
    [21, 0, '21 Dogovor bez tačnog termina'], [22, 0, '22 Dogovora bez tačnog termina'], [101, 0, '101 Dogovor bez tačnog termina'],
    [111, 0, '111 Dogovora bez tačnog termina'],
    [0, 1, '1 Dogovor čeka završetak'], [0, 2, '2 Dogovora čekaju završetak'],
    [2, 1, '2 Dogovora bez tačnog termina · 1 Dogovor čeka završetak'],
  ])('%i without a term, %i waiting to be finished', (withoutTerm, awaitingFinish, line) => {
    expect(looseLine({ withoutTerm, awaitingFinish })).toBe(line);
  });
});

describe('composeHome: the Raspored of the featured appointment', () => {
  // Wednesday 7 October 2026, 11:00 in Belgrade, on a phone that is in Serbian time (so no zone is said).
  const now = Date.parse('2026-10-07T09:00:00Z');
  const compose = (agreements: DogovorProjekcija[], at = now, phoneZone: string | undefined = 'Europe/Belgrade') =>
    composeHome(reads(agreements), undefined, at, phoneZone);

  it('tells the next appointment day first from its instants, never from the display sentence, and counts the rest of the week', () => {
    const home = compose([
      exact('today', '2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z', { vremeTekst: 'Fleksibilno · tokom sledeće nedelje' }),
      exact('thu', '2026-10-08T08:00:00Z', '2026-10-08T09:00:00Z'),
      // Sunday 23:30 to Monday 00:30 in Belgrade: it starts inside this week.
      exact('sun-late', '2026-10-11T21:30:00Z', '2026-10-11T22:30:00Z'),
      // Monday next week: not "ove nedelje".
      exact('next-week', '2026-10-12T08:00:00Z', '2026-10-12T09:00:00Z'),
      // No exact term: three kinds, all "bez tačnog termina"; the one with no reading at all is not counted.
      agreement('flex', { tacanTermin: null }),
      agreement('awaiting-flex', { stanje: 'AWAITING_REQUESTER', tacanTermin: null }),
      agreement('start-only', { prihvacenPocetak: '2026-10-09T08:00:00Z', tacanTermin: null }),
      agreement('unknown'),
      // Finished or cancelled work has no place in a schedule ahead.
      exact('done', '2026-10-08T10:00:00Z', '2026-10-08T11:00:00Z', { stanje: 'COMPLETED' }),
      exact('cancelled', '2026-10-08T12:00:00Z', '2026-10-08T13:00:00Z', { stanje: 'CANCELLED' }),
    ]);
    const [featured] = rows(home);
    expect(featured).toMatchObject({ id: 'agreement:today', upcoming: true,
      // The card says the week and nothing about the Dogovori that have no day (8 Oct 2026): they are asked for under "Čeka te" and listed in Raspored.
      raspored: { when: 'Danas · 14:00–16:00', spoken: 'Danas, od 14:00 do 16:00', more: 'Ove nedelje još 2 Dogovora' },
      // The display sentence stays what the Dogovor says; the first line did not come from it.
      appointment: { timeText: 'Fleksibilno · tokom sledeće nedelje' } });
    expect(JSON.stringify(featured.raspored)).not.toContain('Fleksibilno');
    // One featured row; the rest are counted, not listed.
    expect(rows(home)).toHaveLength(1);
    expect(home.agreements).toMatchObject({ value: { more: 7 } });
  });

  it('puts the soonest appointment first, ahead of one that is later and of work with no time', () => {
    const home = compose([agreement('flex', { tacanTermin: null }), exact('later', '2026-10-09T08:00:00Z', '2026-10-09T09:00:00Z'),
      exact('sooner', '2026-10-08T08:00:00Z', '2026-10-08T09:00:00Z')]);
    expect(rows(home)[0]).toMatchObject({ id: 'agreement:sooner', raspored: { when: 'Sutra · 10:00–11:00', more: 'Ove nedelje još 1 Dogovor' } });
  });

  it('says a lone accepted start as "od", counts it once (without an exact term), and never counts the featured one twice', () => {
    const home = compose([agreement('lone', { prihvacenPocetak: '2026-10-08T08:00:00Z', tacanTermin: null }), agreement('flex', { tacanTermin: null })]);
    expect(rows(home)[0]).toMatchObject({ id: 'agreement:lone', raspored: { when: 'Sutra · od 10:00', spoken: 'Sutra, od 10:00', more: null } });
    // Counted once, and not said on the card: the planner counts it among the Dogovori with no exact term, and that is where it is listed.
    expect(home.agreements).toMatchObject({ value: { more: 1 } });
  });

  it('has no quiet line when there is nothing to add', () => {
    expect(rows(compose([exact('only', '2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z')]))[0].raspored).toEqual({
      when: 'Danas · 14:00–16:00', spoken: 'Danas, od 14:00 do 16:00', more: null, zone: null });
  });

  it('says "Po vremenu u Srbiji" only when the phone is elsewhere or does not say, and never changes the time itself', () => {
    const only = [exact('only', '2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z')];
    for (const zone of ['America/New_York', 'UTC', 'Asia/Tokyo']) {
      expect(rows(compose(only, now, zone))[0].raspored).toEqual({ when: 'Danas · 14:00–16:00', spoken: 'Danas, od 14:00 do 16:00', more: null,
        zone: 'Po vremenu u Srbiji' });
    }
    expect(rows(compose(only, now, 'Europe/Belgrade'))[0].raspored?.zone).toBeNull();
    // A phone that does not say where it is is told as well, by the planner's own rule.
    const featured = term('2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z');
    const nothingLoose = { withoutTerm: 0, awaitingFinish: 0 };
    expect(rasporedOf(featured, [], nothingLoose, at('2026-10-07T09:00:00Z'), undefined)).toEqual({ when: 'Danas · 14:00–16:00',
      spoken: 'Danas, od 14:00 do 16:00', more: null, zone: 'Po vremenu u Srbiji' });
    expect(rasporedOf(featured, [], nothingLoose, at('2026-10-07T09:00:00Z'), 'Europe/Belgrade')?.zone).toBeNull();
    // Without an explicit zone the phone's own is read (Jest runs in UTC, which is not Serbian time).
    expect(rows(composeHome(reads(only), undefined, now))[0].raspored?.zone).toBe('Po vremenu u Srbiji');
  });

  it('keeps an appointment that is under way as the featured one, and drops it when its window has ended', () => {
    const slot = [exact('now', '2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z'), exact('later', '2026-10-08T08:00:00Z', '2026-10-08T09:00:00Z')];
    // 15:00 in Belgrade: it started at 14:00 and ends at 16:00; tomorrow's is still ahead, in this week.
    expect(rows(compose(slot, Date.parse('2026-10-07T13:00:00Z')))[0]).toMatchObject({ id: 'agreement:now', upcoming: true,
      raspored: { when: 'Danas · 14:00–16:00', more: 'Ove nedelje još 1 Dogovor' } });
    // Exactly at the end it is over, and tomorrow's is next. The one that just ended has not been marked done: it keeps its place in Raspored
    // (and in `loose`, below); the card no longer says so (the owner's phone, 8 Oct 2026: a line of counts under the person was too much).
    expect(rows(compose(slot, Date.parse('2026-10-07T14:00:00Z')))[0]).toMatchObject({ id: 'agreement:later',
      raspored: { when: 'Sutra · 10:00–11:00', more: null } });
  });

  it('has no card for an active Dogovor that has no accepted appointment ahead (the quiet line below is all it gets)', () => {
    for (const home of [
      compose([agreement('flex', { tacanTermin: null })]),
      compose([agreement('waiting', { stanje: 'AWAITING_REQUESTER', prihvacenPocetak: '2026-10-08T08:00:00Z', tacanTermin: window('2026-10-08T08:00:00Z', '2026-10-08T09:00:00Z') })]),
      compose([exact('past', '2026-10-06T08:00:00Z', '2026-10-06T09:00:00Z')]),
      compose([agreement('lone-past', { prihvacenPocetak: '2026-10-06T08:00:00Z' })]),
      compose([]),
    ]) {
      for (const row of rows(home)) { expect(row).not.toHaveProperty('raspored'); expect(row).not.toHaveProperty('upcoming'); }
    }
  });

  it('has none when the Dogovori could not be read or "now" is unknown: nothing is guessed', () => {
    expect(composeHome({ ...reads([]), agreements: { kind: 'unavailable' } }, undefined, now).agreements).toEqual({ kind: 'unavailable' });
    expect(rows(compose([exact('a', '2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z')], Number.NaN))[0]).not.toHaveProperty('raspored');
  });

  it('counts active Dogovori without a confirmed term in one quiet line when no appointment lies ahead, and gives them no card', () => {
    const one = compose([unconfirmed('krecenje')]);
    expect(loose(one)).toBe('1 Dogovor bez tačnog termina');
    // The Dogovor stays the row it was (its link and facts), but it has no day to tell: no Raspored words, no "upcoming".
    expect(rows(one)[0]).toMatchObject({ id: 'agreement:krecenje', appointment: { timeText: 'Termin nije potvrđen' } });
    expect(rows(one)[0]).not.toHaveProperty('raspored'); expect(rows(one)[0]).not.toHaveProperty('upcoming');
    expect(loose(compose([unconfirmed('a'), unconfirmed('b')]))).toBe('2 Dogovora bez tačnog termina');
    const many = (count: number) => compose(Array.from({ length: count }, (_, index) => unconfirmed(`n${index}`)));
    expect([5, 11, 21, 22].map(count => loose(many(count)))).toEqual([
      '5 Dogovora bez tačnog termina', '11 Dogovora bez tačnog termina', '21 Dogovor bez tačnog termina', '22 Dogovora bez tačnog termina']);
    // It needs no clock: an unreadable "now" cannot place an appointment, but it can still count what has no term.
    expect(loose(compose([unconfirmed('a')], Number.NaN))).toBe('1 Dogovor bez tačnog termina');
  });

  it('counts what the planner counts: every active kind without an exact term, nothing finished, cancelled or unknown', () => {
    const home = compose([
      unconfirmed('a'), unconfirmed('awaiting', { stanje: 'AWAITING_REQUESTER' }),
      // Started, and its end was never confirmed: it has a start but no exact term, as the planner counts it.
      agreement('lone-past', { prihvacenPocetak: '2026-10-06T08:00:00Z', tacanTermin: null }),
      agreement('unknown'), // the list did not say whether it has a term: not counted
      unconfirmed('done', { stanje: 'COMPLETED' }), unconfirmed('cancelled', { stanje: 'CANCELLED' }),
    ]);
    expect(loose(home)).toBe('3 Dogovora bez tačnog termina');
    // An exact window that is already over is a term, so it is not "bez tačnog termina": it is waiting to be finished.
    expect(loose(compose([overdue('over')]))).toBe('1 Dogovor čeka završetak');
  });

  // Coordinator, 2026-10-07: a confirmed Dogovor whose exact term has passed and that nobody has marked done must not vanish
  // either. Only an exact window can tell that a term has passed.
  it('counts a confirmed Dogovor whose exact term has passed without being marked done as waiting to be finished', () => {
    const one = compose([overdue('krecenje')]);
    expect(loose(one)).toBe('1 Dogovor čeka završetak');
    expect(rows(one)[0]).toMatchObject({ id: 'agreement:krecenje' });
    expect(rows(one)[0]).not.toHaveProperty('raspored'); expect(rows(one)[0]).not.toHaveProperty('upcoming');
    expect(loose(compose([overdue('a'), overdue('b')]))).toBe('2 Dogovora čekaju završetak');
    const many = (count: number) => compose(Array.from({ length: count }, (_, index) => overdue(`o${index}`)));
    expect([5, 11, 21, 22].map(count => loose(many(count)))).toEqual([
      '5 Dogovora čeka završetak', '11 Dogovora čeka završetak', '21 Dogovor čeka završetak', '22 Dogovora čekaju završetak']);
    // Joined with " · " to the other part when both apply.
    expect(loose(compose([unconfirmed('flex'), overdue('a'), overdue('b')]))).toBe('1 Dogovor bez tačnog termina · 2 Dogovora čekaju završetak');
  });

  it('decides that a term has passed by its end instant, not by the phone\'s day: at the end it is over, one second earlier it is under way', () => {
    // 7 October 2026, 22:00Z, is 00:00 on 8 October in Belgrade; the window starts at 22:00 on the 7th there.
    const window20 = (end: string) => exact('w', '2026-10-07T20:00:00Z', end);
    const clock = (iso: string) => Date.parse(iso);
    expect(loose(compose([window20('2026-10-07T21:59:59Z')], clock('2026-10-07T22:00:00Z')))).toBe('1 Dogovor čeka završetak'); // ended a second ago
    expect(loose(compose([window20('2026-10-07T22:00:00Z')], clock('2026-10-07T22:00:00Z')))).toBe('1 Dogovor čeka završetak'); // ends exactly now
    // One second left: still under way, so it is the card (started "Juče" by the Serbian calendar, which has just turned).
    const underWay = compose([window20('2026-10-07T22:00:01Z')], clock('2026-10-07T22:00:00Z'));
    expect(loose(underWay)).toBeUndefined(); expect(rows(underWay)[0]).toMatchObject({ upcoming: true, raspored: { when: 'Juče · 22:00 – danas 00:00' } });
  });

  it('does not count what is marked done, finished or cancelled, or what the data cannot tell', () => {
    const home = compose([
      overdue('marked-done', { stanje: 'AWAITING_REQUESTER' }), // the worker said it is done; the requester has to confirm
      overdue('completed', { stanje: 'COMPLETED' }), overdue('cancelled', { stanje: 'CANCELLED' }),
      agreement('lone-past', { prihvacenPocetak: '2026-10-06T08:00:00Z', tacanTermin: null }), // a start with no end: nothing to have passed
      agreement('unknown'), // the list did not say whether it has a term
    ]);
    // The only one the quiet line has is the lone start, among the Dogovori with no exact term.
    expect(loose(home)).toBe('1 Dogovor bez tačnog termina');
    expect(loose(compose([overdue('marked-done', { stanje: 'AWAITING_REQUESTER' }), overdue('completed', { stanje: 'COMPLETED' })]))).toBeUndefined();
  });

  it('needs a clock: without a readable "now" nothing can be said to have passed', () => {
    expect(loose(compose([overdue('a')], Number.NaN))).toBeUndefined();
    expect(loose(compose([overdue('a'), unconfirmed('flex')], Number.NaN))).toBe('1 Dogovor bez tačnog termina');
  });

  it('is said only when there is no card, and with an appointment ahead the card says the week alone, never the Dogovori that have no day', () => {
    const home = compose([exact('today', '2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z'), unconfirmed('flex')]);
    expect(home.agreements.kind === 'known' && 'quietLine' in home.agreements.value).toBe(false);
    expect(rows(home)[0].raspored?.more).toBeNull();
    const all = compose([exact('today', '2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z'), exact('thu', '2026-10-08T08:00:00Z', '2026-10-08T09:00:00Z'),
      unconfirmed('flex'), overdue('a'), overdue('b')]);
    expect(all.agreements.kind === 'known' && 'quietLine' in all.agreements.value).toBe(false);
    expect(rows(all)[0].raspored?.more).toBe('Ove nedelje još 1 Dogovor');
  });

  it('is not said when nothing is active without a term, or when the Dogovori could not be read', () => {
    expect(loose(compose([]))).toBeUndefined();
    expect(loose(compose([agreement('unknown')]))).toBeUndefined();
    expect(loose(compose([unconfirmed('done', { stanje: 'COMPLETED' })]))).toBeUndefined();
    expect(composeHome({ ...reads([]), agreements: { kind: 'unavailable' } }, undefined, now).agreements).toEqual({ kind: 'unavailable' });
  });

  it('carries the other side\'s profile id and initials for their face, and null where the server gave none', () => {
    const [named] = rows(compose([exact('a', '2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z')]));
    expect(named.appointment).toMatchObject({ counterpartName: 'Jelena Petrović', counterpartProfileId: FACE, counterpartInitials: 'JP' });
    const stranger = agreement('b', { prihvacenPocetak: '2026-10-07T12:00:00Z', tacanTermin: window('2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z') });
    stranger.ucesnici[1] = { ...stranger.ucesnici[1], profilId: null, ime: '', inicijali: '' };
    expect(rows(compose([stranger]))[0].appointment).toMatchObject({ counterpartName: '', counterpartProfileId: null, counterpartInitials: null });
  });

  it('reads the same day for both sides of the Dogovor and for either phone zone: only the instants and "now" decide', () => {
    const slot = { prihvacenPocetak: '2026-10-07T12:00:00Z', tacanTermin: window('2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z') };
    expect(rows(compose([agreement('w', slot, 'uskocer')]))[0].raspored?.when).toBe('Danas · 14:00–16:00');
    expect(rows(compose([agreement('r', slot, 'narucilac')]))[0].raspored?.when).toBe('Danas · 14:00–16:00');
  });
});

describe('withoutTermCount: the planner\'s own rule', () => {
  it('counts the active Dogovori known to have no exact term, except the featured one, and nothing that is not known', () => {
    const list = [agreement('featured', { tacanTermin: null }), agreement('a', { tacanTermin: null }), agreement('b', { stanje: 'AWAITING_REQUESTER', tacanTermin: null }),
      agreement('unknown'), agreement('exact', { tacanTermin: window('2026-10-08T08:00:00Z', '2026-10-08T09:00:00Z') }),
      agreement('done', { stanje: 'COMPLETED', tacanTermin: null }), agreement('cancelled', { stanje: 'CANCELLED', tacanTermin: null })];
    expect(withoutTermCount(list, 'featured')).toBe(2);
    expect(withoutTermCount(list, 'nobody')).toBe(3);
    // No featured Dogovor (no card): every one of them counts.
    expect(withoutTermCount(list)).toBe(3); expect(withoutTermCount(list, null)).toBe(3);
    expect(withoutTermCount([], 'x')).toBe(0);
  });
});

describe('awaitingFinishCount: confirmed, exact term passed, not marked done', () => {
  const nowAt = calendarInstant('2026-10-07T09:00:00Z')!;
  it('counts the confirmed Dogovori whose exact window ended at or before now, and only those', () => {
    const list = [overdue('a'), overdue('b'), exact('ends-now', '2026-10-07T08:00:00Z', '2026-10-07T09:00:00Z'),
      exact('under-way', '2026-10-07T08:00:00Z', '2026-10-07T09:00:01Z'), exact('ahead', '2026-10-08T08:00:00Z', '2026-10-08T09:00:00Z'),
      overdue('marked-done', { stanje: 'AWAITING_REQUESTER' }), overdue('completed', { stanje: 'COMPLETED' }), overdue('cancelled', { stanje: 'CANCELLED' }),
      agreement('lone-past', { prihvacenPocetak: '2026-10-06T08:00:00Z', tacanTermin: null }), unconfirmed('flex'), agreement('unknown')];
    expect(awaitingFinishCount(list, nowAt)).toBe(3); // a, b and the one that ends exactly now
    expect(awaitingFinishCount([], nowAt)).toBe(0);
    // Without a clock nothing can be said to have passed.
    expect(awaitingFinishCount(list, null)).toBe(0);
  });
});
