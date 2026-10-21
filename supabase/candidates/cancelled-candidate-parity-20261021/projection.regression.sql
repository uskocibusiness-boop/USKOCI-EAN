-- CCP01: rollback-only projection regression on a disposable, current-schema DB.
-- Requires forward.sql to have been manually applied on a verified disposable clone. The seed
-- uses replica mode only for historical fixture rows; all RPC reads and the
-- cancellation use origin mode and authenticated/anon SQL roles.
\set ON_ERROR_STOP on
begin;

do $preflight$
declare
  sig text;
  def text;
begin
  foreach sig in array array[
    'private.need_candidate_states_v5(uuid)',
    'private.need_candidate_states_v5(uuid,uuid[])'
  ] loop
    def := pg_get_functiondef(to_regprocedure(sig));
    if def is null or def not like '%where a.selected_response_id=r.id and a.status<>''CANCELLED'') as has_agreement%' then
      raise exception 'CCP01_CANDIDATE_NOT_APPLIED: %', sig;
    end if;
    if has_function_privilege('authenticated',sig,'EXECUTE')
       or has_function_privilege('anon',sig,'EXECUTE') then
      raise exception 'CCP01_PRIVATE_HELPER_EXPOSED: %', sig;
    end if;
  end loop;
  if not has_function_privilege('authenticated','public.rpc_list_need_candidates(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.rpc_list_need_candidates_page(uuid,integer,timestamp with time zone,uuid)','EXECUTE')
     or has_function_privilege('anon','public.rpc_list_need_candidates(uuid)','EXECUTE')
     or has_function_privilege('anon','public.rpc_list_need_candidates_page(uuid,integer,timestamp with time zone,uuid)','EXECUTE') then
    raise exception 'CCP01_READER_ACL_DRIFT';
  end if;
end
$preflight$;

create function pg_temp.ccp_candidate_for(p_rows jsonb, p_id uuid)
returns jsonb language sql stable as $$
  select value from jsonb_array_elements(p_rows) e(value)
  where e.value->>'responseId'=p_id::text limit 1
$$;

create function pg_temp.ccp_check_readers(p_cancel_state text, p_remaining integer, p_replaced boolean)
returns void language plpgsql as $$
declare
  nid uuid := current_setting('uskoci.ccp_need')::uuid;
  old_id uuid := current_setting('uskoci.ccp_b')::uuid;
  ids uuid[] := array[
    current_setting('uskoci.ccp_a')::uuid,
    old_id,
    current_setting('uskoci.ccp_c')::uuid,
    current_setting('uskoci.ccp_d')::uuid
  ];
  all_rows jsonb := public.rpc_list_need_candidates(nid);
  page jsonb := public.rpc_list_need_candidates_page(nid,10,null,null);
  items jsonb;
  id uuid;
  whole jsonb;
  paged jsonb;
  expected text;
begin
  items := page->'items';
  if jsonb_typeof(all_rows)<>'array' or jsonb_array_length(all_rows)<>4
     or jsonb_typeof(items)<>'array' or jsonb_array_length(items)<>4 then
    raise exception 'CCP01_READER_COUNT: all=%, page=%',all_rows,page;
  end if;
  foreach id in array ids loop
    whole := pg_temp.ccp_candidate_for(all_rows,id);
    paged := pg_temp.ccp_candidate_for(items,id);
    if whole is null or paged is null or whole->>'state' is distinct from paged->>'state'
       or whole->>'canSelect' is distinct from paged->>'canSelect'
       or (whole->>'remainingSlots')::integer is distinct from p_remaining
       or (paged->>'remainingSlots')::integer is distinct from p_remaining then
      raise exception 'CCP01_READER_PARITY: id=%, whole=%, page=%',id,whole,paged;
    end if;
    expected := case
      when id=old_id then p_cancel_state
      when id=current_setting('uskoci.ccp_d')::uuid and p_replaced then 'SELECTED'
      when id=current_setting('uskoci.ccp_d')::uuid then null
      else 'SELECTED'
    end;
    if expected is not null and (whole->>'state') is distinct from expected then
      raise exception 'CCP01_STATE: id=%, expected=%, got=%',id,expected,whole;
    end if;
    if expected in ('CLOSED','SELECTED') and (whole->>'canSelect')::boolean is distinct from false then
      raise exception 'CCP01_ACTION_LEAK: id=%, state=%',id,whole;
    end if;
  end loop;
end
$$;

