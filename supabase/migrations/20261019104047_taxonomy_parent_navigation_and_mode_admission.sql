-- Direct service modes remain strict; organizational ancestors do not limit a leaf.
-- No category/profile/mode data is changed by deployment. EXTEND_MODE writes only
-- after an unchanged owner-signed Save. SQL risk checks do not prove physical feasibility.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $precondition$ BEGIN
 IF to_regprocedure('private.taxonomy_handoff_valid_v1(jsonb)') IS NOT NULL
 OR to_regprocedure('private.taxonomy_category_path_valid_v1(uuid)') IS NOT NULL
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_HELPER_ALREADY_EXISTS'; END IF;
 IF md5(pg_get_functiondef('private.taxonomy_admission_fingerprint_v1()'::regprocedure)) IS DISTINCT FROM '4d0ef4615b244b3a8468f54d04ccf855'
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_PREDECESSOR_DRIFT: taxonomy_admission_fingerprint_v1'; END IF;
 IF md5(pg_get_functiondef('private.taxonomy_ai_catalog_context_v1(text,integer,text)'::regprocedure)) IS DISTINCT FROM '0c418436bd08f75c3179c80b34a2ad23'
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_PREDECESSOR_DRIFT: taxonomy_ai_catalog_context_v1'; END IF;
 IF md5(pg_get_functiondef('private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'::regprocedure)) IS DISTINCT FROM '925edfe39e5d384ef136b5e8b8df8502'
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_PREDECESSOR_DRIFT: taxonomy_review_candidate_projection_v2'; END IF;
 IF md5(pg_get_functiondef('private.taxonomy_review_exact_projection_v1(text,jsonb,jsonb)'::regprocedure)) IS DISTINCT FROM 'a461fef793d82272e73ecdaeab7f4121'
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_PREDECESSOR_DRIFT: taxonomy_review_exact_projection_v1'; END IF;
 IF md5(pg_get_functiondef('private.taxonomy_risk_triage_v1(text)'::regprocedure)) IS DISTINCT FROM 'd219247f7b98a5f1d69f70a6affc6082'
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_PREDECESSOR_DRIFT: taxonomy_risk_triage_v1'; END IF;
 IF md5(pg_get_functiondef('private.taxonomy_scope_eligible_v1(uuid,uuid)'::regprocedure)) IS DISTINCT FROM 'e3007d8a8dc5fdb25d6de97457ac5594'
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_PREDECESSOR_DRIFT: taxonomy_scope_eligible_v1'; END IF;
 IF md5(pg_get_functiondef('rpc_taxonomy_bind_reviewed_need_service(uuid,uuid,uuid,uuid,integer)'::regprocedure)) IS DISTINCT FROM '5b736e015fc6556cf70aa955b18cc7ba'
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_PREDECESSOR_DRIFT: rpc_taxonomy_bind_reviewed_need_service'; END IF;
 IF md5(pg_get_functiondef('rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)'::regprocedure)) IS DISTINCT FROM 'c71b295abe45c81036bc95679a38b00c'
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_PREDECESSOR_DRIFT: rpc_taxonomy_bind_reviewed_worker_service'; END IF;
 IF md5(pg_get_functiondef('rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)'::regprocedure)) IS DISTINCT FROM '1a4e333d1e46132f6368d9b1e9b55c12'
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_PREDECESSOR_DRIFT: rpc_taxonomy_capture_gemini_turn_hints_service'; END IF;
 IF md5(pg_get_functiondef('rpc_taxonomy_commit_admission_service(uuid)'::regprocedure)) IS DISTINCT FROM '09fba33ef3e4842c9e796eb9de45e1eb'
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_PREDECESSOR_DRIFT: rpc_taxonomy_commit_admission_service'; END IF;
 IF md5(pg_get_functiondef('rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)'::regprocedure)) IS DISTINCT FROM '567166002402129c9e092a0618bcc9f0'
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_PREDECESSOR_DRIFT: rpc_taxonomy_commit_reviewed_batch_service'; END IF;
 IF md5(pg_get_functiondef('rpc_taxonomy_prepare_admission_service(uuid,uuid,text,uuid,jsonb)'::regprocedure)) IS DISTINCT FROM 'c2b2bc625f174bdcf7ad77558c540108'
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_PREDECESSOR_DRIFT: rpc_taxonomy_prepare_admission_service'; END IF;
 IF md5(pg_get_functiondef('rpc_taxonomy_query_catalog_service(jsonb)'::regprocedure)) IS DISTINCT FROM '0ee1acaf61b8fdc2f0ae63cf46c86399'
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_PREDECESSOR_DRIFT: rpc_taxonomy_query_catalog_service'; END IF;
END $precondition$;
CREATE FUNCTION private.taxonomy_handoff_valid_v1(p_value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE
SET search_path='pg_catalog'
AS $function$
DECLARE v_city text;
BEGIN
 IF jsonb_typeof(p_value) IS DISTINCT FROM 'object'
    OR octet_length(p_value::text)>2048
    OR jsonb_typeof(p_value->'required') IS DISTINCT FROM 'boolean'
    OR p_value-array['required','shippingCountries','localExchange']<>'{}'::jsonb
 THEN RETURN false; END IF;
 IF p_value->'required'='false'::jsonb THEN RETURN p_value='{"required":false}'::jsonb; END IF;
 IF NOT(p_value?'shippingCountries' OR p_value?'localExchange') THEN RETURN false; END IF;
 IF p_value?'shippingCountries' THEN
   IF jsonb_typeof(p_value->'shippingCountries') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
   IF jsonb_array_length(p_value->'shippingCountries') NOT BETWEEN 1 AND 32
     OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_value->'shippingCountries') x(value)
       WHERE jsonb_typeof(x.value) IS DISTINCT FROM 'string' OR x.value#>>'{}' !~ '^[A-Z]{2}$')
     OR (SELECT count(DISTINCT x.value) FROM jsonb_array_elements(p_value->'shippingCountries') x(value))
         <>jsonb_array_length(p_value->'shippingCountries')
   THEN RETURN false; END IF;
 END IF;
 IF p_value?'localExchange' THEN
   IF jsonb_typeof(p_value->'localExchange') IS DISTINCT FROM 'object'
     OR NOT((p_value->'localExchange')?&array['countryCode','city'])
     OR (p_value->'localExchange')-array['countryCode','city']<>'{}'::jsonb
     OR jsonb_typeof(p_value#>'{localExchange,countryCode}') IS DISTINCT FROM 'string'
     OR p_value#>>'{localExchange,countryCode}' !~ '^[A-Z]{2}$'
     OR jsonb_typeof(p_value#>'{localExchange,city}') IS DISTINCT FROM 'string'
   THEN RETURN false; END IF;
   v_city:=p_value#>>'{localExchange,city}';
   IF v_city IS DISTINCT FROM btrim(v_city,
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
      OR char_length(v_city) NOT BETWEEN 3 AND 120
      OR v_city ~ ('['||chr(1)||'-'||chr(31)||chr(127)||'-'||chr(159)||'<>0-9]')
   THEN RETURN false; END IF;
 END IF;
 RETURN true;
END $function$;
REVOKE ALL ON FUNCTION private.taxonomy_handoff_valid_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.taxonomy_category_path_valid_v1(p_category_id uuid)
RETURNS boolean LANGUAGE sql STABLE
SET search_path='pg_catalog'
AS $function$
 WITH RECURSIVE ancestry(id,parent_id,visited) AS (
   SELECT c.id,c.parent_id,ARRAY[c.id] FROM private.work_taxonomy_categories c
    WHERE c.id=p_category_id AND c.state='ESTABLISHED'
   UNION ALL
   SELECT c.id,c.parent_id,a.visited||c.id FROM ancestry a
     JOIN private.work_taxonomy_categories c ON c.id=a.parent_id AND c.state='ESTABLISHED'
     WHERE NOT c.id=ANY(a.visited)
 )
 SELECT EXISTS(SELECT 1 FROM ancestry WHERE parent_id IS NULL)
$function$;
REVOKE ALL ON FUNCTION private.taxonomy_category_path_valid_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;

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
END $function$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_query_catalog_service(p_query jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
 SET statement_timeout TO '5s'
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
  WHERE c.id=v_anchor AND c.state='ESTABLISHED') THEN
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
   -- Ancestry is organization, not permission to perform the leaf's mode.
   -- The selected service still requires its own direct category_modes row.
   SELECT w.* FROM walk w WHERE w.parent_id IS NULL
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

CREATE OR REPLACE FUNCTION private.taxonomy_review_candidate_projection_v2(p_purpose text, p_services jsonb, p_service_modes jsonb, p_owner_account_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_exact jsonb;v_one jsonb;v_hint private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE;
 v_source text;v_version bigint;v_fingerprint text;v_item jsonb;v_proposal jsonb;
 v_service text;v_mode text;v_key text;v_parent uuid;v_parent_label text;
 v_category uuid;v_category_parent uuid;v_category_label text;v_plan jsonb;
 v_matches integer;v_path jsonb;v_label text;v_step integer;
 v_plans jsonb:='[]'::jsonb;v_visible jsonb:='[]'::jsonb;
BEGIN
 IF p_owner_account_id IS NULL OR p_conversation_id IS NULL
   OR p_owner_account_id IS DISTINCT FROM auth.uid() THEN
   RAISE EXCEPTION 'TAXONOMY_REVIEW_OWNER_MISMATCH' USING errcode='42501';
 END IF;
 -- The existing projection validates the complete service/mode selection and
 -- returns the trusted exact/alias plan when the entire request already maps.
 v_exact:=private.taxonomy_review_exact_projection_v1(
   p_purpose,p_services,p_service_modes);
 IF v_exact->>'status' NOT IN ('READY','PENDING_CLASSIFICATION') THEN RETURN v_exact; END IF;
 SELECT catalog_version INTO v_version FROM private.work_taxonomy_control
   WHERE singleton=true;
 v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
 IF v_version IS NULL OR v_fingerprint IS NULL THEN RETURN v_exact; END IF;
 IF p_purpose='WORKER_CAPABILITY' THEN
   SELECT encode(extensions.digest(
     convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),
     'sha256'),'hex') INTO v_source
   FROM private.worker_ai_sessions s
   WHERE s.account_id=p_owner_account_id AND s.conversation_id=p_conversation_id;
 ELSE
   SELECT encode(extensions.digest(private.ai_task_review_source(c.id)::text,
     'sha256'),'hex') INTO v_source
   FROM public.ai_conversations c
   WHERE c.account_id=p_owner_account_id AND c.id=p_conversation_id
     AND c.purpose='NEED_INTAKE';
 END IF;
 IF v_source IS NULL THEN RETURN v_exact; END IF;
 SELECT * INTO v_hint FROM private.work_taxonomy_gemini_turn_hints_v1 h
   WHERE h.purpose=p_purpose AND h.account_id=p_owner_account_id
     AND h.conversation_id=p_conversation_id
     AND h.source_fingerprint=v_source AND h.catalog_version=v_version
   ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN v_exact; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_service_modes) LOOP
   v_mode:=v_item->>'mode';
   v_key:=private.taxonomy_normalize_v1(v_item->>'service');
   SELECT x.value#>>'{}' INTO v_service FROM jsonb_array_elements(p_services) x(value)
     WHERE private.taxonomy_normalize_v1(x.value#>>'{}')=v_key LIMIT 1;
   v_visible:=v_visible||jsonb_build_array(jsonb_build_object(
     'service',v_service,'mode',v_mode));
   SELECT count(*),(jsonb_agg(p.value))->0 INTO v_matches,v_proposal
     FROM jsonb_array_elements(v_hint.proposals) p(value)
     WHERE private.taxonomy_normalize_v1(p.value->>'service')=v_key
       AND p.value->>'mode'=v_mode;
   -- Preserve the exact source-bound handoff value even for canonical/alias reuse.
   -- No default shipping or profile-city inference is permitted.
   IF v_matches=1 AND v_proposal?'handoff' AND
      (v_mode<>'REMOTE' OR NOT private.taxonomy_handoff_valid_v1(v_proposal->'handoff'))
   THEN RAISE EXCEPTION 'TAXONOMY_REVIEW_HANDOFF_INVALID' USING errcode='42501'; END IF;
   v_one:=private.taxonomy_review_exact_projection_v1(p_purpose,
     jsonb_build_array(v_service),jsonb_build_array(
       jsonb_build_object('service',v_service,'mode',v_mode)));
   IF v_one->>'status'='READY' THEN
     v_plan:=v_one#>'{classificationCandidates,0}';
     IF v_matches=1 AND v_proposal?'handoff' THEN
       v_plan:=v_plan||jsonb_build_object('handoff',v_proposal->'handoff');
     END IF;
     v_plans:=v_plans||jsonb_build_array(v_plan);
     CONTINUE;
   END IF;
   IF v_one->>'status'<>'PENDING_CLASSIFICATION' THEN RETURN v_exact; END IF;
   IF v_matches=1 AND v_proposal->>'action'='EXTEND_MODE' THEN
     IF (v_proposal->>'catalogVersion')::bigint<>v_version
       OR v_proposal->>'categoryId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       OR v_proposal->>'parentId'<>''
       OR v_proposal->'proposedPath' IS DISTINCT FROM '[]'::jsonb
       OR char_length(btrim(v_proposal->>'reason')) NOT BETWEEN 10 AND 1000
       OR private.taxonomy_risk_triage_v1(v_service) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
     THEN RETURN v_exact; END IF;
     v_category:=(v_proposal->>'categoryId')::uuid;
     SELECT count(DISTINCT c.id) INTO v_matches FROM private.work_taxonomy_categories c
       WHERE c.state<>'RETIRED' AND (c.canonical_key=v_key OR EXISTS(
         SELECT 1 FROM private.work_taxonomy_aliases a WHERE a.category_id=c.id AND a.normalized_key=v_key));
     SELECT c.label,c.parent_id INTO v_category_label,v_category_parent
       FROM private.work_taxonomy_categories c WHERE c.id=v_category AND c.state='ESTABLISHED'
       AND (c.canonical_key=v_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
         WHERE a.category_id=c.id AND a.normalized_key=v_key));
     IF v_matches<>1 OR v_category_label IS NULL
       OR private.taxonomy_risk_triage_v1(v_category_label) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
       OR NOT private.taxonomy_category_path_valid_v1(v_category)
       OR EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes
         WHERE category_id=v_category AND execution_scope=v_mode)
     THEN RETURN v_exact; END IF;
     -- Proposal only: admission still requires the exact signed Save below.
     v_plan:=jsonb_build_object('action','EXTEND_MODE','service',v_service,'mode',v_mode,
       'categoryId',v_category,'categoryLabel',v_category_label,'categoryParentId',v_category_parent,
       'reason',v_proposal->>'reason','catalogVersion',v_version);
     IF v_proposal?'handoff' THEN v_plan:=v_plan||jsonb_build_object('handoff',v_proposal->'handoff'); END IF;
     v_plans:=v_plans||jsonb_build_array(v_plan);
     CONTINUE;
   END IF;
   IF v_matches<>1 OR v_proposal->>'action' NOT IN ('CREATE_CHILD','CREATE_NEW_BRANCH')
      OR v_proposal->>'categoryId'<>''
      OR (v_proposal->>'catalogVersion')::bigint<>v_version
      OR (v_proposal->>'action'='CREATE_CHILD' AND (v_proposal->>'parentId') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
      OR (v_proposal->>'action'='CREATE_NEW_BRANCH' AND v_proposal->>'parentId'<>'')
   THEN RETURN v_exact; END IF;
   v_path:=v_proposal->'proposedPath';
   IF jsonb_typeof(v_path)<>'array' OR jsonb_array_length(v_path)<1
      OR private.taxonomy_normalize_v1(v_path->>(jsonb_array_length(v_path)-1))<>v_key
      OR char_length(btrim(v_proposal->>'reason')) NOT BETWEEN 10 AND 1000
   THEN RETURN v_exact; END IF;
   -- Store the exact owner-reviewed wording as the leaf. The model may have
   -- used another Serbian script, but it cannot change the visible meaning.
   v_path:=jsonb_set(v_path,ARRAY[(jsonb_array_length(v_path)-1)::text],
     to_jsonb(v_service),false);
   IF v_proposal->>'action'='CREATE_CHILD' THEN
     v_parent:=(v_proposal->>'parentId')::uuid;
     SELECT c.label INTO v_parent_label FROM private.work_taxonomy_categories c
       WHERE c.id=v_parent AND c.state='ESTABLISHED';
     IF v_parent_label IS NULL OR NOT private.taxonomy_category_path_valid_v1(v_parent)
     THEN RETURN v_exact; END IF;
   ELSE
     v_parent:=NULL;v_parent_label:=NULL;
     IF EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.canonical_key=private.taxonomy_normalize_v1(v_path->>0))
     THEN RETURN v_exact; END IF;
   END IF;
   FOR v_step IN 0..jsonb_array_length(v_path)-1 LOOP
     v_label:=btrim(v_path->>v_step);
     IF jsonb_typeof(v_path->v_step) IS DISTINCT FROM 'string'
        OR char_length(v_label) NOT BETWEEN 3 AND 120
        OR v_label ~ '[<>{}\\]' OR v_label ~ '[[:cntrl:]]'
        OR private.taxonomy_risk_triage_v1(v_label) IN ('BLOCKED','REVIEW_REQUIRED')
        OR (v_step=jsonb_array_length(v_path)-1 AND
            private.taxonomy_risk_triage_v1(v_label) IS DISTINCT FROM 'LOW_RISK_CANDIDATE')
        OR char_length(private.taxonomy_normalize_v1(v_label)) NOT BETWEEN 3 AND 160
        OR private.taxonomy_normalize_v1(v_label) !~ '[[:alpha:]]'
        OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
          WHERE a.normalized_key=private.taxonomy_normalize_v1(v_label))
     THEN RETURN v_exact; END IF;
   END LOOP;
   v_plan:=jsonb_build_object(
     'action',v_proposal->>'action','service',v_service,'mode',v_mode,
     'parentId',v_parent,'parentLabel',v_parent_label,'path',v_path,
     'reason',v_proposal->>'reason','catalogVersion',v_version);
   IF v_proposal?'handoff' THEN v_plan:=v_plan||jsonb_build_object('handoff',v_proposal->'handoff'); END IF;
   v_plans:=v_plans||jsonb_build_array(v_plan);
 END LOOP;
 -- A deep path is bounded by the writer's byte budget, not an arbitrary
 -- number of levels. Never display READY for a batch the writer cannot accept.
 IF pg_column_size(v_plans)>16000 THEN RETURN v_exact; END IF;
 -- The batch writer checks the same fingerprint under a catalog row lock.
 -- Here it protects the owner from accepting a mixed-version review.
 IF v_version IS DISTINCT FROM (SELECT catalog_version
      FROM private.work_taxonomy_control WHERE singleton=true)
    OR v_fingerprint IS DISTINCT FROM private.taxonomy_admission_fingerprint_v1()
 THEN RETURN v_exact; END IF;
 RETURN jsonb_build_object('status','READY','classificationCandidates',v_plans,
   'reviewedServiceModes',CASE WHEN p_purpose='WORKER_CAPABILITY'
     THEN v_visible ELSE '[]'::jsonb END,
   'visibleServices',v_visible,'classificationCatalogVersion',v_version,
   'classificationCatalogFingerprint',v_fingerprint);
