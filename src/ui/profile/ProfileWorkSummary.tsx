import { useCallback } from 'react';
import { publicProfileClientService } from '../../data/publicProfileClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { FigureCell, FigureCellError, FigureCellPlaceholder, finishedFigure } from './ProfileFigures';

type Role = 'narucilac' | 'uskocer';
/** How many Dogovori the person finished in one role, or null when that count could not be read (never a made-up zero). */
export type FinishedFact = { role: Role; count: number | null };
export type FinishedView = { kind: 'loading' } | { kind: 'ready'; facts: readonly FinishedFact[] };

/**
 * "Završeno" as the profile draws it (8 Oct 2026, "Lice i tri broja"): the second of the three figures, the number of Dogovori the person
 * finished in every role they have, written under the face as "9 završenih". It replaces the section "Završeni Dogovori" with its two
 * rows and its word "Pogledaj": with `onOpen` the figure itself is the way to the Dogovori that were finished (the Dogovori screen takes
 * `odeljak: 'istorija'`). Presentation only: the container below reads the counts. A count that could not be read is never added up as
 * if it were zero: the cell says so and offers "Osveži" in the same place.
 */
export function FinishedAgreements({ view, onOpen, onRefresh }: {
  view: FinishedView;
  /** Opens the finished Dogovori. Absent: the figure is only a figure. */ onOpen?: () => void;
  onRefresh: () => void;
}) {
  if (view.kind === 'loading') return <FigureCellPlaceholder label="Učitavanje završenih Dogovora" />;
  if (view.facts.length === 0) return null;
  if (view.facts.some(fact => fact.count === null)) {
    return <FigureCellError message="Broj završenih trenutno nije dostupan." retryLabel="Osveži pregled završenih Dogovora" onRetry={onRefresh} />;
  }
  const total = view.facts.reduce((sum, fact) => sum + (fact.count ?? 0), 0);
  const figure = finishedFigure(total);
  return <FigureCell testID="profile-work-summary" figure={onOpen ? { ...figure, hint: 'Otvara završene Dogovore.' } : figure} onPress={onOpen} />;
}

/**
 * Existing public projection counts COMPLETED Agreements per role, never tasks or payments.
 * Reads are independent of identity/reputation and fenced by useFocusedResource's account/revision/focus owner.
 */
export function ProfileWorkSummary({ requesterProfileId, workerProfileId, onOpen }: {
  requesterProfileId: string | null; workerProfileId: string | null;
  /** Opens the finished Dogovori. Absent: the summary is only a summary. */ onOpen?: () => void;
}) {
  const load = useCallback(async (signal: AbortSignal): Promise<FinishedFact[]> => {
    const targets: { id: string; role: Role }[] = [];
    if (workerProfileId) targets.push({ id: workerProfileId, role: 'uskocer' });
    if (requesterProfileId && requesterProfileId !== workerProfileId) targets.push({ id: requesterProfileId, role: 'narucilac' });
    return Promise.all(targets.map(async ({ id, role }) => {
      try {
        const profile = await publicProfileClientService.javniProfil(id, signal);
        const count = profile?.poverenje?.zavrseniBroj;
        return { role, count: profile?.profilId === id && profile.uloga === role &&
          typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : null };
      } catch { return { role, count: null }; }
    }));
  }, [requesterProfileId, workerProfileId]);
  const resource = useFocusedResource(load);
  if (!requesterProfileId && !workerProfileId) return null;
  // A read that failed as a whole is a count nobody could read, in each role the person has.
  const unread: FinishedFact[] = [...(workerProfileId ? [{ role: 'uskocer' as const, count: null }] : []),
    ...(requesterProfileId && requesterProfileId !== workerProfileId ? [{ role: 'narucilac' as const, count: null }] : [])];
  const view: FinishedView = resource.loading ? { kind: 'loading' } : { kind: 'ready', facts: resource.error || !resource.data ? unread : resource.data };
  return <FinishedAgreements view={view} onOpen={onOpen} onRefresh={() => { void resource.refresh(); }} />;
}
