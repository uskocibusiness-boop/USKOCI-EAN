'use strict';

// EAS-only lifecycle hook: built-ins suffice before dependency installation.
// No network, credential reads, environment writes, or key values in output.
const fs = require('node:fs');
const path = require('node:path');
const { assertProductionBackend } = require('./production-backend-guard.cjs');

const PROJECT_ID = '1e6cc490-9851-4741-9226-128612122db6';
const SUPABASE_REF = 'leqcwgzvjsxugfgzdmth';
const UPDATE_URL = `https://u.expo.dev/${PROJECT_ID}`;
const PREVIEW_RUNTIME = 'uskoci-v1-preview-r1';
const PRODUCTION_RUNTIME = 'uskoci-v1-production-r1';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function isPublicKeyForm(value, expectedRef = SUPABASE_REF) {
  if (typeof value !== 'string' || value.trim() !== value) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return false;
  try {
    const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8'));
    return payload.role === 'anon' && payload.ref === expectedRef;
  } catch {
    return false;
  }
}

function validateFirebase(firebase) {
  requireCondition(firebase?.project_info?.project_id === 'uskoci-ed59b' &&
    firebase?.project_info?.project_number === '383421751370', 'Expected the confirmed public Firebase project.');
  requireCondition(Array.isArray(firebase.client) && firebase.client.length === 1 &&
    firebase.client[0]?.client_info?.mobilesdk_app_id === '1:383421751370:android:3e19dd87280aa317a986b3' &&
    firebase.client[0]?.client_info?.android_client_info?.package_name === 'rs.uskoci.preview',
  'Expected the confirmed Firebase Android client and preview package.');
  requireCondition(Array.isArray(firebase.client[0].api_key) &&
    firebase.client[0].api_key.some(key => typeof key?.current_key === 'string' && /^AIza[A-Za-z0-9_-]{20,}$/.test(key.current_key)),
  'The public Firebase Android API key is absent or malformed.');
  const serialized = JSON.stringify(firebase);
  requireCondition(!/"(?:private_key|private_key_id|client_secret)"|PRIVATE KEY|"service_account"/i.test(serialized),
    'Firebase client configuration must not contain private credential material.');
}

/**
 * The two reviewed Android builds this hook admits. `preview` is the internal APK the phones have run since
 * 2026-09; `production` is the store app bundle for Google Play (owner, 2026-09-23: "večeras šaljem app na Google
 * Play"). Both keep every other boundary below: the same project, package, version floor, public backend form,
 * fake-source ban and strict environment validation. The store build additionally requires an approved,
 * isolated production backend; this is NOT a store-release certificate. Any other profile is refused.
 */
const REVIEWED_PROFILES = {
  preview: profile => profile?.autoIncrement === true && profile?.distribution === 'internal' && profile?.environment === 'preview' &&
    profile?.channel === 'preview' && profile?.credentialsSource === 'remote' && profile?.android?.buildType === 'apk',
  production: profile => profile?.autoIncrement === true && profile?.distribution === 'store' && profile?.environment === 'production' &&
    profile?.channel === 'production' && profile?.credentialsSource === 'remote' && profile?.android?.buildType === 'app-bundle',
};

