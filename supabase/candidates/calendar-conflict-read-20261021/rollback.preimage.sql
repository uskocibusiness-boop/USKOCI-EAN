CREATE OR REPLACE FUNCTION public.rpc_list_my_applications()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;

  with own_rows as (
    select
      r.id as application_id,
      r.need_id,
      n.revision as current_need_revision,
      r.submitted_against_need_revision,
      r.current_version,
      r.status as raw_response_status,
      r.price_rsd,
      r.covered_slots,
      r.scope_note,
      r.submitted_at,
      n.title,
      n.description,
      n.status as raw_need_status,
      n.approximate_city,
      n.approximate_area,
      n.starts_at,
      (
        select a.id
          from public.agreements a
         where a.selected_response_id = r.id
         order by a.created_at desc, a.id desc
         limit 1
      ) as agreement_id
    from public.marketplace_responses r
    join public.needs n on n.id = r.need_id
    where r.worker_account_id = v_actor
      and r.status <> 'DRAFT'
  ), mapped as (
    select
      o.*,
      case
        -- PKG-029b (deep read 7.49): an application whose Agreement was cancelled is no longer chosen.
        when (o.agreement_id is not null and not exists (select 1 from public.agreements ag
                where ag.id = o.agreement_id and ag.status = 'CANCELLED'))
             or o.raw_response_status = 'SELECTED'
          then 'SELECTED'
        when o.raw_response_status = 'WITHDRAWN'
          then 'WITHDRAWN'
        when o.raw_response_status in ('STALE','STALE_REVIEW_REQUIRED')
             or o.submitted_against_need_revision is distinct from o.current_need_revision
          then 'STALE_REVIEW_REQUIRED'
        when o.raw_response_status in ('NOT_SELECTED','EXPIRED')
             or o.raw_need_status not in ('PUBLISHED','SELECTION')
          then 'CLOSED'
        when o.raw_response_status = 'VIEWED'
          then 'VIEWED'
        when o.raw_response_status = 'SHORTLISTED'
          then 'SHORTLISTED'
        when o.raw_response_status in ('SUBMITTED','DELIVERED')
          then 'SUBMITTED'
        else 'CLOSED'
      end as application_state
    from own_rows o
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'applicationId', m.application_id,
        'needId', m.need_id,
        'needRevision', m.current_need_revision,
        'submittedNeedRevision', m.submitted_against_need_revision,
        'version', m.current_version,
        'state', m.application_state,
        'title', m.title,
        'description', m.description,
        'approximateCity', nullif(btrim(m.approximate_city), ''),
        'approximateArea', nullif(btrim(m.approximate_area), ''),
        'startsAt', m.starts_at,
        'priceRsd', m.price_rsd,
        'coveredSlots', m.covered_slots,
        'scopeNote', coalesce(m.scope_note, ''),
        'agreementId', m.agreement_id,
        'requiresStaleReview', m.application_state = 'STALE_REVIEW_REQUIRED',
        'attentionRequired', m.application_state in ('STALE_REVIEW_REQUIRED','SELECTED'),
        'canWithdraw',
          m.application_state in ('SUBMITTED','VIEWED','SHORTLISTED')
          and m.raw_response_status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
          and m.submitted_against_need_revision = m.current_need_revision
          and m.raw_need_status in ('PUBLISHED','SELECTION')
          and m.agreement_id is null,
        'submittedAt', m.submitted_at
      )
      order by
        case
          when m.application_state in ('STALE_REVIEW_REQUIRED','SELECTED') then 0
          when m.application_state in ('SUBMITTED','VIEWED','SHORTLISTED') then 1
          else 2
        end,
        m.submitted_at desc nulls last,
        m.application_id
    ),
    '[]'::jsonb
  )
  into v_result
  from mapped m;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_list_my_applications_page(p_scope text DEFAULT 'ALL'::text, p_limit integer DEFAULT 30, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid, p_before_rank integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_items jsonb;
  v_counts jsonb;
  v_scope_rank integer;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100
     or (p_before_at is null) <> (p_before_id is null) or (p_before_at is null) <> (p_before_rank is null)
     or (p_before_rank is not null and p_before_rank not in (0, 1, 2)) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  if p_scope is null or p_scope not in ('ALL','ATTENTION','ACTIVE','HISTORY') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;
  -- ATTENTION = what waits for the applicant (rank 0), ACTIVE = a still-open application (rank 1), HISTORY = the rest (rank 2): the three sections of the screen.
  v_scope_rank := case p_scope when 'ATTENTION' then 0 when 'ACTIVE' then 1 when 'HISTORY' then 2 end;
  if p_before_rank is not null and v_scope_rank is not null and p_before_rank <> v_scope_rank then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;

  -- EX-04 S2 (B10 Moje prijave). The order is the one rpc_list_my_applications() has always had: what waits for me first, then the open ones, then the rest, each
  -- newest submission first, the id as the last tie-breaker. The keyset carries all three values of that order (rank, sortAt, id), so a page boundary can fall anywhere,
  -- inside a tie or between two sections, and no application is skipped or repeated for a reason of the order itself.
  with own as materialized (
    select * from private.own_application_rows(v_actor)
  ), page as (
    select o.* from own o
    where (v_scope_rank is null or o.application_rank = v_scope_rank)
      and (p_before_at is null
           or o.application_rank > p_before_rank
           or (o.application_rank = p_before_rank and (o.sort_at < p_before_at or (o.sort_at = p_before_at and o.application_id > p_before_id))))
    order by o.application_rank, o.sort_at desc, o.application_id
    limit p_limit + 1
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
        'applicationId', p.application_id, 'id', p.application_id, 'sortAt', p.sort_at,
        'needId', p.need_id, 'needRevision', p.current_need_revision,
        'submittedNeedRevision', p.submitted_against_need_revision, 'version', p.current_version,
        'state', p.application_state, 'title', p.title, 'description', p.description,
        'approximateCity', nullif(btrim(p.approximate_city), ''), 'approximateArea', nullif(btrim(p.approximate_area), ''),
        'startsAt', p.starts_at, 'endsAt', p.ends_at, 'scheduleKind', p.schedule_kind,
        'executionLocationMode', p.execution_location_mode, 'taskTimezone', p.task_timezone,
        'priceMode', p.price_mode, 'priceBasis', p.price_basis, 'requiredSlots', p.required_slots,
        'priceRsd', p.price_rsd, 'coveredSlots', p.covered_slots,
        'scopeNote', coalesce(p.scope_note, ''), 'agreementId', p.agreement_id,
        'requiresStaleReview', p.application_state = 'STALE_REVIEW_REQUIRED',
        'attentionRequired', p.application_state in ('STALE_REVIEW_REQUIRED','SELECTED'),
        'canWithdraw',
          p.application_state in ('SUBMITTED','VIEWED','SHORTLISTED')
          and p.raw_response_status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
          and p.submitted_against_need_revision = p.current_need_revision
          and p.raw_need_status in ('PUBLISHED','SELECTION')
          and p.agreement_id is null,
        'submittedAt', p.submitted_at
      ) order by p.application_rank, p.sort_at desc, p.application_id), '[]'::jsonb) from page p),
    -- The four counts of the tabs ride with the first page; a later page does not pay for them again.
    case when p_before_at is null then (select jsonb_build_object(
        'total', count(*),
        'attention', count(*) filter (where o.application_rank = 0),
        'active', count(*) filter (where o.application_rank = 1),
        'finished', count(*) filter (where o.application_rank = 2)) from own o) end
  into v_items, v_counts;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    'counts', v_counts,
    'asOf', statement_timestamp());
