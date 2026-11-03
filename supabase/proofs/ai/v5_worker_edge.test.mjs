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
  if(url.endsWith('/rpc_complete_worker_ai_turn_with_first_plan_service'))return json({completion:turn(),firstPlan:{state:'RESOLVED',authority:'CATALOG_ONLY',applicability:'NOT_EVALUATED'}});
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
const completions=f=>f.calls.filter(c=>/\/rpc_complete_worker_ai_turn(?:_with_first_plan)?_service$/.test(c.url));
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
test('compact worker instructions retain one question, independent areas and user Save authority',async()=>{
 const f=fixture();await events(f);
 const rule=providers(f)[0].body.systemInstruction.parts.map(p=>p.text).join('\n');
 for(const pattern of [/najviše JEDNO pitanje/,/ONE person actually offers/,/Novi Sad i Beograd = two CITY areas/,
  /Objavi\/Sačuvaj je korisnička potvrda/,/availabilityChange/,/Kategorije\/ID-jevi\/grane idu samo AI→server/])assert.match(rule,pattern);
 assert.ok(rule.length<12000,`worker instruction grew to ${rule.length} characters`);
});

// Current single-response classifications and atomic completion. The retired
// second-provider scheduling is covered by explicit no-second-call assertions.
const singleEnv={SUPABASE_URL:'https://leqcwgzvjsxugfgzdmth.supabase.co',USKOCI_TAXONOMY_DUAL_GEMINI:'true',
 USKOCI_TAXONOMY_ROLLOUT_SCOPE:'DEV',USKOCI_TAXONOMY_ALLOWED_PROJECT_REF:'leqcwgzvjsxugfgzdmth'};
