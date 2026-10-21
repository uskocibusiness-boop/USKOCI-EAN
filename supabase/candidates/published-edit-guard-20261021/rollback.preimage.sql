-- Restores the unsafe legacy behavior; operator recovery reference only.
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
 if c.bound_need_id is null then
  saved:=public.rpc_save_need_draft_from_review(c.id,r.requester_profile_id,'v5-draft:'||r.id::text);
 else
  saved:=public.rpc_confirm_need_edit_from_review_v2(c.bound_need_id,(r.envelope->>'draftRevision')::integer,c.id,'v5-edit:'||r.id::text);
 end if;
 insert into private.ai_task_review_commands(review_id,account_id,client_request_id,need_id,need_revision,state)
 values(r.id,u,p_client_request_id,(saved->>'needId')::uuid,(saved->>'revision')::integer,'ACCEPTED');
 return private.ai_task_review_command_document(r.id);
end $function$

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
  v_handoff jsonb;
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
  perform private.validate_need_v2_fact('need.task_geography',v_geo);
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

  insert into public.need_requirement_details(need_id,critical_conditions,handoff,updated_at)
  values(v_need.id,v_conditions,v_handoff,statement_timestamp())
  on conflict(need_id) do update set critical_conditions=excluded.critical_conditions,handoff=excluded.handoff,updated_at=excluded.updated_at;

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
$function$

