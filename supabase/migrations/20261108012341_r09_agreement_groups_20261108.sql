-- R09/S08: paginate complete, account-owned task groups before building card JSON.
-- Additive reader only. No Agreement, review, price, location grant or lifecycle writer changes.
BEGIN;
DO $preflight$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)'))
      IS DISTINCT FROM '0f14c3a0a462096f5c3641fbd5629f43'
    OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('private.agreement_review_deadline_v1(uuid)'))
      IS DISTINCT FROM 'a86bf830d7e536e75d1a6c680e4d2876' THEN
    RAISE EXCEPTION 'AGREEMENT_GROUPS_PREIMAGE_MISMATCH';
  END IF;
  IF to_regprocedure('public.rpc_list_my_agreement_groups_page(jsonb,integer,jsonb)') IS NOT NULL
    OR to_regprocedure('private.agreement_list_instant_v1(text)') IS NOT NULL
    OR to_regprocedure('private.agreement_list_search_v1(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'AGREEMENT_GROUPS_ALREADY_EXISTS';
  END IF;
END;
$preflight$;

-- Same accepted RFC3339/microsecond boundary as calendarInstant. Bad historical
-- values remain unknown; PostgreSQL must not normalize 24:00 or an invalid date.
CREATE FUNCTION private.agreement_list_instant_v1(p_value text)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=pg_catalog
AS $function$
BEGIN
  IF length(p_value)>32 OR p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-](0[0-9]|1[0-5]):[0-5][0-9])$' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::timestamptz;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN NULL;
END;
$function$;

-- Same searchable surface and Serbian normalization as agreementSearch.ts.
-- This helper never receives private addresses, messages, phone numbers or IDs.
CREATE FUNCTION private.agreement_list_search_v1(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog
AS $function$
  SELECT btrim(regexp_replace(replace(regexp_replace(lower(normalize(
    translate(replace(replace(replace(lower(coalesce(p_value,'')),'љ','lj'),'њ','nj'),'џ','dž'),
      'абвгдђежзијклмнопрстћуфхцчш','abvgdđežzijklmnoprstćufhcčš'), NFKD)),
    U&'[\0300-\036f]','','g'),'đ','d'),'[^a-z0-9]+',' ','g'));
$function$;

CREATE FUNCTION public.rpc_list_my_agreement_groups_page(p_view jsonb, p_limit integer DEFAULT 20, p_cursor jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
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

REVOKE ALL ON FUNCTION private.agreement_list_instant_v1(text),private.agreement_list_search_v1(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_list_my_agreement_groups_page(jsonb,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_list_my_agreement_groups_page(jsonb,integer,jsonb) TO authenticated,service_role;
COMMIT;
