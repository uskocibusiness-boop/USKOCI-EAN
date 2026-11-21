-- USKOCI DEV rollback preimage captured 2026-11-21 (read-only SELECT of pg_get_functiondef).
-- Restore only as a controlled rollback of review_resolved_reuse_20261121.candidate.sql.
-- CREATE OR REPLACE preserves current ownership and ACLs.
-- private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid): owner=postgres acl={postgres=X/postgres}
--   prosecdef=false proconfig={search_path=pg_catalog, private} provolatile=s
--   functiondef_md5=aeae6f02c0ef0883dde1e220a396f1a2 prosrc_md5=f439455e1d5edb63ae4297a5c922a3c5
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DO $rollback_guard$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'::regprocedure)
     IS DISTINCT FROM 'a98a0b2228095b1db7236836633d09a7'
  THEN RAISE EXCEPTION 'REVIEW_RESOLVED_REUSE_ROLLBACK_PREIMAGE_DRIFT'; END IF;
END
$rollback_guard$;

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
 v_category uuid;v_category_parent uuid;v_category_label text;v_plan jsonb;
 v_matches integer;v_path jsonb;v_label text;v_step integer;
 v_plans jsonb:='[]'::jsonb;v_visible jsonb:='[]'::jsonb;
 v_semantic jsonb:='[]'::jsonb;
