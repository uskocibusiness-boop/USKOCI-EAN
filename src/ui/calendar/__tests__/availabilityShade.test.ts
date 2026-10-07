import type { AvailabilityRule, AvailabilityWindow } from '../../../contracts/workerAvailability';
import { dayAvailability } from '../availabilityShade';

// The shade under a day number: "on this day I have said I can work", read from Dostupnost and cut by the SERBIAN day.
let counter = 0;
const rule = (weekdays: number[], startTime: string, endTime: string, patch: Partial<AvailabilityRule> = {}): AvailabilityRule =>
  ({ id: `rule-${++counter}`, weekdays, startTime, endTime, startsOn: '2026-01-01', endsOn: null, label: '', active: true, ...patch });
const window = (state: AvailabilityWindow['state'], startsAt: string, endsAt: string): AvailabilityWindow =>
  ({ id: `window-${++counter}`, startsAt, endsAt, state, label: '' });
const belgrade = (rules: AvailabilityRule[], windows: AvailabilityWindow[] = []) => ({ timezone: 'Europe/Belgrade', rules, windows });

describe('the weekly rules', () => {
  const week = belgrade([rule([1, 2, 3, 4, 5], '09:00:00', '17:00:00')]);
  it('make a working day available for the hours they name', () => {
    // 2026-10-05 is a Monday.
    expect(dayAvailability(week, '2026-10-05')).toEqual({ minutes: 480, spoken: '09:00–17:00' });
  });
  it('leave a day they do not name without a shade', () => {
    expect(dayAvailability(week, '2026-10-10')).toBeNull();
    expect(dayAvailability(week, '2026-10-11')).toBeNull();
  });
  it('keep to the dates they are valid on, and to being switched on', () => {
    expect(dayAvailability(belgrade([rule([1], '09:00', '17:00', { startsOn: '2026-10-12' })]), '2026-10-05')).toBeNull();
    expect(dayAvailability(belgrade([rule([1], '09:00', '17:00', { startsOn: '2026-10-12' })]), '2026-10-12')).not.toBeNull();
    expect(dayAvailability(belgrade([rule([1], '09:00', '17:00', { endsOn: '2026-10-04' })]), '2026-10-05')).toBeNull();
    expect(dayAvailability(belgrade([rule([1], '09:00', '17:00', { endsOn: '2026-10-05' })]), '2026-10-05')).not.toBeNull();
    expect(dayAvailability(belgrade([rule([1], '09:00', '17:00', { active: false })]), '2026-10-05')).toBeNull();
  });
  it('read a clock written with seconds and fractions to the minute, and skip one that is not a clock', () => {
    expect(dayAvailability(belgrade([rule([1], '09:00:00.123456', '12:30:00.654321')]), '2026-10-05')).toEqual({ minutes: 210, spoken: '09:00–12:30' });
    expect(dayAvailability(belgrade([rule([1], 'rano', '12:00')]), '2026-10-05')).toBeNull();
    expect(dayAvailability(belgrade([rule([1], '12:00', '09:00')]), '2026-10-05')).toBeNull();
  });
  it('join two slots of one day without merging them, and say both', () => {
    const split = belgrade([rule([1], '08:00', '12:00'), rule([1], '14:00', '18:00')]);
    expect(dayAvailability(split, '2026-10-05')).toEqual({ minutes: 480, spoken: '08:00–12:00, 14:00–18:00' });
  });
  it('say the first three slots and count the rest', () => {
    const many = belgrade([rule([1], '06:00', '07:00'), rule([1], '08:00', '09:00'), rule([1], '10:00', '11:00'), rule([1], '12:00', '13:00')]);
    expect(dayAvailability(many, '2026-10-05')?.spoken).toBe('06:00–07:00, 08:00–09:00, 10:00–11:00 i još 1');
  });
  it('count a night as two slots: the evening on its day, the morning on the next', () => {
    // Friday 22:00-24:00 and, as the Termin sheet saves it, Saturday 00:00-06:00 dated one day later.
    const night = belgrade([rule([5], '22:00:00', '24:00:00'), rule([6], '00:00:00', '06:00:00', { startsOn: '2026-10-10' })]);
    expect(dayAvailability(night, '2026-10-09')).toEqual({ minutes: 120, spoken: '22:00–24:00' });
    expect(dayAvailability(night, '2026-10-10')).toEqual({ minutes: 360, spoken: '00:00–06:00' });
    expect(dayAvailability(night, '2026-10-11')).toBeNull();
  });
});

