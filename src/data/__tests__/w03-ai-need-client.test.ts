import { aiNeedV2Production as client } from '../aiNeedV2Production';
import { AI_PROPOSABLE_NEED_FACT_V2_KEYS } from '../../contracts/needFactsV2';

const ACCOUNT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const C = '11111111-1111-4111-8111-111111111111';
const K = '22222222-2222-4222-8222-222222222222';
const TURN = '33333333-3333-4333-8333-333333333333';
const USER_MESSAGE = '44444444-4444-4444-8444-444444444444';
const AI_MESSAGE = '55555555-5555-4555-8555-555555555555';
const NEED = '66666666-6666-4666-8666-666666666666';
let mockOwner: { user: { id: string } | null; accountRevision: number };
const mockRpc = jest.fn(), mockInvoke = jest.fn(), mockProfile = jest.fn(), mockEq = jest.fn();
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockOwner }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({
  rpc: (...args: unknown[]) => mockRpc(...args),
  functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  from: (table: string) => {
    const query = { select: () => query, eq: (...args: unknown[]) => { mockEq(table, ...args); return query; },
      maybeSingle: () => mockProfile() };
    return query;
  },
}) }));
const receipt = () => ({ userMessageId: USER_MESSAGE, assistantMessageId: AI_MESSAGE, proposedCount: 2,
  safety: 'ALLOW', schemaVersion: 'NEED_FACT_V2', authoritative: true });
const turn = (state = 'SUCCEEDED') => ({ conversationId: C, clientRequestId: K, state,
  turnId: state === 'ABSENT' ? null : TURN, retryAllowed: state === 'FAILED' || state === 'ABSENT', receipt: state === 'SUCCEEDED' ? receipt() : null });
const opened = () => ({ conversationId: C, clientRequestId: K, authoritative: true, idempotentReplay: false });
const abandoned = () => ({ conversationId: C, status: 'ABANDONED', authoritative: true, idempotentReplay: false });
const saved = () => ({ needId: NEED, conversationId: C, revision: 1, status: 'DRAFT', authoritative: true });
const edited = () => ({ needId: NEED, fromRevision: 3, revision: 4, conversationId: C, revisionEventId: TURN,
  status: 'DRAFT', requiresReadmission: true, authoritative: true, idempotentReplay: false });
const ok = (data: unknown) => ({ data, error: null });
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
const httpError = (status: number, value: unknown) => {
  const read = jest.fn().mockResolvedValueOnce({ done: false, value: Uint8Array.from(JSON.stringify(value), char => char.charCodeAt(0)) })
    .mockResolvedValue({ done: true });
  const cancel = jest.fn().mockResolvedValue(undefined);
  const body = { getReader: () => ({ read, cancel }), cancel };
  const headers = { get: jest.fn((): string | null => null) };
  const clone = jest.fn(() => ({ body, headers }));
  return { error: { name: 'FunctionsHttpError', message: 'private provider detail', context: { status, clone } }, read, cancel, headers, clone };
};
beforeEach(() => {
  jest.useRealTimers(); jest.clearAllMocks();
  mockOwner = { user: { id: ACCOUNT }, accountRevision: 1 };
  mockRpc.mockReset(); mockInvoke.mockReset(); mockProfile.mockReset();
  mockProfile.mockResolvedValue(ok({ id: USER_MESSAGE }));
});
afterEach(() => jest.useRealTimers());

