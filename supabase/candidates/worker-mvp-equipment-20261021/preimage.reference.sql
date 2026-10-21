-- Evidence only. Rolling back this policy requires coordinated UI rollback.
CREATE OR REPLACE FUNCTION private.worker_ai_patch(base jsonb, patch jsonb, pid uuid, aid uuid, manual boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare result jsonb:=base; k text; v jsonb; loc jsonb; av jsonb; op jsonb; old jsonb; item jsonb;
 rules jsonb; windows jsonb; wanted_days jsonb; remaining jsonb; next_id uuid;
begin
 if jsonb_typeof(patch) is distinct from 'object' or octet_length(patch::text)>262144
  or patch-array['displayName','bio','skills','tools','vehicles','licenses','teamCapacity','location','availability']<>'{}'::jsonb
 then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
 foreach k in array array['displayName','bio'] loop
  if not patch?k then continue; end if; v:=patch->k;
  if jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')>(case k when 'displayName' then 160 else 4000 end)
   or (case when k='bio' then regexp_replace(v#>>'{}',E'[\n\r\t]','','g') else v#>>'{}' end) ~ '[[:cntrl:]]' then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  result:=jsonb_set(result,array[k],to_jsonb(btrim(v#>>'{}')));
 end loop;
 foreach k in array array['skills','tools','vehicles','licenses'] loop
  if not patch?k then continue; end if; v:=patch->k;
  if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v)>50 then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) is distinct from 'string'
    or length(btrim(x#>>'{}')) not between 1 and 500 or (x#>>'{}') ~ '[[:cntrl:]]')
  then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  result:=jsonb_set(result,array[k],v);
 end loop;
 if patch?'teamCapacity' then
  if jsonb_typeof(patch->'teamCapacity') is distinct from 'number' or (patch->>'teamCapacity') !~ '^([1-9]|[1-4][0-9]|50)$'
  then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  result:=jsonb_set(result,'{teamCapacity}',patch->'teamCapacity');
 end if;
 if patch?'location' then
  v:=patch->'location';
  if jsonb_typeof(v) is distinct from 'object' or v-array['operatingCountryCode','city','radiusKm','approximatePosition']<>'{}'::jsonb
   or (not manual and v?'approximatePosition') then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  loc:=base->'location'||v;
  if jsonb_typeof(loc->'city') is distinct from 'string' or length(btrim(loc->>'city'))>160
   or (loc->>'city') ~ '[[:cntrl:]]' or jsonb_typeof(loc->'radiusKm') is distinct from 'number'
   or (loc->>'radiusKm') !~ '^([1-9]|[1-9][0-9]|1[0-9][0-9]|200)$' then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  if loc->'operatingCountryCode'<>'null'::jsonb then perform private.require_location_country(loc->'operatingCountryCode'); end if;
  -- A changed textual origin invalidates the old coarse point. No AI geocoding.
  if (v?'city' and v->'city' is distinct from base#>'{location,city}') or
     (v?'operatingCountryCode' and v->'operatingCountryCode' is distinct from base#>'{location,operatingCountryCode}') then
   if not(manual and v?'approximatePosition') then loc:=jsonb_set(loc,'{approximatePosition}','null'); end if;
  end if;
  if loc->'approximatePosition'<>'null'::jsonb then
   item:=loc->'approximatePosition';
   if jsonb_typeof(item) is distinct from 'object' or item-array['latitude','longitude']<>'{}'::jsonb
    or jsonb_typeof(item->'latitude') is distinct from 'number' or jsonb_typeof(item->'longitude') is distinct from 'number'
   then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
   if (item->>'latitude')::numeric not between -90 and 90 or (item->>'longitude')::numeric not between -180 and 180
    or (item->>'latitude')::numeric<>round((item->>'latitude')::numeric,2)
    or (item->>'longitude')::numeric<>round((item->>'longitude')::numeric,2) then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  end if;
  result:=jsonb_set(result,'{location}',loc);
 end if;
 if patch?'availability' then
  v:=patch->'availability'; av:=base->'availability'; rules:=av->'rules'; windows:=av->'windows';
  if jsonb_typeof(v) is distinct from 'object' or v-array['timezone','availableNow','ruleChanges','windowsUpsert','windowIdsRemove']<>'{}'::jsonb
  then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  foreach k in array array['timezone','availableNow'] loop if v?k then av:=jsonb_set(av,array[k],v->k); end if; end loop;
  foreach k in array array['ruleChanges','windowsUpsert','windowIdsRemove'] loop
   if v?k and (jsonb_typeof(v->k) is distinct from 'array' or jsonb_array_length(v->k)>(case when k='ruleChanges' then 256 else 512 end))
   then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  end loop;
  for op in select value from jsonb_array_elements(coalesce(v->'ruleChanges','[]')) loop
   if jsonb_typeof(op) is distinct from 'object' or op-array['ruleId','weekdays','value']<>'{}'::jsonb
    or not(op?&array['ruleId','weekdays','value']) or jsonb_typeof(op->'weekdays') is distinct from 'array'
    or jsonb_array_length(op->'weekdays') not between 1 and 7
    or exists(select 1 from jsonb_array_elements(op->'weekdays') d where jsonb_typeof(d)<>'number' or d::text !~ '^[0-6]$')
   then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
   wanted_days:=op->'weekdays';
   if jsonb_array_length(wanted_days)<>(select count(distinct d) from jsonb_array_elements(wanted_days) d) then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
   if op->'ruleId'<>'null'::jsonb then
    select x into old from jsonb_array_elements(rules) x where x->'id'=op->'ruleId';
    if not found or not(old->'weekdays' @> wanted_days) then raise exception 'WORKER_AI_RULE_STALE' using errcode='PT409'; end if;
    select coalesce(jsonb_agg(d),'[]') into remaining from jsonb_array_elements(old->'weekdays') d where not(wanted_days @> jsonb_build_array(d));
    select coalesce(jsonb_agg(x),'[]') into rules from jsonb_array_elements(rules) x where x->'id'<>old->'id';
    if jsonb_array_length(remaining)>0 then rules:=rules||jsonb_build_array(jsonb_set(old,'{weekdays}',remaining)); end if;
   end if;
   if op->'value'<>'null'::jsonb then
    item:=op->'value';
    if jsonb_typeof(item) is distinct from 'object' or item-array['startTime','endTime','startsOn','endsOn','label','active']<>'{}'::jsonb
    then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
    next_id:=extensions.gen_random_uuid();
    rules:=rules||jsonb_build_array(item||jsonb_build_object('id',next_id,'weekdays',wanted_days));
   elsif op->'ruleId'='null'::jsonb then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(v->'windowIdsRemove','[]')) loop
   if not exists(select 1 from jsonb_array_elements(windows) x where x->'id'=item) then raise exception 'WORKER_AI_WINDOW_STALE' using errcode='PT409'; end if;
   select coalesce(jsonb_agg(x),'[]') into windows from jsonb_array_elements(windows) x where x->'id'<>item;
  end loop;
  for op in select value from jsonb_array_elements(coalesce(v->'windowsUpsert','[]')) loop
   if jsonb_typeof(op) is distinct from 'object' or not(op?'id') then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
   item:=op;
   if op->'id'='null'::jsonb then item:=jsonb_set(op,'{id}',to_jsonb(extensions.gen_random_uuid()));
   elsif not exists(select 1 from jsonb_array_elements(windows) x where x->'id'=op->'id') then raise exception 'WORKER_AI_WINDOW_STALE' using errcode='PT409';
   else select coalesce(jsonb_agg(x),'[]') into windows from jsonb_array_elements(windows) x where x->'id'<>op->'id'; end if;
   windows:=windows||jsonb_build_array(item);
  end loop;
  av:=av||jsonb_build_object('rules',rules,'windows',windows);
  av:=private.normalize_worker_ai_availability(pid,aid,av);
  result:=jsonb_set(result,'{availability}',av);
 end if;
 return result;
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_prepare_worker_ai_review(p_conversation_id uuid, p_expected_revision integer, p_activate boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; doc jsonb; missing jsonb:='[]'; expires timestamptz;
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
  and base_hash=s.base_hash and envelope->'activate'=to_jsonb(p_activate) and expires_at>clock_timestamp() order by created_at desc limit 1;
 if found then return r.envelope; end if;
 r.id:=extensions.gen_random_uuid(); expires:=clock_timestamp()+interval '15 minutes';
 doc:=jsonb_build_object('schemaVersion','WORKER_PROFILE_V1','reviewId',r.id,'conversationId',p_conversation_id,'accountId',auth.uid(),
  'profileId',s.profile_id,'revision',s.revision,'profile',s.candidate,'activate',p_activate,'missingRequired',missing,
  'canAccept',jsonb_array_length(missing)=0,'expiresAt',expires);
 doc:=doc||jsonb_build_object('displayedContentDigest',encode(extensions.digest((doc||jsonb_build_object('baseHash',s.base_hash))::text,'sha256'),'hex'));
 insert into private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,expires_at)
 values(r.id,auth.uid(),p_conversation_id,s.revision,s.base_hash,doc,expires);
 return doc;
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_save_worker_ai_review(p_review_id uuid, p_displayed_digest text, p_client_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; cmd private.worker_ai_saves; p public.app_profiles; value jsonb; receipt jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(auth.uid());
 if p_client_request_id is null then raise exception 'WORKER_AI_ID_REQUIRED' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('worker-ai-save:'||auth.uid()::text||p_client_request_id::text,0));
 select * into r from private.worker_ai_reviews where id=p_review_id and account_id=auth.uid();
 if not found or r.envelope->>'displayedContentDigest' is distinct from p_displayed_digest then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 select * into s from private.worker_ai_sessions where conversation_id=r.conversation_id and account_id=auth.uid() for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 select * into cmd from private.worker_ai_saves where account_id=auth.uid() and client_request_id=p_client_request_id;
 if found and cmd.review_id<>r.id then raise exception 'WORKER_AI_REQUEST_CONFLICT' using errcode='PT409'; end if;
 select * into cmd from private.worker_ai_saves where review_id=r.id;
 if found then return cmd.receipt; end if;
 perform 1 from public.ai_conversations where id=s.conversation_id and account_id=auth.uid() and purpose='PROFILE' and status='OPEN' for update;
 if not found then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 select * into p from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
 if r.revision<>s.revision or r.base_hash<>private.worker_ai_source_hash(auth.uid()) or r.expires_at<clock_timestamp()
  or r.envelope->'profile'<>s.candidate or r.envelope->'canAccept'<>'true'::jsonb or s.safety in ('BLOCK','REVIEW')
  or exists(select 1 from private.worker_ai_turns where conversation_id=s.conversation_id and state='PROCESSING')
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 if p.id is not null and (p.id<>s.profile_id or p.profile_status not in ('DRAFT','ACTIVE')) then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
 value:=r.envelope->'profile';
 -- WPP01: legacy keys stay on the wire, but may not request a retired-field change.
 -- Compare the reviewed values exactly with the locked current profile (or bootstrap
 -- defaults). Never silently discard a change the owner just reviewed.
 if value->'licenses' is distinct from coalesce(to_jsonb(p.licenses),'[]'::jsonb)
  or value->'teamCapacity' is distinct from to_jsonb(coalesce(p.team_capacity,1))
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 if p.id is null then
  insert into public.app_profiles(id,account_id,kind,display_name,bio,skills,tools,vehicles)
  values(s.profile_id,auth.uid(),'WORKER',value->>'displayName',value->>'bio',
   array(select jsonb_array_elements_text(value->'skills')),array(select jsonb_array_elements_text(value->'tools')),
   array(select jsonb_array_elements_text(value->'vehicles'))) returning * into p;
 else
  update public.app_profiles set display_name=value->>'displayName',bio=value->>'bio',
   skills=array(select jsonb_array_elements_text(value->'skills')),tools=array(select jsonb_array_elements_text(value->'tools')),
   vehicles=array(select jsonb_array_elements_text(value->'vehicles')) where id=p.id;
 end if;
 if value->'location'<>private.worker_location_document(p.id)-array['profileId','accountId','revision'] then
  perform public.rpc_save_worker_location(private.worker_location_document(p.id)->>'revision',value->'location',true);
 end if;
 perform public.rpc_save_worker_availability(private.worker_availability_document(p.id)->>'revision',value->'availability');
 -- WPP01: preserve existing deprecated capacity; new profiles use the stored default.
 if (r.envelope->>'activate')::boolean then perform public.rpc_complete_worker_profile(p.id); end if;
 update public.ai_conversations set status='COMPLETED',completed_at=clock_timestamp() where id=s.conversation_id;
 receipt:=jsonb_build_object('reviewId',r.id,'conversationId',s.conversation_id,'accountId',auth.uid(),'profileId',p.id,
  'profileStatus',(select profile_status from public.app_profiles where id=p.id),'saved',true,'authoritative',true);
 insert into private.worker_ai_saves(review_id,account_id,client_request_id,receipt) values(r.id,auth.uid(),p_client_request_id,receipt);
 return receipt;
end $function$;

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

  -- New work uses the same actual task-time boundary as search/dispatch.
  -- Replay already returned above; evaluate after the Need lock was acquired.
  if not private.need_search_time_admitted_v1(n.id,clock_timestamp()) then
    raise exception 'NEED_EXECUTION_WINDOW_EXPIRED' using errcode='PT409',
      hint='Vreme za ovaj zadatak je isteklo.';
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
    and (n.starts_at is null or not isfinite(n.starts_at)
      or (n.ends_at is not null and (not isfinite(n.ends_at) or n.starts_at>=n.ends_at))) then
    raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
  end if;
  -- Start-only appointment cannot accept a new offer after its start while lifecycle tick catches up.
  if n.schedule_kind='FIXED_WINDOW' and n.ends_at is null
     and n.starts_at is not null and n.starts_at<=statement_timestamp() then
    raise exception 'FIXED_WINDOW_START_PASSED' using errcode='22023';
  end if;
  v_match := private.match_detail_for_calendar_interval(p_need_id, p_worker_profile_id,
    coalesce(p_proposed_start_at,case when n.schedule_kind='FIXED_WINDOW' and n.ends_at is not null then n.starts_at end),
    coalesce(p_proposed_end_at,case when n.schedule_kind='FIXED_WINDOW' and n.ends_at is not null then n.ends_at end));
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
    -- KEEP/UPDATE is a new application to the current task. WITHDRAW and
    -- committed idempotent replays remain outside this admission check.
    if not private.need_search_time_admitted_v1(v_need.id,clock_timestamp()) then
      raise exception 'NEED_EXECUTION_WINDOW_EXPIRED' using errcode='PT409',
        hint='Vreme za ovaj zadatak je isteklo.';
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
      and (v_need.starts_at is null or not isfinite(v_need.starts_at)
        or (v_need.ends_at is not null and (not isfinite(v_need.ends_at) or v_need.starts_at>=v_need.ends_at))) then
      raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
    end if;
    v_match := private.match_detail_for_calendar_interval(v_need.id, v_response.worker_profile_id,
      coalesce(v_start,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.starts_at end),
      coalesce(v_end,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.ends_at end));
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