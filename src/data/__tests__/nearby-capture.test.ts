import { createNearbyCapture, NEARBY_TIMEOUT_MS, type NearbyLocationAdapter } from '../../ui/v2/discovery/nearbyCapture';

const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
let current = true;
let receive: Parameters<NearbyLocationAdapter['watchPositionAsync']>[1];
let fail: Parameters<NearbyLocationAdapter['watchPositionAsync']>[2];
const remove = jest.fn(), onPoint = jest.fn(), onStatus = jest.fn();
const readPermission = jest.fn(), request = jest.fn(), services = jest.fn(), watch = jest.fn(), load = jest.fn();
const fix = (timestamp = Date.now()) => ({ timestamp, coords: { latitude: 44.812345, longitude: 20.412345 } });
let capture: ReturnType<typeof createNearbyCapture>;
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); current = true;
  readPermission.mockResolvedValue({ granted: false }); request.mockResolvedValue({ granted: true }); services.mockResolvedValue(true);
  watch.mockImplementation(async (_options, next, error) => { receive = next; fail = error; return { remove }; });
  load.mockResolvedValue({ Accuracy: { Balanced: 3 }, getForegroundPermissionsAsync: readPermission, requestForegroundPermissionsAsync: request,
    hasServicesEnabledAsync: services, watchPositionAsync: watch });
  capture = createNearbyCapture({ load, owns: () => current, onPoint, onStatus });
});
afterEach(() => { capture.cancel(); jest.useRealTimers(); });

