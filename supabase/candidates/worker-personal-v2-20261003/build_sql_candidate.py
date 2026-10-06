"""Reproducible WPP02-A candidate, not full V2 activation/admission."""
import argparse, hashlib, json, pathlib, re, difflib
HERE=pathlib.Path(__file__).resolve().parent
rows=json.loads((HERE/'evidence/sql-baseline-functions.json').read_text(encoding='utf-8'))
by_name={r['signature'].split('(')[0]:r for r in rows}
md5=lambda s:hashlib.md5(s.encode()).hexdigest()
sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
quote=lambda s:"'"+s.replace("'","''")+"'"
for r in rows: assert md5(r['body'])==r['body_md5'],r['signature']
detailed=by_name['private.match_detail_without_calendar']
cheap=by_name['private.dispatch_cheap_candidate_admitted']
guard=by_name['private.guard_worker_preference_authority']
old="""  if not coalesce(pref.proactive_notifications,true) then disp := array_append(disp,'PROACTIVE_NOTIFICATIONS_PAUSED'); end if;
  if n.urgent
     and (n.schedule_kind = 'TODAY_FLEXIBLE'
          or (n.starts_at is not null and (n.starts_at at time zone tz)::date = (statement_timestamp() at time zone tz)::date))
     and not coalesce(pref.same_day_urgent_notifications,true)
    then disp := array_append(disp,'SAME_DAY_URGENT_NOTIFICATIONS_PAUSED'); end if;"""
assert detailed['body'].count(old)==1
new_detailed=detailed['body'].replace(old,"  disp := disp || private.worker_work_dispatch_blockers_v2(n,pref,statement_timestamp());")
oldcheap="      and coalesce(pref.proactive_notifications, true) = true"
assert cheap['body'].count(oldcheap)==1
new_cheap=cheap['body'].replace(oldcheap,"      and cardinality(private.worker_work_dispatch_blockers_v2(n,pref,statement_timestamp()))=0")
guard_anchor="  if tg_op='INSERT' then\n"
assert guard['body'].count(guard_anchor)==1
guard_extra="""  -- WPP02-A: existing location/availability tokens cannot edit work choices.
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
"""
new_guard=guard['body'].replace(guard_anchor,guard_extra+guard_anchor)
patches=[(detailed,new_detailed),(cheap,new_cheap),(guard,new_guard)]
canonical=(HERE/'canonical.sql').read_text(encoding='utf-8')
definitions=re.findall(r'(create function (private\.[a-z0-9_]+)[\s\S]*?\$function\$;)',canonical)
new_defs={name:definition for definition,name in definitions}
schema=json.loads((HERE/'evidence/sql-baseline-schema.json').read_text(encoding='utf-8'))
def body_of(definition):
 return definition.split('$function$')[1]
def replace_body(row,body):
 assert row['definition'].count(row['body'])==1
 return row['definition'].replace(row['body'],body).rstrip()+';\n'
def check_pin(row,wanted):
 schema,name=row['signature'].split('(',1)[0].split('.')
 args=row['signature'].split('(',1)[1][:-1]
 return f""" if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname={quote(schema)} and p.proname={quote(name)}
   and pg_get_function_identity_arguments(p.oid)={quote(args)}
   and md5(p.prosrc)={quote(wanted)}
   and p.prosecdef={str(row['security_definer']).lower()} and p.provolatile={quote(row['volatility'])}
   and p.proconfig is not distinct from {quote('{'+','.join(row['config'] or [])+'}')}::text[]
   and p.proacl::text is not distinct from {quote(row['acl'])}
   and pg_get_userbyid(p.proowner)={quote(row['owner'])}) then
  raise exception 'WPP02_PREIMAGE_DRIFT: %',{quote(row['signature'])} using errcode='PT409';
 end if;"""
