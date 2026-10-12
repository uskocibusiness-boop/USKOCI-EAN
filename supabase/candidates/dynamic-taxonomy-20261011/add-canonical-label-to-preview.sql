-- Add canonicalLabel to taxonomy_existing_ai_category_preview_v1
CREATE OR REPLACE FUNCTION private.taxonomy_existing_ai_category_preview_v1(
 p_ai_category text,
 p_public_description text,
 p_explicit_required_skills text[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,private
AS $adapter$
DECLARE
 v_label text;
 v_result jsonb;
 v_kind text;
 v_normalized_description text;
BEGIN
 IF p_ai_category IS NULL OR char_length(btrim(p_ai_category)) NOT BETWEEN 3 AND 120
    OR p_ai_category ~ '[<>{}\\]' OR p_ai_category ~ '[[:cntrl:]]'
 THEN RETURN jsonb_build_object(
   'action','CLARIFY','reason','INVALID_CATEGORY_LABEL',
   'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;
 v_label:=btrim(p_ai_category);
 v_normalized_description:=private.taxonomy_normalize_v1(coalesce(p_public_description,''));
 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_risk_rules r
  WHERE r.enabled AND r.decision='BLOCKED'
    AND (v_normalized_description ~ r.pattern
         OR private.taxonomy_normalize_v1(v_label) ~ r.pattern)
 ) THEN RETURN jsonb_build_object(
   'action','REJECT','reason','POSSIBLY_PROHIBITED_CONTENT',
   'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;
 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_risk_rules r
  WHERE r.enabled AND r.decision='REVIEW_REQUIRED'
    AND (v_normalized_description ~ r.pattern
         OR private.taxonomy_normalize_v1(v_label) ~ r.pattern)
 ) THEN RETURN jsonb_build_object(
   'action','SAFETY_REVIEW','reason','POSSIBLY_REGULATED_CONTENT',
   'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;
 v_result:=private.taxonomy_preview_v1(v_label);
 v_kind:=v_result->>'action';
 IF v_kind='REJECT' OR v_kind='SAFETY_REVIEW' THEN
  RETURN jsonb_build_object(
    'action',v_kind,
    'reason',coalesce(v_result->>'reason','CATALOG_RISK_POLICY'),
    'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;
 IF v_kind='CLARIFY' THEN
  RETURN jsonb_build_object(
    'action','CLARIFY','reason',coalesce(v_result->>'reason','UNVERIFIED_WORK_MEANING'),
    'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;
 IF v_kind='REUSE_EXISTING' THEN
  RETURN jsonb_build_object(
    'action','SUGGEST_EXISTING_SERVICE',
    'categoryId',v_result->'categoryId',
    'canonicalLabel',(SELECT label FROM private.work_taxonomy_categories WHERE id = (v_result->>'categoryId')::uuid),
    'catalogVersion',v_result->'catalogVersion',
    'requiresRequesterReview',true,
    'requiresTaskRevisionBinding',true,
    'requiresFullEligibility',true,
    'explicitRequiredSkillsPresent',cardinality(p_explicit_required_skills)>0,
    'descriptionSemanticallyVerified',false,
    'classificationAuthority','NONE',
    'notificationAuthority','NONE');
 END IF;
 IF v_kind='PROPOSE_AUTO_PROVISIONAL' THEN
  RETURN jsonb_build_object(
    'action','NOVEL_SERVICE_REVIEW',
    'reason','SERVER_SEMANTIC_ADMISSION_PENDING',
    'normalizedKey',v_result->'normalizedKey',
    'catalogVersion',v_result->'catalogVersion',
    'requiresRequesterReview',true,
    'requiresSemanticDeduplication',true,
    'requiresSafetyReview',true,
    'classificationAuthority','NONE',
    'notificationAuthority','NONE');
 END IF;
 RETURN jsonb_build_object(
  'action','CLARIFY','reason','CATALOG_LOOKUP_UNAVAILABLE',
  'classificationAuthority','NONE','notificationAuthority','NONE');
END
$adapter$;
REVOKE ALL ON FUNCTION private.taxonomy_existing_ai_category_preview_v1(text,text,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.taxonomy_existing_ai_category_preview_v1(text,text,text[]) TO service_role;
