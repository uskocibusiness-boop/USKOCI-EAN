#!/usr/bin/env bash
set -euo pipefail
# Disposable PostgreSQL only. The applied completion-window package already
# checks response_deadline through need_search_time_admitted_v1(clock_timestamp()).
# This proves the apparent statement_timestamp bypass is closed, with no ends_at.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
select proof.require(md5(pg_get_functiondef(
 'private.need_search_time_admitted_v1(uuid,timestamptz)'::regprocedure))=
 'e72b25a26bc41c79bdd5b194844c8950','EXACT_CURRENT_TIME_HELPER_INCLUDES_RESPONSE_DEADLINE');
SQL

lock_log="$(mktemp)"
trap 'rm -f "$lock_log"' EXIT
for action in SUBMIT SELECT KEEP UPDATE; do
  psql -X -v ON_ERROR_STOP=1 -v action="$action" <<'SQL'
select set_config('proof.response_action', :'action', false);
select proof.reset('REMOTE_ANYTIME',null);
truncate proof.results;
do $f$
declare app jsonb;
begin
 if current_setting('proof.response_action')<>'SUBMIT' then
  app:=proof.submit();
  insert into proof.results values('app',app);
 end if;
 if current_setting('proof.response_action') in ('KEEP','UPDATE') then
  update public.needs set revision=2;
  update public.marketplace_responses set status='STALE_REVIEW_REQUIRED';
 end if;
end $f$;
update public.needs set response_deadline=clock_timestamp()+interval '5 seconds';
SQL
  : >"$lock_log"
  psql -X -v ON_ERROR_STOP=1 >"$lock_log" 2>&1 <<'SQL' &
begin;
select 1 from public.needs where id=proof.id(201) for update;
\echo RESPONSE_LOCK_ACQUIRED
select pg_sleep(6);
commit;
SQL
  locker=$!
  for attempt in $(seq 1 80); do
    if grep -q 'RESPONSE_LOCK_ACQUIRED' "$lock_log"; then break; fi
    sleep 0.05
  done
  grep -q 'RESPONSE_LOCK_ACQUIRED' "$lock_log"
  psql -X -v ON_ERROR_STOP=1 -v action="$action" <<'SQL'
select set_config('proof.response_action', :'action', false);
do $f$
declare action text:=current_setting('proof.response_action');app uuid;command text;
begin
 perform proof.require((select response_deadline>statement_timestamp()
  and ends_at is null and starts_at is null from public.needs where id=proof.id(201)),
  'CALL_STARTS_BEFORE_APPLICATION_DEADLINE_WITH_NO_EXECUTION_DEADLINE');
 select (value->>'responseId')::uuid into app from proof.results where label='app';
 command:=case action
  when 'SUBMIT' then 'select proof.submit()'
  when 'SELECT' then format('select proof.select_response(%L::uuid)',app)
  else format('select proof.reconfirm(%L::uuid,%L)',app,action) end;
 -- The earlier statement-time response check passes, but the existing helper
 -- then rejects the same expired response deadline using post-lock wall time.
 perform proof.expect_error(command,'PT409','NEED_EXECUTION_WINDOW_EXPIRED');
 perform proof.require((select response_deadline<clock_timestamp() from public.needs where id=proof.id(201)),
  'NEED_LOCK_RELEASED_AFTER_APPLICATION_DEADLINE');
 perform proof.require((select count(*)=0 from public.agreements)
  and (select count(*)=0 from private.selection_commands)
  and (select count(*)=0 from private.connection_activations)
  and (select count(*)=0 from private.response_revision_resolution_commands),
  'EXPIRED_CALL_CREATES_NO_AGREEMENT_CHARGE_SELECTION_OR_RECONFIRM');
 perform proof.require((select count(*)=case action when 'SUBMIT' then 0 else 1 end
   from public.marketplace_responses)
  and (select count(*)=case action when 'SUBMIT' then 0 else 1 end
   from public.marketplace_response_versions)
  and (select count(*)=case action when 'SUBMIT' then 0 else 1 end
   from private.response_submit_commands),'EXPIRED_CALL_CREATES_NO_APPLICATION_OR_VERSION');
end $f$;
SQL
  wait "$locker"
  echo "RESPONSE_DEADLINE_LOCK_WAIT_${action}_PASS"
done

