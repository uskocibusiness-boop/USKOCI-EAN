BEGIN;
-- Each CI psql command owns a fresh session; claims belong to this proof only.
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
-- Metadata is compatible with the canonical signed-review snapshot pair.
DO $$ DECLARE response jsonb; BEGIN
 response:=public.rpc_taxonomy_query_catalog_service('{"operation":"META"}');
 PERFORM proof.require(response->>'schemaVersion'='TAXONOMY_CATALOG_QUERY_V1' AND response->>'action'='CATALOG_QUERY'
  AND response->>'catalogVersion'='4' AND response->>'catalogFingerprint'=private.taxonomy_admission_fingerprint_v1()
  AND response->'items'='[]'::jsonb AND response->>'count'='0' AND response->'nextCursor'='null'::jsonb
  AND (response->>'totalCategories')::integer=248,'META_ESTABLISHED_ONLY_SAME_CANONICAL_SNAPSHOT');
 PERFORM proof.require(response->>'classificationAuthority'='NONE' AND response->>'capabilityAuthority'='NONE'
  AND response->>'notificationAuthority'='NONE','RESEARCH_GRANTS_NO_AUTHORITY');
END $$;

-- Keyset pages cover the full catalog and every exact alias hit, with no count ceiling.
DO $$ DECLARE request jsonb;response jsonb;seen uuid[];ids uuid[];operation text;expected integer; BEGIN
 FOREACH operation IN ARRAY ARRAY['ROOTS','SEARCH','EXACT'] LOOP
  request:=jsonb_build_object('operation',operation,'limit',17);
  IF operation='SEARCH' THEN request:=request||'{"text":"ПРОБА УСЛУГЕ"}'::jsonb;expected:=220;
  ELSIF operation='EXACT' THEN request:=request||'{"text":"ЗАЈЕДНИЧКА УСЛУГА"}'::jsonb;expected:=130;
  ELSE expected:=222; END IF;
  seen:=ARRAY[]::uuid[];
  LOOP
   response:=public.rpc_taxonomy_query_catalog_service(request);
   SELECT coalesce(array_agg((x->>'categoryId')::uuid),ARRAY[]::uuid[]) INTO ids FROM jsonb_array_elements(response->'items') x;
   PERFORM proof.require(NOT(ids&&seen) AND cardinality(ids)<=17,'PAGE_IS_BOUNDED_WITHOUT_REPEATS');seen:=seen||ids;
   EXIT WHEN response->'nextCursor'='null'::jsonb;
   request:=request||jsonb_build_object('cursor',response->'nextCursor','catalogVersion',response->'catalogVersion','catalogFingerprint',response->'catalogFingerprint');
  END LOOP;
  PERFORM proof.require(cardinality(seen)=expected,'ALL_'||operation||'_RESULTS_WITHOUT_GLOBAL_TRUNCATION');
 END LOOP;
END $$;

