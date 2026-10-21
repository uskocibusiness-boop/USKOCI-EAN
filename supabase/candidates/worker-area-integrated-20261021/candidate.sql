-- WAR01 current live forward patch. Apply with helpers and rollback proof atomically.
do $gate$ begin
if md5(pg_get_functiondef('public.rpc_complete_worker_profile(uuid)'::regprocedure))<>'ba85aa79219961646c387ab64156a073' then raise exception 'WAR01_PREIMAGE_CHANGED: rpc_complete_worker_profile'; end if;
if md5(pg_get_functiondef('public.rpc_get_worker_profile_for_edit()'::regprocedure))<>'f716d3c0ce49f0d048b7eee3292b305c' then raise exception 'WAR01_PREIMAGE_CHANGED: rpc_get_worker_profile_for_edit'; end if;
if md5(pg_get_functiondef('public.rpc_prepare_worker_ai_review(uuid,integer,boolean)'::regprocedure))<>'f480e6a69d03bed09f11f5a388edc8db' then raise exception 'WAR01_PREIMAGE_CHANGED: rpc_prepare_worker_ai_review'; end if;
if md5(pg_get_functiondef('public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)'::regprocedure))<>'d8384414376ec427ba2f299610f8964e' then raise exception 'WAR01_PREIMAGE_CHANGED: rpc_prepare_worker_ai_review_taxonomy'; end if;
if md5(pg_get_functiondef('public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)'::regprocedure))<>'365e33ee8addd418537c713c815ab422' then raise exception 'WAR01_PREIMAGE_CHANGED: rpc_prepare_worker_ai_review_taxonomy_confirmed'; end if;
if md5(pg_get_functiondef('public.rpc_save_worker_ai_review(uuid,text,uuid)'::regprocedure))<>'06fd3e603d0448766f7678ac4cd78738' then raise exception 'WAR01_PREIMAGE_CHANGED: rpc_save_worker_ai_review'; end if;
if md5(pg_get_functiondef('public.rpc_save_worker_location(text,jsonb,boolean)'::regprocedure))<>'c88c33b42d24eaa86c31df266be5ef9e' then raise exception 'WAR01_PREIMAGE_CHANGED: rpc_save_worker_location'; end if;
if md5(pg_get_functiondef('private.worker_ai_initial(uuid)'::regprocedure))<>'af7537f8694d77b3b5303a67cda15f16' then raise exception 'WAR01_PREIMAGE_CHANGED: worker_ai_initial'; end if;
if md5(pg_get_functiondef('private.worker_ai_patch(jsonb,jsonb,uuid,uuid,boolean)'::regprocedure))<>'547bf89492bdd1fbb7343c8c441823b0' then raise exception 'WAR01_PREIMAGE_CHANGED: worker_ai_patch'; end if;
if md5(pg_get_functiondef('private.worker_ai_source(uuid)'::regprocedure))<>'cde537a6bf7692bd72587384f2abcacb' then raise exception 'WAR01_PREIMAGE_CHANGED: worker_ai_source'; end if;
if md5(pg_get_functiondef('private.worker_need_fit_v1(uuid,uuid,boolean)'::regprocedure))<>'2c64e5293d103eb5b5014aa21e9b25b5' then raise exception 'WAR01_PREIMAGE_CHANGED: worker_need_fit_v1'; end if;
if md5(pg_get_functiondef('private.data_export_worker_candidate_v5(jsonb)'::regprocedure))<>'13805d515dff783e9be2083a4884f4cb' then raise exception 'WAR01_PREIMAGE_CHANGED: data_export_worker_candidate_v5'; end if;
end $gate$;

