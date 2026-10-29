// Background Taxonomy Architect ("Drugi Gemini u pozadini").
// Sees the ENTIRE taxonomy tree (all roots, branches, and leaf categories),
// caches the full tree in memory by catalogVersion + catalogFingerprint,
// resolves requester exact/alias identity deterministically; worker scope still
// requires saved consent or a valid new USER-quoted proposal and provider result,
// detects ambiguity and emits clarificationRequest hints without falling back to Zanati i popravke,
// and invokes a fast focused Gemini call for genuinely novel services
// without ever blocking the user-facing conversational response.

import { normalizedClassificationIdentity } from './classificationEngine.mjs';
import { decodeServiceHandoff } from './serviceHandoff.mjs';
import { workerModeRequests } from './workerServiceModeContext.mjs';

let cachedFullCatalog = null;
const cachedNovelDecisions = new Map();

// In-memory store for asynchronous clarification hints across conversation turns
const clarificationHintsByConversation = new Map();

const executionMode = value => value === 'ON_SITE' || value === 'REMOTE';
class TaxonomyProviderError extends Error {
  constructor(code, status = 'RETRYABLE_PROVIDER') {
    super(code);
    this.code = code;
    this.status = status;
  }
}
function providerFailure(error) {
  // Never log exception messages or provider bodies: they can contain user text.
  return error instanceof TaxonomyProviderError
    ? { status: error.status, code: error.code }
    : { status: 'RETRYABLE_PROVIDER', code: error?.name === 'AbortError' ? 'PROVIDER_ABORTED' : 'PROVIDER_TRANSPORT_FAILURE' };
}
function reportProviderFailure(error, failures) {
  recordFailure(providerFailure(error), failures);
}
function recordFailure(failure, failures) {
  failures.push(failure);
  console.warn('BG_TAXONOMY_PROVIDER_FAILURE', failure.status, failure.code);
}
async function boundedProviderJson(res, signal) {
  // Same decoded-byte ceiling as the foreground stream. The existing caller's
  // nine-second BG lifecycle owns cancellation; this reader adds no new timer.
  const maximum = 524288;
  let reader;
  let rejectStopped;
  const stopped = new Promise((_, reject) => { rejectStopped = reject; });
  void stopped.catch(() => undefined);
  const stop = () => rejectStopped(new TaxonomyProviderError('PROVIDER_ABORTED'));
  signal?.addEventListener('abort', stop, { once: true });
  try {
    if (signal?.aborted) throw new TaxonomyProviderError('PROVIDER_ABORTED');
    if (!res.ok) throw new TaxonomyProviderError(`PROVIDER_HTTP_${res.status}`,
      res.status === 408 || res.status === 429 || res.status >= 500 ? 'RETRYABLE_PROVIDER' : 'PROVIDER_PERMANENT_FAILURE');
    const declared = res.headers.get('content-length');
    if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))) {
      throw new TaxonomyProviderError('PROVIDER_INVALID_CONTENT_LENGTH');
    }
    if (declared !== null && Number(declared) > maximum) throw new TaxonomyProviderError('PROVIDER_BODY_TOO_LARGE');
    if (!res.body) throw new TaxonomyProviderError('PROVIDER_INVALID_JSON');
    reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const chunks = [];
    let total = 0;
    while (true) {
      // Abort must settle even if the transport's pending read ignores it.
      const part = await Promise.race([reader.read(), stopped]);
      if (signal?.aborted) throw new TaxonomyProviderError('PROVIDER_ABORTED');
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maximum) throw new TaxonomyProviderError('PROVIDER_BODY_TOO_LARGE');
      chunks.push(decoder.decode(part.value, { stream: true }));
    }
    chunks.push(decoder.decode());
    // Fetch may decompress the body while retaining its encoded length header.
    const encoding = res.headers.get('content-encoding')?.trim().toLowerCase();
    if ((!encoding || encoding === 'identity') && declared !== null && Number(declared) !== total) {
      throw new TaxonomyProviderError('PROVIDER_INCOMPLETE_RESPONSE');
    }
    return JSON.parse(chunks.join(''));
  } catch (error) {
    if (error instanceof TaxonomyProviderError) throw error;
    throw new TaxonomyProviderError(signal?.aborted ? 'PROVIDER_ABORTED' : 'PROVIDER_INVALID_JSON');
  } finally {
    signal?.removeEventListener('abort', stop);
    // Includes rejected HTTP/header/body paths. Cleanup cannot prolong the BG
    // deadline or expose provider text, even if cancellation itself fails/hangs.
    try { void (reader ? reader.cancel() : res.body?.cancel())?.catch(() => undefined); } catch { /* best-effort cleanup */ }
  }
}
async function providerEntries(res, field, signal) {
  const data = await boundedProviderJson(res, signal);
  if (data?.promptFeedback?.blockReason) throw new TaxonomyProviderError('PROVIDER_REFUSED', 'PROVIDER_PERMANENT_FAILURE');
  const candidate = data?.candidates?.[0];
  if (!candidate?.finishReason) throw new TaxonomyProviderError('PROVIDER_INCOMPLETE_RESULT');
  if (candidate.finishReason !== 'STOP') {
    throw new TaxonomyProviderError(candidate.finishReason === 'MAX_TOKENS' ? 'PROVIDER_TRUNCATED' : 'PROVIDER_REFUSED',
      candidate.finishReason === 'MAX_TOKENS' ? 'RETRYABLE_PROVIDER' : 'PROVIDER_PERMANENT_FAILURE');
  }
  const parts = candidate?.content?.parts;
  const rawText = Array.isArray(parts) ? parts.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('') : '';
  let parsed;
  try { parsed = JSON.parse(rawText); } catch { throw new TaxonomyProviderError('PROVIDER_INVALID_MODEL_JSON'); }
  if (!Array.isArray(parsed?.[field]) || parsed[field].length === 0) throw new TaxonomyProviderError('PROVIDER_INCOMPLETE_RESULT');
  return parsed[field];
}
// PostgreSQL char_length counts codepoints; UTF-16 slice can split an emoji.
const boundedCodepoints = (value, limit) => Array.from(value).slice(0, limit).join('');
function validClarification(decision) {
  return ['NEEDS_CLARIFICATION', 'AMBIGUOUS'].includes(decision?.action)
    && typeof decision.ambiguityPrompt === 'string' && Array.from(decision.ambiguityPrompt.trim()).length >= 8
    && typeof decision.reason === 'string' && decision.reason.trim().length >= 10;
}
function decisionFailure(decision) {
  return ['REUSE_EXISTING', 'EXTEND_MODE'].includes(decision?.action)
    ? { status: 'PROVIDER_PERMANENT_FAILURE', code: 'SEMANTIC_REUSE_ADMISSION_UNAVAILABLE' }
    : { status: 'RETRYABLE_PROVIDER', code: 'PROVIDER_INVALID_DECISION' };
}

