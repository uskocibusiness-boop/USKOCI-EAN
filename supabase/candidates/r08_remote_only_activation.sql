-- R08/S14: first signed REMOTE-only Save+Activate. LOCAL_ONLY, NEVER a migration.
-- Activation is not taxonomy authority. Keep the authoritative ACTIVE receipt
-- AFTER activation; the existing asynchronous binder alone confirms capabilities.
-- No DEV execution before R01/R10 and the approved migration procedure.
BEGIN;
DO $admission$
BEGIN
 IF current_setting('uskoci.r08.remote_only.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
 OR current_database()<>'postgres' OR current_user<>'postgres'
 OR to_regrole('cli_login_postgres') IS NOT NULL
 THEN RAISE EXCEPTION 'R08_REMOTE_LOCAL_ONLY' USING errcode='55000'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.rpc_complete_worker_profile(uuid)')))
    IS DISTINCT FROM 'ba85aa79219961646c387ab64156a073'
 OR md5(pg_get_functiondef(to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)')))
    IS DISTINCT FROM 'd8384414376ec427ba2f299610f8964e'
 OR md5(pg_get_functiondef(to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)')))
    IS DISTINCT FROM '365e33ee8addd418537c713c815ab422'
 OR md5(pg_get_functiondef(to_regprocedure('public.rpc_save_worker_ai_review(uuid,text,uuid)')))
    IS DISTINCT FROM '06fd3e603d0448766f7678ac4cd78738'
 OR md5(pg_get_functiondef(to_regprocedure('public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)')))
    IS DISTINCT FROM '42cecbc9f0c7195f6d9edb6ccef45ca2'
 OR md5(pg_get_functiondef(to_regprocedure('public.rpc_select_response(uuid,integer,uuid,integer,text,text)')))
    IS DISTINCT FROM '2bd9a91b3f4b8179173c622c974270f9'
 OR md5(pg_get_functiondef(to_regprocedure('private.worker_need_fit_v1(uuid,uuid,boolean)')))
    IS DISTINCT FROM '62c7c0a3889c2afd9b5951f6a394fe12'
 OR to_regprocedure('private.complete_worker_profile_v1(uuid,uuid,text)') IS NOT NULL
 OR to_regprocedure('private.worker_remote_review_ready_v1(jsonb)') IS NOT NULL
 OR to_regprocedure('private.worker_remote_only_activation_ready_v1(uuid,text[])') IS NOT NULL
 THEN RAISE EXCEPTION 'R08_REMOTE_OWNER_DRIFT' USING errcode='55000'; END IF;
END; $admission$;

-- TESTABLE FUNCTIONS BEGINS.
CREATE FUNCTION private.worker_remote_review_ready_v1(p_review jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'pg_catalog' AS $f$
DECLARE v_exact jsonb;v_plans jsonb;
BEGIN
 IF p_review->>'classificationState' IS DISTINCT FROM 'READY'
 OR jsonb_typeof(p_review#>'{profile,skills}') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_review->'reviewedServiceModes') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_review->'classificationCandidates') IS DISTINCT FROM 'array'
 THEN RETURN false; END IF;
 IF jsonb_array_length(p_review->'reviewedServiceModes') NOT BETWEEN 1 AND 12
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_review->'reviewedServiceModes') m
   WHERE m->>'mode' IS DISTINCT FROM 'REMOTE')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_review->'classificationCandidates') p
   WHERE p->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
     OR (p?'handoff' AND private.taxonomy_handoff_valid_v1(p->'handoff') IS NOT TRUE))
 THEN RETURN false; END IF;
 -- Only today's complete exact canonical/registered-alias set. User-selected
 -- modes never admit a future category or extend an existing category's scope.
 v_exact:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
   p_review#>'{profile,skills}',p_review->'reviewedServiceModes');
 SELECT jsonb_agg(p.value-'handoff' ORDER BY p.ord) INTO v_plans
 FROM jsonb_array_elements(p_review->'classificationCandidates') WITH ORDINALITY p(value,ord);
 RETURN v_exact->>'status'='READY'
   AND p_review->'classificationCatalogVersion'=v_exact->'classificationCatalogVersion'
   AND p_review->'classificationCatalogFingerprint'=v_exact->'classificationCatalogFingerprint'
   AND p_review->'reviewedServiceModes'=v_exact->'reviewedServiceModes'
   AND v_plans=v_exact->'classificationCandidates';
END; $f$;

CREATE FUNCTION private.worker_remote_only_activation_ready_v1(p_account uuid,p_skills text[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'pg_catalog' AS $f$
DECLARE v_skill text;v_norm text;v_category uuid;v_matches bigint;v_profile uuid;
BEGIN
 IF p_account IS NULL OR p_skills IS NULL OR cardinality(p_skills)=0 THEN RETURN false; END IF;
 SELECT id INTO v_profile FROM public.app_profiles
 WHERE account_id=p_account AND kind='WORKER' AND skills=p_skills;
 IF v_profile IS NULL THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m
   JOIN private.work_taxonomy_worker_capabilities cap
    ON cap.worker_account_id=m.worker_account_id AND cap.category_id=m.category_id
   WHERE m.worker_account_id=p_account AND m.active
    AND cap.excluded IS FALSE AND m.execution_scope IS DISTINCT FROM 'REMOTE')
 THEN RETURN false; END IF;
 FOREACH v_skill IN ARRAY p_skills LOOP
  IF v_skill IS NULL OR char_length(btrim(v_skill)) NOT BETWEEN 3 AND 120 THEN RETURN false; END IF;
  v_norm:=private.taxonomy_normalize_v1(v_skill);
  IF v_norm IS NULL OR v_norm='' THEN RETURN false; END IF;
  SELECT count(DISTINCT c.id),min(c.id::text)::uuid INTO v_matches,v_category
  FROM private.work_taxonomy_categories c
  WHERE c.state='ESTABLISHED' AND
    (c.canonical_key=v_norm OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
      WHERE a.category_id=c.id AND a.normalized_key=v_norm));
  IF v_matches<>1 OR v_category IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (
   SELECT 1 FROM private.work_taxonomy_worker_capabilities cap
   JOIN private.taxonomy_confirmed_worker_modes_v1 m
    ON m.worker_account_id=cap.worker_account_id AND m.category_id=cap.category_id
   JOIN private.work_taxonomy_category_modes cm
    ON cm.category_id=m.category_id AND cm.execution_scope=m.execution_scope
   JOIN private.worker_ai_saves saved
    ON saved.account_id=m.worker_account_id AND saved.review_id=m.source_review_id
    AND saved.client_request_id=m.source_request_key
   JOIN private.work_taxonomy_worker_bindings_v1 binding
    ON binding.owner_account_id=saved.account_id AND binding.source_review_id=saved.review_id
    AND binding.request_key=saved.client_request_id AND binding.profile_id=v_profile
   WHERE cap.worker_account_id=p_account AND cap.category_id=v_category
    AND cap.excluded IS FALSE AND cap.origin='WORKER_CONFIRMED'
    AND m.active IS TRUE AND m.execution_scope='REMOTE'
    AND m.confirmed_at=cap.confirmed_at AND m.confirmed_at=binding.bound_at
    AND binding.result->>'status'='BOUND_WORKER_SERVICES'
    AND saved.receipt->>'profileId'=v_profile::text
    AND saved.receipt->>'profileStatus'='ACTIVE'
    AND saved.receipt->'saved'='true'::jsonb AND saved.receipt->'authoritative'='true'::jsonb
  ) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END; $f$;
REVOKE ALL ON FUNCTION private.worker_remote_review_ready_v1(jsonb),
 private.worker_remote_only_activation_ready_v1(uuid,text[]) FROM PUBLIC,anon,authenticated,service_role;
-- TESTABLE FUNCTIONS ENDS.

-- PATCH BEGINS. Exact anchors fail closed; no parallel activation implementation.
DO $patch$
DECLARE v_old text;v_new text;v_anchor text;v_sig text;
BEGIN
 v_old:=pg_get_functiondef(to_regprocedure('public.rpc_complete_worker_profile(uuid)'));
 v_new:=replace(v_old,'public.rpc_complete_worker_profile(p_profile_id uuid)',
  'private.complete_worker_profile_v1(p_profile_id uuid, p_review_id uuid, p_displayed_digest text)');
 v_new:=replace(v_new,'SECURITY DEFINER','SECURITY INVOKER');
 v_new:=replace(v_new,'  v_uid uuid := auth.uid();',
  E'  v_uid uuid := auth.uid();\n  v_review private.worker_ai_reviews;\n  v_session private.worker_ai_sessions;');
 v_anchor:=E'  if char_length(btrim(v_profile.city)) < 2 then\n    raise exception ''CITY_REQUIRED'' using errcode = ''P0001'';\n  end if;';
 IF strpos(v_new,v_anchor)=0 THEN RAISE EXCEPTION 'R08_REMOTE_ACTIVATION_ANCHOR_DRIFT'; END IF;
 v_new:=replace(v_new,v_anchor,$body$
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
    if private.worker_remote_review_ready_v1(v_review.envelope) IS NOT TRUE then
      raise exception 'WORKER_AI_STALE' using errcode='PT409';
    end if;
  end if;
$body$);
 IF v_new=v_old OR strpos(v_new,'private.complete_worker_profile_v1(')=0
 THEN RAISE EXCEPTION 'R08_REMOTE_CORE_NOT_CREATED'; END IF;
 EXECUTE v_new;
 REVOKE ALL ON FUNCTION private.complete_worker_profile_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
 EXECUTE $wrapper$CREATE OR REPLACE FUNCTION public.rpc_complete_worker_profile(p_profile_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $f$
 BEGIN PERFORM private.complete_worker_profile_v1(p_profile_id,NULL,NULL); END; $f$;$wrapper$;

 FOREACH v_sig IN ARRAY ARRAY[
  'public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)',
  'public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)'] LOOP
  v_old:=pg_get_functiondef(to_regprocedure(v_sig));
  v_anchor:='  if length(s.candidate#>>''{location,city}'')<2 then missing:=missing||''"Mesto rada"''::jsonb; end if;';
  IF strpos(v_old,v_anchor)=0 THEN RAISE EXCEPTION 'R08_REMOTE_PREPARE_CITY_DRIFT'; END IF;
  v_new:=replace(v_old,v_anchor,'  -- City readiness follows the signed service projection below.');
  v_anchor:='  and envelope->>''equipmentPolicy''=''PRESERVE_LEGACY_NO_WRITE_V1''';
  IF strpos(v_new,v_anchor)=0 THEN RAISE EXCEPTION 'R08_REMOTE_PREPARE_CACHE_DRIFT'; END IF;
  v_new:=replace(v_new,v_anchor,v_anchor||E'\n  and not (p_activate and char_length(btrim(coalesce(s.candidate#>>''{location,city}'','''')))<2)');
  v_anchor:=' -- Sign BEFORE storing or returning the owner-visible review.';
  IF strpos(v_new,v_anchor)=0 THEN RAISE EXCEPTION 'R08_REMOTE_PREPARE_SIGN_DRIFT'; END IF;
  v_new:=replace(v_new,v_anchor,$ready$
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
$ready$);
  EXECUTE v_new;
 END LOOP;
 v_old:=pg_get_functiondef(to_regprocedure('public.rpc_save_worker_ai_review(uuid,text,uuid)'));
 v_anchor:='then perform public.rpc_complete_worker_profile(p.id); end if;';
 IF strpos(v_old,v_anchor)=0 THEN RAISE EXCEPTION 'R08_REMOTE_SAVE_OWNER_DRIFT'; END IF;
 EXECUTE replace(v_old,v_anchor,
  'then perform private.complete_worker_profile_v1(p.id,r.id,p_displayed_digest); end if;');
 FOREACH v_sig IN ARRAY ARRAY[
  'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)',
  'public.rpc_select_response(uuid,integer,uuid,integer,text,text)'] LOOP
  v_old:=pg_get_functiondef(to_regprocedure(v_sig));
  v_anchor:='or char_length(btrim(v_profile.city)) < 2';
  IF v_old IS NULL OR length(v_old)-length(replace(v_old,v_anchor,''))<>length(v_anchor)
  THEN RAISE EXCEPTION 'R08_REMOTE_APPLICATION_OWNER_DRIFT'; END IF;
  EXECUTE replace(v_old,v_anchor,
   'or (char_length(btrim(v_profile.city)) < 2 and private.worker_remote_only_activation_ready_v1(v_profile.account_id,v_profile.skills) IS NOT TRUE)');
 END LOOP;
 v_old:=pg_get_functiondef(to_regprocedure('private.worker_need_fit_v1(uuid,uuid,boolean)'));
 v_anchor:='  IF EXISTS(SELECT 1 FROM private.taxonomy_match_scope_control_v1 ctl';
 IF strpos(v_old,v_anchor)=0 THEN RAISE EXCEPTION 'R08_REMOTE_MATCH_OWNER_DRIFT'; END IF;
 -- Cityless ACTIVE must never enter legacy skills fallback before binding,
 -- including while the legacy scope control flag is OFF.
 EXECUTE replace(v_old,v_anchor,
  '  IF char_length(btrim(coalesce(p.city,'''')))<2 OR EXISTS(SELECT 1 FROM private.taxonomy_match_scope_control_v1 ctl');
END; $patch$;
-- PATCH ENDS.
COMMIT;
