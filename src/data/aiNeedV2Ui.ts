import { capabilityTerms } from '../lib/capabilityTerms';
import { countryCode } from '../lib/market';
import { calendarInstant } from '../lib/calendarTime';
import { locationSlots, normalizeNeedLocation, normalizeTaskGeography } from '../lib/location';
import { civilInstant, displayDate, zonedParts } from '../ui/calendar/calendarPresentation';
import type { AiNeedSafety, AiNeedV2Fact } from '../contracts/aiNeedV2';
import {
  NEED_FACT_V2_DEFINITIONS,
  type NeedFactV2Key,
  type NeedTaskGeography,
  type NeedTaskGeographyPoint,
  type LocationSlot,
} from '../contracts/needFactsV2';

export type FactCorrection =
  | { ok: true; value: unknown; displayValue: string }
  | { ok: false; message: string };

const PRICE_MODE: Record<string, string> = {
  'moja cena': 'MY_PRICE',
  'moja_cena': 'MY_PRICE',
  my_price: 'MY_PRICE',
  ponude: 'OFFERS',
  offers: 'OFFERS',
};

const PRICE_BASIS: Record<string, string> = {
  ukupno: 'TOTAL',
  'ukupno za ceo zadatak': 'TOTAL',
  total: 'TOTAL',
  'po osobi': 'PER_PERSON',
  po_osobi: 'PER_PERSON',
  per_person: 'PER_PERSON',
};

const SCHEDULE_KIND: Record<string, string> = {
  'tačan termin': 'FIXED_WINDOW',
  'tacan termin': 'FIXED_WINDOW',
  fixed_window: 'FIXED_WINDOW',
  fleksibilno: 'FLEXIBLE',
  flexible: 'FLEXIBLE',
  'daljinski bilo kada': 'REMOTE_ANYTIME',
  remote_anytime: 'REMOTE_ANYTIME',
  danas: 'TODAY_FLEXIBLE',
  today_flexible: 'TODAY_FLEXIBLE',
  sutra: 'TOMORROW_FLEXIBLE',
  tomorrow_flexible: 'TOMORROW_FLEXIBLE',
  'ove nedelje': 'WEEK_FLEXIBLE',
  week_flexible: 'WEEK_FLEXIBLE',
};

export function factLabel(key: NeedFactV2Key): string {
  return NEED_FACT_V2_DEFINITIONS[key].label;
}

export function sortFacts(facts: AiNeedV2Fact[]): AiNeedV2Fact[] {
  const order = new Map(
    Object.keys(NEED_FACT_V2_DEFINITIONS).map((key, index) => [key, index]),
  );
  return [...facts].sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999));
}

/**
 * Which editor a fact opens. A moment and a list used to have none: the only control was a text
 * box, so correcting a date meant retyping `2026-09-15T10:00:00Z` and correcting a list meant
 * editing `["Prevoz","utovar"]` as JSON. Rather than offer that, "Izmeni" on those seven facts left
 * the review without a word. They keep their exact shapes — a comma inside an item and the
 * precision of an instant still survive the round trip — and get a picker and a list field that
 * write those shapes for the person. A structured place stays with the location editor.
 *
 * The three enum facts (how the price works, what it is for, what kind of time) were corrected by
 * typing a word the parser happened to know ("Moja cena", "po osobi"); they are now chosen from
 * their exact allowed values (`choice`). The amount was a free text box; it is now a field that
 * takes digits only and shows them grouped (`amount`). Both still write the text below, so what
 * reaches `correctionFromText`, and so the saved value and its display text, is what it always was.
 */
export type FactEditorKind = 'text' | 'timestamp' | 'list' | 'choice' | 'amount' | 'none';
export function factEditorKind(fact: AiNeedV2Fact): FactEditorKind {
  return fact.valueType === 'OBJECT' ? 'none' : fact.valueType === 'TIMESTAMPTZ' ? 'timestamp'
    : fact.valueType === 'TEXT_ARRAY' ? 'list' : fact.valueType === 'ENUM' && FACT_CHOICES[fact.key] ? 'choice'
      : fact.key === 'need.price_rsd' && fact.valueType === 'INTEGER' ? 'amount' : 'text';
}