/**
 * Semantic reuse is only an untrusted, source-bound HINT for the existing
 * capture RPC. The complete server snapshot proves an ID and supported mode
 * exist, NOT that the model understood the work correctly. Until a separate
 * server-owned semantic review can verify meaning and display a signed plan,
 * this result must not become READY, an alias, a worker capability or a binder
 * instruction. The current exact/alias and owner-review SQL gates stay intact.
 */
function semanticReuseHint(decision, service, mode, catalog) {
  const key = normalizedClassificationIdentity(service);
  if (decision?.action !== 'REUSE_EXISTING' || !key || !executionMode(mode)
      || catalog?.verifiedComplete !== true || !Array.isArray(catalog.categories)
      || (catalog.byNormalizedKey.get(key) ?? []).length !== 0
      || decision.parentId !== '' || typeof decision.categoryId !== 'string'
      || normalizedClassificationIdentity(decision.service) !== key
      || decision.mode !== mode || typeof decision.reason !== 'string'
      || decision.reason.trim().length < 10 || decision.reason.length > 1000) return null;
  const matches = catalog.categories.filter(node => node.categoryId === decision.categoryId);
  if (matches.length !== 1 || matches[0].isLeaf !== true
      || !Array.isArray(matches[0].modes) || !matches[0].modes.includes(mode)) return null;
  return { categoryId: matches[0].categoryId, reason: decision.reason.trim().slice(0, 900) };
}

export function hintDraftRevision(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function taskTaxonomyMode(geography) {
  if (geography?.mode === 'REMOTE') return 'REMOTE';
  if (['STATIONARY', 'POINT_TO_POINT', 'MULTI_STOP', 'AREA_BASED'].includes(geography?.mode)) return 'ON_SITE';
  return null;
}

export function taskTaxonomyScope({ priorCategory, category, priorDescription, proposedDescription }) {
  if (typeof proposedDescription === 'string') return proposedDescription;
  // A new service must not be classified using the old task's scope. A scope
  // already gathered before the first category is still useful.
  if (typeof priorCategory === 'string' && typeof category === 'string' &&
      normalizedClassificationIdentity(priorCategory) !== normalizedClassificationIdentity(category)) return '';
  return typeof priorDescription === 'string' ? priorDescription : '';
}

function stableTaxonomyValue(value) {
  if (Array.isArray(value)) return value.map(stableTaxonomyValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, stableTaxonomyValue(value[key])]));
  return value;
}

export function taskClassificationFingerprint({ service, scopeSummary, mode, handoff }) {
  const normalizedService = normalizedClassificationIdentity(service);
  if (!normalizedService || !['ON_SITE','REMOTE'].includes(mode)) return null;
  const normalizedScope = typeof scopeSummary === 'string'
    ? scopeSummary.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('sr') : '';
  const normalizedHandoff = mode === 'REMOTE' ? (decodeServiceHandoff(handoff) ?? null) : null;
  return JSON.stringify(stableTaxonomyValue({ service: normalizedService, scope: normalizedScope, mode, handoff: normalizedHandoff }));
}

export function workerSkillsFingerprint(skills) {
  if (!Array.isArray(skills)) return null;
  return [...new Set(skills.map(normalizedClassificationIdentity).filter(Boolean))].sort().join('|');
}

export function storeClarificationHint(conversationId, draftRevision, hint) {
  if (!conversationId) return;
  draftRevision = hintDraftRevision(draftRevision);
  if (draftRevision === null) return;
  const existing = clarificationHintsByConversation.get(conversationId) ?? [];
  const filtered = existing.filter((h) => h.draftRevision !== draftRevision);
  filtered.push({
    ...hint,
    conversationId,
    draftRevision: draftRevision ?? null,
    consumed: false,
    timestamp: Date.now(),
  });
  clarificationHintsByConversation.set(conversationId, filtered);
}

export function getUnconsumedClarificationHint(conversationId, draftRevision) {
  if (!conversationId) return null;
  draftRevision = hintDraftRevision(draftRevision);
  if (draftRevision === null) return null;
  const list = clarificationHintsByConversation.get(conversationId);
  if (!Array.isArray(list) || list.length === 0) return null;
  const found = list.find((h) => !h.consumed && h.draftRevision === draftRevision);
  return found ?? null;
}

export function consumeClarificationHint(conversationId, draftRevision, service) {
  if (!conversationId) return;
  draftRevision = hintDraftRevision(draftRevision);
  if (draftRevision === null) return;
  const list = clarificationHintsByConversation.get(conversationId);
  if (!Array.isArray(list)) return;
  for (const h of list) {
    if (h.draftRevision === draftRevision && (!service || h.service === service)) {
      h.consumed = true;
    }
  }
}

export async function persistClarificationHint(rpc, hint) {
  if (!hint?.conversationId) return false;
  const draftRevision = hintDraftRevision(hint.draftRevision);
  if (draftRevision === null) return false;
  // Mirror the store RPC's btrim/nullif semantics, with its 300-character cap.
  // Send and cache the identical text; a rejected write must never warm memory.
  const reason = typeof hint.reason === 'string'
    ? boundedCodepoints(hint.reason.replace(/^ +| +$/g, ''), 300).replace(/ +$/g, '') || null
    : hint.reason;
  const normalizedHint = { ...hint, reason };
  if (typeof rpc === 'function') {
    try {
      const res = await rpc('rpc_taxonomy_store_classification_turn_hint_service', {
        p_conversation_id: hint.conversationId,
        p_draft_revision: draftRevision,
        p_service: hint.service,
        p_mode: hint.mode ?? null,
        p_ambiguity_prompt: hint.ambiguityPrompt,
        p_reason: reason,
      });
      const receipt = res?.ok === true ? res.data : res;
      if (res?.ok === false || receipt?.stored !== true || receipt?.draftRevision !== draftRevision) return false;
    } catch {
      return false;
    }
  }
  storeClarificationHint(hint.conversationId, draftRevision, normalizedHint);
  return true;
}

