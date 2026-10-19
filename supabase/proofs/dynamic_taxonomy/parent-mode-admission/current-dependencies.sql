CREATE OR REPLACE FUNCTION private.taxonomy_admission_fingerprint_v1()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
SELECT md5(
 coalesce((SELECT string_agg(c.id::text||'/'||c.canonical_key||'/'||
      coalesce(c.parent_id::text,'ROOT')||'/'||c.state||'/'||c.catalog_version::text,'|' ORDER BY c.id::text)
      FROM private.work_taxonomy_categories c),'')
 || '#'
 || coalesce((SELECT string_agg(m.category_id::text||'/'||m.execution_scope,'|' ORDER BY m.category_id::text,m.execution_scope)
      FROM private.work_taxonomy_category_modes m),'')
 || '#'
 || coalesce((SELECT string_agg(a.category_id::text||'/'||a.locale||'/'||a.normalized_key,'|' ORDER BY a.category_id::text,a.locale,a.normalized_key)
      FROM private.work_taxonomy_aliases a),'')
);
$function$;

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
     IF v_identity=ANY(v_refs) THEN v_status:='REVIEW_REQUIRED';EXIT; END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION private.taxonomy_risk_triage_v1(p_label text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE v_key text;
BEGIN
 v_key:=private.taxonomy_normalize_v1(p_label);
 -- Screening is not semantic classification or proof of safety. Apply the
 -- enabled server rules before ambiguity checks so broad or single-word
 -- labels cannot hide a regulated/prohibited meaning behind CLARIFY.
 IF EXISTS (SELECT 1 FROM private.work_taxonomy_risk_rules
            WHERE enabled AND decision='BLOCKED' AND v_key ~ pattern)
 THEN RETURN 'BLOCKED'; END IF;
 IF EXISTS (SELECT 1 FROM private.work_taxonomy_risk_rules
            WHERE enabled AND decision='REVIEW_REQUIRED' AND v_key ~ pattern)
 THEN RETURN 'REVIEW_REQUIRED'; END IF;
 IF p_label IS NULL OR char_length(btrim(p_label)) NOT BETWEEN 3 AND 120
    OR p_label ~ '[<>{}\\]' OR p_label ~ '[[:cntrl:]]'
    OR v_key IS NULL OR char_length(v_key)<6 OR v_key !~ '^[[:alnum:]]'
    OR v_key !~ '[[:alpha:]]' OR v_key !~ '[[:space:]]' THEN
   RETURN 'NEEDS_CLARIFICATION';
 END IF;
 IF v_key ~ '(^|[[:space:]])(ostalo|drugo|razno|sve|svasta)($|[[:space:]])'
    OR v_key IN ('digitalni zanati','digitalne usluge','kucne usluge',
      'zanatske usluge','fizicki poslovi','rucni rad','bilo sta')
 THEN RETURN 'NEEDS_CLARIFICATION'; END IF;
 -- Natural noun phrases (3D stampa, casovi engleskog, setnja pasa) must not
 -- depend on the first word being in a small Serbian action-verb allowlist.
 -- Existing model semantic/safety review and owner-signed Save are still
 -- required. A candidate result grants no competence or catalog authority.
 RETURN 'LOW_RISK_CANDIDATE';
END
$function$;

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

-- Exact ACLs of current functions in the isolated fixture.
REVOKE ALL ON FUNCTION private.taxonomy_admission_fingerprint_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.taxonomy_admission_fingerprint_v1() TO service_role;
REVOKE ALL ON FUNCTION private.taxonomy_ai_catalog_context_v1(text,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.taxonomy_ai_catalog_context_v1(text,integer,text) TO service_role;
REVOKE ALL ON FUNCTION private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.taxonomy_review_exact_projection_v1(text,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.taxonomy_risk_triage_v1(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.taxonomy_risk_triage_v1(text) TO service_role;
REVOKE ALL ON FUNCTION private.taxonomy_scope_eligible_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION rpc_taxonomy_bind_reviewed_need_service(uuid,uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION rpc_taxonomy_bind_reviewed_need_service(uuid,uuid,uuid,uuid,integer) TO service_role;
REVOKE ALL ON FUNCTION rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb) TO service_role;
REVOKE ALL ON FUNCTION rpc_taxonomy_commit_admission_service(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION rpc_taxonomy_commit_admission_service(uuid) TO service_role;
REVOKE ALL ON FUNCTION rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION rpc_taxonomy_prepare_admission_service(uuid,uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION rpc_taxonomy_prepare_admission_service(uuid,uuid,text,uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION rpc_taxonomy_query_catalog_service(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION rpc_taxonomy_query_catalog_service(jsonb) TO service_role;
