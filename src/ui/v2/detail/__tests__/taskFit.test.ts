import type { DogovorProjekcija, NeedScheduleProjection } from '../../../../contracts/projections';
import { distanceBetweenKm, overlappingAgreementTitle, taskFit } from '../taskFit';

/**
 * R25 (UX plan): before an application is written, the page may say that the task would overlap an agreement of the worker's, and about how far it is from the area
 * they work in. These cases hold what may be said and, as much, what must not be: nothing that cannot be known is drawn.
 */
const window = (startsAt: string | null, endsAt: string | null, kind: NeedScheduleProjection['kind'] = 'FIXED_WINDOW'): NeedScheduleProjection => ({ kind, startsAt, endsAt });
const SAT_MORNING = window('2026-10-10T08:00:00+02:00', '2026-10-10T12:00:00+02:00');
const agreement = (naslov: string, pocetak: string | null, kraj: string | null, stanje: DogovorProjekcija['stanje'] = 'CONFIRMED'):
  Pick<DogovorProjekcija, 'naslov' | 'stanje' | 'tacanTermin'> => ({ naslov, stanje, tacanTermin: pocetak && kraj ? { pocetak, kraj } : null });

describe('the distance between two coarse points', () => {
  it('is the great-circle distance in kilometres: Novi Sad to Beograd is about 68 as the crow flies', () => {
    const km = distanceBetweenKm({ lat: 45.25, lng: 19.84 }, { lat: 44.82, lng: 20.46 })!;
    expect(km).toBeGreaterThan(65); expect(km).toBeLessThan(72);
    expect(distanceBetweenKm({ lat: 45.25, lng: 19.84 }, { lat: 45.25, lng: 19.84 })).toBe(0);
  });
  it('is the same from either end, and is nothing at all for a point that is not one', () => {
    const a = { lat: 43.32, lng: 21.9 }, b = { lat: 44.0, lng: 20.9 };
    expect(distanceBetweenKm(a, b)).toBeCloseTo(distanceBetweenKm(b, a)!, 9);
    expect(distanceBetweenKm({ lat: Number.NaN, lng: 1 }, b)).toBeNull();
    expect(distanceBetweenKm({ lat: 91, lng: 1 }, b)).toBeNull();
    expect(distanceBetweenKm(a, { lat: 10, lng: 181 })).toBeNull();
  });
});

describe('the agreement a task would overlap', () => {
  it('names the agreement whose accepted term crosses the task\'s window', () => {
    const held = [agreement('Montaža police', '2026-10-10T10:00:00+02:00', '2026-10-10T14:00:00+02:00')];
    expect(overlappingAgreementTitle(SAT_MORNING, held)).toBe('Montaža police');
  });

  it('is nothing when the windows only touch, when the day is another, or when the term is not exact', () => {
    expect(overlappingAgreementTitle(SAT_MORNING, [agreement('Odmah posle', '2026-10-10T12:00:00+02:00', '2026-10-10T14:00:00+02:00')])).toBeNull();
    expect(overlappingAgreementTitle(SAT_MORNING, [agreement('Odmah pre', '2026-10-10T06:00:00+02:00', '2026-10-10T08:00:00+02:00')])).toBeNull();
    expect(overlappingAgreementTitle(SAT_MORNING, [agreement('Drugi dan', '2026-10-11T08:00:00+02:00', '2026-10-11T12:00:00+02:00')])).toBeNull();
    expect(overlappingAgreementTitle(SAT_MORNING, [agreement('Bez termina', null, null)])).toBeNull();
    expect(overlappingAgreementTitle(SAT_MORNING, [agreement('Obrnuto', '2026-10-10T12:00:00+02:00', '2026-10-10T10:00:00+02:00')])).toBeNull();
  });

  it('counts the same instant written in another zone, and an agreement that holds the day only while it is not over', () => {
    expect(overlappingAgreementTitle(SAT_MORNING, [agreement('U drugoj zoni', '2026-10-10T08:30:00Z', '2026-10-10T09:30:00Z')])).toBe('U drugoj zoni');
    for (const stanje of ['COMPLETED', 'CANCELLED'] as const) {
      expect(overlappingAgreementTitle(SAT_MORNING, [agreement('Gotov', '2026-10-10T10:00:00+02:00', '2026-10-10T14:00:00+02:00', stanje)])).toBeNull();
    }
    expect(overlappingAgreementTitle(SAT_MORNING, [agreement('Čeka drugu stranu', '2026-10-10T10:00:00+02:00', '2026-10-10T14:00:00+02:00', 'AWAITING_REQUESTER')])).toBe('Čeka drugu stranu');
  });

  it('says only what the task names: a flexible task, or a window missing an end, has nothing to overlap', () => {
    const held = [agreement('Ceo dan', '2026-10-10T00:00:00+02:00', '2026-10-10T23:00:00+02:00')];
    expect(overlappingAgreementTitle(window(null, null, 'FLEXIBLE'), held)).toBeNull();
    expect(overlappingAgreementTitle(window('2026-10-10T08:00:00+02:00', null), held)).toBeNull();
    expect(overlappingAgreementTitle(window('2026-10-10T12:00:00+02:00', '2026-10-10T08:00:00+02:00'), held)).toBeNull();
    expect(overlappingAgreementTitle(window('not a date', 'nor this'), held)).toBeNull();
    expect(overlappingAgreementTitle(undefined, held)).toBeNull();
  });

  it('picks the earliest of several, and never a blank title', () => {
    const held = [agreement('Kasnije', '2026-10-10T11:00:00+02:00', '2026-10-10T13:00:00+02:00'), agreement('   ', '2026-10-10T07:00:00+02:00', '2026-10-10T09:00:00+02:00'),
      agreement('Ranije', '2026-10-10T09:00:00+02:00', '2026-10-10T11:30:00+02:00')];
    expect(overlappingAgreementTitle(SAT_MORNING, held)).toBe('Ranije');
  });
});

describe('what the page may say', () => {
  const area = { lat: 45.25, lng: 19.84 }, pin = { lat: 44.82, lng: 20.46 };

  it('says both facts when both are known', () => {
    const fit = taskFit({ schedule: SAT_MORNING, pin, remote: false, workArea: area, agreements: [agreement('Montaža', '2026-10-10T09:00:00+02:00', '2026-10-10T11:00:00+02:00')] });
    expect(fit.overlapTitle).toBe('Montaža'); expect(fit.distanceKm).toBeGreaterThan(65);
  });

  it('draws no distance for remote work, for a task without a public point, or without a saved work area; a failed read of the agreements says no overlap', () => {
    expect(taskFit({ schedule: SAT_MORNING, pin, remote: true, workArea: area, agreements: [] }).distanceKm).toBeNull();
    expect(taskFit({ schedule: SAT_MORNING, pin: null, remote: false, workArea: area, agreements: [] }).distanceKm).toBeNull();
    expect(taskFit({ schedule: SAT_MORNING, pin, remote: false, workArea: null, agreements: [] }).distanceKm).toBeNull();
    expect(taskFit({ schedule: SAT_MORNING, pin, remote: false, workArea: area, agreements: null }).overlapTitle).toBeNull();
  });
});
