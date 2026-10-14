-- Disposable PG16/17 only. Must never run in DEV/PROD.
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
DO $proof$
DECLARE
 v_owner uuid:='11111111-1111-4111-8111-111111111111';
 v_profile uuid:='22222222-2222-4222-8222-222222222222';
 v_review uuid:='44444444-4444-4444-8444-444444444444';
 v_key uuid:='55555555-5555-4555-8555-555555555555';
 v_result jsonb;v_again jsonb;
BEGIN
 -- Neither batch admission nor a signed review alone may grant capability.
 IF EXISTS(SELECT 1 FROM private.work_taxonomy_worker_capabilities
   WHERE NOT excluded OR (excluded=false AND allow_related_offers))
 THEN RAISE EXCEPTION 'BINDER_GRANTED_CAPABILITY_BEFORE_SAVE'; END IF;
 PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
 BEGIN
  PERFORM public.rpc_taxonomy_bind_reviewed_worker_service(v_owner,v_key,v_review,v_profile);
  RAISE EXCEPTION 'ORDINARY_AUTHENTICATED_USER_BOUND_WORKER';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 v_result:=public.rpc_taxonomy_bind_reviewed_worker_service(v_owner,v_key,v_review,v_profile);
 v_again:=public.rpc_taxonomy_bind_reviewed_worker_service(v_owner,v_key,v_review,v_profile);
 IF v_result IS DISTINCT FROM v_again
  OR v_result->>'status'<>'BOUND_WORKER_SERVICES'
  OR v_result->>'serviceModeCount'<>'2'
  OR v_result->>'notificationAuthority'<>'NONE'
  OR v_result->>'dispatchAuthority'<>'NONE'
  OR v_result->>'relatedOfferAuthority'<>'NONE'
 THEN RAISE EXCEPTION 'WORKER_BINDER_RECEIPT_INVALID'; END IF;
 IF (SELECT count(*) FROM private.work_taxonomy_worker_capabilities WHERE NOT excluded)<>1
   OR (SELECT count(*) FROM private.taxonomy_confirmed_worker_modes_v1 WHERE active)<>2
   OR EXISTS(SELECT 1 FROM private.work_taxonomy_worker_capabilities
      WHERE worker_account_id=v_owner AND (excluded OR allow_related_offers))
   OR (SELECT count(*) FROM private.work_taxonomy_worker_bindings_v1)<>1
   OR (SELECT modes FROM private.worker_execution_mode_choices WHERE worker_profile_id=v_profile)
      IS DISTINCT FROM ARRAY['ON_SITE','REMOTE']::text[]
 THEN RAISE EXCEPTION 'WORKER_BINDER_ATOMIC_SCOPE_MISMATCH'; END IF;
 BEGIN
   PERFORM public.rpc_taxonomy_bind_reviewed_worker_service(
    v_owner,v_key,'77777777-7777-4777-8777-777777777777',v_profile);
   RAISE EXCEPTION 'REPLAY_REVIEW_KEY_CONFLICT_ACCEPTED';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
END $proof$;

-- A later edit or withdrawal makes a once-reviewed profile stale: the binder
-- cannot bind an older review to updated or removed skills, even if the user
-- still has the same account. Generate a NEW signed review/receipt and batch.
INSERT INTO private.worker_ai_reviews(id,account_id,envelope,base_hash,expires_at)
SELECT '88888888-8888-4888-8888-888888888888',account_id,
 (v||jsonb_build_object('displayedContentDigest',
   encode(extensions.digest((v||jsonb_build_object('baseHash',base_hash))::text,'sha256'),'hex'))),
 base_hash,clock_timestamp()+interval '20 minutes'
FROM(
 SELECT account_id,base_hash,
 jsonb_set(envelope-'displayedContentDigest','{reviewId}',
   '"88888888-8888-4888-8888-888888888888"'::jsonb) v
 FROM private.worker_ai_reviews
 WHERE id='44444444-4444-4444-8444-444444444444'
) review2;
INSERT INTO private.worker_ai_saves VALUES(
 '88888888-8888-4888-8888-888888888888',
 '11111111-1111-4111-8111-111111111111',
 '99999999-9999-4999-8999-999999999999',
 clock_timestamp()-interval '1 minute',
 '{"saved":true,"profileId":"22222222-2222-4222-8222-222222222222","profileStatus":"ACTIVE"}'::jsonb);
