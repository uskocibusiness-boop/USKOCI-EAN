-- Synthetic SQL-auth fixture. All data rolled back, no provider/token/device send.
do $proof$
declare u uuid:=extensions.gen_random_uuid(); worker uuid:=extensions.gen_random_uuid();
 pid uuid;wid uuid;n uuid; response_id uuid:=extensions.gen_random_uuid();
 sid uuid:=extensions.gen_random_uuid(); wsid uuid:=extensions.gen_random_uuid(); ev uuid; got jsonb;
 auth_role text:=current_user;
begin
 begin
  insert into auth.users(id,aud,role,email,created_at,updated_at)
   values(u,'authenticated','authenticated','pushproof-'||u||'@proof.invalid',now(),now());
  select id into strict pid from public.app_profiles where account_id=u and kind='REQUESTER';
  update public.app_profiles set display_name='PED02 proba',city='Novi Sad' where id=pid;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  perform set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
  insert into public.needs(requester_account_id,requester_profile_id,status,title,description,category,
   approximate_city,mode,required_slots,schedule_kind,execution_location_mode,task_country_code,task_timezone,revision,published_at,response_deadline)
  values(u,pid,'PUBLISHED','PED02 Dizajn logotipa','Potreban je novi logo za radionicu.','Dizajn logotipa','',
   'OFFERS',1,'FLEXIBLE','REMOTE','RS','Europe/Belgrade',1,now(),now()+interval '2 days') returning id into n;
  perform set_config('uskoci.need_lifecycle','',true);perform set_config('uskoci.need_region','',true);
  insert into public.need_geography(need_id,public_topology) values(n,'{"mode":"REMOTE"}');
  insert into public.need_requirement_details(need_id,critical_conditions,handoff) values(n,'{}','{"required":false}');

  insert into auth.users(id,aud,role,email,created_at,updated_at)
   values(worker,'authenticated','authenticated','pushproof-worker-'||worker||'@proof.invalid',now(),now());
  select id into strict wid from public.app_profiles where account_id=worker and kind='WORKER';
  perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
  perform set_config('uskoci.profile_mutation','COMPLETE_WORKER_PROFILE',true);
  update public.app_profiles set display_name='PED02 Worker',city='Novi Sad',skills=array['Dizajn'],profile_status='ACTIVE' where id=wid;
  perform set_config('uskoci.profile_mutation','',true);
  perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,
    submitted_against_need_revision,current_version,covered_slots,price_rsd,submitted_at)
   values(response_id,n,worker,wid,'OFFER','SUBMITTED',1,1,1,1000,now());
  insert into public.marketplace_response_versions(response_id,version,need_revision,covered_slots,price_rsd,content_hash)
   values(response_id,1,1,1,1000,repeat('b',64));

  insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(sid,u,now(),now(),'aal1'),(wsid,worker,now(),now(),'aal1');
  select id into strict ev from public.user_activity_events where entity_id=response_id and event_type='RESPONSE_RECEIVED';
  if not exists(select 1 from private.need_candidate_states_v5(n,array[response_id]) where candidate_state='SELECTABLE') then raise exception 'PUSH_PROOF_FIXTURE_NOT_SELECTABLE';end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',sid)::text,true);
  execute 'set local role authenticated';
  got:=public.rpc_resolve_activity_application_v1(u,ev);
  if got->>'kind'<>'APPLICATION' or got->>'responseId'<>response_id::text or got->>'needId'<>n::text then raise exception 'PUSH_PROOF_OWNER_TARGET:%',got;end if;
  if public.rpc_resolve_activity_application_v1(u,extensions.gen_random_uuid())->>'kind'<>'UNAVAILABLE' then raise exception 'PUSH_PROOF_UNKNOWN_EVENT';end if;
  begin perform public.rpc_resolve_activity_application_v1(worker,ev);raise exception 'PUSH_PROOF_WRONG_EXPECTED';exception when sqlstate '28000' then null;end;
  execute format('set local role %I',auth_role);
  perform set_config('request.jwt.claim.sub',worker::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',worker,'role','authenticated','session_id',wsid)::text,true);
  execute 'set local role authenticated';
  if public.rpc_resolve_activity_application_v1(worker,ev)->>'kind'<>'UNAVAILABLE' then raise exception 'PUSH_PROOF_FOREIGN_EVENT';end if;
  execute format('set local role %I',auth_role);
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',wsid)::text,true);
  execute 'set local role authenticated';
  begin perform public.rpc_resolve_activity_application_v1(u,ev);raise exception 'PUSH_PROOF_SWITCHED_SESSION';exception when sqlstate '28000' then null;end;
  execute format('set local role %I',auth_role);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',sid)::text,true);
  begin
   update public.notification_deliveries set state='SUPPRESSED',suppression_reason='QA_ROLLBACK_ONLY' where event_id=ev and channel='IN_APP';
   execute 'set local role authenticated';
   if public.rpc_resolve_activity_application_v1(u,ev)->>'kind'<>'UNAVAILABLE' then raise exception 'PUSH_PROOF_SUPPRESSED';end if;
   execute format('set local role %I',auth_role);
   raise sqlstate 'ZP004';
  exception when sqlstate 'ZP004' then null;end;
  begin
   update public.user_activity_events set entity_version=2 where id=ev;
   execute 'set local role authenticated';
   if public.rpc_resolve_activity_application_v1(u,ev)->>'kind'<>'UNAVAILABLE' then raise exception 'PUSH_PROOF_VERSION';end if;
   execute format('set local role %I',auth_role);
   raise sqlstate 'ZP004';
  exception when sqlstate 'ZP004' then null;end;
  begin
   update public.user_activity_events set payload=jsonb_set(payload,'{needId}',to_jsonb(extensions.gen_random_uuid()::text)) where id=ev;
   execute 'set local role authenticated';
   if public.rpc_resolve_activity_application_v1(u,ev)->>'kind'<>'UNAVAILABLE' then raise exception 'PUSH_PROOF_PAYLOAD';end if;
   execute format('set local role %I',auth_role);
   raise sqlstate 'ZP004';
  exception when sqlstate 'ZP004' then null;end;
  begin
   update public.marketplace_responses set status='WITHDRAWN' where id=response_id;
   execute 'set local role authenticated';
   if public.rpc_resolve_activity_application_v1(u,ev)->>'kind'<>'UNAVAILABLE' then raise exception 'PUSH_PROOF_WITHDRAWN';end if;
   execute format('set local role %I',auth_role);
   raise sqlstate 'ZP004';
  exception when sqlstate 'ZP004' then null;end;
  begin
   update public.marketplace_responses set status='STALE' where id=response_id;
   execute 'set local role authenticated';
   if public.rpc_resolve_activity_application_v1(u,ev)->>'kind'<>'UNAVAILABLE' then raise exception 'PUSH_PROOF_STALE';end if;
   execute format('set local role %I',auth_role);
   raise sqlstate 'ZP004';
  exception when sqlstate 'ZP004' then null;end;
  begin
   perform public.rpc_cancel_need(n,1,'PUSH rollback proof');
   execute 'set local role authenticated';
   if public.rpc_resolve_activity_application_v1(u,ev)->>'kind'<>'UNAVAILABLE' then raise exception 'PUSH_PROOF_CANCELLED';end if;
   execute format('set local role %I',auth_role);
   raise sqlstate 'ZP004';
  exception when sqlstate 'ZP004' then null;end;
  begin
   insert into private.account_closure_requests(account_id,state,revision) values(u,'READY',1);
   execute 'set local role authenticated';
   if public.rpc_resolve_activity_application_v1(u,ev)->>'kind'<>'UNAVAILABLE' then raise exception 'PUSH_PROOF_OWNER_CLOSURE';end if;
   execute format('set local role %I',auth_role);
   raise sqlstate 'ZP004';
  exception when sqlstate 'ZP004' then null;end;
  begin
   insert into private.account_closure_requests(account_id,state,revision) values(worker,'READY',1);
   execute 'set local role authenticated';
   if public.rpc_resolve_activity_application_v1(u,ev)->>'kind'<>'UNAVAILABLE' then raise exception 'PUSH_PROOF_WORKER_CLOSURE';end if;
   execute format('set local role %I',auth_role);
   raise sqlstate 'ZP004';
  exception when sqlstate 'ZP004' then null;end;
  execute 'set local role authenticated';
  if public.rpc_resolve_activity_application_v1(u,ev)->>'kind'<>'APPLICATION' then raise exception 'PUSH_PROOF_RESTORE';end if;
  execute format('set local role %I',auth_role);
  raise sqlstate 'ZP005';
 exception when sqlstate 'ZP005' then null;end;
 if exists(select 1 from auth.users where id in(u,worker)) then raise exception 'PUSH_PROOF_FIXTURES_REMAIN';end if;
end;$proof$;
