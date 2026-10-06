-- WPP02-A canonical preferences + common dispatch predicate.
-- SOURCE CANDIDATE ONLY. Not full AI/export/certificate admission; NEVER deploy alone.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $preflight$
begin
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='closure_assert_open'
   and pg_get_function_identity_arguments(p.oid)='a uuid, b uuid'
   and md5(p.prosrc)='dc9bc4c718593850da4fdb49e612dbd2'
   and p.prosecdef=true and p.provolatile='v'
   and p.proconfig is not distinct from '{search_path=pg_catalog}'::text[]
   and p.proacl::text is not distinct from '{postgres=X/postgres}'
   and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_PREIMAGE_DRIFT: %','private.closure_assert_open(a uuid, b uuid)' using errcode='PT409';
 end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='guard_profile_write'
   and pg_get_function_identity_arguments(p.oid)=''
   and md5(p.prosrc)='319fef6fe239a21ecf134476ed2b90a4'
   and p.prosecdef=true and p.provolatile='v'
   and p.proconfig is not distinct from '{search_path=pg_catalog}'::text[]
   and p.proacl::text is not distinct from '{postgres=X/postgres}'
   and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_PREIMAGE_DRIFT: %','private.guard_profile_write()' using errcode='PT409';
 end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='guard_wmp_write'
   and pg_get_function_identity_arguments(p.oid)=''
   and md5(p.prosrc)='cf2100141a25ab38a0dda85fcb51dc86'
   and p.prosecdef=true and p.provolatile='v'
   and p.proconfig is not distinct from '{search_path=pg_catalog}'::text[]
   and p.proacl::text is not distinct from '{postgres=X/postgres}'
   and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_PREIMAGE_DRIFT: %','private.guard_wmp_write()' using errcode='PT409';
 end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='guard_worker_fact_authority'
   and pg_get_function_identity_arguments(p.oid)=''
   and md5(p.prosrc)='a6be4e85f69592615e8c5b8272028d0d'
   and p.prosecdef=true and p.provolatile='v'
   and p.proconfig is not distinct from '{search_path=pg_catalog}'::text[]
   and p.proacl::text is not distinct from '{postgres=X/postgres}'
   and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_PREIMAGE_DRIFT: %','private.guard_worker_fact_authority()' using errcode='PT409';
 end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='guard_worker_preference_authority'
   and pg_get_function_identity_arguments(p.oid)=''
   and md5(p.prosrc)='71ca41ff8d3ae6ae5e6c5a8c149d95ab'
   and p.prosecdef=true and p.provolatile='v'
   and p.proconfig is not distinct from '{search_path=pg_catalog}'::text[]
   and p.proacl::text is not distinct from '{postgres=X/postgres}'
   and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_PREIMAGE_DRIFT: %','private.guard_worker_preference_authority()' using errcode='PT409';
 end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='match_detail_without_calendar'
   and pg_get_function_identity_arguments(p.oid)='nid uuid, pid uuid'
   and md5(p.prosrc)='ef5de901069c1a8cfa729cfb6bbadde9'
   and p.prosecdef=true and p.provolatile='s'
   and p.proconfig is not distinct from '{search_path=pg_catalog}'::text[]
   and p.proacl::text is not distinct from '{postgres=X/postgres}'
   and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_PREIMAGE_DRIFT: %','private.match_detail_without_calendar(nid uuid, pid uuid)' using errcode='PT409';
 end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='work_kinds_v5'
   and pg_get_function_identity_arguments(p.oid)='p_values text[]'
   and md5(p.prosrc)='78fca96231ddc713cf18990f5a2a34ef'
   and p.prosecdef=false and p.provolatile='s'
   and p.proconfig is not distinct from '{search_path=pg_catalog}'::text[]
   and p.proacl::text is not distinct from '{postgres=X/postgres}'
   and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_PREIMAGE_DRIFT: %','private.work_kinds_v5(p_values text[])' using errcode='PT409';
 end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='availability_is_future'
   and pg_get_function_identity_arguments(p.oid)='kind text, s timestamp with time zone, e timestamp with time zone, at_now timestamp with time zone'
   and md5(p.prosrc)='3a1aee763e9fe3d0f06d6ba04ef21aac'
   and p.prosecdef=false and p.provolatile='i'
   and p.proconfig is not distinct from '{search_path=pg_catalog}'::text[]
   and p.proacl::text is not distinct from '{postgres=X/postgres}'
   and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_PREIMAGE_DRIFT: %','private.availability_is_future(kind text, s timestamp with time zone, e timestamp with time zone, at_now timestamp with time zone)' using errcode='PT409';
 end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='closure_redaction_allowed_v5'
   and pg_get_function_identity_arguments(p.oid)='rel oid, op text, before_row jsonb, after_row jsonb'
   and md5(p.prosrc)='7fabcc71502e065e638364fc3d58b761'
   and p.prosecdef=true and p.provolatile='s'
   and p.proconfig is not distinct from '{search_path=pg_catalog}'::text[]
   and p.proacl::text is not distinct from '{postgres=X/postgres,service_role=X/postgres}'
   and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_PREIMAGE_DRIFT: %','private.closure_redaction_allowed_v5(rel oid, op text, before_row jsonb, after_row jsonb)' using errcode='PT409';
 end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='dispatch_cheap_candidate_admitted'
   and pg_get_function_identity_arguments(p.oid)='nid uuid, pid uuid'
   and md5(p.prosrc)='e51de37e0883fcd3cd4e6e3c42fb6ee1'
   and p.prosecdef=true and p.provolatile='s'
   and p.proconfig is not distinct from '{search_path=pg_catalog}'::text[]
   and p.proacl::text is not distinct from '{postgres=X/postgres}'
   and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_PREIMAGE_DRIFT: %','private.dispatch_cheap_candidate_admitted(nid uuid, pid uuid)' using errcode='PT409';
 end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='worker_dispatch_time_admitted'
   and pg_get_function_identity_arguments(p.oid)='nid uuid, pid uuid'
   and md5(p.prosrc)='4f0beb65922d2b3d947d69e68a56a956'
   and p.prosecdef=true and p.provolatile='s'
   and p.proconfig is not distinct from '{search_path=pg_catalog}'::text[]
   and p.proacl::text is not distinct from '{postgres=X/postgres}'
   and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_PREIMAGE_DRIFT: %','private.worker_dispatch_time_admitted(nid uuid, pid uuid)' using errcode='PT409';
 end if;
 if exists(select 1 from pg_attribute where attrelid='public.worker_match_preferences'::regclass
   and attname in ('desired_work_kinds','declined_work_kinds','work_notes','urgent_tasks_enabled') and not attisdropped) then
  raise exception 'WPP02_SCHEMA_ALREADY_CHANGED' using errcode='PT409';
 end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='private' and p.proname in ('worker_work_lists_valid_v2',
     'worker_work_preferences_document_v2','worker_work_preferences_replace_v2','worker_work_dispatch_blockers_v2')) then
  raise exception 'WPP02_HELPER_ALREADY_EXISTS' using errcode='PT409';
 end if;
