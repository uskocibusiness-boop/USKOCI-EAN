-- PREPARED ONLY. Source candidate; do not apply to DEV/PROD without a fresh readback.
-- The only transport change is an opaque event UUID for response notifications.
-- Read-only DEV audit on 2026-10-21: begin MD5 380a2f203da2a7ad344bd80f061abd13.
-- Its existing MESSAGE_RECEIVED + OPPORTUNITY_AVAILABLE event-ID branch is preserved.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table push_application_begin_preflight on commit drop as
 select prosrc as body, proacl::text as acl, prosecdef as secdef,
        provolatile as volatility, proconfig::text as settings
 from pg_proc where oid = 'public.rpc_begin_push_send(uuid,uuid)'::regprocedure;
do $preflight$
declare needle text := 'case when v_event_type in (''MESSAGE_RECEIVED'',''OPPORTUNITY_AVAILABLE'')';
begin
 if (select count(*) from push_application_begin_preflight) <> 1
    or (select md5(body) from push_application_begin_preflight) is distinct from '380a2f203da2a7ad344bd80f061abd13'
    or (select acl from push_application_begin_preflight) is distinct from '{postgres=X/postgres,service_role=X/postgres}'
    or (select secdef from push_application_begin_preflight) is distinct from true
    or (select volatility from push_application_begin_preflight) is distinct from 'v'
    or (select settings from push_application_begin_preflight) is distinct from '{search_path=pg_catalog}'
    or (select (length(body)-length(replace(body,needle,'')))/length(needle)
        from push_application_begin_preflight) <> 1
 then raise exception 'PUSH_APPLICATION_BEGIN_PREDECESSOR_DRIFT' using errcode='PT409'; end if;
 if to_regprocedure('public.rpc_resolve_activity_application_v1(uuid,uuid)') is not null
 then raise exception 'PUSH_APPLICATION_RESOLVER_ALREADY_EXISTS' using errcode='PT409'; end if;
 if (select md5(prosrc) from pg_proc
     where oid=to_regprocedure('private.need_candidate_states_v5(uuid,uuid[])'))
       is distinct from 'c47d3658e94a82474c1d408f7ee23888'
    or (select proacl::text from pg_proc
      where oid=to_regprocedure('private.need_candidate_states_v5(uuid,uuid[])'))
        is distinct from '{postgres=X/postgres}'
    or (select prosecdef from pg_proc
      where oid=to_regprocedure('private.need_candidate_states_v5(uuid,uuid[])')) is distinct from true
    or (select provolatile from pg_proc
      where oid=to_regprocedure('private.need_candidate_states_v5(uuid,uuid[])')) is distinct from 's'
    or (select proconfig::text from pg_proc
      where oid=to_regprocedure('private.need_candidate_states_v5(uuid,uuid[])'))
        is distinct from '{search_path=pg_catalog}'
 then raise exception 'PUSH_APPLICATION_CANDIDATE_STATE_DRIFT' using errcode='PT409'; end if;
end;
$preflight$;

do $begin_patch$
declare definition text; needle text := 'case when v_event_type in (''MESSAGE_RECEIVED'',''OPPORTUNITY_AVAILABLE'')';
begin
 definition := pg_get_functiondef('public.rpc_begin_push_send(uuid,uuid)'::regprocedure);
 execute replace(definition,needle,
   'case when v_event_type in (''MESSAGE_RECEIVED'',''OPPORTUNITY_AVAILABLE'',''RESPONSE_RECEIVED'',''RESPONSE_UPDATED'')');
end;
$begin_patch$;

do $postflight$
declare b push_application_begin_preflight%rowtype; a record;
 needle text := 'case when v_event_type in (''MESSAGE_RECEIVED'',''OPPORTUNITY_AVAILABLE'')';
