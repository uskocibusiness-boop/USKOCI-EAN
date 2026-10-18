// Exact source, explicitly synthetic I/O. No live provider or database proof.
import test from 'node:test';import assert from 'node:assert/strict';
import {loadWorkerRecoveryHandler} from './worker_recovery_edge_runtime.mjs';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const account=id(1),conversation=id(2),key=id(3),turnId=id(4),attemptId=id(5);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const turn=(state='SUCCEEDED')=>({turnId,conversationId:conversation,clientRequestId:key,attemptId,state,retryAllowed:false,authoritative:true});
function fixture(options={}){
 let handler;const calls=[],env={SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'PUBLIC_SYNTHETIC',SUPABASE_SERVICE_ROLE_KEY:'SERVICE_SYNTHETIC',
  AI_PROVIDER:'gemini',GEMINI_MODEL:'gemini-3.8-flash',GEMINI_API_KEY:'PROVIDER_SYNTHETIC',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',...options.env};
 const output=options.output??{assistantMessage:'Profil je spreman za zajednički pregled 🟢.',safety:'ALLOW',patch:{skills:['Prenos stvari'],tools:['Kolica']}};
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
  if(url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'))return json({action:'HINT_CAPTURED',authority:'NONE'});
  if(url.endsWith('/rpc_ai_test_record_usage_service'))return json({recorded:true});
  if(url.endsWith('/rpc_fail_worker_ai_turn_service'))return options.fail?.(init)??json(turn('FAILED'));
  if(url.startsWith('https://generativelanguage.googleapis.com/')){
   if(options.provider) return options.provider(init);
   const raw=JSON.stringify(output),fragments=Array.from(raw);
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
test('recovery proof loader binds the current seven-file worker bundle without network',async()=>{
 const loaded=loadWorkerRecoveryHandler({fetch:()=>assert.fail('NETWORK_NOT_ALLOWED'),env:()=>''});
 assert.deepEqual(Object.keys(loaded.sourceHashes).sort(),['src/contracts/aiAvailability.ts','supabase/functions/_shared/aiTestBudget.ts',
  'supabase/functions/_shared/geminiTaskStream.ts','supabase/functions/uskoci-worker-interview/index.ts',
  'supabase/functions/_shared/classificationEngine.mjs','supabase/functions/_shared/classificationGeminiShadow.mjs',
  'supabase/functions/_shared/workerServiceModeContext.mjs'].sort());
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
 assert.ok(!f.calls.some(c=>c.url.endsWith('/rpc_taxonomy_ai_catalog_context_service')));
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
test('contextual worker clarification survives completion and stream without invented profile changes',async()=>{
 const output={assistantMessage:'Izvini, nije mi sasvim jasno na šta misliš. Možeš li to da kažeš drugim rečima?',safety:'CLARIFY',patch:{}};
 const f=fixture({output}),es=await events(f,{text:'SYNTHETIC_UNCLEAR_TEXT'});
 assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);assert.equal(completions(f).length,1);
 assert.deepEqual(completions(f)[0].body.p_output,output);
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),output.assistantMessage);
 const prompt=providers(f)[0].body.systemInstruction.parts[0].text;
 assert.ok(prompt.includes('warm, natural and attentive'));
 assert.ok(prompt.includes('safety CLARIFY with an empty patch'));
 assert.ok(prompt.includes('You receive text only, not sound'));
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
 const provider=providers(f)[0].body,prompt=provider.systemInstruction.parts[0].text;
 assert.ok(!prompt.includes('PRIVATE_LEGACY_LICENSE'));assert.ok(!prompt.includes('"teamCapacity"'));
 assert.ok(prompt.includes('"tools":["Kolica"]'));assert.ok(prompt.includes('"vehicles":["Kombi"]'));
 const fields=provider.generationConfig.responseSchema.properties.patch.properties;
 assert.ok(!Object.hasOwn(fields,'licenses'));assert.ok(!Object.hasOwn(fields,'teamCapacity'));
 assert.ok(!Object.hasOwn(fields,'excludedWork'));assert.ok(!Object.hasOwn(fields,'urgentNotifications'));
 assert.equal(candidate.teamCapacity,37);assert.deepEqual(candidate.licenses,['PRIVATE_LEGACY_LICENSE']);
 assert.ok(prompt.includes('ONE person'));assert.ok(prompt.includes('no separate exclusion or urgent-notification preference field'));
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
   catalogFingerprint:'a'.repeat(32),items:options.retired||options.catalogModes&&!options.catalogModes.includes(body.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE')?[]:[{categoryId:category,parentId:null,label:service,aliases:['Modeli po meri'],path:[service],isLeaf:true}],
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
 const prompt=providers(f)[0].body.systemInstruction.parts[0].text;
 assert.ok(prompt.includes('skills, tools and vehicles are COMPLETE replacement lists, not additions'));
 assert.ok(prompt.includes('keep every existing offered service the person has not explicitly removed'));
 assert.ok(prompt.includes('Changing the delivery mode of one service does not change other services'));
 assert.ok(prompt.includes('Tools and vehicles are optional information, never mandatory for review or activation'));
 assert.ok(prompt.includes('classificationShadowJson is only a proposal'));
 assert.ok(prompt.includes('signed profile review'));
 assert.ok(!prompt.includes('pending a future confirmed structured capability review'));
 assert.ok(prompt.includes("'Znam engleski' is general knowledge, NOT consent to tutoring or translating"));
 assert.ok(prompt.includes("'Imam kombi' is equipment, NOT consent to transport or removals"));
});

for(const input of ['To je to.','Sačuvaj','Сачувај','Gotovo, to je sve!'])
 test('finish request hands off to profile review without another availability question: '+input,async()=>{
  const output={assistantMessage:'Da li su tvoje radno vreme i dostupnost tačni?',safety:'ALLOW',patch:{tools:['Izmišljeni alat']}};
  const f=fixture({output}),es=await events(f,{text:input});
  assert.equal(es.at(-1).kind,'final');
  const applied=completions(f)[0].body.p_output;
  assert.deepEqual(applied.patch,{},'finish is not authorization for invented profile changes');
  assert.equal(applied.assistantMessage,'Otvori pregled profila. Tamo možeš da dopuniš podatke i potvrdiš čuvanje.');
  assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),applied.assistantMessage);
  assert.ok(!es.some(e=>e.text?.includes('dostupnost')));
  assert.equal(providers(f).length,1,'no second paid model call to rewrite a reply');
 });

test('finish handling does not swallow a correction or override a safety refusal',async()=>{
 for(const input of ['Nemoj još da sačuvaš.','Sačuvaj, ali dodaj da imam kolica.']){
  const f=fixture(),es=await events(f,{text:input});assert.equal(es.at(-1).kind,'final');
  assert.deepEqual(completions(f)[0].body.p_output,f.output);
 }
 const f=fixture({output:{assistantMessage:'Ne mogu da pomognem sa tim zahtevom.',safety:'BLOCK',patch:{}}});
 await events(f,{text:'Sačuvaj'});assert.equal(completions(f)[0].body.p_output.safety,'BLOCK');
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
