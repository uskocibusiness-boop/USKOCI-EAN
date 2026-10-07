import type { Session } from '@supabase/supabase-js';
import type { PublicationDecision, PublicationNotReadyCode, PublicationOutcome, PublishNeedCommand } from '../../contracts/publication';
import { inicijalizujSesiju, sesijaSada } from '../../store/sesija';
import { publicationClientService as publication } from '../publicationClientService';

const A = '11111111-2222-4333-8444-555555555555';
const B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const NEED = '22222222-3333-4444-8555-666666666666';
const DECISION = '33333333-4444-4555-8666-777777777777';
const POLICY = '44444444-5555-4666-8777-888888888888';
const request = { needId: NEED, expectedRevision: 7 };
const mockRpc = jest.fn();
const mockGetSession = jest.fn();
const mockInvoke = jest.fn();
let mockAuthEvent: (event: string, session: Session | null) => void;
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({
  rpc: mockRpc,
  auth: { getSession: mockGetSession, onAuthStateChange: (callback: typeof mockAuthEvent) => {
    mockAuthEvent = callback;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  } },
  functions: { invoke: mockInvoke },
}) }));
// Keep the real session state machine and serverReceipt; only unrelated storage is isolated.
jest.mock('../../store/povratniCilj', () => ({ povratniCilj: {
  captureSessionCleanup: () => () => Promise.resolve(), snapshot: () => Promise.resolve(null),
} }));

const session = (id = A, token = 'synthetic-owner-access-token'): Session => ({
  user: { id }, access_token: token, refresh_token: 'synthetic-refresh', expires_in: 3600, token_type: 'bearer',
} as Session);
const authResponse = (value: Session | null = session()) => ({ data: { session: value }, error: null });
const decision = (outcome: PublicationOutcome = 'ALLOW'): PublicationDecision => ({
  decisionId: DECISION, decisionSequence: 23, needId: NEED, needRevision: 7,
  canonicalFingerprint: 'a'.repeat(64), policyBundleId: POLICY, policyVersion: 3,
  jurisdiction: 'RS', outcome, decisionAt: '2026-09-10T14:40:32.123456Z',
  ruleIds: ['RS_PUBLICATION_1'], safeReasonCodes: outcome === 'ALLOW' ? [] : ['OWNER_REVIEW_REQUIRED'],
  publishable: outcome === 'ALLOW', authoritative: true,
});
const command = (): PublishNeedCommand => ({ ...request, decisionSequence: 23,
  responseDeadline: '2026-09-11T12:00:00.123456Z', clientRequestId: 'publication-request-001', confirmed: true });
const receipt = (idempotentReplay = false) => ({ needId: NEED, status: 'PUBLISHED',
  publishedAt: '2026-09-10T14:40:33.123456Z', responseDeadline: command().responseDeadline, idempotentReplay });
const answer = (data: unknown) => ({ data, error: null });
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 8; i += 1) await Promise.resolve(); }
function accountRoundTrip() {
  const before = sesijaSada().accountRevision;
  mockAuthEvent('SIGNED_IN', session(B)); mockAuthEvent('SIGNED_IN', session(A));
  expect(sesijaSada().user?.id).toBe(A);
  expect(sesijaSada().accountRevision).toBe(before + 2);
}
async function evaluateRaw(data: unknown) {
  mockInvoke.mockResolvedValueOnce(answer(data));
  return publication.evaluate(request);
}

