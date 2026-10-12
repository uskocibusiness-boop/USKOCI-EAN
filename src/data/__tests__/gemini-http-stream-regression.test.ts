import { GeminiCreditsUnavailableError, streamGeminiTask } from '../../../supabase/functions/_shared/geminiTaskStream';

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
