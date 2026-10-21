-- PED01 synthetic fixture, real owned opener/edit RPCs, no provider calls.
-- Synthetic immutable acceptance envelope tests the early guard; it is not AI E2E.
begin;
set local statement_timeout='20s';
set local lock_timeout='2s';
do $seed$
declare u uuid:=extensions.gen_random_uuid(); outsider uuid:=extensions.gen_random_uuid(); pid uuid; n uuid; c uuid; r uuid; i integer; opened jsonb;
begin
 insert into auth.users(id,aud,role,email,created_at,updated_at) values
 (u,'authenticated','authenticated','ped01-owner-'||u||'@proof.invalid',now(),now()),
 (outsider,'authenticated','authenticated','ped01-other-'||outsider||'@proof.invalid',now(),now());
 select id into strict pid from public.app_profiles where account_id=u and kind='REQUESTER';
 update public.app_profiles set display_name='PED01 Owner',city='Novi Sad' where id=pid;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 for i in 1..3 loop
  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  perform set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
  insert into public.needs(requester_account_id,requester_profile_id,status,title,description,category,
   approximate_city,mode,required_slots,schedule_kind,execution_location_mode,task_country_code,task_timezone,revision,published_at,response_deadline)
  values(u,pid,case when i<3 then 'PUBLISHED' else 'DRAFT' end,
   'PED01 task '||i,'Original task content','PROOF','', 'OFFERS',1,'FLEXIBLE','REMOTE','RS','Europe/Belgrade',1,
   case when i<3 then now() end,case when i<3 then now()+interval '2 days' end)
  returning id into n;
  if i=2 then
   perform set_config('uskoci.need_lifecycle','SELECT',true);
   update public.needs set status='SELECTION' where id=n;
  end if;
  perform set_config('uskoci.need_lifecycle','',true);
  perform set_config('uskoci.need_region','',true);
  insert into public.need_geography(need_id,public_topology) values(n,'{"mode":"REMOTE"}');
  insert into public.need_requirement_details(need_id,critical_conditions,handoff) values(n,'{}','{"required":false}');
  opened:=public.rpc_ai_open_need_edit_conversation_v2(n);c:=(opened->>'conversationId')::uuid;
  perform public.rpc_ai_correct_fact_v2((select id from public.ai_structured_facts
   where conversation_id=c and fact_key='need.title' and superseded_at is null),to_jsonb('PED01 changed '||i),'PED01 changed '||i);
  r:=extensions.gen_random_uuid();
  insert into private.ai_task_reviews(id,account_id,conversation_id,requester_profile_id,source_hash,policy_binding,envelope,expires_at)
   values(r,u,c,pid,repeat('a',64),'{}',jsonb_build_object('draftId',n,'draftRevision',1,
   'displayedContentDigest',repeat('b',64),'canAccept',true),now()+interval '10 minutes');
  perform set_config('uskoci.ped_need_'||i,n::text,true);
  perform set_config('uskoci.ped_conv_'||i,c::text,true);
  perform set_config('uskoci.ped_review_'||i,r::text,true);
  perform set_config('uskoci.ped_before_'||i,(select to_jsonb(t)::text from public.needs t where id=n),true);
 end loop;
 perform set_config('uskoci.ped_owner',u::text,true);
 perform set_config('uskoci.ped_other',outsider::text,true);
