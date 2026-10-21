import { REVIEW_FACT_COPY, reviewDraftWriteProblem, reviewFactProblem, reviewMissingRemoteHandoff, reviewStartPassed } from '../reviewFactProblem';

describe('reviewFactProblem start-only and validation rules', () => {
  const futureStart = '2099-10-15T10:00:00.000000+02:00';
  const futureEnd = '2099-10-15T12:00:00.000000+02:00';
  const pastStart = '2020-01-01T10:00:00.000000+02:00';

  it('allows FIXED_WINDOW with start time only (end time is optional)', () => {
    const review = {
      publicProjection: [
        { key: 'need.schedule_kind' as const, value: 'FIXED_WINDOW' },
        { key: 'need.starts_at' as const, value: futureStart },
        { key: 'need.ends_at' as const, value: null },
      ],
    };
    expect(reviewFactProblem(review)).toBeNull();
  });

  it('allows FIXED_WINDOW with both start and end when end is after start', () => {
    const review = {
      publicProjection: [
        { key: 'need.schedule_kind' as const, value: 'FIXED_WINDOW' },
        { key: 'need.starts_at' as const, value: futureStart },
        { key: 'need.ends_at' as const, value: futureEnd },
      ],
    };
    expect(reviewFactProblem(review)).toBeNull();
  });

  it('refuses FIXED_WINDOW without start time', () => {
    const review = {
      publicProjection: [
        { key: 'need.schedule_kind' as const, value: 'FIXED_WINDOW' },
        { key: 'need.starts_at' as const, value: null },
        { key: 'need.ends_at' as const, value: null },
      ],
    };
    expect(reviewFactProblem(review)).toBe(REVIEW_FACT_COPY.FIXED_WINDOW_BOUNDS_REQUIRED);
  });

  it('refuses FIXED_WINDOW when end is before or equal to start', () => {
    const review = {
      publicProjection: [
        { key: 'need.schedule_kind' as const, value: 'FIXED_WINDOW' },
        { key: 'need.starts_at' as const, value: futureEnd },
        { key: 'need.ends_at' as const, value: futureStart },
      ],
    };
    expect(reviewFactProblem(review)).toBe(REVIEW_FACT_COPY.FIXED_WINDOW_BOUNDS_REQUIRED);
  });

  it('refuses FIXED_WINDOW when start has already passed', () => {
    const review = {
      publicProjection: [
        { key: 'need.schedule_kind' as const, value: 'FIXED_WINDOW' },
        { key: 'need.starts_at' as const, value: pastStart },
        { key: 'need.ends_at' as const, value: null },
      ],
    };
    expect(reviewFactProblem(review)).toBe(REVIEW_FACT_COPY.FIXED_WINDOW_START_PASSED);
  });

  it('refuses MY_PRICE without valid positive amount', () => {
    const review = {
      publicProjection: [
        { key: 'need.price_mode' as const, value: 'MY_PRICE' },
        { key: 'need.price_rsd' as const, value: 0 },
      ],
    };
    expect(reviewFactProblem(review)).toBe(REVIEW_FACT_COPY.MY_PRICE_AMOUNT_REQUIRED);
  });

  it('allows OFFERS price mode without amount', () => {
    const review = {
      publicProjection: [
        { key: 'need.price_mode' as const, value: 'OFFERS' },
        { key: 'need.price_rsd' as const, value: null },
      ],
    };
    expect(reviewFactProblem(review)).toBeNull();
  });

  it('blocks an older REMOTE review before Save when the signed draft writer would require handoff', () => {
    const remote = {
      location: { geography: { mode: 'REMOTE' } },
      publicProjection: [{ key: 'need.handoff' as const, value: { required: false }, status: 'UNKNOWN' }],
    };
    expect(reviewMissingRemoteHandoff(remote)).toBe(true);
    expect(reviewFactProblem(remote)).toBe(REVIEW_FACT_COPY.HANDOFF_REQUIRED);
    expect(reviewFactProblem({ ...remote, publicProjection: [{ key: 'need.handoff' as const, value: { required: false }, status: 'CONFIRMED' }] })).toBeNull();
    expect(reviewFactProblem({ location: { geography: { mode: 'STATIONARY' } }, publicProjection: [] })).toBeNull();
  });

  it('keeps server-invalid amount and bounds out of Save while allowing a valid past term as a draft', () => {
    expect(reviewDraftWriteProblem({ publicProjection: [{ key: 'need.price_mode', value: 'MY_PRICE' }] }))
      .toBe(REVIEW_FACT_COPY.MY_PRICE_AMOUNT_REQUIRED);
    expect(reviewDraftWriteProblem({ publicProjection: [
      { key: 'need.schedule_kind', value: 'FIXED_WINDOW' }, { key: 'need.starts_at', value: '2026-10-21T12:00:00Z' },
      { key: 'need.ends_at', value: '2026-10-21T11:00:00Z' },
    ] })).toBe(REVIEW_FACT_COPY.FIXED_WINDOW_BOUNDS_REQUIRED);
    expect(reviewDraftWriteProblem({ publicProjection: [
      { key: 'need.schedule_kind', value: 'FIXED_WINDOW' }, { key: 'need.starts_at', value: '2020-10-21T12:00:00Z' },
    ] })).toBeNull();
  });
});
