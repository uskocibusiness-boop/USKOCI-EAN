// A logical conversation turn can include several READ-ONLY model/tool rounds.
// Every paid request has its own durable reservation and immutable usage row.
import { reserveAiTestBudget } from './aiTestBudget.ts';
import type { GeminiAttemptAdmission, GeminiAttemptReport } from './geminiToolConversation.ts';

export async function taxonomyRoundOperationId(accountId: string, conversationId: string, operationId: string, attempt: number): Promise<string> {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 4) throw new Error('AI_TOOL_ATTEMPT_INVALID');
  if (attempt === 1) return operationId;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(
    ['USKOCI_TAXONOMY_PROVIDER_ROUND_V1',accountId,conversationId,operationId,String(attempt)].join('|'))));
  // Application-defined, deterministic UUIDv8; never masquerades as UUIDv5/SHA1.
  digest[6] = (digest[6] & 15) | 128; digest[8] = (digest[8] & 63) | 128;
  const h = Array.from(digest.slice(0,16), v => v.toString(16).padStart(2,'0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

export function createTaxonomyProviderBudget(input: {
  supabaseUrl: string; serviceRoleKey: string; accountId: string; conversationId: string;
  operationId: string; firstReservationId: string; model: string;
}) {
  let nextAttempt = 1;
  const attempts = new Map<number,{operationId:string;reservationId:string;settled:boolean}>();
  return {
    async beforeAttempt(event: GeminiAttemptAdmission) {
      if (event.attempt !== nextAttempt || event.attempt > 4) throw new Error('AI_TOOL_ATTEMPT_INVALID');
      const operationId = await taxonomyRoundOperationId(input.accountId,input.conversationId,input.operationId,event.attempt);
      let reservationId = input.firstReservationId;
      if (event.attempt > 1) {
        const reservation = await reserveAiTestBudget({supabaseUrl:input.supabaseUrl,serviceRoleKey:input.serviceRoleKey,
          accountId:input.accountId,operationId,kind:'LLM',signal:event.signal});
        if (!reservation.admitted || reservation.replay || !reservation.reservationId) throw new Error('AI_TOOL_BUDGET_UNAVAILABLE');
        reservationId = reservation.reservationId;
      }
      if (!reservationId) throw new Error('AI_TOOL_BUDGET_UNAVAILABLE');
      attempts.set(event.attempt,{operationId,reservationId,settled:false}); nextAttempt++;
      return {reservationId};
    },
    async onAttempt(event: GeminiAttemptReport) {
      const admitted = attempts.get(event.attempt);
      if (!admitted || admitted.reservationId !== event.reservationId || admitted.settled) throw new Error('AI_TOOL_USAGE_CONFLICT');
      admitted.settled = true;
      // Count-only observability. Never log the event itself: it also contains a
      // reservation identity. Cached input is a subset, not a second billed count.
      const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
      try {
        console.info('AI_PROVIDER_USAGE', {
          attempt: count(event.attempt), phase: event.phase === 'TOOLS' || event.phase === 'FINAL' ? event.phase : 'UNKNOWN',
          requestBytes: count(event.requestBytes), model: input.model === 'gemini-3.8-flash' ? input.model : 'UNKNOWN',
          outcome: event.outcome === 'SUCCEEDED' || event.outcome === 'FAILED' ? event.outcome : 'UNKNOWN',
          promptTokens: count(event.usage?.promptTokens), outputTokens: count(event.usage?.outputTokens),
          candidateTokens: count(event.candidateTokens), thoughtTokens: count(event.thoughtTokens),
          cachedPromptTokens: count(event.cachedPromptTokens), toolUsePromptTokens: count(event.toolUsePromptTokens),
          usageComplete: event.attemptUsageComplete === true, cumulativeUsageComplete: event.usageComplete === true,
        });
      } catch { /* Observability cannot prevent usage settlement or answer delivery. */ }
      // Unknown outcomes retain the whole reservation. Missing usage is never 0.
      if (!event.usage || !event.attemptUsageComplete) return;
      const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 3000);
      try {
        const response = await fetch(input.supabaseUrl + '/rest/v1/rpc/rpc_ai_test_record_usage_service', {
          method:'POST',redirect:'error',signal:abort.signal,
          headers:{apikey:input.serviceRoleKey,Authorization:'Bearer '+input.serviceRoleKey,'Content-Type':'application/json'},
          body:JSON.stringify({p_operation_id:admitted.operationId,p_model:input.model,
            p_prompt_tokens:event.usage.promptTokens,p_output_tokens:event.usage.outputTokens,p_total_tokens:event.usage.totalTokens}),
        });
        if (!response.ok || response.redirected || !response.body) { void response.body?.cancel(); throw new Error('AI_TOOL_USAGE_UNAVAILABLE'); }
        const reader=response.body.getReader(); let raw='',size=0; const decoder=new TextDecoder();
        try { for (;;) { const part=await reader.read(); if(part.done)break;
          size+=part.value.byteLength;if(size>4096)throw new Error('AI_TOOL_USAGE_INVALID');raw+=decoder.decode(part.value,{stream:true}); }
          raw+=decoder.decode();
        } finally { void reader.cancel().catch(()=>undefined); }
        const receipt=JSON.parse(raw);
        if (receipt?.operationId!==admitted.operationId || typeof receipt.recorded!=='boolean' || receipt.authoritative!==true ||
          receipt.promptTokens!==event.usage.promptTokens || receipt.outputTokens!==event.usage.outputTokens || receipt.totalTokens!==event.usage.totalTokens)
          throw new Error('AI_TOOL_USAGE_INVALID');
      } finally { clearTimeout(timer); abort.abort(); }
    },
  };
}
