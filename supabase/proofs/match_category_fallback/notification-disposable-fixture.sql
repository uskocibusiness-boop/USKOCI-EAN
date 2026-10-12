\set ON_ERROR_STOP on
-- Stage 9 runs the REAL DEV emit_event SQL in disposable PostgreSQL only.
-- These preferences/delivery tables are fake; no push token, HTTP client,
-- Firebase, Expo or external queue is present in this database.
BEGIN;
ALTER TABLE public.user_activity_events
 ADD COLUMN recipient_role text NOT NULL DEFAULT 'WORKER',
 ADD COLUMN entity_type text NOT NULL DEFAULT 'NEED',
 ADD COLUMN urgency text NOT NULL DEFAULT 'NORMAL',
 ADD COLUMN payload jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE public.notification_preferences (
 user_id uuid NOT NULL, role_context text NOT NULL,
 in_app_enabled boolean NOT NULL DEFAULT true,
 push_enabled boolean NOT NULL DEFAULT false,
 opportunities_enabled boolean NOT NULL DEFAULT true,
 responses_enabled boolean NOT NULL DEFAULT true,
 dogovor_enabled boolean NOT NULL DEFAULT true,
 execution_enabled boolean NOT NULL DEFAULT true,
 recovery_enabled boolean NOT NULL DEFAULT true,
 account_enabled boolean NOT NULL DEFAULT true,
 quiet_hours_enabled boolean NOT NULL DEFAULT false,
 quiet_start time, quiet_end time,
 quiet_timezone text NOT NULL DEFAULT 'Europe/Belgrade',
 urgent_overrides_quiet_hours boolean NOT NULL DEFAULT false,
 PRIMARY KEY (user_id,role_context));
CREATE TABLE public.notification_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL, recipient_user_id uuid NOT NULL,
 recipient_role text NOT NULL, channel text NOT NULL,
 priority text NOT NULL, state text NOT NULL,
 suppression_reason text,title text NOT NULL,body text NOT NULL,
 dedupe_key text NOT NULL UNIQUE,expires_at timestamptz);
INSERT INTO public.notification_preferences
(user_id,role_context,in_app_enabled,push_enabled,opportunities_enabled)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','WORKER',true,true,true);
COMMIT;
