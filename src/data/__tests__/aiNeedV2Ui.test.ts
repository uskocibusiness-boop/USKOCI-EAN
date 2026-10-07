import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import { AMOUNT_NOT_ENTERED, AMOUNT_WITH_OFFERS, amountDigits, choiceCorrectionText, correctionFromText, editorCorrection, factChoiceValue,
  factChoices, factCorrectionValue, factEditorKind, factReviewValue, priceAmountRowValue } from '../aiNeedV2Ui';
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

describe('Need V2 price-mode retirement', () => {
  it('accepts only current MY_PRICE/OFFERS aliases', () => {
    expect(correctionFromText(priceModeFact, 'moja cena')).toEqual({
      ok: true,
      value: 'MY_PRICE',
      displayValue: 'moja cena',
    });
    expect(correctionFromText(priceModeFact, 'ponude')).toEqual({
      ok: true,
      value: 'OFFERS',
      displayValue: 'ponude',
    });
  });

  it('rejects retired FASTEST and former najbrže aliases', () => {
    expect(correctionFromText(priceModeFact, 'FASTEST')).toEqual({
      ok: false,
      message: 'Koristiš: moja cena ili ponude.',
    });
    expect(correctionFromText(priceModeFact, 'najbrže')).toEqual({
      ok: false,
      message: 'Koristiš: moja cena ili ponude.',
    });
  });
});

