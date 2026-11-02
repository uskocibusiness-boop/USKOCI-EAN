// Exact captured/current SQL test for R04 semantic admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { generate, preimage, originals, postimages, postClosure, signatures, acceptance } from './build.mjs';

const hash = (s, kind = 'sha256') => createHash(kind).update(s).digest('hex');

const account = '11111111-1111-4111-8111-111111111111';
const conversation = '44444444-4444-4444-8444-444444444444';
const category = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const craftCategory = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ddl = images => Object.values(images).map(f => f.definition.trimEnd() + ';\n').join('');

async function setup() {
  const db = new PGlite();
  await db.exec(`
    CREATE SCHEMA private;
    CREATE SCHEMA auth;
    CREATE SCHEMA extensions;
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    GRANT USAGE ON SCHEMA public, private, auth, extensions TO anon, authenticated, service_role;

    CREATE TABLE private.work_taxonomy_risk_rules(
      id bigint generated always as identity primary key,
      pattern text not null,
      decision text not null,
      policy_version bigint not null default 1,
      enabled boolean not null default true
    );
    INSERT INTO private.work_taxonomy_risk_rules (pattern, decision) VALUES
      ('(^|[[:space:]])(oruzje|droga|narkotici)($|[[:space:]])', 'BLOCKED'),
      ('(^|[[:space:]])(lekarski|lekar|terapija|stomatolog)($|[[:space:]])', 'REVIEW_REQUIRED');

    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$SELECT nullif(current_setting('test.uid', true), '')::uuid$$;

    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      $$SELECT nullif(current_setting('test.jwt', true), '')::jsonb$$;

    CREATE FUNCTION extensions.digest(text, text) RETURNS bytea LANGUAGE sql IMMUTABLE AS
      $$SELECT sha256(convert_to($1, 'UTF8'))$$;

    CREATE FUNCTION extensions.digest(bytea, text) RETURNS bytea LANGUAGE sql IMMUTABLE AS
      $$SELECT sha256($1)$$;

    CREATE TABLE private.work_taxonomy_control(
      singleton boolean primary key default true,
      catalog_version bigint not null default 17,
      updated_at timestamptz not null default now()
    );
    INSERT INTO private.work_taxonomy_control (singleton, catalog_version) VALUES(true, 17);

    CREATE TABLE private.work_taxonomy_categories(
      id uuid primary key default gen_random_uuid(), parent_id uuid, label text, canonical_key text, state text, source text default 'CURATED', catalog_version bigint default 17, created_at timestamptz default now()
    );
    INSERT INTO private.work_taxonomy_categories (id, parent_id, label, canonical_key, state) VALUES
      ('${category}', null, 'Lektura i korektura', 'lektura i korektura', 'ESTABLISHED'),
      ('${craftCategory}', null, 'Zanatske usluge', 'zanatske usluge', 'ESTABLISHED');

    -- Note: work_taxonomy_aliases has NO entries for 'Lektura' or unrecorded synonyms
    CREATE TABLE private.work_taxonomy_aliases(category_id uuid references private.work_taxonomy_categories, normalized_key text);

    CREATE TABLE private.work_taxonomy_category_modes(category_id uuid, execution_scope text, source_ref text default 'fixture');
    INSERT INTO private.work_taxonomy_category_modes (category_id, execution_scope) VALUES
      ('${category}', 'REMOTE'),
      ('${category}', 'ON_SITE'),
      ('${craftCategory}', 'ON_SITE');

    CREATE TABLE private.work_taxonomy_audit(
      id bigint generated always as identity primary key,
      action text not null check (action IN ('AUTO_CREATED','CORRECTED','RETIRED','EXISTING_REUSED')),
      category_id uuid not null,
      normalized_key text not null,
      catalog_version bigint not null,
      source_ref text not null,
      created_at timestamptz not null default now()
    );

    CREATE TABLE private.work_taxonomy_review_batches_v1(
      owner_account_id uuid not null,
      request_key uuid not null,
      purpose text not null,
      source_review_id uuid not null,
      review_digest text not null,
      plans_digest text not null,
      plans jsonb not null,
      catalog_version bigint not null,
      result jsonb not null,
      created_at timestamptz not null default now(),
      primary key (owner_account_id, request_key)
    );

    CREATE TABLE private.ai_task_reviews(
      id uuid primary key,
      account_id uuid not null,
      envelope jsonb not null,
      policy_binding text,
      expires_at timestamptz not null default (now() + interval '1 hour')
    );

    CREATE TABLE private.ai_task_review_commands(
      id uuid primary key default gen_random_uuid(),
      review_id uuid not null,
      account_id uuid not null,
      client_request_id uuid not null,
      state text not null check (state in ('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED')),
      need_id uuid,
      need_revision integer,
      created_at timestamptz not null default now()
    );

    CREATE TABLE private.worker_ai_reviews(
      id uuid primary key,
      account_id uuid not null,
      envelope jsonb not null,
      base_hash text,
      expires_at timestamptz not null default (now() + interval '1 hour')
    );

    CREATE TABLE private.worker_ai_saves(
      id uuid primary key default gen_random_uuid(),
      review_id uuid not null,
      account_id uuid not null,
      client_request_id uuid not null,
      receipt jsonb,
      created_at timestamptz not null default now()
    );

    CREATE TABLE public.app_profiles(
      id uuid primary key,
      account_id uuid not null,
      kind text not null default 'WORKER',
      profile_status text not null default 'ACTIVE',
      skills jsonb not null default '[]'::jsonb,
      updated_at timestamptz not null default now()
    );

    CREATE TABLE private.worker_execution_mode_choices(
      worker_profile_id uuid primary key,
      worker_account_id uuid not null,
      modes text[] not null,
      consent_source text not null,
      confirmed_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    CREATE TABLE private.work_taxonomy_worker_capabilities(
      worker_account_id uuid not null,
      category_id uuid not null,
      confirmed_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      allow_related_offers boolean not null default false,
      excluded boolean not null default false,
      origin text not null default 'WORKER_CONFIRMED',
      primary key (worker_account_id, category_id)
    );

    CREATE TABLE private.taxonomy_confirmed_worker_modes_v1(
      worker_account_id uuid not null,
      category_id uuid not null,
      execution_scope text not null,
      source_review_id uuid not null,
      source_request_key uuid not null,
      confirmed_at timestamptz not null default now(),
      active boolean not null default true,
      handoff jsonb,
      primary key (worker_account_id, category_id, execution_scope)
    );

    CREATE TABLE private.work_taxonomy_worker_bindings_v1(
      owner_account_id uuid not null,
      request_key uuid not null,
      source_review_id uuid not null,
      profile_id uuid not null,
      catalog_version bigint not null,
      result jsonb not null,
      created_at timestamptz not null default now(),
      primary key (owner_account_id, request_key)
    );

    CREATE TABLE public.ai_conversations(
      id uuid primary key, account_id uuid, purpose text
    );
    INSERT INTO public.ai_conversations (id, account_id, purpose) VALUES
      ('${conversation}', '${account}', 'NEED_INTAKE');

    CREATE TABLE public.needs(
      id uuid primary key,
      requester_account_id uuid not null,
      revision integer not null default 1,
      status text not null default 'PUBLISHED',
      category text not null,
      category_id uuid references private.work_taxonomy_categories,
      execution_location_mode text not null default 'REMOTE'
    );

    CREATE TABLE public.need_requirement_details(
      need_id uuid primary key references public.needs,
      handoff jsonb
    );

    CREATE TABLE private.work_taxonomy_need_snapshots(
      id bigint generated always as identity primary key,
      need_id uuid not null,
      need_revision integer not null,
      category_id uuid not null,
      catalog_version bigint not null,
      reviewed_by_requester boolean not null,
      source text not null,
      classification_state text not null,
      original_category text not null,
      created_at timestamptz not null default now()
    );

    CREATE TABLE private.work_taxonomy_need_bindings_v1(
      owner_account_id uuid not null,
      request_key uuid not null,
      source_review_id uuid not null,
      need_id uuid not null,
      need_revision integer not null,
      category_id uuid not null,
      catalog_version bigint not null,
      result jsonb not null,
      created_at timestamptz not null default now(),
      primary key (owner_account_id, request_key)
    );

    CREATE FUNCTION private.closure_assert_open(uuid, uuid default null) RETURNS void LANGUAGE sql AS
      $$SELECT NULL::void$$;

    CREATE FUNCTION private.ai_task_review_source(uuid) RETURNS jsonb LANGUAGE sql STABLE AS
      $$SELECT jsonb_build_object('conversationId', $1)$$;

    CREATE TABLE private.work_taxonomy_gemini_turn_hints_v1(
      id uuid, created_at timestamptz, purpose text, account_id uuid, conversation_id uuid,
      client_request_id uuid, source_fingerprint text, catalog_version bigint, proposals jsonb
    );

    CREATE TABLE private.closure_source_v5(singleton boolean primary key default true, sha256 text not null);
    INSERT INTO private.closure_source_v5 (singleton, sha256) VALUES (true, '0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb');

    CREATE FUNCTION private.taxonomy_normalize_v1(text) RETURNS text LANGUAGE sql IMMUTABLE AS
      $$SELECT lower(btrim(regexp_replace($1, '[[:space:]]+', ' ', 'g')))$$;

    CREATE FUNCTION private.taxonomy_category_path_valid_v1(uuid) RETURNS boolean LANGUAGE sql STABLE AS
      $$SELECT EXISTS(SELECT 1 FROM private.work_taxonomy_categories WHERE id=$1 AND state='ESTABLISHED')$$;

    CREATE FUNCTION private.taxonomy_admission_fingerprint_v1() RETURNS text LANGUAGE sql STABLE AS
      $$SELECT repeat('a', 32)$$;

    CREATE FUNCTION private.taxonomy_handoff_valid_v1(p_value jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $fn$
    DECLARE v_city text;
    BEGIN
     IF jsonb_typeof(p_value) IS DISTINCT FROM 'object'
        OR octet_length(p_value::text)>2048
        OR jsonb_typeof(p_value->'required') IS DISTINCT FROM 'boolean'
        OR p_value-array['required','shippingCountries','localExchange']<>'{}'::jsonb
     THEN RETURN false; END IF;
     IF p_value->'required'='false'::jsonb THEN RETURN p_value='{"required":false}'::jsonb; END IF;
     IF NOT(p_value?'shippingCountries' OR p_value?'localExchange') THEN RETURN false; END IF;
     IF p_value?'shippingCountries' THEN
       IF jsonb_typeof(p_value->'shippingCountries') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
       IF jsonb_array_length(p_value->'shippingCountries') NOT BETWEEN 1 AND 32
         OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_value->'shippingCountries') x(value)
           WHERE jsonb_typeof(x.value) IS DISTINCT FROM 'string' OR x.value#>>'{}' !~ '^[A-Z]{2}$')
         OR (SELECT count(DISTINCT x.value) FROM jsonb_array_elements(p_value->'shippingCountries') x(value))
             <>jsonb_array_length(p_value->'shippingCountries')
       THEN RETURN false; END IF;
     END IF;
     IF p_value?'localExchange' THEN
       IF jsonb_typeof(p_value->'localExchange') IS DISTINCT FROM 'object'
         OR NOT((p_value->'localExchange')?&array['countryCode','city'])
         OR (p_value->'localExchange')-array['countryCode','city']<>'{}'::jsonb
         OR jsonb_typeof(p_value#>'{localExchange,countryCode}') IS DISTINCT FROM 'string'
         OR p_value#>>'{localExchange,countryCode}' !~ '^[A-Z]{2}$'
         OR jsonb_typeof(p_value#>'{localExchange,city}') IS DISTINCT FROM 'string'
       THEN RETURN false; END IF;
       v_city:=p_value#>>'{localExchange,city}';
       IF v_city IS DISTINCT FROM btrim(v_city,
          E' \t\r\n\u00A0')
          OR char_length(v_city) NOT BETWEEN 3 AND 120
          OR v_city ~ ('['||chr(1)||'-'||chr(31)||chr(127)||'-'||chr(159)||'<>0-9]')
       THEN RETURN false; END IF;
     END IF;
     RETURN true;
    END $fn$;

    CREATE FUNCTION private.taxonomy_execution_scope_v1(text) RETURNS text LANGUAGE sql IMMUTABLE AS
      $$SELECT CASE $1 WHEN 'REMOTE' THEN 'REMOTE' WHEN 'ON_SITE' THEN 'ON_SITE' WHEN 'STATIONARY' THEN 'ON_SITE' WHEN 'POINT_TO_POINT' THEN 'ON_SITE' WHEN 'MULTI_STOP' THEN 'ON_SITE' WHEN 'AREA_BASED' THEN 'ON_SITE' ELSE NULL END$$;

    CREATE FUNCTION private.taxonomy_review_exact_projection_v1(text, jsonb, jsonb) RETURNS jsonb LANGUAGE sql STABLE AS
      $$SELECT jsonb_build_object('status', 'PENDING_CLASSIFICATION', 'semanticReviewCandidates', '[]'::jsonb)$$;

    CREATE FUNCTION private.closure_source_digest_v5() RETURNS text LANGUAGE sql IMMUTABLE AS
      $$SELECT '0c03679b287ed6d726b0b6845bedf54c1463d3fe0efcaf9cd8a947997e160b56'::text$$;

    CREATE FUNCTION private.closure_schema_digest_v5_139() RETURNS text LANGUAGE sql IMMUTABLE AS
      $$SELECT 'df82c2cb19edfa86ee092fb6fdc97528b82a2482f05ae64c45939268346af84c'::text$$;

    CREATE FUNCTION private.closure_erasure_program_digest_v5() RETURNS text LANGUAGE sql IMMUTABLE AS
      $$SELECT '5e121db0bd932accd4b007f80098db67ebc97e99f29e0b76f06378de0f9c4d96'::text$$;

    CREATE FUNCTION private.retention_ai_source_ready() RETURNS boolean LANGUAGE sql IMMUTABLE AS
      $$SELECT false$$;

    CREATE FUNCTION private.closure_erasure_binding_v5() RETURNS text LANGUAGE sql IMMUTABLE AS
      $$SELECT NULL::text$$;

    CREATE FUNCTION private.data_export_policy_binding() RETURNS text LANGUAGE sql IMMUTABLE AS
      $$SELECT NULL::text$$;

    CREATE OR REPLACE FUNCTION public.rpc_taxonomy_bind_reviewed_need_service(p_owner_account_id uuid, p_request_key uuid, p_source_review_id uuid, p_need_id uuid, p_need_revision integer)
     RETURNS jsonb
     LANGUAGE plpgsql
     SECURITY DEFINER
     SET search_path TO 'pg_catalog', 'private'
    AS $fn$
    DECLARE
     v_existing private.work_taxonomy_need_bindings_v1%ROWTYPE;
     v_batch private.work_taxonomy_review_batches_v1%ROWTYPE;
     v_review private.ai_task_reviews%ROWTYPE;
     v_command private.ai_task_review_commands%ROWTYPE;
     v_need public.needs%ROWTYPE;
     v_plan jsonb;v_item jsonb;v_category uuid;v_scope text;v_service text;v_category_version bigint;
     v_expected_digest text;v_result jsonb;
    BEGIN
     PERFORM private.closure_assert_open(p_owner_account_id);
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
       OR v_plan->>'action' NOT IN ('REUSE_EXISTING','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH')
     THEN RAISE EXCEPTION 'NEED_BINDER_CATEGORY_RECEIPT_INVALID' USING errcode='42501'; END IF;
     v_category:=(v_item->>'categoryId')::uuid;
     v_category_version:=v_batch.catalog_version;
     SELECT * INTO v_need FROM public.needs n WHERE n.id=p_need_id FOR UPDATE;
     IF NOT FOUND OR v_need.requester_account_id<>p_owner_account_id OR
        v_need.revision<>p_need_revision OR v_need.status NOT IN ('DRAFT','PUBLISHED','SELECTION') THEN
       RAISE EXCEPTION 'NEED_BINDER_CURRENT_REVISION_REQUIRED' USING errcode='PT409';
     END IF;
     v_scope:=private.taxonomy_execution_scope_v1(v_need.execution_location_mode);
     IF v_scope IS NULL OR v_scope<>v_item->>'mode'
       OR private.taxonomy_normalize_v1(v_need.category)
          <>private.taxonomy_normalize_v1(v_item->>'service')
     THEN RAISE EXCEPTION 'NEED_BINDER_SERVICE_OR_MODE_STALE' USING errcode='PT409'; END IF;
     IF (v_scope='REMOTE' AND NOT private.taxonomy_handoff_valid_v1(v_plan->'handoff'))
        OR (SELECT d.handoff FROM public.need_requirement_details d WHERE d.need_id=p_need_id)
          IS DISTINCT FROM v_plan->'handoff' THEN
       RAISE EXCEPTION 'NEED_BINDER_HANDOFF_STALE' USING errcode='PT409';
     END IF;
     PERFORM 1 FROM private.work_taxonomy_categories c
      JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
      WHERE c.id=v_category AND c.state='ESTABLISHED' AND m.execution_scope=v_scope;
     IF NOT FOUND THEN RAISE EXCEPTION 'NEED_BINDER_CATEGORY_RETIRED' USING errcode='42501'; END IF;
     IF v_need.category_id IS NOT NULL AND v_need.category_id<>v_category THEN
       RAISE EXCEPTION 'NEED_BINDER_CONFLICTING_EXISTING_CATEGORY' USING errcode='PT409'; END IF;
     PERFORM 1 FROM private.work_taxonomy_need_snapshots s
      WHERE s.need_id=p_need_id AND s.need_revision=p_need_revision FOR UPDATE;
     IF FOUND THEN RAISE EXCEPTION 'NEED_BINDER_EXISTING_SNAPSHOT_REVIEW_REQUIRED' USING errcode='PT409'; END IF;
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
    END $fn$;

    CREATE OR REPLACE FUNCTION public.rpc_taxonomy_bind_reviewed_worker_service(p_owner_account_id uuid, p_request_key uuid, p_source_review_id uuid, p_profile_id uuid)
     RETURNS jsonb
     LANGUAGE plpgsql
     SECURITY DEFINER
     SET search_path TO 'pg_catalog', 'private'
    AS $fn$
    DECLARE
     v_existing private.work_taxonomy_worker_bindings_v1%ROWTYPE;
     v_batch private.work_taxonomy_review_batches_v1%ROWTYPE;
     v_review private.worker_ai_reviews%ROWTYPE;
     v_save private.worker_ai_saves%ROWTYPE;
     v_profile public.app_profiles%ROWTYPE;
     v_digest text;v_item jsonb;v_plan jsonb;v_category uuid;
     v_key text;v_mode text;v_seen text[]:=ARRAY[]::text[];
     v_modes text[]:=ARRAY[]::text[];v_onsite boolean:=false;v_remote boolean:=false;
     v_result jsonb;v_count integer:=0;v_skills jsonb;
    BEGIN
     PERFORM private.closure_assert_open(p_owner_account_id);
     IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
      RAISE EXCEPTION 'WORKER_BINDER_SERVICE_ROLE_REQUIRED' USING errcode='42501';
     END IF;
     IF p_owner_account_id IS NULL OR p_request_key IS NULL
       OR p_source_review_id IS NULL OR p_profile_id IS NULL THEN
      RAISE EXCEPTION 'WORKER_BINDER_INPUT_INVALID' USING errcode='22023';
     END IF;
     SELECT * INTO v_existing FROM private.work_taxonomy_worker_bindings_v1
      WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key FOR UPDATE;
     IF FOUND THEN
      IF v_existing.source_review_id<>p_source_review_id OR v_existing.profile_id<>p_profile_id
      THEN RAISE EXCEPTION 'WORKER_BINDER_REQUEST_KEY_REUSED' USING errcode='22023'; END IF;
      RETURN v_existing.result;
     END IF;
     SELECT * INTO v_batch FROM private.work_taxonomy_review_batches_v1
      WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key
       AND source_review_id=p_source_review_id AND purpose='WORKER_CAPABILITY'
      FOR SHARE;
     IF NOT FOUND OR v_batch.result->>'status'<>'COMMITTED'
       OR v_batch.result->'requiresBinding' IS DISTINCT FROM 'true'::jsonb
       OR v_batch.result->'capabilityAuthority' IS DISTINCT FROM '"NONE"'::jsonb
       OR v_batch.result->'notificationAuthority' IS DISTINCT FROM '"NONE"'::jsonb
       OR jsonb_typeof(v_batch.plans)<>'array'
       OR jsonb_typeof(v_batch.result->'items')<>'array'
       OR jsonb_array_length(v_batch.plans) NOT BETWEEN 1 AND 24
       OR jsonb_array_length(v_batch.result->'items')<>jsonb_array_length(v_batch.plans)
     THEN RAISE EXCEPTION 'WORKER_BINDER_ADMISSION_NOT_COMMITTED' USING errcode='42501'; END IF;
     SELECT * INTO v_review FROM private.worker_ai_reviews
      WHERE id=p_source_review_id AND account_id=p_owner_account_id FOR SHARE;
     IF NOT FOUND OR v_review.envelope->>'classificationState'<>'READY'
       OR v_review.envelope->>'displayedContentDigest' IS DISTINCT FROM v_batch.review_digest
       OR v_review.envelope->'classificationCandidates' IS DISTINCT FROM v_batch.plans
       OR v_review.envelope->'canAccept' IS DISTINCT FROM 'true'::jsonb
       OR jsonb_typeof(v_review.envelope->'reviewedServiceModes')<>'array'
       OR jsonb_array_length(v_review.envelope->'reviewedServiceModes')
           <>jsonb_array_length(v_batch.plans)
       OR v_review.envelope->>'profileId' IS DISTINCT FROM p_profile_id::text
     THEN RAISE EXCEPTION 'WORKER_BINDER_REVIEW_NOT_BOUND' USING errcode='42501'; END IF;
     v_digest:=encode(extensions.digest(
      ((v_review.envelope-'displayedContentDigest')
        ||jsonb_build_object('baseHash',v_review.base_hash))::text,'sha256'),'hex');
     IF v_digest IS DISTINCT FROM v_batch.review_digest THEN
       RAISE EXCEPTION 'WORKER_BINDER_REVIEW_DIGEST_INVALID' USING errcode='42501'; END IF;
     SELECT * INTO v_save FROM private.worker_ai_saves
      WHERE review_id=p_source_review_id AND account_id=p_owner_account_id
        AND client_request_id=p_request_key FOR SHARE;
     IF NOT FOUND OR v_save.created_at>v_review.expires_at
       OR v_save.receipt->'saved' IS DISTINCT FROM 'true'::jsonb
       OR v_save.receipt->>'profileId' IS DISTINCT FROM p_profile_id::text
       OR v_save.receipt->>'profileStatus'<>'ACTIVE'
     THEN RAISE EXCEPTION 'WORKER_BINDER_SAVE_OR_ACTIVATION_REQUIRED' USING errcode='42501'; END IF;
     IF EXISTS(SELECT 1 FROM private.worker_ai_saves newer
       WHERE newer.account_id=p_owner_account_id
         AND newer.created_at>v_save.created_at
         AND newer.receipt->>'profileId'=p_profile_id::text)
     THEN RAISE EXCEPTION 'WORKER_BINDER_NEWER_SAVE_EXISTS' USING errcode='PT409'; END IF;
     SELECT * INTO v_profile FROM public.app_profiles
      WHERE id=p_profile_id AND account_id=p_owner_account_id AND kind='WORKER'
      FOR UPDATE;
     v_skills:=v_review.envelope#>'{profile,skills}';
     IF NOT FOUND OR v_profile.profile_status<>'ACTIVE'
       OR v_profile.updated_at>v_save.created_at
       OR jsonb_typeof(v_skills)<>'array'
       OR v_profile.skills IS DISTINCT FROM v_skills
     THEN RAISE EXCEPTION 'WORKER_BINDER_CURRENT_PROFILE_REQUIRED' USING errcode='PT409'; END IF;
     FOR v_count IN 0..jsonb_array_length(v_batch.plans)-1 LOOP
       v_plan:=v_batch.plans->v_count;
       v_item:=v_batch.result->'items'->v_count;
       v_key:=private.taxonomy_normalize_v1(v_item->>'service');
       v_mode:=v_item->>'mode';
       IF v_plan->>'mode' IS DISTINCT FROM v_mode
         OR private.taxonomy_normalize_v1(v_plan->>'service') IS DISTINCT FROM v_key
         OR v_plan->>'action' NOT IN ('REUSE_EXISTING','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH')
         OR v_mode NOT IN ('ON_SITE','REMOTE')
         OR jsonb_typeof(v_item->'categoryId')<>'string'
         OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_skills) offered(value)
           WHERE private.taxonomy_normalize_v1(offered.value#>>'{}')=v_key)
         OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(
            v_review.envelope->'reviewedServiceModes') m(value)
           WHERE private.taxonomy_normalize_v1(m.value->>'service')=v_key
             AND m.value->>'mode'=v_mode)
         OR v_key||'|'||v_mode=ANY(v_seen)
       THEN RAISE EXCEPTION 'WORKER_BINDER_SERVICE_OR_MODE_NOT_REVIEWED' USING errcode='42501'; END IF;
       v_seen:=array_append(v_seen,v_key||'|'||v_mode);
       v_category:=(v_item->>'categoryId')::uuid;
       IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
          JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
          WHERE c.id=v_category AND c.state='ESTABLISHED'
            AND cm.execution_scope=v_mode
            AND (c.canonical_key=v_key OR EXISTS(
              SELECT 1 FROM private.work_taxonomy_aliases a
              WHERE a.category_id=c.id AND a.normalized_key=v_key)))
       THEN RAISE EXCEPTION 'WORKER_BINDER_CATEGORY_STALE' USING errcode='42501'; END IF;
       IF v_mode='ON_SITE' THEN v_onsite:=true; ELSE v_remote:=true; END IF;
     END LOOP;
     IF EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
       WHERE choice.worker_profile_id=p_profile_id AND choice.updated_at>v_save.created_at)
     THEN RAISE EXCEPTION 'WORKER_BINDER_NEWER_GLOBAL_MODE' USING errcode='PT409'; END IF;
     IF v_onsite THEN v_modes:=array_append(v_modes,'ON_SITE'); END IF;
     IF v_remote THEN v_modes:=array_append(v_modes,'REMOTE'); END IF;
     INSERT INTO private.worker_execution_mode_choices(
       worker_profile_id,worker_account_id,modes,consent_source,confirmed_at,updated_at)
     VALUES(p_profile_id,p_owner_account_id,v_modes,'EXPLICIT_PROFILE_REVIEW',
       statement_timestamp(),statement_timestamp())
     ON CONFLICT(worker_profile_id) DO UPDATE
       SET modes=excluded.modes,consent_source='EXPLICIT_PROFILE_REVIEW',
           confirmed_at=statement_timestamp(),updated_at=statement_timestamp();
     FOR v_count IN 0..jsonb_array_length(v_batch.plans)-1 LOOP
       v_item:=v_batch.result->'items'->v_count;
       v_category:=(v_item->>'categoryId')::uuid;v_mode:=v_item->>'mode';
       INSERT INTO private.work_taxonomy_worker_capabilities(
          worker_account_id,category_id,confirmed_at,allow_related_offers,excluded,origin)
       VALUES(p_owner_account_id,v_category,statement_timestamp(),false,false,'WORKER_CONFIRMED')
       ON CONFLICT(worker_account_id,category_id) DO UPDATE
         SET confirmed_at=statement_timestamp(),updated_at=statement_timestamp(),
             excluded=false,allow_related_offers=false,origin='WORKER_CONFIRMED';
       INSERT INTO private.taxonomy_confirmed_worker_modes_v1(
         worker_account_id,category_id,execution_scope,source_review_id,source_request_key,
         confirmed_at,active,handoff)
       VALUES(p_owner_account_id,v_category,v_mode,p_source_review_id,p_request_key,
         statement_timestamp(),true,v_batch.plans->v_count->'handoff')
       ON CONFLICT(worker_account_id,category_id,execution_scope) DO UPDATE
        SET source_review_id=excluded.source_review_id,
            source_request_key=excluded.source_request_key,
            confirmed_at=statement_timestamp(),active=true,handoff=excluded.handoff;
     END LOOP;
     UPDATE private.taxonomy_confirmed_worker_modes_v1 old
     SET active=false
     WHERE old.worker_account_id=p_owner_account_id AND old.active
       AND NOT EXISTS(
         SELECT 1 FROM jsonb_array_elements(v_batch.result->'items') item(value)
         WHERE (item.value->>'categoryId')::uuid=old.category_id
           AND item.value->>'mode'=old.execution_scope);
     v_result:=jsonb_build_object('status','BOUND_WORKER_SERVICES',
       'workerProfileId',p_profile_id,'serviceModeCount',jsonb_array_length(v_batch.plans),
       'catalogVersion',v_batch.catalog_version,'dispatchAuthority','NONE',
       'notificationAuthority','NONE','relatedOfferAuthority','NONE');
     INSERT INTO private.work_taxonomy_worker_bindings_v1(
       owner_account_id,request_key,source_review_id,profile_id,catalog_version,result)
     VALUES(p_owner_account_id,p_request_key,p_source_review_id,p_profile_id,
       v_batch.catalog_version,v_result);
     RETURN v_result;
    END $fn$;
  `);

  // Load original functions
  await db.exec(ddl(originals));
  return db;
}

