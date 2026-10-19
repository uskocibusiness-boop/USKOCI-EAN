import { normalizedClassificationIdentity } from './classificationEngine.mjs';
import { decodeServiceHandoff } from './serviceHandoff.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const mode = value => value === 'ON_SITE' || value === 'REMOTE';
const identity = value => typeof value === 'string' ? normalizedClassificationIdentity(value) : null;
const own = (value, key) => Object.hasOwn(value, key);
const sameModes = (left, right) => left.size === right.size && [...left].every(value => right.has(value));
function sameHandoff(left, right) {
  const a = decodeServiceHandoff(left), b = decodeServiceHandoff(right);
  if (!a || !b || a.required !== b.required) return false;
  if (!a.required) return true;
  return own(a, 'shippingCountries') === own(b, 'shippingCountries') &&
    JSON.stringify(a.shippingCountries) === JSON.stringify(b.shippingCountries) &&
    own(a, 'localExchange') === own(b, 'localExchange') &&
    a.localExchange?.countryCode === b.localExchange?.countryCode &&
    a.localExchange?.city === b.localExchange?.city;
}

/** A routing decision, never classification/Save authority.
 * The caller first verifies the CURRENT model output against fresh global catalog
 * evidence, then applies its existing typed/intent guards. Preserve inspection
 * statuses/issues: replacing them with a synthetic success hides invalid output.
 * services are the EFFECTIVE post-guard draft. expectedServiceModes are effective
 * saved or current-draft choices after validated explicit changes, not consent.
 * This helper neither copies old hints nor derives modes from catalog support.
 */
export function canAcceptDirectClassification({ inspection, services, purpose, safety,
  expectedServiceModes = [], taskMode = null, taskHandoff } = {}) {
  if (!['WORKER_CAPABILITY', 'NEED_SERVICE'].includes(purpose)) return false;
  // A safety refusal must never spend another model call researching categories.
  if (safety === 'BLOCK' || safety === 'REVIEW') return true;
  if (!['ALLOW', 'CLARIFY'].includes(safety) || !Array.isArray(services) ||
      !object(inspection) || !Array.isArray(inspection.statuses) ||
      !Array.isArray(inspection.reviewProposals) || !Array.isArray(inspection.issues) ||
      !Array.isArray(inspection.invalidPlanCodes) || inspection.invalidPlanCodes.length ||
      !Array.isArray(expectedServiceModes)) return false;
  const names = services.map(identity);
  if (names.some(name => !name) || new Set(names).size !== names.length) return false;
  const offered = new Set(names), proposals = inspection.reviewProposals;
  // An honest empty draft needs a conversation, not a pointless catalog round.
  if (!offered.size) return proposals.length === 0 && inspection.statuses.length === 1 &&
    inspection.statuses[0] === 'EMPTY_CLASSIFICATION_SHADOW' &&
    inspection.issues.every(issue => issue?.code === 'EMPTY_CLASSIFICATION_SHADOW');
  if (purpose === 'NEED_SERVICE' && offered.size !== 1) return false;
  if (!inspection.statuses.length || inspection.statuses.some(status =>
    !['REUSE_CANDIDATE', 'MODE_UNCONFIRMED', 'ASK_CLARIFICATION'].includes(status))) return false;

  const questions = new Set();
  for (const issue of inspection.issues) {
    const key = identity(issue?.service);
    if (!object(issue) || !offered.has(key) || issue.resolution !== 'ASK_USER' ||
        !(issue.code === 'ASK_CLARIFICATION' && issue.action === 'ASK_CLARIFICATION' ||
          issue.code === 'MODE_UNCONFIRMED' && issue.mode === 'UNCONFIRMED')) return false;
    questions.add(key);
  }
  if (inspection.statuses.length !== proposals.length + inspection.issues.length) return false;

  const byService = new Map(), pairs = new Set();
  for (const proposal of proposals) {
    const key = identity(proposal?.service), pair = `${key}|${proposal?.mode}`;
    if (!object(proposal) || !offered.has(key) || proposal.action !== 'REUSE_EXISTING' ||
        !mode(proposal.mode) || typeof proposal.categoryId !== 'string' || !proposal.categoryId ||
        pairs.has(pair)) return false;
    if (proposal.mode === 'REMOTE' ? !decodeServiceHandoff(proposal.handoff) : own(proposal, 'handoff')) return false;
    pairs.add(pair);
    const entries = byService.get(key) ?? []; entries.push(proposal); byService.set(key, entries);
  }
  if ([...offered].some(key => !questions.has(key) && !byService.has(key))) return false;

  const expectedKeys = new Set();
  for (const expected of expectedServiceModes) {
    const key = identity(expected?.service);
    if (!object(expected) || !offered.has(key) || expectedKeys.has(key) ||
        !Array.isArray(expected.modes) || !expected.modes.length || !expected.modes.every(mode) ||
        new Set(expected.modes).size !== expected.modes.length ||
        own(expected, 'handoff') && (!expected.modes.includes('REMOTE') || !decodeServiceHandoff(expected.handoff))) return false;
    expectedKeys.add(key);
    // A real question may remain unresolved. It is never a successful mode update.
    if (questions.has(key)) continue;
    const actual = byService.get(key) ?? [];
    if (!sameModes(new Set(expected.modes), new Set(actual.map(item => item.mode)))) return false;
    if (expected.modes.includes('REMOTE')) {
      // Unknown prior handoff cannot silently become unrestricted/different.
      if (!own(expected, 'handoff') || !sameHandoff(expected.handoff, actual.find(item => item.mode === 'REMOTE')?.handoff)) return false;
    }
  }
  if (purpose === 'NEED_SERVICE' && proposals.length) {
    if (!mode(taskMode) || proposals.length !== 1 || proposals[0].mode !== taskMode) return false;
    if (taskMode === 'REMOTE' && !sameHandoff(taskHandoff, proposals[0].handoff)) return false;
  }
  return true;
}
