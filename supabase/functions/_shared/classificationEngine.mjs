// USKOČI P0 — shared, read-only classification boundary.
// This module is used by BOTH worker and requester Gemini handlers.
// It NEVER writes categories, worker capabilities, need snapshots or relations.
// Admission/commit is deliberately a separate, owner-reviewed transactional phase.
export const CLASSIFICATION_ACTIONS = Object.freeze([
  'REUSE_EXISTING', 'REUSE_ALIAS', 'CREATE_CHILD', 'CREATE_NEW_BRANCH',
  'PROPOSE_RESTRUCTURE', 'ASK_CLARIFICATION', 'NEEDS_REVIEW',
  'REJECT_UNSUPPORTED_OR_UNSAFE',
]);
const ACTIONS = new Set(CLASSIFICATION_ACTIONS);
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const safeLabel = value => typeof value === 'string' && value.trim().length >= 3
  && value.trim().length <= 120 && !/[<>\u0000-\u001f]/.test(value);
const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const catalogFingerprint = v => typeof v === 'string' && /^[a-f\d]{32}$/.test(v);
const validAliases = aliases => Array.isArray(aliases) &&
  JSON.stringify(aliases).length <= 65536 && aliases.every(safeLabel);
const plain = v => typeof v === 'string' && v.length <= 1000;
const modes = new Set(['REMOTE', 'ON_SITE']);
const inputKinds = new Set(['WORKER_CAPABILITY','NEED_SERVICE']);
const serbianCyrillic = Object.freeze({
  а:'a',б:'b',в:'v',г:'g',д:'d',ђ:'đ',е:'e',ж:'ž',з:'z',и:'i',ј:'j',
  к:'k',л:'l',љ:'lj',м:'m',н:'n',њ:'nj',о:'o',п:'p',р:'r',с:'s',
  т:'t',ћ:'ć',у:'u',ф:'f',х:'h',ц:'c',ч:'č',џ:'dž',ш:'š',
});
/** Cross-script normalization for the SAME written service, never semantic inference. */
export function normalizedClassificationIdentity(label) {
  if (!safeLabel(label)) return null;
  return label.normalize('NFKC').toLowerCase()
    .replace(/[\u0400-\u04ff]/g, letter => serbianCyrillic[letter] ?? letter)
    .normalize('NFC').trim().replace(/\s+/g, ' ');
}

// The canonical ID must not be treated as a semantic match merely because it exists.


function catalogError(reason) { throw new Error('CLASSIFICATION_CATALOG_' + reason); }

/** Catalog fetch is service-role-only; rpc is an injected server-side RPC client.
 *  STATIONARY is the existing SQL input spelling for canonical ON_SITE.
 *  Reject incomplete or changing pages instead of classifying against a partial tree.
 */
