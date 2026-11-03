const aid = '11111111-1111-4111-8111-111111111111', nid = '22222222-2222-4222-8222-222222222222';
let mockAccount: string | null = aid, mockRevision = 0;
const mockRpc = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: mockAccount ? { id: mockAccount } : null, accountRevision: mockRevision }) }));
import { decodeNeedUrgency, NEED_URGENCY_BUDGET_MS, readNeedUrgencies } from '../needUrgencyClientService';
import { displaysUrgent } from '../../lib/needUrgency';
const active = () => ({ needId: nid, level: 'HITNO', activatedAt: '2026-09-13T10:00:00Z', expiresAt: '2026-09-13T11:00:00Z',
  policyVersion: 1, reasonCodes: ['URGENT_ACTIVE'], authoritative: true });
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
// Future-feature-only coverage: the real V1 Jest default no longer enables HITNO.
const originalUrgentFlag = process.env.EXPO_PUBLIC_URGENT;
beforeEach(() => { process.env.EXPO_PUBLIC_URGENT = '1'; jest.useFakeTimers(); mockRpc.mockReset(); mockAccount = aid; mockRevision = 0; });
afterEach(async () => { await flush(); expect(jest.getTimerCount()).toBe(0); jest.useRealTimers();
  if (originalUrgentFlag === undefined) delete process.env.EXPO_PUBLIC_URGENT;
  else process.env.EXPO_PUBLIC_URGENT = originalUrgentFlag;
});
it('uses the existing authority once per flagged visible ID and never derives urgency from raw flags', async () => {
  mockRpc.mockResolvedValue({ data: active(), error: null });
  const result = await readNeedUrgencies([{ id: nid, urgent: true }, { id: nid, urgent: true }, { id: aid, urgent: false }, { id: aid }, { id: 'bad', urgent: true }]);
  expect([...result]).toEqual([[nid, { level: 'HITNO', expiresAt: active().expiresAt }]]);
  expect(mockRpc).toHaveBeenCalledTimes(1); expect(mockRpc).toHaveBeenCalledWith('fn_need_urgency', { p_need_id: nid });
});
it.each([{ needId: aid }, { authoritative: false }, { expiresAt: null }, { activatedAt: '2026-09-13T12:00:00Z' }, { level: 'urgent' }])('rejects wrong or unobserved authority %#', patch => {
  expect(decodeNeedUrgency({ ...active(), ...patch }, nid)).toBeNull();
});
it('honors the existing server expiry without adding a new duration or reviving an expired raw flag', () => {
  const urgency = decodeNeedUrgency(active(), nid)!;
  expect(displaysUrgent(urgency, Date.parse('2026-09-13T10:59:59Z'))).toBe(true);
  expect(displaysUrgent(urgency, Date.parse(active().expiresAt))).toBe(false);
  expect(displaysUrgent(undefined)).toBe(false);
  const normal = decodeNeedUrgency({ ...active(), level: 'NORMAL', activatedAt: null, expiresAt: null }, nid)!;
  expect(displaysUrgent(normal, Date.parse('2026-09-13T10:01:00Z'))).toBe(false);
});
it('keeps an unavailable projection unknown and neither hides the parent Need nor retries', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'private transport details' } });
  expect((await readNeedUrgencies([{ id: nid, urgent: true }])).size).toBe(0);
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('does not use a late urgency receipt across a same-account session change', async () => {
  let resolve!: (v: unknown) => void;
  mockRpc.mockReturnValue(new Promise(r => { resolve = r; }));
  const result = readNeedUrgencies([{ id: nid, urgent: true }]); mockRevision++;
  resolve({ data: active(), error: null }); expect((await result).size).toBe(0);
});
it('performs no urgency calls when signed out or when no row has the existing raw flag', async () => {
  mockAccount = null; expect((await readNeedUrgencies([{ id: nid, urgent: true }])).size).toBe(0);
  mockAccount = aid; expect((await readNeedUrgencies([{ id: nid, urgent: false }])).size).toBe(0);
  expect(mockRpc).not.toHaveBeenCalled();
});
it('bounds parallel reads and stops queued urgency work on failure while leaving the Need list usable', async () => {
  const resolves: ((v: unknown) => void)[] = [];
  mockRpc.mockImplementation(() => new Promise(resolve => resolves.push(resolve)));
  const rows = Array.from({ length: 9 }, (_, index) => ({ id: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`, urgent: true }));
  const result = readNeedUrgencies(rows); expect(mockRpc).toHaveBeenCalledTimes(4);
  resolves.forEach(resolve => resolve({ data: null, error: { message: 'unavailable' } }));
  expect((await result).size).toBe(0); expect(mockRpc).toHaveBeenCalledTimes(4);
});

it('aborts the active urgency transports, ignores late receipts and starts no queued hydration', async () => {
  const parent = new AbortController();
  const pending: Array<{ id: string; signal: AbortSignal; resolve: (value: unknown) => void }> = [];
  mockRpc.mockImplementation((_name: string, { p_need_id: id }: { p_need_id: string }) => ({
    abortSignal: (signal: AbortSignal) => new Promise(resolve => pending.push({ id, signal, resolve })),
  }));
  const rows = Array.from({ length: 9 }, (_, index) => ({ id: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`, urgent: true }));
  const result = readNeedUrgencies(rows, parent.signal);
  expect(pending).toHaveLength(4);
  expect(pending.every(row => row.signal === pending[0].signal && row.signal !== parent.signal)).toBe(true);
  parent.abort(); expect(pending.every(row => row.signal.aborted)).toBe(true);
  const snapshot = await result; // Cancellation settles even when the transport ignores it.
  expect(snapshot.size).toBe(0);
  pending.forEach(row => row.resolve({ data: { needId: row.id, level: 'NORMAL', activatedAt: null, expiresAt: null, authoritative: true }, error: null }));
  await flush(); expect(snapshot.size).toBe(0); expect(mockRpc).toHaveBeenCalledTimes(4);
  mockRpc.mockResolvedValue({ data: active(), error: null });
  expect((await readNeedUrgencies([{ id: nid, urgent: true }], new AbortController().signal)).get(nid))
    .toEqual({ level: 'HITNO', expiresAt: active().expiresAt });
});