/** Mark the exact revision locally only after its durable consume receipt is confirmed. */
export async function persistConsumeClarificationHint(rpc, conversationId, draftRevision, service) {
  draftRevision = hintDraftRevision(draftRevision);
  if (!conversationId || draftRevision === null) return false;
  if (typeof rpc === 'function') {
    try {
      const res = await rpc('rpc_taxonomy_consume_turn_hint_revision_service', {
        p_conversation_id: conversationId,
        p_draft_revision: draftRevision,
        p_service: service ?? null,
      });
      const receipt = res?.ok === true ? res.data : res;
      if (res?.ok === false || receipt?.draftRevision !== draftRevision ||
          !Number.isSafeInteger(receipt?.consumed) || receipt.consumed < 0) return false;
    } catch {
      return false;
    }
  }
  consumeClarificationHint(conversationId, draftRevision, service);
  return true;
}

export async function fetchUnconsumedClarificationHint(rpc, conversationId, draftRevision) {
  draftRevision = hintDraftRevision(draftRevision);
  if (draftRevision === null) return null;
  const mem = getUnconsumedClarificationHint(conversationId, draftRevision);
  if (mem) return mem;
  if (typeof rpc === 'function' && conversationId) {
    try {
      const res = await rpc('rpc_taxonomy_get_unconsumed_turn_hint_service', {
        p_conversation_id: conversationId,
        p_draft_revision: draftRevision,
      });
      const data = res?.ok ? res.data : res;
      if (data && typeof data.ambiguityPrompt === 'string') {
        storeClarificationHint(conversationId, draftRevision, data);
        return data;
      }
    } catch {
      // Graceful fallback
    }
  }
  return null;
}

export function runInBackground(promise) {
  const safe = Promise.resolve(promise).catch(() => {
    // Exception text may contain provider/user data. Logging must also remain
    // non-fatal: this promise is deliberately detached from the foreground.
    try { console.warn('BG_TAXONOMY_ARCHITECT_WARN', 'FAILED'); } catch { /* Non-fatal telemetry. */ }
  });
  if (typeof globalThis.EdgeRuntime?.waitUntil === 'function') {
    globalThis.EdgeRuntime.waitUntil(safe);
    return Promise.resolve();
  }
  return safe;
}

export function indexFullCatalog(catalogVersion, catalogFingerprint, categories, verifiedComplete = false) {
  const byNormalizedKey = new Map();
  for (const cat of categories) {
    const labelKey = normalizedClassificationIdentity(cat.label);
    if (labelKey) {
      const list = byNormalizedKey.get(labelKey) ?? [];
      list.push(cat);
      byNormalizedKey.set(labelKey, list);
    }
    for (const alias of cat.aliases ?? []) {
      const aliasKey = normalizedClassificationIdentity(alias);
      if (aliasKey) {
        const list = byNormalizedKey.get(aliasKey) ?? [];
        if (!list.includes(cat)) list.push(cat);
        byNormalizedKey.set(aliasKey, list);
      }
    }
  }

  cachedFullCatalog = {
    catalogVersion,
    catalogFingerprint,
    categories,
    byNormalizedKey,
    verifiedComplete,
  };
  return cachedFullCatalog;
}

export async function loadFullCatalogTree(rpc, signal) {
  // A snapshot is complete only when its own count matches its actual items;
  // a same-version/fingerprint cached PARTIAL tree is never a substitute.
  try {
    const snapRes = await rpc('rpc_taxonomy_fetch_snapshot_v1', { p_generation: 1 }, signal, 2500);
    const snap = snapRes?.ok ? snapRes.data : snapRes;
    if (snap && Number.isSafeInteger(snap.catalogVersion) && snap.catalogVersion > 0
        && typeof snap.catalogFingerprint === 'string' && snap.catalogFingerprint.length > 0
        && Array.isArray(snap.categories) && Number.isSafeInteger(snap.count)
        && snap.count === snap.categories.length) {
      const ids = new Set();
      for (const item of snap.categories) {
        if (!item || typeof item.categoryId !== 'string' || !item.categoryId
            || ids.has(item.categoryId)) throw new Error('FULL_CATALOG_SNAPSHOT_INVALID');
        ids.add(item.categoryId);
      }
      // Even if metadata is unchanged, a fresh authoritative complete response
      // replaces an earlier partial snapshot rather than retaining it.
      // Count alone cannot certify parent closure. Refuse malformed trees
      // before warming the shared complete cache used by both model paths.
      formatFullCatalogHierarchy({ verifiedComplete: true, categories: snap.categories });
      return indexFullCatalog(snap.catalogVersion, snap.catalogFingerprint, snap.categories, true);
    }
  } catch {
    // Snapshot RPC unavailable, malformed or not yet deployed: use a complete
    // paged walk. Neither path may cache an unverified partial result.
  }

  const metaRes = await rpc('rpc_taxonomy_query_catalog_service', {
    p_query: { operation: 'META', scope: 'ALL', limit: 1 },
  }, signal, 3000);
  const meta = metaRes?.ok ? metaRes.data : metaRes;
  if (cachedFullCatalog?.verifiedComplete && meta
      && Number.isSafeInteger(meta.catalogVersion)
      && cachedFullCatalog.catalogVersion === meta.catalogVersion
      && cachedFullCatalog.catalogFingerprint === meta.catalogFingerprint) {
    return cachedFullCatalog;
  }

  // Fallback: drain EVERY ROOTS and CHILDREN cursor. Limits refuse work instead
  // of silently cutting off a catalog and declaring an absent service new.
  const PAGE_LIMIT = 100, MAX_PAGES = 2048, MAX_NODES = 20000, BATCH = 16;
  let pageReads = 0, catalogVersion = null, catalogFingerprint = null;
  const allNodes = new Map(), queue = [];
  const readPages = async (operation, categoryId = null) => {
    const result = [], cursors = new Set();
    let cursor = null;
    do {
      if (++pageReads > MAX_PAGES) throw new Error('FULL_CATALOG_PAGE_LIMIT');
      const p_query = { operation, scope: 'ALL', limit: PAGE_LIMIT };
      if (categoryId !== null) {
        p_query.categoryId = categoryId;
        p_query.catalogVersion = catalogVersion;
        p_query.catalogFingerprint = catalogFingerprint;
      }
      if (cursor !== null) p_query.cursor = cursor;
      const response = await rpc('rpc_taxonomy_query_catalog_service', { p_query }, signal, 4000);
      const page = response?.ok ? response.data : response;
      if (!page || !Array.isArray(page.items)
          || !Number.isSafeInteger(page.catalogVersion) || page.catalogVersion < 1
          || typeof page.catalogFingerprint !== 'string' || !page.catalogFingerprint
          || page.operation !== operation || page.scope !== 'ALL'
          || !Number.isSafeInteger(page.count) || page.count !== page.items.length
          || !Object.hasOwn(page, 'nextCursor')
          || (page.nextCursor !== null
              && (typeof page.nextCursor !== 'string' || !page.nextCursor))) {
        throw new Error('FULL_CATALOG_PAGE_INVALID');
      }
      if (catalogVersion === null) {
        catalogVersion = page.catalogVersion;
        catalogFingerprint = page.catalogFingerprint;
      } else if (page.catalogVersion !== catalogVersion
          || page.catalogFingerprint !== catalogFingerprint) {
        throw new Error('FULL_CATALOG_VERSION_CHANGED');
      }
      for (const item of page.items) {
        if (!item || typeof item.categoryId !== 'string' || !item.categoryId
            || typeof item.isLeaf !== 'boolean'
            || (operation === 'ROOTS' && item.parentId !== null)
            || (operation === 'CHILDREN' && item.parentId !== categoryId)) {
          throw new Error('FULL_CATALOG_ITEM_INVALID');
        }
        result.push(item);
      }
      const next = page.nextCursor;
      if (next !== null) {
        if (cursors.has(next) || page.items.length === 0) {
          throw new Error('FULL_CATALOG_CURSOR_STALLED');
        }
        cursors.add(next);
      }
      cursor = next;
    } while (cursor !== null);
    return result;
  };

  const roots = await readPages('ROOTS');
  if (meta && Number.isSafeInteger(meta.catalogVersion)
      && (meta.catalogVersion !== catalogVersion
          || meta.catalogFingerprint !== catalogFingerprint)) {
    throw new Error('FULL_CATALOG_META_STALE');
  }
  const accept = item => {
    if (allNodes.has(item.categoryId)) throw new Error('FULL_CATALOG_DUPLICATE_ID');
    if (allNodes.size >= MAX_NODES) throw new Error('FULL_CATALOG_NODE_LIMIT');
    allNodes.set(item.categoryId, item);
    if (!item.isLeaf) queue.push(item.categoryId);
  };
  for (const root of roots) accept(root);
  while (queue.length > 0) {
    const batch = queue.splice(0, BATCH);
    // Concurrent reads, deterministic insertion in parent/batch order.
    const childLists = await Promise.all(batch.map(id => readPages('CHILDREN', id)));
    for (let i = 0; i < childLists.length; i++) {
      if (childLists[i].length === 0) throw new Error('FULL_CATALOG_NONLEAF_EMPTY');
      for (const child of childLists[i]) accept(child);
    }
  }

  // A paged walk also needs coherent ancestry before it can claim completeness.
  const completeNodes = [...allNodes.values()];
  formatFullCatalogHierarchy({ verifiedComplete: true, categories: completeNodes });
  return indexFullCatalog(catalogVersion, catalogFingerprint, completeNodes, true);
}