describe('owned idempotent open and abandonment', () => {
  it.each([false, true])('preserves open receipt and replay=%s with the caller UUID', async idempotentReplay => {
    const value = { ...opened(), idempotentReplay }; mockRpc.mockResolvedValue(ok(value));
    await expect(client.openConversation(K)).resolves.toEqual({ ok: true, podatak: value });
    expect(mockRpc).toHaveBeenCalledWith('rpc_ai_open_need_conversation_owned_v2', { p_client_request_id: K });
  });
  it.each([{ conversationId: 'bad' }, { clientRequestId: C }, { authoritative: false }, { idempotentReplay: 'true' },
    { privateDetails: 'secret' }, { authoritative: undefined }])('rejects incomplete/foreign open receipt %j', async patch => {
    mockRpc.mockResolvedValue(ok({ ...opened(), ...patch }));
    await expect(client.openConversation(K)).resolves.toMatchObject({ ok: false, kod: 'AI_V2_OPEN_INVALID_RESPONSE' });
  });
  it.each([false, true])('preserves explicit abandonment and replay=%s', async idempotentReplay => {
    const value = { ...abandoned(), idempotentReplay }; mockRpc.mockResolvedValue(ok(value));
    await expect(client.abandonConversation(C)).resolves.toEqual({ ok: true, podatak: value });
    expect(mockRpc).toHaveBeenCalledWith('rpc_ai_abandon_need_conversation_v2', { p_conversation_id: C });
  });
  it.each([{ conversationId: K }, { status: 'OPEN' }, { authoritative: false }, { idempotentReplay: null }, { deleted: true }])('rejects invented abandonment %j', async patch => {
    mockRpc.mockResolvedValue(ok({ ...abandoned(), ...patch }));
    await expect(client.abandonConversation(C)).resolves.toMatchObject({ ok: false, kod: 'AI_CONVERSATION_ABANDON_INVALID_RESPONSE' });
  });
  it('requires stable UUID identities before dispatch', async () => {
    await expect(client.openConversation('not-uuid')).resolves.toMatchObject({ ok: false });
    await expect(client.abandonConversation('bad')).resolves.toMatchObject({ ok: false });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('turn receipt contract and SDK error transport', () => {
  it.each(['ABSENT', 'PROCESSING', 'SUCCEEDED', 'FAILED'])('preserves server %s state without claiming success from pending', async state => {
    const value = turn(state); mockRpc.mockResolvedValue(ok(value));
    await expect(client.readTurn(C, K)).resolves.toEqual({ ok: true, podatak: value });
    expect(mockRpc).toHaveBeenCalledWith('rpc_ai_read_need_turn_v2', { p_conversation_id: C, p_client_request_id: K });
  });
  it('rejects invented retry permission for an unresolved PROCESSING turn', async () => {
    const value = { ...turn('PROCESSING'), retryAllowed: true }; mockRpc.mockResolvedValue(ok(value));
    await expect(client.readTurn(C, K)).resolves.toMatchObject({ ok: false, kod: 'AI_TURN_INVALID_RESPONSE' });
  });
  it.each([{ conversationId: K }, { clientRequestId: C }, { state: 'READY' }, { turnId: null }, { retryAllowed: true },
    { retryAllowed: 'false' }, { receipt: null }, { secret: 'private' }])('rejects mismatched or incomplete successful envelope %j', async patch => {
    mockRpc.mockResolvedValue(ok({ ...turn(), ...patch }));
    await expect(client.readTurn(C, K)).resolves.toMatchObject({ ok: false, kod: 'AI_TURN_INVALID_RESPONSE' });
  });
  it.each([{ proposedCount: '2' }, { proposedCount: -1 }, { proposedCount: AI_PROPOSABLE_NEED_FACT_V2_KEYS.length + 1 }, { proposedCount: 1.5 }, { proposedCount: NaN },
    { userMessageId: AI_MESSAGE }, { assistantMessageId: 'bad' }, { safety: 'UNKNOWN' }, { schemaVersion: 'LEGACY_TEXT_V1' },
    { authoritative: false }, { extra: 'private' }])('never coerces success receipt %j', async patch => {
    mockRpc.mockResolvedValue(ok({ ...turn(), receipt: { ...receipt(), ...patch } }));
    await expect(client.readTurn(C, K)).resolves.toMatchObject({ ok: false, kod: 'AI_TURN_INVALID_RESPONSE' });
  });
  it.each(['ABSENT', 'PROCESSING', 'FAILED'])('rejects fabricated receipt attached to %s', async state => {
    mockRpc.mockResolvedValue(ok({ ...turn(state), receipt: receipt() }));
    await expect(client.readTurn(C, K)).resolves.toMatchObject({ ok: false });
  });
  it.each([0, 12, 13, AI_PROPOSABLE_NEED_FACT_V2_KEYS.length])('retains proposedCount=%s exactly', async proposedCount => {
    const value = { ...turn(), receipt: { ...receipt(), proposedCount } }; mockRpc.mockResolvedValue(ok(value));
    await expect(client.readTurn(C, K)).resolves.toEqual({ ok: true, podatak: value });
  });
  it.each(['SUCCEEDED', 'PROCESSING'])('sends the same explicit key and preserves %s', async state => {
    const value = turn(state); mockInvoke.mockResolvedValue(ok(value));
    await expect(client.sendMessage(C, '  Original text  ', K)).resolves.toEqual({ ok: true, podatak: value });
    expect(mockInvoke).toHaveBeenCalledWith('uskoci-ai-interview', { body: { conversationId: C, text: 'Original text', clientRequestId: K },
      headers: { 'x-client-info': 'uskoci-app/ai-availability-v1', 'x-uskoci-need-facts': 'registry-v1' } });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
  it('parses only a strict HTTP409 FAILED envelope as a known command result', async () => {
    const value = turn('FAILED'), transport = httpError(409, value); mockInvoke.mockResolvedValue({ data: null, error: transport.error });
    await expect(client.sendMessage(C, 'text', K)).resolves.toEqual({ ok: true, podatak: value });
    expect(transport.read).toHaveBeenCalledTimes(2); expect(transport.cancel).toHaveBeenCalled();
  });
  it('bounds an undeclared streaming body before reading or retaining excess bytes', async () => {
    const transport = httpError(409, turn('FAILED')), excess = new Uint8Array(8193).fill(120);
    transport.read.mockReset().mockResolvedValue({ done: false, value: excess });
    mockInvoke.mockResolvedValue({ data: null, error: transport.error });
    await expect(client.sendMessage(C, 'text', K)).resolves.toMatchObject({ ok: false });
    expect(transport.read).toHaveBeenCalledTimes(1); expect(transport.cancel).toHaveBeenCalled();
    expect(excess.every(byte => byte === 0)).toBe(true);
  });
  it('cancels declared oversize without starting a stream read', async () => {
    const transport = httpError(409, turn('FAILED')); transport.headers.get.mockReturnValue('8193');
    mockInvoke.mockResolvedValue({ data: null, error: transport.error });
    await expect(client.sendMessage(C, 'text', K)).resolves.toMatchObject({ ok: false });
    expect(transport.read).not.toHaveBeenCalled(); expect(transport.cancel).toHaveBeenCalled();
  });
  it('accepts a slow interview result after15 seconds without replay', async () => {
    jest.useFakeTimers(); const wait = deferred(); mockInvoke.mockReturnValue(wait.promise);
    const pending = client.sendMessage(C, 'text', K); let settled = false;
    void pending.then(() => { settled = true; });
    await jest.advanceTimersByTimeAsync(20000); expect(settled).toBe(false);
    wait.resolve(ok(turn())); await expect(pending).resolves.toEqual({ ok: true, podatak: turn() });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
  it('cancels a never-ending409 stream at the bounded interview deadline', async () => {
    jest.useFakeTimers(); const transport = httpError(409, turn('FAILED'));
    transport.read.mockReset().mockReturnValue(new Promise(() => {}));
    mockInvoke.mockResolvedValue({ data: null, error: transport.error });
    const pending = client.sendMessage(C, 'text', K); await jest.advanceTimersByTimeAsync(55001);
    await expect(pending).resolves.toMatchObject({ ok: false }); expect(transport.cancel).toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
  });
  it('does not begin reading a409 body returned after timeout', async () => {
    jest.useFakeTimers(); const wait = deferred(), transport = httpError(409, turn('FAILED'));
    mockInvoke.mockReturnValue(wait.promise); const pending = client.sendMessage(C, 'text', K);
    await jest.advanceTimersByTimeAsync(55001); await expect(pending).resolves.toMatchObject({ ok: false });
    wait.resolve({ data: null, error: transport.error }); await jest.advanceTimersByTimeAsync(0);
    expect(transport.clone).not.toHaveBeenCalled();
  });
  it('cancels the stream and rejects a late body after account reincarnation', async () => {
    const wait = deferred(), transport = httpError(409, turn('FAILED'));
    transport.read.mockReset().mockReturnValue(wait.promise); mockInvoke.mockResolvedValue({ data: null, error: transport.error });
    const pending = client.sendMessage(C, 'text', K); await Promise.resolve(); await Promise.resolve();
    mockOwner = { ...mockOwner, accountRevision: 3 }; wait.resolve({ done: true });
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
    expect(transport.cancel).toHaveBeenCalled();
  });
  it.each([[401, 'AUTH_REQUIRED'], [403, 'AI_ACCESS_DENIED'], [429, 'AI_RATE_LIMITED'],
    [502, 'AI_SERVICE_UNAVAILABLE'], [503, 'AI_SERVICE_UNAVAILABLE'], [504, 'AI_SERVICE_UNAVAILABLE'],
    [500, 'AI_TURN_SEND_UNCONFIRMED']])('classifies HTTP%s without reading its body or implying success', async (status, code) => {
    const transport = httpError(status as number, { code: 'secret', message: 'private provider detail' });
    mockInvoke.mockResolvedValue({ data: null, error: transport.error });
    const result = await client.sendMessage(C, 'text', K);
    expect(result).toMatchObject({ ok: false, kod: code });
    expect(mockInvoke).toHaveBeenCalledTimes(1); expect(mockRpc).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('private'); expect(transport.clone).not.toHaveBeenCalled();
  });
  it.each([turn('ABSENT'), turn('SUCCEEDED'), { ...turn('FAILED'), clientRequestId: C }, { code: 'secret', message: 'secret' }])('does not trust arbitrary409 payload %j', async value => {
    const transport = httpError(409, value); mockInvoke.mockResolvedValue({ data: null, error: transport.error });
    await expect(client.sendMessage(C, 'text', K)).resolves.toMatchObject({ ok: false });
  });
  it.each(['ABSENT', 'FAILED'])('rejects unexpected normal-transport %s', async state => {
    mockInvoke.mockResolvedValue(ok(turn(state)));
    await expect(client.sendMessage(C, 'text', K)).resolves.toMatchObject({ ok: false, kod: 'AI_TURN_INVALID_RESPONSE' });
  });
  it('refuses invalid text/identity without transport', async () => {
    for (const body of ['', '   ', 'x'.repeat(4001), '\u0000bad']) await expect(client.sendMessage(C, body, K)).resolves.toMatchObject({ ok: false });
    await expect(client.sendMessage('bad', 'text', K)).resolves.toMatchObject({ ok: false });
    await expect(client.readTurn(C, 'bad')).resolves.toMatchObject({ ok: false });
    expect(mockInvoke).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('existing fact, draft and edit owners keep complete receipts', () => {
  it('checks the actual confirmed UUID before returning old null success', async () => {
    mockRpc.mockResolvedValue(ok(C)); await expect(client.confirmFact(C)).resolves.toEqual({ ok: true, podatak: null });
    for (const data of [null, K, 'bad', { id: C }]) {
      mockRpc.mockResolvedValue(ok(data)); await expect(client.confirmFact(C)).resolves.toMatchObject({ ok: false, kod: 'AI_FACT_CONFIRM_INVALID_RESPONSE' });
    }
  });
  it('keeps correction value/spelling and requires a new UUID', async () => {
    mockRpc.mockResolvedValue(ok(K)); await expect(client.correctFact(C, ['Vozač', 'VOZAČ'], 'Vozač, VOZAČ')).resolves.toEqual({ ok: true, podatak: { newFactId: K } });
    expect(mockRpc).toHaveBeenCalledWith('rpc_ai_correct_fact_v2', { p_fact_id: C, p_value: ['Vozač', 'VOZAČ'], p_display_value: 'Vozač, VOZAČ' });
    mockRpc.mockResolvedValue(ok(C)); await expect(client.correctFact(C, 'value', 'value')).resolves.toMatchObject({ ok: false });
  });
  it('rejects non-JSON values and oversized correction display before writing', async () => {
    for (const value of [undefined, null, NaN, Infinity, { nested: undefined }]) await expect(client.correctFact(C, value, 'display')).resolves.toMatchObject({ ok: false });
    await expect(client.correctFact(C, 'value', 'x'.repeat(1001))).resolves.toMatchObject({ ok: false }); expect(mockRpc).not.toHaveBeenCalled();
  });
  it('preserves exact saved DRAFT authority and uses the original account profile', async () => {
    mockRpc.mockResolvedValue(ok(saved())); await expect(client.saveDraft(C, K)).resolves.toEqual({ ok: true, podatak: saved() });
    expect(mockEq).toHaveBeenCalledWith('app_profiles', 'account_id', ACCOUNT);
    expect(mockRpc).toHaveBeenCalledWith('rpc_save_need_draft_from_review', { p_conversation_id: C, p_requester_profile_id: USER_MESSAGE, p_client_request_id: K });
  });
  it.each([{ needId: 'bad' }, { conversationId: K }, { status: 'PUBLISHED' }, { revision: '1' }, { authoritative: false }, { need_id: NEED }, { secret: true }])('rejects partial/moved draft receipt %j', async patch => {
    mockRpc.mockResolvedValue(ok({ ...saved(), ...patch }));
    await expect(client.saveDraft(C, K)).resolves.toMatchObject({ ok: false, kod: 'NEED_V2_DRAFT_INVALID_RESPONSE' });
  });
  it('does not dispatch save after account changes during profile read', async () => {
    const wait = deferred(); mockProfile.mockReturnValue(wait.promise); const pending = client.saveDraft(C, K);
    mockOwner = { ...mockOwner, accountRevision: 3 }; wait.resolve(ok({ id: USER_MESSAGE }));
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' }); expect(mockRpc).not.toHaveBeenCalled();
  });
  it('never dispatches a late save after its same-account profile read outlives the deadline', async () => {
    jest.useFakeTimers(); const wait = deferred(); mockProfile.mockReturnValue(wait.promise);
    const pending = client.saveDraft(C, K); await jest.advanceTimersByTimeAsync(15001);
    await expect(pending).resolves.toMatchObject({ ok: false });
    wait.resolve(ok({ id: USER_MESSAGE })); await jest.advanceTimersByTimeAsync(0);
    expect(mockOwner.accountRevision).toBe(1); expect(mockRpc).not.toHaveBeenCalled();
  });
  it.each([false, true])('preserves complete edit receipt and replay=%s', async idempotentReplay => {
    const value = { ...edited(), idempotentReplay }; mockRpc.mockResolvedValue(ok(value));
    await expect(client.confirmEdit(NEED, 3, C, K)).resolves.toEqual({ ok: true, podatak: value });
  });
  it.each([{ needId: C }, { fromRevision: '3' }, { revision: 3 }, { revision: 5 }, { conversationId: K },
    { revisionEventId: 'bad' }, { authoritative: false }, { requiresReadmission: false }, { idempotentReplay: 1 }, { status: 'PUBLISHED' }])('rejects fabricated edit receipt %j', async patch => {
    mockRpc.mockResolvedValue(ok({ ...edited(), ...patch }));
    await expect(client.confirmEdit(NEED, 3, C, K)).resolves.toMatchObject({ ok: false, kod: 'NEED_EDIT_INVALID_RESPONSE' });
  });
});

const operations = [
  ['open', () => client.openConversation(K)], ['readTurn', () => client.readTurn(C, K)],
  ['send', () => client.sendMessage(C, 'text', K)], ['abandon', () => client.abandonConversation(C)],
  ['confirm', () => client.confirmFact(C)], ['correct', () => client.correctFact(C, 'value', 'value')],
  ['save', () => client.saveDraft(C, K)], ['openEdit', () => client.openEditConversation(NEED)],
  ['confirmEdit', () => client.confirmEdit(NEED, 3, C, K)],
] as const;
describe('every command/read uses shared bounded account receipt ownership', () => {
  it.each(operations)('%s refuses signed-out use without dispatch', async (_name, run) => {
    mockOwner = { user: null, accountRevision: 2 }; await expect(run()).resolves.toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
    expect(mockRpc).not.toHaveBeenCalled(); expect(mockInvoke).not.toHaveBeenCalled(); expect(mockProfile).not.toHaveBeenCalled();
  });
  it.each(operations)('%s never exposes backend/transport details', async (_name, run) => {
    const response = { data: null, error: { code: 'private-code', message: 'private-detail' } };
    mockRpc.mockResolvedValue(response); mockInvoke.mockResolvedValue(response); mockProfile.mockResolvedValue(response);
    const result = await run(); expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain('private');
  });
  it.each(operations)('%s rejects late same-account reincarnation', async (_name, run) => {
    const wait = deferred(); mockRpc.mockReturnValue(wait.promise); mockInvoke.mockReturnValue(wait.promise); mockProfile.mockReturnValue(wait.promise);
    const pending = run(); mockOwner = { user: { id: ACCOUNT }, accountRevision: 3 }; wait.resolve(ok(turn()));
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  });
  it.each(operations)('%s times out without replaying the request', async (_name, run) => {
    jest.useFakeTimers(); const wait = new Promise(() => {});
    mockRpc.mockReturnValue(wait); mockInvoke.mockReturnValue(wait); mockProfile.mockReturnValue(wait);
    const pending = run(); await jest.advanceTimersByTimeAsync(_name === 'send' ? 55001 : 15001); await expect(pending).resolves.toMatchObject({ ok: false });
    expect(mockRpc.mock.calls.length + mockInvoke.mock.calls.length + mockProfile.mock.calls.length).toBe(1);
  });
});

const recovered = () => ({ accountId: ACCOUNT, conversationId: C, clientRequestId: K, conversationStatus: 'OPEN',
  turn: turn('ABSENT'), providerDispatched: false, cancelled: false, canCancel: true, authoritative: true });
it('reads exact recovery without invoking Edge or accepting cancellation automatically', async () => {
  const value = recovered(); mockRpc.mockResolvedValue(ok(value));
  await expect(client.recoverTurn(C, K)).resolves.toEqual({ ok: true, podatak: value });
  expect(mockRpc).toHaveBeenCalledWith('rpc_ai_recover_need_turn_v2', { p_conversation_id: C, p_client_request_id: K });
  expect(mockRpc).toHaveBeenCalledTimes(1); expect(mockInvoke).not.toHaveBeenCalled();
});
it('explicit cancellation uses the same opaque command and accepts only server fenced state', async () => {
  const value = { ...recovered(), turn: { ...turn('FAILED'), retryAllowed: false }, cancelled: true, canCancel: false };
  mockRpc.mockResolvedValue(ok(value)); await expect(client.cancelTurn(C, K)).resolves.toEqual({ ok: true, podatak: value });
  expect(mockRpc).toHaveBeenCalledWith('rpc_ai_cancel_need_turn_v2', { p_conversation_id: C, p_client_request_id: K });
  expect(mockInvoke).not.toHaveBeenCalled();
});
it.each([{accountId:C}, {conversationId:K}, {clientRequestId:C}, {authoritative:false}, {text:'private'},
  {providerDispatched:true}, {cancelled:true}, {conversationStatus:'COMPLETED'}, {turn:{...turn('PROCESSING'),retryAllowed:true}}])(
  'rejects contradictory or foreign recovery %j', async patch => {
  mockRpc.mockResolvedValue(ok({...recovered(),...patch}));
  await expect(client.recoverTurn(C,K)).resolves.toMatchObject({ok:false,kod:'AI_TURN_INVALID_RESPONSE'});
});
it('rejects a late recovered receipt after account ABA without provider fallback', async () => {
  const held=deferred();mockRpc.mockReturnValue(held.promise);const result=client.recoverTurn(C,K);
  mockOwner={...mockOwner,accountRevision:3};held.resolve(ok(recovered()));
  await expect(result).resolves.toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});expect(mockInvoke).not.toHaveBeenCalled();
});
it.each([false, true])('accepts dispatched owner exit with preserved dispatch evidence; cancelled=%s', async cancelled => {
  const value={...recovered(),turn:{...turn(cancelled?'FAILED':'PROCESSING'),retryAllowed:false},
    providerDispatched:true,cancelled,canCancel:!cancelled};
  mockRpc.mockResolvedValue(ok(value));
  await expect(client.recoverTurn(C,K)).resolves.toEqual({ok:true,podatak:value});
  expect(mockInvoke).not.toHaveBeenCalled();
});
it.each([
  {state:'PROCESSING',cancelled:true,canCancel:false,retryAllowed:false},
  {state:'FAILED',cancelled:true,canCancel:true,retryAllowed:false},
  {state:'FAILED',cancelled:true,canCancel:false,retryAllowed:true},
  {state:'FAILED',cancelled:false,canCancel:true,retryAllowed:false},
  {state:'SUCCEEDED',cancelled:false,canCancel:true,retryAllowed:false},
])('rejects contradictory post-dispatch exit %j', async ({state,retryAllowed,...patch})=>{
  mockRpc.mockResolvedValue(ok({...recovered(),turn:{...turn(state),retryAllowed},providerDispatched:true,...patch}));
  await expect(client.recoverTurn(C,K)).resolves.toMatchObject({ok:false,kod:'AI_TURN_INVALID_RESPONSE'});
});
