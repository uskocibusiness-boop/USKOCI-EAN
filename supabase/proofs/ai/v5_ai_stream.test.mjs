// Exact source under synthetic I/O. Not a provider or deployed-stream proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadOwnedIntakeHandler} from './owned_intake_edge_runtime.mjs';
import {withDialogue} from './dialogue_fixture.mjs';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const account=id(1),conversation=id(2),key=id(3),turnId=id(4),attemptId=id(5);
const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const receipt={userMessageId:id(6),assistantMessageId:id(7),proposedCount:0,safety:'ALLOW',schemaVersion:'NEED_FACT_V2',authoritative:true};
const turn=(state='SUCCEEDED')=>({conversationId:conversation,clientRequestId:key,state,turnId,retryAllowed:false,receipt:state==='SUCCEEDED'?receipt:null});
function fixture(config={}){
 const calls=[];const env={SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_PUBLIC',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE',
   AI_PROVIDER:'gemini',GEMINI_API_KEY:'SYNTHETIC_PROVIDER',GEMINI_MODEL:'gemini-3.8-flash',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',...config.env};
 const message=config.message??'Čujem te. Pregledaj zadatak 🟢.';
 const raw=JSON.stringify(withDialogue(config.output??{safety:'ALLOW',assistantMessage:message,facts:[]}));
 const providerStream=()=>{
   const fragments=config.fragments??Array.from(raw); // Real provider deltas, split at every character.
   const encoded=fragments.map((text,i)=>'data: '+JSON.stringify({candidates:[{content:{parts:[{text}]},...(i===fragments.length-1?{finishReason:config.finishReason??'STOP'}:{})}]})+'\r\n\r\n').join('');
   const bytes=new TextEncoder().encode(encoded);
   return new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=13)controller.enqueue(bytes.slice(i,i+13));controller.close();}}),{headers:{'Content-Type':'text/event-stream'}});
 };
 const fetch=async(url,init={})=>{
   const body=init.body?JSON.parse(init.body):null;calls.push({url:String(url),body,init,abortedAtCall:init.signal?.aborted});
   if(url.endsWith('/auth/v1/user'))return json({id:account});
   if(url.includes('/ai_conversations?'))return json([{id:conversation,account_id:account,status:'OPEN',fact_schema_version:'NEED_FACT_V2'}]);
   if(url.endsWith('/rpc_ai_dispatch_need_turn_v2_service'))return config.dispatch?.(body)??json(true);
  if(url.endsWith('/rpc_ai_claim_need_turn_v2_service'))return json({turn:turn(config.replay?'SUCCEEDED':'PROCESSING'),claim:config.replay?null:{attemptId,leaseExpiresAt:new Date(Date.now()+90000).toISOString(),context:{schemaVersion:'NEED_FACT_V2',history:[],activeFacts:config.activeFacts??[]}}});
   if(url.endsWith('/rpc_ai_test_budget_reserve_service'))return json(config.budget??{admitted:true,reservationId:id(8),replay:false,code:'AI_TEST_RESERVED'});
   if(url.startsWith('https://generativelanguage.googleapis.com/'))return config.provider?.(init)??providerStream();
   if(url.endsWith('/rpc_ai_complete_need_turn_v2_service')){if(config.completionError)throw Error('SYNTHETIC_COMPLETION_ACK_LOST');return json({...turn(),...(config.badReceipt?{turnId:id(99)}:{}),receipt:{...receipt,proposedCount:body.p_proposals.length,safety:body.p_safety}});}
   if(url.endsWith('/rpc_ai_fail_need_turn_v2_service'))return json(config.failureReceipt??turn('FAILED'));
   if(url.endsWith('/rpc_ai_test_record_usage_service'))return json({recorded:true});
   if(url.endsWith('/rpc_taxonomy_ai_catalog_context_service'))return json(config.catalog(body));
   if(url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'))return config.capture?.(body)??json({action:'HINT_CAPTURED',authority:'NONE'});
   assert.fail('UNEXPECTED_ROUTE');
 };
 const {handler}=loadOwnedIntakeHandler({fetch,env:name=>env[name],setTimeout:config.setTimeout});
 return {calls,message,invoke:()=>handler(new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer SYNTHETIC',Accept:'text/event-stream','Content-Type':'application/json',...config.headers},body:JSON.stringify({conversationId:conversation,clientRequestId:key,text:config.text??'SYNTHETIC_USER_TEXT'})}))};
}
async function events(f){const response=await f.invoke();assert.match(response.headers.get('content-type'),/text\/event-stream/);return (await response.text()).trim().split('\n\n').map(e=>JSON.parse(e.slice(6)));}
const providers=f=>f.calls.filter(c=>c.url.startsWith('https://generativelanguage.googleapis.com/'));
const writes=f=>f.calls.filter(c=>c.url.endsWith('/rpc_ai_complete_need_turn_v2_service'));
const failures=f=>f.calls.filter(c=>c.url.endsWith('/rpc_ai_fail_need_turn_v2_service'));
const activeFact=(key,value,valueType='TEXT')=>({fact_key:key,fact_value:value,value_type:valueType,display_value:JSON.stringify(value),
 fact_schema_version:'NEED_FACT_V2',status:'CONFIRMED',source:'USER_TEXT',created_at:'2026-10-18T12:00:00Z'});

// These fixtures prove the instruction delivered to the real handler's provider
// boundary and its existing ambiguity guard, not Gemini's language understanding.
for(const relation of ['UNCLEAR','DIFFERENT_TASK'])test(`work replacement ${relation} preserves old terms and asks before applying new work`,async()=>{
 const activeFacts=[activeFact('need.category','Krečenje'),activeFact('need.price_rsd',5000,'INTEGER'),
  activeFact('need.schedule_kind','TOMORROW_FLEXIBLE','ENUM'),
  activeFact('need.task_geography',{mode:'STATIONARY',start:{city:'Novi Sad'}},'OBJECT')];
 const previous=JSON.stringify(activeFacts);
 const f=fixture({activeFacts,text:'Umesto krečenja treba mi prevoz.',output:{safety:'ALLOW',assistantMessage:'Promenio sam posao.',
  facts:[{key:'need.category',valueJson:'"Prevoz stvari"',displayValue:'Prevoz stvari',evidence:'prevoz',confidence:1}],
  dialogue:{next:'CLARIFY',questionKey:'NONE',taskRelation:relation,priceUnit:'UNSPECIFIED',schedulePattern:'UNSPECIFIED'}}});
 const es=await events(f);assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);
 const write=writes(f);assert.equal(write.length,1);assert.equal(write[0].body.p_safety,'CLARIFY');assert.deepEqual(write[0].body.p_proposals,[]);
 assert.equal(JSON.stringify(activeFacts),previous);assert.ok(!write[0].body.p_assistant_message.includes('Promenio sam posao'));
 const instruction=providers(f)[0].body.systemInstruction.parts[0].text;
 assert.ok(instruction.includes('Za promenu vrste posla prvo razjasni'));
 assert.ok(instruction.includes('koji raniji termin, budžet i mesto i dalje važe'));
 assert.ok(instruction.includes('Ne šalji promenu vrste, naslova ili opisa dok to nije jasno'));
 assert.ok(!instruction.includes('sa krečenja pređe na drugu uslugu), dialogue.taskRelation ostaje CONTINUE'));
 assert.ok(!f.calls.some(c=>/save_draft|publish|commit_admission|push/.test(c.url)));
});

test('ordinary correction of the same task keeps unrelated terms and remains a proposal',async()=>{
 const activeFacts=[activeFact('need.price_mode','MY_PRICE','ENUM'),activeFact('need.price_rsd',5000,'INTEGER'),
  activeFact('need.schedule_kind','TOMORROW_FLEXIBLE','ENUM')];
 const f=fixture({activeFacts,text:'Promeni samo ukupnu cenu za ceo posao na 6000 dinara.',output:{safety:'ALLOW',
  assistantMessage:'Cena je u nacrtu 6.000 dinara.',facts:[{key:'need.price_rsd',valueJson:'6000',displayValue:'6.000 RSD',evidence:'6000 dinara',confidence:1}],
  dialogue:{next:'ACK',questionKey:'NONE',taskRelation:'CONTINUE',priceUnit:'WHOLE_JOB',schedulePattern:'UNSPECIFIED'}}});
 assert.equal((await events(f)).at(-1).kind,'final');assert.equal(providers(f).length,1);
 assert.deepEqual(writes(f)[0].body.p_proposals.map(p=>[p.key,p.value]),[['need.price_rsd',6000]]);
 assert.equal(activeFacts[2].fact_value,'TOMORROW_FLEXIBLE');
 assert.ok(!f.calls.some(c=>/save_draft|publish|commit_admission|push/.test(c.url)));
});

test('same-draft work replacement can ask which terms remain without changing them',async()=>{
 const activeFacts=[activeFact('need.category','Krečenje'),activeFact('need.price_rsd',5000,'INTEGER'),
  activeFact('need.schedule_kind','TOMORROW_FLEXIBLE','ENUM')];
 const message='Menjamo ovaj nacrt u prevoz. Da li ostaju isti termin i budžet, i koja je ruta?';
 const f=fixture({activeFacts,text:'Menjam ovaj isti zadatak, umesto krečenja treba mi prevoz.',output:{safety:'CLARIFY',assistantMessage:message,facts:[],
  dialogue:{next:'CLARIFY',questionKey:'NONE',taskRelation:'CONTINUE',priceUnit:'UNSPECIFIED',schedulePattern:'UNSPECIFIED'}}});
 const es=await events(f);assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);
 assert.deepEqual(writes(f)[0].body.p_proposals,[]);assert.equal(writes(f)[0].body.p_assistant_message,message);
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),message);
 assert.ok(!f.calls.some(c=>/save_draft|publish|commit_admission|push/.test(c.url)));
});

