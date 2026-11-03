-- Read-only metadata diagnostics; never invokes application/extension routines.
-- No user rows, credentials, database files, network calls or fixture writes.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog;
WITH principals AS MATERIALIZED (
  SELECT oid, rolname FROM pg_roles WHERE rolname IN
    ('anon','authenticated','service_role','authenticator','postgres',
     'supabase_admin','supabase_auth_admin','supabase_storage_admin',
     'supabase_realtime_admin','supabase_functions_admin')
), targets AS MATERIALIZED (
  SELECT oid, rolname FROM pg_roles WHERE rolname IN
    ('anon','authenticated','service_role','postgres','supabase_admin',
     'supabase_privileged_role','supabase_auth_admin','supabase_storage_admin',
     'supabase_realtime_admin','supabase_functions_admin')
), routines AS MATERIALIZED (
  SELECT p.*, n.nspname, e.extname, l.lanname
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_language l ON l.oid=p.prolang
  JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid
    AND d.refclassid='pg_extension'::regclass AND d.deptype='e'
  JOIN pg_extension e ON e.oid=d.refobjid
  WHERE e.extname IN ('pgcrypto','uuid-ossp','pg_stat_statements','pg_net')
    AND p.prokind IN ('f','p')
), storage_access AS (
  SELECT jsonb_build_object('key',jsonb_build_array(r.rolname,v.privilege),
    'allowed',has_table_privilege(r.oid,c.oid,v.privilege),
    'grantable',has_table_privilege(r.oid,c.oid,v.privilege||' WITH GRANT OPTION'),
    'is_owner',r.oid=c.relowner) AS row
  FROM principals r CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
    ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) v(privilege)
  JOIN pg_class c ON c.oid=to_regclass('storage.objects')
), reachability AS (
  SELECT jsonb_build_object('key',jsonb_build_array(r.rolname,t.rolname),
    'usage',pg_has_role(r.oid,t.oid,'USAGE'),'set_role',pg_has_role(r.oid,t.oid,'SET')) AS row
  FROM principals r CROSS JOIN targets t
), schema_access AS (
  SELECT jsonb_build_object('key',jsonb_build_array(r.rolname,n.nspname),
    'usage',has_schema_privilege(r.oid,n.oid,'USAGE'),
    'create',has_schema_privilege(r.oid,n.oid,'CREATE')) AS row
  FROM principals r CROSS JOIN pg_namespace n
  WHERE n.nspname IN ('auth','storage','realtime','extensions','net','supabase_functions')
), routine_contracts AS (
  SELECT jsonb_build_object('key',jsonb_build_array(p.extname,p.nspname,p.proname,
      pg_get_function_identity_arguments(p.oid)),
    'owner',pg_get_userbyid(p.proowner),'language',p.lanname,
    'security_definer',p.prosecdef,'strict',p.proisstrict,'leakproof',p.proleakproof,
    'volatility',p.provolatile,'parallel',p.proparallel,
    'definition_md5',md5(pg_get_functiondef(p.oid)),
    'body_md5',md5(p.prosrc),'binary_md5',md5(p.probin),
    'config_md5',md5(p.proconfig::text),'acl_md5',md5(p.proacl::text),
    'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
    'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
    'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE'),
    'postgres_execute',has_function_privilege('postgres',p.oid,'EXECUTE')) AS row
  FROM routines p
), namespace_presence AS (
  SELECT jsonb_build_object('key',jsonb_build_array(name),
    'present',EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=name)) AS row
  FROM (VALUES ('supabase_admin'),('$user'),(E'\\$user')) v(name)
)
SELECT jsonb_build_object('unit','R01_PLATFORM_EFFECTIVE_CAPTURE','format_version',1,
  'captured_at',clock_timestamp(),'read_only',current_setting('transaction_read_only'),
  'server_version_num',current_setting('server_version_num')::integer,
  'search_path',current_setting('search_path'),'database',current_database(),
  'principals',(SELECT jsonb_agg(rolname ORDER BY rolname) FROM principals),
  'targets',(SELECT jsonb_agg(rolname ORDER BY rolname) FROM targets),
  'groups',jsonb_build_object(
    'storage_access',(SELECT jsonb_agg(row ORDER BY row->'key') FROM storage_access),
    'role_reachability',(SELECT jsonb_agg(row ORDER BY row->'key') FROM reachability),
    'schema_access',(SELECT jsonb_agg(row ORDER BY row->'key') FROM schema_access),
    'extension_routines',(SELECT jsonb_agg(row ORDER BY row->'key') FROM routine_contracts),
    'namespace_presence',(SELECT jsonb_agg(row ORDER BY row->'key') FROM namespace_presence)));
ROLLBACK;
