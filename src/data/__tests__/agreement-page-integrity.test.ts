import { agreementClientService } from '../agreementClientService';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const id = (n: number) => `dddddddd-dddd-4ddd-8ddd-${String(n).padStart(12, '0')}`;
let mockSession = { user: { id: A }, accountRevision: 1 };
const mockRpc = jest.fn(), mockGetUser = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc, auth: { getUser: mockGetUser } }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
const row = (n: number, patch: Record<string, unknown> = {}) => ({ id: id(n),
  sortAt: `2026-10-18T10:00:00.${String(999999 - n).padStart(6, '0')}Z`,
  requesterAccountId: A, workerAccountId: B, requesterName: 'Miloš', workerName: 'Ana',
  title: `Dogovor ${n}`, status: 'CONFIRMED', agreementStatus: 'CONFIRMED', currentVersion: 1,
  requiredSlots: 1, terms: {}, ...patch });
const page = (items: unknown[], hasMore: unknown) => ({ data: { items, hasMore }, error: null });
beforeEach(() => {
  mockSession = { user: { id: A }, accountRevision: 1 };
  mockRpc.mockReset(); mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: A } }, error: null });
});

it.each([undefined, null, 'false', 0, {}, []])('rejects non-boolean continuation %p instead of silently returning a partial list', async hasMore => {
  mockRpc.mockResolvedValue(page([row(1)], hasMore));
  await expect(agreementClientService.mojiDogovori()).rejects.toThrow('AGREEMENT_LIST_INVALID_PROJECTION');
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
it.each([
  ['no rows', []],
  ['missing sort instant', [row(1, { sortAt: undefined })]],
  ['invalid instant', [row(1, { sortAt: '2026-02-30T10:00:00Z' })]],
  ['missing ID', [row(1, { id: undefined })]],
  ['invalid cursor ID', [row(1, { id: 'not-a-uuid' })]],
])('refuses an unusable continuation: %s', async (_name, items) => {
  mockRpc.mockResolvedValue(page(items, true));
  await expect(agreementClientService.mojiDogovori()).rejects.toThrow('AGREEMENT_LIST_INVALID_PROJECTION');
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
it.each([
  ['duplicate in one page', [row(1), row(1)]],
  ['null document', [null]],
  ['missing identity', [{ status: 'CONFIRMED' }]],
  ['more rows than requested', Array.from({ length: 101 }, (_, n) => row(n + 1))],
])('refuses %s even on a final page', async (_name, items) => {
  mockRpc.mockResolvedValue(page(items, false));
  await expect(agreementClientService.mojiDogovori()).rejects.toThrow('AGREEMENT_LIST_INVALID_PROJECTION');
});
it('returns all pages in order and carries the server cursor without losing microseconds', async () => {
  mockRpc.mockResolvedValueOnce(page([row(1), row(2)], true)).mockResolvedValueOnce(page([row(3)], false));
  const result = await agreementClientService.mojiDogovori();
  expect(result.map(item => item.id)).toEqual([id(1), id(2), id(3)]);
  expect(mockRpc.mock.calls[1]).toEqual(['rpc_list_my_agreements_page', {
    p_scope: 'ALL', p_limit: 100, p_before_at: row(2).sortAt, p_before_id: id(2),
  }]);
});
it.each([
  ['repeated previous row', [row(2)]],
  ['new ID before cursor', [row(4, { sortAt: row(1).sortAt })]],
  ['reversed same-instant IDs', [row(3, { sortAt: row(2).sortAt })]],
  ['invalid final-page instant', [row(3, { sortAt: null })]],
])('rejects %s on the next page without publishing earlier rows', async (_name, items) => {
  mockRpc.mockResolvedValueOnce(page([row(1), row(2)], true)).mockResolvedValueOnce(page(items, false));
  await expect(agreementClientService.mojiDogovori()).rejects.toThrow('AGREEMENT_LIST_INVALID_PROJECTION');
  expect(mockRpc).toHaveBeenCalledTimes(2);
});
it('accepts equal microseconds with descending UUIDs and an empty final page after removal', async () => {
  const at = row(1).sortAt;
  mockRpc.mockResolvedValueOnce(page([row(3, { sortAt: at }), row(2, { sortAt: at })], true))
    .mockResolvedValueOnce(page([row(1, { sortAt: at })], true)).mockResolvedValueOnce(page([], false));
  expect((await agreementClientService.mojiDogovori()).map(item => item.id)).toEqual([id(3), id(2), id(1)]);
});
it('a later transport failure rejects the entire list', async () => {
  mockRpc.mockResolvedValueOnce(page([row(1)], true)).mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
  await expect(agreementClientService.mojiDogovori()).rejects.toThrow('AGREEMENT_LIST_FAILED');
});
it('an aborted read starts no authentication or page request', async () => {
  const abort = new AbortController(); abort.abort();
  await expect(agreementClientService.mojiDogovori({ signal: abort.signal })).rejects.toThrow('AGREEMENT_LIST_ABORTED');
  expect(mockGetUser).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
});
it('retires pagination after an in-flight request even if the transport ignores cancellation', async () => {
  const abort = new AbortController();
  const attach = jest.fn(() => Promise.resolve().then(() => { abort.abort(); return page([row(1)], true); }));
  mockRpc.mockReturnValue({ abortSignal: attach });
  await expect(agreementClientService.mojiDogovori({ signal: abort.signal })).rejects.toThrow('AGREEMENT_LIST_ABORTED');
  expect(attach).toHaveBeenCalledWith(abort.signal); expect(mockRpc).toHaveBeenCalledTimes(1);
});