test('confirmed Need finishes the stream and records usage even with the optional catalog disabled',async()=>{
 const output=withDialogue({safety:'ALLOW',assistantMessage:'Predlog je spreman za pregled.',facts:[]});
 const usageMetadata={promptTokenCount:100, candidatesTokenCount:20, totalTokenCount:120};
 const f=fixture({provider:()=>new Response('data: '+JSON.stringify({candidates:[{
   content:{parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}],usageMetadata})+'\n\n',
   {headers:{'Content-Type':'text/event-stream'}})});
 const es=await events(f);
 assert.deepEqual(es.map(e=>e.kind),['accepted','text_delta','final']);
 assert.equal(writes(f).length,1);assert.equal(failures(f).length,0);assert.equal(providers(f).length,1);
 const usage=f.calls.filter(c=>c.url.endsWith('/rpc_ai_test_record_usage_service'));
 assert.equal(usage.length,1);assert.equal(usage[0].body.p_operation_id,key);
 assert.equal(usage[0].body.p_total_tokens,120);
});

for(const captureFails of [false,true])test(`Need catalog survives through completion; optional hint capture failure=${captureFails} cannot lose final or usage`,async()=>{
 const category=id(20),service='Izrada maketa';
 const proposal={service,mode:'REMOTE',action:'REUSE_EXISTING',categoryId:category,parentId:'',proposedPath:[],reason:'Explicit synthetic service matches catalog identity',catalogVersion:7};
 const output=withDialogue({safety:'ALLOW',assistantMessage:'Predlog je spreman za pregled.',facts:[],classificationShadowJson:JSON.stringify([proposal])});
 const f=fixture({env:{USKOCI_TAXONOMY_UNIFIED_SHADOW:'true',USKOCI_TAXONOMY_SHADOW_CAPTURE:'true'},
  catalog:body=>({action:'CATALOG_CONTEXT',scope:body.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',catalogVersion:7,
   items:body.p_execution_location_mode==='REMOTE'?[{categoryId:category,parentId:null,label:service,path:[service],isLeaf:true}]:[],
   nextAfter:null,classificationAuthority:'NONE',notificationAuthority:'NONE'}),
  capture:()=>captureFails?new Response('{}',{status:503}):json({action:'HINT_CAPTURED',authority:'NONE'}),
  provider:()=>new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}],
   usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,totalTokenCount:120}})+'\n\n',{headers:{'Content-Type':'text/event-stream'}})});
 const es=await events(f);
 assert.deepEqual(es.map(e=>e.kind),['accepted','text_delta','final']);assert.equal(providers(f).length,1);assert.equal(failures(f).length,0);
 const capture=f.calls.filter(c=>c.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'));
 assert.equal(capture.length,1);assert.equal(capture[0].body.p_proposals[0].categoryId,category);
 assert.ok(f.calls.indexOf(capture[0])>f.calls.indexOf(writes(f)[0]));
 assert.equal(f.calls.filter(c=>c.url.endsWith('/rpc_ai_test_record_usage_service')).length,1);
 assert.ok(!f.calls.some(c=>/ensure_path|commit_admission|publish|push/.test(c.url)));
});

