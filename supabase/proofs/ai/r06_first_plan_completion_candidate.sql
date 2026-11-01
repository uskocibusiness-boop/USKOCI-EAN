-- R06 atomic completion + enrollment, LOCAL_ONLY integration of the existing queue.
-- Existing completion writers keep their ABI and remain the only fact writers.
-- This does not start a provider, schedule a worker or admit a DEV deployment.
BEGIN;
DO $admission$
DECLARE spec record;
BEGIN
 IF current_setting('uskoci.r06_first_plan.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
 OR current_user<>'postgres' OR current_database()<>'postgres'
 OR to_regrole('cli_login_postgres') IS NOT NULL THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_LOCAL_ONLY' USING errcode='55000'; END IF;
 IF to_regclass('private.work_taxonomy_first_plan_jobs_v1') IS NULL THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_QUEUE_REQUIRED' USING errcode='55000'; END IF;
 -- Normalized CRLF only; actual read-only DEV capture 2026-11-01. No body/ACL waiver.
 FOR spec IN SELECT * FROM (VALUES
 ('public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)','ff2be465f91497787558d9d1a5cecdba'),
 ('public.rpc_ai_complete_need_location_turn_v1_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text)','10d26307c5a7ef4c16940fa8e54d4d64'),
 ('public.rpc_complete_worker_ai_turn_service(uuid,uuid,uuid,uuid,jsonb)','5f0b6545dcde28bf2fcb4ea0f0393458')) AS expected(signature,body_md5)
 LOOP
  IF md5(replace(pg_get_functiondef(to_regprocedure(spec.signature)),chr(13),'')) IS DISTINCT FROM spec.body_md5 THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_OWNER_DRIFT' USING errcode='55000'; END IF;
 END LOOP;
END; $admission$;

CREATE FUNCTION private.taxonomy_first_plan_complete_receipt_v1(
 p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid,
 p_purpose text,p_safety text,p_turn jsonb,p_targets jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'pg_catalog' AS $fn$
DECLARE j private.work_taxonomy_first_plan_jobs_v1%ROWTYPE;enrolled jsonb;
 v_turn_id uuid;v_category jsonb;v_geography jsonb;v_handoff jsonb;v_mode text;v_count integer;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 IF p_purpose IS NULL OR p_purpose NOT IN('NEED_SERVICE','WORKER_CAPABILITY')
 OR jsonb_typeof(p_targets) IS DISTINCT FROM 'array' OR pg_column_size(p_targets)>18000 THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 IF p_turn->>'conversationId' IS DISTINCT FROM p_conversation_id::text
 OR p_turn->>'clientRequestId' IS DISTINCT FROM p_client_request_id::text THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 IF p_turn->>'state' IS DISTINCT FROM 'SUCCEEDED' THEN
  RETURN jsonb_build_object('state','NOT_ELIGIBLE','authority','NONE'); END IF;
 v_turn_id:=(p_turn->>'turnId')::uuid;
 IF v_turn_id IS NULL THEN RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID'; END IF;
 IF p_purpose='NEED_SERVICE' AND p_turn#>>'{receipt,safety}' IS DISTINCT FROM p_safety THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 -- A replay reads the historical job; it cannot replace targets or turn an old
 -- result into current classification authority. Claim still verifies the source.
 SELECT * INTO j FROM private.work_taxonomy_first_plan_jobs_v1
 WHERE account_id=p_account_id AND purpose=p_purpose AND turn_id=v_turn_id;
 IF FOUND THEN
  IF j.conversation_id IS DISTINCT FROM p_conversation_id
  OR j.client_request_id IS DISTINCT FROM p_client_request_id
  OR j.attempt_id IS DISTINCT FROM p_attempt_id OR j.targets IS DISTINCT FROM p_targets THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_CONFLICT' USING errcode='22023'; END IF;
  RETURN public.rpc_taxonomy_first_plan_receipt_service(j.id);
 END IF;
 IF p_safety IS NULL OR p_safety NOT IN('ALLOW','CLARIFY') THEN
  RETURN jsonb_build_object('state','NOT_ELIGIBLE','authority','NONE'); END IF;
 IF jsonb_array_length(p_targets)=0 THEN
  RETURN jsonb_build_object('state','NOT_REQUIRED','authority','NONE'); END IF;
 IF (SELECT enabled FROM private.work_taxonomy_first_plan_control_v1 WHERE singleton) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_DISABLED' USING errcode='55000'; END IF;
 IF p_purpose='NEED_SERVICE' THEN
  -- The task target must be the completed, active typed facts, never an unrelated
  -- caller-supplied service. Unknown geography is not evidence of ON_SITE.
  SELECT count(*) INTO v_count FROM public.ai_structured_facts
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
    AND superseded_at IS NULL AND status<>'UNKNOWN' AND fact_key='need.category';
  IF v_count<>1 OR jsonb_array_length(p_targets)<>1 THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_NEED_TARGET_MISMATCH' USING errcode='22023'; END IF;
  SELECT fact_value INTO v_category FROM public.ai_structured_facts
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
    AND superseded_at IS NULL AND status<>'UNKNOWN' AND fact_key='need.category';
  SELECT fact_value INTO v_geography FROM public.ai_structured_facts
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
    AND superseded_at IS NULL AND status<>'UNKNOWN' AND fact_key='need.task_geography';
  SELECT fact_value INTO v_handoff FROM public.ai_structured_facts
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
    AND superseded_at IS NULL AND status<>'UNKNOWN' AND fact_key='need.handoff';
  v_mode:=CASE WHEN v_geography->>'mode'='REMOTE' THEN 'REMOTE'
   WHEN v_geography->>'mode' IN('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED') THEN 'ON_SITE' END;
  IF jsonb_typeof(v_category) IS DISTINCT FROM 'string' OR v_mode IS NULL
  OR private.taxonomy_normalize_v1(p_targets#>>'{0,service}') IS DISTINCT FROM private.taxonomy_normalize_v1(v_category#>>'{}')
  OR p_targets#>>'{0,mode}' IS DISTINCT FROM v_mode
  OR coalesce(p_targets#>'{0,handoff}','null'::jsonb) IS DISTINCT FROM
     coalesce(CASE WHEN v_mode='REMOTE' THEN v_handoff END,'null'::jsonb) THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_NEED_TARGET_MISMATCH' USING errcode='22023'; END IF;
 END IF;
 enrolled:=public.rpc_taxonomy_first_plan_enqueue_service(p_account_id,p_conversation_id,
  p_client_request_id,v_turn_id,p_attempt_id,p_purpose,p_targets);
 RETURN public.rpc_taxonomy_first_plan_receipt_service((enrolled->>'jobId')::uuid);
END; $fn$;

CREATE FUNCTION public.rpc_ai_complete_need_turn_with_first_plan_service(
 p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid,
 p_user_message text,p_assistant_message text,p_safety text,p_proposals jsonb,p_targets jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $fn$
DECLARE completed jsonb;job jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 completed:=public.rpc_ai_complete_need_turn_v2_service(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,p_user_message,p_assistant_message,p_safety,p_proposals);
 job:=private.taxonomy_first_plan_complete_receipt_v1(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,'NEED_SERVICE',p_safety,completed,p_targets);
 RETURN jsonb_build_object('completion',completed,'firstPlan',job);
END; $fn$;

CREATE FUNCTION public.rpc_ai_complete_need_location_turn_with_first_plan_service(
 p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid,
 p_user_message text,p_assistant_message text,p_safety text,p_proposals jsonb,
 p_location_context jsonb,p_location_action text,p_targets jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $fn$
DECLARE completed jsonb;job jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 completed:=public.rpc_ai_complete_need_location_turn_v1_service(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,p_user_message,p_assistant_message,p_safety,p_proposals,p_location_context,p_location_action);
 job:=private.taxonomy_first_plan_complete_receipt_v1(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,'NEED_SERVICE',p_safety,completed->'turn',p_targets);
 RETURN jsonb_build_object('completion',completed,'firstPlan',job);
END; $fn$;

CREATE FUNCTION public.rpc_complete_worker_ai_turn_with_first_plan_service(
 p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid,p_output jsonb,p_targets jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $fn$
DECLARE completed jsonb;job jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 completed:=public.rpc_complete_worker_ai_turn_service(p_account_id,p_conversation_id,p_client_request_id,p_attempt_id,p_output);
 job:=private.taxonomy_first_plan_complete_receipt_v1(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,'WORKER_CAPABILITY',p_output->>'safety',completed,p_targets);
 RETURN jsonb_build_object('completion',completed,'firstPlan',job);
END; $fn$;

REVOKE ALL ON FUNCTION private.taxonomy_first_plan_complete_receipt_v1(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_ai_complete_need_turn_with_first_plan_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_ai_complete_need_location_turn_with_first_plan_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_complete_worker_ai_turn_with_first_plan_service(uuid,uuid,uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_ai_complete_need_turn_with_first_plan_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_ai_complete_need_location_turn_with_first_plan_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_complete_worker_ai_turn_with_first_plan_service(uuid,uuid,uuid,uuid,jsonb,jsonb) TO service_role;
COMMIT;
