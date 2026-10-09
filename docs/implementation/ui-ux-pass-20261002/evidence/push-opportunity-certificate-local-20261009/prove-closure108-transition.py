"""Local catalog fixture and committed 108-to-108 transition; never a DEV installer."""
from pathlib import Path
import hashlib,json,re,uuid
import local_pg as p
if not __debug__:raise SystemExit('Optimized Python forbidden')
ROOT=Path(__file__).parent
REPO=Path('C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN-spoj-20261006')
PKG=REPO/'supabase/proofs/push_opportunity'
PARENT='uskoci_proof_cert108_1d4bbab5';RUN=uuid.uuid4().hex[:8];DB='uskoci_proof_cert108_round_'+RUN
OUT=ROOT/('closure108-transition-'+RUN);OUT.mkdir()
ql=p.ql;qi=p.qi
read=lambda path:json.loads(path.read_text(encoding='utf-8'))
sha=lambda b:hashlib.sha256(b).hexdigest()
def eliteral(s):return "E'"+s.replace('\\','\\\\').replace("'","''").replace('\r','\\r').replace('\n','\\n').replace('\t','\\t')+"'"
def execute_definition(s):return 'do $definition$ begin execute '+eliteral(s)+';end $definition$;'
def normsig(s):return 'public.'+s if s.startswith('rpc_') else s
manifest=read(PKG/'manifest.json');original=read(PKG/'baseline.json');candidate=(PKG/'candidate.rollback.sql').read_bytes()
assert sha(candidate)==manifest['candidateSha256'] and sha((PKG/'baseline.json').read_bytes())==manifest['baselineSha256']
comparison=read(ROOT/'closure108-semantic-comparison.json');check=read(ROOT/'closure108-check-proof.json')
surface=read(ROOT/'closure108-full-local.json');dev=read(ROOT/'closure108-full-dev-v2.json')
assert check['state']=='CHECK_DEPARSE_ROUNDTRIP_EQUIVALENT_ON_LOCAL_PG17_11' and check['negativeControls']==2
assert not comparison['supplement'] and not comparison['supplementaryFunctions'] and not comparison['invalidation']['semanticDifferences']
assert len(comparison['invalidation']['catalogIdentityDifferences'])==14 and len(comparison['full']['catalogIdentityDifferences'])==418
diff= comparison['full']['semanticDifferences'];assert len(diff)==11
for d in diff:
 if d['surface']=='components':assert d['field']=='invalidationSurface';continue
 assert d['surface']=='schemaTables' and d['field']=='constraints'
 changed=[(a,b) for a,b in zip(d['expected'],d['actual']) if a!=b];assert len(changed)==1
 records=[r for r in check['pairs'] if r['table']==d['id']];assert len(records)==1
 pair=records[0]['sourcePair'];assert changed[0]==(pair['expected'],pair['observed'])
 for side,text in [('expected',pair['expected']),('observed',pair['observed'])]:assert sha(text.encode())==pair[side+'Sha256']
 ast={a['name']:a for a in records[0]['asts']}
 assert re.sub(r':location -?[0-9]+',':location -1',ast['expected']['raw'])==re.sub(r':location -?[0-9]+',':location -1',ast['observed']['raw'])
for x in [surface,dev]:
 assert len(x['surface']['functions'])==153 and sum(f['sourceMember'] for f in x['surface']['functions'])==108
 for component,projected in [('sourceDigest','projectedSourceDigest'),('programDigest','projectedProgramDigest')]:assert x['surface']['components'][component]==x['surface'][projected]
