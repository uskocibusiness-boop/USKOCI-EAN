-- NOT PROMOTABLE: behavioral candidate only; exact live certificate application is not included.
-- This file always rolls back. It never admits an event or calls a provider.
begin;
set local statement_timeout='20s';
set local lock_timeout='3s';
do $pin$ begin if (select md5(prosrc) from pg_proc where oid='private.admit_push_single_target_v1(uuid,uuid,uuid,text,uuid,uuid,uuid,bigint,uuid,timestamp with time zone,timestamp with time zone)'::regprocedure) is distinct from '5c3ff77eae79eeaf043298fb91490577' then raise exception 'PREDECESSOR_CHANGED';end if;end $pin$;
do $pin$ begin if (select md5(prosrc) from pg_proc where oid='rpc_begin_push_send(uuid,uuid)'::regprocedure) is distinct from '0de54bdd7ddcea92dfa697ade808155f' then raise exception 'PREDECESSOR_CHANGED';end if;end $pin$;
CREATE OR REPLACE FUNCTION private.admit_push_single_target_v1(p_admission_id uuid, p_authorization_id uuid, p_recipient_user_id uuid, p_recipient_role text, p_event_id uuid, p_delivery_id uuid, p_device_id uuid, p_device_revision bigint, p_bound_session_id uuid, p_expires_at timestamp with time zone, p_receipt_deadline timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare d public.notification_deliveries%rowtype; dev public.notification_push_devices%rowtype;
 a public.notification_push_attempts%rowtype; v_event public.user_activity_events%rowtype; v_op public.opportunity_deliveries%rowtype; meta jsonb; why text; v_now timestamptz:=clock_timestamp();
begin
 if current_user<>'postgres' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_admission_id is null or p_authorization_id is null or p_recipient_user_id is null
  or p_recipient_role is null or p_recipient_role not in ('REQUESTER','WORKER')
  or p_event_id is null or p_delivery_id is null or p_device_id is null or p_device_revision is null or p_device_revision<0
  or p_bound_session_id is null or p_expires_at is null or p_receipt_deadline is null
  or not isfinite(p_expires_at) or not isfinite(p_receipt_deadline)
  or p_receipt_deadline<=p_expires_at or p_receipt_deadline>p_expires_at+interval '24 hours'
 then raise exception 'INVALID_PUSH_ADMISSION' using errcode='22023'; end if;
 -- Admission and claim share the existing cross-isolate serializer; no provider/token lock is held here.
 if not pg_try_advisory_xact_lock(hashtextextended('uskoci:push-claim',0)) then return jsonb_build_object('kind','BUSY'); end if;
 -- New admissions follow the same Need-before-delivery order as cancellation.
 -- Existing admission replay does not depend on current opportunity availability.
 perform 1 from public.needs n join public.user_activity_events e on e.entity_id=n.id
  where e.id=p_event_id and e.event_type='OPPORTUNITY_AVAILABLE' and e.entity_type='NEED'
    and not exists(select 1 from public.notification_push_attempts where id=p_admission_id)
  for update of n;
 select * into d from public.notification_deliveries where id=p_delivery_id for update;
 if not found then raise exception 'PUSH_TARGET_UNAVAILABLE' using errcode='PT409'; end if;
 select * into a from public.notification_push_attempts where id=p_admission_id for update;
 if found then
 meta:=jsonb_build_object('schema','PUSH_SINGLE_TARGET_V1','authorizationId',p_authorization_id,
  'recipientAccountId',p_recipient_user_id,'recipientRole',p_recipient_role,'eventId',p_event_id,
  'eventType',a.single_target_admission->>'eventType','deviceId',p_device_id,'deviceRevision',p_device_revision,
  'boundSessionId',p_bound_session_id,'expiresAt',p_expires_at,'receiptDeadline',p_receipt_deadline);
  if a.delivery_id<>p_delivery_id or a.device_id is distinct from p_device_id or (a.single_target_admission - ARRAY['opportunityId','workerProfileId','needId','needRevision']) is distinct from meta
  then raise exception 'PUSH_ADMISSION_CONFLICT' using errcode='PT409'; end if;
  return jsonb_build_object('kind','EXISTING','admissionId',a.id,'state',a.transport_state);
 end if;
 select * into v_event from public.user_activity_events
 where id=p_event_id and recipient_user_id=p_recipient_user_id and recipient_role=p_recipient_role
   and event_type in ('MESSAGE_RECEIVED','OPPORTUNITY_AVAILABLE');
 if not found then raise exception 'PUSH_TARGET_UNAVAILABLE' using errcode='PT409'; end if;
 meta:=jsonb_build_object('schema','PUSH_SINGLE_TARGET_V1','authorizationId',p_authorization_id,
  'recipientAccountId',p_recipient_user_id,'recipientRole',p_recipient_role,'eventId',p_event_id,
  'eventType',v_event.event_type,'deviceId',p_device_id,'deviceRevision',p_device_revision,
  'boundSessionId',p_bound_session_id,'expiresAt',p_expires_at,'receiptDeadline',p_receipt_deadline);
 if v_event.event_type='OPPORTUNITY_AVAILABLE' then
  if v_event.entity_type<>'NEED' or v_event.recipient_role<>'WORKER' then
   raise exception 'PUSH_TARGET_UNAVAILABLE' using errcode='PT409'; end if;
  -- The natural emitter's unique (account,need,revision) row freezes the exact profile and opportunity.
  select * into v_op from public.opportunity_deliveries
  where worker_account_id=p_recipient_user_id and need_id=v_event.entity_id and need_revision=v_event.entity_version;
  if not found then raise exception 'PUSH_OPPORTUNITY_UNAVAILABLE' using errcode='PT409'; end if;
  meta:=meta||jsonb_build_object('opportunityId',v_op.id,'workerProfileId',v_op.worker_profile_id,
    'needId',v_op.need_id,'needRevision',v_op.need_revision);
 end if;

 if p_expires_at<=clock_timestamp() or d.channel<>'PUSH' or d.push_started_at is not null
  or d.state not in ('CREATED','QUEUED','FAILED_RETRYABLE')
  or d.event_id<>p_event_id or d.recipient_user_id<>p_recipient_user_id or d.recipient_role<>p_recipient_role
  or exists(select 1 from public.notification_push_attempts where delivery_id=d.id)
  or not exists(select 1 from public.user_activity_events e where e.id=p_event_id
   and e.recipient_user_id=p_recipient_user_id and e.recipient_role=p_recipient_role and e.event_type in ('MESSAGE_RECEIVED','OPPORTUNITY_AVAILABLE'))
 then raise exception 'PUSH_TARGET_UNAVAILABLE' using errcode='PT409'; end if;
 if v_event.event_type='OPPORTUNITY_AVAILABLE' and not exists (
    select 1 from public.user_activity_events oe
    join public.opportunity_deliveries op on op.id=(meta->>'opportunityId')::uuid
    join public.app_profiles wp on wp.id=op.worker_profile_id
    join public.needs n on n.id=op.need_id
    where oe.id=d.event_id and oe.event_type='OPPORTUNITY_AVAILABLE'
      and oe.entity_type='NEED' and oe.entity_id=n.id and oe.entity_version=n.revision
      and oe.recipient_user_id=d.recipient_user_id and oe.recipient_role='WORKER'
      and d.recipient_role='WORKER' and d.expires_at>clock_timestamp()
      and op.worker_account_id=d.recipient_user_id
      and op.worker_profile_id=(meta->>'workerProfileId')::uuid
      and op.need_id=(meta->>'needId')::uuid
      and op.need_revision::text=meta->>'needRevision'
      and op.need_revision=n.revision and op.status='READY'
      and op.expires_at>clock_timestamp()
      and wp.account_id=d.recipient_user_id and wp.kind='WORKER' and wp.profile_status='ACTIVE'
      and private.accounts_same_world(n.requester_account_id,wp.account_id)
      and n.status in ('PUBLISHED','SELECTION') and n.published_at is not null
      and n.remaining_search_closed_at is null
      and private.need_search_time_admitted_v1(n.id,clock_timestamp())
      and n.required_slots>(select coalesce(sum(ns.covered_slots),0)
        from public.need_selections ns where ns.need_id=n.id and ns.status='SELECTED')
      and (private.match_detail(n.id,wp.id)->>'dispatchEligible')::boolean is true
  ) then
  raise exception 'PUSH_OPPORTUNITY_UNAVAILABLE' using errcode='PT409'; end if;
 why:=private.push_suppression(d);
 if why is not null then raise exception 'PUSH_TARGET_SUPPRESSED' using errcode='PT409'; end if;
 select * into dev from public.notification_push_devices where id=p_device_id;
 if not found or dev.user_id<>p_recipient_user_id or not dev.active or dev.platform not in ('ANDROID','IOS')
  or dev.revision<>p_device_revision or dev.bound_revision is distinct from dev.revision
  or dev.bound_session_id is distinct from p_bound_session_id or not private.push_session_valid(dev.user_id,dev.bound_session_id)
 then raise exception 'PUSH_DEVICE_CHANGED' using errcode='PT409'; end if;
 insert into public.notification_push_attempts(id,delivery_id,device_id,attempt_no,outcome,transport_state,device_revision,next_attempt_at,single_target_admission,single_target_authorization_id)
 values(p_admission_id,d.id,dev.id,1,'QUEUED','PENDING',dev.revision,v_now,meta,p_authorization_id);
 return jsonb_build_object('kind','ADMITTED','admissionId',p_admission_id);
end $function$
;
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
  -- Cancellation and selection lock Need before delivery. Keep token first,
  -- then take the exact admitted Need before delivery/attempt, never the inverse.
  -- The readiness predicate below runs again after all potentially waiting locks.
  perform 1 from public.needs n join public.notification_push_attempts t
    on t.single_target_admission->>'eventType'='OPPORTUNITY_AVAILABLE'
    and n.id=(t.single_target_admission->>'needId')::uuid
    where t.id=p_attempt_id for update of n;
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
       or not exists(select 1 from public.user_activity_events e where e.id=d.event_id and e.event_type in ('MESSAGE_RECEIVED','OPPORTUNITY_AVAILABLE')
         and e.event_type=a.single_target_admission->>'eventType')
    then why:='SINGLE_TARGET_EXPIRED_OR_CHANGED'; end if;
  end if;
  if why is null and a.single_target_admission->>'eventType'='OPPORTUNITY_AVAILABLE'
     and not exists (
    select 1 from public.user_activity_events oe
    join public.opportunity_deliveries op on op.id=(a.single_target_admission->>'opportunityId')::uuid
    join public.app_profiles wp on wp.id=op.worker_profile_id
    join public.needs n on n.id=op.need_id
    where oe.id=d.event_id and oe.event_type='OPPORTUNITY_AVAILABLE'
      and oe.entity_type='NEED' and oe.entity_id=n.id and oe.entity_version=n.revision
      and oe.recipient_user_id=d.recipient_user_id and oe.recipient_role='WORKER'
      and d.recipient_role='WORKER' and d.expires_at>clock_timestamp()
      and op.worker_account_id=d.recipient_user_id
      and op.worker_profile_id=(a.single_target_admission->>'workerProfileId')::uuid
      and op.need_id=(a.single_target_admission->>'needId')::uuid
      and op.need_revision::text=a.single_target_admission->>'needRevision'
      and op.need_revision=n.revision and op.status='READY'
      and op.expires_at>clock_timestamp()
      and wp.account_id=d.recipient_user_id and wp.kind='WORKER' and wp.profile_status='ACTIVE'
      and private.accounts_same_world(n.requester_account_id,wp.account_id)
      and n.status in ('PUBLISHED','SELECTION') and n.published_at is not null
      and n.remaining_search_closed_at is null
      and private.need_search_time_admitted_v1(n.id,clock_timestamp())
      and n.required_slots>(select coalesce(sum(ns.covered_slots),0)
        from public.need_selections ns where ns.need_id=n.id and ns.status='SELECTED')
      and (private.match_detail(n.id,wp.id)->>'dispatchEligible')::boolean is true
  ) then
    why:='PUSH_OPPORTUNITY_UNAVAILABLE';
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

  -- The matcher may take time. Recheck deadlines in a later PL/pgSQL statement,
  -- not as an SQL AND whose evaluation order could precede the expensive work.
  if a.single_target_admission->>'eventType'='OPPORTUNITY_AVAILABLE' and (
    (a.lease_until>clock_timestamp()) is not true
    or ((a.single_target_admission->>'expiresAt')::timestamptz>clock_timestamp()) is not true
    or (d.expires_at>clock_timestamp()) is not true
    or not exists(select 1 from public.opportunity_deliveries final_op
      where final_op.id=(a.single_target_admission->>'opportunityId')::uuid
        and final_op.expires_at>clock_timestamp())
    or private.need_search_time_admitted_v1((a.single_target_admission->>'needId')::uuid,clock_timestamp()) is not true
  ) then
    update public.notification_push_attempts
    set transport_state='SUPPRESSED',outcome='FATAL',error_code='PUSH_OPPORTUNITY_EXPIRED',lease_id=null,lease_until=null
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
$function$
;
ALTER TABLE public.notification_push_attempts DROP CONSTRAINT push_single_target_shape_v1;
ALTER TABLE public.notification_push_attempts ADD CONSTRAINT push_single_target_shape_v1 CHECK (((single_target_admission IS NULL) OR COALESCE(((jsonb_typeof(single_target_admission) = 'object'::text) AND (single_target_admission ?& ARRAY['schema'::text, 'authorizationId'::text, 'recipientAccountId'::text, 'recipientRole'::text, 'eventId'::text, 'eventType'::text, 'deviceId'::text, 'deviceRevision'::text, 'boundSessionId'::text, 'expiresAt'::text, 'receiptDeadline'::text]) AND ((single_target_admission - (ARRAY['schema'::text, 'authorizationId'::text, 'recipientAccountId'::text, 'recipientRole'::text, 'eventId'::text, 'eventType'::text, 'deviceId'::text, 'deviceRevision'::text, 'boundSessionId'::text, 'expiresAt'::text, 'receiptDeadline'::text] || ARRAY['opportunityId'::text,'workerProfileId'::text,'needId'::text,'needRevision'::text])) = '{}'::jsonb) AND ((single_target_admission ->> 'schema'::text) = 'PUSH_SINGLE_TARGET_V1'::text) AND ((single_target_admission->>'eventType') in ('MESSAGE_RECEIVED','OPPORTUNITY_AVAILABLE') AND
 (case when single_target_admission->>'eventType'='MESSAGE_RECEIVED'
  then not(single_target_admission ?| ARRAY['opportunityId'::text,'workerProfileId'::text,'needId'::text,'needRevision'::text])
  else single_target_admission ?& ARRAY['opportunityId'::text,'workerProfileId'::text,'needId'::text,'needRevision'::text]
    and single_target_admission->>'recipientRole'='WORKER'
    and jsonb_typeof(single_target_admission->'opportunityId')='string'
    and single_target_admission->>'opportunityId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and jsonb_typeof(single_target_admission->'workerProfileId')='string'
    and single_target_admission->>'workerProfileId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and jsonb_typeof(single_target_admission->'needId')='string'
    and single_target_admission->>'needId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and jsonb_typeof(single_target_admission->'needRevision')='number'
    and single_target_admission->>'needRevision' ~ '^[1-9][0-9]*$'
  end)) AND ((single_target_admission ->> 'recipientRole'::text) = ANY (ARRAY['REQUESTER'::text, 'WORKER'::text])) AND ((jsonb_typeof((single_target_admission -> 'authorizationId'::text)) = 'string'::text) AND ((single_target_admission ->> 'authorizationId'::text) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text)) AND ((jsonb_typeof((single_target_admission -> 'recipientAccountId'::text)) = 'string'::text) AND ((single_target_admission ->> 'recipientAccountId'::text) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text)) AND ((jsonb_typeof((single_target_admission -> 'eventId'::text)) = 'string'::text) AND ((single_target_admission ->> 'eventId'::text) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text)) AND ((jsonb_typeof((single_target_admission -> 'deviceId'::text)) = 'string'::text) AND ((single_target_admission ->> 'deviceId'::text) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text)) AND ((jsonb_typeof((single_target_admission -> 'boundSessionId'::text)) = 'string'::text) AND ((single_target_admission ->> 'boundSessionId'::text) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text)) AND ((jsonb_typeof((single_target_admission -> 'deviceRevision'::text)) = 'number'::text) AND ((single_target_admission ->> 'deviceRevision'::text) ~ '^[0-9]+$'::text)) AND ((jsonb_typeof((single_target_admission -> 'expiresAt'::text)) = 'string'::text) AND isfinite(((single_target_admission ->> 'expiresAt'::text))::timestamp with time zone)) AND ((jsonb_typeof((single_target_admission -> 'receiptDeadline'::text)) = 'string'::text) AND isfinite(((single_target_admission ->> 'receiptDeadline'::text))::timestamp with time zone))), false)));
rollback;
