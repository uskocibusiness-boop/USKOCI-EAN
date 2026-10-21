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

