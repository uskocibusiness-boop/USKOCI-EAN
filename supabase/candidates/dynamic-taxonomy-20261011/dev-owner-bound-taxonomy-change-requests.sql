-- USKOCI: SAFE staged taxonomy change requests, not category creation.
-- A logged-in requester may explicitly request a new category for their OWN
-- current DRAFT need revision. Existing category, parent, execution mode,
-- rate limit and known collision/risk are verified server side.
-- AI has NO direct write access. NO worker capability, need snapshot or push.
-- This does NOT flip auto_registration_enabled; approval/promotion is separate.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $guard$
BEGIN
 IF to_regclass('private.work_taxonomy_change_requests') IS NOT NULL
 OR to_regprocedure('public.rpc_request_taxonomy_change_for_need(uuid,integer,uuid)') IS NOT NULL
 THEN RAISE EXCEPTION 'USKOCI_TAXONOMY_CHANGE_REQUESTS_ALREADY_INSTALLED'; END IF;
 IF to_regprocedure('private.taxonomy_preview_v1(text)') IS NULL
 OR to_regprocedure('private.taxonomy_execution_scope_v1(text)') IS NULL
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'USKOCI_TAXONOMY_CHANGE_REQUESTS_PRECONDITION'; END IF;
END $guard$;

CREATE TABLE private.work_taxonomy_change_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 need_id uuid NOT NULL REFERENCES public.needs(id) ON DELETE RESTRICT,
 need_revision integer NOT NULL CHECK(need_revision > 0),
 requester_account_id uuid NOT NULL,
 proposed_label text NOT NULL CHECK(char_length(btrim(proposed_label)) BETWEEN 3 AND 120),
 proposed_key text NOT NULL CHECK(char_length(proposed_key) BETWEEN 3 AND 160),
 parent_category_id uuid NOT NULL REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT,
 execution_scope text NOT NULL CHECK(execution_scope IN ('ON_SITE','REMOTE')),
 risk_disposition text NOT NULL CHECK(risk_disposition IN
   ('LOW_RISK_CANDIDATE','REVIEW_REQUIRED','NEEDS_CLARIFICATION')),
 state text NOT NULL DEFAULT 'PENDING_REVIEW' CHECK(state IN
   ('PENDING_REVIEW','APPROVED','REJECTED','APPLIED')),
 approved_category_id uuid REFERENCES private.work_taxonomy_categories(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 UNIQUE(need_id,need_revision),
 CHECK(state <> 'APPLIED' OR approved_category_id IS NOT NULL)
);
CREATE INDEX work_taxonomy_change_requests_actor_idx
 ON private.work_taxonomy_change_requests(requester_account_id,created_at);
CREATE INDEX work_taxonomy_change_requests_state_idx
 ON private.work_taxonomy_change_requests(state,created_at);
