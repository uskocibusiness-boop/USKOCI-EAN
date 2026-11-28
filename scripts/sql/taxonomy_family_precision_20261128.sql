-- USKOCI taxonomy: non-executable grouping must not grant a concrete competency.
-- FORWARD source-only candidate. No data mutations; no new ACL.
-- Current DEV capture 2026-11-28. Existing signed reviews must be reclassified
-- through the normal business review/Save flow; do not rewrite historical snapshots.
DO $source_only$ BEGIN RAISE EXCEPTION 'TAXONOMY_FAMILY_SOURCE_ONLY'; END $source_only$;

-- TAXONOMY_FAMILY_ISOLATED_START
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
CREATE TEMP TABLE uskoci_family_guard(sig text PRIMARY KEY, metadata jsonb NOT NULL, after_hash text NOT NULL) ON COMMIT DROP;
DO $preflight$
DECLARE f record; actual pg_proc%rowtype;
BEGIN
 FOR f IN SELECT * FROM (VALUES
 ('private.taxonomy_capability_tier_v1(uuid,integer,uuid)','0d7a3f11123fcdab1eca3f36cfa511ff','d7264e0f5dcc12d482fdfb13cc0775e3','{postgres=X/postgres,service_role=X/postgres}',ARRAY['search_path=pg_catalog, private']::text[]),
 ('private.taxonomy_existing_ai_scoped_preview_v1(text,text,text,text[])','0943531bf68218523bce54fe7a48f952','8d2b38839c4de09cfcc2066e28ca18d5','{postgres=X/postgres,service_role=X/postgres}',ARRAY['search_path=pg_catalog, private']::text[]),
 ('private.taxonomy_requirement_tier_inherited_v1(uuid,uuid)','c0ddc6a6347384bfcb87d2cca96bc08a','c3bc6b461aba617dfafee1a33b30c9f7','{postgres=X/postgres,service_role=X/postgres}',ARRAY['search_path=pg_catalog']::text[]),
 ('private.taxonomy_resolve_turn_catalog_v1(uuid,text,jsonb,text)','f468d6019b2586f62cc69809b54761af','fc107846886aad446f8ce0f7111e65c5','{postgres=X/postgres}',ARRAY['search_path=pg_catalog']::text[]),
 ('private.taxonomy_scope_eligible_v1(uuid,uuid)','8a1bbb43ad9c021f95cc82be5c5e5e6c','e1d538f51c19a957862ac7c56632042c','{postgres=X/postgres}',ARRAY['search_path=pg_catalog, private']::text[]),
 ('private.taxonomy_worker_scoped_capability_preview_v1(text,text)','fbc685647e79115d1d483c7b679eafb5','793803d0dfab1b31959071ad447085e5','{postgres=X/postgres,service_role=X/postgres}',ARRAY['search_path=pg_catalog, private']::text[])
 ) v(sig,before_hash,after_hash,expected_acl,expected_config) LOOP
  SELECT * INTO actual FROM pg_proc WHERE oid=to_regprocedure(f.sig);
  IF NOT FOUND OR md5(actual.prosrc) IS DISTINCT FROM f.before_hash
   OR pg_get_userbyid(actual.proowner) IS DISTINCT FROM 'postgres'
   OR actual.proacl::text IS DISTINCT FROM f.expected_acl OR actual.prosecdef
   OR actual.proconfig IS DISTINCT FROM f.expected_config THEN
   RAISE EXCEPTION 'TAXONOMY_FAMILY_PREIMAGE_DRIFT:%',f.sig;
  END IF;
  INSERT INTO pg_temp.uskoci_family_guard VALUES(f.sig,to_jsonb(actual)-'prosrc',f.after_hash);
 END LOOP;
END $preflight$;

