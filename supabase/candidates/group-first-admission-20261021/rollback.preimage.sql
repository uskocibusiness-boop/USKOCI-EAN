-- GRP01 rollback restores future admission behavior; existing read grants cannot be unread.
CREATE OR REPLACE FUNCTION private.group_sync_agreement_v5(a agreements)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare g private.group_conversations_v5;n public.needs;
begin
 select * into g from private.group_conversations_v5 where need_id=a.need_id for update;
 if not found then
  -- A single worker bringing several people still has the existing private
  -- Agreement. The shared conversation starts with two independently selected
  -- accounts. There is no earlier group history to grant retroactively.
  select * into n from public.needs where id=a.need_id;
  if (select count(distinct worker_account_id) from public.agreements where need_id=a.need_id and status<>'CANCELLED')<2 then return;end if;
  insert into private.group_conversations_v5(need_id,requester_account_id) values(n.id,n.requester_account_id)
   on conflict(need_id) do nothing;
  select * into g from private.group_conversations_v5 where need_id=a.need_id for update;
  insert into private.group_memberships_v5(group_id,agreement_id,account_id,profile_id,joined_sequence)
   select g.id,x.id,x.worker_account_id,x.worker_profile_id,g.sequence+1 from public.agreements x
   where x.need_id=a.need_id and x.status<>'CANCELLED' on conflict(agreement_id) do nothing;
 end if;
 if a.status='CANCELLED' then
  update private.group_memberships_v5 set ended_sequence=g.sequence,ended_at=clock_timestamp()
   where agreement_id=a.id and ended_sequence is null;
 else
  insert into private.group_memberships_v5(group_id,agreement_id,account_id,profile_id,joined_sequence)
   values(g.id,a.id,a.worker_account_id,a.worker_profile_id,g.sequence+1) on conflict(agreement_id) do nothing;
 end if;
end $function$
;
comment on table private.group_message_visibility_v5 is 'Immutable per-message recipient admission. Missing grants are never backfilled after unblock or rejoin. Read markers do not create visibility.';

