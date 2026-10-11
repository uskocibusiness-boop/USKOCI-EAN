-- USKOCI DEV: existing Gemini AI + worker skills read-only mode-aware preview.
-- OWNER-APPROVED ADDITIVE FOUNDATION; NOT A PUBLISH, WORKER CONFIRMATION OR PUSH GATE.
-- No new role writes, no published task/worker mutations. All outputs advisory only.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';

DO $preflight$
BEGIN
 IF to_regprocedure('private.taxonomy_existing_ai_scoped_preview_v1(text,text,text,text[])') IS NOT NULL
 OR to_regprocedure('private.taxonomy_worker_scoped_capability_preview_v1(text,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'USKOCI_SCOPED_PREVIEWS_ALREADY_INSTALLED'; END IF;
 IF (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
 OR (SELECT count(*) FROM private.work_taxonomy_category_modes)<>14
 OR (SELECT count(*) FROM private.work_taxonomy_legacy_kind_map)<>11
 THEN RAISE EXCEPTION 'USKOCI_SCOPED_PREVIEW_PRECONDITION_MISMATCH'; END IF;
END $preflight$;

-- The running customer AI proposes need.category from its existing Gemini V2
-- conversation. A trusted service may preview it against the *actual* saved
-- execution-location mode: physical submodes are ON_SITE, REMOTE is separate.
-- Neither model text nor client-supplied booleans grant category authority.
CREATE OR REPLACE FUNCTION private.taxonomy_existing_ai_scoped_preview_v1(
 p_execution_location_mode text,
 p_ai_category text,
 p_public_description text,
 p_explicit_required_skills text[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,private
AS $bridge$
DECLARE
 v_scope text;
 v_raw jsonb;
 v_cat_id uuid;
 v_action text;
BEGIN
 v_scope:=private.taxonomy_execution_scope_v1(p_execution_location_mode);
 IF v_scope IS NULL THEN
  RETURN jsonb_build_object('action','CLARIFY','reason','EXECUTION_MODE_REQUIRED',
    'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;

 v_raw:=private.taxonomy_existing_ai_category_preview_v1(
   p_ai_category,p_public_description,p_explicit_required_skills);
 v_action:=v_raw->>'action';

 -- No speculative mode is ever substituted for a model suggestion.
 -- The claimed kind can reuse an established category ONLY if verified
 -- category-mode record exists for the relevant execution branch.
 IF v_action='SUGGEST_EXISTING_SERVICE' THEN
  BEGIN
   v_cat_id:=(v_raw->>'categoryId')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','CATALOG_ID_INVALID',
     'executionScope',v_scope,'classificationAuthority','NONE',
     'notificationAuthority','NONE');
  END;
  IF NOT EXISTS (
   SELECT 1 FROM private.work_taxonomy_category_modes m
   JOIN private.work_taxonomy_categories c ON c.id=m.category_id
   WHERE m.category_id=v_cat_id AND m.execution_scope=v_scope
     AND c.state<>'RETIRED'
  ) THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','CATEGORY_NOT_IN_EXECUTION_SCOPE',
     'executionScope',v_scope,'requiresRequesterReview',true,
     'classificationAuthority','NONE','notificationAuthority','NONE');
  END IF;
  -- Parent/family names cannot be auto-interpreted as specific competencies.
  IF EXISTS (SELECT 1 FROM private.work_taxonomy_legacy_kind_map
             WHERE category_id=v_cat_id AND family_only)
    OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories WHERE id=v_cat_id AND parent_id IS NULL)
    OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories WHERE parent_id=v_cat_id AND state<>'RETIRED')
  THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','CHOOSE_SPECIFIC_SERVICE',
     'executionScope',v_scope,'requiresRequesterReview',true,
     'classificationAuthority','NONE','notificationAuthority','NONE');
  END IF;
 END IF;

 -- For novel labels, the desired mode becomes a mandatory future binding,
 -- never a second free-floating category that the app cannot browse.
 -- Registration remains OFF and this function performs zero writes.
 RETURN v_raw || jsonb_build_object(
  'executionScope',v_scope,'requiresModeBinding',true,
  'requiresRequesterReview',true,'classificationAuthority','NONE',
  'notificationAuthority','NONE');