CREATE OR REPLACE FUNCTION public.rpc_complete_worker_profile(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_profile public.app_profiles%rowtype;
  v_previous_token text :=
    coalesce(current_setting('uskoci.profile_mutation', true), '');
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select *
    into v_profile
    from public.app_profiles
   where id = p_profile_id
   for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_profile.account_id <> v_uid or v_profile.kind <> 'WORKER' then
    raise exception 'NOT_WORKER_PROFILE_OWNER' using errcode = '42501';
  end if;

  if v_profile.profile_status = 'ACTIVE' then
    return;
  end if;

  if v_profile.profile_status <> 'DRAFT' then
    raise exception 'PROFILE_NOT_ACTIVATABLE'
      using errcode = 'P0001',
            detail = v_profile.profile_status;
  end if;

  if char_length(btrim(v_profile.display_name)) < 2 then
    raise exception 'DISPLAY_NAME_REQUIRED' using errcode = 'P0001';
  end if;

  if char_length(btrim(v_profile.city)) < 2 and jsonb_array_length(private.worker_saved_areas_v1(v_uid))=0
   and not private.worker_saved_remote_only_v1(v_uid) then
    raise exception 'CITY_REQUIRED' using errcode = 'P0001';
  end if;

  if cardinality(v_profile.skills) < 1 then
    raise exception 'SKILL_REQUIRED' using errcode = 'P0001';
  end if;

  perform set_config(
    'uskoci.profile_mutation',
    'COMPLETE_WORKER_PROFILE',
    true
  );

  update public.app_profiles
     set profile_status = 'ACTIVE'
   where id = p_profile_id
     and profile_status = 'DRAFT';

  if not found then
    raise exception 'PROFILE_ACTIVATION_RACE' using errcode = 'P0001';
  end if;

  perform private.requeue_open_needs_for_worker_v5(v_uid);

  perform set_config(
    'uskoci.profile_mutation',
    v_previous_token,
    true
  );
exception
  when others then
    perform set_config(
      'uskoci.profile_mutation',
      v_previous_token,
      true
    );
    raise;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_worker_profile_for_edit()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare p public.app_profiles;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into p from public.app_profiles where account_id=auth.uid() and kind='WORKER';
  if not found then return null; end if;
  if p.profile_status not in ('DRAFT','ACTIVE','SUSPENDED') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
  return jsonb_build_object('id',p.id,'account_id',p.account_id,'kind',p.kind,
    'display_name',p.display_name,'city',p.city,'bio',p.bio,'skills',p.skills,'tools',p.tools,
    'vehicles',p.vehicles,'licenses',p.licenses,'profile_status',p.profile_status,'available_now',p.available_now,
    'radius_km',p.radius_km,'team_capacity',p.team_capacity,
    'capacity_revision',private.worker_capacity_document(p.id)->>'revision','work_areas',private.worker_saved_areas_v1(p.account_id));
end;
$function$;

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
  if jsonb_array_length(coalesce(s.candidate->'workAreas','[]'::jsonb))=0 and length(s.candidate#>>'{location,city}')<2 then missing:=missing||'"Mesto rada"'::jsonb; end if;
  if jsonb_array_length(s.candidate->'skills')<1 then missing:=missing||'"Veštine"'::jsonb; end if;
 end if;
 if jsonb_array_length(coalesce(s.candidate->'workAreas','[]'::jsonb))=0 and (s.candidate->'location')<> (private.worker_ai_initial(auth.uid())->'location')
  and (s.candidate#>'{location,operatingCountryCode}'='null'::jsonb or length(s.candidate#>>'{location,city}')<1)
 then missing:=missing||'"Država i mesto rada"'::jsonb; end if;
 if s.candidate->'tools' is distinct from private.worker_ai_initial(auth.uid())->'tools'
  or s.candidate->'vehicles' is distinct from private.worker_ai_initial(auth.uid())->'vehicles'
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 perform private.validate_worker_areas_v1(coalesce(s.candidate->'workAreas','[]'::jsonb));
 perform private.normalize_worker_ai_availability(s.profile_id,s.account_id,s.candidate->'availability');
 select * into r from private.worker_ai_reviews where conversation_id=p_conversation_id and revision=s.revision
  and envelope->>'workAreaPolicy'='SIGNED_WORK_AREAS_V1'
  and envelope->>'equipmentPolicy'='PRESERVE_LEGACY_NO_WRITE_V1'
  and base_hash=s.base_hash and envelope->'activate'=to_jsonb(p_activate) and expires_at>clock_timestamp() order by created_at desc limit 1;
 if found then return r.envelope; end if;
 r.id:=extensions.gen_random_uuid(); expires:=clock_timestamp()+interval '15 minutes';
 doc:=jsonb_build_object('schemaVersion','WORKER_PROFILE_V1','reviewId',r.id,'conversationId',p_conversation_id,'accountId',auth.uid(),
  'profileId',s.profile_id,'revision',s.revision,'profile',s.candidate,'activate',p_activate,'missingRequired',missing,
  'canAccept',jsonb_array_length(missing)=0,'expiresAt',expires);
 doc:=doc||jsonb_build_object('workAreaPolicy','SIGNED_WORK_AREAS_V1');
 doc:=doc||jsonb_build_object('equipmentPolicy','PRESERVE_LEGACY_NO_WRITE_V1');
 doc:=doc||jsonb_build_object('displayedContentDigest',encode(extensions.digest((doc||jsonb_build_object('baseHash',s.base_hash))::text,'sha256'),'hex'));
 insert into private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,expires_at)
 values(r.id,auth.uid(),p_conversation_id,s.revision,s.base_hash,doc,expires);
 return doc;
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
  if jsonb_array_length(coalesce(s.candidate->'workAreas','[]'::jsonb))=0 and length(s.candidate#>>'{location,city}')<2 then missing:=missing||'"Mesto rada"'::jsonb; end if;
  if jsonb_array_length(s.candidate->'skills')<1 then missing:=missing||'"Veštine"'::jsonb; end if;
 end if;
 if jsonb_array_length(coalesce(s.candidate->'workAreas','[]'::jsonb))=0 and (s.candidate->'location')<> (private.worker_ai_initial(auth.uid())->'location')
  and (s.candidate#>'{location,operatingCountryCode}'='null'::jsonb or length(s.candidate#>>'{location,city}')<1)
 then missing:=missing||'"Država i mesto rada"'::jsonb; end if;
 if s.candidate->'tools' is distinct from private.worker_ai_initial(auth.uid())->'tools'
  or s.candidate->'vehicles' is distinct from private.worker_ai_initial(auth.uid())->'vehicles'
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 perform private.validate_worker_areas_v1(coalesce(s.candidate->'workAreas','[]'::jsonb));
 perform private.normalize_worker_ai_availability(s.profile_id,s.account_id,s.candidate->'availability');
 select * into r from private.worker_ai_reviews where conversation_id=p_conversation_id and revision=s.revision
  and envelope->>'workAreaPolicy'='SIGNED_WORK_AREAS_V1'
  and envelope->>'equipmentPolicy'='PRESERVE_LEGACY_NO_WRITE_V1'
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
 if doc->>'classificationState'='READY' and jsonb_array_length(doc->'reviewedServiceModes')>0
  and not exists(select 1 from jsonb_array_elements(doc->'reviewedServiceModes') m where m->>'mode'<>'REMOTE') then
  missing:=coalesce((select jsonb_agg(v) from jsonb_array_elements(missing) v where v#>>'{}' not in ('Mesto rada','Država i mesto rada')),'[]'::jsonb);
  doc:=doc||jsonb_build_object('missingRequired',missing,'canAccept',jsonb_array_length(missing)=0);
 end if;
 -- Sign BEFORE storing or returning the owner-visible review.
 doc:=doc||jsonb_build_object('workAreaPolicy','SIGNED_WORK_AREAS_V1');
 doc:=doc||jsonb_build_object('equipmentPolicy','PRESERVE_LEGACY_NO_WRITE_V1');
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
  if jsonb_array_length(coalesce(s.candidate->'workAreas','[]'::jsonb))=0 and length(s.candidate#>>'{location,city}')<2 then missing:=missing||'"Mesto rada"'::jsonb; end if;
  if jsonb_array_length(s.candidate->'skills')<1 then missing:=missing||'"Veštine"'::jsonb; end if;
 end if;
 if jsonb_array_length(coalesce(s.candidate->'workAreas','[]'::jsonb))=0 and (s.candidate->'location')<> (private.worker_ai_initial(auth.uid())->'location')
  and (s.candidate#>'{location,operatingCountryCode}'='null'::jsonb or length(s.candidate#>>'{location,city}')<1)
 then missing:=missing||'"Država i mesto rada"'::jsonb; end if;
 if s.candidate->'tools' is distinct from private.worker_ai_initial(auth.uid())->'tools'
  or s.candidate->'vehicles' is distinct from private.worker_ai_initial(auth.uid())->'vehicles'
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 perform private.validate_worker_areas_v1(coalesce(s.candidate->'workAreas','[]'::jsonb));
 perform private.normalize_worker_ai_availability(s.profile_id,s.account_id,s.candidate->'availability');
 select * into r from private.worker_ai_reviews where conversation_id=p_conversation_id and revision=s.revision
  and envelope->>'workAreaPolicy'='SIGNED_WORK_AREAS_V1'
  and envelope->>'equipmentPolicy'='PRESERVE_LEGACY_NO_WRITE_V1'
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
 if doc->>'classificationState'='READY' and jsonb_array_length(doc->'reviewedServiceModes')>0
  and not exists(select 1 from jsonb_array_elements(doc->'reviewedServiceModes') m where m->>'mode'<>'REMOTE') then
  missing:=coalesce((select jsonb_agg(v) from jsonb_array_elements(missing) v where v#>>'{}' not in ('Mesto rada','Država i mesto rada')),'[]'::jsonb);
  doc:=doc||jsonb_build_object('missingRequired',missing,'canAccept',jsonb_array_length(missing)=0);
 end if;
 -- Sign BEFORE storing or returning the owner-visible review.
 doc:=doc||jsonb_build_object('workAreaPolicy','SIGNED_WORK_AREAS_V1');
 doc:=doc||jsonb_build_object('equipmentPolicy','PRESERVE_LEGACY_NO_WRITE_V1');
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
declare s private.worker_ai_sessions; r private.worker_ai_reviews; cmd private.worker_ai_saves; p public.app_profiles; value jsonb; receipt jsonb; area_token text;
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
 perform private.validate_worker_areas_v1(coalesce(value->'workAreas','[]'::jsonb));
 -- WPP01: legacy keys stay on the wire, but may not request a retired-field change.
 -- Compare the reviewed values exactly with the locked current profile (or bootstrap
 -- defaults). Never silently discard a change the owner just reviewed.
 if value->'tools' is distinct from coalesce(to_jsonb(p.tools),'[]'::jsonb)
  or value->'vehicles' is distinct from coalesce(to_jsonb(p.vehicles),'[]'::jsonb)
  or value->'licenses' is distinct from coalesce(to_jsonb(p.licenses),'[]'::jsonb)
  or value->'teamCapacity' is distinct from to_jsonb(coalesce(p.team_capacity,1))
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 if p.id is null then
  insert into public.app_profiles(id,account_id,kind,display_name,bio,skills)
  values(s.profile_id,auth.uid(),'WORKER',value->>'displayName',value->>'bio',
   array(select jsonb_array_elements_text(value->'skills'))) returning * into p;
 else
  update public.app_profiles set display_name=value->>'displayName',bio=value->>'bio',
   skills=array(select jsonb_array_elements_text(value->'skills')) where id=p.id;
 end if;
 if value->'location'<>private.worker_location_document(p.id)-array['profileId','accountId','revision'] then
  perform public.rpc_save_worker_location(private.worker_location_document(p.id)->>'revision',value->'location',true);
 end if;
 perform public.rpc_save_worker_availability(private.worker_availability_document(p.id)->>'revision',value->'availability');
 -- WPP01: preserve existing deprecated capacity; new profiles use the stored default.
 if (r.envelope->>'activate')::boolean then
  if jsonb_array_length(coalesce(value->'workAreas','[]'::jsonb))>0
   or (r.envelope->>'classificationState'='READY' and jsonb_array_length(r.envelope->'reviewedServiceModes')>0
    and not exists(select 1 from jsonb_array_elements(r.envelope->'reviewedServiceModes') m where m->>'mode'<>'REMOTE')) then
   -- Exact signed Save already checked ownership/revision/source/digest above.
   -- Activate BEFORE the receipt so taxonomy binder current-profile timestamps remain valid.
   if p.profile_status='DRAFT' then
    if length(btrim(value->>'displayName'))<2 or jsonb_array_length(value->'skills')<1 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
    area_token:=coalesce(current_setting('uskoci.profile_mutation',true),'');
    perform set_config('uskoci.profile_mutation','COMPLETE_WORKER_PROFILE',true);
    update public.app_profiles set profile_status='ACTIVE' where id=p.id and profile_status='DRAFT';
    perform set_config('uskoci.profile_mutation',area_token,true);
   end if;
  else perform public.rpc_complete_worker_profile(p.id); end if;
 end if;
 update public.ai_conversations set status='COMPLETED',completed_at=clock_timestamp() where id=s.conversation_id;
 receipt:=jsonb_build_object('reviewId',r.id,'conversationId',s.conversation_id,'accountId',auth.uid(),'profileId',p.id,
  'profileStatus',(select profile_status from public.app_profiles where id=p.id),'saved',true,'authoritative',true);
 insert into private.worker_ai_saves(review_id,account_id,client_request_id,receipt) values(r.id,auth.uid(),p_client_request_id,receipt);
 perform private.requeue_open_needs_for_worker_v5(auth.uid());
 return receipt;
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_save_worker_location(p_expected_revision text, p_value jsonb, p_confirmed boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare p public.app_profiles; before_doc jsonb; wanted jsonb; v_city text; radius integer; coords jsonb; lat numeric; lng numeric; country text; previous_token text;
begin
  if auth.uid() is not null and jsonb_array_length(private.worker_saved_areas_v1(auth.uid()))>0 then
   raise exception 'WORKER_AREA_REQUIRES_CONVERSATION' using errcode='42501'; end if;
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_confirmed is distinct from true then raise exception 'LOCATION_CONFIRMATION_REQUIRED' using errcode='22023'; end if;
  if p_expected_revision is null or p_expected_revision !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_value) is distinct from 'object' or octet_length(p_value::text)>4096 then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  if p_value-ARRAY['operatingCountryCode','city','radiusKm','approximatePosition']<>'{}'::jsonb or not (p_value ?& ARRAY['operatingCountryCode','city','radiusKm','approximatePosition'])
    or private.location_text_valid(p_value->'city',160) is distinct from true
    or jsonb_typeof(p_value->'radiusKm') is distinct from 'number' then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  if (p_value->>'radiusKm')::numeric not between 1 and 200 or trunc((p_value->>'radiusKm')::numeric)<>(p_value->>'radiusKm')::numeric then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  country:=private.require_location_country(p_value->'operatingCountryCode');
  v_city:=btrim(p_value->>'city');radius:=(p_value->>'radiusKm')::numeric::integer;coords:=p_value->'approximatePosition';
  if coords<>'null'::jsonb then
    if jsonb_typeof(coords) is distinct from 'object' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    if coords-ARRAY['latitude','longitude']<>'{}'::jsonb or jsonb_typeof(coords->'latitude') is distinct from 'number'
      or jsonb_typeof(coords->'longitude') is distinct from 'number' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    lat:=(coords->>'latitude')::numeric;lng:=(coords->>'longitude')::numeric;
    if lat not between -90 and 90 or lng not between -180 and 180 or lat<>round(lat,2) or lng<>round(lng,2) then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
    end if;
  end if;
  wanted:=jsonb_build_object('operatingCountryCode',country,'city',v_city,'radiusKm',radius,'approximatePosition',coords);
  select * into p from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
  if not found then raise exception 'WORKER_PROFILE_REQUIRED' using errcode='55000'; end if;
  if p.profile_status not in ('DRAFT','ACTIVE') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
  before_doc:=private.worker_location_document(p.id);
  if before_doc-ARRAY['revision','accountId','profileId']=wanted then
    return jsonb_build_object('saved',true,'idempotentReplay',true,'location',before_doc);
  end if;
  if before_doc->>'revision'<>p_expected_revision then raise exception 'LOCATION_VERSION_CONFLICT' using errcode='PT409'; end if;
  previous_token:=current_setting('uskoci.profile_mutation',true);
  perform set_config('uskoci.profile_mutation','LOCATION_REVIEW',true);
  update public.app_profiles set operating_country_code=country, city=v_city, radius_km=radius where id=p.id;
  insert into public.worker_match_preferences(worker_profile_id,worker_account_id,approximate_lat,approximate_lng)
    values(p.id,auth.uid(),lat,lng) on conflict(worker_profile_id) do update set approximate_lat=excluded.approximate_lat,approximate_lng=excluded.approximate_lng;
  perform set_config('uskoci.profile_mutation',coalesce(previous_token,''),true);
  perform private.requeue_open_needs_for_worker_v5(p.account_id);
  return jsonb_build_object('saved',true,'idempotentReplay',false,'location',private.worker_location_document(p.id));
end;
$function$;

CREATE OR REPLACE FUNCTION private.worker_ai_initial(aid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare p public.app_profiles;
begin
 select * into p from public.app_profiles where account_id=aid and kind='WORKER';
 if found and p.profile_status not in ('DRAFT','ACTIVE') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
 return jsonb_build_object('displayName',coalesce(p.display_name,''),'bio',coalesce(p.bio,''),
  'skills',coalesce(to_jsonb(p.skills),'[]'::jsonb),'tools',coalesce(to_jsonb(p.tools),'[]'::jsonb),
  'vehicles',coalesce(to_jsonb(p.vehicles),'[]'::jsonb),'licenses',coalesce(to_jsonb(p.licenses),'[]'::jsonb),
  'teamCapacity',coalesce(p.team_capacity,1),'workAreas',private.worker_saved_areas_v1(aid),
  'location',coalesce(private.worker_location_document(p.id)-array['profileId','accountId','revision'],
    jsonb_build_object('operatingCountryCode',null,'city','','radiusKm',15,'approximatePosition',null)),
  'availability',coalesce(private.worker_availability_document(p.id)-array['profileId','accountId','revision'],
    jsonb_build_object('timezone','Europe/Belgrade','availableNow',false,'rules','[]'::jsonb,'windows','[]'::jsonb)));
end $function$;

CREATE OR REPLACE FUNCTION private.worker_ai_patch(base jsonb, patch jsonb, pid uuid, aid uuid, manual boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare result jsonb:=base; k text; v jsonb; loc jsonb; av jsonb; op jsonb; old jsonb; item jsonb;
 rules jsonb; windows jsonb; wanted_days jsonb; remaining jsonb; next_id uuid;
begin
 if patch ?| array['tools','vehicles'] then raise exception 'WORKER_EQUIPMENT_RETIRED' using errcode='22023'; end if;
 if jsonb_typeof(patch) is distinct from 'object' or octet_length(patch::text)>262144
  or patch-array['displayName','bio','skills','tools','vehicles','licenses','teamCapacity','location','availability','workAreas']<>'{}'::jsonb
 then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
 if patch?'location' and jsonb_array_length(coalesce(base->'workAreas','[]'::jsonb))>0 and patch->'location' is distinct from base->'location' then raise exception 'WORKER_AREA_REQUIRES_CONVERSATION' using errcode='42501'; end if;
 if patch?'workAreas' then
  if manual then raise exception 'WORKER_AREA_REQUIRES_CONVERSATION' using errcode='42501'; end if;
  result:=jsonb_set(result,'{workAreas}',private.validate_worker_areas_v1(patch->'workAreas'));
 end if;
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

CREATE OR REPLACE FUNCTION private.worker_ai_source(aid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 select jsonb_build_object('profile',to_jsonb(p),'location',private.worker_location_document(p.id),
  'availability',private.worker_availability_document(p.id),'capacity',private.worker_capacity_document(p.id)) || case when private.worker_saved_areas_v1(aid)='[]'::jsonb then '{}'::jsonb else jsonb_build_object('workAreas',private.worker_saved_areas_v1(aid)) end
 from public.app_profiles p where p.account_id=aid and p.kind='WORKER';
$function$;

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
  elsif jsonb_array_length(private.worker_saved_areas_v1(p.account_id))>0 then
    radius:=null; dist:=null;
    area:=private.worker_area_fit_v1(private.worker_saved_areas_v1(p.account_id),n.execution_location_mode,n.task_country_code,n.approximate_city,n.approximate_lat,n.approximate_lng);
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

CREATE OR REPLACE FUNCTION private.data_export_worker_candidate_v5(v jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$ select jsonb_build_object('displayName',private.data_export_scalar_v5(v->'displayName','string'),'bio',private.data_export_scalar_v5(v->'bio','string'),'skills',private.data_export_array_v5(v->'skills','string'),'tools',private.data_export_array_v5(v->'tools','string'),'licenses',private.data_export_array_v5(v->'licenses','string'),'vehicles',private.data_export_array_v5(v->'vehicles','string'),'teamCapacity',private.data_export_scalar_v5(v->'teamCapacity','number'),'workAreas',coalesce((select jsonb_agg(jsonb_build_object('kind',private.data_export_scalar_v5(a->'kind','string'),'countryCode',private.data_export_scalar_v5(a->'countryCode','string'),'label',private.data_export_scalar_v5(a->'label','string'),'city',private.data_export_scalar_v5(a->'city','string'),'sourceRef',private.data_export_scalar_v5(a->'sourceRef','string'),'latitude',private.data_export_scalar_v5(a->'latitude','number'),'longitude',private.data_export_scalar_v5(a->'longitude','number'),'radiusKm',private.data_export_scalar_v5(a->'radiusKm','number')) order by ordinal) from jsonb_array_elements(case when jsonb_typeof(v->'workAreas')='array' then v->'workAreas' else '[]'::jsonb end) with ordinality x(a,ordinal) where jsonb_typeof(a)='object'),'[]'::jsonb),'location',jsonb_build_object('operatingCountryCode',private.data_export_scalar_v5(v#>'{location,operatingCountryCode}','string'),'city',private.data_export_scalar_v5(v#>'{location,city}','string'),'radiusKm',private.data_export_scalar_v5(v#>'{location,radiusKm}','number'),'approximatePosition',jsonb_build_object('latitude',private.data_export_scalar_v5(v#>'{location,approximatePosition,latitude}','number'),'longitude',private.data_export_scalar_v5(v#>'{location,approximatePosition,longitude}','number'))),'availability',jsonb_build_object('timezone',private.data_export_scalar_v5(v#>'{availability,timezone}','string'),'availableNow',private.data_export_scalar_v5(v#>'{availability,availableNow}','boolean'),'rules',coalesce((select jsonb_agg(jsonb_build_object('id',private.data_export_scalar_v5(x->'id','string'),'startTime',private.data_export_scalar_v5(x->'startTime','string'),'endTime',private.data_export_scalar_v5(x->'endTime','string'),'startsOn',private.data_export_scalar_v5(x->'startsOn','string'),'endsOn',private.data_export_scalar_v5(x->'endsOn','string'),'label',private.data_export_scalar_v5(x->'label','string'),'active',private.data_export_scalar_v5(x->'active','boolean'),'weekdays',private.data_export_array_v5(x->'weekdays','number')) order by ordinal) from jsonb_array_elements(case when jsonb_typeof(v#>'{availability,rules}')='array' then v#>'{availability,rules}' else '[]'::jsonb end) with ordinality as a(x,ordinal) where jsonb_typeof(x)='object'),'[]'::jsonb),'windows',coalesce((select jsonb_agg(jsonb_build_object('id',private.data_export_scalar_v5(x->'id','string'),'startsAt',private.data_export_scalar_v5(x->'startsAt','string'),'endsAt',private.data_export_scalar_v5(x->'endsAt','string'),'state',private.data_export_scalar_v5(x->'state','string'),'label',private.data_export_scalar_v5(x->'label','string')) order by ordinal) from jsonb_array_elements(case when jsonb_typeof(v#>'{availability,windows}')='array' then v#>'{availability,windows}' else '[]'::jsonb end) with ordinality as a(x,ordinal) where jsonb_typeof(x)='object'),'[]'::jsonb))) $function$;