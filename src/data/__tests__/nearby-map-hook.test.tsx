import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockPermission = jest.fn(), mockServices = jest.fn(), mockWatch = jest.fn(), mockRemove = jest.fn();
const mockLoad = jest.fn();
let mockPlatform = 'android', mockAppState = 'active';
const mockListeners = new Set<(state: string) => void>();
const mockSettings = jest.fn(), mockIntent = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  const appState = { get currentState() { return mockAppState; }, addEventListener: (_name: string, next: (state: string) => void) => {
    mockListeners.add(next); return { remove: () => mockListeners.delete(next) };
  } };
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return appState;
    if (key === 'Platform') return { get OS() { return mockPlatform; } };
    if (key === 'Linking') return { openSettings: () => mockSettings(), sendIntent: (...args: unknown[]) => mockIntent(...args) };
    return Reflect.get(target, key);
  } });
});
// Jest's CommonJS runtime cannot execute import() without experimental VM modules; only the native loader is replaced.
jest.mock('../../ui/v2/discovery/nearbyLocation', () => ({ loadNearbyLocation: () => mockLoad() }));
import { useNearbyMap } from '../../ui/v2/discovery/useNearbyMap';
let hook: ReturnType<typeof useNearbyMap>, tree: ReactTestRenderer;
let scope = 'account-a:1', focused = true;
let nextFix: (fix: { timestamp: number; coords: { latitude: number; longitude: number } }) => void;
const fix = () => ({ timestamp: Date.now(), coords: { latitude: 44.8, longitude: 20.4 } });
const Harness = () => { hook = useNearbyMap(scope, focused); return null; };
const render = async () => act(async () => { tree = create(<Harness />); });
const update = async () => act(async () => tree.update(<Harness />));
const tap = async () => act(async () => { hook.start(); });
const app = async (state: string) => act(async () => { mockAppState = state; for (const listener of mockListeners) listener(state); });
beforeEach(() => {
  jest.useFakeTimers(); jest.spyOn(console, 'error').mockImplementation(() => {}); jest.clearAllMocks();
  scope = 'account-a:1'; focused = true; mockPlatform = 'android'; mockAppState = 'active';
  mockPermission.mockResolvedValue({ granted: true }); mockServices.mockResolvedValue(true);
  mockWatch.mockImplementation(async (_options, next) => { nextFix = next; return { remove: mockRemove }; });
  mockLoad.mockResolvedValue({ Accuracy: { Balanced: 3 }, getForegroundPermissionsAsync: async () => ({ granted: false }), requestForegroundPermissionsAsync: mockPermission,
    hasServicesEnabledAsync: mockServices, watchPositionAsync: mockWatch });
  mockSettings.mockResolvedValue(undefined); mockIntent.mockResolvedValue(undefined);
});
afterEach(async () => { await act(async () => tree?.unmount()); expect(mockListeners.size).toBe(0); jest.useRealTimers(); jest.restoreAllMocks(); });
test('mounting is passive; a single fix becomes only a local camera target', async () => {
  await render(); expect(mockLoad).not.toHaveBeenCalled(); expect(mockPermission).not.toHaveBeenCalled(); expect(mockWatch).not.toHaveBeenCalled(); expect(hook.target).toBeNull();
  await tap(); await act(async () => nextFix(fix()));
  expect(hook.target).toEqual({ key: 1, center: [20.4, 44.8] }); expect(hook.busy).toBe(false); expect(mockRemove).toHaveBeenCalledTimes(1);
});
test('consumption retires only its exact request and an old acknowledgment cannot discard a newer target', async () => {
  await render(); await tap(); await act(async () => nextFix(fix()));
  const first = hook.target!;
  await act(async () => hook.consume(first.key)); expect(hook.target).toBeNull(); expect(hook.mapRequested).toBe(true);
  await tap(); await act(async () => nextFix(fix())); const second = hook.target!;
  expect(second.key).not.toBe(first.key);
  await act(async () => hook.consume(first.key)); expect(hook.target).toEqual(second);
  await act(async () => hook.consume(second.key)); expect(hook.target).toBeNull();
});
test.each(['blur', 'account', 'background', 'unmount'])('%s removes capture and rejects its late result', async reason => {
  await render(); await tap(); const late = nextFix;
  if (reason === 'blur') { focused = false; await update(); }
  if (reason === 'account') { scope = 'account-b:2'; await update(); }
  if (reason === 'background') await app('background');
  if (reason === 'unmount') await act(async () => tree.unmount());
  await act(async () => late(fix()));
  expect(mockRemove).toHaveBeenCalledTimes(1); expect(hook.target).toBeNull();
  // The pure controller suite counts its deadline exactly; React's renderer also queues timers in this harness.
  await act(async () => { jest.advanceTimersByTime(30_001); });
  expect(mockRemove).toHaveBeenCalledTimes(1); expect(hook.target).toBeNull();
});
test('background retirement does not automatically restart on return; permission-dialog inactive is allowed', async () => {
  await render(); await tap(); await app('inactive'); expect(mockRemove).not.toHaveBeenCalled();
  await app('background'); await app('active'); expect(mockWatch).toHaveBeenCalledTimes(1);
  await tap(); expect(mockWatch).toHaveBeenCalledTimes(2);
});
test('an already centered target is forgotten across account incarnations and background', async () => {
  await render(); await tap(); await act(async () => nextFix(fix())); expect(hook.target).not.toBeNull();
  scope = 'account-a:2'; await update(); expect(hook.target).toBeNull();
  await tap(); await act(async () => nextFix(fix())); await app('background'); expect(hook.target).toBeNull();
});
test('web reports unsupported without permission or native capture', async () => {
  mockPlatform = 'web'; await render(); await tap(); expect(hook.status).toBe('unsupported');
  expect(mockPermission).not.toHaveBeenCalled(); expect(mockWatch).not.toHaveBeenCalled();
});
test.each(['denied', 'services-off'])('%s has an explicit settings action, never an automatic settings launch', async reason => {
  if (reason === 'denied') mockPermission.mockResolvedValue({ granted: false }); else mockServices.mockResolvedValue(false);
  await render(); await tap(); expect(hook.status).toBe(reason); expect(hook.settings).toBeDefined();
  expect(mockSettings).not.toHaveBeenCalled(); expect(mockIntent).not.toHaveBeenCalled();
  await act(async () => hook.settings?.());
  if (reason === 'denied') expect(mockSettings).toHaveBeenCalledTimes(1);
  else expect(mockIntent).toHaveBeenCalledWith('android.settings.LOCATION_SOURCE_SETTINGS');
  expect(mockWatch).not.toHaveBeenCalled();
});
