import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockRead = jest.fn();
let mockAccount = 'owner', mockRevision = 1, mockFocused = true;
const mockListeners = new Set<(state: string) => void>();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return { currentState: 'active', addEventListener: (_name: string, callback: (state: string) => void) => {
      mockListeners.add(callback); return { remove: () => mockListeners.delete(callback) }; } };
    return Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => require('react').useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }),
  sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }) }));
jest.mock('../../data/workerExecutionModeClientService', () => ({ workerExecutionModeClientService: { read: (...args: unknown[]) => mockRead(...args) } }));
import { useWorkerExecutionModes } from '../useWorkerExecutionModes';

let tree: ReactTestRenderer, seen: ReturnType<typeof useWorkerExecutionModes>;
const remote = { workerProfileId: 'worker', confirmed: true, modes: ['REMOTE'], confirmedAt: '2026-10-18T12:24:03Z' };
function Probe({ read = 0, profileId = 'worker' }: { read?: number; profileId?: string }) { seen = useWorkerExecutionModes(profileId, read); return null; }
async function render(read = 0) { await act(async () => { tree = create(<Probe read={read} />); }); }
beforeEach(() => { mockRead.mockReset().mockResolvedValue(remote); mockAccount = 'owner'; mockRevision = 1; mockFocused = true; });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('uses owned receipt, with no write or inferred mode, and refreshes after profile readback', async () => {
  await render(); expect(seen.view).toEqual({ kind: 'confirmed', modes: ['REMOTE'] });
  expect(mockRead).toHaveBeenLastCalledWith('owner', 1);
  mockRead.mockResolvedValue({ ...remote, confirmed: false, modes: [], confirmedAt: null });
  await act(async () => { tree.update(<Probe read={1} />); });
  expect(seen.view).toEqual({ kind: 'unconfirmed' }); expect(mockRead).toHaveBeenCalledTimes(2);
});

it('rejects another profile receipt and makes read failures retryable without inventing a mode', async () => {
  mockRead.mockResolvedValue({ ...remote, workerProfileId: 'other' }); await render();
  expect(seen.view).toEqual({ kind: 'unavailable' });
  mockRead.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { seen.refresh(); }); expect(seen.view).toEqual({ kind: 'unavailable' });
  mockRead.mockResolvedValue(remote);
  await act(async () => { seen.refresh(); }); expect(seen.view).toEqual({ kind: 'confirmed', modes: ['REMOTE'] });
});

it('clears previous consent on blur and waits for a fresh read on return', async () => {
  await render(); mockFocused = false;
  await act(async () => { tree.update(<Probe />); }); expect(seen.view).toEqual({ kind: 'loading' });
  let resolve!: (value: unknown) => void;
  mockRead.mockReturnValue(new Promise(done => { resolve = done; })); mockFocused = true;
  await act(async () => { tree.update(<Probe />); }); expect(seen.view).toEqual({ kind: 'loading' });
  await act(async () => { resolve(remote); }); expect(seen.view).toEqual({ kind: 'confirmed', modes: ['REMOTE'] });
});

it('does not publish a late receipt after the account incarnation changes', async () => {
  let resolve!: (value: unknown) => void;
  mockRead.mockReturnValueOnce(new Promise(done => { resolve = done; })); await render();
  mockRevision = 2; mockRead.mockResolvedValue({ ...remote, confirmed: false, modes: [] });
  await act(async () => { tree.update(<Probe />); });
  await act(async () => { resolve(remote); });
  expect(seen.view).toEqual({ kind: 'unconfirmed' });
});

it('retires a background read and reads again when foreground returns', async () => {
  await render();
  await act(async () => { for (const callback of mockListeners) callback('background'); });
  expect(seen.view).toEqual({ kind: 'loading' });
  mockRead.mockResolvedValue({ ...remote, modes: ['ON_SITE', 'REMOTE'] });
  await act(async () => { for (const callback of mockListeners) callback('active'); });
  expect(seen.view).toEqual({ kind: 'confirmed', modes: ['ON_SITE', 'REMOTE'] });
});
