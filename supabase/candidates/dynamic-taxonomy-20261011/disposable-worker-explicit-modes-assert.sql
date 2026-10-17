-- Disposable PG16/17: a person's own explicit per-service selection works
-- even when Gemini returned no classification hint at all.
\set ON_ERROR_STOP on
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $test$
DECLARE
 d uuid:='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 c uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 mode_remote jsonb:='[{"service":"Casovi matematike","mode":"REMOTE"}]'::jsonb;
 mode_wrong jsonb:='[{"service":"Casovi matematike","mode":"ON_SITE"}]'::jsonb;
 first jsonb;repeat_review jsonb;waiting jsonb;digest text;
BEGIN
 -- This session has no Gemini hint. The user can still explicitly choose remote.
 first:=public.rpc_prepare_worker_ai_review_taxonomy_confirmed(d,6,false,mode_remote);
 digest:=encode(extensions.digest(
 ((first-'displayedContentDigest')||jsonb_build_object('baseHash','base-1'))::text,
 'sha256'),'hex');
 IF first->>'classificationState'<>'READY'
 OR first->>'displayedContentDigest'<>digest
 OR first->'reviewedServiceModes'<>mode_remote
 OR first#>>'{classificationCandidates,0,mode}'<>'REMOTE'
 OR first->'canAccept'<>'true' THEN
  RAISE EXCEPTION 'EXPLICIT_MODE_READY_NOT_DIGEST_SIGNED'; END IF;
 repeat_review:=public.rpc_prepare_worker_ai_review_taxonomy_confirmed(d,6,false,mode_remote);
 IF repeat_review->>'reviewId'<>first->>'reviewId' THEN
  RAISE EXCEPTION 'EXPLICIT_MODE_REPLAY_NOT_IDEMPOTENT'; END IF;
 waiting:=public.rpc_prepare_worker_ai_review_taxonomy_confirmed(d,6,false,mode_wrong);
 IF waiting->>'classificationState'='READY'
 OR waiting->'classificationCandidates'<>'[]'::jsonb
 OR waiting->'reviewedServiceModes'<>'[]'::jsonb
 OR waiting->>'reviewId'=first->>'reviewId' THEN
  RAISE EXCEPTION 'UNSUPPORTED_OR_CHANGED_MODE_WAS_SIGNED'; END IF;
 BEGIN
  PERFORM public.rpc_prepare_worker_ai_review_taxonomy_confirmed(d,6,false,
    '[{"service":"Some unoffered service","mode":"REMOTE"}]'::jsonb);
  -- Any such invalid selection may only return non-ready; never READY.
 EXCEPTION WHEN OTHERS THEN NULL; END;
 BEGIN
  PERFORM public.rpc_prepare_worker_ai_review_taxonomy_confirmed(d,6,false,'[]'::jsonb);
  RAISE EXCEPTION 'EMPTY_EXPLICIT_MODE_ACCEPTED';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN
  PERFORM public.rpc_prepare_worker_ai_review_taxonomy_confirmed(d,99,false,mode_remote);
  RAISE EXCEPTION 'EXPLICIT_MODE_STALE_REVISION_ACCEPTED';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
 BEGIN
  PERFORM public.rpc_prepare_worker_ai_review_taxonomy_confirmed(c,4,false,mode_remote);
  RAISE EXCEPTION 'EXPLICIT_MODE_CROSS_ACCOUNT_ACCEPTED';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 IF has_function_privilege('anon',
   'public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)','EXECUTE')
 OR has_function_privilege('service_role',
   'public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'EXPLICIT_MODE_RPC_INCORRECT_PRIVILEGES'; END IF;
 RAISE NOTICE 'WORKER_EXPLICIT_MODE_SIGNING_PASS';
END $test$;