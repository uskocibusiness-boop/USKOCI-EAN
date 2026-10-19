// Actual production decoders/transports with synthetic provider responses only.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const plain = value => JSON.parse(JSON.stringify(value));
function load(fetch = () => assert.fail('UNEXPECTED_NETWORK')) {
  const context = vm.createContext({ fetch, Response, Request, Headers, TextEncoder, TextDecoder,
    ReadableStream, AbortController, setTimeout, clearTimeout, console: { error() {}, info() {} } });
  const evaluate = (path, imports = {}) => {
    const result = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      fileName: path.replace(/\.mjs$/, '.ts'), reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    });
    assert.equal(result.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
    const require = name => { assert.ok(Object.hasOwn(imports, name), name); return imports[name]; };
    return new vm.Script(`(function(exports,require){${result.outputText};return exports;})`).runInContext(context)({}, require);
  };
  const availability = evaluate('../../../src/contracts/aiAvailability.ts');
  const stream = evaluate('../../functions/_shared/geminiTaskStream.ts', { '../../../src/contracts/aiAvailability.ts': availability });
  const timing = evaluate('../../functions/_shared/aiPhaseTiming.mjs');
  const tools = evaluate('../../functions/_shared/geminiToolConversation.ts', { './geminiTaskStream.ts': stream, './aiPhaseTiming.mjs': timing });
  return { ...stream, ...tools };
}
const metadata = (overrides = {}) => ({ promptTokenCount: 100, candidatesTokenCount: 20,
  thoughtsTokenCount: 7, totalTokenCount: 127, ...overrides });
const body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'SYNTHETIC_INPUT' }] }],
  generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT',
    properties: { assistantMessage: { type: 'STRING' } }, required: ['assistantMessage'] } } });
const raw = '{"assistantMessage":"SYNTHETIC_ANSWER"}';
const final = (usageMetadata) => ({ usageMetadata, candidates: [{ finishReason: 'STOP',
  content: { role: 'model', parts: [{ text: raw }] } }] });
const sse = events => new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''),
  { headers: { 'Content-Type': 'text/event-stream' } });
const expected = { promptTokens: 100, outputTokens: 27, totalTokens: 127 };

test('one decoder counts candidate and thinking output once; cached input remains a subset', () => {
  const api = load(), input = metadata({ cachedContentTokenCount: 80 }), before = plain(input);
  const decoded = plain(api.decodeGeminiUsage(input));
  assert.deepEqual(decoded, { usage: expected, promptTokens: 100, candidateTokens: 20,
    thoughtTokens: 7, toolUsePromptTokens: 0, cachedPromptTokens: 80, totalTokens: 127 });
  assert.deepEqual(plain(api.geminiUsage(input)), expected);
  assert.deepEqual(input, before);
});

test('explicit tool-use input belongs to input once, never to output/thinking or cached input', () => {
  const decoded = plain(load().decodeGeminiUsage(metadata({ toolUsePromptTokenCount: 11,
    totalTokenCount: 138, cachedContentTokenCount: 80 })));
  assert.deepEqual(decoded.usage, { promptTokens: 111, outputTokens: 27, totalTokens: 138 });
  assert.equal(decoded.promptTokens, 100); assert.equal(decoded.toolUsePromptTokens, 11);
  assert.equal(decoded.cachedPromptTokens, 80); assert.equal(decoded.thoughtTokens, 7);
});

test('omitted counts are only proven zero when totals reconcile; unexplained residual is not invented thinking', () => {
  const api = load();
  for (const values of [
    { promptTokenCount: 100, candidatesTokenCount: 20, totalTokenCount: 120 },
    { promptTokenCount: 100, candidatesTokenCount: 20, toolUsePromptTokenCount: 11, totalTokenCount: 131 },
  ]) {
    const decoded = api.decodeGeminiUsage(values);
    assert.equal(decoded.thoughtTokens, 0); assert.ok(decoded.usage);
    assert.equal(decoded.usage.outputTokens, 20);
  }
  const missing = api.decodeGeminiUsage({ promptTokenCount: 100, candidatesTokenCount: 20, totalTokenCount: 127 });
  assert.equal(missing.usage, null); assert.equal(missing.thoughtTokens, null);
  assert.equal(missing.toolUsePromptTokens, null);
  // Even an explicit thinking count cannot explain an additional unknown input residual.
  assert.equal(api.decodeGeminiUsage(metadata({ totalTokenCount: 129 })).usage, null);
});

