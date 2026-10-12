import type { NeedFactV2Key } from '../../contracts/needFactsV2';
import { reviewFactProblem, reviewStartPassed, REVIEW_FACT_COPY } from '../reviewFactProblem';

const now = Date.parse('2026-10-12T12:00:00.000Z');
const start = '2026-10-13T05:00:00.000Z';
const end = '2026-10-13T08:00:00.000Z';
const facts = (values: readonly (readonly [NeedFactV2Key, unknown])[]) => ({
  publicProjection: values.map(([key, value]) => ({ key, value })),
});
const fixed = (extras: readonly (readonly [NeedFactV2Key, unknown])[] = []) =>
  facts([['need.schedule_kind', 'FIXED_WINDOW'], ['need.starts_at', start], ...extras]);

describe('fixed-window start-only review, without invented duration', () => {
  it('accepts a confirmed future start without any end', () => {
    expect(reviewFactProblem(fixed(), now)).toBeNull();
    expect(reviewStartPassed(fixed(), now)).toBe(false);
  });
  it('accepts explicit null end as unspecified', () => {
    expect(reviewFactProblem(fixed([['need.ends_at', null]]), now)).toBeNull();
  });
  it('still accepts a valid start and end', () => {
    expect(reviewFactProblem(fixed([['need.ends_at', end]]), now)).toBeNull();
  });
  it.each([start, '2026-10-13T04:59:00.000Z', 'not-an-instant', ''])(
    'rejects invalid, equal or earlier explicitly supplied end %s',
    suppliedEnd => {
      expect(reviewFactProblem(fixed([['need.ends_at', suppliedEnd]]), now))
        .toBe(REVIEW_FACT_COPY.FIXED_WINDOW_BOUNDS_REQUIRED);
    },
  );
  it('still rejects a missing or malformed start', () => {
    for (const suppliedStart of [null, 'not-an-instant']) {
      expect(reviewFactProblem(facts([['need.schedule_kind', 'FIXED_WINDOW'], ['need.starts_at', suppliedStart]]), now))
        .toBe(REVIEW_FACT_COPY.FIXED_WINDOW_BOUNDS_REQUIRED);
    }
  });
  it('still rejects a start in the past and does not synthesize a finish', () => {
    const past = fixed([['need.ends_at', null], ['need.starts_at', '2026-10-11T05:00:00.000Z']]);
    expect(reviewStartPassed(past, now)).toBe(true);
    expect(reviewFactProblem(past, now)).toBe(REVIEW_FACT_COPY.FIXED_WINDOW_START_PASSED);
    expect(past.publicProjection.find(f => f.key === 'need.ends_at')?.value).toBeNull();
  });
});
