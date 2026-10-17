-- USKOČI P1 source-only candidate. DO NOT DEPLOY until owner-review UI,
-- policy verification and legacy writer shutdown have been proved together.
-- Adds a transaction-bound admission protocol; does NOT change existing needs,
-- worker capabilities, dispatcher, published categories or source triggers.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.work_taxonomy_admissions_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL,
 owner_account_id uuid NOT NULL,
 purpose text NOT NULL CHECK (purpose IN ('WORKER_CAPABILITY','NEED_SERVICE')),
 source_review_id uuid NOT NULL,
 source_review_digest text NOT NULL CHECK (char_length(source_review_digest)=64),
 plan jsonb NOT NULL CHECK (jsonb_typeof(plan)='object'),
 plan_digest text NOT NULL CHECK (char_length(plan_digest)=64),
 catalog_version bigint NOT NULL CHECK (catalog_version>0),
 catalog_fingerprint text NOT NULL CHECK (char_length(catalog_fingerprint)=32),
 status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','COMMITTED')),
 approved_at timestamptz,
 committed_at timestamptz,
 result jsonb,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 UNIQUE(owner_account_id,request_key),
 CHECK ((status='PENDING' AND approved_at IS NULL AND committed_at IS NULL AND result IS NULL)
  OR (status='APPROVED' AND approved_at IS NOT NULL AND committed_at IS NULL AND result IS NULL)
  OR (status='COMMITTED' AND approved_at IS NOT NULL AND committed_at IS NOT NULL AND result IS NOT NULL))
);
REVOKE ALL ON private.work_taxonomy_admissions_v1 FROM PUBLIC,anon,authenticated;
-- Fingerprint supplements catalog_version until old legacy writers stop mutating
-- categories without incrementing the control version.
CREATE OR REPLACE FUNCTION private.taxonomy_admission_fingerprint_v1()
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog
AS $fingerprint$
SELECT md5(
 coalesce((SELECT string_agg(c.id::text||'/'||c.canonical_key||'/'||
      coalesce(c.parent_id::text,'ROOT')||'/'||c.state||'/'||c.catalog_version::text,'|' ORDER BY c.id::text)
      FROM private.work_taxonomy_categories c),'')
 || '#'
 || coalesce((SELECT string_agg(m.category_id::text||'/'||m.execution_scope,'|' ORDER BY m.category_id::text,m.execution_scope)
      FROM private.work_taxonomy_category_modes m),'')
 || '#'
 || coalesce((SELECT string_agg(a.category_id::text||'/'||a.locale||'/'||a.normalized_key,'|' ORDER BY a.category_id::text,a.locale,a.normalized_key)
      FROM private.work_taxonomy_aliases a),'')
);
$fingerprint$;
REVOKE ALL ON FUNCTION private.taxonomy_admission_fingerprint_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.taxonomy_admission_fingerprint_v1() TO service_role;

