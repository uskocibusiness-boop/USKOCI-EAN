import type { DogovorProjekcija } from '../../contracts/projections';
import { dogovorenoVreme } from '../../lib/dogovorenoVreme';

/**
 * The step bar of a Dogovor (plan 2.6), computed from where the Dogovor STANDS, never from its history: the history of a
 * Dogovor holds one event ("Dogovor je sklopljen"), so a bar built from it would always stand at the start.
 *
 *   Dogovoreno -> Zadatak je gotov -> Potvrđeno -> Ocena
 *
 * A step that is behind is `done` (a green check), the one the Dogovor is at is `current` (a filled green dot), the ones ahead are
 * `upcoming` (a grey outline). A cancelled Dogovor reached no step the data can name, so the whole bar is `cancelled` (grey).
 */
export type StepKey = 'agreed' | 'done' | 'confirmed' | 'rated';
export type StepStatus = 'done' | 'current' | 'upcoming' | 'cancelled';
export type OwnRating = 'DUE' | 'GIVEN' | 'CLOSED' | 'UNKNOWN' | 'NOT_APPLICABLE';
export type AgreementStep = { key: StepKey; label: string; status: StepStatus };

/** The words of the four steps. "Zadatak je gotov" is the worker's word on the green button; the requester's is "Potvrdi završetak" (step 3 is its result). */
export const STEP_LABELS: Readonly<Record<StepKey, string>> = {
  agreed: 'Dogovoreno', done: 'Zadatak je gotov', confirmed: 'Potvrđeno', rated: 'Ocena',
};
const ORDER: readonly StepKey[] = ['agreed', 'done', 'confirmed', 'rated'];

/**
 * Where each state stands. The rating step is the person's own: due (or not readable yet - the same rule as the footer, which
 * keeps "Oceni saradnju" on offer) is the current step; given is behind; closed (it can no longer be given) was never reached.
 */
export function agreementStepModel(state: DogovorProjekcija['stanje'], ownRating: OwnRating = 'NOT_APPLICABLE'): AgreementStep[] {
  if (state === 'CANCELLED') return ORDER.map(key => ({ key, label: STEP_LABELS[key], status: 'cancelled' as const }));
  const current = state === 'CONFIRMED' ? 1 : state === 'AWAITING_REQUESTER' ? 2
    : ownRating === 'DUE' || ownRating === 'UNKNOWN' ? 3 : ownRating === 'GIVEN' ? 4 : -1;
  // `done` behind the current step; after a finished Dogovor with no step left to take, everything up to "Potvrđeno" (and the rating, once given) is done.
  const reached = current === -1 ? 3 : current;
  return ORDER.map((key, index) => ({ key, label: STEP_LABELS[key],
    status: index < reached ? 'done' as const : index === current ? 'current' as const : 'upcoming' as const }));
}

/** What a screen reader hears for the bar: each step and where it stands. */
const SPOKEN: Readonly<Record<StepStatus, string>> = { done: 'urađeno', current: 'trenutni korak', upcoming: 'na redu', cancelled: 'otkazano' };
export const stepsSummary = (steps: readonly AgreementStep[]): string =>
  steps.every(step => step.status === 'cancelled') ? 'Dogovor je otkazan.' : steps.map(step => `${step.label}: ${SPOKEN[step.status]}`).join('. ') + '.';

/**
 * The one grey line under the second step: the REAL time the other side has to confirm (the server's `rokPotvrdeIso`, written in
 * Serbian time), or - when a problem is open - that the automatic completion is stopped. No deadline is spoken that the server did
 * not give (the "48h" that stood here was a number nobody had read). Only while the confirmation is awaited; null otherwise.
 */
export function deadlineNote({ state, deadlineIso, problemOpen }: {
  state: DogovorProjekcija['stanje']; deadlineIso: string | null | undefined; problemOpen: boolean;
}): string | null {
  if (state !== 'AWAITING_REQUESTER') return null;
  if (problemOpen) return 'Automatski završetak je zaustavljen zbog prijavljenog problema.';
  const when = dogovorenoVreme(deadlineIso ?? null, '');
  return when ? `Potvrda do ${when}` : null;
}
