-- Reuse existing synthetic Save/receipt fixture; all target bodies are exact live captures.
\set ON_ERROR_STOP on
\ir ../branching-natural-depth/fixture.sql
\ir before.sql
\ir current-dependencies.sql
GRANT USAGE ON SCHEMA auth,private,extensions TO service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO service_role;
GRANT EXECUTE ON FUNCTION private.taxonomy_normalize_v1(text) TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA private TO service_role;
CREATE TABLE proof.mode_before AS SELECT p.oid::regprocedure::text signature,
 md5(pg_get_functiondef(p.oid)) definition_md5,p.proowner,p.proacl,p.proconfig,p.prosecdef,p.provolatile
 FROM pg_proc p WHERE p.oid IN ('private.taxonomy_admission_fingerprint_v1()'::regprocedure,'private.taxonomy_ai_catalog_context_v1(text,integer,text)'::regprocedure,'private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)'::regprocedure,'private.taxonomy_review_exact_projection_v1(text,jsonb,jsonb)'::regprocedure,'private.taxonomy_risk_triage_v1(text)'::regprocedure,'private.taxonomy_scope_eligible_v1(uuid,uuid)'::regprocedure,'rpc_taxonomy_bind_reviewed_need_service(uuid,uuid,uuid,uuid,integer)'::regprocedure,'rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)'::regprocedure,'rpc_taxonomy_capture_gemini_turn_hints_service(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)'::regprocedure,'rpc_taxonomy_commit_admission_service(uuid)'::regprocedure,'rpc_taxonomy_commit_reviewed_batch_service(uuid,uuid,text,uuid,jsonb)'::regprocedure,'rpc_taxonomy_prepare_admission_service(uuid,uuid,text,uuid,jsonb)'::regprocedure,'rpc_taxonomy_query_catalog_service(jsonb)'::regprocedure);
CREATE FUNCTION proof.reject(statement text,message text,code text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;state text;
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual=MESSAGE_TEXT,state=RETURNED_SQLSTATE; END;
 PERFORM proof.require(actual=message AND state=code,'EXPECTED '||code||' '||message||', GOT '||coalesce(state,'SUCCESS')||' '||coalesce(actual,''));
END $$;

-- Generic current worker hint -> real projection -> synthetic signed review.
CREATE FUNCTION proof.prepare_mode(p_service text,p_mode text,p_action text,p_category uuid,
 p_handoff jsonb DEFAULT NULL,p_include_handoff boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE skills jsonb:=jsonb_build_array(p_service);modes jsonb;candidate jsonb;hint jsonb;
 projection jsonb;envelope jsonb;version bigint;
BEGIN
 SELECT catalog_version INTO version FROM private.work_taxonomy_control WHERE singleton;
 candidate:=jsonb_build_object('skills',skills);
 modes:=jsonb_build_array(jsonb_build_object('service',p_service,'mode',p_mode));
 hint:=jsonb_build_object('service',p_service,'mode',p_mode,'action',p_action,'categoryId',p_category,
  'parentId','','proposedPath','[]'::jsonb,'reason','Actual work takes place in the provider workshop; the finished object is shipped to the owner.','catalogVersion',version);
 IF p_action='CREATE_CHILD' THEN
   hint:=hint||jsonb_build_object('categoryId','','parentId',p_category,'proposedPath',jsonb_build_array(p_service));
 END IF;
 IF p_include_handoff THEN hint:=hint||jsonb_build_object('handoff',p_handoff); END IF;
 INSERT INTO private.worker_ai_sessions VALUES(proof.id(2),proof.id(1),candidate,1,'synthetic-base');
 INSERT INTO private.worker_ai_turns(account_id,conversation_id,client_request_id,turn_id,attempt_id,state,source_revision,completion_hash)
 VALUES(proof.id(1),proof.id(2),proof.id(41),proof.id(42),proof.id(43),'SUCCEEDED',0,repeat('a',64));
 PERFORM public.rpc_taxonomy_capture_gemini_turn_hints_service(proof.id(1),proof.id(2),proof.id(41),
   proof.id(42),proof.id(43),'WORKER_CAPABILITY',version,jsonb_build_array(hint));
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
CREATE FUNCTION proof.seed_service(p_label text DEFAULT 'Restauracija muzičkih kutija') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 DELETE FROM private.work_taxonomy_category_modes WHERE category_id=proof.id(501) AND execution_scope='REMOTE';
 INSERT INTO private.work_taxonomy_categories(id,canonical_key,label,parent_id,state,source,catalog_version)
 VALUES(proof.id(601),private.taxonomy_normalize_v1(p_label),p_label,proof.id(501),'ESTABLISHED','OPERATOR',10);
 INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
 VALUES(proof.id(601),'ON_SITE','SYNTHETIC');
END $$;
SELECT proof.reset();
