import { HoldToTalkController, type FinalTranscript, type HoldToTalkOptions, type NativeSpeechAdapter, type NativeSpeechCapture,
  type SpeechEvent, type VoiceScope } from '../holdToTalk';

const deferred = <T>() => {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let n = 0; n < 5; n++) await Promise.resolve(); };

function harness() {
  let scope: VoiceScope | null = { accountId: 'account-a', accountRevision: 1, conversationId: 'owned-conversation' };
  let emit: (event: SpeechEvent) => void = () => {};
  let canCapture: () => boolean = () => false;
  const permission = deferred<'granted' | 'denied' | 'unavailable' | 'later'>();
  const started = deferred<void>();
  const final = deferred<FinalTranscript>();
  const capture: NativeSpeechCapture = { start: jest.fn(() => started.promise), stopCapture: jest.fn(),
    finalize: jest.fn(() => final.promise), dispose: jest.fn() };
  const adapter: NativeSpeechAdapter = { requestPermission: jest.fn(() => permission.promise),
    createCapture: jest.fn(input => { emit = input.onEvent; canCapture = input.canCapture; return capture; }) };
  const onTranscript = jest.fn((_: Parameters<HoldToTalkOptions['onTranscript']>[0]) => true);
  let aiSpeaking = false;
  const controller = new HoldToTalkController({ adapter, getScope: () => scope,
    isAiSpeaking: () => aiSpeaking, onTranscript,
    limits: { permissionMs: 1000, captureMs: 5000, finalizationMs: 1000 } });
  const listen = async () => {
    expect(controller.begin('press-1')).toBe(true);
    permission.resolve('granted'); await flush(); started.resolve(); await flush();
    expect(controller.getSnapshot().phase).toBe('LISTENING');
  };
  return { controller, permission, started, final, capture, adapter, onTranscript, listen,
    emit: (event: SpeechEvent) => emit(event), canCapture: () => canCapture(),
    setScope: (value: VoiceScope | null) => { scope = value; }, setAiSpeaking: (value: boolean) => { aiSpeaking = value; } };
}

