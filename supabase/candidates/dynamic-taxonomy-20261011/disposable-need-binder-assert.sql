SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
DO $proof$
DECLARE v jsonb;
BEGIN
 -- Authentication cannot be substituted by guessed owner UUID.
 PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
 BEGIN
   PERFORM public.rpc_taxonomy_bind_reviewed_need_service(
     '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222',
     '44444444-4444-4444-8444-444444444444',
     '55555555-5555-4555-8555-555555555555',4);
   RAISE EXCEPTION 'UNAUTHORIZED_BINDER_EXECUTED';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 -- Never process a Need after its accepted revision has changed.
 BEGIN
   UPDATE public.needs SET revision=5;
   PERFORM public.rpc_taxonomy_bind_reviewed_need_service(
     '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222',
     '44444444-4444-4444-8444-444444444444',
     '55555555-5555-4555-8555-555555555555',4);
   RAISE EXCEPTION 'STALE_NEED_REVISION_BOUND';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 -- An ON_SITE receipt cannot bind a Need that now requires REMOTE.
 BEGIN
   UPDATE public.needs SET execution_location_mode='REMOTE';
   PERFORM public.rpc_taxonomy_bind_reviewed_need_service(
     '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222',
     '44444444-4444-4444-8444-444444444444',
     '55555555-5555-4555-8555-555555555555',4);
   RAISE EXCEPTION 'WRONG_EXECUTION_MODE_BOUND';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 -- Existing but wrong canonical ID is never overwritten.
 BEGIN
   UPDATE public.needs SET category_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
   PERFORM public.rpc_taxonomy_bind_reviewed_need_service(
     '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222',
     '44444444-4444-4444-8444-444444444444',
     '55555555-5555-4555-8555-555555555555',4);
   RAISE EXCEPTION 'EXISTING_CATEGORY_OVERWRITTEN';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 -- A previous owner resolution for the same revision needs manual review.
 BEGIN
   INSERT INTO private.work_taxonomy_need_snapshots(
    need_id,need_revision,category_id,catalog_version,reviewed_by_requester,
    source,classification_state,original_category)
   VALUES('55555555-5555-4555-8555-555555555555',4,
     'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',9,true,
     'REQUESTER_CORRECTED','CONFIRMED','Krečenje zidova');
   PERFORM public.rpc_taxonomy_bind_reviewed_need_service(
     '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222',
     '44444444-4444-4444-8444-444444444444',
     '55555555-5555-4555-8555-555555555555',4);
   RAISE EXCEPTION 'EXISTING_SNAPSHOT_OVERWRITTEN';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 -- A non-accepted save command must not bind or dispatch anything.
 BEGIN
   UPDATE private.ai_task_review_commands SET state='UNKNOWN_OUTCOME';
   PERFORM public.rpc_taxonomy_bind_reviewed_need_service(
     '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222',
     '44444444-4444-4444-8444-444444444444',
     '55555555-5555-4555-8555-555555555555',4);
   RAISE EXCEPTION 'UNCONFIRMED_ACCEPTANCE_BOUND';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 -- The signed review digest is immutable; a different one must fail.
 BEGIN
   UPDATE private.ai_task_reviews
     SET envelope=jsonb_set(envelope,'{classificationState}','"REVIEW_REQUIRED"');
   PERFORM public.rpc_taxonomy_bind_reviewed_need_service(
     '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222',
     '44444444-4444-4444-8444-444444444444',
     '55555555-5555-4555-8555-555555555555',4);
   RAISE EXCEPTION 'MUTATED_REVIEW_ACCEPTED';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 IF EXISTS(SELECT 1 FROM private.work_taxonomy_need_snapshots)
   OR EXISTS(SELECT 1 FROM private.work_taxonomy_need_bindings_v1)
   OR EXISTS(SELECT 1 FROM public.needs WHERE category_id IS NOT NULL)
 THEN RAISE EXCEPTION 'NEGATIVE_BINDING_CASE_LEFT_RESIDUE'; END IF;
 -- The owner may select candidates shortly after publishing, before the
 -- asynchronous signed Need binder runs. The exact same saved revision must
 -- still be eligible in SELECTION; the fixture rolls back this canary entirely.
 BEGIN
   UPDATE public.needs SET status='SELECTION';
   v:=public.rpc_taxonomy_bind_reviewed_need_service(
     '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222',
     '44444444-4444-4444-8444-444444444444',
     '55555555-5555-4555-8555-555555555555',4);
   IF v->>'status'<>'BOUND_NEED_REVISION' OR
      (SELECT count(*) FROM private.work_taxonomy_need_snapshots
        WHERE classification_state='CONFIRMED' AND reviewed_by_requester)<>1
   THEN RAISE EXCEPTION 'SELECTION_SIGNED_NEED_NOT_BOUND'; END IF;
   RAISE EXCEPTION USING ERRCODE='UD777',MESSAGE='EXPECTED_SELECTION_CANARY_ROLLBACK';
 EXCEPTION WHEN SQLSTATE 'UD777' THEN NULL; END;
 v:=public.rpc_taxonomy_bind_reviewed_need_service(
   '11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   '44444444-4444-4444-8444-444444444444',
   '55555555-5555-4555-8555-555555555555',4);
 IF v->>'status'<>'BOUND_NEED_REVISION' OR
    v->>'notificationAuthority'<>'NONE' OR
    v->>'dispatchAuthority'<>'NONE' THEN
   RAISE EXCEPTION 'BINDER_RETURNED_UNSAFE_RECEIPT: %',v; END IF;
 IF (SELECT category_id FROM public.needs WHERE id='55555555-5555-4555-8555-555555555555')
     IS DISTINCT FROM 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid OR
    (SELECT revision FROM public.needs WHERE id='55555555-5555-4555-8555-555555555555')<>4 OR
    (SELECT count(*) FROM private.work_taxonomy_need_snapshots
       WHERE classification_state='CONFIRMED' AND reviewed_by_requester
         AND source='OWNER_REVIEWED_BATCH')<>1 OR
    (SELECT count(*) FROM private.work_taxonomy_need_bindings_v1)<>1 THEN
   RAISE EXCEPTION 'ATOMIC_NEED_BINDING_FAILED'; END IF;
 -- Identical retry returns the first durable receipt without duplicate write.
 IF public.rpc_taxonomy_bind_reviewed_need_service(
   '11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   '44444444-4444-4444-8444-444444444444',
   '55555555-5555-4555-8555-555555555555',4) IS DISTINCT FROM v THEN
   RAISE EXCEPTION 'BINDER_REPLAY_INCONSISTENT';END IF;
 IF (SELECT count(*) FROM private.work_taxonomy_need_snapshots)<>1
    OR (SELECT count(*) FROM private.work_taxonomy_need_bindings_v1)<>1 THEN
   RAISE EXCEPTION 'BINDER_DUPLICATE_REPLAY'; END IF;
 BEGIN
   PERFORM public.rpc_taxonomy_bind_reviewed_need_service(
   '11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   '44444444-4444-4444-8444-444444444444',
   '55555555-5555-4555-8555-555555555555',5);
   RAISE EXCEPTION 'BINDER_REPLAY_DIFFERENT_REVISION_ACCEPTED';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
END $proof$;
DO $grants$
BEGIN
 IF has_function_privilege('anon',
   'public.rpc_taxonomy_bind_reviewed_need_service(uuid,uuid,uuid,uuid,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
   'public.rpc_taxonomy_bind_reviewed_need_service(uuid,uuid,uuid,uuid,integer)','EXECUTE')
 OR has_table_privilege('authenticated','private.work_taxonomy_need_bindings_v1','SELECT')
 THEN RAISE EXCEPTION 'NEED_BINDER_PRIVILEGE_EXPOSED'; END IF;
END $grants$;
