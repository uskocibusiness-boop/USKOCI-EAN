// Exact source, explicitly synthetic I/O. No live provider or database proof.
import test from 'node:test';import assert from 'node:assert/strict';
import {loadWorkerRecoveryHandler} from './worker_recovery_edge_runtime.mjs';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const account=id(1),conversation=id(2),key=id(3),turnId=id(4),attemptId=id(5);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const turn=(state='SUCCEEDED')=>({turnId,conversationId:conversation,clientRequestId:key,attemptId,state,retryAllowed:false,authoritative:true});
// Keep each scenario's synthetic canonical rows while exposing the current
// read-only query contract. No runtime catalog or provider is replaced here.
function queryCatalog(query,catalog){
 const rows=new Map();let metadata;
 for(const mode of ['REMOTE','ON_SITE']){
  const page=catalog({p_execution_location_mode:mode,p_after_key:null,p_limit:100});metadata??=page;
  for(const row of page.items){
   const prior=rows.get(row.categoryId);
   rows.set(row.categoryId,{...row,modes:[...(prior?.modes??[]),mode]});
  }
 }
 const all=[...rows.values()].map(row=>{
  const pathIds=[];let current=row;
  while(current){pathIds.unshift(current.categoryId);current=current.parentId?rows.get(current.parentId):null;}
  return {...row,pathIds};
 });
 const eligible=all.filter(row=>query.scope==='ALL'||row.modes.includes(query.scope));
 const same=(a,b)=>a.toLowerCase()===b.toLowerCase();let selected=[];
 if(query.operation==='ROOTS')selected=eligible.filter(row=>row.parentId===null);
 if(query.operation==='SEARCH')selected=eligible.filter(row=>[row.label,...row.aliases].some(label=>label.toLowerCase().includes(query.text.toLowerCase())));
 if(query.operation==='EXACT')selected=eligible.filter(row=>[row.label,...row.aliases].some(label=>same(label,query.text)));
 if(query.operation==='RESOLVE')selected=eligible.filter(row=>query.categoryIds.includes(row.categoryId));
 return {schemaVersion:'TAXONOMY_CATALOG_QUERY_V1',action:'CATALOG_QUERY',operation:query.operation,scope:query.scope,
  catalogVersion:metadata.catalogVersion,catalogFingerprint:metadata.catalogFingerprint,items:selected,count:selected.length,nextCursor:null,
  classificationAuthority:'NONE',capabilityAuthority:'NONE',notificationAuthority:'NONE'};
}
function fixture(options={}){
 let handler;const calls=[],env={SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'PUBLIC_SYNTHETIC',SUPABASE_SERVICE_ROLE_KEY:'SERVICE_SYNTHETIC',LOCATIONIQ_ACCESS_TOKEN:'LOCATION_SYNTHETIC',
  AI_PROVIDER:'gemini',GEMINI_MODEL:'gemini-3.8-flash',GEMINI_API_KEY:'PROVIDER_SYNTHETIC',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',...options.env};
 const output=options.output??{assistantMessage:'Profil je spreman za zajednički pregled 🟢.',safety:'ALLOW',patch:{skills:['Prenos stvari']}};
 const fetch=async(url,init={})=>{
  calls.push({url:String(url),body:init.body?JSON.parse(init.body):null,init,abortedAtCall:init.signal?.aborted});
  if(url.endsWith('/auth/v1/user'))return json(options.auth??{id:account});
  if(url.endsWith('/rpc_claim_worker_ai_turn_service'))return json({acquired:!options.replay,turn:turn(options.replay?'SUCCEEDED':'PROCESSING')});
  if(url.endsWith('/rpc_read_worker_ai_context_service'))return json(options.context??{schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:false,safety:'ALLOW',revision:0,
   serviceModeContext:{schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:0,savedServices:[],draftServices:[],unresolvedServices:[]},
   candidate:{skills:[],availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},messages:[{role:'USER',body:'SYNTHETIC_USER_MESSAGE'}]});
  if(url.endsWith('/rpc_ai_test_budget_reserve_service'))return json(options.budget??{admitted:true,reservationId:id(8),replay:false,code:'AI_TEST_RESERVED'});
  // Explicit synthetic141 dispatch authorization. This unit transport does not
  // stand in for the separate actual Auth/Postgres race proof.
  if(url.endsWith('/rpc_dispatch_worker_ai_turn_service')){
   if(options.dispatchError)throw new Error('SYNTHETIC_DISPATCH_ACK_LOST');
   return json(options.dispatch??{dispatched:true,turn:turn('PROCESSING')});
  }
  if(url.endsWith('/rpc_complete_worker_ai_turn_service')){if(options.completionError)throw Error('SYNTHETIC_ACK_LOST');return json(options.receipt??turn());}
  if(url.endsWith('/rpc_taxonomy_ai_catalog_context_service'))return json(options.catalog(JSON.parse(init.body)));
  if(url.endsWith('/rpc_taxonomy_query_catalog_service'))return json(queryCatalog(JSON.parse(init.body).p_query,options.catalog));
  if(url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'))return json({action:'HINT_CAPTURED',authority:'NONE'});
  if(url.endsWith('/rpc_taxonomy_fetch_snapshot_v1')){assert.ok(options.snapshot,'UNEXPECTED_FULL_CATALOG_CALL');return json(options.snapshot);}
  if(url.endsWith('/rpc_taxonomy_get_unconsumed_turn_hint_service'))return json(null);
  if(url.endsWith('/rpc_ai_test_record_usage_service')){const body=JSON.parse(init.body);return json({recorded:true,authoritative:true,
   operationId:body.p_operation_id,promptTokens:body.p_prompt_tokens,outputTokens:body.p_output_tokens,totalTokens:body.p_total_tokens});}
  if(url.endsWith('/rpc_fail_worker_ai_turn_service'))return options.fail?.(init)??json(turn('FAILED'));
  if(url.startsWith('https://eu1.locationiq.com/v1/search')){
   assert.ok(options.geocoder,'UNEXPECTED_LOCATIONIQ_CALL');
   return json(options.geocoder(new URL(url)));
  }
  if(url.startsWith('https://generativelanguage.googleapis.com/')){
   if(/:generateContent/.test(url)&&options.backgroundProvider)return options.backgroundProvider(init);
   if(options.provider) return options.provider(init);
   const raw=JSON.stringify({availabilityChange:options.availabilityChange??{kind:'NONE',evidence:''},...output}),fragments=Array.from(raw);
   if(/:generateContent/.test(url))return json({candidates:[{content:{role:'model',parts:[{text:raw}]},finishReason:options.finishReason??'STOP'}],
    usageMetadata:{promptTokenCount:10,candidatesTokenCount:5,thoughtsTokenCount:0,totalTokenCount:15}});
   const body=fragments.map((text,index)=>'data: '+JSON.stringify({candidates:[{content:{parts:[{text}]},...(index===fragments.length-1?{finishReason:options.finishReason??'STOP'}:{})}]})+'\n\n').join('');
   const bytes=new TextEncoder().encode(body);return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=7)c.enqueue(bytes.slice(i,i+7));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});
  }
  assert.fail('UNEXPECTED_NETWORK_OR_CANONICAL_WRITER');
 };
 const loaded=loadWorkerRecoveryHandler({fetch,env:name=>env[name],setTimeout:options.setTimeout,log:options.log});
 handler=loaded.handler;
 return {calls,output,invoke:(patch={})=>handler(new Request('https://edge.invalid',{method:'POST',signal:options.signal,headers:{Authorization:'Bearer SYNTHETIC',Accept:'text/event-stream','Content-Type':'application/json',...options.headers},
  body:JSON.stringify({conversationId:conversation,clientRequestId:key,text:'SYNTHETIC_USER_MESSAGE',...patch})}))};
}
const providers=f=>f.calls.filter(c=>c.url.startsWith('https://generativelanguage.googleapis.com/'));
const completions=f=>f.calls.filter(c=>c.url.endsWith('/rpc_complete_worker_ai_turn_service'));
const failures=f=>f.calls.filter(c=>c.url.endsWith('/rpc_fail_worker_ai_turn_service'));
async function events(f,patch={}){const r=await f.invoke(patch);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/event-stream/);
 return (await r.text()).trim().split('\n\n').map(e=>JSON.parse(e.slice(6)));}
for(const failed of [false,true])test('worker streaming provider has one count-only latency phase, failed='+failed,async()=>{
 const logs=[],f=fixture({log:args=>logs.push(args),...(failed?{provider:()=>new Response('PRIVATE_PROVIDER_BODY',{status:503})}:{})});
 const es=await events(f),phases=logs.filter(args=>args[0]==='AI_PHASE_MS'&&args[1]==='PROVIDER');
 assert.equal(phases.length,1);assert.equal(phases[0].length,4);assert.equal(typeof phases[0][2],'number');assert.ok(phases[0][2]>=0);
 assert.equal(phases[0][3],failed?'FAILED':'SUCCEEDED');assert.equal(es.at(-1).kind,failed?'safe_error':'final');
 assert.ok(!JSON.stringify(logs).includes('PRIVATE_PROVIDER_BODY'));assert.ok(!JSON.stringify(logs).includes('SYNTHETIC_USER_MESSAGE'));
});
test('worker Gemini prompt asks one question while preserving area, availability and Save authority',async()=>{
 const f=fixture(); await events(f);
 const rule=providers(f)[0].body.systemInstruction.parts.map(p=>p.text).join('\n');
 assert.match(rule,/Jedno korisno pitanje po poruci/);
 assert.match(rule,/Ask at most ONE short question per reply/);
 assert.match(rule,/experienced, warm craft and work-profile mentor/);
 assert.match(rule,/what the person CAN and WANTS to do/);
 assert.doesNotMatch(rule,/iskusan poslovođa i savetnik naručioca/);
 assert.doesNotMatch(rule,/at most THREE/);
 assert.match(rule,/Novi Sad i Beograd means two CITY entries/);
 assert.match(rule,/Only explicit Sačuvaj profil in the review applies the changes/);
 assert.match(rule,/availabilityChange is/);
 assert.ok(rule.length<20000,`stable worker instruction grew to ${rule.length} characters`);
});

