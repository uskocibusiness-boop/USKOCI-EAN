-- LOCAL_ONLY source candidate; not a DEV migration or deployment.
-- Preserve captured owner/ACL; original body MD5 58a9fc44a3caf09d14c2b13579afd882.
CREATE OR REPLACE FUNCTION private.worker_ai_service_mode_context_v1(p_account_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 v_session private.worker_ai_sessions; v_profile_id uuid;
 v_item jsonb; v_projection jsonb; v_hints jsonb; v_source text;
 v_saved_services jsonb:='[]';v_draft_services jsonb:='[]';v_unresolved jsonb:='[]';

BEGIN
 SELECT * INTO v_session FROM private.worker_ai_sessions
 WHERE account_id=p_account_id AND conversation_id=p_conversation_id;
 IF NOT FOUND OR v_session.base_hash IS DISTINCT FROM private.worker_ai_source_hash(p_account_id)
    OR jsonb_typeof(v_session.candidate->'skills') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'WORKER_AI_NOT_EDITABLE' USING errcode='55000'; END IF;
 v_profile_id:=v_session.profile_id;
 -- Read only durable, active bindings for independently surviving services.
 -- A newer pending addition is not authority to erase an older bound service.
 -- Source hash above still ties this context to the current owned profile.
 WITH names AS (
  SELECT skill AS service,private.taxonomy_normalize_v1(skill) AS service_key
  FROM jsonb_array_elements_text(v_session.candidate->'skills') n(skill)
  WHERE EXISTS(SELECT 1 FROM public.app_profiles p WHERE p.id=v_profile_id
    AND p.account_id=p_account_id AND p.kind='WORKER' AND p.profile_status='ACTIVE'
    AND (SELECT count(*) FROM unnest(p.skills) saved_skill
      WHERE private.taxonomy_normalize_v1(saved_skill)=private.taxonomy_normalize_v1(skill))=1)
 ), saved AS (
  SELECT s.*,r.envelope FROM private.worker_ai_saves s
  JOIN private.worker_ai_reviews r ON r.id=s.review_id AND r.account_id=s.account_id
  WHERE s.account_id=p_account_id AND s.receipt->>'profileId'=v_profile_id::text
   AND (EXISTS(
    SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m WHERE m.worker_account_id=p_account_id
     AND m.active AND m.source_review_id=s.review_id AND m.source_request_key=s.client_request_id))
   AND s.receipt->>'accountId'=p_account_id::text AND s.receipt->>'reviewId'=r.id::text
   AND s.receipt->'saved'='true'::jsonb AND s.receipt->'authoritative'='true'::jsonb
   AND r.envelope->>'profileId'=v_profile_id::text AND r.envelope->>'accountId'=p_account_id::text
   AND r.envelope->>'reviewId'=r.id::text AND r.envelope->'canAccept'='true'::jsonb
   AND r.created_at<=s.created_at AND s.created_at<=r.expires_at
   AND r.envelope->>'displayedContentDigest'=encode(extensions.digest(
     ((r.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',r.base_hash))::text,'sha256'),'hex')

 ), bound AS (
  SELECT n.service,m.execution_scope AS mode,m.handoff,c.id AS category_id
  FROM names n JOIN private.work_taxonomy_categories c ON c.state='ESTABLISHED'
  JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
  JOIN private.taxonomy_confirmed_worker_modes_v1 m ON m.category_id=c.id AND m.execution_scope=cm.execution_scope
   AND m.worker_account_id=p_account_id AND m.active
  JOIN private.work_taxonomy_worker_capabilities cap ON cap.category_id=c.id AND cap.worker_account_id=p_account_id
   AND NOT cap.excluded AND cap.origin='WORKER_CONFIRMED' AND cap.confirmed_at=m.confirmed_at AND cap.updated_at<=m.confirmed_at
  JOIN saved s ON s.review_id=m.source_review_id AND s.client_request_id=m.source_request_key
   AND s.envelope->>'classificationState'='READY'
  JOIN private.work_taxonomy_worker_bindings_v1 b ON b.owner_account_id=p_account_id
   AND b.profile_id=v_profile_id AND b.source_review_id=s.review_id AND b.request_key=s.client_request_id
   AND b.bound_at=m.confirmed_at AND b.bound_at>=s.created_at
   AND b.result->>'status'='BOUND_WORKER_SERVICES' AND b.result->>'workerProfileId'=v_profile_id::text
  JOIN private.work_taxonomy_review_batches_v1 batch ON batch.owner_account_id=p_account_id
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
    WHERE choice.worker_profile_id=v_profile_id AND choice.worker_account_id=p_account_id
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

 -- Latest current-source hints are separate proposals. Even an exact category
 -- and mode here are not saved consent and must never replace the baseline.
 v_source:=encode(extensions.digest(convert_to(
   v_session.candidate::text||'|'||v_session.revision::text||'|'||v_session.base_hash,'UTF8'),'sha256'),'hex');
 SELECT h.proposals INTO v_hints FROM private.work_taxonomy_gemini_turn_hints_v1 h
 WHERE h.purpose='WORKER_CAPABILITY' AND h.account_id=p_account_id
   AND h.conversation_id=p_conversation_id AND h.source_fingerprint=v_source
   AND h.catalog_version=(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton=true)
 ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
 IF jsonb_typeof(v_hints)='array' THEN
   FOR v_item IN SELECT value FROM jsonb_array_elements(v_hints) LOOP
     IF v_item->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
        OR v_item->>'mode' NOT IN ('ON_SITE','REMOTE')
        OR v_item->>'categoryId' IS NULL
        OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_session.candidate->'skills') skill(value)
          WHERE skill.value=to_jsonb(v_item->>'service'))
        OR (SELECT count(*) FROM jsonb_array_elements(v_session.candidate->'skills') skill(value)
            WHERE private.taxonomy_normalize_v1(skill.value#>>'{}')=
                  private.taxonomy_normalize_v1(v_item->>'service'))<>1
     THEN CONTINUE; END IF;
     v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
       jsonb_build_array(v_item->>'service'),jsonb_build_array(
         jsonb_build_object('service',v_item->>'service','mode',v_item->>'mode')));
     IF v_projection->>'status'='READY'
        AND v_projection#>>'{classificationCandidates,0,categoryId}'=v_item->>'categoryId'
     THEN v_draft_services:=v_draft_services||jsonb_build_array(jsonb_build_object(
       'service',v_item->>'service','mode',v_item->>'mode','categoryId',v_item->>'categoryId')
        ||case when v_item ? 'handoff' then jsonb_build_object('handoff',v_item->'handoff') else '{}'::jsonb end);
     END IF;
   END LOOP;
 END IF;
 SELECT coalesce(jsonb_agg(value ORDER BY value->>'service',value->>'mode',value->>'categoryId'),'[]'::jsonb)
 INTO v_saved_services FROM (SELECT DISTINCT value FROM jsonb_array_elements(v_saved_services)) rows;
 SELECT coalesce(jsonb_agg(value ORDER BY value->>'service',value->>'mode',value->>'categoryId'),'[]'::jsonb)
 INTO v_draft_services FROM (SELECT DISTINCT value FROM jsonb_array_elements(v_draft_services)) rows;
 SELECT coalesce(jsonb_agg(value ORDER BY value#>>'{}'),'[]'::jsonb) INTO v_unresolved
 FROM (SELECT DISTINCT skill.value FROM jsonb_array_elements(v_session.candidate->'skills') skill(value)
   WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_saved_services||v_draft_services) known(value)
     WHERE known.value->>'service'=skill.value#>>'{}')) unresolved;
 RETURN jsonb_build_object('schemaVersion','WORKER_SERVICE_MODE_CONTEXT_V1','revision',v_session.revision,
   'savedServices',v_saved_services,'draftServices',v_draft_services,'unresolvedServices',v_unresolved);
END $function$
