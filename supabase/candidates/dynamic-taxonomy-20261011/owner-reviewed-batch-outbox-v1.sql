-- USKOCI P1.6 durable post-save outbox candidate (SOURCE ONLY, OFF by default).
-- Human presses only existing Save profile / Accept task review.
-- Never writes categories, capabilities, needs or notifications in a trigger.
-- Catalog worker (not included here) claims queue and calls the atomic
-- reviewed-batch RPC. No DEV/PROD schema changes or cron activation.
BEGIN;
CREATE TABLE IF NOT EXISTS private.work_taxonomy_review_outbox_control_v1 (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false
);
INSERT INTO private.work_taxonomy_review_outbox_control_v1(singleton,enabled)
 VALUES(true,false) ON CONFLICT (singleton) DO NOTHING;
REVOKE ALL ON private.work_taxonomy_review_outbox_control_v1 FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS private.work_taxonomy_review_outbox_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_account_id uuid NOT NULL,
 request_key uuid NOT NULL,
 source_review_id uuid NOT NULL,
 purpose text NOT NULL CHECK(purpose IN('WORKER_CAPABILITY','NEED_SERVICE')),
 plans jsonb NOT NULL CHECK(jsonb_typeof(plans)='array'),
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN('PENDING','CLAIMED','RETRY','COMMITTED','REVIEW_REQUIRED')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 lease_token uuid,
 lease_until timestamptz,
 retry_after timestamptz NOT NULL DEFAULT statement_timestamp(),
 error_code text,
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 UNIQUE(owner_account_id,request_key),
 CHECK((state='CLAIMED' AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
    OR (state<>'CLAIMED' AND lease_token IS NULL AND lease_until IS NULL))
);
CREATE INDEX IF NOT EXISTS work_taxonomy_review_outbox_next_v1
 ON private.work_taxonomy_review_outbox_v1(state,retry_after,created_at);
REVOKE ALL ON private.work_taxonomy_review_outbox_v1 FROM PUBLIC,anon,authenticated;

-- Trigger is purposely inert until rollout control is enabled.
-- Invalid/legacy reviews do not enter the queue; saves remain authoritative.
CREATE OR REPLACE FUNCTION private.taxonomy_queue_review_after_save_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private
AS $enqueue$
DECLARE v_review jsonb;v_purpose text;v_plans jsonb;v_enabled boolean;
BEGIN
 SELECT enabled INTO v_enabled FROM private.work_taxonomy_review_outbox_control_v1
 WHERE singleton;
 IF v_enabled IS DISTINCT FROM true THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='worker_ai_saves' THEN
  v_purpose:='WORKER_CAPABILITY';
  SELECT envelope INTO v_review FROM private.worker_ai_reviews
   WHERE id=NEW.review_id AND account_id=NEW.account_id;
 ELSIF TG_TABLE_NAME='ai_task_review_commands' THEN
  IF NEW.state NOT IN ('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED')
   THEN RETURN NEW; END IF;
  v_purpose:='NEED_SERVICE';
  SELECT envelope INTO v_review FROM private.ai_task_reviews
   WHERE id=NEW.review_id AND account_id=NEW.account_id;
 ELSE RETURN NEW; END IF;
 IF v_review IS NULL OR v_review->'canAccept' IS DISTINCT FROM 'true'::jsonb
    OR jsonb_typeof(v_review->'classificationCandidates')<>'array'
    OR jsonb_array_length(v_review->'classificationCandidates') NOT BETWEEN 1 AND 12
    OR v_review->>'classificationCatalogFingerprint' IS NULL
 THEN RETURN NEW; END IF;
 v_plans:=v_review->'classificationCandidates';
 INSERT INTO private.work_taxonomy_review_outbox_v1
  (owner_account_id,request_key,source_review_id,purpose,plans)
 VALUES(NEW.account_id,NEW.client_request_id,NEW.review_id,v_purpose,v_plans)
 ON CONFLICT(owner_account_id,request_key) DO NOTHING;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 -- Classification cannot veto the person's successful profile/task save.
 -- This is an observable, sanitized failure; recovery worker must reconcile
 -- signed reviews with saved commands and missing outbox records.
 RAISE LOG 'TAXONOMY_OUTBOX_ENQUEUE_FAILURE:%',SQLSTATE;
 RETURN NEW;
END $enqueue$;
REVOKE ALL ON FUNCTION private.taxonomy_queue_review_after_save_v1()
 FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS taxonomy_enqueue_worker_saved_v1 ON private.worker_ai_saves;
CREATE TRIGGER taxonomy_enqueue_worker_saved_v1 AFTER INSERT
 ON private.worker_ai_saves FOR EACH ROW
 EXECUTE FUNCTION private.taxonomy_queue_review_after_save_v1();
