-- Revert only while this exact DEV repair is still isolated; otherwise stop.
DO $revert$
DECLARE v_parent uuid := 'df30eb84-47fb-41ae-90f3-3f980d8abd45';
BEGIN
  PERFORM 1 FROM private.work_taxonomy_control WHERE singleton AND catalog_version=4 FOR UPDATE;
  IF NOT FOUND
    OR NOT EXISTS (SELECT 1 FROM private.work_taxonomy_category_modes
                   WHERE category_id=v_parent AND execution_scope='ON_SITE'
                     AND source_ref='OWNER_20261018_3D_PARENT_SCOPE_REPAIR')
    OR EXISTS (SELECT 1 FROM private.work_taxonomy_worker_capabilities WHERE category_id=v_parent)
    OR EXISTS (SELECT 1 FROM private.work_taxonomy_need_snapshots WHERE category_id=v_parent)
    OR EXISTS (SELECT 1 FROM private.work_taxonomy_gemini_turn_hints_v1 WHERE catalog_version=4)
    OR (SELECT count(*) FROM private.work_taxonomy_categories)<>135
    OR EXISTS (SELECT 1 FROM private.work_taxonomy_categories c
               JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id AND m.execution_scope='ON_SITE'
               WHERE c.parent_id=v_parent AND c.id<>'d5e890a0-2502-4901-8803-7462b8ca6d24'::uuid)
  THEN RAISE EXCEPTION 'TAXONOMY_3D_PARENT_MODE_REVERT_UNSAFE'; END IF;
  DELETE FROM private.work_taxonomy_category_modes
    WHERE category_id=v_parent AND execution_scope='ON_SITE'
      AND source_ref='OWNER_20261018_3D_PARENT_SCOPE_REPAIR';
  IF NOT FOUND THEN RAISE EXCEPTION 'TAXONOMY_3D_PARENT_MODE_REVERT_DRIFT'; END IF;
  UPDATE private.work_taxonomy_control SET catalog_version=3,updated_at=statement_timestamp()
    WHERE singleton AND catalog_version=4;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAXONOMY_3D_PARENT_MODE_REVERT_VERSION_DRIFT'; END IF;
END $revert$;
