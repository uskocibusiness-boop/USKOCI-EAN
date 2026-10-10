\set ON_ERROR_STOP on
-- Disposable Postgres ONLY. Extend fake matcher schema enough for real
-- dispatch_next_wave, with NO production notifications/provider/storage.
BEGIN;
ALTER TABLE public.needs
 ADD COLUMN status text NOT NULL DEFAULT 'PUBLISHED',
 ADD COLUMN required_slots integer NOT NULL DEFAULT 1,
 ADD COLUMN remaining_search_closed_at timestamptz,
 ADD COLUMN response_deadline timestamptz,
 ADD COLUMN urgent boolean NOT NULL DEFAULT false,
 ADD COLUMN urgent_expires_at timestamptz,
 ADD COLUMN title text NOT NULL DEFAULT 'Sintetički posao - test',
 ADD COLUMN approx_geog text;
CREATE TABLE public.need_selections (
 need_id uuid NOT NULL, status text NOT NULL, covered_slots integer NOT NULL);
CREATE TABLE public.marketplace_responses (
 need_id uuid NOT NULL, submitted_against_need_revision integer NOT NULL,
 status text NOT NULL, covered_slots integer NOT NULL);
CREATE TABLE public.dispatch_rounds (
 id uuid PRIMARY KEY, need_id uuid NOT NULL, need_revision integer NOT NULL,
 round_no integer NOT NULL, urgency text NOT NULL,
 batch_size integer NOT NULL, target_responses integer NOT NULL,
 candidate_limit_used integer NOT NULL, budget_source text,
 status text NOT NULL, deadline_at timestamptz NOT NULL, stop_reason text);
ALTER TABLE public.opportunity_deliveries
 ADD COLUMN worker_profile_id uuid,
 ADD COLUMN dispatch_round_id uuid,
 ADD COLUMN match_score numeric,
 ADD COLUMN score_components jsonb,
 ADD COLUMN reason_codes text[],
 ADD COLUMN status text,
 ADD COLUMN expires_at timestamptz;
ALTER TABLE public.opportunity_deliveries
 ADD CONSTRAINT synthetic_opportunity_dedupe UNIQUE(worker_account_id,need_id,need_revision);
CREATE TABLE public.user_activity_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipient_user_id uuid NOT NULL, event_type text NOT NULL,
 entity_id uuid NOT NULL, entity_version integer NOT NULL,
 dedupe_key text NOT NULL UNIQUE);
INSERT INTO private.marketplace_config(key,value) VALUES
 ('dispatch_normal','{"waveSizes":[5,5,10,20],"targetResponses":2,"windowMinutes":30}'::jsonb),
 ('dispatch_urgent','{"waveSizes":[10,10,20],"targetResponses":2,"windowMinutes":15}'::jsonb),
 ('match_v1_dispatch','{"mode":"ALL","ceiling":10,"validMinutes":1440,"workerDailyCap":1000,"workerNotifyPerTransaction":50,"remoteWaves":false}'::jsonb);
-- These THREE adapters are synthetic. They preserve the same function
-- entrypoint and return shape, but DO NOT validate full candidate geo/KNN,
-- production match-detail scoring, notifications or push transport.
CREATE FUNCTION private.candidate_profile_ids_v1b(nid uuid,p_limit integer,p_cap integer)
RETURNS TABLE(worker_profile_id uuid)
LANGUAGE sql STABLE SET search_path TO 'pg_catalog' AS $stub$
 select p.id from public.app_profiles p
 where p.kind='WORKER' and p.profile_status='ACTIVE'
   and private.dispatch_cheap_candidate_admitted(nid,p.id)
 order by p.id limit greatest(0,coalesce(p_limit,0));
$stub$;
CREATE FUNCTION private.match_detail(nid uuid,pid uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'pg_catalog' AS $stub$
DECLARE fit jsonb;
BEGIN
 fit:=private.worker_need_fit_v1(nid,pid,false);
 RETURN jsonb_build_object('dispatchEligible',coalesce((fit->>'matches')::boolean,false),
   'timeTier',(fit->>'timeTier')::integer,
   'score',77.0,'scoreComponents','{}'::jsonb,'reasonCodes','[]'::jsonb,
   'distanceToStartKm',fit->'distanceKm',
   'effectiveRadiusKm',fit->'effectiveRadiusKm',
   'distanceSource','SYNTHETIC_ADAPTER',
   'taskLocationMode','STATIONARY');
END $stub$;
CREATE FUNCTION private.emit_event(
 p_recipient uuid,p_role text,p_event_type text,p_entity_type text,
 p_entity_id uuid,p_entity_version integer,p_title text,p_body text,
 p_dedupe_key text,p_urgency text DEFAULT 'NORMAL',
 p_payload jsonb DEFAULT '{}'::jsonb,p_expires_at timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SET search_path TO 'pg_catalog' AS $stub$
DECLARE event_id uuid;
BEGIN
 -- SIMULATION ONLY: a local synthetic row replaces production delivery.
 INSERT INTO public.user_activity_events(recipient_user_id,event_type,entity_id,entity_version,dedupe_key)
 VALUES(p_recipient,p_event_type,p_entity_id,p_entity_version,p_dedupe_key)
 ON CONFLICT(dedupe_key) DO NOTHING RETURNING id INTO event_id;
 RETURN event_id;
END $stub$;
COMMIT;
