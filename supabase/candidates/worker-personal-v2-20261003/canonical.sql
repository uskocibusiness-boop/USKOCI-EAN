-- WPP02-A SOURCE CANDIDATE. No client/AI/export/certificate activation.
-- Included only after exact baseline checks inside candidate.sql.
alter table public.worker_match_preferences
  add column desired_work_kinds text[] not null default '{}',
  add column declined_work_kinds text[] not null default '{}',
  add column work_notes text[] not null default '{}',
  add column urgent_tasks_enabled boolean;

create function private.worker_work_lists_valid_v2(desired text[], declined text[], notes text[])
returns boolean language sql immutable set search_path=pg_catalog as $function$
  select desired is not null and declined is not null and notes is not null
    and coalesce(array_ndims(desired),1)=1 and coalesce(array_ndims(declined),1)=1
    and coalesce(array_ndims(notes),1)=1
    and cardinality(desired)<=11 and cardinality(declined)<=11 and cardinality(notes)<=20
    and array_position(desired,null) is null and array_position(declined,null) is null
    and array_position(notes,null) is null
    and desired <@ array['SELIDBE_PREVOZ','FIZICKI_POSLOVI','MONTAZA_NAMESTAJA','SITNE_POPRAVKE','MOLERSKI_RADOVI','ELEKTRO','VODOINSTALATER','CISCENJE','PRANJE_PEGLANJE','BASTA_DVORISTE','DOSTAVA']::text[]
    and declined <@ array['SELIDBE_PREVOZ','FIZICKI_POSLOVI','MONTAZA_NAMESTAJA','SITNE_POPRAVKE','MOLERSKI_RADOVI','ELEKTRO','VODOINSTALATER','CISCENJE','PRANJE_PEGLANJE','BASTA_DVORISTE','DOSTAVA']::text[]
    and cardinality(desired)=(select count(distinct x) from unnest(desired) x)
    and cardinality(declined)=(select count(distinct x) from unnest(declined) x)
    and cardinality(notes)=(select count(distinct x) from unnest(notes) x)
    and not exists(select 1 from unnest(notes) x where length(x)>500 or x !~ '[^[:space:]]')
$function$;

alter table public.worker_match_preferences add constraint worker_work_lists_v2_check
 check (private.worker_work_lists_valid_v2(desired_work_kinds,declined_work_kinds,work_notes));

-- Pure validation can run in an existing direct table check. It reads no rows.
revoke all on function private.worker_work_lists_valid_v2(text[],text[],text[]) from public,anon,authenticated,service_role;
grant execute on function private.worker_work_lists_valid_v2(text[],text[],text[]) to authenticated,service_role;