const proposed=(service,mode,categoryId)=>({service,mode,categoryId,action:'REUSE_EXISTING',parentId:'',proposedPath:[],ambiguityPrompt:'',reason:'Smisao usluge odgovara potvrđenom poslu.'});
const plans=f=>f.calls.filter(c=>c.url.endsWith('/rpc_complete_worker_ai_turn_with_first_plan_service')).flatMap(c=>c.body.p_taxonomy_plan.proposals);
function modeFixture(options={}){
 const service='Izrada maketa',categoryId=id(20),quote=options.quote??'Od sada makete radim samo na daljinu.';
 const modeContext={schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:2,
  savedServices:[{service,categoryId,mode:'ON_SITE'}],draftServices:[],unresolvedServices:[],...options.modeContext};
 const decisions=options.decisions??[proposed(service,'REMOTE',categoryId)];
 const f=fixture({env:singleEnv,context:{schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:false,safety:'ALLOW',revision:2,
  profileStatus:'ACTIVE',serviceModeContext:modeContext,candidate:{skills:[service],bio:'Opis',availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},
  messages:options.messages??[{role:'USER',body:quote},{role:'ASSISTANT',body:'ASSISTANT_ONLY_SCOPE_QUOTE'}]},
  snapshot:{catalogVersion:7,catalogFingerprint:'a'.repeat(32),count:1,categories:[{categoryId,parentId:null,label:service,aliases:[],path:[service],isLeaf:true,modes:options.catalogModes??['REMOTE','ON_SITE']}]},
  output:{assistantMessage:'Predlog izmene je u nacrtu.',safety:options.safety??'ALLOW',patch:options.patch??{bio:'Dopunjen opis'},taxonomyDecisions:decisions,
   ...(options.noChanges?{}:{serviceModeChangesJson:JSON.stringify([{service,modes:options.modes??['REMOTE'],evidence:options.evidence??quote,handoff:options.handoff??{required:false}}])})}});
 return {...f,modeContext,quote};
}
test('mode-only correction keeps ID in one atomic completion without a skills edit',async()=>{
 const f=modeFixture(),es=await events(f,{text:f.quote});assert.equal(es.at(-1).kind,'final');
 assert.equal(providers(f).length,1);assert.deepEqual(plans(f).map(p=>[p.categoryId,p.mode,p.handoff]),[[id(20),'REMOTE',{required:false}]]);
 assert.deepEqual(completions(f)[0].body.p_output.patch,{bio:'Dopunjen opis'});
 assert.ok(!f.calls.some(c=>/capture_gemini|rpc_save_worker|set_worker_execution|:generateContent/.test(c.url)));
 assert.ok(!JSON.stringify(es).includes(id(20)));
});
test('handoff-only correction retains REMOTE and exact ID without a second provider',async()=>{
 const handoff={required:true,shippingCountries:['RS']};
 const f=modeFixture({quote:'Od sada šaljem makete poštom samo u Srbiji.',handoff,
  modeContext:{savedServices:[{service:'Izrada maketa',categoryId:id(20),mode:'REMOTE',handoff:{required:true,localExchange:{countryCode:'RS',city:'Novi Sad'}}}]}});
 await events(f,{text:f.quote});assert.equal(providers(f).length,1);assert.deepEqual(plans(f).map(p=>p.handoff),[handoff]);
});
test('bio-only correction carries the owned category into the new revision without another model decision',async()=>{
 const f=modeFixture({quote:'Dopunite samo moj opis.',noChanges:true,decisions:[]});
 assert.equal((await events(f,{text:f.quote})).at(-1).kind,'final');
 assert.equal(providers(f).length,1);assert.deepEqual(plans(f).map(p=>[p.categoryId,p.mode]),[[id(20),'ON_SITE']]);
 assert.deepEqual(completions(f)[0].body.p_output.patch,{bio:'Dopunjen opis'});
});
for(const evidence of ['PRIVATE_INVENTED_SCOPE','ASSISTANT_ONLY_SCOPE_QUOTE'])test('unowned scope evidence cannot authorize any mode: '+evidence,async()=>{
 const f=modeFixture({evidence});assert.equal((await events(f,{text:f.quote})).at(-1).kind,'final');
 assert.equal(providers(f).length,1);assert.deepEqual(plans(f),[]);
});
for(const safety of ['REVIEW','BLOCK'])test('safety refusal cannot admit a taxonomy plan: '+safety,async()=>{
 const f=modeFixture({safety});await events(f,{text:f.quote});assert.equal(providers(f).length,1);assert.deepEqual(plans(f),[]);
});
for(const mutation of ['stale','unknown_mode'])test('invalid authoritative mode context stops before budget/provider: '+mutation,async()=>{
 const f=modeFixture();if(mutation==='stale')f.modeContext.revision=1;else f.modeContext.savedServices[0].mode='UNKNOWN';
 assert.equal((await f.invoke({text:f.quote})).status,503);assert.equal(providers(f).length,0);assert.equal(completions(f).length,0);
 assert.ok(!f.calls.some(c=>c.url.includes('budget_reserve')));
});
for(const decisions of [[],[proposed('Izrada maketa','REMOTE',id(99))]])test('missing or invalid classification keeps useful facts without a second provider: '+JSON.stringify(decisions),async()=>{
 const f=modeFixture({decisions});assert.equal((await events(f,{text:f.quote})).at(-1).kind,'final');assert.equal(providers(f).length,1);
 assert.deepEqual(plans(f),[]);assert.deepEqual(completions(f)[0].body.p_output.patch,{bio:'Dopunjen opis'});
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
 assert.deepEqual(Object.keys(loaded.sourceHashes).sort(),['src/contracts/workerAreas.ts','supabase/functions/_shared/completeFirstPlan.ts','supabase/functions/_shared/singlePassTaxonomy.mjs','supabase/functions/_shared/interviewVoiceInstruction.mjs','supabase/functions/_shared/aiPhaseTiming.mjs','src/contracts/aiAvailability.ts','supabase/functions/_shared/aiTestBudget.ts',
  'supabase/functions/_shared/geminiTaskStream.ts','supabase/functions/uskoci-worker-interview/index.ts',
  'supabase/functions/_shared/classificationEngine.mjs',
  'supabase/functions/_shared/workerServiceModeContext.mjs',
  'supabase/functions/_shared/serviceHandoff.mjs','supabase/functions/_shared/serviceExecutionInstruction.mjs',
  'supabase/functions/_shared/researchDeadline.ts',
  'supabase/functions/_shared/workerAreaAdmission.mjs','supabase/functions/_shared/workerAreaResolver.mjs',
  'supabase/functions/_shared/backgroundTaxonomyArchitect.mjs',
  'supabase/functions/_shared/taxonomyRuntimeConfig.mjs'].sort());
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
test('unsupported area asks one question while partial calendar intent remains in owned history',async()=>{
 const input='Radim molerske radove po celoj Vojvodini i u Beogradu, radnim danima posle 16. Alat ne bih posebno unosio.';
 const reply='Regionalna pokrivenost još nije podešena. Koji grad i krug oko njega da koristimo za predloge? Do koliko sati radnim danima?';
 const context={schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:false,safety:'ALLOW',revision:0,
  candidate:{skills:[],availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},messages:[{role:'USER',body:input}]};
 const logs=[],f=fixture({context,log:args=>logs.push(args),availabilityChange:{kind:'CLARIFY',evidence:'radnim danima posle 16'},
  output:{assistantMessage:reply,safety:'ALLOW',patch:{skills:['Molerski radovi'],bio:'Molerski radovi.',availability}}});
 const es=await events(f,{text:input});assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);
 const accepted=completions(f)[0].body.p_output;
 assert.match(accepted.assistantMessage,/širu oblast/);assert.match(accepted.assistantMessage,/Koji grad želite za sada\?/);assert.equal((accepted.assistantMessage.match(/\?/g)??[]).length,1);assert.ok(context.messages[0].body.includes('radnim danima posle 16'));
 assert.equal(accepted.safety,'CLARIFY');
 assert.deepEqual(accepted.patch,{skills:['Molerski radovi'],bio:'Molerski radovi.'});
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),accepted.assistantMessage);
 assert.ok(!logs.some(args=>args[0]==='WORKER_AVAILABILITY_GUARD'));
 const prompt=providers(f)[0].body.systemInstruction.parts.map(p=>p.text).join('\n');
 assert.ok(prompt.includes('Retain partial days/times and ask only what is missing'));
 assert.ok(prompt.includes('Unsupported region/cross-border scope: explain and ask Serbian cities/all Serbia'));
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

// Shadow JSON/tool-pagination capture tests have moved to the current
// single_pass_edge / single_pass_continuity suites. They exercise whole-catalog
// IDs, unregistered natural labels, BOTH, partial decisions and no second model.

test('completed/unknown claim replay cannot reserve or call the provider again',async()=>{
 const f=fixture({replay:true});assert.deepEqual(await(await f.invoke()).json(),turn());assert.equal(providers(f).length,0);assert.equal(f.calls.length,2);
});
test('REMOTE-only prompt keeps location optional and server-reviewed Save authoritative',async()=>{
 const f=fixture();await events(f);const rule=providers(f)[0].body.systemInstruction.parts.map(p=>p.text).join('\n');
 for(const pattern of [/REMOTE-only needs no city/,/No home city\/address\/GPS interview/,/Country is not inferred from language/,
  /Objavi\/Sačuvaj je korisnička potvrda/,/Ne tvrdite da je već objavljeno, sačuvano, aktivirano/])assert.match(rule,pattern);
});

test('contextual worker clarification survives completion and stream without invented profile changes',async()=>{
 const output={assistantMessage:'Izvini, nije mi sasvim jasno na šta misliš. Možeš li to da kažeš drugim rečima?',safety:'CLARIFY',patch:{}};
 const f=fixture({output}),es=await events(f,{text:'SYNTHETIC_UNCLEAR_TEXT'});
 assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);assert.equal(completions(f).length,1);
 assert.deepEqual(completions(f)[0].body.p_output,output);
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),output.assistantMessage);
 const prompt=providers(f)[0].body.systemInstruction.parts.map(p=>p.text).join('\n');
 for(const pattern of [/Vi\/Vam\/Vas/,/najviše jedan diskretan emoji/,/Bez pretpostavljenog roda, ljudskog identiteta\/iskustva/,
  /CLARIFY nejasno/,/Izmene su NACRT/,/Objavi\/Sačuvaj je korisnička potvrda/,/Ne tvrdite da je već objavljeno/])assert.match(prompt,pattern);
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
 assert.ok(prompt.includes('ONE person'));assert.ok(prompt.includes('bio is an optional introduction/limits, never a matching filter'));
 assert.ok(!JSON.stringify(provider.systemInstruction.parts.slice(0,2)).includes('"tools":["Kolica"]'));
 assert.equal(provider.systemInstruction.parts.filter(p=>p.text.includes('Owned candidate')).length,1);
});

