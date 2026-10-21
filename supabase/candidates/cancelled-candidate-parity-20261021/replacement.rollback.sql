-- CCP03: real cancellation and replacement from a synthetic initial selection.
-- not an Auth signup/selection E2E. No triggers or policies are disabled.
-- Deferred creation constraints are not claimed verified by this fixture.
begin;
set local statement_timeout='15s';
set local lock_timeout='2s';
do $seed$
declare
 owner_id uuid:=extensions.gen_random_uuid(); worker_id uuid:=extensions.gen_random_uuid();
 owner_pid uuid; worker_pid uuid;
 nid uuid:=extensions.gen_random_uuid(); rid uuid:=extensions.gen_random_uuid();
 sid uuid:=extensions.gen_random_uuid(); aid uuid:=extensions.gen_random_uuid();
 extra_worker uuid; extra_profile uuid; extra_response uuid; extra_selection uuid; extra_agreement uuid; i integer;
begin
 insert into auth.users(id,aud,role,email,created_at,updated_at) values
 (owner_id,'authenticated','authenticated','ccp2-owner-'||owner_id||'@proof.invalid',now(),now()),
 (worker_id,'authenticated','authenticated','ccp2-worker-'||worker_id||'@proof.invalid',now(),now());
 select id into strict owner_pid from public.app_profiles where account_id=owner_id and kind='REQUESTER';
 select id into strict worker_pid from public.app_profiles where account_id=worker_id and kind='WORKER';
 update public.app_profiles set display_name='CCP Owner',city='Novi Sad' where id=owner_pid;
 perform set_config('uskoci.profile_mutation','COMPLETE_WORKER_PROFILE',true);
 update public.app_profiles set display_name='CCP Worker',city='Novi Sad',skills=array['Proof'],profile_status='ACTIVE' where id=worker_pid;
 perform set_config('uskoci.profile_mutation','',true);
 perform set_config('uskoci.need_lifecycle','PUBLISH',true);
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,
 category,approximate_city,mode,required_slots,schedule_kind,revision,response_deadline,published_at)
 values(nid,owner_id,owner_pid,'PUBLISHED','CCP2 rollback task','Synthetic historical selection projection',
 'PROOF','Novi Sad','OFFERS',3,'FLEXIBLE',1,now()+interval '2 days',now());
 perform set_config('uskoci.need_lifecycle','SELECT',true);
 update public.needs set status='SELECTION' where id=nid;
 perform set_config('uskoci.need_lifecycle','',true);
 insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,
 status,submitted_against_need_revision,current_version,covered_slots,price_rsd,submitted_at)
 values(rid,nid,worker_id,worker_pid,'OFFER','SELECTED',1,1,1,1000,now());
 insert into public.marketplace_response_versions(response_id,version,need_revision,covered_slots,price_rsd,content_hash)
 values(rid,1,1,1,1000,repeat('b',64));
 insert into public.need_selections(id,need_id,need_revision,selected_by_account_id,client_request_id,
 covered_slots,response_id,worker_account_id,worker_profile_id,selection_mode,status)
 values(sid,nid,1,owner_id,sid,1,rid,worker_id,worker_pid,'REQUESTER_SELECTS','SELECTED');
 insert into public.agreements(id,need_id,selection_id,selected_response_id,requester_account_id,
 requester_profile_id,worker_account_id,worker_profile_id,status)
 values(aid,nid,sid,rid,owner_id,owner_pid,worker_id,worker_pid,'CONFIRMED');
 insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
 values(aid,1,'CONFIRMED','{"price_rsd":1000,"covered_slots":1}',repeat('b',64),owner_id);
 insert into public.agreement_execution(agreement_id,agreement_version,state) values(aid,1,'CONFIRMED');
 for i in 1..2 loop
  extra_worker:=extensions.gen_random_uuid();extra_response:=extensions.gen_random_uuid();
  extra_selection:=extensions.gen_random_uuid();extra_agreement:=extensions.gen_random_uuid();
  insert into auth.users(id,aud,role,email,created_at,updated_at)
  values(extra_worker,'authenticated','authenticated','ccp2-extra-'||extra_worker||'@proof.invalid',now(),now());
  select id into strict extra_profile from public.app_profiles where account_id=extra_worker and kind='WORKER';
  perform set_config('uskoci.profile_mutation','COMPLETE_WORKER_PROFILE',true);
  update public.app_profiles set display_name='CCP Extra Worker',city='Novi Sad',skills=array['Proof'],profile_status='ACTIVE' where id=extra_profile;
  perform set_config('uskoci.profile_mutation','',true);
  insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,
   submitted_against_need_revision,current_version,covered_slots,price_rsd,submitted_at)
  values(extra_response,nid,extra_worker,extra_profile,'OFFER','SELECTED',1,1,1,1000,now());
  insert into public.marketplace_response_versions(response_id,version,need_revision,covered_slots,price_rsd,content_hash)
  values(extra_response,1,1,1,1000,repeat('a',64));
  insert into public.need_selections(id,need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,response_id,
   worker_account_id,worker_profile_id,selection_mode,status)
  values(extra_selection,nid,1,owner_id,extra_selection,1,extra_response,extra_worker,extra_profile,'REQUESTER_SELECTS','SELECTED');
  insert into public.agreements(id,need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,
   worker_account_id,worker_profile_id,status)
  values(extra_agreement,nid,extra_selection,extra_response,owner_id,owner_pid,extra_worker,extra_profile,'CONFIRMED');
  insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
  values(extra_agreement,1,'CONFIRMED','{"price_rsd":1000,"covered_slots":1}',repeat('a',64),owner_id);
  insert into public.agreement_execution(agreement_id,agreement_version,state) values(extra_agreement,1,'CONFIRMED');
 end loop;
 perform set_config('uskoci.need_lifecycle','SELECT',true);
 update public.needs set status='ACTIVE' where id=nid;
 perform set_config('uskoci.need_lifecycle','',true);
 perform set_config('uskoci.ccp_need',nid::text,true);
 perform set_config('uskoci.ccp_owner',owner_id::text,true);
 perform set_config('uskoci.ccp_worker',worker_id::text,true);
 perform set_config('uskoci.ccp_agreement',aid::text,true);
 perform set_config('uskoci.ccp_response',rid::text,true);
