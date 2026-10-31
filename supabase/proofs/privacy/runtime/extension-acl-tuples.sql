-- R01 scoped metadata: exact per-routine GRANTEE/GRANTOR/privilege/option tuples.
-- No business rows, Auth rows, user grants, function invocations or role changes.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '20s';
WITH routines AS MATERIALIZED (
 SELECT e.extname,p.oid,p.proowner,p.proacl,
   md5(jsonb_build_array(e.extname,n.nspname,p.proname,
     pg_get_function_identity_arguments(p.oid))::text) AS key_hash
 FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid
   AND d.refclassid='pg_extension'::regclass AND d.deptype='e'
 JOIN pg_extension e ON e.oid=d.refobjid
 WHERE e.extname IN ('pgcrypto','uuid-ossp','pg_stat_statements')
   AND p.prokind IN ('f','p')
), membership AS MATERIALIZED (
 SELECT r.oid,r.rolname FROM pg_roles r WHERE r.rolname IN
 ('anon','authenticated','authenticator','service_role','postgres','supabase_admin',
  'supabase_auth_admin','supabase_functions_admin','supabase_realtime_admin',
  'supabase_storage_admin')
), dashboard AS MATERIALIZED (
 SELECT oid,rolcanlogin,rolsuper,rolcreaterole,rolbypassrls,rolinherit
 FROM pg_roles WHERE rolname='dashboard_user'
), records AS MATERIALIZED (
 SELECT r.extname,r.key_hash,md5(pg_get_userbyid(r.proowner)) AS owner_md5,
  r.proacl IS NULL AS acl_null,
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'grantee_md5',md5(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END),
    'grantor_md5',md5(pg_get_userbyid(a.grantor)),
    'privilege',a.privilege_type,'grantable',a.is_grantable,
    'owner_entry',a.grantee=r.proowner,
    'dashboard_entry',coalesce(a.grantee=(SELECT oid FROM dashboard),false))
   ORDER BY md5(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END),
      md5(pg_get_userbyid(a.grantor)),a.privilege_type,a.is_grantable), '[]'::jsonb)
   FROM aclexplode(r.proacl) a) AS acl
 FROM routines r
)
SELECT jsonb_build_object(
 'unit','R01_EXTENSION_ACL_TUPLES_CAPTURE','format_version',1,
 'read_only',current_setting('transaction_read_only'),
 'server_version_num',current_setting('server_version_num')::integer,
 'database',current_database(),
 'dashboard_role',(SELECT jsonb_build_object('login',rolcanlogin,'superuser',rolsuper,
   'createrole',rolcreaterole,'bypassrls',rolbypassrls,'inherit',rolinherit) FROM dashboard),
 'dashboard_reachability',(SELECT jsonb_agg(jsonb_build_object(
    'principal',m.rolname,
    'usage',CASE WHEN (SELECT oid FROM dashboard) IS NULL THEN false
      ELSE pg_has_role(m.oid,(SELECT oid FROM dashboard),'USAGE') END,
    'set',CASE WHEN (SELECT oid FROM dashboard) IS NULL THEN false
      ELSE pg_has_role(m.oid,(SELECT oid FROM dashboard),'SET') END)
   ORDER BY m.rolname) FROM membership m),
 'routines',(SELECT jsonb_agg(jsonb_build_object(
   'key_hash',key_hash,'extension',extname,'owner_md5',owner_md5,
   'acl_null',acl_null,'acl',acl) ORDER BY key_hash) FROM records)
) AS capture;
ROLLBACK;
