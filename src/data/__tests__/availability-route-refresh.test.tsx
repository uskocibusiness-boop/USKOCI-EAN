import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockSession: { user: { id: string } | null; accountRevision: number } = { user: { id: 'owner-a' }, accountRevision: 1 };
let mockFocused = true;
const mockReplace = jest.fn(), mockRead = jest.fn(), mockSave = jest.fn();
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('expo-router', () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../ui/workerProfile/WorkerProfilePresentation', () => ({ WorkerProfileFrame: 'Frame' }));
jest.mock('../../ui/system/StateView', () => ({ StateView: 'StateView' }));
jest.mock('../workerAvailabilityClientService', () => ({ workerAvailabilityClientService: { read: mockRead, save: mockSave } }));
jest.mock('../locationClientService', () => ({ workerLocationClientService: { read: mockRead, save: mockSave } }));
jest.mock('../../ui/location/CountryField', () => ({ CountryField: 'CountryField', useCountryOptions: jest.fn() }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'Map' }));
jest.mock('../../ui/location/WorkerAreaSearch', () => ({ WorkerAreaSearch: 'Search' }));
jest.mock('../../hooks/useWorkerExecutionModes', () => ({ useWorkerExecutionModes: jest.fn() }));
import Availability from '../../app/(app)/profil/dostupnost';
import Location from '../../app/(app)/profil/lokacija';
import { takeAiCorrection } from '../aiCorrectionIntent';
let tree: ReactTestRenderer | undefined;
const conversation = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
beforeEach(() => { jest.clearAllMocks(); mockFocused = true; mockSession = { user: { id: 'owner-a' }, accountRevision: 1 }; });
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; });

it.each([[Availability, 'worker.time'], [Location, 'worker.area']] as const)(
  'compatibility entry %p opens %s without a form, read or write', async (Screen, target) => {
    await act(async () => { tree = create(<Screen />); });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    const route = mockReplace.mock.calls[0][0];
    expect(route).toEqual({ pathname: '/profil/razgovor', params: { aiCorrection: expect.any(String) } });
    expect(takeAiCorrection(route.params.aiCorrection, { accountId: 'owner-a', accountRevision: 1 }, 'worker', conversation)?.target).toBe(target);
    expect(mockRead).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
  });

it('waits for focus and binds the topic to the current account generation', async () => {
  mockFocused = false; await act(async () => { tree = create(<Availability />); });
  expect(mockReplace).not.toHaveBeenCalled();
  mockFocused = true; await act(async () => tree!.update(<Availability />));
  const token = mockReplace.mock.calls[0][0].params.aiCorrection;
  mockSession = { user: { id: 'owner-a' }, accountRevision: 2 };
  expect(takeAiCorrection(token, { accountId: 'owner-a', accountRevision: 2 }, 'worker', conversation)).toBeNull();
  expect(mockSave).not.toHaveBeenCalled();
});

it('creates no topic for a signed-out account', async () => {
  mockSession = { user: null, accountRevision: 2 };
  await act(async () => { tree = create(<Availability />); });
  expect(mockReplace).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
});
