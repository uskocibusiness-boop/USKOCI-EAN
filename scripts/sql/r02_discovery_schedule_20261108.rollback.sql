-- R02: compute calendar ranges only when the requested time filter needs them.
-- Preserve exact global availability through the same calendar helper with EXISTS.
-- No data, RLS, public projection, cursor, matching or production flag change.
DO $r02_discovery_schedule$
DECLARE
 target regprocedure := to_regprocedure('public.rpc_discovery_v1(jsonb)');
 definition text; body text; replacement text;
 old_0 constant text := $old_0$case when when_mode='any' and range_from is null then null::text[] else public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) end as days$old_0$;
 new_0 constant text := $new_0$case when request_mode in ('MAP','PLACES') and when_mode='any' and range_from is null then null::text[] else public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) end as days$new_0$;
 old_1 constant text := $old_1$'hasKnownSchedule',case when when_mode='any' and range_from is null
    then exists(select 1 from unfiltered where public.p6_discovery_days(schedule_kind,starts_at,ends_at,task_timezone,time_at) is not null)
    else exists(select 1 from base where days is not null) end$old_1$;
 new_1 constant text := $new_1$'hasKnownSchedule',exists(select 1 from base where days is not null)$new_1$;
BEGIN
 SELECT pg_get_functiondef(p.oid),p.prosrc INTO definition,body FROM pg_proc p
 WHERE p.oid=target AND NOT p.prosecdef AND p.provolatile='s'
  AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
  AND pg_get_userbyid(p.proowner)='postgres'
  AND p.proacl::text='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}';
 IF body IS NULL OR md5(body)<>'c75535d3f77b2216ed424843ef57ef04' OR strpos(body,old_0)=0 OR strpos(body,old_1)=0
 THEN RAISE EXCEPTION 'R02_DISCOVERY_SCHEDULE_ROLLBACK_DRIFT'; END IF;
 replacement:=replace(replace(body,old_0,new_0),old_1,new_1);
 EXECUTE replace(replace(definition,old_0,new_0),old_1,new_1);
 IF (SELECT prosrc FROM pg_proc WHERE oid=target) IS DISTINCT FROM replacement
 THEN RAISE EXCEPTION 'R02_DISCOVERY_SCHEDULE_REPLACEMENT_MISMATCH'; END IF;
END
$r02_discovery_schedule$;