// Exact current handler with both Gemini transports stubbed. These scenarios
// prove routing and accepted patch boundaries, not real provider semantics.
function dualModeFixture({modes=['REMOTE'],handoff,evidence,quote,priorMode='ON_SITE',priorHandoff,outputSafety='ALLOW',backgroundStatus,log,catalogModes=['REMOTE','ON_SITE']}={}){
 const service='Časovi engleskog',categoryId=id(20);
 const userText=quote??'Od sada držim časove engleskog samo online.';
 const modeContext={schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:4,
  savedServices:[{service,categoryId,mode:priorMode,...(priorHandoff?{handoff:priorHandoff}:{})}],draftServices:[],unresolvedServices:[]};
 const changes=[{service,modes,evidence:evidence??userText,...(handoff?{handoff}:{})}];
 const f=fixture({env:{SUPABASE_URL:'https://leqcwgzvjsxugfgzdmth.supabase.co'},log,
  context:{schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:false,safety:'ALLOW',revision:4,
   profileStatus:'ACTIVE',serviceModeContext:modeContext,
   candidate:{skills:[service],bio:'Prethodni opis.',availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},
   messages:[{role:'USER',body:userText},{role:'ASSISTANT',body:'ASSISTANT_ONLY_SCOPE_QUOTE'}]},
  snapshot:{catalogVersion:7,catalogFingerprint:'a'.repeat(32),count:1,categories:[{
   categoryId,parentId:null,label:service,aliases:[],path:[service],isLeaf:true,modes:catalogModes}]},
  output:{assistantMessage:'Predlog izmene je u nacrtu.',safety:outputSafety,patch:{bio:'Dopunjen opis.'},serviceModeChangesJson:JSON.stringify(changes)},
  backgroundProvider:()=>backgroundStatus?new Response('PRIVATE_BG_PROVIDER_BODY',{status:backgroundStatus}):json({candidates:[{content:{parts:[{text:JSON.stringify({items:modes.map(mode=>({service,mode,
   action:'CREATE_CHILD',parentId:'',handoffKind:handoff?.shippingCountries?'SHIPPING_RS':'NONE',handoffCity:'',
   reason:'Izričit predlog radnika za njegovu postojeću uslugu.'}))})}]},finishReason:'STOP'}]})});
 return {...f,userText,changes,modeContext};
}
async function settleBackground(){for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));}
test('dual worker mode-only correction reaches background review without a skills edit',async()=>{
 const f=dualModeFixture({handoff:{required:false}});
 const es=await events(f,{text:f.userText});await settleBackground();
 assert.equal(es.at(-1).kind,'final');
 const main=providers(f).find(call=>call.url.includes(':streamGenerateContent')).body;
 assert.ok(main.generationConfig.responseSchema.properties.serviceModeChangesJson);
 assert.equal(main.generationConfig.responseSchema.properties.classificationShadowJson,undefined);
 assert.match(main.systemInstruction.parts.map(part=>part.text).join(' '),/include that initial declaration with the exact USER service quote/);
 assert.doesNotMatch(main.systemInstruction.parts.map(part=>part.text).join(' '),/Keep the normal classificationShadowJson full snapshot/);
 assert.equal(providers(f).filter(call=>call.url.includes(':generateContent')).length,1);
 const capture=f.calls.find(call=>call.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'));
 assert.deepEqual(capture?.body.p_proposals.map(p=>({mode:p.mode,handoff:p.handoff})),[{mode:'REMOTE',handoff:{required:false}}]);
 assert.deepEqual(completions(f)[0].body.p_output.patch,{bio:'Dopunjen opis.'});
 assert.equal(Object.hasOwn(completions(f)[0].body.p_output,'serviceModeChangesJson'),false);
 assert.ok(!f.calls.some(call=>/rpc_save_worker|rpc_set_worker_execution_modes/.test(call.url)));
});
test('dual worker handoff-only correction retains REMOTE and queues the new bounded handoff',async()=>{
 const f=dualModeFixture({priorMode:'REMOTE',priorHandoff:{required:true,localExchange:{countryCode:'RS',city:'Novi Sad'}},
  quote:'Od sada šaljem urađene radove poštom samo unutar Srbije.',handoff:{required:true,shippingCountries:['RS']}});
 const es=await events(f,{text:f.userText});await settleBackground();assert.equal(es.at(-1).kind,'final');
 assert.equal(providers(f).filter(call=>call.url.includes(':generateContent')).length,1);
 const capture=f.calls.find(call=>call.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'));
 assert.deepEqual(capture?.body.p_proposals.map(p=>({mode:p.mode,handoff:p.handoff})),[{mode:'REMOTE',handoff:{required:true,shippingCountries:['RS']}}]);
});
for(const evidence of ['PRIVATE_INVENTED_SCOPE','ASSISTANT_ONLY_SCOPE_QUOTE'])test('dual worker invented or assistant mode evidence does not trigger classification: '+evidence,async()=>{
 const f=dualModeFixture({evidence});const es=await events(f,{text:f.userText});await settleBackground();
 assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);
 assert.equal(f.calls.filter(call=>call.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service')).length,0);
});
test('dual worker mode evidence from an earlier turn does not rerun classification for an unrelated bio edit',async()=>{
 const f=dualModeFixture();const es=await events(f,{text:'Dopuni samo opis profila.'});await settleBackground();
 assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);
});
for(const outputSafety of ['BLOCK','REVIEW'])test('dual worker rejected mode change does not launch classifier: '+outputSafety,async()=>{
 const f=dualModeFixture({outputSafety});await events(f,{text:f.userText});await settleBackground();
 assert.equal(providers(f).length,1);assert.equal(f.calls.filter(call=>call.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service')).length,0);
});
for(const mutation of ['stale','unknown_mode'])test('dual worker invalid authoritative mode context stops before budget and provider: '+mutation,async()=>{
 const f=dualModeFixture();
 if(mutation==='stale')f.modeContext.revision=3;else f.modeContext.savedServices[0].mode='UNKNOWN';
 const response=await f.invoke({text:f.userText});assert.equal(response.status,503);
 assert.equal(providers(f).length,0);assert.equal(completions(f).length,0);
 assert.equal(f.calls.filter(call=>call.url.includes('budget_reserve')).length,0);
});
for(const catalogModes of [['ON_SITE'],['ON_SITE','REMOTE']])test('dual worker classifier outage keeps the completed conversation without applying a fresh scope, supported='+catalogModes.includes('REMOTE'),async()=>{
 const logs=[],f=dualModeFixture({backgroundStatus:503,catalogModes,log:args=>logs.push(args)});
 const es=await events(f,{text:f.userText});await settleBackground();
 assert.equal(es.at(-1).kind,'final');assert.equal(completions(f).length,1);
 assert.equal(providers(f).filter(call=>call.url.includes(':generateContent')).length,1);
 assert.equal(f.calls.filter(call=>/rpc_taxonomy_capture_gemini_turn_hints_service|rpc_taxonomy_store_classification_turn_hint_service/.test(call.url)).length,0);
 assert.deepEqual(logs.filter(args=>args[0]==='BG_TAXONOMY_PROVIDER_FAILURE'),[['BG_TAXONOMY_PROVIDER_FAILURE','RETRYABLE_PROVIDER','PROVIDER_HTTP_503']]);
 assert.ok(!JSON.stringify(logs).includes('PRIVATE_BG_PROVIDER_BODY'));
});

test('COUNTRY area request reaches the service-only writer as canonical workAreas without coordinates',async()=>{
 const output={assistantMessage:'Cela Srbija je dodata u nacrt područja rada.',safety:'ALLOW',patch:{
  areaRequests:[{kind:'COUNTRY',countryCode:'RS',query:'',radiusKm:null}]}};
 const f=fixture({output});await events(f,{text:'Radim na terenu po celoj Srbiji.'});
 assert.equal(providers(f).length,1);
 assert.deepEqual(completions(f)[0].body.p_output.patch,{workAreas:[{
  kind:'COUNTRY',countryCode:'RS',label:'Cela Srbija',city:null,sourceRef:null,
  latitude:null,longitude:null,radiusKm:null}]});
 assert.equal(f.calls.filter(c=>c.url.startsWith('https://eu1.locationiq.com/')).length,0);
});

test('RADIUS area request is resolved by LocationIQ and only rounded canonical data reaches SQL',async()=>{
 const output={assistantMessage:'Novi Sad i krug od 30 km su u nacrtu.',safety:'ALLOW',patch:{
  areaRequests:[{kind:'RADIUS',countryCode:'RS',query:'Novi Sad',radiusKm:30}],
  location:{city:'NE_SME_PROCI',radiusKm:30}}};
 const f=fixture({output,geocoder:url=>{
  assert.equal(url.searchParams.get('q'),'Novi Sad');
  assert.equal(url.searchParams.get('countrycodes'),'rs');
  return [{type:'city',class:'place',osm_type:'relation',osm_id:'12345',lat:'45.267136',lon:'19.833549',
   address:{country_code:'rs',city:'Novi Sad'}}];
 }});await events(f,{text:'Radim u Novom Sadu i do 30 kilometara.'});
 assert.deepEqual(completions(f)[0].body.p_output.patch,{workAreas:[{
  kind:'RADIUS',countryCode:'RS',label:'Novi Sad · do 30 km',city:'Novi Sad',
  sourceRef:'osm:relation:12345',latitude:45.27,longitude:19.83,radiusKm:30}]});
});

test('invalid fallback worker patch still settles complete provider thinking usage once',async()=>{
 const f=fixture({provider:()=>new Response('data: '+JSON.stringify({candidates:[{
   content:{parts:[{text:'{"safety":"ALLOW","assistantMessage":"Predlog.","patch":{"forbidden":true}}'}]},finishReason:'STOP'}],
   usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:5,cachedContentTokenCount:40,totalTokenCount:125}})+'\n\n',
   {headers:{'Content-Type':'text/event-stream'}})});
 const es=await events(f);assert.equal(es.at(-1).kind,'safe_error');assert.equal(completions(f).length,0);
 const usage=f.calls.filter(c=>c.url.endsWith('/rpc_ai_test_record_usage_service'));
 assert.equal(providers(f).length,1);assert.equal(usage.length,1);
 assert.equal(usage[0].body.p_prompt_tokens,100);assert.equal(usage[0].body.p_output_tokens,25);
 assert.equal(usage[0].body.p_total_tokens,125);assert.equal(usage[0].abortedAtCall,false);
});

test('recovery proof loader binds the current complete worker bundle without network',async()=>{
 const loaded=loadWorkerRecoveryHandler({fetch:()=>assert.fail('NETWORK_NOT_ALLOWED'),env:()=>''});
 assert.deepEqual(Object.keys(loaded.sourceHashes).sort(),['supabase/functions/_shared/interviewVoiceInstruction.mjs','supabase/functions/_shared/aiPhaseTiming.mjs','src/contracts/aiAvailability.ts','supabase/functions/_shared/aiTestBudget.ts',
  'supabase/functions/_shared/geminiTaskStream.ts','supabase/functions/uskoci-worker-interview/index.ts',
  'supabase/functions/_shared/classificationEngine.mjs','supabase/functions/_shared/classificationGeminiShadow.mjs',
  'supabase/functions/_shared/classificationDirectReply.mjs',
  'supabase/functions/_shared/workerServiceModeContext.mjs','supabase/functions/_shared/classificationReply.mjs',
  'supabase/functions/_shared/classificationExplorer.mjs','supabase/functions/_shared/geminiToolConversation.ts',
  'supabase/functions/_shared/serviceHandoff.mjs','supabase/functions/_shared/serviceExecutionInstruction.mjs',
  'supabase/functions/_shared/taxonomyProviderBudget.ts','supabase/functions/_shared/researchDeadline.ts',
  'supabase/functions/_shared/workerAreaAdmission.mjs','supabase/functions/_shared/workerAreaResolver.mjs',
  'supabase/functions/_shared/backgroundTaxonomyArchitect.mjs'].sort());
 assert.equal((await loaded.handler(new Request('https://edge.invalid',{method:'GET'}))).status,405);
});
for(const status of [402,429])for(const diagnostics of [false,true])
 test(`worker provider HTTP${status}, diagnostics ${diagnostics}: settles once without completion or leaking provider text`,async()=>{
  const f=fixture({headers:diagnostics?{'x-client-info':'uskoci-app/ai-availability-v1'}:{},provider:()=>new Response('PRIVATE_PROVIDER_BODY',{status})});
  const es=await events(f);
  assert.deepEqual(es.map(e=>e.kind),['accepted','safe_error']);
  assert.equal(es.at(-1).code,status===402&&diagnostics?'AI_CREDITS_UNAVAILABLE':'AI_TURN_NOT_CONFIRMED');
  assert.equal(providers(f).length,1);assert.equal(failures(f).length,1);assert.equal(completions(f).length,0);
  assert.ok(!JSON.stringify(es).includes('PRIVATE_PROVIDER_BODY'));
  const reserves=f.calls.filter(c=>c.url.endsWith('/rpc_ai_test_budget_reserve_service'));
  assert.equal(reserves.length,1);assert.equal(reserves[0].body.p_max_cost_microusd,250000);
 });
for(const availability of [undefined,{}, {ruleChanges:[]}, {timezone:'Europe/Belgrade'}])
test('an acknowledged availability edit without a calendar operation cannot report success: '+JSON.stringify(availability),async()=>{
 const output={assistantMessage:'Ponedeljak sam promenio na 18 do 20.',safety:'ALLOW',patch:{bio:'Bavim se montažom.',...(availability?{availability}:{})}};
 const f=fixture({output,availabilityChange:{kind:'PATCH',evidence:'SYNTHETIC_USER_MESSAGE'}}), es=await events(f);
 assert.equal(es.at(-1).kind,'final'); assert.equal(providers(f).length,1);
 const accepted=completions(f)[0].body.p_output;
 assert.deepEqual(accepted.patch,{bio:'Bavim se montažom.'});
 assert.equal(accepted.safety,'CLARIFY'); assert.match(accepted.assistantMessage,/razjasnimo dostupnost/);
 assert.ok(!JSON.stringify(es).includes(output.assistantMessage));
 assert.ok(!Object.hasOwn(accepted,'availabilityChange'));
});
test('changing one weekday reaches the writer as a scoped operation, keeping the other weekdays server-owned',async()=>{
 const availability={ruleChanges:[{ruleId:id(30),weekdays:[1],value:{startTime:'18:00',endTime:'20:00',startsOn:'2026-10-19',endsOn:null,label:'Ponedeljak',active:true}}]};
 const output={assistantMessage:'Predlog za ponedeljak je u nacrtu.',safety:'ALLOW',patch:{availability}};
 const f=fixture({output,availabilityChange:{kind:'PATCH',evidence:'SYNTHETIC_USER_MESSAGE'}}),es=await events(f);
 assert.equal(es.at(-1).kind,'final'); assert.deepEqual(completions(f)[0].body.p_output,output);
 const schema=providers(f)[0].body.generationConfig.responseSchema;
 assert.ok(schema.required.includes('availabilityChange')); assert.equal(providers(f).length,1);
});
test('invented availability evidence cannot authorize a calendar proposal',async()=>{
 const output={assistantMessage:'Dostupan si odmah.',safety:'ALLOW',patch:{availability:{availableNow:true},skills:['Montaža']}};
 const f=fixture({output,availabilityChange:{kind:'PATCH',evidence:'INVENTED_USER_STATEMENT'}});await events(f);
 const accepted=completions(f)[0].body.p_output;
 assert.deepEqual(accepted.patch,{skills:['Montaža']}); assert.equal(accepted.safety,'CLARIFY'); assert.equal(providers(f).length,1);
});

for(const availability of [null,{ruleChanges:[],windowsUpsert:[],windowIdsRemove:[]}])
test('owned partial weekday hours keep the precise missing-end question and unsupported-area explanation',async()=>{
 const input='Radim molerske radove po celoj Vojvodini i u Beogradu, radnim danima posle 16. Alat ne bih posebno unosio.';
 const reply='Regionalna pokrivenost još nije podešena. Koji grad i krug oko njega da koristimo za predloge? Do koliko sati radnim danima?';
 const context={schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:false,safety:'ALLOW',revision:0,
  candidate:{skills:[],availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},messages:[{role:'USER',body:input}]};
 const logs=[],f=fixture({context,log:args=>logs.push(args),availabilityChange:{kind:'CLARIFY',evidence:'radnim danima posle 16'},
  output:{assistantMessage:reply,safety:'ALLOW',patch:{skills:['Molerski radovi'],bio:'Molerski radovi.',availability}}});
 const es=await events(f,{text:input});assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);
 const accepted=completions(f)[0].body.p_output;
 assert.match(accepted.assistantMessage,/širu oblast/);assert.match(accepted.assistantMessage,/Do koliko sati radnim danima\?/);
 assert.equal(accepted.safety,'CLARIFY');
 assert.deepEqual(accepted.patch,{skills:['Molerski radovi'],bio:'Molerski radovi.'});
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),accepted.assistantMessage);
 assert.ok(!logs.some(args=>args[0]==='WORKER_AVAILABILITY_GUARD'));
 const prompt=providers(f)[0].body.systemInstruction.parts.map(p=>p.text).join('\n');
 assert.ok(prompt.includes("For 'radnim danima posle 16', ask 'Do koliko sati radnim danima?'"));
 assert.ok(prompt.includes('Keep this explanation distinct from any missing calendar detail'));
});

