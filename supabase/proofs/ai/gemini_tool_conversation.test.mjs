// Production transport with synthetic fetch/read tools only. No provider or billing calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const plain = value => JSON.parse(JSON.stringify(value));
function load(fetch) {
  const logs = [];
  const context = vm.createContext({ fetch, Response, Request, Headers, TextEncoder, TextDecoder,
    ReadableStream, AbortController, setTimeout, clearTimeout, console: { error: (...args) => logs.push(args), info: (...args) => logs.push(args) } });
  const evaluate = (path, imports = {}) => {
    const output = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      fileName: path.replace(/\.mjs$/,'.ts'), reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    });
    assert.equal(output.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
    const require = name => { assert.ok(Object.hasOwn(imports, name), name); return imports[name]; };
    return new vm.Script(`(function(exports,require){${output.outputText};return exports;})`).runInContext(context)({}, require);
  };
  const availability = evaluate('../../../src/contracts/aiAvailability.ts');
  const stream = evaluate('../../functions/_shared/geminiTaskStream.ts', { '../../../src/contracts/aiAvailability.ts': availability });
  return { api: evaluate('../../functions/_shared/geminiToolConversation.ts', { './geminiTaskStream.ts': stream, './aiPhaseTiming.mjs': evaluate('../../functions/_shared/aiPhaseTiming.mjs') }), logs };
}
const usage = (prompt = 40, candidates = 10, thoughts = 5) => ({ promptTokenCount: prompt,
  candidatesTokenCount: candidates, thoughtsTokenCount: thoughts, totalTokenCount: prompt + candidates + thoughts });
const content = parts => ({ role: 'model', parts });
const payload = (parts, counts = usage(), finishReason = 'STOP') => ({ candidates: [{ finishReason, content: content(parts) }], usageMetadata: counts });
const response = value => new Response(JSON.stringify(value));
const final = (text = 'SYNTHETIC_OK', counts = usage()) => payload([{ text: JSON.stringify({ assistantMessage: text, facts: [] }) }], counts);
const call = (id = 'call_1', args = { query: 'synthetic' }, name = 'search_catalog') => ({ functionCall: { id, name, args }, thoughtSignature: `opaque_${id}` });
const body = (overrides = {}) => JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'SYNTHETIC_INPUT' }] }],
  generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: {
    assistantMessage: { type: 'STRING' }, facts: { type: 'ARRAY', items: { type: 'STRING' } },
  }, required: ['assistantMessage', 'facts'] }, maxOutputTokens: 8192 }, ...overrides });
