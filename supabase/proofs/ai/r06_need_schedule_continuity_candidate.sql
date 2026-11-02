-- LOCAL_ONLY: native-reproduced scheduling continuation. NOT a DEV migration.
BEGIN;
DO $guard$ BEGIN
 IF current_setting('uskoci.r06_continuity.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
 OR current_user<>'postgres' OR current_database()<>'postgres'
 OR to_regrole('cli_login_postgres') IS NOT NULL THEN
  RAISE EXCEPTION 'LOCAL_ONLY_DISPOSABLE_REQUIRED';END IF;
 IF md5(pg_get_functiondef('public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)'::regprocedure))<>'ff2be465f91497787558d9d1a5cecdba' THEN RAISE EXCEPTION 'CONTINUITY_PREIMAGE_DRIFT';END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.rpc_ai_complete_need_turn_v2_service(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid, p_user_message text, p_assistant_message text, p_safety text, p_proposals jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare c public.ai_conversations;t private.ai_need_turn_commands;raw jsonb;receipt_value jsonb;hash_value text;now_at timestamptz;
 continuity_source jsonb;continuity_prior jsonb;continuity_after jsonb;
 continuity_hint private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE;
begin
 if p_account_id is null or p_conversation_id is null or p_client_request_id is null or p_attempt_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22023';end if;
 perform private.closure_assert_open(p_account_id);
 perform pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for update;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 select * into t from private.ai_need_turn_commands where account_id=p_account_id and client_request_id=p_client_request_id for update;
 hash_value:=encode(extensions.digest(convert_to(jsonb_build_object('conversationId',c.id,'text',btrim(p_user_message))::text,'UTF8'),'sha256'),'hex');
 if not found or t.conversation_id<>c.id or t.request_hash<>hash_value then raise exception 'AI_REQUEST_ID_REUSED' using errcode='22023';end if;
 if t.state='SUCCEEDED' then return private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);end if;
 if t.state<>'PROCESSING' or t.attempt_id<>p_attempt_id or not t.provider_dispatched or t.cancelled_at is not null then return private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);end if;
 now_at:=clock_timestamp();
 if c.status<>'OPEN' or t.lease_expires_at<=now_at or t.context_hash is distinct from (private.ai_need_turn_context(c.id)->>'sha256') then
  update private.ai_need_turn_commands set state='FAILED',updated_at=now_at where account_id=p_account_id and client_request_id=p_client_request_id;
  return private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);
 end if;

 -- Carry only a successful existing classification across a scheduling-only turn.
 -- This is a fresh non-authoritative capture, never mutation of an old receipt.
 IF p_safety IN ('ALLOW','CLARIFY') AND jsonb_typeof(p_proposals)='array'
    AND jsonb_array_length(p_proposals)>0 AND NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(p_proposals) p
      WHERE p->>'key' IS NULL OR p->>'key' NOT IN
        ('need.starts_at','need.ends_at','need.schedule_kind','need.response_deadline')) THEN
   BEGIN
     continuity_source:=private.ai_task_review_source(c.id);
   EXCEPTION WHEN SQLSTATE '55000' THEN
     -- Media not ready: preserve the existing completion; do not reuse a hint.
     continuity_source:=NULL;
   END;
   IF continuity_source IS NOT NULL THEN
     -- The new claim is part of the complete source. Reconstruct the exact
     -- previous capture source by removing only this owned incoming turn.
     continuity_prior:=jsonb_set(continuity_source,'{turns}',coalesce((
       SELECT jsonb_agg(x ORDER BY x->>'id')
       FROM jsonb_array_elements(continuity_source->'turns') x
       WHERE x->>'id' IS DISTINCT FROM t.turn_id::text),'[]'::jsonb));
     SELECT h.* INTO continuity_hint FROM private.work_taxonomy_gemini_turn_hints_v1 h
     WHERE h.purpose='NEED_SERVICE' AND h.account_id=p_account_id AND h.conversation_id=c.id
       AND h.source_fingerprint=encode(extensions.digest(continuity_prior::text,'sha256'),'hex')
       AND h.catalog_version=(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)
     ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
   END IF;
 END IF;

 -- Existing V2 writer owns proposal validation, supersession, provenance and messages.
 raw:=public.rpc_ai_apply_interview_turn_v2_service(p_account_id,c.id,p_user_message,p_assistant_message,p_safety,p_proposals);
 receipt_value:=jsonb_build_object('userMessageId',raw->'userMessageId','assistantMessageId',raw->'assistantMessageId',
  'proposedCount',raw->'proposedCount','safety',raw->'safety','schemaVersion',raw->'schemaVersion','authoritative',raw->'authoritative');
 if raw->>'conversationId' is distinct from c.id::text or raw->>'schemaVersion' is distinct from 'NEED_FACT_V2'
  or raw->'authoritative' is distinct from 'true'::jsonb or raw->>'userMessageId' is null or raw->>'assistantMessageId' is null
  or (raw->>'proposedCount')::integer not between 0 and 12
 then raise exception 'AI_TURN_RECEIPT_INVALID' using errcode='P0001';end if;
 update private.ai_need_turn_commands set state='SUCCEEDED',receipt=receipt_value,updated_at=clock_timestamp()
 where account_id=p_account_id and client_request_id=p_client_request_id;

 IF continuity_hint.id IS NOT NULL AND raw->>'safety' IN ('ALLOW','CLARIFY') THEN
   continuity_after:=private.ai_task_review_source(c.id);
   -- Recheck all non-scheduling fact rows and media/Need/conversation state.
   -- No name, category, mode, handoff, description or ownership relaxation.
   IF (continuity_after-'facts'-'messages'-'turns')=(continuity_source-'facts'-'messages'-'turns')
     AND coalesce((SELECT jsonb_agg(x ORDER BY x->>'fact_key',x->>'id')
       FROM jsonb_array_elements(continuity_after->'facts') x
       WHERE x->>'fact_key' NOT IN ('need.starts_at','need.ends_at','need.schedule_kind','need.response_deadline')),'[]'::jsonb)
       =coalesce((SELECT jsonb_agg(x ORDER BY x->>'fact_key',x->>'id')
       FROM jsonb_array_elements(continuity_source->'facts') x
       WHERE x->>'fact_key' NOT IN ('need.starts_at','need.ends_at','need.schedule_kind','need.response_deadline')),'[]'::jsonb)
     AND continuity_hint.catalog_version=(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton) THEN
     PERFORM public.rpc_taxonomy_capture_gemini_turn_hints_service(p_account_id,c.id,p_client_request_id,
       t.turn_id,p_attempt_id,'NEED_SERVICE',continuity_hint.catalog_version,continuity_hint.proposals);
   END IF;
 END IF;

 return private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);
end $function$;

COMMIT;
