import { candidateClientService } from '../candidateClientService';
import { CANDIDATES_PAGE_LIMIT, decodeCandidatesPage, type CandidatesPageRequest } from '../candidatesPage';

/**
 * EX-04 S4 (A11): the client end of `rpc_list_need_candidates_page`. A page is the candidate documents of the whole-list read plus the keyset value, in the whole-list order; the first page carries
 * the total; and anything that does not add up is an invalid read, never a short one.
 */
const mockRpc = jest.fn();
let mockAccount: { user: { id: string } | null; accountRevision: number };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));
const ACCOUNT = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', NEED = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AS_OF = '2026-10-01T08:00:00.123456+00:00';
const hash = (n: number) => String(n % 10).repeat(64);
const document = (n: number, over: Record<string, unknown> = {}) => ({
  responseId: uuid(n), workerProfileId: uuid(500 + n), needRevision: 2, responseNeedRevision: 2, version: 1, contentHash: hash(n), state: 'SELECTABLE', canSelect: true,
  priceRsd: 4000 + n, coveredSlots: 2, remainingSlots: 3, proposedStartAt: null, proposedEndAt: null, scopeNote: `Napomena ${n}`,
  publicProfile: { displayName: `Osoba ${n}`, trust: { ratingAverage: 4.5, reviewCount: 3, completedCount: 2 } },
  applicationEvidence: { schema: 'APPLICATION_V1_SELF_DECLARED', teamCapacity: 3, skills: ['ciscenje'], tools: [], licenses: [], vehicles: [] },
  sortAt: `2026-09-2${n}T10:00:00.000${n}00+00:00`, ...over });
const payload = (docs: any[], over: Record<string, unknown> = {}) => ({ items: docs, hasMore: false, counts: { total: docs.length }, asOf: AS_OF, ...over });
const first: CandidatesPageRequest = { limit: CANDIDATES_PAGE_LIMIT, cursor: null };
it('preserves the server calendar reason and refuses selection even for a contradictory selectable flag', async () => {
  mockRpc.mockResolvedValue({ data: payload([document(1, { calendarConflict: true })]), error: null });
  const page = await candidateClientService.prijaveZaPotrebuStrana(NEED, first);
  expect(page.items[0]).toMatchObject({ terminZauzet: true, mozeIzabrati: false });
  mockRpc.mockResolvedValue({ data: payload([document(1, { calendarConflict: 'false' })]), error: null });
  await expect(candidateClientService.prijaveZaPotrebuStrana(NEED, first)).rejects.toThrow();
});
beforeEach(() => { mockRpc.mockReset(); mockAccount = { user: { id: ACCOUNT }, accountRevision: 1 }; });

it('asks for the first page by task and limit, and for the next one from the last candidate of the page before', async () => {
  mockRpc.mockResolvedValue({ data: payload([document(1), document(2)]), error: null });
  await candidateClientService.prijaveZaPotrebuStrana(` ${NEED} `, first);
  expect(mockRpc).toHaveBeenLastCalledWith('rpc_list_need_candidates_page', { p_need_id: NEED, p_limit: 50 });
  mockRpc.mockResolvedValue({ data: payload([document(3)], { counts: null }), error: null });
  await candidateClientService.prijaveZaPotrebuStrana(NEED, { limit: 2, cursor: { at: document(2).sortAt, id: uuid(2) } });
  expect(mockRpc).toHaveBeenLastCalledWith('rpc_list_need_candidates_page', { p_need_id: NEED, p_limit: 2, p_after_at: document(2).sortAt, p_after_id: uuid(2) });
});

