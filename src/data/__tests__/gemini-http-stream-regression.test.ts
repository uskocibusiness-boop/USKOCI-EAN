import { GeminiCreditsUnavailableError, geminiRequestBody, streamGeminiTask } from '../../../supabase/functions/_shared/geminiTaskStream';

const savedFetch = globalThis.fetch;
const rawSecret = 'Samo za test: privatna adresa 42';
const request = JSON.stringify({
  contents: [{ role: 'user', parts: [{ text: rawSecret }] }],
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: { type: 'OBJECT', properties: { assistantMessage: { type: 'STRING' } } },
  },
});
const run = (signal?: AbortSignal, onText = jest.fn()) =>
  streamGeminiTask({
    url: 'https://provider.example.test/stream', key: 'test-only-not-a-real-key',
    body: request, signal, onText, timeoutMs: 30000,
  });

afterEach(() => {
  globalThis.fetch = savedFetch;
  jest.restoreAllMocks();
});

describe('Gemini HTTP failure never masks provider failure with an undefined variable', () => {
  it.each([400, 401, 429, 500, 503])('handles HTTP %i with a bounded safe error and no assistant text', async status => {
    const mock = jest.fn(async () => ({ status, ok: false, body: null } as Response));
    globalThis.fetch = mock as typeof fetch;
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const onText = jest.fn();

    await expect(run(undefined, onText)).rejects.toThrow('AI_STREAM_UNAVAILABLE');
    expect(mock).toHaveBeenCalledTimes(1);
    expect(onText).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith('GEMINI_STREAM_HTTP_FAILED', status, 'UNKNOWN', 'UNKNOWN', 'UNKNOWN');
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(rawSecret);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('test-only-not-a-real-key');
  });

  it('returns the dedicated, non-content-bearing credits error for HTTP 402', async () => {
    globalThis.fetch = jest.fn(async () => ({ status: 402, ok: false, body: null } as Response)) as typeof fetch;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const onText = jest.fn();
    await expect(run(undefined, onText)).rejects.toBeInstanceOf(GeminiCreditsUnavailableError);
    expect(onText).not.toHaveBeenCalled();
  });

  it('aborts before network access when the user already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const mock = jest.fn();
    globalThis.fetch = mock as typeof fetch;
    const onText = jest.fn();
    await expect(run(controller.signal, onText)).rejects.toThrow('AI_STREAM_STOPPED');
    expect(mock).not.toHaveBeenCalled();
    expect(onText).not.toHaveBeenCalled();
  });

  it('stops in-flight provider fetch when user cancels, without emitting text', async () => {
    const controller = new AbortController();
    const mock = jest.fn(() => new Promise<Response>(() => undefined));
    globalThis.fetch = mock as typeof fetch;
    const onText = jest.fn();
    const result = run(controller.signal, onText);
    controller.abort();
    await expect(result).rejects.toThrow('AI_STREAM_STOPPED');
    expect(mock).toHaveBeenCalledTimes(1);
    expect(onText).not.toHaveBeenCalled();
  });
});


describe('Optional Gemini taxonomy shadow is wire-safe and never overrides the interview', () => {
  const string = { type: 'STRING' };
  const layouts = [
    ['worker', {
      type: 'OBJECT', required: ['assistantMessage', 'safety', 'patch'],
      additionalProperties: false,
      properties: {
        assistantMessage: string, safety: string,
        patch: { type: 'OBJECT', properties: {
          skills: { type: 'ARRAY', items: string, minItems: 0, maxItems: 24 },
        }, additionalProperties: false },
      },
    }],
    ['need', {
      type: 'OBJECT', required: ['assistantMessage', 'safety', 'facts', 'dialogue'],
      additionalProperties: false,
      properties: {
        assistantMessage: string, safety: string,
        facts: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
          key: string, valueJson: string,
        }, additionalProperties: false }, maxItems: 12 },
        dialogue: { type: 'OBJECT', properties: { next: string } },
      },
    }],
  ] as const;

  it.each(layouts)('%s schema: optional shadow is a string and original provider contract survives serialization', (_purpose, baseline) => {
    const extended = { ...baseline, properties: {
      ...baseline.properties, classificationShadowJson: { type: 'STRING' },
    }};
    const requestWith = (schema: unknown) => JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: rawSecret }] }],
      generationConfig: {
        temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema,
      },
    });
    const before = JSON.parse(geminiRequestBody(requestWith(baseline)));
    const after = JSON.parse(geminiRequestBody(requestWith(extended)));
    const originalSchema = before.generationConfig.responseSchema;
    const wireSchema = after.generationConfig.responseSchema;
    expect(wireSchema.properties.classificationShadowJson).toEqual({ type: 'STRING' });
    const { classificationShadowJson: _metadata, ...core } = wireSchema.properties;
    expect(core).toEqual(originalSchema.properties);
    expect(wireSchema.required).toEqual(originalSchema.required);
    expect(wireSchema.required).not.toContain('classificationShadowJson');
    expect(wireSchema.properties).not.toHaveProperty('classificationShadow');
    expect(JSON.stringify(wireSchema)).not.toContain('additionalProperties');
    expect(JSON.stringify(wireSchema)).not.toContain('maxItems');
    expect(JSON.stringify(wireSchema)).not.toContain('minItems');
    expect(after.generationConfig.temperature).toBeUndefined();
    expect(after.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
    expect(JSON.stringify(baseline)).not.toContain('classificationShadowJson');
  });

  it.each(layouts)('%s schema: upstream HTTP 400 cannot leak interview content or silently start a second request', async (_purpose, baseline) => {
    const responseSchema = { ...baseline, properties: {
      ...baseline.properties, classificationShadowJson: { type: 'STRING' },
    }};
    const requestBody = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: rawSecret }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema },
    });
    const mock = jest.fn(async () => ({ status: 400, ok: false, body: null } as Response));
    globalThis.fetch = mock as typeof fetch;
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const onText = jest.fn();
    await expect(streamGeminiTask({
      url: 'https://provider.example.test/stream', key: 'test-only-not-a-real-key',
      body: requestBody, onText, timeoutMs: 30000,
    })).rejects.toThrow('AI_STREAM_UNAVAILABLE');
    expect(mock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(mock.mock.calls[0][1]?.body ?? ''));
    expect(sent.generationConfig.responseSchema.properties.classificationShadowJson)
      .toEqual({ type: 'STRING' });
    expect(onText).not.toHaveBeenCalled();
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(rawSecret);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('test-only-not-a-real-key');
  });
});
