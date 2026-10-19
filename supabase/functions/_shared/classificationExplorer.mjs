// Read-only, version-fenced navigation of the canonical taxonomy. The model can
// reach any branch; a response page is never described as the whole catalog.
import { normalizedClassificationIdentity } from './classificationEngine.mjs';

const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const uuid = v => typeof v === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(v);
const bytes = v => new TextEncoder().encode(JSON.stringify(v)).byteLength;
const fingerprint = v => typeof v === 'string' && /^[a-f\d]{32}$/.test(v);
const operations = new Set(['META','SEARCH','EXACT','ROOTS','CHILDREN','SIBLINGS','ANCESTORS','RESOLVE']);
const fail = code => { throw new Error('CLASSIFICATION_EXPLORER_' + code); };
const label = value => normalizedClassificationIdentity(value) !== null;
const queryKey = query => JSON.stringify(Object.fromEntries(Object.entries(query).sort(([a],[b]) => a.localeCompare(b))
  .map(([key,value]) => [key,key === 'categoryIds' ? [...value].sort() : value])));

export const taxonomyToolDeclaration = Object.freeze({
  name: 'taxonomy_catalog',
  description: 'Read the CURRENT server catalog. SEARCH searches across the whole eligible catalog; use several meaningful terms/synonyms when needed. ROOTS, CHILDREN, SIBLINGS and ANCESTORS explore its structure. RESOLVE reads real IDs. Results are pages, never the whole tree. Follow nextCursor with the SAME operation, filters and service. Search the actual service in scope ALL before proposing a new branch. No write, Save, matching or notification authority.',
  parameters: { type: 'OBJECT', required: ['operation'], properties: {
    operation: { type: 'STRING', enum: ['SEARCH','ROOTS','CHILDREN','SIBLINGS','ANCESTORS','RESOLVE'] },
    text: { type: 'STRING', description: 'SEARCH query, 1–256 characters (e.g. 3D); use useful job/object terms, not the whole conversation.' },
    service: { type: 'STRING', description: 'Exact proposed service name whose meaning this SEARCH investigates (3–120 characters).' },
    scope: { type: 'STRING', enum: ['ALL','REMOTE','ON_SITE'], description: 'Default ALL. Search ALL for novelty; service delivery is a separate question.' },
    categoryId: { type: 'STRING', description: 'Existing UUID for CHILDREN, SIBLINGS or ANCESTORS.' },
    categoryIds: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Existing UUIDs for RESOLVE.' },
    cursor: { type: 'STRING', description: 'The exact nextCursor previously returned for this query.' },
  } },
});