/**
 * The classifier must see the same parent/child structure regardless of the
 * order in a snapshot or in paged ROOTS/CHILDREN responses. Never infer a
 * hierarchy from indentation on an arbitrary (e.g. alphabetical) list.
 *
 * This is only model input: it grants NO authority to create/reuse a category,
 * change modes, or skip the signed review/save admission.
 */
export function formatFullCatalogHierarchy(catalog) {
  if (catalog?.verifiedComplete !== true || !Array.isArray(catalog.categories)
      || catalog.categories.length === 0 || catalog.categories.length > 20000) {
    throw new Error('FULL_CATALOG_HIERARCHY_UNVERIFIED');
  }
  const byId = new Map(), children = new Map();
  for (const node of catalog.categories) {
    const id = node?.categoryId;
    const parentId = node?.parentId ?? null;
    if (typeof id !== 'string' || !id || byId.has(id)
        || !Object.hasOwn(node, 'parentId')
        || (parentId !== null && (typeof parentId !== 'string' || !parentId || parentId === id))
        || typeof node?.label !== 'string' || !node.label.trim()
        || typeof node?.isLeaf !== 'boolean'
        || !Array.isArray(node?.aliases) || !Array.isArray(node?.modes)
        || !node.aliases.every(alias => typeof alias === 'string')
        || !node.modes.every(mode => typeof mode === 'string')) {
      throw new Error('FULL_CATALOG_HIERARCHY_INVALID');
    }
    byId.set(id, { ...node, parentId });
    const siblings = children.get(parentId) ?? [];
    siblings.push(id);
    children.set(parentId, siblings);
  }
  for (const { parentId } of byId.values()) {
    if (parentId !== null && !byId.has(parentId)) throw new Error('FULL_CATALOG_HIERARCHY_ORPHAN');
  }
  const roots = children.get(null) ?? [];
  if (roots.length === 0) throw new Error('FULL_CATALOG_HIERARCHY_CYCLE');
  for (const ids of children.values()) ids.sort();
  const seen = new Set(), lines = [];
  const stack = roots.slice().reverse().map(id => ({ id, path: [], pathIds: [] }));
  let totalBytes = 0;
  const encoder = new TextEncoder();
  while (stack.length > 0) {
    const { id, path, pathIds } = stack.pop();
    if (seen.has(id) || pathIds.length >= 32) throw new Error('FULL_CATALOG_HIERARCHY_CYCLE');
    seen.add(id);
    const node = byId.get(id), nested = children.get(id) ?? [];
    if (node.isLeaf && nested.length !== 0) throw new Error('FULL_CATALOG_HIERARCHY_LEAF_PARENT');
    const nextPath = [...path, node.label], nextPathIds = [...pathIds, id];
    // JSON quoting prevents labels/aliases containing newlines, quotes or
    // prompt-like text from altering the line format.
    const line = JSON.stringify({
      id, parentId: node.parentId, pathIds: nextPathIds, path: nextPath,
      aliases: node.aliases, modes: node.modes, isLeaf: node.isLeaf,
    });
    totalBytes += encoder.encode(line).length + 1;
    if (totalBytes > 350000) throw new Error('FULL_CATALOG_HIERARCHY_TOO_LARGE');
    lines.push(line);
    for (let i = nested.length - 1; i >= 0; i--) {
      stack.push({ id: nested[i], path: nextPath, pathIds: nextPathIds });
    }
  }
  if (seen.size !== byId.size) throw new Error('FULL_CATALOG_HIERARCHY_ORPHAN_OR_CYCLE');
  return lines.join('\n');
}

