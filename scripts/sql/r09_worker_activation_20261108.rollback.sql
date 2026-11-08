-- R09 source-only rollback: restore only the old dispatch admission predicate.
-- Keeps activation observations, immutable clock trigger, export/closure support
-- AI source continuity and publication/revision guard hardening. Never drops
-- or rewrites user data.
-- The old admission policy can again consider pre-activation tasks; use only as
-- an explicit rollback after current-state review. R13 scheduler/Cron untouched.
DO $source_only$ BEGIN RAISE EXCEPTION 'R09_ACTIVATION_ROLLBACK_SOURCE_ONLY'; END $source_only$;

-- R09_ISOLATED_TEST_ROLLBACK_START
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=pg_catalog;
DO $rollback_guard$
DECLARE current_hash text;
BEGIN
 SELECT md5(prosrc) INTO current_hash FROM pg_proc
 WHERE oid=to_regprocedure('private.dispatch_cheap_candidate_admitted(uuid,uuid)');
 IF current_hash IS DISTINCT FROM '5f3862949a6b93ab99c29c549ff9a837' THEN
  RAISE EXCEPTION 'R09_ROLLBACK_POSTIMAGE_DRIFT';
 END IF;
 IF to_regprocedure('private.guard_worker_dispatch_clock_v1()') IS NULL
  OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.app_profiles'::regclass
   AND tgname='zz_worker_dispatch_clock_v1' AND tgenabled='O' AND NOT tgisinternal) THEN
  RAISE EXCEPTION 'R09_ROLLBACK_CLOCK_GUARD_MISSING';
 END IF;
END $rollback_guard$;
CREATE OR REPLACE FUNCTION private.dispatch_cheap_candidate_admitted(nid uuid, pid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  select exists (
    select 1
    from public.needs n
    join public.app_profiles p on p.id = pid
    left join public.worker_match_preferences pref on pref.worker_profile_id = p.id
    where n.id = nid
      and p.kind = 'WORKER'
      and p.profile_status = 'ACTIVE'
      and coalesce(pref.proactive_notifications, true) = true
      -- MATCH-V1 (owner 2026-10-07): the ONE shared "Odgovara mi" rule: kind of work + area + time and the existing
      -- hard exceptions (own task, other world, identity, exclusions). Tools, vehicles, experience and the
      -- minimum fee are no longer conditions; licenses were retired by WPP01. The rule takes the ROW columns, never
      -- the bare parameters: a parameter-only call is a one-time filter that would run before the status filter above,
      -- for every draft or suspended profile the candidate loop visits.
      and private.worker_need_match_v1(n.id, p.id)
      and not exists (
        select 1 from public.opportunity_deliveries od
        where od.worker_account_id = p.account_id
          and od.need_id = n.id
          and od.need_revision = n.revision)
  );
$function$;

DO $rollback_readback$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.dispatch_cheap_candidate_admitted(uuid,uuid)'::regprocedure)
   IS DISTINCT FROM 'cec5c0a2c13af6718af53b7a80245f28' THEN RAISE EXCEPTION 'R09_ROLLBACK_READBACK_MISMATCH';END IF;
END $rollback_readback$;
COMMIT;