export async function loadClassificationCatalog(rpc, { maxPages = 20, pageSize = 100 } = {}) {
  if (typeof rpc !== 'function' || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20
      || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) catalogError('INPUT_INVALID');
  const byId = new Map(), scopesById = new Map();
  let version = null, fingerprint;
  for (const [scope, legacyMode] of [['ON_SITE','STATIONARY'], ['REMOTE','REMOTE']]) {
    let cursor = null, completed = false;
    const seenCursors = new Set();
    for (let page = 0; page < maxPages; page++) {
      const answer = await rpc('rpc_taxonomy_ai_catalog_context_service', {
        p_execution_location_mode: legacyMode, p_limit: pageSize, p_after_key: cursor,
      });
      if (!isRecord(answer) || answer.action !== 'CATALOG_CONTEXT' ||
          !Array.isArray(answer.items) || !Number.isSafeInteger(answer.catalogVersion) ||
          answer.catalogVersion < 1 || answer.scope !== scope ||
          answer.classificationAuthority !== 'NONE' || answer.notificationAuthority !== 'NONE')
        catalogError('INVALID_PAGE');
      if (version !== null && version !== answer.catalogVersion) catalogError('STALE_VERSION');
      version = answer.catalogVersion;
      // Older catalog RPCs contain no aliases. They keep exact-name behavior.
      // A catalog version alone does not fence legacy alias writers; require
      // the server's content fingerprint across every page and both scopes.
      const hasFingerprint = Object.hasOwn(answer,'catalogFingerprint');
      const pageFingerprint = hasFingerprint ? answer.catalogFingerprint : null;
      if (hasFingerprint && !catalogFingerprint(pageFingerprint)) catalogError('INVALID_FINGERPRINT');
      if (fingerprint !== undefined && fingerprint !== pageFingerprint) catalogError('STALE_FINGERPRINT');
      fingerprint = pageFingerprint;
      for (const row of answer.items) {
        if (!isRecord(row) || !UUID.test(row.categoryId) || !safeLabel(row.label) ||
          !(row.parentId === null || UUID.test(row.parentId)) ||
          !Array.isArray(row.path) || row.path.length === 0 ||
          JSON.stringify(row.path).length > 65536 || !row.path.every(safeLabel))
          catalogError('INVALID_CATEGORY');
        const hasAliases = Object.hasOwn(row,'aliases');
        if (hasAliases && !validAliases(row.aliases)) catalogError('INVALID_ALIAS');
        if (hasAliases && !catalogFingerprint(pageFingerprint)) catalogError('ALIAS_FINGERPRINT_REQUIRED');
        const node = { id: row.categoryId, label: row.label, parentId: row.parentId,
          path: row.path.slice(), isLeaf: row.isLeaf === true,
          ...(hasAliases ? { aliases: Object.freeze(row.aliases.slice()) } : {}) };
        const existing = byId.get(node.id);
        if (existing && (existing.label !== node.label || existing.parentId !== node.parentId
          || JSON.stringify(existing.path) !== JSON.stringify(node.path)
          || JSON.stringify(existing.aliases) !== JSON.stringify(node.aliases)))
          catalogError('CONFLICTING_ID');
        byId.set(node.id, node);
        if (!scopesById.has(node.id)) scopesById.set(node.id, new Set());
        scopesById.get(node.id).add(scope);
      }
      if (answer.nextAfter === null) { completed = true; break; }
      if (typeof answer.nextAfter !== 'string' || !answer.nextAfter.length ||
          seenCursors.has(answer.nextAfter)) catalogError('INVALID_CURSOR');
      seenCursors.add(answer.nextAfter);
      cursor = answer.nextAfter;
    }
    if (!completed) catalogError('INCOMPLETE_PAGING');
  }
  if (version === null) catalogError('MISSING_VERSION');
  return Object.freeze({ catalogVersion: version,
    ...(fingerprint !== null ? { catalogFingerprint: fingerprint } : {}),
    categories: Array.from(byId.values()).map(node => Object.freeze({
      ...node, modes: Object.freeze(Array.from(scopesById.get(node.id)).sort()),
    })),
  });
}

/** Read-only plan gate. AI output alone is never category/competence authority.
 *  Parent identity and category ID are looked up in the FRESH server catalog,
 *  never accepted as invented model IDs. Novel meanings always need admission.
 */