END $function$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_capture_gemini_turn_hints_service(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_turn_id uuid, p_attempt_id uuid, p_purpose text, p_catalog_version bigint, p_proposals jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_source text;v_digest text;v_existing private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE;
 v_row jsonb;v_count integer;v_seen text[]:=ARRAY[]::text[];v_normalized text;
BEGIN
 -- Definer privileges alone are not authorization; require the actual JWT role.
 IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_DENIED' USING errcode='42501';
 END IF;
 IF p_account_id IS NULL OR p_conversation_id IS NULL OR
    p_client_request_id IS NULL OR p_turn_id IS NULL OR p_attempt_id IS NULL OR
    p_purpose NOT IN ('WORKER_CAPABILITY','NEED_SERVICE') OR
    coalesce(p_catalog_version,0) < 1 OR
    jsonb_typeof(p_proposals) IS DISTINCT FROM 'array' OR
    pg_column_size(p_proposals)>18000 THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_INVALID' USING errcode='22023';
 END IF;
 v_count:=jsonb_array_length(p_proposals);
 IF (p_purpose='WORKER_CAPABILITY' AND v_count NOT BETWEEN 1 AND 24)
    OR (p_purpose='NEED_SERVICE' AND v_count NOT BETWEEN 1 AND 6) THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_INVALID' USING errcode='22023';
 END IF;
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_proposals) LOOP
   IF jsonb_typeof(v_row)<>'object'
      OR NOT (v_row ?& array['service','mode','action','categoryId','parentId','proposedPath','reason','catalogVersion'])
      OR (v_row-array['service','mode','action','categoryId','parentId','proposedPath','reason','catalogVersion','handoff'])<>'{}'::jsonb
      OR (v_row?'handoff' AND (v_row->>'mode'<>'REMOTE'
          OR NOT private.taxonomy_handoff_valid_v1(v_row->'handoff')))
      OR jsonb_typeof(v_row->'service') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'reason') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'mode') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'action') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'categoryId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'parentId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'catalogVersion') IS DISTINCT FROM 'number'
      OR char_length(btrim(v_row->>'service')) NOT BETWEEN 3 AND 120
      OR char_length(btrim(v_row->>'reason')) NOT BETWEEN 10 AND 1000
      OR v_row->>'mode' NOT IN ('REMOTE','ON_SITE')
      OR v_row->>'action' NOT IN ('REUSE_EXISTING','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH')
      OR (v_row->>'catalogVersion')::bigint IS DISTINCT FROM p_catalog_version
      OR jsonb_typeof(v_row->'proposedPath')<>'array'
      OR (v_row->>'action' IN ('REUSE_EXISTING','EXTEND_MODE') AND
          (v_row->>'categoryId' IS NULL OR v_row->>'categoryId'=''
           OR v_row->>'parentId'<>'' OR jsonb_array_length(v_row->'proposedPath')<>0))
      OR (v_row->>'action'='CREATE_CHILD' AND
          (v_row->>'categoryId'<>'' OR v_row->>'parentId' IS NULL
           OR v_row->>'parentId'='' OR jsonb_array_length(v_row->'proposedPath')<1))
      OR (v_row->>'action'='CREATE_NEW_BRANCH' AND
          (v_row->>'categoryId'<>'' OR v_row->>'parentId'<>''
           OR jsonb_array_length(v_row->'proposedPath')<1))
   THEN RAISE EXCEPTION 'TAXONOMY_CAPTURE_PLAN_INVALID' USING errcode='22023'; END IF;
   -- Identity duplicates cannot be used to smuggle another mode/service.
   -- The canonical normalizer collapses Serbian Cyrillic/Latin variants.
   v_normalized:=private.taxonomy_normalize_v1(v_row->>'service');
   IF p_purpose='WORKER_CAPABILITY' THEN v_normalized:=v_normalized||'|'||(v_row->>'mode'); END IF;
   IF v_normalized IS NULL OR char_length(v_normalized)<3 OR v_normalized=ANY(v_seen) THEN
     RAISE EXCEPTION 'TAXONOMY_CAPTURE_DUPLICATE_OR_INVALID_SERVICE' USING errcode='22023';
   END IF;
   v_seen:=array_append(v_seen,v_normalized);
 END LOOP;

 -- Only a DURABLY COMPLETED turn with the exact owner/attempt identity
 -- can produce a hint. A claimed/failed/cancelled or forged turn cannot.
 IF p_purpose='WORKER_CAPABILITY' THEN
   -- Completion takes this same lock before revision + 1. Hold it until the
   -- hint is inserted so a later completion cannot lend its source hash to
   -- an older succeeded turn.
   PERFORM 1 FROM private.worker_ai_sessions
    WHERE account_id=p_account_id AND conversation_id=p_conversation_id FOR UPDATE;
   SELECT encode(extensions.digest(
     convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex')
   INTO v_source
   FROM private.worker_ai_turns t
   JOIN private.worker_ai_sessions s
     ON s.account_id=t.account_id AND s.conversation_id=t.conversation_id
   WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id
     AND t.client_request_id=p_client_request_id
     AND t.turn_id=p_turn_id AND t.attempt_id=p_attempt_id
     AND t.state='SUCCEEDED' AND t.cancelled_at IS NULL
     AND t.completion_hash ~ '^[0-9a-f]{64}$'
     AND t.source_revision+1=s.revision;
 ELSE
   -- Need completion serializes on the owned conversation. Its durable
   -- receipt names the assistant message produced by that exact completion.
   -- Refuse a late capture after another turn/message, or during a new turn.
   PERFORM 1 FROM public.ai_conversations
    WHERE id=p_conversation_id AND account_id=p_account_id FOR UPDATE;
   SELECT encode(extensions.digest(private.ai_task_review_source(c.id)::text,'sha256'),'hex')
   INTO v_source
   FROM private.ai_need_turn_commands t
   JOIN public.ai_conversations c ON c.id=t.conversation_id
   JOIN public.ai_messages message ON message.conversation_id=c.id
     AND message.account_id=p_account_id AND message.role='ASSISTANT'
     AND message.id::text=t.receipt->>'assistantMessageId'
   WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id
     AND t.client_request_id=p_client_request_id
     AND t.turn_id=p_turn_id AND t.attempt_id=p_attempt_id
     AND t.state='SUCCEEDED' AND t.cancelled_at IS NULL AND c.account_id=p_account_id
     AND c.purpose='NEED_INTAKE'
     AND t.receipt->'authoritative'='true'::jsonb
     AND t.receipt->>'schemaVersion'='NEED_FACT_V2'
     AND NOT EXISTS(SELECT 1 FROM public.ai_messages newer
       WHERE newer.conversation_id=c.id AND newer.sequence_no>message.sequence_no)
     AND NOT EXISTS(SELECT 1 FROM private.ai_need_turn_commands newer
       WHERE newer.conversation_id=c.id AND newer.account_id=p_account_id
         AND (newer.state='PROCESSING' OR
           (newer.state='SUCCEEDED' AND newer.updated_at>t.updated_at)));
 END IF;
 IF v_source IS NULL THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_TURN_UNCONFIRMED' USING errcode='42501';
 END IF;
 -- A succeeded LLM turn is NOT proof that any named service is in the current
 -- worker profile. The candidate's saved skills must contain every proposed
 -- service now, including after a later correction/removal in the same turn.
 -- A partial set is permitted as an untrusted hint, but the eventual owner
 -- review will refuse READY unless it covers ALL current services.
 IF p_purpose='WORKER_CAPABILITY' AND EXISTS(
    SELECT 1 FROM jsonb_array_elements(p_proposals) proposal(value)
    WHERE NOT EXISTS(
      SELECT 1 FROM private.worker_ai_sessions s,
        LATERAL jsonb_array_elements_text(s.candidate->'skills') offered(skill)
      WHERE s.account_id=p_account_id AND s.conversation_id=p_conversation_id
        AND private.taxonomy_normalize_v1(offered.skill)=
            private.taxonomy_normalize_v1(proposal.value->>'service')
    )
 ) THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_WORKER_SERVICE_NOT_OFFERED' USING errcode='22023';
 END IF;
 v_digest:=encode(extensions.digest(p_proposals::text,'sha256'),'hex');
 INSERT INTO private.work_taxonomy_gemini_turn_hints_v1(
   purpose,account_id,conversation_id,client_request_id,turn_id,attempt_id,
   source_fingerprint,catalog_version,proposals,payload_digest)
 VALUES(p_purpose,p_account_id,p_conversation_id,p_client_request_id,
   p_turn_id,p_attempt_id,v_source,p_catalog_version,p_proposals,v_digest)
 ON CONFLICT(purpose,account_id,turn_id) DO NOTHING;
 SELECT * INTO v_existing FROM private.work_taxonomy_gemini_turn_hints_v1
   WHERE purpose=p_purpose AND account_id=p_account_id AND turn_id=p_turn_id;
 IF NOT FOUND OR v_existing.client_request_id<>p_client_request_id
   OR v_existing.attempt_id<>p_attempt_id
   OR v_existing.conversation_id<>p_conversation_id
   OR v_existing.source_fingerprint<>v_source
   OR v_existing.catalog_version<>p_catalog_version
   OR v_existing.payload_digest<>v_digest
   OR v_existing.proposals IS DISTINCT FROM p_proposals THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_REPLAY_CONFLICT' USING errcode='22023';
 END IF;
 RETURN jsonb_build_object('action','HINT_CAPTURED','authority','NONE');
END $function$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_commit_reviewed_batch_service(p_owner_account_id uuid, p_request_key uuid, p_purpose text, p_source_review_id uuid, p_plans jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_id uuid;v_old private.work_taxonomy_review_batches_v1%ROWTYPE;
 v_review jsonb;v_review_digest text;v_computed_digest text;
 v_expiry timestamptz;v_saved_at timestamptz;v_review_fingerprint text;
 v_version bigint;v_review_version bigint;v_fingerprint text;v_plans_digest text;
 v_catalog_changed boolean;
 v_plan jsonb;v_service text;v_mode text;v_action text;
 v_parent uuid;v_category uuid;v_canonical uuid;v_current_parent uuid;
 v_label text;v_key text;v_ref text;v_count integer;v_created integer:=0;
 v_index integer;v_step integer;v_duplicate text;
 v_seen_services text[]:=ARRAY[]::text[];
 v_seen_targets text[]:=ARRAY[]::text[];
 v_created_ids uuid[]:=ARRAY[]::uuid[];
 v_bound boolean;v_visible_mode boolean;v_found boolean;
 v_items jsonb:='[]'::jsonb;v_result jsonb;
BEGIN
 IF p_owner_account_id IS NULL OR p_request_key IS NULL OR p_source_review_id IS NULL
    OR p_purpose NOT IN ('WORKER_CAPABILITY','NEED_SERVICE')
    OR jsonb_typeof(p_plans)<>'array'
    OR (p_purpose='WORKER_CAPABILITY' AND jsonb_array_length(p_plans) NOT BETWEEN 1 AND 24)
    OR (p_purpose='NEED_SERVICE' AND jsonb_array_length(p_plans)<>1)
    OR pg_column_size(p_plans)>16000
 THEN RAISE EXCEPTION 'BATCH_INPUT_INVALID' USING errcode='22023'; END IF;
 v_plans_digest:=encode(extensions.digest(convert_to(p_plans::text,'UTF8'),'sha256'),'hex');

 -- A replay returns its ORIGINAL receipt even if later unrelated catalog writes
 -- changed the control version. Reuse of a key for another user review fails.
 SELECT * INTO v_old FROM private.work_taxonomy_review_batches_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key FOR UPDATE;
 IF FOUND THEN
  IF v_old.purpose<>p_purpose OR v_old.source_review_id<>p_source_review_id
    OR v_old.plans_digest<>v_plans_digest OR v_old.plans IS DISTINCT FROM p_plans
  THEN RAISE EXCEPTION 'BATCH_REQUEST_KEY_REUSED' USING errcode='22023'; END IF;
  RETURN v_old.result;
 END IF;

 IF p_purpose='WORKER_CAPABILITY' THEN
  SELECT w.envelope,w.envelope->>'displayedContentDigest',w.expires_at,
   encode(extensions.digest(((w.envelope-'displayedContentDigest')
     ||jsonb_build_object('baseHash',w.base_hash))::text,'sha256'),'hex')
    INTO v_review,v_review_digest,v_expiry,v_computed_digest
   FROM private.worker_ai_reviews w
   WHERE w.id=p_source_review_id AND w.account_id=p_owner_account_id FOR SHARE;
  SELECT min(s.created_at) INTO v_saved_at FROM private.worker_ai_saves s
    WHERE s.review_id=p_source_review_id AND s.account_id=p_owner_account_id
      AND s.client_request_id=p_request_key;
  v_bound:=v_saved_at IS NOT NULL;
 ELSE
  SELECT t.envelope,t.envelope->>'displayedContentDigest',t.expires_at,
   encode(extensions.digest(jsonb_build_object('envelope',
     t.envelope-'displayedContentDigest','policy',t.policy_binding)::text,'sha256'),'hex')
    INTO v_review,v_review_digest,v_expiry,v_computed_digest
   FROM private.ai_task_reviews t
   WHERE t.id=p_source_review_id AND t.account_id=p_owner_account_id FOR SHARE;
  SELECT min(c.created_at) INTO v_saved_at FROM private.ai_task_review_commands c
    WHERE c.review_id=p_source_review_id AND c.account_id=p_owner_account_id
      AND c.client_request_id=p_request_key
      AND c.state IN ('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED');
  v_bound:=v_saved_at IS NOT NULL;
 END IF;
 IF NOT coalesce(v_bound,false) THEN
  RAISE EXCEPTION 'BATCH_EXISTING_USER_SAVE_REQUIRED' USING errcode='42501'; END IF;
 -- Approval must have happened WHILE the review was valid.
 -- Outbox retries may run later; expiring the review AFTER a successful human
 -- Save/Accept must not silently discard a confirmed service.
 IF v_review IS NULL OR v_review->'canAccept' IS DISTINCT FROM 'true'::jsonb
    OR v_saved_at>v_expiry OR v_review_digest IS NULL
    OR v_review_digest !~ '^[0-9a-f]{64}$'
    OR v_computed_digest IS DISTINCT FROM v_review_digest
    OR v_review->'classificationCandidates' IS DISTINCT FROM p_plans
 THEN RAISE EXCEPTION 'BATCH_REVIEW_NOT_BOUND' USING errcode='42501'; END IF;
 v_review_fingerprint:=v_review->>'classificationCatalogFingerprint';
 IF v_review_fingerprint IS NULL OR
    v_review_fingerprint !~ '^[0-9a-f]{32}$' THEN
   RAISE EXCEPTION 'BATCH_CATALOG_FINGERPRINT_REQUIRED' USING errcode='42501'; END IF;

 -- Single serialized admission pass: intermediate catalog bumps do NOT make
 -- later items in the SAME reviewed batch stale.
 SELECT catalog_version INTO v_version FROM private.work_taxonomy_control
  WHERE singleton FOR UPDATE;
 IF v_version IS NULL THEN RAISE EXCEPTION 'BATCH_CATALOG_MISSING'; END IF;
 -- The immutable signed plan keeps its original version. A successful Save
 -- remains authority after an unrelated catalog write, but every identity,
 -- mode and path below must still validate against the locked CURRENT catalog.
 -- Never rewrite the review, its fingerprint or the reviewed semantic plan.
 IF jsonb_typeof(v_review->'classificationCatalogVersion') IS DISTINCT FROM 'number' THEN
   RAISE EXCEPTION 'BATCH_REVIEW_CATALOG_VERSION_INVALID' USING errcode='42501'; END IF;
 v_review_version:=(v_review->>'classificationCatalogVersion')::bigint;
 v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
 IF v_review_version<1 OR v_version<v_review_version OR v_fingerprint IS NULL THEN
   RAISE EXCEPTION 'BATCH_STALE_CATALOG' USING errcode='PT409'; END IF;
 v_catalog_changed:=v_fingerprint IS DISTINCT FROM v_review_fingerprint
   OR v_version IS DISTINCT FROM v_review_version;
 FOR v_index IN 0..jsonb_array_length(p_plans)-1 LOOP
  v_plan:=p_plans->v_index;
  IF jsonb_typeof(v_plan)<>'object'
     OR v_plan ?& array['action','service','mode','catalogVersion','reason'] IS NOT TRUE
     OR jsonb_typeof(v_plan->'catalogVersion')<>'number'
     OR (v_plan->>'catalogVersion')::bigint<> (v_review->>'classificationCatalogVersion')::bigint
     OR (v_plan->>'catalogVersion')::bigint<>v_review_version
     OR jsonb_typeof(v_plan->'reason')<>'string'
     OR char_length(btrim(v_plan->>'reason')) NOT BETWEEN 10 AND 1000
  THEN RAISE EXCEPTION 'BATCH_INVALID_OR_STALE_PLAN' USING errcode='22023'; END IF;
  v_service:=btrim(v_plan->>'service');
  v_mode:=v_plan->>'mode';
  v_action:=v_plan->>'action';
  IF char_length(v_service) NOT BETWEEN 3 AND 120 OR
     v_mode NOT IN ('ON_SITE','REMOTE') OR
     v_action NOT IN ('REUSE_EXISTING','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH')
  THEN RAISE EXCEPTION 'BATCH_SCOPE_OR_SERVICE_INVALID' USING errcode='22023'; END IF;
  IF v_plan?'handoff' AND (v_mode<>'REMOTE'
     OR NOT private.taxonomy_handoff_valid_v1(v_plan->'handoff')) THEN
    RAISE EXCEPTION 'BATCH_HANDOFF_INVALID' USING errcode='22023'; END IF;
  v_key:=private.taxonomy_normalize_v1(v_service);
  v_duplicate:=v_key||'|'||v_mode;
  IF v_duplicate=ANY(v_seen_services) THEN
   RAISE EXCEPTION 'BATCH_DUPLICATE_SERVICE' USING errcode='22023'; END IF;
  v_seen_services:=array_append(v_seen_services,v_duplicate);

  -- Require the service to be a HUMAN-REVIEWED meaning in the existing
  -- profile/need content. A model may not add undeclared worker skills.
  IF p_purpose='WORKER_CAPABILITY' THEN
    v_found:=EXISTS(SELECT 1 FROM jsonb_array_elements_text(
       coalesce(v_review#>'{profile,skills}','[]'::jsonb)) x(service)
       WHERE private.taxonomy_normalize_v1(x.service)=v_key);
    v_visible_mode:=EXISTS(SELECT 1 FROM jsonb_array_elements(
      coalesce(v_review->'reviewedServiceModes','[]'::jsonb)) x(item)
       WHERE private.taxonomy_normalize_v1(x.item->>'service')=v_key
         AND x.item->>'mode'=v_mode);
  ELSE
    v_found:=EXISTS(SELECT 1 FROM jsonb_array_elements(
       coalesce(v_review->'publicProjection','[]'::jsonb)) x(fact)
       WHERE x.fact->>'key'='need.category'
         AND private.taxonomy_normalize_v1(x.fact->>'value')=v_key);
    v_visible_mode:=(CASE v_review#>>'{location,geography,mode}'
      WHEN 'REMOTE' THEN 'REMOTE'
      WHEN 'STATIONARY' THEN 'ON_SITE'
      WHEN 'POINT_TO_POINT' THEN 'ON_SITE'
      WHEN 'MULTI_STOP' THEN 'ON_SITE'
      WHEN 'AREA_BASED' THEN 'ON_SITE'
      ELSE 'UNCONFIRMED' END)=v_mode;
  END IF;
  IF NOT coalesce(v_found,false) OR NOT coalesce(v_visible_mode,false)
   THEN RAISE EXCEPTION 'BATCH_SERVICE_OR_MODE_NOT_REVIEWED' USING errcode='42501'; END IF;

  IF v_action IN ('REUSE_EXISTING','EXTEND_MODE') THEN
   IF (v_plan->>'categoryId') IS NULL OR
      v_plan ? 'parentId' OR v_plan ? 'path' THEN
    RAISE EXCEPTION 'BATCH_REUSE_STRUCTURE_INVALID' USING errcode='22023'; END IF;
   v_category:=(v_plan->>'categoryId')::uuid;
   PERFORM 1 FROM private.work_taxonomy_categories c
    WHERE c.id=v_category AND c.state='ESTABLISHED'
      AND (v_action='EXTEND_MODE' OR EXISTS(
        SELECT 1 FROM private.work_taxonomy_category_modes m
        WHERE m.category_id=c.id AND m.execution_scope=v_mode));
   IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_CATEGORY_OR_MODE_MISSING' USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '22023' END; END IF;
   -- A model-provided existing ID cannot change the actual meaning of
   -- a human-reviewed service. Only a canonical name or STORED alias qualifies.
   SELECT count(DISTINCT c.id),min(c.id::text)::uuid INTO v_count,v_canonical
     FROM private.work_taxonomy_categories c
     WHERE c.state<>'RETIRED' AND (c.canonical_key=v_key OR EXISTS (
       SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=c.id AND a.normalized_key=v_key));
   IF v_count<>1 OR v_canonical IS DISTINCT FROM v_category THEN
     RAISE EXCEPTION 'BATCH_SEMANTIC_IDENTITY_MISMATCH'
       USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '42501' END;
   END IF;
   IF v_action='EXTEND_MODE' THEN
     IF jsonb_typeof(v_plan->'categoryLabel') IS DISTINCT FROM 'string'
       OR NOT(v_plan?'categoryParentId')
       OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
         WHERE c.id=v_category AND c.label IS NOT DISTINCT FROM v_plan->>'categoryLabel'
           AND coalesce(to_jsonb(c.parent_id),'null'::jsonb) IS NOT DISTINCT FROM v_plan->'categoryParentId')
       OR NOT private.taxonomy_category_path_valid_v1(v_category) THEN
       RAISE EXCEPTION 'BATCH_EXTENSION_IDENTITY_CHANGED' USING errcode='PT409'; END IF;
     -- SQL screens risk and signed identity; it does not prove physical
     -- feasibility. The captured AI reason + visible owner review are retained.
     IF private.taxonomy_risk_triage_v1(v_service) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
       OR private.taxonomy_risk_triage_v1(v_plan->>'categoryLabel') IS DISTINCT FROM 'LOW_RISK_CANDIDATE' THEN
       RAISE EXCEPTION 'BATCH_EXTENSION_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
     IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes
       WHERE category_id=v_category AND execution_scope=v_mode) THEN
       UPDATE private.work_taxonomy_control
         SET catalog_version=catalog_version+1,updated_at=statement_timestamp()
         WHERE singleton RETURNING catalog_version INTO v_version;
       INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
         VALUES(v_category,v_mode,'REVIEWED_MODE_EXTENSION_V1');
       INSERT INTO private.work_taxonomy_audit(action,category_id,normalized_key,catalog_version,source_ref)
         VALUES('CORRECTED',v_category,private.taxonomy_normalize_v1(v_plan->>'categoryLabel'),v_version,
           'REVIEWED_MODE_EXTENSION_V1:'||p_request_key::text);
     ELSIF NOT v_catalog_changed THEN
       RAISE EXCEPTION 'BATCH_EXTENSION_MODE_ALREADY_PRESENT' USING errcode='22023';
     END IF;
   END IF;
  ELSE
   IF v_plan ? 'categoryId' OR jsonb_typeof(v_plan->'path')<>'array'
      OR jsonb_array_length(v_plan->'path')<1
      OR (v_action='CREATE_CHILD' AND (v_plan->>'parentId') IS NULL)
      OR (v_action='CREATE_NEW_BRANCH' AND
          (v_plan->'parentId' IS DISTINCT FROM 'null'::jsonb
           OR v_plan->'parentLabel' IS DISTINCT FROM 'null'::jsonb)) THEN
    RAISE EXCEPTION 'BATCH_CHILD_STRUCTURE_INVALID' USING errcode='22023'; END IF;
   -- A newly created leaf must be exactly the reviewed human service meaning.
   IF private.taxonomy_normalize_v1(v_plan->'path'->>(jsonb_array_length(v_plan->'path')-1))
       <>private.taxonomy_normalize_v1(v_service) THEN
      RAISE EXCEPTION 'BATCH_SERVICE_LEAF_MISMATCH' USING errcode='42501'; END IF;
   IF v_action='CREATE_CHILD' THEN
     v_parent:=(v_plan->>'parentId')::uuid;
     PERFORM 1 FROM private.work_taxonomy_categories c
      WHERE c.id=v_parent AND c.state='ESTABLISHED'
        AND private.taxonomy_category_path_valid_v1(c.id);
     IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_PARENT_OR_MODE_MISSING'
       USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '22023' END; END IF;
     -- The signed parent label anchors the reviewed organization as well as UUID.
     IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.id=v_parent AND c.label IS NOT DISTINCT FROM v_plan->>'parentLabel') THEN
       RAISE EXCEPTION 'BATCH_PARENT_IDENTITY_CHANGED' USING errcode='PT409'; END IF;
   ELSE
     v_parent:=NULL;
   END IF;
   FOR v_step IN 0..jsonb_array_length(v_plan->'path')-1 LOOP
    v_label:=btrim(v_plan->'path'->>v_step);
    IF jsonb_typeof(v_plan->'path'->v_step) IS DISTINCT FROM 'string' OR
       char_length(v_label) NOT BETWEEN 3 AND 120 OR
       v_label ~ '[<>{}\\]' OR v_label ~ '[[:cntrl:]]' OR
       private.taxonomy_risk_triage_v1(v_label) IN ('BLOCKED','REVIEW_REQUIRED')
    THEN RAISE EXCEPTION 'BATCH_UNSAFE_CATEGORY' USING errcode='42501'; END IF;
    IF v_step=jsonb_array_length(v_plan->'path')-1 AND
       private.taxonomy_risk_triage_v1(v_label)<>'LOW_RISK_CANDIDATE'
    THEN RAISE EXCEPTION 'BATCH_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
    v_key:=private.taxonomy_normalize_v1(v_label);
    IF char_length(v_key) NOT BETWEEN 3 AND 160 OR v_key !~ '[[:alpha:]]' OR
       EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
          WHERE a.normalized_key=v_key)
    THEN RAISE EXCEPTION 'BATCH_ALIAS_OR_KEY_COLLISION'
      USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '22023' END; END IF;
    v_category:=NULL;v_current_parent:=NULL;
    SELECT c.id,c.parent_id INTO v_category,v_current_parent
      FROM private.work_taxonomy_categories c WHERE c.canonical_key=v_key
      FOR UPDATE;
    IF FOUND THEN
     IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.id=v_category AND c.state='ESTABLISHED') THEN
       RAISE EXCEPTION 'BATCH_PATH_CATEGORY_RETIRED' USING errcode='PT409'; END IF;
     IF v_current_parent IS DISTINCT FROM v_parent THEN
       RAISE EXCEPTION 'BATCH_SEMANTIC_OR_MODE_COLLISION'
         USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '22023' END;
     END IF;
     IF v_step=jsonb_array_length(v_plan->'path')-1 AND
       NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes
       WHERE category_id=v_category AND execution_scope=v_mode) THEN
       -- Only nodes born in THIS atomic, owner-signed batch may receive a
       -- second explicitly reviewed scope. Older catalog entries remain closed.
       IF NOT (v_category=ANY(v_created_ids)) THEN
         RAISE EXCEPTION 'BATCH_SEMANTIC_OR_MODE_COLLISION'
         USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '22023' END;
       END IF;
       INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
         VALUES(v_category,v_mode,'REVIEWED_BATCH_V1');
     END IF;
    ELSE
     UPDATE private.work_taxonomy_control
      SET catalog_version=catalog_version+1,updated_at=statement_timestamp()
      WHERE singleton RETURNING catalog_version INTO v_version;
     INSERT INTO private.work_taxonomy_categories
       (canonical_key,label,parent_id,state,source,catalog_version)
     VALUES(v_key,v_label,v_parent,'ESTABLISHED','AI_REVIEWED',v_version)
      RETURNING id INTO v_category;
     INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
      VALUES(v_category,v_mode,'REVIEWED_BATCH_V1');
     INSERT INTO private.work_taxonomy_audit
      (action,category_id,normalized_key,catalog_version,source_ref)
      VALUES('AUTO_CREATED',v_category,v_key,v_version,
        'REVIEWED_BATCH_V1:'||p_request_key::text);
     v_created:=v_created+1;
     v_created_ids:=array_append(v_created_ids,v_category);
    END IF;
    v_parent:=v_category;
   END LOOP;
  END IF;
  v_ref:=v_category::text||'|'||v_mode;
  IF v_ref=ANY(v_seen_targets) THEN
    RAISE EXCEPTION 'BATCH_DUPLICATE_CANONICAL_ID' USING errcode='22023'; END IF;
  v_seen_targets:=array_append(v_seen_targets,v_ref);
  v_items:=v_items||jsonb_build_array(jsonb_build_object(
    'service',v_service,'mode',v_mode,'categoryId',v_category));
 END LOOP;
 -- All category changes and ONE receipt share the same DB transaction.
 v_result:=jsonb_build_object('status','COMMITTED','items',v_items,
  'createdCount',v_created,'catalogVersion',v_version,
  'capabilityAuthority','NONE','needRevisionAuthority','NONE',
  'notificationAuthority','NONE','requiresBinding',true);
 INSERT INTO private.work_taxonomy_review_batches_v1
 (owner_account_id,request_key,purpose,source_review_id,review_digest,
  plans_digest,plans,catalog_version,result)
 VALUES(p_owner_account_id,p_request_key,p_purpose,p_source_review_id,
  v_review_digest,v_plans_digest,p_plans,v_version,v_result);
 RETURN v_result;
