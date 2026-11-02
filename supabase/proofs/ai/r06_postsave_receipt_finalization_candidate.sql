-- R06 LOCAL_ONLY candidate: replace the existing post-save finalizer, no new RPC.
-- A receipt already committed for this exact saved operation survives a lost ACK,
-- including the last claim. No provider call, new consent, binding or retry grant.
-- This is not a migration/deployment. R01/R10 source-digest/ACL admission and a
-- fresh DEV preimage are required before any controlled promotion. Receipts that
-- arrive only AFTER this finalization reads remain a separate recovery boundary.
BEGIN;
DO $r06$
DECLARE target oid:=to_regprocedure('public.rpc_taxonomy_finalize_reviewed_batch_service(uuid,uuid,text)');
BEGIN
 IF current_setting('uskoci.r06_postsave_receipt.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
 OR current_user<>'postgres' OR current_database()<>'postgres'
 OR to_regrole('cli_login_postgres') IS NOT NULL THEN
  RAISE EXCEPTION 'R06_POSTSAVE_RECEIPT_LOCAL_ONLY' USING errcode='55000'; END IF;
 -- Exact predecessor from 20261021104455_closure_taxonomy_archive_copy_coverage.
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=target
   AND md5(replace(p.prosrc,chr(13),''))='af9cd22b779037a8c9f7fad5c8543cfe'
   AND p.proowner='postgres'::regrole AND p.prosecdef
   AND p.proconfig=ARRAY['search_path=pg_catalog, private']::text[])
 OR EXISTS(SELECT 1 FROM pg_proc p,
   LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
   WHERE p.oid=target AND (acl.grantee NOT IN('postgres'::regrole,'service_role'::regrole)
     OR acl.grantor<>'postgres'::regrole OR acl.privilege_type<>'EXECUTE'
     OR (acl.grantee='service_role'::regrole AND acl.is_grantable)))
 OR NOT has_function_privilege('service_role',target,'EXECUTE')
 OR has_function_privilege('anon',target,'EXECUTE')
 OR has_function_privilege('authenticated',target,'EXECUTE') THEN
  RAISE EXCEPTION 'R06_POSTSAVE_RECEIPT_PREIMAGE_DRIFT' USING errcode='55000'; END IF;
END $r06$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_finalize_reviewed_batch_service(
 p_outbox_id uuid,p_lease_token uuid,p_error_code text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE v private.work_taxonomy_review_outbox_v1%ROWTYPE;v_receipt jsonb;
 v_status text;v_retry timestamptz;
BEGIN
 PERFORM private.closure_assert_open(owner_account_id)
 FROM private.work_taxonomy_review_outbox_v1 WHERE id=p_outbox_id;
 SELECT * INTO v FROM private.work_taxonomy_review_outbox_v1
 WHERE id=p_outbox_id FOR UPDATE;
 IF NOT FOUND OR v.state<>'CLAIMED' OR v.lease_token IS DISTINCT FROM p_lease_token
    OR v.lease_until<=statement_timestamp()
 THEN RAISE EXCEPTION 'OUTBOX_STALE_LEASE' USING errcode='42501'; END IF;
 IF p_error_code IS NOT NULL AND p_error_code !~ '^[A-Z][A-Z0-9_]{2,79}$' THEN
  RAISE EXCEPTION 'OUTBOX_ERROR_CODE_INVALID' USING errcode='22023'; END IF;

 -- Transport failure is not rollback. Read the same immutable batch receipt
 -- before exhausting retries; a different owner/key/review/plan is no evidence.
 SELECT b.result INTO v_receipt FROM private.work_taxonomy_review_batches_v1 b
 WHERE b.owner_account_id=v.owner_account_id AND b.request_key=v.request_key
   AND b.source_review_id=v.source_review_id AND b.purpose=v.purpose
   AND b.plans IS NOT DISTINCT FROM v.plans
   AND b.plans_digest=encode(extensions.digest(convert_to(v.plans::text,'UTF8'),'sha256'),'hex')
   AND b.result->>'status'='COMMITTED';
 IF v_receipt IS NOT NULL THEN
  v_status:='COMMITTED';v_retry:=statement_timestamp();
 ELSIF p_error_code IS NULL THEN
  RAISE EXCEPTION 'OUTBOX_COMMIT_RECEIPT_MISSING' USING errcode='42501';
 ELSIF p_error_code IN('TIMEOUT','NETWORK_UNAVAILABLE','TEMPORARY_UNAVAILABLE')
   AND v.attempts<5 THEN
  v_status:='RETRY';
  v_retry:=statement_timestamp()+make_interval(secs=>LEAST(1800,15*power(2,LEAST(v.attempts,7)))::integer);
 ELSE
  -- Without a committed receipt, keep the existing permanent/max-attempt denial.
  v_status:='REVIEW_REQUIRED';v_retry:=statement_timestamp();
 END IF;
 UPDATE private.work_taxonomy_review_outbox_v1
 SET state=v_status,lease_token=NULL,lease_until=NULL,retry_after=v_retry,
   error_code=CASE WHEN v_status='COMMITTED' THEN NULL ELSE p_error_code END,
   result=v_receipt,updated_at=statement_timestamp()
 WHERE id=v.id;
 RETURN jsonb_build_object('status',v_status,'outboxId',v.id);
END $function$;
-- CREATE OR REPLACE preserves the pinned existing owner/ACL. No GRANT changes.
COMMIT;