create function private.worker_work_preferences_document_v2(pid uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog as $function$
 select jsonb_build_object(
   'exists',p.worker_profile_id is not null,
   'updatedAt',to_char(p.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'desiredWorkKinds',coalesce(p.desired_work_kinds,'{}'::text[]),
   'declinedWorkKinds',coalesce(p.declined_work_kinds,'{}'::text[]),
   'workNotes',coalesce(p.work_notes,'{}'::text[]),
   'proactiveNotifications',coalesce(p.proactive_notifications,true),
   'urgentTasksEnabled',p.urgent_tasks_enabled)
 from (select 1) seed left join public.worker_match_preferences p on p.worker_profile_id=pid
$function$;
revoke all on function private.worker_work_preferences_document_v2(uuid) from public,anon,authenticated,service_role;

-- Internal primitive only: no public RPC/activation. The future full review writer
-- must additionally bind AI version, source hash, registry, notifications and receipt.
create function private.worker_work_preferences_replace_v2(
 aid uuid,pid uuid,expected jsonb,wanted jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $function$
declare current_doc jsonb; desired text[]; declined text[]; notes text[]; p public.app_profiles;
 prior_token text; had_row boolean; k text; item jsonb;
 keys constant text[]:=array['desiredWorkKinds','declinedWorkKinds','workNotes','proactiveNotifications','urgentTasksEnabled'];
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if aid is distinct from auth.uid() then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000'; end if;
 -- Account closure/erasure takes its exclusive advisory lock before profile rows.
 -- Match that order: closure shared lock -> owned profile -> preferences.
 perform private.closure_assert_open(aid);
 if jsonb_typeof(wanted) is distinct from 'object' or not (wanted ?& keys)
    or exists(select 1 from jsonb_object_keys(wanted) x where not(x=any(keys))) then
  raise exception 'WORKER_V2_INVALID' using errcode='22023';
 end if;
 foreach k in array array['desiredWorkKinds','declinedWorkKinds','workNotes'] loop
  if jsonb_typeof(wanted->k) is distinct from 'array' then raise exception 'WORKER_V2_INVALID' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(wanted->k) loop
   if jsonb_typeof(item) is distinct from 'string' then raise exception 'WORKER_V2_INVALID' using errcode='22023'; end if;
  end loop;
 end loop;
 if jsonb_typeof(wanted->'proactiveNotifications') is distinct from 'boolean'
   or jsonb_typeof(wanted->'urgentTasksEnabled') not in ('boolean','null') then
  raise exception 'WORKER_V2_INVALID' using errcode='22023';
 end if;
 select coalesce(array_agg(value),'{}') into desired from jsonb_array_elements_text(wanted->'desiredWorkKinds');
 select coalesce(array_agg(value),'{}') into declined from jsonb_array_elements_text(wanted->'declinedWorkKinds');
 select coalesce(array_agg(value),'{}') into notes from jsonb_array_elements_text(wanted->'workNotes');
 if not private.worker_work_lists_valid_v2(desired,declined,notes) then
  raise exception 'WORKER_V2_INVALID' using errcode='22023';
 end if;
 -- Same profile-first order as existing location/availability writers. Also
 -- serializes first preference insertion when this row does not yet exist.
 select * into p from public.app_profiles where id=pid and account_id=aid and kind='WORKER' for update;
 if not found then raise exception 'WORKER_PROFILE_NOT_OWNED' using errcode='42501'; end if;
 if p.profile_status not in ('DRAFT','ACTIVE') then
  raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='55000';
 end if;
 perform 1 from public.worker_match_preferences where worker_profile_id=pid for update;
 had_row:=found;
 current_doc:=private.worker_work_preferences_document_v2(pid);
 if expected is distinct from current_doc then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 if current_doc-'exists'-'updatedAt'=wanted then return current_doc; end if;
 prior_token:=current_setting('uskoci.profile_mutation',true);
 perform set_config('uskoci.profile_mutation','WORK_PREFERENCES_REVIEW_V2',true);
 if had_row then
  update public.worker_match_preferences set
   desired_work_kinds=desired,declined_work_kinds=declined,work_notes=notes,
   proactive_notifications=(wanted->>'proactiveNotifications')::boolean,
   urgent_tasks_enabled=(wanted->>'urgentTasksEnabled')::boolean
  where worker_profile_id=pid;
 else
  insert into public.worker_match_preferences(worker_profile_id,worker_account_id,
    desired_work_kinds,declined_work_kinds,work_notes,proactive_notifications,urgent_tasks_enabled)
   values(pid,aid,desired,declined,notes,(wanted->>'proactiveNotifications')::boolean,
    (wanted->>'urgentTasksEnabled')::boolean)
   on conflict(worker_profile_id) do nothing;
  if not found then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 end if;
 perform set_config('uskoci.profile_mutation',coalesce(prior_token,''),true);
 return private.worker_work_preferences_document_v2(pid);
end;
$function$;
revoke all on function private.worker_work_preferences_replace_v2(uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

-- One dispatch-only authority shared by detailed and cheap candidates.
-- work_notes never participates. This helper never changes manual eligibility.
create function private.worker_work_dispatch_blockers_v2(
 n public.needs,pref public.worker_match_preferences,at_time timestamptz)
returns text[] language plpgsql stable set search_path=pg_catalog as $function$
declare result text[]:='{}'; task_kinds text[]; tz text;
begin
 if not coalesce(pref.proactive_notifications,true) then
  result:=array_append(result,'PROACTIVE_NOTIFICATIONS_PAUSED');
 end if;
 task_kinds:=private.work_kinds_v5(array_prepend(n.category,n.required_skills));
 if task_kinds && coalesce(pref.declined_work_kinds,'{}'::text[]) then
  result:=array_append(result,'DECLINED_WORK_KIND');
 end if;
 if cardinality(coalesce(pref.desired_work_kinds,'{}'::text[]))>0
    and not(task_kinds && pref.desired_work_kinds) then
  result:=array_append(result,'OUTSIDE_DESIRED_WORK_KINDS');
 end if;
 if n.urgent then
  if pref.urgent_tasks_enabled is false then
   result:=array_append(result,'URGENT_TASKS_PAUSED');
  elsif pref.urgent_tasks_enabled is null then
   tz:=coalesce(nullif(pref.timezone,''),'Europe/Belgrade');
   if (n.schedule_kind='TODAY_FLEXIBLE'
       or (n.starts_at is not null and (n.starts_at at time zone tz)::date=(at_time at time zone tz)::date))
      and not coalesce(pref.same_day_urgent_notifications,true) then
    result:=array_append(result,'SAME_DAY_URGENT_NOTIFICATIONS_PAUSED');
   end if;
  end if;
 end if;
 return result;
end;
$function$;
revoke all on function private.worker_work_dispatch_blockers_v2(public.needs,public.worker_match_preferences,timestamptz) from public,anon,authenticated,service_role;
