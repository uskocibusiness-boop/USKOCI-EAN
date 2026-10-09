"""Rollback-only local SQL behavior proof. No HTTP/provider or promotion proof.

Requires the post-single-target business schema in a disposable loopback database.
Credentials come from normal libpq environment/pgpass, never source or receipts.
"""
import argparse, hashlib, json, os, re, subprocess, sys, uuid
from pathlib import Path
from datetime import datetime, timezone

if not __debug__:
    raise SystemExit('Optimized Python is forbidden: proof assertions must remain enabled.')

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--psql',default='psql')
parser.add_argument('--port',required=True,type=int)
parser.add_argument('--database',required=True)
parser.add_argument('--output',required=True,type=Path)
parser.add_argument('--confirm-disposable',required=True,choices=['PUSH_OPPORTUNITY_LOCAL_ONLY'])
args=parser.parse_args()
if not re.fullmatch(r'uskoci_(proof_[a-z0-9_]+|plan_cache_[0-9]{8})',args.database):
    parser.error('Only an explicitly named local QA database is accepted.')
if not 1024<=args.port<=65535:
    parser.error('Explicit non-system loopback port required.')
env={k:v for k,v in os.environ.items() if not k.startswith('PG') or k in ('PGPASSWORD','PGPASSFILE')}
env.update(PGCLIENTENCODING='UTF8',PGCONNECT_TIMEOUT='5')

class LocalPSQL:
    PORT=str(args.port)
    @staticmethod
    def psql(statement,db,name,check=True):
        assert db==args.database
        result=subprocess.run([args.psql,'-X','-w','-q','-h','127.0.0.1','-p',str(args.port),
            '-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-A','-t'],
            input=("set timezone='UTC';\n"+statement).encode('utf-8'),env=env,
            capture_output=True,timeout=180)
        if check and result.returncode:
            # Output is a private local directory; never retain connection environment.
            (args.output/(name+'.stderr.log')).write_bytes(result.stderr)
            raise RuntimeError(name+': psql failed; diagnostic saved in output directory.')
        return result

p=LocalPSQL()
db=args.database
root=args.output.resolve()
root.mkdir(parents=True,exist_ok=True)
repo=Path(__file__).resolve().parents[3]
package=Path(__file__).resolve().parent
manifest=json.loads((package/'manifest.json').read_text(encoding='utf-8'))
for filename,key in [('candidate.rollback.sql','candidateSha256'),('baseline.json','baselineSha256')]:
    assert hashlib.sha256((package/filename).read_bytes()).hexdigest()==manifest[key],filename
assert manifest['state']=='CANDIDATE_ONLY_NOT_PROMOTABLE'
preflight=json.loads(p.psql("select jsonb_build_object('host',inet_server_addr(),'port',inet_server_port(),'database',current_database(),'user',session_user)::text",db=db,name='preflight').stdout)
assert preflight=={'host':'127.0.0.1','port':args.port,'database':db,'user':'postgres'},'LOCAL_TARGET_MISMATCH'

def require_rollback_wrapper(statement):
    # Remove SQL comments, strings, identifiers and dollar-quoted function bodies.
    # Only top-level transaction commands count; function-local BEGIN/END are valid.
    pattern=r"(?s)/\*.*?\*/|--[^\n]*|\$(?P<tag>[A-Za-z_][A-Za-z_0-9]*|)\$.*?\$(?P=tag)\$|'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\""
    top=re.sub(pattern,' ',statement)
    assert not re.search(r'(?m)^\s*\\',top),'PSQL_METACOMMAND_FORBIDDEN'
    commands=re.findall(r'(?:^|;)\s*(begin|start|commit|end|rollback|abort|prepare)\b',top,re.I)
    assert [x.lower() for x in commands]==['begin','rollback'],commands