// Saved/draft continuity, revoked scope, conflicting IDs and removal run in
// single_pass_continuity.test.mjs using the current owned-context contract.

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
 for(const pattern of [/skills is the COMPLETE offered list/,/preserve unremoved services/,/Resolve each offered service independently/,
  /Do not ask for equipment/,/Equipment is read-only\/private/,/English knowledge\/van ownership do not imply translation\/transport/])assert.match(prompt,pattern);
});

for(const input of ['To je to.','Sačuvaj','Сачувај','Gotovo, to je sve!','Hvala, to je to.','To je sve, hvala Vam!','Хвала, то је све.','То је то, хвала!'])
 test('finish does not invent edits or force an unready review: '+input,async()=>{
  const output={assistantMessage:'Da li su tvoje radno vreme i dostupnost tačni?',safety:'ALLOW',patch:{tools:['Izmišljeni alat']}};
  const f=fixture({output}),es=await events(f,{text:input});
  assert.equal(es.at(-1).kind,'final');
  const applied=completions(f)[0].body.p_output;
  assert.deepEqual(applied.patch,{},'finish is not authorization for invented profile changes');
  assert.equal(applied.assistantMessage,output.assistantMessage);
  assert.ok(!Object.hasOwn(applied.patch,'bio'),'finish must not silently invent a biography');
  assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),applied.assistantMessage);
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
 assert.ok(prompt.includes('Do not present old equipment as review/matching evidence'));
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

