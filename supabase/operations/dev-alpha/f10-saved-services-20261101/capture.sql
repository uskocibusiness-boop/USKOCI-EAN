BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='3s';
WITH targets(signature) AS (VALUES
 ('public.rpc_get_worker_execution_modes(uuid)'),('private.taxonomy_normalize_v1(text)'),
 ('private.taxonomy_handoff_valid_v1(jsonb)'),('extensions.digest(text,text)')),
names(name) AS (VALUES
 ('public.app_profiles'),('private.worker_execution_mode_choices'),('private.worker_ai_saves'),
 ('private.worker_ai_reviews'),('private.work_taxonomy_categories'),('private.work_taxonomy_aliases'),
 ('private.work_taxonomy_category_modes'),('private.taxonomy_confirmed_worker_modes_v1'),
 ('private.work_taxonomy_worker_capabilities'),('private.work_taxonomy_worker_bindings_v1'),
 ('private.work_taxonomy_review_batches_v1')),
relations AS (SELECT jsonb_agg(jsonb_build_object('name',n.name,'oid',c.oid,'kind',c.relkind,
 'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text,
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'number',a.attnum,'type',format_type(a.atttypid,a.atttypmod),
  'not_null',a.attnotnull,'generated',a.attgenerated,'identity',a.attidentity,
  'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
  FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY n.name) AS tables
 FROM names n LEFT JOIN pg_class c ON c.oid=to_regclass(n.name))
SELECT jsonb_build_object('unit','F10_DEV_PREIMAGE','format_version',1,'captured_at',clock_timestamp(),
 'read_only',current_setting('transaction_read_only'),'server_version_num',current_setting('server_version_num')::int,
 'database',current_database(),'capture_role',current_user,
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',t.signature,'oid',p.oid,'owner',pg_get_userbyid(p.proowner),
  'definition',pg_get_functiondef(p.oid),'definition_md5',md5(pg_get_functiondef(p.oid)),
  'body_md5',md5(replace(p.prosrc,E'\r\n',E'\n')),'security_definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text,
  'acl_entries',(SELECT coalesce(jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
   'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)
   ORDER BY a.grantee,a.grantor,a.privilege_type,a.is_grantable),'[]'::jsonb)
   FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)) ORDER BY t.signature)
  FROM targets t LEFT JOIN pg_proc p ON p.oid=to_regprocedure(t.signature)),
 'tables',relations.tables,'tables_md5',md5(relations.tables::text),
 'user_rows_read',false) AS capture FROM relations;
ROLLBACK;