for(const registered of [true,false])test(`Need actual handler captures only server-registered alias=${registered} after owned completion`,async()=>{
 const category=id(20),service='3D štampa';
 const proposal={service,mode:'REMOTE',action:'REUSE_ALIAS',categoryId:category,parentId:'',proposedPath:[],reason:'Explicit synthetic task service and remote mode.',catalogVersion:7};
 const output=withDialogue({safety:'ALLOW',assistantMessage:'Proveri nacrt.',facts:[],classificationShadowJson:JSON.stringify([proposal])});
 const f=fixture({env:{USKOCI_TAXONOMY_UNIFIED_SHADOW:'true',USKOCI_TAXONOMY_SHADOW_CAPTURE:'true'},
  catalog:body=>({action:'CATALOG_CONTEXT',scope:body.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',catalogVersion:7,
   catalogFingerprint:'a'.repeat(32),items:body.p_execution_location_mode==='REMOTE'?[{
    categoryId:category,parentId:null,label:'3D printovanje',aliases:registered?[service]:[],path:['3D printovanje'],isLeaf:true,
   }]:[],nextAfter:null,classificationAuthority:'NONE',notificationAuthority:'NONE'}),
  provider:()=>new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}]})+'\n\n',
   {headers:{'Content-Type':'text/event-stream'}}),
 });
 const es=await events(f);
 assert.equal(es.at(-1).kind,'final');assert.equal(writes(f).length,1);assert.equal(providers(f).length,1);assert.equal(failures(f).length,0);
 const capture=f.calls.filter(c=>c.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'));
 assert.equal(capture.length,registered?1:0);
 if(registered){
  assert.deepEqual(capture[0].body.p_proposals,[{...proposal,action:'REUSE_EXISTING'}]);
  assert.ok(f.calls.indexOf(capture[0])>f.calls.indexOf(writes(f)[0]));
 }
 assert.ok(!f.calls.some(c=>/ensure_path|commit_admission|publish|push/.test(c.url)));
});

