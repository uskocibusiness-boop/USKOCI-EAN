/**
 * Review of owner step 10 (critique A15): the calendar places my own tasks and finished Dogovori by the exact window of
 * their accepted terms, so the Dogovori list carries it as `tacanTermin`. An object when both ends are exact instants
 * with the start first; `null` when the Dogovor has no exact window; left out when the read carried no terms at all, so
 * the calendar says it shows only my work instead of calling a day empty.
 */
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: { id: 'requester-1' }, accountRevision: 1 }) }));
jest.mock('../supabaseClient', () => {
  const mockGetUser = jest.fn();
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ auth: { getUser: mockGetUser }, rpc: mockRpc }),
    __testMocks: { mockGetUser, mockRpc },
  };
});

import { agreementClientService } from '../agreementClientService';

const { mockGetUser, mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockGetUser: jest.Mock; mockRpc: jest.Mock };
}).__testMocks;

const row = (id: string, patch: Record<string, unknown> = {}) => ({
  id, requesterAccountId: 'requester-1', workerAccountId: 'worker-1', requesterName: 'Miloš', workerName: 'Ana',
  title: 'Pomoć oko krečenja stana', status: 'COMPLETED', agreementStatus: 'COMPLETED', currentVersion: 2, requiredSlots: 1,
  executionMode: 'ON_SITE', approximateArea: 'Liman', approximateCity: 'Novi Sad', createdAt: '2026-09-20T08:00:00Z',
  terms: { price_rsd: 4000, currency: 'RSD' }, ...patch,
});

beforeEach(() => {
  mockGetUser.mockReset(); mockRpc.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'requester-1' } }, error: null });
});

it('maps the accepted exact window from the same terms the list reads, keeping the stored text as it came', async () => {
  const items = [
    row('exact', { terms: { price_rsd: 4000, proposed_start_at: '2026-09-24T10:00:00.123456+00:00', proposed_end_at: '2026-09-24T17:00:00+00:00' } }),
    row('none', { terms: { price_rsd: 4000 } }),
    row('one-end', { terms: { proposed_start_at: '2026-09-24T10:00:00Z' } }),
    row('backwards', { terms: { proposed_start_at: '2026-09-24T17:00:00Z', proposed_end_at: '2026-09-24T10:00:00Z' } }),
    row('unreadable', { terms: { proposed_start_at: 'sutra', proposed_end_at: '2026-09-24T10:00:00Z' } }),
    row('unsaid', { terms: undefined }),
    row('malformed', { terms: ['2026-09-24T10:00:00Z'] }),
  ];
  mockRpc.mockImplementation((name: string) => Promise.resolve(name === 'rpc_list_my_agreements_page'
    ? { data: { items, hasMore: false }, error: null } : { data: { eligible: false }, error: null }));
  const result = Object.fromEntries((await agreementClientService.mojiDogovori()).map(item => [item.id, item]));
  expect(result.exact.tacanTermin).toEqual({ pocetak: '2026-09-24T10:00:00.123456+00:00', kraj: '2026-09-24T17:00:00+00:00' });
  for (const id of ['none', 'one-end', 'backwards', 'unreadable']) expect(result[id].tacanTermin).toBeNull();
  for (const id of ['unsaid', 'malformed']) expect('tacanTermin' in result[id]).toBe(false);
  // Nothing else the calendar reads changes with it.
  expect(result.exact).toMatchObject({ stanje: 'COMPLETED', verzija: 2, naslov: 'Pomoć oko krečenja stana', cena: { prikaz: '4.000 RSD' } });
});

it('preserves a declared start-only task without inventing a confirmed calendar interval', async () => {
  const beginning = '2026-10-12T05:00:00Z';
  const items = [row('start-snapshot', { status: 'CONFIRMED', agreementStatus: 'CONFIRMED',
    terms: { price_rsd: 4000, declared_start_at: beginning,
      proposed_start_at: null, proposed_end_at: null, schedule_source: 'UNSCHEDULED' } })];
  mockRpc.mockResolvedValue({ data: { items, hasMore: false }, error: null });
  const [agreement] = await agreementClientService.mojiDogovori({ includeRatings: false });
  expect(agreement.prihvacenPocetak).toBe(beginning);
  expect(agreement.vremeTekst).toContain('Početak 12. okt');
  expect(agreement.vremeTekst).toContain('07:00');
  expect(agreement.vremeTekst).toContain('trajanje po dogovoru');
  expect(agreement.tacanTermin).toBeNull();
});