u={key:str(uuid.uuid4()) for key in ['requester','worker','rp','wp','session','device','need','admission','authorization','message_event','message_delivery','message_admission','message_authorization']}
sql="""begin;set local statement_timeout='20s';set local lock_timeout='3s';
alter table auth.users add column if not exists deleted_at timestamptz,add column if not exists banned_until timestamptz;
insert into auth.users(id) values('@requester'),('@worker');
insert into public.app_accounts(id,email,full_name,city) values
 ('@requester','requester-@requester@opportunity.invalid','Local requester','Novi Sad'),
 ('@worker','worker-@worker@opportunity.invalid','Local worker','Novi Sad');
insert into public.app_profiles(id,account_id,kind,display_name,city,skills,available_now,profile_status) values
 ('@rp','@requester','REQUESTER','Local requester','Novi Sad','{}',false,'ACTIVE'),
 ('@wp','@worker','WORKER','Local worker','Novi Sad',array['Selidbe'],true,'DRAFT');
insert into auth.sessions(id,user_id,not_after) values('@session','@worker',clock_timestamp()+interval '1 hour');
insert into public.notification_push_devices(id,user_id,expo_push_token,platform,active,revision,bound_revision,bound_session_id)
 values('@device','@worker','LOCAL_NON_ROUTABLE_@device','ANDROID',true,1,1,'@session');
insert into public.notification_preferences(user_id,role_context,push_enabled,in_app_enabled,opportunities_enabled,quiet_hours_enabled)
 values('@worker','WORKER',true,true,true,false);
select set_config('uskoci.need_lifecycle','PUBLISH',true);
insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,
 mode,required_slots,schedule_kind,required_skills,response_deadline,published_at)
 values('@need','@requester','@rp','PUBLISHED','Local opportunity proof','Disposable only','Selidbe','Novi Sad','Liman',
 'OFFERS',1,'TODAY_FLEXIBLE',array['Selidbe'],statement_timestamp()+interval '1 day',statement_timestamp());
do $fixture$ declare detail jsonb;wave jsonb;event_id uuid;delivery_id uuid;old_rejected boolean:=false;begin
 detail:=private.match_detail('@need','@wp');
 if (detail->>'dispatchEligible')::boolean is distinct from false then raise exception 'DRAFT_NOT_REJECTED';end if;
 perform set_config('request.jwt.claim.sub','@worker',true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 perform public.rpc_complete_worker_profile('@wp');
 detail:=private.match_detail('@need','@wp');
 if (detail->>'dispatchEligible')::boolean is distinct from true then raise exception 'MATCH_NOT_ELIGIBLE:%',detail;end if;
 wave:=private.dispatch_next_wave('@need');
 select e.id,d.id into strict event_id,delivery_id from public.user_activity_events e
 join public.notification_deliveries d on d.event_id=e.id and d.channel='PUSH'
 where e.recipient_user_id='@worker' and e.event_type='OPPORTUNITY_AVAILABLE' and e.entity_id='@need';
 perform set_config('proof.opp_event',event_id::text,true);perform set_config('proof.opp_delivery',delivery_id::text,true);
 perform set_config('proof.opp_expires',(clock_timestamp()+interval '5 minutes')::text,true);
 perform set_config('proof.opp_deadline',(clock_timestamp()+interval '1 hour')::text,true);
 begin
  perform private.admit_push_single_target_v1('@admission','@authorization','@worker','WORKER',event_id,delivery_id,'@device',1,'@session',
    current_setting('proof.opp_expires')::timestamptz,current_setting('proof.opp_deadline')::timestamptz);
 exception when sqlstate 'PT409' then if sqlerrm is distinct from 'PUSH_TARGET_UNAVAILABLE' then raise;end if;old_rejected:=true;end;
 if not old_rejected then raise exception 'BASELINE_DID_NOT_REFUSE_OPPORTUNITY';end if;
 raise notice 'NATURAL_MATCH_EMITTER_BASELINE_REJECTION_PASS';
end $fixture$;
METADATA_BEFORE
MESSAGE_BASELINE
PATCH
METADATA_AFTER
ACL
MESSAGE_CANDIDATE
SHAPE
NEGATIVE
do $after$ declare a jsonb;c jsonb;s jsonb;meta jsonb;second_refused boolean:=false;begin
 a:=private.admit_push_single_target_v1('@admission','@authorization','@worker','WORKER',
 current_setting('proof.opp_event')::uuid,current_setting('proof.opp_delivery')::uuid,'@device',1,'@session',
 current_setting('proof.opp_expires')::timestamptz,current_setting('proof.opp_deadline')::timestamptz);
 if a->>'kind' is distinct from 'ADMITTED' then raise exception 'ADMISSION_FAILED';end if;
 select single_target_admission into meta from public.notification_push_attempts where id='@admission';
 if meta->>'workerProfileId' is distinct from '@wp' or meta->>'needId' is distinct from '@need' or meta->>'needRevision' is distinct from '1' then raise exception 'WRONG_FROZEN_TARGET';end if;
 if not exists(select 1 from public.opportunity_deliveries where id=(meta->>'opportunityId')::uuid and need_id='@need' and worker_profile_id='@wp' and status='READY') then raise exception 'NATURAL_OPPORTUNITY_MISMATCH';end if;
 perform set_config('request.jwt.claim.role','service_role',true);
 c:=public.rpc_claim_push_single_target('@admission');
 if c->>'kind' is distinct from 'SEND' then raise exception 'CLAIM_FAILED:%',c;end if;
 s:=public.rpc_begin_push_send((c->>'attemptId')::uuid,(c->>'leaseId')::uuid);
 if s->>'kind' is distinct from 'SEND' or s->>'eventType' is distinct from 'OPPORTUNITY_AVAILABLE' or s ? 'eventId' then raise exception 'SEND_SHAPE_WRONG';end if;
 if s->>'expoPushToken' is distinct from 'LOCAL_NON_ROUTABLE_@device' then raise exception 'WRONG_LOCAL_DEVICE';end if;
 -- Do not output the transport result, even though this token is synthetic.
 if (public.rpc_claim_push_single_target('@admission')->>'kind') is distinct from 'NONE' then raise exception 'SECOND_CLAIM_GRANTED';end if;
 begin
  perform public.rpc_begin_push_send((c->>'attemptId')::uuid,(c->>'leaseId')::uuid);
 exception when sqlstate 'PT409' then second_refused:=true;end;
 if not second_refused then raise exception 'SECOND_BEGIN_GRANTED';end if;
 if not exists(select 1 from public.notification_push_attempts where id='@admission' and send_count=1 and transport_state='SEND_STARTED') then raise exception 'SEND_STATE_WRONG';end if;
 perform public.rpc_complete_push_transport((c->>'attemptId')::uuid,(c->>'leaseId')::uuid,'UNKNOWN',null);
 if (public.rpc_claim_push_single_target('@admission')->>'kind') is distinct from 'NONE' then raise exception 'UNKNOWN_REGRANTED';end if;
 update public.opportunity_deliveries set status='EXPIRED' where id=(meta->>'opportunityId')::uuid;
 a:=private.admit_push_single_target_v1('@admission','@authorization','@worker','WORKER',
 current_setting('proof.opp_event')::uuid,current_setting('proof.opp_delivery')::uuid,'@device',1,'@session',
 current_setting('proof.opp_expires')::timestamptz,current_setting('proof.opp_deadline')::timestamptz);
 if a->>'kind' is distinct from 'EXISTING' or a->>'state' is distinct from 'UNKNOWN' then raise exception 'REPLAY_AFTER_EXPIRY_LOST';end if;
 raise notice 'CANDIDATE_ADMIT_BEGIN_SINGLE_SEND_UNKNOWN_AND_EXPIRED_REPLAY_PASS';
end $after$;
rollback;
"""
admit="""private.admit_push_single_target_v1('@admission','@authorization','@worker','WORKER',
 current_setting('proof.opp_event')::uuid,current_setting('proof.opp_delivery')::uuid,'@device',1,'@session',
 current_setting('proof.opp_expires')::timestamptz,current_setting('proof.opp_deadline')::timestamptz)"""
