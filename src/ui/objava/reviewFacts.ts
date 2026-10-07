import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import type { NeedLocationInput } from '../../contracts/location';
import type { NeedFactV2Key } from '../../contracts/needFactsV2';
import { factLabel, factReviewValue, slotLabel } from '../../data/aiNeedV2Ui';
import { REVIEW_FACT_COPY } from '../../data/reviewFactProblem';
import { dogovorenoVreme } from '../../lib/dogovorenoVreme';
import { locationSlots, normalizeNeedLocation } from '../../lib/location';
import { novac } from '../../lib/novac';
import type { LocationOverviewPoint } from '../location/LocationOverviewMap.types';

/** Owner-only review points in task order. Never use this for a public projection. */
export function privateReviewMap(location: NeedLocationInput | null | undefined): {
  points: readonly LocationOverviewPoint[]; route: boolean;
} {
  const value = normalizeNeedLocation(location);
  if (!value?.resolvedLocation || value.geography.mode === 'REMOTE') return { points: [], route: false };
  const slots = locationSlots(value.geography);
  const stationary = value.geography.mode === 'STATIONARY';
  const points = slots.flatMap(slot => {
    const point = value.resolvedLocation!.points.find(item => item.slot === slot);
    return point ? [{ id: slot, label: slotLabel(slot, stationary),
      latitude: point.latitudeE6 / 1e6, longitude: point.longitudeE6 / 1e6 }] : [];
  });
  return { points, route: (value.geography.mode === 'POINT_TO_POINT' || value.geography.mode === 'MULTI_STOP')
    && slots.length === points.length };
}

/**
 * What the publish review shows in a fact's row. Pure (no service, no Supabase), so a screen suite can import it.
 *
 * `factReviewValue` stays the exact reading a correction is seeded from; this is only what a person reads: a moment in
 * the app's one time format (no seconds, "po vremenu u Srbiji" only on a phone in another zone), money with its grouping
 * and currency, and the confirmed points as a count and their private details, never coordinates or a country code.
 */
export function reviewRowValue(fact: AiNeedV2Fact): string {
  if (fact.valueType === 'TIMESTAMPTZ') return dogovorenoVreme(fact.value, 'Termin nije dostupan');
  if (fact.key === 'need.price_rsd') return typeof fact.value === 'number' && Number.isSafeInteger(fact.value)
    ? novac(fact.value) : 'Podatak nije dostupan';
  if (fact.key === 'need.resolved_location') {
    const raw = fact.value as { binding?: { taskCountryCode?: unknown; geography?: unknown; exactAddress?: unknown } } | null;
    const location = normalizeNeedLocation({ ...raw?.binding, accessNotes: null, resolvedLocation: fact.value });
    if (!location?.resolvedLocation) return 'Potvrđene tačke nisu dostupne';
    const points = location.resolvedLocation.points, total = locationSlots(location.geography).length;
    const stationary = location.geography.mode === 'STATIONARY';
    // One point needs no name; several say which one each detail belongs to.
    const named = (slot: typeof points[number]['slot'], text: string) => total > 1 ? `${slotLabel(slot, stationary)} · ${text}` : text;
    return [`Potvrđeno tačaka: ${points.length} od ${total}`, ...points.flatMap(point => [
      ...(point.address ? [named(point.slot, `Adresa tačke: ${point.address}`)] : []),
      ...(point.accessNotes ? [named(point.slot, `Pristup: ${point.accessNotes}`)] : []),
    ])].join('\n');
  }
  return factReviewValue(fact);
}

export type PublicAnchor = { latitude: number; longitude: number };

/**
 * The approximate point the public map will show once the task is published, computed the way the server does it
 * (`private.materialize_resolved_location`, migration 20260910130851): the service area's point for work on an area
 * that has one, otherwise the start point, rounded to two decimals half away from zero (Postgres `round`). No confirmed
 * anchor point, or remote work, means no point: nothing is invented.
 */