function args(overrides = {}) {
  const reports = [], admissions = [], reads = [];
  const input = { url: 'https://provider.invalid/v1beta/models/gemini-3.8-flash:generateContent', key: 'SYNTHETIC_KEY', body: body(),
    tools: [{ declaration: { name: 'search_catalog', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
      readOnly: true, execute: async (value, context) => { reads.push({ value: plain(value), round: context.round, callId: context.callId }); return { nodes: ['synthetic_node'], complete: true }; } }],
    beforeAttempt: async info => { admissions.push(info); return { reservationId: `reservation_${info.attempt}` }; },
    onAttempt: async report => reports.push(plain(report)), ...overrides };
  return { input, reports, admissions, reads };
}

test('ordinary structured answer is one paid call with schema and tools; output usage includes thinking', async () => {
  const requests = [];
  const { api } = load(async (_url, init) => { requests.push(JSON.parse(init.body)); return response(final()); });
  const { input, reports, admissions, reads } = args();
  const result = await api.generateGeminiToolConversation(input);
  assert.equal(result.attempts, 1); assert.equal(result.toolCalls, 0); assert.equal(reads.length, 0);
  assert.deepEqual(plain(result.usage), { promptTokens: 40, outputTokens: 15, totalTokens: 55 });
  assert.equal(result.usageComplete, true); assert.equal(result.accountingComplete, true);
  assert.equal(requests[0].generationConfig.responseMimeType, 'application/json');
  assert.equal(requests[0].generationConfig.responseSchema.type, 'OBJECT');
  assert.deepEqual(requests[0].toolConfig, { functionCallingConfig: { mode: 'VALIDATED' } });
  assert.ok(!('responseFormat' in requests[0].generationConfig));
  assert.equal(admissions.length, 1); assert.equal(reports.length, 1);
  assert.equal(reports[0].candidateTokens, 10); assert.equal(reports[0].thoughtTokens, 5);
  assert.equal(reports[0].reservationId, 'reservation_1'); assert.equal(reports[0].outcome, 'SUCCEEDED');
});

test('two research rounds preserve EVERY original model part/signature and ordered tool identities', async () => {
  const model1 = [{ text: 'private reasoning', thought: true, thoughtSignature: 'thought_before' }, call('id_a'),
    { text: 'research narration', thoughtSignature: 'tail_signature', partMetadata: { signatureKind: 'opaque' } }, call('id_b', { query: 'second' })];
  const model2 = [call('id_c', { query: 'deeper' })];
  const queue = [payload(model1), payload(model2), final()], requests = [];
  const { api } = load(async (_url, init) => { requests.push(JSON.parse(init.body)); return response(queue.shift()); });
  const { input, reports, reads } = args({ limits: { maxToolRounds: 2 }, parseFinal: JSON.parse });
  const result = await api.generateGeminiToolConversation(input);
  assert.equal(result.value.assistantMessage, 'SYNTHETIC_OK');
  assert.equal(result.attempts, 3); assert.equal(result.toolCalls, 3);
  assert.deepEqual(requests[1].contents[1], content(model1));
  assert.deepEqual(requests[2].contents[3], content(model2));
  assert.deepEqual(requests[1].contents[2], { role: 'user', parts: ['id_a', 'id_b'].map(id => ({ functionResponse: {
    id, name: 'search_catalog', response: { nodes: ['synthetic_node'], complete: true },
  } })) });
  assert.deepEqual(reads.map(x => [x.callId, x.round]), [['id_a', 1], ['id_b', 1], ['id_c', 2]]);
  assert.ok(!('tools' in requests[2])); assert.ok(!('toolConfig' in requests[2]));
  assert.equal(requests[2].generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(plain(result.usage), { promptTokens: 120, outputTokens: 45, totalTokens: 165 });
  assert.deepEqual(reports.map(x => x.cumulativeUsage.outputTokens), [15, 30, 45]);
});

test('12 independent service reads fit one round; no hardcoded small classification batch', async () => {
  const queue = [payload(Array.from({ length: 12 }, (_, i) => call(`id_${i}`))), final()];
  const { api } = load(async () => response(queue.shift()));
  const { input, reads } = args();
  const result = await api.generateGeminiToolConversation(input);
  assert.equal(reads.length, 12); assert.equal(result.toolCalls, 12); assert.equal(result.attempts, 2);
});

test('independent reads start together and out-of-order completion keeps provider call order', async () => {
  const requests = [], queue = [payload([call('first'), call('second'), call('third')]), final()];
  const { api } = load(async (_url, init) => { requests.push(JSON.parse(init.body)); return response(queue.shift()); });
  const { input } = args({ limits: { timeoutMs: 300 } });
  let allStarted;
  const started = new Promise(resolve => { allStarted = resolve; }), finish = new Map(), completed = [];
  input.tools[0].execute = async (_value, { callId }) => {
    const pending = new Promise(resolve => finish.set(callId, resolve));
    if (finish.size === 3) allStarted();
    await pending; completed.push(callId); return { identity: callId };
  };
  const run = api.generateGeminiToolConversation(input);
  await Promise.race([started, run.then(() => assert.fail('all reads must start before any result is released'))]);
  for (const id of ['third', 'second', 'first']) { finish.get(id)(); await Promise.resolve(); }
  await run;
  assert.deepEqual(completed, ['third', 'second', 'first']);
  assert.deepEqual(requests[1].contents.at(-1).parts.map(part => [part.functionResponse.id, part.functionResponse.response.identity]),
    [['first', 'first'], ['second', 'second'], ['third', 'third']]);
});

test('one failed read aborts already-started sibling reads without another paid request', async () => {
  let attempts = 0, siblingAborted = false, siblingStarted;
  const started = new Promise(resolve => { siblingStarted = resolve; });
  const { api } = load(async () => { attempts++; return response(payload([call('fails'), call('pending')])); });
  const { input } = args({ limits: { timeoutMs: 300 } });
  input.tools[0].execute = async (_value, { callId, signal }) => {
    if (callId === 'fails') { await started; throw new Error('PRIVATE_READ_FAILURE'); }
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => { siblingAborted = true; reject(new Error('SIBLING_CANCELLED')); }, { once: true });
      siblingStarted();
    });
  };
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_READ_FAILED/);
  assert.equal(attempts, 1); assert.equal(siblingAborted, true);
});

