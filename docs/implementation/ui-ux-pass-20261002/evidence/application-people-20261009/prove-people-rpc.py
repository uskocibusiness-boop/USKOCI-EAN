from pathlib import Path
import json,uuid,hashlib
import local_pg as p
ROOT=Path(__file__).parent;DB=json.loads((ROOT/'people-local-db.json').read_text())['db'];assert DB.startswith('uskoci_proof_people_')
u=lambda:str(uuid.uuid4());q=p.ql
r,w1,w2,w3=[{'id':u(),'requester':u(),'worker':u()} for _ in range(4)];need=u();stale=u();keep=u();sr=u();kr=u()
fixtures=''
for x in [r,w1,w2,w3]:
 fixtures+=f"insert into auth.users(id)values('{x['id']}');insert into public.app_accounts(id,email)values('{x['id']}','{x['id']}@proof.invalid');"
 fixtures+=f"insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,team_capacity,available_now) values('{x['requester']}','{x['id']}','REQUESTER','Local proof','Novi Sad','ACTIVE','{{}}',1,false),('{x['worker']}','{x['id']}','WORKER','Local proof','Novi Sad','ACTIVE','{{ciscenje}}',1,true);"
for n in [need,stale,keep]:
 fixtures+=f"insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,approximate_city,approximate_area,mode,required_slots,schedule_kind,published_at,task_timezone,revision,requester_price_rsd,price_basis,response_deadline)values('{n}','{r['id']}','{r['requester']}','PUBLISHED','People local proof','Disposable fixture','PROOF','{{}}','Novi Sad','Liman','MY_PRICE',3,'FLEXIBLE',statement_timestamp()-interval '1 hour','Europe/Belgrade',1,9000,'TOTAL',statement_timestamp()+interval '2 hours');"
for n,response_id in [(stale,sr),(keep,kr)]:
 fixtures+=f"update public.needs set revision=2 where id='{n}';insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,price_rsd,covered_slots,scope_note) values('{response_id}','{n}','{w3['id']}','{w3['worker']}','OFFER','STALE_REVIEW_REQUIRED',1,1,9000,3,'Old full-team offer');insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash)values('{response_id}',1,1,9000,3,'Old full-team offer',repeat('a',64));"
def actor(x):return "perform set_config('request.jwt.claim.sub',"+q(x['id'])+",true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims',"+q(json.dumps({'sub':x['id'],'role':'authenticated'}))+",true);"
def submit(w,n,k,cost,key):return f"public.rpc_submit_response('{n}',1,'{w['worker']}',{k},{cost},null,null,'Local proof','{key}')"
def select(n,result,key):return f"public.rpc_select_response('{n}',1,({result}->>'responseId')::uuid,({result}->>'version')::integer,{result}->>'contentHash','{key}')"
body=f"""do $rpc$ declare a jsonb;b jsonb;c jsonb;replayed jsonb;g uuid;g2 uuid;begin
 {actor(w3)}
 perform public.rpc_resolve_stale_response_after_need_edit('{sr}',1,2,'stale-update','UPDATE',1,3000,null,null,'Local changed headcount');
 perform public.rpc_resolve_stale_response_after_need_edit('{kr}',1,2,'stale-keep','KEEP',null,null,null,null,null);
 {actor(w1)}
 begin perform {submit(w1,need,0,3000,'bad-zero')};raise exception 'ZERO_PEOPLE_ACCEPTED';exception when sqlstate '22023' then if sqlerrm<>'INVALID_COVERED_SLOTS' then raise;end if;end;
 begin perform {submit(w1,need,4,12000,'bad-four')};raise exception 'TOO_MANY_PEOPLE_ACCEPTED';exception when sqlstate '22023' then if sqlerrm<>'NEED_REMAINING_CAPACITY_EXCEEDED' then raise;end if;end;
 begin perform {submit(w1,need,1,9000,'bad-price')};raise exception 'WRONG_PRICE_ACCEPTED';exception when sqlstate '22023' then if sqlerrm<>'FIXED_PRICE_MISMATCH' then raise;end if;end;
 a:={submit(w1,need,1,3000,'part-one')};
 replayed:={submit(w1,need,1,3000,'part-one')};
 if replayed->>'responseId' is distinct from a->>'responseId' or replayed->>'idempotentReplay' is distinct from 'true' then raise exception 'REPLAY_DRIFT';end if;
 begin perform {submit(w1,need,2,6000,'part-one')};raise exception 'CHANGED_REPLAY_ACCEPTED';exception when sqlstate '22023' then if sqlerrm<>'IDEMPOTENCY_KEY_REUSED' then raise;end if;end;
 {actor(w3)} c:={submit(w3,need,3,9000,'whole-team')};
 {actor(r)} g:={select(need,'a','choose-one')};
 begin perform {select(need,'c','overfill-open')};raise exception 'OVERFILL_ACCEPTED';exception when others then if sqlerrm<>'OVERFILL' then raise;end if;end;
 {actor(w2)} b:={submit(w2,need,2,6000,'remaining-two')};
 {actor(r)} g2:={select(need,'b','choose-two')};
 begin perform {select(need,'c','overfill')};raise exception 'OVERFILL_ACCEPTED';exception when others then if sqlerrm not in ('OVERFILL','NEED_NOT_OPEN','NEED_FULL') then raise;end if;end;
 insert into people_rpc_obs values('ids',jsonb_build_object('a',a,'b',b,'g1',g,'g2',g2));
end $rpc$;
"""
REPO=Path('C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN-spoj-20261006')
PKG=REPO/'supabase/candidates/application-people-price-20261009'
manifest=json.loads((PKG/'manifest.json').read_text())
candidate_sha=hashlib.sha256((PKG/'candidate.in-transaction.sql').read_bytes()).hexdigest()
assert candidate_sha==manifest['candidateSha256']
pins={**manifest['callerMd5'],manifest['signature']:manifest['afterBodyMd5']}
def read_pins():
 return json.loads(p.psql("select jsonb_object_agg(s,md5(p.prosrc)) from unnest(array["+','.join(q(s) for s in pins)+"]::text[]) s left join pg_proc p on p.oid=to_regprocedure(s)",db=DB,name='people-rpc-program-read').stdout)
