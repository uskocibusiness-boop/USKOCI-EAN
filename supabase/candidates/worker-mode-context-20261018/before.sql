CREATE OR REPLACE FUNCTION public.rpc_read_worker_ai_context_service(p_account_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare doc jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=p_account_id)
 then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 doc:=private.worker_ai_document(p_conversation_id);
 if doc is null or doc->>'status'<>'OPEN' or doc->>'safety' in ('BLOCK','REVIEW') or doc->'stale'='true'::jsonb then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 -- Keep owned history intact. Only the exact USER message attached by a new
 -- claim and subsequently cancelled before dispatch is excluded from provider
 -- context. Legacy rows have no fabricated timestamp-based association.
 return jsonb_set(doc-array['review','saved'],'{messages}',coalesce((
  select jsonb_agg(m.value order by m.ordinality) from jsonb_array_elements(doc->'messages') with ordinality m(value,ordinality)
  where not exists(select 1 from private.worker_ai_turns t where t.account_id=p_account_id and t.conversation_id=p_conversation_id
   and t.cancelled_at is not null and t.user_message_id=(m.value->>'id')::uuid)), '[]'::jsonb));
end $function$
;

REVOKE ALL ON FUNCTION public.rpc_read_worker_ai_context_service(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_read_worker_ai_context_service(uuid,uuid) TO service_role;
