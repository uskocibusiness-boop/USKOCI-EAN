/** Real first-party decoder/proxy with synthetic sockets. No provider or physical-microphone claim. */
import { bridgeSpeech } from '../../../../supabase/functions/uskoci-speech-session/proxy';
import { decodeSpeechEvent, pcmBase64Bytes, SPEECH_LIMITS, SPEECH_PROTOCOL } from '../speechProtocol';

class Socket {
  readyState: WebSocket['readyState'] = 1;
  bufferedAmount = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  messages: Record<string, any>[] = [];
  close = jest.fn(() => { this.readyState = 3; });
  send = (text: string) => { this.messages.push(JSON.parse(text)); };
  message(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent); }
}
function harness() {
  const client = new Socket(), provider = new Socket();
  const dispose = bridgeSpeech(client, provider, 'owned-conversation', 'owned-operation');
  provider.onopen?.({} as Event);
  const ready = () => provider.message({ setupComplete: {} });
  return { client, provider, ready, dispose };
}

describe('bounded native STT proxy', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  // Proven against the provider on 2026-09-17: it answers the setup with
  // {"setupComplete": {}} delivered as a binary frame, not a string. A string-only reader
  // rejected that entirely valid reply and killed every speech session.
  it.each(['arraybuffer', 'blob'] as const)('accepts the provider setup when it arrives as a %s frame', async kind => {
    const h = harness();
    const bytes = new TextEncoder().encode(JSON.stringify({ setupComplete: {} }));
    const data: unknown = kind === 'arraybuffer' ? bytes.buffer : new Blob([bytes]);
    h.provider.onmessage?.({ data } as MessageEvent);
    // Blob.text() resolves through a stream, which needs a real macrotask to drain.
    jest.useRealTimers();
    await new Promise(resolve => setTimeout(resolve, 0));
    jest.useFakeTimers();
    expect(h.client.messages.filter(m => m.kind === 'error')).toHaveLength(0);
    h.client.message({ kind: 'audio', sequence: 0, pcmBase64: 'AAA=' });
    expect(h.provider.messages.at(-1)).toMatchObject({ realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000' } } });
  });

  it('locks the approved model and manual VAD, forwards real interim/final, completes only on release', () => {
    const h = harness();
    expect(h.provider.messages[0]).toMatchObject({ setup: { model: 'models/gemini-3.5-transcribe-live',
      generationConfig: { maxOutputTokens: 8192, responseModalities: ['TEXT'] },
      realtimeInputConfig: { automaticActivityDetection: { disabled: true } }, inputAudioTranscription: { languageCodes: ['sr-RS'], mode: 'VERBATIM' } } });
    h.ready(); h.client.message({ kind: 'audio', sequence: 0, pcmBase64: 'AAAA' });
    // Three decoded bytes are not valid PCM16 and are rejected before provider I/O.
    expect(h.provider.messages).toHaveLength(2); expect(h.client.messages.at(-1)).toMatchObject({ kind: 'error', code: 'SPEECH_INVALID' });
  });

  // Proven against gemini-3.5-transcribe-live on 2026-09-17 with 4.29 s of real speech:
  // after activityEnd the provider sends inputTranscription, then generationComplete: true
  // 306 ms later, and never turnComplete. Waiting for turnComplete alone timed out every
  // session with a perfect transcript already received.
  it('completes on the provider generationComplete after release, as the transcribe model actually signals', () => {
    const h = harness(); h.ready(); h.client.message({ kind: 'audio', sequence: 0, pcmBase64: 'AAA=' });
    h.provider.message({ serverContent: { interimInputTranscription: { text: 'Hello. I need help moving a sofa on Saturday.' } } });
    h.client.message({ kind: 'release' });
    expect(h.provider.messages.at(-1)).toEqual({ realtimeInput: { activityEnd: {} } });
    h.provider.message({ serverContent: { inputTranscription: { text: 'Hello. I need help moving a sofa on Saturday.' } } });
    expect(h.client.messages.some(message => message.kind === 'final')).toBe(false);
    h.provider.message({ serverContent: { generationComplete: true } });
    expect(h.client.messages.at(-1)).toMatchObject({ kind: 'final', text: 'Hello. I need help moving a sofa on Saturday.' });
  });

  // A fully completed session can use the existing estimate. Attempted input bytes
  // and observed output are not a provider invoice or proof of delivery.
  it('reports the forwarded audio bytes and transcript size when a transcribed session ends', () => {
    const finished = jest.fn();
    const client = new Socket(), provider = new Socket();
    bridgeSpeech(client, provider, 'owned-conversation', 'owned-operation', finished);
    provider.onopen?.({} as Event); provider.message({ setupComplete: {} });
    client.message({ kind: 'audio', sequence: 0, pcmBase64: 'AAAA' + 'AAAA' });   // 6 bytes of PCM16
    client.message({ kind: 'audio', sequence: 1, pcmBase64: 'AAAA' + 'AAAA' });   // 6 more
    provider.message({ serverContent: { inputTranscription: { text: 'Dve osobe.' } } });
    client.message({ kind: 'release' });
    provider.message({ serverContent: { generationComplete: true } });
    expect(finished).toHaveBeenCalledTimes(1);
    expect(finished).toHaveBeenCalledWith(true, 12, 'Dve osobe.'.length);
  });

  it('reports incomplete audio dispatch without a transcript, so its hold stays reserved', () => {
    const finished = jest.fn();
    const client = new Socket(), provider = new Socket();
    bridgeSpeech(client, provider, 'owned-conversation', 'owned-operation', finished);
    provider.onopen?.({} as Event); provider.message({ setupComplete: {} });
    client.message({ kind: 'audio', sequence: 0, pcmBase64: 'AAAA' + 'AAAA' });
    client.message({ kind: 'release' });
    jest.advanceTimersByTime(SPEECH_LIMITS.finalizationMs + 1);
    expect(finished).toHaveBeenCalledTimes(1);
    expect(finished).toHaveBeenCalledWith(false, 6, 0);
  });

  it('never lets generationComplete finish a gesture that is still held', () => {
    const h = harness(); h.ready(); h.client.message({ kind: 'audio', sequence: 0, pcmBase64: 'AAA=' });
    h.provider.message({ serverContent: { inputTranscription: { text: 'Dve osobe.' } } });
    h.provider.message({ serverContent: { generationComplete: true } });
    expect(h.client.messages.some(message => message.kind === 'final')).toBe(false);
    expect(h.client.messages.some(message => message.kind === 'error')).toBe(false);
  });

  it('one release produces one authoritative transcript with real server event identities', () => {
    const h = harness(); h.ready(); h.client.message({ kind: 'audio', sequence: 0, pcmBase64: 'AAA=' });
    h.provider.message({ serverContent: { interimInputTranscription: { text: 'Две' } } });
    expect(h.client.messages.at(-1)).toMatchObject({ kind: 'segment', final: false, index: 0, text: 'Две' });
    h.provider.message({ serverContent: { inputTranscription: { text: 'Две особе.' } } });
    expect(h.client.messages.some(message => message.kind === 'final')).toBe(false);
    h.client.message({ kind: 'release' });
    expect(h.provider.messages.at(-1)).toEqual({ realtimeInput: { activityEnd: {} } });
    h.provider.message({ serverContent: { turnComplete: true } });
    expect(h.client.messages.at(-1)).toMatchObject({ protocol: SPEECH_PROTOCOL, conversationId: 'owned-conversation',
      operationId: 'owned-operation', kind: 'final', text: 'Две особе.' });
    h.provider.message({ serverContent: { turnComplete: true, inputTranscription: { text: 'late' } } });
    expect(h.client.messages.filter(message => message.kind === 'final')).toHaveLength(1);
    expect(h.provider.close).toHaveBeenCalledTimes(1);
  });

  it('waits for a final transcription that arrives after provider turnComplete', () => {
    const h = harness(); h.ready(); h.client.message({ kind: 'release' });
    h.provider.message({ serverContent: { turnComplete: true } });
    expect(h.client.messages.some(message => message.kind === 'final')).toBe(false);
    h.provider.message({ serverContent: { inputTranscription: { text: 'Kasni konačni tekst' } } });
    expect(h.client.messages.at(-1)).toMatchObject({ kind: 'final', text: 'Kasni konačni tekst' });
  });

  it('a provider pause cannot finish a held gesture', () => {
    const h = harness(); h.ready(); h.provider.message({ serverContent: { inputTranscription: { text: 'Dve osobe.' }, turnComplete: true } });
    expect(h.client.messages.at(-1)).toMatchObject({ kind: 'error', code: 'SPEECH_INCOMPLETE' });
    expect(h.client.messages.some(message => message.kind === 'final')).toBe(false);
  });

  it('never promotes remaining interim text to final on release', () => {
    const h = harness(); h.ready(); h.provider.message({ serverContent: { interimInputTranscription: { text: 'nedovršeno' } } });
    h.client.message({ kind: 'release' }); h.provider.message({ serverContent: { turnComplete: true } });
    jest.advanceTimersByTime(SPEECH_LIMITS.finalizationMs);
    expect(h.client.messages.at(-1)).toMatchObject({ kind: 'error', code: 'SPEECH_TIMEOUT' });
    expect(h.client.messages.some(message => message.kind === 'final')).toBe(false);
  });

  it.each([{ kind: 'setup', model: 'unapproved' }, { kind: 'audio', sequence: 1, pcmBase64: 'AAA=' },
    { kind: 'audio', sequence: 0, pcmBase64: 'AAA=', extra: 'injected' }, { kind: 'release', tools: [{}] }])('rejects noncanonical client frame %j', frame => {
    const h = harness(); h.ready(); h.client.message(frame);
    expect(h.provider.messages).toHaveLength(2); expect(h.client.messages.at(-1)).toMatchObject({ kind: 'error', code: 'SPEECH_INVALID' });
  });

  it('stops at the audio-byte budget on the server even if client sends faster than real time', () => {
    const h = harness(); h.ready(); const frame = Buffer.alloc(3200).toString('base64');
    for (let sequence = 0; sequence < 1201; sequence++) h.client.message({ kind: 'audio', sequence, pcmBase64: frame });
    expect(h.provider.messages.filter(message => message.realtimeInput?.audio)).toHaveLength(1200);
    expect(h.client.messages.at(-1)).toMatchObject({ kind: 'error', code: 'SPEECH_LIMIT' });
  });

  it('does not buffer private audio after peer cancellation or backpressure', () => {
    const h = harness(); h.ready(); h.provider.bufferedAmount = SPEECH_LIMITS.outgoingBufferBytes + 1;
    h.client.message({ kind: 'audio', sequence: 0, pcmBase64: 'AAA=' });
    expect(h.provider.messages).toHaveLength(2); expect(h.provider.close).toHaveBeenCalledTimes(1);
    const second = harness(); second.ready(); second.client.message({ kind: 'cancel' });
    second.provider.message({ serverContent: { inputTranscription: { text: 'zakašnjela privatnost' } } });
    expect(second.client.messages).toHaveLength(1); expect(second.provider.close).toHaveBeenCalledTimes(1);
  });

  it('provider errors/tools never expose raw bodies or trigger tools', () => {
    const h = harness(); h.ready(); h.provider.message({ error: { message: 'SECRET_PROVIDER_BODY' }, toolCall: { name: 'publish' } });
    expect(h.client.messages.at(-1)).toMatchObject({ kind: 'error', code: 'SPEECH_UNAVAILABLE' });
    expect(JSON.stringify(h.client.messages)).not.toContain('SECRET'); expect(h.provider.messages).toHaveLength(2);
  });

  it('handles provider setup preceding the client WebSocket open event', () => {
    const h = harness(); h.client.readyState = 0; h.ready();
    expect(h.client.messages).toHaveLength(0); h.client.readyState = 1; h.client.onopen?.({} as Event);
    expect(h.client.messages.at(-1)).toMatchObject({ kind: 'ready' }); h.dispose();
  });
});

describe('native speech event decoder', () => {
  const base = { protocol: SPEECH_PROTOCOL, conversationId: 'owned', operationId: 'attempt', sequence: 0, kind: 'ready' };
  it('rejects crossed accounts/turns, duplicates, out-of-order sequences and extra content', () => {
    expect(decodeSpeechEvent(base, 'owned', 'attempt', 0)).toEqual(base);
    for (const event of [{ ...base, conversationId: 'foreign' }, { ...base, operationId: 'older' }, { ...base, sequence: 1 },
      { ...base, rawProvider: 'body' }, { ...base, kind: 'unknown' }]) expect(decodeSpeechEvent(event, 'owned', 'attempt', 0)).toBeNull();
    expect(decodeSpeechEvent(base, 'owned', 'attempt', 1)).toBeNull();
  });
  it('bounds text and PCM payloads', () => {
    expect(decodeSpeechEvent({ ...base, kind: 'final', text: 'x'.repeat(4001) }, 'owned', 'attempt', 0)).toBeNull();
    expect(pcmBase64Bytes('AAA=')).toBe(2);
    expect(pcmBase64Bytes('AAAA')).toBeNull();
    expect(pcmBase64Bytes('AAAA\n')).toBeNull();
    expect(pcmBase64Bytes(Buffer.alloc(3202).toString('base64'))).toBeNull();
  });
});