header="""-- WPP02-A canonical preferences + common dispatch predicate.
-- SOURCE CANDIDATE ONLY. Not full AI/export/certificate admission; NEVER deploy alone.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
"""
pre="""do $preflight$
begin
"""+'\n'.join(check_pin(r,r['body_md5']) for r in rows)+"""
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
"""
schema_check="""do $schema_preflight$
begin
 if (select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
  from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid='public.worker_match_preferences'::regclass and a.attnum>0 and not a.attisdropped)
  is distinct from COLUMNS then raise exception 'WPP02_COLUMNS_DRIFT' using errcode='PT409'; end if;
 if (select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)) order by conname)
  from pg_constraint where conrelid='public.worker_match_preferences'::regclass)
  is distinct from CONSTRAINTS then raise exception 'WPP02_CONSTRAINTS_DRIFT' using errcode='PT409'; end if;
 if (select jsonb_agg(jsonb_build_object('name',tgname,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by tgname)
  from pg_trigger where tgrelid='public.worker_match_preferences'::regclass and not tgisinternal)
  is distinct from TRIGGERS then raise exception 'WPP02_TRIGGERS_DRIFT' using errcode='PT409'; end if;
 if (select jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity,'acl',relacl::text,'owner',pg_get_userbyid(relowner))
  from pg_class where oid='public.worker_match_preferences'::regclass)
  is distinct from SECURITY then raise exception 'WPP02_SECURITY_DRIFT' using errcode='PT409'; end if;
end;
$schema_preflight$;
"""
for label in ['COLUMNS','CONSTRAINTS','TRIGGERS','SECURITY']:
 schema_check=schema_check.replace('from '+label,'from '+quote(json.dumps(schema[label.lower()],ensure_ascii=False))+'::jsonb')
after='\n'.join(replace_body(r,b) for r,b in patches)
candidate=header+pre+schema_check+canonical+'\n'+after+'\ncommit;\n'
diff=''.join(''.join(difflib.unified_diff(r['body'].splitlines(True),b.splitlines(True),fromfile=r['signature']+' before',tofile=r['signature']+' after')) for r,b in patches)
# Compatible rollback never drops data and never resumes jobs that a new filter
# had excluded. Stop internal writes and fail closed automatic V2 selection;
# leave manual eligibility, readback and future export values intact.
rollback_helper="""\ndeclare result text[]:='{}'; tz text;\nbegin\n if not coalesce(pref.proactive_notifications,true) then\n  result:=array_append(result,'PROACTIVE_NOTIFICATIONS_PAUSED');\n end if;\n if cardinality(coalesce(pref.desired_work_kinds,'{}'::text[]))>0\n   or cardinality(coalesce(pref.declined_work_kinds,'{}'::text[]))>0\n   or pref.urgent_tasks_enabled is not null then\n  return array_append(result,'WORKER_PREFERENCES_V2_PAUSED');\n end if;\n tz:=coalesce(nullif(pref.timezone,''),'Europe/Belgrade');\n if n.urgent and (n.schedule_kind='TODAY_FLEXIBLE'\n     or (n.starts_at is not null and (n.starts_at at time zone tz)::date=(at_time at time zone tz)::date))\n   and not coalesce(pref.same_day_urgent_notifications,true) then\n  result:=array_append(result,'SAME_DAY_URGENT_NOTIFICATIONS_PAUSED');\n end if;\n return result;\nend;\n"""
rollback_writer="""\nbegin\n raise exception 'WORKER_PREFERENCES_V2_PAUSED' using errcode='PT409';\nend;\n"""
rollbacks={'private.worker_work_dispatch_blockers_v2':rollback_helper,
 'private.worker_work_preferences_replace_v2':rollback_writer}
new_metadata={
 'private.worker_work_lists_valid_v2':{'args':'text[],text[],text[]','argnames':'{desired,declined,notes}','security':False,'volatility':'i','acl':'{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'},
 'private.worker_work_preferences_document_v2':{'args':'uuid','argnames':'{pid}','security':True,'volatility':'s','acl':'{postgres=X/postgres}'},
 'private.worker_work_preferences_replace_v2':{'args':'uuid,uuid,jsonb,jsonb','argnames':'{aid,pid,expected,wanted}','security':True,'volatility':'v','acl':'{postgres=X/postgres}'},
 'private.worker_work_dispatch_blockers_v2':{'args':'public.needs,public.worker_match_preferences,timestamp with time zone','argnames':'{n,pref,at_time}','security':False,'volatility':'s','acl':'{postgres=X/postgres}'}}
