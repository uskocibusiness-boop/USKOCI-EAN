-- USKOCI: owner-defined task universe. TWO ROOT SCOPES: ON_SITE / REMOTE.
-- This is additive/private browse-only catalog scaffolding, NOT live matching.
-- Prior migration requires 11 non-authoritative legacy family category anchors.
-- Subcategories use existing work_taxonomy_categories.parent_id, unlimited depth.
-- A category identity may legitimately be displayed under BOTH modes via mapping,
-- but an assignment NEVER grants a worker a capability or sends notifications.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';

DO $preflight$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='private' AND c.relname='work_taxonomy_category_modes')
 OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private' AND p.proname IN
   ('taxonomy_execution_scope_v1','taxonomy_browse_children_v1'))
 THEN RAISE EXCEPTION 'USKOCI_EXECUTION_SCOPE_ALREADY_INSTALLED'; END IF;
 IF (SELECT count(*) FROM private.work_taxonomy_legacy_kind_map)<>11
 OR (SELECT count(*) FROM private.work_taxonomy_categories)<>11
 OR (SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)<>1
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
 OR EXISTS (SELECT 1 FROM private.work_taxonomy_worker_capabilities)
 OR EXISTS (SELECT 1 FROM private.work_taxonomy_need_snapshots)
 THEN RAISE EXCEPTION 'USKOCI_EXECUTION_SCOPE_PRECONDITION_MISMATCH'; END IF;
END $preflight$;

CREATE TABLE private.work_taxonomy_category_modes (
 category_id uuid NOT NULL REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT,
 execution_scope text NOT NULL CHECK(execution_scope IN ('ON_SITE','REMOTE')),
 source_ref text NOT NULL CHECK(char_length(source_ref) BETWEEN 3 AND 120),
 mapped_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(category_id,execution_scope)
);
CREATE INDEX work_taxonomy_category_modes_scope_idx
 ON private.work_taxonomy_category_modes(execution_scope,category_id);
ALTER TABLE private.work_taxonomy_category_modes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.work_taxonomy_category_modes FROM PUBLIC;
GRANT SELECT ON private.work_taxonomy_category_modes TO service_role;

-- Migrate only the 11 verified legacy family ROOTs into ON_SITE browse.
-- No assignment is applied to worker capability records or to task revisions.
INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
SELECT category_id,'ON_SITE','LEGACY_FAMILY_ON_SITE_ROOT'
FROM private.work_taxonomy_legacy_kind_map
WHERE authority='NONE' AND family_only;

-- Supply discoverable empty remote tree roots. Operators can later add
-- reviewed, unbounded categories at any depth; live AI cannot insert yet.
UPDATE private.work_taxonomy_control
SET catalog_version=2,updated_at=now()
WHERE singleton AND auto_registration_enabled=false AND catalog_version=1;

WITH remote_root(label) AS (
 VALUES ('Digitalne usluge'),('Pisanje i jezici'),('Online podučavanje')
), inserted AS (
 INSERT INTO private.work_taxonomy_categories(
  canonical_key,label,parent_id,source,catalog_version,state
 )
 SELECT private.taxonomy_normalize_v1(label),label,NULL,'SYSTEM',2,'ESTABLISHED'
 FROM remote_root
 RETURNING id
)
INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
SELECT id,'REMOTE','CURATED_REMOTE_ROOT' FROM inserted;

-- Existing location data retains all five canonical formats.
-- STATIONARY/POINT_TO_POINT/MULTI_STOP/AREA_BASED have required physical
-- presence, although a task can be manual, intellectual or a service.
CREATE OR REPLACE FUNCTION private.taxonomy_execution_scope_v1(
 p_location_mode text
) RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER
SET search_path = pg_catalog
AS $fn$
 SELECT CASE WHEN p_location_mode='REMOTE' THEN 'REMOTE'
   WHEN p_location_mode IN
    ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED')
     THEN 'ON_SITE'
   ELSE NULL END
$fn$;

