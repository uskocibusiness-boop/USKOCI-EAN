// Execute the production accounting callers with synthetic HTTP and manual
// deadlines. No provider, Supabase, credential or live accounting operation.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const source = name => ts.transpileModule(readFileSync(new URL(`../../functions/_shared/${name}.ts`, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const budgetSource = source('aiTestBudget');
const taxonomySource = source('taxonomyProviderBudget');
const base = { supabaseUrl: 'https://accounting.invalid', serviceRoleKey: 'SYNTHETIC',
  operationId: '22222222-2222-4222-8222-222222222222' };
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

function setup(transport) {
  const calls = [], timers = new Map(); let nextTimer = 0;
  const context = vm.createContext({ Response, TextEncoder, TextDecoder, AbortController,
    console: { info() {} },
    fetch: (url, init) => { calls.push({ url, init }); return transport(url, init); },
    setTimeout: (callback, milliseconds) => { const id = ++nextTimer; timers.set(id, { callback, milliseconds }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const load = (code, require) => new vm.Script(`(function(exports,require){${code};return exports;})`).runInContext(context)({}, require);
  const budget = load(budgetSource, () => assert.fail('unexpected dependency'));
  const taxonomy = load(taxonomySource, name => {
    if (name === './geminiTaskStream.ts') return { decodeGeminiUsage: () => assert.fail('foreground receipt test does not decode BG usage') };
    assert.equal(name, './aiTestBudget.ts'); return budget;
  });
  return { budget, taxonomy, calls, timers,
    expire() { for (const [id, timer] of [...timers]) { timers.delete(id); timer.callback(); } },
  };
}

async function start(env, kind) {
  if (kind === 'release') return { pending: env.budget.releaseUnusedAiTestReservation(base), timeout: 5000 };
  if (kind === 'audio') return { pending: env.budget.settleAiTestAudio({ ...base, audioBytes: 64000, transcriptChars: 20 }), timeout: 5000 };
  const budget = env.taxonomy.createTaxonomyProviderBudget({ ...base, accountId: 'synthetic-account',
    conversationId: 'synthetic-conversation', firstReservationId: 'synthetic-reservation', model: 'gemini-3.8-flash' });
  await budget.beforeAttempt({ attempt: 1 });
  const report = { attempt: 1, phase: 'FINAL', reservationId: 'synthetic-reservation', outcome: 'SUCCEEDED',
    attemptUsageComplete: true, usageComplete: true, usage: { promptTokens: 10, outputTokens: 3, totalTokens: 13 } };
  return { pending: budget.onAttempt(report), timeout: 3000, budget, report };
}

for (const kind of ['release', 'audio', 'usage']) {
  for (const phase of ['headers', 'body']) {
    test(`${kind}: deadline settles even when ${phase} ignore AbortSignal; no retry or false confirmation`, async () => {
      let cancelled = 0;
      const env = setup(async () => phase === 'headers' ? new Promise(() => {}) : new Response(new ReadableStream({
        pull: () => new Promise(() => {}), cancel() { cancelled++; },
      })));
      const { pending, timeout, budget, report } = await start(env, kind);
      let result = 'PENDING';
      void pending.then(value => { result = value; }, error => { result = error.message; });
      await flush();
      assert.deepEqual([...env.timers.values()].map(timer => timer.milliseconds), [timeout]);
      env.expire(); await flush();
      assert.equal(result, kind === 'usage' ? 'AI_TOOL_USAGE_UNAVAILABLE' : false);
      assert.equal(env.calls.length, 1);
      assert.equal(env.calls[0].init.signal.aborted, true);
      assert.equal(env.timers.size, 0);
      if (phase === 'body') assert.equal(cancelled, 1);
      if (budget) {
        await assert.rejects(budget.onAttempt(report), /AI_TOOL_USAGE_CONFLICT/);
        assert.equal(env.calls.length, 1, 'an uncertain settlement never repeats the provider or accounting write');
      }
    });
  }
  test(`${kind}: complete matching receipt retains the existing successful accounting result`, async () => {
    const env = setup(async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.p_operation_id, base.operationId);
      assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error');
      return new Response(JSON.stringify(kind === 'release' ? { operationId: body.p_operation_id, released: true, code: 'AI_RELEASE_DONE' }
        : kind === 'audio' ? { operationId: body.p_operation_id, settled: true, code: 'AI_AUDIO_SETTLED' } : {
        operationId: body.p_operation_id, authoritative: true, recorded: true,
        promptTokens: 10, outputTokens: 3, totalTokens: 13,
      }));
    });
    const { pending } = await start(env, kind);
    assert.equal(await pending, kind === 'usage' ? undefined : true);
    assert.equal(env.calls.length, 1); assert.equal(env.timers.size, 0);
  });
  test(`${kind}: oversized successful-looking receipt is refused`, async () => {
    const env = setup(async () => new Response(JSON.stringify({ released: true, settled: true, extra: 'x'.repeat(5000) })));
    const { pending } = await start(env, kind);
    if (kind === 'usage') await assert.rejects(pending, /AI_TOOL_USAGE_INVALID/);
    else assert.equal(await pending, false);
    assert.equal(env.calls.length, 1); assert.equal(env.timers.size, 0);
  });
  test(`${kind}: late response after the deadline is cancelled and cannot change the outcome`, async () => {
    let resolveHeaders, cancelled = 0;
    const env = setup(() => new Promise(resolve => { resolveHeaders = resolve; }));
    const { pending } = await start(env, kind);
    let result = 'PENDING';
    const completed = pending.then(value => { result = value; }, error => { result = error.message; });
    env.expire(); await completed;
    const unknown = kind === 'usage' ? 'AI_TOOL_USAGE_UNAVAILABLE' : false;
    assert.equal(result, unknown);
    resolveHeaders(new Response(new ReadableStream({ cancel() { cancelled++; } })));
    await flush();
    assert.equal(cancelled, 1); assert.equal(result, unknown);
    assert.equal(env.calls.length, 1); assert.equal(env.timers.size, 0);
  });
  for (const invalid of ['http-failure', 'redirect', 'invalid-json', 'invalid-utf8', 'wrong-receipt', 'wrong-operation', 'missing-operation', 'wrong-code']) {
    test(`${kind}: ${invalid} cannot confirm an accounting write`, async () => {
      const env = setup(async () => {
        if (invalid === 'http-failure') return new Response('{"released":true,"settled":true}', { status: 500 });
        if (invalid === 'redirect') {
          const response = new Response('{"released":true,"settled":true}');
          Object.defineProperty(response, 'redirected', { value: true });
          return response;
        }
        if (invalid === 'invalid-json') return new Response('{"released":true');
        if (invalid === 'invalid-utf8') return new Response(new Uint8Array([0xff]));
        if (['wrong-operation', 'missing-operation', 'wrong-code'].includes(invalid)) return new Response(JSON.stringify({
          operationId: invalid === 'missing-operation' ? undefined : invalid === 'wrong-operation' ? '33333333-3333-4333-8333-333333333333' : base.operationId,
          released: true, settled: true, code: invalid === 'wrong-code' ? 'UNCONFIRMED' : kind === 'release' ? 'AI_RELEASE_DONE' : 'AI_AUDIO_SETTLED',
          // Usage has a different existing receipt contract: authoritative and counts.
          authoritative: invalid !== 'wrong-code', recorded: true, promptTokens: 10, outputTokens: 3, totalTokens: 13,
        }));
        return new Response('{"released":"true","settled":"true","authoritative":false}');
      });
      const { pending } = await start(env, kind);
      if (kind === 'usage') await assert.rejects(pending);
      else assert.equal(await pending, false);
      assert.equal(env.calls.length, 1); assert.equal(env.timers.size, 0);
    });
  }
}

test('audio with no dispatched bytes keeps the existing no-settlement contract', async () => {
  const env = setup(() => assert.fail('zero audio must not settle a reservation'));
  assert.equal(await env.budget.settleAiTestAudio({ ...base, audioBytes: 0, transcriptChars: 0 }), false);
  assert.equal(env.calls.length, 0); assert.equal(env.timers.size, 0);
});
