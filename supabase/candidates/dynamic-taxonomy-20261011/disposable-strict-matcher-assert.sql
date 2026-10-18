\set ON_ERROR_STOP on
-- DISPOSABLE POSTGRES ONLY. Extends the existing strict-mode fixture.
-- This is a synthetic matcher proof, NOT authenticated publication, dispatch or push.
-- Relevant fields mirror the observed 2026-10-18 current 3D Need and worker:
-- REMOTE / REMOTE_ANYTIME, no start/deadline/required skills, ACTIVE, 3D capability,
-- no exclusions, available_now=false, radius=15. All IDs below are synthetic.
-- The two accounts have the actual QA/owner lineage classes and different IDs.
-- Captured function definitions below are from canonical DEV, without body edits.
BEGIN;
ALTER TABLE public.needs
 ADD COLUMN requester_account_id uuid,
 ADD COLUMN category text,
 ADD COLUMN required_skills text[] NOT NULL DEFAULT '{}',
 ADD COLUMN approximate_lat numeric,
 ADD COLUMN approximate_lng numeric,
 ADD COLUMN approximate_city text,
 ADD COLUMN task_country_code text,
 ADD COLUMN verified_identity_required boolean NOT NULL DEFAULT false,
 ADD COLUMN schedule_kind text,
 ADD COLUMN starts_at timestamptz,
 ADD COLUMN ends_at timestamptz,
 ADD COLUMN published_at timestamptz,
 ADD COLUMN task_timezone text;
CREATE TABLE public.app_profiles(
 id uuid PRIMARY KEY,account_id uuid NOT NULL,kind text NOT NULL,
 profile_status text NOT NULL,skills text[] NOT NULL,exclusions text[] NOT NULL,
 available_now boolean NOT NULL,radius_km integer,city text,operating_country_code text);
CREATE TABLE public.worker_match_preferences(
 worker_profile_id uuid PRIMARY KEY,approximate_lat numeric,approximate_lng numeric,timezone text);
CREATE TABLE private.account_lineage_v5(account_id uuid PRIMARY KEY,lineage text NOT NULL);
INSERT INTO private.account_lineage_v5 VALUES
 ('a1000000-0000-4000-8000-000000000001','OWNER_BUSINESS'),
 ('b1000000-0000-4000-8000-000000000001','DEV_ACCEPTANCE_QA'),
 ('c1000000-0000-4000-8000-000000000001','UNCLASSIFIED');

