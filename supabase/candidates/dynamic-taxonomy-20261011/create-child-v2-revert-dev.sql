-- DEV-only rollback candidate captured read-only from live DEV on 2026-10-17 UTC.

-- Restore the two pre-v2 signed review functions, then remove the private v2 helper.

-- Source-only. Requires separate owner 'primeni' to execute.

BEGIN;

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
 -- The independent helper requires ALL displayed services, exact established
 -- category+scope and current catalog. Unknown work stays pending.
 v_projection:=private.taxonomy_review_exact_projection_v1(
   'WORKER_CAPABILITY',s.candidate->'skills',v_modes);
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

CREATE OR REPLACE FUNCTION public.rpc_prepare_ai_task_review_taxonomy(p_conversation_id uuid, p_response_deadline timestamp with time zone DEFAULT NULL::timestamp with time zone, p_location jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare u uuid:=auth.uid(); c public.ai_conversations; n public.needs; profile_id uuid; source jsonb; source_fingerprint text;
 old_location jsonb; location jsonb; review jsonb; facts jsonb:='[]'; item jsonb; k text; val jsonb;
 missing jsonb; policy jsonb; envelope jsonb; v_service text; v_mode text; v_scope text; v_projection jsonb; rid uuid:=extensions.gen_random_uuid(); expires timestamptz:=clock_timestamp()+interval '15 minutes';
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
 -- This is independent of Gemini hints: only stored canonical/alias IDs qualify.
 select f->>'value' into v_service from jsonb_array_elements(facts) f
   where f->>'key'='need.category' and f->>'status'<>'UNKNOWN'
   order by f->>'id' limit 1;
 v_scope:=location#>>'{geography,mode}';
 v_mode:=case when v_scope='REMOTE' then 'REMOTE'
   when v_scope in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED') then 'ON_SITE'
   else null end;
 if v_service is not null and v_mode is not null then
   v_projection:=private.taxonomy_review_exact_projection_v1(
     'NEED_SERVICE',jsonb_build_array(v_service),
     jsonb_build_array(jsonb_build_object('service',v_service,'mode',v_mode)));
 else
   v_projection:=jsonb_build_object('status','PENDING_CLASSIFICATION',
     'classificationCandidates','[]'::jsonb,'reviewedServiceModes','[]'::jsonb,
     'classificationCatalogVersion',null,'classificationCatalogFingerprint',null);
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

DROP FUNCTION IF EXISTS private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid);

COMMIT;