end;
$preflight$;
do $schema_preflight$
begin
 if (select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
  from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid='public.worker_match_preferences'::regclass and a.attnum>0 and not a.attisdropped)
  is distinct from '[{"name": "worker_profile_id", "type": "uuid", "default": null, "notnull": true}, {"name": "worker_account_id", "type": "uuid", "default": null, "notnull": true}, {"name": "timezone", "type": "text", "default": "''Europe/Belgrade''::text", "notnull": true}, {"name": "approximate_lat", "type": "numeric(6,2)", "default": null, "notnull": false}, {"name": "approximate_lng", "type": "numeric(7,2)", "default": null, "notnull": false}, {"name": "approximate_geog", "type": "geography(Point,4326)", "default": "\nCASE\n    WHEN ((approximate_lat IS NOT NULL) AND (approximate_lng IS NOT NULL)) THEN (st_setsrid(st_makepoint((approximate_lng)::double precision, (approximate_lat)::double precision), 4326))::geography\n    ELSE NULL::geography\nEND", "notnull": false}, {"name": "proactive_notifications", "type": "boolean", "default": "true", "notnull": true}, {"name": "same_day_urgent_notifications", "type": "boolean", "default": "true", "notnull": true}, {"name": "buffer_minutes", "type": "integer", "default": "30", "notnull": true}, {"name": "created_at", "type": "timestamp with time zone", "default": "statement_timestamp()", "notnull": true}, {"name": "updated_at", "type": "timestamp with time zone", "default": "statement_timestamp()", "notnull": true}]'::jsonb then raise exception 'WPP02_COLUMNS_DRIFT' using errcode='PT409'; end if;
 if (select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)) order by conname)
  from pg_constraint where conrelid='public.worker_match_preferences'::regclass)
  is distinct from '[{"name": "wmp_lat_chk", "definition": "CHECK (((approximate_lat IS NULL) OR ((approximate_lat >= (''-90''::integer)::numeric) AND (approximate_lat <= (90)::numeric))))"}, {"name": "wmp_lng_chk", "definition": "CHECK (((approximate_lng IS NULL) OR ((approximate_lng >= (''-180''::integer)::numeric) AND (approximate_lng <= (180)::numeric))))"}, {"name": "worker_match_preferences_buffer_minutes_check", "definition": "CHECK (((buffer_minutes >= 0) AND (buffer_minutes <= 180)))"}, {"name": "worker_match_preferences_pkey", "definition": "PRIMARY KEY (worker_profile_id)"}, {"name": "worker_match_preferences_worker_account_id_fkey", "definition": "FOREIGN KEY (worker_account_id) REFERENCES auth.users(id) ON DELETE CASCADE"}, {"name": "worker_match_preferences_worker_profile_id_fkey", "definition": "FOREIGN KEY (worker_profile_id) REFERENCES app_profiles(id) ON DELETE CASCADE"}]'::jsonb then raise exception 'WPP02_CONSTRAINTS_DRIFT' using errcode='PT409'; end if;
 if (select jsonb_agg(jsonb_build_object('name',tgname,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by tgname)
  from pg_trigger where tgrelid='public.worker_match_preferences'::regclass and not tgisinternal)
  is distinct from '[{"name": "guard_wmp_write_trg", "enabled": "O", "definition": "CREATE TRIGGER guard_wmp_write_trg BEFORE INSERT OR UPDATE ON public.worker_match_preferences FOR EACH ROW EXECUTE FUNCTION private.guard_wmp_write()"}, {"name": "pre_v3_closure_worker_preferences", "enabled": "O", "definition": "CREATE TRIGGER pre_v3_closure_worker_preferences BEFORE INSERT OR DELETE OR UPDATE ON public.worker_match_preferences FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write(''PROFILE'', ''worker_profile_id'')"}, {"name": "pre_v3_worker_preference_authority", "enabled": "O", "definition": "CREATE TRIGGER pre_v3_worker_preference_authority BEFORE INSERT OR DELETE OR UPDATE ON public.worker_match_preferences FOR EACH ROW EXECUTE FUNCTION private.guard_worker_preference_authority()"}, {"name": "w02_availability_timezone", "enabled": "O", "definition": "CREATE TRIGGER w02_availability_timezone BEFORE INSERT OR UPDATE ON public.worker_match_preferences FOR EACH ROW EXECUTE FUNCTION private.guard_availability_timezone()"}, {"name": "wmp_updated_at", "enabled": "O", "definition": "CREATE TRIGGER wmp_updated_at BEFORE UPDATE ON public.worker_match_preferences FOR EACH ROW EXECUTE FUNCTION private.set_updated_at()"}]'::jsonb then raise exception 'WPP02_TRIGGERS_DRIFT' using errcode='PT409'; end if;
 if (select jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity,'acl',relacl::text,'owner',pg_get_userbyid(relowner))
  from pg_class where oid='public.worker_match_preferences'::regclass)
  is distinct from '{"acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}", "rls": true, "force": false, "owner": "postgres"}'::jsonb then raise exception 'WPP02_SECURITY_DRIFT' using errcode='PT409'; end if;