-- Captured DEV definition MD5: 8fb2092aa40b93b733f5e7181c355c55
CREATE OR REPLACE FUNCTION private.account_lineage(p_account_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  select coalesce((select l.lineage from private.account_lineage_v5 l where l.account_id = p_account_id), 'UNCLASSIFIED');
$function$;

-- Captured DEV definition MD5: 109bc82d7b7b466218fb6823493fda4e
CREATE OR REPLACE FUNCTION private.account_visibility_world(p_account_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  select case when coalesce(private.account_lineage(p_account_id), 'UNCLASSIFIED')
                in ('DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR',
                    -- PKG-029e, owner decision 2026-09-21 ("dok testiramo"): the owner's own accounts share the
                    -- test world while testing. Take these two out again before real users arrive.
                    'OWNER_PERSONAL','OWNER_BUSINESS') then 'TEST' else 'REAL' end;
$function$;

-- Captured DEV definition MD5: 2d6beb6df93bc8eb6ae2622de8319ac5
CREATE OR REPLACE FUNCTION private.accounts_same_world(p_a uuid, p_b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  select private.account_visibility_world(p_a) = private.account_visibility_world(p_b);
$function$;

-- Captured DEV definition MD5: e5c312154cab99884d794656bb9b2550
CREATE OR REPLACE FUNCTION private.lower_arr(a text[])
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select coalesce(array(select lower(btrim(x)) from unnest(coalesce(a,'{}'::text[])) x where x is not null), '{}'::text[]);
$function$;

-- Captured DEV definition MD5: aaf84a1425262215800ae7cfa2d9ee13
CREATE OR REPLACE FUNCTION private.effective_radius_km(base_radius integer)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$ select greatest(1, least(1000, coalesce(base_radius, 15)))::numeric; $function$;

-- Captured DEV definition MD5: 5a5848cbf4f91f2f216290e00cf89f1e
CREATE OR REPLACE FUNCTION private.haversine_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else round((6371.0 * 2 * asin(least(1, sqrt(
        power(sin(radians((lat2-lat1)::double precision)/2),2) +
        cos(radians(lat1::double precision))*cos(radians(lat2::double precision)) *
        power(sin(radians((lng2-lng1)::double precision)/2),2)
      ))))::numeric, 2)
  end;
$function$;

-- Captured DEV definition MD5: 48435c7dd78a2ae47bf18376a63d605c
CREATE OR REPLACE FUNCTION private.identity_admitted(p_account uuid)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select false;
$function$;

-- Captured DEV definition MD5: f3dacd6f2b5d553d1d42f7422ae6d438
CREATE OR REPLACE FUNCTION private.taxonomy_requirement_tier_inherited_v1(p_req uuid, p_worker_account_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
 IF p_req IS NULL OR p_worker_account_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM private.work_taxonomy_categories c
  WHERE c.id=p_req AND c.state<>'RETIRED'
 ) THEN RETURN 'NO_SAFE_MATCH'; END IF;
 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  WHERE w.worker_account_id=p_worker_account_id
    AND w.category_id=p_req AND w.excluded
 ) THEN RETURN 'NO_SAFE_MATCH'; END IF;
 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  WHERE w.worker_account_id=p_worker_account_id
    AND w.category_id=p_req AND NOT w.excluded
 ) THEN RETURN 'EXACT'; END IF;
 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  JOIN private.work_taxonomy_relations r
    ON r.source_id=w.category_id AND r.target_id=p_req
  WHERE w.worker_account_id=p_worker_account_id AND NOT w.excluded
    AND r.relation='EQUIVALENT_VERIFIED' AND r.verification='VERIFIED'
    AND r.evidence_ref IS NOT NULL AND left(r.evidence_ref,3) <> 'AI_'
 ) THEN RETURN 'EQUIVALENT'; END IF;
 IF EXISTS (
  SELECT 1 FROM private.work_taxonomy_worker_capabilities w
  JOIN private.work_taxonomy_relations r
    ON r.source_id=w.category_id AND r.target_id=p_req
  JOIN private.work_taxonomy_related_acceptances a
    ON a.worker_account_id=w.worker_account_id
      AND a.source_category_id=w.category_id AND a.target_category_id=p_req
      AND a.relationship_version=r.version
  WHERE w.worker_account_id=p_worker_account_id AND NOT w.excluded
    AND w.allow_related_offers AND r.relation='CAPABILITY_CONFIRMED'
    AND r.verification='VERIFIED' AND r.evidence_ref IS NOT NULL AND left(r.evidence_ref,3) <> 'AI_'
 ) THEN RETURN 'RELATED_CONFIRMED'; END IF;

 IF EXISTS (
  WITH RECURSIVE coverage(ancestor_id,visited,depth) AS (
    SELECT e.parent_category_id,
           ARRAY[e.child_category_id,e.parent_category_id]::uuid[],1
    FROM private.work_taxonomy_standard_coverage e
    JOIN private.work_taxonomy_categories c
      ON c.id=e.child_category_id AND c.parent_id=e.parent_category_id
         AND c.state='ESTABLISHED'
    JOIN private.work_taxonomy_categories p
      ON p.id=e.parent_category_id AND p.state='ESTABLISHED'
    WHERE e.child_category_id=p_req
      -- AI-created branch ancestry is classification, not a worker competence proof.
      AND left(e.evidence_ref,3) <> 'AI_'
      AND EXISTS (
      SELECT 1 FROM private.work_taxonomy_category_modes cm
      JOIN private.work_taxonomy_category_modes pm
        ON pm.category_id=p.id AND pm.execution_scope=cm.execution_scope
      WHERE cm.category_id=c.id
    )
    UNION ALL
    SELECT e.parent_category_id,
           coverage.visited || e.parent_category_id,coverage.depth+1
    FROM coverage
    JOIN private.work_taxonomy_standard_coverage e
      ON e.child_category_id=coverage.ancestor_id
    JOIN private.work_taxonomy_categories c
      ON c.id=e.child_category_id AND c.parent_id=e.parent_category_id
        AND c.state='ESTABLISHED'
    JOIN private.work_taxonomy_categories p
      ON p.id=e.parent_category_id AND p.state='ESTABLISHED'
    WHERE coverage.depth<32
      AND left(e.evidence_ref,3) <> 'AI_'
      AND NOT e.parent_category_id=ANY(coverage.visited)
      AND EXISTS (
        SELECT 1 FROM private.work_taxonomy_category_modes cm
        JOIN private.work_taxonomy_category_modes pm
          ON pm.category_id=p.id AND pm.execution_scope=cm.execution_scope
        WHERE cm.category_id=c.id
      )
  )
  SELECT 1 FROM coverage path
  JOIN private.work_taxonomy_worker_capabilities w
    ON w.category_id=path.ancestor_id
    AND w.worker_account_id=p_worker_account_id AND NOT w.excluded
  WHERE NOT EXISTS (
    SELECT 1 FROM private.work_taxonomy_worker_capabilities x
    WHERE x.worker_account_id=p_worker_account_id
      AND x.excluded AND x.category_id=ANY(path.visited)
  )
 ) THEN RETURN 'INHERITED_STANDARD'; END IF;
 RETURN 'NO_SAFE_MATCH';
END $function$;