for(const mode of ['invented_quote','actual_operation'])test('availability CLARIFY cannot bypass evidence or sneak a calendar mutation: '+mode,async()=>{
 const reply='Raspored je sada promenjen.';
 const f=fixture({availabilityChange:{kind:'CLARIFY',evidence:mode==='invented_quote'?'PRIVATE_INVENTED':'SYNTHETIC_USER_MESSAGE'},
  output:{assistantMessage:reply,safety:'ALLOW',patch:{bio:'Molerski radovi.',...(mode==='actual_operation'?{availability:{availableNow:true}}:{})}}});
 const es=await events(f);assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);
 const actual=completions(f)[0].body.p_output;assert.deepEqual(actual.patch,{bio:'Molerski radovi.'});
 assert.equal(actual.safety,'CLARIFY');assert.notEqual(actual.assistantMessage,reply);
 assert.ok(actual.assistantMessage.includes('bez ponavljanja već navedenih dana i sati'));
 assert.ok(!JSON.stringify(es).includes('PRIVATE_INVENTED'));
});

for (const [evidence,accepted] of [
 ['radnim danima od 15 do 19',true],
 ['RADNIM DANIMA\nOD 15 DO 19',true],
 ['Radnim danima od 18 do 20',false],
 ['Ne radim radnim danima od 15 do 19',false],
]) test('initial calendar quote tolerates formatting but not changed facts: '+evidence,async()=>{
 const availability={ruleChanges:[{ruleId:null,weekdays:[1,2,3,4,5],value:{startTime:'15:00',endTime:'19:00',startsOn:'2026-10-19',endsOn:null,label:'Radni dani',active:true}}]};
 const output={assistantMessage:'Radno vreme je u nacrtu.',safety:'ALLOW',patch:{availability,bio:'3D štampa.'}};
 const logs=[],f=fixture({output,availabilityChange:{kind:'PATCH',evidence},log:args=>logs.push(args),
  context:{schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:false,safety:'ALLOW',revision:0,
   candidate:{skills:[],availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},
   messages:[{role:'USER',body:'Radnim danima\u00a0 od 15 do 19, vikendom ne radim.'}]}});
 await events(f); const actual=completions(f)[0].body.p_output;
 assert.equal(Object.hasOwn(actual.patch,'availability'),accepted);
 assert.equal(actual.patch.bio,'3D štampa.'); assert.equal(providers(f).length,1);
 if(!accepted) assert.ok(logs.some(args=>JSON.stringify(args)==='["WORKER_AVAILABILITY_GUARD","EVIDENCE_MISMATCH"]'));
 assert.ok(!JSON.stringify(logs).includes(evidence));
});
test('a malformed availability intent cannot reach the writer or the user as success',async()=>{
 const f=fixture({availabilityChange:{kind:'PATCH'}}),es=await events(f);
 assert.equal(es.at(-1).kind,'safe_error'); assert.equal(completions(f).length,0);
 assert.equal(providers(f).length,1);
});

test('provider explicitly decides about availability while null never clears the calendar',async()=>{
 const output={assistantMessage:'Opis je u nacrtu.',safety:'ALLOW',patch:{bio:'Montaža.',availability:null}};
 const f=fixture({output});await events(f);
 const schema=providers(f)[0].body.generationConfig.responseSchema;
 assert.ok(schema.properties.patch.required.includes('availability'));
 assert.equal(schema.properties.patch.properties.availability.nullable,true);
 assert.deepEqual(completions(f)[0].body.p_output.patch,{bio:'Montaža.'});
});
for (const utterance of ['Radim širom Srbije','Novi Sad do 30 km i Beograd do 30 km','Radim od Vranja do Subotice'])
test('broad on-site wish cannot become one V1 area or an unsupported public bio: '+utterance,async()=>{
 const output={assistantMessage:'Cela oblast je sačuvana.',safety:'ALLOW',patch:{
  location:{operatingCountryCode:'RS',city:'Beograd',radiusKm:200},bio:'Radim širom Srbije.',skills:['Molerski radovi']}};
 const f=fixture({output}),es=await events(f,{text:utterance});
 const committed=completions(f)[0].body.p_output;
 assert.equal(es.at(-1).kind,'final');
 assert.equal(committed.safety,'CLARIFY');
 assert.deepEqual(committed.patch,{skills:['Molerski radovi']});
 assert.ok(!committed.assistantMessage.includes('sačuvana'));
 assert.equal(providers(f).length,1);
});
test('a stated 30 km cannot be replaced by a provider 200 km radius',async()=>{
 const f=fixture({output:{assistantMessage:'Novi Sad do 200 km je u nacrtu.',safety:'ALLOW',patch:{
  location:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:200},skills:['Moler']} }});
 await events(f,{text:'Novi Sad do 30 km'});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.safety,'CLARIFY');
 assert.deepEqual(committed.patch,{skills:['Moler']});
 assert.match(committed.assistantMessage,/udaljenost nije ista/);
});
test('Novi Sad and surroundings asks for distance without losing an independent skill',async()=>{
 const f=fixture({output:{assistantMessage:'Novi Sad i okolina su u nacrtu.',safety:'ALLOW',patch:{
  location:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:20},skills:['Moler']} }});
 await events(f,{text:'Novi Sad i okolina'});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.safety,'CLARIFY');
 assert.deepEqual(committed.patch,{skills:['Moler']});
 assert.match(committed.assistantMessage,/Do koliko kilometara/);
});
test('online-only correction never creates an on-site travel radius',async()=>{
 const f=fixture({output:{assistantMessage:'Koliko kilometara dolaziš?',safety:'ALLOW',patch:{
  location:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:30},skills:['Onlajn časovi']} }});
 await events(f,{text:'Radim samo online u Novom Sadu i okolini'});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.patch.location,undefined);
 assert.deepEqual(committed.patch.skills,['Onlajn časovi']);
 assert.doesNotMatch(committed.assistantMessage,/koliko kilometara/i);
});
const savedAreaContext={schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,
 status:'OPEN',stale:false,safety:'ALLOW',revision:0,candidate:{skills:['Moler'],
  location:{operatingCountryCode:'RS',city:'Niš',radiusKm:20,approximatePosition:null},
  availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},messages:[]};