for(const diagnostics of [false,true]) for(const status of [402,429])
test(`SSE provider ${status}, diagnostics=${diagnostics}: one safe terminal error, no prose or successful receipt`,async()=>{
 const f=fixture({headers:diagnostics?{'x-client-info':'uskoci-app/ai-availability-v1'}:{},
  provider:()=>new Response('PRIVATE_PROVIDER_SECRET AI_CREDITS_UNAVAILABLE',{status})}),es=await events(f);
 assert.equal(es.at(-1).code,diagnostics&&status===402?'AI_CREDITS_UNAVAILABLE':'AI_TURN_NOT_CONFIRMED');
 assert.equal(es.filter(e=>e.kind==='safe_error').length,1);
 assert.ok(!es.some(e=>e.kind==='text_delta'||e.kind==='final'));
 assert.ok(!JSON.stringify(es).includes('PRIVATE_PROVIDER_SECRET'));
 assert.equal(providers(f).length,1);assert.equal(writes(f).length,0);assert.equal(failures(f).length,1);
 assert.equal(failures(f)[0].body.p_attempt_id,attemptId);
});

for(const config of [{finishReason:'MAX_TOKENS'}, {provider:async()=>{throw Error('SYNTHETIC_NETWORK');}},
 {provider:async()=>new Response('{}',{status:429,headers:{'Content-Type':'application/json'}})}])
