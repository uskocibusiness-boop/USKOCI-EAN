// Deterministic last line before a public task title/description is stored.
// The model is asked not to write contacts or exact addresses; this guard does
// not trust that. It removes phone numbers, e-mail, links/handles and the house
// number after a street name, and reports what it removed so the reply can say so.

const PHONE = /(?<![\p{L}\p{N}])(?:\+|00)?\d(?:[\s./-]?\d){5,13}(?![\p{L}\p{N}])/gu;
const DATE = /^\d{1,2}\.\s?\d{1,2}\.\s?(?:\d{2,4}\.?)?$/u;
const AMOUNT_AFTER = /^\s*(?:rsd|din\p{L}*|дин\p{L}*|eur\p{L}*|€|evr\p{L}*|m2|m²|km|kg)(?!\p{L})/iu;
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
const LINK = /(?:https?:\/\/|www\.)\S+|\b[\p{L}\p{N}-]+\.(?:rs|com|net|org|me|info|io)(?:\/\S*)?\b/giu;
const HANDLE = /(?<![\p{L}\p{N}])@[\p{L}\p{N}_.]{3,30}/gu;
const STREET_WORD = '(?:[Uu]lic[aeiu]|[Uu]l\\.|[Bb]ulevar\\p{L}*|[Bb]ul\\.|[Tt]rg\\p{L}*|[Ss]okak\\p{L}*|[Nn]aselj\\p{L}*)';
// Capitalized words that start dates, times and amounts, never a street.
const NOT_STREET = '(?!(?:Za|Do|Od|Oko|Posle|Pre|Ukupno|Cena|Danas|Sutra|Prekosutra|Ponedeljak|Utorak|Sred[au]|Četvrtak|Petak'
  + '|Subot\\p{L}*|Nedelj\\p{L}*|Januar\\p{L}*|Februar\\p{L}*|Mart\\p{L}*|April\\p{L}*|Maj\\p{L}*|Jun\\p{L}*|Jul\\p{L}*'
  + '|Avgust\\p{L}*|Septemb\\p{L}*|Oktob\\p{L}*|Novemb\\p{L}*|Decemb\\p{L}*)(?!\\p{L}))';
// "Lenke Dunđerski 11", "Dositejevoj 12a", "ulica Cara Dušana 5": a capitalized
// name (or a street word) directly followed by a number that ends the phrase.
// Counts such as "5 strana", "4 momka" or times "17h" never match.
const NAME = NOT_STREET + '\\p{Lu}[\\p{L}.]*(?:\\s+\\p{Lu}[\\p{L}.]*){0,3}';
const HOUSE = new RegExp(
  `((?:${STREET_WORD}\\s+)?${NAME}|${STREET_WORD}\\s+[\\p{L}.]+(?:\\s+[\\p{L}.]+){0,3})\\s+(?:br\\.?\\s*)?\\d{1,4}(?:\\s?[a-dA-D])?(?:\\/\\d{1,3})?(?=\\s*(?:$|[,;:!?)]|\\.(?!\\d)|\\s(?:u|na|do|iz|i|ka|kod|pa|a|ili)\\s))`,
  'gu');

// A model or product number ("iPhone 16", "Golf 7", "PS 5") is not an address:
// the number is dropped only after a street word or a typical street-name ending.
const STREET_START = new RegExp(`^${STREET_WORD}(?!\\p{L})`, 'u');
const STREET_ENDING = /(?:ov|ev|in|sk|ck|čk|ičk)(?:a|e|i|u|oj|om)$|(?:ski|ćeva|ića|ina)$/u;
const NOT_A_STREET = /^(?:ajfon|iphone|ipad|samsung|galaxy|xiaomi|redmi|huawei|honor|nokia|pixel|golf|passat|audi|bmw|opel|fiat|škoda|skoda|playstation|ps|xbox|windows|android|ikea|tesla|yugo|zastava)$/iu;
const looksLikeStreet = street => {
  const words = street.replace(/\s+br\.?$/u, '').trim().split(/\s+/u);
  if (words.some(word => NOT_A_STREET.test(word))) return false;
  return STREET_START.test(street) || STREET_ENDING.test(words.at(-1).toLocaleLowerCase('sr-Latn-RS'));
};

const tidy = text => text.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/([,;:])\1+/g, '$1').trim();

export function scrubPublicText(value) {
  if (typeof value !== 'string' || !value) return { text: value, removed: [] };
  const removed = new Set();
  let text = value;
  const take = (pattern, kind, replacement = '') => {
    text = text.replace(pattern, (...match) => { removed.add(kind); return typeof replacement === 'function' ? replacement(...match) : replacement; });
  };
  take(EMAIL, 'CONTACT');
  take(LINK, 'CONTACT');
  take(HANDLE, 'CONTACT');
  // A phone is digits that are not a date, time, amount or count: at least 6 digits.
  take(PHONE, 'CONTACT', (match, offset, whole) => (match.replace(/\D/g, '').length >= 6 && !DATE.test(match.trim())
    && !AMOUNT_AFTER.test(whole.slice(offset + match.length)) ? '' : match));
  if (text === value) removed.delete('CONTACT');
  const beforeHouse = text;
  take(HOUSE, 'EXACT_ADDRESS', (match, street) => (looksLikeStreet(street) ? street.replace(/\s+br\.?$/u, '') : match));
  if (text === beforeHouse) removed.delete('EXACT_ADDRESS');
  return { text: removed.size ? tidy(text) : value, removed: [...removed] };
}

export function publicTextPrivacyNotice(removed) {
  const parts = [];
  if (removed.includes('EXACT_ADDRESS')) parts.push('Tačnu adresu sam izostavio iz javnog opisa; vidi je samo osoba sa kojom se dogovorite.');
  if (removed.includes('CONTACT')) parts.push('Broj telefona i druge kontakte ne objavljujemo; razmenjujete ih u porukama posle Dogovora.');
  return parts.join(' ');
}

/** Scrubs need.title/need.description proposals; returns the turn and what was removed. */
export function scrubPublicTaskProposals(turn) {
  if (!turn || !Array.isArray(turn.proposals)) return { turn, removed: [] };
  const removed = new Set();
  const proposals = turn.proposals.map(proposal => {
    if (!['need.title', 'need.description'].includes(proposal?.key) || typeof proposal.value !== 'string') return proposal;
    const scrubbed = scrubPublicText(proposal.value);
    if (!scrubbed.removed.length) return proposal;
    scrubbed.removed.forEach(kind => removed.add(kind));
    const scrubbedDisplay = typeof proposal.displayValue === 'string' ? scrubPublicText(proposal.displayValue).text.trim() : '';
    // The database rejects an empty display value; fall back to the scrubbed value.
    const display = scrubbedDisplay || scrubbed.text;
    return { ...proposal, value: scrubbed.text, displayValue: display };
  }).filter(proposal => !(['need.title', 'need.description'].includes(proposal?.key) && typeof proposal.value === 'string' && !proposal.value.trim()));
  if (!removed.size) return { turn, removed: [] };
  const notice = publicTextPrivacyNotice([...removed]);
  const message = typeof turn.assistantMessage === 'string' ? turn.assistantMessage.trim() : '';
  return { turn: { ...turn, proposals, assistantMessage: message.includes(notice) ? message : tidy(`${notice} ${message}`) }, removed: [...removed] };
}
