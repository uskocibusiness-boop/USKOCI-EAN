-- USKOCI DEV rollback preimage captured 2026-11-21 (read-only SELECT on leqcwgzvjsxugfgzdmth).
-- Exact live definitions before agreement_cancel_pending_20261121.candidate.sql. Restore only as a controlled rollback.
-- CREATE OR REPLACE preserves current ownership and ACLs; metadata is recorded above each definition.
BEGIN;

-- rpc_cancel_agreement(uuid,text) | md5=e592af7aead2172ff769f38aada8e056 | functiondef_md5=ea76e71660af379c1c5599a674a35404 | owner=postgres | acl={postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres} | security_definer=t | config={search_path=pg_catalog}
CREATE OR REPLACE FUNCTION public.rpc_cancel_agreement(p_agreement_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  uid uuid := auth.uid();
  v_need_id uuid;
  v_agr public.agreements%rowtype;
  v_covered integer;
  v_need public.needs%rowtype;
  v_execution public.agreement_execution%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_part integer;
  v_parts integer;
  v_message_prefix text;
  v_chunk_chars constant integer := 1967;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if v_reason is null or v_reason ~ '^[[:space:]]*$' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(v_reason) > 4000 then
    raise exception 'REASON_TOO_LONG' using errcode = '22023';
  end if;

  select a.need_id into v_need_id
    from public.agreements a
   where a.id = p_agreement_id;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.fn_is_party(p_agreement_id, uid) then
    raise exception 'NOT_PARTY' using errcode = '42501';
  end if;

  select * into v_need
    from public.needs n
   where n.id = v_need_id
   for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode = 'P0002'; end if;

  select * into v_agr from public.agreements
   where id = p_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_agr.need_id is distinct from v_need.id then
    raise exception 'AGREEMENT_NEED_MISMATCH' using errcode = 'P0001';
  end if;
  if not public.fn_is_party(p_agreement_id, uid) then
    raise exception 'NOT_PARTY' using errcode = '42501';
  end if;
  if v_agr.status = 'CANCELLED' then return; end if;
  if v_agr.status = 'COMPLETED' then
    raise exception 'ALREADY_COMPLETED' using errcode = 'P0001';
  end if;

  -- The same Need -> Agreement -> Execution order as completion. The action
  -- projection permits either party while CONFIRMED and only the worker after
  -- marking done. A direct RPC cannot bypass that already-published rule.
  if v_agr.status <> 'CONFIRMED' then
    raise exception 'AGREEMENT_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  select * into v_execution from public.agreement_execution
   where agreement_id = p_agreement_id for update;
  if not found then
    raise exception 'EXECUTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_execution.agreement_version <> v_agr.current_version then
    raise exception 'EXECUTION_VERSION_MISMATCH' using errcode = 'P0001';
  end if;
  if not (v_execution.state = 'CONFIRMED'
      or (v_execution.state = 'AWAITING_REQUESTER' and uid = v_agr.worker_account_id)) then
    raise exception 'AGREEMENT_CANCELLATION_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  update public.agreements set status = 'CANCELLED' where id = p_agreement_id;
  update public.agreement_execution set state = 'CANCELLED'
   where agreement_id = p_agreement_id;
  update public.need_selections set status = 'CANCELLED'
   where id = v_agr.selection_id;
  update public.marketplace_responses
     set status = 'NOT_SELECTED', selected_at = null
   where id = v_agr.selected_response_id;
  update public.access_grants
     set status = 'REVOKED',
         revoked_at = coalesce(revoked_at, statement_timestamp())
   where agreement_id = p_agreement_id and status = 'GRANTED';
  update public.notification_deliveries d
     set state = 'EXPIRED'
    from public.user_activity_events e
   where d.event_id = e.id
     and e.entity_type = 'AGREEMENT'
     and e.entity_id = p_agreement_id
     and d.state in ('CREATED','QUEUED','FAILED_RETRYABLE');

  -- Keep the reason in its existing author-owned ordinary message domain.
  -- These rows are already covered by ownAgreementMessages export and sender
  -- closure redaction. The other party's activity payload must not retain a
  -- second plaintext copy outside that author scope.
  if not private.safety_pair_blocked(v_agr.requester_account_id,v_agr.worker_account_id)
     and not private.closure_account_restricted(v_agr.requester_account_id)
     and not private.closure_account_restricted(v_agr.worker_account_id) then
    if char_length(v_reason) <= 1973 then
      insert into public.agreement_messages(agreement_id,agreement_version,sender_account_id,body)
      values(v_agr.id,v_agr.current_version,uid,'Otkazujem Dogovor. Razlog: '||v_reason);
    else
      -- PostgreSQL character slices preserve complete Unicode code points.
      -- At most three numbered messages preserve all 4,000 accepted characters.
      -- The first canonical prefix remains readable by the existing cancellation
      -- projection; subsequent parts are read in the existing conversation.
      v_parts := (char_length(v_reason)+v_chunk_chars-1)/v_chunk_chars;
      -- One random UUID prefix orders the bounded parts in the existing
      -- (created_at,id) reader while retaining the true shared statement time.
      v_message_prefix := left(gen_random_uuid()::text,35);
      for v_part in 1..v_parts loop
        insert into public.agreement_messages(id,agreement_id,agreement_version,sender_account_id,body)
        values((v_message_prefix||v_part::text)::uuid,v_agr.id,v_agr.current_version,uid,
          case when v_part=1 then 'Otkazujem Dogovor. Razlog: '||format('[%s/%s] ',v_part,v_parts)
            else format('Razlog otkazivanja [%s/%s]: ',v_part,v_parts) end
          ||substr(v_reason,(v_part-1)*v_chunk_chars+1,v_chunk_chars));
      end loop;
    end if;
  end if;

  -- A single safe terminal event identifies who cancelled and when. Existing
  -- notification privacy guards still suppress delivery to a closing account.
  -- Persist it before the closed-search completion branch can return early.
  perform private.emit_event(
    case when uid=v_agr.requester_account_id then v_agr.worker_account_id else v_agr.requester_account_id end,
    case when uid=v_agr.requester_account_id then 'WORKER' else 'REQUESTER' end,
    'AGREEMENT_CANCELLED','AGREEMENT',v_agr.id,v_agr.current_version,
    'Saradnja je otkazana','Otvorite Dogovor da vidite trenutne informacije.',
    'agreement-cancelled:'||v_agr.id::text,'NORMAL',
    jsonb_build_object('cancelledByRole',case when uid=v_agr.requester_account_id then 'REQUESTER' else 'WORKER' end),null);

  if v_need.remaining_search_closed_at is not null then
    if private.sync_need_completion(v_need.id) then
      return;
    end if;
  end if;

  v_covered := public.fn_need_covered_slots(v_agr.need_id);

  if v_covered < v_need.required_slots
     and v_need.status in ('ACTIVE','SELECTION') then
    perform set_config('uskoci.need_lifecycle', 'CANCEL_AGREEMENT', true);
    update public.needs set status = 'SELECTION' where id = v_need.id;
    perform private.enqueue_dispatch(v_need.id, statement_timestamp());
  end if;
end;
$function$;

-- rpc_list_my_agreements_page(text,integer,timestamp with time zone,uuid) | md5=0f14c3a0a462096f5c3641fbd5629f43 | functiondef_md5=e662bb63950a17d5bb4bd7d39e987b70 | owner=postgres | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres} | security_definer=t | config={search_path=pg_catalog}
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
             and g.status = 'GRANTED'
             and private.safety_grant_valid(g.granted_by_account_id, g.granted_to_account_id, g.granted_at) and (g.expires_at is null or g.expires_at > statement_timestamp())),
        'theirPhone', case
          when a.status = 'CONFIRMED' and exists (
            select 1 from public.access_grants g
             where g.agreement_id = a.id and g.channel = 'PHONE' and g.granted_to_account_id = v_uid
               and g.status = 'GRANTED'
             and private.safety_grant_valid(g.granted_by_account_id, g.granted_to_account_id, g.granted_at) and (g.expires_at is null or g.expires_at > statement_timestamp())
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
          and statement_timestamp()<private.agreement_review_deadline_v1(a.id)
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

-- rpc_list_my_agreement_groups_page(jsonb,integer,jsonb) | md5=9149868e6241948f89d3f54f378e4946 | functiondef_md5=df1e3125b0905f0d70c36d79057be2fe | owner=postgres | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres} | security_definer=t | config={search_path=pg_catalog}
CREATE OR REPLACE FUNCTION public.rpc_list_my_agreement_groups_page(p_view jsonb, p_limit integer DEFAULT 20, p_cursor jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid:=auth.uid();
  v_now timestamptz:=statement_timestamp();
  v_view_at timestamptz;
  v_today date;
  v_week_end date;
  v_section text;
  v_role text;
  v_outcome text;
  v_confirmation boolean;
  v_words text[];
  v_before_at timestamptz;
  v_before_id uuid;
  v_before_role text;
  v_before_rank integer;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF private.closure_account_restricted(v_uid) THEN RAISE EXCEPTION 'ACCOUNT_CLOSING' USING errcode='42501'; END IF;
  IF p_limit IS NULL OR p_limit<1 OR p_limit>30 THEN RAISE EXCEPTION 'INVALID_PAGE' USING errcode='22023'; END IF;
  IF p_view IS NULL OR jsonb_typeof(p_view)<>'object'
    OR p_view-ARRAY['section','role','outcome','confirmationOnly','query']<>'{}'::jsonb
    OR NOT (p_view ?& ARRAY['section','role','outcome','confirmationOnly','query'])
    OR jsonb_typeof(p_view->'section')<>'string' OR jsonb_typeof(p_view->'role')<>'string' OR jsonb_typeof(p_view->'outcome')<>'string'
    OR p_view->>'section' NOT IN ('active','history') OR p_view->>'role' NOT IN ('all','narucilac','uskocer')
    OR p_view->>'outcome' NOT IN ('all','completed','cancelled')
    OR jsonb_typeof(p_view->'confirmationOnly')<>'boolean' OR jsonb_typeof(p_view->'query')<>'string'
    OR length(p_view->>'query')>480
    OR p_view->>'query'<>private.agreement_list_search_v1(p_view->>'query') THEN
    RAISE EXCEPTION 'INVALID_VIEW' USING errcode='22023';
  END IF;
  v_section:=p_view->>'section'; v_role:=p_view->>'role'; v_outcome:=p_view->>'outcome';
  v_confirmation:=(p_view->>'confirmationOnly')::boolean;
  IF (v_section='active' AND v_outcome<>'all') OR (v_section='history' AND v_confirmation) THEN
    RAISE EXCEPTION 'INVALID_VIEW' USING errcode='22023';
  END IF;
  v_words:=string_to_array(p_view->>'query',' ');
  v_view_at:=v_now;
  IF p_cursor IS NOT NULL THEN
    IF jsonb_typeof(p_cursor)<>'object'
      OR p_cursor-ARRAY['rank','at','id','role','viewAt','view']<>'{}'::jsonb
      OR NOT (p_cursor ?& ARRAY['rank','at','id','role','viewAt','view'])
      OR p_cursor->'view'<>p_view OR jsonb_typeof(p_cursor->'rank')<>'number'
      OR jsonb_typeof(p_cursor->'id')<>'string' OR jsonb_typeof(p_cursor->'role')<>'string'
      OR p_cursor->>'rank' !~ '^[0-6]$' OR p_cursor->>'role' NOT IN ('narucilac','uskocer')
      OR p_cursor->>'id' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      OR private.agreement_list_instant_v1(p_cursor->>'at') IS NULL
      OR private.agreement_list_instant_v1(p_cursor->>'viewAt') IS NULL THEN
      RAISE EXCEPTION 'INVALID_PAGE' USING errcode='22023';
    END IF;
    v_view_at:=private.agreement_list_instant_v1(p_cursor->>'viewAt');
    v_before_at:=private.agreement_list_instant_v1(p_cursor->>'at');
    v_before_id:=(p_cursor->>'id')::uuid; v_before_role:=p_cursor->>'role'; v_before_rank:=(p_cursor->>'rank')::integer;
    IF v_view_at>v_now OR (v_section='history' AND v_before_rank<>0) THEN
      RAISE EXCEPTION 'INVALID_PAGE' USING errcode='22023';
    END IF;
  END IF;
  -- View time freezes day ordering through this cursor walk. Authorization and
  -- review eligibility always use the current statement, never this client value.
  v_today:=(v_view_at AT TIME ZONE 'Europe/Belgrade')::date;
  v_week_end:=v_today+(7-extract(isodow FROM v_today)::integer);

  WITH owned AS MATERIALIZED (
    SELECT a.id,a.need_id,a.selected_response_id,a.current_version,a.status AS agreement_status,a.created_at,
      a.requester_account_id,a.worker_account_id,a.requester_profile_id,a.worker_profile_id,
      CASE WHEN a.requester_account_id=v_uid THEN 'narucilac' ELSE 'uskocer' END AS mine_role
    FROM public.agreements a
    WHERE a.requester_account_id=v_uid OR a.worker_account_id=v_uid
  ), facts AS MATERIALIZED (
    SELECT a.*,av.terms,n.title,n.approximate_area,n.approximate_city,n.required_slots,n.starts_at,
      rp.display_name AS requester_name,wp.display_name AS worker_name,
      coalesce(ae.state,a.agreement_status) AS state,ae.mode,ae.requester_deadline_at,ae.problem_opened_at,
      change.id AS change_id,change.proposed_by_account_id,change.created_at AS change_at,
      coalesce(a.agreement_status='COMPLETED' AND ae.state='COMPLETED'
        AND v_now<private.agreement_review_deadline_v1(a.id)
        AND NOT EXISTS(SELECT 1 FROM private.agreement_reviews rv WHERE rv.agreement_id=a.id AND rv.reviewer_account_id=v_uid),false) AS rating_due,
      coalesce(private.agreement_list_instant_v1(av.terms->>'proposed_start_at'),
        private.agreement_list_instant_v1(av.terms->>'declared_start_at')) AS start_at,
      CASE WHEN private.agreement_list_instant_v1(av.terms->>'proposed_start_at')<private.agreement_list_instant_v1(av.terms->>'proposed_end_at')
        THEN private.agreement_list_instant_v1(av.terms->>'proposed_end_at') END AS end_at
    FROM owned a
    JOIN public.agreement_versions av ON av.agreement_id=a.id AND av.version=a.current_version
    JOIN public.needs n ON n.id=a.need_id
    JOIN public.app_profiles rp ON rp.id=a.requester_profile_id
    JOIN public.app_profiles wp ON wp.id=a.worker_profile_id
    LEFT JOIN public.agreement_execution ae ON ae.agreement_id=a.id
    LEFT JOIN LATERAL (SELECT c.id,c.proposed_by_account_id,c.created_at FROM public.agreement_change_proposals c
      WHERE c.agreement_id=a.id AND c.status='PENDING' ORDER BY c.created_at DESC,c.id DESC LIMIT 1) change ON true
  ), classified AS MATERIALIZED (
    SELECT f.*,state IN ('CONFIRMED','AWAITING_REQUESTER') OR rating_due AS active,
      state='AWAITING_REQUESTER' AND mine_role='narucilac' AS confirmation,
      (change_id IS NOT NULL AND proposed_by_account_id<>v_uid)
        OR (change_id IS NULL AND state='AWAITING_REQUESTER' AND mine_role='narucilac') OR rating_due AS attention,
      CASE WHEN (change_id IS NOT NULL AND proposed_by_account_id<>v_uid)
        OR (change_id IS NULL AND state='AWAITING_REQUESTER' AND mine_role='narucilac') OR rating_due THEN 0
        WHEN start_at IS NULL THEN 6
        WHEN start_at<=v_view_at AND v_view_at<end_at THEN 2
        WHEN (start_at AT TIME ZONE 'Europe/Belgrade')::date<v_today THEN 1
        WHEN (start_at AT TIME ZONE 'Europe/Belgrade')::date=v_today THEN 2
        WHEN (start_at AT TIME ZONE 'Europe/Belgrade')::date=v_today+1 THEN 3
        WHEN (start_at AT TIME ZONE 'Europe/Belgrade')::date<=v_week_end THEN 4 ELSE 5 END AS rank
    FROM facts f
  ), groups AS MATERIALIZED (
    SELECT need_id,mine_role,max(created_at) AS latest_at,bool_or(active) AS active,
      bool_or(active AND attention) AS attention,bool_or(confirmation) AS confirmation,
      bool_or(state IN ('COMPLETED','CANCELLED')) AS has_terminal,
      bool_or(state='COMPLETED') AS completed,bool_or(state='CANCELLED') AS cancelled
    FROM classified GROUP BY need_id,mine_role
  ), eligible AS MATERIALIZED (
    SELECT g.*,CASE WHEN v_section='active' THEN choice.rank ELSE 0 END AS sort_rank,
      CASE WHEN v_section='history' THEN g.latest_at
        ELSE coalesce(choice.start_at,'9999-12-31T23:59:59.999999Z'::timestamptz) END AS sort_at
    FROM groups g
    LEFT JOIN LATERAL (SELECT c.rank,c.start_at FROM classified c
      WHERE c.need_id=g.need_id AND c.mine_role=g.mine_role AND c.active
      ORDER BY c.rank,c.start_at NULLS LAST,c.created_at DESC,c.id DESC LIMIT 1) choice ON true
    WHERE (v_section='active')=g.active AND (v_role='all' OR v_role=g.mine_role)
      AND (NOT v_confirmation OR g.confirmation)
      AND (v_outcome='all' OR (v_outcome='completed' AND g.completed) OR (v_outcome='cancelled' AND g.cancelled))
      AND (p_view->>'query'='' OR EXISTS (
        SELECT 1 FROM classified c WHERE c.need_id=g.need_id AND c.mine_role=g.mine_role
          AND (v_outcome='all' OR (v_outcome='completed' AND c.state='COMPLETED') OR (v_outcome='cancelled' AND c.state='CANCELLED'))
          AND NOT EXISTS (SELECT 1 FROM unnest(v_words) word WHERE NOT EXISTS (
            SELECT 1 FROM unnest(string_to_array(private.agreement_list_search_v1(concat_ws(' ',c.title,
              coalesce(nullif(CASE WHEN c.mine_role='narucilac' THEN c.worker_name ELSE c.requester_name END,''),'Druga strana'),
              CASE WHEN c.mode='REMOTE' THEN 'Na daljinu' ELSE concat_ws(', ',c.approximate_area,c.approximate_city) END)),' ')) token
            WHERE starts_with(token,word)))))
  ), picked AS MATERIALIZED (
    SELECT e.* FROM eligible e
    WHERE p_cursor IS NULL
      OR (v_section='active' AND (e.sort_rank,e.sort_at,e.need_id,e.mine_role)>(v_before_rank,v_before_at,v_before_id,v_before_role))
      OR (v_section='history' AND (e.sort_at<v_before_at OR (e.sort_at=v_before_at AND (e.need_id,e.mine_role)>(v_before_id,v_before_role))))
    ORDER BY e.sort_rank,CASE WHEN v_section='active' THEN e.sort_at END,
      CASE WHEN v_section='history' THEN e.sort_at END DESC,e.need_id,e.mine_role LIMIT p_limit+1
  ), page AS MATERIALIZED (
    SELECT p.* FROM picked p ORDER BY p.sort_rank,CASE WHEN v_section='active' THEN p.sort_at END,
      CASE WHEN v_section='history' THEN p.sort_at END DESC,p.need_id,p.mine_role LIMIT p_limit
  ), payloads AS (
    SELECT p.*,jsonb_build_object('needId',p.need_id,'role',p.mine_role,'rank',p.sort_rank,
      'sortAt',to_char(p.sort_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'items',(SELECT jsonb_agg(jsonb_build_object(
        'id',c.id,'needId',c.need_id,'applicationId',c.selected_response_id,'sortAt',c.created_at,'createdAt',c.created_at,
        'currentVersion',c.current_version,'status',c.state,'agreementStatus',c.agreement_status,
        'title',c.title,'approximateArea',c.approximate_area,'approximateCity',c.approximate_city,
        'requiredSlots',c.required_slots,'startsAt',c.starts_at,'terms',c.terms,
        'requesterAccountId',c.requester_account_id,'workerAccountId',c.worker_account_id,
        'requesterProfileId',c.requester_profile_id,'workerProfileId',c.worker_profile_id,
        'requesterName',c.requester_name,'workerName',c.worker_name,
        'executionMode',c.mode,'requesterDeadlineAt',c.requester_deadline_at,'problemOpened',c.problem_opened_at IS NOT NULL,
        'ratingDue',c.rating_due,'pendingChange',CASE WHEN c.change_id IS NULL THEN NULL ELSE jsonb_build_object(
          'id',c.change_id,'proposedByMe',c.proposed_by_account_id=v_uid,'createdAt',c.change_at) END
      ) ORDER BY c.created_at DESC,c.id DESC) FROM classified c WHERE c.need_id=p.need_id AND c.mine_role=p.mine_role)) AS payload
    FROM page p
  )
  SELECT jsonb_build_object('view',p_view,'viewAt',v_view_at,'asOf',v_now,
    'groups',coalesce((SELECT jsonb_agg(payload ORDER BY sort_rank,CASE WHEN v_section='active' THEN sort_at END,
      CASE WHEN v_section='history' THEN sort_at END DESC,need_id,mine_role) FROM payloads),'[]'::jsonb),
    'hasMore',(SELECT count(*)>p_limit FROM picked),
    'counts',CASE WHEN p_cursor IS NULL THEN jsonb_build_object(
      'matching',(SELECT count(*) FROM eligible),'attention',(SELECT count(*) FROM eligible WHERE active AND attention),
      'confirmation',(SELECT count(*) FROM eligible WHERE confirmation),
      'active',(SELECT count(*) FROM groups WHERE active AND (v_role='all' OR mine_role=v_role)),
      'activeAttention',(SELECT count(*) FROM groups WHERE active AND attention AND (v_role='all' OR mine_role=v_role)),
      'history',(SELECT count(*) FROM groups WHERE NOT active AND (v_role='all' OR mine_role=v_role)),
      'hasAny',EXISTS(SELECT 1 FROM groups),'hasBothRoles',(SELECT count(DISTINCT mine_role)=2 FROM groups),
      'historyInActive',EXISTS(SELECT 1 FROM groups WHERE active AND has_terminal AND (v_role='all' OR mine_role=v_role))) END
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

COMMIT;
