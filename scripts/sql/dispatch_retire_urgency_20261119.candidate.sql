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
              then 'URGENT' else 'NORMAL' end;$old$, $new$  -- retired branch removed
  $new$],
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
  IF NOT FOUND OR actual.body_md5 IS DISTINCT FROM 'bd1d2fd351d8273ddc0cce9e29514ca7'
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
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM 'e6ef0105afda31ce120a0cde6626b0d6'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
     OR EXISTS (SELECT 1 FROM pg_proc WHERE oid=target AND
       (position('urgent' in lower(prosrc))>0 OR position('hitno' in lower(prosrc))>0
        OR position('timetier' in lower(prosrc))>0 OR position('available_now' in lower(prosrc))>0))
     OR position('private.candidate_budget(false' in (SELECT prosrc FROM pg_proc WHERE oid=target))=0
     OR position('p_urgency => ''NORMAL''' in (SELECT prosrc FROM pg_proc WHERE oid=target))=0
     OR position('where key = ''dispatch_normal''' in (SELECT prosrc FROM pg_proc WHERE oid=target))=0
     OR position('daily_cap := (cfgb->>''workerDailyCap'')::integer' in (SELECT prosrc FROM pg_proc WHERE oid=target))=0
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
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '8227474bb353238ee09816ea5085666e'
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
     OR EXISTS (SELECT 1 FROM pg_proc WHERE oid=target AND
       (position('urgent' in lower(prosrc))>0 OR position('hitno' in lower(prosrc))>0
        OR position('timetier' in lower(prosrc))>0 OR position('available_now' in lower(prosrc))>0))
     OR position('pace_minutes := wave_minutes' in (SELECT prosrc FROM pg_proc WHERE oid=target))=0
     OR position('daily_cap integer := (cfgb->>''workerDailyCap'')::integer' in (SELECT prosrc FROM pg_proc WHERE oid=target))=0
     OR position('p_urgency => ''NORMAL''' in (SELECT prosrc FROM pg_proc WHERE oid=target))=0
  THEN RAISE EXCEPTION 'DISPATCH_URGENCY_REMOTE_POSTIMAGE_DRIFT'; END IF;
END
$remote$;

-- Full active urgency retirement; historical rows and columns remain untouched.


DO $retire_worker_notify_cap$ DECLARE target regprocedure := 'private.worker_notify_room_v1b(uuid,integer)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[]; patches text[][] := ARRAY[
 ARRAY[$old$  -- It counts the worker's own OPPORTUNITY_AVAILABLE events of normal urgency created in the last 24 hours: the event the
  -- dispatch wave emits for every notified worker (private.dispatch_next_wave -> private.emit_event). Urgent (HITNO) events and
  -- every other event type (responses, agreements, messages, reviews ...) are NOT counted. A null cap means "no cap".$old$,$new$  -- It counts every OPPORTUNITY_AVAILABLE event created in the last 24 hours,
  -- regardless of legacy urgency metadata. A null cap means "no cap".$new$],
 ARRAY[$old$         and e.urgency = 'NORMAL'
$old$,$new$$new$]
]; BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '9aac9da0479327fdf82b2f9298e47719' OR actual.owner IS DISTINCT FROM 'postgres' OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}' OR actual.prosecdef IS DISTINCT FROM true OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f' THEN RAISE EXCEPTION 'RETIRE_WORKER_NOTIFY_CAP_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'RETIRE_WORKER_NOTIFY_CAP_PATCH_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM 'e3e40bcc507bb0a99817d8cdd555dbcc' OR actual.metadata IS DISTINCT FROM original_metadata 
 OR position('e.urgency' in lower((SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)))>0 THEN RAISE EXCEPTION 'RETIRE_WORKER_NOTIFY_CAP_POSTIMAGE_MISMATCH'; END IF;
 END $retire_worker_notify_cap$;


