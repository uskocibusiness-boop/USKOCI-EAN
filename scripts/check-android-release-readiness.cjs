'use strict';

// Offline source inspection. No EAS calls, credential reads, build, deploy or
// release approval. A source/configuration PASS is never a live readiness proof.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { assertProductionTarget, DEV_URL, REQUIRED_BUILD_ENV } = require('./build-contract.cjs');
const { buildIdentity } = require('./build-identity.cjs');
const { androidReleaseIdentity } = require('../app.config.js');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_FILES = ['app.json', 'app.config.js', 'eas.json', 'scripts/build-contract.cjs',
  'scripts/check-eas-preview.cjs', 'scripts/check-android-release-readiness.cjs'];

function inspectAndroidRelease({ app, eas, firebase, identity = androidReleaseIdentity }) {
  const checks = [];
  const add = (id, status, detail) => checks.push({ id, status, detail });
  const profile = eas?.build?.production;
  const env = profile?.env ?? {};
  const bundleProfile = profile?.distribution === 'store' && profile?.environment === 'production'
    && profile?.android?.buildType === 'app-bundle' && profile?.autoIncrement === true
    && profile?.channel === 'production' && env.USKOCI_OTA_TARGET === 'production'
    && eas?.cli?.appVersionSource === 'remote';
  add('store-profile', bundleProfile ? 'PASS' : 'BLOCKED', bundleProfile
    ? 'The production profile selects a store AAB, production environment/channel and remote version increment.'
    : 'The production profile must select the reviewed store AAB, production environment/channel and version increment.');
  const flagsValid = Object.entries(REQUIRED_BUILD_ENV).every(([key, value]) => env[key] === value)
    && env.EXPO_PUBLIC_USE_FAKE_SOURCE === '0'
    && env.USKOCI_PUSH_PROOF_BUILD !== '1' && env.EXPO_PUBLIC_USKOCI_DEV_AUTO_PUSH_ENROLL !== '1';
  add('production-flags', flagsValid ? 'PASS' : 'BLOCKED', flagsValid
    ? 'Signed review and bounded readers are enabled; DEV auto-enrollment and fake data are disabled.'
    : 'Required production review/reader flags are missing or DEV/test behavior is enabled.');
  try {
    assertProductionTarget({ ...env, EAS_BUILD_PROFILE: 'production' });
    add('production-admission', 'UNVERIFIED', 'Source guard admits production; an authorized release contract still needs independent verification.');
  } catch (error) {
    add('production-admission', 'BLOCKED', String(error.message).startsWith('USKOCI_PRODUCTION_NOT_CONFIGURED:')
      ? 'USKOCI_PRODUCTION_NOT_CONFIGURED: the separate backend and release contract have not been admitted.'
      : 'Production admission could not be verified.');
  }
  const endpoint = env.EXPO_PUBLIC_SUPABASE_URL;
  const publicClient = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const hasBackend = typeof endpoint === 'string' && endpoint.length > 0
    && typeof publicClient === 'string' && publicClient.length > 0;
  add('production-backend', endpoint === DEV_URL ? 'BLOCKED' : 'UNVERIFIED', !hasBackend
    ? 'No complete production endpoint/client pair exists in the tracked profile. EAS environment values were not read.'
    : endpoint === DEV_URL
      ? 'The DEV endpoint cannot serve as the production release contract.'
      : 'A source endpoint/client pair exists; project identity, public-key form, schema/Auth and lifecycle readiness remain unverified.');
  const clients = Array.isArray(firebase?.client) ? firebase.client : [];
  const storeClient = clients.some(client => client?.client_info?.android_client_info?.package_name === identity?.package);
  add('production-firebase', storeClient ? 'UNVERIFIED' : 'BLOCKED', storeClient
    ? 'A matching client exists in the tracked Firebase file; production native mapping, FCM credentials and delivery still need verification.'
    : 'The tracked Firebase file has no Android client for the store package. Preview Firebase cannot identify the store app.');
  add('upload-signing', 'UNVERIFIED', profile?.credentialsSource === 'remote'
    ? 'Remote credentials are selected. No remote upload key, certificate or Play App Signing state was inspected.'
    : 'A reviewed credential source and upload certificate have not been verified.');
  add('play-artifact', 'UNVERIFIED', 'No signed store AAB was inspected: require package/version, target API, non-debuggable manifest, native library alignment and Play-delivered install evidence. A QA APK is insufficient.');
  add('backend-release-and-device-acceptance', 'UNVERIFIED', 'This source-only check cannot attest R01/R10 release bindings, retention/export, real two-account flows, FCM delivery or physical Android behavior.');
  add('play-console', 'UNVERIFIED', 'Play account/app access, applicable testing eligibility, listing/content declarations and review state were not inspected.');
  return {
    schema: 'USKOCI_ANDROID_RELEASE_SOURCE_READINESS_V1',
    readiness: checks.some(check => check.status === 'BLOCKED') ? 'BLOCKED' : 'UNVERIFIED',
    target: { platform: 'android', profile: 'production', package: identity?.package ?? null,
      runtimeVersion: identity?.runtimeVersion ?? null, artifact: 'aab', version: app?.expo?.version ?? null },
    checks,
    boundaries: ['Tracked source only; EAS environment, credentials, backend and Play Console were not queried.',
      'No build, signing, publishing or production bypass was performed. PASS applies only to its named source check.'],
  };
}

function readSourceReport(root = ROOT) {
  const read = filename => JSON.parse(fs.readFileSync(path.join(root, filename), 'utf8'));
  const app = read('app.json');
  let firebase = null;
  try { firebase = read('config/firebase/google-services.json'); } catch { /* Missing/invalid file fails closed. */ }
  const report = inspectAndroidRelease({ app, eas: read('eas.json'), firebase });
  const identity = buildIdentity({ root, version: app?.expo?.version, environment: {} });
  report.source = { commit: identity.sourceCommit, dirty: identity.sourceDirty,
    sha256: Object.fromEntries(SOURCE_FILES.map(filename => [filename,
      createHash('sha256').update(fs.readFileSync(path.join(root, filename))).digest('hex')])) };
  return report;
}

function main(argv = process.argv.slice(2)) {
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== '--json')) {
    console.error('Usage: node scripts/check-android-release-readiness.cjs [--json]');
    return 2;
  }
  let report;
  try { report = readSourceReport(); } catch {
    console.error('Android release readiness UNVERIFIED: required source configuration could not be read.');
    return 2;
  }
  if (argv[0] === '--json') console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Android release readiness: ${report.readiness} (source only; ${report.target.package} AAB)`);
    for (const check of report.checks) console.log(`${check.status} ${check.id}: ${check.detail}`);
  }
  // No source-only result can authorize or attest a public release.
  return 1;
}

module.exports = { inspectAndroidRelease, readSourceReport, main };
if (require.main === module) process.exitCode = main();
