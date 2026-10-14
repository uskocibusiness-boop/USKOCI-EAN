-- P1 authority, safe multi-level admission and replay-proof.
\set ON_ERROR_STOP on
DO $test$
DECLARE v_root uuid;v_plan jsonb;v_p jsonb;v_id uuid;
  v_receipt jsonb;v_again jsonb;v_need jsonb;v_first uuid;v_latest bigint;
  v_worker_digest text;v_need_digest text;v_need_plan jsonb;
BEGIN
 SELECT id INTO STRICT v_root FROM private.work_taxonomy_categories
 WHERE canonical_key=private.taxonomy_normalize_v1('Uređenje prostora');
 v_plan:=jsonb_build_object(
  'action','CREATE_CHILD','catalogVersion',3,'mode','ON_SITE',
  'reason','Gemini classified this as a specific painting service, not a general craft.',
  'parentId',v_root,'path',jsonb_build_array('Molerski radovi','Krečenje zidova')
 );
 -- A legacy review has no plan included in its signed visible payload.
 BEGIN
  PERFORM public.rpc_taxonomy_prepare_admission_service(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '20000000-0000-4000-8000-000000000001','WORKER_CAPABILITY',
  '10000000-0000-4000-8000-000000000001',v_plan);
  RAISE EXCEPTION 'LEGACY_REVIEW_UNBOUND_PLAN_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'ADMISSION_REVIEW_PLAN_NOT_DISPLAYED' THEN RAISE; END IF;
 END;
 v_worker_digest:=private.disposable_bind_classification_review(
 'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000001',v_plan);
 v_p:=public.rpc_taxonomy_prepare_admission_service(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '20000000-0000-4000-8000-000000000001',
  'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000001',v_plan);
 v_id:=(v_p->>'admissionId')::uuid;
 IF (v_p->>'status')<>'PENDING' THEN RAISE EXCEPTION 'WRONG_INITIAL_STATE'; END IF;
 -- No model proposal is allowed to create a category on its own.
 IF EXISTS(SELECT 1 FROM private.work_taxonomy_categories WHERE label='Krečenje zidova')
 THEN RAISE EXCEPTION 'PRE_REVIEW_CATEGORY_CREATED'; END IF;
 BEGIN
  PERFORM public.rpc_taxonomy_commit_admission_service(v_id);
  RAISE EXCEPTION 'COMMITTED_BEFORE_APPROVAL';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'ADMISSION_OWNER_APPROVAL_REQUIRED' THEN RAISE; END IF;
 END;
 PERFORM set_config('test.auth_uid','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
 BEGIN
  PERFORM public.rpc_taxonomy_approve_admission(v_id,v_p->>'planDigest',repeat('a',64));
  RAISE EXCEPTION 'CROSS_ACCOUNT_APPROVAL';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'ADMISSION_NOT_OWNED' THEN RAISE; END IF;
 END;
 PERFORM set_config('test.auth_uid','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
 BEGIN
  PERFORM public.rpc_taxonomy_approve_admission(v_id,repeat('0',64),repeat('a',64));
  RAISE EXCEPTION 'WRONG_DIGEST_APPROVAL';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'ADMISSION_DISPLAY_MISMATCH' THEN RAISE; END IF;
 END;
 -- Matching a digest without the existing profile-save command is never consent.
 BEGIN
  PERFORM public.rpc_taxonomy_approve_admission(v_id,v_p->>'planDigest',v_worker_digest);
  RAISE EXCEPTION 'UNSAVED_REVIEW_APPROVED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'ADMISSION_REVIEW_SAVE_REQUIRED' THEN RAISE; END IF;
 END;
 INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id)
 VALUES('10000000-0000-4000-8000-000000000001',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000001');
 PERFORM public.rpc_taxonomy_approve_admission(v_id,v_p->>'planDigest',v_worker_digest);
 v_receipt:=public.rpc_taxonomy_commit_admission_service(v_id);
 v_again:=public.rpc_taxonomy_commit_admission_service(v_id);
 IF v_receipt IS DISTINCT FROM v_again OR (v_receipt->>'createdCount')::integer<>2
 OR v_receipt->>'capabilityAuthority'<>'NONE' OR v_receipt->>'notificationAuthority'<>'NONE' THEN
  RAISE EXCEPTION 'ATOMIC_ADMISSION_OR_REPLAY_INVALID'; END IF;
 v_first:=(v_receipt->>'categoryId')::uuid;
 IF (SELECT count(*) FROM private.work_taxonomy_categories WHERE
 canonical_key=private.taxonomy_normalize_v1('Krečenje zidova'))<>1
 OR (SELECT parent_id FROM private.work_taxonomy_categories WHERE id=v_first) <>
 (SELECT id FROM private.work_taxonomy_categories WHERE label='Molerski radovi')
 THEN RAISE EXCEPTION 'TREE_NOT_CANONICAL'; END IF;
 IF (SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)<>5
 OR (SELECT count(*) FROM private.work_taxonomy_audit WHERE source_ref LIKE 'OWNER_APPROVED_ADMISSION_V1:%')<>2
 THEN RAISE EXCEPTION 'VERSION_OR_AUDIT_NOT_ATOMIC'; END IF;
 -- The requester arriving later reuses the SAME canonical ID.
 v_need_plan:=jsonb_build_object('action','REUSE_EXISTING','catalogVersion',5,
    'mode','ON_SITE','reason','Exact same canonical painting service identity.', 'categoryId',v_first);
 v_need_digest:=private.disposable_bind_classification_review(
    'NEED_SERVICE','10000000-0000-4000-8000-000000000002',v_need_plan);
 v_need:=public.rpc_taxonomy_prepare_admission_service(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '20000000-0000-4000-8000-000000000002',
  'NEED_SERVICE','10000000-0000-4000-8000-000000000002',
  v_need_plan
 );
 PERFORM set_config('test.auth_uid','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
 INSERT INTO private.ai_task_review_commands(review_id,account_id,client_request_id,state)
 VALUES('10000000-0000-4000-8000-000000000002',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','20000000-0000-4000-8000-000000000002','ACCEPTED');
 PERFORM public.rpc_taxonomy_approve_admission(
 (v_need->>'admissionId')::uuid,v_need->>'planDigest',v_need_digest);
 IF (public.rpc_taxonomy_commit_admission_service((v_need->>'admissionId')::uuid)->>'categoryId')<>v_first::text
 THEN RAISE EXCEPTION 'WORKER_NEED_ID_DIVERGED'; END IF;
 -- Alias/competency authority cannot be minted by admission.
 IF EXISTS(SELECT 1 FROM private.work_taxonomy_worker_capabilities)
  OR EXISTS(SELECT 1 FROM private.work_taxonomy_relations)
  OR EXISTS(SELECT 1 FROM private.work_taxonomy_need_snapshots) THEN
  RAISE EXCEPTION 'CATALOG_ADMISSION_GRANTED_MATCHING_RIGHTS'; END IF;
 -- No public role may write plan or commit unilaterally.
 IF has_function_privilege('anon',
  'public.rpc_taxonomy_prepare_admission_service(uuid,uuid,text,uuid,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.rpc_taxonomy_commit_admission_service(uuid)','EXECUTE')
 OR has_function_privilege('service_role',
  'public.rpc_taxonomy_approve_admission(uuid,text,text)','EXECUTE') THEN
  RAISE EXCEPTION 'AUTHORIZATION_BYPASS'; END IF;
 RAISE NOTICE 'OWNER_APPROVED_CATALOG_ADMISSION_DISPOSABLE_PASS';
END $test$;
