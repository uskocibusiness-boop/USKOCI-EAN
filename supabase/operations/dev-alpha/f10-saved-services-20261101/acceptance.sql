-- F10 no-row acceptance fragment inside the reviewed migration transaction.
-- No profile/review/capability records are inserted or returned.
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE authenticated;
DO $auth$ BEGIN
 BEGIN PERFORM public.rpc_get_worker_execution_modes(NULL);
  RAISE EXCEPTION 'F10_EXPECTED_AUTH_REQUIRED';
 EXCEPTION WHEN SQLSTATE '28000' THEN IF SQLERRM<>'AUTH_REQUIRED' THEN RAISE; END IF; END;
END $auth$;
SELECT set_config('request.jwt.claim.sub','00000000-0010-4010-8010-000000000999',true);
DO $owner$ BEGIN
 BEGIN PERFORM public.rpc_get_worker_execution_modes(NULL);
  RAISE EXCEPTION 'F10_EXPECTED_OWNER_DENIAL';
 EXCEPTION WHEN SQLSTATE '42501' THEN IF SQLERRM<>'WORKER_PROFILE_NOT_OWNED' THEN RAISE; END IF; END;
END $owner$;
RESET ROLE;
-- Execute the exact new projection against the actual relation schema with no
-- names and NULL ownership/profile keys. No real account is selected or returned.
DO $empty_projection$
DECLARE v_profile public.app_profiles;v_account uuid:=NULL;p_worker_profile_id uuid:=NULL;
 v_modes text[]:=NULL;v_at timestamptz:=NULL;v_services jsonb;