export async function createClassificationExplorer(rpc, options = {}) {
  if (typeof rpc !== 'function') fail('INVALID_RPC');
  const { signal, seedServices = [], seedCategoryIds = [], pageSize = 32,
    maxPageBytes = 524288, maxEvidenceBytes = 2097152, maxQueries = 128 } = options;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
      !Number.isInteger(maxQueries) || maxQueries < 2 ||
      !Number.isInteger(maxPageBytes) || maxPageBytes < 1024 ||
      !Number.isInteger(maxEvidenceBytes) || maxEvidenceBytes < maxPageBytes) fail('INVALID_LIMITS');
  let version = null, digest = null, receivedBytes = 0, queryCount = 0, invalid = false;
  const nodes = new Map(), cache = new Map(), issuedCursors = new Map(), searched = new Set();
  const identities = new Map(), initialPages = [];
  const modelPage = answer => ({ ...answer, items: answer.items.map(({ path, pathIds, ...item }) => item) });
  const active = () => { if (signal?.aborted) fail('CANCELLED'); if (invalid) fail('INCOMPLETE'); };
  function validateNode(row) {
    if (!record(row) || !uuid(row.categoryId) || !label(row.label) ||
        !(row.parentId === null || uuid(row.parentId)) || !Array.isArray(row.aliases) || !row.aliases.every(label) ||
        !Array.isArray(row.modes) || !row.modes.length || row.modes.some(m => !['REMOTE','ON_SITE'].includes(m)) ||
        !Array.isArray(row.path) || !row.path.length || !row.path.every(label) ||
        !Array.isArray(row.pathIds) || row.pathIds.length !== row.path.length || !row.pathIds.every(uuid) ||
        new Set(row.pathIds).size !== row.pathIds.length || row.pathIds.at(-1) !== row.categoryId ||
        row.path.at(-1) !== row.label || (row.pathIds.length > 1 ? row.pathIds.at(-2) !== row.parentId : row.parentId !== null) ||
        typeof row.isLeaf !== 'boolean') fail('INVALID_NODE');
    const node = { id: row.categoryId, label: row.label, parentId: row.parentId,
      aliases: row.aliases.slice(), modes: row.modes.slice(), path: row.path.slice(), isLeaf: row.isLeaf };
    const prior = nodes.get(node.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(node)) fail('CONFLICTING_NODE');
    nodes.set(node.id, node);
    return node;
  }
  async function query(raw, { fresh = false } = {}) {
    active();
    if (!record(raw) || !operations.has(raw.operation)) fail('INVALID_QUERY');
    const q = { ...raw, scope: raw.scope ?? 'ALL', limit: pageSize };
    if (!['ALL','REMOTE','ON_SITE'].includes(q.scope)) fail('INVALID_SCOPE');
    const service = q.service; delete q.service;
    if (Object.keys(q).some(k => !['operation','scope','limit','text','categoryId','categoryIds','cursor'].includes(k))) fail('INVALID_QUERY');
    if (['SEARCH','EXACT'].includes(q.operation) && (typeof q.text !== 'string' || !q.text.trim() || q.text.length > 256 || /[\u0000-\u001f]/.test(q.text))) fail('INVALID_TEXT');
    if (service !== undefined && !label(service)) fail('INVALID_SERVICE');
    if (['CHILDREN','SIBLINGS','ANCESTORS'].includes(q.operation) && !uuid(q.categoryId)) fail('INVALID_ID');
    if (q.operation === 'RESOLVE' && (!Array.isArray(q.categoryIds) || q.categoryIds.length > 100 || !q.categoryIds.every(uuid))) fail('INVALID_IDS');
    const base = { ...q }; delete base.cursor;
    const key = queryKey(base), cacheKey = queryKey(q);
    if (q.cursor != null && (typeof q.cursor !== 'string' || !issuedCursors.get(q.cursor)?.has(key))) fail('UNKNOWN_CURSOR');
    let answer = cache.get(cacheKey);
    if (fresh || !answer) {
      if (++queryCount > maxQueries) { invalid = true; fail('QUERY_BUDGET'); }
      try {
        answer = await rpc('rpc_taxonomy_query_catalog_service', { p_query: {
          ...q, ...(version !== null ? { catalogVersion: version, catalogFingerprint: digest } : {}),
        } });
        active();
        const size = bytes(answer); receivedBytes += size;
        if (size > maxPageBytes || receivedBytes > maxEvidenceBytes) fail('EVIDENCE_BUDGET');
        if (!record(answer) || answer.schemaVersion !== 'TAXONOMY_CATALOG_QUERY_V1' || answer.action !== 'CATALOG_QUERY' ||
            answer.operation !== q.operation || answer.scope !== q.scope ||
            !Number.isSafeInteger(answer.catalogVersion) || answer.catalogVersion < 1 || !fingerprint(answer.catalogFingerprint) ||
            !Array.isArray(answer.items) || answer.items.length > pageSize || answer.count !== answer.items.length ||
            !['classificationAuthority','capabilityAuthority','notificationAuthority'].every(k => answer[k] === 'NONE') ||
            !(answer.nextCursor === null || typeof answer.nextCursor === 'string' && answer.nextCursor.length > 0 && answer.nextCursor.length < 16384)) fail('INVALID_PAGE');
        if (version !== null && (answer.catalogVersion !== version || answer.catalogFingerprint !== digest)) fail('STALE');
        version = answer.catalogVersion; digest = answer.catalogFingerprint;
        answer.items.forEach(validateNode);
        if (answer.nextCursor !== null) {
          if (answer.nextCursor === q.cursor) fail('REPEATED_CURSOR');
          const keys = issuedCursors.get(answer.nextCursor) ?? new Map();
          if (keys.has(key) && keys.get(key) !== cacheKey) fail('REPEATED_CURSOR');
          keys.set(key,cacheKey); issuedCursors.set(answer.nextCursor, keys);
        }
        cache.set(cacheKey, answer);
      } catch (error) { invalid = true; throw error; }
    }
    if (q.operation === 'SEARCH' && q.scope === 'ALL' && answer.nextCursor === null && label(service ?? q.text))
      searched.add(normalizedClassificationIdentity(service ?? q.text));
    return answer;
  }
  async function allExact(service) {
    const key = normalizedClassificationIdentity(service);
    if (!key || identities.has(key)) return;
    const ids = new Set(); let cursor;
    do {
      const page = await query({ operation: 'EXACT', text: service, scope: 'ALL', ...(cursor ? { cursor } : {}) });
      for (const node of page.items) ids.add(node.categoryId);
      cursor = page.nextCursor;
    } while (cursor !== null);
    identities.set(key, [...ids]);
  }
  async function allResolved(categoryIds) {
    const pages = []; let cursor;
    do {
      const page = await query({ operation: 'RESOLVE', categoryIds, ...(cursor ? { cursor } : {}) });
      pages.push(page); cursor = page.nextCursor;
    } while (cursor !== null);
    return pages;
  }
  await query({ operation: 'META' });
  initialPages.push(await query({ operation: 'ROOTS' }));
  const seeds = [...new Set(seedServices.filter(label).map(s => s.trim()))].slice(0, 24);
  // Independent seed lookups share the already-established snapshot. Batches of
  // four avoid multiplying mobile waiting time by the number of offered jobs.
  for (let start = 0; start < seeds.length; start += 4)
    initialPages.push(...await Promise.all(seeds.slice(start,start+4).map(service => query({ operation: 'SEARCH', text: service, service }))));
  const seedIds = [...new Set(seedCategoryIds.filter(uuid))].slice(0, 100);
  if (seedIds.length) initialPages.push(...await allResolved(seedIds));

  const snapshot = () => ({ catalogVersion: version, catalogFingerprint: digest, categories: [...nodes.values()],
    navigation: { kind: 'SERVER_QUERIES', identityChecks: [...identities].map(([service, categoryIds]) => ({ service, categoryIds })),
      searchedServices: [...searched] } });
  return {
    get catalogVersion() { return version; },
    get catalogFingerprint() { return digest; },
    get queryCount() { return queryCount; },
    get evidenceBytes() { return receivedBytes; },
    prompt() {
      return JSON.stringify({ catalogVersion: version, catalogFingerprint: digest, complete: false,
        catalogAccess: 'WHOLE_CURRENT_CATALOG_VIA_READ_ONLY_TOOLS', classificationAuthority: 'NONE',
        instructions: 'These are initial pages only, NOT a complete catalog and NOT a closed shortlist. Use taxonomy_catalog to search globally and inspect any branch at any depth. Every real ID and registered alias comes from the server. Read nextCursor as more results, never absence. SEARCH scope ALL with service set to the exact proposed service name before proposing CREATE_CHILD or CREATE_NEW_BRANCH; follow pages until that search is complete. Search alternate wording and inspect plausible parent/sibling branches when meanings may overlap. A missing phrase is not proof of a missing service. Reuse an existing ID only for exactly the same offered work. Keep scope/delivery distinct. Ask the person about the actual work when ambiguous, never ask them to choose a taxonomy ID. Never claim creation, activation, Save or publication. If research is incomplete use NEEDS_REVIEW and keep the useful user facts. The final classification snapshot must reflect every current offered service, not just the new message.',
        pages: initialPages.map(modelPage) });
    },
    async execute(args, context = {}) {
      if (context.signal?.aborted) fail('CANCELLED');
      if (!record(args) || !taxonomyToolDeclaration.parameters.properties.operation.enum.includes(args.operation)) fail('INVALID_TOOL');
      return modelPage(await query(args));
    },
    async verify(raw, { services = [], categoryIds = [] } = {}) {
      // Provider fields remain untrusted. Global exact/alias checks are performed
      // by the server, including collisions outside the pages the model explored.
      active();
      let proposals = [];
      if (record(raw) && typeof raw.classificationShadowJson === 'string' && bytes(raw.classificationShadowJson) <= 32768) {
        try { const value = JSON.parse(raw.classificationShadowJson); if (Array.isArray(value) && value.length <= 24) proposals = value.filter(record); } catch { /* strict inspector handles malformed metadata */ }
      }
      const names = [...new Set([...services, ...proposals.map(p => p.service)].filter(label))];
      if (names.length > 48) fail('INVALID_SERVICE_BATCH');
      for (let start = 0; start < names.length; start += 4)
        await Promise.all(names.slice(start,start+4).map(allExact));
      const ids = [...new Set([...categoryIds, ...proposals.flatMap(p => [p.categoryId,p.parentId])].filter(uuid))];
      if (ids.length > 100) fail('INVALID_ID_BATCH');
      if (ids.length) await allResolved(ids);
      // Recheck freshness after inference, including alias-only updates. A stale
      // result can never turn into a captured classification hint.
      await query({ operation: 'META' }, { fresh: true });
      return snapshot();
    },
  };
}
