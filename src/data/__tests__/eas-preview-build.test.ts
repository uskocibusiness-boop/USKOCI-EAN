export {};

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { validatePreview } = require('../../../scripts/check-eas-preview.cjs');
const { REQUIRED_BUILD_ENV } = require('../../../scripts/build-contract.cjs');
const sourceEas = require('../../../eas.json');
const sourceFirebase = require('../../../config/firebase/google-services.json');

const inertPlugin = './plugins/withFirebaseEnrollmentDisabled.js';
const originalEnv = { ...process.env };
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function preview(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  const env: NodeJS.ProcessEnv = { ...originalEnv, ...sourceEas.build.preview.env,
    EAS_BUILD_PROFILE: 'preview', EAS_BUILD_PLATFORM: 'android', NODE_ENV: 'production' };
  delete env.JEST_WORKER_ID;
  delete env.USKOCI_PUSH_PROOF_BUILD;
  delete env.EXPO_PUBLIC_USKOCI_DEV_AUTO_PUSH_ENROLL;
  Object.assign(env, overrides);
  // EAS loads this in Node. Expo's Jest transform can inline EXPO_PUBLIC_* at
  // import time, so execute the real config in Node with this case's environment.
  const app = JSON.parse(execFileSync(process.execPath, ['-e', `
    try {
      const expo = require('./app.config.js')({ config: require('./app.json').expo });
      process.stdout.write(JSON.stringify({ expo }));
    } catch (error) { process.stdout.write(JSON.stringify({ error: error.message })); }
  `], { cwd: path.resolve(__dirname, '../../..'), env, encoding: 'utf8' }));
  if (app.error) throw new Error(app.error);
  return { app, eas: copy(sourceEas), env, firebase: copy(sourceFirebase) };
}

it.each([
  ['ordinary preview', {}],
  ['push proof', { USKOCI_PUSH_PROOF_BUILD: '1' }],
  ['push proof with DEV auto-enrollment', { USKOCI_PUSH_PROOF_BUILD: '1', EXPO_PUBLIC_USKOCI_DEV_AUTO_PUSH_ENROLL: '1' }],
] as const)('admits the actual resolved %s configuration', (_name, env) => {
  const input = preview(env);
  expect(input.app.expo.plugins.includes(inertPlugin)).toBe(input.env.USKOCI_PUSH_PROOF_BUILD !== '1');
  expect(() => validatePreview(input)).not.toThrow();
});

it('rejects ordinary preview with native enrollment protection removed', () => {
  const input = preview();
  input.app.expo.plugins = input.app.expo.plugins.filter((plugin: unknown) => plugin !== inertPlugin);
  expect(() => validatePreview(input)).toThrow();
});

it.each([inertPlugin, [inertPlugin, {}]])('rejects a push proof still carrying the inert plugin: %j', plugin => {
  const input = preview({ USKOCI_PUSH_PROOF_BUILD: '1' });
  input.app.expo.plugins.push(plugin);
  expect(() => validatePreview(input)).toThrow();
});

it('rejects an unresolved plugin list instead of treating it as a push proof', () => {
  const input = preview({ USKOCI_PUSH_PROOF_BUILD: '1' });
  delete input.app.expo.plugins;
  expect(() => validatePreview(input)).toThrow();
});

it('rejects DEV auto-enrollment outside a proof in both configuration and validation', () => {
  expect(() => preview({ EXPO_PUBLIC_USKOCI_DEV_AUTO_PUSH_ENROLL: '1' }))
    .toThrow('DEV_AUTO_PUSH_REQUIRES_ISOLATED_PREVIEW_PUSH_PROOF_BUILD');
  const input = preview();
  input.env.EXPO_PUBLIC_USKOCI_DEV_AUTO_PUSH_ENROLL = '1';
  expect(() => validatePreview(input)).toThrow('DEV_AUTO_PUSH_REQUIRES_ISOLATED_PREVIEW_PUSH_PROOF_BUILD');
});

it.each([
  { EAS_BUILD_PLATFORM: 'ios' },
  { EAS_BUILD_PROFILE: 'development' },
  { USKOCI_OTA_TARGET: 'other' },
  { EXPO_PUBLIC_SUPABASE_URL: 'https://other.supabase.co' },
  { EXPO_PUBLIC_USE_FAKE_SOURCE: '1' },
  { NODE_ENV: 'test' },
  { JEST_WORKER_ID: '1' },
])('keeps the preview admission boundary for proof builds: %j', overrides => {
  const input = preview({ USKOCI_PUSH_PROOF_BUILD: '1', ...overrides });
  expect(() => validatePreview(input)).toThrow();
});

it.each(Object.keys(REQUIRED_BUILD_ENV))('keeps required flag %s for push proof', key => {
  const input = preview({ USKOCI_PUSH_PROOF_BUILD: '1' });
  delete input.env[key];
  expect(() => validatePreview(input)).toThrow(`USKOCI_BUILD_CONTRACT_MISMATCH:${key}`);
});

it.each(['package', 'runtime', 'channel', 'project', 'firebaseFile', 'firebaseProject', 'firebaseClient', 'privateCredential'])
('rejects a push proof with mismatched %s', field => {
  const input = preview({ USKOCI_PUSH_PROOF_BUILD: '1' });
  if (field === 'package') input.app.expo.android.package = 'rs.uskoci';
  if (field === 'runtime') input.app.expo.runtimeVersion = 'other-runtime';
  if (field === 'channel') input.app.expo.updates.requestHeaders['expo-channel-name'] = 'production';
  if (field === 'project') input.app.expo.extra.eas.projectId = 'other-project';
  if (field === 'firebaseFile') delete input.app.expo.android.googleServicesFile;
  if (field === 'firebaseProject') input.firebase.project_info.project_id = 'other-project';
  if (field === 'firebaseClient') input.firebase.client[0].client_info.android_client_info.package_name = 'rs.uskoci';
  if (field === 'privateCredential') input.firebase.private_key = 'synthetic-forbidden-material';
  expect(() => validatePreview(input)).toThrow();
});

it.each([{ EAS_BUILD_PROFILE: 'production' }, { USKOCI_OTA_TARGET: 'production' }])
('keeps production blocked even with a push proof flag: %j', target => {
  expect(() => preview({ USKOCI_PUSH_PROOF_BUILD: '1', ...target })).toThrow('USKOCI_PRODUCTION_NOT_CONFIGURED');
  const input = preview({ USKOCI_PUSH_PROOF_BUILD: '1' });
  Object.assign(input.env, target);
  expect(() => validatePreview(input)).toThrow('USKOCI_PRODUCTION_NOT_CONFIGURED');
});
