-- Byte-exact canonical DEV source, 2026-10-11, read-only capture.
-- NEVER RUN on DEV/PROD. Fixture below runs only in disposable PG16 CI.
-- Candidate generation, match_detail and emit_event are isolated synthetic
-- adapters with NO network or provider path; see wave-disposable-fixture.sql.
CREATE OR REPLACE FUNCTION private.need_search_time_admitted_v1(p_need_id uuid, p_at timestamp with time zone DEFAULT statement_timestamp())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs%rowtype;
  execution_end timestamptz;
begin
  if p_need_id is null or p_at is null or not isfinite(p_at) then return false; end if;
  select * into n from public.needs where id=p_need_id;
  if not found then return false; end if;
  if n.response_deadline is not null
     and (not isfinite(n.response_deadline) or n.response_deadline <= p_at) then return false; end if;
  if n.starts_at is not null and not isfinite(n.starts_at) then return false; end if;
  if n.ends_at is not null then
    if not isfinite(n.ends_at) or n.ends_at <= p_at then return false; end if;
    if n.starts_at is not null and n.starts_at >= n.ends_at then return false; end if;
  end if;
  if n.schedule_kind='FIXED_WINDOW' then
    execution_end := coalesce(n.ends_at,n.starts_at);
    return execution_end is not null and isfinite(execution_end) and p_at < execution_end;
  elsif n.schedule_kind in ('TODAY_FLEXIBLE','TOMORROW_FLEXIBLE','WEEK_FLEXIBLE') then
    execution_end := private.relative_schedule_end_v5(n.schedule_kind,n.published_at,n.task_timezone);
    return execution_end is not null and isfinite(execution_end) and p_at < execution_end;
  elsif n.schedule_kind in ('FLEXIBLE','REMOTE_ANYTIME') then
    -- An explicit generic end is honoured above. A start alone is NOT an invented end.
    return true;
  end if;
  -- Unrecognised time semantics cannot license automatic matching.
  return false;
end
$function$;

CREATE OR REPLACE FUNCTION private.dispatch_config_v1b(sw jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  k text; knob record; v jsonb; num numeric; flag boolean := false; cap integer; budget integer;
begin
  -- MATCH-V1B (owner 2026-10-07): checks the knobs of the row private.marketplace_config 'match_v1_dispatch' that this package
  -- adds (mode ALL only). A bad value, a missing cap or budget or a misspelt knob of the two new families is the named configuration
  -- error DISPATCH_CONFIG_INVALID, never a setting that silently stays as it was. Returns the checked switch, the cap that is in force
  -- (workerDailyCap 1000 is "off" and comes back as null: no query is made for it) and the notify budget of one transaction. A wave
  -- larger than that budget could never be sent, so it is an error too.
  for k in select jsonb_object_keys(sw) loop
    if (k like 'remote%' and k not in ('remoteWaves','remoteWaveSize','remoteNextWaveSize','remoteWaveMinutes','remoteStopAfterResponses','remoteCeiling'))
       or (k like 'worker%' and k not in ('workerDailyCap','workerNotifyPerTransaction')) then
      raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
    end if;
  end loop;

  v := sw->'workerDailyCap';
  if v is null or jsonb_typeof(v) <> 'number' then
    raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
  end if;
  num := (v #>> '{}')::numeric;
  if num <> trunc(num) or num < 1 or num > 1000 then
    raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
  end if;
  cap := num::integer;

  v := sw->'workerNotifyPerTransaction';
  if v is null or jsonb_typeof(v) <> 'number' then
    raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
  end if;
  num := (v #>> '{}')::numeric;
  if num <> trunc(num) or num < 50 or num > 1500 then
    raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
  end if;
  budget := num::integer;

  v := sw->'remoteWaves';
  if v is not null then
    if jsonb_typeof(v) <> 'boolean' then
      raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
    end if;
    flag := (v #>> '{}')::boolean;
  end if;
  if flag then
    for knob in
      select * from (values ('remoteWaveSize', 1, 1500), ('remoteNextWaveSize', 1, 1500), ('remoteWaveMinutes', 1, 1440),
                            ('remoteStopAfterResponses', 1, 1000), ('remoteCeiling', 1, 10000))
        as t(knob_key, lo, hi)
    loop
      v := sw->knob.knob_key;
      if v is null or jsonb_typeof(v) <> 'number' then
        raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
      end if;
      num := (v #>> '{}')::numeric;
      if num <> trunc(num) or num < knob.lo or num > knob.hi then
        raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
      end if;
    end loop;
    if (sw->>'remoteWaveSize')::integer > budget or (sw->>'remoteNextWaveSize')::integer > budget then
      raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
    end if;
  end if;
  return jsonb_build_object('remoteWaves', flag, 'workerDailyCap', case when cap >= 1000 then null else cap end, 'notifyBudget', budget);
end;
$function$;

CREATE OR REPLACE FUNCTION private.dispatch_next_wave(nid uuid)
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
    || case when chunked and inserted >= batch then jsonb_build_object('chunk',true,'txNotifyBudget',tx_budget) else '{}'::jsonb end;
end;
$function$;
