import { weekDates } from '../calendarPresentation';
import { inWindow, instantMs, plannerWindow, serbianClock, serbianDayOf, serbianDayRange, serbianSpan, serbianToday } from '../serbianDays';

// One zone for days AND hours (owner, 2026-10-07). Jest runs with TZ=UTC (jest.config.cjs), so the phone's own midnight is the
// UTC one: every case below would land on a different day if a day were still cut in the phone's zone.
const hours = (range: { from: string; to: string }) => (Date.parse(range.to) - Date.parse(range.from)) / 3_600_000;

describe('the day an instant belongs to is a Serbian day', () => {
  it('moves to the next day at Serbian midnight in summer time (UTC+2)', () => {
    expect(serbianDayOf('2026-09-24T21:59:59Z')).toBe('2026-09-24');
    expect(serbianDayOf('2026-09-24T22:00:00Z')).toBe('2026-09-25');
    expect(serbianDayOf('2026-09-24T21:59:59.999999Z')).toBe('2026-09-24');
  });
  it('moves to the next day at Serbian midnight in winter time (UTC+1), across the new year', () => {
    expect(serbianDayOf('2026-12-31T22:59:59Z')).toBe('2026-12-31');
    expect(serbianDayOf('2026-12-31T23:00:00Z')).toBe('2027-01-01');
  });
  it('reads an instant written with any offset as the same moment', () => {
    expect(serbianDayOf('2026-09-25T00:30:00+02:00')).toBe('2026-09-25');
    expect(serbianDayOf('2026-09-24T18:30:00-04:00')).toBe('2026-09-25');
  });
  it('takes a Date as well, and says null for anything that is not an instant', () => {
    expect(serbianDayOf(new Date('2026-09-24T22:30:00Z'))).toBe('2026-09-25');
    expect(serbianDayOf('')).toBeNull();
    expect(serbianDayOf('2026-09-24')).toBeNull();
    expect(serbianDayOf(new Date(Number.NaN))).toBeNull();
  });
  it('has a today that follows Serbian midnight, not the phone\'s', () => {
    expect(serbianToday(new Date('2026-09-24T21:00:00Z'))).toBe('2026-09-24');
    expect(serbianToday(new Date('2026-09-24T22:30:00Z'))).toBe('2026-09-25');
  });
});

describe('the exact instants of a Serbian day', () => {
  it('runs from one Serbian midnight to the next', () => {
    expect(serbianDayRange('2026-09-24')).toEqual({ from: '2026-09-23T22:00:00.000Z', to: '2026-09-24T22:00:00.000Z' });
    expect(serbianDayRange('2026-12-31')).toEqual({ from: '2026-12-30T23:00:00.000Z', to: '2026-12-31T23:00:00.000Z' });
  });
  it('is 23 hours long on 2026-03-29, when the clocks go forward', () => {
    const day = serbianDayRange('2026-03-29');
    expect(day).toEqual({ from: '2026-03-28T23:00:00.000Z', to: '2026-03-29T22:00:00.000Z' });
    expect(hours(day)).toBe(23);
    // The day before ends where this one starts, and the day after starts where this one ends: no gap and no overlap.
    expect(serbianDayRange('2026-03-28').to).toBe(day.from);
    expect(serbianDayRange('2026-03-30').from).toBe(day.to);
  });
  it('is 25 hours long on 2026-10-25, when the clocks go back', () => {
    const day = serbianDayRange('2026-10-25');
    expect(day).toEqual({ from: '2026-10-24T22:00:00.000Z', to: '2026-10-25T23:00:00.000Z' });
    expect(hours(day)).toBe(25);
    expect(serbianDayRange('2026-10-24').to).toBe(day.from);
    expect(serbianDayRange('2026-10-26').from).toBe(day.to);
  });
  it('puts the instants around the clock changes on the right day', () => {
    // 2026-03-29: 00:59 is CET, 03:00 (CEST) follows 01:59 at once; 22:00Z is already the 30th.
    expect(serbianDayOf('2026-03-28T23:00:00Z')).toBe('2026-03-29');
    expect(serbianDayOf('2026-03-29T00:59:59Z')).toBe('2026-03-29');
    expect(serbianDayOf('2026-03-29T01:00:00Z')).toBe('2026-03-29');
    expect(serbianDayOf('2026-03-29T21:59:59Z')).toBe('2026-03-29');
    expect(serbianDayOf('2026-03-29T22:00:00Z')).toBe('2026-03-30');
    // 2026-10-25: the clock reads 02:30 twice (00:30Z and 01:30Z); both are the 25th; 22:59Z is still the 25th, 23:00Z the 26th.
    expect(serbianDayOf('2026-10-24T21:59:59Z')).toBe('2026-10-24');
    expect(serbianDayOf('2026-10-24T22:00:00Z')).toBe('2026-10-25');
    expect(serbianDayOf('2026-10-25T00:30:00Z')).toBe('2026-10-25');
    expect(serbianDayOf('2026-10-25T01:30:00Z')).toBe('2026-10-25');
    expect(serbianDayOf('2026-10-25T22:59:59Z')).toBe('2026-10-25');
    expect(serbianDayOf('2026-10-25T23:00:00Z')).toBe('2026-10-26');
  });
  it('refuses a day that is not a day, and does not answer from a stale cache', () => {
    expect(() => serbianDayRange('2026-13-45')).toThrow();
    expect(() => serbianDayRange('danas')).toThrow();
    expect(serbianDayRange('2026-09-24')).toBe(serbianDayRange('2026-09-24'));
  });
  it('spans from the first midnight of one day to the last of another', () => {
    expect(serbianSpan('2026-09-21', '2026-09-27')).toEqual({ from: '2026-09-20T22:00:00.000Z', to: '2026-09-27T22:00:00.000Z' });
  });
});

