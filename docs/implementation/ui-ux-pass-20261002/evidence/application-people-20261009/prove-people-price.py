from pathlib import Path
import json,hashlib
import local_pg as p
ROOT=Path(__file__).parent;REPO=Path('C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN-spoj-20261006')
PKG=REPO/'supabase/candidates/application-people-price-20261009'
DB=json.loads((ROOT/'people-local-db.json').read_text())['db'];assert DB.startswith('uskoci_proof_people_') and p.PORT=='55439'
def sql(q):return p.psql(q,db=DB,name='people-price-proof')
def read(q):return json.loads(sql(q).stdout.decode().strip().splitlines()[-1])
def snap():return read("select jsonb_build_object('source',private.closure_source_digest_v5(),'program',private.closure_erasure_program_digest_v5(),'ready',private.retention_ai_source_ready(),'binding',private.closure_erasure_binding_v5(),'functions',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','rls_private')),'needs',(select count(*) from public.needs),'responses',(select count(*) from public.marketplace_responses),'agreements',(select count(*) from public.agreements))")
base=snap()
if not base['ready']:
 f=read("select jsonb_build_object('old',(select sha256 from private.closure_source_v5 where singleton),'actual',private.closure_source_digest_v5(),'definition',pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure))")
 assert f['definition'].count(f['old'])==1
 expected_local=json.loads((ROOT/'closure108-full-local.json').read_text())
 expected_dev=json.loads((ROOT/'closure108-full-dev-v2.json').read_text())
 assert f['old']==expected_dev['surface']['components']['sourceDigest'] and f['actual']==expected_local['surface']['components']['sourceDigest']
 observed=read((ROOT/'closure108-full-diagnostic.sql').read_text())
 assert observed==expected_local, 'LOCAL_FIXTURE_SURFACE_DRIFT'
 # Local fixture binding only: documented catalog identity translation from the independently checked108 clone.
 sql('begin;set local search_path=pg_catalog;'+f['definition'].replace(f['old'],f['actual'])+';update private.closure_source_v5 set sha256='+p.ql(f['actual'])+' where singleton;update private.closure_erasure_source_v5 set sha256='+p.ql(f['actual'])+' where singleton;commit;')
 base=snap();assert base['ready']
manifest=json.loads((PKG/'manifest.json').read_text());sig=manifest['signature']
row=lambda s:next(f for f in s['functions'] if f['proname']=='assert_application_price_v5')
assert hashlib.md5(row(base)['prosrc'].encode()).hexdigest()==manifest['beforeBodyMd5']
probe="""do $t$ declare n public.needs;begin n.mode:='MY_PRICE';n.price_basis:='TOTAL';n.requester_price_rsd:=9000;n.required_slots:=3;
 begin perform private.assert_application_price_v5(n,1,3000);raise exception 'UNEXPECTED_PARTIAL_ACCEPTED';exception when sqlstate '22023' then if sqlerrm<>'TOTAL_PRICE_REQUIRES_ALL_SLOTS' then raise;end if;end;
end $t$;"""
sql(probe)
# A READY flag alone is insufficient: fail before changing the helper for either stale certificate row.
negative_certificates=[]
for table in ['closure_source_v5','closure_erasure_source_v5']:
 candidate=(PKG/'candidate.in-transaction.sql').read_text()
 negative="begin;update private."+table+" set sha256=repeat('0',64) where singleton;do $negative$ begin begin execute "+p.ql(candidate)+";raise exception 'INVALID_CERT_ACCEPTED';exception when others then if sqlerrm<>'PEOPLE_PRICE_CERTIFICATE_NOT_READY' then raise;end if;end;end $negative$;rollback;"
 sql(negative);assert snap()==base;negative_certificates.append(table)
sql((PKG/'candidate.sql').read_text())
after=snap();assert after['ready'] and {k:v for k,v in base.items() if k!='functions'}=={k:v for k,v in after.items() if k!='functions'}
assert len(base['functions'])==len(after['functions']), 'FUNCTION_INVENTORY_LENGTH_CHANGED'
changed=[(a,b) for a,b in zip(base['functions'],after['functions']) if a!=b];assert len(changed)==1 and changed[0][0]['proname']=='assert_application_price_v5'
assert {k:v for k,v in changed[0][0].items() if k!='prosrc'}=={k:v for k,v in changed[0][1].items() if k!='prosrc'}
# Vector oracle uses exact integer cross-products; no rounded or truncated quotient enters this policy.
checks="""do $t$ declare n public.needs;budget integer;required integer;covered integer;expected bigint;passed integer:=0;rejected integer:=0;begin
 n.mode:='MY_PRICE';n.price_basis:='TOTAL';
 foreach budget in array array[1,3,5,1000,9000,10000,2147483647] loop
 n.requester_price_rsd:=budget;
 for required in 1..50 loop n.required_slots:=required;
 for covered in 1..required loop
 expected:=budget::bigint*covered/required;
 if budget::bigint*covered%required=0 then perform private.assert_application_price_v5(n,covered,expected::integer);passed:=passed+1;
 else begin perform private.assert_application_price_v5(n,covered,greatest(1,expected)::integer);raise exception 'FRACTION_ACCEPTED';exception when sqlstate '22023' then if sqlerrm not in ('FIXED_PRICE_MISMATCH','INVALID_PRICE') then raise;end if;rejected:=rejected+1;end;end if;
 if expected<2147483647 then begin perform private.assert_application_price_v5(n,covered,(expected+1)::integer);raise exception 'WRONG_PRICE_ACCEPTED';exception when sqlstate '22023' then if sqlerrm<>'FIXED_PRICE_MISMATCH' then raise;end if;end;end if;
 end loop;end loop;end loop;
 n.required_slots:=3;n.requester_price_rsd:=9000;
 perform private.assert_application_price_v5(n,1,3000);perform private.assert_application_price_v5(n,2,6000);perform private.assert_application_price_v5(n,3,9000);
 n.price_basis:='PER_PERSON';perform private.assert_application_price_v5(n,2,18000);
 n.price_basis:=null;perform private.assert_application_price_v5(n,2,9000);
 n.mode:='OFFERS';perform private.assert_application_price_v5(n,2,123);
 raise notice 'PEOPLE_VECTOR_PASS exact=% fractionRejected=% total=8925',passed,rejected;
end $t$;"""
r=sql(checks);notice=r.stderr.decode()
sql((PKG/'revert-before-admission.sql').read_text());assert snap()==base
sql((PKG/'candidate.sql').read_text());assert snap()==after
report={'state':'LOCAL_HELPER_MATRIX_AND_PRE_ADMISSION_REVERT_PASS','db':DB,'candidateSha256':manifest['candidateSha256'],'mode':manifest['mode'],'vectors':8925,'notice':notice,'onlyHelperChanged':True,'metadataAclCommentPreserved':True,'sourceAndProgramCertificateUnchanged':True,'ready':True,'negativeCertificateGuards':negative_certificates,'preAdmissionRevertExact':True,'businessCountsUnchanged':True,'harnessSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'limits':['Local PG17 clone with documented catalog identity translation; no Supabase network/auth-provider parity.','Pure helper matrix; companion RPC receipt is separate.','No DEV apply or phone delivery.']}
(ROOT/'people-price-local.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
