-- USKOCI Gate B. SOURCE-ONLY, not deployed to DEV / PROD.
-- Durable, independently gated binding worker AFTER the existing CATALOG_ONLY
-- outbox records a COMMITTED receipt. Never sends push or queues matches.
-- Must install both owner-reviewed-need-binder-v1.sql and
-- owner-reviewed-worker-binder-v1.sql FIRST, then deploy Edge with third flag OFF.
-- A failed binding is retryable/reviewable without changing successful Save or
-- catalog receipt. No client or LLM may choose account, category, mode, task ID.
BEGIN;
CREATE TABLE IF NOT EXISTS private.work_taxonomy_binding_control_v1(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false
);
INSERT INTO private.work_taxonomy_binding_control_v1(singleton,enabled)
 VALUES(true,false) ON CONFLICT(singleton) DO NOTHING;
REVOKE ALL ON private.work_taxonomy_binding_control_v1 FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE private.work_taxonomy_binding_control_v1 ENABLE ROW LEVEL SECURITY;

ALTER TABLE private.work_taxonomy_review_outbox_v1
 ADD COLUMN IF NOT EXISTS binding_state text NOT NULL DEFAULT 'PENDING',
 ADD COLUMN IF NOT EXISTS binding_attempts integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS binding_retry_after timestamptz NOT NULL DEFAULT statement_timestamp(),
 ADD COLUMN IF NOT EXISTS binding_error_code text,
 ADD COLUMN IF NOT EXISTS binding_result jsonb;
ALTER TABLE private.work_taxonomy_review_outbox_v1
 ADD CONSTRAINT work_taxonomy_binding_state_v1_check
 CHECK(binding_state IN('PENDING','RETRY','BOUND','REVIEW_REQUIRED'));
