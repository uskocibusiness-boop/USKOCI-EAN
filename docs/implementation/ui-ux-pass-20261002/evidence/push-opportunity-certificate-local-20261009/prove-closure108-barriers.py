"""Exercise canonical EXECUTING and retained admission refusal in a private child DB."""
from pathlib import Path
import json,hashlib,re,uuid
import local_pg as p
if not __debug__:raise SystemExit('Optimized Python forbidden')
ROOT=Path(__file__).parent;SOURCE=ROOT/'closure108-transition-1a877548'
receipt0=json.loads((SOURCE/'receipt.json').read_text());PARENT=receipt0['database']
RUN=uuid.uuid4().hex[:8];DB='uskoci_proof_cert108_barrier_'+RUN;OUT=ROOT/('closure108-barriers-'+RUN);OUT.mkdir()
ql=p.ql;qi=p.qi;sha=lambda b:hashlib.sha256(b).hexdigest()
baseline=json.loads((SOURCE/'01-coherent-local-baseline.json').read_text());installed=json.loads((SOURCE/'02-installed.json').read_text())
# Use the exact successful transition SQL, substituting only the disposable DB guard.
install=(SOURCE/'02-install.sql').read_text().replace(ql(PARENT),ql(DB));revert=(SOURCE/'03-revert.sql').read_text().replace(ql(PARENT),ql(DB))
neg=(SOURCE/'negative-revert-source-row-drift.sql').read_text()
expr=neg[neg.index('select jsonb_build_object(')+7:neg.index(';savepoint attempt;')]
assert expr.startswith('jsonb_build_object(')
start="begin;set local search_path=pg_catalog;set local statement_timeout='40s';set local lock_timeout='3s';do $local$ begin if current_database()<>"+ql(DB)+" or inet_server_addr()<>inet '127.0.0.1' or inet_server_port()<>55439 or session_user<>'postgres' then raise exception 'WRONG_LOCAL_TARGET';end if;end $local$;\n"
assert install.startswith(start) and revert.startswith(start)
def snap():return json.loads(p.psql('set search_path=pg_catalog;select '+expr+';',db=DB,name='barrier-snapshot').stdout)
def run(sql,label):
 (OUT/(label+'.sql')).write_bytes(sql.encode());r=p.psql(sql,db=DB,name='barrier-'+label,check=False)
 (OUT/(label+'.stderr.log')).write_bytes(r.stderr)
 if r.returncode:raise RuntimeError(label+': SQL_FAILED')
 return r
def rows():
 sql="""begin;set local search_path=pg_catalog;create temp table row_proof(relation text,rows bigint,hash text) on commit drop;
 do $rows$ declare r record;begin for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private','auth','storage') and c.relkind in('r','p') order by n.nspname,c.relname loop
 execute format('insert into pg_temp.row_proof select %L,count(*),md5(coalesce(string_agg(to_jsonb(t)::text,E''\\n'' order by to_jsonb(t)::text),'''')) from %I.%I t',r.nspname||'.'||r.relname,r.nspname,r.relname);end loop;end $rows$;
 select jsonb_agg(to_jsonb(t) order by relation) from pg_temp.row_proof t;rollback;"""
 return json.loads(p.psql(sql,db=DB,name='barrier-row-proof').stdout)
