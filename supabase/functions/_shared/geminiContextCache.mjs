// USKOCI explicit-cache compatibility seam. The current entry point is a no-op:
// it creates no provider cache and promises no latency or token-price reduction.
// Implicit provider cache hits must be measured from actual usage metadata.

import { interviewVoiceInstruction } from './interviewVoiceInstruction.mjs';
import { serviceExecutionInstruction } from './serviceExecutionInstruction.mjs';
import { craftQuestionMatrixText, craftFewShotExamplesText } from './craftQuestionMatrix.mjs';
import { formatFullCatalogHierarchy } from './backgroundTaxonomyArchitect.mjs';

/**
 * Builds the comprehensive cached knowledge document combining:
 * 1. Dispatch doctrine & communication rules (script mirroring, task/help terminology)
 * 2. Service execution scope (ON_SITE vs REMOTE)
 * 3. Craft question matrix (grouped inquiries for transport, painting, plumbing, etc.)
 * 4. Few-shot craft synthesis examples
 * 5. Complete compact taxonomy hierarchy with clean nodes, modes, and aliases
 */
export function buildUskociCachedKnowledge(catalog, purpose = 'NEED_SERVICE') {
  const parts = [
    '=== USKOCI CENTRALNI ZANATSKI MOZAK I DISPEČERSKA DOKTRINA ===',
    interviewVoiceInstruction(),
    '',
    '=== SMERNICE IZVRŠENJA USLUGA (ON_SITE / REMOTE) ===',
    serviceExecutionInstruction(purpose),
    '',
    craftQuestionMatrixText(),
    '',
    craftFewShotExamplesText(),
  ];

  if (catalog?.verifiedComplete && Array.isArray(catalog.categories)) {
    parts.push(
      '',
      `=== KOMPLETNO STABLO KATEGORIJA USKOCI (Verzija kataloga: ${catalog.catalogVersion}, ${catalog.categories.length} čvorova) ===`,
      'Stablo je hijerarhijski uvučeno: [categoryId LEAF MODES] naziv ~ narodni_sinonimi.',
      'Za potrebe klasifikacije koristite isključivo ove postojeće ID-jeve:',
      formatFullCatalogHierarchy(catalog)
    );
  }

  return parts.join('\n');
}

/**
 * Reserved compatibility entry point. Explicit provider caching is disabled;
 * callers receive null and keep their normal, fully supplied request context.
 *
 * @param {Object} options
 * @param {string} options.geminiApiKey
 * @param {number} options.catalogVersion
 * @param {Object} options.catalog
 * @param {string} options.model
 * @param {AbortSignal} [options.signal]
 * @param {string} [options.purpose]
 * @returns {Promise<null>} No explicit provider cache is created or reused.
 */
export async function getOrCreateGeminiContextCache(_options) {
  // This is a deliberate local policy, not a claim that the provider removed
  // cachedContents. Explicit caching requires its own cost admission, retention,
  // purpose/catalog identity and expiry proof before implementation.
  // https://ai.google.dev/gemini-api/docs/generate-content/caching
  return null;
}

/** Compatibility hook: the disabled implementation retains no cache handles. */
export function clearActiveGeminiCacheHandles() {
  // No provider or process-local cache exists to invalidate.
}