export function reviewClassificationProposal(input, snapshot, plan) {
  if (!isRecord(input) || !inputKinds.has(input.purpose) || !isRecord(snapshot) ||
      !Number.isSafeInteger(snapshot.catalogVersion) || !Array.isArray(snapshot.categories) ||
      !isRecord(plan) || !ACTIONS.has(plan.action))
    return { accepted: false, status: 'INVALID_INPUT' };
  if (!Number.isSafeInteger(plan.catalogVersion) ||
      plan.catalogVersion !== snapshot.catalogVersion)
    return { accepted: false, status: 'STALE_CATALOG' };
  if (!safeLabel(input.service) || (input.mode !== null && input.mode !== undefined &&
      !modes.has(input.mode)))
    return { accepted: false, status: 'INVALID_SERVICE' };
  if (!plain(plan.reason) || !plan.reason.trim())
    return { accepted: false, status: 'MISSING_EVIDENCE' };
  const categories = new Map(snapshot.categories.map(node => [node.id,node]));
  if (['REUSE_EXISTING','REUSE_ALIAS'].includes(plan.action)) {
    const existing = categories.get(plan.categoryId);
    if (!existing) return { accepted: false, status: 'UNKNOWN_CANONICAL_ID' };
    if (input.mode && (!Array.isArray(existing.modes) || !existing.modes.includes(input.mode)))
      return { accepted: false, status: 'MODE_NOT_SUPPORTED' };
    // Aliases arrive only from the service-owned, fingerprinted catalog, never
    // from provider output. Keep the existing normalizer: accepting a stored
    // synonym is not permission to infer other synonyms or broader competence.
    const identity = normalizedClassificationIdentity(input.service);
    const hasAlias = node => catalogFingerprint(snapshot.catalogFingerprint) &&
      validAliases(node.aliases) && node.aliases.some(alias => normalizedClassificationIdentity(alias) === identity);
    const verifiedAlias = hasAlias(existing);
    if (plan.action === 'REUSE_ALIAS' && !verifiedAlias)
      return { accepted: false, status: 'ALIAS_EVIDENCE_REQUIRED',
        catalogVersion: snapshot.catalogVersion, capabilityAuthority: 'NONE',
        notificationAuthority: 'NONE' };
    if (identity !== normalizedClassificationIdentity(existing.label) && !verifiedAlias)
      return { accepted: false, status: 'SEMANTIC_IDENTITY_REVIEW_REQUIRED',
        catalogVersion: snapshot.catalogVersion, capabilityAuthority: 'NONE',
        notificationAuthority: 'NONE' };
    // A stored alias collision cannot be resolved by the model choosing an ID.
    // The SQL owner-review projection independently repeats this identity check.
    const identities = snapshot.categories.filter(node =>
      (!input.mode || node.modes?.includes(input.mode)) &&
      (normalizedClassificationIdentity(node.label) === identity || hasAlias(node)));
    if (new Set(identities.map(node => node.id)).size !== 1)
      return { accepted: false, status: 'AMBIGUOUS_CANONICAL_IDENTITY',
        catalogVersion: snapshot.catalogVersion, capabilityAuthority: 'NONE',
        notificationAuthority: 'NONE' };
    return { accepted: true, status: 'REUSE_CANDIDATE',
      categoryId: existing.id, catalogVersion: snapshot.catalogVersion,
      // Worker/need confirmation is STILL required before activation or dispatch.
      requiresOwnerReview: true, capabilityAuthority: 'NONE', notificationAuthority: 'NONE' };
  }
  if (['CREATE_CHILD','CREATE_NEW_BRANCH','PROPOSE_RESTRUCTURE'].includes(plan.action)) {
    if (plan.action === 'CREATE_CHILD') {
      const parent = categories.get(plan.parentId);
      if (!parent) return { accepted: false, status: 'UNKNOWN_PARENT_ID' };
      if (input.mode && (!Array.isArray(parent.modes) || !parent.modes.includes(input.mode)))
        return { accepted: false, status: 'PARENT_MODE_NOT_SUPPORTED' };
    }
    if (!Array.isArray(plan.proposedPath) || !plan.proposedPath.length ||
        plan.proposedPath.length > 6 || !plan.proposedPath.every(safeLabel))
      return { accepted: false, status: 'INVALID_PATH' };
    if (plan.action !== 'PROPOSE_RESTRUCTURE' &&
        normalizedClassificationIdentity(plan.proposedPath.at(-1)) !==
        normalizedClassificationIdentity(input.service))
      return { accepted: false, status: 'SERVICE_LEAF_MISMATCH' };
    if (plan.action === 'CREATE_NEW_BRANCH' && plan.parentId != null)
      return { accepted: false, status: 'NEW_BRANCH_MUST_HAVE_NO_PARENT' };
    return { accepted: false, status: 'ADMISSION_REVIEW_REQUIRED',
      catalogVersion: snapshot.catalogVersion, capabilityAuthority: 'NONE',
      notificationAuthority: 'NONE' };
  }
  return { accepted: false, status: plan.action,
    catalogVersion: snapshot.catalogVersion, capabilityAuthority: 'NONE',
    notificationAuthority: 'NONE' };
}

/** Small, identity-only AI context. Model receives catalog IDs + paths but
 * cannot grant itself write privileges. Explicitly disallow mode inference.
 */
