// Voice messages B2-a (2026-09-30): the Agreement voice client service - exact receipts, no path/URL/hash, no replay of a write, account fences.
const accountId = '11111111-1111-4111-8111-111111111111';
const agreementId = '22222222-2222-4222-8222-222222222222';
const assetId = '33333333-3333-4333-8333-333333333333';
const clientRequestId = '44444444-4444-4444-8444-444444444444';
const messageId = '55555555-5555-4555-8555-555555555555';
let mockAccount = accountId, mockRevision = 0;
const mockInvoke = jest.fn(), mockRead = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }) }));
jest.mock('../voiceBinaryRead', () => ({ VOICE_MAX_BYTES: 4_194_304, readVoiceBinary: (input: unknown) => mockRead(input) }));
import { agreementVoiceClientService as service, decodeVoiceUpload } from '../agreementVoiceClientService';

const ref = { agreementId, agreementVersion: 3, clientRequestId };
const voice = { assetId, durationMs: 4200, byteSize: 61234, contentType: 'audio/mp4' as const };
const ready = () => ({ ...ref, accountId, assetId, state: 'READY', attachedMessageId: null, voice, authoritative: true });
beforeEach(() => { jest.clearAllMocks(); mockAccount = accountId; mockRevision = 0; });

it('uploads only the recorded bytes with the exact Agreement, version and key and no client account override', async () => {
  mockInvoke.mockResolvedValue({ data: ready(), error: null }); const bytes = new ArrayBuffer(64);
  expect(await service.upload(ref, bytes)).toEqual({ ok: true, podatak: ready() });
  expect(mockInvoke).toHaveBeenCalledWith('uskoci-media', { body: bytes, headers: { 'x-media-operation': 'agreement-voice-upload',
    'Content-Type': 'audio/mp4', 'x-media-target': agreementId, 'x-media-version': '3', 'x-media-request-id': clientRequestId }, signal: expect.any(AbortSignal) });
});
it.each([
  ['nothing', new ArrayBuffer(0)], ['a fragment under the minimum container', new ArrayBuffer(31)], ['more than 4 MiB', new ArrayBuffer(4_194_305)],
  ['a typed array view instead of the buffer', new Uint8Array(64) as unknown as ArrayBuffer],
])('refuses %s before any request', async (_name, bytes) => {
  expect(await service.upload(ref, bytes)).toMatchObject({ ok: false, kod: 'MEDIA_INPUT_INVALID' }); expect(mockInvoke).not.toHaveBeenCalled();
});
it('refuses a malformed reference, an aborted signal and a missing session before any request', async () => {
  for (const bad of [{ ...ref, agreementId: 'x' }, { ...ref, agreementVersion: 0 }, { ...ref, clientRequestId: 'x' }])
    expect(await service.upload(bad, new ArrayBuffer(64))).toMatchObject({ ok: false, kod: 'MEDIA_INPUT_INVALID' });
  const controller = new AbortController(); controller.abort();
  expect(await service.upload(ref, new ArrayBuffer(64), undefined, controller.signal)).toMatchObject({ ok: false, kod: 'MEDIA_INPUT_INVALID' });
  expect(await service.read({ ...ref, agreementVersion: 0 })).toMatchObject({ ok: false, kod: 'MEDIA_NOT_FOUND' });
  expect(await service.list('x')).toMatchObject({ ok: false, kod: 'MEDIA_NOT_FOUND' });
  expect(mockInvoke).not.toHaveBeenCalled();
});
it.each([
  { accountId: messageId }, { agreementId: messageId }, { agreementVersion: 4 }, { clientRequestId: messageId },
  { secret: 'private drift' }, { assetId: null }, { state: 'STAGED' }, { voice: { ...voice, url: 'https://private.invalid' } },
  { voice: { ...voice, path: 'a/b/c.m4a' } }, { voice: { ...voice, assetId: messageId } }, { voice: { ...voice, durationMs: 299 } }, { voice: { ...voice, durationMs: 300_001 } },
  { voice: { ...voice, byteSize: 4_194_305 } }, { voice: { ...voice, contentType: 'audio/mpeg' } }, { voice: null }, { attachedMessageId: 'invalid' },
])('rejects a cross-scope or malformed upload receipt %#', patch => expect(decodeVoiceUpload({ ...ready(), ...patch }, accountId, ref)).toBeNull());
it('distinguishes an owned ABSENT from a stable CANCELLED tombstone and an attached receipt', async () => {
  const absent = { ...ready(), assetId: null, state: 'ABSENT', voice: null };
  mockInvoke.mockResolvedValueOnce({ data: absent, error: null });
  expect(await service.read(ref)).toEqual({ ok: true, podatak: absent });
  const tombstone = { ...ready(), state: 'CANCELLED', voice: null };
  mockInvoke.mockResolvedValueOnce({ data: tombstone, error: null });
  expect(await service.cancel(ref)).toEqual({ ok: true, podatak: tombstone });
  expect(mockInvoke.mock.calls.map(call => call[1].headers['x-media-operation'])).toEqual(['agreement-voice-upload-read', 'agreement-voice-upload-cancel']);
  expect(decodeVoiceUpload({ ...ready(), attachedMessageId: messageId }, accountId, ref)?.attachedMessageId).toBe(messageId);
  expect(decodeVoiceUpload({ ...tombstone, attachedMessageId: messageId }, accountId, ref)).toBeNull();
});
it('does not turn a transport unknown into ABSENT, expose raw errors, or replay a write', async () => {
  mockInvoke.mockRejectedValue(new Error('secret upstream body'));
  const result = await service.upload(ref, new ArrayBuffer(64));
  expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain('secret'); expect(mockInvoke).toHaveBeenCalledTimes(1);
});
it('maps only the finite safe server codes to Serbian copy and treats every other code as unconfirmed', async () => {
  for (const code of ['MEDIA_FORMAT_UNSUPPORTED', 'MEDIA_RATE_LIMITED', 'MEDIA_VERSION_CONFLICT', 'MEDIA_COMMAND_CONFLICT', 'INTERACTION_BLOCKED', 'ACCOUNT_CLOSING', 'MEDIA_NOT_FOUND']) {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: code } });
    const result = await service.upload(ref, new ArrayBuffer(64));
    expect(result).toMatchObject({ ok: false, kod: code }); expect((result as { poruka: string }).poruka).not.toMatch(/MEDIA_|server|Server/);
  }
  mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'PG_ERROR: relation private.x does not exist' } });
  const unknown = await service.upload(ref, new ArrayBuffer(64)); expect(unknown).toMatchObject({ ok: false, kod: 'AGREEMENT_VOICE_UNCONFIRMED' });
  expect(JSON.stringify(unknown)).not.toContain('private.x');
});
it('reads a safe code out of an HTTP error response body and never anything else', async () => {
  mockInvoke.mockResolvedValueOnce({ data: null, error: { context: new Response(JSON.stringify({ code: 'MEDIA_RATE_LIMITED' }), { status: 429 }) } });
  expect(await service.upload(ref, new ArrayBuffer(64))).toMatchObject({ ok: false, kod: 'MEDIA_RATE_LIMITED' });
  mockInvoke.mockResolvedValueOnce({ data: null, error: { context: new Response(JSON.stringify({ code: 'SOMETHING_INTERNAL' }), { status: 500 }) } });
  expect(await service.upload(ref, new ArrayBuffer(64))).toMatchObject({ ok: false, kod: 'AGREEMENT_VOICE_UNCONFIRMED' });
});
it('fences a late receipt after the same account session incarnation changes', async () => {
  mockInvoke.mockImplementation(async () => { mockRevision = 2; return { data: ready(), error: null }; });
  expect(await service.read(ref)).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
it('reads the bounded owner upload inventory without choosing, uploading or sending it', async () => {
  const envelope = { accountId, agreementId, uploads: [ready()], authoritative: true };
  mockInvoke.mockResolvedValue({ data: envelope, error: null }); expect(await service.list(agreementId)).toEqual({ ok: true, podatak: [ready()] });
  expect(mockInvoke.mock.calls[0][1]).toEqual({ body: { agreementId }, headers: { 'x-media-operation': 'agreement-voice-upload-list' }, signal: expect.any(AbortSignal) });
  for (const uploads of [[ready(), ready()], [{ ...ready(), accountId: messageId }], [{ ...ready(), attachedMessageId: messageId }], [{ ...ready(), state: 'FAILED', voice: null }],
    Array.from({ length: 21 }, (_, i) => ({ ...ready(), clientRequestId: `66666666-6666-4666-8666-${String(i).padStart(12, '0')}`, assetId: `77777777-7777-4777-8777-${String(i).padStart(12, '0')}`,
      voice: { ...voice, assetId: `77777777-7777-4777-8777-${String(i).padStart(12, '0')}` } }))]) {
    mockInvoke.mockResolvedValue({ data: { ...envelope, uploads }, error: null }); expect((await service.list(agreementId)).ok).toBe(false);
  }
});
it('plays back through the binary reader with the exact identity and never a URL', async () => {
  const bytes = new ArrayBuffer(128);
  mockRead.mockResolvedValue({ data: { bytes, contentType: 'audio/mp4' }, error: null });
  expect(await service.playback({ agreementId, assetId, messageId })).toEqual({ ok: true, podatak: { assetId, bytes, contentType: 'audio/mp4' } });
  expect(mockRead).toHaveBeenCalledWith({ account: { accountId, accountRevision: 0 }, signal: expect.any(AbortSignal), body: { agreementId, assetId, messageId } });
  await service.playback({ agreementId, assetId }); expect(mockRead.mock.calls[1][0].body).toEqual({ agreementId, assetId });
  expect(mockInvoke).not.toHaveBeenCalled();
});
it('refuses a malformed playback identity and any non-audio or unavailable answer', async () => {
  for (const bad of [{ agreementId: 'x', assetId }, { agreementId, assetId: 'x' }, { agreementId, assetId, messageId: 'x' }])
    expect(await service.playback(bad)).toMatchObject({ ok: false, kod: 'MEDIA_NOT_FOUND' });
  expect(mockRead).not.toHaveBeenCalled();
  mockRead.mockResolvedValueOnce({ data: null, error: { message: 'MEDIA_UNAVAILABLE' } });
  expect(await service.playback({ agreementId, assetId, messageId })).toMatchObject({ ok: false, kod: 'MEDIA_UNAVAILABLE' });
  mockRead.mockResolvedValueOnce({ data: null, error: null });
  expect(await service.playback({ agreementId, assetId, messageId })).toMatchObject({ ok: false, kod: 'MEDIA_INVALID_RESPONSE' });
  mockRead.mockResolvedValueOnce({ data: { bytes: 'not bytes', contentType: 'audio/mp4' }, error: null });
  expect(await service.playback({ agreementId, assetId, messageId })).toMatchObject({ ok: false, kod: 'MEDIA_INVALID_RESPONSE' });
});
it('fences a late playback answer after the account changes', async () => {
  mockRead.mockImplementation(async () => { mockRevision = 5; return { data: { bytes: new ArrayBuffer(8), contentType: 'audio/mp4' }, error: null }; });
  expect(await service.playback({ agreementId, assetId, messageId })).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
it('upload keeps its 55s bound and readback keeps 15s, both aborting the actual request', async () => {
  jest.useFakeTimers();
  try {
    mockInvoke.mockImplementation(() => new Promise(() => undefined));
    const slow = service.upload(ref, new ArrayBuffer(64)); const fast = service.read(ref);
    await jest.advanceTimersByTimeAsync(15_001);
    expect(await fast).toMatchObject({ ok: false, kod: 'AGREEMENT_VOICE_UNCONFIRMED' });
    expect(mockInvoke.mock.calls[1][1].signal.aborted).toBe(true);
    expect(mockInvoke.mock.calls[0][1].signal.aborted).toBe(false);
    let settled = false; void slow.then(() => { settled = true; }); await jest.advanceTimersByTimeAsync(1_000); expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(40_000);
    expect(await slow).toMatchObject({ ok: false, kod: 'AGREEMENT_VOICE_UNCONFIRMED' });
    expect(mockInvoke.mock.calls[0][1].signal.aborted).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  } finally { jest.useRealTimers(); }
});

it.each(['read', 'cancel', 'list'] as const)('%s forwards owner cancellation without turning a late response into success', async method => {
  let finish!: (value: unknown) => void;
  mockInvoke.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const caller = new AbortController();
  const pending = method === 'list' ? service.list(agreementId, undefined, caller.signal) : service[method](ref, undefined, caller.signal);
  await Promise.resolve();
  caller.abort();
  expect(await pending).toMatchObject({ ok: false, kod: 'AGREEMENT_VOICE_UNCONFIRMED' });
  expect(mockInvoke.mock.calls[0][1].signal.aborted).toBe(true);
  finish({ data: ready(), error: null }); await Promise.resolve();
  expect(mockInvoke).toHaveBeenCalledTimes(1);
});

it('cancel timeout also bounds a delayed HTTP error body and preserves an unknown write result', async () => {
  jest.useFakeTimers();
  try {
    const response = new Response('{}', { status: 409 });
    jest.spyOn(response, 'json').mockImplementation(() => new Promise(() => {}));
    mockInvoke.mockResolvedValue({ data: null, error: { context: response } });
    const pending = service.cancel(ref);
    await jest.advanceTimersByTimeAsync(15_000);
    expect(await pending).toMatchObject({ ok: false, kod: 'AGREEMENT_VOICE_UNCONFIRMED' });
    expect(mockInvoke.mock.calls[0][1].signal.aborted).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

it('an expired attempt does not retire the mounted owner or prevent explicit same-key readback', async () => {
  jest.useFakeTimers();
  try {
    const caller = new AbortController();
    mockInvoke.mockImplementationOnce(() => new Promise(() => {}));
    const pending = service.cancel(ref, undefined, caller.signal);
    await jest.advanceTimersByTimeAsync(15_000);
    expect(await pending).toMatchObject({ ok: false, kod: 'AGREEMENT_VOICE_UNCONFIRMED' });
    expect(mockInvoke.mock.calls[0][1].signal.aborted).toBe(true);
    expect(caller.signal.aborted).toBe(false);
    const cancelled = { ...ready(), state: 'CANCELLED', voice: null };
    mockInvoke.mockResolvedValueOnce({ data: cancelled, error: null });
    expect(await service.read(ref, undefined, caller.signal)).toEqual({ ok: true, podatak: cancelled });
    expect(mockInvoke.mock.calls[1][1].body).toEqual(ref);
    expect(mockInvoke.mock.calls[1][1].signal.aborted).toBe(false);
    expect(mockInvoke).toHaveBeenCalledTimes(2); expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});