export function publicAnchorPoint(location: NeedLocationInput | null | undefined): PublicAnchor | null {
  if (!location || location.geography.mode === 'REMOTE' || !location.resolvedLocation) return null;
  const slot = location.geography.mode === 'AREA_BASED' && location.geography.serviceArea ? 'serviceArea' : 'start';
  const point = location.resolvedLocation.points.find(item => item.slot === slot);
  if (!point) return null;
  const round = (e6: number) => Math.sign(e6) * Math.round(Math.abs(e6) / 1e4) / 100;
  return { latitude: round(point.latitudeE6), longitude: round(point.longitudeE6) };
}

/** One thing that still stands between the review and publication, and where it is fixed. */
export type ReviewTodo = { key: string; text: string;
  /** `conversation` goes back to the conversation, `location` opens the place, a fact key opens that row's editor. */
  target: 'conversation' | 'location' | NeedFactV2Key | null };

/**
 * "Još treba", in order: a safety block, what is missing (never naming the category, owner decision 2026-09-21), the
 * place on the map, then what the server would refuse about the facts themselves. The unavailable identity condition is
 * its own block with its own action, not a row here.
 */
export function reviewTodos(review: { safety: string; missingRequired: readonly NeedFactV2Key[]; location: unknown; canAccept?: boolean },
  factProblem: string | null, identityBlock = false): ReviewTodo[] {
  const todos: ReviewTodo[] = [];
  if (review.safety === 'BLOCK') todos.push({ key: 'safety', text: 'Sadržaj ne može da se objavi u ovom obliku.', target: 'conversation' });
  const missing = review.missingRequired.filter(key => key !== 'need.category');
  if (missing.length) todos.push({ key: 'missing', text: `Nedostaje: ${missing.map(factLabel).join(', ')}.`, target: 'conversation' });
  else if (review.missingRequired.length) todos.push({ key: 'missing', text: 'Treba još malo o samom zadatku.', target: 'conversation' });
  if (!review.location) todos.push({ key: 'location', text: 'Mesto na mapi nije potvrđeno.', target: 'location' });
  if (factProblem) todos.push({ key: 'fact', text: factProblem, target: factProblem === REVIEW_FACT_COPY.MY_PRICE_AMOUNT_REQUIRED
    ? 'need.price_rsd' : factProblem === REVIEW_FACT_COPY.FIXED_WINDOW_BOUNDS_REQUIRED || factProblem === REVIEW_FACT_COPY.FIXED_WINDOW_START_PASSED
      ? 'need.starts_at' : null });
  // A refusal the rows above do not name still says where it is fixed, so a grey publish never stands without a reason.
  if (review.canAccept === false && !todos.length && !identityBlock)
    todos.push({ key: 'other', text: 'Zadatku je potrebna dopuna u razgovoru.', target: 'conversation' });
  return todos;
}

/**
 * Whether support has an operator on duty to take a task held for a manual check (deep read 8.7: it has none yet). Owner decision
 * d07, 2026-10-07: while it has none, the review offers ONLY "Izmeni zadatak" for that situation. "Zatraži pregled podrške" stood
 * right under the sentence that says nobody is on duty, and a request nobody reads is a promise the app cannot keep. The day an
 * operator exists this is the one line to change; the entry and the sentence below follow it.
 */
export const SUPPORT_HAS_DUTY_OPERATOR = false;

/** What the review says when the check ended in "REVIEW": the fact, and, while nobody is on duty, the way that works. */
export function manualCheckCopy(operatorOnDuty: boolean = SUPPORT_HAS_DUTY_OPERATOR): string {
  const held = 'Zadatak zahteva ručnu proveru i još nije objavljen.';
  return operatorOnDuty ? held : `${held} Podrška još nema dežurnog operatera, pa je najbrže da ga izmeniš i ponovo pošalješ.`;
}