test('parallel reads all share the total turn deadline and cancellation signal', async () => {
  const signals = [], cancelled = [];
  const { api } = load(async () => response(payload([call('a'), call('b'), call('c')])));
  const { input } = args({ limits: { timeoutMs: 30 } });
  input.tools[0].execute = async (_value, { callId, signal }) => {
    signals.push(signal);
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
      cancelled.push(callId); reject(new Error('CANCELLED'));
    }, { once: true }));
  };
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_STOPPED/);
  assert.equal(signals.length, 3); assert.equal(new Set(signals).size, 1);
  assert.deepEqual(cancelled, ['a', 'b', 'c']);
});

for (const [name, parts, code] of [
  ['unknown tool', [call('one'), call('two', {}, 'write_catalog')], 'AI_TOOL_INVALID_CALL'],
  ['duplicate id in one round', [call('same'), call('same')], 'AI_TOOL_INVALID_CALL'],
  ['non-object arguments', [call('one', [])], 'AI_TOOL_INVALID_CALL'],
  ['oversize batch', Array.from({ length: 13 }, (_, i) => call(String(i))), 'AI_TOOL_CALL_BUDGET'],
]) test(`whole batch rejected before reads: ${name}`, async () => {
  let attempts = 0;
  const { api } = load(async () => { attempts++; return response(payload(parts)); });
  const { input, reads, reports } = args();
  await assert.rejects(() => api.generateGeminiToolConversation(input), new RegExp(code));
  assert.equal(reads.length, 0); assert.equal(attempts, 1); assert.equal(reports[0].outcome, 'FAILED');
  assert.equal(reports[0].usage.outputTokens, 15);
});

test('reused call id across rounds cannot execute twice', async () => {
  const { api } = load(async () => response(payload([call('same')])));
  const { input, reads, reports } = args();
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_INVALID_CALL/);
  assert.equal(reads.length, 1); assert.equal(reports.length, 2);
});

test('final-only response may not execute another requested tool', async () => {
  const { api } = load(async () => response(payload([call()])));
  const { input, reads } = args({ limits: { maxToolRounds: 0 } });
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_UNEXPECTED_CALL/);
  assert.equal(reads.length, 0);
});

test('total call budget disables further declarations instead of letting loop grow', async () => {
  const requests = [], queue = [payload([call()]), final()];
  const { api } = load(async (_url, init) => { requests.push(JSON.parse(init.body)); return response(queue.shift()); });
  const { input } = args({ limits: { maxToolCalls: 1 } });
  assert.equal((await api.generateGeminiToolConversation(input)).attempts, 2);
  assert.ok(!('tools' in requests[1]));
});

test('default three research rounds permit at most four model calls including final', async () => {
  let attempts = 0;
  const requests = [];
  const { api } = load(async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return response(++attempts <= 3 ? payload([call(`id_${attempts}`)]) : final());
  });
  const { input } = args({ body: body({ systemInstruction: { parts: [{ text: 'ORIGINAL_DOMAIN_RULES' }] } }) });
  const result = await api.generateGeminiToolConversation(input);
  assert.equal(result.attempts, 4); assert.equal(result.toolCalls, 3);
  assert.ok(!('tools' in requests[3]));
  assert.deepEqual(requests[3].systemInstruction.parts[0], { text: 'ORIGINAL_DOMAIN_RULES' });
  assert.match(requests[3].systemInstruction.parts.at(-1).text, /NEEDS_REVIEW/);
  assert.equal(requests[0].systemInstruction.parts.length, 1);
});

test('explicit separate mode uses at most research + final and never auto-falls back after error', async () => {
  const requests = [], queue = [payload([{ text: 'Research is sufficient.' }]), final()];
  const { api } = load(async (_url, init) => { requests.push(JSON.parse(init.body)); return response(queue.shift()); });
  const { input } = args({ mode: 'SEPARATE' });
  assert.equal((await api.generateGeminiToolConversation(input)).attempts, 2);
  assert.ok(!('responseSchema' in requests[0].generationConfig));
  assert.ok(!('tools' in requests[1]));
  assert.equal(requests[1].generationConfig.responseMimeType, 'application/json');
});