DO $retire_push_quiet_bypass$ DECLARE target regprocedure := 'private.push_suppression(public.notification_deliveries)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[]; patches text[][] := ARRAY[
 ARRAY[$old$     and not(e.urgency='HITNO' and coalesce(p.urgent_overrides_quiet_hours, true))$old$,$new$$new$]
]; BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM 'ebd9c03035630bde62bf9fd8a27378c2' OR actual.owner IS DISTINCT FROM 'postgres' OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}' OR actual.prosecdef IS DISTINCT FROM true OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f' THEN RAISE EXCEPTION 'RETIRE_PUSH_QUIET_BYPASS_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'RETIRE_PUSH_QUIET_BYPASS_PATCH_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM 'e9f104bc1a62aefd73d52fee8294c52d' OR actual.metadata IS DISTINCT FROM original_metadata 
 OR position('hitno' in lower((SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)))>0 THEN RAISE EXCEPTION 'RETIRE_PUSH_QUIET_BYPASS_POSTIMAGE_MISMATCH'; END IF;
 END $retire_push_quiet_bypass$;


DO $retire_same_day_urgent_match_gate$ DECLARE target regprocedure := 'private.match_detail_without_calendar(uuid,uuid)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[]; patches text[][] := ARRAY[
 ARRAY[$old$  if n.urgent
     and (n.schedule_kind = 'TODAY_FLEXIBLE'
          or (n.starts_at is not null and (n.starts_at at time zone tz)::date = (statement_timestamp() at time zone tz)::date))
     and not coalesce(pref.same_day_urgent_notifications,true)
    then disp := array_append(disp,'SAME_DAY_URGENT_NOTIFICATIONS_PAUSED'); end if;
$old$,$new$$new$]
]; BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '41b54908d3f461420c3826ad8b723880' OR actual.owner IS DISTINCT FROM 'postgres' OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}' OR actual.prosecdef IS DISTINCT FROM true OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f' THEN RAISE EXCEPTION 'RETIRE_SAME_DAY_URGENT_MATCH_GATE_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'RETIRE_SAME_DAY_URGENT_MATCH_GATE_PATCH_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '2f9e140d4e938f6c7dda8829d41dd04a' OR actual.metadata IS DISTINCT FROM original_metadata 
 OR position('same_day_urgent' in lower((SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)))>0 THEN RAISE EXCEPTION 'RETIRE_SAME_DAY_URGENT_MATCH_GATE_POSTIMAGE_MISMATCH'; END IF;
 END $retire_same_day_urgent_match_gate$;


DO $retire_event_priority$ DECLARE target regprocedure := 'private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[]; patches text[][] := ARRAY[
 ARRAY[$old$v_prio text := case when p_urgency = 'HITNO' then 'HIGH' else 'NORMAL' end;$old$,$new$v_prio text := 'NORMAL';$new$],
 ARRAY[$old$  p_title := private.notification_copy_v5(p_title);$old$,$new$  p_urgency := 'NORMAL';
  p_title := private.notification_copy_v5(p_title);$new$],
 ARRAY[$old$  -- 4) PUSH — tihi sati se postuju osim uz izricit opt-in za HITNO$old$,$new$  -- 4) PUSH — tihi sati se postuju za sve dogadjaje$new$],
 ARRAY[$old$    when v_quiet and not (p_urgency = 'HITNO' and v_prefs.urgent_overrides_quiet_hours)$old$,$new$    when v_quiet$new$],
 ARRAY[$old$  v_prefs.urgent_overrides_quiet_hours := false;
$old$,$new$$new$]
]; BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '586c40786332a9863922585503f083f6' OR actual.owner IS DISTINCT FROM 'postgres' OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}' OR actual.prosecdef IS DISTINCT FROM true OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp']::text[] OR actual.prokind IS DISTINCT FROM 'f' THEN RAISE EXCEPTION 'RETIRE_EVENT_PRIORITY_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'RETIRE_EVENT_PRIORITY_PATCH_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '60ae03c2d6acf0f01b86a8470881f6e4' OR actual.metadata IS DISTINCT FROM original_metadata 
 OR position('hitno' in lower((SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)))>0 OR position('high' in lower((SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)))>0 THEN RAISE EXCEPTION 'RETIRE_EVENT_PRIORITY_POSTIMAGE_MISMATCH'; END IF;
 END $retire_event_priority$;