-- Paged hierarchical browsing. A ROOT mode is passed as p_scope and then
-- category.parent_id is traversed one level per call; any depth is supported.
-- Caller cannot browse a parent outside its mode.
CREATE OR REPLACE FUNCTION private.taxonomy_browse_children_v1(
 p_scope text, p_parent_id uuid DEFAULT NULL,
 p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog,private
AS $fn$
DECLARE
 v_children jsonb;
 v_total integer;
BEGIN
 IF p_scope NOT IN ('ON_SITE','REMOTE') OR p_scope IS NULL
 OR p_limit IS NULL OR p_limit<1 OR p_limit>100
 OR p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN
  RETURN jsonb_build_object('action','INVALID_SCOPE_OR_PAGING',
    'notificationAuthority','NONE');
 END IF;
 IF p_parent_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM private.work_taxonomy_categories c
   JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
   WHERE c.id=p_parent_id AND c.state<>'RETIRED'
     AND m.execution_scope=p_scope
 ) THEN
  RETURN jsonb_build_object('action','PARENT_NOT_IN_SCOPE',
   'scope',p_scope,'notificationAuthority','NONE');
 END IF;
 SELECT count(*) INTO v_total
 FROM private.work_taxonomy_categories c
 JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
 WHERE m.execution_scope=p_scope
   AND c.parent_id IS NOT DISTINCT FROM p_parent_id
   AND c.state<>'RETIRED';
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'categoryId',x.id,'label',x.label,'parentId',x.parent_id,
   'hasChildren',x.has_children
 ) ORDER BY x.label,x.id),'[]'::jsonb) INTO v_children
 FROM (
   SELECT c.id,c.label,c.parent_id,
     EXISTS(SELECT 1 FROM private.work_taxonomy_categories ch
      JOIN private.work_taxonomy_category_modes cm ON cm.category_id=ch.id
      WHERE ch.parent_id=c.id AND ch.state<>'RETIRED'
        AND cm.execution_scope=p_scope) AS has_children
   FROM private.work_taxonomy_categories c
   JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
   WHERE m.execution_scope=p_scope
     AND c.parent_id IS NOT DISTINCT FROM p_parent_id
     AND c.state<>'RETIRED'
   ORDER BY c.label,c.id
   LIMIT p_limit OFFSET p_offset
 ) x;
 RETURN jsonb_build_object(
  'action','BROWSE','scope',p_scope,'parentId',p_parent_id,
  'children',v_children,'count',v_total,'nextOffset',
  CASE WHEN v_total>p_offset+p_limit THEN p_offset+p_limit ELSE NULL END,
  'categoryBrowseOnly',true,'notificationAuthority','NONE');
END $fn$;

REVOKE ALL ON FUNCTION private.taxonomy_execution_scope_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.taxonomy_browse_children_v1(text,uuid,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.taxonomy_execution_scope_v1(text) TO service_role;
GRANT EXECUTE ON FUNCTION private.taxonomy_browse_children_v1(text,uuid,integer,integer) TO service_role;

DO $postflight$
DECLARE on_site jsonb; remote jsonb;
BEGIN
 on_site:=private.taxonomy_browse_children_v1('ON_SITE');
 remote:=private.taxonomy_browse_children_v1('REMOTE');
 IF (SELECT count(*) FROM private.work_taxonomy_category_modes)<>14
 OR (SELECT count(*) FROM private.work_taxonomy_categories)<>14
 OR (SELECT count(*) FROM private.work_taxonomy_category_modes
      WHERE execution_scope='ON_SITE')<>11
 OR (SELECT count(*) FROM private.work_taxonomy_category_modes
      WHERE execution_scope='REMOTE')<>3
 OR on_site->>'count'<>'11' OR remote->>'count'<>'3'
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
 OR (SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)<>2
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_worker_capabilities)
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_need_snapshots)
 OR has_table_privilege('service_role','private.work_taxonomy_category_modes','INSERT')
 OR has_table_privilege('authenticated','private.work_taxonomy_category_modes','SELECT')
 OR has_function_privilege('anon','private.taxonomy_browse_children_v1(text,uuid,integer,integer)','EXECUTE')
 OR has_function_privilege('authenticated','private.taxonomy_browse_children_v1(text,uuid,integer,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'USKOCI_EXECUTION_SCOPE_POSTFLIGHT_FAILED'; END IF;
END $postflight$;