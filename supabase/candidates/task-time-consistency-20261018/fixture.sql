-- DISPOSABLE PostgreSQL 16/17 only. Synthetic accounts, no Supabase connection.
-- Real column types/defaults captured from metadata; unrelated geographies,
-- RLS and production triggers are deliberately not part of this narrow proof.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE SCHEMA extensions;
CREATE SCHEMA proof;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$f$;
CREATE TABLE private.connection_activations (
 "id" uuid DEFAULT extensions.gen_random_uuid(),
 "requester_account_id" uuid,
 "beneficiary_account_id" uuid,
 "client_request_id" text,
 "request_hash" text,
 "policy_key" text,
 "policy_version" integer,
 "policy_snapshot" jsonb,
 "activation_reason" text,
 "need_id" uuid,
 "need_revision" integer,
 "selection_id" uuid,
 "agreement_id" uuid,
 "response_id" uuid,
 "response_version" integer,
 "response_content_hash" text,
 "worker_account_id" uuid,
 "worker_profile_id" uuid,
 "units" integer,
 "platform_cost_rsd" integer,
 "state" text,
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 PRIMARY KEY ("id")
);

CREATE TABLE private.connection_policy_versions (
 "policy_key" text,
 "version" integer,
 "beneficiary_role" text,
 "activation_reason" text,
 "charge_mode" text,
 "unit_basis" text,
 "platform_cost_rsd" integer,
 "policy_snapshot" jsonb,
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 PRIMARY KEY ("policy_key","version")
);

CREATE TABLE private.response_application_snapshots (
 "response_id" uuid,
 "response_version" integer,
 "snapshot_schema" text,
 "worker_profile_id" uuid,
 "worker_team_capacity" integer,
 "covered_slots" integer,
 "need_required_slots" integer,
 "need_selected_slots_before_submit" integer,
 "need_remaining_slots_before_submit" integer,
 "pricing_mode" text,
 "requester_price_rsd" integer,
 "worker_skills" text[] DEFAULT ARRAY[]::text[],
 "worker_tools" text[] DEFAULT ARRAY[]::text[],
 "worker_licenses" text[] DEFAULT ARRAY[]::text[],
 "worker_vehicles" text[] DEFAULT ARRAY[]::text[],
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 PRIMARY KEY ("response_id","response_version")
);

CREATE TABLE private.response_revision_resolution_commands (
 "worker_account_id" uuid,
 "client_request_id" text,
 "request_hash" text,
 "response_id" uuid,
 "result" jsonb,
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 PRIMARY KEY ("worker_account_id","client_request_id")
);

CREATE TABLE private.response_submit_commands (
 "worker_account_id" uuid,
 "client_request_id" text,
 "request_hash" text,
 "response_id" uuid,
 "response_version" integer,
 "result" jsonb,
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 PRIMARY KEY ("worker_account_id","client_request_id")
);

CREATE TABLE private.selection_commands (
 "requester_account_id" uuid,
 "client_request_id" text,
 "request_hash" text,
 "need_id" uuid,
 "need_revision" integer,
 "response_id" uuid,
 "response_version" integer,
 "response_content_hash" text,
 "covered_slots" integer,
 "selection_id" uuid,
 "agreement_id" uuid,
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 PRIMARY KEY ("requester_account_id","client_request_id")
);

CREATE TABLE public.agreement_execution (
 "agreement_id" uuid,
 "agreement_version" integer,
 "mode" text DEFAULT 'PHYSICAL'::text,
 "state" text DEFAULT 'CONFIRMED'::text,
 "worker_marked_done_at" timestamp with time zone,
 "requester_deadline_at" timestamp with time zone,
 "problem_opened_at" timestamp with time zone,
 "completed_at" timestamp with time zone,
 "updated_at" timestamp with time zone DEFAULT statement_timestamp(),
 "problem_narrative" text,
 "problem_opened_by" uuid,
 PRIMARY KEY ("agreement_id","agreement_version")
);

