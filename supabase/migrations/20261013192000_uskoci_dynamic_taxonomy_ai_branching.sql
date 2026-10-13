-- USKOCI V5: Dynamic Taxonomy AI Branching & Escalation Engine (13 Oct 2026)
-- Canonical DEV: leqcwgzvjsxugfgzdmth
-- Gives Gemini service authority to dynamically ensure/branch taxonomy paths,
-- connect related categories, and attach concrete category_id to needs.

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '45s';

-- 1. Enable dynamic registration control on DEV
UPDATE private.work_taxonomy_control
SET auto_registration_enabled = true, updated_at = now()
WHERE singleton;

-- 2. Add category_id direct reference to public.needs if not already present
ALTER TABLE public.needs
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES private.work_taxonomy_categories(id);

CREATE INDEX IF NOT EXISTS needs_category_id_idx
  ON public.needs(category_id) WHERE status = 'PUBLISHED';

-- 3. Procedure: rpc_taxonomy_ensure_path_service
-- Atomically ensures a full taxonomy ancestry chain (from sector to leaf)
-- and connects related category neighbors.
CREATE OR REPLACE FUNCTION public.rpc_taxonomy_ensure_path_service(
  p_path text[],
  p_execution_location_mode text,
  p_related_labels text[] DEFAULT ARRAY[]::text[]
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, private
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
  i integer;
BEGIN
  IF p_path IS NULL OR cardinality(p_path) < 1 OR cardinality(p_path) > 15 THEN
    RAISE EXCEPTION 'TAXONOMY_PATH_INVALID' USING errcode='22023';
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
        -- Ensure parent also has this execution scope so trigger passes
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
          -- Create neighbor sibling under same parent
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

-- 4. Procedure: rpc_taxonomy_assign_worker_categories_service
-- Assigns verified categories to worker profile and capabilities
CREATE OR REPLACE FUNCTION public.rpc_taxonomy_assign_worker_categories_service(
  p_worker_account_id uuid,
  p_category_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, private
AS $fn$
DECLARE
  v_cat_id uuid;
  v_labels text[] := ARRAY[]::text[];
  v_label text;
  v_assigned integer := 0;
BEGIN
  IF p_worker_account_id IS NULL OR p_category_ids IS NULL THEN
    RAISE EXCEPTION 'WORKER_OR_CATEGORIES_NULL' USING errcode='22023';
  END IF;

  FOREACH v_cat_id IN ARRAY p_category_ids LOOP
    SELECT label INTO v_label
    FROM private.work_taxonomy_categories
    WHERE id = v_cat_id AND state <> 'RETIRED';

    IF v_label IS NOT NULL THEN
      v_labels := array_append(v_labels, v_label);

      INSERT INTO private.work_taxonomy_worker_capabilities (
        worker_account_id, category_id, confirmed_at, allow_related_offers, excluded, origin
      ) VALUES (
        p_worker_account_id, v_cat_id, statement_timestamp(), true, false, 'WORKER_CONFIRMED'
      ) ON CONFLICT (worker_account_id, category_id) DO UPDATE
        SET confirmed_at = statement_timestamp(), updated_at = statement_timestamp(), excluded = false;

      v_assigned := v_assigned + 1;
    END IF;
  END LOOP;

  -- Synchronize canonical labels into public.app_profiles.skills
  IF cardinality(v_labels) > 0 THEN
    UPDATE public.app_profiles
    SET skills = array(SELECT DISTINCT unnest(coalesce(skills, ARRAY[]::text[]) || v_labels)),
        updated_at = statement_timestamp()
    WHERE account_id = p_worker_account_id AND kind = 'WORKER';
  END IF;

  RETURN jsonb_build_object(
    'workerAccountId', p_worker_account_id,
    'assignedCount', v_assigned,
    'skills', to_jsonb(v_labels)
  );
END $fn$;

REVOKE ALL ON FUNCTION public.rpc_taxonomy_assign_worker_categories_service(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_assign_worker_categories_service(uuid, uuid[]) TO authenticated, service_role;
