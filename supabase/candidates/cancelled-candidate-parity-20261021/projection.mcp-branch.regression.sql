-- CCP01 MCP BRANCH ONLY / SOURCE TEMPLATE. Never send this to a default project.
-- Replace both __CCP01_BRANCH_*__ tokens and __CCP01_PROOF_NONCE__ from the
-- SAME freshly identified disposable
-- branch, then send this entire payload in ONE execute_sql call with that branch's
-- project_ref. Raw placeholders fail closed. This SQL never applies forward.sql.
-- The branch must be data-less, current-schema, and have forward.sql already applied.
-- No psql directives or session_replication_role; fixture rows roll back.
begin;

do $branch_target$
declare
  branch_ref constant text := '__CCP01_BRANCH_PROJECT_REF__';
  expected_system_id constant text := '__CCP01_BRANCH_SYSTEM_IDENTIFIER__';
  proof_nonce constant text := '__CCP01_PROOF_NONCE__';
  actual_system_id text;
begin
  -- Clear a marker left by an interrupted earlier call before any guard may
  -- raise. A reused backend cannot turn that earlier marker into this PASS.
  while pg_catalog.pg_advisory_unlock(
      pg_catalog.hashtextextended(branch_ref || ':' || proof_nonce,20261021)) loop
    null;
  end loop;
  if branch_ref !~ '^[a-z0-9]{20}$'
     or branch_ref = 'leqcwgzvjsxugfgzdmth'
     or expected_system_id !~ '^[0-9]+$'
     or proof_nonce !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
     or current_user <> 'postgres'
     or current_database() <> 'postgres' then
    raise exception 'CCP01_NOT_IDENTIFIED_DISPOSABLE_BRANCH';
  end if;
  select system_identifier::text into actual_system_id
    from pg_catalog.pg_control_system();
  if actual_system_id is distinct from expected_system_id then
    raise exception 'CCP01_BRANCH_SYSTEM_IDENTIFIER_MISMATCH';
  end if;
  if exists(select 1 from auth.users)
     or exists(select 1 from public.app_accounts)
     or exists(select 1 from public.app_profiles)
     or exists(select 1 from public.needs)
     or exists(select 1 from public.marketplace_responses)
     or exists(select 1 from public.marketplace_response_versions)
     or exists(select 1 from public.need_selections)
     or exists(select 1 from public.agreements)
     or exists(select 1 from public.agreement_versions)
     or exists(select 1 from public.agreement_execution) then
    raise exception 'CCP01_BRANCH_NOT_DATALESS';
  end if;
  if not exists(
    select 1 from pg_catalog.pg_trigger
    where tgrelid='auth.users'::regclass
      and tgname='on_uskoci_auth_user_created'
      and not tgisinternal and tgenabled in ('O','A')
  ) then
    raise exception 'CCP01_AUTH_INSERT_HOOK_MISSING_OR_DISABLED';
  end if;
end
$branch_target$;

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
      when id=current_setting('uskoci.ccp_d')::uuid and p_remaining=0 then 'CLOSED'
      when id=current_setting('uskoci.ccp_d')::uuid then null
      else 'SELECTED'
    end;
    if id=current_setting('uskoci.ccp_d')::uuid and not p_replaced
       and whole->>'state'='SELECTED' then
      raise exception 'CCP01_UNCHOSEN_WORKER_SELECTED: %',whole;
    end if;
    if expected is not null and (whole->>'state') is distinct from expected then
      raise exception 'CCP01_STATE: id=%, expected=%, got=%',id,expected,whole;
    end if;
    if expected in ('CLOSED','SELECTED') and (whole->>'canSelect')::boolean is distinct from false then
      raise exception 'CCP01_ACTION_LEAK: id=%, state=%',id,whole;
    end if;
  end loop;
end
$$;

-- Snapshot each user trigger's mode. DISABLE TRIGGER USER preserves FK/internal
-- constraint triggers. The auth.users hook stays enabled throughout.
create temp table ccp_trigger_snapshot(
  schema_name text not null,
  table_name text not null,
  trigger_name name not null,
  enabled text not null,
  primary key(schema_name,table_name,trigger_name)
) on commit drop;
insert into pg_temp.ccp_trigger_snapshot(schema_name,table_name,trigger_name,enabled)
select n.nspname,c.relname,t.tgname,t.tgenabled::text
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid=t.tgrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal
  and t.tgrelid=any(array[
    'public.app_accounts'::regclass,'public.app_profiles'::regclass,
    'public.needs'::regclass,'public.marketplace_responses'::regclass,
    'public.marketplace_response_versions'::regclass,
    'public.need_selections'::regclass,'public.agreements'::regclass,
    'public.agreement_versions'::regclass,'public.agreement_execution'::regclass
  ]);

