\set ON_ERROR_STOP on
-- Parent identities are created by the previous migrations.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',false);

DO $test$
DECLARE d uuid; m uuid; v jsonb; request_id uuid;
BEGIN
 SELECT id INTO STRICT d FROM private.work_taxonomy_categories
   WHERE canonical_key=private.taxonomy_normalize_v1('Digitalne usluge');
 SELECT id INTO STRICT m FROM private.work_taxonomy_categories
   WHERE canonical_key=private.taxonomy_normalize_v1('Molerski radovi');

 v:=public.rpc_request_taxonomy_change_for_need(
   'a0000000-0000-4000-8000-000000000001',4,d);
 IF v->>'action'<>'PENDING_REVIEW' OR v->>'executionScope'<>'REMOTE'
 OR v->>'classificationAuthority'<>'NONE' OR v->>'notificationAuthority'<>'NONE'
 THEN RAISE EXCEPTION 'OWNED_REMOTE_REQUEST_DENIED_%',v; END IF;
 request_id:=(v->>'requestId')::uuid;
 v:=public.rpc_request_taxonomy_change_for_need(
   'a0000000-0000-4000-8000-000000000001',4,d);
 IF v->>'action'<>'ALREADY_REQUESTED' OR (v->>'requestId')::uuid<>request_id
 THEN RAISE EXCEPTION 'DUPLICATE_NOT_IDEMPOTENT_%',v; END IF;

 -- Existing broad family: do not create a new identity or bypass review.
 v:=public.rpc_request_taxonomy_change_for_need(
   'a0000000-0000-4000-8000-000000000004',1,m);
 IF v->>'action' NOT IN ('REVIEW_EXISTING_SERVICE','CLARIFY')
 THEN RAISE EXCEPTION 'EXISTING_CATEGORY_CREATED_%',v; END IF;

 -- Regulated or blocked tasks must never enter automatic admission.
 v:=public.rpc_request_taxonomy_change_for_need(
   'a0000000-0000-4000-8000-000000000005',1,m);
 IF v->>'action' NOT IN ('MANUAL_SAFETY_REVIEW','CLARIFY')
 THEN RAISE EXCEPTION 'REGULATED_WORK_AUTOMATIC_%',v; END IF;
 v:=public.rpc_request_taxonomy_change_for_need(
   'a0000000-0000-4000-8000-000000000006',1,m);
 IF v->>'action'<>'REJECTED_SAFETY' THEN
  RAISE EXCEPTION 'BLOCKED_WORK_AUTOMATIC_%',v; END IF;

 -- No requester may switch to the unrelated execution-mode root.
 BEGIN
  PERFORM public.rpc_request_taxonomy_change_for_need(
    'a0000000-0000-4000-8000-000000000001',4,m);
  RAISE EXCEPTION 'WRONG_MODE_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='WRONG_MODE_ALLOWED' THEN RAISE; END IF;
 END;

 -- No revision mismatch, no published task and no other owner's task.
 BEGIN
  PERFORM public.rpc_request_taxonomy_change_for_need(
    'a0000000-0000-4000-8000-000000000001',3,d);
  RAISE EXCEPTION 'OLD_REVISION_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='OLD_REVISION_ALLOWED' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.rpc_request_taxonomy_change_for_need(
    'a0000000-0000-4000-8000-000000000003',1,d);
  RAISE EXCEPTION 'PUBLISHED_TASK_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='PUBLISHED_TASK_ALLOWED' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.rpc_request_taxonomy_change_for_need(
    'a0000000-0000-4000-8000-000000000002',2,m);
  RAISE EXCEPTION 'OTHER_OWNER_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='OTHER_OWNER_ALLOWED' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'OWNER_BOUND_CATEGORY_CHANGE_REQUESTS_PASS';
END $test$;

RESET ROLE;
DO $post$
DECLARE x int;
BEGIN
 SELECT count(*) INTO x FROM private.work_taxonomy_change_requests;
 IF x<>1 OR
  (SELECT count(*) FROM private.work_taxonomy_categories)<>14 OR
  (SELECT count(*) FROM private.work_taxonomy_worker_capabilities)<>0 OR
  (SELECT count(*) FROM private.work_taxonomy_need_snapshots)<>0 OR
  (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton)
 OR has_table_privilege('authenticated','private.work_taxonomy_change_requests','INSERT')
 OR has_function_privilege('anon','public.rpc_request_taxonomy_change_for_need(uuid,integer,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'CATEGORY_REQUEST_TEST_BROKE_HARD_GATES_%',x; END IF;
 RAISE NOTICE 'CATEGORY_PROPOSAL_QUEUE_ZERO_AUTHORITY_PASS';
END $post$;
