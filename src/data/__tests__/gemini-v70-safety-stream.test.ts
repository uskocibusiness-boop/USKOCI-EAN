import { TextDecoder } from 'util';
import { GeminiSafetyBlockedError, streamGeminiTask } from '../../../supabase/functions/_shared/geminiTaskStream';

const oldFetch = globalThis.fetch;
const oldDecoder = globalThis.TextDecoder;
const secret = 'Privatni podatak 42';
const body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: secret }] }],
  generationConfig: { responseMimeType: 'application/json',
    responseSchema: { type: 'OBJECT', properties: { assistantMessage: { type: 'STRING' } } } } });
const run = (onText = jest.fn()) => streamGeminiTask({
  url: 'https://provider.example.test/stream', key: 'dummy-key-only',
  body, onText, timeoutMs: 30000,
});
function sse(payload: unknown, withSeparator = true) {
  return 'data: ' + JSON.stringify(payload) + (withSeparator ? '\n\n' : '\n');
}
function response(...events: string[]): Response {
  const chunks = events.map(value => Uint8Array.from(Array.from(value).map(c => c.charCodeAt(0))));
  let offset = 0;
  return {
    ok: true, status: 200, redirected: false,
    headers: { get: () => 'text/event-stream' },
    body: { getReader: () => ({ read: async () =>
      offset < chunks.length ? { value: chunks[offset++], done: false } : { done: true },
    cancel: async () => undefined }) },
  } as unknown as Response;
}
function mockResponse(...events: string[]) {
  globalThis.fetch = jest.fn(async () => response(...events)) as typeof fetch;
}
beforeAll(() => {
  // React Native's Jest environment may omit this native Web Streams decoder.
  if (typeof globalThis.TextDecoder === 'undefined') globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
});
afterAll(() => { globalThis.TextDecoder = oldDecoder; });
afterEach(() => { globalThis.fetch = oldFetch; jest.restoreAllMocks(); jest.useRealTimers(); });

describe('exact DEV v70 Gemini safety paths, mirrored in source', () => {
  it.each(['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT'])('rejects candidate finishReason %s', async reason => {
    mockResponse(sse({ candidates: [{ finishReason: reason }] }));
    const onText = jest.fn();
    await expect(run(onText)).rejects.toMatchObject({ name: 'GeminiSafetyBlockedError', blockReason: reason });
    expect(onText).not.toHaveBeenCalled();
  });
  it('rejects prompt block before producing text, without reflecting provider details', async () => {
    mockResponse(sse({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] }));
    const onText = jest.fn();
    await expect(run(onText)).rejects.toBeInstanceOf(GeminiSafetyBlockedError);
    expect(onText).not.toHaveBeenCalled();
  });
  it('never exposes a provider-controlled unknown block reason via exception or log', async () => {
    mockResponse(sse({ promptFeedback: { blockReason: secret }, candidates: [] }));
    const onText = jest.fn();
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(run(onText)).rejects.toMatchObject({ blockReason: 'UNKNOWN', message: 'GEMINI_SAFETY_BLOCKED' });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secret);
    expect(onText).not.toHaveBeenCalled();
  });
  it('rejects a complete-looking SSE payload with no STOP receipt rather than inventing success', async () => {
    const onText = jest.fn();
    mockResponse(sse({ candidates: [{ content: { parts: [{ text: JSON.stringify({ assistantMessage: 'Zdravo' }) }] } }] }));
    await expect(run(onText)).rejects.toThrow('AI_STREAM_INCOMPLETE');
  });
  it('rejects malformed SSE without exposing provider payload', async () => {
    mockResponse('data: invalid JSON\n\n');
    const onText = jest.fn();
    await expect(run(onText)).rejects.toThrow();
    expect(onText).not.toHaveBeenCalled();
  });
  it('accepts a valid STOP event and emits only its assistantMessage', async () => {
    const onText = jest.fn();
    const responseBody = JSON.stringify({ assistantMessage: 'Dobar dan' });
    mockResponse(sse({ candidates: [{ content: { parts: [{ text: responseBody }] }, finishReason: 'STOP' }] }));
    await expect(run(onText)).resolves.toBe(responseBody);
    expect(onText).toHaveBeenCalledWith('Dobar dan');
    expect(JSON.stringify(onText.mock.calls)).not.toContain(secret);
  });
  it('cancels a stalled fetch after timeout without leaking a text delta', async () => {
    jest.useFakeTimers();
    const onText = jest.fn();
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => undefined)) as typeof fetch;
    const promise = run(onText);
    jest.advanceTimersByTime(30000);
    await expect(promise).rejects.toThrow('AI_STREAM_STOPPED');
    expect(onText).not.toHaveBeenCalled();
  });
});
