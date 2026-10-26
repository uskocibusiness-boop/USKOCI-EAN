// Exact handler + real disposable Auth/PostgREST/SQL. Provider transport is synthetic.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {loadQaClassifierHandler} from '../ai/qa_classifier_edge_runtime.mjs';
import {readQaPolicyArtifact,renderQaPolicyCandidate} from '../qa_policy_fixture.mjs';
const {assert,sql,rows,q,ok,denied,randomUUID,service,env,lockedRace}=rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL,'http://127.0.0.1:54321');
assert.equal(env.DB_URL,'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const mode=process.argv[2],path=env.PRE_V3_ARTIFACT_DIR+'/pkg040-report.json';
const report=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{package:'PKG-040',sourceSha:env.GITHUB_SHA,disposableDbOnly:true,providerCalls:0,checks:[]};
const sha=x=>createHash('sha256').update(x).digest('hex');
const save=()=>writeFileSync(path,JSON.stringify(report,null,2)+'\n');
const pass=name=>{report.checks.push({mode,name,result:'PASS'});save();console.log('PASS '+name);};
const closure=()=>rows("select private.closure_source_digest_v5() live,(select sha256 from private.closure_source_v5 where singleton) certified,private.retention_ai_source_ready() ready")[0];
const surface=()=>sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql','utf8')).split('\n').filter(Boolean);
const candidate='supabase/candidates/pkg040a_qa_failure_settlement.sql';
if(mode==='replay'){
 const text=readFileSync('supabase/candidates/pkg039a_intake_failure_settlement.sql','utf8');
 assert.equal(sha(text.replace(/\n$/,'')),'c9c18f0fee4a086404651b8e89c9e8cb48f4f06580d312289670c80b47680b3a');
 sql(text);report.closureBefore=closure();assert.equal(report.closureBefore.live,report.closureBefore.certified);assert.equal(report.closureBefore.ready,true);
 pass('EXACT_PKG039_PREDECESSOR_READY');process.exit(0);
}
if(mode==='apply'){
 const before=surface(),c=closure(),text=readFileSync(candidate,'utf8');report.migrationTextSha256=sha(text.replace(/\n$/,''));
 assert.throws(()=>sql(text.replace('1c35033cd2cd1f63b97d2d33f94abeb2','0'.repeat(32))),/PKG040A_PREDECESSOR_DRIFT/);assert.deepEqual(surface(),before);pass('WRONG_PREDECESSOR_REFUSED');
 assert.throws(()=>sql(text.replace("if c.state<>'PROCESSING' then", "if c.state='IMPOSSIBLE' then")),/PKG040A_BODY_MISMATCH/);assert.deepEqual(surface(),before);pass('TAMPERED_TERMINAL_OVERWRITE_REFUSED');
 sql(text);assert.throws(()=>sql(text),/PKG040A_ALREADY_APPLIED/);pass('APPLY_ONCE');
 const after=surface(),removed=before.filter(x=>!after.includes(x)),added=after.filter(x=>!before.includes(x));
 assert.deepEqual(removed,[]);assert.equal(added.length,1);assert.match(added[0],/rpc_fail_qa_classification_service/);
 report.surfaceAdded=added;pass('ONLY_SERVICE_FAILURE_FUNCTION_ADDED');
 assert.deepEqual(closure(),c);report.closureAfter=closure();pass('CERTIFICATE_UNCHANGED_READY');
 process.exit(0);
}
assert.ok(['before','after'].includes(mode));
// This reconstructed database exports no historical device credentials.
// Create explicit disposable actors through local Auth instead of assuming them.
const taskOwner=await rt.actor('pkg040-owner-'+mode);
const requesterProfile=sql("select id from public.app_profiles where account_id="+q(taskOwner.id)+" and kind='REQUESTER'");
assert.ok(requesterProfile);
if(sql("select count(*) from private.publication_policy_bundles where policy_id='PRESELECTION_QA_V1' and jurisdiction='RS' and version=1")==='0')sql(renderQaPolicyCandidate());
const bundle=sql("select id from private.publication_policy_bundles where policy_id='PRESELECTION_QA_V1' and jurisdiction='RS' and version=1");
const expectedPolicy=readQaPolicyArtifact().artifact.document;
expectedPolicy.rules.sort((a,b)=>a.ruleId.localeCompare(b.ruleId));
assert.deepEqual(JSON.parse(sql('select private.publication_policy_document('+q(bundle)+'::uuid)')),expectedPolicy);
sql(`update private.publication_policy_bundles set is_reviewed=true,is_active=true,reviewed_at=clock_timestamp(),activated_at=clock_timestamp(),review_provenance=review_provenance||'{"disposable040Fixture":true}'::jsonb where id=${q(bundle)}::uuid`);
report.policyFixture='DISPOSABLE_ONLY_REVIEWED_POLICY_ACTIVATION';
async function worker(label){
 const actor=await rt.actor('pkg040-'+label),p=await ok(actor.client.rpc('rpc_get_worker_profile_for_edit',{}));
 await ok(actor.client.from('app_profiles').update({display_name:'Disposable QA worker',skills:['Proof']}).eq('id',p.id));
 const location=await ok(actor.client.rpc('rpc_get_worker_location',{}));
 await ok(actor.client.rpc('rpc_save_worker_location',{p_expected_revision:location.revision,p_value:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:15,approximatePosition:{latitude:45.25,longitude:19.85}},p_confirmed:true}));
 await ok(actor.client.rpc('rpc_complete_worker_profile',{p_profile_id:p.id}));return actor;
}
let a=await worker(mode);
function need(){
 const nid=randomUUID();
 sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);select set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at,task_country_code,task_timezone)
 values(${q(nid)},${q(taskOwner.id)},${q(requesterProfile)},'PUBLISHED','PKG040 synthetic task','Disposable SQL fixture','PROOF','Novi Sad','Liman','OFFERS',2,'FLEXIBLE',clock_timestamp()+interval '2 days',clock_timestamp(),'RS','Europe/Belgrade');
 insert into public.need_geography(need_id,public_topology) values(${q(nid)},'{"mode":"STATIONARY","start":{"city":"Novi Sad","area":"Liman"}}');commit;`);
 return nid;
}
const input=(nid=need(),text='Da li postoji lift?')=>({p_account_id:a.id,p_type:'ASK',p_need_id:nid,p_need_revision:1,p_question_id:null,p_text:text,p_client_request_id:randomUUID()});
const ids=(i,c)=>({p_account_id:a.id,p_need_id:i.p_need_id,p_client_request_id:i.p_client_request_id,p_attempt_id:c.claim.attemptId});
const claim=i=>ok(service.rpc('rpc_claim_qa_classification_service',i));
const read=i=>ok(a.client.rpc('rpc_read_qa_classification',{p_expected_user_id:a.id,p_need_id:i.p_need_id,p_client_request_id:i.p_client_request_id}));
const output={outcome:'ALLOW',materiality:null,ruleIds:['QA-SAFE-CLARIFICATION'],safeReasonCodes:['SAFE_PUBLIC_CLARIFICATION']};
const complete=(i,c)=>ok(service.rpc('rpc_complete_qa_classification_service',{...ids(i,c),p_output:output}));
const fail=(i,c)=>ok(service.rpc('rpc_fail_qa_classification_service',ids(i,c)));
const stored=i=>rows(`select * from private.qa_ai_commands where account_id=${q(a.id)} and client_request_id=${q(i.p_client_request_id)}`)[0];
const dispatched=async()=>{const i=input(),c=await claim(i);assert.equal(await ok(service.rpc('rpc_dispatch_qa_classification_service',ids(i,c))),true);return{i,c};};
const clientArgs=i=>{const{p_account_id,...rest}=i;return{...rest,p_expected_user_id:p_account_id};};
const submit=i=>ok(a.client.rpc('rpc_submit_classified_preselection_qa',clientArgs(i)));
const count=i=>sql('select count(*) from private.preselection_qa_questions where need_id='+q(i.p_need_id));
if(mode==='after'){
 const {i,c}=await dispatched(),before=stored(i),ended=await fail(i,c);
 assert.equal(ended.state,'CANCELLED');assert.deepEqual(ended.safeReasonCodes,['QA_PROCESSING_FAILED']);
 const after=stored(i);for(const key of Object.keys(before))if(!['state','safe_reason_codes','updated_at'].includes(key))assert.deepEqual(after[key],before[key],key);
 assert.equal((await claim(i)).claim,null);assert.equal(await ok(service.rpc('rpc_dispatch_qa_classification_service',ids(i,c))),false);
 assert.equal((await complete(i,c)).state,'CANCELLED');assert.equal((await submit(i)).state,'CANCELLED');assert.equal(count(i),'0');
 await denied(a.client.rpc('rpc_ru4b_ask_preselection_question',{p_need_id:i.p_need_id,p_expected_revision:1,p_question_text:i.p_text,p_request_id:i.p_client_request_id}),'PRESELECTION_QA_POLICY_NOT_READY');
 pass('FAILED_ATTEMPT_TERMINAL_NO_REPLAY_LATE_COMPLETION_OR_PUBLICATION');
 const next={...i,p_text:'Da li je prilaz slobodan?',p_client_request_id:randomUUID()};assert.ok((await claim(next)).claim);pass('EXPLICIT_NEW_COMMAND_CAN_PROCEED');
 const wrong=await dispatched();await denied(service.rpc('rpc_fail_qa_classification_service',{...ids(wrong.i,wrong.c),p_attempt_id:randomUUID()}),'QA_CLASSIFICATION_NOT_FOUND');
 await denied(service.rpc('rpc_fail_qa_classification_service',{...ids(wrong.i,wrong.c),p_account_id:taskOwner.id}),'QA_CLASSIFICATION_NOT_FOUND');
 await denied(service.rpc('rpc_fail_qa_classification_service',{...ids(wrong.i,wrong.c),p_need_id:randomUUID()}),'QA_CLASSIFICATION_NOT_FOUND');
 await denied(a.client.rpc('rpc_fail_qa_classification_service',ids(wrong.i,wrong.c)));await denied(rt.anon.rpc('rpc_fail_qa_classification_service',ids(wrong.i,wrong.c)));
 assert.equal((await read(wrong.i)).state,'PROCESSING');pass('WRONG_ATTEMPT_OWNER_TASK_AND_PUBLIC_ROLES_DENIED');
 const fsql=(i,c)=>'select public.rpc_fail_qa_classification_service('+Object.values(ids(i,c)).map(v=>q(v)+'::uuid').join(',')+')';
 const csql=(i,c)=>'select public.rpc_complete_qa_classification_service('+Object.values(ids(i,c)).map(v=>q(v)+'::uuid').join(',')+','+q(JSON.stringify(output))+'::jsonb)';
 const one=await dispatched();assert.equal((await lockedRace(fsql(one.i,one.c),()=>complete(one.i,one.c))).state,'CANCELLED');
 const two=await dispatched();assert.equal((await lockedRace(csql(two.i,two.c),()=>fail(two.i,two.c))).state,'READY');
 const cancelled=await dispatched(),ci=clientArgs(cancelled.i),{p_text,...rest}=ci;
 await ok(a.client.rpc('rpc_cancel_qa_classification',{...rest,p_text_sha256:sha(p_text)}));const existing=stored(cancelled.i);await fail(cancelled.i,cancelled.c);assert.deepEqual(stored(cancelled.i),existing);
 const pre=input(),pc=await claim(pre);assert.equal((await fail(pre,pc)).state,'CANCELLED');assert.equal(stored(pre).provider_dispatched,false);
 pass('EXPLICIT_CANCELLATION_AND_PRE_DISPATCH_FAILURE_PRESERVED');
 const committed=await submit(two.i);assert.equal(committed.state,'COMMITTED');assert.deepEqual(await fail(two.i,two.c),committed);
 pass('OBSERVED_FAILURE_COMPLETION_BOTH_LOCK_ORDERS_READY_AND_COMMITTED_PRESERVED');
}
// Exact handler against this real schema. Never sends a network request to an AI provider.
a=await worker('edge-'+mode);
sql(`update private.ai_test_budget_v5 set enabled=true,reserved_microusd=0,price_valid_until=least(clock_timestamp()+interval '1 hour','2027-01-01T00:00:00Z') where singleton;
 insert into private.ai_test_accounts_v5(account_id) values(${q(a.id)}) on conflict do nothing`);
let token=(await ok(a.client.auth.getSession())).session.access_token;
const origin=new URL(env.RU5_DEVICE_SUPABASE_URL).origin;
let providerCalls=0,transportMode='PROVIDER_ERROR',settlementCalls=0;
const config={SUPABASE_URL:env.RU5_DEVICE_SUPABASE_URL,SUPABASE_ANON_KEY:env.RU5_DEVICE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY,
 AI_PROVIDER:'gemini',GEMINI_API_KEY:'SYNTHETIC_ONLY',GEMINI_MODEL:'gemini-3.8-flash',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',USKOCI_QA_CLASSIFIER_ENABLED:'true'};
const runtime=loadQaClassifierHandler({env:name=>config[name],fetch:async(url,init)=>{
 if(new URL(url).hostname==='generativelanguage.googleapis.com'){
  providerCalls++;if(transportMode==='PROVIDER_ERROR')throw new Error('SYNTHETIC_PROVIDER_FAILURE');
  return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(output)}]}}]}),{headers:{'Content-Type':'application/json'}});
 }
 assert.equal(new URL(url).origin,origin);if(url.endsWith('/rpc_fail_qa_classification_service'))settlementCalls++;
 const result=await fetch(url,init);
 if(result.ok&&((transportMode==='COMPLETE_ACK_LOST'&&url.endsWith('/rpc_complete_qa_classification_service'))||(transportMode==='SUBMIT_ACK_LOST'&&url.endsWith('/rpc_submit_classified_preselection_qa')))){await result.text();throw new Error('SYNTHETIC_LOST_ACK');}
 return result;
}});
const invoke=i=>runtime.handler(new Request('https://synthetic-edge.invalid',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
 body:JSON.stringify({type:'ASK',needId:i.p_need_id,needRevision:1,questionId:null,text:i.p_text,clientRequestId:i.p_client_request_id})}));
const failed=input();assert.equal((await invoke(failed)).status,502);assert.equal(providerCalls,1);assert.equal(settlementCalls,1);assert.equal(count(failed),'0');
assert.equal((await read(failed)).state,mode==='before'?'PROCESSING':'CANCELLED');await invoke(failed);assert.equal(providerCalls,1);
pass(mode==='before'?'EXACT_HANDLER_BEFORE_LEAVES_DISPATCH_BLOCKING':'EXACT_HANDLER_AFTER_SETTLES_NO_REPLAY');
if(mode==='after'){
 transportMode='COMPLETE_ACK_LOST';const lost=input();assert.equal((await invoke(lost)).status,502);assert.equal((await read(lost)).state,'READY');assert.equal(providerCalls,2);assert.equal(settlementCalls,2);
 transportMode='SUCCESS';assert.equal((await(await invoke(lost)).json()).state,'COMMITTED');assert.equal(providerCalls,2);assert.equal(count(lost),'1');
 pass('EXACT_HANDLER_LOST_COMPLETION_ACK_READBACK_READY_EXPLICIT_SUBMIT_NO_PROVIDER_REPLAY');
 // Independent scenario: respect the real account cooldown after the prior commit.
 a=await worker('edge-submit-ack');token=(await ok(a.client.auth.getSession())).session.access_token;
 sql('insert into private.ai_test_accounts_v5(account_id) values('+q(a.id)+')');
 transportMode='SUBMIT_ACK_LOST';const published=input();assert.equal((await invoke(published)).status,502);assert.equal((await read(published)).state,'COMMITTED');assert.equal(providerCalls,3);assert.equal(settlementCalls,2);
 transportMode='SUCCESS';assert.equal((await(await invoke(published)).json()).state,'COMMITTED');assert.equal(providerCalls,3);assert.equal(count(published),'1');
 pass('EXACT_HANDLER_LOST_PUBLICATION_ACK_PRESERVES_CANONICAL_RECEIPT');
}
report.edgeSourceHashes=runtime.sourceHashes;report.syntheticProviderCalls=providerCalls;report.actualAuth=true;report.actualPostgrest=true;report.actualEdgeGateway=false;
sql(`update private.publication_policy_bundles set is_active=false where id=${q(bundle)}`);
assert.deepEqual(closure(),mode==='before'?report.closureBefore:report.closureAfter);pass('SCENARIOS_LEAVE_CERTIFICATE_READY');save();