def sequence():return json.loads(p.psql("select jsonb_build_object('last',last_value,'called',is_called) from private.marketplace_audit_log_id_seq;",db=DB,name='barrier-sequence').stdout)
report={'state':'FAILED','database':DB,'parent':PARENT,'devWrites':0,'providerCalls':0,'httpCalls':0,'harnessSha256':sha(Path(__file__).read_bytes()),'transitionReceiptSha256':sha((SOURCE/'receipt.json').read_bytes()),'cases':[]}
p.psql('create database '+qi(DB)+' template '+qi(PARENT)+';',db='postgres',name='barrier-create')
try:
 assert snap()==installed
 # Local template restore copied rows but not this identity sequence. Synchronize
 # ONLY the new child; report subsequent RPC sequence movement separately.
 p.psql("select setval(pg_get_serial_sequence('private.marketplace_audit_log','id'),coalesce((select max(id)+1 from private.marketplace_audit_log),1),false);",db=DB,name='barrier-sequence-align')
 original_rows=rows();seq_before=sequence()
 def reject(label,mutation,command,witness,expected_error,expected_snapshot,extra_expr="'{}'::jsonb"):
  assert command.startswith(start) and command.endswith('commit;\n');core=command[len(start):-8]
  record="jsonb_build_object('snapshot',"+expr+",'witness',"+extra_expr+")"
  sql=start+mutation+'\nselect '+ql(witness)+';select '+record+';savepoint attempt;\n\\set ON_ERROR_STOP off\n'+core+'\n\\set ON_ERROR_STOP on\nrollback to savepoint attempt;select '+record+';rollback;\n'
  r=run(sql,label);out=r.stdout.decode();err=r.stderr.decode();assert expected_error in err,('WRONG_REJECTION',label,err[:200]);assert witness in out
  records=[json.loads(line) for line in out.splitlines() if line.startswith('{')];records=[x for x in records if 'snapshot' in x and 'witness' in x];assert len(records)==2 and records[0]==records[1]
  assert snap()==expected_snapshot
  report['cases'].append({'case':label,'error':expected_error,'beforeAfterRefusalEqual':True,'witness':records[0]['witness']})
 def closure_fixture():
  u=str(uuid.uuid4());s=str(uuid.uuid4())
  return """alter table auth.users add column if not exists deleted_at timestamptz,add column if not exists banned_until timestamptz;
 insert into auth.users(id) values("""+ql(u)+");insert into public.app_accounts(id,email) values("+ql(u)+','+ql('closure-'+u+'@proof.invalid')+");insert into auth.sessions(id,user_id,not_after) values("+ql(s)+','+ql(u)+",clock_timestamp()+interval '1 hour');\n"+"select set_config('request.jwt.claim.sub',"+ql(u)+",true);select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claims',"+ql(json.dumps({'sub':u,'role':'authenticated','session_id':s}))+",true);\nset local role authenticated;do $canonical$ declare review jsonb;started jsonb;begin\n"+"perform public.rpc_prepare_account_closure("+ql(u)+",0,gen_random_uuid());review:=public.rpc_review_account_closure_execution("+ql(u)+");if review->>'ready' is distinct from 'true' or review->'blockers' is distinct from '[]'::jsonb then raise exception 'CLOSURE_REVIEW_NOT_READY:%',review;end if;\n"+"started:=public.rpc_start_account_closure_execution("+ql(u)+",(review->>'requestId')::uuid,(review->>'revision')::integer,gen_random_uuid(),review->>'policySha256');if started->>'state' is distinct from 'EXECUTING' or started->>'authoritative' is distinct from 'true' then raise exception 'CLOSURE_NOT_EXECUTING:%',started;end if;end $canonical$;reset role;\n"+"do $witness$ begin if not exists(select 1 from private.closure_executions_v5 where account_id="+ql(u)+" and state='EXECUTING' and binding=private.closure_erasure_binding_v5()) or not exists(select 1 from private.account_closure_requests where account_id="+ql(u)+" and state='EXECUTING') then raise exception 'EXECUTING_WITNESS_MISSING';end if;end $witness$;"
 reject('revert-executing-closure',closure_fixture(),revert,'CANONICAL_EXECUTING_WITNESS','EXECUTING_CLOSURE',installed,"jsonb_build_object('executing',(select count(*) from private.closure_executions_v5 where state='EXECUTING'))")
 run(revert,'revert-to-baseline');assert snap()==baseline
 reject('install-executing-closure',closure_fixture(),install,'CANONICAL_EXECUTING_WITNESS','EXECUTING_CLOSURE',baseline,"jsonb_build_object('executing',(select count(*) from private.closure_executions_v5 where state='EXECUTING'))")
 run(install,'reapply');assert snap()==installed
 fixture_path=ROOT/'opportunity-canonical-proof/opportunity-local-3304e13d.rollback.sql';fixture_receipt=json.loads((fixture_path.parent/'opportunity-local-3304e13d.json').read_text())
 assert sha(fixture_path.read_bytes())==fixture_receipt['sqlSha256'];text=fixture_path.read_text()
 fixture=text[:text.index("select set_config('proof.function_metadata'")]
 fixture=fixture[fixture.index('\n')+1:];begin=fixture.index(' begin\n  perform private.admit_push_single_target_v1(')
 admit=fixture[begin+len(' begin\n  '):fixture.index("\n exception when sqlstate 'PT409'",begin)]
 fixture=fixture[:begin]+admit+"\nend $fixture$;\n"
 admission=re.search("admit_push_single_target_v1\\('([^']+)'",admit).group(1)
 extra="(select jsonb_build_object('id',id,'state',transport_state,'sendCount',send_count,'metadata',single_target_admission) from public.notification_push_attempts where id="+ql(admission)+")"
 for state in ['PENDING','SUPPRESSED','UNKNOWN']:
  action=''
  if state=='SUPPRESSED':action="do $revoke$ begin if private.revoke_push_single_target_v1("+ql(admission)+") is distinct from true then raise exception 'REVOKE_FAILED';end if;end $revoke$;"
  if state=='UNKNOWN':action="set local role service_role;select set_config('request.jwt.claim.role','service_role',true);do $send$ declare c jsonb;s jsonb;begin c:=public.rpc_claim_push_single_target("+ql(admission)+");if c->>'kind' is distinct from 'SEND' then raise exception 'NO_CLAIM:%',c;end if;s:=public.rpc_begin_push_send((c->>'attemptId')::uuid,(c->>'leaseId')::uuid);if s->>'kind' is distinct from 'SEND' then raise exception 'NO_SEND:%',s;end if;perform public.rpc_complete_push_transport((c->>'attemptId')::uuid,(c->>'leaseId')::uuid,'UNKNOWN',null);end $send$;reset role;"
  witness="do $witness$ begin if not exists(select 1 from public.notification_push_attempts where id="+ql(admission)+" and transport_state="+ql(state)+" and single_target_admission->>'eventType'='OPPORTUNITY_AVAILABLE') then raise exception 'ADMISSION_STATE_WITNESS_MISSING';end if;end $witness$;"
  reject('revert-after-'+state.lower(),fixture+action+witness,revert,'ADMISSION_'+state+'_WITNESS','OPPORTUNITY_ADMISSIONS_PREVENT_EXACT_REVERT',installed,extra)
 after_rows=rows();assert original_rows==after_rows
 report.update(state='LOCAL_CLOSURE_AND_ADMISSION_BARRIERS_PASS',rowMultisetsPreserved=len(after_rows),rowProofSha256=sha(json.dumps(after_rows,sort_keys=True).encode()),sequenceBefore=seq_before,sequenceAfter=sequence(),limits=['Canonical SQL RPC with actual SQL roles and synthetic Auth rows; not HTTP Auth.','Identity sequence movement is recorded, not claimed rolled back.','No provider requests or real phone delivery.'])
finally:
 (OUT/'receipt.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='cases'}))
