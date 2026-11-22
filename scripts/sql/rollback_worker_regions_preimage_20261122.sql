-- Rollback for worker_regions_20261122: restores the exact preimage bodies
-- (validate md5 8f1cd592eb48eb9da31e0af02c0bdd2e, fit md5 859d6f0a9ab940793b7cdab7ddbab2cd)
-- and removes the region objects. Saved profiles with REGION or more than five
-- areas must be edited first: the old validator rejects them on the next save.
BEGIN;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='worker_region_districts_v1' AND pronamespace='private'::regnamespace) IS NOT TRUE
  THEN RAISE EXCEPTION 'WORKER_REGIONS_ROLLBACK_NOT_APPLIED'; END IF;
END $guard$;

CREATE OR REPLACE FUNCTION private.validate_worker_areas_v1(areas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
declare a jsonb; seen text[]:='{}'; key text;
begin
 if jsonb_typeof(areas) is distinct from 'array' or jsonb_array_length(areas)>5 then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
 for a in select value from jsonb_array_elements(areas) loop
  if jsonb_typeof(a)<>'object' or a-array['kind','countryCode','label','city','sourceRef','latitude','longitude','radiusKm']<>'{}'
   or not a?&array['kind','countryCode','label','city','sourceRef','latitude','longitude','radiusKm']
   or jsonb_typeof(a->'kind')<>'string' or a->>'kind' not in ('COUNTRY','CITY','RADIUS') or a->>'countryCode' is distinct from 'RS'
   or jsonb_typeof(a->'label')<>'string' or length(a->>'label') not between 2 and 200 or a->>'label'~'[[:cntrl:]]'
  then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
  if a->>'kind'='COUNTRY' then
   if jsonb_array_length(areas)<>1 or a->>'label'<>'Cela Srbija'
    or a->'city'<>'null' or a->'sourceRef'<>'null' or a->'latitude'<>'null' or a->'longitude'<>'null' or a->'radiusKm'<>'null'
   then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
   key:='RS';
  else
   if jsonb_typeof(a->'city')<>'string' or length(a->>'city') not between 2 and 160 or a->>'city'~'[[:cntrl:]]'
    or jsonb_typeof(a->'sourceRef')<>'string' or a->>'sourceRef'!~'^osm:(node|way|relation):[1-9][0-9]{0,19}$'
    or jsonb_typeof(a->'latitude')<>'number' or jsonb_typeof(a->'longitude')<>'number'
   then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
   if (a->>'latitude')::numeric not between -90 and 90 or (a->>'longitude')::numeric not between -180 and 180
    or round((a->>'latitude')::numeric,2)<>(a->>'latitude')::numeric or round((a->>'longitude')::numeric,2)<>(a->>'longitude')::numeric
   then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
   if a->>'kind'='CITY' then
    if a->'radiusKm'<>'null' or a->>'label'<>a->>'city' then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
   else
    if jsonb_typeof(a->'radiusKm')<>'number' or a->>'radiusKm'!~'^([1-9]|[1-9][0-9]|1[0-9][0-9]|200)$'
      or a->>'label'<>((a->>'city')||' · do '||(a->>'radiusKm')||' km') then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
   end if;
   key:=a->>'sourceRef';
  end if;
  if key=any(seen) then raise exception 'WORKER_AREA_INVALID' using errcode='22023'; end if;
  seen:=array_append(seen,key);
 end loop;
 return areas;
end $function$;

CREATE OR REPLACE FUNCTION private.worker_area_fit_v1(areas jsonb, mode text, country text, city text, lat numeric, lng numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
declare a jsonb;
begin
 if jsonb_array_length(areas)=0 or mode='REMOTE' then return null; end if;
 if mode not in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED') or country is distinct from 'RS' then return false; end if;
 for a in select value from jsonb_array_elements(areas) loop
  if a->>'kind'='COUNTRY' then return true; end if;
  if a->>'kind'='CITY' and private.worker_area_city_key_v1(city)<>''
   and private.worker_area_city_key_v1(city)=private.worker_area_city_key_v1(a->>'city') then return true; end if;
  if a->>'kind'='RADIUS' and lat is not null and lng is not null
   and private.haversine_km(lat,lng,(a->>'latitude')::numeric,(a->>'longitude')::numeric)<=(a->>'radiusKm')::numeric then return true; end if;
 end loop;
 return false;
end $function$;

DROP FUNCTION private.rs_district_at_v1(numeric, numeric);
DROP FUNCTION private.worker_region_label_v1(text);
DROP FUNCTION private.worker_region_districts_v1(text);
DROP TABLE private.rs_district_boundary;

DO $post$
BEGIN
  IF md5((SELECT prosrc FROM pg_proc WHERE oid='private.validate_worker_areas_v1(jsonb)'::regprocedure))<>'8f1cd592eb48eb9da31e0af02c0bdd2e'
  OR md5((SELECT prosrc FROM pg_proc WHERE oid='private.worker_area_fit_v1(jsonb,text,text,text,numeric,numeric)'::regprocedure))<>'859d6f0a9ab940793b7cdab7ddbab2cd'
  THEN RAISE EXCEPTION 'WORKER_REGIONS_ROLLBACK_POSTIMAGE'; END IF;
END $post$;

COMMIT;