CREATE INDEX IF NOT EXISTS work_taxonomy_review_outbox_bind_next_v1
 ON private.work_taxonomy_review_outbox_v1(state,binding_state,binding_retry_after,created_at);

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_bind_ready_reviews_service(
 p_limit integer DEFAULT 3
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private
AS $binding_tick$
DECLARE
 v_enabled boolean;
 v_q private.work_taxonomy_review_outbox_v1%ROWTYPE;
 v_profile_id uuid;v_need_id uuid;v_need_revision integer;
 v_receipt jsonb;v_sqlstate text;v_attempts integer;
 v_claimed integer:=0;v_bound integer:=0;v_review_required integer:=0;v_retry integer:=0;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role'
 THEN RAISE EXCEPTION 'BINDING_TICK_SERVICE_ROLE_REQUIRED' USING errcode='42501'; END IF;
 IF p_limit NOT BETWEEN 1 AND 5
 THEN RAISE EXCEPTION 'BINDING_TICK_LIMIT_INVALID' USING errcode='22023'; END IF;
 SELECT enabled INTO v_enabled FROM private.work_taxonomy_binding_control_v1 WHERE singleton;
 IF v_enabled IS DISTINCT FROM true THEN
  RETURN jsonb_build_object('kind','BINDING_DISABLED','claimed',0,
   'bound',0,'retry',0,'reviewRequired',0,
   'dispatchAuthority','NONE','notificationAuthority','NONE');
 END IF;
 FOR v_q IN
  SELECT * FROM private.work_taxonomy_review_outbox_v1 q
  WHERE q.state='COMMITTED'
    AND q.binding_state IN ('PENDING','RETRY')
    AND q.binding_retry_after<=statement_timestamp()
  ORDER BY q.created_at,q.id
  FOR UPDATE SKIP LOCKED LIMIT p_limit
 LOOP
  v_claimed:=v_claimed+1;v_attempts:=v_q.binding_attempts+1;
  BEGIN
   IF v_q.purpose='WORKER_CAPABILITY' THEN
    SELECT (r.envelope->>'profileId')::uuid INTO v_profile_id
    FROM private.worker_ai_reviews r
    WHERE r.id=v_q.source_review_id AND r.account_id=v_q.owner_account_id
      AND r.envelope->>'classificationState'='READY';
    IF v_profile_id IS NULL THEN
     RAISE EXCEPTION 'BINDING_SIGNED_WORKER_REVIEW_MISSING' USING errcode='42501';
    END IF;
    -- The binder rechecks original owner, Save receipt, digest, mode and current
    -- profile under lock. Never use an Edge-supplied profile or AI-proposed mode.
    v_receipt:=public.rpc_taxonomy_bind_reviewed_worker_service(
      v_q.owner_account_id,v_q.request_key,v_q.source_review_id,v_profile_id);
   ELSIF v_q.purpose='NEED_SERVICE' THEN
    SELECT c.need_id,c.need_revision INTO v_need_id,v_need_revision
    FROM private.ai_task_review_commands c
    WHERE c.review_id=v_q.source_review_id AND c.account_id=v_q.owner_account_id
      AND c.client_request_id=v_q.request_key
      AND c.state IN('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED')
    ORDER BY c.created_at DESC LIMIT 1;
    IF v_need_id IS NULL OR v_need_revision IS NULL THEN
     RAISE EXCEPTION 'BINDING_ACCEPTED_NEED_NOT_READY' USING errcode='PT409';
    END IF;
    v_receipt:=public.rpc_taxonomy_bind_reviewed_need_service(
      v_q.owner_account_id,v_q.request_key,v_q.source_review_id,
      v_need_id,v_need_revision);
   ELSE
    RAISE EXCEPTION 'BINDING_PURPOSE_INVALID' USING errcode='22023';
   END IF;
   IF v_receipt->>'status' NOT IN('BOUND_WORKER_SERVICES','BOUND_NEED_REVISION')
     OR v_receipt->>'notificationAuthority'<>'NONE'
     OR v_receipt->>'dispatchAuthority'<>'NONE' THEN
     RAISE EXCEPTION 'BINDING_RECEIPT_PROTOCOL_INVALID' USING errcode='42501';
   END IF;
   UPDATE private.work_taxonomy_review_outbox_v1
    SET binding_state='BOUND',binding_attempts=v_attempts,
      binding_error_code=NULL,binding_result=v_receipt,updated_at=statement_timestamp()
    WHERE id=v_q.id;
   v_bound:=v_bound+1;
  EXCEPTION WHEN OTHERS THEN
   -- Per-item subtransaction rolls back any partly written binder receipt,
   -- capability or snapshot. Catalog commit and prior Save remain untouched.
   GET STACKED DIAGNOSTICS v_sqlstate=RETURNED_SQLSTATE;
   IF v_sqlstate IN('PT409','40001','40P01','55P03','57014') AND v_attempts<5 THEN
    UPDATE private.work_taxonomy_review_outbox_v1
     SET binding_state='RETRY',binding_attempts=v_attempts,
       binding_error_code='BINDING_STALE_OR_BUSY',
       binding_retry_after=statement_timestamp()
         +make_interval(secs=>LEAST(900,15*power(2,LEAST(v_attempts,5)))::integer),
       updated_at=statement_timestamp()
     WHERE id=v_q.id;
    v_retry:=v_retry+1;
   ELSE
    UPDATE private.work_taxonomy_review_outbox_v1
     SET binding_state='REVIEW_REQUIRED',binding_attempts=v_attempts,
       binding_error_code='BINDING_REVIEW_REQUIRED',
       updated_at=statement_timestamp()
     WHERE id=v_q.id;
    v_review_required:=v_review_required+1;
   END IF;
  END;
 END LOOP;
 RETURN jsonb_build_object('kind','BINDING_ONLY_TICK','claimed',v_claimed,
  'bound',v_bound,'retry',v_retry,'reviewRequired',v_review_required,
  'dispatchAuthority','NONE','notificationAuthority','NONE');
END $binding_tick$;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_bind_ready_reviews_service(integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_bind_ready_reviews_service(integer)
 TO service_role;
COMMIT;
