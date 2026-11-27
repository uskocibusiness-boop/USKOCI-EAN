/** Incremental, bounded reader of the top-level `assistantMessage` JSON string in a
 * streamed provider response. It never parses other values, never returns raw JSON
 * and never splits a UTF-16 surrogate pair across deltas. The decoded concatenation
 * of all deltas equals `JSON.parse(raw).assistantMessage` for a valid response.
 * This is only provisional display input: guards, SQL and the final receipt own the
 * canonical message. */
export const ASSISTANT_MESSAGE_MAX_CHARS = 1200;

const SIMPLE_ESCAPES: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
// Same closed set as the final validator: TAB/LF/CR may be escaped, other C0/DEL may not.
const FORBIDDEN_DECODED = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function createAssistantMessageExtractor(maxChars = ASSISTANT_MESSAGE_MAX_CHARS) {
  let depth = 0, inString = false, stringIsKey = false, escape = false;
  let key = '', currentKey: string | null = null, expectingValue = false;
  let capturing = false, done = false, unicode: string | null = null;
  let pendingHigh = '', length = 0;
  const invalid = () => { throw new Error('AI_STREAM_INVALID'); };

  const decodedUnit = (unit: string, out: string[]) => {
    const code = unit.charCodeAt(0);
    if (pendingHigh) {
      const high = pendingHigh; pendingHigh = '';
      if (code >= 0xdc00 && code <= 0xdfff) { out.push(high + unit); length += 2; return; }
      // A lone high surrogate stays exactly as the provider decoded it; display
      // code withholds it. Changing it here would contradict JSON.parse.
      out.push(high); length += 1;
    }
    if (code >= 0xd800 && code <= 0xdbff) { pendingHigh = unit; return; }
    if (FORBIDDEN_DECODED.test(unit)) invalid();
    out.push(unit); length += 1;
  };

  /** Returns newly decoded assistantMessage text (possibly empty). */
  const push = (chunk: string): string => {
    if (done || !chunk) return '';
    const out: string[] = [];
    for (let i = 0; i < chunk.length && !done; i++) {
      const char = chunk[i];
      if (inString) {
        if (unicode !== null) {
          if (!/^[0-9a-f]$/i.test(char)) invalid();
          unicode += char;
          if (unicode.length === 4) {
            const unit = String.fromCharCode(parseInt(unicode, 16)); unicode = null;
            if (capturing) decodedUnit(unit, out); else if (stringIsKey) key += unit;
          }
          continue;
        }
        if (escape) {
          escape = false;
          if (char === 'u') { unicode = ''; continue; }
          if (!Object.hasOwn(SIMPLE_ESCAPES, char)) invalid();
          if (capturing) decodedUnit(SIMPLE_ESCAPES[char], out); else if (stringIsKey) key += SIMPLE_ESCAPES[char];
          continue;
        }
        if (char === '\\') { escape = true; continue; }
        if (char === '"') {
          inString = false;
          if (capturing) {
            if (pendingHigh) { out.push(pendingHigh); length += 1; pendingHigh = ''; }
            capturing = false; done = true;
          } else if (stringIsKey) currentKey = key;
          continue;
        }
        if (char.charCodeAt(0) < 32) invalid();
        if (capturing) decodedUnit(char, out); else if (stringIsKey) key += char;
        if (length > maxChars) invalid();
        continue;
      }
      if (char === '"') {
        inString = true; escape = false; unicode = null;
        capturing = depth === 1 && expectingValue && currentKey === 'assistantMessage';
        stringIsKey = depth === 1 && !expectingValue;
        if (stringIsKey) key = '';
        continue;
      }
      if (char === '{' || char === '[') depth++;
      else if (char === '}' || char === ']') { depth--; if (depth < 0) invalid(); }
      else if (depth === 1 && char === ':') expectingValue = true;
      else if (depth === 1 && char === ',') { currentKey = null; expectingValue = false; }
    }
    if (length > maxChars) invalid();
    return out.join('');
  };
  return { push, complete: () => done };
}

/** Compatibility helper: the decoded prefix of assistantMessage in `input`. */
export function assistantMessagePrefix(input: string): string {
  const extractor = createAssistantMessageExtractor();
  return extractor.push(input);
}

