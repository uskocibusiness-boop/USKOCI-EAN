-- Disposable PostgreSQL only: synthetic reviews, no network or DEV writes.
-- Reuse the established catalog/owner-review fixture; replace executable
-- functions with captured current DEV bodies before exercising the new case.
\ir ../dynamic-taxonomy-20261011/disposable-fixture.sql
\ir ../dynamic-taxonomy-20261011/catalog-foundation.sql
\ir ../dynamic-taxonomy-20261011/disposable-owner-admission-fixture.sql
\ir ../dynamic-taxonomy-20261011/owner-reviewed-batch-admission-v1.sql
CREATE SCHEMA proof;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
CREATE TABLE public.app_profiles(id uuid PRIMARY KEY,account_id uuid,kind text,profile_status text,skills text[],updated_at timestamptz);
ALTER TABLE public.needs ADD requester_account_id uuid,ADD revision integer,ADD status text,
 ADD category text,ADD execution_location_mode text,ADD category_id uuid;
ALTER TABLE private.ai_task_review_commands ADD need_id uuid,ADD need_revision integer;
ALTER TABLE private.worker_ai_reviews ADD conversation_id uuid,ADD revision integer;
CREATE TABLE private.worker_ai_sessions(conversation_id uuid PRIMARY KEY,account_id uuid,candidate jsonb,revision integer,base_hash text);
CREATE TABLE private.work_taxonomy_gemini_turn_hints_v1(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 purpose text,account_id uuid,conversation_id uuid,source_fingerprint text,catalog_version bigint,proposals jsonb,
 created_at timestamptz DEFAULT statement_timestamp());
CREATE TABLE private.taxonomy_confirmed_worker_modes_v1(
 worker_account_id uuid,category_id uuid,execution_scope text,source_review_id uuid,source_request_key uuid,
 confirmed_at timestamptz,active boolean,PRIMARY KEY(worker_account_id,category_id,execution_scope));
CREATE TABLE private.worker_execution_mode_choices(worker_profile_id uuid PRIMARY KEY,worker_account_id uuid,
 modes text[],consent_source text,confirmed_at timestamptz,updated_at timestamptz);
-- These source candidates provide exact table shapes; captured current function
-- definitions below replace their historical binder bodies.
\ir ../dynamic-taxonomy-20261011/owner-reviewed-worker-binder-v1.sql
\ir ../dynamic-taxonomy-20261011/owner-reviewed-need-binder-v1.sql
\ir exact-dependencies.sql
\ir before.sql
INSERT INTO private.work_taxonomy_risk_actions(normalized_action) VALUES('dresura'),('sklapanje') ON CONFLICT DO NOTHING;
CREATE FUNCTION proof.require(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$
 BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message;END IF;END $$;
CREATE FUNCTION proof.id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
CREATE TABLE proof.current_review(projection jsonb,skills jsonb,service_modes jsonb);
CREATE FUNCTION proof.reset() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 TRUNCATE private.work_taxonomy_need_bindings_v1,private.work_taxonomy_worker_bindings_v1,
  private.taxonomy_confirmed_worker_modes_v1,private.worker_execution_mode_choices,
  private.work_taxonomy_review_batches_v1,private.worker_ai_saves,private.worker_ai_reviews,
  private.ai_task_review_commands,private.ai_task_reviews,private.work_taxonomy_gemini_turn_hints_v1,
  private.worker_ai_sessions,public.app_profiles,public.needs,
  private.work_taxonomy_audit,private.work_taxonomy_aliases,private.work_taxonomy_category_modes,
  private.work_taxonomy_relations,private.work_taxonomy_worker_capabilities,
  private.work_taxonomy_need_snapshots,private.work_taxonomy_need_skills,private.work_taxonomy_categories,
  proof.current_review CASCADE;
 UPDATE private.work_taxonomy_control SET catalog_version=10,auto_registration_enabled=false;
 INSERT INTO private.work_taxonomy_categories(id,canonical_key,label,state,source,catalog_version)
 VALUES(proof.id(501),private.taxonomy_normalize_v1('Izrada osnovnih modela'),'Izrada osnovnih modela','ESTABLISHED','SYSTEM',10);
 INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
 VALUES(proof.id(501),'ON_SITE','SYNTHETIC'),(proof.id(501),'REMOTE','SYNTHETIC');
 PERFORM set_config('test.auth_uid',proof.id(1)::text,false);
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',false);
END $$;
CREATE FUNCTION proof.prepare(p_action text,p_modes text[],p_path text[],p_parent uuid DEFAULT null)
 RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE service text:=p_path[array_length(p_path,1)];skills jsonb;candidate jsonb;hint jsonb;modes jsonb;
 projection jsonb;envelope jsonb;v_version bigint;
BEGIN
 SELECT catalog_version INTO v_version FROM private.work_taxonomy_control WHERE singleton;
 skills:=jsonb_build_array(service);candidate:=jsonb_build_object('skills',skills);
 SELECT jsonb_agg(jsonb_build_object('service',service,'mode',mode)) INTO modes FROM unnest(p_modes) mode;
 SELECT jsonb_agg(jsonb_build_object('service',service,'mode',mode,'action',p_action,
  'categoryId','','parentId',coalesce(p_parent::text,''),'proposedPath',to_jsonb(p_path),
  'reason','Synthetic explicitly offered service and both owner-reviewed delivery choices.',
  'catalogVersion',v_version)) INTO hint FROM unnest(p_modes) mode;
 INSERT INTO private.worker_ai_sessions VALUES(proof.id(2),proof.id(1),candidate,1,'synthetic-base');
 INSERT INTO private.work_taxonomy_gemini_turn_hints_v1(purpose,account_id,conversation_id,source_fingerprint,catalog_version,proposals)
 VALUES('WORKER_CAPABILITY',proof.id(1),proof.id(2),encode(extensions.digest(convert_to(
  candidate::text||'|1|synthetic-base','UTF8'),'sha256'),'hex'),v_version,hint);
 projection:=private.taxonomy_review_candidate_projection_v2('WORKER_CAPABILITY',skills,modes,proof.id(1),proof.id(2));
 INSERT INTO proof.current_review VALUES(projection,skills,modes);
 envelope:=(projection-'status'-'visibleServices')||jsonb_build_object('canAccept',true,
  'classificationState',projection->>'status','profileId',proof.id(3),'profile',candidate);
 INSERT INTO private.worker_ai_reviews(id,account_id,envelope,base_hash,expires_at,conversation_id,revision)
 VALUES(proof.id(4),proof.id(1),envelope||jsonb_build_object('displayedContentDigest',encode(extensions.digest(
  (envelope||jsonb_build_object('baseHash','synthetic-base'))::text,'sha256'),'hex')),
  'synthetic-base',clock_timestamp()+interval '1 hour',proof.id(2),1);
 RETURN projection;
END $$;
CREATE FUNCTION proof.save() RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_at timestamptz:=clock_timestamp();v_skills text[];
BEGIN
 SELECT ARRAY(SELECT jsonb_array_elements_text(skills)) INTO v_skills FROM proof.current_review;
 INSERT INTO public.app_profiles VALUES(proof.id(3),proof.id(1),'WORKER','ACTIVE',v_skills,v_at);
 INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id,created_at,receipt)
 VALUES(proof.id(4),proof.id(1),proof.id(5),v_at,jsonb_build_object('saved',true,
  'profileId',proof.id(3),'profileStatus','ACTIVE'));