END $function$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_commit_admission_service(p_admission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE v private.work_taxonomy_admissions_v1%ROWTYPE;v_version bigint;
 v_action text;v_mode text;v_parent uuid;v_id uuid;v_label text;v_key text;
 v_existing_parent uuid;v_scope_exists boolean;v_added integer:=0;v_receipt jsonb;
 i integer;v_node_count integer;
BEGIN
 SELECT * INTO v FROM private.work_taxonomy_admissions_v1 WHERE id=p_admission_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_NOT_FOUND' USING errcode='22023'; END IF;
 IF v.status='COMMITTED' THEN RETURN v.result; END IF;
 IF v.plan_digest IS DISTINCT FROM
    encode(extensions.digest(convert_to(v.plan::text,'UTF8'),'sha256'),'hex') THEN
  RAISE EXCEPTION 'ADMISSION_PLAN_TAMPERED' USING errcode='42501'; END IF;
 IF v.status<>'APPROVED' OR v.approved_at IS NULL THEN
  RAISE EXCEPTION 'ADMISSION_OWNER_APPROVAL_REQUIRED' USING errcode='42501'; END IF;
 IF v.expires_at<=statement_timestamp() THEN RAISE EXCEPTION 'ADMISSION_EXPIRED'; END IF;
 -- Serialize admission writers. Old unsafe writers must be retired before live enable.
 SELECT catalog_version INTO v_version
  FROM private.work_taxonomy_control WHERE singleton FOR UPDATE;
 IF v_version<>v.catalog_version OR
    private.taxonomy_admission_fingerprint_v1()<>v.catalog_fingerprint THEN
  RAISE EXCEPTION 'ADMISSION_STALE_CATALOG_REPLAN' USING errcode='PT409'; END IF;
 v_action:=v.plan->>'action';v_mode:=v.plan->>'mode';
 IF v_action='REUSE_EXISTING' THEN
  v_id:=(v.plan->>'categoryId')::uuid;
  PERFORM 1 FROM private.work_taxonomy_categories c
    JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
    WHERE c.id=v_id AND c.state='ESTABLISHED' AND m.execution_scope=v_mode;
  IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_CATEGORY_CHANGED'; END IF;
 ELSE
  IF v_action<>'CREATE_CHILD' OR jsonb_typeof(v.plan->'path')<>'array' THEN
    RAISE EXCEPTION 'ADMISSION_ACTION_UNSUPPORTED'; END IF;
  v_parent:=(v.plan->>'parentId')::uuid;
  v_node_count:=jsonb_array_length(v.plan->'path');
  IF v_node_count<1 OR pg_column_size(v.plan)>12000 THEN RAISE EXCEPTION 'ADMISSION_PATH_INVALID'; END IF;
  PERFORM 1 FROM private.work_taxonomy_categories c
   WHERE c.id=v_parent AND c.state='ESTABLISHED'
     AND private.taxonomy_category_path_valid_v1(c.id);
  IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_PARENT_CHANGED'; END IF;
  IF private.taxonomy_risk_triage_v1(v.plan->'path'->>(v_node_count-1))
     <> 'LOW_RISK_CANDIDATE' THEN RAISE EXCEPTION 'ADMISSION_SAFETY_REVIEW_REQUIRED'; END IF;
  FOR i IN 0..v_node_count-1 LOOP
   v_label:=btrim(v.plan->'path'->>i);
   IF jsonb_typeof(v.plan->'path'->i) IS DISTINCT FROM 'string'
      OR char_length(v_label) NOT BETWEEN 3 AND 120
      OR v_label ~ '[<>{}\\]' OR v_label ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'ADMISSION_NODE_INVALID' USING errcode='22023'; END IF;
   IF private.taxonomy_risk_triage_v1(v_label) IN ('BLOCKED','REVIEW_REQUIRED') THEN
     RAISE EXCEPTION 'ADMISSION_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
   v_key:=private.taxonomy_normalize_v1(v_label);
   IF char_length(v_key) NOT BETWEEN 3 AND 160 OR v_key !~ '[[:alpha:]]' THEN
      RAISE EXCEPTION 'ADMISSION_NORMALIZATION_INVALID'; END IF;
   IF EXISTS (SELECT 1 FROM private.work_taxonomy_aliases a
     WHERE a.normalized_key=v_key) THEN
     RAISE EXCEPTION 'ADMISSION_ALIAS_COLLISION_REVIEW_REQUIRED'; END IF;
   v_id:=NULL;
   SELECT c.id,c.parent_id INTO v_id,v_existing_parent
   FROM private.work_taxonomy_categories c WHERE c.canonical_key=v_key
   FOR UPDATE;
   IF FOUND THEN
    IF v_existing_parent IS DISTINCT FROM v_parent
       OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories WHERE id=v_id AND state='ESTABLISHED')
       OR (i=v_node_count-1 AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes
        WHERE category_id=v_id AND execution_scope=v_mode)) THEN
      RAISE EXCEPTION 'ADMISSION_MEANING_OR_MODE_COLLISION_REVIEW_REQUIRED'; END IF;
   ELSE
    UPDATE private.work_taxonomy_control
      SET catalog_version=catalog_version+1,updated_at=statement_timestamp()
      WHERE singleton RETURNING catalog_version INTO v_version;
    INSERT INTO private.work_taxonomy_categories
      (canonical_key,label,parent_id,state,source,catalog_version)
    VALUES(v_key,v_label,v_parent,'ESTABLISHED','AI_REVIEWED',v_version)
    RETURNING id INTO v_id;
    INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
     VALUES(v_id,v_mode,'OWNER_APPROVED_ADMISSION_V1');
    INSERT INTO private.work_taxonomy_audit
      (action,category_id,normalized_key,catalog_version,source_ref)
    VALUES('AUTO_CREATED',v_id,v_key,v_version,'OWNER_APPROVED_ADMISSION_V1:'||v.id::text);
    v_added:=v_added+1;
   END IF;
   v_parent:=v_id;
  END LOOP;
 END IF;
 v_receipt:=jsonb_build_object('admissionId',v.id,'categoryId',v_id,
   'catalogVersion',v_version,'createdCount',v_added,'status','COMMITTED',
   'capabilityAuthority','NONE','notificationAuthority','NONE',
   'requiresPostSaveBinding',true);
 UPDATE private.work_taxonomy_admissions_v1
  SET status='COMMITTED',committed_at=statement_timestamp(),result=v_receipt
  WHERE id=v.id;
 RETURN v_receipt;
