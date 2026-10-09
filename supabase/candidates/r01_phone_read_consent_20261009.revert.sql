-- R01 / BE-01: EXACT REVERT: restore captured Agreement read definitions.
-- Prepared from current canonical DEV definitions (2026-10-09); NOT APPLIED.
-- Changes ONLY the two PHONE grant predicates in each of three read RPCs.
-- Preserves result shapes, ownership, ACLs, SECURITY DEFINER/search_path,
-- auth/party restrictions, pagination, ratingDue and actionState semantics.
-- No rows, tables, policies, triggers, Edge deploys or certificate update.
-- Pre/postflight enforce exact bodies, metadata and closure program digest.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';
do $preflight$
declare e record; actual text; meta text;
begin
 if private.closure_erasure_program_digest_v5() is distinct from 'dab1d731ee99625c6685bbd4df391228e0857e8fbb08fde35539815b7484af65' then
  raise exception 'R01_UNEXPECTED_CLOSURE_PROGRAM_DIGEST';
 end if;
 if not coalesce(private.retention_ai_source_ready(),false) then
  raise exception 'R01_CLOSURE_SOURCE_NOT_READY';
 end if;
 for e in select * from jsonb_to_recordset('[{"signature": "public.rpc_get_agreement_workspace(uuid)", "body_md5": "0eb9b60cf7a52bdef85d8dc166690e0b"}, {"signature": "public.rpc_list_my_agreements()", "body_md5": "06489ae3fe13b822cb3d026381ac3899"}, {"signature": "public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)", "body_md5": "02c73cc4db95c2198f54888d7a377003"}, {"signature": "private.safety_grant_valid(uuid,uuid,timestamptz)", "body_md5": "5d658dd5d719427b0ee0b03a5d872866"}]'::jsonb) as x(signature text, body_md5 text) loop
  select md5(p.prosrc) into actual from pg_proc p where p.oid=to_regprocedure(e.signature);
  if actual is distinct from e.body_md5 then
   raise exception 'R01_STALE_DEFINITION: % expected % actual %',e.signature,e.body_md5,actual;
  end if;
 end loop;
 select (select coalesce(jsonb_agg(jsonb_build_object(
 'oid',p.oid,'signature',p.oid::regprocedure::text,'owner',p.proowner,'acl',p.proacl::text,
 'definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'language',p.prolang,
 'config',p.proconfig,'args',p.proargtypes::text,'result',p.prorettype)
 order by p.oid::regprocedure::text),'[]'::jsonb)::text
 from pg_proc p where p.oid in (to_regprocedure('public.rpc_get_agreement_workspace(uuid)'),to_regprocedure('public.rpc_list_my_agreements()'),to_regprocedure('public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)'))) into meta;
 perform set_config('uskoci.r01_metadata',meta,true);
 perform set_config('uskoci.r01_closure_program_digest',private.closure_erasure_program_digest_v5(),true);
