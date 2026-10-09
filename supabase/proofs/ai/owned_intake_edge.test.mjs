// Synthetic Auth/claim/provider/receipt transport, never actual provider/DB proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadOwnedIntakeHandler} from './owned_intake_edge_runtime.mjs';
import {withDialogue} from './dialogue_fixture.mjs';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const account=id(1),conversation=id(2),key=id(3),turnId=id(4),attemptId=id(5);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const gemini=value=>json({candidates:[{content:{parts:[{text:JSON.stringify(withDialogue(value))}]},finishReason:'STOP'}]});
const receipt={userMessageId:id(6),assistantMessageId:id(7),proposedCount:0,safety:'ALLOW',schemaVersion:'NEED_FACT_V2',authoritative:true};
const turn=(state='SUCCEEDED')=>({conversationId:conversation,clientRequestId:key,state,turnId,retryAllowed:state==='FAILED',receipt:state==='SUCCEEDED'?receipt:null});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(config={}){
 const calls=[],envReads=[],logs=[];const env={SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_PUBLIC',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE',
  AI_PROVIDER:'gemini',GEMINI_API_KEY:'PRIVATE_PROVIDER_SECRET',GEMINI_MODEL:'gemini-3.8-flash',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',
  OPENAI_API_KEY:'UNAPPROVED_SYNTHETIC_KEY',OPENAI_MODEL:'synthetic-model',...config.env};
 let clock=Date.parse('2026-09-10T17:00:00Z');
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const fetch=async(input,init={})=>{
  const url=String(input),body=init.body?JSON.parse(init.body):null;calls.push({url,init,body});
  if(url.endsWith('/auth/v1/user'))return config.auth?.()??json({id:account});
  if(url.includes('/ai_conversations?'))return config.conversation?.()??json([{id:conversation,account_id:account,status:'OPEN',fact_schema_version:'NEED_FACT_V2'}]);
  if(url.endsWith('/rpc_ai_dispatch_need_turn_v2_service'))return config.dispatch?.(body)??json(true);
  if(url.endsWith('/rpc_ai_claim_need_turn_v2_service'))return config.claim?.(body)??json({turn:turn('PROCESSING'),claim:{attemptId,leaseExpiresAt:new Date(clock+90000).toISOString(),context:{schemaVersion:'NEED_FACT_V2',history:[],activeFacts:[]}}});
  if(url.endsWith('/rpc_ai_test_budget_reserve_service'))return config.budget?.(body)??json({admitted:true,reservationId:id(8),replay:false,code:'AI_TEST_RESERVED'});
  if(url.startsWith('https://generativelanguage.googleapis.com/'))return config.provider?.(init)??gemini({safety:'ALLOW',assistantMessage:'Proverite unos.',facts:[]});
  if(url.endsWith('/rpc_ai_complete_need_turn_v2_service'))return config.complete?.(body)??json(turn());
  if(url.endsWith('/rpc_ai_fail_need_turn_v2_service'))return json({...turn('FAILED'),retryAllowed:false});
  assert.fail('Unexpected synthetic route');
 };
 const runtime=loadOwnedIntakeHandler({env:name=>{envReads.push(name);return env[name];},fetch,Date:FixedDate,
  setTimeout:config.setTimeout??setTimeout,clearTimeout:config.clearTimeout??clearTimeout,log:args=>logs.push(args)});
 const request=(body={},options={})=>new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer SYNTHETIC_USER','Content-Type':'application/json'},
  body:JSON.stringify({conversationId:conversation,text:'SYNTHETIC_TEXT',clientRequestId:key,...body}),...options});
 return {...runtime,calls,envReads,logs,env,request,invoke:(body,options)=>runtime.handler(request(body,options)),advance:ms=>clock+=ms};
}
const providers=f=>f.calls.filter(x=>['generativelanguage.googleapis.com','api.openai.com'].includes(new URL(x.url).hostname));
const completes=f=>f.calls.filter(x=>x.url.endsWith('/rpc_ai_complete_need_turn_v2_service'));

