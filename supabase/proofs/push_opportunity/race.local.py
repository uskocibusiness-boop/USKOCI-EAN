"""Local-only two-connection race proof; creates and removes its own exact QA clones. No HTTP/providers."""
import hashlib,json,re,subprocess,threading,queue,time,uuid
from datetime import datetime,timezone
from pathlib import Path
import argparse,os
if not __debug__:raise SystemExit('Optimized Python is forbidden.')
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--psql',default='psql')
parser.add_argument('--port',required=True,type=int)
parser.add_argument('--parent-database',required=True)
parser.add_argument('--fixture-receipt',required=True,type=Path)
parser.add_argument('--output',required=True,type=Path)
parser.add_argument('--confirm-disposable',required=True,choices=['PUSH_OPPORTUNITY_LOCAL_ONLY'])
args=parser.parse_args()
if not re.fullmatch(r'uskoci_(proof_[a-z0-9_]+|plan_cache_[0-9]{8})',args.parent_database):parser.error('Local QA database required.')
if not 1024<=args.port<=65535:parser.error('Explicit loopback port required.')
root=args.output.resolve();root.mkdir(parents=True,exist_ok=True)
repo=Path(__file__).resolve().parents[3]
class LocalPSQL:
 PORT=str(args.port)
 @staticmethod
 def env():
  env={k:v for k,v in os.environ.items() if not k.startswith('PG') or k in ('PGPASSWORD','PGPASSFILE')}
  return dict(env,PGCLIENTENCODING='UTF8',PGCONNECT_TIMEOUT='5')
 @staticmethod
 def command(db):
  assert db=='postgres' or re.fullmatch(r'uskoci_(proof_[a-z0-9_]+|plan_cache_[0-9]{8})',db)
  return [args.psql,'-X','-q','-w','-h','127.0.0.1','-p',str(args.port),'-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-A','-t']
 @staticmethod
 def psql(sql,db,name):
  result=subprocess.run(LocalPSQL.command(db),input=sql.encode('utf-8'),env=LocalPSQL.env(),capture_output=True,timeout=180)
  if result.returncode:
   (root/(name+'.stderr.log')).write_bytes(result.stderr)
   raise RuntimeError(name+': psql failed; see private output diagnostic.')
  return result
 @staticmethod
 def qi(s):return '"'+s.replace('"','""')+'"'
p=LocalPSQL()
server=json.loads(p.psql("select jsonb_build_object('host',inet_server_addr(),'port',inet_server_port(),'database',current_database(),'user',session_user)::text",db=args.parent_database,name='race-preflight').stdout)
assert server=={'host':'127.0.0.1','port':args.port,'database':args.parent_database,'user':'postgres'}