END $$;
CREATE FUNCTION proof.commit_batch() RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.rpc_taxonomy_commit_reviewed_batch_service(proof.id(1),proof.id(5),'WORKER_CAPABILITY',proof.id(4),
  (SELECT projection->'classificationCandidates' FROM proof.current_review)) $$;
CREATE FUNCTION proof.bind_worker() RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.rpc_taxonomy_bind_reviewed_worker_service(proof.id(1),proof.id(5),proof.id(4),proof.id(3)) $$;
CREATE FUNCTION proof.bind_need(p_service text,p_mode text,p_category uuid,p_number integer DEFAULT 10)
 RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE projection jsonb;envelope jsonb;receipt jsonb;v_at timestamptz:=clock_timestamp();
BEGIN
 projection:=private.taxonomy_review_exact_projection_v1('NEED_SERVICE',jsonb_build_array(p_service),
  jsonb_build_array(jsonb_build_object('service',p_service,'mode',p_mode)));
 PERFORM proof.require(projection->>'status'='READY','REQUESTER_REUSES_ESTABLISHED_EXACT_LEAF');
 envelope:=(projection-'status'-'visibleServices')||jsonb_build_object('canAccept',true,'classificationState','READY',
  'publicProjection',jsonb_build_array(jsonb_build_object('key','need.category','value',p_service)),
  'location',jsonb_build_object('geography',jsonb_build_object('mode',CASE p_mode WHEN 'REMOTE' THEN 'REMOTE' ELSE 'STATIONARY' END)));
 INSERT INTO private.ai_task_reviews(id,account_id,envelope,policy_binding,expires_at)
 VALUES(proof.id(p_number),proof.id(8),envelope||jsonb_build_object('displayedContentDigest',encode(extensions.digest(
  jsonb_build_object('envelope',envelope,'policy','{}'::jsonb)::text,'sha256'),'hex')),'{}',v_at+interval '1 hour');
 INSERT INTO public.needs VALUES(proof.id(p_number+100),proof.id(8),1,'DRAFT',p_service,
  CASE p_mode WHEN 'REMOTE' THEN 'REMOTE' ELSE 'STATIONARY' END,null);
 INSERT INTO private.ai_task_review_commands(review_id,account_id,client_request_id,state,created_at,need_id,need_revision)
 VALUES(proof.id(p_number),proof.id(8),proof.id(p_number+200),'ACCEPTED',v_at,proof.id(p_number+100),1);
 receipt:=public.rpc_taxonomy_commit_reviewed_batch_service(proof.id(8),proof.id(p_number+200),'NEED_SERVICE',proof.id(p_number),
  projection->'classificationCandidates');
 PERFORM proof.require(receipt#>>'{items,0,categoryId}'=p_category::text AND receipt->>'createdCount'='0',
  'REQUESTER_REUSES_SAME_UUID_WITHOUT_NEW_CATEGORY');
 RETURN public.rpc_taxonomy_bind_reviewed_need_service(proof.id(8),proof.id(p_number+200),proof.id(p_number),proof.id(p_number+100),1);
END $$;
CREATE FUNCTION proof.expect_error(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN
 BEGIN EXECUTE statement;EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual=MESSAGE_TEXT;END;
 PERFORM proof.require(actual=expected,'EXPECTED '||expected||' GOT '||coalesce(actual,'SUCCESS'));
END $$;
SELECT proof.reset();
