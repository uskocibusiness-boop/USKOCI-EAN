'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const { sourcePlan, verifyBundleEnvironment, preflight } = require('../ota-release-preflight.cjs');

function isolatedManifest(edit) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'uskoci-ota-contract-'));
  try {
    for (const file of ['app.json', 'eas.json', 'package.json'])
      fs.copyFileSync(path.join(root, file), path.join(temp, file));
    const easFile = path.join(temp, 'eas.json');
    const eas = JSON.parse(fs.readFileSync(easFile, 'utf8'));
    edit(eas);
    fs.writeFileSync(easFile, JSON.stringify(eas));
    return sourcePlan(temp, 'preview');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

test('preview retains every phone feature gate and its fixed runtime', () => {
  const plan = sourcePlan(root, 'preview');
  assert.equal(plan.runtimeVersion, 'uskoci-v1-preview-r1');
  assert.equal(plan.channel, 'preview');
  for (const key of ['EXPO_PUBLIC_P6_DISCOVERY_READER','EXPO_PUBLIC_CONVERSATION_INBOX',
    'EXPO_PUBLIC_AI_LOCATION_DIALOGUE','EXPO_PUBLIC_VOICE_MESSAGES'])
    assert.equal(plan.env[key], '1', key);
  assert.equal(verifyBundleEnvironment(plan, { ...plan.env }), true);
});

test('publishing without the actual OTA bundler environment refuses instead of silently hiding Poruke', () => {
  const plan = sourcePlan(root, 'preview');
  const missing = { ...plan.env };
  delete missing.EXPO_PUBLIC_CONVERSATION_INBOX;
  assert.throws(() => verifyBundleEnvironment(plan, missing),
    /OTA_BUNDLE_ENV_MISMATCH:EXPO_PUBLIC_CONVERSATION_INBOX/);
  assert.throws(() => verifyBundleEnvironment(plan,
    { ...plan.env, EXPO_PUBLIC_P6_DISCOVERY_READER: '0' }),
    /OTA_BUNDLE_ENV_MISMATCH:EXPO_PUBLIC_P6_DISCOVERY_READER/);
  assert.throws(() => verifyBundleEnvironment(plan,
    { ...plan.env, EXPO_PUBLIC_SUPABASE_URL: 'https:\/\/other.supabase.co' }),
    /OTA_BUNDLE_ENV_MISMATCH:EXPO_PUBLIC_SUPABASE_URL/);
  assert.throws(() => verifyBundleEnvironment(plan,
    { ...plan.env, USKOCI_OTA_TARGET: 'production' }),
    /OTA_BUNDLE_ENV_MISMATCH:USKOCI_OTA_TARGET/);
});

test('a release-plan inspection is never a publish approval and does not require Git or Expo credentials', () => {
  const report = preflight({ root, target: 'preview', planOnly: true });
  assert.equal(report.result, 'SOURCE_PLAN_ONLY');
  assert.equal(report.publishAllowed, false);
  assert.equal(report.bundleEnvKeysRequired.includes('EXPO_PUBLIC_CONVERSATION_INBOX'), true);
  assert.throws(() => preflight({ root, target: 'preview', environment: sourcePlan(root,'preview').env }),
    /OTA_INSTALLED_BINARY_BASELINE_REQUIRED/);
});

test('if either build turns off permanent Poruke tab, source plan fails closed', () => {
  assert.throws(() => isolatedManifest(eas => {
    eas.build.preview.env.EXPO_PUBLIC_CONVERSATION_INBOX = '0';
  }), /OTA_REQUIRED_FEATURE_DISABLED:EXPO_PUBLIC_CONVERSATION_INBOX/);
  assert.throws(() => isolatedManifest(eas => {
    delete eas.build.preview.env.EXPO_PUBLIC_P6_DISCOVERY_READER;
  }), /OTA_REQUIRED_FEATURE_DISABLED:EXPO_PUBLIC_P6_DISCOVERY_READER/);
});

test('publishing production OTA is barred while Store profile still points at canonical DEV database', () => {
  assert.throws(() => sourcePlan(root, 'production'), /PRODUCTION_BACKEND_IS_DEV/);
});

test('unrecognized OTA channel, test data and missing public keys cannot pass preflight', () => {
  assert.throws(() => sourcePlan(root,'other'), /OTA_TARGET_UNKNOWN/);
  assert.throws(() => isolatedManifest(eas => {
    eas.build.preview.env.EXPO_PUBLIC_USE_FAKE_SOURCE = '1';
  }), /OTA_FAKE_SOURCE_ENABLED/);
  assert.throws(() => isolatedManifest(eas => {
    delete eas.build.preview.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  }), /OTA_PUBLISHABLE_KEY_MISSING/);
});