it('maps every document through the same mapCandidate as the whole list: the same card, state and exact selection binding', async () => {
  const docs = [document(1), document(2, { state: 'STALE', canSelect: false }), document(3, { applicationEvidence: { schema: 'LEGACY_UNPROVEN' } })];
  mockRpc.mockResolvedValue({ data: payload(docs), error: null });
  const paged = await candidateClientService.prijaveZaPotrebuStrana(NEED, first);
  mockRpc.mockResolvedValue({ data: docs.map(({ sortAt, ...rest }) => rest), error: null });
  const whole = await candidateClientService.prijaveZaPotrebu(NEED);
  expect(JSON.parse(JSON.stringify(paged.items))).toEqual(JSON.parse(JSON.stringify(whole)));
  expect(paged.items[0]).toMatchObject({ prijavaId: uuid(1), verzija: 1, hash: hash(1), potrebaRevizija: 2, stanje: 'SELECTABLE', mozeIzabrati: true, pokrivaMesta: 2, preostaloMesta: 3 });
  expect(paged).toMatchObject({ hasMore: false, counts: { total: 3 }, asOf: AS_OF, cursor: { at: docs[2].sortAt, id: uuid(3) } });
});

it('the first page answers the total, a later page answers none, and an empty page has no cursor', async () => {
  mockRpc.mockResolvedValue({ data: payload([]), error: null });
  expect(await candidateClientService.prijaveZaPotrebuStrana(NEED, first)).toMatchObject({ items: [], cursor: null, hasMore: false, counts: { total: 0 } });
  mockRpc.mockResolvedValue({ data: payload([], { counts: null }), error: null });
  expect((await candidateClientService.prijaveZaPotrebuStrana(NEED, { limit: 50, cursor: { at: document(1).sortAt, id: uuid(1) } })).counts).toBeNull();
});

it.each<[string, CandidatesPageRequest, (page: any) => void]>([
  ['the first page without a total', first, (p: any) => { p.counts = null; }],
  ['a total that is not an integer', first, (p: any) => { p.counts.total = 3.5; }],
  ['a total smaller than the page', first, (p: any) => { p.counts.total = 1; }],
  ['a complete page whose total says there are more', first, (p: any) => { p.counts.total = 9; }],
  ['a total on a later page', { limit: 50, cursor: { at: '2026-09-01T10:00:00+00:00', id: uuid(9) } }, (p: any) => {}],
  ['a missing hasMore', first, (p: any) => { delete p.hasMore; }],
  ['a string hasMore', first, (p: any) => { p.hasMore = 'false'; }],
  ['a missing instant', first, (p: any) => { delete p.asOf; }],
  ['more candidates than the limit', { limit: 2, cursor: null }, (p: any) => {}],
  ['hasMore with fewer candidates than the limit', first, (p: any) => { p.hasMore = true; }],
  ['hasMore with no candidate', first, (p: any) => { p.items = []; p.hasMore = true; p.counts.total = 5; }],
  ['a duplicate candidate', first, (p: any) => { p.items.splice(2, 0, { ...p.items[1] }); }],
  ['a candidate without a keyset value', first, (p: any) => { delete p.items[1].sortAt; }],
  ['a candidate with a malformed identity', first, (p: any) => { p.items[1].responseId = '../bad'; }],
  ['a candidate the whole list would refuse (state)', first, (p: any) => { p.items[1].state = 'WEIRD'; }],
  ['a reserved conflict state without an active server contract', first, (p: any) => { p.items[1].state = 'TIME_CONFLICT_FROZEN'; p.items[1].canSelect = false; }],
  ['a candidate the whole list would refuse (price)', first, (p: any) => { p.items[1].priceRsd = 0; }],
  ['a candidate the whole list would refuse (hash)', first, (p: any) => { p.items[1].contentHash = 'abc'; }],
  ['a candidate out of the server\'s order (time)', first, (p: any) => { p.items.reverse(); }],
  ['a first candidate that is not after the cursor', { limit: 50, cursor: { at: document(3).sortAt, id: uuid(3) } }, (p: any) => { p.counts = null; }],
  ['a non-object page', first, (p: any) => { p.items = 'nothing'; }],
])('refuses %s as an invalid read, never a short one', async (_name, request, mutate) => {
  const body: any = payload([document(1), document(2), document(3)]);
  mutate(body);
  mockRpc.mockResolvedValue({ data: body, error: null });
  await expect(candidateClientService.prijaveZaPotrebuStrana(NEED, request)).rejects.toThrow('CANDIDATE_PAGE_INVALID');
});