end;
$schema_preflight$;
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

CREATE OR REPLACE FUNCTION private.match_detail_without_calendar(nid uuid, pid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs; p public.app_profiles; pref public.worker_match_preferences;
  hard text[] := '{}'; disp text[] := '{}'; reasons text[] := '{}';
  tz text; local_day date;
  svc boolean; toolsok boolean; vehok boolean; expok boolean;
  sched boolean; dist numeric; radiusok boolean; feeok boolean;
  effective_radius numeric; exposure integer;
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

  svc := cardinality(n.required_skills) = 0
         or private.lower_arr(p.skills) && private.lower_arr(n.required_skills)
         -- PKG-031b (deep read 9.3): the same kind of work in other words ("Ciscenje stana" / "čišćenje stana").
         or private.work_kinds_v5(p.skills) && private.work_kinds_v5(n.required_skills);
  toolsok := private.lower_arr(p.tools) @> private.lower_arr(n.required_tools);
  -- WPP01: licenses no longer participate in admission or resource ranking.
  vehok := private.lower_arr(p.vehicles) @> private.lower_arr(n.required_vehicles);
  expok := coalesce(n.minimum_experience_years,0) = 0
           or coalesce(p.years_experience,0) >= n.minimum_experience_years;
  sched := private.worker_dispatch_time_admitted(nid,pid);
  effective_radius := private.effective_radius_km(p.radius_km);

  if n.execution_location_mode = 'REMOTE' then
    dist := null; radiusok := true;
  else
    dist := private.haversine_km(n.approximate_lat, n.approximate_lng,
                                 pref.approximate_lat, pref.approximate_lng);
    radiusok := case
      when dist is not null then dist <= effective_radius
      else btrim(coalesce(n.approximate_city,'')) <> ''
           and lower(coalesce(n.approximate_city,'')) = lower(coalesce(p.city,''))
    end;
  end if;

  feeok := n.mode = 'OFFERS'
           or coalesce(p.minimum_fee_rsd,0) = 0
           or (n.requester_price_rsd is not null and n.requester_price_rsd >= p.minimum_fee_rsd);

  -- TVRDE kapije: blokiraju i rucni odgovor, ne samo automatski dispatch.
  if p.profile_status <> 'ACTIVE' then hard := array_append(hard,'ACCOUNT_OR_PROFILE_RESTRICTED'); end if;
  if n.requester_account_id = p.account_id then hard := array_append(hard,'OWN_NEED'); end if;
  if n.verified_identity_required and not private.identity_admitted(p.account_id)
    then hard := array_append(hard,'IDENTITY_VERIFICATION_NOT_ADMITTED'); end if;
  if not toolsok then hard := array_append(hard,'MISSING_REQUIRED_TOOL'); end if;
  if not vehok  then hard := array_append(hard,'MISSING_REQUIRED_VEHICLE'); end if;
  if not expok  then hard := array_append(hard,'INSUFFICIENT_EXPERIENCE'); end if;
  if private.lower_arr(p.exclusions) && private.lower_arr(array_prepend(n.category, n.required_skills))
     -- PKG-031b (deep read 9.2/9.3): an exclusion holds for the same kind of work in any spelling
     -- ("selidbe" also keeps out "transport_selidbe").
     or private.work_kinds_v5(p.exclusions) && private.work_kinds_v5(array_prepend(n.category, n.required_skills))
    then hard := array_append(hard,'PROFILE_EXCLUSION'); end if;

  -- MEKE kapije: blokiraju samo automatsku isporuku. Rucno pretrazivanje ostaje otvoreno.
  if not coalesce(p.available_now,false)
    -- EX-06 ex06a: a TOMORROW_FLEXIBLE / WEEK_FLEXIBLE task stored without a window and published is matched against the window private.worker_dispatch_time_admitted derives for it,
    -- so it is future availability here too (W02: live intent off but a real weekly schedule is not paused for a future task). Live intent alone is still no availability.
    and not (private.availability_is_future(n.schedule_kind,n.starts_at,n.ends_at,statement_timestamp())
             or (n.starts_at is null and n.ends_at is null and n.published_at is not null
                 and n.schedule_kind in ('TOMORROW_FLEXIBLE','WEEK_FLEXIBLE')))
    then disp := array_append(disp,'CURRENT_AVAILABILITY_PAUSED'); end if;
  disp := disp || private.worker_work_dispatch_blockers_v2(n,pref,statement_timestamp());
  if not svc then disp := array_append(disp,'SERVICE_NOT_IN_WORK_PROFILE'); end if;
  if not sched then disp := array_append(disp,'OUTSIDE_AVAILABILITY'); end if;
  if not radiusok then disp := array_append(disp,'OUTSIDE_PREFERRED_RADIUS'); end if;
  if not feeok then disp := array_append(disp,'BELOW_MINIMUM_FEE'); end if;

  -- Bodovanje: donorove tezine 30/25/15/15/10/5.
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
  if toolsok and vehok then reasons := array_append(reasons,'RESOURCES_MATCH'); rs := 15; end if;

  rels := round(greatest(0, least(100, coalesce(p.rating_worker*20, 50)))/10, 1);
  select count(*) into exposure from public.opportunity_deliveries d
   where d.worker_account_id = p.account_id
     and d.created_at > statement_timestamp() - interval '7 days';
  fair := case when p.rating_worker is null then 5 else greatest(0, 5 - least(5, exposure)) end;
  if p.rating_worker is null then reasons := array_append(reasons,'NEWCOMER_FAIRNESS'); end if;

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
    'score', round(least(100, cap+ss+ds+rs+rels+fair), 1),
    'scoreComponents', jsonb_build_object(
      'capability', cap, 'schedule', ss, 'distanceToStart', ds,
      'resources', rs, 'reliability', rels, 'fairness', fair)
  );
