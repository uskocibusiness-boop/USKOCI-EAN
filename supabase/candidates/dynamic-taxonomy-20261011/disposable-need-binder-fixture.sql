-- Disposable PG16/17 ONLY; no real users or outbound transport.
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
CREATE FUNCTION private.taxonomy_normalize_v1(v text) RETURNS text
 LANGUAGE sql IMMUTABLE AS $$
 SELECT btrim(regexp_replace(lower(coalesce(v,'')),'[[:space:]]+',' ','g'))
$$;
CREATE FUNCTION private.taxonomy_execution_scope_v1(v text) RETURNS text
 LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN v='REMOTE' THEN 'REMOTE'
   WHEN v IN ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED') THEN 'ON_SITE'
   ELSE NULL END
$$;
CREATE TABLE private.work_taxonomy_categories(
 id uuid PRIMARY KEY,canonical_key text,state text);
CREATE TABLE private.work_taxonomy_category_modes(
 category_id uuid,execution_scope text,PRIMARY KEY(category_id,execution_scope));
CREATE TABLE public.needs(
 id uuid PRIMARY KEY,requester_account_id uuid,revision integer,
 status text,category text,execution_location_mode text,category_id uuid);
CREATE TABLE private.work_taxonomy_need_snapshots(
 need_id uuid,need_revision integer,category_id uuid,catalog_version bigint,
 reviewed_by_requester boolean,source text,classification_state text,
 original_category text,
 PRIMARY KEY(need_id,need_revision),
 CONSTRAINT work_taxonomy_need_snapshots_source_check
 CHECK(source IN ('AI_PROPOSED','REQUESTER_CORRECTED','SYSTEM_MIGRATED')));
CREATE TABLE private.work_taxonomy_review_batches_v1(
 owner_account_id uuid,request_key uuid,source_review_id uuid,
 purpose text,review_digest text,plans jsonb,catalog_version bigint,
 result jsonb, PRIMARY KEY(owner_account_id,request_key));
CREATE TABLE private.ai_task_reviews(
 id uuid PRIMARY KEY,account_id uuid,envelope jsonb,policy_binding jsonb);
CREATE TABLE private.ai_task_review_commands(
 review_id uuid,account_id uuid,client_request_id uuid,
 need_id uuid,need_revision integer,state text);
INSERT INTO private.work_taxonomy_categories VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','krečenje zidova','ESTABLISHED'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','časovi klizanja','ESTABLISHED');
INSERT INTO private.work_taxonomy_category_modes VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ON_SITE'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ON_SITE');
INSERT INTO public.needs VALUES
('55555555-5555-4555-8555-555555555555',
 '11111111-1111-4111-8111-111111111111',4,'DRAFT','Krečenje zidova','STATIONARY',null);
INSERT INTO private.ai_task_review_commands VALUES
('44444444-4444-4444-8444-444444444444',
 '11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 '55555555-5555-4555-8555-555555555555',4,'ACCEPTED');
DO $fixture$
DECLARE v_plans jsonb;v_result jsonb;v_policy jsonb;
 v_review jsonb;v_digest text;
BEGIN
 v_plans:='[{"action":"REUSE_EXISTING","service":"Krečenje zidova",
  "mode":"ON_SITE","categoryId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "catalogVersion":9,"reason":"Verified exact canonical identity"}]'::jsonb;
 v_policy:='{"policy":9}'::jsonb;
 v_review:=jsonb_build_object('classificationState','READY',
    'classificationCandidates',v_plans,'classificationCatalogVersion',9,
    'classificationCatalogFingerprint',repeat('a',32),
    'publicProjection','[{"key":"need.category","value":"Krečenje zidova"}]'::jsonb);
 v_digest:=encode(extensions.digest(jsonb_build_object(
   'envelope',v_review,'policy',v_policy)::text,'sha256'),'hex');
 v_review:=v_review||jsonb_build_object('displayedContentDigest',v_digest);
 INSERT INTO private.ai_task_reviews VALUES
 ('44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',v_review,v_policy);
 v_result:=jsonb_build_object('status','COMMITTED',
   'requiresBinding',true,'capabilityAuthority','NONE',
   'notificationAuthority','NONE',
   'items',jsonb_build_array(jsonb_build_object(
     'service','Krečenje zidova','mode','ON_SITE',
     'categoryId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')));
 INSERT INTO private.work_taxonomy_review_batches_v1 VALUES
 ('11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 '44444444-4444-4444-8444-444444444444',
 'NEED_SERVICE',v_digest,v_plans,9,v_result);
END $fixture$;
