import { agreementClientService } from '../agreementClientService';
import { REVIEW_TAGS } from '../reviewsClientService';

/**
 * EX-04 S3 (RC-03, D01): the Dogovori page says, for each finished Dogovor, whether MY rating is still due (`ratingDue`, the same answer as the review read's `eligible`).
 * With the fact the list makes no request per finished Dogovor: the number of requests is the number of pages, whatever the history, and a stalled review read has nothing to
 * withhold. Without it (an older server) every row is asked the old way: all or none, never a mixture.
 */
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const id = (n: number) => `dddddddd-dddd-4ddd-8ddd-${String(n).padStart(12, '0')}`;
let mockSession = { user: { id: A } as { id: string } | null, accountRevision: 1 };
const mockRpc = jest.fn(), mockGetUser = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc, auth: { getUser: mockGetUser } }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
const item = (n: number, patch: Record<string, unknown> = {}) => ({
  id: id(n), sortAt: `2026-09-20T08:00:00.${String(999999 - n).padStart(6, '0')}+00:00`,
  requesterAccountId: A, workerAccountId: B, requesterName: 'Miloš', workerName: 'Ana', title: `Posao ${n}`, status: 'COMPLETED', agreementStatus: 'COMPLETED',
  currentVersion: 2, requiredSlots: 1, executionMode: 'PHYSICAL', approximateArea: 'Liman', approximateCity: 'Novi Sad', createdAt: '2026-09-20T08:00:00Z',
  terms: { price_rsd: 4000, currency: 'RSD' }, ...patch });
const context = (agreementId: string, eligible: boolean) => ({ accountId: A, agreementId, targetAccountId: B, eligible, review: null,
  tagCatalog: { version: 'PRE_V3_REVIEW_TAGS_V1', maxTags: 3, tags: [...REVIEW_TAGS] }, authoritative: true });
const calls = (name: string) => mockRpc.mock.calls.filter(call => call[0] === name);
/** The page reads of a history: the server answers `size` Dogovori per page, newest first. */
function history(all: Record<string, unknown>[], size = 100) {
  mockRpc.mockImplementation((name: string, args: any) => {
    if (name === 'rpc_get_my_agreement_review') return Promise.resolve({ data: context(args.p_agreement_id, true), error: null });
    const start = args.p_before_id ? all.findIndex(entry => entry.id === args.p_before_id) + 1 : 0;
    const slice = all.slice(start, start + size);
    return Promise.resolve({ data: { items: slice, hasMore: start + size < all.length, asOf: '2026-10-01T08:00:00+00:00' }, error: null });
  });
}
beforeEach(() => { mockSession = { user: { id: A }, accountRevision: 1 }; mockRpc.mockReset(); mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: A } }, error: null }); });

it('takes the rating state from the page: DUE and NOT_DUE for finished Dogovori, nothing asked per row, active work untouched', async () => {
  history([item(1, { ratingDue: true }), item(2, { ratingDue: false }), item(3, { status: 'CONFIRMED', agreementStatus: 'CONFIRMED' })]);
  const result = await agreementClientService.mojiDogovori();
  expect(result.map(row => [row.id, row.stanje, row.ocenaMoguca, row.stanjeProvereOcene])).toEqual([
    [id(1), 'COMPLETED', true, 'DUE'], [id(2), 'COMPLETED', false, 'NOT_DUE'], [id(3), 'CONFIRMED', false, undefined]]);
  expect(calls('rpc_get_my_agreement_review')).toHaveLength(0); expect(calls('rpc_list_my_agreements_page')).toHaveLength(1);
});

it.each([
  ['no Dogovor at all', () => [] as Record<string, unknown>[], 1, 0],
  ['one finished Dogovor', () => [item(1, { ratingDue: true })], 1, 1],
  ['a long history of 230 Dogovori, 150 finished', () => Array.from({ length: 230 }, (_, n) => n < 150
    ? item(n + 1, { ratingDue: n % 3 === 0 }) : item(n + 1, { status: 'CONFIRMED', agreementStatus: 'CONFIRMED' })), 3, 50],
])('%s: the requests are the pages and nothing more', async (_name, make, pages, due) => {
  const all = make(); history(all);
  const result = await agreementClientService.mojiDogovori();
  expect(result).toHaveLength(all.length);
  expect(calls('rpc_list_my_agreements_page')).toHaveLength(pages); expect(calls('rpc_get_my_agreement_review')).toHaveLength(0);
  expect(result.filter(row => row.stanjeProvereOcene === 'DUE')).toHaveLength(due);
  expect(result.filter(row => row.stanje === 'COMPLETED' && row.stanjeProvereOcene === 'UNAVAILABLE')).toHaveLength(0);
});

