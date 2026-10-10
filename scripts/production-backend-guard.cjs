'use strict';

// Store build admission only: public project identity, no network or privileged keys.
// The reviewed Android preview remains on canonical DEV/ALPHA. No production
// backend has been approved by this source change.
const BLOCKED_REFS = new Set([
  'leqcwgzvjsxugfgzdmth', // canonical DEV/ALPHA
  'wjxilkkyyuxyzbvhgmop', // historical alpha
  'syyhtetqqtkwisipsjrm', // disposable E2E lab
]);
const SUPABASE_REF = /^[a-z0-9]{20}$/;

function assertProductionBackend(env) {
  if (env?.USKOCI_PRODUCTION_BACKEND_APPROVED !== '1') {
    throw new Error('USKOCI_PRODUCTION_BACKEND_APPROVAL_REQUIRED');
  }
  const expectedRef = env.USKOCI_PRODUCTION_BACKEND_REF;
  if (typeof expectedRef !== 'string' || !SUPABASE_REF.test(expectedRef)) {
    throw new Error('USKOCI_PRODUCTION_BACKEND_REF_REQUIRED');
  }
  let address;
  try { address = new URL(env.EXPO_PUBLIC_SUPABASE_URL); }
  catch { throw new Error('USKOCI_PRODUCTION_BACKEND_URL_INVALID'); }
  const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(address.hostname);
  if (!match || address.protocol !== 'https:' || address.port || address.username ||
      address.password || address.search || address.hash || address.pathname !== '/') {
    throw new Error('USKOCI_PRODUCTION_BACKEND_URL_INVALID');
  }
  const actualRef = match[1];
  if (BLOCKED_REFS.has(actualRef) || BLOCKED_REFS.has(expectedRef)) {
    throw new Error('USKOCI_PRODUCTION_BACKEND_IS_NON_PRODUCTION');
  }
  if (actualRef !== expectedRef) {
    throw new Error('USKOCI_PRODUCTION_BACKEND_REF_MISMATCH');
  }
  // This checks identity, NOT a live migration/Edge/RLS/Storage release certificate.
  return actualRef;
}

module.exports = { assertProductionBackend };
