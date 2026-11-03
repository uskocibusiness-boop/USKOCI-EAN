import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import { factReviewValue } from '../aiNeedV2Ui';
import { calendarInstant } from '../../lib/calendarTime';
import { civilInstant } from '../../ui/calendar/calendarPresentation';

const startFact: AiNeedV2Fact = {
  id: 'pkg003-timezone-proof',
  key: 'need.starts_at',
  value: '2026-09-15T10:00:00Z',
  displayValue: 'model display must not control time parsing',
  valueType: 'TIMESTAMPTZ',
  privacyClass: 'PUBLIC',
  requiredForDraft: false,
  status: 'CONFIRMED',
  source: 'EXPLICIT_USER_ANSWER',
  evidence: null,
};

describe('PKG-003 deterministic named-zone task time', () => {
  it('resolves civil input in Europe/Belgrade instead of the runner/device timezone', () => {
    expect(civilInstant('2026-09-15', '12:00', 'Europe/Belgrade')).toEqual({
      value: '2026-09-15T10:00:00.000Z',
      error: null,
    });
  });

  it.each([
    ['2026-02-30 12:00', 'impossible February date'],
    ['2026-13-01 12:00', 'impossible month'],
    ['2026-09-15 24:00', 'impossible hour'],
  ])('rejects %s (%s) without Date normalization', input => {
    const [date, time] = input.split(' ');
    expect(civilInstant(date, time, 'Europe/Belgrade').value).toBeNull();
  });

  it('rejects the Europe/Belgrade spring DST gap', () => {
    const result = civilInstant('2026-03-29', '02:30', 'Europe/Belgrade');
    expect(result.value).toBeNull();
    expect(result.error).toContain('ne postoji');
  });

  it('rejects the Europe/Belgrade repeated autumn wall clock as ambiguous', () => {
    const result = civilInstant('2026-10-25', '02:30', 'Europe/Belgrade');
    expect(result.value).toBeNull();
    expect(result.error).toContain('ponavlja');
  });

  it('preserves explicit ISO instant identity and displays microseconds', () => {
    const exact = '2026-09-15T12:00:45.123456+02:00';
    const fact = { ...startFact, value: exact };
    expect(calendarInstant(exact)).toBe(calendarInstant('2026-09-15T10:00:45.123456Z'));
    expect(fact.value).toBe(exact);
    expect(factReviewValue(fact)).toContain('12:00:45.123456');
    expect(factReviewValue(fact)).toContain('vreme u Beogradu');
  });

  it.each([
    '2026-09-15T12:00',
    '09/15/2026 12:00',
    'September 15 2026 12:00',
  ])('rejects zone-less/free-form input %s', input => {
    expect(calendarInstant(input)).toBeNull();
  });

  it('fails closed for an invalid named timezone', () => {
    const result = civilInstant('2026-09-15', '12:00', 'Not/A_Real_Zone');
    expect(result.value).toBeNull();
    expect(result.error).toContain('vremensku zonu');
  });
});
