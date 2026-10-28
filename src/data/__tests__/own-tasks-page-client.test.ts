import { needClientService } from '../needClientService';
import { decodeOwnTasksPage, ownTasksRefined, ownTasksScope } from '../ownTasksPage';
import { initialMarketplaceView } from '../marketplaceView';

/**
 * EX-04 S1 (A09): the client end of `rpc_list_my_needs_page`. A page is the `rpc_read_task` documents of the whole-list read plus the keyset value,
 * so a card cannot differ from the one the whole list draws; anything that does not add up is an invalid read, never a short one.
 */
const mockRpc = jest.fn(), mockUrgency = jest.fn();
let mockAccount: { user: { id: string } | null; accountRevision: number };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc, auth: { getUser: async () => ({ data: { user: { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' } }, error: null }) } }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));
jest.mock('../needUrgencyClientService', () => ({ readNeedUrgencies: (...args: unknown[]) => mockUrgency(...args) }));
const ACCOUNT = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AS_OF = '2026-10-01T08:00:00.123456+00:00';
const COUNTS = { total: 5, active: 3, drafts: 1, history: 1, waiting: 1 };
const document = (n: number, over: Record<string, unknown> = {}) => ({
  id: uuid(n), requester_profile_id: uuid(900), status: 'PUBLISHED', title: `Zadatak ${n}`, description: 'Opis', category: 'PROOF', approximate_city: 'Novi Sad',
  approximate_area: 'Liman', approximate_lat: null, approximate_lng: null, schedule_kind: 'FLEXIBLE', starts_at: null, ends_at: null, required_slots: 3, mode: 'MY_PRICE',
  requester_price_rsd: 5000, required_skills: [], required_tools: [], required_vehicles: [], verified_identity_required: false, urgent: false, public_photo_paths: [],
  revision: 2, published_at: null, created_at: '2026-03-01T10:00:00+00:00', updated_at: '2026-03-01T10:00:00+00:00', response_deadline: null,
  minimum_experience_years: null, execution_location_mode: null, required_licenses: [], task_country_code: null, task_timezone: 'Europe/Belgrade',
  price_basis: 'PER_PERSON', covered_slots: 1, selectable_application_count: 2, marketplace_responses: [{ id: uuid(800 + n) }], need_geography: null,
  need_requirement_details: null, sortAt: `2026-03-01T10:${String(59 - n).padStart(2, '0')}:00+00:00`, ...over });
const payload = (docs: any[], over: Record<string, unknown> = {}) => ({ items: docs, hasMore: false, counts: { ...COUNTS }, asOf: AS_OF, ...over });
const first = { scope: 'ACTIVE' as const, limit: 30, cursor: null };
beforeEach(() => { mockRpc.mockReset(); mockUrgency.mockReset(); mockUrgency.mockResolvedValue(new Map()); mockAccount = { user: { id: ACCOUNT }, accountRevision: 1 }; });

it('asks for the first page by scope and limit, and for the next one from the last task of the page before', async () => {
  mockRpc.mockResolvedValue({ data: payload([document(1)]), error: null });
  await needClientService.mojePotrebeStrana(first);
  expect(mockRpc).toHaveBeenLastCalledWith('rpc_list_my_needs_page', { p_scope: 'ACTIVE', p_limit: 30 });
  mockRpc.mockResolvedValue({ data: payload([document(2)], { counts: null }), error: null });
  await needClientService.mojePotrebeStrana({ scope: 'HISTORY', limit: 7, cursor: { at: '2026-03-01T10:58:00+00:00', id: uuid(1) } });
  expect(mockRpc).toHaveBeenLastCalledWith('rpc_list_my_needs_page', { p_scope: 'HISTORY', p_limit: 7, p_before_at: '2026-03-01T10:58:00+00:00', p_before_id: uuid(1) });
});

it('maps every task through the same mapNeed as the whole list: the same card, price basis and selectable count', async () => {
  const docs = [document(1), document(2, { status: 'DRAFT', selectable_application_count: 0 }), document(3, { mode: 'OFFERS', price_basis: null, requester_price_rsd: null })];
  mockRpc.mockResolvedValue({ data: payload(docs, { counts: { ...COUNTS } }), error: null });
  const paged = await needClientService.mojePotrebeStrana(first, { includeUrgency: false });
  mockRpc.mockResolvedValue({ data: docs.map(({ sortAt, ...rest }) => rest), error: null });
  const whole = await needClientService.mojePotrebe({ includeUrgency: false });
  expect(JSON.parse(JSON.stringify(paged.items))).toEqual(JSON.parse(JSON.stringify(whole)));
  expect(paged.items[0]).toMatchObject({ osnovaCene: 'PER_PERSON', brojPrijavaZaIzbor: 2, stanje: 'CEKA_PRIJAVE' });
  expect(paged).toMatchObject({ hasMore: false, counts: { total: 5, active: 3, waiting: 1, drafts: 1, history: 1 }, asOf: AS_OF,
    cursor: { at: docs[2].sortAt, id: docs[2].id } });
});

it('the first page answers the five counts, a later page answers none, and an empty page has no cursor', async () => {
  mockRpc.mockResolvedValue({ data: payload([]), error: null });
  expect(await needClientService.mojePotrebeStrana(first)).toMatchObject({ items: [], cursor: null, hasMore: false, counts: { total: 5 } });
  mockRpc.mockResolvedValue({ data: payload([], { counts: null }), error: null });
  expect((await needClientService.mojePotrebeStrana({ ...first, cursor: { at: AS_OF, id: uuid(1) } })).counts).toBeNull();
});

it.each([
  ['the first page without counts', first, (p: any) => { p.counts = null; }],
  ['a missing count', first, (p: any) => { delete p.counts.waiting; }],
  ['a negative count', first, (p: any) => { p.counts.drafts = -1; }],
  ['a fractional count', first, (p: any) => { p.counts.total = 5.5; }],
  ['sets that do not add up to the total', first, (p: any) => { p.counts.total = 6; }],
  ['more waiting than active', first, (p: any) => { p.counts.waiting = 4; }],
  ['counts on a later page', { ...first, cursor: { at: AS_OF, id: uuid(1) } }, (p: any) => {}],
  ['a missing hasMore', first, (p: any) => { delete p.hasMore; }],
  ['a string hasMore', first, (p: any) => { p.hasMore = 'false'; }],
  ['a missing instant', first, (p: any) => { delete p.asOf; }],
  ['more items than the limit', { ...first, limit: 1 }, (p: any) => { p.items.push(document(2)); }],
  ['hasMore with fewer items than the limit', first, (p: any) => { p.hasMore = true; }],
  ['hasMore with no item', first, (p: any) => { p.items = []; p.hasMore = true; }],
  ['a duplicate task', first, (p: any) => { p.items.push({ ...p.items[0] }); }],
  ['a task without a keyset value', first, (p: any) => { delete p.items[0].sortAt; }],
  ['a task with a malformed identity', first, (p: any) => { p.items[0].id = '../bad'; }],
  ['a task document the whole list would refuse', first, (p: any) => { p.items[0].status = 'WEIRD'; }],
  ['a task document with an invalid selectable count', first, (p: any) => { p.items[0].selectable_application_count = -1; }],
  ['a non-object page', first, (p: any) => { p.items = 'nothing'; }],
])('refuses %s as an invalid read, never a short one', async (_name, request, mutate) => {
  const body = payload([document(1)]); mutate(body);
  mockRpc.mockResolvedValue({ data: body, error: null });
  await expect(needClientService.mojePotrebeStrana(request)).rejects.toThrow('OWN_TASKS_PAGE_INVALID');
});

it('a page that is not an object at all is invalid', async () => {
  for (const data of [null, [], 'x', 3]) { mockRpc.mockResolvedValue({ data, error: null }); await expect(needClientService.mojePotrebeStrana(first)).rejects.toThrow('OWN_TASKS_PAGE_INVALID'); }
});

it('a refused or failed request is unavailable, a missing session is auth, and an account that changed mid-read is refused', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'INVALID_SCOPE' } });
  await expect(needClientService.mojePotrebeStrana(first)).rejects.toThrow('OWN_TASKS_PAGE_UNAVAILABLE');
  mockRpc.mockRejectedValue(new Error('network')); await expect(needClientService.mojePotrebeStrana(first)).rejects.toThrow('OWN_TASKS_PAGE_UNAVAILABLE');
  mockAccount = { user: null, accountRevision: 1 }; await expect(needClientService.mojePotrebeStrana(first)).rejects.toThrow('AUTH_REQUIRED');
  mockAccount = { user: { id: ACCOUNT }, accountRevision: 1 };
  mockRpc.mockImplementation(async () => { mockAccount = { user: { id: ACCOUNT }, accountRevision: 2 }; return { data: payload([document(1)]), error: null }; });
  await expect(needClientService.mojePotrebeStrana(first)).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
});

it('reads the optional urgency badges of the page only, and only when asked', async () => {
  const docs = [document(1, { urgent: true, urgent_activated_at: '2026-10-01T07:00:00+00:00', urgent_expires_at: '2026-10-02T07:00:00+00:00' }), document(2)];
  mockRpc.mockResolvedValue({ data: payload(docs), error: null });
  mockUrgency.mockResolvedValue(new Map([[docs[0].id, { level: 'HITNO', expiresAt: '2026-10-02T07:00:00+00:00' }]]));
  const page = await needClientService.mojePotrebeStrana(first);
  expect(mockUrgency).toHaveBeenCalledTimes(1); expect(mockUrgency.mock.calls[0][0].map((row: any) => row.id)).toEqual([docs[0].id, docs[1].id]);
  expect(page.items[0].urgency).toEqual({ level: 'HITNO', expiresAt: '2026-10-02T07:00:00+00:00' }); expect(page.items[1].urgency).toBeUndefined();
  mockUrgency.mockClear(); await needClientService.mojePotrebeStrana(first, { includeUrgency: false }); expect(mockUrgency).not.toHaveBeenCalled();
});

describe('the set the person is looking at, in the server\'s words', () => {
  const view = (patch: Record<string, unknown>) => ({ ...initialMarketplaceView(), ...patch });
  it.each([
    [{ section: 'active' }, 'ACTIVE'], [{ section: 'drafts' }, 'DRAFTS'], [{ section: 'history' }, 'HISTORY'], [{ section: 'all' }, 'ALL'],
    [{ section: 'active', attention: true }, 'WAITING'], [{ section: 'all', attention: true }, 'WAITING'],
    [{ section: 'drafts', attention: true }, null], [{ section: 'history', attention: true }, null],
  ])('%j reads %s', (patch, scope) => { expect(ownTasksScope(view(patch) as any)).toBe(scope); });
  it('a search or a price filter refines the loaded set; nothing else does', () => {
    expect(ownTasksRefined(view({}) as any)).toBe(false); expect(ownTasksRefined(view({ query: '   ' }) as any)).toBe(false);
    expect(ownTasksRefined(view({ query: 'ormar' }) as any)).toBe(true); expect(ownTasksRefined(view({ price: 'OFFERS' }) as any)).toBe(true);
    expect(ownTasksRefined(view({ section: 'history', attention: true }) as any)).toBe(false);
  });
});

it('rejects a repeated or forward-moving keyset page instead of treating it as more tasks', () => {
  const cursor = { at: '2026-03-01T10:58:00+00:00', id: uuid(1) };
  const request = { ...first, cursor };
  const map = (row: any) => ({ id: row.id }) as any;
  const later = (documents: any[]) => ({ items: documents, counts: null, hasMore: false, asOf: AS_OF });

  expect(decodeOwnTasksPage(later([document(2)]), request, map)?.items).toHaveLength(1);
  expect(decodeOwnTasksPage(later([document(1)]), request, map)).toBeNull();
  expect(decodeOwnTasksPage(later([document(2, { sortAt: '2026-03-01T10:59:00+00:00' })]), request, map)).toBeNull();
  expect(decodeOwnTasksPage(later([document(2), document(1)]), request, map)).toBeNull();
});

it('compares exact PostgreSQL microseconds, UTC offsets and UUID ties in descending order', () => {
  const map = (row: any) => ({ id: row.id }) as any;
  const at = '2026-03-01T10:00:00.123456+00:00';
  const earlier = '2026-03-01T11:00:00.123455+01:00';
  const sameInstant = '2026-03-01T11:00:00.123456+01:00';
  const documentAt = (n: number, time: string) => document(n, { sortAt: time });
  const firstPage = (documents: any[]) => payload(documents, { hasMore: false });
  expect(decodeOwnTasksPage(firstPage([documentAt(3, at), documentAt(2, earlier)]), first, map)?.items).toHaveLength(2);
  expect(decodeOwnTasksPage(firstPage([documentAt(2, earlier), documentAt(3, at)]), first, map)).toBeNull();
  expect(decodeOwnTasksPage(firstPage([documentAt(3, at), documentAt(2, sameInstant)]), first, map)?.items).toHaveLength(2);
  expect(decodeOwnTasksPage(firstPage([documentAt(2, at), documentAt(3, sameInstant)]), first, map)).toBeNull();
  expect(decodeOwnTasksPage(firstPage([documentAt(3, at)]),
    { ...first, cursor: { at: sameInstant, id: uuid(3) } }, map)).toBeNull();
});

it('rejects malformed paging parameters at the client boundary', () => {
  const map = (row: any) => ({ id: row.id }) as any;
  const body = payload([document(1)]);
  for (const limit of [0, -1, 101, 1.5, Number.NaN]) {
    expect(decodeOwnTasksPage(body, { ...first, limit }, map)).toBeNull();
  }
  expect(decodeOwnTasksPage(body, { ...first, cursor: { at: 'bad', id: uuid(1) } }, map)).toBeNull();
  expect(decodeOwnTasksPage(body, { ...first, cursor: { at: AS_OF, id: 'bad' } }, map)).toBeNull();
});

it('decodes with an injected mapper, so a task the mapper refuses refuses the page', () => {
  const body = payload([document(1), document(2)]);
  const seen: string[] = [];
  const page = decodeOwnTasksPage(body, first, (doc: any) => { seen.push(doc.id); return { id: doc.id } as any; });
  expect(seen).toEqual([uuid(1), uuid(2)]); expect(page?.items).toHaveLength(2);
  expect(decodeOwnTasksPage(body, first, () => { throw new Error('no'); })).toBeNull();
});