for (const status of [400, 402, 429, 500]) test(`HTTP ${status} accounts usage, logs closed diagnostics and never retries`, async () => {
  let attempts = 0;
  const { api, logs } = load(async () => { attempts++; return new Response(JSON.stringify({ usageMetadata: usage(), error: {
    status: 'INVALID_ARGUMENT', message: 'PRIVATE_INPUT_AND_KEY', details: [{ reason: 'PRIVATE_REASON' }],
  } }), { status }); });
  const { input, reports } = args();
  await assert.rejects(() => api.generateGeminiToolConversation(input), status === 402 ? /AI_CREDITS_UNAVAILABLE/ : /AI_TOOL_UNAVAILABLE/);
  assert.equal(attempts, 1); assert.equal(reports.length, 1); assert.equal(reports[0].usage.outputTokens, 15);
  assert.deepEqual(withoutTiming(logs), [['GEMINI_TOOLS_HTTP_FAILED', status, 'INVALID_ARGUMENT', 'UNKNOWN', 'UNKNOWN']]);
  assert.ok(!JSON.stringify(reports).includes('PRIVATE'));
});

for (const [name, output, code] of [
  ['prompt block', { promptFeedback: { blockReason: 'SAFETY' }, usageMetadata: usage() }, 'GEMINI_SAFETY_BLOCKED'],
  ['candidate block', payload([], usage(), 'SAFETY'), 'GEMINI_SAFETY_BLOCKED'],
  ['blocked safety rating', { ...final(), candidates: [{ ...final().candidates[0], safetyRatings: [{ blocked: true }] }] }, 'GEMINI_SAFETY_BLOCKED'],
  ['truncation', payload([{ text: '{}' }], usage(), 'MAX_TOKENS'), 'AI_TOOL_INCOMPLETE'],
  ['invalid JSON', payload([{ text: 'not json' }]), 'AI_TOOL_INVALID_FINAL'],
  ['unstructured list', payload([{ text: '[]' }]), 'AI_TOOL_INVALID_FINAL'],
  ['unexpected executable output', payload([{ executableCode: { code: 'UNTRUSTED' }, thoughtSignature: 'sig' }, { text: '{}' }]), 'AI_TOOL_INVALID_RESPONSE'],
]) test(`${name} has one accounted failure without retry`, async () => {
  let attempts = 0;
  const { api } = load(async () => { attempts++; return response(output); });
  const { input, reports } = args();
  await assert.rejects(() => api.generateGeminiToolConversation(input), new RegExp(code));
  assert.equal(attempts, 1); assert.equal(reports[0].usage.outputTokens, 15); assert.equal(reports[0].outcome, 'FAILED');
});

test('caller final validator rejects domain-invalid JSON before success is reported', async () => {
  const { api } = load(async () => response(final()));
  const { input, reports } = args({ parseFinal: () => { throw new Error('PRIVATE_VALIDATION'); } });
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_INVALID_FINAL/);
  assert.equal(reports[0].outcome, 'FAILED'); assert.ok(!JSON.stringify(reports).includes('PRIVATE'));
});

test('network failure after a successful round preserves first usage and marks second unknown', async () => {
  let attempts = 0;
  const { api } = load(async () => { if (++attempts === 1) return response(payload([call()])); throw new Error('PRIVATE_NETWORK_DETAIL'); });
  const { input, reports } = args();
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_UNAVAILABLE/);
  assert.equal(attempts, 2); assert.equal(reports[1].usage, null); assert.equal(reports[1].usageComplete, false);
  assert.equal(reports[1].cumulativeUsage.outputTokens, 15);
});

test('missing thoughts with unexplained residual remains unknown; proven zero is accepted', async () => {
  for (const [total, complete] of [[55, false], [50, true]]) {
    const { api } = load(async () => response(final('OK', { promptTokenCount: 40, candidatesTokenCount: 10, totalTokenCount: total })));
    const { input, reports } = args();
    const result = await api.generateGeminiToolConversation(input);
    assert.equal(result.usageComplete, complete);
    assert.equal(reports[0].thoughtTokens, complete ? 0 : null);
    assert.equal(reports[0].usage === null, !complete);
  }
});

test('known later usage is settleable even while an earlier unknown hold remains incomplete', async () => {
  const queue = [payload([call()], { promptTokenCount: 40, candidatesTokenCount: 10, totalTokenCount: 55 }), final()];
  const { api } = load(async () => response(queue.shift()));
  const { input, reports } = args();
  const result = await api.generateGeminiToolConversation(input);
  assert.equal(reports[0].attemptUsageComplete, false); assert.equal(reports[0].usage, null);
  assert.equal(reports[1].attemptUsageComplete, true); assert.equal(reports[1].usage.outputTokens, 15);
  assert.equal(reports[1].usageComplete, false); assert.equal(result.usageComplete, false);
  assert.equal(result.usage.outputTokens, 15);
});

