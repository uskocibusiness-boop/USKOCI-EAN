import type { NeedUrgencyProjection } from '../../contracts/projections';

/** Compatibility clock for older call sites; urgency no longer owns timers. */
export function useUrgencyClock(_values: readonly (NeedUrgencyProjection | undefined)[]): number {
  return Date.now();
}

/** Historical urgency is not displayed in cards, details, maps or accessibility labels. */
export function NeedUrgencyBadge(_props: { urgency?: NeedUrgencyProjection; now?: number }) {
  return null;
}
