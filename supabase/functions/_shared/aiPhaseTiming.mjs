// Count-only latency evidence. No prompts, IDs, coordinates, provider bodies or errors.
// A telemetry failure must never change the operation's result or retry it.
const phases = new Set(['PROVIDER', 'CATALOG_TOOLS', 'ADMISSION', 'ACCOUNTING',
  'NEED_FULL_CATALOG', 'NEED_TAXONOMY_VALIDATE', 'WORKER_FULL_CATALOG', 'WORKER_TAXONOMY_VALIDATE',
  'NEED_CATALOG_START', 'NEED_CATALOG_VERIFY', 'NEED_BG_ARCHITECT', 'NEED_COMPLETE', 'NEED_HINT_CAPTURE',
  'WORKER_CATALOG_START', 'WORKER_CATALOG_VERIFY', 'WORKER_BG_ARCHITECT', 'WORKER_COMPLETE', 'WORKER_HINT_CAPTURE']);
/** @template T
 * @param {string} phase
 * @param {() => Promise<T>} operation
 * @returns {Promise<T>}
 */
export async function measureAiPhase(phase, operation) {
  const started = Date.now();
  let succeeded = false;
  try {
    const result = await operation();
    succeeded = true;
    return result;
  } finally {
    try { console.info('AI_PHASE_MS', phases.has(phase) ? phase : 'UNKNOWN',
      Math.max(0, Date.now() - started), succeeded ? 'SUCCEEDED' : 'FAILED'); }
    catch { /* Logging never changes delivery or accounting. */ }
  }
}


const usagePurposes = new Set(['NEED', 'WORKER']);
const usageSources = new Set(['SSE', 'GENERATE']);
const usageCount = value => Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000 ? value : null;

/**
 * Count-only provider usage evidence. Cached tokens are a subset of provider
 * prompt tokens; null means the provider did not report a trustworthy count.
 * Never attach request IDs, user text, prompts, coordinates or provider bodies.
 */
export function recordGeminiUsage(purpose, model, source, details) {
  const value = details && typeof details === 'object' ? details : {};
  const usage = value.usage && typeof value.usage === 'object' ? value.usage : {};
  const event = {
    version: 1,
    purpose: usagePurposes.has(purpose) ? purpose : 'UNKNOWN',
    model: typeof model === 'string' && /^[a-z0-9._-]{1,80}$/i.test(model) ? model : 'UNKNOWN',
    source: usageSources.has(source) ? source : 'UNKNOWN',
    promptTokens: usageCount(usage.promptTokens),
    outputTokens: usageCount(usage.outputTokens),
    totalTokens: usageCount(value.totalTokens ?? usage.totalTokens),
    providerPromptTokens: usageCount(value.promptTokens),
    candidateTokens: usageCount(value.candidateTokens),
    thoughtTokens: usageCount(value.thoughtTokens),
    toolUsePromptTokens: usageCount(value.toolUsePromptTokens),
    cachedPromptTokens: usageCount(value.cachedPromptTokens),
  };
  try { console.info('AI_USAGE_TOKENS', JSON.stringify(event)); }
  catch { /* Count-only telemetry must never affect delivery or accounting. */ }
}

/** Records time to the first non-empty assistant text without logging or forwarding the text itself. */
export function createAiFirstTextRecorder(purpose, startedAtMs = Date.now()) {
  const start = Number.isFinite(startedAtMs) ? startedAtMs : Date.now();
  let recorded = false;
  return (delta) => {
    if (recorded || typeof delta !== 'string' || !delta.trim()) return;
    recorded = true;
    try { console.info('AI_FIRST_TEXT_MS', purpose, Math.max(0, Math.round(Date.now() - start))); }
    catch { /* Telemetry must never affect the AI turn. */ }
  };
}
