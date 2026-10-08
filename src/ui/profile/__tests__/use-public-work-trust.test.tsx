import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PublicWorkTrust } from '../../../data/workTrustClientService';

/**
 * The trust block of one worker profile for the public profile sheet (PROFILE-TRUST, R30). The sheet never waits for it: the hook answers `null`
 * while it reads, when the read failed and when the server says there is nothing here; it never returns what was read for another account or
 * another profile, and it reads nothing for a profile it was not given.
 */
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const P1 = '30000000-0000-4000-8000-000000000001', P2 = '30000000-0000-4000-8000-000000000002';
let mockUser: { id: string } | null = { id: A }, mockRevision = 1;
const mockPublicTrust = jest.fn();
jest.mock('../../../store/sesija', () => ({ useSesija: () => ({ user: mockUser, accountRevision: mockRevision }) }));
jest.mock('../../../data/workTrustClientService', () => ({ workTrustClientService: { publicTrust: (...args: unknown[]) => mockPublicTrust(...args) } }));
import { usePublicWorkTrust } from '../usePublicWorkTrust';

const trust = (profileId: string, patch: Partial<PublicWorkTrust> = {}): PublicWorkTrust => ({ profileId, self: false, visibility: 'PUBLIC', completedCount: 7, agreedCount: 9,
  reliabilityPercent: 88, reliabilityState: 'AVAILABLE', reliabilityMinimum: 5, memberSince: '2026-03-01', ...patch });
const answer = (profileId: string, patch: Partial<PublicWorkTrust> = {}) => ({ ok: true, podatak: { trust: trust(profileId, patch) } });
const deferred = <V,>() => { let resolve!: (value: V) => void; const promise = new Promise<V>(done => { resolve = done; }); return { promise, resolve }; };

let seen: PublicWorkTrust | null = null;
function Probe({ profileId }: { profileId: string | null | undefined }) { seen = usePublicWorkTrust(profileId); return null; }
let tree: ReactTestRenderer;
const draw = async (profileId: string | null | undefined) => { await act(async () => { tree = create(<Probe profileId={profileId} />); }); };
const redraw = async (profileId: string | null | undefined) => { await act(async () => tree.update(<Probe profileId={profileId} />)); };
beforeEach(() => { jest.clearAllMocks(); mockPublicTrust.mockReset(); mockUser = { id: A }; mockRevision = 1; seen = null; });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('asks the service once for the profile, as the signed-in account, and returns what the server answered', async () => {
  mockPublicTrust.mockResolvedValue(answer(P1));
  await draw(P1);
  expect(mockPublicTrust.mock.calls).toEqual([[P1, { accountId: A, accountRevision: 1 }]]);
  expect(seen).toEqual(trust(P1));
});

it('answers null while it reads, so the sheet is never made to wait', async () => {
  const pending = deferred<unknown>();
  mockPublicTrust.mockReturnValue(pending.promise);
  await draw(P1);
  expect(seen).toBeNull();
  await act(async () => pending.resolve(answer(P1)));
  expect(seen).toEqual(trust(P1));
});

it('answers null for a failed read, a read that throws, and the server\'s "nothing here", and none of them is an error state', async () => {
  mockPublicTrust.mockResolvedValue({ ok: false, kod: 'WORK_TRUST_READ_FAILED', poruka: 'x' });
  await draw(P1); expect(seen).toBeNull();
  await act(async () => tree.unmount());
  mockPublicTrust.mockRejectedValue(new Error('network'));
  await draw(P1); expect(seen).toBeNull();
  await act(async () => tree.unmount());
  mockPublicTrust.mockResolvedValue({ ok: true, podatak: { trust: null } });
  await draw(P1); expect(seen).toBeNull();
});

it('passes a HIDDEN block on as it is: the sheet draws nothing for it, and this hook decides nothing about who sees what', async () => {
  const hidden = trust(P1, { visibility: 'OWN_ONLY', agreedCount: null, reliabilityPercent: null, reliabilityState: 'HIDDEN', memberSince: null });
  mockPublicTrust.mockResolvedValue({ ok: true, podatak: { trust: hidden } });
  await draw(P1);
  expect(seen).toEqual(hidden);
});

it.each([[null], [undefined]])('reads nothing for a profile it was not given (%s)', async value => {
  await draw(value);
  expect(mockPublicTrust).not.toHaveBeenCalled(); expect(seen).toBeNull();
});

it('reads nothing when nobody is signed in', async () => {
  mockUser = null;
  await draw(P1);
  expect(mockPublicTrust).not.toHaveBeenCalled(); expect(seen).toBeNull();
});

it('never returns what was read for another profile: the new profile starts from nothing, and a late answer for the old one is thrown away', async () => {
  const late = deferred<unknown>();
  mockPublicTrust.mockReturnValueOnce(late.promise);
  await draw(P1);
  mockPublicTrust.mockResolvedValueOnce(answer(P2, { completedCount: 1, agreedCount: 1 }));
  await redraw(P2);
  expect(seen).toEqual(trust(P2, { completedCount: 1, agreedCount: 1 }));
  await act(async () => late.resolve(answer(P1)));
  expect(seen).toEqual(trust(P2, { completedCount: 1, agreedCount: 1 }));
  expect(mockPublicTrust.mock.calls.map(call => call[0])).toEqual([P1, P2]);
});

it('drops the block for a new profile at once, not after the new read: the first render of P2 never shows P1\'s figures', async () => {
  mockPublicTrust.mockResolvedValueOnce(answer(P1));
  await draw(P1);
  expect(seen).toEqual(trust(P1));
  const next = deferred<unknown>();
  mockPublicTrust.mockReturnValueOnce(next.promise);
  await redraw(P2);
  expect(seen).toBeNull();
});

it('never returns what was read for another account, and a late answer for the old account is thrown away', async () => {
  const late = deferred<unknown>();
  mockPublicTrust.mockReturnValueOnce(late.promise);
  await draw(P1);
  mockUser = { id: B }; mockRevision = 2;
  mockPublicTrust.mockResolvedValueOnce(answer(P1, { completedCount: 2, agreedCount: 2 }));
  await redraw(P1);
  expect(seen).toEqual(trust(P1, { completedCount: 2, agreedCount: 2 }));
  await act(async () => late.resolve(answer(P1)));
  expect(seen).toEqual(trust(P1, { completedCount: 2, agreedCount: 2 }));
  expect(mockPublicTrust.mock.calls.map(call => call[1])).toEqual([{ accountId: A, accountRevision: 1 }, { accountId: B, accountRevision: 2 }]);
});

it('does not set state after it was unmounted', async () => {
  const pending = deferred<unknown>();
  mockPublicTrust.mockReturnValue(pending.promise);
  const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await draw(P1);
  await act(async () => tree.unmount());
  await act(async () => pending.resolve(answer(P1)));
  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();
});
