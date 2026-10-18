-- PREPARED ONLY. NOT wired to profile save, matcher, candidate stream, or any RPC.
-- Geometry library for the future signed coverage contract. No user/profile rows.
-- New private table moves the closure digest: deployment needs separate approval
-- and recertification. A test pass does not authorize this candidate on DEV.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create table private.worker_coverage_regions_v1 (
  catalog_version text not null check(length(catalog_version) between 1 and 100),
  region_id text not null check(length(region_id) between 1 and 160),
  country_code text not null check(country_code ~ '^[A-Z]{2}$'),
  label text not null check(length(btrim(label)) between 1 and 200),
  boundary extensions.geometry(MultiPolygon,4326) not null,
  source_uri text not null check(length(btrim(source_uri))>0),
  source_license text not null check(length(btrim(source_license))>0),
  primary key(catalog_version,region_id),
  check(extensions.ST_IsValid(boundary) and not extensions.ST_IsEmpty(boundary)),
  check(extensions.ST_XMin(boundary)>=-180 and extensions.ST_XMax(boundary)<=180
    and extensions.ST_YMin(boundary)>=-90 and extensions.ST_YMax(boundary)<=90)
);
alter table private.worker_coverage_regions_v1 enable row level security;
revoke all on private.worker_coverage_regions_v1 from public,anon,authenticated,service_role;
create index worker_coverage_regions_v1_boundary_gist
  on private.worker_coverage_regions_v1 using gist(boundary);
comment on table private.worker_coverage_regions_v1 is
  'Versioned non-personal region catalogue. Never overwrite a reviewed version; publish a new version. No catalogue is bundled or activated by this candidate.';

create function private.evaluate_worker_coverage_v1(p_areas jsonb,p_mode text,p_points jsonb)
returns jsonb language plpgsql stable security invoker set search_path='pg_catalog'
as $coverage$
declare
  a jsonb; pt jsonb; k text; cc text; idx integer; point_idx integer;
  lat numeric; lng numeric; uncertainty numeric; distance_m double precision;
  center extensions.geography; point_geog extensions.geography;
  region_geom extensions.geometry;
  area_matches jsonb; all_matches jsonb:='[]'::jsonb; uncertain boolean;
  catalog_country text;
