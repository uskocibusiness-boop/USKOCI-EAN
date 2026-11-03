-- R01: read-only administrator path probe. Does not SET ROLE or override search_path.
-- DEV executes as its available catalog reader; disposable executes as supabase_admin.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
WITH admin AS MATERIALIZED (
  SELECT r.oid, r.rolsuper, r.rolconfig FROM pg_catalog.pg_roles r
  WHERE r.rolname='supabase_admin'
), parsed AS (
  SELECT v.setting FROM admin a
  CROSS JOIN LATERAL pg_catalog.unnest(a.rolconfig) v(setting)
), namespaces AS (
  SELECT n.nspname, pg_catalog.has_schema_privilege('supabase_admin',n.oid,'USAGE') can_use
  FROM pg_catalog.pg_namespace n
  WHERE n.nspname IN ('public','auth','extensions','supabase_admin',
    'postgres','$user',E'\\$user')
)
SELECT pg_catalog.jsonb_build_object(
  'unit','R01_ADMIN_EFFECTIVE_PATH_CAPTURE','format_version',1,
  'read_only',pg_catalog.current_setting('transaction_read_only'),
  'server_version_num',pg_catalog.current_setting('server_version_num')::integer,
  'database',pg_catalog.current_database(),
  'session_role',current_user,
  'admin_role_exists',(SELECT pg_catalog.count(*)=1 FROM admin),
  'admin_superuser',(SELECT rolsuper FROM admin),
  'role_config_entries',(SELECT pg_catalog.count(*) FROM parsed),
  'role_path_entries',(SELECT pg_catalog.count(*) FROM parsed WHERE setting LIKE 'search_path=%'),
  'role_path_has_user_macro',(SELECT pg_catalog.count(*)=1 FROM parsed
    WHERE setting LIKE 'search_path=%' AND pg_catalog.strpos(setting,'$user')>0),
  'role_path_has_ordered_schemas',(SELECT pg_catalog.count(*)=1 FROM parsed
    WHERE setting LIKE 'search_path=%' AND
    pg_catalog.strpos(pg_catalog.replace(setting,' ',''),'public,auth,extensions')>0),
  'default_role_db_overrides',(SELECT pg_catalog.count(*) FROM pg_catalog.pg_db_role_setting s
    WHERE s.setrole=(SELECT oid FROM admin) AND s.setdatabase<>0),
  'admin_role_all_db_settings',(SELECT pg_catalog.count(*) FROM pg_catalog.pg_db_role_setting s
    WHERE s.setrole=(SELECT oid FROM admin) AND s.setdatabase=0),
  'expected_namespace_count',(SELECT pg_catalog.count(*) FROM namespaces
    WHERE nspname IN ('public','auth','extensions')),
  'admin_usable_namespace_count',(SELECT pg_catalog.count(*) FROM namespaces
    WHERE nspname IN ('public','auth','extensions') AND can_use),
  'shadow_namespace_count',(SELECT pg_catalog.count(*) FROM namespaces
    WHERE nspname IN ('supabase_admin','postgres','$user',E'\\$user')),
  'effective_path',CASE WHEN current_user='supabase_admin'
    THEN pg_catalog.to_jsonb(pg_catalog.current_schemas(false)) ELSE 'null'::jsonb END
) AS capture;
ROLLBACK;
