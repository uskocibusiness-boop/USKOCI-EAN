-- USKOCI DEV rollback preimage captured 2026-11-21 (read-only SELECT of pg_get_functiondef).
-- Restore only as a controlled rollback of taxonomy_clarify_resolve_20261121.candidate.sql.
-- CREATE OR REPLACE preserves current ownership and ACLs; metadata is recorded above the definition.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
-- private.taxonomy_resolve_turn_catalog_v1(uuid,text,jsonb,text) | functiondef_md5=a17c1e66493c2ed1273aeca39679c9a0 | prosrc_md5=639983846b4f6b51cfe62c91afe4b0d6 | owner=postgres | acl={postgres=X/postgres} | security_definer=f | config={search_path=pg_catalog}
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
DO $rollback_postflight$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.taxonomy_resolve_turn_catalog_v1(uuid,text,jsonb,text)'::regprocedure) IS DISTINCT FROM '639983846b4f6b51cfe62c91afe4b0d6'
  THEN RAISE EXCEPTION 'TAXONOMY_CLARIFY_RESOLVE_ROLLBACK_POSTIMAGE_DRIFT'; END IF;
END
$rollback_postflight$;
COMMIT;