beforeEach(async () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-10T14:00:00Z'));
  mockRpc.mockReset(); mockInvoke.mockReset(); mockGetSession.mockReset();
  mockGetSession.mockResolvedValue(authResponse());
  inicijalizujSesiju();
  mockAuthEvent('SIGNED_OUT', null); mockAuthEvent('SIGNED_IN', session());
  await flush(); mockGetSession.mockClear();
  mockInvoke.mockResolvedValue(answer({ kind: 'DECISION', decision: decision() }));
  mockRpc.mockResolvedValue(answer(receipt()));
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

describe('authoritative evaluation boundary', () => {
  it.each<PublicationOutcome>(['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'])('preserves an actual stored %s decision without publishing it', async outcome => {
    const data = { kind: 'DECISION', decision: decision(outcome) };
    await expect(evaluateRaw(data)).resolves.toEqual({ ok: true, podatak: data });
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke.mock.calls[0][0]).toBe('uskoci-publication-evaluate');
    expect(mockInvoke.mock.calls[0][1]).toEqual({ body: request,
      headers: { Authorization: 'Bearer synthetic-owner-access-token' }, signal: expect.any(AbortSignal) });
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it.each<PublicationNotReadyCode>(['POLICY_NOT_READY', 'POLICY_CONTENT_NOT_READY', 'LOCATION_INCOMPLETE',
    'COUNTRY_NOT_READY', 'PUBLIC_MEDIA_NOT_READY', 'EVALUATOR_UNAVAILABLE', 'EVALUATOR_INVALID_RESPONSE', 'RATE_LIMITED', 'NEED_CHANGED'])
  ('keeps %s as a nondecision, never fabricated ALLOW', async code => {
    const data = { kind: 'NOT_READY', needId: NEED, needRevision: 7, authoritativeDecision: false, code,
      ...(code === 'LOCATION_INCOMPLETE' ? { missingSlots: ['start', 'waypoints/19', 'end'] } : {}) };
    await expect(evaluateRaw(data)).resolves.toEqual({ ok: true, podatak: data });
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it.each([
    ['foreign Need', { needId: B }], ['changed revision', { needRevision: 8 }], ['string revision', { needRevision: '7' }],
    ['malformed decision ID', { decisionId: 'not-a-uuid' }], ['missing policy ID', { policyBundleId: null }],
    ['unsafe integer sequence', { decisionSequence: Number.MAX_SAFE_INTEGER + 1 }], ['string sequence', { decisionSequence: '23' }],
    ['fractional sequence', { decisionSequence: 23.5 }], ['zero sequence', { decisionSequence: 0 }],
    ['unsafe policy version', { policyVersion: 2_147_483_648 }], ['short fingerprint', { canonicalFingerprint: 'a'.repeat(63) }],
    ['invalid fingerprint', { canonicalFingerprint: 'g'.repeat(64) }], ['missing timestamp', { decisionAt: null }],
    ['unknown outcome', { outcome: 'APPROVED' }], ['unattested result', { authoritative: false }],
    ['false ALLOW flag', { publishable: false }], ['string true flag', { authoritative: 'true' }],
    ['noncountry jurisdiction', { jurisdiction: 'Serbia' }], ['raw provider field', { providerOutput: 'PRIVATE_PROVIDER_PAYLOAD' }],
    ['empty rule evidence', { ruleIds: [] }], ['duplicated rules', { ruleIds: ['RULE_1', 'RULE_1'] }],
    ['duplicated reason codes', { safeReasonCodes: ['REVIEW_1', 'REVIEW_1'] }],
  ])('refuses %s in a decision receipt', async (_label, patch) => {
    await expect(evaluateRaw({ kind: 'DECISION', decision: { ...decision(), ...(patch as object) } }))
      .resolves.toMatchObject({ ok: false, kod: 'PUBLICATION_INVALID_RESPONSE' });
    expect(mockInvoke).toHaveBeenCalledTimes(1); expect(mockRpc).not.toHaveBeenCalled();
  });
  it('accepts the largest exactly representable decision sequence without rounding it', async () => {
    await expect(evaluateRaw({ kind: 'DECISION', decision: { ...decision(), decisionSequence: Number.MAX_SAFE_INTEGER } }))
      .resolves.toMatchObject({ ok: true, podatak: { decision: { decisionSequence: Number.MAX_SAFE_INTEGER } } });
  });
  it.each(['CLARIFY', 'REVIEW', 'BLOCK'] as const)('refuses a publishable flag attached to %s', async outcome => {
    await expect(evaluateRaw({ kind: 'DECISION', decision: { ...decision(outcome), publishable: true } }))
      .resolves.toMatchObject({ ok: false, kod: 'PUBLICATION_INVALID_RESPONSE' });
  });
  it.each([
    null, [], { kind: 'ALLOW' }, { kind: 'DECISION', decision: decision(), raw: 'PRIVATE_PROVIDER_PAYLOAD' },
    { kind: 'NOT_READY', needId: B, needRevision: 7, authoritativeDecision: false, code: 'POLICY_NOT_READY' },
    { kind: 'NOT_READY', needId: NEED, needRevision: 8, authoritativeDecision: false, code: 'POLICY_NOT_READY' },
    { kind: 'NOT_READY', needId: NEED, needRevision: 7, authoritativeDecision: true, code: 'POLICY_NOT_READY' },
    { kind: 'NOT_READY', needId: NEED, needRevision: 7, authoritativeDecision: false, code: 'PRIVATE_PROVIDER_PAYLOAD' },
    { kind: 'NOT_READY', needId: NEED, needRevision: 7, authoritativeDecision: false, code: 'LOCATION_INCOMPLETE', missingSlots: ['waypoints/20'] },
    { kind: 'NOT_READY', needId: NEED, needRevision: 7, authoritativeDecision: false, code: 'LOCATION_INCOMPLETE', missingSlots: ['start', 'start'] },
    { kind: 'NOT_READY', needId: NEED, needRevision: 7, authoritativeDecision: false, code: 'LOCATION_INCOMPLETE', missingSlots: null },
  ])('rejects corrupt or mismatched evaluation envelopes: %p', async raw => {
    const result = await evaluateRaw(raw);
    expect(result).toMatchObject({ ok: false, kod: 'PUBLICATION_INVALID_RESPONSE' });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_PROVIDER_PAYLOAD');
  });
  it.each([
    ['lowercase rule', { ruleIds: ['rule_1'] }], ['punctuation rule', { ruleIds: ['RULE.1'] }],
    ['oversized rule token', { ruleIds: ['R'.repeat(65)] }], ['too many rules', { ruleIds: Array.from({ length: 65 }, (_, i) => `RULE_${i}`) }],
    ['lowercase reason', { safeReasonCodes: ['reason'] }], ['oversized reason token', { safeReasonCodes: ['R'.repeat(65)] }],
    ['too many reasons', { safeReasonCodes: Array.from({ length: 65 }, (_, i) => `REASON_${i}`) }],
  ])('enforces the same bounded policy tokens as the authority: %s', async (_label, patch) => {
    await expect(evaluateRaw({ kind: 'DECISION', decision: { ...decision(), ...(patch as object) } }))
      .resolves.toMatchObject({ ok: false, kod: 'PUBLICATION_INVALID_RESPONSE' });
  });
  it('keeps 64 valid distinct rule/reason tokens, including the 64-character boundary', async () => {
    const tokens = ['R'.repeat(64), ...Array.from({ length: 63 }, (_, i) => `RULE_${i}-A`)];
    const data = { kind: 'DECISION', decision: { ...decision(), ruleIds: tokens, safeReasonCodes: tokens } };
    await expect(evaluateRaw(data)).resolves.toEqual({ ok: true, podatak: data });
  });
});

describe('canonical publication command and receipt', () => {
  it('sends only the existing B07 payload after explicit confirmation', async () => {
    await expect(publication.publish(command())).resolves.toEqual({ ok: true, podatak: receipt() });
    expect(mockRpc.mock.calls).toEqual([['rpc_publish_need_canonical', {
      p_need_id: NEED, p_expected_revision: 7, p_decision_sequence: 23,
      p_response_deadline: command().responseDeadline, p_client_request_id: command().clientRequestId,
    }]]);
    expect(mockInvoke).not.toHaveBeenCalled(); expect(mockGetSession).not.toHaveBeenCalled();
  });
  it.each([{ confirmed: false }, { confirmed: undefined }, { confirmed: 'true' }, { needId: B + '-invalid' },
    { expectedRevision: 0 }, { expectedRevision: 7.5 }, { decisionSequence: Number.MAX_SAFE_INTEGER + 1 },
    { clientRequestId: 'short' }, { clientRequestId: ' surrounded ' }, { responseDeadline: 'tomorrow' }])
  ('rejects unconfirmed or malformed commands before a write: %p', async patch => {
    await expect(publication.publish({ ...command(), ...patch } as PublishNeedCommand))
      .resolves.toMatchObject({ ok: false, kod: 'PUBLICATION_INPUT_INVALID' });
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it('preserves null deadlines without inventing one', async () => {
    const data = { ...receipt(), responseDeadline: null };
    mockRpc.mockResolvedValue(answer(data));
    await expect(publication.publish({ ...command(), responseDeadline: null })).resolves.toEqual({ ok: true, podatak: data });
  });
  it('lets the server recover an explicit same-key retry after its deadline elapsed', async () => {
    const original = command();
    await expect(publication.publish(original)).resolves.toMatchObject({ ok: true });
    jest.setSystemTime(new Date('2026-09-12T14:00:00Z'));
    mockRpc.mockResolvedValueOnce(answer(receipt(true)));
    await expect(publication.publish(original)).resolves.toEqual({ ok: true, podatak: receipt(true) });
    expect(mockRpc.mock.calls[1]).toEqual(mockRpc.mock.calls[0]);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
  it.each([{ needId: B }, { status: 'DRAFT' }, { publishedAt: null }, { idempotentReplay: 'true' },
    { responseDeadline: null }, { responseDeadline: '2026-09-12T12:00:00.123456Z' },
    { revision: 8 }, { providerOutput: 'PRIVATE_PROVIDER_PAYLOAD' }])('rejects a receipt for another result: %p', async patch => {
    mockRpc.mockResolvedValue(answer({ ...receipt(), ...patch }));
    await expect(publication.publish(command())).resolves.toMatchObject({ ok: false, kod: 'PUBLICATION_INVALID_RESPONSE' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
  it('rejects a different deadline even when both instants share the same JS millisecond', async () => {
    mockRpc.mockResolvedValue(answer({ ...receipt(), responseDeadline: '2026-09-11T12:00:00.123999Z' }));
    await expect(publication.publish(command())).resolves.toMatchObject({ ok: false, kod: 'PUBLICATION_INVALID_RESPONSE' });
  });
  it('accepts the same precise deadline expressed with an equivalent timezone offset', async () => {
    mockRpc.mockResolvedValue(answer({ ...receipt(), responseDeadline: '2026-09-11T14:00:00.123456+02:00' }));
    await expect(publication.publish(command())).resolves.toMatchObject({ ok: true });
  });
});

describe('safe failures and actual session incarnation fences', () => {
  it.each(['evaluate', 'publish'] as const)('%s refuses signed-out calls before any SDK transport', async operation => {
    mockAuthEvent('SIGNED_OUT', null);
    // Since 2026-10-07 the session store reads its own storage once after a sign-out, to tell a restricted account apart
    // (sesija.explainSignOut). That read belongs to the store; this case is about the publication client sending nothing.
    await flush(); mockGetSession.mockClear();
    const result = operation === 'evaluate' ? publication.evaluate(request) : publication.publish(command());
    await expect(result).resolves.toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
    expect(mockGetSession).not.toHaveBeenCalled(); expect(mockInvoke).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
  });
  it.each(['need', 'revision'] as const)('rejects invalid evaluation %s before Auth', async kind => {
    await expect(publication.evaluate(kind === 'need' ? { ...request, needId: 'not-id' } : { ...request, expectedRevision: 2_147_483_648 }))
      .resolves.toMatchObject({ ok: false, kod: 'PUBLICATION_INPUT_INVALID' });
    expect(mockGetSession).not.toHaveBeenCalled(); expect(mockInvoke).not.toHaveBeenCalled();
  });
  it.each([null, session(B)])('never invokes Edge for an absent or foreign SDK session: %p', async sdkSession => {
    mockGetSession.mockResolvedValueOnce(authResponse(sdkSession));
    await expect(publication.evaluate(request)).resolves.toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
    expect(mockInvoke).not.toHaveBeenCalled();
  });
  it('does not invoke after A→B→A during the asynchronous getSession', async () => {
    const auth = deferred(); mockGetSession.mockReturnValueOnce(auth.promise);
    const pending = publication.evaluate(request); accountRoundTrip(); auth.resolve(authResponse());
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
    expect(mockInvoke).not.toHaveBeenCalled();
  });
  it('drops an Edge decision after A→B→A without publishing or adopting it', async () => {
    const edge = deferred(); mockInvoke.mockReturnValueOnce(edge.promise);
    const pending = publication.evaluate(request); await flush(); expect(mockInvoke).toHaveBeenCalledTimes(1);
    accountRoundTrip(); edge.resolve(answer({ kind: 'DECISION', decision: decision() }));
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it('drops an already-sent canonical receipt after an actual account incarnation change', async () => {
    const rpc = deferred(); mockRpc.mockReturnValueOnce(rpc.promise);
    const pending = publication.publish(command()); expect(mockRpc).toHaveBeenCalledTimes(1);
    accountRoundTrip(); rpc.resolve(answer(receipt()));
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
  it('preserves same-account token refresh across getSession and a pending Edge decision', async () => {
    const auth = deferred(), edge = deferred();
    mockGetSession.mockReturnValueOnce(auth.promise); mockInvoke.mockReturnValueOnce(edge.promise);
    const revision = sesijaSada().accountRevision, pending = publication.evaluate(request);
    mockAuthEvent('TOKEN_REFRESHED', session(A, 'synthetic-rotated-token'));
    expect(sesijaSada().accountRevision).toBe(revision);
    auth.resolve(authResponse(session(A, 'synthetic-rotated-token'))); await flush();
    expect(mockInvoke.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer synthetic-rotated-token' });
    edge.resolve(answer({ kind: 'DECISION', decision: decision() }));
    await expect(pending).resolves.toMatchObject({ ok: true });
  });
  it.each(['evaluate', 'publish'] as const)('%s sanitizes returned and thrown provider errors without replay', async operation => {
    const transport = operation === 'evaluate' ? mockInvoke : mockRpc;
    const call = () => operation === 'evaluate' ? publication.evaluate(request) : publication.publish(command());
    transport.mockResolvedValueOnce({ data: null, error: { message: 'PRIVATE_PROVIDER_PAYLOAD', code: 'PRIVATE_CODE', details: 'PRIVATE_TOKEN' } });
    const returned = await call(); expect(returned.ok).toBe(false); expect(JSON.stringify(returned)).not.toMatch(/PRIVATE_/);
    transport.mockRejectedValueOnce(new Error('PRIVATE_PROVIDER_PAYLOAD PRIVATE_TOKEN'));
    const thrown = await call(); expect(thrown.ok).toBe(false); expect(JSON.stringify(thrown)).not.toMatch(/PRIVATE_/);
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it.each([[401, 'AUTH_REQUIRED'], [403, 'NEED_NOT_OWNED'], [409, 'NEED_REVISION_STALE']] as const)
  ('maps only the safe meaning of Edge HTTP %s without consuming its private body', async (status, code) => {
    const context = new Response('PRIVATE_PROVIDER_PAYLOAD', { status });
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'PRIVATE_URL_WITH_KEY', context } });
    const result = await publication.evaluate(request);
    expect(result).toMatchObject({ ok: false, kod: code }); expect(JSON.stringify(result)).not.toMatch(/PRIVATE_/);
    expect(context.bodyUsed).toBe(false);
  });
  it.each(['PUBLICATION_DECISION_STALE', 'PUBLICATION_CONTEXT_NOT_READY', 'PUBLICATION_DECISION_CONTEXT_STALE'])('preserves definitive canonical rejection %s without private details or replay', async code => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: code, details: 'PRIVATE_FINGERPRINT' } });
    const result = await publication.publish(command()); expect(result).toMatchObject({ ok: false, kod: code });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_FINGERPRINT');
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
  it('bounds a hanging getSession and never invokes after its late session resolves', async () => {
    const auth = deferred(); mockGetSession.mockReturnValueOnce(auth.promise);
    const pending = publication.evaluate(request);
    await jest.advanceTimersByTimeAsync(15_001);
    const result = await pending; expect(result).toMatchObject({ ok: false, kod: 'PUBLICATION_EVALUATION_UNCONFIRMED' });
    auth.resolve(authResponse()); await flush();
    expect(mockGetSession).toHaveBeenCalledTimes(1); expect(mockInvoke).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });
  it('aborts a slow Edge call, bounds the result and never adopts a late decision or replays', async () => {
    const edge = deferred(); mockInvoke.mockReturnValueOnce(edge.promise);
    const pending = publication.evaluate(request); await flush();
    const signal: AbortSignal = mockInvoke.mock.calls[0][1].signal;
    await jest.advanceTimersByTimeAsync(15_001);
    const result = await pending; expect(result).toMatchObject({ ok: false, kod: 'PUBLICATION_EVALUATION_UNCONFIRMED' });
    expect(signal.aborted).toBe(true); edge.resolve(answer({ kind: 'DECISION', decision: decision() })); await flush();
    expect(result.ok).toBe(false); expect(mockInvoke).toHaveBeenCalledTimes(1); expect(mockRpc).not.toHaveBeenCalled();
  });
  it('bounds an unknown canonical write without retry, then permits only the explicit same-command recovery', async () => {
    const rpc = deferred(); mockRpc.mockReturnValueOnce(rpc.promise);
    const intent = command(), pending = publication.publish(intent);
    await jest.advanceTimersByTimeAsync(15_001);
    const result = await pending; expect(result).toMatchObject({ ok: false, kod: 'NEED_PUBLISH_UNCONFIRMED' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    rpc.resolve(answer(receipt())); await flush(); expect(result.ok).toBe(false); expect(mockRpc).toHaveBeenCalledTimes(1);
    jest.setSystemTime(new Date('2026-09-12T14:00:00Z')); mockRpc.mockResolvedValueOnce(answer(receipt(true)));
    await expect(publication.publish(intent)).resolves.toMatchObject({ ok: true, podatak: { idempotentReplay: true } });
    expect(mockRpc).toHaveBeenCalledTimes(2); expect(mockRpc.mock.calls[1]).toEqual(mockRpc.mock.calls[0]);
  });
});