it('does not dispatch urgency requests for an already aborted collection', async () => {
  const parent = new AbortController(); parent.abort();
  expect((await readNeedUrgencies([{ id: nid, urgent: true }], parent.signal)).size).toBe(0);
  expect(mockRpc).not.toHaveBeenCalled();
});

it('releases hung transports at one optional deadline without dispatching queued reads or accepting late badges', async () => {
  const pending: Array<{ id: string; signal: AbortSignal; resolve: (value: unknown) => void }> = [];
  mockRpc.mockImplementation((_name: string, { p_need_id: id }: { p_need_id: string }) => ({
    abortSignal: (signal: AbortSignal) => new Promise(resolve => pending.push({ id, signal, resolve })),
  }));
  const rows = Array.from({ length: 1000 }, (_, index) => ({ id: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`, urgent: true }));
  const reading = readNeedUrgencies(rows);
  let settled = false;
  void reading.then(() => { settled = true; });
  expect(pending).toHaveLength(4);
  await jest.advanceTimersByTimeAsync(NEED_URGENCY_BUDGET_MS - 1);
  expect(settled).toBe(false);
  await jest.advanceTimersByTimeAsync(1);
  const result = await reading;
  expect(result.size).toBe(0); expect(pending.every(row => row.signal.aborted)).toBe(true);
  pending.forEach(row => row.resolve({ data: { ...active(), needId: row.id }, error: null }));
  await flush();
  expect(result.size).toBe(0); expect(mockRpc).toHaveBeenCalledTimes(4);
});

it('shares the deadline across batches and retains only completed authoritative receipts', async () => {
  const pending: Array<{ id: string; resolve: (value: unknown) => void }> = [];
  mockRpc.mockImplementation((_name: string, { p_need_id: id }: { p_need_id: string }) =>
    new Promise(resolve => pending.push({ id, resolve })));
  const rows = Array.from({ length: 9 }, (_, index) => ({ id: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`, urgent: true }));
  const reading = readNeedUrgencies(rows);
  await jest.advanceTimersByTimeAsync(NEED_URGENCY_BUDGET_MS / 2);
  pending.slice(0, 4).forEach(row => row.resolve({ data: {
    needId: row.id, level: 'NORMAL', activatedAt: null, expiresAt: null, authoritative: true,
  }, error: null }));
  await flush(); expect(mockRpc).toHaveBeenCalledTimes(8);
  await jest.advanceTimersByTimeAsync(NEED_URGENCY_BUDGET_MS / 2);
  const result = await reading;
  expect([...result.keys()]).toEqual(rows.slice(0, 4).map(row => row.id));
  expect([...result.values()]).toEqual(Array(4).fill({ level: 'NORMAL', expiresAt: null }));
  for (const row of rows.slice(4)) expect(result.has(row.id)).toBe(false);
  pending.slice(4).forEach(row => row.resolve({ data: { ...active(), needId: row.id }, error: null }));
  await flush(); expect(result.size).toBe(4); expect(mockRpc).toHaveBeenCalledTimes(8);
});

it('keeps malformed urgency unknown while preserving another validated result', async () => {
  mockRpc.mockImplementation((_name: string, { p_need_id: id }: { p_need_id: string }) => Promise.resolve({
    data: { ...active(), needId: id, ...(id === aid ? { expiresAt: null } : {}) }, error: null,
  }));
  const result = await readNeedUrgencies([{ id: nid, urgent: true }, { id: aid, urgent: true }]);
  expect(result.get(nid)).toEqual({ level: 'HITNO', expiresAt: active().expiresAt });
  expect(result.has(aid)).toBe(false);
});

it.each(['abort', 'account-revision'] as const)('retires completed and stalled metadata promptly on %s', async reason => {
  const parent = new AbortController();
  const signals: AbortSignal[] = [];
  mockRpc.mockImplementation((_name: string, { p_need_id: id }: { p_need_id: string }) => ({
    abortSignal: (signal: AbortSignal) => {
      signals.push(signal);
      return id === nid ? Promise.resolve({ data: active(), error: null }) : new Promise(() => {});
    },
  }));
  const reading = readNeedUrgencies([{ id: nid, urgent: true }, { id: aid, urgent: true }], parent.signal);
  await flush();
  if (reason === 'abort') parent.abort();
  else {
    mockAccount = aid; mockRevision += 2; // The account UUID alone cannot admit an A -> B -> A visit.
    await jest.advanceTimersByTimeAsync(100);
  }
  expect((await reading).size).toBe(0);
  expect(signals.every(signal => signal.aborted)).toBe(true);
});