it('a review read that would stall is never started, so there is nothing for it to withhold', async () => {
  history([item(1, { ratingDue: true }), item(2, { ratingDue: false })]);
  const base = mockRpc.getMockImplementation()!;
  mockRpc.mockImplementation((name: string, args: any) => name === 'rpc_get_my_agreement_review' ? new Promise(() => {}) : base(name, args));
  const result = await agreementClientService.mojiDogovori();
  expect(result.map(row => row.stanjeProvereOcene)).toEqual(['DUE', 'NOT_DUE']); expect(calls('rpc_get_my_agreement_review')).toHaveLength(0);
});

it('a server that does not say (an older one) is asked the old way for EVERY finished Dogovor, never a mixture of the two ways', async () => {
  history([item(1), item(2), item(3, { status: 'CONFIRMED', agreementStatus: 'CONFIRMED' })]);
  mockRpc.mockImplementation((name: string, args: any) => name === 'rpc_get_my_agreement_review'
    ? Promise.resolve({ data: context(args.p_agreement_id, args.p_agreement_id === id(1)), error: null })
    : Promise.resolve({ data: { items: [item(1), item(2), item(3, { status: 'CONFIRMED', agreementStatus: 'CONFIRMED' })], hasMore: false }, error: null }));
  const result = await agreementClientService.mojiDogovori();
  expect(calls('rpc_get_my_agreement_review')).toHaveLength(2); expect(result.map(row => row.stanjeProvereOcene)).toEqual(['DUE', 'NOT_DUE', undefined]);
});

it.each([
  ['one finished Dogovor without the fact', [item(1, { ratingDue: true }), item(2)]],
  ['a fact that is not a boolean', [item(1, { ratingDue: true }), item(2, { ratingDue: 'yes' })]],
  ['a null fact', [item(1, { ratingDue: null }), item(2, { ratingDue: false })]],
])('%s: the old way for every row, so what the server did say is not trusted alone', async (_name, items) => {
  mockRpc.mockImplementation((name: string, args: any) => name === 'rpc_get_my_agreement_review'
    ? Promise.resolve({ data: context(args.p_agreement_id, false), error: null }) : Promise.resolve({ data: { items, hasMore: false }, error: null }));
  const result = await agreementClientService.mojiDogovori();
  expect(calls('rpc_get_my_agreement_review')).toHaveLength(2); expect(result.every(row => row.stanjeProvereOcene === 'NOT_DUE')).toBe(true);
});

it('a finished Dogovor that is not due stays out of "Čeka tvoju ocenu", and an active one never gets a rating state', async () => {
  history([item(1, { ratingDue: false }), item(2, { status: 'AWAITING_REQUESTER', agreementStatus: 'CONFIRMED', ratingDue: true })]);
  const [finished, active] = await agreementClientService.mojiDogovori();
  expect(finished).toMatchObject({ ocenaMoguca: false, stanjeProvereOcene: 'NOT_DUE' }); expect(active.stanjeProvereOcene).toBeUndefined(); expect(active.ocenaMoguca).toBe(false);
});

it('the explicit opt-out is unchanged: a read that omitted the ratings says unknown, never "not due"', async () => {
  history([item(1, { ratingDue: true })]);
  const [row] = await agreementClientService.mojiDogovori({ includeRatings: false });
  expect(row).toMatchObject({ ocenaMoguca: false, stanjeProvereOcene: 'UNAVAILABLE' });
});

it('an account that changed while the page was read is refused', async () => {
  mockRpc.mockImplementation(async () => { mockSession = { user: { id: A }, accountRevision: 2 }; return { data: { items: [item(1, { ratingDue: true })], hasMore: false }, error: null }; });
  await expect(agreementClientService.mojiDogovori()).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
});
