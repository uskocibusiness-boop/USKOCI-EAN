import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type Input = {
  conversationKey?: string;
  streamingText?: string;
  sentMessage?: string | null;
  pending: boolean;
  /** Only the authoritative, completed conversation rows belong here. */
  messages: readonly { id: string; fromAi: boolean; body?: string }[];
  /** The live row is on screen as "USKOČI piše…" (dots) for this turn. */
  typing?: boolean;
};
type Memory = {
  /** Reveal identity: a new object means the paced text starts again from nothing. */
  owner: object;
  key: string | undefined; sent: string | null; pending: boolean;
  /** Last assistant row when this turn began; a different one is this turn's completed reply. */
  baseline: string | undefined;
  received: string; target: string;
  /** The live row (dots or text) was drawn for this turn, so its completed reply continues in that row. */
  live: boolean;
  committedId: string | null;
  /** A completed reply arrived without a live row (history): no stream belongs to this turn any more. */
  ended: boolean;
};
export type StreamDisplay = {
  /** Identity of this turn's reveal; a new object starts the paced text from nothing. */
  owner: object;
  /** Received, Unicode-safe text of this turn (stream prefix, or the completed reply that took the row over). */
  text: string;
  /** The completed assistant row that now owns the live row, drawn in the same place without remounting. */
  committedId: string | null;
};
type GraphemeSegmenter = { segment(text: string): Iterable<{ index: number }> };

// Hermes versions without Segmenter use the conservative word boundary below.
// No polyfill or provider call is needed for a preview.
let segmenter: GraphemeSegmenter | null = null;
try {
  const Constructor = (Intl as unknown as { Segmenter?: new (locale: string, options: { granularity: 'grapheme' }) => GraphemeSegmenter }).Segmenter;
  if (Constructor) segmenter = new Constructor('sr', { granularity: 'grapheme' });
} catch { /* Word boundaries remain available when Intl/Segmenter is absent. */ }

// A boundary after ASCII whitespace and before an ordinary Serbian/ASCII
// character cannot split a grapheme.
const SAFE_AFTER_SPACE = /[!-~ČĆŠĐŽčćšđžА-Яа-яЂЈЉЊЋЏђјљњћџ]/;
const SPACE = /[ \t\r\n]/;

/**
 * The final grapheme may still receive a combining mark, skin tone or ZWJ
 * continuation in the next delta. Keep it pending until another grapheme
 * arrives. The canonical message, never a timer, exposes the final tail.
 */
export function stableStreamPrefix(raw: string): string {
  // Transport chunks may end between UTF-16 surrogates. Do not expose a lone
  // surrogate, even when a platform segmenter would accept it as a character.
  let validEnd = 0;
  while (validEnd < raw.length) {
    const unit = raw.charCodeAt(validEnd);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = raw.charCodeAt(validEnd + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) break;
      validEnd += 2;
    } else {
      if (unit >= 0xdc00 && unit <= 0xdfff) break;
      validEnd++;
    }
  }
  const valid = raw.slice(0, validEnd);
  if (segmenter) {
    try {
      let end = 0;
      for (const part of segmenter.segment(valid)) end = part.index;
      return valid.slice(0, end);
    } catch { /* Keep the same safe fallback if this runtime cannot segment. */ }
  }
  // Hold the unfinished word rather than approximate the Unicode algorithm.
  // Emoji-only/other-script tails wait for a safe next word or the complete
  // canonical message; CRLF stays intact.
  const boundaries = /[ \t\r\n]+(?=[!-~ČĆŠĐŽčćšđžА-Яа-яЂЈЉЊЋЏђјљњћџ])/g;
  let end = 0, match: RegExpExecArray | null;
  while ((match = boundaries.exec(valid))) end = match.index + match[0].length;
  return valid.slice(0, end);
}

/**
 * Owner, 23.11.2026: the sentence used to stop before its last word until the server had saved the whole turn (a second
 * or two), because the last word waits for a following character. When the stream has been quiet for a moment and
 * the last character is an ordinary letter, digit or punctuation mark (never an emoji, joiner or combining mark that
 * could still grow), the whole received text is safe to show.
 */
export const STREAM_QUIET_MS = 300;
const PLAIN_LAST = /[\p{Script=Latin}\p{Script=Cyrillic}\p{Nd}\p{P}\p{Zs}]$/u;
export function quietStreamText(raw: string): string {
  const stable = stableStreamPrefix(raw);
  const last = raw.codePointAt(raw.length - 1);
  if (last === undefined || (last >= 0xd800 && last <= 0xdfff)) return stable;
  return PLAIN_LAST.test(raw) ? raw : stable;
}

