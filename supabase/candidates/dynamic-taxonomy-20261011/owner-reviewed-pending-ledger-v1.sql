-- DEV candidate: private, non-authoritative record of signed, saved, non-READY classifications.
-- No category/alias/worker capability/need/match/notification writes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
DO $g$ BEGIN
 IF to_regclass('private.work_taxonomy_pending_reviews_v1') IS NOT NULL
 OR to_regclass('private.work_taxonomy_pending_control_v1') IS NOT NULL
 OR to_regclass('private.worker_ai_reviews') IS NULL
 OR to_regclass('private.worker_ai_saves') IS NULL
 OR to_regclass('private.ai_task_reviews') IS NULL
 OR to_regclass('private.ai_task_review_commands') IS NULL
 THEN RAISE EXCEPTION 'PENDING_LEDGER_PRECONDITION_FAILED'; END IF;
END $g$;
CREATE TABLE private.work_taxonomy_pending_control_v1(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false);
INSERT INTO private.work_taxonomy_pending_control_v1(singleton,enabled) VALUES(true,false);
CREATE TABLE private.work_taxonomy_pending_reviews_v1(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_account_id uuid NOT NULL,
 request_key uuid NOT NULL,
 source_review_id uuid NOT NULL,
 purpose text NOT NULL CHECK(purpose IN('WORKER_CAPABILITY','NEED_SERVICE')),
 classification_state text NOT NULL CHECK(classification_state IN
 ('PENDING_CLASSIFICATION','SERVICE_MODE_CONFIRMATION_REQUIRED','REVIEW_REQUIRED','CATALOG_UNAVAILABLE','STALE_CATALOG')),
 resolution_state text NOT NULL DEFAULT 'OPEN' CHECK(resolution_state IN('OPEN','RESOLVED','SUPERSEDED')),
 saved_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 UNIQUE(owner_account_id,request_key));
CREATE INDEX work_taxonomy_pending_open_v1 ON private.work_taxonomy_pending_reviews_v1(resolution_state,created_at);
ALTER TABLE private.work_taxonomy_pending_control_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.work_taxonomy_pending_reviews_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.work_taxonomy_pending_control_v1 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON private.work_taxonomy_pending_reviews_v1 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.taxonomy_pending_saved_event_v1()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private
AS $f$
DECLARE v_review jsonb;v_state text;v_purpose text;
BEGIN
 IF (SELECT enabled FROM private.work_taxonomy_pending_control_v1 WHERE singleton) IS DISTINCT FROM true
 THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='worker_ai_saves' THEN
  v_purpose:='WORKER_CAPABILITY';
  SELECT envelope INTO v_review FROM private.worker_ai_reviews
   WHERE id=NEW.review_id AND account_id=NEW.account_id;
 ELSIF TG_TABLE_NAME='ai_task_review_commands' THEN
  IF NEW.state NOT IN('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED') THEN RETURN NEW; END IF;
  v_purpose:='NEED_SERVICE';
  SELECT envelope INTO v_review FROM private.ai_task_reviews
   WHERE id=NEW.review_id AND account_id=NEW.account_id;
 ELSE RETURN NEW; END IF;
 v_state:=v_review->>'classificationState';
 IF v_review->'canAccept' IS DISTINCT FROM 'true'::jsonb
 OR v_state NOT IN ('PENDING_CLASSIFICATION','SERVICE_MODE_CONFIRMATION_REQUIRED',
                   'REVIEW_REQUIRED','CATALOG_UNAVAILABLE','STALE_CATALOG')
 OR coalesce(v_review->>'displayedContentDigest','') !~ '^[a-f0-9]{64}$'
 THEN RETURN NEW; END IF;
 INSERT INTO private.work_taxonomy_pending_reviews_v1
 (owner_account_id,request_key,source_review_id,purpose,classification_state,saved_at)
 VALUES(NEW.account_id,NEW.client_request_id,NEW.review_id,v_purpose,v_state,NEW.created_at)
 ON CONFLICT(owner_account_id,request_key) DO NOTHING;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 RAISE LOG 'PENDING_LEDGER_INSERT_FAILURE:%',SQLSTATE;
 RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION private.taxonomy_pending_saved_event_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER taxonomy_pending_worker_save_v1 AFTER INSERT ON private.worker_ai_saves
 FOR EACH ROW EXECUTE FUNCTION private.taxonomy_pending_saved_event_v1();
CREATE TRIGGER taxonomy_pending_need_save_v1 AFTER INSERT OR UPDATE OF state ON private.ai_task_review_commands
 FOR EACH ROW EXECUTE FUNCTION private.taxonomy_pending_saved_event_v1();

-- DB-internal recovery from dropped trigger writes, deliberately no client EXECUTE.
CREATE FUNCTION private.taxonomy_reconcile_pending_reviews_v1(p_limit integer DEFAULT 50)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private
AS $f$
DECLARE v_count integer;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN
  RAISE EXCEPTION 'PENDING_LEDGER_LIMIT_INVALID' USING errcode='22023'; END IF;
 IF (SELECT enabled FROM private.work_taxonomy_pending_control_v1 WHERE singleton) IS DISTINCT FROM true
 THEN RETURN 0; END IF;
 WITH saved AS (
   SELECT s.account_id,s.client_request_id,s.review_id,'WORKER_CAPABILITY'::text purpose,
     r.envelope,s.created_at
   FROM private.worker_ai_saves s JOIN private.worker_ai_reviews r
    ON r.id=s.review_id AND r.account_id=s.account_id
   UNION ALL
   SELECT c.account_id,c.client_request_id,c.review_id,'NEED_SERVICE'::text,
     r.envelope,c.created_at
   FROM private.ai_task_review_commands c JOIN private.ai_task_reviews r
    ON r.id=c.review_id AND r.account_id=c.account_id
   WHERE c.state IN('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED')
 ),
 missing AS (
   SELECT * FROM saved s WHERE
    s.envelope->'canAccept'='true'::jsonb
    AND s.envelope->>'classificationState' IN
     ('PENDING_CLASSIFICATION','SERVICE_MODE_CONFIRMATION_REQUIRED','REVIEW_REQUIRED',
      'CATALOG_UNAVAILABLE','STALE_CATALOG')
    AND coalesce(s.envelope->>'displayedContentDigest','') ~ '^[a-f0-9]{64}$'
    AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_pending_reviews_v1 p
      WHERE p.owner_account_id=s.account_id AND p.request_key=s.client_request_id)
   ORDER BY created_at,review_id LIMIT p_limit
 ),
 ins AS (
   INSERT INTO private.work_taxonomy_pending_reviews_v1
    (owner_account_id,request_key,source_review_id,purpose,classification_state,saved_at)
   SELECT account_id,client_request_id,review_id,purpose,envelope->>'classificationState',created_at
   FROM missing ON CONFLICT(owner_account_id,request_key) DO NOTHING RETURNING id
 )
 SELECT count(*)::integer INTO v_count FROM ins;
 RETURN v_count;
END $f$;
REVOKE ALL ON FUNCTION private.taxonomy_reconcile_pending_reviews_v1(integer)
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;