-- LOCAL_ONLY / NOT_TESTED / NOT_DEPLOYED. Apply before the R06 first-plan candidate.
-- Owner decision 2026-11-02: catalog resolution belongs to the AI turn;
-- task Publish / profile Save still owns business consent and activation.
-- No new queue, table, provider or client writer. Original hints stay immutable.
-- Adds one bounded result column to the already owned/exported/erased hint row.
-- Promotion requires fresh preimages, R01/R10 closure coverage and rollback;
-- this candidate deliberately does NOT change closure certificates/readiness.
BEGIN;
DO $guard$
BEGIN
 IF current_setting('uskoci.r06_first_plan.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
 OR current_user<>'postgres' OR current_database()<>'postgres'
 OR to_regrole('cli_login_postgres') IS NOT NULL THEN
  RAISE EXCEPTION 'TURN_CATALOG_LOCAL_ONLY' USING errcode='55000'; END IF;
END $guard$;

ALTER TABLE private.work_taxonomy_gemini_turn_hints_v1 ADD COLUMN catalog_resolution jsonb
 CHECK(catalog_resolution IS NULL OR
  (jsonb_typeof(catalog_resolution)='object' AND pg_column_size(catalog_resolution)<=12000
   AND catalog_resolution->>'state' IN('RESOLVED','DEFERRED')
   AND catalog_resolution->>'inputDigest' ~ '^[0-9a-f]{64}$'));

-- Identity includes the ancestry, not unrelated catalog nodes or other modes.
CREATE FUNCTION private.taxonomy_turn_category_identity_v1(p_category uuid)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'pg_catalog' AS $fn$
 WITH RECURSIVE ancestry AS (
  SELECT c.id,c.label,c.parent_id,ARRAY[c.id] path FROM private.work_taxonomy_categories c
   WHERE c.id=p_category AND c.state='ESTABLISHED'
  UNION ALL
  SELECT c.id,c.label,c.parent_id,a.path||c.id FROM ancestry a
   JOIN private.work_taxonomy_categories c ON c.id=a.parent_id
   WHERE c.state='ESTABLISHED' AND NOT c.id=ANY(a.path)
 ) SELECT CASE WHEN EXISTS(SELECT 1 FROM ancestry WHERE parent_id IS NULL)
  THEN encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(id,label,parent_id)
   ORDER BY cardinality(path)),'[]'::jsonb)::text,'sha256'),'hex') END FROM ancestry;
$fn$;

-- Only called from the owned completion transaction, after the existing capture
-- writer has checked the exact completed attempt, source and offered services.
CREATE FUNCTION private.taxonomy_resolve_turn_catalog_v1(p_hint_id uuid,p_input_digest text,p_anchors jsonb,p_safety text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'pg_catalog' AS $fn$
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
       OR (item->>'categoryId'=category::text AND h.proposals->j->>'mode'=mode) THEN
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
END $fn$;

-- Rebase resolved IDs to today's version only while their identities and modes
-- remain valid. Original AI proposals and their replay digest are never edited.
CREATE FUNCTION private.taxonomy_resolved_turn_proposals_v1(h private.work_taxonomy_gemini_turn_hints_v1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'pg_catalog' AS $fn$
DECLARE version bigint;i integer;p jsonb;item jsonb;v_category_id uuid;answer jsonb:='[]'::jsonb;
BEGIN
 IF h.catalog_resolution IS NULL THEN RETURN h.proposals; END IF;
 IF h.catalog_resolution->>'state' IS DISTINCT FROM 'RESOLVED'
 OR jsonb_array_length(h.catalog_resolution->'items') IS DISTINCT FROM jsonb_array_length(h.proposals) THEN RETURN '[]'::jsonb; END IF;
 SELECT catalog_version INTO version FROM private.work_taxonomy_control WHERE singleton;
 IF version IS NULL THEN RETURN '[]'::jsonb; END IF;
 FOR i IN 0..jsonb_array_length(h.proposals)-1 LOOP
  p:=h.proposals->i;item:=h.catalog_resolution->'items'->i;v_category_id:=(item->>'categoryId')::uuid;
  IF private.taxonomy_turn_category_identity_v1(v_category_id) IS DISTINCT FROM item->>'identity'
   OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes m WHERE m.category_id=v_category_id AND m.execution_scope=p->>'mode')
   OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories child WHERE child.parent_id=v_category_id AND child.state='ESTABLISHED')
   OR private.taxonomy_risk_triage_v1(p->>'service') IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
   OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c WHERE c.id=v_category_id
      AND private.taxonomy_risk_triage_v1(c.label)='LOW_RISK_CANDIDATE') THEN RETURN '[]'::jsonb; END IF;
  answer:=answer||jsonb_build_array(p||jsonb_build_object('action','REUSE_EXISTING','categoryId',v_category_id,
   'parentId','','proposedPath','[]'::jsonb,'catalogVersion',version));
 END LOOP;
 RETURN answer;
