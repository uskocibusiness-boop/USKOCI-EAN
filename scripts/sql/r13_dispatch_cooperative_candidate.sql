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
  -- Preserve the current MATCH-V1 rule: one profile requeue per tick.
  BEGIN
    PERFORM private.requeue_changed_worker_profiles_v1(p_at);
  EXCEPTION WHEN OTHERS THEN
    -- A failed profile scan must not stop already queued Need dispatch.
    -- Record failure in scheduler telemetry before production promotion.
    NULL;
  END;
  COMMIT;

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
