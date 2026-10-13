-- ==============================================================================
-- USKOCI Dynamic Taxonomy: Worker Skills Auto-Sync, Smart Attachment & Requeue
-- Migration: 20261013193500_uskoci_worker_skills_taxonomy_sync.sql
-- ==============================================================================

-- 1. Upgrade rpc_taxonomy_ensure_path_service with smart root attachment for single-element paths
CREATE OR REPLACE FUNCTION public.rpc_taxonomy_ensure_path_service(
  p_path text[],
  p_execution_location_mode text DEFAULT 'STATIONARY',
  p_related_labels text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'private'
AS $fn$
DECLARE
  v_scope text;
  v_version bigint;
  v_parent_id uuid := NULL;
  v_parent_label text := NULL;
  v_current_id uuid;
  v_current_label text;
  v_key text;
  v_ancestor_ids uuid[] := ARRAY[]::uuid[];
  v_related_ids uuid[] := ARRAY[]::uuid[];
  v_rel_label text;
  v_rel_key text;
  v_rel_id uuid;
BEGIN
  IF p_path IS NULL OR cardinality(p_path) = 0 THEN
    RAISE EXCEPTION 'TAXONOMY_PATH_EMPTY' USING errcode='22023';
  END IF;

  v_scope := coalesce(private.taxonomy_execution_scope_v1(p_execution_location_mode), 'ON_SITE');

  SELECT catalog_version INTO v_version
  FROM private.work_taxonomy_control WHERE singleton;
  IF v_version IS NULL THEN v_version := 3; END IF;

  -- Traverse the chain from top root to specific leaf
  FOR i IN 1..cardinality(p_path) LOOP
    v_current_label := btrim(p_path[i]);
    IF char_length(v_current_label) NOT BETWEEN 3 AND 120
       OR v_current_label ~ '[<>{}\\]' OR v_current_label ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'TAXONOMY_LABEL_INVALID: %', v_current_label USING errcode='22023';
    END IF;

    v_key := private.taxonomy_normalize_v1(v_current_label);
    IF char_length(v_key) < 3 THEN
      RAISE EXCEPTION 'TAXONOMY_KEY_TOO_SHORT' USING errcode='22023';
    END IF;

    -- Search existing category
    SELECT id INTO v_current_id
    FROM private.work_taxonomy_categories
    WHERE canonical_key = v_key AND state <> 'RETIRED'
    LIMIT 1;

    -- If brand new single-element path without parent, attach to intelligent root
    IF v_current_id IS NULL AND v_parent_id IS NULL AND cardinality(p_path) = 1 THEN
      IF v_scope = 'REMOTE' THEN
        IF v_key ~ '(prevod|pisan|tekst|lektur|jezik)' THEN
          SELECT id INTO v_parent_id FROM private.work_taxonomy_categories WHERE canonical_key = 'pisanje i jezici';
        ELSIF v_key ~ '(cas|casov|poducav|instrukcij|ucenj|skol)' THEN
          SELECT id INTO v_parent_id FROM private.work_taxonomy_categories WHERE canonical_key = 'online poducavanje';
        ELSE
          SELECT id INTO v_parent_id FROM private.work_taxonomy_categories WHERE canonical_key = 'digitalne usluge';
        END IF;
      ELSE
        IF v_key ~ '(moler|krec|farb|glet)' THEN
          SELECT id INTO v_parent_id FROM private.work_taxonomy_categories WHERE canonical_key = 'molerski radovi';
        ELSIF v_key ~ '(selidb|prevoz|transport|kombi|prenos)' THEN
          SELECT id INTO v_parent_id FROM private.work_taxonomy_categories WHERE canonical_key = 'selidbe i prevoz';
        ELSIF v_key ~ '(cisc|pranj|peglan|spreman)' THEN
          SELECT id INTO v_parent_id FROM private.work_taxonomy_categories WHERE canonical_key = 'ciscenje';
        ELSIF v_key ~ '(elektr|struj|osigurac|kabl)' THEN
          SELECT id INTO v_parent_id FROM private.work_taxonomy_categories WHERE canonical_key = 'elektricarski radovi';
        ELSIF v_key ~ '(vodo|cev|slavin|bojler|odvod|kanalizac)' THEN
          SELECT id INTO v_parent_id FROM private.work_taxonomy_categories WHERE canonical_key = 'vodoinstalaterski radovi';
        ELSIF v_key ~ '(namestaj|montaz|sklapan|ormar|krevet|sto)' THEN
          SELECT id INTO v_parent_id FROM private.work_taxonomy_categories WHERE canonical_key = 'montaza namestaja';
        ELSIF v_key ~ '(basta|dvorist|kosenj|trava|oreziv)' THEN
          SELECT id INTO v_parent_id FROM private.work_taxonomy_categories WHERE canonical_key = 'basta i dvoriste';
        ELSIF v_key ~ '(dostav|kurir|potrck|kupovin|donos)' THEN
          SELECT id INTO v_parent_id FROM private.work_taxonomy_categories WHERE canonical_key = 'dostava';
        ELSIF v_key ~ '(fizick|kopanj|nosiv|istovar|utovar)' THEN
          SELECT id INTO v_parent_id FROM private.work_taxonomy_categories WHERE canonical_key = 'fizicki poslovi';
        ELSE
          SELECT id INTO v_parent_id FROM private.work_taxonomy_categories WHERE canonical_key = 'zanati i popravke';
        END IF;
      END IF;
      IF v_parent_id IS NOT NULL THEN
        SELECT label INTO v_parent_label FROM private.work_taxonomy_categories WHERE id = v_parent_id;
        v_ancestor_ids := array_append(v_ancestor_ids, v_parent_id);
      END IF;
    END IF;

    IF v_current_id IS NULL THEN
      -- Create new category node under v_parent_id
      INSERT INTO private.work_taxonomy_categories (
        canonical_key, label, parent_id, state, source, catalog_version
      ) VALUES (
        v_key, v_current_label, v_parent_id, 'ESTABLISHED', 'AI_REVIEWED', v_version
      ) RETURNING id INTO v_current_id;

      -- Map execution scope
      INSERT INTO private.work_taxonomy_category_modes (
        category_id, execution_scope, source_ref
      ) VALUES (
        v_current_id, v_scope, 'DYNAMIC_AI_BRANCH'
      ) ON CONFLICT (category_id, execution_scope) DO NOTHING;

      -- Add standard coverage if there is an established parent
      IF v_parent_id IS NOT NULL THEN
        INSERT INTO private.work_taxonomy_category_modes (
          category_id, execution_scope, source_ref
        ) VALUES (
          v_parent_id, v_scope, 'PARENT_SCOPE_INHERITED'
        ) ON CONFLICT (category_id, execution_scope) DO NOTHING;

        INSERT INTO private.work_taxonomy_standard_coverage (
          parent_category_id, child_category_id, verification, evidence_ref
        ) VALUES (
          v_parent_id, v_current_id, 'VERIFIED', 'AI_CANONICAL_PATH'
        ) ON CONFLICT (child_category_id) DO NOTHING;
      END IF;
    ELSE
      -- Category exists. Ensure mode is mapped
      INSERT INTO private.work_taxonomy_category_modes (
        category_id, execution_scope, source_ref
      ) VALUES (
        v_current_id, v_scope, 'EXISTING_NODE_ACCESSED'
      ) ON CONFLICT (category_id, execution_scope) DO NOTHING;
    END IF;

    v_ancestor_ids := array_append(v_ancestor_ids, v_current_id);
    IF i < cardinality(p_path) THEN
      v_parent_id := v_current_id;
      v_parent_label := v_current_label;
    END IF;
  END LOOP;

  -- Connect related neighbor categories if provided
  IF p_related_labels IS NOT NULL AND cardinality(p_related_labels) > 0 THEN
    FOR i IN 1..cardinality(p_related_labels) LOOP
      v_rel_label := btrim(p_related_labels[i]);
      IF char_length(v_rel_label) BETWEEN 3 AND 120 THEN
        v_rel_key := private.taxonomy_normalize_v1(v_rel_label);
        SELECT id INTO v_rel_id
        FROM private.work_taxonomy_categories
        WHERE canonical_key = v_rel_key AND state <> 'RETIRED'
        LIMIT 1;

        IF v_rel_id IS NULL AND v_parent_id IS NOT NULL THEN
          INSERT INTO private.work_taxonomy_categories (
            canonical_key, label, parent_id, state, source, catalog_version
          ) VALUES (
            v_rel_key, v_rel_label, v_parent_id, 'ESTABLISHED', 'AI_REVIEWED', v_version
          ) RETURNING id INTO v_rel_id;

          INSERT INTO private.work_taxonomy_category_modes (
            category_id, execution_scope, source_ref
          ) VALUES (
            v_rel_id, v_scope, 'DYNAMIC_AI_RELATED'
          ) ON CONFLICT (category_id, execution_scope) DO NOTHING;
        END IF;

        IF v_rel_id IS NOT NULL AND v_rel_id <> v_current_id THEN
          INSERT INTO private.work_taxonomy_relations (
            source_id, target_id, relation, verification, evidence_ref, version
          ) VALUES (
            v_current_id, v_rel_id, 'EQUIVALENT_VERIFIED', 'VERIFIED', 'AI_RELATED_NEIGHBOR', 1
          ), (
            v_rel_id, v_current_id, 'EQUIVALENT_VERIFIED', 'VERIFIED', 'AI_RELATED_NEIGHBOR', 1
          ) ON CONFLICT (source_id, target_id, relation) DO NOTHING;

          v_related_ids := array_append(v_related_ids, v_rel_id);
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'categoryId', v_current_id,
    'canonicalLabel', v_current_label,
    'parentId', v_parent_id,
    'parentLabel', v_parent_label,
    'scope', v_scope,
    'path', to_jsonb(p_path),
    'ancestorIds', to_jsonb(v_ancestor_ids),
    'relatedCategoryIds', to_jsonb(v_related_ids)
  );