full_sql=(ROOT/'closure108-full-diagnostic.sql').read_text(encoding='utf-8')
assert json.loads(p.psql(full_sql,db=PARENT,name='transition-fresh-parent-surface').stdout)==surface
SOURCE='private.closure_source_digest_v5()';PROGRAM='private.closure_erasure_program_digest_v5()';READY='private.retention_ai_source_ready()'
SIGS=[SOURCE,PROGRAM,READY]+[normsig(s) for s in manifest['sourceBodyMd5']]
snapshot_expr="""jsonb_build_object('digest',private.closure_source_digest_v5(),'ready',private.retention_ai_source_ready(),'binding',private.closure_erasure_binding_v5(),
 'source',(select to_jsonb(x) from private.closure_source_v5 x where singleton),'erasure',(select to_jsonb(x) from private.closure_erasure_source_v5 x where singleton),
 'datasets',(select jsonb_agg(to_jsonb(x) order by data_class) from private.closure_dataset_catalog_v5 x),'export',private.data_export_dataset_catalog(),
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'metadata',to_jsonb(p)) order by p.oid::regprocedure::text) from pg_proc p where p.oid in(select to_regprocedure(s) from unnest(array["""+','.join(ql(s) for s in SIGS)+""" ]::text[])s)),
 'shape',(select jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid),'validated',convalidated,'noInherit',connoinherit,'deferrable',condeferrable,'deferred',condeferred) from pg_constraint where conrelid='public.notification_push_attempts'::regclass and conname='push_single_target_shape_v1'))"""
def snapshot():return json.loads(p.psql('set search_path=pg_catalog;select '+snapshot_expr+';',db=DB,name='transition-snapshot').stdout)
def function(snap,sig):return next(f for f in snap['functions'] if f['signature']==normsig(sig))
def checkpoint(label,snap): (OUT/(label+'.json')).write_text(json.dumps(snap,indent=2)+'\n',encoding='utf-8')
def txguard():
 return "begin;set local search_path=pg_catalog;set local statement_timeout='40s';set local lock_timeout='3s';do $local$ begin if current_database()<>"+ql(DB)+" or inet_server_addr()<>inet '127.0.0.1' or inet_server_port()<>55439 or session_user<>'postgres' then raise exception 'WRONG_LOCAL_TARGET';end if;end $local$;\n"
def locks():return "lock table private.closure_executions_v5 in share mode;lock table private.closure_source_v5,private.closure_erasure_source_v5,private.closure_dataset_catalog_v5 in share row exclusive mode;lock table public.notification_push_attempts in share row exclusive mode;\n"
def expect_snapshot(snap,error):return 'if ('+snapshot_expr+') is distinct from '+ql(json.dumps(snap))+'::jsonb then raise exception '+ql(error)+';end if;'
def precondition(snap,revert=False):
 return locks()+"do $pre$ begin if exists(select 1 from private.closure_executions_v5 where state='EXECUTING') then raise exception 'EXECUTING_CLOSURE';end if;"+("if exists(select 1 from public.notification_push_attempts where single_target_admission is not null and single_target_admission->>'eventType' is distinct from 'MESSAGE_RECEIVED') then raise exception 'OPPORTUNITY_ADMISSIONS_PREVENT_EXACT_REVERT';end if;" if revert else '')+"if exists(select 1 from public.notification_push_attempts where transport_state='SEND_STARTED' or lease_until>clock_timestamp()) then raise exception 'ACTIVE_TRANSPORT';end if;"+expect_snapshot(snap,'CERTIFICATE_PRECONDITION')+'end $pre$;\n'
def rebind(snap):
 old=snap['digest'];definition=function(snap,READY)['definition'];assert definition.count(old)==1
 return """do $bind$ declare fresh text;affected integer;begin fresh:=private.closure_source_digest_v5();
 if fresh is null or fresh="""+ql(old)+""" or fresh!~'^[0-9a-f]{64}$' then raise exception 'INVALID_NEW_DIGEST';end if;
 update private.closure_source_v5 set sha256=fresh where singleton and sha256="""+ql(old)+""";get diagnostics affected=row_count;if affected<>1 then raise exception 'SOURCE_CARDINALITY';end if;
 update private.closure_erasure_source_v5 set sha256=fresh where singleton and sha256="""+ql(old)+""";get diagnostics affected=row_count;if affected<>1 then raise exception 'ERASURE_CARDINALITY';end if;
 execute replace("""+eliteral(definition)+','+ql(old)+""",fresh);
 if private.retention_ai_source_ready() is distinct from true or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from fresh then raise exception 'BINDING_FAILED';end if;end $bind$;\n"""
def verify_unchanged(before,after,changed):
 assert before['datasets']==after['datasets'] and before['export']==after['export']
 for f in before['functions']:
  g=function(after,f['signature']);a=f['metadata'].copy();b=g['metadata'].copy()
  if f['signature'] in changed:a.pop('prosrc');b.pop('prosrc')
  assert a==b,('FUNCTION_METADATA_CHANGED',f['signature'])
  if f['signature'] not in changed:assert f==g
