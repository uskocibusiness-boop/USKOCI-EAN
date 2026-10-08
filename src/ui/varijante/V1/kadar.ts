import { sys } from '../../system/tokens';

/**
 * Kadar (a frame) of a motion for the design lab (V1 variants, 2026-10-08). A screenshot cannot show a 240 ms arrival, so the
 * scene accepts `?t=<ms>` and every moving part of the variant stands exactly where the live motion would have it at that
 * instant: the same curve, the same delay, the same duration, solved here instead of played. Without `t` the motion runs live.
 * Lab only: nothing in the app reads a frame.
 */
export type Kadar = number | null;

/**
 * The y of a cubic Bézier easing at x (both 0..1): the curve `Easing.bezier(...)` plays, solved by Newton's method so a frozen
 * frame lands where the live motion is at that instant.
 */
export function bezierAt(x: number, [x1, y1, x2, y2]: readonly [number, number, number, number]): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const ax = 3 * x1 - 3 * x2 + 1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  let t = x;
  for (let step = 0; step < 8; step++) {
    const atT = ((ax * t + bx) * t + cx) * t - x;
    const slope = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(atT) < 1e-6 || slope === 0) break;
    t -= atT / slope;
  }
  t = Math.min(1, Math.max(0, t));
  return ((ay * t + by) * t + cy) * t;
}

/** Where a motion that starts after `delay` and lasts `duration` stands at `at` ms, eased: 0 before it starts, 1 when it is over. */
export function easedProgress(at: number, delay: number, duration: number, easing: readonly [number, number, number, number]): number {
  if (duration <= 0) return 1;
  const linear = Math.min(1, Math.max(0, (at - delay) / duration));
  return bezierAt(linear, easing);
}

/** Easing.inOut(Easing.quad), as a number: the breath of the live dot (B7) and of a skeleton. */
export function inOutQuad(p: number): number {
  const x = Math.min(1, Math.max(0, p));
  return x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2;
}

/** The `t` of the address, in ms since the trigger; anything else is "live". */
export function readKadar(value: string | string[] | undefined): Kadar {
  const word = Array.isArray(value) ? value[0] : value;
  if (word === undefined || word === '') return null;
  const ms = Number(word);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

/** The stagger stops after six rows, as in `Appear` (ROWS_THAT_ARRIVE). */
const ROWS_THAT_ARRIVE = 6;
/** When the row at `index` begins to arrive: the stagger step of `sys.motion`, capped at six rows. */
export const uskokDelay = (index: number) => Math.min(index, ROWS_THAT_ARRIVE) * sys.motion.stagger;
