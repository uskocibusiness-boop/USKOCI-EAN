\set ON_ERROR_STOP on
DO $test$
DECLARE v jsonb; s text; n int;
BEGIN
 FOR s IN SELECT unnest(ARRAY['STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED'])
 LOOP
  IF private.taxonomy_execution_scope_v1(s)<>'ON_SITE'
  THEN RAISE EXCEPTION 'LOCATED_MODE_UNMAPPED_%',s; END IF;
 END LOOP;
 IF private.taxonomy_execution_scope_v1('REMOTE')<>'REMOTE' OR
  private.taxonomy_execution_scope_v1('WRONG_MODE') IS NOT NULL THEN
  RAISE EXCEPTION 'REMOTE_OR_UNSUPPORTED_MODE_WRONG'; END IF;
 v:=private.taxonomy_browse_children_v1('ON_SITE');
 IF v->>'action'<>'BROWSE' OR (v->>'count')::integer<>11
 THEN RAISE EXCEPTION 'ON_SITE_ROOT_EXPECTED_11_%',v; END IF;
 v:=private.taxonomy_browse_children_v1('REMOTE');
 IF v->>'action'<>'BROWSE' OR (v->>'count')::integer<>3
 THEN RAISE EXCEPTION 'REMOTE_ROOT_EXPECTED_3_%',v; END IF;
 v:=private.taxonomy_browse_children_v1('REMOTE',NULL,2,0);
 IF (v->>'count')::integer<>3 OR (v->>'nextOffset')::integer<>2
 OR jsonb_array_length(v->'children')<>2
 THEN RAISE EXCEPTION 'REMOTE_PAGING_WRONG_%',v; END IF;
 v:=private.taxonomy_browse_children_v1('REMOTE',NULL,2,2);
 IF jsonb_array_length(v->'children')<>1 OR v->'nextOffset'<>'null'::jsonb
 THEN RAISE EXCEPTION 'REMOTE_LAST_PAGE_WRONG_%',v; END IF;
 v:=private.taxonomy_browse_children_v1('INVALID');
 IF v->>'action'<>'INVALID_SCOPE_OR_PAGING' THEN
  RAISE EXCEPTION 'INVALID_SCOPE_OPEN'; END IF;
 v:=private.taxonomy_browse_children_v1('REMOTE',gen_random_uuid());
 IF v->>'action'<>'PARENT_NOT_IN_SCOPE' THEN
  RAISE EXCEPTION 'FORGED_PARENT_OPEN'; END IF;
 IF has_function_privilege('authenticated',
    'private.taxonomy_browse_children_v1(text,uuid,integer,integer)','EXECUTE')
 OR has_table_privilege('service_role','private.work_taxonomy_category_modes','INSERT')
 THEN RAISE EXCEPTION 'BROWSE_DML_OR_CLIENT_EXPOSED'; END IF;
END $test$;

-- Two root branches can each contain arbitrary deep parent-child levels.
DO $test$
DECLARE
 digital uuid; moler uuid;
 graphics uuid; logo uuid; paint uuid; walls uuid;
 v jsonb;
