-- Recreate only the archived synthetic probe, with no scheduler entry.
-- Use only to reverse r13_transaction_probe_cleanup_20261109 after inspection.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $rollback_guard$
BEGIN
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='uskoci_dispatch_call_probe_20261108'
  OR command ILIKE '%capacity4_transaction_probe%') THEN
  RAISE EXCEPTION 'R13_PROBE_ROLLBACK_JOB_PRESENT';
 END IF;
END $rollback_guard$;
-- Restricted, disposable hosted CALL compatibility probe. No dispatch, provider,
-- business table, user row, config or existing Cron job is read or changed.
-- Install only; scheduling is a separate reviewed step after this commits.
do $guard$
begin
 if current_user <> 'postgres' or current_database() <> 'postgres' then raise exception 'CAPACITY4_PROBE_OWNER_REQUIRED';end if;
 if to_regclass('private.capacity4_transaction_probe')is not null
  or to_regprocedure('private.capacity4_transaction_probe_v1()')is not null then
  raise exception 'CAPACITY4_PROBE_ALREADY_EXISTS';
 end if;
end $guard$;
create table private.capacity4_transaction_probe(
 phase text primary key check(phase in ('before','after')),
 transaction_id bigint not null,
 observed_at timestamptz not null default clock_timestamp()
);
comment on table private.capacity4_transaction_probe is 'USKOCI disposable transaction CALL probe 20261108; synthetic diagnostic rows only';
alter table private.capacity4_transaction_probe enable row level security;
revoke all on table private.capacity4_transaction_probe from public,anon,authenticated,service_role;
create procedure private.capacity4_transaction_probe_v1()
language plpgsql security invoker
as $probe$
declare first_transaction bigint;
begin
 if exists(select 1 from private.capacity4_transaction_probe where phase='after')then return;end if;
 first_transaction:=pg_catalog.txid_current();
 insert into private.capacity4_transaction_probe(phase,transaction_id)values('before',first_transaction)
 on conflict(phase)do update set transaction_id=excluded.transaction_id,observed_at=pg_catalog.clock_timestamp();
 commit;
 if pg_catalog.txid_current()=first_transaction then raise exception 'CAPACITY4_PROBE_TRANSACTION_NOT_CHANGED';end if;
 insert into private.capacity4_transaction_probe(phase,transaction_id)values('after',pg_catalog.txid_current());
 commit;
end $probe$;
revoke all on procedure private.capacity4_transaction_probe_v1() from public,anon,authenticated,service_role;
-- Schedule only this direct, single top-level command (no BEGIN / SELECT wrapper):
-- call private.capacity4_transaction_probe_v1();
-- Suggested temporary job name: uskoci_dispatch_call_probe_20261108
-- Success: two phases with distinct transaction_id AND succeeded Cron run.

INSERT INTO private.capacity4_transaction_probe(phase,transaction_id,observed_at) VALUES
 ('before',203348825,'2026-11-08 23:06:00.153974+00'),
 ('after',203348826,'2026-11-08 23:06:00.164508+00');
COMMIT;
