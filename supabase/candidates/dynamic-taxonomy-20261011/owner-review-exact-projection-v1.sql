-- Gate A, source-only: canonical EXACT/VERIFIED ALIAS owner-review projection.
-- This is NOT a second review RPC and has NO write/activation/dispatch authority.
-- Only trusted existing review builders may call it with their authoritative
-- current profile skills / need.category and actually selected per-service modes.
-- The result must be added to the displayed, digest-signed review envelope.
-- Requires owner-reviewed-admission-v1.sql fingerprint function already installed.
-- Do NOT deploy before both review builders, UI projection and compatibility gates.
BEGIN;
CREATE OR REPLACE FUNCTION private.taxonomy_review_exact_projection_v1(
 p_purpose text,p_services jsonb,p_service_modes jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
 SET search_path=pg_catalog,private
AS $projection$
DECLARE
 v_version bigint;v_fingerprint text;v_after text;v_version_after bigint;
 v_item jsonb;v_service text;v_mode text;v_key text;v_identity text;
 v_services text[]:=ARRAY[]::text[];v_modes text[]:=ARRAY[]::text[];
 v_refs text[]:=ARRAY[]::text[];v_plan jsonb;v_results jsonb:='[]'::jsonb;
 v_visible jsonb:='[]'::jsonb;v_reviewed_modes jsonb:='[]'::jsonb;
 v_category uuid;v_matches integer;v_idx integer;v_service_key text;v_scope_count integer;
 v_status text:='READY';
BEGIN
 IF p_purpose NOT IN ('WORKER_CAPABILITY','NEED_SERVICE')
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
       SELECT x#>>'{}' FROM jsonb_array_elements(p_services) x
       WHERE private.taxonomy_normalize_v1(x#>>'{}')=v_key LIMIT 1);
     v_visible:=v_visible||jsonb_build_array(
       jsonb_build_object('service',v_service,'mode',v_mode));
   END LOOP;
   IF p_purpose='NEED_SERVICE' AND jsonb_array_length(v_visible)<>1 THEN
     v_status:='REVIEW_REQUIRED';
   END IF;
   IF EXISTS (SELECT 1 FROM unnest(v_services) s
       WHERE NOT EXISTS (SELECT 1 FROM unnest(v_modes) m
                         WHERE split_part(m,'|',1)=s)) THEN
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
     SELECT count(DISTINCT c.id),min(c.id) INTO v_matches,v_category
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
END $projection$;
REVOKE ALL ON FUNCTION private.taxonomy_review_exact_projection_v1(text,jsonb,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
