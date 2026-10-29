/**
 * Offline/proof-only shape gate for the Gemini real-provider smoke.
 * The live semantic engine still owns full category identity, mode, safety and
 * signed Save rules. This guard prevents a missing/invalid REQUIRED field from
 * silently passing the paid smoke, but does not grant any classification.
 */
export function assertProviderClassificationShadow(name, value) {
  if (!['need', 'worker'].includes(name)) throw new Error('UNKNOWN_PROVIDER_PURPOSE');
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || !Object.hasOwn(value, 'classificationShadowJson'))
    throw new Error(name.toUpperCase()+'_SHADOW_JSON_MISSING');
  const text = value.classificationShadowJson;
  if (typeof text !== 'string' || !text.trim() || new TextEncoder().encode(text).byteLength > 24576)
    throw new Error(name.toUpperCase()+'_SHADOW_JSON_INVALID');
  let proposals;
  try { proposals=JSON.parse(text); }
  catch { throw new Error(name.toUpperCase()+'_SHADOW_JSON_INVALID'); }
  const limit=name==='worker'?24:6;
  if (!Array.isArray(proposals) || proposals.length>limit
      || proposals.some(item=>!item||typeof item!=='object'||Array.isArray(item)))
    throw new Error(name.toUpperCase()+'_SHADOW_JSON_INVALID');
  return proposals;
}
