import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import { AMOUNT_NOT_ENTERED, AMOUNT_WITH_OFFERS, factReviewValue, priceAmountRowValue } from '../aiNeedV2Ui';
import { AI_PROPOSABLE_NEED_FACT_V2_KEYS, NEED_FACT_V2_DEFINITIONS } from '../../contracts/needFactsV2';

const priceModeFact: AiNeedV2Fact = {
  id: 'price-mode-proof',
  key: 'need.price_mode',
  value: 'OFFERS',
  displayValue: 'Ponude',
  valueType: 'ENUM',
  privacyClass: 'PUBLIC',
  requiredForDraft: true,
  status: 'CONFIRMED',
  source: 'EXPLICIT_USER_ANSWER',
  evidence: 'ponude',
};

it('formats handoff from typed facts and leaves unknown unknown', () => {
  const handoff: AiNeedV2Fact={...priceModeFact,key:'need.handoff',valueType:'OBJECT',requiredForDraft:false,
    value:{required:true,localExchange:{countryCode:'RS',city:'Novi Sad'}},displayValue:'FAKE DELIVERY ANYWHERE'};
  expect(factReviewValue(handoff)).toBe('Lično preuzimanje: Novi Sad (RS)');
  expect(factReviewValue({...handoff,value:{required:false}})).toBe('Bez fizičke predaje');
  expect(factReviewValue({...handoff,value:undefined})).toBe('Predaja još nije razjašnjena');
});

const typedFact = (patch: Partial<AiNeedV2Fact>): AiNeedV2Fact => ({ ...priceModeFact, ...patch, displayValue: 'Different model summary' });
describe('authoritative fact review values', () => {
  it('shows the complete actual text instead of a different or shorter displayValue', () => {
    const value = 'Čćšžđ '.repeat(800), fact = typedFact({ key: 'need.description', valueType: 'TEXT', value });
    expect(factReviewValue(fact)).toBe(value);
    expect(factReviewValue(typedFact({ key: 'need.exact_address', privacyClass: 'PRIVATE', valueType: 'TEXT', value: 'Privatna 42' }))).toBe('Privatna 42');
  });
  it.each([['MY_PRICE', 'Moja cena'], ['OFFERS', 'Ponude']])('localizes current %s', (value, label) => {
    const fact = typedFact({ value });
    expect(factReviewValue(fact)).toBe(label);
  });
  it('labels the retired price mode as historical', () => {
    const fact = typedFact({ value: 'FASTEST' }); expect(factReviewValue(fact)).toContain('raniji način');
  });
  it.each(['FIXED_WINDOW', 'FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'])('shows supported %s schedule wording', value => {
    const fact = typedFact({ key: 'need.schedule_kind', value });
    expect(factReviewValue(fact)).not.toBe(fact.displayValue);
  });
  it.each([true, false])('renders historical identity requirement %s without silently changing its value', value => {
    const fact = typedFact({ key: 'need.verified_identity_required', valueType: 'BOOLEAN', value });
    expect(factReviewValue(fact)).toBe(value ? 'Da' : 'Ne');
  });
  it('shows the known RSD unit', () => {
    const fact = typedFact({ key: 'need.price_rsd', valueType: 'INTEGER', value: 500 });
    expect(factReviewValue(fact)).toBe('500 RSD');
  });
  it('preserves comma, newline, quote, case, order and duplicate array items', () => {
    const value = ['Vozač, sa dozvolom', 'Drugi\nred', 'Alat "A"', 'Vozač, sa dozvolom'];
    const fact = typedFact({ key: 'need.required_skills', valueType: 'TEXT_ARRAY', value });
    for (const item of value) expect(factReviewValue(fact)).toContain(item);
  });
  it('retains full maximum typed arrays independently from the bounded display summary', () => {
    const value = Array(50).fill('a'.repeat(500)), fact = typedFact({ key: 'need.required_tools', valueType: 'TEXT_ARRAY', value });
    expect(factReviewValue(fact).length).toBeGreaterThan(25000);
  });
  it('represents an empty list without inventing a capability or an invalid empty display', () => {
    const fact = typedFact({ key: 'need.required_vehicles', valueType: 'TEXT_ARRAY', value: [] });
    expect(factReviewValue(fact)).toBe('Nema navedenih stavki');
  });
  it('formats the actual instant in an explicit zone with every microsecond', () => {
    const value = '2026-09-10T16:30:45.123456Z', fact = typedFact({ key: 'need.starts_at', valueType: 'TIMESTAMPTZ', value });
    expect(factReviewValue(fact)).toContain('18:30:45.123456'); expect(factReviewValue(fact)).toContain('2026');
    expect(factReviewValue(fact)).toContain('vreme u Beogradu');
  });
  it('rejects an impossible ISO date instead of silently normalizing it', () => {
    const value = '2026-02-30T16:30:00Z', fact = typedFact({ key: 'need.starts_at', valueType: 'TIMESTAMPTZ', value });
    expect(factReviewValue(fact)).toBe('Termin nije dostupan');
  });
  it('shows every existing geography slot', () => {
    const value = { mode: 'MULTI_STOP', start: { label: 'Početak', city: 'Novi Sad', area: 'Liman' },
      waypoints: [{ city: 'Petrovaradin', area: 'Stanica A' }, { city: 'Beočin', area: 'Stanica B' }], end: { city: 'Sremska Kamenica' } };
    const fact = typedFact({ key: 'need.task_geography', valueType: 'OBJECT', value });
    const rendered = factReviewValue(fact);
    for (const fragment of ['Više stanica', 'Početak', 'Liman', 'Stanica 1: Petrovaradin', 'Stanica 2: Beočin', 'Odredište: Sremska Kamenica']) expect(rendered).toContain(fragment);
  });
  it('shows private confirmed witness details without treating provider hints as attestation', () => {
    const value = { version: 1, binding: { taskCountryCode: 'RS', geography: { mode: 'STATIONARY', start: { city: 'Novi Sad' } }, exactAddress: 'Privatna 42' },
      points: [{ slot: 'start', latitudeE6: 45255123, longitudeE6: 19845123,
        origin: { kind: 'PROVIDER_CANDIDATE', providerHint: 'provider-secret-hint', candidateHint: 'candidate-secret-hint' }, address: 'Ulaz A', accessNotes: 'Drugi sprat' }] };
    const rendered = factReviewValue(typedFact({ key: 'need.resolved_location', valueType: 'OBJECT', privacyClass: 'PRIVATE', value }));
    for (const fragment of ['1 od 1', 'RS', 'Novi Sad', 'Privatna 42', '45.255123', '19.845123', 'Ulaz A', 'Drugi sprat']) expect(rendered).toContain(fragment);
    expect(rendered).not.toContain('secret-hint');
  });
});

