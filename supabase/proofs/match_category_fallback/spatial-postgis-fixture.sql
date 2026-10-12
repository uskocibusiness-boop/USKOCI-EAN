\set ON_ERROR_STOP on
-- This file is for a separate fresh PG16 + REAL PostGIS image, with PostGIS
-- installed under "extensions"; no fake distance operator or geography domain.
BEGIN;
ALTER TABLE public.needs
 ADD COLUMN approx_geog extensions.geography;
ALTER TABLE public.worker_match_preferences
 ADD COLUMN approximate_geog extensions.geography,
 ADD COLUMN worker_account_id uuid;
UPDATE public.worker_match_preferences pref
 SET worker_account_id = p.account_id FROM public.app_profiles p
 WHERE pref.worker_profile_id=p.id;
CREATE TABLE public.user_activity_events (
 recipient_user_id uuid NOT NULL, recipient_role text NOT NULL,
 event_type text NOT NULL, urgency text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp());
COMMIT;