DO $retire_push_priority_order$ DECLARE target regprocedure := 'public.rpc_claim_push_transport(text)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[]; patches text[][] := ARRAY[
 ARRAY[$old$  -- HIGH receives a one-minute ordering advantage. Older normal work then
  -- overtakes newer HIGH arrivals, so a sustained burst cannot starve it.
  order by x.created_at-case when x.priority='HIGH' then interval '1 minute' else interval '0 seconds' end,x.created_at,x.id limit 64 for update skip locked loop$old$,$new$  -- FIFO ordering: historical priority metadata never changes delivery order.
  order by x.created_at,x.id limit 64 for update skip locked loop$new$]
]; BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '7c9145f1b9696f9ed6e4a29949228b58' OR actual.owner IS DISTINCT FROM 'postgres' OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' OR actual.prosecdef IS DISTINCT FROM true OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f' THEN RAISE EXCEPTION 'RETIRE_PUSH_PRIORITY_ORDER_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'RETIRE_PUSH_PRIORITY_ORDER_PATCH_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '60d39927470ef866f7757212ea1ddfe1' OR actual.metadata IS DISTINCT FROM original_metadata 
 OR position('high' in lower((SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)))>0 THEN RAISE EXCEPTION 'RETIRE_PUSH_PRIORITY_ORDER_POSTIMAGE_MISMATCH'; END IF;
 END $retire_push_priority_order$;


DO $retire_push_priority_projection$ DECLARE target regprocedure := 'public.rpc_begin_push_send(uuid,uuid)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[]; patches text[][] := ARRAY[
 ARRAY[$old$priority',d.priority,$old$,$new$priority','NORMAL',$new$]
]; BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM 'e693b140450a9bb1cf6d3178b0ad80c1' OR actual.owner IS DISTINCT FROM 'postgres' OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' OR actual.prosecdef IS DISTINCT FROM true OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f' THEN RAISE EXCEPTION 'RETIRE_PUSH_PRIORITY_PROJECTION_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'RETIRE_PUSH_PRIORITY_PROJECTION_PATCH_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM 'c6b35e8fa0069acdc96a7be851a5ef5f' OR actual.metadata IS DISTINCT FROM original_metadata 
 OR position('d.priority' in lower((SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)))>0 THEN RAISE EXCEPTION 'RETIRE_PUSH_PRIORITY_PROJECTION_POSTIMAGE_MISMATCH'; END IF;
 END $retire_push_priority_projection$;


DO $retire_open_task_urgency_filter$ DECLARE target regprocedure := 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[];
patches text[][] := ARRAY[
 ARRAY[$old$v_category text; v_price_mode text; v_urgent_only boolean := false; v_remote text := 'INCLUDE';$old$,$new$v_category text; v_price_mode text; v_remote text := 'INCLUDE';$new$],
 ARRAY[$old$or v_filters - array['category','priceMode','urgentOnly','remote','startsFrom','startsTo','needId','homePreview'] <> '{}'::jsonb then$old$,$new$or v_filters - array['category','priceMode','remote','startsFrom','startsTo','needId','homePreview'] <> '{}'::jsonb then$new$],
 ARRAY[$old$  if v_filters ? 'urgentOnly' then
    if jsonb_typeof(v_filters->'urgentOnly') <> 'boolean' then raise exception 'INVALID_FILTER' using errcode = '22023'; end if;
    v_urgent_only := (v_filters->>'urgentOnly')::boolean;
  end if;
$old$,$new$$new$],
 ARRAY[$old$      'title', n.title, 'category', n.category, 'status', n.status, 'urgent', n.urgent,$old$,$new$      'title', n.title, 'category', n.category, 'status', n.status,$new$]
];
BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '7c1d9a979585deae6c2bc2c1b9d597b1' OR actual.owner IS DISTINCT FROM 'postgres'
 OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' OR actual.prosecdef IS DISTINCT FROM false
 OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f'
 THEN RAISE EXCEPTION 'RETIRE_OPEN_TASK_URGENCY_FILTER_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'RETIRE_OPEN_TASK_URGENCY_FILTER_PATCH_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 IF array_length(string_to_array(d,$old$m.verified_identity_required, m.urgent, m.public_photo_paths$old$),1) IS DISTINCT FROM 4 THEN RAISE EXCEPTION 'RETIRE_OPEN_TASK_URGENCY_SELECT_ANCHOR_DRIFT'; END IF;
 d:=replace(d,$old$m.verified_identity_required, m.urgent, m.public_photo_paths$old$,$new$m.verified_identity_required, m.public_photo_paths$new$);
 IF array_length(string_to_array(d,$old$m.response_deadline, m.urgent_activated_at, m.urgent_expires_at, m.urgent_policy_version, m.minimum_experience_years$old$),1) IS DISTINCT FROM 4 THEN RAISE EXCEPTION 'RETIRE_OPEN_TASK_URGENCY_META_ANCHOR_DRIFT'; END IF;
 d:=replace(d,$old$m.response_deadline, m.urgent_activated_at, m.urgent_expires_at, m.urgent_policy_version, m.minimum_experience_years$old$,$new$m.response_deadline, m.minimum_experience_years$new$);
 IF array_length(string_to_array(d,$old$        and (not v_urgent_only or m.urgent)
$old$),1) IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'RETIRE_OPEN_TASK_URGENCY_FILTER_PREDICATE_DRIFT'; END IF;
 d:=replace(d,$old$        and (not v_urgent_only or m.urgent)
$old$,$new$$new$);
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '8e8ee643e72c9efab746b6a9e7f6ec08' OR actual.metadata IS DISTINCT FROM original_metadata
 OR position('urgent' in lower((SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)))>0 THEN RAISE EXCEPTION 'RETIRE_OPEN_TASK_URGENCY_FILTER_POSTIMAGE_MISMATCH'; END IF;
