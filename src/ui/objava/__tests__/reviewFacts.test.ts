import type { AiNeedV2Fact } from '../../../contracts/aiNeedV2';
import type { NeedLocationInput } from '../../../contracts/location';
import { NEED_FACT_V2_DEFINITIONS, type NeedFactV2Key } from '../../../contracts/needFactsV2';
import { factReviewValue } from '../../../data/aiNeedV2Ui';
import { REVIEW_FACT_COPY } from '../../../data/reviewFactProblem';
import { privateReviewMap, publicAnchorPoint, reviewRowValue, reviewTodos } from '../reviewFacts';

const fact = (key: NeedFactV2Key, value: unknown): AiNeedV2Fact => ({ id: key, key, value, displayValue: String(value),
  valueType: NEED_FACT_V2_DEFINITIONS[key].valueType, privacyClass: NEED_FACT_V2_DEFINITIONS[key].privacyClass,
  requiredForDraft: NEED_FACT_V2_DEFINITIONS[key].requiredForDraft, status: 'CONFIRMED', source: 'EXPLICIT_USER_ANSWER', evidence: null });

describe('reviewRowValue', () => {
  it('writes a moment in the one time format: minutes, no seconds, Serbian time named only off-zone (jest runs in UTC)', () => {
    const value = reviewRowValue(fact('need.starts_at', '2026-10-03T15:00:00.000Z'));
    expect(value).toMatch(/^3\. okt( \d{4})? · 17:00 \(po vremenu u Srbiji\)$/);
    expect(value).not.toContain(':00:00');
    // The exact reading a correction is seeded from is untouched.
    expect(factReviewValue(fact('need.starts_at', '2026-10-03T15:00:00.000Z'))).toContain('17:00:00');
  });
  it('writes money with its grouping and currency', () => {
    expect(reviewRowValue(fact('need.price_rsd', 1500))).toBe('1.500 RSD');
    expect(reviewRowValue(fact('need.price_rsd', 125000))).toBe('125.000 RSD');
  });
  it('says the confirmed points as a count and their private details, never coordinates or a country code', () => {
    const geography = { mode: 'POINT_TO_POINT' as const, start: { city: 'Novi Sad' }, end: { city: 'Beograd' } };
    const value = reviewRowValue(fact('need.resolved_location', { version: 1, binding: { taskCountryCode: 'RS', geography, exactAddress: null },
      points: [{ slot: 'start', latitudeE6: 45251234, longitudeE6: 19831234, origin: { kind: 'MANUAL_PIN' }, address: 'Bulevar 1', accessNotes: 'Zvono 3' }] }));
    expect(value.split('\n')[0]).toBe('Potvrđeno tačaka: 1 od 2');
    expect(value).toContain('Adresa tačke: Bulevar 1'); expect(value).toContain('Pristup: Zvono 3');
    expect(value).not.toMatch(/45\.25|19\.83|\bRS\b/);
  });
  it('leaves every other fact to the exact review reading', () => {
    expect(reviewRowValue(fact('need.title', 'Prenos ormara'))).toBe('Prenos ormara');
  });
});

