-- WPP02-A canonical preferences + common dispatch predicate.
-- SOURCE CANDIDATE ONLY. Not full AI/export/certificate admission; NEVER deploy alone.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
 -- Compatible pause; retained values are not deleted.
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
    and md5(p.prosrc)='7b62a865236daa774a27f62a9cdd632b'
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
    and md5(p.prosrc)='39bdf121c70382791f932c04dd86ac6e'
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
declare result text[]:='{}'; tz text;
begin
 if not coalesce(pref.proactive_notifications,true) then
  result:=array_append(result,'PROACTIVE_NOTIFICATIONS_PAUSED');
 end if;
 if cardinality(coalesce(pref.desired_work_kinds,'{}'::text[]))>0
   or cardinality(coalesce(pref.declined_work_kinds,'{}'::text[]))>0
   or pref.urgent_tasks_enabled is not null then
  return array_append(result,'WORKER_PREFERENCES_V2_PAUSED');
 end if;
 tz:=coalesce(nullif(pref.timezone,''),'Europe/Belgrade');
 if n.urgent and (n.schedule_kind='TODAY_FLEXIBLE'
     or (n.starts_at is not null and (n.starts_at at time zone tz)::date=(at_time at time zone tz)::date))
   and not coalesce(pref.same_day_urgent_notifications,true) then
  result:=array_append(result,'SAME_DAY_URGENT_NOTIFICATIONS_PAUSED');
 end if;
 return result;
end;
$function$;
create or replace function private.worker_work_preferences_replace_v2(
 aid uuid,pid uuid,expected jsonb,wanted jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $function$
begin
 raise exception 'WORKER_PREFERENCES_V2_PAUSED' using errcode='PT409';
end;
$function$;
commit;
