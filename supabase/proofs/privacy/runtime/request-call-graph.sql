-- R01: read-only lexical reachability diagnostic for the current Need request boundary.
-- Catalog bodies are scanned in memory; only hashes and safe function metadata leave DEV.
-- Qualified references are over-approximations, NOT proof of a complete runtime call graph.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '30s';
WITH RECURSIVE
roots(schema_name,name) AS (VALUES
 ('public','rpc_read_task'),('public','rpc_list_my_tasks'),('public','rpc_list_my_needs_page'),
 ('public','rpc_discovery_v1'),('public','rpc_list_open_tasks_v3'),
 ('public','rpc_storage_account_open'),('public','rpc_closure_api_guard'),
 ('public','rpc_close_remaining_search'),('rls_private','need_participant_can_read'),
 ('rls_private','p6_discovery_test_world_accounts'),('private','account_visibility_world')
), funcs AS MATERIALIZED (
 SELECT p.oid,n.nspname,p.proname,p.prosrc,p.probin,p.proconfig,p.proacl,
  p.prosecdef,p.proowner,l.lanname,
  md5(n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')') AS key_md5
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_language l ON l.oid=p.prolang
 WHERE n.nspname IN ('public','private','rls_private','auth','extensions','net')
), refs AS MATERIALIZED (
 SELECT f.oid caller,lower(m[1]) target_schema,lower(m[2]) target_name
 FROM funcs f CROSS JOIN LATERAL regexp_matches(f.prosrc,
  '(?i)(public|private|rls_private|auth|extensions|net)\.([a-z_][a-z_0-9]*)[[:space:]]*\(','g') AS m
), edges AS MATERIALIZED (
 SELECT DISTINCT r.caller,t.oid callee FROM refs r
 JOIN funcs t ON t.nspname=r.target_schema AND t.proname=r.target_name
 WHERE r.caller<>t.oid
), walk AS (
 SELECT f.oid root_oid,f.oid current_oid,0 depth,ARRAY[f.oid] seen
 FROM funcs f JOIN roots r ON r.schema_name=f.nspname AND r.name=f.proname
 UNION ALL
 SELECT w.root_oid,e.callee,w.depth+1,w.seen||e.callee
 FROM walk w JOIN edges e ON e.caller=w.current_oid
 WHERE w.depth<8 AND NOT e.callee=ANY(w.seen)
), reached AS MATERIALIZED (
 SELECT DISTINCT current_oid AS oid FROM walk
), reachable_funcs AS MATERIALIZED (
 SELECT f.*,EXISTS(SELECT 1 FROM roots r
 WHERE r.schema_name=f.nspname AND r.name=f.proname) root
 FROM reached r JOIN funcs f ON f.oid=r.oid
), linked AS (
 SELECT a.key_md5 source,b.key_md5 target
 FROM edges e JOIN reachable_funcs a ON a.oid=e.caller
 JOIN funcs b ON b.oid=e.callee
), policies AS (
 SELECT pol.polname,pol.polcmd,pol.polpermissive,
  md5(pg_get_expr(pol.polqual,pol.polrelid)) using_md5,
  md5(pg_get_expr(pol.polwithcheck,pol.polrelid)) check_md5,
  md5(coalesce((SELECT string_agg(CASE WHEN ro.role_oid=0 THEN 'PUBLIC'
   ELSE pg_get_userbyid(ro.role_oid) END,',' ORDER BY ro.role_oid)
   FROM unnest(pol.polroles) ro(role_oid)),'')) role_md5
 FROM pg_policy pol WHERE pol.polrelid=to_regclass('public.needs')
)
SELECT jsonb_build_object(
 'unit','R01_REQUEST_PATH_CATALOG_CAPTURE','format_version',1,
 'read_only',current_setting('transaction_read_only'),
 'database',current_database(),'server_version_num',current_setting('server_version_num')::integer,
 'root_count',(SELECT count(*) FROM roots),
 'matched_roots',(SELECT count(*) FROM reachable_funcs WHERE root),
 'max_depth',(SELECT max(depth) FROM walk),
 'frontier_unvisited',(SELECT count(*) FROM reached r JOIN edges e ON e.caller=r.oid
   WHERE NOT EXISTS(SELECT 1 FROM reached t WHERE t.oid=e.callee)),
 'dynamic_count',(SELECT count(*) FROM reachable_funcs f WHERE f.prosrc~* '\mEXECUTE\M'),
 'role_change_count',(SELECT count(*) FROM reachable_funcs f WHERE f.prosrc~* 'SET[[:space:]]+ROLE'),
 'extension_ddl_count',(SELECT count(*) FROM reachable_funcs f WHERE f.prosrc~* 'CREATE[[:space:]]+EXTENSION'),
 'nodes',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'key',f.key_md5,'root',f.root,'kind',CASE WHEN f.nspname IN ('extensions','net') THEN 'EXTENSION' ELSE 'APP_OR_PLATFORM' END,
  'body_md5',md5(f.prosrc),'binary_md5',md5(f.probin),
  'config_md5',md5(f.proconfig::text),'owner_md5',md5(pg_get_userbyid(f.proowner)),
  'acl_md5',md5(f.proacl::text),'security_definer',f.prosecdef,'language',f.lanname,
  'anon_execute',has_function_privilege('anon',f.oid,'EXECUTE'),
  'authenticated_execute',has_function_privilege('authenticated',f.oid,'EXECUTE'),
  'service_execute',has_function_privilege('service_role',f.oid,'EXECUTE'))
  ORDER BY f.key_md5),'[]'::jsonb) FROM reachable_funcs f),
 'edges',(SELECT coalesce(jsonb_agg(jsonb_build_object('source',source,'target',target)
   ORDER BY source,target),'[]'::jsonb) FROM linked),
 'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'name',polname,'command',polcmd,'permissive',polpermissive,
  'using_md5',using_md5,'check_md5',check_md5,'role_md5',role_md5)
  ORDER BY polname),'[]'::jsonb) FROM policies)
) AS capture;
ROLLBACK;