end
$seed$;
do $replacement_fixture$
declare wid uuid:=extensions.gen_random_uuid(); pid uuid; rid uuid:=extensions.gen_random_uuid();
begin
 insert into auth.users(id,aud,role,email,created_at,updated_at)
 values(wid,'authenticated','authenticated','ccp3-replacement-'||wid||'@proof.invalid',now(),now());
 select id into strict pid from public.app_profiles where account_id=wid and kind='WORKER';
 perform set_config('uskoci.profile_mutation','COMPLETE_WORKER_PROFILE',true);
 update public.app_profiles set display_name='CCP Replacement',city='Novi Sad',skills=array['Proof'],profile_status='ACTIVE' where id=pid;
 perform set_config('uskoci.profile_mutation','',true);
 insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,
 submitted_against_need_revision,current_version,covered_slots,price_rsd,submitted_at)
 values(rid,current_setting('uskoci.ccp_need')::uuid,wid,pid,'OFFER','SUBMITTED',1,1,1,1000,now());
 insert into public.marketplace_response_versions(response_id,version,need_revision,covered_slots,price_rsd,content_hash)
 values(rid,1,1,1,1000,repeat('c',64));
 perform set_config('uskoci.ccp_replacement',rid::text,true);
 perform set_config('uskoci.ccp_new_worker',wid::text,true);
end
$replacement_fixture$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ccp_owner'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.ccp_owner'),'role','authenticated')::text,true);
do $before$
declare rows jsonb:=public.rpc_list_need_candidates(current_setting('uskoci.ccp_need')::uuid);
begin
 if jsonb_array_length(rows)<>4 or (select count(*) from jsonb_array_elements(rows) r where r->>'state'='SELECTED')<>3 or exists(select 1 from jsonb_array_elements(rows) r where (r->>'remainingSlots')::integer<>0) then
  raise exception 'CCP02_INITIAL_SELECTION_INVALID';
 end if;
