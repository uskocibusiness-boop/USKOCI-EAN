-- DML-only current-schema acceptance. The caller MUST create SAVEPOINT single_pass_acceptance
-- and ROLLBACK TO it after success; any assertion failure aborts the promotion.
-- Synthetic claims exercise SQL roles/RPCs, not GoTrue, PostgREST or Gemini.
DO $single_pass_acceptance$
<<r08_fixture>>
DECLARE
 owner_id uuid := 'af040303-0000-4000-8000-000000000001';
 other_id uuid := 'af040303-0000-4000-8000-000000000002';
 conversation_id uuid := 'af040303-0000-4000-8000-000000000003';
 request_id uuid := 'af040303-0000-4000-8000-000000000004';
 category_id uuid := '065e7a4e-7956-4fc6-9d42-2d10b3a3aafb';
 service_label text := 'Izrada jednostavnog sajta';
 profile_id uuid; version bigint; review jsonb; receipt jsonb; result jsonb;
 denied boolean; candidate jsonb; taxonomy_plan jsonb; completed jsonb; model_output jsonb; exported jsonb; hint jsonb;
 turn_id uuid:=gen_random_uuid(); attempt_id uuid:=gen_random_uuid();
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_ROLE_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id IN(owner_id,other_id))
  OR EXISTS(SELECT 1 FROM public.ai_conversations WHERE id=conversation_id)
  OR EXISTS(SELECT 1 FROM private.worker_ai_sessions s WHERE s.conversation_id=r08_fixture.conversation_id)
 THEN RAISE EXCEPTION 'R08_ACCEPTANCE_FIXTURE_COLLISION'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
   JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
   WHERE c.id=r08_fixture.category_id AND c.label=service_label AND c.state='ESTABLISHED'
    AND m.execution_scope='REMOTE')
 THEN RAISE EXCEPTION 'R08_ACCEPTANCE_EXISTING_REMOTE_SERVICE_MISSING'; END IF;
 SELECT catalog_version INTO STRICT version FROM private.work_taxonomy_control WHERE singleton;

 -- No password, session, email delivery or real identity is created. The existing
 -- Auth INSERT trigger creates the account and its two profiles transactionally.
 PERFORM set_config('request.jwt.claims','{}',true);
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claim.role','',true);
 INSERT INTO auth.users(id,raw_user_meta_data)
 VALUES(owner_id,'{"full_name":"R08 synthetic acceptance","mode":"worker"}'::jsonb);
 INSERT INTO private.account_lineage_v5(account_id,lineage,reason,source_ref)
 VALUES(owner_id,'SYNTHETIC_ACCEPTANCE_FIXTURE','R08 rollback-only SQL acceptance','R08_DEV_20261101');
 IF private.account_visibility_world(owner_id)<>'TEST' THEN RAISE EXCEPTION 'R08_ACCEPTANCE_WORLD'; END IF;
 SELECT p.id INTO STRICT profile_id FROM public.app_profiles p
 WHERE p.account_id=owner_id AND p.kind='WORKER' AND p.profile_status='DRAFT' AND p.city='';
 INSERT INTO public.ai_conversations(id,account_id,purpose,status)
 VALUES(conversation_id,owner_id,'PROFILE','OPEN');
 candidate:=private.worker_ai_initial(owner_id)||jsonb_build_object(
  'bio','Synthetic remote service acceptance','skills',jsonb_build_array(service_label));
 INSERT INTO private.worker_ai_sessions(conversation_id,account_id,open_request_id,profile_id,base_hash,candidate,revision,safety)
 VALUES(conversation_id,owner_id,request_id,profile_id,private.worker_ai_source_hash(owner_id),candidate,1,'ALLOW');
 -- Synthetic provider output; real completion, resolver, review, Save and binder.
 -- No Gemini request, paid reservation, session or password.
 INSERT INTO private.worker_ai_turns(turn_id,account_id,conversation_id,client_request_id,body_hash,
  source_revision,attempt_id,state,lease_expires_at,provider_dispatched)
 VALUES(turn_id,owner_id,conversation_id,request_id,repeat('a',64),1,attempt_id,'PROCESSING',clock_timestamp()+interval '5 minutes',true);
 taxonomy_plan:=jsonb_build_object('catalogVersion',version,'anchors',jsonb_build_array(
  jsonb_build_object('categoryId',category_id,'label',service_label,'parentId',
   (SELECT parent_id FROM private.work_taxonomy_categories WHERE id=category_id))),
  'proposals',jsonb_build_array(jsonb_build_object('action','REUSE_EXISTING','service',service_label,'mode','REMOTE',
   'categoryId',category_id,'parentId','','proposedPath','[]'::jsonb,'catalogVersion',version,
   'reason','Synthetic acceptance of the existing catalog identity','handoff',jsonb_build_object('required',false))));
 model_output:=jsonb_build_object('assistantMessage','Pregled je spreman.','safety','ALLOW','patch','{}'::jsonb);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','service_role')::text,true);
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 EXECUTE 'SET LOCAL ROLE service_role';
 completed:=public.rpc_complete_worker_ai_turn_with_first_plan_service(owner_id,conversation_id,request_id,attempt_id,model_output,taxonomy_plan);
 IF completed#>>'{firstPlan,state}' IS DISTINCT FROM 'RESOLVED' THEN RAISE EXCEPTION 'SINGLE_PASS_WORKER_COMPLETION';END IF;
 IF public.rpc_complete_worker_ai_turn_with_first_plan_service(owner_id,conversation_id,request_id,attempt_id,model_output,taxonomy_plan)
  IS DISTINCT FROM completed THEN RAISE EXCEPTION 'SINGLE_PASS_REPLAY';END IF;
 result:=public.rpc_ai_read_first_plan_completion_service('rpc_complete_worker_ai_turn_with_first_plan_service',
  jsonb_build_object('p_account_id',owner_id,'p_conversation_id',conversation_id,'p_client_request_id',request_id,'p_attempt_id',attempt_id,
   'p_output',model_output,'p_taxonomy_plan',taxonomy_plan));
 IF result IS DISTINCT FROM jsonb_build_object('state','COMPLETED','envelope',completed) THEN RAISE EXCEPTION 'SINGLE_PASS_ACK_READBACK';END IF;
 EXECUTE 'RESET ROLE';

 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 denied:=false;
 BEGIN PERFORM public.rpc_complete_worker_profile(profile_id);
 EXCEPTION WHEN SQLSTATE 'P0001' THEN
  IF SQLERRM='CITY_REQUIRED' THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'R08_ACCEPTANCE_UNSIGNED_ACTIVATION'; END IF;
 review:=public.rpc_prepare_worker_ai_review_taxonomy(conversation_id,2,true);
 IF review->'canAccept' IS DISTINCT FROM 'true'::jsonb
  OR review->'missingRequired' IS DISTINCT FROM '[]'::jsonb
  OR review->>'classificationState' IS DISTINCT FROM 'READY'
 THEN RAISE EXCEPTION 'R08_ACCEPTANCE_PREPARE'; END IF;
 receipt:=public.rpc_save_worker_ai_review((review->>'reviewId')::uuid,review->>'displayedContentDigest',request_id);
 IF receipt->>'profileStatus' IS DISTINCT FROM 'ACTIVE'
  OR receipt->'authoritative' IS DISTINCT FROM 'true'::jsonb
  OR receipt->>'accountId' IS DISTINCT FROM owner_id::text
  OR receipt->>'profileId' IS DISTINCT FROM profile_id::text
  OR receipt->>'reviewId' IS DISTINCT FROM review->>'reviewId'
 THEN RAISE EXCEPTION 'R08_ACCEPTANCE_SAVE_RECEIPT'; END IF;
 IF public.rpc_save_worker_ai_review((review->>'reviewId')::uuid,review->>'displayedContentDigest',request_id)
  IS DISTINCT FROM receipt THEN RAISE EXCEPTION 'R08_ACCEPTANCE_REPLAY'; END IF;
 result:=public.rpc_read_worker_ai_taxonomy(conversation_id);
 IF result->'saved' IS DISTINCT FROM receipt THEN RAISE EXCEPTION 'R08_ACCEPTANCE_READBACK'; END IF;

 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',other_id::text,true);
 denied:=false;
 BEGIN PERFORM public.rpc_save_worker_ai_review((review->>'reviewId')::uuid,review->>'displayedContentDigest',request_id);
 EXCEPTION WHEN SQLSTATE '42501' THEN
  IF SQLERRM='WORKER_AI_DENIED' THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'R08_ACCEPTANCE_FOREIGN_OWNER'; END IF;
 EXECUTE 'RESET ROLE';
 IF NOT EXISTS(SELECT 1 FROM public.app_profiles p WHERE p.id=profile_id AND p.account_id=owner_id
  AND p.profile_status='ACTIVE' AND p.city='' AND p.operating_country_code IS NULL)
 THEN RAISE EXCEPTION 'R08_ACCEPTANCE_FABRICATED_LOCATION'; END IF;
 IF private.worker_remote_only_activation_ready_v1(owner_id,ARRAY[service_label])
 THEN RAISE EXCEPTION 'R08_ACCEPTANCE_PREBINDING_AUTHORITY'; END IF;
 IF (SELECT count(*) FROM private.work_taxonomy_review_outbox_v1 o
  WHERE o.owner_account_id=owner_id AND o.source_review_id=(review->>'reviewId')::uuid)<>1
 THEN RAISE EXCEPTION 'R08_ACCEPTANCE_OUTBOX'; END IF;

 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','service_role')::text,true);
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 EXECUTE 'SET LOCAL ROLE service_role';
 result:=public.rpc_taxonomy_commit_reviewed_batch_service(owner_id,request_id,'WORKER_CAPABILITY',
  (review->>'reviewId')::uuid,review->'classificationCandidates');
 IF result->>'status' IS DISTINCT FROM 'COMMITTED' OR (result->>'createdCount')::integer<>0
 THEN RAISE EXCEPTION 'R08_ACCEPTANCE_BATCH'; END IF;
 result:=public.rpc_taxonomy_bind_reviewed_worker_service(owner_id,request_id,(review->>'reviewId')::uuid,profile_id);
 IF result->>'status' IS DISTINCT FROM 'BOUND_WORKER_SERVICES'
 THEN RAISE EXCEPTION 'R08_ACCEPTANCE_BINDER'; END IF;
 EXECUTE 'RESET ROLE';
 IF NOT private.worker_remote_only_activation_ready_v1(owner_id,ARRAY[service_label])
 THEN RAISE EXCEPTION 'R08_ACCEPTANCE_DURABLE_REMOTE'; END IF;
 -- Actual inventory-driven export walks the live schema, not a mock projector.
 SELECT to_jsonb(h) INTO STRICT hint FROM private.work_taxonomy_gemini_turn_hints_v1 h
 WHERE h.account_id=owner_id AND h.conversation_id=r08_fixture.conversation_id;
 SELECT value INTO STRICT exported FROM private.closure_taxonomy_export_rows_v1(owner_id)
 WHERE key=(SELECT x->>'key' FROM jsonb_array_elements(private.closure_taxonomy_inventory_v1()) x
  WHERE x->>'relation'='private.work_taxonomy_gemini_turn_hints_v1')
  AND value->>'conversation_id'=conversation_id::text;
 IF exported#>>'{catalog_resolution,items,0,categoryId}' IS DISTINCT FROM category_id::text
  OR exported::text LIKE '%completionDigest%' OR exported::text LIKE '%inputDigest%'
 THEN RAISE EXCEPTION 'SINGLE_PASS_EXPORT';END IF;
 IF EXISTS(SELECT 1 FROM private.closure_taxonomy_export_rows_v1(other_id)
  WHERE value->>'conversation_id'=conversation_id::text) THEN RAISE EXCEPTION 'SINGLE_PASS_FOREIGN_EXPORT';END IF;
 IF private.closure_redaction_patch_v5('private.work_taxonomy_gemini_turn_hints_v1',hint,owner_id,request_id)
  IS DISTINCT FROM jsonb_build_object('operation','DELETE','patch','{}'::jsonb)
 THEN RAISE EXCEPTION 'SINGLE_PASS_ERASURE_PLAN';END IF;
 -- Full account erasure remains blocked by existing R10 certification. Do not
 -- bypass it or manufacture a closure certificate to make this proof green.
 IF private.retention_ai_source_ready() IS DISTINCT FROM false
  OR private.closure_erasure_binding_v5() IS NOT NULL OR private.data_export_policy_binding() IS NOT NULL
 THEN RAISE EXCEPTION 'SINGLE_PASS_UNEXPECTED_LIFECYCLE_AUTHORITY';END IF;
END;
$single_pass_acceptance$;
