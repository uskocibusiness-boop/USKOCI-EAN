-- Additive provider context. This read creates no capability, consent or draft.
DO $precondition$
BEGIN
 IF md5(pg_get_functiondef('public.rpc_read_worker_ai_context_service(uuid,uuid)'::regprocedure))
    <> '24b1dbfde5aa4dfa1277b5ac294effe0'
 THEN RAISE EXCEPTION 'WORKER_MODE_CONTEXT_PREDECESSOR_MISMATCH'; END IF;
 IF to_regprocedure('private.worker_ai_service_mode_context_v1(uuid,uuid)') IS NOT NULL
 THEN RAISE EXCEPTION 'WORKER_MODE_CONTEXT_HELPER_ALREADY_EXISTS'; END IF;
END $precondition$;

CREATE FUNCTION private.worker_ai_service_mode_context_v1(p_account_id uuid,p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 s private.worker_ai_sessions; v_saved private.worker_ai_saves; v_previous record;
 v_current jsonb; v_item jsonb; v_projection jsonb; v_hints jsonb; v_source text;
 v_saved_services jsonb:='[]';v_draft_services jsonb:='[]';v_unresolved jsonb:='[]';
 v_count integer;v_category uuid;
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
       THEN v_saved_services:=v_saved_services||jsonb_build_array(jsonb_build_object(
         'service',v_item->>'service','mode',v_item->>'mode','categoryId',v_category));
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
       'service',v_item->>'service','mode',v_item->>'mode','categoryId',v_item->>'categoryId'));
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
REVOKE ALL ON FUNCTION private.worker_ai_service_mode_context_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.rpc_read_worker_ai_context_service(p_account_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare doc jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=p_account_id)
 then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 doc:=private.worker_ai_document(p_conversation_id);
 if doc is null or doc->>'status'<>'OPEN' or doc->>'safety' in ('BLOCK','REVIEW') or doc->'stale'='true'::jsonb then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 -- Keep owned history intact. Only the exact USER message attached by a new
 -- claim and subsequently cancelled before dispatch is excluded from provider
 -- context. Legacy rows have no fabricated timestamp-based association.
 return jsonb_set(doc-array['review','saved'],'{messages}',coalesce((
  select jsonb_agg(m.value order by m.ordinality) from jsonb_array_elements(doc->'messages') with ordinality m(value,ordinality)
  where not exists(select 1 from private.worker_ai_turns t where t.account_id=p_account_id and t.conversation_id=p_conversation_id
   and t.cancelled_at is not null and t.user_message_id=(m.value->>'id')::uuid)), '[]'::jsonb)) || jsonb_build_object('serviceModeContext',
   private.worker_ai_service_mode_context_v1(p_account_id,p_conversation_id));
end $function$
;

