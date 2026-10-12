import type { NeedFactV2Key } from '../contracts/needFactsV2';
import { calendarInstant } from '../lib/calendarTime';

/** The server's own refusals for these facts, in the words the review shows before the tap. */
export const REVIEW_FACT_COPY = {
  MY_PRICE_AMOUNT_REQUIRED: 'Unesi iznos ili izaberi prikupljanje ponuda.',
  FIXED_WINDOW_BOUNDS_REQUIRED: 'Tačan termin mora imati početak; ako je kraj naveden, mora biti posle početka.',
  FIXED_WINDOW_START_PASSED: 'Početak termina je već prošao. Izmeni termin u pregledu, pa objavi.',
} as const;

type ReviewFacts = Readonly<{ publicProjection: readonly Readonly<{ key: NeedFactV2Key; value: unknown }>[] }>;

/** A fixed time that has already begun cannot be offered to anyone (deep read 5.1). */
export function reviewStartPassed(review: ReviewFacts, now = Date.now()): boolean {
  const fact = (key: NeedFactV2Key) => review.publicProjection.find(f => f.key === key)?.value;
  if (fact('need.schedule_kind') !== 'FIXED_WINDOW') return false;
  const start = calendarInstant(fact('need.starts_at'));
  return start !== null && start <= BigInt(now) * 1000n;
}

/**
 * What the server would refuse about the reviewed facts themselves, said before the tap (deep read 8.5): the
 * publish button stayed live, the refusal came back unmapped, and the screen offered only a reload that led
 * back to the same button. Pure, so a screen can read it without the service that talks to the server.
 */
export function reviewFactProblem(review: ReviewFacts, now = Date.now()): string | null {
  const fact = (key: NeedFactV2Key) => review.publicProjection.find(f => f.key === key)?.value;
  if (fact('need.price_mode') === 'MY_PRICE') {
    const amount = fact('need.price_rsd');
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1) return REVIEW_FACT_COPY.MY_PRICE_AMOUNT_REQUIRED;
  }
  if (fact('need.schedule_kind') === 'FIXED_WINDOW') {
    const start = calendarInstant(fact('need.starts_at'));
    const endValue = fact('need.ends_at');
    // Optional end is different from an explicitly supplied but invalid end.
    const hasEnd = endValue !== null && endValue !== undefined;
    const end = hasEnd ? calendarInstant(endValue) : null;
    if (start === null || (hasEnd && (end === null || end <= start))) return REVIEW_FACT_COPY.FIXED_WINDOW_BOUNDS_REQUIRED;
  }
  return reviewStartPassed(review, now) ? REVIEW_FACT_COPY.FIXED_WINDOW_START_PASSED : null;
}
