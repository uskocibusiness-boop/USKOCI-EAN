-- LOCAL_ONLY source candidate; not a DEV migration or deployment.
-- Preserve captured owner/ACL; original body MD5 54409302013cce5673fc1d493dd4eaac.
CREATE OR REPLACE FUNCTION public.rpc_prepare_worker_ai_review_taxonomy_confirmed(p_conversation_id uuid, p_expected_revision integer, p_activate boolean, p_selected_modes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; doc jsonb; missing jsonb:='[]'; expires timestamptz;
 v_modes jsonb;v_projection jsonb;v_ordinary jsonb;v_context jsonb;
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
 -- Selecting a mode is not consent to restore a handoff explicitly changed
 -- earlier in this conversation. A later turn may omit that old service;
 -- only a fresh projected handoff can supersede the last explicit change.
 if v_projection->>'status'='READY' then
   v_context:=private.worker_ai_service_mode_context_v1(auth.uid(),p_conversation_id);
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
 -- Reuse the ordinary owner's fresh signed continuity only for the identical
 -- complete selection. A changed mode, stale source/catalog or unresolved plan
 -- must continue through this explicit selection's original result.
 if v_projection->>'status'='PENDING_CLASSIFICATION' then
   v_ordinary:=public.rpc_prepare_worker_ai_review_taxonomy(p_conversation_id,p_expected_revision,p_activate);
   if v_ordinary->>'classificationState'='READY' and v_ordinary->'canAccept'='true'::jsonb
      and v_ordinary->'reviewedServiceModes'=p_selected_modes then
     return v_ordinary;
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
