-- PED02: staged task replacement. Original stays public until canonical publication succeeds.
set local lock_timeout='5s';


create function private.task_replacement_origin(p_need_id uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog as $f$
 select d.result->'replacement' from private.need_draft_save_commands d
 where d.need_id=p_need_id and d.result->'replacement'->>'version'='TASK_REPLACEMENT_V1'
 order by d.created_at limit 1;
$f$;

create function private.assert_task_replacement_source(p_source uuid,p_revision integer,p_fingerprint text) returns void
language plpgsql security definer set search_path=pg_catalog as $f$
declare n public.needs;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 select * into n from public.needs where id=p_source for update;
 if not found or n.requester_account_id is distinct from auth.uid() then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501';end if;
 perform private.closure_assert_open(auth.uid());
 if exists(select 1 from public.agreements where need_id=n.id)
 or exists(select 1 from public.need_selections where need_id=n.id)
 or exists(select 1 from public.marketplace_responses where need_id=n.id and status='SELECTED')
 then raise exception 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' using errcode='P0001';end if;
 if n.status not in ('PUBLISHED','SELECTION') or n.revision is distinct from p_revision
 or private.need_edit_base_marker(n.id) is distinct from p_fingerprint
 then raise exception 'REPLACEMENT_SOURCE_STALE' using errcode='PT409';end if;
end $f$;
revoke all on function private.task_replacement_origin(uuid),private.assert_task_replacement_source(uuid,integer,text) from public,anon,authenticated,service_role;


CREATE OR REPLACE FUNCTION private.stage_task_replacement(p_conversation_id uuid, p_requester_profile_id uuid, p_client_request_id text, p_replacement jsonb)
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
  v_handoff jsonb;
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
  if v_schedule_kind='FIXED_WINDOW' and (v_starts_at is null or not isfinite(v_starts_at)
      or (v_ends_at is not null and (not isfinite(v_ends_at) or v_ends_at<=v_starts_at))) then
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
  v_handoff:=case when v_exec_mode='REMOTE' then v_facts->'need.handoff' else null end;
  if v_exec_mode='REMOTE' and v_handoff is null then
    raise exception 'HANDOFF_REQUIRED' using errcode='22023';
  end if;
  if v_handoff is not null then
    perform private.validate_need_v2_fact('need.handoff',v_handoff);
    v_conditions:=array_append(array_remove(v_conditions,'Predaja: '||private.taxonomy_handoff_display_v1(v_handoff)),
      'Predaja: '||private.taxonomy_handoff_display_v1(v_handoff));
  end if;
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
    'confirmedFacts',v_facts, 'replacement',p_replacement
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
  if v_conv.bound_need_id is distinct from (p_replacement->>'sourceNeedId')::uuid
    or p_replacement->>'version' is distinct from 'TASK_REPLACEMENT_V1'
    or (p_replacement->>'targetBaseRevision')::integer is distinct from 0
    or (p_replacement->>'targetNeedId')::uuid = v_conv.bound_need_id
  then raise exception 'TASK_REVIEW_COMMAND_MISMATCH' using errcode='42501';end if;
  perform private.assert_task_replacement_source(v_conv.bound_need_id,(p_replacement->>'sourceRevision')::integer,p_replacement->>'sourceFingerprint');

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
    id,requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,schedule_kind,starts_at,ends_at,required_slots,
    mode,requester_price_rsd,required_skills,required_tools,required_vehicles,
    required_licenses,verified_identity_required,minimum_experience_years,
    execution_location_mode,public_photo_paths,task_country_code,task_timezone,price_basis
  ) values (
    (p_replacement->>'targetNeedId')::uuid,v_uid,p_requester_profile_id,'DRAFT',v_title,v_description,v_category,
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
    insert into public.need_requirement_details(need_id,critical_conditions,handoff)
    values(v_need_id,v_conditions,v_handoff);
  end if;

  -- Preserve source-bound facts and immutable edit marker. Candidate corrections
  -- open their own conversation; source conversation now owns a durable command.
  update public.ai_conversations set status='COMPLETED',completed_at=statement_timestamp()
   where id=p_conversation_id;

  v_result:=jsonb_build_object(
    'needId',v_need_id,
    'status','DRAFT',
    'revision',1,
    'conversationId',p_conversation_id,
    'authoritative',true, 'replacement',p_replacement
  );

  insert into private.need_draft_save_commands(
    account_id,client_request_id,request_hash,conversation_id,requester_profile_id,need_id,result
  ) values (
    v_uid,btrim(p_client_request_id),v_hash,p_conversation_id,p_requester_profile_id,v_need_id,v_result
  );

  return v_result;
end
$function$;

revoke all on function private.stage_task_replacement(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;

do $pin$ begin if (select md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rpc_prepare_ai_task_review') is distinct from '7b23bd0df32547086d939355be74257a' then raise exception 'PED02_PREIMAGE_CHANGED: rpc_prepare_ai_task_review'; end if; end $pin$;

CREATE OR REPLACE FUNCTION public.rpc_prepare_ai_task_review(p_conversation_id uuid, p_response_deadline timestamp with time zone DEFAULT NULL::timestamp with time zone, p_location jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare u uuid:=auth.uid(); c public.ai_conversations; n public.needs; profile_id uuid; source jsonb; source_fingerprint text;
 replacement jsonb; origin jsonb; old_location jsonb; location jsonb; review jsonb; facts jsonb:='[]'; item jsonb; k text; val jsonb;
 missing jsonb; policy jsonb; envelope jsonb; rid uuid:=extensions.gen_random_uuid(); expires timestamptz:=clock_timestamp()+interval '15 minutes';
 geo_keys text[]:=array['need.task_country_code','need.task_geography','need.exact_address','need.access_notes','need.resolved_location'];
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform private.closure_assert_open(u);
 lock table private.publication_policy_bundles,private.publication_policy_rule_refs,private.location_market_configs in share mode;
 select * into c from public.ai_conversations where id=p_conversation_id for update;
 if not found or c.account_id<>u then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
 if c.status<>'OPEN' or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2'
 then raise exception 'TASK_REVIEW_NOT_EDITABLE' using errcode='55000'; end if;
 if c.bound_need_id is not null then
  -- Match the canonical edit writer's conversation -> Need lock order.
  select * into n from public.needs where id=c.bound_need_id for update;
  if not found or n.requester_account_id<>u then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
  if n.status not in('DRAFT','PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='55000'; end if;
  if c.need_edit_base_fingerprint is distinct from private.need_edit_base_marker(n.id) then raise exception 'TASK_REVIEW_STALE' using errcode='PT409'; end if;
 end if;
 if n.id is not null then
  origin:=private.task_replacement_origin(n.id);
  if origin is not null and n.status='DRAFT' then
   replacement:=origin||jsonb_build_object('targetBaseRevision',n.revision);
  elsif n.status in ('PUBLISHED','SELECTION') then
   replacement:=jsonb_build_object('version','TASK_REPLACEMENT_V1','sourceNeedId',n.id,
    'sourceRevision',n.revision,'sourceFingerprint',private.need_edit_base_marker(n.id),
    'targetNeedId',extensions.gen_random_uuid(),'targetBaseRevision',0);
  end if;
  if replacement is not null then
   perform private.assert_task_replacement_source((replacement->>'sourceNeedId')::uuid,
    (replacement->>'sourceRevision')::integer,replacement->>'sourceFingerprint');
  end if;
 end if;
 select id into profile_id from public.app_profiles where account_id=u and kind='REQUESTER' and profile_status='ACTIVE' for share;
 if profile_id is null then raise exception 'REQUESTER_PROFILE_NOT_READY' using errcode='42501'; end if;
 if p_response_deadline is not null and p_response_deadline<=clock_timestamp() then raise exception 'RESPONSE_DEADLINE_INVALID' using errcode='22023'; end if;
 source:=private.ai_task_review_source(c.id);
 source_fingerprint:=encode(extensions.digest(source::text,'sha256'),'hex');
 review:=public.rpc_ai_need_review_v2(c.id);
 if jsonb_array_length(review->'facts')>(select count(*) from private.need_fact_registry) then raise exception 'TASK_REVIEW_INPUT_INVALID' using errcode='22023'; end if;
 old_location:=private.need_location_review_document(c.id);
 if p_location is not null and p_location<>'null'::jsonb then
  if jsonb_typeof(p_location)<>'object' or p_location-array['expectedRevision','value']<>'{}'::jsonb
   or not(p_location ?& array['expectedRevision','value']) or p_location->>'expectedRevision' is distinct from old_location->>'revision'
  then raise exception 'LOCATION_VERSION_CONFLICT' using errcode='PT409'; end if;
  location:=private.normalize_need_location(p_location->'value');
 elsif old_location#>>'{value,taskCountryCode}' is not null and old_location#>'{value,geography}'<>'null'::jsonb then
  location:=private.normalize_need_location(old_location->'value');
 end if;
 for item in select x from jsonb_array_elements(review->'facts') x loop
  k:=item->>'key'; perform private.validate_need_v2_fact(k,item->'value');
  if location is not null and k=any(geo_keys) then continue; end if;
  facts:=facts||jsonb_build_array(item-array['schemaVersion','valueType','requiredForDraft','material','evidence']);
 end loop;
 if location is not null then
  foreach k in array geo_keys loop
   val:=location->case k when 'need.task_country_code' then 'taskCountryCode' when 'need.task_geography' then 'geography'
    when 'need.exact_address' then 'exactAddress' when 'need.access_notes' then 'accessNotes' else 'resolvedLocation' end;
   if val is null or val='null'::jsonb then continue; end if;
   item:=null;
   if p_location is null or p_location='null'::jsonb then
    select f into item from jsonb_array_elements(review->'facts') f where f->>'key'=k and f->'value'=val;
   end if;
   facts:=facts||jsonb_build_array(jsonb_build_object('id',item->'id','key',k,'value',val,
    'displayValue',case when k='need.resolved_location' then 'Privatne tačke lokacije' when k='need.task_geography'
     then case when val->>'mode'='REMOTE' then 'Rad na daljinu' else coalesce(val#>>'{start,city}',val#>>'{serviceArea,city}',val->>'mode') end
     else val#>>'{}' end,'status',coalesce(item->>'status','NEEDS_CONFIRMATION'),'source',coalesce(item->>'source','EXPLICIT_USER_ANSWER'),
    'privacyClass',case when k in('need.exact_address','need.access_notes','need.resolved_location') then 'PRIVATE' else 'PUBLIC' end));
  end loop;
 end if;
 select coalesce(jsonb_agg(r.fact_key order by r.fact_key),'[]'::jsonb) into missing from private.need_fact_registry r
  where r.required_for_draft and not exists(select 1 from jsonb_array_elements(facts) f where f->>'key'=r.fact_key and f->>'status'<>'UNKNOWN');
 policy:=private.ai_task_review_policy(location->>'taskCountryCode');
 -- Identical refreshes reuse the same immutable review without extending expiry.
 select r.envelope into envelope from private.ai_task_reviews r where r.account_id=u and r.conversation_id=c.id
  and r.source_hash=source_fingerprint and r.policy_binding=policy and r.expires_at>clock_timestamp()
  and ((r.envelope->'replacement')-'targetNeedId') is not distinct from (replacement-'targetNeedId')
  and (not exists(select 1 from jsonb_array_elements(facts) identity_fact
 where identity_fact->>'key'='need.verified_identity_required' and identity_fact->'value'='true'::jsonb) or r.envelope->'canAccept'='false'::jsonb)
  and r.envelope->'location' is not distinct from coalesce(location,'null'::jsonb)
  and (r.envelope->>'responseDeadline')::timestamptz is not distinct from p_response_deadline
  order by r.created_at desc,r.id limit 1;
 if found then return envelope; end if;
 envelope:=jsonb_build_object('reviewId',rid,'accountId',u,'conversationId',c.id,'schemaVersion','NEED_FACT_V2',
  'draftId',c.bound_need_id,'draftRevision',coalesce(n.revision,0),
  'factsRevision',source_fingerprint,'sourceTurnRevision',coalesce((select max(sequence_no) from public.ai_messages where conversation_id=c.id),0),
  'geographyRevision',old_location->>'revision','expiresAt',expires,'responseDeadline',p_response_deadline,
  'publicProjection',coalesce((select jsonb_agg(f order by f->>'key') from jsonb_array_elements(facts) f where f->>'privacyClass'='PUBLIC'),'[]'::jsonb),
  'ownerPrivateProjection',coalesce((select jsonb_agg(f order by f->>'key') from jsonb_array_elements(facts) f where f->>'privacyClass'='PRIVATE'),'[]'::jsonb),
  'location',location,'missingRequired',missing,'safety',review->>'safety',
  'canAccept',jsonb_array_length(missing)=0 and location is not null and review->>'safety'<>'BLOCK'
   and not exists(select 1 from jsonb_array_elements(facts) identity_fact
 where identity_fact->>'key'='need.verified_identity_required' and identity_fact->'value'='true'::jsonb)
   and not exists(select 1 from private.ai_need_turn_commands where conversation_id=c.id and state='PROCESSING'));
 if replacement is not null then envelope:=envelope||jsonb_build_object('replacement',replacement);end if;
 envelope:=envelope||jsonb_build_object('displayedContentDigest',encode(extensions.digest(jsonb_build_object('envelope',envelope,'policy',policy)::text,'sha256'),'hex'));
 insert into private.ai_task_reviews(id,account_id,conversation_id,requester_profile_id,source_hash,policy_binding,envelope,expires_at)
 values(rid,u,c.id,profile_id,source_fingerprint,policy,envelope,expires);
 return envelope;
end $function$;

do $pin$ begin if (select md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rpc_prepare_ai_task_review_taxonomy') is distinct from 'ef6912965fb528c9283143da87374376' then raise exception 'PED02_PREIMAGE_CHANGED: rpc_prepare_ai_task_review_taxonomy'; end if; end $pin$;

CREATE OR REPLACE FUNCTION public.rpc_prepare_ai_task_review_taxonomy(p_conversation_id uuid, p_response_deadline timestamp with time zone DEFAULT NULL::timestamp with time zone, p_location jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare u uuid:=auth.uid(); c public.ai_conversations; n public.needs; profile_id uuid; source jsonb; source_fingerprint text;
 replacement jsonb; origin jsonb; old_location jsonb; location jsonb; review jsonb; facts jsonb:='[]'; item jsonb; k text; val jsonb;
 missing jsonb; policy jsonb; envelope jsonb; v_service text; v_mode text; v_scope text; v_projection jsonb; v_handoff jsonb; rid uuid:=extensions.gen_random_uuid(); expires timestamptz:=clock_timestamp()+interval '15 minutes';
 geo_keys text[]:=array['need.task_country_code','need.task_geography','need.exact_address','need.access_notes','need.resolved_location'];
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform private.closure_assert_open(u);
 lock table private.publication_policy_bundles,private.publication_policy_rule_refs,private.location_market_configs in share mode;
 select * into c from public.ai_conversations where id=p_conversation_id for update;
 if not found or c.account_id<>u then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
 if c.status<>'OPEN' or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2'
 then raise exception 'TASK_REVIEW_NOT_EDITABLE' using errcode='55000'; end if;
 if c.bound_need_id is not null then
  -- Match the canonical edit writer's conversation -> Need lock order.
  select * into n from public.needs where id=c.bound_need_id for update;
  if not found or n.requester_account_id<>u then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
  if n.status not in('DRAFT','PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='55000'; end if;
  if c.need_edit_base_fingerprint is distinct from private.need_edit_base_marker(n.id) then raise exception 'TASK_REVIEW_STALE' using errcode='PT409'; end if;
 end if;
 if n.id is not null then
  origin:=private.task_replacement_origin(n.id);
  if origin is not null and n.status='DRAFT' then
   replacement:=origin||jsonb_build_object('targetBaseRevision',n.revision);
  elsif n.status in ('PUBLISHED','SELECTION') then
   replacement:=jsonb_build_object('version','TASK_REPLACEMENT_V1','sourceNeedId',n.id,
    'sourceRevision',n.revision,'sourceFingerprint',private.need_edit_base_marker(n.id),
    'targetNeedId',extensions.gen_random_uuid(),'targetBaseRevision',0);
  end if;
  if replacement is not null then
   perform private.assert_task_replacement_source((replacement->>'sourceNeedId')::uuid,
    (replacement->>'sourceRevision')::integer,replacement->>'sourceFingerprint');
  end if;
 end if;
 select id into profile_id from public.app_profiles where account_id=u and kind='REQUESTER' and profile_status='ACTIVE' for share;
 if profile_id is null then raise exception 'REQUESTER_PROFILE_NOT_READY' using errcode='42501'; end if;
 if p_response_deadline is not null and p_response_deadline<=clock_timestamp() then raise exception 'RESPONSE_DEADLINE_INVALID' using errcode='22023'; end if;
 source:=private.ai_task_review_source(c.id);
 source_fingerprint:=encode(extensions.digest(source::text,'sha256'),'hex');
 review:=public.rpc_ai_need_review_v2(c.id);
 if jsonb_array_length(review->'facts')>(select count(*) from private.need_fact_registry) then raise exception 'TASK_REVIEW_INPUT_INVALID' using errcode='22023'; end if;
 old_location:=private.need_location_review_document(c.id);
 if p_location is not null and p_location<>'null'::jsonb then
  if jsonb_typeof(p_location)<>'object' or p_location-array['expectedRevision','value']<>'{}'::jsonb
   or not(p_location ?& array['expectedRevision','value']) or p_location->>'expectedRevision' is distinct from old_location->>'revision'
  then raise exception 'LOCATION_VERSION_CONFLICT' using errcode='PT409'; end if;
  location:=private.normalize_need_location(p_location->'value');
 elsif old_location#>>'{value,taskCountryCode}' is not null and old_location#>'{value,geography}'<>'null'::jsonb then
  location:=private.normalize_need_location(old_location->'value');
 end if;
 for item in select x from jsonb_array_elements(review->'facts') x loop
  k:=item->>'key'; perform private.validate_need_v2_fact(k,item->'value');
  if location is not null and k=any(geo_keys) then continue; end if;
  if k='need.handoff' then
    if location#>>'{geography,mode}' is distinct from 'REMOTE' then continue; end if;
    item:=item||jsonb_build_object('displayValue',private.taxonomy_handoff_display_v1(item->'value'));
  end if;
  facts:=facts||jsonb_build_array(item-array['schemaVersion','valueType','requiredForDraft','material','evidence']);
 end loop;
 if location is not null then
  foreach k in array geo_keys loop
   val:=location->case k when 'need.task_country_code' then 'taskCountryCode' when 'need.task_geography' then 'geography'
    when 'need.exact_address' then 'exactAddress' when 'need.access_notes' then 'accessNotes' else 'resolvedLocation' end;
   if val is null or val='null'::jsonb then continue; end if;
   item:=null;
   if p_location is null or p_location='null'::jsonb then
    select f into item from jsonb_array_elements(review->'facts') f where f->>'key'=k and f->'value'=val;
   end if;
   facts:=facts||jsonb_build_array(jsonb_build_object('id',item->'id','key',k,'value',val,
    'displayValue',case when k='need.resolved_location' then 'Privatne tačke lokacije' when k='need.task_geography'
     then case when val->>'mode'='REMOTE' then 'Rad na daljinu' else coalesce(val#>>'{start,city}',val#>>'{serviceArea,city}',val->>'mode') end
     else val#>>'{}' end,'status',coalesce(item->>'status','NEEDS_CONFIRMATION'),'source',coalesce(item->>'source','EXPLICIT_USER_ANSWER'),
    'privacyClass',case when k in('need.exact_address','need.access_notes','need.resolved_location') then 'PRIVATE' else 'PUBLIC' end));
  end loop;
 end if;
 select coalesce(jsonb_agg(r.fact_key order by r.fact_key),'[]'::jsonb) into missing from private.need_fact_registry r
  where r.required_for_draft and not exists(select 1 from jsonb_array_elements(facts) f where f->>'key'=r.fact_key and f->>'status'<>'UNKNOWN');
 policy:=private.ai_task_review_policy(location->>'taskCountryCode');
 -- Identical refreshes reuse the same immutable review without extending expiry.
 select r.envelope into envelope from private.ai_task_reviews r where r.account_id=u and r.conversation_id=c.id
  and r.source_hash=source_fingerprint and r.policy_binding=policy and r.expires_at>clock_timestamp()
  and ((r.envelope->'replacement')-'targetNeedId') is not distinct from (replacement-'targetNeedId')
  and (not exists(select 1 from jsonb_array_elements(facts) identity_fact
 where identity_fact->>'key'='need.verified_identity_required' and identity_fact->'value'='true'::jsonb) or r.envelope->'canAccept'='false'::jsonb)
  and r.envelope ? 'classificationState'
  and r.envelope->>'classificationState'='READY'
  and (location#>>'{geography,mode}' is distinct from 'REMOTE' or exists(
    select 1 from jsonb_array_elements(r.envelope->'publicProjection') f
    where f->>'key'='need.handoff' and f->>'status'<>'UNKNOWN'
      and private.taxonomy_handoff_valid_v1(f->'value')))
  and r.envelope->>'classificationCatalogFingerprint'=private.taxonomy_admission_fingerprint_v1()
  and r.envelope->'location' is not distinct from coalesce(location,'null'::jsonb)
  and (r.envelope->>'responseDeadline')::timestamptz is not distinct from p_response_deadline
  order by r.created_at desc,r.id limit 1;
 if found then return envelope; end if;
 envelope:=jsonb_build_object('reviewId',rid,'accountId',u,'conversationId',c.id,'schemaVersion','NEED_FACT_V2',
  'draftId',c.bound_need_id,'draftRevision',coalesce(n.revision,0),
  'factsRevision',source_fingerprint,'sourceTurnRevision',coalesce((select max(sequence_no) from public.ai_messages where conversation_id=c.id),0),
  'geographyRevision',old_location->>'revision','expiresAt',expires,'responseDeadline',p_response_deadline,
  'publicProjection',coalesce((select jsonb_agg(f order by f->>'key') from jsonb_array_elements(facts) f where f->>'privacyClass'='PUBLIC'),'[]'::jsonb),
  'ownerPrivateProjection',coalesce((select jsonb_agg(f order by f->>'key') from jsonb_array_elements(facts) f where f->>'privacyClass'='PRIVATE'),'[]'::jsonb),
  'location',location,'missingRequired',missing,'safety',review->>'safety',
  'canAccept',jsonb_array_length(missing)=0 and location is not null and review->>'safety'<>'BLOCK'
   and not exists(select 1 from jsonb_array_elements(facts) identity_fact
 where identity_fact->>'key'='need.verified_identity_required' and identity_fact->'value'='true'::jsonb)
   and not exists(select 1 from private.ai_need_turn_commands where conversation_id=c.id and state='PROCESSING'));
 -- The published Need review owns the exact service text and geography mode.
 -- Gemini hints are revalidated against current source and catalog by the
 -- private projection before they enter the signed owner review.
 select f->>'value' into v_service from jsonb_array_elements(facts) f
   where f->>'key'='need.category' and f->>'status'<>'UNKNOWN'
   order by f->>'id' limit 1;
 v_scope:=location#>>'{geography,mode}';
 v_mode:=case when v_scope='REMOTE' then 'REMOTE'
   when v_scope in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED') then 'ON_SITE'
   else null end;
 if v_service is not null and v_mode is not null then
   v_projection:=private.taxonomy_review_candidate_projection_v2(
     'NEED_SERVICE',jsonb_build_array(v_service),
     jsonb_build_array(jsonb_build_object('service',v_service,'mode',v_mode)),u,c.id);
 else
   v_projection:=jsonb_build_object('status','PENDING_CLASSIFICATION',
     'classificationCandidates','[]'::jsonb,'reviewedServiceModes','[]'::jsonb,
     'classificationCatalogVersion',null,'classificationCatalogFingerprint',null);
 end if;
 -- The typed owner fact is the only task handoff authority. Hints cannot add a
 -- hidden routing constraint; conflicts stay unresolved before the digest.
 select f->'value' into v_handoff from jsonb_array_elements(facts) f
   where f->>'key'='need.handoff' and f->>'status'<>'UNKNOWN';
 if v_mode='REMOTE' and (v_handoff is null or not private.taxonomy_handoff_valid_v1(v_handoff)) then
   v_projection:=v_projection||jsonb_build_object('status','PENDING_CLASSIFICATION','classificationCandidates','[]'::jsonb,'classificationCatalogVersion',null,'classificationCatalogFingerprint',null);
   envelope:=envelope||jsonb_build_object('canAccept',false,'missingRequired',missing||jsonb_build_array('need.handoff'));
 elsif v_projection->>'status'='READY' and v_mode='REMOTE' then
   if v_projection#>'{classificationCandidates,0,handoff}' is not null
      and v_projection#>'{classificationCandidates,0,handoff}' is distinct from v_handoff then
     v_projection:=v_projection||jsonb_build_object('status','PENDING_CLASSIFICATION','classificationCandidates','[]'::jsonb,'classificationCatalogVersion',null,'classificationCatalogFingerprint',null);
     envelope:=envelope||jsonb_build_object('canAccept',false);
   elsif v_handoff is not null then
     v_projection:=jsonb_set(v_projection,'{classificationCandidates,0,handoff}',v_handoff,true);
   end if;
 end if;
 -- Owner sees service and geography in the *existing* publicProjection + location.
 -- Additive signed keys are computed BEFORE the original digest, never after.
 envelope:=envelope||jsonb_build_object('classificationState',v_projection->>'status',
   'classificationCandidates',v_projection->'classificationCandidates',
   'classificationCatalogVersion',v_projection->'classificationCatalogVersion',
   'classificationCatalogFingerprint',v_projection->'classificationCatalogFingerprint',
   'reviewedServiceModes',v_projection->'reviewedServiceModes');
 if replacement is not null then envelope:=envelope||jsonb_build_object('replacement',replacement);end if;
 envelope:=envelope||jsonb_build_object('displayedContentDigest',encode(extensions.digest(jsonb_build_object('envelope',envelope,'policy',policy)::text,'sha256'),'hex'));
 insert into private.ai_task_reviews(id,account_id,conversation_id,requester_profile_id,source_hash,policy_binding,envelope,expires_at)
 values(rid,u,c.id,profile_id,source_fingerprint,policy,envelope,expires);
 return envelope;
end $function$;

do $pin$ begin if (select md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rpc_accept_ai_task_review') is distinct from 'bf5fb86318e9a05d2d00087650b72c47' then raise exception 'PED02_PREIMAGE_CHANGED: rpc_accept_ai_task_review'; end if; end $pin$;

CREATE OR REPLACE FUNCTION public.rpc_accept_ai_task_review(p_review_id uuid, p_displayed_content_digest text, p_client_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare u uuid:=auth.uid(); r private.ai_task_reviews; c public.ai_conversations; cmd private.ai_task_review_commands;
 source_hash text; f record; saved jsonb; n public.needs;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_client_request_id is null or p_displayed_content_digest is null or p_displayed_content_digest !~ '^[a-f0-9]{64}$'
 then raise exception 'TASK_REVIEW_INPUT_INVALID' using errcode='22023'; end if;
 perform private.closure_assert_open(u);
 lock table private.publication_policy_bundles,private.publication_policy_rule_refs,private.location_market_configs in share mode;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:task-review-command:'||u::text||':'||p_client_request_id::text,126));
 select * into r from private.ai_task_reviews where id=p_review_id and account_id=u;
 if not found then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
 if r.envelope->>'displayedContentDigest'<>p_displayed_content_digest then raise exception 'TASK_REVIEW_DIGEST_MISMATCH' using errcode='PT409'; end if;
 select * into c from public.ai_conversations where id=r.conversation_id and account_id=u for update;
 if not found then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
 select * into cmd from private.ai_task_review_commands where account_id=u and client_request_id=p_client_request_id;
 if found and cmd.review_id<>r.id then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023'; end if;
 if exists(select 1 from private.ai_task_review_commands where review_id=r.id) then return private.ai_task_review_command_document(r.id); end if;
 if r.expires_at<=clock_timestamp() then raise exception 'TASK_REVIEW_EXPIRED' using errcode='PT409'; end if;
 if c.bound_need_id is not null then
  select * into n from public.needs where id=c.bound_need_id for update;
  if not found or n.requester_account_id<>u then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
  if n.id is distinct from (r.envelope->>'draftId')::uuid or n.revision is distinct from (r.envelope->>'draftRevision')::integer
  then raise exception 'TASK_REVIEW_STALE' using errcode='PT409'; end if;
  if n.status in ('PUBLISHED','SELECTION') and not (r.envelope ? 'replacement') then
   raise exception 'PUBLISHED_TASK_EDIT_NOT_READY' using errcode='P0001';
  end if;
  if r.envelope ? 'replacement' then
   perform private.assert_task_replacement_source((r.envelope#>>'{replacement,sourceNeedId}')::uuid,
    (r.envelope#>>'{replacement,sourceRevision}')::integer,r.envelope#>>'{replacement,sourceFingerprint}');
  elsif private.task_replacement_origin(n.id) is not null and n.status='DRAFT' then
   raise exception 'TASK_REVIEW_STALE' using errcode='PT409';
  end if;
 end if;
 source_hash:=encode(extensions.digest(private.ai_task_review_source(c.id)::text,'sha256'),'hex');
 if source_hash<>r.source_hash then raise exception 'TASK_REVIEW_STALE' using errcode='PT409'; end if;
 if r.policy_binding is distinct from private.ai_task_review_policy(r.envelope#>>'{location,taskCountryCode}')
 then raise exception 'TASK_REVIEW_POLICY_STALE' using errcode='PT409'; end if;
 if exists(select 1 from jsonb_array_elements(r.envelope->'publicProjection') identity_fact
  where identity_fact->>'key'='need.verified_identity_required' and identity_fact->'value'='true'::jsonb)
 then raise exception 'IDENTITY_VERIFICATION_UNAVAILABLE' using errcode='22023';end if;
 if r.envelope->'canAccept' is distinct from 'true'::jsonb then raise exception 'TASK_REVIEW_INCOMPLETE' using errcode='22023'; end if;
 -- Acceptance is confined to the exact server-stored IDs and normalized geography
 -- displayed by this review. No client loop or new/unseen AI turn can be accepted.
 perform public.rpc_save_need_location_review(c.id,r.envelope->>'geographyRevision',r.envelope->'location',true);
 for f in select id from public.ai_structured_facts where conversation_id=c.id and superseded_at is null
  and fact_key not in('need.task_country_code','need.task_geography','need.exact_address','need.access_notes','need.resolved_location') order by fact_key loop
  perform public.rpc_ai_confirm_fact(f.id);
 end loop;
 if r.envelope ? 'replacement' and (r.envelope#>>'{replacement,targetBaseRevision}')::integer=0 then
  saved:=private.stage_task_replacement(c.id,r.requester_profile_id,'v5-replacement:'||r.id::text,r.envelope->'replacement');
 elsif c.bound_need_id is null then
  saved:=public.rpc_save_need_draft_from_review(c.id,r.requester_profile_id,'v5-draft:'||r.id::text);
 else
  saved:=public.rpc_confirm_need_edit_from_review_v2(c.bound_need_id,(r.envelope->>'draftRevision')::integer,c.id,'v5-edit:'||r.id::text);
 end if;
 insert into private.ai_task_review_commands(review_id,account_id,client_request_id,need_id,need_revision,state)
 values(r.id,u,p_client_request_id,(saved->>'needId')::uuid,(saved->>'revision')::integer,'ACCEPTED');
 return private.ai_task_review_command_document(r.id);
end $function$;

CREATE OR REPLACE FUNCTION private.cancel_replaced_task(p_need_id uuid, p_need_revision integer, p_reason text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  u uuid := auth.uid();
  n public.needs;
  affected_responses integer := 0;
  w record;
begin
  if u is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;

  -- Same lock as selection, dispatch and submission. Whichever transaction owns
  -- this row determines the canonical outcome of a race.
  select * into n from public.needs where id = p_need_id for update;
  if not found then raise exception using errcode='P0002', message='NEED_NOT_FOUND'; end if;
  if n.requester_account_id <> u then
    raise exception using errcode='42501', message='FORBIDDEN';
  end if;

  if n.status = 'CANCELLED' then
    return jsonb_build_object(
      'needId', n.id,
      'status', n.status,
      'revision', n.revision,
      'affectedResponses', 0,
      'idempotentReplay', true,
      'authoritative', true
    );
  end if;

  if n.revision is distinct from p_need_revision then
    raise exception using errcode='P0001', message='STALE_REVIEW_REQUIRED';
  end if;

  -- Once a seat is selected, cancellation belongs to the Agreement lifecycle.
  -- Historical CANCELLED Agreements do not keep the remaining Need hostage.
  if exists (
       select 1 from public.need_selections s
        where s.need_id = n.id and s.status = 'SELECTED'
     )
     or exists (
       select 1 from public.agreements a
        where a.need_id = n.id
          and a.status in ('CONFIRMED','SUPERSEDED','COMPLETED')
     )
     or exists (
       select 1 from public.marketplace_responses r
        where r.need_id = n.id and r.status = 'SELECTED'
     ) then
    raise exception using errcode='P0001',
      message='NEED_CANCELLATION_REQUIRES_AGREEMENT_FLOW';
  end if;

  if n.status not in ('DRAFT','PUBLISHED','SELECTION') then
    raise exception using errcode='22023', message='NEED_NOT_CANCELLABLE';
  end if;

  -- Stop every pending side effect before emitting the terminal event.
  update public.notification_deliveries d
     set state = 'EXPIRED'
    from public.user_activity_events e
   where d.event_id = e.id
     and d.state in ('CREATED','QUEUED','FAILED_RETRYABLE')
     and (
       (e.entity_type = 'NEED' and e.entity_id = n.id)
       or (e.entity_type = 'RESPONSE' and exists (
         select 1 from public.marketplace_responses r
          where r.id = e.entity_id and r.need_id = n.id
       ))
       or (e.entity_type = 'AGREEMENT' and exists (
         select 1 from public.agreements a
          where a.id = e.entity_id and a.need_id = n.id
       ))
     );

  update public.dispatch_rounds
     set status = 'STOPPED', stop_reason = 'NEED_CANCELLED'
   where need_id = n.id and status in ('PLANNED','SENT');

  update public.opportunity_deliveries
     set status = 'EXPIRED'
   where need_id = n.id and status in ('READY','SEEN');

  delete from private.dispatch_schedule where need_id = n.id;

  update public.access_grants g
     set status = 'REVOKED',
         revoked_at = coalesce(g.revoked_at, statement_timestamp())
   where g.status = 'GRANTED'
     and exists (
       select 1 from public.agreements a
        where a.id = g.agreement_id and a.need_id = n.id
     );

  perform set_config('uskoci.need_lifecycle', 'CANCEL_NEED', true);
  update public.needs
     set status = 'CANCELLED', urgent = false
   where id = n.id;

  -- Versions are never deleted or rewritten. Only the live Response outcome
  -- changes, and each affected worker receives an independently deduped event.
  for w in
    update public.marketplace_responses r
       set status = 'EXPIRED', selected_at = null
     where r.need_id = n.id
       and r.status in ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','STALE')
     returning r.id, r.worker_account_id, r.current_version
  loop
    affected_responses := affected_responses + 1;
    perform private.emit_event(
      w.worker_account_id,
      'WORKER',
      'NEED_CANCELLED',
      'NEED',
      n.id,
      n.revision,
      'Zadatak je izmenjen',
      'Objavljena je nova verzija zadatka. Prethodna prijava je zatvorena i nije preneta na nove uslove.',
      'need-cancelled:' || n.id::text || ':' || n.revision::text || ':worker:' || w.worker_account_id::text,
      'NORMAL',
      jsonb_build_object(
        'reason', 'REQUESTER_CANCELLED',
        'reasonProvided', char_length(btrim(coalesce(p_reason, ''))) > 0
      ),
      null
    );
  end loop;

  perform private.audit_marketplace(
    u,
    'NEED_CANCELLED',
    'NEED',
    n.id,
    n.revision,
    jsonb_build_object('reason', left(btrim(coalesce(p_reason, '')), 500))
  );

  return jsonb_build_object(
    'needId', n.id,
    'status', 'CANCELLED',
    'revision', n.revision,
    'affectedResponses', affected_responses,
    'idempotentReplay', false,
    'authoritative', true
  );
end;
$function$;

revoke all on function private.cancel_replaced_task(uuid,integer,text) from public,anon,authenticated,service_role;


create function private.finalize_task_replacement(p_candidate uuid) returns void
language plpgsql security definer set search_path=pg_catalog as $f$
declare r jsonb; n public.needs;
begin
 r:=private.task_replacement_origin(p_candidate);
 if r is null then return;end if;
 select * into n from public.needs where id=p_candidate for update;
 if n.requester_account_id is distinct from auth.uid() or n.status<>'DRAFT' then
  raise exception 'TASK_REVIEW_COMMAND_MISMATCH' using errcode='42501';end if;
 perform private.assert_task_replacement_source((r->>'sourceNeedId')::uuid,(r->>'sourceRevision')::integer,r->>'sourceFingerprint');
 perform private.cancel_replaced_task((r->>'sourceNeedId')::uuid,(r->>'sourceRevision')::integer,'Objava zamenjena novom verzijom');
 -- Applicant consent is never transferred. Existing cancellation delivery/read
 -- routing stays valid and points to the original closed task.
end $f$;
revoke all on function private.finalize_task_replacement(uuid) from public,anon,authenticated,service_role;


do $pin$ begin if (select md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rpc_publish_need_canonical') is distinct from 'eb7bc72a90f6bdd1150ee6f49742c240' then raise exception 'PED02_PREIMAGE_CHANGED: rpc_publish_need_canonical'; end if; end $pin$;

CREATE OR REPLACE FUNCTION public.rpc_publish_need_canonical(p_need_id uuid, p_expected_revision integer, p_decision_sequence bigint, p_response_deadline timestamp with time zone, p_client_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(p_client_request_id, ''));
  v_request_payload jsonb;
  v_request_hash text;
  v_existing private.need_publish_commands%rowtype;
  v_need public.needs%rowtype;
  v_decision private.need_publication_decisions%rowtype;
  v_bundle private.publication_policy_bundles%rowtype;
  v_fp jsonb;
  v_context jsonb;
  v_public_media text[];
  v_rule_count integer;
  v_rule_snapshot jsonb;
  v_result jsonb;
  v_now timestamptz := statement_timestamp();
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_need_id is null or p_expected_revision is null or p_decision_sequence is null then
    raise exception 'PUBLISH_ID_REVISION_DECISION_REQUIRED' using errcode='22004';
  end if;
  if p_expected_revision <= 0 or p_decision_sequence <= 0 then
    raise exception 'PUBLISH_REVISION_DECISION_INVALID' using errcode='22023';
  end if;
  if char_length(v_request_id) < 8 or char_length(v_request_id) > 200 then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';
  end if;

  v_request_payload := jsonb_build_object(
    'needId', p_need_id,
    'expectedRevision', p_expected_revision,
    'decisionSequence', p_decision_sequence,
    'responseDeadline', p_response_deadline
  );
  v_request_hash := encode(
    extensions.digest(convert_to(v_request_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || E'\n' || v_request_id, 0)
  );

  select * into v_existing
    from private.need_publish_commands c
   where c.requester_account_id = v_actor
     and c.client_request_id = v_request_id
   for update;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';
    end if;
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  if p_response_deadline is not null and p_response_deadline <= clock_timestamp() then
    raise exception 'RESPONSE_DEADLINE_INVALID' using errcode='22023';
  end if;

  -- PKG-028b: a fixed-time task whose start has already passed cannot be offered to anyone. Checked before
  -- the publication context, and only on the caller's own task, so nobody learns another person's schedule.
  if exists (select 1 from public.needs n
              where n.id = p_need_id and n.requester_account_id = v_actor
                and n.schedule_kind = 'FIXED_WINDOW' and n.starts_at <= clock_timestamp()) then
    raise exception 'FIXED_WINDOW_START_PASSED' using errcode='22023';
  end if;

  -- A recorded successful command is returned above even after its deadline or
  -- policy expiry; a new command must satisfy the entire current context.
  v_context:=private.need_publication_context(p_need_id,p_expected_revision,v_actor);
  if v_context->>'kind'<>'READY' then raise exception 'PUBLICATION_CONTEXT_NOT_READY' using errcode='P0001',detail=v_context->>'code'; end if;

  select * into v_need
    from public.needs n
   where n.id = p_need_id
   for update;
  if not found then
    raise exception 'NEED_NOT_FOUND' using errcode='P0002';
  end if;
  if v_need.requester_account_id <> v_actor then
    raise exception 'NEED_NOT_OWNED' using errcode='42501';
  end if;
  if v_need.status <> 'DRAFT' then
    raise exception 'NEED_NOT_DRAFT' using errcode='P0001';
  end if;
  if v_need.revision <> p_expected_revision then
    raise exception 'NEED_REVISION_STALE' using errcode='PT409';
  end if;

  v_fp := private.need_publication_fingerprint_snapshot(p_need_id);
  if (v_fp->>'needRevision')::integer <> p_expected_revision then
    raise exception 'NEED_REVISION_STALE' using errcode='PT409';
  end if;
  v_public_media := array(
    select jsonb_array_elements_text(v_fp->'publicMediaRefs')
  );

  select * into v_decision
    from private.need_publication_decisions d
   where d.decision_sequence = p_decision_sequence;
  if not found then
    raise exception 'PUBLICATION_DECISION_NOT_FOUND' using errcode='P0002';
  end if;
  if v_decision.need_id <> p_need_id
     or v_decision.need_revision <> p_expected_revision then
    raise exception 'PUBLICATION_DECISION_SCOPE_MISMATCH' using errcode='P0001';
  end if;
  if v_decision.service_provenance->'evaluationContext' is distinct from v_context->'binding' then
    raise exception 'PUBLICATION_DECISION_CONTEXT_STALE' using errcode='PT409';
  end if;
  if v_decision.canonical_fingerprint <> v_fp->>'canonicalFingerprint'
     or v_decision.private_materiality_marker <> v_fp->>'privateMaterialityMarker'
     or v_decision.public_geography_snapshot is distinct from v_fp->'publicGeography'
     or v_decision.public_media_refs is distinct from v_public_media then
    raise exception 'PUBLICATION_DECISION_FINGERPRINT_STALE' using errcode='P0001';
  end if;

  if exists (
    select 1
      from private.need_publication_decisions newer
     where newer.need_id = p_need_id
       and newer.need_revision = p_expected_revision
       and newer.decision_sequence > v_decision.decision_sequence
  ) then
    raise exception 'PUBLICATION_DECISION_STALE' using errcode='P0001';
  end if;

  if v_decision.outcome <> 'ALLOW' then
    raise exception 'PUBLICATION_DECISION_NOT_ALLOW' using errcode='P0001';
  end if;

  if not private.publication_policy_bundle_ready(
       v_decision.policy_bundle_id,
       v_decision.jurisdiction,
       v_now
     ) then
    raise exception 'POLICY_BUNDLE_NOT_READY' using errcode='P0001';
  end if;

  if private.current_publication_policy_bundle(
       v_decision.policy_id,
       v_decision.jurisdiction,
       v_now
     ) is distinct from v_decision.policy_bundle_id then
    raise exception 'PUBLICATION_POLICY_STALE' using errcode='P0001';
  end if;

  select * into v_bundle
    from private.publication_policy_bundles b
   where b.id = v_decision.policy_bundle_id;
  if not found
     or v_bundle.policy_id <> v_decision.policy_id
     or v_bundle.version <> v_decision.policy_version
     or v_bundle.jurisdiction <> v_decision.jurisdiction then
    raise exception 'PUBLICATION_POLICY_PROVENANCE_MISMATCH' using errcode='P0001';
  end if;

  select count(*)::integer,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'ruleId', r.rule_id,
               'provenance', r.rule_provenance
             ) order by r.rule_id
           ),
           '[]'::jsonb
         )
    into v_rule_count, v_rule_snapshot
    from private.publication_policy_rule_refs r
   where r.bundle_id = v_decision.policy_bundle_id
     and r.rule_id = any(v_decision.rule_ids);

  if v_rule_count <> cardinality(v_decision.rule_ids)
     or v_rule_snapshot is distinct from v_decision.rule_provenance_snapshot then
    raise exception 'PUBLICATION_POLICY_RULE_PROVENANCE_STALE' using errcode='P0001';
  end if;

  if not private.publication_policy_bundle_ready(v_decision.policy_bundle_id,v_decision.jurisdiction,clock_timestamp()) then raise exception 'POLICY_BUNDLE_NOT_READY' using errcode='P0001'; end if;
  if p_response_deadline is not null and p_response_deadline<=clock_timestamp() then raise exception 'RESPONSE_DEADLINE_INVALID' using errcode='22023'; end if;

  -- Same transaction: any later failure rolls back source cancellation and deliveries.
  perform private.finalize_task_replacement(p_need_id);
  perform set_config('uskoci.need_lifecycle', 'PUBLISH', true);
  update public.needs n
     set status = 'PUBLISHED',
         published_at = v_now,
         response_deadline = p_response_deadline
   where n.id = p_need_id
     and n.status = 'DRAFT'
     and n.revision = p_expected_revision
  returning n.* into v_need;
  perform set_config('uskoci.need_lifecycle', '', true);

  if not found then
    raise exception 'NEED_PUBLISH_CONFLICT' using errcode='PT409';
  end if;

  if not exists (
    select 1 from private.dispatch_schedule s where s.need_id = p_need_id
  ) then
    raise exception 'DISPATCH_SCHEDULE_MISSING' using errcode='P0001';
  end if;

  v_result := jsonb_build_object(
    'needId', v_need.id,
    'status', v_need.status,
    'publishedAt', v_need.published_at,
    'responseDeadline', v_need.response_deadline,
    'idempotentReplay', false
  );

  insert into private.need_publish_commands(
    requester_account_id,
    client_request_id,
    request_hash,
    need_id,
    expected_revision,
    decision_id,
    decision_sequence,
    canonical_fingerprint,
    policy_bundle_id,
    response_deadline,
    result
  ) values (
    v_actor,
    v_request_id,
    v_request_hash,
    p_need_id,
    p_expected_revision,
    v_decision.id,
    v_decision.decision_sequence,
    v_decision.canonical_fingerprint,
    v_decision.policy_bundle_id,
    p_response_deadline,
    v_result
  );

  return v_result;
end;
$function$;

-- PED02 migration gate. Synthetic accounts/source, real review/edit/publication RPCs.
-- Intentional subtransaction rollback removes ALL fixtures, including service decisions.
do $proof$
declare u uuid:=extensions.gen_random_uuid(); pid uuid; n uuid; c uuid; target uuid; c2 uuid;
 review jsonb; refreshed jsonb; cmd jsonb; corrected jsonb; ctx jsonb; dec jsonb; published jsonb;
 key uuid:=extensions.gen_random_uuid(); before_row jsonb; after_row jsonb; rev integer;
begin
 begin
  insert into auth.users(id,aud,role,email,created_at,updated_at)
   values(u,'authenticated','authenticated','ped02-'||u||'@proof.invalid',now(),now());
  select id into strict pid from public.app_profiles where account_id=u and kind='REQUESTER';
  update public.app_profiles set display_name='PED02 proba',city='Novi Sad' where id=pid;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  perform set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
  insert into public.needs(requester_account_id,requester_profile_id,status,title,description,category,
   approximate_city,mode,required_slots,schedule_kind,execution_location_mode,task_country_code,task_timezone,revision,published_at,response_deadline)
  values(u,pid,'PUBLISHED','PED02 Dizajn logotipa','Potreban je novi logo za radionicu.','Dizajn logotipa','',
   'OFFERS',1,'FLEXIBLE','REMOTE','RS','Europe/Belgrade',1,now(),now()+interval '2 days') returning id into n;
  perform set_config('uskoci.need_lifecycle','',true);perform set_config('uskoci.need_region','',true);
  insert into public.need_geography(need_id,public_topology) values(n,'{"mode":"REMOTE"}');
  insert into public.need_requirement_details(need_id,critical_conditions,handoff) values(n,'{}','{"required":false}');
  select to_jsonb(t) into before_row from public.needs t where id=n;
  c:=(public.rpc_ai_open_need_edit_conversation_v2(n)->>'conversationId')::uuid;
  perform public.rpc_ai_correct_fact_v2((select id from public.ai_structured_facts where conversation_id=c and fact_key='need.title' and superseded_at is null),
   to_jsonb('PED02 Logo i vizitkarte'::text),'Logo i vizitkarte');
  review:=public.rpc_prepare_ai_task_review(c,null,null);
  if review#>>'{replacement,sourceNeedId}' is distinct from n::text or review#>>'{replacement,targetBaseRevision}'<>'0'
   then raise exception 'PED02_REVIEW_SOURCE';end if;
  refreshed:=public.rpc_prepare_ai_task_review(c,null,null);
  if refreshed->>'reviewId' is distinct from review->>'reviewId' then raise exception 'PED02_REFRESH_CHANGED_REVIEW';end if;
  cmd:=public.rpc_accept_ai_task_review((review->>'reviewId')::uuid,review->>'displayedContentDigest',key);
  target:=(cmd->>'needId')::uuid;
  if target=n or target::text is distinct from review#>>'{replacement,targetNeedId}' or cmd->>'needRevision'<>'1' then raise exception 'PED02_TARGET';end if;
  select to_jsonb(t) into after_row from public.needs t where id=n;
  if before_row is distinct from after_row then raise exception 'PED02_SOURCE_CHANGED_BY_ACCEPT';end if;
  if public.rpc_accept_ai_task_review((review->>'reviewId')::uuid,review->>'displayedContentDigest',key) is distinct from cmd
   then raise exception 'PED02_ACCEPT_REPLAY';end if;
  if (select bound_need_id from public.ai_conversations where id=c)<>n then raise exception 'PED02_SOURCE_CONVERSATION_REBOUND';end if;
  -- Reopening the candidate must retain provenance across correction/revision.
  c2:=(public.rpc_ai_open_need_edit_conversation_v2(target)->>'conversationId')::uuid;
  perform public.rpc_ai_correct_fact_v2((select id from public.ai_structured_facts where conversation_id=c2 and fact_key='need.description' and superseded_at is null),
   to_jsonb('Logo i vizitkarte za novu radionicu.'::text),'Logo i vizitkarte za novu radionicu.');
  corrected:=public.rpc_prepare_ai_task_review(c2,null,null);
  if corrected#>>'{replacement,sourceNeedId}'<>n::text or corrected#>>'{replacement,targetNeedId}'<>target::text
   or corrected#>>'{replacement,targetBaseRevision}'<>'1' then raise exception 'PED02_CORRECTION_LOST_ANCESTRY';end if;
  cmd:=public.rpc_accept_ai_task_review((corrected->>'reviewId')::uuid,corrected->>'displayedContentDigest',extensions.gen_random_uuid());
  rev:=(cmd->>'needRevision')::integer;
  if cmd->>'needId'<>target::text or rev<>2 then raise exception 'PED02_CORRECTION_TARGET';end if;
  if (select to_jsonb(t) from public.needs t where id=n) is distinct from before_row then raise exception 'PED02_SOURCE_CHANGED_BY_CORRECTION';end if;
  -- No valid decision: publication failure must leave source active.
  begin
   perform public.rpc_publish_need_canonical(target,rev,9223372036854775806,null,'ped02-no-decision-'||u);
   raise exception 'PED02_INVALID_DECISION_ALLOWED';
  exception when others then if sqlerrm='PED02_INVALID_DECISION_ALLOWED' then raise;end if;end;
  if (select to_jsonb(t) from public.needs t where id=n) is distinct from before_row then raise exception 'PED02_FAILED_PUBLISH_CHANGED_SOURCE';end if;
  ctx:=private.need_publication_context(target,rev,u);
  if ctx->>'kind'<>'READY' then raise exception 'PED02_CONTEXT_NOT_READY: %',ctx;end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','service_role')::text,true);
  dec:=public.rpc_record_need_publication_decision_service(target,rev,'RS_PUBLICATION_POLICY_MINIMUM','RS','ALLOW',array['RS-MIN-001'],
   'PUBLICATION_EVALUATOR_V1',array['CLEAR_CONCRETE_TASK'],'PED02_SQL_PROOF','NO_PROVIDER_CALLED','{}',jsonb_build_object('evaluationContext',ctx->'binding'));
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  -- Source cancellation races with replacement: stale source is never revived.
  begin
   perform public.rpc_cancel_need(n,1,'PED02 rollback race');
   begin
    perform public.rpc_publish_need_canonical(target,rev,(dec->>'decisionSequence')::bigint,null,'ped02-stale-'||u);
    raise exception 'PED02_STALE_SOURCE_ALLOWED';
   exception when others then if sqlerrm<>'REPLACEMENT_SOURCE_STALE' then raise;end if;end;
   raise sqlstate 'ZP003';
  exception when sqlstate 'ZP003' then null;end;
  published:=public.rpc_publish_need_canonical(target,rev,(dec->>'decisionSequence')::bigint,null,'ped02-publish-'||u);
  if published->>'status'<>'PUBLISHED' or (select status from public.needs where id=n)<>'CANCELLED'
   or (select status from public.needs where id=target)<>'PUBLISHED' then raise exception 'PED02_ATOMIC_SWAP';end if;
  if public.rpc_publish_need_canonical(target,rev,(dec->>'decisionSequence')::bigint,null,'ped02-publish-'||u)->>'idempotentReplay'<>'true'
   then raise exception 'PED02_PUBLISH_REPLAY';end if;
  raise sqlstate 'ZP002';
 exception when sqlstate 'ZP002' then null;end;
 if exists(select 1 from auth.users where id=u) then raise exception 'PED02_FIXTURE_LEAK';end if;
end $proof$;