def new_check(name,body):
 meta=new_metadata[name]
 return f""" if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname={quote(name.split('.')[1])})<>1
  or not exists(select 1 from pg_proc p
   where p.oid=to_regprocedure({quote(name+'('+meta['args']+')')})
    and md5(p.prosrc)={quote(md5(body))}
    and p.proargnames={quote(meta['argnames'])}::text[]
    and p.prosecdef={str(meta['security']).lower()} and p.provolatile={quote(meta['volatility'])}
    and not p.proisstrict and not p.proleakproof and not p.proretset and p.prokind='f'
    and p.pronargdefaults=0 and p.proargmodes is null and p.proparallel='u'
    and p.proconfig=array['search_path=pg_catalog']::text[]
    and p.proacl::text={quote(meta['acl'])} and pg_get_userbyid(p.proowner)='postgres') then
  raise exception 'WPP02_POSTIMAGE_DRIFT: %',{quote(name)} using errcode='PT409';
 end if;"""
def transition(to_rollback):
 checks='\n'.join(check_pin(r,md5(b)) for r,b in patches)
 for name,definition in new_defs.items():
  expected=rollbacks[name] if not to_rollback and name in rollbacks else body_of(definition)
  checks+='\n'+new_check(name,expected)
 statements=[]
 for name,body in rollbacks.items():
  definition=new_defs[name]
  desired=body if to_rollback else body_of(definition)
  statements.append(definition.replace('create function','create or replace function',1).replace(body_of(definition),desired))
 return header+(" -- Compatible pause; retained values are not deleted.\n" if to_rollback else " -- Resume only exact compatible-pause bodies; not a fresh installation.\n")+\
  'do $preflight$\nbegin\n'+checks+'\nend;\n$preflight$;\n'+'\n'.join(statements)+'\ncommit;\n'
manifest={'id':'WPP02-A','status':'IMPLEMENTED_SOURCE_CANDIDATE_NOT_DEPLOY_READY',
 'liveApplied':False,'scope':'Canonical preferences, private write primitive, common dispatch predicate. Full AI/export/certificate/client remain separate.',
 'baselineObservedAt':json.loads((HERE/'evidence/sql-baseline-schema.json').read_text())['observed_at'],
 'functions':[{'signature':r['signature'],'before_md5':r['body_md5'],'after_md5':md5(b)} for r,b in patches],
 'dependencies':[{'signature':r['signature'],'body_md5':r['body_md5']} for r in rows if r not in [p[0] for p in patches]],
 'newFunctions':[{'name':n,'body_md5':md5(body_of(d)),'rollback_md5':md5(rollbacks[n]) if n in rollbacks else None,**new_metadata[n]} for n,d in new_defs.items()],
 'remaining':['Full versioned atomic AI review/save + notifications','Export projection + existing missing policy binding','Closure/certificate admission','V1/V2 client and Edge rollout'],
 'runtimeProof':'PREPARED_NOT_RUN'}
files={'candidate.sql':candidate,'compatible-rollback.sql':transition(True),'resume.sql':transition(False),'body.diff':diff}
manifest['artifact_sha256']={name:sha(content) for name,content in files.items()}
files['sql-manifest.json']=json.dumps(manifest,indent=2)+'\n'
parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
for name,content in files.items():
 if args.check: assert (HERE/name).read_bytes()==content.encode(),('GENERATED_DRIFT',name)
 else: (HERE/name).write_bytes(content.encode())
print('PASS WPP02 generated exact three existing function changes and four new helpers; '+('checked' if args.check else 'written'))
