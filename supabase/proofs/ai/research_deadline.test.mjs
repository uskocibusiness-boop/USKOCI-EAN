import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function clock(now) {
  const timers = new Map(); let sequence = 0;
  const context = vm.createContext({ AbortController, Date: { now: () => now },
    setTimeout: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const source = ts.transpileModule(readFileSync(new URL('../../functions/_shared/researchDeadline.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const api = new vm.Script(`(function(exports){${source.outputText};return exports;})`).runInContext(context)({});
  return { ...api, timers, advance(value) {
    now = value;
    for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.callback(); }
  } };
}

test('catalog/bootstrap time consumes the same research deadline as model rounds and verification', () => {
  const c = clock(12000), parent = new AbortController();
  const research = c.createResearchDeadline(parent.signal, 1000);
  assert.equal(research.remainingMs(), 31000);
  c.advance(30000); assert.equal(research.remainingMs(), 13000); assert.equal(research.signal.aborted, false);
  c.advance(43000); assert.equal(research.remainingMs(), 0); assert.equal(research.signal.aborted, true);
  assert.equal(parent.signal.aborted, false, 'the atomic completion retains its original parent signal');
  research.dispose(); assert.equal(c.timers.size, 0);
});

test('parent cancellation stops research while normal disposal only clears research and its timer', () => {
  const c = clock(5000), parent = new AbortController();
  const research = c.createResearchDeadline(parent.signal, 5000);
  research.dispose();
  assert.equal(research.signal.aborted, true); assert.equal(parent.signal.aborted, false); assert.equal(c.timers.size, 0);
  const cancelled = c.createResearchDeadline(parent.signal, 5000);
  parent.abort(); assert.equal(cancelled.signal.aborted, true);
  cancelled.dispose(); assert.equal(c.timers.size, 0);
});