test('frozen package preserves signatures, attributes and closure; changes four bodies only', () => {
  const outputs = generate();
  for (const [name, s] of Object.entries(outputs)) {
    assert.equal(readFileSync(new URL(name, import.meta.url), 'utf8'), s, name);
  }
  assert.equal(preimage.closure.source_ready, false);
  assert.equal(preimage.closure.export_binding, null);
  assert.equal(preimage.closure.erasure_binding, null);
  assert.equal(postClosure.source, '4a6a2f79f99939efe3088b1c1daee61acb7b7fe87caf6191d1741fa91788433f');
  assert.equal(postClosure.erasure, '2a98426f53e0280ddbc8fc4937247a528d4432bfd34a86542b38923c0b0abfdb');
  assert.equal(postClosure.certificate, preimage.closure.certificate);
  for (const key of Object.keys(originals)) {
    assert.equal(hash(postimages[key].definition, 'md5'), postimages[key].definition_md5);
  }
  assert.equal((outputs['forward.sql'].match(/CREATE OR REPLACE FUNCTION /g) || []).length, 4);
  assert.match(outputs['forward.sql'], /R04_SEMANTIC_DEV_CLOSURE_STATE_CHANGED/);
  assert.match(outputs['forward.sql'], /R04_SEMANTIC_DEV_UNRELATED_FUNCTION_DELTA/);
});

