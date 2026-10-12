-- All rows and accounts below are synthetic. Never run this on Supabase.
CREATE SCHEMA private;
CREATE TABLE public.needs (
 id uuid primary key, schedule_kind text not null, starts_at timestamptz,
 ends_at timestamptz, published_at timestamptz,
 response_deadline timestamptz, task_timezone text
);
CREATE FUNCTION private.availability_timezone_valid(value text)
 RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT value='Europe/Belgrade';
$fn$;
-- Real deployed relative schedule end SQL follows (read-only snapshot).
CREATE OR REPLACE FUNCTION private.relative_schedule_end_v5(p_kind text, p_published_at timestamp with time zone, p_timezone text)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when p_published_at is null or not isfinite(p_published_at) then null
    when p_kind = 'TODAY_FLEXIBLE'
      then (date_trunc('day', p_published_at at time zone tz) + interval '1 day') at time zone tz
    when p_kind = 'TOMORROW_FLEXIBLE'
      then (date_trunc('day', p_published_at at time zone tz) + interval '2 days') at time zone tz
    when p_kind = 'WEEK_FLEXIBLE'
      then (date_trunc('week', p_published_at at time zone tz) + interval '1 week') at time zone tz
  end
  from (select case when private.availability_timezone_valid(p_timezone)
    then p_timezone else 'Europe/Belgrade' end as tz) resolved
$function$;

INSERT INTO public.needs (id,schedule_kind,starts_at,ends_at,published_at,response_deadline,task_timezone)
VALUES
('11111111-1111-4111-8111-111111111111','WEEK_FLEXIBLE',NULL,'2027-01-01T00:00:00+01','2026-10-10T10:00:00+02',NULL,'Europe/Belgrade'),
('22222222-2222-4222-8222-222222222222','WEEK_FLEXIBLE',NULL,NULL,'2026-10-10T10:00:00+02',NULL,'Europe/Belgrade'),
('33333333-3333-4333-8333-333333333333','TODAY_FLEXIBLE',NULL,'2026-10-20T12:00:00+02','2026-10-10T10:00:00+02',NULL,'Europe/Belgrade'),
('44444444-4444-4444-8444-444444444444','FLEXIBLE',NULL,'2026-10-16T23:59:00+02','2026-10-10T10:00:00+02',NULL,'Europe/Belgrade'),
('55555555-5555-4555-8555-555555555555','WEEK_FLEXIBLE',NULL,'2026-10-16T23:59:00+02','2026-10-10T10:00:00+02','2026-10-12T12:00:00+02','Europe/Belgrade'),
('66666666-6666-4666-8666-666666666666','FIXED_WINDOW','2026-10-12T07:00:00+02','2026-10-12T09:00:00+02','2026-10-10T10:00:00+02',NULL,'Europe/Belgrade'),
('77777777-7777-4777-8777-777777777777','FIXED_WINDOW','2026-10-12T09:00:00+02','2026-10-12T07:00:00+02','2026-10-10T10:00:00+02',NULL,'Europe/Belgrade'),
('88888888-8888-4888-8888-888888888888','UNKNOWN',NULL,NULL,'2026-10-10T10:00:00+02',NULL,'Europe/Belgrade');