end $seed$;
set local role authenticated;
do $owner$
declare i integer; n uuid; c uuid; result jsonb; material jsonb;
begin
 for i in 1..2 loop
  n:=current_setting('uskoci.ped_need_'||i)::uuid;c:=current_setting('uskoci.ped_conv_'||i)::uuid;
  begin
   perform public.rpc_accept_ai_task_review(current_setting('uskoci.ped_review_'||i)::uuid,repeat('b',64),extensions.gen_random_uuid());
   raise exception 'PED01_ACCEPT_ALLOWED';
  exception when others then if sqlerrm<>'PUBLISHED_TASK_EDIT_NOT_READY' then raise; end if; end;
  begin
   perform public.rpc_confirm_need_edit_from_review_v2(n,1,c,'ped01-ai-'||i);
   raise exception 'PED01_DIRECT_EDIT_ALLOWED';
  exception when others then if sqlerrm<>'PUBLISHED_TASK_EDIT_NOT_READY' then raise; end if; end;
  material:=jsonb_build_object('title','Changed legacy','description','Legacy test','category','PROOF','requiredSlots',1,
   'mode','OFFERS','requesterPriceRsd',null,'requiredSkills','[]'::jsonb,'requiredTools','[]'::jsonb,'requiredVehicles','[]'::jsonb,
   'requiredLicenses','[]'::jsonb,'minimumExperienceYears',null,'verifiedIdentityRequired',false,'scheduleKind','FLEXIBLE',
   'startsAt',null,'endsAt',null,'executionLocationMode','REMOTE','approximateLat',null,'approximateLng',null,
   'approximateCity','','approximateArea','','publicPhotoPaths','[]'::jsonb,'privateLocation',null);
  begin
   perform public.rpc_confirm_need_edit(n,1,'ped01-legacy-'||i,material);
   raise exception 'PED01_LEGACY_EDIT_ALLOWED';
  exception when others then if sqlerrm<>'PUBLISHED_TASK_EDIT_NOT_READY' then raise; end if; end;
 end loop;
 -- Ordinary private draft edits remain functional, including receipt replay.
 n:=current_setting('uskoci.ped_need_3')::uuid;c:=current_setting('uskoci.ped_conv_3')::uuid;
 result:=public.rpc_confirm_need_edit_from_review_v2(n,1,c,'ped01-draft-edit');
 if result->>'status'<>'DRAFT' or result->>'revision'<>'2' then raise exception 'PED01_DRAFT_EDIT_FAILED'; end if;
 result:=public.rpc_confirm_need_edit_from_review_v2(n,1,c,'ped01-draft-edit');
 if result->>'idempotentReplay'<>'true' then raise exception 'PED01_DRAFT_REPLAY_FAILED'; end if;
end $owner$;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ped_other'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.ped_other'),'role','authenticated')::text,true);
do $outsider$ begin
 begin
  perform public.rpc_accept_ai_task_review(current_setting('uskoci.ped_review_1')::uuid,repeat('b',64),extensions.gen_random_uuid());
  raise exception 'PED01_FOREIGN_REVIEW_ALLOWED';
 exception when others then if sqlerrm<>'TASK_REVIEW_NOT_FOUND' then raise; end if; end;
 begin
  perform public.rpc_confirm_need_edit_from_review_v2(current_setting('uskoci.ped_need_1')::uuid,1,current_setting('uskoci.ped_conv_1')::uuid,'ped01-foreign');
  raise exception 'PED01_FOREIGN_EDIT_ALLOWED';
 exception when others then if sqlerrm not in ('EDIT_CONVERSATION_NOT_OWNED','NOT_OWNER','EDIT_CONVERSATION_NEED_MISMATCH') then raise; end if; end;
end $outsider$;
reset role;
do $unchanged$
declare i integer; n uuid;
begin
 for i in 1..2 loop
  n:=current_setting('uskoci.ped_need_'||i)::uuid;
  if (select to_jsonb(t) from public.needs t where id=n) is distinct from current_setting('uskoci.ped_before_'||i)::jsonb
   then raise exception 'PED01_PUBLIC_TASK_CHANGED'; end if;
  if exists(select 1 from private.ai_task_review_commands where review_id=current_setting('uskoci.ped_review_'||i)::uuid)
   or exists(select 1 from private.need_edit_commands where need_id=n)
   or exists(select 1 from private.need_revision_events where need_id=n)
   then raise exception 'PED01_REJECTED_COMMAND_WROTE'; end if;
  if (select status from public.ai_conversations where id=current_setting('uskoci.ped_conv_'||i)::uuid)<>'OPEN'
   then raise exception 'PED01_CONVERSATION_LOST'; end if;
 end loop;
 if (select title from public.needs where id=current_setting('uskoci.ped_need_3')::uuid)<>'PED01 changed 3'
  then raise exception 'PED01_DRAFT_TITLE_NOT_SAVED'; end if;
end $unchanged$;
select jsonb_build_object('proof','PED01','publicStates',jsonb_build_array('PUBLISHED','SELECTION'),
 'blockedEntryPoints',3,'originalRowsUnchanged',true,'draftEditAndReplay',true,'foreignOwnerRejected',true,
 'fixture','synthetic tasks/reviews; actual opener/edit RPCs; SQL rollback, not signed HTTP or Gemini') result;
rollback;
