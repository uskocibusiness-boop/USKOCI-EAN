import {
  CALENDAR_VIEWS, DAY_END_HOUR, DAY_START_HOUR, HOUR_HEIGHT, MAX_COLUMNS, MIN_BLOCK_MINUTES, dayDots, dayLabel, daySpoken, layoutDay, looseBarLabel,
  minutesClock, minutesOn, nowMinute, periodTitle, roleKind, stepDay, stepLabels, timelineRange, topOf,
} from '../calendarViews';
import type { PlannerEntry } from '../planner';
import { serbian } from './fixtures';

// The three views of Raspored decide everything below without drawing anything: which day a step lands on, what the period is called,
// which dots a day carries, how a day is said aloud, and where the Dogovori of a day stand on its hours. Serbian time throughout:
// the suite runs in UTC, two hours behind a summer Belgrade, so every clock below is stated as a Serbian clock.
const DAY = '2026-10-08';
const NOW = new Date('2026-10-08T10:00:00Z');

const entry = (patch: Partial<PlannerEntry> = {}): PlannerEntry => ({
  key: 'e', id: 'e', title: 'Naslov', fallbackTitle: 'Dogovor', startsAt: serbian(DAY, '10:00'), endsAt: serbian(DAY, '12:00'), exact: true, timeWord: null,
  status: { key: 'task.agreed' }, waits: false, done: false, term: true, commitsMe: true, note: null, role: 'Uskačeš', person: null, personProfileId: null,
  personInitials: null, amount: null, place: '', proposesTerm: false, ...patch,
});
const at = (key: string, from: string, to: string | null, patch: Partial<PlannerEntry> = {}) =>
  entry({ key, id: key, startsAt: serbian(DAY, from), endsAt: to === null ? null : serbian(DAY, to), ...patch });

describe('the switch', () => {
  it('is Mesec, Nedelja, Dan, in that order, and the month comes first', () => {
    expect(CALENDAR_VIEWS.map(view => [view.key, view.label])).toEqual([['month', 'Mesec'], ['week', 'Nedelja'], ['day', 'Dan']]);
  });
});

describe('stepping', () => {
  it('moves a month to the same day of the next, a week by seven days, a day by one, either way and over the year', () => {
    expect(stepDay('month', '2026-10-08', 1)).toBe('2026-11-08');
    expect(stepDay('month', '2026-10-08', -1)).toBe('2026-09-08');
    expect(stepDay('week', '2026-10-08', 1)).toBe('2026-10-15');
    expect(stepDay('week', '2026-10-08', -1)).toBe('2026-10-01');
    expect(stepDay('day', '2026-10-08', 1)).toBe('2026-10-09');
    expect(stepDay('day', '2026-12-31', 1)).toBe('2027-01-01');
    expect(stepDay('month', '2026-12-15', 1)).toBe('2027-01-15');
  });
  it('lands on the last day of a month that is shorter, so the day under the grid is a day the grid shows', () => {
    expect(stepDay('month', '2026-01-31', 1)).toBe('2026-02-28');
    expect(stepDay('month', '2026-03-31', -1)).toBe('2026-02-28');
  });
  it('names the two arrows by the period they step by', () => {
    expect(stepLabels('month')).toEqual({ previous: 'Prethodni mesec', next: 'Sledeći mesec' });
    expect(stepLabels('week')).toEqual({ previous: 'Prethodna nedelja', next: 'Sledeća nedelja' });
    expect(stepLabels('day')).toEqual({ previous: 'Prethodni dan', next: 'Sledeći dan' });
  });
});

describe('naming a period', () => {
  it('says the day of a list as "Subota, 10. okt", and today as "Danas, četvrtak 8. okt"', () => {
    expect(dayLabel('2026-10-10', DAY, NOW)).toBe('Subota, 10. okt');
    expect(dayLabel(DAY, DAY, NOW)).toBe('Danas, četvrtak 8. okt');
    expect(dayLabel('2027-01-05', DAY, NOW)).toBe('Utorak, 5. jan 2027');
  });
  it('calls the month by its name and year, the week by its days, and the day by its heading', () => {
    expect(periodTitle('month', '2026-10-08', DAY, NOW)).toBe('Oktobar 2026');
    expect(periodTitle('week', '2026-10-08', DAY, NOW)).toBe('5–11. okt');
    expect(periodTitle('week', '2026-12-31', DAY, NOW)).toBe('28. dec 2026 – 3. jan 2027');
    expect(periodTitle('day', '2026-10-10', DAY, NOW)).toBe('Subota, 10. okt');
    expect(periodTitle('day', DAY, DAY, NOW)).toBe('Danas, četvrtak 8. okt');
  });
  it('counts the Dogovori without a term in the Serbian shapes', () => {
    expect([1, 2, 5, 11, 21, 22].map(looseBarLabel)).toEqual(['1 Dogovor bez termina', '2 Dogovora bez termina', '5 Dogovora bez termina',
      '11 Dogovora bez termina', '21 Dogovor bez termina', '22 Dogovora bez termina']);
  });
});