test('remote-only city phrase cannot change an existing Niš area',async()=>{
 const f=fixture({context:savedAreaContext,output:{assistantMessage:'Novi Sad je sada područje rada.',safety:'ALLOW',
  patch:{location:{city:'Novi Sad',radiusKm:30},skills:['Onlajn časovi']}}});
 await events(f,{text:'Radim samo online u Novom Sadu'});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.patch.location,undefined);
 assert.deepEqual(committed.patch.skills,['Onlajn časovi']);
 assert.doesNotMatch(committed.assistantMessage,/sada područje rada/);
});
test('new named surroundings with no provider location cannot inherit Niš silently',async()=>{
 const f=fixture({context:savedAreaContext,output:{assistantMessage:'Okolina Beograda je u nacrtu.',safety:'ALLOW',
  patch:{skills:['Moler']}}});
 await events(f,{text:'Radim u okolini Beograda'});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.safety,'CLARIFY');
 assert.deepEqual(committed.patch,{skills:['Moler']});
 assert.match(committed.assistantMessage,/Do koliko kilometara/);
});
test('remote country clause preserves a separate explicit Novi Sad on-site patch',async()=>{
 const f=fixture({context:savedAreaContext,output:{assistantMessage:'Obe usluge su u nacrtu.',safety:'ALLOW',patch:{
  location:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:30},skills:['Prevod','Molerski radovi']}}});
 await events(f,{text:'Prevod samo online u celoj Srbiji, a moler u Novom Sadu do 30 km'});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.patch.location?.city,'Novi Sad');
 assert.equal(committed.patch.location?.radiusKm,30);
});
for(const utterance of ['Radim širom cele Srbije','Na području cele Srbije','Radim na relaciji Novi Sad–Beograd'])
test('unrepresentable on-site wording cannot become one V1 circle: '+utterance,async()=>{
 const f=fixture({context:savedAreaContext,output:{assistantMessage:'Područje je u nacrtu.',safety:'ALLOW',patch:{
  location:{operatingCountryCode:'RS',city:'Beograd',radiusKm:200},skills:['Moler']}}});
 await events(f,{text:utterance});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.safety,'CLARIFY');
 assert.equal(committed.patch.location,undefined);
 assert.deepEqual(committed.patch.skills,['Moler']);
});
test('comma-linked biography keeps independent experience after wide-area claim is removed',async()=>{
 const f=fixture({context:savedAreaContext,output:{assistantMessage:'Opis je u nacrtu.',safety:'ALLOW',patch:{
  bio:'Moler sam deset godina, radim u celoj Srbiji.',skills:['Moler']}}});
 await events(f,{text:'Moler sam deset godina, radim u celoj Srbiji'});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.patch.bio,'Moler sam deset godina.');
 assert.deepEqual(committed.patch.skills,['Moler']);
});
test('two personal names do not block a separate explicit Novi Sad area',async()=>{
 const f=fixture({context:savedAreaContext,output:{assistantMessage:'Novi Sad do 30 km je u nacrtu.',safety:'ALLOW',patch:{
  location:{city:'Novi Sad',radiusKm:30},skills:['Krečenje']}}});
 await events(f,{text:'Zovem se Ana i Marina, krečim Novi Sad do 30 km'});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.patch.location?.city,'Novi Sad');
 assert.equal(committed.patch.location?.radiusKm,30);
});
test('explicit correction from 30 to 50 km admits only the corrected radius',async()=>{
 const f=fixture({context:savedAreaContext,output:{assistantMessage:'U nacrtu je sada 50 km.',safety:'ALLOW',patch:{
  location:{radiusKm:50},skills:['Moler']}}});
 await events(f,{text:'Nije 30 km, nego 50 km'});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.patch.location?.radiusKm,50);
 assert.equal(committed.safety,'ALLOW');
});
test('explicit Novi Sad and 30 km cannot commit provider Beograd at 30 km',async()=>{
 const f=fixture({context:savedAreaContext,output:{assistantMessage:'Beograd do 30 km je u nacrtu.',safety:'ALLOW',patch:{
  location:{city:'Beograd',radiusKm:30},skills:['Moler']}}});
 await events(f,{text:'Novi Sad do 30 km'});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.safety,'CLARIFY');
 assert.deepEqual(committed.patch,{skills:['Moler']});
 assert.doesNotMatch(committed.assistantMessage,/Beograd do 30 km je u nacrtu/);
});
test('new Beograd surroundings reject echoed old Niš and its 20 km radius',async()=>{
 const f=fixture({context:savedAreaContext,output:{assistantMessage:'Niš i okolina su u nacrtu.',safety:'ALLOW',patch:{
  location:{city:'Niš',radiusKm:20},skills:['Moler']}}});
 await events(f,{text:'Radim u okolini Beograda'});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.safety,'CLARIFY');
 assert.deepEqual(committed.patch,{skills:['Moler']});
 assert.match(committed.assistantMessage,/Do koliko kilometara/);
});
for(const utterance of ['Radim po Srbiji','Radim u Srbiji','Srbija','po celom Balkanu'])
test('additional broad request rejects one V1 city radius: '+utterance,async()=>{
 const f=fixture({context:savedAreaContext,output:{assistantMessage:'Beograd do 200 km je u nacrtu.',safety:'ALLOW',patch:{
  location:{city:'Beograd',radiusKm:200},skills:['Moler']}}});
 await events(f,{text:utterance});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.safety,'CLARIFY');
 assert.deepEqual(committed.patch,{skills:['Moler']});
 assert.doesNotMatch(committed.assistantMessage,/Beograd do 200 km je u nacrtu/);
});
test('remote-only service plus a separate home city cannot mutate Niš area',async()=>{
 const f=fixture({context:savedAreaContext,output:{assistantMessage:'Novi Sad je novo područje rada.',safety:'ALLOW',patch:{
  location:{city:'Novi Sad',radiusKm:30},skills:['Prevod']}}});
 await events(f,{text:'Samo online. Živim u Novom Sadu.'});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.patch.location,undefined);
 assert.deepEqual(committed.patch.skills,['Prevod']);
 assert.doesNotMatch(committed.assistantMessage,/novo područje rada/);
});
test('unitless correction never commits the rejected old 30 km',async()=>{
 const f=fixture({context:savedAreaContext,output:{assistantMessage:'Ostaje 30 km.',safety:'ALLOW',patch:{
  location:{radiusKm:30},skills:['Moler']}}});
 await events(f,{text:'Nije 30 nego 50'});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.safety,'CLARIFY');
 assert.deepEqual(committed.patch,{skills:['Moler']});
 assert.doesNotMatch(committed.assistantMessage,/Ostaje 30 km/);
});
test('comma-linked remote service preserves separate on-site Novi Sad and radius',async()=>{
 const f=fixture({context:savedAreaContext,output:{assistantMessage:'Novi Sad je u nacrtu.',safety:'ALLOW',patch:{
  location:{city:'Novi Sad',radiusKm:30},skills:['Prevod','Moler']}}});
 await events(f,{text:'Prevod samo online u celoj Srbiji, moler u Novom Sadu do 30 km'});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.patch.location?.city,'Novi Sad');
 assert.equal(committed.patch.location?.radiusKm,30);
});
test('colleague names do not cause a false multi-city rejection',async()=>{
 const f=fixture({context:savedAreaContext,output:{assistantMessage:'Novi Sad je u nacrtu.',safety:'ALLOW',patch:{
  location:{city:'Novi Sad',radiusKm:30},skills:['Moler']}}});
 await events(f,{text:'Ana i Marina rade sa mnom, Novi Sad do 30 km'});
 const committed=completions(f)[0].body.p_output;
 assert.equal(committed.patch.location?.city,'Novi Sad');
 assert.equal(committed.patch.location?.radiusKm,30);
});

test('explicit null cannot fulfill a requested calendar change',async()=>{
 const output={assistantMessage:'Termin je promenjen.',safety:'ALLOW',patch:{bio:'Montaža.',availability:null}};
 const f=fixture({output,availabilityChange:{kind:'PATCH',evidence:'SYNTHETIC_USER_MESSAGE'}});await events(f);
 assert.equal(completions(f)[0].body.p_output.safety,'CLARIFY');
 assert.deepEqual(completions(f)[0].body.p_output.patch,{bio:'Montaža.'});
});
test('distinct owned profile streams real Unicode text, reserves approved budget and completes candidate only',async()=>{
 const f=fixture(),es=await events(f);assert.equal(es[0].kind,'accepted');assert.equal(es.at(-1).kind,'final');assert.deepEqual(es.at(-1).turn,turn());
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),f.output.assistantMessage);
 for(let i=0;i<es.length;i++){assert.equal(es[i].sequence,i+1);assert.equal(es[i].attemptId,attemptId);assert.equal(es[i].conversationId,conversation);}
 assert.equal(providers(f).length,1);assert.equal(completions(f).length,1);assert.deepEqual(completions(f)[0].body.p_output,f.output);
 assert.equal(providers(f)[0].body.generationConfig.maxOutputTokens,8192);assert.equal(f.calls.find(c=>c.url.includes('budget')).body.p_operation_id,key);
 assert.ok(!JSON.stringify(es).includes('PROVIDER_SYNTHETIC'));assert.ok(!f.calls.some(c=>c.url.includes('rpc_save_worker')));
});

