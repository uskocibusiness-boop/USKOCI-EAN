const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const P = '20000000-0000-4000-8000-000000000001';
let mockSession = { user: { id: A } as { id: string } | null, accountRevision: 1 };
const mockRpc = jest.fn();
const mockGetUser = jest.fn(), mockFrom = jest.fn(), mockSelect = jest.fn(), mockEq = jest.fn(), mockRead = jest.fn();
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ auth: { getUser: mockGetUser }, from: mockFrom, rpc: mockRpc }) }));
import { supabaseIzvor } from '../supabaseIzvor';
const row = { id: P, account_id: A, kind: 'WORKER', display_name: 'Ana', city: 'Novi Sad', bio: '', skills: ['Prevoz'],
  tools: [], vehicles: ['Kombi'], licenses: ['B, C', 'ADR'], profile_status: 'ACTIVE', available_now: true, radius_km: 20, team_capacity: 3, capacity_revision: 'a'.repeat(64) };
beforeEach(() => {
  jest.clearAllMocks(); mockSession = { user: { id: A }, accountRevision: 1 };
  mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: A } }, error: null });
  mockRead.mockReset().mockResolvedValue({ data: row, error: null });
  mockRpc.mockImplementation(() => mockRead());
  const query = { select: mockSelect, eq: mockEq, maybeSingle: mockRead };
  mockFrom.mockReturnValue(query); mockSelect.mockReturnValue(query); mockEq.mockReturnValue(query);
});
afterEach(() => jest.useRealTimers());
it('reads only the captured authenticated Worker projection, preserving explicit availability and radius', async () => {
  const profile = await supabaseIzvor.mojRadnikProfil();
  expect(profile).toEqual({ id: P, ime: 'Ana', grad: 'Novi Sad', biografija: '', vestine: ['Prevoz'], alati: [], vozila: ['Kombi'], licence: ['B, C', 'ADR'],
    stanje: 'ACTIVE', dostupanOdmah: true, radijusKm: 20, kapacitetTima: 3, capacityRevision: 'a'.repeat(64) });
  expect(mockRpc).toHaveBeenCalledWith('rpc_get_worker_profile_for_edit', {});
  expect(mockFrom).not.toHaveBeenCalled();
});
it('preserves an explicitly empty licenses list but rejects an older projection without that field', async () => {
  mockRead.mockResolvedValueOnce({ data: { ...row, licenses: [] }, error: null });
  expect(await supabaseIzvor.mojRadnikProfil()).toMatchObject({ licence: [] });
  const { licenses: _licenses, ...olderRow } = row;
  mockRead.mockResolvedValueOnce({ data: olderRow, error: null });
  await expect(supabaseIzvor.mojRadnikProfil()).rejects.toThrow('WORKER_PROFILE_READ_FAILED');
});
it('only successful missing row is absence; Auth and table errors cannot create a default profile', async () => {
  mockRead.mockResolvedValue({ data: null, error: null }); await expect(supabaseIzvor.mojRadnikProfil()).resolves.toBeNull();
  mockRead.mockResolvedValue({ data: null, error: { message: 'private table diagnostic' } });
  await expect(supabaseIzvor.mojRadnikProfil()).rejects.toThrow('WORKER_PROFILE_READ_FAILED');
  mockRpc.mockClear(); mockFrom.mockClear(); mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'private auth diagnostic' } });
  await expect(supabaseIzvor.mojRadnikProfil()).rejects.toThrow('WORKER_PROFILE_READ_FAILED');
  // The active protected profile projection must not be requested after failed Auth.
  expect(mockRpc).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled();
});
it.each([
  { team_capacity: null }, { team_capacity: 0 }, { team_capacity: '2' }, { team_capacity: 51 }, { capacity_revision: 'bad' }, { account_id: B }, { id: 'invalid' }, { kind: 'REQUESTER' }, { profile_status: 'UNKNOWN' }, { radius_km: null },
  { radius_km: 0 }, { radius_km: 201 }, { radius_km: '20' }, { radius_km: 1.5 }, { available_now: null },
  { available_now: 'false' }, { skills: null }, { tools: [null] }, { vehicles: 'Kombi' }, { city: 123 },
  { licenses: null }, { licenses: undefined }, { licenses: 'B' }, { licenses: ['B', null] },
])('rejects malformed or unavailable source values without default substitution: %j', async patch => {
  mockRead.mockResolvedValue({ data: { ...row, ...patch }, error: null });
  await expect(supabaseIzvor.mojRadnikProfil()).rejects.toThrow('WORKER_PROFILE_READ_FAILED');
});
it('historically blank optional text remains blank and explicit false/1km is preserved', async () => {
  mockRead.mockResolvedValue({ data: { ...row, display_name: null, city: null, bio: null, available_now: false, radius_km: 1 }, error: null });
  expect(await supabaseIzvor.mojRadnikProfil()).toMatchObject({ ime: '', grad: '', biografija: '', dostupanOdmah: false, radijusKm: 1 });
});
it('requires an actual current account before any SDK request', async () => {
  mockSession.user = null; await expect(supabaseIzvor.mojRadnikProfil()).rejects.toThrow('WORKER_PROFILE_AUTH_REQUIRED');
  expect(mockGetUser).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled();
});
it.each(['auth', 'select'])('fences account ABA after an asynchronous %s operation', async stage => {
  let finish!: (result: unknown) => void;
  (stage === 'auth' ? mockGetUser : mockRead).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = supabaseIzvor.mojRadnikProfil(); const rejected = expect(pending).rejects.toThrow('WORKER_PROFILE_READ_FAILED');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  mockSession.accountRevision += 2;
  finish(stage === 'auth' ? { data: { user: { id: A } }, error: null } : { data: row, error: null });
  await rejected; if (stage === 'auth') expect(mockRpc).not.toHaveBeenCalled();
});
it('does not query a profile for a different server Auth identity', async () => {
  mockGetUser.mockResolvedValue({ data: { user: { id: B } }, error: null });
  await expect(supabaseIzvor.mojRadnikProfil()).rejects.toThrow('WORKER_PROFILE_READ_FAILED');
  expect(mockRpc).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled();
});
it('a timed-out Auth read cannot later start a profile query', async () => {
  jest.useFakeTimers(); let finish!: (result: unknown) => void;
  mockGetUser.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = expect(supabaseIzvor.mojRadnikProfil()).rejects.toThrow('WORKER_PROFILE_READ_FAILED');
  await jest.advanceTimersByTimeAsync(15_000); await pending;
  finish({ data: { user: { id: A } }, error: null }); await Promise.resolve();
  expect(mockRpc).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled();
});
