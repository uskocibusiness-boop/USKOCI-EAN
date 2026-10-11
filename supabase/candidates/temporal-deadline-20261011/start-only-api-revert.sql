-- USKOČI start-only task APIs: EXACT REVERT; CANDIDATE ONLY, NOT APPLIED.
-- Exactly seven existing RPCs; no tables/data/cron/provider writes.
-- One atomic PostgreSQL transaction with fail-closed source AND ACL/security checks.
-- Needs separate matching-time and search-deadline candidates to complete the release.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';
DO $preflight$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.rpc_save_need_draft_from_review(uuid,uuid,text)'::regprocedure
   AND md5(p.prosrc)='559c9d81ee97caec2ccd9ec19b3e95ca' AND p.prosecdef=true
   AND p.provolatile='v' AND p.proparallel='u'
   AND coalesce(p.proacl::text,'')='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
   AND coalesce(p.proconfig::text,'')='{search_path=pg_catalog}') THEN
     RAISE EXCEPTION 'START_ONLY_API_SOURCE_OR_PRIVILEGES_DRIFT: start-only-save.candidate.sql' USING errcode='PT409';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)'::regprocedure
   AND md5(p.prosrc)='8a94e2b748485f0850e477369c3de3d2' AND p.prosecdef=true
   AND p.provolatile='v' AND p.proparallel='u'
   AND coalesce(p.proacl::text,'')='{postgres=X/postgres}'
   AND coalesce(p.proconfig::text,'')='{search_path=pg_catalog}') THEN
     RAISE EXCEPTION 'START_ONLY_API_SOURCE_OR_PRIVILEGES_DRIFT: start-only-edit.candidate.sql' USING errcode='PT409';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)'::regprocedure
   AND md5(p.prosrc)='a806a327aef2c51a590e614275d67eb1' AND p.prosecdef=true
   AND p.provolatile='v' AND p.proparallel='u'
   AND coalesce(p.proacl::text,'')='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'
   AND coalesce(p.proconfig::text,'')='{search_path=pg_catalog}') THEN
     RAISE EXCEPTION 'START_ONLY_API_SOURCE_OR_PRIVILEGES_DRIFT: start-only-submit.candidate.sql' USING errcode='PT409';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure
   AND md5(p.prosrc)='ba3d1242fa9a186604d220043a03ec2b' AND p.prosecdef=true
   AND p.provolatile='v' AND p.proparallel='u'
   AND coalesce(p.proacl::text,'')='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
   AND coalesce(p.proconfig::text,'')='{"search_path=public, pg_temp"}') THEN
     RAISE EXCEPTION 'START_ONLY_API_SOURCE_OR_PRIVILEGES_DRIFT: start-only-select.candidate.sql' USING errcode='PT409';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)'::regprocedure
   AND md5(p.prosrc)='5d8e51d8dbb8d92528d794bd83233dd3' AND p.prosecdef=true
   AND p.provolatile='v' AND p.proparallel='u'
   AND coalesce(p.proacl::text,'')='{postgres=X/postgres,authenticated=X/postgres}'
   AND coalesce(p.proconfig::text,'')='{search_path=pg_catalog}') THEN
     RAISE EXCEPTION 'START_ONLY_API_SOURCE_OR_PRIVILEGES_DRIFT: start-only-stale.candidate.sql' USING errcode='PT409';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='private.need_candidate_states_v5(uuid)'::regprocedure
   AND md5(p.prosrc)='2493e693e9ec208c8a4957ca0d8766c6' AND p.prosecdef=true
   AND p.provolatile='s' AND p.proparallel='u'
   AND coalesce(p.proacl::text,'')='{postgres=X/postgres}'
   AND coalesce(p.proconfig::text,'')='{search_path=pg_catalog}') THEN
     RAISE EXCEPTION 'START_ONLY_API_SOURCE_OR_PRIVILEGES_DRIFT: start-only-candidate-states.candidate.sql' USING errcode='PT409';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='private.need_candidate_states_v5(uuid,uuid[])'::regprocedure
   AND md5(p.prosrc)='7765b402fb2f83d20c127a6a5452a593' AND p.prosecdef=true
   AND p.provolatile='s' AND p.proparallel='u'
   AND coalesce(p.proacl::text,'')='{postgres=X/postgres}'
   AND coalesce(p.proconfig::text,'')='{search_path=pg_catalog}') THEN
     RAISE EXCEPTION 'START_ONLY_API_SOURCE_OR_PRIVILEGES_DRIFT: start-only-candidate-states-batch.candidate.sql' USING errcode='PT409';
 END IF;