BEGIN v_profile.skills:=ARRAY[]::text[];
 WITH names AS (
  SELECT skill AS service,private.taxonomy_normalize_v1(skill) AS service_key,min(ord) AS ord
  FROM unnest(v_profile.skills) WITH ORDINALITY n(skill,ord) GROUP BY skill
 ), latest AS (
  -- A malformed/newer Save must not silently fall back to an older review.
  SELECT s.* FROM private.worker_ai_saves s
  WHERE s.account_id=v_account AND s.receipt->>'profileId'=p_worker_profile_id::text
  ORDER BY s.created_at DESC,s.review_id DESC LIMIT 1
 ), saved AS (
  SELECT s.*,r.envelope FROM private.worker_ai_saves s
  JOIN private.worker_ai_reviews r ON r.id=s.review_id AND r.account_id=s.account_id
  WHERE s.account_id=v_account AND s.receipt->>'profileId'=p_worker_profile_id::text
   AND (s.review_id IN (SELECT review_id FROM latest) OR EXISTS(
    SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m WHERE m.worker_account_id=v_account
     AND m.active AND m.source_review_id=s.review_id AND m.source_request_key=s.client_request_id))
   AND s.receipt->>'accountId'=v_account::text AND s.receipt->>'reviewId'=r.id::text
   AND s.receipt->'saved'='true'::jsonb AND s.receipt->'authoritative'='true'::jsonb
   AND r.envelope->>'profileId'=p_worker_profile_id::text AND r.envelope->>'accountId'=v_account::text
   AND r.envelope->>'reviewId'=r.id::text AND r.envelope->'canAccept'='true'::jsonb
   AND r.created_at<=s.created_at AND s.created_at<=r.expires_at
   AND r.envelope->>'displayedContentDigest'=encode(extensions.digest(
     ((r.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',r.base_hash))::text,'sha256'),'hex')
 ), current_saved AS (
  SELECT s.* FROM saved s JOIN latest l ON l.review_id=s.review_id
  WHERE NOT EXISTS(SELECT 1 FROM private.worker_ai_saves tie WHERE tie.account_id=v_account
   AND tie.receipt->>'profileId'=p_worker_profile_id::text AND tie.created_at=s.created_at AND tie.review_id<>s.review_id)
 ), requested AS (
  SELECT n.service,m.value->>'mode' AS mode,
   CASE WHEN m.value->>'mode'='REMOTE' AND private.taxonomy_handoff_valid_v1(plan.value->'handoff')
    THEN plan.value->'handoff' ELSE NULL END AS handoff,
   s.review_id,s.client_request_id
  FROM names n JOIN current_saved s ON s.envelope#>'{profile,skills}' @> jsonb_build_array(n.service)
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.envelope->'reviewedServiceModes')='array'
   THEN s.envelope->'reviewedServiceModes' ELSE '[]'::jsonb END) m(value)
  LEFT JOIN LATERAL (SELECT p.value FROM jsonb_array_elements(CASE
   WHEN jsonb_typeof(s.envelope->'classificationCandidates')='array' THEN s.envelope->'classificationCandidates'
   ELSE '[]'::jsonb END) p(value) WHERE p.value->>'service'=n.service AND p.value->>'mode'=m.value->>'mode'
   LIMIT 1) plan ON true
  WHERE m.value->>'service'=n.service AND m.value->>'mode' IN ('ON_SITE','REMOTE')
   AND (SELECT count(*) FROM names same WHERE same.service_key=n.service_key)=1
   AND (SELECT count(*) FROM jsonb_array_elements(s.envelope->'reviewedServiceModes') duplicate
    WHERE duplicate->>'service'=n.service AND duplicate->>'mode'=m.value->>'mode')=1
 ), bound AS (
  -- Per-service survival is independent of newer unrelated edits. Current mode
  -- and capability rows remain the authority; a pending addition cannot erase them.
  SELECT n.service,m.execution_scope AS mode,m.handoff
  FROM names n JOIN private.work_taxonomy_categories c ON c.state='ESTABLISHED'
   AND (c.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
    WHERE a.category_id=c.id AND a.normalized_key=n.service_key))
  JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
  JOIN private.taxonomy_confirmed_worker_modes_v1 m ON m.category_id=c.id AND m.execution_scope=cm.execution_scope
   AND m.worker_account_id=v_account AND m.active
  JOIN private.work_taxonomy_worker_capabilities cap ON cap.category_id=c.id AND cap.worker_account_id=v_account
   AND NOT cap.excluded AND cap.origin='WORKER_CONFIRMED' AND cap.confirmed_at=m.confirmed_at AND cap.updated_at<=m.confirmed_at
  JOIN saved s ON s.review_id=m.source_review_id AND s.client_request_id=m.source_request_key
   AND s.envelope->>'classificationState'='READY'
  JOIN private.work_taxonomy_worker_bindings_v1 b ON b.owner_account_id=v_account
   AND b.profile_id=p_worker_profile_id AND b.source_review_id=s.review_id AND b.request_key=s.client_request_id
   AND b.bound_at=m.confirmed_at AND b.bound_at>=s.created_at
   AND b.result->>'status'='BOUND_WORKER_SERVICES' AND b.result->>'workerProfileId'=p_worker_profile_id::text
  JOIN private.work_taxonomy_review_batches_v1 batch ON batch.owner_account_id=v_account
   AND batch.source_review_id=s.review_id AND batch.request_key=s.client_request_id AND batch.purpose='WORKER_CAPABILITY'
   AND batch.result->>'status'='COMMITTED' AND batch.result->'requiresBinding'='true'::jsonb
   AND batch.catalog_version=b.catalog_version AND batch.plans=s.envelope->'classificationCandidates'
   AND batch.review_digest=s.envelope->>'displayedContentDigest'
   AND jsonb_typeof(batch.plans)='array' AND jsonb_typeof(batch.result->'items')='array'
   AND b.result->'serviceModeCount'=to_jsonb(jsonb_array_length(batch.plans))
   AND jsonb_array_length(batch.result->'items')=jsonb_array_length(batch.plans)
   AND jsonb_array_length(s.envelope->'reviewedServiceModes')=jsonb_array_length(batch.plans)
  WHERE m.execution_scope IN ('ON_SITE','REMOTE')
   AND v_at IS NOT NULL AND m.execution_scope=ANY(v_modes)
   AND s.envelope#>'{profile,skills}' @> jsonb_build_array(n.service)
   AND s.envelope->'reviewedServiceModes' @> jsonb_build_array(jsonb_build_object('service',n.service,'mode',m.execution_scope))
   AND batch.result->'items' @> jsonb_build_array(jsonb_build_object('service',n.service,'mode',m.execution_scope,'categoryId',c.id::text))
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) plan WHERE plan->>'service'=n.service
    AND plan->>'mode'=m.execution_scope AND (plan->'handoff') IS NOT DISTINCT FROM m.handoff)
   AND (m.handoff IS NULL OR (m.execution_scope='REMOTE' AND private.taxonomy_handoff_valid_v1(m.handoff)))
   AND (SELECT count(*) FROM names same WHERE same.service_key=n.service_key)=1
   AND (SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
    AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
     WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=1
 ), mode_rows AS (
  SELECT b.service,b.mode,'CONFIRMED'::text AS status,b.handoff FROM bound b
  UNION ALL
  SELECT r.service,r.mode,CASE WHEN EXISTS(SELECT 1 FROM private.work_taxonomy_worker_bindings_v1 b
   WHERE b.owner_account_id=v_account AND b.profile_id=p_worker_profile_id
    AND b.source_review_id=r.review_id AND b.request_key=r.client_request_id)
   THEN 'UNCONFIRMED' ELSE 'PENDING' END,r.handoff
  FROM requested r WHERE NOT EXISTS(SELECT 1 FROM bound b WHERE b.service=r.service AND b.mode=r.mode
   AND b.handoff IS NOT DISTINCT FROM r.handoff)
 ), projected AS (
  SELECT n.service,n.ord,coalesce((SELECT jsonb_agg(jsonb_build_object('mode',m.mode,'status',m.status,'handoff',m.handoff)
   ORDER BY m.mode,m.status) FROM mode_rows m WHERE m.service=n.service),'[]'::jsonb) AS modes,
   CASE WHEN EXISTS(SELECT 1 FROM mode_rows m WHERE m.service=n.service AND m.status='PENDING') THEN 'PENDING'
    WHEN EXISTS(SELECT 1 FROM mode_rows m WHERE m.service=n.service AND m.status='UNCONFIRMED') THEN 'UNCONFIRMED'
    WHEN EXISTS(SELECT 1 FROM mode_rows m WHERE m.service=n.service AND m.status='CONFIRMED') THEN 'CONFIRMED'
    WHEN EXISTS(SELECT 1 FROM current_saved s WHERE s.envelope#>'{profile,skills}' @> jsonb_build_array(n.service)
     AND s.envelope->>'classificationState' IN ('PENDING_CLASSIFICATION','SERVICE_MODE_CONFIRMATION_REQUIRED',
      'REVIEW_REQUIRED','CATALOG_UNAVAILABLE','STALE_CATALOG')) THEN 'PENDING'
    ELSE 'UNCONFIRMED' END AS status
  FROM names n
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('service',service,'modes',modes,'status',status) ORDER BY ord),'[]'::jsonb)
 INTO v_services FROM projected;

 IF v_services IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'F10_EMPTY_PROJECTION_INVALID'; END IF;
END $empty_projection$;
