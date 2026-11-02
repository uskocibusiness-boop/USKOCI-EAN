-- R08 cityless REMOTE signed service consent, LOCAL_ONLY source candidate.
-- NOT a migration, DEV deployment, authorization bypass or production toggle.
-- Frozen original DEV prosrc MD5 284aa750a1a5c3e6367eaf10df1a410f.
-- A complete current REMOTE review may consent to profile activation before
-- catalog admission. New category/mode still requires its own committed
-- post-Save admission/binding before eligibility. Keep original owner/ACL.
CREATE OR REPLACE FUNCTION private.worker_remote_review_ready_v1(p_review jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_exact jsonb;v_plans jsonb;v_plan jsonb;v_service text;v_seen text[]:=ARRAY[]::text[];v_n integer;v_category uuid;v_projection jsonb;
BEGIN
 IF p_review->>'classificationState' IS DISTINCT FROM 'READY'
 OR jsonb_typeof(p_review#>'{profile,skills}') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_review->'reviewedServiceModes') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_review->'classificationCandidates') IS DISTINCT FROM 'array'
 THEN RETURN false; END IF;
 IF jsonb_array_length(p_review->'reviewedServiceModes') NOT BETWEEN 1 AND 12
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_review->'reviewedServiceModes') m
   WHERE m->>'mode' IS DISTINCT FROM 'REMOTE')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_review->'classificationCandidates') p
   WHERE p?'handoff' AND private.taxonomy_handoff_valid_v1(p->'handoff') IS NOT TRUE)
 THEN RETURN false; END IF;

 -- New catalog work is activation consent only, never an existing capability.
 -- Reuse the exact prepare validator (including source-bound hints and handoff)
 -- instead of introducing a second action/path parser. The Save activation
 -- owner separately checks account/session/revision/digest/expiry atomically.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_review->'classificationCandidates') p
   WHERE p->>'action' IN ('CREATE_CHILD','CREATE_NEW_BRANCH','EXTEND_MODE')) THEN
   IF auth.uid() IS NULL OR p_review->>'accountId' IS DISTINCT FROM auth.uid()::text
     OR jsonb_typeof(p_review->'conversationId') IS DISTINCT FROM 'string'
     OR p_review->>'conversationId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   THEN RETURN false; END IF;
   v_projection:=private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY',
     p_review#>'{profile,skills}',p_review->'reviewedServiceModes',auth.uid(),
     (p_review->>'conversationId')::uuid);
   -- Do not re-read the pre-Save profile context here: the activation owner has
   -- already made its own profile writes. The locked session/hint projection is
   -- still valid; its handoff must match exactly, without inventing or filling it.
   RETURN v_projection->>'status'='READY'
     AND p_review->'classificationCandidates'=v_projection->'classificationCandidates'
     AND p_review->'reviewedServiceModes'=v_projection->'reviewedServiceModes'
     AND p_review->'classificationCatalogVersion'=v_projection->'classificationCatalogVersion'
     AND p_review->'classificationCatalogFingerprint'=v_projection->'classificationCatalogFingerprint';
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_review->'classificationCandidates') p
   WHERE p->>'action' IS DISTINCT FROM 'REUSE_EXISTING') THEN RETURN false; END IF;
 -- Only today's complete exact canonical/registered-alias set. User-selected
 -- modes never admit a future category or extend an existing category's scope.
 v_exact:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
   p_review#>'{profile,skills}',p_review->'reviewedServiceModes');
 SELECT jsonb_agg(p.value-'handoff' ORDER BY p.ord) INTO v_plans
 FROM jsonb_array_elements(p_review->'classificationCandidates') WITH ORDINALITY p(value,ord);
 IF v_exact->>'status'='READY'
   AND p_review->'classificationCatalogVersion'=v_exact->'classificationCatalogVersion'
   AND p_review->'classificationCatalogFingerprint'=v_exact->'classificationCatalogFingerprint'
   AND p_review->'reviewedServiceModes'=v_exact->'reviewedServiceModes'
   AND v_plans=v_exact->'classificationCandidates' THEN RETURN true; END IF;

 -- No additional AI authority: complete current signed READY only.
 -- The caller validates the immutable owner/revision/source/digest/expiry
 -- and this helper rechecks the existing exact leaf ID, REMOTE scope, witness,
 -- consented service set and catalog fingerprint. No new/extended category
 -- or global alias is approved here.
 IF p_review->'classificationCatalogVersion' IS DISTINCT FROM
     (SELECT to_jsonb(catalog_version) FROM private.work_taxonomy_control WHERE singleton)
 OR p_review->>'classificationCatalogFingerprint' IS DISTINCT FROM private.taxonomy_admission_fingerprint_v1()
 OR jsonb_array_length(p_review->'classificationCandidates')
    IS DISTINCT FROM jsonb_array_length(p_review#>'{profile,skills}')
 OR jsonb_array_length(p_review->'reviewedServiceModes')
    IS DISTINCT FROM jsonb_array_length(p_review#>'{profile,skills}')
 THEN RETURN false; END IF;
 FOR v_plan IN SELECT value FROM jsonb_array_elements(p_review->'classificationCandidates') LOOP
   IF v_plan->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
     OR v_plan->>'mode' IS DISTINCT FROM 'REMOTE'
     OR jsonb_typeof(v_plan->'service') IS DISTINCT FROM 'string'
     OR length(btrim(v_plan->>'service')) NOT BETWEEN 3 AND 120
     OR v_plan->>'categoryId' IS NULL
     OR char_length(v_plan->>'categoryId') IS DISTINCT FROM 36
     OR v_plan->>'categoryId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
     OR NOT (v_plan ? 'categoryLabel' AND v_plan ? 'categoryParentId')
     OR jsonb_typeof(v_plan->'categoryLabel') IS DISTINCT FROM 'string'
     OR (v_plan ? 'handoff' AND private.taxonomy_handoff_valid_v1(v_plan->'handoff') IS NOT TRUE)
   THEN RETURN false; END IF;
   v_service:=private.taxonomy_normalize_v1(v_plan->>'service');
   IF v_service IS NULL OR v_service=ANY(v_seen)
      OR private.taxonomy_risk_triage_v1(v_plan->>'service') IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
   THEN RETURN false; END IF;
   SELECT count(*) INTO v_n FROM jsonb_array_elements_text(p_review#>'{profile,skills}') s(value)
     WHERE private.taxonomy_normalize_v1(s.value)=v_service;
   IF v_n<>1 THEN RETURN false; END IF;
   SELECT count(*) INTO v_n FROM jsonb_array_elements(p_review->'reviewedServiceModes') m(value)
     WHERE private.taxonomy_normalize_v1(m.value->>'service')=v_service AND m.value->>'mode'='REMOTE';
   IF v_n<>1 THEN RETURN false; END IF;
   v_category:=(v_plan->>'categoryId')::uuid;
   IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
      JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id AND cm.execution_scope='REMOTE'
      WHERE c.id=v_category AND c.state='ESTABLISHED'
        AND c.label IS NOT DISTINCT FROM v_plan->>'categoryLabel'
        AND coalesce(to_jsonb(c.parent_id),'null'::jsonb) IS NOT DISTINCT FROM v_plan->'categoryParentId'
        AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
          WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
        AND private.taxonomy_category_path_valid_v1(c.id))
   THEN RETURN false; END IF;
   v_seen:=array_append(v_seen,v_service);
 END LOOP;
 RETURN cardinality(v_seen)=jsonb_array_length(p_review#>'{profile,skills}');
END; $function$;
