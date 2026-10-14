-- Disposable PG: saved while review valid stays eligible after delayed worker tick.
\set ON_ERROR_STOP on
DO $review_expiry$
DECLARE v_catalog integer;v_id uuid;v_plan jsonb;v_answer jsonb;
BEGIN
 SELECT catalog_version INTO STRICT v_catalog FROM private.work_taxonomy_control WHERE singleton;
 SELECT id INTO STRICT v_id FROM private.work_taxonomy_categories WHERE label='Krečenje plafona';
 v_plan:=jsonb_build_array(jsonb_build_object(
  'action','REUSE_EXISTING','service','Krečenje plafona','mode','ON_SITE',
  'categoryId',v_id,'catalogVersion',v_catalog,
  'reason','Previously saved request has reviewed ceiling painting category'));

 INSERT INTO private.ai_task_reviews(id,account_id,envelope,expires_at)
 VALUES('10000000-0000-4000-8000-000000000018',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '{"canAccept":true}'::jsonb,statement_timestamp()+interval '2 hours');
 PERFORM private.disposable_sign_batch_review(
  'NEED_SERVICE','10000000-0000-4000-8000-000000000018',v_plan,
  '["Krečenje plafona"]'::jsonb,'[]'::jsonb,'STATIONARY');
 INSERT INTO private.ai_task_review_commands(review_id,account_id,client_request_id,state)
 VALUES('10000000-0000-4000-8000-000000000018',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '20000000-0000-4000-8000-000000000018','ACCEPTED');
 -- Simulate the passage of time WITHOUT changing saved receipt or review digest.
 UPDATE private.ai_task_reviews
  SET expires_at=statement_timestamp()-interval '1 minute'
 WHERE id='10000000-0000-4000-8000-000000000018';
 v_answer:=public.rpc_taxonomy_commit_reviewed_batch_service(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','20000000-0000-4000-8000-000000000018',
  'NEED_SERVICE','10000000-0000-4000-8000-000000000018',v_plan);
 IF v_answer->>'status'<>'COMMITTED' OR (v_answer->>'createdCount')::int<>0
 THEN RAISE EXCEPTION 'DELAYED_SAVED_REVIEW_WAS_LOST'; END IF;

 INSERT INTO private.ai_task_reviews(id,account_id,envelope,expires_at)
 VALUES('10000000-0000-4000-8000-000000000019',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '{"canAccept":true}'::jsonb,statement_timestamp()+interval '2 hours');
 PERFORM private.disposable_sign_batch_review(
  'NEED_SERVICE','10000000-0000-4000-8000-000000000019',v_plan,
  '["Krečenje plafona"]'::jsonb,'[]'::jsonb,'STATIONARY');
 UPDATE private.ai_task_reviews SET expires_at=statement_timestamp()-interval '1 minute'
  WHERE id='10000000-0000-4000-8000-000000000019';
 INSERT INTO private.ai_task_review_commands(review_id,account_id,client_request_id,state)
 VALUES('10000000-0000-4000-8000-000000000019',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '20000000-0000-4000-8000-000000000019','ACCEPTED');
 BEGIN
  PERFORM public.rpc_taxonomy_commit_reviewed_batch_service(
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','20000000-0000-4000-8000-000000000019',
   'NEED_SERVICE','10000000-0000-4000-8000-000000000019',v_plan);
  RAISE EXCEPTION 'EXPIRED_AT_SAVE_INCORRECTLY_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'BATCH_REVIEW_NOT_BOUND' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'POSTSAVE_DELAYED_REVIEW_EXPIRY_DISPOSABLE_PASS';
END $review_expiry$;