end;
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
      and private.worker_dispatch_time_admitted(nid,pid)
      and p.account_id <> n.requester_account_id
      and private.accounts_same_world(n.requester_account_id, p.account_id)
      and cardinality(private.worker_work_dispatch_blockers_v2(n,pref,statement_timestamp()))=0
      and (not n.verified_identity_required or private.identity_admitted(p.account_id))
      and (cardinality(n.required_skills) = 0
           or private.lower_arr(p.skills) && private.lower_arr(n.required_skills)
           or private.work_kinds_v5(p.skills) && private.work_kinds_v5(n.required_skills))
      -- WPP01: licenses are retired from task eligibility; historical arrays remain stored.
      and private.lower_arr(p.tools) @> private.lower_arr(n.required_tools)
      and private.lower_arr(p.vehicles) @> private.lower_arr(n.required_vehicles)
      and (coalesce(n.minimum_experience_years,0) = 0
           or coalesce(p.years_experience,0) >= n.minimum_experience_years)
      and not (private.lower_arr(p.exclusions)
               && private.lower_arr(array_prepend(n.category, n.required_skills))
               or private.work_kinds_v5(p.exclusions)
               && private.work_kinds_v5(array_prepend(n.category, n.required_skills)))
      and (n.mode = 'OFFERS' or coalesce(p.minimum_fee_rsd,0) = 0
           or (n.requester_price_rsd is not null and n.requester_price_rsd >= p.minimum_fee_rsd))
      and not exists (
        select 1 from public.opportunity_deliveries od
        where od.worker_account_id = p.account_id
          and od.need_id = n.id
          and od.need_revision = n.revision)
  );
