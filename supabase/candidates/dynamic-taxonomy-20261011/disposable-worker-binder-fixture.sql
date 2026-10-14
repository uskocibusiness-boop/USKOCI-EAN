-- Disposable PostgreSQL ONLY. Mirrors the *relevant* DEV worker, batch and
-- taxonomy fields. NO actual accounts, jobs or notifications.
CREATE SCHEMA private;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
CREATE FUNCTION private.taxonomy_normalize_v1(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=pg_catalog AS $fn$
 SELECT btrim(regexp_replace(
   translate(replace(replace(replace(replace(replace(replace(lower(btrim(coalesce(p_value,''))),
     'ђ','dj'),'љ','lj'),'њ','nj'),'џ','dz'),'đ','dj'),'ß','ss'),
     'абвгдежзијклмнопрстћуфхцчшčćšž',
     'abvgdezzijklmnoprstcufhccsccsz'),
   '[[:space:]]+',' ','g'))
$fn$;
CREATE TABLE public.app_profiles(
 id uuid PRIMARY KEY,account_id uuid,kind text,profile_status text,
 skills text[],updated_at timestamptz NOT NULL);
CREATE TABLE private.worker_ai_reviews(
 id uuid PRIMARY KEY,account_id uuid,envelope jsonb NOT NULL,
 base_hash text NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE private.worker_ai_saves(
 review_id uuid,account_id uuid,client_request_id uuid,created_at timestamptz,
 receipt jsonb NOT NULL);
CREATE TABLE private.work_taxonomy_review_batches_v1(
 owner_account_id uuid,request_key uuid,source_review_id uuid,purpose text,
 review_digest text,plans jsonb,catalog_version bigint,result jsonb,
 PRIMARY KEY(owner_account_id,request_key));
CREATE TABLE private.work_taxonomy_categories(
 id uuid PRIMARY KEY,canonical_key text,state text);
CREATE TABLE private.work_taxonomy_category_modes(
 category_id uuid,execution_scope text,PRIMARY KEY(category_id,execution_scope));
CREATE TABLE private.work_taxonomy_aliases(
 category_id uuid,normalized_key text);
CREATE TABLE private.work_taxonomy_worker_capabilities(
 worker_account_id uuid,category_id uuid,confirmed_at timestamptz,
 allow_related_offers boolean NOT NULL DEFAULT false,excluded boolean NOT NULL DEFAULT false,
 origin text CHECK(origin IN('WORKER_CONFIRMED','WORKER_CORRECTED')),
 updated_at timestamptz DEFAULT now(),
 PRIMARY KEY(worker_account_id,category_id));
CREATE TABLE private.taxonomy_confirmed_worker_modes_v1(
 worker_account_id uuid NOT NULL,category_id uuid NOT NULL,
 execution_scope text NOT NULL CHECK(execution_scope IN('ON_SITE','REMOTE')),
 source_review_id uuid NOT NULL,source_request_key uuid NOT NULL,
 confirmed_at timestamptz DEFAULT statement_timestamp(),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(worker_account_id,category_id,execution_scope),
 FOREIGN KEY(worker_account_id,category_id) REFERENCES
   private.work_taxonomy_worker_capabilities(worker_account_id,category_id));
CREATE TABLE private.worker_execution_mode_choices(
 worker_profile_id uuid PRIMARY KEY,worker_account_id uuid,modes text[] NOT NULL,
 consent_source text NOT NULL CHECK(consent_source='EXPLICIT_PROFILE_REVIEW'),
 confirmed_at timestamptz,updated_at timestamptz NOT NULL,
 CONSTRAINT valid_worker_execution_modes
 CHECK(modes IN(ARRAY['ON_SITE']::text[],ARRAY['REMOTE']::text[],ARRAY['ON_SITE','REMOTE']::text[])));
INSERT INTO public.app_profiles VALUES(
 '22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111111','WORKER','ACTIVE',
 ARRAY['Casovi matematike'],clock_timestamp()-interval '3 minutes');
INSERT INTO private.work_taxonomy_categories VALUES(
 '33333333-3333-4333-8333-333333333333',
 'casovi matematike','ESTABLISHED');
INSERT INTO private.work_taxonomy_category_modes VALUES
 ('33333333-3333-4333-8333-333333333333','ON_SITE'),
 ('33333333-3333-4333-8333-333333333333','REMOTE');
-- Build a signed human-review envelope using the canonical same-baseHash digest.
WITH document AS (
 SELECT jsonb_build_object(
  'schemaVersion','WORKER_PROFILE_V1',
  'reviewId','44444444-4444-4444-8444-444444444444',
  'profileId','22222222-2222-4222-8222-222222222222',
  'canAccept',true,'classificationState','READY',
  'profile',jsonb_build_object('skills',jsonb_build_array('Casovi matematike')),
  'reviewedServiceModes',jsonb_build_array(
    jsonb_build_object('service','Casovi matematike','mode','ON_SITE'),
    jsonb_build_object('service','Casovi matematike','mode','REMOTE')),
  'classificationCandidates',jsonb_build_array(
    jsonb_build_object('service','Casovi matematike','mode','ON_SITE','action','REUSE_EXISTING','categoryId','33333333-3333-4333-8333-333333333333','catalogVersion',3,'reason','Owner-reviewed exact category'),
    jsonb_build_object('service','Casovi matematike','mode','REMOTE','action','REUSE_EXISTING','categoryId','33333333-3333-4333-8333-333333333333','catalogVersion',3,'reason','Owner-reviewed exact remote category')
  )
 ) AS content
)
INSERT INTO private.worker_ai_reviews(id,account_id,envelope,base_hash,expires_at)
SELECT '44444444-4444-4444-8444-444444444444',
 '11111111-1111-4111-8111-111111111111',
 content||jsonb_build_object('displayedContentDigest',
 encode(extensions.digest((content||jsonb_build_object('baseHash','base-1'))::text,'sha256'),'hex')),
 'base-1',clock_timestamp()+interval '30 minutes'
FROM document;
INSERT INTO private.worker_ai_saves VALUES(
 '44444444-4444-4444-8444-444444444444',
 '11111111-1111-4111-8111-111111111111',
 '55555555-5555-4555-8555-555555555555',
 clock_timestamp()-interval '1 minute',
 '{"saved":true,"profileId":"22222222-2222-4222-8222-222222222222","profileStatus":"ACTIVE"}'::jsonb);
INSERT INTO private.work_taxonomy_review_batches_v1(
 owner_account_id,request_key,source_review_id,purpose,review_digest,
 plans,catalog_version,result)
SELECT '11111111-1111-4111-8111-111111111111',
 '55555555-5555-4555-8555-555555555555',
 '44444444-4444-4444-8444-444444444444',
 'WORKER_CAPABILITY',envelope->>'displayedContentDigest',
 envelope->'classificationCandidates',3,
 jsonb_build_object('status','COMMITTED','requiresBinding',true,
 'capabilityAuthority','NONE','notificationAuthority','NONE',
 'items',jsonb_build_array(
  jsonb_build_object('service','Casovi matematike','mode','ON_SITE','categoryId','33333333-3333-4333-8333-333333333333'),
  jsonb_build_object('service','Casovi matematike','mode','REMOTE','categoryId','33333333-3333-4333-8333-333333333333')))
FROM private.worker_ai_reviews;