/** Prompt selection is NOT an authority or a complete catalog search.
 *  Catalog membership is still checked on the full server snapshot. When the
 *  catalog grows, shortlist relevant branches instead of failing past 220 rows.
 *  Absent from shortlist NEVER means the category is absent from the database.
 */
/** @param {any} snapshot
 *  @param {{ maxItems?: number; services?: string[] }} [options]
 */
export function catalogPromptContext(snapshot,{maxItems=220,services=[]}={}) {
  if (!isRecord(snapshot)||!Array.isArray(snapshot.categories)||
      !Number.isSafeInteger(snapshot.catalogVersion)||snapshot.catalogVersion<1||
      !Number.isInteger(maxItems)||maxItems<25||maxItems>220||
      !Array.isArray(services)||services.length>20||
      services.some(x=>typeof x!=='string'||x.length>2000))
    catalogError('PROMPT_LIMIT');
  const all=snapshot.categories;
  const byId=new Map(all.map(x=>[x.id,x]));
  const tokens=x=>(String(x??'').normalize('NFKC').toLowerCase().replace(/[\u0400-\u04ff]/g,ch=>serbianCyrillic[ch]??ch).match(/[\p{L}\p{N}]+/gu)??[])
    // Keep short technical terms such as 3D and AI2; ordinary two-letter
    // words add noise to the shortlist and remain excluded.
    .filter(t=>t.length>=3||(t.length>=2&&/[\p{L}]/u.test(t)&&/[\p{N}]/u.test(t)));
  const query=services.flatMap(tokens);
  const wanted=new Set(query);
  // Roots are candidates too. Reserving space for every root would make a
  // growing catalog unusable and crowd relevant descendants out of the prompt.
  // The full server snapshot remains authoritative after this shortlist.
  const ranked=all.map(node=>{
    const own=tokens([node.label,...(catalogFingerprint(snapshot.catalogFingerprint) && validAliases(node.aliases) ? node.aliases : [])].join(' '));
    const ancestry=tokens((node.path??[]).join(' '));
    const hit=own.filter(t=>wanted.has(t)).length;
    const wide=ancestry.filter(t=>wanted.has(t)).length;
    return {node,score:hit*10+wide*2+(!query.length&&node.parentId==null?1:0)};
  }).sort((a,b)=>b.score-a.score||
    a.node.label.localeCompare(b.node.label,'sr')||
    a.node.id.localeCompare(b.node.id));
  const selected=new Map();
  for(const {node} of ranked){
    const lineage=[];let current=node;const visited=new Set();
    while(current&&!selected.has(current.id)&&!visited.has(current.id)){
      visited.add(current.id);lineage.push(current);
      current=current.parentId?byId.get(current.parentId):null;
    }
    // Skip incomplete/unresolvable ancestry, rather than showing a fake tree.
    if((current===undefined&&lineage.at(-1)?.parentId)||
       (current&&visited.has(current.id)&&!selected.has(current.id)))continue;
    if(selected.size+lineage.length>maxItems)continue;
    for(const item of lineage.reverse())selected.set(item.id,item);
    if(selected.size>=maxItems)break;
  }
  const shortlist=all.length<=maxItems?all:Array.from(selected.values());
  return JSON.stringify({
    catalogVersion:snapshot.catalogVersion,
    classificationAuthority:'NONE',
    shortlisted:all.length>shortlist.length,
    totalCategories:all.length,
    instructions:'These categories are a partial relevance shortlist, NOT the entire catalog. An unseen category may already exist. Never assume absence implies novelty or invent IDs. Listed aliases are registered aliases for that exact category, not authority to invent a new alias. Keep the actual offered service wording; do not replace it with a broader canonical label. Use NEEDS_REVIEW for uncertain identity; propose but never commit any new branch. Parent category is not evidence of worker competence. Mode must be separately confirmed.',
    categories:shortlist.map(x=>({
      id:x.id,parentId:x.parentId,label:x.label,path:x.path,modes:x.modes,
      ...(catalogFingerprint(snapshot.catalogFingerprint) && validAliases(x.aliases)
        ? { aliases:x.aliases.slice(0,12), ...(x.aliases.length>12 ? { aliasesShortlisted:true } : {}) } : {}),
    })),
  });
}
