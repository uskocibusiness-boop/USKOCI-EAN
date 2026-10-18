-- Canonical DEV only. Owner confirmed on 2026-10-18 that Digitalne usluge
-- also covers ON_SITE work. This repairs the one broken catalog ancestry.
-- No category ID, parent, capability, need, relation, or push setting changes.
DO $repair$
DECLARE
  v_parent uuid := 'df30eb84-47fb-41ae-90f3-3f980d8abd45';
  v_child uuid := 'd5e890a0-2502-4901-8803-7462b8ca6d24';
  v_version bigint;
  v_bad integer;
BEGIN
  SELECT catalog_version INTO v_version FROM private.work_taxonomy_control
    WHERE singleton FOR UPDATE;
  IF v_version IS DISTINCT FROM 3
    OR NOT EXISTS (SELECT 1 FROM private.work_taxonomy_categories
                   WHERE id=v_parent AND parent_id IS NULL AND label='Digitalne usluge' AND state='ESTABLISHED')
    OR NOT EXISTS (SELECT 1 FROM private.work_taxonomy_categories
                   WHERE id=v_child AND parent_id=v_parent AND label='3D printovanje' AND state='ESTABLISHED')
    OR NOT EXISTS (SELECT 1 FROM private.work_taxonomy_category_modes
                   WHERE category_id=v_parent AND execution_scope='REMOTE')
    OR EXISTS (SELECT 1 FROM private.work_taxonomy_category_modes
               WHERE category_id=v_parent AND execution_scope='ON_SITE')
    OR NOT EXISTS (SELECT 1 FROM private.work_taxonomy_category_modes
                   WHERE category_id=v_child AND execution_scope='ON_SITE')
    OR EXISTS (SELECT 1 FROM private.work_taxonomy_worker_capabilities WHERE category_id=v_parent)
    OR EXISTS (SELECT 1 FROM private.work_taxonomy_need_snapshots WHERE category_id=v_parent)
    OR EXISTS (SELECT 1 FROM private.work_taxonomy_standard_coverage
               WHERE parent_category_id=v_parent AND child_category_id=v_child)
  THEN RAISE EXCEPTION 'TAXONOMY_3D_PARENT_MODE_PREFLIGHT_DRIFT'; END IF;

  SELECT count(*) INTO v_bad
  FROM private.work_taxonomy_categories c
  JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
  LEFT JOIN private.work_taxonomy_categories p ON p.id=c.parent_id
  WHERE c.state='ESTABLISHED' AND c.parent_id IS NOT NULL
    AND (p.id IS NULL OR p.state<>'ESTABLISHED' OR NOT EXISTS (
      SELECT 1 FROM private.work_taxonomy_category_modes pm
      WHERE pm.category_id=p.id AND pm.execution_scope=m.execution_scope));
  IF v_bad<>1 THEN RAISE EXCEPTION 'TAXONOMY_3D_PARENT_MODE_INTEGRITY_DRIFT'; END IF;

  INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
  VALUES (v_parent,'ON_SITE','OWNER_20261018_3D_PARENT_SCOPE_REPAIR');
  UPDATE private.work_taxonomy_control SET catalog_version=4,updated_at=statement_timestamp()
  WHERE singleton AND catalog_version=3;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAXONOMY_3D_PARENT_MODE_VERSION_DRIFT'; END IF;
END $repair$;
