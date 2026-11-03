-- R06 single-pass completion + first-plan catalog resolution. LOCAL_ONLY, NOT TESTED.
-- Supersedes this candidate's previous enrollment of a second-model job.
-- Reuses existing completion writers and hint storage; no queue/table/provider.
-- Old enqueue candidate remains historical LOCAL_ONLY, not a prerequisite.
-- Requires a new reviewed promotion/rollback package before any Edge deployment.
-- Requires r04_turn_catalog_resolution_candidate.sql first, in the same package.
BEGIN;
DO $admission$
DECLARE spec record;
BEGIN
 IF current_setting('uskoci.r06_first_plan.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
 OR current_user<>'postgres' OR current_database()<>'postgres'
 OR to_regrole('cli_login_postgres') IS NOT NULL THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_LOCAL_ONLY' USING errcode='55000'; END IF;
 -- Recorded definitions, not a fresh DEV assertion. Need completion is the
 -- 20261102 deployed postimage; other hashes are retained captured preimages.
 FOR spec IN SELECT * FROM (VALUES
 ('public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)','b867f1c7289fb7513f5acec4a050b8c8'),
 ('public.rpc_ai_complete_need_location_turn_v1_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text)','10d26307c5a7ef4c16940fa8e54d4d64'),
 ('public.rpc_complete_worker_ai_turn_service(uuid,uuid,uuid,uuid,jsonb)','5f0b6545dcde28bf2fcb4ea0f0393458'),
 ('public.rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)','c363facdb26d33ae872e25e6a79e4306')) AS expected(signature,body_md5)
 LOOP
  IF md5(replace(pg_get_functiondef(to_regprocedure(spec.signature)),chr(13),'')) IS DISTINCT FROM spec.body_md5 THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_OWNER_DRIFT' USING errcode='55000'; END IF;
END LOOP;
 IF to_regprocedure('private.taxonomy_resolve_turn_catalog_v1(uuid,text,jsonb,text)') IS NULL THEN
  RAISE EXCEPTION 'R06_TURN_CATALOG_RESOLVER_REQUIRED' USING errcode='55000'; END IF;
END; $admission$;

-- Acquire the same lock order as the domain writer before observing replay.
-- A legacy completed turn with no captured plan cannot acquire a new plan here.
CREATE FUNCTION private.taxonomy_first_plan_lock_v1(
 p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid,p_purpose text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'pg_catalog' AS $fn$
DECLARE v_state text;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 IF p_account_id IS NULL OR p_conversation_id IS NULL OR p_client_request_id IS NULL OR p_attempt_id IS NULL THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 PERFORM private.closure_assert_open(p_account_id);
 IF p_purpose='NEED_SERVICE' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));
  PERFORM 1 FROM public.ai_conversations WHERE id=p_conversation_id AND account_id=p_account_id FOR UPDATE;
  SELECT state INTO v_state FROM private.ai_need_turn_commands
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
     AND client_request_id=p_client_request_id AND attempt_id=p_attempt_id FOR UPDATE;
 ELSIF p_purpose='WORKER_CAPABILITY' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('worker-ai-turn:'||p_account_id::text||p_client_request_id::text,0));
  PERFORM 1 FROM private.worker_ai_sessions WHERE account_id=p_account_id AND conversation_id=p_conversation_id FOR UPDATE;
  PERFORM 1 FROM public.ai_conversations WHERE id=p_conversation_id AND account_id=p_account_id AND purpose='PROFILE' FOR UPDATE;
  SELECT state INTO v_state FROM private.worker_ai_turns
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
     AND client_request_id=p_client_request_id AND attempt_id=p_attempt_id FOR UPDATE;
 ELSE RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 IF v_state IS NULL THEN RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 RETURN v_state='SUCCEEDED';
END; $fn$;