async function classifyNovelServicesWithGemini({
  geminiKey,
  geminiModel,
  catalog,
  unresolvedItems,
  scopeSummary,
  signal,
}) {
  const treeLines = formatFullCatalogHierarchy(catalog);

  const systemText = [
    'Ti si USKOČI Arhitekta stabla usluga (drugi Gemini u pozadini).',
    'Ispred sebe vidiš KOMPLETNO stablo svih postojećih kategorija i podkategorija u bazi.',
    'Za svaku traženu uslugu (service + mode):',
    '1. Proveri ceo katalog i sve konkurentne grane. Ako drugačije nazvana usluga nedvosmisleno znači ISTI konkretan posao kao postojeći list koji podržava traženi mode, vrati action="REUSE_EXISTING", categoryId=tačan ID tog lista, parentId="" i reason koji objašnjava ZAŠTO je posao identičan. Ovo je SAMO model predlog: server i korisnik zasebno potvrđuju značenje. Ne poistovećuj slične reči, isti roditelj ili samo širu oblast.',
    '2. Ako ne postoji konkretna ista usluga i namera je jasna, vrati action="CREATE_CHILD", categoryId="", i parentId UUID NAJPRECIZNIJEG postojećeg roditelja iz kompletnog stabla (koren ili dublja grana).',
    '3. Za CREATE_CHILD parentId MORA biti tačan UUID postojećeg čvora iz stabla. Za REUSE_EXISTING categoryId MORA biti postojeći UUID konkretnog lista sa istim poslom i kompatibilnim mode-om. Ako postoje konkurentna značenja ili se posao razlikuje (montaža klime NIJE čišćenje klime), traži razjašnjenje umesto ID-a.',
    '4. KRITIČNO PRAVILO ZA DVOSMISLENE USLUGE: Ako je tražena usluga dvosmislena, neodređena ili se može odnositi na više bitno različitih poslova (npr. samo "klima" — da li je montaža/ugradnja nove klime ili redovan servis/čišćenje/dopuna freona?; ili "nameštaj" — da li je sklapanje/montaža gotovog nameštaja, izrada po meri ili tapaciranje/restauracija?), NIKADA nemoj nagađati roditelja i NIKADA nemoj stavljati u opšte Zanati i popravke. U tom slučaju vrati action="NEEDS_CLARIFICATION", parentId="", i u ambiguityPrompt postavi prirodno, kratko pitanje na srpskom koje razjašnjava tačnu vrstu posla.',
    'Kratak opis obima je kontekst za razjašnjenje značenja usluge, ne dozvola da izmisliš novu uslugu ili način rada. Ne prenosi opis u naziv kategorije.',
    '5. Polje reason mora biti kratko obrazloženje na srpskom (15 do 200 znakova).',
  ].join(' ');

  const userText = JSON.stringify({
    catalogVersion: catalog.catalogVersion,
    servicesToClassify: unresolvedItems,
    scopeSummary,
    completeCatalogTree: treeLines,
  });

  const responseSchema = {
    type: 'OBJECT',
    required: ['decisions'],
    properties: {
      decisions: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          required: ['service', 'mode', 'parentId', 'reason'],
          properties: {
            service: { type: 'STRING' },
            mode: { type: 'STRING', enum: ['ON_SITE', 'REMOTE'] },
            action: { type: 'STRING', enum: ['REUSE_EXISTING', 'CREATE_CHILD', 'NEEDS_CLARIFICATION', 'AMBIGUOUS'] },
            categoryId: { type: 'STRING' },
            parentId: { type: 'STRING' },
            ambiguityPrompt: { type: 'STRING' },
            reason: { type: 'STRING' },
          },
        },
      },
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema,
        ...(String(geminiModel).includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }),
    signal,
  });

  return providerEntries(res, 'decisions', signal);
}

/**
 * Builds verified proposals for rpc_taxonomy_capture_gemini_turn_hints_service
 * using the complete catalog tree and, when needed, the second Gemini architect.
 * Eliminates defaultRootFallback: returns NEEDS_CLARIFICATION / AMBIGUOUS when uncertain.
 */