ALTER TABLE private.work_taxonomy_change_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.work_taxonomy_change_requests FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.rpc_request_taxonomy_change_for_need(
 p_need_id uuid,p_need_revision integer,p_parent_category_id uuid
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog
AS $function$
DECLARE
 v_actor uuid;
 v_need public.needs%ROWTYPE;
 v_scope text;
 v_key text;
 v_parent_mode boolean;
 v_preview jsonb;
 v_risk text;
 v_existing private.work_taxonomy_change_requests%ROWTYPE;
 v_id uuid;
BEGIN
 v_actor:=auth.uid();
 IF v_actor IS NULL THEN
  RAISE EXCEPTION 'USKOCI_TAXONOMY_AUTH_REQUIRED' USING ERRCODE='28000';
 END IF;
 IF p_need_id IS NULL OR p_need_revision IS NULL OR p_parent_category_id IS NULL THEN
  RAISE EXCEPTION 'USKOCI_TAXONOMY_REQUEST_INVALID' USING ERRCODE='22023';
 END IF;
 -- Lock need row and bind to actual requester identity, status, revision and mode.
 SELECT n.* INTO v_need FROM public.needs n WHERE n.id=p_need_id FOR UPDATE;
 IF NOT FOUND OR v_need.requester_account_id IS DISTINCT FROM v_actor THEN
  RAISE EXCEPTION 'USKOCI_TAXONOMY_NEED_NOT_OWNED' USING ERRCODE='42501';
 END IF;
 IF v_need.status <> 'DRAFT' OR v_need.revision <> p_need_revision THEN
  RAISE EXCEPTION 'USKOCI_TAXONOMY_NEED_NOT_CURRENT_DRAFT' USING ERRCODE='PT409';
 END IF;
 IF v_need.category IS NULL OR char_length(btrim(v_need.category)) NOT BETWEEN 3 AND 120
    OR v_need.category ~ '[<>{}\\]' OR v_need.category ~ '[[:cntrl:]]' THEN
  RAISE EXCEPTION 'USKOCI_TAXONOMY_LABEL_INVALID' USING ERRCODE='22023';
 END IF;
 v_scope:=private.taxonomy_execution_scope_v1(v_need.execution_location_mode);
 IF v_scope IS NULL THEN
  RAISE EXCEPTION 'USKOCI_TAXONOMY_EXECUTION_MODE_UNRESOLVED' USING ERRCODE='22023';
 END IF;
 -- Prevent pushing a remote category into a physical-only parent and vice versa.
 SELECT EXISTS (
  SELECT 1 FROM private.work_taxonomy_categories c
  JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
  WHERE c.id=p_parent_category_id
    AND m.execution_scope=v_scope AND c.state='ESTABLISHED'
 ) INTO v_parent_mode;
 IF NOT v_parent_mode THEN
  RAISE EXCEPTION 'USKOCI_TAXONOMY_PARENT_OUT_OF_SCOPE' USING ERRCODE='22023';
 END IF;
 v_key:=private.taxonomy_normalize_v1(v_need.category);
 IF v_key = '' OR char_length(v_key) NOT BETWEEN 3 AND 160
   OR v_key IN ('ostalo','drugo','razno')
 THEN RAISE EXCEPTION 'USKOCI_TAXONOMY_CANONICAL_KEY_INVALID' USING ERRCODE='22023'; END IF;

 -- Existing exact category or alias? Reuse suggestion, no new category.
 -- Source is the current saved need, never an AI-supplied arbitrary label.
 v_preview:=private.taxonomy_preview_v1(v_need.category);
 IF v_preview->>'action'='REUSE_EXISTING' THEN
  IF NOT EXISTS (
    SELECT 1 FROM private.work_taxonomy_category_modes m
    WHERE m.category_id=(v_preview->>'categoryId')::uuid
      AND m.execution_scope=v_scope
  ) THEN
    RETURN jsonb_build_object('action','CLARIFY',
     'reason','EXISTING_CATEGORY_WRONG_EXECUTION_SCOPE',
     'executionScope',v_scope,'notificationAuthority','NONE',
     'classificationAuthority','NONE');
  END IF;
  RETURN jsonb_build_object('action','REVIEW_EXISTING_SERVICE',
   'categoryId',v_preview->>'categoryId','executionScope',v_scope,
   'requiresRequesterReview',true,'notificationAuthority','NONE',
   'classificationAuthority','NONE');
 END IF;
 IF v_preview->>'action'='SAFETY_REVIEW' THEN
  RETURN jsonb_build_object('action','MANUAL_SAFETY_REVIEW',
   'executionScope',v_scope,'notificationAuthority','NONE',
   'classificationAuthority','NONE');
 ELSIF v_preview->>'action'='REJECT' THEN
  RETURN jsonb_build_object('action','REJECTED_SAFETY',
   'executionScope',v_scope,'notificationAuthority','NONE',
   'classificationAuthority','NONE');
 END IF;
 IF v_preview->>'action' <> 'PROPOSE_AUTO_PROVISIONAL' THEN
  RETURN jsonb_build_object('action','CLARIFY',
   'reason','AMBIGUOUS_OR_COLLIDING_SERVICE','executionScope',v_scope,
   'notificationAuthority','NONE','classificationAuthority','NONE');
 END IF;

 v_risk:=private.taxonomy_risk_triage_v1(v_need.category);
 IF v_risk='BLOCKED' THEN
  RETURN jsonb_build_object('action','REJECTED_SAFETY',
   'executionScope',v_scope,'notificationAuthority','NONE',
   'classificationAuthority','NONE');
 END IF;
 IF v_risk NOT IN ('LOW_RISK_CANDIDATE','REVIEW_REQUIRED','NEEDS_CLARIFICATION') THEN
  RETURN jsonb_build_object('action','CLARIFY','reason','RISK_UNRESOLVED',
   'notificationAuthority','NONE','classificationAuthority','NONE');
 END IF;

 -- Per-revision idempotence; edited categories need a NEW need revision.
 SELECT q.* INTO v_existing
 FROM private.work_taxonomy_change_requests q
 WHERE q.need_id=p_need_id AND q.need_revision=p_need_revision
 FOR UPDATE;
 IF FOUND THEN
  IF v_existing.requester_account_id IS DISTINCT FROM v_actor OR
     v_existing.proposed_key IS DISTINCT FROM v_key OR
     v_existing.parent_category_id IS DISTINCT FROM p_parent_category_id OR
     v_existing.execution_scope IS DISTINCT FROM v_scope THEN
    RAISE EXCEPTION 'USKOCI_TAXONOMY_REQUEST_CHANGED_SAME_REVISION' USING ERRCODE='PT409';
  END IF;
  RETURN jsonb_build_object('action','ALREADY_REQUESTED','requestId',v_existing.id,
   'state',v_existing.state,'executionScope',v_scope,
   'notificationAuthority','NONE','classificationAuthority','NONE');
 END IF;

 IF (SELECT COUNT(*) FROM private.work_taxonomy_change_requests
     WHERE requester_account_id=v_actor AND created_at>statement_timestamp()-INTERVAL '24 hours')>=20 THEN
  RAISE EXCEPTION 'USKOCI_TAXONOMY_REQUEST_RATE_LIMIT' USING ERRCODE='PT429';
 END IF;

 INSERT INTO private.work_taxonomy_change_requests(
  need_id,need_revision,requester_account_id,proposed_label,proposed_key,
  parent_category_id,execution_scope,risk_disposition
 ) VALUES(
  p_need_id,p_need_revision,v_actor,btrim(v_need.category),v_key,
  p_parent_category_id,v_scope,v_risk
 ) RETURNING id INTO v_id;
 RETURN jsonb_build_object('action','PENDING_REVIEW','requestId',v_id,
  'executionScope',v_scope,'riskDisposition',v_risk,
  'requiresRequesterReview',true,'classificationAuthority','NONE',
  'notificationAuthority','NONE');
END
$function$;

-- Explicit Supabase public-default EXECUTE grants must also be revoked.
REVOKE ALL ON FUNCTION public.rpc_request_taxonomy_change_for_need(uuid,integer,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_request_taxonomy_change_for_need(uuid,integer,uuid)
 TO authenticated;

DO $postcheck$
BEGIN
 IF has_table_privilege('authenticated','private.work_taxonomy_change_requests','SELECT')
 OR has_table_privilege('authenticated','private.work_taxonomy_change_requests','INSERT')
 OR has_table_privilege('service_role','private.work_taxonomy_change_requests','INSERT')
 OR has_function_privilege('anon','public.rpc_request_taxonomy_change_for_need(uuid,integer,uuid)','EXECUTE')
 OR has_function_privilege('service_role','public.rpc_request_taxonomy_change_for_need(uuid,integer,uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.rpc_request_taxonomy_change_for_need(uuid,integer,uuid)','EXECUTE')
 OR (SELECT count(*) FROM private.work_taxonomy_change_requests)<>0
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton)
 THEN RAISE EXCEPTION 'USKOCI_TAXONOMY_REQUEST_POSTCHECK_FAILED'; END IF;
END $postcheck$;
