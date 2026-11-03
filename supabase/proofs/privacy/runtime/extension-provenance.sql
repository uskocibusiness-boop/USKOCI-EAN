-- Diagnostic only: native startup versus the existing local prerequisites.
-- Same routine identities and sorted ACL tuples as extension-acl-scope.sql.
-- No application rows, routine bodies, arbitrary settings, grants or ownership edits.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '20s';
WITH targets(name) AS (VALUES ('pg_stat_statements'),('pgcrypto'),('uuid-ossp')),
settings AS MATERIALIZED (
 SELECT name,setting FROM pg_settings WHERE name IN
 ('supautils.privileged_role','supautils.privileged_extensions_superuser',
  'supautils.privileged_extensions')
), routines AS MATERIALIZED (
 SELECT e.extname,p.proowner,p.proacl,
  md5(jsonb_build_array(e.extname,n.nspname,p.proname,
    pg_get_function_identity_arguments(p.oid))::text) AS key_hash
 FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid
   AND d.refclassid='pg_extension'::regclass AND d.deptype='e'
 JOIN pg_extension e ON e.oid=d.refobjid
 JOIN targets t ON t.name=e.extname
 WHERE p.prokind IN ('f','p')
), records AS MATERIALIZED (
 SELECT r.extname,r.key_hash,md5(pg_get_userbyid(r.proowner)) AS owner_md5,
  r.proacl IS NULL AS acl_null,
  md5((SELECT coalesce(jsonb_agg(jsonb_build_array(
    md5(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END),
    md5(pg_get_userbyid(a.grantor)),a.privilege_type,a.is_grantable)
    ORDER BY md5(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END),
      md5(pg_get_userbyid(a.grantor)),a.privilege_type,a.is_grantable),'[]'::jsonb)
    FROM aclexplode(r.proacl) a)::text) AS acl_md5
 FROM routines r
)
SELECT jsonb_build_object(
 'unit','R01_EXTENSION_PROVENANCE_CAPTURE','format_version',1,
 'read_only',current_setting('transaction_read_only'),
 'server_version_num',current_setting('server_version_num')::integer,
 'database',current_database(),'capture_role',current_user,
 'delegation',jsonb_build_object(
  'privileged_role_md5',(SELECT md5(setting) FROM settings WHERE name='supautils.privileged_role'),
  'privileged_extensions_superuser_md5',
    (SELECT md5(setting) FROM settings WHERE name='supautils.privileged_extensions_superuser'),
  'postgres_superuser',(SELECT rolsuper FROM pg_roles WHERE rolname='postgres'),
  'postgres_privileged_usage',(SELECT pg_has_role(p.oid,r.oid,'USAGE')
    FROM pg_roles p JOIN pg_roles r ON r.rolname=
      (SELECT setting FROM settings WHERE name='supautils.privileged_role')
    WHERE p.rolname='postgres'),
  'extension_allowlist',(SELECT jsonb_agg(jsonb_build_object('name',t.name,
    'listed',(SELECT t.name=ANY(regexp_split_to_array(setting,'\s*,\s*'))
      FROM settings WHERE name='supautils.privileged_extensions')) ORDER BY t.name COLLATE "C")
    FROM targets t)),
 'extensions',(SELECT jsonb_agg(jsonb_build_object(
   'name',t.name,'present',e.oid IS NOT NULL,'owner_md5',md5(pg_get_userbyid(e.extowner)),
   'routines',(SELECT coalesce(jsonb_agg(jsonb_build_object(
     'key_hash',r.key_hash,'owner_md5',r.owner_md5,'acl_null',r.acl_null,'acl_md5',r.acl_md5)
     ORDER BY r.key_hash),'[]'::jsonb) FROM records r WHERE r.extname=t.name))
   ORDER BY t.name COLLATE "C")
   FROM targets t LEFT JOIN pg_extension e ON e.extname=t.name)
) AS capture;
ROLLBACK;