/**
 * Positions where a paced reveal may stop: the start of each next word (after
 * whitespace) when that position is also a grapheme boundary, and the end.
 * `text` must already be safe to show whole (a stable prefix or a completed message).
 */
export function revealBoundaries(text: string): number[] {
  const out: number[] = [];
  let graphemes: Set<number> | null = null;
  if (segmenter) {
    try { graphemes = new Set(Array.from(segmenter.segment(text), part => part.index)); } catch { graphemes = null; }
  }
  for (let i = 1; i < text.length; i++) {
    if (!SPACE.test(text[i - 1]) || SPACE.test(text[i])) continue;
    if (graphemes ? graphemes.has(i) : SAFE_AFTER_SPACE.test(text[i])) out.push(i);
  }
  if (text.length) out.push(text.length);
  return out;
}

/**
 * About one word every 32 ms. A reply that arrives whole is written out evenly over up to ~1.2 s, not dropped as a block (owner, 26.11.2026). What still waits never needs more than that: when more arrived at once,
 * the excess is caught up within a few frames (about a quarter of it per frame), so a burst reads as fast streaming, not as a block or a lag.
 */
export const REVEAL_PACE = { wordMs: 32, maxLagMs: 1200, frameMs: 16, catchUpFrames: 4 } as const;

/**
 * What a render may show for `target`, given what was shown before (`previous`).
 * Never beyond `target`. Reduced motion shows all of it. The first word appears
 * at once (no extra wait after the dots). A completed reply that contradicts the
 * shown preview replaces it in one direct swap; a provisional target never shrinks it.
 */
export function resolveReveal(target: string, previous: string, options: { reduced: boolean; committed: boolean }): string {
  if (!target) return '';
  if (options.reduced) return target;
  if (previous && target.startsWith(previous)) return previous;
  if (previous && !options.committed) {
    // Defensive only (received text is append-only): keep the longest still-valid word prefix.
    const kept = revealBoundaries(target).filter(end => previous.startsWith(target.slice(0, end))).at(-1);
    if (kept) return target.slice(0, kept);
  }
  // A different completed reply: one swap to the whole text, no retyping of words already read.
  if (previous) return target;
  return target.slice(0, revealBoundaries(target)[0]);
}

/** Advance a reveal by `elapsedMs`; `carry` is the fractional word budget kept between frames. */
export function advanceReveal(target: string, shown: string, elapsedMs: number, carry = 0): { text: string; carry: number } {
  if (!target.startsWith(shown)) return { text: shown, carry: 0 };
  const ahead = revealBoundaries(target).filter(end => end > shown.length);
  if (!ahead.length) return { text: shown, carry: 0 };
  const budget = carry + Math.max(0, elapsedMs) / REVEAL_PACE.wordMs;
  let words = Math.floor(budget);
  const excess = ahead.length - Math.floor(REVEAL_PACE.maxLagMs / REVEAL_PACE.wordMs);
  const frames = Math.max(1, (Math.max(0, elapsedMs) || REVEAL_PACE.frameMs) / REVEAL_PACE.frameMs);
  if (excess > 0) words = Math.max(words, Math.ceil(excess * Math.min(1, frames / REVEAL_PACE.catchUpFrames)));
  words = Math.min(ahead.length, words);
  if (words <= 0) return { text: shown, carry: budget };
  return { text: target.slice(0, ahead[words - 1]), carry: words === ahead.length ? 0 : Math.max(0, budget - words) };
}

/**
 * Paces `target` word by word on animation frames. Only the component that
 * draws the text re-renders, at most once per frame and only when a word is
 * added; the loop stops as soon as it has caught up. A new `owner` starts from nothing.
 */