const PRICE_LABELS: Record<string, string> = { MY_PRICE: 'Moja cena', OFFERS: 'Ponude', FASTEST: 'Najbrže (raniji način)' };
const PRICE_BASIS_LABELS: Record<string, string> = { TOTAL: 'Ukupno za ceo zadatak', PER_PERSON: 'Po osobi' };
const SCHEDULE_LABELS: Record<string, string> = { FIXED_WINDOW: 'Tačan termin', FLEXIBLE: 'Fleksibilno', REMOTE_ANYTIME: 'Daljinski bilo kada',
  TODAY_FLEXIBLE: 'Danas', TOMORROW_FLEXIBLE: 'Sutra', WEEK_FLEXIBLE: 'Ove nedelje' };

export type FactChoice = { value: string; label: string };
/**
 * The values a person may choose for an enum fact, in the words the review already reads them in. Exactly the values
 * `correctionFromText` accepts and nothing else: the retired FASTEST is not offered (a task that still carries it shows
 * no choice selected until one is made), and there is no separate urgency choice (owner, 2026-10-07: no HITNO in V1).
 * Ordered as a person thinks about them: for the time, the nearest first, the open ones after.
 */
const FACT_CHOICES: Partial<Record<NeedFactV2Key, readonly FactChoice[]>> = {
  'need.price_mode': ['MY_PRICE', 'OFFERS'].map(value => ({ value, label: PRICE_LABELS[value] })),
  'need.price_basis': ['TOTAL', 'PER_PERSON'].map(value => ({ value, label: PRICE_BASIS_LABELS[value] })),
  'need.schedule_kind': ['TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE', 'FIXED_WINDOW', 'FLEXIBLE', 'REMOTE_ANYTIME']
    .map(value => ({ value, label: SCHEDULE_LABELS[value] })),
};
export function factChoices(fact: Pick<AiNeedV2Fact, 'key'>): readonly FactChoice[] {
  return FACT_CHOICES[fact.key] ?? [];
}
/** The stored value when it is one of the choices; anything else (a retired or unknown value) is no choice at all. */
export function factChoiceValue(fact: Pick<AiNeedV2Fact, 'key' | 'value'>): string | null {
  return factChoices(fact).find(choice => choice.value === fact.value)?.value ?? null;
}
/**
 * What a chosen value hands to `correctionFromText`: its own label, which the parser maps back to the value. That is the
 * text the old box was seeded with, so saving a choice sends the same value and display text that saving the box did.
 */
export function choiceCorrectionText(fact: Pick<AiNeedV2Fact, 'key'>, value: string | null): string {
  return factChoices(fact).find(choice => choice.value === value)?.label ?? '';
}

/**
 * What the text of an amount field becomes: its digits, without a leading zero before another digit. The field shows them
 * grouped with a dot (Serbian: 1.500), so a dot or a space between groups is part of the number and "1.500 RSD" is 1500.
 * Null when the text is not a whole amount the field can take, and the field then keeps what it had instead of guessing:
 * a comma (the Serbian decimal mark; an amount is whole dinars) or more than nine digits (the server's ceiling is
 * 100.000.000 RSD; a tenth digit is not cut off silently).
 */
export const AMOUNT_MAX_DIGITS = 9;
export function amountDigits(typed: string): string | null {
  if (typed.includes(',')) return null;
  const digits = typed.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits.length > AMOUNT_MAX_DIGITS ? null : digits;
}

/** What an amount row reads under "Ponude": the task carries no amount, so none is shown, not even a stale one. */
export const AMOUNT_WITH_OFFERS = 'Bez iznosa: tražiš ponude';
/** An amount "Moja cena" still needs, said in words where the number would stand; never "0 RSD". */
export const AMOUNT_NOT_ENTERED = 'Iznos još nije unet';
/**
 * The amount row beside its price mode. Under "Ponude" there is no amount to read, so even an amount left from before is
 * not shown as one; under "Moja cena" an amount that is missing says so in words. Null: the row reads its value as usual.
 */
