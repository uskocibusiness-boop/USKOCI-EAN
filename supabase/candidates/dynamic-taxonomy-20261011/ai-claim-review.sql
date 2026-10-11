-- SOURCE-ONLY guard for an eventual AI extraction proposal.
-- AI suggestions are NEVER allowed to confer category, worker or push authority.
-- Verify the candidate against independently recognized user text and a trusted
-- action/object/scope grammar; final action is still requester's review, not save.
BEGIN;
CREATE OR REPLACE FUNCTION private.taxonomy_ai_claim_review_v1(
 p_original_task text, p_claim jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,private
AS $review$
DECLARE
 v_server jsonb;
 v_decision text;
BEGIN
 -- Always inspect the actual original task FIRST, even for malformed AI JSON.
 v_server:=private.taxonomy_natural_task_preview_v1(p_original_task);
 v_decision:=v_server->>'action';
 IF v_decision <> 'REUSE_EXISTING' THEN
   RETURN jsonb_build_object(
    'action',v_decision,'reason',coalesce(v_server->>'reason','NOT_VERIFIED'),
    'publishAuthority','NONE','notificationAuthority','NONE');
 END IF;
 IF p_claim IS NULL OR jsonb_typeof(p_claim)<>'object'
 OR NOT (p_claim ? 'categoryId')
 OR NOT (p_claim ? 'normalizedAction')
 OR NOT (p_claim ? 'normalizedScope')
 OR NOT (p_claim ? 'areaSqm')
 OR p_claim->>'categoryId' IS DISTINCT FROM v_server->>'categoryId'
 OR p_claim->>'normalizedAction' IS DISTINCT FROM v_server->>'normalizedAction'
 OR p_claim->>'normalizedScope' IS DISTINCT FROM v_server->>'normalizedScope'
 OR p_claim->>'areaSqm' IS DISTINCT FROM v_server->>'areaSqm'
 OR jsonb_typeof(p_claim->'categoryId') <> 'string'
 OR jsonb_typeof(p_claim->'normalizedAction') <> 'string'
 OR jsonb_typeof(p_claim->'normalizedScope') <> 'string'
 OR jsonb_typeof(p_claim->'areaSqm') NOT IN ('number','null') THEN
   RETURN jsonb_build_object('action','CLARIFY',
       'reason','AI_CLAIM_NOT_VERIFIED','publishAuthority','NONE',
       'notificationAuthority','NONE');
 END IF;
 RETURN jsonb_build_object(
   'action','READY_FOR_REQUESTER_REVIEW',
   'categoryId',v_server->>'categoryId',
   'normalizedAction',v_server->>'normalizedAction',
   'normalizedScope',v_server->>'normalizedScope',
   'areaSqm',v_server->'areaSqm',
   'catalogVersion',(v_server->>'catalogVersion')::bigint,
   'proofType','INDEPENDENT_SERVER_GRAMMAR',
   'requiresRequesterReview',true,
   'requiresFullEligibility',true,
   'publishAuthority','NONE','notificationAuthority','NONE');
END
$review$;
REVOKE ALL ON FUNCTION private.taxonomy_ai_claim_review_v1(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.taxonomy_ai_claim_review_v1(text,jsonb) TO service_role;
COMMIT;