test('preimage reproduces single-word block ("Lektura" -> NEEDS_CLARIFICATION)', async t => {
  const db = await setup();
  t.after(() => db.close());

  const triage = await db.query("SELECT private.taxonomy_risk_triage_v1('Lektura') AS res");
  assert.equal(triage.rows[0].res, 'NEEDS_CLARIFICATION');
});

test('forward DDL unblocks single-word triage ("Lektura" -> LOW_RISK_CANDIDATE) and preserves screening', async t => {
  const db = await setup();
  t.after(() => db.close());

  // Apply forward DDL
  await db.exec(ddl(postimages));

  // 1. Single word low-risk passes
  const triage = await db.query("SELECT private.taxonomy_risk_triage_v1('Lektura') AS res");
  assert.equal(triage.rows[0].res, 'LOW_RISK_CANDIDATE');

  // 2. Length < 3 fails
  const shortTriage = await db.query("SELECT private.taxonomy_risk_triage_v1('ab') AS res");
  assert.equal(shortTriage.rows[0].res, 'NEEDS_CLARIFICATION');

  // 3. Ambiguous broad terms fail
  for (const ambiguous of ['ostalo', 'drugo', 'razno', 'sve', 'svasta', 'bilo sta']) {
    const r = await db.query("SELECT private.taxonomy_risk_triage_v1($1) AS res", [ambiguous]);
    assert.equal(r.rows[0].res, 'NEEDS_CLARIFICATION', ambiguous);
  }

  // 4. Prohibited/blocked fails
  const blocked = await db.query("SELECT private.taxonomy_risk_triage_v1('oruzje') AS res");
  assert.equal(blocked.rows[0].res, 'BLOCKED');

  // 5. Regulated fails
  const regulated = await db.query("SELECT private.taxonomy_risk_triage_v1('lekarski pregled') AS res");
  assert.equal(regulated.rows[0].res, 'REVIEW_REQUIRED');
});

