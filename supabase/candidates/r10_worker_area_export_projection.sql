-- R10_WORK_AREAS_LOCAL_ONLY: narrow successor to the unapplied WAR01 export helper.
-- No hosted execution, certificate admission, retention activation or ACL change.
-- Verify current consumer/dependency capture and closure/export admission separately.
BEGIN;
DO $guard$
DECLARE p record;
BEGIN
 IF current_setting('uskoci.r10.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
 THEN RAISE EXCEPTION 'R10_WORK_AREAS_LOCAL_ONLY' USING errcode='55000'; END IF;
 SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('private.data_export_worker_candidate_v5(jsonb)');
 IF p.oid IS NULL OR pg_catalog.md5(p.prosrc)<>'aa9c5f1b7ab4711cda7cb16905de55a4'
 OR pg_catalog.pg_get_userbyid(p.proowner)<>'postgres'
 OR p.prosecdef OR p.provolatile<>'i'
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
 OR p.proacl::text IS DISTINCT FROM '{postgres=X/postgres}'
 THEN RAISE EXCEPTION 'R10_WORK_AREAS_PREIMAGE_DRIFT'; END IF;
END $guard$;

-- TESTABLE FUNCTION BEGINS
CREATE OR REPLACE FUNCTION private.data_export_worker_candidate_v5(v jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$ select jsonb_build_object('displayName',private.data_export_scalar_v5(v->'displayName','string'),'bio',private.data_export_scalar_v5(v->'bio','string'),'skills',private.data_export_array_v5(v->'skills','string'),'tools',private.data_export_array_v5(v->'tools','string'),'licenses',private.data_export_array_v5(v->'licenses','string'),'vehicles',private.data_export_array_v5(v->'vehicles','string'),'teamCapacity',private.data_export_scalar_v5(v->'teamCapacity','number'),'workAreas',coalesce((select jsonb_agg(jsonb_build_object('kind',private.data_export_scalar_v5(a->'kind','string'),'countryCode',private.data_export_scalar_v5(a->'countryCode','string'),'label',private.data_export_scalar_v5(a->'label','string'),'city',private.data_export_scalar_v5(a->'city','string'),'sourceRef',private.data_export_scalar_v5(a->'sourceRef','string'),'latitude',private.data_export_scalar_v5(a->'latitude','number'),'longitude',private.data_export_scalar_v5(a->'longitude','number'),'radiusKm',private.data_export_scalar_v5(a->'radiusKm','number')) order by ordinal) from jsonb_array_elements(case when jsonb_typeof(v->'workAreas')='array' then v->'workAreas' else '[]'::jsonb end) with ordinality x(a,ordinal) where jsonb_typeof(a)='object'),'[]'::jsonb),'location',jsonb_build_object('operatingCountryCode',private.data_export_scalar_v5(v#>'{location,operatingCountryCode}','string'),'city',private.data_export_scalar_v5(v#>'{location,city}','string'),'radiusKm',private.data_export_scalar_v5(v#>'{location,radiusKm}','number'),'approximatePosition',jsonb_build_object('latitude',private.data_export_scalar_v5(v#>'{location,approximatePosition,latitude}','number'),'longitude',private.data_export_scalar_v5(v#>'{location,approximatePosition,longitude}','number'))),'availability',jsonb_build_object('timezone',private.data_export_scalar_v5(v#>'{availability,timezone}','string'),'availableNow',private.data_export_scalar_v5(v#>'{availability,availableNow}','boolean'),'rules',coalesce((select jsonb_agg(jsonb_build_object('id',private.data_export_scalar_v5(x->'id','string'),'startTime',private.data_export_scalar_v5(x->'startTime','string'),'endTime',private.data_export_scalar_v5(x->'endTime','string'),'startsOn',private.data_export_scalar_v5(x->'startsOn','string'),'endsOn',private.data_export_scalar_v5(x->'endsOn','string'),'label',private.data_export_scalar_v5(x->'label','string'),'active',private.data_export_scalar_v5(x->'active','boolean'),'weekdays',private.data_export_array_v5(x->'weekdays','number')) order by ordinal) from jsonb_array_elements(case when jsonb_typeof(v#>'{availability,rules}')='array' then v#>'{availability,rules}' else '[]'::jsonb end) with ordinality as a(x,ordinal) where jsonb_typeof(x)='object'),'[]'::jsonb),'windows',coalesce((select jsonb_agg(jsonb_build_object('id',private.data_export_scalar_v5(x->'id','string'),'startsAt',private.data_export_scalar_v5(x->'startsAt','string'),'endsAt',private.data_export_scalar_v5(x->'endsAt','string'),'state',private.data_export_scalar_v5(x->'state','string'),'label',private.data_export_scalar_v5(x->'label','string')) order by ordinal) from jsonb_array_elements(case when jsonb_typeof(v#>'{availability,windows}')='array' then v#>'{availability,windows}' else '[]'::jsonb end) with ordinality as a(x,ordinal) where jsonb_typeof(x)='object'),'[]'::jsonb))) $function$;
-- TESTABLE FUNCTION ENDS

-- CREATE OR REPLACE preserves owner/ACL. This changes the dynamic projection/source
-- digests. Do not set readiness flags or copy those hashes into certificates here.
COMMIT;
