-- R01 bootstrap metadata capture. Catalogs only; never run application functions.
-- This source does not install a schema, read application/Auth rows, or prove HTTP.
-- The caller must establish the project identity from the connection/tool context.
-- No pg_authid, passwords, tokens, sequence values, cron jobs, or arbitrary role
-- settings are selected. Auth column definitions are metadata, not user records.
--
-- Normalization contract: PostgreSQL 17, search_path=pg_catalog, object names
-- instead of OIDs, ordered JSON arrays, and md5(JSONB::text) for section digests.
-- REV10 catalog queries did not pin this search_path. Its prosrc/body MD5 values
-- remain directly comparable; its pg_get_functiondef/expression/DDL MD5 values
-- must NOT be equated to this new pinned-path format without normalization.
-- Full schema parity is NOT performed here. Compare this capture with a later
-- disposable capture; expand any differing section before accepting parity.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog;

WITH app_namespaces AS MATERIALIZED (
  SELECT oid, nspname FROM pg_namespace
  WHERE nspname IN ('public', 'private', 'rls_private')
), app_relations AS MATERIALIZED (
  SELECT c.*, n.nspname
  FROM pg_class c JOIN app_namespaces n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S', 'c')
), managed_relations AS MATERIALIZED (
  SELECT c.*, n.nspname
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE (n.nspname = 'auth' AND c.relname IN
    ('users', 'identities', 'sessions', 'refresh_tokens'))
    OR (n.nspname = 'storage' AND c.relname = 'objects')
    OR (n.nspname = 'realtime' AND c.relname = 'messages')
), target_relations AS MATERIALIZED (
  SELECT * FROM app_relations UNION ALL SELECT * FROM managed_relations
), relation_rows AS MATERIALIZED (
  SELECT c.nspname AS schema, c.relname AS name, c.relkind AS kind,
    pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS acl,
    c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls,
    c.relpersistence AS persistence, c.relispartition AS is_partition,
    c.relreplident AS replica_identity, c.reloptions AS options,
    am.amname AS access_method,
    (SELECT spcname FROM pg_tablespace WHERE oid = c.reltablespace) AS tablespace,
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'position', a.attnum, 'name', a.attname,
      'type', format_type(a.atttypid, a.atttypmod),
      'not_null', a.attnotnull, 'identity', a.attidentity,
      'generated', a.attgenerated, 'acl', a.attacl::text,
      'collation', CASE WHEN a.attcollation = 0 THEN NULL
        ELSE a.attcollation::regcollation::text END,
      'storage', a.attstorage, 'compression', a.attcompression,
      'default_or_generated', pg_get_expr(d.adbin, d.adrelid, true)
    ) ORDER BY a.attnum), '[]'::jsonb)
      FROM pg_attribute a LEFT JOIN pg_attrdef d
        ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS columns,
    (SELECT coalesce(jsonb_agg(a.attnum ORDER BY a.attnum), '[]'::jsonb)
      FROM pg_attribute a WHERE a.attrelid = c.oid
        AND a.attnum > 0 AND a.attisdropped) AS dropped_column_positions
  FROM target_relations c LEFT JOIN pg_am am ON am.oid = c.relam
), function_rows AS MATERIALIZED (
  SELECT n.nspname AS schema, p.proname AS name,
    pg_get_function_identity_arguments(p.oid) AS identity_arguments,
    pg_get_function_result(p.oid) AS returns, p.prokind AS kind,
    l.lanname AS language, pg_get_userbyid(p.proowner) AS owner,
    p.prosecdef AS security_definer, p.provolatile AS volatility,
    p.proisstrict AS strict, p.proparallel AS parallel,
    p.proleakproof AS leakproof, p.proretset AS returns_set,
    p.procost AS cost, p.prorows AS rows, p.proconfig AS settings,
    p.proacl::text AS acl, p.pronargdefaults AS default_argument_count,
    md5(pg_get_function_arguments(p.oid)) AS pinned_arguments_md5,
    md5(p.prosrc) AS body_md5, length(p.prosrc) AS body_chars,
    md5(pg_get_functiondef(p.oid)) AS pinned_definition_md5,
    CASE WHEN p.prosupport = 0 THEN NULL
      ELSE p.prosupport::regprocedure::text END AS support_function,
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'role', r.rolname, 'execute', has_function_privilege(r.oid, p.oid, 'EXECUTE'),
      'schema_usage', has_schema_privilege(r.oid, n.oid, 'USAGE')
    ) ORDER BY r.rolname), '[]'::jsonb)
      FROM pg_roles r WHERE r.rolname IN
        ('anon', 'authenticated', 'authenticator', 'service_role')) AS effective_access
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
  WHERE (n.nspname IN ('public', 'private', 'rls_private')
    OR (n.nspname = 'auth' AND p.proname IN ('uid', 'jwt', 'role', 'email')))
    AND p.prokind IN ('f', 'p')
), constraint_rows AS MATERIALIZED (
  SELECT c.nspname AS schema, c.relname AS relation, co.conname AS name,
    co.contype AS kind, co.condeferrable AS deferrable,
    co.condeferred AS initially_deferred, co.convalidated AS validated,
    co.connoinherit AS no_inherit,
    pg_get_constraintdef(co.oid, true) AS definition
  FROM pg_constraint co JOIN target_relations c ON c.oid = co.conrelid
), index_rows AS MATERIALIZED (
  SELECT c.nspname AS schema, c.relname AS relation, x.relname AS name,
    pg_get_indexdef(i.indexrelid) AS definition, x.reloptions AS options,
    i.indisunique AS is_unique, i.indisprimary AS is_primary,
    i.indisexclusion AS is_exclusion, i.indnullsnotdistinct AS nulls_not_distinct,
    i.indisvalid AS valid, i.indisready AS ready, i.indislive AS live,
    i.indimmediate AS immediate, i.indisreplident AS replica_identity,
    (SELECT coalesce(jsonb_agg(co.conname ORDER BY co.conname), '[]'::jsonb)
      FROM pg_constraint co WHERE co.conindid = i.indexrelid
        AND co.conrelid = c.oid AND co.contype IN ('p', 'u', 'x')) AS constraints
  FROM pg_index i JOIN target_relations c ON c.oid = i.indrelid
    JOIN pg_class x ON x.oid = i.indexrelid
), policy_rows AS MATERIALIZED (
  SELECT c.nspname AS schema, c.relname AS relation, p.polname AS name,
    p.polcmd AS command, p.polpermissive AS permissive,
    (SELECT jsonb_agg(CASE WHEN r = 0 THEN 'PUBLIC'
      ELSE pg_get_userbyid(r) END ORDER BY CASE WHEN r = 0 THEN 'PUBLIC'
      ELSE pg_get_userbyid(r) END) FROM unnest(p.polroles) r) AS roles,
    pg_get_expr(p.polqual, p.polrelid, true) AS using_expression,
    pg_get_expr(p.polwithcheck, p.polrelid, true) AS with_check_expression
  FROM pg_policy p JOIN target_relations c ON c.oid = p.polrelid
), trigger_rows AS MATERIALIZED (
  SELECT n.nspname AS schema, c.relname AS relation, t.tgname AS name,
    pg_get_triggerdef(t.oid, true) AS definition, t.tgenabled AS enabled,
    t.tgfoid::regprocedure::text AS function_signature,
    t.tgdeferrable AS deferrable, t.tginitdeferred AS initially_deferred
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc f ON f.oid = t.tgfoid
    JOIN pg_namespace fn ON fn.oid = f.pronamespace
  WHERE NOT t.tgisinternal AND (c.oid IN (SELECT oid FROM target_relations)
    OR fn.nspname IN ('public', 'private', 'rls_private'))
), schema_rows AS MATERIALIZED (
  SELECT nspname AS name, pg_get_userbyid(nspowner) AS owner, nspacl::text AS acl
  FROM pg_namespace WHERE nspname IN ('public', 'private', 'rls_private',
    'auth', 'storage', 'realtime', 'extensions', 'graphql_public')
), membership_rows AS MATERIALIZED (
  SELECT pg_get_userbyid(m.roleid) AS role, pg_get_userbyid(m.member) AS member,
    pg_get_userbyid(m.grantor) AS grantor, m.admin_option,
    m.inherit_option, m.set_option
  FROM pg_auth_members m
), default_acl_rows AS MATERIALIZED (
  SELECT pg_get_userbyid(d.defaclrole) AS owner,
    CASE WHEN d.defaclnamespace = 0 THEN NULL
      ELSE d.defaclnamespace::regnamespace::text END AS schema,
    d.defaclobjtype AS kind, d.defaclacl::text AS acl
  FROM pg_default_acl d
), safe_setting_rows AS MATERIALIZED (
  SELECT CASE WHEN s.setdatabase = 0 THEN NULL
      ELSE (SELECT datname FROM pg_database WHERE oid = s.setdatabase) END AS database,
    CASE WHEN s.setrole = 0 THEN NULL ELSE pg_get_userbyid(s.setrole) END AS role,
    x.setting
  FROM pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) x(setting)
  WHERE split_part(x.setting, '=', 1) IN ('search_path', 'pgrst.db_schemas',
    'pgrst.db_extra_search_path', 'pgrst.db_pre_request', 'pgrst.db_root_spec',
    'statement_timeout', 'idle_in_transaction_session_timeout', 'lock_timeout',
    'default_transaction_read_only')
), catalog_sections AS (
  SELECT 'application_relations' AS name,
    coalesce(jsonb_agg(to_jsonb(r) ORDER BY schema, name), '[]'::jsonb) AS items
    FROM relation_rows r WHERE schema IN ('public', 'private', 'rls_private')
  UNION ALL SELECT 'managed_relation_contract',
    coalesce(jsonb_agg(to_jsonb(r) ORDER BY schema, name), '[]'::jsonb)
    FROM relation_rows r WHERE schema IN ('auth', 'storage', 'realtime')
  UNION ALL SELECT 'constraints',
    coalesce(jsonb_agg(to_jsonb(r) ORDER BY schema, relation, name), '[]'::jsonb) FROM constraint_rows r
  UNION ALL SELECT 'indexes',
    coalesce(jsonb_agg(to_jsonb(r) ORDER BY schema, relation, name), '[]'::jsonb) FROM index_rows r
  UNION ALL SELECT 'policies',
    coalesce(jsonb_agg(to_jsonb(r) ORDER BY schema, relation, name), '[]'::jsonb) FROM policy_rows r
  UNION ALL SELECT 'triggers',
    coalesce(jsonb_agg(to_jsonb(r) ORDER BY schema, relation, name), '[]'::jsonb) FROM trigger_rows r
  UNION ALL SELECT 'function_inventory',
    coalesce(jsonb_agg(to_jsonb(r) ORDER BY schema, name, identity_arguments), '[]'::jsonb) FROM function_rows r
  UNION ALL SELECT 'schemas',
    coalesce(jsonb_agg(to_jsonb(r) ORDER BY name), '[]'::jsonb) FROM schema_rows r
  UNION ALL SELECT 'memberships',
    coalesce(jsonb_agg(to_jsonb(r) ORDER BY role, member, grantor), '[]'::jsonb) FROM membership_rows r
  UNION ALL SELECT 'default_acl',
    coalesce(jsonb_agg(to_jsonb(r) ORDER BY owner, schema, kind), '[]'::jsonb) FROM default_acl_rows r
  UNION ALL SELECT 'safe_role_settings',
    coalesce(jsonb_agg(to_jsonb(r) ORDER BY database, role, setting), '[]'::jsonb) FROM safe_setting_rows r
)
SELECT jsonb_build_object(
  'unit', 'R01_BOOTSTRAP_METADATA_ONLY', 'format_version', 3,
  'captured_at', statement_timestamp(), 'database_name', current_database(),
  'session_role', session_user, 'server_version', current_setting('server_version'),
  'server_version_num', current_setting('server_version_num')::integer,
  'transaction_read_only', current_setting('transaction_read_only'),
  'normalization', jsonb_build_object('search_path', current_setting('search_path'),
    'section_hash', 'md5(ordered JSONB array::text); no OIDs or observation times',
    'rev10_comparison', 'body_md5 is directly comparable; full DDL/expression hashes use a new pinned-path format'),
  'limitations', jsonb_build_array(
    'Metadata capture only; full schema parity and Auth/PostgREST behavior are NOT verified.',
    'No application/Auth data, sequence state, migration-ledger rows, provider settings or hosted service versions are read.',
    'Managed relation metadata describes a contract, not permission to replace managed schemas.',
    'Role/managed-platform differences require explicit review; a section mismatch is not permission to copy hosted operational roles.',
    'Text-function dependency completeness, reference fixtures and closure readiness remain separate checks.'
  ),
  'required_objects', jsonb_build_object(
    'needs', to_regclass('public.needs') IS NOT NULL,
    'auth_users', to_regclass('auth.users') IS NOT NULL,
    'auth_identities', to_regclass('auth.identities') IS NOT NULL,
    'authenticator', EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator'),
    'closure_pre_request', to_regprocedure('public.rpc_closure_api_guard()') IS NOT NULL),
  'normalized_sections', (SELECT jsonb_object_agg(name, jsonb_build_object(
    'row_count', jsonb_array_length(items), 'md5', md5(items::text)) ORDER BY name) FROM catalog_sections),
  -- Full metadata rows make a differing digest diagnosable and allow a faithful
  -- disposable bootstrap. Keep the output in the private evidence store; source
  -- definitions/defaults may include operational literals and require review
  -- before any derived schema is published. No business rows are selected.
  'catalog_sections', (SELECT jsonb_object_agg(name, items ORDER BY name) FROM catalog_sections),
  'function_definitions', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'name', p.proname,
    'identity_arguments', pg_get_function_identity_arguments(p.oid),
    'definition', pg_get_functiondef(p.oid)
  ) ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)), '[]'::jsonb)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname IN ('public', 'private', 'rls_private')
      OR (n.nspname = 'auth' AND p.proname IN ('uid', 'jwt', 'role', 'email')))
      AND p.prokind IN ('f', 'p')),
  'function_inventory', (SELECT items FROM catalog_sections WHERE name = 'function_inventory'),
  'schemas', (SELECT items FROM catalog_sections WHERE name = 'schemas'),
  'memberships', (SELECT items FROM catalog_sections WHERE name = 'memberships'),
  'default_acl', (SELECT items FROM catalog_sections WHERE name = 'default_acl'),
  'safe_role_settings', (SELECT items FROM catalog_sections WHERE name = 'safe_role_settings'),
  'roles', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', rolname, 'superuser', rolsuper, 'inherit', rolinherit,
    'bypassrls', rolbypassrls, 'canlogin', rolcanlogin,
    'createrole', rolcreaterole, 'createdb', rolcreatedb,
    'replication', rolreplication) ORDER BY rolname), '[]'::jsonb) FROM pg_roles),
  'extensions', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', e.extname, 'schema', n.nspname, 'version', e.extversion,
    'owner', pg_get_userbyid(e.extowner), 'relocatable', e.extrelocatable
  ) ORDER BY e.extname), '[]'::jsonb)
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace),
  'sequences', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema', c.nspname, 'name', c.relname, 'type', format_type(s.seqtypid, NULL),
    -- Decimal strings preserve all bigint bits through JSON/JavaScript transport.
    'start', s.seqstart::text, 'increment', s.seqincrement::text, 'min', s.seqmin::text,
    'max', s.seqmax::text, 'cache', s.seqcache::text, 'cycle', s.seqcycle,
    'owned_by', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'relation', t.relname, 'column', a.attname,
      'dependency_kind', d.deptype) ORDER BY n.nspname, t.relname, a.attname), '[]'::jsonb)
      FROM pg_depend d JOIN pg_class t ON t.oid = d.refobjid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
      WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid
        AND d.refclassid = 'pg_class'::regclass AND d.deptype IN ('a', 'i'))
  ) ORDER BY c.nspname, c.relname), '[]'::jsonb)
    FROM pg_sequence s JOIN app_relations c ON c.oid = s.seqrelid),
  'event_triggers', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', evtname, 'event', evtevent, 'owner', pg_get_userbyid(evtowner),
    'function_signature', evtfoid::regprocedure::text,
    'enabled', evtenabled, 'tags', evttags) ORDER BY evtname), '[]'::jsonb) FROM pg_event_trigger),
  'needs_relation', (SELECT to_jsonb(r) FROM relation_rows r WHERE schema = 'public' AND name = 'needs'),
  'needs_policies', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY name), '[]'::jsonb)
    FROM policy_rows r WHERE schema = 'public' AND relation = 'needs'),
  'needs_column_select', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'role', r.rolname, 'column', a.attname,
    'table_select', has_table_privilege(r.oid, c.oid, 'SELECT'),
    'effective_select', has_column_privilege(r.oid, c.oid, a.attnum, 'SELECT')
  ) ORDER BY r.rolname, a.attnum), '[]'::jsonb)
    FROM app_relations c JOIN pg_attribute a ON a.attrelid = c.oid
      CROSS JOIN pg_roles r
    WHERE c.nspname = 'public' AND c.relname = 'needs'
      AND a.attnum > 0 AND NOT a.attisdropped
      AND r.rolname IN ('anon', 'authenticated', 'authenticator', 'service_role')),
  'managed_auth_relations', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY name), '[]'::jsonb)
    FROM relation_rows r WHERE schema = 'auth'),
  'managed_auth_constraints', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY relation, name), '[]'::jsonb)
    FROM constraint_rows r WHERE schema = 'auth'),
  'managed_auth_triggers', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY relation, name), '[]'::jsonb)
    FROM trigger_rows r WHERE schema = 'auth'),
  'unsupported_shapes', jsonb_build_object(
    'nonordinary_application_relations', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', nspname, 'name', relname, 'kind', relkind,
      'persistence', relpersistence, 'is_partition', relispartition)
      ORDER BY nspname, relname), '[]'::jsonb) FROM app_relations
      WHERE relkind NOT IN ('r', 'S') OR relpersistence <> 'p' OR relispartition),
    'inheritance', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'child', i.inhrelid::regclass::text, 'parent', i.inhparent::regclass::text,
      'sequence', i.inhseqno) ORDER BY i.inhrelid::regclass::text, i.inhseqno), '[]'::jsonb)
      FROM pg_inherits i WHERE i.inhrelid IN (SELECT oid FROM app_relations)
        OR i.inhparent IN (SELECT oid FROM app_relations)),
    'rewrite_rules', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'relation', r.ev_class::regclass::text, 'name', r.rulename,
      'definition_md5', md5(pg_get_ruledef(r.oid, true)))
      ORDER BY r.ev_class::regclass::text, r.rulename), '[]'::jsonb)
      FROM pg_rewrite r WHERE r.ev_class IN (SELECT oid FROM app_relations)),
    'custom_types', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', t.typname, 'kind', t.typtype)
      ORDER BY n.nspname, t.typname), '[]'::jsonb)
      FROM pg_type t JOIN app_namespaces n ON n.oid = t.typnamespace
      WHERE t.typtype IN ('e', 'd', 'r', 'm') OR (t.typtype = 'b' AND t.typelem = 0)
        OR (t.typtype = 'c'
        AND EXISTS (SELECT 1 FROM pg_class c WHERE c.oid = t.typrelid AND c.relkind = 'c'))),
    'collations', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', c.collname)
      ORDER BY n.nspname, c.collname), '[]'::jsonb)
      FROM pg_collation c JOIN app_namespaces n ON n.oid = c.collnamespace),
    'operators', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', o.oprname,
      'left_type', CASE WHEN o.oprleft = 0 THEN NULL ELSE format_type(o.oprleft, NULL) END,
      'right_type', CASE WHEN o.oprright = 0 THEN NULL ELSE format_type(o.oprright, NULL) END)
      ORDER BY n.nspname, o.oprname, o.oprleft::regtype::text, o.oprright::regtype::text), '[]'::jsonb)
      FROM pg_operator o JOIN app_namespaces n ON n.oid = o.oprnamespace),
    'casts', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'source', format_type(c.castsource, NULL), 'target', format_type(c.casttarget, NULL),
      'context', c.castcontext, 'method', c.castmethod)
      ORDER BY format_type(c.castsource, NULL), format_type(c.casttarget, NULL)), '[]'::jsonb)
      FROM pg_cast c JOIN pg_type s ON s.oid = c.castsource JOIN pg_type t ON t.oid = c.casttarget
      WHERE s.typnamespace IN (SELECT oid FROM app_namespaces)
        OR t.typnamespace IN (SELECT oid FROM app_namespaces)),
    'aggregate_or_window_functions', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', p.proname, 'kind', p.prokind,
      'arguments', pg_get_function_identity_arguments(p.oid))
      ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)), '[]'::jsonb)
      FROM pg_proc p JOIN app_namespaces n ON n.oid = p.pronamespace
      WHERE p.prokind NOT IN ('f', 'p'))
  )
) AS r01_bootstrap_metadata;

ROLLBACK;