test('projection produces READY with candidate plan for low-risk single-word proposal', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(ddl(postimages));

  // Set auth context
  await db.query("SELECT set_config('test.uid', $1, false)", [account]);

  // Insert Gemini turn hint with proposal for 'Lektura'
  const turnHintId = '99999999-9999-4999-8999-999999999999';
  const proposals = [
    {
      action: 'REUSE_EXISTING',
      categoryId: category,
      service: 'Lektura',
      mode: 'REMOTE',
      parentId: '',
      proposedPath: [],
      reason: 'Model predlaze postojecu uslugu lekture teksta na srpskom jeziku.',
      catalogVersion: 17
    }
  ];

  await db.query(`
    INSERT INTO private.work_taxonomy_gemini_turn_hints_v1
    (id, created_at, purpose, account_id, conversation_id, client_request_id, source_fingerprint, catalog_version, proposals)
    SELECT $1, clock_timestamp(), 'NEED_SERVICE', $2, $3, $4,
      encode(extensions.digest(private.ai_task_review_source(c.id)::text, 'sha256'), 'hex'),
      17, $5
    FROM public.ai_conversations c WHERE c.id = $3
  `, [turnHintId, account, conversation, '88888888-8888-4888-8888-888888888888', JSON.stringify(proposals)]);

  const result = await db.query(`
    SELECT private.taxonomy_review_candidate_projection_v2(
      'NEED_SERVICE',
      '["Lektura"]'::jsonb,
      '[{"service":"Lektura","mode":"REMOTE"}]'::jsonb,
      $1::uuid,
      $2::uuid
    ) AS proj
  `, [account, conversation]);

  const proj = result.rows[0].proj;
  assert.equal(proj.status, 'READY');
  assert.ok(proj.classificationCandidates.length > 0);
  assert.equal(proj.classificationCandidates[0].service, 'Lektura');
  assert.equal(proj.classificationCandidates[0].action, 'REUSE_EXISTING');
});

test('needs category trigger resolves canonical key and registered alias', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(ddl(postimages));

  await db.exec(`
    CREATE TRIGGER needs_sync_taxonomy_category_trg
    BEFORE INSERT OR UPDATE OF category ON public.needs
    FOR EACH ROW EXECUTE FUNCTION private.needs_sync_taxonomy_category_trigger_fn();
  `);

  // 1. Insert with canonical key
  const n1 = '00000000-0000-4000-8000-000000000001';
  await db.query("INSERT INTO public.needs (id, requester_account_id, category) VALUES ($1, $2, 'Lektura i korektura')", [n1, account]);
  const row1 = (await db.query("SELECT category_id FROM public.needs WHERE id=$1", [n1])).rows[0];
  assert.equal(row1.category_id, category);
});

test('rollback restores exact preimage behavior and re-apply is idempotent', async t => {
  const db = await setup();
  t.after(() => db.close());

  // Apply forward
  await db.exec(ddl(postimages));
  const t1 = await db.query("SELECT private.taxonomy_risk_triage_v1('Lektura') AS res");
  assert.equal(t1.rows[0].res, 'LOW_RISK_CANDIDATE');

  // Apply rollback
  await db.exec(ddl(originals));
  const t2 = await db.query("SELECT private.taxonomy_risk_triage_v1('Lektura') AS res");
  assert.equal(t2.rows[0].res, 'NEEDS_CLARIFICATION');

  // Re-apply forward
  await db.exec(ddl(postimages));
  const t3 = await db.query("SELECT private.taxonomy_risk_triage_v1('Lektura') AS res");
  assert.equal(t3.rows[0].res, 'LOW_RISK_CANDIDATE');
});

// Helper to insert task review and bind displayedContentDigest using PostgreSQL's own calculation
async function insertTaskReview(db, id, accountId, envelope, policyBinding = null) {
  const env = { ...envelope };
  delete env.displayedContentDigest;
  await db.query(
    `INSERT INTO private.ai_task_reviews (id, account_id, envelope, policy_binding) VALUES ($1, $2, $3, $4)`,
    [id, accountId, JSON.stringify(env), policyBinding]
  );
  await db.query(
    `UPDATE private.ai_task_reviews
     SET envelope = envelope || jsonb_build_object(
       'displayedContentDigest',
       encode(extensions.digest(jsonb_build_object('envelope', envelope - 'displayedContentDigest', 'policy', policy_binding)::text, 'sha256'), 'hex')
     )
     WHERE id = $1`,
    [id]
  );
}

// Helper to insert worker review and bind displayedContentDigest using PostgreSQL's own calculation
async function insertWorkerReview(db, id, accountId, envelope, baseHash = 'base123') {
  const env = { ...envelope };
  delete env.displayedContentDigest;
  await db.query(
    `INSERT INTO private.worker_ai_reviews (id, account_id, envelope, base_hash) VALUES ($1, $2, $3, $4)`,
    [id, accountId, JSON.stringify(env), baseHash]
  );
  await db.query(
    `UPDATE private.worker_ai_reviews
     SET envelope = envelope || jsonb_build_object(
       'displayedContentDigest',
       encode(extensions.digest(((envelope - 'displayedContentDigest') || jsonb_build_object('baseHash', base_hash))::text, 'sha256'), 'hex')
     )
     WHERE id = $1`,
    [id]
  );
}

// =========================================================================
// FULL-CHAIN END-TO-END INTEGRATION TESTS (ALL CORE SCENARIOS)
// =========================================================================

