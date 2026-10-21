-- CAL01: synthetic published tasks/submitted offers; real selection and cancellation.
-- Normal triggers; authenticated role/JWT claims; SQL rollback, not signed HTTP.
begin;
set local statement_timeout='20s';
set local lock_timeout='2s';
do $seed$
declare owner_id uuid:=extensions.gen_random_uuid(); worker_id uuid:=extensions.gen_random_uuid();
 owner_pid uuid; worker_pid uuid; nid uuid; rid uuid; i integer;
 s timestamptz:=date_trunc('hour',now())+interval '7 days'; e timestamptz;
begin
 insert into auth.users(id,aud,role,email,created_at,updated_at) values
 (owner_id,'authenticated','authenticated','cal01-owner-'||owner_id||'@proof.invalid',now(),now()),
 (worker_id,'authenticated','authenticated','cal01-worker-'||worker_id||'@proof.invalid',now(),now());
 select id into strict owner_pid from public.app_profiles where account_id=owner_id and kind='REQUESTER';
 select id into strict worker_pid from public.app_profiles where account_id=worker_id and kind='WORKER';
 update public.app_profiles set display_name='Calendar Owner',city='Novi Sad' where id=owner_pid;
 perform set_config('uskoci.profile_mutation','COMPLETE_WORKER_PROFILE',true);
 update public.app_profiles set display_name='Calendar Worker',city='Novi Sad',skills=array['Proof'],profile_status='ACTIVE' where id=worker_pid;
 perform set_config('uskoci.profile_mutation','',true);
 for i in 1..4 loop
  nid:=extensions.gen_random_uuid();rid:=extensions.gen_random_uuid();
  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,
   category,approximate_city,mode,required_slots,schedule_kind,revision,response_deadline,published_at,starts_at)
  values(nid,owner_id,owner_pid,'PUBLISHED','CAL01 task '||i,'Calendar rollback proof','PROOF','Novi Sad','OFFERS',1,case when i=4 then 'FIXED_WINDOW' else 'FLEXIBLE' end,1,now()+interval '2 days',now(),case when i=4 then date_trunc('hour',now())+interval '7 days 1 hour' else null end);
  perform set_config('uskoci.need_lifecycle','',true);
  e:=s+interval '2 hours';
  if i=3 then s:=s+interval '2 hours';e:=s+interval '2 hours'; end if;
  if i=4 then s:=null;e:=null; end if;
  insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,
   submitted_against_need_revision,current_version,covered_slots,price_rsd,submitted_at,proposed_start_at,proposed_end_at)
  values(rid,nid,worker_id,worker_pid,'OFFER','SUBMITTED',1,1,1,1000,now(),s,e);
  insert into public.marketplace_response_versions(response_id,version,need_revision,covered_slots,price_rsd,content_hash,proposed_start_at,proposed_end_at)
  values(rid,1,1,1,1000,repeat('c',64),s,e);
    perform set_config('uskoci.cal_need_'||i,nid::text,true);
  perform set_config('uskoci.cal_response_'||i,rid::text,true);
 end loop;
 perform set_config('uskoci.cal_owner',owner_id::text,true);
 perform set_config('uskoci.cal_worker',worker_id::text,true);
 perform set_config('uskoci.cal_worker_profile',worker_pid::text,true);
end
$seed$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.cal_owner'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.cal_owner'),'role','authenticated')::text,true);
do $book$
declare aid uuid; row jsonb; detail text;
begin
 row:=public.rpc_list_need_candidates(current_setting('uskoci.cal_need_2')::uuid)->0;
 if row->>'state' is distinct from 'SELECTABLE' then raise exception 'CAL01_INITIAL_NOT_SELECTABLE'; end if;
 aid:=public.rpc_select_response(current_setting('uskoci.cal_need_1')::uuid,1,current_setting('uskoci.cal_response_1')::uuid,1,repeat('c',64),'cal01-first-command');
 perform set_config('uskoci.cal_agreement',aid::text,true);
 row:=public.rpc_list_need_candidates(current_setting('uskoci.cal_need_2')::uuid)->0;
 if row->>'state' is distinct from 'STALE' or row->>'canSelect' is distinct from 'false' then raise exception 'CAL01_OVERLAP_NOT_BLOCKED'; end if;
 if row->>'calendarConflict' is distinct from 'true'
 or public.rpc_list_need_candidates_page(current_setting('uskoci.cal_need_2')::uuid,10,null,null)->'items'->0->>'calendarConflict' is distinct from 'true'
 then raise exception 'CAL01_OWNER_REASON_MISSING'; end if;
 perform set_config('uskoci.cal_blocked_owner',row::text,true);
 begin
  perform public.rpc_select_response(current_setting('uskoci.cal_need_2')::uuid,1,current_setting('uskoci.cal_response_2')::uuid,1,repeat('c',64),'cal01-conflict-command');
  raise exception 'CAL01_CONFLICT_ALLOWED';
 exception when others then
  get stacked diagnostics detail=PG_EXCEPTION_DETAIL;
  if sqlerrm<>'WORKER_NO_LONGER_ELIGIBLE' or detail::jsonb @> '["CALENDAR_CONFLICT"]'::jsonb is not true then raise; end if;
 end;
 row:=public.rpc_list_need_candidates(current_setting('uskoci.cal_need_3')::uuid)->0;
 if row->>'state' is distinct from 'SELECTABLE' then raise exception 'CAL01_ADJACENT_BLOCKED'; end if;
