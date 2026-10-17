-- Gate B: source-only safe cutover. NOT DEPLOYED.
-- The old skills AFTER trigger may only WITHDRAW stale authority. It MUST NOT
-- create taxonomy categories, grant worker capability, select ON_SITE by
-- default, opt in related offers or requeue work for a merely saved skill.
-- Newly signed capabilities are granted by rpc_taxonomy_bind_reviewed_worker_service
-- in a distinct transaction after authenticated Save, batch admission and
-- current-profile verification. Existing legacy rows remain historically
-- readable, but the strict matcher must be gated to signed per-service modes
-- before this migration is enabled. Never deploy this replacement alone.
BEGIN;
CREATE OR REPLACE FUNCTION private.sync_worker_skills_to_taxonomy_capabilities(
  p_account_id uuid,p_skills text[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,private
AS $function$
DECLARE
 v_saved_skills text[];
 v_skill text;v_norm text;v_cat_id uuid;v_match_count integer;
 v_retained_ids uuid[]:=ARRAY[]::uuid[];
 v_unmapped_labels text[]:=ARRAY[]::text[];
 v_revoked integer:=0;v_revoked_acceptances integer:=0;
BEGIN
 IF p_account_id IS NULL THEN
   RAISE EXCEPTION 'WORKER_ACCOUNT_REQUIRED' USING errcode='22023';
 END IF;
 SELECT COALESCE(p.skills,ARRAY[]::text[]) INTO v_saved_skills
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
END $function$;
REVOKE ALL ON FUNCTION private.sync_worker_skills_to_taxonomy_capabilities(uuid,text[])
 FROM PUBLIC,anon,authenticated;
COMMIT;
