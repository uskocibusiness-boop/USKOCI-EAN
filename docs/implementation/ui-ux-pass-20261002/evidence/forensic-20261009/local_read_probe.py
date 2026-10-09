import sys,json,time,subprocess,hashlib
from pathlib import Path
from datetime import datetime,timezone
sys.path.insert(0,'C:/Users/user/Documents/Codex/uskoci-finish-20261008');import local_pg as p
out=Path(__file__).parent/'backend';db='uskoci_plan_cache_20261009';assert p.PORT=='55439'
identity="select jsonb_build_object('md5',md5(prosrc),'postgres',version(),'needs',(select count(*) from public.needs)) from pg_proc where oid='public.rpc_discovery_v1(jsonb)'::regprocedure"
before=json.loads(p.psql(identity,db=db,name='forensic-identity').stdout);assert before['md5']=='a9b0985991f4ebfe4e95143e5cf57222'
actors=json.loads(p.crypt((p.ROOT/'local-plan-clone-actors.dpapi').read_bytes()))
request={'mode':'PLACES','filter':{'text':'','price':'all','where':'any','places':1,'when':'any','dates':None,'place':None},'anchor':None,'prefix':'','facetArea':None,'limit':30,'after':None}
receipt={'at':datetime.now(timezone.utc).isoformat(),'target':'127.0.0.1:55439/'+db,'identity':before,'population':{'syntheticTasks':40000,'retainedTasks':49,'users':5,'activeSqlReaders':1,'httpRequests':0},'samples':[],'limits':['Read-only isolated partial clone; not DEV/production benchmark or 40000 concurrent users.','PG17.11 versus live17.6; same rpc body but no full dependency parity claim.','Shared host; wall time includes psql process and connection overhead; not HTTP/phone latency.','Three cold SQL sessions plus one forced generic diagnostic; insufficient sample for meaningful p95.','No new users/tasks, no writes, 8s statement timeout per call; generic-plan forcing is diagnostic not a production-mode proof.']}
for i,mode in enumerate(['auto','auto','auto','force_generic_plan']):
    sql="begin read only;set local statement_timeout='8s';set local lock_timeout='1s';set local plan_cache_mode="+mode+";select set_config('request.jwt.claim.sub',"+p.ql(actors['viewer'])+",true);set local role authenticated;select public.rpc_discovery_v1("+p.ql(json.dumps(request))+"::jsonb);rollback;"
    t=time.perf_counter();result=p.psql(sql,db=db,name='forensic-read-'+str(i),check=False);elapsed=round((time.perf_counter()-t)*1000,2)
    row={'mode':mode,'elapsedMs':elapsed,'exitCode':result.returncode}
    if result.returncode==0:
        v=json.loads(result.stdout.decode().strip().splitlines()[-1]);row['counts']=v.get('counts');row['responseSha256']=hashlib.sha256(json.dumps(v,sort_keys=True).encode()).hexdigest();row['responseBytes']=len(json.dumps(v).encode())
    else:row['statementTimeout']='statement timeout' in result.stderr.decode();row['errorClass']='statement_timeout' if row['statementTimeout'] else 'other'
    receipt['samples'].append(row);(out/'isolated-read-probe.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(row),flush=True)
after=json.loads(p.psql(identity,db=db,name='forensic-identity-after').stdout);receipt['identityAndCountUnchanged']=before==after
(out/'isolated-read-probe.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
