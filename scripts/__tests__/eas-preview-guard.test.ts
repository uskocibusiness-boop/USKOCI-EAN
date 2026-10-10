import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const { validatePreview, validateFirebase } = require('../check-eas-preview.cjs');
const root = path.resolve(__dirname, '../..');
const configure = require('../../app.config.js');
const appSource = { expo: configure({ config: JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo }) };
const easSource = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
const firebaseSource = JSON.parse(fs.readFileSync(path.join(root, 'config/firebase/google-services.json'), 'utf8'));
const ref = 'leqcwgzvjsxugfgzdmth';
const jwt = (role = 'anon', project = ref) => ['header',
  Buffer.from(JSON.stringify({ role, ref: project })).toString('base64url'), 'signature'].join('.');

function fixture() {
  return {
    app: structuredClone(appSource), eas: structuredClone(easSource), firebase: structuredClone(firebaseSource),
    env: {
      EAS_BUILD_PROFILE: 'preview', EAS_BUILD_PLATFORM: 'android',
      EAS_BUILD_PROJECT_ID: '1e6cc490-9851-4741-9226-128612122db6',
      USKOCI_OTA_TARGET: 'preview',
      EXPO_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt(), NODE_ENV: 'production',
    } as NodeJS.ProcessEnv,
  };
}

