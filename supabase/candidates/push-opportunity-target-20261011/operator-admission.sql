-- Prepared-only operator gate for exactly one event/device, NEVER a dispatch path.
-- Separate from the deployed MESSAGE_RECEIVED-only function.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $guard$
begin
 if to_regprocedure('private.admit_push_opportunity_single_target_v1(uuid,uuid,uuid,uuid,uuid,uuid,bigint,uuid,timestamp with time zone,timestamp with time zone)') is not null
 then raise exception 'OPPORTUNITY_SINGLE_TARGET_DRIFT' using errcode='PT409'; end if;
end
$guard$;
create function private.admit_push_opportunity_single_target_v1(
 p_admission_id uuid,p_authorization_id uuid,p_recipient_user_id uuid,p_event_id uuid,
 p_delivery_id uuid,p_device_id uuid,p_device_revision bigint,p_bound_session_id uuid,
 p_expires_at timestamptz,p_receipt_deadline timestamptz)
returns jsonb
language plpgsql
set search_path to 'pg_catalog'
as $function$
declare
 d public.notification_deliveries%rowtype;
 dev public.notification_push_devices%rowtype;
 a public.notification_push_attempts%rowtype;
 meta jsonb;
 v_now timestamptz:=clock_timestamp();
begin
 if current_user<>'postgres' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_admission_id is null or p_authorization_id is null or p_recipient_user_id is null or p_event_id is null
  or p_delivery_id is null or p_device_id is null or p_device_revision is null or p_device_revision<0
  or p_bound_session_id is null or p_expires_at is null or p_receipt_deadline is null
  or not isfinite(p_expires_at) or not isfinite(p_receipt_deadline)
  or p_expires_at<=v_now or p_expires_at>v_now+interval '24 hours'
  or p_receipt_deadline<=p_expires_at or p_receipt_deadline>p_expires_at+interval '24 hours'
 then raise exception 'INVALID_PUSH_ADMISSION' using errcode='22023'; end if;
 meta:=jsonb_build_object(
  'schema','PUSH_SINGLE_TARGET_V1','authorizationId',p_authorization_id,
  'recipientAccountId',p_recipient_user_id,'recipientRole','WORKER',
  'eventId',p_event_id,'eventType','OPPORTUNITY_AVAILABLE',
  'deviceId',p_device_id,'deviceRevision',p_device_revision,'boundSessionId',p_bound_session_id,
  'expiresAt',p_expires_at,'receiptDeadline',p_receipt_deadline);
 if not pg_try_advisory_xact_lock(hashtextextended('uskoci:push-claim',0))
 then return jsonb_build_object('kind','BUSY'); end if;
 select * into d from public.notification_deliveries where id=p_delivery_id for update;
 if not found then raise exception 'PUSH_TARGET_UNAVAILABLE' using errcode='PT409'; end if;
 select * into a from public.notification_push_attempts where id=p_admission_id for update;
 if found then
  if a.delivery_id<>p_delivery_id or a.device_id is distinct from p_device_id
   or a.single_target_admission is distinct from meta
  then raise exception 'PUSH_ADMISSION_CONFLICT' using errcode='PT409'; end if;
  return jsonb_build_object('kind','EXISTING','admissionId',a.id,'state',a.transport_state);
 end if;
 if d.channel<>'PUSH' or d.push_started_at is not null or d.state not in ('CREATED','QUEUED','FAILED_RETRYABLE')
  or d.event_id<>p_event_id or d.recipient_user_id<>p_recipient_user_id or d.recipient_role<>'WORKER'
  or exists(select 1 from public.notification_push_attempts where delivery_id=d.id)
  or not exists(
    select 1 from public.user_activity_events e
    join public.needs n on n.id=e.entity_id
    join public.app_profiles p on p.account_id=p_recipient_user_id and p.kind='WORKER' and p.profile_status='ACTIVE'
    join public.opportunity_deliveries od on od.worker_profile_id=p.id and od.worker_account_id=p_recipient_user_id
      and od.need_id=n.id and od.need_revision=n.revision
    where e.id=p_event_id and e.recipient_user_id=p_recipient_user_id and e.recipient_role='WORKER'
      and e.event_type='OPPORTUNITY_AVAILABLE' and e.entity_type='NEED' and e.entity_version=n.revision
      and e.dedupe_key='opp:'||n.id::text||':'||n.revision::text||':'||p_recipient_user_id::text
      and n.status in('PUBLISHED','SELECTION') and n.requester_account_id is not null
      and n.requester_account_id<>p_recipient_user_id
      and od.status in ('READY','SEEN','RESPONDED')
      and od.expires_at>=p_expires_at
      and private.accounts_same_world(n.requester_account_id,p_recipient_user_id)
      and not private.safety_event_blocked(e)
      and exists(select 1 from public.notification_deliveries inapp
        where inapp.event_id=e.id and inapp.recipient_user_id=p_recipient_user_id
          and inapp.recipient_role='WORKER' and inapp.channel='IN_APP'
          and inapp.dedupe_key=e.dedupe_key||':in_app'
          and inapp.state in ('CREATED','SENT','DELIVERED','READ') and inapp.suppression_reason is null)
   )
 then raise exception 'PUSH_TARGET_UNAVAILABLE' using errcode='PT409'; end if;
 if private.push_suppression(d) is not null
 then raise exception 'PUSH_TARGET_SUPPRESSED' using errcode='PT409'; end if;
 select * into dev from public.notification_push_devices where id=p_device_id;
 if not found or dev.user_id<>p_recipient_user_id or not dev.active or dev.platform not in('ANDROID','IOS')
  or dev.revision<>p_device_revision or dev.bound_revision is distinct from dev.revision
  or dev.bound_session_id is distinct from p_bound_session_id
  or not private.push_session_valid(dev.user_id,dev.bound_session_id)
 then raise exception 'PUSH_DEVICE_CHANGED' using errcode='PT409'; end if;
 insert into public.notification_push_attempts(
 id,delivery_id,device_id,attempt_no,outcome,transport_state,device_revision,next_attempt_at,
 single_target_admission,single_target_authorization_id)
 values(p_admission_id,d.id,dev.id,1,'QUEUED','PENDING',dev.revision,v_now,meta,p_authorization_id);
 return jsonb_build_object('kind','ADMITTED','admissionId',p_admission_id);
end;
$function$;
revoke all on function private.admit_push_opportunity_single_target_v1(uuid,uuid,uuid,uuid,uuid,uuid,bigint,uuid,timestamptz,timestamptz) from public,anon,authenticated,service_role;
commit;
