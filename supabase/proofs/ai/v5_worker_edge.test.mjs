// Exact source, explicitly synthetic I/O. No live provider or database proof.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import vm from 'node:vm';import ts from 'typescript';
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
  if(url.endsWith('/rpc_read_worker_ai_context_service'))return json(options.context??{schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:false,safety:'ALLOW',candidate:{skills:[],availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},messages:[{role:'USER',body:'SYNTHETIC_USER_MESSAGE'}]});
  if(url.endsWith('/rpc_ai_test_budget_reserve_service'))return json(options.budget??{admitted:true,reservationId:id(8),replay:false,code:'AI_TEST_RESERVED'});
  // Explicit synthetic141 dispatch authorization. This unit transport does not
  // stand in for the separate actual Auth/Postgres race proof.
  if(url.endsWith('/rpc_dispatch_worker_ai_turn_service')){
   if(options.dispatchError)throw new Error('SYNTHETIC_DISPATCH_ACK_LOST');
   return json(options.dispatch??{dispatched:true,turn:turn('PROCESSING')});
  }
  if(url.endsWith('/rpc_complete_worker_ai_turn_service')){if(options.completionError)throw Error('SYNTHETIC_ACK_LOST');return json(options.receipt??turn());}
  if(url.endsWith('/rpc_fail_worker_ai_turn_service'))return options.fail?.(init)??json(turn('FAILED'));
  if(url.startsWith('https://generativelanguage.googleapis.com/')){
   if(options.provider) return options.provider(init);
   const raw=JSON.stringify(output),fragments=Array.from(raw);
   const body=fragments.map((text,index)=>'data: '+JSON.stringify({candidates:[{content:{parts:[{text}]},...(index===fragments.length-1?{finishReason:options.finishReason??'STOP'}:{})}]})+'\n\n').join('');
   const bytes=new TextEncoder().encode(body);return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=7)c.enqueue(bytes.slice(i,i+7));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});
  }
  assert.fail('UNEXPECTED_NETWORK_OR_CANONICAL_WRITER');
 };
 const context=vm.createContext({Request,Response,Headers,URL,TextEncoder,TextDecoder,ReadableStream,AbortController,Date,Intl,setTimeout:options.setTimeout??setTimeout,clearTimeout,fetch,
   Deno:{env:{get:name=>env[name]},serve:fn=>{handler=fn;}}});
 const evaluate=(file,imports={})=>{
  const source=readFileSync(resolve(file),'utf8'),compiled=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.equal(compiled.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
  return new vm.Script(`(function(exports,require){${compiled.outputText}\nreturn exports;})`,{filename:file}).runInContext(context)({},name=>{
   assert.ok(Object.hasOwn(imports,name),'UNDECLARED_IMPORT');return imports[name];});
 };
 const availability=evaluate('src/contracts/aiAvailability.ts');
 const budget=evaluate('supabase/functions/_shared/aiTestBudget.ts'),stream=evaluate('supabase/functions/_shared/geminiTaskStream.ts',
  {'../../../src/contracts/aiAvailability.ts':availability});
 evaluate('supabase/functions/uskoci-worker-interview/index.ts',{'../_shared/aiTestBudget.ts':budget,'../_shared/geminiTaskStream.ts':stream,
  '../../../src/contracts/aiAvailability.ts':availability});
 return {calls,output,invoke:(patch={})=>handler(new Request('https://edge.invalid',{method:'POST',signal:options.signal,headers:{Authorization:'Bearer SYNTHETIC',Accept:'text/event-stream','Content-Type':'application/json',...options.headers},
  body:JSON.stringify({conversationId:conversation,clientRequestId:key,text:'SYNTHETIC_USER_MESSAGE',...patch})}))};
}
const providers=f=>f.calls.filter(c=>c.url.startsWith('https://generativelanguage.googleapis.com/'));
const completions=f=>f.calls.filter(c=>c.url.endsWith('/rpc_complete_worker_ai_turn_service'));
const failures=f=>f.calls.filter(c=>c.url.endsWith('/rpc_fail_worker_ai_turn_service'));
async function events(f,patch={}){const r=await f.invoke(patch);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/event-stream/);
 return (await r.text()).trim().split('\n\n').map(e=>JSON.parse(e.slice(6)));}
test('recovery proof loader binds the current four-file worker bundle without network',async()=>{
 const loaded=loadWorkerRecoveryHandler({fetch:()=>assert.fail('NETWORK_NOT_ALLOWED'),env:()=>''});
 assert.deepEqual(Object.keys(loaded.sourceHashes).sort(),['src/contracts/aiAvailability.ts','supabase/functions/_shared/aiTestBudget.ts',
  'supabase/functions/_shared/geminiTaskStream.ts','supabase/functions/uskoci-worker-interview/index.ts'].sort());
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