test('missing/malformed candidate, thinking, total or input counts cannot settle as zero or an undercount', () => {
  const api = load();
  for (const input of [undefined, null, [], {}, '127']) assert.equal(api.geminiUsage(input), null);
  for (const key of ['promptTokenCount', 'candidatesTokenCount', 'thoughtsTokenCount', 'totalTokenCount', 'toolUsePromptTokenCount']) {
    for (const value of [null, -1, 0.5, '7', NaN, Infinity, 10_000_001]) {
      assert.equal(api.geminiUsage(metadata({ [key]: value })), null, `${key}: ${String(value)}`);
    }
  }
  for (const totalTokenCount of [0, 119, 120, 126, 128]) {
    assert.equal(api.geminiUsage(metadata({ totalTokenCount })), null);
  }
  const invalidTool = api.decodeGeminiUsage({ promptTokenCount: 100, candidatesTokenCount: 20,
    totalTokenCount: 120, toolUsePromptTokenCount: null });
  assert.equal(invalidTool.thoughtTokens, null);
});

test('cache telemetry distinguishes missing, explicit zero and invalid counts without applying a guessed discount', () => {
  const api = load();
  for (const value of [undefined, null, -1, '80', 101, 0.5]) {
    const decoded = api.decodeGeminiUsage(metadata({ cachedContentTokenCount: value }));
    assert.equal(decoded.cachedPromptTokens, null);
    assert.deepEqual(plain(decoded.usage), expected);
  }
  assert.equal(api.decodeGeminiUsage(metadata({ cachedContentTokenCount: 0 })).cachedPromptTokens, 0);
  assert.equal(api.decodeGeminiUsage(metadata({ cachedContentTokenCount: 100 })).cachedPromptTokens, 100);
});

test('zero usage is accepted only as a measured coherent count, including an explicit zero cache', () => {
  const decoded = plain(load().decodeGeminiUsage({ promptTokenCount: 0, candidatesTokenCount: 0,
    thoughtsTokenCount: 0, totalTokenCount: 0, cachedContentTokenCount: 0 }));
  assert.deepEqual(decoded.usage, { promptTokens: 0, outputTokens: 0, totalTokens: 0 });
  assert.equal(decoded.thoughtTokens, 0); assert.equal(decoded.cachedPromptTokens, 0);
});

test('SSE and tool transport deliver the same answer and bill the same thinking/cache breakdown exactly once', async () => {
  const counts = metadata({ cachedContentTokenCount: 80 }), streamUsage = [], details = [], reports = [];
  const streamApi = load(async () => sse([
    { candidates: [], usageMetadata: metadata({ candidatesTokenCount: 10, thoughtsTokenCount: 2, totalTokenCount: 112 }) },
    final(counts), { candidates: [] },
  ]));
  const streamed = await streamApi.streamGeminiTask({ url: 'https://provider.invalid/stream', key: 'SYNTHETIC', body,
    onText() {}, onUsage: value => streamUsage.push(plain(value)), onUsageDetails: value => details.push(plain(value)) });
  const toolApi = load(async () => new Response(JSON.stringify(final(counts))));
  const result = await toolApi.generateGeminiToolConversation({ url: 'https://provider.invalid/generate', key: 'SYNTHETIC', body,
    tools: [], beforeAttempt: async () => ({ reservationId: 'synthetic' }), onAttempt: async value => reports.push(plain(value)) });
  assert.equal(streamed, raw); assert.equal(result.raw, raw);
  assert.deepEqual(streamUsage, [expected]); assert.deepEqual(plain(result.usage), expected);
  assert.equal(details.length, 1); assert.equal(reports.length, 1);
  assert.equal(details[0].cachedPromptTokens, 80); assert.equal(reports[0].cachedPromptTokens, 80);
  assert.equal(reports[0].candidateTokens, 20); assert.equal(reports[0].thoughtTokens, 7);
  assert.equal(reports[0].attemptUsageComplete, true);
});