describe('the dots of a day', () => {
  const worker = at('w', '09:00', '10:00'), requester = at('r', '11:00', '12:00', { role: 'Tvoj zadatak' }), unsaid = at('u', '13:00', '14:00', { role: null });
  it('are none for a day with nothing on it, and one for one Dogovor, in the colour of its side', () => {
    expect(dayDots([])).toEqual({ roles: [], more: 0 });
    expect(dayDots([worker])).toEqual({ roles: ['worker'], more: 0 });
    expect(dayDots([requester])).toEqual({ roles: ['requester'], more: 0 });
    expect(dayDots([unsaid])).toEqual({ roles: ['unknown'], more: 0 });
    expect(roleKind(worker)).toBe('worker'); expect(roleKind(requester)).toBe('requester'); expect(roleKind(unsaid)).toBe('unknown');
  });
  it('are two for two, one of each side when they are, and "+N" for the rest, never a third dot', () => {
    expect(dayDots([worker, worker])).toEqual({ roles: ['worker', 'worker'], more: 0 });
    expect(dayDots([worker, requester])).toEqual({ roles: ['worker', 'requester'], more: 0 });
    expect(dayDots([worker, worker, worker])).toEqual({ roles: ['worker', 'worker'], more: 1 });
    // Both sides show even when the other side is the last of many: a day is never drawn as only mine when it also holds a task of mine.
    expect(dayDots([worker, worker, worker, requester])).toEqual({ roles: ['worker', 'requester'], more: 2 });
    expect(dayDots([requester, worker, worker, worker, worker])).toEqual({ roles: ['requester', 'worker'], more: 3 });
  });
  it('are said in words with the day: how many, whose side, whether something waits, and whether it is today', () => {
    expect(daySpoken('2026-10-10', [], { today: DAY, now: NOW })).toBe('Subota, 10. okt');
    expect(daySpoken(DAY, [], { today: DAY, now: NOW })).toBe('Četvrtak, 8. okt, danas');
    expect(daySpoken('2026-10-10', [worker], { today: DAY, now: NOW })).toBe('Subota, 10. okt, 1 Dogovor, Uskačeš');
    expect(daySpoken('2026-10-10', [worker, requester], { today: DAY, now: NOW })).toBe('Subota, 10. okt, 2 Dogovora, Uskačeš i Tvoj zadatak');
    expect(daySpoken(DAY, [worker, entry({ role: 'Uskačeš', waits: true })], { today: DAY, now: NOW }))
      .toBe('Četvrtak, 8. okt, danas, 2 Dogovora, Uskačeš, nešto čeka tebe');
    expect(daySpoken('2026-10-10', [unsaid], { today: DAY, now: NOW })).toBe('Subota, 10. okt, 1 Dogovor');
  });
});

