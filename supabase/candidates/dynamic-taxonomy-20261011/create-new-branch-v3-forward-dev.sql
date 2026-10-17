-- SOURCE ONLY, NOT DEPLOYED. CREATE_NEW_BRANCH under an existing execution scope.
-- Requires client decoder/UI parity, disposable PG proof and an exact revert.
-- This package has no PROPOSE_RESTRUCTURE write authority.
BEGIN;
DO $preflight$
BEGIN
 IF md5(pg_get_functiondef('public.rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)'::regprocedure))<>'4e2312e450d223bc1243614208f90c07' THEN RAISE EXCEPTION 'ROOT_BRANCH_BASE_DRIFT'; END IF;
 IF md5(pg_get_functiondef('private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'::regprocedure))<>'675545ef79a4d3f2f08b442c1469872a' THEN RAISE EXCEPTION 'ROOT_BRANCH_BASE_DRIFT'; END IF;
 IF md5(pg_get_functiondef('public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)'::regprocedure))<>'6b2a423c594785c346be1bcf7b9f6eed' THEN RAISE EXCEPTION 'ROOT_BRANCH_BASE_DRIFT'; END IF;
 IF md5(pg_get_functiondef('public.rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)'::regprocedure))<>'8f2f2f6b62b0815a708dbdffc37e3a22' THEN RAISE EXCEPTION 'ROOT_BRANCH_BASE_DRIFT'; END IF;
 IF md5(pg_get_functiondef('public.rpc_taxonomy_bind_reviewed_need_service(uuid,uuid,uuid,uuid,integer)'::regprocedure))<>'07c5e95717e7da195c661c9412ff3fad' THEN RAISE EXCEPTION 'ROOT_BRANCH_BASE_DRIFT'; END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_capture_gemini_turn_hints_service(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_turn_id uuid, p_attempt_id uuid, p_purpose text, p_catalog_version bigint, p_proposals jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_source text;v_digest text;v_existing private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE;
 v_row jsonb;v_count integer;v_seen text[]:=ARRAY[]::text[];v_normalized text;
BEGIN
 -- Definer privileges alone are not authorization; require the actual JWT role.
 IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_DENIED' USING errcode='42501';
 END IF;
 IF p_account_id IS NULL OR p_conversation_id IS NULL OR
    p_client_request_id IS NULL OR p_turn_id IS NULL OR p_attempt_id IS NULL OR
    p_purpose NOT IN ('WORKER_CAPABILITY','NEED_SERVICE') OR
    coalesce(p_catalog_version,0) < 1 OR
    jsonb_typeof(p_proposals) IS DISTINCT FROM 'array' OR
    pg_column_size(p_proposals)>18000 THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_INVALID' USING errcode='22023';
 END IF;
 v_count:=jsonb_array_length(p_proposals);
 IF (p_purpose='WORKER_CAPABILITY' AND v_count NOT BETWEEN 1 AND 24)
    OR (p_purpose='NEED_SERVICE' AND v_count NOT BETWEEN 1 AND 6) THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_INVALID' USING errcode='22023';
 END IF;
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_proposals) LOOP
   IF jsonb_typeof(v_row)<>'object'
      OR NOT (v_row ?& array['service','mode','action','categoryId','parentId','proposedPath','reason','catalogVersion'])
      OR (SELECT count(*) FROM jsonb_object_keys(v_row)) <> 8
      OR jsonb_typeof(v_row->'service') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'reason') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'mode') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'action') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'categoryId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'parentId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'catalogVersion') IS DISTINCT FROM 'number'
      OR char_length(btrim(v_row->>'service')) NOT BETWEEN 3 AND 120
      OR char_length(btrim(v_row->>'reason')) NOT BETWEEN 10 AND 1000
      OR v_row->>'mode' NOT IN ('REMOTE','ON_SITE')
      OR v_row->>'action' NOT IN ('REUSE_EXISTING','CREATE_CHILD','CREATE_NEW_BRANCH')
      OR (v_row->>'catalogVersion')::bigint IS DISTINCT FROM p_catalog_version
      OR jsonb_typeof(v_row->'proposedPath')<>'array'
      OR jsonb_array_length(v_row->'proposedPath')>6
      OR (v_row->>'action'='REUSE_EXISTING' AND
          (v_row->>'categoryId' IS NULL OR v_row->>'categoryId'=''
           OR v_row->>'parentId'<>'' OR jsonb_array_length(v_row->'proposedPath')<>0))
      OR (v_row->>'action'='CREATE_CHILD' AND
          (v_row->>'categoryId'<>'' OR v_row->>'parentId' IS NULL
           OR v_row->>'parentId'='' OR jsonb_array_length(v_row->'proposedPath')<1))
      OR (v_row->>'action'='CREATE_NEW_BRANCH' AND
          (v_row->>'categoryId'<>'' OR v_row->>'parentId'<>''
           OR jsonb_array_length(v_row->'proposedPath')<1))
   THEN RAISE EXCEPTION 'TAXONOMY_CAPTURE_PLAN_INVALID' USING errcode='22023'; END IF;
   -- Identity duplicates cannot be used to smuggle another mode/service.
   -- The canonical normalizer collapses Serbian Cyrillic/Latin variants.
   v_normalized:=private.taxonomy_normalize_v1(v_row->>'service');
   IF p_purpose='WORKER_CAPABILITY' THEN v_normalized:=v_normalized||'|'||(v_row->>'mode'); END IF;
   IF v_normalized IS NULL OR char_length(v_normalized)<3 OR v_normalized=ANY(v_seen) THEN
     RAISE EXCEPTION 'TAXONOMY_CAPTURE_DUPLICATE_OR_INVALID_SERVICE' USING errcode='22023';
   END IF;
   v_seen:=array_append(v_seen,v_normalized);
 END LOOP;

 -- Only a DURABLY COMPLETED turn with the exact owner/attempt identity
 -- can produce a hint. A claimed/failed/cancelled or forged turn cannot.
 IF p_purpose='WORKER_CAPABILITY' THEN
   SELECT encode(extensions.digest(
     convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex')
   INTO v_source
   FROM private.worker_ai_turns t
   JOIN private.worker_ai_sessions s
     ON s.account_id=t.account_id AND s.conversation_id=t.conversation_id
   WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id
     AND t.client_request_id=p_client_request_id
     AND t.turn_id=p_turn_id AND t.attempt_id=p_attempt_id
     AND t.state='SUCCEEDED';
 ELSE
   SELECT encode(extensions.digest(private.ai_task_review_source(c.id)::text,'sha256'),'hex')
   INTO v_source
   FROM private.ai_need_turn_commands t
   JOIN public.ai_conversations c ON c.id=t.conversation_id
   WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id
     AND t.client_request_id=p_client_request_id
     AND t.turn_id=p_turn_id AND t.attempt_id=p_attempt_id
     AND t.state='SUCCEEDED' AND c.account_id=p_account_id
     AND c.purpose='NEED_INTAKE';
 END IF;
 IF v_source IS NULL THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_TURN_UNCONFIRMED' USING errcode='42501';
 END IF;
 -- A succeeded LLM turn is NOT proof that any named service is in the current
 -- worker profile. The candidate's saved skills must contain every proposed
 -- service now, including after a later correction/removal in the same turn.
 -- A partial set is permitted as an untrusted hint, but the eventual owner
 -- review will refuse READY unless it covers ALL current services.
 IF p_purpose='WORKER_CAPABILITY' AND EXISTS(
    SELECT 1 FROM jsonb_array_elements(p_proposals) proposal(value)
    WHERE NOT EXISTS(
      SELECT 1 FROM private.worker_ai_sessions s,
        LATERAL jsonb_array_elements_text(s.candidate->'skills') offered(skill)
      WHERE s.account_id=p_account_id AND s.conversation_id=p_conversation_id
        AND private.taxonomy_normalize_v1(offered.skill)=
            private.taxonomy_normalize_v1(proposal.value->>'service')
    )
 ) THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_WORKER_SERVICE_NOT_OFFERED' USING errcode='22023';
 END IF;
 v_digest:=encode(extensions.digest(p_proposals::text,'sha256'),'hex');
 INSERT INTO private.work_taxonomy_gemini_turn_hints_v1(
   purpose,account_id,conversation_id,client_request_id,turn_id,attempt_id,
   source_fingerprint,catalog_version,proposals,payload_digest)
 VALUES(p_purpose,p_account_id,p_conversation_id,p_client_request_id,
   p_turn_id,p_attempt_id,v_source,p_catalog_version,p_proposals,v_digest)
 ON CONFLICT(purpose,account_id,turn_id) DO NOTHING;
 SELECT * INTO v_existing FROM private.work_taxonomy_gemini_turn_hints_v1
   WHERE purpose=p_purpose AND account_id=p_account_id AND turn_id=p_turn_id;
 IF NOT FOUND OR v_existing.client_request_id<>p_client_request_id
   OR v_existing.attempt_id<>p_attempt_id
   OR v_existing.conversation_id<>p_conversation_id
   OR v_existing.source_fingerprint<>v_source
   OR v_existing.catalog_version<>p_catalog_version
   OR v_existing.payload_digest<>v_digest
   OR v_existing.proposals IS DISTINCT FROM p_proposals THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_REPLAY_CONFLICT' USING errcode='22023';
 END IF;
 RETURN jsonb_build_object('action','HINT_CAPTURED','authority','NONE');
END $function$;

CREATE OR REPLACE FUNCTION private.taxonomy_review_candidate_projection_v2(p_purpose text, p_services jsonb, p_service_modes jsonb, p_owner_account_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_exact jsonb;v_one jsonb;v_hint private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE;
 v_source text;v_version bigint;v_fingerprint text;v_item jsonb;v_proposal jsonb;
 v_service text;v_mode text;v_key text;v_parent uuid;v_parent_label text;
 v_matches integer;v_path jsonb;v_label text;v_step integer;
 v_plans jsonb:='[]'::jsonb;v_visible jsonb:='[]'::jsonb;
BEGIN
 IF p_owner_account_id IS NULL OR p_conversation_id IS NULL
   OR p_owner_account_id IS DISTINCT FROM auth.uid() THEN
   RAISE EXCEPTION 'TAXONOMY_REVIEW_OWNER_MISMATCH' USING errcode='42501';
 END IF;
 -- The existing projection validates the complete service/mode selection and
 -- returns the trusted exact/alias plan when the entire request already maps.
 v_exact:=private.taxonomy_review_exact_projection_v1(
   p_purpose,p_services,p_service_modes);
 IF v_exact->>'status'<>'PENDING_CLASSIFICATION' THEN RETURN v_exact; END IF;
 SELECT catalog_version INTO v_version FROM private.work_taxonomy_control
   WHERE singleton=true;
 v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
 IF v_version IS NULL OR v_fingerprint IS NULL THEN RETURN v_exact; END IF;
 IF p_purpose='WORKER_CAPABILITY' THEN
   SELECT encode(extensions.digest(
     convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),
     'sha256'),'hex') INTO v_source
   FROM private.worker_ai_sessions s
   WHERE s.account_id=p_owner_account_id AND s.conversation_id=p_conversation_id;
 ELSE
   SELECT encode(extensions.digest(private.ai_task_review_source(c.id)::text,
     'sha256'),'hex') INTO v_source
   FROM public.ai_conversations c
   WHERE c.account_id=p_owner_account_id AND c.id=p_conversation_id
     AND c.purpose='NEED_INTAKE';
 END IF;
 IF v_source IS NULL THEN RETURN v_exact; END IF;
 SELECT * INTO v_hint FROM private.work_taxonomy_gemini_turn_hints_v1 h
   WHERE h.purpose=p_purpose AND h.account_id=p_owner_account_id
     AND h.conversation_id=p_conversation_id
     AND h.source_fingerprint=v_source AND h.catalog_version=v_version
   ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN v_exact; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_service_modes) LOOP
   v_mode:=v_item->>'mode';
   v_key:=private.taxonomy_normalize_v1(v_item->>'service');
   SELECT x.value#>>'{}' INTO v_service FROM jsonb_array_elements(p_services) x(value)
     WHERE private.taxonomy_normalize_v1(x.value#>>'{}')=v_key LIMIT 1;
   v_visible:=v_visible||jsonb_build_array(jsonb_build_object(
     'service',v_service,'mode',v_mode));
   v_one:=private.taxonomy_review_exact_projection_v1(p_purpose,
     jsonb_build_array(v_service),jsonb_build_array(
       jsonb_build_object('service',v_service,'mode',v_mode)));
   IF v_one->>'status'='READY' THEN
     v_plans:=v_plans||jsonb_build_array(v_one#>'{classificationCandidates,0}');
     CONTINUE;
   END IF;
   IF v_one->>'status'<>'PENDING_CLASSIFICATION' THEN RETURN v_exact; END IF;
   SELECT count(*),(jsonb_agg(p.value))->0 INTO v_matches,v_proposal
     FROM jsonb_array_elements(v_hint.proposals) p(value)
     WHERE private.taxonomy_normalize_v1(p.value->>'service')=v_key
       AND p.value->>'mode'=v_mode;
   IF v_matches<>1 OR v_proposal->>'action' NOT IN ('CREATE_CHILD','CREATE_NEW_BRANCH')
      OR v_proposal->>'categoryId'<>''
      OR (v_proposal->>'catalogVersion')::bigint<>v_version
      OR (v_proposal->>'action'='CREATE_CHILD' AND (v_proposal->>'parentId') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
      OR (v_proposal->>'action'='CREATE_NEW_BRANCH' AND v_proposal->>'parentId'<>'')
   THEN RETURN v_exact; END IF;
   v_path:=v_proposal->'proposedPath';
   IF jsonb_typeof(v_path)<>'array' OR jsonb_array_length(v_path) NOT BETWEEN 1 AND 6
      OR private.taxonomy_normalize_v1(v_path->>(jsonb_array_length(v_path)-1))<>v_key
      OR char_length(btrim(v_proposal->>'reason')) NOT BETWEEN 10 AND 1000
   THEN RETURN v_exact; END IF;
   -- Store the exact owner-reviewed wording as the leaf. The model may have
   -- used another Serbian script, but it cannot change the visible meaning.
   v_path:=jsonb_set(v_path,ARRAY[(jsonb_array_length(v_path)-1)::text],
     to_jsonb(v_service),false);
   IF v_proposal->>'action'='CREATE_CHILD' THEN
     v_parent:=(v_proposal->>'parentId')::uuid;
     SELECT c.label INTO v_parent_label FROM private.work_taxonomy_categories c
       JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
       WHERE c.id=v_parent AND c.state='ESTABLISHED'
         AND m.execution_scope=v_mode;
     IF v_parent_label IS NULL THEN RETURN v_exact; END IF;
   ELSE
     v_parent:=NULL;v_parent_label:=NULL;
     IF EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.canonical_key=private.taxonomy_normalize_v1(v_path->>0))
     THEN RETURN v_exact; END IF;
   END IF;
   FOR v_step IN 0..jsonb_array_length(v_path)-1 LOOP
     v_label:=btrim(v_path->>v_step);
     IF char_length(v_label) NOT BETWEEN 3 AND 120
        OR v_label ~ '[<>{}\\]' OR v_label ~ '[[:cntrl:]]'
        OR private.taxonomy_risk_triage_v1(v_label) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
        OR char_length(private.taxonomy_normalize_v1(v_label)) NOT BETWEEN 3 AND 160
        OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
          WHERE a.normalized_key=private.taxonomy_normalize_v1(v_label))
     THEN RETURN v_exact; END IF;
   END LOOP;
   v_plans:=v_plans||jsonb_build_array(jsonb_build_object(
     'action',v_proposal->>'action','service',v_service,'mode',v_mode,
     'parentId',v_parent,'parentLabel',v_parent_label,'path',v_path,
     'reason',v_proposal->>'reason','catalogVersion',v_version));
 END LOOP;
 -- The batch writer checks the same fingerprint under a catalog row lock.
 -- Here it protects the owner from accepting a mixed-version review.
 IF v_version IS DISTINCT FROM (SELECT catalog_version
      FROM private.work_taxonomy_control WHERE singleton=true)
    OR v_fingerprint IS DISTINCT FROM private.taxonomy_admission_fingerprint_v1()
 THEN RETURN v_exact; END IF;
 RETURN jsonb_build_object('status','READY','classificationCandidates',v_plans,
   'reviewedServiceModes',CASE WHEN p_purpose='WORKER_CAPABILITY'
     THEN v_visible ELSE '[]'::jsonb END,
   'visibleServices',v_visible,'classificationCatalogVersion',v_version,
   'classificationCatalogFingerprint',v_fingerprint);
END $function$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_commit_reviewed_batch_service(p_owner_account_id uuid, p_request_key uuid, p_purpose text, p_source_review_id uuid, p_plans jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_id uuid;v_old private.work_taxonomy_review_batches_v1%ROWTYPE;
 v_review jsonb;v_review_digest text;v_computed_digest text;
 v_expiry timestamptz;v_saved_at timestamptz;v_review_fingerprint text;
 v_version bigint;v_review_version bigint;v_fingerprint text;v_plans_digest text;
 v_plan jsonb;v_service text;v_mode text;v_action text;
 v_parent uuid;v_category uuid;v_canonical uuid;v_current_parent uuid;
 v_label text;v_key text;v_ref text;v_count integer;v_created integer:=0;
 v_index integer;v_step integer;v_duplicate text;
 v_seen_services text[]:=ARRAY[]::text[];
 v_seen_targets text[]:=ARRAY[]::text[];
 v_bound boolean;v_visible_mode boolean;v_found boolean;
 v_items jsonb:='[]'::jsonb;v_result jsonb;
BEGIN
 IF p_owner_account_id IS NULL OR p_request_key IS NULL OR p_source_review_id IS NULL
    OR p_purpose NOT IN ('WORKER_CAPABILITY','NEED_SERVICE')
    OR jsonb_typeof(p_plans)<>'array'
    OR (p_purpose='WORKER_CAPABILITY' AND jsonb_array_length(p_plans) NOT BETWEEN 1 AND 24)
    OR (p_purpose='NEED_SERVICE' AND jsonb_array_length(p_plans)<>1)
    OR pg_column_size(p_plans)>16000
 THEN RAISE EXCEPTION 'BATCH_INPUT_INVALID' USING errcode='22023'; END IF;
 v_plans_digest:=encode(extensions.digest(convert_to(p_plans::text,'UTF8'),'sha256'),'hex');

 -- A replay returns its ORIGINAL receipt even if later unrelated catalog writes
 -- changed the control version. Reuse of a key for another user review fails.
 SELECT * INTO v_old FROM private.work_taxonomy_review_batches_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key FOR UPDATE;
 IF FOUND THEN
  IF v_old.purpose<>p_purpose OR v_old.source_review_id<>p_source_review_id
    OR v_old.plans_digest<>v_plans_digest OR v_old.plans IS DISTINCT FROM p_plans
  THEN RAISE EXCEPTION 'BATCH_REQUEST_KEY_REUSED' USING errcode='22023'; END IF;
  RETURN v_old.result;
 END IF;

 IF p_purpose='WORKER_CAPABILITY' THEN
  SELECT w.envelope,w.envelope->>'displayedContentDigest',w.expires_at,
   encode(extensions.digest(((w.envelope-'displayedContentDigest')
     ||jsonb_build_object('baseHash',w.base_hash))::text,'sha256'),'hex')
    INTO v_review,v_review_digest,v_expiry,v_computed_digest
   FROM private.worker_ai_reviews w
   WHERE w.id=p_source_review_id AND w.account_id=p_owner_account_id FOR SHARE;
  SELECT min(s.created_at) INTO v_saved_at FROM private.worker_ai_saves s
    WHERE s.review_id=p_source_review_id AND s.account_id=p_owner_account_id
      AND s.client_request_id=p_request_key;
  v_bound:=v_saved_at IS NOT NULL;
 ELSE
  SELECT t.envelope,t.envelope->>'displayedContentDigest',t.expires_at,
   encode(extensions.digest(jsonb_build_object('envelope',
     t.envelope-'displayedContentDigest','policy',t.policy_binding)::text,'sha256'),'hex')
    INTO v_review,v_review_digest,v_expiry,v_computed_digest
   FROM private.ai_task_reviews t
   WHERE t.id=p_source_review_id AND t.account_id=p_owner_account_id FOR SHARE;
  SELECT min(c.created_at) INTO v_saved_at FROM private.ai_task_review_commands c
    WHERE c.review_id=p_source_review_id AND c.account_id=p_owner_account_id
      AND c.client_request_id=p_request_key
      AND c.state IN ('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED');
  v_bound:=v_saved_at IS NOT NULL;
 END IF;
 IF NOT coalesce(v_bound,false) THEN
  RAISE EXCEPTION 'BATCH_EXISTING_USER_SAVE_REQUIRED' USING errcode='42501'; END IF;
 -- Approval must have happened WHILE the review was valid.
 -- Outbox retries may run later; expiring the review AFTER a successful human
 -- Save/Accept must not silently discard a confirmed service.
 IF v_review IS NULL OR v_review->'canAccept' IS DISTINCT FROM 'true'::jsonb
    OR v_saved_at>v_expiry OR v_review_digest IS NULL
    OR v_review_digest !~ '^[0-9a-f]{64}$'
    OR v_computed_digest IS DISTINCT FROM v_review_digest
    OR v_review->'classificationCandidates' IS DISTINCT FROM p_plans
 THEN RAISE EXCEPTION 'BATCH_REVIEW_NOT_BOUND' USING errcode='42501'; END IF;
 v_review_fingerprint:=v_review->>'classificationCatalogFingerprint';
 IF v_review_fingerprint IS NULL OR
    v_review_fingerprint !~ '^[0-9a-f]{32}$' THEN
   RAISE EXCEPTION 'BATCH_CATALOG_FINGERPRINT_REQUIRED' USING errcode='42501'; END IF;

 -- Single serialized admission pass: intermediate catalog bumps do NOT make
 -- later items in the SAME reviewed batch stale.
 SELECT catalog_version INTO v_version FROM private.work_taxonomy_control
  WHERE singleton FOR UPDATE;
 IF v_version IS NULL THEN RAISE EXCEPTION 'BATCH_CATALOG_MISSING'; END IF;
 v_review_version:=v_version;
 v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
 IF v_fingerprint<>v_review_fingerprint THEN
  RAISE EXCEPTION 'BATCH_STALE_CATALOG' USING errcode='40001'; END IF;
 FOR v_index IN 0..jsonb_array_length(p_plans)-1 LOOP
  v_plan:=p_plans->v_index;
  IF jsonb_typeof(v_plan)<>'object'
     OR v_plan ?& array['action','service','mode','catalogVersion','reason'] IS NOT TRUE
     OR jsonb_typeof(v_plan->'catalogVersion')<>'number'
     OR (v_plan->>'catalogVersion')::bigint<> (v_review->>'classificationCatalogVersion')::bigint
     OR (v_plan->>'catalogVersion')::bigint<>v_review_version
     OR jsonb_typeof(v_plan->'reason')<>'string'
     OR char_length(btrim(v_plan->>'reason')) NOT BETWEEN 10 AND 1000
  THEN RAISE EXCEPTION 'BATCH_INVALID_OR_STALE_PLAN' USING errcode='22023'; END IF;
  v_service:=btrim(v_plan->>'service');
  v_mode:=v_plan->>'mode';
  v_action:=v_plan->>'action';
  IF char_length(v_service) NOT BETWEEN 3 AND 120 OR
     v_mode NOT IN ('ON_SITE','REMOTE') OR
     v_action NOT IN ('REUSE_EXISTING','CREATE_CHILD','CREATE_NEW_BRANCH')
  THEN RAISE EXCEPTION 'BATCH_SCOPE_OR_SERVICE_INVALID' USING errcode='22023'; END IF;
  v_key:=private.taxonomy_normalize_v1(v_service);
  v_duplicate:=v_key||'|'||v_mode;
  IF v_duplicate=ANY(v_seen_services) THEN
   RAISE EXCEPTION 'BATCH_DUPLICATE_SERVICE' USING errcode='22023'; END IF;
  v_seen_services:=array_append(v_seen_services,v_duplicate);

  -- Require the service to be a HUMAN-REVIEWED meaning in the existing
  -- profile/need content. A model may not add undeclared worker skills.
  IF p_purpose='WORKER_CAPABILITY' THEN
    v_found:=EXISTS(SELECT 1 FROM jsonb_array_elements_text(
       coalesce(v_review#>'{profile,skills}','[]'::jsonb)) x(service)
       WHERE private.taxonomy_normalize_v1(x.service)=v_key);
    v_visible_mode:=EXISTS(SELECT 1 FROM jsonb_array_elements(
      coalesce(v_review->'reviewedServiceModes','[]'::jsonb)) x(item)
       WHERE private.taxonomy_normalize_v1(x.item->>'service')=v_key
         AND x.item->>'mode'=v_mode);
  ELSE
    v_found:=EXISTS(SELECT 1 FROM jsonb_array_elements(
       coalesce(v_review->'publicProjection','[]'::jsonb)) x(fact)
       WHERE x.fact->>'key'='need.category'
         AND private.taxonomy_normalize_v1(x.fact->>'value')=v_key);
    v_visible_mode:=(CASE v_review#>>'{location,geography,mode}'
      WHEN 'REMOTE' THEN 'REMOTE'
      WHEN 'STATIONARY' THEN 'ON_SITE'
      WHEN 'POINT_TO_POINT' THEN 'ON_SITE'
      WHEN 'AREA_BASED' THEN 'ON_SITE'
      ELSE 'UNCONFIRMED' END)=v_mode;
  END IF;
  IF NOT coalesce(v_found,false) OR NOT coalesce(v_visible_mode,false)
   THEN RAISE EXCEPTION 'BATCH_SERVICE_OR_MODE_NOT_REVIEWED' USING errcode='42501'; END IF;

  IF v_action='REUSE_EXISTING' THEN
   IF (v_plan->>'categoryId') IS NULL OR
      v_plan ? 'parentId' OR v_plan ? 'path' THEN
    RAISE EXCEPTION 'BATCH_REUSE_STRUCTURE_INVALID' USING errcode='22023'; END IF;
   v_category:=(v_plan->>'categoryId')::uuid;
   PERFORM 1 FROM private.work_taxonomy_categories c
    JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
    WHERE c.id=v_category AND c.state='ESTABLISHED'
      AND m.execution_scope=v_mode;
   IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_CATEGORY_OR_MODE_MISSING' USING errcode='22023'; END IF;
   -- A model-provided existing ID cannot change the actual meaning of
   -- a human-reviewed service. Only a canonical name or STORED alias qualifies.
   IF NOT EXISTS (
     SELECT 1 FROM private.work_taxonomy_categories c
     WHERE c.id=v_category AND c.state='ESTABLISHED'
       AND (c.canonical_key=v_key OR EXISTS (
         SELECT 1 FROM private.work_taxonomy_aliases a
         WHERE a.category_id=c.id AND a.normalized_key=v_key))
   ) THEN
     RAISE EXCEPTION 'BATCH_SEMANTIC_IDENTITY_MISMATCH' USING errcode='42501';
   END IF;
  ELSE
   IF v_plan ? 'categoryId' OR jsonb_typeof(v_plan->'path')<>'array'
      OR jsonb_array_length(v_plan->'path') NOT BETWEEN 1 AND 6
      OR (v_action='CREATE_CHILD' AND (v_plan->>'parentId') IS NULL)
      OR (v_action='CREATE_NEW_BRANCH' AND
          (v_plan->'parentId' IS DISTINCT FROM 'null'::jsonb
           OR v_plan->'parentLabel' IS DISTINCT FROM 'null'::jsonb)) THEN
    RAISE EXCEPTION 'BATCH_CHILD_STRUCTURE_INVALID' USING errcode='22023'; END IF;
   -- A newly created leaf must be exactly the reviewed human service meaning.
   IF private.taxonomy_normalize_v1(v_plan->'path'->>(jsonb_array_length(v_plan->'path')-1))
       <>private.taxonomy_normalize_v1(v_service) THEN
      RAISE EXCEPTION 'BATCH_SERVICE_LEAF_MISMATCH' USING errcode='42501'; END IF;
   IF v_action='CREATE_CHILD' THEN
     v_parent:=(v_plan->>'parentId')::uuid;
     PERFORM 1 FROM private.work_taxonomy_categories c
      JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
      WHERE c.id=v_parent AND c.state='ESTABLISHED'
        AND m.execution_scope=v_mode;
     IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_PARENT_OR_MODE_MISSING' USING errcode='22023'; END IF;
   ELSE
     v_parent:=NULL;
   END IF;
   FOR v_step IN 0..jsonb_array_length(v_plan->'path')-1 LOOP
    v_label:=btrim(v_plan->'path'->>v_step);
    IF char_length(v_label) NOT BETWEEN 3 AND 120 OR
       v_label ~ '[<>{}\\]' OR v_label ~ '[[:cntrl:]]' OR
       private.taxonomy_risk_triage_v1(v_label) IN ('BLOCKED','REVIEW_REQUIRED')
    THEN RAISE EXCEPTION 'BATCH_UNSAFE_CATEGORY' USING errcode='42501'; END IF;
    IF v_step=jsonb_array_length(v_plan->'path')-1 AND
       private.taxonomy_risk_triage_v1(v_label)<>'LOW_RISK_CANDIDATE'
    THEN RAISE EXCEPTION 'BATCH_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
    v_key:=private.taxonomy_normalize_v1(v_label);
    IF char_length(v_key) NOT BETWEEN 3 AND 160 OR
       EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
          WHERE a.normalized_key=v_key)
    THEN RAISE EXCEPTION 'BATCH_ALIAS_OR_KEY_COLLISION' USING errcode='22023'; END IF;
    v_category:=NULL;v_current_parent:=NULL;
    SELECT c.id,c.parent_id INTO v_category,v_current_parent
      FROM private.work_taxonomy_categories c WHERE c.canonical_key=v_key
      FOR UPDATE;
    IF FOUND THEN
     IF v_current_parent IS DISTINCT FROM v_parent OR NOT EXISTS(
       SELECT 1 FROM private.work_taxonomy_category_modes
       WHERE category_id=v_category AND execution_scope=v_mode)
     THEN RAISE EXCEPTION 'BATCH_SEMANTIC_OR_MODE_COLLISION' USING errcode='22023'; END IF;
    ELSE
     UPDATE private.work_taxonomy_control
      SET catalog_version=catalog_version+1,updated_at=statement_timestamp()
      WHERE singleton RETURNING catalog_version INTO v_version;
     INSERT INTO private.work_taxonomy_categories
       (canonical_key,label,parent_id,state,source,catalog_version)
     VALUES(v_key,v_label,v_parent,'ESTABLISHED','AI_REVIEWED',v_version)
      RETURNING id INTO v_category;
     INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
      VALUES(v_category,v_mode,'REVIEWED_BATCH_V1');
     INSERT INTO private.work_taxonomy_audit
      (action,category_id,normalized_key,catalog_version,source_ref)
      VALUES('AUTO_CREATED',v_category,v_key,v_version,
        'REVIEWED_BATCH_V1:'||p_request_key::text);
     v_created:=v_created+1;
    END IF;
    v_parent:=v_category;
   END LOOP;
  END IF;
  v_ref:=v_category::text||'|'||v_mode;
  IF v_ref=ANY(v_seen_targets) THEN
    RAISE EXCEPTION 'BATCH_DUPLICATE_CANONICAL_ID' USING errcode='22023'; END IF;
  v_seen_targets:=array_append(v_seen_targets,v_ref);
  v_items:=v_items||jsonb_build_array(jsonb_build_object(
    'service',v_service,'mode',v_mode,'categoryId',v_category));
 END LOOP;
 -- All category changes and ONE receipt share the same DB transaction.
 v_result:=jsonb_build_object('status','COMMITTED','items',v_items,
  'createdCount',v_created,'catalogVersion',v_version,
  'capabilityAuthority','NONE','needRevisionAuthority','NONE',
  'notificationAuthority','NONE','requiresBinding',true);
 INSERT INTO private.work_taxonomy_review_batches_v1
 (owner_account_id,request_key,purpose,source_review_id,review_digest,
  plans_digest,plans,catalog_version,result)
 VALUES(p_owner_account_id,p_request_key,p_purpose,p_source_review_id,
  v_review_digest,v_plans_digest,p_plans,v_version,v_result);
 RETURN v_result;
END $function$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_bind_reviewed_worker_service(p_owner_account_id uuid, p_request_key uuid, p_source_review_id uuid, p_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_existing private.work_taxonomy_worker_bindings_v1%ROWTYPE;
 v_batch private.work_taxonomy_review_batches_v1%ROWTYPE;
 v_review private.worker_ai_reviews%ROWTYPE;
 v_save private.worker_ai_saves%ROWTYPE;
 v_profile public.app_profiles%ROWTYPE;
 v_digest text;v_item jsonb;v_plan jsonb;v_category uuid;
 v_key text;v_mode text;v_seen text[]:=ARRAY[]::text[];
 v_modes text[]:=ARRAY[]::text[];v_onsite boolean:=false;v_remote boolean:=false;
 v_result jsonb;v_count integer:=0;v_skills jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'WORKER_BINDER_SERVICE_ROLE_REQUIRED' USING errcode='42501';
 END IF;
 IF p_owner_account_id IS NULL OR p_request_key IS NULL
   OR p_source_review_id IS NULL OR p_profile_id IS NULL THEN
  RAISE EXCEPTION 'WORKER_BINDER_INPUT_INVALID' USING errcode='22023';
 END IF;
 -- Replays are read-only and bound to the very same worker/review/request.
 SELECT * INTO v_existing FROM private.work_taxonomy_worker_bindings_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key FOR UPDATE;
 IF FOUND THEN
  IF v_existing.source_review_id<>p_source_review_id OR v_existing.profile_id<>p_profile_id
  THEN RAISE EXCEPTION 'WORKER_BINDER_REQUEST_KEY_REUSED' USING errcode='22023'; END IF;
  RETURN v_existing.result;
 END IF;
 SELECT * INTO v_batch FROM private.work_taxonomy_review_batches_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key
   AND source_review_id=p_source_review_id AND purpose='WORKER_CAPABILITY'
  FOR SHARE;
 IF NOT FOUND OR v_batch.result->>'status'<>'COMMITTED'
   OR v_batch.result->'requiresBinding' IS DISTINCT FROM 'true'::jsonb
   OR v_batch.result->'capabilityAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR v_batch.result->'notificationAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR jsonb_typeof(v_batch.plans)<>'array'
   OR jsonb_typeof(v_batch.result->'items')<>'array'
   OR jsonb_array_length(v_batch.plans) NOT BETWEEN 1 AND 24
   OR jsonb_array_length(v_batch.result->'items')<>jsonb_array_length(v_batch.plans)
 THEN RAISE EXCEPTION 'WORKER_BINDER_ADMISSION_NOT_COMMITTED' USING errcode='42501'; END IF;
 SELECT * INTO v_review FROM private.worker_ai_reviews
  WHERE id=p_source_review_id AND account_id=p_owner_account_id FOR SHARE;
 IF NOT FOUND OR v_review.envelope->>'classificationState'<>'READY'
   OR v_review.envelope->>'displayedContentDigest' IS DISTINCT FROM v_batch.review_digest
   OR v_review.envelope->'classificationCandidates' IS DISTINCT FROM v_batch.plans
   OR v_review.envelope->'canAccept' IS DISTINCT FROM 'true'::jsonb
   OR jsonb_typeof(v_review.envelope->'reviewedServiceModes')<>'array'
   OR jsonb_array_length(v_review.envelope->'reviewedServiceModes')
       <>jsonb_array_length(v_batch.plans)
   OR v_review.envelope->>'profileId' IS DISTINCT FROM p_profile_id::text
 THEN RAISE EXCEPTION 'WORKER_BINDER_REVIEW_NOT_BOUND' USING errcode='42501'; END IF;
 v_digest:=encode(extensions.digest(
  ((v_review.envelope-'displayedContentDigest')
    ||jsonb_build_object('baseHash',v_review.base_hash))::text,'sha256'),'hex');
 IF v_digest IS DISTINCT FROM v_batch.review_digest THEN
   RAISE EXCEPTION 'WORKER_BINDER_REVIEW_DIGEST_INVALID' USING errcode='42501'; END IF;
 SELECT * INTO v_save FROM private.worker_ai_saves
  WHERE review_id=p_source_review_id AND account_id=p_owner_account_id
    AND client_request_id=p_request_key FOR SHARE;
 IF NOT FOUND OR v_save.created_at>v_review.expires_at
   OR v_save.receipt->'saved' IS DISTINCT FROM 'true'::jsonb
   OR v_save.receipt->>'profileId' IS DISTINCT FROM p_profile_id::text
   OR v_save.receipt->>'profileStatus'<>'ACTIVE'
 THEN RAISE EXCEPTION 'WORKER_BINDER_SAVE_OR_ACTIVATION_REQUIRED' USING errcode='42501'; END IF;
 -- A delayed outbox command from an OLD Save must never re-enable modes
 -- superseded by a newer user-confirmed worker review for this same profile.
 IF EXISTS(SELECT 1 FROM private.worker_ai_saves newer
   WHERE newer.account_id=p_owner_account_id
     AND newer.created_at>v_save.created_at
     AND newer.receipt->>'profileId'=p_profile_id::text)
 THEN RAISE EXCEPTION 'WORKER_BINDER_NEWER_SAVE_EXISTS' USING errcode='PT409'; END IF;
 -- Hold current worker profile throughout the transaction. Reject any edit
 -- after the reviewed Save, even if the new skill text happens to be identical.
 SELECT * INTO v_profile FROM public.app_profiles
  WHERE id=p_profile_id AND account_id=p_owner_account_id AND kind='WORKER'
  FOR UPDATE;
 v_skills:=v_review.envelope#>'{profile,skills}';
 IF NOT FOUND OR v_profile.profile_status<>'ACTIVE'
   OR v_profile.updated_at>v_save.created_at
   OR jsonb_typeof(v_skills)<>'array'
   OR to_jsonb(v_profile.skills) IS DISTINCT FROM v_skills
 THEN RAISE EXCEPTION 'WORKER_BINDER_CURRENT_PROFILE_REQUIRED' USING errcode='PT409'; END IF;
 -- Make every scope and category EXACT. A related branch never certifies ability.
 FOR v_count IN 0..jsonb_array_length(v_batch.plans)-1 LOOP
   v_plan:=v_batch.plans->v_count;
   v_item:=v_batch.result->'items'->v_count;
   v_key:=private.taxonomy_normalize_v1(v_item->>'service');
   v_mode:=v_item->>'mode';
   IF v_plan->>'mode' IS DISTINCT FROM v_mode
     OR private.taxonomy_normalize_v1(v_plan->>'service') IS DISTINCT FROM v_key
     OR v_plan->>'action' NOT IN ('REUSE_EXISTING','CREATE_CHILD','CREATE_NEW_BRANCH')
     OR v_mode NOT IN ('ON_SITE','REMOTE')
     OR jsonb_typeof(v_item->'categoryId')<>'string'
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_skills) offered(value)
       WHERE private.taxonomy_normalize_v1(offered.value#>>'{}')=v_key)
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(
        v_review.envelope->'reviewedServiceModes') m(value)
       WHERE private.taxonomy_normalize_v1(m.value->>'service')=v_key
         AND m.value->>'mode'=v_mode)
     OR v_key||'|'||v_mode=ANY(v_seen)
   THEN RAISE EXCEPTION 'WORKER_BINDER_SERVICE_OR_MODE_NOT_REVIEWED' USING errcode='42501'; END IF;
   v_seen:=array_append(v_seen,v_key||'|'||v_mode);
   v_category:=(v_item->>'categoryId')::uuid;
   IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
      JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
      WHERE c.id=v_category AND c.state='ESTABLISHED'
        AND cm.execution_scope=v_mode
        AND (c.canonical_key=v_key OR EXISTS(
          SELECT 1 FROM private.work_taxonomy_aliases a
          WHERE a.category_id=c.id AND a.normalized_key=v_key)))
   THEN RAISE EXCEPTION 'WORKER_BINDER_CATEGORY_STALE' USING errcode='42501'; END IF;
   -- A past withdrawal (excluded=true) is NOT permanent: the owner may
   -- deliberately offer this service again in a NEW signed Save. ONLY this
   -- binder may restore it, with zero inherited related-offer consent.
   IF v_mode='ON_SITE' THEN v_onsite:=true; ELSE v_remote:=true; END IF;
 END LOOP;
 -- A recent explicit global-mode change must not be overwritten by a delayed
 -- binder from an older review. All updates below are ONE DB transaction.
 IF EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
   WHERE choice.worker_profile_id=p_profile_id AND choice.updated_at>v_save.created_at)
 THEN RAISE EXCEPTION 'WORKER_BINDER_NEWER_GLOBAL_MODE' USING errcode='PT409'; END IF;
 IF v_onsite THEN v_modes:=array_append(v_modes,'ON_SITE'); END IF;
 IF v_remote THEN v_modes:=array_append(v_modes,'REMOTE'); END IF;
 INSERT INTO private.worker_execution_mode_choices(
   worker_profile_id,worker_account_id,modes,consent_source,confirmed_at,updated_at)
 VALUES(p_profile_id,p_owner_account_id,v_modes,'EXPLICIT_PROFILE_REVIEW',
   statement_timestamp(),statement_timestamp())
 ON CONFLICT(worker_profile_id) DO UPDATE
   SET modes=excluded.modes,consent_source='EXPLICIT_PROFILE_REVIEW',
       confirmed_at=statement_timestamp(),updated_at=statement_timestamp();
 -- Catalog identities and per-service scope are granted only AFTER the
 -- signed review, saved receipt and current profile all passed.
 FOR v_count IN 0..jsonb_array_length(v_batch.plans)-1 LOOP
   v_item:=v_batch.result->'items'->v_count;
   v_category:=(v_item->>'categoryId')::uuid;v_mode:=v_item->>'mode';
   INSERT INTO private.work_taxonomy_worker_capabilities(
      worker_account_id,category_id,confirmed_at,allow_related_offers,excluded,origin)
   VALUES(p_owner_account_id,v_category,statement_timestamp(),false,false,'WORKER_CONFIRMED')
   ON CONFLICT(worker_account_id,category_id) DO UPDATE
     SET confirmed_at=statement_timestamp(),updated_at=statement_timestamp(),
         excluded=false,allow_related_offers=false,origin='WORKER_CONFIRMED';
   INSERT INTO private.taxonomy_confirmed_worker_modes_v1(
     worker_account_id,category_id,execution_scope,source_review_id,source_request_key,
     confirmed_at,active)
   VALUES(p_owner_account_id,v_category,v_mode,p_source_review_id,p_request_key,
     statement_timestamp(),true)
   ON CONFLICT(worker_account_id,category_id,execution_scope) DO UPDATE
    SET source_review_id=excluded.source_review_id,
        source_request_key=excluded.source_request_key,
        confirmed_at=statement_timestamp(),active=true;
 END LOOP;
 -- The CURRENT complete review replaces old per-service permission. Retain
 -- history, but deactivate obsolete modes; never manufacture a related opt-in.
 UPDATE private.taxonomy_confirmed_worker_modes_v1 old
 SET active=false
 WHERE old.worker_account_id=p_owner_account_id AND old.active
   AND NOT EXISTS(
     SELECT 1 FROM jsonb_array_elements(v_batch.result->'items') item(value)
     WHERE (item.value->>'categoryId')::uuid=old.category_id
       AND item.value->>'mode'=old.execution_scope);
 v_result:=jsonb_build_object('status','BOUND_WORKER_SERVICES',
   'workerProfileId',p_profile_id,'serviceModeCount',jsonb_array_length(v_batch.plans),
   'catalogVersion',v_batch.catalog_version,'dispatchAuthority','NONE',
   'notificationAuthority','NONE','relatedOfferAuthority','NONE');
 INSERT INTO private.work_taxonomy_worker_bindings_v1(
   owner_account_id,request_key,source_review_id,profile_id,catalog_version,result)
 VALUES(p_owner_account_id,p_request_key,p_source_review_id,p_profile_id,
   v_batch.catalog_version,v_result);
 RETURN v_result;
END $function$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_bind_reviewed_need_service(p_owner_account_id uuid, p_request_key uuid, p_source_review_id uuid, p_need_id uuid, p_need_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_existing private.work_taxonomy_need_bindings_v1%ROWTYPE;
 v_batch private.work_taxonomy_review_batches_v1%ROWTYPE;
 v_review private.ai_task_reviews%ROWTYPE;
 v_command private.ai_task_review_commands%ROWTYPE;
 v_need public.needs%ROWTYPE;
 v_plan jsonb;v_item jsonb;v_category uuid;v_scope text;v_service text;v_category_version bigint;
 v_expected_digest text;v_result jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
   RAISE EXCEPTION 'NEED_BINDER_SERVICE_ROLE_REQUIRED' USING errcode='42501';
 END IF;
 IF p_owner_account_id IS NULL OR p_request_key IS NULL OR p_source_review_id IS NULL
    OR p_need_id IS NULL OR coalesce(p_need_revision,0)<1 THEN
   RAISE EXCEPTION 'NEED_BINDER_INPUT_INVALID' USING errcode='22023';
 END IF;
 SELECT * INTO v_existing FROM private.work_taxonomy_need_bindings_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key FOR UPDATE;
 IF FOUND THEN
   IF v_existing.source_review_id<>p_source_review_id OR v_existing.need_id<>p_need_id
     OR v_existing.need_revision<>p_need_revision THEN
     RAISE EXCEPTION 'NEED_BINDER_REQUEST_KEY_REUSED' USING errcode='22023';
   END IF;
   RETURN v_existing.result;
 END IF;
 SELECT * INTO v_batch FROM private.work_taxonomy_review_batches_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key
    AND source_review_id=p_source_review_id AND purpose='NEED_SERVICE' FOR SHARE;
 IF NOT FOUND OR v_batch.result->>'status'<>'COMMITTED'
   OR v_batch.result->'requiresBinding' IS DISTINCT FROM 'true'::jsonb
   OR v_batch.result->'capabilityAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR v_batch.result->'notificationAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR jsonb_typeof(v_batch.result->'items')<>'array'
   OR jsonb_array_length(v_batch.result->'items')<>1 THEN
   RAISE EXCEPTION 'NEED_BINDER_ADMISSION_NOT_COMMITTED' USING errcode='42501';
 END IF;
 SELECT * INTO v_review FROM private.ai_task_reviews r
  WHERE r.id=p_source_review_id AND r.account_id=p_owner_account_id FOR SHARE;
 IF NOT FOUND OR v_review.envelope->>'classificationState'<>'READY'
   OR v_review.envelope->>'displayedContentDigest' IS DISTINCT FROM v_batch.review_digest
   OR v_review.envelope->'classificationCandidates' IS DISTINCT FROM v_batch.plans
   OR jsonb_array_length(coalesce(v_review.envelope->'classificationCandidates','[]'::jsonb))<>1 THEN
   RAISE EXCEPTION 'NEED_BINDER_REVIEW_NOT_BOUND' USING errcode='42501';
 END IF;
 v_expected_digest:=encode(extensions.digest(jsonb_build_object('envelope',
   v_review.envelope-'displayedContentDigest','policy',v_review.policy_binding)::text,'sha256'),'hex');
 IF v_expected_digest<>v_batch.review_digest THEN
   RAISE EXCEPTION 'NEED_BINDER_REVIEW_DIGEST_INVALID' USING errcode='42501';
 END IF;
 SELECT * INTO v_command FROM private.ai_task_review_commands c
  WHERE c.review_id=p_source_review_id AND c.account_id=p_owner_account_id
    AND c.client_request_id=p_request_key AND c.need_id=p_need_id
    AND c.need_revision=p_need_revision
    AND c.state IN ('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NEED_BINDER_SAVE_REQUIRED' USING errcode='42501'; END IF;
 v_plan:=v_batch.plans->0;
 v_item:=v_batch.result->'items'->0;
 IF v_plan->>'mode' IS DISTINCT FROM v_item->>'mode'
   OR private.taxonomy_normalize_v1(v_plan->>'service')
      IS DISTINCT FROM private.taxonomy_normalize_v1(v_item->>'service')
   OR v_plan->>'action' NOT IN ('REUSE_EXISTING','CREATE_CHILD','CREATE_NEW_BRANCH')
 THEN RAISE EXCEPTION 'NEED_BINDER_CATEGORY_RECEIPT_INVALID' USING errcode='42501'; END IF;
 v_category:=(v_item->>'categoryId')::uuid;
 v_category_version:=v_batch.catalog_version;
 SELECT * INTO v_need FROM public.needs n WHERE n.id=p_need_id FOR UPDATE;
 IF NOT FOUND OR v_need.requester_account_id<>p_owner_account_id OR
    v_need.revision<>p_need_revision OR v_need.status NOT IN ('DRAFT','PUBLISHED','SELECTION') THEN
   RAISE EXCEPTION 'NEED_BINDER_CURRENT_REVISION_REQUIRED' USING errcode='PT409';
 END IF;
 v_scope:=private.taxonomy_execution_scope_v1(v_need.execution_location_mode);
 IF v_scope IS NULL OR v_scope<>v_item->>'mode'
   OR private.taxonomy_normalize_v1(v_need.category)
      <>private.taxonomy_normalize_v1(v_item->>'service')
 THEN RAISE EXCEPTION 'NEED_BINDER_SERVICE_OR_MODE_STALE' USING errcode='PT409'; END IF;
 PERFORM 1 FROM private.work_taxonomy_categories c
  JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
  WHERE c.id=v_category AND c.state='ESTABLISHED' AND m.execution_scope=v_scope;
 IF NOT FOUND THEN RAISE EXCEPTION 'NEED_BINDER_CATEGORY_RETIRED' USING errcode='42501'; END IF;
 IF v_need.category_id IS NOT NULL AND v_need.category_id<>v_category THEN
   RAISE EXCEPTION 'NEED_BINDER_CONFLICTING_EXISTING_CATEGORY' USING errcode='PT409'; END IF;
 PERFORM 1 FROM private.work_taxonomy_need_snapshots s
  WHERE s.need_id=p_need_id AND s.need_revision=p_need_revision FOR UPDATE;
 IF FOUND THEN RAISE EXCEPTION 'NEED_BINDER_EXISTING_SNAPSHOT_REVIEW_REQUIRED' USING errcode='PT409'; END IF;
 -- Same transaction: category reference + single authoritative revision
 -- snapshot + durable replay receipt. A failed write rolls all three back.
 UPDATE public.needs SET category_id=v_category WHERE id=p_need_id
    AND revision=p_need_revision AND category_id IS DISTINCT FROM v_category;
 INSERT INTO private.work_taxonomy_need_snapshots
  (need_id,need_revision,category_id,catalog_version,reviewed_by_requester,
   source,classification_state,original_category)
 VALUES(p_need_id,p_need_revision,v_category,v_category_version,true,
   'OWNER_REVIEWED_BATCH','CONFIRMED',v_need.category);
 v_result:=jsonb_build_object('status','BOUND_NEED_REVISION',
   'needId',p_need_id,'needRevision',p_need_revision,'categoryId',v_category,
   'catalogVersion',v_category_version,
   'dispatchAuthority','NONE','notificationAuthority','NONE');
 INSERT INTO private.work_taxonomy_need_bindings_v1
  (owner_account_id,request_key,source_review_id,need_id,need_revision,
   category_id,catalog_version,result)
 VALUES(p_owner_account_id,p_request_key,p_source_review_id,p_need_id,
   p_need_revision,v_category,v_category_version,v_result);
 RETURN v_result;
END $function$;
COMMIT;