package=repo/'supabase/proofs/push_opportunity'
manifest=json.loads((package/'manifest.json').read_text())
candidate=(package/'candidate.rollback.sql').read_text(encoding='utf-8')
assert hashlib.sha256(candidate.encode()).hexdigest()==manifest['candidateSha256']
fixture_receipt=json.loads(args.fixture_receipt.read_text(encoding='utf-8'))
assert fixture_receipt['state']=='LOCAL_BEHAVIOR_PASS' and fixture_receipt['candidateSha256']==manifest['candidateSha256']
fixture_file=args.fixture_receipt.with_suffix('.rollback.sql')
assert hashlib.sha256(fixture_file.read_bytes()).hexdigest()==fixture_receipt['sqlSha256']
sql=fixture_file.read_text(encoding='utf-8')
# The only script accepted is an outer rollback transaction, with no psql escapes.
# Dollar-quoted function bodies have their own BEGIN/END and do not count here.
top=re.sub(r"(?s)/\*.*?\*/|--[^\n]*|\$(?P<tag>[A-Za-z_][A-Za-z_0-9]*|)\$.*?\$(?P=tag)\$|'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\"",' ',sql)
assert not re.search(r'(?m)^\s*\\',top),'PSQL_METACOMMAND_FORBIDDEN'
assert [x.lower() for x in re.findall(r'(?:^|;)\s*(begin|start|commit|end|rollback|abort|prepare)\b',top,re.I)]==['begin','rollback']
fixture=sql[:sql.index("select set_config('proof.function_metadata'")]
assert fixture.startswith('begin;')
ids={}
ids['requester'],ids['worker']=re.search(r"insert into auth.users\(id\) values\('([^']+)'\),\('([^']+)'\)",fixture).groups()
admission_args=re.search(r"perform private.admit_push_single_target_v1\('([^']+)','([^']+)','([^']+)','WORKER',event_id,delivery_id,'([^']+)',1,'([^']+)'",fixture).groups()
ids.update(admission=admission_args[0],authorization=admission_args[1],device=admission_args[3],session=admission_args[4])
ids['need']=re.search(r"values\('([^']+)','"+ids['requester']+r"','[^']+','PUBLISHED'",fixture).group(1)
patch=candidate[candidate.index('begin;\n')+len('begin;\n'):-len('rollback;\n')]
prepare=fixture+patch+"""
select private.admit_push_single_target_v1('ADMISSION','AUTHORIZATION','WORKER','WORKER',current_setting('proof.opp_event')::uuid,current_setting('proof.opp_delivery')::uuid,'DEVICE',1,'SESSION',current_setting('proof.opp_expires')::timestamptz,current_setting('proof.opp_deadline')::timestamptz);
set local role service_role;select set_config('request.jwt.claim.role','service_role',true);
select 'CLAIM|'||public.rpc_claim_push_single_target('ADMISSION')::text;
commit;
"""
# Exact token replacements avoid replacing the literal role WORKER.
prepare=prepare.replace("'ADMISSION'","'"+ids['admission']+"'").replace("'AUTHORIZATION'","'"+ids['authorization']+"'")
prepare=prepare.replace("'WORKER','WORKER',current_setting","'"+ids['worker']+"','WORKER',current_setting")
prepare=prepare.replace("'DEVICE'","'"+ids['device']+"'").replace("'SESSION'","'"+ids['session']+"'")
run=str(uuid.uuid4())[:8]
r={'state':'RUNNING','at':datetime.now(timezone.utc).isoformat(),'candidateSha256':manifest['candidateSha256'],'harnessSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'providerCalls':0,'httpCalls':0,'cases':[],'fixtureSqlSha256':fixture_receipt['sqlSha256'],
 'limits':['Two actual PostgreSQL connections plus an observer, not HTTP or provider capacity.','Actual rpc_cancel_need with JWT GUC and service-role begin in partial Auth clone.','No profile/preferences/time-boundary races, full-capacity selection or closure-certificate proof.']}

