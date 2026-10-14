-- Real source function under synthetic owner/JWT in PG16/17.
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $proof$
DECLARE
 c uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 d uuid:='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 v jsonb;again jsonb;pending jsonb;computed text;
BEGIN
 IF to_regprocedure('public.rpc_prepare_worker_ai_review(uuid,integer,boolean)') IS NOT NULL
 THEN RAISE EXCEPTION 'SIGNED_RPC_REPLACED_LEGACY_NAME'; END IF;
 v:=public.rpc_prepare_worker_ai_review_taxonomy(c,4,false);
 computed:=encode(extensions.digest(
 ((v-'displayedContentDigest')||jsonb_build_object('baseHash','base-1'))::text,
 'sha256'),'hex');
 IF v->>'classificationState'<>'READY'
   OR v->>'displayedContentDigest' IS DISTINCT FROM computed
   OR v#>>'{reviewedServiceModes,0,mode}'<>'REMOTE'
   OR v#>>'{classificationCandidates,0,service}'<>'Casovi matematike'
   OR v->>'profileId'<>'22222222-2222-4222-8222-222222222222'
   OR v->'canAccept' IS DISTINCT FROM 'true'::jsonb
 THEN RAISE EXCEPTION 'SIGNED_WORKER_REVIEW_INVALID'; END IF;
 again:=public.rpc_prepare_worker_ai_review_taxonomy(c,4,false);
 IF again->>'reviewId'<>v->>'reviewId'
 THEN RAISE EXCEPTION 'SIGNED_WORKER_REVIEW_IDEMPOTENCY_FAILED'; END IF;
 BEGIN
  PERFORM public.rpc_prepare_worker_ai_review_taxonomy(c,99,false);
  RAISE EXCEPTION 'STALE_WORKER_REVISION_ACCEPTED';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 pending:=public.rpc_prepare_worker_ai_review_taxonomy(d,6,false);
 IF pending->>'classificationState'<>'SERVICE_MODE_CONFIRMATION_REQUIRED'
   OR pending->'classificationCandidates'<>'[]'::jsonb
   OR pending->'reviewedServiceModes'<>'[]'::jsonb
   OR pending->'canAccept' IS DISTINCT FROM 'true'::jsonb
 THEN RAISE EXCEPTION 'NO_GEMINI_HINTS_FAKED_WORKER_SKILL_AUTHORITY'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='rpc_prepare_worker_ai_review')
 THEN RAISE EXCEPTION 'LEGACY_REVIEW_OVERWRITTEN'; END IF;
 PERFORM set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
 BEGIN
  PERFORM public.rpc_prepare_worker_ai_review_taxonomy(c,4,false);
  RAISE EXCEPTION 'CROSS_ACCOUNT_SIGNED_REVIEW_ACCEPTED';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 RAISE NOTICE 'WORKER_SIGNED_REVIEW_PG16_17_PASS';
END $proof$;