mutations={
 'opportunity_seen':"update public.opportunity_deliveries set status='SEEN' where worker_account_id='@worker' and need_id='@need';",
 'opportunity_expired':"update public.opportunity_deliveries set expires_at=clock_timestamp()-interval '1 second' where worker_account_id='@worker' and need_id='@need';",
 'need_revision':"update public.needs set revision=revision+1 where id='@need';",
 'remaining_search_closed':"perform set_config('uskoci.need_lifecycle','CLOSE_REMAINING_SEARCH',true);update public.needs set remaining_search_closed_at=clock_timestamp() where id='@need';",
 'need_cancelled':"perform set_config('uskoci.need_lifecycle','CANCEL_NEED',true);update public.needs set status='CANCELLED' where id='@need';",
 'service_changed':"update public.app_profiles set skills=array['Cuvanje dece'] where id='@wp';",
 'proactive_disabled':"insert into public.worker_match_preferences(worker_profile_id,worker_account_id,proactive_notifications) values('@wp','@worker',false) on conflict(worker_profile_id) do update set proactive_notifications=false;",
 'device_revoked':"update public.notification_push_devices set active=false where id='@device';",
 'device_revision':"update public.notification_push_devices set revision=revision+1 where id='@device';",
 'session_expired':"update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id='@session';",
 'category_disabled':"update public.notification_preferences set opportunities_enabled=false where user_id='@worker' and role_context='WORKER';",
 'delivery_expired':"update public.notification_deliveries set expires_at=clock_timestamp()-interval '1 second' where id=current_setting('proof.opp_delivery')::uuid;",
 'profile_binding_changed':"update public.opportunity_deliveries set worker_profile_id='@rp' where worker_account_id='@worker' and need_id='@need';",
}
blocks=[]
for label,mutation in mutations.items():
 for stage in ['admit','begin']:
  setup="perform set_config('request.jwt.claim.role','authenticated',true);"
  if stage=='begin':setup+=" a:="+admit+";if a->>'kind' is distinct from 'ADMITTED' then raise exception 'SETUP_ADMIT_FAILED';end if;perform set_config('request.jwt.claim.role','service_role',true);c:=public.rpc_claim_push_single_target('@admission');if c->>'kind' is distinct from 'SEND' then raise exception 'SETUP_CLAIM_FAILED';end if;perform set_config('request.jwt.claim.role','authenticated',true);"
  probe=("begin perform "+admit+";exception when sqlstate 'PT409' then rejected:=true;end;if not rejected or exists(select 1 from public.notification_push_attempts where id='@admission') then raise exception 'NEGATIVE_ADMISSION_GRANTED';end if;" if stage=='admit' else "perform set_config('request.jwt.claim.role','service_role',true);a:=public.rpc_begin_push_send((c->>'attemptId')::uuid,(c->>'leaseId')::uuid);if a is distinct from '{\"kind\":\"SUPPRESSED\"}'::jsonb then raise exception 'NEGATIVE_BEGIN_NOT_SUPPRESSED';end if;if not exists(select 1 from public.notification_push_attempts where id='@admission' and send_count=0 and transport_state='SUPPRESSED') then raise exception 'NEGATIVE_TOKEN_HANDED_OUT';end if;")
  blocks.append("do $negative$ declare a jsonb;c jsonb;rejected boolean:=false;begin begin "+setup+mutation+probe+"raise exception 'ROLLBACK_CASE' using errcode='PZ001';exception when sqlstate 'PZ001' then null;end;raise notice 'NEGATIVE_"+stage.upper()+'_'+label.upper()+"_PASS';end $negative$;")
