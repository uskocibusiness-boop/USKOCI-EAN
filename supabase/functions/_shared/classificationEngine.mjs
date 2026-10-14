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
const plain = v => typeof v === 'string' && v.length <= 1000;
const modes = new Set(['REMOTE', 'ON_SITE']);
const inputKinds = new Set(['WORKER_CAPABILITY','NEED_SERVICE']);

function catalogError(reason) { throw new Error('CLASSIFICATION_CATALOG_' + reason); }

/** Catalog fetch is service-role-only; rpc is an injected server-side RPC client.
 *  STATIONARY is the existing SQL input spelling for canonical ON_SITE.
 *  Reject incomplete or changing pages instead of classifying against a partial tree.
 */
export async function loadClassificationCatalog(rpc, { maxPages = 8, pageSize = 100 } = {}) {
  if (typeof rpc !== 'function' || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20
      || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) catalogError('INPUT_INVALID');
  const byId = new Map(), scopesById = new Map();
  let version = null;
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
      for (const row of answer.items) {
        if (!isRecord(row) || !UUID.test(row.categoryId) || !safeLabel(row.label) ||
          !(row.parentId === null || UUID.test(row.parentId)) ||
          !Array.isArray(row.path) || row.path.length === 0 ||
          row.path.length > 32 || !row.path.every(safeLabel))
          catalogError('INVALID_CATEGORY');
        const node = { id: row.categoryId, label: row.label, parentId: row.parentId,
          path: row.path.slice(), isLeaf: row.isLeaf === true };
        const existing = byId.get(node.id);
        if (existing && (existing.label !== node.label || existing.parentId !== node.parentId
          || JSON.stringify(existing.path) !== JSON.stringify(node.path)))
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
    return { accepted: true, status: 'REUSE_CANDIDATE',
      categoryId: existing.id, catalogVersion: snapshot.catalogVersion,
      // Worker/need confirmation is STILL required before activation or dispatch.
      requiresOwnerReview: true, capabilityAuthority: 'NONE', notificationAuthority: 'NONE' };
  }
  if (['CREATE_CHILD','CREATE_NEW_BRANCH','PROPOSE_RESTRUCTURE'].includes(plan.action)) {
    if (plan.action === 'CREATE_CHILD' && !categories.has(plan.parentId))
      return { accepted: false, status: 'UNKNOWN_PARENT_ID' };
    if (!Array.isArray(plan.proposedPath) || !plan.proposedPath.length ||
        plan.proposedPath.length > 12 || !plan.proposedPath.every(safeLabel))
      return { accepted: false, status: 'INVALID_PATH' };
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
export function catalogPromptContext(snapshot, { maxItems = 220 } = {}) {
  if (!isRecord(snapshot) || !Array.isArray(snapshot.categories) ||
      !Number.isSafeInteger(snapshot.catalogVersion) || snapshot.categories.length > maxItems)
    catalogError('PROMPT_LIMIT');
  return JSON.stringify({
    catalogVersion: snapshot.catalogVersion,
    classificationAuthority: 'NONE',
    instructions: 'Use exact categoryId when semantically identical; propose, never commit, new hierarchy. Category parent is not evidence of worker skill. Mode must be separately confirmed.',
    categories: snapshot.categories.map(x => ({
      id:x.id, parentId:x.parentId, label:x.label, path:x.path, modes:x.modes,
    })),
  });
}