// Provisional text is never authoritative. Stop the preview (the final still
// replaces it) as soon as text could state money, an exact address or a completed
// save/publication that later guards may contradict or rewrite.
// JavaScript word boundaries are ASCII-only, so Cyrillic/diacritic edges use lookarounds.
const CURRENCY = /(?<![\p{L}\p{N}])(?:rsd|din|eur|eura|euro|usd|chf|рсд|дин)(?![\p{L}\p{N}])|din\.|dinar|динар|(?<![\p{L}\p{N}])(?:evr|евр)|€|\$/iu;
const NUMBER_WORDS = /hiljad|хиљад|stotin|стотин|milion|милион/iu;
const PRICE_WITH_NUMBER = /(?:cen[aeiu]|цен[аеиу]|budžet|budzet|буџет|iznos|износ|honorar|хонорар|satnic|сатниц|plać|plac|плаћ|po satu|по сату)[^.!?\n]{0,40}\p{N}|\p{N}[^.!?\n]{0,40}(?:cen[aeiu]|цен[аеиу]|budžet|budzet|буџет|iznos|износ|honorar|хонорар|satnic|сатниц|po satu|по сату)/iu;
const STREET_WITH_NUMBER = /(?<![\p{L}\p{N}])(?:ulic|улиц|ul\.|ул\.|bulevar|булевар|bul\.|trg|трг|adres|адрес|broj|број|br\.|бр\.)[^.!?\n]{0,40}\p{N}|(?<![\p{L}\p{N}])(?:bb|бб)(?![\p{L}\p{N}])/iu;
// Case-sensitive on purpose: a capitalized name followed by a short house number
// ("Takovska 12", "Булевар ослобођења 5а"), unless the number is a time/quantity.
const NAME_WITH_HOUSE_NUMBER = /(?<![\p{L}\p{N}])\p{Lu}\p{Ll}+(?:\s+\p{Ll}+)?\s+\p{N}{1,4}\p{Ll}?(?![\p{N}.:,])(?!\s*(?:h|č|ч|sat|сат|min|мин|godin|годин|dan|дан|ljud|људ|osob|особ|radnik|радник|m2|m²|kvadrat|квадрат|km|км|kg|кг|%))/u;
const COMPLETED_CLAIM = /objavlj|објављ|sačuvan|sacuvan|сачуван|aktivir|активир/iu;
const DIGIT = /\p{N}/u, SPACE = /\s/u, CONTEXT_AFTER_DIGIT = /^\S*\s+\S+\s+\S+\s/u;

export function provisionalTextSensitive(text: string): boolean {
  return CURRENCY.test(text) || NUMBER_WORDS.test(text) || PRICE_WITH_NUMBER.test(text)
    || STREET_WITH_NUMBER.test(text) || NAME_WITH_HOUSE_NUMBER.test(text) || COMPLETED_CLAIM.test(text);
}

/** Every number in a text, written the same way however it was grouped ("3.000", "3 000" and "3000" are one number). */
function numbersIn(text: string): string[] {
  return (text.match(/\p{N}(?:[\p{N}]|[.,\u00a0 ](?=\p{N}{3}(?!\p{N})))*/gu) ?? []).map(token => token.replace(/[^\p{N}]/gu, ''));
}

/**
 * Owner, 27.11.2026: a reply that repeats what the person already said (their amount, their house number, their square metres)
 * may flow as it is written. Only a number the person never said, an amount in words they never used, or a claim that something
 * was published or saved still stops the preview; the final, guarded message still replaces it.
 */
export function provisionalTextSensitiveGiven(text: string, said: string): boolean {
  if (COMPLETED_CLAIM.test(text)) return true;
  const known = new Set(numbersIn(said));
  if (numbersIn(text).some(number => !known.has(number))) return true;
  return NUMBER_WORDS.test(text) && !NUMBER_WORDS.test(said);
}

/** Converts raw assistantMessage deltas into provisional display deltas.
 * Only complete whitespace-terminated words are released; a word containing a
 * digit waits for two following complete words so currency/street context is
 * known. Once anything sensitive appears, the gate latches closed for the turn. */
export function createProvisionalTextGate(maxChars = ASSISTANT_MESSAGE_MAX_CHARS, said?: string) {
  let all = '', emitted = 0, closed = false;
  const sensitive = typeof said === 'string' ? (text: string) => provisionalTextSensitiveGiven(text, said) : provisionalTextSensitive;
  return {
    push(delta: string): string {
      if (closed || typeof delta !== 'string' || !delta) return '';
      all += delta;
      if (all.length > maxChars || FORBIDDEN_DECODED.test(all) || sensitive(all)) { closed = true; return ''; }
      let end = -1;
      for (let i = all.length - 1; i >= emitted; i--) if (SPACE.test(all[i])) { end = i + 1; break; }
      if (end <= emitted) return '';
      // Every digit needs its own word plus two complete following words; the
      // first digit without that context holds back its whole word and the rest.
      for (let i = emitted; i < end; i++) {
        if (!DIGIT.test(all[i]) || CONTEXT_AFTER_DIGIT.test(all.slice(i))) continue;
        let wordStart = i;
        while (wordStart > emitted && !SPACE.test(all[wordStart - 1])) wordStart--;
        end = wordStart;
        break;
      }
      if (end <= emitted) return '';
      const out = all.slice(emitted, end); emitted = end;
      return out;
    },
    /** The provider paused after the last word (usually the end of the message, while it writes the facts): release
     * that last word too, unless the gate is closed or the tail holds a digit that still waits for its context. */
    flush(): string {
      if (closed || emitted >= all.length) return '';
      const tail = all.slice(emitted);
      if (DIGIT.test(tail)) return '';
      emitted = all.length;
      return tail;
    },
    closed: () => closed,
  };
}
