// CI-only overlay for the owner's existing emulator package/session. Not an app build profile or release target.
const fs = require('node:fs');
const path = require('node:path');

const OVERLAY = `
// Disposable existing-dev QA overlay: bundled source only, no preview OTA or Firebase enrollment.
const existingDevQaBase = module.exports;
module.exports = (args) => {
  const config = existingDevQaBase({...args, config: {...args.config,
    android: {...args.config.android, package: 'rs.uskoci.dev'}}});
  if (config.android.package !== 'rs.uskoci.dev' || config.android.googleServicesFile) {
    throw new Error('EXISTING_DEV_QA_IDENTITY_NOT_ISOLATED');
  }
  return {...config, updates: {...config.updates, enabled: false, checkAutomatically: 'NEVER'}};
};
module.exports.otaConfig = existingDevQaBase.otaConfig;
`;

function configure(root, env) {
  if (env.CI !== '1' || !env.GITHUB_REF_NAME?.startsWith('visual/emulator-existing-dev-')
    || env.USKOCI_PUSH_PROOF_BUILD === '1' || env.EAS_BUILD_PROFILE !== 'preview' || env.USKOCI_OTA_TARGET !== 'preview')
    throw new Error('EXISTING_DEV_QA_SCOPE_REQUIRED');
  const file = path.join(root, 'app.config.js'), before = fs.readFileSync(file, 'utf8');
  if (before.includes('existingDevQaBase')) throw new Error('EXISTING_DEV_QA_ALREADY_CONFIGURED');
  const json = path.join(root, 'app.json'), app = JSON.parse(fs.readFileSync(json, 'utf8'));
  if (app.expo.android.package !== 'rs.uskoci.preview') throw new Error('EXISTING_DEV_QA_UNEXPECTED_BASE');
  app.expo.android.package = 'rs.uskoci.dev';
  fs.writeFileSync(json, JSON.stringify(app, null, 2) + '\n');
  fs.writeFileSync(file, before + OVERLAY);
}
if (require.main === module) configure(process.cwd(), process.env);
module.exports = {configure, OVERLAY};
