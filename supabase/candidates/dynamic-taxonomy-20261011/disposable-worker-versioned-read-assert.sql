-- Verify that old worker APKs never see new signed fields, while
-- opt-in new clients read the exact matching classification review+Save.
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $proof$
DECLARE v_new uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 v_old uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 v_legacy jsonb;v_signed jsonb;
BEGIN
 v_legacy:=private.worker_ai_document(v_new);
 v_signed:=public.rpc_read_worker_ai_taxonomy(v_new);
 IF v_legacy->'review'<>'null'::jsonb
   OR v_legacy->'saved'<>'null'::jsonb
   OR v_legacy->>'status'<>'COMPLETED'
   OR v_signed#>>'{review,classificationState}'<>'READY'
   OR v_signed#>>'{saved,reviewId}'<>'33333333-3333-4333-8333-333333333333'
 THEN RAISE EXCEPTION 'OLD_CLIENT_SEES_CLASSIFIED_OR_NEW_CLIENT_LOSES_SAVE'; END IF;
 v_legacy:=private.worker_ai_document(v_old);
 v_signed:=public.rpc_read_worker_ai_taxonomy(v_old);
 IF v_legacy IS DISTINCT FROM v_signed
    OR v_legacy#>>'{review,reviewId}'<>'44444444-4444-4444-8444-444444444444'
    OR v_legacy#>>'{saved,reviewId}'<>'44444444-4444-4444-8444-444444444444'
 THEN RAISE EXCEPTION 'LEGACY_WORKER_REVIEW_REGRESSED'; END IF;
 -- Even with simultaneous old/new review objects in one conversation,
 -- neither API can leak the other schema or approve an unseen plan.
 INSERT INTO private.worker_ai_reviews VALUES(
  '55555555-5555-4555-8555-555555555555',
  '11111111-1111-4111-8111-111111111111',v_new,
  '{"reviewId":"55555555-5555-4555-8555-555555555555"}'::jsonb,
  statement_timestamp()+interval '1 second');
 v_legacy:=private.worker_ai_document(v_new);
 v_signed:=public.rpc_read_worker_ai_taxonomy(v_new);
 IF v_legacy#>>'{review,reviewId}'<>'55555555-5555-4555-8555-555555555555'
   OR v_legacy->'saved'<>'null'::jsonb
   OR v_signed#>>'{review,reviewId}'<>'33333333-3333-4333-8333-333333333333'
   OR v_signed#>>'{saved,reviewId}'<>'33333333-3333-4333-8333-333333333333'
 THEN RAISE EXCEPTION 'MIXED_REVIEW_SCHEMA_CROSSED'; END IF;
 PERFORM set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
 BEGIN
   PERFORM public.rpc_read_worker_ai_taxonomy(v_new);
   RAISE EXCEPTION 'FOREIGN_USER_READ_SIGNED_REVIEW';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 RAISE NOTICE 'WORKER_VERSIONED_READER_LEGACY_APK_SAFE_PASS';
END $proof$;
