-- SOURCE ONLY: not a DEV migration or promotion package.
-- Exact resolver/batch preimages and unchanged binder/projection are captured
-- in worker_shared_reuse_20261109.preimage.json. No owner/ACL/readiness changes.
DO $guard$ BEGIN RAISE EXCEPTION 'LOCAL_ONLY_WORKER_SHARED_REUSE'; END $guard$;
-- WORKER_SHARED_REUSE_ISOLATED_START
CREATE OR REPLACE FUNCTION private.taxonomy_review_exact_projection_v1(p_purpose text, p_services jsonb, p_service_modes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_version bigint;v_fingerprint text;v_after text;v_version_after bigint;
 v_item jsonb;v_service text;v_mode text;v_key text;v_identity text;
 v_services text[]:=ARRAY[]::text[];v_modes text[]:=ARRAY[]::text[];
 v_refs text[]:=ARRAY[]::text[];v_plan jsonb;v_results jsonb:='[]'::jsonb;
 v_visible jsonb:='[]'::jsonb;v_reviewed_modes jsonb:='[]'::jsonb;
 v_category uuid;v_matches integer;v_idx integer;v_service_key text;v_scope_count integer;
 v_status text:='READY';
BEGIN
 IF p_purpose IS NULL OR p_purpose NOT IN ('WORKER_CAPABILITY','NEED_SERVICE')
    OR jsonb_typeof(p_services) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_services) NOT BETWEEN 1 AND 12
    OR jsonb_typeof(p_service_modes) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_service_modes) NOT BETWEEN 1 AND 24
    OR pg_column_size(p_services)>4000 OR pg_column_size(p_service_modes)>8000 THEN
   v_status:='REVIEW_REQUIRED';
 ELSE
   FOR v_item IN SELECT value FROM jsonb_array_elements(p_services) LOOP
     IF jsonb_typeof(v_item) <> 'string'
       OR char_length(btrim(v_item#>>'{}')) NOT BETWEEN 3 AND 120
       OR v_item#>>'{}' ~ '[[:cntrl:]<>]' THEN
       v_status:='REVIEW_REQUIRED';EXIT;
     END IF;
     v_key:=private.taxonomy_normalize_v1(v_item#>>'{}');
     IF v_key=ANY(v_services) OR char_length(v_key) NOT BETWEEN 3 AND 160 THEN
       v_status:='REVIEW_REQUIRED';EXIT;
     END IF;
     v_services:=array_append(v_services,v_key);
   END LOOP;
   IF p_purpose='NEED_SERVICE' AND jsonb_array_length(p_services)<>1 THEN
     v_status:='REVIEW_REQUIRED';
   END IF;
 END IF;
 IF v_status='READY' THEN
   FOR v_item IN SELECT value FROM jsonb_array_elements(p_service_modes) LOOP
     IF jsonb_typeof(v_item)<>'object'
       OR NOT(v_item ?& array['service','mode'])
       OR (SELECT count(*) FROM jsonb_object_keys(v_item))<>2
       OR jsonb_typeof(v_item->'service')<>'string'
       OR jsonb_typeof(v_item->'mode')<>'string'
       OR (v_item->>'mode') NOT IN('ON_SITE','REMOTE') THEN
       v_status:='REVIEW_REQUIRED';EXIT;
     END IF;
     v_key:=private.taxonomy_normalize_v1(v_item->>'service');
     v_mode:=v_item->>'mode';
     v_identity:=v_key||'|'||v_mode;
     IF NOT(v_key=ANY(v_services)) OR v_identity=ANY(v_modes) THEN
       v_status:='REVIEW_REQUIRED';EXIT;
     END IF;
     v_modes:=array_append(v_modes,v_identity);
     v_service:=(
       SELECT x.value#>>'{}' FROM jsonb_array_elements(p_services) AS x(value)
       WHERE private.taxonomy_normalize_v1(x.value#>>'{}')=v_key LIMIT 1);
     v_visible:=v_visible||jsonb_build_array(
       jsonb_build_object('service',v_service,'mode',v_mode));
   END LOOP;
   IF p_purpose='NEED_SERVICE' AND jsonb_array_length(v_visible)<>1 THEN
     v_status:='REVIEW_REQUIRED';
   END IF;
   IF EXISTS (SELECT 1 FROM unnest(v_services) AS s(value)
       WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_visible) AS m(value)
        WHERE private.taxonomy_normalize_v1(m.value->>'service')=s.value)) THEN
     v_status:='SERVICE_MODE_CONFIRMATION_REQUIRED';
   END IF;
 END IF;
 IF v_status='READY' THEN
   SELECT catalog_version INTO v_version
     FROM private.work_taxonomy_control WHERE singleton=true;
   v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
   IF v_version IS NULL OR v_fingerprint IS NULL THEN v_status:='CATALOG_UNAVAILABLE'; END IF;
 END IF;
 IF v_status='READY' THEN
   FOR v_item IN SELECT value FROM jsonb_array_elements(v_visible) LOOP
     v_service:=v_item->>'service';
     v_mode:=v_item->>'mode';
     v_key:=private.taxonomy_normalize_v1(v_service);
     -- Only the server's established canonical identity / stored aliases.
     -- Any semantic relation, parent or AI confidence is NOT an identity.
     SELECT count(DISTINCT c.id),min(c.id::text)::uuid INTO v_matches,v_category
       FROM private.work_taxonomy_categories c
       JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
       WHERE c.state='ESTABLISHED' AND m.execution_scope=v_mode
         AND (c.canonical_key=v_key OR EXISTS(
           SELECT 1 FROM private.work_taxonomy_aliases a
           WHERE a.category_id=c.id AND a.normalized_key=v_key));
     IF v_matches<>1 THEN v_status:='PENDING_CLASSIFICATION';EXIT; END IF;
     v_identity:=v_category::text||'|'||v_mode;
     IF v_identity=ANY(v_refs) THEN
       -- Multiple distinct human offers may resolve to one existing worker
       -- capability. Keep each original label, with independent risk checks.
       -- Literal duplicates were already rejected in v_services/v_modes.
       IF p_purpose IS DISTINCT FROM 'WORKER_CAPABILITY'
         OR private.taxonomy_risk_triage_v1(v_service) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
         OR NOT private.taxonomy_category_path_valid_v1(v_category)
         OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
           WHERE c.id=v_category AND c.state='ESTABLISHED'
             AND private.taxonomy_risk_triage_v1(c.label)='LOW_RISK_CANDIDATE'
             AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
               WHERE child.parent_id=c.id AND child.state='ESTABLISHED'))
         OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_results) previous(plan)
           WHERE previous.plan->>'categoryId'=v_category::text AND previous.plan->>'mode'=v_mode
             AND private.taxonomy_risk_triage_v1(previous.plan->>'service')
                 IS DISTINCT FROM 'LOW_RISK_CANDIDATE')
       THEN v_status:='REVIEW_REQUIRED';EXIT; END IF;
     END IF;
     v_refs:=array_append(v_refs,v_identity);
     v_plan:=jsonb_build_object(
       'action','REUSE_EXISTING','service',v_service,'mode',v_mode,
       'categoryId',v_category,'catalogVersion',v_version,
       'reason','Verified existing canonical identity or registered server alias');
     v_results:=v_results||jsonb_build_array(v_plan);
   END LOOP;
 END IF;
 IF v_status='READY' THEN
   SELECT catalog_version INTO v_version_after FROM private.work_taxonomy_control WHERE singleton=true;
   v_after:=private.taxonomy_admission_fingerprint_v1();
   IF v_version IS DISTINCT FROM v_version_after OR v_fingerprint IS DISTINCT FROM v_after THEN
     v_status:='STALE_CATALOG';
   END IF;
 END IF;
 IF v_status<>'READY' THEN
   -- An incomplete projection cannot produce a half-authoritative subset.
   RETURN jsonb_build_object('status',v_status,'classificationCandidates','[]'::jsonb,
     'reviewedServiceModes','[]'::jsonb,'visibleServices','[]'::jsonb,
     'classificationCatalogVersion',NULL,'classificationCatalogFingerprint',NULL);
 END IF;
 IF p_purpose='WORKER_CAPABILITY' THEN v_reviewed_modes:=v_visible; END IF;
 RETURN jsonb_build_object('status','READY','classificationCandidates',v_results,
   'reviewedServiceModes',v_reviewed_modes,'visibleServices',v_visible,
   'classificationCatalogVersion',v_version,
   'classificationCatalogFingerprint',v_fingerprint);