describe('minutes of the Serbian clock', () => {
  it('reads an instant as the clock of its Serbian day, whatever zone the phone is in', () => {
    expect(minutesOn(DAY, serbian(DAY, '00:00'))).toBe(0);
    expect(minutesOn(DAY, serbian(DAY, '09:15'))).toBe(555);
    expect(minutesOn(DAY, serbian(DAY, '23:59'))).toBe(1439);
    // 22:30Z is 00:30 of the next Serbian day in summer: on the 8th it is the end of the day, on the 9th it is half past midnight.
    expect(minutesOn(DAY, '2026-10-08T22:30:00Z')).toBe(1440);
    expect(minutesOn('2026-10-09', '2026-10-08T22:30:00Z')).toBe(30);
  });
  it('clips what lies outside the day: before it is 0, after it is 1440, and midnight that ends a day is its end', () => {
    expect(minutesOn(DAY, serbian('2026-10-07', '22:00'))).toBe(0);
    expect(minutesOn(DAY, serbian('2026-10-09', '02:00'))).toBe(1440);
    expect(minutesOn(DAY, serbian('2026-10-09', '00:00'))).toBe(1440);
    expect(minutesOn(DAY, 'not an instant')).toBe(0);
  });
  it('says where "sada" is on its own day only', () => {
    expect(nowMinute(new Date('2026-10-08T12:34:00Z'), DAY)).toBe(14 * 60 + 34);
    expect(nowMinute(new Date('2026-10-08T12:34:00Z'), '2026-10-09')).toBeNull();
    // 22:30Z on the 8th is already the 9th in Serbia.
    expect(nowMinute(new Date('2026-10-08T22:30:00Z'), DAY)).toBeNull();
    expect(nowMinute(new Date('2026-10-08T22:30:00Z'), '2026-10-09')).toBe(30);
  });
  it('writes a minute as a clock, the end of the day as 24:00', () => {
    expect([0, 60, 555, 1380, 1440].map(minutesClock)).toEqual(['00:00', '01:00', '09:15', '23:00', '24:00']);
  });
});

describe('a day on its hours', () => {
  it('draws one Dogovor as a block from its start to its end, alone in its column', () => {
    const { blocks, overflow } = layoutDay([at('a', '09:00', '13:00')], DAY);
    expect(overflow).toEqual([]);
    expect(blocks).toEqual([expect.objectContaining({ from: 540, to: 780, drawnTo: 780, column: 0, columns: 1 })]);
  });
  it('puts blocks that overlap side by side, and gives a block that comes after them the whole width again', () => {
    const { blocks } = layoutDay([at('a', '09:00', '11:00'), at('b', '10:00', '12:00'), at('c', '13:00', '14:00')], DAY);
    const of = (key: string) => blocks.find(block => block.entry.key === key)!;
    expect([of('a').column, of('a').columns]).toEqual([0, 2]);
    expect([of('b').column, of('b').columns]).toEqual([1, 2]);
    expect([of('c').column, of('c').columns]).toEqual([0, 1]);
  });
  it('reuses a column once its block has ended, so a chain of short ones is two columns and not three', () => {
    const { blocks } = layoutDay([at('a', '09:00', '12:00'), at('b', '09:30', '10:30'), at('c', '10:45', '11:45')], DAY);
    const of = (key: string) => blocks.find(block => block.entry.key === key)!;
    expect([of('a').column, of('b').column, of('c').column]).toEqual([0, 1, 1]);
    expect(blocks.every(block => block.columns === 2)).toBe(true);
  });
  it('draws a Dogovor shorter than a touch as tall as a touch, and keeps its neighbours off it', () => {
    const { blocks } = layoutDay([at('short', '10:00', '10:15'), at('next', '10:20', '11:20')], DAY);
    expect(blocks.find(block => block.entry.key === 'short')).toMatchObject({ from: 600, to: 615, drawnTo: 600 + MIN_BLOCK_MINUTES });
    // The next begins 5 minutes after the short one ends, which is inside the drawn height of it: so they stand side by side, not on each other.
    expect(blocks.every(block => block.columns === 2)).toBe(true);
  });
  it('draws a Dogovor with only a start as a nominal block, and never says an end it does not have', () => {
    const { blocks } = layoutDay([at('lone', '14:00', null)], DAY);
    expect(blocks[0]).toMatchObject({ from: 840, to: 840 + MIN_BLOCK_MINUTES, drawnTo: 840 + MIN_BLOCK_MINUTES });
    expect(blocks[0].entry.endsAt).toBeNull();
  });
  it('cuts a Dogovor that goes on past midnight at the end of the day, and one that began yesterday at its beginning', () => {
    const night = entry({ key: 'n', startsAt: serbian(DAY, '22:00'), endsAt: serbian('2026-10-09', '02:00') });
    const early = entry({ key: 'y', startsAt: serbian('2026-10-07', '23:00'), endsAt: serbian(DAY, '01:30') });
    expect(layoutDay([night], DAY).blocks[0]).toMatchObject({ from: 1320, to: 1440 });
    expect(layoutDay([early], DAY).blocks[0]).toMatchObject({ from: 0, to: 90 });
    expect(layoutDay([night], '2026-10-09').blocks[0]).toMatchObject({ from: 0, to: 120 });
  });
  it(`draws at most ${MAX_COLUMNS} columns, and lists the Dogovor that would need another one instead of drawing it too narrow to read`, () => {
    const { blocks, overflow } = layoutDay([at('a', '09:00', '11:00'), at('b', '09:10', '11:00'), at('c', '09:20', '11:00'), at('d', '09:30', '11:00'), at('e', '12:00', '13:00')], DAY);
    expect(blocks.map(block => block.entry.key).sort()).toEqual(['a', 'b', 'c', 'e']);
    expect(overflow.map(item => item.key)).toEqual(['d']);
    expect(Math.max(...blocks.map(block => block.columns))).toBe(MAX_COLUMNS);
    expect(blocks.find(block => block.entry.key === 'e')).toMatchObject({ column: 0, columns: 1 });
  });
  it('orders a day by its start, a longer block first among equal starts, so the same day always lays out the same way', () => {
    const first = layoutDay([at('b', '09:00', '10:00'), at('a', '09:00', '12:00')], DAY).blocks.map(block => [block.entry.key, block.column]);
    const second = layoutDay([at('a', '09:00', '12:00'), at('b', '09:00', '10:00')], DAY).blocks.map(block => [block.entry.key, block.column]);
    expect(first).toEqual([['a', 0], ['b', 1]]);
    expect(second).toEqual(first);
  });
});

