import { starost } from '../starost';

// The age of an answer ("Odgovor osobe koja je objavila zadatak · pre 2 dana"): one short Serbian phrase, days counted on the
// calendar of Serbian time, the count word following the number, and nothing invented when the moment is unreadable.
const sada = new Date('2026-09-24T10:00:00Z'); // 12:00 in Belgrade (summer time)
const minus = (ms: number) => new Date(sada.getTime() - ms).toISOString();
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
const at = (value: string | number | Date | null | undefined) => starost(value, { sada });

describe('starost', () => {
  it('says "Upravo" for the first minutes, and for a moment a little ahead of a phone that runs behind', () => {
    expect(at(sada)).toBe('Upravo');
    expect(at(minus(4 * MIN + 59_000))).toBe('Upravo');
    expect(at(new Date(sada.getTime() + 2 * MIN))).toBe('Upravo');
    expect(at(new Date(sada.getTime() + 10 * MIN))).toBe('Upravo');
  });

  it('counts minutes up to the hour', () => {
    expect(at(minus(5 * MIN))).toBe('pre 5 min');
    expect(at(minus(25 * MIN))).toBe('pre 25 min');
    expect(at(minus(59 * MIN + 59_000))).toBe('pre 59 min');
  });

  it('counts hours of today with the Serbian form of the word', () => {
    expect(at(minus(HOUR))).toBe('pre 1 sat');
    expect(at(minus(2 * HOUR))).toBe('pre 2 sata');
    expect(at(minus(4 * HOUR + 59 * MIN))).toBe('pre 4 sata');
    expect(at(minus(5 * HOUR))).toBe('pre 5 sati');
    expect(at(minus(11 * HOUR))).toBe('pre 11 sati');
    // 01:00 Belgrade is still today at 12:00: 11 hours.
    expect(at('2026-09-23T23:00:00Z')).toBe('pre 11 sati');
  });

  it('says "juče" for any time of the day before, even when fewer than 24 hours have passed', () => {
    expect(at('2026-09-23T10:00:00Z')).toBe('juče');
    // 23:30 yesterday in Belgrade is 12.5 hours ago, and still yesterday.
    expect(at('2026-09-23T21:30:00Z')).toBe('juče');
    // 00:30 today in Belgrade is 11.5 hours ago, and still today.
    expect(at('2026-09-23T22:30:00Z')).toBe('pre 11 sati');
    // Just after midnight, the evening before is "juče", not "pre 1 sat".
    expect(starost('2026-09-23T21:30:00Z', { sada: new Date('2026-09-23T22:30:00Z') })).toBe('juče');
  });

  it('counts calendar days up to two weeks', () => {
    expect(at(minus(2 * DAY))).toBe('pre 2 dana');
    expect(at(minus(3 * DAY))).toBe('pre 3 dana');
    expect(at(minus(5 * DAY))).toBe('pre 5 dana');
    expect(at(minus(11 * DAY))).toBe('pre 11 dana');
    expect(at(minus(13 * DAY))).toBe('pre 13 dana');
  });

  it('counts weeks, months and years with the form the number asks for', () => {
    expect(at(minus(14 * DAY))).toBe('pre 2 nedelje');
    expect(at(minus(21 * DAY))).toBe('pre 3 nedelje');
    expect(at(minus(29 * DAY))).toBe('pre 4 nedelje');
    expect(at(minus(30 * DAY))).toBe('pre mesec dana');
    expect(at(minus(59 * DAY))).toBe('pre mesec dana');
    expect(at(minus(60 * DAY))).toBe('pre 2 meseca');
    expect(at(minus(150 * DAY))).toBe('pre 5 meseci');
    expect(at(minus(364 * DAY))).toBe('pre 12 meseci');
    expect(at(minus(365 * DAY))).toBe('pre godinu dana');
    expect(at(minus(800 * DAY))).toBe('pre 2 godine');
    expect(at(minus(5 * 365 * DAY))).toBe('pre 5 godina');
  });

  it('counts days on the calendar of the zone, not in stretches of 24 hours', () => {
    // The day of the clock change in Belgrade (25 Oct) has 25 hours; 10:00Z on the 25th is still "juče" on the 26th.
    const after = new Date('2026-10-26T10:00:00Z');
    expect(starost('2026-10-25T10:00:00Z', { sada: after })).toBe('juče');
    expect(starost('2026-10-24T10:00:00Z', { sada: after })).toBe('pre 2 dana');
    // The same moments fall on other calendar days in another zone (06:00 on the 24th in New York, 12:00 in Belgrade).
    expect(starost('2026-09-23T23:30:00Z', { sada, zona: 'Europe/Belgrade' })).toBe('pre 10 sati');
    expect(starost('2026-09-23T23:30:00Z', { sada, zona: 'America/New_York' })).toBe('juče');
    expect(starost('2026-09-23T03:30:00Z', { sada, zona: 'Europe/Belgrade' })).toBe('juče');
    expect(starost('2026-09-23T03:30:00Z', { sada, zona: 'America/New_York' })).toBe('pre 2 dana');
  });

  it('reads a Date, a number and an ISO string alike', () => {
    const moment = new Date(sada.getTime() - 3 * DAY);
    expect(at(moment)).toBe('pre 3 dana');
    expect(at(moment.getTime())).toBe('pre 3 dana');
    expect(at(moment.toISOString())).toBe('pre 3 dana');
  });

  it('gives null, never a made-up age, for a missing or unreadable moment, an unknown zone and a far-future moment', () => {
    for (const value of [null, undefined, '', 'nije vreme', Number.NaN, new Date('x')]) expect(at(value as string)).toBeNull();
    // Without a calendar to count on, anything past the first hour has no age; the first hour needs none.
    expect(starost(minus(2 * DAY), { sada, zona: 'Nije/Zona' })).toBeNull();
    expect(starost(minus(2 * HOUR), { sada, zona: 'Nije/Zona' })).toBeNull();
    expect(starost(minus(25 * MIN), { sada, zona: 'Nije/Zona' })).toBe('pre 25 min');
    expect(at(new Date(sada.getTime() + DAY))).toBeNull();
    expect(at(new Date(sada.getTime() + 11 * MIN))).toBeNull();
    expect(starost(minus(DAY), { sada: new Date('x') })).toBeNull();
  });
});
