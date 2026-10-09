import { listOpenIntakes, OPEN_INTAKE_PAGE_SIZE } from '../aiOpenIntakes';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let mockSession: { user: { id: string } | null; accountRevision: number };
const mockResult = jest.fn();
const mockQuery: Record<string, jest.Mock> = {};
for (const name of ['select', 'eq', 'is', 'order', 'limit', 'or']) mockQuery[name] = jest.fn(() => mockQuery);
mockQuery.then = jest.fn((resolve, reject) => Promise.resolve(mockResult()).then(resolve, reject));
const mockFrom = jest.fn(() => mockQuery);
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ from: mockFrom }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
const row = (n = 1, patch = {}) => ({ id: `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`, account_id: A,
  purpose: 'NEED_INTAKE', status: 'OPEN', fact_schema_version: 'NEED_FACT_V2', bound_need_id: null,
  created_at: '2026-10-09T18:00:00.123456+00:00', ...patch });
beforeEach(() => { jest.clearAllMocks(); mockSession = { user: { id: A }, accountRevision: 1 }; mockResult.mockReturnValue({ data: [], error: null }); });

it('reads only owned unbound OPEN V2 intakes, bounds payload, and preserves the microsecond/id keyset', async () => {
  mockResult.mockReturnValue({ data: Array.from({ length: 21 }, (_, i) => row(21 - i)), error: null });
  const page = await listOpenIntakes();
  expect(page.rows).toHaveLength(OPEN_INTAKE_PAGE_SIZE);
  expect(page.next).toEqual({ id: row(2).id, createdAt: row(2).created_at });
  expect(mockFrom).toHaveBeenCalledWith('ai_conversations');
  for (const pair of [['account_id', A], ['purpose', 'NEED_INTAKE'], ['status', 'OPEN'], ['fact_schema_version', 'NEED_FACT_V2']])
    expect(mockQuery.eq).toHaveBeenCalledWith(...pair);
  expect(mockQuery.is).toHaveBeenCalledWith('bound_need_id', null);
  expect(mockQuery.limit).toHaveBeenCalledWith(21);
  expect(mockQuery.order.mock.calls).toEqual([['created_at', { ascending: false }], ['id', { ascending: false }]]);
  mockResult.mockReturnValue({ data: [row(1)], error: null });
  expect(await listOpenIntakes(page.next)).toEqual({ rows: [{ id: row(1).id, createdAt: row(1).created_at }], next: null });
  expect(mockQuery.or).toHaveBeenCalledWith(`created_at.lt.${row(2).created_at},and(created_at.eq.${row(2).created_at},id.lt.${row(2).id})`);
});
it.each([{ account_id: B }, { purpose: 'NEED_EDIT' }, { status: 'COMPLETED' }, { status: 'ABANDONED' },
  { fact_schema_version: 'NEED_FACT_V1' }, { bound_need_id: B }, { created_at: 'yesterday' }, { body: 'private text' }])(
  'fails closed on an out-of-scope or malformed row %j', async patch => {
    mockResult.mockReturnValue({ data: [row(1, patch)], error: null });
    await expect(listOpenIntakes()).rejects.toThrow();
  });
it.each([null, [row(), row()], Array.from({ length: 22 }, (_, i) => row(i))])('rejects malformed, duplicate and oversized pages', async data => {
  mockResult.mockReturnValue({ data, error: null }); await expect(listOpenIntakes()).rejects.toThrow();
});
it('distinguishes a successful empty page from offline/error', async () => {
  expect(await listOpenIntakes()).toEqual({ rows: [], next: null });
  mockResult.mockReturnValue({ data: null, error: { message: 'offline' } }); await expect(listOpenIntakes()).rejects.toThrow();
});
it('never reads while signed out and rejects malformed filter cursors before querying', async () => {
  mockSession.user = null; await expect(listOpenIntakes()).rejects.toThrow(); expect(mockFrom).not.toHaveBeenCalled();
  mockSession.user = { id: A };
  for (const cursor of [{ id: A, createdAt: '2026-10-09T18:00:00Z),id.neq.x' }, { id: 'x),id.neq.y', createdAt: row().created_at }])
    await expect(listOpenIntakes(cursor)).rejects.toThrow();
  expect(mockFrom).not.toHaveBeenCalled();
});
it('rejects an A → B → A response after the session revision changes', async () => {
  let finish!: (value: unknown) => void;
  mockResult.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const read = listOpenIntakes(); await Promise.resolve();
  mockSession = { user: { id: B }, accountRevision: 2 }; mockSession = { user: { id: A }, accountRevision: 3 };
  finish({ data: [row()], error: null }); await expect(read).rejects.toThrow('Nalog je promenjen');
});
