import { applicationClientService } from '../applicationClientService';
import { applicationRank, decodeOwnApplicationsPage, ownApplicationsScope, ownApplicationsScopeRank, type OwnApplicationsPageRequest } from '../ownApplicationsPage';

/**
 * EX-04 S2 (B10): the client end of `rpc_list_my_applications_page`. A page is the application documents of the whole-list read plus the task facts the card needs
 * and the keyset value; the order is the whole-list order (rank, newest first, id), and anything that does not add up is an invalid read, never a short one.
 */
const mockRpc = jest.fn();
let mockAccount: { user: { id: string } | null; accountRevision: number };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));
const ACCOUNT = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AS_OF = '2026-10-01T08:00:00.123456+00:00';
const COUNTS = { total: 4, attention: 1, active: 2, finished: 1 };
const document = (n: number, over: Record<string, unknown> = {}) => ({
  applicationId: uuid(n), id: uuid(n), sortAt: `2026-09-2${n}T10:00:00.000001+00:00`, needId: uuid(100 + n), needRevision: 2, submittedNeedRevision: 2, version: 1,
  state: 'SUBMITTED', title: `Zadatak ${n}`, description: 'Opis', approximateCity: 'Novi Sad', approximateArea: 'Liman', startsAt: '2026-10-05T08:00:00+00:00',
  endsAt: '2026-10-05T10:00:00+00:00', scheduleKind: 'FIXED_WINDOW', executionLocationMode: 'STATIONARY', taskTimezone: 'Europe/Belgrade',
  priceMode: 'OFFERS', priceBasis: null, requiredSlots: 2, priceRsd: 4000, coveredSlots: 2, scopeNote: '', agreementId: null, requiresStaleReview: false,
  attentionRequired: false, canWithdraw: true, submittedAt: `2026-09-2${n}T10:00:00.000001+00:00`, ...over });
// rank 0 first, then 1, each newest first: the order of the server.
const ordered = () => [document(1, { state: 'SELECTED', attentionRequired: true, canWithdraw: false, agreementId: uuid(500), sortAt: '2026-09-25T10:00:00+00:00' }),
  document(2, { sortAt: '2026-09-24T10:00:00+00:00' }), document(3, { sortAt: '2026-09-23T10:00:00+00:00' }),
  document(4, { state: 'WITHDRAWN', canWithdraw: false, sortAt: '2026-09-26T10:00:00+00:00' })];
const payload = (items: any[], over: Record<string, unknown> = {}) => ({ items, hasMore: false, counts: { ...COUNTS }, asOf: AS_OF, ...over });
const first = { scope: 'ALL' as const, limit: 30, cursor: null };
it('maps the calendar reason without archiving or withdrawing the application and rejects malformed flags', async () => {
  const items = ordered(); items[1] = document(2, { ...items[1], calendarConflict: true });
  mockRpc.mockResolvedValue({ data: payload(items), error: null });
  const page = await applicationClientService.mojePrijaveStrana(first);
  expect(page.items[1]).toMatchObject({ terminZauzet: true, stanje: 'SUBMITTED', mozePovuci: true });
  mockRpc.mockResolvedValue({ data: payload([document(1, { calendarConflict: 'true' })], { counts: { total: 1, attention: 0, active: 1, finished: 0 } }), error: null });
  await expect(applicationClientService.mojePrijaveStrana(first)).rejects.toThrow();
});
beforeEach(() => { mockRpc.mockReset(); mockAccount = { user: { id: ACCOUNT }, accountRevision: 1 }; });

it('asks for the first page by scope and limit, and for the next one from the last application of the page before, with its rank', async () => {
  mockRpc.mockResolvedValue({ data: payload(ordered()), error: null });
  await applicationClientService.mojePrijaveStrana(first);
  expect(mockRpc).toHaveBeenLastCalledWith('rpc_list_my_applications_page', { p_scope: 'ALL', p_limit: 30 });
  mockRpc.mockResolvedValue({ data: payload([document(6, { sortAt: '2026-09-01T10:00:00+00:00' })], { counts: null }), error: null });
  await applicationClientService.mojePrijaveStrana({ scope: 'ACTIVE', limit: 7, cursor: { at: '2026-09-23T10:00:00+00:00', id: uuid(3), rank: 1 } });
  expect(mockRpc).toHaveBeenLastCalledWith('rpc_list_my_applications_page',
    { p_scope: 'ACTIVE', p_limit: 7, p_before_at: '2026-09-23T10:00:00+00:00', p_before_id: uuid(3), p_before_rank: 1 });
});