END $bridge$;

-- Existing Gemini WORKER_PROFILE_V1 still proposes free-text skill labels.
-- This diagnostic accepts ONE proposed label and execution mode, returning a
-- review suggestion only. It never marks a skill confirmed or changes profile.
CREATE OR REPLACE FUNCTION private.taxonomy_worker_scoped_capability_preview_v1(
 p_execution_location_mode text,
 p_skill_label text
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,private
AS $worker$
DECLARE
 v_scope text;
 v_preview jsonb;
 v_id uuid;
BEGIN
 v_scope:=private.taxonomy_execution_scope_v1(p_execution_location_mode);
 IF v_scope IS NULL THEN
  RETURN jsonb_build_object('action','CLARIFY','reason','WORKER_MODE_REQUIRED',
   'capabilityAuthority','NONE','notificationAuthority','NONE');
 END IF;
 v_preview:=private.taxonomy_preview_v1(p_skill_label);
 IF v_preview->>'action'='REUSE_EXISTING' THEN
  BEGIN v_id:=(v_preview->>'categoryId')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','CATALOG_ID_INVALID',
    'executionScope',v_scope,'capabilityAuthority','NONE','notificationAuthority','NONE');
  END;
  IF NOT EXISTS(
    SELECT 1 FROM private.work_taxonomy_category_modes m
    JOIN private.work_taxonomy_categories c ON c.id=m.category_id
    WHERE m.category_id=v_id AND m.execution_scope=v_scope AND c.state<>'RETIRED'
  ) THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','SKILL_NOT_IN_WORKER_MODE',
    'executionScope',v_scope,'capabilityAuthority','NONE','notificationAuthority','NONE');
  END IF;
  IF EXISTS(SELECT 1 FROM private.work_taxonomy_legacy_kind_map
     WHERE category_id=v_id AND family_only)
  OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories WHERE id=v_id AND parent_id IS NULL)
  OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories WHERE parent_id=v_id AND state<>'RETIRED')
  THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','CONFIRM_SPECIFIC_WORK_TYPE',
    'executionScope',v_scope,'capabilityAuthority','NONE','notificationAuthority','NONE');
  END IF;
 END IF;
 RETURN v_preview || jsonb_build_object(
  'executionScope',v_scope,'requiresWorkerReview',true,
  'requiresExplicitWorkerConfirmation',true,
  'capabilityAuthority','NONE','notificationAuthority','NONE');
END $worker$;

REVOKE ALL ON FUNCTION private.taxonomy_existing_ai_scoped_preview_v1(text,text,text,text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.taxonomy_worker_scoped_capability_preview_v1(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.taxonomy_existing_ai_scoped_preview_v1(text,text,text,text[]) TO service_role;
GRANT EXECUTE ON FUNCTION private.taxonomy_worker_scoped_capability_preview_v1(text,text) TO service_role;

DO $postflight$
DECLARE
 v jsonb;
 w jsonb;
BEGIN
 v:=private.taxonomy_existing_ai_scoped_preview_v1(
 'REMOTE','Dresiranje pasa','Želim časove dresure psa online.',ARRAY[]::text[]);
 w:=private.taxonomy_worker_scoped_capability_preview_v1('REMOTE','Grafički dizajn');
 IF v->>'executionScope'<>'REMOTE'
 OR v->>'classificationAuthority'<>'NONE'
 OR v->>'notificationAuthority'<>'NONE'
 OR w->>'capabilityAuthority'<>'NONE'
 OR w->>'notificationAuthority'<>'NONE'
 OR (SELECT count(*) FROM private.work_taxonomy_categories)<>14
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_worker_capabilities)
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_need_snapshots)
 OR has_function_privilege('authenticated','private.taxonomy_existing_ai_scoped_preview_v1(text,text,text,text[])','EXECUTE')
 OR has_function_privilege('anon','private.taxonomy_worker_scoped_capability_preview_v1(text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'USKOCI_SCOPED_PREVIEWS_POSTFLIGHT_FAILED'; END IF;
END $postflight$;
