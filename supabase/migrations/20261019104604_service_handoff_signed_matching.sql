-- One optional handoff constraint; execution remains ON_SITE or REMOTE.
-- No inferred shipping consent, no location pins, no category/worker changes in chat.
BEGIN;
DO $precondition$
BEGIN
 IF to_regprocedure('private.taxonomy_handoff_valid_v1(jsonb)') IS NULL THEN
  RAISE EXCEPTION 'HANDOFF_MODE_ADMISSION_DEPENDENCY_REQUIRED'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.validate_need_v2_fact(text,jsonb)'::regprocedure) <> '82dd8fced91eca6d9a6c8d4897343b8a' THEN RAISE EXCEPTION 'HANDOFF_PREDECESSOR_VALIDATE_NEED_V2_FACT'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.rpc_save_need_draft_from_review(uuid,uuid,text)'::regprocedure) <> '559c9d81ee97caec2ccd9ec19b3e95ca' THEN RAISE EXCEPTION 'HANDOFF_PREDECESSOR_RPC_SAVE_NEED_DRAFT_FROM_REVIEW'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)'::regprocedure) <> '8a94e2b748485f0850e477369c3de3d2' THEN RAISE EXCEPTION 'HANDOFF_PREDECESSOR_RPC_CONFIRM_NEED_EDIT_FROM_REVIEW'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.rpc_ai_open_need_edit_conversation_v2(uuid)'::regprocedure) <> '11387360bc195b32551b6382781fb583' THEN RAISE EXCEPTION 'HANDOFF_PREDECESSOR_RPC_AI_OPEN_NEED_EDIT_CONVERSATION_V2'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.rpc_prepare_ai_task_review_taxonomy(uuid,timestamp with time zone,jsonb)'::regprocedure) <> '0ed438232944de8a982b1436bcf3f4f2' THEN RAISE EXCEPTION 'HANDOFF_PREDECESSOR_RPC_PREPARE_AI_TASK_REVIEW_TAXONOMY'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)'::regprocedure) <> 'c5daec7f45eac3fd799e1eb0e50ff73a' THEN RAISE EXCEPTION 'HANDOFF_PREDECESSOR_RPC_TAXONOMY_BIND_REVIEWED_WORKER_SERVICE'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.rpc_taxonomy_bind_reviewed_need_service(uuid,uuid,uuid,uuid,integer)'::regprocedure) <> '2e398a282a4bb1645f371ed8acb1f19a' THEN RAISE EXCEPTION 'HANDOFF_PREDECESSOR_RPC_TAXONOMY_BIND_REVIEWED_NEED_SERVICE'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.worker_ai_service_mode_context_v1(uuid,uuid)'::regprocedure) <> '415d86f9350ba80aa3f8e9d47c883463' THEN RAISE EXCEPTION 'HANDOFF_PREDECESSOR_WORKER_AI_SERVICE_MODE_CONTEXT_V1'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)'::regprocedure) <> '8bbe7ec7ae37a884d6c135bc38317313' THEN RAISE EXCEPTION 'HANDOFF_PREDECESSOR_RPC_PREPARE_WORKER_AI_REVIEW_TAXONOMY'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)'::regprocedure) <> '44107537739cf41609d811f52e48fdce' THEN RAISE EXCEPTION 'HANDOFF_PREDECESSOR_RPC_PREPARE_WORKER_AI_REVIEW_TAXONOMY_CONFIRMED'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.worker_need_fit_v1(uuid,uuid,boolean)'::regprocedure) <> '7b5d5b5b4f2f3b5d8cefc26333aa6145' THEN RAISE EXCEPTION 'HANDOFF_PREDECESSOR_WORKER_NEED_FIT_V1'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.need_publication_fingerprint_snapshot(uuid)'::regprocedure) <> 'c6dab63a70732d0cb1fcc657baaa2490' THEN RAISE EXCEPTION 'HANDOFF_PREDECESSOR_NEED_PUBLICATION_FINGERPRINT_SNAPSHOT'; END IF;
END $precondition$;

ALTER TABLE public.need_requirement_details ADD COLUMN handoff jsonb;
ALTER TABLE public.need_requirement_details ADD CONSTRAINT need_handoff_valid CHECK
 (handoff IS NULL OR private.taxonomy_handoff_valid_v1(handoff));
ALTER TABLE private.taxonomy_confirmed_worker_modes_v1 ADD COLUMN handoff jsonb;
ALTER TABLE private.taxonomy_confirmed_worker_modes_v1 ADD CONSTRAINT worker_handoff_valid CHECK
 (handoff IS NULL OR (execution_scope='REMOTE' AND private.taxonomy_handoff_valid_v1(handoff)));
INSERT INTO private.need_fact_registry(fact_key,schema_version,value_type,required_for_draft,privacy_class,material,target_owner)
 VALUES('need.handoff','NEED_FACT_V2','OBJECT',false,'PUBLIC',true,'need_requirement_details.handoff');