-- Synthetic historical rows are inserted with triggers suppressed, following
-- the existing PKG-042 and RU-5 disposable proof fixture pattern.
set local session_replication_role=replica;
do $seed$
declare
  owner_id uuid := extensions.gen_random_uuid();
  outsider_id uuid := extensions.gen_random_uuid();
  wa uuid := extensions.gen_random_uuid();
  wb uuid := extensions.gen_random_uuid();
  wc uuid := extensions.gen_random_uuid();
  wd uuid := extensions.gen_random_uuid();
  owner_pid uuid := extensions.gen_random_uuid();
  outsider_pid uuid := extensions.gen_random_uuid();
  pa uuid := extensions.gen_random_uuid();
  pb uuid := extensions.gen_random_uuid();
  pc uuid := extensions.gen_random_uuid();
  pd uuid := extensions.gen_random_uuid();
  nid uuid := extensions.gen_random_uuid();
  ra uuid := extensions.gen_random_uuid();
  rb uuid := extensions.gen_random_uuid();
  rc uuid := extensions.gen_random_uuid();
  rd uuid := extensions.gen_random_uuid();
  sa uuid := extensions.gen_random_uuid();
  sb uuid := extensions.gen_random_uuid();
  sc uuid := extensions.gen_random_uuid();
  aa uuid := extensions.gen_random_uuid();
  ab uuid := extensions.gen_random_uuid();
  ac uuid := extensions.gen_random_uuid();
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (owner_id,'authenticated','authenticated','ccp-owner-'||owner_id||'@proof.invalid',statement_timestamp(),statement_timestamp()),
    (outsider_id,'authenticated','authenticated','ccp-other-'||outsider_id||'@proof.invalid',statement_timestamp(),statement_timestamp()),
    (wa,'authenticated','authenticated','ccp-wa-'||wa||'@proof.invalid',statement_timestamp(),statement_timestamp()),
    (wb,'authenticated','authenticated','ccp-wb-'||wb||'@proof.invalid',statement_timestamp(),statement_timestamp()),
    (wc,'authenticated','authenticated','ccp-wc-'||wc||'@proof.invalid',statement_timestamp(),statement_timestamp()),
    (wd,'authenticated','authenticated','ccp-wd-'||wd||'@proof.invalid',statement_timestamp(),statement_timestamp());
  insert into public.app_accounts(id,email) values
    (owner_id,'ccp-owner-'||owner_id||'@proof.invalid'),
    (outsider_id,'ccp-other-'||outsider_id||'@proof.invalid'),
    (wa,'ccp-wa-'||wa||'@proof.invalid'),
    (wb,'ccp-wb-'||wb||'@proof.invalid'),
    (wc,'ccp-wc-'||wc||'@proof.invalid'),
    (wd,'ccp-wd-'||wd||'@proof.invalid');
  insert into public.app_profiles(id,account_id,kind,profile_status,display_name,city,skills) values
    (owner_pid,owner_id,'REQUESTER','ACTIVE','CCP Owner','Novi Sad','{}'::text[]),
    (outsider_pid,outsider_id,'REQUESTER','ACTIVE','CCP Other','Novi Sad','{}'::text[]),
    (pa,wa,'WORKER','ACTIVE','CCP Worker A','Novi Sad',array['Proof']),
    (pb,wb,'WORKER','ACTIVE','CCP Worker B','Novi Sad',array['Proof']),
    (pc,wc,'WORKER','ACTIVE','CCP Worker C','Novi Sad',array['Proof']),
    (pd,wd,'WORKER','ACTIVE','CCP Worker D','Novi Sad',array['Proof']);
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,
    category,approximate_city,mode,required_slots,schedule_kind,revision,response_deadline,published_at)
  values(nid,owner_id,owner_pid,'SELECTION','CCP three person task','Disposable projection fixture',
    'PROOF','Novi Sad','OFFERS',3,'FLEXIBLE',1,statement_timestamp()+interval '2 days',statement_timestamp());
  insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,
    status,submitted_against_need_revision,current_version,covered_slots,price_rsd,submitted_at) values
    (ra,nid,wa,pa,'OFFER','SELECTED',1,1,1,1000,statement_timestamp()-interval '4 minutes'),
    (rb,nid,wb,pb,'OFFER','SELECTED',1,1,1,1000,statement_timestamp()-interval '3 minutes'),
    (rc,nid,wc,pc,'OFFER','SELECTED',1,1,1,1000,statement_timestamp()-interval '2 minutes'),
    (rd,nid,wd,pd,'OFFER','SUBMITTED',1,1,1,1000,statement_timestamp()-interval '1 minute');
  insert into public.marketplace_response_versions(response_id,version,need_revision,covered_slots,price_rsd,content_hash) values
    (ra,1,1,1,1000,repeat('a',64)),(rb,1,1,1,1000,repeat('b',64)),
    (rc,1,1,1,1000,repeat('c',64)),(rd,1,1,1,1000,repeat('d',64));
  insert into public.need_selections(id,need_id,need_revision,selected_by_account_id,client_request_id,
    covered_slots,response_id,worker_account_id,worker_profile_id,selection_mode,status) values
    (sa,nid,1,owner_id,sa,1,ra,wa,pa,'REQUESTER_SELECTS','SELECTED'),
    (sb,nid,1,owner_id,sb,1,rb,wb,pb,'REQUESTER_SELECTS','SELECTED'),
    (sc,nid,1,owner_id,sc,1,rc,wc,pc,'REQUESTER_SELECTS','SELECTED');
  insert into public.agreements(id,need_id,selection_id,selected_response_id,requester_account_id,
    requester_profile_id,worker_account_id,worker_profile_id,status) values
    (aa,nid,sa,ra,owner_id,owner_pid,wa,pa,'CONFIRMED'),
    (ab,nid,sb,rb,owner_id,owner_pid,wb,pb,'CONFIRMED'),
    (ac,nid,sc,rc,owner_id,owner_pid,wc,pc,'CONFIRMED');
  insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id) values
    (aa,1,'CONFIRMED','{"price_rsd":1000,"covered_slots":1}',repeat('a',64),owner_id),
    (ab,1,'CONFIRMED','{"price_rsd":1000,"covered_slots":1}',repeat('b',64),owner_id),
    (ac,1,'CONFIRMED','{"price_rsd":1000,"covered_slots":1}',repeat('c',64),owner_id);
  insert into public.agreement_execution(agreement_id,agreement_version,state) values
    (aa,1,'CONFIRMED'),(ab,1,'CONFIRMED'),(ac,1,'CONFIRMED');
  perform set_config('uskoci.ccp_need',nid::text,true);
  perform set_config('uskoci.ccp_owner',owner_id::text,true);
  perform set_config('uskoci.ccp_other',outsider_id::text,true);
  perform set_config('uskoci.ccp_worker_b',wb::text,true);
  perform set_config('uskoci.ccp_worker_d',wd::text,true);
  perform set_config('uskoci.ccp_a',ra::text,true);
  perform set_config('uskoci.ccp_b',rb::text,true);
  perform set_config('uskoci.ccp_c',rc::text,true);
  perform set_config('uskoci.ccp_d',rd::text,true);
  perform set_config('uskoci.ccp_agreement_b',ab::text,true);
  perform set_config('uskoci.ccp_owner_pid',owner_pid::text,true);
  perform set_config('uskoci.ccp_worker_d_pid',pd::text,true);
