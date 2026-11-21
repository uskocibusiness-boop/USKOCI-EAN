-- USKOCI DEV: background publication pre-evaluation objects (owner-approved 2026-11-21).
-- Source: scripts/sql/publication_pre_evaluation_20261121.candidate.sql; rollback: scripts/sql/rollback_publication_pre_evaluation_20261121.sql.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DO $dependencies$
BEGIN
  -- The dry-run depends on the exact accept/context bodies reviewed on DEV 2026-11-21.
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.rpc_accept_ai_task_review(uuid,text,uuid)'::regprocedure)
       IS DISTINCT FROM '535fa065c24b514423af8d04a8a58574'
  OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.need_publication_context(uuid,integer,uuid)'::regprocedure)
       IS DISTINCT FROM '47c471edbb45f07a71177b4fcfbeb617'
  OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.ai_task_review_command_document(uuid)'::regprocedure)
       IS DISTINCT FROM '68a8373b9f7a1d668d60c8dcf6b84fc7'
  THEN RAISE EXCEPTION 'PUBLICATION_PRE_EVALUATION_DEPENDENCY_DRIFT'; END IF;
  IF to_regclass('private.ai_task_review_pre_evaluations') IS NOT NULL
  OR to_regprocedure('public.rpc_preview_ai_task_review_publication_context(uuid,text)') IS NOT NULL
  OR to_regprocedure('public.rpc_claim_ai_task_review_pre_evaluation_service(uuid,uuid,text,text)') IS NOT NULL
  OR to_regprocedure('public.rpc_complete_ai_task_review_pre_evaluation_service(uuid,text,uuid,text,text[],text[],text)') IS NOT NULL
  OR to_regprocedure('public.rpc_read_ai_task_review_pre_evaluation_service(uuid,text,text)') IS NOT NULL
  THEN RAISE EXCEPTION 'PUBLICATION_PRE_EVALUATION_ALREADY_PRESENT'; END IF;
END
$dependencies$;