describe('the window of weeks read at once', () => {
  it('covers the month of a day in whole weeks, Monday first', () => {
    // October 2026 starts on a Thursday and ends on a Saturday.
    const window = plannerWindow('2026-10-07');
    expect([window.first, window.last]).toEqual(['2026-09-28', '2026-11-01']);
    expect(window.from).toBe('2026-09-27T22:00:00.000Z');
    // 1 November is after the clocks went back: the window closes at the CET midnight.
    expect(window.to).toBe('2026-11-01T23:00:00.000Z');
  });
  it('is the same window for every day of the month, so a swipe between weeks reads nothing new', () => {
    expect(plannerWindow('2026-10-01')).toEqual(plannerWindow('2026-10-31'));
    expect(plannerWindow('2026-10-31')).not.toEqual(plannerWindow('2026-11-01'));
  });
  it('is exactly four weeks for a February that starts on a Monday', () => {
    const window = plannerWindow('2027-02-14');
    expect([window.first, window.last]).toEqual(['2027-02-01', '2027-02-28']);
  });
  it('is six weeks when a month starts on a Sunday and ends on a Monday (November 2026)', () => {
    const window = plannerWindow('2026-11-18');
    expect([window.first, window.last]).toEqual(['2026-10-26', '2026-12-06']);
    expect(Math.round(hours(window) / 24)).toBe(42);
  });
  it('holds the whole week of any day of the month inside it', () => {
    for (const day of ['2026-10-01', '2026-10-04', '2026-10-05', '2026-10-31', '2026-11-01', '2026-11-30', '2027-01-01']) {
      const window = plannerWindow(day);
      const week = weekDates(day);
      expect([day, inWindow(week[0], window), inWindow(week[6], window)]).toEqual([day, true, true]);
    }
    expect(inWindow('2026-09-27', plannerWindow('2026-10-07'))).toBe(false);
    expect(inWindow('2026-11-02', plannerWindow('2026-10-07'))).toBe(false);
  });
  it('reaches the months around it when asked to: three months of whole weeks for one on each side', () => {
    const window = plannerWindow('2026-10-07', 1);
    // September 2026 starts on a Tuesday, November ends on a Monday: the weeks run from 31 August to 6 December.
    expect([window.first, window.last]).toEqual(['2026-08-31', '2026-12-06']);
    expect(window.from).toBe('2026-08-30T22:00:00.000Z');
    expect(window.to).toBe('2026-12-06T23:00:00.000Z');
    // The one-month window lies inside it, and so does every day of the three months.
    expect(inWindow(plannerWindow('2026-10-07').first, window) && inWindow(plannerWindow('2026-10-07').last, window)).toBe(true);
    expect(plannerWindow('2026-10-07', 0)).toEqual(plannerWindow('2026-10-07'));
  });
  it('is the same window for every day of the middle month, and reaches across the new year', () => {
    expect(plannerWindow('2026-10-01', 1)).toEqual(plannerWindow('2026-10-31', 1));
    const window = plannerWindow('2026-12-15', 1);
    expect([window.first, window.last]).toEqual(['2026-10-26', '2027-01-31']);
    expect(window.to).toBe('2027-01-31T23:00:00.000Z');
  });
  it('runs across the new year without losing a day', () => {
    const window = plannerWindow('2026-12-31');
    expect([window.first, window.last]).toEqual(['2026-11-30', '2027-01-03']);
    expect(window.to).toBe('2027-01-03T23:00:00.000Z');
  });
});

describe('the clock of an instant', () => {
  it('is written in Serbian time to the minute', () => {
    expect(serbianClock('2026-09-24T07:15:00Z')).toBe('09:15');
    expect(serbianClock('2026-12-24T07:15:30.123456Z')).toBe('08:15');
    expect(serbianClock('2026-10-25T00:30:00Z')).toBe('02:30');
    expect(serbianClock('2026-10-25T01:30:00Z')).toBe('02:30');
    expect(serbianClock('nije vreme')).toBe('');
  });
  it('reads exact instants, microseconds included', () => {
    expect(instantMs('2026-09-24T07:15:00.999999Z')).toBe(Date.parse('2026-09-24T07:15:00.999Z'));
    expect(instantMs('2026-09-24')).toBeNull();
  });
});
