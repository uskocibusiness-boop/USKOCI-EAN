BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='15s';
DO $f10_readback$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006'
 
 THEN RAISE EXCEPTION 'F10_DEV_CONTEXT_REFUSED'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_get_worker_execution_modes(uuid)')
 AND p.oid=28953 AND md5(pg_get_functiondef(p.oid))='f42fe6666c33e8b5faa8313c72f8501d'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'F10_DEV_FUNCTION_DRIFT:%','public.rpc_get_worker_execution_modes(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('extensions.digest(text,text)')
 AND p.oid=16448 AND md5(pg_get_functiondef(p.oid))='95de9cf8798b911a1fe38c27bdb570de'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{=X/postgres,postgres=X*/postgres,dashboard_user=X/postgres}')
 THEN RAISE EXCEPTION 'F10_DEV_FUNCTION_DRIFT:%','extensions.digest(text,text)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_handoff_valid_v1(jsonb)')
 AND p.oid=31292 AND md5(pg_get_functiondef(p.oid))='de8d37190d70e0534bfc123d7b247b1f'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres}')
 THEN RAISE EXCEPTION 'F10_DEV_FUNCTION_DRIFT:%','private.taxonomy_handoff_valid_v1(jsonb)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.taxonomy_normalize_v1(text)')
 AND p.oid=28591 AND md5(pg_get_functiondef(p.oid))='8185e305017348588028e92397866b35'
 AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text IS NOT DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}')
 THEN RAISE EXCEPTION 'F10_DEV_FUNCTION_DRIFT:%','private.taxonomy_normalize_v1(text)'; END IF;
IF (WITH names(name) AS (VALUES
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
SELECT md5(tables::text) FROM relations) IS DISTINCT FROM '3de2fefde2e3db68670f09395a87db64'
 THEN RAISE EXCEPTION 'F10_DEV_RELATION_DRIFT'; END IF;
END; $f10_readback$;

SELECT 'F10_DEV_PREIMAGE_MATCH' AS metadata_result,false AS functional_acceptance_proven;
ROLLBACK;