DROP TRIGGER IF EXISTS taxonomy_enqueue_need_accepted_v1 ON private.ai_task_review_commands;
CREATE TRIGGER taxonomy_enqueue_need_accepted_v1 AFTER INSERT
 ON private.ai_task_review_commands FOR EACH ROW
 EXECUTE FUNCTION private.taxonomy_queue_review_after_save_v1();

-- Durable bounded claim with lease fencing. Only the background service
-- can claim; no client role can read another user's classification plans.
CREATE OR REPLACE FUNCTION public.rpc_taxonomy_claim_reviewed_batches_service(
 p_limit integer DEFAULT 5
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private
AS $claim$
DECLARE v_docs jsonb;
BEGIN
 IF p_limit NOT BETWEEN 1 AND 20 THEN
  RAISE EXCEPTION 'OUTBOX_CLAIM_LIMIT_INVALID' USING errcode='22023'; END IF;
 WITH selected AS (
  SELECT id FROM private.work_taxonomy_review_outbox_v1
  WHERE (state IN ('PENDING','RETRY') AND retry_after<=statement_timestamp())
     OR (state='CLAIMED' AND lease_until<statement_timestamp())
  ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT p_limit
 ),
 claimed AS (
  UPDATE private.work_taxonomy_review_outbox_v1 q
   SET state='CLAIMED',attempts=q.attempts+1,
       lease_token=gen_random_uuid(),lease_until=statement_timestamp()+interval '2 minutes',
       updated_at=statement_timestamp()
   FROM selected s WHERE q.id=s.id
   RETURNING q.id,q.owner_account_id,q.request_key,q.source_review_id,
    q.purpose,q.plans,q.lease_token,q.attempts
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',id,'ownerAccountId',owner_account_id,'requestKey',request_key,
  'sourceReviewId',source_review_id,'purpose',purpose,'plans',plans,
  'leaseToken',lease_token,'attempts',attempts) ORDER BY id),'[]'::jsonb)
 INTO v_docs FROM claimed;
 RETURN v_docs;
END $claim$;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_claim_reviewed_batches_service(integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_claim_reviewed_batches_service(integer)
 TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_finalize_reviewed_batch_service(
 p_outbox_id uuid,p_lease_token uuid,p_error_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private
AS $finish$
DECLARE v private.work_taxonomy_review_outbox_v1%ROWTYPE;v_receipt jsonb;
 v_status text;v_retry timestamptz;
BEGIN
 SELECT * INTO v FROM private.work_taxonomy_review_outbox_v1
 WHERE id=p_outbox_id FOR UPDATE;
 IF NOT FOUND OR v.state<>'CLAIMED' OR v.lease_token IS DISTINCT FROM p_lease_token
    OR v.lease_until<=statement_timestamp()
 THEN RAISE EXCEPTION 'OUTBOX_STALE_LEASE' USING errcode='42501'; END IF;
 IF p_error_code IS NULL THEN
  SELECT b.result INTO v_receipt FROM private.work_taxonomy_review_batches_v1 b
  WHERE b.owner_account_id=v.owner_account_id AND b.request_key=v.request_key
    AND b.source_review_id=v.source_review_id AND b.purpose=v.purpose
    AND b.plans IS NOT DISTINCT FROM v.plans;
  IF v_receipt IS NULL OR v_receipt->>'status'<>'COMMITTED' THEN
   RAISE EXCEPTION 'OUTBOX_COMMIT_RECEIPT_MISSING' USING errcode='42501'; END IF;
  v_status:='COMMITTED';v_retry:=statement_timestamp();
 ELSE
  IF p_error_code !~ '^[A-Z][A-Z0-9_]{2,79}$' THEN
   RAISE EXCEPTION 'OUTBOX_ERROR_CODE_INVALID' USING errcode='22023'; END IF;
  -- Invalid/stale semantic plans require re-planning or internal review.
  -- Network/timeouts are retryable without consuming any new owner consent.
  IF p_error_code IN('TIMEOUT','NETWORK_UNAVAILABLE','TEMPORARY_UNAVAILABLE')
    AND v.attempts<5 THEN
   v_status:='RETRY';
   v_retry:=statement_timestamp()+make_interval(secs=>LEAST(1800,15*power(2,LEAST(v.attempts,7)))::integer);
  ELSE
   v_status:='REVIEW_REQUIRED';v_retry:=statement_timestamp();
  END IF;
 END IF;
 UPDATE private.work_taxonomy_review_outbox_v1
 SET state=v_status,lease_token=NULL,lease_until=NULL,retry_after=v_retry,
   error_code=p_error_code,result=v_receipt,updated_at=statement_timestamp()
 WHERE id=v.id;
 RETURN jsonb_build_object('status',v_status,'outboxId',v.id);
END $finish$;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_finalize_reviewed_batch_service(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_finalize_reviewed_batch_service(uuid,uuid,text)
 TO service_role;
COMMIT;