describe('the dated exceptions', () => {
  const week = [rule([1, 2, 3, 4, 5], '09:00', '17:00')];
  it('take an unavailable hour out of the day', () => {
    // 12:00-13:00 Serbian time on Monday 2026-10-05 is 10:00-11:00 UTC.
    const result = dayAvailability(belgrade(week, [window('UNAVAILABLE', '2026-10-05T10:00:00Z', '2026-10-05T11:00:00Z')]), '2026-10-05');
    expect(result).toEqual({ minutes: 420, spoken: '09:00–12:00, 13:00–17:00' });
  });
  it('take a whole day away', () => {
    expect(dayAvailability(belgrade(week, [window('UNAVAILABLE', '2026-10-04T22:00:00Z', '2026-10-05T22:00:00Z')]), '2026-10-05')).toBeNull();
  });
  it('add an available stretch to a day the rules leave out', () => {
    const result = dayAvailability(belgrade(week, [window('AVAILABLE', '2026-10-11T08:00:00Z', '2026-10-11T10:00:00Z')]), '2026-10-11');
    expect(result).toEqual({ minutes: 120, spoken: '10:00–12:00' });
  });
  it('count only the part of an exception that lies on the day', () => {
    // From Sunday 23:00 to Monday 01:00 Serbian time: one hour on each day.
    const overnight = belgrade([], [window('AVAILABLE', '2026-10-04T21:00:00Z', '2026-10-04T23:00:00Z')]);
    expect(dayAvailability(overnight, '2026-10-04')).toEqual({ minutes: 60, spoken: '23:00–24:00' });
    expect(dayAvailability(overnight, '2026-10-05')).toEqual({ minutes: 60, spoken: '00:00–01:00' });
  });
});

describe('a day with a clock change is counted in real time', () => {
  it('has three hours between 01:00 and 05:00 on 2026-03-29, when the clocks go forward', () => {
    // 2026-03-29 is a Sunday (0): 01:00 CET to 05:00 CEST, with 02:00 to 03:00 not existing.
    expect(dayAvailability(belgrade([rule([0], '01:00', '05:00')]), '2026-03-29')?.minutes).toBe(180);
  });
  it('has five hours between 01:00 and 05:00 on 2026-10-25, when the clocks go back', () => {
    // 01:00 CEST to 05:00 CET, with 02:00 to 03:00 happening twice.
    expect(dayAvailability(belgrade([rule([0], '01:00', '05:00')]), '2026-10-25')?.minutes).toBe(300);
  });
  it('shades a rule over the 25-hour day all the way to its end', () => {
    expect(dayAvailability(belgrade([rule([0], '00:00', '24:00')]), '2026-10-25')).toEqual({ minutes: 1500, spoken: '00:00–24:00' });
    expect(dayAvailability(belgrade([rule([0], '00:00', '24:00')]), '2026-03-29')).toEqual({ minutes: 1380, spoken: '00:00–24:00' });
  });
});

describe('an availability kept in another zone', () => {
  const newYork = (rules: AvailabilityRule[]) => ({ timezone: 'America/New_York', rules, windows: [] as AvailabilityWindow[] });
  it('falls where the hours really are in Serbian time', () => {
    // Monday 09:00-17:00 in New York (UTC-4 in October) is 15:00-23:00 in Serbia (UTC+2).
    expect(dayAvailability(newYork([rule([1], '09:00', '17:00')]), '2026-10-05')).toEqual({ minutes: 480, spoken: '15:00–23:00' });
    expect(dayAvailability(newYork([rule([1], '09:00', '17:00')]), '2026-10-06')).toBeNull();
  });
  it('moves an evening in New York to the next Serbian day', () => {
    // Monday 20:00-24:00 in New York is Tuesday 02:00-06:00 in Serbia.
    const evening = newYork([rule([1], '20:00', '24:00')]);
    expect(dayAvailability(evening, '2026-10-05')).toBeNull();
    expect(dayAvailability(evening, '2026-10-06')).toEqual({ minutes: 240, spoken: '02:00–06:00' });
  });
});

it('says nothing, and does not throw, for a zone that does not exist', () => {
  expect(dayAvailability({ timezone: 'Nema/Zone', rules: [rule([1], '09:00', '17:00')], windows: [] }, '2026-10-05')).toBeNull();
});