test('post-dispatch provider failure settles the same attempt without text or another provider call',async()=>{
 const f=fixture(config),es=await events(f);
 assert.equal(es.at(-1).kind,'safe_error');assert.equal(writes(f).length,0);assert.equal(providers(f).length,1);
 assert.equal(failures(f).length,1);assert.equal(failures(f)[0].body.p_attempt_id,attemptId);
 assert.equal(failures(f)[0].abortedAtCall,false);assert.ok(!es.some(e=>e.kind==='text_delta'));
});
test('lost completion acknowledgement only attempts metadata settlement and does not publish unconfirmed text',async()=>{
 const f=fixture({completionError:true,failureReceipt:turn()}),es=await events(f);
 assert.equal(writes(f).length,1);assert.equal(failures(f).length,1);assert.equal(providers(f).length,1);
 assert.equal(es.at(-1).kind,'safe_error');assert.ok(!es.some(e=>e.kind==='text_delta'));
});
test('provider stream has a thirty-second bound and timeout settles independently',async()=>{
 const timers=[];
 const f=fixture({setTimeout:(fn,ms)=>{timers.push(ms);return setTimeout(fn,ms===30000||ms===12000?5:ms);},
  provider:async()=>new Promise(()=>{})});
 const es=await events(f);assert.ok(timers.includes(30000));assert.ok(!timers.includes(12000));
 assert.equal(es.at(-1).kind,'safe_error');assert.equal(failures(f).length,1);assert.equal(providers(f).length,1);
});
test('actual handler streams real safe Unicode prefixes and finalizes through existing owned writer',async()=>{
 const f=fixture(),es=await events(f);assert.equal(es[0].kind,'accepted');assert.equal(es.at(-1).kind,'final');
 assert.deepEqual(es.at(-1).turn,turn());assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),f.message);
 for(let i=0;i<es.length;i++){assert.equal(es[i].sequence,i+1);assert.equal(es[i].attemptId,attemptId);assert.equal(es[i].turnId,turnId);}
 assert.equal(writes(f).length,1);assert.equal(writes(f)[0].body.p_assistant_message,f.message);
 assert.equal(providers(f).length,1);assert.match(providers(f)[0].url,/:streamGenerateContent\?alt=sse$/);
 assert.equal(providers(f)[0].body.generationConfig.maxOutputTokens,8192);
 assert.ok(!JSON.stringify(es).includes('SYNTHETIC_PROVIDER'));assert.ok(!JSON.stringify(es).includes('valueJson'));
});
test('claim replay is bounded JSON with no second provider reservation or call',async()=>{
 const f=fixture({replay:true}),r=await f.invoke();assert.deepEqual(await r.json(),turn());assert.equal(providers(f).length,0);assert.equal(f.calls.filter(c=>c.url.includes('budget')).length,0);
});
for(const budget of [{admitted:false,reservationId:null,replay:false,code:'AI_TEST_BUDGET_EXHAUSTED'},
 {admitted:false,reservationId:id(8),replay:true,code:'AI_TEST_OPERATION_REPLAY'}])test('budget denial/replay performs no provider call',async()=>{
 const f=fixture({budget}),es=await events(f);assert.equal(es.at(-1).kind,'safe_error');assert.equal(providers(f).length,0);assert.equal(writes(f).length,0);
});
test('paid processing gate must be explicitly enabled',async()=>{const f=fixture({env:{USKOCI_GEMINI_PAID_TEST_ENABLED:''}});assert.equal((await events(f)).at(-1).kind,'safe_error');assert.equal(providers(f).length,0);});
test('truncated output shows neither unvalidated prose nor a successful card receipt',async()=>{
 const f=fixture({finishReason:'MAX_TOKENS'}),es=await events(f);assert.equal(es.at(-1).kind,'safe_error');assert.equal(writes(f).length,0);assert.ok(!es.some(e=>e.kind==='final'));
 assert.ok(!es.some(e=>e.kind==='text_delta'));
});
test('wrong authoritative receipt produces no text or stream final',async()=>{const f=fixture({badReceipt:true}),es=await events(f);assert.equal(es.at(-1).kind,'safe_error');assert.equal(writes(f).length,1);assert.ok(!es.some(e=>e.kind==='text_delta'));});
test('nested/escaped assistantMessage keys cannot leak non-assistant JSON into text',async()=>{
 const f=fixture({fragments:['{"facts":[{"key":"need.description","valueJson":"{\\"assistantMessage\\":\\"PRIVATE\\"}","displayValue":"private","evidence":"x","confidence":1}],',
 '"safety":"ALLOW","assistantMessage":"Javan odgovor."}']});
 const es=await events(f);assert.ok(!es.some(e=>e.kind==='text_delta'));
 assert.equal(es.at(-1).kind,'safe_error','nested object is not a valid description fact');
 assert.ok(!JSON.stringify(es).includes('PRIVATE'));
});
