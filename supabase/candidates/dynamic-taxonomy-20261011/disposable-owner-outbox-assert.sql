-- Disposable proof of hidden post-save taxonomy outbox. No actual device/worker.
\set ON_ERROR_STOP on
INSERT INTO private.worker_ai_reviews(id,account_id,envelope,expires_at)
VALUES
('10000000-0000-4000-8000-000000000013','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"canAccept":true}'::jsonb,now()+interval '2 hours'),
('10000000-0000-4000-8000-000000000015','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"canAccept":true}'::jsonb,now()+interval '2 hours'),
('10000000-0000-4000-8000-000000000016','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"canAccept":true}'::jsonb,now()+interval '2 hours');
INSERT INTO private.ai_task_reviews(id,account_id,envelope,expires_at)
VALUES('10000000-0000-4000-8000-000000000014',
'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"canAccept":true}'::jsonb,now()+interval '2 hours');

DO $outbox_proof$
DECLARE v_service uuid;v_need uuid;v_version bigint;
 v_worker jsonb;v_need_plan jsonb;v_claim jsonb;v_entry jsonb;
 v_a jsonb;v_b jsonb;v_worker_id uuid;v_need_id uuid;v_token uuid;v_again jsonb;
BEGIN
 SELECT id INTO STRICT v_service FROM private.work_taxonomy_categories WHERE label='Krečenje zidova';
 SELECT id INTO STRICT v_need FROM private.work_taxonomy_categories WHERE label='Krečenje plafona';
 SELECT catalog_version INTO STRICT v_version FROM private.work_taxonomy_control WHERE singleton;
 v_worker:=jsonb_build_array(jsonb_build_object(
  'service','Krečenje zidova','mode','ON_SITE','action','REUSE_EXISTING',
  'categoryId',v_service,'catalogVersion',v_version,
  'reason','Worker has reviewed this exact wall-painting service'));
 v_need_plan:=jsonb_build_array(jsonb_build_object(
  'service','Krečenje plafona','mode','ON_SITE','action','REUSE_EXISTING',
  'categoryId',v_need,'catalogVersion',v_version,
  'reason','Requester reviewed this ceiling-painting need'));

 PERFORM private.disposable_sign_batch_review(
  'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000015',v_worker,
  '["Krečenje zidova"]'::jsonb,
  '[{"service":"Krečenje zidova","mode":"ON_SITE"}]'::jsonb);
 -- Feature flag OFF: the ordinary confirmed save is not blocked or changed.
 INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id)
 VALUES('10000000-0000-4000-8000-000000000015',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000015');
 IF EXISTS(SELECT 1 FROM private.work_taxonomy_review_outbox_v1)
 THEN RAISE EXCEPTION 'OUTBOX_DISABLED_STILL_ENQUEUED'; END IF;

 PERFORM private.disposable_sign_batch_review(
  'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000013',v_worker,
  '["Krečenje zidova"]'::jsonb,
  '[{"service":"Krečenje zidova","mode":"ON_SITE"}]'::jsonb);
 PERFORM private.disposable_sign_batch_review(
  'NEED_SERVICE','10000000-0000-4000-8000-000000000014',v_need_plan,
  '["Krečenje plafona"]'::jsonb,'[]'::jsonb,'STATIONARY');
 UPDATE private.work_taxonomy_review_outbox_control_v1 SET enabled=true WHERE singleton;
 INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id)
 VALUES('10000000-0000-4000-8000-000000000013',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000013');
 INSERT INTO private.ai_task_review_commands(review_id,account_id,client_request_id,state)
 VALUES('10000000-0000-4000-8000-000000000014',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','20000000-0000-4000-8000-000000000014','ACCEPTED');
 IF (SELECT count(*) FROM private.work_taxonomy_review_outbox_v1 WHERE state='PENDING')<>2
 THEN RAISE EXCEPTION 'POST_SAVE_OUTBOX_NOT_AUTOMATIC'; END IF;
 IF (SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)<>v_version
 THEN RAISE EXCEPTION 'ENQUEUE_MUTATED_CATALOG'; END IF;

 v_claim:=public.rpc_taxonomy_claim_reviewed_batches_service(5);
 IF jsonb_array_length(v_claim)<>2 OR
  (SELECT count(*) FROM private.work_taxonomy_review_outbox_v1 WHERE state='CLAIMED')<>2
 THEN RAISE EXCEPTION 'LEASE_CLAIM_NOT_BOUNDED'; END IF;
 FOR v_entry IN SELECT value FROM jsonb_array_elements(v_claim) LOOP
  IF v_entry->>'purpose'='WORKER_CAPABILITY' THEN v_a:=v_entry; ELSE v_b:=v_entry; END IF;
 END LOOP;
 IF v_a IS NULL OR v_b IS NULL THEN RAISE EXCEPTION 'CLAIM_WRONG_PURPOSE'; END IF;
 BEGIN
  PERFORM public.rpc_taxonomy_finalize_reviewed_batch_service(
   (v_a->>'id')::uuid,(v_a->>'leaseToken')::uuid,NULL);
  RAISE EXCEPTION 'OUTBOX_FALSE_SUCCESS';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'OUTBOX_COMMIT_RECEIPT_MISSING' THEN RAISE; END IF;
 END;
 PERFORM public.rpc_taxonomy_commit_reviewed_batch_service(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000013',
 'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000013',v_worker);
 PERFORM public.rpc_taxonomy_commit_reviewed_batch_service(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','20000000-0000-4000-8000-000000000014',
 'NEED_SERVICE','10000000-0000-4000-8000-000000000014',v_need_plan);
 BEGIN
  PERFORM public.rpc_taxonomy_finalize_reviewed_batch_service(
   (v_b->>'id')::uuid,'44444444-4444-4444-8444-444444444444',NULL);
  RAISE EXCEPTION 'OUTBOX_WRONG_LEASE_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'OUTBOX_STALE_LEASE' THEN RAISE; END IF;
 END;
 PERFORM public.rpc_taxonomy_finalize_reviewed_batch_service(
  (v_a->>'id')::uuid,(v_a->>'leaseToken')::uuid,NULL);
 PERFORM public.rpc_taxonomy_finalize_reviewed_batch_service(
  (v_b->>'id')::uuid,(v_b->>'leaseToken')::uuid,NULL);
 IF (SELECT count(*) FROM private.work_taxonomy_review_outbox_v1 WHERE state='COMMITTED')<>2
 OR (SELECT count(*) FROM private.work_taxonomy_review_outbox_v1 WHERE state='PENDING')<>0
 THEN RAISE EXCEPTION 'OUTBOX_NOT_SETTLED'; END IF;
 IF (SELECT count(*) FROM private.work_taxonomy_worker_capabilities)<>0
 OR (SELECT count(*) FROM private.work_taxonomy_need_snapshots)<>0
 THEN RAISE EXCEPTION 'OUTBOX_MINTED_CAPABILITY'; END IF;

 -- Retryable service/network failure never discards the saved profile.
 PERFORM private.disposable_sign_batch_review(
  'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000016',v_worker,
  '["Krečenje zidova"]'::jsonb,
  '[{"service":"Krečenje zidova","mode":"ON_SITE"}]'::jsonb);
 INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id)
 VALUES('10000000-0000-4000-8000-000000000016',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','20000000-0000-4000-8000-000000000016');
 v_again:=public.rpc_taxonomy_claim_reviewed_batches_service(1);
 IF jsonb_array_length(v_again)<>1 THEN RAISE EXCEPTION 'OUTBOX_NO_RETRY_CLAIM'; END IF;
 v_entry:=v_again->0;
 PERFORM public.rpc_taxonomy_finalize_reviewed_batch_service(
  (v_entry->>'id')::uuid,(v_entry->>'leaseToken')::uuid,'NETWORK_UNAVAILABLE');
 IF (SELECT count(*) FROM private.work_taxonomy_review_outbox_v1
     WHERE state='RETRY' AND retry_after>statement_timestamp())<>1
 THEN RAISE EXCEPTION 'OUTBOX_NETWORK_RETRY_LOST'; END IF;
 IF jsonb_array_length(public.rpc_taxonomy_claim_reviewed_batches_service(5))<>0
 THEN RAISE EXCEPTION 'OUTBOX_RETRY_BYPASSED_BACKOFF'; END IF;
 IF has_function_privilege('authenticated',
  'public.rpc_taxonomy_claim_reviewed_batches_service(integer)','EXECUTE')
 OR has_function_privilege('anon',
  'public.rpc_taxonomy_finalize_reviewed_batch_service(uuid,uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'OUTBOX_PUBLIC_PRIVILEGE'; END IF;
 RAISE NOTICE 'REVIEWED_POST_SAVE_OUTBOX_V1_DISPOSABLE_PASS';
END $outbox_proof$;
