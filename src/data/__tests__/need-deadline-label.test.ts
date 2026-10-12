import { needScheduleText } from '../needDetailPresentation';

const NOW = new Date('2026-10-11T12:00:00Z');
const TZ = 'Europe/Belgrade';

describe('owner temporal intent: completion deadline is not unbounded flexibility', () => {
  it('shows an end-only flexible task as a deadline without asserting free appointment time', () => {
    const value = needScheduleText({
      kind: 'FLEXIBLE', startsAt: null, endsAt: '2026-10-17T00:00:00+02:00',
    }, TZ, NOW);
    expect(value).toContain('Rok do 16.');
    expect(value).not.toContain('Fleksibilno');
  });

  it('keeps the same deadline meaning in a WEEK_FLEXIBLE legacy projection', () => {
    const value = needScheduleText({
      kind: 'WEEK_FLEXIBLE', startsAt: null, endsAt: '2026-10-17T00:00:00+02:00',
    }, TZ, NOW);
    expect(value).toContain('Rok do 16.');
    expect(value).not.toContain('Fleksibilno');
  });

  it('preserves explicitly unbounded flexibility when both bounds are absent', () => {
    const value = needScheduleText({
      kind: 'FLEXIBLE', startsAt: null, endsAt: null,
    }, TZ, NOW);
    expect(value).toBe('Fleksibilno');
  });

  it('keeps remote work visible on a deadline-only schedule', () => {
    const value = needScheduleText({
      kind: 'REMOTE_ANYTIME', startsAt: null, endsAt: '2026-10-17T00:00:00+02:00',
    }, TZ, NOW);
    expect(value).toContain('Na daljinu · Rok do 16.');
  });
});
