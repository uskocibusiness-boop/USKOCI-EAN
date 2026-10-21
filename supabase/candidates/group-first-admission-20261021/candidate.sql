-- GRP01: first-ever group admission may read prior group history.
-- No pre-existing membership is backfilled; no repeat/unblock/rejoin grant.
do $preimage$ begin
 if md5(pg_get_functiondef('private.group_sync_agreement_v5(public.agreements)'::regprocedure))
  <> '64ad67305cac32741c5c08a1925e7aab' then
  raise exception 'GRP01_SYNC_PREIMAGE_CHANGED';
 end if;
 if md5(pg_get_functiondef('public.rpc_send_group_message_v5(uuid,uuid,uuid,text)'::regprocedure))<>'8c91547c0d0111f8e069383b1944a1fa'
  or md5(pg_get_functiondef('public.rpc_read_group_messages_v5(uuid,uuid,text,text)'::regprocedure))<>'944e9683f66c3b0bfc29d3f7106de695'
  or md5(pg_get_functiondef('private.closure_account_restricted(uuid)'::regprocedure))<>'9ce14bacf456210147ba14235d7ba8de'
  or md5(pg_get_functiondef('private.safety_pair_blocked(uuid,uuid)'::regprocedure))<>'5a4787a7d82ab8dea576c27b5e47d87a'
  or md5(pg_get_functiondef('private.closure_account_key(uuid)'::regprocedure))<>'29116ea6e982cecd3242354a20faa3fd'
  or md5(pg_get_functiondef('private.safety_pair_key(uuid,uuid)'::regprocedure))<>'91b4ed6d5559355868c60924f0f7cb40'
  or md5(pg_get_functiondef('private.group_member_v5(private.group_conversations_v5,uuid)'::regprocedure))<>'daa065d23b1ef0db2e39f9606fda2f1a'
  or md5(pg_get_functiondef('private.group_can_send_v5(private.group_conversations_v5,uuid)'::regprocedure))<>'3ba1a952ff1d5f3689ab04025f07d765'
  then raise exception 'GRP01_BARRIER_OR_READ_SEND_CONTRACT_CHANGED';end if;
 if has_function_privilege('authenticated','private.group_sync_agreement_v5(public.agreements)','EXECUTE')
  or has_function_privilege('anon','private.group_sync_agreement_v5(public.agreements)','EXECUTE')
  then raise exception 'GRP01_PRIVATE_ADMISSION_EXPOSED';end if;
end $preimage$;

CREATE OR REPLACE FUNCTION private.group_sync_agreement_v5(a public.agreements)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare g private.group_conversations_v5;n public.needs;first_account_admission boolean;admitted uuid;r uuid;
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
  -- The group row serializes first admission with sends and all later admissions.
  -- A prior membership for ANY agreement consumes the one-time history grant.
  first_account_admission:=not exists(select 1 from private.group_memberships_v5
   where group_id=g.id and account_id=a.worker_account_id);
  insert into private.group_memberships_v5(group_id,agreement_id,account_id,profile_id,joined_sequence)
   values(g.id,a.id,a.worker_account_id,a.worker_profile_id,g.sequence+1)
   on conflict(agreement_id) do nothing returning agreement_id into admitted;
  if first_account_admission and admitted is not null then
   -- Same shared closure/safety barriers as group send; the exclusive barrier
   -- owners never take group/domain row locks. Recheck eligibility AFTER locks.
   -- Grant omissions are final even if the person is subsequently unblocked.
   for r in select a.worker_account_id
    union select g.requester_account_id
    union select sender_account_id from private.group_messages_v5 where group_id=g.id
    order by 1 loop
    perform pg_advisory_xact_lock_shared(private.closure_account_key(r));
    if r<>a.worker_account_id then
     perform pg_advisory_xact_lock_shared(private.safety_pair_key(a.worker_account_id,r));
    end if;
   end loop;
   if not private.closure_account_restricted(a.worker_account_id)
    and not private.closure_account_restricted(g.requester_account_id)
    and not private.safety_pair_blocked(a.worker_account_id,g.requester_account_id) then
    insert into private.group_message_visibility_v5(message_id,account_id,read_at)
    select m.id,a.worker_account_id,null from private.group_messages_v5 m
     where m.group_id=g.id and m.sequence<=g.sequence
      and not private.closure_account_restricted(m.sender_account_id)
      and (m.sender_account_id=a.worker_account_id
       or not private.safety_pair_blocked(a.worker_account_id,m.sender_account_id))
    on conflict(message_id,account_id) do nothing;
   end if;
  end if;
 end if;
end $function$
;

comment on table private.group_message_visibility_v5 is 'Immutable per-message recipient admission. First-ever group admission grants eligible existing history once. Missing grants are never backfilled after unblock or rejoin. Read markers do not create visibility.';

