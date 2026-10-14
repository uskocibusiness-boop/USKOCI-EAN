-- USKOČI source-only candidate based on DEV-applied PR #24 reconciliation.
-- DO NOT APPLY ALONE: first wire signed per-service modes and pending resolution.
-- This replaces the second legacy taxonomy writer with mapping-only sync.
-- Existing human profile skills survive even when no canonical ID exists.
-- Source verified against live DEV private.sync_worker_skills_to_taxonomy_capabilities
-- on 2026-10-14; intentionally NOT DEPLOYED in this PR.
BEGIN;
CREATE OR REPLACE FUNCTION private.sync_worker_skills_to_taxonomy_capabilities(p_account_id uuid, p_skills text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
  v_saved_skills text[];
  v_skill text;
  v_norm text;
  v_cat_id uuid;
  v_assigned_ids uuid[] := ARRAY[]::uuid[];
  v_unmapped_labels text[] := ARRAY[]::text[];
  v_revoked integer := 0;
  v_revoked_acceptances integer := 0;
  v_requeued integer := 0;
BEGIN
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'WORKER_ACCOUNT_REQUIRED' USING errcode='22023';
  END IF;

  -- Never use a caller-supplied skills array as a substitute for the current
  -- owner-reviewed profile. This also blocks old service wrappers from silently
  -- granting skills that are absent from the visible worker profile.
  SELECT COALESCE(p.skills, ARRAY[]::text[])
    INTO v_saved_skills
  FROM public.app_profiles p
  WHERE p.account_id = p_account_id AND p.kind = 'WORKER'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKER_PROFILE_REQUIRED' USING errcode='55000';
  END IF;
  IF v_saved_skills IS DISTINCT FROM COALESCE(p_skills, ARRAY[]::text[]) THEN
    RAISE EXCEPTION 'TAXONOMY_PROFILE_SKILLS_MISMATCH' USING errcode='22023';
  END IF;

  FOREACH v_skill IN ARRAY v_saved_skills LOOP
    v_skill := btrim(COALESCE(v_skill,''));
    IF char_length(v_skill) NOT BETWEEN 3 AND 120 THEN
      v_unmapped_labels := array_append(v_unmapped_labels, v_skill);
      CONTINUE;
    END IF;
    v_norm := private.taxonomy_normalize_v1(v_skill);
    v_cat_id := NULL;

    SELECT c.id INTO v_cat_id
    FROM private.work_taxonomy_categories c
    WHERE c.canonical_key = v_norm AND c.state = 'ESTABLISHED'
      AND EXISTS (SELECT 1 FROM private.work_taxonomy_category_modes m
        WHERE m.category_id=c.id AND m.execution_scope='ON_SITE')
    ORDER BY (c.parent_id IS NOT NULL) DESC, c.created_at ASC, c.id ASC
    LIMIT 1;

    -- Never invent a skill, scope or category during profile save.
    -- Unknown services remain in the human's reviewed app_profiles.skills
    -- and are returned for AFTER-save owner-bound admission/reconciliation.
    -- No default REMOTE scope, related opt-in, or unconfirmed matcher grant.

    IF v_cat_id IS NULL THEN
      v_unmapped_labels := array_append(v_unmapped_labels, v_skill);
      CONTINUE;
    END IF;

    IF NOT v_cat_id = ANY(v_assigned_ids) THEN
      v_assigned_ids := array_append(v_assigned_ids, v_cat_id);
    END IF;

    INSERT INTO private.work_taxonomy_worker_capabilities(
      worker_account_id, category_id, confirmed_at,
      allow_related_offers, excluded, origin
    ) VALUES(
      p_account_id, v_cat_id, statement_timestamp(), false, false, 'WORKER_CONFIRMED'
    )
    ON CONFLICT (worker_account_id, category_id) DO UPDATE
      SET confirmed_at = statement_timestamp(),
          updated_at = statement_timestamp(),
          excluded = false,
          -- Re-adding a withdrawn skill must NOT resurrect previous related opt-ins.
          allow_related_offers = CASE
            WHEN work_taxonomy_worker_capabilities.excluded THEN false
            ELSE work_taxonomy_worker_capabilities.allow_related_offers
          END;
  END LOOP;

  -- Historical rows are retained as excluded, never considered an active skill.
  -- This runs even when the worker explicitly saves ZERO skills.
  UPDATE private.work_taxonomy_worker_capabilities w
    SET excluded = true,
        allow_related_offers = false,
        updated_at = statement_timestamp()
  WHERE w.worker_account_id = p_account_id
    AND NOT (w.category_id = ANY(v_assigned_ids))
    AND (NOT w.excluded OR w.allow_related_offers);
  GET DIAGNOSTICS v_revoked = ROW_COUNT;

  -- Withdraw stale opt-ins, so a later re-addition requires new confirmation.
  DELETE FROM private.work_taxonomy_related_acceptances a
  WHERE a.worker_account_id = p_account_id
    AND NOT (a.source_category_id = ANY(v_assigned_ids));
  GET DIAGNOSTICS v_revoked_acceptances = ROW_COUNT;

  BEGIN
    v_requeued := private.requeue_open_needs_for_worker_v5(p_account_id);
  EXCEPTION WHEN OTHERS THEN
    v_requeued := 0;
  END;

  RETURN jsonb_build_object(
    'success',true,
    'workerAccountId',p_account_id,
    'assignedCount',cardinality(v_assigned_ids),
    'assignedCategoryIds',to_jsonb(v_assigned_ids),
    'revokedCount',v_revoked,
    'revokedRelatedAcceptances',v_revoked_acceptances,
    'unmappedSkillLabels',to_jsonb(v_unmapped_labels),
    'openNeedsRequeued',v_requeued
  );
END $function$;
REVOKE ALL ON FUNCTION private.sync_worker_skills_to_taxonomy_capabilities(uuid,text[])
  FROM PUBLIC,anon,authenticated;
COMMIT;