sql=sql.replace('NEGATIVE','\n'.join(blocks))

# These transport regression events are synthetic fixtures, not natural chat messages.
message_sql="""do $message$ declare a jsonb;c jsonb;s jsonb;actual jsonb:='{}';item jsonb;r text;begin
 foreach r in array array['REQUESTER','WORKER'] loop
 begin
 insert into public.notification_preferences(user_id,role_context,push_enabled,in_app_enabled,dogovor_enabled,quiet_hours_enabled)
 values('@worker',r,true,true,true,false) on conflict(user_id,role_context) do update set dogovor_enabled=true;
 insert into public.user_activity_events(id,recipient_user_id,recipient_role,event_type,entity_type,entity_id,dedupe_key)
 values('@message_event','@worker',r,'MESSAGE_RECEIVED','AGREEMENT','@need','local-message-@message_event');
 insert into public.notification_deliveries(id,event_id,recipient_user_id,recipient_role,channel,state,title,body,dedupe_key)
 values('@message_delivery','@message_event','@worker',r,'PUSH','CREATED','Local message fixture','Not a natural message','local-message-@message_delivery');
 a:=private.admit_push_single_target_v1('@message_admission','@message_authorization','@worker',r,'@message_event','@message_delivery','@device',1,'@session',
 current_setting('proof.opp_expires')::timestamptz,current_setting('proof.opp_deadline')::timestamptz);
 if a->>'kind' is distinct from 'ADMITTED' then raise exception 'MESSAGE_NOT_ADMITTED';end if;
 perform set_config('request.jwt.claim.role','service_role',true);
 c:=public.rpc_claim_push_single_target('@message_admission');
 if c->>'kind' is distinct from 'SEND' then raise exception 'MESSAGE_NOT_CLAIMED';end if;
 s:=public.rpc_begin_push_send((c->>'attemptId')::uuid,(c->>'leaseId')::uuid);
 if s->>'kind' is distinct from 'SEND' or s->>'eventType' is distinct from 'MESSAGE_RECEIVED' or s->>'eventId' is distinct from '@message_event' then raise exception 'MESSAGE_NOT_SEND';end if;
 select jsonb_build_object('admit',a,'send',s-array['leaseId','leaseExpiresAt'],
 'metadata',single_target_admission,'sendCount',send_count,'state',transport_state) into item
 from public.notification_push_attempts where id='@message_admission';
 actual:=actual||jsonb_build_object(r,item);
 raise exception 'ROLLBACK_CASE' using errcode='PZ001';exception when sqlstate 'PZ001' then null;end;
 end loop;
 COMPARE
end $message$;"""
sql=sql.replace('MESSAGE_BASELINE',message_sql.replace('COMPARE',"perform set_config('proof.message_expected',actual::text,true);raise notice 'MESSAGE_BASELINE_BOTH_ROLES_PASS';"))
sql=sql.replace('MESSAGE_CANDIDATE',message_sql.replace('COMPARE',"if actual is distinct from current_setting('proof.message_expected')::jsonb then raise exception 'MESSAGE_REGRESSION';end if;raise notice 'MESSAGE_DIFFERENTIAL_BOTH_ROLES_PASS';"))
metadata="""(select jsonb_agg(jsonb_build_object('oid',oid,'owner',proowner,'acl',proacl,'definer',prosecdef,'config',proconfig) order by oid) from pg_proc where proname in ('admit_push_single_target_v1','rpc_begin_push_send'))"""
sql=sql.replace('METADATA_BEFORE',"select set_config('proof.function_metadata',"+metadata+"::text,true);")
sql=sql.replace('METADATA_AFTER',"do $meta$ begin if "+metadata+" is distinct from current_setting('proof.function_metadata')::jsonb then raise exception 'FUNCTION_METADATA_CHANGED';end if;raise notice 'FUNCTION_METADATA_PRESERVED_PASS';end $meta$;")
shape_bad={
 'unknown_key':"m||'{\"extra\":true}'::jsonb",
 'requester':"jsonb_set(m,'{recipientRole}','\"REQUESTER\"')",
 'revision_string':"jsonb_set(m,'{needRevision}','\"1\"')",
 'revision_zero':"jsonb_set(m,'{needRevision}','0')",
 'revision_negative':"jsonb_set(m,'{needRevision}','-1')",
 'revision_decimal':"jsonb_set(m,'{needRevision}','1.5')",
 'revision_null':"jsonb_set(m,'{needRevision}','null')",
 'event_unknown':"jsonb_set(m,'{eventType}','\"UNKNOWN\"')",
}
for key in ['opportunityId','workerProfileId','needId','needRevision']:
 shape_bad['missing_'+key]="m-'"+key+"'"
 shape_bad['message_'+key]="(m-array['opportunityId','workerProfileId','needId','needRevision'])||jsonb_build_object('eventType','MESSAGE_RECEIVED','"+key+"',null)"