test('verified Auth identity and owned context drive same stable command through exact completion',async()=>{
 const f=fixture();assert.deepEqual(await(await f.invoke()).json(),turn());
 const auth=f.calls[0],claim=f.calls.find(x=>x.url.endsWith('/rpc_ai_claim_need_turn_v2_service'));
 assert.equal(auth.url,'https://db.invalid/auth/v1/user');assert.equal(new Headers(auth.init.headers).get('Authorization'),'Bearer SYNTHETIC_USER');
 assert.deepEqual(claim.body,{p_account_id:account,p_conversation_id:conversation,p_client_request_id:key,p_user_message:'SYNTHETIC_TEXT'});
 assert.equal(new Headers(claim.init.headers).get('Authorization'),'Bearer SYNTHETIC_SERVICE');
 assert.equal(completes(f)[0].body.p_attempt_id,attemptId);assert.equal(completes(f)[0].body.p_client_request_id,key);
 assert.ok(!f.calls.some(x=>x.url.endsWith('/rpc_ai_apply_interview_turn_v2_service')));
 assert.ok(!JSON.stringify(providers(f)[0].body).includes(account));assert.deepEqual(f.logs,[]);
});
for(const state of ['SUCCEEDED','PROCESSING','FAILED'])test(`durable ${state} claim readback invokes no provider or completion`,async()=>{
 const f=fixture({claim:()=>json({turn:turn(state),claim:null})});const response=await f.invoke();
 assert.equal(response.status,{SUCCEEDED:200,PROCESSING:202,FAILED:409}[state]);assert.deepEqual(await response.json(),turn(state));
 assert.equal(providers(f).length,0);assert.equal(completes(f).length,0);assert.ok(!f.envReads.includes('OPENAI_API_KEY'));
});
for(const auth of [()=>json({id:account},401),()=>json({id:'not-an-id'}),()=>{throw new Error('PRIVATE_TOKEN');}])test('unverified Auth never reaches service secret or claim',async()=>{
 const f=fixture({auth});const response=await f.invoke();assert.equal(response.status,401);assert.equal(f.calls.length,1);
 assert.ok(!f.envReads.includes('SUPABASE_SERVICE_ROLE_KEY'));assert.ok(!JSON.stringify(await response.json()).includes('PRIVATE_TOKEN'));
});
test('Auth user/account mismatch cannot borrow an owned-query result',async()=>{
 const f=fixture({conversation:()=>json([{id:conversation,account_id:id(99),status:'OPEN',fact_schema_version:'NEED_FACT_V2'}])});
 assert.equal((await f.invoke()).status,404);assert.ok(!f.envReads.includes('SUPABASE_SERVICE_ROLE_KEY'));assert.equal(providers(f).length,0);
});
for(const body of [{clientRequestId:undefined},{clientRequestId:'invalid'},{accountId:id(99)},{text:'x'.repeat(4001)},{provider:'gemini'}])test(`strict V2 request rejects ${Object.keys(body).join(',')}`,async()=>{
 const f=fixture();assert.equal((await f.invoke(body)).status,400);assert.equal(providers(f).length,0);assert.equal(completes(f).length,0);
});
for(const mutation of [x=>x.turn.clientRequestId=id(99),x=>x.turn.conversationId=id(99),x=>x.turn.extra='PRIVATE',x=>x.claim.attemptId='bad',
 x=>x.claim.context.privateCoordinates={lat:42},x=>x.claim.context.activeFacts=[{fact_key:'need.resolved_location'}]])test('corrupt claim/context fails before provider',async()=>{
 const value={turn:turn('PROCESSING'),claim:{attemptId,leaseExpiresAt:'2026-09-10T17:01:30Z',context:{schemaVersion:'NEED_FACT_V2',history:[],activeFacts:[]}}};mutation(value);
 const f=fixture({claim:()=>json(value)});assert.equal((await f.invoke()).status,502);assert.equal(providers(f).length,0);assert.equal(completes(f).length,0);
});
for(const mutation of [x=>x.clientRequestId=id(99),x=>x.turnId=id(99),x=>x.receipt.proposedCount=1,x=>x.receipt.authoritative=false,
 x=>x.receipt.privateBody='LEAK',x=>x.receipt.assistantMessageId=x.receipt.userMessageId])test('malformed stored completion never becomes successful public acknowledgment',async()=>{
 const value=structuredClone(turn());mutation(value);const f=fixture({complete:()=>json(value)});const response=await f.invoke();
 assert.equal(response.status,502);assert.equal(completes(f).length,1);assert.ok(!JSON.stringify(await response.json()).includes('LEAK'));
});
test('provider 429 is fixed public failure, no fallback or materialization',async()=>{
 const f=fixture({provider:()=>new Response('PRIVATE_PROVIDER_SECRET',{status:429})});const r=await f.invoke();assert.equal(r.status,502);
 assert.equal(providers(f).length,1);assert.equal(completes(f).length,0);assert.equal((await r.json()).code,'AI_PROVIDER_FAILED');
 assert.ok(!JSON.stringify(f.logs).includes('PRIVATE_PROVIDER_SECRET'));
});

