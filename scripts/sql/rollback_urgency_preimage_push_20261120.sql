-- USKOCI DEV rollback preimage captured 2026-11-20.
-- Restore only as a controlled rollback after reviewing the paired retirement migration.
-- CREATE OR REPLACE preserves current ownership and ACLs; metadata is recorded above each definition.
BEGIN;
-- private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamp with time zone) | md5=586c40786332a9863922585503f083f6 | owner=postgres | acl={postgres=X/postgres} | security_definer=t | config={"search_path=public, pg_temp"}\nCREATE OR REPLACE FUNCTION private.emit_event(p_recipient uuid, p_role text, p_event_type text, p_entity_type text, p_entity_id uuid, p_entity_version integer, p_title text, p_body text, p_dedupe_key text, p_urgency text DEFAULT 'NORMAL'::text, p_payload jsonb DEFAULT '{}'::jsonb, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_event_id uuid;
  v_prefs public.notification_preferences%rowtype;
  v_cat text := private.category_of_event(p_event_type);
  v_cat_on boolean;
  v_quiet boolean;
  v_prio text := case when p_urgency = 'HITNO' then 'HIGH' else 'NORMAL' end;
  v_suppress text;
begin
  p_title := private.notification_copy_v5(p_title);
  p_body := private.notification_copy_v5(p_body);
  -- 1) durable event, idempotentno
  insert into public.user_activity_events
    (recipient_user_id, recipient_role, event_type, entity_type, entity_id,
     entity_version, urgency, payload, dedupe_key)
  values (p_recipient, p_role, p_event_type, p_entity_type, p_entity_id,
     p_entity_version, p_urgency, p_payload, p_dedupe_key)
  on conflict (dedupe_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return null;  -- vec emitovano; nista se ne duplira
  end if;

  -- 2) preference; ako red ne postoji, vaze podrazumevane vrednosti (push ukljucen za nove korisnike)
  select * into v_prefs from public.notification_preferences
   where user_id = p_recipient and role_context = p_role;
  if not found then
    v_prefs.in_app_enabled := true;
    v_prefs.push_enabled := coalesce((select np.push_enabled from public.notification_preferences np
                                       where np.user_id = p_recipient order by np.role_context limit 1), true);
    v_prefs.quiet_hours_enabled := false;
    v_prefs.urgent_overrides_quiet_hours := false;
    v_prefs.opportunities_enabled := true; v_prefs.responses_enabled := true;
    v_prefs.dogovor_enabled := true; v_prefs.execution_enabled := true;
    v_prefs.recovery_enabled := true; v_prefs.account_enabled := true;
  end if;

  v_cat_on := case v_cat
    when 'opportunities' then v_prefs.opportunities_enabled
    when 'responses'     then v_prefs.responses_enabled
    when 'dogovor'       then v_prefs.dogovor_enabled
    when 'execution'     then v_prefs.execution_enabled
    when 'recovery'      then v_prefs.recovery_enabled
    else v_prefs.account_enabled end;

  -- 3) IN_APP
  insert into public.notification_deliveries
    (event_id, recipient_user_id, recipient_role, channel, priority, state,
     suppression_reason, title, body, dedupe_key, expires_at)
  values (v_event_id, p_recipient, p_role, 'IN_APP', v_prio,
     case when v_prefs.in_app_enabled and v_cat_on then 'CREATED' else 'SUPPRESSED' end,
     case when v_prefs.in_app_enabled and v_cat_on then null
          when not v_cat_on then 'CATEGORY_OFF' else 'IN_APP_OFF' end,
     p_title, p_body, p_dedupe_key || ':in_app', p_expires_at)
  on conflict (dedupe_key) do nothing;

  -- 4) PUSH — tihi sati se postuju osim uz izricit opt-in za HITNO
  v_quiet := private.in_quiet_hours(v_prefs);
  v_suppress := case
    when not v_prefs.push_enabled then 'PUSH_OFF'
    when not v_cat_on then 'CATEGORY_OFF'
    when v_quiet and not (p_urgency = 'HITNO' and v_prefs.urgent_overrides_quiet_hours)
      then 'QUIET_HOURS'
    else null end;

  insert into public.notification_deliveries
    (event_id, recipient_user_id, recipient_role, channel, priority, state,
     suppression_reason, title, body, dedupe_key, expires_at)
  values (v_event_id, p_recipient, p_role, 'PUSH', v_prio,
     case when v_suppress is null then 'CREATED' else 'SUPPRESSED' end,
     v_suppress, p_title, p_body, p_dedupe_key || ':push', p_expires_at)
  on conflict (dedupe_key) do nothing;

  return v_event_id;