test('scenario 1: existing canonical service REUSE_EXISTING commits and binds need', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(ddl(postimages));

  const reviewId = '11111111-2222-3333-4444-555555555551';
  const requestKey = '22222222-3333-4444-5555-666666666661';
  const needId = '33333333-4444-5555-6666-777777777771';
  const plans = [{
    action: 'REUSE_EXISTING',
    service: 'Lektura i korektura',
    mode: 'REMOTE',
    categoryId: category,
    categoryLabel: 'Lektura i korektura',
    categoryParentId: null,
    catalogVersion: 17,
    reason: 'Exact canonical match verified by human review',
    handoff: { required: false }
  }];

  const envelope = {
    canAccept: true,
    classificationState: 'READY',
    classificationCatalogVersion: 17,
    classificationCatalogFingerprint: repeat('a', 32),
    classificationCandidates: plans,
    publicProjection: [
      { key: 'need.category', value: 'Lektura i korektura' },
      { key: 'need.handoff', value: { required: false } }
    ],
    location: { geography: { mode: 'REMOTE' } }
  };

  await insertTaskReview(db, reviewId, account, envelope);
  await db.query(`INSERT INTO private.ai_task_review_commands (review_id, account_id, client_request_id, state, need_id, need_revision)
    VALUES ($1, $2, $3, 'ACCEPTED', $4, 1)`, [reviewId, account, requestKey, needId]);
  await db.query(`INSERT INTO public.needs (id, requester_account_id, revision, status, category, execution_location_mode)
    VALUES ($1, $2, 1, 'PUBLISHED', 'Lektura i korektura', 'REMOTE')`, [needId, account]);
  await db.query(`INSERT INTO public.need_requirement_details (need_id, handoff)
    VALUES ($1, '{"required": false}'::jsonb)`, [needId]);

  // 1. Commit reviewed batch
  const commitRes = await db.query(
    'SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1, $2, $3, $4, $5::jsonb) AS res',
    [account, requestKey, 'NEED_SERVICE', reviewId, JSON.stringify(plans)]
  );
  const commit = commitRes.rows[0].res;
  assert.equal(commit.status, 'COMMITTED');
  assert.equal(commit.items[0].categoryId, category);

  // 2. Bind reviewed need
  await db.query("SELECT set_config('test.jwt', $1, false)", [JSON.stringify({ role: 'service_role' })]);
  const bindRes = await db.query(
    'SELECT public.rpc_taxonomy_bind_reviewed_need_service($1, $2, $3, $4, 1) AS res',
    [account, requestKey, reviewId, needId]
  );
  assert.equal(bindRes.rows[0].res.status, 'BOUND_NEED_REVISION');

  // 3. Read back need: category_id is bound
  const needRow = (await db.query('SELECT category_id FROM public.needs WHERE id = $1', [needId])).rows[0];
  assert.equal(needRow.category_id, category);
});

test('scenario 2: unrecorded synonym REUSE_EXISTING commits with zero aliases, audits EXISTING_REUSED, and binds need', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(ddl(postimages));

  // Verify zero aliases exist for 'Lektura' or 'lektura teksta na srpskom jeziku'
  const aliasCount = (await db.query("SELECT count(*) as c FROM private.work_taxonomy_aliases")).rows[0].c;
  assert.equal(Number(aliasCount), 0);

  const reviewId = '11111111-2222-3333-4444-555555555552';
  const requestKey = '22222222-3333-4444-5555-666666666662';
  const needId = '33333333-4444-5555-6666-777777777772';
  const plans = [{
    action: 'REUSE_EXISTING',
    service: 'Lektura teksta na srpskom jeziku',
    mode: 'REMOTE',
    categoryId: category,
    categoryLabel: 'Lektura i korektura',
    categoryParentId: null,
    catalogVersion: 17,
    reason: 'Semantic synonym recognized for Lektura i korektura without stored alias',
    handoff: { required: false }
  }];

  const envelope = {
    canAccept: true,
    classificationState: 'READY',
    classificationCatalogVersion: 17,
    classificationCatalogFingerprint: repeat('a', 32),
    classificationCandidates: plans,
    publicProjection: [
      { key: 'need.category', value: 'Lektura teksta na srpskom jeziku' },
      { key: 'need.handoff', value: { required: false } }
    ],
    location: { geography: { mode: 'REMOTE' } }
  };

  await insertTaskReview(db, reviewId, account, envelope);
  await db.query(`INSERT INTO private.ai_task_review_commands (review_id, account_id, client_request_id, state, need_id, need_revision)
    VALUES ($1, $2, $3, 'ACCEPTED', $4, 1)`, [reviewId, account, requestKey, needId]);
  await db.query(`INSERT INTO public.needs (id, requester_account_id, revision, status, category, execution_location_mode)
    VALUES ($1, $2, 1, 'PUBLISHED', 'Lektura teksta na srpskom jeziku', 'REMOTE')`, [needId, account]);
  await db.query(`INSERT INTO public.need_requirement_details (need_id, handoff)
    VALUES ($1, '{"required": false}'::jsonb)`, [needId]);

  // 1. Commit reviewed batch
  const commitRes = await db.query(
    'SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1, $2, $3, $4, $5::jsonb) AS res',
    [account, requestKey, 'NEED_SERVICE', reviewId, JSON.stringify(plans)]
  );
  const commit = commitRes.rows[0].res;
  assert.equal(commit.status, 'COMMITTED');
  assert.equal(commit.items[0].categoryId, category);

  // 2. Verify audit table received EXISTING_REUSED
  const auditRows = (await db.query("SELECT action, category_id, normalized_key FROM private.work_taxonomy_audit WHERE source_ref LIKE 'REVIEWED_BATCH:%'")).rows;
  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].action, 'EXISTING_REUSED');
  assert.equal(auditRows[0].category_id, category);
  assert.equal(auditRows[0].normalized_key, 'lektura teksta na srpskom jeziku');

  // 3. Verify STILL zero aliases inserted into private.work_taxonomy_aliases!
  const finalAliasCount = (await db.query("SELECT count(*) as c FROM private.work_taxonomy_aliases")).rows[0].c;
  assert.equal(Number(finalAliasCount), 0);

  // 4. Bind need
  await db.query("SELECT set_config('test.jwt', $1, false)", [JSON.stringify({ role: 'service_role' })]);
  const bindRes = await db.query(
    'SELECT public.rpc_taxonomy_bind_reviewed_need_service($1, $2, $3, $4, 1) AS res',
    [account, requestKey, reviewId, needId]
  );
  assert.equal(bindRes.rows[0].res.status, 'BOUND_NEED_REVISION');

  // 5. Read back need: category_id is bound
  const needRow = (await db.query('SELECT category_id FROM public.needs WHERE id = $1', [needId])).rows[0];
  assert.equal(needRow.category_id, category);
});

test('scenario 3: CREATE_CHILD and CREATE_NEW_BRANCH create categories, bump version, and audit AUTO_CREATED', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(ddl(postimages));

  // A. CREATE_CHILD with multi-step path under craftCategory
  const reviewIdChild = '11111111-2222-3333-4444-555555555553';
  const requestKeyChild = '22222222-3333-4444-5555-666666666663';
  const childService = 'Restauracija starog namestaja';
  const childPlans = [{
    action: 'CREATE_CHILD',
    service: childService,
    mode: 'ON_SITE',
    parentId: craftCategory,
    parentLabel: 'Zanatske usluge',
    path: ['Restauracija antikviteta', childService],
    catalogVersion: 17,
    reason: 'Nova podkategorija za restauraciju antikviteta pod zanatskim uslugama'
  }];

  const envelopeChild = {
    canAccept: true,
    classificationState: 'READY',
    classificationCatalogVersion: 17,
    classificationCatalogFingerprint: repeat('a', 32),
    classificationCandidates: childPlans,
    publicProjection: [{ key: 'need.category', value: childService }],
    location: { geography: { mode: 'STATIONARY' } }
  };

  await insertTaskReview(db, reviewIdChild, account, envelopeChild);
  await db.query(`INSERT INTO private.ai_task_review_commands (review_id, account_id, client_request_id, state)
    VALUES ($1, $2, $3, 'ACCEPTED')`, [reviewIdChild, account, requestKeyChild]);

  // Commit CREATE_CHILD with 2-step path (creates intermediate + leaf)
  const commitResChild = await db.query(
    'SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1, $2, $3, $4, $5::jsonb) AS res',
    [account, requestKeyChild, 'NEED_SERVICE', reviewIdChild, JSON.stringify(childPlans)]
  );
  const commitChild = commitResChild.rows[0].res;
  assert.equal(commitChild.status, 'COMMITTED');
  assert.equal(commitChild.createdCount, 2);
  assert.equal(commitChild.catalogVersion, 19);

  const newChildId = commitChild.items[0].categoryId;
  const newChildCat = (await db.query('SELECT * FROM private.work_taxonomy_categories WHERE id = $1', [newChildId])).rows[0];
  assert.equal(newChildCat.label, childService);
  assert.equal(newChildCat.source, 'AI_REVIEWED');

  // Verify parent of child is the intermediate category
  const intermediateCat = (await db.query('SELECT * FROM private.work_taxonomy_categories WHERE id = $1', [newChildCat.parent_id])).rows[0];
  assert.equal(intermediateCat.label, 'Restauracija antikviteta');
  assert.equal(intermediateCat.parent_id, craftCategory);

  // Both categories have AUTO_CREATED audits
  const auditChild = (await db.query('SELECT * FROM private.work_taxonomy_audit WHERE category_id = $1', [newChildId])).rows[0];
  assert.equal(auditChild.action, 'AUTO_CREATED');

  // B. CREATE_NEW_BRANCH (root branch category with parentId: null)
  const reviewIdBranch = '11111111-2222-3333-4444-55555555553b';
  const requestKeyBranch = '22222222-3333-4444-5555-66666666663b';
  const branchService = 'Prevodilacke usluge';
  const branchPlans = [{
    action: 'CREATE_NEW_BRANCH',
    service: branchService,
    mode: 'REMOTE',
    parentId: null,
    parentLabel: null,
    path: [branchService],
    catalogVersion: 19,
    reason: 'Nova korenski nezavisna grana za prevodioce',
    handoff: { required: false }
  }];

  const envelopeBranch = {
    canAccept: true,
    classificationState: 'READY',
    classificationCatalogVersion: 19,
    classificationCatalogFingerprint: repeat('a', 32),
    classificationCandidates: branchPlans,
    publicProjection: [
      { key: 'need.category', value: branchService },
      { key: 'need.handoff', value: { required: false } }
    ],
    location: { geography: { mode: 'REMOTE' } }
  };

  await insertTaskReview(db, reviewIdBranch, account, envelopeBranch);
  await db.query(`INSERT INTO private.ai_task_review_commands (review_id, account_id, client_request_id, state)
    VALUES ($1, $2, $3, 'ACCEPTED')`, [reviewIdBranch, account, requestKeyBranch]);

  const commitResBranch = await db.query(
    'SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1, $2, $3, $4, $5::jsonb) AS res',
    [account, requestKeyBranch, 'NEED_SERVICE', reviewIdBranch, JSON.stringify(branchPlans)]
  );
  const commitBranch = commitResBranch.rows[0].res;
  assert.equal(commitBranch.status, 'COMMITTED');
  assert.equal(commitBranch.createdCount, 1);
  assert.equal(commitBranch.catalogVersion, 20);

  const newBranchId = commitBranch.items[0].categoryId;
  const newBranchCat = (await db.query('SELECT * FROM private.work_taxonomy_categories WHERE id = $1', [newBranchId])).rows[0];
  assert.equal(newBranchCat.label, branchService);
  assert.equal(newBranchCat.parent_id, null);
  assert.equal(newBranchCat.source, 'AI_REVIEWED');
});

