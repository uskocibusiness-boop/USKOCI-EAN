const test = require('node:test');
const assert = require('node:assert/strict');

test('Gemini usage telemetry emits only validated count fields', async () => {
  const { recordGeminiUsage } = await import('../supabase/functions/_shared/aiPhaseTiming.mjs');
  const original = console.info;
  let captured;
  console.info = (...args) => { captured = args; };
  try {
    recordGeminiUsage('NEED', 'gemini-3.8-flash', 'SSE', {
      usage: { promptTokens: 940, outputTokens: 170, totalTokens: 1110 },
      promptTokens: 900,
      candidateTokens: 120,
      thoughtTokens: 50,
      toolUsePromptTokens: 40,
      cachedPromptTokens: 300,
      userText: 'PRIVATE USER TEXT MUST NOT APPEAR',
      requestId: 'private-request-id',
      providerBody: 'PRIVATE PROVIDER BODY MUST NOT APPEAR',
    });
  } finally {
    console.info = original;
  }
  assert.equal(captured?.[0], 'AI_USAGE_TOKENS');
  const event = JSON.parse(captured[1]);
  assert.deepEqual(event, {
    version: 1,
    purpose: 'NEED',
    model: 'gemini-3.8-flash',
    source: 'SSE',
    promptTokens: 940,
    outputTokens: 170,
    totalTokens: 1110,
    providerPromptTokens: 900,
    candidateTokens: 120,
    thoughtTokens: 50,
    toolUsePromptTokens: 40,
    cachedPromptTokens: 300,
  });
  assert.equal(JSON.stringify(event).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(event).includes('private-request-id'), false);
});

test('missing, malformed and untrusted usage values remain unknown', async () => {
  const { recordGeminiUsage } = await import('../supabase/functions/_shared/aiPhaseTiming.mjs');
  const original = console.info;
  let captured;
  console.info = (...args) => { captured = args; };
  try {
    recordGeminiUsage('OTHER', 'secret/key', 'UNKNOWN', {
      usage: null,
      promptTokens: null,
      candidateTokens: -1,
      thoughtTokens: '0',
      toolUsePromptTokens: undefined,
      cachedPromptTokens: 99,
      totalTokens: null,
    });
  } finally {
    console.info = original;
  }
  const event = JSON.parse(captured[1]);
  assert.equal(event.purpose, 'UNKNOWN');
  assert.equal(event.model, 'UNKNOWN');
  assert.equal(event.source, 'UNKNOWN');
  assert.equal(event.promptTokens, null);
  assert.equal(event.outputTokens, null);
  assert.equal(event.totalTokens, null);
  assert.equal(event.providerPromptTokens, null);
  assert.equal(event.candidateTokens, null);
  assert.equal(event.thoughtTokens, null);
  assert.equal(event.toolUsePromptTokens, null);
  assert.equal(event.cachedPromptTokens, 99);
});

test('telemetry logger failures never escape into the AI operation', async () => {
  const { recordGeminiUsage } = await import('../supabase/functions/_shared/aiPhaseTiming.mjs');
  const original = console.info;
  console.info = () => { throw new Error('log unavailable'); };
  try {
    assert.doesNotThrow(() => recordGeminiUsage('WORKER', 'gemini-3.8-flash', 'SSE', {}));
  } finally {
    console.info = original;
  }
});