describe('the hours a day is drawn between', () => {
  const blockOf = (from: number, drawnTo: number) => ({ from, drawnTo });
  it(`are ${DAY_START_HOUR}:00 to ${DAY_END_HOUR}:00 unless something stands outside them`, () => {
    expect(timelineRange([])).toEqual({ from: 7, to: 22 });
    expect(timelineRange([blockOf(9 * 60, 13 * 60)])).toEqual({ from: 7, to: 22 });
    expect(timelineRange([blockOf(7 * 60, 22 * 60)])).toEqual({ from: 7, to: 22 });
  });
  it('move outwards, by whole hours, to take in a block that begins before the first hour or runs past the last', () => {
    expect(timelineRange([blockOf(5 * 60 + 30, 7 * 60 + 30)])).toEqual({ from: 5, to: 22 });
    expect(timelineRange([blockOf(20 * 60, 23 * 60 + 30)])).toEqual({ from: 7, to: 24 });
    expect(timelineRange([blockOf(5 * 60, 6 * 60), blockOf(22 * 60, 1440)])).toEqual({ from: 5, to: 24 });
    expect(timelineRange([blockOf(0, 90)])).toEqual({ from: 0, to: 22 });
  });
  it('place a minute of the clock by the hour it stands in, an hour being as tall as the screen draws it', () => {
    const range = { from: 7, to: 22 };
    expect(topOf(7 * 60, range)).toBe(0);
    expect(topOf(9 * 60, range)).toBe(2 * HOUR_HEIGHT);
    expect(topOf(9 * 60 + 30, range)).toBe(2.5 * HOUR_HEIGHT);
    expect(topOf(5 * 60, { from: 5, to: 22 })).toBe(0);
  });
});


describe('readable appointments at the midnight boundary', () => {
  it('keeps a 48dp target at 23:15, and routes shorter clipped targets to a row with unchanged times', () => {
    const edge = at('edge', '23:15', null), late = at('late', '23:16', null), latest = at('latest', '23:50', null);
    const result = layoutDay([edge, late, latest], DAY);
    expect(result.blocks.map(block => block.entry.key)).toEqual(['edge']);
    expect(result.overflow).toEqual([late, latest]);
    expect(latest.endsAt).toBeNull();
  });
  it('keeps a crossing appointment once per day, without changing its true end', () => {
    const night = at('night', '23:50', null, { endsAt: serbian('2026-10-09', '00:10') });
    expect(layoutDay([night], DAY)).toEqual({ blocks: [], overflow: [night] });
    expect(layoutDay([night], '2026-10-09').blocks[0]).toMatchObject({ entry: night, from: 0, to: 10 });
  });
  it('retains every appointment exactly once when late starts and crowded columns coexist', () => {
    const input = [at('a', '09:00', '11:00'), at('b', '09:10', '11:00'), at('c', '09:20', '11:00'), at('d', '09:30', '11:00'), at('late', '23:50', null)];
    const result = layoutDay(input, DAY);
    expect([...result.blocks.map(block => block.entry.key), ...result.overflow.map(item => item.key)].sort()).toEqual(input.map(item => item.key).sort());
  });
});
