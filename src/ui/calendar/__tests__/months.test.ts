import { weekDates } from '../calendarPresentation';
import { addMonths, addMonthsToDay, daysInMonth, monthDistance, monthGrid, monthName } from '../months';

// The month of the calendar's grid: Monday first, five weeks or six, every cell a real civil date (the neighbours' days fill the first and
// last week and are marked as theirs), so there is never a blank cell without a name.
const own = (month: string) => monthGrid(month).flat().filter(cell => cell.inMonth).map(cell => cell.day);

describe('monthGrid', () => {
  it('is five weeks of seven, or six when the month needs them (never fewer: a month that fits in four borrows a week)', () => {
    // October 2026 starts on a Thursday and has 31 days: three before and one after in five weeks. November 2026 starts on a Sunday: six weeks.
    expect(monthGrid('2026-10')).toHaveLength(5);
    expect(monthGrid('2026-11')).toHaveLength(6);
    // February 2027 is exactly four weeks (it starts on a Monday and has 28 days), drawn as five.
    expect(monthGrid('2027-02')).toHaveLength(5);
    for (const month of ['2026-02', '2026-10', '2026-11', '2026-12', '2027-05']) for (const week of monthGrid(month)) expect([month, week.length]).toEqual([month, 7]);
  });
  it('starts the month under its own weekday, Monday first, with the days before it as the previous month\'s', () => {
    // 1 October 2026 is a Thursday: Monday 28 September, Tuesday 29 and Wednesday 30 come first.
    expect(monthGrid('2026-10')[0].map(cell => cell.day)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(monthGrid('2026-10')[0].map(cell => cell.inMonth)).toEqual([false, false, false, true, true, true, true]);
    // 1 November 2026 is a Sunday: six days of October before it.
    expect(monthGrid('2026-11')[0].map(cell => cell.inMonth)).toEqual([false, false, false, false, false, false, true]);
    // 1 February 2027 is a Monday: none before it.
    expect(monthGrid('2027-02')[0][0]).toEqual({ day: '2027-02-01', inMonth: true });
  });
  it('holds every day of the month once and in order, whatever its length, and marks the rest as a neighbour\'s', () => {
    expect(own('2026-10')).toHaveLength(31);
    expect(own('2026-11')).toHaveLength(30);
    expect(own('2026-02')).toHaveLength(28);
    expect(own('2028-02')).toHaveLength(29);
    expect(own('2026-10')[0]).toBe('2026-10-01'); expect(own('2026-10')[30]).toBe('2026-10-31');
    // The last row of October 2026 ends with the first days of November.
    const last = monthGrid('2026-10')[4];
    expect(last.map(cell => cell.day)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(last[6].inMonth).toBe(false);
  });
  it('is one run of consecutive days, a year over the new year too', () => {
    const days = monthGrid('2026-12').flat().map(cell => cell.day);
    expect(days[0]).toBe('2026-11-30');
    for (let at = 1; at < days.length; at++) expect(new Date(`${days[at]}T12:00:00Z`).getTime() - new Date(`${days[at - 1]}T12:00:00Z`).getTime()).toBe(86_400_000);
    expect(days).toContain('2027-01-03');
  });
  it('puts the same weekday in the same column as the week strip does', () => {
    const grid = monthGrid('2026-10');
    for (const week of grid) for (const [column, cell] of week.entries()) expect([cell.day, column]).toEqual([cell.day, weekDates(cell.day).indexOf(cell.day)]);
  });
});

describe('addMonths, addMonthsToDay and monthName', () => {
  it('steps over the year in both directions', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-10', 14)).toBe('2027-12');
    expect(addMonths('2026-01', -13)).toBe('2024-12');
    expect(addMonths('2026-10', 0)).toBe('2026-10');
  });
  it('steps a day to the same day of the next month, and to the last day of one that is shorter', () => {
    expect(addMonthsToDay('2026-10-08', 1)).toBe('2026-11-08');
    expect(addMonthsToDay('2026-10-08', -1)).toBe('2026-09-08');
    expect(addMonthsToDay('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonthsToDay('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDay('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsToDay('2026-03-31', -1)).toBe('2026-02-28');
  });
  it('knows how many days a month has', () => {
    expect([daysInMonth('2026-10'), daysInMonth('2026-11'), daysInMonth('2026-02'), daysInMonth('2028-02')]).toEqual([31, 30, 28, 29]);
  });
  it('names the month in Serbian with its year', () => {
    expect(monthName('2026-10')).toBe('Oktobar 2026');
    expect(monthName('2027-03')).toBe('Mart 2027');
    expect(monthName('2026-12')).toBe('Decembar 2026');
  });
});

describe('monthDistance', () => {
  it('counts the months between two, either way round, across the year', () => {
    expect(monthDistance('2026-10', '2026-10')).toBe(0);
    expect(monthDistance('2026-10', '2026-11')).toBe(1);
    expect(monthDistance('2026-11', '2026-10')).toBe(1);
    expect(monthDistance('2026-12', '2027-02')).toBe(2);
    expect(monthDistance('2027-01', '2026-01')).toBe(12);
  });
});