test('unknown usage holds whole token allocation and cannot buy an unbounded follow-up', async () => {
  let attempts = 0;
  const { api } = load(async () => { attempts++; return response(payload([call()], null)); });
  const { input, reports } = args({ limits: { maxOutputTokens: 100, maxTurnOutputTokens: 100 } });
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_TOKEN_BUDGET/);
  assert.equal(attempts, 1); assert.equal(reports[0].usage, null); assert.equal(reports[0].usageComplete, false);
});

test('thinking counts reduce the next provider token allocation', async () => {
  const requests = [], queue = [payload([call()], usage(100, 10, 60)), final('OK', usage(100, 10, 5))];
  const { api } = load(async (_url, init) => { requests.push(JSON.parse(init.body)); return response(queue.shift()); });
  const { input } = args({ limits: { maxOutputTokens: 80, maxTurnOutputTokens: 100 } });
  await api.generateGeminiToolConversation(input);
  assert.deepEqual(requests.map(x => x.generationConfig.maxOutputTokens), [80, 30]);
});

test('admission denial does not dispatch paid IO; onAttempt follows every admitted request', async () => {
  let attempts = 0, admissions = 0;
  const { api } = load(async () => { attempts++; return response(payload([call()])); });
  const { input, reports } = args({ beforeAttempt: async () => { if (++admissions === 2) throw new Error('PRIVATE_BUDGET'); return { reservationId: 'first' }; } });
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_ADMISSION_FAILED/);
  assert.equal(attempts, 1); assert.equal(reports.length, 1); assert.equal(reports[0].reservationId, 'first');
});

test('accounting failure prevents another model call, but never drops a valid final answer', async () => {
  for (const isFinal of [true, false]) {
    let attempts = 0, reads = 0;
    const { api } = load(async () => { attempts++; return response(isFinal ? final() : payload([call()])); });
    const { input } = args({ onAttempt: async () => { throw new Error('PRIVATE_ACCOUNTING'); } });
    input.tools[0].execute = async () => { reads++; return {}; };
    if (isFinal) assert.equal((await api.generateGeminiToolConversation(input)).accountingComplete, false);
    else await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_ACCOUNTING_FAILED/);
    assert.equal(attempts, 1); assert.equal(reads, 0);
  }
});

test('unresponsive accounting is bounded and valid final JSON remains deliverable', async () => {
  const { api } = load(async () => response(final()));
  const { input } = args({ limits: { accountingTimeoutMs: 20 }, onAttempt: async () => new Promise(() => {}) });
  const result = await api.generateGeminiToolConversation(input);
  assert.equal(result.accountingComplete, false); assert.equal(result.attempts, 1);
});

test('non-cooperative admission reaches turn deadline without making a paid call', async () => {
  const { api } = load(() => assert.fail('NO_FETCH'));
  const { input, reports } = args({ limits: { timeoutMs: 20 }, beforeAttempt: async () => new Promise(() => {}) });
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_STOPPED/);
  assert.equal(reports.length, 0);
});

test('parent abort before admission does not invoke fetch or charge anything', async () => {
  const parent = new AbortController(); parent.abort();
  const { api } = load(() => assert.fail('NO_FETCH'));
  const { input, reports, admissions } = args({ signal: parent.signal });
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_STOPPED/);
  assert.equal(reports.length, 0); assert.equal(admissions.length, 0);
});

test('abort after reservation before fetch releases via dispatched=false report', async () => {
  const parent = new AbortController();
  const { api } = load(() => assert.fail('NO_FETCH'));
  const { input, reports } = args({ signal: parent.signal, beforeAttempt: async () => { parent.abort(); return { reservationId: 'reserved' }; } });
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_STOPPED/);
  assert.equal(reports.length, 1); assert.equal(reports[0].dispatched, false);
  assert.equal(reports[0].reservationId, 'reserved');
});

test('deadline stops non-cooperative fetch and still calls accounting with unknown usage', async () => {
  let signal;
  const { api } = load(async (_url, init) => { signal = init.signal; return new Promise(() => {}); });
  const { input, reports } = args({ limits: { timeoutMs: 25 } });
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_STOPPED/);
  assert.equal(signal.aborted, true); assert.equal(reports.length, 1); assert.equal(reports[0].usage, null);
});

test('deadline applies across readonly tools and stops all subsequent provider calls', async () => {
  let attempts = 0, toolSignal;
  const { api } = load(async () => { attempts++; return response(payload([call()])); });
  const { input } = args({ limits: { timeoutMs: 25 } });
  input.tools[0].execute = async (_args, context) => { toolSignal = context.signal; return new Promise(() => {}); };
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_STOPPED/);
  assert.equal(attempts, 1); assert.equal(toolSignal.aborted, true);
});

