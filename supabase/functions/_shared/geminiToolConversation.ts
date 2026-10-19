import { measureAiPhase } from './aiPhaseTiming.mjs';
import {
  GeminiCreditsUnavailableError, GeminiSafetyBlockedError,
  geminiFailureDiagnostic, geminiRequestBody, decodeGeminiUsage,
  type GeminiUsage,
} from './geminiTaskStream.ts';

type JsonObject = Record<string, unknown>;
export type GeminiReadOnlyTool = {
  declaration: JsonObject & { name: string };
  readOnly: true;
  /** Validate the complete domain argument contract here, before performing a read. */
  execute: (args: JsonObject, context: { signal: AbortSignal; callId?: string; round: number }) => Promise<JsonObject>;
};
export type GeminiToolLimits = {
  maxToolRounds: number;
  maxToolCalls: number;
  maxCallsPerRound: number;
  maxRequestBytes: number;
  maxResponseBytes: number;
  maxToolResultBytes: number;
  maxOutputTokens: number;
  maxTurnOutputTokens: number;
  timeoutMs: number;
  accountingTimeoutMs: number;
};
export type GeminiAttemptAdmission = {
  attempt: number; phase: 'TOOLS' | 'FINAL'; requestBytes: number;
  maxOutputTokens: number; signal: AbortSignal;
};
export type GeminiAttemptReceipt = { reservationId: string };
export type GeminiAttemptReport = Omit<GeminiAttemptAdmission, 'signal'> & GeminiAttemptReceipt & {
  dispatched: boolean; outcome: 'SUCCEEDED' | 'FAILED'; httpStatus: number | null;
  /** Null is unknown, never a measured zero. Counts include failed provider responses. */
  usage: GeminiUsage | null; cumulativeUsage: GeminiUsage;
  /** This attempt can be settled even when an earlier attempt still has an unknown hold. */
  attemptUsageComplete: boolean;
  /** Cumulative completeness across all dispatched attempts. */
  usageComplete: boolean;
  /** Raw breakdown; this transport's usage.outputTokens includes candidates AND thinking. */
  candidateTokens: number | null; thoughtTokens: number | null;
  /** Cached is a subset of prompt input, not additional usage. Missing stays unknown. */
  cachedPromptTokens: number | null; toolUsePromptTokens: number | null;
  errorCode: string | null;
};
export type GeminiToolConversationInput<T = string> = {
  url: string; key: string; body: string; signal?: AbortSignal;
  tools: readonly GeminiReadOnlyTool[];
  limits?: Partial<GeminiToolLimits>;
  /** Combined mode avoids a paid 'done' round. Split mode is explicit, never a retry fallback. */
  mode?: 'COMBINED' | 'SEPARATE';
  parseFinal?: (raw: string) => T;
  /** Try current supplied evidence without a tool round first. The caller verifies the
   * complete effective domain state; false permits research within this SAME budget.
   * Runs after accounting and under the turn deadline. Exceptions never trigger retry. */
  directFirst?: { accept: (raw: string) => Promise<boolean> };
  /** Durably reserve before EVERY attempt. Use deterministic operation ids so an admission
   * whose acknowledgement is lost at cancellation can be recovered without another charge. */
  beforeAttempt: (attempt: GeminiAttemptAdmission) => Promise<GeminiAttemptReceipt>;
  /** Must acknowledge accounting before another paid attempt. Never retried by this helper. */
  onAttempt: (report: GeminiAttemptReport) => Promise<void>;
};
export type GeminiToolConversationResult<T> = {
  value: T; raw: string; usage: GeminiUsage; usageComplete: boolean;
  accountingComplete: boolean; attempts: number; toolCalls: number;
};

