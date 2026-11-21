-- USKOCI DEV rollback preimage captured read-only 2026-11-21 (project leqcwgzvjsxugfgzdmth, PostgreSQL 17.6).
-- Pairs with scripts/sql/marketplace_safety_20261121.candidate.sql. SOURCE-ONLY: restore only as a controlled
-- rollback after the paired candidate was promoted through a reviewed migration. Never run against PROD.
-- CREATE OR REPLACE preserves current ownership and ACLs; metadata is recorded above each definition.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

-- policy public.needs.needs_public_discovery | qual md5=7d2b4a721dfb96bc3a5cac893aefe939 | PERMISSIVE | roles={authenticated} | SELECT
ALTER POLICY needs_public_discovery ON public.needs
  USING (((status = ANY (ARRAY['PUBLISHED'::text, 'SELECTION'::text])) AND (( SELECT auth.uid() AS uid) IS NOT NULL) AND ((requester_account_id = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[]))) = (( SELECT auth.uid() AS uid) = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[]))))));

-- New objects of the candidate (absent in the preimage).
DROP FUNCTION IF EXISTS rls_private.viewer_block_counterparties();
DROP INDEX IF EXISTS private.account_blocks_blocked_active_idx;

-- rpc_list_need_candidates(uuid) | md5=4096a29c4ef6dbaeb987a58a9c9dba32 | owner=postgres | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres} | security_definer=t | config={search_path=pg_catalog}
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
      v.price_basis as application_price_basis,
      v.covered_slots,
      v.proposed_start_at,
      v.proposed_end_at,
      v.scope_note,
      snap.snapshot_schema,
      snap.pricing_mode as application_price_mode,
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
        'canSelect', c.candidate_state = 'SELECTABLE' and coalesce(c.application_price_basis = (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),false),
          'priceReviewRequired', c.application_price_basis is distinct from (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
        'priceRsd', c.price_rsd,
          'applicationPriceBasis', c.application_price_basis,
          'applicationPriceMode', c.application_price_mode,
          'currency', 'RSD',
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

  -- CAL01: boolean only, behind the existing owner-scoped reader; no foreign agreement details.
  select coalesce(jsonb_agg(item || jsonb_build_object('calendarConflict',
    private.application_calendar_conflict_v1((item->>'responseId')::uuid)) order by ord), '[]'::jsonb)
  into v_result from jsonb_array_elements(v_result) with ordinality as entries(item,ord);
  select coalesce(jsonb_agg(item || case when item->>'calendarConflict'='true' then '{"canSelect":false}'::jsonb else '{}'::jsonb end order by ord),'[]'::jsonb)
  into v_result from jsonb_array_elements(v_result) with ordinality as entries(item,ord);

  return v_result;
end;
$function$
;

-- rpc_list_need_candidates_page(uuid,integer,timestamp with time zone,uuid) | md5=11b6ca6fa48ac74b76c6e7cd09c25c3c | owner=postgres | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres} | security_definer=t | config={search_path=pg_catalog}
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
      v.price_basis as application_price_basis,
      v.covered_slots,
      v.proposed_start_at,
      v.proposed_end_at,
      v.scope_note,
      snap.snapshot_schema,
      snap.pricing_mode as application_price_mode,
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
          'canSelect', c.candidate_state = 'SELECTABLE' and coalesce(c.application_price_basis = (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),false),
          'priceReviewRequired', c.application_price_basis is distinct from (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
          'priceRsd', c.price_rsd,
          'applicationPriceBasis', c.application_price_basis,
          'applicationPriceMode', c.application_price_mode,
          'currency', 'RSD',
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

  -- CAL01: boolean only, behind the existing owner-scoped reader; no foreign agreement details.
  select coalesce(jsonb_agg(item || jsonb_build_object('calendarConflict',
    private.application_calendar_conflict_v1((item->>'responseId')::uuid)) order by ord), '[]'::jsonb)
  into v_items from jsonb_array_elements(v_items) with ordinality as entries(item,ord);
  select coalesce(jsonb_agg(item || case when item->>'calendarConflict'='true' then '{"canSelect":false}'::jsonb else '{}'::jsonb end order by ord),'[]'::jsonb)
  into v_items from jsonb_array_elements(v_items) with ordinality as entries(item,ord);

  return jsonb_build_object(
    'items', v_items,
    'hasMore', v_has_more,
    'counts', case when p_after_at is null then jsonb_build_object('total', v_total) end,
    'asOf', statement_timestamp());
end
$function$
;

-- rpc_set_contact_grant(uuid,text,boolean) | md5=5a6d710106832c1da7bc147a704f9301 | owner=postgres | acl={postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres} | security_definer=t | config={search_path=pg_catalog}
CREATE OR REPLACE FUNCTION public.rpc_set_contact_grant(p_agreement_id uuid, p_channel text, p_granted boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_agreement public.agreements%rowtype;
  v_to uuid;
  v_grant_id uuid;
  v_phone text;
  v_address text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_channel not in ('PHONE', 'EXACT_LOCATION') then
    raise exception 'UNSUPPORTED_CHANNEL' using errcode = '22023';
  end if;
  if p_granted is null then
    raise exception 'GRANT_DECISION_REQUIRED' using errcode = '22004';
  end if;

  select *
    into v_agreement
    from public.agreements
   where id = p_agreement_id
   for update;

  if not found then
    raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_uid not in (v_agreement.requester_account_id, v_agreement.worker_account_id) then
    raise exception 'NOT_PARTY' using errcode = '42501';
  end if;

  v_to := case
            when v_uid = v_agreement.requester_account_id then v_agreement.worker_account_id
            else v_agreement.requester_account_id
          end;

  -- Revocation is deliberately allowed after cancellation/completion so a
  -- user can always close their own grant. New grants require a live agreement.
  if p_granted and v_agreement.status <> 'CONFIRMED' then
    raise exception 'AGREEMENT_NOT_ACTIVE' using errcode = 'P0001', detail = v_agreement.status;
  end if;

  if p_channel = 'PHONE' and p_granted then
    select nullif(btrim(a.phone), '')
      into v_phone
      from public.app_accounts a
     where a.id = v_uid;
    if v_phone is null then
      raise exception 'PHONE_NOT_SET' using errcode = 'P0001';
    end if;
  end if;

  -- Exact Need location belongs to the requester. A worker cannot grant a
  -- requester's address back to them or to anyone else.
  if p_channel = 'EXACT_LOCATION' then
    if v_uid <> v_agreement.requester_account_id then
      raise exception 'NOT_LOCATION_OWNER' using errcode = '42501';
    end if;
    if p_granted then
      select nullif(btrim(s.exact_address), '')
        into v_address
        from public.need_sensitive s
       where s.need_id = v_agreement.need_id;
      if v_address is null and not exists (
        select 1 from public.need_sensitive s join public.needs n on n.id=s.need_id join public.need_geography g on g.need_id=n.id
        where s.need_id=v_agreement.need_id and s.resolved_location is not null
          and private.resolved_location_record_valid(s.resolved_location,n.task_country_code,g.public_topology,s.exact_address,n.requester_account_id)
      ) then
        raise exception 'LOCATION_NOT_SET' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if p_granted then
    insert into public.access_grants (
      agreement_id,
      channel,
      granted_by_account_id,
      granted_to_account_id,
      status,
      granted_at,
      revoked_at,
      expires_at
    ) values (
      p_agreement_id,
      p_channel,
      v_uid,
      v_to,
      'GRANTED',
      statement_timestamp(),
      null,
      null
    )
    on conflict (agreement_id, channel, granted_by_account_id, granted_to_account_id)
    do update set
      status = 'GRANTED',
      granted_at = statement_timestamp(),
      revoked_at = null,
      expires_at = null
    returning id into v_grant_id;
  else
    update public.access_grants
       set status = 'REVOKED',
           revoked_at = coalesce(revoked_at, statement_timestamp())
     where agreement_id = p_agreement_id
       and channel = p_channel
       and granted_by_account_id = v_uid
       and granted_to_account_id = v_to
    returning id into v_grant_id;
  end if;

  return jsonb_build_object(
    'agreementId', p_agreement_id,
    'channel', p_channel,
    'grantedByAccountId', v_uid,
    'grantedToAccountId', v_to,
    'granted', p_granted,
    'grantId', v_grant_id,
    'authoritative', true
  );
end;
$function$
;

-- rpc_reveal_contact(uuid,text) | md5=358bc1d98aecdd33b4e464ca11a1b401 | owner=postgres | acl={postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres} | security_definer=t | config={search_path=pg_catalog}
CREATE OR REPLACE FUNCTION public.rpc_reveal_contact(p_agreement_id uuid, p_channel text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  u uuid := auth.uid(); a public.agreements; g public.access_grants;
  v_owner uuid; v_phone text; s public.need_sensitive;
begin
  if u is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  if p_channel is null or p_channel not in ('PHONE','EXACT_LOCATION') then
    raise exception using errcode='22023', message='UNSUPPORTED_CHANNEL';
  end if;

  select * into a from public.agreements where id = p_agreement_id;
  if not found then raise exception using errcode='P0002', message='AGREEMENT_NOT_FOUND'; end if;
  if u not in (a.requester_account_id, a.worker_account_id) then
    raise exception using errcode='42501', message='NOT_PARTY';
  end if;
  -- Dozvola zivi samo dok Dogovor zivi.
  if a.status <> 'CONFIRMED' then
    raise exception using errcode='42501', message='AGREEMENT_NOT_ACTIVE';
  end if;

  select * into g from public.access_grants
   where agreement_id = p_agreement_id and channel = p_channel
     and granted_to_account_id = u and status = 'GRANTED'
     and (expires_at is null or expires_at > statement_timestamp())
   limit 1;
  if not found then raise exception using errcode='42501', message='NO_ACTIVE_GRANT'; end if;

  if not private.safety_grant_valid(g.granted_by_account_id,g.granted_to_account_id,g.granted_at) then
    raise exception 'NO_ACTIVE_GRANT' using errcode='42501';
  end if;
  if not private.grant_is_ownable(p_agreement_id, p_channel, g.granted_by_account_id) then
    raise exception using errcode='42501', message='GRANT_NOT_FROM_DATA_OWNER';
  end if;
  if not private.grant_counterparty_ok(p_agreement_id, g.granted_by_account_id, u) then
    raise exception using errcode='42501', message='GRANT_NOT_TO_COUNTERPARTY';
  end if;

  if p_channel = 'PHONE' then
    v_owner := g.granted_by_account_id;
    select nullif(btrim(acc.phone),'') into v_phone from public.app_accounts acc where acc.id = v_owner;
    return jsonb_build_object('channel','PHONE','agreementId',a.id,'ownerAccountId',v_owner,
      'phone',v_phone,'grantedAt',g.granted_at,'expiresAt',g.expires_at,'authoritative',true);
  end if;

  select * into s from public.need_sensitive where need_id = a.need_id;
  if not found then raise exception using errcode='P0002', message='LOCATION_NOT_SET'; end if;
  if s.resolved_location is not null and not exists (
    select 1 from public.needs n join public.need_geography geo on geo.need_id=n.id where n.id=a.need_id
      and private.resolved_location_record_valid(s.resolved_location,n.task_country_code,geo.public_topology,s.exact_address,n.requester_account_id)
  ) then raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
  return jsonb_build_object('channel','EXACT_LOCATION','agreementId',a.id,
    'needId',a.need_id,'needRevision',(select revision from public.needs where id=a.need_id),
    'grantId',g.id,'ownerAccountId',g.granted_by_account_id,'resolvedLocation',s.resolved_location,
    'exactAddress',s.exact_address,'accessNotes',s.access_notes,
    'exactLat',s.exact_lat,'exactLng',s.exact_lng,
    'grantedAt',g.granted_at,'expiresAt',g.expires_at,'authoritative',true);
end;
$function$
;

-- rpc_get_agreement_workspace(uuid) | md5=0eb9b60cf7a52bdef85d8dc166690e0b | owner=postgres | acl={postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres} | security_definer=t | config={search_path=pg_catalog}
CREATE OR REPLACE FUNCTION public.rpc_get_agreement_workspace(p_agreement_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select jsonb_build_object(
      'id', a.id,
      'currentVersion', a.current_version,
      'status', coalesce(ae.state, a.status),
      'agreementStatus', a.status,
      'title', n.title,
      'approximateArea', n.approximate_area,
      'approximateCity', n.approximate_city,
      'requiredSlots', n.required_slots,
      'startsAt', n.starts_at,
      'terms', av.terms,
      'requesterAccountId', a.requester_account_id,
      'workerAccountId', a.worker_account_id, 'requesterProfileId', a.requester_profile_id, 'workerProfileId', a.worker_profile_id,
      'requesterName', rp.display_name,
      'workerName', wp.display_name,
      'executionMode', ae.mode,
      'requesterDeadlineAt', ae.requester_deadline_at,
      'problemOpened', (ae.problem_opened_at is not null),
      'myPhoneShared', exists (
        select 1 from public.access_grants g
         where g.agreement_id = a.id
           and g.channel = 'PHONE'
           and g.granted_by_account_id = v_uid
           and g.status = 'GRANTED'
             and private.safety_grant_valid(g.granted_by_account_id, g.granted_to_account_id, g.granted_at)
           and (g.expires_at is null or g.expires_at > statement_timestamp())
      ),
      'theirPhone', case
        when a.status = 'CONFIRMED' and exists (
          select 1 from public.access_grants g
           where g.agreement_id = a.id
             and g.channel = 'PHONE'
             and g.granted_to_account_id = v_uid
             and g.status = 'GRANTED'
             and private.safety_grant_valid(g.granted_by_account_id, g.granted_to_account_id, g.granted_at)
             and (g.expires_at is null or g.expires_at > statement_timestamp())
        ) then (
          select nullif(btrim(acc.phone), '')
            from public.app_accounts acc
           where acc.id = case when v_uid = a.requester_account_id then a.worker_account_id else a.requester_account_id end
        )
        else null
      end,
      'needId', a.need_id,
      'applicationId', a.selected_response_id,
      'createdAt', a.created_at
    )
    into v_result
    from public.agreements a
    join public.agreement_versions av
      on av.agreement_id = a.id and av.version = a.current_version
    join public.needs n on n.id = a.need_id
    join public.app_profiles rp on rp.id = a.requester_profile_id
    join public.app_profiles wp on wp.id = a.worker_profile_id
    left join public.agreement_execution ae on ae.agreement_id = a.id
   where a.id = p_agreement_id
     and v_uid in (a.requester_account_id, a.worker_account_id);

  if v_result is null then
    raise exception 'AGREEMENT_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0002';
  end if;
  return v_result || jsonb_build_object('actionState', private.agreement_action_state(p_agreement_id,v_uid));
end;
$function$
;

-- rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text) | md5=ad117da224ba9e4a3f7d70611aeaa6d8 | owner=postgres | acl={postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres} | security_definer=t | config={search_path=pg_catalog}
CREATE OR REPLACE FUNCTION public.rpc_submit_response(p_need_id uuid, p_need_revision integer, p_worker_profile_id uuid, p_covered_slots integer, p_price_rsd integer, p_proposed_start_at timestamp with time zone, p_proposed_end_at timestamp with time zone, p_scope_note text, p_client_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_location_ready boolean := false;
  u uuid := auth.uid();
  n public.needs;
  v_profile public.app_profiles;
  v_resp public.marketplace_responses;
  v_command private.response_submit_commands;
  v_match jsonb;
  v_content_hash text;
  v_request_hash text;
  v_result jsonb;
  v_version integer;
  v_selected_slots integer := 0;
  v_remaining_slots integer := 0;
begin
  if u is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;

  if p_client_request_id is null
     or char_length(btrim(p_client_request_id)) not between 8 and 200 then
    raise exception using errcode='22023', message='INVALID_CLIENT_REQUEST_ID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(u::text || ':' || p_client_request_id, 7241)
  );

  -- Bind only the semantic client command. Server-derived profile/Need snapshot
  -- intentionally does not enter the request hash, so a retry after a committed
  -- response replays the exact first result even if current context later moves.
  v_request_hash := encode(sha256(convert_to(jsonb_build_object(
    'needId', p_need_id,
    'needRevision', p_need_revision,
    'workerProfileId', p_worker_profile_id,
    'coveredSlots', p_covered_slots,
    'priceRsd', p_price_rsd,
    'proposedStartAt', p_proposed_start_at,
    'proposedEndAt', p_proposed_end_at,
    'scopeNote', coalesce(p_scope_note, '')
  )::text, 'UTF8')), 'hex');

  select * into v_command
    from private.response_submit_commands c
   where c.worker_account_id = u
     and c.client_request_id = p_client_request_id;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception using errcode='22023', message='IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_command.result || jsonb_build_object('idempotentReplay', true);
  end if;

  -- Shared mutation lock order remains Need first.
  select * into n
    from public.needs
   where id = p_need_id
   for update;

  if not found then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;

  if not private.accounts_same_world(n.requester_account_id, u) then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;

  select * into v_command
    from private.response_submit_commands c
   where c.worker_account_id = u
     and c.client_request_id = p_client_request_id
   for update;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception using errcode='22023', message='IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_command.result || jsonb_build_object('idempotentReplay', true);
  end if;

  if n.status not in ('PUBLISHED','SELECTION') then
    raise exception using errcode='22023', message='NEED_NOT_OPEN';
  end if;

  if n.requester_account_id = u then
    raise exception using errcode='42501', message='OWN_NEED';
  end if;

  if n.response_deadline is not null
     and n.response_deadline <= statement_timestamp() then
    raise exception using errcode='22023', message='RESPONSE_WINDOW_EXPIRED';
  end if;

  -- New work uses the same actual task-time boundary as search/dispatch.
  -- Replay already returned above; evaluate after the Need lock was acquired.
  if not private.need_search_time_admitted_v1(n.id,clock_timestamp()) then
    raise exception 'NEED_EXECUTION_WINDOW_EXPIRED' using errcode='PT409',
      hint='Vreme za ovaj zadatak je isteklo.';
  end if;

  if n.revision is distinct from p_need_revision then
    raise exception using errcode='P0001', message='STALE_REVIEW_REQUIRED';
  end if;

  -- Lock the current Worker profile after the Need. ACTIVE alone is not enough
  -- for legacy rows: P0C-02 rechecks the exact RU-1 minimum readiness facts.
  select * into v_profile
    from public.app_profiles p
   where p.id = p_worker_profile_id
   for update;

  if not found
     or v_profile.account_id <> u
     or v_profile.kind <> 'WORKER' then
    raise exception using errcode='42501', message='PROFILE_NOT_OWNED_BY_ACCOUNT';
  end if;

  IF v_profile.profile_status='ACTIVE'
    AND char_length(btrim(coalesce(v_profile.display_name,'')))>=2
    AND cardinality(coalesce(v_profile.skills,'{}'))>=1 THEN
  -- An ACTIVE worker can have saved work areas without a legacy city.
  -- Read only the existing owned Save projection; invalid areas fail closed.
  v_location_ready := char_length(btrim(coalesce(v_profile.city,''))) >= 2
    OR private.worker_remote_only_activation_ready_v1(v_profile.account_id,v_profile.skills) IS TRUE;
  IF v_location_ready IS NOT TRUE THEN
    BEGIN
      v_location_ready := jsonb_array_length(private.validate_worker_areas_v1(
        private.worker_saved_areas_v1(v_profile.account_id))) > 0;
    EXCEPTION WHEN SQLSTATE '22023' THEN
      v_location_ready := false;
    END;
  END IF;
  END IF;
  if v_profile.profile_status <> 'ACTIVE'
     or char_length(btrim(v_profile.display_name)) < 2
     or v_location_ready IS NOT TRUE
     or cardinality(v_profile.skills) < 1 then
    raise exception using errcode='P0001', message='WORKER_PROFILE_NOT_READY';
  end if;

  select coalesce(sum(s.covered_slots), 0)::integer
    into v_selected_slots
    from public.need_selections s
   where s.need_id = n.id
     and s.status = 'SELECTED';

  v_remaining_slots := greatest(0, n.required_slots - v_selected_slots);

  if v_remaining_slots < 1 then
    raise exception using errcode='P0001', message='NEED_FULL';
  end if;

  if p_covered_slots is null or p_covered_slots < 1 then
    raise exception using errcode='22023', message='INVALID_COVERED_SLOTS';
  end if;

  -- WPP01: people are committed per offer; the personal profile is not a team limit.
  -- Existing remaining-slot and pricing checks below remain authoritative.

  if p_covered_slots > v_remaining_slots then
    raise exception using
      errcode='22023',
      message='NEED_REMAINING_CAPACITY_EXCEEDED',
      detail=format('covered=%s,remaining=%s', p_covered_slots, v_remaining_slots);
  end if;

  perform private.assert_application_price_v5(n, p_covered_slots, p_price_rsd);

  if (p_proposed_start_at is null) <> (p_proposed_end_at is null)
     or (
       p_proposed_start_at is not null
       and p_proposed_end_at is not null
       and p_proposed_start_at >= p_proposed_end_at
     ) then
    raise exception using errcode='22023', message='INVALID_PROPOSED_INTERVAL';
  end if;

  if exists (
    select 1
      from public.marketplace_responses r
     where r.need_id = p_need_id
       and r.worker_account_id = u
       and (
         r.status = 'SELECTED'
         or exists (
           select 1
             from public.agreements a
            where a.selected_response_id = r.id
              and a.status in ('CONFIRMED','SUPERSEDED','COMPLETED')
         )
       )
  ) then
    raise exception using errcode='P0001', message='RESPONSE_ALREADY_SELECTED';
  end if;

  if p_proposed_start_at is null and n.schedule_kind='FIXED_WINDOW'
    and (n.starts_at is null or not isfinite(n.starts_at)
      or (n.ends_at is not null and (not isfinite(n.ends_at) or n.starts_at>=n.ends_at))) then
    raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
  end if;
  -- Start-only appointment cannot accept a new offer after its start while lifecycle tick catches up.
  if n.schedule_kind='FIXED_WINDOW' and n.ends_at is null
     and n.starts_at is not null and n.starts_at<=statement_timestamp() then
    raise exception 'FIXED_WINDOW_START_PASSED' using errcode='22023';
  end if;
  v_match := private.match_detail_for_calendar_interval(p_need_id, p_worker_profile_id,
    coalesce(p_proposed_start_at,case when n.schedule_kind='FIXED_WINDOW' and n.ends_at is not null then n.starts_at end),
    coalesce(p_proposed_end_at,case when n.schedule_kind='FIXED_WINDOW' and n.ends_at is not null then n.ends_at end));
  if not coalesce((v_match->>'responseAllowed')::boolean, false) then
    raise exception using
      errcode='P0001',
      message='WORKER_NOT_ELIGIBLE',
      detail=coalesce((v_match->'hardBlockers')::text, '[]');
  end if;

  select * into v_resp
    from public.marketplace_responses r
   where r.need_id = p_need_id
     and r.worker_account_id = u
     and r.status in ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
   order by r.created_at desc
   limit 1
   for update;

  -- Content identity includes the server-derived self-declared capability/team
  -- snapshot. It is not public trust/verification and is never copied into the
  -- global public profile DTO.
  v_content_hash := encode(sha256(convert_to(jsonb_build_object(
    'needRevision', n.revision,
    'pricingMode', n.mode,
    'applicationPriceBasis', (case when n.mode='MY_PRICE' and n.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
    'currency', 'RSD',
    'priceRsd', p_price_rsd,
    'coveredSlots', p_covered_slots,
    'proposedStartAt', p_proposed_start_at,
    'proposedEndAt', p_proposed_end_at,
    'scopeNote', coalesce(btrim(p_scope_note), ''),
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'workerTeamCapacity', v_profile.team_capacity,
    'workerSkills', to_jsonb(v_profile.skills),
    'workerTools', '[]'::jsonb,
    'workerLicenses', to_jsonb(v_profile.licenses),
    'workerVehicles', '[]'::jsonb
  )::text, 'UTF8')), 'hex');

  if v_resp.id is null then
    insert into public.marketplace_responses (
      need_id, worker_account_id, worker_profile_id, response_kind, status,
      submitted_against_need_revision, current_version, covered_slots,
      price_rsd, price_basis, proposed_start_at, proposed_end_at, scope_note, submitted_at
    ) values (
      p_need_id, u, p_worker_profile_id, 'OFFER', 'SUBMITTED', n.revision, 1,
      p_covered_slots, p_price_rsd, (case when n.mode='MY_PRICE' and n.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end), p_proposed_start_at, p_proposed_end_at,
      coalesce(p_scope_note, ''), statement_timestamp()
    )
    returning * into v_resp;
    v_version := 1;
  else
    v_version := v_resp.current_version + 1;
    update public.marketplace_responses
       set current_version = v_version,
           status = 'SUBMITTED',
           submitted_against_need_revision = n.revision,
           covered_slots = p_covered_slots,
           price_rsd = p_price_rsd,
           price_basis = (case when n.mode='MY_PRICE' and n.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
           proposed_start_at = p_proposed_start_at,
           proposed_end_at = p_proposed_end_at,
           scope_note = coalesce(p_scope_note, ''),
           submitted_at = statement_timestamp(),
           withdrawn_at = null
     where id = v_resp.id
     returning * into v_resp;
  end if;

  insert into public.marketplace_response_versions (
    response_id, version, need_revision, covered_slots, price_rsd, price_basis,
    proposed_start_at, proposed_end_at, scope_note, content_hash
  ) values (
    v_resp.id, v_version, n.revision, p_covered_slots, p_price_rsd, (case when n.mode='MY_PRICE' and n.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
    p_proposed_start_at, p_proposed_end_at, coalesce(p_scope_note, ''),
    v_content_hash
  );

  insert into private.response_application_snapshots (
    response_id, response_version, snapshot_schema,
    worker_profile_id, worker_team_capacity, covered_slots,
    need_required_slots, need_selected_slots_before_submit,
    need_remaining_slots_before_submit, pricing_mode, requester_price_rsd,
    worker_skills, worker_tools, worker_licenses, worker_vehicles
  ) values (
    v_resp.id, v_version, 'APPLICATION_V1_SELF_DECLARED',
    v_profile.id, v_profile.team_capacity, p_covered_slots,
    n.required_slots, v_selected_slots, v_remaining_slots,
    n.mode, n.requester_price_rsd,
    v_profile.skills, '{}'::text[], v_profile.licenses, '{}'::text[]
  );

  update public.opportunity_deliveries
     set status = 'RESPONDED',
         responded_at = statement_timestamp()
   where need_id = p_need_id
     and need_revision = n.revision
     and worker_account_id = u
     and status in ('READY','SEEN');

  v_result := jsonb_build_object(
    'responseId', v_resp.id,
    'applicationId', v_resp.id,
    'version', v_version,
    'needRevision', n.revision,
    'contentHash', v_content_hash,
    'status', v_resp.status,
    'pricingMode', n.mode,
    'applicationPriceBasis', (case when n.mode='MY_PRICE' and n.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
    'currency', 'RSD',
    'coveredSlots', p_covered_slots,
    'priceRsd', p_price_rsd,
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'authoritative', true,
    'idempotentReplay', false
  );

  insert into private.response_submit_commands (
    worker_account_id, client_request_id, request_hash,
    response_id, response_version, result
  ) values (
    u, p_client_request_id, v_request_hash,
    v_resp.id, v_version, v_result
  );

  -- PRE-V3: persisted version trigger owns Application semantic events.

  return v_result;
end;
$function$
;

COMMIT;
