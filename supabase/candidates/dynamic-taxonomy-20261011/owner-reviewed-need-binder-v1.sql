-- Gate B SOURCE-ONLY, NOT DEPLOYED. Idempotent owner-reviewed Need revision binder.
-- Requires owner-reviewed-batch-admission-v1.sql and existing saved Need review.
-- Does not publish, dispatch, alter skill, change Need revision, or send notification.
-- Never bind an older review to a newer Need revision or overwrite another UUID.
BEGIN;
ALTER TABLE private.work_taxonomy_need_snapshots
 DROP CONSTRAINT work_taxonomy_need_snapshots_source_check;
ALTER TABLE private.work_taxonomy_need_snapshots
 ADD CONSTRAINT work_taxonomy_need_snapshots_source_check
 CHECK(source IN ('AI_PROPOSED','REQUESTER_CORRECTED','SYSTEM_MIGRATED','OWNER_REVIEWED_BATCH'));
CREATE TABLE IF NOT EXISTS private.work_taxonomy_need_bindings_v1(
 owner_account_id uuid NOT NULL,
 request_key uuid NOT NULL,
 source_review_id uuid NOT NULL,
 need_id uuid NOT NULL,
 need_revision integer NOT NULL CHECK(need_revision>0),
 category_id uuid NOT NULL,
 catalog_version bigint NOT NULL CHECK(catalog_version>0),
 result jsonb NOT NULL,
 bound_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 PRIMARY KEY(owner_account_id,request_key),
 UNIQUE(need_id,need_revision)
);
ALTER TABLE private.work_taxonomy_need_bindings_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.work_taxonomy_need_bindings_v1 FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_bind_reviewed_need_service(
 p_owner_account_id uuid,p_request_key uuid,p_source_review_id uuid,
 p_need_id uuid,p_need_revision integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private
AS $binder$
DECLARE
 v_existing private.work_taxonomy_need_bindings_v1%ROWTYPE;
 v_batch private.work_taxonomy_review_batches_v1%ROWTYPE;
 v_review private.ai_task_reviews%ROWTYPE;
 v_command private.ai_task_review_commands%ROWTYPE;
 v_need public.needs%ROWTYPE;
 v_plan jsonb;v_item jsonb;v_category uuid;v_scope text;v_service text;v_category_version bigint;
 v_expected_digest text;v_result jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
   RAISE EXCEPTION 'NEED_BINDER_SERVICE_ROLE_REQUIRED' USING errcode='42501';
 END IF;
 IF p_owner_account_id IS NULL OR p_request_key IS NULL OR p_source_review_id IS NULL
    OR p_need_id IS NULL OR coalesce(p_need_revision,0)<1 THEN
   RAISE EXCEPTION 'NEED_BINDER_INPUT_INVALID' USING errcode='22023';
 END IF;
 SELECT * INTO v_existing FROM private.work_taxonomy_need_bindings_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key FOR UPDATE;
 IF FOUND THEN
   IF v_existing.source_review_id<>p_source_review_id OR v_existing.need_id<>p_need_id
     OR v_existing.need_revision<>p_need_revision THEN
     RAISE EXCEPTION 'NEED_BINDER_REQUEST_KEY_REUSED' USING errcode='22023';
   END IF;
   RETURN v_existing.result;
 END IF;
 SELECT * INTO v_batch FROM private.work_taxonomy_review_batches_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key
    AND source_review_id=p_source_review_id AND purpose='NEED_SERVICE' FOR SHARE;
 IF NOT FOUND OR v_batch.result->>'status'<>'COMMITTED'
   OR v_batch.result->'requiresBinding' IS DISTINCT FROM 'true'::jsonb
   OR v_batch.result->'capabilityAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR v_batch.result->'notificationAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR jsonb_typeof(v_batch.result->'items')<>'array'
   OR jsonb_array_length(v_batch.result->'items')<>1 THEN
   RAISE EXCEPTION 'NEED_BINDER_ADMISSION_NOT_COMMITTED' USING errcode='42501';
 END IF;
 SELECT * INTO v_review FROM private.ai_task_reviews r
  WHERE r.id=p_source_review_id AND r.account_id=p_owner_account_id FOR SHARE;
 IF NOT FOUND OR v_review.envelope->>'classificationState'<>'READY'
   OR v_review.envelope->>'displayedContentDigest' IS DISTINCT FROM v_batch.review_digest
   OR v_review.envelope->'classificationCandidates' IS DISTINCT FROM v_batch.plans
   OR jsonb_array_length(coalesce(v_review.envelope->'classificationCandidates','[]'::jsonb))<>1 THEN
   RAISE EXCEPTION 'NEED_BINDER_REVIEW_NOT_BOUND' USING errcode='42501';
 END IF;
 v_expected_digest:=encode(extensions.digest(jsonb_build_object('envelope',
   v_review.envelope-'displayedContentDigest','policy',v_review.policy_binding)::text,'sha256'),'hex');
 IF v_expected_digest<>v_batch.review_digest THEN
   RAISE EXCEPTION 'NEED_BINDER_REVIEW_DIGEST_INVALID' USING errcode='42501';
 END IF;
 SELECT * INTO v_command FROM private.ai_task_review_commands c
  WHERE c.review_id=p_source_review_id AND c.account_id=p_owner_account_id
    AND c.client_request_id=p_request_key AND c.need_id=p_need_id
    AND c.need_revision=p_need_revision
    AND c.state IN ('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NEED_BINDER_SAVE_REQUIRED' USING errcode='42501'; END IF;
 v_plan:=v_batch.plans->0;
 v_item:=v_batch.result->'items'->0;
 IF v_plan->>'mode' IS DISTINCT FROM v_item->>'mode'
   OR private.taxonomy_normalize_v1(v_plan->>'service')
      IS DISTINCT FROM private.taxonomy_normalize_v1(v_item->>'service')
   OR v_plan->>'action' NOT IN ('REUSE_EXISTING','CREATE_CHILD')
 THEN RAISE EXCEPTION 'NEED_BINDER_CATEGORY_RECEIPT_INVALID' USING errcode='42501'; END IF;
 v_category:=(v_item->>'categoryId')::uuid;
 v_category_version:=v_batch.catalog_version;
 SELECT * INTO v_need FROM public.needs n WHERE n.id=p_need_id FOR UPDATE;
 IF NOT FOUND OR v_need.requester_account_id<>p_owner_account_id OR
    v_need.revision<>p_need_revision OR v_need.status NOT IN ('DRAFT','PUBLISHED') THEN
   RAISE EXCEPTION 'NEED_BINDER_CURRENT_REVISION_REQUIRED' USING errcode='PT409';
 END IF;
 v_scope:=private.taxonomy_execution_scope_v1(v_need.execution_location_mode);
 IF v_scope IS NULL OR v_scope<>v_item->>'mode'
   OR private.taxonomy_normalize_v1(v_need.category)
      <>private.taxonomy_normalize_v1(v_item->>'service')
 THEN RAISE EXCEPTION 'NEED_BINDER_SERVICE_OR_MODE_STALE' USING errcode='PT409'; END IF;
 PERFORM 1 FROM private.work_taxonomy_categories c
  JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
  WHERE c.id=v_category AND c.state='ESTABLISHED' AND m.execution_scope=v_scope;
 IF NOT FOUND THEN RAISE EXCEPTION 'NEED_BINDER_CATEGORY_RETIRED' USING errcode='42501'; END IF;
 IF v_need.category_id IS NOT NULL AND v_need.category_id<>v_category THEN
   RAISE EXCEPTION 'NEED_BINDER_CONFLICTING_EXISTING_CATEGORY' USING errcode='PT409'; END IF;
 PERFORM 1 FROM private.work_taxonomy_need_snapshots s
  WHERE s.need_id=p_need_id AND s.need_revision=p_need_revision FOR UPDATE;
 IF FOUND THEN RAISE EXCEPTION 'NEED_BINDER_EXISTING_SNAPSHOT_REVIEW_REQUIRED' USING errcode='PT409'; END IF;
 -- Same transaction: category reference + single authoritative revision
 -- snapshot + durable replay receipt. A failed write rolls all three back.
 UPDATE public.needs SET category_id=v_category WHERE id=p_need_id
    AND revision=p_need_revision AND category_id IS DISTINCT FROM v_category;
 INSERT INTO private.work_taxonomy_need_snapshots
  (need_id,need_revision,category_id,catalog_version,reviewed_by_requester,
   source,classification_state,original_category)
 VALUES(p_need_id,p_need_revision,v_category,v_category_version,true,
   'OWNER_REVIEWED_BATCH','CONFIRMED',v_need.category);
 v_result:=jsonb_build_object('status','BOUND_NEED_REVISION',
   'needId',p_need_id,'needRevision',p_need_revision,'categoryId',v_category,
   'catalogVersion',v_category_version,
   'dispatchAuthority','NONE','notificationAuthority','NONE');
 INSERT INTO private.work_taxonomy_need_bindings_v1
  (owner_account_id,request_key,source_review_id,need_id,need_revision,
   category_id,catalog_version,result)
 VALUES(p_owner_account_id,p_request_key,p_source_review_id,p_need_id,
   p_need_revision,v_category,v_category_version,v_result);
 RETURN v_result;
END $binder$;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_bind_reviewed_need_service(uuid,uuid,uuid,uuid,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_bind_reviewed_need_service(uuid,uuid,uuid,uuid,integer)
 TO service_role;
COMMIT;