CREATE TABLE public.agreement_versions (
 "agreement_id" uuid,
 "version" integer,
 "status" text,
 "terms" jsonb,
 "content_hash" text,
 "supersedes_version" integer,
 "created_by_account_id" uuid,
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 PRIMARY KEY ("agreement_id","version")
);

CREATE TABLE public.agreements (
 "id" uuid DEFAULT extensions.gen_random_uuid(),
 "need_id" uuid,
 "selection_id" uuid,
 "selected_response_id" uuid,
 "requester_account_id" uuid,
 "requester_profile_id" uuid,
 "worker_account_id" uuid,
 "worker_profile_id" uuid,
 "current_version" integer DEFAULT 1,
 "status" text DEFAULT 'CONFIRMED'::text,
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 "updated_at" timestamp with time zone DEFAULT statement_timestamp(),
 PRIMARY KEY ("id")
);

CREATE TABLE public.app_profiles (
 "id" uuid DEFAULT gen_random_uuid(),
 "account_id" uuid,
 "kind" text,
 "display_name" text DEFAULT ''::text,
 "city" text DEFAULT ''::text,
 "headline" text DEFAULT ''::text,
 "bio" text DEFAULT ''::text,
 "avatar_path" text,
 "account_type" text DEFAULT 'INDIVIDUAL'::text,
 "profile_status" text DEFAULT 'DRAFT'::text,
 "years_experience" integer DEFAULT 0,
 "portfolio" jsonb DEFAULT '[]'::jsonb,
 "skills" text[] DEFAULT ARRAY[]::text[],
 "radius_km" integer DEFAULT 15,
 "available_now" boolean DEFAULT false,
 "team_capacity" integer DEFAULT 1,
 "tools" text[] DEFAULT ARRAY[]::text[],
 "licenses" text[] DEFAULT ARRAY[]::text[],
 "vehicles" text[] DEFAULT ARRAY[]::text[],
 "exclusions" text[] DEFAULT ARRAY[]::text[],
 "minimum_fee_rsd" integer DEFAULT 0,
 "rating_requester" numeric(3,2),
 "rating_worker" numeric(3,2),
 "created_at" timestamp with time zone DEFAULT now(),
 "updated_at" timestamp with time zone DEFAULT now(),
 "available_now_expires_at" timestamp with time zone,
 "operating_country_code" text,
 PRIMARY KEY ("id")
);

CREATE TABLE public.marketplace_response_versions (
 "response_id" uuid,
 "version" integer,
 "need_revision" integer,
 "price_rsd" integer,
 "covered_slots" integer,
 "proposed_start_at" timestamp with time zone,
 "proposed_end_at" timestamp with time zone,
 "scope_note" text DEFAULT ''::text,
 "content_hash" text,
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 PRIMARY KEY ("response_id","version")
);

CREATE TABLE public.marketplace_responses (
 "id" uuid DEFAULT extensions.gen_random_uuid(),
 "need_id" uuid,
 "worker_account_id" uuid,
 "worker_profile_id" uuid,
 "response_kind" text,
 "status" text,
 "submitted_against_need_revision" integer,
 "current_version" integer DEFAULT 1,
 "covered_slots" integer DEFAULT 1,
 "price_rsd" integer,
 "proposed_start_at" timestamp with time zone,
 "proposed_end_at" timestamp with time zone,
 "scope_note" text DEFAULT ''::text,
 "bounded_message" text DEFAULT ''::text,
 "submitted_at" timestamp with time zone,
 "viewed_at" timestamp with time zone,
 "selected_at" timestamp with time zone,
 "withdrawn_at" timestamp with time zone,
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 "updated_at" timestamp with time zone DEFAULT statement_timestamp(),
 PRIMARY KEY ("id")
);

CREATE TABLE public.need_selections (
 "id" uuid DEFAULT extensions.gen_random_uuid(),
 "need_id" uuid,
 "need_revision" integer,
 "selected_by_account_id" uuid,
 "client_request_id" text,
 "covered_slots" integer,
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 "response_id" uuid,
 "worker_account_id" uuid,
 "worker_profile_id" uuid,
 "selection_mode" text,
 "status" text DEFAULT 'SELECTED'::text,
 "updated_at" timestamp with time zone DEFAULT statement_timestamp(),
 PRIMARY KEY ("id")
);

