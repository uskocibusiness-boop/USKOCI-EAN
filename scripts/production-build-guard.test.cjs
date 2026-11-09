'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const eas = require('../eas.json');
const { assertProductionTarget, assertDevBuildContract } = require('./build-contract.cjs');
const { validatePreview } = require('./check-eas-preview.cjs');
const { inspectAndroidRelease, readSourceReport } = require('./check-android-release-readiness.cjs');
const { selectTestCandidate, DEBUG_CERTIFICATE_SHA256 } = require('./android-test-candidate.cjs');
const preview = { ...eas.build.preview.env, EAS_BUILD_PROFILE: 'preview', EAS_BUILD_PLATFORM: 'android' };

test('the reviewed DEV preview still passes its build contract', () => {
  assert.doesNotThrow(() => assertProductionTarget(preview));
  assert.doesNotThrow(() => assertDevBuildContract(preview));
  assert.throws(() => assertDevBuildContract({ ...preview, EXPO_PUBLIC_SUPABASE_URL: 'https://different.supabase.co' }), /confirmed canonical DEV/);
});
for (const target of [{ EAS_BUILD_PROFILE: 'production' }, { USKOCI_OTA_TARGET: 'production' }]) {
  test(`production ${Object.keys(target)[0]} cannot bypass readiness with the old override`, () => {
    for (const override of [undefined, 'true', 'false']) {
      const env = { ...preview, ...target, USKOCI_ALLOW_STORE_BUILD: override };
      assert.throws(() => assertProductionTarget(env), /USKOCI_PRODUCTION_NOT_CONFIGURED/);
      assert.throws(() => assertDevBuildContract(env), /USKOCI_PRODUCTION_NOT_CONFIGURED/);
      assert.throws(() => validatePreview({ env }), /USKOCI_PRODUCTION_NOT_CONFIGURED/);
    }
  });
}
test('the retained store profile has no DEV endpoint, DEV client key or bypass', () => {
  const profile = eas.build.production;
  assert.equal(profile.android.buildType, 'app-bundle');
  assert.equal(profile.distribution, 'store');
  for (const key of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'USKOCI_ALLOW_STORE_BUILD'])
    assert.equal(Object.hasOwn(profile.env, key), false);
});
function resolveConfig(env, packageName, check) {
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const app = require('./app.json').expo;
    app.android.package = ${JSON.stringify(packageName)};
    const resolved = require('./app.config.js')({config:app});
    ${check}
  `], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8' });
  return result;
}
test('actual isolated QA config retains its identity, embedded source and no Firebase', () => {
  const result = resolveConfig({ ...preview, USKOCI_PUSH_PROOF_BUILD: '0', EXPO_PUBLIC_USKOCI_DEV_AUTO_PUSH_ENROLL: '0' },
    'rs.uskoci.preview.qa', `
      assert.equal(resolved.android.package,'rs.uskoci.preview.qa');
      assert.equal(resolved.updates.enabled,false);
      assert.equal(resolved.updates.checkAutomatically,'NEVER');
      assert.equal(resolved.updates.useEmbeddedUpdate,true);
      assert.equal(resolved.android.googleServicesFile,undefined);
    `);
  assert.equal(result.status, 0, result.stderr);
});
test('actual Expo production config fails before building even with old override', () => {
  const result = resolveConfig({ ...preview, EAS_BUILD_PROFILE: 'production', USKOCI_OTA_TARGET: 'production', USKOCI_ALLOW_STORE_BUILD: 'true' },
    'rs.uskoci.preview', '');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /USKOCI_PRODUCTION_NOT_CONFIGURED/);
});
test('the isolated QA package still rejects preview push-proof flags', () => {
  const result = resolveConfig(preview, 'rs.uskoci.preview.qa', '');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DEV_AUTO_PUSH_REQUIRES_ISOLATED_PREVIEW_PUSH_PROOF_BUILD|USKOCI_PUSH_PROOF_BUILD_REQUIRES_PREVIEW_PACKAGE/);
});

test('release source inspection preserves blockers and separates unverified remote state', () => {
  const report = readSourceReport();
  const statuses = Object.fromEntries(report.checks.map(check => [check.id, check.status]));
  assert.equal(report.readiness, 'BLOCKED');
  assert.equal(report.target.package, 'rs.uskoci');
  assert.equal(report.target.artifact, 'aab');
  assert.equal(statuses['store-profile'], 'PASS');
  assert.equal(statuses['production-flags'], 'PASS');
  assert.equal(statuses['production-admission'], 'BLOCKED');
  assert.equal(statuses['production-backend'], 'UNVERIFIED');
  assert.equal(statuses['production-firebase'], 'UNVERIFIED');
  for (const key of ['upload-signing', 'play-artifact', 'backend-release-and-device-acceptance', 'play-console']) {
    assert.equal(statuses[key], 'UNVERIFIED');
  }
  assert.equal(typeof report.source.dirty, 'boolean');
  assert.match(report.source.commit, /^[0-9a-f]{40}$/);
  assert.ok(Object.values(report.source.sha256).every(hash => /^[0-9a-f]{64}$/.test(hash)));
});

test('registered store Firebase config matches its project and leaves preview bytes separate', () => {
  const fs = require('node:fs');
  const { androidReleaseIdentity } = require('../app.config.js');
  const firebase = JSON.parse(fs.readFileSync(path.join(root, androidReleaseIdentity.googleServicesFile), 'utf8'));
  assert.equal(firebase.project_info.project_id, 'uskoci-ed59b');
  const client = firebase.client.find(item => item.client_info.android_client_info.package_name === 'rs.uskoci');
  assert.equal(client.client_info.mobilesdk_app_id, '1:383421751370:android:81b3a7ef343a20e8a986b3');
  assert.ok(client.api_key.some(item => typeof item.current_key === 'string' && item.current_key.length > 0));
  assert.equal(firebase.private_key, undefined);
  assert.notEqual(androidReleaseIdentity.googleServicesFile, './config/firebase/google-services.json');
  const previewFirebase = require('../config/firebase/google-services.json');
  assert.equal(previewFirebase.client.some(item => item.client_info.android_client_info.package_name === 'rs.uskoci'), false);
});

test('future admitted production selects its Firebase file without preview enrollment behavior', () => {
  // Exercise the dormant mapping in an isolated VM only. The real production
  // admission rejection is exercised above and remains unchanged in runtime.
  const fs = require('node:fs');
  const vm = require('node:vm');
  const { createRequire } = require('node:module');
  const configRequire = createRequire(path.join(root, 'app.config.js'));
  let admissions = 0;
  const sandbox = { module: { exports: {} }, __dirname: root,
    process: { env: { EAS_BUILD_PROFILE: 'production', USKOCI_OTA_TARGET: 'production' } },
    require(id) {
      if (id === './scripts/build-contract.cjs') return { assertProductionTarget() { admissions++; } };
      return configRequire(id);
    } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'app.config.js'), 'utf8'), sandbox);
  const resolved = sandbox.module.exports({ config: require('../app.json').expo });
  assert.equal(admissions, 1);
  assert.equal(resolved.android.package, 'rs.uskoci');
  assert.equal(resolved.android.googleServicesFile, './config/firebase/google-services.production.json');
  assert.equal(resolved.plugins.includes('./plugins/withFirebaseEnrollmentDisabled.js'), false);
  assert.equal(resolved.updates.requestHeaders['expo-channel-name'], 'production');
  assert.equal(resolved.runtimeVersion, 'uskoci-v1-production-r1');
});

test('a source endpoint, matching Firebase client or old override cannot confer release readiness', () => {
  const candidate = structuredClone(eas);
  candidate.build.production.env = { ...candidate.build.production.env,
    EXPO_PUBLIC_SUPABASE_URL: 'https://separate-project.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'DO_NOT_PRINT_THIS_CLIENT_VALUE',
    USKOCI_ALLOW_STORE_BUILD: 'true' };
  const firebase = { client: [{ client_info: { android_client_info: { package_name: 'rs.uskoci' } },
    api_key: [{ current_key: 'DO_NOT_PRINT_THIS_FIREBASE_VALUE' }], private_key: 'DO_NOT_PRINT_PRIVATE_VALUE' }] };
  const report = inspectAndroidRelease({ app: require('../app.json'), eas: candidate, firebase });
  assert.equal(report.readiness, 'BLOCKED');
  for (const key of ['production-backend', 'production-firebase', 'upload-signing', 'play-artifact']) {
    assert.equal(report.checks.find(check => check.id === key).status, 'UNVERIFIED');
  }
  assert.equal(report.checks.find(check => check.id === 'production-admission').status, 'BLOCKED');
  assert.doesNotMatch(JSON.stringify(report), /DO_NOT_PRINT|separate-project/);
});

test('release source inspection detects an APK profile, missing review and DEV leakage', () => {
  const candidate = structuredClone(eas);
  candidate.build.production.android.buildType = 'apk';
  candidate.build.production.env.EXPO_PUBLIC_USKOCI_NEED_SIGNED_REVIEW = 'false';
  candidate.build.production.env.EXPO_PUBLIC_SUPABASE_URL = preview.EXPO_PUBLIC_SUPABASE_URL;
  candidate.build.production.env.USKOCI_PUSH_PROOF_BUILD = '1';
  const report = inspectAndroidRelease({ app: require('../app.json'), eas: candidate, firebase: null });
  for (const key of ['store-profile', 'production-flags', 'production-backend', 'production-firebase']) {
    assert.equal(report.checks.find(check => check.id === key).status, 'BLOCKED');
  }
});

test('EAS preinstall reports production admission instead of disguising it as a source read failure', () => {
  const result = spawnSync(process.execPath, ['scripts/check-eas-preview.cjs'], { cwd: root,
    env: { ...process.env, EAS_BUILD_PROFILE: 'production', USKOCI_ALLOW_STORE_BUILD: 'true' }, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /USKOCI_PRODUCTION_NOT_CONFIGURED/);
  assert.doesNotMatch(result.stderr, /could not read/);
});

test('readiness CLI remains nonzero and reports only bounded source facts', () => {
  const result = spawnSync(process.execPath, ['scripts/check-android-release-readiness.cjs', '--json'], { cwd: root,
    env: { ...process.env, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'DO_NOT_PRINT_ENV_KEY',
      EXPO_TOKEN: 'DO_NOT_PRINT_TOKEN', USKOCI_ALLOW_STORE_BUILD: 'true' }, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).readiness, 'BLOCKED');
  assert.doesNotMatch(result.stdout + result.stderr, /DO_NOT_PRINT/);
});

test('automatic APK builds keep the isolated package and strip all preview enrollment flags', () => {
  const candidate = selectTestCandidate({ eventName: 'push', previewEnvironment: eas.build.preview.env });
  assert.equal(candidate.target, 'isolated-qa');
  assert.equal(candidate.package, 'rs.uskoci.preview.qa');
  assert.equal(candidate.firebaseConfigured, false);
  assert.equal(candidate.environment.USKOCI_PUSH_PROOF_BUILD, '0');
  assert.equal(candidate.environment.EXPO_PUBLIC_USKOCI_DEV_AUTO_PUSH_ENROLL, '0');
  assert.equal(candidate.environment.USKOCI_PHONE_PREVIEW_BUILD, '0');
  assert.equal(candidate.expectedCertificateSha256, DEBUG_CERTIFICATE_SHA256);
  assert.throws(() => selectTestCandidate({ target: 'phone-preview', eventName: 'push' }), /EXPLICIT_MANUAL_DISPATCH/);
  assert.throws(() => selectTestCandidate({ target: 'production', eventName: 'workflow_dispatch' }), /UNKNOWN_ANDROID_TEST_TARGET/);
});

test('manual phone preview retains Firebase but pins the new embedded source with OTA disabled', () => {
  const candidate = selectTestCandidate({ target: 'phone-preview', eventName: 'workflow_dispatch', previewEnvironment: eas.build.preview.env });
  assert.equal(candidate.package, 'rs.uskoci.preview');
  assert.equal(candidate.firebaseConfigured, true);
  assert.equal(candidate.environment.USKOCI_PUSH_PROOF_BUILD, '1');
  assert.equal(candidate.environment.EXPO_PUBLIC_USKOCI_DEV_AUTO_PUSH_ENROLL, '1');
  const result = resolveConfig({ ...preview, ...candidate.environment }, candidate.package, `
    assert.equal(resolved.android.package,'rs.uskoci.preview');
    assert.equal(resolved.android.googleServicesFile,'./config/firebase/google-services.json');
    assert.equal(resolved.updates.enabled,false);
    assert.equal(resolved.updates.checkAutomatically,'NEVER');
    assert.equal(resolved.updates.useEmbeddedUpdate,true);
    assert.equal(resolved.plugins.includes('./plugins/withFirebaseEnrollmentDisabled.js'),false);
  `);
  assert.equal(result.status, 0, result.stderr);
});

test('phone preview cannot disable OTA for an unrelated package, backend or ordinary build', () => {
  for (const [env, packageName] of [
    [{ ...preview }, 'rs.uskoci.preview.qa'],
    [{ ...preview, EXPO_PUBLIC_SUPABASE_URL: 'https://other.supabase.co' }, 'rs.uskoci.preview'],
    [{ ...preview, USKOCI_PUSH_PROOF_BUILD: '0', EXPO_PUBLIC_USKOCI_DEV_AUTO_PUSH_ENROLL: '0' }, 'rs.uskoci.preview'],
    [{ ...preview, EAS_BUILD_PROFILE: 'unknown' }, 'rs.uskoci.preview'],
  ]) {
    const result = resolveConfig({ ...env, USKOCI_PHONE_PREVIEW_BUILD: '1' }, packageName, '');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PHONE_PREVIEW_REQUIRES_CANONICAL_PREVIEW_PUSH_PROOF_BUILD/);
  }
  const ordinary = resolveConfig({ ...preview, USKOCI_PHONE_PREVIEW_BUILD: '0' }, 'rs.uskoci.preview', `
    assert.equal(resolved.updates.enabled,true);
    assert.equal(resolved.updates.checkAutomatically,'ON_LOAD');
  `);
  assert.equal(ordinary.status, 0, ordinary.stderr);
});
