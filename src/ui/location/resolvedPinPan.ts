import { displayedPinPosition, type ResolvedPinPosition } from './ResolvedPinMap.types';

export type PanStart = Readonly<{ zoom: number; userInteraction: boolean }>;
type Finished = Readonly<{ zoom?: unknown; userInteraction?: unknown; center?: unknown }>;

/**
 * Only a completed one-finger/ordinary map pan is an UNSAVED location proposal.
 * Zoom, programmatic camera updates, stale/invalid coordinates, a disabled map,
 * and an unchanged center must leave the selected point untouched.
 * The parent still owns the explicit confirmation and eventual server save.
 */
export function panFinishedProposal(input: Readonly<{
  start: PanStart | null; finish: Finished | null; current: ResolvedPinPosition | null; editable: boolean;
}>): ResolvedPinPosition | null {
  const { start, finish, current, editable } = input;
  if (!editable || !start?.userInteraction || finish?.userInteraction !== true ||
      typeof start.zoom !== 'number' || !Number.isFinite(start.zoom) ||
      typeof finish.zoom !== 'number' || !Number.isFinite(finish.zoom) ||
      Math.abs(start.zoom - finish.zoom) > 0.02 ||
      !Array.isArray(finish.center) || finish.center.length !== 2) return null;
  const [longitude, latitude] = finish.center;
  const next = displayedPinPosition({ latitude, longitude });
  if (!next) return null;
  // Ignore sub-metre pixel jitter. The selected pin may initially be absent
  // when the map was opened with a verified camera hint.
  if (current && Math.abs(current.latitude - next.latitude) < 0.00001 &&
    Math.abs(current.longitude - next.longitude) < 0.00001) return null;
  return next;
}