END $retire_open_task_urgency_filter$;


DO $retire_discovery_urgency_projection$ DECLARE target regprocedure := 'public.rpc_discovery_v1(jsonb)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[]; patches text[][] := ARRAY[
 ARRAY[$old$  select n.id,n.revision,n.published_at,n.title,n.category,n.status,n.urgent,n.schedule_kind,n.starts_at,n.ends_at,n.execution_location_mode,$old$,$new$  select n.id,n.revision,n.published_at,n.title,n.category,n.status,n.schedule_kind,n.starts_at,n.ends_at,n.execution_location_mode,$new$],
 ARRAY[$old$   'publishedAt',s.published_at,'title',s.title,'category',s.category,'status',s.status,'urgent',s.urgent,$old$,$new$   'publishedAt',s.published_at,'title',s.title,'category',s.category,'status',s.status,$new$]
]; BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM 'c75535d3f77b2216ed424843ef57ef04' OR actual.owner IS DISTINCT FROM 'postgres' OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' OR actual.prosecdef IS DISTINCT FROM false OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f' THEN RAISE EXCEPTION 'RETIRE_DISCOVERY_URGENCY_PROJECTION_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'RETIRE_DISCOVERY_URGENCY_PROJECTION_PATCH_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM 'dc53bf4f14b1e35fdb1e12ff883d1edb' OR actual.metadata IS DISTINCT FROM original_metadata 
 OR position('urgent' in lower((SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)))>0 THEN RAISE EXCEPTION 'RETIRE_DISCOVERY_URGENCY_PROJECTION_POSTIMAGE_MISMATCH'; END IF;
 END $retire_discovery_urgency_projection$;


DO $retire_task_urgency_projection$ DECLARE target regprocedure := 'public.rpc_read_task(uuid)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[]; patches text[][] := ARRAY[
 ARRAY[$old$    'urgent', n.urgent,$old$,$new$$new$],
 ARRAY[$old$    'urgent_activated_at', n.urgent_activated_at,$old$,$new$$new$],
 ARRAY[$old$    'urgent_expires_at', n.urgent_expires_at,$old$,$new$$new$],
 ARRAY[$old$    'urgent_policy_version', n.urgent_policy_version,$old$,$new$$new$]
]; BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '1e01db5140248f27ab374187f01fded3' OR actual.owner IS DISTINCT FROM 'postgres' OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' OR actual.prosecdef IS DISTINCT FROM false OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f' THEN RAISE EXCEPTION 'RETIRE_TASK_URGENCY_PROJECTION_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'RETIRE_TASK_URGENCY_PROJECTION_PATCH_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '6989659ffc9d6445333ab06e6df9c597' OR actual.metadata IS DISTINCT FROM original_metadata 
 OR position('urgent' in lower((SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)))>0 THEN RAISE EXCEPTION 'RETIRE_TASK_URGENCY_PROJECTION_POSTIMAGE_MISMATCH'; END IF;
 END $retire_task_urgency_projection$;