end
$seed$;
set local session_replication_role=origin;
do $initial_slots$
begin
  if public.fn_need_covered_slots(current_setting('uskoci.ccp_need')::uuid) is distinct from 3 then
    raise exception 'CCP01_INITIAL_SLOTS_NOT_THREE';
  end if;
end
$initial_slots$;

-- The owner sees the historical 3/3, and no other account can read the task.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ccp_owner'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.ccp_owner'),'role','authenticated')::text,true);
select pg_temp.ccp_check_readers('SELECTED',0,false);
reset role;

-- This is the real cancellation RPC. Its response/selection/Agreement writes
-- must be atomic, release one slot, and retain the historical Agreement row.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ccp_worker_b'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.ccp_worker_b'),'role','authenticated')::text,true);
select public.rpc_cancel_agreement(current_setting('uskoci.ccp_agreement_b')::uuid,'CCP disposable cancellation');
reset role;
do $after_cancel$
declare
  nid uuid := current_setting('uskoci.ccp_need')::uuid;
  rid uuid := current_setting('uskoci.ccp_b')::uuid;
  aid uuid := current_setting('uskoci.ccp_agreement_b')::uuid;
begin
  if (select status from public.agreements where id=aid) is distinct from 'CANCELLED'
     or (select status from public.need_selections where id=(select selection_id from public.agreements where id=aid)) is distinct from 'CANCELLED'
     or (select status from public.marketplace_responses where id=rid) is distinct from 'NOT_SELECTED'
     or public.fn_need_covered_slots(nid) is distinct from 2 then
    raise exception 'CCP01_CANCELLATION_NOT_ATOMIC_OR_SEAT_NOT_RELEASED';
  end if;