it('maps every document through the card mapper: the same facts as the whole list, and the task facts of the card besides', async () => {
  const docs = ordered();
  mockRpc.mockResolvedValue({ data: payload(docs.slice(0, 3), { counts: { total: 3, attention: 1, active: 2, finished: 0 } }), error: null });
  const page = await applicationClientService.mojePrijaveStrana(first);
  expect(page.items.map(item => item.prijavaId)).toEqual([uuid(1), uuid(2), uuid(3)]);
  expect(page.items[0]).toMatchObject({ stanje: 'SELECTED', traziPaznju: true, dogovorId: uuid(500), mozePovuci: false, cena: { iznos: 4000, prikaz: '4.000 RSD' }, pokrivaMesta: 2 });
  expect(page.items[1]).toMatchObject({ stanje: 'SUBMITTED', mozePovuci: true, podrucjeTekst: 'Liman, Novi Sad',
    zadatak: { raspored: { kind: 'FIXED_WINDOW', startsAt: '2026-10-05T08:00:00+00:00', endsAt: '2026-10-05T10:00:00+00:00' }, rezimLokacije: 'STATIONARY',
      vremenskaZona: 'Europe/Belgrade', rezimCene: 'OFFERS', osnovaCene: null, potrebnoMesta: 2 } });
  expect(page).toMatchObject({ hasMore: false, counts: { total: 3, attention: 1, active: 2, finished: 0 }, asOf: AS_OF, cursor: { at: docs[2].sortAt, id: uuid(3), rank: 1 } });
  // The whole-list read of the same application is the same card except for the task facts and the wording they make truthful.
  mockRpc.mockResolvedValue({ data: docs.slice(0, 3).map(({ id, sortAt, endsAt, scheduleKind, executionLocationMode, taskTimezone, priceMode, priceBasis, requiredSlots, ...rest }) => rest), error: null });
  const whole = await applicationClientService.mojePrijave();
  for (const [i, row] of whole.entries()) {
    const { zadatak, podrucjeTekst, vremeTekst, ...paged } = page.items[i]; const { zadatak: none, podrucjeTekst: p2, vremeTekst: v2, ...old } = row;
    expect(none).toBeUndefined(); expect(paged).toEqual(old); expect(zadatak).toBeDefined();
  }
});

it('says what the task says: remote is "Na daljinu" and never a city, the end of a long term is kept, and a missing zone is said', async () => {
  const remote = document(1, { executionLocationMode: 'REMOTE', approximateCity: null, approximateArea: null, scheduleKind: 'REMOTE_ANYTIME', startsAt: null, endsAt: null, taskTimezone: null, sortAt: '2026-09-25T10:00:00+00:00' });
  const endOnly = document(2, { scheduleKind: 'FLEXIBLE', startsAt: null, endsAt: '2026-10-09T21:59:59+00:00', sortAt: '2026-09-24T10:00:00+00:00' });
  const long = document(3, { startsAt: '2026-10-05T08:00:00+00:00', endsAt: '2026-10-12T16:00:00+00:00', sortAt: '2026-09-23T10:00:00+00:00' });
  const noPlace = document(5, { executionLocationMode: 'STATIONARY', approximateCity: null, approximateArea: null, taskTimezone: null, sortAt: '2026-09-22T10:00:00+00:00' });
  mockRpc.mockResolvedValue({ data: payload([remote, endOnly, long, noPlace], { counts: { total: 4, attention: 0, active: 4, finished: 0 } }), error: null });
  const [a, b, c, d] = (await applicationClientService.mojePrijaveStrana(first)).items;
  expect(a.podrucjeTekst).toBe('Na daljinu'); expect(a.vremeTekst).toBe('Na daljinu, fleksibilno');
  expect(b.vremeTekst).toContain('Rok do'); expect(b.zadatak?.raspored.startsAt).toBeNull();
  expect(c.vremeTekst).toMatch(/okt.*–.*okt/); expect(c.zadatak?.raspored.endsAt).toBe('2026-10-12T16:00:00+00:00');
  expect(d.podrucjeTekst).toBe('Lokacija nije navedena');   // a missing point is not a place, and not "remote"
  expect(d.vremeTekst).toContain('zona nije navedena');   // a term without a zone says so
});