describe('publicAnchorPoint', () => {
  const at = (geography: NeedLocationInput['geography'], points: { slot: string; latitudeE6: number; longitudeE6: number }[]): NeedLocationInput =>
    ({ taskCountryCode: 'RS', geography, exactAddress: null, accessNotes: null,
      resolvedLocation: { version: 1, binding: { taskCountryCode: 'RS', geography, exactAddress: null },
        points: points.map(point => ({ ...point, origin: { kind: 'MANUAL_PIN' } })) } } as NeedLocationInput);
  it('uses the start point, rounded to two decimals as the server rounds it', () => {
    expect(publicAnchorPoint(at({ mode: 'STATIONARY', start: { city: 'Novi Sad' } }, [{ slot: 'start', latitudeE6: 45251234, longitudeE6: 19835000 }])))
      .toEqual({ latitude: 45.25, longitude: 19.84 });
  });
  it('uses the service area point for work on an area that has one', () => {
    expect(publicAnchorPoint(at({ mode: 'AREA_BASED', start: { city: 'Novi Sad' }, serviceArea: { city: 'Beograd' } },
      [{ slot: 'start', latitudeE6: 45251234, longitudeE6: 19831234 }, { slot: 'serviceArea', latitudeE6: 44811111, longitudeE6: 20461111 }])))
      .toEqual({ latitude: 44.81, longitude: 20.46 });
  });
  it('rounds half away from zero for negative coordinates (Postgres round), not toward positive infinity', () => {
    expect(publicAnchorPoint(at({ mode: 'STATIONARY', start: { city: 'X' } }, [{ slot: 'start', latitudeE6: -33865000, longitudeE6: -70665000 }])))
      .toEqual({ latitude: -33.87, longitude: -70.67 });
  });
  it('invents no point: none for remote work, no confirmed points, or a missing anchor slot', () => {
    expect(publicAnchorPoint(null)).toBeNull();
    expect(publicAnchorPoint({ taskCountryCode: 'RS', geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null, resolvedLocation: null } as NeedLocationInput)).toBeNull();
    expect(publicAnchorPoint(at({ mode: 'AREA_BASED', serviceArea: { city: 'Beograd' } }, []))).toBeNull();
  });
  it('orders an owner route by its topology, not confirmation order, without leaking precision to the public anchor', () => {
    const value = at({ mode: 'MULTI_STOP', start: { city: 'Novi Sad' }, waypoints: [{ city: 'Sremski Karlovci' }], end: { city: 'Beograd' } },
      [{ slot: 'end', latitudeE6: 44811111, longitudeE6: 20461111 },
        { slot: 'start', latitudeE6: 45251234, longitudeE6: 19831234 },
        { slot: 'waypoints/0', latitudeE6: 45201111, longitudeE6: 19931111 }]);
    expect(privateReviewMap(value)).toMatchObject({ route: true, points: [
      { id: 'start', latitude: 45.251234, longitude: 19.831234 },
      { id: 'waypoints/0', latitude: 45.201111, longitude: 19.931111 },
      { id: 'end', latitude: 44.811111, longitude: 20.461111 }] });
    expect(publicAnchorPoint(value)).toEqual({ latitude: 45.25, longitude: 19.83 });
    expect(privateReviewMap({ ...value, resolvedLocation: { ...value.resolvedLocation!, points: value.resolvedLocation!.points.slice(1) } }).route).toBe(false);
    expect(privateReviewMap({ ...value, geography: { mode: 'REMOTE' } })).toEqual({ points: [], route: false });
    expect(privateReviewMap({ ...value, exactAddress: 'Changed binding' })).toEqual({ points: [], route: false });
  });
});

describe('reviewTodos', () => {
  const base = { safety: 'ALLOW', missingRequired: [] as NeedFactV2Key[], location: {} };
  it('never names the category', () => {
    expect(reviewTodos({ ...base, missingRequired: ['need.category'] }, null)).toEqual([
      { key: 'missing', text: 'Treba još malo o samom zadatku.', target: 'conversation' }]);
    const both = reviewTodos({ ...base, missingRequired: ['need.category', 'need.title'] }, null);
    expect(both[0].text).toBe('Nedostaje: Naslov.'); expect(both[0].text).not.toMatch(/ategorij/);
  });
  it('orders safety, missing, place and fact problems, each with its way to the fix', () => {
    expect(reviewTodos({ safety: 'BLOCK', missingRequired: [], location: null }, REVIEW_FACT_COPY.MY_PRICE_AMOUNT_REQUIRED).map(todo => todo.target))
      .toEqual(['conversation', 'location', 'need.price_rsd']);
    expect(reviewTodos(base, REVIEW_FACT_COPY.FIXED_WINDOW_START_PASSED)[0].target).toBe('need.starts_at');
    expect(reviewTodos(base, null)).toEqual([]);
  });
  it('gives a refusal no row names its own row back to the conversation, unless the identity block explains it', () => {
    expect(reviewTodos({ ...base, canAccept: false }, null)).toEqual([{ key: 'other', text: 'Zadatku je potrebna dopuna u razgovoru.', target: 'conversation' }]);
    expect(reviewTodos({ ...base, canAccept: false }, null, true)).toEqual([]);
  });
});
