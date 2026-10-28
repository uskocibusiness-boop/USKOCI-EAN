import { PermissionsAndroid, Platform } from 'react-native';
import { locationNeed, askForLocation } from '../locationPermission';
import { permissionAsk } from '../permissionAsk';

// Active location capture asks before opening the native permission window.
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
