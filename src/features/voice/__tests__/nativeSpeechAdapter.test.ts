import type { SpeechEvent, VoiceSession } from '../holdToTalk';
import { SPEECH_PROTOCOL } from '../speechProtocol';

const mockListeners = new Map<string, (event: any) => void>();
const mockNative = { start: jest.fn(), stop: jest.fn(), addListener: jest.fn((name, callback) => {
  mockListeners.set(name, callback); return { remove: () => mockListeners.delete(name) };
}) };
const mockPermission = { check: jest.fn(async () => true), request: jest.fn(async () => 'granted'),
  PERMISSIONS: { RECORD_AUDIO: 'android.permission.RECORD_AUDIO' }, RESULTS: { GRANTED: 'granted' } };
// `PermissionsAndroid` is read when a permission is asked, not when the module is first required (the constant below is assigned
// after the imports run), so it is a getter: the tests that ask for the permission need the real double, not `undefined`.
jest.mock('react-native', () => ({ Platform: { OS: 'android' }, get PermissionsAndroid() { return mockPermission; },
  // Expo's lazy fetch initialization can load its optional JS logger when Jest
  // inspects globals. This test has no native logger, but the registry exists.
  TurboModuleRegistry: { get: () => null } }));
jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockNative }));
import { createNativeSpeechAdapter } from '../nativeSpeechAdapter';
import { answeringHost, holdingHost } from '../../../ui/permissions/testing/answeringHost';

const session: VoiceSession = { accountId: 'a', accountRevision: 3, conversationId: 'owned', generation: 5,
  gestureId: 'press', mode: 'hold', startedAt: 100 };
const flush = async () => { for (let n = 0; n < 5; n++) await Promise.resolve(); };
class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 1; bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null; onclose: (() => void) | null = null;
  messages: any[] = [];
  constructor(public url: string, public protocols: string[], public options: { headers: Record<string,string> }) { FakeSocket.instances.push(this); }
  send(text: string) { this.messages.push(JSON.parse(text)); }
  close = jest.fn(() => { this.readyState = 3; });
  emit(payload: unknown) { this.onmessage?.({ data: JSON.stringify(payload) }); }
}
const event = (sequence: number, body: object) => ({ protocol: SPEECH_PROTOCOL, conversationId: 'owned', operationId: 'op-1', sequence, ...body });
function fixture() {
  const controller = new AbortController(); let held = true;
  const events: SpeechEvent[] = [];
  const adapter = createNativeSpeechAdapter({ newOperationId: () => 'op-1',
    getConnection: async () => ({ url: 'https://owned.supabase.co', accessToken: 'SYNTHETIC_JWT', anonKey: 'PUBLIC_KEY' }) });
  const capture = adapter.createCapture({ session, signal: controller.signal, canCapture: () => held,
    onEvent: value => events.push(value) });
  const start = async () => {
    const running = capture.start(); await flush(); const socket = FakeSocket.instances[0];
    socket.emit(event(0, { kind: 'ready' })); await running; return socket;
  };
  return { adapter, capture, controller, events, start, release: () => { held = false; } };
}

