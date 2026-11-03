-- Read-only fingerprint of the managed event hook; never execute the hook.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL statement_timeout='15s';
SELECT jsonb_build_object(
  'unit','R01_MANAGED_NET_HOOK_CAPTURE','format_version',1,
  'webhook_schema_absent',to_regnamespace('supabase_functions') IS NULL,
  'net_get_invoker',(SELECT NOT prosecdef FROM pg_proc WHERE oid=to_regprocedure('net.http_get(text,jsonb,jsonb,integer)')),
  'net_post_invoker',(SELECT NOT prosecdef FROM pg_proc WHERE oid=to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)')),
  'helper',(SELECT jsonb_build_object(
    'owner_md5',md5(pg_get_userbyid(p.proowner)),'security_definer',p.prosecdef,
    'config_md5',md5(p.proconfig::text),'acl_md5',md5(p.proacl::text),
    'body_md5',md5(p.prosrc),'definition_md5',md5(pg_get_functiondef(p.oid)))
    FROM pg_proc p WHERE p.oid=to_regprocedure('extensions.grant_pg_net_access()')),
  'event',(SELECT jsonb_build_object(
    'owner_md5',md5(pg_get_userbyid(e.evtowner)),
    'event_md5',md5(e.evtevent),'enabled_md5',md5(e.evtenabled::text),
    'tags_md5',md5(e.evttags::text),'function_md5',md5(e.evtfoid::regprocedure::text))
    FROM pg_event_trigger e WHERE evtname='issue_pg_net_access'));
ROLLBACK;
