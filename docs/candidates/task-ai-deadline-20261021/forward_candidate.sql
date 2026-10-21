-- SOURCE-ONLY CANDIDATE. Do not apply until predecessor hashes, ACL and DEV
-- transaction proof in README.md have been checked. Existing prepare/accept/publish
-- functions stay intact; new clients opt in to these separate prepare RPCs.
begin;
do $gate$
begin
 if to_regprocedure('private.validate_need_v2_fact(text,jsonb)') is null
  or to_regprocedure('public.rpc_ai_open_need_edit_conversation_v2(uuid)') is null
  or to_regprocedure('public.rpc_prepare_ai_task_review(uuid,timestamptz,jsonb)') is null
  or to_regprocedure('public.rpc_prepare_ai_task_review_taxonomy(uuid,timestamptz,jsonb)') is null
 then raise exception 'APPLICATION_DEADLINE_PREDECESSOR_MISSING'; end if;
 if exists(select 1 from private.need_fact_registry where fact_key='need.response_deadline')
 then raise exception 'APPLICATION_DEADLINE_ALREADY_REGISTERED'; end if;
end $gate$;

insert into private.need_fact_registry
 (fact_key,schema_version,value_type,required_for_draft,privacy_class,material,target_owner)
values ('need.response_deadline','NEED_FACT_V2','OBJECT',false,'PUBLIC',true,'needs.response_deadline');