CREATE OR REPLACE FUNCTION public.rpc_confirm_need_edit(p_need_id uuid, p_expected_revision integer, p_client_request_id text, p_material jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(p_client_request_id, ''));
  v_request_hash text;
  v_existing private.need_edit_commands%rowtype;
  v_need public.needs%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_event_id uuid;
  v_result jsonb;
  v_private jsonb;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'NEED_ID_REVISION_REQUIRED' using errcode='22023';
  end if;
  if char_length(v_request_id) not between 8 and 200 then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';
  end if;
  if p_material is null or jsonb_typeof(p_material) <> 'object' then
    raise exception 'MATERIAL_OBJECT_REQUIRED' using errcode='22023';
  end if;

  if (p_material - array[
    'title','description','category','requiredSlots','mode','requesterPriceRsd',
    'requiredSkills','requiredTools','requiredVehicles','requiredLicenses',
    'minimumExperienceYears','verifiedIdentityRequired','scheduleKind','startsAt','endsAt',
    'executionLocationMode','approximateLat','approximateLng','approximateCity','approximateArea',
    'publicPhotoPaths','privateLocation'
  ]) <> '{}'::jsonb then
    raise exception 'UNSUPPORTED_MATERIAL_FIELD' using errcode='22023';
  end if;

  if not (p_material ?& array[
    'title','description','category','requiredSlots','mode','requesterPriceRsd',
    'requiredSkills','requiredTools','requiredVehicles','requiredLicenses',
    'minimumExperienceYears','verifiedIdentityRequired','scheduleKind','startsAt','endsAt',
    'executionLocationMode','approximateLat','approximateLng','approximateCity','approximateArea',
    'publicPhotoPaths','privateLocation'
  ]) then
    raise exception 'FULL_MATERIAL_SNAPSHOT_REQUIRED' using errcode='22023';
  end if;

  if jsonb_typeof(p_material->'requiredSkills') <> 'array'
     or jsonb_typeof(p_material->'requiredTools') <> 'array'
     or jsonb_typeof(p_material->'requiredVehicles') <> 'array'
     or jsonb_typeof(p_material->'requiredLicenses') <> 'array'
     or jsonb_typeof(p_material->'publicPhotoPaths') <> 'array' then
    raise exception 'MATERIAL_ARRAY_FIELD_INVALID' using errcode='22023';
  end if;

  if jsonb_typeof(p_material->'privateLocation') not in ('object','null') then
    raise exception 'PRIVATE_LOCATION_INVALID' using errcode='22023';
  end if;

  if p_material->'privateLocation' ? 'resolvedLocation' then raise exception 'LOCATION_EDITOR_REQUIRED' using errcode='42501'; end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(jsonb_build_object(
        'needId', p_need_id,
        'expectedRevision', p_expected_revision,
        'material', p_material
      )::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || E'\n' || v_request_id, 4404));

  select * into v_existing
    from private.need_edit_commands c
   where c.requester_account_id = v_actor
     and c.client_request_id = v_request_id
   for update;
  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';
    end if;
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  select * into v_need from public.needs n where n.id = p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if v_need.requester_account_id <> v_actor then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if v_need.revision <> p_expected_revision then raise exception 'STALE_REVIEW_REQUIRED' using errcode='PT409'; end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='P0001'; end if;

  if exists (select 1 from public.agreements a where a.need_id = v_need.id)
     or exists (select 1 from public.need_selections s where s.need_id = v_need.id)
     or exists (select 1 from public.marketplace_responses r where r.need_id = v_need.id and r.status = 'SELECTED') then
    raise exception 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' using errcode='P0001';
  end if;

  v_before := private.need_material_snapshot(v_need.id);
  if v_before is null then raise exception 'NEED_SNAPSHOT_FAILED' using errcode='P0001'; end if;

  v_private := p_material->'privateLocation';

  perform set_config('uskoci.need_lifecycle', 'CONFIRM_EDIT', true);
  update public.needs n
     set title = btrim(p_material->>'title'),
         description = btrim(p_material->>'description'),
         category = btrim(p_material->>'category'),
         required_slots = (p_material->>'requiredSlots')::integer,
         mode = p_material->>'mode',
         requester_price_rsd = (p_material->>'requesterPriceRsd')::integer,
         required_skills = private.jsonb_text_array(p_material->'requiredSkills'),
         required_tools = private.jsonb_text_array(p_material->'requiredTools'),
         required_vehicles = private.jsonb_text_array(p_material->'requiredVehicles'),
         required_licenses = private.jsonb_text_array(p_material->'requiredLicenses'),
         minimum_experience_years = (p_material->>'minimumExperienceYears')::integer,
         verified_identity_required = (p_material->>'verifiedIdentityRequired')::boolean,
         schedule_kind = p_material->>'scheduleKind',
         starts_at = (p_material->>'startsAt')::timestamptz,
         ends_at = (p_material->>'endsAt')::timestamptz,
         execution_location_mode = p_material->>'executionLocationMode',
         approximate_lat = (p_material->>'approximateLat')::numeric,
         approximate_lng = (p_material->>'approximateLng')::numeric,
         approximate_city = coalesce(p_material->>'approximateCity',''),
         approximate_area = coalesce(p_material->>'approximateArea',''),
         public_photo_paths = private.jsonb_text_array(p_material->'publicPhotoPaths'),
         status = 'DRAFT',
         revision = v_need.revision + 1,
         published_at = null,
         response_deadline = null,
         urgent = false,
         urgent_activated_at = null,
         urgent_expires_at = null,
         urgent_policy_version = null,
         updated_at = statement_timestamp()
   where n.id = v_need.id
     and n.revision = v_need.revision
     and n.status in ('PUBLISHED','SELECTION')
  returning n.* into v_need;
  perform set_config('uskoci.need_lifecycle', '', true);

  if not found then raise exception 'NEED_EDIT_CONFLICT' using errcode='PT409'; end if;

  insert into public.need_sensitive(need_id, exact_address, access_notes, exact_lat, exact_lng, updated_at)
  values (
    v_need.id,
    case when jsonb_typeof(v_private)='object' then coalesce(v_private->>'exactAddress','') else '' end,
    case when jsonb_typeof(v_private)='object' then coalesce(v_private->>'accessNotes','') else '' end,
    case when jsonb_typeof(v_private)='object' then (v_private->>'exactLat')::numeric else null end,
    case when jsonb_typeof(v_private)='object' then (v_private->>'exactLng')::numeric else null end,
    statement_timestamp()
  )
  on conflict (need_id) do update
    set exact_address = excluded.exact_address,
        access_notes = excluded.access_notes,
        exact_lat = excluded.exact_lat,
        exact_lng = excluded.exact_lng,
        updated_at = excluded.updated_at;

  -- Legacy scalar edit remains available, but cannot attest or retain route pins.
  if exists(select 1 from public.need_sensitive where need_id=v_need.id and resolved_location is not null) then
    update public.needs set approximate_lat=null,approximate_lng=null where id=v_need.id;
  end if;
  update public.need_sensitive set resolved_location=null,exact_lat=null,exact_lng=null where need_id=v_need.id and resolved_location is not null;
  delete from private.dispatch_schedule where need_id = v_need.id;

  v_after := private.need_material_snapshot(v_need.id);
  if v_after is not distinct from v_before then
    raise exception 'NO_MATERIAL_CHANGE' using errcode='22023';
  end if;

  insert into private.need_revision_events(
    need_id, from_revision, to_revision, from_status,
    previous_material_snapshot, new_material_snapshot, created_by_account_id
  ) values (
    v_need.id, p_expected_revision, v_need.revision,
    case when v_need.status='DRAFT' then 'PUBLISHED_OR_SELECTION' else v_need.status end,
    v_before, v_after, v_actor
  ) returning id into v_event_id;

  perform private.audit_marketplace(
    v_actor,
    'NEED_EDIT_CONFIRMED',
    'NEED',
    v_need.id,
    v_need.revision,
    jsonb_build_object('fromRevision', p_expected_revision, 'toRevision', v_need.revision, 'revisionEventId', v_event_id)
  );

  v_result := jsonb_build_object(
    'needId', v_need.id,
    'fromRevision', p_expected_revision,
    'revision', v_need.revision,
    'status', v_need.status,
    'revisionEventId', v_event_id,
    'requiresReadmission', true,
    'idempotentReplay', false,
    'authoritative', true
  );

  insert into private.need_edit_commands(
    requester_account_id, client_request_id, request_hash,
    need_id, from_revision, to_revision, revision_event_id, result
  ) values (
    v_actor, v_request_id, v_request_hash,
    v_need.id, p_expected_revision, v_need.revision, v_event_id, v_result
  );

  return v_result;
end;
$function$
