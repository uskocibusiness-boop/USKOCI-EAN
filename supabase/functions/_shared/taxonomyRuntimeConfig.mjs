import { readSupabasePublishableKey } from './supabaseKeys.mjs';
/**
 * Single-pass intake admission (A30-D04/D05, C10). Missing/false config is
 * default OFF, including on DEV and PROD. The historical DUAL_GEMINI key still
 * gates the single-response intake and requires exact project/paid admission.
 * Production has a separate positive flag and exact project identity. The
 * historical key is retained for rollout compatibility, not a second call.
 *
 * This is not provider budget authority. Every paid operation still passes the
 * current reservation, durable turn and usage fences. No URL, ref or secret is
 * embedded in the source and no request/client input can enable a feature.
 */
function projectMatches(get) {
  const allowed = get('USKOCI_TAXONOMY_ALLOWED_PROJECT_REF');
  if (typeof allowed !== 'string' || !/^[a-z0-9]{20}$/.test(allowed)) return false;
  try {
    const target = new URL(get('SUPABASE_URL') ?? '');
    // Permit the platform's standard trailing slash, but no alternate paths,
    // embedded credentials, query, port, or lookalike host.
    return target.protocol === 'https:' && target.username === '' && target.password === ''
      && !target.port && target.pathname === '/' && !target.search && !target.hash
      && target.hostname === allowed + '.supabase.co';
  } catch { return false; }
}

export function aiProviderRuntimeEnabled(get) {
  if (typeof get !== 'function' || !projectMatches(get)) return false;
  const scope = get('USKOCI_TAXONOMY_ROLLOUT_SCOPE');
  return (scope === 'DEV' && get('USKOCI_GEMINI_PAID_TEST_ENABLED') === 'true')
    || (scope === 'PROD' && get('USKOCI_GEMINI_PRODUCTION_ENABLED') === 'true');
}

export function taxonomyIntakeEnabled(get) {
  return aiProviderRuntimeEnabled(get)
    && get('USKOCI_TAXONOMY_DUAL_GEMINI') === 'true'
    && !!readSupabasePublishableKey(get);
}
