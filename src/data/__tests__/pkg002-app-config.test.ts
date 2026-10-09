const configure = require('../../../app.config.js');

describe('PKG-002 microphone permission copy', () => {
  it('describes release as transcript finalization and keeps explicit Send', () => {
    const result = configure({ config: {
      version: '1.0.0',
      android: { package: 'rs.uskoci.pkg002' },
      ios: {},
      plugins: [],
      extra: {},
    } });
    const imagePicker = result.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker');
    expect(imagePicker).toBeDefined();
    const microphonePermission = imagePicker[1].microphonePermission as string;
    expect(microphonePermission).toContain('Puštanje završava transkript');
    expect(microphonePermission).toContain('Pošalji');
    expect(microphonePermission).not.toContain('Puštanje šalje poruku');
  });

  it('does not weaken existing location/map configuration while changing the copy', () => {
    const result = configure({ config: {
      version: '1.0.0',
      android: { package: 'rs.uskoci.pkg002', permissions: [] },
      ios: {},
      plugins: [],
      extra: {},
    } });
    expect(result.android.permissions).toEqual(expect.arrayContaining([
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ]));
    expect(result.plugins.some((plugin: unknown) => (Array.isArray(plugin) ? plugin[0] : plugin) === '@maplibre/maplibre-react-native')).toBe(true);
    expect(result.ios.infoPlist.NSLocationWhenInUseUsageDescription).toContain('jednu lokaciju');
  });

  it('blocks template overlay access while preserving existing permission exclusions', () => {
    const result = configure({ config: { version: '1.0.0', android: {
      package: 'rs.uskoci.preview', blockedPermissions: ['android.permission.ACCESS_BACKGROUND_LOCATION'],
    }, plugins: [], extra: {} } });
    expect(result.android.blockedPermissions).toEqual([
      'android.permission.ACCESS_BACKGROUND_LOCATION', 'android.permission.SYSTEM_ALERT_WINDOW',
    ]);
    expect(result.android.permissions).toEqual(expect.arrayContaining([
      'android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION',
    ]));
  });
});
