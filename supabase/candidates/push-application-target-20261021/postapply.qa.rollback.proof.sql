-- SOURCE ONLY / NOT RUN. psql proof after candidate.sql, against disposable QA accounts.
-- Every mutation is inside one transaction and an explicit ROLLBACK. No PUSH row,
-- push attempt, transport RPC, Expo provider, or device token is touched.
-- Required -v values: dev_ref_attested=leqcwgzvjsxugfgzdmth,
-- qa_rollback_attested=true, owner_id, owner_session_id, foreign_id,
-- foreign_session_id, event_id. The event must be a current SELECTABLE QA response.
-- Use a dedicated DB connection; psql exits on every error, closing/rolling back it.
\set ON_ERROR_STOP on
\if :{?dev_ref_attested}
\else
  \echo PUSH_APPLICATION_DEV_ATTESTATION_REQUIRED
  \quit 3
\endif
\if :{?qa_rollback_attested}
\else
  \echo PUSH_APPLICATION_QA_ATTESTATION_REQUIRED
  \quit 3
\endif
\if :{?owner_id}
\else
  \echo PUSH_APPLICATION_OWNER_ID_REQUIRED
  \quit 3
\endif
\if :{?owner_session_id}
\else
  \echo PUSH_APPLICATION_OWNER_SESSION_REQUIRED
  \quit 3
\endif
\if :{?foreign_id}
\else
  \echo PUSH_APPLICATION_FOREIGN_ID_REQUIRED
  \quit 3
\endif
\if :{?foreign_session_id}
\else
  \echo PUSH_APPLICATION_FOREIGN_SESSION_REQUIRED
  \quit 3
\endif
\if :{?event_id}
\else
  \echo PUSH_APPLICATION_EVENT_ID_REQUIRED
  \quit 3
\endif
select :'dev_ref_attested'='leqcwgzvjsxugfgzdmth'
  and :'qa_rollback_attested'='true' and current_user='postgres'
  and current_database()='postgres' as admitted
\gset
\if :admitted
\else
  \echo PUSH_APPLICATION_QA_DB_ADMISSION_FAILED
  \quit 3
\endif

-- Catalog and fixture checks are read-only. A historical/completed fixture fails
-- admission; create a fresh QA Need and response through canonical RPCs first.
select to_regprocedure('public.rpc_resolve_activity_application_v1(uuid,uuid)') is not null
  and has_function_privilege('authenticated','public.rpc_resolve_activity_application_v1(uuid,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.rpc_resolve_activity_application_v1(uuid,uuid)','EXECUTE')
  and not has_function_privilege('service_role','public.rpc_resolve_activity_application_v1(uuid,uuid)','EXECUTE')
  and (select p.prosecdef and p.provolatile='s' and p.proconfig::text='{search_path=pg_catalog}'
    from pg_proc p where p.oid=to_regprocedure('public.rpc_resolve_activity_application_v1(uuid,uuid)'))
  as resolver_admitted
\gset
\if :resolver_admitted
\else
  \echo PUSH_APPLICATION_RESOLVER_CATALOG_FAILED
  \quit 3
\endif
select exists (
  select 1 from public.user_activity_events e
  join public.marketplace_responses r on r.id=e.entity_id
  join public.needs n on n.id=r.need_id
  join public.marketplace_response_versions rv on rv.response_id=r.id and rv.version=e.entity_version
  join public.notification_deliveries d on d.event_id=e.id and d.channel='IN_APP'
    and d.dedupe_key=e.dedupe_key||':in_app'
    and d.recipient_user_id=:'owner_id'::uuid and d.recipient_role='REQUESTER'
  where e.id=:'event_id'::uuid and e.recipient_user_id=:'owner_id'::uuid
    and e.recipient_role='REQUESTER' and e.entity_type='RESPONSE'
    and e.event_type in ('RESPONSE_RECEIVED','RESPONSE_UPDATED')
    and e.entity_version=r.current_version and rv.need_revision=n.revision
    and ((e.event_type='RESPONSE_RECEIVED' and e.entity_version=1
      and e.dedupe_key='response-received:'||r.id::text||':1')
      or (e.event_type='RESPONSE_UPDATED' and e.entity_version>1
      and e.dedupe_key='response-updated:'||r.id::text||':'||e.entity_version::text))
    and n.requester_account_id=:'owner_id'::uuid and n.status in ('PUBLISHED','SELECTION')
    and r.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
    and r.submitted_against_need_revision=n.revision
    and e.payload->>'needId'=n.id::text and e.payload->>'responseId'=r.id::text
    and e.payload->>'responseVersion'=e.entity_version::text
    and d.state in ('CREATED','SENT','DELIVERED','READ') and d.suppression_reason is null
    and private.accounts_same_world(:'owner_id'::uuid,r.worker_account_id)
    and not private.safety_event_blocked(e)
    and exists (select 1 from private.need_candidate_states_v5(n.id,array[r.id]) c
      where c.response_id=r.id and c.candidate_state='SELECTABLE')
) and :'owner_id'::uuid<>:'foreign_id'::uuid
  and private.push_session_valid(:'owner_id'::uuid,:'owner_session_id'::uuid)
  and private.push_session_valid(:'foreign_id'::uuid,:'foreign_session_id'::uuid)
  and not exists (select 1 from private.account_closure_requests c
    where c.account_id in (:'owner_id'::uuid,:'foreign_id'::uuid,
      (select r.worker_account_id from public.user_activity_events e
       join public.marketplace_responses r on r.id=e.entity_id where e.id=:'event_id'::uuid)))
  as fixture_admitted
