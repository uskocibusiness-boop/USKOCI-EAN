CREATE OR REPLACE FUNCTION public.rpc_send_group_message_v5(p_expected_user_id uuid, p_group_id uuid, p_client_request_id uuid, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare u uuid:=auth.uid();g private.group_conversations_v5;m private.group_messages_v5;body text:=btrim(p_body);r uuid;seq bigint;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 if p_group_id is null or p_client_request_id is null or body is null or char_length(body) not between 1 and 2000 then raise exception 'GROUP_MESSAGE_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:group-message:'||u::text||':'||p_client_request_id::text,137));
 select * into g from private.group_conversations_v5 where id=p_group_id for update;
 if not found or not private.group_member_v5(g,u) then raise exception 'GROUP_NOT_AVAILABLE' using errcode='42501';end if;
 select * into m from private.group_messages_v5 where sender_account_id=u and client_request_id=p_client_request_id;
 if found then
  if m.group_id<>g.id or m.body<>body then raise exception 'GROUP_MESSAGE_KEY_REUSED' using errcode='22023';end if;
  return private.group_message_receipt_v5(m,true);
 end if;
 perform private.closure_assert_open(u,g.requester_account_id);
 if u<>g.requester_account_id then perform pg_advisory_xact_lock_shared(private.safety_pair_key(u,g.requester_account_id));end if;
 if not private.group_can_send_v5(g,u) then raise exception 'GROUP_READ_ONLY' using errcode='42501';end if;
 -- Safety and closure exclusive barriers never take group/domain row locks.
 -- All eligibility is read again under these shared barriers before admission.
 for r in select distinct account_id from private.group_memberships_v5 where group_id=g.id and ended_sequence is null
  union select g.requester_account_id order by 1 loop
  perform pg_advisory_xact_lock_shared(private.closure_account_key(r));
  if r<>u then perform pg_advisory_xact_lock_shared(private.safety_pair_key(u,r));end if;
 end loop;
 if not private.group_can_send_v5(g,u) then raise exception 'GROUP_READ_ONLY' using errcode='42501';end if;
 update private.group_conversations_v5 set sequence=sequence+1 where id=g.id returning sequence into seq;
 insert into private.group_messages_v5(group_id,sequence,sender_account_id,client_request_id,body,body_sha256)
 values(g.id,seq,u,p_client_request_id,body,encode(extensions.digest(convert_to(body,'UTF8'),'sha256'),'hex')) returning * into m;
 insert into private.group_message_visibility_v5(message_id,account_id,read_at)
 select m.id,x.account_id,case when x.account_id=u then m.created_at end from (
  select g.requester_account_id account_id union select t.account_id from private.group_memberships_v5 t
  where t.group_id=g.id and t.ended_sequence is null and t.joined_sequence<=seq) x
 where not private.closure_account_restricted(x.account_id) and (x.account_id=u or not private.safety_pair_blocked(u,x.account_id));
 return private.group_message_receipt_v5(m,false);
end $function$