const defaults: GeminiToolLimits = {
  maxToolRounds: 3, maxToolCalls: 24, maxCallsPerRound: 12,
  maxRequestBytes: 262144, maxResponseBytes: 524288, maxToolResultBytes: 65536,
  maxOutputTokens: 8192, maxTurnOutputTokens: 32768,
  timeoutMs: 35000, accountingTimeoutMs: 5000,
};
const object = (value: unknown): value is JsonObject => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000;
function fail(code: string): never { throw new Error(code); }
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;
const safeError = (error: unknown): string => error instanceof GeminiSafetyBlockedError ? 'GEMINI_SAFETY_BLOCKED'
  : error instanceof GeminiCreditsUnavailableError ? 'AI_CREDITS_UNAVAILABLE'
  : error instanceof Error && /^AI_TOOL_[A-Z_]+$/.test(error.message) ? error.message : 'AI_TOOL_UNAVAILABLE';
const addUsage = (sum: GeminiUsage, value: GeminiUsage) => {
  sum.promptTokens += value.promptTokens; sum.outputTokens += value.outputTokens; sum.totalTokens += value.totalTokens;
};

/** Manual generateContent loop: only allowlisted read callbacks; no SDK auto execution/retry.
 * Gemini 3 supports function calls OR the structured response in the same request:
 * https://ai.google.dev/gemini-api/docs/generate-content/function-calling#function-calling-with-structured-output
 * Full model content (including opaque thoughtSignature parts) is returned unchanged.
 * Domain JSON/schema validation and server-owned Save authority remain with the caller.
 */
