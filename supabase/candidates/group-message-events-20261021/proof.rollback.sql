-- GRP02 synthetic accounts/task/response rows; real authenticated select/send/read/cancel.
-- Append after candidate.sql as an atomic migration gate. All fixtures roll back.
-- No provider, HTTP token or concurrent-session claim.
do $proof$
#variable_conflict use_variable
declare owner_id uuid:=extensions.gen_random_uuid(); owner_profile uuid; need_id uuid; group_id uuid;
 workers uuid[]:='{}';profiles uuid[]:='{}';responses uuid[]:='{}';agreements uuid[]:='{}';
 worker_id uuid;worker_profile uuid;response_id uuid;agreement_id uuid;rejoined uuid;
 result jsonb;context jsonb;before_count integer;i integer;a public.agreements;
 auth_role text:=current_user;msg uuid;event_id uuid;request_id uuid:=extensions.gen_random_uuid();event_count integer;delivery public.notification_deliveries;target jsonb;
begin
 begin
  insert into auth.users(id,aud,role,email,created_at,updated_at)
   values(owner_id,'authenticated','authenticated','grp02-owner-'||owner_id||'@proof.invalid',now(),now());
  select id into strict owner_profile from public.app_profiles where account_id=owner_id and kind='REQUESTER';
  update public.app_profiles set display_name='GRP02 Owner',city='Novi Sad' where id=owner_profile;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  perform set_config('uskoci.need_lifecycle','PUBLISH',true);perform set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
  insert into public.needs(requester_account_id,requester_profile_id,status,title,description,category,
   approximate_city,mode,required_slots,schedule_kind,execution_location_mode,task_country_code,task_timezone,revision,published_at,response_deadline)
  values(owner_id,owner_profile,'PUBLISHED','GRP02 Dizajn logotipa','Zajednicki dizajn za proveru grupe.','Dizajn logotipa','',
   'OFFERS',4,'FLEXIBLE','REMOTE','RS','Europe/Belgrade',1,now(),now()+interval '2 days') returning id into need_id;
  perform set_config('uskoci.need_lifecycle','',true);perform set_config('uskoci.need_region','',true);
  insert into public.need_geography(need_id,public_topology) values(need_id,'{"mode":"REMOTE"}');
  insert into public.need_requirement_details(need_id,critical_conditions,handoff) values(need_id,'{}','{"required":false}');
  for i in 1..3 loop
   worker_id:=extensions.gen_random_uuid();response_id:=extensions.gen_random_uuid();
   perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
   insert into auth.users(id,aud,role,email,created_at,updated_at)
    values(worker_id,'authenticated','authenticated','grp02-worker-'||worker_id||'@proof.invalid',now(),now());
   select id into strict worker_profile from public.app_profiles where account_id=worker_id and kind='WORKER';
   perform set_config('uskoci.profile_mutation','COMPLETE_WORKER_PROFILE',true);
   update public.app_profiles set display_name='GRP02 Worker',city='Novi Sad',skills=array['Dizajn'],profile_status='ACTIVE' where id=worker_profile;
   perform set_config('uskoci.profile_mutation','',true);
   perform set_config('request.jwt.claim.sub',owner_id::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
   insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,
    submitted_against_need_revision,current_version,covered_slots,price_rsd,submitted_at)
    values(response_id,need_id,worker_id,worker_profile,'OFFER','SUBMITTED',1,1,1,1000,now());
   insert into public.marketplace_response_versions(response_id,version,need_revision,covered_slots,price_rsd,content_hash)
    values(response_id,1,1,1,1000,repeat('c',64));
   workers:=array_append(workers,worker_id);profiles:=array_append(profiles,worker_profile);responses:=array_append(responses,response_id);
   if i<3 then
    execute 'set local role authenticated';
    agreement_id:=public.rpc_select_response(need_id,1,response_id,1,repeat('c',64),'grp02-select-'||worker_id);
    execute format('set local role %I',auth_role);
    agreements:=array_append(agreements,agreement_id);
   end if;
  end loop;
  select id into strict group_id from private.group_conversations_v5 g where g.need_id=need_id;
  insert into public.notification_preferences(user_id,role_context,push_enabled)
   values(owner_id,'REQUESTER',true),(workers[1],'WORKER',true),(workers[2],'WORKER',true)
   on conflict(user_id,role_context) do update set push_enabled=true;
  execute 'set local role authenticated';
  result:=public.rpc_send_group_message_v5(owner_id,group_id,request_id,'GRP02 new message');
  perform public.rpc_send_group_message_v5(owner_id,group_id,request_id,'GRP02 new message');
  execute format('set local role %I',auth_role);msg:=(result->>'messageId')::uuid;
  if msg is null then raise exception 'GRP02_SEND_RECEIPT';end if;
  select count(*) into event_count from public.user_activity_events where payload->>'group_message_id'=msg::text;
  if event_count<>2 then raise exception 'GRP02_RECIPIENTS_OR_REPLAY';end if;
  select id into strict event_id from public.user_activity_events where payload->>'group_message_id'=msg::text and recipient_user_id=workers[1];
  if exists(select 1 from public.user_activity_events where payload->>'group_message_id'=msg::text
    and (payload<>jsonb_build_object('group_message_id',msg) or recipient_user_id=owner_id)) then raise exception 'GRP02_PAYLOAD';end if;
  -- A foreign account never resolves the event, nor can a private blanket ACK read it.
  perform set_config('request.jwt.claim.sub',workers[2]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',workers[2],'role','authenticated')::text,true);
  execute 'set local role authenticated';target:=public.rpc_resolve_activity_message_v1(workers[2],event_id);
  execute format('set local role %I',auth_role);
  if target->>'kind'<>'UNAVAILABLE' then raise exception 'GRP02_FOREIGN';end if;
  perform set_config('request.jwt.claim.sub',workers[1]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',workers[1],'role','authenticated')::text,true);
  execute 'set local role authenticated';
  target:=public.rpc_resolve_activity_message_v1(workers[1],event_id);
  perform public.rpc_mark_agreement_messages_read(agreements[1]);
  execute format('set local role %I',auth_role);
  if target->>'kind'<>'GROUP_MESSAGE' or target->>'messageId'<>msg::text or target->>'groupId'<>group_id::text
    or target->>'agreementId'<>agreements[1]::text or target->>'role'<>'WORKER' then raise exception 'GRP02_TARGET';end if;
  if (select read_at from public.user_activity_events where id=event_id) is not null then raise exception 'GRP02_EARLY_ACK';end if;
  select * into strict delivery from public.notification_deliveries d where d.event_id=event_id and d.channel='PUSH';
  if private.push_suppression(delivery) is not null then raise exception 'GRP02_ACTIVE_PUSH';end if;
  -- A forged/noncanonical association cannot route or be pushed.
  begin
   update public.user_activity_events set dedupe_key=dedupe_key||':bad' where id=event_id;
   execute 'set local role authenticated';target:=public.rpc_resolve_activity_message_v1(workers[1],event_id);
   execute format('set local role %I',auth_role);
   if target->>'kind'<>'UNAVAILABLE' or private.push_suppression(delivery)<>'GROUP_CONTEXT_ENDED' then raise exception 'GRP02_FORGED';end if;
   raise sqlstate 'ZG022';
  exception when sqlstate 'ZG022' then null;end;
  -- Measured ACK settles only this recipient's exact group event.
  execute 'set local role authenticated';perform public.rpc_mark_group_messages_read_v5(workers[1],group_id,array[msg]);
  execute format('set local role %I',auth_role);
  if (select read_at from public.user_activity_events where id=event_id) is null
    or exists(select 1 from public.user_activity_events where payload->>'group_message_id'=msg::text and recipient_user_id=workers[2] and read_at is not null)
    then raise exception 'GRP02_EXACT_ACK';end if;
  -- Worker sender reaches owner + other worker, never private chat.
  execute 'set local role authenticated';result:=public.rpc_send_group_message_v5(workers[1],group_id,extensions.gen_random_uuid(),'GRP02 worker message');
  execute format('set local role %I',auth_role);
  select id into strict event_id from public.user_activity_events where payload->>'group_message_id'=result->>'messageId' and recipient_user_id=owner_id;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  execute 'set local role authenticated';target:=public.rpc_resolve_activity_message_v1(owner_id,event_id);
  execute format('set local role %I',auth_role);
  if target->>'kind'<>'GROUP_MESSAGE' or target->>'role'<>'REQUESTER' then raise exception 'GRP02_OWNER_TARGET';end if;
  -- Real cancellation removes future event admission and suppresses queued old sends.
  perform set_config('request.jwt.claim.sub',workers[1]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',workers[1],'role','authenticated')::text,true);
  execute 'set local role authenticated';perform public.rpc_cancel_agreement(agreements[1],1,'OTHER','GRP02 departure','grp02-cancel-'||workers[1]);
  execute format('set local role %I',auth_role);
  if private.push_suppression(delivery)<>'GROUP_CONTEXT_ENDED' then raise exception 'GRP02_DEPARTED_PUSH';end if;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  execute 'set local role authenticated';result:=public.rpc_send_group_message_v5(owner_id,group_id,extensions.gen_random_uuid(),'GRP02 after departure');
  execute format('set local role %I',auth_role);
  if exists(select 1 from public.user_activity_events where payload->>'group_message_id'=result->>'messageId' and recipient_user_id=workers[1])
    then raise exception 'GRP02_FUTURE_EVENT';end if;
  -- Blocked peer receives neither visibility nor event; no deferred guard is skipped.
  insert into private.account_blocks(blocker_account_id,blocked_account_id,active,revision,last_blocked_at)
    values(owner_id,workers[2],true,1,clock_timestamp());
  execute 'set local role authenticated';result:=public.rpc_send_group_message_v5(owner_id,group_id,extensions.gen_random_uuid(),'GRP02 blocked recipient');
  execute format('set local role %I',auth_role);
  if exists(select 1 from public.user_activity_events where payload->>'group_message_id'=result->>'messageId') then raise exception 'GRP02_BLOCKED_EVENT';end if;
  set constraints all immediate;
  raise sqlstate 'ZG021';
 exception when sqlstate 'ZG021' then null;end;
 if exists(select 1 from auth.users where id=owner_id) then raise exception 'GRP02_FIXTURE_LEAK';end if;
end $proof$;
select jsonb_build_object('proof','GRP02_GROUP_MESSAGE_EVENTS','passed',true,
 'fixtureAccountsRemaining',(select count(*) from auth.users where email like 'grp02-%@proof.invalid')) result;
