-- Add authoritative, read-only alias context to the existing service catalog.
-- No category data, ACL, role, table, trigger or write-path change.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$
BEGIN
 IF md5(pg_get_functiondef('private.taxonomy_ai_catalog_context_v1(text,integer,text)'::regprocedure))
    <> 'b658756bc9c99acf3fd07688050e9792'
 THEN RAISE EXCEPTION 'TAXONOMY_ALIAS_CATALOG_BASE_DRIFT'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION private.taxonomy_ai_catalog_context_v1(p_execution_location_mode text, p_limit integer DEFAULT 80, p_after_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 v_scope text;
 v_version bigint;
 v_items jsonb;
 v_count integer;
 v_complete integer;
 v_has_more boolean;
 v_next text;
BEGIN
 v_scope:=private.taxonomy_execution_scope_v1(p_execution_location_mode);
 IF v_scope IS NULL OR p_limit IS NULL OR p_limit<1 OR p_limit>100
 OR (p_after_key IS NOT NULL AND char_length(p_after_key)>160)
 THEN RETURN jsonb_build_object(
   'action','CLARIFY','reason','INVALID_CATALOG_MODE_OR_PAGING',
   'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;
 SELECT catalog_version INTO v_version
 FROM private.work_taxonomy_control WHERE singleton;
 -- The strict cursor prevents shifting pages when different clients page the
 -- same version. Caller must discard results if catalogVersion changes.
 WITH RECURSIVE selected AS (
  SELECT c.id,c.label,c.canonical_key,c.parent_id
  FROM private.work_taxonomy_categories c
  JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
  WHERE m.execution_scope=v_scope AND c.state='ESTABLISHED'
    AND (p_after_key IS NULL OR c.canonical_key>p_after_key)
  ORDER BY c.canonical_key,c.id LIMIT (p_limit+1)
 ), page AS (
  SELECT * FROM selected ORDER BY canonical_key,id LIMIT p_limit
 ), walk(origin_id,parent_id,labels,visited,depth) AS (
  SELECT p.id,p.parent_id,ARRAY[p.label]::text[],ARRAY[p.id]::uuid[],0
  FROM page p
  UNION ALL
  SELECT w.origin_id,ancestor.parent_id,
    ARRAY[ancestor.label]::text[] || w.labels,
    ARRAY[ancestor.id]::uuid[] || w.visited,w.depth+1
  FROM walk w
  JOIN private.work_taxonomy_categories ancestor ON ancestor.id=w.parent_id
    AND ancestor.state='ESTABLISHED'
  JOIN private.work_taxonomy_category_modes am ON am.category_id=ancestor.id
    AND am.execution_scope=v_scope
  WHERE NOT ancestor.id=ANY(w.visited)
 ), paths AS (
  SELECT origin_id,labels FROM walk WHERE parent_id IS NULL
 )
 SELECT
  (SELECT COUNT(*) FROM page),
  (SELECT COUNT(*) FROM paths),
  (SELECT COUNT(*) > p_limit FROM selected),
  (SELECT MAX(canonical_key) FROM page),
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
   'categoryId',p.id,'label',p.label,'parentId',p.parent_id,
   'aliases',coalesce((SELECT jsonb_agg(a.label ORDER BY a.label)
      FROM (SELECT DISTINCT labels.label FROM private.work_taxonomy_aliases labels
            WHERE labels.category_id=p.id) a),'[]'::jsonb),
   'path',path.labels,'isLeaf',NOT EXISTS(
      SELECT 1 FROM private.work_taxonomy_categories child
      JOIN private.work_taxonomy_category_modes cm
       ON cm.category_id=child.id AND cm.execution_scope=v_scope
      WHERE child.parent_id=p.id AND child.state='ESTABLISHED'
   )
  ) ORDER BY p.canonical_key,p.id),'[]'::jsonb)
  FROM page p JOIN paths path ON path.origin_id=p.id)
 INTO v_count,v_complete,v_has_more,v_next,v_items;
 IF v_complete<>v_count THEN
  RETURN jsonb_build_object('action','CLARIFY',
    'reason','CATALOG_PARENT_OR_MODE_INTEGRITY_ERROR',
    'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;
 RETURN jsonb_build_object(
  'action','CATALOG_CONTEXT','scope',v_scope,'catalogVersion',v_version,
  'catalogFingerprint',private.taxonomy_admission_fingerprint_v1(),
  'items',v_items,'count',v_count,'nextAfter',
    CASE WHEN v_has_more THEN v_next ELSE NULL END,
  'requiresRequesterReview',true,'requiresWorkerConfirmation',true,
  'classificationAuthority','NONE','capabilityAuthority','NONE',
  'notificationAuthority','NONE');
END $function$
;

DO $proof$
BEGIN
 IF has_function_privilege('anon','private.taxonomy_ai_catalog_context_v1(text,integer,text)','EXECUTE')
 OR has_function_privilege('authenticated','private.taxonomy_ai_catalog_context_v1(text,integer,text)','EXECUTE')
 OR NOT has_function_privilege('service_role','private.taxonomy_ai_catalog_context_v1(text,integer,text)','EXECUTE')
 THEN RAISE EXCEPTION 'TAXONOMY_ALIAS_CATALOG_ACL_DRIFT'; END IF;
END $proof$;