CREATE OR REPLACE FUNCTION public.rpc_resolve_activity_message_v1(p_expected_user_id uuid, p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  u uuid:=private.support_auth_v5(p_expected_user_id);
  ag public.agreements; target_message uuid; target_role text;
  unavailable jsonb:=jsonb_build_object('schema','ACTIVITY_MESSAGE_TARGET_V1',
    'accountId',u,'kind','UNAVAILABLE','authoritative',true);
begin
  -- The first lookup reveals nothing. It identifies the two closure locks before
  -- the final authoritative join; foreign/unknown IDs have the same envelope.
  select g.* into ag from public.user_activity_events e
    join public.agreements g on g.id=e.entity_id
    where e.id=p_event_id and e.recipient_user_id=u
      and e.event_type='MESSAGE_RECEIVED' and e.entity_type='AGREEMENT'
      and (u=g.requester_account_id or u=g.worker_account_id);
  if not found then
    perform private.support_auth_v5(u);return unavailable;
  end if;
  if (u is distinct from ag.requester_account_id and u is distinct from ag.worker_account_id)
    or ag.requester_account_id is null or ag.worker_account_id is null
    or ag.requester_account_id=ag.worker_account_id then
    perform private.support_auth_v5(u);return unavailable;
  end if;
  begin
    -- Same ordered shared account locks as canonical writers; a closing caller
    -- OR counterpart makes an event unavailable. No closure state is returned.
    perform private.closure_assert_open(ag.requester_account_id,ag.worker_account_id);
  exception when sqlstate '42501' then
    perform private.support_auth_v5(u);return unavailable;
  end;
  target_role:=case when u=ag.requester_account_id then 'REQUESTER' else 'WORKER' end;
  select m.id into target_message from public.user_activity_events e
    join public.agreements g on g.id=e.entity_id
    join public.agreement_messages m on m.id=case
      when jsonb_typeof(e.payload->'message_id')='string'
        and (e.payload->>'message_id')~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (e.payload->>'message_id')::uuid else null end
    where e.id=p_event_id and e.recipient_user_id=u and e.recipient_role=target_role
      and e.event_type='MESSAGE_RECEIVED' and e.entity_type='AGREEMENT'
      and g.id=ag.id and g.requester_account_id=ag.requester_account_id
      and g.worker_account_id=ag.worker_account_id
      and m.agreement_id=g.id and m.agreement_version=e.entity_version
      and m.sender_account_id=case when target_role='REQUESTER' then g.worker_account_id else g.requester_account_id end
      and e.dedupe_key='agreement_message:'||m.id::text
      and exists(select 1 from public.notification_deliveries d
        where d.event_id=e.id and d.recipient_user_id=u and d.recipient_role=target_role
          and d.channel='IN_APP' and d.dedupe_key=e.dedupe_key||':in_app'
          -- Delivery expiry stops new delivery, not access to an exact historical
          -- target still shown by Inbox. Canonical ACK changes e.read_at only;
          -- cancellation expires CREATED deliveries whether read or unread.
          -- Queue/retry/failure/suppression never admit a historical target.
          and d.state in('CREATED','SENT','DELIVERED','READ','EXPIRED')
          and d.suppression_reason is null);
  perform private.support_auth_v5(u);
  if target_message is null then return unavailable;end if;
  -- No current-status/version equality: terminal/historical Agreement messages
  -- remain exact targets while their current authorization and delivery permit.
  return jsonb_build_object('schema','ACTIVITY_MESSAGE_TARGET_V1','accountId',u,
    'kind','AGREEMENT_MESSAGE','eventId',p_event_id,'agreementId',ag.id,
    'messageId',target_message,'role',target_role,'authoritative',true);
end
$function$

CREATE OR REPLACE FUNCTION private.push_suppression(p_delivery notification_deliveries)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare p public.notification_preferences%rowtype; e public.user_activity_events%rowtype; enabled boolean; local_time time;
begin
 if p_delivery.channel<>'PUSH' or p_delivery.state in ('SUPPRESSED','EXPIRED','READ','DELIVERED','FAILED_FINAL') then return 'DELIVERY_CLOSED'; end if;
 if p_delivery.expires_at<=clock_timestamp() then return 'EXPIRED'; end if;
 select * into e from public.user_activity_events where id=p_delivery.event_id;
 if not found or e.recipient_user_id<>p_delivery.recipient_user_id or e.recipient_role<>p_delivery.recipient_role then return 'EVENT_UNAVAILABLE'; end if;
 if private.closure_event_restricted(e) then return 'ACCOUNT_CLOSING'; end if;
 if private.safety_event_blocked(e) then return 'ACCOUNT_BLOCKED'; end if;
 select * into p from public.notification_preferences where user_id=p_delivery.recipient_user_id and role_context=p_delivery.recipient_role;
 if not found or not p.push_enabled then return 'PUSH_OFF'; end if;
 enabled:=case private.category_of_event(e.event_type) when 'opportunities' then p.opportunities_enabled when 'responses' then p.responses_enabled when 'dogovor' then p.dogovor_enabled when 'execution' then p.execution_enabled when 'recovery' then p.recovery_enabled else p.account_enabled end;
 if not enabled then return 'CATEGORY_OFF'; end if;
 -- Preserve the emitter's inclusive and overnight quiet-hours semantics, but
 -- re-evaluate the wall clock after the begin RPC's potentially blocking locks.
 local_time:=(clock_timestamp() at time zone p.quiet_timezone)::time;
 if p.quiet_hours_enabled and (case when p.quiet_start<p.quiet_end then local_time between p.quiet_start and p.quiet_end else local_time>=p.quiet_start or local_time<=p.quiet_end end)
 and not(e.urgency='HITNO' and p.urgent_overrides_quiet_hours) then return 'QUIET_HOURS'; end if;
 return null;
end $function$

CREATE OR REPLACE FUNCTION public.rpc_mark_group_messages_read_v5(p_expected_user_id uuid, p_group_id uuid, p_message_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare u uuid:=auth.uid();g private.group_conversations_v5;changed integer;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 if p_message_ids is null or cardinality(p_message_ids) not between 1 and 50 or array_position(p_message_ids,null) is not null then raise exception 'GROUP_MESSAGE_INVALID' using errcode='22023';end if;
 perform private.closure_assert_open(u);
 select * into g from private.group_conversations_v5 where id=p_group_id;
 if not found or not private.group_member_v5(g,u) then raise exception 'GROUP_NOT_AVAILABLE' using errcode='42501';end if;
 update private.group_message_visibility_v5 v set read_at=clock_timestamp() from private.group_messages_v5 m
 where v.message_id=m.id and m.group_id=g.id and v.account_id=u and v.message_id=any(p_message_ids) and v.read_at is null;
 get diagnostics changed=row_count;
 return jsonb_build_object('accountId',u,'groupId',g.id,'markedCount',changed,'authoritative',true);
end $function$

CREATE OR REPLACE FUNCTION public.rpc_mark_agreement_messages_read(p_agreement_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare v_uid uuid := auth.uid(); v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_agreement_id is null then raise exception 'INVALID_AGREEMENT' using errcode = '22023'; end if;
  -- Only a party of this Dogovor may settle its notifications; anyone else is told what the workspace tells them.
  if not exists (select 1 from public.agreements a where a.id = p_agreement_id
                   and v_uid in (a.requester_account_id, a.worker_account_id)) then
    raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- The same visibility rule as rpc_mark_activity_event_read: only an event with an in-app delivery counts.
  update public.user_activity_events e set read_at = statement_timestamp()
    where e.recipient_user_id = v_uid and e.entity_type = 'AGREEMENT' and e.entity_id = p_agreement_id
      and e.event_type = 'MESSAGE_RECEIVED' and e.read_at is null
      and exists (select 1 from public.notification_deliveries visible
        where visible.event_id = e.id and visible.recipient_user_id = v_uid
          and visible.channel = 'IN_APP' and visible.state <> 'SUPPRESSED');
  get diagnostics v_count = row_count;
  return v_count;
end
$function$

drop function private.group_activity_target_v1(public.user_activity_events,boolean);

