// Voice messages B2-a (2026-10-01): a local logout removes the device's voice files, and only in a build that carries the voice flag.
import { authClientService } from '../authClientService';
const mockRevokePush = jest.fn(), mockPurge = jest.fn(), mockFactory = jest.fn();
jest.mock('../pushDeviceClientService', () => ({ revokePushBeforeLogout: (scope: unknown) => mockRevokePush(scope) }));
const mockAuth = { getSession: jest.fn(), signOut: jest.fn() };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ auth: mockAuth }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: { id: 'account-a' }, accountRevision: 1 }) }));
jest.mock('../../features/voiceMessages/nativeVoiceFiles', () => { mockFactory(); return { purgeVoiceFiles: () => mockPurge() }; });
const mockRemoveItem = jest.fn(async (_key: string) => undefined);
jest.mock('@react-native-async-storage/async-storage', () => ({ default: { getAllKeys: async () => [], multiRemove: async () => undefined, removeItem: (key: string) => mockRemoveItem(key) } }));

const actor = { accountId: 'account-a', accountRevision: 1 };
const saved = process.env.EXPO_PUBLIC_VOICE_MESSAGES;
beforeEach(() => {
  jest.clearAllMocks(); mockRevokePush.mockResolvedValue(true); mockPurge.mockResolvedValue(undefined);
  mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'account-a' } } }, error: null }); mockAuth.signOut.mockResolvedValue({ error: null });
});
afterAll(() => { if (saved === undefined) delete process.env.EXPO_PUBLIC_VOICE_MESSAGES; else process.env.EXPO_PUBLIC_VOICE_MESSAGES = saved; });

it('a build without the voice flag never loads the file module', async () => {
  delete process.env.EXPO_PUBLIC_VOICE_MESSAGES;
  await expect(authClientService.signOutLocal(actor)).resolves.toBeUndefined();
  expect(mockAuth.signOut).toHaveBeenCalledTimes(1); expect(mockFactory).not.toHaveBeenCalled(); expect(mockPurge).not.toHaveBeenCalled();
});
it('a build with the voice flag purges the voice files after the Auth logout', async () => {
  process.env.EXPO_PUBLIC_VOICE_MESSAGES = '1';
  await expect(authClientService.signOutLocal(actor)).resolves.toBeUndefined();
  expect(mockPurge).toHaveBeenCalledTimes(1); expect(mockAuth.signOut.mock.invocationCallOrder[0]).toBeLessThan(mockPurge.mock.invocationCallOrder[0]);
});
// The owner, 8 Oct 2026: the recent searches of Zadaci go with the session ("Samo napred").
it('forgets this account\'s recent searches of Zadaci after the Auth logout', async () => {
  delete process.env.EXPO_PUBLIC_VOICE_MESSAGES;
  await expect(authClientService.signOutLocal(actor)).resolves.toBeUndefined();
  expect(mockRemoveItem).toHaveBeenCalledWith('uskoci.zadaci.recent.v1.account-a');
  expect(mockAuth.signOut.mock.invocationCallOrder[0]).toBeLessThan(mockRemoveItem.mock.invocationCallOrder[0]);
});
it('a purge that fails never fails a logout that already happened', async () => {
  process.env.EXPO_PUBLIC_VOICE_MESSAGES = '1'; mockPurge.mockRejectedValue(new Error('DISK'));
  await expect(authClientService.signOutLocal(actor)).resolves.toBeUndefined();
  expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
});
