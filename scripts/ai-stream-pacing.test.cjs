'use strict';
// Paced reveal of received AI text (src/ui/aiFirst/useStreamDisplay.ts): pure pacing rules on the real source,
// with and without Intl.Segmenter. No renderer, provider or network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'src/ui/aiFirst/useStreamDisplay.ts');

function load({ withoutSegmenter = false } = {}) {
  const js = ts.transpileModule(fs.readFileSync(FILE, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', 'Intl', js)(mod, mod.exports, id => require(id), withoutSegmenter ? {} : Intl);
  return mod.exports;
}
const graphemeEnds = text => new Set([...new Intl.Segmenter('sr', { granularity: 'grapheme' }).segment(text)].map(p => p.index).concat(text.length));
const REPLY = 'Razumem, treba Vam pomoć oko selidbe sutra ujutru. Koliko ima stvari i da li zgrada ima lift? Hvala.';

for (const withoutSegmenter of [false, true]) {
  const m = load({ withoutSegmenter });
  const label = withoutSegmenter ? 'Hermes fallback' : 'Intl.Segmenter';

  test(`reveal stops only at word starts that are grapheme boundaries (${label})`, () => {
    for (const text of [REPLY, 'Čao č 🧑🏽‍🚀 порука 🇷🇸 1️⃣ kraj.', 'Negde ́tekst i kraj.', 'A\r\nB 👩🏾‍❤️‍💋‍👩🏻 end.']) {
      const ends = graphemeEnds(text), bounds = m.revealBoundaries(text);
      assert.equal(bounds.at(-1), text.length);
      for (const end of bounds) assert.ok(ends.has(end), `${JSON.stringify(text.slice(0, end))} splits a grapheme`);
      if (text.startsWith('Negde')) assert.ok(!bounds.includes('Negde '.length), 'a combining mark after a space stays with it');
    }
  });

  test(`steady pace, never ahead of received text, and it stops when caught up (${label})`, () => {
    let shown = m.resolveReveal(REPLY, '', { reduced: false, committed: false }), carry = 0, time = 0;
    assert.equal(shown, 'Razumem, ', 'the first word replaces the dots at once');
    const words = m.revealBoundaries(REPLY).length;
    while (shown !== REPLY) {
      const step = m.advanceReveal(REPLY, shown, 16, carry); time += 16;
      assert.ok(REPLY.startsWith(step.text) && step.text.startsWith(shown), 'append only, within the target');
      shown = step.text; carry = step.carry;
      assert.ok(time < 5000);
    }
    // ~32 ms per word for a short reply, bounded by the 600 ms catch-up rule.
    assert.ok(time >= Math.min(m.REVEAL_PACE.maxLagMs, (words - 1) * 25) - 32, `too fast: ${time} ms for ${words} words`);
    assert.ok(time <= m.REVEAL_PACE.maxLagMs + 32, `lags: ${time} ms`);
    assert.deepEqual(m.advanceReveal(REPLY, REPLY, 16, 0), { text: REPLY, carry: 0 });
  });

  test(`a far-behind reveal speeds up to stay within ~600 ms (${label})`, () => {
    const long = Array.from({ length: 120 }, (_, i) => `reč${i}`).join(' ') + '.';
    let shown = m.resolveReveal(long, '', { reduced: false, committed: false }), carry = 0, time = 0;
    const maxWaiting = Math.floor(m.REVEAL_PACE.maxLagMs / m.REVEAL_PACE.wordMs);
    while (shown !== long) {
      const step = m.advanceReveal(long, shown, 16, carry); shown = step.text; carry = step.carry; time += 16;
      const waiting = m.revealBoundaries(long).filter(end => end > shown.length).length;
      if (time >= 250) assert.ok(waiting <= maxWaiting, `${waiting} words still wait after ${time} ms`);
      assert.ok(long.startsWith(step.text));
    }
    assert.ok(time <= m.REVEAL_PACE.maxLagMs + 200, `120 words took ${time} ms`);
    assert.ok(time >= m.REVEAL_PACE.maxLagMs - 64, 'a burst is still revealed, not dumped at once');
    // Text arriving while revealing: the target grows, the shown text only grows within it.
    let target = 'Prva reč ', s = m.resolveReveal(target, '', { reduced: false, committed: false });
    for (const more of ['druga ', 'treća i četvrta ', 'peta.']) {
      target += more;
      const step = m.advanceReveal(target, s, 16, 0);
      assert.ok(target.startsWith(step.text) && step.text.startsWith(s)); s = step.text;
    }
  });

  test(`final reply continues from the preview, or swaps once when it differs; reduced motion is immediate (${label})`, () => {
    const preview = 'Razumem, treba Vam ';
    assert.equal(m.resolveReveal(REPLY, preview, { reduced: false, committed: true }), preview, 'continues, no snap to the end');
    const other = 'Pregled još nije spreman.';
    assert.equal(m.resolveReveal(other, preview, { reduced: false, committed: true }), other, 'one direct swap, no retyping');
    assert.equal(m.resolveReveal(REPLY, '', { reduced: true, committed: false }), REPLY);
    assert.equal(m.resolveReveal(REPLY, preview, { reduced: true, committed: true }), REPLY);
    assert.equal(m.resolveReveal('', preview, { reduced: false, committed: false }), '');
    // A provisional target never shrinks what is shown.
    assert.equal(m.resolveReveal('Razumem, treba Vam pomoć', 'Razumem, treba ', { reduced: false, committed: false }), 'Razumem, treba ');
  });
}