export function priceAmountRowValue(priceMode: unknown, fact: Pick<AiNeedV2Fact, 'key' | 'value'>): string | null {
  if (fact.key !== 'need.price_rsd') return null;
  if (priceMode === 'OFFERS') return AMOUNT_WITH_OFFERS;
  const amount = fact.value;
  if (priceMode === 'MY_PRICE' && !(typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 1)) return AMOUNT_NOT_ENTERED;
  return null;
}

/**
 * The correction an open editor saves. A choice nobody made and an amount nobody typed say what to do in the words of
 * their control; everything else, and every value they write, goes through `correctionFromText` unchanged.
 */
export function editorCorrection(fact: AiNeedV2Fact, text: string): FactCorrection {
  if (!text.trim()) {
    const kind = factEditorKind(fact);
    if (kind === 'choice') return { ok: false, message: 'Izaberi jednu od ponuđenih mogućnosti.' };
    if (kind === 'amount') return { ok: false, message: 'Upiši iznos u dinarima.' };
  }
  return correctionFromText(fact, text);
}
const GEOGRAPHY_LABELS: Record<NeedTaskGeography['mode'], string> = { STATIONARY: 'Na jednom mestu', POINT_TO_POINT: 'Od mesta do mesta',
  MULTI_STOP: 'Više stanica', AREA_BASED: 'Na području', REMOTE: 'Na daljinu' };
const REVIEW_TIMEZONE = 'Europe/Belgrade';
export function slotLabel(slot: LocationSlot, stationary = false): string {
  return slot === 'start' ? stationary ? 'Mesto' : 'Polazište' : slot === 'end' ? 'Odredište'
    : slot === 'serviceArea' ? 'Područje' : `Stanica ${Number(slot.split('/')[1]) + 1}`;
}
function geographyReview(geography: NeedTaskGeography): string {
  const point = (value: NeedTaskGeographyPoint) => [value.label, value.city, value.area].filter(value => value !== undefined).join(' · ');
  const lines = [GEOGRAPHY_LABELS[geography.mode]];
  for (const slot of locationSlots(geography)) {
    const place = slot === 'start' ? geography.start : slot === 'end' ? geography.end
      : slot === 'serviceArea' ? geography.serviceArea : geography.waypoints?.[Number(slot.split('/')[1])];
    if (place) lines.push(`${slotLabel(slot, geography.mode === 'STATIONARY')}: ${point(place)}`);
  }
  return lines.join('\n');
}

/** Human review always reads the typed value, never model-supplied displayValue.
 * Caller controls private-row disclosure; this formatter does not grant access. */