-- Server-side proposal writer: attaches a bounded semantic plan to an existing
-- owner-bound worker or requester review. No catalogue mutation.
CREATE OR REPLACE FUNCTION public.rpc_taxonomy_prepare_admission_service(
 p_owner_account_id uuid, p_request_key uuid, p_purpose text,
 p_source_review_id uuid, p_plan jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,private AS $prepare$
DECLARE v_review_digest text;v_expiry timestamptz;v_version bigint;
 v_review_plan jsonb;v_expected_review_digest text;
 v_plan_digest text;v_id uuid;v_existing private.work_taxonomy_admissions_v1%ROWTYPE;
 v_action text;v_mode text;v_parent uuid;v_category uuid;
BEGIN
 IF p_owner_account_id IS NULL OR p_request_key IS NULL OR p_source_review_id IS NULL
 OR p_plan IS NULL OR jsonb_typeof(p_plan)<>'object'
 OR p_purpose NOT IN ('WORKER_CAPABILITY','NEED_SERVICE') THEN
  RAISE EXCEPTION 'ADMISSION_INPUT_INVALID' USING errcode='22023'; END IF;
 IF pg_column_size(p_plan)>12000 THEN RAISE EXCEPTION 'ADMISSION_PLAN_TOO_LARGE' USING errcode='22023'; END IF;
 v_action:=p_plan->>'action';v_mode:=p_plan->>'mode';
 IF v_action NOT IN ('REUSE_EXISTING','CREATE_CHILD') OR v_mode NOT IN ('ON_SITE','REMOTE')
 OR jsonb_typeof(p_plan->'catalogVersion')<>'number'
 OR jsonb_typeof(p_plan->'reason')<>'string'
 OR char_length(btrim(p_plan->>'reason')) NOT BETWEEN 10 AND 1000
 THEN RAISE EXCEPTION 'ADMISSION_PLAN_REVIEW_REQUIRED' USING errcode='22023'; END IF;
 IF p_purpose='WORKER_CAPABILITY' THEN
  SELECT w.envelope->>'displayedContentDigest',w.expires_at,
         w.envelope->'classificationProposal',
         encode(extensions.digest(
          ((w.envelope - 'displayedContentDigest') ||
           jsonb_build_object('baseHash',w.base_hash))::text,'sha256'),'hex')
    INTO v_review_digest,v_expiry,v_review_plan,v_expected_review_digest
  FROM private.worker_ai_reviews w
  WHERE w.id=p_source_review_id AND w.account_id=p_owner_account_id
    AND (w.envelope->>'canAccept')::boolean IS TRUE AND w.expires_at>statement_timestamp();
 ELSE
  SELECT t.envelope->>'displayedContentDigest',t.expires_at,
         t.envelope->'classificationProposal',
         encode(extensions.digest(
            jsonb_build_object('envelope',t.envelope - 'displayedContentDigest',
                               'policy',t.policy_binding)::text,'sha256'),'hex')
    INTO v_review_digest,v_expiry,v_review_plan,v_expected_review_digest
  FROM private.ai_task_reviews t
  WHERE t.id=p_source_review_id AND t.account_id=p_owner_account_id
    AND (t.envelope->>'canAccept')::boolean IS TRUE AND t.expires_at>statement_timestamp();
 END IF;
 -- Fail closed for legacy reviews: the classification must be part of the
 -- SAME server-owned payload that the owner actually reviewed.
 IF v_review_digest IS NULL OR v_review_digest !~ '^[0-9a-f]{64}$'
    OR v_review_plan IS NULL OR v_review_plan IS DISTINCT FROM p_plan
    OR v_review_digest IS DISTINCT FROM v_expected_review_digest THEN
  RAISE EXCEPTION 'ADMISSION_REVIEW_PLAN_NOT_DISPLAYED' USING errcode='42501';
 END IF;
 SELECT catalog_version INTO v_version FROM private.work_taxonomy_control WHERE singleton;
 IF v_version IS NULL OR (p_plan->>'catalogVersion')::bigint <> v_version THEN
  RAISE EXCEPTION 'ADMISSION_STALE_CATALOG' USING errcode='40001'; END IF;
 IF v_action='REUSE_EXISTING' THEN
   IF (p_plan->>'categoryId') IS NULL THEN RAISE EXCEPTION 'ADMISSION_ID_REQUIRED'; END IF;
   v_category:=(p_plan->>'categoryId')::uuid;
   PERFORM 1 FROM private.work_taxonomy_categories c
    JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
    WHERE c.id=v_category AND c.state='ESTABLISHED' AND m.execution_scope=v_mode;
   IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_UNKNOWN_CATEGORY_OR_MODE'; END IF;
 ELSE
   IF jsonb_typeof(p_plan->'path')<>'array'
      OR jsonb_array_length(p_plan->'path') NOT BETWEEN 1 AND 6
      OR (p_plan->>'parentId') IS NULL THEN
    RAISE EXCEPTION 'ADMISSION_PATH_INVALID' USING errcode='22023'; END IF;
   v_parent:=(p_plan->>'parentId')::uuid;
   PERFORM 1 FROM private.work_taxonomy_categories c
     JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
     WHERE c.id=v_parent AND c.state='ESTABLISHED' AND m.execution_scope=v_mode;
   IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_UNKNOWN_PARENT_OR_MODE'; END IF;
   -- New root or subtree restructure always requires a separate operator gate.
   IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_plan->'path') t(label)
      WHERE char_length(btrim(t.label)) NOT BETWEEN 3 AND 120
        OR btrim(t.label) ~ '[<>{}\\]' OR btrim(t.label) ~ '[[:cntrl:]]')
     THEN RAISE EXCEPTION 'ADMISSION_NODE_INVALID' USING errcode='22023'; END IF;
   -- Every new level is screened; a safe leaf cannot hide an unsafe ancestor.
   IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_plan->'path') t(label)
      WHERE private.taxonomy_risk_triage_v1(t.label) IN ('BLOCKED','REVIEW_REQUIRED'))
     THEN RAISE EXCEPTION 'ADMISSION_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
   -- Server risk triage is a risk gate, NOT a semantic classifier.
   IF private.taxonomy_risk_triage_v1(p_plan->'path'->>(jsonb_array_length(p_plan->'path')-1))
      <> 'LOW_RISK_CANDIDATE'
     THEN RAISE EXCEPTION 'ADMISSION_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
 END IF;
 v_plan_digest:=encode(extensions.digest(convert_to(p_plan::text,'UTF8'),'sha256'),'hex');
 SELECT * INTO v_existing FROM private.work_taxonomy_admissions_v1
 WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key;
 IF FOUND THEN
  IF v_existing.plan_digest<>v_plan_digest OR v_existing.source_review_id<>p_source_review_id
      OR v_existing.purpose<>p_purpose THEN
   RAISE EXCEPTION 'ADMISSION_REQUEST_REUSED' USING errcode='22023'; END IF;
  RETURN jsonb_build_object('admissionId',v_existing.id,'planDigest',v_existing.plan_digest,
    'status',v_existing.status,'catalogVersion',v_existing.catalog_version);
 END IF;
 INSERT INTO private.work_taxonomy_admissions_v1
 (owner_account_id,request_key,purpose,source_review_id,source_review_digest,plan,
  plan_digest,catalog_version,catalog_fingerprint,expires_at)
 VALUES(p_owner_account_id,p_request_key,p_purpose,p_source_review_id,v_review_digest,p_plan,
 v_plan_digest,v_version,private.taxonomy_admission_fingerprint_v1(),
 least(v_expiry,statement_timestamp()+interval '30 minutes'))
 RETURNING id INTO v_id;
 RETURN jsonb_build_object('admissionId',v_id,'planDigest',v_plan_digest,
  'status','PENDING','catalogVersion',v_version);
