-- Positive admission and idempotency. All IDs and data are synthetically fabricated.
do $$
declare
 response jsonb;
 admission uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 params record;
begin
 -- The eligibility expiry was seeded as now()+1h; request only 10m.
 response:=private.admit_push_opportunity_single_target_v1(
 admission,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111',
 '44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',7,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 now()+interval '10 minutes',now()+interval '11 minutes');
 if response->>'kind'<>'ADMITTED' then raise exception 'ONE_TARGET_NOT_ADMITTED_%',response;end if;
 if (select count(*) from public.notification_push_attempts)<>1
  or (select single_target_admission->>'eventType' from public.notification_push_attempts where id=admission)<>'OPPORTUNITY_AVAILABLE'
 then raise exception 'ONE_TARGET_LEDGER_NOT_EXACT';end if;
end $$;
-- Revalidate that an unrelated event or changed revision cannot be admitted.
-- We do not execute actual provider calls, claim, send or global dispatch.
do $$
declare result jsonb;
begin
 begin
  result:=private.admit_push_opportunity_single_target_v1(
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   '11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   7,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()+interval '10 minutes',now()+interval '11 minutes');
  raise exception 'UNRELATED_EVENT_NOT_REJECTED';
 exception when sqlstate 'PT409' then null;
 end;
 if (select count(*) from public.notification_push_attempts)<>1
 then raise exception 'SECOND_ATTEMPT_INSERTED';end if;
end $$;
do $$
begin
 if has_function_privilege('anon','private.admit_push_opportunity_single_target_v1(uuid,uuid,uuid,uuid,uuid,uuid,bigint,uuid,timestamptz,timestamptz)','EXECUTE')
 or has_function_privilege('authenticated','private.admit_push_opportunity_single_target_v1(uuid,uuid,uuid,uuid,uuid,uuid,bigint,uuid,timestamptz,timestamptz)','EXECUTE')
 or has_function_privilege('service_role','private.admit_push_opportunity_single_target_v1(uuid,uuid,uuid,uuid,uuid,uuid,bigint,uuid,timestamptz,timestamptz)','EXECUTE')
 then raise exception 'OPERATOR_PRIVILEGE_LEAK';end if;
end $$;
select 'DISPOSABLE_ONE_TARGET_ADMISSION_PASS' as proof;