export function factReviewValue(fact: AiNeedV2Fact): string {
  const value = fact.value;
  if (fact.key === 'need.task_geography') {
    const geography = normalizeTaskGeography(value);
    return geography ? geographyReview(geography) : 'Lokacija nije dostupna';
  }
  if (fact.key === 'need.resolved_location') {
    const raw = value as { binding?: { taskCountryCode?: unknown; geography?: unknown; exactAddress?: unknown } } | null;
    const location = normalizeNeedLocation({ ...raw?.binding, accessNotes: null, resolvedLocation: value });
    if (!location?.resolvedLocation) return 'Potvrđene tačke nisu dostupne';
    const points = location.resolvedLocation.points;
    return [`${points.length} od ${locationSlots(location.geography).length} tačaka · ${location.taskCountryCode}`,
      geographyReview(location.geography), ...(location.exactAddress ? [`Tačna adresa: ${location.exactAddress}`] : []),
      ...points.map(point => [
        `${slotLabel(point.slot, location.geography.mode === 'STATIONARY')}: ${(point.latitudeE6 / 1e6).toFixed(6)}, ${(point.longitudeE6 / 1e6).toFixed(6)}`,
        ...(point.address ? [`Adresa tačke: ${point.address}`] : []), ...(point.accessNotes ? [`Pristup: ${point.accessNotes}`] : []),
      ].join('\n'))].join('\n');
  }
  if (fact.valueType === 'TEXT_ARRAY') {
    const values = capabilityTerms(value);
    return values ? values.length ? values.map(item => `• ${item}`).join('\n') : 'Nema navedenih stavki' : 'Podatak nije dostupan';
  }
  if (fact.valueType === 'BOOLEAN') return value === true ? 'Da' : value === false ? 'Ne' : 'Podatak nije dostupan';
  if (fact.valueType === 'INTEGER') return typeof value === 'number' && Number.isInteger(value)
    ? `${value}${fact.key === 'need.price_rsd' ? ' RSD' : ''}` : 'Podatak nije dostupan';
  if (fact.valueType === 'TIMESTAMPTZ') {
    const instant = calendarInstant(value);
    if (instant === null) return 'Termin nije dostupan';
    try {
      const milliseconds = instant >= 0 ? instant / 1000n : (instant - 999n) / 1000n;
      const parts = zonedParts(new Date(Number(milliseconds)), REVIEW_TIMEZONE);
      // Include date/year/seconds and exact fractional precision, never device timezone.
      const fraction = typeof value === 'string' ? /\.(\d+)(?:Z|[+-])/.exec(value)?.[1] : undefined;
      return `${displayDate(parts.date)} ${parts.date.slice(0, 4)} · ${parts.time}${fraction ? `.${fraction}` : ''} (vreme u Beogradu)`;
    } catch { return 'Termin nije dostupan'; }
  }
  if (fact.key === 'need.price_mode') return typeof value === 'string' ? PRICE_LABELS[value] ?? 'Način cene nije dostupan' : 'Način cene nije dostupan';
  if (fact.key === 'need.price_basis') return typeof value === 'string' ? PRICE_BASIS_LABELS[value] ?? 'Osnova cene nije dostupna' : 'Osnova cene nije dostupna';
  if (fact.key === 'need.schedule_kind') return typeof value === 'string' ? SCHEDULE_LABELS[value] ?? 'Vrsta termina nije dostupna' : 'Vrsta termina nije dostupna';
  return typeof value === 'string' ? value : 'Podatak nije dostupan';
}

/** Parseable input retains value identity, including commas inside array items
 * and timestamp precision. Structured locations stay in the existing editor. */
export function factCorrectionValue(fact: AiNeedV2Fact): string {
  if (fact.valueType === 'OBJECT') return '';
  if (fact.valueType === 'TEXT_ARRAY') return capabilityTerms(fact.value) ? JSON.stringify(fact.value) : '';
  if (fact.valueType === 'BOOLEAN') return fact.value === true ? 'Da' : fact.value === false ? 'Ne' : '';
  if (fact.valueType === 'INTEGER') return typeof fact.value === 'number' && Number.isInteger(fact.value) ? String(fact.value) : '';
  if (fact.valueType === 'TIMESTAMPTZ') return typeof fact.value === 'string' && calendarInstant(fact.value) !== null ? fact.value : '';
  if (fact.key === 'need.price_mode' || fact.key === 'need.schedule_kind' || fact.key === 'need.price_basis') return factReviewValue(fact);
  return typeof fact.value === 'string' ? fact.value : '';
}

/** The date and the minute of a moment, in the zone the review shows it in. */
export function factTimestampFields(fact: AiNeedV2Fact): { date: string; time: string } {
  const instant = calendarInstant(fact.value);
  if (instant === null) return { date: '', time: '' };
  try {
    const milliseconds = instant >= 0 ? instant / 1000n : (instant - 999n) / 1000n;
    const parts = zonedParts(new Date(Number(milliseconds)), REVIEW_TIMEZONE);
    return { date: parts.date, time: parts.time.slice(0, 5) };
  } catch { return { date: '', time: '' }; }
}

/**
 * What the picker hands to `correctionFromText`. A moment nobody moved goes back byte for byte, so
 * opening the editor and saving cannot shave the seconds or the offset off a stored instant; a
 * moved one goes through the civil parser, which owns the zone and the DST rules.
 */
export function timestampCorrectionText(fact: AiNeedV2Fact, date: string, time: string): string {
  const original = factTimestampFields(fact);
  if (date === original.date && time === original.time && typeof fact.value === 'string') return fact.value;
  return `${date} ${time}`.trim();
}

export function factListItems(fact: AiNeedV2Fact): string[] {
  return capabilityTerms(fact.value) ?? [];
}

