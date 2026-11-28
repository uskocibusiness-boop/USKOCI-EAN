-- USKOCI R09: final withdrawn application cannot receive its task as a new opportunity.
-- ROLLBACK candidate, captured against canonical DEV on 2026-11-28.
-- Source-only: run on a disposable PostgreSQL/Supabase clone after reviewing the
-- exact preimage. Strip ONLY the guard for the isolated test. Do not deploy this
-- file directly to DEV or production. Promote through the project's reviewed migration package.
DO $source_only$ BEGIN RAISE EXCEPTION 'R09_WITHDRAWN_FINAL_SOURCE_ONLY'; END $source_only$;

-- R09_WITHDRAWN_FINAL_ISOLATED_START
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
CREATE TEMP TABLE uskoci_r09_withdrawn_guard(sig text PRIMARY KEY, metadata jsonb NOT NULL, after_hash text NOT NULL) ON COMMIT DROP;
DO $preflight$
DECLARE f record; actual pg_proc%rowtype;
BEGIN
  FOR f IN SELECT * FROM (VALUES
    ('private.dispatch_cheap_candidate_admitted(uuid,uuid)','bef52250dc03c1f7ea546a58b34b20f8','34dcf47d654d5960fbf7254c28745a04','{postgres=X/postgres}'),
    ('private.push_suppression(public.notification_deliveries)','6fc779b009c4682de2512b7b0d3bb6de','e9f104bc1a62aefd73d52fee8294c52d','{postgres=X/postgres}'),
    ('public.rpc_resolve_activity_opportunity_v1(uuid,uuid)','a8d3d60eff1644c64d67abe6c6f24233','ac72682ce0b16066e726b374586923ca','{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
  ) v(sig,before_hash,after_hash,expected_acl) LOOP
    SELECT * INTO actual FROM pg_proc WHERE oid=to_regprocedure(f.sig);
    IF NOT FOUND OR md5(actual.prosrc) IS DISTINCT FROM f.before_hash
      OR pg_get_userbyid(actual.proowner) IS DISTINCT FROM 'postgres'
      OR actual.proacl::text IS DISTINCT FROM f.expected_acl
      OR NOT actual.prosecdef
      OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] THEN
      RAISE EXCEPTION 'R09_WITHDRAWN_FINAL_PREIMAGE_DRIFT:%',f.sig;
    END IF;
    INSERT INTO pg_temp.uskoci_r09_withdrawn_guard VALUES(f.sig,to_jsonb(actual)-'prosrc',f.after_hash);
  END LOOP;
