// Shared privacy assertion for exact-source Edge harnesses; arbitrary objects
// must not become permissible operator logs when count-only metrics are added.
export function isProviderUsageLog(args) {
  if (args.length !== 2 || args[0] !== 'AI_PROVIDER_USAGE' || !args[1] || typeof args[1] !== 'object' || Array.isArray(args[1])) return false;
  const value = args[1], counts = ['attempt', 'requestBytes', 'promptTokens', 'outputTokens',
    'candidateTokens', 'thoughtTokens', 'cachedPromptTokens', 'toolUsePromptTokens'];
  const keys = [...counts, 'phase', 'model', 'outcome', 'usageComplete', 'cumulativeUsageComplete'];
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
    && counts.every(key => value[key] === null || (Number.isSafeInteger(value[key]) && value[key] >= 0))
    && ['TOOLS', 'FINAL', 'UNKNOWN'].includes(value.phase)
    && ['gemini-3.8-flash', 'UNKNOWN'].includes(value.model)
    && ['SUCCEEDED', 'FAILED', 'UNKNOWN'].includes(value.outcome)
    && typeof value.usageComplete === 'boolean' && typeof value.cumulativeUsageComplete === 'boolean';
}