export async function generateGeminiToolConversation<T = string>(input: GeminiToolConversationInput<T>): Promise<GeminiToolConversationResult<T>> {
  const limits = { ...defaults, ...input.limits };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < (key === 'maxToolRounds' || key === 'maxToolCalls' ? 0 : 1)) fail('AI_TOOL_INVALID_CONFIG');
  }
  if (typeof input.beforeAttempt !== 'function' || typeof input.onAttempt !== 'function') fail('AI_TOOL_INVALID_CONFIG');
  if (input.mode !== undefined && input.mode !== 'COMBINED' && input.mode !== 'SEPARATE') fail('AI_TOOL_INVALID_CONFIG');
  const toolMap = new Map<string, GeminiReadOnlyTool>();
  for (const tool of input.tools) {
    const name = tool?.declaration?.name;
    if (tool.readOnly !== true || typeof tool.execute !== 'function' || typeof name !== 'string'
      || !/^[a-zA-Z_][a-zA-Z0-9_.:-]{0,63}$/.test(name) || toolMap.has(name)) fail('AI_TOOL_INVALID_CONFIG');
    toolMap.set(name, tool);
  }
  if (input.directFirst !== undefined && (!object(input.directFirst)
    || typeof input.directFirst.accept !== 'function' || input.mode === 'SEPARATE' || toolMap.size === 0)) fail('AI_TOOL_INVALID_CONFIG');
  let base: JsonObject;
  try { base = JSON.parse(geminiRequestBody(input.body)); } catch { return fail('AI_TOOL_INVALID_CONFIG'); }
  if (!Array.isArray(base.contents) || !base.contents.length || !object(base.generationConfig)
    || base.generationConfig.responseMimeType !== 'application/json' || !object(base.generationConfig.responseSchema)) fail('AI_TOOL_INVALID_CONFIG');
  // Do not allow undeclared built-in/action tools to hitch a ride in the caller's body.
  delete base.tools; delete base.toolConfig;
  const contents = [...base.contents as unknown[]];
  const originalGeneration = base.generationConfig as JsonObject;
  if (originalGeneration.candidateCount !== undefined && originalGeneration.candidateCount !== 1) fail('AI_TOOL_INVALID_CONFIG');
  const configuredCap = originalGeneration.maxOutputTokens;
  if (configuredCap !== undefined && (!count(configuredCap) || configuredCap === 0)) fail('AI_TOOL_INVALID_CONFIG');
  const perCallCap = Math.min(limits.maxOutputTokens, typeof configuredCap === 'number' ? configuredCap : limits.maxOutputTokens);
  const controller = new AbortController();
  let rejectStopped: (error: Error) => void = () => {};
  const stopped = new Promise<never>((_resolve, reject) => { rejectStopped = reject; });
  void stopped.catch(() => undefined);
  const stop = () => { controller.abort(); rejectStopped(new Error('AI_TOOL_STOPPED')); };
  const check = () => { if (controller.signal.aborted) fail('AI_TOOL_STOPPED'); };
  const wait = <V>(operation: Promise<V>): Promise<V> => Promise.race([operation, stopped]);
  const timeout = setTimeout(stop, limits.timeoutMs);
  input.signal?.addEventListener('abort', stop, { once: true });
  if (input.signal?.aborted) stop();
  let attempts = 0, toolCalls = 0, rounds = 0, spentOutputTokens = 0;
  let usageComplete = true, accountingComplete = true;
  const usage: GeminiUsage = { promptTokens: 0, outputTokens: 0, totalTokens: 0 };
  const seenIds = new Set<string>();
  let forceFinal = toolMap.size === 0;

  const account = async (report: GeminiAttemptReport): Promise<void> => {
    // Settlement also runs after cancellation; the stopped IO promise must not skip it.
    let accountingTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([Promise.resolve().then(() => input.onAttempt(report)), new Promise<never>((_resolve, reject) => {
        accountingTimer = setTimeout(() => reject(new Error('AI_TOOL_ACCOUNTING_FAILED')), limits.accountingTimeoutMs);
      })]);
    } finally { clearTimeout(accountingTimer); }
  };

  const readBody = async (response: Response): Promise<unknown> => {
    const reader = response.body?.getReader();
    if (!reader) return fail('AI_TOOL_INVALID_RESPONSE');
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let raw = '', size = 0;
    try {
      while (true) {
        const chunk = await wait(reader.read()); check();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > limits.maxResponseBytes) fail('AI_TOOL_RESPONSE_TOO_LARGE');
        raw += decoder.decode(chunk.value, { stream: true });
      }
      try { return JSON.parse(raw + decoder.decode()); } catch { return fail('AI_TOOL_INVALID_RESPONSE'); }
    } finally { void reader.cancel().catch(() => undefined); }
  };

  try {
    // Each tool round requires a provider attempt; the last attempt is always final-only.
    while (attempts <= limits.maxToolRounds) {
      check();
      const directAttempt = input.directFirst !== undefined && attempts === 0;
      // The direct attempt consumes one of the original slots, not an extra paid call.
      const withTools = !directAttempt && !forceFinal && attempts < limits.maxToolRounds
        && rounds < limits.maxToolRounds && toolCalls < limits.maxToolCalls;
      const phase = withTools ? 'TOOLS' as const : 'FINAL' as const;
      const maxOutputTokens = Math.min(perCallCap, limits.maxTurnOutputTokens - spentOutputTokens);
      if (maxOutputTokens <= 0) fail('AI_TOOL_TOKEN_BUDGET');
      const generation: JsonObject = { ...originalGeneration, maxOutputTokens, candidateCount: 1 };
      if (withTools && input.mode === 'SEPARATE') {
        delete generation.responseMimeType; delete generation.responseSchema;
      }
      const request: JsonObject = { ...base, contents, generationConfig: generation };
      if (withTools) {
        request.tools = [{ functionDeclarations: [...toolMap.values()].map(tool => tool.declaration) }];
        request.toolConfig = { functionCallingConfig: { mode: input.mode === 'SEPARATE' ? 'AUTO' : 'VALIDATED' } };
      } else if (directAttempt) {
        const system = object(base.systemInstruction) ? base.systemInstruction : {};
        request.systemInstruction = { ...system, parts: [
          ...(Array.isArray(system.parts) ? system.parts : []),
          { text: 'First try to return the complete required JSON using the supplied CURRENT server evidence. '
            + 'No tools are offered in this first attempt. Keep useful user facts and partial answers; '
            + 'mark unresolved classification as NEEDS_REVIEW or ask for missing user information. '
            + 'Never invent category IDs, modes, consent, completed research or successful writes. '
            + 'The server will verify the result and may provide catalog tools if research is still needed.' },
        ] };
      } else if (toolMap.size > 0) {
        const system = object(base.systemInstruction) ? base.systemInstruction : {};
        request.systemInstruction = { ...system, parts: [
          ...(Array.isArray(system.parts) ? system.parts : []),
          { text: 'Catalog research for this turn is closed. Return only the required final JSON schema now. '
            + 'Keep useful user facts and partial answers. For unresolved classification use NEEDS_REVIEW; '
            + 'incomplete research is not evidence that a category is absent. Do not invent missing tool results, '
            + 'category IDs, successful writes or resolved identity. No further tool calls are available.' },
        ] };
      }
      const body = JSON.stringify(request), requestBytes = bytes(body);
      if (requestBytes > limits.maxRequestBytes) fail('AI_TOOL_REQUEST_TOO_LARGE');
      const admission: GeminiAttemptAdmission = { attempt: attempts + 1, phase, requestBytes, maxOutputTokens, signal: controller.signal };
      let knownReceipt: GeminiAttemptReceipt | undefined;
      try {
        await measureAiPhase('ADMISSION', () => wait(input.beforeAttempt(admission).then(value => { knownReceipt = value; })));
      } catch {
        // If the receipt is already known, cancellation must not leave a known undispatched
        // hold behind. An unresolved/lost acknowledgement remains the caller's durable recovery.
        if (object(knownReceipt) && typeof knownReceipt.reservationId === 'string' && knownReceipt.reservationId.trim()) {
          try { await account({ ...admission, reservationId: knownReceipt.reservationId, dispatched: false,
            outcome: 'FAILED', httpStatus: null, usage: null, cumulativeUsage: { ...usage }, usageComplete,
            attemptUsageComplete: false, candidateTokens: null, thoughtTokens: null,
            cachedPromptTokens: null, toolUsePromptTokens: null, errorCode: 'AI_TOOL_STOPPED' }); }
          catch { return fail('AI_TOOL_ACCOUNTING_FAILED'); }
        }
        if (controller.signal.aborted) return fail('AI_TOOL_STOPPED');
        return fail('AI_TOOL_ADMISSION_FAILED');
      }
      const receipt = knownReceipt;
      if (!object(receipt) || typeof receipt.reservationId !== 'string' || !receipt.reservationId.trim()) fail('AI_TOOL_ADMISSION_FAILED');
      let dispatched = false, outcome: 'SUCCEEDED' | 'FAILED' = 'FAILED', httpStatus: number | null = null;
      let currentUsage: GeminiUsage | null = null, currentCandidates: number | null = null, currentThoughts: number | null = null, errorCode: string | null = null;
      let currentCached: number | null = null, currentToolPrompt: number | null = null;
      let modelContent: JsonObject | undefined, calls: JsonObject[] = [], finalRaw: string | undefined, value: T | undefined;
      try {
        check(); dispatched = true; attempts++;
        const { response, payload } = await measureAiPhase('PROVIDER', async () => {
          const response = await wait(fetch(input.url, { method: 'POST', redirect: 'error', signal: controller.signal,
            headers: { 'x-goog-api-key': input.key, 'Content-Type': 'application/json', Accept: 'application/json' }, body }));
          httpStatus = response.status;
          let payload: unknown;
          try { payload = await readBody(response); } catch (error) { if (response.ok) throw error; }
          return { response, payload };
        });
        check();
        if (object(payload)) {
          const reported = decodeGeminiUsage(payload.usageMetadata);
          currentUsage = reported.usage;
          currentCandidates = reported.candidateTokens; currentThoughts = reported.thoughtTokens;
          currentCached = reported.cachedPromptTokens; currentToolPrompt = reported.toolUsePromptTokens;
        }
        if (!response.ok) {
          const diagnostic = geminiFailureDiagnostic(payload);
          console.error('GEMINI_TOOLS_HTTP_FAILED', response.status, diagnostic.status, diagnostic.reason, diagnostic.field);
          if (response.status === 402) throw new GeminiCreditsUnavailableError();
          fail('AI_TOOL_UNAVAILABLE');
        }
        if (!object(payload)) fail('AI_TOOL_INVALID_RESPONSE');
        const feedback = payload.promptFeedback;
        if (object(feedback) && feedback.blockReason) throw new GeminiSafetyBlockedError(feedback.blockReason);
        const candidates = payload.candidates;
        if (!Array.isArray(candidates) || candidates.length !== 1 || !object(candidates[0])) fail('AI_TOOL_INVALID_RESPONSE');
        const candidate = candidates[0];
        if (['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'RECITATION'].includes(String(candidate.finishReason))) throw new GeminiSafetyBlockedError(candidate.finishReason);
        if (candidate.finishReason !== 'STOP') fail('AI_TOOL_INCOMPLETE');
        if (Array.isArray(candidate.safetyRatings) && candidate.safetyRatings.some(rating => object(rating) && rating.blocked === true)) throw new GeminiSafetyBlockedError('SAFETY');
        const content = candidate.content;
        if (!object(content) || content.role !== 'model' || !Array.isArray(content.parts) || !content.parts.length) fail('AI_TOOL_INVALID_RESPONSE');
        modelContent = content;
        const texts: string[] = [];
        for (const part of content.parts) {
          if (!object(part)) fail('AI_TOOL_INVALID_RESPONSE');
          if (['inlineData', 'fileData', 'executableCode', 'codeExecutionResult', 'functionResponse'].some(key => key in part)) fail('AI_TOOL_INVALID_RESPONSE');
          if (object(part.functionCall)) calls.push(part.functionCall);
          else if (part.thought === true) continue;
          else if (typeof part.text === 'string') texts.push(part.text);
          else if (!part.thoughtSignature) fail('AI_TOOL_INVALID_RESPONSE');
        }
        if (calls.length) {
          if (!withTools) fail('AI_TOOL_UNEXPECTED_CALL');
          if (calls.length > limits.maxCallsPerRound || toolCalls + calls.length > limits.maxToolCalls) fail('AI_TOOL_CALL_BUDGET');
          // Validate the WHOLE batch before the first callback can read anything.
          const batchIds = new Set<string>();
          for (const call of calls) {
            if (typeof call.name !== 'string' || !toolMap.has(call.name) || !object(call.args)) fail('AI_TOOL_INVALID_CALL');
            if (call.id !== undefined) {
              if (typeof call.id !== 'string' || !call.id || call.id.length > 256 || seenIds.has(call.id) || batchIds.has(call.id)) fail('AI_TOOL_INVALID_CALL');
              batchIds.add(call.id);
            }
          }
        } else if (withTools && input.mode === 'SEPARATE') {
          // A plain research response cannot replace the final structured contract.
          forceFinal = true;
        } else {
          finalRaw = texts.join('');
          try { if (!object(JSON.parse(finalRaw))) fail('AI_TOOL_INVALID_FINAL'); } catch { fail('AI_TOOL_INVALID_FINAL'); }
          try { value = input.parseFinal ? input.parseFinal(finalRaw) : finalRaw as T; } catch { fail('AI_TOOL_INVALID_FINAL'); }
        }
        outcome = 'SUCCEEDED';
      } catch (error) {
        errorCode = controller.signal.aborted ? 'AI_TOOL_STOPPED' : safeError(error);
        if (error instanceof GeminiSafetyBlockedError || error instanceof GeminiCreditsUnavailableError) throw error;
        throw new Error(errorCode);
      } finally {
        if (dispatched) {
          if (currentUsage) addUsage(usage, currentUsage);
          if (!currentUsage) usageComplete = false;
          // Unknown usage reserves the whole allocation, never frees it as a measured zero.
          spentOutputTokens += currentUsage ? currentUsage.outputTokens : maxOutputTokens;
        }
        const report: GeminiAttemptReport = { ...admission, reservationId: receipt.reservationId, dispatched,
          outcome, httpStatus, usage: currentUsage, cumulativeUsage: { ...usage }, usageComplete,
          attemptUsageComplete: currentUsage !== null,
          candidateTokens: currentCandidates, thoughtTokens: currentThoughts,
          cachedPromptTokens: currentCached, toolUsePromptTokens: currentToolPrompt, errorCode };
        try {
          await measureAiPhase('ACCOUNTING', () => account(report));
        } catch {
          accountingComplete = false;
          // A valid final answer is deliverable, but accounting failure never admits another call.
          if (finalRaw === undefined) fail('AI_TOOL_ACCOUNTING_FAILED');
        }
      }
      if (spentOutputTokens > limits.maxTurnOutputTokens) fail('AI_TOOL_TOKEN_BUDGET');
      if (finalRaw !== undefined && directAttempt) {
        check();
        let accepted: boolean;
        try {
          accepted = await wait(Promise.resolve().then(() => input.directFirst!.accept(finalRaw!)));
          check();
          if (typeof accepted !== 'boolean') fail('AI_TOOL_DIRECT_CHECK_FAILED');
        } catch {
          return fail(controller.signal.aborted ? 'AI_TOOL_STOPPED' : 'AI_TOOL_DIRECT_CHECK_FAILED');
        }
        if (!accepted) {
          // Even though JSON was valid, it is not deliverable yet. In particular,
          // a failed accounting acknowledgement must never purchase this follow-up.
          if (!accountingComplete) fail('AI_TOOL_ACCOUNTING_FAILED');
          if (attempts > limits.maxToolRounds) fail('AI_TOOL_TURN_BUDGET');
          contents.push(modelContent, { role: 'user', parts: [{ text:
            'The preceding candidate is unverified and has not been applied or shown to the person. '
            + 'Use the available catalog tools to resolve the remaining classification against CURRENT evidence. '
            + 'Return the COMPLETE required JSON for the original user turn, preserving its useful facts, '
            + 'corrections and partial answers. Do not treat the candidate as user consent or invent missing results.' }] });
          continue;
        }
      }
      if (finalRaw !== undefined) return { value: value as T, raw: finalRaw, usage: { ...usage }, usageComplete, accountingComplete, attempts, toolCalls };
      if (calls.length) {
        // The model's calls in ONE response are independent. Validate the whole batch above,
        // then read concurrently under the same deadline; Promise.all preserves response order.
        for (const call of calls) {
          if (typeof call.id === 'string') seenIds.add(call.id);
        }
        toolCalls += calls.length;
        let results: JsonObject[];
        try {
          results = await measureAiPhase('CATALOG_TOOLS', () => wait(Promise.all(calls.map(async (call): Promise<JsonObject> => {
            check();
            const tool = toolMap.get(call.name as string)!;
            let result: JsonObject;
            try { result = await wait(tool.execute(call.args as JsonObject, { signal: controller.signal, callId: call.id as string | undefined, round: rounds + 1 })); }
            catch { return fail(controller.signal.aborted ? 'AI_TOOL_STOPPED' : 'AI_TOOL_READ_FAILED'); }
            let encoded: string;
            try { encoded = JSON.stringify(result); } catch { return fail('AI_TOOL_INVALID_RESULT'); }
            if (!object(result) || !encoded) fail('AI_TOOL_INVALID_RESULT');
            if (bytes(encoded) > limits.maxToolResultBytes) fail('AI_TOOL_RESULT_TOO_LARGE');
            return { functionResponse: { name: call.name, ...(call.id === undefined ? {} : { id: call.id }), response: JSON.parse(encoded) } };
          }))));
        } catch (error) {
          const code = controller.signal.aborted ? 'AI_TOOL_STOPPED' : safeError(error);
          stop(); // Cancel sibling reads after the first failure; no subsequent paid request.
          return fail(code);
        }
        contents.push(modelContent, { role: 'user', parts: results });
        rounds++;
      }
    }
    return fail('AI_TOOL_TURN_BUDGET');
  } finally {
    clearTimeout(timeout); input.signal?.removeEventListener('abort', stop); controller.abort();
  }
}