end;
$function$


-- private.push_suppression(notification_deliveries) | md5=ebd9c03035630bde62bf9fd8a27378c2 | owner=postgres | acl={postgres=X/postgres} | security_definer=t | config={search_path=pg_catalog}\nCREATE OR REPLACE FUNCTION private.push_suppression(p_delivery notification_deliveries)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  p public.notification_preferences%rowtype;
  e public.user_activity_events%rowtype;
  enabled boolean;
  local_time time;
begin
  if p_delivery.channel<>'PUSH' or p_delivery.state in ('SUPPRESSED','EXPIRED','READ','DELIVERED','FAILED_FINAL') then
    return 'DELIVERY_CLOSED';
  end if;
  if p_delivery.expires_at<=clock_timestamp() then
    return 'EXPIRED';
  end if;
  select * into e from public.user_activity_events where id=p_delivery.event_id;
  if not found or e.recipient_user_id<>p_delivery.recipient_user_id or e.recipient_role<>p_delivery.recipient_role then
    return 'EVENT_UNAVAILABLE';
  end if;

  -- F20: the event's immutable Need revision is the notification identity.
  -- Recheck before both first claim and SEND_STARTED, including the default-ON
  -- path with no preferences row. A later Need edit must not reinterpret an
  -- older event, and an opportunity status alone cannot prove a manual offer.
  if e.event_type='OPPORTUNITY_AVAILABLE' and e.entity_type='NEED'
     and e.recipient_role='WORKER' and exists (
       select 1 from public.marketplace_responses r
       where r.need_id=e.entity_id
         and r.worker_account_id=e.recipient_user_id
         and r.submitted_against_need_revision=e.entity_version
         and r.response_kind='OFFER'
         and r.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED')) then
    return 'ALREADY_RESPONDED';
  end if;

  select * into p from public.notification_preferences where user_id=p_delivery.recipient_user_id and role_context=p_delivery.recipient_role;
  if not found then
    -- When preferences row does not exist yet, default all categories and push to ON
    return null;
  end if;

  if not coalesce(p.push_enabled, true) then
    return 'PUSH_OFF';
  end if;

  enabled:=case private.category_of_event(e.event_type)
    when 'opportunities' then coalesce(p.opportunities_enabled, true)
    when 'responses' then coalesce(p.responses_enabled, true)
    when 'dogovor' then coalesce(p.dogovor_enabled, true)
    when 'execution' then coalesce(p.execution_enabled, true)
    when 'recovery' then coalesce(p.recovery_enabled, true)
    else coalesce(p.account_enabled, true)
  end;
  if not enabled then
    return 'CATEGORY_OFF';
  end if;

  local_time:=(clock_timestamp() at time zone coalesce(p.quiet_timezone, 'UTC'))::time;
  if coalesce(p.quiet_hours_enabled, false)
     and (case when p.quiet_start<p.quiet_end then local_time between p.quiet_start and p.quiet_end else local_time>=p.quiet_start or local_time<=p.quiet_end end)
     and not(e.urgency='HITNO' and coalesce(p.urgent_overrides_quiet_hours, true)) then
    return 'QUIET_HOURS';
  end if;

  return null;
end $function$


-- rpc_begin_push_send(uuid,uuid) | md5=e693b140450a9bb1cf6d3178b0ad80c1 | owner=postgres | acl={postgres=X/postgres,service_role=X/postgres} | security_definer=t | config={search_path=pg_catalog}\nCREATE OR REPLACE FUNCTION public.rpc_begin_push_send(p_attempt_id uuid, p_lease_id uuid)
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
    'eventType',v_event_type,
    -- Generic notification content may wait for an offline device, but never
    -- past its delivery expiry. Single-target probes keep TTL=0 in the worker.
    'deliveryExpiresAt',least(coalesce(d.expires_at,clock_timestamp()+interval '1 hour'),clock_timestamp()+interval '1 hour')
  ) || case when v_event_type in ('MESSAGE_RECEIVED','OPPORTUNITY_AVAILABLE','RESPONSE_RECEIVED','RESPONSE_UPDATED')
    then jsonb_build_object('eventId',v_event_id) else '{}'::jsonb end;
