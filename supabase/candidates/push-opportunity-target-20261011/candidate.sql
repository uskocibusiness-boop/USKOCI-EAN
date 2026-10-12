-- PREPARED ONLY: new, narrow, authenticated read; not applied to DEV/PROD.
-- A provider push event ID is NOT a route. The event+delivery+revision+worker
-- admission below must all agree before the client learns the Need ID.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $guard$
begin
 if to_regprocedure('public.rpc_resolve_activity_opportunity_v1(uuid,uuid)') is not null
 then raise exception 'OPPORTUNITY_RESOLVER_ALREADY_EXISTS' using errcode='PT409'; end if;
end
$guard$;
create function public.rpc_resolve_activity_opportunity_v1(p_expected_user_id uuid,p_event_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path to 'pg_catalog'
as $function$
declare
 u uuid := private.support_auth_v5(p_expected_user_id);
 v_need uuid;
 v_requester uuid;
 unavailable jsonb := jsonb_build_object('schema','ACTIVITY_OPPORTUNITY_TARGET_V1',
   'accountId',u,'kind','UNAVAILABLE','authoritative',true);
begin
 select n.id,n.requester_account_id into v_need,v_requester
 from public.user_activity_events e
 join public.needs n on n.id=e.entity_id
 join public.opportunity_deliveries od
   on od.worker_account_id=u and od.need_id=n.id and od.need_revision=n.revision
 join public.app_profiles p on p.id=od.worker_profile_id and p.account_id=u
 join public.notification_deliveries d
   on d.event_id=e.id and d.recipient_user_id=u and d.recipient_role='WORKER'
   and d.channel='IN_APP' and d.dedupe_key=e.dedupe_key||':in_app'
 where e.id=p_event_id and e.recipient_user_id=u
   and e.recipient_role='WORKER' and e.event_type='OPPORTUNITY_AVAILABLE'
   and e.entity_type='NEED' and e.entity_version=n.revision
   and e.dedupe_key='opp:'||n.id::text||':'||n.revision::text||':'||u::text
   and n.status in ('PUBLISHED','SELECTION')
   and n.requester_account_id<>u and n.requester_account_id is not null
   and p.kind='WORKER' and p.profile_status='ACTIVE'
   and od.status in ('READY','SEEN','RESPONDED')
   and od.expires_at>clock_timestamp()
   and d.state in ('CREATED','SENT','DELIVERED','READ')
   and d.suppression_reason is null
   and private.accounts_same_world(n.requester_account_id,u)
   and not private.safety_event_blocked(e)
 limit 1;
 if not found then
   perform private.support_auth_v5(u);
   return unavailable;
 end if;
 begin
   perform private.closure_assert_open(u,v_requester);
 exception when sqlstate '42501' then
   perform private.support_auth_v5(u);
   return unavailable;
 end;
 perform private.support_auth_v5(u);
 return jsonb_build_object('schema','ACTIVITY_OPPORTUNITY_TARGET_V1',
  'accountId',u,'kind','OPPORTUNITY','eventId',p_event_id,
  'needId',v_need,'role','WORKER','authoritative',true);
end;
$function$;
revoke all on function public.rpc_resolve_activity_opportunity_v1(uuid,uuid) from public,anon;
grant execute on function public.rpc_resolve_activity_opportunity_v1(uuid,uuid) to authenticated;
commit;
