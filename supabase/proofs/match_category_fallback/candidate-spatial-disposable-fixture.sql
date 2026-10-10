\set ON_ERROR_STOP on
-- Synthetic, reversible stand-in for only the geometric OPERATOR interface
-- of current PostGIS. The actual candidate SQL is unchanged, but the fake
-- 1D "geography" numbers are METERS and NOT a GIS or spatial-index proof.
BEGIN;
CREATE SCHEMA extensions;
CREATE DOMAIN extensions.geography AS numeric;
CREATE FUNCTION extensions.synthetic_distance(extensions.geography,extensions.geography)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $geometry$
 SELECT abs($1::numeric-$2::numeric)::double precision;
$geometry$;
CREATE OPERATOR extensions.<-> (
 LEFTARG=extensions.geography,RIGHTARG=extensions.geography,
 PROCEDURE=extensions.synthetic_distance);
CREATE FUNCTION extensions.ST_DWithin(
 a extensions.geography,b extensions.geography,max_distance double precision)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $geometry$
 SELECT abs(a::numeric-b::numeric)<=max_distance::numeric;
$geometry$;
ALTER TABLE public.needs DROP COLUMN approx_geog;
ALTER TABLE public.needs ADD COLUMN approx_geog extensions.geography;
ALTER TABLE public.worker_match_preferences
 ADD COLUMN approximate_geog extensions.geography,
 ADD COLUMN worker_account_id uuid;
UPDATE public.worker_match_preferences pref
 SET worker_account_id=p.account_id FROM public.app_profiles p
 WHERE p.id=pref.worker_profile_id;
ALTER TABLE public.user_activity_events ADD COLUMN created_at timestamptz
 NOT NULL DEFAULT statement_timestamp();
COMMIT;