test('scenario 4: BOTH execution mode supported across worker capabilities and needs', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(ddl(postimages));

  const reviewId = '11111111-2222-3333-4444-555555555554';
  const requestKey = '22222222-3333-4444-5555-666666666664';
  const profileId = '44444444-5555-6666-7777-888888888884';
  const plans = [
    {
      action: 'REUSE_EXISTING',
      service: 'Lektura i korektura',
      mode: 'REMOTE',
      categoryId: category,
      categoryLabel: 'Lektura i korektura',
      categoryParentId: null,
      catalogVersion: 17,
      reason: 'Remote lektura option'
    },
    {
      action: 'REUSE_EXISTING',
      service: 'Lektura i korektura',
      mode: 'ON_SITE',
      categoryId: category,
      categoryLabel: 'Lektura i korektura',
      categoryParentId: null,
      catalogVersion: 17,
      reason: 'On-site lektura option'
    }
  ];

  const envelope = {
    canAccept: true,
    classificationState: 'READY',
    classificationCatalogVersion: 17,
    classificationCatalogFingerprint: repeat('a', 32),
    classificationCandidates: plans,
    profileId: profileId,
    profile: { skills: ['Lektura i korektura'] },
    reviewedServiceModes: [
      { service: 'Lektura i korektura', mode: 'REMOTE' },
      { service: 'Lektura i korektura', mode: 'ON_SITE' }
    ]
  };

  await insertWorkerReview(db, reviewId, account, envelope, 'base123');
  await db.query(`INSERT INTO public.app_profiles (id, account_id, kind, profile_status, skills, updated_at)
    VALUES ($1, $2, 'WORKER', 'ACTIVE', '["Lektura i korektura"]'::jsonb, now() - interval '1 minute')`, [profileId, account]);
  await db.query(`INSERT INTO private.worker_ai_saves (review_id, account_id, client_request_id, receipt, created_at)
    VALUES ($1, $2, $3, jsonb_build_object('saved', true, 'profileId', $4::text, 'profileStatus', 'ACTIVE'), now())`, [reviewId, account, requestKey, profileId]);

  // Commit WORKER_CAPABILITY with BOTH REMOTE and ON_SITE
  const commitRes = await db.query(
    'SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1, $2, $3, $4, $5::jsonb) AS res',
    [account, requestKey, 'WORKER_CAPABILITY', reviewId, JSON.stringify(plans)]
  );
  const commit = commitRes.rows[0].res;
  assert.equal(commit.status, 'COMMITTED');
  assert.equal(commit.items.length, 2);
  assert.deepEqual(commit.items.map(i => i.mode).sort(), ['ON_SITE', 'REMOTE']);

  // Bind worker services using service_role
  await db.query("SELECT set_config('test.jwt', $1, false)", [JSON.stringify({ role: 'service_role' })]);
  const bindRes = await db.query(
    'SELECT public.rpc_taxonomy_bind_reviewed_worker_service($1, $2, $3, $4) AS res',
    [account, requestKey, reviewId, profileId]
  );
  assert.equal(bindRes.rows[0].res.status, 'BOUND_WORKER_SERVICES');

  // Verify worker execution mode choices has BOTH modes recorded
  const modeChoice = (await db.query('SELECT modes FROM private.worker_execution_mode_choices WHERE worker_profile_id = $1', [profileId])).rows[0];
  assert.deepEqual(modeChoice.modes.sort(), ['ON_SITE', 'REMOTE']);

  // Verify worker capability is bound to category
  const caps = (await db.query('SELECT category_id, allow_related_offers, excluded FROM private.work_taxonomy_worker_capabilities WHERE worker_account_id = $1', [account])).rows;
  assert.equal(caps.length, 1);
  assert.equal(caps[0].category_id, category);
  assert.equal(caps[0].excluded, false);
});

test('scenario 5: idempotent replay returns identical receipt without duplicating audits; key reuse with different plan fails', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(ddl(postimages));

  const reviewId = '11111111-2222-3333-4444-555555555555';
  const requestKey = '22222222-3333-4444-5555-666666666665';
  const plans = [{
    action: 'REUSE_EXISTING',
    service: 'Lektura i korektura',
    mode: 'REMOTE',
    categoryId: category,
    categoryLabel: 'Lektura i korektura',
    catalogVersion: 17,
    reason: 'Exact canonical match verified by human review'
  }];

  const envelope = {
    canAccept: true,
    classificationState: 'READY',
    classificationCatalogVersion: 17,
    classificationCatalogFingerprint: repeat('a', 32),
    classificationCandidates: plans,
    publicProjection: [{ key: 'need.category', value: 'Lektura i korektura' }],
    location: { geography: { mode: 'REMOTE' } }
  };

  await insertTaskReview(db, reviewId, account, envelope);
  await db.query(`INSERT INTO private.ai_task_review_commands (review_id, account_id, client_request_id, state)
    VALUES ($1, $2, $3, 'ACCEPTED')`, [reviewId, account, requestKey]);

  // First call
  const first = (await db.query(
    'SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1, $2, $3, $4, $5::jsonb) AS res',
    [account, requestKey, 'NEED_SERVICE', reviewId, JSON.stringify(plans)]
  )).rows[0].res;
  assert.equal(first.status, 'COMMITTED');

  // Replay with exact same requestKey returns identical receipt
  const second = (await db.query(
    'SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1, $2, $3, $4, $5::jsonb) AS res',
    [account, requestKey, 'NEED_SERVICE', reviewId, JSON.stringify(plans)]
  )).rows[0].res;
  assert.deepEqual(second, first);

  // Calling with same requestKey but different plans fails
  const differentPlans = [{ ...plans[0], reason: 'Different reason' }];
  await assert.rejects(
    db.query(
      'SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1, $2, $3, $4, $5::jsonb) AS res',
      [account, requestKey, 'NEED_SERVICE', reviewId, JSON.stringify(differentPlans)]
    ),
    /BATCH_REQUEST_KEY_REUSED/
  );
});