/** JSON, so an item with a comma in it stays one item. An empty list is a valid correction. */
export function listCorrectionText(items: readonly string[]): string {
  return JSON.stringify(items);
}

/**
 * The ranges the server's fact validator enforces, said before sending (deep read 7.24): a correction
 * outside them used to come back as an unmapped refusal and read "Ishod radnje nije potvrđen".
 */
const INTEGER_RANGE: Readonly<Record<string, readonly [number, number, string]>> = {
  'need.price_rsd': [1, 100_000_000, 'Iznos mora biti između 1 i 100.000.000 RSD.'],
  'need.people_needed': [1, 50, 'Broj ljudi mora biti između 1 i 50.'],
  'need.minimum_experience_years': [0, 60, 'Iskustvo može biti od 0 do 60 godina.'],
};
const TEXT_MAX: Readonly<Record<string, number>> = {
  'need.title': 140, 'need.category': 120, 'need.description': 6000, 'need.exact_address': 1000, 'need.access_notes': 2000,
};
/** The server keeps at most 1,000 characters of a fact's display text; the value itself may be longer (7.23). */
const DISPLAY_MAX = 1000;
const displayOf = (text: string) => {
  const chars = Array.from(text);
  return chars.length <= DISPLAY_MAX ? text : chars.slice(0, DISPLAY_MAX - 1).join('') + '…';
};

