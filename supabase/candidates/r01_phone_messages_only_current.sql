-- R01 / Agreement: PHONE closed at every exposed server read/write.
-- SOURCE-ONLY, NOT A MIGRATION; no DEV/PROD application.
-- Baseline: read-only DEV definitions on 2026-10-29, six exact body/definition
-- hashes and metadata; no user records. Guard rejects the hosted cli_login_postgres.
-- A disposable PG17 or isolated PGlite PG18 proof cannot certify live rollout.
-- New PHONE grants forbidden, old PHONE grants owner-revocable, PHONE reveal
-- forbidden, all 3 Agreement reader keys retained as false/null.
-- EXACT_LOCATION, phone OTP login, raw message text, participants, read shapes,
-- current SECURITY DEFINER ownership and function ACLs are unchanged.
-- A second read of the same old preimage will correctly REFUSE after applying.
-- Closure/source certification, current-client/native/OTA and Auth/PostgREST
-- positive/negative proof remain independently required before deployment.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
DO $r01_pre$
DECLARE x record; p record;
BEGIN
  IF current_setting('uskoci.r01.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
     OR current_user <> 'postgres'
     OR current_database() <> 'postgres'
     OR current_setting('server_version_num')::integer/10000 NOT IN (17,18)
     OR to_regrole('cli_login_postgres') IS NOT NULL THEN
    RAISE EXCEPTION 'R01_PHONE_DISPOSABLE_ONLY' USING errcode='55000';
  END IF;
  FOR x IN SELECT * FROM jsonb_to_recordset('[{"sig":"private.grant_is_ownable(uuid,text,uuid)","bodyMd5":"5af91eb2406d3c3f80d6f56bfb47f1a2","definitionMd5":"efece167b20dcb4fbee13fc9253297e9","owner":"postgres","acl":"{postgres=X/postgres}","config":"{search_path=pg_catalog}","definer":true,"volatility":"s"},{"sig":"public.rpc_get_agreement_workspace(uuid)","bodyMd5":"0eb9b60cf7a52bdef85d8dc166690e0b","definitionMd5":"01b83d796fe15a1d36906a491ca212b5","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":"{search_path=pg_catalog}","definer":true,"volatility":"s"},{"sig":"public.rpc_list_my_agreements_page(text,integer,timestamp with time zone,uuid)","bodyMd5":"02c73cc4db95c2198f54888d7a377003","definitionMd5":"ff384ad956af46c2fc097b491c268502","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":"{search_path=pg_catalog}","definer":true,"volatility":"s"},{"sig":"public.rpc_list_my_agreements()","bodyMd5":"06489ae3fe13b822cb3d026381ac3899","definitionMd5":"56e97679d7bad14533707db95a0c72f3","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":"{search_path=pg_catalog}","definer":true,"volatility":"s"},{"sig":"public.rpc_reveal_contact(uuid,text)","bodyMd5":"358bc1d98aecdd33b4e464ca11a1b401","definitionMd5":"8a471f650e9e046ae55dab52c4379e02","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":"{search_path=pg_catalog}","definer":true,"volatility":"s"},{"sig":"public.rpc_set_contact_grant(uuid,text,boolean)","bodyMd5":"5a6d710106832c1da7bc147a704f9301","definitionMd5":"f743b7b6e61a1ec76d29d166aa8789f9","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":"{search_path=pg_catalog}","definer":true,"volatility":"v"}]'::jsonb)
    AS t(sig text, "bodyMd5" text, "definitionMd5" text, owner text, acl text,
         config text, definer boolean, volatility text)
  LOOP
    SELECT p0.* INTO p FROM pg_proc p0 WHERE p0.oid=to_regprocedure(x.sig);
    IF NOT FOUND OR md5(p.prosrc) IS DISTINCT FROM x."bodyMd5"
       OR (current_setting('server_version_num')::integer/10000=17
          AND md5(pg_get_functiondef(p.oid)) IS DISTINCT FROM x."definitionMd5")
       OR pg_get_userbyid(p.proowner) IS DISTINCT FROM x.owner
       OR p.proacl::text IS DISTINCT FROM x.acl
       OR p.proconfig::text IS DISTINCT FROM x.config
       OR p.prosecdef IS DISTINCT FROM x.definer
       OR p.provolatile::text IS DISTINCT FROM x.volatility THEN
       RAISE EXCEPTION 'R01_PHONE_SOURCE_PREDECESSOR_CHANGED: %',x.sig USING errcode='55000';
    END IF;
  END LOOP;
END;
$r01_pre$;

CREATE OR REPLACE FUNCTION private.grant_is_ownable(p_agreement_id uuid, p_channel text, p_granter uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  select exists (
    select 1 from public.agreements a
    where a.id = p_agreement_id
      and case p_channel
        when 'EXACT_LOCATION' then a.requester_account_id = p_granter
        when 'PHONE' then false
        else false
      end
  );
$function$;

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
      'myPhoneShared', false,
      'theirPhone', null,
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
        'myPhoneShared', false,
        'theirPhone', null,
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
          'myPhoneShared', false,
          'theirPhone', null,
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
  -- Historical PHONE receipts remain revocable, never reveal a phone.
  if p_channel = 'PHONE' then
    raise exception 'PHONE_SHARING_DISABLED' using errcode='42501';
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
$function$;

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
  -- Product contract: only Agreement messages. Existing PHONE grants
  -- may still be REVOKED by their owner; no new PHONE grant is admitted.
  if p_channel = 'PHONE' and p_granted then
    raise exception 'PHONE_SHARING_DISABLED' using errcode = '42501';
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
$function$;
DO $r01_post$
DECLARE x record; p record;
BEGIN
  FOR x IN SELECT * FROM jsonb_to_recordset(
    '[{"sig":"private.grant_is_ownable(uuid,text,uuid)","source":"\n  select exists (\n    select 1 from public.agreements a\n    where a.id = p_agreement_id\n      and case p_channel\n        when ''EXACT_LOCATION'' then a.requester_account_id = p_granter\n        when ''PHONE'' then false\n        else false\n      end\n  );\n"},{"sig":"public.rpc_get_agreement_workspace(uuid)","source":"\ndeclare\n  v_uid uuid := auth.uid();\n  v_result jsonb;\nbegin\n  if v_uid is null then\n    raise exception ''AUTH_REQUIRED'' using errcode = ''28000'';\n  end if;\n\n  select jsonb_build_object(\n      ''id'', a.id,\n      ''currentVersion'', a.current_version,\n      ''status'', coalesce(ae.state, a.status),\n      ''agreementStatus'', a.status,\n      ''title'', n.title,\n      ''approximateArea'', n.approximate_area,\n      ''approximateCity'', n.approximate_city,\n      ''requiredSlots'', n.required_slots,\n      ''startsAt'', n.starts_at,\n      ''terms'', av.terms,\n      ''requesterAccountId'', a.requester_account_id,\n      ''workerAccountId'', a.worker_account_id, ''requesterProfileId'', a.requester_profile_id, ''workerProfileId'', a.worker_profile_id,\n      ''requesterName'', rp.display_name,\n      ''workerName'', wp.display_name,\n      ''executionMode'', ae.mode,\n      ''requesterDeadlineAt'', ae.requester_deadline_at,\n      ''problemOpened'', (ae.problem_opened_at is not null),\n      ''myPhoneShared'', false,\n      ''theirPhone'', null,\n      ''needId'', a.need_id,\n      ''applicationId'', a.selected_response_id,\n      ''createdAt'', a.created_at\n    )\n    into v_result\n    from public.agreements a\n    join public.agreement_versions av\n      on av.agreement_id = a.id and av.version = a.current_version\n    join public.needs n on n.id = a.need_id\n    join public.app_profiles rp on rp.id = a.requester_profile_id\n    join public.app_profiles wp on wp.id = a.worker_profile_id\n    left join public.agreement_execution ae on ae.agreement_id = a.id\n   where a.id = p_agreement_id\n     and v_uid in (a.requester_account_id, a.worker_account_id);\n\n  if v_result is null then\n    raise exception ''AGREEMENT_NOT_FOUND_OR_FORBIDDEN'' using errcode = ''P0002'';\n  end if;\n  return v_result || jsonb_build_object(''actionState'', private.agreement_action_state(p_agreement_id,v_uid));\nend;\n"},{"sig":"public.rpc_list_my_agreements_page(text,integer,timestamp with time zone,uuid)","source":"\ndeclare\n  v_uid uuid := auth.uid();\n  v_items jsonb;\n  v_restricted boolean;\nbegin\n  if v_uid is null then raise exception ''AUTH_REQUIRED'' using errcode = ''28000''; end if;\n  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_before_at is null) <> (p_before_id is null) then\n    raise exception ''INVALID_PAGE'' using errcode = ''22023'';\n  end if;\n  if p_scope is null or p_scope not in (''ALL'',''ACTIVE'',''HISTORY'') then\n    raise exception ''INVALID_SCOPE'' using errcode = ''22023'';\n  end if;\n\n  -- EX-04 S3 (RC-03): whether MY rating of a finished Dogovor is still due is part of the page, so the client never has to ask once per Dogovor. It is exactly the answer of\n  -- rpc_get_my_agreement_review(...).eligible: no review of mine yet, my account is not under a closure restriction, and the Dogovor and its execution are COMPLETED.\n  v_restricted := private.closure_account_restricted(v_uid);\n  select coalesce(jsonb_agg(x.payload order by x.created_at desc, x.id desc), ''[]''::jsonb) into v_items\n  from (\n    select a.created_at, a.id,\n      jsonb_build_object(\n        ''id'', a.id, ''sortAt'', a.created_at,\n        ''currentVersion'', a.current_version,\n        ''status'', coalesce(ae.state, a.status),\n        ''agreementStatus'', a.status,\n        ''title'', n.title,\n        ''approximateArea'', n.approximate_area,\n        ''approximateCity'', n.approximate_city,\n        ''requiredSlots'', n.required_slots,\n        ''startsAt'', n.starts_at,\n        ''terms'', av.terms,\n        ''requesterAccountId'', a.requester_account_id,\n        ''workerAccountId'', a.worker_account_id, ''requesterProfileId'', a.requester_profile_id, ''workerProfileId'', a.worker_profile_id,\n        ''requesterName'', rp.display_name,\n        ''workerName'', wp.display_name,\n        ''executionMode'', ae.mode,\n        ''requesterDeadlineAt'', ae.requester_deadline_at,\n        ''problemOpened'', (ae.problem_opened_at is not null),\n        ''myPhoneShared'', false,\n        ''theirPhone'', null,\n        ''pendingChange'', (\n          select jsonb_build_object(''id'', c.id, ''proposedByMe'', c.proposed_by_account_id = v_uid, ''createdAt'', c.created_at)\n            from public.agreement_change_proposals c\n           where c.agreement_id = a.id and c.status = ''PENDING''\n           order by c.created_at desc, c.id desc\n           limit 1),\n        ''createdAt'', a.created_at,\n        ''ratingDue'', coalesce(a.status = ''COMPLETED'' and ae.state = ''COMPLETED'' and not v_restricted\n          and not exists (select 1 from private.agreement_reviews rv where rv.agreement_id = a.id and rv.reviewer_account_id = v_uid), false)\n      ) as payload\n    from public.agreements a\n    join public.agreement_versions av on av.agreement_id = a.id and av.version = a.current_version\n    join public.needs n on n.id = a.need_id\n    join public.app_profiles rp on rp.id = a.requester_profile_id\n    join public.app_profiles wp on wp.id = a.worker_profile_id\n    left join public.agreement_execution ae on ae.agreement_id = a.id\n    where v_uid in (a.requester_account_id, a.worker_account_id)\n      and (p_scope = ''ALL'' or (p_scope = ''ACTIVE'') = (coalesce(ae.state, a.status) in (''CONFIRMED'',''AWAITING_REQUESTER'')))\n      and (p_before_at is null or (a.created_at, a.id) < (p_before_at, p_before_id))\n    order by a.created_at desc, a.id desc\n    limit p_limit + 1\n  ) x;\n\n  return jsonb_build_object(\n    ''items'', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,\n    ''hasMore'', jsonb_array_length(v_items) > p_limit,\n    ''asOf'', statement_timestamp());\nend\n"},{"sig":"public.rpc_list_my_agreements()","source":"\ndeclare\n  v_uid uuid := auth.uid();\n  v_result jsonb;\nbegin\n  if v_uid is null then\n    raise exception ''AUTH_REQUIRED'' using errcode = ''28000'';\n  end if;\n\n  select coalesce(jsonb_agg(x.payload order by x.created_at desc), ''[]''::jsonb)\n    into v_result\n    from (\n      select\n        a.created_at,\n        jsonb_build_object(\n          ''id'', a.id,\n          ''currentVersion'', a.current_version,\n          ''status'', coalesce(ae.state, a.status),\n          ''agreementStatus'', a.status,\n          ''title'', n.title,\n          ''approximateArea'', n.approximate_area,\n          ''approximateCity'', n.approximate_city,\n          ''requiredSlots'', n.required_slots,\n          ''startsAt'', n.starts_at,\n          ''terms'', av.terms,\n          ''requesterAccountId'', a.requester_account_id,\n          ''workerAccountId'', a.worker_account_id,\n          ''requesterName'', rp.display_name,\n          ''workerName'', wp.display_name,\n          ''executionMode'', ae.mode,\n          ''requesterDeadlineAt'', ae.requester_deadline_at,\n          ''problemOpened'', (ae.problem_opened_at is not null),\n          ''myPhoneShared'', false,\n          ''theirPhone'', null,\n          ''createdAt'', a.created_at\n        ) as payload\n      from public.agreements a\n      join public.agreement_versions av\n        on av.agreement_id = a.id and av.version = a.current_version\n      join public.needs n on n.id = a.need_id\n      join public.app_profiles rp on rp.id = a.requester_profile_id\n      join public.app_profiles wp on wp.id = a.worker_profile_id\n      left join public.agreement_execution ae on ae.agreement_id = a.id\n      where v_uid in (a.requester_account_id, a.worker_account_id)\n    ) x;\n\n  return v_result;\nend;\n"},{"sig":"public.rpc_reveal_contact(uuid,text)","source":"\ndeclare\n  u uuid := auth.uid(); a public.agreements; g public.access_grants;\n  v_owner uuid; v_phone text; s public.need_sensitive;\nbegin\n  if u is null then raise exception using errcode=''42501'', message=''AUTH_REQUIRED''; end if;\n  if p_channel is null or p_channel not in (''PHONE'',''EXACT_LOCATION'') then\n    raise exception using errcode=''22023'', message=''UNSUPPORTED_CHANNEL'';\n  end if;\n  -- Historical PHONE receipts remain revocable, never reveal a phone.\n  if p_channel = ''PHONE'' then\n    raise exception ''PHONE_SHARING_DISABLED'' using errcode=''42501'';\n  end if;\n\n  select * into a from public.agreements where id = p_agreement_id;\n  if not found then raise exception using errcode=''P0002'', message=''AGREEMENT_NOT_FOUND''; end if;\n  if u not in (a.requester_account_id, a.worker_account_id) then\n    raise exception using errcode=''42501'', message=''NOT_PARTY'';\n  end if;\n  -- Dozvola zivi samo dok Dogovor zivi.\n  if a.status <> ''CONFIRMED'' then\n    raise exception using errcode=''42501'', message=''AGREEMENT_NOT_ACTIVE'';\n  end if;\n\n  select * into g from public.access_grants\n   where agreement_id = p_agreement_id and channel = p_channel\n     and granted_to_account_id = u and status = ''GRANTED''\n     and (expires_at is null or expires_at > statement_timestamp())\n   limit 1;\n  if not found then raise exception using errcode=''42501'', message=''NO_ACTIVE_GRANT''; end if;\n\n  if not private.safety_grant_valid(g.granted_by_account_id,g.granted_to_account_id,g.granted_at) then\n    raise exception ''NO_ACTIVE_GRANT'' using errcode=''42501'';\n  end if;\n  if not private.grant_is_ownable(p_agreement_id, p_channel, g.granted_by_account_id) then\n    raise exception using errcode=''42501'', message=''GRANT_NOT_FROM_DATA_OWNER'';\n  end if;\n  if not private.grant_counterparty_ok(p_agreement_id, g.granted_by_account_id, u) then\n    raise exception using errcode=''42501'', message=''GRANT_NOT_TO_COUNTERPARTY'';\n  end if;\n\n  if p_channel = ''PHONE'' then\n    v_owner := g.granted_by_account_id;\n    select nullif(btrim(acc.phone),'''') into v_phone from public.app_accounts acc where acc.id = v_owner;\n    return jsonb_build_object(''channel'',''PHONE'',''agreementId'',a.id,''ownerAccountId'',v_owner,\n      ''phone'',v_phone,''grantedAt'',g.granted_at,''expiresAt'',g.expires_at,''authoritative'',true);\n  end if;\n\n  select * into s from public.need_sensitive where need_id = a.need_id;\n  if not found then raise exception using errcode=''P0002'', message=''LOCATION_NOT_SET''; end if;\n  if s.resolved_location is not null and not exists (\n    select 1 from public.needs n join public.need_geography geo on geo.need_id=n.id where n.id=a.need_id\n      and private.resolved_location_record_valid(s.resolved_location,n.task_country_code,geo.public_topology,s.exact_address,n.requester_account_id)\n  ) then raise exception ''LOCATION_BINDING_CHANGED'' using errcode=''22023''; end if;\n  return jsonb_build_object(''channel'',''EXACT_LOCATION'',''agreementId'',a.id,\n    ''needId'',a.need_id,''needRevision'',(select revision from public.needs where id=a.need_id),\n    ''grantId'',g.id,''ownerAccountId'',g.granted_by_account_id,''resolvedLocation'',s.resolved_location,\n    ''exactAddress'',s.exact_address,''accessNotes'',s.access_notes,\n    ''exactLat'',s.exact_lat,''exactLng'',s.exact_lng,\n    ''grantedAt'',g.granted_at,''expiresAt'',g.expires_at,''authoritative'',true);\nend;\n"},{"sig":"public.rpc_set_contact_grant(uuid,text,boolean)","source":"\ndeclare\n  v_uid uuid := auth.uid();\n  v_agreement public.agreements%rowtype;\n  v_to uuid;\n  v_grant_id uuid;\n  v_phone text;\n  v_address text;\nbegin\n  if v_uid is null then\n    raise exception ''AUTH_REQUIRED'' using errcode = ''28000'';\n  end if;\n  if p_channel not in (''PHONE'', ''EXACT_LOCATION'') then\n    raise exception ''UNSUPPORTED_CHANNEL'' using errcode = ''22023'';\n  end if;\n  if p_granted is null then\n    raise exception ''GRANT_DECISION_REQUIRED'' using errcode = ''22004'';\n  end if;\n  -- Product contract: only Agreement messages. Existing PHONE grants\n  -- may still be REVOKED by their owner; no new PHONE grant is admitted.\n  if p_channel = ''PHONE'' and p_granted then\n    raise exception ''PHONE_SHARING_DISABLED'' using errcode = ''42501'';\n  end if;\n\n  select *\n    into v_agreement\n    from public.agreements\n   where id = p_agreement_id\n   for update;\n\n  if not found then\n    raise exception ''AGREEMENT_NOT_FOUND'' using errcode = ''P0002'';\n  end if;\n  if v_uid not in (v_agreement.requester_account_id, v_agreement.worker_account_id) then\n    raise exception ''NOT_PARTY'' using errcode = ''42501'';\n  end if;\n\n  v_to := case\n            when v_uid = v_agreement.requester_account_id then v_agreement.worker_account_id\n            else v_agreement.requester_account_id\n          end;\n\n  -- Revocation is deliberately allowed after cancellation/completion so a\n  -- user can always close their own grant. New grants require a live agreement.\n  if p_granted and v_agreement.status <> ''CONFIRMED'' then\n    raise exception ''AGREEMENT_NOT_ACTIVE'' using errcode = ''P0001'', detail = v_agreement.status;\n  end if;\n\n  if p_channel = ''PHONE'' and p_granted then\n    select nullif(btrim(a.phone), '''')\n      into v_phone\n      from public.app_accounts a\n     where a.id = v_uid;\n    if v_phone is null then\n      raise exception ''PHONE_NOT_SET'' using errcode = ''P0001'';\n    end if;\n  end if;\n\n  -- Exact Need location belongs to the requester. A worker cannot grant a\n  -- requester''s address back to them or to anyone else.\n  if p_channel = ''EXACT_LOCATION'' then\n    if v_uid <> v_agreement.requester_account_id then\n      raise exception ''NOT_LOCATION_OWNER'' using errcode = ''42501'';\n    end if;\n    if p_granted then\n      select nullif(btrim(s.exact_address), '''')\n        into v_address\n        from public.need_sensitive s\n       where s.need_id = v_agreement.need_id;\n      if v_address is null and not exists (\n        select 1 from public.need_sensitive s join public.needs n on n.id=s.need_id join public.need_geography g on g.need_id=n.id\n        where s.need_id=v_agreement.need_id and s.resolved_location is not null\n          and private.resolved_location_record_valid(s.resolved_location,n.task_country_code,g.public_topology,s.exact_address,n.requester_account_id)\n      ) then\n        raise exception ''LOCATION_NOT_SET'' using errcode = ''P0001'';\n      end if;\n    end if;\n  end if;\n\n  if p_granted then\n    insert into public.access_grants (\n      agreement_id,\n      channel,\n      granted_by_account_id,\n      granted_to_account_id,\n      status,\n      granted_at,\n      revoked_at,\n      expires_at\n    ) values (\n      p_agreement_id,\n      p_channel,\n      v_uid,\n      v_to,\n      ''GRANTED'',\n      statement_timestamp(),\n      null,\n      null\n    )\n    on conflict (agreement_id, channel, granted_by_account_id, granted_to_account_id)\n    do update set\n      status = ''GRANTED'',\n      granted_at = statement_timestamp(),\n      revoked_at = null,\n      expires_at = null\n    returning id into v_grant_id;\n  else\n    update public.access_grants\n       set status = ''REVOKED'',\n           revoked_at = coalesce(revoked_at, statement_timestamp())\n     where agreement_id = p_agreement_id\n       and channel = p_channel\n       and granted_by_account_id = v_uid\n       and granted_to_account_id = v_to\n    returning id into v_grant_id;\n  end if;\n\n  return jsonb_build_object(\n    ''agreementId'', p_agreement_id,\n    ''channel'', p_channel,\n    ''grantedByAccountId'', v_uid,\n    ''grantedToAccountId'', v_to,\n    ''granted'', p_granted,\n    ''grantId'', v_grant_id,\n    ''authoritative'', true\n  );\nend;\n"}]'::jsonb) AS t(sig text, source text)
  LOOP
    SELECT p0.* INTO p FROM pg_proc p0 WHERE p0.oid=to_regprocedure(x.sig);
    IF NOT FOUND OR p.prosrc IS DISTINCT FROM x.source
       OR pg_get_userbyid(p.proowner) <> 'postgres' OR NOT p.prosecdef
       OR p.proconfig::text <> '{search_path=pg_catalog}' THEN
       RAISE EXCEPTION 'R01_PHONE_POSTCONDITION_FAILED: %',x.sig USING errcode='55000';
    END IF;
  END LOOP;
END;
$r01_post$;
COMMIT;