CREATE TABLE public.needs (
 "id" uuid DEFAULT extensions.gen_random_uuid(),
 "requester_account_id" uuid,
 "requester_profile_id" uuid,
 "status" text DEFAULT 'DRAFT'::text,
 "title" text,
 "description" text,
 "category" text,
 "approximate_city" text DEFAULT ''::text,
 "approximate_area" text DEFAULT ''::text,
 "approximate_lat" numeric(6,2),
 "approximate_lng" numeric(7,2),
 "schedule_kind" text DEFAULT 'FLEXIBLE'::text,
 "starts_at" timestamp with time zone,
 "ends_at" timestamp with time zone,
 "required_slots" integer DEFAULT 1,
 "mode" text,
 "requester_price_rsd" integer,
 "required_skills" text[] DEFAULT '{}'::text[],
 "required_tools" text[] DEFAULT '{}'::text[],
 "required_vehicles" text[] DEFAULT '{}'::text[],
 "verified_identity_required" boolean DEFAULT false,
 "urgent" boolean DEFAULT false,
 "public_photo_paths" text[] DEFAULT '{}'::text[],
 "revision" integer DEFAULT 1,
 "published_at" timestamp with time zone,
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 "updated_at" timestamp with time zone DEFAULT statement_timestamp(),
 "response_deadline" timestamp with time zone,
 "urgent_activated_at" timestamp with time zone,
 "urgent_expires_at" timestamp with time zone,
 "urgent_policy_version" text,
 "minimum_experience_years" integer,
 "execution_location_mode" text DEFAULT 'STATIONARY'::text,
 "required_licenses" text[] DEFAULT '{}'::text[],
 "remaining_search_closed_at" timestamp with time zone,
 "remaining_search_closed_by_account_id" uuid,
 "remaining_search_close_reason" text,
 "task_country_code" text,
 "task_timezone" text,
 "price_basis" text,
 "category_id" uuid,
 PRIMARY KEY ("id")
);

CREATE TABLE public.notification_deliveries (
 "id" uuid DEFAULT extensions.gen_random_uuid(),
 "event_id" uuid,
 "recipient_user_id" uuid,
 "recipient_role" text,
 "channel" text,
 "priority" text DEFAULT 'NORMAL'::text,
 "state" text,
 "suppression_reason" text,
 "title" text,
 "body" text,
 "dedupe_key" text,
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 "queued_at" timestamp with time zone,
 "sent_at" timestamp with time zone,
 "delivered_at" timestamp with time zone,
 "read_at" timestamp with time zone,
 "expires_at" timestamp with time zone,
 "push_started_at" timestamp with time zone,
 PRIMARY KEY ("id")
);

CREATE TABLE public.opportunity_deliveries (
 "id" uuid DEFAULT gen_random_uuid(),
 "worker_account_id" uuid,
 "worker_profile_id" uuid,
 "need_id" uuid,
 "need_revision" integer,
 "dispatch_round_id" uuid,
 "match_score" numeric(6,2) DEFAULT 0,
 "score_components" jsonb DEFAULT '{}'::jsonb,
 "reason_codes" text[] DEFAULT '{}'::text[],
 "status" text DEFAULT 'READY'::text,
 "expires_at" timestamp with time zone,
 "seen_at" timestamp with time zone,
 "responded_at" timestamp with time zone,
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 "updated_at" timestamp with time zone DEFAULT statement_timestamp(),
 PRIMARY KEY ("id")
);

CREATE TABLE public.user_activity_events (
 "id" uuid DEFAULT extensions.gen_random_uuid(),
 "recipient_user_id" uuid,
 "recipient_role" text,
 "event_type" text,
 "entity_type" text,
 "entity_id" uuid,
 "entity_version" integer,
 "urgency" text DEFAULT 'NORMAL'::text,
 "payload" jsonb DEFAULT '{}'::jsonb,
 "dedupe_key" text,
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 "read_at" timestamp with time zone,
 PRIMARY KEY ("id")
);

