-- Claim and begin are synthetic; no provider call is ever made.
update public.notification_push_attempts
set transport_state='SEND_LEASED',lease_id='ffffffff-ffff-4fff-8fff-ffffffffffff',
 lease_until=now()+interval '30 minutes',single_target_claimed_at=now()
where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
do $$
declare s jsonb;
begin
 s:=public.rpc_begin_push_send('cccccccc-cccc-4ccc-8ccc-cccccccccccc','ffffffff-ffff-4fff-8fff-ffffffffffff');
 if s->>'kind'<>'SEND' or s->>'eventType'<>'OPPORTUNITY_AVAILABLE'
  or s->>'eventId'<>'44444444-4444-4444-8444-444444444444'
  or s->>'expoPushToken'<>'ExpoPushToken[synthetic]'
  or (select send_count from public.notification_push_attempts where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc')<>1
 then raise exception 'EXACT_BEGIN_SEND_MISMATCH_%',s;end if;
end $$;
-- A Need revised AFTER the operator's approval must never yield a token or event.
update public.needs set revision=2 where id='55555555-5555-4555-8555-555555555555';
update public.notification_push_attempts
set transport_state='SEND_LEASED',send_count=0,lease_id='ffffffff-ffff-4fff-8fff-ffffffffffff',
 lease_until=now()+interval '30 minutes'
where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
do $$
declare s jsonb;
begin
 s:=public.rpc_begin_push_send('cccccccc-cccc-4ccc-8ccc-cccccccccccc','ffffffff-ffff-4fff-8fff-ffffffffffff');
 if s->>'kind'<>'SUPPRESSED'
  or (select transport_state from public.notification_push_attempts where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc')<>'SUPPRESSED'
 then raise exception 'REVISED_NEED_WAS_SENT_%',s;end if;
end $$;
select 'DISPOSABLE_BEGIN_SEND_AND_REVISED_REFUSAL_PASS' as proof;