CREATE TABLE private.ai_task_review_pre_evaluations(
  account_id uuid NOT NULL,
  input_digest text NOT NULL CHECK (input_digest ~ '^[a-f0-9]{64}$'),
  review_id uuid NOT NULL REFERENCES private.ai_task_reviews(id) ON DELETE CASCADE,
  policy_content_sha256 text NOT NULL CHECK (policy_content_sha256 ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK (state IN ('EVALUATING','DECIDED','UNAVAILABLE')),
  attempt_id uuid NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  outcome text CHECK (outcome IN ('ALLOW','CLARIFY','REVIEW','BLOCK')),
  rule_ids text[] NOT NULL DEFAULT '{}',
  safe_reason_codes text[] NOT NULL DEFAULT '{}',
  model_ref text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  settled_at timestamptz,
  PRIMARY KEY (account_id, input_digest),
  CHECK ((state='DECIDED') = (outcome IS NOT NULL)),
  CHECK (state<>'DECIDED' OR (cardinality(rule_ids) BETWEEN 1 AND 64 AND cardinality(safe_reason_codes)<=64
    AND model_ref ~ '^[a-z0-9][a-z0-9._-]{0,63}$' AND settled_at IS NOT NULL))
);
ALTER TABLE private.ai_task_review_pre_evaluations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.ai_task_review_pre_evaluations FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON TABLE private.ai_task_review_pre_evaluations IS
  'Non-authoritative background moderation per owner and exact provider input. Never a publication decision.';

CREATE FUNCTION public.rpc_preview_ai_task_review_publication_context(p_review_id uuid, p_displayed_content_digest text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE u uuid:=auth.uid(); probe uuid:=extensions.gen_random_uuid(); doc jsonb; preview jsonb; reason text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
 IF p_review_id IS NULL OR p_displayed_content_digest IS NULL OR p_displayed_content_digest !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'TASK_REVIEW_INPUT_INVALID' USING errcode='22023'; END IF;
 BEGIN
  -- The owner's own acceptance with every check it has (ownership, digest, expiry, staleness,
  -- policy, identity, completeness), under a fresh key that no client ever holds.
  doc:=public.rpc_accept_ai_task_review(p_review_id,p_displayed_content_digest,probe);
  IF doc->>'clientRequestId' IS DISTINCT FROM probe::text THEN
   preview:=jsonb_build_object('kind','ACCEPTED');
  ELSE
   preview:=jsonb_build_object('kind','PREVIEW','context',
    private.need_publication_context((doc->>'needId')::uuid,(doc->>'needRevision')::integer,u));
  END IF;
  -- Always roll the acceptance back: a preview never confirms, saves or binds anything.
  RAISE EXCEPTION 'TASK_REVIEW_PREVIEW_ROLLBACK' USING errcode='P0001';
 EXCEPTION WHEN raise_exception THEN
  GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
  IF reason IS DISTINCT FROM 'TASK_REVIEW_PREVIEW_ROLLBACK' OR preview IS NULL THEN RAISE; END IF;
 END;
 RETURN preview||jsonb_build_object('authoritative',false);
END $function$;
REVOKE ALL ON FUNCTION public.rpc_preview_ai_task_review_publication_context(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_preview_ai_task_review_publication_context(uuid,text) TO authenticated;

CREATE FUNCTION public.rpc_claim_ai_task_review_pre_evaluation_service(p_account_id uuid, p_review_id uuid,
  p_input_digest text, p_policy_content_sha256 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE e private.ai_task_review_pre_evaluations;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode='42501'; END IF;
 IF p_account_id IS NULL OR p_review_id IS NULL OR p_input_digest IS NULL OR p_input_digest !~ '^[a-f0-9]{64}$'
 OR p_policy_content_sha256 IS NULL OR p_policy_content_sha256 !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'TASK_REVIEW_INPUT_INVALID' USING errcode='22023'; END IF;
 PERFORM private.closure_assert_open(p_account_id);
 IF NOT EXISTS(SELECT 1 FROM private.ai_task_reviews r WHERE r.id=p_review_id AND r.account_id=p_account_id
   AND r.expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'TASK_REVIEW_NOT_FOUND' USING errcode='42501'; END IF;
 INSERT INTO private.ai_task_review_pre_evaluations(account_id,input_digest,review_id,policy_content_sha256,state,attempt_id,lease_expires_at)
  VALUES(p_account_id,p_input_digest,p_review_id,p_policy_content_sha256,'EVALUATING',extensions.gen_random_uuid(),
   clock_timestamp()+interval '60 seconds')
  ON CONFLICT (account_id,input_digest) DO NOTHING RETURNING * INTO e;
 IF FOUND THEN RETURN jsonb_build_object('state','ACQUIRED','attemptId',e.attempt_id); END IF;
 SELECT * INTO e FROM private.ai_task_review_pre_evaluations WHERE account_id=p_account_id AND input_digest=p_input_digest;
 -- Never a second attempt for the same input: an expired or failed one is simply UNAVAILABLE and
 -- the tap evaluates as before (its own claimed command and budget operation).
 RETURN jsonb_build_object('state',CASE
   WHEN e.state='DECIDED' AND e.policy_content_sha256=p_policy_content_sha256 THEN 'DECIDED'
   WHEN e.state='EVALUATING' AND e.lease_expires_at>clock_timestamp() THEN 'PENDING'
   ELSE 'UNAVAILABLE' END,'attemptId',NULL);
END $function$;
REVOKE ALL ON FUNCTION public.rpc_claim_ai_task_review_pre_evaluation_service(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_claim_ai_task_review_pre_evaluation_service(uuid,uuid,text,text) TO service_role;

CREATE FUNCTION public.rpc_complete_ai_task_review_pre_evaluation_service(p_account_id uuid, p_input_digest text,
  p_attempt_id uuid, p_outcome text, p_rule_ids text[], p_safe_reason_codes text[], p_model_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE e private.ai_task_review_pre_evaluations; v_rules text[]:=coalesce(p_rule_ids,'{}'); v_codes text[]:=coalesce(p_safe_reason_codes,'{}');
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode='42501'; END IF;
 IF p_account_id IS NULL OR p_attempt_id IS NULL OR p_input_digest IS NULL OR p_input_digest !~ '^[a-f0-9]{64}$'
 OR (p_outcome IS NULL AND (cardinality(v_rules)<>0 OR cardinality(v_codes)<>0 OR p_model_ref IS NOT NULL))
 OR (p_outcome IS NOT NULL AND (p_outcome NOT IN ('ALLOW','CLARIFY','REVIEW','BLOCK')
   OR cardinality(v_rules) NOT BETWEEN 1 AND 64 OR cardinality(v_codes)>64
   OR EXISTS(SELECT 1 FROM unnest(v_rules||v_codes) x WHERE x IS NULL OR x !~ '^[A-Z][A-Z0-9_-]{0,63}$')
   OR p_model_ref IS NULL OR p_model_ref !~ '^[a-z0-9][a-z0-9._-]{0,63}$'))
 THEN RAISE EXCEPTION 'TASK_REVIEW_INPUT_INVALID' USING errcode='22023'; END IF;
 SELECT * INTO e FROM private.ai_task_review_pre_evaluations
  WHERE account_id=p_account_id AND input_digest=p_input_digest FOR UPDATE;
 IF NOT FOUND OR e.attempt_id IS DISTINCT FROM p_attempt_id THEN
  RAISE EXCEPTION 'TASK_REVIEW_ATTEMPT_STALE' USING errcode='PT409'; END IF;
 IF e.state<>'EVALUATING' THEN
  -- Exact replay of the stored settlement only; a stored decision never changes.
  IF (e.state='DECIDED' AND e.outcome IS NOT DISTINCT FROM p_outcome AND e.rule_ids=v_rules
      AND e.safe_reason_codes=v_codes AND e.model_ref IS NOT DISTINCT FROM p_model_ref)
  OR (e.state='UNAVAILABLE' AND p_outcome IS NULL) THEN
   RETURN jsonb_build_object('state',e.state,'authoritative',false); END IF;
  RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING errcode='22023';
 END IF;
 UPDATE private.ai_task_review_pre_evaluations SET state=CASE WHEN p_outcome IS NULL THEN 'UNAVAILABLE' ELSE 'DECIDED' END,
  outcome=p_outcome,rule_ids=v_rules,safe_reason_codes=v_codes,model_ref=p_model_ref,settled_at=clock_timestamp()
  WHERE account_id=p_account_id AND input_digest=p_input_digest RETURNING * INTO e;
 RETURN jsonb_build_object('state',e.state,'authoritative',false);
END $function$;
REVOKE ALL ON FUNCTION public.rpc_complete_ai_task_review_pre_evaluation_service(uuid,text,uuid,text,text[],text[],text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_complete_ai_task_review_pre_evaluation_service(uuid,text,uuid,text,text[],text[],text) TO service_role;

CREATE FUNCTION public.rpc_read_ai_task_review_pre_evaluation_service(p_account_id uuid, p_input_digest text, p_policy_content_sha256 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE e private.ai_task_review_pre_evaluations;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode='42501'; END IF;
 IF p_account_id IS NULL OR p_input_digest IS NULL OR p_input_digest !~ '^[a-f0-9]{64}$'
 OR p_policy_content_sha256 IS NULL OR p_policy_content_sha256 !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'TASK_REVIEW_INPUT_INVALID' USING errcode='22023'; END IF;
 SELECT * INTO e FROM private.ai_task_review_pre_evaluations WHERE account_id=p_account_id AND input_digest=p_input_digest
  AND policy_content_sha256=p_policy_content_sha256 AND state='DECIDED';
 IF NOT FOUND THEN RETURN jsonb_build_object('state','NONE','authoritative',false); END IF;
 RETURN jsonb_build_object('state','DECIDED','outcome',e.outcome,'ruleIds',to_jsonb(e.rule_ids),
  'safeReasonCodes',to_jsonb(e.safe_reason_codes),'modelRef',e.model_ref,'authoritative',false);
END $function$;
REVOKE ALL ON FUNCTION public.rpc_read_ai_task_review_pre_evaluation_service(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_read_ai_task_review_pre_evaluation_service(uuid,text,text) TO service_role;

DO $postflight$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure::text sig, p.prosecdef, p.proconfig, p.proacl::text acl FROM pg_proc p
    WHERE p.oid IN ('public.rpc_preview_ai_task_review_publication_context(uuid,text)'::regprocedure,
      'public.rpc_claim_ai_task_review_pre_evaluation_service(uuid,uuid,text,text)'::regprocedure,
      'public.rpc_complete_ai_task_review_pre_evaluation_service(uuid,text,uuid,text,text[],text[],text)'::regprocedure,
      'public.rpc_read_ai_task_review_pre_evaluation_service(uuid,text,text)'::regprocedure) LOOP
    IF f.prosecdef IS DISTINCT FROM true OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
    OR f.acl ~ 'anon=' OR f.acl ~ '(^|[{,])=X' OR (f.sig LIKE '%_service(%' AND f.acl ~ 'authenticated=')
    OR (f.sig LIKE '%_service(%' AND f.acl !~ 'service_role=X') OR (f.sig NOT LIKE '%_service(%' AND f.acl !~ 'authenticated=X')
    THEN RAISE EXCEPTION 'PUBLICATION_PRE_EVALUATION_POSTFLIGHT_ACL %', f.sig; END IF;
  END LOOP;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.ai_task_review_pre_evaluations'::regclass)
  THEN RAISE EXCEPTION 'PUBLICATION_PRE_EVALUATION_POSTFLIGHT_RLS'; END IF;
END
$postflight$;

COMMIT;