function validatePreview({ app, eas, env, firebase }) {
  const expo = app?.expo;
  const name = env.EAS_BUILD_PROFILE;
  const reviewed = Object.prototype.hasOwnProperty.call(REVIEWED_PROFILES, name) ? REVIEWED_PROFILES[name] : null;
  const selected = reviewed ? eas?.build?.[name] : null;
  requireCondition(expo?.owner === 'sljivas-team' && expo?.slug === 'uskoci' &&
    expo?.extra?.eas?.projectId === PROJECT_ID, 'Expected the existing @sljivas-team/uskoci EAS project.');
  const store = name === 'production';
  const channel = store ? 'production' : 'preview';
  const runtime = store ? PRODUCTION_RUNTIME : PREVIEW_RUNTIME;
  requireCondition(expo?.runtimeVersion === runtime && expo?.updates?.url === UPDATE_URL
    && expo?.updates?.requestHeaders?.['expo-channel-name'] === channel,
    'Expected the reviewed OTA runtime, URL and channel for this build profile.');
  requireCondition(env.USKOCI_OTA_TARGET === channel,
    'USKOCI_OTA_TARGET must match the reviewed build channel.');
  requireCondition(expo?.android?.package === (store ? 'rs.uskoci' : 'rs.uskoci.preview'),
    store ? 'Expected the Google Play package rs.uskoci for the store bundle.' : 'Expected the existing Android preview package.');
  requireCondition(Number.isSafeInteger(expo?.android?.versionCode) && expo.android.versionCode >= 35,
    'Android versionCode must retain the source seed floor of 35.');
  requireCondition(!!reviewed && env.EAS_BUILD_PLATFORM === 'android',
    'This EAS hook admits only the reviewed Android preview APK or the reviewed store app bundle.');
  requireCondition(eas?.cli?.appVersionSource === 'remote' && reviewed(selected),
    name === 'production'
      ? 'Expected the reviewed production store app bundle profile with remote credentials and version increment.'
      : 'Expected the reviewed preview internal APK profile with remote credentials and version increment.');
  requireCondition(!env.EAS_BUILD_PROJECT_ID || env.EAS_BUILD_PROJECT_ID === PROJECT_ID,
    'The EAS job project does not match the selected existing project.');
  requireCondition(env.EXPO_PUBLIC_USE_FAKE_SOURCE !== '1' && env.NODE_ENV !== 'test' &&
    env.JEST_WORKER_ID === undefined, 'Preview cannot use the fake or test data composition.');
  let expectedRef = SUPABASE_REF;
  if (store) {
    requireCondition(!Object.prototype.hasOwnProperty.call(selected.env ?? {}, 'EXPO_PUBLIC_SUPABASE_URL') &&
      !Object.prototype.hasOwnProperty.call(selected.env ?? {}, 'EXPO_PUBLIC_SUPABASE_ANON_KEY'),
      'USKOCI_PRODUCTION_PROFILE_MUST_NOT_PIN_DEV_BACKEND');
    expectedRef = assertProductionBackend(env);
  } else {
    requireCondition(env.EXPO_PUBLIC_SUPABASE_URL === `https://${SUPABASE_REF}.supabase.co`,
      'EXPO_PUBLIC_SUPABASE_URL must identify the confirmed canonical Supabase project.');
  }
  requireCondition(isPublicKeyForm(env.EXPO_PUBLIC_SUPABASE_ANON_KEY, expectedRef),
    'EXPO_PUBLIC_SUPABASE_ANON_KEY must be a public publishable key or project-bound anon JWT.');
  if (store) {
    // The reviewed Firebase client belongs to rs.uskoci.preview; the store package must not borrow it.
    requireCondition(!expo?.android?.googleServicesFile, 'The store bundle must not carry the preview Firebase client.');
    return;
  }
  requireCondition(expo?.android?.googleServicesFile === './config/firebase/google-services.json' &&
    expo?.plugins?.includes('./plugins/withFirebaseEnrollmentDisabled.js'),
  'Expected the reviewed public Firebase file and disabled native enrollment configuration.');
  validateFirebase(firebase);
}

function main() {
  let app;
  let eas;
  let firebase;
  try {
    const root = path.resolve(__dirname, '..');
    const raw = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
    app = { expo: require('../app.config.js')({ config: raw.expo }) };
    eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
    firebase = JSON.parse(fs.readFileSync(path.join(root, 'config/firebase/google-services.json'), 'utf8'));
  } catch {
    console.error('EAS preview preflight FAIL: could not read the source app/EAS configuration.');
    return 1;
  }
  try {
    validatePreview({ app, eas, env: process.env, firebase });
    console.log(`EAS ${process.env.EAS_BUILD_PROFILE} preflight PASS: existing project/package/profile and public environment form. Auth, signing artifact and push delivery remain unproven.`);
    return 0;
  } catch (error) {
    console.error(`EAS preview preflight FAIL: ${error.message}`);
    return 1;
  }
}

module.exports = { validatePreview, validateFirebase };
if (require.main === module) process.exitCode = main();
