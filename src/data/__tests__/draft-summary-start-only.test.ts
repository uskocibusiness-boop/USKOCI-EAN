import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import { fixedRange, publicSummary } from '../../ui/v2/draftSummary';

const begin = '2026-10-13T05:00:00.000Z';
const finish = '2026-10-13T07:00:00.000Z';
const fact = (key: AiNeedV2Fact['key'], value: unknown) =>
  ({ key, value, privacyClass: 'PUBLIC' as const, status: 'CONFIRMED' as const });

describe('AI draft start-only time presentation', () => {
  it('shows the known start in Belgrade time without claiming an end', () => {
    expect(fixedRange(begin, null)).toMatch(/^Od .*07:00/);
    expect(fixedRange(begin, undefined)).toMatch(/^Od .*07:00/);
    expect(fixedRange(begin, null)).not.toContain('–');
  });
  it('still shows a supplied valid interval', () => {
    expect(fixedRange(begin, finish)).toContain('07:00–09:00');
  });
  it.each([begin, '2026-10-13T04:59:00.000Z', 'invalid', ''])(
    'does not accept an invalid or earlier explicitly supplied end %s',
    ending => expect(fixedRange(begin, ending)).toBeUndefined(),
  );
  it('does not consider an absent or invalid start to be a usable term', () => {
    expect(fixedRange(null, null)).toBeUndefined();
    expect(fixedRange('invalid', null)).toBeUndefined();
  });
  it('uses the same start-only rule in the live public draft card', () => {
    const summary = publicSummary([
      fact('need.title', 'Pomoć pri selidbi'),
      fact('need.schedule_kind', 'FIXED_WINDOW'),
      fact('need.starts_at', begin),
      fact('need.people_needed', 2),
      fact('need.price_mode', 'OFFERS'),
    ]);
    expect(summary.schedule).toMatch(/^Od .*07:00/);
    expect(summary.peopleCount).toBe(2);
  });
});
