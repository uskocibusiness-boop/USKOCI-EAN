import { useCallback } from 'react';
import { publicProfileClientService } from '../../data/publicProfileClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { T } from '../Text';
import { KeyValueRow } from '../system/KeyValueRow';
import { Section } from '../system/Section';

type Role = 'narucilac' | 'uskocer';
/** How many Dogovori the person finished in one role, or null when that count could not be read (never a made-up zero). */
export type FinishedFact = { role: Role; count: number | null };
/** The roles are named the way the app names them everywhere else: "Uskačeš" and "Tražiš pomoć" (the owner's words). */
export const roleWords = (role: Role) => role === 'uskocer' ? 'Kad uskačeš' : 'Kad tražiš pomoć';
export type FinishedView = { kind: 'loading' } | { kind: 'ready'; facts: readonly FinishedFact[] };

/**
 * "Završeni Dogovori" as the profile draws it (UI/UX pass 2026-10-08, F6; composition spec 4.14): a section with two facts, one per
 * role, as `KeyValueRow`s, and one word at the end of its title that goes to the Dogovori that were finished (the Dogovori screen takes
 * `odeljak: 'istorija'`). Presentation only: the container below reads the counts. A count that could not be read says so in its own row,
 * and the word at the end of the title is then "Osveži" (the way onward comes back with the count).
 */
export function FinishedAgreements({ view, onOpen, onRefresh }: {
  view: FinishedView;
  /** Opens the finished Dogovori. Absent: the summary is only a summary. */ onOpen?: () => void;
  onRefresh: () => void;
}) {
  if (view.kind === 'loading') return <Section title="Završeni Dogovori" testID="profile-work-summary">
    <T variant="note" tone="muted" accessibilityRole="progressbar" accessibilityLabel="Učitavanje završenih Dogovora">Učitavamo pregled…</T>
  </Section>;
  const unavailable = view.facts.some(fact => fact.count === null);
  const action = unavailable ? { label: 'Osveži', accessibilityLabel: 'Osveži pregled završenih Dogovora', onPress: onRefresh }
    : onOpen ? { label: 'Pogledaj', accessibilityLabel: 'Pogledaj završene Dogovore', onPress: onOpen } : undefined;
  return <Section title="Završeni Dogovori" action={action} testID="profile-work-summary">
    {view.facts.map((fact, index) => <KeyValueRow key={fact.role} label={roleWords(fact.role)} last={index === view.facts.length - 1}
      value={fact.count === null ? <T tone="muted">Broj nije dostupan</T> : fact.count.toLocaleString('sr-Latn-RS')} />)}
  </Section>;
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