END $function$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_prepare_admission_service(p_owner_account_id uuid, p_request_key uuid, p_purpose text, p_source_review_id uuid, p_plan jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE v_review_digest text;v_expiry timestamptz;v_version bigint;
 v_review_plan jsonb;v_expected_review_digest text;
 v_plan_digest text;v_id uuid;v_existing private.work_taxonomy_admissions_v1%ROWTYPE;
 v_action text;v_mode text;v_parent uuid;v_category uuid;
BEGIN
 IF p_owner_account_id IS NULL OR p_request_key IS NULL OR p_source_review_id IS NULL
 OR p_plan IS NULL OR jsonb_typeof(p_plan)<>'object'
 OR p_purpose NOT IN ('WORKER_CAPABILITY','NEED_SERVICE') THEN
  RAISE EXCEPTION 'ADMISSION_INPUT_INVALID' USING errcode='22023'; END IF;
 IF pg_column_size(p_plan)>12000 THEN RAISE EXCEPTION 'ADMISSION_PLAN_TOO_LARGE' USING errcode='22023'; END IF;
 v_action:=p_plan->>'action';v_mode:=p_plan->>'mode';
 IF v_action NOT IN ('REUSE_EXISTING','CREATE_CHILD') OR v_mode NOT IN ('ON_SITE','REMOTE')
 OR jsonb_typeof(p_plan->'catalogVersion')<>'number'
 OR jsonb_typeof(p_plan->'reason')<>'string'
 OR char_length(btrim(p_plan->>'reason')) NOT BETWEEN 10 AND 1000
 THEN RAISE EXCEPTION 'ADMISSION_PLAN_REVIEW_REQUIRED' USING errcode='22023'; END IF;
 IF p_purpose='WORKER_CAPABILITY' THEN
  SELECT w.envelope->>'displayedContentDigest',w.expires_at,
         w.envelope->'classificationProposal',
         encode(extensions.digest(
          ((w.envelope - 'displayedContentDigest') ||
           jsonb_build_object('baseHash',w.base_hash))::text,'sha256'),'hex')
    INTO v_review_digest,v_expiry,v_review_plan,v_expected_review_digest
  FROM private.worker_ai_reviews w
  WHERE w.id=p_source_review_id AND w.account_id=p_owner_account_id
    AND (w.envelope->>'canAccept')::boolean IS TRUE AND w.expires_at>statement_timestamp();
 ELSE
  SELECT t.envelope->>'displayedContentDigest',t.expires_at,
         t.envelope->'classificationProposal',
         encode(extensions.digest(
            jsonb_build_object('envelope',t.envelope - 'displayedContentDigest',
                               'policy',t.policy_binding)::text,'sha256'),'hex')
    INTO v_review_digest,v_expiry,v_review_plan,v_expected_review_digest
  FROM private.ai_task_reviews t
  WHERE t.id=p_source_review_id AND t.account_id=p_owner_account_id
    AND (t.envelope->>'canAccept')::boolean IS TRUE AND t.expires_at>statement_timestamp();
 END IF;
 -- Fail closed for legacy reviews: the classification must be part of the
 -- SAME server-owned payload that the owner actually reviewed.
 IF v_review_digest IS NULL OR v_review_digest !~ '^[0-9a-f]{64}$'
    OR v_review_plan IS NULL OR v_review_plan IS DISTINCT FROM p_plan
    OR v_review_digest IS DISTINCT FROM v_expected_review_digest THEN
  RAISE EXCEPTION 'ADMISSION_REVIEW_PLAN_NOT_DISPLAYED' USING errcode='42501';
 END IF;
 SELECT catalog_version INTO v_version FROM private.work_taxonomy_control WHERE singleton;
 IF v_version IS NULL OR (p_plan->>'catalogVersion')::bigint <> v_version THEN
  RAISE EXCEPTION 'ADMISSION_STALE_CATALOG' USING errcode='PT409'; END IF;
 IF v_action='REUSE_EXISTING' THEN
   IF (p_plan->>'categoryId') IS NULL THEN RAISE EXCEPTION 'ADMISSION_ID_REQUIRED'; END IF;
   v_category:=(p_plan->>'categoryId')::uuid;
   PERFORM 1 FROM private.work_taxonomy_categories c
    JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
    WHERE c.id=v_category AND c.state='ESTABLISHED' AND m.execution_scope=v_mode;
   IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_UNKNOWN_CATEGORY_OR_MODE'; END IF;
 ELSE
   IF jsonb_typeof(p_plan->'path')<>'array'
      OR jsonb_array_length(p_plan->'path')<1
      OR (p_plan->>'parentId') IS NULL THEN
    RAISE EXCEPTION 'ADMISSION_PATH_INVALID' USING errcode='22023'; END IF;
   v_parent:=(p_plan->>'parentId')::uuid;
   PERFORM 1 FROM private.work_taxonomy_categories c
     WHERE c.id=v_parent AND c.state='ESTABLISHED'
       AND private.taxonomy_category_path_valid_v1(c.id);
   IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_UNKNOWN_PARENT_OR_MODE'; END IF;
   -- New root or subtree restructure always requires a separate operator gate.
   IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_plan->'path') t(label)
      WHERE char_length(btrim(t.label)) NOT BETWEEN 3 AND 120
        OR btrim(t.label) ~ '[<>{}\\]' OR btrim(t.label) ~ '[[:cntrl:]]')
     THEN RAISE EXCEPTION 'ADMISSION_NODE_INVALID' USING errcode='22023'; END IF;
   IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_plan->'path') t(label)
      WHERE jsonb_typeof(t.label) IS DISTINCT FROM 'string'
        OR private.taxonomy_normalize_v1(t.label#>>'{}') !~ '[[:alpha:]]')
     THEN RAISE EXCEPTION 'ADMISSION_NODE_INVALID' USING errcode='22023'; END IF;
   -- Every new level is screened; a safe leaf cannot hide an unsafe ancestor.
   IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_plan->'path') t(label)
      WHERE private.taxonomy_risk_triage_v1(t.label) IN ('BLOCKED','REVIEW_REQUIRED'))
     THEN RAISE EXCEPTION 'ADMISSION_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
   -- Server risk triage is a risk gate, NOT a semantic classifier.
   IF private.taxonomy_risk_triage_v1(p_plan->'path'->>(jsonb_array_length(p_plan->'path')-1))
      <> 'LOW_RISK_CANDIDATE'
     THEN RAISE EXCEPTION 'ADMISSION_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
 END IF;
 v_plan_digest:=encode(extensions.digest(convert_to(p_plan::text,'UTF8'),'sha256'),'hex');
 SELECT * INTO v_existing FROM private.work_taxonomy_admissions_v1
 WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key;
 IF FOUND THEN
  IF v_existing.plan_digest<>v_plan_digest OR v_existing.source_review_id<>p_source_review_id
      OR v_existing.purpose<>p_purpose THEN
   RAISE EXCEPTION 'ADMISSION_REQUEST_REUSED' USING errcode='22023'; END IF;
  RETURN jsonb_build_object('admissionId',v_existing.id,'planDigest',v_existing.plan_digest,
    'status',v_existing.status,'catalogVersion',v_existing.catalog_version);
 END IF;
 INSERT INTO private.work_taxonomy_admissions_v1
 (owner_account_id,request_key,purpose,source_review_id,source_review_digest,plan,
  plan_digest,catalog_version,catalog_fingerprint,expires_at)
 VALUES(p_owner_account_id,p_request_key,p_purpose,p_source_review_id,v_review_digest,p_plan,
 v_plan_digest,v_version,private.taxonomy_admission_fingerprint_v1(),
 least(v_expiry,statement_timestamp()+interval '30 minutes'))
 RETURNING id INTO v_id;
 RETURN jsonb_build_object('admissionId',v_id,'planDigest',v_plan_digest,
  'status','PENDING','catalogVersion',v_version);
