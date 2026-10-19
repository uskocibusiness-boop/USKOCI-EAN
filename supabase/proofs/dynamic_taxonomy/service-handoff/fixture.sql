-- Disposable synthetic PG only. See README for the exact boundary limitations.
\set ON_ERROR_STOP on
\ir ../parent-mode-admission/fixture.sql
ALTER TABLE public.needs ADD title text, ADD description text,
 ADD approximate_city text, ADD approximate_area text, ADD approximate_lat numeric, ADD approximate_lng numeric,
 ADD schedule_kind text, ADD starts_at timestamptz, ADD ends_at timestamptz,
 ADD required_slots integer, ADD mode text, ADD requester_price_rsd integer,
 ADD required_skills text[], ADD required_tools text[], ADD required_vehicles text[], ADD required_licenses text[],
 ADD minimum_experience_years integer, ADD verified_identity_required boolean, ADD public_photo_paths text[];
CREATE TABLE public.need_requirement_details(need_id uuid PRIMARY KEY,critical_conditions text[]);
CREATE TABLE public.need_geography(need_id uuid PRIMARY KEY,public_topology jsonb);
CREATE TABLE public.need_sensitive(need_id uuid PRIMARY KEY,exact_address text,access_notes text,exact_lat numeric,exact_lng numeric,resolved_location jsonb);
CREATE TABLE public.worker_match_preferences(worker_profile_id uuid);
CREATE TABLE private.need_fact_registry(fact_key text PRIMARY KEY,schema_version text,value_type text,required_for_draft boolean,privacy_class text,material boolean,target_owner text);
CREATE TABLE private.need_draft_save_commands(account_id uuid,conversation_id uuid,client_request_id text,request_hash text,result jsonb);
CREATE TABLE private.need_edit_commands(account_id uuid,need_id uuid,client_request_id text,request_hash text,result jsonb);
ALTER TABLE private.worker_ai_sessions ADD profile_id uuid;
ALTER TABLE private.worker_ai_reviews ADD created_at timestamptz DEFAULT statement_timestamp();
ALTER TABLE private.ai_task_reviews ADD conversation_id uuid, ADD requester_profile_id uuid, ADD source_hash text, ADD created_at timestamptz DEFAULT statement_timestamp();
ALTER TABLE public.ai_conversations ADD fact_schema_version text DEFAULT 'NEED_FACT_V2', ADD status text DEFAULT 'OPEN', ADD bound_need_id uuid, ADD need_edit_base_fingerprint text;
CREATE TABLE private.publication_policy_bundles(id uuid);
CREATE TABLE private.publication_policy_rule_refs(id uuid);
CREATE TABLE private.location_market_configs(country_code text PRIMARY KEY,default_timezone text);
INSERT INTO private.location_market_configs VALUES('RS','Europe/Belgrade');
CREATE TABLE public.ai_structured_facts(conversation_id uuid,fact_schema_version text,status text,superseded_at timestamptz,fact_key text,fact_value jsonb);
CREATE TABLE public.agreements(need_id uuid);
CREATE TABLE public.need_selections(need_id uuid);
CREATE TABLE public.marketplace_responses(need_id uuid,status text);
-- Exact deployed bodies, including old binders. Apply 104047 AFTER this file.
\ir before.sql
\ir boundaries.sql
