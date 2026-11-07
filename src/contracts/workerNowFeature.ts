/** Owner decision 2026-11-07: postpone the optional “available right now” mode.
 * Preserve the stored legacy field and weekday/date schedules for reversible rollout.
 * The immediate worker toggle is NOT task urgency (“Hitno”).
 * Re-enable only together with server dispatch/matching and Android acceptance. */
export const WORKER_AVAILABLE_NOW_ENABLED = false as boolean;
