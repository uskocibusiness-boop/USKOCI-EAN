'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEV_URL, SIGNED_REVIEW_ENV, assertDevBuildContract, assertProductionTarget } = require('../build-contract.cjs');

const preview = () => ({ EXPO_PUBLIC_SUPABASE_URL: DEV_URL, ...SIGNED_REVIEW_ENV });
test('DEV admits the complete signed review contract', () => assert.doesNotThrow(() => assertDevBuildContract(preview())));
for (const key of Object.keys(SIGNED_REVIEW_ENV)) {
  for (const value of [undefined, 'false', '1', 'TRUE']) {
    test(`DEV rejects an absent or incompatible ${key}=${value}`, () => {
      assert.throws(() => assertDevBuildContract({ ...preview(), [key]: value }), new RegExp(key));
    });
  }
}
test('production cannot borrow DEV or bypass the missing production readiness through an arbitrary URL', () => {
  for (const flag of ['EAS_BUILD_PROFILE', 'USKOCI_OTA_TARGET']) {
    for (const url of [DEV_URL, 'https://different.supabase.co', undefined]) {
      assert.throws(() => assertProductionTarget({ [flag]: 'production', EXPO_PUBLIC_SUPABASE_URL: url }), /USKOCI_PRODUCTION_NOT_CONFIGURED/);
    }
  }
});
test('the actual Expo config refuses production build and production OTA', () => {
  const configure = require('../../app.config.js');
  const raw = require('../../app.json');
  const oldProfile = process.env.EAS_BUILD_PROFILE, oldTarget = process.env.USKOCI_OTA_TARGET;
  try {
    delete process.env.EAS_BUILD_PROFILE;
    process.env.USKOCI_OTA_TARGET = 'production';
    assert.throws(() => configure({ config: raw.expo }), /USKOCI_PRODUCTION_NOT_CONFIGURED/);
    delete process.env.USKOCI_OTA_TARGET;
    process.env.EAS_BUILD_PROFILE = 'production';
    assert.throws(() => configure({ config: raw.expo }), /USKOCI_PRODUCTION_NOT_CONFIGURED/);
  } finally {
    if (oldProfile === undefined) delete process.env.EAS_BUILD_PROFILE; else process.env.EAS_BUILD_PROFILE = oldProfile;
    if (oldTarget === undefined) delete process.env.USKOCI_OTA_TARGET; else process.env.USKOCI_OTA_TARGET = oldTarget;
  }
});
