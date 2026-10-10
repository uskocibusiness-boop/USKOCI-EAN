import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { MyWorkStats } from '../../../data/workTrustClientService';

const WORKER = '11111111-1111-4111-8111-111111111111';
const REQUESTER = '22222222-2222-4222-8222-222222222222';
let mockSession = { user: { id: 'account-a' }, accountRevision: 1 };
const mockMyStats = jest.fn(), mockPublic = jest.fn();
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('../../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../../data/workTrustClientService', () => ({ workTrustClientService: { myStats: (...args: unknown[]) => mockMyStats(...args) } }));
jest.mock('../../../data/publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: (...args: unknown[]) => mockPublic(...args) } }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'View') return 'View';
    if (key === 'AppState') return { currentState: 'active', addEventListener: () => ({ remove: jest.fn() }) };
    return Reflect.get(target, key);
  } });
});
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
import { ProfileWorkSummary } from '../ProfileWorkSummary';

const stats = (patch: Partial<MyWorkStats> = {}): MyWorkStats => ({ hasWorkerProfile: true, profileId: WORKER, profileStatus: 'DRAFT',
  applicationsSent: 0, agreementsMade: 0, agreementsCompleted: 0, agreementsActive: 0, cancelledByMe: 0, cancelledByRequester: 0,
  cancelledSideUnknown: 0, reliabilityPercent: null, reliabilityState: 'TOO_FEW', reliabilityMinimum: 5,
  memberSince: '2026-10-01', asOf: '2026-10-10T06:00:00Z', ...patch });
const ok = (value = stats()) => ({ ok: true, podatak: value });
const publicCount = (count: unknown = 3) => ({ profilId: REQUESTER, uloga: 'narucilac', poverenje: { zavrseniBroj: count } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
let tree: ReactTestRenderer;
const draw = async (requester: string | null = null, worker: string | null = WORKER) => {
  await act(async () => { tree = create(<ProfileWorkSummary requesterProfileId={requester} workerProfileId={worker} />); });
};
const text = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(x => typeof x === 'string'));
const refresh = () => tree.root.findAll(node => String(node.type) === 'Press').find(node => node.props.accessibilityLabel === 'Osveži pregled završenih Dogovora')!;
beforeEach(() => {
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 };
  mockMyStats.mockReset().mockResolvedValue(ok()); mockPublic.mockReset().mockResolvedValue(publicCount());
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('reads a real zero for a DRAFT worker without asking the ACTIVE-only public projection', async () => {
  await draw();
  expect(text()).toEqual(['0', 'završenih']);
  expect(mockMyStats.mock.calls).toEqual([[]]); expect(mockPublic).not.toHaveBeenCalled();
});

it('uses one PAUSED-worker response for completed and reliability, plus the requester count', async () => {
  mockMyStats.mockResolvedValue(ok(stats({ profileStatus: 'PAUSED', agreementsCompleted: 9, agreementsMade: 10,
    reliabilityState: 'AVAILABLE', reliabilityPercent: 90 })));
  await draw(REQUESTER);
  expect(text()).toEqual(['12', 'završenih', '90 %', 'dolazi kako je dogovoreno']);
  expect(mockMyStats).toHaveBeenCalledTimes(1);
  expect(mockPublic.mock.calls).toEqual([[REQUESTER, expect.any(AbortSignal)]]);
  // The two real cells are siblings in the figures row, without a new container.
  expect((tree.toJSON() as unknown[])).toHaveLength(2);
});

it('does not read an absent role or count the same profile twice', async () => {
  await draw(WORKER, WORKER); expect(text()).toEqual(['0', 'završenih']); expect(mockPublic).not.toHaveBeenCalled();
  await act(async () => tree.update(<ProfileWorkSummary requesterProfileId={REQUESTER} workerProfileId={null} />));
  expect(text()).toEqual(['3', 'završena']); expect(mockMyStats).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<ProfileWorkSummary requesterProfileId={null} workerProfileId={null} />));
  expect(tree.toJSON()).toBeNull(); expect(mockPublic).toHaveBeenCalledTimes(1);
});

it.each([
  ['profile mismatch', ok(stats({ profileId: REQUESTER }))],
  ['profile missing', ok(stats({ hasWorkerProfile: false, profileId: null }))],
  ['malformed receipt rejected by service', { ok: false, kod: 'WORK_STATS_READ_INVALID' }],
  ['network failure', { ok: false, kod: 'WORK_STATS_READ_FAILED' }],
])('never invents a zero or reliability for %s and retries one shared read', async (_reason, answer) => {
  mockMyStats.mockResolvedValueOnce(answer);
  await draw();
  expect(text()).toEqual(['Broj završenih trenutno nije dostupan.', 'Osveži']);
  await act(async () => refresh().props.onPress());
  expect(text()).toEqual(['0', 'završenih']); expect(mockMyStats).toHaveBeenCalledTimes(2);
});

it('keeps valid reliability available while the requester is slow or fails, without a partial total', async () => {
  const pending = deferred<unknown>(); mockPublic.mockReturnValue(pending.promise);
  mockMyStats.mockResolvedValue(ok(stats({ agreementsCompleted: 9, agreementsMade: 10, reliabilityPercent: 90, reliabilityState: 'AVAILABLE' })));
  await draw(REQUESTER);
  expect(text()).toEqual(['90 %', 'dolazi kako je dogovoreno']);
  await act(async () => pending.resolve(null));
  expect(text()).toEqual(['Broj završenih trenutno nije dostupan.', 'Osveži', '90 %', 'dolazi kako je dogovoreno']);
  mockPublic.mockResolvedValue(publicCount());
  await act(async () => refresh().props.onPress());
  expect(text()).toEqual(['12', 'završenih', '90 %', 'dolazi kako je dogovoreno']);
  expect(mockMyStats).toHaveBeenCalledTimes(2); expect(mockPublic).toHaveBeenCalledTimes(2);
});

it.each([
  null, publicCount(-1), publicCount(1.5), publicCount('3'), { ...publicCount(), profilId: WORKER }, { ...publicCount(), uloga: 'uskocer' },
])('retains strict requester ownership/count validation for %j', async answer => {
  mockPublic.mockResolvedValue(answer); await draw(REQUESTER, null);
  expect(text()).toEqual(['Broj završenih trenutno nije dostupan.', 'Osveži']); expect(mockMyStats).not.toHaveBeenCalled();
});

it.each(['account', 'revision', 'profile'] as const)('rejects the late old worker after a %s change using the actual focused resource', async change => {
  const old = deferred<unknown>(), current = deferred<unknown>();
  mockMyStats.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  await draw();
  if (change === 'account') mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  if (change === 'revision') mockSession = { ...mockSession, accountRevision: 2 };
  const newProfile = change === 'profile' ? REQUESTER : WORKER;
  await act(async () => tree.update(<ProfileWorkSummary requesterProfileId={null} workerProfileId={newProfile} />));
  await act(async () => old.resolve(ok(stats({ agreementsCompleted: 99, agreementsMade: 100, cancelledByMe: 1, reliabilityState: 'AVAILABLE', reliabilityPercent: 99 }))));
  expect(text()).toEqual([]);
  await act(async () => current.resolve(ok(stats({ profileId: newProfile, agreementsCompleted: 2, agreementsMade: 2 }))));
  expect(text()).toEqual(['2', 'završena']); expect(mockMyStats).toHaveBeenCalledTimes(2);
});
