-- R01: read-only explicit extension routine ACL tuple diagnostics.
-- No function invocation, data rows, grants, ownership changes or ACL repairs.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '20s';
WITH routines AS MATERIALIZED (
 SELECT e.extname, n.nspname, p.*, l.lanname,
   md5(jsonb_build_array(e.extname,n.nspname,p.proname,
        pg_get_function_identity_arguments(p.oid))::text) AS key_hash
 FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_language l ON l.oid=p.prolang
 JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid
   AND d.refclassid='pg_extension'::regclass AND d.deptype='e'
 JOIN pg_extension e ON e.oid=d.refobjid
 WHERE e.extname IN ('pgcrypto','uuid-ossp','pg_stat_statements')
 AND p.prokind IN ('f','p')
), detail AS (
 SELECT r.key_hash,r.extname,
    md5(pg_get_userbyid(r.proowner)) AS owner_md5,
    (r.proacl IS NULL) AS null_acl,
    (SELECT coalesce(jsonb_agg(jsonb_build_array(
      md5(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END),
      md5(pg_get_userbyid(a.grantor)),a.privilege_type,a.is_grantable)
      ORDER BY md5(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END),
        md5(pg_get_userbyid(a.grantor)),a.privilege_type,a.is_grantable),'[]'::jsonb)
      FROM aclexplode(r.proacl) a) AS full_acl,
    (SELECT coalesce(jsonb_agg(jsonb_build_array(
      md5(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END),
      a.privilege_type,a.is_grantable)
      ORDER BY md5(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END),
        a.privilege_type,a.is_grantable),'[]'::jsonb)
      FROM aclexplode(r.proacl) a
      WHERE a.grantee=0 OR pg_get_userbyid(a.grantee) IN
        ('anon','authenticated','authenticator','service_role')) AS request_acl,
    r.prosecdef AS security_definer,r.proisstrict AS strict,
    r.provolatile AS volatility,r.proparallel AS parallel,r.proleakproof AS leakproof,
    r.lanname AS language,
    md5(r.prosrc) AS body_md5,
    md5(r.probin) AS binary_md5,
    md5(r.proconfig::text) AS config_md5,
    md5(pg_get_functiondef(r.oid)) AS definition_md5,
    has_function_privilege('anon',r.oid,'EXECUTE') AS anon_exec,
    has_function_privilege('authenticated',r.oid,'EXECUTE') AS authenticated_exec,
    has_function_privilege('authenticator',r.oid,'EXECUTE') AS authenticator_exec,
    has_function_privilege('service_role',r.oid,'EXECUTE') AS service_exec
 FROM routines r
)
SELECT jsonb_build_object(
 'unit','R01_EXTENSION_ACL_SCOPE_CAPTURE','format_version',1,
 'read_only',current_setting('transaction_read_only'),
 'database',current_database(),
 'server_version_num',current_setting('server_version_num')::integer,
 'routines',(SELECT jsonb_agg(jsonb_build_object(
  'key_hash',key_hash,'extension',extname,'owner_md5',owner_md5,
  'null_acl',null_acl,
  'full_acl_md5',md5(full_acl::text),
  'request_acl_md5',md5(request_acl::text),
  'full_acl_count',jsonb_array_length(full_acl),
  'request_acl_count',jsonb_array_length(request_acl),
  'security_definer',security_definer,'strict',strict,
  'volatility',volatility,'parallel',parallel,'leakproof',leakproof,
  'language',language,'body_md5',body_md5,
  'binary_md5',binary_md5,'config_md5',config_md5,
  'definition_md5',definition_md5,
  'anon_exec',anon_exec,'authenticated_exec',authenticated_exec,
  'authenticator_exec',authenticator_exec,'service_exec',service_exec
 ) ORDER BY key_hash) FROM detail)
) AS capture;
ROLLBACK;
