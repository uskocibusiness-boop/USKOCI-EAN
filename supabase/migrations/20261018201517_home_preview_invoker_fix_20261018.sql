-- Bounded Home preview using the existing own-profile RLS/identity binding.
-- Never grant access to needs.requester_account_id or change SECURITY INVOKER.
set local lock_timeout='5s';
set local statement_timeout='30s';
do $fix$
declare v_oid oid:='public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamp with time zone,uuid)'::regprocedure; b pg_proc%rowtype; a pg_proc%rowtype; c text;
begin
 select * into strict b from pg_proc where oid=v_oid;
 if md5(b.prosrc)<>'602113d52d64c775893752ff74bfc324' or b.prosecdef
    or b.proacl::text<>'{postgres=X/postgres,authenticated=X/postgres}' or b.proconfig::text<>'{search_path=pg_catalog}'
    or pg_get_userbyid(b.proowner)<>'postgres' then raise exception 'HOME_INVOKER_FIX_PREIMAGE_DRIFT'; end if;
 c:=private.closure_source_digest_v5();
 execute 'CREATE OR REPLACE FUNCTION public.rpc_list_open_tasks_v3(p_bbox jsonb DEFAULT NULL::jsonb, p_filters jsonb DEFAULT ''{}''::jsonb, p_limit integer DEFAULT 50, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''pg_catalog''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_filters jsonb := coalesce(p_filters, ''{}''::jsonb);
  v_west numeric; v_south numeric; v_east numeric; v_north numeric;
  v_env extensions.geography;
  v_category text; v_price_mode text; v_urgent_only boolean := false; v_remote text := ''INCLUDE'';
  v_starts_from timestamptz; v_starts_to timestamptz;
  v_items jsonb;
  v_need_id uuid;
  v_home_preview boolean := false;
