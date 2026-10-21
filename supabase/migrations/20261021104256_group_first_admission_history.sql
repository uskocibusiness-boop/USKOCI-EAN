begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- GRP01: first-ever group admission may read prior group history.
-- No pre-existing membership is backfilled; no repeat/unblock/rejoin grant.
do $preimage$ begin
 if md5(pg_get_functiondef('private.group_sync_agreement_v5(public.agreements)'::regprocedure))
  <> '64ad67305cac32741c5c08a1925e7aab' then
  raise exception 'GRP01_SYNC_PREIMAGE_CHANGED';
 end if;
 if md5(pg_get_functiondef('public.rpc_send_group_message_v5(uuid,uuid,uuid,text)'::regprocedure))<>'8c91547c0d0111f8e069383b1944a1fa'
  or md5(pg_get_functiondef('public.rpc_read_group_messages_v5(uuid,uuid,text,text)'::regprocedure))<>'944e9683f66c3b0bfc29d3f7106de695'
  or md5(pg_get_functiondef('private.closure_account_restricted(uuid)'::regprocedure))<>'9ce14bacf456210147ba14235d7ba8de'
  or md5(pg_get_functiondef('private.safety_pair_blocked(uuid,uuid)'::regprocedure))<>'5a4787a7d82ab8dea576c27b5e47d87a'
  or md5(pg_get_functiondef('private.closure_account_key(uuid)'::regprocedure))<>'29116ea6e982cecd3242354a20faa3fd'
  or md5(pg_get_functiondef('private.safety_pair_key(uuid,uuid)'::regprocedure))<>'91b4ed6d5559355868c60924f0f7cb40'
  or md5(pg_get_functiondef('private.group_member_v5(private.group_conversations_v5,uuid)'::regprocedure))<>'daa065d23b1ef0db2e39f9606fda2f1a'
  or md5(pg_get_functiondef('private.group_can_send_v5(private.group_conversations_v5,uuid)'::regprocedure))<>'3ba1a952ff1d5f3689ab04025f07d765'
  then raise exception 'GRP01_BARRIER_OR_READ_SEND_CONTRACT_CHANGED';end if;
 if has_function_privilege('authenticated','private.group_sync_agreement_v5(public.agreements)','EXECUTE')
  or has_function_privilege('anon','private.group_sync_agreement_v5(public.agreements)','EXECUTE')
  then raise exception 'GRP01_PRIVATE_ADMISSION_EXPOSED';end if;
end $preimage$;

CREATE OR REPLACE FUNCTION private.group_sync_agreement_v5(a public.agreements)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare g private.group_conversations_v5;n public.needs;first_account_admission boolean;admitted uuid;r uuid;
begin
 select * into g from private.group_conversations_v5 where need_id=a.need_id for update;
 if not found then
  -- A single worker bringing several people still has the existing private
  -- Agreement. The shared conversation starts with two independently selected
  -- accounts. There is no earlier group history to grant retroactively.
  select * into n from public.needs where id=a.need_id;
  if (select count(distinct worker_account_id) from public.agreements where need_id=a.need_id and status<>'CANCELLED')<2 then return;end if;
  insert into private.group_conversations_v5(need_id,requester_account_id) values(n.id,n.requester_account_id)
   on conflict(need_id) do nothing;
  select * into g from private.group_conversations_v5 where need_id=a.need_id for update;
  insert into private.group_memberships_v5(group_id,agreement_id,account_id,profile_id,joined_sequence)
   select g.id,x.id,x.worker_account_id,x.worker_profile_id,g.sequence+1 from public.agreements x
   where x.need_id=a.need_id and x.status<>'CANCELLED' on conflict(agreement_id) do nothing;
 end if;
 if a.status='CANCELLED' then
  update private.group_memberships_v5 set ended_sequence=g.sequence,ended_at=clock_timestamp()
   where agreement_id=a.id and ended_sequence is null;
 else
  -- The group row serializes first admission with sends and all later admissions.
  -- A prior membership for ANY agreement consumes the one-time history grant.
  first_account_admission:=not exists(select 1 from private.group_memberships_v5
   where group_id=g.id and account_id=a.worker_account_id);
  insert into private.group_memberships_v5(group_id,agreement_id,account_id,profile_id,joined_sequence)
   values(g.id,a.id,a.worker_account_id,a.worker_profile_id,g.sequence+1)
   on conflict(agreement_id) do nothing returning agreement_id into admitted;
  if first_account_admission and admitted is not null then
   -- Same shared closure/safety barriers as group send; the exclusive barrier
   -- owners never take group/domain row locks. Recheck eligibility AFTER locks.
   -- Grant omissions are final even if the person is subsequently unblocked.
   for r in select a.worker_account_id
    union select g.requester_account_id
    union select sender_account_id from private.group_messages_v5 where group_id=g.id
    order by 1 loop
    perform pg_advisory_xact_lock_shared(private.closure_account_key(r));
    if r<>a.worker_account_id then
     perform pg_advisory_xact_lock_shared(private.safety_pair_key(a.worker_account_id,r));
    end if;
   end loop;
   if not private.closure_account_restricted(a.worker_account_id)
    and not private.closure_account_restricted(g.requester_account_id)
    and not private.safety_pair_blocked(a.worker_account_id,g.requester_account_id) then
    insert into private.group_message_visibility_v5(message_id,account_id,read_at)
    select m.id,a.worker_account_id,null from private.group_messages_v5 m
     where m.group_id=g.id and m.sequence<=g.sequence
      and not private.closure_account_restricted(m.sender_account_id)
      and (m.sender_account_id=a.worker_account_id
       or not private.safety_pair_blocked(a.worker_account_id,m.sender_account_id))
    on conflict(message_id,account_id) do nothing;
   end if;
  end if;
 end if;