it('the whole-list read keeps its older wording and carries no task facts', async () => {
  const { id, sortAt, endsAt, scheduleKind, executionLocationMode, taskTimezone, priceMode, priceBasis, requiredSlots, ...old } = document(1);
  mockRpc.mockResolvedValue({ data: [old], error: null });
  const [row] = await applicationClientService.mojePrijave();
  expect(row.zadatak).toBeUndefined(); expect(row.podrucjeTekst).toBe('Liman, Novi Sad');
});

it('the first page answers the four counts, a later page answers none, and an empty page has no cursor', async () => {
  mockRpc.mockResolvedValue({ data: payload([], { counts: { total: 0, attention: 0, active: 0, finished: 0 } }), error: null });
  expect(await applicationClientService.mojePrijaveStrana(first)).toMatchObject({ items: [], cursor: null, hasMore: false, counts: { total: 0 } });
  mockRpc.mockResolvedValue({ data: payload([], { counts: null }), error: null });
  expect((await applicationClientService.mojePrijaveStrana({ ...first, cursor: { at: AS_OF, id: uuid(1), rank: 0 } })).counts).toBeNull();
});

const withFirst = (mutate: (item: any) => void) => (page: any) => mutate(page.items[1]);
it.each<[string, OwnApplicationsPageRequest, (page: any) => void]>([
  ['the first page without counts', first, (p: any) => { p.counts = null; }],
  ['a missing count', first, (p: any) => { delete p.counts.active; }],
  ['a negative count', first, (p: any) => { p.counts.finished = -1; }],
  ['a fractional count', first, (p: any) => { p.counts.total = 4.5; }],
  ['sections that do not add up to the total', first, (p: any) => { p.counts.total = 5; }],
  ['counts on a later page', { ...first, cursor: { at: '2026-09-27T10:00:00+00:00', id: uuid(9), rank: 0 } }, (p: any) => {}],
  ['a missing hasMore', first, (p: any) => { delete p.hasMore; }],
  ['a string hasMore', first, (p: any) => { p.hasMore = 'false'; }],
  ['a missing instant', first, (p: any) => { delete p.asOf; }],
  ['more items than the limit', { ...first, limit: 2 }, (p: any) => {}],
  ['hasMore with fewer items than the limit', first, (p: any) => { p.hasMore = true; }],
  ['hasMore with no item', first, (p: any) => { p.items = []; p.hasMore = true; }],
  ['a duplicate application', first, (p: any) => { p.items.splice(2, 0, { ...p.items[1] }); }],
  ['an application without a keyset value', first, withFirst(item => { delete item.sortAt; })],
  ['an application whose id differs from its applicationId', first, withFirst(item => { item.id = uuid(77); })],
  ['an application with a malformed identity', first, withFirst(item => { item.applicationId = '../bad'; item.id = '../bad'; })],
  ['an application the whole list would refuse', first, withFirst(item => { item.state = 'WEIRD'; })],
  ['an application with an invalid price', first, withFirst(item => { item.priceRsd = 0; })],
  ['an application without the task facts', first, withFirst(item => { delete item.scheduleKind; delete item.endsAt; delete item.executionLocationMode; delete item.taskTimezone; delete item.priceMode; delete item.priceBasis; delete item.requiredSlots; })],
  ['a part of the task facts', first, withFirst(item => { delete item.taskTimezone; })],
  ['an unknown schedule kind', first, withFirst(item => { item.scheduleKind = 'SOMETIME'; })],
  ['an unknown execution mode', first, withFirst(item => { item.executionLocationMode = 'REMOTEISH'; })],
  ['an unknown zone', first, withFirst(item => { item.taskTimezone = 'Mars/Olympus'; })],
  ['an end before the start', first, withFirst(item => { item.endsAt = '2026-10-05T07:00:00+00:00'; })],
  ['an end that is not an instant', first, withFirst(item => { item.endsAt = 'tomorrow'; })],
  ['an unknown price mode', first, withFirst(item => { item.priceMode = 'HAGGLE'; })],
  ['a basis in a task that asks for offers', first, withFirst(item => { item.priceBasis = 'TOTAL'; })],
  ['a basis that is not one', first, withFirst(item => { item.priceMode = 'MY_PRICE'; item.priceBasis = 'PER_HOUR'; })],
  ['no people', first, withFirst(item => { item.requiredSlots = 0; })],
  ['more people than a task can ask', first, withFirst(item => { item.requiredSlots = 51; })],
  ['a section that is not the one asked for', { ...first, scope: 'ATTENTION' as const }, (p: any) => {}],
  ['an application that is out of the server\'s order (rank)', first, (p: any) => { p.items.reverse(); }],
  ['an application that is out of the server\'s order (time)', first, (p: any) => { const [a, b] = [p.items[1], p.items[2]]; p.items[1] = b; p.items[2] = a; }],
  ['a first application that is not after the cursor', { ...first, cursor: { at: '2026-09-25T10:00:00+00:00', id: uuid(1), rank: 0 } }, (p: any) => { p.counts = null; }],
  ['a non-object page', first, (p: any) => { p.items = 'nothing'; }],
])('refuses %s as an invalid read, never a short one', async (_name, request, mutate) => {
  const body: any = payload(ordered().slice(0, 3), { counts: { ...COUNTS, total: 3, finished: 0, active: 2, attention: 1 } });
  mutate(body);
  if (_name === 'sections that do not add up to the total') body.counts.total = 5;
  mockRpc.mockResolvedValue({ data: body, error: null });
  await expect(applicationClientService.mojePrijaveStrana(request)).rejects.toThrow('OWN_APPLICATIONS_PAGE_INVALID');
});