CREATE OR REPLACE FUNCTION private.taxonomy_capability_tier_v1(p_need_id uuid, p_need_revision integer, p_worker_account_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 req uuid;
 found_requirement boolean := false;
 match_rank integer;
 overall_rank integer := 3;
BEGIN
 IF p_worker_account_id IS NULL OR p_need_id IS NULL OR p_need_revision IS NULL THEN
  RETURN 'NO_SAFE_MATCH';
 END IF;
 -- A snapshot is never an entitlement unless explicitly confirmed by publisher.
 IF NOT EXISTS (
  SELECT 1 FROM private.work_taxonomy_need_snapshots s
  WHERE s.need_id=p_need_id AND s.need_revision=p_need_revision
    AND s.classification_state='CONFIRMED' AND s.reviewed_by_requester
    AND s.category_id IS NOT NULL
 ) THEN RETURN 'NO_SAFE_MATCH'; END IF;
 -- The primary work type is always mandatory. Explicit additional
 -- competencies are conjunctive; they never replace the primary service.
 -- This is a capability check only and grants no notification entitlement.
 FOR req IN
  SELECT s.category_id FROM private.work_taxonomy_need_snapshots s
  WHERE s.need_id=p_need_id AND s.need_revision=p_need_revision
  UNION ALL
  SELECT x.category_id FROM private.work_taxonomy_need_skills x
  WHERE x.need_id=p_need_id AND x.need_revision=p_need_revision
 LOOP
  found_requirement := true;
  IF (req = '00000000-0000-4000-8000-000000000802'::uuid OR EXISTS (SELECT 1 FROM private.work_taxonomy_legacy_kind_map fam WHERE fam.category_id=req AND fam.family_only)) THEN RETURN 'NO_SAFE_MATCH'; END IF;
  -- A worker's explicit opt-out for the requested work always wins over
  -- equivalent or related grants from a *different* confirmed skill.
  IF EXISTS (
    SELECT 1 FROM private.work_taxonomy_worker_capabilities e
    WHERE e.worker_account_id=p_worker_account_id
      AND e.category_id=req AND e.excluded
  ) THEN RETURN 'NO_SAFE_MATCH'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.work_taxonomy_categories c
                 WHERE c.id=req AND c.state<>'RETIRED') THEN
   RETURN 'NO_SAFE_MATCH';
  END IF;
  match_rank := 0;
  -- EXACT: the worker personally confirmed the canonical skill.
  IF EXISTS (
    SELECT 1 FROM private.work_taxonomy_worker_capabilities w
    WHERE w.worker_account_id=p_worker_account_id
      AND w.category_id=req AND NOT w.excluded
  ) THEN match_rank := 3;
  -- EQUIVALENT: a trusted, verified directed equivalence, not fuzzy AI proximity.
  ELSIF EXISTS (
    SELECT 1 FROM private.work_taxonomy_worker_capabilities w
    JOIN private.work_taxonomy_relations r
      ON r.source_id=w.category_id AND r.target_id=req
    WHERE w.worker_account_id=p_worker_account_id AND NOT w.excluded AND NOT (w.category_id = '00000000-0000-4000-8000-000000000802'::uuid OR EXISTS (SELECT 1 FROM private.work_taxonomy_legacy_kind_map fam WHERE fam.category_id=w.category_id AND fam.family_only))
      AND r.relation='EQUIVALENT_VERIFIED'
      AND r.verification='VERIFIED' AND r.evidence_ref IS NOT NULL
  ) THEN match_rank := 2;
  -- RELATED: BOTH a verified competence relationship AND THIS worker's
  -- explicit acceptance of this exact source -> target work, with opt-in.
  ELSIF EXISTS (
    SELECT 1 FROM private.work_taxonomy_worker_capabilities w
    JOIN private.work_taxonomy_relations r
      ON r.source_id=w.category_id AND r.target_id=req
    JOIN private.work_taxonomy_related_acceptances a
      ON a.worker_account_id=w.worker_account_id
     AND a.source_category_id=w.category_id AND a.target_category_id=req
     AND a.relationship_version=r.version
    WHERE w.worker_account_id=p_worker_account_id AND NOT w.excluded AND NOT (w.category_id = '00000000-0000-4000-8000-000000000802'::uuid OR EXISTS (SELECT 1 FROM private.work_taxonomy_legacy_kind_map fam WHERE fam.category_id=w.category_id AND fam.family_only))
      AND w.allow_related_offers
      AND r.relation='CAPABILITY_CONFIRMED'
      AND r.verification='VERIFIED' AND r.evidence_ref IS NOT NULL
  ) THEN match_rank := 1;
  END IF;
  IF match_rank=0 THEN RETURN 'NO_SAFE_MATCH'; END IF;
  overall_rank := LEAST(overall_rank,match_rank);
 END LOOP;
 IF NOT found_requirement THEN RETURN 'NO_SAFE_MATCH'; END IF;
 RETURN CASE overall_rank WHEN 3 THEN 'EXACT'
                           WHEN 2 THEN 'EQUIVALENT'
                           WHEN 1 THEN 'RELATED_CONFIRMED'
                           ELSE 'NO_SAFE_MATCH' END;