END $function$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_bind_reviewed_need_service(p_owner_account_id uuid, p_request_key uuid, p_source_review_id uuid, p_need_id uuid, p_need_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_existing private.work_taxonomy_need_bindings_v1%ROWTYPE;
 v_batch private.work_taxonomy_review_batches_v1%ROWTYPE;
 v_review private.ai_task_reviews%ROWTYPE;
 v_command private.ai_task_review_commands%ROWTYPE;
 v_need public.needs%ROWTYPE;
 v_plan jsonb;v_item jsonb;v_category uuid;v_scope text;v_service text;v_category_version bigint;
 v_expected_digest text;v_result jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
   RAISE EXCEPTION 'NEED_BINDER_SERVICE_ROLE_REQUIRED' USING errcode='42501';
 END IF;
 IF p_owner_account_id IS NULL OR p_request_key IS NULL OR p_source_review_id IS NULL
    OR p_need_id IS NULL OR coalesce(p_need_revision,0)<1 THEN
   RAISE EXCEPTION 'NEED_BINDER_INPUT_INVALID' USING errcode='22023';
 END IF;
 SELECT * INTO v_existing FROM private.work_taxonomy_need_bindings_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key FOR UPDATE;
 IF FOUND THEN
   IF v_existing.source_review_id<>p_source_review_id OR v_existing.need_id<>p_need_id
     OR v_existing.need_revision<>p_need_revision THEN
     RAISE EXCEPTION 'NEED_BINDER_REQUEST_KEY_REUSED' USING errcode='22023';
   END IF;
   RETURN v_existing.result;
 END IF;
 SELECT * INTO v_batch FROM private.work_taxonomy_review_batches_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key
    AND source_review_id=p_source_review_id AND purpose='NEED_SERVICE' FOR SHARE;
 IF NOT FOUND OR v_batch.result->>'status'<>'COMMITTED'
   OR v_batch.result->'requiresBinding' IS DISTINCT FROM 'true'::jsonb
   OR v_batch.result->'capabilityAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR v_batch.result->'notificationAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR jsonb_typeof(v_batch.result->'items')<>'array'
   OR jsonb_array_length(v_batch.result->'items')<>1 THEN
   RAISE EXCEPTION 'NEED_BINDER_ADMISSION_NOT_COMMITTED' USING errcode='42501';
 END IF;
 SELECT * INTO v_review FROM private.ai_task_reviews r
  WHERE r.id=p_source_review_id AND r.account_id=p_owner_account_id FOR SHARE;
 IF NOT FOUND OR v_review.envelope->>'classificationState'<>'READY'
   OR v_review.envelope->>'displayedContentDigest' IS DISTINCT FROM v_batch.review_digest
   OR v_review.envelope->'classificationCandidates' IS DISTINCT FROM v_batch.plans
   OR jsonb_array_length(coalesce(v_review.envelope->'classificationCandidates','[]'::jsonb))<>1 THEN
   RAISE EXCEPTION 'NEED_BINDER_REVIEW_NOT_BOUND' USING errcode='42501';
 END IF;
 v_expected_digest:=encode(extensions.digest(jsonb_build_object('envelope',
   v_review.envelope-'displayedContentDigest','policy',v_review.policy_binding)::text,'sha256'),'hex');
 IF v_expected_digest<>v_batch.review_digest THEN
   RAISE EXCEPTION 'NEED_BINDER_REVIEW_DIGEST_INVALID' USING errcode='42501';
 END IF;
 SELECT * INTO v_command FROM private.ai_task_review_commands c
  WHERE c.review_id=p_source_review_id AND c.account_id=p_owner_account_id
    AND c.client_request_id=p_request_key AND c.need_id=p_need_id
    AND c.need_revision=p_need_revision
    AND c.state IN ('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NEED_BINDER_SAVE_REQUIRED' USING errcode='42501'; END IF;
 v_plan:=v_batch.plans->0;
 v_item:=v_batch.result->'items'->0;
 IF v_plan->>'mode' IS DISTINCT FROM v_item->>'mode'
   OR private.taxonomy_normalize_v1(v_plan->>'service')
      IS DISTINCT FROM private.taxonomy_normalize_v1(v_item->>'service')
   OR v_plan->>'action' NOT IN ('REUSE_EXISTING','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH')
 THEN RAISE EXCEPTION 'NEED_BINDER_CATEGORY_RECEIPT_INVALID' USING errcode='42501'; END IF;
 v_category:=(v_item->>'categoryId')::uuid;
 v_category_version:=v_batch.catalog_version;
 SELECT * INTO v_need FROM public.needs n WHERE n.id=p_need_id FOR UPDATE;
 IF NOT FOUND OR v_need.requester_account_id<>p_owner_account_id OR
    v_need.revision<>p_need_revision OR v_need.status NOT IN ('DRAFT','PUBLISHED','SELECTION') THEN
   RAISE EXCEPTION 'NEED_BINDER_CURRENT_REVISION_REQUIRED' USING errcode='PT409';
 END IF;
 v_scope:=private.taxonomy_execution_scope_v1(v_need.execution_location_mode);
 IF v_scope IS NULL OR v_scope<>v_item->>'mode'
   OR private.taxonomy_normalize_v1(v_need.category)
      <>private.taxonomy_normalize_v1(v_item->>'service')
 THEN RAISE EXCEPTION 'NEED_BINDER_SERVICE_OR_MODE_STALE' USING errcode='PT409'; END IF;
 PERFORM 1 FROM private.work_taxonomy_categories c
  JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
  WHERE c.id=v_category AND c.state='ESTABLISHED' AND m.execution_scope=v_scope;
 IF NOT FOUND THEN RAISE EXCEPTION 'NEED_BINDER_CATEGORY_RETIRED' USING errcode='42501'; END IF;
 IF v_need.category_id IS NOT NULL AND v_need.category_id<>v_category THEN
   RAISE EXCEPTION 'NEED_BINDER_CONFLICTING_EXISTING_CATEGORY' USING errcode='PT409'; END IF;
 PERFORM 1 FROM private.work_taxonomy_need_snapshots s
  WHERE s.need_id=p_need_id AND s.need_revision=p_need_revision FOR UPDATE;
 IF FOUND THEN RAISE EXCEPTION 'NEED_BINDER_EXISTING_SNAPSHOT_REVIEW_REQUIRED' USING errcode='PT409'; END IF;
 -- Same transaction: category reference + single authoritative revision
 -- snapshot + durable replay receipt. A failed write rolls all three back.
 UPDATE public.needs SET category_id=v_category WHERE id=p_need_id
    AND revision=p_need_revision AND category_id IS DISTINCT FROM v_category;
 INSERT INTO private.work_taxonomy_need_snapshots
  (need_id,need_revision,category_id,catalog_version,reviewed_by_requester,
   source,classification_state,original_category)
 VALUES(p_need_id,p_need_revision,v_category,v_category_version,true,
   'OWNER_REVIEWED_BATCH','CONFIRMED',v_need.category);
 v_result:=jsonb_build_object('status','BOUND_NEED_REVISION',
   'needId',p_need_id,'needRevision',p_need_revision,'categoryId',v_category,
   'catalogVersion',v_category_version,
   'dispatchAuthority','NONE','notificationAuthority','NONE');
 INSERT INTO private.work_taxonomy_need_bindings_v1
  (owner_account_id,request_key,source_review_id,need_id,need_revision,
   category_id,catalog_version,result)
 VALUES(p_owner_account_id,p_request_key,p_source_review_id,p_need_id,
   p_need_revision,v_category,v_category_version,v_result);
 RETURN v_result;
END $function$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_bind_reviewed_worker_service(p_owner_account_id uuid, p_request_key uuid, p_source_review_id uuid, p_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_existing private.work_taxonomy_worker_bindings_v1%ROWTYPE;
 v_batch private.work_taxonomy_review_batches_v1%ROWTYPE;
 v_review private.worker_ai_reviews%ROWTYPE;
 v_save private.worker_ai_saves%ROWTYPE;
 v_profile public.app_profiles%ROWTYPE;
 v_digest text;v_item jsonb;v_plan jsonb;v_category uuid;
 v_key text;v_mode text;v_seen text[]:=ARRAY[]::text[];
 v_modes text[]:=ARRAY[]::text[];v_onsite boolean:=false;v_remote boolean:=false;
 v_result jsonb;v_count integer:=0;v_skills jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'WORKER_BINDER_SERVICE_ROLE_REQUIRED' USING errcode='42501';
 END IF;
 IF p_owner_account_id IS NULL OR p_request_key IS NULL
   OR p_source_review_id IS NULL OR p_profile_id IS NULL THEN
  RAISE EXCEPTION 'WORKER_BINDER_INPUT_INVALID' USING errcode='22023';
 END IF;
 -- Replays are read-only and bound to the very same worker/review/request.
 SELECT * INTO v_existing FROM private.work_taxonomy_worker_bindings_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key FOR UPDATE;
 IF FOUND THEN
  IF v_existing.source_review_id<>p_source_review_id OR v_existing.profile_id<>p_profile_id
  THEN RAISE EXCEPTION 'WORKER_BINDER_REQUEST_KEY_REUSED' USING errcode='22023'; END IF;
  RETURN v_existing.result;
 END IF;
 SELECT * INTO v_batch FROM private.work_taxonomy_review_batches_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key
   AND source_review_id=p_source_review_id AND purpose='WORKER_CAPABILITY'
  FOR SHARE;
 IF NOT FOUND OR v_batch.result->>'status'<>'COMMITTED'
   OR v_batch.result->'requiresBinding' IS DISTINCT FROM 'true'::jsonb
   OR v_batch.result->'capabilityAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR v_batch.result->'notificationAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR jsonb_typeof(v_batch.plans)<>'array'
   OR jsonb_typeof(v_batch.result->'items')<>'array'
   OR jsonb_array_length(v_batch.plans) NOT BETWEEN 1 AND 24
   OR jsonb_array_length(v_batch.result->'items')<>jsonb_array_length(v_batch.plans)
 THEN RAISE EXCEPTION 'WORKER_BINDER_ADMISSION_NOT_COMMITTED' USING errcode='42501'; END IF;
 SELECT * INTO v_review FROM private.worker_ai_reviews
  WHERE id=p_source_review_id AND account_id=p_owner_account_id FOR SHARE;
 IF NOT FOUND OR v_review.envelope->>'classificationState'<>'READY'
   OR v_review.envelope->>'displayedContentDigest' IS DISTINCT FROM v_batch.review_digest
   OR v_review.envelope->'classificationCandidates' IS DISTINCT FROM v_batch.plans
   OR v_review.envelope->'canAccept' IS DISTINCT FROM 'true'::jsonb
   OR jsonb_typeof(v_review.envelope->'reviewedServiceModes')<>'array'
   OR jsonb_array_length(v_review.envelope->'reviewedServiceModes')
       <>jsonb_array_length(v_batch.plans)
   OR v_review.envelope->>'profileId' IS DISTINCT FROM p_profile_id::text
 THEN RAISE EXCEPTION 'WORKER_BINDER_REVIEW_NOT_BOUND' USING errcode='42501'; END IF;
 v_digest:=encode(extensions.digest(
  ((v_review.envelope-'displayedContentDigest')
    ||jsonb_build_object('baseHash',v_review.base_hash))::text,'sha256'),'hex');
 IF v_digest IS DISTINCT FROM v_batch.review_digest THEN
   RAISE EXCEPTION 'WORKER_BINDER_REVIEW_DIGEST_INVALID' USING errcode='42501'; END IF;
 SELECT * INTO v_save FROM private.worker_ai_saves
  WHERE review_id=p_source_review_id AND account_id=p_owner_account_id
    AND client_request_id=p_request_key FOR SHARE;
 IF NOT FOUND OR v_save.created_at>v_review.expires_at
   OR v_save.receipt->'saved' IS DISTINCT FROM 'true'::jsonb
   OR v_save.receipt->>'profileId' IS DISTINCT FROM p_profile_id::text
   OR v_save.receipt->>'profileStatus'<>'ACTIVE'
 THEN RAISE EXCEPTION 'WORKER_BINDER_SAVE_OR_ACTIVATION_REQUIRED' USING errcode='42501'; END IF;
 -- A delayed outbox command from an OLD Save must never re-enable modes
 -- superseded by a newer user-confirmed worker review for this same profile.
 IF EXISTS(SELECT 1 FROM private.worker_ai_saves newer
   WHERE newer.account_id=p_owner_account_id
     AND newer.created_at>v_save.created_at
     AND newer.receipt->>'profileId'=p_profile_id::text)
 THEN RAISE EXCEPTION 'WORKER_BINDER_NEWER_SAVE_EXISTS' USING errcode='PT409'; END IF;
 -- Hold current worker profile throughout the transaction. Reject any edit
 -- after the reviewed Save, even if the new skill text happens to be identical.
 SELECT * INTO v_profile FROM public.app_profiles
  WHERE id=p_profile_id AND account_id=p_owner_account_id AND kind='WORKER'
  FOR UPDATE;
 v_skills:=v_review.envelope#>'{profile,skills}';
 IF NOT FOUND OR v_profile.profile_status<>'ACTIVE'
   OR v_profile.updated_at>v_save.created_at
   OR jsonb_typeof(v_skills)<>'array'
   OR to_jsonb(v_profile.skills) IS DISTINCT FROM v_skills
 THEN RAISE EXCEPTION 'WORKER_BINDER_CURRENT_PROFILE_REQUIRED' USING errcode='PT409'; END IF;
 -- Make every scope and category EXACT. A related branch never certifies ability.
 FOR v_count IN 0..jsonb_array_length(v_batch.plans)-1 LOOP
   v_plan:=v_batch.plans->v_count;
   v_item:=v_batch.result->'items'->v_count;
   v_key:=private.taxonomy_normalize_v1(v_item->>'service');
   v_mode:=v_item->>'mode';
   IF v_plan->>'mode' IS DISTINCT FROM v_mode
     OR private.taxonomy_normalize_v1(v_plan->>'service') IS DISTINCT FROM v_key
     OR v_plan->>'action' NOT IN ('REUSE_EXISTING','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH')
     OR v_mode NOT IN ('ON_SITE','REMOTE')
     OR jsonb_typeof(v_item->'categoryId')<>'string'
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_skills) offered(value)
       WHERE private.taxonomy_normalize_v1(offered.value#>>'{}')=v_key)
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(
        v_review.envelope->'reviewedServiceModes') m(value)
       WHERE private.taxonomy_normalize_v1(m.value->>'service')=v_key
         AND m.value->>'mode'=v_mode)
     OR v_key||'|'||v_mode=ANY(v_seen)
   THEN RAISE EXCEPTION 'WORKER_BINDER_SERVICE_OR_MODE_NOT_REVIEWED' USING errcode='42501'; END IF;
   v_seen:=array_append(v_seen,v_key||'|'||v_mode);
   v_category:=(v_item->>'categoryId')::uuid;
   IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
      JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
      WHERE c.id=v_category AND c.state='ESTABLISHED'
        AND cm.execution_scope=v_mode
        AND (c.canonical_key=v_key OR EXISTS(
          SELECT 1 FROM private.work_taxonomy_aliases a
          WHERE a.category_id=c.id AND a.normalized_key=v_key)))
   THEN RAISE EXCEPTION 'WORKER_BINDER_CATEGORY_STALE' USING errcode='42501'; END IF;
   -- A past withdrawal (excluded=true) is NOT permanent: the owner may
   -- deliberately offer this service again in a NEW signed Save. ONLY this
   -- binder may restore it, with zero inherited related-offer consent.
   IF v_mode='ON_SITE' THEN v_onsite:=true; ELSE v_remote:=true; END IF;
 END LOOP;
 -- A recent explicit global-mode change must not be overwritten by a delayed
 -- binder from an older review. All updates below are ONE DB transaction.
 IF EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
   WHERE choice.worker_profile_id=p_profile_id AND choice.updated_at>v_save.created_at)
 THEN RAISE EXCEPTION 'WORKER_BINDER_NEWER_GLOBAL_MODE' USING errcode='PT409'; END IF;
 IF v_onsite THEN v_modes:=array_append(v_modes,'ON_SITE'); END IF;
 IF v_remote THEN v_modes:=array_append(v_modes,'REMOTE'); END IF;
 INSERT INTO private.worker_execution_mode_choices(
   worker_profile_id,worker_account_id,modes,consent_source,confirmed_at,updated_at)
 VALUES(p_profile_id,p_owner_account_id,v_modes,'EXPLICIT_PROFILE_REVIEW',
   statement_timestamp(),statement_timestamp())
 ON CONFLICT(worker_profile_id) DO UPDATE
   SET modes=excluded.modes,consent_source='EXPLICIT_PROFILE_REVIEW',
       confirmed_at=statement_timestamp(),updated_at=statement_timestamp();
 -- Catalog identities and per-service scope are granted only AFTER the
 -- signed review, saved receipt and current profile all passed.
 FOR v_count IN 0..jsonb_array_length(v_batch.plans)-1 LOOP
   v_item:=v_batch.result->'items'->v_count;
   v_category:=(v_item->>'categoryId')::uuid;v_mode:=v_item->>'mode';
   INSERT INTO private.work_taxonomy_worker_capabilities(
      worker_account_id,category_id,confirmed_at,allow_related_offers,excluded,origin)
   VALUES(p_owner_account_id,v_category,statement_timestamp(),false,false,'WORKER_CONFIRMED')
   ON CONFLICT(worker_account_id,category_id) DO UPDATE
     SET confirmed_at=statement_timestamp(),updated_at=statement_timestamp(),
         excluded=false,allow_related_offers=false,origin='WORKER_CONFIRMED';
   INSERT INTO private.taxonomy_confirmed_worker_modes_v1(
     worker_account_id,category_id,execution_scope,source_review_id,source_request_key,
     confirmed_at,active)
   VALUES(p_owner_account_id,v_category,v_mode,p_source_review_id,p_request_key,
     statement_timestamp(),true)
   ON CONFLICT(worker_account_id,category_id,execution_scope) DO UPDATE
    SET source_review_id=excluded.source_review_id,
        source_request_key=excluded.source_request_key,
        confirmed_at=statement_timestamp(),active=true;
 END LOOP;
 -- The CURRENT complete review replaces old per-service permission. Retain
 -- history, but deactivate obsolete modes; never manufacture a related opt-in.
 UPDATE private.taxonomy_confirmed_worker_modes_v1 old
 SET active=false
 WHERE old.worker_account_id=p_owner_account_id AND old.active
   AND NOT EXISTS(
     SELECT 1 FROM jsonb_array_elements(v_batch.result->'items') item(value)
     WHERE (item.value->>'categoryId')::uuid=old.category_id
       AND item.value->>'mode'=old.execution_scope);
 v_result:=jsonb_build_object('status','BOUND_WORKER_SERVICES',
   'workerProfileId',p_profile_id,'serviceModeCount',jsonb_array_length(v_batch.plans),
   'catalogVersion',v_batch.catalog_version,'dispatchAuthority','NONE',
   'notificationAuthority','NONE','relatedOfferAuthority','NONE');
 INSERT INTO private.work_taxonomy_worker_bindings_v1(
   owner_account_id,request_key,source_review_id,profile_id,catalog_version,result)
 VALUES(p_owner_account_id,p_request_key,p_source_review_id,p_profile_id,
   v_batch.catalog_version,v_result);
 RETURN v_result;