export async function buildFullTreeTaxonomyProposals({
  rpc,
  geminiKey,
  geminiModel,
  items,
  scopeSummary,
  conversationId,
  draftRevision,
  signal,
}) {
  if (!Array.isArray(items) || items.length === 0) return null;
  // The caller passes the typed public description, not the private address,
  // access notes or map pin. Do not retain the description in an in-memory key.
  const publicScope = typeof scopeSummary === 'string' ? scopeSummary.trim().slice(0, 500) : '';
  const scopeHash = publicScope
    ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(publicScope))))
      .map((byte) => byte.toString(16).padStart(2, '0')).join('')
    : '';
  const catalog = await loadFullCatalogTree(rpc, signal);
  const validNodeIds = new Set(catalog.categories.map((c) => c.categoryId));

  const proposals = [];
  const unresolved = [];
  const clarifications = [];
  const failures = [];

  for (const item of items) {
    const service = typeof item?.service === 'string' ? item.service.trim() : '';
    const mode = item?.mode === 'REMOTE' ? 'REMOTE' : item?.mode === 'ON_SITE' ? 'ON_SITE' : null;
    if (!service || service.length < 3 || !mode) continue;
    const norm = normalizedClassificationIdentity(service);
    if (!norm) continue;
    // Unknown physical/digital handoff is not consent to digital delivery.
    const decodedHandoff = mode === 'REMOTE' ? decodeServiceHandoff(item.handoff) : undefined;

    const matches = catalog.byNormalizedKey.get(norm) ?? [];
    if (matches.length === 1) {
      const match = matches[0];
      const hasMode = Array.isArray(match.modes) && match.modes.includes(mode);
      proposals.push({
        service,
        mode,
        action: hasMode ? 'REUSE_EXISTING' : 'EXTEND_MODE',
        categoryId: match.categoryId,
        parentId: '',
        proposedPath: [],
        reason: hasMode
          ? `Usluga je pronađena u postojećem katalogu (${match.path.join(' > ')}).`
          : `Postojeća kategorija (${match.path.join(' > ')}) proširuje se za ${mode === 'REMOTE' ? 'rad na daljinu' : 'rad na lokaciji'}.`,
        catalogVersion: catalog.catalogVersion,
        ...(decodedHandoff ? { handoff: decodedHandoff } : {}),
      });
    } else {
      const cacheKey = `${catalog.catalogVersion}|${norm}|${mode}|${scopeHash}`;
      const cachedDecision = cachedNovelDecisions.get(cacheKey);
      if (cachedDecision && validNodeIds.has(cachedDecision.parentId)) {
        proposals.push({
          service,
          mode,
          action: 'CREATE_CHILD',
          categoryId: '',
          parentId: cachedDecision.parentId,
          proposedPath: [service],
          reason: cachedDecision.reason,
          catalogVersion: catalog.catalogVersion,
          ...(decodedHandoff ? { handoff: decodedHandoff } : {}),
        });
      } else {
        unresolved.push({ service, mode, handoff: decodedHandoff });
      }
    }
  }

  if (unresolved.length > 0) {
    let aiDecisions = [];
    if (geminiKey && geminiModel) {
      try {
        aiDecisions = await classifyNovelServicesWithGemini({
          geminiKey,
          geminiModel,
          catalog,
          unresolvedItems: unresolved.map(({ service, mode }) => ({ service, mode })),
          scopeSummary: publicScope,
          signal,
        });
      } catch (err) {
        reportProviderFailure(err, failures);
      }
    } else {
      recordFailure({ status: 'PROVIDER_PERMANENT_FAILURE', code: 'PROVIDER_NOT_CONFIGURED' }, failures);
    }

    for (const item of unresolved) {
      const norm = normalizedClassificationIdentity(item.service);
      const decisions = aiDecisions.filter(
        (d) => normalizedClassificationIdentity(d?.service) === norm && d?.mode === item.mode
      );
      const decision = decisions.length === 1 ? decisions[0] : null;
      if (validClarification(decision)) {
        const clarification = {
          conversationId: conversationId ?? null,
          draftRevision: draftRevision ?? null,
          service: item.service,
          mode: item.mode,
          action: 'NEEDS_CLARIFICATION',
          ambiguityPrompt: boundedCodepoints(decision.ambiguityPrompt.trim(), 500),
          reason: boundedCodepoints(decision.reason.trim(), 300),
          createdAt: new Date().toISOString(),
        };
        clarifications.push(clarification);
      } else if (semanticReuseHint(decision, item.service, item.mode, catalog)) {
        const reusable = semanticReuseHint(decision, item.service, item.mode, catalog);
        // The SQL reviewer will keep an unregistered synonym PENDING. This
        // capture preserves the candidate ID without authorizing it.
        proposals.push({
          service: item.service, mode: item.mode, action: 'REUSE_EXISTING',
          categoryId: reusable.categoryId, parentId: '', proposedPath: [],
          reason: reusable.reason, catalogVersion: catalog.catalogVersion,
          ...(item.handoff ? { handoff: item.handoff } : {}),
        });
      } else if (decision?.action === 'CREATE_CHILD' && validNodeIds.has(decision.parentId)) {
        const parentId = decision.parentId;
        const rawReason = typeof decision?.reason === 'string' && decision.reason.trim().length >= 10
          ? decision.reason.trim().slice(0, 900)
          : `Nova specifična usluga „${item.service}“ raspoređena pod odgovarajuću granu kataloga.`;

        cachedNovelDecisions.set(`${catalog.catalogVersion}|${norm}|${item.mode}|${scopeHash}`, {
          parentId,
          reason: rawReason,
        });
        proposals.push({
          service: item.service,
          mode: item.mode,
          action: 'CREATE_CHILD',
          categoryId: '',
          parentId,
          proposedPath: [item.service],
          reason: rawReason,
          catalogVersion: catalog.catalogVersion,
          ...(item.handoff ? { handoff: item.handoff } : {}),
        });
      } else if (aiDecisions.length > 0) {
        recordFailure({ ...decisionFailure(decision), service: item.service, mode: item.mode }, failures);
      }
    }
  }

  return {
    catalogVersion: catalog.catalogVersion,
    proposals,
    clarifications,
    clarificationHint: clarifications[0] ?? null,
    failures,
  };
}

async function classifyWorkerServicesWithGemini({
  geminiKey,
  geminiModel,
  catalog,
  skills,
  userMessages,
  priorModes,
  hasWorkAreas,
  signal,
}) {
  const treeLines = formatFullCatalogHierarchy(catalog);

  const systemText = [
    'Ti si USKOČI Arhitekta stabla usluga za radni profil (drugi Gemini u pozadini).',
    'Ispred sebe vidiš KOMPLETNO stablo svih postojećih kategorija u bazi, listu usluga radnika (skills) i njegove poruke.',
    'Za SVAKU uslugu iz liste skills odredi:',
    '1. mode: "ON_SITE" (izvršenje kod naručioca/na terenu), "REMOTE" (izvršenje drugde, uključujući radionicu) ili "UNKNOWN". Koristi samo način rada koji je radnik izričito ponudio za tu uslugu ili njegov sačuvani izbor u priorModes. Katalog, vrsta posla i područje rada nisu dokaz saglasnosti. Nepoznat način rada ostaje UNKNOWN i zahteva jedno kratko pitanje.',
    '2. Ako postoji isti canonical naziv ili alias, predloži REUSE_EXISTING ili EXTEND_MODE samo za radnikov izričito ponuđeni mode. Ako neupisan sinonim nedvosmisleno označava ISTI konkretan posao kao postojeći list, predloži REUSE_EXISTING uz categoryId tog lista, parentId="" i razlog koji upoređuje značenje. Proveri sve konkurentne grane i ne spajaj montažu klime sa čišćenjem klime. To je samo hint, ne upis sposobnosti. Ako je stvarno NOV posao, CREATE_CHILD uz parentId tačnog roditelja. Preširoko ili dvosmisleno (samo "klima" ili "nameštaj") zahteva NEEDS_CLARIFICATION.',
    '3. Za REMOTE uslugu odredi handoffKind: "NONE" (digitalna isporuka bez fizičke predaje), "SHIPPING_RS" (slanje poštom/kurirskom službom u Srbiji), ili "LOCAL_EXCHANGE" (lično preuzimanje u gradu handoffCity).',
    '4. reason: kratko obrazloženje na srpskom (15 do 200 znakova).',
  ].join(' ');

  const userText = JSON.stringify({
    catalogVersion: catalog.catalogVersion,
    skills,
    hasWorkAreas,
    priorModes,
    recentUserMessages: userMessages.slice(-10),
    completeCatalogTree: treeLines,
  });

  const responseSchema = {
    type: 'OBJECT',
    required: ['items'],
    properties: {
      items: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          required: ['service', 'mode', 'action', 'parentId', 'handoffKind', 'handoffCity', 'reason'],
          properties: {
            service: { type: 'STRING' },
            mode: { type: 'STRING', enum: ['ON_SITE', 'REMOTE', 'UNKNOWN'] },
            action: { type: 'STRING', enum: ['REUSE_EXISTING', 'EXTEND_MODE', 'CREATE_CHILD', 'NEEDS_CLARIFICATION', 'AMBIGUOUS'] },
            categoryId: { type: 'STRING' },
            parentId: { type: 'STRING' },
            ambiguityPrompt: { type: 'STRING' },
            handoffKind: { type: 'STRING', enum: ['NONE', 'SHIPPING_RS', 'LOCAL_EXCHANGE'] },
            handoffCity: { type: 'STRING' },
            reason: { type: 'STRING' },
          },
        },
      },
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema,
        ...(String(geminiModel).includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }),
    signal,
  });

  return providerEntries(res, 'items', signal);
}

