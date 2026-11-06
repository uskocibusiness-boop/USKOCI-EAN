-- ============================================================================
-- Migration: 20261106000300_matching_ratings_serbia_wide_and_rls_initplan.sql
-- Description:
--   1. Allow workers with saved workAreas (e.g. "Cela Srbija") beyond 300km
--      to be admitted in private.candidate_profile_ids.
--   2. Wire authoritative account reputation averageRating into
--      private.match_detail_without_calendar for reliability & fairness scoring.
--   3. Wrap bare auth.uid() in (select auth.uid()) across 18 public RLS policies
--      for PostgreSQL InitPlan evaluation.
-- ============================================================================

CREATE OR REPLACE FUNCTION private.candidate_profile_ids(nid uuid, p_limit integer)
 RETURNS TABLE(worker_profile_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs; admitted integer := 0; c record; task_geog extensions.geography;
begin
  select * into n from public.needs where id = nid;
  if not found or p_limit is null or p_limit < 1 then return; end if;

  if n.execution_location_mode in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED')
     and n.approx_geog is not null then
    task_geog := n.approx_geog;

    for c in
      select pref.worker_profile_id as pid
      from public.worker_match_preferences pref
      where pref.approximate_geog is not null
        and extensions.ST_DWithin(pref.approximate_geog, task_geog, 300000.0)
      order by pref.approximate_geog OPERATOR(extensions.<->) task_geog, pref.worker_profile_id
    loop
      if private.dispatch_cheap_candidate_admitted(n.id, c.pid) then
        worker_profile_id := c.pid; return next;
        admitted := admitted + 1;
        exit when admitted >= p_limit;
      end if;
    end loop;

    if admitted < p_limit then
      for c in
        select p.id as pid
        from public.app_profiles p
        left join public.worker_match_preferences pref on pref.worker_profile_id = p.id
        where p.kind = 'WORKER' and p.profile_status = 'ACTIVE'
          and (
            pref.worker_profile_id is null
            or pref.approximate_geog is null
            or (
              not extensions.ST_DWithin(pref.approximate_geog, task_geog, 300000.0)
              and jsonb_array_length(private.worker_saved_areas_v1(p.account_id)) > 0
            )
          )
        order by p.id
      loop
        if private.dispatch_cheap_candidate_admitted(n.id, c.pid) then
          worker_profile_id := c.pid; return next;
          admitted := admitted + 1;
          exit when admitted >= p_limit;
        end if;
      end loop;
    end if;
    return;
  end if;

  for c in
    select p.id as pid from public.app_profiles p
    where p.kind = 'WORKER' and p.profile_status = 'ACTIVE'
    order by case when p.id >= n.id then 0 else 1 end, p.id
  loop
    if private.dispatch_cheap_candidate_admitted(n.id, c.pid) then
      worker_profile_id := c.pid; return next;
      admitted := admitted + 1;
      exit when admitted >= p_limit;
    end if;
  end loop;
end;
$function$;

REVOKE ALL ON FUNCTION private.candidate_profile_ids(uuid, integer) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.match_detail_without_calendar(nid uuid, pid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs; p public.app_profiles; pref public.worker_match_preferences;
  hard text[] := '{}'; disp text[] := '{}'; reasons text[] := '{}';
  tz text; local_day date; fit jsonb; tier integer;
  svc boolean;
  sched boolean; dist numeric; radiusok boolean;
  effective_radius numeric; exposure integer;
  v_worker_rating numeric;
  cap numeric := 0; ss numeric := 0; ds numeric := 0; rs numeric := 0;
  rels numeric := 0; fair numeric := 0;
begin
  select * into n from public.needs where id = nid;
  if not found then
    return jsonb_build_object('responseAllowed',false,'dispatchEligible',false,
      'hardBlockers',jsonb_build_array('NEED_NOT_FOUND'));
  end if;
  select * into p from public.app_profiles where id = pid and kind = 'WORKER';
  if not found then
    return jsonb_build_object('responseAllowed',false,'dispatchEligible',false,
      'hardBlockers',jsonb_build_array('WORKER_PROFILE_NOT_FOUND'));
  end if;
  select * into pref from public.worker_match_preferences where worker_profile_id = pid;

  tz := coalesce(nullif(pref.timezone,''), 'Europe/Belgrade');
  local_day := case when n.starts_at is not null then (n.starts_at at time zone tz)::date end;

  fit := private.worker_need_fit_v1(nid,pid,false);
  svc := (fit->>'service')::boolean;
  tier := (fit->>'timeTier')::integer;
  sched := tier is not null;
  effective_radius := (fit->>'effectiveRadiusKm')::numeric;
  dist := (fit->>'distanceKm')::numeric;
  radiusok := (fit->>'area')::boolean;

  if p.profile_status <> 'ACTIVE' then hard := array_append(hard,'ACCOUNT_OR_PROFILE_RESTRICTED'); end if;
  if n.requester_account_id = p.account_id then hard := array_append(hard,'OWN_NEED'); end if;
  if n.verified_identity_required and not private.identity_admitted(p.account_id)
    then hard := array_append(hard,'IDENTITY_VERIFICATION_NOT_ADMITTED'); end if;
  if coalesce(cardinality(p.exclusions),0) > 0 and (private.lower_arr(p.exclusions) && private.lower_arr(array_prepend(n.category, n.required_skills))
     or private.work_kinds_v5(p.exclusions) && private.work_kinds_v5(array_prepend(n.category, n.required_skills)))
    then hard := array_append(hard,'PROFILE_EXCLUSION'); end if;

  if not coalesce(pref.proactive_notifications,true) then disp := array_append(disp,'PROACTIVE_NOTIFICATIONS_PAUSED'); end if;
  if n.urgent
     and (n.schedule_kind = 'TODAY_FLEXIBLE'
          or (n.starts_at is not null and (n.starts_at at time zone tz)::date = (statement_timestamp() at time zone tz)::date))
     and not coalesce(pref.same_day_urgent_notifications,true)
    then disp := array_append(disp,'SAME_DAY_URGENT_NOTIFICATIONS_PAUSED'); end if;
  if not svc then disp := array_append(disp,'SERVICE_NOT_IN_WORK_PROFILE'); end if;
  if not sched then disp := array_append(disp,'OUTSIDE_AVAILABILITY'); end if;
  if not radiusok then disp := array_append(disp,'OUTSIDE_PREFERRED_RADIUS'); end if;

  if svc then reasons := array_append(reasons,'SERVICE_MATCH'); cap := 30; end if;
  if sched then reasons := array_append(reasons,'SCHEDULE_MATCH'); ss := 25; end if;
  if radiusok then
    reasons := array_append(reasons, case when n.execution_location_mode='REMOTE'
                 then 'REMOTE_LOCATION_NOT_REQUIRED' else 'START_PROXIMITY_MATCH' end);
    ds := case
      when n.execution_location_mode='REMOTE' then 15
      when dist is null or effective_radius is null or effective_radius <= 0 then 10
      else round(15 * (1 - 0.55 * least(1, greatest(0, dist/effective_radius))), 1)
    end;
  end if;

  v_worker_rating := coalesce((private.account_reputation(p.account_id)->>'averageRating')::numeric, p.rating_worker);
  rels := round(greatest(0, least(100, coalesce(v_worker_rating*20, 50)))/10, 1);
  select count(*) into exposure from public.opportunity_deliveries d
   where d.worker_account_id = p.account_id
     and d.created_at > statement_timestamp() - interval '7 days';
  fair := case when v_worker_rating is null then 5 else greatest(0, 5 - least(5, exposure)) end;
  if v_worker_rating is null then reasons := array_append(reasons,'NEWCOMER_FAIRNESS'); end if;

  return jsonb_build_object(
    'workerAccountId', p.account_id,
    'workerProfileId', p.id,
    'responseAllowed', cardinality(hard) = 0,
    'dispatchEligible', cardinality(hard) = 0 and cardinality(disp) = 0,
    'hardBlockers', to_jsonb(hard),
    'dispatchBlockers', to_jsonb(disp),
    'reasonCodes', to_jsonb(reasons),
    'distanceToStartKm', dist,
    'effectiveRadiusKm', effective_radius,
    'taskLocationMode', n.execution_location_mode,
    'distanceSource', case when dist is null then null else 'GEODESIC' end,
    'routingProvider', null,
    'liveStateDate', local_day,
    'timeTier', tier,
    'score', round(least(100, cap+ss+ds+rs+rels+fair), 1),
    'scoreComponents', jsonb_build_object(
      'capability', cap, 'schedule', ss, 'distanceToStart', ds,
      'resources', rs, 'reliability', rels, 'fairness', fair)
  );
end;
$function$;

REVOKE ALL ON FUNCTION private.match_detail_without_calendar(uuid, uuid) FROM public, anon, authenticated, service_role;

-- 3. RLS InitPlan optimization: wrap auth.uid() in (select auth.uid())
ALTER POLICY access_grants_read ON public.access_grants
  USING ((granted_by_account_id = (select auth.uid())) OR (granted_to_account_id = (select auth.uid())));

ALTER POLICY agreement_change_proposals_participant_read ON public.agreement_change_proposals
  USING (EXISTS (
    SELECT 1 FROM public.agreements a
    WHERE a.id = agreement_change_proposals.agreement_id
      AND ((select auth.uid()) = a.requester_account_id OR (select auth.uid()) = a.worker_account_id)
  ));

ALTER POLICY agreement_execution_read ON public.agreement_execution
  USING (EXISTS (
    SELECT 1 FROM public.agreements a
    WHERE a.id = agreement_execution.agreement_id
      AND (a.requester_account_id = (select auth.uid()) OR a.worker_account_id = (select auth.uid()))
  ));

ALTER POLICY agreement_messages_read ON public.agreement_messages
  USING (EXISTS (
    SELECT 1 FROM public.agreements a
    WHERE a.id = agreement_messages.agreement_id
      AND (a.requester_account_id = (select auth.uid()) OR a.worker_account_id = (select auth.uid()))
  ));

ALTER POLICY agreement_versions_read ON public.agreement_versions
  USING (EXISTS (
    SELECT 1 FROM public.agreements a
    WHERE a.id = agreement_versions.agreement_id
      AND (a.requester_account_id = (select auth.uid()) OR a.worker_account_id = (select auth.uid()))
  ));

ALTER POLICY agreements_parties_read ON public.agreements
  USING ((requester_account_id = (select auth.uid())) OR (worker_account_id = (select auth.uid())));

ALTER POLICY ai_messages_own_read ON public.ai_messages
  USING (account_id = (select auth.uid()));

ALTER POLICY ai_facts_own ON public.ai_structured_facts
  USING (account_id = (select auth.uid()))
  WITH CHECK (account_id = (select auth.uid()));

ALTER POLICY response_versions_read ON public.marketplace_response_versions
  USING (EXISTS (
    SELECT 1 FROM public.marketplace_responses r
    WHERE r.id = marketplace_response_versions.response_id
      AND (
        r.worker_account_id = (select auth.uid())
        OR (r.status <> 'DRAFT'::text AND EXISTS (
          SELECT 1 FROM public.needs n WHERE n.id = r.need_id AND public.is_my_task(n.id)
        ))
      )
  ));

ALTER POLICY responses_worker_read ON public.marketplace_responses
  USING (worker_account_id = (select auth.uid()));

ALTER POLICY selections_requester ON public.need_selections
  USING (selected_by_account_id = (select auth.uid()));

ALTER POLICY needs_owner_insert ON public.needs
  WITH CHECK ((requester_account_id = (select auth.uid())) AND (status = 'DRAFT'::text));

ALTER POLICY needs_owner_select ON public.needs
  USING (requester_account_id = (select auth.uid()));

ALTER POLICY od_worker_select ON public.opportunity_deliveries
  USING (worker_account_id = (select auth.uid()));

ALTER POLICY events_own ON public.user_activity_events
  USING (recipient_user_id = (select auth.uid()));

ALTER POLICY wmp_own_insert ON public.worker_match_preferences
  WITH CHECK (
    (worker_account_id = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.app_profiles p
      WHERE p.id = worker_match_preferences.worker_profile_id
        AND p.account_id = (select auth.uid())
        AND p.kind = 'WORKER'::text
    )
  );

ALTER POLICY wmp_own_select ON public.worker_match_preferences
  USING (worker_account_id = (select auth.uid()));

ALTER POLICY wmp_own_update ON public.worker_match_preferences
  USING (worker_account_id = (select auth.uid()))
  WITH CHECK (worker_account_id = (select auth.uid()));
