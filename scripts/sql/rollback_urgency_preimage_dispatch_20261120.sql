-- USKOCI DEV rollback preimage captured 2026-11-20.
-- Restore only as a controlled rollback after reviewing the paired retirement migration.
-- CREATE OR REPLACE preserves current ownership and ACLs; metadata is recorded above each definition.
BEGIN;
-- private.dispatch_next_wave(uuid) | md5=bd1d2fd351d8273ddc0cce9e29514ca7 | owner=postgres | acl={postgres=X/postgres} | security_definer=t | config={search_path=pg_catalog}\nCREATE OR REPLACE FUNCTION private.dispatch_next_wave(nid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs;
  cfg jsonb; sizes jsonb; budget jsonb; urgcfg jsonb;
  roundno integer; policy_wave_no integer;
  batch integer; target integer; windowm integer; min_choice integer;
  candidate_limit integer; budget_source text;
  active integer; active_coverage integer; selected integer; remaining integer;
  roundid uuid := gen_random_uuid();
  inserted integer := 0;
  c record; d jsonb; deadline timestamptz; urg text;
  -- MATCH-V1 (owner 2026-10-07): the switch row private.marketplace_config 'match_v1_dispatch' (see below).
  sw jsonb; all_mode boolean := false; sw_ceiling integer; sw_valid integer; delivered integer := 0; valid_until timestamptz;
  -- MATCH-V1B (owner 2026-10-07): the checked knobs of the new layers, whether this task is sent in waves, the per-worker daily cap.
  cfgb jsonb; remote_on boolean := false; daily_cap integer;
  -- MATCH-V1B: the notify budget of one database transaction (the lock table), what the transaction has used, and whether a wave was cut by it.
  tx_budget integer; tx_used integer := 0; chunked boolean := false;
begin
  select * into n from public.needs where id = nid for update;
  if not found then raise exception using errcode='P0002', message='NEED_NOT_FOUND'; end if;

  if n.status not in ('PUBLISHED','SELECTION') then
    return jsonb_build_object('status','STOPPED','reason','NEED_NOT_OPEN','inserted',0);
  end if;

  if n.remaining_search_closed_at is not null then
    return jsonb_build_object('status','STOPPED','reason','REMAINING_SEARCH_CLOSED','inserted',0);
  end if;

  if not private.need_search_time_admitted_v1(n.id, clock_timestamp()) then
    return jsonb_build_object('status','STOPPED','reason','SEARCH_WINDOW_CLOSED','inserted',0);
  end if;

  select coalesce(sum(covered_slots),0) into selected
    from public.need_selections where need_id = nid and status = 'SELECTED';
  remaining := greatest(0, n.required_slots - selected);
  if remaining = 0 then
    return jsonb_build_object('status','STOPPED','reason','SLOTS_FILLED','inserted',0,
      'selectedSlots',selected,'remainingSlots',0);
  end if;

  select count(*), coalesce(sum(covered_slots),0) into active, active_coverage
    from public.marketplace_responses
   where need_id = nid and submitted_against_need_revision = n.revision
     and status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED');

  -- Hitnost se cita iz projekcije, ne iz sirove zastavice: istekao prozor je NORMAL.
  urg := case when coalesce(n.urgent,false) and n.urgent_expires_at > statement_timestamp()
              then 'URGENT' else 'NORMAL' end;

  select value into cfg from private.marketplace_config
   where key = case when urg = 'URGENT' then 'dispatch_urgent' else 'dispatch_normal' end;
  if cfg is null then raise exception using errcode='55000', message='DISPATCH_CONFIG_MISSING'; end if;

  sizes := cfg->'waveSizes';
  target := (cfg->>'targetResponses')::integer;
  windowm := (cfg->>'windowMinutes')::integer;
  if jsonb_typeof(sizes) <> 'array' or jsonb_array_length(sizes) = 0
     or target is null or target < 1 or windowm is null or windowm < 1 then
    raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
  end if;

  -- MATCH-V1 (owner 2026-10-07): HOW does this server dispatch? One switch row decides; turning the ladder on needs no code change.
  --   mode ALL (the default of this package): ONE wave to EVERY worker the shared rule admits, nearest first, in this tick. No group of
  --     5 / 5 / 10 / 20, no waiting window between groups, no stop after N responses (a stop would starve later workers of their
  --     notification). A worker who becomes eligible later (a new or a changed profile) is reached by the next wave of the same task
  --     (the profile re-queue); a worker already notified for this revision is never notified twice. Safety ceiling: at most 'ceiling'
  --     notified workers per task REVISION (default 500). Above it nobody more is notified for that revision: the task stays on the
  --     map and the list for everyone and applying stays open; the wave answers DELIVERY_CEILING_REACHED (the tick records it in
  --     dispatch_schedule.last_reason and keeps its normal back-off check); raising the ceiling continues with the workers not yet
  --     notified, nearest first. Deliveries and their notifications stay valid for 'validMinutes' (default 24 h): the push transport
  --     needs time to reach hundreds of workers and an expired notification would be a worker who never heard of the task.
  --   mode LADDER (or no row): today's waves, unchanged (dispatch_normal / dispatch_urgent: waveSizes, windowMinutes, targetResponses,
  --     candidate budget). "Mogu odmah" first (timeTier) orders the workers inside a wave in both modes.
  select value into sw from private.marketplace_config where key = 'match_v1_dispatch';
  if sw is not null then
    if jsonb_typeof(sw) <> 'object' or coalesce(sw->>'mode','') not in ('ALL','LADDER') then
      raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
    end if;
    all_mode := sw->>'mode' = 'ALL';
  end if;
  if all_mode then
    begin
      sw_ceiling := (sw->>'ceiling')::integer;
      sw_valid := (sw->>'validMinutes')::integer;
    exception when others then
      raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
    end;
    if sw_ceiling is null or sw_ceiling < 1 or sw_ceiling > 10000 or sw_valid is null or sw_valid < 1 or sw_valid > 10080 then
      raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
    end if;
    -- MATCH-V1B (owner 2026-10-07): three layers on top of mode ALL (the knobs are checked here; a bad one is the named error):
    --   1. a task WITHOUT a place (remote, or without coordinates) is sent in WAVES (private.dispatch_remote_wave_v1b) with its own
    --      ceiling, instead of one wave to everybody;
    --   2. a worker who already got workerDailyCap proactive new-task notifications in the last 24 hours is skipped for this task,
    --      without using up a place of any ceiling; an urgent task ignores the cap;
    --   3. a task WITH a place keeps the one wave and the ceiling of MATCH-V1, but one database transaction (one tick) notifies at most
    --      workerNotifyPerTransaction workers in all (every notified recipient holds two locks of the shared lock table until the end
    --      of the transaction, about 4,800 entries on the whole server): a larger wave is sent in chunks, one per tick.
    -- The ladder (mode LADDER) never reaches this block.
    cfgb := private.dispatch_config_v1b(sw);
    remote_on := (cfgb->>'remoteWaves')::boolean
                 and not coalesce((n.execution_location_mode in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED'))
                                  and n.approx_geog is not null, false);
    daily_cap := case when urg = 'URGENT' then null else (cfgb->>'workerDailyCap')::integer end;
    tx_budget := (cfgb->>'notifyBudget')::integer;
    tx_used := coalesce(nullif(current_setting('v1b.notified', true), '')::integer, 0);
    select count(*) into delivered from public.opportunity_deliveries where need_id = nid and need_revision = n.revision;
    if delivered >= sw_ceiling and not remote_on then
      return jsonb_build_object('status','STOPPED','reason','DELIVERY_CEILING_REACHED','inserted',0,'mode','ALL','ceiling',sw_ceiling,
        'deliveredBefore',delivered,'activeResponses',active,'activeCoverage',active_coverage,
        'selectedSlots',selected,'remainingSlots',remaining);
    end if;
  end if;

  -- MATCH-V1B: a task without a place goes to the waves of the remote function (its own ceiling, pace and stop).
  if remote_on then
    return private.dispatch_remote_wave_v1b(nid, sw, cfgb, urg, windowm, target, remaining, selected, active, active_coverage, delivered, tx_budget - tx_used);
  end if;

  if not all_mode and active >= target and active_coverage >= remaining then
    return jsonb_build_object('status','STOPPED','reason','RESPONSE_TARGET_AND_COVERAGE_REACHED',
      'inserted',0,'activeResponses',active,'activeCoverage',active_coverage,
      'selectedSlots',selected,'remainingSlots',remaining);
  end if;

  if all_mode then
    -- MATCH-V1: every admitted worker, up to what is left of the ceiling of this task revision ('FIXED' is the allowed budget source).
    candidate_limit := sw_ceiling - delivered;
    budget_source := 'FIXED';
    -- MATCH-V1B: the notify budget of this transaction (the lock table). Nothing left: the wave waits for the next tick, due at once.
    -- More workers than what is left: this wave is a chunk of at most that many; a chunk that comes back full is followed by the next one at the next tick.
    if tx_budget - tx_used < 1 then
      return jsonb_build_object('status','SENT','inserted',0,'waiting',true,'deferred','TRANSACTION_NOTIFY_BUDGET','mode','ALL','ceiling',sw_ceiling,
        'deliveredBefore',delivered,'deadlineAt',statement_timestamp(),'txNotifyBudget',tx_budget,'activeResponses',active,'activeCoverage',active_coverage,
        'selectedSlots',selected,'remainingSlots',remaining);
    end if;
    if candidate_limit > tx_budget - tx_used then
      candidate_limit := tx_budget - tx_used;
      chunked := true;
    end if;
  else
    budget := private.candidate_budget(urg = 'URGENT', greatest(0, remaining - active_coverage), cfg);
    candidate_limit := (budget->>'limit')::integer;
    budget_source := budget->>'source';
    if candidate_limit is null or candidate_limit < 1 or candidate_limit > 10000 then
      raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
    end if;
  end if;

  select coalesce(max(round_no),0)+1 into roundno
    from public.dispatch_rounds where need_id = nid and need_revision = n.revision;
  select count(*)+1 into policy_wave_no
    from public.dispatch_rounds
   where need_id = nid and need_revision = n.revision and urgency = urg
     -- PKG-027a: a check that found nobody reached nobody, so it does not use up a wave.
     and not (status = 'STOPPED' and stop_reason = 'NO_ELIGIBLE_CANDIDATES');

  if not all_mode and policy_wave_no > jsonb_array_length(sizes) then
    return jsonb_build_object('status','STOPPED','reason','WAVES_EXHAUSTED','inserted',0,
      'activeResponses',active,'activeCoverage',active_coverage,
      'selectedSlots',selected,'remainingSlots',remaining,'candidateLimit',candidate_limit);
  end if;

  batch := case when all_mode then candidate_limit else (sizes->>(policy_wave_no-1))::integer end;

  -- O-3: pod izbora za HITNO.
  if urg = 'URGENT' and not all_mode then
    select value into urgcfg from private.marketplace_config where key = 'urgent_activation_policy';
    min_choice := coalesce(nullif(urgcfg->>'minChoice','')::integer, 2);
    if min_choice < 2 or min_choice > 10 then min_choice := 2; end if;
    batch := greatest(batch, min_choice);
  end if;

  deadline := statement_timestamp() + make_interval(mins => windowm);
  -- MATCH-V1: 'deadline' is when this wave's window ends (the tick checks the task again then). In mode ALL the deliveries and their
  -- notifications outlive it: they stay valid for 'validMinutes', for an urgent task not beyond the end of its urgency.
  valid_until := deadline;
  if all_mode then
    valid_until := statement_timestamp() + make_interval(mins => sw_valid);
    if urg = 'URGENT' then valid_until := least(valid_until, n.urgent_expires_at); end if;
  end if;

  insert into public.dispatch_rounds(id,need_id,need_revision,round_no,urgency,batch_size,
      target_responses,candidate_limit_used,budget_source,status,deadline_at)
    values (roundid,n.id,n.revision,roundno,urg,batch,target,candidate_limit,budget_source,'SENT',deadline);

  for c in
    with candidate_base as materialized (
      select p.id as pid, p.account_id as uid, pc.candidate_rank
      from private.candidate_profile_ids_v1b(n.id, candidate_limit, daily_cap)
           with ordinality as pc(worker_profile_id, candidate_rank)
      join public.app_profiles p on p.id = pc.worker_profile_id
      order by pc.candidate_rank
    ), scored as materialized (
      select b.pid, b.uid, private.match_detail(n.id, b.pid) as detail from candidate_base b
    )
    select s.pid, s.uid, s.detail from scored s
    where coalesce((s.detail->>'dispatchEligible')::boolean, false)
    -- MATCH-V1: "Mogu odmah" first for a task danas/odmah (timeTier 1), then the schedule (2); score within a tier.
    order by coalesce((s.detail->>'timeTier')::integer, 9), (s.detail->>'score')::numeric desc, s.pid
  loop
    exit when inserted >= batch;
    d := c.detail;
    insert into public.opportunity_deliveries(worker_account_id,worker_profile_id,need_id,
        need_revision,dispatch_round_id,match_score,score_components,reason_codes,status,expires_at)
      values (c.uid,c.pid,n.id,n.revision,roundid,(d->>'score')::numeric,
        coalesce(d->'scoreComponents','{}'::jsonb) || jsonb_build_object(
          'distanceToStartKm', d->'distanceToStartKm',
          'effectiveRadiusKm', d->'effectiveRadiusKm',
          'distanceSource', d->'distanceSource',
          'taskLocationMode', d->'taskLocationMode'),
        array(select jsonb_array_elements_text(d->'reasonCodes')), 'READY', valid_until)
      on conflict do nothing;

    if found then
      inserted := inserted + 1;
      perform private.emit_event(
        p_recipient => c.uid, p_role => 'WORKER',
        p_event_type => 'OPPORTUNITY_AVAILABLE',
        p_entity_type => 'NEED', p_entity_id => n.id, p_entity_version => n.revision,
        p_title => 'Nova prilika koja može da Vam odgovara',
        p_body => left(n.title,140),
        p_dedupe_key => 'opp:'||n.id::text||':'||n.revision::text||':'||c.uid::text,
        p_urgency => case when urg = 'URGENT' then 'HITNO' else 'NORMAL' end,
        p_payload => jsonb_build_object('needRevision',n.revision,
                       'reasonCodes',d->'reasonCodes','remainingSlots',remaining),
        p_expires_at => valid_until);
    end if;
  end loop;

  if inserted = 0 then
    update public.dispatch_rounds
       set status = 'STOPPED', stop_reason = 'NO_ELIGIBLE_CANDIDATES'
     where id = roundid;
  end if;

  -- MATCH-V1B: what this transaction has notified so far (read by the next task of the same tick; a rolled-back task takes its share back with it).
  if all_mode then
    perform set_config('v1b.notified', (tx_used + inserted)::text, true);
    if chunked and inserted >= batch then deadline := statement_timestamp(); end if;
  end if;

  return jsonb_build_object(
    'status', case when inserted > 0 then 'SENT' else 'STOPPED' end,
    'round', roundno, 'policyWaveNo', policy_wave_no, 'urgency', urg,
    'inserted', inserted, 'batchSize', batch, 'minChoice', min_choice,
    'deadlineAt', deadline,
    'activeResponses', active, 'activeCoverage', active_coverage,
    'selectedSlots', selected, 'remainingSlots', remaining,
    'candidateLimit', candidate_limit, 'budgetSource', budget_source,
    'routingCallsUsed', 0, 'routingProvider', null,
    'candidateRetrieval', 'CLEAN_STREAMING_BOUNDED_GEO_KNN',
    'authoritative', true)
    || case when all_mode then jsonb_build_object('mode','ALL','ceiling',sw_ceiling,'deliveredBefore',delivered,'validUntil',valid_until)
            else '{}'::jsonb end
    || case when inserted = 0 then jsonb_build_object('reason','NO_ELIGIBLE_CANDIDATES') else '{}'::jsonb end
    || case when chunked and inserted >= batch then jsonb_build_object('chunk',true,'txNotifyBudget',tx_budget) else '{}'::jsonb end;
end;
$function$


-- private.dispatch_remote_wave_v1b(uuid,jsonb,jsonb,text,integer,integer,integer,integer,integer,integer,integer,integer) | md5=2ba676d2f0fbd1456b48eb1ef36b468e | owner=postgres | acl={postgres=X/postgres} | security_definer=t | config={search_path=pg_catalog}\nCREATE OR REPLACE FUNCTION private.dispatch_remote_wave_v1b(nid uuid, sw jsonb, cfgb jsonb, urg text, windowm integer, target integer, remaining integer, selected integer, active integer, active_coverage integer, delivered integer, tx_left integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs;
  wave_size integer := (sw->>'remoteWaveSize')::integer;
  next_size integer := (sw->>'remoteNextWaveSize')::integer;
  wave_minutes integer := (sw->>'remoteWaveMinutes')::integer;
  stop_after integer := (sw->>'remoteStopAfterResponses')::integer;
  rem_ceiling integer := (sw->>'remoteCeiling')::integer;
  sw_valid integer := (sw->>'validMinutes')::integer;
  daily_cap integer := case when urg = 'URGENT' then null else (cfgb->>'workerDailyCap')::integer end;
  pace_minutes integer; batch integer; roundno integer; roundid uuid := gen_random_uuid();
  lr_no integer; lr_at timestamptz; lr_empty boolean; streak integer := 0; permitted timestamptz;
  deadline timestamptz; valid_until timestamptz; inserted integer := 0; c record; d jsonb;
begin
  -- MATCH-V1B (owner 2026-10-07): one WAVE of a task without a place (remote, or without coordinates).
  -- Called by private.dispatch_next_wave in mode ALL when remoteWaves is on; the task is locked, open and has room, the knobs are checked.
  --   * the first wave notifies at most remoteWaveSize workers, every later wave at most remoteNextWaveSize: always the NEXT workers of the
  --     rotation seeded by the id of the task (the same order as private.candidate_profile_ids), never a worker twice for one revision of
  --     the task (a new revision starts the rotation again);
  --   * the next wave comes remoteWaveMinutes after the previous one (an urgent task: its own, shorter window), no matter who wakes the
  --     task up (a changed profile re-queues it at once): an early call answers "waiting" with the time it is due;
  --   * waves stop while the task has remoteStopAfterResponses active applications (they go on when applications are withdrawn), and
  --     for good when the task is closed or agreed (the checks of private.dispatch_next_wave before this call);
  --   * at most remoteCeiling workers are notified for one revision of one task: the brake;
  --   * a check that finds nobody new is paced like the tick paces every task that found nobody (5 minutes, growing to 6 hours);
  --   * one transaction (one tick) notifies at most workerNotifyPerTransaction workers in all (every notified recipient holds two locks of
  --     the shared lock table until the transaction ends): a wave that does not fit in what is left of that budget is not started, the
  --     answer is "waiting" and due at once, so the next tick sends it.
  select * into n from public.needs where id = nid;
  if not found then raise exception using errcode='P0002', message='NEED_NOT_FOUND'; end if;

  if delivered >= rem_ceiling then
    return jsonb_build_object('status','STOPPED','reason','DELIVERY_CEILING_REACHED','inserted',0,'mode','ALL','remote',true,
      'ceiling',rem_ceiling,'deliveredBefore',delivered,'activeResponses',active,'activeCoverage',active_coverage,
      'selectedSlots',selected,'remainingSlots',remaining);
  end if;

  if active >= stop_after and active_coverage >= remaining then
    return jsonb_build_object('status','STOPPED','reason','REMOTE_RESPONSE_TARGET_REACHED','inserted',0,'mode','ALL','remote',true,
      'stopAfterResponses',stop_after,'deliveredBefore',delivered,'activeResponses',active,'activeCoverage',active_coverage,
      'selectedSlots',selected,'remainingSlots',remaining);
  end if;

  pace_minutes := case when urg = 'URGENT' then least(wave_minutes, windowm) else wave_minutes end;

  select r.round_no, r.created_at, (r.status = 'STOPPED' and r.stop_reason = 'NO_ELIGIBLE_CANDIDATES')
    into lr_no, lr_at, lr_empty
    from public.dispatch_rounds r
   where r.need_id = nid and r.need_revision = n.revision
   order by r.round_no desc
   limit 1;
  roundno := coalesce(lr_no, 0) + 1;

  if lr_no is not null then
    if coalesce(lr_empty, false) then
      select count(*) into streak from public.dispatch_rounds r
       where r.need_id = nid and r.need_revision = n.revision
         and r.status = 'STOPPED' and r.stop_reason = 'NO_ELIGIBLE_CANDIDATES'
         and r.round_no > coalesce((select max(x.round_no) from public.dispatch_rounds x
                                     where x.need_id = nid and x.need_revision = n.revision
                                       and not (x.status = 'STOPPED' and x.stop_reason = 'NO_ELIGIBLE_CANDIDATES')), 0);
      permitted := lr_at + make_interval(mins => least(360, greatest(5, (2 ^ least(streak - 1, 9))::integer)));
    else
      permitted := lr_at + make_interval(mins => pace_minutes);
    end if;
    if statement_timestamp() < permitted then
      return jsonb_build_object('status','SENT','inserted',0,'waiting',true,'mode','ALL','remote',true,
        'deadlineAt',permitted,'deliveredBefore',delivered,'activeResponses',active,'activeCoverage',active_coverage,
        'selectedSlots',selected,'remainingSlots',remaining);
    end if;
  end if;

  batch := least(case when delivered = 0 then wave_size else next_size end, rem_ceiling - delivered);

  -- the lock table: this transaction has already notified its share, so the wave waits for the next tick (nothing is written)
  if tx_left < batch then
    return jsonb_build_object('status','SENT','inserted',0,'waiting',true,'deferred','TRANSACTION_NOTIFY_BUDGET','mode','ALL','remote',true,
      'deadlineAt',statement_timestamp(),'txNotifyBudget',(cfgb->>'notifyBudget')::integer,'txNotifyLeft',tx_left,'deliveredBefore',delivered,
      'activeResponses',active,'activeCoverage',active_coverage,'selectedSlots',selected,'remainingSlots',remaining);
  end if;

  deadline := statement_timestamp() + make_interval(mins => pace_minutes);
  valid_until := statement_timestamp() + make_interval(mins => sw_valid);
  if urg = 'URGENT' then valid_until := least(valid_until, n.urgent_expires_at); end if;

  insert into public.dispatch_rounds(id,need_id,need_revision,round_no,urgency,batch_size,
      target_responses,candidate_limit_used,budget_source,status,deadline_at)
    values (roundid,n.id,n.revision,roundno,urg,batch,target,batch,'FIXED','SENT',deadline);

  for c in
    select s.pid, s.uid, s.detail from private.remote_wave_candidates_v1b(n.id, batch, daily_cap) s
    -- "Mogu odmah" first for a task danas/odmah (timeTier 1), then the schedule (2); score within a tier.
    order by coalesce((s.detail->>'timeTier')::integer, 9), (s.detail->>'score')::numeric desc, s.pid
  loop
    d := c.detail;
    insert into public.opportunity_deliveries(worker_account_id,worker_profile_id,need_id,
        need_revision,dispatch_round_id,match_score,score_components,reason_codes,status,expires_at)
      values (c.uid,c.pid,n.id,n.revision,roundid,(d->>'score')::numeric,
        coalesce(d->'scoreComponents','{}'::jsonb) || jsonb_build_object(
          'distanceToStartKm', d->'distanceToStartKm',
          'effectiveRadiusKm', d->'effectiveRadiusKm',
          'distanceSource', d->'distanceSource',
          'taskLocationMode', d->'taskLocationMode'),
        array(select jsonb_array_elements_text(d->'reasonCodes')), 'READY', valid_until)
      on conflict do nothing;

    if found then
      inserted := inserted + 1;
      perform private.emit_event(
        p_recipient => c.uid, p_role => 'WORKER',
        p_event_type => 'OPPORTUNITY_AVAILABLE',
        p_entity_type => 'NEED', p_entity_id => n.id, p_entity_version => n.revision,
        p_title => 'Nova prilika koja može da Vam odgovara',
        p_body => left(n.title,140),
        p_dedupe_key => 'opp:'||n.id::text||':'||n.revision::text||':'||c.uid::text,
        p_urgency => case when urg = 'URGENT' then 'HITNO' else 'NORMAL' end,
        p_payload => jsonb_build_object('needRevision',n.revision,
                       'reasonCodes',d->'reasonCodes','remainingSlots',remaining),
        p_expires_at => valid_until);
    end if;
  end loop;

  -- what this transaction has notified so far (read by the next task of the same tick); a rolled-back task takes its share back with it
  perform set_config('v1b.notified', (coalesce(nullif(current_setting('v1b.notified', true), '')::integer, 0) + inserted)::text, true);

  -- nobody new: the same record as every other check that found nobody (it does not use up a wave), paced by the back-off below
  if inserted = 0 then
    update public.dispatch_rounds
       set status = 'STOPPED', stop_reason = 'NO_ELIGIBLE_CANDIDATES',
           deadline_at = statement_timestamp() + make_interval(mins => least(360, greatest(5, (2 ^ least(streak, 9))::integer)))
     where id = roundid;
  end if;

  return jsonb_build_object(
    'status', case when inserted > 0 then 'SENT' else 'STOPPED' end,
    'round', roundno, 'urgency', urg,
    'inserted', inserted, 'batchSize', batch,
    'deadlineAt', deadline,
    'activeResponses', active, 'activeCoverage', active_coverage,
    'selectedSlots', selected, 'remainingSlots', remaining,
    'candidateLimit', batch, 'budgetSource', 'FIXED',
    'candidateRetrieval', 'REMOTE_ROTATION_WAVES',
    'authoritative', true,
    'mode', 'ALL', 'remote', true, 'waveSize', case when delivered = 0 then wave_size else next_size end, 'ceiling', rem_ceiling,
    'deliveredBefore', delivered, 'deliveredTotal', delivered + inserted,
    'exhausted', inserted < batch, 'validUntil', valid_until, 'workerDailyCap', daily_cap)
    || case when inserted = 0 then jsonb_build_object('reason', 'NO_ELIGIBLE_CANDIDATES') else '{}'::jsonb end;
end;
$function$


-- private.expire_lifecycle(timestamp with time zone) | md5=2e13f16eb5f760c1a8a3ebbf59fb60a9 | owner=postgres | acl={postgres=X/postgres} | security_definer=t | config={search_path=pg_catalog}\nCREATE OR REPLACE FUNCTION private.expire_lifecycle(p_at timestamp with time zone DEFAULT statement_timestamp())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  d integer := 0;
  rr integer := 0;
  av integer := 0;
  ur integer := 0;
  ne integer := 0;
  re integer := 0;
  nd integer := 0;
  dq integer := 0;
  changed integer := 0;
  locked_needs uuid[];
begin
  perform set_config('uskoci.need_lifecycle', 'EXPIRE', true);

  -- Parent fencing also covers expired waves/deliveries on still-open Needs.
  -- Skip busy parents; their unchanged due rows remain eligible for a later tick.
  select coalesce(array_agg(locked.id), '{}'::uuid[]) into locked_needs
  from (
    select n.id from public.needs n
    where (
      n.status in ('PUBLISHED','SELECTION')
      and (
        (n.response_deadline is not null and n.response_deadline <= p_at)
        -- PKG-028b: a fixed-time task is over once its time has passed, with or without a deadline.
        or (n.schedule_kind = 'FIXED_WINDOW' and coalesce(n.ends_at, n.starts_at) <= p_at)
        -- PKG-029b: "danas", "sutra" and "ove nedelje" end with their day, counted from publication.
        or (n.schedule_kind in ('TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE')
            and private.relative_schedule_end_v5(n.schedule_kind, n.published_at, n.task_timezone) <= p_at)
      )
      and not exists (select 1 from public.need_selections s
        where s.need_id = n.id and s.status = 'SELECTED')
    ) or exists (
      select 1 from public.opportunity_deliveries o where o.need_id = n.id
        and o.status in ('READY','SEEN')
        and o.expires_at is not null and o.expires_at <= p_at
    ) or exists (
      select 1 from public.dispatch_rounds r where r.need_id = n.id
        and r.status = 'SENT'
        and r.deadline_at is not null and r.deadline_at <= p_at
    )
    order by n.id
    for update of n skip locked
  ) locked;

  with expired_needs as (
    update public.needs x
       set status = 'EXPIRED', urgent = false
     where x.id = any(locked_needs)
       and x.status in ('PUBLISHED','SELECTION')
       and (
         (x.response_deadline is not null and x.response_deadline <= p_at)
         or (x.schedule_kind = 'FIXED_WINDOW' and coalesce(x.ends_at, x.starts_at) <= p_at)
         or (x.schedule_kind in ('TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE')
             and private.relative_schedule_end_v5(x.schedule_kind, x.published_at, x.task_timezone) <= p_at)
       )
       and not exists (
         select 1 from public.need_selections s
          where s.need_id = x.id and s.status = 'SELECTED'
    )
    returning x.id, x.revision
  ), expired_responses as (
    update public.marketplace_responses r
       set status = 'EXPIRED', selected_at = null
      from expired_needs i
     where r.need_id = i.id
       and r.status in ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','STALE')
    returning r.id
  ), expired_notifications as (
    update public.notification_deliveries d
       set state = 'EXPIRED'
      from public.user_activity_events e
     where d.event_id = e.id
       and d.state in ('CREATED','QUEUED','FAILED_RETRYABLE')
       and (
         (e.entity_type = 'NEED' and exists (
           select 1 from expired_needs i where i.id = e.entity_id
         ))
         or (e.entity_type = 'RESPONSE' and exists (
           select 1
             from public.marketplace_responses r
             join expired_needs i on i.id = r.need_id
            where r.id = e.entity_id
         ))
       )
    returning d.id
  ), stopped_rounds as (
    update public.dispatch_rounds r
       set status = 'STOPPED', stop_reason = 'NEED_EXPIRED'
      from expired_needs i
     where r.need_id = i.id and r.status in ('PLANNED','SENT')
    returning r.need_id
  ), expired_opportunities as (
    update public.opportunity_deliveries o set status = 'EXPIRED'
      from expired_needs i
     where o.need_id = i.id and o.status in ('READY','SEEN')
    returning o.need_id
  ), dequeued as (
    delete from private.dispatch_schedule s
     using expired_needs i where s.need_id = i.id
    returning s.need_id
  )
  select
    (select count(*)::integer from expired_needs),
    (select count(*)::integer from expired_responses),
    (select count(*)::integer from expired_notifications),
    (select count(*)::integer from stopped_rounds),
    (select count(*)::integer from expired_opportunities),
    (select count(*)::integer from dequeued)
  into ne, re, nd, rr, d, dq;

  update public.opportunity_deliveries
     set status = 'EXPIRED'
   where need_id = any(locked_needs)
     and status in ('READY','SEEN')
     and expires_at is not null and expires_at <= p_at;
  get diagnostics changed = row_count;
  d := d + changed;

  update public.dispatch_rounds
     set status = 'EXPIRED'
   where need_id = any(locked_needs)
     and status = 'SENT'
     and deadline_at is not null and deadline_at <= p_at;
  get diagnostics changed = row_count;
  rr := rr + changed;

  av := 0; -- Persistent owner intent has no automatic expiration.

  ur := private.expire_urgent(p_at);

  return jsonb_build_object(
    'needsExpired', ne,
    'responsesExpired', re,
    'notificationsExpired', nd,
    'schedulesDequeued', dq,
    'deliveriesExpired', d,
    'roundsExpired', rr,
    'availabilityExpired', av,
    'urgencyExpired', ur
  );
end;
$function$


-- private.match_detail_without_calendar(uuid,uuid) | md5=41b54908d3f461420c3826ad8b723880 | owner=postgres | acl={postgres=X/postgres} | security_definer=t | config={search_path=pg_catalog}\nCREATE OR REPLACE FUNCTION private.match_detail_without_calendar(nid uuid, pid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs; p public.app_profiles; pref public.worker_match_preferences;
  hard text[] := '{}'; disp text[] := '{}'; reasons text[] := '{}';
  tz text; local_day date; fit jsonb; tier integer;
  svc boolean;
  sched boolean; dist numeric; radiusok boolean;
  effective_radius numeric; exposure integer;
  v_worker_rating numeric;
  cap numeric := 0; ss numeric := 0; ds numeric := 0; rs numeric := 0;
  rels numeric := 0; fair numeric := 0;
begin
  select * into n from public.needs where id = nid;
  if not found then
    return jsonb_build_object('responseAllowed',false,'dispatchEligible',false,
      'hardBlockers',jsonb_build_array('NEED_NOT_FOUND'));
  end if;
  select * into p from public.app_profiles where id = pid and kind = 'WORKER';
  if not found then
    return jsonb_build_object('responseAllowed',false,'dispatchEligible',false,
      'hardBlockers',jsonb_build_array('WORKER_PROFILE_NOT_FOUND'));
  end if;
  select * into pref from public.worker_match_preferences where worker_profile_id = pid;

  tz := coalesce(nullif(pref.timezone,''), 'Europe/Belgrade');
  local_day := case when n.starts_at is not null then (n.starts_at at time zone tz)::date end;

  fit := private.worker_need_fit_v1(nid,pid,false);
  svc := (fit->>'service')::boolean;
  tier := (fit->>'timeTier')::integer;
  sched := tier is not null;
  effective_radius := (fit->>'effectiveRadiusKm')::numeric;
  dist := (fit->>'distanceKm')::numeric;
  radiusok := (fit->>'area')::boolean;

  if p.profile_status <> 'ACTIVE' then hard := array_append(hard,'ACCOUNT_OR_PROFILE_RESTRICTED'); end if;
  if n.requester_account_id = p.account_id then hard := array_append(hard,'OWN_NEED'); end if;
  if n.verified_identity_required and not private.identity_admitted(p.account_id)
    then hard := array_append(hard,'IDENTITY_VERIFICATION_NOT_ADMITTED'); end if;
  if coalesce(cardinality(p.exclusions),0) > 0 and (private.lower_arr(p.exclusions) && private.lower_arr(array_prepend(n.category, n.required_skills))
     or private.work_kinds_v5(p.exclusions) && private.work_kinds_v5(array_prepend(n.category, n.required_skills)))
    then hard := array_append(hard,'PROFILE_EXCLUSION'); end if;

  if not coalesce(pref.proactive_notifications,true) then disp := array_append(disp,'PROACTIVE_NOTIFICATIONS_PAUSED'); end if;
  if n.urgent
     and (n.schedule_kind = 'TODAY_FLEXIBLE'
          or (n.starts_at is not null and (n.starts_at at time zone tz)::date = (statement_timestamp() at time zone tz)::date))
     and not coalesce(pref.same_day_urgent_notifications,true)
    then disp := array_append(disp,'SAME_DAY_URGENT_NOTIFICATIONS_PAUSED'); end if;
  if not svc then disp := array_append(disp,'SERVICE_NOT_IN_WORK_PROFILE'); end if;
  if not sched then disp := array_append(disp,'OUTSIDE_AVAILABILITY'); end if;
  if not radiusok then disp := array_append(disp,'OUTSIDE_PREFERRED_RADIUS'); end if;

  if svc then reasons := array_append(reasons,'SERVICE_MATCH'); cap := 30; end if;
  if sched then reasons := array_append(reasons,'SCHEDULE_MATCH'); ss := 25; end if;
  if radiusok then
    reasons := array_append(reasons, case when n.execution_location_mode='REMOTE'
                 then 'REMOTE_LOCATION_NOT_REQUIRED' else 'START_PROXIMITY_MATCH' end);
    ds := case
      when n.execution_location_mode='REMOTE' then 15
      when dist is null or effective_radius is null or effective_radius <= 0 then 10
      else round(15 * (1 - 0.55 * least(1, greatest(0, dist/effective_radius))), 1)
    end;
  end if;

  v_worker_rating := coalesce((private.account_reputation(p.account_id)->>'averageRating')::numeric, p.rating_worker);
  rels := round(greatest(0, least(100, coalesce(v_worker_rating*20, 50)))/10, 1);
  select count(*) into exposure from public.opportunity_deliveries d
   where d.worker_account_id = p.account_id
     and d.created_at > statement_timestamp() - interval '7 days';
  fair := case when v_worker_rating is null then 5 else greatest(0, 5 - least(5, exposure)) end;
  if v_worker_rating is null then reasons := array_append(reasons,'NEWCOMER_FAIRNESS'); end if;

  return jsonb_build_object(
    'workerAccountId', p.account_id,
    'workerProfileId', p.id,
    'responseAllowed', cardinality(hard) = 0,
    'dispatchEligible', cardinality(hard) = 0 and cardinality(disp) = 0,
    'hardBlockers', to_jsonb(hard),
    'dispatchBlockers', to_jsonb(disp),
    'reasonCodes', to_jsonb(reasons),
    'distanceToStartKm', dist,
    'effectiveRadiusKm', effective_radius,
    'taskLocationMode', n.execution_location_mode,
    'distanceSource', case when dist is null then null else 'GEODESIC' end,
    'routingProvider', null,
    'liveStateDate', local_day,
    'timeTier', tier,
    'score', round(least(100, cap+ss+ds+rs+rels+fair), 1),
    'scoreComponents', jsonb_build_object(
      'capability', cap, 'schedule', ss, 'distanceToStart', ds,
      'resources', rs, 'reliability', rels, 'fairness', fair)
  );
end;
$function$


-- private.worker_notify_room_v1b(uuid,integer) | md5=9aac9da0479327fdf82b2f9298e47719 | owner=postgres | acl={postgres=X/postgres} | security_definer=t | config={search_path=pg_catalog}\nCREATE OR REPLACE FUNCTION private.worker_notify_room_v1b(uid uuid, p_cap integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  -- MATCH-V1B (owner 2026-10-07): may this worker still get a PROACTIVE new-task notification today?
  -- It counts the worker's own OPPORTUNITY_AVAILABLE events of normal urgency created in the last 24 hours: the event the
  -- dispatch wave emits for every notified worker (private.dispatch_next_wave -> private.emit_event). Urgent (HITNO) events and
  -- every other event type (responses, agreements, messages, reviews ...) are NOT counted. A null cap means "no cap".
  -- Index-friendly: one range on an existing recipient index (activity_recipient_idx: recipient_user_id, recipient_role, created_at; the
  -- inbox index activity_inbox_page_idx serves the same range), and the count stops at the cap, so at most p_cap matching rows are read
  -- however long the worker's history is.
  select p_cap is null or (
    select count(*) from (
      select 1
        from public.user_activity_events e
       where e.recipient_user_id = uid
         and e.recipient_role = 'WORKER'
         and e.created_at > statement_timestamp() - interval '24 hours'
         and e.event_type = 'OPPORTUNITY_AVAILABLE'
         and e.urgency = 'NORMAL'
       limit p_cap
    ) counted
  ) < p_cap;
$function$

COMMIT;
