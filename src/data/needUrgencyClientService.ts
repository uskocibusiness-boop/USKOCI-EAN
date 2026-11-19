import type { NeedUrgencyProjection } from '../contracts/projections';

/** @deprecated Urgency is retired. Kept as a compatibility adapter for older callers. */
export const NEED_URGENCY_BUDGET_MS = 4000;

/** Historical urgency flags are intentionally ignored; this adapter performs no RPC. */
export async function readNeedUrgencies(
  _rows: readonly { id: unknown; urgent?: unknown }[],
  _signal?: AbortSignal,
): Promise<Map<string, NeedUrgencyProjection>> {
  void _rows;
  void _signal;
  return new Map();
}

/** Legacy urgency payloads are never accepted by the current client. */
export function decodeNeedUrgency(_raw: unknown, _id: string): null {
  void _raw;
  void _id;
  return null;
}