test('stream response size/timeout cancels the reader and accounts unknown usage', async () => {
  for (const oversized of [true, false]) {
    let cancelled = false;
    const { api } = load(async () => new Response(new ReadableStream({ start(controller) {
      if (oversized) controller.enqueue(new TextEncoder().encode('x'.repeat(300)));
    }, cancel() { cancelled = true; } })));
    const { input, reports } = args({ limits: { timeoutMs: 25, maxResponseBytes: 200 } });
    await assert.rejects(() => api.generateGeminiToolConversation(input), oversized ? /AI_TOOL_RESPONSE_TOO_LARGE/ : /AI_TOOL_STOPPED/);
    assert.equal(cancelled, true); assert.equal(reports[0].usage, null);
  }
});

test('UTF8 request byte cap applies before reservation and can be increased for image input', async () => {
  let attempts = 0;
  const { api } = load(async () => { attempts++; return response(final()); });
  const imageBody = body({ contents: [{ role: 'user', parts: [{ text: 'Ж'.repeat(100) }, { inlineData: { mimeType: 'image/jpeg', data: 'a'.repeat(280000) } }] }] });
  const { input, admissions } = args({ body: imageBody });
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_REQUEST_TOO_LARGE/);
  assert.equal(attempts, 0); assert.equal(admissions.length, 0);
  input.limits = { maxRequestBytes: 300000 };
  assert.equal((await api.generateGeminiToolConversation(input)).attempts, 1);
});

test('bounded tool results cannot inflate follow-up requests or cause paid retries', async () => {
  let attempts = 0;
  const { api } = load(async () => { attempts++; return response(payload([call()])); });
  const { input, reports } = args({ limits: { maxToolResultBytes: 40 } });
  input.tools[0].execute = async () => ({ nodes: 'x'.repeat(50) });
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_RESULT_TOO_LARGE/);
  assert.equal(attempts, 1); assert.equal(reports.length, 1);
});

test('aggregate follow-up body cap is checked before reserving another attempt', async () => {
  let attempts = 0;
  const { api } = load(async () => { attempts++; return response(payload([call()])); });
  const { input, admissions } = args({ limits: { maxRequestBytes: 2000 } });
  input.tools[0].execute = async () => ({ nodes: 'x'.repeat(1800) });
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_REQUEST_TOO_LARGE/);
  assert.equal(attempts, 1); assert.equal(admissions.length, 1);
});

test('readonly unavailable result reaches model honestly; callback exceptions are sanitized and never retried', async () => {
  const requests = [], queue = [payload([call()]), final('Ask again later')];
  const { api } = load(async (_url, init) => { requests.push(JSON.parse(init.body)); return response(queue.shift()); });
  const { input } = args();
  input.tools[0].execute = async () => ({ action: 'CATALOG_UNAVAILABLE', complete: false, classificationAuthority: 'NONE' });
  await api.generateGeminiToolConversation(input);
  assert.equal(requests[1].contents.at(-1).parts[0].functionResponse.response.classificationAuthority, 'NONE');
  const second = load(async () => response(payload([call()]))), broken = args();
  broken.input.tools[0].execute = async () => { throw new Error('PRIVATE_SQL_DETAIL'); };
  await assert.rejects(() => second.api.generateGeminiToolConversation(broken.input), /AI_TOOL_READ_FAILED/);
  assert.equal(broken.reports.length, 1);
});

test('non-readonly tools and unstructured bodies fail before any paid admission', async () => {
  const { api } = load(() => assert.fail('NO_FETCH'));
  for (const mutation of [input => { input.tools[0].readOnly = false; }, input => { input.body = '{"generationConfig":{}}'; }]) {
    const { input, admissions } = args(); mutation(input);
    await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_INVALID_CONFIG/);
    assert.equal(admissions.length, 0);
  }
});

function withoutTiming(logs) {
  for (const item of logs.filter(row=>row[0]==='AI_PHASE_MS')) {
    assert.equal(item.length,4);
    assert.match(item[1],/^[A-Z_]+$/);
    assert.ok(Number.isFinite(item[2])&&item[2]>=0);
    assert.ok(['SUCCEEDED','FAILED'].includes(item[3]));
  }
  return logs.filter(row=>row[0]!=='AI_PHASE_MS');
}
