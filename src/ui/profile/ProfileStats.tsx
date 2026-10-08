import { useCallback } from 'react';
import { workTrustClientService, type MyWorkStats } from '../../data/workTrustClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { FigureCell, FigureCellError, FigureCellPlaceholder, reliabilityFigure } from './ProfileFigures';
import { RELIABILITY_MEANING, reliabilityNeeds } from './workTrustModel';

/** What the reliability figure holds: it is still reading, it could not be read, or it is read (`MyWorkStats` of the server). */
export type ProfileStatsState = { kind: 'loading' } | { kind: 'error'; onRetry: () => void } | { kind: 'ready'; stats: MyWorkStats };

/**
 * "Dolazi kako je dogovoreno" as the profile draws it (8 Oct 2026, "Lice i tri broja"): the third of the three figures, the person's own
 * reliability under the face, "90 %" with its words under it. It replaces the section "Moja statistika" (the funnel of applications sent,
 * agreed and finished, and the sentence under it): the finished count is the second figure now, and what the percentage is made of (or what
 * it waits for) is said to a screen reader as the figure's hint, so the explanation is not lost, only no longer a paragraph.
 *
 * Only for an account that has a work profile: without one there is no work to count and nothing is drawn. The percentage is the server's;
 * nothing is computed or filled in here, and a percentage that does not exist yet says so ("Još nema procenta") instead of being drawn as 0.
 *
 * Presentation only; `ProfileStats` below reads it.
 */
export function ReliabilityFigure({ state }: { state: ProfileStatsState }) {
  if (state.kind === 'loading') return <FigureCellPlaceholder label="Učitavanje statistike" />;
  if (state.kind === 'error') return <FigureCellError message="Procenat trenutno nije dostupan." retryLabel="Osveži procenat" onRetry={state.onRetry} />;
  const { stats } = state;
  if (!stats.hasWorkerProfile) return null;
  const known = stats.reliabilityState === 'AVAILABLE' && stats.reliabilityPercent !== null;
  return <FigureCell testID="profile-stats" figure={{ ...reliabilityFigure(known ? stats.reliabilityPercent : null),
    hint: known ? RELIABILITY_MEANING : reliabilityNeeds(stats.reliabilityMinimum) }} />;
}

/** Reads the person's own statistics. The route draws it only when the account has a work profile. */
export function ProfileStats() {
  const load = useCallback(async (): Promise<MyWorkStats> => {
    const result = await workTrustClientService.myStats();
    if (!result.ok) throw new Error(result.kod);
    return result.podatak;
  }, []);
  const stats = useFocusedResource(load);
  const state: ProfileStatsState = stats.loading ? { kind: 'loading' }
    : stats.error || !stats.data ? { kind: 'error', onRetry: () => { void stats.refresh(); } } : { kind: 'ready', stats: stats.data };
  return <ReliabilityFigure state={state} />;
}
