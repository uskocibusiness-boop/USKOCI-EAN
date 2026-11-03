-- R06 LOCAL_ONLY candidate: replace the existing outbox reconciler, no new RPC.
-- Recover only a late durable receipt after terminal transport uncertainty.
-- Never replay the admission/provider, reopen a permanent refusal, change owner
-- consent, or reset the independent binding state. The existing binder decides
-- current eligibility. R01/R10/current DEV preimage admission remains required.
BEGIN;
DO $r06$
DECLARE target oid:=to_regprocedure('public.rpc_taxonomy_reconcile_reviewed_outbox_service(integer)');
BEGIN
 IF current_setting('uskoci.r06_postsave_late_receipt.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
 OR current_user<>'postgres' OR current_database()<>'postgres'
 OR to_regrole('cli_login_postgres') IS NOT NULL THEN
  RAISE EXCEPTION 'R06_POSTSAVE_LATE_RECEIPT_LOCAL_ONLY' USING errcode='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=target
   AND md5(replace(p.prosrc,chr(13),''))='41747bdfdba0af1d941bf4fb91f1a887'
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
  RAISE EXCEPTION 'R06_POSTSAVE_LATE_RECEIPT_PREIMAGE_DRIFT' USING errcode='55000'; END IF;
END $r06$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_reconcile_reviewed_outbox_service(p_limit integer DEFAULT 50)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE v_enabled boolean;v_count integer;v_repaired integer;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN
  RAISE EXCEPTION 'OUTBOX_RECOVERY_LIMIT_INVALID' USING errcode='22023'; END IF;
 SELECT enabled INTO v_enabled FROM private.work_taxonomy_review_outbox_control_v1
 WHERE singleton;
 IF v_enabled IS DISTINCT FROM true THEN RETURN 0; END IF;

 -- Match receipts BEFORE limiting: old absent/mismatched receipts cannot starve
 -- later recoverable work. Preserve the existing closure-before-row lock order.
 WITH candidates AS MATERIALIZED (
  SELECT q.id,q.owner_account_id FROM private.work_taxonomy_review_outbox_v1 q
  JOIN private.work_taxonomy_review_batches_v1 b
    ON b.owner_account_id=q.owner_account_id AND b.request_key=q.request_key
   AND b.source_review_id=q.source_review_id AND b.purpose=q.purpose
   AND b.plans IS NOT DISTINCT FROM q.plans
   AND b.plans_digest=encode(extensions.digest(convert_to(q.plans::text,'UTF8'),'sha256'),'hex')
   AND b.result->>'status'='COMMITTED'
  WHERE q.state='REVIEW_REQUIRED'
    AND q.error_code IN('TIMEOUT','NETWORK_UNAVAILABLE','TEMPORARY_UNAVAILABLE')
    AND NOT private.closure_account_restricted(q.owner_account_id)
  ORDER BY q.created_at,q.id LIMIT p_limit
 ),
 admitted AS MATERIALIZED (
  SELECT id FROM candidates WHERE private.closure_taxonomy_try_owner_v1(owner_account_id)
 ),
 selected AS (
  SELECT q.id,b.result FROM private.work_taxonomy_review_outbox_v1 q
  JOIN admitted a ON a.id=q.id
  JOIN private.work_taxonomy_review_batches_v1 b
    ON b.owner_account_id=q.owner_account_id AND b.request_key=q.request_key
   AND b.source_review_id=q.source_review_id AND b.purpose=q.purpose
   AND b.plans IS NOT DISTINCT FROM q.plans
   AND b.plans_digest=encode(extensions.digest(convert_to(q.plans::text,'UTF8'),'sha256'),'hex')
   AND b.result->>'status'='COMMITTED'
  WHERE q.state='REVIEW_REQUIRED'
    AND q.error_code IN('TIMEOUT','NETWORK_UNAVAILABLE','TEMPORARY_UNAVAILABLE')
  FOR UPDATE OF q SKIP LOCKED
 ),
 repaired AS (
  UPDATE private.work_taxonomy_review_outbox_v1 q
  SET state='COMMITTED',result=s.result,error_code=NULL,updated_at=statement_timestamp()
  FROM selected s WHERE q.id=s.id RETURNING q.id
 )
 SELECT count(*)::integer INTO v_repaired FROM repaired;

 -- Keep the existing missing-save recovery and share its original mutation
 -- budget; the Edge contract requires total reconciled <= requested limit.
 WITH accepted AS (
   SELECT s.account_id,s.client_request_id,s.review_id,
      'WORKER_CAPABILITY'::text AS purpose,
      w.envelope->'classificationCandidates' AS plans,s.created_at
   FROM private.worker_ai_saves s
   JOIN private.worker_ai_reviews w ON w.id=s.review_id AND w.account_id=s.account_id
   WHERE w.envelope->'canAccept'='true'::jsonb
     AND w.envelope->>'classificationCatalogFingerprint' IS NOT NULL
     AND CASE WHEN jsonb_typeof(w.envelope->'classificationCandidates')='array'
       THEN jsonb_array_length(w.envelope->'classificationCandidates') BETWEEN 1 AND 24
       ELSE false END
   UNION ALL
   SELECT c.account_id,c.client_request_id,c.review_id,
      'NEED_SERVICE'::text AS purpose,
      t.envelope->'classificationCandidates' AS plans,c.created_at
   FROM private.ai_task_review_commands c
   JOIN private.ai_task_reviews t ON t.id=c.review_id AND t.account_id=c.account_id
   WHERE c.state IN ('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED')
     AND t.envelope->'canAccept'='true'::jsonb
     AND t.envelope->>'classificationCatalogFingerprint' IS NOT NULL
     AND CASE WHEN jsonb_typeof(t.envelope->'classificationCandidates')='array'
       THEN jsonb_array_length(t.envelope->'classificationCandidates')=1
       ELSE false END
 ),
 missing AS MATERIALIZED (
   SELECT a.* FROM accepted a
   WHERE NOT private.closure_account_restricted(a.account_id) AND NOT EXISTS (SELECT 1 FROM private.work_taxonomy_review_outbox_v1 q
     WHERE q.owner_account_id=a.account_id AND q.request_key=a.client_request_id)
   ORDER BY a.created_at,a.review_id LIMIT greatest(0,p_limit-v_repaired)
 ),
 admitted AS MATERIALIZED (SELECT * FROM missing WHERE private.closure_taxonomy_try_owner_v1(account_id)),
 inserted AS (
   INSERT INTO private.work_taxonomy_review_outbox_v1
     (owner_account_id,request_key,source_review_id,purpose,plans)
   SELECT account_id,client_request_id,review_id,purpose,plans FROM admitted
   ON CONFLICT(owner_account_id,request_key) DO NOTHING
   RETURNING id
 )
 SELECT count(*)::integer INTO v_count FROM inserted;
 RETURN v_repaired+v_count;
END $function$;
-- Existing owner/ACL remain unchanged; no new tables, flags, grants or scheduler.
COMMIT;