END
$function$;

CREATE OR REPLACE FUNCTION private.taxonomy_existing_ai_scoped_preview_v1(p_execution_location_mode text, p_ai_category text, p_public_description text, p_explicit_required_skills text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_scope text;
 v_raw jsonb;
 v_cat_id uuid;
 v_action text;
BEGIN
 v_scope:=private.taxonomy_execution_scope_v1(p_execution_location_mode);
 IF v_scope IS NULL THEN
  RETURN jsonb_build_object('action','CLARIFY','reason','EXECUTION_MODE_REQUIRED',
    'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;

 v_raw:=private.taxonomy_existing_ai_category_preview_v1(
   p_ai_category,p_public_description,p_explicit_required_skills);
 v_action:=v_raw->>'action';

 -- No speculative mode is ever substituted for a model suggestion.
 -- The claimed kind can reuse an established category ONLY if verified
 -- category-mode record exists for the relevant execution branch.
 IF v_action='SUGGEST_EXISTING_SERVICE' THEN
  BEGIN
   v_cat_id:=(v_raw->>'categoryId')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','CATALOG_ID_INVALID',
     'executionScope',v_scope,'classificationAuthority','NONE',
     'notificationAuthority','NONE');
  END;
  IF NOT EXISTS (
   SELECT 1 FROM private.work_taxonomy_category_modes m
   JOIN private.work_taxonomy_categories c ON c.id=m.category_id
   WHERE m.category_id=v_cat_id AND m.execution_scope=v_scope
     AND c.state<>'RETIRED'
  ) THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','CATEGORY_NOT_IN_EXECUTION_SCOPE',
     'executionScope',v_scope,'requiresRequesterReview',true,
     'classificationAuthority','NONE','notificationAuthority','NONE');
  END IF;
  -- Parent/family names cannot be auto-interpreted as specific competencies.
  IF (v_cat_id = '00000000-0000-4000-8000-000000000802'::uuid OR EXISTS (SELECT 1 FROM private.work_taxonomy_legacy_kind_map fam WHERE fam.category_id=v_cat_id AND fam.family_only))
    OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories WHERE id=v_cat_id AND parent_id IS NULL)
    OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories WHERE parent_id=v_cat_id AND state<>'RETIRED')
  THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','CHOOSE_SPECIFIC_SERVICE',
     'executionScope',v_scope,'requiresRequesterReview',true,
     'classificationAuthority','NONE','notificationAuthority','NONE');
  END IF;
 END IF;

 -- For novel labels, the desired mode becomes a mandatory future binding,
 -- never a second free-floating category that the app cannot browse.
 -- Registration remains OFF and this function performs zero writes.
 RETURN v_raw || jsonb_build_object(
  'executionScope',v_scope,'requiresModeBinding',true,
  'requiresRequesterReview',true,'classificationAuthority','NONE',
  'notificationAuthority','NONE');
END $function$;

