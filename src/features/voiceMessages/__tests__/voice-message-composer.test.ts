// Voice messages B2-a (2026-10-01): the recording-to-sending model against fake platform seams - lifecycle, one key per recording, unknown outcomes, fences.
import { createAudioArbiter } from '../ports';
import { createVoiceMessageComposer, VOICE_MAX_DURATION_MS } from '../voiceMessageComposer';
import { VOICE_ERROR_COPY } from '../voiceCopy';
import { createFakeFiles, createFakePlayer, createFakeRecorder } from '../testing/fakes';

const accountId = '11111111-1111-4111-8111-111111111111', agreementId = '22222222-2222-4222-8222-222222222222';
const assetId = '33333333-3333-4333-8333-333333333333';
const recordingUri = 'file:///cache/voice-1.m4a';
const scope = { accountId, accountRevision: 4 };
type Ref = { agreementId: string; agreementVersion: number; clientRequestId: string };
const receipt = (ref: Ref, state: string, patch: Record<string, unknown> = {}) => ({ accountId, agreementId, agreementVersion: ref.agreementVersion, clientRequestId: ref.clientRequestId,
  assetId: state === 'ABSENT' ? null : assetId, state, attachedMessageId: null, voice: state === 'READY' ? { assetId, durationMs: 4200, byteSize: 2048, contentType: 'audio/mp4' } : null, authoritative: true, ...patch });
const good = (podatak: unknown) => ({ ok: true as const, podatak });
const bad = (kod: string, poruka = 'Poruka servisa.') => ({ ok: false as const, kod, poruka });

function setup(patch: { agreement?: { version: number | null; writable: boolean }; permission?: 'granted' | 'denied' | 'blocked' | 'unavailable' | 'later'; journal?: Ref[] } = {}) {
  const recorder = createFakeRecorder({ permission: patch.permission }), player = createFakePlayer(), files = createFakeFiles({ [recordingUri]: new ArrayBuffer(2048) });
  const arbiter = createAudioArbiter();
  const live = { current: true, agreement: patch.agreement ?? { version: 3, writable: true }, clock: 1_000_000, handler: null as null | (() => void), capturing: false };
  const entries: { command: { voice?: { agreementVersion: number; assetId: string } } }[] = [];
  const stored: Ref[] = [...(patch.journal ?? [])];
  const uploads = { upload: jest.fn(), read: jest.fn(), cancel: jest.fn() };
  uploads.upload.mockImplementation(async (ref: Ref) => good(receipt(ref, 'READY')));
  const journal = { load: jest.fn(async () => [...stored]), save: jest.fn(async (_a: string, ref: Ref) => { if (!stored.some(r => r.clientRequestId === ref.clientRequestId)) stored.push(ref); }),
    clear: jest.fn(async (_a: string, ref: Ref) => { const i = stored.findIndex(r => r.clientRequestId === ref.clientRequestId); if (i >= 0) stored.splice(i, 1); }) };
  const outbox = { sendVoice: jest.fn(async (voice: { agreementVersion: number; assetId: string }) => { entries.push({ command: { voice } }); }),
    getSnapshot: () => ({ capturing: live.capturing, error: null, entries }) };
  let n = 0;
  const composer = createVoiceMessageComposer({ accountId, accountRevision: 4, agreementId, isCurrent: () => live.current, agreement: () => live.agreement,
    recorder: recorder.port, player: player.port, files: files.port, arbiter, uploads, journal, outbox, newRequestId: () => `44444444-4444-4444-8444-${String(++n).padStart(12, '0')}`,
    now: () => live.clock, timers: { setInterval: (handler: () => void) => { live.handler = handler; return 1; }, clearInterval: () => { live.handler = null; } } });
  const tick = (ms: number) => { live.clock += ms; live.handler?.(); };
  const phase = () => composer.getSnapshot().phase;
  return { composer, recorder, player, files, arbiter, live, entries, stored, uploads, journal, outbox, tick, phase };
}
const recordAndStop = async (s: ReturnType<typeof setup>, ms = 2500) => { await s.composer.start(); s.tick(ms); await s.composer.stop(); };

