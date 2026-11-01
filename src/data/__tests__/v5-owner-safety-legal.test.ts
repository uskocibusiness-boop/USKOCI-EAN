jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
import { safetyClientService as safety } from '../safetyClientService';
import { legalClientService as legal } from '../legalClientService';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const K = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', R = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SHA = 'a'.repeat(64), PRIVACY = 'b'.repeat(64), mockRpc = jest.fn();
let mockSession: { user: { id: string } | null; accountRevision: number };
const report = () => ({ reportId: R, received: true, createdAt: '2026-09-13T01:00:00Z', clientRequestId: K, idempotentReplay: true, authoritative: true });
const legalReceipt = () => ({ accepted: true, idempotentReplay: true, acceptedAt: '2026-09-13T01:00:00Z',
  termsVersion: 'v1', privacyVersion: 'v2', termsSha256: SHA, privacySha256: PRIVACY });
const row = () => ({ accountId: A, targetAccountId: B, blocked: true, revision: 2, displayName: 'Uskočer', authoritative: true });
const respond = (data: unknown) => mockRpc.mockResolvedValue({ data, error: null });
beforeEach(() => { mockRpc.mockReset(); mockSession = { user: { id: A }, accountRevision: 1 }; });
it('returns only owned outgoing choices and approved public display label', async () => {
  respond({ accountId: A, authoritative: true, items: [{ ...row(), incomingBlocked: true, email: 'private' }], nextCursor: null });
  const result = await safety.listMyBlocks();
  expect(result).toEqual({ ok: true, podatak: { accountId: A, authoritative: true, items: [row()], nextCursor: null } });
  expect(mockRpc).toHaveBeenCalledWith('rpc_list_my_account_blocks', { p_after: null });
});
it.each([{ accountId: B }, { nextCursor: K }, { items: [row(), row()] }, { items: [{ ...row(), blocked: false }] },
  { items: [{ ...row(), targetAccountId: A }] }, { items: Array.from({ length: 51 }, row) }])('rejects foreign/invalid/unbounded block page %j', async patch => {
  respond({ accountId: A, authoritative: true, items: [row()], nextCursor: null, ...patch }); expect((await safety.listMyBlocks()).ok).toBe(false);
});
it('rejects bad cursor without I/O and filters rows before the requested cursor', async () => {
  expect((await safety.listMyBlocks('bad')).ok).toBe(false); expect(mockRpc).not.toHaveBeenCalled();
  respond({ accountId: A, authoritative: true, items: [row()], nextCursor: null }); expect((await safety.listMyBlocks(K)).ok).toBe(false);
});
it('restores own private report by stable command without exposing content', async () => {
  respond({ accountId: A, clientRequestId: K, found: true, receipt: { ...report(), narrative: 'private' }, authoritative: true });
  expect(await safety.readReportCommand(K)).toEqual({ ok: true, podatak: { accountId: A, clientRequestId: K, found: true, receipt: report(), authoritative: true } });
  expect(mockRpc).toHaveBeenCalledWith('rpc_read_my_safety_report_command', { p_client_request_id: K });
});
it.each([{ accountId: B }, { clientRequestId: B }, { receipt: { ...report(), clientRequestId: B } }, { found: false }, { authoritative: false }])('rejects uncorrelated private receipt %j', async patch => {
  respond({ accountId: A, clientRequestId: K, found: true, receipt: report(), authoritative: true, ...patch });
  expect((await safety.readReportCommand(K)).ok).toBe(false);
});
it('sends exactly reviewed legal hashes and strips untrusted extra fields', async () => {
  respond({ ...legalReceipt(), accountId: A, clientRequestId: K, authoritative: true, unrelated: 'secret' });
  expect(await legal.acceptReviewedBundle(K, SHA, PRIVACY)).toEqual({ ok: true, podatak: legalReceipt() });
  expect(mockRpc).toHaveBeenCalledWith('rpc_accept_reviewed_legal_bundle', { p_client_request_id: K, p_terms_sha256: SHA, p_privacy_sha256: PRIVACY });
});
it.each([{ termsSha256: PRIVACY }, { accountId: B }, { clientRequestId: B }, { acceptedAt: 'yesterday' }, { authoritative: false }])('rejects a legal acceptance for different bytes/actor/key %j', async patch => {
  respond({ ...legalReceipt(), accountId: A, clientRequestId: K, authoritative: true, ...patch });
  expect((await legal.acceptReviewedBundle(K, SHA, PRIVACY)).ok).toBe(false);
});
it('unknown legal acceptance does not replay or expose backend text', async () => {
  mockRpc.mockRejectedValue(new Error('PRIVATE_CONTENT'));
  const result = await legal.acceptReviewedBundle(K, SHA, PRIVACY);
  expect(result).toMatchObject({ ok: false, kod: 'LEGAL_ACCEPT_OUTCOME_UNKNOWN' });
  expect(JSON.stringify(result)).not.toContain('PRIVATE_CONTENT'); expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('only a returned server review-change response carries intent-retirement authority', async () => {
  const invalid = await legal.acceptReviewedBundle('malformed', SHA, PRIVACY);
  expect(invalid).toMatchObject({ ok: false, kod: 'LEGAL_REVIEW_CHANGED' });
  expect(invalid).not.toHaveProperty('authoritativeReviewChanged'); expect(mockRpc).not.toHaveBeenCalled();
  mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'LEGAL_REVIEW_CHANGED', code: 'PT409' } });
  expect(await legal.acceptReviewedBundle(K, SHA, PRIVACY)).toMatchObject({ ok: false, kod: 'LEGAL_REVIEW_CHANGED', authoritativeReviewChanged: true });
  mockRpc.mockRejectedValueOnce(new Error('LEGAL_REVIEW_CHANGED'));
  const thrown = await legal.acceptReviewedBundle(K, SHA, PRIVACY);
  expect(thrown).toMatchObject({ ok: false, kod: 'LEGAL_ACCEPT_OUTCOME_UNKNOWN' });
  expect(thrown).not.toHaveProperty('authoritativeReviewChanged');
});
it('a server rejection after account ABA cannot retire the old reviewed intent', async () => {
  let resolve!: (r: unknown) => void; mockRpc.mockImplementation(() => new Promise(r => { resolve = r; }));
  const request = legal.acceptReviewedBundle(K, SHA, PRIVACY); mockSession = { user: { id: A }, accountRevision: 3 };
  resolve({ data: null, error: { message: 'LEGAL_REVIEW_CHANGED', code: 'PT409' } });
  const result = await request; expect(result).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  expect(result).not.toHaveProperty('authoritativeReviewChanged');
});
it('reads absent acceptance as absent and does not create consent', async () => {
  respond({ accountId: A, clientRequestId: K, found: false, receipt: null, authoritative: true });
  expect(await legal.readAcceptance(K)).toEqual({ ok: true, podatak: { found: false, receipt: null } });
  expect(mockRpc).toHaveBeenCalledWith('rpc_read_my_legal_acceptance', { p_client_request_id: K });
});
it('fences late legal read and sends no requests after signout', async () => {
  let resolve!: (r: unknown) => void; mockRpc.mockImplementation(() => new Promise(r => { resolve = r; }));
  const request = legal.readAcceptance(K); mockSession = { user: { id: B }, accountRevision: 2 };
  resolve({ data: { accountId: A, clientRequestId: K, found: true, receipt: legalReceipt(), authoritative: true }, error: null });
  expect(await request).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' }); mockRpc.mockClear(); mockSession.user = null;
  expect((await legal.acceptReviewedBundle(K, SHA, PRIVACY)).ok).toBe(false); expect((await safety.listMyBlocks()).ok).toBe(false);
  expect(mockRpc).not.toHaveBeenCalled();
});