for key in ['opportunityId','workerProfileId','needId']:
 shape_bad['uuid_'+key]="jsonb_set(m,'{"+key+"}','\"bad\"')"
 shape_bad['null_'+key]="jsonb_set(m,'{"+key+"}','null')"
shape_tests=[]
for label,expr in shape_bad.items():
 shape_tests.append("rejected:=false;begin update public.notification_push_attempts set single_target_admission="+expr+" where id='@admission';exception when check_violation then rejected:=true;end;if not rejected then raise exception 'SHAPE_ACCEPTED_"+label+"';end if;")
sql=sql.replace('\nSHAPE\n',"do $shape$ declare a jsonb;m jsonb;rejected boolean;begin begin a:="+admit+";if a->>'kind' is distinct from 'ADMITTED' then raise exception 'SHAPE_SETUP';end if;select single_target_admission into strict m from public.notification_push_attempts where id='@admission';"+''.join(shape_tests)+"raise exception 'ROLLBACK_CASE' using errcode='PZ001';exception when sqlstate 'PZ001' then null;end;raise notice 'STRICT_SHAPE_MATRIX_PASS';end $shape$;")
acl_blocks=[]
rpc_calls=["public.rpc_claim_push_single_target('@admission')","public.rpc_claim_push_single_target_receipt('@admission')","public.rpc_begin_push_send('@admission','@authorization')"]
for role in ['anon','authenticated','service_role']:
 for i,call in enumerate(rpc_calls+[admit]):
  denied=role!='service_role' or i==3
  acl_blocks.append("set local role "+role+";select set_config('request.jwt.claim.role','service_role',true);do $acl$ declare rejected boolean:=false;begin if current_user<>'"+role+"' then raise exception 'ROLE_NOT_SET';end if;begin perform "+call+";exception when insufficient_privilege then rejected:=true;end;if rejected is distinct from "+str(denied).lower()+" then raise exception 'ACL_WRONG_"+role+"_"+str(i)+"';end if;end $acl$;reset role;")
