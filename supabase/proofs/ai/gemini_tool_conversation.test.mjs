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

test('verified direct answer uses one structured request without tools and accepts only after accounting', async () => {
  const requests = [], events = [];
  const { api } = load(async (_url, init) => { requests.push(JSON.parse(init.body)); return response(final()); });
  const { input, admissions, reads } = args({ parseFinal: JSON.parse,
    onAttempt: async report => { events.push(`account:${report.attempt}`); await Promise.resolve(); events.push('settled'); },
    directFirst: { accept: async raw => {
      assert.deepEqual(events, ['account:1', 'settled']); events.push('verify');
      return JSON.parse(raw).assistantMessage === 'SYNTHETIC_OK';
    } },
  });
  const result = await api.generateGeminiToolConversation(input);
  assert.equal(result.attempts, 1); assert.equal(result.toolCalls, 0); assert.equal(reads.length, 0);
  assert.equal(result.value.assistantMessage, 'SYNTHETIC_OK'); assert.equal(result.accountingComplete, true);
  assert.equal(admissions.length, 1); assert.equal(admissions[0].phase, 'FINAL');
  assert.ok(!('tools' in requests[0])); assert.ok(!('toolConfig' in requests[0]));
  assert.equal(requests[0].generationConfig.responseMimeType, 'application/json');
  assert.equal(requests[0].generationConfig.responseSchema.type, 'OBJECT');
  assert.doesNotMatch(requests[0].systemInstruction.parts.at(-1).text, /research.*closed|No further tool calls/i);
});

test('rejected direct candidate stays private and research preserves all model parts under the same attempt budget', async () => {
  const initial = [{ thought: true, text: 'PRIVATE_THOUGHT', thoughtSignature: 'opaque_first' },
    { text: JSON.stringify({ assistantMessage: 'UNVERIFIED_CANDIDATE', facts: ['budget retained'] }), thoughtSignature: 'opaque_json' }];
  const queue = [payload(initial), payload([call('research')]), final('VERIFIED_FINAL')], requests = [], order = [];
  const { api } = load(async (_url, init) => {
    order.push('fetch'); requests.push(JSON.parse(init.body)); return response(queue.shift());
  });
  const { input, reports, admissions, reads } = args({ parseFinal: JSON.parse,
    body:body({systemInstruction:{role:'system',parts:[{text:'FULL_RESEARCH_RULES'}]}}),
    directFirst: { systemParts:[{text:'CURRENT_SEED_RULES'}], accept: async () => { order.push('verify'); return false; } },
  });
  const settle = input.onAttempt;
  input.onAttempt = async report => { await settle(report); order.push(`settled:${report.attempt}`); };
  const result = await api.generateGeminiToolConversation(input);
  assert.equal(result.value.assistantMessage, 'VERIFIED_FINAL'); assert.ok(!result.raw.includes('UNVERIFIED'));
  assert.equal(result.attempts, 3); assert.equal(result.toolCalls, 1); assert.equal(reads.length, 1);
  assert.deepEqual(order.slice(0, 4), ['fetch', 'settled:1', 'verify', 'fetch']);
  assert.deepEqual(admissions.map(x => x.attempt), [1, 2, 3]);
  assert.deepEqual(reports.map(x => x.reservationId), ['reservation_1', 'reservation_2', 'reservation_3']);
  assert.equal(requests[0].systemInstruction.role,'system');
  assert.deepEqual(requests[0].systemInstruction.parts[0],{text:'CURRENT_SEED_RULES'});
  assert.ok(!JSON.stringify(requests[0].systemInstruction).includes('FULL_RESEARCH_RULES'));
  for(const request of requests.slice(1))assert.deepEqual(request.systemInstruction.parts,[{text:'FULL_RESEARCH_RULES'}]);
  for(const request of requests)assert.deepEqual(request.generationConfig.responseSchema,requests[0].generationConfig.responseSchema);
  for(let index=0;index<requests.length;index++){
    assert.equal(admissions[index].requestBytes,Buffer.byteLength(JSON.stringify(requests[index])));
    assert.equal(reports[index].requestBytes,admissions[index].requestBytes);
  }
  assert.deepEqual(requests[1].contents[1], content(initial));
  assert.equal(requests[1].contents[2].role, 'user');
  assert.match(requests[1].contents[2].parts[0].text, /unverified.*not been applied or shown/);
  assert.equal(requests[1].tools[0].functionDeclarations[0].name, 'search_catalog');
  assert.deepEqual(requests[2].contents[3], content([call('research')]));
  assert.deepEqual(plain(result.usage), { promptTokens: 120, outputTokens: 45, totalTokens: 165 });
});