assert read_pins()==pins, 'RPC_PROGRAM_DRIFT'
revert=(PKG/'revert-before-admission.sql').read_text();revert=revert[revert.index('begin;')+6:revert.rindex('commit;')]
blocked="reset role;do $barrier$ begin begin execute "+q(revert)+";raise exception 'REVERT_WAS_ALLOWED_AFTER_PARTIAL';exception when others then if sqlerrm<>'PEOPLE_PRICE_PARTIAL_ADMISSION_PREVENTS_REVERT' then raise;end if;end;end $barrier$;"
seq=json.loads(p.psql("select jsonb_build_object('last',(select last_value from private.marketplace_audit_log_id_seq),'max',(select coalesce(max(id),0) from private.marketplace_audit_log))",db=DB,name='people-rpc-seq-read').stdout)
if seq['last']<=seq['max']:
 assert seq['last']==1 and seq['max']==36, 'UNEXPECTED_FIXTURE_SEQUENCE'
 p.psql("select setval('private.marketplace_audit_log_id_seq',37,false)",db=DB,name='people-rpc-local-sequence-compatibility')
sql='begin;set local statement_timeout=\'90s\';create temporary table people_rpc_obs(k text,v jsonb) on commit drop;grant all on people_rpc_obs to authenticated;set local session_replication_role=replica;'+fixtures+'set local session_replication_role=origin;set local role authenticated;'+body+blocked+"select jsonb_build_object('observations',(select jsonb_object_agg(k,v) from people_rpc_obs),'stale',(select jsonb_agg(jsonb_build_object('price',price_rsd,'people',covered_slots,'version',current_version) order by covered_slots) from public.marketplace_responses where id in ('"+sr+"','"+kr+"')),'terms',(select jsonb_agg(jsonb_build_object('price',v.terms->>'price_rsd','people',v.terms->>'covered_slots') order by v.terms->>'covered_slots') from public.agreement_versions v join public.agreements a on a.id=v.agreement_id where a.need_id="+q(need)+"));rollback;"
(ROOT/'people-rpc-local.rollback.sql').write_text(sql,encoding='utf-8',newline='\n')
r=p.psql(sql,db=DB,name='people-rpc-local',check=False)
if r.returncode: print(r.stderr.decode()[-3000:]);raise SystemExit(r.returncode)
d=json.loads(r.stdout.decode().strip().splitlines()[-1]);assert d['stale']==[{'price':3000,'people':1,'version':2},{'price':9000,'people':3,'version':2}],d
assert d['terms']==[{'price':'3000','people':'1'},{'price':'6000','people':'2'}],d
assert read_pins()==pins, 'RPC_PROGRAM_CHANGED'
(ROOT/'people-rpc-local.json').write_text(json.dumps({'state':'LOCAL_RPC_PARTIAL_TOTAL_PASS','db':DB,'tests':['revert-blocked-after-partial-admission','stale-update-to1-at3000','stale-keep-legacy3-at9000','zero-rejected','over-required-rejected','wrong-price-rejected','submit1-at3000','identical-replay','changed-replay-rejected','submit3-at9000','select1','submit2-after-one-selected-at6000','select2','open-task-overfill-rejected','full-task-selection-rejected','agreement-terms-exact'],'terms':d['terms'],'fixturesRolledBack':True,'liveDev':False,'candidateSha256':candidate_sha,'programBodyMd5':pins,'localAuditSequenceBefore':seq,'revertSha256':hashlib.sha256((PKG/'revert-before-admission.sql').read_bytes()).hexdigest(),'fixtureBoundary':'Synthetic direct-DML seed with triggers/FK disabled ONLY during setup; real RPC calls with origin and authenticated role. Not profile/publication/HTTP/JWT-provider proof.','sqlSha256':hashlib.sha256(sql.encode()).hexdigest(),'harnessSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},indent=2)+'\n',encoding='utf-8');print('LOCAL_RPC_PARTIAL_TOTAL_PASS',d['terms'])
