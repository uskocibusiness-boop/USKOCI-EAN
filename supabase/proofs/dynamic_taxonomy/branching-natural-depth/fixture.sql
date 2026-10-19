-- Disposable PG16/17 only. Reuse the existing reviewed-branch/binder fixture.
-- Synthetic review/Save rows model the already-tested UI command boundary;
-- capture, projection, admission, commit and binders execute their real SQL.
\ir ../../../candidates/taxonomy-new-branch-scopes-20261018/fixture.sql
\ir ../../../candidates/dynamic-taxonomy-20261011/owner-reviewed-admission-v1.sql
ALTER TABLE private.work_taxonomy_gemini_turn_hints_v1
 ADD client_request_id uuid, ADD turn_id uuid, ADD attempt_id uuid, ADD payload_digest text,
 ADD UNIQUE(purpose,account_id,turn_id);
CREATE TABLE private.worker_ai_turns(account_id uuid,conversation_id uuid,client_request_id uuid,
 turn_id uuid,attempt_id uuid,state text,source_revision integer,completion_hash text,cancelled_at timestamptz,
 PRIMARY KEY(account_id,conversation_id,client_request_id));
CREATE TABLE public.ai_conversations(id uuid PRIMARY KEY,account_id uuid,purpose text);
CREATE TABLE public.ai_messages(id uuid PRIMARY KEY,conversation_id uuid,account_id uuid,role text,sequence_no bigint);
CREATE TABLE private.ai_need_turn_commands(account_id uuid,conversation_id uuid,client_request_id uuid,
 turn_id uuid,attempt_id uuid,state text,cancelled_at timestamptz,receipt jsonb,updated_at timestamptz);
-- Source hashing is a fixture boundary; the actual capture's owner, completion,
-- receipt, message-order and processing fences execute unchanged below.
CREATE FUNCTION private.ai_task_review_source(cid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('conversationId',cid,'messages',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY sequence_no)
 FROM public.ai_messages m WHERE conversation_id=cid),'[]'::jsonb)) $$;
\ir current-dependencies.sql
\ir before.sql
CREATE OR REPLACE FUNCTION proof.reset() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 TRUNCATE private.worker_ai_turns,private.work_taxonomy_admissions_v1,
  private.ai_need_turn_commands,public.ai_messages,public.ai_conversations;
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

CREATE OR REPLACE FUNCTION proof.prepare(p_action text,p_modes text[],p_path text[],p_parent uuid DEFAULT null)
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
 INSERT INTO private.worker_ai_turns(account_id,conversation_id,client_request_id,turn_id,attempt_id,state,source_revision,completion_hash)
 VALUES(proof.id(1),proof.id(2),proof.id(41),proof.id(42),proof.id(43),'SUCCEEDED',0,repeat('a',64));
 PERFORM public.rpc_taxonomy_capture_gemini_turn_hints_service(proof.id(1),proof.id(2),proof.id(41),
   proof.id(42),proof.id(43),'WORKER_CAPABILITY',v_version,hint);
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

CREATE TABLE proof.function_before AS SELECT oid::regprocedure::text signature,md5(pg_get_functiondef(oid)) definition_md5,
 proowner,proacl,proconfig,prosecdef FROM pg_proc WHERE oid IN ('private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'::regprocedure,'private.taxonomy_risk_triage_v1(text)'::regprocedure,'rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)'::regprocedure,'rpc_taxonomy_commit_admission_service(uuid)'::regprocedure,'rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)'::regprocedure,'rpc_taxonomy_prepare_admission_service(uuid,uuid,text,uuid,jsonb)'::regprocedure);
CREATE TABLE proof.risk_rules_before AS TABLE private.work_taxonomy_risk_rules;
SELECT proof.reset();

CREATE FUNCTION proof.expect_conflict(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE message text;state text;
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS message=MESSAGE_TEXT,state=RETURNED_SQLSTATE; END;
 PERFORM proof.require(message=expected AND state='PT409','EXPECTED PT409 '||expected||' GOT '||coalesce(state,'SUCCESS')||' '||coalesce(message,''));
END $$;

CREATE FUNCTION proof.capture_payload() RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT '[{"service":"Izrada test figurica","mode":"REMOTE","action":"CREATE_NEW_BRANCH","categoryId":"","parentId":"","proposedPath":["Izrada test figurica"],"reason":"Synthetic user explicitly offers this exact remote service.","catalogVersion":10}]'::jsonb $$;
CREATE FUNCTION proof.capture(p_purpose text) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.rpc_taxonomy_capture_gemini_turn_hints_service(proof.id(1),proof.id(2),proof.id(41),
  proof.id(42),proof.id(43),p_purpose,10,proof.capture_payload()) $$;
CREATE FUNCTION proof.seed_need_completion() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO public.ai_conversations VALUES(proof.id(2),proof.id(1),'NEED_INTAKE');
 INSERT INTO public.ai_messages VALUES(proof.id(45),proof.id(2),proof.id(1),'ASSISTANT',1);
 INSERT INTO private.ai_need_turn_commands VALUES(proof.id(1),proof.id(2),proof.id(41),proof.id(42),proof.id(43),
 'SUCCEEDED',null,jsonb_build_object('assistantMessageId',proof.id(45),'authoritative',true,'schemaVersion','NEED_FACT_V2'),clock_timestamp());
END $$;