test('explicit incomplete final SSE usage replaces earlier cumulative counts without breaking answer delivery', async () => {
  const charged = [], observed = [];
  const api = load(async () => sse([{ candidates: [], usageMetadata: metadata() },
    final({ promptTokenCount: 100, candidatesTokenCount: 30, totalTokenCount: 140 })]));
  assert.equal(await api.streamGeminiTask({ url: 'https://provider.invalid/stream', key: 'SYNTHETIC', body,
    onText() {}, onUsage: value => charged.push(value), onUsageDetails: value => observed.push(plain(value)) }), raw);
  assert.equal(charged.length, 0); assert.equal(observed.length, 1);
  assert.equal(observed[0].usage, null); assert.equal(observed[0].thoughtTokens, null);
  assert.equal(observed[0].candidateTokens, 30);
});

test('no usage and failing telemetry callbacks cannot erase a valid streamed answer', async () => {
  const api = load(async () => sse([final(undefined)])), details = [];
  assert.equal(await api.streamGeminiTask({ url: 'https://provider.invalid/stream', key: 'SYNTHETIC', body,
    onText() {}, onUsage: () => assert.fail('UNKNOWN_USAGE_NOT_ZERO'),
    onUsageDetails: value => { details.push(plain(value)); throw new Error('SYNTHETIC_TELEMETRY_FAILURE'); } }), raw);
  assert.equal(details.length, 1); assert.equal(details[0].usage, null);
  assert.equal(details[0].cachedPromptTokens, null);
});

test('fully received invalid assistant JSON still reports known provider usage without returning a false success', async () => {
  const charged = [], invalid = final(metadata());
  invalid.candidates[0].content.parts[0].text = '{"assistantMessage":"SYNTHETIC_ANSWER",';
  const api = load(async () => sse([invalid]));
  await assert.rejects(() => api.streamGeminiTask({ url: 'https://provider.invalid/stream', key: 'SYNTHETIC', body,
    onText() {}, onUsage: value => charged.push(plain(value)) }));
  assert.deepEqual(charged, [expected]);
});

test('an interrupted stream cannot settle its earlier coherent cumulative usage as final', async () => {
  const abort = new AbortController(), charged = [];
  const api = load(async () => new Response(new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ candidates: [], usageMetadata: metadata() })}\n\n`));
    setTimeout(() => abort.abort(), 10);
  } }), { headers: { 'Content-Type': 'text/event-stream' } }));
  await assert.rejects(() => api.streamGeminiTask({ url: 'https://provider.invalid/stream', key: 'SYNTHETIC', body,
    signal: abort.signal, onText() {}, onUsage: value => charged.push(value) }), /AI_STREAM_STOPPED/);
  assert.equal(charged.length, 0);
});

test('tool usage accounting keeps known failed-attempt thinking/cache and never retries that request', async () => {
  let calls = 0; const reports = [];
  const api = load(async () => { calls++; return new Response(JSON.stringify({
    error: { status: 'INVALID_ARGUMENT' }, usageMetadata: metadata({ cachedContentTokenCount: 80 }),
  }), { status: 400 }); });
  await assert.rejects(() => api.generateGeminiToolConversation({ url: 'https://provider.invalid/generate', key: 'SYNTHETIC', body,
    tools: [], beforeAttempt: async () => ({ reservationId: 'synthetic' }), onAttempt: async value => reports.push(plain(value)) }), /AI_TOOL_UNAVAILABLE/);
  assert.equal(calls, 1); assert.equal(reports.length, 1);
  assert.equal(reports[0].outcome, 'FAILED'); assert.equal(reports[0].attemptUsageComplete, true);
  assert.deepEqual(reports[0].usage, expected); assert.equal(reports[0].cachedPromptTokens, 80);
});
