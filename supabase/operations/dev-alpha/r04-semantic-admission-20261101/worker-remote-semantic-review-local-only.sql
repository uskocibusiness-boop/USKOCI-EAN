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
DECLARE v_exact jsonb;v_plans jsonb;v_plan jsonb;v_service text;v_seen text[]:=ARRAY[]::text[];v_n integer;v_category uuid;v_projection jsonb;v_one jsonb;v_saved_services jsonb;v_profile_id uuid;v_owned uuid;v_source text;v_hints jsonb;
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
   -- Activation follows this transaction's own profile writes, so the old
   -- pre-Save source-hash context cannot be re-read here. Preserve only a
   -- separately proven active Save/batch/binding, never supplied JSON alone.
   v_exact:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
     p_review#>'{profile,skills}',p_review->'reviewedServiceModes');
   IF v_exact->>'status' NOT IN ('READY','PENDING_CLASSIFICATION')
      OR p_review->'classificationCatalogVersion' IS DISTINCT FROM
        (SELECT to_jsonb(catalog_version) FROM private.work_taxonomy_control WHERE singleton)
      OR p_review->>'classificationCatalogFingerprint' IS DISTINCT FROM private.taxonomy_admission_fingerprint_v1()
      OR jsonb_array_length(p_review->'classificationCandidates')<>jsonb_array_length(p_review->'reviewedServiceModes')
   THEN RETURN false; END IF;
   IF v_projection->>'status'='READY'
     AND p_review->'classificationCandidates'=v_projection->'classificationCandidates'
     AND p_review->'reviewedServiceModes'=v_projection->'reviewedServiceModes'
   THEN RETURN true; END IF;
   v_owned:=auth.uid();
   SELECT p.id INTO v_profile_id FROM public.app_profiles p
     WHERE p.account_id=v_owned AND p.kind='WORKER' AND p.id::text=p_review->>'profileId';
   IF v_profile_id IS NULL THEN RETURN false; END IF;
   SELECT encode(extensions.digest(convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex')
     INTO v_source FROM private.worker_ai_sessions s WHERE s.account_id=v_owned
       AND s.conversation_id=(p_review->>'conversationId')::uuid;
   SELECT h.proposals INTO v_hints FROM private.work_taxonomy_gemini_turn_hints_v1 h
     WHERE h.purpose='WORKER_CAPABILITY' AND h.account_id=v_owned
       AND h.conversation_id=(p_review->>'conversationId')::uuid AND h.source_fingerprint=v_source
       AND h.catalog_version=(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)
     ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
 WITH names AS (
  SELECT skill AS service,private.taxonomy_normalize_v1(skill) AS service_key
  FROM jsonb_array_elements_text(p_review#>'{profile,skills}') n(skill)
  WHERE EXISTS(SELECT 1 FROM public.app_profiles p WHERE p.id=v_profile_id
    AND p.account_id=v_owned AND p.kind='WORKER' AND p.profile_status='ACTIVE'
    AND (SELECT count(*) FROM unnest(p.skills) saved_skill
      WHERE private.taxonomy_normalize_v1(saved_skill)=private.taxonomy_normalize_v1(skill))=1)
 ), saved AS (
  SELECT s.*,r.envelope FROM private.worker_ai_saves s
  JOIN private.worker_ai_reviews r ON r.id=s.review_id AND r.account_id=s.account_id
  WHERE s.account_id=v_owned AND s.receipt->>'profileId'=v_profile_id::text
   AND (EXISTS(
    SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m WHERE m.worker_account_id=v_owned
     AND m.active AND m.source_review_id=s.review_id AND m.source_request_key=s.client_request_id))
   AND s.receipt->>'accountId'=v_owned::text AND s.receipt->>'reviewId'=r.id::text
   AND s.receipt->'saved'='true'::jsonb AND s.receipt->'authoritative'='true'::jsonb
   AND r.envelope->>'profileId'=v_profile_id::text AND r.envelope->>'accountId'=v_owned::text
   AND r.envelope->>'reviewId'=r.id::text AND r.envelope->'canAccept'='true'::jsonb
   AND r.created_at<=s.created_at AND s.created_at<=r.expires_at
   AND r.envelope->>'displayedContentDigest'=encode(extensions.digest(
     ((r.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',r.base_hash))::text,'sha256'),'hex')

 ), bound AS (
  SELECT n.service,m.execution_scope AS mode,m.handoff,c.id AS category_id
  FROM names n JOIN private.work_taxonomy_categories c ON c.state='ESTABLISHED'
  JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
  JOIN private.taxonomy_confirmed_worker_modes_v1 m ON m.category_id=c.id AND m.execution_scope=cm.execution_scope
   AND m.worker_account_id=v_owned AND m.active
  JOIN private.work_taxonomy_worker_capabilities cap ON cap.category_id=c.id AND cap.worker_account_id=v_owned
   AND NOT cap.excluded AND cap.origin='WORKER_CONFIRMED' AND cap.confirmed_at=m.confirmed_at AND cap.updated_at<=m.confirmed_at
  JOIN saved s ON s.review_id=m.source_review_id AND s.client_request_id=m.source_request_key
   AND s.envelope->>'classificationState'='READY'
  JOIN private.work_taxonomy_worker_bindings_v1 b ON b.owner_account_id=v_owned
   AND b.profile_id=v_profile_id AND b.source_review_id=s.review_id AND b.request_key=s.client_request_id
   AND b.bound_at=m.confirmed_at AND b.bound_at>=s.created_at
   AND b.result->>'status'='BOUND_WORKER_SERVICES' AND b.result->>'workerProfileId'=v_profile_id::text
  JOIN private.work_taxonomy_review_batches_v1 batch ON batch.owner_account_id=v_owned
   AND batch.source_review_id=s.review_id AND batch.request_key=s.client_request_id AND batch.purpose='WORKER_CAPABILITY'
   AND batch.result->>'status'='COMMITTED' AND batch.result->'requiresBinding'='true'::jsonb
   AND batch.catalog_version=b.catalog_version AND batch.plans=s.envelope->'classificationCandidates'
   AND batch.review_digest=s.envelope->>'displayedContentDigest'
   AND jsonb_typeof(batch.plans)='array' AND jsonb_typeof(batch.result->'items')='array'
   AND b.result->'serviceModeCount'=to_jsonb(jsonb_array_length(batch.plans))
   AND jsonb_array_length(batch.result->'items')=jsonb_array_length(batch.plans)
   AND jsonb_array_length(s.envelope->'reviewedServiceModes')=jsonb_array_length(batch.plans)
  WHERE m.execution_scope IN ('ON_SITE','REMOTE')
   AND EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
    WHERE choice.worker_profile_id=v_profile_id AND choice.worker_account_id=v_owned
     AND choice.consent_source='EXPLICIT_PROFILE_REVIEW' AND choice.confirmed_at IS NOT NULL
     AND m.execution_scope=ANY(choice.modes))
   -- Compare the saved service key, preserving n.service for display. Formatting
   -- changes are not a new skill; arbitrary synonyms still require signed IDs.
   AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(s.envelope#>'{profile,skills}') skill(value)
     WHERE private.taxonomy_normalize_v1(skill.value)=n.service_key)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.envelope->'reviewedServiceModes') selected(value)
     WHERE private.taxonomy_normalize_v1(selected.value->>'service')=n.service_key
       AND selected.value->>'mode'=m.execution_scope)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.result->'items') result(value)
     WHERE private.taxonomy_normalize_v1(result.value->>'service')=n.service_key
       AND result.value->>'mode'=m.execution_scope AND result.value->>'categoryId'=c.id::text)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) plan WHERE private.taxonomy_normalize_v1(plan->>'service')=n.service_key
    AND plan->>'mode'=m.execution_scope AND (plan->'handoff') IS NOT DISTINCT FROM m.handoff)
   AND (m.handoff IS NULL OR (m.execution_scope='REMOTE' AND private.taxonomy_handoff_valid_v1(m.handoff)))
   AND (SELECT count(*) FROM names same WHERE same.service_key=n.service_key)=1
   AND (
    -- Preserve exact/registered-alias resolution, including ambiguity refusal.
    ((c.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=c.id AND a.normalized_key=n.service_key))
     AND (SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=1)
    OR
    -- A local signed service may name an already-bound ID without a global alias.
    -- This branch only describes existing active authority; it never grants it.
    ((SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=0
     AND s.receipt->>'profileStatus'='ACTIVE'
     AND private.taxonomy_category_path_valid_v1(c.id)
     AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
       WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
     AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) WITH ORDINALITY plan(value,ord)
       WHERE plan.value->>'action' IN ('REUSE_EXISTING','EXTEND_MODE')
        AND private.taxonomy_normalize_v1(plan.value->>'service')=n.service_key AND plan.value->>'mode'=m.execution_scope
        AND (plan.value->'handoff') IS NOT DISTINCT FROM m.handoff
        AND plan.value->>'categoryId'=c.id::text
        AND jsonb_typeof(plan.value->'categoryLabel')='string'
        AND c.label IS NOT DISTINCT FROM plan.value->>'categoryLabel'
        AND plan.value ? 'categoryParentId'
        AND coalesce(to_jsonb(c.parent_id),'null'::jsonb)
            IS NOT DISTINCT FROM plan.value->'categoryParentId'
        AND batch.result->'items'->(plan.ord::integer-1)->>'categoryId'=c.id::text
        AND batch.result->'items'->(plan.ord::integer-1)->>'mode'=m.execution_scope
        AND private.taxonomy_normalize_v1(batch.result->'items'->(plan.ord::integer-1)->>'service')=n.service_key))
   )

 ) SELECT coalesce(jsonb_agg(DISTINCT (jsonb_build_object('service',service,'mode',mode,
   'categoryId',category_id)||CASE WHEN handoff IS NOT NULL THEN jsonb_build_object('handoff',handoff)
     ELSE '{}'::jsonb END)),'[]'::jsonb) INTO v_saved_services FROM bound;


   FOR v_plan IN SELECT value FROM jsonb_array_elements(p_review->'classificationCandidates') LOOP
     v_service:=v_plan->>'service';
     IF (SELECT count(*) FROM jsonb_array_elements(p_review->'reviewedServiceModes') m
       WHERE m->>'service'=v_service AND m->>'mode'=v_plan->>'mode')<>1
       OR v_service=ANY(v_seen) THEN RETURN false; END IF;
     v_seen:=array_append(v_seen,v_service);
     v_one:=private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY',jsonb_build_array(v_service),
       jsonb_build_array(jsonb_build_object('service',v_service,'mode',v_plan->>'mode')),v_owned,(p_review->>'conversationId')::uuid);
     IF v_one->>'status'='READY' AND v_one#>'{classificationCandidates,0}'=v_plan THEN CONTINUE; END IF;
     -- No current proposal may be overridden, even when it is invalid or
     -- explicitly clears a previous mode/handoff. Only missing old hints reuse.
     IF v_plan->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
       OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(v_hints,'[]'::jsonb)) h
         WHERE private.taxonomy_normalize_v1(h->>'service')=private.taxonomy_normalize_v1(v_service))
       OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_saved_services) saved
         WHERE saved->>'service'=v_service AND saved->>'mode'=v_plan->>'mode'
           AND saved->>'categoryId'=v_plan->>'categoryId'
           AND saved->'handoff' IS NOT DISTINCT FROM v_plan->'handoff')
       OR private.worker_remote_review_ready_v1(p_review||jsonb_build_object(
         'profile',jsonb_build_object('skills',jsonb_build_array(v_service)),
         'reviewedServiceModes',jsonb_build_array(jsonb_build_object('service',v_service,'mode',v_plan->>'mode')),
         'classificationCandidates',jsonb_build_array(v_plan))) IS NOT TRUE
     THEN RETURN false; END IF;
   END LOOP;
   RETURN cardinality(v_seen)=jsonb_array_length(p_review#>'{profile,skills}');
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
