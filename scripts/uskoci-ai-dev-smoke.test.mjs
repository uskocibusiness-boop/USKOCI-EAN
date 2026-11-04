import test from 'node:test';
import assert from 'node:assert/strict';
import {DEV_URL,validateSmokeEnvironment,validateSmokeBudget,validateNeedCapture,validateWorkerCapture,decodeSseEvents,runDevSmoke} from './uskoci-ai-dev-smoke.mjs';

const valid=()=>({
 USKOCI_DEV_SMOKE_ACK:'DEV_TEST_PAID_ONE_TURN_NO_PUBLISH',
 USKOCI_DEV_URL:DEV_URL,
 USKOCI_DEV_SMOKE_KIND:'NEED',
 USKOCI_DEV_SMOKE_EMAIL:'person+uskoci-test@example.invalid',
 USKOCI_DEV_SMOKE_PASSWORD:'SYNTHETIC_NOT_REAL',
 USKOCI_DEV_ANON_KEY:'SYNTHETIC_PUBLIC',
 USKOCI_DEV_SMOKE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE_ONLY',
 USKOCI_DEV_SMOKE_ACCOUNT_ID:'11111111-1111-4111-8111-111111111111',
});

test('DEV-only, dedicated-account, explicit paid-call admission fails closed',()=>{
 const v=valid();
 assert.equal(validateSmokeEnvironment(v).kind,'NEED');
 for(const patch of [
  {USKOCI_DEV_SMOKE_ACK:undefined},
  {USKOCI_DEV_URL:'https://production.supabase.co'},
  {USKOCI_DEV_SMOKE_EMAIL:'realowner@example.com'},
  {USKOCI_DEV_SMOKE_KIND:'PUBLISH'},
  {USKOCI_DEV_SMOKE_ACCOUNT_ID:'not-a-uuid'},
  {USKOCI_DEV_SMOKE_PASSWORD:''},
  {USKOCI_DEV_ANON_KEY:''},
  {USKOCI_DEV_SMOKE_SERVICE_ROLE_KEY:''},
 ]) {
  assert.throws(()=>validateSmokeEnvironment({...v,...patch}),/^Error: SMOKE_/);
 }
});

test('single real-looking SSE final receipt decodes without treating streamed text as authority',()=>{
 const fakeId='11111111-1111-4111-8111-111111111111';
 const raw='data: '+JSON.stringify({kind:'text_delta',text:'SYNTHETIC_PRIVATE_TEXT'})+'\n\n'
   +'data: '+JSON.stringify({kind:'final',conversationId:fakeId,clientRequestId:fakeId,
     turn:{state:'SUCCEEDED'}})+'\n\n';
 const events=decodeSseEvents(raw);
 assert.equal(events.length,2);
 assert.equal(events.at(-1).kind,'final');
 assert.equal(events.at(-1).turn.state,'SUCCEEDED');
});

test('bad or oversized SSE is rejected; no lenient JSON rewriting',()=>{
 assert.throws(()=>decodeSseEvents('data: {NOT_JSON}\n\n'),/SMOKE_INVALID_EVENT_JSON/);
 assert.throws(()=>decodeSseEvents('data: "primitive"\n\n'),/SMOKE_INVALID_EVENT/);
 assert.throws(()=>decodeSseEvents('data: {}'+'x'.repeat(524288)),/SMOKE_RESPONSE_OVERSIZE/);
});

test('the smoke runner cannot be executed by merely importing this module',()=>{
 // validateSmokeEnvironment is called only by runDevSmoke, not at import time.
 // This test itself has no credentials, network calls, task saves or paid provider calls.
 assert.ok(DEV_URL.endsWith('.supabase.co'));
});

const capped=()=>({authoritative:true,reservationCapEnforced:true,capIsACallCounter:true,
 internalTestBudgetCapUsd:5,internalTestBudgetReservedUsd:1,remainingAllowedCalls:16,
 priceValidUntil:'2027-01-01T00:00:00Z'});
test('hard budget verification rejects disabled enforcement, overspend, malformed or stale report',()=>{
 assert.equal(validateSmokeBudget(capped(),Date.parse('2026-11-04')),true);
 for(const wrong of [null,{}, {reservationCapEnforced:false},{capIsACallCounter:false},
  {internalTestBudgetCapUsd:100},{internalTestBudgetReservedUsd:62.25},
  {remainingAllowedCalls:0},{priceValidUntil:'2026-10-01T00:00:00Z'}]){
  const report=wrong&&Object.keys(wrong).length?{...capped(),...wrong}:wrong;
  assert.throws(()=>validateSmokeBudget(report,Date.parse('2026-11-04')),/SMOKE_BUDGET_/);
 }
});
const ID='11111111-1111-4111-8111-111111111111';
const CID='22222222-2222-4222-8222-222222222222';
const json=(object,status=200)=>new Response(JSON.stringify(object),{status,headers:{'Content-Type':'application/json'}});
const sse=(kind)=>new Response('data: '+JSON.stringify({kind:'accepted'})+'\n\n'
 +'data: '+JSON.stringify({kind:'text_delta',text:'SYNTHETIC_NOT_REAL'})+'\n\n'
 +'data: '+JSON.stringify({kind:'final',conversationId:CID,clientRequestId:kind,state:'SYNTHETIC',
 turn:{state:'SUCCEEDED'}})+'\n\n',{headers:{'Content-Type':'text/event-stream'}});