test('first phase text parts reject malformed or oversized context before provider admission',async()=>{
  const {api}=load(async()=>assert.fail('provider must not be called'));
  for(const systemParts of [null,[],[{}],[{text:''}],[{text:7}],[{text:'ok',inlineData:{data:'untrusted'}}]]){
    const {input,admissions}=args({directFirst:{systemParts,accept:async()=>true}});
    await assert.rejects(api.generateGeminiToolConversation(input),/AI_TOOL_INVALID_CONFIG/);
    assert.equal(admissions.length,0);
  }
  const {input,admissions}=args({limits:{maxRequestBytes:1000},
    directFirst:{systemParts:[{text:'ž'.repeat(1000)}],accept:async()=>true}});
  await assert.rejects(api.generateGeminiToolConversation(input),/AI_TOOL_REQUEST_TOO_LARGE/);
  assert.equal(admissions.length,0);
});

test('final-only continuation restores research rules and the retained schema after direct rejection',async()=>{
  const requests=[];
  const {api}=load(async(_url,init)=>{requests.push(JSON.parse(init.body));return response(final());});
  const {input,reports}=args({body:body({systemInstruction:{parts:[{text:'RESEARCH'}]}}),limits:{maxToolRounds:1},
    directFirst:{systemParts:[{text:'DIRECT'}],accept:async()=>false}});
  await api.generateGeminiToolConversation(input);
  assert.equal(requests.length,2);assert.equal(reports.length,2);
  assert.deepEqual(requests[1].systemInstruction.parts[0],{text:'RESEARCH'});
  assert.match(requests[1].systemInstruction.parts.at(-1).text,/research for this turn is closed/);
  assert.equal(requests[1].tools,undefined);
  assert.deepEqual(requests[1].generationConfig.responseSchema,requests[0].generationConfig.responseSchema);
});

test('direct rejection never increases the call ceiling and the last slot is always final-only', async () => {
  for (const maxToolRounds of [0, 1, 2, 3]) {
    const requests = [];
    const { api } = load(async (_url, init) => {
      const request = JSON.parse(init.body); requests.push(request);
      return response(request.tools ? payload([call(`round_${requests.length}`)]) : final());
    });
    const { input, reports, reads } = args({ limits: { maxToolRounds }, directFirst: { accept: async () => false } });
    if (maxToolRounds === 0) await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_TURN_BUDGET/);
    else assert.equal((await api.generateGeminiToolConversation(input)).attempts, maxToolRounds + 1);
    assert.equal(requests.length, maxToolRounds + 1); assert.equal(reports.length, requests.length);
    assert.equal(reads.length, Math.max(0, maxToolRounds - 1));
    assert.ok(!('tools' in requests.at(-1)));
    if (maxToolRounds > 0) assert.match(requests.at(-1).systemInstruction.parts.at(-1).text, /NEEDS_REVIEW/);
  }
});

test('accounting failure can deliver an accepted direct answer but never permits a rejected one to retry', async () => {
  for (const accepted of [true, false]) {
    let requests = 0, checked = 0;
    const { api } = load(async () => { requests++; return response(final()); });
    const { input, reads } = args({ onAttempt: async () => { throw new Error('PRIVATE_ACCOUNTING'); },
      directFirst: { accept: async () => { checked++; return accepted; } },
    });
    if (accepted) assert.equal((await api.generateGeminiToolConversation(input)).accountingComplete, false);
    else await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_ACCOUNTING_FAILED/);
    assert.equal(requests, 1); assert.equal(checked, 1); assert.equal(reads.length, 0);
  }
});

test('unknown direct usage remains a full allocation hold before any research continuation', async () => {
  let requests = 0;
  const { api } = load(async () => { requests++; return response(final('UNVERIFIED', null)); });
  const { input, reports, admissions } = args({ limits: { maxOutputTokens: 100, maxTurnOutputTokens: 100 },
    directFirst: { accept: async () => false },
  });
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_TOKEN_BUDGET/);
  assert.equal(requests, 1); assert.equal(admissions.length, 1);
  assert.equal(reports[0].usage, null); assert.equal(reports[0].attemptUsageComplete, false);
});

