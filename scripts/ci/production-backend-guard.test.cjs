'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertProductionBackend } = require('../production-backend-guard.cjs');

const REF = 'abcdefghijklmnopqrst';
const good = () => ({
  USKOCI_PRODUCTION_BACKEND_APPROVED: '1',
  USKOCI_PRODUCTION_BACKEND_REF: REF,
  EXPO_PUBLIC_SUPABASE_URL: 'https://' + REF + '.supabase.co',
});

test('production requires an explicit reviewed project identity; returns no key', () => {
  assert.equal(assertProductionBackend(good()), REF);
});
for (const changes of [
  { USKOCI_PRODUCTION_BACKEND_APPROVED: undefined },
  { USKOCI_PRODUCTION_BACKEND_APPROVED: '0' },
  { USKOCI_PRODUCTION_BACKEND_REF: undefined },
  { USKOCI_PRODUCTION_BACKEND_REF: 'anotherwrongproject' },
  { EXPO_PUBLIC_SUPABASE_URL: 'https://wrong.example' },
  { EXPO_PUBLIC_SUPABASE_URL: 'https://' + REF + '.supabase.co.evil.example' },
  { EXPO_PUBLIC_SUPABASE_URL: 'http://' + REF + '.supabase.co' },
  { EXPO_PUBLIC_SUPABASE_URL: 'https://user:password@' + REF + '.supabase.co' },
  { EXPO_PUBLIC_SUPABASE_URL: 'https://' + REF + '.supabase.co/?token=bad' },
  { EXPO_PUBLIC_SUPABASE_URL: 'https://' + REF + '.supabase.co/path' },
  { EXPO_PUBLIC_SUPABASE_URL: 'https://leqcwgzvjsxugfgzdmth.supabase.co',
    USKOCI_PRODUCTION_BACKEND_REF: 'leqcwgzvjsxugfgzdmth' },
  { EXPO_PUBLIC_SUPABASE_URL: 'https://wjxilkkyyuxyzbvhgmop.supabase.co',
    USKOCI_PRODUCTION_BACKEND_REF: 'wjxilkkyyuxyzbvhgmop' },
  { EXPO_PUBLIC_SUPABASE_URL: 'https://syyhtetqqtkwisipsjrm.supabase.co',
    USKOCI_PRODUCTION_BACKEND_REF: 'syyhtetqqtkwisipsjrm' },
]) {
  test('store cannot use missing, unapproved, non-production or malformed target: ' +
    JSON.stringify(Object.keys(changes)), () => {
    const env = { ...good(), ...changes };
    assert.throws(() => assertProductionBackend(env), /^Error: USKOCI_PRODUCTION_BACKEND_/);
  });
}
