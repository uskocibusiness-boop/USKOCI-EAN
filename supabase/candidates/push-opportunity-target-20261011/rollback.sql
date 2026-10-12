-- PREPARED ONLY. Atomic guarded rollback of the OPPORTUNITY push candidate.
-- Never run without separate operator approval; operates only on exact known sources.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create temporary table opp_rollback_before on commit drop as
 select p.proacl::text as acl,p.prosecdef as secdef,p.provolatile as volatility,
   p.proconfig::text as settings
 from pg_proc p where p.oid='public.rpc_begin_push_send(uuid,uuid)'::regprocedure;
do $preflight$
begin
 if (select count(*) from opp_rollback_before)<>1
   or (select md5(prosrc) from pg_proc where oid='public.rpc_begin_push_send(uuid,uuid)'::regprocedure)
      is distinct from '380a2f203da2a7ad344bd80f061abd13'
   or (select md5(prosrc) from pg_proc where oid='public.rpc_resolve_activity_opportunity_v1(uuid,uuid)'::regprocedure)
      is distinct from 'ac72682ce0b16066e726b374586923ca'
   or (select md5(prosrc) from pg_proc where oid='private.admit_push_opportunity_single_target_v1(uuid,uuid,uuid,uuid,uuid,uuid,bigint,uuid,timestamptz,timestamptz)'::regprocedure)
      is distinct from 'fca73a3a992b6dd3e9830d8baf0ff866'
 then raise exception 'OPPORTUNITY_ROLLBACK_SOURCE_DRIFT' using errcode='PT409';end if;
end
$preflight$;
-- Exact canonical predecessor, byte-for-byte PG function body; grants preserved by CREATE OR REPLACE.
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
       or not exists(select 1 from public.user_activity_events e where e.id=d.event_id and e.event_type='MESSAGE_RECEIVED')
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
  ) || case when v_event_type='MESSAGE_RECEIVED'
    then jsonb_build_object('eventId',v_event_id) else '{}'::jsonb end;
end
$function$;
-- RESTRICT is intentional: if an unexpected dependency exists, abort atomically.
drop function private.admit_push_opportunity_single_target_v1(uuid,uuid,uuid,uuid,uuid,uuid,bigint,uuid,timestamptz,timestamptz) restrict;
drop function public.rpc_resolve_activity_opportunity_v1(uuid,uuid) restrict;
do $postflight$
declare c opp_rollback_before%rowtype;a record;
begin
 select * into c from opp_rollback_before;
 select md5(prosrc) as md5,proacl::text as acl,prosecdef as secdef,
  provolatile as volatility,proconfig::text as settings into a
 from pg_proc where oid='public.rpc_begin_push_send(uuid,uuid)'::regprocedure;
 if a.md5 is distinct from '0de54bdd7ddcea92dfa697ade808155f'
  or (a.acl,a.secdef,a.volatility,a.settings) is distinct from (c.acl,c.secdef,c.volatility,c.settings)
  or to_regprocedure('private.admit_push_opportunity_single_target_v1(uuid,uuid,uuid,uuid,uuid,uuid,bigint,uuid,timestamptz,timestamptz)') is not null
  or to_regprocedure('public.rpc_resolve_activity_opportunity_v1(uuid,uuid)') is not null
 then raise exception 'OPPORTUNITY_ROLLBACK_POSTFLIGHT_FAILED' using errcode='PT409';end if;
end
$postflight$;
commit;