for call in rpc_calls:
 acl_blocks.append("set local role service_role;select set_config('request.jwt.claim.role','authenticated',true);do $guard$ declare denied boolean:=false;begin begin perform "+call+";exception when insufficient_privilege then if sqlerrm='FORBIDDEN' then denied:=true;else raise;end if;end;if not denied then raise exception 'BODY_GUARD_NOT_DENIED';end if;end $guard$;reset role;")
acl_blocks.append("select set_config('request.jwt.claim.role','authenticated',true);do $done$ begin raise notice 'ACTUAL_SQL_ROLE_ACL_AND_BODY_GUARD_PASS';end $done$;")
sql=sql.replace('ACL','\n'.join(acl_blocks))

for k,v in u.items():sql=sql.replace('@'+k,v)
patch=(repo/'supabase/proofs/push_opportunity/candidate.rollback.sql').read_text(encoding='utf-8')
assert patch.count('begin;\n')==1 and patch.endswith('rollback;\n')
patch=patch[patch.index('begin;\n')+len('begin;\n'):-len('rollback;\n')]
sql=sql.replace('PATCH',patch)
identity="""select jsonb_build_object('functions',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p where p.proname in ('admit_push_single_target_v1','rpc_begin_push_send')),
 'check',(select pg_get_constraintdef(oid) from pg_constraint where conname='push_single_target_shape_v1'),
 'data',(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.notification_push_attempts t),
 'counts',jsonb_build_array((select count(*) from public.needs),(select count(*) from public.app_accounts),(select count(*) from public.app_profiles),(select count(*) from public.user_activity_events),(select count(*) from public.notification_deliveries)),
 'authColumns',(select jsonb_agg(column_name order by ordinal_position) from information_schema.columns where table_schema='auth' and table_name='users'))::text"""

