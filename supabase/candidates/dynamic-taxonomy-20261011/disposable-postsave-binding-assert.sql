-- Proof: default OFF, owner+service-only, exact signed worker Save, no push,
-- idempotent backlog scan, and isolated REVIEW_REQUIRED for forged receipt.
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
DO $test$
DECLARE v jsonb;v_again jsonb;
BEGIN
 v:=public.rpc_taxonomy_bind_ready_reviews_service(3);
 IF v->>'kind'<>'BINDING_DISABLED' OR v->>'bound'<>'0'
 THEN RAISE EXCEPTION 'BINDING_WAS_NOT_DEFAULT_OFF'; END IF;
 IF EXISTS(SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1)
 THEN RAISE EXCEPTION 'BINDING_GRANTED_BEFORE_FLAG'; END IF;
 PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
 BEGIN
  PERFORM public.rpc_taxonomy_bind_ready_reviews_service(3);
  RAISE EXCEPTION 'USER_CALLED_PRIVILEGED_BINDING';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 UPDATE private.work_taxonomy_binding_control_v1 SET enabled=true WHERE singleton;
 v:=public.rpc_taxonomy_bind_ready_reviews_service(3);
 IF v->>'kind'<>'BINDING_ONLY_TICK' OR v->>'claimed'<>'1'
 OR v->>'bound'<>'1' OR v->>'notificationAuthority'<>'NONE'
 OR v->>'dispatchAuthority'<>'NONE'
 OR (SELECT binding_state FROM private.work_taxonomy_review_outbox_v1
   WHERE id='aaaa0000-0000-4000-8000-000000000001')<>'BOUND'
 OR (SELECT count(*) FROM private.taxonomy_confirmed_worker_modes_v1 WHERE active)<>2
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_worker_capabilities
   WHERE excluded OR allow_related_offers)
 THEN RAISE EXCEPTION 'POSTSAVE_WORKER_BINDING_FAILED'; END IF;
 v_again:=public.rpc_taxonomy_bind_ready_reviews_service(3);
 IF v_again->>'claimed'<>'0' OR
  (SELECT count(*) FROM private.work_taxonomy_worker_bindings_v1)<>1
 THEN RAISE EXCEPTION 'POSTSAVE_BINDING_IDEMPOTENCE_FAILED'; END IF;
 INSERT INTO private.work_taxonomy_review_outbox_v1
 (id,owner_account_id,request_key,source_review_id,purpose,state) VALUES(
 'aaaa0000-0000-4000-8000-000000000002',
 '11111111-1111-4111-8111-111111111111',
 '66666666-6666-4666-8666-666666666666',
 '44444444-4444-4444-8444-444444444444',
 'WORKER_CAPABILITY','COMMITTED');
 v:=public.rpc_taxonomy_bind_ready_reviews_service(3);
 IF v->>'claimed'<>'1' OR v->>'reviewRequired'<>'1'
 OR (SELECT binding_state FROM private.work_taxonomy_review_outbox_v1
     WHERE id='aaaa0000-0000-4000-8000-000000000002')<>'REVIEW_REQUIRED'
 OR (SELECT count(*) FROM private.taxonomy_confirmed_worker_modes_v1 WHERE active)<>2
 THEN RAISE EXCEPTION 'FORGED_POSTSAVE_RECEIPT_NOT_ISOLATED'; END IF;
 RAISE NOTICE 'POSTSAVE_WORKER_BINDING_PG_PASS';
END $test$;