END $preflight$;

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
      -- R09: old tasks stay discoverable; only a publication after the
      -- worker's immutable notification clock is proactively announced.
      and p.worker_dispatch_eligible_since is not null
      and n.published_at > p.worker_dispatch_eligible_since
      -- F20: a committed active or accepted offer already expresses interest in this
      -- exact publication. Account identity (not a possibly replaced profile)
      -- owns the suppression; Discovery/manual application stay unchanged.
      and not exists (
        select 1 from public.marketplace_responses r
        where r.need_id = n.id
          and r.worker_account_id = p.account_id
          and r.submitted_against_need_revision = n.revision
          and r.response_kind = 'OFFER'
          and r.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED'))
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

CREATE OR REPLACE FUNCTION private.push_suppression(p_delivery public.notification_deliveries)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  p public.notification_preferences%rowtype;
  e public.user_activity_events%rowtype;
  enabled boolean;
  local_time time;
begin
  if p_delivery.channel<>'PUSH' or p_delivery.state in ('SUPPRESSED','EXPIRED','READ','DELIVERED','FAILED_FINAL') then
    return 'DELIVERY_CLOSED';
  end if;
  if p_delivery.expires_at<=clock_timestamp() then
    return 'EXPIRED';
  end if;
  select * into e from public.user_activity_events where id=p_delivery.event_id;
  if not found or e.recipient_user_id<>p_delivery.recipient_user_id or e.recipient_role<>p_delivery.recipient_role then
    return 'EVENT_UNAVAILABLE';
  end if;

  -- F20: the event's immutable Need revision is the notification identity.
  -- Recheck before both first claim and SEND_STARTED, including the default-ON
  -- path with no preferences row. A later Need edit must not reinterpret an
  -- older event, and an opportunity status alone cannot prove a manual offer.
  if e.event_type='OPPORTUNITY_AVAILABLE' and e.entity_type='NEED'
     and e.recipient_role='WORKER' and exists (
       select 1 from public.marketplace_responses r
       where r.need_id=e.entity_id
         and r.worker_account_id=e.recipient_user_id
         and r.submitted_against_need_revision=e.entity_version
         and r.response_kind='OFFER'
         and r.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED')) then
    return 'ALREADY_RESPONDED';
  end if;

  select * into p from public.notification_preferences where user_id=p_delivery.recipient_user_id and role_context=p_delivery.recipient_role;
  if not found then
    -- When preferences row does not exist yet, default all categories and push to ON
    return null;
  end if;

  if not coalesce(p.push_enabled, true) then
    return 'PUSH_OFF';
  end if;

  enabled:=case private.category_of_event(e.event_type)
    when 'opportunities' then coalesce(p.opportunities_enabled, true)
    when 'responses' then coalesce(p.responses_enabled, true)
    when 'dogovor' then coalesce(p.dogovor_enabled, true)
    when 'execution' then coalesce(p.execution_enabled, true)
    when 'recovery' then coalesce(p.recovery_enabled, true)
    else coalesce(p.account_enabled, true)
  end;
  if not enabled then
    return 'CATEGORY_OFF';
  end if;

  local_time:=(clock_timestamp() at time zone coalesce(p.quiet_timezone, 'UTC'))::time;
  if coalesce(p.quiet_hours_enabled, false)
     and (case when p.quiet_start<p.quiet_end then local_time between p.quiet_start and p.quiet_end else local_time>=p.quiet_start or local_time<=p.quiet_end end)
 then
    return 'QUIET_HOURS';
  end if;

  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_resolve_activity_opportunity_v1(p_expected_user_id uuid, p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
 u uuid := private.support_auth_v5(p_expected_user_id);
 v_need uuid;
 v_requester uuid;
 unavailable jsonb := jsonb_build_object('schema','ACTIVITY_OPPORTUNITY_TARGET_V1',
   'accountId',u,'kind','UNAVAILABLE','authoritative',true);
begin
 select n.id,n.requester_account_id into v_need,v_requester
 from public.user_activity_events e
 join public.needs n on n.id=e.entity_id
 join public.opportunity_deliveries od
   on od.worker_account_id=u and od.need_id=n.id and od.need_revision=n.revision
 join public.app_profiles p on p.id=od.worker_profile_id and p.account_id=u
 join public.notification_deliveries d
   on d.event_id=e.id and d.recipient_user_id=u and d.recipient_role='WORKER'
   and d.channel='IN_APP' and d.dedupe_key=e.dedupe_key||':in_app'
 where e.id=p_event_id and e.recipient_user_id=u
   and e.recipient_role='WORKER' and e.event_type='OPPORTUNITY_AVAILABLE'
   and e.entity_type='NEED' and e.entity_version=n.revision
   and e.dedupe_key='opp:'||n.id::text||':'||n.revision::text||':'||u::text
   and n.status in ('PUBLISHED','SELECTION')
   and n.requester_account_id<>u and n.requester_account_id is not null
   and p.kind='WORKER' and p.profile_status='ACTIVE'
   and od.status in ('READY','SEEN','RESPONDED')
   and od.expires_at>clock_timestamp()
   and d.state in ('CREATED','SENT','DELIVERED','READ')
   and d.suppression_reason is null
   and private.accounts_same_world(n.requester_account_id,u)
   and not private.safety_event_blocked(e)
 limit 1;
 if not found then
   perform private.support_auth_v5(u);
   return unavailable;
 end if;
 begin
   perform private.closure_assert_open(u,v_requester);
 exception when sqlstate '42501' then
   perform private.support_auth_v5(u);
   return unavailable;
 end;
 perform private.support_auth_v5(u);
 return jsonb_build_object('schema','ACTIVITY_OPPORTUNITY_TARGET_V1',
  'accountId',u,'kind','OPPORTUNITY','eventId',p_event_id,
  'needId',v_need,'role','WORKER','authoritative',true);
end;
$function$;

DO $postflight$
DECLARE f record; actual pg_proc%rowtype;
BEGIN
  FOR f IN SELECT * FROM pg_temp.uskoci_r09_withdrawn_guard LOOP
    SELECT * INTO actual FROM pg_proc WHERE oid=to_regprocedure(f.sig);
    IF NOT FOUND OR md5(actual.prosrc) IS DISTINCT FROM f.after_hash
      OR (to_jsonb(actual)-'prosrc') IS DISTINCT FROM f.metadata THEN
      RAISE EXCEPTION 'R09_WITHDRAWN_FINAL_POSTIMAGE_DRIFT:%',f.sig;
    END IF;
  END LOOP;
END $postflight$;
COMMIT;