describe('actual native PCM / first-party speech adapter with synthetic I/O', () => {
  const originalWebSocket = globalThis.WebSocket;
  beforeEach(() => { jest.clearAllMocks(); mockListeners.clear(); FakeSocket.instances = [];
    globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket; });
  afterAll(() => { globalThis.WebSocket = originalWebSocket; });

  it('does not record until the owned server is ready and keeps Auth out of URLs', async () => {
    const h = fixture(); const running = h.capture.start(); await flush();
    expect(mockNative.start).not.toHaveBeenCalled(); const ws = FakeSocket.instances[0];
    expect(ws.url).toBe('wss://owned.supabase.co/functions/v1/uskoci-speech-session?conversationId=owned&operationId=op-1');
    expect(ws.options.headers.Authorization).toBe('Bearer SYNTHETIC_JWT'); expect(ws.url).not.toContain('SYNTHETIC_JWT');
    ws.emit(event(0, { kind: 'ready' })); await running;
    expect(mockNative.start).toHaveBeenCalledWith('op-1', 120000); h.capture.dispose();
  });

  it('forwards native PCM only while held and finalizes once after stopping microphone', async () => {
    const h = fixture(); const ws = await h.start();
    mockListeners.get('pcm')?.({ sessionId: 'op-1', sequence: 0, pcmBase64: 'AAA=', rms: 0.25 });
    expect(ws.messages).toEqual([{ kind: 'audio', sequence: 0, pcmBase64: 'AAA=' }]);
    expect(h.events).toContainEqual({ kind: 'level', value: 0.25 });
    ws.emit(event(1, { kind: 'segment', index: 0, final: false, text: 'Dve' }));
    expect(h.events.at(-1)).toEqual({ kind: 'segment', index: 0, final: false, text: 'Dve' });
    h.release(); h.capture.stopCapture(); const final = h.capture.finalize();
    expect(mockNative.stop).toHaveBeenCalledTimes(1); expect(mockListeners.size).toBe(0);
    await flush(); // finalize waits for microphone teardown before sending the release frame.
    expect(ws.messages.at(-1)).toEqual({ kind: 'release' });
    ws.emit(event(2, { kind: 'final', text: 'Dve osobe' }));
    expect(await final).toEqual({ kind: 'final', text: 'Dve osobe' });
    expect(await h.capture.finalize()).toEqual({ kind: 'incomplete' });
    h.capture.dispose(); expect(mockNative.stop).toHaveBeenCalledTimes(1);
  });

  it('closes an opening socket after release and never starts late recording', async () => {
    const h = fixture(); const running = h.capture.start(); await flush(); const ws = FakeSocket.instances[0];
    h.release(); h.controller.abort(); await expect(running).rejects.toThrow('CAPTURE_CANCELLED');
    ws.emit(event(0, { kind: 'ready' })); expect(mockNative.start).not.toHaveBeenCalled();
    expect(ws.close).toHaveBeenCalledTimes(1);
  });

  it('accepts no old-turn, duplicate/out-of-order or raw provider messages', async () => {
    const h = fixture(); const ws = await h.start();
    ws.emit({ ...event(1, { kind: 'segment', index: 0, final: true, text: 'old data' }), operationId: 'old' });
    expect(h.events).toEqual([{ kind: 'error', code: 'CAPTURE_FAILED' }]); expect(ws.close).toHaveBeenCalledTimes(1);
    expect(mockNative.stop).toHaveBeenCalledTimes(1);
  });

  it('does not record when permission is denied after an aborted request', async () => {
    const h = fixture(); h.controller.abort(); expect(await h.adapter.requestPermission(h.controller.signal)).toBe('unavailable');
    expect(mockPermission.check).not.toHaveBeenCalled(); expect(mockNative.start).not.toHaveBeenCalled();
  });

  it('fences stale PCM and stops on native audio interruption', async () => {
    const h = fixture(); const ws = await h.start();
    mockListeners.get('pcm')?.({ sessionId: 'old', sequence: 0, pcmBase64: 'AAA=', rms: 1 });
    expect(ws.messages).toHaveLength(0);
    mockListeners.get('interrupted')?.({ sessionId: 'op-1', code: 'AUDIO_INTERRUPTED' });
    expect(h.events.at(-1)).toEqual({ kind: 'error', code: 'AUDIO_INTERRUPTED' });
    expect(mockNative.stop).toHaveBeenCalledTimes(1); expect(ws.close).toHaveBeenCalledTimes(1);
  });

  // Design proposal N (owner, 2026-10-07): the first press of a microphone is met by one question before the system's window.
  describe('the question before the microphone window', () => {
    let host: { stop(): void } | undefined;
    afterEach(() => { host?.stop(); host = undefined; mockPermission.check.mockImplementation(async () => true); });
    const notYet = () => mockPermission.check.mockImplementation(async () => false);

    it('is not asked when the microphone is already allowed', async () => {
      const asking = answeringHost('later'); host = asking;
      const h = fixture();
      expect(await h.adapter.requestPermission(h.controller.signal)).toBe('granted');
      expect(asking.asked).toEqual([]); expect(mockPermission.request).not.toHaveBeenCalled();
    });

    it('"Dozvoli": the system\'s own window follows, and its answer is the result', async () => {
      notYet(); const asking = answeringHost('allow'); host = asking;
      const h = fixture();
      expect(await h.adapter.requestPermission(h.controller.signal)).toBe('granted');
      expect(asking.asked).toEqual(['microphone']);
      expect(mockPermission.request).toHaveBeenCalledWith('android.permission.RECORD_AUDIO');
      mockPermission.request.mockResolvedValueOnce('denied');
      expect(await h.adapter.requestPermission(h.controller.signal)).toBe('denied');
    });

    it('"Ne sada": the system is not asked, nothing is recorded, and it is not a refusal', async () => {
      notYet(); const asking = answeringHost('later'); host = asking;
      const h = fixture();
      expect(await h.adapter.requestPermission(h.controller.signal)).toBe('later');
      expect(asking.asked).toEqual(['microphone']);
      expect(mockPermission.request).not.toHaveBeenCalled(); expect(mockNative.start).not.toHaveBeenCalled();
    });

    it('lets the hold go while the question is read: the gesture ends, but "Dozvoli" still reaches the system, for the next hold', async () => {
      notYet(); const held = holdingHost(); host = held;
      const h = fixture();
      const result = h.adapter.requestPermission(h.controller.signal);
      await flush();
      expect(held.open()?.kind).toBe('microphone');
      h.controller.abort();
      held.answer('allow');
      // The attempt is over, so the answer to it is not "granted" ...
      expect(await result).toBe('denied');
      // ... but the person said yes, so the system was asked, and the next hold finds the permission given.
      expect(mockPermission.request).toHaveBeenCalledTimes(1);
    });

    it('goes straight to the system when no host can draw the question', async () => {
      notYet();
      const h = fixture();
      expect(await h.adapter.requestPermission(h.controller.signal)).toBe('granted');
      expect(mockPermission.request).toHaveBeenCalledTimes(1);
    });
  });
});