END $fn$;

REVOKE ALL ON FUNCTION public.rpc_taxonomy_ensure_path_service(text[], text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_ensure_path_service(text[], text, text[]) TO authenticated, service_role;

-- 2. Procedure: Sync worker skills array to taxonomy worker capabilities
CREATE OR REPLACE FUNCTION private.sync_worker_skills_to_taxonomy_capabilities(
  p_account_id uuid,
  p_skills text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'private'
AS $fn$
DECLARE
  v_skill text;
  v_norm text;
  v_cat_id uuid;
  v_assigned_ids uuid[] := ARRAY[]::uuid[];
  v_requeued integer := 0;
  v_ensured jsonb;
BEGIN
  IF p_account_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ACCOUNT_ID_REQUIRED');
  END IF;

  IF p_skills IS NOT NULL AND cardinality(p_skills) > 0 THEN
    FOR i IN 1..cardinality(p_skills) LOOP
      v_skill := btrim(p_skills[i]);
      IF char_length(v_skill) BETWEEN 3 AND 120 THEN
        v_norm := private.taxonomy_normalize_v1(v_skill);

        SELECT id INTO v_cat_id
        FROM private.work_taxonomy_categories
        WHERE canonical_key = v_norm AND state <> 'RETIRED'
        LIMIT 1;

        IF v_cat_id IS NULL THEN
          -- Auto-ensure category in taxonomy
          BEGIN
            v_ensured := public.rpc_taxonomy_ensure_path_service(ARRAY[v_skill], 'ON_SITE', ARRAY[]::text[]);
            v_cat_id := (v_ensured->>'categoryId')::uuid;
          EXCEPTION WHEN OTHERS THEN
            v_cat_id := NULL;
          END;
        END IF;

        IF v_cat_id IS NOT NULL THEN
          INSERT INTO private.work_taxonomy_worker_capabilities (
            worker_account_id, category_id, confirmed_at, allow_related_offers, excluded, origin
          ) VALUES (
            p_account_id, v_cat_id, statement_timestamp(), true, false, 'WORKER_CONFIRMED'
          ) ON CONFLICT (worker_account_id, category_id) DO UPDATE
            SET confirmed_at = statement_timestamp(), updated_at = statement_timestamp(), excluded = false;

          v_assigned_ids := array_append(v_assigned_ids, v_cat_id);
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Requeue open needs so matching dispatcher wakes up immediately
  BEGIN
    v_requeued := private.requeue_open_needs_for_worker_v5(p_account_id);
  EXCEPTION WHEN OTHERS THEN
    v_requeued := 0;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'workerAccountId', p_account_id,
    'assignedCount', cardinality(v_assigned_ids),
    'assignedCategoryIds', to_jsonb(v_assigned_ids),
    'openNeedsRequeued', v_requeued
  );
END $fn$;

-- 3. Service RPC wrapper for worker skills assignment
CREATE OR REPLACE FUNCTION public.rpc_taxonomy_assign_worker_skills_service(
  p_worker_account_id uuid,
  p_skill_labels text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'private'
AS $fn$
BEGIN
  IF auth.role() NOT IN ('service_role', 'authenticated') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode='42501';
  END IF;
  RETURN private.sync_worker_skills_to_taxonomy_capabilities(p_worker_account_id, p_skill_labels);
END $fn$;

REVOKE ALL ON FUNCTION public.rpc_taxonomy_assign_worker_skills_service(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_assign_worker_skills_service(uuid, text[]) TO authenticated, service_role;

-- 4. Trigger on public.app_profiles: auto-sync skills into taxonomy capabilities
CREATE OR REPLACE FUNCTION private.worker_profile_sync_taxonomy_capabilities_trg_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'private'
AS $fn$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF NEW.kind = 'WORKER' AND NEW.skills IS NOT NULL AND cardinality(NEW.skills) > 0 THEN
    PERFORM private.sync_worker_skills_to_taxonomy_capabilities(NEW.account_id, NEW.skills);
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS worker_profile_sync_taxonomy_capabilities_trg ON public.app_profiles;
CREATE TRIGGER worker_profile_sync_taxonomy_capabilities_trg
  AFTER INSERT OR UPDATE OF skills
  ON public.app_profiles
  FOR EACH ROW
  WHEN (NEW.kind = 'WORKER')
  EXECUTE FUNCTION private.worker_profile_sync_taxonomy_capabilities_trg_fn();
