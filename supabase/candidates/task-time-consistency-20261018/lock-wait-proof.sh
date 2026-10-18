#!/usr/bin/env bash
set -euo pipefail
# Disposable DB only. Prove a statement begun BEFORE deadline but blocked on
# the Need row is rejected once that lock is acquired AFTER the deadline.
psql -X -v ON_ERROR_STOP=1 -c "select proof.reset('FLEXIBLE',clock_timestamp()+interval '5 seconds');"
lock_log="$(mktemp)"
trap 'rm -f "$lock_log"' EXIT
psql -X -v ON_ERROR_STOP=1 >"$lock_log" 2>&1 <<'SQL' &
begin;
select 1 from public.needs where id=proof.id(201) for update;
\echo LOCK_ACQUIRED
select pg_sleep(6);
commit;
SQL
locker=$!
for attempt in $(seq 1 80); do
  if grep -q 'LOCK_ACQUIRED' "$lock_log"; then break; fi
  sleep 0.05
done
grep -q 'LOCK_ACQUIRED' "$lock_log"
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $f$
begin
 perform proof.require((select ends_at>statement_timestamp() from public.needs where id=proof.id(201)),
   'CALL_MUST_START_BEFORE_DEADLINE');
 perform proof.expect_error('select proof.submit()','PT409','NEED_EXECUTION_WINDOW_EXPIRED');
 perform proof.require((select ends_at<clock_timestamp() from public.needs where id=proof.id(201)),
   'LOCK_MUST_RELEASE_AFTER_DEADLINE');
 perform proof.require((select count(*)=0 from public.marketplace_responses),'LOCK_WAIT_MUST_NOT_CREATE_APPLICATION');
end $f$;
SQL
wait "$locker"
echo 'TASK_TIME_LOCK_WAIT_PASS'