begin
  -- Only geography is evaluated here. Caller must separately prove account,
  -- current signed review, service+mode, time and all normal hard exclusions.
  if p_mode='REMOTE' then
    return jsonb_build_object('area',true,'state','NOT_REQUIRED','matchedAreasByPoint','[]'::jsonb);
  end if;
  -- AREA_BASED needs the entire resolved footprint, not a made-up centroid.
  if p_mode is null or p_mode not in ('STATIONARY','POINT_TO_POINT','MULTI_STOP') then
    return jsonb_build_object('area',false,'state','LOCATION_REQUIRED');
  end if;
  if jsonb_typeof(p_areas) is distinct from 'array' then
    return jsonb_build_object('area',false,'state','COVERAGE_REQUIRED');
  end if;
  if jsonb_array_length(p_areas)=0 then
    return jsonb_build_object('area',false,'state','COVERAGE_REQUIRED');
  end if;
  if jsonb_array_length(p_areas)>32 then
    return jsonb_build_object('area',false,'state','INVALID_COVERAGE');
  end if;

  -- Validate the WHOLE selection first. A malformed/stale entry must not be
  -- silently ignored because another entry happened to cover the point.
  for a in select value from jsonb_array_elements(p_areas) loop
    if jsonb_typeof(a) is distinct from 'object' then
      return jsonb_build_object('area',false,'state','INVALID_COVERAGE');
    end if;
    k:=a->>'kind'; cc:=a->>'countryCode';
    if k is null or k not in ('COUNTRY','LOCAL_CIRCLE','ADMIN_REGION') or
      cc is null or cc !~ '^[A-Z]{2}$' then
      return jsonb_build_object('area',false,'state','INVALID_COVERAGE');
    end if;
    if k='COUNTRY' then
      if a - array['kind','countryCode'] <> '{}'::jsonb then
        return jsonb_build_object('area',false,'state','INVALID_COVERAGE');
      end if;
    elsif k='LOCAL_CIRCLE' then
      if a - array['kind','countryCode','latitude','longitude','radiusKm'] <> '{}'::jsonb
        or jsonb_typeof(a->'latitude') is distinct from 'number'
        or jsonb_typeof(a->'longitude') is distinct from 'number'
        or jsonb_typeof(a->'radiusKm') is distinct from 'number' then
        return jsonb_build_object('area',false,'state','INVALID_COVERAGE');
      end if;
      if (a->>'latitude')::numeric not between -90 and 90
        or (a->>'longitude')::numeric not between -180 and 180
        or (a->>'radiusKm')::numeric not between 1 and 200 then
        return jsonb_build_object('area',false,'state','INVALID_COVERAGE');
      end if;
    else
      if a - array['kind','countryCode','catalogVersion','regionId'] <> '{}'::jsonb
        or jsonb_typeof(a->'catalogVersion') is distinct from 'string'
        or jsonb_typeof(a->'regionId') is distinct from 'string' then
        return jsonb_build_object('area',false,'state','INVALID_COVERAGE');
      end if;
      select r.country_code into catalog_country from private.worker_coverage_regions_v1 r
        where r.catalog_version=a->>'catalogVersion' and r.region_id=a->>'regionId';
      if not found then
        return jsonb_build_object('area',false,'state','CATALOG_UNAVAILABLE');
      end if;
      if catalog_country<>cc then
        return jsonb_build_object('area',false,'state','INVALID_COVERAGE');
      end if;
    end if;
  end loop;

  if jsonb_typeof(p_points) is distinct from 'array' then
    return jsonb_build_object('area',false,'state','LOCATION_REQUIRED');
  end if;
  if jsonb_array_length(p_points)>32 or
    (p_mode='STATIONARY' and jsonb_array_length(p_points)<>1) or
    (p_mode='POINT_TO_POINT' and jsonb_array_length(p_points)<>2) or
    (p_mode='MULTI_STOP' and jsonb_array_length(p_points)<2) then
    return jsonb_build_object('area',false,'state','LOCATION_REQUIRED');
  end if;
  for pt in select value from jsonb_array_elements(p_points) loop
    if jsonb_typeof(pt) is distinct from 'object' then
      return jsonb_build_object('area',false,'state','LOCATION_REQUIRED');
    end if;
    if pt - array['countryCode','latitude','longitude','uncertaintyMeters'] <> '{}'::jsonb
      or coalesce(pt->>'countryCode','') !~ '^[A-Z]{2}$'
      or jsonb_typeof(pt->'latitude') is distinct from 'number'
      or jsonb_typeof(pt->'longitude') is distinct from 'number'
      or jsonb_typeof(pt->'uncertaintyMeters') is distinct from 'number' then
      return jsonb_build_object('area',false,'state','LOCATION_REQUIRED');
    end if;
    if (pt->>'latitude')::numeric not between -90 and 90
      or (pt->>'longitude')::numeric not between -180 and 180
      or (pt->>'uncertaintyMeters')::numeric not between 0 and 5000 then
      return jsonb_build_object('area',false,'state','LOCATION_REQUIRED');
    end if;
  end loop;

  point_idx:=0;
  for pt in select value from jsonb_array_elements(p_points) loop
    lat:=(pt->>'latitude')::numeric; lng:=(pt->>'longitude')::numeric;
    uncertainty:=(pt->>'uncertaintyMeters')::numeric;
    point_geog:=extensions.ST_SetSRID(extensions.ST_MakePoint(lng::float8,lat::float8),4326)::extensions.geography;
    area_matches:='[]'::jsonb; uncertain:=false; idx:=0;
    for a in select value from jsonb_array_elements(p_areas) loop
      if a->>'countryCode'=pt->>'countryCode' then
        if a->>'kind'='COUNTRY' then
          -- countryCode is a server-resolved identity, NEVER a model assertion
          -- or the worker's home country. No coordinates are inferred from text.
          area_matches:=area_matches||jsonb_build_array(idx);
        elsif a->>'kind'='LOCAL_CIRCLE' then
          center:=extensions.ST_SetSRID(extensions.ST_MakePoint((a->>'longitude')::float8,(a->>'latitude')::float8),4326)::extensions.geography;
          distance_m:=extensions.ST_Distance(center,point_geog);
          if distance_m+uncertainty <= (a->>'radiusKm')::numeric*1000 then
            area_matches:=area_matches||jsonb_build_array(idx);
          elsif distance_m-uncertainty <= (a->>'radiusKm')::numeric*1000 then
            uncertain:=true;
          end if;
        else
          select r.boundary into region_geom from private.worker_coverage_regions_v1 r
            where r.catalog_version=a->>'catalogVersion' and r.region_id=a->>'regionId';
          if extensions.ST_Covers(region_geom,point_geog::extensions.geometry) then
            if uncertainty=0 or extensions.ST_Distance(point_geog,
              extensions.ST_Boundary(region_geom)::extensions.geography)>=uncertainty then
              area_matches:=area_matches||jsonb_build_array(idx);
            else
              uncertain:=true;
            end if;
          elsif uncertainty>0 and extensions.ST_DWithin(region_geom::extensions.geography,point_geog,uncertainty::float8) then
            uncertain:=true;
          end if;
        end if;
      end if;
      idx:=idx+1;
    end loop;
    if jsonb_array_length(area_matches)=0 then
      return jsonb_build_object('area',false,'state',case when uncertain then 'LOCATION_REQUIRED' else 'OUTSIDE' end,
        'pointIndex',point_idx);
    end if;
    all_matches:=all_matches||jsonb_build_array(area_matches);
    point_idx:=point_idx+1;
  end loop;
  return jsonb_build_object('area',true,'state','MATCH','matchedAreasByPoint',all_matches);
end;
$coverage$;
revoke all on function private.evaluate_worker_coverage_v1(jsonb,text,jsonb) from public,anon,authenticated,service_role;
commit;
