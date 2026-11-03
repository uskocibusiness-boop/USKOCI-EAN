-- R01: read-only Storage table owner/ACL grant-option provenance.
-- This never reads storage objects or modifies role/grant metadata.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '20s';
WITH target AS MATERIALIZED (
 SELECT c.oid,c.relowner,c.relacl FROM pg_class c
 WHERE c.oid=to_regclass('storage.objects')
), principals AS MATERIALIZED (
 SELECT r.rolname,r.oid FROM pg_roles r WHERE r.rolname IN
 ('anon','authenticated','authenticator','postgres','service_role','supabase_admin',
  'supabase_auth_admin','supabase_functions_admin','supabase_realtime_admin',
  'supabase_storage_admin')
), privileges(name) AS (
 VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),
        ('REFERENCES'),('TRIGGER'),('MAINTAIN')
), entries AS (
 SELECT t.relowner, a.grantee,a.grantor,a.privilege_type,a.is_grantable,
   md5(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END) AS grantee_md5,
   md5(pg_get_userbyid(a.grantor)) AS grantor_md5
 FROM target t CROSS JOIN LATERAL aclexplode(t.relacl) a
)
SELECT jsonb_build_object(
 'unit','R01_STORAGE_OWNER_ACL_CAPTURE','format_version',1,
 'read_only',current_setting('transaction_read_only'),
 'database',current_database(),
 'server_version_num',current_setting('server_version_num')::integer,
 'owner_md5',(SELECT md5(pg_get_userbyid(relowner)) FROM target),
 'acl_null',(SELECT relacl IS NULL FROM target),
 'acl',(SELECT jsonb_agg(jsonb_build_object(
   'grantee_md5',grantee_md5,'grantor_md5',grantor_md5,
   'privilege',privilege_type,'grantable',is_grantable,
   'owner_entry',grantee=relowner)
   ORDER BY grantee_md5,grantor_md5,privilege_type) FROM entries),
 'effective',(SELECT jsonb_agg(jsonb_build_object(
   'role',r.rolname,'privilege',v.name,
   'allowed',has_table_privilege(r.oid,t.oid,v.name),
   'grantable',has_table_privilege(r.oid,t.oid,v.name||' WITH GRANT OPTION'),
   'owner',r.oid=t.relowner)
   ORDER BY r.rolname,v.name)
   FROM target t CROSS JOIN principals r CROSS JOIN privileges v)
) AS capture;
ROLLBACK;