data_snapshot="""do $snapshot$ declare t record;one jsonb;all_rows jsonb:='{}';begin
 for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where c.relkind in ('r','p') and n.nspname in ('public','private','auth') order by n.nspname,c.relname loop
 execute format($rows$select jsonb_build_object('count',count(*),'multisetMd5',md5(coalesce(string_agg(h,'' order by h),''))) from (select md5(to_jsonb(t)::text) h from %I.%I t) q$rows$,t.nspname,t.relname) into one;
 all_rows:=all_rows||jsonb_build_object(t.nspname||'.'||t.relname,one);
 end loop;
 perform set_config('proof.rows_snapshot',all_rows::text,false);
end $snapshot$;
select current_setting('proof.rows_snapshot');"""
sequence_snapshot="select coalesce(jsonb_agg(jsonb_build_object('name',schemaname||'.'||sequencename,'value',last_value) order by schemaname,sequencename),'[]'::jsonb)::text from pg_sequences where schemaname in ('public','private','auth')"
role_inventory="""select jsonb_agg(jsonb_build_object('role',r,'signature',f::text,'schemaUsage',has_schema_privilege(r,case when f::text like 'private.%' then 'private' else 'public' end,'USAGE'),'execute',has_function_privilege(r,f,'EXECUTE')) order by r,f::text)::text
 from unnest(array['anon','authenticated','service_role']) r cross join unnest(array[
 'private.admit_push_single_target_v1(uuid,uuid,uuid,text,uuid,uuid,uuid,bigint,uuid,timestamptz,timestamptz)'::regprocedure,
 'public.rpc_claim_push_single_target(uuid)'::regprocedure,'public.rpc_claim_push_single_target_receipt(uuid)'::regprocedure,'public.rpc_begin_push_send(uuid,uuid)'::regprocedure]) f"""
roles=json.loads(p.psql(role_inventory,db=db,name='role-inventory').stdout)
for row in roles:
 private=row['signature'].startswith('private.')
 assert row['execute']==(row['role']=='service_role' and not private),'UNEXPECTED_FUNCTION_ACL'
 if not private:assert row['schemaUsage'],'PUBLIC_SCHEMA_USAGE_MISSING'
require_rollback_wrapper(sql)
before=p.psql(identity,db=db,name='opp-proof-before').stdout
before_rows=json.loads(p.psql(data_snapshot,db=db,name='opp-data-before').stdout)
before_sequences=json.loads(p.psql(sequence_snapshot,db=db,name='opp-sequence-before').stdout)

