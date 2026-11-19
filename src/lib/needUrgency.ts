import type { NeedUrgencyProjection } from '../contracts/projections';

/** HITNO is retired from the product. Historical projection data is ignored. */
export function urgentBuilt(_flag?: unknown): boolean {
  return false;
}

/** Historical urgency values never affect display, ranking or accessibility. */
export function displaysUrgent(_urgency: NeedUrgencyProjection | undefined, _now = Date.now()): boolean {
  return false;
}
