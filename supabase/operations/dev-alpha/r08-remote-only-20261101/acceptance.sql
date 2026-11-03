-- DML-only acceptance fragment. The caller MUST create SAVEPOINT r08_acceptance
-- and ROLLBACK TO it after success; any assertion failure aborts the promotion.
-- Synthetic claims exercise SQL roles/RPCs, not GoTrue, PostgREST or Gemini.
DO $r08_acceptance$
<<r08_fixture>>
DECLARE
 owner_id uuid := 'af081101-0000-4000-8000-000000000001';
 other_id uuid := 'af081101-0000-4000-8000-000000000002';
 conversation_id uuid := 'af081101-0000-4000-8000-000000000003';
 request_id uuid := 'af081101-0000-4000-8000-000000000004';
 category_id uuid := '065e7a4e-7956-4fc6-9d42-2d10b3a3aafb';
 service_label text := 'Izrada jednostavnog sajta';
 profile_id uuid; version bigint; review jsonb; receipt jsonb; result jsonb;
 denied boolean; candidate jsonb;
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
 -- Controlled fixture for an existing signed server hint; no Gemini call or new
 -- category authority. The real prepare function signs the resulting review.
 INSERT INTO private.work_taxonomy_gemini_turn_hints_v1(account_id,conversation_id,client_request_id,
  turn_id,attempt_id,payload_digest,purpose,source_fingerprint,catalog_version,proposals)
 SELECT owner_id,r08_fixture.conversation_id,request_id,gen_random_uuid(),gen_random_uuid(),repeat('a',64),
  'WORKER_CAPABILITY',encode(extensions.digest(convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex'),version,
  jsonb_build_array(jsonb_build_object('action','REUSE_EXISTING','service',service_label,'mode','REMOTE',
   'categoryId',category_id,'catalogVersion',version,'reason','Explicit synthetic remote service using established identity',
   'handoff',jsonb_build_object('required',false)))
 FROM private.worker_ai_sessions s WHERE s.conversation_id=r08_fixture.conversation_id;

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
 review:=public.rpc_prepare_worker_ai_review_taxonomy(conversation_id,1,true);
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
END;
$r08_acceptance$;
