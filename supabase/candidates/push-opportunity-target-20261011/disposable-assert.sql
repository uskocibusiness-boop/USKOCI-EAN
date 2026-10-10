-- All results below are checked by the database, not inferred from psql exit.
-- Set the target role before the first call; the function's owner is synthetic postgres.
set role authenticated;
select set_config('test.uid','11111111-1111-4111-8111-111111111111',false);
do $$
declare v jsonb;
begin
 v:=public.rpc_resolve_activity_opportunity_v1('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444');
 if v->>'kind'<>'OPPORTUNITY' or v->>'needId'<>'55555555-5555-4555-8555-555555555555'
  or v->>'eventId'<>'44444444-4444-4444-8444-444444444444'
  or v->>'role'<>'WORKER' or v->>'authoritative'<>'true'
  or (select count(*) from jsonb_object_keys(v))<>7 then raise exception 'VALID_TARGET_MISMATCH %',v;end if;
 if (public.rpc_resolve_activity_opportunity_v1('11111111-1111-4111-8111-111111111111',
   '99999999-9999-4999-8999-999999999999')->>'kind')<>'UNAVAILABLE'
 then raise exception 'UNKNOWN_EVENT_ADMITTED'; end if;
 begin
  perform public.rpc_resolve_activity_opportunity_v1('22222222-2222-4222-8222-222222222222',
   '44444444-4444-4444-8444-444444444444');
  raise exception 'FOREIGN_IDENTITY_ADMITTED';
 exception when sqlstate '28000' then null;
 end;
end $$;
reset role;
-- Each refusal must return UNAVAILABLE, not a guessed nearby task.
create function private.expect_unavailable(label text) returns void language plpgsql as $$
begin
 if (public.rpc_resolve_activity_opportunity_v1('11111111-1111-4111-8111-111111111111',
 '44444444-4444-4444-8444-444444444444')->>'kind')<>'UNAVAILABLE'
 then raise exception 'WRONG_ADMISSION_%',label; end if;
end $$;
grant execute on function private.expect_unavailable(text) to authenticated;
set role authenticated;
-- Changes are made only to synthetic disposable rows. As account role, grant
-- DML in this fixture to exercise concurrency state changes; live RLS is NOT claimed.
reset role;
grant update on public.user_activity_events,public.opportunity_deliveries,public.needs,public.notification_deliveries,public.app_profiles,private.account_worlds to authenticated;
set role authenticated;
update public.user_activity_events set event_type='MESSAGE_RECEIVED';select private.expect_unavailable('WRONG_EVENT_TYPE');
update public.user_activity_events set event_type='OPPORTUNITY_AVAILABLE',entity_version=2;select private.expect_unavailable('STALE_EVENT_REVISION');
update public.user_activity_events set entity_version=1,dedupe_key='spoof';select private.expect_unavailable('WRONG_DEDUPE');
update public.user_activity_events set dedupe_key='opp:55555555-5555-4555-8555-555555555555:1:11111111-1111-4111-8111-111111111111';
update public.opportunity_deliveries set status='DECLINED';select private.expect_unavailable('DECLINED');
update public.opportunity_deliveries set status='READY',expires_at=now()-interval '1 second';select private.expect_unavailable('EXPIRED_DELIVERY');
update public.opportunity_deliveries set expires_at=now()+interval '1 hour';
update public.notification_deliveries set suppression_reason='CATEGORY_OFF';select private.expect_unavailable('SUPPRESSED_INAPP');
update public.notification_deliveries set suppression_reason=null,state='SUPPRESSED';select private.expect_unavailable('CLOSED_INAPP');
update public.notification_deliveries set state='CREATED';
update public.needs set revision=2;select private.expect_unavailable('CHANGED_TASK_REVISION');
update public.needs set revision=1,status='CANCELLED';select private.expect_unavailable('CLOSED_TASK');
update public.needs set status='PUBLISHED',requester_account_id='11111111-1111-4111-8111-111111111111';select private.expect_unavailable('OWN_TASK');
update public.needs set requester_account_id='33333333-3333-4333-8333-333333333333';select private.expect_unavailable('OTHER_WORLD');
update public.needs set requester_account_id='22222222-2222-4222-8222-222222222222';
update public.app_profiles set profile_status='SUSPENDED';select private.expect_unavailable('SUSPENDED');
update public.app_profiles set profile_status='ACTIVE';
select set_config('test.blocked','true',false);select private.expect_unavailable('SAFETY');
select set_config('test.blocked','false',false);
select set_config('test.closing','true',false);select private.expect_unavailable('CLOSURE');
select set_config('test.closing','false',false);
do $$
begin
 if (public.rpc_resolve_activity_opportunity_v1('11111111-1111-4111-8111-111111111111',
 '44444444-4444-4444-8444-444444444444')->>'kind')<>'OPPORTUNITY'
 then raise exception 'VALID_AFTER_REFUSALS_FAILED';end if;
end $$;
reset role;
-- The function is not callable by anonymous users or PUBLIC.
do $$
begin
 if has_function_privilege('anon','public.rpc_resolve_activity_opportunity_v1(uuid,uuid)','EXECUTE')
 or not has_function_privilege('authenticated','public.rpc_resolve_activity_opportunity_v1(uuid,uuid)','EXECUTE')
 then raise exception 'EXECUTE_GRANT_MISMATCH'; end if;
end $$;
select 'DISPOSABLE_OPPORTUNITY_RESOLVER_PASS' as proof;