it('a page that is not an object at all is invalid', async () => {
  for (const data of [null, [], 'x', 3]) { mockRpc.mockResolvedValue({ data, error: null }); await expect(applicationClientService.mojePrijaveStrana(first)).rejects.toThrow('OWN_APPLICATIONS_PAGE_INVALID'); }
});

it('accepts the server\'s order across a tie: the same instant is parted by the id, ascending', async () => {
  const tie = '2026-09-24T10:00:00.5+00:00';
  const docs = [document(2, { sortAt: tie }), document(3, { sortAt: tie })];
  mockRpc.mockResolvedValue({ data: payload(docs, { counts: { total: 2, attention: 0, active: 2, finished: 0 } }), error: null });
  expect((await applicationClientService.mojePrijaveStrana(first)).items.map(item => item.prijavaId)).toEqual([uuid(2), uuid(3)]);
  mockRpc.mockResolvedValue({ data: payload([docs[1], docs[0]], { counts: { total: 2, attention: 0, active: 2, finished: 0 } }), error: null });
  await expect(applicationClientService.mojePrijaveStrana(first)).rejects.toThrow('OWN_APPLICATIONS_PAGE_INVALID');
});

it('the same instant written two ways is one instant (the order is read by instant, never by text)', async () => {
  const docs = [document(2, { sortAt: '2026-09-24T10:00:00+00:00' }), document(3, { sortAt: '2026-09-24T12:00:00.000000+02:00' })];
  mockRpc.mockResolvedValue({ data: payload(docs, { counts: { total: 2, attention: 0, active: 2, finished: 0 } }), error: null });
  expect((await applicationClientService.mojePrijaveStrana(first)).items).toHaveLength(2);
});

