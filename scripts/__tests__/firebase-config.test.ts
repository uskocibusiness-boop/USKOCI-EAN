import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(__dirname, '../..');
const configure = require('../../app.config.js');
const original = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const firebasePath = './config/firebase/google-services.json';
const enrollmentPlugin = './plugins/withFirebaseEnrollmentDisabled.js';
const temporary = path.join(root, '.expo');
const fixtures: string[] = [];

function resolvePackage(packageName: string, extraEnv: Record<string, string | undefined> = {}) {
  fs.mkdirSync(temporary, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(temporary, 'firebase-config-'));
  fixtures.push(fixture);
  const source = structuredClone(original);
  source.expo.android.package = packageName;
  source.expo.android.googleServicesFile = firebasePath;
  source.expo.name = 'Disposable label'; source.expo.scheme = 'disposable-scheme';
  source.expo.extra = { fixture: 'local-only' };
  fs.writeFileSync(path.join(fixture, 'app.json'), JSON.stringify(source));
  fs.copyFileSync(path.join(root, 'package.json'), path.join(fixture, 'package.json'));
  fs.copyFileSync(path.join(root, 'app.config.js'), path.join(fixture, 'app.config.js'));
  fs.mkdirSync(path.join(fixture, 'scripts'));
  fs.copyFileSync(path.join(root, 'scripts/build-identity.cjs'), path.join(fixture, 'scripts/build-identity.cjs'));
  // The real app config imports this fail-closed store guard even in preview mode.
  // Mirror its dependency in the disposable Expo fixture; no production values are supplied.
  fs.copyFileSync(path.join(root, 'scripts/production-backend-guard.cjs'),
    path.join(fixture, 'scripts/production-backend-guard.cjs'));
  fs.mkdirSync(path.join(fixture, 'plugins'));
  fs.copyFileSync(path.join(root, enrollmentPlugin), path.join(fixture, enrollmentPlugin));
  // Use the same Node resolver as Expo CLI; Jest's browser module conditions
  // otherwise select an unrelated ESM-only xcode dependency.
  const result = spawnSync(process.execPath, ['-e',
    "process.stdout.write(JSON.stringify(require('@expo/config').getConfig(process.argv[1], { skipSDKVersionRequirement: true }).exp))",
    fixture], { cwd: root, encoding: 'utf8', timeout: 15000, env: { ...process.env, ...extraEnv } });
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout);
}

