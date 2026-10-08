import type { MyWorkStats, PublicWorkTrust } from '../../../data/workTrustClientService';
import { memberSincePhrase, monthYear, publicTrustFacts, RELIABILITY_FEW, RELIABILITY_LABEL, RELIABILITY_MEANING, reliabilityNeeds, statsView } from '../workTrustModel';

/**
 * The words of the trust numbers (PROFILE-TRUST, R30). The model only turns what the server returned into rows and sentences:
 * it adds no figure of its own, leaves a part out when the server did not return it, and promises nothing (owner decision A10).
 */
const PROFILE = '30000000-0000-4000-8000-000000000001';
const trust = (patch: Partial<PublicWorkTrust> = {}): PublicWorkTrust => ({ profileId: PROFILE, self: false, visibility: 'PUBLIC', completedCount: 7, agreedCount: 9,
  reliabilityPercent: 88, reliabilityState: 'AVAILABLE', reliabilityMinimum: 5, memberSince: '2026-03-01', ...patch });
const stats = (patch: Partial<MyWorkStats> = {}): MyWorkStats => ({ hasWorkerProfile: true, profileId: PROFILE, profileStatus: 'ACTIVE', applicationsSent: 12, agreementsMade: 8,
  agreementsCompleted: 6, agreementsActive: 1, cancelledByMe: 1, cancelledByRequester: 0, cancelledSideUnknown: 0, reliabilityPercent: 85, reliabilityState: 'AVAILABLE',
  reliabilityMinimum: 5, memberSince: '2026-03-01', asOf: '2026-10-07T18:23:45.123456+00:00', ...patch });

describe('the month a person is here since', () => {
  it.each([['2026-10-01', 'oktobra 2026'], ['2026-01-01', 'januara 2026'], ['2025-12-01', 'decembra 2025'], ['2026-03-01T00:00:00Z', 'marta 2026']])
    ('says %s as "%s"', (raw, words) => {
      expect(monthYear(raw)).toBe(words);
      expect(memberSincePhrase(raw)).toBe(`Na USKOČI-ju od ${words}`);
    });

  it.each([[null], [undefined], [''], ['sutra'], ['2026-13-01'], ['2026-00-01'], ['26-10-01']])('says nothing for %p, rather than a date it made up', raw => {
    expect(monthYear(raw)).toBeNull();
    expect(memberSincePhrase(raw)).toBeNull();
  });
});

describe('"Moja statistika"', () => {
  it('lists the funnel in the order it happens, then how reliably the person comes as agreed', () => {
    const view = statsView(stats())!;
    expect(view.rows.map(row => [row.key, row.label, row.value])).toEqual([
      ['sent', 'Poslate prijave', '12'], ['agreed', 'Dogovoreno', '8'], ['completed', 'Završeno', '6'], ['reliability', RELIABILITY_LABEL, '85%'],
    ]);
    expect(view.note).toBe(RELIABILITY_MEANING);
  });

  it('says "Još nema procenta" while the server has no percentage, and tells what it needs, with the minimum the server named', () => {
    const view = statsView(stats({ reliabilityState: 'TOO_FEW', reliabilityPercent: null, reliabilityMinimum: 5 }))!;
    expect(view.rows.at(-1)).toEqual({ key: 'reliability', label: RELIABILITY_LABEL, value: 'Još nema procenta' });
    expect(view.note).toBe(reliabilityNeeds(5));
    expect(view.note).toContain('bar 5 Dogovora');
  });

  it('never computes a percentage of its own: AVAILABLE without a figure is "no percentage" too', () => {
    expect(statsView(stats({ reliabilityState: 'AVAILABLE', reliabilityPercent: null }))!.rows.at(-1)!.value).toBe('Još nema procenta');
  });

  it('says nothing about work for an account without a work profile, instead of a row of zeros', () => {
    expect(statsView(stats({ hasWorkerProfile: false, applicationsSent: 0 }))).toBeNull();
    expect(statsView(null)).toBeNull();
    expect(statsView(undefined)).toBeNull();
  });

  it('writes a big number the Serbian way', () => {
    const value = statsView(stats({ applicationsSent: 1234 }))!.rows[0].value;
    expect(value.replace(/\s/g, '')).toMatch(/^1[.,]?234$/);
  });
});

describe('what a public profile adds', () => {
  it('lists the agreed tasks, the percentage and the month for a viewer the server allows', () => {
    expect(publicTrustFacts(trust())).toEqual({ agreed: 'Dogovoreno 9 zadataka', reliability: { kind: 'percent', percent: 88 }, since: 'Na USKOČI-ju od marta 2026' });
  });

  it.each([[1, 'Dogovoreno 1 zadatak'], [2, 'Dogovoreno 2 zadatka'], [5, 'Dogovoreno 5 zadataka'], [21, 'Dogovoreno 21 zadatak']])('says %i agreed as "%s"', (count, words) => {
    expect(publicTrustFacts(trust({ agreedCount: count }))!.agreed).toBe(words);
  });

  it('says "few" while there is no percentage, as a sentence about the person', () => {
    expect(publicTrustFacts(trust({ reliabilityState: 'TOO_FEW', reliabilityPercent: null }))!.reliability).toEqual({ kind: 'few' });
    expect(RELIABILITY_FEW).toBe('Još nema dovoljno Dogovora za procenat');
  });

  it('draws NOTHING for a hidden block, a missing one or a "nothing here": no row, no placeholder, no word about what is hidden', () => {
    expect(publicTrustFacts(trust({ reliabilityState: 'HIDDEN', agreedCount: null, reliabilityPercent: null, memberSince: null, visibility: 'OWN_ONLY' }))).toBeNull();
    expect(publicTrustFacts(null)).toBeNull();
    expect(publicTrustFacts(undefined)).toBeNull();
  });

  it('leaves out a part the server did not return', () => {
    expect(publicTrustFacts(trust({ agreedCount: null }))!.agreed).toBeNull();
    expect(publicTrustFacts(trust({ memberSince: null }))!.since).toBeNull();
  });
});

describe('the sentences promise nothing they cannot keep', () => {
  it('never says anonymous, never names a response time, and speaks as "ti" without a grammatical gender', () => {
    const all = [RELIABILITY_LABEL, RELIABILITY_MEANING, RELIABILITY_FEW, reliabilityNeeds(5)].join(' ');
    expect(all).not.toMatch(/anonim|sigurno|garant|uvek|nikad|odgovor.* sati/i);
    expect(all).not.toMatch(/(?:si|je) (?:otkazao|otkazala|završio|završila)/);
  });
});
