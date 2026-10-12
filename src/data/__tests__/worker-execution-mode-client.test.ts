import { canonicalWorkerExecutionModes, workerExecutionModeClientService } from '../workerExecutionModeClientService';

const mockRpc = jest.fn();
const mockOwnProfile = jest.fn();
let mockAccount: { user: { id: string } | null; accountRevision: number };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }) }));
jest.mock('../ownProfileClientService', () => ({ ownProfileClientService: { read: (...args: unknown[]) => mockOwnProfile(...args) } }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));

const OWNER = '10000000-0000-4000-8000-000000000001';
const PROFILE = '20000000-0000-4000-8000-000000000001';
const receipt = (modes: string[], confirmed = modes.length > 0) => ({
  workerProfileId: PROFILE, confirmed, modes, confirmedAt: confirmed ? '2026-10-12T00:10:52Z' : null,
  matchingAuthority: 'NONE', notificationAuthority: 'NONE',
});

beforeEach(() => {
  mockRpc.mockReset(); mockOwnProfile.mockReset();
  mockAccount = { user: { id: OWNER }, accountRevision: 5 };
  mockOwnProfile.mockResolvedValue({ accountId: OWNER, profileId: PROFILE, kind: 'WORKER', stanje: 'DRAFT' });
});

test('unconfirmed new worker has no automatic execution mode', async () => {
  mockRpc.mockResolvedValue({ data: receipt([], false), error: null });
  const v = await workerExecutionModeClientService.read(OWNER, 5);
  expect(v.confirmed).toBe(false); expect(v.modes).toEqual([]);
  expect(mockRpc).toHaveBeenCalledWith('rpc_get_worker_execution_modes', { p_worker_profile_id: PROFILE });
});

test('saves both modes in canonical order and confirms server readback', async () => {
  mockRpc.mockImplementation(async (name: string) => {
    if (name === 'rpc_set_worker_execution_modes') return { data: receipt(['ON_SITE', 'REMOTE']), error: null };
    return { data: receipt(['ON_SITE', 'REMOTE']), error: null };
  });
  const v = await workerExecutionModeClientService.save(OWNER, 5, ['REMOTE', 'ON_SITE']);
  expect(v.confirmed).toBe(true); expect(v.modes).toEqual(['ON_SITE', 'REMOTE']);
  expect(mockRpc).toHaveBeenCalledWith('rpc_set_worker_execution_modes', {
    p_worker_profile_id: PROFILE, p_modes: ['ON_SITE', 'REMOTE'],
  });
});

test('lost write response still succeeds only when readback agrees', async () => {
  mockRpc.mockImplementation(async (name: string) => {
    if (name === 'rpc_set_worker_execution_modes') throw new Error('connection lost');
    return { data: receipt(['REMOTE']), error: null };
  });
  await expect(workerExecutionModeClientService.save(OWNER, 5, ['REMOTE'])).resolves.toMatchObject({
    confirmed: true, modes: ['REMOTE'],
  });
});

test('server does not confirm a different choice: no optimistic success', async () => {
  mockRpc.mockImplementation(async (name: string) => {
    if (name === 'rpc_set_worker_execution_modes') return { error: null };
    return { data: receipt(['ON_SITE']), error: null };
  });
  await expect(workerExecutionModeClientService.save(OWNER, 5, ['REMOTE']))
    .rejects.toThrow('WORKER_MODE_SAVE_NOT_CONFIRMED');
});

test('account switch fences stale reads and saves', async () => {
  mockOwnProfile.mockImplementation(async () => {
    mockAccount.accountRevision++; return {
      accountId: OWNER, profileId: PROFILE, kind: 'WORKER',
    };
  });
  await expect(workerExecutionModeClientService.read(OWNER, 5)).rejects.toThrow('WORKER_MODE_ACCOUNT_CHANGED');
  expect(mockRpc).not.toHaveBeenCalled();
});

test('malformed server receipt cannot claim remote consent', async () => {
  mockRpc.mockResolvedValue({ data: { ...receipt(['REMOTE', 'REMOTE']) }, error: null });
  await expect(workerExecutionModeClientService.read(OWNER, 5)).rejects.toThrow('WORKER_MODE_INVALID_RECEIPT');
});

test('invalid duplicate modes never call a write RPC', async () => {
  await expect(workerExecutionModeClientService.save(OWNER, 5, ['REMOTE', 'REMOTE']))
    .rejects.toThrow('WORKER_MODE_SELECTION_REQUIRED');
  expect(mockRpc).not.toHaveBeenCalled();
});

test('worker-profile screen does not link to redundant mode settings route', () => {
  const fs = require('node:fs');
  const ui = fs.readFileSync('src/ui/workerProfile/WorkerProfilePresentation.tsx', 'utf8');
  expect(ui).not.toContain("navigate('/profil/nacin-rada')");
  expect(fs.existsSync('src/app/(app)/profil/nacin-rada.tsx')).toBe(false);
});

test('canonical helper sorts ON_SITE then REMOTE', () => {
  expect(canonicalWorkerExecutionModes(['REMOTE', 'ON_SITE'])).toEqual(['ON_SITE', 'REMOTE']);
  expect(canonicalWorkerExecutionModes([])).toEqual([]);
});

test('inferWorkerExecutionModes deduces REMOTE, ON_SITE, or both from skills and location', () => {
  const { inferWorkerExecutionModes } = require('../workerExecutionModeClientService');
  // Digital only without city => REMOTE
  expect(inferWorkerExecutionModes(['Izrada logotipa', 'Prevođenje tekstova'])).toEqual(['REMOTE']);
  // Digital with city specified => both
  expect(inferWorkerExecutionModes(['Izrada logotipa'], { city: 'Beograd', radiusKm: 15 })).toEqual(['ON_SITE', 'REMOTE']);
  // On-site craft skill => ON_SITE
  expect(inferWorkerExecutionModes(['Krečenje zidova', 'Montaža polica'])).toEqual(['ON_SITE']);
  // Combined skills => both
  expect(inferWorkerExecutionModes(['Krečenje', 'Grafički dizajn'])).toEqual(['ON_SITE', 'REMOTE']);
  // Fallback when skills empty => ON_SITE
  expect(inferWorkerExecutionModes([])).toEqual(['ON_SITE']);
});