-- Captured DEV definition MD5: e3007d8a8dc5fdb25d6de97457ac5594
CREATE OR REPLACE FUNCTION private.taxonomy_scope_eligible_v1(p_need_id uuid, p_worker_account_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE v_category uuid;v_revision integer;v_mode text;v_scope text;
BEGIN
 IF p_need_id IS NULL OR p_worker_account_id IS NULL THEN RETURN false; END IF;
 SELECT n.category_id,n.revision,n.execution_location_mode
  INTO v_category,v_revision,v_mode FROM public.needs n WHERE n.id=p_need_id;
 IF NOT FOUND OR v_category IS NULL OR v_revision IS NULL THEN RETURN false; END IF;
 v_scope:=CASE v_mode WHEN 'REMOTE' THEN 'REMOTE'
   WHEN 'STATIONARY' THEN 'ON_SITE'
   WHEN 'POINT_TO_POINT' THEN 'ON_SITE'
   WHEN 'MULTI_STOP' THEN 'ON_SITE'
   WHEN 'AREA_BASED' THEN 'ON_SITE'
   ELSE NULL END;
 IF v_scope IS NULL THEN RETURN false; END IF;
 -- Only requester's EXACT signed/current need revision may participate.
 IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_need_snapshots s
  WHERE s.need_id=p_need_id AND s.need_revision=v_revision
    AND s.category_id=v_category AND s.reviewed_by_requester
    AND s.classification_state='CONFIRMED') THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
    JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
   WHERE c.id=v_category AND c.state='ESTABLISHED' AND cm.execution_scope=v_scope)
 THEN RETURN false; END IF;
 -- Confirmed worker GLOBAL execution choice is necessary, never sufficient.
 IF NOT EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
   WHERE choice.worker_account_id=p_worker_account_id
     AND v_scope=ANY(choice.modes) AND choice.confirmed_at IS NOT NULL)
 THEN RETURN false; END IF;
 -- Require saved human consent for this precise worker+service+scope.
 IF NOT EXISTS(SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m
  JOIN private.work_taxonomy_worker_capabilities cap
    ON cap.worker_account_id=m.worker_account_id
   AND cap.category_id=m.category_id AND NOT cap.excluded
  JOIN private.worker_ai_saves saved
    ON saved.account_id=m.worker_account_id
   AND saved.review_id=m.source_review_id
   AND saved.client_request_id=m.source_request_key
  WHERE m.worker_account_id=p_worker_account_id AND m.category_id=v_category
    AND m.execution_scope=v_scope AND m.active)
 THEN RETURN false; END IF;
 RETURN true;
END $function$;