def run(sql,label):
 (OUT/(label+'.sql')).write_bytes(sql.encode());r=p.psql(sql,db=DB,name='cert108-'+label,check=False)
 if r.returncode:
  (OUT/(label+'.stderr.log')).write_bytes(r.stderr);raise RuntimeError(label+': SQL_FAILED')
 return r
receipt={'state':'FAILED','database':DB,'parent':PARENT,'devWrites':0,'providerCalls':0,'httpCalls':0,'rosterBefore':108,'rosterAfter':108,'cases':[],
 'candidateSha256':manifest['candidateSha256'],'harnessSha256':sha(Path(__file__).read_bytes()),'evidencePins':{n:sha((ROOT/n).read_bytes()) for n in ['closure108-full-dev-v2.json','closure108-full-local.json','closure108-supplement-dev.json','closure108-supplement-local.json','closure108-semantic-comparison.json','closure108-check-proof.json','closure108-check-pairs.json']}}
p.psql('create database '+qi(DB)+' template '+qi(PARENT)+';',db='postgres',name='cert108-proof-create')
try:
 before=snapshot();checkpoint('00-cloud-binding-in-local-catalog',before)
 assert not before['ready'] and before['binding'] is None and before['digest']==surface['surface']['components']['sourceDigest']
 old=before['source']['sha256'];fresh=before['digest'];assert before['erasure']['sha256']==old and old==dev['surface']['components']['sourceDigest']
 definition=function(before,READY)['definition'];assert definition.count(old)==1
 fixture=txguard()+precondition(before)+execute_definition(definition.replace(old,fresh))+'\n'
 fixture+='update private.closure_source_v5 set sha256='+ql(fresh)+' where singleton and sha256='+ql(old)+';update private.closure_erasure_source_v5 set sha256='+ql(fresh)+' where singleton and sha256='+ql(old)+';'
 fixture+="do $post$ begin if private.retention_ai_source_ready() is distinct from true or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from "+ql(fresh)+" then raise exception 'LOCAL_FIXTURE_BINDING_FAILED';end if;end $post$;commit;"
 run(fixture,'01-local-catalog-fixture');base=snapshot();checkpoint('01-coherent-local-baseline',base)
 assert base['ready'] and base['digest']==fresh and base['source']['sha256']==fresh and base['erasure']['sha256']==fresh and base['binding']['sourceSha256']==fresh
 verify_unchanged(before,base,[READY]);assert function(base,READY)['definition']==definition.replace(old,fresh)
 receipt['cases'].append('faithful-local-catalog-fixture-binding')
 patch=candidate.decode();assert patch.endswith('rollback;\n');patch=patch[patch.index('begin;\n')+7:-len('rollback;\n')]
 post="do $post$ begin if private.closure_source_digest_v5()="+ql(base['digest'])+" or private.retention_ai_source_ready() is distinct from false or private.closure_erasure_binding_v5() is not null then raise exception 'CANDIDATE_DID_NOT_CLOSE_READINESS';end if;"
 for sig,h in manifest['candidateBodyMd5'].items():post+='if (select md5(prosrc) from pg_proc where oid='+ql(normsig(sig))+"::regprocedure) is distinct from "+ql(h)+" then raise exception 'BODY_DRIFT';end if;"
 post+='end $post$;\n'
 install=txguard()+precondition(base)+'set local search_path=pg_catalog,public;\n'+patch+'\nset local search_path=pg_catalog;\n'+post+rebind(base)+'commit;\n'
 run(install,'02-install');installed=snapshot();checkpoint('02-installed',installed)
 assert installed['ready'] and installed['digest']!=base['digest'] and installed['binding']['sourceSha256']==installed['digest']
 verify_unchanged(base,installed,[READY]+[normsig(s) for s in manifest['sourceBodyMd5']])
 assert function(installed,READY)['definition']==function(base,READY)['definition'].replace(base['digest'],installed['digest'])
 receipt['cases'].append('committed-install-closes-then-rebinds-readiness')
 revert=txguard()+precondition(installed,True)
 for f in original['functions']:revert+=execute_definition(f['definition'])+'\n'
 revert+='alter table public.notification_push_attempts drop constraint push_single_target_shape_v1;alter table public.notification_push_attempts add constraint push_single_target_shape_v1 '+base['shape']['definition']+';\n'
 revert+=execute_definition(function(base,READY)['definition'])+'\n'
 for table in ['closure_source_v5','closure_erasure_source_v5']:revert+='update private.'+table+' set sha256='+ql(base['digest'])+' where singleton and sha256='+ql(installed['digest'])+';\n'
 revert+='do $post$ begin '+expect_snapshot(base,'EXACT_REVERT_FAILED')+'end $post$;commit;\n'
 run(revert,'03-revert');assert snapshot()==base;receipt['cases'].append('committed-exact-pre-admission-revert')
 run(install,'04-reapply');assert snapshot()==installed;receipt['cases'].append('committed-reapply-identical-installed-snapshot')
 # Every negative uses a savepoint in a rolled-back transaction. The intentionally
 # corrupted state and the failed command must remain byte-exact across rejection.
 def negative(label,mutation,command,expected_error):
  core=command[command.index('\n')+1:] if False else command
  assert core.startswith(txguard()) and core.endswith('commit;\n')
  core=core[len(txguard()):-len('commit;\n')]
  sql=txguard()+mutation+'\nselect '+snapshot_expr+';savepoint attempt;\n\\set ON_ERROR_STOP off\n'+core+'\n\\set ON_ERROR_STOP on\nrollback to savepoint attempt;select '+snapshot_expr+';rollback;\n'
  r=run(sql,'negative-'+label);err=r.stderr.decode()
  assert expected_error in err,('WRONG_REJECTION',label,err[:200])
  records=[json.loads(line) for line in r.stdout.decode().splitlines() if line.startswith('{')];assert len(records)==2 and records[0]==records[1]
  assert snapshot()==installed
  receipt['cases'].append('rejected-without-side-effects:'+label)
 drift_def=function(installed,SOURCE)['definition'];assert '$function$' in drift_def
 drift_def=drift_def.replace('$function$', '$function$\n-- LOCAL NEGATIVE SOURCE DRIFT\n',1)
 negative('revert-source-drift',execute_definition(drift_def),revert,'CERTIFICATE_PRECONDITION')
 negative('revert-source-row-drift',"update private.closure_source_v5 set sha256=repeat('0',64) where singleton;",revert,'CERTIFICATE_PRECONDITION')
 drift_ready=function(installed,READY)['definition'].replace(installed['digest'],'f'*64)
 negative('revert-readiness-literal-drift',execute_definition(drift_ready),revert,'CERTIFICATE_PRECONDITION')
 # Return to baseline for the install-negative variants; negative() restores its
 # expected post-rollback observation to this baseline for these cases.
 run(revert,'05-revert-before-install-negatives');assert snapshot()==base
 installed_saved=installed;installed=base
 drift_def=function(base,SOURCE)['definition'].replace('$function$', '$function$\n-- LOCAL NEGATIVE SOURCE DRIFT\n',1)
 negative('install-source-drift',execute_definition(drift_def),install,'CERTIFICATE_PRECONDITION')
 negative('install-erasure-row-drift',"update private.closure_erasure_source_v5 set sha256=repeat('0',64) where singleton;",install,'CERTIFICATE_PRECONDITION')
 negative('install-readiness-literal-drift',execute_definition(function(base,READY)['definition'].replace(base['digest'],'f'*64)),install,'CERTIFICATE_PRECONDITION')
 run(install,'06-final-reapply');installed=installed_saved;assert snapshot()==installed
 receipt.update(state='LOCAL_CERTIFICATE_TRANSITION_PASS_PARTIAL_NEGATIVES',baselineDigest=base['digest'],candidateDigest=installed['digest'],limitations=['Local PG17.11 catalog fixture, not DEV recertification or byte-identical engine proof.','EXECUTING and post-admission revert guards not yet exercised by this runner.','No HTTP Auth, provider, phone or store acceptance.'])
finally:
 (OUT/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'state':receipt['state'],'database':DB,'directory':str(OUT),'cases':receipt['cases']}))
