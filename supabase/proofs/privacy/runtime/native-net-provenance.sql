-- R01: read-only, public-safe provenance of the native CREATE EXTENSION hook.
-- No fixture, SQL execution by the helper, Auth/user rows, or managed-object changes.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '15s';
WITH helper AS MATERIALIZED (
  SELECT p.oid,p.prosrc,p.proconfig,p.prosecdef
  FROM pg_proc p WHERE p.oid=to_regprocedure('extensions.grant_pg_net_access()')
), event AS MATERIALIZED (
  SELECT e.oid,e.evtfoid,e.evtevent,e.evttags,e.evtenabled
  FROM pg_event_trigger e WHERE e.evtname='issue_pg_net_access'
), dependencies AS MATERIALIZED (
  SELECT d.classid,d.objid FROM pg_depend d
  WHERE d.refclassid='pg_proc'::regclass
    AND d.refobjid=to_regprocedure('extensions.grant_pg_net_access()')
), extension AS MATERIALIZED (
  SELECT extversion FROM pg_extension WHERE extname='pg_net'
)
SELECT jsonb_build_object(
  'unit','R01_NATIVE_NET_PROVENANCE_CAPTURE','format_version',1,
  'read_only',current_setting('transaction_read_only'),
  'search_path',current_setting('search_path'),
  'server_version_num',current_setting('server_version_num')::integer,
  'database',current_database(),
  'extension_version',(SELECT extversion FROM extension),
  'helper',(SELECT jsonb_build_object(
    'source_sha256',encode(sha256(convert_to(prosrc,'UTF8')),'hex'),
    'normalized_sha256',encode(sha256(convert_to(replace(prosrc,'''0.8.0''','''0.8'''),'UTF8')),'hex'),
    'native_literal_count',(length(prosrc)-length(replace(prosrc,'''0.8''','')))/length('''0.8'''),
    'hosted_literal_count',(length(prosrc)-length(replace(prosrc,'''0.8.0''','')))/length('''0.8.0'''),
    'config_kind',CASE WHEN proconfig IS NULL THEN 'INHERITED'
      WHEN proconfig=ARRAY['search_path=""']::text[] THEN 'EMPTY_SEARCH_PATH'
      ELSE 'OTHER' END,
    'invoker',NOT prosecdef
  ) FROM helper),
  'event',(SELECT jsonb_build_object(
    'create_extension_only',evtevent='ddl_command_end'
       AND evttags=ARRAY['CREATE EXTENSION']::text[] AND evtenabled='O',
    'invokes_helper',evtfoid=to_regprocedure('extensions.grant_pg_net_access()')
  ) FROM event),
  'dependencies',(SELECT jsonb_build_object('total',count(*),
    'only_event',count(*)=1 AND coalesce(bool_and(classid='pg_event_trigger'::regclass
      AND objid=(SELECT oid FROM event)),false)) FROM dependencies),
  'legacy_branches',(SELECT jsonb_build_object(
    'native_active',extversion=ANY(ARRAY['0.2','0.6','0.7','0.7.1','0.8','0.10.0','0.11.0']::text[]),
    'hosted_active',extversion=ANY(ARRAY['0.2','0.6','0.7','0.7.1','0.8.0','0.10.0','0.11.0']::text[])
  ) FROM extension)
) AS capture;
ROLLBACK;
