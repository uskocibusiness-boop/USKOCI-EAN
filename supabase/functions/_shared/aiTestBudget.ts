// Shared V5 controlled-provider test budget. No retries or refunds after uncertain I/O.
export const AI_TEST_LIMITS = Object.freeze({
  // Per model call, not catalog capacity. Navigation avoids whole-tree prompts.
  // Text budget doubled after adding paged tool results; output remains bounded.
  llmRequestBytes: 262144,
  llmMaxOutputTokens: 8192,
  llmReservationMicrousd: 250000,
  speechPcmBytes: 3840000,
  speechMaxOutputTokens: 8192,
  speechReservationMicrousd: 200000,
  speechCaptureMs: 120000,
  speechFinalizationMs: 15000,
});

export type AiTestBudgetResult = {
  admitted: boolean;
  reservationId: string | null;
  replay: boolean;
  code: string;
};

export async function reserveAiTestBudget(input: {
  supabaseUrl: string; serviceRoleKey: string; accountId: string; operationId: string;
  kind: 'LLM' | 'STT'; signal?: AbortSignal;
}): Promise<AiTestBudgetResult> {
  const abort = new AbortController();
  const stop = () => abort.abort();
  const timeout = setTimeout(stop, 5000);
  input.signal?.addEventListener('abort', stop, { once: true });
  if (input.signal?.aborted) stop();
  const assertActive = () => {
    if (abort.signal.aborted) throw new Error('AI_TEST_BUDGET_UNAVAILABLE');
  };
  try {
    assertActive();
    const response = await fetch(input.supabaseUrl + '/rest/v1/rpc/rpc_ai_test_budget_reserve_service', {
      method: 'POST', redirect: 'error', signal: abort.signal,
      headers: { 'Content-Type': 'application/json', apikey: input.serviceRoleKey, Authorization: 'Bearer ' + input.serviceRoleKey },
      body: JSON.stringify({ p_account_id: input.accountId, p_operation_id: input.operationId, p_kind: input.kind,
        p_max_cost_microusd: input.kind === 'LLM' ? AI_TEST_LIMITS.llmReservationMicrousd : AI_TEST_LIMITS.speechReservationMicrousd }),
    });
    if (abort.signal.aborted || !response.ok || !response.body) { void response.body?.cancel(); throw new Error('AI_TEST_BUDGET_UNAVAILABLE'); }
    const reader = response.body.getReader();
    let content = '', length = 0;
    try {
      const decoder = new TextDecoder();
      while (true) {
        const part = await reader.read();
        assertActive();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > 4096) throw new Error('AI_TEST_BUDGET_UNAVAILABLE');
        content += decoder.decode(part.value, { stream: true });
      }
      content += decoder.decode();
    } finally { void reader.cancel().catch(() => undefined); }
    const result = JSON.parse(content);
    const codes = ['AI_TEST_RESERVED','AI_TEST_OPERATION_REPLAY','AI_TEST_BUDGET_NOT_READY','AI_TEST_ACCOUNT_NOT_ADMITTED','AI_TEST_BUDGET_EXHAUSTED'];
    if (!result || Object.keys(result).length !== 4 || typeof result.admitted !== 'boolean' || typeof result.replay !== 'boolean'
      || !codes.includes(result.code) || !(result.reservationId === null || /^[0-9a-f-]{36}$/i.test(result.reservationId))
      || (result.admitted && (result.replay || result.code !== 'AI_TEST_RESERVED' || !result.reservationId))) {
      throw new Error('AI_TEST_BUDGET_UNAVAILABLE');
    }
    assertActive();
    return result;
  } finally { clearTimeout(timeout); input.signal?.removeEventListener('abort', stop); stop(); }
}

/** A session that produced nothing spent nothing, so its worst-case hold goes back.
 *  The RPC itself refuses to release any operation that has recorded usage. */
export async function releaseUnusedAiTestReservation(input: {
  supabaseUrl: string; serviceRoleKey: string; operationId: string;
}): Promise<boolean> {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 5000);
  try {
    const response = await fetch(input.supabaseUrl + '/rest/v1/rpc/rpc_ai_test_release_unused_reservation_service', {
      method: 'POST', redirect: 'error', signal: abort.signal,
      headers: { 'Content-Type': 'application/json', apikey: input.serviceRoleKey, Authorization: 'Bearer ' + input.serviceRoleKey },
      body: JSON.stringify({ p_operation_id: input.operationId }),
    });
    if (!response.ok) { void response.body?.cancel(); return false; }
    const body = await response.json().catch(() => null);
    return !!body && body.released === true;
  } catch { return false; }
  finally { clearTimeout(timeout); }
}

/** A session that did transcribe settles against the audio it actually sent, priced at the
 *  published rate. The RPC refuses when provider usage exists, so reported usage always wins. */
export async function settleAiTestAudio(input: {
  supabaseUrl: string; serviceRoleKey: string; operationId: string; audioBytes: number; transcriptChars: number;
}): Promise<boolean> {
  if (!(input.audioBytes > 0)) return false;
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 5000);
  try {
    const response = await fetch(input.supabaseUrl + '/rest/v1/rpc/rpc_ai_test_settle_audio_service', {
      method: 'POST', redirect: 'error', signal: abort.signal,
      headers: { 'Content-Type': 'application/json', apikey: input.serviceRoleKey, Authorization: 'Bearer ' + input.serviceRoleKey },
      body: JSON.stringify({ p_operation_id: input.operationId, p_audio_bytes: input.audioBytes, p_transcript_chars: input.transcriptChars }),
    });
    if (!response.ok) { void response.body?.cancel(); return false; }
    const body = await response.json().catch(() => null);
    return !!body && body.settled === true;
  } catch { return false; }
  finally { clearTimeout(timeout); }
}
