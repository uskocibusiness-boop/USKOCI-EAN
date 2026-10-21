import { aiHistoryMessageCursor, decodeAiHistoryMessagesPage, listAiHistoryMessages }
  from '../aiHistoryMessagesClientService';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const id = (n: number) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const at = '2026-10-21T12:00:00.123456Z';
let mockSession: { user: { id: string } | null; accountRevision: number };
const mockRpc = jest.fn();
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }) }));

const message = (n: number) => ({
  id: id(n), role: n % 2 ? 'USER' : 'ASSISTANT',
  body: n % 2 ? 'Treba mi pomoć oko selidbe.' : 'Koji datum vam odgovara?', createdAt: at,
});
const page = (rows: ReturnType<typeof message>[], hasMore = false, nextBeforeMessageId: unknown = null) => ({
  schemaVersion: 'AI_HISTORY_MESSAGES_V1', accountId: OWNER, purpose: 'NEED_INTAKE', conversationId: CID,
  status: 'COMPLETED', observedAt: at, rows, hasMore, nextBeforeMessageId, authoritative: true,
});
beforeEach(() => { mockSession = { user: { id: OWNER }, accountRevision: 4 }; mockRpc.mockReset(); });

test('reads closed owner transcript in opaque message ID pages without exposing global sequence', async () => {
  const first = Array.from({ length: 50 }, (_, i) => message(60 - i));
  mockRpc.mockResolvedValueOnce({ data: page(first, true, message(11).id), error: null });
  mockRpc.mockResolvedValueOnce({ data: page([message(10)]), error: null });
  const a = await listAiHistoryMessages('NEED_INTAKE', CID);
  expect(a).toMatchObject({ ok: true, podatak: { hasMore: true, nextBeforeMessageId: message(11).id } });
  expect(JSON.stringify(a)).not.toMatch(/sequence|nextBeforeSequence/i);
  if (!a.ok) return;
  const b = await listAiHistoryMessages('NEED_INTAKE', CID, a.podatak.nextBeforeMessageId);
  expect(b).toMatchObject({ ok: true, podatak: { rows: [{ id: message(10).id }], hasMore: false } });
  expect(mockRpc.mock.calls).toEqual([
    ['rpc_list_owned_ai_history_messages_v1', { p_purpose: 'NEED_INTAKE', p_conversation_id: CID, p_before_message_id: null, p_limit: 50 }],
    ['rpc_list_owned_ai_history_messages_v1', { p_purpose: 'NEED_INTAKE', p_conversation_id: CID, p_before_message_id: message(11).id, p_limit: 50 }],
  ]);
});

test('worker closed transcript and a genuinely empty transcript decode without an active editor', () => {
  const worker = { ...page([message(1)]), purpose: 'PROFILE', status: 'ABANDONED' };
  expect(decodeAiHistoryMessagesPage(worker, OWNER, 'PROFILE', CID)?.rows[0].body).toContain('selidbe');
  expect(decodeAiHistoryMessagesPage({ ...worker, rows: [] }, OWNER, 'PROFILE', CID)?.rows).toEqual([]);
  expect(decodeAiHistoryMessagesPage({ ...worker, status: 'OPEN' }, OWNER, 'PROFILE', CID)).toBeNull();
});

test('cursor accepts UUID only; sequence guesses cannot be sent as cursors', () => {
  expect(aiHistoryMessageCursor(id(3))).toBe(true);
  for (const value of [0, 3, '3', '9223372036854775807', '01', '00000000-0000-0000-0000-00000000000z']) {
    expect(aiHistoryMessageCursor(value)).toBe(false);
  }
});