end
$after_cancel$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ccp_owner'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.ccp_owner'),'role','authenticated')::text,true);
select pg_temp.ccp_check_readers('CLOSED',1,false);
reset role;

-- The canceled worker's own list must agree with the owner's closed state.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ccp_worker_b'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.ccp_worker_b'),'role','authenticated')::text,true);
do $worker_cancelled$
declare
  items jsonb := public.rpc_list_my_applications();
begin
  if jsonb_typeof(items)<>'array' or jsonb_array_length(items)<>1
     or items->0->>'state' is distinct from 'CLOSED' then
    raise exception 'CCP01_WORKER_CANCELLED_STATE: %',items;
  end if;
end
$worker_cancelled$;
reset role;

-- Synthetic replacement row isolates the candidate-reader regression. This
-- is deliberately NOT evidence that rpc_select_response accepts worker D.
set local session_replication_role=replica;
do $replace$
declare
  nid uuid := current_setting('uskoci.ccp_need')::uuid;
  rid uuid := current_setting('uskoci.ccp_d')::uuid;
  owner_id uuid := current_setting('uskoci.ccp_owner')::uuid;
  worker_id uuid := current_setting('uskoci.ccp_worker_d')::uuid;
  sid uuid := extensions.gen_random_uuid();
  aid uuid := extensions.gen_random_uuid();
begin
  update public.marketplace_responses set status='SELECTED' where id=rid;
  insert into public.need_selections(id,need_id,need_revision,selected_by_account_id,client_request_id,
    covered_slots,response_id,worker_account_id,worker_profile_id,selection_mode,status)
  values(sid,nid,1,owner_id,sid,1,rid,worker_id,current_setting('uskoci.ccp_worker_d_pid')::uuid,
    'REQUESTER_SELECTS','SELECTED');
  insert into public.agreements(id,need_id,selection_id,selected_response_id,requester_account_id,
    requester_profile_id,worker_account_id,worker_profile_id,status)
  values(aid,nid,sid,rid,owner_id,current_setting('uskoci.ccp_owner_pid')::uuid,
    worker_id,current_setting('uskoci.ccp_worker_d_pid')::uuid,'CONFIRMED');
  insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
  values(aid,1,'CONFIRMED','{"price_rsd":1000,"covered_slots":1}',repeat('d',64),owner_id);
  insert into public.agreement_execution(agreement_id,agreement_version,state) values(aid,1,'CONFIRMED');
end
$replace$;
set local session_replication_role=origin;
do $restored_slots$
begin
  if public.fn_need_covered_slots(current_setting('uskoci.ccp_need')::uuid) is distinct from 3 then
    raise exception 'CCP01_REPLACEMENT_DID_NOT_RESTORE_THREE_SLOTS';
  end if;
end
$restored_slots$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ccp_owner'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.ccp_owner'),'role','authenticated')::text,true);
select pg_temp.ccp_check_readers('CLOSED',0,true);
reset role;

-- Another owner and an anonymous caller cannot inspect either owner reader.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ccp_other'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.ccp_other'),'role','authenticated')::text,true);
do $other_owner$
declare
  nid uuid := current_setting('uskoci.ccp_need')::uuid;
begin
  begin
    perform public.rpc_list_need_candidates(nid);
    raise exception 'CCP01_OTHER_OWNER_LEGACY_ALLOWED';
  exception when others then
    if sqlerrm<>'NOT_REQUESTER' then raise; end if;
  end;
  begin
    perform public.rpc_list_need_candidates_page(nid,10,null,null);
    raise exception 'CCP01_OTHER_OWNER_PAGE_ALLOWED';
  exception when others then
    if sqlerrm<>'NOT_REQUESTER' then raise; end if;
  end;
end
$other_owner$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
do $anonymous$
declare
  nid uuid := current_setting('uskoci.ccp_need')::uuid;
begin
  begin
    perform public.rpc_list_need_candidates(nid);
    raise exception 'CCP01_ANON_LEGACY_ALLOWED';
  exception when others then
    if sqlstate<>'42501' then raise; end if;
  end;
  begin
    perform public.rpc_list_need_candidates_page(nid,10,null,null);
    raise exception 'CCP01_ANON_PAGE_ALLOWED';
  exception when others then
    if sqlstate<>'42501' then raise; end if;
  end;
end
$anonymous$;
reset role;

\echo PASS CCP01 3of3-to-2of3-to-3of3 owner-list-and-page canceled-history worker-parity other-owner-and-anon rollback-only
rollback;
