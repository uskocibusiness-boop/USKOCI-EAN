-- Extend isolated read fixture to execute the REAL signed worker prepare
-- candidate (not a mocked source inspection). No DEV or production connection.
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
ALTER TABLE public.app_profiles ADD COLUMN account_id uuid;
ALTER TABLE public.app_profiles ADD COLUMN kind text;
UPDATE public.app_profiles SET
 account_id='11111111-1111-4111-8111-111111111111',kind='WORKER';
ALTER TABLE private.worker_ai_turns ADD COLUMN state text DEFAULT 'SUCCEEDED';
ALTER TABLE private.worker_ai_reviews ADD COLUMN revision integer DEFAULT 2;
ALTER TABLE private.worker_ai_reviews ADD COLUMN base_hash text DEFAULT 'base-1';
ALTER TABLE private.worker_ai_reviews ADD COLUMN expires_at timestamptz
 DEFAULT clock_timestamp()+interval '20 minutes';
CREATE TABLE private.work_taxonomy_control(
 singleton boolean PRIMARY KEY,catalog_version bigint NOT NULL);
INSERT INTO private.work_taxonomy_control VALUES(true,3);
CREATE TABLE private.work_taxonomy_gemini_turn_hints_v1(
 purpose text,account_id uuid,conversation_id uuid,source_fingerprint text,
 catalog_version bigint,proposals jsonb,created_at timestamptz,id uuid);
CREATE FUNCTION private.closure_assert_open(p_account_id uuid)
 RETURNS void LANGUAGE plpgsql AS $fn$ BEGIN RETURN; END $fn$;
CREATE FUNCTION private.worker_ai_initial(p_account_id uuid)
 RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
CREATE FUNCTION private.normalize_worker_ai_availability(
 p_profile_id uuid,p_account_id uuid,p_availability jsonb)
 RETURNS void LANGUAGE plpgsql AS $fn$ BEGIN RETURN; END $fn$;
CREATE FUNCTION private.taxonomy_admission_fingerprint_v1()
 RETURNS text LANGUAGE sql STABLE AS $$SELECT repeat('c',32)$$;
-- Deterministic test projection. The production exact resolver is verified by
-- its own PG16/17 workflow. This fixture checks the real prepare RPC ordering,
-- source/owner fencing and digital signature against an isolated dependency.
CREATE FUNCTION private.taxonomy_review_exact_projection_v1(
 p_purpose text,p_services jsonb,p_service_modes jsonb)
 RETURNS jsonb LANGUAGE plpgsql STABLE AS $projection$
BEGIN
 IF p_purpose='WORKER_CAPABILITY' AND
    p_services='["Casovi matematike"]'::jsonb AND
    p_service_modes='[{"service":"Casovi matematike","mode":"REMOTE"}]'::jsonb
 THEN RETURN jsonb_build_object('status','READY',
   'classificationCandidates',jsonb_build_array(
      jsonb_build_object('action','REUSE_EXISTING','service','Casovi matematike',
        'mode','REMOTE','categoryId','33333333-3333-4333-8333-333333333333',
        'catalogVersion',3,'reason','Server exact canonical service identity')),
   'reviewedServiceModes',p_service_modes,
   'classificationCatalogVersion',3,
   'classificationCatalogFingerprint',repeat('c',32));
 END IF;
 RETURN jsonb_build_object('status','SERVICE_MODE_CONFIRMATION_REQUIRED',
 'classificationCandidates','[]'::jsonb,'reviewedServiceModes','[]'::jsonb,
 'classificationCatalogVersion',null,'classificationCatalogFingerprint',null);
END $projection$;
INSERT INTO public.ai_conversations VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '11111111-1111-4111-8111-111111111111','PROFILE','OPEN'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '11111111-1111-4111-8111-111111111111','PROFILE','OPEN');
INSERT INTO private.worker_ai_sessions VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',4,
  '{"skills":["Casovi matematike"]}'::jsonb,'ALLOW','base-1'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',6,
  '{"skills":["Casovi matematike"]}'::jsonb,'ALLOW','base-1');
INSERT INTO private.work_taxonomy_gemini_turn_hints_v1
(purpose,account_id,conversation_id,source_fingerprint,catalog_version,
 proposals,created_at,id)
SELECT 'WORKER_CAPABILITY',s.account_id,s.conversation_id,
  encode(extensions.digest(
    convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),
    'sha256'),'hex'),3,
 '[{"service":"Casovi matematike","mode":"REMOTE","action":"REUSE_EXISTING",
   "categoryId":"33333333-3333-4333-8333-333333333333"}]'::jsonb,
 statement_timestamp(),'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
 FROM private.worker_ai_sessions s
 WHERE conversation_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
