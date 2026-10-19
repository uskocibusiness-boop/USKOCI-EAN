import { nativePushDevice } from '../nativePushDevice';
const mockPermissions = jest.fn(), mockRequest = jest.fn(), mockToken = jest.fn(), mockChannel = jest.fn();
let mockPlatform = 'android', mockDevice = true;
const mockConstants = { easConfig: { projectId: '11111111-1111-4111-8111-111111111111' } };
jest.mock('expo-notifications', () => ({ getPermissionsAsync: () => mockPermissions(), requestPermissionsAsync: () => mockRequest(), getExpoPushTokenAsync: (args: unknown) => mockToken(args), setNotificationChannelAsync: (...args: unknown[]) => mockChannel(...args), AndroidImportance: { DEFAULT: 3 }, AndroidNotificationVisibility: { PRIVATE: 0 } }));
jest.mock('expo-device', () => ({ get isDevice() { return mockDevice; } }));
jest.mock('expo-constants', () => ({ __esModule: true, get default() { return mockConstants; } }));
jest.mock('react-native', () => {
 const native = jest.requireActual('react-native');
 return new Proxy(native, { get(target, key) {
  return key === 'Platform' ? { ...native.Platform, OS: mockPlatform } : Reflect.get(target, key);
 } });
});
beforeEach(() => { jest.resetAllMocks(); mockPlatform = 'android'; mockDevice = true; mockChannel.mockResolvedValue({}); mockPermissions.mockResolvedValue({ granted: false, canAskAgain: true }); mockRequest.mockResolvedValue({ granted: true, canAskAgain: true }); mockToken.mockResolvedValue({ type: 'expo', data: 'ExpoPushToken[synthetic]' }); });
it('reading settings never asks for permission or a token without consent', async () => {
 expect(await nativePushDevice(false, () => true)).toEqual({ kind: 'PERMISSION_REQUIRED' }); expect(mockRequest).not.toHaveBeenCalled(); expect(mockToken).not.toHaveBeenCalled();
});
it('explicit enable creates Android channel before permission and captures existing project', async () => {
 expect(await nativePushDevice(true, () => true)).toEqual({ kind: 'READY', token: 'ExpoPushToken[synthetic]', platform: 'ANDROID' });
 expect(mockChannel.mock.invocationCallOrder[0]).toBeLessThan(mockRequest.mock.invocationCallOrder[0]); expect(mockToken).toHaveBeenCalledWith({ projectId: mockConstants.easConfig.projectId });
});
it('permanent OS denial does not loop prompts or acquire a token', async () => {
 mockPermissions.mockResolvedValue({ granted: false, canAskAgain: false }); expect(await nativePushDevice(true, () => true)).toEqual({ kind: 'DENIED' }); expect(mockRequest).not.toHaveBeenCalled(); expect(mockToken).not.toHaveBeenCalled();
});
it.each(['web', 'windows'])('unsupported %s never touches push APIs', async value => { mockPlatform = value; expect(await nativePushDevice(true, () => true)).toEqual({ kind: 'UNSUPPORTED' }); expect(mockPermissions).not.toHaveBeenCalled(); });
it('physical device prerequisite is explicit', async () => { mockDevice = false; expect(await nativePushDevice(true, () => true)).toEqual({ kind: 'UNSUPPORTED' }); expect(mockChannel).not.toHaveBeenCalled(); });
it('late permission response after blur/account change cannot acquire token', async () => {
 let current = true; mockRequest.mockImplementation(async () => { current = false; return { granted: true }; });
 await expect(nativePushDevice(true, () => current)).rejects.toThrow('PUSH_SCOPE_CHANGED'); expect(mockToken).not.toHaveBeenCalled();
});
it('malformed provider token is never eligible for registration', async () => { mockPermissions.mockResolvedValue({ granted: true }); mockToken.mockResolvedValue({ type: 'expo', data: 'https://private-token' }); await expect(nativePushDevice(false, () => true)).rejects.toThrow('PUSH_TOKEN_UNAVAILABLE'); });
it('a build whose push provider cannot issue a token reads as not configured, so the other settings still load', async () => {
 mockPermissions.mockResolvedValue({ granted: true }); mockToken.mockRejectedValue(new Error('FirebaseApp is not initialized'));
 expect(await nativePushDevice(false, () => true)).toEqual({ kind: 'UNCONFIGURED' });
});
it('a provider failure after the scope changed still reports the changed scope', async () => {
 let current = true; mockPermissions.mockResolvedValue({ granted: true }); mockToken.mockImplementation(async () => { current = false; throw new Error('late'); });
 await expect(nativePushDevice(false, () => current)).rejects.toThrow('PUSH_SCOPE_CHANGED');
});
it('only the OS dialog pauses the caller deadline, and token work resumes it first', async () => {
 let answer!: (value: unknown) => void;
 mockRequest.mockReturnValue(new Promise(resolve => { answer = resolve; }));
 const waiting = jest.fn();
 const result = nativePushDevice(true, () => true, waiting);
 for (let i = 0; i < 8; i++) await Promise.resolve();
 expect(waiting.mock.calls).toEqual([[true]]); expect(mockToken).not.toHaveBeenCalled();
 answer({ granted: true, canAskAgain: true });
 await expect(result).resolves.toMatchObject({ kind: 'READY' });
 expect(waiting.mock.calls).toEqual([[true], [false]]);
 expect(waiting.mock.invocationCallOrder[1]).toBeLessThan(mockToken.mock.invocationCallOrder[0]);
});
it('a rejected permission dialog releases the pause and never obtains a token', async () => {
 mockRequest.mockRejectedValue(Error('native dialog unavailable')); const waiting = jest.fn();
 await expect(nativePushDevice(true, () => true, waiting)).rejects.toThrow('native dialog unavailable');
 expect(waiting.mock.calls).toEqual([[true], [false]]); expect(mockToken).not.toHaveBeenCalled();
});
it('scope revoked during the OS dialog releases the pause but cannot obtain a token', async () => {
 let current = true; const waiting = jest.fn();
 mockRequest.mockImplementation(async () => { current = false; return { granted: true }; });
 await expect(nativePushDevice(true, () => current, waiting)).rejects.toThrow('PUSH_SCOPE_CHANGED');
 expect(waiting.mock.calls).toEqual([[true], [false]]); expect(mockToken).not.toHaveBeenCalled();
});
it('an already granted read never enters a human-wait pause', async () => {
 mockPermissions.mockResolvedValue({ granted: true }); const waiting = jest.fn();
 await expect(nativePushDevice(true, () => true, waiting)).resolves.toMatchObject({ kind: 'READY' });
 expect(waiting).not.toHaveBeenCalled(); expect(mockRequest).not.toHaveBeenCalled();
});