end;
$preflight$;
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
           and (g.expires_at is null or g.expires_at > statement_timestamp())
      ),
      'theirPhone', case
        when a.status = 'CONFIRMED' and exists (
          select 1 from public.access_grants g
           where g.agreement_id = a.id
             and g.channel = 'PHONE'
             and g.granted_to_account_id = v_uid
             and g.status = 'GRANTED'
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
$function$;

CREATE OR REPLACE FUNCTION public.rpc_list_my_agreements()
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

  select coalesce(jsonb_agg(x.payload order by x.created_at desc), '[]'::jsonb)
    into v_result
    from (
      select
        a.created_at,
        jsonb_build_object(
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
          'workerAccountId', a.worker_account_id,
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
               and (g.expires_at is null or g.expires_at > statement_timestamp())
          ),
          'theirPhone', case
            when a.status = 'CONFIRMED' and exists (
              select 1 from public.access_grants g
               where g.agreement_id = a.id
                 and g.channel = 'PHONE'
                 and g.granted_to_account_id = v_uid
                 and g.status = 'GRANTED'
                 and (g.expires_at is null or g.expires_at > statement_timestamp())
            ) then (
              select nullif(btrim(acc.phone), '')
                from public.app_accounts acc
               where acc.id = case when v_uid = a.requester_account_id then a.worker_account_id else a.requester_account_id end
            )
            else null
          end,
          'createdAt', a.created_at
        ) as payload
      from public.agreements a
      join public.agreement_versions av
        on av.agreement_id = a.id and av.version = a.current_version
      join public.needs n on n.id = a.need_id
      join public.app_profiles rp on rp.id = a.requester_profile_id
      join public.app_profiles wp on wp.id = a.worker_profile_id
      left join public.agreement_execution ae on ae.agreement_id = a.id
      where v_uid in (a.requester_account_id, a.worker_account_id)
    ) x;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_list_my_agreements_page(p_scope text DEFAULT 'ALL'::text, p_limit integer DEFAULT 30, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_items jsonb;
  v_restricted boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_before_at is null) <> (p_before_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  if p_scope is null or p_scope not in ('ALL','ACTIVE','HISTORY') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;

  -- EX-04 S3 (RC-03): whether MY rating of a finished Dogovor is still due is part of the page, so the client never has to ask once per Dogovor. It is exactly the answer of
  -- rpc_get_my_agreement_review(...).eligible: no review of mine yet, my account is not under a closure restriction, and the Dogovor and its execution are COMPLETED.
  v_restricted := private.closure_account_restricted(v_uid);
  select coalesce(jsonb_agg(x.payload order by x.created_at desc, x.id desc), '[]'::jsonb) into v_items
  from (
    select a.created_at, a.id,
      jsonb_build_object(
        'id', a.id, 'sortAt', a.created_at,
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
           where g.agreement_id = a.id and g.channel = 'PHONE' and g.granted_by_account_id = v_uid
             and g.status = 'GRANTED' and (g.expires_at is null or g.expires_at > statement_timestamp())),
        'theirPhone', case
          when a.status = 'CONFIRMED' and exists (
            select 1 from public.access_grants g
             where g.agreement_id = a.id and g.channel = 'PHONE' and g.granted_to_account_id = v_uid
               and g.status = 'GRANTED' and (g.expires_at is null or g.expires_at > statement_timestamp())
          ) then (
            select nullif(btrim(acc.phone), '') from public.app_accounts acc
             where acc.id = case when v_uid = a.requester_account_id then a.worker_account_id else a.requester_account_id end)
          else null
        end,
        'pendingChange', (
          select jsonb_build_object('id', c.id, 'proposedByMe', c.proposed_by_account_id = v_uid, 'createdAt', c.created_at)
            from public.agreement_change_proposals c
           where c.agreement_id = a.id and c.status = 'PENDING'
           order by c.created_at desc, c.id desc
           limit 1),
        'createdAt', a.created_at,
        'ratingDue', coalesce(a.status = 'COMPLETED' and ae.state = 'COMPLETED' and not v_restricted
          and not exists (select 1 from private.agreement_reviews rv where rv.agreement_id = a.id and rv.reviewer_account_id = v_uid), false)
      ) as payload
    from public.agreements a
    join public.agreement_versions av on av.agreement_id = a.id and av.version = a.current_version
    join public.needs n on n.id = a.need_id
    join public.app_profiles rp on rp.id = a.requester_profile_id
    join public.app_profiles wp on wp.id = a.worker_profile_id
    left join public.agreement_execution ae on ae.agreement_id = a.id
    where v_uid in (a.requester_account_id, a.worker_account_id)
      and (p_scope = 'ALL' or (p_scope = 'ACTIVE') = (coalesce(ae.state, a.status) in ('CONFIRMED','AWAITING_REQUESTER')))
      and (p_before_at is null or (a.created_at, a.id) < (p_before_at, p_before_id))
    order by a.created_at desc, a.id desc
    limit p_limit + 1
  ) x;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    'asOf', statement_timestamp());
end
$function$;
do $postflight$
declare e record; actual text; meta text;
begin
 for e in select * from jsonb_to_recordset('[{"signature": "public.rpc_get_agreement_workspace(uuid)", "body_md5": "afa60817d35f0efd1317e4b9915aa872"}, {"signature": "public.rpc_list_my_agreements()", "body_md5": "f4c56eca5c3c247ffb284e91265d81b0"}, {"signature": "public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)", "body_md5": "5017f90ff8d9e5cd29ead0f88a6b0106"}]'::jsonb) as x(signature text, body_md5 text) loop
  select md5(p.prosrc) into actual from pg_proc p where p.oid=to_regprocedure(e.signature);
  if actual is distinct from e.body_md5 then
   raise exception 'R01_READBACK_MISMATCH: %',e.signature;
  end if;
 end loop;
 select (select coalesce(jsonb_agg(jsonb_build_object(
 'oid',p.oid,'signature',p.oid::regprocedure::text,'owner',p.proowner,'acl',p.proacl::text,
 'definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'language',p.prolang,
 'config',p.proconfig,'args',p.proargtypes::text,'result',p.prorettype)
 order by p.oid::regprocedure::text),'[]'::jsonb)::text
 from pg_proc p where p.oid in (to_regprocedure('public.rpc_get_agreement_workspace(uuid)'),to_regprocedure('public.rpc_list_my_agreements()'),to_regprocedure('public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)'))) into meta;
 if meta is distinct from current_setting('uskoci.r01_metadata') then
  raise exception 'R01_METADATA_CHANGED';
 end if;
 if private.closure_erasure_program_digest_v5() is distinct from current_setting('uskoci.r01_closure_program_digest') then
  raise exception 'R01_CLOSURE_PROGRAM_DIGEST_CHANGED';
 end if;
 if not coalesce(private.retention_ai_source_ready(),false) then
  raise exception 'R01_CLOSURE_SOURCE_NOT_READY_AFTER';
 end if;
end;
$postflight$;
commit;
