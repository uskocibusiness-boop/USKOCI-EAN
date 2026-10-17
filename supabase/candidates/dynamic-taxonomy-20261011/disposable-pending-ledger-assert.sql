\set ON_ERROR_STOP on
DO $test$
DECLARE
 a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 r1 uuid:='10000000-0000-4000-8000-000000000001';
 r2 uuid:='10000000-0000-4000-8000-000000000002';
 r3 uuid:='10000000-0000-4000-8000-000000000003';
 r4 uuid:='10000000-0000-4000-8000-000000000004';
 r5 uuid:='10000000-0000-4000-8000-000000000005';
 r6 uuid:='10000000-0000-4000-8000-000000000006';
 r7 uuid:='10000000-0000-4000-8000-000000000007';
BEGIN
 INSERT INTO private.worker_ai_reviews VALUES
 (r1,a,jsonb_build_object('canAccept',true,'classificationState','PENDING_CLASSIFICATION','displayedContentDigest',repeat('a',64))),
 (r3,a,jsonb_build_object('canAccept',true,'classificationState','READY','displayedContentDigest',repeat('a',64))),
 (r4,a,jsonb_build_object('canAccept',true,'displayedContentDigest',repeat('a',64))),
 (r5,a,jsonb_build_object('canAccept',false,'classificationState','PENDING_CLASSIFICATION','displayedContentDigest',repeat('a',64))),
 (r6,a,jsonb_build_object('canAccept',true,'classificationState','REVIEW_REQUIRED','displayedContentDigest',repeat('a',64)));
 INSERT INTO private.ai_task_reviews VALUES
 (r2,b,jsonb_build_object('canAccept',true,'classificationState','SERVICE_MODE_CONFIRMATION_REQUIRED','displayedContentDigest',repeat('b',64))),
 (r7,b,jsonb_build_object('canAccept',true,'classificationState','CATALOG_UNAVAILABLE','displayedContentDigest',repeat('b',64)));
 -- Flag OFF: an actual recorded Save remains authoritative without new side effects.
 INSERT INTO private.worker_ai_saves VALUES
 (r1,a,'20000000-0000-4000-8000-000000000001',statement_timestamp());
 IF EXISTS(SELECT 1 FROM private.work_taxonomy_pending_reviews_v1) OR
   private.taxonomy_reconcile_pending_reviews_v1(50)<>0 THEN
   RAISE EXCEPTION 'LEDGER_OFF_NOT_INERT'; END IF;
 UPDATE private.work_taxonomy_pending_control_v1 SET enabled=true WHERE singleton;
 INSERT INTO private.ai_task_review_commands VALUES
 (r2,b,'20000000-0000-4000-8000-000000000002','ACCEPTED',statement_timestamp());
 INSERT INTO private.worker_ai_saves VALUES
 (r6,a,'20000000-0000-4000-8000-000000000006',statement_timestamp()),
 (r3,a,'20000000-0000-4000-8000-000000000003',statement_timestamp()),
 (r4,a,'20000000-0000-4000-8000-000000000004',statement_timestamp()),
 (r5,a,'20000000-0000-4000-8000-000000000005',statement_timestamp()),
 (r1,b,'20000000-0000-4000-8000-000000000008',statement_timestamp());
 -- Only an accepted need may be recorded, including an UPDATE into accepted.
 INSERT INTO private.ai_task_review_commands VALUES
 (r7,b,'20000000-0000-4000-8000-000000000007','DRAFT',statement_timestamp());
 UPDATE private.ai_task_review_commands SET state='ACCEPTED' WHERE review_id=r7;
 UPDATE private.ai_task_review_commands SET state='PUBLISHED' WHERE review_id=r7;
 IF (SELECT count(*) FROM private.work_taxonomy_pending_reviews_v1)<>3 THEN
  RAISE EXCEPTION 'LEDGER_WRONG_TRIGGER_COUNT'; END IF;
 -- Recovery reconstructs the missed authorized Save without user interaction.
 IF private.taxonomy_reconcile_pending_reviews_v1(50)<>1 OR
   private.taxonomy_reconcile_pending_reviews_v1(50)<>0 THEN
  RAISE EXCEPTION 'LEDGER_RECOVERY_NOT_IDEMPOTENT'; END IF;
 IF (SELECT count(*) FROM private.work_taxonomy_pending_reviews_v1)<>4
 OR (SELECT count(*) FROM private.work_taxonomy_pending_reviews_v1 WHERE purpose='WORKER_CAPABILITY')<>2
 OR (SELECT count(*) FROM private.work_taxonomy_pending_reviews_v1 WHERE purpose='NEED_SERVICE')<>2
 OR (SELECT count(*) FROM private.work_taxonomy_pending_reviews_v1 WHERE resolution_state='OPEN')<>4
 THEN RAISE EXCEPTION 'LEDGER_LOST_SIGNED_SAVES'; END IF;
 -- No raw profile text, capabilities, dispatch, publicly readable state or RPC.
 IF to_regclass('private.work_taxonomy_categories') IS NOT NULL
 OR to_regclass('public.notification_deliveries') IS NOT NULL
 OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='private'
   AND table_name='work_taxonomy_pending_reviews_v1'
   AND column_name IN('service','skills','bio','location','category_id','notification_authority'))
 OR has_table_privilege('authenticated','private.work_taxonomy_pending_reviews_v1','SELECT')
 OR has_table_privilege('anon','private.work_taxonomy_pending_reviews_v1','SELECT')
 OR has_table_privilege('service_role','private.work_taxonomy_pending_reviews_v1','SELECT')
 OR has_function_privilege('authenticated','private.taxonomy_reconcile_pending_reviews_v1(integer)','EXECUTE')
 OR has_function_privilege('anon','private.taxonomy_reconcile_pending_reviews_v1(integer)','EXECUTE')
 THEN RAISE EXCEPTION 'LEDGER_AUTHORITY_LEAK'; END IF;
 BEGIN
  PERFORM private.taxonomy_reconcile_pending_reviews_v1(201);
  RAISE EXCEPTION 'LEDGER_LIMIT_BYPASS';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'PENDING_LEDGER_LIMIT_INVALID' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'SIGNED_SAVE_PENDING_LEDGER_PASS';
END $test$;