describe('actual EAS preview pre-install guard', () => {
  it.each([jwt(), 'sb_publishable_syntheticPublicFormOnly'])('admits public key form without Auth or network proof', (key) => {
    const input = fixture();
    input.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = key;
    expect(() => validatePreview(input)).not.toThrow();
  });

  it.each(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'])('fails before build when %s is absent', (name) => {
    const input = fixture(); delete input.env[name];
    expect(() => validatePreview(input)).toThrow(/EXPO_PUBLIC_SUPABASE/);
  });

  it.each(['https://another.supabase.co', 'http://127.0.0.1:54321', `https://${ref}.supabase.co.evil.test`])('rejects a different backend', (url) => {
    const input = fixture(); input.env.EXPO_PUBLIC_SUPABASE_URL = url;
    expect(() => validatePreview(input)).toThrow(/confirmed canonical/);
  });

  it.each([jwt('service_role'), jwt('anon', 'anotherproject'), 'sb_secret_NEVER_LOG_THIS_KEY', 'garbage', 'header.bm90anNvbg.signature'])('rejects privileged, foreign or malformed credentials without including them in errors', (key) => {
    const input = fixture(); input.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = key;
    expect(() => validatePreview(input)).toThrow(/must be a public/);
    try { validatePreview(input); } catch (error) { expect(String(error)).not.toContain(key); }
  });

  it.each(['owner', 'slug', 'projectId', 'package', 'jobProject'])('rejects accidental identity drift: %s', (field) => {
    const input = fixture();
    if (field === 'projectId') input.app.expo.extra.eas.projectId = 'other-project';
    else if (field === 'package') input.app.expo.android.package = 'rs.uskoci.other';
    else if (field === 'jobProject') input.env.EAS_BUILD_PROJECT_ID = 'other-project';
    else input.app.expo[field] = 'other';
    expect(() => validatePreview(input)).toThrow(/project|package/);
  });

  it.each([{ EXPO_PUBLIC_USE_FAKE_SOURCE: '1' }, { NODE_ENV: 'test' }, { JEST_WORKER_ID: '1' }])('rejects each actual fake-source composition switch: %j', (override) => {
    const input = fixture(); Object.assign(input.env, override);
    expect(() => validatePreview(input)).toThrow(/fake or test/);
  });

  it.each(['distribution', 'credentialsSource', 'buildType', 'versionSource', 'profile', 'platform', 'channel'])('rejects a changed build boundary: %s', (field) => {
    const input = fixture();
    if (field === 'buildType') input.eas.build.preview.android.buildType = 'app-bundle';
    else if (field === 'channel') input.eas.build.preview.channel = 'production';
    else if (field === 'versionSource') input.eas.cli.appVersionSource = 'local';
    else if (field === 'profile') input.env.EAS_BUILD_PROFILE = 'development';
    else if (field === 'platform') input.env.EAS_BUILD_PLATFORM = 'ios';
    else input.eas.build.preview[field] = 'other';
    expect(() => validatePreview(input)).toThrow(/preview/);
  });

  // Store route is fail-closed until an isolated backend is explicitly approved.
  // Offline synthetic project IDs test admission logic, not a real release decision.
  const storeRef = 'abcdefghijklmnopqrst';
  function storeFixture() {
    const input = fixture();
    input.env.EAS_BUILD_PROFILE = 'production';
    input.env.USKOCI_OTA_TARGET = 'production';
    input.env.EXPO_PUBLIC_SUPABASE_URL = `https://${storeRef}.supabase.co`;
    input.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = jwt('anon', storeRef);
    input.env.USKOCI_PRODUCTION_BACKEND_REF = storeRef;
    input.env.USKOCI_PRODUCTION_BACKEND_APPROVED = '1';
    const names = ['EAS_BUILD_PROFILE', 'USKOCI_OTA_TARGET', 'EXPO_PUBLIC_SUPABASE_URL',
      'USKOCI_PRODUCTION_BACKEND_REF', 'USKOCI_PRODUCTION_BACKEND_APPROVED'];
    const previous = names.map(name => [name, process.env[name]] as const);
    try {
      for (const name of names) {
        const value = input.env[name];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      input.app = { expo: configure({ config: JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo }) };
    } finally {
      for (const [name, value] of previous) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
    return input;
  }
  it('admits only a synthetically approved isolated backend and the store package', () => {
    const input = storeFixture();
    expect(input.app.expo.android.package).toBe('rs.uskoci');
    expect(input.app.expo.android.googleServicesFile).toBeUndefined();
    expect(() => validatePreview(input)).not.toThrow();
  });
  it('refuses a store bundle under preview package or with preview Firebase client', () => {
    const wrong = storeFixture(); wrong.app.expo.android.package = 'rs.uskoci.preview';
    expect(() => validatePreview(wrong)).toThrow(/rs\\.uskoci for the store/);
    const borrowed = storeFixture(); borrowed.app.expo.android.googleServicesFile = './config/firebase/google-services.json';
    expect(() => validatePreview(borrowed)).toThrow(/must not carry the preview Firebase/);
  });
  it('does not embed DEV URL or any backend public key in the production EAS profile', () => {
    const env = easSource.build.production.env;
    expect(env.EXPO_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.EXPO_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();
  });
  it.each(['distribution', 'environment', 'credentialsSource', 'buildType', 'autoIncrement', 'channel'])('rejects production profile drift: %s', field => {
    const input = storeFixture();
    const production = input.eas.build.production;
    if (field === 'buildType') production.android.buildType = 'apk';
    else if (field === 'channel') production.channel = 'preview';
    else if (field === 'autoIncrement') production.autoIncrement = false;
    else production[field] = 'other';
    expect(() => validatePreview(input)).toThrow(/production store app bundle/);
  });
  it.each([
    { EXPO_PUBLIC_USE_FAKE_SOURCE: '1' },
    { EXPO_PUBLIC_SUPABASE_URL: 'https://leqcwgzvjsxugfgzdmth.supabase.co' },
    { EXPO_PUBLIC_SUPABASE_URL: 'https://another.supabase.co' },
    { EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_NEVER_LOG_THIS_KEY' },
    { USKOCI_PRODUCTION_BACKEND_APPROVED: '0' },
    { USKOCI_PRODUCTION_BACKEND_REF: 'unapprovedref' },
  ])('rejects fake, DEV, mismatched or unapproved store settings: %j', override => {
    const input = storeFixture(); Object.assign(input.env, override);
    expect(() => validatePreview(input)).toThrow(/fake or test|USKOCI_PRODUCTION_BACKEND_|must be a public/);
  });
  it('refuses a production Expo config that points at DEV before native prebuild', () => {
    const names = ['EAS_BUILD_PROFILE', 'USKOCI_OTA_TARGET', 'EXPO_PUBLIC_SUPABASE_URL',
      'USKOCI_PRODUCTION_BACKEND_REF', 'USKOCI_PRODUCTION_BACKEND_APPROVED'];
    const previous = names.map(name => [name, process.env[name]] as const);
    try {
      process.env.EAS_BUILD_PROFILE = 'production'; process.env.USKOCI_OTA_TARGET = 'production';
      process.env.EXPO_PUBLIC_SUPABASE_URL = `https://${ref}.supabase.co`;
      process.env.USKOCI_PRODUCTION_BACKEND_REF = ref;
      process.env.USKOCI_PRODUCTION_BACKEND_APPROVED = '1';
      expect(() => configure({ config: structuredClone(JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo) })).toThrow(/USKOCI_PRODUCTION_BACKEND_IS_NON_PRODUCTION/);
    } finally {
      for (const [name, value] of previous) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });

  it.each([undefined, 1, 34, 35.5])('rejects a version reset below the existing build lineage', (version) => {
    const input = fixture(); input.app.expo.android.versionCode = version;
    expect(() => validatePreview(input)).toThrow(/seed floor/);
  });

  it('actual lifecycle command fails with a fixed diagnostic and never prints a rejected key', () => {
    const env: NodeJS.ProcessEnv = { ...process.env, ...fixture().env, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_NEVER_LOG_THIS_KEY' };
    delete env.JEST_WORKER_ID;
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/check-eas-preview.cjs')], { cwd: root, env, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('EAS preview preflight FAIL: EXPO_PUBLIC_SUPABASE_ANON_KEY');
    expect(result.stdout + result.stderr).not.toContain('NEVER_LOG_THIS_KEY');
  });

  it.each(['project', 'number', 'app', 'package', 'multipleClients', 'missingKey', 'privateMaterial'])('rejects Firebase client drift without leaking supplied values: %s', field => {
    const firebase = structuredClone(firebaseSource);
    if (field === 'project') firebase.project_info.project_id = 'other-project';
    else if (field === 'number') firebase.project_info.project_number = '999999999999';
    else if (field === 'app') firebase.client[0].client_info.mobilesdk_app_id = 'other-app';
    else if (field === 'package') firebase.client[0].client_info.android_client_info.package_name = 'rs.uskoci.n04proof';
    else if (field === 'multipleClients') firebase.client.push(structuredClone(firebase.client[0]));
    else if (field === 'missingKey') firebase.client[0].api_key = [];
    else firebase.private_key = 'PRIVATE KEY NEVER_LOG_THIS_PRIVATE_VALUE';
    expect(() => validateFirebase(firebase)).toThrow(/Firebase/);
    try { validateFirebase(firebase); } catch (error) {
      expect(String(error)).not.toContain('NEVER_LOG_THIS_PRIVATE_VALUE');
      expect(String(error)).not.toContain(firebaseSource.client[0].api_key[0].current_key);
    }
  });

  it.each(['file', 'autoEnrollment'])('fails if resolved Firebase configuration loses its reviewed boundary: %s', field => {
    const input = fixture();
    if (field === 'file') input.app.expo.android.googleServicesFile = './different.json';
    else input.app.expo.plugins = [];
    expect(() => validatePreview(input)).toThrow(/disabled native enrollment/);
  });
});
