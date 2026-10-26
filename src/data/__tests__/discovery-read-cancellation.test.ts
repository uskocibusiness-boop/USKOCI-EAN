jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return { supabaseKlijent: () => ({ rpc: mockRpc }), __testMocks: { mockRpc } };
});
jest.mock('../publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: jest.fn() } }));
let mockSession = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1, sessionEpoch: 1 };
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));

import { supabaseIzvor } from '../supabaseIzvor';
import { publicProfileClientService } from '../publicProfileClientService';
import { createFocusedResource } from '../focusedResource';

const { mockRpc } = jest.requireMock('../supabaseClient').__testMocks as { mockRpc: jest.Mock };
const publicProfile = publicProfileClientService.javniProfil as jest.Mock;
const id = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;
const item = (n = 100, author = 'author') => ({
  id: id(n), sortAt: '2026-09-18T10:00:00.123456Z', publishedAt: '2026-09-18T10:00:00.123456Z',
  title: 'Task', category: 'Selidbe', status: 'PUBLISHED', urgent: false,
  scheduleKind: 'FLEXIBLE', startsAt: null, endsAt: null, executionLocationMode: null,
  approximateCity: 'Beograd', approximateArea: 'Centar', pin: { lat: 44.8, lng: 20.4, precision: 'COARSE_1KM' },
  requiredSlots: 1, coveredSlots: 0, requiredSkills: [], requiredTools: [], requiredVehicles: [], requiredLicenses: [],
  minimumExperienceYears: null, verifiedIdentityRequired: false, taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade',
  priceMode: 'OFFERS', requesterPriceRsd: null, requesterProfileId: author,
  responseDeadline: null, acceptsApplications: true, publicTopology: null, criticalConditions: null,
});
const page = (items: unknown[], hasMore = false) => ({ data: { items, hasMore, asOf: '2026-09-19T00:00:00Z' }, error: null });
const relations = (needId: string) => ({ data: { items: [{ needId, relation: 'OWNER' }] }, error: null });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
beforeEach(() => {
  mockRpc.mockReset(); publicProfile.mockReset().mockResolvedValue(null);
  mockSession = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1, sessionEpoch: 1 };
});
afterEach(() => { jest.useRealTimers(); });

it('refuses already cancelled collection and relation reads without dispatching a request', async () => {
  const abort = new AbortController(); abort.abort();
  await expect(supabaseIzvor.otvorenePrilike({ signal: abort.signal })).rejects.toThrow('OPPORTUNITIES_READ_ABORTED');
  await expect(supabaseIzvor.odnosiPremaZadacima([id(1)], { signal: abort.signal })).rejects.toThrow('TASK_RELATIONS_READ_ABORTED');
  expect(mockRpc).not.toHaveBeenCalled(); expect(publicProfile).not.toHaveBeenCalled();
});

it('aborts the page transport and refuses late hasMore before any later page or hydration', async () => {
  const pending = deferred<ReturnType<typeof page>>(), abort = new AbortController();
  const abortSignal = jest.fn(() => pending.promise);
  mockRpc.mockReturnValue({ abortSignal });
  const result = supabaseIzvor.otvorenePrilike({ signal: abort.signal });
  const rejected = expect(result).rejects.toThrow('OPPORTUNITIES_READ_ABORTED');
  expect(abortSignal).toHaveBeenCalledWith(abort.signal);
  abort.abort(); pending.resolve(page([item()], true)); await rejected;
  expect(mockRpc).toHaveBeenCalledTimes(1); expect(publicProfile).not.toHaveBeenCalled();
});

it('keeps account-revision admission even if the transport ignores both logout and abort', async () => {
  const pending = deferred<ReturnType<typeof page>>(); mockRpc.mockReturnValue(pending.promise);
  const result = supabaseIzvor.otvorenePrilike();
  const rejected = expect(result).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
  mockSession = { ...mockSession, accountRevision: 3, sessionEpoch: 3 };
  pending.resolve(page([item()], true)); await rejected;
  expect(mockRpc).toHaveBeenCalledTimes(1); expect(publicProfile).not.toHaveBeenCalled();
});

it('allows token refresh within the same account revision and preserves the raw next-page cursor', async () => {
  const pending = deferred<ReturnType<typeof page>>(), abort = new AbortController();
  const firstAbort = jest.fn(() => pending.promise), secondAbort = jest.fn(() => Promise.resolve(page([item(99)])));
  mockRpc.mockReturnValueOnce({ abortSignal: firstAbort }).mockReturnValueOnce({ abortSignal: secondAbort });
  const result = supabaseIzvor.otvorenePrilike({ signal: abort.signal });
  mockSession = { ...mockSession, sessionEpoch: 2 }; pending.resolve(page([item()], true));
  expect((await result).map(row => row.id)).toEqual([id(100), id(99)]);
  expect(mockRpc).toHaveBeenNthCalledWith(2, 'rpc_list_open_tasks_v3', {
    p_bbox: null, p_filters: {}, p_limit: 200, p_before_at: '2026-09-18T10:00:00.123456Z', p_before_id: id(100),
  });
  expect(firstAbort).toHaveBeenCalledWith(abort.signal); expect(secondAbort).toHaveBeenCalledWith(abort.signal);
});

