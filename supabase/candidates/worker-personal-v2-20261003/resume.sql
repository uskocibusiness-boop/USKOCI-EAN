-- WPP02-A canonical preferences + common dispatch predicate.
-- SOURCE CANDIDATE ONLY. Not full AI/export/certificate admission; NEVER deploy alone.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
 -- Resume only exact compatible-pause bodies; not a fresh installation.
do $preflight$
begin
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='match_detail_without_calendar'
   and pg_get_function_identity_arguments(p.oid)='nid uuid, pid uuid'
   and md5(p.prosrc)='0f081c20abf7cde1d629d13110ea5c0c'
   and p.prosecdef=true and p.provolatile='s'
   and p.proconfig is not distinct from '{search_path=pg_catalog}'::text[]
   and p.proacl::text is not distinct from '{postgres=X/postgres}'
   and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_PREIMAGE_DRIFT: %','private.match_detail_without_calendar(nid uuid, pid uuid)' using errcode='PT409';
 end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='dispatch_cheap_candidate_admitted'
   and pg_get_function_identity_arguments(p.oid)='nid uuid, pid uuid'
   and md5(p.prosrc)='f23e00c1e35a8367288de4f0b8548f6b'
   and p.prosecdef=true and p.provolatile='s'
   and p.proconfig is not distinct from '{search_path=pg_catalog}'::text[]
   and p.proacl::text is not distinct from '{postgres=X/postgres}'
   and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_PREIMAGE_DRIFT: %','private.dispatch_cheap_candidate_admitted(nid uuid, pid uuid)' using errcode='PT409';
 end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='guard_worker_preference_authority'
   and pg_get_function_identity_arguments(p.oid)=''
   and md5(p.prosrc)='315312470b38df077c213db0a85ba027'
   and p.prosecdef=true and p.provolatile='v'
   and p.proconfig is not distinct from '{search_path=pg_catalog}'::text[]
   and p.proacl::text is not distinct from '{postgres=X/postgres}'
   and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_PREIMAGE_DRIFT: %','private.guard_worker_preference_authority()' using errcode='PT409';
 end if;
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname='worker_work_lists_valid_v2')<>1
  or not exists(select 1 from pg_proc p
   where p.oid=to_regprocedure('private.worker_work_lists_valid_v2(text[],text[],text[])')
    and md5(p.prosrc)='3ddd659862965293103248cbb9fecc14'
    and p.proargnames='{desired,declined,notes}'::text[]
    and p.prosecdef=false and p.provolatile='i'
    and not p.proisstrict and not p.proleakproof and not p.proretset and p.prokind='f'
    and p.pronargdefaults=0 and p.proargmodes is null and p.proparallel='u'
    and p.proconfig=array['search_path=pg_catalog']::text[]
    and p.proacl::text='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_POSTIMAGE_DRIFT: %','private.worker_work_lists_valid_v2' using errcode='PT409';
 end if;
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname='worker_work_preferences_document_v2')<>1
  or not exists(select 1 from pg_proc p
   where p.oid=to_regprocedure('private.worker_work_preferences_document_v2(uuid)')
    and md5(p.prosrc)='ffee305ac69b8c0e73f7a87f6f6c4f14'
    and p.proargnames='{pid}'::text[]
    and p.prosecdef=true and p.provolatile='s'
    and not p.proisstrict and not p.proleakproof and not p.proretset and p.prokind='f'
    and p.pronargdefaults=0 and p.proargmodes is null and p.proparallel='u'
    and p.proconfig=array['search_path=pg_catalog']::text[]
    and p.proacl::text='{postgres=X/postgres}' and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_POSTIMAGE_DRIFT: %','private.worker_work_preferences_document_v2' using errcode='PT409';
 end if;
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname='worker_work_preferences_replace_v2')<>1
  or not exists(select 1 from pg_proc p
   where p.oid=to_regprocedure('private.worker_work_preferences_replace_v2(uuid,uuid,jsonb,jsonb)')
    and md5(p.prosrc)='4d070eff8fd56d677f06f9addfc76c62'
    and p.proargnames='{aid,pid,expected,wanted}'::text[]
    and p.prosecdef=true and p.provolatile='v'
    and not p.proisstrict and not p.proleakproof and not p.proretset and p.prokind='f'
    and p.pronargdefaults=0 and p.proargmodes is null and p.proparallel='u'
    and p.proconfig=array['search_path=pg_catalog']::text[]
    and p.proacl::text='{postgres=X/postgres}' and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_POSTIMAGE_DRIFT: %','private.worker_work_preferences_replace_v2' using errcode='PT409';
 end if;
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname='worker_work_dispatch_blockers_v2')<>1
  or not exists(select 1 from pg_proc p
   where p.oid=to_regprocedure('private.worker_work_dispatch_blockers_v2(public.needs,public.worker_match_preferences,timestamp with time zone)')
    and md5(p.prosrc)='c1f8645435ce8a6caa083f0774f88fed'
    and p.proargnames='{n,pref,at_time}'::text[]
    and p.prosecdef=false and p.provolatile='s'
    and not p.proisstrict and not p.proleakproof and not p.proretset and p.prokind='f'
    and p.pronargdefaults=0 and p.proargmodes is null and p.proparallel='u'
    and p.proconfig=array['search_path=pg_catalog']::text[]
    and p.proacl::text='{postgres=X/postgres}' and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_POSTIMAGE_DRIFT: %','private.worker_work_dispatch_blockers_v2' using errcode='PT409';
 end if;
end;
$preflight$;
create or replace function private.worker_work_dispatch_blockers_v2(
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
create or replace function private.worker_work_preferences_replace_v2(
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
commit;
