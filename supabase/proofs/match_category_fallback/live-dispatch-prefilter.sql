-- READ-ONLY captured canonical DEV function definitions (2026-10-10).
-- RUN ONLY IN disposable PostgreSQL 16 via CI. Never on canonical DEV/PROD.
-- For candidate testing these execute exactly the deployed dispatch cheap gate,
-- wrapper included. This DOES NOT execute dispatch_next_wave or send a push.
-- SHA source-body guards are in source.test.mjs.
-- Install wrapper first: PostgreSQL validates referenced SQL functions at creation.
CREATE OR REPLACE FUNCTION private.worker_need_match_v1(nid uuid, pid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  -- MATCH-V1 (owner 2026-10-07): "Odgovara mi" as one boolean. Notifications (dispatch) and "Za mene" read exactly this.
  select coalesce((private.worker_need_fit_v1(nid,pid,true)->>'matches')::boolean,false);
$function$;

CREATE OR REPLACE FUNCTION private.dispatch_cheap_candidate_admitted(nid uuid, pid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  select exists (
    select 1
    from public.needs n
    join public.app_profiles p on p.id = pid
    left join public.worker_match_preferences pref on pref.worker_profile_id = p.id
    where n.id = nid
      and p.kind = 'WORKER'
      and p.profile_status = 'ACTIVE'
      and coalesce(pref.proactive_notifications, true) = true
      -- MATCH-V1 (owner 2026-10-07): the ONE shared "Odgovara mi" rule: kind of work + area + time and the existing
      -- hard exceptions (own task, other world, identity, exclusions). Tools, vehicles, experience and the
      -- minimum fee are no longer conditions; licenses were retired by WPP01. The rule takes the ROW columns, never
      -- the bare parameters: a parameter-only call is a one-time filter that would run before the status filter above,
      -- for every draft or suspended profile the candidate loop visits.
      and private.worker_need_match_v1(n.id, p.id)
      and not exists (
        select 1 from public.opportunity_deliveries od
        where od.worker_account_id = p.account_id
          and od.need_id = n.id
          and od.need_revision = n.revision)
  );
$function$;
