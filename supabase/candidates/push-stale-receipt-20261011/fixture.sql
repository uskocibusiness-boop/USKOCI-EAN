-- Disposable PostgreSQL 16/17 fixtures. Never connect this to canonical DEV.
CREATE SCHEMA private;
CREATE SCHEMA vault;
CREATE TABLE vault.decrypted_secrets(name text, decrypted_secret text);
CREATE TABLE public.notification_push_attempts (
 id integer PRIMARY KEY, transport_state text NOT NULL, outcome text, error_code text,
 ticket_received_at timestamptz, lease_id uuid, lease_until timestamptz
);
INSERT INTO public.notification_push_attempts(id,transport_state,ticket_received_at,lease_until)
VALUES
 (1,'TICKET_PENDING','2026-09-26T16:11:48+00',NULL),
 (2,'TICKET_PENDING','2026-10-11T20:30:00+00',NULL),
 (3,'TICKET_PENDING','2026-09-26T16:11:48+00','2026-10-12T08:00:00+00'),
 (4,'PROVIDER_ACCEPTED','2026-09-26T16:11:48+00',NULL),
 (5,'TICKET_PENDING',NULL,NULL);
