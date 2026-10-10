-- Disposable PostgreSQL 16 only: entirely synthetic world, Auth, recipients and coordinates.
create schema private;
create schema auth;
create role authenticated nologin;
create role anon nologin;
create table private.account_worlds(id uuid primary key,world text not null);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('test.uid',true),'')::uuid
$$;
create function private.support_auth_v5(expected uuid) returns uuid language plpgsql stable security definer set search_path to pg_catalog as $$
declare u uuid:=auth.uid();
begin
 if u is null or u is distinct from expected then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000'; end if;
 return u;
end $$;
create function private.accounts_same_world(a uuid,b uuid) returns boolean language sql stable security definer set search_path to pg_catalog as $$
 select (select world from private.account_worlds where id=a) = (select world from private.account_worlds where id=b)
$$;
create function private.closure_assert_open(a uuid,b uuid) returns void language plpgsql security definer set search_path to pg_catalog as $$
begin if current_setting('test.closing',true)='true' then raise exception 'ACCOUNT_CLOSING' using errcode='42501';end if;end $$;
create table public.needs(id uuid primary key,requester_account_id uuid,revision integer,status text);
create table public.app_profiles(id uuid primary key,account_id uuid,kind text,profile_status text);
create table public.opportunity_deliveries(id uuid primary key,worker_account_id uuid,worker_profile_id uuid,
 need_id uuid,need_revision integer,status text,expires_at timestamptz);
create table public.user_activity_events(id uuid primary key,recipient_user_id uuid,recipient_role text,
 event_type text,entity_type text,entity_id uuid,entity_version integer,dedupe_key text);
create table public.notification_deliveries(event_id uuid,recipient_user_id uuid,recipient_role text,
 channel text,dedupe_key text,state text,suppression_reason text);
create function private.safety_event_blocked(e public.user_activity_events) returns boolean
 language sql stable security definer as $$ select coalesce(current_setting('test.blocked',true),'false')='true' $$;
grant usage on schema public to authenticated;
grant usage on schema auth to authenticated;
grant usage on schema private to authenticated;
-- Recreate the same identity/world guard, NOT Auth internals or real RLS.
insert into private.account_worlds values
 ('11111111-1111-4111-8111-111111111111','DEV'),
 ('22222222-2222-4222-8222-222222222222','DEV'),
 ('33333333-3333-4333-8333-333333333333','OTHER');
insert into public.needs values
 ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222',1,'PUBLISHED');
insert into public.app_profiles values
 ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','WORKER','ACTIVE');
insert into public.opportunity_deliveries values
 ('88888888-8888-4888-8888-888888888888','11111111-1111-4111-8111-111111111111',
  '66666666-6666-4666-8666-666666666666','55555555-5555-4555-8555-555555555555',1,'READY',now()+interval '1 hour');
insert into public.user_activity_events values
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111',
 'WORKER','OPPORTUNITY_AVAILABLE','NEED','55555555-5555-4555-8555-555555555555',1,
 'opp:55555555-5555-4555-8555-555555555555:1:11111111-1111-4111-8111-111111111111');
insert into public.notification_deliveries values
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111',
 'WORKER','IN_APP','opp:55555555-5555-4555-8555-555555555555:1:11111111-1111-4111-8111-111111111111:in_app','CREATED',null);