for(const diagnostics of [false,true]) for(const status of [402,429])
test(`HTTP provider ${status}, diagnostics=${diagnostics}: closed availability only for real 402, one settled attempt`,async()=>{
 const f=fixture({provider:()=>new Response('PRIVATE_PROVIDER_SECRET AI_CREDITS_UNAVAILABLE',{status})});
 const options=diagnostics?{headers:{Authorization:'Bearer SYNTHETIC_USER','Content-Type':'application/json','x-client-info':'uskoci-app/ai-availability-v1'}}:{};
 const response=await f.invoke({},options),data=await response.json();
 const admitted=diagnostics&&status===402;
 assert.equal(response.status,admitted?503:502);
 assert.equal(data.code,admitted?'AI_CREDITS_UNAVAILABLE':'AI_PROVIDER_FAILED');
 assert.equal(response.headers.get('x-uskoci-ai-availability'),admitted?'AI_CREDITS_UNAVAILABLE':null);
 assert.equal(providers(f).length,1);assert.equal(completes(f).length,0);
 assert.equal(f.calls.filter(x=>x.url.endsWith('/rpc_ai_fail_need_turn_v2_service')).length,1);
 assert.ok(!JSON.stringify([data,f.logs]).includes('PRIVATE_PROVIDER_SECRET'));
});
test('incomplete Gemini JSON output cannot reach materializer',async()=>{
 const f=fixture({provider:()=>json({candidates:[{content:{parts:[{text:'{"safety":"ALLOW",'}]},finishReason:'MAX_TOKENS'}]})});
 assert.equal((await f.invoke()).status,502);assert.equal(completes(f).length,0);
});
for(const mutate of [x=>x.safety='UNKNOWN',x=>x.privateToken='PRIVATE_RAW',x=>x.facts=[{key:'unknown.fact'}],
 x=>delete x.facts,x=>x.assistantMessage='x'.repeat(1201),x=>x.facts=Array(13).fill({}),
 x=>x.facts=[{key:'need.people_needed',valueJson:'"two"',displayValue:'2',confidence:0.9,evidence:'synthetic'}],
 x=>x.facts=[{key:'need.people_needed',valueJson:'2',displayValue:'2',confidence:'0.9',evidence:'synthetic'}]])test('corrupt provider output never persists a silently filtered subset',async()=>{
 const value={safety:'ALLOW',assistantMessage:'Proverite.',facts:[]};mutate(value);
 const f=fixture({provider:()=>gemini(value)});const response=await f.invoke();
 assert.equal(response.status,502);assert.equal(completes(f).length,0);assert.ok(!JSON.stringify(await response.json()).includes('PRIVATE_RAW'));
});
test('provider advertised and streamed oversize is bounded before completion',async()=>{
 for(const advertised of [true,false]){
  const f=fixture({provider:()=>new Response('x'.repeat(131073),{headers:advertised?{'content-length':'131073'}:{}})});
  assert.equal((await f.invoke()).status,502);assert.equal(completes(f).length,0);
 }
});
test('redirect behavior is explicitly disabled on all credential-bearing fetches',async()=>{
 const f=fixture();await f.invoke();assert.ok(f.calls.every(x=>x.init.redirect==='error'));
});
test('provider deadline ignores a transport that finishes after cancellation; no late completion',async()=>{
 const gate=deferred(),timers=new Map();let sequence=0;
 const f=fixture({provider:()=>gate.promise,setTimeout:(fn,ms)=>{const n=++sequence;timers.set(n,{fn,ms});return n;},clearTimeout:n=>timers.delete(n)});
 const running=f.invoke();while(!providers(f).length)await flush();
 const deadline=[...timers.values()].find(x=>x.ms===30000);assert.ok(deadline);deadline.fn();
 assert.equal((await running).status,502);assert.equal(completes(f).length,0);
 gate.resolve(gemini({safety:'ALLOW',assistantMessage:'late',facts:[]}));await flush();
 assert.equal(completes(f).length,0);assert.equal(providers(f)[0].init.signal.aborted,true);
});
test('request cancellation fences late provider response and duplicate active invoke',async()=>{
 const gate=deferred(),controller=new AbortController();const f=fixture({provider:()=>gate.promise});const running=f.invoke({}, {signal:controller.signal});
 while(!providers(f).length)await flush();assert.equal((await f.invoke()).status,429);controller.abort();
 assert.equal((await running).status,502);gate.resolve(gemini({safety:'ALLOW',assistantMessage:'late',facts:[]}));await flush();
 assert.equal(providers(f).length,1);assert.equal(completes(f).length,0);
});
test('per-user six/minute burst is bounded; window rollover permits a new call',async()=>{
 const f=fixture({claim:()=>json({turn:turn('SUCCEEDED'),claim:null})});for(let n=0;n<6;n++)assert.equal((await f.invoke()).status,200);
 assert.equal((await f.invoke()).status,429);f.advance(60001);assert.equal((await f.invoke()).status,200);assert.equal(providers(f).length,0);
});