CREATE TABLE public.worker_match_preferences (
 "worker_profile_id" uuid,
 "worker_account_id" uuid,
 "timezone" text DEFAULT 'Europe/Belgrade'::text,
 "approximate_lat" numeric(6,2),
 "approximate_lng" numeric(7,2),
 "proactive_notifications" boolean DEFAULT true,
 "same_day_urgent_notifications" boolean DEFAULT true,
 "buffer_minutes" integer DEFAULT 30,
 "created_at" timestamp with time zone DEFAULT statement_timestamp(),
 "updated_at" timestamp with time zone DEFAULT statement_timestamp(),
 PRIMARY KEY ("worker_profile_id")
);

CREATE TABLE private.marketplace_config(key text PRIMARY KEY,value jsonb);
CREATE TABLE proof.worlds(account_id uuid PRIMARY KEY,world text);
CREATE TABLE proof.calendar(worker_profile_id uuid,starts_at timestamptz,ends_at timestamptz);
CREATE TABLE proof.events(account_id uuid,event_type text,entity_id uuid);
CREATE FUNCTION private.account_visibility_world(p_id uuid) RETURNS text LANGUAGE sql STABLE AS $f$
 SELECT world FROM proof.worlds WHERE account_id=p_id
$f$;
CREATE FUNCTION private.identity_admitted(uuid) RETURNS boolean LANGUAGE sql STABLE AS $f$ SELECT false $f$;
CREATE FUNCTION private.worker_calendar_conflict(p_id uuid,p_start timestamptz,p_end timestamptz,p_except uuid)
 RETURNS boolean LANGUAGE sql STABLE AS $f$
 SELECT EXISTS(SELECT 1 FROM proof.calendar c WHERE c.worker_profile_id=p_id
   AND p_start<c.ends_at AND p_end>c.starts_at)
$f$;
-- Matching policy is separately proven. Feed actual manual wrapper the same
-- null timeTier that an expired task produces; do not turn it into a hard gate.
-- service/area=false intentionally show that those remain manual soft gates.
CREATE FUNCTION private.worker_need_fit_v1(nid uuid,pid uuid,p_live boolean)
 RETURNS jsonb LANGUAGE plpgsql STABLE AS $f$
BEGIN
 RETURN jsonb_build_object('service',false,'area',false,
   'timeTier',CASE WHEN private.need_search_time_admitted_v1(nid,statement_timestamp()) THEN 1 ELSE null END,
   'effectiveRadiusKm',null,'distanceKm',null);
END $f$;
CREATE FUNCTION private.emit_event(p_account uuid,p_role text,p_type text,p_entity text,p_id uuid,
 p_revision integer,p_title text,p_body text,p_key text,p_urgency text,p_payload jsonb,p_expires timestamptz DEFAULT null)
 RETURNS void LANGUAGE sql AS $f$
 INSERT INTO proof.events VALUES(p_account,p_type,p_id)
$f$;
CREATE FUNCTION private.audit_marketplace(uuid,text,text,uuid,integer,jsonb) RETURNS void LANGUAGE sql AS $f$ SELECT $f$;
CREATE FUNCTION private.enqueue_dispatch(uuid,timestamptz) RETURNS void LANGUAGE sql AS $f$ SELECT $f$;
\ir exact-dependencies.sql
\ir before.sql