for(const safety of ['REVIEW','BLOCK'])test(`${safety} never acknowledges a discarded profile patch as applied`,async()=>{
 const output={assistantMessage:'Dodao sam lekturu u nacrt. Možete pregledati profil.',safety,
  patch:{skills:['Lektura'],bio:'Radim lekturu onlajn.'}};
 const f=fixture({output}),es=await events(f);
 const accepted=completions(f)[0].body.p_output;
 assert.equal(accepted.safety,safety);
 assert.deepEqual(accepted.patch,{});
 assert.match(accepted.assistantMessage,/Nacrt nije promenjen/);
 assert.ok(!accepted.assistantMessage.includes('Dodao sam'));
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),accepted.assistantMessage);
 assert.equal(providers(f).length,1);
});

test('ordinary profile preview remains ALLOW and provider distinguishes it from safety REVIEW',async()=>{
 const output={assistantMessage:'Možete pregledati nacrt profila.',safety:'ALLOW',patch:{skills:['Lektura']}};
 const f=fixture({output});await events(f);
 assert.deepEqual(completions(f)[0].body.p_output,output);
 const request=providers(f)[0].body;
 assert.match(request.systemInstruction.parts.map(p=>p.text).join(' '),/REVIEW konkretan nerešen bezbednosni\/pravni rizik/);
 assert.match(request.generationConfig.responseSchema.properties.safety.description,/never profile preview/);
});

for(const safety of ['REVIEW','BLOCK'])test(`${safety} does not admit equipment or biography from a rejected equipment turn`,async()=>{
 const output={assistantMessage:safety==='REVIEW'?'Potreban je pregled.':'Ne mogu da pomognem sa tim zahtevom.',safety,
  patch:{bio:'Imam novi kombi.',tools:['Bušilica'],vehicles:['Kombi']}};
 const f=fixture({output}),es=await events(f);
 assert.equal(es.at(-1).kind,'final');
 const accepted=completions(f)[0].body.p_output;
 assert.equal(accepted.safety,safety);assert.match(accepted.assistantMessage,/Nacrt nije promenjen/);
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
