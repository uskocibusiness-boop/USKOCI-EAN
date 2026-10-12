// USKOCI taxonomy shadow bridge. Pure logic; no DB writes, no identity data.
// Gemini fact suggestions are NOT an authorization for new work categories.
const watched = new Set([
  'need.category','need.description','need.task_geography','need.required_skills',
]);
const modes = new Set(['STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED','REMOTE']);
export function scopedNeedPreviewArgs(activeFacts, proposals) {
  if (!Array.isArray(proposals) || !proposals.some(p => p && watched.has(p.key))) return null;
  const known = new Map();
  if (Array.isArray(activeFacts)) for (const f of activeFacts) {
    if (f && typeof f.fact_key === 'string' && f.status !== 'UNKNOWN') known.set(f.fact_key, f.fact_value);
  }
  for (const p of proposals) {
    if (p && watched.has(p.key)) known.set(p.key, p.value);
  }
  const category = known.get('need.category');
  const geo = known.get('need.task_geography');
  if (typeof category !== 'string' || !category.trim() || category.length > 120 ||
    !geo || typeof geo !== 'object' || Array.isArray(geo) || !modes.has(geo.mode)) return null;
  const description = known.get('need.description');
  const skills = known.get('need.required_skills');
  return {
    p_execution_location_mode: geo.mode,
    p_ai_category: category.trim(),
    p_public_description: typeof description === 'string' ? description.slice(0,6000) : '',
    p_explicit_required_skills: Array.isArray(skills) && skills.every(s => typeof s === 'string') ? skills.slice(0,30) : null,
  };
}

export function scopedNeedPreviewSafeAction(value) {
  if (!value || typeof value !== 'object'
    || value.classificationAuthority !== 'NONE' || value.notificationAuthority !== 'NONE') return 'NOT_AUTHORITATIVE';
  const safe = new Set(['CLARIFY','SUGGEST_EXISTING_SERVICE','NOVEL_SERVICE_REVIEW','NEEDS_CLARIFICATION','REVIEW']);
  return safe.has(value.action) ? value.action : 'OTHER_REVIEW';
}
