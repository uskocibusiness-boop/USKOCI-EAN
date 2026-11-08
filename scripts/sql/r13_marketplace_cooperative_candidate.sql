-- R13 source-only marketplace integration. NOT a migration, NOT deployed.
-- The active marketplace_tick and hosted Cron remain unchanged. This file
-- must fail before any DDL. A future promotion needs current body/ACL checks,
-- non-idle lifecycle-trigger parity and a separate verified hosted Cron switch.
DO $not_approved$
BEGIN
  RAISE EXCEPTION 'R13_MARKETPLACE_COOPERATIVE_SOURCE_ONLY' USING ERRCODE='P0001';
END
$not_approved$;

-- R13_ISOLATED_TEST_MARKETPLACE_START
-- Top-level CALL -> CALL is deliberate: the inner dispatch procedure commits
-- each profile/Need independently. Neither procedure may be SECURITY DEFINER
-- or have a CREATE PROCEDURE SET clause, or PostgreSQL rejects those commits.
CREATE OR REPLACE PROCEDURE private.marketplace_cooperative_candidate(
  p_batch integer DEFAULT 25,
  p_at timestamptz DEFAULT statement_timestamp()
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $marketplace$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'R13_SCHEDULER_ROLE_REQUIRED' USING ERRCODE='42501';
  END IF;

  -- Preserve marketplace_tick's six phases and the exact supplied p_at.
  -- Keep raw p_batch: the owners have intentionally different clamps/defaults
  -- (dispatch1..200/default25, export1..100, retention1..25, completion100).
  -- Do not catch a phase exception and continue to later phases. Earlier
  -- completed transactions survive; a retry starts at expiry and the existing
  -- owners reconcile their already-committed state/ledgers.
  PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
  PERFORM private.expire_lifecycle(p_at);
  COMMIT;

  PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
  CALL private.dispatch_cooperative_candidate(p_batch,p_at);
  COMMIT;

  PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
  PERFORM public.rpc_tick_auto_completion();
  COMMIT;

  PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
  PERFORM private.data_export_maintenance(p_batch);
  COMMIT;

  PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
  PERFORM private.retention_maintenance(p_batch);
  COMMIT;

  PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
  PERFORM private.ai_turn_sweep_v5(p_at);
  COMMIT;
END
$marketplace$;

REVOKE ALL ON PROCEDURE private.marketplace_cooperative_candidate(integer,timestamptz)
  FROM PUBLIC,anon,authenticated,service_role;

-- This wrapper does not make the existing phases internally bounded. In the
-- current bodies, expiry/urgency and three AI-turn updates can still affect all
-- due rows, and auto-completion/export/retention each retain their own batch
-- transaction. Those non-idle limits and side-effect triggers still need their
-- explicit acceptance before hosted activation; the sentinel stays in place.
