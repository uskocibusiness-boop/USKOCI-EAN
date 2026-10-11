-- SOURCE-ONLY candidate: narrowly verified natural task parsing (read-only).
-- No LLM inference, no category writes, no worker eligibility, no dispatch.
-- Action/scope and sentence prefixes come from separate reviewed data.
BEGIN;
CREATE TABLE private.work_taxonomy_sentence_prefixes (
 normalized_prefix text PRIMARY KEY,
 provenance_ref text NOT NULL CHECK (char_length(provenance_ref) BETWEEN 3 AND 200),
 CHECK (char_length(normalized_prefix) BETWEEN 6 AND 120),
 CHECK (normalized_prefix = private.taxonomy_normalize_v1(normalized_prefix))
);
ALTER TABLE private.work_taxonomy_sentence_prefixes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.work_taxonomy_sentence_prefixes FROM PUBLIC;
GRANT SELECT ON private.work_taxonomy_sentence_prefixes TO service_role;

-- This bounded grammar intentionally prefers CLARIFY over semantic guessing.
-- Risk scan covers the FULL sentence before trimming a conversational prefix.
CREATE OR REPLACE FUNCTION private.taxonomy_natural_task_preview_v1(p_task text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,private
AS $natural$
DECLARE
 v_raw text;
 v_body text;
 v_prefix text;
 v_area_txt text;
 v_area integer;
 v_subject text;
 v_ids uuid[];
 v_version bigint;
 v_action text;
 v_scope text;
BEGIN
 IF p_task IS NULL OR char_length(btrim(p_task)) NOT BETWEEN 7 AND 1000
    OR p_task ~ '[<>{}\\]' OR p_task ~ '[[:cntrl:]]'
 THEN RETURN jsonb_build_object('action','CLARIFY','reason','INVALID_TEXT',
                                'notificationAuthority','NONE'); END IF;
 -- Sentence-ending punctuation is presentation, never an extra skill.
 -- Strip only a terminal . ! or ?, not conjunctions or arbitrary clauses.
 v_raw:=regexp_replace(private.taxonomy_normalize_v1(p_task),
                        '[[:space:]]*[.!?]+[[:space:]]*
 IF EXISTS (
   SELECT 1 FROM private.work_taxonomy_risk_rules r
   WHERE r.enabled AND r.decision='BLOCKED' AND v_raw ~ r.pattern
 ) THEN RETURN jsonb_build_object('action','REJECT','reason','PROHIBITED_CONTENT',
                                   'notificationAuthority','NONE'); END IF;
 IF EXISTS (
   SELECT 1 FROM private.work_taxonomy_risk_rules r
   WHERE r.enabled AND r.decision='REVIEW_REQUIRED' AND v_raw ~ r.pattern
 ) THEN RETURN jsonb_build_object('action','SAFETY_REVIEW',
                                   'reason','POSSIBLY_REGULATED_CONTENT',
                                   'notificationAuthority','NONE'); END IF;

 -- Prefixes are vetted, non-user-editable data. Prefer longest matching one.
 SELECT x.normalized_prefix INTO v_prefix
 FROM private.work_taxonomy_sentence_prefixes x
 WHERE v_raw LIKE x.normalized_prefix||' %'
 ORDER BY char_length(x.normalized_prefix) DESC
 LIMIT 1;
 IF v_prefix IS NOT NULL THEN
   v_body:=substr(v_raw,char_length(v_prefix)+2);
 ELSE
   v_body:=v_raw;
 END IF;
 -- Only one explicit area format is safe to extract automatically here.
 -- Do NOT discard other tails, conjunctions, prices or qualifications.
 v_area_txt:=substring(v_body FROM
   '[[:space:]]+od[[:space:]]+([1-9][0-9]{0,3})[[:space:]]*(kvadrata|m2|m²)$');
 IF v_area_txt IS NOT NULL THEN
   v_area:=v_area_txt::integer;
   v_body:=regexp_replace(v_body,
     '[[:space:]]+od[[:space:]]+[1-9][0-9]{0,3}[[:space:]]*(kvadrata|m2|m²)$','');
 END IF;
 v_subject:=v_body;
 v_action:=split_part(v_subject,' ',1);
 v_scope:=substr(v_subject,char_length(v_action)+2);
 -- Avoid a bare "paint" action matching all kinds of objects.
 IF v_scope IS NULL OR char_length(v_scope)<3 THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','MISSING_VERIFIED_SCOPE',
                             'notificationAuthority','NONE'); END IF;
 SELECT catalog_version INTO v_version
 FROM private.work_taxonomy_control WHERE singleton=true;
 IF v_version IS NULL THEN RETURN jsonb_build_object('action','UNAVAILABLE',
   'reason','CATALOG_UNAVAILABLE','notificationAuthority','NONE'); END IF;

 -- Shared exact service resolver; no model-proposed IDs or freeform similarity.
 v_ids:=private.taxonomy_service_meaning_ids_v1(v_subject);
 IF coalesce(cardinality(v_ids),0)>1 THEN
  RETURN jsonb_build_object('action','CLARIFY','reason','AMBIGUOUS_SERVICE',
                            'catalogVersion',v_version,
                            'notificationAuthority','NONE');
 END IF;
 IF coalesce(cardinality(v_ids),0)=1 THEN
  RETURN jsonb_build_object(
   'action','REUSE_EXISTING','categoryId',v_ids[1],
   'normalizedAction',v_action,'normalizedScope',v_scope,
   'areaSqm',v_area,'catalogVersion',v_version,
   'requiresRequesterReview',true,'requiresFullEligibility',true,
   'proofType','VERIFIED_GRAMMAR','notificationAuthority','NONE');
 END IF;
 RETURN jsonb_build_object(
   'action','CLARIFY','reason','UNVERIFIED_SERVICE_OR_COMPOUND_TASK',
   'normalizedAction',v_action,'catalogVersion',v_version,
   'notificationAuthority','NONE');
END
$natural$;
REVOKE ALL ON FUNCTION private.taxonomy_natural_task_preview_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.taxonomy_natural_task_preview_v1(text) TO service_role;
COMMIT;
,'');
 IF EXISTS (
   SELECT 1 FROM private.work_taxonomy_risk_rules r
   WHERE r.enabled AND r.decision='BLOCKED' AND v_raw ~ r.pattern
 ) THEN RETURN jsonb_build_object('action','REJECT','reason','PROHIBITED_CONTENT',
                                   'notificationAuthority','NONE'); END IF;
 IF EXISTS (
   SELECT 1 FROM private.work_taxonomy_risk_rules r
   WHERE r.enabled AND r.decision='REVIEW_REQUIRED' AND v_raw ~ r.pattern
 ) THEN RETURN jsonb_build_object('action','SAFETY_REVIEW',
                                   'reason','POSSIBLY_REGULATED_CONTENT',
                                   'notificationAuthority','NONE'); END IF;

 -- Prefixes are vetted, non-user-editable data. Prefer longest matching one.
 SELECT x.normalized_prefix INTO v_prefix
 FROM private.work_taxonomy_sentence_prefixes x
 WHERE v_raw LIKE x.normalized_prefix||' %'
 ORDER BY char_length(x.normalized_prefix) DESC
 LIMIT 1;
 IF v_prefix IS NOT NULL THEN
   v_body:=substr(v_raw,char_length(v_prefix)+2);
 ELSE
   v_body:=v_raw;
 END IF;
 -- Only one explicit area format is safe to extract automatically here.
 -- Do NOT discard other tails, conjunctions, prices or qualifications.
 v_area_txt:=substring(v_body FROM
   '[[:space:]]+od[[:space:]]+([1-9][0-9]{0,3})[[:space:]]*(kvadrata|m2|m²)$');
 IF v_area_txt IS NOT NULL THEN
   v_area:=v_area_txt::integer;
   v_body:=regexp_replace(v_body,
     '[[:space:]]+od[[:space:]]+[1-9][0-9]{0,3}[[:space:]]*(kvadrata|m2|m²)$','');
 END IF;
 v_subject:=v_body;
 v_action:=split_part(v_subject,' ',1);
 v_scope:=substr(v_subject,char_length(v_action)+2);
 -- Avoid a bare "paint" action matching all kinds of objects.
 IF v_scope IS NULL OR char_length(v_scope)<3 THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','MISSING_VERIFIED_SCOPE',
                             'notificationAuthority','NONE'); END IF;
 SELECT catalog_version INTO v_version
 FROM private.work_taxonomy_control WHERE singleton=true;
 IF v_version IS NULL THEN RETURN jsonb_build_object('action','UNAVAILABLE',
   'reason','CATALOG_UNAVAILABLE','notificationAuthority','NONE'); END IF;

 -- Shared exact service resolver; no model-proposed IDs or freeform similarity.
 v_ids:=private.taxonomy_service_meaning_ids_v1(v_subject);
 IF coalesce(cardinality(v_ids),0)>1 THEN
  RETURN jsonb_build_object('action','CLARIFY','reason','AMBIGUOUS_SERVICE',
                            'catalogVersion',v_version,
                            'notificationAuthority','NONE');
 END IF;
 IF coalesce(cardinality(v_ids),0)=1 THEN
  RETURN jsonb_build_object(
   'action','REUSE_EXISTING','categoryId',v_ids[1],
   'normalizedAction',v_action,'normalizedScope',v_scope,
   'areaSqm',v_area,'catalogVersion',v_version,
   'requiresRequesterReview',true,'requiresFullEligibility',true,
   'proofType','VERIFIED_GRAMMAR','notificationAuthority','NONE');
 END IF;
 RETURN jsonb_build_object(
   'action','CLARIFY','reason','UNVERIFIED_SERVICE_OR_COMPOUND_TASK',
   'normalizedAction',v_action,'catalogVersion',v_version,
   'notificationAuthority','NONE');
END
$natural$;
REVOKE ALL ON FUNCTION private.taxonomy_natural_task_preview_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.taxonomy_natural_task_preview_v1(text) TO service_role;
COMMIT;
