-- LOCAL_ONLY source candidate; not a DEV migration or deployment.
-- Preserve captured owner/ACL; original body MD5 cdf0ad45a118c0bd30110f9b011fa8c7.
CREATE OR REPLACE FUNCTION public.rpc_prepare_worker_ai_review_taxonomy(p_conversation_id uuid, p_expected_revision integer, p_activate boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; doc jsonb; missing jsonb:='[]'; expires timestamptz;
 v_source text;v_hints jsonb;v_modes jsonb:='[]'::jsonb;v_item jsonb;v_projection jsonb;
 v_context jsonb;v_retained jsonb:='[]'::jsonb;v_plans jsonb:='[]'::jsonb;v_one jsonb;v_saved_item jsonb;v_plan jsonb;
 v_version bigint;v_fingerprint text;
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
  -- City readiness follows the signed service projection below.
  if jsonb_array_length(s.candidate->'skills')<1 then missing:=missing||'"Veštine"'::jsonb; end if;
 end if;
 if (s.candidate->'location')<> (private.worker_ai_initial(auth.uid())->'location')
  and (s.candidate#>'{location,operatingCountryCode}'='null'::jsonb or length(s.candidate#>>'{location,city}')<1)
 then missing:=missing||'"Država i mesto rada"'::jsonb; end if;
 if s.candidate->'tools' is distinct from private.worker_ai_initial(auth.uid())->'tools'
  or s.candidate->'vehicles' is distinct from private.worker_ai_initial(auth.uid())->'vehicles'
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 perform private.normalize_worker_ai_availability(s.profile_id,s.account_id,s.candidate->'availability');
 select * into r from private.worker_ai_reviews where conversation_id=p_conversation_id and revision=s.revision
  and envelope->>'equipmentPolicy'='PRESERVE_LEGACY_NO_WRITE_V1'
  and not (p_activate and char_length(btrim(coalesce(s.candidate#>>'{location,city}','')))<2)
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

 -- Reuse only independently bound, unchanged services from this owner's
 -- current profile. Any current hint for a service (including invalid/null
 -- modes or actions) takes precedence and prevents silent old-mode fallback.
 perform 1 from private.work_taxonomy_worker_bindings_v1 binding
   where binding.owner_account_id=auth.uid() and binding.profile_id=s.profile_id for share;
 perform 1 from private.worker_execution_mode_choices choice
   where choice.worker_profile_id=s.profile_id for share;
 perform 1 from private.taxonomy_confirmed_worker_modes_v1 mode
   where mode.worker_account_id=auth.uid() for share;
 perform 1 from private.work_taxonomy_worker_capabilities capability
   where capability.worker_account_id=auth.uid() for share;
 v_context:=private.worker_ai_service_mode_context_v1(auth.uid(),p_conversation_id);
 for v_item in select value from jsonb_array_elements(v_context->'savedServices') loop
   if not exists(select 1 from jsonb_array_elements(coalesce(v_hints,'[]'::jsonb)) h
     where private.taxonomy_normalize_v1(h->>'service')=private.taxonomy_normalize_v1(v_item->>'service'))
   and not exists(
     -- Absence in the newest turn cannot undo a prior explicit change in this
     -- conversation. A stale proposal may prevent fallback, never grant it.
     select 1 from (select h.proposals from private.work_taxonomy_gemini_turn_hints_v1 h
       where h.purpose='WORKER_CAPABILITY' and h.account_id=auth.uid() and h.conversation_id=p_conversation_id
         and h.source_fingerprint is distinct from v_source
         and exists(select 1 from jsonb_array_elements(h.proposals) p
           where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(v_item->>'service'))
       order by h.created_at desc,h.id desc limit 1) previous
     where exists(select 1 from jsonb_array_elements(previous.proposals) p
       where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(v_item->>'service')
       and (p->>'action' is distinct from 'REUSE_EXISTING' or not exists(
         select 1 from jsonb_array_elements(v_context->'savedServices') saved
         where saved->>'service'=v_item->>'service' and saved->>'mode'=p->>'mode'
           and saved->>'categoryId'=p->>'categoryId' and saved->'handoff' is not distinct from p->'handoff')))
     or exists(select 1 from jsonb_array_elements(v_context->'savedServices') saved
       where saved->>'service'=v_item->>'service' and not exists(
         select 1 from jsonb_array_elements(previous.proposals) p
         where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(v_item->>'service')
           and saved->>'mode'=p->>'mode' and saved->>'categoryId'=p->>'categoryId'
           and saved->'handoff' is not distinct from p->'handoff')))
   then
     v_modes:=v_modes||jsonb_build_array(jsonb_build_object('service',v_item->>'service','mode',v_item->>'mode'));
     v_retained:=v_retained||jsonb_build_array(v_item);
   end if;
 end loop;
 select coalesce(jsonb_agg(m.value ORDER BY skill.ord,m.value->>'mode'),'[]'::jsonb) into v_modes
 from jsonb_array_elements(v_modes) m(value) join jsonb_array_elements(s.candidate->'skills') with ordinality skill(value,ord)
   on skill.value=to_jsonb(m.value->>'service');
 v_projection:=private.taxonomy_review_candidate_projection_v2(
   'WORKER_CAPABILITY',s.candidate->'skills',v_modes,auth.uid(),p_conversation_id);
 if v_projection->>'status' in ('READY','PENDING_CLASSIFICATION') and v_retained<>'[]'::jsonb then
   select catalog_version into v_version from private.work_taxonomy_control where singleton;
   v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
   -- Existing per-service projection validates every new plan. Only a verified
   -- saved semantic ID may fill a missing old synonym, without a new model call.
   for v_item in select value from jsonb_array_elements(v_modes) loop
     v_one:=private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY',
       jsonb_build_array(v_item->>'service'),jsonb_build_array(v_item),auth.uid(),p_conversation_id);
     select value into v_saved_item from jsonb_array_elements(v_retained) x(value)
       where value->>'service'=v_item->>'service' and value->>'mode'=v_item->>'mode';
     if v_one->>'status'='READY' then
       v_plan:=v_one#>'{classificationCandidates,0}';
       if v_saved_item is not null and v_plan->>'categoryId' is distinct from v_saved_item->>'categoryId' then
         v_plans:='[]'::jsonb;exit;
       end if;
     elsif v_one->>'status'='PENDING_CLASSIFICATION' and v_saved_item is not null then
       select jsonb_build_object('action','REUSE_EXISTING','service',v_item->>'service','mode',v_item->>'mode',
         'categoryId',c.id,'categoryLabel',c.label,'categoryParentId',c.parent_id,
         'reason','Previously saved and bound service identity','catalogVersion',v_version)
       into v_plan from private.work_taxonomy_categories c where c.id::text=v_saved_item->>'categoryId'
         and c.state='ESTABLISHED' and private.taxonomy_category_path_valid_v1(c.id)
         and private.taxonomy_risk_triage_v1(v_item->>'service')='LOW_RISK_CANDIDATE'
         and private.taxonomy_risk_triage_v1(c.label)='LOW_RISK_CANDIDATE';
       if v_plan is null then v_plans:='[]'::jsonb;exit;end if;
     else v_plans:='[]'::jsonb;exit;end if;
     if v_saved_item ? 'handoff' then v_plan:=v_plan||jsonb_build_object('handoff',v_saved_item->'handoff');end if;
     v_plans:=v_plans||jsonb_build_array(v_plan);
   end loop;
   if jsonb_array_length(v_plans)=jsonb_array_length(v_modes) and pg_column_size(v_plans)<=16000
      and v_version=(select catalog_version from private.work_taxonomy_control where singleton)
      and v_fingerprint=private.taxonomy_admission_fingerprint_v1() then
     v_projection:=v_projection||jsonb_build_object('status','READY','classificationCandidates',v_plans,
       'reviewedServiceModes',v_modes,'visibleServices',v_modes,
       'classificationCatalogVersion',v_version,'classificationCatalogFingerprint',v_fingerprint);
   else v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',s.candidate->'skills','[]'::jsonb);end if;
 end if;
 -- A projected mode is not consent to restore a handoff explicitly changed
 -- earlier in this conversation. A later turn may omit that old service;
 -- only a fresh projected handoff can supersede the last explicit change.
 if v_projection->>'status'='READY' then
   if exists(select 1 from jsonb_array_elements(v_projection->'classificationCandidates') plan
     join jsonb_array_elements(v_context->'savedServices') saved
       on saved->>'service'=plan->>'service' and saved->>'mode'=plan->>'mode'
         and saved->>'categoryId'=plan->>'categoryId'
     cross join lateral (select h.proposals from private.work_taxonomy_gemini_turn_hints_v1 h
       where h.purpose='WORKER_CAPABILITY' and h.account_id=auth.uid() and h.conversation_id=p_conversation_id
         and exists(select 1 from jsonb_array_elements(h.proposals) p
           where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(plan->>'service')
             and p->>'mode'='REMOTE' and p?'handoff')
       order by h.created_at desc,h.id desc limit 1) previous
     where plan->>'mode'='REMOTE' and not(plan?'handoff')
       and exists(select 1 from jsonb_array_elements(previous.proposals) p
         where private.taxonomy_normalize_v1(p->>'service')=private.taxonomy_normalize_v1(plan->>'service')
           and p->>'mode'='REMOTE' and p?'handoff'
           and p->'handoff' is distinct from saved->'handoff')) then
     v_projection:=jsonb_build_object('status','PENDING_CLASSIFICATION','classificationCandidates','[]'::jsonb,
       'reviewedServiceModes','[]'::jsonb,'visibleServices','[]'::jsonb,
       'classificationCatalogVersion',null,'classificationCatalogFingerprint',null);
   end if;
 end if;
 v_projection:=private.taxonomy_preserve_review_handoff_v1(v_projection,auth.uid(),p_conversation_id);
 doc:=doc||jsonb_build_object('classificationState',v_projection->>'status',
   'classificationCandidates',v_projection->'classificationCandidates',
   'reviewedServiceModes',v_projection->'reviewedServiceModes',
   'classificationCatalogVersion',v_projection->'classificationCatalogVersion',
   'classificationCatalogFingerprint',v_projection->'classificationCatalogFingerprint');

 if p_activate and char_length(btrim(coalesce(s.candidate#>>'{location,city}','')))<2
    and private.worker_remote_review_ready_v1(doc) IS NOT TRUE then
   if jsonb_typeof(doc->'reviewedServiceModes')='array'
      and jsonb_array_length(doc->'reviewedServiceModes')>0
      and not exists(select 1 from jsonb_array_elements(doc->'reviewedServiceModes') m
        where m->>'mode' is distinct from 'REMOTE') then
     missing:=missing||'"Potvrda usluga za rad na daljinu"'::jsonb;
   else missing:=missing||'"Mesto rada"'::jsonb; end if;
 end if;
 doc:=doc||jsonb_build_object('missingRequired',missing,'canAccept',jsonb_array_length(missing)=0);
 -- Sign BEFORE storing or returning the owner-visible review.

 doc:=doc||jsonb_build_object('equipmentPolicy','PRESERVE_LEGACY_NO_WRITE_V1');
 doc:=doc||jsonb_build_object('displayedContentDigest',encode(extensions.digest((doc||jsonb_build_object('baseHash',s.base_hash))::text,'sha256'),'hex'));
 insert into private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,expires_at)
 values(r.id,auth.uid(),p_conversation_id,s.revision,s.base_hash,doc,expires);
 return doc;
end $function$
