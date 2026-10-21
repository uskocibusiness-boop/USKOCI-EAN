-- Read-only catalog gate. Run immediately before candidate.sql; no user rows are returned.
-- A false value is a stop, not an invitation to weaken candidate.sql's guarded predecessor.
with begin_rpc as (
  select p.prosrc,p.proacl::text acl,p.prosecdef,p.provolatile,p.proconfig::text settings
  from pg_proc p where p.oid=to_regprocedure('public.rpc_begin_push_send(uuid,uuid)')
), candidate_state as (
  select p.prosrc,p.proacl::text acl,p.prosecdef,p.provolatile,p.proconfig::text settings
  from pg_proc p where p.oid=to_regprocedure('private.need_candidate_states_v5(uuid,uuid[])')
), needed_columns(relation_name,column_name) as (values
  ('public.user_activity_events','id'),('public.user_activity_events','recipient_user_id'),
  ('public.user_activity_events','recipient_role'),('public.user_activity_events','event_type'),
  ('public.user_activity_events','entity_type'),('public.user_activity_events','entity_id'),
  ('public.user_activity_events','entity_version'),('public.user_activity_events','payload'),
  ('public.user_activity_events','dedupe_key'),('public.notification_deliveries','event_id'),
  ('public.notification_deliveries','recipient_user_id'),('public.notification_deliveries','recipient_role'),
  ('public.notification_deliveries','channel'),('public.notification_deliveries','state'),
  ('public.notification_deliveries','suppression_reason'),('public.notification_deliveries','dedupe_key'),
  ('public.marketplace_responses','id'),('public.marketplace_responses','need_id'),
  ('public.marketplace_responses','worker_account_id'),('public.marketplace_responses','status'),
  ('public.marketplace_responses','current_version'),
  ('public.marketplace_responses','submitted_against_need_revision'),
  ('public.marketplace_response_versions','response_id'),
  ('public.marketplace_response_versions','version'),
  ('public.marketplace_response_versions','need_revision'),
  ('public.needs','id'),('public.needs','requester_account_id'),
  ('public.needs','revision'),('public.needs','status')
), missing_columns as (
  select n.relation_name||'.'||n.column_name name from needed_columns n
  where not exists (select 1 from pg_attribute a
    where a.attrelid=to_regclass(n.relation_name) and a.attname=n.column_name
      and a.attnum>0 and not a.attisdropped)
)
select clock_timestamp() checked_at,
  (select md5(prosrc) from begin_rpc) begin_body_md5,
  (select md5(prosrc)='380a2f203da2a7ad344bd80f061abd13'
     and acl='{postgres=X/postgres,service_role=X/postgres}'
     and prosecdef and provolatile='v' and settings='{search_path=pg_catalog}'
     from begin_rpc) is true as begin_exact,
  (select md5(prosrc) from candidate_state) candidate_state_body_md5,
  (select md5(prosrc)='91e873f74c8df477ab846391dfa53add'
     and acl='{postgres=X/postgres}' and prosecdef and provolatile='s'
     and settings='{search_path=pg_catalog}' from candidate_state) is true as candidate_state_exact,
  to_regprocedure('public.rpc_resolve_activity_application_v1(uuid,uuid)') is null as resolver_absent,
  to_regprocedure('private.support_auth_v5(uuid)') is not null
    and to_regprocedure('private.closure_assert_open(uuid,uuid)') is not null
    and to_regprocedure('private.accounts_same_world(uuid,uuid)') is not null
    and to_regprocedure('private.safety_event_blocked(public.user_activity_events)') is not null
    as authority_dependencies_present,
  private.closure_source_digest_v5() as closure_actual_digest,
  (select sha256 from private.closure_source_v5 where singleton) as closure_certificate,
  (select sha256 from private.closure_erasure_source_v5 where singleton) as erasure_certificate,
  private.retention_ai_source_ready() as retention_ready,
  private.closure_erasure_binding_v5() is not null as erasure_binding_ready,
  not exists(select 1 from missing_columns) as columns_present,
  (select coalesce(jsonb_agg(name order by name),'[]'::jsonb) from missing_columns) as missing_columns;