BEGIN
 SELECT id INTO STRICT digital FROM private.work_taxonomy_categories
 WHERE canonical_key=private.taxonomy_normalize_v1('Digitalne usluge');
 SELECT id INTO STRICT moler FROM private.work_taxonomy_categories
 WHERE canonical_key=private.taxonomy_normalize_v1('Molerski radovi');
 INSERT INTO private.work_taxonomy_categories
 (canonical_key,label,parent_id,source,catalog_version,state)
 VALUES(private.taxonomy_normalize_v1('Grafički dizajn'),'Grafički dizajn',
  digital,'OPERATOR',2,'ESTABLISHED') RETURNING id INTO graphics;
 INSERT INTO private.work_taxonomy_category_modes
 (category_id,execution_scope,source_ref)
 VALUES(graphics,'REMOTE','DISPOSABLE_OPERATOR_FIXTURE');
 INSERT INTO private.work_taxonomy_categories
 (canonical_key,label,parent_id,source,catalog_version,state)
 VALUES(private.taxonomy_normalize_v1('Izrada logotipa'),'Izrada logotipa',
  graphics,'OPERATOR',2,'ESTABLISHED') RETURNING id INTO logo;
 INSERT INTO private.work_taxonomy_category_modes
 (category_id,execution_scope,source_ref)
 VALUES(logo,'REMOTE','DISPOSABLE_OPERATOR_FIXTURE');
 INSERT INTO private.work_taxonomy_categories
 (canonical_key,label,parent_id,source,catalog_version,state)
 VALUES(private.taxonomy_normalize_v1('Krečenje'),'Krečenje',moler,
  'OPERATOR',2,'ESTABLISHED') RETURNING id INTO paint;
 INSERT INTO private.work_taxonomy_category_modes
 (category_id,execution_scope,source_ref)
 VALUES(paint,'ON_SITE','DISPOSABLE_OPERATOR_FIXTURE');
 INSERT INTO private.work_taxonomy_categories
 (canonical_key,label,parent_id,source,catalog_version,state)
 VALUES(private.taxonomy_normalize_v1('Krečenje zidova'),'Krečenje zidova',
  paint,'OPERATOR',2,'ESTABLISHED') RETURNING id INTO walls;
 INSERT INTO private.work_taxonomy_category_modes
 (category_id,execution_scope,source_ref)
 VALUES(walls,'ON_SITE','DISPOSABLE_OPERATOR_FIXTURE');
 v:=private.taxonomy_browse_children_v1('REMOTE',digital);
 IF jsonb_array_length(v->'children')<>1 OR
    v->'children'->0->>'categoryId'<>graphics::text OR
    v->'children'->0->>'hasChildren'<>'true' THEN
  RAISE EXCEPTION 'REMOTE_SUBCATEGORY_INVALID_%',v; END IF;
 v:=private.taxonomy_browse_children_v1('REMOTE',graphics);
 IF jsonb_array_length(v->'children')<>1 OR
    v->'children'->0->>'categoryId'<>logo::text THEN
  RAISE EXCEPTION 'REMOTE_SUBSUBCATEGORY_INVALID_%',v; END IF;
 v:=private.taxonomy_browse_children_v1('ON_SITE',moler);
 IF jsonb_array_length(v->'children')<>1 OR
    v->'children'->0->>'categoryId'<>paint::text THEN
  RAISE EXCEPTION 'ONSITE_SUBCATEGORY_INVALID_%',v; END IF;
 v:=private.taxonomy_browse_children_v1('ON_SITE',paint);
 IF jsonb_array_length(v->'children')<>1 OR
    v->'children'->0->>'categoryId'<>walls::text THEN
  RAISE EXCEPTION 'ONSITE_SUBSUBCATEGORY_INVALID_%',v; END IF;
 IF (private.taxonomy_browse_children_v1('ON_SITE',digital))->>'action'<>'PARENT_NOT_IN_SCOPE'
 OR (private.taxonomy_browse_children_v1('REMOTE',moler))->>'action'<>'PARENT_NOT_IN_SCOPE'
 THEN RAISE EXCEPTION 'MODE_LEAKED_INTO_OPPOSITE_TREE'; END IF;
 IF EXISTS(SELECT 1 FROM private.work_taxonomy_worker_capabilities)
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_need_snapshots)
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) THEN
  RAISE EXCEPTION 'BROWSE_DEMO_CHANGED_MATCHING_AUTHORITY'; END IF;
 RAISE NOTICE 'TWO_ROOTS_TWO_LEVELS_PASS: ON_SITE Molerski->Krecenje->Zidovi / REMOTE Digital->Design->Logo, no cross-mode browsing';
END $test$;