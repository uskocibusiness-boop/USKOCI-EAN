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
      { key: 'need.title' as const, value: 'Montaža police', privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.schedule_kind' as const, value: 'FIXED_WINDOW', privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.starts_at' as const, value: futureStart, privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.price_mode' as const, value: 'OFFERS', privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.people_needed' as const, value: 1, privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.task_country_code' as const, value: 'RS', privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.description' as const, value: 'Opis', privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.category' as const, value: 'MONTIRANJE_NAMESTAJA', privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
      { key: 'need.task_geography' as const, value: { mode: 'STATIONARY', start: { city: 'Novi Sad', area: 'Centar' } }, privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const },
    ];
    const summary = publicSummary(facts);
    expect(summary.schedule).toBeDefined();
    expect(summary.schedule).toContain('15. okt');
    expect(summary.schedule).toContain('10:00');
    expect(completeDraftProposal(facts)).toBe(true);
  });
});

describe('flexible draft bounds',()=>{
  const summarize=(start:unknown,end:unknown)=>publicSummary([
    {key:'need.schedule_kind',value:'FLEXIBLE',privacyClass:'PUBLIC',status:'CONFIRMED'},
    {key:'need.starts_at',value:start,privacyClass:'PUBLIC',status:'CONFIRMED'},
    {key:'need.ends_at',value:end,privacyClass:'PUBLIC',status:'CONFIRMED'},
  ]).schedule;
  it('shows the whole flexible period with its exclusive midnight end and DST change',()=>{
    const value=summarize('2026-10-19T00:00:00+02:00','2026-10-26T00:00:00+01:00');
    expect(value).toContain('Fleksibilno');expect(value).toContain('19. okt');expect(value).toContain('25. okt');
    expect(value).not.toContain('26. okt');expect(value).toContain('UTC+02:00');expect(value).toContain('UTC+01:00');
    expect(value).not.toContain('Bilo kada');
  });
  it('preserves start-only and deadline-only without inventing the missing boundary',()=>{
    expect(summarize('2099-10-15T10:00:00+02:00',null)).toMatch(/Fleksibilno · od .*10:00/);
    expect(summarize(null,'2099-10-15T12:00:00+02:00')).toMatch(/Rok do .*12:00/);
    expect(summarize(null,null)).toBe('Fleksibilno');
  });
  it('does not replace malformed or reversed bounds with an unrestricted schedule',()=>{
    expect(summarize('invalid',null)).toBeUndefined();expect(summarize(null,'invalid')).toBeUndefined();
    expect(summarize('2099-10-15T12:00:00+02:00','2099-10-15T10:00:00+02:00')).toBeUndefined();
  });
});

it('shows the recognized service and the full public route without exposing a private address', () => {
  const fact = (key: any, value: any, privacyClass: 'PUBLIC' | 'PRIVATE' = 'PUBLIC') =>
    ({ key, value, privacyClass, status: 'CONFIRMED' as const });
  const summary = publicSummary([
    fact('need.title', 'Prevezi kutiju'), fact('need.category', 'Prevoz paketa'),
    fact('need.task_geography', { mode: 'MULTI_STOP', start: { city: 'Novi Sad', area: 'Liman' },
      waypoints: [{ city: 'Novi Sad', area: 'Centar' }], end: { city: 'Novi Sad', area: 'Petrovaradin' } }),
    fact('need.exact_address', 'Liman 3, stan 12', 'PRIVATE'),
  ]);
  expect(summary.service).toBe('Prevoz paketa');
  expect(summary.zone).toBe('Liman, Novi Sad → Centar, Novi Sad → Petrovaradin, Novi Sad');
  expect(JSON.stringify(summary)).not.toContain('stan 12');
});
it('does not display a taxonomy UUID or legacy machine category as a service name',()=>{
  for(const category of ['12345678-abcd-4123-8123-123456789abc','MONTIRANJE_NAMESTAJA']) {
    expect(publicSummary([{key:'need.category',value:category,privacyClass:'PUBLIC',status:'CONFIRMED'}]).service).toBeNull();
  }
});
