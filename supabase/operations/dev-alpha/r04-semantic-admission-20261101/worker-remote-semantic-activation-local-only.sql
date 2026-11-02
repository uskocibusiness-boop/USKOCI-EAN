-- R04/R08 durable cityless REMOTE eligibility for an already bound synonym.
-- LOCAL_ONLY SOURCE CANDIDATE. NOT A MIGRATION OR AUTHORIZATION FOR DEV/PROD.
-- Replace only the existing private helper; retain its owner, ACL, INVOKER
-- security and public callers (complete profile, submit response, select response).
-- The current exact canonical/registered-alias branch remains unchanged.
-- A new branch may resolve an unregistered spelling only from an existing
-- owner-signed Save + COMMITTED batch + BOUND_WORKER_SERVICES, with active
-- capability/mode rows. It never grants, revives or writes a capability.
-- A later unrelated Save does not revoke an independently confirmed service:
-- current skills, excluded/active flags and binding timestamps remain decisive.
-- Include this body only in a reviewed preimage/ACL/closure/rollback package.
CREATE OR REPLACE FUNCTION private.worker_remote_only_activation_ready_v1(p_account uuid,p_skills text[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'pg_catalog' AS $function$
DECLARE v_skill text;v_norm text;v_category uuid;v_matches bigint;v_profile uuid;
BEGIN
 IF p_account IS NULL OR p_skills IS NULL OR cardinality(p_skills)=0 THEN RETURN false; END IF;
 SELECT id INTO v_profile FROM public.app_profiles
 WHERE account_id=p_account AND kind='WORKER' AND skills=p_skills;
 IF v_profile IS NULL THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m
   JOIN private.work_taxonomy_worker_capabilities cap
    ON cap.worker_account_id=m.worker_account_id AND cap.category_id=m.category_id
   WHERE m.worker_account_id=p_account AND m.active
    AND cap.excluded IS FALSE AND m.execution_scope IS DISTINCT FROM 'REMOTE')
 THEN RETURN false; END IF;
 FOREACH v_skill IN ARRAY p_skills LOOP
  IF v_skill IS NULL OR char_length(btrim(v_skill)) NOT BETWEEN 3 AND 120 THEN RETURN false; END IF;
  v_norm:=private.taxonomy_normalize_v1(v_skill);
  IF v_norm IS NULL OR v_norm='' THEN RETURN false; END IF;
  SELECT count(DISTINCT c.id),min(c.id::text)::uuid INTO v_matches,v_category
  FROM private.work_taxonomy_categories c
  WHERE c.state='ESTABLISHED' AND
    (c.canonical_key=v_norm OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
      WHERE a.category_id=c.id AND a.normalized_key=v_norm));

  IF v_matches=0 THEN
   -- No spelling authority exists. Resolve only the same service/mode at the
   -- same ordinal in the immutable reviewed plan and its committed result.
   -- Existing/ambiguous canonical or alias matches cannot take this fallback.
   SELECT count(*),min(c.id::text)::uuid INTO v_matches,v_category
   FROM private.work_taxonomy_worker_capabilities cap
   JOIN private.taxonomy_confirmed_worker_modes_v1 m
    ON m.worker_account_id=cap.worker_account_id AND m.category_id=cap.category_id
   JOIN private.work_taxonomy_categories c ON c.id=cap.category_id
   JOIN private.work_taxonomy_category_modes cm
    ON cm.category_id=m.category_id AND cm.execution_scope=m.execution_scope
   JOIN private.worker_ai_saves saved
    ON saved.account_id=m.worker_account_id AND saved.review_id=m.source_review_id
    AND saved.client_request_id=m.source_request_key
   JOIN private.worker_ai_reviews review
    ON review.id=saved.review_id AND review.account_id=saved.account_id
   JOIN private.work_taxonomy_worker_bindings_v1 binding
    ON binding.owner_account_id=saved.account_id AND binding.source_review_id=saved.review_id
    AND binding.request_key=saved.client_request_id AND binding.profile_id=v_profile
   JOIN private.work_taxonomy_review_batches_v1 batch
    ON batch.owner_account_id=saved.account_id AND batch.source_review_id=saved.review_id
    AND batch.request_key=saved.client_request_id AND batch.purpose='WORKER_CAPABILITY'
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(batch.plans)='array'
     THEN batch.plans ELSE '[]'::jsonb END) WITH ORDINALITY plan(value,ord)
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(batch.result->'items')='array'
     THEN batch.result->'items' ELSE '[]'::jsonb END) WITH ORDINALITY item(value,ord)
   WHERE cap.worker_account_id=p_account
    AND cap.excluded IS FALSE AND cap.origin='WORKER_CONFIRMED'
    AND m.active IS TRUE AND m.execution_scope='REMOTE'
    AND m.confirmed_at=cap.confirmed_at AND m.confirmed_at=binding.bound_at
    AND binding.result->>'status'='BOUND_WORKER_SERVICES'
    AND binding.result->>'workerProfileId'=v_profile::text
    AND binding.bound_at>=saved.created_at
    AND saved.receipt->>'accountId'=p_account::text
    AND saved.receipt->>'reviewId'=review.id::text
    AND saved.receipt->>'profileId'=v_profile::text
    AND saved.receipt->>'profileStatus'='ACTIVE'
    AND saved.receipt->'saved'='true'::jsonb AND saved.receipt->'authoritative'='true'::jsonb
    AND review.envelope->>'accountId'=p_account::text
    AND review.envelope->>'reviewId'=review.id::text
    AND review.envelope->>'profileId'=v_profile::text
    AND review.envelope->>'classificationState'='READY'
    AND review.envelope->'canAccept'='true'::jsonb
    AND review.created_at<=saved.created_at AND saved.created_at<=review.expires_at
    AND review.envelope->>'displayedContentDigest'=encode(extensions.digest(
      ((review.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',review.base_hash))::text,
      'sha256'),'hex')
    AND batch.review_digest=review.envelope->>'displayedContentDigest'
    AND batch.plans=review.envelope->'classificationCandidates'
    AND batch.plans_digest=encode(extensions.digest(convert_to(batch.plans::text,'UTF8'),'sha256'),'hex')
    AND batch.result->>'status'='COMMITTED' AND batch.result->'requiresBinding'='true'::jsonb
    AND batch.result->>'capabilityAuthority'='NONE'
    AND batch.result->>'notificationAuthority'='NONE'
    AND batch.catalog_version=binding.catalog_version
    AND jsonb_array_length(CASE WHEN jsonb_typeof(batch.plans)='array'
      THEN batch.plans ELSE '[]'::jsonb END) BETWEEN 1 AND 24
    AND binding.result->'serviceModeCount'=to_jsonb(jsonb_array_length(CASE
      WHEN jsonb_typeof(batch.plans)='array' THEN batch.plans ELSE '[]'::jsonb END))
    AND jsonb_array_length(CASE WHEN jsonb_typeof(batch.result->'items')='array'
      THEN batch.result->'items' ELSE '[]'::jsonb END)=jsonb_array_length(CASE
      WHEN jsonb_typeof(batch.plans)='array' THEN batch.plans ELSE '[]'::jsonb END)
    AND jsonb_array_length(CASE WHEN jsonb_typeof(review.envelope->'reviewedServiceModes')='array'
      THEN review.envelope->'reviewedServiceModes' ELSE '[]'::jsonb END)=jsonb_array_length(CASE
      WHEN jsonb_typeof(batch.plans)='array' THEN batch.plans ELSE '[]'::jsonb END)
    AND (SELECT count(*) FROM jsonb_array_elements_text(CASE
      WHEN jsonb_typeof(review.envelope#>'{profile,skills}')='array'
      THEN review.envelope#>'{profile,skills}' ELSE '[]'::jsonb END) skill(value)
      WHERE private.taxonomy_normalize_v1(skill.value)=v_norm)=1
    AND (SELECT count(*) FROM jsonb_array_elements(CASE
      WHEN jsonb_typeof(review.envelope->'reviewedServiceModes')='array'
      THEN review.envelope->'reviewedServiceModes' ELSE '[]'::jsonb END) selected(value)
      WHERE private.taxonomy_normalize_v1(selected.value->>'service')=v_norm
        AND selected.value->>'mode'='REMOTE')=1
    AND plan.ord=item.ord AND plan.value->>'action' IN ('REUSE_EXISTING','EXTEND_MODE')
    AND plan.value->>'mode'='REMOTE' AND item.value->>'mode'='REMOTE'
    AND private.taxonomy_normalize_v1(plan.value->>'service')=v_norm
    AND private.taxonomy_normalize_v1(item.value->>'service')=v_norm
    AND plan.value->>'categoryId'=c.id::text AND item.value->>'categoryId'=c.id::text
    AND (plan.value->'handoff') IS NOT DISTINCT FROM m.handoff
    AND (NOT(plan.value?'handoff') OR private.taxonomy_handoff_valid_v1(plan.value->'handoff') IS TRUE)
    AND jsonb_typeof(plan.value->'categoryLabel')='string'
    AND plan.value?'categoryParentId'
    AND c.state='ESTABLISHED' AND c.label IS NOT DISTINCT FROM plan.value->>'categoryLabel'
    AND coalesce(to_jsonb(c.parent_id),'null'::jsonb) IS NOT DISTINCT FROM plan.value->'categoryParentId'
    AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
      WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
    AND private.taxonomy_category_path_valid_v1(c.id);
  END IF;

  IF v_matches<>1 OR v_category IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (
   SELECT 1 FROM private.work_taxonomy_worker_capabilities cap
   JOIN private.taxonomy_confirmed_worker_modes_v1 m
    ON m.worker_account_id=cap.worker_account_id AND m.category_id=cap.category_id
   JOIN private.work_taxonomy_category_modes cm
    ON cm.category_id=m.category_id AND cm.execution_scope=m.execution_scope
   JOIN private.worker_ai_saves saved
    ON saved.account_id=m.worker_account_id AND saved.review_id=m.source_review_id
    AND saved.client_request_id=m.source_request_key
   JOIN private.work_taxonomy_worker_bindings_v1 binding
    ON binding.owner_account_id=saved.account_id AND binding.source_review_id=saved.review_id
    AND binding.request_key=saved.client_request_id AND binding.profile_id=v_profile
   WHERE cap.worker_account_id=p_account AND cap.category_id=v_category
    AND cap.excluded IS FALSE AND cap.origin='WORKER_CONFIRMED'
    AND m.active IS TRUE AND m.execution_scope='REMOTE'
    AND m.confirmed_at=cap.confirmed_at AND m.confirmed_at=binding.bound_at
    AND binding.result->>'status'='BOUND_WORKER_SERVICES'
    AND saved.receipt->>'profileId'=v_profile::text
    AND saved.receipt->>'profileStatus'='ACTIVE'
    AND saved.receipt->'saved'='true'::jsonb AND saved.receipt->'authoritative'='true'::jsonb
  ) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END; $function$;
