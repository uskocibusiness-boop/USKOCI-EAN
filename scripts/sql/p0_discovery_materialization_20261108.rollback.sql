-- Reverse only this optimization; refuse any intervening function-body change.
DO $discovery_materialization_rollback$
DECLARE
 target regprocedure := to_regprocedure('public.rpc_discovery_v1(jsonb)');
 definition text;
 body text;
 old_base constant text := $old_base$ with base as materialized (
  select n.id,n.revision,n.published_at,n.title,n.category,n.status,n.urgent,n.schedule_kind,n.starts_at,n.ends_at,n.execution_location_mode,
   n.task_country_code,n.task_timezone,n.verified_identity_required,n.approximate_city,n.approximate_area,n.approximate_lat,n.approximate_lng,
   n.required_slots,n.required_skills,n.required_tools,n.required_vehicles,n.required_licenses,n.minimum_experience_years,n.mode,
   n.requester_price_rsd,n.price_basis,n.requester_profile_id,n.response_deadline,
   case when people>1 then public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))) else null::integer end as covered_now,
   case when request_mode in ('MAP','PLACES') and when_mode='any' and range_from is null then null::text[] else public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) end as days,
   case when request_mode='PLACES'
     or query_text<>''
    then public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE')
    else null::text end as area_text,
   case when n.execution_location_mode='REMOTE' or n.approximate_lat is null or n.approximate_lng is null then false else true end as has_point,
   (time_at at time zone coalesce(n.task_timezone,'UTC'))::date as today
  from public.needs n where n.status in ('PUBLISHED','SELECTION') and n.published_at is not null and n.remaining_search_closed_at is null
   and (request_mode='EXACT_PUBLIC' and n.id=need_id or request_mode in ('PAGE','MAP','PLACES') and n.published_at<=through_at)$old_base$;
 new_base constant text := $new_base$ with unfiltered as not materialized (
  select n.execution_location_mode,n.mode,n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone
  from public.needs n where n.status in ('PUBLISHED','SELECTION') and n.published_at is not null and n.remaining_search_closed_at is null
   and (request_mode='EXACT_PUBLIC' and n.id=need_id or request_mode in ('PAGE','MAP','PLACES') and n.published_at<=through_at)
 ), base as materialized (
  select n.id,n.revision,n.published_at,n.title,n.category,n.status,n.urgent,n.schedule_kind,n.starts_at,n.ends_at,n.execution_location_mode,
   n.task_country_code,n.task_timezone,n.verified_identity_required,n.approximate_city,n.approximate_area,n.approximate_lat,n.approximate_lng,
   n.required_slots,n.required_skills,n.required_tools,n.required_vehicles,n.required_licenses,n.minimum_experience_years,n.mode,
   n.requester_price_rsd,n.price_basis,n.requester_profile_id,n.response_deadline,
   case when people>1 then public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))) else null::integer end as covered_now,
   case when request_mode in ('MAP','PLACES') and when_mode='any' and range_from is null then null::text[] else public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) end as days,
   case when request_mode='PLACES'
     or query_text<>''
    then public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE')
    else null::text end as area_text,
   case when n.execution_location_mode='REMOTE' or n.approximate_lat is null or n.approximate_lng is null then false else true end as has_point,
   (time_at at time zone coalesce(n.task_timezone,'UTC'))::date as today
  from public.needs n where n.status in ('PUBLISHED','SELECTION') and n.published_at is not null and n.remaining_search_closed_at is null
   and (request_mode='EXACT_PUBLIC' and n.id=need_id or request_mode in ('PAGE','MAP','PLACES') and n.published_at<=through_at)
   and (price='all' or n.mode=price)
   and (min_budget_rsd is null or n.mode='OFFERS' or (n.mode='MY_PRICE' and n.requester_price_rsd>=min_budget_rsd))
   and (location_mode='any' or location_mode='remote' and n.execution_location_mode='REMOTE'
     or location_mode='onsite' and n.execution_location_mode is not null and n.execution_location_mode<>'REMOTE')$new_base$;
 old_availability constant text := $old_availability$'availability',jsonb_build_object('hasKnownWorkMode',exists(select 1 from base where execution_location_mode is not null),
   'hasKnownSchedule',exists(select 1 from base where days is not null),'priceModes',(select coalesce(jsonb_agg(mode order by mode),'[]') from (select distinct mode from base) modes)))$old_availability$;
 new_availability constant text := $new_availability$'availability',case when price='all' and min_budget_rsd is null and location_mode='any'
   then jsonb_build_object('hasKnownWorkMode',exists(select 1 from base where execution_location_mode is not null),
   'hasKnownSchedule',exists(select 1 from base where days is not null),'priceModes',(select coalesce(jsonb_agg(mode order by mode),'[]') from (select distinct mode from base) modes))
   else jsonb_build_object('hasKnownWorkMode',exists(select 1 from unfiltered where execution_location_mode is not null),
   'hasKnownSchedule',exists(select 1 from unfiltered where (case when request_mode in ('MAP','PLACES') and when_mode='any' and range_from is null then null::text[]
     else public.p6_discovery_days(schedule_kind,starts_at,ends_at,task_timezone,time_at) end) is not null),
   'priceModes',(select coalesce(jsonb_agg(mode order by mode),'[]') from (select distinct mode from unfiltered) modes)) end)$new_availability$;
 restored text;
BEGIN
 IF target IS NULL THEN RAISE EXCEPTION 'P0_DISCOVERY_MISSING'; END IF;
 SELECT pg_get_functiondef(p.oid),p.prosrc INTO definition,body FROM pg_proc p WHERE p.oid=target;
 restored:=replace(replace(body,new_base,old_base),new_availability,old_availability);
 IF md5(restored)<>'1cb5ece85a18972ca3ef827981733858'
  OR strpos(body,new_base)=0 OR strpos(body,new_availability)=0
 THEN RAISE EXCEPTION 'P0_DISCOVERY_ROLLBACK_DRIFT'; END IF;
 EXECUTE replace(replace(definition,new_base,old_base),new_availability,old_availability);
END
$discovery_materialization_rollback$;