create function pg_temp.ccp_fixture_triggers(p_suppress boolean)
returns void language plpgsql as $$
declare
  tbl regclass;
  item record;
  verb text;
begin
  if p_suppress then
    foreach tbl in array array[
      'public.app_accounts'::regclass,'public.app_profiles'::regclass,
      'public.needs'::regclass,'public.marketplace_responses'::regclass,
      'public.marketplace_response_versions'::regclass,
      'public.need_selections'::regclass,'public.agreements'::regclass,
      'public.agreement_versions'::regclass,'public.agreement_execution'::regclass
    ] loop
      execute format('alter table %s disable trigger user',tbl);
    end loop;
    if exists(
      select 1 from pg_temp.ccp_trigger_snapshot s
      join pg_catalog.pg_trigger t
        on t.tgrelid=to_regclass(format('%I.%I',s.schema_name,s.table_name))
       and t.tgname=s.trigger_name
      where t.tgenabled<>'D'
    ) then
      raise exception 'CCP01_USER_TRIGGER_SUPPRESSION_FAILED';
    end if;
  else
    for item in select * from pg_temp.ccp_trigger_snapshot where enabled<>'D' loop
      verb := case item.enabled
        when 'O' then 'enable'
        when 'A' then 'enable always'
        when 'R' then 'enable replica'
        else null end;
      if verb is null then
        raise exception 'CCP01_UNKNOWN_TRIGGER_MODE: %',item.enabled;
      end if;
      execute format('alter table %I.%I %s trigger %I',
        item.schema_name,item.table_name,verb,item.trigger_name);
    end loop;
    if exists(
      select 1 from pg_temp.ccp_trigger_snapshot s
      left join pg_catalog.pg_trigger t
        on t.tgrelid=to_regclass(format('%I.%I',s.schema_name,s.table_name))
       and t.tgname=s.trigger_name
      where t.oid is null or t.tgenabled::text is distinct from s.enabled
    ) then
      raise exception 'CCP01_USER_TRIGGER_RESTORE_FAILED';
    end if;
  end if;
end
$$;

-- Let the real Auth insert hook create the accounts and both profile kinds.
do $auth_seed$
declare
  owner_id uuid := extensions.gen_random_uuid();
  outsider_id uuid := extensions.gen_random_uuid();
  wa uuid := extensions.gen_random_uuid();
  wb uuid := extensions.gen_random_uuid();
  wc uuid := extensions.gen_random_uuid();
  wd uuid := extensions.gen_random_uuid();
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (owner_id,'authenticated','authenticated','ccp-owner-'||owner_id||'@proof.invalid',statement_timestamp(),statement_timestamp()),
    (outsider_id,'authenticated','authenticated','ccp-other-'||outsider_id||'@proof.invalid',statement_timestamp(),statement_timestamp()),
    (wa,'authenticated','authenticated','ccp-wa-'||wa||'@proof.invalid',statement_timestamp(),statement_timestamp()),
    (wb,'authenticated','authenticated','ccp-wb-'||wb||'@proof.invalid',statement_timestamp(),statement_timestamp()),
    (wc,'authenticated','authenticated','ccp-wc-'||wc||'@proof.invalid',statement_timestamp(),statement_timestamp()),
    (wd,'authenticated','authenticated','ccp-wd-'||wd||'@proof.invalid',statement_timestamp(),statement_timestamp());
  if (select count(*) from public.app_accounts
      where id=any(array[owner_id,outsider_id,wa,wb,wc,wd]))<>6
     or (select count(*) from public.app_profiles
      where account_id=any(array[owner_id,outsider_id,wa,wb,wc,wd]))<>12
     or (select count(*) from public.app_profiles
      where account_id=any(array[owner_id,outsider_id,wa,wb,wc,wd])
        and kind='REQUESTER')<>6
     or (select count(*) from public.app_profiles
      where account_id=any(array[owner_id,outsider_id,wa,wb,wc,wd])
        and kind='WORKER')<>6 then
    raise exception 'CCP01_AUTH_HOOK_DID_NOT_CREATE_EXPECTED_ACCOUNTS_PROFILES';
  end if;
  perform set_config('uskoci.ccp_owner',owner_id::text,true);
  perform set_config('uskoci.ccp_other',outsider_id::text,true);
  perform set_config('uskoci.ccp_wa',wa::text,true);
  perform set_config('uskoci.ccp_worker_b',wb::text,true);
  perform set_config('uskoci.ccp_wc',wc::text,true);
  perform set_config('uskoci.ccp_worker_d',wd::text,true);
end
$auth_seed$;

