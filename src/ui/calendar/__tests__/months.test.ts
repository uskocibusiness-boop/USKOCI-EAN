import { weekDates } from '../calendarPresentation';
import { addMonths, monthCells, monthDistance, monthName } from '../months';

// The month the planner opens from the name of the week: Monday first, six weeks of seven in every month, so the panel is as tall
// for a short month as for a long one.
const days = (month: string) => monthCells(month).filter((cell): cell is string => cell !== null);

describe('monthCells', () => {
  it('is always six weeks of seven, so the panel does not change its height from month to month', () => {
    for (const month of ['2026-02', '2027-02', '2026-10', '2026-11', '2026-12', '2027-05']) expect([month, monthCells(month).length]).toEqual([month, 42]);
  });
  it('starts the month under its own weekday, Monday first', () => {
    // 1 October 2026 is a Thursday: three empty cells before it. 1 November 2026 is a Sunday: six.
    expect(monthCells('2026-10').slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(monthCells('2026-11').slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01']);
    // 1 February 2027 is a Monday: none.
    expect(monthCells('2027-02')[0]).toBe('2027-02-01');
  });
  it('holds every day of the month once and in order, whatever its length', () => {
    expect(days('2026-10')).toHaveLength(31);
    expect(days('2026-11')).toHaveLength(30);
    expect(days('2026-02')).toHaveLength(28);
    expect(days('2028-02')).toHaveLength(29);
    expect(days('2026-10')[0]).toBe('2026-10-01'); expect(days('2026-10')[30]).toBe('2026-10-31');
  });
  it('puts the same weekday in the same column as the week strip does', () => {
    const cells = monthCells('2026-10');
    for (const day of days('2026-10')) {
      const column = cells.indexOf(day) % 7, weekday = weekDates(day).indexOf(day);
      expect([day, column]).toEqual([day, weekday]);
    }
  });
  it('leaves what is after the last day empty', () => {
    const cells = monthCells('2026-02');
    expect(cells.slice(cells.indexOf('2026-02-28') + 1).every(cell => cell === null)).toBe(true);
  });
});

describe('addMonths and monthName', () => {
  it('steps over the year in both directions', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-10', 14)).toBe('2027-12');
    expect(addMonths('2026-01', -13)).toBe('2024-12');
    expect(addMonths('2026-10', 0)).toBe('2026-10');
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