DO $retire_profile_available_now_projection$ DECLARE target regprocedure := 'public.rpc_get_worker_profile_for_edit()'::regprocedure; actual record; d text; original_metadata jsonb; patch text[]; patches text[][] := ARRAY[
 ARRAY[$old$profile_status',p.profile_status,'available_now',p.available_now,$old$,$new$profile_status',p.profile_status,$new$]
]; BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '0b081654ef574b197d978d31db362d68' OR actual.owner IS DISTINCT FROM 'postgres' OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' OR actual.prosecdef IS DISTINCT FROM true OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f' THEN RAISE EXCEPTION 'RETIRE_PROFILE_AVAILABLE_NOW_PROJECTION_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'RETIRE_PROFILE_AVAILABLE_NOW_PROJECTION_PATCH_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM 'fbb1c121f266200dc2d456e17ceac35f' OR actual.metadata IS DISTINCT FROM original_metadata 
 OR position('available_now' in lower((SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)))>0 THEN RAISE EXCEPTION 'RETIRE_PROFILE_AVAILABLE_NOW_PROJECTION_POSTIMAGE_MISMATCH'; END IF;
 END $retire_profile_available_now_projection$;


DO $retire_need_urgency_read$ DECLARE target regprocedure := 'public.fn_need_urgency(uuid)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[]; patches text[][] := ARRAY[
 ARRAY[$old$level', case when n.urgent and n.urgent_expires_at > statement_timestamp()
                  then 'HITNO' else 'NORMAL' end,$old$,$new$level', 'NORMAL',$new$],
 ARRAY[$old$activatedAt', case when n.urgent and n.urgent_expires_at > statement_timestamp()
                        then n.urgent_activated_at end,$old$,$new$activatedAt', null,$new$],
 ARRAY[$old$expiresAt', case when n.urgent and n.urgent_expires_at > statement_timestamp()
                      then n.urgent_expires_at end,$old$,$new$expiresAt', null,$new$],
 ARRAY[$old$policyVersion', n.urgent_policy_version,$old$,$new$policyVersion', null,$new$],
 ARRAY[$old$reasonCodes', case
      when n.urgent and n.urgent_expires_at > statement_timestamp()
        then jsonb_build_array('URGENT_ACTIVE')
      when n.urgent then jsonb_build_array('URGENT_WINDOW_EXPIRED')
      else jsonb_build_array('NOT_URGENT') end,$old$,$new$reasonCodes', jsonb_build_array('URGENCY_RETIRED'),$new$]
]; BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '8845c7ad50ab5e64aa853043c113a15a' OR actual.owner IS DISTINCT FROM 'postgres' OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' OR actual.prosecdef IS DISTINCT FROM false OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f' THEN RAISE EXCEPTION 'RETIRE_NEED_URGENCY_READ_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'RETIRE_NEED_URGENCY_READ_PATCH_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '1b59a466661a3c7400fcced26ad17f7d' OR actual.metadata IS DISTINCT FROM original_metadata 
 OR position('hitno' in lower((SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)))>0 THEN RAISE EXCEPTION 'RETIRE_NEED_URGENCY_READ_POSTIMAGE_MISMATCH'; END IF;
 END $retire_need_urgency_read$;


DO $retire_urgent_activation_rpc$ DECLARE target regprocedure := 'public.rpc_activate_urgent(uuid,integer)'::regprocedure; actual record; d text; old_body text; original_metadata jsonb;
new_body text := E'\nbegin\n  raise exception ''URGENT_FEATURE_RETIRED'' using errcode = ''55000'';\nend;\n';
BEGIN
 SELECT md5(p.prosrc) body_md5,p.prosrc,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM 'e3d13df0b0cf181334a30efa7576a312' OR actual.owner IS DISTINCT FROM 'postgres'
 OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' OR actual.prosecdef IS DISTINCT FROM true
 OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f'
 THEN RAISE EXCEPTION 'RETIRE_URGENT_ACTIVATION_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; old_body:=actual.prosrc; d:=pg_get_functiondef(target);
 IF array_length(string_to_array(d,old_body),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'RETIRE_URGENT_ACTIVATION_BODY_ANCHOR_DRIFT'; END IF;
 d:=replace(d,old_body,new_body); EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM 'fd0cfe668f4ee12451ab316ac46a6215' OR actual.metadata IS DISTINCT FROM original_metadata THEN RAISE EXCEPTION 'RETIRE_URGENT_ACTIVATION_POSTIMAGE_MISMATCH'; END IF;
END $retire_urgent_activation_rpc$;

DO $retire_lifecycle_urgent_expiry$
DECLARE
  target regprocedure := 'private.expire_lifecycle(timestamptz)'::regprocedure;
  actual record;
  d text;
  original_metadata jsonb;
  patch text[];
  patches text[][] := ARRAY[
    ARRAY[$old$  ur := private.expire_urgent(p_at);$old$, $new$  ur := 0; -- Urgency is retired; historical rows are preserved.$new$]
  ];
BEGIN
  SELECT md5(p.prosrc) body_md5, pg_get_userbyid(p.proowner) owner, p.proacl::text acl,
         p.prosecdef, p.proconfig, p.prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF actual.body_md5 IS DISTINCT FROM '2e13f16eb5f760c1a8a3ebbf59fb60a9'
     OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'RETIRE_LIFECYCLE_URGENCY_EXPIRY_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  FOREACH patch SLICE 1 IN ARRAY patches LOOP
    IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN
      RAISE EXCEPTION 'RETIRE_LIFECYCLE_URGENCY_EXPIRY_ANCHOR_DRIFT';
    END IF;
    d := replace(d,patch[1],patch[2]);
  END LOOP;
  EXECUTE d;
  SELECT md5(p.prosrc) body_md5, to_jsonb(p)-'prosrc' metadata INTO actual
    FROM pg_proc p WHERE p.oid=target;
  IF actual.body_md5 IS DISTINCT FROM '52525fafc3bd45b1a6f751ebd0ea0c4e'
     OR actual.metadata IS DISTINCT FROM original_metadata
     OR position('expire_urgent' in lower((SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)))>0
  THEN RAISE EXCEPTION 'RETIRE_LIFECYCLE_URGENCY_EXPIRY_POSTIMAGE_MISMATCH'; END IF;
END
$retire_lifecycle_urgent_expiry$;

DO $retire_urgent_activation_preview$
DECLARE
  target regprocedure := 'public.rpc_urgent_activation_preview(uuid)'::regprocedure;
  actual record;
  d text;
  old_body text;
  original_metadata jsonb;
  new_body text := E'\nbegin\n  raise exception ''URGENT_FEATURE_RETIRED'' using errcode = ''55000'';\nend;\n';
BEGIN
  SELECT md5(p.prosrc) body_md5, p.prosrc, pg_get_userbyid(p.proowner) owner,
         p.proacl::text acl, p.prosecdef, p.proconfig, p.prokind,
         to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF actual.body_md5 IS DISTINCT FROM 'e0d15c6769a737e23041283d20f84db9'
     OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'RETIRE_URGENT_ACTIVATION_PREVIEW_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  old_body := actual.prosrc;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d,old_body),1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'RETIRE_URGENT_ACTIVATION_PREVIEW_BODY_ANCHOR_DRIFT';
  END IF;
  d := replace(d,old_body,new_body);
  EXECUTE d;
  SELECT md5(p.prosrc) body_md5, to_jsonb(p)-'prosrc' metadata INTO actual
    FROM pg_proc p WHERE p.oid=target;
  IF actual.body_md5 IS DISTINCT FROM 'fd0cfe668f4ee12451ab316ac46a6215'
     OR actual.metadata IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'RETIRE_URGENT_ACTIVATION_PREVIEW_POSTIMAGE_MISMATCH'; END IF;
END
$retire_urgent_activation_preview$;

COMMIT;