export function usePacedReveal(owner: object, target: string, options: { reduced: boolean; committed: boolean }): string {
  const [paced, setPaced] = useState<{ owner: object; text: string }>(() => ({ owner, text: '' }));
  const shown = resolveReveal(target, paced.owner === owner ? paced.text : '', options);
  const latest = useRef({ owner, target, shown });
  const loop = useRef<{ frame: number | null; last: number | null; carry: number }>({ frame: null, last: null, carry: 0 });
  useLayoutEffect(() => { latest.current = { owner, target, shown }; });
  // What was shown (first word, a reduced-motion whole text, a swap) becomes the base of the next render, so turning
  // reduced motion off again, or any later render, can never retract it.
  const stale = paced.owner !== owner || paced.text !== shown;
  useEffect(() => { if (stale) setPaced({ owner, text: shown }); }, [stale, owner, shown]);
  useEffect(() => {
    const clock = loop.current;
    if (options.reduced || shown === target || !target.startsWith(shown)) {
      if (clock.frame !== null) cancelAnimationFrame(clock.frame);
      clock.frame = null; clock.last = null; clock.carry = 0;
      return;
    }
    if (clock.frame !== null) return;
    const tick = (time: number) => {
      clock.frame = null;
      const now = latest.current;
      // Constant/unknown frame stamps still advance by one frame; a restarted loop never "catches up" a pause.
      const elapsed = clock.last !== null && time > clock.last ? time - clock.last : REVEAL_PACE.frameMs;
      clock.last = time;
      const step = advanceReveal(now.target, now.shown, elapsed, clock.carry);
      clock.carry = step.carry;
      if (step.text !== now.shown) setPaced({ owner: now.owner, text: step.text });
      else if (now.shown !== now.target) clock.frame = requestAnimationFrame(tick);
    };
    clock.frame = requestAnimationFrame(tick);
  }, [owner, target, shown, options.reduced]);
  useEffect(() => () => {
    if (loop.current.frame !== null) cancelAnimationFrame(loop.current.frame);
    loop.current.frame = null;
  }, []);
  return shown;
}

/**
 * Presentation only: which received text belongs to the live assistant row and
 * which completed row has taken that row over. Real deltas only; a readback row
 * always wins. Pacing happens where the text is drawn (usePacedReveal).
 */
export function useStreamDisplay(input: Input): StreamDisplay {
  const memory = useRef<Memory | null>(null);
  const raw = input.streamingText ?? '';
  // Which received text has been quiet long enough to show whole (see quietStreamText).
  const [quiet, setQuiet] = useState<string | null>(null);
  useEffect(() => {
    if (!raw) return;
    const timer = setTimeout(() => setQuiet(raw), STREAM_QUIET_MS);
    return () => clearTimeout(timer);
  }, [raw]);
  const sent = input.sentMessage?.trim() || null;
  const lastAi = input.messages.findLast(message => message.fromAi);
  const previous = memory.current;
  // Callers already clear their stream on abort, retry and account teardown.
  // A new sent draft or a fresh pending turn also separates back-to-back turns.
  const replace = !previous || previous.key !== input.conversationKey
    || (sent !== null && sent !== previous.sent) || (input.pending && !previous.pending);
  let next: Memory = replace
    ? { owner: {}, key: input.conversationKey, sent, pending: input.pending, baseline: lastAi?.id, received: '', target: '',
        live: false, committedId: null, ended: false }
    : { ...previous, pending: input.pending };
  // Nothing of this turn is on screen yet: loaded or refreshed history only moves the baseline.
  if (!next.live && !next.received && !next.committedId && !next.ended) next.baseline = lastAi?.id;
  if (!next.committedId && !next.ended && lastAi && lastAi.id !== next.baseline) {
    // The reply of a turn whose row is on screen continues in that row; anything else is ordinary history.
    const takesOver = next.live && input.messages.at(-1)?.id === lastAi.id && !!lastAi.body?.trim();
    next = takesOver ? { ...next, committedId: lastAi.id, received: '', target: '' }
      : { ...next, ended: true, received: '', target: '', owner: {} };
  } else if (!next.committedId && !next.ended) {
    if (!raw) {
      // An explicit clear (abort, refusal, retry) drops the preview; new text starts a fresh reveal.
      if (next.received) next = { ...next, received: '', target: '', owner: {} };
    } else if (raw !== next.received && raw.startsWith(next.received)) {
      const target = stableStreamPrefix(raw);
      // A truncated/replaced provider snapshot cannot erase already visible
      // words. It stays a preview until its canonical readback or explicit clear.
      if (target.startsWith(next.target)) next = { ...next, received: raw, target };
    } else if (quiet === raw && raw === next.received) {
      const whole = quietStreamText(raw);
      if (whole !== next.target && whole.startsWith(next.target)) next = { ...next, target: whole };
    }
  }
  const text = next.committedId ? input.messages.find(message => message.id === next.committedId)?.body ?? '' : next.target;
  if (!next.live && (text || input.typing)) next = { ...next, live: true };
  // Commit bookkeeping only after React commits this render. StrictMode or an
  // abandoned render cannot consume the next turn or overwrite visible text.
  const settled = next;
  useLayoutEffect(() => { memory.current = settled; });
  return { owner: next.owner, text, committedId: next.committedId };
}