export async function buildWorkerFullTreeTaxonomyProposals({
  rpc,
  geminiKey,
  geminiModel,
  skills,
  messages,
  serviceModeContext,
  serviceModeChangesJson,
  hasWorkAreas,
  conversationId,
  draftRevision,
  signal,
}) {
  const cleanSkills = Array.isArray(skills)
    ? skills.filter((s) => typeof s === 'string' && s.trim().length >= 3).map((s) => s.trim())
    : [];
  if (cleanSkills.length === 0) return null;

  const catalog = await loadFullCatalogTree(rpc, signal);
  const validNodeIds = new Set(catalog.categories.map((c) => c.categoryId));

  // Draft classifier hints are not consent. Only saved modes and explicit
  // USER-quoted requests may constrain this still-unapproved proposal.
  const priorModes = Array.isArray(serviceModeContext?.savedServices) ? serviceModeContext.savedServices : [];
  const ownedMessages = Array.isArray(messages) ? messages : [];
  const requests = workerModeRequests(serviceModeChangesJson, { messages: ownedMessages },
    new Map(cleanSkills.map(service => [normalizedClassificationIdentity(service), service])));
  let declaredChanges = [];
  let malformedChanges = false;
  if (typeof serviceModeChangesJson === 'string' && serviceModeChangesJson.trim() !== '') {
    try {
      const parsed = JSON.parse(serviceModeChangesJson);
      if (Array.isArray(parsed) && parsed.length <= 12) declaredChanges = parsed;
      else malformedChanges = true;
    } catch { malformedChanges = true; }
  }
  const userMessages = Array.isArray(messages)
    ? messages.filter((m) => m?.role === 'USER' && typeof m?.body === 'string').map((m) => m.body)
    : [];

  let aiItems = [];
  const failures = [];
  if (geminiKey && geminiModel) {
    try {
      aiItems = await classifyWorkerServicesWithGemini({
        geminiKey,
        geminiModel,
        catalog,
        skills: cleanSkills,
        userMessages,
        priorModes,
        hasWorkAreas: Boolean(hasWorkAreas),
        signal,
      });
    } catch (err) {
      reportProviderFailure(err, failures);
    }
  } else {
    recordFailure({ status: 'PROVIDER_PERMANENT_FAILURE', code: 'PROVIDER_NOT_CONFIGURED' }, failures);
  }
  const providerUnavailable = failures.length > 0;

  const proposals = [];
  const clarifications = [];
  const seenKeys = new Set();
  const unresolvedServices = [];

  for (const service of cleanSkills) {
    const norm = normalizedClassificationIdentity(service);
    if (!norm) continue;

    const matchingAi = aiItems.filter((item) => normalizedClassificationIdentity(item?.service) === norm);
    const matchingPrior = priorModes.filter((item) => normalizedClassificationIdentity(item?.service) === norm);

    const requested = requests.get(norm);
    if (malformedChanges || !requested && declaredChanges.some(change => normalizedClassificationIdentity(change?.service) === norm)) {
      // A rejected/duplicated fresh declaration is not an unrelated edit. Do
      // not silently resurrect the old mode while that change is unresolved.
      unresolvedServices.push(service);
      recordFailure({ status: 'RETRYABLE_PROVIDER', code: 'WORKER_MODE_REQUEST_INVALID', service }, failures);
      continue;
    }
    if (requested && providerUnavailable) {
      unresolvedServices.push(service);
      continue;
    }
    const savedValid = matchingPrior.length > 0
      && new Set(matchingPrior.map(entry => entry.categoryId)).size === 1
      && matchingPrior.every(entry => executionMode(entry.mode)
        && (!Object.hasOwn(entry, 'handoff') || entry.mode === 'REMOTE' && decodeServiceHandoff(entry.handoff)));
    const chosenEntries = requested ? requested.modes.map(mode => {
      const saved = savedValid ? matchingPrior.find(entry => entry.mode === mode) : null;
      const handoff = mode === 'REMOTE'
        ? Object.hasOwn(requested, 'handoff') ? decodeServiceHandoff(requested.handoff) : decodeServiceHandoff(saved?.handoff)
        : undefined;
      return { mode, ...(handoff ? { handoff } : {}) };
    }) : savedValid ? matchingPrior : [];
    const addClarification = (decision, mode) => {
      // A question is NOT a completed mode. Keep its service visible to the
      // later review/recovery path, including one unresolved half of BOTH.
      unresolvedServices.push(service);
      clarifications.push({
        conversationId: conversationId ?? null,
        draftRevision: draftRevision ?? null,
        service, mode, action: 'NEEDS_CLARIFICATION',
        ambiguityPrompt: boundedCodepoints(decision.ambiguityPrompt.trim(), 500),
        reason: boundedCodepoints(decision.reason.trim(), 300), createdAt: new Date().toISOString(),
      });
    };
    if (chosenEntries.length === 0) {
      unresolvedServices.push(service);
      // A valid actual question is distinct from unavailable/malformed output.
      if (matchingAi.length === 1 && validClarification(matchingAi[0])
          && ['UNKNOWN', 'ON_SITE', 'REMOTE'].includes(matchingAi[0].mode)) {
        addClarification(matchingAi[0], null);
      } else if (aiItems.length > 0) {
        recordFailure({ status: 'RETRYABLE_PROVIDER', code: 'WORKER_MODE_UNCONFIRMED', service }, failures);
      }
      continue;
    }

    for (const chosen of chosenEntries) {
      const dedupeKey = `${norm}|${chosen.mode}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      const decisions = matchingAi.filter(entry => entry.mode === chosen.mode);
      const decision = decisions.length === 1 ? decisions[0] : null;
      if (validClarification(decision)) {
        addClarification(decision, chosen.mode);
        continue;
      }
      if (requested && (!['REUSE_EXISTING', 'EXTEND_MODE', 'CREATE_CHILD'].includes(decision?.action)
          || typeof decision.reason !== 'string' || decision.reason.trim().length < 10)) {
        unresolvedServices.push(service);
        recordFailure({ status: 'RETRYABLE_PROVIDER', code: 'PROVIDER_INVALID_DECISION', service, mode: chosen.mode }, failures);
        continue;
      }

      const matches = catalog.byNormalizedKey.get(norm) ?? [];
      if (matches.length === 1) {
        const match = matches[0];
        const hasMode = Array.isArray(match.modes) && match.modes.includes(chosen.mode);
        // Saved continuity cannot repair a changed catalog or extend a mode.
        // Fresh changes have already required one valid provider decision;
        // its optional ID cannot contradict this deterministic exact identity.
        if (!requested && (chosen.categoryId !== match.categoryId || !hasMode)
            || requested && decision.categoryId && decision.categoryId !== match.categoryId) {
          unresolvedServices.push(service);
          continue;
        }
        proposals.push({
          service,
          mode: chosen.mode,
          action: hasMode ? 'REUSE_EXISTING' : 'EXTEND_MODE',
          categoryId: match.categoryId,
          parentId: '',
          proposedPath: [],
          reason: hasMode
            ? `Usluga je pronađena u postojećem katalogu (${match.path.join(' > ')}).`
            : `Postojeća kategorija (${match.path.join(' > ')}) proširuje se za ${chosen.mode === 'REMOTE' ? 'rad na daljinu' : 'rad na lokaciji'}.`,
          catalogVersion: catalog.catalogVersion,
          ...(chosen.mode === 'REMOTE' && chosen.handoff ? { handoff: chosen.handoff } : {}),
        });
      } else {
        const isValidParent = decision?.parentId && validNodeIds.has(decision.parentId);
        const reusable = requested && matches.length === 0
          ? semanticReuseHint(decision, service, chosen.mode, catalog) : null;
        if (reusable) {
          // Only a USER-quoted mode can survive as a semantic ID hint. It is
          // deliberately unresolved for review: the current server admission
          // rejects unregistered synonyms, even when this ID truly exists.
          proposals.push({
            service, mode: chosen.mode, action: 'REUSE_EXISTING',
            categoryId: reusable.categoryId, parentId: '', proposedPath: [],
            reason: reusable.reason, catalogVersion: catalog.catalogVersion,
            ...(chosen.mode === 'REMOTE' && chosen.handoff ? { handoff: chosen.handoff } : {}),
          });
          unresolvedServices.push(service);
        } else if (requested && isValidParent && decision.action === 'CREATE_CHILD') {
          const rawReason = typeof decision.reason === 'string' && decision.reason.trim().length >= 10
            ? decision.reason.trim().slice(0, 900)
            : `Nova specifična usluga „${service}“ raspoređena pod odgovarajuću granu kataloga.`;
          proposals.push({
            service,
            mode: chosen.mode,
            action: 'CREATE_CHILD',
            categoryId: '',
            parentId: decision.parentId,
            proposedPath: [service],
            reason: rawReason,
            catalogVersion: catalog.catalogVersion,
            ...(chosen.mode === 'REMOTE' && chosen.handoff ? { handoff: chosen.handoff } : {}),
          });
        } else {
          // Model-proposed semantic REUSE is not a server-verified alias, and
          // missing/invalid mode decisions cannot silently disappear when a
          // different mode for the same service already has a proposal.
          unresolvedServices.push(service);
          if (aiItems.length > 0) {
            recordFailure({ ...decisionFailure(decision), service, mode: chosen.mode }, failures);
          }
        }
      }
    }
    // One specific service cannot acquire different canonical IDs or parents
    // because the provider answered ON_SITE and REMOTE separately. Refuse the
    // conflicting hints together; valid unrelated services remain untouched.
    const claimed = proposals.filter(p => normalizedClassificationIdentity(p.service) === norm);
    if (new Set(claimed.filter(p => p.categoryId).map(p => p.categoryId)).size > 1
        || new Set(claimed.filter(p => p.action === 'CREATE_CHILD').map(p => p.parentId)).size > 1
        || claimed.some(p => p.action === 'REUSE_EXISTING')
          && claimed.some(p => p.action === 'CREATE_CHILD')) {
      for (let i = proposals.length - 1; i >= 0; i--) {
        if (normalizedClassificationIdentity(proposals[i].service) === norm) proposals.splice(i, 1);
      }
      unresolvedServices.push(service);
      recordFailure({ status: 'RETRYABLE_PROVIDER', code: 'WORKER_SERVICE_CATEGORY_ID_CONFLICT', service }, failures);
    } else if (claimed.length > 0 && chosenEntries.some(entry => !claimed.some(p => p.mode === entry.mode))) {
      // The existing capture RPC stores proposals only. A local unresolved flag
      // cannot protect that boundary: half of BOTH would look like a complete
      // single-mode proposal. Keep this service atomic until all its requested
      // modes are classified; retain its real clarification and other services.
      // This is not consent, a durable retry, or a canonical taxonomy write.
      for (let i = proposals.length - 1; i >= 0; i--) {
        if (normalizedClassificationIdentity(proposals[i].service) === norm) proposals.splice(i, 1);
      }
      unresolvedServices.push(service);
      recordFailure({ status: 'RETRYABLE_PROVIDER', code: 'WORKER_SERVICE_MODE_SET_INCOMPLETE', service }, failures);
    }
  }

  return {
    catalogVersion: catalog.catalogVersion,
    proposals,
    clarifications,
    clarificationHint: clarifications[0] ?? null,
    failures,
    unresolvedServices: [...new Set(unresolvedServices)],
  };
}