$function$;

CREATE OR REPLACE FUNCTION private.guard_worker_preference_authority()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare token text:=nullif(current_setting('uskoci.profile_mutation',true),'');
begin
 if auth.role()='service_role' then
  if TG_OP in ('UPDATE','DELETE') and private.closure_redaction_allowed_v5(TG_RELID,TG_OP,to_jsonb(OLD),case when TG_OP='UPDATE' then to_jsonb(NEW) else null end) then
   if TG_OP='DELETE' then return OLD;end if;return NEW;
  end if;
 end if;

  if auth.role() is distinct from 'authenticated' then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' then
    raise exception 'WORKER_PREFERENCES_REQUIRE_AUTHORITY' using errcode='42501';
  end if;
  -- WPP02-A: existing location/availability tokens cannot edit work choices.
  if tg_op='INSERT' then
    if (cardinality(new.desired_work_kinds)>0 or cardinality(new.declined_work_kinds)>0
        or cardinality(new.work_notes)>0 or new.urgent_tasks_enabled is not null
        or new.proactive_notifications is distinct from true)
       and token is distinct from 'WORK_PREFERENCES_REVIEW_V2' then
      raise exception 'WORKER_PREFERENCES_REQUIRE_REVIEW' using errcode='42501';
    end if;
  elsif (new.desired_work_kinds is distinct from old.desired_work_kinds
      or new.declined_work_kinds is distinct from old.declined_work_kinds
      or new.work_notes is distinct from old.work_notes
      or new.urgent_tasks_enabled is distinct from old.urgent_tasks_enabled
      or new.proactive_notifications is distinct from old.proactive_notifications)
     and token is distinct from 'WORK_PREFERENCES_REVIEW_V2' then
    raise exception 'WORKER_PREFERENCES_REQUIRE_REVIEW' using errcode='42501';
  end if;
  if tg_op='INSERT' then
    if (new.approximate_lat is not null or new.approximate_lng is not null) and token is distinct from 'LOCATION_REVIEW' then
      raise exception 'PROFILE_LOCATION_REQUIRES_REVIEW' using errcode='42501';
    end if;
    if new.timezone<>'Europe/Belgrade' and token is distinct from 'AVAILABILITY_REVIEW' then
      raise exception 'PROFILE_AVAILABILITY_REQUIRES_REVIEW' using errcode='42501';
    end if;
  else
    if (new.approximate_lat is distinct from old.approximate_lat or new.approximate_lng is distinct from old.approximate_lng)
       and token is distinct from 'LOCATION_REVIEW' then
      raise exception 'PROFILE_LOCATION_REQUIRES_REVIEW' using errcode='42501';
    end if;
    if new.timezone is distinct from old.timezone and token is distinct from 'AVAILABILITY_REVIEW' then
      raise exception 'PROFILE_AVAILABILITY_REQUIRES_REVIEW' using errcode='42501';
    end if;
  end if;
  return new;
end;
$function$;

commit;
