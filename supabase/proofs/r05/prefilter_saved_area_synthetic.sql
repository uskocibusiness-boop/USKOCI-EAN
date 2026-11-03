-- R05/F18 reproducible synthetic false-negative pair.
-- NO business/Auth rows, no writes, no real user/profile coordinates.
-- Direct PostGIS ST_DWithin prefilter versus current signed-area evaluator.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL statement_timeout='15s';
WITH synthetic AS (
 SELECT extensions.ST_SetSRID(extensions.ST_MakePoint(19.66,46.10),4326)::extensions.geography AS stale_profile_geog,
        extensions.ST_SetSRID(extensions.ST_MakePoint(21.95,42.99),4326)::extensions.geography AS need_start_geog
)
SELECT jsonb_build_object(
 'unit','R05_PREFILTER_SAVED_AREA_SYNTHETIC_PAIR','format_version',1,
 'read_only',current_setting('transaction_read_only'),
 'old_point_within_300km',(SELECT extensions.ST_DWithin(stale_profile_geog,need_start_geog,300000.0) FROM synthetic),
 'old_point_distance_km',(SELECT round((extensions.ST_Distance(stale_profile_geog,need_start_geog)/1000)::numeric,1) FROM synthetic),
 'signed_country_fit',private.worker_area_fit_v1('[{"kind":"COUNTRY","countryCode":"RS"}]'::jsonb,
   'STATIONARY','RS','Leskovac',42.99,21.95),
 'signed_city_fit',private.worker_area_fit_v1('[{"kind":"CITY","countryCode":"RS","city":"Leskovac"}]'::jsonb,
   'STATIONARY','RS','Leskovac',42.99,21.95),
 'signed_radius_fit',private.worker_area_fit_v1('[{"kind":"RADIUS","countryCode":"RS","latitude":42.99,"longitude":21.95,"radiusKm":20}]'::jsonb,
   'STATIONARY','RS','Leskovac',42.99,21.95),
 'different_city_fit',private.worker_area_fit_v1('[{"kind":"CITY","countryCode":"RS","city":"Novi Sad"}]'::jsonb,
   'STATIONARY','RS','Leskovac',42.99,21.95),
 'remote_fit',private.worker_area_fit_v1('[{"kind":"COUNTRY","countryCode":"RS"}]'::jsonb,
   'REMOTE','RS','Leskovac',42.99,21.95)
) AS capture;
ROLLBACK;
