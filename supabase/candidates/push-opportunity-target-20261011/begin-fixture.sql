-- Add exactly the synthetic columns read by canonical rpc_begin_push_send.
alter table public.notification_push_devices add column expo_push_token text;
update public.notification_push_devices set expo_push_token='ExpoPushToken[synthetic]';
alter table public.notification_push_attempts add column lease_id uuid;
alter table public.notification_push_attempts add column lease_until timestamptz;
alter table public.notification_push_attempts add column single_target_claimed_at timestamptz;
alter table public.notification_push_attempts add column send_count integer not null default 0;
-- Canonical begin-send writes this only on the suppressed branch.
alter table public.notification_push_attempts add column error_code text;
alter table public.notification_deliveries add column priority text not null default 'NORMAL';
create function auth.role() returns text language sql stable as $$
 select coalesce(current_setting('test.auth_role',true),'service_role')
$$;
create function private.closure_account_restricted(u uuid) returns boolean
 language sql stable as $$ select coalesce(current_setting('test.requester_closing',true),'false')='true' $$;