CREATE FUNCTION proof.require(p_ok boolean,p_message text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',p_message;END IF;END $f$;
CREATE FUNCTION proof.id(p_number integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $f$
 SELECT ('00000000-0000-4000-8000-'||lpad(p_number::text,12,'0'))::uuid
$f$;
CREATE FUNCTION proof.actor(p_number integer) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM set_config('request.jwt.claim.sub',proof.id(p_number)::text,false);
END
$f$;
CREATE FUNCTION proof.reset(p_kind text DEFAULT 'FLEXIBLE',p_end timestamptz DEFAULT statement_timestamp()+interval '1 day',
 p_start timestamptz DEFAULT null,p_application_deadline timestamptz DEFAULT null,p_slots integer DEFAULT 3)
 RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
 TRUNCATE private.connection_activations,private.connection_policy_versions,private.response_application_snapshots,private.response_revision_resolution_commands,private.response_submit_commands,private.selection_commands,public.agreement_execution,public.agreement_versions,public.agreements,public.app_profiles,public.marketplace_response_versions,public.marketplace_responses,public.need_selections,public.needs,public.notification_deliveries,public.opportunity_deliveries,public.user_activity_events,public.worker_match_preferences,proof.worlds,proof.calendar,proof.events;
 INSERT INTO proof.worlds VALUES(proof.id(1),'TEST'),(proof.id(2),'TEST'),(proof.id(3),'TEST');
 INSERT INTO public.app_profiles(id,account_id,kind,profile_status,display_name,city,skills)
 VALUES(proof.id(101),proof.id(1),'REQUESTER','ACTIVE','Requester','Testograd',ARRAY[]::text[]),
  (proof.id(102),proof.id(2),'WORKER','ACTIVE','Worker one','Testograd',ARRAY['Test service']),
  (proof.id(103),proof.id(3),'WORKER','ACTIVE','Worker two','Testograd',ARRAY['Test service']);
 INSERT INTO public.needs(id,requester_account_id,requester_profile_id,status,mode,category,title,schedule_kind,
   starts_at,ends_at,response_deadline,published_at,task_timezone,execution_location_mode,required_slots)
 VALUES(proof.id(201),proof.id(1),proof.id(101),'PUBLISHED','OFFERS','Test service','Synthetic deadline task',p_kind,
   p_start,p_end,p_application_deadline,statement_timestamp(),'Europe/Belgrade','REMOTE',p_slots);
 INSERT INTO private.connection_policy_versions(policy_key,version,beneficiary_role,activation_reason,
   charge_mode,unit_basis,platform_cost_rsd,policy_snapshot)
 VALUES('REQUESTER_SELECTION_V1',1,'REQUESTER','SELECTION','PROMOTIONAL_FREE','HEADCOUNT',0,'{}');
 PERFORM proof.actor(2);
END $f$;
CREATE FUNCTION proof.submit(p_key text DEFAULT 'submit-test-0001',p_worker integer DEFAULT 2)
 RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM proof.actor(p_worker);
 RETURN public.rpc_submit_response(proof.id(201),1,proof.id(100+p_worker),1,1000,null,null,'',p_key);
END $f$;
CREATE FUNCTION proof.select_response(p_response uuid,p_key text DEFAULT 'select-test-0001') RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE v public.marketplace_response_versions;
BEGIN
 PERFORM proof.actor(1);
 SELECT ver.* INTO v FROM public.marketplace_response_versions ver
 JOIN public.marketplace_responses r ON r.id=ver.response_id AND r.current_version=ver.version WHERE r.id=p_response;
 RETURN public.rpc_select_response(proof.id(201),1,p_response,v.version,v.content_hash,p_key);
END $f$;
CREATE FUNCTION proof.reconfirm(p_response uuid,p_action text DEFAULT 'KEEP',p_key text DEFAULT 'reconfirm-test-0001')
 RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM proof.actor(2);
 RETURN public.rpc_resolve_stale_response_after_need_edit(p_response,1,2,p_key,p_action,1,1000,null,null,'');
END $f$;
CREATE FUNCTION proof.expect_error(p_statement text,p_sqlstate text,p_error text) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE got_state text;got_error text;
BEGIN
 BEGIN EXECUTE p_statement;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS got_state=RETURNED_SQLSTATE,got_error=MESSAGE_TEXT;
 END;
 PERFORM proof.require(got_state=p_sqlstate AND got_error=p_error,
   'EXPECTED '||p_sqlstate||'/'||p_error||' GOT '||coalesce(got_state,'SUCCESS')||'/'||coalesce(got_error,''));
END $f$;
CREATE TABLE proof.results(label text PRIMARY KEY,value jsonb);
SELECT proof.reset();
