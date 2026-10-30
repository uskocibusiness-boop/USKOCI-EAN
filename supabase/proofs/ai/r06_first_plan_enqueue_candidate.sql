-- R06 first-plan durable intent: LOCAL_ONLY candidate, not a migration/deployment.
-- Future authorized rollout MUST bind enrollment atomically to the successful
-- Need/Worker turn before any background Gemini I/O. This candidate is OFF by
-- default and does not create a classifier, new category, right or notification.
-- R01/R10/retention/actual-session/concurrency/provider-ledger remain open.
BEGIN;
DO $local$
BEGIN
 IF current_setting('uskoci.r06_first_plan.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
    OR current_user<>'postgres' OR current_database()<>'postgres'
    OR to_regrole('cli_login_postgres') IS NOT NULL THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_LOCAL_ONLY' USING errcode='55000';
 END IF;
 IF to_regclass('private.work_taxonomy_first_plan_jobs_v1') IS NOT NULL
 OR to_regprocedure('public.rpc_taxonomy_first_plan_enqueue_service(uuid,uuid,uuid,uuid,uuid,text,jsonb)') IS NOT NULL
 THEN RAISE EXCEPTION 'R06_FIRST_PLAN_ALREADY_EXISTS' USING errcode='55000'; END IF;
END $local$;
CREATE TABLE private.work_taxonomy_first_plan_control_v1 (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false
);
INSERT INTO private.work_taxonomy_first_plan_control_v1(singleton,enabled) VALUES(true,false);
CREATE TABLE private.work_taxonomy_first_plan_jobs_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 purpose text NOT NULL CHECK(purpose IN('NEED_SERVICE','WORKER_CAPABILITY')),
 account_id uuid NOT NULL,
 conversation_id uuid NOT NULL,
 client_request_id uuid NOT NULL,
 turn_id uuid NOT NULL,
 attempt_id uuid NOT NULL,
 source_fingerprint text NOT NULL CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'),
 targets jsonb NOT NULL CHECK(jsonb_typeof(targets)='array' AND pg_column_size(targets)<=18000),
 state text NOT NULL DEFAULT 'PENDING'
   CHECK(state IN('PENDING','CLAIMED','RETRY','DISPATCHED','CAPTURED','UNKNOWN','REVIEW_REQUIRED')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 UNIQUE(purpose,account_id,turn_id)
);
REVOKE ALL ON private.work_taxonomy_first_plan_control_v1,
 private.work_taxonomy_first_plan_jobs_v1 FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE private.work_taxonomy_first_plan_control_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.work_taxonomy_first_plan_jobs_v1 ENABLE ROW LEVEL SECURITY;

-- Only the actual current completed turn can seed a job. Exact source
-- identity mirrors the existing capture writer; an old turn, wrong owner,
-- cancelled attempt or changed Worker revision never enqueues a new job.
CREATE FUNCTION private.taxonomy_first_plan_current_source_v1(
 p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,
 p_turn_id uuid,p_attempt_id uuid,p_purpose text)
RETURNS text LANGUAGE plpgsql STABLE SET search_path TO 'pg_catalog' AS $fn$
DECLARE v_source text;
BEGIN
 IF p_purpose='WORKER_CAPABILITY' THEN
  SELECT encode(extensions.digest(convert_to(
    s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex')
    INTO v_source
  FROM private.worker_ai_turns t JOIN private.worker_ai_sessions s
   ON s.account_id=t.account_id AND s.conversation_id=t.conversation_id
  WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id
   AND t.client_request_id=p_client_request_id AND t.turn_id=p_turn_id
   AND t.attempt_id=p_attempt_id AND t.state='SUCCEEDED'
   AND t.cancelled_at IS NULL AND t.completion_hash ~ '^[0-9a-f]{64}$'
   AND t.source_revision+1=s.revision;
 ELSIF p_purpose='NEED_SERVICE' THEN
  SELECT encode(extensions.digest(private.ai_task_review_source(c.id)::text,'sha256'),'hex')
    INTO v_source
  FROM private.ai_need_turn_commands t JOIN public.ai_conversations c ON c.id=t.conversation_id
  JOIN public.ai_messages msg ON msg.conversation_id=c.id
    AND msg.account_id=p_account_id AND msg.role='ASSISTANT'
    AND msg.id::text=t.receipt->>'assistantMessageId'
  WHERE t.account_id=p_account_id AND t.conversation_id=p_conversation_id
   AND t.client_request_id=p_client_request_id AND t.turn_id=p_turn_id
   AND t.attempt_id=p_attempt_id AND t.state='SUCCEEDED'
   AND t.cancelled_at IS NULL AND c.account_id=p_account_id AND c.purpose='NEED_INTAKE'
   AND t.receipt->'authoritative'='true'::jsonb
   AND t.receipt->>'schemaVersion'='NEED_FACT_V2'
   AND NOT EXISTS(SELECT 1 FROM public.ai_messages later
     WHERE later.conversation_id=c.id AND later.sequence_no>msg.sequence_no)
   AND NOT EXISTS(SELECT 1 FROM private.ai_need_turn_commands later
     WHERE later.conversation_id=c.id AND later.account_id=p_account_id
       AND (later.state='PROCESSING'
         OR (later.state='SUCCEEDED' AND later.updated_at>t.updated_at)));
 END IF;
 RETURN v_source;
END $fn$;

CREATE FUNCTION public.rpc_taxonomy_first_plan_enqueue_service(
 p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,
 p_turn_id uuid,p_attempt_id uuid,p_purpose text,p_targets jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $fn$
DECLARE v_source text;v_target jsonb;v_seen text[]:='{}';v_key text;
 v_job private.work_taxonomy_first_plan_jobs_v1%ROWTYPE;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 IF (SELECT enabled FROM private.work_taxonomy_first_plan_control_v1 WHERE singleton)
    IS DISTINCT FROM true THEN
   RETURN jsonb_build_object('state','DISABLED','authority','NONE'); END IF;
 IF p_account_id IS NULL OR p_conversation_id IS NULL OR p_client_request_id IS NULL
   OR p_turn_id IS NULL OR p_attempt_id IS NULL
   OR p_purpose NOT IN('NEED_SERVICE','WORKER_CAPABILITY')
   OR jsonb_typeof(p_targets) IS DISTINCT FROM 'array'
   OR pg_column_size(p_targets)>18000
   OR jsonb_array_length(p_targets) NOT BETWEEN 1 AND
     CASE WHEN p_purpose='NEED_SERVICE' THEN 1 ELSE 24 END
 THEN RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 FOR v_target IN SELECT value FROM jsonb_array_elements(p_targets) LOOP
  IF jsonb_typeof(v_target)<>'object'
    OR NOT (v_target ?& array['service','mode'])
    OR (v_target-array['service','mode','handoff'])<>'{}'::jsonb
    OR jsonb_typeof(v_target->'service')<>'string'
    OR char_length(btrim(v_target->>'service')) NOT BETWEEN 3 AND 120
    OR v_target->>'mode' NOT IN('ON_SITE','REMOTE')
    OR (v_target?'handoff' AND
       (v_target->>'mode'<>'REMOTE' OR NOT private.taxonomy_handoff_valid_v1(v_target->'handoff')))
  THEN RAISE EXCEPTION 'R06_FIRST_PLAN_TARGET_INVALID' USING errcode='22023'; END IF;
  v_key:=private.taxonomy_normalize_v1(v_target->>'service')||'|'||(v_target->>'mode');
  IF v_key IS NULL OR v_key=ANY(v_seen) THEN
    RAISE EXCEPTION 'R06_FIRST_PLAN_TARGET_DUPLICATE' USING errcode='22023'; END IF;
  v_seen:=array_append(v_seen,v_key);
 END LOOP;
 PERFORM private.closure_assert_open(p_account_id);
 IF p_purpose='WORKER_CAPABILITY' THEN
  PERFORM 1 FROM private.worker_ai_sessions
    WHERE account_id=p_account_id AND conversation_id=p_conversation_id FOR UPDATE;
 ELSE
  PERFORM 1 FROM public.ai_conversations
    WHERE id=p_conversation_id AND account_id=p_account_id FOR UPDATE;
 END IF;
 v_source:=private.taxonomy_first_plan_current_source_v1(p_account_id,p_conversation_id,
   p_client_request_id,p_turn_id,p_attempt_id,p_purpose);
 IF v_source IS NULL THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_SOURCE_UNCONFIRMED' USING errcode='42501'; END IF;
 IF p_purpose='WORKER_CAPABILITY' AND EXISTS(
  SELECT 1 FROM jsonb_array_elements(p_targets) target WHERE NOT EXISTS(
    SELECT 1 FROM private.worker_ai_sessions s,
       LATERAL jsonb_array_elements_text(s.candidate->'skills') offered(skill)
    WHERE s.account_id=p_account_id AND s.conversation_id=p_conversation_id
      AND private.taxonomy_normalize_v1(offered.skill)=
          private.taxonomy_normalize_v1(target->>'service')
  )) THEN RAISE EXCEPTION 'R06_FIRST_PLAN_WORKER_SERVICE_NOT_OFFERED' USING errcode='22023'; END IF;
 INSERT INTO private.work_taxonomy_first_plan_jobs_v1(
  purpose,account_id,conversation_id,client_request_id,turn_id,attempt_id,source_fingerprint,targets)
 VALUES(p_purpose,p_account_id,p_conversation_id,p_client_request_id,
  p_turn_id,p_attempt_id,v_source,p_targets)
 ON CONFLICT(purpose,account_id,turn_id) DO NOTHING;
 SELECT * INTO v_job FROM private.work_taxonomy_first_plan_jobs_v1
 WHERE purpose=p_purpose AND account_id=p_account_id AND turn_id=p_turn_id;
 IF NOT FOUND OR v_job.conversation_id IS DISTINCT FROM p_conversation_id
  OR v_job.client_request_id IS DISTINCT FROM p_client_request_id
  OR v_job.attempt_id IS DISTINCT FROM p_attempt_id
  OR v_job.source_fingerprint IS DISTINCT FROM v_source
  OR v_job.targets IS DISTINCT FROM p_targets THEN
  RAISE EXCEPTION 'R06_FIRST_PLAN_REPLAY_CONFLICT' USING errcode='22023'; END IF;
 RETURN jsonb_build_object('state',v_job.state,'jobId',v_job.id,
  'authority','NONE','providerAuthority','NONE','attempts',v_job.attempts);
END $fn$;

CREATE FUNCTION public.rpc_taxonomy_first_plan_receipt_service(p_job_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $fn$
DECLARE v_job private.work_taxonomy_first_plan_jobs_v1%ROWTYPE;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
   RAISE EXCEPTION 'R06_FIRST_PLAN_DENIED' USING errcode='42501'; END IF;
 IF p_job_id IS NULL THEN RAISE EXCEPTION 'R06_FIRST_PLAN_INVALID' USING errcode='22023'; END IF;
 SELECT * INTO v_job FROM private.work_taxonomy_first_plan_jobs_v1 WHERE id=p_job_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','UNCONFIRMED',
   'authority','NONE','providerAuthority','NONE','retryAllowed',false); END IF;
 PERFORM private.closure_assert_open(v_job.account_id);
 RETURN jsonb_build_object('state',v_job.state,'jobId',v_job.id,
   'attempts',v_job.attempts,'authority','NONE','providerAuthority','NONE',
   'retryAllowed',false);
END $fn$;

REVOKE ALL ON FUNCTION private.taxonomy_first_plan_current_source_v1(uuid,uuid,uuid,uuid,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_first_plan_enqueue_service(uuid,uuid,uuid,uuid,uuid,text,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_first_plan_receipt_service(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_first_plan_enqueue_service(uuid,uuid,uuid,uuid,uuid,text,jsonb)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_first_plan_receipt_service(uuid)
 TO service_role;
DO $acl$
DECLARE f record;a record;
BEGIN
 FOR f IN SELECT oid,proowner,prosecdef,proconfig,proacl FROM pg_proc
  WHERE oid IN (
    to_regprocedure('public.rpc_taxonomy_first_plan_enqueue_service(uuid,uuid,uuid,uuid,uuid,text,jsonb)'),
    to_regprocedure('public.rpc_taxonomy_first_plan_receipt_service(uuid)'))
 LOOP
  IF f.proowner<>'postgres'::regrole OR f.prosecdef IS DISTINCT FROM true
    OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
    OR has_function_privilege('anon',f.oid,'EXECUTE')
    OR has_function_privilege('authenticated',f.oid,'EXECUTE')
    OR NOT has_function_privilege('service_role',f.oid,'EXECUTE')
  THEN RAISE EXCEPTION 'R06_FIRST_PLAN_ACL_INVALID' USING errcode='55000'; END IF;
  FOR a IN SELECT * FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) LOOP
    IF a.grantee NOT IN('postgres'::regrole,'service_role'::regrole)
      OR a.privilege_type<>'EXECUTE' OR a.is_grantable
    THEN RAISE EXCEPTION 'R06_FIRST_PLAN_ACL_INVALID' USING errcode='55000'; END IF;
  END LOOP;
 END LOOP;
END $acl$;
COMMIT;
