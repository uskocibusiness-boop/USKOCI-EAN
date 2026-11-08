-- R09 bounded push capacity, fairness, expiry and service-only queue telemetry.
-- Canonical DEV preimage: 2026-11-08, source 9cf4f5ee913a3751f83615e134a1e6d7c68300f3.
-- Apply AFTER the compatible bounded worker is deployed (it accepts old/new
-- begin receipts). Roll back this SQL BEFORE restoring the old worker.
-- No transport-state reset, resend, data deletion, preference or RLS changes.
DO $r09_push_capacity$
declare
 expected jsonb := $r09_expected$[{"signature":"private.category_of_event(text)","body_md5":"85389285506a1f5801ad204f60dfa2a1","definer":false,"volatility":"i","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"private.push_session_valid(uuid,uuid)","body_md5":"3454eb7040f3dab3cb0c35b512b46859","definer":true,"volatility":"v","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"private.push_suppression(notification_deliveries)","body_md5":"25d3fae40c1f67689e1c50ee1898005b","definer":true,"volatility":"v","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"rpc_claim_push_transport(text)","body_md5":"f70229927ca68419e5ca735a5b64b2e9","definer":true,"volatility":"v","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"rpc_complete_push_transport(uuid,uuid,text,text)","body_md5":"d87908db1908b8c88fe66228c5b07f9f","definer":true,"volatility":"v","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"rpc_begin_push_send(uuid,uuid)","body_md5":"fc2dcc23f986d667ef61159ebc435228","definer":true,"volatility":"v","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"]}]$r09_expected$::jsonb;
 f jsonb; actual jsonb;
begin
 for f in select value from jsonb_array_elements(expected) loop
  select jsonb_build_object('body_md5',md5(p.prosrc),'definer',p.prosecdef,'volatility',p.provolatile,
   'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'config',p.proconfig) into actual
  from pg_proc p where p.oid=to_regprocedure(f->>'signature');
  if actual is distinct from (f-'signature') then
   raise exception 'R09_PUSH_SOURCE_OR_ACL_DRIFT: %',f->>'signature' using errcode='55000';
  end if;
 end loop;
 if to_regprocedure('public.rpc_get_push_transport_metrics()') is not null then
  raise exception 'R09_PUSH_METRICS_ALREADY_EXISTS' using errcode='55000';
 end if;
 execute $r09_claim$CREATE OR REPLACE FUNCTION public.rpc_claim_push_transport(p_kind text)
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
$r09_claim$;
 execute $r09_begin$CREATE OR REPLACE FUNCTION public.rpc_begin_push_send(p_attempt_id uuid, p_lease_id uuid)
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
$r09_begin$;
 execute $r09_metrics$CREATE OR REPLACE FUNCTION public.rpc_get_push_transport_metrics()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
 v_now timestamptz:=clock_timestamp();
 pending_count bigint; send_count bigint; receipt_count bigint; lease_count bigint;
 oldest_pending timestamptz; oldest_send timestamptz; oldest_receipt timestamptz;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 -- Counts are labelled by ledger unit: an unprepared delivery is not yet one
 -- device attempt. No token, account, event identity or message body is exposed.
 select count(*),min(d.created_at) into pending_count,oldest_pending
 from public.notification_deliveries d
 where d.channel='PUSH' and d.push_started_at is null
  and d.state in ('CREATED','QUEUED','FAILED_RETRYABLE')
  and not exists(select 1 from public.notification_push_attempts a where a.delivery_id=d.id);
 select count(*),min(a.next_attempt_at) into send_count,oldest_send
 from public.notification_push_attempts a
 where a.single_target_admission is null and a.transport_state in ('PENDING','RETRYABLE')
  and a.send_count<3 and a.next_attempt_at<=v_now;
 select count(*),min(a.next_attempt_at) into receipt_count,oldest_receipt
 from public.notification_push_attempts a
 where a.single_target_admission is null and a.transport_state='TICKET_PENDING' and a.next_attempt_at<=v_now;
 select count(*) into lease_count from public.notification_push_attempts where lease_until>v_now;
 return jsonb_build_object('observedAt',v_now,
  'pendingDeliveries',pending_count,'sendAttemptsDue',send_count,'receiptAttemptsDue',receipt_count,'activeLeases',lease_count,
  'oldestPendingDeliverySeconds',case when oldest_pending is null then null else greatest(0,extract(epoch from v_now-oldest_pending)) end,
  'oldestSendAttemptSeconds',case when oldest_send is null then null else greatest(0,extract(epoch from v_now-oldest_send)) end,
  'oldestReceiptAttemptSeconds',case when oldest_receipt is null then null else greatest(0,extract(epoch from v_now-oldest_receipt)) end);
end
$function$;
$r09_metrics$;
 revoke all on function public.rpc_get_push_transport_metrics() from public,anon,authenticated;
 grant execute on function public.rpc_get_push_transport_metrics() to service_role;
end
$r09_push_capacity$;
