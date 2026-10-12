import { completeDraftProposal, fixedRange, publicSummary } from '../draftSummary';

describe('draftSummary start-only and range formatting', () => {
  const futureStart = '2099-10-15T10:00:00.000000+02:00';
  const futureEnd = '2099-10-15T12:00:00.000000+02:00';

  it('formats start-only FIXED_WINDOW with a single moment', () => {
    const formatted = fixedRange(futureStart, null);
    expect(formatted).toBeDefined();
    expect(formatted).toContain('15. okt');
    expect(formatted).toContain('10:00');
  });

  it('formats full range FIXED_WINDOW when both start and end exist', () => {
    const formatted = fixedRange(futureStart, futureEnd);
    expect(formatted).toBeDefined();
    expect(formatted).toContain('15. okt');
    expect(formatted).toContain('10:00–12:00');
  });

  it('returns undefined if start is null or invalid', () => {
    expect(fixedRange(null, null)).toBeUndefined();
    expect(fixedRange('invalid', null)).toBeUndefined();
  });

  it('publicSummary provides truthy schedule for start-only FIXED_WINDOW', () => {
    const facts = [
      { key: 'need.title', value: 'Montaža police', privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.schedule_kind', value: 'FIXED_WINDOW', privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.starts_at', value: futureStart, privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.price_mode', value: 'OFFERS', privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.people_needed', value: 1, privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.task_country_code', value: 'RS', privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.description', value: 'Opis', privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.category', value: 'MONTIRANJE_NAMESTAJA', privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.task_geography', value: { mode: 'STATIONARY', start: { city: 'Novi Sad', area: 'Centar' } }, privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
    ];
    const summary = publicSummary(facts);
    expect(summary.schedule).toBeDefined();
    expect(summary.schedule).toContain('15. okt');
    expect(summary.schedule).toContain('10:00');
    expect(completeDraftProposal(facts)).toBe(true);
  });
});
