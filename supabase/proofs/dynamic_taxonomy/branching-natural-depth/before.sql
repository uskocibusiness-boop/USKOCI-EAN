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
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
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
END $function$
;
REVOKE ALL ON FUNCTION private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.taxonomy_risk_triage_v1(p_label text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE v_key text;
BEGIN
 v_key:=private.taxonomy_normalize_v1(p_label);
 IF v_key='' OR char_length(v_key)<6 OR v_key !~ '^[[:alnum:]]'
    OR v_key !~ '[[:space:]]' THEN
   RETURN 'NEEDS_CLARIFICATION';
 END IF;
 IF v_key ~ '(^|[[:space:]])(ostalo|drugo|razno|sve|svasta|poslovi|usluge)($|[[:space:]])'
 THEN RETURN 'NEEDS_CLARIFICATION'; END IF;
 IF EXISTS (SELECT 1 FROM private.work_taxonomy_risk_rules
            WHERE enabled AND decision='BLOCKED' AND v_key ~ pattern)
 THEN RETURN 'BLOCKED'; END IF;
 IF EXISTS (SELECT 1 FROM private.work_taxonomy_risk_rules
            WHERE enabled AND decision='REVIEW_REQUIRED' AND v_key ~ pattern)
 THEN RETURN 'REVIEW_REQUIRED'; END IF;
 IF NOT EXISTS (SELECT 1 FROM private.work_taxonomy_risk_actions
                WHERE enabled AND v_key LIKE normalized_action||' %')
 THEN RETURN 'NEEDS_CLARIFICATION'; END IF;
 RETURN 'LOW_RISK_CANDIDATE';
END
$function$
;
REVOKE ALL ON FUNCTION private.taxonomy_risk_triage_v1(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.taxonomy_risk_triage_v1(text) TO service_role;

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
END $function$
;
REVOKE ALL ON FUNCTION rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_commit_admission_service(p_admission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE v private.work_taxonomy_admissions_v1%ROWTYPE;v_version bigint;
 v_action text;v_mode text;v_parent uuid;v_id uuid;v_label text;v_key text;
 v_existing_parent uuid;v_scope_exists boolean;v_added integer:=0;v_receipt jsonb;
 i integer;v_node_count integer;
BEGIN
 SELECT * INTO v FROM private.work_taxonomy_admissions_v1 WHERE id=p_admission_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_NOT_FOUND' USING errcode='22023'; END IF;
 IF v.status='COMMITTED' THEN RETURN v.result; END IF;
 IF v.plan_digest IS DISTINCT FROM
    encode(extensions.digest(convert_to(v.plan::text,'UTF8'),'sha256'),'hex') THEN
  RAISE EXCEPTION 'ADMISSION_PLAN_TAMPERED' USING errcode='42501'; END IF;
 IF v.status<>'APPROVED' OR v.approved_at IS NULL THEN
  RAISE EXCEPTION 'ADMISSION_OWNER_APPROVAL_REQUIRED' USING errcode='42501'; END IF;
 IF v.expires_at<=statement_timestamp() THEN RAISE EXCEPTION 'ADMISSION_EXPIRED'; END IF;
 -- Serialize admission writers. Old unsafe writers must be retired before live enable.
 SELECT catalog_version INTO v_version
  FROM private.work_taxonomy_control WHERE singleton FOR UPDATE;
 IF v_version<>v.catalog_version OR
    private.taxonomy_admission_fingerprint_v1()<>v.catalog_fingerprint THEN
  RAISE EXCEPTION 'ADMISSION_STALE_CATALOG_REPLAN' USING errcode='PT409'; END IF;
 v_action:=v.plan->>'action';v_mode:=v.plan->>'mode';
 IF v_action='REUSE_EXISTING' THEN
  v_id:=(v.plan->>'categoryId')::uuid;
  PERFORM 1 FROM private.work_taxonomy_categories c
    JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
    WHERE c.id=v_id AND c.state='ESTABLISHED' AND m.execution_scope=v_mode;
  IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_CATEGORY_CHANGED'; END IF;
 ELSE
  IF v_action<>'CREATE_CHILD' OR jsonb_typeof(v.plan->'path')<>'array' THEN
    RAISE EXCEPTION 'ADMISSION_ACTION_UNSUPPORTED'; END IF;
  v_parent:=(v.plan->>'parentId')::uuid;
  v_node_count:=jsonb_array_length(v.plan->'path');
  IF v_node_count NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'ADMISSION_PATH_INVALID'; END IF;
  PERFORM 1 FROM private.work_taxonomy_categories c
   JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
   WHERE c.id=v_parent AND c.state='ESTABLISHED' AND m.execution_scope=v_mode;
  IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_PARENT_CHANGED'; END IF;
  IF private.taxonomy_risk_triage_v1(v.plan->'path'->>(v_node_count-1))
     <> 'LOW_RISK_CANDIDATE' THEN RAISE EXCEPTION 'ADMISSION_SAFETY_REVIEW_REQUIRED'; END IF;
  FOR i IN 0..v_node_count-1 LOOP
   v_label:=btrim(v.plan->'path'->>i);
   IF char_length(v_label) NOT BETWEEN 3 AND 120
      OR v_label ~ '[<>{}\\]' OR v_label ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'ADMISSION_NODE_INVALID' USING errcode='22023'; END IF;
   IF private.taxonomy_risk_triage_v1(v_label) IN ('BLOCKED','REVIEW_REQUIRED') THEN
     RAISE EXCEPTION 'ADMISSION_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
   v_key:=private.taxonomy_normalize_v1(v_label);
   IF char_length(v_key) NOT BETWEEN 3 AND 160 THEN
      RAISE EXCEPTION 'ADMISSION_NORMALIZATION_INVALID'; END IF;
   IF EXISTS (SELECT 1 FROM private.work_taxonomy_aliases a
     WHERE a.normalized_key=v_key) THEN
     RAISE EXCEPTION 'ADMISSION_ALIAS_COLLISION_REVIEW_REQUIRED'; END IF;
   v_id:=NULL;
   SELECT c.id,c.parent_id INTO v_id,v_existing_parent
   FROM private.work_taxonomy_categories c WHERE c.canonical_key=v_key
   FOR UPDATE;
   IF FOUND THEN
    IF v_existing_parent IS DISTINCT FROM v_parent OR
       NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes
        WHERE category_id=v_id AND execution_scope=v_mode) THEN
      RAISE EXCEPTION 'ADMISSION_MEANING_OR_MODE_COLLISION_REVIEW_REQUIRED'; END IF;
   ELSE
    UPDATE private.work_taxonomy_control
      SET catalog_version=catalog_version+1,updated_at=statement_timestamp()
      WHERE singleton RETURNING catalog_version INTO v_version;
    INSERT INTO private.work_taxonomy_categories
      (canonical_key,label,parent_id,state,source,catalog_version)
    VALUES(v_key,v_label,v_parent,'ESTABLISHED','AI_REVIEWED',v_version)
    RETURNING id INTO v_id;
    INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
     VALUES(v_id,v_mode,'OWNER_APPROVED_ADMISSION_V1');
    INSERT INTO private.work_taxonomy_audit
      (action,category_id,normalized_key,catalog_version,source_ref)
    VALUES('AUTO_CREATED',v_id,v_key,v_version,'OWNER_APPROVED_ADMISSION_V1:'||v.id::text);
    v_added:=v_added+1;
   END IF;
   v_parent:=v_id;
  END LOOP;
 END IF;
 v_receipt:=jsonb_build_object('admissionId',v.id,'categoryId',v_id,
   'catalogVersion',v_version,'createdCount',v_added,'status','COMMITTED',
   'capabilityAuthority','NONE','notificationAuthority','NONE',
   'requiresPostSaveBinding',true);
 UPDATE private.work_taxonomy_admissions_v1
  SET status='COMMITTED',committed_at=statement_timestamp(),result=v_receipt
  WHERE id=v.id;
 RETURN v_receipt;
END $function$
;
REVOKE ALL ON FUNCTION rpc_taxonomy_commit_admission_service(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rpc_taxonomy_commit_admission_service(uuid) TO service_role;

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
 v_created_ids uuid[]:=ARRAY[]::uuid[];
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
  RAISE EXCEPTION 'BATCH_STALE_CATALOG' USING errcode='PT409'; END IF;
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
     IF v_current_parent IS DISTINCT FROM v_parent THEN
       RAISE EXCEPTION 'BATCH_SEMANTIC_OR_MODE_COLLISION' USING errcode='22023';
     END IF;
     IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes
       WHERE category_id=v_category AND execution_scope=v_mode) THEN
       -- Only nodes born in THIS atomic, owner-signed batch may receive a
       -- second explicitly reviewed scope. Older catalog entries remain closed.
       IF NOT (v_category=ANY(v_created_ids)) THEN
         RAISE EXCEPTION 'BATCH_SEMANTIC_OR_MODE_COLLISION' USING errcode='22023';
       END IF;
       INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
         VALUES(v_category,v_mode,'REVIEWED_BATCH_V1');
     END IF;
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
     v_created_ids:=array_append(v_created_ids,v_category);
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
END $function$
;
REVOKE ALL ON FUNCTION rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_prepare_admission_service(p_owner_account_id uuid, p_request_key uuid, p_purpose text, p_source_review_id uuid, p_plan jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE v_review_digest text;v_expiry timestamptz;v_version bigint;
 v_review_plan jsonb;v_expected_review_digest text;
 v_plan_digest text;v_id uuid;v_existing private.work_taxonomy_admissions_v1%ROWTYPE;
 v_action text;v_mode text;v_parent uuid;v_category uuid;
BEGIN
 IF p_owner_account_id IS NULL OR p_request_key IS NULL OR p_source_review_id IS NULL
 OR p_plan IS NULL OR jsonb_typeof(p_plan)<>'object'
 OR p_purpose NOT IN ('WORKER_CAPABILITY','NEED_SERVICE') THEN
  RAISE EXCEPTION 'ADMISSION_INPUT_INVALID' USING errcode='22023'; END IF;
 IF pg_column_size(p_plan)>12000 THEN RAISE EXCEPTION 'ADMISSION_PLAN_TOO_LARGE' USING errcode='22023'; END IF;
 v_action:=p_plan->>'action';v_mode:=p_plan->>'mode';
 IF v_action NOT IN ('REUSE_EXISTING','CREATE_CHILD') OR v_mode NOT IN ('ON_SITE','REMOTE')
 OR jsonb_typeof(p_plan->'catalogVersion')<>'number'
 OR jsonb_typeof(p_plan->'reason')<>'string'
 OR char_length(btrim(p_plan->>'reason')) NOT BETWEEN 10 AND 1000
 THEN RAISE EXCEPTION 'ADMISSION_PLAN_REVIEW_REQUIRED' USING errcode='22023'; END IF;
 IF p_purpose='WORKER_CAPABILITY' THEN
  SELECT w.envelope->>'displayedContentDigest',w.expires_at,
         w.envelope->'classificationProposal',
         encode(extensions.digest(
          ((w.envelope - 'displayedContentDigest') ||
           jsonb_build_object('baseHash',w.base_hash))::text,'sha256'),'hex')
    INTO v_review_digest,v_expiry,v_review_plan,v_expected_review_digest
  FROM private.worker_ai_reviews w
  WHERE w.id=p_source_review_id AND w.account_id=p_owner_account_id
    AND (w.envelope->>'canAccept')::boolean IS TRUE AND w.expires_at>statement_timestamp();
 ELSE
  SELECT t.envelope->>'displayedContentDigest',t.expires_at,
         t.envelope->'classificationProposal',
         encode(extensions.digest(
            jsonb_build_object('envelope',t.envelope - 'displayedContentDigest',
                               'policy',t.policy_binding)::text,'sha256'),'hex')
    INTO v_review_digest,v_expiry,v_review_plan,v_expected_review_digest
  FROM private.ai_task_reviews t
  WHERE t.id=p_source_review_id AND t.account_id=p_owner_account_id
    AND (t.envelope->>'canAccept')::boolean IS TRUE AND t.expires_at>statement_timestamp();
 END IF;
 -- Fail closed for legacy reviews: the classification must be part of the
 -- SAME server-owned payload that the owner actually reviewed.
 IF v_review_digest IS NULL OR v_review_digest !~ '^[0-9a-f]{64}$'
    OR v_review_plan IS NULL OR v_review_plan IS DISTINCT FROM p_plan
    OR v_review_digest IS DISTINCT FROM v_expected_review_digest THEN
  RAISE EXCEPTION 'ADMISSION_REVIEW_PLAN_NOT_DISPLAYED' USING errcode='42501';
 END IF;
 SELECT catalog_version INTO v_version FROM private.work_taxonomy_control WHERE singleton;
 IF v_version IS NULL OR (p_plan->>'catalogVersion')::bigint <> v_version THEN
  RAISE EXCEPTION 'ADMISSION_STALE_CATALOG' USING errcode='PT409'; END IF;
 IF v_action='REUSE_EXISTING' THEN
   IF (p_plan->>'categoryId') IS NULL THEN RAISE EXCEPTION 'ADMISSION_ID_REQUIRED'; END IF;
   v_category:=(p_plan->>'categoryId')::uuid;
   PERFORM 1 FROM private.work_taxonomy_categories c
    JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
    WHERE c.id=v_category AND c.state='ESTABLISHED' AND m.execution_scope=v_mode;
   IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_UNKNOWN_CATEGORY_OR_MODE'; END IF;
 ELSE
   IF jsonb_typeof(p_plan->'path')<>'array'
      OR jsonb_array_length(p_plan->'path') NOT BETWEEN 1 AND 6
      OR (p_plan->>'parentId') IS NULL THEN
    RAISE EXCEPTION 'ADMISSION_PATH_INVALID' USING errcode='22023'; END IF;
   v_parent:=(p_plan->>'parentId')::uuid;
   PERFORM 1 FROM private.work_taxonomy_categories c
     JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
     WHERE c.id=v_parent AND c.state='ESTABLISHED' AND m.execution_scope=v_mode;
   IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_UNKNOWN_PARENT_OR_MODE'; END IF;
   -- New root or subtree restructure always requires a separate operator gate.
   IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_plan->'path') t(label)
      WHERE char_length(btrim(t.label)) NOT BETWEEN 3 AND 120
        OR btrim(t.label) ~ '[<>{}\\]' OR btrim(t.label) ~ '[[:cntrl:]]')
     THEN RAISE EXCEPTION 'ADMISSION_NODE_INVALID' USING errcode='22023'; END IF;
   -- Every new level is screened; a safe leaf cannot hide an unsafe ancestor.
   IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_plan->'path') t(label)
      WHERE private.taxonomy_risk_triage_v1(t.label) IN ('BLOCKED','REVIEW_REQUIRED'))
     THEN RAISE EXCEPTION 'ADMISSION_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
   -- Server risk triage is a risk gate, NOT a semantic classifier.
   IF private.taxonomy_risk_triage_v1(p_plan->'path'->>(jsonb_array_length(p_plan->'path')-1))
      <> 'LOW_RISK_CANDIDATE'
     THEN RAISE EXCEPTION 'ADMISSION_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
 END IF;
 v_plan_digest:=encode(extensions.digest(convert_to(p_plan::text,'UTF8'),'sha256'),'hex');
 SELECT * INTO v_existing FROM private.work_taxonomy_admissions_v1
 WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key;
 IF FOUND THEN
  IF v_existing.plan_digest<>v_plan_digest OR v_existing.source_review_id<>p_source_review_id
      OR v_existing.purpose<>p_purpose THEN
   RAISE EXCEPTION 'ADMISSION_REQUEST_REUSED' USING errcode='22023'; END IF;
  RETURN jsonb_build_object('admissionId',v_existing.id,'planDigest',v_existing.plan_digest,
    'status',v_existing.status,'catalogVersion',v_existing.catalog_version);
 END IF;
 INSERT INTO private.work_taxonomy_admissions_v1
 (owner_account_id,request_key,purpose,source_review_id,source_review_digest,plan,
  plan_digest,catalog_version,catalog_fingerprint,expires_at)
 VALUES(p_owner_account_id,p_request_key,p_purpose,p_source_review_id,v_review_digest,p_plan,
 v_plan_digest,v_version,private.taxonomy_admission_fingerprint_v1(),
 least(v_expiry,statement_timestamp()+interval '30 minutes'))
 RETURNING id INTO v_id;
 RETURN jsonb_build_object('admissionId',v_id,'planDigest',v_plan_digest,
  'status','PENDING','catalogVersion',v_version);
END $function$
;
REVOKE ALL ON FUNCTION rpc_taxonomy_prepare_admission_service(uuid,uuid,text,uuid,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rpc_taxonomy_prepare_admission_service(uuid,uuid,text,uuid,jsonb) TO service_role;