end
$function$


-- rpc_claim_push_transport(text) | md5=7c9145f1b9696f9ed6e4a29949228b58 | owner=postgres | acl={postgres=X/postgres,service_role=X/postgres} | security_definer=t | config={search_path=pg_catalog}\nCREATE OR REPLACE FUNCTION public.rpc_claim_push_transport(p_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare d public.notification_deliveries%rowtype; a public.notification_push_attempts%rowtype; v_now timestamptz:=clock_timestamp(); why text; dev record; num integer; paused_recipients uuid[]:=array[]::uuid[];
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('SEND','RECEIPT') then raise exception 'INVALID_PUSH_ACTION' using errcode='22023'; end if;
 -- Cross-isolate dispatch throttle and SKIP LOCKED delivery ownership. No
 -- in-memory limit is mistaken for a project-wide limiter.
 if not pg_try_advisory_xact_lock(hashtextextended('uskoci:push-claim',0)) then return jsonb_build_object('kind','WAIT','retryAfterMs',100); end if;
 if (select count(*) from public.notification_push_attempts where lease_until>v_now)>=6 then return jsonb_build_object('kind','WAIT','retryAfterMs',250); end if;
 if (select count(*) from public.notification_push_attempts where last_claimed_at>v_now-interval '1 second')>=60 then return jsonb_build_object('kind','WAIT','retryAfterMs',1000); end if;
 -- Only the already rate-bounded last second is examined. Limit any one
 -- recipient to four claims/second across devices; receipts count too and
 -- can only defer, never discard, a later send. The global advisory lock
 -- serializes the check plus lease, including other Edge isolates.
 if p_kind='SEND' then
  select coalesce(array_agg(q.recipient_user_id),array[]::uuid[]) into paused_recipients
  from (select d1.recipient_user_id
    from public.notification_push_attempts a1
    join public.notification_deliveries d1 on d1.id=a1.delivery_id
    where a1.last_claimed_at>v_now-interval '1 second'
    group by d1.recipient_user_id having count(*)>=4) q;
 end if;
 for d in select * from public.notification_deliveries x where x.channel='PUSH'
  and (p_kind<>'SEND' or not(x.recipient_user_id=any(paused_recipients))) and not exists(select 1 from public.notification_push_attempts admitted where admitted.delivery_id=x.id and admitted.single_target_admission is not null) and
  ((p_kind='SEND' and x.push_started_at is null and x.state in ('CREATED','QUEUED','FAILED_RETRYABLE') and not exists(select 1 from public.notification_push_attempts z where z.delivery_id=x.id))
   or exists(select 1 from public.notification_push_attempts z where z.delivery_id=x.id and
    ((p_kind='SEND' and z.transport_state in ('PENDING','RETRYABLE','SEND_LEASED','SEND_STARTED')) or (p_kind='RECEIPT' and z.transport_state in ('TICKET_PENDING','RECEIPT_LEASED')))
    and (z.next_attempt_at<=v_now or z.lease_until<=v_now)))
  -- HIGH receives a one-minute ordering advantage. Older normal work then
  -- overtakes newer HIGH arrivals, so a sustained burst cannot starve it.
  order by x.created_at-case when x.priority='HIGH' then interval '1 minute' else interval '0 seconds' end,x.created_at,x.id limit 64 for update skip locked loop
  if d.push_started_at is null and p_kind='SEND' then
   why:=private.push_suppression(d);
   if why is not null then update public.notification_deliveries set state='SUPPRESSED',suppression_reason=why,push_started_at=v_now where id=d.id; continue; end if;
   -- Historical attempts are not reinterpreted or resent by the new transport.
   if exists(select 1 from public.notification_push_attempts where delivery_id=d.id) then continue; end if;
   num:=0;
   for dev in select * from public.notification_push_devices x where x.user_id=d.recipient_user_id and x.active and x.bound_revision=x.revision and private.push_session_valid(x.user_id,x.bound_session_id) and x.platform in ('IOS','ANDROID') order by x.id loop
    num:=num+1;
    insert into public.notification_push_attempts(delivery_id,device_id,attempt_no,outcome,transport_state,device_revision,next_attempt_at)
    values(d.id,dev.id,num,'QUEUED','PENDING',dev.revision,v_now);
   end loop;
   update public.notification_deliveries set push_started_at=v_now,queued_at=v_now,state=case when num=0 then 'SUPPRESSED' else 'QUEUED' end,suppression_reason=case when num=0 then 'NO_ACTIVE_DEVICE' else null end where id=d.id;
  end if;
  -- Losing a worker after begin may have produced a real push. Never resend it.
  update public.notification_push_attempts set transport_state='UNKNOWN',outcome='FATAL',error_code='SEND_OUTCOME_UNKNOWN',lease_id=null,lease_until=null where delivery_id=d.id and transport_state='SEND_STARTED' and lease_until<=v_now;
  update public.notification_push_attempts set transport_state='PENDING',lease_id=null,lease_until=null where delivery_id=d.id and transport_state='SEND_LEASED' and lease_until<=v_now;
  update public.notification_push_attempts set transport_state='TICKET_PENDING',lease_id=null,lease_until=null where delivery_id=d.id and transport_state='RECEIPT_LEASED' and lease_until<=v_now;
  update public.notification_push_attempts set transport_state='UNKNOWN',outcome='FATAL',error_code='RECEIPT_UNAVAILABLE',lease_id=null,lease_until=null where delivery_id=d.id and transport_state='TICKET_PENDING' and ticket_received_at<=v_now-interval '24 hours';
  select * into a from public.notification_push_attempts where delivery_id=d.id and next_attempt_at<=v_now and
   ((p_kind='SEND' and transport_state in ('PENDING','RETRYABLE') and send_count<3) or (p_kind='RECEIPT' and transport_state='TICKET_PENDING')) order by attempt_no limit 1 for update;
  if not found then continue; end if;
  if p_kind='SEND' then
   why:=private.push_suppression(d);
   if why is not null then update public.notification_push_attempts set transport_state='SUPPRESSED',outcome='FATAL',error_code=why where id=a.id; continue; end if;
   select * into dev from public.notification_push_devices x where x.id=a.device_id and x.user_id=d.recipient_user_id and x.active and x.revision=a.device_revision and x.bound_revision=x.revision and private.push_session_valid(x.user_id,x.bound_session_id);
   if not found then update public.notification_push_attempts set transport_state='SUPPRESSED',outcome='FATAL',error_code='DEVICE_CHANGED' where id=a.id; continue; end if;
  end if;
  update public.notification_push_attempts set transport_state=case when p_kind='SEND' then 'SEND_LEASED' else 'RECEIPT_LEASED' end,lease_id=extensions.gen_random_uuid(),lease_until=v_now+interval '90 seconds',next_attempt_at=v_now,last_claimed_at=v_now where id=a.id returning * into a;
  return jsonb_build_object('kind',p_kind,'attemptId',a.id,'leaseId',a.lease_id,'leaseExpiresAt',a.lease_until,'ticketId',a.provider_ticket_id);
 end loop;
 if p_kind='SEND' and cardinality(paused_recipients)>0 then
  return jsonb_build_object('kind','WAIT','retryAfterMs',1000);
 end if;
 return jsonb_build_object('kind','NONE');
end $function$

COMMIT;
