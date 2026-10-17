-- DEV targeted repair: verify blocked/regulated risks FIRST, then exact established
-- category/stored alias BEFORE vocabulary-only ambiguity screening.
-- Vocabulary is for NEW unknown meanings; it must not hide an approved category.
-- No category/alias/admission writes, no capability, no matching or notifications.
-- Source rollback: redeploy the original catalog-preview.sql after review.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$
BEGIN
 IF to_regprocedure('private.taxonomy_preview_v1(text)') IS NULL
 OR to_regprocedure('private.taxonomy_risk_triage_v1(text)') IS NULL
 OR to_regclass('private.work_taxonomy_categories') IS NULL
 OR to_regclass('private.work_taxonomy_aliases') IS NULL
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'TAXONOMY_PREVIEW_ORDER_PRECONDITION_FAILED'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION private.taxonomy_preview_v1(p_label text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,private
AS $preview$
DECLARE
 v_key text;
 v_risk text;
 v_ids uuid[];
 v_version bigint;
 v_auto_enabled boolean;
BEGIN
 IF p_label IS NULL OR char_length(btrim(p_label)) NOT BETWEEN 3 AND 120
    OR p_label ~ '[<>{}\\]' OR p_label ~ '[[:cntrl:]]'
 THEN RETURN jsonb_build_object('action','CLARIFY','reason','INVALID_LABEL',
                                'notificationAuthority','NONE'); END IF;
 v_key:=private.taxonomy_normalize_v1(p_label);
 v_risk:=private.taxonomy_risk_triage_v1(p_label);
 IF v_risk='BLOCKED' THEN
  RETURN jsonb_build_object('action','REJECT','reason','PROHIBITED_WORK',
                            'notificationAuthority','NONE');
 ELSIF v_risk='REVIEW_REQUIRED' THEN
  RETURN jsonb_build_object('action','SAFETY_REVIEW','reason','REGULATED_OR_RISKY_WORK',
                            'notificationAuthority','NONE');
 END IF;
 -- Do not use a narrow action-verb vocabulary to hide ALREADY ESTABLISHED work.
 -- Only exact registered category identity or a STORED alias may bypass it.
 -- Semantic/meaning hints are considered only for independently low-risk labels.
 SELECT catalog_version,auto_registration_enabled
 INTO v_version,v_auto_enabled
 FROM private.work_taxonomy_control WHERE singleton=true;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('action','UNAVAILABLE','reason','CATALOG_UNAVAILABLE',
                            'notificationAuthority','NONE');
 END IF;
 SELECT array_agg(DISTINCT t.category_id)
 INTO v_ids FROM (
   SELECT c.id AS category_id FROM private.work_taxonomy_categories c
    WHERE c.canonical_key=v_key AND c.state<>'RETIRED'
   UNION
   SELECT a.category_id FROM private.work_taxonomy_aliases a
   JOIN private.work_taxonomy_categories c
     ON c.id=a.category_id
   WHERE a.normalized_key=v_key AND c.state<>'RETIRED'
   UNION
   SELECT unnest(private.taxonomy_service_meaning_ids_v1(p_label))
   WHERE v_risk='LOW_RISK_CANDIDATE'
 ) t;
 IF coalesce(cardinality(v_ids),0)>1 THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','AMBIGUOUS_ALIAS_COLLISION',
                             'catalogVersion',v_version,'notificationAuthority','NONE');
 END IF;
 IF coalesce(cardinality(v_ids),0)=1 THEN
   RETURN jsonb_build_object('action','REUSE_EXISTING','categoryId',v_ids[1],
                             'catalogVersion',v_version,'requiresRequesterReview',true,
                             'notificationAuthority','NONE');
 END IF;
 IF v_risk<>'LOW_RISK_CANDIDATE' THEN
   RETURN jsonb_build_object('action','CLARIFY','reason','WORK_MEANING_UNCLEAR',
                             'notificationAuthority','NONE');
 END IF;
 IF private.taxonomy_service_needs_disambiguation_v1(p_label) THEN
   RETURN jsonb_build_object('action','CLARIFY',
                             'reason','POSSIBLE_EXISTING_SERVICE',
                             'catalogVersion',v_version,
                             'notificationAuthority','NONE');
 END IF;
 -- Candidate ID is never invented by the model or this preview.
 -- This preview cannot commit even if the operator enables auto-registration.
 RETURN jsonb_build_object(
   'action','PROPOSE_AUTO_PROVISIONAL',
   'normalizedKey',v_key,'catalogVersion',v_version,
   'requiresRequesterReview',true,'requiresServerAdmission',true,
   'registrationEnabled',v_auto_enabled,'notificationAuthority','NONE');
END
$preview$;
REVOKE ALL ON FUNCTION private.taxonomy_preview_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.taxonomy_preview_v1(text) TO service_role;
COMMIT;
