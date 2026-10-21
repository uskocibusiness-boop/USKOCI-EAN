-- MULTI_LOCALITY shadow candidate. Not a migration or active worker coverage.
-- Run after 00_country_rs_core.sql inside ONE transaction ending ROLLBACK.
-- Human city words must be resolved to vetted place IDs by a future server
-- authority, displayed with radii, signed and atomically saved. None exists yet.

do $pre$
begin
  if to_regclass('private.worker_area_place_catalog_v2') is not null
    or to_regclass('private.worker_multi_locality_scope_v2') is not null
    or to_regclass('private.worker_multi_locality_area_v2') is not null
  then raise exception 'WORKER_MULTI_LOCALITY_ALREADY_EXISTS'; end if;
  if to_regclass('private.worker_country_scope_v2') is null
    or to_regprocedure('private.haversine_km(numeric,numeric,numeric,numeric)') is null
  then raise exception 'WORKER_MULTI_LOCALITY_PREDECESSOR_MISSING'; end if;
end $pre$;

-- A versioned, immutable server-vetted place anchor. No production places are
-- seeded by this candidate. Synthetic test places exist only until ROLLBACK.
create table private.worker_area_place_catalog_v2 (
  place_id uuid primary key,
  country_code text not null check (country_code = 'RS'),
  canonical_label text not null check (length(btrim(canonical_label)) between 2 and 100),
  center_lat numeric(9,6) not null check (center_lat between -90 and 90),
  center_lng numeric(9,6) not null check (center_lng between -180 and 180),
  source_system text not null check (length(btrim(source_system)) between 2 and 64),
  source_ref text not null check (length(btrim(source_ref)) between 2 and 160),
  catalog_revision integer not null check (catalog_revision > 0),
  verified_at timestamptz not null,
  unique(source_system,source_ref,catalog_revision),
  unique(place_id,catalog_revision)
);
alter table private.worker_area_place_catalog_v2 enable row level security;
alter table private.worker_area_place_catalog_v2 force row level security;
revoke all on private.worker_area_place_catalog_v2 from public, anon, authenticated, service_role;

create function private.worker_area_place_immutable_v2()
returns trigger language plpgsql set search_path = pg_catalog as $f$
begin
  raise exception 'WORKER_AREA_PLACE_IMMUTABLE' using errcode = '42501';
end $f$;
create trigger worker_area_place_immutable_v2 before update or delete
on private.worker_area_place_catalog_v2 for each row
execute function private.worker_area_place_immutable_v2();
revoke all on function private.worker_area_place_immutable_v2() from public, anon, authenticated, service_role;

create table private.worker_multi_locality_scope_v2 (
  profile_id uuid primary key references public.app_profiles(id) on delete cascade,
  account_id uuid not null unique references public.app_accounts(id) on delete cascade,
  source_review_id uuid not null,
  displayed_digest text not null check (displayed_digest ~ '^[0-9a-f]{64}$'),
  source_revision integer not null check (source_revision >= 0),
  saved_at timestamptz not null default clock_timestamp()
);
alter table private.worker_multi_locality_scope_v2 enable row level security;
alter table private.worker_multi_locality_scope_v2 force row level security;
revoke all on private.worker_multi_locality_scope_v2 from public, anon, authenticated, service_role;

create function private.worker_multi_locality_owner_guard_v2()
returns trigger language plpgsql security definer set search_path = pg_catalog as $f$
begin
  if not exists (
    select 1 from public.app_profiles p
    where p.id = new.profile_id and p.account_id = new.account_id
      and p.kind = 'WORKER' and p.profile_status in ('DRAFT','ACTIVE')
  ) then raise exception 'WORKER_MULTI_LOCALITY_OWNER_MISMATCH' using errcode = '42501'; end if;
  return new;
end $f$;
create trigger worker_multi_locality_owner_guard_v2 before insert or update
on private.worker_multi_locality_scope_v2 for each row
execute function private.worker_multi_locality_owner_guard_v2();
revoke all on function private.worker_multi_locality_owner_guard_v2() from public, anon, authenticated, service_role;

