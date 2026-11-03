import type { HoldToTalkOptions, VoiceScope } from '../holdToTalk';
import { SPEECH_PROTOCOL } from '../speechProtocol';

const mockPlatform = { OS: 'ios', isTV: false };
const mockAppListeners = new Set<(state: string) => void>();
const mockAppState = { currentState: 'active', addEventListener: jest.fn((_name, callback) => {
  mockAppListeners.add(callback); return { remove: () => mockAppListeners.delete(callback) };
}) };
const mockGetPermission = jest.fn();
const mockAskPermission = jest.fn();
const mockAudioMode = jest.fn();
const mockAndroidModule = jest.fn();
const mockStreams: MockStream[] = [];
let mockStart: (() => Promise<void>) | null = null;
class MockStream {
  sampleRate = 16000; channels = 1; isStreaming = false;
  listeners = new Map<string, (event: any) => void>();
  constructor(public options: object) { mockStreams.push(this); }
  start = jest.fn(async () => { await mockStart?.(); this.isStreaming = true; });
  stop = jest.fn(() => { this.isStreaming = false; });
  release = jest.fn();
  addListener = jest.fn((name: string, callback: (event: any) => void) => {
    this.listeners.set(name, callback); return { remove: () => this.listeners.delete(name) };
  });
  pcm(bytes = new Uint8Array([0, 64]), changes: object = {}) {
    this.listeners.get('audioStreamBuffer')?.({ data: bytes.buffer, sampleRate: 16000, channels: 1, timestamp: 0, ...changes });
    return bytes;
  }
}
jest.mock('react-native', () => ({ get Platform() { return mockPlatform; }, get AppState() { return mockAppState; },
  PermissionsAndroid: { check: () => { throw Error('Android permission used on iOS'); } },
  TurboModuleRegistry: { get: () => null } }));
jest.mock('expo', () => ({ requireOptionalNativeModule: (...args: unknown[]) => mockAndroidModule(...args) }));
jest.mock('expo-audio', () => ({ AudioModule: { get AudioStream() { return MockStream; } },
  getRecordingPermissionsAsync: (...args: unknown[]) => mockGetPermission(...args),
  requestRecordingPermissionsAsync: (...args: unknown[]) => mockAskPermission(...args),
  setAudioModeAsync: (...args: unknown[]) => mockAudioMode(...args) }));

import { createNativeSpeechAdapter } from '../nativeSpeechAdapter';
import { createExpoPcmCapture, requestExpoSpeechPermission } from '../expoPcmCapture';
import { HoldToTalkController } from '../holdToTalk';
import { createAudioArbiter } from '../../voiceMessages/ports';
import { answeringHost } from '../../../ui/permissions/testing/answeringHost';

const flush = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(yes => { resolve = yes; });
  return { promise, resolve };
};
class MockSocket {
  static instances: MockSocket[] = [];
  readyState = 1; bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null; onclose: (() => void) | null = null;
  messages: any[] = [];
  constructor(public url: string, _protocols: string[], public options: { headers: Record<string, string> }) { MockSocket.instances.push(this); }
  send(text: string) { this.messages.push(JSON.parse(text)); }
  close = jest.fn(() => { this.readyState = 3; });
  emit(sequence: number, body: object) {
    this.onmessage?.({ data: JSON.stringify({ protocol: SPEECH_PROTOCOL, conversationId: 'owned', operationId: 'op-1', sequence, ...body }) });
  }
}
const controllers: HoldToTalkController[] = [];
function fixture() {
  let scope: VoiceScope | null = { accountId: 'account-a', accountRevision: 1, conversationId: 'owned' };
  const onTranscript = jest.fn((_: Parameters<HoldToTalkOptions['onTranscript']>[0]) => true);
  const arbiter = createAudioArbiter();
  const adapter = createNativeSpeechAdapter({ arbiter, newOperationId: () => 'op-1',
    getConnection: async () => ({ url: 'https://owned.supabase.co', accessToken: 'SYNTHETIC_JWT', anonKey: 'PUBLIC_KEY' }) });
  const controller = new HoldToTalkController({ adapter, getScope: () => scope, onTranscript,
    limits: { permissionMs: 30000, captureMs: 120000, finalizationMs: 15000 } });
  controllers.push(controller);
  const begin = async () => {
    expect(controller.begin('press')).toBe(true); await flush();
    expect(controller.getSnapshot().phase).toBe('STARTING');
    expect(mockStreams).toHaveLength(0);
    const socket = MockSocket.instances[0]; expect(socket).toBeDefined();
    socket.emit(0, { kind: 'ready' }); await flush(); return socket;
  };
  const listen = async () => {
    const socket = await begin(); expect(controller.getSnapshot().phase).toBe('LISTENING');
    return { socket, stream: mockStreams[0] };
  };
  return { controller, adapter, arbiter, onTranscript, begin, listen,
    scope: (next: VoiceScope | null) => { scope = next; controller.contextChanged(); } };
}