end
$function$;

CREATE OR REPLACE FUNCTION public.rpc_list_need_candidates(p_need_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_need public.needs;
  v_selected_slots integer := 0;
  v_remaining_slots integer := 0;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;
  if p_need_id is null then
    raise exception using errcode='22023', message='NEED_ID_REQUIRED';
  end if;

  select n.* into v_need
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
      p.profile_status as current_profile_status,
      p.display_name as current_display_name,
      p.city as current_city,
      p.skills as current_skills,
      p.team_capacity as current_team_capacity,
      public.rpc_get_public_profile(r.worker_profile_id) as public_profile,
      exists(
        select 1
        from public.agreements a
        where a.selected_response_id = r.id
      ) as has_agreement
    from public.marketplace_responses r
    left join public.marketplace_response_versions v
      on v.response_id = r.id
     and v.version = r.current_version
    left join private.response_application_snapshots snap
      on snap.response_id = r.id
     and snap.response_version = r.current_version
    left join public.app_profiles p
      on p.id = r.worker_profile_id
     and p.kind = 'WORKER'
    where r.need_id = p_need_id
      and r.status <> 'DRAFT'
  ), classified as (
    select
      c.*,
      states.candidate_state
    from candidate_rows c
    join private.need_candidate_states_v5(p_need_id) states on states.response_id=c.response_id
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
            'skills',to_jsonb(c.worker_skills),
            'tools',to_jsonb(c.worker_tools),
            'licenses',to_jsonb(c.worker_licenses),
            'vehicles',to_jsonb(c.worker_vehicles)
          )
        end
      )
      order by c.submitted_at asc nulls last, c.response_id
    ),
    '[]'::jsonb
  )
  into v_result
  from classified c;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_list_need_candidates_page(p_need_id uuid, p_limit integer DEFAULT 30, p_after_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_after_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_need public.needs;
  v_selected_slots integer := 0;
  v_remaining_slots integer := 0;
  v_items jsonb;
  v_has_more boolean;
  v_total bigint;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;
  if p_need_id is null then
    raise exception using errcode='22023', message='NEED_ID_REQUIRED';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_after_at is null) <> (p_after_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;

  select n.* into v_need
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

  -- EX-04 S4 (A11). The same candidate document rpc_list_need_candidates returns, in its order (submission, then id), one keyset page at a time. The keys of the whole set are read
  -- with no function call; the state, the public profile and the evidence are computed for the candidates of THIS page only, so the work of a page does not grow with the task's applications.
  with keys as materialized (
    select r.id as response_id, coalesce(r.submitted_at, r.created_at) as sort_at
    from public.marketplace_responses r
    where r.need_id = p_need_id
      and r.status <> 'DRAFT'
  ), page as materialized (
    select k.response_id, k.sort_at
    from keys k
    where p_after_at is null or (k.sort_at, k.response_id) > (p_after_at, p_after_id)
    order by k.sort_at, k.response_id
    limit p_limit + 1
  ), shown as materialized (
    select pg.response_id, pg.sort_at
    from page pg
    order by pg.sort_at, pg.response_id
    limit p_limit
  ), candidate_rows as (
    select
      r.id as response_id,
      sh.sort_at,
      r.worker_profile_id,
      r.current_version,
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
      snap.worker_vehicles
    from shown sh
    join public.marketplace_responses r on r.id = sh.response_id
    left join public.marketplace_response_versions v
      on v.response_id = r.id
     and v.version = r.current_version
    left join private.response_application_snapshots snap
      on snap.response_id = r.id
     and snap.response_version = r.current_version
  ), classified as (
    select
      c.*,
      states.candidate_state
    from candidate_rows c
    join private.need_candidate_states_v5(p_need_id, (select array_agg(sh.response_id) from shown sh)) states on states.response_id = c.response_id
  )
  select
    (select coalesce(
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
          'publicProfile', public.rpc_get_public_profile(c.worker_profile_id),
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
              'skills',to_jsonb(c.worker_skills),
              'tools',to_jsonb(c.worker_tools),
              'licenses',to_jsonb(c.worker_licenses),
              'vehicles',to_jsonb(c.worker_vehicles)
            )
          end,
          'sortAt', c.sort_at
        )
        order by c.sort_at, c.response_id
      ),
      '[]'::jsonb) from classified c),
    (select count(*) from page) > p_limit,
    -- The total rides with the first page; a later page does not pay for it again.
    case when p_after_at is null then (select count(*) from keys) end
  into v_items, v_has_more, v_total;

  return jsonb_build_object(
    'items', v_items,
    'hasMore', v_has_more,
    'counts', case when p_after_at is null then jsonb_build_object('total', v_total) end,
    'asOf', statement_timestamp());
end
$function$;

drop function private.application_calendar_conflict_v1(uuid);