for (const dispatch of [() => json(false), () => json({acquired:true}), () => json({},500), () => { throw new Error('UNKNOWN_DISPATCH'); }])
test('missing, denied or uncertain dispatch acknowledgment cannot call provider and only settles owned metadata', async () => {
 const f=fixture({dispatch}); await f.invoke(); assert.equal(providers(f).length,0); assert.equal(completes(f).length,0);
 assert.equal(f.calls.filter(c=>c.url.endsWith('/rpc_ai_fail_need_turn_v2_service')).length,1);
});
test('provider timeout/error after dispatch settles owned metadata without enabling a second attempt',async()=>{
 const f=fixture({provider:()=>{throw new Error('UNKNOWN_UPSTREAM');}});assert.equal((await f.invoke()).status,502);
 assert.equal(providers(f).length,1);assert.equal(f.calls.filter(c=>c.url.endsWith('/rpc_ai_fail_need_turn_v2_service')).length,1);
 assert.ok(f.calls.findIndex(c=>c.url.endsWith('/rpc_ai_dispatch_need_turn_v2_service'))<f.calls.indexOf(providers(f)[0]));
});

test('AF-D23 real provider request excludes unavailable identity fact and explains self-reported status',async()=>{
 const f=fixture();assert.equal((await f.invoke()).status,200);
 const body=providers(f)[0].body;
 assert.ok(!body.generationConfig.responseSchema.properties.facts.items.properties.key.enum.includes('need.verified_identity_required'));
 const instruction=body.systemInstruction.parts[0].text;
 assert.match(instruction,/identitet je samostalno naveden/);
 assert.match(instruction,/provera dokumenta, selfija ili spoljnim KYC servisom nije dostupna/);
 assert.match(instruction,/može nastaviti običnim Zadatkom/);
 assert.match(instruction,/Ne predlažite need\.verified_identity_required/);
 assert.equal(completes(f)[0].body.p_proposals.length,0);
});
for(const value of [true,false])test(`provider cannot bypass manual-only historical identity key with ${value}`,async()=>{
 const f=fixture({provider:()=>gemini({safety:'ALLOW',assistantMessage:'Synthetic unavailable explanation',facts:[
  {key:'need.title',valueJson:'"Ordinary task"',displayValue:'Ordinary task',evidence:'synthetic',confidence:1},
  {key:'need.verified_identity_required',valueJson:JSON.stringify(value),displayValue:value?'Da':'Ne',evidence:'synthetic',confidence:1},
 ]})});
 assert.equal((await f.invoke()).status,502);assert.equal(providers(f).length,1);assert.equal(completes(f).length,0);
 assert.equal(f.calls.filter(x=>x.url.endsWith('/rpc_ai_fail_need_turn_v2_service')).length,1);
});
