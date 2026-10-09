const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const {configure, OVERLAY} = require('./configure-existing-dev-qa.cjs');

test('the actual Expo config keeps the dev package, disables OTA and cannot enroll preview Firebase', () => {
  const filename = path.resolve('app.config.js');
  const source = fs.readFileSync(filename, 'utf8');
  const sandbox = {module: {exports: {}}, require: require('node:module').createRequire(filename), __dirname: process.cwd(),
    process: {env: {EAS_BUILD_PROFILE: 'preview', USKOCI_OTA_TARGET: 'preview', USKOCI_PUSH_PROOF_BUILD: '0'}}};
  vm.runInNewContext(source + OVERLAY, sandbox);
  const base = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
  const result = sandbox.module.exports({config: base});
  assert.equal(result.android.package, 'rs.uskoci.dev'); assert.equal(base.android.package, 'rs.uskoci.preview');
  assert.equal(result.android.googleServicesFile, undefined); assert.equal(result.updates.enabled, false);
  assert.equal(result.updates.checkAutomatically, 'NEVER'); assert.equal(result.android.versionCode, base.android.versionCode);
  assert.equal(result.runtimeVersion, 'uskoci-v1-preview-r1');
});

test('overlay refuses ordinary branches, production, push and repeated invocation before another write', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uskoci-existing-dev-qa-'));
  const env = {CI: '1', GITHUB_REF_NAME: 'visual/emulator-existing-dev-test', EAS_BUILD_PROFILE: 'preview', USKOCI_OTA_TARGET: 'preview'};
  try {
    fs.writeFileSync(path.join(root, 'app.config.js'), 'module.exports = x => x.config;');
    fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify({expo: {android: {package: 'rs.uskoci.preview'}}}));
    for (const bad of [{GITHUB_REF_NAME: 'work/x'}, {EAS_BUILD_PROFILE: 'production'}, {USKOCI_OTA_TARGET: 'production'}, {CI: '0'}, {USKOCI_PUSH_PROOF_BUILD: '1'}]) {
      assert.throws(() => configure(root, {...env, ...bad}), /SCOPE_REQUIRED/);
      assert.ok(!fs.readFileSync(path.join(root, 'app.config.js'), 'utf8').includes('existingDevQaBase'));
    }
    configure(root, env);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo.android.package, 'rs.uskoci.dev');
    assert.throws(() => configure(root, env), /ALREADY_CONFIGURED/);
  } finally {
    // Exact files created above only; no recursive or computed directory deletion.
    for (const name of ['app.config.js', 'app.json']) fs.unlinkSync(path.join(root, name));
    fs.rmdirSync(root);
  }
});
