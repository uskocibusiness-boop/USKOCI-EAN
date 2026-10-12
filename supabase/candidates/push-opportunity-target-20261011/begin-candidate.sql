-- PREPARED ONLY: never run on DEV without separate owner approval.
-- Captured canonical predecessor: live pg_proc.prosrc MD5 0de54bdd7ddcea92dfa697ade808155f
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create temporary table push_begin_preflight on commit drop as
 select prosrc as body,proacl::text as acl,prosecdef as secdef,provolatile as volatility,proconfig::text as settings
 from pg_proc where oid='public.rpc_begin_push_send(uuid,uuid)'::regprocedure;
do $preflight$
begin
 if (select count(*) from push_begin_preflight)<>1
  or (select md5(body) from push_begin_preflight) is distinct from '0de54bdd7ddcea92dfa697ade808155f'
 then raise exception 'PUSH_BEGIN_PREDECESSOR_DRIFT' using errcode='PT409';end if;
end;
$preflight$;
CREATE OR REPLACE FUNCTION public.rpc_begin_push_send(p_attempt_id uuid, p_lease_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  a public.notification_push_attempts%rowtype;
  d public.notification_deliveries%rowtype;
  dev public.notification_push_devices%rowtype;
  why text;
  v_event_type text;
  v_event_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select x.* into dev
  from public.notification_push_devices x
  join public.notification_push_attempts y on y.device_id=x.id
  where y.id=p_attempt_id;
  if not found then return jsonb_build_object('kind','SUPPRESSED'); end if;

  -- Preserve the proven token-first lock ordering.
  perform pg_advisory_xact_lock(hashtextextended('uskoci:push-token:'||dev.expo_push_token,0));
  select x.* into d
  from public.notification_deliveries x
  join public.notification_push_attempts y on y.delivery_id=x.id
  where y.id=p_attempt_id
  for update of x;
  select * into a from public.notification_push_attempts where id=p_attempt_id for update;
  if not found or a.transport_state<>'SEND_LEASED'
     or a.lease_id is distinct from p_lease_id
     or a.lease_until<=clock_timestamp() then
    raise exception 'PUSH_LEASE_STALE' using errcode='PT409';
  end if;

  select * into dev from public.notification_push_devices where id=a.device_id;
  if a.single_target_admission is not null then
    if a.single_target_claimed_at is null or a.send_count<>0
       or ((a.single_target_admission->>'expiresAt')::timestamptz>clock_timestamp()) is not true
       or a.device_id::text is distinct from a.single_target_admission->>'deviceId'
       or a.device_revision::text is distinct from a.single_target_admission->>'deviceRevision'
       or dev.bound_session_id::text is distinct from a.single_target_admission->>'boundSessionId'
       or d.event_id::text is distinct from a.single_target_admission->>'eventId'
       or d.recipient_user_id::text is distinct from a.single_target_admission->>'recipientAccountId'
       or d.recipient_role is distinct from a.single_target_admission->>'recipientRole'
       or not exists(select 1 from public.user_activity_events e
         where e.id=d.event_id and e.recipient_user_id=d.recipient_user_id
           and e.recipient_role=d.recipient_role
           and e.event_type=a.single_target_admission->>'eventType'
           and e.event_type in ('MESSAGE_RECEIVED','OPPORTUNITY_AVAILABLE'))
       -- A Need can change between manual admission and the actual send. Recheck
       -- current recipient, public task revision, world, consent and expiry.
       or (a.single_target_admission->>'eventType'='OPPORTUNITY_AVAILABLE' and not exists(
         select 1 from public.user_activity_events e
         join public.needs n on n.id=e.entity_id
         join public.app_profiles p on p.account_id=d.recipient_user_id
           and p.kind='WORKER' and p.profile_status='ACTIVE'
         join public.opportunity_deliveries od on od.worker_profile_id=p.id
           and od.worker_account_id=d.recipient_user_id and od.need_id=n.id
           and od.need_revision=n.revision
         where e.id=d.event_id and e.recipient_user_id=d.recipient_user_id
           and e.recipient_role='WORKER' and e.event_type='OPPORTUNITY_AVAILABLE'
           and e.entity_type='NEED' and e.entity_version=n.revision
           and e.dedupe_key='opp:'||n.id::text||':'||n.revision::text||':'||d.recipient_user_id::text
           and n.status in ('PUBLISHED','SELECTION') and n.requester_account_id is not null
           and n.requester_account_id<>d.recipient_user_id
           and od.status in ('READY','SEEN','RESPONDED') and od.expires_at>clock_timestamp()
           and private.accounts_same_world(n.requester_account_id,d.recipient_user_id)
           and not private.closure_account_restricted(n.requester_account_id)
           and not private.safety_event_blocked(e)
           and exists(select 1 from public.notification_deliveries x where x.event_id=e.id
             and x.recipient_user_id=d.recipient_user_id and x.recipient_role='WORKER'
             and x.channel='IN_APP' and x.dedupe_key=e.dedupe_key||':in_app'
             and x.suppression_reason is null and x.state in ('CREATED','SENT','DELIVERED','READ'))
       ))
    then why:='SINGLE_TARGET_EXPIRED_OR_CHANGED'; end if;
  end if;
  why:=coalesce(why,private.push_suppression(d));
  if why is null and
    (dev.id is null or dev.user_id<>d.recipient_user_id or not dev.active
     or dev.revision<>a.device_revision or dev.bound_revision is distinct from dev.revision
     or not private.push_session_valid(dev.user_id,dev.bound_session_id)) then
    why:='DEVICE_CHANGED';
  end if;
  if why is not null then
    update public.notification_push_attempts
    set transport_state='SUPPRESSED',outcome='FATAL',error_code=why,lease_id=null,lease_until=null
    where id=a.id;
    return jsonb_build_object('kind','SUPPRESSED');
  end if;

  select e.event_type,e.id into v_event_type,v_event_id
  from public.user_activity_events e
  where e.id=d.event_id
    and e.recipient_user_id=d.recipient_user_id
    and e.recipient_role=d.recipient_role;
  if v_event_type is null then
    update public.notification_push_attempts
    set transport_state='SUPPRESSED',outcome='FATAL',error_code='EVENT_UNAVAILABLE',lease_id=null,lease_until=null
    where id=a.id;
    return jsonb_build_object('kind','SUPPRESSED');
  end if;

  update public.notification_push_attempts
  set transport_state='SEND_STARTED',send_count=send_count+1
  where id=a.id;

  -- The event UUID is a recipient-bound hint, never navigation authority. The
  -- authenticated P4 resolver rechecks it after tap and returns the exact target.
  return jsonb_build_object(
    'kind','SEND',
    'attemptId',a.id,
    'leaseId',a.lease_id,
    'leaseExpiresAt',a.lease_until,
    'expoPushToken',dev.expo_push_token,
    'priority',d.priority,
    'eventType',v_event_type
  ) || case when v_event_type in ('MESSAGE_RECEIVED','OPPORTUNITY_AVAILABLE')
    then jsonb_build_object('eventId',v_event_id) else '{}'::jsonb end;
end
$function$;
do $postflight$
declare b push_begin_preflight%rowtype;a record;
begin
 select * into b from push_begin_preflight;
 select prosrc as body,proacl::text as acl,prosecdef as secdef,provolatile as volatility,
   proconfig::text as settings into a
 from pg_proc where oid='public.rpc_begin_push_send(uuid,uuid)'::regprocedure;
 if a.body is null or md5(a.body)=md5(b.body)
  or (a.acl,a.secdef,a.volatility,a.settings) is distinct from (b.acl,b.secdef,b.volatility,b.settings)
 then raise exception 'PUSH_BEGIN_POSTFLIGHT_INVALID' using errcode='PT409';end if;
end;
$postflight$;
commit;
