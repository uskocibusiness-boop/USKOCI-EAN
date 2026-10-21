import { decodeAiHistoryPage, listAiHistory, type AiHistoryPurpose } from '../aiHistoryClientService';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const id = (n: number) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const at = (n: number) => `2026-10-21T10:00:00.${String(n).padStart(6, '0')}Z`;
let mockSession: { user: { id: string } | null; accountRevision: number };
const mockRpc = jest.fn();
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }) }));

const row = (n: number, status: 'OPEN' | 'COMPLETED' | 'ABANDONED' = 'OPEN', purpose: AiHistoryPurpose = 'NEED_INTAKE') => ({
  conversationId: id(n), createdAt: at(n), closedAt: status === 'OPEN' ? null : '2026-10-21T11:00:00.123456Z', status,
  title: purpose === 'PROFILE' ? 'Razgovor o radnom profilu' : 'Razgovor o zadatku', titleSource: 'GENERIC',
  hasSavedProfile: purpose === 'PROFILE' && status === 'COMPLETED', visibility: 'VISIBLE',
  canContinue: status === 'OPEN', canRead: false,
});
const page = (purpose: AiHistoryPurpose, rows: ReturnType<typeof row>[], nextCursor: unknown = null) => ({
  schemaVersion: 'AI_HISTORY_V1', accountId: OWNER, purpose, observedAt: '2026-10-21T12:00:00.123456Z',
  rows, nextCursor, authoritative: true,
});
const cursor = (n: number) => ({ createdAt: at(n), conversationId: id(n) });
beforeEach(() => { mockSession = { user: { id: OWNER }, accountRevision: 4 }; mockRpc.mockReset(); });

test('task and worker history request only bounded owner metadata and decode separate purposes', async () => {
  mockRpc.mockResolvedValueOnce({ data: page('NEED_INTAKE', [row(3), row(2, 'ABANDONED')]), error: null });
  mockRpc.mockResolvedValueOnce({ data: page('PROFILE', [row(1, 'COMPLETED', 'PROFILE')]), error: null });
  const task = await listAiHistory('NEED_INTAKE');
  const worker = await listAiHistory('PROFILE');
  expect(task).toMatchObject({ ok: true, podatak: { purpose: 'NEED_INTAKE', rows: [{ status: 'OPEN' }, { status: 'ABANDONED' }] } });
  expect(worker).toMatchObject({ ok: true, podatak: { purpose: 'PROFILE', rows: [{ hasSavedProfile: true, titleSource: 'GENERIC' }] } });
  expect(mockRpc.mock.calls).toEqual(['NEED_INTAKE', 'PROFILE'].map(purpose => ['rpc_list_owned_ai_history_v1',
    { p_purpose: purpose, p_before_created_at: null, p_before_id: null, p_limit: 20 }]));
  expect(JSON.stringify(task)).not.toMatch(/body|candidate|profileId|address|PRIVATE_/i);
});

test('20+1 keyset proof preserves PostgreSQL microseconds when requesting the next page', async () => {
  const first = Array.from({ length: 20 }, (_, index) => row(30 - index));
  mockRpc.mockResolvedValueOnce({ data: page('NEED_INTAKE', first, cursor(11)), error: null });
  mockRpc.mockResolvedValueOnce({ data: page('NEED_INTAKE', [row(10)]), error: null });
  const a = await listAiHistory('NEED_INTAKE');
  expect(a.ok).toBe(true);
  if (!a.ok) return;
  expect(a.podatak.nextCursor).toEqual(cursor(11));
  const b = await listAiHistory('NEED_INTAKE', a.podatak.nextCursor);
  expect(b).toMatchObject({ ok: true, podatak: { rows: [{ conversationId: id(10) }], nextCursor: null } });
  expect(mockRpc.mock.calls[1][1]).toEqual({ p_purpose: 'NEED_INTAKE', p_before_created_at: at(11), p_before_id: id(11), p_limit: 20 });
});

test('same-microsecond rows use the conversation ID tie breaker and reject a repeated page boundary', () => {
  const newer = { ...row(3), createdAt: at(1) }, older = { ...row(2), createdAt: at(1) };
  expect(decodeAiHistoryPage(page('NEED_INTAKE', [newer, older]), OWNER, 'NEED_INTAKE')).not.toBeNull();
  expect(decodeAiHistoryPage(page('NEED_INTAKE', [older, newer]), OWNER, 'NEED_INTAKE')).toBeNull();
  expect(decodeAiHistoryPage(page('NEED_INTAKE', [newer]), OWNER, 'NEED_INTAKE', 20,
    { createdAt: at(1), conversationId: id(3) })).toBeNull();
});

test('distinct microseconds inside one JS millisecond outrank the UUID tie breaker', () => {
  const newer = { ...row(2), createdAt: at(2) }, older = { ...row(3), createdAt: at(1) };
  expect(decodeAiHistoryPage(page('NEED_INTAKE', [newer, older]), OWNER, 'NEED_INTAKE')?.rows.map(x => x.conversationId))
    .toEqual([id(2), id(3)]);
  expect(decodeAiHistoryPage(page('NEED_INTAKE', [older, newer]), OWNER, 'NEED_INTAKE')).toBeNull();
});

