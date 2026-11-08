-- R13 source-only architectural candidate. NOT a canonical migration, NOT deployed.
-- The currently active private.dispatch_tick / private.marketplace_tick and Cron
-- remain authoritative. This prototype must first pass a real-wave native PG17,
-- concurrent-worker, lifecycle and hosted cron ownership/permission gate.
-- Executing this file as a migration must FAIL before any schema change.
DO $not_approved$
BEGIN
  RAISE EXCEPTION 'R13_COOPERATIVE_DISPATCH_SOURCE_ONLY' USING ERRCODE='P0001';
END
$not_approved$;

-- R13_ISOLATED_TEST_PROCEDURE_START
-- Only the bounded test extracts the SQL below. A future deployment must use a
-- newly reviewed migration with exact current preimage and explicit cron switch.
-- SECURITY INVOKER and NO CREATE PROCEDURE SET clause are essential: PostgreSQL
-- forbids COMMIT inside SECURITY DEFINER procedures or procedures with a SET.
-- The only intended caller is the postgres-owned scheduler (never an app RPC).
CREATE OR REPLACE PROCEDURE private.dispatch_cooperative_candidate(
  p_batch integer DEFAULT 25,
  p_at timestamptz DEFAULT statement_timestamp()
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $cooperative$
DECLARE
  v_seen uuid[] := '{}'::uuid[];
  v_candidate record;
  v_need uuid;
  v_result jsonb;
  v_reason text;
  v_next_at timestamptz;
  v_processed integer := 0;
  v_started timestamptz := clock_timestamp();
  v_budget numeric := 40;
  -- The live wave uses a transaction-local v1b.notified safety counter.
  -- Carry its value in a procedure variable across per-Need commits.
  v_cycle_notified integer := 0;
  v_profile_count integer := 0;
  v_profile_result jsonb;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'R13_SCHEDULER_ROLE_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_batch IS NULL OR p_batch < 1 OR p_batch > 200 THEN p_batch := 25; END IF;
  PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
  BEGIN
    SELECT coalesce((value->>'tickBudgetSeconds')::numeric,40)
      INTO v_budget FROM private.marketplace_config WHERE key='match_v1_dispatch';
  EXCEPTION WHEN OTHERS THEN
    v_budget := 40;
  END;
  v_budget := least(greatest(coalesce(v_budget,40),0.001),100);
  -- Preserve the current MATCH-V1 limits (100 profiles, 200 Needs/profile)
  -- while committing each profile's queue writes and keyset cursor together.
  -- A fresh watermark lock is acquired after each COMMIT. Another scheduler
  -- may advance it meanwhile; no cursor or profile row is held across commits.
  LOOP
    PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
    v_profile_result := NULL;
    BEGIN
      v_profile_result := private.requeue_changed_worker_profile_candidate(p_at);
    EXCEPTION WHEN OTHERS THEN
      -- Roll back this profile and its cursor together. As in dispatch_tick,
      -- a failed sweep does not stop already queued Needs being dispatched.
      RAISE WARNING 'R13_PROFILE_SWEEP_FAILED SQLSTATE=%', SQLSTATE;
    END;
    COMMIT;
    -- R13_PROFILE_COMMIT_BOUNDARY: the next profile cannot undo this one.
    EXIT WHEN coalesce((v_profile_result->>'profiles')::integer,0) <> 1;
    v_profile_count := v_profile_count + 1;
    EXIT WHEN v_profile_count >= 100
      OR clock_timestamp()-v_started > make_interval(secs=>v_budget);
  END LOOP;

  WHILE v_processed < p_batch LOOP
    IF v_processed > 0 AND clock_timestamp()-v_started > make_interval(secs=>v_budget) THEN
      EXIT;
    END IF;
    PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
    v_need := NULL;
    -- Never carry a task cursor across COMMIT; each iteration obtains a fresh
    -- due set. Need lock BEFORE schedule lock, matching the active lock order.
    FOR v_candidate IN
      SELECT s.need_id FROM private.dispatch_schedule s
        WHERE s.next_run_at <= p_at
          AND (s.locked_until IS NULL OR s.locked_until < p_at)
          AND s.need_id <> ALL(v_seen)
        ORDER BY s.next_run_at,s.need_id
    LOOP
      BEGIN
        PERFORM 1 FROM public.needs n WHERE n.id=v_candidate.need_id
          FOR UPDATE OF n SKIP LOCKED;
        IF NOT FOUND THEN CONTINUE; END IF;
        PERFORM 1 FROM private.dispatch_schedule s
          WHERE s.need_id=v_candidate.need_id AND s.next_run_at <= p_at
            AND (s.locked_until IS NULL OR s.locked_until < p_at)
          FOR UPDATE OF s SKIP LOCKED;
        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE='UD108', MESSAGE='R13_QUEUE_LOCK_SKIPPED';
        END IF;
        UPDATE private.dispatch_schedule s
          SET locked_until=p_at+interval '2 minutes', updated_at=statement_timestamp()
          WHERE s.need_id=v_candidate.need_id;
        v_need := v_candidate.need_id;
        EXIT;
      EXCEPTION WHEN SQLSTATE 'UD108' THEN
        -- The subtransaction releases the unsuccessful Need lock.
        NULL;
      END;
    END LOOP;
    IF v_need IS NULL THEN EXIT; END IF;
    v_seen := array_append(v_seen,v_need);
    BEGIN
      -- set_config(...,true) is cleared at COMMIT. Never restart the
      -- shared lock-table notification allowance for each Need.
      PERFORM pg_catalog.set_config('v1b.notified', v_cycle_notified::text, true);
      v_result := private.dispatch_next_wave(v_need);
      v_reason := coalesce(v_result->>'reason',v_result->>'status');
      IF v_result->>'status'='SENT' THEN
        v_next_at := coalesce((v_result->>'deadlineAt')::timestamptz,p_at+interval '15 minutes');
        UPDATE private.dispatch_schedule
          SET next_run_at=v_next_at,locked_until=NULL,attempts=0,
              last_status='SENT',last_reason=NULL,updated_at=statement_timestamp()
          WHERE need_id=v_need;
      ELSIF v_reason IN ('SLOTS_FILLED','NEED_NOT_OPEN','WAVES_EXHAUSTED',
                      'RESPONSE_TARGET_AND_COVERAGE_REACHED','REMAINING_SEARCH_CLOSED',
                      'SEARCH_WINDOW_CLOSED') THEN
        DELETE FROM private.dispatch_schedule WHERE need_id=v_need;
      ELSE
        UPDATE private.dispatch_schedule
          SET attempts=attempts+1,locked_until=NULL,
              next_run_at=p_at+make_interval(mins=>least(360,greatest(5,(2^least(attempts,9))::integer))),
              last_status='STOPPED',last_reason=v_reason,updated_at=statement_timestamp()
          WHERE need_id=v_need;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Same retry semantics as dispatch_tick. Any partial wave effects are
      -- undone by the exception subtransaction before the error is recorded.
      UPDATE private.dispatch_schedule
        SET attempts=attempts+1,locked_until=NULL,
            next_run_at=p_at+interval '10 minutes',last_status='ERROR',
            last_reason=left(SQLERRM,200),updated_at=statement_timestamp()
        WHERE need_id=v_need;
    END;
    -- Only read after the exception subtransaction has completed: failed
    -- wave writes and its local GUC update have already rolled back.
    v_cycle_notified := greatest(v_cycle_notified,
      coalesce(nullif(pg_catalog.current_setting('v1b.notified',true),'')::integer,0));
    v_processed := v_processed + 1;
    -- Core property: one Need's effects and queue state commit together.
    -- The following Need starts with no earlier Need locks held.
    COMMIT;
  END LOOP;
END
$cooperative$;

-- No client entrypoint (including service_role); only an authorized postgres
-- scheduler may invoke the procedure. Existing dispatch functions untouched.
REVOKE ALL ON PROCEDURE private.dispatch_cooperative_candidate(integer,timestamptz)
  FROM PUBLIC,anon,authenticated,service_role;

-- R13_ISOLATED_TEST_PROFILE_STEP_START
-- A one-profile extraction of the currently deployed MATCH-V1 sweep owner.
-- The active requeue_changed_worker_profiles_v1 remains untouched. This helper
-- is part of the guarded candidate only, not a second active scheduler path.
-- Existing queue eligibility, world boundary, 30s cutoff and 200-Need cap are
-- preserved. Its queue writes and durable cursor must share one transaction.
CREATE OR REPLACE FUNCTION private.requeue_changed_worker_profile_candidate(
  p_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog'
AS $profile_step$
DECLARE
  cfg jsonb;
  after_at timestamptz;
  after_acc uuid;
  cutoff timestamptz;
  w record;
  v_need uuid;
  all_mode boolean := false;
  queued integer := 0;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'R13_SCHEDULER_ROLE_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_at IS NULL OR NOT isfinite(p_at) THEN
    RETURN jsonb_build_object('status','SKIPPED','reason','INVALID_TIME');
  END IF;
  SELECT value INTO cfg FROM private.marketplace_config
    WHERE key='match_v1_profile_requeue' FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','SKIPPED','reason','NOT_CONFIGURED_OR_BUSY');
  END IF;
  SELECT (value->>'mode')='ALL' INTO all_mode FROM private.marketplace_config
    WHERE key='match_v1_dispatch';
  all_mode := coalesce(all_mode,false);
  after_at := (cfg->>'after')::timestamptz;
  after_acc := coalesce((cfg->>'afterAccount')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid);
  cutoff := least(p_at,statement_timestamp())-interval '30 seconds';
  IF after_at IS NULL OR NOT isfinite(after_at) THEN
    RETURN jsonb_build_object('status','SKIPPED','reason','WATERMARK_INVALID');
  END IF;
  IF cutoff < after_at THEN
    RETURN jsonb_build_object('status','IDLE','profiles',0,'queued',0);
  END IF;

  SELECT p.account_id,p.updated_at AS changed_at INTO w
    FROM public.app_profiles p
    WHERE p.kind='WORKER' AND p.profile_status='ACTIVE'
      AND (p.updated_at,p.account_id)>(after_at,after_acc)
      AND p.updated_at<=cutoff
    ORDER BY p.updated_at,p.account_id
    LIMIT 1;
  IF NOT FOUND THEN
    -- Preserve a processed tie at the exact cutoff. Resetting afterAccount
    -- to zero at the same timestamp would replay that profile on the next
    -- identical tick (or move a concurrently advanced cursor backwards).
    UPDATE private.marketplace_config
      SET value=jsonb_set(jsonb_set(value,'{after}',to_jsonb(cutoff)),
        '{afterAccount}',to_jsonb(CASE WHEN cutoff=after_at THEN after_acc
          ELSE '00000000-0000-0000-0000-000000000000'::uuid END)),
        updated_at=statement_timestamp()
      WHERE key='match_v1_profile_requeue';
    RETURN jsonb_build_object('status','IDLE','profiles',0,'queued',0);
  END IF;

  -- Same predicate/order as requeue_changed_worker_profiles_v1: OFFSET 0
  -- keeps the world check outside the cheap Need/queue filtering scan.
  FOR v_need IN
    SELECT c.id FROM (
      SELECT n.id,n.published_at,n.requester_account_id
        FROM public.needs n
        LEFT JOIN private.dispatch_schedule s ON s.need_id=n.id
        WHERE n.status IN ('PUBLISHED','SELECTION')
          AND n.published_at IS NOT NULL
          AND n.remaining_search_closed_at IS NULL
          AND n.requester_account_id<>w.account_id
          AND (n.response_deadline IS NULL OR n.response_deadline>statement_timestamp())
          AND (s.need_id IS NULL OR (coalesce(s.updated_at,'-infinity'::timestamptz)<w.changed_at
            AND (all_mode OR NOT (coalesce(s.last_status,'')='SENT'
              AND coalesce(s.next_run_at,'-infinity'::timestamptz)>p_at))))
        ORDER BY n.published_at DESC,n.id DESC
        OFFSET 0
    ) c
    WHERE private.accounts_same_world(c.requester_account_id,w.account_id)
    ORDER BY c.published_at DESC,c.id DESC
    LIMIT 200
  LOOP
    PERFORM private.enqueue_dispatch(v_need,statement_timestamp());
    queued := queued+1;
  END LOOP;

  UPDATE private.marketplace_config
    SET value=jsonb_set(jsonb_set(value,'{after}',to_jsonb(w.changed_at)),
      '{afterAccount}',to_jsonb(w.account_id)),updated_at=statement_timestamp()
    WHERE key='match_v1_profile_requeue';
  RETURN jsonb_build_object('status','DONE','profiles',1,'queued',queued,'more',true);
END
$profile_step$;

REVOKE ALL ON FUNCTION private.requeue_changed_worker_profile_candidate(timestamptz)
  FROM PUBLIC,anon,authenticated,service_role;