it('carries the same window on the one Dogovor read', async () => {
  mockRpc.mockResolvedValue({ data: row('agr-1', { status: 'CONFIRMED', agreementStatus: 'CONFIRMED',
    terms: { proposed_start_at: '2026-09-24T10:00:00Z', proposed_end_at: '2026-09-24T12:00:00Z' } }), error: null });
  const result = await agreementClientService.dogovor('agr-1');
  expect(result?.tacanTermin).toEqual({ pocetak: '2026-09-24T10:00:00Z', kraj: '2026-09-24T12:00:00Z' });
});

it('carries accepted start independently of the task start and never promotes an invalid or unread term', async () => {
  const items = [
    row('rescheduled', { startsAt: '2026-09-20T08:00:00Z', terms: {
      proposed_start_at: '2026-09-28T12:00:00.123456+02:00', proposed_end_at: '2026-09-28T14:00:00+02:00' } }),
    row('start-only', { terms: { proposed_start_at: '2026-09-29T10:00:00Z' } }),
    row('invalid-day', { startsAt: '2026-09-20T08:00:00Z', terms: { proposed_start_at: '2026-02-30T10:00:00Z' } }),
    row('local-clock', { startsAt: '2026-09-20T08:00:00Z', terms: { proposed_start_at: '2026-09-29T10:00:00' } }),
    row('none', { startsAt: '2026-09-20T08:00:00Z' }),
    row('unread', { startsAt: '2026-09-20T08:00:00Z', terms: undefined }),
    row('array', { terms: [] }),
  ];
  mockRpc.mockResolvedValue({ data: { items, hasMore: false }, error: null });
  const result = Object.fromEntries((await agreementClientService.mojiDogovori({ includeRatings: false })).map(item => [item.id, item]));
  expect(result.rescheduled.prihvacenPocetak).toBe('2026-09-28T12:00:00.123456+02:00');
  expect(result.rescheduled.pocinje).toBe('2026-09-20T08:00:00Z');
  expect(result['start-only'].prihvacenPocetak).toBe('2026-09-29T10:00:00Z');
  expect(result['start-only'].tacanTermin).toBeNull();
  for (const id of ['invalid-day', 'local-clock', 'none']) expect(result[id].prihvacenPocetak).toBeNull();
  for (const id of ['unread', 'array']) expect(result[id]).not.toHaveProperty('prihvacenPocetak');
});

it('keeps full accepted scope within its Unicode bound, with no task or pending-proposal substitution', async () => {
  const fullScope = `  Prvi sprat\n${'🪑'.repeat(3985)}  `; // Exactly 4,000 code points; surrogate pairs are one each.
  expect(Array.from(fullScope)).toHaveLength(4000);
  const items = [
    row('accepted', { terms: { scope_note: fullScope }, scopeNote: 'TASK_SCOPE',
      pendingChange: { id: 'proposal', terms: { scope_note: 'UNACCEPTED_SCOPE' } } }),
    row('too-long', { terms: { scope_note: `${fullScope}x` } }),
    row('blank', { terms: { scope_note: ' \n ' } }),
    row('wrong-kind', { terms: { scope_note: { text: 'not an accepted string' } } }),
    row('none'), row('unread', { terms: null }),
  ];
  mockRpc.mockResolvedValue({ data: { items, hasMore: false }, error: null });
  const result = Object.fromEntries((await agreementClientService.mojiDogovori({ includeRatings: false })).map(item => [item.id, item]));
  expect(result.accepted.prihvacenObim).toBe(fullScope);
  for (const id of ['too-long', 'blank', 'wrong-kind', 'none']) expect(result[id].prihvacenObim).toBeNull();
  expect(result.unread).not.toHaveProperty('prihvacenObim');
});

it('uses the same accepted fields on the workspace read', async () => {
  mockRpc.mockResolvedValue({ data: row('agr-1', { status: 'CONFIRMED', agreementStatus: 'CONFIRMED',
    startsAt: '2026-09-20T08:00:00Z', terms: { proposed_start_at: '2026-09-29T10:00:00Z',
      scope_note: 'Prenos troseda do drugog sprata, bez lifta.' } }), error: null });
  expect(await agreementClientService.dogovor('agr-1')).toMatchObject({
    prihvacenPocetak: '2026-09-29T10:00:00Z', prihvacenObim: 'Prenos troseda do drugog sprata, bez lifta.',
    pocinje: '2026-09-20T08:00:00Z',
  });
});
