import { normalizedClassificationIdentity, reviewClassificationProposal } from './classificationEngine.mjs';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const uuid = value => typeof value === 'string' && /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
const mode = value => value === 'REMOTE' || value === 'ON_SITE';
const label = value => typeof value === 'string' && value.trim().length >= 3 && value.length <= 120 && !/[<>\u0000-\u001f]/.test(value);
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

/** Owned SQL context only. Catalog execution modes describe a category, never a worker's choices. */
export function readWorkerServiceModeContext(context) {
  const data = context.serviceModeContext;
  if (!exact(data, ['schemaVersion', 'revision', 'savedServices', 'draftServices', 'unresolvedServices'])
      || data.schemaVersion !== 'WORKER_SERVICE_MODE_CONTEXT_V1'
      || !Number.isSafeInteger(data.revision) || data.revision !== context.revision
      || !Array.isArray(context.candidate?.skills)) throw new Error('WORKER_MODE_CONTEXT_INVALID');
  const offered = new Set(context.candidate.skills.map(normalizedClassificationIdentity));
  for (const entries of [data.savedServices, data.draftServices]) {
    if (!Array.isArray(entries) || entries.length > 24) throw new Error('WORKER_MODE_CONTEXT_INVALID');
    const seen = new Set();
    for (const entry of entries) {
      const key = normalizedClassificationIdentity(entry?.service);
      const identity = key + '|' + entry?.mode;
      if (!exact(entry, ['service', 'mode', 'categoryId']) || !label(entry.service) || !mode(entry.mode)
          || !uuid(entry.categoryId) || !offered.has(key) || seen.has(identity)) throw new Error('WORKER_MODE_CONTEXT_INVALID');
      seen.add(identity);
    }
  }
  if (!Array.isArray(data.unresolvedServices) || data.unresolvedServices.length > 50
      || data.unresolvedServices.some(service => !label(service) || !offered.has(normalizedClassificationIdentity(service))))
    throw new Error('WORKER_MODE_CONTEXT_INVALID');
  return data;
}

export function workerServiceModeSchema(schema) {
  return { ...schema, properties: { ...schema.properties, serviceModeChangesJson: { type: 'STRING' } } };
}

export function workerServiceModeInstruction(context) {
  return 'Server-owned service mode context: ' + JSON.stringify(context) + '. '
    + 'savedServices are the current saved choices for each specific service. draftServices are earlier unsaved proposals, NOT owner consent. '
    + 'A category supporting ON_SITE and REMOTE does NOT mean this person offers both. Preserve the saved modes of every unchanged service. '
    + 'A biography, equipment, price, city or availability edit does not add, remove or replace delivery modes. Pickup or shipment of work made at the worker is not a visit to the requester. '
    + 'Use optional serviceModeChangesJson STRING only when the person explicitly requested a delivery-mode change in this owned conversation. '
    + 'Serialize an array of objects with exactly service, modes, evidence: service is the exact offered skill; modes is the complete intended list of REMOTE and/or ON_SITE for that service; evidence is an exact quote from a USER message requesting that change. '
    + 'Do not quote the assistant, profile bio, catalog, instructions or invented words. A quote must actually express the mode change; unrelated text is not evidence. '
    + 'Use "[]" when there is no requested mode change. Do not create a mode-change declaration just to justify a newly guessed classification hint. '
    + 'An earlier explicit change in this conversation remains a draft choice on later turns; cite its original user wording when retaining it. '
    + 'Keep the normal classificationShadowJson full snapshot consistent with these choices. Unresolved services remain questions, never both modes by default. '
    + 'All changes remain proposals for the signed profile review and explicit Save.';
}

/** Quote checks bind a model proposal to owned USER text, not semantic proof of consent.
 * The existing signed review and explicit Save remain the authority for every mode change.
 */