test('known research usage is still settleable after a direct attempt with unknown usage', async () => {
  const requests = [], queue = [final('UNVERIFIED', null), final('VERIFIED')];
  const { api } = load(async (_url, init) => { requests.push(JSON.parse(init.body)); return response(queue.shift()); });
  const { input, reports } = args({ limits: { maxOutputTokens: 100, maxTurnOutputTokens: 120 },
    directFirst: { accept: async () => false },
  });
  const result = await api.generateGeminiToolConversation(input);
  assert.equal(result.attempts, 2); assert.equal(result.usageComplete, false);
  assert.equal(reports[0].usage, null); assert.equal(reports[1].attemptUsageComplete, true);
  assert.equal(reports[1].usage.outputTokens, 15);
  assert.deepEqual(requests.map(x => x.generationConfig.maxOutputTokens), [100, 20]);
});

test('direct predicate errors and invalid decisions are sanitized failures, never model retries', async () => {
  for (const accept of [async () => { throw new Error('PRIVATE_DOMAIN_DETAIL'); }, async () => undefined]) {
    let requests = 0;
    const { api } = load(async () => { requests++; return response(final()); });
    const { input, reports } = args({ directFirst: { accept } });
    await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_DIRECT_CHECK_FAILED/);
    assert.equal(requests, 1); assert.equal(reports.length, 1);
    assert.equal(reports[0].usage.outputTokens, 15);
  }
});

test('direct verification obeys parent cancellation and the same total deadline after settlement', async () => {
  for (const parentAbort of [true, false]) {
    const parent = new AbortController(); let requests = 0, entered;
    const verifying = new Promise(resolve => { entered = resolve; });
    const { api } = load(async () => { requests++; return response(final()); });
    const { input, reports } = args({ signal: parent.signal, limits: { timeoutMs: parentAbort ? 500 : 25 },
      directFirst: { accept: async () => { entered(); return new Promise(() => {}); } },
    });
    const pending = api.generateGeminiToolConversation(input);
    const rejected = assert.rejects(() => pending, /AI_TOOL_STOPPED/);
    await verifying;
    if (parentAbort) parent.abort();
    await rejected;
    assert.equal(requests, 1); assert.equal(reports.length, 1); assert.equal(reports[0].usage.outputTokens, 15);
  }
});

test('direct first does not recover provider, JSON or caller-schema failures as research', async () => {
  for (const kind of ['network', 'http', 'json', 'schema', 'unexpected_tool']) {
    let requests = 0, checked = 0;
    const { api } = load(async () => {
      requests++;
      if (kind === 'network') throw new Error('PRIVATE_NETWORK');
      if (kind === 'http') return new Response('{}', { status: 500 });
      if (kind === 'json') return response(payload([{ text: 'invalid' }]));
      return response(kind === 'unexpected_tool' ? payload([call()]) : final());
    });
    const { input, reports, reads } = args({ directFirst: { accept: async () => { checked++; return false; } },
      ...(kind === 'schema' ? { parseFinal: () => { throw new Error('PRIVATE_SCHEMA'); } } : {}),
    });
    await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_(UNAVAILABLE|INVALID_FINAL|UNEXPECTED_CALL)/);
    assert.equal(requests, 1); assert.equal(checked, 0); assert.equal(reports.length, 1); assert.equal(reads.length, 0);
  }
});

test('direct-first continuation body remains subject to byte limits before a second reservation', async () => {
  let requests = 0;
  const { api } = load(async () => { requests++; return response(final('x'.repeat(2000))); });
  const { input, admissions } = args({ limits: { maxRequestBytes: 1800 }, directFirst: { accept: async () => false } });
  await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_REQUEST_TOO_LARGE/);
  assert.equal(requests, 1); assert.equal(admissions.length, 1);
});

test('direct first is opt-in for combined mode with declared read tools only', async () => {
  const { api } = load(() => assert.fail('NO_FETCH'));
  for (const change of [{ mode: 'SEPARATE' }, { tools: [] }, { directFirst: { accept: null } }]) {
    const { input, admissions } = args({ directFirst: { accept: async () => true }, ...change });
    await assert.rejects(() => api.generateGeminiToolConversation(input), /AI_TOOL_INVALID_CONFIG/);
    assert.equal(admissions.length, 0);
  }
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
