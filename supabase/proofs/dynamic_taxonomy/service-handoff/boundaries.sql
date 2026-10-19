-- Explicit upstream boundaries, NOT a replacement for production Save/auth/RLS tests.
-- These supply profile/source/location/facts inputs. Targets under test are unmodified.
CREATE FUNCTION private.worker_ai_source_hash(account uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'synthetic-base'::text $$;
CREATE FUNCTION private.worker_ai_initial(account uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT envelope->'profile' FROM private.worker_ai_reviews WHERE account_id=account ORDER BY created_at DESC LIMIT 1 $$;
CREATE FUNCTION private.closure_assert_open(account uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
CREATE FUNCTION private.validate_need_v2_fact_pre_country(k text,v jsonb) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF k NOT IN ('need.category','need.task_geography','need.title','need.description','need.people_needed','need.price_mode','need.schedule_kind')
 THEN RAISE EXCEPTION 'UNMODELED_FIXTURE_FACT'; END IF;
END $$;
CREATE FUNCTION private.require_location_country(v jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN
 IF v IS DISTINCT FROM '"RS"'::jsonb THEN RAISE EXCEPTION 'LOCATION_INPUT_INVALID'; END IF; RETURN 'RS'; END $$;
CREATE FUNCTION private.normalize_need_location(v jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$ SELECT v $$;
CREATE FUNCTION private.need_location_review_document(cid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT '{"revision":"synthetic-geography","value":{"taskCountryCode":"RS","geography":{"mode":"REMOTE"}}}'::jsonb $$;
CREATE FUNCTION private.ai_task_review_policy(country text) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION private.need_edit_base_marker(need uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'synthetic-edit-base'::text $$;
CREATE FUNCTION public.rpc_ai_need_review_v2(cid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('safety','ALLOW','facts',coalesce(jsonb_agg(jsonb_build_object(
 'id',null,'key',fact_key,'value',fact_value,'status',status,'privacyClass','PUBLIC','source','EXPLICIT_USER_ANSWER','displayValue',fact_value#>>'{}') ORDER BY fact_key),'[]'::jsonb))
 FROM public.ai_structured_facts WHERE conversation_id=cid AND superseded_at IS NULL $$;
CREATE FUNCTION proof.handoff_reset() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 PERFORM proof.reset();
 TRUNCATE public.need_requirement_details,public.need_geography,public.need_sensitive,public.ai_structured_facts,
 private.need_draft_save_commands,private.need_edit_commands,public.agreements,public.need_selections,public.marketplace_responses;
END $$;
-- Synthetic existing Save receipt. Binder/admission/context execute their real bodies.
CREATE FUNCTION proof.saved_profile_boundary() RETURNS void LANGUAGE plpgsql AS $$
DECLARE skills text[];
BEGIN
 SELECT ARRAY(SELECT jsonb_array_elements_text(r.skills)) INTO skills FROM proof.current_review r;
 INSERT INTO public.app_profiles(id,account_id,kind,profile_status,skills,updated_at)
 VALUES(proof.id(3),proof.id(1),'WORKER','ACTIVE',skills,statement_timestamp());
 UPDATE private.worker_ai_sessions SET profile_id=proof.id(3);
 INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id,created_at,receipt)
 VALUES(proof.id(4),proof.id(1),proof.id(5),statement_timestamp(),jsonb_build_object('saved',true,'authoritative',true,
 'profileId',proof.id(3),'profileStatus','ACTIVE'));
END $$;
-- Synthetic accepted DRAFT command boundary, exact projection/commit/binder run unchanged.
CREATE FUNCTION proof.need_boundary(handoff jsonb, saved_handoff jsonb, n integer DEFAULT 10) RETURNS void LANGUAGE plpgsql AS $$
DECLARE p jsonb;e jsonb;service text:='Izrada osnovnih modela';
BEGIN
 p:=private.taxonomy_review_exact_projection_v1('NEED_SERVICE',jsonb_build_array(service),
   jsonb_build_array(jsonb_build_object('service',service,'mode','REMOTE')));
 PERFORM proof.require(p->>'status'='READY','NEED_EXACT_PROJECTION_READY');
 IF handoff IS NOT NULL THEN p:=jsonb_set(p,'{classificationCandidates,0,handoff}',handoff); END IF;
 e:=(p-'status'-'visibleServices')||jsonb_build_object('canAccept',true,'classificationState','READY',
 'publicProjection',jsonb_build_array(jsonb_build_object('key','need.category','value',service))||
   CASE WHEN handoff IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('key','need.handoff','value',handoff)) END,
 'location','{"geography":{"mode":"REMOTE"}}'::jsonb);
 INSERT INTO private.ai_task_reviews(id,account_id,envelope,policy_binding,expires_at)
 VALUES(proof.id(n),proof.id(8),e||jsonb_build_object('displayedContentDigest',encode(extensions.digest(
 jsonb_build_object('envelope',e,'policy','{}'::jsonb)::text,'sha256'),'hex')),'{}',clock_timestamp()+interval '1 hour');
 INSERT INTO public.needs(id,requester_account_id,revision,status,category,execution_location_mode)
 VALUES(proof.id(n+100),proof.id(8),1,'DRAFT',service,'REMOTE');
 INSERT INTO public.need_requirement_details(need_id,handoff) VALUES(proof.id(n+100),saved_handoff);
 INSERT INTO private.ai_task_review_commands(review_id,account_id,client_request_id,state,created_at,need_id,need_revision)
 VALUES(proof.id(n),proof.id(8),proof.id(n+200),'ACCEPTED',statement_timestamp(),proof.id(n+100),1);
 PERFORM public.rpc_taxonomy_commit_reviewed_batch_service(proof.id(8),proof.id(n+200),'NEED_SERVICE',proof.id(n),p->'classificationCandidates');
END $$;
CREATE FUNCTION proof.bind_handoff_need(n integer DEFAULT 10) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.rpc_taxonomy_bind_reviewed_need_service(proof.id(8),proof.id(n+200),proof.id(n),proof.id(n+100),1) $$;
CREATE FUNCTION proof.task_input() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO public.ai_conversations(id,account_id,purpose) VALUES(proof.id(2),proof.id(1),'NEED_INTAKE');
 INSERT INTO public.app_profiles(id,account_id,kind,profile_status) VALUES(proof.id(3),proof.id(1),'REQUESTER','ACTIVE');
 INSERT INTO public.ai_structured_facts(conversation_id,fact_schema_version,status,fact_key,fact_value)
 VALUES(proof.id(2),'NEED_FACT_V2','CONFIRMED','need.category','"Izrada osnovnih modela"'),
 (proof.id(2),'NEED_FACT_V2','CONFIRMED','need.task_country_code','"RS"'),
 (proof.id(2),'NEED_FACT_V2','CONFIRMED','need.task_geography','{"mode":"REMOTE"}');
END $$;
INSERT INTO private.need_fact_registry(fact_key,schema_version,value_type,required_for_draft,privacy_class,material,target_owner)
VALUES('need.category','NEED_FACT_V2','TEXT',true,'PUBLIC',true,'synthetic'),
('need.task_country_code','NEED_FACT_V2','TEXT',true,'PUBLIC',true,'synthetic'),
('need.task_geography','NEED_FACT_V2','OBJECT',true,'PUBLIC',true,'synthetic');
