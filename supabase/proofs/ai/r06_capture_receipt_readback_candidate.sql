-- R06 LOCAL-ONLY CANDIDATE. Not a migration, rollout or active Edge dependency.
-- Reads the existing capture record only; creates no attempt/job/payload copy.
-- CAPTURE_PRESENT is a historical operation receipt, NOT current applicability,
-- semantic admission, owner consent, READY/Save/binding or provider usage proof.
-- CAPTURE_UNCONFIRMED does not prove nonexecution and never permits a paid retry.
-- Future rollout needs its own current-schema/R01/R10/ACL and compatibility proof.
BEGIN;
DO $r06$
DECLARE expected record;
BEGIN
 IF current_setting('uskoci.r06_capture_receipt.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
    OR current_user<>'postgres' OR current_database()<>'postgres'
    OR to_regrole('cli_login_postgres') IS NOT NULL THEN
   RAISE EXCEPTION 'R06_CAPTURE_RECEIPT_DISPOSABLE_ONLY' USING errcode='55000';
 END IF;
 IF to_regprocedure('public.rpc_taxonomy_read_gemini_turn_hint_receipt_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)') IS NOT NULL THEN
   RAISE EXCEPTION 'R06_CAPTURE_RECEIPT_ALREADY_EXISTS' USING errcode='55000';
 END IF;
 FOR expected IN SELECT * FROM (VALUES
   ('public.rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)','2e8a861398c36a4efc23fa961b45897b'),
   ('private.closure_assert_open(uuid,uuid)','dc9bc4c718593850da4fdb49e612dbd2'),
   ('private.closure_account_key(uuid)','2dde6ad2462255b188e4f03ffe88edcd'),
   ('private.closure_account_restricted(uuid)','f4999250c315e0253374d4611291c7ad')
 ) AS pins(signature,source_md5) LOOP
   IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure(expected.signature))
      IS DISTINCT FROM expected.source_md5 THEN
     RAISE EXCEPTION 'R06_CAPTURE_RECEIPT_SOURCE_DRIFT' USING errcode='55000';
   END IF;
 END LOOP;
END $r06$;

CREATE FUNCTION public.rpc_taxonomy_read_gemini_turn_hint_receipt_service(
 p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid,
 p_turn_id uuid, p_attempt_id uuid, p_purpose text, p_catalog_version bigint, p_proposals jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 v_row private.work_taxonomy_gemini_turn_hints_v1%ROWTYPE;
 v_count integer; v_digest text;
 v_receipt jsonb:=jsonb_build_object('schemaVersion','TAXONOMY_CAPTURE_RECEIPT_V1',
   'state','CAPTURE_UNCONFIRMED','authority','NONE',
   'applicability','NOT_EVALUATED','retryAllowed',false);
BEGIN
 -- The API role grant and actual JWT role are independent requirements.
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_RECEIPT_DENIED' USING errcode='42501';
 END IF;
 IF p_account_id IS NULL OR p_conversation_id IS NULL OR p_client_request_id IS NULL
    OR p_turn_id IS NULL OR p_attempt_id IS NULL OR p_purpose IS NULL
    OR p_purpose NOT IN ('WORKER_CAPABILITY','NEED_SERVICE')
    OR coalesce(p_catalog_version,0)<1
    OR jsonb_typeof(p_proposals) IS DISTINCT FROM 'array'
    OR pg_column_size(p_proposals)>18000 THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_RECEIPT_INVALID' USING errcode='22023';
 END IF;
 v_count:=jsonb_array_length(p_proposals);
 IF (p_purpose='WORKER_CAPABILITY' AND v_count NOT BETWEEN 1 AND 24)
    OR (p_purpose='NEED_SERVICE' AND v_count NOT BETWEEN 1 AND 6) THEN
   RAISE EXCEPTION 'TAXONOMY_CAPTURE_RECEIPT_INVALID' USING errcode='22023';
 END IF;
 -- Keep the existing shared closure lock ahead of data access. The read neither
 -- copies private text nor bypasses an account already entering closure.
 PERFORM private.closure_assert_open(p_account_id);
 v_digest:=encode(extensions.digest(p_proposals::text,'sha256'),'hex');
 SELECT * INTO v_row FROM private.work_taxonomy_gemini_turn_hints_v1 h
 WHERE h.purpose=p_purpose AND h.account_id=p_account_id AND h.turn_id=p_turn_id
   AND h.conversation_id=p_conversation_id AND h.client_request_id=p_client_request_id
   AND h.attempt_id=p_attempt_id AND h.catalog_version=p_catalog_version
   AND h.payload_digest=v_digest AND h.proposals=p_proposals;
 IF NOT FOUND THEN RETURN v_receipt; END IF;
 -- Do not recompute today's source/revision or replay the writer. A later turn
 -- can invalidate application of a plan without undoing its historical capture.
 -- The existing review/Save/binder owners still decide current applicability.
 RETURN v_receipt||jsonb_build_object('state','CAPTURE_PRESENT',
   'accountId',v_row.account_id,'conversationId',v_row.conversation_id,
   'clientRequestId',v_row.client_request_id,'turnId',v_row.turn_id,
   'attemptId',v_row.attempt_id,'purpose',v_row.purpose,
   'catalogVersion',v_row.catalog_version,'payloadDigest',v_row.payload_digest);
END $function$;

REVOKE ALL ON FUNCTION public.rpc_taxonomy_read_gemini_turn_hint_receipt_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_read_gemini_turn_hint_receipt_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)
 TO service_role;
DO $r06_acl$
DECLARE target oid:=to_regprocedure('public.rpc_taxonomy_read_gemini_turn_hint_receipt_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)');
BEGIN
 -- CREATE FUNCTION also inherits owner default grants. Do not rewrite those
 -- defaults or quietly expose this definer to an unexpected API/custom role.
 -- Fail the entire candidate transaction if the exact service-only ACL differs.
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=target
      AND p.proowner='postgres'::regrole AND p.prosecdef
      AND p.proconfig=ARRAY['search_path=pg_catalog']::text[])
    OR EXISTS(SELECT 1 FROM pg_proc p,
      LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      WHERE p.oid=target AND (acl.grantee NOT IN ('postgres'::regrole,'service_role'::regrole)
        OR acl.grantor<>'postgres'::regrole OR acl.privilege_type<>'EXECUTE'
        OR (acl.grantee='service_role'::regrole AND acl.is_grantable)))
    OR NOT has_function_privilege('service_role',target,'EXECUTE')
    OR has_function_privilege('anon',target,'EXECUTE')
    OR has_function_privilege('authenticated',target,'EXECUTE') THEN
   RAISE EXCEPTION 'R06_CAPTURE_RECEIPT_ACL_INVALID' USING errcode='55000';
 END IF;
END $r06_acl$;
COMMIT;