begin
  if v_uid is null then raise exception ''AUTH_REQUIRED'' using errcode = ''28000''; end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 or (p_before_at is null) <> (p_before_id is null) then
    raise exception ''INVALID_PAGE'' using errcode = ''22023'';
  end if;

  if jsonb_typeof(v_filters) is distinct from ''object''
     or v_filters - array[''category'',''priceMode'',''urgentOnly'',''remote'',''startsFrom'',''startsTo'',''needId'',''homePreview''] <> ''{}''::jsonb then
    raise exception ''INVALID_FILTER'' using errcode = ''22023'';
  end if;
  -- Home is a bounded public preview, not matching or a marketplace count.
  -- Reject mixed filters/cursors so ownership and eligibility are applied before the limit.
  if v_filters ? ''homePreview'' then
    if v_filters->''homePreview'' is distinct from ''true''::jsonb
       or v_filters - ''homePreview'' <> ''{}''::jsonb or p_limit <> 3
       or p_bbox is not null or p_before_at is not null or p_before_id is not null then
      raise exception ''INVALID_FILTER'' using errcode = ''22023'';
    end if;
    v_home_preview := true;
  end if;
  -- Exact public landing is a separate mode, not another arbitrary search combination.
  -- Retain the existing page validation above, including paired cursor validation.
  if v_filters ? ''needId'' then
    if jsonb_typeof(v_filters->''needId'') is distinct from ''string''
       or (v_filters->>''needId'') !~* ''^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$''
       or v_filters - ''needId'' <> ''{}''::jsonb
       or p_bbox is not null or p_before_at is not null or p_before_id is not null then
      raise exception ''INVALID_FILTER'' using errcode = ''22023'';
    end if;
    v_need_id := (v_filters->>''needId'')::uuid;
  end if;
  if v_filters ? ''category'' then
    if jsonb_typeof(v_filters->''category'') <> ''string'' or btrim(v_filters->>''category'') = ''''
       or char_length(v_filters->>''category'') > 120 then raise exception ''INVALID_FILTER'' using errcode = ''22023''; end if;
    v_category := btrim(v_filters->>''category'');
  end if;
  if v_filters ? ''priceMode'' then
    if jsonb_typeof(v_filters->''priceMode'') <> ''string'' or v_filters->>''priceMode'' not in (''MY_PRICE'',''OFFERS'') then
      raise exception ''INVALID_FILTER'' using errcode = ''22023''; end if;
    v_price_mode := v_filters->>''priceMode'';
  end if;
  if v_filters ? ''urgentOnly'' then
    if jsonb_typeof(v_filters->''urgentOnly'') <> ''boolean'' then raise exception ''INVALID_FILTER'' using errcode = ''22023''; end if;
    v_urgent_only := (v_filters->>''urgentOnly'')::boolean;
  end if;
  if v_filters ? ''remote'' then
    if jsonb_typeof(v_filters->''remote'') <> ''string'' or v_filters->>''remote'' not in (''INCLUDE'',''ONLY'',''EXCLUDE'')
       or (p_bbox is not null and v_filters->>''remote'' <> ''EXCLUDE'') then
      raise exception ''INVALID_FILTER'' using errcode = ''22023''; end if;
    v_remote := v_filters->>''remote'';
  end if;
  begin
    if v_filters ? ''startsFrom'' then
      if jsonb_typeof(v_filters->''startsFrom'') <> ''string'' then raise exception ''INVALID_FILTER'' using errcode = ''22023''; end if;
      v_starts_from := (v_filters->>''startsFrom'')::timestamptz;
    end if;
    if v_filters ? ''startsTo'' then
      if jsonb_typeof(v_filters->''startsTo'') <> ''string'' then raise exception ''INVALID_FILTER'' using errcode = ''22023''; end if;
      v_starts_to := (v_filters->>''startsTo'')::timestamptz;
    end if;
  exception when data_exception then
    raise exception ''INVALID_FILTER'' using errcode = ''22023'';
  end;

  if p_bbox is not null then
    if jsonb_typeof(p_bbox) <> ''object''
       or p_bbox - array[''west'',''south'',''east'',''north''] <> ''{}''::jsonb
       or not (p_bbox ?& array[''west'',''south'',''east'',''north''])
       or jsonb_typeof(p_bbox->''west'') <> ''number'' or jsonb_typeof(p_bbox->''south'') <> ''number''
       or jsonb_typeof(p_bbox->''east'') <> ''number'' or jsonb_typeof(p_bbox->''north'') <> ''number'' then
      raise exception ''INVALID_BBOX'' using errcode = ''22023'';
    end if;
    v_west := (p_bbox->>''west'')::numeric; v_south := (p_bbox->>''south'')::numeric;
    v_east := (p_bbox->>''east'')::numeric; v_north := (p_bbox->>''north'')::numeric;
    if v_west < -180 or v_east > 180 or v_south < -90 or v_north > 90
       or v_west >= v_east or v_south >= v_north
       or v_north - v_south > 3 or v_east - v_west > 5 then
      raise exception ''INVALID_BBOX'' using errcode = ''22023'';
    end if;
    -- The index filters on the coarse point, which lies within one hundredth of a degree of the
    -- finer one; the margin keeps a task whose fine pin is inside the viewport from being cut off at
    -- its edge. The numeric comparison below is the exact test.
    v_env := extensions.ST_MakeEnvelope(
      greatest(v_west - 0.01, -180)::double precision, greatest(v_south - 0.01, -90)::double precision,
      least(v_east + 0.01, 180)::double precision, least(v_north + 0.01, 90)::double precision, 4326)::extensions.geography;
  end if;

  select coalesce(jsonb_agg(q.item order by q.published_at desc, q.id desc), ''[]''::jsonb) into v_items
  from (
    select n.published_at, n.id, jsonb_build_object(
      ''id'', n.id, ''sortAt'', n.published_at, ''publishedAt'', n.published_at, ''revision'', n.revision,
      ''title'', n.title, ''category'', n.category, ''status'', n.status, ''urgent'', n.urgent,
      ''scheduleKind'', n.schedule_kind, ''startsAt'', n.starts_at, ''endsAt'', n.ends_at,
      ''executionLocationMode'', n.execution_location_mode,
      ''taskCountryCode'', n.task_country_code, ''taskTimezone'', n.task_timezone,
      ''verifiedIdentityRequired'', n.verified_identity_required,
      ''approximateCity'', nullif(btrim(n.approximate_city), ''''), ''approximateArea'', nullif(btrim(n.approximate_area), ''''),
      ''pin'', case when n.approximate_lat is null or n.approximate_lng is null then null
        else jsonb_build_object(''lat'', n.approximate_lat, ''lng'', n.approximate_lng, ''precision'', ''COARSE_1KM'') end,
      ''requiredSlots'', n.required_slots, ''coveredSlots'', n.covered_now,
      ''requiredSkills'', to_jsonb(n.required_skills), ''requiredTools'', to_jsonb(n.required_tools),
      ''requiredVehicles'', to_jsonb(n.required_vehicles), ''requiredLicenses'', to_jsonb(n.required_licenses),
      ''minimumExperienceYears'', n.minimum_experience_years,
      ''priceMode'', n.mode, ''requesterPriceRsd'', n.requester_price_rsd, ''priceBasis'', n.price_basis,
      ''requesterProfileId'', n.requester_profile_id,
      ''responseDeadline'', n.response_deadline,
      ''acceptsApplications'', n.required_slots > n.covered_now
        and (n.response_deadline is null or n.response_deadline > statement_timestamp()),
      ''publicTopology'', (select g.public_topology from public.need_geography g where g.need_id = n.id),
      ''criticalConditions'', (select to_jsonb(d.critical_conditions) from public.need_requirement_details d where d.need_id = n.id)
    ) as item
    from (
      -- Parameter-only gates select the ordinary viewport/list branch or exact-ID branch.
      -- Ordinary predicates and page limits are unchanged; exact landing uses the existing PK.
      (select m.id, m.requester_profile_id, m.status, m.title, m.description, m.category, m.approximate_city, m.approximate_area, m.approximate_lat, m.approximate_lng, m.schedule_kind, m.starts_at, m.ends_at, m.required_slots, m.mode, m.requester_price_rsd, m.required_skills, m.required_tools, m.required_vehicles, m.verified_identity_required, m.urgent, m.public_photo_paths, m.revision, m.published_at, m.created_at, m.updated_at, m.response_deadline, m.urgent_activated_at, m.urgent_expires_at, m.urgent_policy_version, m.minimum_experience_years, m.execution_location_mode, m.approx_geog, m.required_licenses, m.remaining_search_closed_at, m.task_country_code, m.task_timezone, m.price_basis, public.covered_slots(jsonb_populate_record(null::public.needs, jsonb_build_object(''id'', m.id))) as covered_now from public.needs m
        where v_need_id is null and p_bbox is not null
          and m.status in (''PUBLISHED'',''SELECTION'')
          and m.published_at is not null
          and m.remaining_search_closed_at is null
          and m.approx_geog OPERATOR(extensions.&&) v_env
          and m.approximate_lat between v_south - 0.01 and v_north + 0.01
          and m.approximate_lng between v_west - 0.01 and v_east + 0.01
        and (v_category is null or m.category = v_category)
        and (v_price_mode is null or m.mode = v_price_mode)
        and (not v_urgent_only or m.urgent)
        and (v_starts_from is null or m.starts_at >= v_starts_from)
        and (v_starts_to is null or m.starts_at <= v_starts_to)
        and (p_before_at is null or (m.published_at, m.id) < (p_before_at, p_before_id))
      order by m.published_at desc, m.id desc
      limit p_limit + 1)
      union all
      (select m.id, m.requester_profile_id, m.status, m.title, m.description, m.category, m.approximate_city, m.approximate_area, m.approximate_lat, m.approximate_lng, m.schedule_kind, m.starts_at, m.ends_at, m.required_slots, m.mode, m.requester_price_rsd, m.required_skills, m.required_tools, m.required_vehicles, m.verified_identity_required, m.urgent, m.public_photo_paths, m.revision, m.published_at, m.created_at, m.updated_at, m.response_deadline, m.urgent_activated_at, m.urgent_expires_at, m.urgent_policy_version, m.minimum_experience_years, m.execution_location_mode, m.approx_geog, m.required_licenses, m.remaining_search_closed_at, m.task_country_code, m.task_timezone, m.price_basis, public.covered_slots(jsonb_populate_record(null::public.needs, jsonb_build_object(''id'', m.id))) as covered_now from public.needs m
        where v_need_id is null and p_bbox is null
          and m.status in (''PUBLISHED'',''SELECTION'')
          and m.published_at is not null
          and m.remaining_search_closed_at is null
          and (not v_home_preview or (
            not exists (select 1 from public.app_profiles own_profile
              where own_profile.id = m.requester_profile_id and own_profile.account_id = v_uid)
            and m.required_slots > public.covered_slots(jsonb_populate_record(null::public.needs, jsonb_build_object(''id'', m.id)))
            and (m.response_deadline is null or m.response_deadline > statement_timestamp())
          ))
          and (v_remote = ''INCLUDE''
            or (v_remote = ''ONLY'' and m.execution_location_mode = ''REMOTE'')
            or (v_remote = ''EXCLUDE'' and m.execution_location_mode <> ''REMOTE''))
        and (v_category is null or m.category = v_category)
        and (v_price_mode is null or m.mode = v_price_mode)
        and (not v_urgent_only or m.urgent)
        and (v_starts_from is null or m.starts_at >= v_starts_from)
        and (v_starts_to is null or m.starts_at <= v_starts_to)
        and (p_before_at is null or (m.published_at, m.id) < (p_before_at, p_before_id))
      order by m.published_at desc, m.id desc
      limit p_limit + 1)
      union all
      -- A primary-key predicate bounds exact landing to one candidate before the shared
      -- public JSON projection. Ordinary list/map branches are disabled in this mode.
      (select m.id, m.requester_profile_id, m.status, m.title, m.description, m.category, m.approximate_city, m.approximate_area, m.approximate_lat, m.approximate_lng, m.schedule_kind, m.starts_at, m.ends_at, m.required_slots, m.mode, m.requester_price_rsd, m.required_skills, m.required_tools, m.required_vehicles, m.verified_identity_required, m.urgent, m.public_photo_paths, m.revision, m.published_at, m.created_at, m.updated_at, m.response_deadline, m.urgent_activated_at, m.urgent_expires_at, m.urgent_policy_version, m.minimum_experience_years, m.execution_location_mode, m.approx_geog, m.required_licenses, m.remaining_search_closed_at, m.task_country_code, m.task_timezone, m.price_basis, public.covered_slots(jsonb_populate_record(null::public.needs, jsonb_build_object(''id'', m.id))) as covered_now from public.needs m
        where v_need_id is not null and m.id = v_need_id
          and m.status in (''PUBLISHED'',''SELECTION'')
          and m.published_at is not null
          and m.remaining_search_closed_at is null
        limit 1)
    ) n
    order by n.published_at desc, n.id desc
    limit p_limit + 1
  ) q;

  return jsonb_build_object(
    ''items'', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    ''hasMore'', jsonb_array_length(v_items) > p_limit,
    ''asOf'', statement_timestamp());
end
$function$
';
 select * into strict a from pg_proc where oid=v_oid;
 if md5(a.prosrc)<>'7c1d9a979585deae6c2bc2c1b9d597b1' or (to_jsonb(a)-'prosrc') is distinct from (to_jsonb(b)-'prosrc')
    then raise exception 'HOME_INVOKER_FIX_POSTIMAGE_DRIFT'; end if;
 if c is null or private.closure_source_digest_v5() is distinct from c then raise exception 'HOME_INVOKER_FIX_CLOSURE_DRIFT'; end if;
end $fix$;