const typedFact = (patch: Partial<AiNeedV2Fact>): AiNeedV2Fact => ({ ...priceModeFact, ...patch, displayValue: 'Different model summary' });
describe('authoritative fact review and correction values', () => {
  it('shows the complete actual text instead of a different or shorter displayValue', () => {
    const value = 'Čćšžđ '.repeat(800), fact = typedFact({ key: 'need.description', valueType: 'TEXT', value });
    expect(factReviewValue(fact)).toBe(value); expect(factCorrectionValue(fact)).toBe(value);
    expect(factReviewValue(typedFact({ key: 'need.exact_address', privacyClass: 'PRIVATE', valueType: 'TEXT', value: 'Privatna 42' }))).toBe('Privatna 42');
  });
  it.each([['MY_PRICE', 'Moja cena'], ['OFFERS', 'Ponude']])('localizes %s and seeds a parseable current enum', (value, label) => {
    const fact = typedFact({ value });
    expect(factReviewValue(fact)).toBe(label); expect(correctionFromText(fact, factCorrectionValue(fact))).toMatchObject({ ok: true, value });
  });
  it('does not activate the retired price mode through its readable label', () => {
    const fact = typedFact({ value: 'FASTEST' }); expect(factReviewValue(fact)).toContain('raniji način');
    expect(correctionFromText(fact, factCorrectionValue(fact))).toMatchObject({ ok: false });
  });
  it.each(['FIXED_WINDOW', 'FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'])('round-trips supported %s schedule wording', value => {
    const fact = typedFact({ key: 'need.schedule_kind', value });
    expect(correctionFromText(fact, factCorrectionValue(fact))).toMatchObject({ ok: true, value });
    expect(factReviewValue(fact)).not.toBe(fact.displayValue);
  });
  it.each([true, false])('renders historical identity requirement %s without silently changing its value', value => {
    const fact = typedFact({ key: 'need.verified_identity_required', valueType: 'BOOLEAN', value });
    expect(factReviewValue(fact)).toBe(value ? 'Da' : 'Ne');
    expect(factCorrectionValue(fact)).toBe(value ? 'Da' : 'Ne');
  });
  it('keeps number input parseable while showing the known RSD unit', () => {
    const fact = typedFact({ key: 'need.price_rsd', valueType: 'INTEGER', value: 500 });
    expect(factReviewValue(fact)).toBe('500 RSD'); expect(factCorrectionValue(fact)).toBe('500');
  });
  it('preserves comma, newline, quote, case, order and duplicate array items', () => {
    const value = ['Vozač, sa dozvolom', 'Drugi\nred', 'Alat "A"', 'Vozač, sa dozvolom'];
    const fact = typedFact({ key: 'need.required_skills', valueType: 'TEXT_ARRAY', value });
    for (const item of value) expect(factReviewValue(fact)).toContain(item);
    expect(correctionFromText(fact, factCorrectionValue(fact))).toMatchObject({ ok: true, value });
  });
  it('retains full maximum typed arrays independently from the bounded display summary', () => {
    const value = Array(50).fill('a'.repeat(500)), fact = typedFact({ key: 'need.required_tools', valueType: 'TEXT_ARRAY', value });
    const corrected = correctionFromText(fact, factCorrectionValue(fact));
    expect(corrected).toMatchObject({ ok: true, value });
    if (corrected.ok) expect(Array.from(corrected.displayValue)).toHaveLength(1000);
    expect(factReviewValue(fact).length).toBeGreaterThan(25000);
  });
  it('represents an empty list without inventing a capability or an invalid empty display', () => {
    const fact = typedFact({ key: 'need.required_vehicles', valueType: 'TEXT_ARRAY', value: [] });
    expect(factReviewValue(fact)).toBe('Nema navedenih stavki');
    expect(correctionFromText(fact, factCorrectionValue(fact))).toEqual({ ok: true, value: [], displayValue: 'Nema navedenih stavki' });
  });
  it.each(['[broken]', '[123]', '[""]'])('rejects malformed explicit list %s', value => {
    expect(correctionFromText(typedFact({ key: 'need.required_tools', valueType: 'TEXT_ARRAY' }), value)).toMatchObject({ ok: false });
  });
  it('formats the actual instant in an explicit zone and preserves every microsecond in correction', () => {
    const value = '2026-09-10T16:30:45.123456Z', fact = typedFact({ key: 'need.starts_at', valueType: 'TIMESTAMPTZ', value });
    expect(factReviewValue(fact)).toContain('18:30:45.123456'); expect(factReviewValue(fact)).toContain('2026');
    expect(factReviewValue(fact)).toContain('vreme u Beogradu'); expect(factCorrectionValue(fact)).toBe(value);
    expect(correctionFromText(fact, factCorrectionValue(fact))).toMatchObject({ ok: true, value });
  });
  it('rejects an impossible ISO date instead of silently normalizing it', () => {
    const value = '2026-02-30T16:30:00Z', fact = typedFact({ key: 'need.starts_at', valueType: 'TIMESTAMPTZ', value });
    expect(factReviewValue(fact)).toBe('Termin nije dostupan'); expect(factCorrectionValue(fact)).toBe('');
    expect(correctionFromText(fact, value)).toMatchObject({ ok: false });
  });
  it('shows every existing geography slot and routes structured corrections to the existing editor', () => {
    const value = { mode: 'MULTI_STOP', start: { label: 'Početak', city: 'Novi Sad', area: 'Liman' },
      waypoints: [{ city: 'Petrovaradin', area: 'Stanica A' }, { city: 'Beočin', area: 'Stanica B' }], end: { city: 'Sremska Kamenica' } };
    const fact = typedFact({ key: 'need.task_geography', valueType: 'OBJECT', value });
    const rendered = factReviewValue(fact);
    for (const fragment of ['Više stanica', 'Početak', 'Liman', 'Stanica 1: Petrovaradin', 'Stanica 2: Beočin', 'Odredište: Sremska Kamenica']) expect(rendered).toContain(fragment);
    expect(factCorrectionValue(fact)).toBe('');
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

describe('PKG-003 deterministic manual task time correction', () => {
  const start = typedFact({ key: 'need.starts_at', valueType: 'TIMESTAMPTZ', value: '2026-09-15T10:00:00Z' });

  it('resolves a plain civil time in the explicit review zone rather than the host/device timezone', () => {
    expect(correctionFromText(start, '2026-09-15 12:00')).toEqual({
      ok: true,
      value: '2026-09-15T10:00:00.000Z',
      displayValue: '2026-09-15 12:00',
    });
  });

  it('rejects impossible civil dates instead of Date.parse normalization', () => {
    expect(correctionFromText(start, '2026-02-30 12:00')).toMatchObject({ ok: false });
  });

  it('rejects a DST gap and repeated wall clock in Europe/Belgrade', () => {
    const gap = correctionFromText(start, '2026-03-29 02:30');
    const repeated = correctionFromText(start, '2026-10-25 02:30');
    expect(gap).toMatchObject({ ok: false });
    expect(repeated).toMatchObject({ ok: false });
    if (!gap.ok) expect(gap.message).toContain('ne postoji');
    if (!repeated.ok) expect(repeated.message).toContain('ponavlja');
  });

  it('preserves an exact valid ISO offset and microseconds byte-for-byte', () => {
    const exact = '2026-09-15T12:00:45.123456+02:00';
    expect(correctionFromText(start, exact)).toEqual({ ok: true, value: exact, displayValue: exact });
  });

  it.each(['09/15/2026 12:00', 'September 15 2026 12:00', '2026-09-15T12:00'])('rejects ambiguous/free-form time %s', input => {
    expect(correctionFromText(start, input)).toMatchObject({ ok: false });
  });
});

describe('AF-D23 unavailable external identity requirement', () => {
  const identity = typedFact({ key: 'need.verified_identity_required', valueType: 'BOOLEAN', value: true });
  it.each(['Da', 'yes', 'true', '1'])('rejects explicit true alias %s with a truthful explanation', text => {
    expect(correctionFromText(identity, text)).toEqual({ ok: false, message: expect.stringContaining('nije dostupna') });
  });
  it.each(['Ne', 'no', 'false', '0'])('permits explicit false alias %s for historical correction', text => {
    expect(correctionFromText(identity, text)).toMatchObject({ ok: true, value: false });
  });
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
    expect(factReviewValue(basis('TOTAL'))).not.toBe(basis('TOTAL').displayValue);
  });

  it.each(['TOTAL', 'PER_PERSON'])('round-trips %s through the correction editor unchanged', value => {
    const fact = basis(value);
    expect(correctionFromText(fact, factCorrectionValue(fact))).toMatchObject({ ok: true, value });
  });

  it.each([['ukupno', 'TOTAL'], ['Po Osobi', 'PER_PERSON'], ['per_person', 'PER_PERSON']])(
    'accepts %s as %s', (text, value) => {
      expect(correctionFromText(basis('TOTAL'), text)).toMatchObject({ ok: true, value });
    });

  // Without this the ENUM falls through to "accept any text": the word reaches the server, which
  // refuses it with V2_PRICE_BASIS_INVALID, and the person is told nothing useful. The refusal
  // belongs where the typing happened.
  it.each(['po komadu', 'PO_OSOBI_MOZDA', 'total price'])('refuses %s here rather than on the server', text => {
    expect(correctionFromText(basis('TOTAL'), text)).toEqual({ ok: false, message: 'Koristiš: ukupno ili po osobi.' });
  });

  it('leaves an empty field to the general rule, which already says the better thing', () => {
    expect(correctionFromText(basis('TOTAL'), '   ')).toEqual({ ok: false, message: 'Unesi vrednost.' });
  });

  it('says so plainly when the stored basis is not one this app knows', () => {
    expect(factReviewValue(basis('PER_HOUR'))).toBe('Osnova cene nije dostupna');
    expect(factReviewValue(basis(7))).toBe('Osnova cene nije dostupna');
  });
});

// Deep read 7.22, 7.23, 7.24: Serbian numbers, the server's ranges said before sending, and long text.
describe('corrections read Serbian numbers and say the server limits first', () => {
  const integer = (key: string) => typedFact({ key: key as AiNeedV2Fact['key'], valueType: 'INTEGER', value: 1 });
  it.each([['5.000', 5000], ['15.000', 15000], ['1.500', 1500], ['5 000', 5000], ['5000', 5000], ['1.000.000', 1000000]])('reads %s as %d', (text, value) => {
    expect(correctionFromText(integer('need.price_rsd'), text)).toEqual({ ok: true, value, displayValue: text });
  });
  it.each(['5,000', '5,5', '1.5', '12.34', 'pet'])('refuses %s instead of guessing', text => {
    expect(correctionFromText(integer('need.price_rsd'), text).ok).toBe(false);
  });
  it('says the comma is the problem when there is one', () => {
    expect(correctionFromText(integer('need.price_rsd'), '5,000')).toEqual({ ok: false, message: 'Upiši ceo broj bez zareza, na primer 5000.' });
  });
  it.each([['need.price_rsd', '0'], ['need.price_rsd', '100.000.001'], ['need.people_needed', '0'], ['need.people_needed', '51'],
    ['need.minimum_experience_years', '61'], ['need.people_needed', '-3']])('%s refuses %s with the server limit', (key, text) => {
    const result = correctionFromText(integer(key), text);
    expect(result.ok).toBe(false);
  });
  it('keeps a long description whole and shortens only what is displayed', () => {
    const value = 'a'.repeat(3000), result = correctionFromText(typedFact({ key: 'need.description', valueType: 'TEXT', value: '' }), value);
    expect(result).toMatchObject({ ok: true, value });
    if (result.ok) { expect(Array.from(result.displayValue).length).toBe(1000); expect(result.displayValue.endsWith('…')).toBe(true); }
  });
  it('refuses text over the server limit for that field', () => {
    expect(correctionFromText(typedFact({ key: 'need.title', valueType: 'TEXT', value: '' }), 'n'.repeat(141)))
      .toEqual({ ok: false, message: 'Najviše 140 znakova.' });
  });
});

// The enum facts were corrected by typing a word the parser knew ("Moja cena"), the amount in a free text box. They are
// now chosen from their exact values and typed as digits; these pin that the controls write what the box wrote.
describe('choices for the enum facts and a digits-only amount, saving what the text box saved', () => {
  const enumFact = (key: AiNeedV2Fact['key'], value: unknown) => typedFact({ key, valueType: 'ENUM', value });
  const ACCEPTED: Record<string, string[]> = {
    'need.price_mode': ['MY_PRICE', 'OFFERS'],
    'need.price_basis': ['TOTAL', 'PER_PERSON'],
    'need.schedule_kind': ['FIXED_WINDOW', 'FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'],
  };

  it('opens a choice for the three enum facts and the amount field for the price only', () => {
    for (const key of Object.keys(ACCEPTED)) expect([key, factEditorKind(enumFact(key as AiNeedV2Fact['key'], null))]).toEqual([key, 'choice']);
    expect(factEditorKind(typedFact({ key: 'need.price_rsd', valueType: 'INTEGER', value: 500 }))).toBe('amount');
    // Other numbers and texts keep the field they had.
    expect(factEditorKind(typedFact({ key: 'need.people_needed', valueType: 'INTEGER', value: 2 }))).toBe('text');
    expect(factEditorKind(typedFact({ key: 'need.description', valueType: 'TEXT', value: 'x' }))).toBe('text');
  });

  it.each(Object.entries(ACCEPTED))('%s offers exactly the values the parser accepts, in their review words', (key, values) => {
    const options = factChoices({ key: key as AiNeedV2Fact['key'] });
    expect(options.map(option => option.value).sort()).toEqual([...values].sort());
    for (const option of options) {
      const fact = enumFact(key as AiNeedV2Fact['key'], option.value);
      // The chip's words are the row's words.
      expect(option.label).toBe(factReviewValue(fact));
      // Choosing it saves exactly what saving the old seeded box saved: the value, and its label as display text.
      expect(correctionFromText(fact, choiceCorrectionText(fact, option.value)))
        .toEqual({ ok: true, value: option.value, displayValue: option.label });
      expect(correctionFromText(fact, choiceCorrectionText(fact, option.value))).toEqual(correctionFromText(fact, factCorrectionValue(fact)));
    }
  });

  it('offers no retired price mode and no urgency, and starts a retired value on no choice', () => {
    const labels = Object.keys(ACCEPTED).flatMap(key => factChoices({ key: key as AiNeedV2Fact['key'] }).map(option => `${option.value} ${option.label}`));
    expect(labels.join(' ')).not.toMatch(/FASTEST|Najbrže|HITNO|hitno|URGENT/);
    expect(factChoiceValue(enumFact('need.price_mode', 'FASTEST'))).toBeNull();
    expect(factChoiceValue(enumFact('need.price_mode', 'OFFERS'))).toBe('OFFERS');
    expect(choiceCorrectionText(enumFact('need.price_mode', 'FASTEST'), null)).toBe('');
  });

  it('says what an untouched choice or an empty amount needs, and passes everything else to the parser unchanged', () => {
    expect(editorCorrection(enumFact('need.price_mode', 'FASTEST'), '')).toEqual({ ok: false, message: 'Izaberi jednu od ponuđenih mogućnosti.' });
    const amount = typedFact({ key: 'need.price_rsd', valueType: 'INTEGER', value: null });
    expect(editorCorrection(amount, '')).toEqual({ ok: false, message: 'Upiši iznos u dinarima.' });
    expect(editorCorrection(amount, '25000')).toEqual({ ok: true, value: 25000, displayValue: '25000' });
    expect(editorCorrection(amount, '0')).toEqual(correctionFromText(amount, '0'));
    const title = typedFact({ key: 'need.title', valueType: 'TEXT', value: '' });
    expect(editorCorrection(title, '  ')).toEqual(correctionFromText(title, '  '));
  });

  it.each([['1500', '1500'], ['1.500', '1500'], ['1.500 RSD', '1500'], ['1 500', '1500'], ['0', '0'], ['007', '7'], ['', ''],
    ['100.000.000', '100000000']])('reads the amount text %j as the digits %j', (typed, digits) => {
    expect(amountDigits(typed)).toBe(digits);
  });

  it.each(['5,5', '1.500,00', '1234567890'])('does not guess at %j: the field keeps what it had', typed => {
    expect(amountDigits(typed)).toBeNull();
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
});