run=str(uuid.uuid4())[:8]; receipt=root/('opportunity-local-'+run+'.json')
r={'state':'RUNNING','at':datetime.now(timezone.utc).isoformat(),'target':'127.0.0.1:'+p.PORT+'/'+db,
 'candidateSha256':hashlib.sha256((repo/'supabase/proofs/push_opportunity/candidate.rollback.sql').read_bytes()).hexdigest(),
 'sqlSha256':hashlib.sha256(sql.encode()).hexdigest(),'providerCalls':0,'httpCalls':0,'harnessSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sqlRoleInventory':roles,
 'limits':['Actual PostgreSQL roles plus JWT GUC with synthetic Auth/session compatibility columns; not Supabase HTTP authentication.','No computed certificate/promotion acceptance.','All synthetic business setup and candidate DDL rolled back; no live DB calls.','Serial cases only; concurrent lock races and full capacity still pending. MESSAGE regression uses synthetic events, not natural chat business commands.','Worker matching uses statement_timestamp; no availability-clock-boundary acceptance.']}
(root/('opportunity-local-'+run+'.rollback.sql')).write_bytes(sql.encode())
try:
 result=p.psql(sql,db=db,name='opp-proof-'+run,check=False)
 r['sqlExit']=result.returncode;r['messages']=result.stderr.decode('utf-8')[-2000:]
 r['checks']=re.findall(r'NOTICE:  ([A-Z_]+_PASS)',result.stderr.decode('utf-8'))
 expected={'NATURAL_MATCH_EMITTER_BASELINE_REJECTION_PASS','CANDIDATE_ADMIT_BEGIN_SINGLE_SEND_UNKNOWN_AND_EXPIRED_REPLAY_PASS','MESSAGE_BASELINE_BOTH_ROLES_PASS','MESSAGE_DIFFERENTIAL_BOTH_ROLES_PASS','FUNCTION_METADATA_PRESERVED_PASS','STRICT_SHAPE_MATRIX_PASS','ACTUAL_SQL_ROLE_ACL_AND_BODY_GUARD_PASS'}|{'NEGATIVE_'+stage.upper()+'_'+key.upper()+'_PASS' for stage in ['admit','begin'] for key in mutations}
 r['expectedChecks']=len(expected);r['shapeCases']=len(shape_bad);r['aclCases']=15
 r['allChecksPresent']=set(r['checks'])==expected and len(r['checks'])==len(expected)
 r['state']='LOCAL_BEHAVIOR_PASS' if result.returncode==0 and r['allChecksPresent'] else 'LOCAL_BEHAVIOR_FAILED'
except BaseException as error:
 r['state']='LOCAL_BEHAVIOR_ABORTED';r['failureType']=type(error).__name__
 raise
finally:
 try:
  after=p.psql(identity,db=db,name='opp-proof-after').stdout
  after_rows=json.loads(p.psql(data_snapshot,db=db,name='opp-data-after').stdout)
  after_sequences=json.loads(p.psql(sequence_snapshot,db=db,name='opp-sequence-after').stdout)
  r['definitionsAndMetadataRestored']=before==after
  r['businessAndAuthRowsRestored']=before_rows==after_rows
  r['tableCount']=len(before_rows)
  r['sequenceValuesBefore']=before_sequences;r['sequenceValuesAfter']=after_sequences
  r['sequenceValuesUnchanged']=before_sequences==after_sequences
  r['exactRestoration']=before==after and before_rows==after_rows
  r['restorationScope']='Two pg_proc rows, CHECK, Auth user columns and all public/private/auth table row multisets. Sequences reported separately, not reset.'
  if not r['exactRestoration']:r['state']='RESTORATION_FAILED'
 except BaseException as error:
  r['state']='RESTORATION_UNVERIFIED';r['restorationErrorType']=type(error).__name__
 finally:
  receipt.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  print(json.dumps({'state':r['state'],'receipt':str(receipt),'checks':len(r.get('checks',[])),'rowRestoration':r.get('businessAndAuthRowsRestored'),'sequenceValuesUnchanged':r.get('sequenceValuesUnchanged')},ensure_ascii=False))
if r['state']!='LOCAL_BEHAVIOR_PASS':raise SystemExit(1)
