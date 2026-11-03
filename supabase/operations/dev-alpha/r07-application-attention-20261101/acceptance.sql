-- No existing account, business/Auth fixture, provider or push call.
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE authenticated;
DO $auth$ BEGIN
 BEGIN PERFORM public.rpc_list_my_applications();RAISE EXCEPTION 'R07_EXPECTED_AUTH_REQUIRED';
 EXCEPTION WHEN SQLSTATE '42501' THEN IF SQLERRM<>'AUTH_REQUIRED' THEN RAISE;END IF;END;
 BEGIN PERFORM public.rpc_list_my_applications_page('ALL',30,NULL,NULL,NULL);RAISE EXCEPTION 'R07_EXPECTED_AUTH_REQUIRED';
 EXCEPTION WHEN SQLSTATE '42501' THEN IF SQLERRM<>'AUTH_REQUIRED' THEN RAISE;END IF;END;
END;$auth$;
RESET ROLE;
DO $empty$ DECLARE v_actor uuid:=NULL;v_result jsonb;v_items jsonb;v_counts jsonb;v_scope_rank integer:=NULL;
 p_before_at timestamptz:=NULL;p_before_id uuid:=NULL;p_before_rank integer:=NULL;p_limit integer:=30;
BEGIN
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
  ), state_rows as (
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
  ), mapped as (
    select st.*, (st.application_state = 'STALE_REVIEW_REQUIRED'
        or (st.application_state = 'SELECTED' and exists (select 1 from public.agreements a
          left join public.agreement_execution ae on ae.agreement_id = a.id
          where a.id = st.agreement_id and a.status in ('CONFIRMED','SUPERSEDED')
            and coalesce(ae.state, a.status) in ('CONFIRMED','AWAITING_REQUESTER')))) as attention_required
    from state_rows st
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
        'attentionRequired', m.attention_required,
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
          when m.attention_required then 0
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

  -- CAL01: boolean only, behind the existing owner-scoped reader; no foreign agreement details.
  select coalesce(jsonb_agg(item || jsonb_build_object('calendarConflict',
    private.application_calendar_conflict_v1((item->>'applicationId')::uuid)) order by ord), '[]'::jsonb)
  into v_result from jsonb_array_elements(v_result) with ordinality as entries(item,ord);


 IF v_result<>'[]'::jsonb THEN RAISE EXCEPTION 'R07_EMPTY_WHOLE_INVALID';END IF;
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
        'attentionRequired', p.application_rank = 0,
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

  -- CAL01: boolean only, behind the existing owner-scoped reader; no foreign agreement details.
  select coalesce(jsonb_agg(item || jsonb_build_object('calendarConflict',
    private.application_calendar_conflict_v1((item->>'applicationId')::uuid)) order by ord), '[]'::jsonb)
  into v_items from jsonb_array_elements(v_items) with ordinality as entries(item,ord);


 IF v_items<>'[]'::jsonb OR v_counts<>'{"total":0,"attention":0,"active":0,"finished":0}'::jsonb
 THEN RAISE EXCEPTION 'R07_EMPTY_PAGE_INVALID';END IF;
END;$empty$;