end
$before$;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ccp_worker'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.ccp_worker'),'role','authenticated')::text,true);
select public.rpc_cancel_agreement(current_setting('uskoci.ccp_agreement')::uuid,'CCP2 rollback cancellation');
select set_config('uskoci.ccp_worker_result',public.rpc_list_my_applications()::text,true);
do $outsider$
begin
 begin
  perform public.rpc_list_need_candidates(current_setting('uskoci.ccp_need')::uuid);
  raise exception 'CCP02_OTHER_OWNER_ALLOWED';
 exception when others then if sqlerrm<>'NOT_REQUESTER' then raise; end if; end;
 begin
  perform public.rpc_list_need_candidates_page(current_setting('uskoci.ccp_need')::uuid,10,null,null);
  raise exception 'CCP02_OTHER_OWNER_PAGE_ALLOWED';
 exception when others then if sqlerrm<>'NOT_REQUESTER' then raise; end if; end;
end
$outsider$;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ccp_owner'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.ccp_owner'),'role','authenticated')::text,true);
do $after$
declare rows jsonb:=public.rpc_list_need_candidates(current_setting('uskoci.ccp_need')::uuid);
 page jsonb:=public.rpc_list_need_candidates_page(current_setting('uskoci.ccp_need')::uuid,10,null,null);
 worker jsonb:=current_setting('uskoci.ccp_worker_result')::jsonb;
 closed_row jsonb; closed_page jsonb;
begin
 select r into closed_row from jsonb_array_elements(rows) r where r->>'responseId'=current_setting('uskoci.ccp_response');
 select r into closed_page from jsonb_array_elements(page->'items') r where r->>'responseId'=current_setting('uskoci.ccp_response');
 if jsonb_array_length(rows)<>4 or jsonb_array_length(page->'items')<>4 or jsonb_array_length(worker)<>1
  or closed_row->>'state' is distinct from 'CLOSED' or closed_page->>'state' is distinct from 'CLOSED'
  or worker->0->>'state' is distinct from 'CLOSED' or (closed_row->>'remainingSlots')::integer is distinct from 1
  or (closed_page->>'remainingSlots')::integer is distinct from 1
  or (closed_row->>'canSelect')::boolean is distinct from false or (closed_page->>'canSelect')::boolean is distinct from false
  or (select count(*) from jsonb_array_elements(rows) r where r->>'state'='SELECTED')<>2
  or (select count(*) from jsonb_array_elements(page->'items') r where r->>'state'='SELECTED')<>2
 then raise exception 'CCP02_CANCELLED_PARITY_FAILURE'; end if;
end
$after$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ccp_owner'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.ccp_owner'),'role','authenticated')::text,true);
do $real_selection$
declare aid uuid; again uuid; rows jsonb; item jsonb;
begin
 aid:=public.rpc_select_response(current_setting('uskoci.ccp_need')::uuid,1,current_setting('uskoci.ccp_replacement')::uuid,1,repeat('c',64),'ccp3-replacement-command');
 again:=public.rpc_select_response(current_setting('uskoci.ccp_need')::uuid,1,current_setting('uskoci.ccp_replacement')::uuid,1,repeat('c',64),'ccp3-replacement-command');
 if aid is null or again is distinct from aid then raise exception 'CCP03_IDEMPOTENCY_FAILED'; end if;
 perform set_config('uskoci.ccp_new_agreement',aid::text,true);
 begin
  perform public.rpc_select_response(current_setting('uskoci.ccp_need')::uuid,1,current_setting('uskoci.ccp_replacement')::uuid,1,repeat('d',64),'ccp3-replacement-command');
  raise exception 'CCP03_CHANGED_REPLAY_ALLOWED';
 exception when others then if sqlerrm<>'IDEMPOTENCY_KEY_REUSED' then raise; end if; end;
 rows:=public.rpc_list_need_candidates(current_setting('uskoci.ccp_need')::uuid);
 select r into item from jsonb_array_elements(rows) r where r->>'responseId'=current_setting('uskoci.ccp_replacement');
 if item->>'state' is distinct from 'SELECTED' or (item->>'remainingSlots')::integer is distinct from 0
 or (select count(*) from jsonb_array_elements(rows) r where r->>'state'='SELECTED')<>3
 then raise exception 'CCP03_REPLACEMENT_PARITY_FAILED'; end if;