CREATE OR REPLACE FUNCTION private.taxonomy_requirement_tier_inherited_v1(p_req uuid, p_worker_account_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
 IF p_req IS NULL OR p_worker_account_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM private.work_taxonomy_categories c
  WHERE c.id=p_req AND c.state<>'RETIRED'
 ) THEN RETURN 'NO_SAFE_MATCH'; END IF;

 IF (p_req = '00000000-0000-4000-8000-000000000802'::uuid OR EXISTS (SELECT 1 FROM private.work_taxonomy_legacy_kind_map fam WHERE fam.category_id=p_req AND fam.family_only)) THEN RETURN 'NO_SAFE_MATCH'; END IF;

 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  WHERE w.worker_account_id=p_worker_account_id
    AND w.category_id=p_req AND w.excluded
 ) THEN RETURN 'NO_SAFE_MATCH'; END IF;

 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  WHERE w.worker_account_id=p_worker_account_id
    AND w.category_id=p_req AND NOT w.excluded
 ) THEN RETURN 'EXACT'; END IF;

 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  JOIN private.work_taxonomy_relations r
    ON r.source_id=w.category_id AND r.target_id=p_req
  WHERE w.worker_account_id=p_worker_account_id AND NOT w.excluded AND NOT (w.category_id = '00000000-0000-4000-8000-000000000802'::uuid OR EXISTS (SELECT 1 FROM private.work_taxonomy_legacy_kind_map fam WHERE fam.category_id=w.category_id AND fam.family_only))
    AND r.relation='EQUIVALENT_VERIFIED' AND r.verification='VERIFIED'
    AND r.evidence_ref IS NOT NULL AND left(r.evidence_ref,3) <> 'AI_'
 ) THEN RETURN 'EQUIVALENT'; END IF;

 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  JOIN private.work_taxonomy_relations r
    ON r.source_id=w.category_id AND r.target_id=p_req
  JOIN private.work_taxonomy_related_acceptances a
    ON a.worker_account_id=w.worker_account_id
      AND a.source_category_id=w.category_id AND a.target_category_id=p_req
      AND a.relationship_version=r.version
  WHERE w.worker_account_id=p_worker_account_id AND NOT w.excluded AND NOT (w.category_id = '00000000-0000-4000-8000-000000000802'::uuid OR EXISTS (SELECT 1 FROM private.work_taxonomy_legacy_kind_map fam WHERE fam.category_id=w.category_id AND fam.family_only))
    AND w.allow_related_offers AND r.relation='CAPABILITY_CONFIRMED'
    AND r.verification='VERIFIED' AND r.evidence_ref IS NOT NULL AND left(r.evidence_ref,3) <> 'AI_'
 ) THEN RETURN 'RELATED_CONFIRMED'; END IF;

 -- Standard coverage tree walk with strict RELEVANCE CEILING (STOP LINE):
 -- Cannot walk up to Level 0 (Crown) or Level 1 (Macro Sectors).
 IF EXISTS (
  WITH RECURSIVE coverage(ancestor_id,visited,depth) AS (
    SELECT e.parent_category_id,
           ARRAY[e.child_category_id,e.parent_category_id]::uuid[],1
    FROM private.work_taxonomy_standard_coverage e
    JOIN private.work_taxonomy_categories c
      ON c.id=e.child_category_id AND c.parent_id=e.parent_category_id
         AND c.state='ESTABLISHED'
    JOIN private.work_taxonomy_categories p
      ON p.id=e.parent_category_id AND p.state='ESTABLISHED'
    WHERE e.child_category_id=p_req
      AND left(e.evidence_ref,3) <> 'AI_'
      -- RELEVANCE CEILING: Exclude Crown (parent_id IS NULL) and Sectors (parent is Crown)
      AND p.parent_id IS NOT NULL 
      AND p.parent_id <> '00000000-0000-4000-8000-000000000001'::uuid
      AND EXISTS (
        SELECT 1 FROM private.work_taxonomy_category_modes cm
        JOIN private.work_taxonomy_category_modes pm
          ON pm.category_id=p.id AND pm.execution_scope=cm.execution_scope
        WHERE cm.category_id=c.id
      )
    UNION ALL
    SELECT e.parent_category_id,
           coverage.visited || e.parent_category_id,coverage.depth+1
    FROM coverage
    JOIN private.work_taxonomy_standard_coverage e
      ON e.child_category_id=coverage.ancestor_id
    JOIN private.work_taxonomy_categories c
      ON c.id=e.child_category_id AND c.parent_id=e.parent_category_id
        AND c.state='ESTABLISHED'
    JOIN private.work_taxonomy_categories p
      ON p.id=e.parent_category_id AND p.state='ESTABLISHED'
    WHERE coverage.depth<32
      AND left(e.evidence_ref,3) <> 'AI_'
      AND NOT e.parent_category_id=ANY(coverage.visited)
      -- RELEVANCE CEILING: Exclude Crown and Sectors from upward expansion
      AND p.parent_id IS NOT NULL 
      AND p.parent_id <> '00000000-0000-4000-8000-000000000001'::uuid
      AND EXISTS (
        SELECT 1 FROM private.work_taxonomy_category_modes cm
        JOIN private.work_taxonomy_category_modes pm
          ON pm.category_id=p.id AND pm.execution_scope=cm.execution_scope
        WHERE cm.category_id=c.id
      )
  )
  SELECT 1 FROM coverage path
  JOIN private.work_taxonomy_worker_capabilities w
    ON w.category_id=path.ancestor_id AND NOT (w.category_id = '00000000-0000-4000-8000-000000000802'::uuid OR EXISTS (SELECT 1 FROM private.work_taxonomy_legacy_kind_map fam WHERE fam.category_id=w.category_id AND fam.family_only))
    AND w.worker_account_id=p_worker_account_id AND NOT w.excluded
  WHERE NOT EXISTS (
    SELECT 1 FROM private.work_taxonomy_worker_capabilities x
    WHERE x.worker_account_id=p_worker_account_id
      AND x.excluded AND x.category_id=ANY(path.visited)
  )
 ) THEN RETURN 'INHERITED_STANDARD'; END IF;

 RETURN 'NO_SAFE_MATCH';