\gset
\if :fixture_admitted
\else
  \echo PUSH_APPLICATION_QA_FIXTURE_FAILED
  \quit 3
\endif

begin isolation level repeatable read;
set local lock_timeout='3s';
set local statement_timeout='120s';
select e.event_type as qa_event_type,e.entity_id::text as qa_response_id,
  r.worker_account_id::text as qa_worker_id,n.id::text as qa_need_id
from public.user_activity_events e
join public.marketplace_responses r on r.id=e.entity_id
join public.needs n on n.id=r.need_id where e.id=:'event_id'::uuid
\gset
select 1 as locked from public.user_activity_events where id=:'event_id'::uuid for update;
select 1 as locked from public.notification_deliveries
  where event_id=:'event_id'::uuid and channel='IN_APP' for update;
select 1 as locked from public.marketplace_responses
  where id=:'qa_response_id'::uuid for update;
select 1 as locked from public.needs where id=:'qa_need_id'::uuid for update;
select extensions.gen_random_uuid()::text as absent_event_id
\gset

-- These temporary helpers are SECURITY INVOKER. Each resolver call below runs
-- under the selected authenticated role and live QA session claims.
create temporary table push_application_proof_marker(x boolean) on commit drop;
create function pg_temp.actor(account_id uuid,session_id uuid)
returns void language plpgsql security invoker set search_path=pg_catalog as $f$
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',account_id,
    'role','authenticated','session_id',session_id)::text,true);
  perform set_config('request.jwt.claim.sub',account_id::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
end;
$f$;
create function pg_temp.expect_json(got jsonb,want jsonb,label text)
returns void language plpgsql security invoker set search_path=pg_catalog as $f$
begin
  if got is distinct from want then
    raise exception 'PUSH_APPLICATION_QA_PROOF_FAILED: %',label;
  end if;
end;
$f$;
create function pg_temp.expect_sqlstate(expected_user uuid,event_id uuid,want_code text,label text)
returns void language plpgsql security invoker set search_path=pg_catalog as $f$
declare actual_code text;
begin
  begin
    perform public.rpc_resolve_activity_application_v1(expected_user,event_id);
  exception when others then
    get stacked diagnostics actual_code=returned_sqlstate;
    if actual_code=want_code then return; end if;
    raise exception 'PUSH_APPLICATION_QA_PROOF_WRONG_SQLSTATE: % (%)',label,actual_code;
  end;
  raise exception 'PUSH_APPLICATION_QA_PROOF_MISSING_SQLSTATE: %',label;
end;
$f$;
do $grant_temp$
begin
  execute format('grant usage on schema %I to authenticated',
    (select nspname from pg_namespace where oid=pg_my_temp_schema()));
end;
$grant_temp$;
revoke all on function pg_temp.actor(uuid,uuid),
  pg_temp.expect_json(jsonb,jsonb,text),
  pg_temp.expect_sqlstate(uuid,uuid,text,text) from public,anon,service_role;
revoke all on function pg_temp.actor(uuid,uuid) from authenticated;
grant execute on function pg_temp.expect_json(jsonb,jsonb,text),
  pg_temp.expect_sqlstate(uuid,uuid,text,text) to authenticated;

-- Current owner: exact opaque event -> exact response and Need.
select pg_temp.actor(:'owner_id'::uuid,:'owner_session_id'::uuid);
set local role authenticated;
select pg_temp.expect_json(
  public.rpc_resolve_activity_application_v1(:'owner_id'::uuid,:'event_id'::uuid),
  jsonb_build_object('schema','ACTIVITY_APPLICATION_TARGET_V1','accountId',:'owner_id'::uuid,
    'kind','APPLICATION','eventId',:'event_id'::uuid,'eventType',:'qa_event_type',
    'needId',:'qa_need_id'::uuid,'responseId',:'qa_response_id'::uuid,
    'role','REQUESTER','authoritative',true),'OWNER_EXACT_CURRENT');
select pg_temp.expect_json(
  public.rpc_resolve_activity_application_v1(:'owner_id'::uuid,:'absent_event_id'::uuid),
  jsonb_build_object('schema','ACTIVITY_APPLICATION_TARGET_V1','accountId',:'owner_id'::uuid,
    'kind','UNAVAILABLE','authoritative',true),'UNKNOWN_EVENT_UNAVAILABLE');
select pg_temp.expect_sqlstate(:'foreign_id'::uuid,:'event_id'::uuid,'28000',
  'WRONG_EXPECTED_ACCOUNT_DENIED');
reset role;

-- Foreign owner cannot resolve another owner's event.
select pg_temp.actor(:'foreign_id'::uuid,:'foreign_session_id'::uuid);
set local role authenticated;
select pg_temp.expect_json(
  public.rpc_resolve_activity_application_v1(:'foreign_id'::uuid,:'event_id'::uuid),
  jsonb_build_object('schema','ACTIVITY_APPLICATION_TARGET_V1','accountId',:'foreign_id'::uuid,
    'kind','UNAVAILABLE','authoritative',true),'FOREIGN_OWNER_UNAVAILABLE');
reset role;

-- A real owner UUID with the foreign actor's live session is still invalid.
select pg_temp.actor(:'owner_id'::uuid,:'foreign_session_id'::uuid);
set local role authenticated;
select pg_temp.expect_sqlstate(:'owner_id'::uuid,:'event_id'::uuid,'28000',
  'STALE_OR_SWITCHED_SESSION_DENIED');
reset role;

-- Suppressed IN_APP delivery cannot authorize a target. Savepoint restores it.
savepoint suppressed_in_app;
update public.notification_deliveries set state='SUPPRESSED',
  suppression_reason='QA_ROLLBACK_ONLY' where event_id=:'event_id'::uuid and channel='IN_APP';
select pg_temp.actor(:'owner_id'::uuid,:'owner_session_id'::uuid);
set local role authenticated;
select pg_temp.expect_json(
  public.rpc_resolve_activity_application_v1(:'owner_id'::uuid,:'event_id'::uuid),
  jsonb_build_object('schema','ACTIVITY_APPLICATION_TARGET_V1','accountId',:'owner_id'::uuid,
    'kind','UNAVAILABLE','authoritative',true),'SUPPRESSED_IN_APP_UNAVAILABLE');
reset role;
rollback to savepoint suppressed_in_app;

-- An event version ahead of the persisted current response cannot resolve.
savepoint version_mismatch;
update public.user_activity_events e set entity_version=r.current_version+1
from public.marketplace_responses r
where e.id=:'event_id'::uuid and r.id=e.entity_id;
select pg_temp.actor(:'owner_id'::uuid,:'owner_session_id'::uuid);
set local role authenticated;
select pg_temp.expect_json(
  public.rpc_resolve_activity_application_v1(:'owner_id'::uuid,:'event_id'::uuid),
  jsonb_build_object('schema','ACTIVITY_APPLICATION_TARGET_V1','accountId',:'owner_id'::uuid,
    'kind','UNAVAILABLE','authoritative',true),'VERSION_MISMATCH_UNAVAILABLE');
reset role;
rollback to savepoint version_mismatch;

-- Event/Need payload mismatch also fails even though ownership still matches.
savepoint payload_mismatch;
update public.user_activity_events set payload=jsonb_set(payload,'{needId}',
  to_jsonb(:'absent_event_id'::text)) where id=:'event_id'::uuid;
select pg_temp.actor(:'owner_id'::uuid,:'owner_session_id'::uuid);
set local role authenticated;
select pg_temp.expect_json(
  public.rpc_resolve_activity_application_v1(:'owner_id'::uuid,:'event_id'::uuid),
  jsonb_build_object('schema','ACTIVITY_APPLICATION_TARGET_V1','accountId',:'owner_id'::uuid,
    'kind','UNAVAILABLE','authoritative',true),'CHANGED_NEED_PAYLOAD_UNAVAILABLE');
reset role;
rollback to savepoint payload_mismatch;

-- Withdrawn response is historical Inbox content, never an exact live landing.
savepoint withdrawn_response;
update public.marketplace_responses set status='WITHDRAWN'
  where id=:'qa_response_id'::uuid;
select pg_temp.actor(:'owner_id'::uuid,:'owner_session_id'::uuid);
set local role authenticated;
select pg_temp.expect_json(
  public.rpc_resolve_activity_application_v1(:'owner_id'::uuid,:'event_id'::uuid),
  jsonb_build_object('schema','ACTIVITY_APPLICATION_TARGET_V1','accountId',:'owner_id'::uuid,
    'kind','UNAVAILABLE','authoritative',true),'WITHDRAWN_RESPONSE_UNAVAILABLE');
reset role;
rollback to savepoint withdrawn_response;

-- A stale response may remain in historical Inbox but has no exact target.
savepoint stale_response;
update public.marketplace_responses set status='STALE'
  where id=:'qa_response_id'::uuid;
select pg_temp.actor(:'owner_id'::uuid,:'owner_session_id'::uuid);
set local role authenticated;
select pg_temp.expect_json(
  public.rpc_resolve_activity_application_v1(:'owner_id'::uuid,:'event_id'::uuid),
  jsonb_build_object('schema','ACTIVITY_APPLICATION_TARGET_V1','accountId',:'owner_id'::uuid,
    'kind','UNAVAILABLE','authoritative',true),'STALE_RESPONSE_UNAVAILABLE');
reset role;
rollback to savepoint stale_response;

-- Closed Need uses the existing server lifecycle token, only within rollback.
savepoint closed_need;
select set_config('uskoci.need_lifecycle','CANCEL_NEED',true);
update public.needs set status='CANCELLED' where id=:'qa_need_id'::uuid;
select pg_temp.actor(:'owner_id'::uuid,:'owner_session_id'::uuid);
set local role authenticated;
select pg_temp.expect_json(
  public.rpc_resolve_activity_application_v1(:'owner_id'::uuid,:'event_id'::uuid),
  jsonb_build_object('schema','ACTIVITY_APPLICATION_TARGET_V1','accountId',:'owner_id'::uuid,
    'kind','UNAVAILABLE','authoritative',true),'CLOSED_NEED_UNAVAILABLE');
reset role;
rollback to savepoint closed_need;

-- Either account entering closure removes the exact target. These rows vanish
-- at their savepoint rollback and never execute a closure action.
savepoint owner_closure;
insert into private.account_closure_requests(account_id,state,revision)
values(:'owner_id'::uuid,'READY',1);
select pg_temp.actor(:'owner_id'::uuid,:'owner_session_id'::uuid);
set local role authenticated;
select pg_temp.expect_json(
  public.rpc_resolve_activity_application_v1(:'owner_id'::uuid,:'event_id'::uuid),
  jsonb_build_object('schema','ACTIVITY_APPLICATION_TARGET_V1','accountId',:'owner_id'::uuid,
    'kind','UNAVAILABLE','authoritative',true),'OWNER_CLOSURE_UNAVAILABLE');
reset role;
rollback to savepoint owner_closure;

savepoint worker_closure;
insert into private.account_closure_requests(account_id,state,revision)
values(:'qa_worker_id'::uuid,'READY',1);
select pg_temp.actor(:'owner_id'::uuid,:'owner_session_id'::uuid);
set local role authenticated;
select pg_temp.expect_json(
  public.rpc_resolve_activity_application_v1(:'owner_id'::uuid,:'event_id'::uuid),
  jsonb_build_object('schema','ACTIVITY_APPLICATION_TARGET_V1','accountId',:'owner_id'::uuid,
    'kind','UNAVAILABLE','authoritative',true),'WORKER_CLOSURE_UNAVAILABLE');
reset role;
rollback to savepoint worker_closure;

-- Prove all savepoints restored the original SELECTABLE target before rollback.
select pg_temp.actor(:'owner_id'::uuid,:'owner_session_id'::uuid);
set local role authenticated;
select pg_temp.expect_json(
  public.rpc_resolve_activity_application_v1(:'owner_id'::uuid,:'event_id'::uuid),
  jsonb_build_object('schema','ACTIVITY_APPLICATION_TARGET_V1','accountId',:'owner_id'::uuid,
    'kind','APPLICATION','eventId',:'event_id'::uuid,'eventType',:'qa_event_type',
    'needId',:'qa_need_id'::uuid,'responseId',:'qa_response_id'::uuid,
    'role','REQUESTER','authoritative',true),'OWNER_STILL_EXACT_AFTER_SAVEPOINTS');
reset role;

rollback;
\echo PUSH_APPLICATION_QA_PROOF_PASS_ROLLED_BACK