END $function$;

DO $metadata$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid='private.taxonomy_ai_catalog_context_v1(text,integer,text)'::regprocedure AND
  (pg_get_userbyid(proowner) IS DISTINCT FROM 'postgres'
   OR proacl::text IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
   OR to_jsonb(proconfig) IS DISTINCT FROM '["search_path=pg_catalog"]'::jsonb
   OR prosecdef IS DISTINCT FROM false
   OR provolatile IS DISTINCT FROM 's'::"char"))
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_METADATA_DRIFT: taxonomy_ai_catalog_context_v1'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid='private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'::regprocedure AND
  (pg_get_userbyid(proowner) IS DISTINCT FROM 'postgres'
   OR proacl::text IS DISTINCT FROM '{postgres=X/postgres}'
   OR to_jsonb(proconfig) IS DISTINCT FROM '["search_path=pg_catalog, private"]'::jsonb
   OR prosecdef IS DISTINCT FROM false
   OR provolatile IS DISTINCT FROM 's'::"char"))
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_METADATA_DRIFT: taxonomy_review_candidate_projection_v2'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid='rpc_taxonomy_bind_reviewed_need_service(uuid,uuid,uuid,uuid,integer)'::regprocedure AND
  (pg_get_userbyid(proowner) IS DISTINCT FROM 'postgres'
   OR proacl::text IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
   OR to_jsonb(proconfig) IS DISTINCT FROM '["search_path=pg_catalog, private"]'::jsonb
   OR prosecdef IS DISTINCT FROM true
   OR provolatile IS DISTINCT FROM 'v'::"char"))
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_METADATA_DRIFT: rpc_taxonomy_bind_reviewed_need_service'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid='rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)'::regprocedure AND
  (pg_get_userbyid(proowner) IS DISTINCT FROM 'postgres'
   OR proacl::text IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
   OR to_jsonb(proconfig) IS DISTINCT FROM '["search_path=pg_catalog, private"]'::jsonb
   OR prosecdef IS DISTINCT FROM true
   OR provolatile IS DISTINCT FROM 'v'::"char"))
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_METADATA_DRIFT: rpc_taxonomy_bind_reviewed_worker_service'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid='rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)'::regprocedure AND
  (pg_get_userbyid(proowner) IS DISTINCT FROM 'postgres'
   OR proacl::text IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
   OR to_jsonb(proconfig) IS DISTINCT FROM '["search_path=pg_catalog, private"]'::jsonb
   OR prosecdef IS DISTINCT FROM true
   OR provolatile IS DISTINCT FROM 'v'::"char"))
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_METADATA_DRIFT: rpc_taxonomy_capture_gemini_turn_hints_service'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid='rpc_taxonomy_commit_admission_service(uuid)'::regprocedure AND
  (pg_get_userbyid(proowner) IS DISTINCT FROM 'postgres'
   OR proacl::text IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
   OR to_jsonb(proconfig) IS DISTINCT FROM '["search_path=pg_catalog, private"]'::jsonb
   OR prosecdef IS DISTINCT FROM true
   OR provolatile IS DISTINCT FROM 'v'::"char"))
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_METADATA_DRIFT: rpc_taxonomy_commit_admission_service'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid='rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)'::regprocedure AND
  (pg_get_userbyid(proowner) IS DISTINCT FROM 'postgres'
   OR proacl::text IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
   OR to_jsonb(proconfig) IS DISTINCT FROM '["search_path=pg_catalog, private"]'::jsonb
   OR prosecdef IS DISTINCT FROM true
   OR provolatile IS DISTINCT FROM 'v'::"char"))
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_METADATA_DRIFT: rpc_taxonomy_commit_reviewed_batch_service'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid='rpc_taxonomy_prepare_admission_service(uuid,uuid,text,uuid,jsonb)'::regprocedure AND
  (pg_get_userbyid(proowner) IS DISTINCT FROM 'postgres'
   OR proacl::text IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
   OR to_jsonb(proconfig) IS DISTINCT FROM '["search_path=pg_catalog, private"]'::jsonb
   OR prosecdef IS DISTINCT FROM true
   OR provolatile IS DISTINCT FROM 'v'::"char"))
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_METADATA_DRIFT: rpc_taxonomy_prepare_admission_service'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid='rpc_taxonomy_query_catalog_service(jsonb)'::regprocedure AND
  (pg_get_userbyid(proowner) IS DISTINCT FROM 'postgres'
   OR proacl::text IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
   OR to_jsonb(proconfig) IS DISTINCT FROM '["search_path=pg_catalog","statement_timeout=5s"]'::jsonb
   OR prosecdef IS DISTINCT FROM false
   OR provolatile IS DISTINCT FROM 's'::"char"))
 THEN RAISE EXCEPTION 'TAXONOMY_MODE_METADATA_DRIFT: rpc_taxonomy_query_catalog_service'; END IF;
END $metadata$;
COMMIT;
