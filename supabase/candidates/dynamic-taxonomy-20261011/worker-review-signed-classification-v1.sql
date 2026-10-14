-- Gate A owner-signed worker review. SOURCE ONLY: NOT DEPLOYED.
-- Preserves original 3-argument RPC, session lock, owner, base-hash and
-- existing review digest. One ordinary Save confirms exactly the modes shown.
-- Gemini hints are NEVER standalone consent or a capability grant.
-- LIMIT: hints are per succeeded turn and source fingerprint. If a multi-turn
-- conversation lacks complete same-source hints, classification stays PENDING;
-- text/skills remain saveable but are NOT eligible via strict taxonomy matcher.
-- Before any DEV rollout: verify legacy APK decoder compatibility and produce
-- disposable PostgreSQL runtime proof of digest/revision/ownership.
BEGIN;
DO $dependencies$
BEGIN
 IF to_regprocedure('private.taxonomy_review_exact_projection_v1(text,jsonb,jsonb)') IS NULL
 OR to_regprocedure('private.taxonomy_admission_fingerprint_v1()') IS NULL
 OR to_regclass('private.work_taxonomy_gemini_turn_hints_v1') IS NULL
 THEN RAISE EXCEPTION 'WORKER_REVIEW_SIGNED_DEPENDENCIES_MISSING'; END IF;
END $dependencies$;
CREATE OR REPLACE FUNCTION public.rpc_prepare_worker_ai_review(p_conversation_id uuid, p_expected_revision integer, p_activate boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; doc jsonb; missing jsonb:='[]'; expires timestamptz;
 v_source text;v_hints jsonb;v_modes jsonb:='[]'::jsonb;v_item jsonb;v_projection jsonb;
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
       and v_item->>'action' in ('REUSE_EXISTING','CREATE_CHILD') then
       v_modes:=v_modes||jsonb_build_array(jsonb_build_object(
         'service',v_item->>'service','mode',v_item->>'mode'));
     end if;
   end loop;
 end if;
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
end $function$

COMMIT;
