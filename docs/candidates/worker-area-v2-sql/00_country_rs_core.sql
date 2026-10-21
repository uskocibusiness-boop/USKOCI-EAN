-- COUNTRY/RS shadow candidate. Not a migration and not active coverage.
-- Run only inside a transaction ending in ROLLBACK; see 10_rollback_proof.sql.

do $pre$
begin
  if to_regclass('private.worker_country_scope_v2') is not null then
    raise exception 'WORKER_COUNTRY_SCOPE_ALREADY_EXISTS';
  end if;
  if to_regclass('public.app_profiles') is null
    or to_regprocedure('private.closure_assert_open(uuid,uuid)') is null
    or to_regprocedure('private.worker_need_fit_v1(uuid,uuid,boolean)') is null
  then raise exception 'WORKER_COUNTRY_SCOPE_PREDECESSOR_MISSING'; end if;
end $pre$;

create table private.worker_country_scope_v2 (
  profile_id uuid primary key references public.app_profiles(id) on delete cascade,
  account_id uuid not null unique references public.app_accounts(id) on delete cascade,
  country_code text not null check (country_code = 'RS'),
  source_review_id uuid not null,
  displayed_digest text not null check (displayed_digest ~ '^[0-9a-f]{64}$'),
  source_revision integer not null check (source_revision >= 0),
  saved_at timestamptz not null default clock_timestamp()
);
alter table private.worker_country_scope_v2 enable row level security;
alter table private.worker_country_scope_v2 force row level security;
revoke all on private.worker_country_scope_v2 from public, anon, authenticated, service_role;

create function private.worker_country_scope_owner_guard_v2()
returns trigger language plpgsql security definer set search_path = pg_catalog as $f$
begin
  if not exists (
    select 1 from public.app_profiles p
    where p.id = new.profile_id and p.account_id = new.account_id
      and p.kind = 'WORKER' and p.profile_status in ('DRAFT','ACTIVE')
  ) then raise exception 'WORKER_COUNTRY_SCOPE_OWNER_MISMATCH' using errcode = '42501'; end if;
  return new;
end $f$;
create trigger worker_country_scope_owner_guard_v2
before insert or update on private.worker_country_scope_v2
for each row execute function private.worker_country_scope_owner_guard_v2();
revoke all on function private.worker_country_scope_owner_guard_v2() from public, anon, authenticated, service_role;

-- Strict candidate vocabulary. Biography, old city/radius or provider hint
-- cannot become all-country consent. The current worker_ai_patch does NOT
-- admit "areas"; this only validates a future signed candidate shape.
create function private.worker_country_scope_candidate_v2(candidate jsonb)
returns jsonb language plpgsql immutable set search_path = pg_catalog as $f$
declare areas jsonb; area jsonb;
begin
  if jsonb_typeof(candidate) is distinct from 'object' then
    raise exception 'WORKER_COUNTRY_CANDIDATE_INVALID' using errcode = '22023';
  end if;
  if not candidate ? 'areas' then return null; end if;
  areas := candidate->'areas';
  if jsonb_typeof(areas) is distinct from 'array' or jsonb_array_length(areas) <> 1 then
    raise exception 'WORKER_COUNTRY_CANDIDATE_INVALID' using errcode = '22023';
  end if;
  area := areas->0;
  if jsonb_typeof(area) is distinct from 'object'
    or area - array['kind','countryCode','scope'] <> '{}'::jsonb
    or not (area ?& array['kind','countryCode','scope'])
    or area->>'kind' is distinct from 'COUNTRY'
    or area->>'countryCode' is distinct from 'RS'
    or area->>'scope' is distinct from 'ON_SITE'
  then raise exception 'WORKER_COUNTRY_CANDIDATE_INVALID' using errcode = '22023'; end if;
  return jsonb_build_object('kind','COUNTRY','countryCode','RS','scope','ON_SITE');
end $f$;
revoke all on function private.worker_country_scope_candidate_v2(jsonb) from public, anon, authenticated, service_role;

-- NULL means preserve the existing matcher branch (no V2 receipt or REMOTE).
-- A COUNTRY/RS receipt fails closed for unknown country and route modes
-- until their endpoint-country contract is proven.
create function private.worker_country_scope_task_fit_v2(mode text, task_country text, worker_country text)
returns boolean language sql immutable set search_path = pg_catalog as $f$
  select case when mode = 'REMOTE' then null
    when mode = 'STATIONARY' and task_country = 'RS' and worker_country = 'RS' then true
    else false end;
$f$;
revoke all on function private.worker_country_scope_task_fit_v2(text,text,text) from public, anon, authenticated, service_role;

create function private.worker_country_scope_match_v2(need_id uuid, worker_profile_id uuid)
returns boolean language plpgsql stable security definer set search_path = pg_catalog as $f$
declare country text; mode text; task_country text;
begin
  select c.country_code into country from private.worker_country_scope_v2 c
    where c.profile_id = worker_profile_id;
  if not found then return null; end if;
  select n.execution_location_mode, n.task_country_code into mode, task_country
    from public.needs n where n.id = need_id;
  if not found then return false; end if;
  return private.worker_country_scope_task_fit_v2(mode, task_country, country);
end $f$;
revoke all on function private.worker_country_scope_match_v2(uuid,uuid) from public, anon, authenticated, service_role;

create function public.rpc_read_worker_country_scope_candidate_v2(p_profile_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $f$
declare u uuid := auth.uid(); p public.app_profiles; c private.worker_country_scope_v2; has_scope boolean;
begin
  if u is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  perform private.closure_assert_open(u);
  select * into p from public.app_profiles where id = p_profile_id
    and account_id = u and kind = 'WORKER';
  if not found then raise exception 'WORKER_COUNTRY_SCOPE_DENIED' using errcode = '42501'; end if;
  select * into c from private.worker_country_scope_v2 where profile_id = p.id and account_id = u;
  has_scope := found;
  return jsonb_build_object('schemaVersion','WORKER_COUNTRY_SCOPE_CANDIDATE_V2',
    'profileId',p.id,'effectiveSource',case when has_scope then 'COUNTRY_RS_SHADOW' else 'LEGACY_V1' end,
    'area',case when has_scope then jsonb_build_object('kind','COUNTRY','countryCode',c.country_code,'scope','ON_SITE') else null end,
    'sourceReviewId',case when has_scope then c.source_review_id else null end,
    'candidateOnly',true);
end $f$;
revoke all on function public.rpc_read_worker_country_scope_candidate_v2(uuid) from public, anon, authenticated, service_role;
grant execute on function public.rpc_read_worker_country_scope_candidate_v2(uuid) to authenticated;