begin
 select * into b from push_application_begin_preflight;
 select prosrc as body, proacl::text as acl, prosecdef as secdef,
        provolatile as volatility, proconfig::text as settings into a
 from pg_proc where oid='public.rpc_begin_push_send(uuid,uuid)'::regprocedure;
 if a.body is null
   or md5(a.body) is distinct from md5(replace(b.body,needle,
     'case when v_event_type in (''MESSAGE_RECEIVED'',''OPPORTUNITY_AVAILABLE'',''RESPONSE_RECEIVED'',''RESPONSE_UPDATED'')'))
   or (a.acl,a.secdef,a.volatility,a.settings) is distinct from
      (b.acl,b.secdef,b.volatility,b.settings)
 then raise exception 'PUSH_APPLICATION_BEGIN_POSTFLIGHT_INVALID' using errcode='PT409'; end if;
end;
$postflight$;

-- A push event ID has no navigation authority. Check the active Auth session,
-- recipient, in-app delivery, event/version/payload, owned Need and response.
create function public.rpc_resolve_activity_application_v1(p_expected_user_id uuid,p_event_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path to 'pg_catalog'
as $function$
declare
 u uuid := private.support_auth_v5(p_expected_user_id);
 v_need uuid;
 v_response uuid;
 v_worker uuid;
 v_type text;
 unavailable jsonb := jsonb_build_object('schema','ACTIVITY_APPLICATION_TARGET_V1',
   'accountId',u,'kind','UNAVAILABLE','authoritative',true);
begin
 select n.id,r.id,r.worker_account_id,e.event_type
 into v_need,v_response,v_worker,v_type
 from public.user_activity_events e
 join public.marketplace_responses r on r.id=e.entity_id
 join public.needs n on n.id=r.need_id
 join public.marketplace_response_versions rv on rv.response_id=r.id and rv.version=e.entity_version
 join public.notification_deliveries d on d.event_id=e.id
   and d.recipient_user_id=u and d.recipient_role='REQUESTER'
   and d.channel='IN_APP' and d.dedupe_key=e.dedupe_key||':in_app'
 where e.id=p_event_id and e.recipient_user_id=u and e.recipient_role='REQUESTER'
   and e.event_type in ('RESPONSE_RECEIVED','RESPONSE_UPDATED')
   and e.entity_type='RESPONSE' and e.entity_version>0
   and e.entity_version=r.current_version
   and rv.need_revision=n.revision
   and ((e.event_type='RESPONSE_RECEIVED' and e.entity_version=1
      and e.dedupe_key='response-received:'||r.id::text||':1')
    or (e.event_type='RESPONSE_UPDATED' and e.entity_version>1
      and e.dedupe_key='response-updated:'||r.id::text||':'||e.entity_version::text))
   and e.payload->>'needId'=n.id::text
   and e.payload->>'responseId'=r.id::text
   and e.payload->>'responseVersion'=e.entity_version::text
   and n.requester_account_id=u and r.worker_account_id<>u
   and n.status in ('PUBLISHED','SELECTION')
   and r.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
   and r.submitted_against_need_revision=n.revision
   and d.state in ('CREATED','SENT','DELIVERED','READ') and d.suppression_reason is null
   and private.accounts_same_world(u,r.worker_account_id)
   and not private.safety_event_blocked(e)
   and exists (select 1 from private.need_candidate_states_v5(n.id,array[r.id]) c
     where c.response_id=r.id and c.candidate_state='SELECTABLE')
 limit 1;
 if not found then
   perform private.support_auth_v5(u);
   return unavailable;
 end if;
 begin
   perform private.closure_assert_open(u,v_worker);
 exception when sqlstate '42501' then
   perform private.support_auth_v5(u);
   return unavailable;
 end;
 perform private.support_auth_v5(u);
 return jsonb_build_object('schema','ACTIVITY_APPLICATION_TARGET_V1',
   'accountId',u,'kind','APPLICATION','eventId',p_event_id,'eventType',v_type,
   'needId',v_need,'responseId',v_response,'role','REQUESTER','authoritative',true);
end;
$function$;
revoke all on function public.rpc_resolve_activity_application_v1(uuid,uuid) from public,anon,service_role;
grant execute on function public.rpc_resolve_activity_application_v1(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';

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

commit;