CREATE FUNCTION private.taxonomy_handoff_display_v1(p jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path TO 'pg_catalog' AS $function$
DECLARE parts text[]:='{}';countries text;
BEGIN
 IF p IS NULL OR NOT private.taxonomy_handoff_valid_v1(p) THEN RETURN NULL; END IF;
 IF p->'required'='false'::jsonb THEN RETURN 'Bez fizičke predaje'; END IF;
 IF p ? 'shippingCountries' THEN
  SELECT string_agg(value,', ' ORDER BY ord) INTO countries
    FROM jsonb_array_elements_text(p->'shippingCountries') WITH ORDINALITY t(value,ord);
  parts:=array_append(parts,'Slanje: '||countries);
 END IF;
 IF p ? 'localExchange' THEN parts:=array_append(parts,
   'Lično preuzimanje: '||(p#>>'{localExchange,city}')||' ('||(p#>>'{localExchange,countryCode}')||')'); END IF;
 RETURN array_to_string(parts,' ili ');
END $function$;

CREATE FUNCTION private.taxonomy_handoff_compatible_v1(need_handoff jsonb,worker_handoff jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path TO 'pg_catalog' AS $function$
BEGIN
 -- Historical missing data stays unknown; it is never rewritten as shipment
 -- consent. Existing unqualified tasks keep their prior compatibility policy.
 IF need_handoff IS NULL THEN RETURN true; END IF;
 IF NOT private.taxonomy_handoff_valid_v1(need_handoff) THEN RETURN false; END IF;
 IF need_handoff->'required'='false'::jsonb THEN
   RETURN worker_handoff IS NULL OR (private.taxonomy_handoff_valid_v1(worker_handoff)
     AND worker_handoff->'required'='false'::jsonb);
 END IF;
 IF worker_handoff IS NULL OR NOT private.taxonomy_handoff_valid_v1(worker_handoff)
    OR worker_handoff->'required'<>'true'::jsonb THEN RETURN false; END IF;
 RETURN EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(need_handoff->'shippingCountries','[]'::jsonb)) n(country)
   JOIN jsonb_array_elements_text(coalesce(worker_handoff->'shippingCountries','[]'::jsonb)) w(country) USING(country))
   OR (need_handoff ? 'localExchange' AND worker_handoff ? 'localExchange'
     AND need_handoff#>>'{localExchange,countryCode}'=worker_handoff#>>'{localExchange,countryCode}'
     AND private.taxonomy_normalize_v1(need_handoff#>>'{localExchange,city}')=
         private.taxonomy_normalize_v1(worker_handoff#>>'{localExchange,city}'));
END $function$;

CREATE FUNCTION private.taxonomy_handoff_fit_v1(p_need_id uuid,p_worker_account_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'pg_catalog' AS $function$
DECLARE need_value jsonb;worker_value jsonb;category uuid;mode text;
BEGIN
 SELECT n.category_id,n.execution_location_mode,d.handoff INTO category,mode,need_value
 FROM public.needs n LEFT JOIN public.need_requirement_details d ON d.need_id=n.id WHERE n.id=p_need_id;
 IF NOT FOUND THEN RETURN false; END IF;
 IF mode<>'REMOTE' OR need_value IS NULL THEN RETURN true; END IF;
 SELECT m.handoff INTO worker_value FROM private.taxonomy_confirmed_worker_modes_v1 m
 JOIN private.worker_ai_saves saved ON saved.account_id=m.worker_account_id
   AND saved.review_id=m.source_review_id AND saved.client_request_id=m.source_request_key
 WHERE m.worker_account_id=p_worker_account_id AND m.category_id=category
   AND m.execution_scope='REMOTE' AND m.active;
 RETURN private.taxonomy_handoff_compatible_v1(need_value,worker_value);
END $function$;

CREATE FUNCTION private.taxonomy_preserve_review_handoff_v1(p jsonb,account_id uuid,conversation_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'pg_catalog' AS $function$
DECLARE context jsonb;plans jsonb:='[]';plan jsonb;saved jsonb;
BEGIN
 IF p->>'status' IS DISTINCT FROM 'READY' THEN RETURN p; END IF;
 context:=private.worker_ai_service_mode_context_v1(account_id,conversation_id);
 FOR plan IN SELECT value FROM jsonb_array_elements(p->'classificationCandidates') LOOP
  IF plan->>'mode'='REMOTE' AND NOT(plan ? 'handoff') THEN
   SELECT value INTO saved FROM jsonb_array_elements(context->'savedServices')
    WHERE value->>'categoryId'=plan->>'categoryId' AND value->>'mode'=plan->>'mode';
   IF saved ? 'handoff' THEN plan:=plan||jsonb_build_object('handoff',saved->'handoff'); END IF;
  END IF;
  plans:=plans||jsonb_build_array(plan);
 END LOOP;
 RETURN p||jsonb_build_object('classificationCandidates',plans);
END $function$;
REVOKE ALL ON FUNCTION private.taxonomy_handoff_display_v1(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.taxonomy_handoff_display_v1(jsonb) TO service_role;
REVOKE ALL ON FUNCTION private.taxonomy_handoff_compatible_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.taxonomy_handoff_compatible_v1(jsonb,jsonb) TO service_role;
REVOKE ALL ON FUNCTION private.taxonomy_handoff_fit_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.taxonomy_handoff_fit_v1(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION private.taxonomy_preserve_review_handoff_v1(jsonb,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.taxonomy_preserve_review_handoff_v1(jsonb,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.validate_need_v2_fact(p_key text, p_value jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
begin
  if p_key='need.handoff' then
    if not private.taxonomy_handoff_valid_v1(p_value) then
      raise exception 'HANDOFF_INPUT_INVALID' using errcode='22023';
    end if;
    return;
  end if;
  if p_key='need.resolved_location' then
    if p_value is null or p_value='null'::jsonb or private.normalize_resolved_location(p_value,
      p_value#>>'{binding,taskCountryCode}',p_value#>'{binding,geography}',p_value#>>'{binding,exactAddress}') is distinct from p_value then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    return;
  end if;
  if p_key='need.task_country_code' then
    if p_value#>>'{}' is distinct from private.require_location_country(p_value) then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
    end if;
    return;
  end if;

  -- A TIMESTAMPTZ fact must carry the exact ISO 8601 shape the client decoder accepts, so the
  -- server cannot store a value that discards the whole review envelope when it is read. The
  -- pattern is the one in src/data/serverReceipt.ts timestamp(); the two must stay identical.
  if exists(select 1 from private.need_fact_registry
             where fact_key=p_key and schema_version='NEED_FACT_V2' and value_type='TIMESTAMPTZ') then
    if jsonb_typeof(p_value) is distinct from 'string'
      or (p_value#>>'{}') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$' then
      raise exception 'V2_FACT_TIMESTAMP_SHAPE_INVALID' using errcode='22023', detail=p_key;
    end if;
  end if;

  perform private.validate_need_v2_fact_pre_country(p_key,p_value);
end;
$function$;

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
    insert into public.need_requirement_details(need_id,critical_conditions,handoff)
    values(v_need_id,v_conditions,v_handoff);
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
$function$;

CREATE OR REPLACE FUNCTION public.rpc_ai_open_need_edit_conversation_v2(p_need_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_need public.needs%rowtype;
  v_sensitive public.need_sensitive%rowtype;
  v_geo jsonb;
  v_conditions text[]:='{}'::text[];
  v_conversation_id uuid;
  v_key text;
  v_type text;
  v_value jsonb;
  v_display text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null then raise exception 'NEED_ID_REQUIRED' using errcode='22004'; end if;

  select * into v_need from public.needs where id=p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if v_need.requester_account_id<>v_uid then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if v_need.status not in ('DRAFT','PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='P0001'; end if;

  if exists(select 1 from public.agreements a where a.need_id=v_need.id)
     or exists(select 1 from public.need_selections s where s.need_id=v_need.id)
     or exists(select 1 from public.marketplace_responses r where r.need_id=v_need.id and r.status='SELECTED') then
    raise exception 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' using errcode='P0001';
  end if;

  perform 1 from public.need_geography where need_id=v_need.id for share;
  perform 1 from public.need_requirement_details where need_id=v_need.id for share;
  select * into v_sensitive from public.need_sensitive where need_id=v_need.id for share;
  select g.public_topology into v_geo from public.need_geography g where g.need_id=v_need.id;
  select coalesce(d.critical_conditions,'{}'::text[]) into v_conditions
    from public.need_requirement_details d where d.need_id=v_need.id;
  if not found then v_conditions:='{}'::text[]; end if;

  if v_geo is null then
    if v_need.execution_location_mode='REMOTE' then
      v_geo:=jsonb_build_object('mode','REMOTE','start',null,'end',null,'waypoints','[]'::jsonb,'serviceArea',null);
    else
      raise exception 'NEED_EDIT_GEOGRAPHY_NOT_READY' using errcode='P0001';
    end if;
  end if;
  perform private.validate_need_v2_fact('need.task_geography',v_geo);

  insert into public.ai_conversations(account_id,purpose,status,bound_need_id,fact_schema_version)
  values(v_uid,'NEED_INTAKE','OPEN',v_need.id,'NEED_FACT_V2')
  returning id into v_conversation_id;

  for v_key,v_type in
    select fact_key,value_type from private.need_fact_registry
     where schema_version='NEED_FACT_V2'
     order by fact_key
  loop
    v_value:=null;
    v_display:=null;

    case v_key
      when 'need.title' then v_value:=to_jsonb(v_need.title); v_display:=v_need.title;
      when 'need.description' then v_value:=to_jsonb(v_need.description); v_display:=v_need.description;
      when 'need.category' then v_value:=to_jsonb(v_need.category); v_display:=v_need.category;
      when 'need.price_mode' then v_value:=to_jsonb(v_need.mode); v_display:=v_need.mode;
      when 'need.price_rsd' then
        if v_need.requester_price_rsd is not null then v_value:=to_jsonb(v_need.requester_price_rsd); v_display:=v_need.requester_price_rsd::text||' RSD'; end if;
      when 'need.schedule_kind' then v_value:=to_jsonb(v_need.schedule_kind); v_display:=v_need.schedule_kind;
      when 'need.starts_at' then
        if v_need.starts_at is not null then v_value:=to_jsonb(v_need.starts_at); v_display:=to_jsonb(v_need.starts_at)#>>'{}'; end if;
      when 'need.ends_at' then
        if v_need.ends_at is not null then v_value:=to_jsonb(v_need.ends_at); v_display:=to_jsonb(v_need.ends_at)#>>'{}'; end if;
      when 'need.price_basis' then
        -- PKG-027e: an edit keeps what the price is for; without this the edit writer clears it.
        if v_need.mode='MY_PRICE' and v_need.price_basis is not null then
          v_value:=to_jsonb(v_need.price_basis);
          v_display:=case v_need.price_basis when 'PER_PERSON' then 'Po osobi' else 'Ukupno' end;
        end if;
      when 'need.people_needed' then v_value:=to_jsonb(v_need.required_slots); v_display:=v_need.required_slots::text;
      when 'need.required_skills' then v_value:=to_jsonb(coalesce(v_need.required_skills,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_skills,'{}'::text[]),', ');
      when 'need.required_tools' then v_value:=to_jsonb(coalesce(v_need.required_tools,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_tools,'{}'::text[]),', ');
      when 'need.required_vehicles' then v_value:=to_jsonb(coalesce(v_need.required_vehicles,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_vehicles,'{}'::text[]),', ');
      when 'need.required_licenses' then v_value:=to_jsonb(coalesce(v_need.required_licenses,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_licenses,'{}'::text[]),', ');
      when 'need.minimum_experience_years' then
        if v_need.minimum_experience_years is not null then v_value:=to_jsonb(v_need.minimum_experience_years); v_display:=v_need.minimum_experience_years::text; end if;
      when 'need.verified_identity_required' then v_value:=to_jsonb(coalesce(v_need.verified_identity_required,false)); v_display:=case when coalesce(v_need.verified_identity_required,false) then 'Da' else 'Ne' end;
      when 'need.task_country_code' then
        if v_need.task_country_code is not null then v_value:=to_jsonb(v_need.task_country_code); v_display:=v_need.task_country_code; end if;
      when 'need.task_geography' then v_value:=v_geo; v_display:=coalesce(v_geo->'start'->>'label',v_geo->'serviceArea'->>'label',v_geo->>'mode');
      when 'need.handoff' then
        if v_need.execution_location_mode='REMOTE' then
          select d.handoff into v_value from public.need_requirement_details d where d.need_id=v_need.id;
          v_display:=private.taxonomy_handoff_display_v1(v_value);
        end if;
      when 'need.critical_conditions' then
        select array_remove(v_conditions,'Predaja: '||private.taxonomy_handoff_display_v1(d.handoff))
          into v_conditions from public.need_requirement_details d where d.need_id=v_need.id;
        v_value:=to_jsonb(coalesce(v_conditions,'{}'::text[])); v_display:=array_to_string(v_conditions,', ');
      when 'need.public_photo_paths' then v_value:=to_jsonb(coalesce(v_need.public_photo_paths,'{}'::text[])); v_display:=case when cardinality(coalesce(v_need.public_photo_paths,'{}'::text[]))=0 then 'Bez fotografija' else cardinality(v_need.public_photo_paths)::text||' fotografija' end;
      when 'need.exact_address' then
        if v_sensitive.need_id is not null and nullif(btrim(v_sensitive.exact_address),'') is not null then v_value:=to_jsonb(v_sensitive.exact_address); v_display:=v_sensitive.exact_address; end if;
      when 'need.access_notes' then
        if v_sensitive.need_id is not null and nullif(btrim(v_sensitive.access_notes),'') is not null then v_value:=to_jsonb(v_sensitive.access_notes); v_display:=v_sensitive.access_notes; end if;
      else null;
    end case;

    if v_value is not null and v_value<>'null'::jsonb then
      perform private.validate_need_v2_fact(v_key,v_value);
      insert into public.ai_structured_facts(
        account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
        confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,
        fact_schema_version,value_type,display_value
      ) values (
        v_uid,v_conversation_id,v_need.id,v_key,v_value,'CONFIRMED','SYSTEM_DERIVED','NEED_DRAFT',
        1,null,v_uid,statement_timestamp(),'NEED_FACT_V2',v_type,
        coalesce(nullif(left(v_display,1000),''),'—')
      );
    end if;
  end loop;

  -- Clone the already-confirmed private value last, after its public binding facts.
  -- Preserve the original human's provenance; do not manufacture a new confirmation.
  if v_sensitive.resolved_location is not null then
    if private.resolved_location_record_valid(v_sensitive.resolved_location,v_need.task_country_code,v_geo,
      v_sensitive.exact_address,v_uid) is distinct from true then
      raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
    insert into public.ai_structured_facts(account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
      confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,fact_schema_version,value_type,display_value)
    values(v_uid,v_conversation_id,v_need.id,'need.resolved_location',v_sensitive.resolved_location->'value','CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',
      1,null,(v_sensitive.resolved_location->>'confirmedByAccountId')::uuid,(v_sensitive.resolved_location->>'confirmedAt')::timestamptz,
      'NEED_FACT_V2','OBJECT','Potvrđene tačke: '||jsonb_array_length(v_sensitive.resolved_location#>'{value,points}')::text);
  end if;

  return jsonb_build_object(
    'conversationId',v_conversation_id,
    'needId',v_need.id,
    'revision',v_need.revision,
    'status',v_need.status,
    'authoritative',true
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_prepare_ai_task_review_taxonomy(p_conversation_id uuid, p_response_deadline timestamp with time zone DEFAULT NULL::timestamp with time zone, p_location jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare u uuid:=auth.uid(); c public.ai_conversations; n public.needs; profile_id uuid; source jsonb; source_fingerprint text;
 old_location jsonb; location jsonb; review jsonb; facts jsonb:='[]'; item jsonb; k text; val jsonb;
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
 envelope:=envelope||jsonb_build_object('displayedContentDigest',encode(extensions.digest(jsonb_build_object('envelope',envelope,'policy',policy)::text,'sha256'),'hex'));
 insert into private.ai_task_reviews(id,account_id,conversation_id,requester_profile_id,source_hash,policy_binding,envelope,expires_at)
 values(rid,u,c.id,profile_id,source_fingerprint,policy,envelope,expires);
 return envelope;
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_bind_reviewed_worker_service(p_owner_account_id uuid, p_request_key uuid, p_source_review_id uuid, p_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_existing private.work_taxonomy_worker_bindings_v1%ROWTYPE;
 v_batch private.work_taxonomy_review_batches_v1%ROWTYPE;
 v_review private.worker_ai_reviews%ROWTYPE;
 v_save private.worker_ai_saves%ROWTYPE;
 v_profile public.app_profiles%ROWTYPE;
 v_digest text;v_item jsonb;v_plan jsonb;v_category uuid;
 v_key text;v_mode text;v_seen text[]:=ARRAY[]::text[];
 v_modes text[]:=ARRAY[]::text[];v_onsite boolean:=false;v_remote boolean:=false;
 v_result jsonb;v_count integer:=0;v_skills jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'WORKER_BINDER_SERVICE_ROLE_REQUIRED' USING errcode='42501';
 END IF;
 IF p_owner_account_id IS NULL OR p_request_key IS NULL
   OR p_source_review_id IS NULL OR p_profile_id IS NULL THEN
  RAISE EXCEPTION 'WORKER_BINDER_INPUT_INVALID' USING errcode='22023';
 END IF;
 -- Replays are read-only and bound to the very same worker/review/request.
 SELECT * INTO v_existing FROM private.work_taxonomy_worker_bindings_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key FOR UPDATE;
 IF FOUND THEN
  IF v_existing.source_review_id<>p_source_review_id OR v_existing.profile_id<>p_profile_id
  THEN RAISE EXCEPTION 'WORKER_BINDER_REQUEST_KEY_REUSED' USING errcode='22023'; END IF;
  RETURN v_existing.result;
 END IF;
 SELECT * INTO v_batch FROM private.work_taxonomy_review_batches_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key
   AND source_review_id=p_source_review_id AND purpose='WORKER_CAPABILITY'
  FOR SHARE;
 IF NOT FOUND OR v_batch.result->>'status'<>'COMMITTED'
   OR v_batch.result->'requiresBinding' IS DISTINCT FROM 'true'::jsonb
   OR v_batch.result->'capabilityAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR v_batch.result->'notificationAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR jsonb_typeof(v_batch.plans)<>'array'
   OR jsonb_typeof(v_batch.result->'items')<>'array'
   OR jsonb_array_length(v_batch.plans) NOT BETWEEN 1 AND 24
   OR jsonb_array_length(v_batch.result->'items')<>jsonb_array_length(v_batch.plans)
 THEN RAISE EXCEPTION 'WORKER_BINDER_ADMISSION_NOT_COMMITTED' USING errcode='42501'; END IF;
 SELECT * INTO v_review FROM private.worker_ai_reviews
  WHERE id=p_source_review_id AND account_id=p_owner_account_id FOR SHARE;
 IF NOT FOUND OR v_review.envelope->>'classificationState'<>'READY'
   OR v_review.envelope->>'displayedContentDigest' IS DISTINCT FROM v_batch.review_digest
   OR v_review.envelope->'classificationCandidates' IS DISTINCT FROM v_batch.plans
   OR v_review.envelope->'canAccept' IS DISTINCT FROM 'true'::jsonb
   OR jsonb_typeof(v_review.envelope->'reviewedServiceModes')<>'array'
   OR jsonb_array_length(v_review.envelope->'reviewedServiceModes')
       <>jsonb_array_length(v_batch.plans)
   OR v_review.envelope->>'profileId' IS DISTINCT FROM p_profile_id::text
 THEN RAISE EXCEPTION 'WORKER_BINDER_REVIEW_NOT_BOUND' USING errcode='42501'; END IF;
 v_digest:=encode(extensions.digest(
  ((v_review.envelope-'displayedContentDigest')
    ||jsonb_build_object('baseHash',v_review.base_hash))::text,'sha256'),'hex');
 IF v_digest IS DISTINCT FROM v_batch.review_digest THEN
   RAISE EXCEPTION 'WORKER_BINDER_REVIEW_DIGEST_INVALID' USING errcode='42501'; END IF;
 SELECT * INTO v_save FROM private.worker_ai_saves
  WHERE review_id=p_source_review_id AND account_id=p_owner_account_id
    AND client_request_id=p_request_key FOR SHARE;
 IF NOT FOUND OR v_save.created_at>v_review.expires_at
   OR v_save.receipt->'saved' IS DISTINCT FROM 'true'::jsonb
   OR v_save.receipt->>'profileId' IS DISTINCT FROM p_profile_id::text
   OR v_save.receipt->>'profileStatus'<>'ACTIVE'
 THEN RAISE EXCEPTION 'WORKER_BINDER_SAVE_OR_ACTIVATION_REQUIRED' USING errcode='42501'; END IF;
 -- A delayed outbox command from an OLD Save must never re-enable modes
 -- superseded by a newer user-confirmed worker review for this same profile.
 IF EXISTS(SELECT 1 FROM private.worker_ai_saves newer
   WHERE newer.account_id=p_owner_account_id
     AND newer.created_at>v_save.created_at
     AND newer.receipt->>'profileId'=p_profile_id::text)
 THEN RAISE EXCEPTION 'WORKER_BINDER_NEWER_SAVE_EXISTS' USING errcode='PT409'; END IF;
 -- Hold current worker profile throughout the transaction. Reject any edit
 -- after the reviewed Save, even if the new skill text happens to be identical.
 SELECT * INTO v_profile FROM public.app_profiles
  WHERE id=p_profile_id AND account_id=p_owner_account_id AND kind='WORKER'
  FOR UPDATE;
 v_skills:=v_review.envelope#>'{profile,skills}';
 IF NOT FOUND OR v_profile.profile_status<>'ACTIVE'
   OR v_profile.updated_at>v_save.created_at
   OR jsonb_typeof(v_skills)<>'array'
   OR to_jsonb(v_profile.skills) IS DISTINCT FROM v_skills
 THEN RAISE EXCEPTION 'WORKER_BINDER_CURRENT_PROFILE_REQUIRED' USING errcode='PT409'; END IF;
 -- Make every scope and category EXACT. A related branch never certifies ability.
 FOR v_count IN 0..jsonb_array_length(v_batch.plans)-1 LOOP
   v_plan:=v_batch.plans->v_count;
   v_item:=v_batch.result->'items'->v_count;
   v_key:=private.taxonomy_normalize_v1(v_item->>'service');
   v_mode:=v_item->>'mode';
   IF v_plan->>'mode' IS DISTINCT FROM v_mode
     OR private.taxonomy_normalize_v1(v_plan->>'service') IS DISTINCT FROM v_key
     OR v_plan->>'action' NOT IN ('REUSE_EXISTING','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH')
     OR v_mode NOT IN ('ON_SITE','REMOTE')
     OR jsonb_typeof(v_item->'categoryId')<>'string'
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_skills) offered(value)
       WHERE private.taxonomy_normalize_v1(offered.value#>>'{}')=v_key)
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(
        v_review.envelope->'reviewedServiceModes') m(value)
       WHERE private.taxonomy_normalize_v1(m.value->>'service')=v_key
         AND m.value->>'mode'=v_mode)
     OR v_key||'|'||v_mode=ANY(v_seen)
   THEN RAISE EXCEPTION 'WORKER_BINDER_SERVICE_OR_MODE_NOT_REVIEWED' USING errcode='42501'; END IF;
   v_seen:=array_append(v_seen,v_key||'|'||v_mode);
   v_category:=(v_item->>'categoryId')::uuid;
   IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
      JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
      WHERE c.id=v_category AND c.state='ESTABLISHED'
        AND cm.execution_scope=v_mode
        AND (c.canonical_key=v_key OR EXISTS(
          SELECT 1 FROM private.work_taxonomy_aliases a
          WHERE a.category_id=c.id AND a.normalized_key=v_key)))
   THEN RAISE EXCEPTION 'WORKER_BINDER_CATEGORY_STALE' USING errcode='42501'; END IF;
   -- A past withdrawal (excluded=true) is NOT permanent: the owner may
   -- deliberately offer this service again in a NEW signed Save. ONLY this
   -- binder may restore it, with zero inherited related-offer consent.
   IF v_mode='ON_SITE' THEN v_onsite:=true; ELSE v_remote:=true; END IF;
 END LOOP;
 -- A recent explicit global-mode change must not be overwritten by a delayed
 -- binder from an older review. All updates below are ONE DB transaction.
 IF EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
   WHERE choice.worker_profile_id=p_profile_id AND choice.updated_at>v_save.created_at)
 THEN RAISE EXCEPTION 'WORKER_BINDER_NEWER_GLOBAL_MODE' USING errcode='PT409'; END IF;
 IF v_onsite THEN v_modes:=array_append(v_modes,'ON_SITE'); END IF;
 IF v_remote THEN v_modes:=array_append(v_modes,'REMOTE'); END IF;
 INSERT INTO private.worker_execution_mode_choices(
   worker_profile_id,worker_account_id,modes,consent_source,confirmed_at,updated_at)
 VALUES(p_profile_id,p_owner_account_id,v_modes,'EXPLICIT_PROFILE_REVIEW',
   statement_timestamp(),statement_timestamp())
 ON CONFLICT(worker_profile_id) DO UPDATE
   SET modes=excluded.modes,consent_source='EXPLICIT_PROFILE_REVIEW',
       confirmed_at=statement_timestamp(),updated_at=statement_timestamp();
 -- Catalog identities and per-service scope are granted only AFTER the
 -- signed review, saved receipt and current profile all passed.
 FOR v_count IN 0..jsonb_array_length(v_batch.plans)-1 LOOP
   v_item:=v_batch.result->'items'->v_count;
   v_category:=(v_item->>'categoryId')::uuid;v_mode:=v_item->>'mode';
   INSERT INTO private.work_taxonomy_worker_capabilities(
      worker_account_id,category_id,confirmed_at,allow_related_offers,excluded,origin)
   VALUES(p_owner_account_id,v_category,statement_timestamp(),false,false,'WORKER_CONFIRMED')
   ON CONFLICT(worker_account_id,category_id) DO UPDATE
     SET confirmed_at=statement_timestamp(),updated_at=statement_timestamp(),
         excluded=false,allow_related_offers=false,origin='WORKER_CONFIRMED';
   INSERT INTO private.taxonomy_confirmed_worker_modes_v1(
     worker_account_id,category_id,execution_scope,source_review_id,source_request_key,
     confirmed_at,active,handoff)
   VALUES(p_owner_account_id,v_category,v_mode,p_source_review_id,p_request_key,
     statement_timestamp(),true,v_batch.plans->v_count->'handoff')
   ON CONFLICT(worker_account_id,category_id,execution_scope) DO UPDATE
    SET source_review_id=excluded.source_review_id,
        source_request_key=excluded.source_request_key,
        confirmed_at=statement_timestamp(),active=true,handoff=excluded.handoff;
 END LOOP;
 -- The CURRENT complete review replaces old per-service permission. Retain
 -- history, but deactivate obsolete modes; never manufacture a related opt-in.
 UPDATE private.taxonomy_confirmed_worker_modes_v1 old
 SET active=false
 WHERE old.worker_account_id=p_owner_account_id AND old.active
   AND NOT EXISTS(
     SELECT 1 FROM jsonb_array_elements(v_batch.result->'items') item(value)
     WHERE (item.value->>'categoryId')::uuid=old.category_id
       AND item.value->>'mode'=old.execution_scope);
 v_result:=jsonb_build_object('status','BOUND_WORKER_SERVICES',
   'workerProfileId',p_profile_id,'serviceModeCount',jsonb_array_length(v_batch.plans),
   'catalogVersion',v_batch.catalog_version,'dispatchAuthority','NONE',
   'notificationAuthority','NONE','relatedOfferAuthority','NONE');
 INSERT INTO private.work_taxonomy_worker_bindings_v1(
   owner_account_id,request_key,source_review_id,profile_id,catalog_version,result)
 VALUES(p_owner_account_id,p_request_key,p_source_review_id,p_profile_id,
   v_batch.catalog_version,v_result);
 RETURN v_result;
END $function$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_bind_reviewed_need_service(p_owner_account_id uuid, p_request_key uuid, p_source_review_id uuid, p_need_id uuid, p_need_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_existing private.work_taxonomy_need_bindings_v1%ROWTYPE;
 v_batch private.work_taxonomy_review_batches_v1%ROWTYPE;
 v_review private.ai_task_reviews%ROWTYPE;
 v_command private.ai_task_review_commands%ROWTYPE;
 v_need public.needs%ROWTYPE;
 v_plan jsonb;v_item jsonb;v_category uuid;v_scope text;v_service text;v_category_version bigint;
 v_expected_digest text;v_result jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
   RAISE EXCEPTION 'NEED_BINDER_SERVICE_ROLE_REQUIRED' USING errcode='42501';
 END IF;
 IF p_owner_account_id IS NULL OR p_request_key IS NULL OR p_source_review_id IS NULL
    OR p_need_id IS NULL OR coalesce(p_need_revision,0)<1 THEN
   RAISE EXCEPTION 'NEED_BINDER_INPUT_INVALID' USING errcode='22023';
 END IF;
 SELECT * INTO v_existing FROM private.work_taxonomy_need_bindings_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key FOR UPDATE;
 IF FOUND THEN
   IF v_existing.source_review_id<>p_source_review_id OR v_existing.need_id<>p_need_id
     OR v_existing.need_revision<>p_need_revision THEN
     RAISE EXCEPTION 'NEED_BINDER_REQUEST_KEY_REUSED' USING errcode='22023';
   END IF;
   RETURN v_existing.result;
 END IF;
 SELECT * INTO v_batch FROM private.work_taxonomy_review_batches_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key
    AND source_review_id=p_source_review_id AND purpose='NEED_SERVICE' FOR SHARE;
 IF NOT FOUND OR v_batch.result->>'status'<>'COMMITTED'
   OR v_batch.result->'requiresBinding' IS DISTINCT FROM 'true'::jsonb
   OR v_batch.result->'capabilityAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR v_batch.result->'notificationAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR jsonb_typeof(v_batch.result->'items')<>'array'
   OR jsonb_array_length(v_batch.result->'items')<>1 THEN
   RAISE EXCEPTION 'NEED_BINDER_ADMISSION_NOT_COMMITTED' USING errcode='42501';
 END IF;
 SELECT * INTO v_review FROM private.ai_task_reviews r
  WHERE r.id=p_source_review_id AND r.account_id=p_owner_account_id FOR SHARE;
 IF NOT FOUND OR v_review.envelope->>'classificationState'<>'READY'
   OR v_review.envelope->>'displayedContentDigest' IS DISTINCT FROM v_batch.review_digest
   OR v_review.envelope->'classificationCandidates' IS DISTINCT FROM v_batch.plans
   OR jsonb_array_length(coalesce(v_review.envelope->'classificationCandidates','[]'::jsonb))<>1 THEN
   RAISE EXCEPTION 'NEED_BINDER_REVIEW_NOT_BOUND' USING errcode='42501';
 END IF;
 v_expected_digest:=encode(extensions.digest(jsonb_build_object('envelope',
   v_review.envelope-'displayedContentDigest','policy',v_review.policy_binding)::text,'sha256'),'hex');
 IF v_expected_digest<>v_batch.review_digest THEN
   RAISE EXCEPTION 'NEED_BINDER_REVIEW_DIGEST_INVALID' USING errcode='42501';
 END IF;
 SELECT * INTO v_command FROM private.ai_task_review_commands c
  WHERE c.review_id=p_source_review_id AND c.account_id=p_owner_account_id
    AND c.client_request_id=p_request_key AND c.need_id=p_need_id
    AND c.need_revision=p_need_revision
    AND c.state IN ('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NEED_BINDER_SAVE_REQUIRED' USING errcode='42501'; END IF;
 v_plan:=v_batch.plans->0;
 v_item:=v_batch.result->'items'->0;
 IF v_plan->>'mode' IS DISTINCT FROM v_item->>'mode'
   OR private.taxonomy_normalize_v1(v_plan->>'service')
      IS DISTINCT FROM private.taxonomy_normalize_v1(v_item->>'service')
   OR v_plan->>'action' NOT IN ('REUSE_EXISTING','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH')
 THEN RAISE EXCEPTION 'NEED_BINDER_CATEGORY_RECEIPT_INVALID' USING errcode='42501'; END IF;
 v_category:=(v_item->>'categoryId')::uuid;
 v_category_version:=v_batch.catalog_version;
 SELECT * INTO v_need FROM public.needs n WHERE n.id=p_need_id FOR UPDATE;
 IF NOT FOUND OR v_need.requester_account_id<>p_owner_account_id OR
    v_need.revision<>p_need_revision OR v_need.status NOT IN ('DRAFT','PUBLISHED','SELECTION') THEN
   RAISE EXCEPTION 'NEED_BINDER_CURRENT_REVISION_REQUIRED' USING errcode='PT409';
 END IF;
 v_scope:=private.taxonomy_execution_scope_v1(v_need.execution_location_mode);
 IF v_scope IS NULL OR v_scope<>v_item->>'mode'
   OR private.taxonomy_normalize_v1(v_need.category)
      <>private.taxonomy_normalize_v1(v_item->>'service')
 THEN RAISE EXCEPTION 'NEED_BINDER_SERVICE_OR_MODE_STALE' USING errcode='PT409'; END IF;
 -- Both public projection and routing were saved from the same signed fact.
 IF (v_scope='REMOTE' AND NOT private.taxonomy_handoff_valid_v1(v_plan->'handoff'))
    OR (SELECT d.handoff FROM public.need_requirement_details d WHERE d.need_id=p_need_id)
      IS DISTINCT FROM v_plan->'handoff' THEN
   RAISE EXCEPTION 'NEED_BINDER_HANDOFF_STALE' USING errcode='PT409';
 END IF;
 PERFORM 1 FROM private.work_taxonomy_categories c
  JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
  WHERE c.id=v_category AND c.state='ESTABLISHED' AND m.execution_scope=v_scope;
 IF NOT FOUND THEN RAISE EXCEPTION 'NEED_BINDER_CATEGORY_RETIRED' USING errcode='42501'; END IF;
 IF v_need.category_id IS NOT NULL AND v_need.category_id<>v_category THEN
   RAISE EXCEPTION 'NEED_BINDER_CONFLICTING_EXISTING_CATEGORY' USING errcode='PT409'; END IF;
 PERFORM 1 FROM private.work_taxonomy_need_snapshots s
  WHERE s.need_id=p_need_id AND s.need_revision=p_need_revision FOR UPDATE;
 IF FOUND THEN RAISE EXCEPTION 'NEED_BINDER_EXISTING_SNAPSHOT_REVIEW_REQUIRED' USING errcode='PT409'; END IF;
 -- Same transaction: category reference + single authoritative revision
 -- snapshot + durable replay receipt. A failed write rolls all three back.
 UPDATE public.needs SET category_id=v_category WHERE id=p_need_id
    AND revision=p_need_revision AND category_id IS DISTINCT FROM v_category;
 INSERT INTO private.work_taxonomy_need_snapshots
  (need_id,need_revision,category_id,catalog_version,reviewed_by_requester,
   source,classification_state,original_category)
 VALUES(p_need_id,p_need_revision,v_category,v_category_version,true,
   'OWNER_REVIEWED_BATCH','CONFIRMED',v_need.category);
 v_result:=jsonb_build_object('status','BOUND_NEED_REVISION',
   'needId',p_need_id,'needRevision',p_need_revision,'categoryId',v_category,
   'catalogVersion',v_category_version,
   'dispatchAuthority','NONE','notificationAuthority','NONE');
 INSERT INTO private.work_taxonomy_need_bindings_v1
  (owner_account_id,request_key,source_review_id,need_id,need_revision,
   category_id,catalog_version,result)
 VALUES(p_owner_account_id,p_request_key,p_source_review_id,p_need_id,
   p_need_revision,v_category,v_category_version,v_result);
 RETURN v_result;
END $function$;

CREATE OR REPLACE FUNCTION private.worker_ai_service_mode_context_v1(p_account_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 s private.worker_ai_sessions; v_saved private.worker_ai_saves; v_previous record;
 v_current jsonb; v_item jsonb; v_projection jsonb; v_hints jsonb; v_source text;
 v_saved_services jsonb:='[]';v_draft_services jsonb:='[]';v_unresolved jsonb:='[]';
 v_count integer;v_category uuid;v_handoff jsonb;
BEGIN
 SELECT * INTO s FROM private.worker_ai_sessions
 WHERE account_id=p_account_id AND conversation_id=p_conversation_id;
 IF NOT FOUND OR s.base_hash IS DISTINCT FROM private.worker_ai_source_hash(p_account_id)
    OR jsonb_typeof(s.candidate->'skills') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'WORKER_AI_NOT_EDITABLE' USING errcode='55000'; END IF;
 v_current:=private.worker_ai_initial(p_account_id);
 -- A STABLE reader observes one statement snapshot. The saved profile's source
 -- hash must still match the conversation base. The candidate may change bio,
 -- availability or other draft fields without turning catalog modes into consent.
 SELECT * INTO v_saved FROM private.worker_ai_saves saved
 WHERE saved.account_id=p_account_id AND saved.receipt->>'profileId'=s.profile_id::text
 ORDER BY saved.created_at DESC,saved.review_id DESC LIMIT 1;
 IF FOUND AND v_saved.receipt->'saved'='true'::jsonb
    AND v_saved.receipt->'authoritative'='true'::jsonb
    AND v_saved.receipt->>'profileStatus'='ACTIVE'
    AND NOT EXISTS(SELECT 1 FROM private.worker_ai_saves other
      WHERE other.account_id=p_account_id AND other.receipt->>'profileId'=s.profile_id::text
        AND other.created_at=v_saved.created_at AND other.review_id<>v_saved.review_id)
 THEN
   -- Same durable Save/review/batch/binding/current-consent chain as the applied
   -- saved-review continuity fix. Review expiry constrains the original Save;
   -- it does not expire a mode that the owner already saved.
   SELECT previous.*,binding.bound_at,batch.result AS batch_result INTO v_previous
   FROM private.worker_ai_reviews previous
   JOIN public.app_profiles profile ON profile.id=s.profile_id
     AND profile.account_id=p_account_id AND profile.kind='WORKER'
     AND profile.profile_status='ACTIVE' AND profile.updated_at<=v_saved.created_at
   JOIN private.work_taxonomy_worker_bindings_v1 binding
     ON binding.owner_account_id=p_account_id AND binding.profile_id=s.profile_id
     AND binding.request_key=v_saved.client_request_id AND binding.source_review_id=previous.id
   JOIN private.work_taxonomy_review_batches_v1 batch
     ON batch.owner_account_id=p_account_id AND batch.request_key=v_saved.client_request_id
     AND batch.source_review_id=previous.id AND batch.purpose='WORKER_CAPABILITY'
   JOIN private.worker_execution_mode_choices choice
     ON choice.worker_profile_id=s.profile_id AND choice.worker_account_id=p_account_id
     AND choice.consent_source='EXPLICIT_PROFILE_REVIEW'
     AND choice.confirmed_at=binding.bound_at AND choice.updated_at=binding.bound_at
   WHERE previous.id=v_saved.review_id AND previous.account_id=p_account_id
     AND previous.envelope->>'profileId'=s.profile_id::text
     AND previous.envelope->'profile'=v_current
     AND previous.envelope->>'classificationState'='READY'
     AND previous.envelope->'canAccept'='true'::jsonb
     AND previous.created_at<=v_saved.created_at AND v_saved.created_at<=previous.expires_at
     AND binding.bound_at>=v_saved.created_at
     AND binding.result->>'status'='BOUND_WORKER_SERVICES'
     AND binding.result->>'workerProfileId'=s.profile_id::text
     AND batch.result->>'status'='COMMITTED' AND batch.result->'requiresBinding'='true'::jsonb
     AND batch.catalog_version=binding.catalog_version
     AND batch.plans=previous.envelope->'classificationCandidates'
     AND batch.review_digest=previous.envelope->>'displayedContentDigest'
     AND batch.review_digest=encode(extensions.digest(
       ((previous.envelope-'displayedContentDigest')||
         jsonb_build_object('baseHash',previous.base_hash))::text,'sha256'),'hex')
     AND jsonb_typeof(previous.envelope->'reviewedServiceModes')='array'
     AND jsonb_typeof(batch.result->'items')='array'
     AND jsonb_array_length(previous.envelope->'reviewedServiceModes') BETWEEN 1 AND 24
     AND jsonb_array_length(previous.envelope->'reviewedServiceModes')=jsonb_array_length(batch.plans)
     AND jsonb_array_length(batch.plans)=jsonb_array_length(batch.result->'items')
     AND binding.result->'serviceModeCount'=to_jsonb(jsonb_array_length(batch.plans))
     AND choice.modes=ARRAY(SELECT DISTINCT item->>'mode'
       FROM jsonb_array_elements(previous.envelope->'reviewedServiceModes') item ORDER BY item->>'mode');
   IF FOUND THEN
     FOR v_item IN SELECT value FROM jsonb_array_elements(v_previous.envelope->'reviewedServiceModes') LOOP
       -- Keep independent surviving skills. Removed or ambiguous services never
       -- inherit a binding; adding an unmapped skill does not erase another one.
       IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.candidate->'skills') skill(value)
           WHERE skill.value=to_jsonb(v_item->>'service'))
          OR (SELECT count(*) FROM jsonb_array_elements(s.candidate->'skills') skill(value)
              WHERE private.taxonomy_normalize_v1(skill.value#>>'{}')=
                    private.taxonomy_normalize_v1(v_item->>'service'))<>1
       THEN CONTINUE; END IF;
       SELECT count(*),min(category.id::text)::uuid INTO v_count,v_category
       FROM jsonb_array_elements(v_previous.batch_result->'items') admitted(value)
       JOIN private.work_taxonomy_categories category ON category.id::text=admitted.value->>'categoryId'
       JOIN private.work_taxonomy_category_modes scope ON scope.category_id=category.id
         AND scope.execution_scope=v_item->>'mode'
       JOIN private.taxonomy_confirmed_worker_modes_v1 mode
         ON mode.worker_account_id=p_account_id AND mode.category_id=category.id
         AND mode.execution_scope=scope.execution_scope AND mode.active
         AND mode.source_review_id=v_saved.review_id AND mode.source_request_key=v_saved.client_request_id
         AND mode.confirmed_at=v_previous.bound_at
       JOIN private.work_taxonomy_worker_capabilities capability
         ON capability.worker_account_id=p_account_id AND capability.category_id=category.id
         AND NOT capability.excluded AND capability.origin='WORKER_CONFIRMED'
         AND capability.confirmed_at=v_previous.bound_at AND capability.updated_at<=v_previous.bound_at
       WHERE admitted.value->>'service'=v_item->>'service'
         AND admitted.value->>'mode'=v_item->>'mode'
         AND v_item->>'mode' IN ('ON_SITE','REMOTE')
         AND category.state='ESTABLISHED'
         AND (category.canonical_key=private.taxonomy_normalize_v1(v_item->>'service')
           OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases alias
             WHERE alias.category_id=category.id
               AND alias.normalized_key=private.taxonomy_normalize_v1(v_item->>'service')));
       IF v_count<>1 THEN CONTINUE; END IF;
       v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
         jsonb_build_array(v_item->>'service'),jsonb_build_array(
           jsonb_build_object('service',v_item->>'service','mode',v_item->>'mode')));
       IF v_projection->>'status'='READY'
          AND v_projection#>>'{classificationCandidates,0,categoryId}'=v_category::text
       THEN
         select m.handoff into v_handoff from private.taxonomy_confirmed_worker_modes_v1 m
          where m.worker_account_id=p_account_id and m.category_id=v_category
            and m.execution_scope=v_item->>'mode' and m.active
            and m.source_review_id=v_saved.review_id and m.source_request_key=v_saved.client_request_id;
         v_saved_services:=v_saved_services||jsonb_build_array(jsonb_build_object(
         'service',v_item->>'service','mode',v_item->>'mode','categoryId',v_category)
          ||case when v_handoff is not null then jsonb_build_object('handoff',v_handoff) else '{}'::jsonb end);
       END IF;
     END LOOP;
   END IF;
 END IF;

 -- Latest current-source hints are separate proposals. Even an exact category
 -- and mode here are not saved consent and must never replace the baseline.
 v_source:=encode(extensions.digest(convert_to(
   s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex');
 SELECT h.proposals INTO v_hints FROM private.work_taxonomy_gemini_turn_hints_v1 h
 WHERE h.purpose='WORKER_CAPABILITY' AND h.account_id=p_account_id
   AND h.conversation_id=p_conversation_id AND h.source_fingerprint=v_source
   AND h.catalog_version=(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton=true)
 ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
 IF jsonb_typeof(v_hints)='array' THEN
   FOR v_item IN SELECT value FROM jsonb_array_elements(v_hints) LOOP
     IF v_item->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
        OR v_item->>'mode' NOT IN ('ON_SITE','REMOTE')
        OR v_item->>'categoryId' IS NULL
        OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.candidate->'skills') skill(value)
          WHERE skill.value=to_jsonb(v_item->>'service'))
        OR (SELECT count(*) FROM jsonb_array_elements(s.candidate->'skills') skill(value)
            WHERE private.taxonomy_normalize_v1(skill.value#>>'{}')=
                  private.taxonomy_normalize_v1(v_item->>'service'))<>1
     THEN CONTINUE; END IF;
     v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
       jsonb_build_array(v_item->>'service'),jsonb_build_array(
         jsonb_build_object('service',v_item->>'service','mode',v_item->>'mode')));
     IF v_projection->>'status'='READY'
        AND v_projection#>>'{classificationCandidates,0,categoryId}'=v_item->>'categoryId'
     THEN v_draft_services:=v_draft_services||jsonb_build_array(jsonb_build_object(
       'service',v_item->>'service','mode',v_item->>'mode','categoryId',v_item->>'categoryId')
        ||case when v_item ? 'handoff' then jsonb_build_object('handoff',v_item->'handoff') else '{}'::jsonb end);
     END IF;
   END LOOP;
 END IF;
 SELECT coalesce(jsonb_agg(value ORDER BY value->>'service',value->>'mode',value->>'categoryId'),'[]'::jsonb)
 INTO v_saved_services FROM (SELECT DISTINCT value FROM jsonb_array_elements(v_saved_services)) rows;
 SELECT coalesce(jsonb_agg(value ORDER BY value->>'service',value->>'mode',value->>'categoryId'),'[]'::jsonb)
 INTO v_draft_services FROM (SELECT DISTINCT value FROM jsonb_array_elements(v_draft_services)) rows;
 SELECT coalesce(jsonb_agg(value ORDER BY value#>>'{}'),'[]'::jsonb) INTO v_unresolved
 FROM (SELECT DISTINCT skill.value FROM jsonb_array_elements(s.candidate->'skills') skill(value)
   WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_saved_services||v_draft_services) known(value)
     WHERE known.value->>'service'=skill.value#>>'{}')) unresolved;
 RETURN jsonb_build_object('schemaVersion','WORKER_SERVICE_MODE_CONTEXT_V1','revision',s.revision,
   'savedServices',v_saved_services,'draftServices',v_draft_services,'unresolvedServices',v_unresolved);
END $function$;

CREATE OR REPLACE FUNCTION public.rpc_prepare_worker_ai_review_taxonomy(p_conversation_id uuid, p_expected_revision integer, p_activate boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; doc jsonb; missing jsonb:='[]'; expires timestamptz;
 v_source text;v_hints jsonb;v_modes jsonb:='[]'::jsonb;v_item jsonb;v_projection jsonb;
 v_saved private.worker_ai_saves;v_previous record;v_retained jsonb:='[]'::jsonb;v_count integer;v_category uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(auth.uid());
 select * into s from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=auth.uid() for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 perform 1 from public.ai_conversations where id=p_conversation_id and status='OPEN' for update;
 if not found or s.safety in ('BLOCK','REVIEW') then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 perform 1 from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
 if s.revision is distinct from p_expected_revision or s.base_hash<>private.worker_ai_source_hash(auth.uid()) then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 if p_activate is null or exists(select 1 from private.worker_ai_turns where conversation_id=p_conversation_id and state='PROCESSING') then raise exception 'WORKER_AI_TURN_PENDING' using errcode='55000'; end if;
 if p_activate then
  if length(s.candidate->>'displayName')<2 then missing:=missing||'"Ime"'::jsonb; end if;
  if length(s.candidate#>>'{location,city}')<2 then missing:=missing||'"Mesto rada"'::jsonb; end if;
  if jsonb_array_length(s.candidate->'skills')<1 then missing:=missing||'"Veštine"'::jsonb; end if;
 end if;
 if (s.candidate->'location')<> (private.worker_ai_initial(auth.uid())->'location')
  and (s.candidate#>'{location,operatingCountryCode}'='null'::jsonb or length(s.candidate#>>'{location,city}')<1)
 then missing:=missing||'"Država i mesto rada"'::jsonb; end if;
 perform private.normalize_worker_ai_availability(s.profile_id,s.account_id,s.candidate->'availability');
 select * into r from private.worker_ai_reviews where conversation_id=p_conversation_id and revision=s.revision
  and base_hash=s.base_hash and envelope->'activate'=to_jsonb(p_activate) and expires_at>clock_timestamp()
  and s.revision>0 -- untouched sessions revalidate saved consent on every review
  and envelope->>'classificationState'='READY'
  and envelope->>'classificationCatalogFingerprint'=private.taxonomy_admission_fingerprint_v1()
  order by created_at desc limit 1;
 if found then return r.envelope; end if;
 r.id:=extensions.gen_random_uuid(); expires:=clock_timestamp()+interval '15 minutes';
 doc:=jsonb_build_object('schemaVersion','WORKER_PROFILE_V1','reviewId',r.id,'conversationId',p_conversation_id,'accountId',auth.uid(),
  'profileId',s.profile_id,'revision',s.revision,'profile',s.candidate,'activate',p_activate,'missingRequired',missing,
  'canAccept',jsonb_array_length(missing)=0,'expiresAt',expires);
 -- Use only hints bound to the authenticated worker, this conversation, and
 -- the exact CURRENT candidate/revision/base_hash. They are suggestions only.
 v_source:=encode(extensions.digest(
   convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex');
 select h.proposals into v_hints from private.work_taxonomy_gemini_turn_hints_v1 h
 where h.purpose='WORKER_CAPABILITY' and h.account_id=auth.uid()
   and h.conversation_id=p_conversation_id and h.source_fingerprint=v_source
   and h.catalog_version=(select catalog_version from private.work_taxonomy_control where singleton=true)
 order by h.created_at desc,h.id desc limit 1;
 if jsonb_typeof(v_hints)='array' then
   for v_item in select value from jsonb_array_elements(v_hints) loop
     if v_item->>'mode' in ('ON_SITE','REMOTE')
       and v_item->>'action' in ('REUSE_EXISTING','REUSE_ALIAS','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH') then
       v_modes:=v_modes||jsonb_build_array(jsonb_build_object(
         'service',v_item->>'service','mode',v_item->>'mode'));
     end if;
   end loop;
 end if;

 -- A new untouched conversation may show the modes the owner already saved.
 -- This is continuity of an exact, current signed binding, not AI inference
 -- from a city, service wording, global flags, or a merely related category.
 if s.revision=0 and v_modes='[]'::jsonb
    and s.candidate=private.worker_ai_initial(auth.uid())
    and not exists(select 1 from private.worker_ai_turns where conversation_id=p_conversation_id)
    and not exists(select 1 from private.work_taxonomy_gemini_turn_hints_v1
      where account_id=auth.uid() and conversation_id=p_conversation_id)
 then
   select * into v_saved from private.worker_ai_saves saved
    where saved.account_id=auth.uid() and saved.receipt->>'profileId'=s.profile_id::text
    order by saved.created_at desc,saved.review_id desc limit 1;
   if found and v_saved.receipt->'saved'='true'::jsonb
      and v_saved.receipt->'authoritative'='true'::jsonb
      and v_saved.receipt->>'profileStatus'='ACTIVE'
      and not exists(select 1 from private.worker_ai_saves other
        where other.account_id=auth.uid() and other.receipt->>'profileId'=s.profile_id::text
          and other.created_at=v_saved.created_at and other.review_id<>v_saved.review_id)
   then
     -- The profile row is locked above. Lock the exact binding and current
     -- consent rows too, so a withdrawal cannot race the continuity read.
     perform 1 from private.work_taxonomy_worker_bindings_v1 binding
       where binding.owner_account_id=auth.uid() and binding.profile_id=s.profile_id
         and binding.request_key=v_saved.client_request_id for share;
     perform 1 from private.worker_execution_mode_choices choice
       where choice.worker_profile_id=s.profile_id for share;
     perform 1 from private.taxonomy_confirmed_worker_modes_v1 mode
       where mode.worker_account_id=auth.uid() for share;
     perform 1 from private.work_taxonomy_worker_capabilities capability
       where capability.worker_account_id=auth.uid() for share;
     select previous.*, binding.bound_at, batch.result as batch_result
       into v_previous
       from private.worker_ai_reviews previous
       join public.app_profiles profile on profile.id=s.profile_id
         and profile.account_id=auth.uid() and profile.kind='WORKER'
         and profile.profile_status='ACTIVE' and profile.updated_at<=v_saved.created_at
       join private.work_taxonomy_worker_bindings_v1 binding
         on binding.owner_account_id=auth.uid() and binding.profile_id=s.profile_id
        and binding.request_key=v_saved.client_request_id and binding.source_review_id=previous.id
       join private.work_taxonomy_review_batches_v1 batch
         on batch.owner_account_id=auth.uid() and batch.request_key=v_saved.client_request_id
        and batch.source_review_id=previous.id and batch.purpose='WORKER_CAPABILITY'
       join private.worker_execution_mode_choices choice
         on choice.worker_profile_id=s.profile_id and choice.worker_account_id=auth.uid()
        and choice.consent_source='EXPLICIT_PROFILE_REVIEW'
        and choice.confirmed_at=binding.bound_at and choice.updated_at=binding.bound_at
       where previous.id=v_saved.review_id and previous.account_id=auth.uid()
         and previous.envelope->>'profileId'=s.profile_id::text
         and previous.envelope->'profile'=s.candidate
         and previous.envelope->>'classificationState'='READY'
         and previous.envelope->'canAccept'='true'::jsonb
         -- Expiration limits the original Save, not the durable saved consent.
         and previous.created_at<=v_saved.created_at and v_saved.created_at<=previous.expires_at
         and binding.bound_at>=v_saved.created_at
         and binding.result->>'status'='BOUND_WORKER_SERVICES'
         and binding.result->>'workerProfileId'=s.profile_id::text
         and batch.result->>'status'='COMMITTED'
         and batch.result->'requiresBinding'='true'::jsonb
         and batch.catalog_version=binding.catalog_version
         and batch.plans=previous.envelope->'classificationCandidates'
         and batch.review_digest=previous.envelope->>'displayedContentDigest'
         and batch.review_digest=encode(extensions.digest(
           ((previous.envelope-'displayedContentDigest')||
             jsonb_build_object('baseHash',previous.base_hash))::text,'sha256'),'hex')
         and jsonb_typeof(previous.envelope->'reviewedServiceModes')='array'
         and jsonb_typeof(batch.result->'items')='array'
         and jsonb_array_length(previous.envelope->'reviewedServiceModes') between 1 and 24
         and jsonb_array_length(previous.envelope->'reviewedServiceModes')=jsonb_array_length(batch.plans)
         and jsonb_array_length(batch.plans)=jsonb_array_length(batch.result->'items')
         and binding.result->'serviceModeCount'=to_jsonb(jsonb_array_length(batch.plans))
         and choice.modes = array(
           select distinct item->>'mode'
           from jsonb_array_elements(previous.envelope->'reviewedServiceModes') item
           order by item->>'mode');
     if found then
       for v_item in select value from jsonb_array_elements(v_previous.envelope->'reviewedServiceModes') loop
         select count(*),min(category.id::text)::uuid into v_count,v_category
         from jsonb_array_elements(v_previous.batch_result->'items') admitted(value)
         join private.work_taxonomy_categories category on category.id::text=admitted.value->>'categoryId'
         join private.work_taxonomy_category_modes scope on scope.category_id=category.id
           and scope.execution_scope=v_item->>'mode'
         join private.taxonomy_confirmed_worker_modes_v1 mode
           on mode.worker_account_id=auth.uid() and mode.category_id=category.id
          and mode.execution_scope=scope.execution_scope and mode.active
          and mode.source_review_id=v_saved.review_id and mode.source_request_key=v_saved.client_request_id
          and mode.confirmed_at=v_previous.bound_at
         join private.work_taxonomy_worker_capabilities capability
           on capability.worker_account_id=auth.uid() and capability.category_id=category.id
          and not capability.excluded and capability.origin='WORKER_CONFIRMED'
          and capability.confirmed_at=v_previous.bound_at and capability.updated_at<=v_previous.bound_at
         where admitted.value->>'service'=v_item->>'service'
           and admitted.value->>'mode'=v_item->>'mode'
           and v_item->>'mode' in ('ON_SITE','REMOTE')
           and exists(select 1 from jsonb_array_elements(s.candidate->'skills') skill(value)
             where skill.value=to_jsonb(v_item->>'service'))
           and category.state='ESTABLISHED'
           and (category.canonical_key=private.taxonomy_normalize_v1(v_item->>'service')
             or exists(select 1 from private.work_taxonomy_aliases alias
               where alias.category_id=category.id
                 and alias.normalized_key=private.taxonomy_normalize_v1(v_item->>'service')));
         if v_count<>1 then v_modes:='[]'::jsonb;v_retained:='[]'::jsonb;exit; end if;
         v_modes:=v_modes||jsonb_build_array(jsonb_build_object('service',v_item->>'service','mode',v_item->>'mode'));
         v_retained:=v_retained||jsonb_build_array(jsonb_build_object(
           'service',v_item->>'service','mode',v_item->>'mode','categoryId',v_category));
       end loop;
     end if;
   end if;
 end if;
 -- The independent helper requires ALL displayed services, exact established
 -- category+scope and current catalog. Unknown work stays pending.
 v_projection:=private.taxonomy_review_candidate_projection_v2(
   'WORKER_CAPABILITY',s.candidate->'skills',v_modes,auth.uid(),p_conversation_id);
 -- Exact projection must resolve to the same retained category in today's
 -- catalog. An alias that moved or became ambiguous cannot grant a new skill.
 if v_retained<>'[]'::jsonb and v_projection->>'status'='READY'
   and exists(select 1 from jsonb_array_elements(v_projection->'classificationCandidates') projected(value)
     where not exists(select 1 from jsonb_array_elements(v_retained) retained(value)
       where retained.value->>'service'=projected.value->>'service'
         and retained.value->>'mode'=projected.value->>'mode'
         and retained.value->>'categoryId'=projected.value->>'categoryId'))
 then
   v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',s.candidate->'skills','[]'::jsonb);
 end if;
 v_projection:=private.taxonomy_preserve_review_handoff_v1(v_projection,auth.uid(),p_conversation_id);
 doc:=doc||jsonb_build_object('classificationState',v_projection->>'status',
   'classificationCandidates',v_projection->'classificationCandidates',
   'reviewedServiceModes',v_projection->'reviewedServiceModes',
   'classificationCatalogVersion',v_projection->'classificationCatalogVersion',
   'classificationCatalogFingerprint',v_projection->'classificationCatalogFingerprint');
 -- Sign BEFORE storing or returning the owner-visible review.
 doc:=doc||jsonb_build_object('displayedContentDigest',encode(extensions.digest((doc||jsonb_build_object('baseHash',s.base_hash))::text,'sha256'),'hex'));
 insert into private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,expires_at)
 values(r.id,auth.uid(),p_conversation_id,s.revision,s.base_hash,doc,expires);
 return doc;
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_prepare_worker_ai_review_taxonomy_confirmed(p_conversation_id uuid, p_expected_revision integer, p_activate boolean, p_selected_modes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; doc jsonb; missing jsonb:='[]'; expires timestamptz;
 v_modes jsonb;v_projection jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(auth.uid());
 select * into s from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=auth.uid() for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 perform 1 from public.ai_conversations where id=p_conversation_id and status='OPEN' for update;
 if not found or s.safety in ('BLOCK','REVIEW') then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 perform 1 from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
 if s.revision is distinct from p_expected_revision or s.base_hash<>private.worker_ai_source_hash(auth.uid()) then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 if p_activate is null or exists(select 1 from private.worker_ai_turns where conversation_id=p_conversation_id and state='PROCESSING') then raise exception 'WORKER_AI_TURN_PENDING' using errcode='55000'; end if;
 if p_activate then
  if length(s.candidate->>'displayName')<2 then missing:=missing||'"Ime"'::jsonb; end if;
  if length(s.candidate#>>'{location,city}')<2 then missing:=missing||'"Mesto rada"'::jsonb; end if;
  if jsonb_array_length(s.candidate->'skills')<1 then missing:=missing||'"Veštine"'::jsonb; end if;
 end if;
 if (s.candidate->'location')<> (private.worker_ai_initial(auth.uid())->'location')
  and (s.candidate#>'{location,operatingCountryCode}'='null'::jsonb or length(s.candidate#>>'{location,city}')<1)
 then missing:=missing||'"Država i mesto rada"'::jsonb; end if;
 perform private.normalize_worker_ai_availability(s.profile_id,s.account_id,s.candidate->'availability');
 select * into r from private.worker_ai_reviews where conversation_id=p_conversation_id and revision=s.revision
  and base_hash=s.base_hash and envelope->'activate'=to_jsonb(p_activate) and expires_at>clock_timestamp()
  and envelope->>'classificationState'='READY'
  and envelope->'reviewedServiceModes'=p_selected_modes
  and envelope->>'classificationCatalogFingerprint'=private.taxonomy_admission_fingerprint_v1()
  order by created_at desc limit 1;
 if found then return r.envelope; end if;
 r.id:=extensions.gen_random_uuid(); expires:=clock_timestamp()+interval '15 minutes';
 doc:=jsonb_build_object('schemaVersion','WORKER_PROFILE_V1','reviewId',r.id,'conversationId',p_conversation_id,'accountId',auth.uid(),
  'profileId',s.profile_id,'revision',s.revision,'profile',s.candidate,'activate',p_activate,'missingRequired',missing,
  'canAccept',jsonb_array_length(missing)=0,'expiresAt',expires);
 -- Reject missing or unbounded selections. Never infer a mode from skills,
 -- location, model hints or the global worker execution-mode default.
 IF jsonb_typeof(p_selected_modes) IS DISTINCT FROM 'array'
 OR jsonb_array_length(p_selected_modes) NOT BETWEEN 1 AND 24
 OR pg_column_size(p_selected_modes)>8000
 THEN RAISE EXCEPTION 'WORKER_EXPLICIT_MODES_INVALID' USING errcode='22023'; END IF;
 v_modes:=p_selected_modes;
 -- Exact/alias reuse or a validated new child. The signed review contains the
 -- proposed parent and full path, which the owner sees before saving.
 v_projection:=private.taxonomy_review_candidate_projection_v2(
   'WORKER_CAPABILITY',s.candidate->'skills',v_modes,auth.uid(),p_conversation_id);
 v_projection:=private.taxonomy_preserve_review_handoff_v1(v_projection,auth.uid(),p_conversation_id);
 doc:=doc||jsonb_build_object('classificationState',v_projection->>'status',
   'classificationCandidates',v_projection->'classificationCandidates',
   'reviewedServiceModes',v_projection->'reviewedServiceModes',
   'classificationCatalogVersion',v_projection->'classificationCatalogVersion',
   'classificationCatalogFingerprint',v_projection->'classificationCatalogFingerprint');
 -- Sign BEFORE storing or returning the owner-visible review.
 doc:=doc||jsonb_build_object('displayedContentDigest',encode(extensions.digest((doc||jsonb_build_object('baseHash',s.base_hash))::text,'sha256'),'hex'));
 insert into private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,expires_at)
 values(r.id,auth.uid(),p_conversation_id,s.revision,s.base_hash,doc,expires);
 return doc;
end $function$;

CREATE OR REPLACE FUNCTION private.worker_need_fit_v1(nid uuid, pid uuid, p_first_refusal boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
-- MATCH-V1: Dynamic Taxonomy Enhanced Matcher (Guarded against legacy regex pollution)
declare
  n public.needs; p public.app_profiles; pref public.worker_match_preferences;
  hard text[]:='{}'; svc boolean := false; area boolean; dist numeric; radius numeric; tier integer;
  effective_skills text[]; required_skill text;
  v_tax_tier text;
begin
  select * into n from public.needs where id=nid;
  if not found then
    return jsonb_build_object('matches',false,'service',false,'area',false,'timeTier',null,
      'distanceKm',null,'effectiveRadiusKm',null,'hard',jsonb_build_array('NEED_NOT_FOUND'));
  end if;
  select * into p from public.app_profiles where id=pid and kind='WORKER';
  if not found then
    return jsonb_build_object('matches',false,'service',false,'area',false,'timeTier',null,
      'distanceKm',null,'effectiveRadiusKm',null,'hard',jsonb_build_array('WORKER_PROFILE_NOT_FOUND'));
  end if;
  if p.profile_status<>'ACTIVE' then hard:=array_append(hard,'ACCOUNT_OR_PROFILE_RESTRICTED'); end if;
  if n.requester_account_id=p.account_id then hard:=array_append(hard,'OWN_NEED'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;

  -- DEV Gate C: only the real owner-signed current need revision and the
  -- worker's precise CONFIRMED service+execution mode may be dispatched or
  -- shown in "Za mene". This is the single shared matcher boundary.
  -- Legacy matching remains unchanged while control.enabled=false.
  IF EXISTS(SELECT 1 FROM private.taxonomy_match_scope_control_v1 ctl
      WHERE ctl.singleton AND ctl.enabled) THEN
    IF NOT private.taxonomy_scope_eligible_v1(n.id,p.account_id) THEN
      RETURN jsonb_build_object('matches',false,'service',false,'area',false,
        'timeTier',null,'distanceKm',null,'effectiveRadiusKm',null,
        'hard',jsonb_build_array('SIGNED_SERVICE_SCOPE_REQUIRED'),
        'taxonomyScope','UNCONFIRMED');
    END IF;
  END IF;

  -- 1. Area filter (radijus / mesto)
  radius:=private.effective_radius_km(p.radius_km);
  if n.execution_location_mode='REMOTE' then
    dist:=null; area:=private.taxonomy_handoff_fit_v1(n.id,p.account_id);
  else
    select * into pref from public.worker_match_preferences where worker_profile_id=pid;
    dist:=private.haversine_km(n.approximate_lat,n.approximate_lng,pref.approximate_lat,pref.approximate_lng);
    area:=coalesce(case when dist is not null then dist<=radius
      else n.task_country_code is not null
        and n.task_country_code=p.operating_country_code
        and btrim(coalesce(n.approximate_city,''))<>'' and lower(coalesce(n.approximate_city,''))=lower(coalesce(p.city,'')) end,false);
  end if;
  if p_first_refusal and not area then return jsonb_build_object('matches',false,'area',false); end if;

  -- 2. Service competency matching
  -- A. First: Check Dynamic Taxonomy Inheritance if task has category_id
  if n.category_id is not null then
    begin
      v_tax_tier := private.taxonomy_requirement_tier_inherited_v1(n.category_id, p.account_id);
      if v_tax_tier in ('EXACT', 'EQUIVALENT', 'RELATED_CONFIRMED', 'INHERITED_STANDARD') then
        svc := true;
      end if;
    exception when others then
      svc := false;
    end;
  end if;

  -- B. Fallback: Only run legacy skill match if task is NOT in taxonomy (category_id is null)
  if not svc and n.category_id is null then
    effective_skills := array_remove(array[n.category]::text[],null);
    svc:=coalesce(private.lower_arr(p.skills) && private.lower_arr(effective_skills),false);
  end if;

  if not private.accounts_same_world(n.requester_account_id,p.account_id) then hard:=array_append(hard,'OTHER_WORLD'); end if;
  if n.verified_identity_required and not private.identity_admitted(p.account_id)
    then hard:=array_append(hard,'IDENTITY_VERIFICATION_NOT_ADMITTED'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;

  -- C. Legacy aliases fallback only if task is NOT in taxonomy (category_id is null)
  if not svc and n.category_id is null then
    svc:=exists(
      select 1
      from unnest(private.work_kinds_v5(p.skills)) AS worker_kind(kind)
      join unnest(private.work_kinds_v5(effective_skills)) AS need_kind(kind)
        on worker_kind.kind=need_kind.kind
      where worker_kind.kind <> 'SITNE_POPRAVKE'
    );
  end if;

  -- Extra explicitly required skills (if any)
  if svc and coalesce(cardinality(n.required_skills),0)>0 then
    foreach required_skill in array n.required_skills loop
      if not (
        coalesce(private.lower_arr(p.skills) && private.lower_arr(array[required_skill]),false)
        or coalesce(private.work_kinds_v5(p.skills) && private.work_kinds_v5(array[required_skill]),false)
      ) then
        svc:=false;
        exit;
      end if;
    end loop;
  end if;

  if p_first_refusal and not svc then return jsonb_build_object('matches',false,'service',false); end if;

  -- 3. Exclusions filter
  if coalesce(cardinality(p.exclusions),0)>0
     and (private.lower_arr(p.exclusions) && private.lower_arr(array_prepend(n.category,n.required_skills))
          or private.work_kinds_v5(p.exclusions) && private.work_kinds_v5(array_prepend(n.category,n.required_skills)))
    then hard:=array_append(hard,'PROFILE_EXCLUSION'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;

  -- 4. Time filter
  tier:=private.worker_need_time_tier_v1(nid,pid);
  return jsonb_build_object('matches',cardinality(hard)=0 and svc and area and tier is not null,
    'service',svc,'area',area,'timeTier',tier,'distanceKm',dist,'effectiveRadiusKm',radius,'hard',to_jsonb(hard),
    'taxonomyTier',v_tax_tier);
end;
$function$;

CREATE OR REPLACE FUNCTION private.need_publication_fingerprint_snapshot(p_need_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_need public.needs%rowtype;
  v_topology jsonb;
  v_handoff jsonb;
  v_conditions text[] := '{}'::text[];
  v_public_geography jsonb;
  v_private_payload jsonb;
  v_private_marker text;
  v_payload jsonb;
  v_fingerprint text;
  v_media text[];
begin
  select * into v_need
    from public.needs
   where id = p_need_id;

  if not found then
    raise exception 'NEED_NOT_FOUND' using errcode='P0002';
  end if;

  select g.public_topology
    into v_topology
    from public.need_geography g
   where g.need_id = p_need_id;

  select coalesce(r.critical_conditions, '{}'::text[])
    into v_conditions
    from public.need_requirement_details r
   where r.need_id = p_need_id;
  v_conditions := coalesce(v_conditions, '{}'::text[]);
  select r.handoff into v_handoff from public.need_requirement_details r where r.need_id=p_need_id;

  select case
           when s.need_id is null then jsonb_build_object('present', false)
           else jsonb_build_object(
             'present', true,
             'exactAddress', s.exact_address,
             'accessNotes', s.access_notes,
             'exactLat', s.exact_lat,
             'exactLng', s.exact_lng
           ) || case when s.resolved_location is null then '{}'::jsonb
             else jsonb_build_object('resolvedLocation',s.resolved_location) end
         end
    into v_private_payload
    from (select p_need_id as need_id) q
    left join public.need_sensitive s on s.need_id = q.need_id;

  v_private_marker := encode(
    extensions.digest(convert_to(v_private_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  v_public_geography := jsonb_build_object(
    'executionLocationMode', v_need.execution_location_mode,
    'approximateCity', v_need.approximate_city,
    'approximateArea', v_need.approximate_area,
    'approximateLat', v_need.approximate_lat,
    'approximateLng', v_need.approximate_lng,
    'topology', coalesce(v_topology, 'null'::jsonb)
  );

  v_media := coalesce(v_need.public_photo_paths, '{}'::text[]);

  v_payload := jsonb_build_object(
    'schemaVersion', 'NEED_PUBLICATION_FINGERPRINT_V1',
    'needId', v_need.id,
    'revision', v_need.revision,
    'title', v_need.title,
    'description', v_need.description,
    'category', v_need.category,
    'scheduleKind', v_need.schedule_kind,
    'startsAt', v_need.starts_at,
    'endsAt', v_need.ends_at,
    'requiredSlots', v_need.required_slots,
    'priceMode', v_need.mode,
    'requesterPriceRsd', v_need.requester_price_rsd,
    'requiredSkills', to_jsonb(v_need.required_skills),
    'requiredTools', to_jsonb(v_need.required_tools),
    'requiredVehicles', to_jsonb(v_need.required_vehicles),
    'requiredLicenses', to_jsonb(v_need.required_licenses),
    'minimumExperienceYears', v_need.minimum_experience_years,
    'verifiedIdentityRequired', v_need.verified_identity_required,
    'criticalConditions', to_jsonb(v_conditions),
    'publicGeography', v_public_geography,
    'publicMediaRefs', to_jsonb(v_media),
    'privateMaterialityMarker', v_private_marker
  );

  -- Preserve legacy fingerprints; new typed constraints are material facts.
  if v_handoff is not null then v_payload:=v_payload||jsonb_build_object('handoff',v_handoff); end if;

  v_fingerprint := encode(
    extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  return jsonb_build_object(
    'schemaVersion', 'NEED_PUBLICATION_FINGERPRINT_V1',
    'needId', v_need.id,
    'needRevision', v_need.revision,
    'canonicalFingerprint', v_fingerprint,
    'privateMaterialityMarker', v_private_marker,
    'publicGeography', v_public_geography,
    'publicMediaRefs', to_jsonb(v_media)
  );
end;
$function$;
COMMIT;
