import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { isProviderUsageLog } from './provider_usage_log_contract.mjs';
const plain = value => JSON.parse(JSON.stringify(value));
function setup({ unknown = false, logFailure = false } = {}) {
  const calls = [], logs = [], privateValue = 'SYNTHETIC_PRIVATE_ID';
  const code = ts.transpileModule(readFileSync(new URL('../../functions/_shared/taxonomyProviderBudget.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const context = vm.createContext({ Response, TextEncoder, TextDecoder, AbortController, setTimeout, clearTimeout,
    console: { info: (...args) => { logs.push(plain(args)); if (logFailure) throw new Error('SYNTHETIC_LOG_FAILED'); } },
    fetch: async (_url, init) => { const input = JSON.parse(init.body); calls.push(input);
      return new Response(JSON.stringify({ operationId: input.p_operation_id, authoritative: true, recorded: true,
        promptTokens: input.p_prompt_tokens, outputTokens: input.p_output_tokens, totalTokens: input.p_total_tokens })); },
  });
  const api = new vm.Script(`(function(exports,require){${code};return exports;})`).runInContext(context)({}, name => {
    assert.equal(name, './aiTestBudget.ts'); return { reserveAiTestBudget: () => assert.fail('FIRST_ATTEMPT_ALREADY_RESERVED') };
  });
  const input = { supabaseUrl: 'https://synthetic.invalid', serviceRoleKey: privateValue, accountId: privateValue,
    conversationId: privateValue, operationId: privateValue, firstReservationId: privateValue, model: 'gemini-3.8-flash' };
  const budget = api.createTaxonomyProviderBudget(input);
  const admission = { attempt: 1, phase: 'TOOLS', requestBytes: 16384, maxOutputTokens: 8192, signal: new AbortController().signal };
  const report = { ...admission, reservationId: privateValue, dispatched: true, outcome: 'SUCCEEDED', httpStatus: 200,
    usage: unknown ? null : { promptTokens: 100, outputTokens: 27, totalTokens: 127 },
    cumulativeUsage: { promptTokens: 100, outputTokens: 27, totalTokens: 127 },
    attemptUsageComplete: !unknown, usageComplete: !unknown,
    candidateTokens: unknown ? null : 20, thoughtTokens: unknown ? null : 7,
    cachedPromptTokens: unknown ? null : 80, toolUsePromptTokens: unknown ? null : 0, errorCode: null,
    // Deliberate extra untrusted baggage proves the complete report is never logged.
    prompt: privateValue, responsePayload: privateValue,
  };
  return { budget, calls, logs, admission, report, privateValue };
}
test('known thinking/cache metrics are count-only and settle original reservation once without a cache double charge', async () => {
  const { budget, calls, logs, admission, report, privateValue } = setup();
  await budget.beforeAttempt(admission); await budget.onAttempt(report);
  assert.equal(logs.length, 1); assert.ok(isProviderUsageLog(logs[0]));
  assert.ok(!JSON.stringify(logs).includes(privateValue));
  assert.equal(logs[0][1].cachedPromptTokens, 80); assert.equal(logs[0][1].outputTokens, 27);
  assert.equal(calls.length, 1); assert.equal(calls[0].p_prompt_tokens, 100); assert.equal(calls[0].p_output_tokens, 27);
  await assert.rejects(() => budget.onAttempt(report), /AI_TOOL_USAGE_CONFLICT/);
  assert.equal(calls.length, 1); assert.equal(logs.length, 1);
});
test('unknown usage remains visible as unknown and retains its hold without sending a zero ledger record', async () => {
  const { budget, calls, logs, admission, report } = setup({ unknown: true });
  await budget.beforeAttempt(admission); await budget.onAttempt(report);
  assert.equal(calls.length, 0); assert.equal(logs.length, 1); assert.ok(isProviderUsageLog(logs[0]));
  assert.equal(logs[0][1].usageComplete, false);
  for (const key of ['promptTokens', 'outputTokens', 'candidateTokens', 'thoughtTokens', 'cachedPromptTokens']) assert.equal(logs[0][1][key], null);
});
test('logger failure cannot prevent durable accounting', async () => {
  const { budget, calls, admission, report } = setup({ logFailure: true });
  await budget.beforeAttempt(admission); await budget.onAttempt(report);
  assert.equal(calls.length, 1);
});
test('VM privacy log exception rejects added identities, content, invalid counts and arbitrary model text', async () => {
  const { budget, logs, admission, report } = setup();
  await budget.beforeAttempt(admission); await budget.onAttempt(report);
  assert.ok(isProviderUsageLog(logs[0]));
  for (const extra of [{ accountId: 'PRIVATE' }, { assistantMessage: 'PRIVATE' }, { cachedPromptTokens: 'PRIVATE' },
    { model: 'PRIVATE' }, { promptTokens: -1 }, { usageComplete: 'true' }]) {
    assert.equal(isProviderUsageLog(['AI_PROVIDER_USAGE', { ...logs[0][1], ...extra }]), false);
  }
  assert.equal(isProviderUsageLog(['OTHER', logs[0][1]]), false);
});
