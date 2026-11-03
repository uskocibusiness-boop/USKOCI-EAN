-- R01: catalog-only provenance for the hosted CLI login, not an Auth/RLS proof.
-- This query never assumes the hosted login exists on a disposable server.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '20s';
WITH hosted AS MATERIALIZED (
 SELECT oid, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls,
        rolcanlogin, rolinherit
 FROM pg_roles WHERE rolname = 'cli_login_postgres'
), principals AS MATERIALIZED (
 SELECT oid,rolname FROM pg_roles WHERE rolname IN
 ('anon','authenticated','authenticator','service_role','postgres','supabase_admin',
  'supabase_auth_admin','supabase_storage_admin','supabase_realtime_admin',
  'supabase_functions_admin')
), membership AS MATERIALIZED (
 SELECT m.roleid, m.member, m.admin_option, m.inherit_option, m.set_option
 FROM pg_auth_members m
 WHERE m.roleid=(SELECT oid FROM hosted) OR m.member=(SELECT oid FROM hosted)
), routine_mentions AS (
 SELECT count(*) AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private','auth','storage','realtime','extensions','net')
 AND strpos(lower(coalesce(p.prosrc,'')),'cli_login_postgres')>0
), role_deps AS (
 SELECT count(*) AS n FROM pg_shdepend
 WHERE refclassid='pg_authid'::regclass AND refobjid=(SELECT oid FROM hosted)
), role_settings AS (
 SELECT count(*) AS n FROM pg_db_role_setting WHERE setrole=(SELECT oid FROM hosted)
)
SELECT jsonb_build_object(
 'unit','R01_HOSTED_LOGIN_DEPENDENCY_CAPTURE','format_version',1,
 'read_only',current_setting('transaction_read_only'),
 'server_version_num',current_setting('server_version_num')::integer,
 'database',current_database(),
 'principals',(SELECT jsonb_agg(rolname ORDER BY rolname) FROM principals),
 'hosted_role',(SELECT jsonb_build_object('superuser',rolsuper,'createrole',rolcreaterole,
   'createdb',rolcreatedb,'replication',rolreplication,'bypassrls',rolbypassrls,
   'login',rolcanlogin,'inherit',rolinherit) FROM hosted),
 'membership',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'role',roleid::regrole::text,'member',member::regrole::text,
    'admin',admin_option,'inherit',inherit_option,'set',set_option)
    ORDER BY roleid::regrole::text,member::regrole::text),'[]'::jsonb) FROM membership),
 'reachability',(SELECT jsonb_agg(jsonb_build_object('principal',p.rolname,
  'usage',CASE WHEN h.oid IS NULL THEN false ELSE pg_has_role(p.oid,h.oid,'USAGE') END,
  'set',CASE WHEN h.oid IS NULL THEN false ELSE pg_has_role(p.oid,h.oid,'SET') END
  ) ORDER BY p.rolname) FROM principals p CROSS JOIN (SELECT (SELECT oid FROM hosted) AS oid) h),
 'shared_dependency_count',(SELECT n FROM role_deps),
 'role_settings_count',(SELECT n FROM role_settings),
 'routine_literal_mentions',(SELECT n FROM routine_mentions)
) AS capture;
ROLLBACK;