END;
$function$;

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
 -- An ordinary CLARIFY question is not a safety concern. REVIEW/BLOCK (and any
 -- unknown value) stay deferred; per-label risk triage below remains the gate.
 IF p_safety IS NULL OR p_safety NOT IN('ALLOW','CLARIFY') THEN
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
     IF NOT FOUND OR (category = '00000000-0000-4000-8000-000000000802'::uuid OR EXISTS (SELECT 1 FROM private.work_taxonomy_legacy_kind_map fam WHERE fam.category_id=category AND fam.family_only)) OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
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
    IF (category = '00000000-0000-4000-8000-000000000802'::uuid OR EXISTS (SELECT 1 FROM private.work_taxonomy_legacy_kind_map fam WHERE fam.category_id=category AND fam.family_only)) OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories child WHERE child.parent_id=category AND child.state='ESTABLISHED') THEN
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
END $function$;

CREATE OR REPLACE FUNCTION private.taxonomy_scope_eligible_v1(p_need_id uuid, p_worker_account_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE v_category uuid;v_revision integer;v_mode text;v_scope text;
BEGIN
 IF p_need_id IS NULL OR p_worker_account_id IS NULL THEN RETURN false; END IF;
 SELECT n.category_id,n.revision,n.execution_location_mode
  INTO v_category,v_revision,v_mode FROM public.needs n WHERE n.id=p_need_id;
 IF NOT FOUND OR v_category IS NULL OR v_revision IS NULL THEN RETURN false; END IF;
 IF (v_category = '00000000-0000-4000-8000-000000000802'::uuid OR EXISTS (SELECT 1 FROM private.work_taxonomy_legacy_kind_map fam WHERE fam.category_id=v_category AND fam.family_only)) THEN RETURN false; END IF;
 v_scope:=CASE v_mode WHEN 'REMOTE' THEN 'REMOTE'
   WHEN 'STATIONARY' THEN 'ON_SITE'
   WHEN 'POINT_TO_POINT' THEN 'ON_SITE'
   WHEN 'MULTI_STOP' THEN 'ON_SITE'
   WHEN 'AREA_BASED' THEN 'ON_SITE'
   ELSE NULL END;
 IF v_scope IS NULL THEN RETURN false; END IF;
 -- Only requester's EXACT signed/current need revision may participate.
 IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_need_snapshots s
  WHERE s.need_id=p_need_id AND s.need_revision=v_revision
    AND s.category_id=v_category AND s.reviewed_by_requester
    AND s.classification_state='CONFIRMED') THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
    JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
   WHERE c.id=v_category AND c.state='ESTABLISHED' AND cm.execution_scope=v_scope)
 THEN RETURN false; END IF;
 -- Confirmed worker GLOBAL execution choice is necessary, never sufficient.
 IF NOT EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
   WHERE choice.worker_account_id=p_worker_account_id
     AND v_scope=ANY(choice.modes) AND choice.confirmed_at IS NOT NULL)
 THEN RETURN false; END IF;
 -- Require saved human consent for this precise worker+service+scope.
 IF NOT EXISTS(SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m
  JOIN private.work_taxonomy_worker_capabilities cap
    ON cap.worker_account_id=m.worker_account_id
   AND cap.category_id=m.category_id AND NOT cap.excluded
  JOIN private.worker_ai_saves saved
    ON saved.account_id=m.worker_account_id
   AND saved.review_id=m.source_review_id
   AND saved.client_request_id=m.source_request_key
  WHERE m.worker_account_id=p_worker_account_id AND m.category_id=v_category
    AND m.execution_scope=v_scope AND m.active)
 THEN RETURN false; END IF;
 RETURN true;
