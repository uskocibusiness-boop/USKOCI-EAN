import type { PrilikaProjekcija } from '../contracts/projections';
import type { HomeReads } from './homeSnapshot';

/** The Home preview is for other people's work; the full Zadaci screen still shows every public task. */
export function homeOpportunityPreview(
  opportunities: readonly PrilikaProjekcija[] | undefined,
  ownNeeds: HomeReads['needs'] | undefined,
): PrilikaProjekcija[] {
  // Defense in depth beside the server's bounded other-owner mode: retain the
  // existing fail-closed behavior when the Home core/owned-task read is incomplete.
  // "Pogledaj sve" remains available; a partial core is not an ownership receipt.
  if (!opportunities || ownNeeds?.kind !== 'known') return [];
  const ownedIds = new Set(ownNeeds.value.map(need => need.id.toLowerCase()));
  return opportunities.filter(task => !ownedIds.has(task.id.toLowerCase()));
}