describe('native hold-to-talk ownership and gesture lifecycle (synthetic adapter)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it('never captures or sends when permission resolves after release', async () => {
    const h = harness(); h.controller.begin('press-1'); h.controller.release('press-1');
    h.permission.resolve('granted'); await flush();
    expect(h.adapter.createCapture).not.toHaveBeenCalled();
    expect(h.onTranscript).not.toHaveBeenCalled(); expect(h.controller.getSnapshot().phase).toBe('IDLE');
  });

  // Design proposal N: "Ne sada" to the question before the microphone window is not a refusal and not an error. The gesture ends
  // with no microphone, no message and no kept text, and the next hold starts as if nothing had happened.
  it('ends the gesture calmly when the person says "Ne sada" to the question before the microphone window', async () => {
    const h = harness(); expect(h.controller.begin('press-1')).toBe(true);
    expect(h.controller.getSnapshot().phase).toBe('PERMISSION_PENDING');
    h.permission.resolve('later'); await flush();
    expect(h.controller.getSnapshot()).toMatchObject({ phase: 'IDLE', error: null, fallbackText: '', finalText: '', interimText: '' });
    expect(h.adapter.createCapture).not.toHaveBeenCalled(); expect(h.onTranscript).not.toHaveBeenCalled();
    // A timer left running would turn this into "Zahtev za mikrofon je istekao" a moment later.
    jest.advanceTimersByTime(5000); expect(h.controller.getSnapshot()).toMatchObject({ phase: 'IDLE', error: null });
    expect(h.controller.begin('press-2')).toBe(true);
    h.controller.release('press-2');
  });

  it('says nothing either when the hold was let go while the question was read and the answer is "Ne sada"', async () => {
    const h = harness(); h.controller.begin('press-1'); h.controller.release('press-1');
    expect(h.controller.getSnapshot().phase).toBe('IDLE');
    h.permission.resolve('later'); await flush();
    expect(h.controller.getSnapshot()).toMatchObject({ phase: 'IDLE', error: null });
    expect(h.adapter.createCapture).not.toHaveBeenCalled();
  });

  it('closes the pending native handle when release races asynchronous start', async () => {
    const h = harness(); h.controller.begin('press-1'); h.permission.resolve('granted'); await flush();
    expect(h.controller.getSnapshot().phase).toBe('STARTING');
    h.controller.release('press-1'); expect(h.canCapture()).toBe(false);
    expect(h.capture.dispose).toHaveBeenCalledTimes(1); h.started.resolve(); await flush();
    expect(h.capture.dispose).toHaveBeenCalledTimes(1); expect(h.capture.finalize).not.toHaveBeenCalled();
    expect(h.onTranscript).not.toHaveBeenCalled();
  });

  it('displays actual interim/final and level, ignores stale hypotheses, and hands editable text to the composer once after release', async () => {
    const h = harness(); await h.listen();
    h.emit({ kind: 'segment', index: 0, final: false, text: 'Треба ми' });
    h.emit({ kind: 'segment', index: 0, final: true, text: 'Треба ми помоћ.' });
    h.emit({ kind: 'segment', index: 0, final: true, text: 'Треба ми помоћ.' });
    h.emit({ kind: 'segment', index: 0, final: false, text: 'stari deo' });
    h.emit({ kind: 'segment', index: 1, final: false, text: 'Сутра' });
    h.emit({ kind: 'level', value: 0.42 });
    expect(h.controller.getSnapshot()).toMatchObject({ finalText: 'Треба ми помоћ.', interimText: 'Сутра', audioLevel: 0.42 });
    expect(h.onTranscript).not.toHaveBeenCalled();
    h.controller.release('press-1'); h.controller.release('press-1');
    expect(h.capture.stopCapture).toHaveBeenCalled(); expect(h.capture.finalize).toHaveBeenCalledTimes(1);
    expect(h.canCapture()).toBe(false);
    h.final.resolve({ kind: 'final', text: 'Треба ми помоћ. Сутра.' }); await flush();
    expect(h.onTranscript).toHaveBeenCalledTimes(1);
    expect(h.onTranscript.mock.calls[0][0]).toMatchObject({ text: 'Треба ми помоћ. Сутра.',
      session: { accountId: 'account-a', conversationId: 'owned-conversation', accountRevision: 1 } });
    expect(h.controller.getSnapshot()).toMatchObject({ phase: 'IDLE', error: null, fallbackText: '' });
  });

  it.each(['gesture', 'navigation', 'background', 'account'] as const)('cancels %s without sending late finals', async reason => {
    const h = harness(); await h.listen(); h.emit({ kind: 'segment', index: 0, final: false, text: 'privatni unos' });
    h.controller.release('press-1'); h.controller.cancel(reason);
    h.final.resolve({ kind: 'final', text: 'zakašnjeli tekst' }); await flush();
    expect(h.capture.dispose).toHaveBeenCalledTimes(1); expect(h.onTranscript).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot()).toMatchObject({ phase: 'IDLE', fallbackText: '', finalText: '' });
  });

  it('fences account A to B to A even with the same account and conversation ids', async () => {
    const h = harness(); await h.listen(); h.controller.release('press-1');
    h.setScope({ accountId: 'account-a', accountRevision: 3, conversationId: 'owned-conversation' });
    h.final.resolve({ kind: 'final', text: 'old A' }); await flush();
    expect(h.onTranscript).not.toHaveBeenCalled(); expect(h.capture.dispose).toHaveBeenCalledTimes(1);
    expect(h.controller.getSnapshot().session).toBeNull();
  });

  it('keeps incomplete interim editable, without calling it final or submitting it', async () => {
    const h = harness(); await h.listen(); h.emit({ kind: 'segment', index: 0, final: true, text: 'Dve osobe' });
    h.emit({ kind: 'segment', index: 1, final: false, text: 'u Novom Sadu' });
    h.controller.release('press-1'); h.final.resolve({ kind: 'incomplete' }); await flush();
    expect(h.onTranscript).not.toHaveBeenCalled(); expect(h.controller.getSnapshot()).toMatchObject({ phase: 'IDLE',
      fallbackText: 'Dve osobe u Novom Sadu', finalText: '', error: 'FINAL_TRANSCRIPT_MISSING' });
    h.setScope({ accountId: 'account-b', accountRevision: 2, conversationId: 'other' }); h.controller.contextChanged();
    expect(h.controller.getSnapshot().fallbackText).toBe('');
  });

  it('keeps text on finalization failure, but not provider/platform error details', async () => {
    const h = harness(); await h.listen(); h.emit({ kind: 'segment', index: 0, final: false, text: 'Četiri hiljade' });
    h.controller.release('press-1'); h.final.reject(new Error('secret provider body')); await flush();
    expect(h.controller.getSnapshot()).toMatchObject({ fallbackText: 'Četiri hiljade', error: 'FINALIZATION_FAILED' });
    expect(JSON.stringify(h.controller.getSnapshot())).not.toContain('secret');
  });

  it('silence never finalizes or sends while held', async () => {
    const h = harness(); await h.listen(); h.emit({ kind: 'level', value: 0 }); jest.advanceTimersByTime(2000);
    expect(h.controller.getSnapshot().phase).toBe('LISTENING'); expect(h.capture.finalize).not.toHaveBeenCalled();
    expect(h.onTranscript).not.toHaveBeenCalled(); h.controller.cancel('gesture');
  });

  it('uses honest unavailable metering, not a fabricated waveform', async () => {
    const h = harness(); await h.listen(); expect(h.controller.getSnapshot().audioLevel).toBeNull();
    h.emit({ kind: 'level', value: NaN }); expect(h.controller.getSnapshot().audioLevel).toBeNull();
    h.emit({ kind: 'level', value: 12 }); expect(h.controller.getSnapshot().audioLevel).toBeNull();
    h.controller.cancel('gesture');
  });

  it('timeout stops native input and preserves current text without auto-finalizing', async () => {
    const h = harness(); await h.listen(); h.emit({ kind: 'segment', index: 0, final: false, text: 'duži iskaz' });
    jest.advanceTimersByTime(5000);
    expect(h.capture.dispose).toHaveBeenCalledTimes(1); expect(h.onTranscript).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot()).toMatchObject({ fallbackText: 'duži iskaz', error: 'CAPTURE_TIMEOUT' });
  });

  it('preserves interim on audio interruption; returning to foreground does not restart capture', async () => {
    const h = harness(); await h.listen(); h.emit({ kind: 'segment', index: 0, final: false, text: 'unos' });
    h.controller.interrupt(); expect(h.controller.getSnapshot()).toMatchObject({ fallbackText: 'unos', error: 'AUDIO_INTERRUPTED' });
    h.controller.setForeground(false); h.controller.setForeground(true);
    expect(h.capture.start).toHaveBeenCalledTimes(1); expect(h.onTranscript).not.toHaveBeenCalled();
  });

  it('does not start when AI read-aloud is speaking, including a permission race', async () => {
    const h = harness(); h.setAiSpeaking(true); expect(h.controller.begin('press-1')).toBe(false);
    expect(h.adapter.requestPermission).not.toHaveBeenCalled(); h.setAiSpeaking(false); h.controller.begin('press-2');
    h.setAiSpeaking(true); h.permission.resolve('granted'); await flush();
    expect(h.adapter.createCapture).not.toHaveBeenCalled(); expect(h.controller.getSnapshot().error).toBe('AI_SPEAKING');
  });

  it('supports start/stop accessibility without a held touch and rejects a foreign gesture release', async () => {
    const h = harness(); h.controller.begin('accessible-1', 'accessible'); h.permission.resolve('granted');
    await flush(); h.started.resolve(); await flush(); h.controller.release('other');
    expect(h.capture.finalize).not.toHaveBeenCalled(); h.controller.release('accessible-1');
    h.final.resolve({ kind: 'final', text: 'Dostupan sam vikendom.' }); await flush();
    expect(h.onTranscript).toHaveBeenCalledTimes(1);
  });

  it('retains confirmed text if the visible composer cannot accept it, without network retry', async () => {
    const h = harness(); h.onTranscript.mockReturnValueOnce(false);
    await h.listen(); h.controller.release('press-1');
    h.final.resolve({ kind: 'final', text: 'Sutra od 18.' }); await flush();
    expect(h.controller.getSnapshot()).toMatchObject({ phase: 'IDLE', error: 'DRAFT_NOT_ACCEPTED', fallbackText: 'Sutra od 18.' });
    jest.advanceTimersByTime(30_000); expect(h.onTranscript).toHaveBeenCalledTimes(1);
    const accept = jest.fn(() => true);
    expect(h.controller.useFallback(accept)).toBe(true);
    expect(h.controller.useFallback(accept)).toBe(false);
    expect(accept.mock.calls).toEqual([['Sutra od 18.']]);
  });

  it('keeps callback errors private and clears fallback on account change', async () => {
    const h = harness(); h.onTranscript.mockImplementationOnce(() => { throw new Error('secret body'); });
    await h.listen(); h.controller.release('press-1');
    h.final.resolve({ kind: 'final', text: 'privatna poruka' }); await flush();
    expect(h.controller.getSnapshot()).toMatchObject({ phase: 'IDLE', fallbackText: 'privatna poruka', error: 'DRAFT_NOT_ACCEPTED' });
    expect(JSON.stringify(h.controller.getSnapshot())).not.toContain('secret body');
    h.setScope(null); const accept = jest.fn(() => true);
    expect(h.controller.useFallback(accept)).toBe(false); expect(accept).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot()).toMatchObject({ phase: 'IDLE', session: null, fallbackText: '' });
  });

  it('a late final after finalization timeout cannot refill the composer or restart speech', async () => {
    const h = harness(); await h.listen(); h.controller.release('press-1');
    jest.advanceTimersByTime(1000);
    expect(h.controller.getSnapshot()).toMatchObject({ phase: 'IDLE', error: 'FINALIZATION_TIMEOUT' });
    h.final.resolve({ kind: 'final', text: 'late private text' }); await flush();
    expect(h.onTranscript).not.toHaveBeenCalled(); expect(h.capture.start).toHaveBeenCalledTimes(1);
  });
});
