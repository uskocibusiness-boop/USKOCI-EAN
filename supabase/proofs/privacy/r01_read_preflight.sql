-- R01 / F21 metadata-only preflight. No application/business rows are read.
-- Run with a catalog-reading administrator on the explicitly selected target.
-- This captures evidence; it neither changes privileges nor proves Auth/HTTP behavior.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog;

WITH target_roles AS (
  SELECT oid, rolname, rolsuper, rolinherit, rolbypassrls
  FROM pg_roles
  WHERE rolname IN ('anon', 'authenticated', 'authenticator', 'service_role')
), target_functions(signature) AS (
  VALUES
    ('public.rpc_read_task(uuid)'),
    ('public.rpc_list_my_tasks()'),
    ('public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid)'),
    ('public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamp with time zone,uuid)'),
    ('public.rpc_discovery_v1(jsonb)'),
    ('public.rpc_resolve_activity_event(uuid)'),
    ('public.is_my_task(uuid)'),
    ('public.covered_slots(public.needs)'),
    ('public.selectable_application_count(public.needs)'),
    ('public.rpc_close_remaining_search(uuid,integer,text,text)'),
    ('public.rpc_closure_api_guard()'),
    ('public.rpc_storage_account_open()'),
    ('rls_private.need_participant_can_read(uuid)'),
    ('rls_private.p6_discovery_test_world_accounts()'),
    ('private.account_visibility_world(uuid)'),
    ('private.retention_ai_source_ready()'),
    ('private.closure_source_digest_v5()'),
    ('private.closure_schema_digest_v5_139()'),
    ('private.closure_erasure_program_digest_v5()'),
    ('private.closure_erasure_binding_v5()'),
    ('private.data_export_policy_binding()')
), function_inventory AS (
  SELECT t.signature, p.oid, p.proowner, p.prosecdef, p.provolatile,
         p.proconfig, p.proacl, p.prosrc
  FROM target_functions t
  LEFT JOIN pg_proc p ON p.oid = to_regprocedure(t.signature)
)
SELECT jsonb_build_object(
  'unit', 'R01_METADATA_ONLY_PREFLIGHT',
  'captured_at', statement_timestamp(),
  'database_version', version(),
  'database_name', current_database(),
  'session_role', session_user,
  'transaction_read_only', current_setting('transaction_read_only'),
  'limitations', jsonb_build_array(
    'No business rows, synthetic fixtures, Auth sessions or HTTP requests are read or created.',
    'Catalog privileges are not proof of a successful or denied Data API request.',
    'Application readiness/digest functions are inventoried and never invoked.',
    'Project identity must be confirmed in the connection/tool context.',
    'Routine source dependencies are not exhaustively resolved by catalog dependency edges.'
  ),
  'roles', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.rolname) FROM target_roles r),
  'inherited_roles', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'role', r.rolname, 'inherited_role', parent.rolname,
      'usage', pg_has_role(r.oid, parent.oid, 'USAGE'),
      'member', pg_has_role(r.oid, parent.oid, 'MEMBER')
    ) ORDER BY r.rolname, parent.rolname), '[]'::jsonb)
    FROM target_roles r CROSS JOIN pg_roles parent
    WHERE r.oid <> parent.oid AND pg_has_role(r.oid, parent.oid, 'MEMBER')
  ),
  'need_relation', (
    SELECT jsonb_build_object(
      'present', true, 'owner', pg_get_userbyid(c.relowner),
      'acl', c.relacl, 'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity
    ) FROM pg_class c WHERE c.oid = to_regclass('public.needs')
  ),
  'need_select_by_column', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'role', r.rolname, 'column', a.attname,
      'private_target', a.attname = ANY(ARRAY[
        'requester_account_id', 'remaining_search_closed_by_account_id', 'remaining_search_close_reason'
      ]),
      'column_acl', a.attacl,
      'table_select', has_table_privilege(r.oid, a.attrelid, 'SELECT'),
      'effective_column_select', has_column_privilege(r.oid, a.attrelid, a.attnum, 'SELECT')
    ) ORDER BY r.rolname, a.attnum), '[]'::jsonb)
    FROM target_roles r CROSS JOIN pg_attribute a
    WHERE a.attrelid = to_regclass('public.needs') AND a.attnum > 0 AND NOT a.attisdropped
  ),
  'need_and_related_policies', (
    SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.schemaname, p.tablename, p.policyname), '[]'::jsonb)
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND (
      p.tablename = ANY(ARRAY[
        'needs', 'need_sensitive', 'marketplace_responses', 'marketplace_response_versions',
        'need_geography', 'need_requirement_details'
      ]) OR coalesce(p.qual, '') ~ '\mneeds\M' OR coalesce(p.with_check, '') ~ '\mneeds\M'
    )
  ),
  'functions', (
    SELECT jsonb_agg(jsonb_build_object(
      'signature', f.signature, 'present', f.oid IS NOT NULL,
      'owner', pg_get_userbyid(f.proowner), 'security_definer', f.prosecdef,
      'volatility', f.provolatile, 'config', f.proconfig, 'acl', f.proacl,
      'body_md5', md5(f.prosrc),
      'definition_md5', CASE WHEN f.oid IS NOT NULL THEN md5(pg_get_functiondef(f.oid)) END,
      'effective_access', (
        SELECT jsonb_agg(jsonb_build_object(
          'role', r.rolname,
          'execute', CASE WHEN f.oid IS NOT NULL THEN has_function_privilege(r.oid, f.oid, 'EXECUTE') END
        ) ORDER BY r.rolname) FROM target_roles r
      )
    ) ORDER BY f.signature) FROM function_inventory f
  ),
  'closure_function_definitions_not_executed', (
    SELECT jsonb_agg(jsonb_build_object(
      'signature', f.signature,
      'definition', CASE WHEN f.oid IS NOT NULL THEN pg_get_functiondef(f.oid) END
    ) ORDER BY f.signature)
    FROM function_inventory f WHERE f.signature LIKE 'private.%'
  ),
  'schema_access', (
    SELECT jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'acl', n.nspacl, 'role', r.rolname,
      'usage', has_schema_privilege(r.oid, n.oid, 'USAGE'),
      'create', has_schema_privilege(r.oid, n.oid, 'CREATE')
    ) ORDER BY n.nspname, r.rolname)
    FROM pg_namespace n CROSS JOIN target_roles r
    WHERE n.nspname IN ('public', 'private', 'rls_private')
  ),
  'default_acl', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'creator_role', pg_get_userbyid(d.defaclrole),
      'schema', CASE WHEN d.defaclnamespace = 0 THEN '<all schemas>' ELSE n.nspname END,
      'object_type', d.defaclobjtype, 'acl', d.defaclacl
    ) ORDER BY d.defaclrole, d.defaclnamespace, d.defaclobjtype), '[]'::jsonb)
    FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
    WHERE d.defaclnamespace = 0 OR n.nspname IN ('public', 'private', 'rls_private')
  ),
  'data_api_role_settings', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'role', r.rolname, 'setting', x.setting
    ) ORDER BY r.rolname, x.setting), '[]'::jsonb)
    FROM pg_roles r CROSS JOIN LATERAL unnest(r.rolconfig) x(setting)
    WHERE r.rolname = 'authenticator'
      AND split_part(x.setting, '=', 1) IN ('pgrst.db_pre_request', 'pgrst.db_schemas')
  ),
  'data_api_database_role_settings', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'database', CASE WHEN s.setdatabase = 0 THEN '<all databases>' ELSE d.datname END,
      'role', CASE WHEN s.setrole = 0 THEN '<all roles>' ELSE r.rolname END,
      'setting', x.setting
    ) ORDER BY s.setdatabase, s.setrole, x.setting), '[]'::jsonb)
    FROM pg_db_role_setting s
    LEFT JOIN pg_database d ON d.oid = s.setdatabase
    LEFT JOIN pg_roles r ON r.oid = s.setrole
    CROSS JOIN LATERAL unnest(s.setconfig) x(setting)
    WHERE (s.setrole = 0 OR r.rolname = 'authenticator')
      AND (s.setdatabase = 0 OR d.datname = current_database())
      AND split_part(x.setting, '=', 1) IN ('pgrst.db_pre_request', 'pgrst.db_schemas')
  )
) AS r01_metadata;

ROLLBACK;