afterAll(() => {
  for (const fixture of fixtures) {
    if (path.dirname(path.resolve(fixture)) !== path.resolve(temporary)) throw new Error('Unsafe config fixture cleanup');
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

describe('actual package-aware Firebase config', () => {
  it('keeps the exact owner-provided public file bytes', () => {
    const bytes = fs.readFileSync(path.join(root, firebasePath));
    expect(bytes.length).toBe(671);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('44d16e473ec04afa35df40fd7fa5eb9d79c6c341f348236355f8098b369fcb91');
  });

  it('Expo resolves preview Firebase without replacing other incoming configuration', () => {
    const config = resolvePackage('rs.uskoci.preview');
    expect(config.android.googleServicesFile).toBe(firebasePath);
    expect(config.plugins).toContain(enrollmentPlugin);
    expect(config.name).toBe('Disposable label'); expect(config.scheme).toBe('disposable-scheme');
    expect(config.extra).toMatchObject({ fixture: 'local-only' }); expect(config.extra.eas).toBeUndefined();
  });

  it('dedicated push-proof preview keeps the matching Firebase client but deliberately omits only the enrollment-disable plugin', () => {
    const config = resolvePackage('rs.uskoci.preview', { USKOCI_PUSH_PROOF_BUILD: '1' });
    expect(config.android.package).toBe('rs.uskoci.preview');
    expect(config.android.googleServicesFile).toBe(firebasePath);
    expect(config.plugins).not.toContain(enrollmentPlugin);
    expect(config.plugins).toContain('expo-notifications');
  });

  it.each(['rs.uskoci.dev', 'rs.uskoci', 'rs.uskoci.unknown'])('push-proof mode refuses non-preview package %s', packageName => {
    expect(() => resolvePackage(packageName, { USKOCI_PUSH_PROOF_BUILD: '1' })).toThrow();
  });

  it.each(['rs.uskoci.n04proof', 'rs.uskoci.ru5proof', 'rs.uskoci.dev', 'rs.uskoci.unknown'])('Expo preserves %s and removes incompatible preview Firebase', packageName => {
    const config = resolvePackage(packageName);
    expect(config.android.package).toBe(packageName);
    expect(config.android.googleServicesFile).toBeUndefined();
    expect(config.plugins).not.toContain(enrollmentPlugin);
    expect(config.name).toBe('Disposable label'); expect(config.scheme).toBe('disposable-scheme');
    expect(config.extra).toMatchObject({ fixture: 'local-only' }); expect(config.extra.eas).toBeUndefined();
  });

  it('repeated config resolution does not mutate its input or duplicate the plugin', () => {
    const source = structuredClone(original.expo);
    const first = configure({ config: source });
    expect(source).toEqual(original.expo);
    expect(configure({ config: first }).plugins.filter((plugin: string) => plugin === enrollmentPlugin)).toHaveLength(1);
  });

  it('Nearby has only foreground location permission and truthful permission copy', () => {
    const config = configure({ config: structuredClone(original.expo) });
    const plugins = config.plugins.filter((plugin: any) => Array.isArray(plugin) && plugin[0] === 'expo-location');
    expect(plugins).toHaveLength(1);
    expect(plugins[0][1]).toMatchObject({ locationAlwaysPermission: false, locationAlwaysAndWhenInUsePermission: false,
      motionUsagePermission: false, isIosBackgroundLocationEnabled: false, isAndroidBackgroundLocationEnabled: false,
      isAndroidForegroundServiceEnabled: false, isAndroidMotionActivityEnabled: false });
    expect(config.ios.infoPlist.NSLocationWhenInUseUsageDescription).toContain('U blizini');
    expect(config.ios.infoPlist.NSLocationWhenInUseUsageDescription).not.toContain('Dogovoru');
    expect(config.android.permissions).toContain('android.permission.ACCESS_COARSE_LOCATION');
    expect(config.android.permissions).not.toEqual(expect.arrayContaining(['android.permission.ACCESS_BACKGROUND_LOCATION']));
    expect(configure({ config }).plugins.filter((plugin: any) => Array.isArray(plugin) && plugin[0] === 'expo-location')).toHaveLength(1);
  });

  it('installed notification support retains disabled automatic Firebase enrollment', () => {
    const script = `const { getPrebuildConfigAsync } = require('@expo/prebuild-config');
      const { compileModsAsync } = require('expo/config-plugins');
      (async () => {
        const { exp } = await getPrebuildConfigAsync(process.cwd(), { platforms: ['android'] });
        const config = await compileModsAsync(exp, { projectRoot: process.cwd(), platforms: ['android'], introspect: true });
        const application = config._internal.modResults.android.manifest.manifest.application[0];
        process.stdout.write(JSON.stringify({ application, autolinked: config._internal.autolinkedModules }));
      })().catch(() => { process.stderr.write('Native config introspection failed'); process.exitCode = 1; });`;
    const result = spawnSync(process.execPath, ['-e', script], { cwd: root, encoding: 'utf8', timeout: 30000 });
    expect(result.status).toBe(0);
    const { application, autolinked } = JSON.parse(result.stdout);
    for (const name of ['firebase_messaging_auto_init_enabled', 'firebase_analytics_collection_enabled']) {
      expect(application['meta-data'].filter((item: any) => item.$['android:name'] === name)).toEqual([
        { $: { 'android:name': name, 'android:value': 'false' } },
      ]);
    }
    expect(JSON.stringify(application.service ?? [])).not.toMatch(/FirebaseMessaging|MESSAGING_EVENT/);
    expect(autolinked).toContain('expo-notifications');
  }, 40000);
});