END $function$
;

CREATE OR REPLACE FUNCTION private.taxonomy_resolve_turn_catalog_v1(p_hint_id uuid, p_input_digest text, p_anchors jsonb, p_safety text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE h private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE;
 p jsonb;a jsonb;item jsonb;items jsonb:='[]'::jsonb;result jsonb;
 c private.work_taxonomy_categories%ROWTYPE;anchor_id uuid;parent uuid;category uuid;
 version bigint;label text;key text;mode text;action text;identity text;reason text;
 i integer;j integer;matches integer;last_step integer;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'TURN_CATALOG_DENIED' USING errcode='42501'; END IF;
 SELECT * INTO h FROM private.work_taxonomy_gemini_turn_hints_v1 WHERE id=p_hint_id FOR UPDATE;
 IF NOT FOUND OR p_input_digest IS NULL OR p_input_digest !~ '^[0-9a-f]{64}$'
 OR jsonb_typeof(p_anchors) IS DISTINCT FROM 'array' OR jsonb_array_length(p_anchors)>384 THEN
  RAISE EXCEPTION 'TURN_CATALOG_INVALID' USING errcode='22023'; END IF;
 PERFORM private.closure_assert_open(h.account_id);
 IF h.catalog_resolution IS NOT NULL THEN
  IF h.catalog_resolution->>'inputDigest' IS DISTINCT FROM p_input_digest THEN
   RAISE EXCEPTION 'TURN_CATALOG_REPLAY_CONFLICT' USING errcode='22023'; END IF;
  RETURN h.catalog_resolution;
 END IF;
 -- Missing business details can still produce a useful conversation, but a
 -- safety clarification cannot become a global catalog mutation.
 IF p_safety IS DISTINCT FROM 'ALLOW' THEN
  result:=jsonb_build_object('state','DEFERRED','inputDigest',p_input_digest,'code','SAFETY_UNRESOLVED');
 ELSE
  BEGIN
   SELECT catalog_version INTO version FROM private.work_taxonomy_control WHERE singleton FOR UPDATE;
   IF version IS NULL OR version<h.catalog_version THEN
    RAISE EXCEPTION 'CATALOG_CHANGED' USING errcode='PT409'; END IF;
   -- Anchors are derived by Edge from its verified snapshot, not the model.
   FOR a IN SELECT value FROM jsonb_array_elements(p_anchors) LOOP
    IF jsonb_typeof(a) IS DISTINCT FROM 'object' OR NOT(a ?& array['categoryId','label','parentId'])
    OR a-array['categoryId','label','parentId']<>'{}'::jsonb THEN
     RAISE EXCEPTION 'TURN_CATALOG_INVALID_ANCHOR' USING errcode='22023'; END IF;
    IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories node
     WHERE node.id::text=a->>'categoryId' AND node.state='ESTABLISHED'
      AND to_jsonb(node.label)=a->'label'
      AND coalesce(to_jsonb(node.parent_id),'null'::jsonb)=a->'parentId'
      AND private.taxonomy_turn_category_identity_v1(node.id) IS NOT NULL) THEN
     RAISE EXCEPTION 'CATALOG_CHANGED' USING errcode='PT409'; END IF;
   END LOOP;
   FOR i IN 0..jsonb_array_length(h.proposals)-1 LOOP
    p:=h.proposals->i;mode:=p->>'mode';action:=p->>'action';
    key:=private.taxonomy_normalize_v1(p->>'service');
    IF private.taxonomy_risk_triage_v1(p->>'service') IS DISTINCT FROM 'LOW_RISK_CANDIDATE' THEN
     RAISE EXCEPTION 'CATALOG_SAFETY' USING errcode='PT409'; END IF;
    anchor_id:=CASE WHEN action IN('REUSE_EXISTING','EXTEND_MODE') THEN (p->>'categoryId')::uuid
      WHEN action='CREATE_CHILD' THEN (p->>'parentId')::uuid END;
    IF anchor_id IS NOT NULL THEN
     SELECT count(*) INTO matches FROM jsonb_array_elements(p_anchors) x
      WHERE x->>'categoryId'=anchor_id::text;
     IF matches<>1 THEN RAISE EXCEPTION 'TURN_CATALOG_ANCHOR_MISSING' USING errcode='22023'; END IF;
    END IF;
    IF action IN('REUSE_EXISTING','EXTEND_MODE') THEN
     category:=anchor_id;
     SELECT * INTO c FROM private.work_taxonomy_categories WHERE id=category AND state='ESTABLISHED';
     IF NOT FOUND OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
       WHERE child.parent_id=c.id AND child.state='ESTABLISHED') THEN
      RAISE EXCEPTION 'CATALOG_CHANGED' USING errcode='PT409'; END IF;
     IF private.taxonomy_risk_triage_v1(c.label) IS DISTINCT FROM 'LOW_RISK_CANDIDATE' THEN
      RAISE EXCEPTION 'CATALOG_SAFETY' USING errcode='PT409'; END IF;
     -- A natural synonym need not be stored as a global alias. An explicit
     -- conflicting canonical identity is not permission to merge two services.
     IF EXISTS(SELECT 1 FROM private.work_taxonomy_categories other WHERE other.state<>'RETIRED'
       AND other.id<>category AND (other.canonical_key=key OR EXISTS(
        SELECT 1 FROM private.work_taxonomy_aliases alias WHERE alias.category_id=other.id AND alias.normalized_key=key))) THEN
      RAISE EXCEPTION 'CATALOG_CONFLICT' USING errcode='PT409'; END IF;
     IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes m
       WHERE m.category_id=category AND m.execution_scope=mode) THEN
      IF action<>'EXTEND_MODE' THEN RAISE EXCEPTION 'MODE_UNRESOLVED' USING errcode='PT409'; END IF;
      UPDATE private.work_taxonomy_control SET catalog_version=catalog_version+1,updated_at=statement_timestamp()
       WHERE singleton RETURNING catalog_version INTO version;
      INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
       VALUES(category,mode,'TURN_CATALOG_V1');
      INSERT INTO private.work_taxonomy_audit(action,category_id,normalized_key,catalog_version,source_ref)
       VALUES('CORRECTED',category,c.canonical_key,version,'TURN_CATALOG_V1:'||h.id::text);
     END IF;
    ELSIF action IN('CREATE_CHILD','CREATE_NEW_BRANCH') THEN
     parent:=anchor_id;last_step:=jsonb_array_length(p->'proposedPath')-1;
     IF last_step NOT BETWEEN 0 AND 11 OR private.taxonomy_normalize_v1(p->'proposedPath'->>last_step) IS DISTINCT FROM key THEN
      RAISE EXCEPTION 'TURN_CATALOG_INVALID_PATH' USING errcode='22023'; END IF;
     FOR j IN 0..last_step LOOP
      label:=btrim(p->'proposedPath'->>j);key:=private.taxonomy_normalize_v1(label);
      IF jsonb_typeof(p->'proposedPath'->j) IS DISTINCT FROM 'string'
       OR char_length(label) NOT BETWEEN 3 AND 120 OR label ~ '[<>{}\\]' OR label ~ '[[:cntrl:]]'
       OR char_length(key) NOT BETWEEN 3 AND 160 OR key !~ '[[:alpha:]]'
       OR private.taxonomy_risk_triage_v1(label) IN('BLOCKED','REVIEW_REQUIRED')
       OR (j=last_step AND private.taxonomy_risk_triage_v1(label) IS DISTINCT FROM 'LOW_RISK_CANDIDATE') THEN
       RAISE EXCEPTION 'CATALOG_SAFETY' USING errcode='PT409'; END IF;
      IF EXISTS(SELECT 1 FROM private.work_taxonomy_aliases alias WHERE alias.normalized_key=key) THEN
       RAISE EXCEPTION 'CATALOG_CONFLICT' USING errcode='PT409'; END IF;
      SELECT * INTO c FROM private.work_taxonomy_categories WHERE canonical_key=key FOR UPDATE;
      IF FOUND THEN
       IF c.state<>'ESTABLISHED' OR c.parent_id IS DISTINCT FROM parent THEN
        RAISE EXCEPTION 'CATALOG_CONFLICT' USING errcode='PT409'; END IF;
       category:=c.id;
       IF j=last_step AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes m
         WHERE m.category_id=category AND m.execution_scope=mode) THEN
        -- BOTH within this turn, or a concurrent creation after the snapshot.
        -- An older known category needs the explicit EXTEND_MODE action.
        IF c.catalog_version<=h.catalog_version THEN
         RAISE EXCEPTION 'MODE_UNRESOLVED' USING errcode='PT409'; END IF;
        UPDATE private.work_taxonomy_control SET catalog_version=catalog_version+1,updated_at=statement_timestamp()
         WHERE singleton RETURNING catalog_version INTO version;
        INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
         VALUES(category,mode,'TURN_CATALOG_V1');
        INSERT INTO private.work_taxonomy_audit(action,category_id,normalized_key,catalog_version,source_ref)
         VALUES('CORRECTED',category,key,version,'TURN_CATALOG_V1:'||h.id::text);
       END IF;
      ELSE
       UPDATE private.work_taxonomy_control SET catalog_version=catalog_version+1,updated_at=statement_timestamp()
        WHERE singleton RETURNING catalog_version INTO version;
       INSERT INTO private.work_taxonomy_categories(canonical_key,label,parent_id,state,source,catalog_version)
        VALUES(key,label,parent,'ESTABLISHED','AI_REVIEWED',version) RETURNING id INTO category;
       INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
        VALUES(category,mode,'TURN_CATALOG_V1');
       INSERT INTO private.work_taxonomy_audit(action,category_id,normalized_key,catalog_version,source_ref)
        VALUES('AUTO_CREATED',category,key,version,'TURN_CATALOG_V1:'||h.id::text);
      END IF;
      parent:=category;
     END LOOP;
    ELSE RAISE EXCEPTION 'TURN_CATALOG_INVALID_ACTION' USING errcode='22023'; END IF;
    IF EXISTS(SELECT 1 FROM private.work_taxonomy_categories child WHERE child.parent_id=category AND child.state='ESTABLISHED') THEN
     RAISE EXCEPTION 'CATALOG_CONFLICT' USING errcode='PT409'; END IF;
    FOR j IN 0..jsonb_array_length(items)-1 LOOP
     item:=items->j;
     IF (private.taxonomy_normalize_v1(h.proposals->j->>'service')=private.taxonomy_normalize_v1(p->>'service')
          AND item->>'categoryId'<>category::text)
       OR (item->>'categoryId'=category::text AND h.proposals->j->>'mode'=mode
         AND NOT (
          -- Distinct reviewed offers may share one existing worker capability.
          -- Every original label has already passed independent risk triage.
          h.purpose IS NOT DISTINCT FROM 'WORKER_CAPABILITY'
          AND action IS NOT DISTINCT FROM 'REUSE_EXISTING'
          AND h.proposals->j->>'action' IS NOT DISTINCT FROM 'REUSE_EXISTING'
          AND private.taxonomy_normalize_v1(h.proposals->j->>'service')
              IS DISTINCT FROM private.taxonomy_normalize_v1(p->>'service')
          AND h.proposals->j->'handoff' IS NOT DISTINCT FROM p->'handoff'
         )) THEN
      RAISE EXCEPTION 'CATALOG_CONFLICT' USING errcode='PT409'; END IF;
    END LOOP;
    identity:=private.taxonomy_turn_category_identity_v1(category);
    IF identity IS NULL THEN RAISE EXCEPTION 'CATALOG_CHANGED' USING errcode='PT409'; END IF;
    items:=items||jsonb_build_array(jsonb_build_object('categoryId',category,'identity',identity));
   END LOOP;
   -- A later path in this same response must not turn an earlier service into
   -- a grouping node. Roll the entire catalog batch back on that conflict.
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(items) x JOIN private.work_taxonomy_categories child
      ON child.parent_id=(x->>'categoryId')::uuid AND child.state='ESTABLISHED') THEN
    RAISE EXCEPTION 'CATALOG_CONFLICT' USING errcode='PT409'; END IF;
   result:=jsonb_build_object('state','RESOLVED','inputDigest',p_input_digest,'catalogVersion',version,'items',items);
  EXCEPTION WHEN SQLSTATE 'PT409' THEN
   GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
   IF reason NOT IN('CATALOG_CHANGED','CATALOG_CONFLICT','CATALOG_SAFETY','MODE_UNRESOLVED') THEN RAISE; END IF;
   -- This subtransaction rolls back every catalog write, but keeps the owned
   -- dialogue and captured decision. Never spend another Gemini call here.
   result:=jsonb_build_object('state','DEFERRED','inputDigest',p_input_digest,'code',reason);
  END;
 END IF;
 UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET catalog_resolution=result WHERE id=h.id;
 RETURN result;
