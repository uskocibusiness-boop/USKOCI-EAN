/**
 * The month the planner opens from the name of the week, as plain civil dates ("2026-10", "2026-10-07"): no React, no zone, no
 * native module. Monday first, as the Serbian week runs.
 */

const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
/** "Oktobar 2026". */
export const monthName = (month: string): string => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

const pad = (value: number) => String(value).padStart(2, '0');
/** The month `delta` months from `month` ("2026-12" + 1 = "2027-01"). */
export function addMonths(month: string, delta: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** How many months apart two months are, whichever comes first ("2026-12" and "2027-02" are 2). */
export const monthDistance = (a: string, b: string): number =>
  Math.abs((Number(a.slice(0, 4)) * 12 + Number(a.slice(5, 7))) - (Number(b.slice(0, 4)) * 12 + Number(b.slice(5, 7))));

/** Six weeks of seven, the most any month needs, so the panel is as tall for February as for a month that spans six weeks. */
const CELLS = 42;
/** Every day of a month as civil dates, the empty cells before the first one so the weeks start on Monday, and empty cells after the last. */
export function monthCells(month: string): (string | null)[] {
  const count = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const days = Array.from({ length: count }, (_, index) => `${month}-${pad(index + 1)}`);
  const lead = (new Date(`${days[0]}T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...days];
  while (cells.length < CELLS) cells.push(null);
  return cells;
}