END $function$;

CREATE OR REPLACE FUNCTION private.taxonomy_worker_scoped_capability_preview_v1(p_execution_location_mode text, p_skill_label text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_scope text;
 v_preview jsonb;
 v_id uuid;
BEGIN
 v_scope:=private.taxonomy_execution_scope_v1(p_execution_location_mode);
 IF v_scope IS NULL THEN
  RETURN jsonb_build_object('action','CLARIFY','reason','WORKER_MODE_REQUIRED',
   'capabilityAuthority','NONE','notificationAuthority','NONE');
 END IF;
 v_preview:=private.taxonomy_preview_v1(p_skill_label);
 IF v_preview->>'action'='REUSE_EXISTING' THEN
  BEGIN v_id:=(v_preview->>'categoryId')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','CATALOG_ID_INVALID',
    'executionScope',v_scope,'capabilityAuthority','NONE','notificationAuthority','NONE');
  END;
  IF NOT EXISTS(
    SELECT 1 FROM private.work_taxonomy_category_modes m
    JOIN private.work_taxonomy_categories c ON c.id=m.category_id
    WHERE m.category_id=v_id AND m.execution_scope=v_scope AND c.state<>'RETIRED'
  ) THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','SKILL_NOT_IN_WORKER_MODE',
    'executionScope',v_scope,'capabilityAuthority','NONE','notificationAuthority','NONE');
  END IF;
  IF (v_id = '00000000-0000-4000-8000-000000000802'::uuid OR EXISTS (SELECT 1 FROM private.work_taxonomy_legacy_kind_map fam WHERE fam.category_id=v_id AND fam.family_only))
  OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories WHERE id=v_id AND parent_id IS NULL)
  OR EXISTS(SELECT 1 FROM private.work_taxonomy_categories WHERE parent_id=v_id AND state<>'RETIRED')
  THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','CONFIRM_SPECIFIC_WORK_TYPE',
    'executionScope',v_scope,'capabilityAuthority','NONE','notificationAuthority','NONE');
  END IF;
 END IF;
 RETURN v_preview || jsonb_build_object(
  'executionScope',v_scope,'requiresWorkerReview',true,
  'requiresExplicitWorkerConfirmation',true,
  'capabilityAuthority','NONE','notificationAuthority','NONE');
END $function$;

DO $postflight$
DECLARE f record; actual pg_proc%rowtype;
BEGIN
 FOR f IN SELECT * FROM pg_temp.uskoci_family_guard LOOP
  SELECT * INTO actual FROM pg_proc WHERE oid=to_regprocedure(f.sig);
  IF NOT FOUND OR md5(actual.prosrc) IS DISTINCT FROM f.after_hash
   OR (to_jsonb(actual)-'prosrc') IS DISTINCT FROM f.metadata THEN
   RAISE EXCEPTION 'TAXONOMY_FAMILY_POSTIMAGE_DRIFT:%',f.sig;
  END IF;
 END LOOP;
END $postflight$;
COMMIT;