DO $$ DECLARE r jsonb;node jsonb;ids jsonb;request jsonb;seen uuid[]:=ARRAY[]::uuid[]; BEGIN
 r:=public.rpc_taxonomy_query_catalog_service('{"operation":"EXACT","text":"3Д штампа"}');
 -- Latin numeric prefix D differs from Cyrillic Д after the shared normalizer only by script.
 PERFORM proof.require(r->>'count'='1','CROSS_SCRIPT_EXACT_ALIAS');
 node:=r#>'{items,0}';
 PERFORM proof.require(node->>'categoryId'=proof.id(2)::text AND node->'modes'='["REMOTE"]'::jsonb
  AND node->'aliases'='["3D štampa","Izrada 3D figurica"]'::jsonb
  AND node->'path'='["Digitalne usluge","3D printovanje"]'::jsonb,'EXACT_ALIAS_AUTHORITATIVE_ID_PATH_MODES');
 r:=public.rpc_taxonomy_query_catalog_service(jsonb_build_object('operation','CHILDREN','categoryId',proof.id(1)));
 PERFORM proof.require(r->>'count'='2','DIRECT_CHILDREN');
 r:=public.rpc_taxonomy_query_catalog_service(jsonb_build_object('operation','SIBLINGS','categoryId',proof.id(2)));
 PERFORM proof.require(r->>'count'='1' AND r#>>'{items,0,categoryId}'=proof.id(2001)::text,'SIBLINGS_EXCLUDE_ANCHOR');
 request:=jsonb_build_object('operation','ANCESTORS','categoryId',proof.id(2025),'limit',7);
 LOOP
  r:=public.rpc_taxonomy_query_catalog_service(request);
  SELECT seen||coalesce(array_agg((x->>'categoryId')::uuid),ARRAY[]::uuid[]) INTO seen FROM jsonb_array_elements(r->'items') x;
  EXIT WHEN r->'nextCursor'='null'::jsonb;
  request:=request||jsonb_build_object('cursor',r->'nextCursor');
 END LOOP;
 PERFORM proof.require(cardinality(seen)=25 AND seen[1]=proof.id(2024) AND seen[25]=proof.id(1),'ANCESTORS_NO_DEPTH_LIMIT_NEAREST_FIRST');
 r:=public.rpc_taxonomy_query_catalog_service(jsonb_build_object('operation','RESOLVE','categoryIds',jsonb_build_array(proof.id(2025),proof.id(2),proof.id(4),proof.id(9999))));
 PERFORM proof.require(r->>'count'='2','RESOLVE_ONLY_ESTABLISHED_SUPPORTED_IDS');
 SELECT x INTO node FROM jsonb_array_elements(r->'items') x WHERE x->>'categoryId'=proof.id(2025)::text;
 PERFORM proof.require(jsonb_array_length(node->'path')=26 AND node#>>'{pathIds,0}'=proof.id(1)::text
  AND node->'modes'='["ON_SITE","REMOTE"]'::jsonb,'DEEP_COMPLETE_PATH_AND_BOTH_EXPLICIT_MODES');
 r:=public.rpc_taxonomy_query_catalog_service('{"operation":"SEARCH","scope":"ON_SITE","text":"Proba usluge","limit":100}');
 PERFORM proof.require(r->>'count'='100' AND r->'nextCursor'<>'null'::jsonb,'MODE_FILTER_PAGES_NOT_TRUNCATES');
 r:=public.rpc_taxonomy_query_catalog_service('{"operation":"SEARCH","text":"%_"}');
 PERFORM proof.require(r->>'count'='0','SEARCH_IS_LITERAL_NOT_SQL_WILDCARD');
END $$;

-- The two fingerprint owners are NOT split: alias writes invalidate cursor and
-- explicit non-cursor chains even if a legacy writer does not bump version.
DO $$ DECLARE r jsonb;request jsonb;cursor text;fingerprint text; BEGIN
 r:=public.rpc_taxonomy_query_catalog_service('{"operation":"ROOTS","limit":1}');cursor:=r->>'nextCursor';fingerprint:=r->>'catalogFingerprint';
 PERFORM proof.reject(format('SELECT public.rpc_taxonomy_query_catalog_service(%L)',jsonb_build_object('operation','SEARCH','text','Proba','cursor',cursor)),
  'TAXONOMY_QUERY_CURSOR_INVALID','22023');
 INSERT INTO private.work_taxonomy_aliases VALUES(proof.id(2),'Svež potvrđen naziv','sr','svez potvrdjen naziv');
 PERFORM proof.reject(format('SELECT public.rpc_taxonomy_query_catalog_service(%L)',jsonb_build_object('operation','ROOTS','cursor',cursor)),
  'TAXONOMY_QUERY_STALE_CATALOG','PT409');
 PERFORM proof.reject(format('SELECT public.rpc_taxonomy_query_catalog_service(%L)',jsonb_build_object('operation','EXACT','text','Svež potvrđen naziv','catalogVersion',4,'catalogFingerprint',fingerprint)),
  'TAXONOMY_QUERY_STALE_CATALOG','PT409');
 r:=public.rpc_taxonomy_query_catalog_service('{"operation":"EXACT","text":"СВЕЖ ПОТВРЂЕН НАЗИВ"}');
 PERFORM proof.require(r->>'count'='1' AND r->>'catalogVersion'='4' AND r->>'catalogFingerprint'<>fingerprint,'LATEST_NEW_ALIAS_FOUND_WITHOUT_VERSION_BUMP');
 DELETE FROM private.work_taxonomy_aliases WHERE normalized_key='svez potvrdjen naziv';
 UPDATE private.work_taxonomy_control SET catalog_version=5;
 PERFORM proof.reject(format('SELECT public.rpc_taxonomy_query_catalog_service(%L)',jsonb_build_object('operation','ROOTS','cursor',cursor)),
  'TAXONOMY_QUERY_STALE_CATALOG','PT409');
 UPDATE private.work_taxonomy_control SET catalog_version=4;
END $$;

-- A globally ambiguous identity is returned in full, including another mode.
DO $$ DECLARE r jsonb; BEGIN
 INSERT INTO private.work_taxonomy_aliases VALUES(proof.id(3),'3D štampa','synthetic','3d stampa');
 r:=public.rpc_taxonomy_query_catalog_service('{"operation":"EXACT","text":"3D štampa","limit":1}');
 PERFORM proof.require(r->>'count'='1' AND r->'nextCursor'<>'null'::jsonb,'EXACT_EXPOSES_GLOBAL_ALIAS_COLLISION_WITH_PAGING');
 r:=public.rpc_taxonomy_query_catalog_service(jsonb_build_object('operation','EXACT','text','3D štampa','limit',1,'cursor',r->'nextCursor'));
 PERFORM proof.require(r->>'count'='1' AND r->'nextCursor'='null'::jsonb,'EXACT_RETURNS_OTHER_MODE_CONFLICT_TOO');
 DELETE FROM private.work_taxonomy_aliases WHERE locale='synthetic';
END $$;

DO $$ DECLARE bad jsonb; BEGIN
 FOREACH bad IN ARRAY ARRAY['null'::jsonb,'[]'::jsonb,'{}'::jsonb,'{"operation":"SEARCH"}'::jsonb,
 '{"operation":"META","limit":101}'::jsonb,'{"operation":"EXACT","scope":"REMOTE","text":"3D štampa"}'::jsonb,
 '{"operation":"ROOTS","unexpected":true}'::jsonb,'{"operation":"META","catalogVersion":4}'::jsonb,
 '{"operation":"CHILDREN","categoryId":"invented"}'::jsonb,'{"operation":"RESOLVE","categoryIds":[]}'::jsonb] LOOP
  PERFORM proof.reject(format('SELECT public.rpc_taxonomy_query_catalog_service(%L)',bad),'TAXONOMY_QUERY_INVALID','22023');
 END LOOP;
 PERFORM proof.reject($q$SELECT public.rpc_taxonomy_query_catalog_service('{"operation":"ROOTS","cursor":"bad-base64"}')$q$,'TAXONOMY_QUERY_CURSOR_INVALID','22023');
 PERFORM proof.reject(format('SELECT public.rpc_taxonomy_query_catalog_service(%L)',jsonb_build_object('operation','CHILDREN','categoryId',proof.id(9999))),
  'TAXONOMY_QUERY_ANCHOR_NOT_FOUND','P0002');
 DELETE FROM private.work_taxonomy_category_modes WHERE category_id=proof.id(1) AND execution_scope='REMOTE';
 PERFORM proof.reject(format('SELECT public.rpc_taxonomy_query_catalog_service(%L)',jsonb_build_object('operation','RESOLVE','categoryIds',jsonb_build_array(proof.id(2)))),
  'TAXONOMY_QUERY_PARENT_OR_MODE_INTEGRITY','55000');
 INSERT INTO private.work_taxonomy_category_modes VALUES(proof.id(1),'REMOTE');
 UPDATE private.work_taxonomy_categories SET parent_id=proof.id(2025) WHERE id=proof.id(2001);
 PERFORM proof.reject(format('SELECT public.rpc_taxonomy_query_catalog_service(%L)',jsonb_build_object('operation','RESOLVE','categoryIds',jsonb_build_array(proof.id(2025)))),
  'TAXONOMY_QUERY_PARENT_OR_MODE_INTEGRITY','55000');
 UPDATE private.work_taxonomy_categories SET parent_id=proof.id(1) WHERE id=proof.id(2001);
END $$;

-- Exact metadata/ACL boundary, real service-role execution, and no data writes.
SELECT proof.require(NOT has_function_privilege('anon','public.rpc_taxonomy_query_catalog_service(jsonb)','EXECUTE')
 AND NOT has_function_privilege('authenticated','public.rpc_taxonomy_query_catalog_service(jsonb)','EXECUTE')
 AND has_function_privilege('service_role','public.rpc_taxonomy_query_catalog_service(jsonb)','EXECUTE'),'SERVICE_ONLY_EXECUTE');
SELECT proof.require((SELECT NOT prosecdef AND provolatile='s' AND pg_get_userbyid(proowner)='postgres'
 FROM pg_proc WHERE oid='public.rpc_taxonomy_query_catalog_service(jsonb)'::regprocedure),'STABLE_INVOKER_NO_PRIVILEGE_ESCALATION');
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',false);
SELECT proof.reject($q$SELECT public.rpc_taxonomy_query_catalog_service('{"operation":"META"}')$q$,'TAXONOMY_QUERY_DENIED','42501');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
SET LOCAL ROLE service_role;
SELECT 1/(CASE WHEN public.rpc_taxonomy_query_catalog_service('{"operation":"EXACT","text":"3D štampa"}')->>'count'='1' THEN 1 ELSE 0 END) service_role_exact_read;
RESET ROLE;
SELECT proof.require(NOT EXISTS(SELECT 1 FROM proof.before_functions b JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)
 WHERE md5(pg_get_functiondef(p.oid))<>b.definition_md5 OR p.proowner<>b.proowner OR p.proacl IS DISTINCT FROM b.proacl
 OR p.proconfig IS DISTINCT FROM b.proconfig),'EXISTING_CATALOG_FUNCTIONS_UNCHANGED');
SELECT proof.require((SELECT value FROM proof.before_data)=jsonb_build_object(
 'categories',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM private.work_taxonomy_categories c),
 'aliases',(SELECT jsonb_agg(to_jsonb(a) ORDER BY category_id,locale,label) FROM private.work_taxonomy_aliases a),
 'modes',(SELECT jsonb_agg(to_jsonb(m) ORDER BY category_id,execution_scope) FROM private.work_taxonomy_category_modes m),
 'control',(SELECT jsonb_agg(to_jsonb(c)) FROM private.work_taxonomy_control c)),'CATALOG_DATA_UNCHANGED');
ROLLBACK;
SELECT 'CATALOG_QUERY_PAGING_GLOBAL_EXACT_DEEP_TREE_SNAPSHOT_ACL_READONLY_PASS' result;