-- Hash the frozen writer arguments, including the first plan. JSONB normalizes
-- object key order; identities are checked independently under the domain locks.
-- Persist only the digest, never another copy of the conversation/provider body.
CREATE FUNCTION private.taxonomy_first_plan_input_digest_v1(p_writer text,p_arguments jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path TO 'pg_catalog' AS $fn$
 SELECT encode(extensions.digest(jsonb_build_object('writer',p_writer,'arguments',
  p_arguments-array['p_account_id','p_conversation_id','p_client_request_id','p_attempt_id'])::text,'sha256'),'hex');
$fn$;

CREATE FUNCTION private.taxonomy_first_plan_complete_receipt_v1(
 p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid,
 p_purpose text,p_safety text,p_turn jsonb,p_taxonomy_plan jsonb,p_completion_digest text,p_was_completed boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'pg_catalog' AS $fn$
DECLARE h private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE; captured jsonb;resolved jsonb;
 v_turn_id uuid;v_version bigint;v_proposals jsonb;v_digest text;
 v_input_digest text;
 v_category jsonb;v_geography jsonb;v_handoff jsonb;v_mode text;v_count integer;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 IF p_turn->>'conversationId' IS DISTINCT FROM p_conversation_id::text
 OR p_turn->>'clientRequestId' IS DISTINCT FROM p_client_request_id::text
 OR (p_purpose='WORKER_CAPABILITY' AND p_turn->>'attemptId' IS DISTINCT FROM p_attempt_id::text) THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 IF p_turn->>'state' IS DISTINCT FROM 'SUCCEEDED' THEN
  RETURN jsonb_build_object('state','NOT_ELIGIBLE','authority','NONE'); END IF;
 v_turn_id:=(p_turn->>'turnId')::uuid;
 IF v_turn_id IS NULL OR p_was_completed IS NULL OR p_completion_digest IS NULL
 OR p_completion_digest !~ '^[0-9a-f]{64}$' THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 -- Need's public receipt deliberately has no attemptId. Bind it to the exact
 -- durable command instead of demanding a Worker-only field from the receipt.
 IF p_purpose='NEED_SERVICE' THEN
  IF NOT EXISTS(SELECT 1 FROM private.ai_need_turn_commands t
    WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id
      AND t.client_request_id=p_client_request_id AND t.turn_id=v_turn_id
      AND t.attempt_id=p_attempt_id AND t.state='SUCCEEDED' AND t.cancelled_at IS NULL)
   OR p_turn IS DISTINCT FROM private.ai_need_turn_status(p_account_id,p_conversation_id,p_client_request_id) THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 ELSIF p_purpose='WORKER_CAPABILITY' THEN
  IF NOT EXISTS(SELECT 1 FROM private.worker_ai_turns t
    WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id
      AND t.client_request_id=p_client_request_id AND t.turn_id=v_turn_id
      AND t.attempt_id=p_attempt_id AND t.state='SUCCEEDED' AND t.cancelled_at IS NULL)
   OR p_turn IS DISTINCT FROM private.worker_ai_turn_document(v_turn_id) THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 ELSE RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 IF p_purpose='NEED_SERVICE' AND p_turn#>>'{receipt,safety}' IS DISTINCT FROM p_safety THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID' USING errcode='55000'; END IF;
 IF p_safety IS NULL OR p_safety NOT IN('ALLOW','CLARIFY') THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_SAFETY_INVALID' USING errcode='22023'; END IF;
 IF jsonb_typeof(p_taxonomy_plan) IS DISTINCT FROM 'object'
 OR NOT(p_taxonomy_plan ?& array['catalogVersion','proposals','anchors'])
 OR p_taxonomy_plan-array['catalogVersion','proposals','anchors']<>'{}'::jsonb
 OR jsonb_typeof(p_taxonomy_plan->'catalogVersion') IS DISTINCT FROM 'number'
 OR (p_taxonomy_plan->>'catalogVersion') !~ '^[1-9][0-9]*$'
 OR jsonb_typeof(p_taxonomy_plan->'proposals') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_taxonomy_plan->'anchors') IS DISTINCT FROM 'array'
 OR pg_column_size(p_taxonomy_plan)>18000 THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 v_version:=(p_taxonomy_plan->>'catalogVersion')::bigint;
 v_proposals:=p_taxonomy_plan->'proposals';
 IF jsonb_array_length(v_proposals)<1 THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 v_digest:=encode(extensions.digest(v_proposals::text,'sha256'),'hex');
 v_input_digest:=encode(extensions.digest(p_taxonomy_plan::text,'sha256'),'hex');
 SELECT * INTO h FROM private.work_taxonomy_gemini_turn_hints_v1
  WHERE account_id=p_account_id AND purpose=p_purpose AND turn_id=v_turn_id;
 IF FOUND THEN
  IF h.conversation_id IS DISTINCT FROM p_conversation_id
  OR h.client_request_id IS DISTINCT FROM p_client_request_id
  OR h.attempt_id IS DISTINCT FROM p_attempt_id
  OR h.catalog_version IS DISTINCT FROM v_version OR h.payload_digest IS DISTINCT FROM v_digest
  OR h.proposals IS DISTINCT FROM v_proposals THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_CONFLICT' USING errcode='22023'; END IF;
  -- A legacy completed hint cannot acquire new catalog authority on replay.
  IF h.catalog_resolution IS NULL THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_MISSING' USING errcode='PT409'; END IF;
  IF h.catalog_resolution->>'inputDigest' IS DISTINCT FROM v_input_digest
  OR h.catalog_resolution->>'completionDigest' IS DISTINCT FROM p_completion_digest THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_CONFLICT' USING errcode='22023'; END IF;
  resolved:=h.catalog_resolution;
  RETURN jsonb_build_object('state',resolved->>'state','authority',
   CASE WHEN resolved->>'state'='RESOLVED' THEN 'CATALOG_ONLY' ELSE 'NONE' END,'applicability','NOT_EVALUATED')
   ||CASE WHEN resolved->>'state'='DEFERRED' THEN jsonb_build_object('code',resolved->>'code') ELSE '{}'::jsonb END;
 END IF;
 IF p_was_completed THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_MISSING' USING errcode='PT409'; END IF;
 IF p_purpose='NEED_SERVICE' THEN
  SELECT count(*) INTO v_count FROM public.ai_structured_facts
   WHERE account_id=p_account_id AND conversation_id=p_conversation_id
    AND superseded_at IS NULL AND status<>'UNKNOWN' AND fact_key='need.category';
  IF v_count<>1 OR jsonb_array_length(v_proposals)<>1 THEN
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
  OR private.taxonomy_normalize_v1(v_proposals#>>'{0,service}') IS DISTINCT FROM private.taxonomy_normalize_v1(v_category#>>'{}')
  OR v_proposals#>>'{0,mode}' IS DISTINCT FROM v_mode
  OR coalesce(v_proposals#>'{0,handoff}','null'::jsonb) IS DISTINCT FROM
     coalesce(CASE WHEN v_mode='REMOTE' THEN v_handoff END,'null'::jsonb) THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_NEED_TARGET_MISMATCH' USING errcode='22023'; END IF;
 END IF;
 -- Existing writer owns bounded shape, USER-offered worker skills, source hash,
 -- completed attempt, lifecycle lock, idempotency and persistent hint storage.
 captured:=public.rpc_taxonomy_capture_gemini_turn_hints_service(p_account_id,p_conversation_id,
  p_client_request_id,v_turn_id,p_attempt_id,p_purpose,v_version,v_proposals);
 IF captured->>'action' IS DISTINCT FROM 'HINT_CAPTURED' OR captured->>'authority' IS DISTINCT FROM 'NONE' THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_CAPTURE_RECEIPT_INVALID' USING errcode='55000'; END IF;
 SELECT * INTO h FROM private.work_taxonomy_gemini_turn_hints_v1
  WHERE account_id=p_account_id AND purpose=p_purpose AND turn_id=v_turn_id;
 resolved:=private.taxonomy_resolve_turn_catalog_v1(h.id,v_input_digest,p_taxonomy_plan->'anchors',p_safety);
 resolved:=resolved||jsonb_build_object('completionDigest',p_completion_digest);
 UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET catalog_resolution=resolved WHERE id=h.id;
 RETURN jsonb_build_object('state',resolved->>'state','authority',
  CASE WHEN resolved->>'state'='RESOLVED' THEN 'CATALOG_ONLY' ELSE 'NONE' END,'applicability','NOT_EVALUATED')
  ||CASE WHEN resolved->>'state'='DEFERRED' THEN jsonb_build_object('code',resolved->>'code') ELSE '{}'::jsonb END;
END; $fn$;

CREATE FUNCTION public.rpc_ai_complete_need_turn_with_first_plan_service(
 p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid,
 p_user_message text,p_assistant_message text,p_safety text,p_proposals jsonb,p_taxonomy_plan jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $fn$
DECLARE completed jsonb;plan jsonb;was_completed boolean;
BEGIN
 was_completed:=private.taxonomy_first_plan_lock_v1(p_account_id,p_conversation_id,p_client_request_id,p_attempt_id,'NEED_SERVICE');
 completed:=public.rpc_ai_complete_need_turn_v2_service(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,p_user_message,p_assistant_message,p_safety,p_proposals);
 plan:=private.taxonomy_first_plan_complete_receipt_v1(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,'NEED_SERVICE',p_safety,completed,p_taxonomy_plan,
  private.taxonomy_first_plan_input_digest_v1('rpc_ai_complete_need_turn_with_first_plan_service',
   jsonb_build_object('p_user_message',p_user_message,'p_assistant_message',p_assistant_message,
    'p_safety',p_safety,'p_proposals',p_proposals,'p_taxonomy_plan',p_taxonomy_plan)),was_completed);
 RETURN jsonb_build_object('completion',completed,'firstPlan',plan);
END; $fn$;

CREATE FUNCTION public.rpc_ai_complete_need_location_turn_with_first_plan_service(
 p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid,
 p_user_message text,p_assistant_message text,p_safety text,p_proposals jsonb,
 p_location_context jsonb,p_location_action text,p_taxonomy_plan jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $fn$
DECLARE completed jsonb;plan jsonb;was_completed boolean;
BEGIN
 was_completed:=private.taxonomy_first_plan_lock_v1(p_account_id,p_conversation_id,p_client_request_id,p_attempt_id,'NEED_SERVICE');
 completed:=public.rpc_ai_complete_need_location_turn_v1_service(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,p_user_message,p_assistant_message,p_safety,p_proposals,p_location_context,p_location_action);
 plan:=private.taxonomy_first_plan_complete_receipt_v1(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,'NEED_SERVICE',p_safety,completed->'turn',p_taxonomy_plan,
  private.taxonomy_first_plan_input_digest_v1('rpc_ai_complete_need_location_turn_with_first_plan_service',
   jsonb_build_object('p_user_message',p_user_message,'p_assistant_message',p_assistant_message,
    'p_safety',p_safety,'p_proposals',p_proposals,'p_location_context',p_location_context,
    'p_location_action',p_location_action,'p_taxonomy_plan',p_taxonomy_plan)),was_completed);
 RETURN jsonb_build_object('completion',completed,'firstPlan',plan);
END; $fn$;

CREATE FUNCTION public.rpc_complete_worker_ai_turn_with_first_plan_service(
 p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid,p_output jsonb,p_taxonomy_plan jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $fn$
DECLARE completed jsonb;plan jsonb;was_completed boolean;
BEGIN
 was_completed:=private.taxonomy_first_plan_lock_v1(p_account_id,p_conversation_id,p_client_request_id,p_attempt_id,'WORKER_CAPABILITY');
 completed:=public.rpc_complete_worker_ai_turn_service(p_account_id,p_conversation_id,p_client_request_id,p_attempt_id,p_output);
 plan:=private.taxonomy_first_plan_complete_receipt_v1(p_account_id,p_conversation_id,p_client_request_id,
  p_attempt_id,'WORKER_CAPABILITY',p_output->>'safety',completed,p_taxonomy_plan,
  private.taxonomy_first_plan_input_digest_v1('rpc_complete_worker_ai_turn_with_first_plan_service',
   jsonb_build_object('p_output',p_output,'p_taxonomy_plan',p_taxonomy_plan)),was_completed);
 RETURN jsonb_build_object('completion',completed,'firstPlan',plan);
END; $fn$;

-- Read after a lost completion ACK. This never runs the provider, completes a
-- turn, creates a category, changes a cancelled attempt or approves a review.
-- PENDING permits at most the same completion payload; never a paid AI retry.
CREATE FUNCTION public.rpc_ai_read_first_plan_completion_service(p_writer text,p_arguments jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $fn$
DECLARE aid uuid;cid uuid;rid uuid;attempt uuid;v_purpose text;fields text[];
 done boolean;v_turn_id uuid;live boolean;completed jsonb;resolved jsonb;receipt jsonb;digest text;
 h private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 fields:=array['p_account_id','p_conversation_id','p_client_request_id','p_attempt_id','p_taxonomy_plan'];
 IF p_writer='rpc_complete_worker_ai_turn_with_first_plan_service' THEN
  v_purpose:='WORKER_CAPABILITY';fields:=fields||array['p_output'];
 ELSIF p_writer IN('rpc_ai_complete_need_turn_with_first_plan_service','rpc_ai_complete_need_location_turn_with_first_plan_service') THEN
  v_purpose:='NEED_SERVICE';fields:=fields||array['p_user_message','p_assistant_message','p_safety','p_proposals'];
  IF p_writer='rpc_ai_complete_need_location_turn_with_first_plan_service' THEN
   fields:=fields||array['p_location_context','p_location_action']; END IF;
 ELSE RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 IF jsonb_typeof(p_arguments) IS DISTINCT FROM 'object' OR pg_column_size(p_arguments)>65536
 OR NOT(p_arguments ?& fields) OR p_arguments-fields<>'{}'::jsonb THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 aid:=(p_arguments->>'p_account_id')::uuid;cid:=(p_arguments->>'p_conversation_id')::uuid;
 rid:=(p_arguments->>'p_client_request_id')::uuid;attempt:=(p_arguments->>'p_attempt_id')::uuid;
 done:=private.taxonomy_first_plan_lock_v1(aid,cid,rid,attempt,v_purpose);
 IF v_purpose='NEED_SERVICE' THEN
  SELECT t.turn_id,t.state='PROCESSING' AND t.provider_dispatched AND t.cancelled_at IS NULL
    AND t.lease_expires_at>clock_timestamp() INTO v_turn_id,live
   FROM private.ai_need_turn_commands t WHERE t.account_id=aid AND t.conversation_id=cid
    AND t.client_request_id=rid AND t.attempt_id=attempt;
 ELSE
  SELECT t.turn_id,t.state='PROCESSING' AND t.provider_dispatched AND t.cancelled_at IS NULL
    AND t.lease_expires_at>clock_timestamp() INTO v_turn_id,live
   FROM private.worker_ai_turns t WHERE t.account_id=aid AND t.conversation_id=cid
    AND t.client_request_id=rid AND t.attempt_id=attempt;
 END IF;
 IF NOT done THEN
  RETURN jsonb_build_object('state',CASE WHEN live THEN 'PENDING' ELSE 'STOPPED' END); END IF;
  digest:=private.taxonomy_first_plan_input_digest_v1(p_writer,p_arguments);
  SELECT * INTO h FROM private.work_taxonomy_gemini_turn_hints_v1 x
  WHERE x.account_id=aid AND x.conversation_id=cid AND x.client_request_id=rid
   AND x.turn_id=v_turn_id AND x.attempt_id=attempt AND x.purpose=v_purpose;
 IF NOT FOUND OR h.catalog_resolution IS NULL
 OR h.catalog_resolution->>'completionDigest' IS DISTINCT FROM digest THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_CONFLICT' USING errcode='22023'; END IF;
 resolved:=h.catalog_resolution;
 IF v_purpose='WORKER_CAPABILITY' THEN completed:=private.worker_ai_turn_document(v_turn_id);
 ELSIF p_writer='rpc_ai_complete_need_location_turn_with_first_plan_service' THEN
  completed:=private.ai_location_turn_document(aid,cid,rid);
 ELSE completed:=private.ai_need_turn_status(aid,cid,rid); END IF;
 receipt:=jsonb_build_object('state',resolved->>'state','authority',
  CASE WHEN resolved->>'state'='RESOLVED' THEN 'CATALOG_ONLY' ELSE 'NONE' END,'applicability','NOT_EVALUATED')
  ||CASE WHEN resolved->>'state'='DEFERRED' THEN jsonb_build_object('code',resolved->>'code') ELSE '{}'::jsonb END;
 RETURN jsonb_build_object('state','COMPLETED','envelope',jsonb_build_object('completion',completed,'firstPlan',receipt));
END; $fn$;

REVOKE ALL ON FUNCTION private.taxonomy_first_plan_input_digest_v1(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_ai_read_first_plan_completion_service(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_ai_read_first_plan_completion_service(text,jsonb) TO service_role;

REVOKE ALL ON FUNCTION private.taxonomy_first_plan_lock_v1(uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.taxonomy_first_plan_complete_receipt_v1(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_ai_complete_need_turn_with_first_plan_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_ai_complete_need_location_turn_with_first_plan_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_complete_worker_ai_turn_with_first_plan_service(uuid,uuid,uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_ai_complete_need_turn_with_first_plan_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_ai_complete_need_location_turn_with_first_plan_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_complete_worker_ai_turn_with_first_plan_service(uuid,uuid,uuid,uuid,jsonb,jsonb) TO service_role;
COMMIT;