create table private.worker_multi_locality_area_v2 (
  profile_id uuid not null references private.worker_multi_locality_scope_v2(profile_id) on delete cascade,
  ordinal smallint not null check (ordinal between 1 and 5),
  place_id uuid not null,
  catalog_revision integer not null,
  radius_km smallint not null check (radius_km between 5 and 200),
  primary key(profile_id,ordinal),
  unique(profile_id,place_id),
  foreign key(place_id,catalog_revision)
    references private.worker_area_place_catalog_v2(place_id,catalog_revision)
);
alter table private.worker_multi_locality_area_v2 enable row level security;
alter table private.worker_multi_locality_area_v2 force row level security;
revoke all on private.worker_multi_locality_area_v2 from public, anon, authenticated, service_role;

-- This validates server-resolved IDs, not free-form language. A future Save
-- must separately verify a current signed review and write the exact ordered
-- selection with its digest. Unsupported ADMIN_REGION fails closed.
create function private.worker_multi_locality_candidate_v2(candidate jsonb)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $f$
declare raw_areas jsonb; raw_area jsonb; place_uuid uuid;
  place private.worker_area_place_catalog_v2; normalized jsonb := '[]'::jsonb;
  used_ids uuid[] := '{}'::uuid[]; radius integer;
begin
  if jsonb_typeof(candidate) is distinct from 'object' then
    raise exception 'WORKER_MULTI_LOCALITY_CANDIDATE_INVALID' using errcode = '22023';
  end if;
  if not candidate ? 'areas' then return null; end if;
  raw_areas := candidate->'areas';
  if jsonb_typeof(raw_areas) is distinct from 'array'
    or jsonb_array_length(raw_areas) not between 1 and 5
  then raise exception 'WORKER_MULTI_LOCALITY_CANDIDATE_INVALID' using errcode = '22023'; end if;
  for raw_area in select value from jsonb_array_elements(raw_areas) loop
    if jsonb_typeof(raw_area) is distinct from 'object'
      or raw_area - array['kind','placeId','radiusKm','scope'] <> '{}'::jsonb
      or not (raw_area ?& array['kind','placeId','radiusKm','scope'])
      or raw_area->>'kind' is distinct from 'LOCALITY_RADIUS'
      or raw_area->>'scope' is distinct from 'ON_SITE'
      or jsonb_typeof(raw_area->'radiusKm') is distinct from 'number'
      or (raw_area->>'radiusKm') !~ '^[0-9]{1,3}$'
    then raise exception 'WORKER_MULTI_LOCALITY_CANDIDATE_INVALID' using errcode = '22023'; end if;
    radius := (raw_area->>'radiusKm')::integer;
    if radius not between 5 and 200 then
      raise exception 'WORKER_MULTI_LOCALITY_RADIUS_UNRESOLVED' using errcode = '22023';
    end if;
    begin place_uuid := (raw_area->>'placeId')::uuid;
    exception when invalid_text_representation then
      raise exception 'WORKER_MULTI_LOCALITY_PLACE_UNRESOLVED' using errcode = '22023';
    end;
    if place_uuid = any(used_ids) then
      raise exception 'WORKER_MULTI_LOCALITY_DUPLICATE_PLACE' using errcode = '22023';
    end if;
    select * into place from private.worker_area_place_catalog_v2
      where place_id = place_uuid and country_code = 'RS';
    if not found then
      raise exception 'WORKER_MULTI_LOCALITY_PLACE_UNRESOLVED' using errcode = '22023';
    end if;
    used_ids := array_append(used_ids,place_uuid);
    normalized := normalized || jsonb_build_array(jsonb_build_object(
      'kind','LOCALITY_RADIUS','placeId',place.place_id,
      'countryCode',place.country_code,'label',place.canonical_label,
      'catalogRevision',place.catalog_revision,'radiusKm',radius,'scope','ON_SITE'));
  end loop;
  return jsonb_build_object('areas',normalized,'effectiveSource','MULTI_LOCALITY_SHADOW',
    'candidateOnly',true);
end $f$;
revoke all on function private.worker_multi_locality_candidate_v2(jsonb) from public, anon, authenticated, service_role;