for(const registered of [true,false])test(`worker actual handler keeps original service and captures only server-registered alias=${registered}`,async()=>{
 const service='3D štampa',category=id(20);
 const proposal={service,mode:'REMOTE',action:'REUSE_ALIAS',categoryId:category,parentId:'',proposedPath:[],reason:'Explicit synthetic worker service and remote mode.',catalogVersion:7};
 const output={assistantMessage:'Proveri svoj nacrt.',safety:'ALLOW',patch:{skills:[service]},classificationShadowJson:JSON.stringify([proposal])};
 const f=fixture({output,env:{USKOCI_TAXONOMY_UNIFIED_SHADOW:'true',USKOCI_TAXONOMY_SHADOW_CAPTURE:'true'},
  catalog:body=>({action:'CATALOG_CONTEXT',scope:body.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',catalogVersion:7,
   catalogFingerprint:'a'.repeat(32),items:body.p_execution_location_mode==='REMOTE'?[{
    categoryId:category,parentId:null,label:'3D printovanje',aliases:registered?[service]:[],path:['3D printovanje'],isLeaf:true,
   }]:[],nextAfter:null,classificationAuthority:'NONE',notificationAuthority:'NONE'}),
 });
 const es=await events(f);
 assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);assert.equal(failures(f).length,0);
 assert.equal(completions(f).length,1);
 assert.deepEqual(completions(f)[0].body.p_output.patch.skills,[service]);
 assert.equal(Object.hasOwn(completions(f)[0].body.p_output,'classificationShadowJson'),false);
 const capture=f.calls.filter(c=>c.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'));
 assert.equal(capture.length,registered?1:0);
 if(registered){
  assert.deepEqual(capture[0].body.p_proposals,[{...proposal,action:'REUSE_EXISTING'}]);
  assert.ok(f.calls.indexOf(capture[0])>f.calls.indexOf(completions(f)[0]));
 }
 assert.ok(!f.calls.some(c=>/save_worker|ensure_path|commit_admission|publish|push/.test(c.url)));
});

function paintingFixture(shadow,options={}){
 const service='Krečenje zidova',category=id(23);
 const proposal={service,mode:'ON_SITE',action:'REUSE_EXISTING',categoryId:category,parentId:'',proposedPath:[],
  reason:'The worker explicitly offers painting at the customer location.',catalogVersion:7};
 const output={assistantMessage:'Pregledaj nacrt pre čuvanja.',safety:'ALLOW',patch:{skills:[service]},
  ...(shadow==='missing'?{}:{classificationShadowJson:shadow==='valid'?JSON.stringify([proposal]):shadow})};
 return fixture({output,log:options.log,
  env:{USKOCI_TAXONOMY_UNIFIED_SHADOW:'true',USKOCI_TAXONOMY_SHADOW_CAPTURE:'true',...options.env},
  catalog:body=>({action:'CATALOG_CONTEXT',scope:body.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',catalogVersion:7,
   catalogFingerprint:'a'.repeat(32),items:body.p_execution_location_mode==='REMOTE'?[]:[
    {categoryId:id(21),parentId:null,label:'Molerski radovi',aliases:[],path:['Molerski radovi'],isLeaf:false},
    {categoryId:id(22),parentId:id(21),label:'Krečenje',aliases:[],path:['Molerski radovi','Krečenje'],isLeaf:false},
    {categoryId:category,parentId:id(22),label:service,aliases:[],path:['Molerski radovi','Krečenje',service],isLeaf:true},
   ],nextAfter:null,classificationAuthority:'NONE',notificationAuthority:'NONE'})});
}

test('two explicit remote services retain both hints when the model tries to recreate an exact existing presentation service',async()=>{
 const service='Izrada prezentacija',translation='Prevođenje tekstova',parent=id(50),presentationId=id(51),translationId=id(52);
 const user='Bavim se izradom prezentacija i prevodom tekstova. Radim od kuće, radnim danima od 18 do 21. Imam i kombi, ali ne nudim prevoz.';
 const scopeQuote='Radim od kuće',calendarQuote='radnim danima od 18 do 21';
 const hints=[{service,mode:'REMOTE',action:'CREATE_CHILD',categoryId:'',parentId:parent,proposedPath:[service],reason:'Explicitly offered presentation work from home.',catalogVersion:7,handoff:{required:false}},
  {service:translation,mode:'REMOTE',action:'REUSE_EXISTING',categoryId:translationId,parentId:'',proposedPath:[],reason:'Explicitly offered text translation from home.',catalogVersion:7,handoff:{required:false}}];
 const context={schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:false,safety:'ALLOW',revision:0,
  serviceModeContext:{schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:0,savedServices:[],draftServices:[],unresolvedServices:[]},
  candidate:{skills:[],availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},messages:[{role:'USER',body:user}]};
 const availability={ruleChanges:[{ruleId:null,weekdays:[1,2,3,4,5],value:{startTime:'18:00',endTime:'21:00',startsOn:'2026-10-20',endsOn:null,label:'Radnim danima',active:true}}]};
 const logs=[],f=fixture({context,log:args=>logs.push(args),availabilityChange:{kind:'PATCH',evidence:calendarQuote},
  output:{assistantMessage:'Obe usluge i radno vreme su u nacrtu.',safety:'ALLOW',patch:{skills:[service,translation],vehicles:['Kombi'],availability},
   serviceModeChangesJson:JSON.stringify([service,translation].map(service=>({service,modes:['REMOTE'],evidence:scopeQuote,handoff:{required:false}}))),
   classificationShadowJson:JSON.stringify(hints)},
  env:{USKOCI_TAXONOMY_UNIFIED_SHADOW:'true',USKOCI_TAXONOMY_SHADOW_CAPTURE:'true'},
  catalog:body=>({action:'CATALOG_CONTEXT',scope:body.p_execution_location_mode,catalogVersion:7,catalogFingerprint:'a'.repeat(32),
   items:body.p_execution_location_mode==='ON_SITE'?[{categoryId:parent,parentId:null,label:'Digitalne usluge',aliases:[],path:['Digitalne usluge'],isLeaf:false}]:[
    {categoryId:presentationId,parentId:parent,label:service,aliases:[],path:['Digitalne usluge',service],isLeaf:true},
    {categoryId:translationId,parentId:parent,label:translation,aliases:[],path:['Digitalne usluge',translation],isLeaf:true}],
   nextAfter:null,classificationAuthority:'NONE',notificationAuthority:'NONE'})});
 const es=await events(f,{text:user});assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);
 const saved=completions(f)[0].body.p_output;assert.deepEqual(saved.patch.skills,[service,translation]);assert.deepEqual(saved.patch.availability,availability);
 assert.equal(Object.hasOwn(saved.patch,'vehicles'),false,'volunteered equipment cannot update the owned candidate');
 const capture=f.calls.find(c=>c.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'));
 assert.ok(capture);assert.deepEqual(capture.body.p_proposals.map(p=>[p.service,p.mode,p.action,p.categoryId]),
  [[service,'REMOTE','REUSE_EXISTING',presentationId],[translation,'REMOTE','REUSE_EXISTING',translationId]]);
 assert.ok(f.calls.indexOf(capture)>f.calls.indexOf(completions(f)[0]));
 assert.ok(logs.some(args=>args[0]==='WORKER_TAXONOMY_IDENTITY_RECOVERY'&&args[1]===1));
 assert.ok(!f.calls.some(c=>/save_worker|ensure_path|commit_admission|publish|push/.test(c.url)));
});

test('known painting leaf is proposed ON_SITE through actual worker catalog schema and hint capture',async()=>{
 const f=paintingFixture('valid'),es=await events(f);
 assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);
 const provider=providers(f)[0].body,schema=provider.generationConfig.responseSchema;
 assert.ok(schema.required.includes('classificationShadowJson'));
 assert.deepEqual(schema.properties.classificationShadowJson,{type:'STRING'});
 const capture=f.calls.find(c=>c.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'));
 assert.deepEqual(capture.body.p_proposals.map(p=>[p.service,p.mode,p.categoryId]),[['Krečenje zidova','ON_SITE',id(23)]]);
 assert.ok(f.calls.indexOf(capture)>f.calls.indexOf(completions(f)[0]));
 assert.deepEqual(completions(f)[0].body.p_output.patch.skills,['Krečenje zidova']);
 assert.ok(!Object.hasOwn(completions(f)[0].body.p_output,'classificationShadowJson'));
 assert.ok(!f.calls.some(c=>/rpc_save_worker|ensure_path|commit_admission|publish|push/.test(c.url)));
});

