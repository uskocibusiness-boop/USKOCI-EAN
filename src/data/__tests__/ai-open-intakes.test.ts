import { listOpenIntakes, OPEN_INTAKE_PAGE_SIZE, readIntakeLifecycle } from '../aiOpenIntakes';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let mockSession: { user: { id: string } | null; accountRevision: number };
const mockResult = jest.fn();
const mockTitles = jest.fn(); let mockTable = '';
const mockQuery: Record<string, jest.Mock> = {};
for (const name of ['select', 'eq', 'is', 'in', 'order', 'limit', 'or', 'maybeSingle']) mockQuery[name] = jest.fn(() => mockQuery);
mockQuery.then = jest.fn((resolve, reject) => Promise.resolve(mockTable === 'ai_structured_facts' ? mockTitles() : mockResult()).then(resolve, reject));
const mockFrom = jest.fn((table: string) => { mockTable = table; return mockQuery; });
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ from: mockFrom }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
const row = (n = 1, patch = {}) => ({ id: `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`, account_id: A,
  purpose: 'NEED_INTAKE', status: 'OPEN', fact_schema_version: 'NEED_FACT_V2', bound_need_id: null,
  created_at: '2026-10-09T18:00:00.123456+00:00', ...patch });
beforeEach(() => { jest.clearAllMocks(); mockSession = { user: { id: A }, accountRevision: 1 }; mockResult.mockReturnValue({ data: [], error: null }); mockTitles.mockReturnValue({ data: [], error: null }); });

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

const titleFact = (n = 1, patch = {}) => ({ account_id: A, conversation_id: row(n).id, fact_key: 'need.title',
  fact_schema_version: 'NEED_FACT_V2', value_type: 'TEXT', scope: 'NEED_DRAFT', status: 'CONFIRMED',
  fact_value: 'Izrada 3D figurica', superseded_at: null, ...patch });
it('loads only current public title facts for the at most twenty displayed conversations', async () => {
  mockResult.mockReturnValue({ data: Array.from({ length: 21 }, (_, i) => row(i + 1)), error: null });
  mockTitles.mockReturnValue({ data: [titleFact()], error: null });
  const result = await listOpenIntakes();
  expect(result.rows[0].title).toBe('Izrada 3D figurica'); expect(result.rows[1].title).toBeUndefined();
  expect(mockQuery.in).toHaveBeenCalledWith('conversation_id', result.rows.map(value => value.id));
  expect(mockQuery.in.mock.calls[0][1]).toHaveLength(20);
  expect(mockQuery.eq).toHaveBeenCalledWith('fact_key', 'need.title');
  expect(mockQuery.eq).toHaveBeenCalledWith('status', 'CONFIRMED');
  expect(mockQuery.is).toHaveBeenCalledWith('superseded_at', null);
  const selected = mockQuery.select.mock.calls[1][0].split(',');
  for (const privateField of ['evidence_excerpt', 'display_value', 'body']) expect(selected).not.toContain(privateField);
  expect(selected).toEqual(expect.arrayContaining(['account_id', 'conversation_id', 'fact_key', 'fact_value']));
});
it.each([
  [titleFact(1, { account_id: B })], [titleFact(2)], [titleFact(), titleFact()],
  [titleFact(1, { fact_key: 'need.exact_address' })], [titleFact(1, { superseded_at: row().created_at })],
  [titleFact(1, { value_type: 'OBJECT' })], [titleFact(1, { scope: 'STABLE_PROFILE' })],
  [titleFact(1, { fact_schema_version: 'LEGACY_TEXT_V1' })], [titleFact(1, { evidence_excerpt: 'private' })],
  [titleFact(1, { fact_value: 'x'.repeat(141) })], [titleFact(1, { status: 'UNKNOWN', fact_value: 'Invented' })],
  [titleFact(1, { status: 'INFERRED' })], [titleFact(1, { status: 'NEEDS_CONFIRMATION' })],
].map(data => [data]))('falls back to metadata without exposing invalid title data (%#)', async data => {
  mockResult.mockReturnValue({ data: [row()], error: null }); mockTitles.mockReturnValue({ data, error: null });
  expect((await listOpenIntakes()).rows).toEqual([{ id: row().id, createdAt: row().created_at }]);
});
it('retains a valid metadata page when optional titles are offline or unknown', async () => {
  mockResult.mockReturnValue({ data: [row()], error: null }); mockTitles.mockReturnValue({ data: null, error: { message: 'offline' } });
  expect((await listOpenIntakes()).rows[0].title).toBeUndefined();
  mockTitles.mockReturnValue({ data: [titleFact(1, { status: 'UNKNOWN', fact_value: null })], error: null });
  expect((await listOpenIntakes()).rows[0].title).toBeUndefined();
});
it('rejects a title response from an older account revision, rather than returning the old metadata', async () => {
  mockResult.mockReturnValue({ data: [row()], error: null });
  mockTitles.mockImplementation(() => { mockSession = { user: { id: A }, accountRevision: 3 }; return { data: [titleFact()], error: null }; });
  await expect(listOpenIntakes()).rejects.toThrow('Nalog je promenjen');
});
it('reads an owned lifecycle without messages and never equates missing/foreign rows with abandonment', async () => {
  mockResult.mockReturnValue({ data: row(1, { status: 'ABANDONED' }), error: null });
  expect(await readIntakeLifecycle(row().id)).toEqual({ id: row().id, status: 'ABANDONED', boundNeedId: null });
  expect(mockQuery.eq).toHaveBeenCalledWith('id', row().id);
  expect(mockFrom).toHaveBeenCalledTimes(1); expect(mockFrom).toHaveBeenCalledWith('ai_conversations');
  for (const data of [null, row(1, { account_id: B }), row(2), row(1, { status: 'DELETED' })]) {
    mockResult.mockReturnValue({ data, error: null }); await expect(readIntakeLifecycle(row().id)).rejects.toThrow();
  }
});
