import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { PermissionsAndroid, Platform } from 'react-native';
import { locationNeed, askForLocation } from '../locationPermission';
import { askForNotifications, type NotificationPermissionPort } from '../notificationAsk';
import { permissionAsk } from '../permissionAsk';

/**
 * The places that ask the system for something get a question first (design proposal N). Here: the location state that decides
 * whether the question is needed, the notification rule (built and tested, NOT wired: push is the last piece of work), and a
 * guard that keeps the notification helper unwired until that piece starts.
 */
const GRANTED = 'granted', DENIED = 'denied';
const android = () => jest.replaceProperty(Platform, 'OS', 'android');
/** Mounts a fake host that answers every question the way the person is made to, so no dialog needs drawing. */
function hostAnswering(answer: 'allow' | 'later') {
  const host = {};
  const unmount = permissionAsk.mountHost(host);
  const off = permissionAsk.subscribe(() => {
    const open = permissionAsk.current(host);
    if (open) permissionAsk.answer(open.id, answer);
  });
  return () => { off(); unmount(); };
}
afterEach(() => { jest.restoreAllMocks(); });

describe('locationNeed: whether the system\'s location window is about to open', () => {
  const holds = (fine: boolean, coarse: boolean) => jest.spyOn(PermissionsAndroid, 'check').mockImplementation(async (permission: string) =>
    permission === PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION ? fine : coarse);
  it.each([[true, true, 'granted'], [true, false, 'granted'], [false, true, 'granted'], [false, false, 'ask']] as const)(
    'on Android, fine=%s coarse=%s is %s (either permission means no window)', async (fine, coarse, expected) => {
      android(); holds(fine, coarse);
      expect(await locationNeed()).toBe(expected);
    });
  it('reads nothing but the state: it never asks the system', async () => {
    android(); holds(false, false);
    const request = jest.spyOn(PermissionsAndroid, 'request'), requestMultiple = jest.spyOn(PermissionsAndroid, 'requestMultiple');
    await locationNeed();
    expect(request).not.toHaveBeenCalled(); expect(requestMultiple).not.toHaveBeenCalled();
  });
  it('is not read on other platforms (Android first): no question is put in front of them', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const check = jest.spyOn(PermissionsAndroid, 'check');
    expect(await locationNeed()).toBe('unknown');
    expect(check).not.toHaveBeenCalled();
    expect(await askForLocation()).toBe('allow');
  });
  it('asks the question only where the window is about to open, and "Ne sada" is the answer to carry', async () => {
    android();
    const unmount = hostAnswering('later');
    try {
      holds(true, false);
      expect(await askForLocation()).toBe('allow');
      holds(false, false);
      expect(await askForLocation()).toBe('later');
    } finally { unmount(); }
  });
  it('a state that cannot be read goes straight on', async () => {
    android();
    jest.spyOn(PermissionsAndroid, 'check').mockRejectedValue(new Error('no activity'));
    const unmount = hostAnswering('later');
    try { expect(await askForLocation()).toBe('allow'); } finally { unmount(); }
  });
});

describe('askForNotifications: the question after the first task or application (built, tested, not wired)', () => {
  const port = (read: { granted: boolean; canAskAgain: boolean }, request = { granted: true }): NotificationPermissionPort & { request: jest.Mock; read: jest.Mock } => ({
    read: jest.fn(async () => read), request: jest.fn(async () => request) });
  it('is already allowed: no question and no system window', async () => {
    const p = port({ granted: true, canAskAgain: true }); const unmount = hostAnswering('allow');
    try { expect(await askForNotifications(p)).toBe(GRANTED); } finally { unmount(); }
    expect(p.request).not.toHaveBeenCalled();
  });
  it('the system will not ask again: no question, no window, and the caller\'s recovery says what is left', async () => {
    const p = port({ granted: false, canAskAgain: false }); const unmount = hostAnswering('allow');
    try { expect(await askForNotifications(p)).toBe('blocked'); } finally { unmount(); }
    expect(p.request).not.toHaveBeenCalled();
  });
  it('"Ne sada": the system is not asked, and nothing else happens', async () => {
    const p = port({ granted: false, canAskAgain: true }); const unmount = hostAnswering('later');
    try { expect(await askForNotifications(p)).toBe('later'); } finally { unmount(); }
    expect(p.request).not.toHaveBeenCalled();
  });
  it('"Dozvoli": the system\'s own window follows, and its answer is the result', async () => {
    const yes = port({ granted: false, canAskAgain: true }, { granted: true }), no = port({ granted: false, canAskAgain: true }, { granted: false });
    const unmount = hostAnswering('allow');
    try {
      expect(await askForNotifications(yes)).toBe(GRANTED);
      expect(await askForNotifications(no)).toBe(DENIED);
    } finally { unmount(); }
    expect(yes.request).toHaveBeenCalledTimes(1); expect(no.request).toHaveBeenCalledTimes(1);
  });
  it('without a host to draw the question the window follows directly, as it would have without this helper', async () => {
    const p = port({ granted: false, canAskAgain: true });
    expect(await askForNotifications(p)).toBe(GRANTED); expect(p.request).toHaveBeenCalledTimes(1);
  });
  it('claims nothing when the state cannot be read or the window fails', async () => {
    const unreadable: NotificationPermissionPort = { read: async () => { throw new Error('no module'); }, request: jest.fn() as never };
    expect(await askForNotifications(unreadable)).toBe('unavailable');
    const failing: NotificationPermissionPort = { read: async () => ({ granted: false, canAskAgain: true }), request: async () => { throw new Error('window failed'); } };
    expect(await askForNotifications(failing)).toBe('unavailable');
  });
});

// Push is set up LAST (owner, 2026-10-02: do not rebuild or restart it for confidence): until that work starts, nothing may depend
// on the notification question. When it does, this guard is the thing to change on purpose.
describe('the notification question stays unwired', () => {
  const repo = join(__dirname, '../../../..');
  const sources = (dir: string): string[] => readdirSync(join(repo, dir), { withFileTypes: true }).flatMap(entry => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path);
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
  it('is imported by no source file of the app, and itself reaches neither expo-notifications nor Firebase nor the push runtime', () => {
    const importers = sources('src').filter(path => path !== 'src/ui/permissions/notificationAsk.ts'
      && /notificationAsk/.test(readFileSync(join(repo, path), 'utf8')));
    expect(importers).toEqual([]);
    expect(existsSync(join(repo, 'src/ui/permissions/notificationAsk.ts'))).toBe(true);
    const own = readFileSync(join(repo, 'src/ui/permissions/notificationAsk.ts'), 'utf8');
    expect(own).not.toMatch(/from\s+['"](?:expo-notifications|@react-native-firebase|firebase)/);
    expect(own).not.toMatch(/PushRuntime|nativePushDevice/);
  });
  it('the "notifications" question exists in the copy, so wiring it later needs no new words', () => {
    expect(readFileSync(join(repo, 'src/ui/permissions/permissionAsk.ts'), 'utf8')).toContain("notifications: { art: 'bell'");
  });
});