for(const [shadow,diagnostic] of [['missing','MISSING_CLASSIFICATION_SHADOW'],['[]','EMPTY_CLASSIFICATION_SHADOW']])
test('worker '+diagnostic+' remains unresolved without catalog-mode inference or a paid retry',async()=>{
 const logs=[],f=paintingFixture(shadow,{log:args=>logs.push(args)}),es=await events(f);
 assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);assert.equal(completions(f).length,1);
 assert.ok(logs.some(args=>args[0]==='WORKER_TAXONOMY_PLAN_SHADOW'&&args[1]===diagnostic));
 assert.ok(!JSON.stringify(logs).includes('Krečenje'));
 assert.ok(!f.calls.some(c=>c.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service')));
 assert.deepEqual(completions(f)[0].body.p_output.patch.skills,['Krečenje zidova']);
});

test('worker without active catalog protocol retains its original provider schema',async()=>{
 const f=paintingFixture('missing',{env:{USKOCI_TAXONOMY_UNIFIED_SHADOW:'false'}});await events(f);
 const schema=providers(f)[0].body.generationConfig.responseSchema;
 assert.ok(!schema.required.includes('classificationShadowJson'));
 assert.ok(!Object.hasOwn(schema.properties,'classificationShadowJson'));
 assert.ok(!f.calls.some(c=>c.url.endsWith('/rpc_taxonomy_query_catalog_service')));
});

test('stale painting proposal cannot become a current service mode despite a known exact leaf',async()=>{
 const proposal={service:'Krečenje zidova',mode:'ON_SITE',action:'REUSE_EXISTING',categoryId:id(23),parentId:'',proposedPath:[],
  reason:'Synthetic stale proposal from the previous catalog.',catalogVersion:6};
 const logs=[],f=paintingFixture(JSON.stringify([proposal]),{log:args=>logs.push(args)});await events(f);
 assert.equal(providers(f).length,1);
 assert.ok(logs.some(args=>args[0]==='WORKER_TAXONOMY_PLAN_SHADOW'&&args[1]==='STALE_CATALOG'));
 assert.ok(!f.calls.some(c=>c.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service')));
});
test('completed/unknown claim replay cannot reserve or call the provider again',async()=>{
 const f=fixture({replay:true});assert.deepEqual(await(await f.invoke()).json(),turn());assert.equal(providers(f).length,0);assert.equal(f.calls.length,2);
});
test('draft worker requires administrative city for activation without limiting remote work or asking an address',async()=>{
 const f=fixture(); await events(f);
 const instruction=providers(f)[0].body.systemInstruction.parts.map(p=>p.text).join('\n');
 assert.match(instruction,/rpc_complete_worker_profile requires a city for a NEW DRAFT, even for REMOTE work/);
 assert.match(instruction,/if missing, ask ONE short natural question for the administrative city/);
 assert.match(instruction,/Administrative city does NOT restrict REMOTE matching/);
 assert.match(instruction,/Do not reopen the city interview only because an old profile lacks a city/);
 assert.match(instruction,/never invent a city or infer it from language, phone, service, work area or geolocation/);
 assert.match(instruction,/Only explicit Sačuvaj profil in the review applies the changes/);
 assert.match(instruction,/Never require a home city, address or GPS for a new worker/);
});
test('contextual worker clarification survives completion and stream without invented profile changes',async()=>{
 const output={assistantMessage:'Izvini, nije mi sasvim jasno na šta misliš. Možeš li to da kažeš drugim rečima?',safety:'CLARIFY',patch:{}};
 const f=fixture({output}),es=await events(f,{text:'SYNTHETIC_UNCLEAR_TEXT'});
 assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);assert.equal(completions(f).length,1);
 assert.deepEqual(completions(f)[0].body.p_output,output);
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),output.assistantMessage);
 const prompt=providers(f)[0].body.systemInstruction.parts.map(p=>p.text).join('\n');
 assert.ok(prompt.includes('USKOČI glas:'));
 assert.ok(prompt.includes('Povremeno može jedan nenametljiv smajli'));
 assert.ok(prompt.includes('niti izmišljaj lično iskustvo'));
 assert.ok(prompt.includes('safety CLARIFY with an empty patch'));
 assert.ok(prompt.includes('You receive text only, not sound'));
 // Actual provider instructions distinguish any proposed edit (even ACTIVE)
 // from public profile persistence; this is not a claim about model compliance.
 assert.ok(prompt.includes('Every proposed change is in the NACRT, including edits to an already ACTIVE profile'));
 assert.ok(prompt.includes('Dodato je u nacrt profila'));
 assert.ok(prompt.includes('ostalo ostaje nepromenjeno'));
 assert.ok(prompt.includes('Only explicit Sačuvaj profil in the review applies the changes'));
 assert.ok(prompt.includes('Never describe proposed changes as saved to the profile, activated or already used for matching/notifications'));
 assert.ok(!prompt.includes('Prefer the question alone'));
});
for(const env of [{USKOCI_GEMINI_PAID_TEST_ENABLED:''},{AI_PROVIDER:'openai'},{GEMINI_MODEL:'another-model'}])test('unapproved config remains closed before reservation/provider',async()=>{
 const f=fixture({env});assert.equal((await f.invoke()).status,503);assert.equal(providers(f).length,0);assert.equal(failures(f).length,1);assert.ok(!f.calls.some(c=>c.url.includes('budget')));
});
for(const budget of [{admitted:false,reservationId:null,replay:false,code:'AI_TEST_BUDGET_EXHAUSTED'},
 {admitted:false,reservationId:id(8),replay:true,code:'AI_TEST_OPERATION_REPLAY'}])test('budget denial or replay cannot call provider',async()=>{
 const f=fixture({budget});assert.equal((await f.invoke()).status,503);assert.equal(providers(f).length,0);assert.equal(failures(f).length,1);
});
for(const context of [{schemaVersion:'NEED_FACT_V2'},{schemaVersion:'WORKER_PROFILE_V1',accountId:id(99)},
 {schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:true}])test('wrong schema, owner or stale context fails before budget/provider',async()=>{
 const f=fixture({context});assert.equal((await f.invoke()).status,409);assert.equal(providers(f).length,0);assert.ok(!f.calls.some(c=>c.url.includes('budget')));
});
test('model cannot add task facts, verified fields or invented coordinates',async()=>{
 for(const patch of [{'need.title':'Wrong schema'},{verifiedIdentity:true},{location:{approximatePosition:{latitude:44.81,longitude:20.46}}},
  {licenses:['SYNTHETIC_LICENSE']},{teamCapacity:3},{excludedWork:['SYNTHETIC_EXCLUSION']},{urgentNotifications:true}]){
  const f=fixture({output:{assistantMessage:'Test',safety:'ALLOW',patch}}),es=await events(f);
  assert.equal(es.at(-1).kind,'safe_error');assert.equal(completions(f).length,0);assert.equal(failures(f).length,1);
  assert.ok(!es.some(e=>e.kind==='text_delta'),'invalid output is never presented to the person');
 }
});

test('personal interview filters obsolete fields without changing the owned V1 candidate or inventing preferences',async()=>{
 const candidate={displayName:'Ana',bio:'',skills:['Selidbe'],tools:['Kolica'],vehicles:['Kombi'],licenses:['PRIVATE_LEGACY_LICENSE'],teamCapacity:37,
  location:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:20},availability:{timezone:'Europe/Belgrade',availableNow:false,rules:[],windows:[]}};
 const f=fixture({context:{schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:false,safety:'ALLOW',
  candidate,messages:[{role:'USER',body:'SYNTHETIC_USER_MESSAGE'}]}});
 const es=await events(f);assert.equal(es.at(-1).kind,'final');
 const provider=providers(f)[0].body,prompt=provider.systemInstruction.parts.map(p=>p.text).join('\n');
 assert.ok(!prompt.includes('PRIVATE_LEGACY_LICENSE'));assert.ok(!prompt.includes('"teamCapacity"'));
 assert.ok(!prompt.includes('"tools":["Kolica"]'));assert.ok(!prompt.includes('"vehicles":["Kombi"]'));
 const fields=provider.generationConfig.responseSchema.properties.patch.properties;
 assert.ok(!Object.hasOwn(fields,'licenses'));assert.ok(!Object.hasOwn(fields,'teamCapacity'));
 assert.ok(!Object.hasOwn(fields,'excludedWork'));assert.ok(!Object.hasOwn(fields,'urgentNotifications'));
 assert.equal(candidate.teamCapacity,37);assert.deepEqual(candidate.licenses,['PRIVATE_LEGACY_LICENSE']);
 assert.ok(prompt.includes('ONE person'));assert.ok(prompt.includes('no separate exclusion or urgent-notification preference field'));
 assert.ok(!JSON.stringify(provider.systemInstruction.parts.slice(0,2)).includes('"tools":["Kolica"]'));
 assert.ok(!JSON.stringify(provider.systemInstruction.parts.slice(0,2)).includes('"city":"Novi Sad"'));
 assert.equal(provider.systemInstruction.parts.filter(p=>p.text.includes('Current owned candidate')).length,1);
});

