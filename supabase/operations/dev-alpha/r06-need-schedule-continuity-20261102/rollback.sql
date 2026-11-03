BEGIN;SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='25s';
DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006' THEN RAISE EXCEPTION 'R06_CONTINUITY_CONTEXT_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)') AND md5(pg_get_functiondef(p.oid))='b9035b200c368e09ab984107dd6f92e8' AND to_jsonb(p)-'prosrc'='{"oid":"22494","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_ai_complete_need_turn_v2_service","prorows":0,"pronargs":8,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_account_id","p_conversation_id","p_client_request_id","p_attempt_id","p_user_message","p_assistant_message","p_safety","p_proposals"],"proargtypes":["2950","2950","2950","2950","25","25","25","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb) THEN RAISE EXCEPTION 'R06_CONTINUITY_FUNCTION_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.ai_task_review_source(uuid)'))) IS DISTINCT FROM '26a2977f90d790d6746df0c7dcfc7635' THEN RAISE EXCEPTION 'R06_CONTINUITY_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.ai_task_review_source_before_media(uuid)'))) IS DISTINCT FROM 'd6ba809f15d478eb52a7ed288a99760a' THEN RAISE EXCEPTION 'R06_CONTINUITY_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.closure_erasure_program_digest_v5()'))) IS DISTINCT FROM 'e11cc0b1eb33e63d182247424e4027bd' THEN RAISE EXCEPTION 'R06_CONTINUITY_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.closure_schema_digest_v5_139()'))) IS DISTINCT FROM '5165a1c4787401db76b0a5cc894731e0' THEN RAISE EXCEPTION 'R06_CONTINUITY_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.closure_source_digest_v5()'))) IS DISTINCT FROM '3754d150d83b916422e184a50e5bd126' THEN RAISE EXCEPTION 'R06_CONTINUITY_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)'))) IS DISTINCT FROM 'c363facdb26d33ae872e25e6a79e4306' THEN RAISE EXCEPTION 'R06_CONTINUITY_DEPENDENCY_DRIFT';END IF;
 IF jsonb_build_object('source',private.closure_source_digest_v5(),'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),'source_ready',private.retention_ai_source_ready(),'export_binding',private.data_export_policy_binding(),'erasure_binding',private.closure_erasure_binding_v5()) IS DISTINCT FROM '{"schema":"5f864f673b792681532c6a4c4e16de1fd9682e6094faca516d749ee0d1c90a14","source":"0801d13b1b112c288143c396ecc44c3dac3b9e405ca5d6f2cd1a1b7ddef45021","erasure":"0935fabefce8549bb2d42dcb3be7cf8c3796ceb5108e87b569f678b09670568b","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb THEN RAISE EXCEPTION 'R06_CONTINUITY_CLOSURE_DRIFT';END IF;
 END; $guard$;
CREATE TEMP TABLE r06_continuity_functions ON COMMIT DROP AS SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private','rls_private');
CREATE OR REPLACE FUNCTION public.rpc_ai_complete_need_turn_v2_service(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid, p_user_message text, p_assistant_message text, p_safety text, p_proposals jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare c public.ai_conversations;t private.ai_need_turn_commands;raw jsonb;receipt_value jsonb;hash_value text;now_at timestamptz;
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
 return private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);
end $function$;
DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006' THEN RAISE EXCEPTION 'R06_CONTINUITY_CONTEXT_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)') AND md5(pg_get_functiondef(p.oid))='ff2be465f91497787558d9d1a5cecdba' AND to_jsonb(p)-'prosrc'='{"oid":"22494","proacl":["postgres=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_ai_complete_need_turn_v2_service","prorows":0,"pronargs":8,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_account_id","p_conversation_id","p_client_request_id","p_attempt_id","p_user_message","p_assistant_message","p_safety","p_proposals"],"proargtypes":["2950","2950","2950","2950","25","25","25","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb) THEN RAISE EXCEPTION 'R06_CONTINUITY_FUNCTION_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.ai_task_review_source(uuid)'))) IS DISTINCT FROM '26a2977f90d790d6746df0c7dcfc7635' THEN RAISE EXCEPTION 'R06_CONTINUITY_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.ai_task_review_source_before_media(uuid)'))) IS DISTINCT FROM 'd6ba809f15d478eb52a7ed288a99760a' THEN RAISE EXCEPTION 'R06_CONTINUITY_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.closure_erasure_program_digest_v5()'))) IS DISTINCT FROM 'e11cc0b1eb33e63d182247424e4027bd' THEN RAISE EXCEPTION 'R06_CONTINUITY_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.closure_schema_digest_v5_139()'))) IS DISTINCT FROM '5165a1c4787401db76b0a5cc894731e0' THEN RAISE EXCEPTION 'R06_CONTINUITY_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.closure_source_digest_v5()'))) IS DISTINCT FROM '3754d150d83b916422e184a50e5bd126' THEN RAISE EXCEPTION 'R06_CONTINUITY_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)'))) IS DISTINCT FROM 'c363facdb26d33ae872e25e6a79e4306' THEN RAISE EXCEPTION 'R06_CONTINUITY_DEPENDENCY_DRIFT';END IF;
 IF jsonb_build_object('source',private.closure_source_digest_v5(),'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),'source_ready',private.retention_ai_source_ready(),'export_binding',private.data_export_policy_binding(),'erasure_binding',private.closure_erasure_binding_v5()) IS DISTINCT FROM '{"schema":"5f864f673b792681532c6a4c4e16de1fd9682e6094faca516d749ee0d1c90a14","source":"0801d13b1b112c288143c396ecc44c3dac3b9e405ca5d6f2cd1a1b7ddef45021","erasure":"0935fabefce8549bb2d42dcb3be7cf8c3796ceb5108e87b569f678b09670568b","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb THEN RAISE EXCEPTION 'R06_CONTINUITY_CLOSURE_DRIFT';END IF;
 END; $guard$;
DO $delta$ BEGIN IF EXISTS(SELECT 1 FROM r06_continuity_functions b FULL JOIN (SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private','rls_private')) a USING(oid) WHERE b.oid IS NULL OR a.oid IS NULL OR CASE WHEN b.oid=to_regprocedure('public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)') THEN b.attributes-'prosrc' IS DISTINCT FROM a.attributes-'prosrc' ELSE b.attributes IS DISTINCT FROM a.attributes END) THEN RAISE EXCEPTION 'R06_CONTINUITY_UNRELATED_DELTA';END IF;END; $delta$;
COMMIT;
