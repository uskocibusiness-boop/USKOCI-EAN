'use strict';
// Executes the actual Worker Edge handler and shared recovery/provider modules.
// Only HTTP is synthetic; no account, database, paid model or device is touched.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const ROOT=path.resolve(__dirname,'..');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=id(1),C=id(2),R=id(3),T=id(4),ATT=id(5),RES=id(6);
const TEXT='Kako mogu da promenim radni profil?';
const clone=value=>JSON.parse(JSON.stringify(value));
const turn=(state='PROCESSING')=>({turnId:T,conversationId:C,clientRequestId:R,attemptId:ATT,state,retryAllowed:false,authoritative:true});
function loadHandler(fetchMock,env){
  const modules=new Map();let handler;
  function load(file){
    file=['','.ts','.tsx','.js','.mjs'].map(ext=>path.resolve(ROOT,file+ext)).find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
    assert.ok(file,'Actual source exists');if(modules.has(file))return modules.get(file).exports;
    const source=fs.readFileSync(file,'utf8');
    const output=ts.transpileModule(source,{fileName:file.endsWith('.mjs')?file+'.ts':file,reportDiagnostics:true,
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
    assert.deepEqual((output.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[]);
    const mod={exports:{}};modules.set(file,mod);
    const requireLocal=name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name)):require(name);
    new Function('require','module','exports','Deno','fetch','console',output.outputText)(requireLocal,mod,mod.exports,
      {env:{get:name=>env[name]},serve:value=>{handler=value;}},fetchMock,{info(){},warn(){},error(){},log(){}});
    return mod.exports;
  }
  load('supabase/functions/uskoci-worker-interview/index.ts');assert.equal(typeof handler,'function');return handler;
}
function server(options={}){
  const calls=[],bodies=[];
  const context={schemaVersion:'WORKER_PROFILE_V1',accountId:A,conversationId:C,status:'OPEN',stale:false,safety:'ALLOW',
    profileStatus:'DRAFT',revision:1,candidate:{displayName:'Synthetic owner',bio:'',skills:[],
      location:{operatingCountryCode:'RS',city:'',radiusKm:0},availability:{timezone:'Europe/Belgrade',availableNow:false,rules:[],windows:[]},
      tools:[],vehicles:[],licenses:[],teamCapacity:1,workAreas:[]},messages:[{id:id(7),role:'USER',body:TEXT}],
    serviceModeContext:{schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:1,savedServices:[],draftServices:[],unresolvedServices:[]}};
  const state={claimed:false,dispatched:false,completed:false,prepared:null,context,reservations:0,options};
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  const preparedJson=data=>{
    const raw=JSON.stringify(data);
    // JSON whitespace represents envelope/serialization overhead. The saved
    // input stays within its separate SQL/helper limits; transport is bounded.
    return new Response(raw+' '.repeat(Math.max(0,(options.preparedEnvelopeBytes??0)-Buffer.byteLength(raw))),
      {headers:{'content-type':'application/json'}});
  };
  const preparedRead=()=>state.prepared?{state:'PREPARED',inputSha256:'a'.repeat(64),snapshot:clone(state.prepared)}:{state:'ABSENT'};
  const fetchMock=async(url,init={})=>{
    const parsed=new URL(String(url)),name=parsed.pathname.split('/').at(-1),args=init.body?JSON.parse(init.body):null;
    calls.push({name,args});
    if(parsed.pathname==='/auth/v1/user')return json({id:A});
    if(parsed.hostname==='generativelanguage.googleapis.com'){
      assert.equal(state.dispatched,true,'Provider requires prior database dispatch acknowledgement');
      bodies.push(clone(args));
      if(options.providerUnknown)throw new Error('SYNTHETIC_PROVIDER_UNKNOWN');
      const output=options.providerOutput??{assistantMessage:'Navedite šta želite da promenite.',safety:'ALLOW',patch:{availability:null},
        availabilityChange:{kind:'NONE',scope:'NONE',evidence:''},serviceChanges:[],conversationIntent:{kind:'QUESTION',evidence:TEXT},
        ...(options.singlePass?{serviceModeChangesJson:'[]',taxonomyDecisions:[]}: {})};
      return new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}],
        usageMetadata:{promptTokenCount:100,candidatesTokenCount:30,totalTokenCount:130}})+'\n\n',{headers:{'content-type':'text/event-stream'}});
    }
    if(name==='rpc_claim_worker_ai_turn_service'){
      assert.equal(args.p_account_id,A);assert.equal(args.p_conversation_id,C);assert.equal(args.p_client_request_id,R);
      if(args.p_text!==TEXT)return json({code:'WORKER_AI_REQUEST_CONFLICT'},409);
      const acquired=!state.claimed;state.claimed=true;
      return json({acquired,turn:turn(state.completed?'SUCCEEDED':options.unknownTurn?'UNKNOWN_OUTCOME':'PROCESSING')});
    }
    if(name==='rpc_read_worker_ai_context_service'){
      assert.notEqual(options.forbidContextReload,true,'Recovery must use the already authorized snapshot context');
      return json(state.context);
    }
    if(name==='rpc_taxonomy_fetch_snapshot_v1')return json({catalogVersion:1,catalogFingerprint:'b'.repeat(32),count:1,
      categories:[{categoryId:id(20),label:'Lektura teksta',parentId:null,isLeaf:true,aliases:[],modes:['REMOTE']}]});
    if(name==='rpc_ai_read_prepared_input_service'){
      if(options.readUnavailable)return json({code:'RPC_UNAVAILABLE'},503);
      if(options.readState)return json({state:options.readState});
      if(state.dispatched)return json({state:'READ_ONLY'});
      return preparedJson(preparedRead());
    }
    if(name==='rpc_ai_prepare_input_service'){
      assert.equal(args.p_purpose,'WORKER_CAPABILITY');assert.equal(args.p_attempt_id,ATT);
      if(options.prepareRefused)return json({code:'R06_INPUT_BUDGET_NOT_ADMITTED'},400);
      assert.deepEqual(args.p_input.runtime.sourceContext,state.context);
      assert.equal(Object.hasOwn(args.p_input.providerRequest,'cachedContent'),false);
      assert.equal(state.prepared,null,'No second prepare or reservation for the same command');state.reservations++;
      state.prepared={schemaVersion:'R06_PREPARED_TEXT_V1',purpose:'WORKER_CAPABILITY',accountId:A,conversationId:C,clientRequestId:R,
        turnId:T,attemptId:ATT,sourceIdentity:'c'.repeat(64),sourceContext:clone(state.context),input:clone(args.p_input),reservationId:RES,
        instructionSha256:'d'.repeat(64),schemaSha256:'e'.repeat(64),catalogSha256:'f'.repeat(64)};
      options.abortAfterPrepare?.();
      if(options.prepareUnknown)throw new Error('SYNTHETIC_PREPARE_ACK_LOST');
      return json({state:'PREPARED',replay:false,inputSha256:'a'.repeat(64)});
    }
    if(name==='rpc_ai_dispatch_prepared_input_service'){
      assert.ok(state.prepared);assert.equal(args.p_attempt_id,ATT);assert.equal(args.p_input_sha256,'a'.repeat(64));
      if(options.stopBeforeDispatch)return json({code:'FIXTURE_PROCESS_INTERRUPTED'},503);
      if(options.dispatchState)return json({state:options.dispatchState,dispatched:false});
      if(state.dispatched)return json({state:'READ_ONLY',dispatched:false});state.dispatched=true;
      if(options.dispatchUnknown)throw new Error('SYNTHETIC_DISPATCH_ACK_LOST');
      return preparedJson({state:'DISPATCHED',dispatched:true,inputSha256:'a'.repeat(64),snapshot:clone(state.prepared)});
    }
    if(name==='rpc_ai_test_budget_reserve_service'){
      state.reservations++;return json({admitted:true,replay:false,reservationId:RES,code:'AI_TEST_RESERVED'});
    }
    if(name==='rpc_dispatch_worker_ai_turn_service'){assert.equal(state.dispatched,false);state.dispatched=true;return json({dispatched:true,turn:turn()});}
    if(name==='rpc_complete_worker_ai_turn_service'){state.completed=true;return json(turn('SUCCEEDED'));}
    if(name==='rpc_ai_test_record_usage_service')return json({});
    if(name==='rpc_fail_worker_ai_turn_service')return json(turn(state.dispatched?'UNKNOWN_OUTCOME':'FAILED'));
    throw new Error('Unexpected synthetic HTTP route '+name);
  };
  async function run(overrides={},requestText=TEXT,signal){
    // A new loader means a new Edge process with no prior module/RAM state.
    const env={SUPABASE_URL:'https://leqcwgzvjsxugfgzdmth.supabase.co',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'service-fixture',
      GEMINI_API_KEY:'provider-fixture',GEMINI_MODEL:'gemini-3.8-flash',AI_PROVIDER:'gemini',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',
      USKOCI_AI_PREPARED_INPUT_ENABLED:'true',USKOCI_TAXONOMY_DUAL_GEMINI:String(options.singlePass===true),
      USKOCI_TAXONOMY_ROLLOUT_SCOPE:'DEV',USKOCI_TAXONOMY_ALLOWED_PROJECT_REF:'leqcwgzvjsxugfgzdmth',...overrides};
    const response=await loadHandler(fetchMock,env)(new Request(env.SUPABASE_URL+'/functions/v1/uskoci-worker-interview',{
      method:'POST',signal,headers:{Authorization:'Bearer synthetic-token','Content-Type':'application/json'},
      body:JSON.stringify({conversationId:C,clientRequestId:R,text:requestText})}));
    const raw=await response.text(),events=response.headers.get('content-type').includes('text/event-stream')
      ? raw.split('\n\n').filter(Boolean).map(value=>JSON.parse(value.slice(6))):[];
    return {status:response.status,events,json:events.length?null:JSON.parse(raw)};
  }
  return {state,calls,bodies,run};
}
const count=(s,name)=>s.calls.filter(call=>call.name===name).length;

