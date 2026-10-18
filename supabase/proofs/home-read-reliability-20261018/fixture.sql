-- Local fixture only. Not a Supabase migration and not production policy/schema.
create schema private; create schema auth; create schema extensions;
create role authenticated; create role anon; create role service_role;
grant usage on schema public, auth, extensions to authenticated, anon;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
-- Box-backed stand-in: unchanged bbox parsing only, NOT a PostGIS proof.
create domain extensions.geography as box;
create function extensions.st_makeenvelope(double precision,double precision,double precision,double precision,integer)
  returns extensions.geography language sql immutable as $$ select box(point($1,$2),point($3,$4))::extensions.geography $$;
create function extensions.fixture_overlaps(extensions.geography, extensions.geography)
  returns boolean language sql immutable as $$ select $1::box && $2::box $$;
create operator extensions.&& (leftarg=extensions.geography, rightarg=extensions.geography, procedure=extensions.fixture_overlaps);
create function private.closure_source_digest_v5() returns text language sql stable as $$ select 'fixture-closure'::text $$;
create table public.needs (
  id uuid primary key, requester_account_id uuid not null, requester_profile_id uuid,
  status text default 'PUBLISHED', title text default 'Fixture task', description text default 'PRIVATE_DESCRIPTION',
  category text default 'Selidbe', approximate_city text default 'Novi Sad', approximate_area text default 'Centar',
  approximate_lat numeric default 45.26, approximate_lng numeric default 19.83,
  schedule_kind text default 'FLEXIBLE', starts_at timestamptz, ends_at timestamptz,
  required_slots integer default 2, mode text default 'OFFERS', requester_price_rsd numeric,
  required_skills text[] default '{}', required_tools text[] default '{}', required_vehicles text[] default '{}',
  verified_identity_required boolean default false, urgent boolean default false, public_photo_paths text[] default '{}',
  revision integer default 1, published_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now(),
  response_deadline timestamptz, urgent_activated_at timestamptz, urgent_expires_at timestamptz, urgent_policy_version integer,
  minimum_experience_years integer, execution_location_mode text default 'ON_SITE', approx_geog extensions.geography,
  required_licenses text[] default '{}', remaining_search_closed_at timestamptz,
  task_country_code text default 'RS', task_timezone text default 'Europe/Belgrade', price_basis text default 'TOTAL',
  _covered integer default 0, _visible boolean default true, _private_address text default 'PRIVATE_ADDRESS', _phone text default 'PRIVATE_PHONE'
);
create table public.need_geography (need_id uuid primary key, public_topology jsonb);
create table public.need_requirement_details (need_id uuid primary key, critical_conditions text[]);
create function public.covered_slots(public.needs) returns integer language sql stable set search_path=pg_catalog
  as $$ select coalesce(n._covered,0) from public.needs n where n.id=$1.id $$;
alter table public.needs enable row level security;
create policy fixture_visibility on public.needs for select to authenticated using (_visible);
grant select on public.needs, public.need_geography, public.need_requirement_details to authenticated;
