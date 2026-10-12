/**
 * Source-only taxonomy decision prototype, NOT imported by application/Edge/SQL.
 * The real publish transaction must enforce UNIQUE(dedupeKey), Auth/RLS,
 * rate limits, identity/closure gates and rollback; this creates no rows.
 *
 * AI may suggest ANY legitimate work category. If it doesn't already exist,
 * we auto-plan a searchable provisional category, not a wildcard push.
 */
const cyrillic = Object.freeze({
  а:'a', б:'b', в:'v', г:'g', д:'d', ђ:'dj', е:'e', ж:'z', з:'z', и:'i',
  ј:'j', к:'k', л:'l', љ:'lj', м:'m', н:'n', њ:'nj', о:'o', п:'p',
  р:'r', с:'s', т:'t', ћ:'c', у:'u', ф:'f', х:'h', ц:'c', ч:'c',
  џ:'dz', ш:'s'
});

export function normalizedWorkLabel(value) {
  if (typeof value !== 'string') return '';
  return [...value.trim().toLocaleLowerCase('sr-RS')]
    .map(char => cyrillic[char] ?? char)
    .join('')
    .replace(/đ/g, 'dj')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g, ' ')
    .trim();
}

const valid = value => typeof value === 'string'
  && value.trim().length >= 3 && [...value.trim()].length <= 120
  && !/[<>\\{}\u0000-\u001f]/u.test(value)
  && /^[\p{L}\p{N}]/u.test(value.trim());
const clarify = reason => Object.freeze({action:'CLARIFY',reason,notificationAuthority:'NONE'});

/** Trusted catalog entries come from server. Never accept model-invented IDs. */
export function planAutomaticCategory({label, catalog, ownerReviewed, catalogVersion, parentHint=null}={}) {
  if (!ownerReviewed) return clarify('PUBLISH_REVIEW_REQUIRED');
  if (!valid(label)) return clarify('CATEGORY_LABEL_INVALID');
  if (!Array.isArray(catalog) || typeof catalogVersion !== 'string' || !catalogVersion.trim())
    return clarify('CATALOG_SNAPSHOT_UNAVAILABLE');
  const key=normalizedWorkLabel(label);
  if (!key || key==='ostalo' || key==='drugo' || key==='razno') return clarify('WORK_MEANING_UNCLEAR');

  const exact = catalog.filter(entry => entry && entry.status !== 'RETIRED'
    && [entry.label,...(Array.isArray(entry.aliases)?entry.aliases:[])]
      .some(alias => normalizedWorkLabel(alias) === key));
  const ids=[...new Set(exact.map(entry=>entry.id))];
  if (ids.length>1) return clarify('AMBIGUOUS_ALIAS_COLLISION');
  if (ids.length===1) return Object.freeze({
    action:'REUSE_EXISTING',categoryId:ids[0],catalogVersion,
    notificationAuthority:'NONE', // A category identity never grants push rights.
  });

  // Auto-growth never requires the new label to be one of the old eleven.
  // A model-suggested parent is ignored unless proven by a separate catalog
  // relationship contract; guessing a parent may send unrelated work.
  const provenParent=parentHint?.relation==='CATALOG_CONFIRMED_PARENT'
    && catalog.some(entry=>entry.id===parentHint.id && entry.status!=='RETIRED')
    ? parentHint.id : null;
  return Object.freeze({
    action:'CREATE_AUTO_PROVISIONAL',
    label:label.trim(),normalizedKey:key,parentId:provenParent,
    dedupeKey:`category:v1:${provenParent??'root'}:${key}`,
    catalogVersion,status:'AUTO_PROVISIONAL',searchableImmediately:true,
    workerSkillInferred:false,notificationAuthority:'NONE'
  });
}