END $prepare$;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_prepare_admission_service(uuid,uuid,text,uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_prepare_admission_service(uuid,uuid,text,uuid,jsonb)
 TO service_role;

-- Only the authenticated OWNER can approve the exact plan and exact
-- already-displayed review digest. A Gemini/service proposal cannot approve itself.
CREATE OR REPLACE FUNCTION public.rpc_taxonomy_approve_admission(
 p_admission_id uuid,p_plan_digest text,p_displayed_review_digest text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,private AS $approve$
DECLARE v private.work_taxonomy_admissions_v1%ROWTYPE;v_owner uuid;
BEGIN
 v_owner:=auth.uid();
 IF v_owner IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
 SELECT * INTO v FROM private.work_taxonomy_admissions_v1
  WHERE id=p_admission_id AND owner_account_id=v_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_NOT_OWNED' USING errcode='42501'; END IF;
 IF v.status='COMMITTED' THEN RETURN v.result; END IF;
 IF v.expires_at<=statement_timestamp() THEN RAISE EXCEPTION 'ADMISSION_EXPIRED'; END IF;
 IF v.plan_digest IS DISTINCT FROM p_plan_digest
 OR v.source_review_digest IS DISTINCT FROM p_displayed_review_digest THEN
  RAISE EXCEPTION 'ADMISSION_DISPLAY_MISMATCH' USING errcode='42501'; END IF;
 -- This is not a second consent action. The EXISTING Save profile / Accept
 -- task review command must already have succeeded for the same review and
 -- exact idempotency/request key. A caller knowing the digest is not enough.
 IF v.purpose='WORKER_CAPABILITY' THEN
  PERFORM 1 FROM private.worker_ai_saves s
   WHERE s.review_id=v.source_review_id
     AND s.account_id=v.owner_account_id
     AND s.client_request_id=v.request_key;
 ELSE
  PERFORM 1 FROM private.ai_task_review_commands c
   WHERE c.review_id=v.source_review_id
     AND c.account_id=v.owner_account_id
     AND c.client_request_id=v.request_key
     AND c.state IN ('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED');
 END IF;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'ADMISSION_REVIEW_SAVE_REQUIRED' USING errcode='42501'; END IF;
 IF v.status='PENDING' THEN
   UPDATE private.work_taxonomy_admissions_v1 SET status='APPROVED',approved_at=statement_timestamp()
   WHERE id=v.id;
 END IF;
 RETURN jsonb_build_object('admissionId',v.id,'status','APPROVED');
END $approve$;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_approve_admission(uuid,text,text)
 FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_approve_admission(uuid,text,text) TO authenticated;

-- One atomic accepted plan; receipt is replay-safe. NO skills/need/dispatch writes.
CREATE OR REPLACE FUNCTION public.rpc_taxonomy_commit_admission_service(
 p_admission_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,private AS $commit$
DECLARE v private.work_taxonomy_admissions_v1%ROWTYPE;v_version bigint;
 v_action text;v_mode text;v_parent uuid;v_id uuid;v_label text;v_key text;
 v_existing_parent uuid;v_scope_exists boolean;v_added integer:=0;v_receipt jsonb;
 i integer;v_node_count integer;
BEGIN
 SELECT * INTO v FROM private.work_taxonomy_admissions_v1 WHERE id=p_admission_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_NOT_FOUND' USING errcode='22023'; END IF;
 IF v.status='COMMITTED' THEN RETURN v.result; END IF;
 IF v.plan_digest IS DISTINCT FROM
    encode(extensions.digest(convert_to(v.plan::text,'UTF8'),'sha256'),'hex') THEN
  RAISE EXCEPTION 'ADMISSION_PLAN_TAMPERED' USING errcode='42501'; END IF;
 IF v.status<>'APPROVED' OR v.approved_at IS NULL THEN
  RAISE EXCEPTION 'ADMISSION_OWNER_APPROVAL_REQUIRED' USING errcode='42501'; END IF;
 IF v.expires_at<=statement_timestamp() THEN RAISE EXCEPTION 'ADMISSION_EXPIRED'; END IF;
 -- Serialize admission writers. Old unsafe writers must be retired before live enable.
 SELECT catalog_version INTO v_version
  FROM private.work_taxonomy_control WHERE singleton FOR UPDATE;
 IF v_version<>v.catalog_version OR
    private.taxonomy_admission_fingerprint_v1()<>v.catalog_fingerprint THEN
  RAISE EXCEPTION 'ADMISSION_STALE_CATALOG_REPLAN' USING errcode='40001'; END IF;
 v_action:=v.plan->>'action';v_mode:=v.plan->>'mode';
 IF v_action='REUSE_EXISTING' THEN
  v_id:=(v.plan->>'categoryId')::uuid;
  PERFORM 1 FROM private.work_taxonomy_categories c
    JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
    WHERE c.id=v_id AND c.state='ESTABLISHED' AND m.execution_scope=v_mode;
  IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_CATEGORY_CHANGED'; END IF;
 ELSE
  IF v_action<>'CREATE_CHILD' OR jsonb_typeof(v.plan->'path')<>'array' THEN
    RAISE EXCEPTION 'ADMISSION_ACTION_UNSUPPORTED'; END IF;
  v_parent:=(v.plan->>'parentId')::uuid;
  v_node_count:=jsonb_array_length(v.plan->'path');
  IF v_node_count NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'ADMISSION_PATH_INVALID'; END IF;
  PERFORM 1 FROM private.work_taxonomy_categories c
   JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
   WHERE c.id=v_parent AND c.state='ESTABLISHED' AND m.execution_scope=v_mode;
  IF NOT FOUND THEN RAISE EXCEPTION 'ADMISSION_PARENT_CHANGED'; END IF;
  IF private.taxonomy_risk_triage_v1(v.plan->'path'->>(v_node_count-1))
     <> 'LOW_RISK_CANDIDATE' THEN RAISE EXCEPTION 'ADMISSION_SAFETY_REVIEW_REQUIRED'; END IF;
  FOR i IN 0..v_node_count-1 LOOP
   v_label:=btrim(v.plan->'path'->>i);
   IF char_length(v_label) NOT BETWEEN 3 AND 120
      OR v_label ~ '[<>{}\\]' OR v_label ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'ADMISSION_NODE_INVALID' USING errcode='22023'; END IF;
   IF private.taxonomy_risk_triage_v1(v_label) IN ('BLOCKED','REVIEW_REQUIRED') THEN
     RAISE EXCEPTION 'ADMISSION_SAFETY_REVIEW_REQUIRED' USING errcode='42501'; END IF;
   v_key:=private.taxonomy_normalize_v1(v_label);
   IF char_length(v_key) NOT BETWEEN 3 AND 160 THEN
      RAISE EXCEPTION 'ADMISSION_NORMALIZATION_INVALID'; END IF;
   IF EXISTS (SELECT 1 FROM private.work_taxonomy_aliases a
     WHERE a.normalized_key=v_key) THEN
     RAISE EXCEPTION 'ADMISSION_ALIAS_COLLISION_REVIEW_REQUIRED'; END IF;
   v_id:=NULL;
   SELECT c.id,c.parent_id INTO v_id,v_existing_parent
   FROM private.work_taxonomy_categories c WHERE c.canonical_key=v_key
   FOR UPDATE;
   IF FOUND THEN
    IF v_existing_parent IS DISTINCT FROM v_parent OR
       NOT EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes
        WHERE category_id=v_id AND execution_scope=v_mode) THEN
      RAISE EXCEPTION 'ADMISSION_MEANING_OR_MODE_COLLISION_REVIEW_REQUIRED'; END IF;
   ELSE
    UPDATE private.work_taxonomy_control
      SET catalog_version=catalog_version+1,updated_at=statement_timestamp()
      WHERE singleton RETURNING catalog_version INTO v_version;
    INSERT INTO private.work_taxonomy_categories
      (canonical_key,label,parent_id,state,source,catalog_version)
    VALUES(v_key,v_label,v_parent,'ESTABLISHED','AI_REVIEWED',v_version)
    RETURNING id INTO v_id;
    INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
     VALUES(v_id,v_mode,'OWNER_APPROVED_ADMISSION_V1');
    INSERT INTO private.work_taxonomy_audit
      (action,category_id,normalized_key,catalog_version,source_ref)
    VALUES('AUTO_CREATED',v_id,v_key,v_version,'OWNER_APPROVED_ADMISSION_V1:'||v.id::text);
    v_added:=v_added+1;
   END IF;
   v_parent:=v_id;
  END LOOP;
 END IF;
 v_receipt:=jsonb_build_object('admissionId',v.id,'categoryId',v_id,
   'catalogVersion',v_version,'createdCount',v_added,'status','COMMITTED',
   'capabilityAuthority','NONE','notificationAuthority','NONE',
   'requiresPostSaveBinding',true);
 UPDATE private.work_taxonomy_admissions_v1
  SET status='COMMITTED',committed_at=statement_timestamp(),result=v_receipt
  WHERE id=v.id;
 RETURN v_receipt;
END $commit$;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_commit_admission_service(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_commit_admission_service(uuid) TO service_role;
COMMIT;