test('mounting has no native effect; an explicit tap alone imports, asks foreground permission, and starts one removable watch', async () => {
  expect(load).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled(); expect(watch).not.toHaveBeenCalled();
  expect(capture.start()).toBe(true); expect(capture.start()).toBe(false); await flush();
  expect(load).toHaveBeenCalledTimes(1); expect(request).toHaveBeenCalledTimes(1); expect(watch).toHaveBeenCalledTimes(1);
  expect(watch.mock.calls[0][0]).toEqual({ accuracy: 3, distanceInterval: 0, timeInterval: 1_000, mayShowUserSettingsDialog: false });
  receive(fix()); receive(fix());
  expect(onPoint.mock.calls).toEqual([[{ latitude: 44.812345, longitude: 20.412345 }]]);
  expect(remove).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
  expect(onStatus.mock.calls).toEqual([['locating'], ['idle']]);
});
test('cached, malformed and future readings are ignored; a fresh zero coordinate is valid', async () => {
  capture.start(); await flush();
  receive(fix(Date.now() - 1)); receive(fix(Date.now() + 2_000));
  receive({ ...fix(), coords: { latitude: NaN, longitude: 0 } });
  receive({ ...fix(), coords: { latitude: 91, longitude: 181 } });
  expect(onPoint).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  receive({ ...fix(), coords: { latitude: 0, longitude: 0 } });
  expect(onPoint).toHaveBeenCalledWith({ latitude: 0, longitude: 0 }); expect(remove).toHaveBeenCalledTimes(1);
});
test.each(['load', 'permission-read', 'permission', 'services', 'watch'])('cancellation while %s is pending ignores late native completion', async stage => {
  const permission = deferred<{ granted: boolean }>(), enabled = deferred<boolean>(), subscription = deferred<{ remove: () => void }>();
  const loaded = deferred<NearbyLocationAdapter>();
  if (stage === 'load') load.mockReturnValue(loaded.promise);
  if (stage === 'permission-read') readPermission.mockReturnValue(permission.promise);
  if (stage === 'permission') request.mockReturnValue(permission.promise);
  if (stage === 'services') services.mockReturnValue(enabled.promise);
  if (stage === 'watch') watch.mockImplementation((_options, next, error) => { receive = next; fail = error; return subscription.promise; });
  capture.start(); await flush(); capture.cancel(); current = false;
  loaded.resolve({ Accuracy: { Balanced: 3 }, getForegroundPermissionsAsync: readPermission, requestForegroundPermissionsAsync: request, hasServicesEnabledAsync: services, watchPositionAsync: watch });
  permission.resolve({ granted: true }); enabled.resolve(true); subscription.resolve({ remove }); await flush();
  if (stage === 'watch') { receive(fix()); expect(remove).toHaveBeenCalledTimes(1); }
  else expect(watch).not.toHaveBeenCalled();
  expect(onPoint).not.toHaveBeenCalled(); expect(onStatus.mock.calls).toEqual([['locating']]); expect(jest.getTimerCount()).toBe(0);
});
test('timeout removes the watch, rejects late fixes, and a subsequent tap gets its own attempt', async () => {
  capture.start(); await flush(); const old = receive;
  jest.advanceTimersByTime(NEARBY_TIMEOUT_MS); expect(remove).toHaveBeenCalledTimes(1);
  expect(onStatus).toHaveBeenLastCalledWith('timeout'); old(fix()); expect(onPoint).not.toHaveBeenCalled();
  capture.start(); await flush(); old(fix()); expect(onPoint).not.toHaveBeenCalled();
  receive(fix()); expect(onPoint).toHaveBeenCalledTimes(1); expect(remove).toHaveBeenCalledTimes(2);
});
test('a timeout while native watch registration is pending removes its late handle', async () => {
  const subscription = deferred<{ remove: () => void }>(); watch.mockReturnValue(subscription.promise);
  capture.start(); await flush(); jest.advanceTimersByTime(NEARBY_TIMEOUT_MS);
  subscription.resolve({ remove }); await flush(); expect(remove).toHaveBeenCalledTimes(1);
  expect(onPoint).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
});
test('a synchronous fix before watch registration resolves still removes the handle exactly once', async () => {
  watch.mockImplementation(async (_options, next) => { next(fix()); return { remove }; });
  capture.start(); await flush(); expect(onPoint).toHaveBeenCalledTimes(1); expect(remove).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
test.each(['denied', 'services-off', 'unavailable'])('reports %s without a position or an unbounded subscription', async reason => {
  if (reason === 'denied') request.mockResolvedValue({ granted: false });
  if (reason === 'services-off') services.mockResolvedValue(false);
  if (reason === 'unavailable') watch.mockRejectedValue(new Error('native detail is never shown'));
  capture.start(); await flush();
  expect(onStatus).toHaveBeenLastCalledWith(reason); expect(onPoint).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
  if (reason !== 'unavailable') expect(watch).not.toHaveBeenCalled();
});
test('a native watch error removes its subscription and discards later callbacks', async () => {
  capture.start(); await flush(); fail('native diagnostic'); receive(fix());
  expect(onStatus).toHaveBeenLastCalledWith('unavailable'); expect(remove).toHaveBeenCalledTimes(1); expect(onPoint).not.toHaveBeenCalled();
});
test('ownership loss fences a callback even before lifecycle cleanup runs', async () => {
  capture.start(); await flush(); current = false; receive(fix());
  expect(remove).toHaveBeenCalledTimes(1); expect(onPoint).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
});
describe('the app\'s own question before the system location window (T4b2 + lead, 2026-10-07)', () => {
  test('"Ne sada" reads no position, asks the system nothing and says nothing: the status returns to idle', async () => {
    const before = jest.fn().mockResolvedValue('later');
    capture.cancel(); capture = createNearbyCapture({ load, owns: () => current, onPoint, onStatus, beforePermission: before });
    capture.start(); await flush();
    expect(before).toHaveBeenCalledTimes(1); expect(request).not.toHaveBeenCalled(); expect(watch).not.toHaveBeenCalled();
    expect(onPoint).not.toHaveBeenCalled(); expect(onStatus.mock.calls).toEqual([['locating'], ['idle']]); expect(jest.getTimerCount()).toBe(0);
  });
  test('"Dozvoli" goes on to the system window and the watch exactly as without the question', async () => {
    const before = jest.fn().mockResolvedValue('allow');
    capture.cancel(); capture = createNearbyCapture({ load, owns: () => current, onPoint, onStatus, beforePermission: before });
    capture.start(); await flush(); receive(fix());
    expect(before).toHaveBeenCalledTimes(1); expect(request).toHaveBeenCalledTimes(1); expect(watch).toHaveBeenCalledTimes(1);
    expect(onPoint).toHaveBeenCalledTimes(1); expect(onStatus.mock.calls).toEqual([['locating'], ['idle']]);
  });
  test('an answer that arrives after the screen lost the capture is ignored', async () => {
    const answer = deferred<'allow' | 'later'>(); const before = jest.fn().mockReturnValue(answer.promise);
    capture.cancel(); capture = createNearbyCapture({ load, owns: () => current, onPoint, onStatus, beforePermission: before });
    capture.start(); await flush(); capture.cancel(); current = false; answer.resolve('allow'); await flush();
    expect(request).not.toHaveBeenCalled(); expect(watch).not.toHaveBeenCalled(); expect(onPoint).not.toHaveBeenCalled();
  });
});


test('an existing grant never opens the Android permission Activity or the app pre-prompt', async () => {
  readPermission.mockResolvedValue({ granted: true });
  const before = jest.fn().mockResolvedValue('allow');
  // Reproduce the native failure: asking again would retire this screen before the request resolves.
  request.mockImplementation(async () => { current = false; return { granted: true }; });
  capture.cancel(); capture = createNearbyCapture({ load, owns: () => current, onPoint, onStatus, beforePermission: before });
  capture.start(); await flush(); receive(fix());
  expect(readPermission).toHaveBeenCalledTimes(1); expect(before).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
  expect(onPoint).toHaveBeenCalledTimes(1); expect(remove).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
});

test('a failed permission read fails closed without asking or starting capture', async () => {
  readPermission.mockRejectedValue(new Error('native read failed')); capture.start(); await flush();
  expect(request).not.toHaveBeenCalled(); expect(watch).not.toHaveBeenCalled(); expect(onPoint).not.toHaveBeenCalled();
  expect(onStatus).toHaveBeenLastCalledWith('unavailable'); expect(jest.getTimerCount()).toBe(0);
});


test('every new attempt re-reads permissions and never reuses a grant after revocation', async () => {
  readPermission.mockResolvedValueOnce({ granted: true }).mockResolvedValueOnce({ granted: false });
  capture.start(); await flush(); receive(fix());
  request.mockResolvedValue({ granted: false }); capture.start(); await flush();
  expect(readPermission).toHaveBeenCalledTimes(2); expect(request).toHaveBeenCalledTimes(1);
  expect(watch).toHaveBeenCalledTimes(1); expect(onPoint).toHaveBeenCalledTimes(1);
  expect(onStatus).toHaveBeenLastCalledWith('denied'); expect(jest.getTimerCount()).toBe(0);
});
