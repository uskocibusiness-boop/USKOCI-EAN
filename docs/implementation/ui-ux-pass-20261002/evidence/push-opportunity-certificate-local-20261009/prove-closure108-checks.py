"""Compare exact CHECK texts through one local parser without rewriting expressions."""
from pathlib import Path
import json,hashlib,re
import local_pg as p
ROOT=Path(__file__).parent;DB='uskoci_proof_cert108_1d4bbab5'
read=lambda name:json.loads((ROOT/name).read_text(encoding='utf-8'))
report=read('closure108-semantic-comparison.json');backup=read('cleanup-schema-20261009.json')
diffs=[x for x in report['full']['semanticDifferences'] if x['surface']=='schemaTables' and x['field']=='constraints']
assert len(diffs)==10
pairs=[]
for d in diffs:
 assert len(d['expected'])==len(d['actual'])
 changed=[(a,b) for a,b in zip(d['expected'],d['actual']) if a!=b];assert len(changed)==1
 a,b=changed[0];assert a.startswith('CHECK (') and b.startswith('CHECK (')
 original=[c for c in backup['constraints'] if c['table']==d['id'] and c['definition']==a];assert len(original)==1 and original[0]['validated']
 pairs.append({'table':d['id'],'constraint':original[0]['name'],'expected':a,'observed':b,'expectedSha256':hashlib.sha256(a.encode()).hexdigest(),'observedSha256':hashlib.sha256(b.encode()).hexdigest()})
pin=json.dumps(pairs,sort_keys=True,separators=(',',':')).encode();(ROOT/'closure108-check-pairs.json').write_bytes(pin+b'\n')
sql=['begin;set local search_path=pg_catalog;set local statement_timeout=\'30s\';']
sql.append("do $g$ begin if current_database()<>"+p.ql(DB)+" or inet_server_addr()<>inet '127.0.0.1' or inet_server_port()<>55439 then raise exception 'WRONG_TARGET';end if;end $g$;")
for i,pair in enumerate(pairs):
 table='check_pair_'+str(i)
 sql.append('create temp table '+p.qi(table)+' (like '+p.qt(pair['table'])+' excluding all) on commit drop;')
 defs={'expected':pair['expected'],'observed':pair['observed']}
 if i==0:
  assert '2000' in pair['expected'];defs['negative']=pair['expected'].replace('2000','1999')
 if pair['table']=='private.ai_test_reservations_v5':
  needle="'FAILED_NO_USAGE'::text, ";assert needle in pair['expected'];defs['negative']=pair['expected'].replace(needle,'')
 for name,definition in defs.items():sql.append('alter table pg_temp.'+p.qi(table)+' add constraint '+p.qi(name)+' '+definition+' not valid;')
 sql.append("select jsonb_build_object('table',"+p.ql(pair['table'])+",'originalValidated',(select convalidated from pg_constraint where conrelid="+p.ql(pair['table'])+"::regclass and conname="+p.ql(pair['constraint'])+"),'asts',(select jsonb_agg(jsonb_build_object('name',conname,'raw',conbin::text,'definition',pg_get_constraintdef(oid),'validated',convalidated,'noInherit',connoinherit) order by conname) from pg_constraint where conrelid="+p.ql('pg_temp.'+table)+"::regclass and contype='c'));" )
sql.append('rollback;');body='\n'.join(sql)+'\n';(ROOT/'closure108-check-proof.rollback.sql').write_bytes(body.encode())
receipt={'state':'FAILED','database':DB,'devWrites':0,'certificateRebound':False,'pairsSha256':hashlib.sha256(pin).hexdigest(),'sqlSha256':hashlib.sha256(body.encode()).hexdigest(),'normalization':"ONLY regex :location -?[0-9]+ -> :location -1"}
try:
 r=p.psql(body,db=DB,name='closure108-check-proof');records=[json.loads(line) for line in r.stdout.decode().splitlines() if line.startswith('{')];assert len(records)==10
 negatives=0
 for record,pair in zip(records,pairs):
  assert record['table']==pair['table'] and record['originalValidated'] is True
  asts={a['name']:a for a in record['asts']};assert set(asts) in [{'expected','observed'},{'expected','observed','negative'}]
  for a in asts.values():a['comparable']=re.sub(r':location -?[0-9]+',':location -1',a['raw']);assert not a['validated'] and not a['noInherit']
  assert asts['expected']['comparable']==asts['observed']['comparable'],pair['table']
  if 'negative' in asts:
   assert asts['negative']['comparable']!=asts['expected']['comparable'];negatives+=1
  record['sourcePair']=pair
 assert negatives==2
 receipt.update(state='CHECK_DEPARSE_ROUNDTRIP_EQUIVALENT_ON_LOCAL_PG17_11',pairs=records,negativeControls=negatives,limitations=['Does not prove byte-identical DEV conbin or PG17.6 execution engine.','Original surface differences remain recorded, not silently normalized.'])
finally:
 (ROOT/'closure108-check-proof.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in receipt.items() if k!='pairs'}))
