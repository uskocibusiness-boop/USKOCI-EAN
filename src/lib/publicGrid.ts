/**
 * Public approximate point grid (owner decision 2026-11-20: "približna javna lokacija do 200 m").
 * Step 0.002° = 1/500°: ~222 m north-south and ~160 m east-west in Serbia (42-46°N), so the true point is
 * at most ~140 m from the published one and the cell is never finer than ~150 m. The server uses the same
 * grid (round(x*500)/500); legacy 0.01° points are multiples of 0.002° and stay valid.
 */
export const PUBLIC_GRID_STEPS_PER_DEGREE = 500;
export const toPublicGrid = (value: number): number =>
  Number((Math.round(value * PUBLIC_GRID_STEPS_PER_DEGREE) / PUBLIC_GRID_STEPS_PER_DEGREE).toFixed(3));
export const isPublicGrid = (value: number): boolean => Number.isFinite(value)
  && Math.abs(Math.round(value * PUBLIC_GRID_STEPS_PER_DEGREE) - value * PUBLIC_GRID_STEPS_PER_DEGREE) < 1e-6;