function modeFixture(options={}) {
 const service='Izrada maketa', category=id(20);
 const proposal=mode=>({service,mode,action:'REUSE_EXISTING',categoryId:category,parentId:'',proposedPath:[],
  reason:'Synthetic service mode proposal for the current candidate.',catalogVersion:7});
 const context={schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:false,safety:'ALLOW',revision:2,
  candidate:{skills:[service],bio:'Prethodni opis',availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},
  serviceModeContext:{schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:2,
   savedServices:[{service,categoryId:category,mode:'REMOTE'}],
   draftServices:['REMOTE','ON_SITE'].map(mode=>({service,categoryId:category,mode})),unresolvedServices:[]},
  messages:options.messages??[{role:'USER',body:'Dopuni samo opis profila.'}],...options.context};
 const output={assistantMessage:'Dopunio sam opis. Pregledaj izmene pre čuvanja.',safety:'ALLOW',patch:{bio:'Dopunjen opis'},
  classificationShadowJson:JSON.stringify(['REMOTE','ON_SITE'].map(proposal)),...options.output};
 return fixture({context,output,env:{USKOCI_TAXONOMY_UNIFIED_SHADOW:'true',USKOCI_TAXONOMY_SHADOW_CAPTURE:'true'},
  catalog:body=>({action:'CATALOG_CONTEXT',scope:body.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',catalogVersion:7,
   catalogFingerprint:'a'.repeat(32),items:options.catalogItems?.(body)??(options.retired||options.catalogModes&&!options.catalogModes.includes(body.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE')?[]:[{categoryId:category,parentId:null,label:service,aliases:['Modeli po meri'],path:[service],isLeaf:true}]),
   nextAfter:null,classificationAuthority:'NONE',notificationAuthority:'NONE'})});
}
const capturedModes=f=>f.calls.filter(c=>c.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service')).flatMap(c=>c.body.p_proposals.map(p=>p.mode));

test('bio-only edit preserves saved REMOTE despite a prior unconfirmed draft and both catalog modes',async()=>{
 const f=modeFixture();await events(f);
 assert.deepEqual(capturedModes(f),['REMOTE']);
 assert.deepEqual(completions(f)[0].body.p_output.patch,{bio:'Dopunjen opis'});
 assert.equal(providers(f).length,1);assert.ok(!f.calls.some(c=>/rpc_save_worker|rpc_set_worker_execution_modes/.test(c.url)));
 const prompt=providers(f)[0].body.systemInstruction.parts.map(p=>p.text).join('\n');
 assert.ok(prompt.includes('savedServices'));assert.ok(prompt.includes('does NOT mean this person offers both'));
 assert.ok(!Object.hasOwn(completions(f)[0].body.p_output,'serviceModeChangesJson'));
 assert.ok(!Object.hasOwn(completions(f)[0].body.p_output,'classificationShadowJson'));
});
test('conflicting dual-mode saved IDs and fresh hints never reach handler capture; unrelated saved service survives',async()=>{
 const service='Izrada maketa',other='Prevod teksta';
 const onsiteId=id(20),remoteId=id(21),otherId=id(22);
 const row=(categoryId,label)=>({categoryId,parentId:null,label,aliases:[],path:[label],isLeaf:true});
 const hint=(label,mode,categoryId)=>({service:label,mode,action:'REUSE_EXISTING',categoryId,
  parentId:'',proposedPath:[],reason:'Synthetic saved service identity for an unrelated profile edit.',catalogVersion:7});
 const savedServices=[{service,mode:'ON_SITE',categoryId:onsiteId},{service,mode:'REMOTE',categoryId:remoteId},
  {service:other,mode:'REMOTE',categoryId:otherId}];
 const f=modeFixture({context:{candidate:{skills:[service,other],bio:'Prethodni opis',availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},
  serviceModeContext:{schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:2,savedServices,draftServices:[],unresolvedServices:[]}},
  output:{classificationShadowJson:JSON.stringify([hint(service,'ON_SITE',onsiteId),hint(service,'REMOTE',remoteId),hint(other,'REMOTE',otherId)])},
  catalogItems:body=>body.p_execution_location_mode==='REMOTE'?[row(remoteId,service),row(otherId,other)]:[row(onsiteId,service)]});
 await events(f);
 const captures=f.calls.filter(c=>c.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'));
 assert.equal(captures.length,1);
 assert.deepEqual(captures[0].body.p_proposals.map(p=>[p.service,p.mode,p.categoryId]),[[other,'REMOTE',otherId]]);
 assert.deepEqual(savedServices.map(p=>[p.service,p.mode,p.categoryId]),[
  [service,'ON_SITE',onsiteId],[service,'REMOTE',remoteId],[other,'REMOTE',otherId]],'a chat turn does not rewrite saved modes');
 assert.deepEqual(completions(f)[0].body.p_output.patch,{bio:'Dopunjen opis'});
 assert.match(completions(f)[0].body.p_output.assistantMessage,/povezivanje vrste usluge još nije provereno/);
});
test('a server-registered alias of the same service cannot bypass saved REMOTE continuity',async()=>{
 const service='Modeli po meri';
 const f=modeFixture({output:{patch:{skills:[service]},classificationShadowJson:JSON.stringify(['REMOTE','ON_SITE'].map(mode=>({
  service,mode,action:'REUSE_EXISTING',categoryId:id(20),parentId:'',proposedPath:[],reason:'Synthetic alias of the same existing offered service.',catalogVersion:7})))}});
 await events(f);assert.deepEqual(capturedModes(f),['REMOTE']);
 assert.deepEqual(completions(f)[0].body.p_output.patch.skills,[service]);
});
test('a new service with an explicit REMOTE declaration cannot capture an extra ON_SITE hint',async()=>{
 const quote='Ovu uslugu radim samo na daljinu.';
 const f=modeFixture({context:{serviceModeContext:{schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:2,savedServices:[],draftServices:[],unresolvedServices:['Izrada maketa']}},
  messages:[{role:'USER',body:quote}],output:{serviceModeChangesJson:JSON.stringify([{service:'Izrada maketa',modes:['REMOTE'],evidence:quote}])}});
 await events(f);assert.deepEqual(capturedModes(f),['REMOTE']);
});
test('unconfirmed draft modes cannot replace an absent or revoked saved baseline',async()=>{
 const service='Izrada maketa', categoryId=id(20);
 const f=modeFixture({context:{serviceModeContext:{schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:2,
  savedServices:[],draftServices:['REMOTE','ON_SITE'].map(mode=>({service,categoryId,mode})),unresolvedServices:[]}},
  output:{classificationShadowJson:JSON.stringify([{service,mode:'REMOTE',action:'REUSE_EXISTING',categoryId,
   parentId:'',proposedPath:[],reason:'Current proposal offers only remote service.',catalogVersion:7}])}});
 await events(f);assert.deepEqual(capturedModes(f),['REMOTE']);
});
test('finish copy uses the preserved baseline rather than the omitted provider snapshot',async()=>{
 const f=modeFixture({output:{classificationShadowJson:'[]'}});await events(f,{text:'To je to.'});
 assert.deepEqual(capturedModes(f),['REMOTE']);
 assert.ok(!completions(f)[0].body.p_output.assistantMessage.includes('nije potvrđeno'));
 assert.deepEqual(completions(f)[0].body.p_output.patch,{});
});
for(const history of [false,true])test('an explicit owned USER mode-change proposal survives for review, earlier turn='+history,async()=>{
 const quote='Od sada makete izrađujem samo na lokaciji naručioca.';
 const f=modeFixture({messages:[{role:'USER',body:quote},...(history?[{role:'ASSISTANT',body:'Pregledaj promenu.'},{role:'USER',body:'Dopuni opis profila.'}]:[])],
  output:{serviceModeChangesJson:JSON.stringify([{service:'Izrada maketa',modes:['ON_SITE'],evidence:quote}])}});
 await events(f);assert.deepEqual(capturedModes(f),['ON_SITE']);
 assert.equal(f.calls.filter(c=>c.url.endsWith('/rpc_complete_worker_ai_turn_service')).length,1);
});
for(const evidence of ['Samo na lokaciji naručioca.','Izmišljena izjava koja ne postoji.'])
test('assistant-only or invented mode evidence cannot replace saved choices: '+evidence,async()=>{
 const f=modeFixture({messages:[{role:'ASSISTANT',body:'Samo na lokaciji naručioca.'},{role:'USER',body:'Dopuni samo opis profila.'}],
  output:{serviceModeChangesJson:JSON.stringify([{service:'Izrada maketa',modes:['ON_SITE'],evidence}])}});
 await events(f);assert.deepEqual(capturedModes(f),['REMOTE']);
});
test('an omitted classification snapshot retains a known service without another provider call',async()=>{
 const f=modeFixture({output:{classificationShadowJson:'[]'}});await events(f);
 assert.deepEqual(capturedModes(f),['REMOTE']);assert.equal(providers(f).length,1);
});
test('removing the offered skill cannot resurrect it from saved mode context',async()=>{
 const f=modeFixture({output:{patch:{skills:[]}}});await events(f);
 assert.deepEqual(capturedModes(f),[]);assert.deepEqual(completions(f)[0].body.p_output.patch,{skills:[]});
});
test('retired catalog identity is not revived by saved service continuity',async()=>{
 const f=modeFixture({retired:true});await events(f);assert.deepEqual(capturedModes(f),[]);
});

test('revoked REMOTE catalog scope is not revived by an empty required worker snapshot',async()=>{
 const f=modeFixture({catalogModes:['ON_SITE'],output:{classificationShadowJson:'[]'}});await events(f);
 assert.deepEqual(capturedModes(f),[]);assert.equal(providers(f).length,1);
 assert.ok(providers(f)[0].body.generationConfig.responseSchema.required.includes('classificationShadowJson'));
});
test('a safety refusal cannot capture even a valid saved mode',async()=>{
 const f=modeFixture({output:{safety:'BLOCK',patch:{},assistantMessage:'Ne mogu da pomognem sa tim zahtevom.'}});await events(f);
 assert.deepEqual(capturedModes(f),[]);assert.equal(completions(f)[0].body.p_output.safety,'BLOCK');
});
for(const serviceModeContext of [undefined,{schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:99,savedServices:[],draftServices:[],unresolvedServices:[]}])
test('missing/stale authoritative mode context stops before any paid call',async()=>{
 const f=modeFixture({context:{serviceModeContext}});const response=await f.invoke();
 assert.equal(response.status,503);assert.equal(providers(f).length,0);assert.equal(completions(f).length,0);
 assert.equal(f.calls.filter(c=>c.url.includes('budget_reserve')).length,0);
});

// Synthetic provider replies exercise the actual handler boundary. Prompt
// assertions do not prove that a live model always preserves the intended list.
for(const change of ['add','remove'])test(`worker ${change} instruction keeps unrelated services/resources and only proposes changes`,async()=>{
 const candidate={displayName:'Ana',bio:'',skills:['Krečenje','Gletovanje'],tools:['Valjak'],vehicles:[],
  location:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:20},availability:{timezone:'Europe/Belgrade',availableNow:false,rules:[],windows:[]}};
 const previous=JSON.stringify(candidate);
 const desired=change==='add'?['Krečenje','Gletovanje','Postavljanje tapeta']:['Krečenje'];
 const output={assistantMessage:'Proveri izmenu usluga u pregledu.',safety:'ALLOW',patch:{skills:desired}};
 const f=fixture({output,context:{schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',profileStatus:'ACTIVE',
  stale:false,safety:'ALLOW',candidate,messages:[{role:'USER',body:change==='add'?'Dodaj i postavljanje tapeta.':'Više ne nudim gletovanje.'}]}});
 assert.equal((await events(f,{text:change==='add'?'Dodaj i postavljanje tapeta.':'Više ne nudim gletovanje.'})).at(-1).kind,'final');
 assert.equal(providers(f).length,1);assert.deepEqual(completions(f)[0].body.p_output.patch,{skills:desired});
 assert.equal(JSON.stringify(candidate),previous);assert.ok(!f.calls.some(c=>/save_worker|bind_reviewed|commit_admission|publish|push/.test(c.url)));
 const prompt=providers(f)[0].body.systemInstruction.parts.map(p=>p.text).join('\n');
 assert.ok(prompt.includes('The skills array is a COMPLETE replacement list, not additions'));
 assert.ok(prompt.includes('keep every existing offered service the person has not explicitly removed'));
 assert.ok(prompt.includes('Changing the delivery mode of one service does not change other services'));
 assert.ok(prompt.includes('Do not ask about tools or vehicles'));
 assert.ok(prompt.includes('do not ask about them, propose patch.tools or patch.vehicles, clear them'));
 assert.ok(prompt.includes('Existing values remain visible in the signed profile review'));
 assert.ok(prompt.includes('classificationShadowJson is only a proposal'));
 assert.ok(prompt.includes('signed profile review'));
 assert.ok(!prompt.includes('pending a future confirmed structured capability review'));
 assert.ok(prompt.includes("'Znam engleski' is general knowledge, NOT consent to tutoring or translating"));
 assert.ok(prompt.includes("'Imam kombi' is equipment, NOT consent to transport or removals"));
});

for(const input of ['To je to.','Sačuvaj','Сачувај','Gotovo, to je sve!','Hvala, to je to.','To je sve, hvala Vam!','Хвала, то је све.','То је то, хвала!'])
 test('finish request hands off to profile review without another availability question: '+input,async()=>{
  const output={assistantMessage:'Da li su tvoje radno vreme i dostupnost tačni?',safety:'ALLOW',patch:{tools:['Izmišljeni alat']}};
  const f=fixture({output}),es=await events(f,{text:input});
  assert.equal(es.at(-1).kind,'final');
  const applied=completions(f)[0].body.p_output;
  assert.deepEqual(applied.patch,{},'finish is not authorization for invented profile changes');
  assert.equal(applied.assistantMessage,
   'Otvorite pregled profila. Tamo možete da dopunite podatke i potvrdite čuvanje.'+
   ' Ako želite, mogu da sastavim kratak opis Vašeg rada na osnovu potvrđenih podataka.'+
   ' Opis nije uslov za pregled ili čuvanje.');
  assert.ok(!applied.assistantMessage.includes('?'),'optional offer is a statement, not a new interview question');
  assert.ok(!Object.hasOwn(applied.patch,'bio'),'finish must not silently invent a biography');
  assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),applied.assistantMessage);
  assert.ok(!es.some(e=>e.text?.includes('dostupnost')));
  assert.equal(providers(f).length,1,'no second paid model call to rewrite a reply');
 });

test('finish handling does not swallow a correction or override a safety refusal',async()=>{
 const plain=fixture(),es=await events(plain,{text:'Nemoj još da sačuvaš.'});assert.equal(es.at(-1).kind,'final');
 assert.deepEqual(completions(plain)[0].body.p_output,plain.output);
 const courtesy=fixture();
 await events(courtesy,{text:'Hvala, to je to, ali želim da promenim uslugu.'});
 assert.deepEqual(completions(courtesy)[0].body.p_output,courtesy.output,
   'a polite correction must reach the actual provider, not be erased by finish-only');
 const equipment=fixture(),equipmentEvents=await events(equipment,{text:'Sačuvaj, ali dodaj da imam kolica.'});
 assert.equal(equipmentEvents.at(-1).kind,'final');
 assert.deepEqual(completions(equipment)[0].body.p_output.patch,equipment.output.patch);
 assert.match(completions(equipment)[0].body.p_output.assistantMessage,/Alat i vozila ne menjam kroz ovaj razgovor/);
 const f=fixture({output:{assistantMessage:'Ne mogu da pomognem sa tim zahtevom.',safety:'BLOCK',patch:{}}});
 await events(f,{text:'Sačuvaj'});assert.equal(completions(f)[0].body.p_output.safety,'BLOCK');
});

test('new worker equipment edits are dropped without hiding historical signed-review values',async()=>{
 const candidate={displayName:'Ana',bio:'Postojeći opis.',skills:['Krečenje'],tools:['Valjak'],vehicles:['Kombi'],
  location:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:20},availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}};
 const before=JSON.stringify(candidate);
 const output={assistantMessage:'Dodao sam novu bušilicu i uklonio kombi.',safety:'ALLOW',
  patch:{bio:'Imam novu bušilicu.',skills:['Krečenje','Gletovanje'],tools:['Nova bušilica'],vehicles:[]}};
 const f=fixture({output,context:{schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',
  stale:false,safety:'ALLOW',candidate,messages:[{role:'USER',body:'Dodaj gletovanje i novu bušilicu.'}]}});
 const es=await events(f,{text:'Dodaj gletovanje i novu bušilicu.'});
 assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);assert.equal(completions(f).length,1);
 const accepted=completions(f)[0].body.p_output;
 assert.deepEqual(accepted.patch,{skills:['Krečenje','Gletovanje']});
 assert.equal(accepted.safety,'ALLOW');
 assert.match(accepted.assistantMessage,/Alat i vozila ne menjam kroz ovaj razgovor/);
 assert.ok(!JSON.stringify(es).includes('Dodao sam novu bušilicu'));
 assert.equal(JSON.stringify(candidate),before,'historical candidate data is not cleared or mutated');
 const prompt=providers(f)[0].body.systemInstruction.parts.map(p=>p.text).join('\n');
 assert.ok(!prompt.includes('"tools":["Valjak"]'));assert.ok(!prompt.includes('"vehicles":["Kombi"]'));
 assert.ok(prompt.includes('Existing values remain visible in the signed profile review'));
 assert.ok(!f.calls.some(c=>/rpc_save_worker_ai_review/.test(c.url)));
});