describe('AF-D23 unavailable external identity requirement', () => {
  it('retains the typed historical key while removing it from provider proposals', () => {
    expect(NEED_FACT_V2_DEFINITIONS['need.verified_identity_required']).toMatchObject({ valueType: 'BOOLEAN', requiredForDraft: false, manualOnly: true });
    expect(AI_PROPOSABLE_NEED_FACT_V2_KEYS).not.toContain('need.verified_identity_required');
    expect(AI_PROPOSABLE_NEED_FACT_V2_KEYS).toContain('need.required_vehicles');
  });
});

describe('PKG-025d price basis in the review', () => {
  const basis = (value: unknown) => typedFact({ key: 'need.price_basis', valueType: 'ENUM', requiredForDraft: false, value });

  it('names the basis in words rather than showing the stored enum or the model summary', () => {
    expect(factReviewValue(basis('PER_PERSON'))).toBe('Po osobi');
    expect(factReviewValue(basis('TOTAL'))).toBe('Ukupno za ceo zadatak');
    expect(factReviewValue(basis('HOURLY'))).toBe('Po osobi po satu');
    expect(factReviewValue(basis('TOTAL'))).not.toBe(basis('TOTAL').displayValue);
  });

  it('says so plainly when the stored basis is not one this app knows', () => {
    expect(factReviewValue(basis('PER_HOUR'))).toBe('Osnova cene nije dostupna');
    expect(factReviewValue(basis(7))).toBe('Osnova cene nije dostupna');
  });
});

it('never shows an amount beside "Ponude", and says a missing "Moja cena" amount in words', () => {
  const amount = (value: unknown) => typedFact({ key: 'need.price_rsd', valueType: 'INTEGER', value });
  expect(priceAmountRowValue('OFFERS', amount(1500))).toBe(AMOUNT_WITH_OFFERS);
  expect(priceAmountRowValue('OFFERS', amount(null))).toBe(AMOUNT_WITH_OFFERS);
  expect(priceAmountRowValue('MY_PRICE', amount(null))).toBe(AMOUNT_NOT_ENTERED);
  expect(priceAmountRowValue('MY_PRICE', amount(0))).toBe(AMOUNT_NOT_ENTERED);
  for (const text of [AMOUNT_WITH_OFFERS, AMOUNT_NOT_ENTERED]) expect(text).not.toMatch(/\d/);
  // An amount that is there reads as it always did; other rows are not touched.
  expect(priceAmountRowValue('MY_PRICE', amount(1500))).toBeNull();
  expect(priceAmountRowValue(undefined, amount(1500))).toBeNull();
  expect(priceAmountRowValue('OFFERS', typedFact({ key: 'need.people_needed', valueType: 'INTEGER', value: 2 }))).toBeNull();
});

it.each(['100 EUR', '100 €', 'sto evra', '999999 RSD'])('typed RSD ignores contradictory presentation %s', displayValue => {
  const fact: AiNeedV2Fact = { ...priceModeFact, key: 'need.price_rsd', valueType: 'INTEGER', value: 100, displayValue };
  expect(factReviewValue(fact)).toBe('100 RSD');
  expect(fact.displayValue).toBe(displayValue);
});
