-- R01: the observed pg_net event invoker context, never execution of the hook.
-- Transaction-local search_path models only the helper's captured empty override;
-- INHERITED keeps the actual caller path. No persistent setting or object changes.
-- Operators are also qualified so a hostile inherited path cannot execute a shadow.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SELECT pg_catalog.set_config('search_path', CASE WHEN
  (SELECT proconfig FROM pg_catalog.pg_proc
   WHERE oid OPERATOR(pg_catalog.=) pg_catalog.to_regprocedure('extensions.grant_pg_net_access()'))
    OPERATOR(pg_catalog.=) ARRAY['search_path=""']::pg_catalog.text[] THEN ''
  ELSE pg_catalog.current_setting('search_path') END, true) IS NOT NULL AS path_observed;
WITH helper AS MATERIALIZED (
 SELECT p.*,l.lanname FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_language l ON l.oid OPERATOR(pg_catalog.=) p.prolang
 WHERE p.oid OPERATOR(pg_catalog.=) pg_catalog.to_regprocedure('extensions.grant_pg_net_access()')
), request_roles(name) AS (VALUES ('anon'),('authenticated'),('authenticator'),('service_role')),
delegation AS MATERIALIZED (
 SELECT setting,context FROM pg_catalog.pg_settings WHERE name OPERATOR(pg_catalog.=) 'supautils.privileged_role'
), authority_roles AS MATERIALIZED (
 SELECT r.oid FROM pg_catalog.pg_roles r
 WHERE r.rolsuper OR r.rolcreaterole
  OR pg_catalog.has_database_privilege(r.oid,pg_catalog.current_database(),'CREATE')
  OR r.rolname OPERATOR(pg_catalog.=) (SELECT setting FROM delegation)
)
SELECT pg_catalog.jsonb_build_object(
 'unit','R01_NATIVE_NET_INVOKER_CAPTURE','format_version',1,
 'read_only',pg_catalog.current_setting('transaction_read_only'),
 'server_version_num',pg_catalog.current_setting('server_version_num')::pg_catalog.int4,
 'database',pg_catalog.current_database(),
 'extension_version',(SELECT extversion FROM pg_catalog.pg_extension WHERE extname OPERATOR(pg_catalog.=) 'pg_net'),
 'capture_role',CASE WHEN current_user OPERATOR(pg_catalog.=) ANY(ARRAY['postgres','supabase_admin']::pg_catalog.name[])
   THEN current_user ELSE 'OTHER' END,
 'helper',(SELECT pg_catalog.jsonb_build_object(
   'source_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(prosrc,'UTF8')),'hex'),
   'config_kind',CASE WHEN proconfig IS NULL THEN 'INHERITED'
     WHEN proconfig OPERATOR(pg_catalog.=) ARRAY['search_path=""']::pg_catalog.text[] THEN 'EMPTY_SEARCH_PATH' ELSE 'OTHER' END,
   'invoker',NOT prosecdef,'event_return',prorettype OPERATOR(pg_catalog.=) 'pg_catalog.event_trigger'::pg_catalog.regtype,
   'plpgsql',lanname OPERATOR(pg_catalog.=) 'plpgsql') FROM helper),
 'event',(SELECT pg_catalog.jsonb_build_object(
   'create_extension_only',evtevent OPERATOR(pg_catalog.=) 'ddl_command_end'
     AND evttags OPERATOR(pg_catalog.=) ARRAY['CREATE EXTENSION']::pg_catalog.text[]
     AND evtenabled OPERATOR(pg_catalog.=) 'O',
   'invokes_helper',evtfoid OPERATOR(pg_catalog.=) (SELECT oid FROM helper))
   FROM pg_catalog.pg_event_trigger WHERE evtname OPERATOR(pg_catalog.=) 'issue_pg_net_access'),
 'resolution',pg_catalog.jsonb_build_object(
   'catalog_first',(pg_catalog.current_schemas(true))[1] OPERATOR(pg_catalog.=) 'pg_catalog',
   'ddl_commands_builtin',pg_catalog.to_regprocedure('pg_event_trigger_ddl_commands()')
     OPERATOR(pg_catalog.=) 'pg_catalog.pg_event_trigger_ddl_commands()'::pg_catalog.regprocedure,
   'extension_builtin',pg_catalog.to_regclass('pg_extension') OPERATOR(pg_catalog.=) 'pg_catalog.pg_extension'::pg_catalog.regclass,
   'roles_builtin',pg_catalog.to_regclass('pg_roles') OPERATOR(pg_catalog.=) 'pg_catalog.pg_roles'::pg_catalog.regclass,
   -- Exact zero-argument lookup alone misses competing default/variadic overloads.
   'visible_shadow_routines',(SELECT pg_catalog.count(*) FROM pg_catalog.pg_proc p
     JOIN pg_catalog.pg_namespace n ON n.oid OPERATOR(pg_catalog.=) p.pronamespace
     WHERE p.proname OPERATOR(pg_catalog.=) 'pg_event_trigger_ddl_commands'
       AND n.nspname OPERATOR(pg_catalog.<>) 'pg_catalog'
       AND n.nspname OPERATOR(pg_catalog.=) ANY(pg_catalog.current_schemas(true)))),
 'delegation',pg_catalog.jsonb_build_object(
   'registered',(SELECT pg_catalog.count(*) OPERATOR(pg_catalog.=) 1 FROM delegation
      WHERE context OPERATOR(pg_catalog.=) 'sighup'),
   'role_sha256',(SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(setting,'UTF8')),'hex') FROM delegation)),
 'principals',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'principal',rr.name,'present',r.oid IS NOT NULL,
   'superuser',r.rolsuper,'createrole',r.rolcreaterole,
   'database_create',CASE WHEN r.oid IS NOT NULL THEN
      pg_catalog.has_database_privilege(r.oid,pg_catalog.current_database(),'CREATE') ELSE NULL END,
   'authority_usage_count',(SELECT pg_catalog.count(*) FROM authority_roles a WHERE
      r.oid IS NOT NULL AND pg_catalog.pg_has_role(r.oid,a.oid,'USAGE')),
   'authority_set_count',(SELECT pg_catalog.count(*) FROM authority_roles a WHERE
      r.oid IS NOT NULL AND pg_catalog.pg_has_role(r.oid,a.oid,'SET'))
   ) ORDER BY rr.name) FROM request_roles rr LEFT JOIN pg_catalog.pg_roles r ON r.rolname OPERATOR(pg_catalog.=) rr.name)
) AS capture;
ROLLBACK;