END $preflight$;
CREATE OR REPLACE FUNCTION public.rpc_save_need_draft_from_review(p_conversation_id uuid, p_requester_profile_id uuid, p_client_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_conv public.ai_conversations%rowtype;
  v_profile public.app_profiles%rowtype;
  v_facts jsonb;
  v_snapshot jsonb;
  v_missing text[];
  v_hash text;
  v_existing private.need_draft_save_commands%rowtype;
  v_need_id uuid;
  v_result jsonb;
  v_title text;
  v_description text;
  v_category text;
  v_mode text;
  v_price integer;
  v_schedule_kind text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_slots integer;
  v_skills text[];
  v_tools text[];
  v_vehicles text[];
  v_licenses text[];
  v_min_exp integer;
  v_verified boolean;
  v_photos text[];
  v_conditions text[];
  v_geo jsonb;
  v_exec_mode text;
  v_start jsonb;
  v_service jsonb;
  v_city text;
  v_area text;
  v_exact_address text;
  v_access_notes text;
  v_key text;
  v_value jsonb;
  v_safety text;
  v_country text; v_timezone text; v_region_token text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_conversation_id is null or p_requester_profile_id is null then raise exception 'DRAFT_IDENTITY_REQUIRED' using errcode='22004'; end if;
  if coalesce(char_length(btrim(p_client_request_id)),0)<8 or char_length(btrim(p_client_request_id))>200 then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';
  end if;

  select * into v_conv
    from public.ai_conversations
   where id=p_conversation_id
   for update;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_conv.purpose<>'NEED_INTAKE' then raise exception 'CONVERSATION_PURPOSE_MISMATCH' using errcode='P0001'; end if;
  if v_conv.fact_schema_version<>'NEED_FACT_V2' then raise exception 'LEGACY_CONVERSATION_NOT_CANONICAL_SAVE_ELIGIBLE' using errcode='P0001'; end if;

  select * into v_profile
    from public.app_profiles
   where id=p_requester_profile_id
   for share;
  if not found or v_profile.account_id<>v_uid or v_profile.kind<>'REQUESTER' or v_profile.profile_status<>'ACTIVE' then
    raise exception 'REQUESTER_PROFILE_NOT_READY' using errcode='42501';
  end if;

  if exists (
    select 1 from public.ai_structured_facts
     where conversation_id=p_conversation_id
       and superseded_at is null
       and fact_schema_version<>'NEED_FACT_V2'
  ) then
    raise exception 'MIXED_SCHEMA_CONVERSATION_NOT_SAVE_ELIGIBLE' using errcode='P0001';
  end if;

  for v_key,v_value in
    select fact_key,fact_value
      from public.ai_structured_facts
     where conversation_id=p_conversation_id
       and superseded_at is null
       and fact_schema_version='NEED_FACT_V2'
       and status='CONFIRMED'
  loop
    perform private.validate_need_v2_fact(v_key,v_value);
  end loop;

  select coalesce(jsonb_object_agg(fact_key,fact_value),'{}'::jsonb)
    into v_facts
    from public.ai_structured_facts
   where conversation_id=p_conversation_id
     and superseded_at is null
     and fact_schema_version='NEED_FACT_V2'
     and status='CONFIRMED';

  select array_agg(r.fact_key order by r.fact_key)
    into v_missing
    from private.need_fact_registry r
   where r.required_for_draft
     and not (v_facts ? r.fact_key);

  if cardinality(coalesce(v_missing,'{}'::text[]))>0 then
    raise exception 'REQUIRED_CONFIRMED_FACTS_MISSING'
      using errcode='P0001',detail=array_to_string(v_missing,',');
  end if;

  v_title:=v_facts->>'need.title';
  v_description:=v_facts->>'need.description';
  v_category:=v_facts->>'need.category';
  v_mode:=v_facts->>'need.price_mode';
  if v_facts ? 'need.price_rsd' then v_price:=(v_facts->>'need.price_rsd')::integer; end if;
  if v_mode='MY_PRICE' and v_price is null then raise exception 'MY_PRICE_AMOUNT_REQUIRED' using errcode='P0001'; end if;
  if v_mode<>'MY_PRICE' then v_price:=null; end if;

  v_schedule_kind:=v_facts->>'need.schedule_kind';
  if v_facts ? 'need.starts_at' then v_starts_at:=(v_facts->>'need.starts_at')::timestamptz; end if;
  if v_facts ? 'need.ends_at' then v_ends_at:=(v_facts->>'need.ends_at')::timestamptz; end if;
  if v_schedule_kind='FIXED_WINDOW' and (v_starts_at is null or v_ends_at is null or v_ends_at<=v_starts_at) then
    raise exception 'FIXED_WINDOW_BOUNDS_REQUIRED' using errcode='P0001';
  end if;

  v_slots:=(v_facts->>'need.people_needed')::integer;

  select coalesce(array_agg(value),'{}'::text[]) into v_skills from jsonb_array_elements_text(coalesce(v_facts->'need.required_skills','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_tools from jsonb_array_elements_text(coalesce(v_facts->'need.required_tools','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_vehicles from jsonb_array_elements_text(coalesce(v_facts->'need.required_vehicles','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_licenses from jsonb_array_elements_text(coalesce(v_facts->'need.required_licenses','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_photos from jsonb_array_elements_text(coalesce(v_facts->'need.public_photo_paths','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_conditions from jsonb_array_elements_text(coalesce(v_facts->'need.critical_conditions','[]'::jsonb));

  if v_facts ? 'need.minimum_experience_years' then v_min_exp:=(v_facts->>'need.minimum_experience_years')::integer; end if;
  v_verified:=case when v_facts ? 'need.verified_identity_required' then (v_facts->>'need.verified_identity_required')::boolean else false end;

  v_country:=private.require_location_country(v_facts->'need.task_country_code');
  select default_timezone into v_timezone from private.location_market_configs where country_code=v_country;
  v_geo:=v_facts->'need.task_geography';
  v_exec_mode:=v_geo->>'mode';
  v_start:=coalesce(v_geo->'start','null'::jsonb);
  v_service:=coalesce(v_geo->'serviceArea','null'::jsonb);
  v_city:=coalesce(nullif(btrim(v_start->>'city'),''),nullif(btrim(v_service->>'city'),''));
  v_area:=coalesce(nullif(btrim(v_start->>'area'),''),nullif(btrim(v_service->>'area'),''));
  if v_exec_mode='REMOTE' then
    v_city:=''; v_area:='';
  end if;

  if v_facts ? 'need.exact_address' then v_exact_address:=v_facts->>'need.exact_address'; end if;
  if v_facts ? 'need.access_notes' then v_access_notes:=v_facts->>'need.access_notes'; end if;

  v_snapshot:=jsonb_build_object(
    'conversationId',p_conversation_id,
    'requesterProfileId',p_requester_profile_id,
    'confirmedFacts',v_facts
  );
  v_hash:=encode(extensions.digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex');

  select * into v_existing
    from private.need_draft_save_commands
   where account_id=v_uid
     and client_request_id=btrim(p_client_request_id)
   for update;

  if found then
    if v_existing.request_hash<>v_hash then
      raise exception 'CLIENT_REQUEST_ID_REUSED_WITH_DIFFERENT_SNAPSHOT' using errcode='22023';
    end if;
    return v_existing.result;
  end if;

  if v_conv.status<>'OPEN' then raise exception 'CONVERSATION_CLOSED' using errcode='P0001'; end if;
  if v_conv.bound_need_id is not null then raise exception 'CONVERSATION_ALREADY_BOUND' using errcode='P0001'; end if;

  if exists(select 1 from public.ai_structured_facts where conversation_id=p_conversation_id
    and superseded_at is null and status<>'CONFIRMED') then
    raise exception 'EDIT_FACTS_REQUIRE_HUMAN_CONFIRMATION' using errcode='P0001';
  end if;

  -- Successful semantic-command replay above remains an acknowledgment only.
  -- For every new DRAFT, recheck safety under the same conversation lock used
  -- by the service writer; a prior committed BLOCK cannot race past this gate.
  -- Ignore null/unsupported rows so they cannot clear an earlier BLOCK.
  -- No supported decision retains the existing conservative REVIEW fallback.
  select coalesce((
    select m.safety from public.ai_messages m
     where m.conversation_id=p_conversation_id
       and m.role='ASSISTANT'
       and m.safety in ('ALLOW','CLARIFY','REVIEW','BLOCK')
     order by m.sequence_no desc
     limit 1
  ),'REVIEW') into v_safety;
  if v_safety='BLOCK' then
    raise exception 'AI_NEED_DRAFT_BLOCKED' using errcode='P0001';
  end if;

  v_region_token:=current_setting('uskoci.need_region',true);
  perform set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
  insert into public.needs(
    requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,schedule_kind,starts_at,ends_at,required_slots,
    mode,requester_price_rsd,required_skills,required_tools,required_vehicles,
    required_licenses,verified_identity_required,minimum_experience_years,
    execution_location_mode,public_photo_paths,task_country_code,task_timezone,price_basis
  ) values (
    v_uid,p_requester_profile_id,'DRAFT',v_title,v_description,v_category,
    coalesce(v_city,''),coalesce(v_area,''),v_schedule_kind,v_starts_at,v_ends_at,v_slots,
    v_mode,v_price,v_skills,v_tools,v_vehicles,v_licenses,v_verified,v_min_exp,
    v_exec_mode,v_photos,v_country,v_timezone,case when v_mode='MY_PRICE' then nullif(btrim(coalesce(v_facts->>'need.price_basis','')),'') end
  )
  returning id into v_need_id;
  perform set_config('uskoci.need_region',coalesce(v_region_token,''),true);

  insert into public.need_geography(need_id,public_topology)
  values(v_need_id,v_geo);

  if v_exact_address is not null or v_access_notes is not null then
    insert into public.need_sensitive(need_id,exact_address,access_notes)
    values(v_need_id,coalesce(v_exact_address,''),coalesce(v_access_notes,''));
  end if;

  perform private.materialize_resolved_location(v_need_id,p_conversation_id);

  if cardinality(v_conditions)>0 then
    insert into public.need_requirement_details(need_id,critical_conditions)
    values(v_need_id,v_conditions);
  end if;

  update public.ai_structured_facts
     set subject_need_id=v_need_id
   where conversation_id=p_conversation_id
     and fact_schema_version='NEED_FACT_V2';

  update public.ai_conversations
     set bound_need_id=v_need_id,status='COMPLETED',completed_at=statement_timestamp()
   where id=p_conversation_id;

  v_result:=jsonb_build_object(
    'needId',v_need_id,
    'status','DRAFT',
    'revision',1,
    'conversationId',p_conversation_id,
    'authoritative',true
  );

  insert into private.need_draft_save_commands(
    account_id,client_request_id,request_hash,conversation_id,requester_profile_id,need_id,result
  ) values (
    v_uid,btrim(p_client_request_id),v_hash,p_conversation_id,p_requester_profile_id,v_need_id,v_result
  );

  return v_result;
end
$function$;

CREATE OR REPLACE FUNCTION public.rpc_confirm_need_edit_from_review(p_need_id uuid, p_expected_revision integer, p_conversation_id uuid, p_client_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_request_id text:=btrim(coalesce(p_client_request_id,''));
  v_request_hash text;
  v_existing private.need_edit_commands%rowtype;
  v_conv public.ai_conversations%rowtype;
  v_need public.needs%rowtype;
  v_old_sensitive public.need_sensitive%rowtype;
  v_facts jsonb;
  v_missing text[];
  v_key text;
  v_value jsonb;
  v_title text;
  v_description text;
  v_category text;
  v_mode text;
  v_price integer;
  v_schedule_kind text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_slots integer;
  v_skills text[];
  v_tools text[];
  v_vehicles text[];
  v_licenses text[];
  v_min_exp integer;
  v_verified boolean;
  v_photos text[];
  v_conditions text[];
  v_geo jsonb;
  v_old_geo jsonb;
  v_exec_mode text;
  v_start jsonb;
  v_service jsonb;
  v_city text;
  v_area text;
  v_exact_address text;
  v_access_notes text;
  v_country text; v_timezone text; v_region_token text;
  v_exact_lat numeric;
  v_exact_lng numeric;
  v_before jsonb;
  v_after jsonb;
  v_event_id uuid;
  v_result jsonb;
  v_from_status text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null or p_conversation_id is null or p_expected_revision is null or p_expected_revision<1 then
    raise exception 'EDIT_REVIEW_IDENTITY_REQUIRED' using errcode='22004';
  end if;
  if char_length(v_request_id) not between 8 and 200 then raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023'; end if;

  select * into v_conv from public.ai_conversations where id=p_conversation_id for update;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_conv.purpose<>'NEED_INTAKE' or v_conv.fact_schema_version<>'NEED_FACT_V2' or v_conv.status<>'OPEN' then
    raise exception 'EDIT_CONVERSATION_NOT_CONFIRMABLE' using errcode='P0001';
  end if;
  if v_conv.bound_need_id is distinct from p_need_id then raise exception 'EDIT_CONVERSATION_NEED_MISMATCH' using errcode='42501'; end if;

  select * into v_need from public.needs where id=p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if v_need.requester_account_id<>v_uid then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if v_need.revision<>p_expected_revision then raise exception 'STALE_REVIEW_REQUIRED' using errcode='PT409'; end if;
  if v_need.status not in ('DRAFT','PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='P0001'; end if;
  v_from_status:=v_need.status;
  perform 1 from public.need_geography where need_id=v_need.id for share;
  perform 1 from public.need_sensitive where need_id=v_need.id for share;
  perform 1 from public.need_requirement_details where need_id=v_need.id for share;
  if (v_need.status='DRAFT' and v_conv.need_edit_base_fingerprint is null) or (v_conv.need_edit_base_fingerprint is not null and v_conv.need_edit_base_fingerprint is distinct from private.need_edit_base_marker(v_need.id)) then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode='PT409';
  end if;
  if exists(select 1 from public.agreements a where a.need_id=v_need.id)
     or exists(select 1 from public.need_selections s where s.need_id=v_need.id)
     or exists(select 1 from public.marketplace_responses r where r.need_id=v_need.id and r.status='SELECTED') then
    raise exception 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' using errcode='P0001';
  end if;

  if exists(
    select 1 from public.ai_structured_facts f
     where f.conversation_id=p_conversation_id
       and f.superseded_at is null
       and f.status<>'CONFIRMED'
  ) then
    raise exception 'EDIT_FACTS_REQUIRE_HUMAN_CONFIRMATION' using errcode='P0001';
  end if;

  for v_key,v_value in
    select fact_key,fact_value from public.ai_structured_facts
     where conversation_id=p_conversation_id
       and superseded_at is null
       and fact_schema_version='NEED_FACT_V2'
       and status='CONFIRMED'
  loop
    perform private.validate_need_v2_fact(v_key,v_value);
  end loop;

  select coalesce(jsonb_object_agg(fact_key,fact_value),'{}'::jsonb)
    into v_facts
    from public.ai_structured_facts
   where conversation_id=p_conversation_id
     and superseded_at is null
     and fact_schema_version='NEED_FACT_V2'
     and status='CONFIRMED';

  select array_agg(r.fact_key order by r.fact_key)
    into v_missing
    from private.need_fact_registry r
   where r.required_for_draft and not (v_facts ? r.fact_key);
  if cardinality(coalesce(v_missing,'{}'::text[]))>0 then
    raise exception 'REQUIRED_CONFIRMED_FACTS_MISSING' using errcode='P0001',detail=array_to_string(v_missing,',');
  end if;

  v_title:=v_facts->>'need.title';
  v_description:=v_facts->>'need.description';
  v_category:=v_facts->>'need.category';
  v_mode:=v_facts->>'need.price_mode';
  if v_facts ? 'need.price_rsd' then v_price:=(v_facts->>'need.price_rsd')::integer; end if;
  if v_mode='MY_PRICE' and v_price is null then raise exception 'MY_PRICE_AMOUNT_REQUIRED' using errcode='P0001'; end if;
  if v_mode<>'MY_PRICE' then v_price:=null; end if;

  v_schedule_kind:=v_facts->>'need.schedule_kind';
  if v_facts ? 'need.starts_at' then v_starts_at:=(v_facts->>'need.starts_at')::timestamptz; end if;
  if v_facts ? 'need.ends_at' then v_ends_at:=(v_facts->>'need.ends_at')::timestamptz; end if;
  if v_schedule_kind='FIXED_WINDOW' and (v_starts_at is null or v_ends_at is null or v_ends_at<=v_starts_at) then
    raise exception 'FIXED_WINDOW_BOUNDS_REQUIRED' using errcode='P0001';
  end if;

  v_slots:=(v_facts->>'need.people_needed')::integer;
  select coalesce(array_agg(value),'{}'::text[]) into v_skills from jsonb_array_elements_text(coalesce(v_facts->'need.required_skills','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_tools from jsonb_array_elements_text(coalesce(v_facts->'need.required_tools','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_vehicles from jsonb_array_elements_text(coalesce(v_facts->'need.required_vehicles','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_licenses from jsonb_array_elements_text(coalesce(v_facts->'need.required_licenses','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_photos from jsonb_array_elements_text(coalesce(v_facts->'need.public_photo_paths','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_conditions from jsonb_array_elements_text(coalesce(v_facts->'need.critical_conditions','[]'::jsonb));
  if v_facts ? 'need.minimum_experience_years' then v_min_exp:=(v_facts->>'need.minimum_experience_years')::integer; end if;
  v_verified:=case when v_facts ? 'need.verified_identity_required' then (v_facts->>'need.verified_identity_required')::boolean else false end;

  v_country:=private.require_location_country(v_facts->'need.task_country_code');
  select default_timezone into v_timezone from private.location_market_configs where country_code=v_country;
  v_geo:=v_facts->'need.task_geography';
  perform private.validate_need_v2_fact('need.task_geography',v_geo);
  v_exec_mode:=v_geo->>'mode';
  v_start:=coalesce(v_geo->'start','null'::jsonb);
  v_service:=coalesce(v_geo->'serviceArea','null'::jsonb);
  v_city:=coalesce(nullif(btrim(v_start->>'city'),''),nullif(btrim(v_service->>'city'),''));
  v_area:=coalesce(nullif(btrim(v_start->>'area'),''),nullif(btrim(v_service->>'area'),''));
  if v_exec_mode='REMOTE' then v_city:=''; v_area:=''; end if;

  if v_facts ? 'need.exact_address' then v_exact_address:=v_facts->>'need.exact_address'; end if;
  if v_facts ? 'need.access_notes' then v_access_notes:=v_facts->>'need.access_notes'; end if;
  select * into v_old_sensitive from public.need_sensitive where need_id=v_need.id;
  select g.public_topology into v_old_geo from public.need_geography g where g.need_id=v_need.id;
  if v_old_sensitive.need_id is not null
     and coalesce(v_exact_address,'')=coalesce(v_old_sensitive.exact_address,'')
     and v_geo is not distinct from v_old_geo and v_country is not distinct from v_need.task_country_code then
    v_exact_lat:=v_old_sensitive.exact_lat;
    v_exact_lng:=v_old_sensitive.exact_lng;
  end if;

  v_before:=private.need_full_edit_snapshot(v_need.id);
  if v_before is null then raise exception 'NEED_SNAPSHOT_FAILED' using errcode='P0001'; end if;

  v_request_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'needId',p_need_id,'expectedRevision',p_expected_revision,'conversationId',p_conversation_id,'facts',v_facts
  )::text,'UTF8'),'sha256'),'hex');

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||E'\n'||v_request_id,4411));
  select * into v_existing from private.need_edit_commands c
   where c.requester_account_id=v_uid and c.client_request_id=v_request_id for update;
  if found then
    if v_existing.request_hash<>v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023'; end if;
    return v_existing.result||jsonb_build_object('idempotentReplay',true);
  end if;

  v_region_token:=current_setting('uskoci.need_region',true);
  perform set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
  perform set_config('uskoci.need_lifecycle','CONFIRM_EDIT',true);
  update public.needs n
     set title=btrim(v_title),description=btrim(v_description),category=btrim(v_category),
         required_slots=v_slots,mode=v_mode,requester_price_rsd=v_price,price_basis=case when v_mode='MY_PRICE' then nullif(btrim(coalesce(v_facts->>'need.price_basis','')),'') end,
         required_skills=v_skills,required_tools=v_tools,required_vehicles=v_vehicles,required_licenses=v_licenses,
         minimum_experience_years=v_min_exp,verified_identity_required=v_verified,
         schedule_kind=v_schedule_kind,starts_at=v_starts_at,ends_at=v_ends_at,
         execution_location_mode=v_exec_mode,task_country_code=v_country,task_timezone=v_timezone,
         approximate_lat=case when v_geo is not distinct from v_old_geo and v_country is not distinct from v_need.task_country_code then v_need.approximate_lat else null end,
         approximate_lng=case when v_geo is not distinct from v_old_geo and v_country is not distinct from v_need.task_country_code then v_need.approximate_lng else null end,
         approximate_city=coalesce(v_city,''),approximate_area=coalesce(v_area,''),
         public_photo_paths=v_photos,status='DRAFT',revision=v_need.revision+1,
         published_at=null,response_deadline=null,urgent=false,urgent_activated_at=null,urgent_expires_at=null,urgent_policy_version=null,
         updated_at=statement_timestamp()
   where n.id=v_need.id and n.revision=v_need.revision and n.status in ('DRAFT','PUBLISHED','SELECTION')
   returning n.* into v_need;
  perform set_config('uskoci.need_lifecycle','',true);
  perform set_config('uskoci.need_region',coalesce(v_region_token,''),true);
  if not found then raise exception 'NEED_EDIT_CONFLICT' using errcode='PT409'; end if;

  insert into public.need_geography(need_id,public_topology,updated_at)
  values(v_need.id,v_geo,statement_timestamp())
  on conflict(need_id) do update set public_topology=excluded.public_topology,updated_at=excluded.updated_at;

  insert into public.need_requirement_details(need_id,critical_conditions,updated_at)
  values(v_need.id,v_conditions,statement_timestamp())
  on conflict(need_id) do update set critical_conditions=excluded.critical_conditions,updated_at=excluded.updated_at;

  insert into public.need_sensitive(need_id,exact_address,access_notes,exact_lat,exact_lng,updated_at)
  values(v_need.id,coalesce(v_exact_address,''),coalesce(v_access_notes,''),v_exact_lat,v_exact_lng,statement_timestamp())
  on conflict(need_id) do update set exact_address=excluded.exact_address,access_notes=excluded.access_notes,
    exact_lat=excluded.exact_lat,exact_lng=excluded.exact_lng,updated_at=excluded.updated_at;

  perform private.materialize_resolved_location(v_need.id,p_conversation_id);

  delete from private.dispatch_schedule where need_id=v_need.id;

  v_after:=private.need_full_edit_snapshot(v_need.id);
  if v_after is not distinct from v_before then raise exception 'NO_MATERIAL_CHANGE' using errcode='22023'; end if;

  insert into private.need_revision_events(
    need_id,from_revision,to_revision,from_status,previous_material_snapshot,new_material_snapshot,created_by_account_id
  ) values (
    v_need.id,p_expected_revision,v_need.revision,case when v_from_status='DRAFT' then 'DRAFT' else 'PUBLISHED_OR_SELECTION' end,v_before,v_after,v_uid
  ) returning id into v_event_id;

  update public.ai_conversations
     set status='COMPLETED',completed_at=statement_timestamp()
   where id=p_conversation_id and status='OPEN';

  perform private.audit_marketplace(v_uid,'NEED_AI_EDIT_CONFIRMED','NEED',v_need.id,v_need.revision,
    jsonb_build_object('fromRevision',p_expected_revision,'toRevision',v_need.revision,'revisionEventId',v_event_id,'conversationId',p_conversation_id));

  v_result:=jsonb_build_object(
    'needId',v_need.id,'fromRevision',p_expected_revision,'revision',v_need.revision,'status','DRAFT',
    'revisionEventId',v_event_id,'conversationId',p_conversation_id,'requiresReadmission',true,
    'idempotentReplay',false,'authoritative',true
  );

  insert into private.need_edit_commands(
    requester_account_id,client_request_id,request_hash,need_id,from_revision,to_revision,revision_event_id,result
  ) values(v_uid,v_request_id,v_request_hash,v_need.id,p_expected_revision,v_need.revision,v_event_id,v_result);

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_submit_response(p_need_id uuid, p_need_revision integer, p_worker_profile_id uuid, p_covered_slots integer, p_price_rsd integer, p_proposed_start_at timestamp with time zone, p_proposed_end_at timestamp with time zone, p_scope_note text, p_client_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  u uuid := auth.uid();
  n public.needs;
  v_profile public.app_profiles;
  v_resp public.marketplace_responses;
  v_command private.response_submit_commands;
  v_match jsonb;
  v_content_hash text;
  v_request_hash text;
  v_result jsonb;
  v_version integer;
  v_selected_slots integer := 0;
  v_remaining_slots integer := 0;
begin
  if u is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;

  if p_client_request_id is null
     or char_length(btrim(p_client_request_id)) not between 8 and 200 then
    raise exception using errcode='22023', message='INVALID_CLIENT_REQUEST_ID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(u::text || ':' || p_client_request_id, 7241)
  );

  -- Bind only the semantic client command. Server-derived profile/Need snapshot
  -- intentionally does not enter the request hash, so a retry after a committed
  -- response replays the exact first result even if current context later moves.
  v_request_hash := encode(sha256(convert_to(jsonb_build_object(
    'needId', p_need_id,
    'needRevision', p_need_revision,
    'workerProfileId', p_worker_profile_id,
    'coveredSlots', p_covered_slots,
    'priceRsd', p_price_rsd,
    'proposedStartAt', p_proposed_start_at,
    'proposedEndAt', p_proposed_end_at,
    'scopeNote', coalesce(p_scope_note, '')
  )::text, 'UTF8')), 'hex');

  select * into v_command
    from private.response_submit_commands c
   where c.worker_account_id = u
     and c.client_request_id = p_client_request_id;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception using errcode='22023', message='IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_command.result || jsonb_build_object('idempotentReplay', true);
  end if;

  -- Shared mutation lock order remains Need first.
  select * into n
    from public.needs
   where id = p_need_id
   for update;

  if not found then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;

  if not private.accounts_same_world(n.requester_account_id, u) then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;

  select * into v_command
    from private.response_submit_commands c
   where c.worker_account_id = u
     and c.client_request_id = p_client_request_id
   for update;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception using errcode='22023', message='IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_command.result || jsonb_build_object('idempotentReplay', true);
  end if;

  if n.status not in ('PUBLISHED','SELECTION') then
    raise exception using errcode='22023', message='NEED_NOT_OPEN';
  end if;

  if n.requester_account_id = u then
    raise exception using errcode='42501', message='OWN_NEED';
  end if;

  if n.response_deadline is not null
     and n.response_deadline <= statement_timestamp() then
    raise exception using errcode='22023', message='RESPONSE_WINDOW_EXPIRED';
  end if;

  if n.revision is distinct from p_need_revision then
    raise exception using errcode='P0001', message='STALE_REVIEW_REQUIRED';
  end if;

  -- Lock the current Worker profile after the Need. ACTIVE alone is not enough
  -- for legacy rows: P0C-02 rechecks the exact RU-1 minimum readiness facts.
  select * into v_profile
    from public.app_profiles p
   where p.id = p_worker_profile_id
   for update;

  if not found
     or v_profile.account_id <> u
     or v_profile.kind <> 'WORKER' then
    raise exception using errcode='42501', message='PROFILE_NOT_OWNED_BY_ACCOUNT';
  end if;

  if v_profile.profile_status <> 'ACTIVE'
     or char_length(btrim(v_profile.display_name)) < 2
     or char_length(btrim(v_profile.city)) < 2
     or cardinality(v_profile.skills) < 1 then
    raise exception using errcode='P0001', message='WORKER_PROFILE_NOT_READY';
  end if;

  select coalesce(sum(s.covered_slots), 0)::integer
    into v_selected_slots
    from public.need_selections s
   where s.need_id = n.id
     and s.status = 'SELECTED';

  v_remaining_slots := greatest(0, n.required_slots - v_selected_slots);

  if v_remaining_slots < 1 then
    raise exception using errcode='P0001', message='NEED_FULL';
  end if;

  if p_covered_slots is null or p_covered_slots < 1 then
    raise exception using errcode='22023', message='INVALID_COVERED_SLOTS';
  end if;

  -- WPP01: people are committed per offer; the personal profile is not a team limit.
  -- Existing remaining-slot and pricing checks below remain authoritative.

  if p_covered_slots > v_remaining_slots then
    raise exception using
      errcode='22023',
      message='NEED_REMAINING_CAPACITY_EXCEEDED',
      detail=format('covered=%s,remaining=%s', p_covered_slots, v_remaining_slots);
  end if;

  perform private.assert_application_price_v5(n, p_covered_slots, p_price_rsd);

  if (p_proposed_start_at is null) <> (p_proposed_end_at is null)
     or (
       p_proposed_start_at is not null
       and p_proposed_end_at is not null
       and p_proposed_start_at >= p_proposed_end_at
     ) then
    raise exception using errcode='22023', message='INVALID_PROPOSED_INTERVAL';
  end if;

  if exists (
    select 1
      from public.marketplace_responses r
     where r.need_id = p_need_id
       and r.worker_account_id = u
       and (
         r.status = 'SELECTED'
         or exists (
           select 1
             from public.agreements a
            where a.selected_response_id = r.id
              and a.status in ('CONFIRMED','SUPERSEDED','COMPLETED')
         )
       )
  ) then
    raise exception using errcode='P0001', message='RESPONSE_ALREADY_SELECTED';
  end if;

  if p_proposed_start_at is null and n.schedule_kind='FIXED_WINDOW'
    and (n.starts_at is null or n.ends_at is null or not isfinite(n.starts_at)
      or not isfinite(n.ends_at) or n.starts_at>=n.ends_at) then
    raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
  end if;
  v_match := private.match_detail_for_calendar_interval(p_need_id, p_worker_profile_id,
    coalesce(p_proposed_start_at,case when n.schedule_kind='FIXED_WINDOW' then n.starts_at end),
    coalesce(p_proposed_end_at,case when n.schedule_kind='FIXED_WINDOW' then n.ends_at end));
  if not coalesce((v_match->>'responseAllowed')::boolean, false) then
    raise exception using
      errcode='P0001',
      message='WORKER_NOT_ELIGIBLE',
      detail=coalesce((v_match->'hardBlockers')::text, '[]');
  end if;

  select * into v_resp
    from public.marketplace_responses r
   where r.need_id = p_need_id
     and r.worker_account_id = u
     and r.status in ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
   order by r.created_at desc
   limit 1
   for update;

  -- Content identity includes the server-derived self-declared capability/team
  -- snapshot. It is not public trust/verification and is never copied into the
  -- global public profile DTO.
  v_content_hash := encode(sha256(convert_to(jsonb_build_object(
    'needRevision', n.revision,
    'pricingMode', n.mode,
    'priceRsd', p_price_rsd,
    'coveredSlots', p_covered_slots,
    'proposedStartAt', p_proposed_start_at,
    'proposedEndAt', p_proposed_end_at,
    'scopeNote', coalesce(btrim(p_scope_note), ''),
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'workerTeamCapacity', v_profile.team_capacity,
    'workerSkills', to_jsonb(v_profile.skills),
    'workerTools', to_jsonb(v_profile.tools),
    'workerLicenses', to_jsonb(v_profile.licenses),
    'workerVehicles', to_jsonb(v_profile.vehicles)
  )::text, 'UTF8')), 'hex');

  if v_resp.id is null then
    insert into public.marketplace_responses (
      need_id, worker_account_id, worker_profile_id, response_kind, status,
      submitted_against_need_revision, current_version, covered_slots,
      price_rsd, proposed_start_at, proposed_end_at, scope_note, submitted_at
    ) values (
      p_need_id, u, p_worker_profile_id, 'OFFER', 'SUBMITTED', n.revision, 1,
      p_covered_slots, p_price_rsd, p_proposed_start_at, p_proposed_end_at,
      coalesce(p_scope_note, ''), statement_timestamp()
    )
    returning * into v_resp;
    v_version := 1;
  else
    v_version := v_resp.current_version + 1;
    update public.marketplace_responses
       set current_version = v_version,
           status = 'SUBMITTED',
           submitted_against_need_revision = n.revision,
           covered_slots = p_covered_slots,
           price_rsd = p_price_rsd,
           proposed_start_at = p_proposed_start_at,
           proposed_end_at = p_proposed_end_at,
           scope_note = coalesce(p_scope_note, ''),
           submitted_at = statement_timestamp(),
           withdrawn_at = null
     where id = v_resp.id
     returning * into v_resp;
  end if;

  insert into public.marketplace_response_versions (
    response_id, version, need_revision, covered_slots, price_rsd,
    proposed_start_at, proposed_end_at, scope_note, content_hash
  ) values (
    v_resp.id, v_version, n.revision, p_covered_slots, p_price_rsd,
    p_proposed_start_at, p_proposed_end_at, coalesce(p_scope_note, ''),
    v_content_hash
  );

  insert into private.response_application_snapshots (
    response_id, response_version, snapshot_schema,
    worker_profile_id, worker_team_capacity, covered_slots,
    need_required_slots, need_selected_slots_before_submit,
    need_remaining_slots_before_submit, pricing_mode, requester_price_rsd,
    worker_skills, worker_tools, worker_licenses, worker_vehicles
  ) values (
    v_resp.id, v_version, 'APPLICATION_V1_SELF_DECLARED',
    v_profile.id, v_profile.team_capacity, p_covered_slots,
    n.required_slots, v_selected_slots, v_remaining_slots,
    n.mode, n.requester_price_rsd,
    v_profile.skills, v_profile.tools, v_profile.licenses, v_profile.vehicles
  );

  update public.opportunity_deliveries
     set status = 'RESPONDED',
         responded_at = statement_timestamp()
   where need_id = p_need_id
     and need_revision = n.revision
     and worker_account_id = u
     and status in ('READY','SEEN');

  v_result := jsonb_build_object(
    'responseId', v_resp.id,
    'applicationId', v_resp.id,
    'version', v_version,
    'needRevision', n.revision,
    'contentHash', v_content_hash,
    'status', v_resp.status,
    'pricingMode', n.mode,
    'coveredSlots', p_covered_slots,
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'authoritative', true,
    'idempotentReplay', false
  );

  insert into private.response_submit_commands (
    worker_account_id, client_request_id, request_hash,
    response_id, response_version, result
  ) values (
    u, p_client_request_id, v_request_hash,
    v_resp.id, v_version, v_result
  );

  -- PRE-V3: persisted version trigger owns Application semantic events.

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_select_response(p_need_id uuid, p_need_revision integer, p_response_id uuid, p_response_version integer, p_content_hash text, p_client_request_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  uid uuid := auth.uid();
  v_need public.needs%rowtype;
  v_resp public.marketplace_responses%rowtype;
  v_ver public.marketplace_response_versions%rowtype;
  v_requested_ver public.marketplace_response_versions%rowtype;
  v_profile public.app_profiles%rowtype;
  v_command private.selection_commands%rowtype;
  v_policy private.connection_policy_versions%rowtype;
  v_selection_id uuid;
  v_agreement_id uuid;
  v_covered integer;
  v_terms jsonb;
  v_match jsonb;
  v_request_hash text;
  v_legacy_selected_by uuid;
  v_legacy_need_revision integer;
  v_legacy_response_id uuid;
  v_legacy_covered_slots integer;
  v_legacy_agreement_id uuid;
  v_legacy_response_version integer;
  v_legacy_content_hash text;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if p_client_request_id is null
     or char_length(btrim(p_client_request_id)) not between 8 and 200 then
    raise exception 'INVALID_CLIENT_REQUEST_ID' using errcode = '22023';
  end if;

  select * into v_requested_ver
    from public.marketplace_response_versions
   where response_id = p_response_id
     and version = p_response_version;

  v_request_hash := encode(sha256(convert_to(jsonb_build_object(
    'requesterAccountId', uid,
    'needId', p_need_id,
    'needRevision', p_need_revision,
    'responseId', p_response_id,
    'responseVersion', p_response_version,
    'contentHash', p_content_hash,
    'coveredSlots', v_requested_ver.covered_slots
  )::text, 'UTF8')), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(uid::text || ':' || p_client_request_id, 7242)
  );

  select * into v_command
    from private.selection_commands c
   where c.requester_account_id = uid
     and c.client_request_id = p_client_request_id;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return v_command.agreement_id;
  end if;

  -- Pre-P0D-02/P0D-03 historical rows remain authoritative and are not
  -- retroactively charged or given fabricated activation receipts.
  select s.selected_by_account_id,
         s.need_revision,
         s.response_id,
         s.covered_slots,
         a.id,
         nullif(av.terms->>'response_version','')::integer,
         av.content_hash
    into v_legacy_selected_by,
         v_legacy_need_revision,
         v_legacy_response_id,
         v_legacy_covered_slots,
         v_legacy_agreement_id,
         v_legacy_response_version,
         v_legacy_content_hash
    from public.need_selections s
    join public.agreements a on a.selection_id = s.id
    left join public.agreement_versions av
      on av.agreement_id = a.id and av.version = 1
   where s.need_id = p_need_id
     and s.client_request_id = p_client_request_id;

  if found then
    if v_legacy_selected_by <> uid then
      raise exception 'NOT_REQUESTER' using errcode = '42501';
    end if;
    if v_legacy_need_revision <> p_need_revision
       or v_legacy_response_id is distinct from p_response_id
       or (v_requested_ver.response_id is not null
           and v_legacy_covered_slots <> v_requested_ver.covered_slots)
       or (v_legacy_response_version is not null
           and v_legacy_response_version <> p_response_version)
       or (v_legacy_content_hash is not null
           and v_legacy_content_hash <> p_content_hash) then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return v_legacy_agreement_id;
  end if;

  select * into v_need from public.needs where id = p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_need.requester_account_id <> uid then raise exception 'NOT_REQUESTER' using errcode = '42501'; end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then
    raise exception 'NEED_NOT_OPEN' using errcode = 'P0001', detail = v_need.status; end if;

  if v_need.response_deadline is not null
     and v_need.response_deadline <= statement_timestamp() then
    raise exception 'RESPONSE_WINDOW_EXPIRED' using errcode = 'P0001', hint = 'Rok za prijave je istekao.';
  end if;

  if v_need.revision <> p_need_revision then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'need_revision',
      hint = 'Potreba je izmenjena. Pogledajte prijave ponovo.'; end if;

  select * into v_resp from public.marketplace_responses where id = p_response_id for update;
  if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_resp.need_id <> p_need_id then raise exception 'RESPONSE_NEED_MISMATCH' using errcode = 'P0001'; end if;
  if v_resp.status not in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') then
    raise exception 'RESPONSE_NOT_SELECTABLE' using errcode = 'P0001', detail = v_resp.status; end if;

  if v_resp.current_version <> p_response_version then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'response_version',
      hint = 'Uskocer je izmenio prijavu. Proverite je ponovo.'; end if;

  select * into v_ver from public.marketplace_response_versions
   where response_id = p_response_id and version = p_response_version;
  if not found then raise exception 'RESPONSE_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_ver.content_hash <> p_content_hash then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'content_hash',
      hint = 'Uslovi prijave su izmenjeni.'; end if;
  if v_ver.need_revision <> v_need.revision then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'response_need_revision'; end if;

  select * into v_profile
    from public.app_profiles p
   where p.id = v_resp.worker_profile_id
   for share;

  if not found
     or v_profile.kind <> 'WORKER'
     or v_profile.account_id <> v_resp.worker_account_id
     or v_profile.profile_status <> 'ACTIVE'
     or char_length(btrim(v_profile.display_name)) < 2
     or char_length(btrim(v_profile.city)) < 2
     or cardinality(v_profile.skills) < 1 then
    raise exception 'WORKER_PROFILE_NOT_READY' using errcode = 'P0001',
      hint = 'Uskocer vise nema vazeci spreman profil za izbor.';
  end if;

  -- WPP01: accept the people committed by this offer, subject to the
  -- existing task remaining-slot, calendar and price checks below.

  if (v_ver.proposed_start_at is null)<>(v_ver.proposed_end_at is null) then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end if;
  if v_ver.proposed_start_at is null and v_need.schedule_kind='FIXED_WINDOW'
    and (v_need.starts_at is null or v_need.ends_at is null or not isfinite(v_need.starts_at)
      or not isfinite(v_need.ends_at) or v_need.starts_at>=v_need.ends_at) then
    raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
  end if;
  v_match := private.match_detail_for_calendar_interval(p_need_id, v_resp.worker_profile_id,
    coalesce(v_ver.proposed_start_at,case when v_need.schedule_kind='FIXED_WINDOW' then v_need.starts_at end),
    coalesce(v_ver.proposed_end_at,case when v_need.schedule_kind='FIXED_WINDOW' then v_need.ends_at end));
  if not coalesce((v_match->>'responseAllowed')::boolean, false) then
    raise exception 'WORKER_NO_LONGER_ELIGIBLE' using errcode = 'P0001',
      detail = coalesce((v_match->'hardBlockers')::text,'[]'),
      hint = 'Uskocer vise ne ispunjava uslove Potrebe.';
  end if;

  v_covered := public.fn_need_covered_slots(p_need_id);
  if v_covered + v_resp.covered_slots > v_need.required_slots then
    raise exception 'OVERFILL' using errcode = 'P0001', hint = 'Ta prijava pokriva vise mesta nego sto je preostalo.'; end if;

  -- PKG-033: historical/reconfirmed offers cannot bypass today's fixed-price rule at selection.
  perform private.assert_application_price_v5(v_need, v_ver.covered_slots, v_ver.price_rsd);

  select * into v_policy
    from private.connection_policy_versions
   where policy_key='REQUESTER_SELECTION_V1' and version=1;
  if not found
     or v_policy.beneficiary_role <> 'REQUESTER'
     or v_policy.activation_reason <> 'SELECTION'
     or v_policy.charge_mode <> 'PROMOTIONAL_FREE'
     or v_policy.unit_basis <> 'HEADCOUNT'
     or v_policy.platform_cost_rsd <> 0 then
    raise exception 'CONNECTION_POLICY_NOT_READY' using errcode='55000';
  end if;

  insert into public.need_selections(
    need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,
    response_id,worker_account_id,worker_profile_id,selection_mode,status
  ) values (
    p_need_id,v_need.revision,uid,p_client_request_id,v_resp.covered_slots,
    p_response_id,v_resp.worker_account_id,v_resp.worker_profile_id,
    case when v_need.mode='FASTEST' then 'AUTO_FILL' else 'REQUESTER_SELECTS' end,
    'SELECTED'
  ) returning id into v_selection_id;

  v_terms := jsonb_build_object(
    'price_rsd',v_ver.price_rsd,'covered_slots',v_ver.covered_slots,
    'proposed_start_at',coalesce(v_ver.proposed_start_at,case when v_need.schedule_kind='FIXED_WINDOW' then v_need.starts_at end),
    'proposed_end_at',coalesce(v_ver.proposed_end_at,case when v_need.schedule_kind='FIXED_WINDOW' then v_need.ends_at end),
    'schedule_source',case when v_ver.proposed_start_at is not null then 'APPLICATION_PROPOSAL'
      when v_need.schedule_kind='FIXED_WINDOW' then 'NEED_FIXED_WINDOW' else 'UNSCHEDULED' end,
    'scope_note',v_ver.scope_note,'need_revision',v_need.revision,
    'response_version',v_ver.version
  );

  insert into public.agreements(
    need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,
    worker_account_id,worker_profile_id,current_version,status
  ) values (
    p_need_id,v_selection_id,p_response_id,v_need.requester_account_id,v_need.requester_profile_id,
    v_resp.worker_account_id,v_resp.worker_profile_id,1,'CONFIRMED'
  ) returning id into v_agreement_id;

  insert into public.agreement_versions(
    agreement_id,version,status,terms,content_hash,created_by_account_id
  ) values (v_agreement_id,1,'CONFIRMED',v_terms,v_ver.content_hash,uid);

  insert into public.agreement_execution(agreement_id,agreement_version,mode,state)
  values (
    v_agreement_id,1,
    -- PKG-029b (deep read 12.7): remote or physical follows the place; the schedule decides only for a task
    -- written before the place had a mode.
    case when coalesce(v_need.execution_location_mode = 'REMOTE', v_need.schedule_kind = 'REMOTE_ANYTIME')
      then 'REMOTE' else 'PHYSICAL' end,
    'CONFIRMED'
  );

  insert into private.connection_activations(
    requester_account_id,beneficiary_account_id,client_request_id,request_hash,
    policy_key,policy_version,policy_snapshot,activation_reason,
    need_id,need_revision,selection_id,agreement_id,response_id,response_version,
    response_content_hash,worker_account_id,worker_profile_id,units,platform_cost_rsd,state
  ) values (
    uid,uid,p_client_request_id,v_request_hash,
    v_policy.policy_key,v_policy.version,v_policy.policy_snapshot,'SELECTION',
    p_need_id,p_need_revision,v_selection_id,v_agreement_id,p_response_id,p_response_version,
    p_content_hash,v_resp.worker_account_id,v_resp.worker_profile_id,v_ver.covered_slots,0,'SATISFIED'
  );

  update public.marketplace_responses
     set status='SELECTED',selected_at=statement_timestamp()
   where id=p_response_id;

  perform set_config('uskoci.need_lifecycle','SELECT',true);
  update public.needs
     set status=case when v_covered+v_resp.covered_slots >= v_need.required_slots
                     then 'ACTIVE' else 'SELECTION' end
   where id=p_need_id;

  insert into private.selection_commands(
    requester_account_id,client_request_id,request_hash,
    need_id,need_revision,response_id,response_version,
    response_content_hash,covered_slots,selection_id,agreement_id
  ) values (
    uid,p_client_request_id,v_request_hash,
    p_need_id,p_need_revision,p_response_id,p_response_version,
    p_content_hash,v_ver.covered_slots,v_selection_id,v_agreement_id
  );

  -- N02: domain event shares the Selection/Agreement/activation transaction.
  -- Preferences, suppression and channel dedupe remain owned by emit_event.
  perform private.emit_event(
    v_resp.worker_account_id, 'WORKER', 'RESPONSE_SELECTED',
    'RESPONSE', v_resp.id, v_ver.version,
    'Vaša prijava je izabrana', 'Otvorite Dogovor za detalje zadatka.',
    'response_selected:' || v_selection_id::text,
    'NORMAL', jsonb_build_object('agreement_id', v_agreement_id, 'need_id', v_need.id)
  );

  return v_agreement_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_resolve_stale_response_after_need_edit(p_response_id uuid, p_expected_response_version integer, p_expected_need_revision integer, p_client_request_id text, p_action text, p_covered_slots integer, p_price_rsd integer, p_proposed_start_at timestamp with time zone, p_proposed_end_at timestamp with time zone, p_scope_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(p_client_request_id,''));
  v_action text := upper(btrim(coalesce(p_action,'')));
  v_request_hash text;
  v_existing private.response_revision_resolution_commands%rowtype;
  v_need_id uuid;
  v_need public.needs%rowtype;
  v_response public.marketplace_responses%rowtype;
  v_match jsonb;
  v_profile public.app_profiles;
  v_selected_slots integer;
  v_remaining_slots integer;
  v_new_version integer;
  v_covered integer;
  v_price integer;
  v_start timestamptz;
  v_end timestamptz;
  v_note text;
  v_content_hash text;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_response_id is null or p_expected_response_version is null or p_expected_response_version < 1
     or p_expected_need_revision is null or p_expected_need_revision < 1 then
    raise exception 'RESPONSE_VERSION_NEED_REVISION_REQUIRED' using errcode='22023';
  end if;
  if char_length(v_request_id) not between 8 and 200 then raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023'; end if;
  if v_action not in ('KEEP','UPDATE','WITHDRAW') then raise exception 'STALE_RESPONSE_ACTION_INVALID' using errcode='22023'; end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(jsonb_build_object(
        'responseId', p_response_id,
        'expectedResponseVersion', p_expected_response_version,
        'expectedNeedRevision', p_expected_need_revision,
        'action', v_action,
        'coveredSlots', p_covered_slots,
        'priceRsd', p_price_rsd,
        'proposedStartAt', p_proposed_start_at,
        'proposedEndAt', p_proposed_end_at,
        'scopeNote', coalesce(p_scope_note,'')
      )::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || E'\n' || v_request_id, 4405));

  select * into v_existing
    from private.response_revision_resolution_commands c
   where c.worker_account_id = v_actor
     and c.client_request_id = v_request_id
   for update;
  if found then
    if v_existing.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023'; end if;
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  select r.need_id into v_need_id from public.marketplace_responses r where r.id = p_response_id;
  if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode='P0002'; end if;

  select * into v_need from public.needs n where n.id = v_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;

  select * into v_response from public.marketplace_responses r where r.id = p_response_id for update;
  if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode='P0002'; end if;

  if v_response.worker_account_id <> v_actor then raise exception 'RESPONSE_NOT_OWNED' using errcode='42501'; end if;
  if v_response.current_version <> p_expected_response_version then raise exception 'STALE_REVIEW_REQUIRED' using errcode='PT409'; end if;
  if v_need.revision <> p_expected_need_revision then raise exception 'STALE_REVIEW_REQUIRED' using errcode='PT409'; end if;
  if v_response.status <> 'STALE_REVIEW_REQUIRED' then raise exception 'RESPONSE_NOT_AWAITING_REVIEW' using errcode='P0001'; end if;
  if v_response.submitted_against_need_revision >= v_need.revision then raise exception 'RESPONSE_ALREADY_CURRENT' using errcode='P0001'; end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then raise exception 'NEED_NOT_OPEN' using errcode='P0001'; end if;
  if exists (select 1 from public.agreements a where a.selected_response_id = v_response.id) then
    raise exception 'RESPONSE_ALREADY_SELECTED' using errcode='P0001';
  end if;

  if v_action = 'WITHDRAW' then
    update public.notification_deliveries d set state='EXPIRED'
      from public.user_activity_events e
      where d.event_id=e.id and e.entity_type='RESPONSE' and e.entity_id=v_response.id
        and d.state in ('CREATED','QUEUED','FAILED_RETRYABLE');
    update public.marketplace_responses
       set status = 'WITHDRAWN', withdrawn_at = statement_timestamp(), selected_at = null
     where id = v_response.id
     returning * into v_response;

    perform private.emit_event(v_need.requester_account_id,'REQUESTER','RESPONSE_WITHDRAWN',
      'RESPONSE',v_response.id,v_response.current_version,
      'Prijava je povučena','Prijava za tvoj zadatak je povučena.',
      'response-withdrawn:'||v_response.id::text||':'||v_response.current_version::text,
      'NORMAL',jsonb_build_object('needId',v_need.id,'needRevision',v_need.revision),null);
    if (v_need.response_deadline is null or v_need.response_deadline > statement_timestamp())
       and public.fn_need_covered_slots(v_need.id) < v_need.required_slots then
      perform private.enqueue_dispatch(v_need.id,statement_timestamp());
    end if;

    v_result := jsonb_build_object(
      'responseId', v_response.id,
      'needId', v_need.id,
      'needRevision', v_need.revision,
      'version', v_response.current_version,
      'status', v_response.status,
      'action', v_action,
      'idempotentReplay', false,
      'authoritative', true
    );
  else
    -- PKG-033: reconfirmation is an application to today's task, not a bypass.
    -- Withdrawal stays possible without a ready profile or matching world.
    if not private.accounts_same_world(v_need.requester_account_id, v_actor) then
      raise exception 'NEED_NOT_FOUND' using errcode='P0002';
    end if;
    if v_need.response_deadline is not null and v_need.response_deadline <= statement_timestamp() then
      raise exception 'RESPONSE_WINDOW_EXPIRED' using errcode='22023';
    end if;
    select * into v_profile from public.app_profiles p
      where p.id = v_response.worker_profile_id for update;
    if not found or v_profile.account_id <> v_actor or v_profile.kind <> 'WORKER' then
      raise exception 'PROFILE_NOT_OWNED_BY_ACCOUNT' using errcode='42501';
    end if;
    if v_profile.profile_status is distinct from 'ACTIVE'
       or char_length(btrim(coalesce(v_profile.display_name,''))) < 2
       or char_length(btrim(coalesce(v_profile.city,''))) < 2
       or cardinality(coalesce(v_profile.skills,'{}')) < 1 then
      raise exception 'WORKER_PROFILE_NOT_READY' using errcode='P0001';
    end if;
    select coalesce(sum(s.covered_slots),0)::integer into v_selected_slots
      from public.need_selections s where s.need_id=v_need.id and s.status='SELECTED';
    v_remaining_slots := greatest(0, v_need.required_slots-v_selected_slots);
    if v_remaining_slots < 1 then raise exception 'NEED_FULL' using errcode='P0001'; end if;

    if v_action = 'KEEP' then
      v_covered := v_response.covered_slots;
      v_price := v_response.price_rsd;
      v_start := v_response.proposed_start_at;
      v_end := v_response.proposed_end_at;
      v_note := v_response.scope_note;
    else
      v_covered := p_covered_slots;
      v_price := p_price_rsd;
      v_start := p_proposed_start_at;
      v_end := p_proposed_end_at;
      v_note := coalesce(p_scope_note,'');
    end if;

    if v_covered is null or v_covered < 1 then
      raise exception 'INVALID_COVERED_SLOTS' using errcode='22023';
    end if;
    -- WPP01: no personal-profile team limit; keep the task remaining-slot bound.
    if v_covered > v_remaining_slots then
      raise exception 'NEED_REMAINING_CAPACITY_EXCEEDED' using errcode='22023';
    end if;
    perform private.assert_application_price_v5(v_need, v_covered, v_price);
    if (v_start is null) <> (v_end is null)
       or (v_start is not null and v_end is not null and v_start >= v_end) then
      raise exception 'INVALID_PROPOSED_INTERVAL' using errcode='22023';
    end if;
    if char_length(coalesce(v_note,'')) > 1200 then raise exception 'SCOPE_NOTE_TOO_LONG' using errcode='22023'; end if;
    if v_start is null and v_need.schedule_kind='FIXED_WINDOW'
      and (v_need.starts_at is null or v_need.ends_at is null or not isfinite(v_need.starts_at)
        or not isfinite(v_need.ends_at) or v_need.starts_at>=v_need.ends_at) then
      raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
    end if;
    v_match := private.match_detail_for_calendar_interval(v_need.id, v_response.worker_profile_id,
      coalesce(v_start,case when v_need.schedule_kind='FIXED_WINDOW' then v_need.starts_at end),
      coalesce(v_end,case when v_need.schedule_kind='FIXED_WINDOW' then v_need.ends_at end));
    if not coalesce((v_match->>'responseAllowed')::boolean,false) then
      raise exception 'WORKER_NOT_ELIGIBLE' using errcode='P0001', detail=coalesce((v_match->'hardBlockers')::text,'[]');
    end if;

  v_content_hash := encode(sha256(convert_to(jsonb_build_object(
    'needRevision', v_need.revision,
    'pricingMode', v_need.mode,
    'priceRsd', v_price,
    'coveredSlots', v_covered,
    'proposedStartAt', v_start,
    'proposedEndAt', v_end,
    'scopeNote', coalesce(btrim(v_note), ''),
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'workerTeamCapacity', v_profile.team_capacity,
    'workerSkills', to_jsonb(v_profile.skills),
    'workerTools', to_jsonb(v_profile.tools),
    'workerLicenses', to_jsonb(v_profile.licenses),
    'workerVehicles', to_jsonb(v_profile.vehicles)
  )::text, 'UTF8')), 'hex');

    v_new_version := v_response.current_version + 1;

    update public.marketplace_responses
       set current_version = v_new_version,
           status = 'SUBMITTED',
           submitted_against_need_revision = v_need.revision,
           covered_slots = v_covered,
           price_rsd = v_price,
           proposed_start_at = v_start,
           proposed_end_at = v_end,
           scope_note = coalesce(v_note,''),
           submitted_at = statement_timestamp(),
           withdrawn_at = null,
           selected_at = null
     where id = v_response.id
     returning * into v_response;

    insert into public.marketplace_response_versions(
      response_id, version, need_revision, covered_slots, price_rsd,
      proposed_start_at, proposed_end_at, scope_note, content_hash
    ) values (
      v_response.id, v_new_version, v_need.revision, v_covered, v_price,
      v_start, v_end, coalesce(v_note,''), v_content_hash
    );

  insert into private.response_application_snapshots (
    response_id, response_version, snapshot_schema,
    worker_profile_id, worker_team_capacity, covered_slots,
    need_required_slots, need_selected_slots_before_submit,
    need_remaining_slots_before_submit, pricing_mode, requester_price_rsd,
    worker_skills, worker_tools, worker_licenses, worker_vehicles
  ) values (
    v_response.id, v_new_version, 'APPLICATION_V1_SELF_DECLARED',
    v_profile.id, v_profile.team_capacity, v_covered,
    v_need.required_slots, v_selected_slots, v_remaining_slots,
    v_need.mode, v_need.requester_price_rsd,
    v_profile.skills, v_profile.tools, v_profile.licenses, v_profile.vehicles
  );


    v_result := jsonb_build_object(
      'responseId', v_response.id,
      'needId', v_need.id,
      'needRevision', v_need.revision,
      'version', v_new_version,
      'contentHash', v_content_hash,
      'status', v_response.status,
      'action', v_action,
      'idempotentReplay', false,
      'authoritative', true
    );
  end if;

  perform private.audit_marketplace(
    v_actor,
    case when v_action='WITHDRAW' then 'STALE_RESPONSE_WITHDRAWN' else 'STALE_RESPONSE_RECONFIRMED' end,
    'RESPONSE',
    v_response.id,
    v_response.current_version,
    jsonb_build_object('needId',v_need.id,'needRevision',v_need.revision,'action',v_action)
  );

  insert into private.response_revision_resolution_commands(
    worker_account_id, client_request_id, request_hash, response_id, result
  ) values (v_actor, v_request_id, v_request_hash, v_response.id, v_result);

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.need_candidate_states_v5(p_need_id uuid)
 RETURNS TABLE(response_id uuid, candidate_state text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs; c record; remaining integer; s timestamptz; e timestamptz; eligible boolean;
begin
  select * into n from public.needs where id=p_need_id;
  if not found then return; end if;
  remaining:=greatest(n.required_slots-public.fn_need_covered_slots(n.id),0);
  for c in
    select r.id,r.worker_profile_id,r.worker_account_id,r.status,r.current_version,r.covered_slots,
      r.submitted_against_need_revision,v.need_revision as version_revision,v.content_hash,v.price_rsd as version_price,
      v.covered_slots as version_slots, v.proposed_start_at as version_start, v.proposed_end_at as version_end,
      p.account_id as profile_account, p.kind, p.profile_status, p.display_name, p.city, p.skills, p.team_capacity,
      exists(select 1 from public.agreements a where a.selected_response_id=r.id) as has_agreement
    from public.marketplace_responses r
    left join public.marketplace_response_versions v on v.response_id=r.id and v.version=r.current_version
    left join public.app_profiles p on p.id=r.worker_profile_id
    where r.need_id=n.id and r.status<>'DRAFT'
  loop
    response_id:=c.id;
    candidate_state:=case
      when c.has_agreement or c.status='SELECTED' then 'SELECTED'
      when c.status='WITHDRAWN' then 'WITHDRAWN'
      when c.status in ('NOT_SELECTED','EXPIRED') then 'CLOSED'
      when n.status not in ('PUBLISHED','SELECTION')
        or (n.response_deadline is not null and n.response_deadline<=statement_timestamp()) then 'CLOSED'
      when c.kind is distinct from 'WORKER' or c.profile_account is distinct from c.worker_account_id
        or c.profile_status is distinct from 'ACTIVE'
        or char_length(btrim(coalesce(c.display_name,'')))<2
        or char_length(btrim(coalesce(c.city,'')))<2
        or cardinality(coalesce(c.skills,'{}'::text[]))<1
        or c.version_slots is null
        or c.status in ('STALE','STALE_REVIEW_REQUIRED') or c.current_version is null or c.content_hash is null
        or c.version_revision is distinct from n.revision
        or c.submitted_against_need_revision is distinct from n.revision then 'STALE'
      when remaining<=0 then 'FULL'
      when c.covered_slots>remaining or c.version_slots>remaining then 'OVERFILL'
      when c.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') then 'SELECTABLE'
      else 'CLOSED' end;
    if candidate_state='SELECTABLE' then
      s:=coalesce(c.version_start,case when n.schedule_kind='FIXED_WINDOW' then n.starts_at end);
      e:=coalesce(c.version_end,case when n.schedule_kind='FIXED_WINDOW' then n.ends_at end);
      if (c.version_start is null)<>(c.version_end is null)
        or (s is null)<>(e is null)
        or (s is not null and (not isfinite(s) or not isfinite(e) or s>=e))
        or (c.version_start is null and n.schedule_kind='FIXED_WINDOW' and (s is null or e is null)) then
        candidate_state:='STALE';
      else
        eligible:=coalesce((private.match_detail_for_calendar_interval(n.id,c.worker_profile_id,s,e)->>'responseAllowed')::boolean,false);
        if not eligible then candidate_state:='STALE'; end if;
      end if;
      if candidate_state='SELECTABLE' then
        begin
          -- Use the final selection authority, including legacy null/TOTAL/PER_PERSON semantics.
          perform private.assert_application_price_v5(n,c.version_slots,c.version_price);
        exception when sqlstate '22023' or sqlstate 'P0001' then
          if sqlerrm not in ('INVALID_PRICE','FIXED_PRICE_NOT_READY','FIXED_PRICE_MISMATCH',
            'TOTAL_PRICE_REQUIRES_ALL_SLOTS','UNKNOWN_PRICE_BASIS') then raise; end if;
          candidate_state:='STALE';
        end;
      end if;
    end if;
    return next;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION private.need_candidate_states_v5(p_need_id uuid, p_response_ids uuid[])
 RETURNS TABLE(response_id uuid, candidate_state text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs; c record; remaining integer; s timestamptz; e timestamptz; eligible boolean;
begin
  select * into n from public.needs where id=p_need_id;
  if not found then return; end if;
  remaining:=greatest(n.required_slots-public.fn_need_covered_slots(n.id),0);
  for c in
    select r.id,r.worker_profile_id,r.worker_account_id,r.status,r.current_version,r.covered_slots,
      r.submitted_against_need_revision,v.need_revision as version_revision,v.content_hash,v.price_rsd as version_price,
      v.covered_slots as version_slots, v.proposed_start_at as version_start, v.proposed_end_at as version_end,
      p.account_id as profile_account, p.kind, p.profile_status, p.display_name, p.city, p.skills, p.team_capacity,
      exists(select 1 from public.agreements a where a.selected_response_id=r.id) as has_agreement
    from public.marketplace_responses r
    left join public.marketplace_response_versions v on v.response_id=r.id and v.version=r.current_version
    left join public.app_profiles p on p.id=r.worker_profile_id
    where r.need_id=n.id and r.status<>'DRAFT' and r.id = any(p_response_ids)
  loop
    response_id:=c.id;
    candidate_state:=case
      when c.has_agreement or c.status='SELECTED' then 'SELECTED'
      when c.status='WITHDRAWN' then 'WITHDRAWN'
      when c.status in ('NOT_SELECTED','EXPIRED') then 'CLOSED'
      when n.status not in ('PUBLISHED','SELECTION')
        or (n.response_deadline is not null and n.response_deadline<=statement_timestamp()) then 'CLOSED'
      when c.kind is distinct from 'WORKER' or c.profile_account is distinct from c.worker_account_id
        or c.profile_status is distinct from 'ACTIVE'
        or char_length(btrim(coalesce(c.display_name,'')))<2
        or char_length(btrim(coalesce(c.city,'')))<2
        or cardinality(coalesce(c.skills,'{}'::text[]))<1
        or c.version_slots is null
        or c.status in ('STALE','STALE_REVIEW_REQUIRED') or c.current_version is null or c.content_hash is null
        or c.version_revision is distinct from n.revision
        or c.submitted_against_need_revision is distinct from n.revision then 'STALE'
      when remaining<=0 then 'FULL'
      when c.covered_slots>remaining or c.version_slots>remaining then 'OVERFILL'
      when c.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') then 'SELECTABLE'
      else 'CLOSED' end;
    if candidate_state='SELECTABLE' then
      s:=coalesce(c.version_start,case when n.schedule_kind='FIXED_WINDOW' then n.starts_at end);
      e:=coalesce(c.version_end,case when n.schedule_kind='FIXED_WINDOW' then n.ends_at end);
      if (c.version_start is null)<>(c.version_end is null)
        or (s is null)<>(e is null)
        or (s is not null and (not isfinite(s) or not isfinite(e) or s>=e))
        or (c.version_start is null and n.schedule_kind='FIXED_WINDOW' and (s is null or e is null)) then
        candidate_state:='STALE';
      else
        eligible:=coalesce((private.match_detail_for_calendar_interval(n.id,c.worker_profile_id,s,e)->>'responseAllowed')::boolean,false);
        if not eligible then candidate_state:='STALE'; end if;
      end if;
      if candidate_state='SELECTABLE' then
        begin
          -- Use the final selection authority, including legacy null/TOTAL/PER_PERSON semantics.
          perform private.assert_application_price_v5(n,c.version_slots,c.version_price);
        exception when sqlstate '22023' or sqlstate 'P0001' then
          if sqlerrm not in ('INVALID_PRICE','FIXED_PRICE_NOT_READY','FIXED_PRICE_MISMATCH',
            'TOTAL_PRICE_REQUIRES_ALL_SLOTS','UNKNOWN_PRICE_BASIS') then raise; end if;
          candidate_state:='STALE';
        end;
      end if;
    end if;
    return next;
  end loop;
end;
$function$;

DO $postflight$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.rpc_save_need_draft_from_review(uuid,uuid,text)'::regprocedure
   AND md5(p.prosrc)='3dceed88dd27346ce7827ff893eb103c' AND p.prosecdef=true
   AND p.provolatile='v' AND p.proparallel='u'
   AND coalesce(p.proacl::text,'')='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
   AND coalesce(p.proconfig::text,'')='{search_path=pg_catalog}') THEN
     RAISE EXCEPTION 'START_ONLY_API_SOURCE_OR_PRIVILEGES_DRIFT: start-only-save.candidate.sql' USING errcode='PT409';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)'::regprocedure
   AND md5(p.prosrc)='e24c7b0b36ac114a8d7dd22d2a3ce8d7' AND p.prosecdef=true
   AND p.provolatile='v' AND p.proparallel='u'
   AND coalesce(p.proacl::text,'')='{postgres=X/postgres}'
   AND coalesce(p.proconfig::text,'')='{search_path=pg_catalog}') THEN
     RAISE EXCEPTION 'START_ONLY_API_SOURCE_OR_PRIVILEGES_DRIFT: start-only-edit.candidate.sql' USING errcode='PT409';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)'::regprocedure
   AND md5(p.prosrc)='66aab6df0d625e24e0073c27bfe2aa91' AND p.prosecdef=true
   AND p.provolatile='v' AND p.proparallel='u'
   AND coalesce(p.proacl::text,'')='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'
   AND coalesce(p.proconfig::text,'')='{search_path=pg_catalog}') THEN
     RAISE EXCEPTION 'START_ONLY_API_SOURCE_OR_PRIVILEGES_DRIFT: start-only-submit.candidate.sql' USING errcode='PT409';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure
   AND md5(p.prosrc)='6a8fd871a60779bc438119b21a900dca' AND p.prosecdef=true
   AND p.provolatile='v' AND p.proparallel='u'
   AND coalesce(p.proacl::text,'')='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
   AND coalesce(p.proconfig::text,'')='{"search_path=public, pg_temp"}') THEN
     RAISE EXCEPTION 'START_ONLY_API_SOURCE_OR_PRIVILEGES_DRIFT: start-only-select.candidate.sql' USING errcode='PT409';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)'::regprocedure
   AND md5(p.prosrc)='9634b0333c3bd5dab208286f04d8e556' AND p.prosecdef=true
   AND p.provolatile='v' AND p.proparallel='u'
   AND coalesce(p.proacl::text,'')='{postgres=X/postgres,authenticated=X/postgres}'
   AND coalesce(p.proconfig::text,'')='{search_path=pg_catalog}') THEN
     RAISE EXCEPTION 'START_ONLY_API_SOURCE_OR_PRIVILEGES_DRIFT: start-only-stale.candidate.sql' USING errcode='PT409';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='private.need_candidate_states_v5(uuid)'::regprocedure
   AND md5(p.prosrc)='112ed258e838b2cae22b248ac94ebe7c' AND p.prosecdef=true
   AND p.provolatile='s' AND p.proparallel='u'
   AND coalesce(p.proacl::text,'')='{postgres=X/postgres}'
   AND coalesce(p.proconfig::text,'')='{search_path=pg_catalog}') THEN
     RAISE EXCEPTION 'START_ONLY_API_SOURCE_OR_PRIVILEGES_DRIFT: start-only-candidate-states.candidate.sql' USING errcode='PT409';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='private.need_candidate_states_v5(uuid,uuid[])'::regprocedure
   AND md5(p.prosrc)='20092ecb2a781776ddb0ce9c46ba8aa5' AND p.prosecdef=true
   AND p.provolatile='s' AND p.proparallel='u'
   AND coalesce(p.proacl::text,'')='{postgres=X/postgres}'
   AND coalesce(p.proconfig::text,'')='{search_path=pg_catalog}') THEN
     RAISE EXCEPTION 'START_ONLY_API_SOURCE_OR_PRIVILEGES_DRIFT: start-only-candidate-states-batch.candidate.sql' USING errcode='PT409';
 END IF;
END $postflight$;
COMMIT;
