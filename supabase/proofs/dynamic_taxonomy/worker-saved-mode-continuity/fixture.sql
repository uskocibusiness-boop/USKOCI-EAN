-- DISPOSABLE PostgreSQL 17 only. All identities/content here are synthetic.
-- Actual captured functions: review builder (before.sql), exact resolver,
-- profile initial/source/hash, Save and binder (exact-dependencies.sql).
-- Stubs below isolate unrelated closure/location/availability infrastructure.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$f$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $f$
 SELECT jsonb_build_object('role',coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated'))
$f$;
CREATE TABLE public.app_profiles(
 id uuid PRIMARY KEY,account_id uuid,kind text,profile_status text DEFAULT 'DRAFT',
 display_name text,bio text,skills text[],tools text[],vehicles text[],licenses text[],
 team_capacity integer DEFAULT 1,city text DEFAULT 'Testograd',radius_km integer DEFAULT 15,
 operating_country_code text DEFAULT 'RS',available_now boolean DEFAULT false,
 updated_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE public.ai_conversations(id uuid PRIMARY KEY,account_id uuid,purpose text,status text,completed_at timestamptz);
CREATE TABLE private.worker_ai_sessions(conversation_id uuid PRIMARY KEY,account_id uuid,profile_id uuid,
 revision integer,candidate jsonb,safety text,base_hash text,created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE private.worker_ai_turns(turn_id uuid DEFAULT gen_random_uuid(),conversation_id uuid,state text);
CREATE TABLE private.worker_ai_reviews(id uuid PRIMARY KEY,account_id uuid,conversation_id uuid,revision integer,
 base_hash text,envelope jsonb,expires_at timestamptz,created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE private.worker_ai_saves(review_id uuid PRIMARY KEY,account_id uuid,client_request_id uuid,
 receipt jsonb,created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE private.work_taxonomy_control(singleton boolean PRIMARY KEY,catalog_version bigint);
CREATE TABLE private.work_taxonomy_categories(id uuid PRIMARY KEY,canonical_key text,label text,parent_id uuid,state text,catalog_version bigint);
CREATE TABLE private.work_taxonomy_category_modes(category_id uuid,execution_scope text,PRIMARY KEY(category_id,execution_scope));
CREATE TABLE private.work_taxonomy_aliases(category_id uuid,label text,locale text,normalized_key text);
CREATE TABLE private.work_taxonomy_gemini_turn_hints_v1(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),purpose text,account_id uuid,conversation_id uuid,
 source_fingerprint text,catalog_version bigint,proposals jsonb,created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE private.work_taxonomy_review_batches_v1(
 id uuid DEFAULT gen_random_uuid(),owner_account_id uuid,request_key uuid,purpose text,source_review_id uuid,
 review_digest text,plans_digest text,plans jsonb,catalog_version bigint,result jsonb,
 committed_at timestamptz DEFAULT clock_timestamp(),PRIMARY KEY(owner_account_id,request_key));
CREATE TABLE private.work_taxonomy_worker_bindings_v1(
 owner_account_id uuid,request_key uuid,source_review_id uuid,profile_id uuid,catalog_version bigint,result jsonb,
 bound_at timestamptz DEFAULT statement_timestamp(),PRIMARY KEY(owner_account_id,request_key));
CREATE TABLE private.taxonomy_confirmed_worker_modes_v1(
 worker_account_id uuid,category_id uuid,execution_scope text,source_review_id uuid,source_request_key uuid,
 confirmed_at timestamptz,active boolean,PRIMARY KEY(worker_account_id,category_id,execution_scope));
CREATE TABLE private.work_taxonomy_worker_capabilities(
 worker_account_id uuid,category_id uuid,confirmed_at timestamptz,allow_related_offers boolean,excluded boolean,
 origin text,updated_at timestamptz DEFAULT statement_timestamp(),PRIMARY KEY(worker_account_id,category_id));
CREATE TABLE private.worker_execution_mode_choices(
 worker_profile_id uuid PRIMARY KEY,worker_account_id uuid,modes text[],consent_source text,confirmed_at timestamptz,updated_at timestamptz);
CREATE FUNCTION private.closure_assert_open(uuid) RETURNS void LANGUAGE sql AS $f$ SELECT $f$;
CREATE FUNCTION private.normalize_worker_ai_availability(uuid,uuid,jsonb) RETURNS void LANGUAGE sql AS $f$ SELECT $f$;
CREATE FUNCTION private.worker_location_document(uuid) RETURNS jsonb LANGUAGE sql STABLE AS $f$
 SELECT jsonb_build_object('profileId',id,'accountId',account_id,'revision','location-1',
  'operatingCountryCode',operating_country_code,'city',city,'radiusKm',radius_km,'approximatePosition',null)
 FROM public.app_profiles WHERE id=$1
$f$;
CREATE FUNCTION private.worker_availability_document(uuid) RETURNS jsonb LANGUAGE sql STABLE AS $f$
 SELECT jsonb_build_object('profileId',id,'accountId',account_id,'revision','availability-1',
  'timezone','Europe/Belgrade','availableNow',available_now,'rules','[]'::jsonb,'windows','[]'::jsonb)
 FROM public.app_profiles WHERE id=$1
$f$;
CREATE FUNCTION private.worker_capacity_document(uuid) RETURNS jsonb LANGUAGE sql STABLE AS $f$
 SELECT jsonb_build_object('teamCapacity',team_capacity) FROM public.app_profiles WHERE id=$1
$f$;
CREATE FUNCTION public.rpc_save_worker_location(text,jsonb,boolean) RETURNS void LANGUAGE plpgsql AS $f$
 BEGIN RAISE EXCEPTION 'FIXTURE_UNEXPECTED_LOCATION_CHANGE'; END
$f$;
CREATE FUNCTION public.rpc_save_worker_availability(text,jsonb) RETURNS void LANGUAGE sql AS $f$ SELECT $f$;
CREATE FUNCTION public.rpc_complete_worker_profile(uuid) RETURNS void LANGUAGE sql AS $f$
 UPDATE public.app_profiles SET profile_status='ACTIVE' WHERE id=$1
$f$;
CREATE FUNCTION private.proof_profile_updated() RETURNS trigger LANGUAGE plpgsql AS $f$
 BEGIN NEW.updated_at:=clock_timestamp();RETURN NEW; END
$f$;
CREATE TRIGGER fixture_profile_updated BEFORE UPDATE ON public.app_profiles
 FOR EACH ROW EXECUTE FUNCTION private.proof_profile_updated();
\ir exact-dependencies.sql
\ir before.sql

CREATE SCHEMA proof;
CREATE FUNCTION proof.require(p_pass boolean,p_message text) RETURNS void LANGUAGE plpgsql AS $f$
 BEGIN IF p_pass IS DISTINCT FROM true THEN RAISE EXCEPTION '%',p_message;END IF;END
$f$;
CREATE FUNCTION proof.owner() RETURNS uuid LANGUAGE sql IMMUTABLE AS $f$
 SELECT '00000000-0000-4000-8000-000000000011'::uuid
$f$;
CREATE FUNCTION proof.profile() RETURNS uuid LANGUAGE sql IMMUTABLE AS $f$
 SELECT '00000000-0000-4000-8000-000000000010'::uuid
$f$;
CREATE FUNCTION proof.fresh() RETURNS uuid LANGUAGE sql IMMUTABLE AS $f$
 SELECT '00000000-0000-4000-8000-000000000020'::uuid
$f$;
CREATE FUNCTION proof.original() RETURNS uuid LANGUAGE sql IMMUTABLE AS $f$
 SELECT '00000000-0000-4000-8000-000000000030'::uuid
$f$;
CREATE FUNCTION proof.category() RETURNS uuid LANGUAGE sql IMMUTABLE AS $f$
 SELECT '00000000-0000-4000-8000-000000000002'::uuid
$f$;
CREATE FUNCTION proof.reset(p_modes text[] DEFAULT ARRAY['REMOTE']) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE
 old_conversation uuid:='00000000-0000-4000-8000-000000000021';
 request uuid:='00000000-0000-4000-8000-000000000040';
 doc jsonb;projection jsonb;selected jsonb;
 old_time timestamptz:=clock_timestamp()-interval '2 hours';
 saved_time timestamptz:=old_time+interval '5 minutes';
 bound_time timestamptz:=old_time+interval '6 minutes';
BEGIN
 TRUNCATE public.ai_conversations,private.worker_ai_sessions,private.worker_ai_turns,
  private.worker_ai_reviews,private.worker_ai_saves,private.work_taxonomy_gemini_turn_hints_v1,
  private.work_taxonomy_review_batches_v1,private.work_taxonomy_worker_bindings_v1,
  private.taxonomy_confirmed_worker_modes_v1,private.work_taxonomy_worker_capabilities,
  private.worker_execution_mode_choices,public.app_profiles,private.work_taxonomy_control,
  private.work_taxonomy_categories,private.work_taxonomy_aliases,private.work_taxonomy_category_modes;
 PERFORM set_config('request.jwt.claim.sub',proof.owner()::text,false);
 PERFORM set_config('request.jwt.claim.role','authenticated',false);
 INSERT INTO private.work_taxonomy_control VALUES(true,4);
 INSERT INTO private.work_taxonomy_categories VALUES
  ('00000000-0000-4000-8000-000000000001','digitalne usluge','Digitalne usluge',null,'ESTABLISHED',1),
  (proof.category(),'3d printovanje','3D printovanje','00000000-0000-4000-8000-000000000001','ESTABLISHED',1),
  ('00000000-0000-4000-8000-000000000003','fotografisanje','Fotografisanje',null,'ESTABLISHED',1);
 INSERT INTO private.work_taxonomy_category_modes VALUES
  (proof.category(),'REMOTE'),(proof.category(),'ON_SITE'),
  ('00000000-0000-4000-8000-000000000003','REMOTE');
 INSERT INTO private.work_taxonomy_aliases VALUES(proof.category(),'3D štampa','sr','3d stampa');
 INSERT INTO public.app_profiles(id,account_id,kind,profile_status,display_name,bio,skills,tools,vehicles,licenses,updated_at)
 VALUES(proof.profile(),proof.owner(),'WORKER','ACTIVE','Test radnik','Izrada po dogovoru',
  ARRAY['3D štampa'],ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[],saved_time-interval '1 second');
 INSERT INTO public.ai_conversations VALUES(old_conversation,proof.owner(),'PROFILE','COMPLETED',saved_time),
  (proof.fresh(),proof.owner(),'PROFILE','OPEN',null);
 INSERT INTO private.worker_ai_sessions(conversation_id,account_id,profile_id,revision,candidate,safety,base_hash)
 VALUES(old_conversation,proof.owner(),proof.profile(),4,private.worker_ai_initial(proof.owner()),'ALLOW','historical-base'),
  (proof.fresh(),proof.owner(),proof.profile(),0,private.worker_ai_initial(proof.owner()),'ALLOW',private.worker_ai_source_hash(proof.owner()));
 SELECT jsonb_agg(jsonb_build_object('service','3D štampa','mode',mode) ORDER BY mode) INTO selected FROM unnest(p_modes) mode;
 projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY','["3D štampa"]',selected);
 doc:=jsonb_build_object('schemaVersion','WORKER_PROFILE_V1','reviewId',proof.original(),'conversationId',old_conversation,
  'accountId',proof.owner(),'profileId',proof.profile(),'revision',4,'profile',private.worker_ai_initial(proof.owner()),
  'activate',true,'missingRequired','[]'::jsonb,'canAccept',true,'expiresAt',old_time+interval '15 minutes',
  'classificationState',projection->>'status','classificationCandidates',projection->'classificationCandidates',
  'reviewedServiceModes',projection->'reviewedServiceModes','classificationCatalogVersion',4,
  'classificationCatalogFingerprint',projection->'classificationCatalogFingerprint');
 doc:=doc||jsonb_build_object('displayedContentDigest',encode(extensions.digest(
  (doc||jsonb_build_object('baseHash','historical-base'))::text,'sha256'),'hex'));
 INSERT INTO private.worker_ai_reviews VALUES(proof.original(),proof.owner(),old_conversation,4,'historical-base',doc,
  old_time+interval '15 minutes',old_time);
 INSERT INTO private.worker_ai_saves VALUES(proof.original(),proof.owner(),request,
  jsonb_build_object('saved',true,'authoritative',true,'profileId',proof.profile(),'profileStatus','ACTIVE'),saved_time);
 INSERT INTO private.work_taxonomy_review_batches_v1(owner_account_id,request_key,purpose,source_review_id,
  review_digest,plans,plans_digest,catalog_version,result,committed_at)
 VALUES(proof.owner(),request,'WORKER_CAPABILITY',proof.original(),doc->>'displayedContentDigest',
  doc->'classificationCandidates','fixture-not-used',4,jsonb_build_object('status','COMMITTED','requiresBinding',true,
  'capabilityAuthority','NONE','notificationAuthority','NONE','items',doc->'classificationCandidates'),saved_time);
 INSERT INTO private.work_taxonomy_worker_bindings_v1 VALUES(proof.owner(),request,proof.original(),proof.profile(),4,
  jsonb_build_object('status','BOUND_WORKER_SERVICES','workerProfileId',proof.profile(),'serviceModeCount',cardinality(p_modes),
  'catalogVersion',4,'dispatchAuthority','NONE','notificationAuthority','NONE','relatedOfferAuthority','NONE'),bound_time);
 INSERT INTO private.work_taxonomy_worker_capabilities VALUES(proof.owner(),proof.category(),bound_time,false,false,'WORKER_CONFIRMED',bound_time);
 INSERT INTO private.taxonomy_confirmed_worker_modes_v1
 SELECT proof.owner(),proof.category(),mode,proof.original(),request,bound_time,true FROM unnest(p_modes) mode;
 INSERT INTO private.worker_execution_mode_choices VALUES(proof.profile(),proof.owner(),p_modes,'EXPLICIT_PROFILE_REVIEW',bound_time,bound_time);
END
$f$;
CREATE FUNCTION proof.review() RETURNS jsonb LANGUAGE sql AS $f$
 SELECT public.rpc_prepare_worker_ai_review_taxonomy(proof.fresh(),
  (SELECT revision FROM private.worker_ai_sessions WHERE conversation_id=proof.fresh()),true)
$f$;
CREATE FUNCTION proof.expect_pending(p_message text) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE doc jsonb;
BEGIN
 doc:=proof.review();
 PERFORM proof.require(doc->>'classificationState'<>'READY' AND doc->'reviewedServiceModes'='[]'::jsonb,p_message);
END
$f$;
SELECT proof.reset();