end
$real_selection$;
select set_config('uskoci.ccp_owner_workspace',public.rpc_get_agreement_workspace(current_setting('uskoci.ccp_new_agreement')::uuid)::text,true);
select set_config('request.jwt.claim.sub',current_setting('uskoci.ccp_new_worker'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.ccp_new_worker'),'role','authenticated')::text,true);
select set_config('uskoci.ccp_worker_workspace',public.rpc_get_agreement_workspace(current_setting('uskoci.ccp_new_agreement')::uuid)::text,true);

do $workspace_assert$
declare o jsonb:=current_setting('uskoci.ccp_owner_workspace')::jsonb;
 w jsonb:=current_setting('uskoci.ccp_worker_workspace')::jsonb; apps jsonb:=public.rpc_list_my_applications();
begin
 if o->>'id' is distinct from current_setting('uskoci.ccp_new_agreement') or w->>'id' is distinct from o->>'id'
 or o->>'status' is distinct from 'CONFIRMED' or w->>'status' is distinct from 'CONFIRMED'
 or o->'terms' is distinct from w->'terms'
 or o->'actionState'->>'accountId' is distinct from current_setting('uskoci.ccp_owner')
 or w->'actionState'->>'accountId' is distinct from current_setting('uskoci.ccp_new_worker')
 or o->'actionState'->>'canMarkWorkDone' is distinct from 'false'
 or w->'actionState'->>'canMarkWorkDone' is distinct from 'true'
 or o->'actionState'->>'canConfirmCompletion' is distinct from 'true'
 or w->'actionState'->>'canConfirmCompletion' is distinct from 'false'
 or o->>'theirPhone' is not null or w->>'theirPhone' is not null
 or jsonb_array_length(apps)<>1 or apps->0->>'agreementId' is distinct from o->>'id'
 or apps->0->>'state' is distinct from 'SELECTED'
 then raise exception 'CCP03_WORKSPACE_MISMATCH'; end if;
end
$workspace_assert$;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ccp_worker'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.ccp_worker'),'role','authenticated')::text,true);
do $former_worker$
declare apps jsonb:=public.rpc_list_my_applications();
begin
 if apps->0->>'state' is distinct from 'CLOSED' then raise exception 'CCP03_FORMER_WORKER_NOT_CLOSED'; end if;
 begin
  perform public.rpc_get_agreement_workspace(current_setting('uskoci.ccp_new_agreement')::uuid);
  raise exception 'CCP03_FORMER_WORKER_ALLOWED';
 exception when others then if sqlerrm<>'AGREEMENT_NOT_FOUND_OR_FORBIDDEN' then raise; end if; end;
end
$former_worker$;
reset role;
do $persisted$
declare nid uuid:=current_setting('uskoci.ccp_need')::uuid;
begin
 if (select status from public.needs where id=nid) is distinct from 'ACTIVE'
 or public.fn_need_covered_slots(nid)<>3
 or (select count(*) from public.agreements where selected_response_id=current_setting('uskoci.ccp_replacement')::uuid)<>1
 or (select count(*) from private.selection_commands where requester_account_id=current_setting('uskoci.ccp_owner')::uuid and client_request_id='ccp3-replacement-command')<>1
 then raise exception 'CCP03_PERSISTED_RESULT_INVALID'; end if;
end
$persisted$;
select jsonb_build_object('scenario','3/3 -> 2/3 -> real replacement 3/3','result','PASS',
 'ownerWorkerWorkspace','PASS','idempotentReplay','PASS','changedReplayRejected','PASS',
 'formerWorkerIsolated','PASS','duplicateAgreements',0,'transaction','ROLLBACK') as proof;
rollback;
