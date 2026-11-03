/** Independent accounting review of the actual bridge; synthetic sockets, no provider calls. */
import { bridgeSpeech } from '../../../../supabase/functions/uskoci-speech-session/proxy';

class ReviewSocket {
  readyState: WebSocket['readyState'] = 1;
  bufferedAmount = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  send = jest.fn();
  close = jest.fn(() => { this.readyState = 3; });
  message(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent); }
}

function accountingHarness(failAt?: 'setup' | 'start') {
  const client = new ReviewSocket(), provider = new ReviewSocket(), finished = jest.fn();
  if (failAt) provider.send.mockImplementation(raw => {
    const message = JSON.parse(raw);
    if ((failAt === 'setup' && message.setup) || (failAt === 'start' && message.realtimeInput?.activityStart)) {
      throw new Error('synthetic private provider transport failure');
    }
  });
  bridgeSpeech(client, provider, 'owned-conversation', 'owned-operation', finished);
  provider.onopen?.({} as Event);
  provider.message({ setupComplete: {} });
  return { client, provider, finished };
}

describe('speech accounting observed-output fence', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it.each(['interimInputTranscription', 'inputTranscription'] as const)
  ('cannot erase observed provider output with a later empty %s', field => {
    const h = accountingHarness();
    h.provider.message({ serverContent: { interimInputTranscription: { text: 'observed output' } } });
    h.provider.message({ serverContent: { [field]: { text: '' } } });
    h.client.message({ kind: 'cancel' });
    expect(h.finished).toHaveBeenCalledTimes(1);
    const [completed, audioBytes, observedOutput] = h.finished.mock.calls[0];
    expect(completed).toBe(false);
    expect(audioBytes).toBe(0);
    // The Edge releases only (false, 0, 0); an emptied display buffer is not no output.
    expect(observedOutput).toBeGreaterThan(0);
  });

  it('retains the zero-audio observed-output evidence when sending the segment to the client fails', () => {
    const h = accountingHarness();
    h.client.send.mockImplementationOnce(() => { throw new Error('synthetic client disconnect'); });
    h.provider.message({ serverContent: { interimInputTranscription: { text: 'observed output' } } });
    expect(h.finished).toHaveBeenCalledTimes(1);
    expect(h.finished).toHaveBeenCalledWith(false, 0, expect.any(Number));
    expect(h.finished.mock.calls[0][2]).toBeGreaterThan(0);
  });

  it('preserves the positive unsent cancellation release evidence', () => {
    const h = accountingHarness();
    h.client.message({ kind: 'cancel' });
    h.client.onclose?.({} as CloseEvent);
    expect(h.finished).toHaveBeenCalledTimes(1);
    expect(h.finished).toHaveBeenCalledWith(false, 0, 0);
  });

  it('reports a fully completed provider turn even when delivery of the final client frame fails', () => {
    const h = accountingHarness();
    h.client.message({ kind: 'audio', sequence: 0, pcmBase64: 'AAAAAAAA' });
    h.provider.message({ serverContent: { interimInputTranscription: { text: 'a longer interim output than the final transcript' } } });
    h.provider.message({ serverContent: { inputTranscription: { text: 'Dve osobe.' } } });
    h.client.message({ kind: 'release' });
    h.client.send.mockImplementationOnce(() => { throw new Error('synthetic final delivery failure'); });
    h.provider.message({ serverContent: { generationComplete: true } });
    expect(h.finished).toHaveBeenCalledTimes(1);
    expect(h.finished).toHaveBeenCalledWith(true, 6, 10);
  });

  it.each(['setup', 'start'] as const)('contains a %s send failure before audio and closes exactly once', failAt => {
    const h = accountingHarness(failAt);
    expect(h.finished).toHaveBeenCalledTimes(1);
    expect(h.finished).toHaveBeenCalledWith(false, 0, 0);
    expect(h.provider.close).toHaveBeenCalledTimes(1);
    expect(h.client.close).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.client.send.mock.calls)).not.toContain('private provider');
  });

  it.each([false, true])('contains activityEnd failure and preserves whether audio was attempted: %s', sentAudio => {
    const h = accountingHarness();
    if (sentAudio) h.client.message({ kind: 'audio', sequence: 0, pcmBase64: 'AAAAAAAA' });
    h.provider.send.mockImplementationOnce(() => { throw new Error('synthetic activityEnd failure'); });
    expect(() => h.client.message({ kind: 'release' })).not.toThrow();
    expect(h.finished).toHaveBeenCalledTimes(1);
    expect(h.finished).toHaveBeenCalledWith(false, sentAudio ? 6 : 0, 0);
    expect(h.provider.close).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not mistake provider completion with remaining interim text for full completion', () => {
    const h = accountingHarness();
    h.client.message({ kind: 'audio', sequence: 0, pcmBase64: 'AAAAAAAA' });
    h.provider.message({ serverContent: { inputTranscription: { text: 'first' } } });
    h.provider.message({ serverContent: { interimInputTranscription: { text: 'unfinished' } } });
    h.client.message({ kind: 'release' });
    h.provider.message({ serverContent: { generationComplete: true } });
    h.client.message({ kind: 'cancel' });
    expect(h.finished).toHaveBeenCalledTimes(1);
    expect(h.finished).toHaveBeenCalledWith(false, 6, expect.any(Number));
    expect(h.finished.mock.calls[0][2]).toBeGreaterThan(0);
  });

  it('cannot revise unknown audio accounting when an already queued binary provider frame decodes after cancellation', async () => {
    const h = accountingHarness();
    h.client.message({ kind: 'audio', sequence: 0, pcmBase64: 'AAAAAAAA' });
    h.client.message({ kind: 'release' });
    const data = new TextEncoder().encode(JSON.stringify({ serverContent: {
      inputTranscription: { text: 'late transcript' }, generationComplete: true,
    } })).buffer;
    h.provider.onmessage?.({ data } as MessageEvent);
    h.client.message({ kind: 'cancel' });
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
    expect(h.finished).toHaveBeenCalledTimes(1);
    expect(h.finished).toHaveBeenCalledWith(false, 6, 0);
    expect(h.provider.close).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