# Existing contracts still win over later expiry: committed retries replay,
# selected agreements remain selected, unfilled slots close, WITHDRAW succeeds.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $f$
declare first_app jsonb;second_app jsonb;agreement uuid;agreements_before jsonb;
 terms_before jsonb;app jsonb;action text;
begin
 perform proof.reset('REMOTE_ANYTIME',null);
 first_app:=proof.submit('response-deadline-first-app',2);
 agreement:=proof.select_response((first_app->>'responseId')::uuid,'response-deadline-first-selection');
 second_app:=proof.submit('response-deadline-second-app',3);
 select jsonb_agg(to_jsonb(a) order by id) into agreements_before from public.agreements a;
 select jsonb_agg(to_jsonb(v) order by agreement_id,version) into terms_before from public.agreement_versions v;
 update public.needs set response_deadline=clock_timestamp()-interval '1 second';
 perform proof.require(proof.submit('response-deadline-first-app',2)->'idempotentReplay'='true'::jsonb,
  'APPLICATION_REPLAY_AFTER_RESPONSE_DEADLINE');
 perform proof.require(proof.select_response((first_app->>'responseId')::uuid,
  'response-deadline-first-selection')=agreement,'SELECTION_REPLAY_AFTER_RESPONSE_DEADLINE');
 perform proof.expect_error('select proof.submit(''new-response-deadline-application'',3)',
  '22023','RESPONSE_WINDOW_EXPIRED');
 perform proof.expect_error(format('select proof.select_response(%L::uuid,%L)',
  second_app->>'responseId','new-response-deadline-selection'),'P0001','RESPONSE_WINDOW_EXPIRED');
 perform proof.require((select candidate_state='SELECTED' from private.need_candidate_states_v5(proof.id(201))
  where response_id=(first_app->>'responseId')::uuid)
  and (select candidate_state='CLOSED' from private.need_candidate_states_v5(proof.id(201))
  where response_id=(second_app->>'responseId')::uuid),'SELECTED_AGREEMENT_PRESERVED_REMAINING_SLOTS_CLOSED');
 perform proof.require((select jsonb_agg(to_jsonb(a) order by id) from public.agreements a)=agreements_before
  and (select jsonb_agg(to_jsonb(v) order by agreement_id,version) from public.agreement_versions v)=terms_before
  and public.fn_need_covered_slots(proof.id(201))=1
  and (select status='SELECTION' and required_slots=3 and ends_at is null from public.needs),
  'APPLICATION_DEADLINE_NEVER_REWRITES_EXISTING_AGREEMENT');

 foreach action in array array['KEEP','UPDATE'] loop
  perform proof.reset('REMOTE_ANYTIME',null);app:=proof.submit();
  update public.needs set revision=2;
  update public.marketplace_responses set status='STALE_REVIEW_REQUIRED';
  perform proof.require(proof.reconfirm((app->>'responseId')::uuid,action,
   'committed-before-response-expiry')->>'status'='SUBMITTED','RECONFIRM_BEFORE_RESPONSE_DEADLINE');
  update public.needs set response_deadline=clock_timestamp()-interval '1 second';
  perform proof.require(proof.reconfirm((app->>'responseId')::uuid,action,
   'committed-before-response-expiry')->'idempotentReplay'='true'::jsonb,
   'COMMITTED_RECONFIRM_REPLAY_AFTER_RESPONSE_DEADLINE');
 end loop;
 perform proof.reset('REMOTE_ANYTIME',null);app:=proof.submit();
 update public.needs set revision=2,response_deadline=clock_timestamp()-interval '1 second';
 update public.marketplace_responses set status='STALE_REVIEW_REQUIRED';
 perform proof.require(proof.reconfirm((app->>'responseId')::uuid,'WITHDRAW',
  'withdraw-after-response-expiry')->>'status'='WITHDRAWN','WITHDRAW_AFTER_RESPONSE_DEADLINE');
 perform proof.require(proof.reconfirm((app->>'responseId')::uuid,'WITHDRAW',
  'withdraw-after-response-expiry')->'idempotentReplay'='true'::jsonb,
  'WITHDRAW_REPLAY_AFTER_RESPONSE_DEADLINE');
end $f$;
select 'RESPONSE_DEADLINE_EXISTING_CONTRACTS_PASS' as result;
SQL