test('Worker actual handler: default-off preserves the existing guarded dispatch path',async()=>{
  const s=server();const result=await s.run({USKOCI_AI_PREPARED_INPUT_ENABLED:undefined});
  assert.equal(result.events.at(-1)?.kind,'final');assert.equal(s.bodies.length,1);
  assert.equal(count(s,'rpc_ai_test_budget_reserve_service'),1);assert.equal(count(s,'rpc_dispatch_worker_ai_turn_service'),1);
  assert.equal(count(s,'rpc_ai_prepare_input_service'),0);
});
test('Worker actual handler: fresh prepared request reserves and freezes before one provider dispatch',async()=>{
  const s=server();const result=await s.run();assert.equal(result.events.at(-1)?.kind,'final');
  assert.equal(s.state.reservations,1);assert.deepEqual(s.bodies,[s.state.prepared.input.providerRequest]);
  assert.equal(count(s,'rpc_ai_test_budget_reserve_service'),0);assert.equal(count(s,'rpc_dispatch_worker_ai_turn_service'),0);
  assert.deepEqual(s.calls.find(call=>call.name==='rpc_complete_worker_ai_turn_service').args.p_output.patch,{});
  const replay=await s.run();assert.equal(replay.json.state,'SUCCEEDED');assert.equal(s.bodies.length,1);
});
test('Worker actual handler: cold retry resumes exact input without another context/catalog/reservation',async()=>{
  const s=server({stopBeforeDispatch:true,singlePass:true});assert.equal((await s.run()).status,409);
  const frozen=clone(s.state.prepared);assert.ok(frozen);assert.equal(s.bodies.length,0);
  assert.equal(count(s,'rpc_fail_worker_ai_turn_service'),0);
  s.state.options.stopBeforeDispatch=false;s.state.options.forbidContextReload=true;
  const checkpoint=s.calls.length;
  const result=await s.run();assert.equal(result.events.at(-1)?.kind,'final');
  assert.deepEqual(s.bodies,[frozen.input.providerRequest]);assert.equal(s.state.reservations,1);
  assert.equal(s.calls.slice(checkpoint).some(call=>['rpc_read_worker_ai_context_service','rpc_taxonomy_fetch_snapshot_v1','rpc_ai_prepare_input_service'].includes(call.name)),false);
});
test('Worker actual handler: lost prepare ACK uses readback, never a second reservation',async()=>{
  const s=server({prepareUnknown:true});const result=await s.run();assert.equal(result.events.at(-1)?.kind,'final');
  assert.equal(s.bodies.length,1);assert.equal(s.state.reservations,1);assert.equal(count(s,'rpc_ai_prepare_input_service'),1);
});
test('Worker actual handler: unknown dispatch ACK cannot authorize provider or retire the prepared command',async()=>{
  const s=server({dispatchUnknown:true});assert.equal((await s.run()).status,409);assert.equal(s.state.dispatched,true);
  assert.equal(s.bodies.length,0);assert.equal(count(s,'rpc_fail_worker_ai_turn_service'),0);
  s.state.options.dispatchUnknown=false;await s.run();assert.equal(s.bodies.length,0);assert.equal(s.state.reservations,1);
});
test('Worker actual handler: provider unknown is never replayed on a fresh process',async()=>{
  const s=server({providerUnknown:true});assert.equal((await s.run()).events.at(-1)?.kind,'safe_error');
  assert.equal(s.bodies.length,1);s.state.options.providerUnknown=false;await s.run();
  assert.equal(s.bodies.length,1);assert.equal(s.state.reservations,1);
});
test('Worker actual handler: refusal, unavailable preparation and closed dispatch cannot bypass budget',async()=>{
  for(const options of [{prepareRefused:true},{readUnavailable:true},{dispatchState:'NOT_ADMITTED'},{dispatchState:'STALE'},
    {dispatchState:'CLOSED'},{dispatchState:'EXPIRED'},{dispatchState:'READ_ONLY'}]){
    const s=server(options);await s.run();assert.equal(s.bodies.length,0,JSON.stringify(options));
    assert.equal(count(s,'rpc_dispatch_worker_ai_turn_service'),0);assert.equal(count(s,'rpc_ai_test_budget_reserve_service'),0);
  }
});
test('Worker actual handler: same request with changed text and stale saved decoder do not call a model',async()=>{
  const s=server({stopBeforeDispatch:true});await s.run();s.state.options.stopBeforeDispatch=false;
  assert.equal((await s.run({},'Drugi tekst.')).status,409);assert.equal(s.bodies.length,0);
  s.state.prepared.input.runtime.schemaVersion='UNSUPPORTED_V99';assert.equal((await s.run()).status,409);
  assert.equal(s.bodies.length,0);assert.equal(count(s,'rpc_fail_worker_ai_turn_service'),0);
});
test('Worker actual handler: phone disconnect after prepare preserves its input for an owned retry',async()=>{
  const abort=new AbortController(),s=server({abortAfterPrepare:()=>abort.abort()});
  assert.equal((await s.run({},TEXT,abort.signal)).status,409);assert.ok(s.state.prepared);
  assert.equal(s.bodies.length,0);assert.equal(count(s,'rpc_fail_worker_ai_turn_service'),0);
  s.state.options.abortAfterPrepare=null;const recovered=await s.run();assert.equal(recovered.events.at(-1)?.kind,'final');
  assert.equal(s.state.reservations,1);assert.equal(s.bodies.length,1);
});
test('Worker actual handler: two fresh processes sharing a prepared command cannot both infer',async()=>{
  const s=server({stopBeforeDispatch:true});await s.run();s.state.options.stopBeforeDispatch=false;
  const results=await Promise.all([s.run(),s.run()]);
  assert.equal(results.filter(result=>result.events.at(-1)?.kind==='final').length,1);
  assert.equal(s.bodies.length,1);assert.equal(s.state.reservations,1);
  assert.equal(count(s,'rpc_complete_worker_ai_turn_service'),1);assert.equal(count(s,'rpc_fail_worker_ai_turn_service'),0);
});
test('Worker actual handler: invalid paid output preserves strict validation and usage accounting',async()=>{
  const s=server({providerOutput:{assistantMessage:'Bad synthetic output',safety:'ALLOW',patch:{availability:null,unknownAuthority:true},
    availabilityChange:{kind:'NONE',scope:'NONE',evidence:''},serviceChanges:[],conversationIntent:{kind:'CONTINUE',evidence:''}}});
  const result=await s.run();assert.equal(result.events.at(-1)?.kind,'safe_error');
  assert.equal(count(s,'rpc_complete_worker_ai_turn_service'),0);assert.equal(count(s,'rpc_ai_test_record_usage_service'),1);
  assert.equal(s.bodies.length,1);await s.run();assert.equal(s.bodies.length,1);
});
test('Worker actual handler: bounded prepared envelopes allow snapshot overhead but reject oversized transport',async()=>{
  const accepted=server({preparedEnvelopeBytes:524289});
  assert.equal((await accepted.run()).events.at(-1)?.kind,'final');assert.equal(accepted.bodies.length,1);
  const oversized=server({preparedEnvelopeBytes:1048577});
  assert.equal((await oversized.run()).status,409);assert.equal(oversized.bodies.length,0);
  assert.equal(count(oversized,'rpc_ai_prepare_input_service'),0);
});