it('a page that is not an object at all is invalid', async () => {
  for (const data of [null, [], 'x', 3]) { mockRpc.mockResolvedValue({ data, error: null }); await expect(candidateClientService.prijaveZaPotrebuStrana(NEED, first)).rejects.toThrow('CANDIDATE_PAGE_INVALID'); }
});

it('accepts the server\'s order across a tie: the same submission instant is parted by the id, ascending', async () => {
  const tie = '2026-09-24T10:00:00.5+00:00';
  const docs = [document(2, { sortAt: tie }), document(3, { sortAt: tie })];
  mockRpc.mockResolvedValue({ data: payload(docs), error: null });
  expect((await candidateClientService.prijaveZaPotrebuStrana(NEED, first)).items.map(item => item.prijavaId)).toEqual([uuid(2), uuid(3)]);
  mockRpc.mockResolvedValue({ data: payload([docs[1], docs[0]]), error: null });
  await expect(candidateClientService.prijaveZaPotrebuStrana(NEED, first)).rejects.toThrow('CANDIDATE_PAGE_INVALID');
});

it('the same instant written two ways is one instant (the order is read by instant, never by text)', async () => {
  const docs = [document(2, { sortAt: '2026-09-24T10:00:00+00:00' }), document(3, { sortAt: '2026-09-24T12:00:00.000000+02:00' })];
  mockRpc.mockResolvedValue({ data: payload(docs), error: null });
  expect((await candidateClientService.prijaveZaPotrebuStrana(NEED, first)).items).toHaveLength(2);
});

it('a task named by nothing is refused before any request, a refused or failed request is unavailable, a missing session is auth, and an account that changed mid-read is refused', async () => {
  await expect(candidateClientService.prijaveZaPotrebuStrana('  ', first)).rejects.toThrow('CANDIDATE_PAGE_NEED_REQUIRED'); expect(mockRpc).not.toHaveBeenCalled();
  mockRpc.mockResolvedValue({ data: null, error: { message: 'NOT_REQUESTER' } });
  await expect(candidateClientService.prijaveZaPotrebuStrana(NEED, first)).rejects.toThrow('CANDIDATE_PAGE_UNAVAILABLE');
  mockRpc.mockRejectedValue(new Error('network')); await expect(candidateClientService.prijaveZaPotrebuStrana(NEED, first)).rejects.toThrow('CANDIDATE_PAGE_UNAVAILABLE');
  mockAccount = { user: null, accountRevision: 1 }; await expect(candidateClientService.prijaveZaPotrebuStrana(NEED, first)).rejects.toThrow('AUTH_REQUIRED');
  mockAccount = { user: { id: ACCOUNT }, accountRevision: 1 };
  mockRpc.mockImplementation(async () => { mockAccount = { user: { id: ACCOUNT }, accountRevision: 2 }; return { data: payload([document(1)]), error: null }; });
  await expect(candidateClientService.prijaveZaPotrebuStrana(NEED, first)).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
});

it('decodes with an injected mapper, so a candidate the mapper refuses refuses the page', () => {
  const body = payload([document(1), document(2)]);
  const seen: string[] = [];
  const page = decodeCandidatesPage(body, first, (doc: any) => { seen.push(doc.responseId); return { prijavaId: doc.responseId } as any; });
  expect(seen).toEqual([uuid(1), uuid(2)]); expect(page?.items).toHaveLength(2);
  expect(decodeCandidatesPage(body, first, () => { throw new Error('no'); })).toBeNull();
});