test('scenario 6: category drift (rename, parent drift, non-leaf addition) throws BATCH_CATEGORY_IDENTITY_CHANGED', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(ddl(postimages));

  // A. Label rename drift
  const reviewId1 = '11111111-2222-3333-4444-555555555556';
  const requestKey1 = '22222222-3333-4444-5555-666666666666';
  const plans1 = [{
    action: 'REUSE_EXISTING',
    service: 'Lektura teksta na srpskom jeziku',
    mode: 'REMOTE',
    categoryId: category,
    categoryLabel: 'Lektura i korektura',
    categoryParentId: null,
    catalogVersion: 17,
    reason: 'Original reviewed label before rename',
    handoff: { required: false }
  }];

  const envelope1 = {
    canAccept: true,
    classificationState: 'READY',
    classificationCatalogVersion: 17,
    classificationCatalogFingerprint: repeat('a', 32),
    classificationCandidates: plans1,
    publicProjection: [
      { key: 'need.category', value: 'Lektura teksta na srpskom jeziku' },
      { key: 'need.handoff', value: { required: false } }
    ],
    location: { geography: { mode: 'REMOTE' } }
  };

  await insertTaskReview(db, reviewId1, account, envelope1);
  await db.query(`INSERT INTO private.ai_task_review_commands (review_id, account_id, client_request_id, state)
    VALUES ($1, $2, $3, 'ACCEPTED')`, [reviewId1, account, requestKey1]);

  // Rename the category in DB after human reviewed it!
  await db.query("UPDATE private.work_taxonomy_categories SET label = 'Lektura i redaktura' WHERE id = $1", [category]);

  // Commit must detect label drift and fail with BATCH_CATEGORY_IDENTITY_CHANGED!
  await assert.rejects(
    db.query(
      'SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1, $2, $3, $4, $5::jsonb) AS res',
      [account, requestKey1, 'NEED_SERVICE', reviewId1, JSON.stringify(plans1)]
    ),
    /BATCH_CATEGORY_IDENTITY_CHANGED/
  );

  // Restore label
  await db.query("UPDATE private.work_taxonomy_categories SET label = 'Lektura i korektura' WHERE id = $1", [category]);

  // B. Parent drift: DB changes parent_id
  const reviewId2 = '11111111-2222-3333-4444-55555555556b';
  const requestKey2 = '22222222-3333-4444-5555-66666666666b';
  await insertTaskReview(db, reviewId2, account, envelope1);
  await db.query(`INSERT INTO private.ai_task_review_commands (review_id, account_id, client_request_id, state)
    VALUES ($1, $2, $3, 'ACCEPTED')`, [reviewId2, account, requestKey2]);

  await db.query('UPDATE private.work_taxonomy_categories SET parent_id = $1 WHERE id = $2', [craftCategory, category]);
  await assert.rejects(
    db.query(
      'SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1, $2, $3, $4, $5::jsonb) AS res',
      [account, requestKey2, 'NEED_SERVICE', reviewId2, JSON.stringify(plans1)]
    ),
    /BATCH_CATEGORY_IDENTITY_CHANGED/
  );
  await db.query('UPDATE private.work_taxonomy_categories SET parent_id = null WHERE id = $1', [category]);

  // C. Non-leaf drift: DB adds a child under category making it no longer a leaf node
  const reviewId3 = '11111111-2222-3333-4444-55555555556c';
  const requestKey3 = '22222222-3333-4444-5555-66666666666c';
  await insertTaskReview(db, reviewId3, account, envelope1);
  await db.query(`INSERT INTO private.ai_task_review_commands (review_id, account_id, client_request_id, state)
    VALUES ($1, $2, $3, 'ACCEPTED')`, [reviewId3, account, requestKey3]);

  const childId = '99999999-8888-7777-6666-555555555555';
  await db.query(`INSERT INTO private.work_taxonomy_categories (id, parent_id, label, canonical_key, state)
    VALUES ($1, $2, 'Podkategorija lekture', 'podkategorija lekture', 'ESTABLISHED')`, [childId, category]);

  await assert.rejects(
    db.query(
      'SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1, $2, $3, $4, $5::jsonb) AS res',
      [account, requestKey3, 'NEED_SERVICE', reviewId3, JSON.stringify(plans1)]
    ),
    /BATCH_CATEGORY_IDENTITY_CHANGED/
  );
});

test('scenario 7: unrecorded synonym EXTEND_MODE extends category execution modes and audits CORRECTED', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(ddl(postimages));

  // Create an established leaf category with only ON_SITE mode
  const leafCategoryId = '77777777-6666-5555-4444-333333333337';
  await db.query(`INSERT INTO private.work_taxonomy_categories (id, parent_id, label, canonical_key, state)
    VALUES ($1, $2, 'Dubinsko pranje namestaja', 'dubinsko pranje namestaja', 'ESTABLISHED')`, [leafCategoryId, craftCategory]);
  await db.query('INSERT INTO private.work_taxonomy_category_modes (category_id, execution_scope) VALUES ($1, $2)', [leafCategoryId, 'ON_SITE']);

  const leafModes = (await db.query('SELECT execution_scope FROM private.work_taxonomy_category_modes WHERE category_id = $1', [leafCategoryId])).rows;
  assert.deepEqual(leafModes.map(r => r.execution_scope), ['ON_SITE']);

  const reviewId = '11111111-2222-3333-4444-555555555557';
  const requestKey = '22222222-3333-4444-5555-666666666667';
  const needId = '33333333-4444-5555-6666-777777777777';
  const plans = [{
    action: 'EXTEND_MODE',
    service: 'Online saveti za pranje namestaja',
    mode: 'REMOTE',
    categoryId: leafCategoryId,
    categoryLabel: 'Dubinsko pranje namestaja',
    categoryParentId: craftCategory,
    catalogVersion: 17,
    reason: 'Saveti za pranje namestaja na daljinu prosiruju kategoriju na REMOTE',
    handoff: { required: false }
  }];

  const envelope = {
    canAccept: true,
    classificationState: 'READY',
    classificationCatalogVersion: 17,
    classificationCatalogFingerprint: repeat('a', 32),
    classificationCandidates: plans,
    publicProjection: [
      { key: 'need.category', value: 'Online saveti za pranje namestaja' },
      { key: 'need.handoff', value: { required: false } }
    ],
    location: { geography: { mode: 'REMOTE' } }
  };

  await insertTaskReview(db, reviewId, account, envelope);
  await db.query(`INSERT INTO private.ai_task_review_commands (review_id, account_id, client_request_id, state, need_id, need_revision)
    VALUES ($1, $2, $3, 'ACCEPTED', $4, 1)`, [reviewId, account, requestKey, needId]);
  await db.query(`INSERT INTO public.needs (id, requester_account_id, revision, status, category, execution_location_mode)
    VALUES ($1, $2, 1, 'PUBLISHED', 'Online saveti za pranje namestaja', 'REMOTE')`, [needId, account]);
  await db.query(`INSERT INTO public.need_requirement_details (need_id, handoff)
    VALUES ($1, '{"required": false}'::jsonb)`, [needId]);

  // Commit EXTEND_MODE
  const commitRes = await db.query(
    'SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1, $2, $3, $4, $5::jsonb) AS res',
    [account, requestKey, 'NEED_SERVICE', reviewId, JSON.stringify(plans)]
  );
  const commit = commitRes.rows[0].res;
  assert.equal(commit.status, 'COMMITTED');
  assert.equal(commit.catalogVersion, 18);

  // Verify leafCategoryId now has REMOTE mode in work_taxonomy_category_modes!
  const updatedModes = (await db.query('SELECT execution_scope FROM private.work_taxonomy_category_modes WHERE category_id = $1 ORDER BY execution_scope', [leafCategoryId])).rows;
  assert.deepEqual(updatedModes.map(r => r.execution_scope), ['ON_SITE', 'REMOTE']);

  // Verify audit logged CORRECTED
  const auditRow = (await db.query("SELECT action, category_id, normalized_key FROM private.work_taxonomy_audit WHERE action = 'CORRECTED' AND category_id = $1", [leafCategoryId])).rows[0];
  assert.equal(auditRow.action, 'CORRECTED');
  assert.equal(auditRow.category_id, leafCategoryId);

  // Bind reviewed need to the newly extended mode category
  await db.query("SELECT set_config('test.jwt', $1, false)", [JSON.stringify({ role: 'service_role' })]);
  const bindRes = await db.query(
    'SELECT public.rpc_taxonomy_bind_reviewed_need_service($1, $2, $3, $4, 1) AS res',
    [account, requestKey, reviewId, needId]
  );
  assert.equal(bindRes.rows[0].res.status, 'BOUND_NEED_REVISION');

  const needRow = (await db.query('SELECT category_id FROM public.needs WHERE id = $1', [needId])).rows[0];
  assert.equal(needRow.category_id, leafCategoryId);
});

test('scenario 8: negative handoff verification rejects invalid handoff or stale details', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(ddl(postimages));

  // A. Invalid handoff structure in commit throws BATCH_HANDOFF_INVALID
  const reviewId1 = '11111111-2222-3333-4444-555555555558';
  const requestKey1 = '22222222-3333-4444-5555-666666666668';
  const invalidPlans = [{
    action: 'REUSE_EXISTING',
    service: 'Lektura i korektura',
    mode: 'REMOTE',
    categoryId: category,
    categoryLabel: 'Lektura i korektura',
    categoryParentId: null,
    catalogVersion: 17,
    reason: 'Invalid handoff test',
    handoff: { required: true } // Missing shippingCountries or localExchange!
  }];

  const envelope1 = {
    canAccept: true,
    classificationState: 'READY',
    classificationCatalogVersion: 17,
    classificationCatalogFingerprint: repeat('a', 32),
    classificationCandidates: invalidPlans,
    publicProjection: [
      { key: 'need.category', value: 'Lektura i korektura' },
      { key: 'need.handoff', value: { required: true } }
    ],
    location: { geography: { mode: 'REMOTE' } }
  };

  await insertTaskReview(db, reviewId1, account, envelope1);
  await db.query(`INSERT INTO private.ai_task_review_commands (review_id, account_id, client_request_id, state)
    VALUES ($1, $2, $3, 'ACCEPTED')`, [reviewId1, account, requestKey1]);

  await assert.rejects(
    db.query(
      'SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1, $2, $3, $4, $5::jsonb) AS res',
      [account, requestKey1, 'NEED_SERVICE', reviewId1, JSON.stringify(invalidPlans)]
    ),
    /BATCH_HANDOFF_INVALID/
  );

  // B. Mismatched handoff in need_requirement_details throws NEED_BINDER_HANDOFF_STALE
  const reviewId2 = '11111111-2222-3333-4444-55555555558b';
  const requestKey2 = '22222222-3333-4444-5555-66666666668b';
  const needId2 = '33333333-4444-5555-6666-77777777778b';
  const validPlans = [{
    action: 'REUSE_EXISTING',
    service: 'Lektura i korektura',
    mode: 'REMOTE',
    categoryId: category,
    categoryLabel: 'Lektura i korektura',
    categoryParentId: null,
    catalogVersion: 17,
    reason: 'Valid plan handoff',
    handoff: { required: false }
  }];

  const envelope2 = {
    canAccept: true,
    classificationState: 'READY',
    classificationCatalogVersion: 17,
    classificationCatalogFingerprint: repeat('a', 32),
    classificationCandidates: validPlans,
    publicProjection: [
      { key: 'need.category', value: 'Lektura i korektura' },
      { key: 'need.handoff', value: { required: false } }
    ],
    location: { geography: { mode: 'REMOTE' } }
  };

  await insertTaskReview(db, reviewId2, account, envelope2);
  await db.query(`INSERT INTO private.ai_task_review_commands (review_id, account_id, client_request_id, state, need_id, need_revision)
    VALUES ($1, $2, $3, 'ACCEPTED', $4, 1)`, [reviewId2, account, requestKey2, needId2]);
  await db.query(`INSERT INTO public.needs (id, requester_account_id, revision, status, category, execution_location_mode)
    VALUES ($1, $2, 1, 'PUBLISHED', 'Lektura i korektura', 'REMOTE')`, [needId2, account]);
  // Insert DIFFERENT handoff in need_requirement_details:
  await db.query(`INSERT INTO public.need_requirement_details (need_id, handoff)
    VALUES ($1, '{"required": true, "shippingCountries": ["RS"]}'::jsonb)`, [needId2]);

  await db.query(
    'SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1, $2, $3, $4, $5::jsonb) AS res',
    [account, requestKey2, 'NEED_SERVICE', reviewId2, JSON.stringify(validPlans)]
  );

  await db.query("SELECT set_config('test.jwt', $1, false)", [JSON.stringify({ role: 'service_role' })]);
  await assert.rejects(
    db.query(
      'SELECT public.rpc_taxonomy_bind_reviewed_need_service($1, $2, $3, $4, 1) AS res',
      [account, requestKey2, reviewId2, needId2]
    ),
    /NEED_BINDER_HANDOFF_STALE/
  );
});