it('retires queued profile hydration and does not publish a partial collection on abort', async () => {
  const abort = new AbortController(), pending = deferred<null>();
  mockRpc.mockResolvedValue(page(Array.from({ length: 8 }, (_, n) => item(100 - n, `author-${n}`))));
  publicProfile.mockReturnValue(pending.promise);
  const result = supabaseIzvor.otvorenePrilike({ signal: abort.signal });
  const rejected = expect(result).rejects.toThrow('OPPORTUNITIES_READ_ABORTED');
  await flush(); expect(publicProfile).toHaveBeenCalledTimes(4);
  abort.abort(); await rejected;
  expect(publicProfile.mock.calls.every(([, signal]) => signal.aborted)).toBe(true);
  pending.resolve(null); await flush();
  expect(publicProfile).toHaveBeenCalledTimes(4); expect(mockRpc).toHaveBeenCalledTimes(1);
});

it.each(['stop', 'forget'] as const)('stops pages after resource %s and does not disturb a fresh resource read', async boundary => {
  const old = deferred<ReturnType<typeof page>>(), fresh = deferred<ReturnType<typeof page>>();
  const signals: AbortSignal[] = [];
  mockRpc.mockImplementationOnce(() => ({ abortSignal: (signal: AbortSignal) => { signals.push(signal); return old.promise; } }))
    .mockImplementationOnce(() => ({ abortSignal: (signal: AbortSignal) => { signals.push(signal); return fresh.promise; } }));
  const model = createFocusedResource(signal => supabaseIzvor.otvorenePrilike({ signal }), () => true, { coalesce: true });
  model.start(); void model.refresh(); model[boundary](); model.start();
  expect(signals[0].aborted).toBe(true); expect(signals[1].aborted).toBe(false);
  old.resolve(page([item()], true)); await flush();
  expect(mockRpc).toHaveBeenCalledTimes(2); expect(signals[1].aborted).toBe(false);
  expect(publicProfile).not.toHaveBeenCalled(); expect(model.snapshot().data).toBeNull();
  fresh.resolve(page([item(99)])); await flush();
  expect(model.snapshot().data?.map(row => row.id)).toEqual([id(99)]); expect(model.snapshot().error).toBe(false);
  expect(mockRpc).toHaveBeenCalledTimes(2); model.stop();
});

it('aborts a reader abandoned by the route timeout and allows a fresh retry before the old response arrives', async () => {
  jest.useFakeTimers();
  const old = deferred<ReturnType<typeof page>>(), fresh = deferred<ReturnType<typeof page>>();
  const signals: AbortSignal[] = [];
  mockRpc.mockImplementationOnce(() => ({ abortSignal: (signal: AbortSignal) => { signals.push(signal); return old.promise; } }))
    .mockImplementationOnce(() => ({ abortSignal: (signal: AbortSignal) => { signals.push(signal); return fresh.promise; } }));
  const model = createFocusedResource(async signal => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([supabaseIzvor.otvorenePrilike({ signal }), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('MARKETPLACE_READ_TIMEOUT')), 15_000);
      })]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }, () => true, { coalesce: true });
  model.start(); await jest.advanceTimersByTimeAsync(15_000);
  expect(model.snapshot().error).toBe(true); expect(signals[0].aborted).toBe(true);
  const retry = model.refresh(); expect(signals[1].aborted).toBe(false);
  old.resolve(page([item()], true)); await flush();
  expect(mockRpc).toHaveBeenCalledTimes(2); expect(publicProfile).not.toHaveBeenCalled();
  expect(signals[1].aborted).toBe(false);
  fresh.resolve(page([])); await retry;
  expect(model.snapshot()).toMatchObject({ data: [], error: false, loading: false });
  expect(jest.getTimerCount()).toBe(0); model.stop();
});

it('stops relation batching after abort and never returns the already-read partial overlay', async () => {
  const pending = deferred<ReturnType<typeof relations>>(), abort = new AbortController();
  const abortSignal = jest.fn(() => pending.promise); mockRpc.mockReturnValue({ abortSignal });
  const ids = Array.from({ length: 201 }, (_, n) => id(n));
  const result = supabaseIzvor.odnosiPremaZadacima(ids, { signal: abort.signal });
  const rejected = expect(result).rejects.toThrow('TASK_RELATIONS_READ_ABORTED');
  expect(mockRpc).toHaveBeenCalledWith('rpc_get_my_task_relations', { p_need_ids: ids.slice(0, 100) });
  expect(abortSignal).toHaveBeenCalledWith(abort.signal);
  abort.abort(); pending.resolve(relations(ids[0])); await rejected;
  expect(mockRpc).toHaveBeenCalledTimes(1);
  mockRpc.mockResolvedValue(relations(id(300)));
  const fresh = await supabaseIzvor.odnosiPremaZadacima([id(300)], { signal: new AbortController().signal });
  expect(fresh.relation(id(300))).toEqual({ kind: 'OWNER' }); expect(fresh.relation(ids[0])).toEqual({ kind: 'UNKNOWN' });
});

it('refuses another relation batch after an A-B-A account revision even without an optional signal', async () => {
  const pending = deferred<ReturnType<typeof relations>>(); mockRpc.mockReturnValue(pending.promise);
  const result = supabaseIzvor.odnosiPremaZadacima(Array.from({ length: 101 }, (_, n) => id(n)));
  const rejected = expect(result).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
  mockSession = { ...mockSession, accountRevision: 3, sessionEpoch: 3 };
  pending.resolve(relations(id(0))); await rejected;
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
