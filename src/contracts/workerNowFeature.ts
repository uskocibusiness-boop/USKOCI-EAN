/** Owner decision 2026-11-19: the standalone “Mogu odmah” mode is retired.
 * The old persisted field remains only for backward-compatible reads; it is not editable,
 * displayed, used for matching, or allowed to influence dispatch ranking.
 */
export const WORKER_AVAILABLE_NOW_ENABLED = false as const;