END $fn$;

-- Private projection only; no API grants or new client-visible authority.
-- A current-source DEFERRED result must remain visible after a catalog change.
-- Otherwise readers can miss it on the version join and accept an unrelated
-- exact-name fallback. Rebased version is lookup metadata, never admission.
CREATE VIEW private.work_taxonomy_turn_hints_resolved_v1 WITH(security_invoker=true) AS
 SELECT h.id,h.purpose,h.account_id,h.conversation_id,h.client_request_id,h.turn_id,h.attempt_id,h.source_fingerprint,
  CASE WHEN h.catalog_resolution IS NOT NULL
   THEN (SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton) ELSE h.catalog_version END AS catalog_version,
  private.taxonomy_resolved_turn_proposals_v1(h) AS proposals,h.payload_digest,h.created_at,h.catalog_resolution
 FROM private.work_taxonomy_gemini_turn_hints_v1 h;
REVOKE ALL ON private.work_taxonomy_turn_hints_resolved_v1 FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.taxonomy_turn_category_identity_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.taxonomy_resolve_turn_catalog_v1(uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.taxonomy_resolved_turn_proposals_v1(private.work_taxonomy_gemini_turn_hints_v1) FROM PUBLIC,anon,authenticated,service_role;

-- Recorded deployed R04 definitions. Change bodies only: preserve signatures,
-- owner, security mode and ACL. A different predecessor must be reviewed first.
DO $readers$
DECLARE spec record;d text;
BEGIN
 FOR spec IN SELECT * FROM (VALUES
 ('private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)','5ffabf081a7d0eebffe8c3d9767de921'),
 ('private.worker_remote_review_ready_v1(jsonb)','77338f594bf811ee41dc43b3e60b0483'),
 ('private.worker_ai_service_mode_context_v1(uuid,uuid)','5bf382a91bc8256cc79bd803b38cd086'),
 ('public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)','ce552930610ca92eff0e8befa0a2c00b'),
 ('public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)','2c9a6526f65cfa6a5b1dd14bdc3b9491')
 ) expected(signature,definition_md5) LOOP
  SELECT replace(pg_get_functiondef(to_regprocedure(spec.signature)),chr(13),'') INTO d;
  IF md5(d) IS DISTINCT FROM spec.definition_md5 THEN
   RAISE EXCEPTION 'TURN_CATALOG_READER_DRIFT: %',spec.signature USING errcode='55000'; END IF;
  -- Only current-source consumers read resolved proposals. Historical lookups
  -- must retain original proposals: even stale/unresolved evidence may prohibit
  -- restoring a mode/handoff that the person deliberately removed earlier.
  d:=replace(d,'SELECT * INTO v_hint FROM private.work_taxonomy_gemini_turn_hints_v1 h',
   'SELECT * INTO v_hint FROM private.work_taxonomy_turn_hints_resolved_v1 h');
  d:=replace(d,'SELECT h.proposals INTO v_hints FROM private.work_taxonomy_gemini_turn_hints_v1 h',
   'SELECT h.proposals INTO v_hints FROM private.work_taxonomy_turn_hints_resolved_v1 h');
  d:=replace(d,'select h.proposals into v_hints from private.work_taxonomy_gemini_turn_hints_v1 h',
   'select h.proposals into v_hints from private.work_taxonomy_turn_hints_resolved_v1 h');
  IF spec.signature LIKE 'private.taxonomy_review_candidate_projection_v2(%' THEN
   -- Observe the owned current-source result before the empty-mode/exact-name
   -- fallback. Failed classification is not missing user consent to a mode.
   d:=replace(d,$old$IF v_exact->>'status' NOT IN ('READY','PENDING_CLASSIFICATION') THEN RETURN v_exact; END IF;$old$,'');
   d:=replace(d,$old$IF NOT FOUND THEN RETURN v_exact; END IF;$old$,
    $new$IF NOT FOUND THEN RETURN v_exact; END IF;
     IF v_hint.catalog_resolution IS NOT NULL AND v_hint.proposals='[]'::jsonb THEN
      RETURN jsonb_build_object('status',CASE
       WHEN v_hint.catalog_resolution->>'state'='RESOLVED'
         OR v_hint.catalog_resolution->>'code'='CATALOG_CHANGED' THEN 'STALE_CATALOG'
       ELSE 'REVIEW_REQUIRED' END,'classificationCandidates','[]'::jsonb,
       'reviewedServiceModes','[]'::jsonb,'visibleServices','[]'::jsonb,
       'classificationCatalogVersion',NULL,'classificationCatalogFingerprint',NULL);
     END IF;
     IF v_exact->>'status' NOT IN ('READY','PENDING_CLASSIFICATION') THEN RETURN v_exact; END IF;$new$);
   d:=replace(d,$old$v_plan:=v_one#>'{classificationCandidates,0}';$old$,
    $new$v_plan:=v_one#>'{classificationCandidates,0}';
     IF v_hint.catalog_resolution->>'state'='RESOLVED' AND (v_matches<>1 OR
       v_plan->>'categoryId' IS DISTINCT FROM v_proposal->>'categoryId') THEN
      RETURN jsonb_build_object('status','STALE_CATALOG','classificationCandidates','[]'::jsonb,
       'reviewedServiceModes','[]'::jsonb,'visibleServices','[]'::jsonb,
       'classificationCatalogVersion',NULL,'classificationCatalogFingerprint',NULL);
     END IF;$new$);
  ELSIF spec.signature LIKE 'private.worker_ai_service_mode_context_v1(%' THEN
   d:=replace(d,'v_hints jsonb; v_source text;','v_hints jsonb; v_source text; v_turn_resolved boolean:=false;');
   d:=replace(d,'SELECT h.proposals INTO v_hints',
    'SELECT h.proposals,coalesce(h.catalog_resolution->>''state''=''RESOLVED'',false) INTO v_hints,v_turn_resolved');
   d:=replace(d,$old$IF v_projection->>'status'='READY'
        AND v_projection#>>'{classificationCandidates,0,categoryId}'=v_item->>'categoryId'$old$,
    $new$IF v_turn_resolved OR (v_projection->>'status'='READY'
        AND v_projection#>>'{classificationCandidates,0,categoryId}'=v_item->>'categoryId')$new$);
  END IF;
  EXECUTE d;
 END LOOP;
END $readers$;

-- Recorded bootstrap bodies for lifecycle integration, not fresh DEV evidence.
-- Export includes catalog links; the existing semantic projector excludes
-- internal hashes. Existing closure/retention deletes this entire hint row.
-- Do not re-sign any closure certificate here. Promotion must cover the changed
-- schema/source through the existing R01/R10 process.
DO $exports$
DECLARE spec record;d text;
BEGIN
 FOR spec IN SELECT * FROM (VALUES
 ('private.closure_taxonomy_inventory_v1()','3bf217135064c6e8c45275c4442355cd'),
 ('private.closure_taxonomy_project_v1(text,jsonb,uuid)','bf004f543c92940845b570d8860288cc'),
 ('private.closure_taxonomy_reset_sections_v1()','dd0577a0f6a347da8f2c14cb6b912b3b')
 ) expected(signature,body_md5) LOOP
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure(spec.signature)) IS DISTINCT FROM spec.body_md5 THEN
   RAISE EXCEPTION 'TURN_CATALOG_EXPORT_DRIFT: %',spec.signature USING errcode='55000'; END IF;
  SELECT pg_get_functiondef(to_regprocedure(spec.signature)) INTO d;
  IF spec.signature LIKE 'private.closure_taxonomy_project_v1(%' THEN
   d:=replace(d,$old$'proposals','plan','plans','result','binding_result'$old$,
      $new$'proposals','plan','plans','result','binding_result','catalog_resolution'$new$);
  ELSE
   d:=replace(d,'"turn_id","proposals","catalog_version","created_at"',
     '"turn_id","proposals","catalog_version","catalog_resolution","created_at"');
  END IF;
  EXECUTE d;
 END LOOP;
END $exports$;
COMMIT;
