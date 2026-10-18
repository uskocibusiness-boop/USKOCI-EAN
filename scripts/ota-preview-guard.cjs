'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PROJECT_ID = '1e6cc490-9851-4741-9226-128612122db6';
const UPDATE_URL = `https://u.expo.dev/${PROJECT_ID}`;
const PREVIEW_RUNTIME = 'uskoci-v1-preview-r1';
const PRODUCTION_RUNTIME = 'uskoci-v1-production-r1';

const nativeSensitive = [
  /^package(?:-lock)?\.json$/,
  /^app\.json$/,
  /^app\.config\.js$/,
  /^scripts\/build-contract\.cjs$/,
  /^eas\.json$/,
  /^plugins\//,
  /^modules\//,
  /^patches\//,
  /^config\/firebase\//,
  /^assets\/brand\/app-icon\//,
  /^assets\/fonts\//,
  /^assets\/entry-splash-mark\.png$/,
  /^android\//,
  /^ios\//,
];

function readJson(root, file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}
function requireCondition(value, message) {
  if (!value) throw new Error(message);
}
function validateStatic(root = path.resolve(__dirname, '..')) {
  const app = readJson(root, 'app.json').expo;
  const eas = readJson(root, 'eas.json');
  const pkg = readJson(root, 'package.json');
  requireCondition(app.owner === 'sljivas-team' && app.slug === 'uskoci' && app.extra?.eas?.projectId === PROJECT_ID,
    'OTA_PROJECT_IDENTITY_MISMATCH');
  requireCondition(app.android?.package === 'rs.uskoci.preview', 'OTA_SOURCE_PACKAGE_NOT_PREVIEW');
  requireCondition(app.runtimeVersion === PREVIEW_RUNTIME, 'OTA_PREVIEW_RUNTIME_MISMATCH');
  requireCondition(app.updates?.url === UPDATE_URL && app.updates?.enabled === true
    && app.updates?.requestHeaders?.['expo-channel-name'] === 'preview', 'OTA_PREVIEW_UPDATE_CONFIG_MISMATCH');
  requireCondition(app.updates?.disableAntiBrickingMeasures !== true, 'OTA_ANTI_BRICKING_DISABLED');
  requireCondition(eas.build?.preview?.channel === 'preview' && eas.build?.production?.channel === 'production',
    'OTA_CHANNELS_NOT_SEPARATE');
  requireCondition(eas.build?.preview?.env?.USKOCI_OTA_TARGET === 'preview'
    && eas.build?.production?.env?.USKOCI_OTA_TARGET === 'production', 'OTA_TARGET_ENV_MISMATCH');
  requireCondition(pkg.dependencies?.['expo-updates'] === '~57.0.19', 'OTA_EXPO_UPDATES_VERSION_MISMATCH');
  return { projectId: PROJECT_ID, updateUrl: UPDATE_URL, previewRuntime: PREVIEW_RUNTIME, productionRuntime: PRODUCTION_RUNTIME };
}

function changedFiles(root, base) {
  if (!/^[0-9a-f]{40}$/.test(base || '')) throw new Error('OTA_BASELINE_SHA_INVALID');
  const out = execFileSync('git', ['diff', '--name-only', `${base}..HEAD`], { cwd: root, encoding: 'utf8' });
  return out.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
}
function assertOtaCompatible(root, base) {
  const files = changedFiles(root, base);
  const blocked = files.filter(file => nativeSensitive.some(pattern => pattern.test(file)));
  if (blocked.length) throw new Error(`OTA_NATIVE_RUNTIME_CHANGED:${blocked.join(',')}`);
  return files;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const config = validateStatic(root);
  const index = process.argv.indexOf('--baseline');
  const baseline = index >= 0 ? process.argv[index + 1] : null;
  const files = baseline ? assertOtaCompatible(root, baseline) : [];
  console.log(JSON.stringify({ ok: true, ...config, checkedFrom: baseline, changedFiles: files }, null, 2));
}

module.exports = { validateStatic, assertOtaCompatible, nativeSensitive };
if (require.main === module) {
  try { main(); } catch (error) { console.error(String(error?.message ?? error)); process.exitCode = 1; }
}
