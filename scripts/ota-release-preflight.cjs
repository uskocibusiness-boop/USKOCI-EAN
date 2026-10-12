'use strict';

/**
 * USKOCI OTA bundle gate. Source-only until the owner authorizes an update.
 * EAS build-profile env is NOT automatically used by eas update. An OTA that
 * loses feature flags can hide Poruke, P6 search or AI map conversation.
 * The effective Expo environment MUST match the embedded-build contract.
 *
 * Plan only: node scripts/ota-release-preflight.cjs --target preview --plan-only
 * Publish candidate: pass --baseline <40-character Git SHA of the installed
 * native binary source> and export the exact public vars from eas.json
 * in the SAME environment used to bundle the OTA update.
 * This script NEVER calls Expo, Supabase or any external service.
 */
const fs = require('node:fs');
const path = require('node:path');
const { validateStatic, assertOtaCompatible } = require('./ota-preview-guard.cjs');
const { otaConfig } = require('../app.config.js');

const DEV_HOST = 'leqcwgzvjsxugfgzdmth.supabase.co';
const REQUIRED_EXPOSED_FLAGS = Object.freeze([
  'EXPO_PUBLIC_P6_DISCOVERY_READER',
  'EXPO_PUBLIC_VOICE_MESSAGES',
  'EXPO_PUBLIC_AI_LOCATION_DIALOGUE',
  'EXPO_PUBLIC_CONVERSATION_INBOX',
]);

function requireState(ok, code) {
  if (!ok) throw new Error(code);
}

function sourcePlan(root, target) {
  requireState(target === 'preview' || target === 'production', 'OTA_TARGET_UNKNOWN');
  const file = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
  const cfg = validateStatic(root);
  const profile = file.build?.[target];
  requireState(profile && profile.channel === target
    && profile.env?.USKOCI_OTA_TARGET === target, 'OTA_CHANNEL_PROFILE_MISMATCH');
  const expected = profile.env;
  requireState(typeof expected.EXPO_PUBLIC_SUPABASE_URL === 'string', 'OTA_BACKEND_MISSING');
  const host = new URL(expected.EXPO_PUBLIC_SUPABASE_URL).hostname;
  requireState(host.endsWith('.supabase.co'), 'OTA_BACKEND_UNRECOGNIZED');
  for (const key of REQUIRED_EXPOSED_FLAGS) {
    requireState(expected[key] === '1', 'OTA_REQUIRED_FEATURE_DISABLED:' + key);
  }
  requireState(expected.EXPO_PUBLIC_USE_FAKE_SOURCE !== '1', 'OTA_FAKE_SOURCE_ENABLED');
  requireState(typeof expected.EXPO_PUBLIC_SUPABASE_ANON_KEY === 'string'
    && expected.EXPO_PUBLIC_SUPABASE_ANON_KEY.length > 15, 'OTA_PUBLISHABLE_KEY_MISSING');
  requireState(cfg.updateUrl === otaConfig.UPDATE_URL, 'OTA_SERVER_URL_DRIFT');
  const runtimeVersion = target === 'preview' ? otaConfig.PREVIEW_RUNTIME : otaConfig.PRODUCTION_RUNTIME;
  requireState(runtimeVersion === (target === 'preview' ? cfg.previewRuntime : cfg.productionRuntime),
    'OTA_RUNTIME_DRIFT');
  // The configured Store AAB currently points to the DEV database. Blocking
  // release here is deliberate: do not publish real user traffic to DEV.
  if (target === 'production') {
    requireState(host !== DEV_HOST, 'PRODUCTION_BACKEND_IS_DEV');
  }
  const env = Object.fromEntries(Object.entries(expected)
    .filter(([key]) => key.startsWith('EXPO_PUBLIC_') || key === 'USKOCI_OTA_TARGET'));
  return Object.freeze({ target, runtimeVersion, channel: target, env, envKeys: Object.keys(env).sort() });
}

/** No values or secrets are logged. Missing env keys fail closed. */
function verifyBundleEnvironment(plan, actual) {
  for (const key of plan.envKeys) {
    requireState(actual[key] === plan.env[key], 'OTA_BUNDLE_ENV_MISMATCH:' + key);
  }
  if (plan.target === 'production') {
    requireState(actual.EXPO_PUBLIC_USE_FAKE_SOURCE !== '1', 'OTA_FAKE_SOURCE_ENABLED');
  }
  return true;
}

function preflight({ root = path.resolve(__dirname, '..'), target, baseline, planOnly = false,
  environment = process.env } = {}) {
  const plan = sourcePlan(root, target);
  if (planOnly) return { result: 'SOURCE_PLAN_ONLY', target: plan.target,
    runtimeVersion: plan.runtimeVersion, channel: plan.channel,
    bundleEnvKeysRequired: plan.envKeys, publishAllowed: false };
  requireState(typeof baseline === 'string' && /^[a-f0-9]{40}$/i.test(baseline),
    'OTA_INSTALLED_BINARY_BASELINE_REQUIRED');
  // Refuses changes in app/native libraries, config, packages or native patches.
  const changed = assertOtaCompatible(root, baseline);
  verifyBundleEnvironment(plan, environment);
  return { result: 'LOCAL_BUNDLE_PREFLIGHT_PASS', target: plan.target,
    runtimeVersion: plan.runtimeVersion, channel: plan.channel,
    changedFilesChecked: changed.length, publishAllowed: false,
    manualChecksStillRequired: ['INSTALLED_PACKAGE_RUNTIME_CHANNEL', 'EAS_CHANNEL_BRANCH',
      'PHONE_UPDATE_INSTALL_AND_ROLLBACK', 'EXPLICIT_OWNER_PUBLISH_APPROVAL'] };
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}

if (require.main === module) {
  try {
    const planOnly = process.argv.includes('--plan-only');
    const report = preflight({ target: arg('--target'), baseline: arg('--baseline'), planOnly });
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } catch (error) {
    // Never print public token strings, signing material or full ENV objects.
    process.stderr.write(String(error?.message ?? error) + '\n');
    process.exitCode = 1;
  }
}

module.exports = { REQUIRED_EXPOSED_FLAGS, sourcePlan, verifyBundleEnvironment, preflight };