describe('iOS speech through the real controller, adapter and Expo PCM seam (synthetic native I/O)', () => {
  const originalSocket = globalThis.WebSocket;
  const originalCapture = process.env.EXPO_PUBLIC_SPEECH_CAPTURE;
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks(); delete process.env.EXPO_PUBLIC_SPEECH_CAPTURE;
    mockPlatform.OS = 'ios'; mockPlatform.isTV = false; mockAppState.currentState = 'active';
    mockAppListeners.clear(); mockStreams.length = 0; MockSocket.instances = []; mockStart = null;
    mockGetPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    mockAskPermission.mockResolvedValue({ granted: true, canAskAgain: true }); mockAudioMode.mockResolvedValue(undefined);
    globalThis.WebSocket = MockSocket as unknown as typeof WebSocket;
  });
  afterEach(async () => {
    controllers.splice(0).forEach(controller => controller.dispose()); await flush();
    jest.clearAllTimers(); jest.useRealTimers(); globalThis.WebSocket = originalSocket;
    if (originalCapture === undefined) delete process.env.EXPO_PUBLIC_SPEECH_CAPTURE;
    else process.env.EXPO_PUBLIC_SPEECH_CAPTURE = originalCapture;
  });

  it('uses existing Expo iOS permission/capture without requiring the Android opt-in flag', async () => {
    const h = fixture(); const { socket, stream } = await h.listen();
    expect(mockGetPermission).toHaveBeenCalledTimes(1); expect(mockAndroidModule).not.toHaveBeenCalled();
    expect(stream.options).toEqual({ sampleRate: 16000, channels: 1, encoding: 'int16' });
    expect(mockAudioMode).toHaveBeenCalledWith({ allowsRecording: true, interruptionMode: 'doNotMix',
      shouldPlayInBackground: false, allowsBackgroundRecording: false });
    expect(socket.url).toBe('wss://owned.supabase.co/functions/v1/uskoci-speech-session?conversationId=owned&operationId=op-1');
    expect(socket.options.headers.Authorization).toBe('Bearer SYNTHETIC_JWT'); expect(socket.url).not.toContain('SYNTHETIC_JWT');
  });

  it('preserves the explicit Android Expo alternative without silently selecting the native fallback', async () => {
    mockPlatform.OS = 'android'; process.env.EXPO_PUBLIC_SPEECH_CAPTURE = 'expo';
    const h = fixture(); await h.listen();
    expect(mockGetPermission).toHaveBeenCalledTimes(1); expect(mockAndroidModule).not.toHaveBeenCalled();
    expect(mockStreams).toHaveLength(1);
  });

  it('streams bounded mono/int16 chunks, erases temporary PCM and hands off only the confirmed transcript', async () => {
    const h = fixture(); const { socket, stream } = await h.listen();
    const bytes = new Uint8Array(3202); bytes[1] = 64; stream.pcm(bytes);
    expect(socket.messages).toHaveLength(2); expect(socket.messages.map(value => value.sequence)).toEqual([0, 1]);
    expect(Buffer.from(socket.messages[0].pcmBase64, 'base64')).toHaveLength(3200);
    expect(Buffer.from(socket.messages[1].pcmBase64, 'base64')).toHaveLength(2);
    expect(bytes.every(value => value === 0)).toBe(true); expect(h.onTranscript).not.toHaveBeenCalled();
    h.controller.release('press'); await flush();
    expect(stream.release).toHaveBeenCalledTimes(1); expect(socket.messages.at(-1)).toEqual({ kind: 'release' });
    socket.emit(1, { kind: 'final', text: 'Треба ми помоћ.' }); await flush();
    expect(h.onTranscript).toHaveBeenCalledTimes(1); expect(h.onTranscript.mock.calls[0][0]).toMatchObject({ text: 'Treba mi pomoć.' });
  });

  it.each([false, true])('honors denied iOS permission (canAskAgain=%s) without opening audio or network', async canAskAgain => {
    mockGetPermission.mockResolvedValue({ granted: false, canAskAgain }); mockAskPermission.mockResolvedValue({ granted: false });
    const h = fixture(); h.controller.begin('press'); await flush();
    expect(h.controller.getSnapshot().error).toBe('MIC_PERMISSION_DENIED');
    expect(mockAskPermission).toHaveBeenCalledTimes(canAskAgain ? 1 : 0);
    expect(mockStreams).toHaveLength(0); expect(MockSocket.instances).toHaveLength(0);
  });

  it.each(['read', 'request'])('a missing or failing native permission %s remains unavailable without capture or provider I/O', async phase => {
    if (phase === 'read') mockGetPermission.mockRejectedValue(new Error('synthetic native module unavailable'));
    else {
      mockGetPermission.mockResolvedValue({ granted: false, canAskAgain: true });
      mockAskPermission.mockRejectedValue(new Error('synthetic permission API failure'));
    }
    const h = fixture(); h.controller.begin('press'); await flush();
    expect(h.controller.getSnapshot().error).toBe('MIC_UNAVAILABLE');
    expect(mockStreams).toHaveLength(0); expect(MockSocket.instances).toHaveLength(0); expect(h.onTranscript).not.toHaveBeenCalled();
  });

  it('keeps the existing explanatory permission choice and does not ask the OS after Ne sada', async () => {
    mockGetPermission.mockResolvedValue({ granted: false, canAskAgain: true });
    const host = answeringHost('later');
    try {
      const h = fixture(); h.controller.begin('press'); await flush();
      expect(host.asked).toEqual(['microphone']); expect(mockAskPermission).not.toHaveBeenCalled();
      expect(h.controller.getSnapshot()).toMatchObject({ phase: 'IDLE', error: null }); expect(MockSocket.instances).toHaveLength(0);
    } finally { host.stop(); }
  });

  it('release before server-ready cancels without ever acquiring a microphone', async () => {
    const h = fixture(); h.controller.begin('press'); await flush(); const socket = MockSocket.instances[0];
    h.controller.release('press'); socket.emit(0, { kind: 'ready' }); await flush();
    expect(mockStreams).toHaveLength(0); expect(socket.close).toHaveBeenCalledTimes(1); expect(h.onTranscript).not.toHaveBeenCalled();
  });

  it('a late iOS permission grant after release cannot open a provider connection or microphone', async () => {
    let grant!: (value: { granted: boolean; canAskAgain: boolean }) => void;
    mockGetPermission.mockReturnValue(new Promise(resolve => { grant = resolve; }));
    const h = fixture(); h.controller.begin('press'); await flush(); h.controller.release('press');
    grant({ granted: true, canAskAgain: true }); await flush();
    expect(mockStreams).toHaveLength(0); expect(MockSocket.instances).toHaveLength(0); expect(h.onTranscript).not.toHaveBeenCalled();
  });

  it('cancellation while audio policy is pending never starts a late native stream', async () => {
    const pending = deferred(); mockAudioMode.mockReturnValue(pending.promise);
    const h = fixture(); const socket = await h.begin(); h.controller.cancel('navigation');
    pending.resolve(); await flush();
    expect(mockStreams).toHaveLength(0); expect(socket.close).toHaveBeenCalledTimes(1); expect(h.onTranscript).not.toHaveBeenCalled();
  });

  it('cancellation during native start fences late PCM and waits for teardown before another audio owner', async () => {
    const pending = deferred(); mockStart = () => pending.promise;
    const h = fixture(); const socket = await h.begin(); const stream = mockStreams[0];
    const oldBuffer = stream.listeners.get('audioStreamBuffer'); h.controller.cancel('navigation');
    let claimed = false; const next = h.arbiter.claim('recording', async () => {}).then(lease => { claimed = true; return lease; });
    await flush(); expect(claimed).toBe(false); expect(stream.stop).toHaveBeenCalled();
    oldBuffer?.({ data: new Uint8Array([1, 0]).buffer, sampleRate: 16000, channels: 1, timestamp: 0 });
    expect(socket.messages.filter(value => value.kind === 'audio')).toHaveLength(0);
    pending.resolve(); await flush(); const lease = await next; lease();
    expect(stream.isStreaming).toBe(false); expect(stream.release).toHaveBeenCalledTimes(1); expect(h.onTranscript).not.toHaveBeenCalled();
  });

  it.each(['account', 'focus', 'background'] as const)('stops recording and discards old callbacks after %s loss', async reason => {
    const h = fixture(); const { socket, stream } = await h.listen();
    const oldBuffer = stream.listeners.get('audioStreamBuffer'); const oldMessage = socket.onmessage;
    if (reason === 'account') h.scope({ accountId: 'account-b', accountRevision: 2, conversationId: 'other' });
    if (reason === 'focus') { h.scope(null); h.controller.cancel('navigation'); }
    if (reason === 'background') {
      mockAppState.currentState = 'inactive'; [...mockAppListeners].forEach(callback => callback('inactive'));
      h.controller.setForeground(false);
    }
    await flush();
    oldBuffer?.({ data: new Uint8Array([1, 0]).buffer, sampleRate: 16000, channels: 1, timestamp: 0 });
    oldMessage?.({ data: JSON.stringify({ protocol: SPEECH_PROTOCOL, conversationId: 'owned', operationId: 'op-1', sequence: 1, kind: 'final', text: 'old' }) });
    expect(stream.isStreaming).toBe(false); expect(stream.release).toHaveBeenCalledTimes(1); expect(socket.close).toHaveBeenCalledTimes(1);
    expect(h.onTranscript).not.toHaveBeenCalled(); expect(socket.messages.filter(value => value.kind === 'audio')).toHaveLength(0);
    expect(h.controller.getSnapshot()).toMatchObject({ phase: 'IDLE', fallbackText: '', finalText: '' });
  });

  it.each(['status', 'stall'] as const)('stops on an observed %s interruption and never resumes automatically', async kind => {
    const h = fixture(); const { socket, stream } = await h.listen();
    if (kind === 'status') stream.listeners.get('audioStreamStatus')?.({ isStreaming: false });
    else jest.advanceTimersByTime(3000);
    await flush();
    expect(h.controller.getSnapshot().error).toBe('AUDIO_INTERRUPTED'); expect(stream.release).toHaveBeenCalledTimes(1);
    expect(socket.messages.some(value => value.kind === 'release')).toBe(false); expect(h.onTranscript).not.toHaveBeenCalled();
    mockAppState.currentState = 'active'; [...mockAppListeners].forEach(callback => callback('active')); await flush();
    expect(mockStreams).toHaveLength(1); expect(stream.start).toHaveBeenCalledTimes(1);
  });

  it('does not adopt an old final transcript after A-to-B-to-A while finalization was pending', async () => {
    const h = fixture(); const { socket } = await h.listen(); h.controller.release('press'); await flush();
    expect(socket.messages.at(-1)).toEqual({ kind: 'release' }); const oldMessage = socket.onmessage;
    h.scope({ accountId: 'account-b', accountRevision: 2, conversationId: 'other' });
    h.scope({ accountId: 'account-a', accountRevision: 3, conversationId: 'owned' });
    oldMessage?.({ data: JSON.stringify({ protocol: SPEECH_PROTOCOL, conversationId: 'owned', operationId: 'op-1', sequence: 1, kind: 'final', text: 'old' }) });
    await flush(); expect(h.onTranscript).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot()).toMatchObject({ phase: 'IDLE', fallbackText: '', finalText: '' });
  });

  it.each([{ sampleRate: 48000 }, { channels: 2 }, { timestamp: -1 }])('rejects incompatible PCM metadata %j', async metadata => {
    const h = fixture(); const { socket, stream } = await h.listen(); stream.pcm(undefined, metadata); await flush();
    expect(socket.messages.filter(value => value.kind === 'audio')).toHaveLength(0); expect(stream.release).toHaveBeenCalledTimes(1);
    expect(h.onTranscript).not.toHaveBeenCalled();
  });

  it('does not treat a failed native stop as successful finalization or reusable microphone ownership', async () => {
    const h = fixture(); const { socket, stream } = await h.listen(); stream.stop.mockImplementation(() => { throw Error('synthetic stop failure'); });
    h.controller.release('press'); await flush();
    expect(socket.messages.some(value => value.kind === 'release')).toBe(false); expect(h.onTranscript).not.toHaveBeenCalled();
    await expect(h.arbiter.claim('recording', async () => {})).rejects.toThrow();
  });

  it.each(['web', 'windows'])('leaves unsupported platform %s unavailable without native or network calls', async platform => {
    mockPlatform.OS = platform; const h = fixture(); h.controller.begin('press'); await flush();
    expect(h.controller.getSnapshot().error).toBe('MIC_UNAVAILABLE'); expect(mockStreams).toHaveLength(0);
    expect(MockSocket.instances).toHaveLength(0); expect(mockGetPermission).not.toHaveBeenCalled();
  });

  it('does not admit television capture or a direct Expo start in the background', async () => {
    mockPlatform.isTV = true;
    expect(await requestExpoSpeechPermission(new AbortController().signal)).toBe('unavailable');
    await expect(createExpoPcmCapture().start('television', 1000)).rejects.toThrow('MIC_UNAVAILABLE');
    mockPlatform.isTV = false; mockAppState.currentState = 'background';
    await expect(createExpoPcmCapture().start('background', 1000)).rejects.toThrow('MIC_UNAVAILABLE');
    expect(mockGetPermission).not.toHaveBeenCalled(); expect(mockStreams).toHaveLength(0);
  });
});