INSERT INTO private.work_taxonomy_review_batches_v1(
 owner_account_id,request_key,source_review_id,purpose,review_digest,
 plans,catalog_version,result)
SELECT '11111111-1111-4111-8111-111111111111',
 '99999999-9999-4999-8999-999999999999',
 '88888888-8888-4888-8888-888888888888',
 'WORKER_CAPABILITY',envelope->>'displayedContentDigest',
 envelope->'classificationCandidates',3,
 jsonb_build_object('status','COMMITTED','requiresBinding',true,
 'capabilityAuthority','NONE','notificationAuthority','NONE',
 'items',jsonb_build_array(
  jsonb_build_object('service','Casovi matematike','mode','ON_SITE','categoryId','33333333-3333-4333-8333-333333333333'),
  jsonb_build_object('service','Casovi matematike','mode','REMOTE','categoryId','33333333-3333-4333-8333-333333333333')))
FROM private.worker_ai_reviews WHERE id='88888888-8888-4888-8888-888888888888';
DO $negative$
DECLARE
 v_owner uuid:='11111111-1111-4111-8111-111111111111';
 v_profile uuid:='22222222-2222-4222-8222-222222222222';
 v_review uuid:='88888888-8888-4888-8888-888888888888';
 v_key uuid:='99999999-9999-4999-8999-999999999999';
BEGIN
 -- Even an EXACT skill name edited after Save invalidates old review.
 UPDATE public.app_profiles SET updated_at=clock_timestamp() WHERE id=v_profile;
 BEGIN
   PERFORM public.rpc_taxonomy_bind_reviewed_worker_service(v_owner,v_key,v_review,v_profile);
   RAISE EXCEPTION 'LATE_BINDER_AFTER_PROFILE_EDIT_ACCEPTED';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 -- Different current skills are never treated as validated by semantic overlap.
 UPDATE public.app_profiles SET skills=ARRAY['Popravka telefona'],updated_at=clock_timestamp()-interval '3 minutes'
 WHERE id=v_profile;
 BEGIN
   PERFORM public.rpc_taxonomy_bind_reviewed_worker_service(v_owner,v_key,v_review,v_profile);
   RAISE EXCEPTION 'REMOVED_SKILL_WAS_BOUND';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 -- Even if the worker's profile looks identical, a NEWER signed Save
 -- makes a delayed binder from the older Save ineligible to reactivate modes.
 INSERT INTO private.worker_ai_saves VALUES(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',v_owner,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',clock_timestamp()+interval '1 minute',
  jsonb_build_object('saved',true,'profileId',v_profile,'profileStatus','ACTIVE'));
 BEGIN
   PERFORM public.rpc_taxonomy_bind_reviewed_worker_service(v_owner,v_key,v_review,v_profile);
   RAISE EXCEPTION 'NEWER_WORKER_SAVE_DID_NOT_FENCE_OLD_BINDER';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 DELETE FROM private.worker_ai_saves WHERE review_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 -- Restore the original skills and timing, then alter signed review: digest fails.
 UPDATE public.app_profiles SET skills=ARRAY['Casovi matematike'],updated_at=clock_timestamp()-interval '3 minutes'
 WHERE id=v_profile;
 UPDATE private.worker_ai_reviews
 SET envelope=jsonb_set(envelope,'{reviewedServiceModes,0,mode}','"REMOTE"'::jsonb)
 WHERE id=v_review;
 BEGIN
   PERFORM public.rpc_taxonomy_bind_reviewed_worker_service(v_owner,v_key,v_review,v_profile);
   RAISE EXCEPTION 'TAMPERED_DIGEST_BOUND';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 -- The original successful permission remains source-reviewed, not modified.
 IF (SELECT count(*) FROM private.work_taxonomy_worker_bindings_v1)<>1
   OR (SELECT count(*) FROM private.taxonomy_confirmed_worker_modes_v1 WHERE active)<>2
 THEN RAISE EXCEPTION 'FAILED_BINDER_MUTATED_EXISTING_PERMISSIONS'; END IF;
END $negative$;