test.each([
  (raw: ReturnType<typeof page>) => ({ ...raw, accountId: OTHER }),
  (raw: ReturnType<typeof page>) => ({ ...raw, purpose: 'PROFILE' }),
  (raw: ReturnType<typeof page>) => ({ ...raw, conversationId: OTHER }),
  (raw: ReturnType<typeof page>) => ({ ...raw, status: 'OPEN' }),
  (raw: ReturnType<typeof page>) => ({ ...raw, authoritative: false }),
  (raw: ReturnType<typeof page>) => ({ ...raw, body: 'unexpected' }),
  (raw: ReturnType<typeof page>) => ({ ...raw, rows: [{ ...raw.rows[0], sequence: '9007199254740993' }] }),
  (raw: ReturnType<typeof page>) => ({ ...raw, rows: [{ ...raw.rows[0], hiddenMetadata: 'private' }] }),
  (raw: ReturnType<typeof page>) => ({ ...raw, rows: [{ ...raw.rows[0], body: ' ' }] }),
  (raw: ReturnType<typeof page>) => ({ ...raw, rows: [{ ...raw.rows[0], role: 'SYSTEM' }] }),
  (raw: ReturnType<typeof page>) => ({ ...raw, hasMore: true, nextBeforeMessageId: raw.rows[0].id }),
  (raw: ReturnType<typeof page>) => ({ ...raw, nextBeforeMessageId: raw.rows[0].id }),
])('forged, malformed or inconsistent message page fails closed', mutate => {
  expect(decodeAiHistoryMessagesPage(mutate(page([message(3)])), OWNER, 'NEED_INTAKE', CID)).toBeNull();
});

test('repeated message IDs, a repeated page boundary and false next cursor fail', () => {
  expect(decodeAiHistoryMessagesPage(page([message(3), message(3)]), OWNER, 'NEED_INTAKE', CID)).toBeNull();
  expect(decodeAiHistoryMessagesPage(page([message(3)]), OWNER, 'NEED_INTAKE', CID, 50, message(3).id)).toBeNull();
  expect(decodeAiHistoryMessagesPage(page([message(3), { ...message(2), id: id(3) }]), OWNER, 'NEED_INTAKE', CID)).toBeNull();
  expect(decodeAiHistoryMessagesPage(page([message(3)], true, id(9)), OWNER, 'NEED_INTAKE', CID, 1)).toBeNull();
});

test('account revision change, offline and closed-account refusal do not become empty transcripts', async () => {
  mockRpc.mockImplementationOnce(async () => {
    mockSession = { user: { id: OWNER }, accountRevision: 5 };
    return { data: page([message(1)]), error: null };
  });
  await expect(listAiHistoryMessages('NEED_INTAKE', CID)).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  mockRpc.mockResolvedValueOnce({ status: 0, data: null, error: { code: '', message: 'offline' } });
  await expect(listAiHistoryMessages('NEED_INTAKE', CID)).resolves.toMatchObject({ ok: false, kod: 'AI_HISTORY_MESSAGES_OFFLINE' });
  mockRpc.mockResolvedValueOnce({ status: 403, data: null, error: { code: '42501', message: 'ACCOUNT_CLOSING' } });
  await expect(listAiHistoryMessages('PROFILE', CID)).resolves.toMatchObject({ ok: false, kod: 'ACCOUNT_CLOSING' });
  mockRpc.mockResolvedValueOnce({ status: 400, data: null, error: { code: '22023', message: 'AI_HISTORY_CURSOR_INVALID' } });
  await expect(listAiHistoryMessages('NEED_INTAKE', CID, id(44))).resolves.toMatchObject({ ok: false, kod: 'AI_HISTORY_CURSOR_INVALID' });
});

test('invalid request arguments are stopped before the RPC', async () => {
  await expect(listAiHistoryMessages('NEED_INTAKE', 'wrong')).resolves.toMatchObject({ ok: false, kod: 'AI_HISTORY_MESSAGES_PAGE_INVALID' });
  await expect(listAiHistoryMessages('PROFILE', CID, '01')).resolves.toMatchObject({ ok: false, kod: 'AI_HISTORY_MESSAGES_PAGE_INVALID' });
  await expect(listAiHistoryMessages('PROFILE', CID, null, 51)).resolves.toMatchObject({ ok: false, kod: 'AI_HISTORY_MESSAGES_PAGE_INVALID' });
  expect(mockRpc).not.toHaveBeenCalled();
});
