-- SOURCE ONLY: a read-only adapter for the EXISTING Gemini NEED_FACT_V2
-- interview's need.category + need.description, NOT a second chatbot.
-- Never trusts a model category ID or invents worker skills. NOT DEPLOYED.
BEGIN;
CREATE OR REPLACE FUNCTION private.taxonomy_existing_ai_category_preview_v1(
 p_ai_category text, p_public_description text, p_explicit_required_skills text[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,private
AS $adapter$
DECLARE
 v_result jsonb;
 v_description text;
 v_label text;
 v_normalized_description text;
 v_category_ids uuid[];
 v_category_id uuid;
 v_version bigint;
 v_kind text;
BEGIN
 -- The existing interview can compose long, natural-language descriptions.
 -- Their grammar is NOT re-parsed as a fixed short sentence template.
 IF p_ai_category IS NULL OR char_length(btrim(p_ai_category)) NOT BETWEEN 3 AND 120
 OR p_public_description IS NULL
 OR char_length(btrim(p_public_description)) NOT BETWEEN 3 AND 6000
 OR p_ai_category ~ '[<>{}\\]' OR p_ai_category ~ '[[:cntrl:]]'
 OR p_public_description ~ '[<>{}\\]' OR p_public_description ~ '[[:cntrl:]]'
 THEN RETURN jsonb_build_object(
   'action','CLARIFY','reason','AI_CATEGORY_OR_DESCRIPTION_INVALID',
   'classificationAuthority','NONE','notificationAuthority','NONE'
 ); END IF;
 -- The model can only suggest a label, never a confirmed category UUID.
 -- Do not manufacture an array of requirements if the owner did not set it.
 IF p_explicit_required_skills IS NULL THEN
  RETURN jsonb_build_object(
   'action','CLARIFY','reason','EXPLICIT_REQUIREMENTS_UNKNOWN',
   'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;
 IF cardinality(p_explicit_required_skills)>40
 OR EXISTS(SELECT 1 FROM unnest(p_explicit_required_skills) AS skill
           WHERE skill IS NULL OR char_length(btrim(skill)) NOT BETWEEN 2 AND 120)
 THEN RETURN jsonb_build_object(
   'action','CLARIFY','reason','EXPLICIT_REQUIREMENTS_INVALID',
   'classificationAuthority','NONE','notificationAuthority','NONE');
 END IF;
 v_label:=btrim(p_ai_category);
 v_description:=btrim(p_public_description);
 v_normalized_description:=private.taxonomy_normalize_v1(v_description);
 -- A short label must never hide unsafe or regulated meaning from the
 -- original full AI-synthesized PUBLIC description.
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
 -- Resolve the proposed *kind of work* using the trusted, shared canonical
 -- catalog. It can reuse 11 legacy kinds once backfilled/verified, or
 -- new validated service IDs. No "one category per room" proliferation.
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
  -- This is ONLY a candidate for confirmation, NEVER "worker matched".
  -- Explicit owner requirements MUST still be checked independently by
  -- the canonical matcher. Do not copy category to required_skills.
  RETURN jsonb_build_object(
    'action','SUGGEST_EXISTING_SERVICE',
    'categoryId',v_result->'categoryId',
    'catalogVersion',v_result->'catalogVersion',
    'requiresRequesterReview',true,
    'requiresTaskRevisionBinding',true,
    'requiresFullEligibility',true,
    'explicitRequiredSkillsPresent',cardinality(p_explicit_required_skills)>0,
    'descriptionSemanticallyVerified',false,
    'classificationAuthority','NONE',
    'notificationAuthority','NONE');
 END IF;
 -- A novel "AI.category" can be an entirely new legitimate service, but a
 -- model's asserted novelty MUST NOT automatically become a DB or send event.
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
COMMIT;
