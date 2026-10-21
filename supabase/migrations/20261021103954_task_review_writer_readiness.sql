begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- TRV01: make readiness match existing signed draft writer requirements.
do $gate$ begin
if md5(pg_get_functiondef('public.rpc_prepare_ai_task_review(uuid,timestamptz,jsonb)'::regprocedure))<>'21285792f75e11eb5ad59a54230fb567' then raise exception 'TRV01_PREIMAGE_CHANGED:rpc_prepare_ai_task_review'; end if;
if md5(pg_get_functiondef('public.rpc_prepare_ai_task_review_taxonomy(uuid,timestamptz,jsonb)'::regprocedure))<>'f0e1f9c6c3c81bfabde87ad911512b76' then raise exception 'TRV01_PREIMAGE_CHANGED:rpc_prepare_ai_task_review_taxonomy'; end if;
end $gate$;
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
 -- Cross-field requirements already enforced by the draft writer, now visible before acceptance.
 if exists(select 1 from jsonb_array_elements(facts) f where f->>'key'='need.price_mode' and f->>'status'<>'UNKNOWN' and f->>'value'='MY_PRICE')
 and not exists(select 1 from jsonb_array_elements(facts) f where f->>'key'='need.price_rsd' and f->>'status'<>'UNKNOWN' and jsonb_typeof(f->'value')='number' and (f->>'value')::numeric>0)
 then missing:=missing||jsonb_build_array('need.price_rsd');end if;
 if exists(select 1 from jsonb_array_elements(facts) f where f->>'key'='need.schedule_kind' and f->>'status'<>'UNKNOWN' and f->>'value'='FIXED_WINDOW') then
  if not exists(select 1 from jsonb_array_elements(facts) f where f->>'key'='need.starts_at' and f->>'status'<>'UNKNOWN' and isfinite((f->>'value')::timestamptz))
  then missing:=missing||jsonb_build_array('need.starts_at');
  elsif exists(select 1 from jsonb_array_elements(facts) e where e->>'key'='need.ends_at' and e->>'status'<>'UNKNOWN'
   and (not isfinite((e->>'value')::timestamptz) or (e->>'value')::timestamptz <=
    (select (s->>'value')::timestamptz from jsonb_array_elements(facts) s where s->>'key'='need.starts_at' and s->>'status'<>'UNKNOWN' limit 1)))
  then missing:=missing||jsonb_build_array('need.ends_at');end if;
 end if;
 if location#>>'{geography,mode}'='REMOTE' and not exists(select 1 from jsonb_array_elements(facts) f
  where f->>'key'='need.handoff' and f->>'status'<>'UNKNOWN' and private.taxonomy_handoff_valid_v1(f->'value'))
 then missing:=missing||jsonb_build_array('need.handoff');end if;
 select coalesce(jsonb_agg(x order by x),'[]'::jsonb) into missing from (select distinct value x from jsonb_array_elements(missing)) keys;
 policy:=private.ai_task_review_policy(location->>'taskCountryCode');
 -- Identical refreshes reuse the same immutable review without extending expiry.
 select r.envelope into envelope from private.ai_task_reviews r where r.account_id=u and r.conversation_id=c.id
  and r.source_hash=source_fingerprint and r.policy_binding=policy and r.expires_at>clock_timestamp()
  and r.envelope->'missingRequired'=missing
  and (jsonb_array_length(missing)=0 or r.envelope->'canAccept'='false'::jsonb)
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
 -- Cross-field requirements already enforced by the draft writer, now visible before acceptance.
 if exists(select 1 from jsonb_array_elements(facts) f where f->>'key'='need.price_mode' and f->>'status'<>'UNKNOWN' and f->>'value'='MY_PRICE')
 and not exists(select 1 from jsonb_array_elements(facts) f where f->>'key'='need.price_rsd' and f->>'status'<>'UNKNOWN' and jsonb_typeof(f->'value')='number' and (f->>'value')::numeric>0)
 then missing:=missing||jsonb_build_array('need.price_rsd');end if;
 if exists(select 1 from jsonb_array_elements(facts) f where f->>'key'='need.schedule_kind' and f->>'status'<>'UNKNOWN' and f->>'value'='FIXED_WINDOW') then
  if not exists(select 1 from jsonb_array_elements(facts) f where f->>'key'='need.starts_at' and f->>'status'<>'UNKNOWN' and isfinite((f->>'value')::timestamptz))
  then missing:=missing||jsonb_build_array('need.starts_at');
  elsif exists(select 1 from jsonb_array_elements(facts) e where e->>'key'='need.ends_at' and e->>'status'<>'UNKNOWN'
   and (not isfinite((e->>'value')::timestamptz) or (e->>'value')::timestamptz <=
    (select (s->>'value')::timestamptz from jsonb_array_elements(facts) s where s->>'key'='need.starts_at' and s->>'status'<>'UNKNOWN' limit 1)))
  then missing:=missing||jsonb_build_array('need.ends_at');end if;
 end if;
 if location#>>'{geography,mode}'='REMOTE' and not exists(select 1 from jsonb_array_elements(facts) f
  where f->>'key'='need.handoff' and f->>'status'<>'UNKNOWN' and private.taxonomy_handoff_valid_v1(f->'value'))
 then missing:=missing||jsonb_build_array('need.handoff');end if;
 select coalesce(jsonb_agg(x order by x),'[]'::jsonb) into missing from (select distinct value x from jsonb_array_elements(missing)) keys;
 policy:=private.ai_task_review_policy(location->>'taskCountryCode');
 -- Identical refreshes reuse the same immutable review without extending expiry.
 select r.envelope into envelope from private.ai_task_reviews r where r.account_id=u and r.conversation_id=c.id
  and r.source_hash=source_fingerprint and r.policy_binding=policy and r.expires_at>clock_timestamp()
  and r.envelope->'missingRequired'=missing
  and (jsonb_array_length(missing)=0 or r.envelope->'canAccept'='false'::jsonb)
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
   envelope:=envelope||jsonb_build_object('canAccept',false,'missingRequired',missing);
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
do $proof$
declare u uuid:=extensions.gen_random_uuid();pid uuid;n uuid;c uuid;r jsonb;rr jsonb;
 auth_role text:=current_user;fn text;fid uuid;
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

 c:=(public.rpc_ai_open_need_edit_conversation_v2(n)->>'conversationId')::uuid;
 foreach fn in array array['rpc_prepare_ai_task_review','rpc_prepare_ai_task_review_taxonomy'] loop
  begin
   -- Synthetic missing handoff, preserving the actual read/prepare path.
   update public.ai_structured_facts set superseded_at=clock_timestamp()
    where conversation_id=c and fact_key='need.handoff' and superseded_at is null;
   execute 'set local role authenticated';
   execute format('select public.%I($1,null,null)',fn) into r using c;
   if r->'canAccept' is distinct from 'false'::jsonb or not(r->'missingRequired' @> '["need.handoff"]')
    then raise exception 'TRV01_HANDOFF:%',fn;end if;
   execute format('set local role %I',auth_role);
   if not exists(select 1 from private.ai_task_reviews v where v.id=(r->>'reviewId')::uuid
    and r->>'displayedContentDigest'=encode(extensions.digest(jsonb_build_object('envelope',r-'displayedContentDigest','policy',v.policy_binding)::text,'sha256'),'hex'))
    then raise exception 'TRV01_UNSIGNED:%',fn;end if;
   raise sqlstate 'ZV001';
  exception when sqlstate 'ZV001' then null;end;
  begin
   select id into fid from public.ai_structured_facts where conversation_id=c and fact_key='need.price_mode' and superseded_at is null;
   perform public.rpc_ai_correct_fact_v2(fid,'"MY_PRICE"','Fiksna cena');
   execute 'set local role authenticated';
   execute format('select public.%I($1,null,null)',fn) into r using c;
   if r->'canAccept' is distinct from 'false'::jsonb or not(r->'missingRequired' @> '["need.price_rsd"]')
    then raise exception 'TRV01_PRICE:%',fn;end if;
   execute format('set local role %I',auth_role);
   raise sqlstate 'ZV001';
  exception when sqlstate 'ZV001' then null;end;
  begin
   select id into fid from public.ai_structured_facts where conversation_id=c and fact_key='need.schedule_kind' and superseded_at is null;
   perform public.rpc_ai_correct_fact_v2(fid,'"FIXED_WINDOW"','Tačan termin');
   execute 'set local role authenticated';
   execute format('select public.%I($1,null,null)',fn) into r using c;
   if r->'canAccept' is distinct from 'false'::jsonb or not(r->'missingRequired' @> '["need.starts_at"]')
    then raise exception 'TRV01_START:%',fn;end if;
   execute format('set local role %I',auth_role);
   raise sqlstate 'ZV001';
  exception when sqlstate 'ZV001' then null;end;
 end loop;
 execute 'set local role authenticated';
 r:=public.rpc_prepare_ai_task_review(c,null,null);
 rr:=public.rpc_prepare_ai_task_review(c,null,null);
 if r->'canAccept' is distinct from 'true'::jsonb or r->'missingRequired'<>'[]'::jsonb or r is distinct from rr
 then raise exception 'TRV01_VALID_REPLAY';end if;
 execute format('set local role %I',auth_role);
 raise sqlstate 'ZV002';
 exception when sqlstate 'ZV002' then null;end;
 if exists(select 1 from auth.users where id=u) then raise exception 'TRV01_FIXTURE_LEAK';end if;
end $proof$;
commit;
