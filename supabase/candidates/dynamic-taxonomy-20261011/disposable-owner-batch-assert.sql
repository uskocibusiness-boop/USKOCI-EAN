-- Run AFTER disposable-owner-admission-negative-assert.sql and batch fixture.
-- All transactions and accounts are disposable; no DEV write.
\set ON_ERROR_STOP on
DO $batch_proof$
DECLARE
 v_parent uuid;v_existing uuid;v_version bigint;
 v_worker_plans jsonb;v_need_plans jsonb;v_bad jsonb;
 v_result jsonb;v_replay jsonb;v_created uuid;v_mismatch uuid;
 v_review_id uuid;v_req uuid;
BEGIN
 SELECT id INTO STRICT v_parent FROM private.work_taxonomy_categories WHERE label='Molerski radovi';
 SELECT id INTO STRICT v_existing FROM private.work_taxonomy_categories WHERE label='Krečenje zidova';
 SELECT catalog_version INTO v_version FROM private.work_taxonomy_control WHERE singleton;
 IF v_version<>5 THEN RAISE EXCEPTION 'BATCH_BAD_START_VERSION'; END IF;

 v_worker_plans:=jsonb_build_array(
 jsonb_build_object('action','REUSE_EXISTING','service','Krečenje zidova','mode','ON_SITE',
  'categoryId',v_existing,'catalogVersion',5,'reason','Clearly reviewed interior wall painting service'),
 jsonb_build_object('action','CREATE_CHILD','service','Krečenje plafona','mode','ON_SITE',
  'parentId',v_parent,'path',jsonb_build_array('Krečenje plafona'),'catalogVersion',5,
  'reason','Clearly reviewed interior ceiling painting service'),
 jsonb_build_object('action','CREATE_CHILD','service','Krečenje ograda','mode','ON_SITE',
  'parentId',v_parent,'path',jsonb_build_array('Krečenje ograda'),'catalogVersion',5,
  'reason','Clearly reviewed exterior fence painting service')
 );
 PERFORM private.disposable_sign_batch_review(
  'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000007',v_worker_plans,
  '["Krečenje zidova","Krečenje plafona","Krečenje ograda"]'::jsonb,
  '[{"service":"Krečenje zidova","mode":"ON_SITE"},
    {"service":"Krečenje plafona","mode":"ON_SITE"},
    {"service":"Krečenje ograda","mode":"ON_SITE"}]'::jsonb);
 BEGIN
  PERFORM public.rpc_taxonomy_commit_reviewed_batch_service(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000007',
  'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000007',v_worker_plans);
  RAISE EXCEPTION 'BATCH_ACCEPTED_WITHOUT_USER_SAVE';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'BATCH_EXISTING_USER_SAVE_REQUIRED' THEN RAISE; END IF;
 END;
 INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id)
 VALUES('10000000-0000-4000-8000-000000000007',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000007');
 v_result:=public.rpc_taxonomy_commit_reviewed_batch_service(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000007',
  'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000007',v_worker_plans);
 v_replay:=public.rpc_taxonomy_commit_reviewed_batch_service(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000007',
  'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000007',v_worker_plans);
 IF v_result IS DISTINCT FROM v_replay OR (v_result->>'createdCount')::int<>2
 OR jsonb_array_length(v_result->'items')<>3
 OR (v_result->>'catalogVersion')::int<>7
 OR v_result->>'capabilityAuthority'<>'NONE'
 OR v_result->>'notificationAuthority'<>'NONE'
 OR v_result->>'needRevisionAuthority'<>'NONE'
 THEN RAISE EXCEPTION 'BATCH_ATOMIC_RECEIPT_INVALID'; END IF;
 IF (SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)<>7
 OR (SELECT count(*) FROM private.work_taxonomy_audit
     WHERE source_ref='REVIEWED_BATCH_V1:20000000-0000-4000-8000-000000000007')<>2
 OR (SELECT count(*) FROM private.work_taxonomy_categories
     WHERE label IN ('Krečenje plafona','Krečenje ograda'))<>2
 THEN RAISE EXCEPTION 'BATCH_PARTIAL_OR_MISSING_CATALOG'; END IF;
 v_created:=(v_result#>>'{items,1,categoryId}')::uuid;

 -- REVERSE identity: a requester who asks for the reviewed service later
 -- must reuse the EXACT canonical ID without creating a second category.
 v_need_plans:=jsonb_build_array(jsonb_build_object('action','REUSE_EXISTING',
  'service','Krečenje plafona','mode','ON_SITE','categoryId',v_created,
  'catalogVersion',7,'reason','Same exact ceiling painting work requested'));
 PERFORM private.disposable_sign_batch_review(
  'NEED_SERVICE','10000000-0000-4000-8000-000000000008',v_need_plans,
  '["Krečenje plafona"]'::jsonb,'[]'::jsonb,'STATIONARY');
 INSERT INTO private.ai_task_review_commands(review_id,account_id,client_request_id,state)
 VALUES('10000000-0000-4000-8000-000000000008',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','20000000-0000-4000-8000-000000000008','ACCEPTED');
 v_result:=public.rpc_taxonomy_commit_reviewed_batch_service(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','20000000-0000-4000-8000-000000000008',
  'NEED_SERVICE','10000000-0000-4000-8000-000000000008',v_need_plans);
 IF (v_result->>'createdCount')::int<>0 OR
    v_result#>>'{items,0,categoryId}' IS DISTINCT FROM v_created::text
 THEN RAISE EXCEPTION 'BATCH_WORKER_NEED_ID_DIVERGENCE'; END IF;
 IF (SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)<>7
 THEN RAISE EXCEPTION 'BATCH_REUSE_CHANGED_CATALOG'; END IF;

 -- Negative A: second item in same batch asks unsupported REMOTE scope.
 -- First item would create a valid new category, but the whole call rolls back.
 v_bad:=jsonb_build_array(
 jsonb_build_object('action','CREATE_CHILD','service','Krečenje stepenica',
  'mode','ON_SITE','parentId',v_parent,'path',jsonb_build_array('Krečenje stepenica'),
  'catalogVersion',7,'reason','Worker reviewed specific interior staircase painting'),
 jsonb_build_object('action','REUSE_EXISTING','service','Krečenje zidova',
  'mode','REMOTE','categoryId',v_existing,'catalogVersion',7,
  'reason','Cannot automatically claim remote on-site service'));
 PERFORM private.disposable_sign_batch_review(
  'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000009',v_bad,
  '["Krečenje stepenica","Krečenje zidova"]'::jsonb,
  '[{"service":"Krečenje stepenica","mode":"ON_SITE"},
    {"service":"Krečenje zidova","mode":"REMOTE"}]'::jsonb);
 INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id)
 VALUES('10000000-0000-4000-8000-000000000009',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000009');
 BEGIN
  PERFORM public.rpc_taxonomy_commit_reviewed_batch_service(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000009',
   'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000009',v_bad);
  RAISE EXCEPTION 'BATCH_PARTIAL_FAILURE_NOT_ROLLED_BACK';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'BATCH_CATEGORY_OR_MODE_MISSING' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM private.work_taxonomy_categories WHERE label='Krečenje stepenica')
 OR (SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)<>7
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_review_batches_v1
           WHERE source_review_id='10000000-0000-4000-8000-000000000009')
 THEN RAISE EXCEPTION 'BATCH_ATOMIC_ROLLBACK_FAILED'; END IF;

 -- Negative B: two user labels mapping to the same canonical ID cannot
 -- manufacture two distinct capabilities (synonym and name).
 v_bad:=jsonb_build_array(
 jsonb_build_object('action','REUSE_EXISTING','service','Krečenje zidova',
  'mode','ON_SITE','categoryId',v_existing,'catalogVersion',7,
  'reason','Known service under its canonical label'),
 jsonb_build_object('action','REUSE_EXISTING','service','Zidno krečenje',
  'mode','ON_SITE','categoryId',v_existing,'catalogVersion',7,
  'reason','Same underlying work under a different name'));
 PERFORM private.disposable_sign_batch_review(
 'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000010',v_bad,
 '["Krečenje zidova","Zidno krečenje"]'::jsonb,
 '[{"service":"Krečenje zidova","mode":"ON_SITE"},
   {"service":"Zidno krečenje","mode":"ON_SITE"}]'::jsonb);
 INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id)
 VALUES('10000000-0000-4000-8000-000000000010',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000010');
 BEGIN
  PERFORM public.rpc_taxonomy_commit_reviewed_batch_service(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000010',
  'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000010',v_bad);
  RAISE EXCEPTION 'BATCH_DUPLICATE_CANONICAL_WAS_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'BATCH_DUPLICATE_CANONICAL_ID' THEN RAISE; END IF;
 END;

 -- Negative C: new canonical leaf cannot diverge from displayed service.
 v_bad:=jsonb_build_array(jsonb_build_object(
  'action','CREATE_CHILD','service','Krečenje ograda','mode','ON_SITE',
  'parentId',v_parent,'path',jsonb_build_array('Krečenje vrata'),
  'catalogVersion',7,'reason','Model chose a different service than user requested'));
 PERFORM private.disposable_sign_batch_review(
  'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000011',v_bad,
  '["Krečenje ograda"]'::jsonb,
  '[{"service":"Krečenje ograda","mode":"ON_SITE"}]'::jsonb);
 INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id)
 VALUES('10000000-0000-4000-8000-000000000011',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000011');
 BEGIN
  PERFORM public.rpc_taxonomy_commit_reviewed_batch_service(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000011',
  'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000011',v_bad);
  RAISE EXCEPTION 'BATCH_WRONG_SEMANTIC_LEAF_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'BATCH_SERVICE_LEAF_MISMATCH' THEN RAISE; END IF;
 END;

 -- Negative D: stale unversioned legacy insert AFTER the review was signed.
 v_need_plans:=jsonb_build_array(jsonb_build_object(
  'action','REUSE_EXISTING','service','Krečenje plafona','mode','ON_SITE',
  'categoryId',v_created,'catalogVersion',7,
  'reason','Already reviewed same painting work after cache snapshot'));
 PERFORM private.disposable_sign_batch_review(
  'NEED_SERVICE','10000000-0000-4000-8000-000000000012',v_need_plans,
  '["Krečenje plafona"]'::jsonb,'[]'::jsonb,'STATIONARY');
 INSERT INTO private.ai_task_review_commands(review_id,account_id,client_request_id,state)
 VALUES('10000000-0000-4000-8000-000000000012',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','20000000-0000-4000-8000-000000000012','ACCEPTED');
 INSERT INTO private.work_taxonomy_categories(canonical_key,label,parent_id,state,source,catalog_version)
 VALUES(private.taxonomy_normalize_v1('Novi zanat van verzije'), 'Novi zanat van verzije',
 v_parent,'ESTABLISHED','SYSTEM',7);
 BEGIN
  PERFORM public.rpc_taxonomy_commit_reviewed_batch_service(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','20000000-0000-4000-8000-000000000012',
  'NEED_SERVICE','10000000-0000-4000-8000-000000000012',v_need_plans);
  RAISE EXCEPTION 'BATCH_LEGACY_UNVERSIONED_WRITE_NOT_CAUGHT';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'BATCH_STALE_CATALOG' THEN RAISE; END IF;
 END;
 -- Old completed request is idempotent even after later unrelated catalog change.
 v_replay:=public.rpc_taxonomy_commit_reviewed_batch_service(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000007',
  'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000007',v_worker_plans);
 IF (v_replay->>'createdCount')::int<>2
  THEN RAISE EXCEPTION 'BATCH_OLD_RECEIPT_NOT_REPLAY_SAFE'; END IF;

 IF has_function_privilege('anon',
  'public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)','EXECUTE')
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_worker_capabilities)
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_need_snapshots)
 THEN RAISE EXCEPTION 'BATCH_AUTHORIZATION_OR_MATCHER_BYPASS'; END IF;
 RAISE NOTICE 'REVIEWED_BATCH_V1_ATOMIC_MULTISKILL_DISPOSABLE_PASS';
END $batch_proof$;
