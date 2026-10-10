\set ON_ERROR_STOP on
-- Stage 10: only synthetic table additions needed by the real
-- match_detail_without_calendar source; no actual profiles/needs.
BEGIN;
ALTER TABLE public.app_profiles ADD COLUMN rating_worker numeric;
ALTER TABLE public.worker_match_preferences
 ADD COLUMN same_day_urgent_notifications boolean NOT NULL DEFAULT true;
ALTER TABLE public.opportunity_deliveries
 ADD COLUMN created_at timestamptz NOT NULL DEFAULT statement_timestamp();
COMMIT;
