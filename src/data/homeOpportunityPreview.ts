import type { PrilikaProjekcija } from '../contracts/projections';
import type { HomeReads } from './homeSnapshot';

/** The Home preview is for other people's work; the full Zadaci screen still shows every public task. */
export function homeOpportunityPreview(
  opportunities: readonly PrilikaProjekcija[] | undefined,
  ownNeeds: HomeReads['needs'] | undefined,
): PrilikaProjekcija[] {
  // Without the owner's list we cannot identify their public tasks. Keep the
  // "Pogledaj sve" entry, but do not present an own task as work for them.
  if (!opportunities || ownNeeds?.kind !== 'known') return [];
  const ownedIds = new Set(ownNeeds.value.map(need => need.id.toLowerCase()));
  return opportunities.filter(task => !ownedIds.has(task.id.toLowerCase()));
}