it('a refused or failed request is unavailable, a missing session is auth, and an account that changed mid-read is refused', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'INVALID_SCOPE' } });
  await expect(applicationClientService.mojePrijaveStrana(first)).rejects.toThrow('OWN_APPLICATIONS_PAGE_UNAVAILABLE');
  mockRpc.mockRejectedValue(new Error('network')); await expect(applicationClientService.mojePrijaveStrana(first)).rejects.toThrow('OWN_APPLICATIONS_PAGE_UNAVAILABLE');
  mockAccount = { user: null, accountRevision: 1 }; await expect(applicationClientService.mojePrijaveStrana(first)).rejects.toThrow('AUTH_REQUIRED');
  mockAccount = { user: { id: ACCOUNT }, accountRevision: 1 };
  mockRpc.mockImplementation(async () => { mockAccount = { user: { id: ACCOUNT }, accountRevision: 2 }; return { data: payload(ordered().slice(0, 3)), error: null }; });
  await expect(applicationClientService.mojePrijaveStrana(first)).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
});

describe('the set the person is looking at, in the server\'s words', () => {
  it.each([['all', 'ALL', null], ['attention', 'ATTENTION', 0], ['active', 'ACTIVE', 1], ['finished', 'HISTORY', 2]] as const)('%s reads %s (rank %s)', (tab, scope, rank) => {
    expect(ownApplicationsScope(tab)).toBe(scope); expect(ownApplicationsScopeRank(scope)).toBe(rank);
  });
  it('the rank is the rule of the tab: what waits first, the open ones next, the rest last', () => {
    const row = (stanje: any, traziPaznju: boolean) => ({ stanje, traziPaznju });
    expect(applicationRank(row('SELECTED', true))).toBe(0); expect(applicationRank(row('STALE_REVIEW_REQUIRED', true))).toBe(0);
    for (const open of ['SUBMITTED', 'VIEWED', 'SHORTLISTED']) expect(applicationRank(row(open, false))).toBe(1);
    for (const done of ['WITHDRAWN', 'CLOSED']) expect(applicationRank(row(done, false))).toBe(2);
  });
});

it('decodes with an injected mapper, so a document the mapper refuses refuses the page', () => {
  const body = payload(ordered().slice(0, 3), { counts: { total: 3, attention: 1, active: 2, finished: 0 } });
  const seen: string[] = [];
  const page = decodeOwnApplicationsPage(body, first, (doc: any) => { seen.push(doc.id); return { prijavaId: doc.id, stanje: doc.state, traziPaznju: doc.attentionRequired } as any; });
  expect(seen).toEqual([uuid(1), uuid(2), uuid(3)]); expect(page?.items).toHaveLength(3);
  expect(decodeOwnApplicationsPage(body, first, () => { throw new Error('no'); })).toBeNull();
});

it('keeps the submitted price unit distinct from the current task unit, including legacy rows', async () => {
  const docs = ordered();
  Object.assign(docs[1], { applicationPriceBasis: 'HOURLY', priceRsd: 1200 });
  Object.assign(docs[2], { priceMode: 'MY_PRICE', priceBasis: 'HOURLY' });
  mockRpc.mockResolvedValue({ data: payload(docs), error: null });
  const page = await applicationClientService.mojePrijaveStrana(first);
  expect(page.items[1]).toMatchObject({ osnovaCene: 'HOURLY', cena: { iznos: 1200 }, zadatak: { osnovaCene: null } });
  expect(page.items[2].osnovaCene).toBeUndefined();
  expect(page.items[2].zadatak?.osnovaCene).toBe('HOURLY');
  mockRpc.mockResolvedValue({ data: docs, error: null });
  expect((await applicationClientService.mojePrijave())[1].osnovaCene).toBe('HOURLY');
  Object.assign(docs[1], { applicationPriceBasis: 'PER_PERSON' });
  mockRpc.mockResolvedValue({ data: payload(docs), error: null });
  await expect(applicationClientService.mojePrijaveStrana(first)).rejects.toThrow();
});