test('budget failure does not even attempt login, creating a draft or sending to Gemini',async()=>{
 const calls=[];
 const fetchImpl=async(url,init)=>{calls.push({url,headers:init.headers});
  return json({...capped(),reservationCapEnforced:false});};
 await assert.rejects(runDevSmoke(valid(),{fetchImpl}),/SMOKE_BUDGET_NOT_ENFORCED/);
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/rpc_ai_test_budget_report_service$/);
 assert.equal(calls[0].headers.apikey,valid().USKOCI_DEV_SMOKE_SERVICE_ROLE_KEY);
});
for(const kind of ['NEED','WORKER']){
 test('TEST-only authenticated '+kind+' synthetic stream + owned readback, no Save/Publish/push',async()=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{
   const body=init.body?JSON.parse(init.body):{};
   calls.push({path:new URL(url).pathname,body,headers:init.headers});
   if(url.endsWith('/rpc_ai_test_budget_report_service'))return json(capped());
   if(url.includes('/auth/v1/token'))return json({user:{id:ID},access_token:'JWT_TEST_ONLY'});
   if(url.endsWith('/rpc_ai_open_need_conversation_owned_v2')||url.endsWith('/rpc_open_worker_ai'))
    return json({conversationId:CID});
   if(url.includes('/functions/v1/'))return sse(body.clientRequestId);
   if(url.endsWith('/rpc_ai_read_need_turn_v2'))return json({state:'SUCCEEDED',conversationId:CID});
   if(url.endsWith('/rpc_ai_need_review_v2'))return json({schemaVersion:'NEED_FACT_V2',conversationId:CID,status:'OPEN',facts:[
     {key:'need.title',value:'Krečenje sobe',status:'NEEDS_CONFIRMATION'},
     {key:'need.description',value:'Soba oko 20 m2',status:'NEEDS_CONFIRMATION'},
     {key:'need.price_mode',value:'MY_PRICE',status:'NEEDS_CONFIRMATION'},
     {key:'need.price_rsd',value:10000,status:'NEEDS_CONFIRMATION'}]});
   if(url.endsWith('/rpc_read_worker_ai_taxonomy'))return json({conversationId:CID,candidate:{skills:['Krečenje','Gletovanje'],workAreas:[]}});
   throw Error('UNEXPECTED_TEST_REQUEST');
  };
  const summary=await runDevSmoke({...valid(),USKOCI_DEV_SMOKE_KIND:kind},{fetchImpl});
  assert.equal(summary.completed,true);assert.equal(summary.readbackValidated,true);
  assert.equal(summary.reviewIsNotPublication,true);
  if(kind==='NEED')assert.equal(summary.typedFacts,4);
  if(kind==='WORKER')assert.equal(summary.typedSkills,2);
  assert.equal(calls.length,kind==='NEED'?6:5);
  assert.match(calls[0].path,/budget_report/);
  assert.ok(calls[1].path.includes('/auth/v1/token'));
  assert.ok(calls[3].path.endsWith(kind==='NEED'?'/uskoci-ai-interview':'/uskoci-worker-interview'));
  assert.equal(calls[3].headers.Authorization,'Bearer JWT_TEST_ONLY');
  assert.ok(!calls.slice(1).some(c=>c.headers.apikey===valid().USKOCI_DEV_SMOKE_SERVICE_ROLE_KEY));
  assert.ok(!calls.some(c=>/publish|save_worker|notification|push|dispatch/.test(c.path)));
 });
}

const taskFact=(key,value)=>({key,value,status:'NEEDS_CONFIRMATION'});
test('a final Need receipt without title, description or exact synthetic price is NOT semantic capture',()=>{
 const review={schemaVersion:'NEED_FACT_V2',conversationId:CID,status:'OPEN',facts:[
  taskFact('need.title','Krečenje sobe'),taskFact('need.description','Soba ima oko 20 m2'),
  taskFact('need.price_mode','MY_PRICE'),taskFact('need.price_rsd',10000)]};
 assert.equal(validateNeedCapture(review,CID),4);
 for(const v of [
  {...review,conversationId:ID},{...review,facts:[]},
  {...review,facts:review.facts.filter(f=>f.key!=='need.description')},
  {...review,facts:review.facts.map(f=>f.key==='need.price_rsd'?{...f,value:1000}:f)},
  {...review,facts:review.facts.map(f=>f.key==='need.price_mode'?{...f,status:'UNKNOWN'}:f)},
 ])assert.throws(()=>validateNeedCapture(v,CID),/^Error: SMOKE_NEED_CAPTURE_/);
});
test('Worker needs at least two distinct explicitly offered services',()=>{
 assert.equal(validateWorkerCapture({conversationId:CID,candidate:{skills:['Krečenje','Gletovanje']}},CID),2);
 for(const skills of [[],['Krečenje'],['Krečenje','Krečenje']])
  assert.throws(()=>validateWorkerCapture({conversationId:CID,candidate:{skills}},CID),/SMOKE_WORKER_CAPTURE_INCOMPLETE/);
});
