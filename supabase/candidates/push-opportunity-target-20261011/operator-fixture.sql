-- Disposable only. Extends the synthetic recipient fixture with a fake bound device.
create role service_role nologin;
alter table public.notification_deliveries add column id uuid;
alter table public.notification_deliveries add column push_started_at timestamptz;
create table public.notification_push_devices(
 id uuid primary key,user_id uuid,active boolean,platform text,revision bigint,bound_revision bigint,bound_session_id uuid);
create table public.notification_push_attempts(
 id uuid primary key,delivery_id uuid,device_id uuid,attempt_no int,outcome text,
 transport_state text,device_revision bigint,next_attempt_at timestamptz,
 single_target_admission jsonb,single_target_authorization_id uuid);
create function private.push_suppression(d public.notification_deliveries) returns text
language sql stable set search_path to pg_catalog
as $$select case when coalesce(current_setting('test.push_off',true),'false')='true' then 'PUSH_OFF' else null end$$;
create function private.push_session_valid(u uuid,s uuid) returns boolean
language sql stable set search_path to pg_catalog
as $$ select u='11111111-1111-4111-8111-111111111111'::uuid
 and s='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
 and coalesce(current_setting('test.bad_session',true),'false')<>'true' $$;
insert into public.notification_deliveries(id,event_id,recipient_user_id,recipient_role,channel,
 dedupe_key,state,suppression_reason) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab','44444444-4444-4444-8444-444444444444',
 '11111111-1111-4111-8111-111111111111','WORKER','PUSH',
 'opp:55555555-5555-4555-8555-555555555555:1:11111111-1111-4111-8111-111111111111:push','CREATED',null);
insert into public.notification_push_devices values(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111',true,'ANDROID',7,7,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