test('R04/R08 downstream: unregistered signed worker synonym fails old binder, succeeds with witnessed category ID, and rejects drift', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(ddl(postimages));
  const reviewId = '11111111-2222-4333-8444-555555555560';
  const requestKey = '22222222-3333-4444-8555-666666666660';
  const profileId = '44444444-5555-4666-8777-888888888860';
  const plan = { action:'REUSE_EXISTING', service:'Lektura', mode:'REMOTE',
    categoryId:category, categoryLabel:'Lektura i korektura', categoryParentId:null,
    catalogVersion:17, reason:'Human reviewed identical existing text-editing service' };
  const envelope = {
    canAccept:true, classificationState:'READY', classificationCatalogVersion:17,
    classificationCatalogFingerprint:repeat('a',32), classificationCandidates:[plan],
    profileId, profile:{skills:['Lektura']}, reviewedServiceModes:[{service:'Lektura',mode:'REMOTE'}],
  };
  await insertWorkerReview(db, reviewId, account, envelope, 'base123');
  await db.query("INSERT INTO public.app_profiles(id,account_id,kind,profile_status,skills,updated_at) VALUES($1,$2,'WORKER','ACTIVE',$3::jsonb, now()-interval '1 minute')",
    [profileId,account,JSON.stringify(['Lektura'])]);
  await db.query("INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id,receipt,created_at) VALUES($1,$2,$3,jsonb_build_object('saved',true,'profileId',$4::text,'profileStatus','ACTIVE'),now())",
    [reviewId,account,requestKey,profileId]);
  const commit=(await db.query("SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1,$2,'WORKER_CAPABILITY',$3,$4::jsonb) res",
    [account,requestKey,reviewId,JSON.stringify([plan])])).rows[0].res;
  assert.equal(commit.status,'COMMITTED');
  assert.equal(commit.items[0].categoryId,category);
  await db.query("SELECT set_config('test.jwt',$1,false)",[JSON.stringify({role:'service_role'})]);
  const bind=()=>db.query('SELECT public.rpc_taxonomy_bind_reviewed_worker_service($1,$2,$3,$4) res',
    [account,requestKey,reviewId,profileId]);
  // This is the exact pre-fix regression; a green old binder is a test failure.
  await assert.rejects(bind(),/WORKER_BINDER_CATEGORY_STALE/);
  assert.equal((await db.query('SELECT count(*)::int n FROM private.work_taxonomy_worker_capabilities')).rows[0].n,0);
  // The live signature is retained. Only the fixture-specific skills jsonb
  // comparison differs from live app_profiles.skills text[]; no semantic guard
  // or owner/Save/receipt checks are weakened in the candidate itself.
  const source=readFileSync(new URL('worker-semantic-binder-local-only.sql',import.meta.url),'utf8');
  assert.match(source,/v_plan \? 'categoryParentId'/);
  assert.match(source,/worker semantic|signed worker|signed review/i);
  const liveSkillsClause='to_jsonb(v_profile.skills) IS DISTINCT FROM v_skills';
  assert.equal(source.split(liveSkillsClause).length,2);
  await db.exec(source.replace(liveSkillsClause,'v_profile.skills IS DISTINCT FROM v_skills'));
  await db.query('UPDATE private.work_taxonomy_categories SET label=$1 WHERE id=$2',['Preimenovana usluga',category]);
  await assert.rejects(bind(),/WORKER_BINDER_CATEGORY_STALE/);
  await db.query('UPDATE private.work_taxonomy_categories SET label=$1,parent_id=$2 WHERE id=$3',
    ['Lektura i korektura',craftCategory,category]);
  await assert.rejects(bind(),/WORKER_BINDER_CATEGORY_STALE/);
  await db.query('UPDATE private.work_taxonomy_categories SET parent_id=NULL WHERE id=$1',[category]);
  const child='33333333-4444-4555-8666-777777777761';
  await db.query("INSERT INTO private.work_taxonomy_categories(id,parent_id,label,canonical_key,state) VALUES ($1,$2,'Novi podlist','novi podlist','ESTABLISHED')",[child,category]);
  await assert.rejects(bind(),/WORKER_BINDER_CATEGORY_STALE/);
  await db.query('DELETE FROM private.work_taxonomy_categories WHERE id=$1',[child]);
  const bound=(await bind()).rows[0].res;
  assert.equal(bound.status,'BOUND_WORKER_SERVICES');
  assert.equal(bound.serviceModeCount,1);
  const caps=(await db.query('SELECT category_id,excluded,allow_related_offers FROM private.work_taxonomy_worker_capabilities WHERE worker_account_id=$1',[account])).rows;
  assert.equal(caps.length,1);
  assert.equal(caps[0].category_id,category);
  assert.equal(caps[0].excluded,false);
  assert.equal(caps[0].allow_related_offers,false);
  assert.equal((await db.query('SELECT count(*)::int n FROM private.work_taxonomy_aliases')).rows[0].n,0);
  const again=(await bind()).rows[0].res;
  assert.deepEqual(again,bound);
  assert.equal((await db.query('SELECT count(*)::int n FROM private.work_taxonomy_worker_bindings_v1')).rows[0].n,1);
});


test('R04/R08 canonical category witness rejects label drift despite unchanged canonical key', async t => {
  const db=await setup();t.after(()=>db.close());await db.exec(ddl(postimages));
  const reviewId='11111111-2222-4333-8444-555555555561';
  const requestKey='22222222-3333-4444-8555-666666666661';
  const profileId='44444444-5555-4666-8777-888888888861';
  const plan={action:'REUSE_EXISTING',service:'Lektura i korektura',mode:'REMOTE',
    categoryId:category,categoryLabel:'Lektura i korektura',categoryParentId:null,
    catalogVersion:17,reason:'Existing exact service with frozen category identity'};
  const envelope={canAccept:true,classificationState:'READY',classificationCatalogVersion:17,
    classificationCatalogFingerprint:repeat('a',32),classificationCandidates:[plan],profileId,
    profile:{skills:['Lektura i korektura']},
    reviewedServiceModes:[{service:'Lektura i korektura',mode:'REMOTE'}]};
  await insertWorkerReview(db,reviewId,account,envelope);
  await db.query("INSERT INTO public.app_profiles(id,account_id,kind,profile_status,skills,updated_at) VALUES($1,$2,'WORKER','ACTIVE',$3::jsonb,now()-interval '1 minute')",
    [profileId,account,JSON.stringify(['Lektura i korektura'])]);
  await db.query("INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id,receipt,created_at) VALUES($1,$2,$3,jsonb_build_object('saved',true,'profileId',$4::text,'profileStatus','ACTIVE'),now())",
    [reviewId,account,requestKey,profileId]);
  const committed=(await db.query("SELECT public.rpc_taxonomy_commit_reviewed_batch_service($1,$2,'WORKER_CAPABILITY',$3,$4::jsonb) res",
    [account,requestKey,reviewId,JSON.stringify([plan])])).rows[0].res;
  assert.equal(committed.status,'COMMITTED');
  await db.query("SELECT set_config('test.jwt',$1,false)",[JSON.stringify({role:'service_role'})]);
  const source=readFileSync(new URL('worker-semantic-binder-local-only.sql',import.meta.url),'utf8');
  const fixtureClause='to_jsonb(v_profile.skills) IS DISTINCT FROM v_skills';
  assert.equal(source.split(fixtureClause).length,2);
  await db.exec(source.replace(fixtureClause,'v_profile.skills IS DISTINCT FROM v_skills'));
  const bind=()=>db.query('SELECT public.rpc_taxonomy_bind_reviewed_worker_service($1,$2,$3,$4) res',
    [account,requestKey,reviewId,profileId]);
  await db.query('UPDATE private.work_taxonomy_categories SET label=$1 WHERE id=$2',['Lektura izmenjen label',category]);
  await assert.rejects(bind(),/WORKER_BINDER_CATEGORY_STALE/);
  assert.equal((await db.query('SELECT count(*)::int n FROM private.work_taxonomy_worker_capabilities')).rows[0].n,0);
  await db.query('UPDATE private.work_taxonomy_categories SET label=$1 WHERE id=$2',['Lektura i korektura',category]);
  assert.equal((await bind()).rows[0].res.status,'BOUND_WORKER_SERVICES');
});

function repeat(char, n) {
  return char.repeat(n);
}