class Session:
 def __init__(self,db):
  self.p=subprocess.Popen(p.command(db),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',bufsize=1,env=p.env())
  self.q=queue.Queue();self.errors=[]
  def reader():
   for line in self.p.stdout:self.q.put(line.strip())
   self.q.put('EOF')
  def errors():
   for line in self.p.stderr:self.errors.append(line.strip())
  threading.Thread(target=reader,daemon=True).start();threading.Thread(target=errors,daemon=True).start()
  self.send("set statement_timeout='15s';set lock_timeout='10s';select 'READY|'||pg_backend_pid();")
  self.pid=int(self.until('READY|')[6:])
 def send(self,statement):self.p.stdin.write(statement+'\n');self.p.stdin.flush()
 def until(self,prefix,timeout=17):
  deadline=time.monotonic()+timeout
  while True:
   line=self.q.get(timeout=max(.01,deadline-time.monotonic()))
   if line.startswith(prefix):return line
   if line=='EOF':raise RuntimeError('PSQL_SESSION_ENDED:'+str(self.errors[:5]))
   if time.monotonic()>deadline:raise TimeoutError(prefix)
 def close(self):
  if self.p.poll() is None:
   try:self.send('rollback;');self.p.stdin.close()
   except OSError:pass
   try:self.p.wait(timeout=3)
   except subprocess.TimeoutExpired:self.p.terminate();self.p.wait(timeout=3)

def blocking(db,waiter,blocker):
 deadline=time.monotonic()+4
 while time.monotonic()<deadline:
  row=json.loads(p.psql("select to_jsonb(pg_blocking_pids("+str(waiter)+"))::text",db=db,name='opp-race-blockers').stdout)
  if blocker in row:return True
  time.sleep(.05)
 raise AssertionError('EXPECTED_BLOCK_NOT_OBSERVED')

try:
 for order in ['cancel_first','begin_first']:
  db='uskoci_proof_opportunity_'+run+'_'+order
  assert re.fullmatch('uskoci_proof_opportunity_[a-f0-9]{8}_(cancel_first|begin_first)',db)
  created=False;sessions=[]
  case={'order':order,'state':'RUNNING','database':db};r['cases'].append(case)
  try:
   p.psql('create database '+p.qi(db)+' template '+p.qi(args.parent_database),db='postgres',name='opp-race-create');created=True
   # A restored identity sequence can lag copied rows. Repair this clone only,
   # before exercising the actual audit insertion; never touch the parent.
   p.psql("select setval(pg_get_serial_sequence('private.marketplace_audit_log','id'),greatest(coalesce((select max(id) from private.marketplace_audit_log),0),1),true)",db=db,name='opp-race-audit-sequence')
   case['clonedAuditSequenceSynchronized']=True
   prepared=p.psql(prepare,db=db,name='opp-race-prepare')
   claim=json.loads(next(x.split('|',1)[1] for x in prepared.stdout.decode().splitlines() if x.startswith('CLAIM|')))
   assert claim['kind']=='SEND'
   a=Session(db);b=Session(db);sessions=[a,b]
   cancel="begin;select set_config('request.jwt.claim.sub','"+ids['requester']+"',true);select set_config('request.jwt.claim.role','authenticated',true);set local role authenticated;select 'CANCEL|'||public.rpc_cancel_need('"+ids['need']+"',1,'Local race proof')::text;"
   begin="begin;set local role service_role;select set_config('request.jwt.claim.role','service_role',true);select 'BEGIN|'||public.rpc_begin_push_send('"+claim['attemptId']+"','"+claim['leaseId']+"')::text;"
   if order=='cancel_first':
    a.send(cancel);cancel_result=json.loads(a.until('CANCEL|').split('|',1)[1]);assert cancel_result['status']=='CANCELLED'
    b.send(begin);case['waitingLockObserved']=blocking(db,b.pid,a.pid)
    a.send('commit;');reply=json.loads(b.until('BEGIN|').split('|',1)[1]);assert reply=={'kind':'SUPPRESSED'}
    b.send("commit;select 'DONE';");b.until('DONE');case['beginKind']=reply['kind'];expected_count=0
   else:
    b.send(begin);reply=json.loads(b.until('BEGIN|').split('|',1)[1]);assert reply['kind']=='SEND'
    a.send(cancel);case['waitingLockObserved']=blocking(db,a.pid,b.pid)
    b.send('commit;');cancel_result=json.loads(a.until('CANCEL|').split('|',1)[1]);assert cancel_result['status']=='CANCELLED'
    a.send("commit;select 'DONE';");a.until('DONE');case['beginKind']=reply['kind'];expected_count=1
   state=json.loads(p.psql("select jsonb_build_object('state',transport_state,'sendCount',send_count,'needStatus',(select status from public.needs where id='"+ids['need']+"'))::text from public.notification_push_attempts where id='"+ids['admission']+"'",db=db,name='opp-race-final').stdout)
   assert state['sendCount']==expected_count and state['needStatus']=='CANCELLED',state
   case['state']='PASS';case['attempt']=state
  finally:
   for session in sessions:session.close()
   if created:
    # Drop only the exact clone created by this invocation; never FORCE or parent DB.
    p.psql('drop database '+p.qi(db),db='postgres',name='opp-race-drop')
    case['isolatedCloneRemoved']=True
 r['state']='LOCAL_TWO_CONNECTION_RACE_PASS'
except BaseException as error:
 r['state']='LOCAL_RACE_FAILED';r['errorType']=type(error).__name__;r['error']=str(error)[:500];raise
finally:
 (root/('opportunity-race-'+run+'.json')).write_text(json.dumps(r,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(r))
