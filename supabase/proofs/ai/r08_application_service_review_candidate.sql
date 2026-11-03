-- LOCAL_ONLY / NOT_DEPLOYED. Not a migration or a DEV operation.
-- Bounded SQL proof: r08_application_service_review.test.mjs; not full schema/Auth acceptance.
-- Application -> optional owned profile review, without a provider or label lookup.
-- Reuses worker_ai_sessions/reviews, the existing Save, outbox and signed binder.
-- A promotion must capture dependencies/preimages, ACL/closure inventory and rollback.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

CREATE FUNCTION public.rpc_worker_service_from_application(
  p_expected_user_id uuid, p_application_id uuid, p_worker_profile_id uuid,
  p_prepare boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE
  aid uuid := auth.uid();
  application public.marketplace_responses;
  task public.needs;
  profile public.app_profiles;
  session private.worker_ai_sessions;
  review private.worker_ai_reviews;
  saved private.worker_ai_saves;
  category private.work_taxonomy_categories;
  initial jsonb; context jsonb; services jsonb; plans jsonb := '[]'; modes jsonb := '[]';
  item jsonb; target jsonb; handoff jsonb; doc jsonb; result jsonb;
  v_service text; scope text; marker text; state text;
  version bigint; fingerprint text; cid uuid; existing_service text; count_ids integer;
BEGIN
  IF aid IS NULL OR aid IS DISTINCT FROM p_expected_user_id THEN
    RAISE EXCEPTION 'AUTH_ACCOUNT_CHANGED' USING errcode='42501';
  END IF;
  PERFORM private.closure_assert_open(aid);
  IF p_application_id IS NULL OR p_worker_profile_id IS NULL OR p_prepare IS NULL THEN
    RAISE EXCEPTION 'APPLICATION_SERVICE_INPUT_INVALID' USING errcode='22023';
  END IF;
  SELECT * INTO application FROM public.marketplace_responses
    WHERE id=p_application_id AND worker_account_id=aid AND worker_profile_id=p_worker_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_SERVICE_DENIED' USING errcode='42501'; END IF;
  SELECT * INTO task FROM public.needs WHERE id=application.need_id;
  IF NOT FOUND OR private.accounts_same_world(task.requester_account_id,aid) IS NOT TRUE THEN
    RAISE EXCEPTION 'APPLICATION_SERVICE_DENIED' USING errcode='42501';
  END IF;
  SELECT * INTO profile FROM public.app_profiles
    WHERE id=p_worker_profile_id AND account_id=aid AND kind='WORKER';
  IF NOT FOUND OR profile.profile_status<>'ACTIVE' THEN
    RAISE EXCEPTION 'WORKER_PROFILE_RESTRICTED' USING errcode='42501';
  END IF;
  result:=jsonb_build_object('accountId',aid,'applicationId',application.id,
    'needId',application.need_id,'profileId',profile.id);
  marker:='APPLICATION_SERVICE:'||application.id::text;

  -- The owned response ID is a stable prepare identity, also after remount/lost ACK.
  -- Ordinary worker intake may already have an open draft. Never merge into it.
  SELECT * INTO session FROM private.worker_ai_sessions
    WHERE account_id=aid AND open_request_id=application.id;
  IF FOUND THEN
    SELECT r.* INTO review FROM private.worker_ai_reviews r
      WHERE r.account_id=aid AND r.conversation_id=session.conversation_id
      ORDER BY EXISTS(SELECT 1 FROM private.worker_ai_saves s
        WHERE s.review_id=r.id AND s.account_id=aid) DESC,
        r.created_at DESC,r.id DESC LIMIT 1;
    IF FOUND THEN
      SELECT value INTO target FROM jsonb_array_elements(review.envelope->'classificationCandidates')
        WHERE value->>'reason'=marker;
      IF target IS NULL THEN
        RAISE EXCEPTION 'APPLICATION_SERVICE_DRAFT_CHANGED' USING errcode='PT409';
      END IF;
      SELECT * INTO saved FROM private.worker_ai_saves WHERE account_id=aid AND review_id=review.id;
      IF FOUND THEN
        -- Save is not yet a capability. Only its current exact binder/mode is confirmation.
        state:=CASE WHEN EXISTS(
          SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m
          JOIN private.work_taxonomy_worker_capabilities cap
            ON cap.worker_account_id=m.worker_account_id AND cap.category_id=m.category_id
          JOIN private.work_taxonomy_worker_bindings_v1 b
            ON b.owner_account_id=m.worker_account_id AND b.source_review_id=m.source_review_id
            AND b.request_key=m.source_request_key AND b.profile_id=profile.id
          JOIN private.work_taxonomy_categories c ON c.id=m.category_id
          JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id AND cm.execution_scope=m.execution_scope
          WHERE m.worker_account_id=aid AND m.category_id=(target->>'categoryId')::uuid
            AND m.execution_scope=target->>'mode' AND m.active AND NOT cap.excluded
            AND cap.origin='WORKER_CONFIRMED' AND cap.confirmed_at=m.confirmed_at
            AND cap.updated_at<=m.confirmed_at AND b.bound_at=m.confirmed_at
            AND m.source_review_id=review.id AND m.source_request_key=saved.client_request_id
            AND b.result->>'status'='BOUND_WORKER_SERVICES'
            AND c.state='ESTABLISHED' AND c.label=target->>'categoryLabel'
            AND to_jsonb(c.parent_id) IS NOT DISTINCT FROM nullif(target->'categoryParentId','null'::jsonb)
            AND private.taxonomy_category_path_valid_v1(c.id)
            AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child WHERE child.parent_id=c.id AND child.state='ESTABLISHED')
            AND m.handoff IS NOT DISTINCT FROM target->'handoff'
            AND target->>'service'=ANY(profile.skills)
            AND EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
              WHERE choice.worker_profile_id=profile.id AND choice.worker_account_id=aid
                AND m.execution_scope=ANY(choice.modes) AND choice.confirmed_at IS NOT NULL)
        ) THEN 'CONFIRMED' WHEN EXISTS(SELECT 1 FROM private.worker_ai_saves newer
          WHERE newer.account_id=aid AND newer.created_at>saved.created_at)
          THEN 'CHANGED' ELSE 'SAVED' END;
        RETURN result||jsonb_build_object('state',state,'service',target->>'service','mode',target->>'mode',
          'categoryId',target->>'categoryId','handoff',target->'handoff','review',review.envelope);
      END IF;
      IF review.revision<>session.revision OR review.base_hash<>private.worker_ai_source_hash(aid)
        OR review.envelope->'profile' IS DISTINCT FROM session.candidate
        OR NOT EXISTS(SELECT 1 FROM public.ai_conversations WHERE id=session.conversation_id AND status='OPEN')
      THEN RAISE EXCEPTION 'APPLICATION_SERVICE_DRAFT_CHANGED' USING errcode='PT409'; END IF;
      -- One-click opt-in still refers to the task of this submitted application.
      -- Never reuse a prepared document for an application/task changed meanwhile.
      IF p_prepare AND (application.response_kind IS DISTINCT FROM 'OFFER'
        OR application.status NOT IN ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED')
        OR application.withdrawn_at IS NOT NULL OR application.submitted_at IS NULL
        OR application.submitted_against_need_revision IS DISTINCT FROM task.revision) THEN
        RAISE EXCEPTION 'APPLICATION_SERVICE_TASK_CHANGED' USING errcode='PT409';
      END IF;
      IF NOT p_prepare OR review.expires_at>clock_timestamp() THEN
        RETURN result||jsonb_build_object('state',CASE WHEN review.expires_at>clock_timestamp() THEN 'READY' ELSE 'EXPIRED' END,
          'service',target->>'service','mode',target->>'mode','categoryId',target->>'categoryId',
          'handoff',target->'handoff','review',review.envelope);
      END IF;
    END IF;
  END IF;
  -- This branch never opens a conversation, writes a draft, retries Save or invokes AI.
  IF NOT p_prepare THEN RETURN result||jsonb_build_object('state','NONE'); END IF;

  IF application.response_kind IS DISTINCT FROM 'OFFER'
    OR application.status NOT IN ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED')
    OR application.withdrawn_at IS NOT NULL OR application.submitted_at IS NULL
    OR application.submitted_against_need_revision IS DISTINCT FROM task.revision
  THEN RAISE EXCEPTION 'APPLICATION_SERVICE_TASK_CHANGED' USING errcode='PT409'; END IF;
  IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_need_snapshots n
    WHERE n.need_id=task.id AND n.need_revision=task.revision AND n.category_id=task.category_id
      AND n.reviewed_by_requester AND n.classification_state='CONFIRMED')
    OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_need_bindings_v1 b
      WHERE b.need_id=task.id AND b.need_revision=task.revision AND b.category_id=task.category_id
        AND b.owner_account_id=task.requester_account_id) THEN
    RAISE EXCEPTION 'APPLICATION_SERVICE_TASK_CHANGED' USING errcode='PT409';
  END IF;
  scope:=CASE task.execution_location_mode WHEN 'REMOTE' THEN 'REMOTE'
    WHEN 'STATIONARY' THEN 'ON_SITE' WHEN 'POINT_TO_POINT' THEN 'ON_SITE'
    WHEN 'MULTI_STOP' THEN 'ON_SITE' WHEN 'AREA_BASED' THEN 'ON_SITE' END;
  SELECT * INTO category FROM private.work_taxonomy_categories WHERE id=task.category_id;
  IF NOT FOUND OR category.state<>'ESTABLISHED' OR scope IS NULL
    OR NOT private.taxonomy_category_path_valid_v1(category.id)
    OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories c WHERE c.parent_id=category.id AND c.state='ESTABLISHED')
    OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes m WHERE m.category_id=category.id AND m.execution_scope=scope)
  THEN RAISE EXCEPTION 'APPLICATION_SERVICE_TASK_CHANGED' USING errcode='PT409'; END IF;

  doc:=public.rpc_open_worker_ai(application.id);
  cid:=(doc->>'conversationId')::uuid;
  SELECT * INTO session FROM private.worker_ai_sessions WHERE conversation_id=cid AND account_id=aid FOR UPDATE;
  IF NOT FOUND OR session.open_request_id<>application.id OR session.profile_id<>profile.id THEN
    RAISE EXCEPTION 'APPLICATION_SERVICE_PROFILE_DRAFT_OPEN' USING errcode='PT409';
  END IF;
  PERFORM 1 FROM public.ai_conversations WHERE id=cid AND account_id=aid AND status='OPEN' FOR UPDATE;
  IF NOT FOUND OR session.safety<>'ALLOW'
    OR EXISTS(SELECT 1 FROM private.worker_ai_turns WHERE conversation_id=cid)
  THEN RAISE EXCEPTION 'APPLICATION_SERVICE_DRAFT_CHANGED' USING errcode='PT409'; END IF;
  SELECT * INTO profile FROM public.app_profiles WHERE id=p_worker_profile_id AND account_id=aid FOR UPDATE;
  initial:=private.worker_ai_initial(aid);
  IF profile.profile_status<>'ACTIVE' OR session.base_hash<>private.worker_ai_source_hash(aid)
    OR (session.candidate-'skills') IS DISTINCT FROM (initial-'skills') THEN
    RAISE EXCEPTION 'APPLICATION_SERVICE_DRAFT_CHANGED' USING errcode='PT409';
  END IF;
  -- Another device may have completed prepare while rpc_open_worker_ai waited.
  -- Reuse that immutable review instead of creating a second confirmation.
  SELECT * INTO review FROM private.worker_ai_reviews r
    WHERE r.account_id=aid AND r.conversation_id=cid AND r.revision=session.revision
      AND r.base_hash=session.base_hash AND r.envelope->'profile'=session.candidate
      AND r.expires_at>clock_timestamp()
      AND EXISTS(SELECT 1 FROM jsonb_array_elements(r.envelope->'classificationCandidates') p WHERE p->>'reason'=marker)
    ORDER BY r.created_at DESC,r.id DESC LIMIT 1;
  IF FOUND THEN
    SELECT value INTO target FROM jsonb_array_elements(review.envelope->'classificationCandidates') WHERE value->>'reason'=marker;
    RETURN result||jsonb_build_object('state','READY','service',target->>'service','mode',target->>'mode',
      'categoryId',target->>'categoryId','handoff',target->'handoff','review',review.envelope);
  END IF;
  context:=private.worker_ai_service_mode_context_v1(aid,cid);
  services:=context->'savedServices';
  -- Do not drop an existing unconfirmed service or invent its mode to save this addition.
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(initial->'skills') old(service)
    WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(services) s WHERE s->>'service'=old.service)) THEN
    RAISE EXCEPTION 'APPLICATION_SERVICE_PROFILE_REVIEW_REQUIRED' USING errcode='PT409';
  END IF;
  SELECT count(DISTINCT value->>'service'),min(value->>'service') INTO count_ids,existing_service
    FROM jsonb_array_elements(services) WHERE value->>'categoryId'=category.id::text;
  IF count_ids>1 THEN RAISE EXCEPTION 'APPLICATION_SERVICE_PROFILE_REVIEW_REQUIRED' USING errcode='PT409'; END IF;
  v_service:=coalesce(existing_service,category.label);
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(services) s
    WHERE s->>'categoryId'=category.id::text AND s->>'mode'=scope) THEN
    -- Roll back a newly opened empty draft as well. No profile mutation is needed.
    RAISE EXCEPTION 'APPLICATION_SERVICE_ALREADY_PRESENT' USING errcode='22023';
  END IF;
  IF existing_service IS NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(initial->'skills') old(service)
    WHERE private.taxonomy_normalize_v1(old.service)=private.taxonomy_normalize_v1(v_service)) THEN
    RAISE EXCEPTION 'APPLICATION_SERVICE_PROFILE_REVIEW_REQUIRED' USING errcode='PT409';
  END IF;
  IF scope='ON_SITE' AND jsonb_array_length(coalesce(initial->'workAreas','[]'::jsonb))=0
    AND char_length(btrim(coalesce(initial#>>'{location,city}','')))<2 THEN
    RAISE EXCEPTION 'APPLICATION_SERVICE_AREA_REQUIRED' USING errcode='PT409';
  END IF;
  SELECT d.handoff INTO handoff FROM public.need_requirement_details d WHERE d.need_id=task.id;
  IF handoff IS NOT NULL AND (scope<>'REMOTE' OR NOT private.taxonomy_handoff_valid_v1(handoff)) THEN
    RAISE EXCEPTION 'APPLICATION_SERVICE_TASK_CHANGED' USING errcode='PT409';
  END IF;
  IF existing_service IS NULL THEN initial:=jsonb_set(initial,'{skills}',(initial->'skills')||to_jsonb(v_service)); END IF;
  IF jsonb_array_length(initial->'skills')>12 THEN
    RAISE EXCEPTION 'APPLICATION_SERVICE_LIMIT' USING errcode='22023';
  END IF;
  -- A prior prepare may contain exactly this addition, never other unsaved edits.
  IF session.candidate IS DISTINCT FROM private.worker_ai_initial(aid) AND session.candidate IS DISTINCT FROM initial THEN
    RAISE EXCEPTION 'APPLICATION_SERVICE_DRAFT_CHANGED' USING errcode='PT409';
  END IF;
  SELECT catalog_version INTO version FROM private.work_taxonomy_control WHERE singleton;
  fingerprint:=private.taxonomy_admission_fingerprint_v1();
  IF version IS NULL OR fingerprint IS NULL THEN RAISE EXCEPTION 'APPLICATION_SERVICE_TASK_CHANGED' USING errcode='PT409'; END IF;
  services:=services||jsonb_build_array(jsonb_build_object('service',v_service,'mode',scope,'categoryId',category.id)
    ||CASE WHEN handoff IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('handoff',handoff) END);
  FOR item IN SELECT value FROM jsonb_array_elements(services) LOOP
    SELECT * INTO category FROM private.work_taxonomy_categories WHERE id=(item->>'categoryId')::uuid;
    IF NOT FOUND OR category.state<>'ESTABLISHED' OR NOT private.taxonomy_category_path_valid_v1(category.id)
      OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes m WHERE m.category_id=category.id AND m.execution_scope=item->>'mode')
      OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories c WHERE c.parent_id=category.id AND c.state='ESTABLISHED') THEN
      RAISE EXCEPTION 'APPLICATION_SERVICE_TASK_CHANGED' USING errcode='PT409';
    END IF;
    target:=jsonb_build_object('action','REUSE_EXISTING','service',item->>'service','mode',item->>'mode',
      'categoryId',category.id,'categoryLabel',category.label,'categoryParentId',category.parent_id,
      'catalogVersion',version,'reason',CASE WHEN category.id=task.category_id AND item->>'mode'=scope
        THEN marker ELSE 'PRESERVE_CONFIRMED_SERVICE' END)
      ||CASE WHEN item ? 'handoff' THEN jsonb_build_object('handoff',item->'handoff') ELSE '{}'::jsonb END;
    plans:=plans||jsonb_build_array(target);
    modes:=modes||jsonb_build_array(jsonb_build_object('service',item->>'service','mode',item->>'mode'));
  END LOOP;
  IF jsonb_array_length(plans)>24 OR pg_column_size(plans)>16000
    OR fingerprint IS DISTINCT FROM private.taxonomy_admission_fingerprint_v1() THEN
    RAISE EXCEPTION 'APPLICATION_SERVICE_TASK_CHANGED' USING errcode='PT409';
  END IF;
  UPDATE private.worker_ai_sessions SET candidate=initial,revision=revision+1
    WHERE conversation_id=cid AND candidate IS DISTINCT FROM initial;
  SELECT * INTO session FROM private.worker_ai_sessions WHERE conversation_id=cid;
  review.id:=extensions.gen_random_uuid(); review.expires_at:=clock_timestamp()+interval '15 minutes';
  doc:=jsonb_build_object('schemaVersion','WORKER_PROFILE_V1','reviewId',review.id,'conversationId',cid,
    'accountId',aid,'profileId',profile.id,'revision',session.revision,'profile',session.candidate,
    'activate',false,'missingRequired','[]'::jsonb,'canAccept',true,'expiresAt',review.expires_at,
    'classificationState','READY','classificationCandidates',plans,'reviewedServiceModes',modes,
    'classificationCatalogVersion',version,'classificationCatalogFingerprint',fingerprint,
    'equipmentPolicy','PRESERVE_LEGACY_NO_WRITE_V1','workAreaPolicy','SIGNED_WORK_AREAS_V1');
  doc:=doc||jsonb_build_object('displayedContentDigest',encode(extensions.digest(
    (doc||jsonb_build_object('baseHash',session.base_hash))::text,'sha256'),'hex'));
  INSERT INTO private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,expires_at)
    VALUES(review.id,aid,cid,session.revision,session.base_hash,doc,review.expires_at);
  SELECT value INTO target FROM jsonb_array_elements(plans) WHERE value->>'reason'=marker;
  RETURN result||jsonb_build_object('state','READY','service',v_service,'mode',scope,
    'categoryId',task.category_id,'handoff',target->'handoff','review',doc);
END $function$;
REVOKE ALL ON FUNCTION public.rpc_worker_service_from_application(uuid,uuid,uuid,boolean)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_worker_service_from_application(uuid,uuid,uuid,boolean) TO authenticated;
COMMIT;
