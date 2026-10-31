/**
 * One server-only owner of optional taxonomy AI rollout flags (A30-D04/D05).
 * All optional capabilities are default OFF, including on DEV. Explicit false
 * and missing config both close them; a paid background classifier additionally
 * needs a verified DEV project scope and the existing paid-test admission flag.
 *
 * This is not provider budget authority. Every paid operation still passes the
 * current reservation, durable turn and usage fences. No URL, ref or secret is
 * embedded in the source and no request/client input can enable a feature.
 */
const OPTIONAL = new Set(['USKOCI_TAXONOMY_DIRECT_REPLY','USKOCI_TAXONOMY_UNIFIED_SHADOW','USKOCI_TAXONOMY_SHADOW_CAPTURE']);
export function taxonomyOptionalEnabled(get, name) {
  return typeof get === 'function' && OPTIONAL.has(name) && get(name) === 'true';
}
export function taxonomyDualGeminiEnabled(get) {
  if (typeof get !== 'function' || get('USKOCI_TAXONOMY_DUAL_GEMINI') !== 'true'
    || get('USKOCI_GEMINI_PAID_TEST_ENABLED') !== 'true'
    || !get('SUPABASE_ANON_KEY') || get('USKOCI_TAXONOMY_ROLLOUT_SCOPE') !== 'DEV') return false;
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