end $function$
;

comment on table private.group_message_visibility_v5 is 'Immutable per-message recipient admission. First-ever group admission grants eligible existing history once. Missing grants are never backfilled after unblock or rejoin. Read markers do not create visibility.';


-- GRP01 synthetic accounts/task/response rows; real authenticated select/send/read/cancel.
-- Append after candidate.sql as an atomic migration gate. All fixtures roll back.
-- No provider, HTTP token or concurrent-session claim.
do $proof$
#variable_conflict use_variable
declare owner_id uuid:=extensions.gen_random_uuid(); owner_profile uuid; need_id uuid; group_id uuid;
 workers uuid[]:='{}';profiles uuid[]:='{}';responses uuid[]:='{}';agreements uuid[]:='{}';
 worker_id uuid;worker_profile uuid;response_id uuid;agreement_id uuid;rejoined uuid;
 result jsonb;context jsonb;before_count integer;i integer;a public.agreements;
 auth_role text:=current_user;
begin
 begin
  insert into auth.users(id,aud,role,email,created_at,updated_at)
   values(owner_id,'authenticated','authenticated','grp01-owner-'||owner_id||'@proof.invalid',now(),now());
  select id into strict owner_profile from public.app_profiles where account_id=owner_id and kind='REQUESTER';
  update public.app_profiles set display_name='GRP01 Owner',city='Novi Sad' where id=owner_profile;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  perform set_config('uskoci.need_lifecycle','PUBLISH',true);perform set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
  insert into public.needs(requester_account_id,requester_profile_id,status,title,description,category,
   approximate_city,mode,required_slots,schedule_kind,execution_location_mode,task_country_code,task_timezone,revision,published_at,response_deadline)
  values(owner_id,owner_profile,'PUBLISHED','GRP01 Dizajn logotipa','Zajednicki dizajn za proveru grupe.','Dizajn logotipa','',
   'OFFERS',4,'FLEXIBLE','REMOTE','RS','Europe/Belgrade',1,now(),now()+interval '2 days') returning id into need_id;
  perform set_config('uskoci.need_lifecycle','',true);perform set_config('uskoci.need_region','',true);
  insert into public.need_geography(need_id,public_topology) values(need_id,'{"mode":"REMOTE"}');
  insert into public.need_requirement_details(need_id,critical_conditions,handoff) values(need_id,'{}','{"required":false}');
  for i in 1..3 loop
   worker_id:=extensions.gen_random_uuid();response_id:=extensions.gen_random_uuid();
   perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
   insert into auth.users(id,aud,role,email,created_at,updated_at)
    values(worker_id,'authenticated','authenticated','grp01-worker-'||worker_id||'@proof.invalid',now(),now());
   select id into strict worker_profile from public.app_profiles where account_id=worker_id and kind='WORKER';
   perform set_config('uskoci.profile_mutation','COMPLETE_WORKER_PROFILE',true);
   update public.app_profiles set display_name='GRP01 Worker',city='Novi Sad',skills=array['Dizajn'],profile_status='ACTIVE' where id=worker_profile;
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
    agreement_id:=public.rpc_select_response(need_id,1,response_id,1,repeat('c',64),'grp01-select-'||worker_id);
    execute format('set local role %I',auth_role);
    agreements:=array_append(agreements,agreement_id);
   end if;
  end loop;
  select id into strict group_id from private.group_conversations_v5 g where g.need_id=need_id;
  execute 'set local role authenticated';
  perform public.rpc_send_group_message_v5(owner_id,group_id,extensions.gen_random_uuid(),'GRP01 owner history');
  execute format('set local role %I',auth_role);
  for i in 1..2 loop
   perform set_config('request.jwt.claim.sub',workers[i]::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',workers[i],'role','authenticated')::text,true);
   execute 'set local role authenticated';
   perform public.rpc_send_group_message_v5(workers[i],group_id,extensions.gen_random_uuid(),'GRP01 worker history '||i);
   execute format('set local role %I',auth_role);
  end loop;
  -- Unrestricted first admission receives every prior group message once.
  begin
   perform set_config('request.jwt.claim.sub',owner_id::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
   execute 'set local role authenticated';
   agreement_id:=public.rpc_select_response(need_id,1,responses[3],1,repeat('c',64),'grp01-all-history-'||workers[3]);
   execute format('set local role %I',auth_role);
   perform set_config('request.jwt.claim.sub',workers[3]::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',workers[3],'role','authenticated')::text,true);
   execute 'set local role authenticated';result:=public.rpc_read_group_messages_v5(workers[3],group_id,null,null);
   execute format('set local role %I',auth_role);
   if jsonb_array_length(result->'messages')<>3 then raise exception 'GRP01_ALL_HISTORY_MISSING';end if;
   raise sqlstate 'ZG003';
  exception when sqlstate 'ZG003' then null;end;
  -- Sender 1 is closure-restricted; sender 2 is blocked with the new participant.
  -- Only the owner's prior message may be admitted to worker 3.
  perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
  insert into private.account_closure_requests(account_id,state,revision) values(workers[1],'READY',1);
  insert into private.account_blocks(blocker_account_id,blocked_account_id,active,revision,last_blocked_at)
   values(workers[2],workers[3],true,1,clock_timestamp());
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  agreement_id:=public.rpc_select_response(need_id,1,responses[3],1,repeat('c',64),'grp01-select-'||workers[3]);
  execute format('set local role %I',auth_role);agreements:=array_append(agreements,agreement_id);
  perform set_config('request.jwt.claim.sub',workers[3]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',workers[3],'role','authenticated')::text,true);
  execute 'set local role authenticated';
  result:=public.rpc_read_group_messages_v5(workers[3],group_id,null,null);
  execute format('set local role %I',auth_role);
  if jsonb_array_length(result->'messages')<>1 or result#>>'{messages,0,body}'<>'GRP01 owner history'
   then raise exception 'GRP01_FIRST_ADMISSION_HISTORY';end if;
  -- Removing a restriction never grants previously omitted messages on repeat sync.
  delete from private.account_closure_requests where account_id=workers[1];
  update private.account_blocks set active=false,revision=2 where blocker_account_id=workers[2] and blocked_account_id=workers[3];
  select * into a from public.agreements where id=agreements[3];perform private.group_sync_agreement_v5(a);
  if (select count(*) from private.group_message_visibility_v5 v join private.group_messages_v5 m on m.id=v.message_id
   where m.group_id=group_id and v.account_id=workers[3])<>1 then raise exception 'GRP01_REPEAT_REGRANTED';end if;
  -- Defensively exercise admission with a restricted recipient and a requester-pair
  -- block. Only these synthetic membership/grant rows are reset inside rollback scopes.
  for i in 1..2 loop
   begin
    delete from private.group_message_visibility_v5 v using private.group_messages_v5 m
     where m.id=v.message_id and m.group_id=group_id and v.account_id=workers[3];
    delete from private.group_memberships_v5 m where m.group_id=group_id and m.account_id=workers[3];
    if i=1 then insert into private.account_closure_requests(account_id,state,revision) values(workers[3],'READY',1);
    else insert into private.account_blocks(blocker_account_id,blocked_account_id,active,revision,last_blocked_at)
     values(owner_id,workers[3],true,1,clock_timestamp());end if;
    perform private.group_sync_agreement_v5(a);
    if exists(select 1 from private.group_message_visibility_v5 v join private.group_messages_v5 m on m.id=v.message_id
     where m.group_id=group_id and v.account_id=workers[3]) then raise exception 'GRP01_RESTRICTED_RECIPIENT_GRANTED';end if;
    raise sqlstate 'ZG002';
   exception when sqlstate 'ZG002' then null;end;
  end loop;
  -- Departed worker retains granted history but cannot send or read future messages.
  perform set_config('request.jwt.claim.sub',workers[1]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',workers[1],'role','authenticated')::text,true);
  execute 'set local role authenticated';
  perform public.rpc_cancel_agreement(agreements[1],'GRP01 odlazak');
  context:=public.rpc_read_group_context_v5(workers[1],agreements[1],null);
  if context#>>'{group,canSend}'<>'false' then raise exception 'GRP01_CANCELLED_WRITABLE';end if;
  begin
   perform public.rpc_send_group_message_v5(workers[1],group_id,extensions.gen_random_uuid(),'GRP01 forbidden');
   raise exception 'GRP01_CANCELLED_SENT';
  exception when others then if sqlerrm<>'GROUP_READ_ONLY' then raise;end if;end;
  execute format('set local role %I',auth_role);
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  perform public.rpc_send_group_message_v5(owner_id,group_id,extensions.gen_random_uuid(),'GRP01 absence gap');
  execute format('set local role %I',auth_role);
  perform set_config('request.jwt.claim.sub',workers[1]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',workers[1],'role','authenticated')::text,true);
  execute 'set local role authenticated';result:=public.rpc_read_group_messages_v5(workers[1],group_id,null,null);
  execute format('set local role %I',auth_role);
  if jsonb_array_length(result->'messages')<>3 then raise exception 'GRP01_DEPARTED_HISTORY_CHANGED';end if;
  -- Real reselection creates a new agreement for the same account; the absence gap
  -- must stay invisible even though future messages become available again.
  response_id:=extensions.gen_random_uuid();
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,
   submitted_against_need_revision,current_version,covered_slots,price_rsd,submitted_at)
   values(response_id,need_id,workers[1],profiles[1],'OFFER','SUBMITTED',1,1,1,1000,now());
  insert into public.marketplace_response_versions(response_id,version,need_revision,covered_slots,price_rsd,content_hash)
   values(response_id,1,1,1,1000,repeat('c',64));
  execute 'set local role authenticated';
  rejoined:=public.rpc_select_response(need_id,1,response_id,1,repeat('c',64),'grp01-rejoin-'||workers[1]);
  perform public.rpc_send_group_message_v5(owner_id,group_id,extensions.gen_random_uuid(),'GRP01 after rejoin');
  execute format('set local role %I',auth_role);
  perform set_config('request.jwt.claim.sub',workers[1]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',workers[1],'role','authenticated')::text,true);
  execute 'set local role authenticated';result:=public.rpc_read_group_messages_v5(workers[1],group_id,null,null);
  context:=public.rpc_read_group_context_v5(workers[1],rejoined,null);
  execute format('set local role %I',auth_role);
  if context#>>'{group,canSend}'<>'true' or jsonb_array_length(result->'messages')<>4
   or exists(select 1 from jsonb_array_elements(result->'messages') m where m->>'body'='GRP01 absence gap')
   then raise exception 'GRP01_REJOIN_REGRANTED';end if;
  -- Deferred relationship guards are part of the proof, before fixture rollback.
  set constraints all immediate;
  raise sqlstate 'ZG001';
 exception when sqlstate 'ZG001' then null;end;
 if exists(select 1 from auth.users where id=owner_id) then raise exception 'GRP01_FIXTURE_LEAK';end if;
end $proof$;
select jsonb_build_object('proof','GRP01_FIRST_ADMISSION','passed',true,
 'fixtureAccountsRemaining',(select count(*) from auth.users where email like 'grp01-%@proof.invalid')) result;
commit;