CREATE OR REPLACE FUNCTION private.validate_need_v2_fact(p_key text, p_value jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
begin
  if p_key='need.response_deadline' then
    if p_value is null or jsonb_typeof(p_value) is distinct from 'object' then
      raise exception 'RESPONSE_DEADLINE_FACT_INVALID' using errcode='22023';
    end if;
    if p_value='{"kind":"NONE"}'::jsonb then return; end if;
    if p_value->>'kind'<>'AT' or not (p_value ?& array['kind','at'])
      or p_value-array['kind','at']<>'{}'::jsonb
      or jsonb_typeof(p_value->'at')<>'string'
      or (p_value->>'at') !~ '^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-](0[0-9]|1[0-4]):[0-5][0-9])$'
      or (right(p_value->>'at',6) ~ '^[+-]14:' and right(p_value->>'at',2)<>'00')
    then raise exception 'RESPONSE_DEADLINE_FACT_INVALID' using errcode='22023'; end if;
    begin perform (p_value->>'at')::timestamptz;
    exception when others then raise exception 'RESPONSE_DEADLINE_FACT_INVALID' using errcode='22023'; end;
    return;
  end if;
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
      when 'need.response_deadline' then
        if v_need.response_deadline is not null then
          v_value:=jsonb_build_object('kind','AT','at',to_jsonb(v_need.response_deadline)#>>'{}');
          v_display:='Prijave do '||(to_jsonb(v_need.response_deadline)#>>'{}');
        end if;
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

create function public.rpc_prepare_ai_task_review_deadline(p_conversation_id uuid,p_location jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid(); c public.ai_conversations; n public.needs; profile_id uuid; source jsonb; source_fingerprint text;
 p_response_deadline timestamptz; deadline_fact jsonb; old_location jsonb; location jsonb; review jsonb; facts jsonb:='[]'; item jsonb; k text; val jsonb;
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
  if c.need_edit_base_fingerprint is distinct from private.need_edit_base_marker(n.id) then raise exception 'TASK_REVIEW_STALE' using errcode='40001'; end if;
 end if;
 select id into profile_id from public.app_profiles where account_id=u and kind='REQUESTER' and profile_status='ACTIVE' for share;
 if profile_id is null then raise exception 'REQUESTER_PROFILE_NOT_READY' using errcode='42501'; end if;
 source:=private.ai_task_review_source(c.id);
 source_fingerprint:=encode(extensions.digest(source::text,'sha256'),'hex');
 review:=public.rpc_ai_need_review_v2(c.id);
 select x into deadline_fact from jsonb_array_elements(review->'facts') x
  where x->>'key'='need.response_deadline' and x->>'status'<>'UNKNOWN' limit 1;
 if deadline_fact is not null then
  perform private.validate_need_v2_fact('need.response_deadline',deadline_fact->'value');
  if deadline_fact#>>'{value,kind}'='AT' then
   p_response_deadline:=(deadline_fact#>>'{value,at}')::timestamptz;
  end if;
 end if;
 if p_response_deadline is not null and p_response_deadline<=clock_timestamp()
 then raise exception 'RESPONSE_DEADLINE_INVALID' using errcode='22023'; end if;
 if jsonb_array_length(review->'facts')>22 then raise exception 'TASK_REVIEW_INPUT_INVALID' using errcode='22023'; end if;
 old_location:=private.need_location_review_document(c.id);
 if p_location is not null and p_location<>'null'::jsonb then
  if jsonb_typeof(p_location)<>'object' or p_location-array['expectedRevision','value']<>'{}'::jsonb
   or not(p_location ?& array['expectedRevision','value']) or p_location->>'expectedRevision' is distinct from old_location->>'revision'
  then raise exception 'LOCATION_VERSION_CONFLICT' using errcode='40001'; end if;
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
   and not exists(select 1 from private.ai_need_turn_commands where conversation_id=c.id and state='PROCESSING'));
 envelope:=envelope||jsonb_build_object('displayedContentDigest',encode(extensions.digest(jsonb_build_object('envelope',envelope,'policy',policy)::text,'sha256'),'hex'));
 insert into private.ai_task_reviews(id,account_id,conversation_id,requester_profile_id,source_hash,policy_binding,envelope,expires_at)
 values(rid,u,c.id,profile_id,source_fingerprint,policy,envelope,expires);
 return envelope;
end $f$;

CREATE OR REPLACE FUNCTION public.rpc_prepare_ai_task_review_deadline_taxonomy(p_conversation_id uuid, p_location jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare u uuid:=auth.uid(); c public.ai_conversations; n public.needs; profile_id uuid; source jsonb; source_fingerprint text;
 p_response_deadline timestamptz; deadline_fact jsonb; old_location jsonb; location jsonb; review jsonb; facts jsonb:='[]'; item jsonb; k text; val jsonb;
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
 source:=private.ai_task_review_source(c.id);
 source_fingerprint:=encode(extensions.digest(source::text,'sha256'),'hex');
 review:=public.rpc_ai_need_review_v2(c.id);
 select x into deadline_fact from jsonb_array_elements(review->'facts') x
  where x->>'key'='need.response_deadline' and x->>'status'<>'UNKNOWN' limit 1;
 if deadline_fact is not null then
  perform private.validate_need_v2_fact('need.response_deadline',deadline_fact->'value');
  if deadline_fact#>>'{value,kind}'='AT' then
   p_response_deadline:=(deadline_fact#>>'{value,at}')::timestamptz;
  end if;
 end if;
 if p_response_deadline is not null and p_response_deadline<=clock_timestamp()
 then raise exception 'RESPONSE_DEADLINE_INVALID' using errcode='22023'; end if;
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
revoke all on function public.rpc_prepare_ai_task_review_deadline(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.rpc_prepare_ai_task_review_deadline(uuid,jsonb) to authenticated;
revoke all on function public.rpc_prepare_ai_task_review_deadline_taxonomy(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.rpc_prepare_ai_task_review_deadline_taxonomy(uuid,jsonb) to authenticated;

do $proof$
begin
 if (select count(*) from private.need_fact_registry where fact_key='need.response_deadline'
   and schema_version='NEED_FACT_V2' and value_type='OBJECT' and privacy_class='PUBLIC')<>1
 then raise exception 'APPLICATION_DEADLINE_REGISTRY_PROOF_FAILED'; end if;
 if has_function_privilege('anon','public.rpc_prepare_ai_task_review_deadline(uuid,jsonb)','EXECUTE')
   or has_function_privilege('anon','public.rpc_prepare_ai_task_review_deadline_taxonomy(uuid,jsonb)','EXECUTE')
   or not has_function_privilege('authenticated','public.rpc_prepare_ai_task_review_deadline(uuid,jsonb)','EXECUTE')
   or not has_function_privilege('authenticated','public.rpc_prepare_ai_task_review_deadline_taxonomy(uuid,jsonb)','EXECUTE')
 then raise exception 'APPLICATION_DEADLINE_ACL_PROOF_FAILED'; end if;
end $proof$;
commit;
