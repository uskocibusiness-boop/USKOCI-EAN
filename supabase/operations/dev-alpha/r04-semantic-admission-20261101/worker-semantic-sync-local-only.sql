-- R04/R08 existing signed worker capability continuity. LOCAL_ONLY.
-- NOT a migration or permission to apply to DEV/PROD.
-- Derived from live capture worker-sync-dev-preimage-20261102.json, body MD5
-- 8bfb57431cd6a6fcff2e1e80fe8b5fbc. Signature/security/search_path unchanged.
-- Existing AFTER skills trigger remains unchanged; empty/removal still revokes.
-- No INSERT, mode grant, requeue, revive, or global alias. Guarded promotion
-- still needs pre/postimage, ACL/closure/rollback and old/new client evidence.
CREATE OR REPLACE FUNCTION private.sync_worker_skills_to_taxonomy_capabilities(p_account_id uuid, p_skills text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_saved_skills text[];v_profile_id uuid;
 v_skill text;v_norm text;v_cat_id uuid;v_match_count integer;
 v_retained_ids uuid[]:=ARRAY[]::uuid[];
 v_unmapped_labels text[]:=ARRAY[]::text[];
 v_revoked integer:=0;v_revoked_acceptances integer:=0;
BEGIN
 IF private.closure_taxonomy_profile_erasing_v1(p_account_id) THEN
 RETURN jsonb_build_object('success',true,'workerAccountId',p_account_id,'assignedCount',0,'assignedCategoryIds','[]'::jsonb,
 'retainedExistingCategoryCount',0,'retainedExistingCategoryIds','[]'::jsonb,'revokedCount',0,'revokedRelatedAcceptances',0,
 'unmappedSkillLabels','[]'::jsonb,'openNeedsRequeued',0,'newCapabilityAuthority','NONE','notificationAuthority','NONE');END IF;
 PERFORM private.closure_assert_open(p_account_id);
 IF p_account_id IS NULL THEN
   RAISE EXCEPTION 'WORKER_ACCOUNT_REQUIRED' USING errcode='22023';
 END IF;
 SELECT COALESCE(p.skills,ARRAY[]::text[]),p.id INTO v_saved_skills,v_profile_id
 FROM public.app_profiles p
 WHERE p.account_id=p_account_id AND p.kind='WORKER'
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WORKER_PROFILE_REQUIRED' USING errcode='55000'; END IF;
 IF v_saved_skills IS DISTINCT FROM COALESCE(p_skills,ARRAY[]::text[]) THEN
   RAISE EXCEPTION 'TAXONOMY_PROFILE_SKILLS_MISMATCH' USING errcode='22023';
 END IF;
 -- A canonical/registered-alias match is used ONLY to decide which already
 -- confirmed capability is still mentioned by the worker. This is not consent.
 -- No invented ON_SITE mode, no nearest-parent inference and no new records.
 FOREACH v_skill IN ARRAY v_saved_skills LOOP
   v_skill:=btrim(COALESCE(v_skill,''));
   IF char_length(v_skill) NOT BETWEEN 3 AND 120 THEN
     v_unmapped_labels:=array_append(v_unmapped_labels,v_skill);
     CONTINUE;
   END IF;
   v_norm:=private.taxonomy_normalize_v1(v_skill);
   SELECT count(DISTINCT c.id),min(c.id::text)::uuid
      INTO v_match_count,v_cat_id
   FROM private.work_taxonomy_categories c
   WHERE c.state='ESTABLISHED'
     AND EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes m
       WHERE m.category_id=c.id)
     AND (c.canonical_key=v_norm OR EXISTS(
       SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=c.id AND a.normalized_key=v_norm));
   -- Retain only an ALREADY ACTIVE capability certified by this owner's
   -- saved review and successful binder. Natural wording is local to that
   -- signed service, never a global alias or permission to create/revive skills.
   -- Keep canonical/alias ambiguity fail-closed; fallback applies to no match.
   IF v_match_count=0 THEN
     SELECT count(DISTINCT c.id),min(c.id::text)::uuid
       INTO v_match_count,v_cat_id
     FROM private.work_taxonomy_worker_capabilities cap
     JOIN private.taxonomy_confirmed_worker_modes_v1 mode
       ON mode.worker_account_id=cap.worker_account_id AND mode.category_id=cap.category_id
     JOIN private.work_taxonomy_categories c ON c.id=cap.category_id
     JOIN private.work_taxonomy_category_modes cm
       ON cm.category_id=c.id AND cm.execution_scope=mode.execution_scope
     JOIN private.worker_ai_saves saved
       ON saved.account_id=mode.worker_account_id AND saved.review_id=mode.source_review_id
       AND saved.client_request_id=mode.source_request_key
     JOIN private.work_taxonomy_worker_bindings_v1 binding
       ON binding.owner_account_id=saved.account_id AND binding.source_review_id=saved.review_id
       AND binding.request_key=saved.client_request_id AND binding.profile_id=v_profile_id
     JOIN private.worker_ai_reviews review
       ON review.id=saved.review_id AND review.account_id=saved.account_id
     JOIN private.work_taxonomy_review_batches_v1 batch
       ON batch.owner_account_id=saved.account_id AND batch.request_key=saved.client_request_id
       AND batch.source_review_id=saved.review_id AND batch.purpose='WORKER_CAPABILITY'
     CROSS JOIN LATERAL jsonb_array_elements(batch.plans) WITH ORDINALITY plan(value,ord)
     WHERE cap.worker_account_id=p_account_id AND cap.excluded IS FALSE
       AND cap.origin='WORKER_CONFIRMED' AND mode.active IS TRUE
       AND mode.confirmed_at=cap.confirmed_at AND mode.confirmed_at=binding.bound_at
       AND c.state='ESTABLISHED' AND private.taxonomy_category_path_valid_v1(c.id)
       AND binding.result->>'status'='BOUND_WORKER_SERVICES'
       AND saved.receipt->>'profileId'=v_profile_id::text
       AND saved.receipt->>'profileStatus'='ACTIVE'
       AND saved.receipt->'saved'='true'::jsonb AND saved.receipt->'authoritative'='true'::jsonb
       AND saved.created_at<=review.expires_at
       AND review.envelope->>'profileId'=v_profile_id::text
       AND review.envelope->'canAccept'='true'::jsonb
       AND review.envelope->>'classificationState'='READY'
       AND review.envelope->'classificationCandidates'=batch.plans
       AND review.envelope->>'displayedContentDigest'=batch.review_digest
       AND batch.review_digest=encode(extensions.digest(
         ((review.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',review.base_hash))::text,'sha256'),'hex')
       AND batch.result->>'status'='COMMITTED'
       AND batch.result->'requiresBinding'='true'::jsonb
       AND plan.value->>'action' IN ('REUSE_EXISTING','EXTEND_MODE')
       AND plan.value->>'categoryId'=c.id::text
       AND plan.value->>'mode'=mode.execution_scope
       AND private.taxonomy_normalize_v1(plan.value->>'service')=v_norm
       AND plan.value ? 'categoryLabel' AND plan.value ? 'categoryParentId'
       AND c.label IS NOT DISTINCT FROM plan.value->>'categoryLabel'
       AND coalesce(to_jsonb(c.parent_id),'null'::jsonb)
           IS NOT DISTINCT FROM plan.value->'categoryParentId'
       AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
         WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
       AND batch.result->'items'->(plan.ord::integer-1)->>'categoryId'=c.id::text
       AND batch.result->'items'->(plan.ord::integer-1)->>'mode'=mode.execution_scope
       AND private.taxonomy_normalize_v1(batch.result->'items'->(plan.ord::integer-1)->>'service')=v_norm
       AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(review.envelope#>'{profile,skills}') skill(value)
         WHERE private.taxonomy_normalize_v1(skill.value)=v_norm)
       AND EXISTS(SELECT 1 FROM jsonb_array_elements(review.envelope->'reviewedServiceModes') consent(value)
         WHERE private.taxonomy_normalize_v1(consent.value->>'service')=v_norm
           AND consent.value->>'mode'=mode.execution_scope);
   END IF;
   IF v_match_count<>1 OR v_cat_id IS NULL THEN
     v_unmapped_labels:=array_append(v_unmapped_labels,v_skill);
     CONTINUE;
   END IF;
   IF NOT v_cat_id=ANY(v_retained_ids) THEN
     v_retained_ids:=array_append(v_retained_ids,v_cat_id);
   END IF;
 END LOOP;
 -- Explicitly removed or now-ambiguous worker services lose existing legacy
 -- eligibility and related opt-ins. Retained rows are NOT refreshed/revived.
 UPDATE private.work_taxonomy_worker_capabilities w
 SET excluded=true,allow_related_offers=false,updated_at=statement_timestamp()
 WHERE w.worker_account_id=p_account_id
   AND NOT (w.category_id=ANY(v_retained_ids))
   AND (NOT w.excluded OR w.allow_related_offers);
 GET DIAGNOSTICS v_revoked=ROW_COUNT;
 DELETE FROM private.work_taxonomy_related_acceptances a
 WHERE a.worker_account_id=p_account_id
   AND NOT (a.source_category_id=ANY(v_retained_ids));
 GET DIAGNOSTICS v_revoked_acceptances=ROW_COUNT;
 -- Deliberately NO requeue: Save is not a taxonomy binder receipt. A signed
 -- reconciler may later schedule matching only after both sides are bound.
 RETURN jsonb_build_object(
   'success',true,'workerAccountId',p_account_id,
   'assignedCount',0,'assignedCategoryIds','[]'::jsonb,
   'retainedExistingCategoryCount',cardinality(v_retained_ids),
   'retainedExistingCategoryIds',to_jsonb(v_retained_ids),
   'revokedCount',v_revoked,
   'revokedRelatedAcceptances',v_revoked_acceptances,
   'unmappedSkillLabels',to_jsonb(v_unmapped_labels),
   'openNeedsRequeued',0,
   'newCapabilityAuthority','NONE',
   'notificationAuthority','NONE'
 );
END $function$