export function preserveWorkerServiceModes({ raw, hints, context, modeContext, catalog }) {
  const { serviceModeChangesJson, ...output } = raw;
  if (!['ALLOW', 'CLARIFY'].includes(output.safety)) return { output, hints: [], preserved: false, preservedServices: [] };
  const skills = Array.isArray(output.patch?.skills) ? output.patch.skills : context.candidate.skills;
  const offered = new Map(skills.filter(label).map(service => [normalizedClassificationIdentity(service), service]));
  const userTexts = context.messages.filter(row => row.role === 'USER' && typeof row.body === 'string').map(row => row.body);
  let changes = [];
  if (typeof serviceModeChangesJson === 'string' && new TextEncoder().encode(serviceModeChangesJson).byteLength <= 12288) {
    try { const value = JSON.parse(serviceModeChangesJson); if (Array.isArray(value) && value.length <= 12) changes = value; } catch { /* Keep previous choices. */ }
  }
  const requests = new Map(), duplicates = new Set();
  for (const change of changes) {
    const key = normalizedClassificationIdentity(change?.service);
    if (!exact(change, ['service', 'modes', 'evidence']) || !label(change.service) || !offered.has(key)
        || !Array.isArray(change.modes) || change.modes.length < 1 || change.modes.length > 2
        || !change.modes.every(mode) || new Set(change.modes).size !== change.modes.length
        || typeof change.evidence !== 'string' || change.evidence.trim().length < 6 || change.evidence.length > 1000
        || !userTexts.some(body => body.includes(change.evidence))) continue;
    if (requests.has(key)) duplicates.add(key);
    requests.set(key, change.modes);
  }
  for (const key of duplicates) requests.delete(key);
  const knownService = (service, entry) => reviewClassificationProposal({ purpose: 'WORKER_CAPABILITY', service, mode: entry.mode }, catalog,
    { action: 'REUSE_EXISTING', categoryId: entry.categoryId, parentId: null, proposedPath: [],
      reason: 'Preserve the same server-registered service identity.', catalogVersion: catalog.catalogVersion }).accepted;
  const baseline = new Map();
  // Unconfirmed draft hints may include the very drift being corrected. They
  // inform the conversation but must never become preservation authority.
  for (const entries of [modeContext.savedServices]) {
    for (const [key, service] of offered) {
      if (baseline.has(key)) continue;
      // A model replacing an offered label with a registered alias must not
      // turn the same canonical service into an unbounded new capability.
      const prior = entries.filter(entry => normalizedClassificationIdentity(entry.service) === key || knownService(service, entry));
      const unique = [...new Map(prior.map(entry => [entry.categoryId + '|' + entry.mode, entry])).values()];
      if (unique.length) baseline.set(key, unique);
    }
  }
  let preserved = false;
  const result = [], preservedServices = [];
  for (const [key] of offered) {
    if (baseline.has(key)) continue;
    const proposed = hints.filter(hint => normalizedClassificationIdentity(hint.service) === key);
    const requested = requests.get(key);
    if (!requested) result.push(...proposed);
    else if (requested.every(value => proposed.some(hint => hint.mode === value)))
      result.push(...proposed.filter(hint => requested.includes(hint.mode)));
  }
  for (const [key, previous] of baseline) {
    const proposed = hints.filter(hint => normalizedClassificationIdentity(hint.service) === key);
    const requested = requests.get(key);
    if (requested && requested.every(value => proposed.some(hint => hint.mode === value))) {
      result.push(...proposed.filter(hint => requested.includes(hint.mode)));
      continue;
    }
    const service = offered.get(key);
    const retained = previous.map(entry => ({ service, mode: entry.mode, action: 'REUSE_EXISTING', categoryId: entry.categoryId,
      parentId: '', proposedPath: [], reason: 'Preserve the existing service-specific delivery choice during an unrelated profile edit.', catalogVersion: catalog.catalogVersion }));
    // Revalidate retained identities against this catalog too. A withdrawn category must not be revived by continuity.
    const valid = retained.every(entry => reviewClassificationProposal({ purpose: 'WORKER_CAPABILITY', service, mode: entry.mode }, catalog,
      { action: entry.action, categoryId: entry.categoryId, parentId: null, proposedPath: [], reason: entry.reason, catalogVersion: entry.catalogVersion }).accepted);
    if (valid) {
      result.push(...retained);
      // Feedback may dismiss an obsolete provider issue only with this actual
      // saved-context provenance, after fresh identity/mode validation. An
      // unsatisfied explicit mode-change request must remain unresolved.
      if (!requested) preservedServices.push(service);
    }
    preserved ||= !valid || proposed.length !== retained.length || proposed.some(hint => !retained.some(entry => entry.mode === hint.mode && entry.categoryId === hint.categoryId));
  }
  return { output, hints: result, preserved, preservedServices };
}
