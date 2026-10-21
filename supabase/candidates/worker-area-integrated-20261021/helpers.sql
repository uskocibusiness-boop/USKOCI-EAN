-- WAR01 uses existing immutable review/save records as the only area authority.
-- No sidecar personal-data table; export and erasure inherit existing ownership.
create function private.worker_saved_areas_v1(aid uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog as $f$
 select coalesce((select r.envelope#>'{profile,workAreas}' from private.worker_ai_saves s
 join private.worker_ai_reviews r on r.id=s.review_id and r.account_id=s.account_id
 where s.account_id=aid order by s.created_at desc,s.review_id desc limit 1),'[]'::jsonb);
$f$;
revoke all on function private.worker_saved_areas_v1(uuid) from public,anon,authenticated,service_role;

create function private.worker_saved_remote_only_v1(aid uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $f$
 select coalesce((select r.envelope->>'classificationState'='READY'
 and jsonb_array_length(r.envelope->'reviewedServiceModes')>0
 and not exists(select 1 from jsonb_array_elements(r.envelope->'reviewedServiceModes') m where m->>'mode'<>'REMOTE')
 from private.worker_ai_saves s join private.worker_ai_reviews r on r.id=s.review_id and r.account_id=s.account_id
 where s.account_id=aid order by s.created_at desc,s.review_id desc limit 1),false);
$f$;
revoke all on function private.worker_saved_remote_only_v1(uuid) from public,anon,authenticated,service_role;

create function private.validate_worker_areas_v1(areas jsonb) returns jsonb
language plpgsql immutable set search_path=pg_catalog as $f$
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
end $f$;
revoke all on function private.validate_worker_areas_v1(jsonb) from public,anon,authenticated,service_role;

create function private.worker_area_city_key_v1(value text) returns text
language sql immutable set search_path=pg_catalog as $f$
 select regexp_replace(translate(replace(replace(replace(lower(btrim(coalesce(value,''))),'љ','lj'),'њ','nj'),'џ','dz'),
 'абвгдђежзијклмнопрстћуфхцчшčćšžđ','abvgddezzijklmnoprstcufhccsccszd'),'\s+',' ','g');
$f$;
revoke all on function private.worker_area_city_key_v1(text) from public,anon,authenticated,service_role;

create function private.worker_area_fit_v1(areas jsonb,mode text,country text,city text,lat numeric,lng numeric) returns boolean
language plpgsql stable set search_path=pg_catalog as $f$
declare a jsonb;
begin
 if jsonb_array_length(areas)=0 or mode='REMOTE' then return null; end if;
 -- Route endpoints require their own proof; a city/country is not route consent.
 if mode is distinct from 'STATIONARY' or country is distinct from 'RS' then return false; end if;
 for a in select value from jsonb_array_elements(areas) loop
  if a->>'kind'='COUNTRY' then return true; end if;
  if a->>'kind'='CITY' and private.worker_area_city_key_v1(city)<>''
   and private.worker_area_city_key_v1(city)=private.worker_area_city_key_v1(a->>'city') then return true; end if;
  if a->>'kind'='RADIUS' and lat is not null and lng is not null
   and private.haversine_km(lat,lng,(a->>'latitude')::numeric,(a->>'longitude')::numeric)<=(a->>'radiusKm')::numeric then return true; end if;
 end loop;
 return false;
end $f$;
revoke all on function private.worker_area_fit_v1(jsonb,text,text,text,numeric,numeric) from public,anon,authenticated,service_role;
