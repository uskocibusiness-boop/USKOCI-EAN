-- ============================================================================
-- USKOCI: P0.2 Temporal 1h Soft Reservation & Conflict Freezing
-- Prevents double-booking: when a worker is selected for an Agreement with time
-- window [starts_at, ends_at], any other pending applications whose time overlaps
-- that interval are automatically projected as TIME_CONFLICT_FROZEN (canSelect=false).
-- If ends_at is not specified, a default 1-hour protective slot is enforced.
-- ============================================================================

create or replace function private.candidate_projection(p_need_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_need public.needs%rowtype;
  v_remaining_slots integer;
  v_selected_slots integer;
begin
  if v_actor is null then
    raise exception using errcode='28000', message='AUTH_REQUIRED';
  end if;

  select n.*
  into v_need
  from public.needs n
  where n.id = p_need_id;

  if not found then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;
  if v_need.requester_account_id <> v_actor then
    raise exception using errcode='42501', message='NOT_REQUESTER';
  end if;

  select coalesce(sum(s.covered_slots),0)::integer
  into v_selected_slots
  from public.need_selections s
  where s.need_id = p_need_id
    and s.status = 'SELECTED';

  v_remaining_slots := greatest(coalesce(v_need.required_slots,1) - v_selected_slots, 0);

  with candidate_rows as (
    select
      r.id as response_id,
      r.worker_profile_id,
      r.status as raw_response_status,
      r.current_version,
      r.submitted_against_need_revision,
      r.submitted_at,
      v.need_revision as version_need_revision,
      v.content_hash,
      v.price_rsd,
      v.covered_slots,
      v.proposed_start_at,
      v.proposed_end_at,
      v.scope_note,
      snap.snapshot_schema,
      snap.worker_team_capacity,
      snap.worker_skills,
      snap.worker_tools,
      snap.worker_licenses,
      snap.worker_vehicles,
      public.rpc_get_public_profile(r.worker_profile_id) as public_profile,
      private.match_detail(p_need_id,r.worker_profile_id) as match_detail,
      exists(
        select 1
        from public.agreements a
        where a.selected_response_id = r.id
      ) as has_agreement,
      -- Protective 1-hour temporal window evaluation
      coalesce(
        v.proposed_start_at,
        nullif(btrim(v_need.schedule->>'starts_at'),'')::timestamptz
      ) as effective_start_at,
      coalesce(
        v.proposed_end_at,
        nullif(btrim(v_need.schedule->>'ends_at'),'')::timestamptz,
        case
          when coalesce(v.proposed_start_at, nullif(btrim(v_need.schedule->>'starts_at'),'')::timestamptz) is not null
          then coalesce(v.proposed_start_at, nullif(btrim(v_need.schedule->>'starts_at'),'')::timestamptz) + interval '1 hour'
          else null
        end
      ) as effective_end_at
    from public.marketplace_responses r
    left join public.marketplace_response_versions v
      on v.response_id = r.id
     and v.version = r.current_version
    left join private.response_application_snapshots snap
      on snap.response_id = r.id
     and snap.response_version = r.current_version
    where r.need_id = p_need_id
      and r.status <> 'DRAFT'
  ), classified as (
    select
      c.*,
      case
        when c.has_agreement or c.raw_response_status = 'SELECTED' then 'SELECTED'
        when c.raw_response_status = 'WITHDRAWN' then 'WITHDRAWN'
        when c.raw_response_status in ('NOT_SELECTED','EXPIRED') then 'CLOSED'
        when coalesce(v_need.status,'') in ('DRAFT','COMPLETED','CANCELLED','EXPIRED','ARCHIVED') then 'CLOSED'
        when v_need.response_deadline is not null
             and v_need.response_deadline <= statement_timestamp() then 'CLOSED'
        when c.raw_response_status in ('STALE','STALE_REVIEW_REQUIRED')
          or c.current_version is null
          or c.content_hash is null
          or c.version_need_revision is distinct from v_need.revision
          or c.submitted_against_need_revision is distinct from v_need.revision
          or coalesce((c.match_detail->>'responseAllowed')::boolean,false) is not true
          then 'STALE'
        when v_remaining_slots <= 0 then 'FULL'
        when c.covered_slots > v_remaining_slots then 'OVERFILL'
        -- Anti-double-booking: conflict with worker's existing confirmed calendar events
        when c.effective_start_at is not null
         and c.effective_end_at is not null
         and private.worker_calendar_conflict(c.worker_profile_id, c.effective_start_at, c.effective_end_at)
          then 'TIME_CONFLICT_FROZEN'
        when c.raw_response_status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') then 'SELECTABLE'
        else 'CLOSED'
      end as candidate_state
    from candidate_rows c
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'responseId', c.response_id,
        'workerProfileId', c.worker_profile_id,
        'needRevision', v_need.revision,
        'responseNeedRevision', c.version_need_revision,
        'version', c.current_version,
        'contentHash', c.content_hash,
        'state', c.candidate_state,
        'canSelect', c.candidate_state = 'SELECTABLE',
        'priceRsd', c.price_rsd,
        'coveredSlots', c.covered_slots,
        'remainingSlots', v_remaining_slots,
        'proposedStartAt', c.proposed_start_at,
        'proposedEndAt', c.proposed_end_at,
        'scopeNote', coalesce(c.scope_note,''),
        'publicProfile', c.public_profile,
        'applicationEvidence', case
          when c.snapshot_schema is null then jsonb_build_object(
            'schema','LEGACY_UNPROVEN',
            'teamCapacity',null,
            'skills',null,
            'tools',null,
            'licenses',null,
            'vehicles',null
          )
          else jsonb_build_object(
            'schema',c.snapshot_schema,
            'teamCapacity',c.worker_team_capacity,
            'skills',c.worker_skills,
            'tools',c.worker_tools,
            'licenses',c.worker_licenses,
            'vehicles',c.worker_vehicles
          )
        end
      )
      order by
        case c.candidate_state
          when 'SELECTABLE' then 1
          when 'TIME_CONFLICT_FROZEN' then 2
          when 'OVERFILL' then 3
          when 'STALE' then 4
          when 'FULL' then 5
          when 'SELECTED' then 6
          when 'WITHDRAWN' then 7
          else 8
        end,
        c.submitted_at desc
    ),
    '[]'::jsonb
  )
  from classified c;
end;
$function$;

comment on function private.candidate_projection(uuid) is
  'RU-5 / P0D-01 / P0.2: Projects candidate applications with temporal conflict freezing and 1h minimum soft reservation window.';
