-- USKOCI 2026-11-19: retire task urgency branches and availability-now ranking.
-- SOURCE-ONLY CANDIDATE. No DEV/PROD execution is authorized by this file.
-- Preserve historical columns/rows, queue ownership, normal pacing, calendar eligibility,
-- location handling, candidate caps, idempotency and transaction budgets.
DO $source_only$
BEGIN
  RAISE EXCEPTION 'DISPATCH_URGENCY_RETIREMENT_SOURCE_ONLY';
END
$source_only$;

-- R13_DISPATCH_URGENCY_RETIREMENT_ISOLATED_START
-- Remove the guard only in a disposable PG17 fixture or after a separately reviewed
-- Supabase CLI migration has been prepared. Never run this script in the SQL editor.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DO $main$
DECLARE
  target regprocedure := 'private.dispatch_next_wave(uuid)'::regprocedure;
  d text;
  original_metadata jsonb;
  patch text[];
  patches text[][] := ARRAY[
    ARRAY[$old$cfg jsonb; sizes jsonb; budget jsonb; urgcfg jsonb;$old$, $new$cfg jsonb; sizes jsonb; budget jsonb;$new$],
    ARRAY[$old$windowm integer; min_choice integer;$old$, $new$windowm integer;$new$],
    ARRAY[$old$c record; d jsonb; deadline timestamptz; urg text;$old$, $new$c record; d jsonb; deadline timestamptz;$new$],
    ARRAY[$old$urg := case when coalesce(n.urgent,false) and n.urgent_expires_at > statement_timestamp()
              then 'URGENT' else 'NORMAL' end;$old$, $new$urg := 'NORMAL';$new$],
    ARRAY[$old$where key = case when urg = 'URGENT' then 'dispatch_urgent' else 'dispatch_normal' end;$old$, $new$where key = 'dispatch_normal';$new$],
    ARRAY[$old$daily_cap := case when urg = 'URGENT' then null else (cfgb->>'workerDailyCap')::integer end;$old$, $new$daily_cap := (cfgb->>'workerDailyCap')::integer;$new$],
    ARRAY[$old$private.dispatch_remote_wave_v1b(nid, sw, cfgb, urg, windowm,$old$, $new$private.dispatch_remote_wave_v1b(nid, sw, cfgb, 'NORMAL', windowm,$new$],
    ARRAY[$old$private.candidate_budget(urg = 'URGENT',$old$, $new$private.candidate_budget(false,$new$],
    ARRAY[$old$and urgency = urg$old$, $new$and urgency = 'NORMAL'$new$],
    ARRAY[$old$  -- O-3: pod izbora za HITNO.
  if urg = 'URGENT' and not all_mode then
    select value into urgcfg from private.marketplace_config where key = 'urgent_activation_policy';
    min_choice := coalesce(nullif(urgcfg->>'minChoice','')::integer, 2);
    if min_choice < 2 or min_choice > 10 then min_choice := 2; end if;
    batch := greatest(batch, min_choice);
  end if;
$old$, $new$$new$],
    ARRAY[$old$    if urg = 'URGENT' then valid_until := least(valid_until, n.urgent_expires_at); end if;
$old$, $new$$new$],
    ARRAY[$old$values (roundid,n.id,n.revision,roundno,urg,batch,target,candidate_limit,budget_source,'SENT',deadline);$old$, $new$values (roundid,n.id,n.revision,roundno,'NORMAL',batch,target,candidate_limit,budget_source,'SENT',deadline);$new$],
    ARRAY[$old$order by coalesce((s.detail->>'timeTier')::integer, 9), (s.detail->>'score')::numeric desc, s.pid$old$, $new$order by (s.detail->>'score')::numeric desc, s.pid$new$],
    ARRAY[$old$p_urgency => case when urg = 'URGENT' then 'HITNO' else 'NORMAL' end,$old$, $new$p_urgency => 'NORMAL',$new$],
    ARRAY[$old$'round', roundno, 'policyWaveNo', policy_wave_no, 'urgency', urg,$old$, $new$'round', roundno, 'policyWaveNo', policy_wave_no, 'urgency', 'NORMAL',$new$],
    ARRAY[$old$'inserted', inserted, 'batchSize', batch, 'minChoice', min_choice,$old$, $new$'inserted', inserted, 'batchSize', batch,$new$],
    ARRAY[$old$  -- Hitnost se cita iz projekcije, ne iz sirove zastavice: istekao prozor je NORMAL.
$old$, $new$$new$],
    ARRAY[$old$  --   mode LADDER (or no row): today's waves, unchanged (dispatch_normal / dispatch_urgent: waveSizes, windowMinutes, targetResponses,$old$, $new$  --   mode LADDER (or no row): today's waves (dispatch_normal: waveSizes, windowMinutes, targetResponses,$new$],
    ARRAY[$old$  --     candidate budget). "Mogu odmah" first (timeTier) orders the workers inside a wave in both modes.
$old$, $new$  --     candidate budget). Candidate order is by the common match score; the calendar remains the time-eligibility authority.
$new$],
    ARRAY[$old$    -- MATCH-V1: "Mogu odmah" first for a task danas/odmah (timeTier 1), then the schedule (2); score within a tier.
$old$, $new$    -- Common match score, then stable profile identity; no availability-now priority.
$new$],
    ARRAY[$old$  urg := 'NORMAL';$old$, $new$$new$],
    ARRAY[$old$    --   2. a worker who already got workerDailyCap proactive new-task notifications in the last 24 hours is skipped for this task,
    --      without using up a place of any ceiling; an urgent task ignores the cap;$old$, $new$    --   2. a worker who already got workerDailyCap proactive new-task notifications in the last 24 hours is skipped for this task,
    --      without using up a place of any ceiling;$new$],
    ARRAY[$old$  -- notifications outlive it: they stay valid for 'validMinutes', for an urgent task not beyond the end of its urgency.
$old$, $new$  -- notifications outlive it: they stay valid for 'validMinutes' for every task.
$new$]
  ];
  actual record;
BEGIN
  SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl,
         prosecdef, proconfig, prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.body_md5 IS DISTINCT FROM 'bd1d2fd351d8273ddc0ce9e29514ca7'
     OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'DISPATCH_URGENCY_MAIN_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  FOREACH patch SLICE 1 IN ARRAY patches LOOP
    IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN
      RAISE EXCEPTION 'DISPATCH_URGENCY_MAIN_ANCHOR_DRIFT';
    END IF;
    d := replace(d,patch[1],patch[2]);
  END LOOP;
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS NOT DISTINCT FROM actual.body_md5
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
     OR EXISTS (SELECT 1 FROM pg_proc WHERE oid=target AND
       (position('urgent' in lower(prosrc))>0 OR position('hitno' in lower(prosrc))>0
        OR position('timetier' in lower(prosrc))>0 OR position('available_now' in lower(prosrc))>0))
     OR position('private.candidate_budget(false' in (SELECT prosrc FROM pg_proc WHERE oid=target))=0
     OR position('p_urgency => ''NORMAL''' in (SELECT prosrc FROM pg_proc WHERE oid=target))=0
  THEN RAISE EXCEPTION 'DISPATCH_URGENCY_MAIN_POSTIMAGE_DRIFT'; END IF;
END
$main$;

DO $remote$
DECLARE
  target regprocedure := 'private.dispatch_remote_wave_v1b(uuid,jsonb,jsonb,text,integer,integer,integer,integer,integer,integer,integer,integer)'::regprocedure;
  d text;
  original_metadata jsonb;
  patch text[];
  patches text[][] := ARRAY[
    ARRAY[$old$daily_cap integer := case when urg = 'URGENT' then null else (cfgb->>'workerDailyCap')::integer end;$old$, $new$daily_cap integer := (cfgb->>'workerDailyCap')::integer;$new$],
    ARRAY[$old$pace_minutes := case when urg = 'URGENT' then least(wave_minutes, windowm) else wave_minutes end;$old$, $new$pace_minutes := wave_minutes;$new$],
    ARRAY[$old$  if urg = 'URGENT' then valid_until := least(valid_until, n.urgent_expires_at); end if;
$old$, $new$$new$],
    ARRAY[$old$values (roundid,n.id,n.revision,roundno,urg,batch,target,batch,'FIXED','SENT',deadline);$old$, $new$values (roundid,n.id,n.revision,roundno,'NORMAL',batch,target,batch,'FIXED','SENT',deadline);$new$],
    ARRAY[$old$order by coalesce((s.detail->>'timeTier')::integer, 9), (s.detail->>'score')::numeric desc, s.pid$old$, $new$order by (s.detail->>'score')::numeric desc, s.pid$new$],
    ARRAY[$old$p_urgency => case when urg = 'URGENT' then 'HITNO' else 'NORMAL' end,$old$, $new$p_urgency => 'NORMAL',$new$],
    ARRAY[$old$'round', roundno, 'urgency', urg,$old$, $new$'round', roundno, 'urgency', 'NORMAL',$new$],
    ARRAY[$old$  --   * the next wave comes remoteWaveMinutes after the previous one (an urgent task: its own, shorter window), no matter who wakes the
  --     task up (a changed profile re-queues it at once): an early call answers "waiting" with the time it is due;
$old$, $new$  --   * the next wave comes remoteWaveMinutes after the previous one, no matter who wakes the task up (a changed profile re-queues it
  --     at once): an early call answers "waiting" with the time it is due;
$new$],
    ARRAY[$old$    -- "Mogu odmah" first for a task danas/odmah (timeTier 1), then the schedule (2); score within a tier.
$old$, $new$    -- Common match score, then stable profile identity; no availability-now priority.
$new$]
  ];
  actual record;
BEGIN
  SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl,
         prosecdef, proconfig, prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.body_md5 IS DISTINCT FROM '2ba676d2f0fbd1456b48eb1ef36b468e'
     OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'DISPATCH_URGENCY_REMOTE_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  FOREACH patch SLICE 1 IN ARRAY patches LOOP
    IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN
      RAISE EXCEPTION 'DISPATCH_URGENCY_REMOTE_ANCHOR_DRIFT';
    END IF;
    d := replace(d,patch[1],patch[2]);
  END LOOP;
  EXECUTE d;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS NOT DISTINCT FROM actual.body_md5
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
     OR EXISTS (SELECT 1 FROM pg_proc WHERE oid=target AND
       (position('urgent' in lower(prosrc))>0 OR position('hitno' in lower(prosrc))>0
        OR position('timetier' in lower(prosrc))>0 OR position('available_now' in lower(prosrc))>0))
     OR position('pace_minutes := wave_minutes' in (SELECT prosrc FROM pg_proc WHERE oid=target))=0
  THEN RAISE EXCEPTION 'DISPATCH_URGENCY_REMOTE_POSTIMAGE_DRIFT'; END IF;
END
$remote$;

COMMIT;
