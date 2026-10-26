import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {loadQaClassifierHandler} from './qa_classifier_edge_runtime.mjs';
import {readQaPolicyArtifact} from '../qa_policy_fixture.mjs';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,A=id(1),N=id(2),K=id(3),C=id(4),ATTEMPT=id(5),Q=id(6);
const sha=s=>createHash('sha256').update(s).digest('hex'),json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
const policy=readQaPolicyArtifact().artifact.document;
function fixture(config={}){
 const calls=[],reads=[],type=config.type??'ASK',input={type,needId:N,needRevision:1,questionId:type==='ASK'?null:Q,text:'Synthetic clarification',clientRequestId:K};
 const output=config.output??{outcome:'ALLOW',materiality:type==='ASK'?null:'NON_MATERIAL',ruleIds:['QA-SAFE-CLARIFICATION'],safeReasonCodes:['SAFE_PUBLIC_CLARIFICATION']};
 const status=(state='PROCESSING',patch={})=>({accountId:A,needId:N,clientRequestId:K,classificationId:C,type,needRevision:1,questionId:input.questionId,textSha256:sha(input.text),state,
  outcome:['READY','COMMITTED'].includes(state)?'ALLOW':state==='REJECTED'?output.outcome:null,
  materiality:['READY','COMMITTED','REJECTED'].includes(state)?output.materiality:null,safeReasonCodes:[],canCancel:['PROCESSING','READY'].includes(state),receipt:state==='COMMITTED'?
   type==='ASK'?{ok:true,questionId:Q,status:'PENDING_ANSWER',needRevision:1,idempotentReplay:false}:{ok:true,questionId:Q,status:'ANSWERED_PUBLIC',answerVersion:1,edited:false,idempotentReplay:false}:null,authoritative:true,...patch});
 const publicTask={title:'Synthetic public Task',description:'Task details supplied publicly',category:'moving',scheduleKind:'FLEXIBLE',startsAt:null,endsAt:null,requiredSlots:2,priceMode:'OFFERS',requesterPriceRsd:null,
  requiredSkills:[],requiredTools:[],requiredVehicles:[],requiredLicenses:[],minimumExperienceYears:null,verifiedIdentityRequired:false,criticalConditions:[],publicGeography:{executionLocationMode:'REMOTE',approximateCity:null,approximateArea:null,topology:{mode:'REMOTE',start:null,end:null,waypoints:null,serviceArea:null}}};
 const context={schemaVersion:'PRESELECTION_QA_CLASSIFIER_V1',type,sourceHash:'a'.repeat(64),policyHash:'b'.repeat(64),policy,taskSafetyPolicy:policy,publicTask,question:type==='ASK'?null:{text:'Synthetic question',answerText:null,answerVersion:null}};
 config.context?.(context);
 const env={SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'PUBLIC_SYNTHETIC',SUPABASE_SERVICE_ROLE_KEY:'PRIVATE_SYNTHETIC_SERVICE',GEMINI_API_KEY:'PRIVATE_SYNTHETIC_PROVIDER',AI_PROVIDER:'gemini',GEMINI_MODEL:'gemini-3.8-flash',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',USKOCI_QA_CLASSIFIER_ENABLED:'true',...config.env};
 const fetch=async(url,init={})=>{const body=init.body?JSON.parse(init.body):null;calls.push({url:String(url),body,init});
  if(url.endsWith('/auth/v1/user'))return config.auth?.()??json({id:A,role:'authenticated'});
  if(url.endsWith('/rpc_claim_qa_classification_service'))return config.claim?.()??json({status:status(config.replay??'PROCESSING'),claim:config.replay?null:{attemptId:ATTEMPT,leaseExpiresAt:new Date(Date.now()+60000).toISOString(),context}});
  if(url.endsWith('/rpc_ai_test_budget_reserve_service'))return json(config.budget??{admitted:true,reservationId:id(8),replay:false,code:'AI_TEST_RESERVED'});
  if(url.endsWith('/rpc_dispatch_qa_classification_service'))return config.dispatch?.()??json(true);
  if(url.endsWith('/rpc_fail_qa_classification_service'))return config.fail?.(init)??json(status('CANCELLED',{safeReasonCodes:['QA_PROCESSING_FAILED']}));
  if(url.startsWith('https://generativelanguage.googleapis.com/'))return config.provider?.(init)??json({candidates:[{finishReason:config.finishReason??'STOP',content:{parts:[{text:JSON.stringify(output)}]}}]});
  if(url.endsWith('/rpc_complete_qa_classification_service'))return config.complete?.()??json(status(config.completeState??(output.outcome==='ALLOW'?'READY':'REJECTED')));
  if(url.endsWith('/rpc_submit_classified_preselection_qa'))return json(status(config.submitState??'COMMITTED',config.finalPatch));
  assert.fail('UNEXPECTED_ROUTE');};
 const runtime=loadQaClassifierHandler({fetch,env:name=>{reads.push(name);return env[name];},setTimeout:config.setTimeout});
 return {calls,reads,input,status,invoke:(patch={},signal)=>runtime.handler(new Request('https://edge.invalid',{method:'POST',signal,headers:{Authorization:'Bearer SYNTHETIC_CALLER','Content-Type':'application/json'},body:JSON.stringify({...input,...patch})}))};
}
const providers=f=>f.calls.filter(c=>c.url.startsWith('https://generativelanguage.googleapis.com/'));
const completes=f=>f.calls.filter(c=>c.url.endsWith('/rpc_complete_qa_classification_service'));
const submits=f=>f.calls.filter(c=>c.url.endsWith('/rpc_submit_classified_preselection_qa'));
test('actual handler binds Auth and durable dispatch before Gemini then submits with caller JWT through canonical wrapper',async()=>{
 const f=fixture(),r=await f.invoke();assert.equal(r.status,200);assert.equal((await r.json()).state,'COMMITTED');assert.equal(providers(f).length,1);assert.equal(completes(f).length,1);assert.equal(submits(f).length,1);
 assert.equal(submits(f)[0].init.headers.Authorization,'Bearer SYNTHETIC_CALLER');assert.equal(submits(f)[0].body.p_expected_user_id,A);
 const sent=JSON.stringify(providers(f)[0].body);for(const secret of[A,N,K,C,'PRIVATE_SYNTHETIC_SERVICE','PRIVATE_SYNTHETIC_PROVIDER','sourceHash','policyHash'])assert.ok(!sent.includes(secret));
 assert.ok(sent.includes('Synthetic public Task'));assert.ok(sent.includes('Synthetic clarification'));
 assert.equal(providers(f)[0].body.generationConfig.maxOutputTokens,8192);assert.ok(f.calls.findIndex(c=>c.url.includes('rpc_dispatch_qa'))<f.calls.findIndex(c=>c.url.includes('googleapis')));
});
test('READY replay uses canonical submission with no provider or paid flag dependency',async()=>{const f=fixture({replay:'READY',env:{USKOCI_QA_CLASSIFIER_ENABLED:''}});assert.equal((await f.invoke()).status,200);assert.equal(providers(f).length,0);assert.equal(submits(f).length,1);assert.equal(f.calls.filter(c=>c.url.includes('budget')).length,0);});
for(const type of['ASK','ANSWER'])test(`${type} typed receipt preserves the complete canonical envelope except its validated success marker`,async()=>{
 const f=fixture({type,replay:'READY'}),canonical=f.status('COMMITTED'),r=await f.invoke();assert.equal(r.status,200);
 const receipt=await r.json();assert.equal(canonical.receipt.ok,true);assert.equal(Object.hasOwn(receipt.receipt,'ok'),false);
 assert.deepEqual(canonical,{...receipt,receipt:{...receipt.receipt,ok:true}});assert.equal(providers(f).length,0);
});
for(const patch of[{ok:false},{unexpected:'UNADMITTED_FIELD'}])test('canonical receipt false success or unknown field is rejected instead of broadly stripped',async()=>{
 const canonical=fixture().status('COMMITTED'),f=fixture({replay:'READY',finalPatch:{receipt:{...canonical.receipt,...patch}}});
 const r=await f.invoke();assert.equal(r.status,502);assert.equal((await r.json()).code,'QA_CLASSIFICATION_UNCONFIRMED');assert.equal(providers(f).length,0);
});
for(const state of['PROCESSING','COMMITTED','CANCELLED','STALE','REJECTED'])test(`${state} replay never invokes provider or a new canonical write`,async()=>{const f=fixture({replay:state});await f.invoke();assert.equal(providers(f).length,0);assert.equal(submits(f).length,0);});
for(const key of['USKOCI_GEMINI_PAID_TEST_ENABLED','USKOCI_QA_CLASSIFIER_ENABLED','GEMINI_MODEL','AI_PROVIDER'])test(`${key} must match exact approved configuration before billable work`,async()=>{const f=fixture({env:{[key]:'not-approved'}});await f.invoke();assert.equal(providers(f).length,0);assert.equal(completes(f).length,0);});
test('budget denial cannot dispatch provider or publish',async()=>{const f=fixture({budget:{admitted:false,reservationId:null,replay:false,code:'AI_TEST_BUDGET_EXHAUSTED'}});await f.invoke();assert.equal(providers(f).length,0);assert.equal(submits(f).length,0);});
test('expired real budget contract returns explicit503 without dispatch, provider, completion or publication',async()=>{
 const f=fixture({budget:{admitted:false,reservationId:null,replay:false,code:'AI_TEST_BUDGET_NOT_READY'}}),r=await f.invoke();
 assert.equal(r.status,503);assert.equal((await r.json()).code,'QA_TEST_BUDGET_NOT_ADMITTED');
 assert.equal(f.calls.filter(c=>c.url.endsWith('/rpc_ai_test_budget_reserve_service')).length,1);
 assert.equal(f.calls.filter(c=>c.url.endsWith('/rpc_dispatch_qa_classification_service')).length,0);
 assert.equal(providers(f).length,0);assert.equal(completes(f).length,0);assert.equal(submits(f).length,0);
});
for(const dispatch of[()=>json(false),()=>json({acquired:true}),()=>{throw new Error('UNKNOWN');}])test('uncertain/denied dispatch never invokes provider',async()=>{const f=fixture({dispatch});await f.invoke();assert.equal(providers(f).length,0);assert.equal(completes(f).length,0);});
for(const mutate of[c=>c.accountId=A,c=>c.publicTask.exactAddress='PRIVATE ADDRESS',c=>c.publicTask.publicGeography.latitude=44,c=>c.publicTask.publicGeography.topology.start={city:'BG',exactAddress:'SECRET'}])test('unexpected private/context fields fail closed before provider',async()=>{const f=fixture({context:mutate});await f.invoke();assert.equal(providers(f).length,0);});
test('MATERIAL answer records classification only and never publishes Task or Q&A',async()=>{const f=fixture({type:'ANSWER',output:{outcome:'CLARIFY',materiality:'MATERIAL',ruleIds:['QA-MATERIAL-CHANGE'],safeReasonCodes:['TASK_TERMS_CHANGE']}});const r=await f.invoke();assert.equal((await r.json()).state,'REJECTED');assert.equal(completes(f).length,1);assert.equal(submits(f).length,0);});
for(const patch of[{outcome:'ALLOW',materiality:'MATERIAL'},{ruleIds:['INVENTED']},{safeReasonCodes:['LEAKED_RAW_TEXT']},{extra:'PRIVATE'}, {materiality:null}])test('invalid answer output cannot create a decision or public row',async()=>{const f=fixture({type:'ANSWER',output:{outcome:'ALLOW',materiality:'NON_MATERIAL',ruleIds:['QA-SAFE-CLARIFICATION'],safeReasonCodes:['SAFE_PUBLIC_CLARIFICATION'],...patch}});await f.invoke();assert.equal(completes(f).length,0);assert.equal(submits(f).length,0);});
test('post-dispatch provider failure settles metadata without provider retry or fallback',async()=>{const f=fixture({provider:()=>{throw new Error('UNKNOWN_PROVIDER');}});await f.invoke();assert.equal(providers(f).length,1);assert.equal(completes(f).length,0);assert.equal(submits(f).length,0);assert.equal(failures(f).length,1);assert.ok(!f.calls.some(c=>new URL(c.url).hostname==='api.openai.com'));});
test('cancel winning completion prevents canonical submission',async()=>{const f=fixture({completeState:'CANCELLED'});const r=await f.invoke();assert.equal((await r.json()).state,'CANCELLED');assert.equal(submits(f).length,0);});
test('cancel winning final submission returns cancellation without claiming publication',async()=>{const f=fixture({submitState:'CANCELLED'});const r=await f.invoke();assert.equal((await r.json()).state,'CANCELLED');});
test('wrong-account final receipt is rejected',async()=>{const f=fixture({finalPatch:{accountId:id(99)}});assert.equal((await f.invoke()).status,502);});
test('unverified Auth never reaches service claim or provider key',async()=>{const f=fixture({auth:()=>json({},401)});await f.invoke();assert.equal(f.calls.length,1);assert.ok(!f.reads.includes('GEMINI_API_KEY'));});
test('client account/model injection and oversized question fail before Auth',async()=>{for(const patch of[{accountId:id(99)},{model:'other'},{text:'a'.repeat(501)}]){const f=fixture();assert.equal((await f.invoke(patch)).status,400);assert.equal(f.calls.length,0);}});

for(const mutate of[c=>c.publicTask.category={private:'SECRET'},c=>c.publicTask.requiredSkills=[{private:'SECRET'}],c=>c.publicTask.criticalConditions=[{private:'SECRET'}],c=>c.publicTask.publicGeography.topology.mode={private:'SECRET'},c=>c.publicTask.publicGeography.approximateArea={private:'SECRET'},c=>c.publicTask.scheduleKind={private:'SECRET'},c=>c.publicTask.startsAt={private:'SECRET'}])test('nested private objects in known public fields fail closed',async()=>{const f=fixture({context:mutate});assert.equal((await f.invoke()).status,502);assert.equal(providers(f).length,0);});
for(const role of['anon','service_role',undefined])test('Auth requires authenticated user role',async()=>{const f=fixture({auth:()=>json({id:A,role})});assert.equal((await f.invoke()).status,401);assert.equal(f.calls.length,1);});
test('same-key changed-body receipt cannot finalize another payload',async()=>{const f=fixture({finalPatch:{textSha256:'f'.repeat(64)}});assert.equal((await f.invoke()).status,502);});

const failures=f=>f.calls.filter(c=>c.url.endsWith('/rpc_fail_qa_classification_service'));
for(const config of[
 {provider:()=>{throw new Error('SYNTHETIC_PROVIDER_FAILURE');}},
 {finishReason:'MAX_TOKENS'},
 {output:{outcome:'INVENTED'}},
 {dispatch:()=>{throw new Error('SYNTHETIC_LOST_DISPATCH_ACK');}},
 {context:c=>{c.publicTask.privateField='REJECT_BEFORE_PROVIDER';}},
 {env:{USKOCI_QA_CLASSIFIER_ENABLED:'false'}},
 {complete:()=>{throw new Error('SYNTHETIC_LOST_COMPLETION_ACK');}},
])test('PKG040 owned failure settles once without provider replay or automatic publication',async()=>{
 const f=fixture(config),r=await f.invoke();assert.ok(r.status>=400);
 assert.equal(failures(f).length,1);assert.deepEqual(failures(f)[0].body,{p_account_id:A,p_need_id:N,p_client_request_id:K,p_attempt_id:ATTEMPT});
 assert.equal(failures(f)[0].init.signal.aborted,true);assert.ok(providers(f).length<=1);assert.equal(submits(f).length,0);
});
test('PKG040 disconnect uses an independent cleanup signal',async()=>{
 const abort=new AbortController();let cleanupWasLive=false;
 const f=fixture({provider:()=>{abort.abort();throw new Error('DISCONNECTED');},fail:init=>{cleanupWasLive=!init.signal.aborted;return json({});}});
 await f.invoke({},abort.signal);assert.equal(failures(f).length,1);assert.equal(cleanupWasLive,true);assert.equal(providers(f).length,1);
});
test('PKG040 provider and uncooperative cleanup are bounded without replay',async()=>{
 const timers=[],f=fixture({setTimeout:(fn,ms)=>{timers.push(ms);return setTimeout(fn,ms===30000||ms===5000?5:ms);},
  provider:()=>new Promise(()=>{}),fail:()=>new Promise(()=>{})});
 const r=await f.invoke();assert.equal(r.status,502);assert.equal(failures(f).length,1);assert.equal(providers(f).length,1);
 assert.ok(timers.includes(30000));assert.ok(timers.includes(5000));assert.equal(submits(f).length,0);
});
test('PKG040 uncertain claim never settles an attempt it does not own',async()=>{
 const f=fixture({claim:()=>{throw new Error('CLAIM_ACK_LOST');}});await f.invoke();assert.equal(failures(f).length,0);assert.equal(providers(f).length,0);
});
test('PKG040 successful and replayed classifications never invoke failure cleanup',async()=>{
 for(const config of[{}, {replay:'READY'},{replay:'COMMITTED'},{completeState:'CANCELLED'}]){
  const f=fixture(config);await f.invoke();assert.equal(failures(f).length,0);
 }
});