-- Synthetic business rows are inserted with user triggers suppressed and
-- FK triggers still active. The exact prior trigger modes are restored before
-- the authenticated RPC calls.
select pg_temp.ccp_fixture_triggers(true);
do $seed$
declare
  owner_id uuid := current_setting('uskoci.ccp_owner')::uuid;
  outsider_id uuid := current_setting('uskoci.ccp_other')::uuid;
  wa uuid := current_setting('uskoci.ccp_wa')::uuid;
  wb uuid := current_setting('uskoci.ccp_worker_b')::uuid;
  wc uuid := current_setting('uskoci.ccp_wc')::uuid;
  wd uuid := current_setting('uskoci.ccp_worker_d')::uuid;
  owner_pid uuid;
  outsider_pid uuid;
  pa uuid;
  pb uuid;
  pc uuid;
  pd uuid;
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
  select id into strict owner_pid from public.app_profiles
    where account_id=owner_id and kind='REQUESTER';
  select id into strict outsider_pid from public.app_profiles
    where account_id=outsider_id and kind='REQUESTER';
  select id into strict pa from public.app_profiles where account_id=wa and kind='WORKER';
  select id into strict pb from public.app_profiles where account_id=wb and kind='WORKER';
  select id into strict pc from public.app_profiles where account_id=wc and kind='WORKER';
  select id into strict pd from public.app_profiles where account_id=wd and kind='WORKER';
  update public.app_profiles set profile_status='ACTIVE',display_name='CCP Owner',
    city='Novi Sad',skills='{}'::text[] where id=owner_pid;
  update public.app_profiles set profile_status='ACTIVE',display_name='CCP Other',
    city='Novi Sad',skills='{}'::text[] where id=outsider_pid;
  update public.app_profiles set profile_status='ACTIVE',display_name='CCP Worker A',
    city='Novi Sad',skills=array['Proof'] where id=pa;
  update public.app_profiles set profile_status='ACTIVE',display_name='CCP Worker B',
    city='Novi Sad',skills=array['Proof'] where id=pb;
  update public.app_profiles set profile_status='ACTIVE',display_name='CCP Worker C',
    city='Novi Sad',skills=array['Proof'] where id=pc;
  update public.app_profiles set profile_status='ACTIVE',display_name='CCP Worker D',
    city='Novi Sad',skills=array['Proof'] where id=pd;
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,
    category,approximate_city,mode,required_slots,schedule_kind,revision,response_deadline,published_at)
  values(nid,owner_id,owner_pid,'ACTIVE','CCP three person task','Disposable projection fixture',
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
select pg_temp.ccp_fixture_triggers(false);
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
     or public.fn_need_covered_slots(nid) is distinct from 2
     or (select status from public.needs where id=nid) is distinct from 'SELECTION' then
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
select pg_temp.ccp_fixture_triggers(true);
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
  update public.needs set status='ACTIVE' where id=nid;
end
$replace$;
select pg_temp.ccp_fixture_triggers(false);
do $restored_slots$
begin
  if public.fn_need_covered_slots(current_setting('uskoci.ccp_need')::uuid) is distinct from 3
     or (select status from public.needs where id=current_setting('uskoci.ccp_need')::uuid) is distinct from 'ACTIVE' then
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

-- A fresh per-invocation nonce makes a prior run's session lock unusable as a
-- marker for this one. The lock survives ROLLBACK; only this invocation's
-- completed assertions may make the final SELECT report PASS.
do $proof_complete$
begin
  if not pg_catalog.pg_try_advisory_lock(
      pg_catalog.hashtextextended('__CCP01_BRANCH_PROJECT_REF__:__CCP01_PROOF_NONCE__',20261021)) then
    raise exception 'CCP01_PROOF_MARKER_LOCK_UNAVAILABLE';
  end if;
end
$proof_complete$;
rollback;

select case when marker.released
  and not exists(select 1 from auth.users)
  and not exists(select 1 from public.app_accounts)
  and not exists(select 1 from public.app_profiles)
  and not exists(select 1 from public.needs)
  and not exists(select 1 from public.marketplace_responses)
  and not exists(select 1 from public.marketplace_response_versions)
  and not exists(select 1 from public.need_selections)
  and not exists(select 1 from public.agreements)
  and not exists(select 1 from public.agreement_versions)
  and not exists(select 1 from public.agreement_execution)
  then 'PASS CCP01 MCP branch 3of3-to-2of3-to-synthetic-3of3; fixture rolled back'
  else 'FAIL CCP01 MCP branch marker-or-rollback-residue' end as result
from (select pg_catalog.pg_advisory_unlock(
  pg_catalog.hashtextextended('__CCP01_BRANCH_PROJECT_REF__:__CCP01_PROOF_NONCE__',20261021)) as released) marker;