END $function$
;

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
 v_catalog_changed boolean;
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
 PERFORM private.closure_assert_open(p_owner_account_id);
 IF p_owner_account_id IS NULL OR p_request_key IS NULL OR p_source_review_id IS NULL
    OR p_purpose NOT IN ('WORKER_CAPABILITY','NEED_SERVICE')
    OR jsonb_typeof(p_plans)<>'array'
    OR (p_purpose='WORKER_CAPABILITY' AND jsonb_array_length(p_plans) NOT BETWEEN 1 AND 24)
    OR (p_purpose='NEED_SERVICE' AND jsonb_array_length(p_plans)<>1)
    OR pg_column_size(p_plans)>16000
 THEN RAISE EXCEPTION 'BATCH_INPUT_INVALID' USING errcode='22023'; END IF;
 v_plans_digest:=encode(extensions.digest(convert_to(p_plans::text,'UTF8'),'sha256'),'hex');

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
 -- The immutable signed plan keeps its original version. A successful Save
 -- remains authority after an unrelated catalog write, but every identity,
 -- mode and path below must still validate against the locked CURRENT catalog.
 -- Never rewrite the review, its fingerprint or the reviewed semantic plan.
 IF jsonb_typeof(v_review->'classificationCatalogVersion') IS DISTINCT FROM 'number' THEN
   RAISE EXCEPTION 'BATCH_REVIEW_CATALOG_VERSION_INVALID' USING errcode='42501'; END IF;
 v_review_version:=(v_review->>'classificationCatalogVersion')::bigint;
 v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
 IF v_review_version<1 OR v_version<v_review_version OR v_fingerprint IS NULL THEN
   RAISE EXCEPTION 'BATCH_STALE_CATALOG' USING errcode='PT409'; END IF;
 v_catalog_changed:=v_fingerprint IS DISTINCT FROM v_review_fingerprint
   OR v_version IS DISTINCT FROM v_review_version;
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
     v_action NOT IN ('REUSE_EXISTING','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH')
  THEN RAISE EXCEPTION 'BATCH_SCOPE_OR_SERVICE_INVALID' USING errcode='22023'; END IF;
  IF v_plan?'handoff' AND (v_mode<>'REMOTE'
     OR NOT private.taxonomy_handoff_valid_v1(v_plan->'handoff')) THEN
    RAISE EXCEPTION 'BATCH_HANDOFF_INVALID' USING errcode='22023'; END IF;
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
      WHEN 'MULTI_STOP' THEN 'ON_SITE'
      WHEN 'AREA_BASED' THEN 'ON_SITE'
      ELSE 'UNCONFIRMED' END)=v_mode;
  END IF;
  IF NOT coalesce(v_found,false) OR NOT coalesce(v_visible_mode,false)
   THEN RAISE EXCEPTION 'BATCH_SERVICE_OR_MODE_NOT_REVIEWED' USING errcode='42501'; END IF;

  IF v_action IN ('REUSE_EXISTING','EXTEND_MODE') THEN
   IF (v_plan->>'categoryId') IS NULL OR
      v_plan ? 'parentId' OR v_plan ? 'path' THEN
    RAISE EXCEPTION 'BATCH_REUSE_STRUCTURE_INVALID' USING errcode='22023'; END IF;
   v_category:=(v_plan->>'categoryId')::uuid;
   PERFORM 1 FROM private.work_taxonomy_categories c
    WHERE c.id=v_category AND c.state='ESTABLISHED'
      AND (v_action='EXTEND_MODE' OR EXISTS(
        SELECT 1 FROM private.work_taxonomy_category_modes m
        WHERE m.category_id=c.id AND m.execution_scope=v_mode));
   IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_CATEGORY_OR_MODE_MISSING' USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '22023' END; END IF;

   SELECT count(DISTINCT c.id),min(c.id::text)::uuid INTO v_count,v_canonical
     FROM private.work_taxonomy_categories c
     WHERE c.state<>'RETIRED' AND (c.canonical_key=v_key OR EXISTS (
       SELECT 1 FROM private.work_taxonomy_aliases a
       WHERE a.category_id=c.id AND a.normalized_key=v_key));

   IF v_action = 'REUSE_EXISTING' AND (v_plan ? 'categoryLabel' OR v_plan ? 'categoryParentId') THEN
     IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.id = v_category
         AND (NOT v_plan ? 'categoryLabel' OR c.label IS NOT DISTINCT FROM v_plan->>'categoryLabel')
         AND (NOT v_plan ? 'categoryParentId' OR coalesce(to_jsonb(c.parent_id),'null'::jsonb) IS NOT DISTINCT FROM v_plan->'categoryParentId')
         AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
           WHERE child.parent_id = c.id AND child.state = 'ESTABLISHED')
     ) THEN
       RAISE EXCEPTION 'BATCH_CATEGORY_IDENTITY_CHANGED' USING errcode='PT409';
     END IF;
   END IF;

   IF v_count = 1 AND v_canonical = v_category THEN
     NULL;
   ELSIF v_action IN ('REUSE_EXISTING', 'EXTEND_MODE') AND v_count = 0 THEN
     -- Human-reviewed semantic synonym reuse or mode extension of an established leaf.
     -- Verified through safety triage and valid category path.
     -- Logged in audit as EXISTING_REUSED without creating a global alias.
     IF jsonb_typeof(v_plan->'categoryLabel') IS DISTINCT FROM 'string'
       OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
         WHERE c.id = v_category
           AND c.label IS NOT DISTINCT FROM v_plan->>'categoryLabel'
           AND (NOT v_plan ? 'categoryParentId' OR coalesce(to_jsonb(c.parent_id),'null'::jsonb) IS NOT DISTINCT FROM v_plan->'categoryParentId')
           AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
             WHERE child.parent_id = c.id AND child.state = 'ESTABLISHED')
       ) THEN
       RAISE EXCEPTION 'BATCH_CATEGORY_IDENTITY_CHANGED' USING errcode='PT409';
     END IF;
     IF private.taxonomy_risk_triage_v1(v_service) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
       OR private.taxonomy_risk_triage_v1(v_plan->>'categoryLabel') IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
       OR NOT private.taxonomy_category_path_valid_v1(v_category) THEN
       RAISE EXCEPTION 'BATCH_SEMANTIC_SAFETY_REVIEW_REQUIRED' USING errcode='42501';
     END IF;
     IF v_action = 'REUSE_EXISTING' THEN
       INSERT INTO private.work_taxonomy_audit(action,category_id,normalized_key,catalog_version,source_ref)
         VALUES('EXISTING_REUSED',v_category,v_key,v_version,'REVIEWED_BATCH:'||p_request_key::text);
     END IF;
   ELSE
     RAISE EXCEPTION 'BATCH_SEMANTIC_IDENTITY_MISMATCH'
       USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '42501' END;
   END IF;

   IF v_action='EXTEND_MODE' THEN
     IF jsonb_typeof(v_plan->'categoryLabel') IS DISTINCT FROM 'string'
       OR NOT(v_plan?'categoryParentId')
       OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
         WHERE c.id=v_category AND c.label IS NOT DISTINCT FROM v_plan->>'categoryLabel'
           AND coalesce(to_jsonb(c.parent_id),'null'::jsonb) IS NOT DISTINCT FROM v_plan->'categoryParentId')
       OR NOT private.taxonomy_category_path_valid_v1(v_category) THEN
       RAISE EXCEPTION 'BATCH_EXTENSION_IDENTITY_CHANGED' USING errcode='PT409'; END IF;
     -- SQL screens risk and signed identity; it does not prove physical
     -- feasibility. The captured AI reason + visible owner review are retained.
     IF private.taxonomy_risk_triage_v1(v_service) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
       OR private.taxonomy_risk_triage_v1(v_plan->>'categoryLabel') IS DISTINCT FROM 'LOW_RISK_CANDIDATE' THEN
       RAISE EXCEPTION 'BATCH_EXTENSION_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
     IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes
       WHERE category_id=v_category AND execution_scope=v_mode) THEN
       UPDATE private.work_taxonomy_control
         SET catalog_version=catalog_version+1,updated_at=statement_timestamp()
         WHERE singleton RETURNING catalog_version INTO v_version;
       INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
         VALUES(v_category,v_mode,'REVIEWED_MODE_EXTENSION_V1');
       INSERT INTO private.work_taxonomy_audit(action,category_id,normalized_key,catalog_version,source_ref)
         VALUES('CORRECTED',v_category,private.taxonomy_normalize_v1(v_plan->>'categoryLabel'),v_version,
           'REVIEWED_MODE_EXTENSION_V1:'||p_request_key::text);
     ELSIF NOT v_catalog_changed THEN
       RAISE EXCEPTION 'BATCH_EXTENSION_MODE_ALREADY_PRESENT' USING errcode='22023';
     END IF;
   END IF;
  ELSE
   IF v_plan ? 'categoryId' OR jsonb_typeof(v_plan->'path')<>'array'
      OR jsonb_array_length(v_plan->'path')<1
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
      WHERE c.id=v_parent AND c.state='ESTABLISHED'
        AND private.taxonomy_category_path_valid_v1(c.id);
     IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_PARENT_OR_MODE_MISSING'
       USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '22023' END; END IF;
     -- The signed parent label anchors the reviewed organization as well as UUID.
     IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.id=v_parent AND c.label IS NOT DISTINCT FROM v_plan->>'parentLabel') THEN
       RAISE EXCEPTION 'BATCH_PARENT_IDENTITY_CHANGED' USING errcode='PT409'; END IF;
   ELSE
     v_parent:=NULL;
   END IF;
   FOR v_step IN 0..jsonb_array_length(v_plan->'path')-1 LOOP
    v_label:=btrim(v_plan->'path'->>v_step);
    IF jsonb_typeof(v_plan->'path'->v_step) IS DISTINCT FROM 'string' OR
       char_length(v_label) NOT BETWEEN 3 AND 120 OR
       v_label ~ '[<>{}\\]' OR v_label ~ '[[:cntrl:]]' OR
       private.taxonomy_risk_triage_v1(v_label) IN ('BLOCKED','REVIEW_REQUIRED')
    THEN RAISE EXCEPTION 'BATCH_UNSAFE_CATEGORY' USING errcode='42501'; END IF;
    IF v_step=jsonb_array_length(v_plan->'path')-1 AND
       private.taxonomy_risk_triage_v1(v_label)<>'LOW_RISK_CANDIDATE'
    THEN RAISE EXCEPTION 'BATCH_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
    v_key:=private.taxonomy_normalize_v1(v_label);
    IF char_length(v_key) NOT BETWEEN 3 AND 160 OR v_key !~ '[[:alpha:]]' OR
       EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
          WHERE a.normalized_key=v_key)
    THEN RAISE EXCEPTION 'BATCH_ALIAS_OR_KEY_COLLISION'
      USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '22023' END; END IF;
    v_category:=NULL;v_current_parent:=NULL;
    SELECT c.id,c.parent_id INTO v_category,v_current_parent
      FROM private.work_taxonomy_categories c WHERE c.canonical_key=v_key
      FOR UPDATE;
    IF FOUND THEN
     IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.id=v_category AND c.state='ESTABLISHED') THEN
       RAISE EXCEPTION 'BATCH_PATH_CATEGORY_RETIRED' USING errcode='PT409'; END IF;
     IF v_current_parent IS DISTINCT FROM v_parent THEN
       RAISE EXCEPTION 'BATCH_SEMANTIC_OR_MODE_COLLISION'
         USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '22023' END;
     END IF;
     IF v_step=jsonb_array_length(v_plan->'path')-1 AND
       NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes
       WHERE category_id=v_category AND execution_scope=v_mode) THEN
       -- Only nodes born in THIS atomic, owner-signed batch may receive a
       -- second explicitly reviewed scope. Older catalog entries remain closed.
       IF NOT (v_category=ANY(v_created_ids)) THEN
         RAISE EXCEPTION 'BATCH_SEMANTIC_OR_MODE_COLLISION'
         USING errcode=CASE WHEN v_catalog_changed THEN 'PT409' ELSE '22023' END;
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
    -- Preserve every signed service item. Reuse of one worker capability is
    -- allowed only for distinct safe labels with the SAME existing mode and
    -- handoff; create/extension proposals never receive this exemption.
    IF p_purpose IS DISTINCT FROM 'WORKER_CAPABILITY'
      OR v_action IS DISTINCT FROM 'REUSE_EXISTING'
      OR private.taxonomy_risk_triage_v1(v_service) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
      OR NOT private.taxonomy_category_path_valid_v1(v_category)
      OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
        WHERE c.id=v_category AND c.state='ESTABLISHED'
          AND private.taxonomy_risk_triage_v1(c.label)='LOW_RISK_CANDIDATE'
          AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
            WHERE child.parent_id=c.id AND child.state='ESTABLISHED'))
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_items)
           WITH ORDINALITY previous(item,ordinal)
        WHERE previous.item->>'categoryId'=v_category::text
          AND previous.item->>'mode'=v_mode
          AND (
            p_plans->(previous.ordinal::integer-1)->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
            OR p_plans->(previous.ordinal::integer-1)->'handoff' IS DISTINCT FROM v_plan->'handoff'
            OR private.taxonomy_risk_triage_v1(previous.item->>'service')
                IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
          ))
    THEN RAISE EXCEPTION 'BATCH_DUPLICATE_CANONICAL_ID' USING errcode='22023'; END IF;
  END IF;
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