-- Captured DEV definition MD5: 08184eff09085e53d8722450873a67d4
CREATE OR REPLACE FUNCTION private.worker_need_time_tier_v1(nid uuid, pid uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
-- MATCH-V1 (owner 2026-10-07). The time part of "Odgovara mi" and its order inside the existing waves:
--   1 = first: "Mogu odmah" for a task "danas" or one whose own time has begun ("odmah"); everyone for "bilo kad";
--   2 = by the stored schedule (weekly rules and windows, in the worker's zone, Europe/Belgrade by default);
--   null = the time does not fit (no delivery, not "Za mene"). The order is a priority inside the waves, never exclusivity.
-- needs.schedule_kind has no separate ASAP kind: "odmah" is a task "danas" (TODAY_FLEXIBLE) or a stored window that has
-- already begun. TOMORROW_FLEXIBLE, WEEK_FLEXIBLE and every future stored window keep the EX-06 coverage rule unchanged.
declare
  n public.needs; p public.app_profiles; tz text; wtz text; at_now timestamptz:=statement_timestamp();
  periods tstzmultirange; ws timestamptz; we timestamptz; anchor_day date; live boolean;
begin
  select * into n from public.needs where id=nid;
  if not found then return null; end if;
  select * into p from public.app_profiles where id=pid and kind='WORKER' and profile_status='ACTIVE';
  if not found then return null; end if;
  if n.ends_at is not null and n.ends_at<=at_now then return null; end if;
  -- Fully unbounded means no user-specified start or completion deadline.
  -- A *future start* is not "available now"; previously a non-null starts_at
  -- accidentally widened FLEXIBLE / REMOTE_ANYTIME into an unconditional tier 1.
  if n.schedule_kind in ('FLEXIBLE','REMOTE_ANYTIME')
     and n.starts_at is null and n.ends_at is null then
    return 1;
  end if;
  select timezone into tz from public.worker_match_preferences where worker_profile_id=pid;
  tz:=coalesce(tz,'Europe/Belgrade');
  if not private.availability_timezone_valid(tz) then return null; end if;
  -- FLEXIBLE_NOT_BEFORE_START: explicit earliest start is an eligibility gate,
  -- NOT a fabricated exact booking or automatic 'available now' admission.
  -- A user-supplied end is authoritative; start-only has no task expiration.
  if n.schedule_kind in ('FLEXIBLE','REMOTE_ANYTIME') and n.starts_at is not null then
    if not isfinite(n.starts_at) or
       (n.ends_at is not null and (not isfinite(n.ends_at) or n.ends_at<=n.starts_at)) then
      return null;
    end if;
    -- Current availability counts only *after* the start and before a deadline.
    if n.starts_at<=at_now then
      live:=coalesce(p.available_now,false)
        and not exists(select 1 from public.profile_availability_windows w where w.profile_id=pid
          and w.availability_state='UNAVAILABLE' and w.starts_at<=at_now and w.ends_at>at_now)
        and not exists(select 1 from private.worker_calendar_events c where c.worker_profile_id=pid
          and c.state='BLOCKING' and c.starts_at<=at_now and c.ends_at>at_now);
      if live then return 1; end if;
    end if;
    ws:=greatest(n.starts_at,at_now);
    -- The 30-day bound is a performance limit on worker-availability LOOKUP,
    -- NOT an implicit need completion deadline. Far-future-only capacity needs
    -- a subsequent re-evaluation before this can be used for live dispatch.
    we:=coalesce(n.ends_at,ws+interval '30 days');
    if we<=ws then return null; end if;
    if private.worker_available_periods(pid,ws,we,tz)<>'{}'::tstzmultirange then return 2; end if;
    return null;
  end if;
  -- START-ONLY FIXED_WINDOW: test availability at the declared start instant.
  -- A one-second probe is ONLY an interval representation for the calendar;
  -- it is not the proposed duration, job finish, or reserved shift.
  if n.schedule_kind='FIXED_WINDOW' and n.starts_at is not null and n.ends_at is null then
    if not isfinite(n.starts_at) or n.starts_at<=at_now then return null; end if;
    periods:=private.worker_available_periods(pid,n.starts_at,n.starts_at+interval '1 second',tz);
    if periods @> n.starts_at then return 2; end if;
    return null;
  end if;
  -- An end-only task is a completion deadline, not unlimited free time.
  -- Actual availability must intersect the remaining time until that deadline.
  if n.starts_at is null and n.ends_at is not null
     and n.schedule_kind in ('FLEXIBLE','REMOTE_ANYTIME','WEEK_FLEXIBLE') then
    if not isfinite(n.ends_at) or n.ends_at<=at_now then return null; end if;
    live:=coalesce(p.available_now,false)
      and not exists(select 1 from public.profile_availability_windows w where w.profile_id=pid
        and w.availability_state='UNAVAILABLE' and w.starts_at<=at_now and w.ends_at>at_now)
      and not exists(select 1 from private.worker_calendar_events c where c.worker_profile_id=pid
        and c.state='BLOCKING' and c.starts_at<=at_now and c.ends_at>at_now);
    if live then return 1; end if;
    if private.worker_available_periods(pid,at_now,n.ends_at,tz)<>'{}'::tstzmultirange then return 2; end if;
    return null;
  end if;
  -- "danas": the publication day in the task's zone (Europe/Belgrade when it has none), a stored bound narrows it.
  -- First "Mogu odmah", then a schedule with real available time left in that day.
  if n.schedule_kind='TODAY_FLEXIBLE' then
    if n.published_at is null and (n.starts_at is null or n.ends_at is null) then return null; end if;
    wtz:=case when n.task_timezone is not null and private.availability_timezone_valid(n.task_timezone)
      then n.task_timezone else 'Europe/Belgrade' end;
    anchor_day:=(coalesce(n.published_at,n.starts_at) at time zone wtz)::date;
    ws:=coalesce(n.starts_at,anchor_day::timestamp at time zone wtz);
    we:=coalesce(n.ends_at,(anchor_day+1)::timestamp at time zone wtz);
    if not isfinite(ws) or not isfinite(we) or ws>=we or we<=at_now then return null; end if;
    -- "Mogu odmah" counts only while nothing blocks this moment (an unavailable window or a Dogovor).
    -- TODAY_START_GATE: 'available now' never means available before a declared future start.
    live:=at_now>=ws and coalesce(p.available_now,false)
      and not exists(select 1 from public.profile_availability_windows w where w.profile_id=pid
        and w.availability_state='UNAVAILABLE' and w.starts_at<=at_now and w.ends_at>at_now)
      and not exists(select 1 from private.worker_calendar_events c where c.worker_profile_id=pid
        and c.state='BLOCKING' and c.starts_at<=at_now and c.ends_at>at_now);
    if live then return 1; end if;
    if private.worker_available_periods(pid,greatest(ws,at_now),we,tz)<>'{}'::tstzmultirange then return 2; end if;
    return null;
  end if;
  -- TOMORROW_END_ONLY_AVAILABLE: a deadline inside tomorrow does not imply
  -- availability now or an unbounded, missing beginning. Search only tomorrow
  -- from local midnight until the stated deadline, never beyond its named day.
  if n.schedule_kind='TOMORROW_FLEXIBLE'
     and n.starts_at is null and n.ends_at is not null then
    if n.published_at is null or not isfinite(n.published_at)
       or not isfinite(n.ends_at) then return null; end if;
    wtz:=case when n.task_timezone is not null and private.availability_timezone_valid(n.task_timezone)
      then n.task_timezone else 'Europe/Belgrade' end;
    anchor_day:=(n.published_at at time zone wtz)::date;
    ws:=(anchor_day+1)::timestamp at time zone wtz;
    we:=(anchor_day+2)::timestamp at time zone wtz;
    if n.ends_at<=ws or n.ends_at>we or n.ends_at<=at_now then return null; end if;
    if private.worker_available_periods(pid,greatest(ws,at_now),n.ends_at,tz)<>'{}'::tstzmultirange then
      return 2;
    end if;
    return null;
  end if;
  -- PARTIAL_PERIOD_START_AVAILABLE: an explicitly stated earliest start for
  -- tomorrow/this publication week is not a complete execution interval.
  -- Check availability only after that instant, within the named period;
  -- never invent the job finish or award a priority-1 'available now' match.
  if n.schedule_kind in ('TOMORROW_FLEXIBLE','WEEK_FLEXIBLE')
     and n.starts_at is not null and n.ends_at is null then
    if n.published_at is null or not isfinite(n.published_at)
       or not isfinite(n.starts_at) then return null; end if;
    wtz:=case when n.task_timezone is not null and private.availability_timezone_valid(n.task_timezone)
      then n.task_timezone else 'Europe/Belgrade' end;
    anchor_day:=(n.published_at at time zone wtz)::date;
    if n.schedule_kind='TOMORROW_FLEXIBLE' then
      ws:=(anchor_day+1)::timestamp at time zone wtz;
      we:=(anchor_day+2)::timestamp at time zone wtz;
    else
      ws:=anchor_day::timestamp at time zone wtz;
      we:=(anchor_day+(8-extract(isodow from anchor_day)::integer))::timestamp at time zone wtz;
    end if;
    if n.starts_at<ws or n.starts_at>=we or we<=at_now then return null; end if;
    if private.worker_available_periods(pid,greatest(n.starts_at,at_now),we,tz)<>'{}'::tstzmultirange then
      return 2;
    end if;
    return null;
  end if;
  -- Every other kind: the EX-06 rule as before (ex06a: a window-less TOMORROW / WEEK task reads the window its words mean).
  ws:=n.starts_at; we:=n.ends_at;
  if n.starts_at is null and n.ends_at is null and n.schedule_kind in ('TOMORROW_FLEXIBLE','WEEK_FLEXIBLE') then
    if n.published_at is null then return null; end if;
    wtz:=case when n.task_timezone is not null and private.availability_timezone_valid(n.task_timezone)
      then n.task_timezone else 'Europe/Belgrade' end;
    anchor_day:=(n.published_at at time zone wtz)::date;
    if n.schedule_kind='TOMORROW_FLEXIBLE' then
      ws:=(anchor_day+1)::timestamp at time zone wtz; we:=(anchor_day+2)::timestamp at time zone wtz;
    else
      ws:=anchor_day::timestamp at time zone wtz; we:=(anchor_day+(8-extract(isodow from anchor_day)::integer))::timestamp at time zone wtz;
    end if;
  end if;
  if private.availability_is_future(n.schedule_kind,ws,we,at_now) then
    periods:=private.worker_available_periods(pid,greatest(ws,at_now),we,tz);
    if n.schedule_kind='FIXED_WINDOW' then
      if periods @> tstzrange(ws,we,'[)') then return 2; end if;
      return null;
    end if;
    if periods<>'{}'::tstzmultirange then return 2; end if;
    return null;
  end if;
  if n.schedule_kind in ('TOMORROW_FLEXIBLE','WEEK_FLEXIBLE') then return null; end if;
  -- "odmah": the task's own time has begun. First "Mogu odmah" (a fixed window must still fit as before),
  -- then a schedule that covers now and the rest of a fixed window.
  live:=coalesce(p.available_now,false)
    and not exists(select 1 from public.profile_availability_windows w where w.profile_id=pid
      and w.availability_state='UNAVAILABLE' and w.starts_at<=at_now and w.ends_at>at_now)
    and not exists(select 1 from private.worker_calendar_events c where c.worker_profile_id=pid
      and c.state='BLOCKING' and c.starts_at<=at_now and c.ends_at>at_now);
  if live then
    if n.schedule_kind='FIXED_WINDOW' and not private.schedule_fit(pid,n.starts_at,n.ends_at,tz) then return null; end if;
    return 1;
  end if;
  if n.schedule_kind='FIXED_WINDOW' and n.starts_at is not null and n.ends_at is not null and n.starts_at<=at_now
     and private.worker_available_periods(pid,at_now,n.ends_at,tz) @> tstzrange(at_now,n.ends_at,'[)') then
    return 2;
  end if;
  return null;
end;
$function$;

-- Captured DEV definition MD5: 838f4fd5a2511a579abbb59f012bca4a
CREATE OR REPLACE FUNCTION private.worker_need_fit_v1(nid uuid, pid uuid, p_first_refusal boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
-- MATCH-V1: Dynamic Taxonomy Enhanced Matcher (Guarded against legacy regex pollution)
declare
  n public.needs; p public.app_profiles; pref public.worker_match_preferences;
  hard text[]:='{}'; svc boolean := false; area boolean; dist numeric; radius numeric; tier integer;
  effective_skills text[]; required_skill text;
  v_tax_tier text;
begin
  select * into n from public.needs where id=nid;
  if not found then
    return jsonb_build_object('matches',false,'service',false,'area',false,'timeTier',null,
      'distanceKm',null,'effectiveRadiusKm',null,'hard',jsonb_build_array('NEED_NOT_FOUND'));
  end if;
  select * into p from public.app_profiles where id=pid and kind='WORKER';
  if not found then
    return jsonb_build_object('matches',false,'service',false,'area',false,'timeTier',null,
      'distanceKm',null,'effectiveRadiusKm',null,'hard',jsonb_build_array('WORKER_PROFILE_NOT_FOUND'));
  end if;
  if p.profile_status<>'ACTIVE' then hard:=array_append(hard,'ACCOUNT_OR_PROFILE_RESTRICTED'); end if;
  if n.requester_account_id=p.account_id then hard:=array_append(hard,'OWN_NEED'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;

  -- DEV Gate C: only the real owner-signed current need revision and the
  -- worker's precise CONFIRMED service+execution mode may be dispatched or
  -- shown in "Za mene". This is the single shared matcher boundary.
  -- Legacy matching remains unchanged while control.enabled=false.
  IF EXISTS(SELECT 1 FROM private.taxonomy_match_scope_control_v1 ctl
      WHERE ctl.singleton AND ctl.enabled) THEN
    IF NOT private.taxonomy_scope_eligible_v1(n.id,p.account_id) THEN
      RETURN jsonb_build_object('matches',false,'service',false,'area',false,
        'timeTier',null,'distanceKm',null,'effectiveRadiusKm',null,
        'hard',jsonb_build_array('SIGNED_SERVICE_SCOPE_REQUIRED'),
        'taxonomyScope','UNCONFIRMED');
    END IF;
  END IF;

  -- 1. Area filter (radijus / mesto)
  radius:=private.effective_radius_km(p.radius_km);
  if n.execution_location_mode='REMOTE' then
    dist:=null; area:=true;
  else
    select * into pref from public.worker_match_preferences where worker_profile_id=pid;
    dist:=private.haversine_km(n.approximate_lat,n.approximate_lng,pref.approximate_lat,pref.approximate_lng);
    area:=coalesce(case when dist is not null then dist<=radius
      else n.task_country_code is not null
        and n.task_country_code=p.operating_country_code
        and btrim(coalesce(n.approximate_city,''))<>'' and lower(coalesce(n.approximate_city,''))=lower(coalesce(p.city,'')) end,false);
  end if;
  if p_first_refusal and not area then return jsonb_build_object('matches',false,'area',false); end if;

  -- 2. Service competency matching
  -- A. First: Check Dynamic Taxonomy Inheritance if task has category_id
  if n.category_id is not null then
    begin
      v_tax_tier := private.taxonomy_requirement_tier_inherited_v1(n.category_id, p.account_id);
      if v_tax_tier in ('EXACT', 'EQUIVALENT', 'RELATED_CONFIRMED', 'INHERITED_STANDARD') then
        svc := true;
      end if;
    exception when others then
      svc := false;
    end;
  end if;

  -- B. Fallback: Only run legacy skill match if task is NOT in taxonomy (category_id is null)
  if not svc and n.category_id is null then
    effective_skills := array_remove(array[n.category]::text[],null);
    svc:=coalesce(private.lower_arr(p.skills) && private.lower_arr(effective_skills),false);
  end if;

  if not private.accounts_same_world(n.requester_account_id,p.account_id) then hard:=array_append(hard,'OTHER_WORLD'); end if;
  if n.verified_identity_required and not private.identity_admitted(p.account_id)
    then hard:=array_append(hard,'IDENTITY_VERIFICATION_NOT_ADMITTED'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;

  -- C. Legacy aliases fallback only if task is NOT in taxonomy (category_id is null)
  if not svc and n.category_id is null then
    svc:=exists(
      select 1
      from unnest(private.work_kinds_v5(p.skills)) AS worker_kind(kind)
      join unnest(private.work_kinds_v5(effective_skills)) AS need_kind(kind)
        on worker_kind.kind=need_kind.kind
      where worker_kind.kind <> 'SITNE_POPRAVKE'
    );
  end if;

  -- Extra explicitly required skills (if any)
  if svc and coalesce(cardinality(n.required_skills),0)>0 then
    foreach required_skill in array n.required_skills loop
      if not (
        coalesce(private.lower_arr(p.skills) && private.lower_arr(array[required_skill]),false)
        or coalesce(private.work_kinds_v5(p.skills) && private.work_kinds_v5(array[required_skill]),false)
      ) then
        svc:=false;
        exit;
      end if;
    end loop;
  end if;

  if p_first_refusal and not svc then return jsonb_build_object('matches',false,'service',false); end if;

  -- 3. Exclusions filter
  if coalesce(cardinality(p.exclusions),0)>0
     and (private.lower_arr(p.exclusions) && private.lower_arr(array_prepend(n.category,n.required_skills))
          or private.work_kinds_v5(p.exclusions) && private.work_kinds_v5(array_prepend(n.category,n.required_skills)))
    then hard:=array_append(hard,'PROFILE_EXCLUSION'); end if;
  if p_first_refusal and cardinality(hard)>0 then return jsonb_build_object('matches',false,'hard',to_jsonb(hard)); end if;

  -- 4. Time filter
  tier:=private.worker_need_time_tier_v1(nid,pid);
  return jsonb_build_object('matches',cardinality(hard)=0 and svc and area and tier is not null,
    'service',svc,'area',area,'timeTier',tier,'distanceKm',dist,'effectiveRadiusKm',radius,'hard',to_jsonb(hard),
    'taxonomyTier',v_tax_tier);
end;
$function$;

DO $pins$
DECLARE expected record;
BEGIN
 FOR expected IN SELECT * FROM (VALUES
  ('private.account_lineage(uuid)','8fb2092aa40b93b733f5e7181c355c55'),
  ('private.account_visibility_world(uuid)','109bc82d7b7b466218fb6823493fda4e'),
  ('private.lower_arr(text[])','e5c312154cab99884d794656bb9b2550'),
  ('private.accounts_same_world(uuid,uuid)','2d6beb6df93bc8eb6ae2622de8319ac5'),
  ('private.effective_radius_km(integer)','aaf84a1425262215800ae7cfa2d9ee13'),
  ('private.haversine_km(numeric,numeric,numeric,numeric)','5a5848cbf4f91f2f216290e00cf89f1e'),
  ('private.identity_admitted(uuid)','48435c7dd78a2ae47bf18376a63d605c'),
  ('private.taxonomy_requirement_tier_inherited_v1(uuid,uuid)','f3dacd6f2b5d553d1d42f7422ae6d438'),
  ('private.taxonomy_scope_eligible_v1(uuid,uuid)','e3007d8a8dc5fdb25d6de97457ac5594'),
  ('private.worker_need_fit_v1(uuid,uuid,boolean)','838f4fd5a2511a579abbb59f012bca4a'),
  ('private.worker_need_time_tier_v1(uuid,uuid)','08184eff09085e53d8722450873a67d4')
 ) AS pins(signature,definition_md5)
 LOOP
  IF md5(pg_get_functiondef(to_regprocedure(expected.signature))) IS DISTINCT FROM expected.definition_md5 THEN
   RAISE EXCEPTION 'STRICT_MATCHER_CAPTURE_DRIFT_%',expected.signature;
  END IF;
 END LOOP;
 RAISE NOTICE 'STRICT_MATCHER_CAPTURE_11_EXACT_FUNCTIONS_PASS';
END $pins$;

INSERT INTO private.work_taxonomy_categories(id,canonical_key,label,state,source,catalog_version)
VALUES('d1000000-0000-4000-8000-000000000001',
 private.taxonomy_normalize_v1('3D printovanje'),'3D printovanje','ESTABLISHED','SYSTEM',3);
INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
VALUES('d1000000-0000-4000-8000-000000000001','REMOTE','DISPOSABLE_3D_MATCH');
INSERT INTO public.app_profiles(id,account_id,kind,profile_status,skills,exclusions,
 available_now,radius_km)
VALUES('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',
 'WORKER','ACTIVE',ARRAY['3D štampa'],'{}',false,15);
INSERT INTO private.worker_execution_mode_choices(worker_profile_id,worker_account_id,
 modes,confirmed_at,consent_source)
VALUES('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',
 ARRAY['REMOTE'],statement_timestamp(),'WORKER_REVIEW');
INSERT INTO private.work_taxonomy_worker_capabilities(worker_account_id,category_id,
 confirmed_at,excluded,allow_related_offers,origin)
VALUES('a1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001',
 statement_timestamp(),false,false,'WORKER_CONFIRMED');
INSERT INTO private.worker_ai_saves(review_id,account_id,client_request_id)
VALUES('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',
 'a4000000-0000-4000-8000-000000000001');
INSERT INTO private.taxonomy_confirmed_worker_modes_v1(worker_account_id,category_id,
 execution_scope,source_review_id,source_request_key)
VALUES('a1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001',
 'REMOTE','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001');
INSERT INTO public.needs(id,requester_account_id,category_id,revision,category,
 execution_location_mode,schedule_kind,published_at)
VALUES('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001',
 'd1000000-0000-4000-8000-000000000001',1,'3D printovanje','REMOTE','REMOTE_ANYTIME',
 statement_timestamp());
INSERT INTO private.work_taxonomy_need_snapshots(need_id,need_revision,category_id,
 catalog_version,reviewed_by_requester,source,classification_state,original_category)
VALUES('b2000000-0000-4000-8000-000000000001',1,'d1000000-0000-4000-8000-000000000001',
 3,true,'AI_PROPOSED','CONFIRMED','3D printovanje');

CREATE FUNCTION private.disposable_require_3d_match(p_expected boolean,p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $assert$
DECLARE result jsonb; first_refusal boolean;
BEGIN
 FOREACH first_refusal IN ARRAY ARRAY[false,true] LOOP
  result:=private.worker_need_fit_v1('b2000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001',first_refusal);
  IF (result->>'matches')::boolean IS DISTINCT FROM p_expected THEN
   RAISE EXCEPTION 'STRICT_3D_MATCH_EXPECTATION_FAILED_%_%',p_reason,first_refusal;
  END IF;
  IF p_expected AND ((result->>'service')::boolean IS DISTINCT FROM true
   OR (result->>'area')::boolean IS DISTINCT FROM true
   OR (result->>'timeTier')::integer IS DISTINCT FROM 1
   OR result->>'taxonomyTier' IS DISTINCT FROM 'EXACT'
   OR result->'hard' IS DISTINCT FROM '[]'::jsonb) THEN
   RAISE EXCEPTION 'STRICT_3D_POSITIVE_FIELDS_FAILED';
  END IF;
  IF p_reason IS NOT NULL AND NOT coalesce(result->'hard' ? p_reason,false) THEN
   RAISE EXCEPTION 'STRICT_3D_REASON_FAILED_%_%',p_reason,first_refusal;
  END IF;
 END LOOP;
END $assert$;

-- OFF and ON both accept the distinct requester, signed exact REMOTE pair.
SELECT private.disposable_require_3d_match(true);
UPDATE private.taxonomy_match_scope_control_v1 SET enabled=true WHERE singleton;
SELECT private.disposable_require_3d_match(true);
DO $$ BEGIN RAISE NOTICE 'STRICT_3D_DISTINCT_REQUESTER_MATCH_OFF_ON_PASS'; END $$;

-- OWN_NEED and actual TEST/REAL lineage checks remain hard blockers.
UPDATE public.needs SET requester_account_id='a1000000-0000-4000-8000-000000000001'
 WHERE id='b2000000-0000-4000-8000-000000000001';
SELECT private.disposable_require_3d_match(false,'OWN_NEED');
UPDATE public.needs SET requester_account_id='c1000000-0000-4000-8000-000000000001'
 WHERE id='b2000000-0000-4000-8000-000000000001';
SELECT private.disposable_require_3d_match(false,'OTHER_WORLD');
UPDATE public.needs SET requester_account_id='b1000000-0000-4000-8000-000000000001'
 WHERE id='b2000000-0000-4000-8000-000000000001';

UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false
 WHERE worker_account_id='a1000000-0000-4000-8000-000000000001';
SELECT private.disposable_require_3d_match(false,'SIGNED_SERVICE_SCOPE_REQUIRED');
UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=true
 WHERE worker_account_id='a1000000-0000-4000-8000-000000000001';
UPDATE private.work_taxonomy_need_snapshots
 SET reviewed_by_requester=false,classification_state='NEEDS_CLARIFICATION'
 WHERE need_id='b2000000-0000-4000-8000-000000000001';
SELECT private.disposable_require_3d_match(false,'SIGNED_SERVICE_SCOPE_REQUIRED');
UPDATE private.work_taxonomy_need_snapshots
 SET reviewed_by_requester=true,classification_state='CONFIRMED'
 WHERE need_id='b2000000-0000-4000-8000-000000000001';
UPDATE public.needs SET revision=2 WHERE id='b2000000-0000-4000-8000-000000000001';
SELECT private.disposable_require_3d_match(false,'SIGNED_SERVICE_SCOPE_REQUIRED');
UPDATE public.needs SET revision=1 WHERE id='b2000000-0000-4000-8000-000000000001';
UPDATE public.needs SET execution_location_mode='STATIONARY'
 WHERE id='b2000000-0000-4000-8000-000000000001';
SELECT private.disposable_require_3d_match(false,'SIGNED_SERVICE_SCOPE_REQUIRED');
UPDATE public.needs SET execution_location_mode='REMOTE'
 WHERE id='b2000000-0000-4000-8000-000000000001';

-- Current signed scope cannot override the actual time function's expired deadline.
UPDATE public.needs SET ends_at=statement_timestamp()-interval '1 day'
 WHERE id='b2000000-0000-4000-8000-000000000001';
SELECT private.disposable_require_3d_match(false);
UPDATE public.needs SET ends_at=NULL WHERE id='b2000000-0000-4000-8000-000000000001';
SELECT private.disposable_require_3d_match(true);
DO $$ BEGIN RAISE NOTICE 'STRICT_3D_OWN_WORLD_REVOKED_UNSIGNED_STALE_MODE_TIME_PASS'; END $$;
ROLLBACK;
