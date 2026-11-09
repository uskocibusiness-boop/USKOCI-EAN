-- SOURCE ONLY: saved DRAFT activation continuity. No DEV authorization.
-- WORKER_DRAFT_ACTIVATION_ISOLATED_START
CREATE OR REPLACE FUNCTION private.worker_ai_service_mode_context_v1(p_account_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 v_session private.worker_ai_sessions; v_profile_id uuid;
 v_item jsonb; v_projection jsonb; v_hints jsonb; v_source text; v_turn_resolved boolean:=false;
 v_saved_services jsonb:='[]';v_draft_services jsonb:='[]';v_unresolved jsonb:='[]';
 v_prior_review jsonb;v_prior_draft jsonb:='[]';v_prior_valid boolean:=false;

BEGIN
 SELECT * INTO v_session FROM private.worker_ai_sessions
 WHERE account_id=p_account_id AND conversation_id=p_conversation_id;
 IF NOT FOUND OR v_session.base_hash IS DISTINCT FROM private.worker_ai_source_hash(p_account_id)
    OR jsonb_typeof(v_session.candidate->'skills') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'WORKER_AI_NOT_EDITABLE' USING errcode='55000'; END IF;
 v_profile_id:=v_session.profile_id;
 -- Read only durable, active bindings for independently surviving services.
 -- A newer pending addition is not authority to erase an older bound service.
 -- Source hash above still ties this context to the current owned profile.
 WITH names AS (
  SELECT skill AS service,private.taxonomy_normalize_v1(skill) AS service_key
  FROM jsonb_array_elements_text(v_session.candidate->'skills') n(skill)
  WHERE EXISTS(SELECT 1 FROM public.app_profiles p WHERE p.id=v_profile_id
    AND p.account_id=p_account_id AND p.kind='WORKER' AND p.profile_status='ACTIVE'
    AND (SELECT count(*) FROM unnest(p.skills) saved_skill
      WHERE private.taxonomy_normalize_v1(saved_skill)=private.taxonomy_normalize_v1(skill))=1)
 ), saved AS (
  SELECT s.*,r.envelope FROM private.worker_ai_saves s
  JOIN private.worker_ai_reviews r ON r.id=s.review_id AND r.account_id=s.account_id
  WHERE s.account_id=p_account_id AND s.receipt->>'profileId'=v_profile_id::text
   AND (EXISTS(
    SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m WHERE m.worker_account_id=p_account_id
     AND m.active AND m.source_review_id=s.review_id AND m.source_request_key=s.client_request_id))
   AND s.receipt->>'accountId'=p_account_id::text AND s.receipt->>'reviewId'=r.id::text
   AND s.receipt->'saved'='true'::jsonb AND s.receipt->'authoritative'='true'::jsonb
   AND r.envelope->>'profileId'=v_profile_id::text AND r.envelope->>'accountId'=p_account_id::text
   AND r.envelope->>'reviewId'=r.id::text AND r.envelope->'canAccept'='true'::jsonb
   AND r.created_at<=s.created_at AND s.created_at<=r.expires_at
   AND r.envelope->>'displayedContentDigest'=encode(extensions.digest(
     ((r.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',r.base_hash))::text,'sha256'),'hex')

 ), bound AS (
  SELECT n.service,m.execution_scope AS mode,m.handoff,c.id AS category_id
  FROM names n JOIN private.work_taxonomy_categories c ON c.state='ESTABLISHED'
  JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
  JOIN private.taxonomy_confirmed_worker_modes_v1 m ON m.category_id=c.id AND m.execution_scope=cm.execution_scope
   AND m.worker_account_id=p_account_id AND m.active
  JOIN private.work_taxonomy_worker_capabilities cap ON cap.category_id=c.id AND cap.worker_account_id=p_account_id
   AND NOT cap.excluded AND cap.origin='WORKER_CONFIRMED' AND cap.confirmed_at=m.confirmed_at AND cap.updated_at<=m.confirmed_at
  JOIN saved s ON s.review_id=m.source_review_id AND s.client_request_id=m.source_request_key
   AND s.envelope->>'classificationState'='READY'
  JOIN private.work_taxonomy_worker_bindings_v1 b ON b.owner_account_id=p_account_id
   AND b.profile_id=v_profile_id AND b.source_review_id=s.review_id AND b.request_key=s.client_request_id
   AND b.bound_at=m.confirmed_at AND b.bound_at>=s.created_at
   AND b.result->>'status'='BOUND_WORKER_SERVICES' AND b.result->>'workerProfileId'=v_profile_id::text
  JOIN private.work_taxonomy_review_batches_v1 batch ON batch.owner_account_id=p_account_id
   AND batch.source_review_id=s.review_id AND batch.request_key=s.client_request_id AND batch.purpose='WORKER_CAPABILITY'
   AND batch.result->>'status'='COMMITTED' AND batch.result->'requiresBinding'='true'::jsonb
   AND batch.catalog_version=b.catalog_version AND batch.plans=s.envelope->'classificationCandidates'
   AND batch.review_digest=s.envelope->>'displayedContentDigest'
   AND jsonb_typeof(batch.plans)='array' AND jsonb_typeof(batch.result->'items')='array'
   AND b.result->'serviceModeCount'=to_jsonb(jsonb_array_length(batch.plans))
   AND jsonb_array_length(batch.result->'items')=jsonb_array_length(batch.plans)
   AND jsonb_array_length(s.envelope->'reviewedServiceModes')=jsonb_array_length(batch.plans)
  WHERE m.execution_scope IN ('ON_SITE','REMOTE')
   AND EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
    WHERE choice.worker_profile_id=v_profile_id AND choice.worker_account_id=p_account_id
     AND choice.consent_source='EXPLICIT_PROFILE_REVIEW' AND choice.confirmed_at IS NOT NULL
     AND m.execution_scope=ANY(choice.modes))
   -- Compare the saved service key, preserving n.service for display. Formatting
   -- changes are not a new skill; arbitrary synonyms still require signed IDs.
   AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(s.envelope#>'{profile,skills}') skill(value)
     WHERE private.taxonomy_normalize_v1(skill.value)=n.service_key)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.envelope->'reviewedServiceModes') selected(value)
     WHERE private.taxonomy_normalize_v1(selected.value->>'service')=n.service_key
       AND selected.value->>'mode'=m.execution_scope)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.result->'items') result(value)
     WHERE private.taxonomy_normalize_v1(result.value->>'service')=n.service_key
       AND result.value->>'mode'=m.execution_scope AND result.value->>'categoryId'=c.id::text)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) plan WHERE private.taxonomy_normalize_v1(plan->>'service')=n.service_key
    AND plan->>'mode'=m.execution_scope AND (plan->'handoff') IS NOT DISTINCT FROM m.handoff)
   AND (m.handoff IS NULL OR (m.execution_scope='REMOTE' AND private.taxonomy_handoff_valid_v1(m.handoff)))
   AND (SELECT count(*) FROM names same WHERE same.service_key=n.service_key)=1
   AND (
    -- Preserve exact/registered-alias resolution, including ambiguity refusal.
    ((c.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=c.id AND a.normalized_key=n.service_key))
     AND (SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=1)
    OR
    -- A local signed service may name an already-bound ID without a global alias.
    -- This branch only describes existing active authority; it never grants it.
    ((SELECT count(*) FROM private.work_taxonomy_categories other WHERE other.state='ESTABLISHED'
      AND (other.canonical_key=n.service_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=other.id AND a.normalized_key=n.service_key)))=0
     AND s.receipt->>'profileStatus'='ACTIVE'
     AND private.taxonomy_category_path_valid_v1(c.id)
     AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
       WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
     AND EXISTS(SELECT 1 FROM jsonb_array_elements(batch.plans) WITH ORDINALITY plan(value,ord)
       WHERE plan.value->>'action' IN ('REUSE_EXISTING','EXTEND_MODE')
        AND private.taxonomy_normalize_v1(plan.value->>'service')=n.service_key AND plan.value->>'mode'=m.execution_scope
        AND (plan.value->'handoff') IS NOT DISTINCT FROM m.handoff
        AND plan.value->>'categoryId'=c.id::text
        AND jsonb_typeof(plan.value->'categoryLabel')='string'
        AND c.label IS NOT DISTINCT FROM plan.value->>'categoryLabel'
        AND plan.value ? 'categoryParentId'
        AND coalesce(to_jsonb(c.parent_id),'null'::jsonb)
            IS NOT DISTINCT FROM plan.value->'categoryParentId'
        AND batch.result->'items'->(plan.ord::integer-1)->>'categoryId'=c.id::text
        AND batch.result->'items'->(plan.ord::integer-1)->>'mode'=m.execution_scope
        AND private.taxonomy_normalize_v1(batch.result->'items'->(plan.ord::integer-1)->>'service')=n.service_key))
   )

 ) SELECT coalesce(jsonb_agg(DISTINCT (jsonb_build_object('service',service,'mode',mode,
   'categoryId',category_id)||CASE WHEN handoff IS NOT NULL THEN jsonb_build_object('handoff',handoff)
     ELSE '{}'::jsonb END)),'[]'::jsonb) INTO v_saved_services FROM bound;


 -- Reopen only the latest unchanged owned DRAFT Save as proposals. These rows
 -- stay draftServices: they grant no active capability or notification consent.
 IF v_session.revision=0 AND v_session.candidate=private.worker_ai_initial(p_account_id)
   AND EXISTS(SELECT 1 FROM public.app_profiles p WHERE p.id=v_profile_id
     AND p.account_id=p_account_id AND p.kind='WORKER' AND p.profile_status='DRAFT')
   AND NOT EXISTS(SELECT 1 FROM private.worker_ai_turns t WHERE t.conversation_id=p_conversation_id)
   AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_gemini_turn_hints_v1 h
     WHERE h.account_id=p_account_id AND h.conversation_id=p_conversation_id)
 THEN
   WITH latest AS (
     SELECT s.* FROM private.worker_ai_saves s WHERE s.account_id=p_account_id
       AND s.receipt->>'profileId'=v_profile_id::text
     ORDER BY s.created_at DESC,s.review_id DESC LIMIT 1
   )
   SELECT r.envelope INTO v_prior_review FROM latest s
   JOIN private.worker_ai_reviews r ON r.id=s.review_id AND r.account_id=s.account_id
   JOIN private.worker_ai_sessions prior ON prior.conversation_id=r.conversation_id
     AND prior.account_id=p_account_id AND prior.profile_id=v_profile_id
   JOIN public.ai_conversations conv ON conv.id=r.conversation_id
     AND conv.account_id=p_account_id AND conv.purpose='PROFILE' AND conv.status='COMPLETED'
   WHERE s.receipt->>'accountId'=p_account_id::text
     AND s.receipt->>'reviewId'=r.id::text AND s.receipt->>'conversationId'=r.conversation_id::text
     AND s.receipt->>'profileStatus'='DRAFT'
     AND s.receipt->'saved'='true'::jsonb AND s.receipt->'authoritative'='true'::jsonb
     AND r.envelope->>'accountId'=p_account_id::text AND r.envelope->>'profileId'=v_profile_id::text
     AND r.envelope->>'reviewId'=r.id::text AND r.envelope->>'conversationId'=r.conversation_id::text
     AND r.envelope->'revision'=to_jsonb(r.revision) AND prior.revision=r.revision
     AND prior.base_hash=v_session.base_hash AND prior.candidate=v_session.candidate
     AND prior.safety NOT IN ('BLOCK','REVIEW')
     AND r.envelope->'profile'=v_session.candidate
     AND r.envelope->'activate'='false'::jsonb AND r.envelope->'canAccept'='true'::jsonb
     AND r.envelope->>'classificationState'='READY'
     AND r.envelope->'classificationCatalogVersion'=
       (SELECT to_jsonb(catalog_version) FROM private.work_taxonomy_control WHERE singleton)
     AND r.envelope->>'classificationCatalogFingerprint'=private.taxonomy_admission_fingerprint_v1()
     AND r.created_at<=s.created_at AND s.created_at<=r.expires_at
     AND r.envelope->>'displayedContentDigest'=encode(extensions.digest(
       ((r.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',r.base_hash))::text,'sha256'),'hex')
     AND NOT EXISTS(SELECT 1 FROM private.worker_ai_saves other WHERE other.account_id=p_account_id
       AND other.receipt->>'profileId'=v_profile_id::text AND other.created_at=s.created_at
       AND other.review_id<>s.review_id);
   IF jsonb_typeof(v_prior_review->'classificationCandidates')='array'
      AND jsonb_typeof(v_prior_review->'reviewedServiceModes')='array'
      AND jsonb_array_length(v_prior_review->'classificationCandidates') BETWEEN 1 AND 12
      AND jsonb_array_length(v_prior_review->'classificationCandidates')=
          jsonb_array_length(v_prior_review->'reviewedServiceModes')
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_session.candidate->'skills') skill
        WHERE (SELECT count(*) FROM jsonb_array_elements_text(v_session.candidate->'skills') other
          WHERE private.taxonomy_normalize_v1(other)=private.taxonomy_normalize_v1(skill))<>1)
   THEN
     v_prior_valid:=true;
     FOR v_item IN SELECT value FROM jsonb_array_elements(v_prior_review->'classificationCandidates') LOOP
       -- Exact/alias plans intentionally omit semantic label/parent witnesses.
       -- Re-run their exact projection; semantic synonyms retain signed IDs.
       v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
         jsonb_build_array(v_item->>'service'),jsonb_build_array(jsonb_build_object(
           'service',v_item->>'service','mode',v_item->>'mode')));
       IF v_item->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
         OR v_item->>'mode' IS NULL OR v_item->>'mode' NOT IN ('ON_SITE','REMOTE')
         OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_session.candidate->'skills') skill
           WHERE skill=v_item->>'service')
         OR (SELECT count(*) FROM jsonb_array_elements(v_prior_review->'classificationCandidates') p
           WHERE p->>'service'=v_item->>'service' AND p->>'mode'=v_item->>'mode')<>1
         OR (SELECT count(*) FROM jsonb_array_elements(v_prior_review->'reviewedServiceModes') m
           WHERE m->>'service'=v_item->>'service' AND m->>'mode'=v_item->>'mode')<>1
         OR private.taxonomy_risk_triage_v1(v_item->>'service') IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
         OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
           JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id AND cm.execution_scope=v_item->>'mode'
           WHERE c.id::text=v_item->>'categoryId' AND c.state='ESTABLISHED'
             AND ((v_projection->>'status'='READY'
               AND v_projection#>>'{classificationCandidates,0,categoryId}'=c.id::text)
              OR (v_item?'categoryParentId' AND c.label=v_item->>'categoryLabel'
               AND coalesce(to_jsonb(c.parent_id),'null'::jsonb)=v_item->'categoryParentId'))
             AND private.taxonomy_risk_triage_v1(c.label)='LOW_RISK_CANDIDATE'
             AND private.taxonomy_category_path_valid_v1(c.id)
             AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
               WHERE child.parent_id=c.id AND child.state='ESTABLISHED'))
         OR (v_item?'handoff' AND (v_item->>'mode'<>'REMOTE'
           OR private.taxonomy_handoff_valid_v1(v_item->'handoff') IS NOT TRUE))
         OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_prior_review->'classificationCandidates') other
           WHERE other->>'categoryId'=v_item->>'categoryId' AND other->>'mode'=v_item->>'mode'
             AND other->'handoff' IS DISTINCT FROM v_item->'handoff')
       THEN v_prior_valid:=false;EXIT; END IF;
       v_prior_draft:=v_prior_draft||jsonb_build_array(jsonb_build_object(
         'service',v_item->>'service','mode',v_item->>'mode','categoryId',v_item->>'categoryId')
         ||CASE WHEN v_item?'handoff' THEN jsonb_build_object('handoff',v_item->'handoff') ELSE '{}'::jsonb END);
     END LOOP;
     IF v_prior_valid AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_session.candidate->'skills') skill
       WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_prior_draft) p WHERE p->>'service'=skill))
     THEN v_draft_services:=v_prior_draft; END IF;
   END IF;
 END IF;

 -- Latest current-source hints are separate proposals. Even an exact category
 -- and mode here are not saved consent and must never replace the baseline.
 v_source:=encode(extensions.digest(convert_to(
   v_session.candidate::text||'|'||v_session.revision::text||'|'||v_session.base_hash,'UTF8'),'sha256'),'hex');
 SELECT h.proposals,coalesce(h.catalog_resolution->>'state'='RESOLVED',false) INTO v_hints,v_turn_resolved FROM private.work_taxonomy_turn_hints_resolved_v1 h
 WHERE h.purpose='WORKER_CAPABILITY' AND h.account_id=p_account_id
   AND h.conversation_id=p_conversation_id AND h.source_fingerprint=v_source
   AND h.catalog_version=(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton=true)
 ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
 IF jsonb_typeof(v_hints)='array' THEN
   FOR v_item IN SELECT value FROM jsonb_array_elements(v_hints) LOOP
     IF v_item->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
        OR v_item->>'mode' NOT IN ('ON_SITE','REMOTE')
        OR v_item->>'categoryId' IS NULL
        OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_session.candidate->'skills') skill(value)
          WHERE skill.value=to_jsonb(v_item->>'service'))
        OR (SELECT count(*) FROM jsonb_array_elements(v_session.candidate->'skills') skill(value)
            WHERE private.taxonomy_normalize_v1(skill.value#>>'{}')=
                  private.taxonomy_normalize_v1(v_item->>'service'))<>1
     THEN CONTINUE; END IF;
     v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
       jsonb_build_array(v_item->>'service'),jsonb_build_array(
         jsonb_build_object('service',v_item->>'service','mode',v_item->>'mode')));
     IF v_turn_resolved OR (v_projection->>'status'='READY'
        AND v_projection#>>'{classificationCandidates,0,categoryId}'=v_item->>'categoryId')
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
 FROM (SELECT DISTINCT skill.value FROM jsonb_array_elements(v_session.candidate->'skills') skill(value)
   WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_saved_services||v_draft_services) known(value)
     WHERE known.value->>'service'=skill.value#>>'{}')) unresolved;
 RETURN jsonb_build_object('schemaVersion','WORKER_SERVICE_MODE_CONTEXT_V1','revision',v_session.revision,
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
 select h.proposals into v_hints from private.work_taxonomy_turn_hints_resolved_v1 h
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
 -- An untouched new session may also reuse the current DRAFT Save witness
 -- validated by context. Any user turn/edit or hint excludes this fallback.
 for v_item in select value from jsonb_array_elements((v_context->'savedServices')||
   case when s.revision=0 and s.candidate=private.worker_ai_initial(auth.uid())
     and not exists(select 1 from private.worker_ai_turns t where t.conversation_id=p_conversation_id)
     and not exists(select 1 from private.work_taxonomy_gemini_turn_hints_v1 h
       where h.account_id=auth.uid() and h.conversation_id=p_conversation_id)
   then v_context->'draftServices' else '[]'::jsonb end) loop
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
         'reason','Previously signed and saved service identity','catalogVersion',v_version)
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
    and private.worker_remote_review_ready_v1(doc) IS NOT TRUE
    and (doc->>'classificationState'='READY'
      and jsonb_array_length(private.validate_worker_areas_v1(
        coalesce(s.candidate->'workAreas','[]'::jsonb)))>0) IS NOT TRUE then
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
end $function$;

CREATE OR REPLACE FUNCTION private.complete_worker_profile_v1(p_profile_id uuid, p_review_id uuid, p_displayed_digest text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_review private.worker_ai_reviews;
  v_session private.worker_ai_sessions;
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


  if char_length(btrim(v_profile.city)) < 2
    and private.worker_remote_only_activation_ready_v1(v_uid,v_profile.skills) IS NOT TRUE then
    if p_review_id is null or p_displayed_digest is null then
      raise exception 'CITY_REQUIRED' using errcode='P0001';
    end if;
    select * into v_review from private.worker_ai_reviews
     where id=p_review_id and account_id=v_uid;
    if not found or v_review.envelope->>'displayedContentDigest' is distinct from p_displayed_digest then
      raise exception 'WORKER_AI_DENIED' using errcode='42501';
    end if;
    select * into v_session from private.worker_ai_sessions
     where conversation_id=v_review.conversation_id and account_id=v_uid for update;
    -- Save checked the live source hash BEFORE its own writes. Those writes
    -- change the hash: bind to the locked original session, not a new hash.
    if not found or v_session.profile_id is distinct from p_profile_id
      or v_review.revision is distinct from v_session.revision
      or v_review.base_hash is distinct from v_session.base_hash
      or v_review.envelope->'profile' is distinct from v_session.candidate
      or v_review.envelope->>'profileId' is distinct from p_profile_id::text
      or v_review.envelope->>'accountId' is distinct from v_uid::text
      or v_review.envelope->>'reviewId' is distinct from p_review_id::text
      or v_review.envelope->>'conversationId' is distinct from v_session.conversation_id::text
      or v_review.envelope->'revision' is distinct from to_jsonb(v_session.revision)
      or v_review.envelope->'activate' is distinct from 'true'::jsonb
      or v_review.envelope->'canAccept' is distinct from 'true'::jsonb
      or v_review.expires_at<clock_timestamp()
      or v_session.safety in ('BLOCK','REVIEW')
      or v_profile.display_name is distinct from v_session.candidate->>'displayName'
      or to_jsonb(v_profile.skills) is distinct from v_session.candidate->'skills'
      or p_displayed_digest is distinct from encode(extensions.digest(
        ((v_review.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',v_review.base_hash))::text,'sha256'),'hex')
      or exists(select 1 from private.worker_ai_turns where conversation_id=v_session.conversation_id and state='PROCESSING')
    then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
    perform 1 from private.work_taxonomy_control where singleton=true for share;
    if private.worker_remote_review_ready_v1(v_review.envelope) IS NOT TRUE
      and (v_review.envelope->>'classificationState'='READY'
        and v_review.envelope->'classificationCatalogVersion'=
          (select to_jsonb(catalog_version) from private.work_taxonomy_control where singleton)
        and v_review.envelope->>'classificationCatalogFingerprint'=private.taxonomy_admission_fingerprint_v1()
        and jsonb_array_length(private.validate_worker_areas_v1(
          coalesce(v_review.envelope#>'{profile,workAreas}','[]'::jsonb)))>0) IS NOT TRUE then
      raise exception 'WORKER_AI_STALE' using errcode='PT409';
    end if;
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