test.each([
  (base: ReturnType<typeof page>) => ({ ...base, accountId: OTHER }),
  (base: ReturnType<typeof page>) => ({ ...base, purpose: 'PROFILE' }),
  (base: ReturnType<typeof page>) => ({ ...base, authoritative: false }),
  (base: ReturnType<typeof page>) => ({ ...base, nextCursor: cursor(2) }),
  (base: ReturnType<typeof page>) => ({ ...base, rows: [{ ...base.rows[0], body: 'PRIVATE_BODY' }] }),
  (base: ReturnType<typeof page>) => ({ ...base, rows: [{ ...base.rows[0], title: 'PRIVATE_MESSAGE', titleSource: 'GENERIC' }] }),
  (base: ReturnType<typeof page>) => ({ ...base, rows: [{ ...base.rows[0], hasSavedProfile: true }] }),
  (base: ReturnType<typeof page>) => ({ ...base, rows: [{ ...base.rows[0], status: 'COMPLETED', canContinue: true }] }),
  (base: ReturnType<typeof page>) => ({ ...base, rows: [{ ...base.rows[0], canRead: true }] }),
])('forged or inconsistent metadata fails closed, never as an empty history', mutate => {
  const raw = mutate(page('NEED_INTAKE', [row(3)]));
  expect(decodeAiHistoryPage(raw, OWNER, 'NEED_INTAKE')).toBeNull();
});

test('confirmed task title is accepted, but worker profile text cannot masquerade as this session title', () => {
  const task = page('NEED_INTAKE', [{ ...row(3), title: 'Selidba', titleSource: 'CONFIRMED_NEED_TITLE' as const }]);
  expect(decodeAiHistoryPage(task, OWNER, 'NEED_INTAKE')?.rows[0].title).toBe('Selidba');
  const linked = page('NEED_INTAKE', [{ ...row(3, 'COMPLETED'), title: 'Selidba', titleSource: 'LINKED_TASK_TITLE' as const }]);
  expect(decodeAiHistoryPage(linked, OWNER, 'NEED_INTAKE')?.rows[0].titleSource).toBe('LINKED_TASK_TITLE');
  const worker = page('PROFILE', [{ ...row(3, 'OPEN', 'PROFILE'), title: 'Selidba', titleSource: 'CONFIRMED_NEED_TITLE' as const }]);
  expect(decodeAiHistoryPage(worker, OWNER, 'PROFILE')).toBeNull();
});

test('closed rows can admit H2 text reading, while an OPEN row never advertises it', () => {
  const closed = { ...row(3, 'COMPLETED'), canRead: true };
  const abandoned = { ...row(2, 'ABANDONED'), canRead: true };
  expect(decodeAiHistoryPage(page('NEED_INTAKE', [closed, abandoned]), OWNER, 'NEED_INTAKE')?.rows)
    .toMatchObject([{ canRead: true, status: 'COMPLETED' }, { canRead: true, status: 'ABANDONED' }]);
  expect(decodeAiHistoryPage(page('NEED_INTAKE', [{ ...row(3), canRead: true }]), OWNER, 'NEED_INTAKE')).toBeNull();
});

test('account revision change, offline read and closed-account refusal stay distinct from an empty page', async () => {
  mockRpc.mockImplementationOnce(async () => {
    mockSession = { user: { id: OWNER }, accountRevision: 5 };
    return { data: page('NEED_INTAKE', [row(1)]), error: null };
  });
  await expect(listAiHistory('NEED_INTAKE')).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  mockSession = { user: { id: OWNER }, accountRevision: 5 };
  mockRpc.mockResolvedValueOnce({ status: 0, data: null, error: { code: '', message: 'offline' } });
  await expect(listAiHistory('NEED_INTAKE')).resolves.toMatchObject({ ok: false, kod: 'AI_HISTORY_OFFLINE' });
  mockRpc.mockResolvedValueOnce({ status: 403, data: null, error: { code: '42501', message: 'ACCOUNT_CLOSING' } });
  await expect(listAiHistory('PROFILE')).resolves.toMatchObject({ ok: false, kod: 'ACCOUNT_CLOSING' });
});

test('invalid cursor or limit is stopped before an RPC', async () => {
  await expect(listAiHistory('NEED_INTAKE', { createdAt: '2026-10-21T10:00:00.123456Z', conversationId: 'wrong' })).resolves.toMatchObject({ ok: false, kod: 'AI_HISTORY_PAGE_INVALID' });
  await expect(listAiHistory('PROFILE', null, 21)).resolves.toMatchObject({ ok: false, kod: 'AI_HISTORY_PAGE_INVALID' });
  expect(mockRpc).not.toHaveBeenCalled();
});