-- A task's public coarse point is the only coordinate read here; exact
-- addresses remain in need_sensitive. Remote uses the existing handoff path.
create function private.worker_multi_locality_task_fit_v2(
  mode text, task_country text, task_lat numeric, task_lng numeric,
  center_lat numeric, center_lng numeric, radius_km integer)
returns boolean language sql stable set search_path = pg_catalog as $f$
  select case
    when mode = 'REMOTE' then null
    when mode <> 'STATIONARY' or mode is null or task_country is distinct from 'RS'
      or task_lat is null or task_lng is null then false
    else coalesce(private.haversine_km(task_lat,task_lng,center_lat,center_lng)
      <= radius_km,false)
  end;
$f$;
revoke all on function private.worker_multi_locality_task_fit_v2(text,text,numeric,numeric,numeric,numeric,integer)
  from public, anon, authenticated, service_role;

create function private.worker_multi_locality_match_v2(need_id uuid, worker_profile_id uuid)
returns boolean language plpgsql stable security definer set search_path = pg_catalog as $f$
declare n public.needs; admitted boolean;
begin
  if not exists(select 1 from private.worker_multi_locality_scope_v2
    where profile_id = worker_profile_id) then return null; end if;
  select * into n from public.needs where id = need_id;
  if not found then return false; end if;
  if n.execution_location_mode = 'REMOTE' then return null; end if;
  -- Two active shadow receipts would be ambiguous. Future Save must replace
  -- one with the other atomically; this helper fails closed until then.
  if exists(select 1 from private.worker_country_scope_v2
    where profile_id = worker_profile_id) then return false; end if;
  select exists(
    select 1 from private.worker_multi_locality_area_v2 a
    join private.worker_area_place_catalog_v2 c
      on c.place_id = a.place_id and c.catalog_revision = a.catalog_revision
    where a.profile_id = worker_profile_id
      and private.worker_multi_locality_task_fit_v2(
        n.execution_location_mode,n.task_country_code,n.approximate_lat,n.approximate_lng,
        c.center_lat,c.center_lng,a.radius_km) is true
  ) into admitted;
  return admitted;
end $f$;
revoke all on function private.worker_multi_locality_match_v2(uuid,uuid)
  from public, anon, authenticated, service_role;

create function public.rpc_read_worker_multi_locality_candidate_v2(p_profile_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $f$
declare u uuid := auth.uid(); p public.app_profiles;
  h private.worker_multi_locality_scope_v2; selected jsonb; has_scope boolean;
begin
  if u is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  perform private.closure_assert_open(u);
  select * into p from public.app_profiles where id = p_profile_id
    and account_id = u and kind = 'WORKER';
  if not found then raise exception 'WORKER_MULTI_LOCALITY_DENIED' using errcode = '42501'; end if;
  select * into h from private.worker_multi_locality_scope_v2
    where profile_id = p.id and account_id = u;
  has_scope := found;
  if has_scope then
    select coalesce(jsonb_agg(jsonb_build_object(
      'kind','LOCALITY_RADIUS','placeId',c.place_id,'label',c.canonical_label,
      'countryCode',c.country_code,'catalogRevision',c.catalog_revision,
      'radiusKm',a.radius_km,'scope','ON_SITE') order by a.ordinal),'[]'::jsonb)
    into selected from private.worker_multi_locality_area_v2 a
    join private.worker_area_place_catalog_v2 c
      on c.place_id=a.place_id and c.catalog_revision=a.catalog_revision
    where a.profile_id=p.id;
  end if;
  return jsonb_build_object('schemaVersion','WORKER_MULTI_LOCALITY_CANDIDATE_V2',
    'profileId',p.id,
    'effectiveSource',case when has_scope and exists(select 1 from private.worker_country_scope_v2
        where profile_id=p.id) then 'CONFLICT_BLOCKED'
      when has_scope then 'MULTI_LOCALITY_SHADOW' else 'LEGACY_V1' end,
    'areas',case when has_scope then selected else null end,
    'sourceReviewId',case when has_scope then h.source_review_id else null end,
    'candidateOnly',true);
end $f$;
revoke all on function public.rpc_read_worker_multi_locality_candidate_v2(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_read_worker_multi_locality_candidate_v2(uuid)
  to authenticated;