test('bio-only vehicle claim is quarantined at the exact worker completion and stream boundary',async()=>{
 const output={assistantMessage:'Dodao sam novi kombi u nacrt profila.',safety:'ALLOW',patch:{bio:'Imam novi kombi.'}};
 const f=fixture({output}),es=await events(f,{text:'Imam novi kombi.'});
 assert.equal(es.at(-1).kind,'final');assert.equal(completions(f).length,1);
 const accepted=completions(f)[0].body.p_output;
 assert.deepEqual(accepted.patch,{});assert.equal(accepted.safety,'ALLOW');
 assert.match(accepted.assistantMessage,/Alat i vozila ne menjam kroz ovaj razgovor/);
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),accepted.assistantMessage);
 assert.ok(!JSON.stringify(es).includes('Dodao sam novi kombi'));
 assert.ok(!f.calls.some(c=>/rpc_save_worker_ai_review/.test(c.url)));
});

for(const input of ['Imam novi kombi.','Имам нови комби.'])
test('equipment-only user turn cannot receive a false acknowledgement without any patch: '+input,async()=>{
 const output={assistantMessage:'Novi kombi je dodat u nacrt.',safety:'ALLOW',patch:{}};
 const f=fixture({output}),es=await events(f,{text:input});
 const accepted=completions(f)[0].body.p_output;
 assert.deepEqual(accepted.patch,{});
 assert.match(accepted.assistantMessage,/Alat i vozila ne menjam kroz ovaj razgovor/);
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),accepted.assistantMessage);
 assert.ok(!JSON.stringify(es).includes(output.assistantMessage));
});

test('mixed equipment turn preserves independent service, area and calendar operations',async()=>{
 const input='Dodaj gletovanje. Radim u Novom Sadu do 30 km. Radnim danima od 9 do 17. Imam novi kombi.';
 const availability={ruleChanges:[{ruleId:null,weekdays:[1,2,3,4,5],value:{startTime:'09:00',endTime:'17:00',startsOn:'2026-10-21',endsOn:null,label:'Radni dani',active:true}}]};
 const independent={skills:['Gletovanje'],location:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:30},availability};
 const output={assistantMessage:'Gletovanje, područje, termini i novi kombi su u nacrtu.',safety:'ALLOW',
  patch:{...independent,bio:'Imam novi kombi.'}};
 const f=fixture({output,availabilityChange:{kind:'PATCH',evidence:'Radnim danima od 9 do 17'},
  context:{schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:false,safety:'ALLOW',revision:0,
   candidate:{skills:[],availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},messages:[{role:'USER',body:input}]}});
 const es=await events(f,{text:input});assert.equal(es.at(-1).kind,'final');
 const accepted=completions(f)[0].body.p_output;
 assert.deepEqual(accepted.patch,independent);assert.equal(accepted.safety,'ALLOW');
 assert.match(accepted.assistantMessage,/Alat i vozila ne menjam kroz ovaj razgovor/);
 assert.ok(!JSON.stringify(es).includes('novi kombi su u nacrtu'));
});

test('offered vehicle repair remains a legitimate service and biography',async()=>{
 const output={assistantMessage:'Popravka vozila je u nacrtu.',safety:'ALLOW',
  patch:{skills:['Popravka vozila'],bio:'Popravljam vozila.'}};
 const f=fixture({output}),es=await events(f,{text:'Popravljam vozila.'});
 assert.equal(es.at(-1).kind,'final');
 assert.deepEqual(completions(f)[0].body.p_output,output);
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),output.assistantMessage);
});

for(const safety of ['REVIEW','BLOCK'])test(`${safety} does not admit equipment or biography from a rejected equipment turn`,async()=>{
 const output={assistantMessage:safety==='REVIEW'?'Potreban je pregled.':'Ne mogu da pomognem sa tim zahtevom.',safety,
  patch:{bio:'Imam novi kombi.',tools:['Bušilica'],vehicles:['Kombi']}};
 const f=fixture({output}),es=await events(f);
 assert.equal(es.at(-1).kind,'final');
 const accepted=completions(f)[0].body.p_output;
 assert.equal(accepted.safety,safety);assert.equal(accepted.assistantMessage,output.assistantMessage);
 assert.deepEqual(accepted.patch,{});
});
test('truncated provider response settles failure without a second call or candidate completion',async()=>{
 const f=fixture({finishReason:'MAX_TOKENS'}),es=await events(f);assert.equal(es.at(-1).kind,'safe_error');assert.equal(completions(f).length,0);assert.equal(failures(f).length,1);
});

for(const options of [{provider:async()=>{throw Error('SYNTHETIC_NETWORK');}},{completionError:true}])
test('worker transport failure settles exactly once and never exposes an unconfirmed answer',async()=>{
 const f=fixture(options),es=await events(f);assert.equal(es.at(-1).kind,'safe_error');
 assert.equal(providers(f).length,1);assert.equal(failures(f).length,1);
 assert.equal(failures(f)[0].body.p_attempt_id,attemptId);assert.equal(failures(f)[0].abortedAtCall,false);
 assert.ok(!es.some(e=>e.kind==='text_delta'));
});
test('worker provider and metadata cleanup each have a bound even if transport ignores abort',async()=>{
 const timers=[];const f=fixture({setTimeout:(fn,ms)=>{timers.push(ms);return setTimeout(fn,ms===30000||ms===5000?5:ms);},
  provider:async()=>new Promise(()=>{}),fail:async()=>new Promise(()=>{})});
 const es=await events(f);assert.equal(es.at(-1).kind,'safe_error');assert.equal(failures(f).length,1);
 assert.ok(timers.includes(30000));assert.ok(timers.includes(5000));
});
test('worker disconnect still uses an independent cleanup signal',async()=>{
 const abort=new AbortController();
 const f=fixture({signal:abort.signal,provider:async()=>{abort.abort();throw Error('SYNTHETIC_DISCONNECT');}});
 const response=await f.invoke();
 // A caller disconnect has no final stream, but awaited cleanup still runs.
 for(let i=0;i<30&&!failures(f).length;i++)await new Promise(r=>setImmediate(r));
 assert.equal(failures(f).length,1);assert.equal(failures(f)[0].abortedAtCall,false);
 await response.body.cancel();
});
test('wrong final owner/attempt receipt never becomes accepted UI card',async()=>{
 const f=fixture({receipt:{...turn(),attemptId:id(99)}}),es=await events(f);assert.equal(es.at(-1).kind,'safe_error');assert.ok(!es.some(e=>e.kind==='final'));
});
test('extra input commands and oversized body fail before Auth/SQL/provider',async()=>{
 const f=fixture();assert.equal((await f.invoke({publish:true})).status,400);assert.equal(f.calls.length,0);
 assert.equal((await f.invoke({text:'x'.repeat(21000)})).status,400);assert.equal(f.calls.length,0);
});

test('canonical cancellation receipt before provider I/O prevents charge and completion',async()=>{
 const f=fixture({dispatch:{dispatched:false,turn:turn('FAILED')}}),r=await f.invoke();
 assert.equal(r.status,200);assert.deepEqual(await r.json(),turn('FAILED'));assert.equal(providers(f).length,0);assert.equal(completions(f).length,0);
 assert.equal(f.calls.filter(c=>c.url.includes('budget')).length,1); // conservative reservation is never refunded
});
test('lost dispatch acknowledgement attempts bounded metadata settlement and cannot call provider',async()=>{
 const f=fixture({dispatchError:true});assert.equal((await f.invoke()).status,409);assert.equal(providers(f).length,0);assert.equal(failures(f).length,1);
});
for(const dispatch of [{dispatched:true,turn:{...turn('PROCESSING'),attemptId:id(99)}},{dispatched:true,turn:turn('FAILED')},
 {dispatched:true,turn:{...turn('PROCESSING'),retryAllowed:true}},{dispatched:true,turn:turn('PROCESSING'),hidden:true}])
 test('malformed or foreign dispatch proof cannot authorize provider I/O',async()=>{
  const f=fixture({dispatch});assert.equal((await f.invoke()).status,409);assert.equal(providers(f).length,0);assert.equal(failures(f).length,1);
 });