row:=public.rpc_list_need_candidates_page(current_setting('uskoci.cal_need_4')::uuid,10,null,null)->'items'->0;
 if row->>'calendarConflict' is distinct from 'true' or row->>'canSelect' is distinct from 'false' then raise exception 'CAL01_START_ONLY_REASON_MISSING'; end if;
 begin
  perform public.rpc_select_response(current_setting('uskoci.cal_need_4')::uuid,1,current_setting('uskoci.cal_response_4')::uuid,1,repeat('c',64),'cal01-point-conflict');
  raise exception 'CAL01_START_ONLY_ALLOWED';
 exception when others then if sqlerrm not in ('WORKER_CALENDAR_CONFLICT','WORKER_NO_LONGER_ELIGIBLE') then raise; end if; end;
end
$book$;
select set_config('request.jwt.claim.sub',current_setting('uskoci.cal_worker'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.cal_worker'),'role','authenticated')::text,true);
select set_config('uskoci.cal_blocked_worker',public.rpc_list_my_applications_page('ACTIVE',30,null,null,null)::text,true);
do $worker_reason$
declare page jsonb:=public.rpc_list_my_applications_page('ACTIVE',30,null,null,null); whole jsonb:=public.rpc_list_my_applications(); row jsonb;
begin
 select x into row from jsonb_array_elements(page->'items') x where x->>'applicationId'=current_setting('uskoci.cal_response_2');
 if row->>'calendarConflict' is distinct from 'true' or row->>'state' is distinct from 'SUBMITTED' or row->>'canWithdraw' is distinct from 'true' then raise exception 'CAL01_WORKER_PAGE_REASON_MISSING'; end if;
 select x into row from jsonb_array_elements(whole) x where x->>'applicationId'=current_setting('uskoci.cal_response_2');
 if row->>'calendarConflict' is distinct from 'true' then raise exception 'CAL01_WORKER_WHOLE_REASON_MISSING'; end if;
 begin
  perform private.application_calendar_conflict_v1(current_setting('uskoci.cal_response_2')::uuid);
  raise exception 'CAL01_PRIVATE_HELPER_EXPOSED';
 exception when insufficient_privilege then null; end;
 begin
  perform public.rpc_list_need_candidates(current_setting('uskoci.cal_need_2')::uuid);
  raise exception 'CAL01_WRONG_OWNER_ALLOWED';
 exception when others then if sqlerrm<>'NOT_REQUESTER' then raise; end if; end;
end $worker_reason$;
select public.rpc_cancel_agreement(current_setting('uskoci.cal_agreement')::uuid,'CAL01 release calendar');
do $worker_restored$
declare row jsonb;
begin
 select x into row from jsonb_array_elements(public.rpc_list_my_applications_page('ACTIVE',30,null,null,null)->'items') x where x->>'applicationId'=current_setting('uskoci.cal_response_2');
 if row->>'calendarConflict' is distinct from 'false' then raise exception 'CAL01_WORKER_REASON_NOT_CLEARED'; end if;
end $worker_restored$;
select set_config('request.jwt.claim.sub',current_setting('uskoci.cal_owner'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.cal_owner'),'role','authenticated')::text,true);
do $restore$
declare row jsonb; aid uuid;
begin
 row:=public.rpc_list_need_candidates(current_setting('uskoci.cal_need_2')::uuid)->0;
 if row->>'calendarConflict' is distinct from 'false' or row->>'state' is distinct from 'SELECTABLE' or row->>'canSelect' is distinct from 'true' then raise exception 'CAL01_NOT_RESTORED'; end if;
 aid:=public.rpc_select_response(current_setting('uskoci.cal_need_2')::uuid,1,current_setting('uskoci.cal_response_2')::uuid,1,repeat('c',64),'cal01-conflict-command');
 if aid is null then raise exception 'CAL01_RETRY_FAILED'; end if;
end
$restore$;
reset role;
do $persisted$
begin
 if (select count(*) from public.agreements where worker_account_id=current_setting('uskoci.cal_worker')::uuid and status='CONFIRMED')<>1
 or (select count(*) from private.worker_calendar_events where worker_profile_id=current_setting('uskoci.cal_worker_profile')::uuid and state='BLOCKING')<>1
 or (select status from public.marketplace_responses where id=current_setting('uskoci.cal_response_3')::uuid)<>'SUBMITTED'
 then raise exception 'CAL01_PERSISTED_WRONG'; end if;
end
$persisted$;
select jsonb_build_object('result','PASS','overlapRejected',true,'adjacentAllowedByReader',true,
 'restoredAfterCancellation',true,'retrySameKeyAfterRejectedCommand',true,
 'blockedOwner',current_setting('uskoci.cal_blocked_owner')::jsonb,
 'blockedWorkerPage',current_setting('uskoci.cal_blocked_worker')::jsonb,'transaction','ROLLBACK') proof;
rollback;
