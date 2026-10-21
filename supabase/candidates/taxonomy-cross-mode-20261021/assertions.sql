-- Deterministic disposable-fixture assertions. Never run against live DEV.
BEGIN;
CREATE OR REPLACE FUNCTION proof.cross_mode_plan(p_service text,p_mode text,p_action text,
 p_category text,p_parent text,p_path jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $fn$
 SELECT jsonb_build_object('service',p_service,'mode',p_mode,'action',p_action,
  'categoryId',p_category,'parentId',p_parent,'proposedPath',p_path,
  'reason','The owner explicitly offers this precise service in the chosen execution mode.',
  'catalogVersion',(SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton))
$fn$;
CREATE OR REPLACE FUNCTION proof.cross_mode_review(p_service text,p_proposals jsonb)
 RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE v_modes jsonb;v_skills jsonb:=jsonb_build_array(p_service);v_version bigint;
BEGIN
 SELECT catalog_version INTO v_version FROM private.work_taxonomy_control WHERE singleton;
 SELECT jsonb_agg(jsonb_build_object('service',p_service,'mode',p.value->>'mode') ORDER BY p.ordinality)
 INTO v_modes FROM jsonb_array_elements(p_proposals) WITH ORDINALITY p(value,ordinality);
 INSERT INTO private.worker_ai_sessions VALUES(proof.id(2),proof.id(1),jsonb_build_object('skills',v_skills),1,'synthetic-base');
 INSERT INTO private.worker_ai_turns(account_id,conversation_id,client_request_id,turn_id,attempt_id,state,source_revision,completion_hash)
 VALUES(proof.id(1),proof.id(2),proof.id(41),proof.id(42),proof.id(43),'SUCCEEDED',0,repeat('a',64));
 PERFORM public.rpc_taxonomy_capture_gemini_turn_hints_service(proof.id(1),proof.id(2),proof.id(41),
  proof.id(42),proof.id(43),'WORKER_CAPABILITY',v_version,p_proposals);
 RETURN private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY',v_skills,v_modes,proof.id(1),proof.id(2));
END $fn$;
-- Model the exact classification fields copied by the active review wrapper.
CREATE OR REPLACE FUNCTION proof.client_pending_contract(p jsonb) RETURNS boolean
 LANGUAGE sql IMMUTABLE AS $fn$
 WITH envelope(doc) AS (SELECT jsonb_build_object(
  'classificationState',p->>'status',
  'classificationCandidates',p->'classificationCandidates',
  'reviewedServiceModes',p->'reviewedServiceModes',
  'classificationCatalogVersion',p->'classificationCatalogVersion',
  'classificationCatalogFingerprint',p->'classificationCatalogFingerprint'))
 SELECT coalesce((SELECT doc->>'classificationState'='PENDING_CLASSIFICATION'
  AND doc->'classificationCandidates'='[]'::jsonb
  AND doc->'reviewedServiceModes'='[]'::jsonb
  AND doc->'classificationCatalogVersion'='null'::jsonb
  AND doc->'classificationCatalogFingerprint'='null'::jsonb FROM envelope),false)
$fn$;
DO $test$
DECLARE p jsonb;s text:='Izrada test figurica';e text:='Restauracija muzičkih kutija';
BEGIN
 PERFORM proof.reset();
 p:=proof.cross_mode_review(s,jsonb_build_array(
  proof.cross_mode_plan(s,'ON_SITE','CREATE_CHILD','',proof.id(501)::text,jsonb_build_array(s)),
  proof.cross_mode_plan(s,'REMOTE','CREATE_CHILD','',proof.id(501)::text,jsonb_build_array(s))));
 PERFORM proof.require(p->>'status'='READY' AND jsonb_array_length(p->'classificationCandidates')=2,
  'SAME_NEW_PARENT_AND_PATH_READY');
 PERFORM proof.require((SELECT count(*)=1 FROM private.work_taxonomy_categories),
  'REVIEW_DOES_NOT_CREATE_CATEGORY');

 PERFORM proof.reset();
 p:=proof.cross_mode_review(s,jsonb_build_array(
  proof.cross_mode_plan(s,'REMOTE','CREATE_CHILD','',proof.id(501)::text,jsonb_build_array(s)),
  proof.cross_mode_plan(s,'ON_SITE','CREATE_CHILD','',proof.id(501)::text,jsonb_build_array(s))));
 PERFORM proof.require(p->>'status'='READY' AND jsonb_array_length(p->'classificationCandidates')=2,
  'REVERSED_MODE_ORDER_SAME_IDENTITY_READY');

 PERFORM proof.reset();
 INSERT INTO private.work_taxonomy_categories(id,canonical_key,label,state,source,catalog_version)
 VALUES(proof.id(502),private.taxonomy_normalize_v1('Izrada maketa'),'Izrada maketa','ESTABLISHED','SYSTEM',10);
 p:=proof.cross_mode_review(s,jsonb_build_array(
  proof.cross_mode_plan(s,'ON_SITE','CREATE_CHILD','',proof.id(501)::text,jsonb_build_array(s)),
  proof.cross_mode_plan(s,'REMOTE','CREATE_CHILD','',proof.id(502)::text,jsonb_build_array(s))));
 PERFORM proof.require(proof.client_pending_contract(p)
  AND p->>'reason'='CROSS_MODE_IDENTITY_CONFLICT','DIFFERENT_PARENT_HAS_NO_SIGNABLE_PLAN');

 PERFORM proof.reset();
 p:=proof.cross_mode_review(s,jsonb_build_array(
  proof.cross_mode_plan(s,'ON_SITE','CREATE_CHILD','',proof.id(501)::text,jsonb_build_array(s)),
  proof.cross_mode_plan(s,'REMOTE','CREATE_CHILD','',proof.id(501)::text,
   jsonb_build_array('Izrada test modela',s))));
 PERFORM proof.require(proof.client_pending_contract(p)
  AND p->>'reason'='CROSS_MODE_IDENTITY_CONFLICT','DIFFERENT_PATH_HAS_NO_SIGNABLE_PLAN');

 PERFORM proof.reset();
 p:=proof.cross_mode_review(s,jsonb_build_array(
  proof.cross_mode_plan(s,'ON_SITE','CREATE_NEW_BRANCH','','',jsonb_build_array(s)),
  proof.cross_mode_plan(s,'REMOTE','CREATE_NEW_BRANCH','','',jsonb_build_array(s))));
 PERFORM proof.require(p->>'status'='READY' AND jsonb_array_length(p->'classificationCandidates')=2,
  'SAME_NEW_ROOT_PATH_READY');

 PERFORM proof.reset();PERFORM proof.seed_service(e);
 INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
 VALUES(proof.id(601),'REMOTE','SYNTHETIC');
 p:=private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY',jsonb_build_array(e),
  jsonb_build_array(jsonb_build_object('service',e,'mode','ON_SITE'),
   jsonb_build_object('service',e,'mode','REMOTE')),proof.id(1),proof.id(2));
 PERFORM proof.require(p->>'status'='READY'
  AND p#>>'{classificationCandidates,0,categoryId}'=proof.id(601)::text
  AND p#>>'{classificationCandidates,1,categoryId}'=proof.id(601)::text,
  'EXACT_ONLY_DUAL_MODE_READY_SAME_ID');

 PERFORM proof.reset();PERFORM proof.seed_service(e);
 p:=proof.cross_mode_review(e,jsonb_build_array(
  proof.cross_mode_plan(e,'ON_SITE','REUSE_EXISTING',proof.id(601)::text,'','[]'::jsonb),
  proof.cross_mode_plan(e,'REMOTE','EXTEND_MODE',proof.id(601)::text,'','[]'::jsonb)));
 PERFORM proof.require(p->>'status'='READY'
  AND p#>>'{classificationCandidates,0,categoryId}'=proof.id(601)::text
  AND p#>>'{classificationCandidates,1,categoryId}'=proof.id(601)::text,
  'REUSE_AND_EXTEND_KEEP_ONE_CATEGORY_ID');

 PERFORM proof.reset();PERFORM proof.seed_service(e);
 p:=proof.cross_mode_review(e,jsonb_build_array(
  proof.cross_mode_plan(e,'ON_SITE','REUSE_EXISTING',proof.id(601)::text,'','[]'::jsonb),
  proof.cross_mode_plan(e,'REMOTE','CREATE_CHILD','',proof.id(501)::text,jsonb_build_array(e))));
 PERFORM proof.require(proof.client_pending_contract(p)
  AND p->>'reason'='CROSS_MODE_IDENTITY_CONFLICT','EXISTING_AND_NEW_IDENTITY_CANNOT_MIX');

 PERFORM proof.require((SELECT md5(pg_get_functiondef(oid))='b2c4e3d19cd08ed50cfae32a8ed386a0'
  FROM pg_proc WHERE oid='public.rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)'::regprocedure),
  'BATCH_WRITER_UNCHANGED');
 -- The reduced fixture omits the later consent wrapper; live preflight pins it.
 IF to_regprocedure('public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)') IS NOT NULL THEN
  PERFORM proof.require((SELECT md5(pg_get_functiondef(oid))='2f70c3c29d4c5054c58844e0eb79d81c'
   FROM pg_proc WHERE oid='public.rpc_prepare_worker_ai_review_taxonomy_confirmed(uuid,integer,boolean,jsonb)'::regprocedure),
   'WORKER_CONSENT_WRAPPER_UNCHANGED');
 END IF;
 PERFORM proof.require((SELECT p.proacl::text='{postgres=X/postgres}' AND NOT p.prosecdef AND p.provolatile='s'
  AND to_jsonb(p.proconfig)='["search_path=pg_catalog, private"]'::jsonb FROM pg_proc p
  WHERE p.oid='private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'::regprocedure),
  'PROJECTION_ACL_AND_EXECUTION_METADATA_UNCHANGED');
END $test$;
ROLLBACK;