BEGIN
 IF p_owner_account_id IS NULL OR p_conversation_id IS NULL
   OR p_owner_account_id IS DISTINCT FROM auth.uid() THEN
   RAISE EXCEPTION 'TAXONOMY_REVIEW_OWNER_MISMATCH' USING errcode='42501';
 END IF;
 -- The existing projection validates the complete service/mode selection and
 -- returns the trusted exact/alias plan when the entire request already maps.
 v_exact:=private.taxonomy_review_exact_projection_v1(
   p_purpose,p_services,p_service_modes);
 
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
 SELECT * INTO v_hint FROM private.work_taxonomy_turn_hints_resolved_v1 h
   WHERE h.purpose=p_purpose AND h.account_id=p_owner_account_id
     AND h.conversation_id=p_conversation_id
     AND h.source_fingerprint=v_source AND h.catalog_version=v_version
   ORDER BY h.created_at DESC,h.id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN v_exact; END IF;
     IF v_hint.catalog_resolution IS NOT NULL AND v_hint.proposals='[]'::jsonb THEN
      RETURN jsonb_build_object('status',CASE
       WHEN v_hint.catalog_resolution->>'state'='RESOLVED'
         OR v_hint.catalog_resolution->>'code'='CATALOG_CHANGED' THEN 'STALE_CATALOG'
       ELSE 'REVIEW_REQUIRED' END,'classificationCandidates','[]'::jsonb,
       'reviewedServiceModes','[]'::jsonb,'visibleServices','[]'::jsonb,
       'classificationCatalogVersion',NULL,'classificationCatalogFingerprint',NULL);
     END IF;
     IF v_exact->>'status' NOT IN ('READY','PENDING_CLASSIFICATION') THEN RETURN v_exact; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_service_modes) LOOP
   v_mode:=v_item->>'mode';
   v_key:=private.taxonomy_normalize_v1(v_item->>'service');
   SELECT x.value#>>'{}' INTO v_service FROM jsonb_array_elements(p_services) x(value)
     WHERE private.taxonomy_normalize_v1(x.value#>>'{}')=v_key LIMIT 1;
   v_visible:=v_visible||jsonb_build_array(jsonb_build_object(
     'service',v_service,'mode',v_mode));
   SELECT count(*),(jsonb_agg(p.value))->0 INTO v_matches,v_proposal
     FROM jsonb_array_elements(v_hint.proposals) p(value)
     WHERE private.taxonomy_normalize_v1(p.value->>'service')=v_key
       AND p.value->>'mode'=v_mode;
   -- Preserve the exact source-bound handoff value even for canonical/alias reuse.
   -- No default shipping or profile-city inference is permitted.
   IF v_matches=1 AND v_proposal?'handoff' AND
      (v_mode<>'REMOTE' OR NOT private.taxonomy_handoff_valid_v1(v_proposal->'handoff'))
   THEN RAISE EXCEPTION 'TAXONOMY_REVIEW_HANDOFF_INVALID' USING errcode='42501'; END IF;
   v_one:=private.taxonomy_review_exact_projection_v1(p_purpose,
     jsonb_build_array(v_service),jsonb_build_array(
       jsonb_build_object('service',v_service,'mode',v_mode)));
   IF v_one->>'status'='READY' THEN
     v_plan:=v_one#>'{classificationCandidates,0}';
     IF v_hint.catalog_resolution->>'state'='RESOLVED' AND (v_matches<>1 OR
       v_plan->>'categoryId' IS DISTINCT FROM v_proposal->>'categoryId') THEN
      RETURN jsonb_build_object('status','STALE_CATALOG','classificationCandidates','[]'::jsonb,
       'reviewedServiceModes','[]'::jsonb,'visibleServices','[]'::jsonb,
       'classificationCatalogVersion',NULL,'classificationCatalogFingerprint',NULL);
     END IF;
     -- The same worker skill cannot have two different leaf IDs across modes.
     IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_semantic) x(value)
       WHERE private.taxonomy_normalize_v1(x.value->>'service')=v_key
         AND x.value->>'categoryId' IS DISTINCT FROM v_plan->>'categoryId')
     THEN RETURN v_exact; END IF;
     IF v_matches=1 AND v_proposal?'handoff' THEN
       v_plan:=v_plan||jsonb_build_object('handoff',v_proposal->'handoff');
     END IF;
     v_plans:=v_plans||jsonb_build_array(v_plan);
     CONTINUE;
   END IF;
   IF v_one->>'status'<>'PENDING_CLASSIFICATION' THEN RETURN v_exact; END IF;
   -- Model-proposed unregistered semantic reuse is verified against safety screening.
   -- Low-risk candidates form a valid plan; sensitive/regulated items enter semantic comparison.
   IF v_matches=1 AND v_proposal->>'action'='REUSE_EXISTING' THEN
     IF jsonb_typeof(v_proposal->'catalogVersion') IS DISTINCT FROM 'number'
       OR (v_proposal->>'catalogVersion')::bigint IS DISTINCT FROM v_version
       OR jsonb_typeof(v_proposal->'categoryId') IS DISTINCT FROM 'string'
       OR (v_proposal->>'categoryId') !~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       OR v_proposal->>'parentId' IS DISTINCT FROM ''
       OR v_proposal->'proposedPath' IS DISTINCT FROM '[]'::jsonb
       OR char_length(btrim(v_proposal->>'reason')) NOT BETWEEN 10 AND 1000
       OR private.taxonomy_risk_triage_v1(v_service) IN ('BLOCKED','NEEDS_CLARIFICATION')
     THEN RETURN v_exact; END IF;
     v_category:=(v_proposal->>'categoryId')::uuid;
     -- A canonical/alias spelling anywhere is not a new synonym; it must go
     -- through exact identity or the existing explicit EXTEND_MODE path.
     IF EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.state<>'RETIRED' AND (c.canonical_key=v_key OR EXISTS(
         SELECT 1 FROM private.work_taxonomy_aliases a
           WHERE a.category_id=c.id AND a.normalized_key=v_key)))
     THEN RETURN v_exact; END IF;
     v_category_label:=NULL;v_category_parent:=NULL;
     SELECT c.label,c.parent_id INTO v_category_label,v_category_parent
       FROM private.work_taxonomy_categories c
       JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
         AND m.execution_scope=v_mode
       WHERE c.id=v_category AND c.state='ESTABLISHED'
         AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
           WHERE child.parent_id=c.id AND child.state='ESTABLISHED');
     IF v_category_label IS NULL
       OR private.taxonomy_risk_triage_v1(v_category_label) IN ('BLOCKED','NEEDS_CLARIFICATION')
       OR NOT private.taxonomy_category_path_valid_v1(v_category)
       OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_semantic) x(value)
         WHERE private.taxonomy_normalize_v1(x.value->>'service')=v_key
           AND x.value->>'categoryId' IS DISTINCT FROM v_category::text)
       OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_plans) x(value)
         WHERE private.taxonomy_normalize_v1(x.value->>'service')=v_key
           AND x.value->>'categoryId' IS DISTINCT FROM v_category::text)
     THEN RETURN v_exact; END IF;
     IF private.taxonomy_risk_triage_v1(v_service) = 'REVIEW_REQUIRED'
        OR private.taxonomy_risk_triage_v1(v_category_label) = 'REVIEW_REQUIRED' THEN
       v_semantic:=v_semantic||jsonb_build_array(jsonb_build_object(
         'service',v_service,'mode',v_mode,'categoryId',v_category,
         'categoryLabel',v_category_label,'categoryParentId',v_category_parent,
         'reason',v_proposal->>'reason','catalogVersion',v_version));
     ELSE
       v_plan:=jsonb_build_object('action','REUSE_EXISTING','service',v_service,'mode',v_mode,
         'categoryId',v_category,'categoryLabel',v_category_label,'categoryParentId',v_category_parent,
         'reason',v_proposal->>'reason','catalogVersion',v_version);
       IF v_proposal?'handoff' THEN v_plan:=v_plan||jsonb_build_object('handoff',v_proposal->'handoff'); END IF;
       v_plans:=v_plans||jsonb_build_array(v_plan);
     END IF;
     CONTINUE;
   END IF;
   IF v_matches=1 AND v_proposal->>'action'='EXTEND_MODE' THEN
     IF (v_proposal->>'catalogVersion')::bigint<>v_version
       OR v_proposal->>'categoryId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       OR v_proposal->>'parentId'<>''
       OR v_proposal->'proposedPath' IS DISTINCT FROM '[]'::jsonb
       OR char_length(btrim(v_proposal->>'reason')) NOT BETWEEN 10 AND 1000
       OR private.taxonomy_risk_triage_v1(v_service) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
     THEN RETURN v_exact; END IF;
     v_category:=(v_proposal->>'categoryId')::uuid;
     SELECT count(DISTINCT c.id) INTO v_matches FROM private.work_taxonomy_categories c
       WHERE c.state<>'RETIRED' AND (c.canonical_key=v_key OR EXISTS(
         SELECT 1 FROM private.work_taxonomy_aliases a WHERE a.category_id=c.id AND a.normalized_key=v_key));
     SELECT c.label,c.parent_id INTO v_category_label,v_category_parent
       FROM private.work_taxonomy_categories c WHERE c.id=v_category AND c.state='ESTABLISHED'
       AND (v_matches=0 OR c.canonical_key=v_key OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
         WHERE a.category_id=c.id AND a.normalized_key=v_key));
     -- An explicit current-source ID may extend a semantic synonym too. A
     -- conflicting/ambiguous canonical or alias identity still cannot be replaced.
     IF v_matches NOT IN (0,1) OR v_category_label IS NULL
       OR private.taxonomy_risk_triage_v1(v_category_label) IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
       OR NOT private.taxonomy_category_path_valid_v1(v_category)
       OR (v_matches=0 AND EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
         WHERE child.parent_id=v_category AND child.state='ESTABLISHED'))
       OR EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes
         WHERE category_id=v_category AND execution_scope=v_mode)
     THEN RETURN v_exact; END IF;
     -- Proposal only: admission still requires the exact signed Save below.
     v_plan:=jsonb_build_object('action','EXTEND_MODE','service',v_service,'mode',v_mode,
       'categoryId',v_category,'categoryLabel',v_category_label,'categoryParentId',v_category_parent,
       'reason',v_proposal->>'reason','catalogVersion',v_version);
     IF v_proposal?'handoff' THEN v_plan:=v_plan||jsonb_build_object('handoff',v_proposal->'handoff'); END IF;
     v_plans:=v_plans||jsonb_build_array(v_plan);
     CONTINUE;
   END IF;
   IF v_matches<>1 OR v_proposal->>'action' NOT IN ('CREATE_CHILD','CREATE_NEW_BRANCH')
      OR v_proposal->>'categoryId'<>''
      OR (v_proposal->>'catalogVersion')::bigint<>v_version
      OR (v_proposal->>'action'='CREATE_CHILD' AND (v_proposal->>'parentId') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
      OR (v_proposal->>'action'='CREATE_NEW_BRANCH' AND v_proposal->>'parentId'<>'')
   THEN RETURN v_exact; END IF;
   v_path:=v_proposal->'proposedPath';
   IF jsonb_typeof(v_path)<>'array' OR jsonb_array_length(v_path)<1
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
       WHERE c.id=v_parent AND c.state='ESTABLISHED';
     IF v_parent_label IS NULL OR NOT private.taxonomy_category_path_valid_v1(v_parent)
     THEN RETURN v_exact; END IF;
   ELSE
     v_parent:=NULL;v_parent_label:=NULL;
     IF EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
       WHERE c.canonical_key=private.taxonomy_normalize_v1(v_path->>0))
     THEN RETURN v_exact; END IF;
   END IF;
   FOR v_step IN 0..jsonb_array_length(v_path)-1 LOOP
     v_label:=btrim(v_path->>v_step);
     IF jsonb_typeof(v_path->v_step) IS DISTINCT FROM 'string'
        OR char_length(v_label) NOT BETWEEN 3 AND 120
        OR v_label ~ '[<>{}\\]' OR v_label ~ '[[:cntrl:]]'
        OR private.taxonomy_risk_triage_v1(v_label) IN ('BLOCKED','REVIEW_REQUIRED')
        OR (v_step=jsonb_array_length(v_path)-1 AND
            private.taxonomy_risk_triage_v1(v_label) IS DISTINCT FROM 'LOW_RISK_CANDIDATE')
        OR char_length(private.taxonomy_normalize_v1(v_label)) NOT BETWEEN 3 AND 160
        OR private.taxonomy_normalize_v1(v_label) !~ '[[:alpha:]]'
        OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
          WHERE a.normalized_key=private.taxonomy_normalize_v1(v_label))
     THEN RETURN v_exact; END IF;
   END LOOP;
   v_plan:=jsonb_build_object(
     'action',v_proposal->>'action','service',v_service,'mode',v_mode,
     'parentId',v_parent,'parentLabel',v_parent_label,'path',v_path,
     'reason',v_proposal->>'reason','catalogVersion',v_version);
   IF v_proposal?'handoff' THEN v_plan:=v_plan||jsonb_build_object('handoff',v_proposal->'handoff'); END IF;
   v_plans:=v_plans||jsonb_build_array(v_plan);
 END LOOP;
 -- A deep path is bounded by the writer's byte budget, not an arbitrary
 -- number of levels. Never display READY for a batch the writer cannot accept.
 IF pg_column_size(v_plans)>16000 THEN RETURN v_exact; END IF;
 -- The batch writer checks the same fingerprint under a catalog row lock.
 -- Here it protects the owner from accepting a mixed-version review.
 IF v_version IS DISTINCT FROM (SELECT catalog_version
      FROM private.work_taxonomy_control WHERE singleton=true)
    OR v_fingerprint IS DISTINCT FROM private.taxonomy_admission_fingerprint_v1()
 THEN RETURN v_exact; END IF;
 IF v_semantic<>'[]'::jsonb THEN
   -- Never present a sensitive semantic comparison as accepted. The user must compare and
   -- expressly confirm the exact meaning in a separately signed review.
   RETURN jsonb_build_object('status','REVIEW_REQUIRED',
     'classificationCandidates','[]'::jsonb,'reviewedServiceModes','[]'::jsonb,
     'semanticReviewCandidates',v_semantic,'visibleServices',v_visible,
     'classificationCatalogVersion',v_version,
     'classificationCatalogFingerprint',v_fingerprint,
     'classificationAuthority','NONE','capabilityAuthority','NONE',
     'notificationAuthority','NONE');
 END IF;
 RETURN jsonb_build_object('status','READY','classificationCandidates',v_plans,
   'reviewedServiceModes',CASE WHEN p_purpose='WORKER_CAPABILITY'
     THEN v_visible ELSE '[]'::jsonb END,
   'visibleServices',v_visible,'classificationCatalogVersion',v_version,
   'classificationCatalogFingerprint',v_fingerprint);
END $function$
;

DO $rollback_check$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'::regprocedure)
     IS DISTINCT FROM 'f439455e1d5edb63ae4297a5c922a3c5'
  THEN RAISE EXCEPTION 'REVIEW_RESOLVED_REUSE_ROLLBACK_POSTIMAGE_DRIFT'; END IF;
END
$rollback_check$;

COMMIT;
