-- Read-only, service-only exploration of the current established taxonomy.
-- Existing catalog/review/admission functions and all catalog data remain intact.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $precondition$ BEGIN
 IF to_regprocedure('public.rpc_taxonomy_query_catalog_service(jsonb)') IS NOT NULL THEN
  RAISE EXCEPTION 'TAXONOMY_QUERY_RPC_ALREADY_EXISTS'; END IF;
 IF md5(pg_get_functiondef('private.taxonomy_ai_catalog_context_v1(text,integer,text)'::regprocedure))<>'0c418436bd08f75c3179c80b34a2ad23'
 OR md5(pg_get_functiondef('private.taxonomy_admission_fingerprint_v1()'::regprocedure))<>'4d0ef4615b244b3a8468f54d04ccf855'
 OR md5(pg_get_functiondef('private.taxonomy_normalize_v1(text)'::regprocedure))<>'8185e305017348588028e92397866b35'
 THEN RAISE EXCEPTION 'TAXONOMY_QUERY_DEPENDENCY_DRIFT'; END IF;
END $precondition$;

CREATE FUNCTION public.rpc_taxonomy_query_catalog_service(p_query jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path='pg_catalog'
SET statement_timeout='5s'
AS $function$
DECLARE
 v_operation text;v_scope text;v_text text;v_anchor uuid;v_ids uuid[];
 v_limit integer:=32;v_version bigint;v_fingerprint text;v_query_digest text;
 v_cursor jsonb;v_after_rank integer;v_after_key text;v_after_id uuid;
 v_count integer;v_complete integer;v_total bigint;v_more boolean;v_items jsonb;
 v_next_rank integer;v_next_key text;v_next_id uuid;v_next text;v_result jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'TAXONOMY_QUERY_DENIED' USING errcode='42501'; END IF;
 IF jsonb_typeof(p_query) IS DISTINCT FROM 'object' OR octet_length(p_query::text)>16384
 OR p_query-array['operation','scope','text','categoryId','categoryIds','limit','cursor','catalogVersion','catalogFingerprint']<>'{}'::jsonb
 OR jsonb_typeof(p_query->'operation') IS DISTINCT FROM 'string' THEN
  RAISE EXCEPTION 'TAXONOMY_QUERY_INVALID' USING errcode='22023'; END IF;
 v_operation:=p_query->>'operation';v_scope:=coalesce(p_query->>'scope','ALL');
 IF v_operation NOT IN('META','EXACT','SEARCH','ROOTS','CHILDREN','SIBLINGS','ANCESTORS','RESOLVE')
 OR v_scope NOT IN('ALL','REMOTE','ON_SITE')
 OR (p_query?'scope' AND jsonb_typeof(p_query->'scope') IS DISTINCT FROM 'string')
 OR (v_operation='EXACT' AND v_scope<>'ALL') THEN
  RAISE EXCEPTION 'TAXONOMY_QUERY_INVALID' USING errcode='22023'; END IF;
 IF p_query?'limit' THEN
  IF jsonb_typeof(p_query->'limit') IS DISTINCT FROM 'number' OR (p_query->>'limit')!~'^[0-9]{1,3}$' THEN
   RAISE EXCEPTION 'TAXONOMY_QUERY_INVALID' USING errcode='22023'; END IF;
  v_limit:=(p_query->>'limit')::integer;
 END IF;
 IF v_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'TAXONOMY_QUERY_INVALID' USING errcode='22023'; END IF;
 IF v_operation IN('SEARCH','EXACT') THEN
  IF jsonb_typeof(p_query->'text') IS DISTINCT FROM 'string' OR char_length(btrim(p_query->>'text')) NOT BETWEEN 1 AND 256
   OR (p_query->>'text')~'[[:cntrl:]]' THEN
   RAISE EXCEPTION 'TAXONOMY_QUERY_INVALID' USING errcode='22023'; END IF;
  v_text:=private.taxonomy_normalize_v1(p_query->>'text');
  IF v_text='' THEN RAISE EXCEPTION 'TAXONOMY_QUERY_INVALID' USING errcode='22023'; END IF;
 ELSIF p_query?'text' THEN RAISE EXCEPTION 'TAXONOMY_QUERY_INVALID' USING errcode='22023';
 END IF;
 IF v_operation IN('CHILDREN','SIBLINGS','ANCESTORS') THEN
  IF jsonb_typeof(p_query->'categoryId') IS DISTINCT FROM 'string'
   OR (p_query->>'categoryId')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
   RAISE EXCEPTION 'TAXONOMY_QUERY_INVALID' USING errcode='22023'; END IF;
  v_anchor:=(p_query->>'categoryId')::uuid;
 ELSIF p_query?'categoryId' THEN RAISE EXCEPTION 'TAXONOMY_QUERY_INVALID' USING errcode='22023';
 END IF;
 IF v_operation='RESOLVE' THEN
  IF jsonb_typeof(p_query->'categoryIds') IS DISTINCT FROM 'array' OR jsonb_array_length(p_query->'categoryIds') NOT BETWEEN 1 AND 100 THEN
   RAISE EXCEPTION 'TAXONOMY_QUERY_INVALID' USING errcode='22023'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_query->'categoryIds') x(value)
   WHERE jsonb_typeof(x.value) IS DISTINCT FROM 'string' OR (x.value#>>'{}')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') THEN
   RAISE EXCEPTION 'TAXONOMY_QUERY_INVALID' USING errcode='22023'; END IF;
  SELECT array_agg(DISTINCT x.value::uuid ORDER BY x.value::uuid) INTO v_ids FROM jsonb_array_elements_text(p_query->'categoryIds') x(value);
  IF cardinality(v_ids)<>jsonb_array_length(p_query->'categoryIds') THEN RAISE EXCEPTION 'TAXONOMY_QUERY_INVALID' USING errcode='22023'; END IF;
 ELSIF p_query?'categoryIds' THEN RAISE EXCEPTION 'TAXONOMY_QUERY_INVALID' USING errcode='22023';
 END IF;

 SELECT catalog_version INTO v_version FROM private.work_taxonomy_control WHERE singleton;
 v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
 IF v_version IS NULL OR v_version<1 OR v_fingerprint IS NULL OR v_fingerprint!~'^[0-9a-f]{32}$' THEN
  RAISE EXCEPTION 'TAXONOMY_QUERY_CATALOG_UNAVAILABLE' USING errcode='55000'; END IF;
 -- The same canonical snapshot pair used by signed reviews. A new request may
 -- establish the snapshot; every supplied pair and cursor must match it exactly.
 IF p_query?'catalogVersion' OR p_query?'catalogFingerprint' THEN
  IF jsonb_typeof(p_query->'catalogVersion') IS DISTINCT FROM 'number'
   OR (p_query->>'catalogVersion')!~'^[1-9][0-9]{0,17}$'
   OR jsonb_typeof(p_query->'catalogFingerprint') IS DISTINCT FROM 'string'
   OR (p_query->>'catalogFingerprint')!~'^[0-9a-f]{32}$' THEN
   RAISE EXCEPTION 'TAXONOMY_QUERY_INVALID' USING errcode='22023'; END IF;
  IF (p_query->>'catalogVersion')::bigint<>v_version OR p_query->>'catalogFingerprint'<>v_fingerprint THEN
   RAISE EXCEPTION 'TAXONOMY_QUERY_STALE_CATALOG' USING errcode='PT409'; END IF;
 END IF;
 v_query_digest:=md5(jsonb_build_object('operation',v_operation,'scope',v_scope,'text',v_text,'categoryId',v_anchor,'categoryIds',v_ids)::text);
 IF p_query->>'cursor' IS NOT NULL THEN
  IF jsonb_typeof(p_query->'cursor') IS DISTINCT FROM 'string' OR char_length(p_query->>'cursor') NOT BETWEEN 1 AND 2048 OR v_operation='META' THEN
   RAISE EXCEPTION 'TAXONOMY_QUERY_CURSOR_INVALID' USING errcode='22023'; END IF;
  BEGIN v_cursor:=convert_from(decode(p_query->>'cursor','base64'),'UTF8')::jsonb;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'TAXONOMY_QUERY_CURSOR_INVALID' USING errcode='22023'; END;
  IF jsonb_typeof(v_cursor) IS DISTINCT FROM 'object' OR NOT(v_cursor?&array['schema','query','version','fingerprint','rank','key','id'])
   OR v_cursor-array['schema','query','version','fingerprint','rank','key','id']<>'{}'::jsonb
   OR v_cursor->>'schema' IS DISTINCT FROM '1' OR v_cursor->>'query' IS DISTINCT FROM v_query_digest
   OR jsonb_typeof(v_cursor->'version') IS DISTINCT FROM 'number' OR (v_cursor->>'version')!~'^[1-9][0-9]{0,17}$'
   OR jsonb_typeof(v_cursor->'fingerprint') IS DISTINCT FROM 'string' OR (v_cursor->>'fingerprint')!~'^[0-9a-f]{32}$'
   OR jsonb_typeof(v_cursor->'rank') IS DISTINCT FROM 'number' OR (v_cursor->>'rank')!~'^[0-9]{1,9}$'
   OR jsonb_typeof(v_cursor->'key') IS DISTINCT FROM 'string' OR char_length(v_cursor->>'key') NOT BETWEEN 1 AND 160
   OR jsonb_typeof(v_cursor->'id') IS DISTINCT FROM 'string' OR (v_cursor->>'id')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
   RAISE EXCEPTION 'TAXONOMY_QUERY_CURSOR_INVALID' USING errcode='22023'; END IF;
  IF (v_cursor->>'version')::bigint<>v_version OR v_cursor->>'fingerprint'<>v_fingerprint THEN
   RAISE EXCEPTION 'TAXONOMY_QUERY_STALE_CATALOG' USING errcode='PT409'; END IF;
  v_after_rank:=(v_cursor->>'rank')::integer;v_after_key:=v_cursor->>'key';v_after_id:=(v_cursor->>'id')::uuid;
 END IF;
 IF v_anchor IS NOT NULL AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
  WHERE c.id=v_anchor AND c.state='ESTABLISHED' AND EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes m
   WHERE m.category_id=c.id AND (v_scope='ALL' OR m.execution_scope=v_scope))) THEN
  RAISE EXCEPTION 'TAXONOMY_QUERY_ANCHOR_NOT_FOUND' USING errcode='P0002'; END IF;

 IF v_operation='META' THEN
  SELECT count(*) INTO v_total FROM private.work_taxonomy_categories c WHERE c.state='ESTABLISHED'
   AND EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes m WHERE m.category_id=c.id
    AND m.execution_scope IN('ON_SITE','REMOTE') AND (v_scope='ALL' OR m.execution_scope=v_scope));
  v_items:='[]'::jsonb;v_count:=0;
 ELSE
  WITH RECURSIVE ancestry(id,parent_id,visited,distance) AS (
   SELECT c.id,c.parent_id,ARRAY[c.id],0 FROM private.work_taxonomy_categories c WHERE c.id=v_anchor AND c.state='ESTABLISHED'
   UNION ALL SELECT c.id,c.parent_id,a.visited||c.id,a.distance+1 FROM ancestry a
    JOIN private.work_taxonomy_categories c ON c.id=a.parent_id AND c.state='ESTABLISHED' WHERE NOT c.id=ANY(a.visited)
  ), candidates AS (
   SELECT c.id,c.label,c.canonical_key,c.parent_id,
    CASE WHEN v_operation='ANCESTORS' THEN (SELECT a.distance FROM ancestry a WHERE a.id=c.id)
     WHEN v_operation='SEARCH' THEN CASE
      WHEN private.taxonomy_normalize_v1(c.label)=v_text OR c.canonical_key=v_text THEN 0
      WHEN EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a WHERE a.category_id=c.id AND a.normalized_key=v_text) THEN 1
      WHEN starts_with(private.taxonomy_normalize_v1(c.label),v_text) THEN 2
      WHEN EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a WHERE a.category_id=c.id AND starts_with(a.normalized_key,v_text)) THEN 3
      ELSE 4 END ELSE 0 END sort_rank
   FROM private.work_taxonomy_categories c
   WHERE c.state='ESTABLISHED' AND EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes m
    WHERE m.category_id=c.id AND m.execution_scope IN('ON_SITE','REMOTE') AND (v_scope='ALL' OR m.execution_scope=v_scope))
   AND CASE v_operation
    WHEN 'ROOTS' THEN c.parent_id IS NULL
    WHEN 'CHILDREN' THEN c.parent_id=v_anchor
    WHEN 'SIBLINGS' THEN c.id<>v_anchor AND c.parent_id IS NOT DISTINCT FROM (SELECT parent_id FROM private.work_taxonomy_categories WHERE id=v_anchor)
    WHEN 'ANCESTORS' THEN c.id<>v_anchor AND EXISTS(SELECT 1 FROM ancestry a WHERE a.id=c.id)
    WHEN 'RESOLVE' THEN c.id=ANY(v_ids)
    WHEN 'EXACT' THEN private.taxonomy_normalize_v1(c.label)=v_text OR c.canonical_key=v_text
     OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a WHERE a.category_id=c.id AND a.normalized_key=v_text)
    WHEN 'SEARCH' THEN strpos(private.taxonomy_normalize_v1(c.label),v_text)>0 OR strpos(c.canonical_key,v_text)>0
     OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a WHERE a.category_id=c.id AND strpos(a.normalized_key,v_text)>0)
    ELSE false END
  ), selected AS (
   SELECT * FROM candidates c WHERE v_after_id IS NULL OR
    (c.sort_rank,c.canonical_key COLLATE "C",c.id)>(v_after_rank,v_after_key COLLATE "C",v_after_id)
   ORDER BY c.sort_rank,c.canonical_key COLLATE "C",c.id LIMIT(v_limit+1)
  ), page AS (
   SELECT * FROM selected ORDER BY sort_rank,canonical_key COLLATE "C",id LIMIT v_limit
  ), walk(origin_id,parent_id,labels,path_ids,visited) AS (
   SELECT p.id,p.parent_id,ARRAY[p.label],ARRAY[p.id],ARRAY[p.id] FROM page p
   UNION ALL SELECT w.origin_id,c.parent_id,ARRAY[c.label]||w.labels,ARRAY[c.id]||w.path_ids,w.visited||c.id
    FROM walk w JOIN private.work_taxonomy_categories c ON c.id=w.parent_id AND c.state='ESTABLISHED'
    WHERE NOT c.id=ANY(w.visited)
  ), paths AS (
   SELECT w.* FROM walk w WHERE w.parent_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes own_mode WHERE own_mode.category_id=w.origin_id
     AND own_mode.execution_scope IN('ON_SITE','REMOTE') AND EXISTS(SELECT 1 FROM unnest(w.path_ids) ancestor(id)
      WHERE NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes ancestor_mode
       WHERE ancestor_mode.category_id=ancestor.id AND ancestor_mode.execution_scope=own_mode.execution_scope)))
  )
  SELECT (SELECT count(*) FROM page),(SELECT count(*) FROM paths),(SELECT count(*)>v_limit FROM selected),
   (SELECT sort_rank FROM page ORDER BY sort_rank DESC,canonical_key COLLATE "C" DESC,id DESC LIMIT 1),
   (SELECT canonical_key FROM page ORDER BY sort_rank DESC,canonical_key COLLATE "C" DESC,id DESC LIMIT 1),
   (SELECT id FROM page ORDER BY sort_rank DESC,canonical_key COLLATE "C" DESC,id DESC LIMIT 1),
   (SELECT coalesce(jsonb_agg(jsonb_build_object('categoryId',p.id,'label',p.label,'parentId',p.parent_id,
    'aliases',coalesce((SELECT jsonb_agg(a.label ORDER BY a.label COLLATE "C") FROM
     (SELECT DISTINCT a.label FROM private.work_taxonomy_aliases a WHERE a.category_id=p.id) a),'[]'::jsonb),
    'modes',(SELECT jsonb_agg(m.execution_scope ORDER BY m.execution_scope) FROM private.work_taxonomy_category_modes m
     WHERE m.category_id=p.id AND m.execution_scope IN('ON_SITE','REMOTE')),
    'path',path.labels,'pathIds',path.path_ids,'isLeaf',NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
     WHERE child.parent_id=p.id AND child.state='ESTABLISHED' AND EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes cm
      WHERE cm.category_id=child.id AND cm.execution_scope IN('ON_SITE','REMOTE') AND (v_scope='ALL' OR cm.execution_scope=v_scope))))
    ORDER BY p.sort_rank,p.canonical_key COLLATE "C",p.id),'[]'::jsonb) FROM page p JOIN paths path ON path.origin_id=p.id)
   INTO v_count,v_complete,v_more,v_next_rank,v_next_key,v_next_id,v_items;
  IF v_count<>v_complete THEN RAISE EXCEPTION 'TAXONOMY_QUERY_PARENT_OR_MODE_INTEGRITY' USING errcode='55000'; END IF;
  IF v_more THEN
   v_next:=replace(encode(convert_to(jsonb_build_object('schema',1,'query',v_query_digest,'version',v_version,
    'fingerprint',v_fingerprint,'rank',v_next_rank,'key',v_next_key,'id',v_next_id)::text,'UTF8'),'base64'),E'\n','');
  END IF;
 END IF;
 v_result:=jsonb_build_object('schemaVersion','TAXONOMY_CATALOG_QUERY_V1','action','CATALOG_QUERY',
  'operation',v_operation,'scope',v_scope,'catalogVersion',v_version,'catalogFingerprint',v_fingerprint,
  'items',v_items,'count',v_count,'nextCursor',v_next,
  'classificationAuthority','NONE','capabilityAuthority','NONE','notificationAuthority','NONE',
  'requiresRequesterReview',true,'requiresWorkerConfirmation',true);
 IF v_operation='META' THEN v_result:=v_result||jsonb_build_object('totalCategories',v_total); END IF;
 -- A transport resource failure is explicit, never a partial empty catalogue.
 IF octet_length(v_result::text)>1048576 THEN RAISE EXCEPTION 'TAXONOMY_QUERY_PAGE_TOO_LARGE' USING errcode='54000'; END IF;
 RETURN v_result;
END $function$;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_query_catalog_service(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_query_catalog_service(jsonb) TO service_role;
COMMENT ON FUNCTION public.rpc_taxonomy_query_catalog_service(jsonb) IS
 'Read-only established taxonomy research. Cursor pages, not a global shortlist. Exact identity hits are candidates; owner-reviewed Save remains the only admission/competence boundary.';
COMMIT;