export function correctionFromText(fact: AiNeedV2Fact, input: string): FactCorrection {
  const text = input.trim();
  if (!text) return { ok: false, message: 'Unesi vrednost.' };

  switch (fact.valueType) {
    case 'INTEGER': {
      // Serbian writes thousands with a dot or a space ("5.000", "5 000") and decimals with a comma, so a
      // dot between groups of three digits is part of a whole number and a comma never is (deep read 7.22:
      // "5.000" used to be read as 5).
      const compact = text.replace(/\s/g, ''); // \s also covers the no-break spaces a keyboard may insert
      if (!/^-?(\d+|\d{1,3}(\.\d{3})+)$/.test(compact)) {
        return { ok: false, message: compact.includes(',') ? 'Upiši ceo broj bez zareza, na primer 5000.' : 'Unesi ceo broj.' };
      }
      const parsed = Number(compact.replace(/\./g, ''));
      if (!Number.isSafeInteger(parsed)) return { ok: false, message: 'Unesi ceo broj.' };
      const range = INTEGER_RANGE[fact.key];
      if (range && (parsed < range[0] || parsed > range[1])) return { ok: false, message: range[2] };
      return { ok: true, value: parsed, displayValue: text };
    }
    case 'BOOLEAN': {
      const normalized = text.toLocaleLowerCase('sr-Latn-RS');
      if (['da', 'yes', 'true', '1'].includes(normalized)) {
        // AF-D23: this build has no document or selfie check, and the decision says never to show a
        // verified identity without actual verification. The condition is refused at the moment a
        // person says it, in the conversation, rather than accepted here and taken back two screens
        // later at the review — which is where the other two layers live: `pregled-zadatka` greys
        // publication with this reason and offers to drop the condition, and a resumed publication
        // command fails IDENTITY_VERIFICATION_UNAVAILABLE. Those two exist for drafts that already
        // carry the fact; they are not a reason to stop refusing it here. Guarded by the four
        // AF-D23 cases in src/data/__tests__/aiNeedV2Ui.test.ts.
        if (fact.key === 'need.verified_identity_required') return { ok: false,
          message: 'Provera identiteta nije dostupna u ovoj test verziji. Izaberi „Ne“ da nastaviš bez tog uslova.' };
        return { ok: true, value: true, displayValue: 'Da' };
      }
      if (['ne', 'no', 'false', '0'].includes(normalized)) {
        return { ok: true, value: false, displayValue: 'Ne' };
      }
      return { ok: false, message: 'Unesi „da“ ili „ne“.' };
    }
    case 'TEXT_ARRAY': {
      if (text.startsWith('[')) {
        try {
          const values = capabilityTerms(JSON.parse(text));
          const display = values?.length ? Array.from(values.join(', ')).slice(0, 1000).join('') : 'Nema navedenih stavki';
          return values ? { ok: true, value: values, displayValue: display }
            : { ok: false, message: 'Proveri listu: najviše 50 stavki, do 500 znakova po stavci.' };
        } catch { return { ok: false, message: 'Lista nije ispravna. Proveri navodnike i zagrade.' }; }
      }
      const values = capabilityTerms(text.split(',').map((item) => item.trim()).filter(Boolean));
      if (!values?.length) return { ok: false, message: 'Unesi najviše 50 stavki, do 500 znakova po stavci.' };
      return { ok: true, value: values, displayValue: values.join(', ') };
    }
    case 'TIMESTAMPTZ': {
      // Existing canonical instants remain byte-identical after strict validation,
      // including their explicit offset and microseconds. Never reinterpret them
      // in the device zone.
      if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
        return calendarInstant(text) !== null ? { ok: true, value: text, displayValue: text }
          : { ok: false, message: 'Termin nije ispravan. Proveri datum, vreme i vremensku zonu.' };
      }
      // Manual civil input is intentionally narrow and uses the same explicit
      // zone shown by review. Date.parse is forbidden here because its meaning
      // depends on the host zone and it silently normalizes impossible dates.
      const civil = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/.exec(text);
      if (!civil) return { ok: false, message: 'Termin unesi kao GGGG-MM-DD HH:MM ili kao ISO vreme sa zonom.' };
      const resolved = civilInstant(civil[1], civil[2], REVIEW_TIMEZONE);
      return resolved.value ? { ok: true, value: resolved.value, displayValue: text }
        : { ok: false, message: resolved.error ?? 'Termin nije ispravan.' };
    }
    case 'ENUM': {
      const normalized = text.toLocaleLowerCase('sr-Latn-RS');
      if (fact.key === 'need.price_mode') {
        const value = PRICE_MODE[normalized] ?? text.toUpperCase();
        if (!['MY_PRICE', 'OFFERS'].includes(value)) {
          return { ok: false, message: 'Koristiš: moja cena ili ponude.' };
        }
        return { ok: true, value, displayValue: text };
      }
      if (fact.key === 'need.price_basis') {
        const value = PRICE_BASIS[normalized] ?? text.toUpperCase();
        if (!['TOTAL', 'PER_PERSON'].includes(value)) {
          return { ok: false, message: 'Koristiš: ukupno ili po osobi.' };
        }
        return { ok: true, value, displayValue: text };
      }
      if (fact.key === 'need.schedule_kind') {
        const value = SCHEDULE_KIND[normalized] ?? text.toUpperCase();
        if (!['FIXED_WINDOW', 'FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'].includes(value)) {
          return { ok: false, message: 'Termin izmeni prirodnim jezikom kroz razgovor.' };
        }
        return { ok: true, value, displayValue: text };
      }
      return { ok: true, value: text, displayValue: text };
    }
    case 'OBJECT':
      return { ok: false, message: 'Lokaciju izmeni kroz razgovor da bi struktura ostala bezbedna.' };
    case 'TEXT':
    default:
      if (fact.key === 'need.task_country_code') {
        const value = countryCode(text);
        return value ? { ok: true, value, displayValue: value } : { ok: false, message: 'Unesi dvoslovnu oznaku države, npr. RS.' };
      }
      const max = TEXT_MAX[fact.key];
      if (max && Array.from(text).length > max) return { ok: false, message: `Najviše ${max.toLocaleString('sr-Latn-RS')} znakova.` };
      return { ok: true, value: text, displayValue: displayOf(text) };
  }
}

export function safetyMessage(safety: AiNeedSafety): string | null {
  switch (safety) {
    case 'BLOCK':
      return 'Ovaj zahtev ne može da nastavi kroz AI unos.';
    case 'REVIEW':
      return 'Zahtev traži dodatnu proveru pre objavljivanja. Nacrt možeš pregledati i sačuvati.';
    case 'CLARIFY':
      return 'AI još razjašnjava važan podatak. Odgovori u razgovoru pre završnog pregleda.';
    case 'ALLOW':
    default:
      return null;
  }
}