it('records, reviews, previews, sends: the exact key, bytes and asset reach the upload and the durable outbox, and the recording file is removed', async () => {
  const s = setup();
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'idle', canRecord: true, canSend: false, canDiscard: false, recovered: [] });
  await s.composer.start();
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'recording', elapsedMs: 0, canRecord: false, canDiscard: true }); expect(s.arbiter.current()).toBe('recording');
  s.tick(2500); expect(s.composer.getSnapshot().elapsedMs).toBe(2500);
  await s.composer.stop();
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'review', durationMs: 4200, canSend: true, error: null }); expect(s.arbiter.current()).toBeNull(); expect(s.recorder.listenerCount()).toBe(0);
  await s.composer.togglePreview();
  expect(s.player.state.calls).toEqual(['load:' + recordingUri, 'play']); expect(s.composer.getSnapshot().preview).toBe('playing'); expect(s.arbiter.current()).toBe('preview');
  s.player.progress(1500); expect(s.composer.getSnapshot().previewMs).toBe(1500);
  await s.composer.togglePreview(); expect(s.composer.getSnapshot().preview).toBe('paused');
  await s.composer.send();
  const ref = { agreementId, agreementVersion: 3, clientRequestId: '44444444-4444-4444-8444-000000000001' };
  expect(s.uploads.upload).toHaveBeenCalledTimes(1);
  expect(s.uploads.upload.mock.calls[0][0]).toEqual(ref); expect((s.uploads.upload.mock.calls[0][1] as ArrayBuffer).byteLength).toBe(2048); expect(s.uploads.upload.mock.calls[0][2]).toEqual(scope);
  expect(s.journal.save).toHaveBeenCalledWith(accountId, ref, expect.any(Function));
  expect(s.outbox.sendVoice).toHaveBeenCalledWith({ agreementVersion: 3, assetId });
  expect(s.files.log.removed).toContain(recordingUri); expect(s.files.files.has(recordingUri)).toBe(false);
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'idle', durationMs: null, preview: 'idle', error: null });
  expect(s.arbiter.current()).toBeNull(); expect(s.player.state.released).toBeGreaterThan(0);
});
it.each([
  ['denied', 'MIC_PERMISSION_DENIED'], ['blocked', 'MIC_PERMISSION_BLOCKED'], ['unavailable', 'MIC_UNAVAILABLE'],
] as const)('a %s microphone permission never starts a recording and says so in plain Serbian', async (permission, code) => {
  const s = setup({ permission }); await s.composer.start();
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'idle', error: { code, message: VOICE_ERROR_COPY[code] } }); expect(s.recorder.state.started).toBe(0); expect(s.arbiter.current()).toBeNull();
});
// Design proposal N: "Ne sada" to the question before the microphone window is not a refusal. Nothing is recorded, nothing is
// said, and the composer is exactly as it was, so the next press of the microphone simply asks again.
it('"Ne sada" to the question before the microphone window leaves the composer as it was, with no message', async () => {
  const s = setup({ permission: 'later' }); await s.composer.start();
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'idle', error: null, canRecord: true, canDiscard: false });
  expect(s.recorder.state.started).toBe(0); expect(s.arbiter.current()).toBeNull(); expect(s.live.handler).toBeNull();
  expect(s.recorder.state.permissionAsked).toBe(1);
  // The next press starts normally once the permission is there.
  s.recorder.state.permission = 'granted'; await s.composer.start();
  expect(s.composer.getSnapshot().phase).toBe('recording');
});
it('a recorder that cannot start leaves no claim and no ticker', async () => {
  const s = setup(); s.recorder.state.startError = true; await s.composer.start();
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'idle', error: { code: 'RECORDING_FAILED' } }); expect(s.arbiter.current()).toBeNull(); expect(s.live.handler).toBeNull();
});
it('refuses to record while the Agreement is read-only, its version is unknown or the outbox is capturing', async () => {
  for (const patch of [{ agreement: { version: 3, writable: false } }, { agreement: { version: null, writable: true } }]) {
    const s = setup(patch); expect(s.composer.getSnapshot().canRecord).toBe(false); await s.composer.start(); expect(s.recorder.state.permissionAsked).toBe(0);
  }
  const s = setup(); s.live.capturing = true; s.composer.refresh(); expect(s.composer.getSnapshot().canRecord).toBe(false); await s.composer.start(); expect(s.recorder.state.started).toBe(0);
});
it('a recording shorter than the server minimum is discarded, never reviewed or uploaded', async () => {
  const s = setup(); s.recorder.state.file = { uri: recordingUri, durationMs: 120 }; await recordAndStop(s, 120);
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'idle', error: { code: 'RECORDING_TOO_SHORT' } }); expect(s.files.log.removed).toContain(recordingUri); expect(s.uploads.upload).not.toHaveBeenCalled();
});
it('a platform interruption keeps what was recorded for review, and discards it when it is too short', async () => {
  const s = setup(); await s.composer.start(); s.tick(3000); s.recorder.interrupt('AUDIO_FOCUS'); await Promise.resolve(); await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'review', durationMs: 4200, error: { code: 'RECORDING_INTERRUPTED' } });
  const short = setup(); short.recorder.state.file = { uri: recordingUri, durationMs: 100 }; await short.composer.start(); short.recorder.interrupt('BACKGROUND');
  await new Promise(resolve => setImmediate(resolve));
  expect(short.composer.getSnapshot()).toMatchObject({ phase: 'idle', error: { code: 'RECORDING_INTERRUPTED' } });
});
it('stops by itself at five minutes and reviews the capped recording', async () => {
  const s = setup(); s.recorder.state.file = { uri: recordingUri, durationMs: 301_500 }; await s.composer.start(); s.tick(VOICE_MAX_DURATION_MS + 500);
  await new Promise(resolve => setImmediate(resolve));
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'review', durationMs: VOICE_MAX_DURATION_MS }); expect(s.recorder.state.stopped).toBe(1);
});
it('discarding while recording cancels the recorder; discarding a reviewed recording removes its file and the unused identity', async () => {
  const s = setup(); await s.composer.start(); await s.composer.discard();
  expect(s.composer.getSnapshot().phase).toBe('idle'); expect(s.recorder.state.cancelled).toBe(1); expect(s.arbiter.current()).toBeNull();
  const r = setup(); await recordAndStop(r); await r.composer.togglePreview(); await r.composer.discard();
  expect(r.composer.getSnapshot()).toMatchObject({ phase: 'idle', durationMs: null, preview: 'idle' }); expect(r.files.files.has(recordingUri)).toBe(false); expect(r.uploads.cancel).not.toHaveBeenCalled(); expect(r.uploads.upload).not.toHaveBeenCalled();
});
it('a failed upload keeps the recording; the retry reads first and, when the server never saw it, uploads with the SAME key', async () => {
  const s = setup(); s.uploads.upload.mockResolvedValueOnce(bad('AGREEMENT_VOICE_UNCONFIRMED'));
  await recordAndStop(s); await s.composer.send();
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'failed', canRetry: true, durationMs: 4200, error: { code: 'UPLOAD_UNCONFIRMED' } }); expect(s.files.files.has(recordingUri)).toBe(true); expect(s.outbox.sendVoice).not.toHaveBeenCalled();
  const firstKey = (s.uploads.upload.mock.calls[0][0] as Ref).clientRequestId;
  s.uploads.read.mockImplementation(async (ref: Ref) => good(receipt(ref, 'ABSENT')));
  await s.composer.retry();
  expect(s.uploads.read).toHaveBeenCalledTimes(1); expect(s.uploads.upload).toHaveBeenCalledTimes(2); expect((s.uploads.upload.mock.calls[1][0] as Ref).clientRequestId).toBe(firstKey);
  expect(s.outbox.sendVoice).toHaveBeenCalledTimes(1); expect(s.composer.getSnapshot().phase).toBe('idle');
});
it('a retry that finds the recording already READY sends it without uploading again; a STAGED one stays unknown; a FAILED one gets a new key', async () => {
  const ready = setup(); ready.uploads.upload.mockResolvedValueOnce(bad('AGREEMENT_VOICE_UNCONFIRMED')); await recordAndStop(ready); await ready.composer.send();
  ready.uploads.read.mockImplementation(async (ref: Ref) => good(receipt(ref, 'READY'))); await ready.composer.retry();
  expect(ready.uploads.upload).toHaveBeenCalledTimes(1); expect(ready.outbox.sendVoice).toHaveBeenCalledWith({ agreementVersion: 3, assetId });
  const staged = setup(); staged.uploads.upload.mockResolvedValueOnce(bad('AGREEMENT_VOICE_UNCONFIRMED')); await recordAndStop(staged); await staged.composer.send();
  staged.uploads.read.mockImplementation(async (ref: Ref) => good(receipt(ref, 'STAGED'))); await staged.composer.retry();
  expect(staged.composer.getSnapshot()).toMatchObject({ phase: 'failed', error: { code: 'OUTCOME_UNKNOWN' } }); expect(staged.uploads.upload).toHaveBeenCalledTimes(1); expect(staged.outbox.sendVoice).not.toHaveBeenCalled();
  const dead = setup(); dead.uploads.upload.mockResolvedValueOnce(bad('AGREEMENT_VOICE_UNCONFIRMED')); await recordAndStop(dead); await dead.composer.send();
  dead.uploads.read.mockImplementation(async (ref: Ref) => good(receipt(ref, 'FAILED'))); await dead.composer.retry();
  expect(dead.uploads.upload).toHaveBeenCalledTimes(2);
  expect((dead.uploads.upload.mock.calls[1][0] as Ref).clientRequestId).not.toBe((dead.uploads.upload.mock.calls[0][0] as Ref).clientRequestId);
});
it('a retry whose read is itself unconfirmed stays failed and never uploads blind', async () => {
  const s = setup(); s.uploads.upload.mockResolvedValueOnce(bad('AGREEMENT_VOICE_UNCONFIRMED')); await recordAndStop(s); await s.composer.send();
  s.uploads.read.mockResolvedValue(bad('AGREEMENT_VOICE_UNCONFIRMED')); await s.composer.retry();
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'failed', error: { code: 'UPLOAD_UNCONFIRMED' } }); expect(s.uploads.upload).toHaveBeenCalledTimes(1);
});
it('definitive server refusals keep their own plain message and still allow a retry', async () => {
  const s = setup(); s.uploads.upload.mockResolvedValueOnce(bad('MEDIA_RATE_LIMITED', 'Previše snimaka u kratkom roku. Pokušaj malo kasnije.'));
  await recordAndStop(s); await s.composer.send();
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'failed', canRetry: true, error: { code: 'MEDIA_RATE_LIMITED', message: 'Previše snimaka u kratkom roku. Pokušaj malo kasnije.' } });
});
it('when the outbox does not store the intent the asset is kept and the retry sends that same asset without a second upload', async () => {
  const s = setup(); s.outbox.sendVoice.mockImplementationOnce(async () => undefined);
  await recordAndStop(s); await s.composer.send();
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'failed', error: { code: 'SEND_NOT_STORED' } }); expect(s.uploads.upload).toHaveBeenCalledTimes(1);
  await s.composer.retry();
  expect(s.uploads.upload).toHaveBeenCalledTimes(1); expect(s.outbox.sendVoice).toHaveBeenCalledTimes(2); expect(s.composer.getSnapshot().phase).toBe('idle');
});
it('a retry after the Agreement changed version, before any upload was attempted, uses a new key for the current version', async () => {
  const s = setup(); s.files.state.readError = true; await recordAndStop(s); await s.composer.send();
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'failed', error: { code: 'RECORDING_INVALID' } }); expect(s.uploads.upload).not.toHaveBeenCalled();
  s.files.state.readError = false; s.live.agreement = { version: 4, writable: true }; s.composer.refresh(); await s.composer.retry();
  expect(s.uploads.upload).toHaveBeenCalledTimes(1); expect((s.uploads.upload.mock.calls[0][0] as Ref).agreementVersion).toBe(4); expect(s.outbox.sendVoice).toHaveBeenCalledWith({ agreementVersion: 4, assetId });
});
it('a recording whose file is the wrong size never reaches the network', async () => {
  for (const size of [8, 4_194_305]) {
    const s = setup(); s.files.put(recordingUri, size); await recordAndStop(s); await s.composer.send();
    expect(s.composer.getSnapshot()).toMatchObject({ phase: 'failed', error: { code: 'RECORDING_INVALID' } }); expect(s.uploads.upload).not.toHaveBeenCalled();
  }
});
it('discarding after a server attempt cancels the server recording first and only then forgets it', async () => {
  const s = setup(); s.uploads.upload.mockResolvedValueOnce(bad('AGREEMENT_VOICE_UNCONFIRMED')); await recordAndStop(s); await s.composer.send();
  s.uploads.cancel.mockImplementation(async (ref: Ref) => good(receipt(ref, 'CANCELLED'))); await s.composer.discard();
  expect(s.uploads.cancel).toHaveBeenCalledTimes(1); expect(s.journal.clear).toHaveBeenCalled(); expect(s.composer.getSnapshot().phase).toBe('idle'); expect(s.files.files.has(recordingUri)).toBe(false);
  const unsure = setup(); unsure.uploads.upload.mockResolvedValueOnce(bad('AGREEMENT_VOICE_UNCONFIRMED')); await recordAndStop(unsure); await unsure.composer.send();
  unsure.uploads.cancel.mockResolvedValue(bad('AGREEMENT_VOICE_UNCONFIRMED')); await unsure.composer.discard();
  expect(unsure.composer.getSnapshot()).toMatchObject({ phase: 'failed', error: { code: 'OUTCOME_UNKNOWN' } }); expect(unsure.files.files.has(recordingUri)).toBe(true); expect(unsure.journal.clear).not.toHaveBeenCalled();
});
it('dispose releases the microphone, the speaker and the file at once and ignores every late result', async () => {
  const recording = setup(); await recording.composer.start(); await recording.composer.dispose();
  expect(recording.recorder.state.cancelled).toBe(1); expect(recording.arbiter.current()).toBeNull(); expect(recording.live.handler).toBeNull();
  const reviewing = setup(); await recordAndStop(reviewing); await reviewing.composer.togglePreview(); await reviewing.composer.dispose();
  expect(reviewing.files.files.has(recordingUri)).toBe(false); expect(reviewing.player.state.released).toBeGreaterThan(0);
  const late = setup(); let release!: () => void; late.uploads.upload.mockImplementation(() => new Promise(resolve => { release = () => resolve(good(receipt({ agreementId, agreementVersion: 3, clientRequestId: 'x' }, 'READY'))); }));
  await recordAndStop(late); const sending = late.composer.send(); await new Promise(resolve => setImmediate(resolve));
  await late.composer.dispose(); release(); await sending;
  expect(late.outbox.sendVoice).not.toHaveBeenCalled();
});
it('an account or focus change while the permission prompt is open never starts the microphone', async () => {
  const s = setup(); const asking = s.composer.start(); s.live.current = false; await asking;
  expect(s.recorder.state.started).toBe(0); expect(s.arbiter.current()).toBeNull();
});
it('restore offers a READY recording no message carries, clears attached and dead identities, and never sends on its own', async () => {
  const ref = (n: number): Ref => ({ agreementId, agreementVersion: 3, clientRequestId: `55555555-5555-4555-8555-${String(n).padStart(12, '0')}` });
  const s = setup({ journal: [ref(1), ref(2), ref(3), ref(4)] });
  s.uploads.read.mockImplementation(async (r: Ref) => {
    if (r.clientRequestId.endsWith('1')) return good(receipt(r, 'READY'));
    if (r.clientRequestId.endsWith('2')) return good(receipt(r, 'READY', { attachedMessageId: '66666666-6666-4666-8666-666666666666' }));
    if (r.clientRequestId.endsWith('3')) return good(receipt(r, 'CANCELLED'));
    return good(receipt(r, 'STAGED'));
  });
  await s.composer.restore();
  expect(s.composer.getSnapshot().recovered).toEqual([{ ref: ref(1), assetId, durationMs: 4200 }]);
  expect(s.stored.map(r => r.clientRequestId)).toEqual([ref(1).clientRequestId, ref(4).clientRequestId]); expect(s.outbox.sendVoice).not.toHaveBeenCalled();
  await s.composer.sendRecovered(ref(1)); expect(s.outbox.sendVoice).toHaveBeenCalledWith({ agreementVersion: 3, assetId }); expect(s.composer.getSnapshot().recovered).toEqual([]);
});
it('a recovered recording already held by an outbox entry is not offered twice, and discarding one cancels it on the server', async () => {
  const ref: Ref = { agreementId, agreementVersion: 3, clientRequestId: '55555555-5555-4555-8555-000000000001' };
  const held = setup({ journal: [ref] }); held.entries.push({ command: { voice: { agreementVersion: 3, assetId } } });
  held.uploads.read.mockImplementation(async (r: Ref) => good(receipt(r, 'READY'))); await held.composer.restore(); expect(held.composer.getSnapshot().recovered).toEqual([]);
  const s = setup({ journal: [ref] }); s.uploads.read.mockImplementation(async (r: Ref) => good(receipt(r, 'READY'))); await s.composer.restore();
  s.uploads.cancel.mockImplementation(async (r: Ref) => good(receipt(r, 'CANCELLED'))); await s.composer.discardRecovered(ref);
  expect(s.uploads.cancel).toHaveBeenCalledTimes(1); expect(s.composer.getSnapshot().recovered).toEqual([]); expect(s.stored).toEqual([]);
});
it('another audio owner taking the speaker or microphone stops a recording into review and a preview into silence', async () => {
  const s = setup(); await s.composer.start(); s.tick(3000);
  await s.arbiter.claim('playback', () => undefined);
  expect(s.composer.getSnapshot().phase).toBe('review'); expect(s.composer.getSnapshot().error?.code).toBe('RECORDING_INTERRUPTED');
  await s.composer.togglePreview(); expect(s.composer.getSnapshot().preview).toBe('playing');
  await s.arbiter.claim('playback', () => undefined); expect(s.composer.getSnapshot().preview).toBe('idle'); expect(s.player.state.released).toBeGreaterThan(0);
});
it('a preview that cannot be played says so and leaves the recording sendable', async () => {
  const s = setup(); await recordAndStop(s); s.player.state.loadError = true; await s.composer.togglePreview();
  expect(s.composer.getSnapshot()).toMatchObject({ phase: 'review', preview: 'idle', canSend: true, error: { code: 'PLAYBACK_FAILED' } });
});
it('the preview returns to silence by itself when it ends', async () => {
  const s = setup(); await recordAndStop(s); await s.composer.togglePreview(); s.player.finish();
  expect(s.composer.getSnapshot()).toMatchObject({ preview: 'idle', previewMs: 0 });
});
