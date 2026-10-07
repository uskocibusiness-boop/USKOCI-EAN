import { needClientService } from '../needClientService';
import { NEED_ENDINGS, endingOf, endingOfStatus } from '../needEnding';

/**
 * Plan 2.2 (owner 2026-10-07): how a task ENDED must reach the screens. `needClientService` folds COMPLETED, CANCELLED, EXPIRED and
 * ARCHIVED into the one `stanje` 'ZATVORENA' (the Istorija tab, the filters and the lifecycle menu read that, and keep reading it);
 * the raw ending now rides beside it as `kraj`, on every read of a task: the whole list, one task and a page of the list.
 */
const mockRpc = jest.fn(), mockUrgency = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc,
  auth: { getUser: async () => ({ data: { user: { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' } }, error: null }) } }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }, accountRevision: 1 }) }));
jest.mock('../needUrgencyClientService', () => ({ readNeedUrgencies: (...args: unknown[]) => mockUrgency(...args) }));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const document = (n: number, over: Record<string, unknown> = {}) => ({
  id: uuid(n), requester_profile_id: uuid(900), status: 'PUBLISHED', title: `Zadatak ${n}`, description: 'Opis', category: 'PROOF', approximate_city: 'Novi Sad',
  approximate_area: 'Liman', approximate_lat: null, approximate_lng: null, schedule_kind: 'FLEXIBLE', starts_at: null, ends_at: null, required_slots: 2, mode: 'MY_PRICE',
  requester_price_rsd: 5000, required_skills: [], required_tools: [], required_vehicles: [], verified_identity_required: false, urgent: false, public_photo_paths: [],
  revision: 2, published_at: null, created_at: '2026-03-01T10:00:00+00:00', updated_at: '2026-03-01T10:00:00+00:00', response_deadline: null,
  minimum_experience_years: null, execution_location_mode: null, required_licenses: [], task_country_code: null, task_timezone: 'Europe/Belgrade',
  price_basis: 'TOTAL', covered_slots: 0, selectable_application_count: 0, marketplace_responses: [], need_geography: null,
  need_requirement_details: null, sortAt: `2026-03-01T10:0${n}:00+00:00`, ...over });
beforeEach(() => { mockRpc.mockReset(); mockUrgency.mockReset(); mockUrgency.mockResolvedValue(new Map()); });

describe('the ending of a task that ended', () => {
  it.each(NEED_ENDINGS)('%s is still ZATVORENA for every screen that reads it, and says how it ended', async status => {
    mockRpc.mockResolvedValue({ data: [document(1, { status })], error: null });
    const [row] = await needClientService.mojePotrebe();
    expect(row.stanje).toBe('ZATVORENA');
    expect(endingOf(row)).toBe(status);
    expect((row as { kraj?: string }).kraj).toBe(status);
  });

  it('keeps the four endings apart, which is the point: a finished task, a cancelled one and one nobody was chosen for are three different things', async () => {
    mockRpc.mockResolvedValue({ data: NEED_ENDINGS.map((status, at) => document(at + 1, { status })), error: null });
    const rows = await needClientService.mojePotrebe();
    expect(rows.map(row => row.stanje)).toEqual(['ZATVORENA', 'ZATVORENA', 'ZATVORENA', 'ZATVORENA']);
    expect(rows.map(endingOf)).toEqual(['COMPLETED', 'CANCELLED', 'EXPIRED', 'ARCHIVED']);
  });

  it.each([['DRAFT', 'NACRT'], ['PUBLISHED', 'OBJAVLJENA'], ['SELECTION', 'OBJAVLJENA'], ['ACTIVE', 'POPUNJENA']])
  ('%s has no ending: the field is absent, not empty, and stanje is what it always was', async (status, stanje) => {
    mockRpc.mockResolvedValue({ data: [document(1, { status })], error: null });
    const [row] = await needClientService.mojePotrebe();
    expect(row.stanje).toBe(stanje);
    expect('kraj' in row).toBe(false);
    expect(endingOf(row)).toBeNull();
  });

  it('is carried by the read of one task too', async () => {
    mockRpc.mockResolvedValue({ data: document(1, { status: 'CANCELLED' }), error: null });
    const task = await needClientService.potreba(uuid(1));
    expect(task).toMatchObject({ stanje: 'ZATVORENA', kraj: 'CANCELLED' });
  });

  it('is carried by a page of the list, as by the whole list', async () => {
    const docs = [document(1, { status: 'COMPLETED' }), document(2, { status: 'EXPIRED' })];
    mockRpc.mockResolvedValue({ data: { items: docs, hasMore: false, asOf: '2026-10-01T08:00:00.123456+00:00',
      counts: { total: 2, active: 0, drafts: 0, history: 2, waiting: 0 } }, error: null });
    const page = await needClientService.mojePotrebeStrana({ scope: 'HISTORY', limit: 30, cursor: null }, { includeUrgency: false });
    expect(page.items.map(item => [item.stanje, endingOf(item)])).toEqual([['ZATVORENA', 'COMPLETED'], ['ZATVORENA', 'EXPIRED']]);
  });

  it('is read only from what the server sent: a status that is not an ending, a missing one and a non-task are none', () => {
    expect(endingOfStatus('COMPLETED')).toBe('COMPLETED');
    for (const status of ['PUBLISHED', 'completed', '', null, undefined, 3, {}]) expect(endingOfStatus(status)).toBeNull();
    expect(endingOf(null)).toBeNull(); expect(endingOf(undefined)).toBeNull(); expect(endingOf({})).toBeNull();
    expect(endingOf({ kraj: 'CANCELLED' })).toBe('CANCELLED'); expect(endingOf({ kraj: 'ZATVORENA' })).toBeNull();
  });
});
