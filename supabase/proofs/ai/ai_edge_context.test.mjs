// Runs the actual Edge handler after TypeScript transpilation in an isolated VM.
// Every fetch/env value is synthetic. This is mocked transport, NOT provider proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {withDialogue,syntheticDialogue} from './dialogue_fixture.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const entry=resolve(root,'supabase/functions/uskoci-ai-interview/index.ts');
const registry=resolve(root,'src/contracts/needFactsV2.ts');
const conversation='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222';
const requestId='33333333-3333-4333-8333-333333333333',turnId='44444444-4444-4444-8444-444444444444',attemptId='55555555-5555-4555-8555-555555555555';
const turn=(state,receipt=null)=>({conversationId:conversation,clientRequestId:requestId,state,turnId,retryAllowed:state==='FAILED',receipt});
const userText='GENERIC_SYNTHETIC_INPUT_TWO_PEOPLE';
const providerResult={safety:'ALLOW',assistantMessage:'Pregledajte predloženi broj ljudi.',facts:[
  {key:'need.people_needed',valueJson:'2',displayValue:'2 osobe',evidence:userText,confidence:0.9},
]};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function fixture({now='2026-09-07T12:00:00.000Z',provider='gemini',failure,historyCount=50,schema='NEED_FACT_V2',activeFacts=[],providerOutput}={}){
  const calls=[],logs=[],env={AI_PROVIDER:provider,SUPABASE_URL:'https://database.test.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_PUBLIC_KEY',
    SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE_KEY',GEMINI_API_KEY:provider==='gemini'?'SYNTHETIC_GEMINI_KEY':'',
    GEMINI_MODEL:provider==='gemini'?'gemini-3.8-flash':'',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',
    OPENAI_API_KEY:'SYNTHETIC_OPENAI_KEY',OPENAI_MODEL:'synthetic-openai-model'};
  let handler;
  class FixedDate extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return Date.parse(now);}}
  const fakeFetch=async(input,options={})=>{
    const url=String(input),headers=Object.fromEntries(new Headers(options.headers).entries());
    const body=options.body?JSON.parse(options.body):null;calls.push({url,method:options.method??'GET',headers,body});
    if(url.endsWith('/auth/v1/user'))return json({id:owner});
    if(url.includes('/rest/v1/ai_conversations?'))return json([{id:conversation,account_id:owner,fact_schema_version:schema,status:'OPEN'}]);
    if(url.endsWith('/rpc_ai_claim_need_turn_v2_service'))return json({turn:turn('PROCESSING'),claim:{attemptId,
      leaseExpiresAt:new Date(Date.parse(now)+90000).toISOString(),context:{schemaVersion:'NEED_FACT_V2',
      history:Array.from({length:historyCount},(_,i)=>({sequence_no:i+1,role:i%2?'ASSISTANT':'USER',body:`SYNTHETIC_HISTORY_${i+1}`})).slice(-40),
      activeFacts}}});
    // Explicit synthetic authorization of migration 132's pre-provider CAS.
    // The actual SQL proof exercises the real lock and cancellation authority.
    if(url.endsWith('/rpc_ai_dispatch_need_turn_v2_service'))return json(true);
    if(url.endsWith('/rpc_ai_test_budget_reserve_service'))return json({admitted:true,reservationId:'88888888-8888-4888-8888-888888888888',replay:false,code:'AI_TEST_RESERVED'});
    if(url.endsWith('/rpc_ai_fail_need_turn_v2_service'))return json(turn('FAILED'));
    if(url.endsWith('/rpc_ai_complete_need_turn_v2_service'))return json(turn('SUCCEEDED',{
      userMessageId:'66666666-6666-4666-8666-666666666666',assistantMessageId:'77777777-7777-4777-8777-777777777777',
      proposedCount:body.p_proposals.length,safety:body.p_safety,schemaVersion:'NEED_FACT_V2',authoritative:true}));
    if(url.includes('/rest/v1/ai_messages?')){
      const query=new URL(url).searchParams;
      assert.equal(query.get('order'),'sequence_no.desc');assert.equal(query.get('limit'),'40');
      const rows=Array.from({length:historyCount},(_,i)=>({sequence_no:i+1,role:i%2?'ASSISTANT':'USER',body:`SYNTHETIC_HISTORY_${i+1}`}));
      return json(rows.reverse().slice(0,40));
    }
    // Intentionally ignore the query allowlist: the handler must also filter
    // unexpected/manual-only rows returned by the context transport.
    if(url.includes('/rest/v1/ai_structured_facts?'))return json(activeFacts);
    if(url.endsWith('/rest/v1/rpc/rpc_ai_apply_legacy_need_turn_service'))return json({proposedCount:body.p_proposals.length});
    if(url.startsWith('https://generativelanguage.googleapis.com/')||url==='https://api.openai.com/v1/responses'){
      // Thrown with the handler's own realm constructors, as the runtime does in production. An error of
      // this file's realm fails `instanceof Error` inside the VM, which once hid a logged message as UNKNOWN.
      const realm=name=>vm.runInContext(name,context);
      if(failure==='network')throw new (realm('Error'))('SYNTHETIC_GEMINI_KEY '+userText+' PRIVATE_PROVIDER_OUTPUT');
      // A thrown text shaped exactly like one of our own failure names, and the runtime's own network error.
      if(failure==='code-shaped')throw new (realm('Error'))('PRIVATE_PROVIDER_OUTPUT');
      if(failure==='runtime')throw new (realm('TypeError'))('error sending request for url SYNTHETIC_GEMINI_KEY '+userText);
      if(failure==='http')return new Response('PRIVATE_PROVIDER_OUTPUT',{status:429});
      if(failure==='json')return new Response('PRIVATE_PROVIDER_OUTPUT '+userText+' SYNTHETIC_GEMINI_KEY',{status:200});
      const result=providerOutput??(schema==='NEED_FACT_V2'?providerResult:{safety:'ALLOW',assistantMessage:'Potreban je pregled.',facts:[]});
      const output=failure==='output'?'PRIVATE_PROVIDER_OUTPUT '+userText:JSON.stringify(withDialogue(result));
      return url.includes('googleapis')?json({candidates:[{content:{parts:[{text:output}]}}]}):json({output_text:output});
    }
    assert.fail('UNEXPECTED_SYNTHETIC_FETCH_ROUTE');
  };
  const context=vm.createContext({Request,Response,Headers,URL,URLSearchParams,Intl,Date:FixedDate,TextEncoder,TextDecoder,ReadableStream,AbortController,setTimeout,clearTimeout,
    fetch:fakeFetch,console:{error:(...args)=>logs.push(args)},Deno:{env:{get:name=>env[name]},serve:fn=>{handler=fn;}}});
  const cache=new Map();
  function load(file){
    assert.ok([entry,registry,resolve(root,'supabase/functions/_shared/aiTestBudget.ts'),resolve(root,'supabase/functions/_shared/geminiTaskStream.ts'),
      resolve(root,'src/contracts/aiAvailability.ts'),resolve(root,'supabase/functions/_shared/locationReply.ts')].includes(file),'test loader may evaluate only exact source entry/shared helpers');
    if(cache.has(file))return cache.get(file).exports;
    const source=readFileSync(file,'utf8');
    const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true,fileName:file});
    assert.equal((result.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
    const module={exports:{}};cache.set(file,module);
    const evaluate=new vm.Script(`(function(require,module,exports){${result.outputText}\n})`,{filename:file}).runInContext(context);
    evaluate(specifier=>load(resolve(dirname(file),specifier)),module,module.exports);return module.exports;
  }
  load(entry);assert.equal(typeof handler,'function');
  const request=overrides=>new Request('https://edge.test.invalid/uskoci-ai-interview',{method:'POST',
    headers:{Authorization:'Bearer SYNTHETIC_USER_SESSION','Content-Type':'application/json'},
    body:JSON.stringify({conversationId:conversation,text:userText,...(schema==='NEED_FACT_V2'?{clientRequestId:requestId}:{}),...overrides})});
  return {calls,logs,env,registry:load(registry),invoke:overrides=>handler(request(overrides))};
}
const providerCall=fixture=>fixture.calls.find(x=>x.url.includes('googleapis')||x.url==='https://api.openai.com/v1/responses');
const materialWrites=f=>f.calls.filter(call=>/\/(?:rpc_ai_complete_need_turn_v2_service|rpc_ai_apply_legacy_need_turn_service|rpc_ai_apply_interview_turn(?:_v2)?_service)$/.test(new URL(call.url).pathname));
const prompt=call=>call.body.systemInstruction?.parts[0].text??call.body.instructions;
const timeContext=call=>JSON.parse(prompt(call).match(/Serverski vremenski kontekst za trenutni unos u Srbiji: (\{[^}]+\})\./)[1]);

test('Gemini intake wire schema has no empty enum member, including no-question dialogue',async()=>{
  const f=fixture();assert.equal((await f.invoke()).status,200);
  const call=providerCall(f),schema=call.body.generationConfig.responseSchema;
  function check(node,path='responseSchema'){
    if(!node||typeof node!=='object')return;
    if(Array.isArray(node.enum))for(const value of node.enum)
      assert.ok(typeof value==='string'&&value.length>0,`${path}.enum must contain nonempty strings`);
    for(const [key,value]of Object.entries(node))check(value,`${path}.${key}`);
  }
  check(schema);
  assert.ok(schema.properties.dialogue.properties.questionKey.enum.includes('NONE'));
  assert.match(prompt(call),/questionKey.*NONE/);
});

test('Gemini NONE question sentinel completes without becoming a fact or a follow-up question',async()=>{
  const f=fixture({providerOutput:{...providerResult,dialogue:{...syntheticDialogue(),questionKey:'NONE'}}});
  assert.equal((await f.invoke()).status,200);
  const writes=materialWrites(f);assert.equal(writes.length,1);
  assert.equal(writes[0].body.p_proposals.length,1);
  assert.ok(!JSON.stringify(writes[0].body).includes('NONE'));
});

for(const dialogue of [
 {...syntheticDialogue(),next:'ASK',questionKey:'NONE'},
 {...syntheticDialogue(),next:'ANSWER',questionKey:'need.people_needed'},
 {...syntheticDialogue(),questionKey:'UNKNOWN_QUESTION'},
])test(`invalid dialogue remains rejected: ${dialogue.next}/${dialogue.questionKey}`,async()=>{
  const f=fixture({providerOutput:{...providerResult,dialogue}});
  assert.equal((await f.invoke()).status,502);assert.equal(materialWrites(f).length,0);
});

const resolvedWitness={version:1,binding:{taskCountryCode:'RS',geography:{mode:'STATIONARY',start:{city:'SYNTHETIC_CITY'}},
  exactAddress:'PRIVATE_RESOLVED_BINDING_ADDRESS'},points:[{slot:'start',latitudeE6:44123456,longitudeE6:20123456,
  origin:{kind:'PROVIDER_CANDIDATE',providerHint:'PRIVATE_RESOLVED_PROVIDER',candidateHint:'PRIVATE_RESOLVED_CANDIDATE'},
  address:'PRIVATE_RESOLVED_POINT_ADDRESS',accessNotes:'PRIVATE_RESOLVED_ACCESS_NOTES'}]};
const manualFact={key:'need.resolved_location',valueJson:JSON.stringify(resolvedWitness),value:JSON.stringify(resolvedWitness),
  displayValue:'PRIVATE_RESOLVED_DISPLAY',evidence:'PRIVATE_RESOLVED_EVIDENCE',confidence:1};

for(const provider of ['gemini'])test(`${provider} outbound V2 schema and prompt registry exclude manual-only facts`,async()=>{
  const f=fixture({provider});assert.equal((await f.invoke()).status,200);
  const call=providerCall(f),schema=call.body.generationConfig?.responseFormat?.text?.schema??call.body.generationConfig?.responseSchema??call.body.text?.format?.schema;
  const allowedKeys=schema.properties.facts.items.properties.key.enum;
  const promptRegistry=JSON.parse(prompt(call).split('Jedini podržani V2 fact registry: ')[1]);
  assert.deepEqual(allowedKeys,[...f.registry.AI_PROPOSABLE_NEED_FACT_V2_KEYS].filter(key=>key!=='need.required_licenses'));
  assert.deepEqual(promptRegistry.map(fact=>fact.key),allowedKeys);
  assert.ok(allowedKeys.includes('need.task_geography'));assert.ok(allowedKeys.includes('need.task_country_code'));
  assert.ok(allowedKeys.includes('need.exact_address'));assert.ok(!allowedKeys.includes('need.resolved_location'));
  assert.equal(f.registry.NEED_FACT_V2_DEFINITIONS['need.resolved_location'].manualOnly,true);
  assert.ok(!allowedKeys.includes('need.public_photo_paths'));
  assert.equal(f.registry.NEED_FACT_V2_DEFINITIONS['need.public_photo_paths'].manualOnly,true);
  assert.ok(f.registry.NEED_FACT_V2_KEYS.includes('need.resolved_location'),'manual form still owns the full registry key');
  assert.ok(!allowedKeys.includes('need.required_licenses'));
  assert.ok(f.registry.NEED_FACT_V2_KEYS.includes('need.required_licenses'),'historical licence facts remain decodable');
});

test('retired licence requirements remain readable but never reach new task inference or proposals',async()=>{
  const historical={fact_key:'need.required_licenses',fact_value:['PRIVATE_HISTORICAL_LICENSE'],value_type:'STRING_ARRAY',display_value:'Legacy requirement',
    status:'CONFIRMED',source:'AI',fact_schema_version:'NEED_FACT_V2',created_at:'2026-09-07T10:00:00Z'};
  const f=fixture({activeFacts:[historical]});assert.equal((await f.invoke()).status,200);
  assert.ok(!prompt(providerCall(f)).includes('PRIVATE_HISTORICAL_LICENSE'));
  assert.match(prompt(providerCall(f)),/Ne pitajte za njih i ne predlažite need.required_licenses/);
  const rejected=fixture({providerOutput:{...providerResult,facts:[{key:'need.required_licenses',valueJson:'["LICENSE"]',displayValue:'LICENSE',evidence:userText,confidence:1}]}});
  assert.equal((await rejected.invoke()).status,502);assert.equal(materialWrites(rejected).length,0);
});

for(const schema of ['NEED_FACT_V2','LEGACY_TEXT_V1']){
  test(`${schema} untrusted context cannot send a resolved witness to a provider`,async()=>{
    const activeFacts=[
      {fact_key:'need.people_needed',fact_value:2,display_value:'2 osobe',status:'CONFIRMED'},
      {fact_key:'naslov',fact_value:'SYNTHETIC_LEGACY_TITLE',status:'CONFIRMED'},
      {fact_key:'need.exact_address',fact_value:'SYNTHETIC_EXISTING_PRIVATE_ADDRESS',status:'CONFIRMED'},
      {fact_key:'need.resolved_location',fact_value:resolvedWitness,display_value:manualFact.displayValue,status:'CONFIRMED'},
      {fact_key:'unknown.private_fact',fact_value:'PRIVATE_UNKNOWN_FACT',status:'CONFIRMED'},
    ];
    const f=fixture({schema,activeFacts});
    if(schema==='NEED_FACT_V2'){
      assert.equal((await f.invoke()).status,502,'untrusted claim context containing private/unknown fields must fail closed');
      assert.equal(providerCalls(f).length,0);assert.deepEqual(materialWrites(f),[]);return;
    }
    assert.equal((await f.invoke()).status,503,'legacy history lookup is not permission for a new unbudgeted inference');
    const query=new URL(f.calls.find(call=>call.url.includes('/ai_structured_facts?')).url).searchParams;
    assert.equal(query.get('conversation_id'),`eq.${conversation}`);assert.equal(query.get('superseded_at'),'is.null');
    const filter=query.get('fact_key');assert.match(filter??'',/^in\.\(.+\)$/);
    const fetchedKeys=JSON.parse(`[${filter.slice(4,-1)}]`);
    assert.ok(fetchedKeys.includes('naslov'));assert.ok(fetchedKeys.includes('need.people_needed'));
    assert.ok(fetchedKeys.includes('need.exact_address'));assert.ok(!fetchedKeys.includes('need.resolved_location'));
    assert.ok(!fetchedKeys.includes('unknown.private_fact'));
    assert.equal(providerCalls(f).length,0);assert.deepEqual(materialWrites(f),[]);assert.deepEqual(f.logs,[]);
  });
}

// What an operator log of a failed provider call may hold beside its category: the class of the failure,
// from a closed list. Never the thrown text: a JSON parse failure quotes the provider output it choked on,
// and a runtime network error can quote its request.
const FAILURE_CLASS={network:'UNKNOWN',http:'PROVIDER_HTTP_FAILED',json:'OUTPUT_NOT_JSON',output:'OUTPUT_NOT_JSON',
  'code-shaped':'UNKNOWN',runtime:'RUNTIME_TYPE_ERROR'};
const providerFailureLogs=(failure,httpCategory='GEMINI_GENERATE_FAILED')=>failure==='http'
  ?[[httpCategory,429],['AI_PROVIDER_FAILED',FAILURE_CLASS.http]]:[['AI_PROVIDER_FAILED',FAILURE_CLASS[failure]]];
const assertNothingRawLogged=f=>{const text=JSON.stringify(f.logs);
  for(const fragment of ['SYNTHETIC','PRIVATE','GENERIC','Unexpected','token','url',userText.slice(0,8)])assert.ok(!text.includes(fragment),'raw text reached the log');
  for(const entry of f.logs)for(const value of entry)assert.ok(typeof value==='number'||/^[A-Z][A-Z0-9_]{2,63}$/.test(value),'a log value is neither a status nor a class');};

test('the closed list of failure classes names every failure this function and its helpers throw, and logs nothing else',()=>{
  const sources=[entry,resolve(root,'supabase/functions/_shared/aiTestBudget.ts'),resolve(root,'supabase/functions/_shared/geminiTaskStream.ts')].map(file=>readFileSync(file,'utf8'));
  const handler=sources[0],listed=new Set(handler.match(/const OWN_FAILURE_NAMES = new Set\(\[([^\]]+)\]\)/)[1].match(/[A-Z][A-Z0-9_]+/g));
  const thrown=new Set(sources.flatMap(source=>[...source.matchAll(/new Error\(([^)]*)\)/g)].map(match=>match[1])));
  // This existing typed provider-status error uses a shared literal, not Error('...').
  assert.match(sources[2],/class GeminiCreditsUnavailableError extends Error[^]*?super\(AI_CREDITS_UNAVAILABLE\)/);
  assert.match(readFileSync(resolve(root,'src/contracts/aiAvailability.ts'),'utf8'),/AI_CREDITS_UNAVAILABLE = 'AI_CREDITS_UNAVAILABLE'/);
  thrown.add("'AI_CREDITS_UNAVAILABLE'");
  for(const argument of thrown){assert.match(argument,/^'[A-Z][A-Z0-9_]+'$/,'a failure is thrown with a text that is not a fixed name');assert.ok(listed.has(argument.slice(1,-1)),'a thrown failure name is missing from the closed list');}
  assert.equal(listed.size,thrown.size);
  // The one line that logs a failed provider call takes its second value from the classifier and from nowhere else.
  assert.deepEqual(handler.match(/console\.error\('AI_PROVIDER_FAILED'[^;]*;/g),["console.error('AI_PROVIDER_FAILED', providerFailureClass(providerError));"]);
  assert.ok(!/console[.](error|warn|log|info)[(][^;]*[.](message|stack)[^A-Za-z]/.test(sources.join(' ')),'a thrown message or stack is passed to a log');
});

for(const safety of ['ALLOW','BLOCK']){
  test(`approved Gemini V2 ${safety} manual-only proposal rejects whole turn before SQL writer`,async()=>{
    const f=fixture({providerOutput:{safety,assistantMessage:'PRIVATE_RESOLVED_ASSISTANT',facts:[providerResult.facts[0],manualFact]}});
    const response=await f.invoke();assert.equal(response.status,502);
    assert.equal((await response.json()).code,'AI_PROVIDER_FAILED');assert.equal(providerCalls(f).length,1);
    assert.deepEqual(materialWrites(f),[],'no valid subset or empty BLOCK turn may be persisted; claim/failure metadata is not a materializer');
    assert.deepEqual(f.logs,[['AI_PROVIDER_FAILED','AI_MANUAL_ONLY_FACT_REJECTED']]);assertNothingRawLogged(f);
  });
}

for(const [now,date,time,offset] of [
  ['2026-09-07T21:59:59.000Z','2026-09-07','23:59:59','+02:00'],
  ['2026-09-07T22:00:00.000Z','2026-09-08','00:00:00','+02:00'],
  ['2026-09-07T23:59:59.000Z','2026-09-08','01:59:59','+02:00'],
  ['2026-09-08T00:00:00.000Z','2026-09-08','02:00:00','+02:00'],
  ['2026-12-31T23:30:00.000Z','2027-01-01','00:30:00','+01:00'],
  ['2026-03-29T00:30:00.000Z','2026-03-29','01:30:00','+01:00'],
  ['2026-03-29T01:30:00.000Z','2026-03-29','03:30:00','+02:00'],
  ['2026-10-25T00:30:00.000Z','2026-10-25','02:30:00','+02:00'],
  ['2026-10-25T01:30:00.000Z','2026-10-25','02:30:00','+01:00'],
])test(`actual outbound server time context at ${now}`,async()=>{
  const f=fixture({now});assert.equal((await f.invoke({nowUtc:'2099-01-01',localDate:'2099-01-01',timeZone:'Pacific/Honolulu'})).status,400);
  assert.equal(f.calls.length,0);assert.equal((await f.invoke()).status,200);
  assert.deepEqual(timeContext(providerCall(f)),{nowUtc:now,timeZone:'Europe/Belgrade',localDate:date,localTime:time,utcOffset:offset});
  assert.ok(!prompt(providerCall(f)).includes('2099-01-01'));
});

for(const provider of ['gemini'])test(`${provider} actual handler sends newest30 chronologically and persists validated proposals`,async()=>{
  const f=fixture({provider}),result=await f.invoke(),body=await result.json();assert.equal(result.status,200);
  assert.equal(body.state,'SUCCEEDED');assert.equal(body.receipt.schemaVersion,'NEED_FACT_V2');assert.equal(body.receipt.proposedCount,1);
  const call=providerCall(f),messages=provider==='gemini'?call.body.contents:call.body.input;
  const texts=messages.map(x=>x.parts?.[0].text??x.content[0].text);
  assert.deepEqual(texts,[...Array.from({length:30},(_,i)=>`SYNTHETIC_HISTORY_${i+21}`),userText]);
  assert.match(prompt(call),/nedostajući čas, trajanje, kraj termina ili nejasnu lokaciju/);
  assert.match(prompt(call),/nikada potvrđen termin Zadatka/);assert.match(prompt(call),/ljudska potvrda/);
  assert.equal(timeContext(call).timeZone,'Europe/Belgrade');
  if(provider==='gemini'){
    assert.equal(call.headers['x-goog-api-key'],f.env.GEMINI_API_KEY);assert.equal(new URL(call.url).search,'');
    assert.ok(!call.url.includes(f.env.GEMINI_API_KEY));assert.ok(!f.calls.some(x=>new URL(x.url).hostname==='api.openai.com'));
  }else{assert.equal(call.headers.authorization,`Bearer ${f.env.OPENAI_API_KEY}`);assert.equal(call.body.store,false);}
  const persist=f.calls.find(x=>x.url.includes('/rpc/rpc_ai_complete_need_turn_v2_service'));assert.ok(persist);
  assert.equal(persist.headers.authorization,'Bearer SYNTHETIC_SERVICE_KEY');assert.equal(persist.body.p_account_id,owner);
  assert.equal(persist.body.p_conversation_id,conversation);assert.equal(persist.body.p_user_message,userText);
  assert.deepEqual(persist.body.p_proposals,[{key:'need.people_needed',value:2,displayValue:'2 osobe',evidence:userText,confidence:0.9}]);
  assert.deepEqual(f.logs,[]);assert.ok(!JSON.stringify(body).includes('SYNTHETIC_'));
});

test('short history stays chronological without invented prior turns',async()=>{
  const f=fixture({historyCount:3});assert.equal((await f.invoke()).status,200);
  assert.deepEqual(providerCall(f).body.contents.map(x=>x.parts[0].text),['SYNTHETIC_HISTORY_1','SYNTHETIC_HISTORY_2','SYNTHETIC_HISTORY_3',userText]);
});
test('legacy history stays readable without synthesizing a V2 key or licensing inference',async()=>{
  const f=fixture({schema:'LEGACY_TEXT_V1'});assert.equal((await f.invoke()).status,503);
  assert.ok(f.calls.some(x=>x.url.includes('/ai_messages?')));assert.ok(f.calls.some(x=>x.url.includes('/ai_structured_facts?')));
  assert.equal(providerCalls(f).length,0);assert.deepEqual(materialWrites(f),[]);
  assert.ok(!f.calls.some(x=>x.url.endsWith('/rpc/rpc_ai_claim_need_turn_v2_service')));
  assert.ok(!f.calls.some(x=>x.url.endsWith('/rpc/rpc_ai_test_budget_reserve_service')));
});
for(const failure of ['network','http','json','output'])test(`provider ${failure} failure logs fixed categories only and performs no writer call`,async()=>{
  const f=fixture({failure}),response=await f.invoke();assert.equal(response.status,502);
  assert.equal((await response.json()).code,'AI_PROVIDER_FAILED');
  assert.deepEqual(f.logs,providerFailureLogs(failure));assert.deepEqual(materialWrites(f),[]);
  assertNothingRawLogged(f);
});
// The earlier check looked for the whole of 'PRIVATE_PROVIDER_OUTPUT' and so missed the ten characters of it
// that a JSON parse error quotes. These two throw a text that is itself shaped like a failure name, and the
// runtime's own network error; neither text may be logged, in whole or in part.
for(const failure of ['code-shaped','runtime'])test(`a ${failure} provider failure is logged as a class, never as the text that was thrown`,async()=>{
  const f=fixture({failure}),response=await f.invoke();assert.equal(response.status,502);
  assert.equal((await response.json()).code,'AI_PROVIDER_FAILED');
  assert.deepEqual(f.logs,providerFailureLogs(failure));assert.deepEqual(materialWrites(f),[]);assertNothingRawLogged(f);
});

const providerCalls=f=>f.calls.filter(call=>[
  'generativelanguage.googleapis.com','api.openai.com',
].includes(new URL(call.url).hostname));

const semanticFact=(key,value)=>({fact_key:key,fact_value:value,value_type:typeof value==='number'?'INTEGER':'TEXT',
 display_value:'D'.repeat(1000),fact_schema_version:'NEED_FACT_V2',status:'NEEDS_CONFIRMATION',source:'AI_INFERENCE',created_at:'2026-09-07T12:00:00Z'});
test('rich known facts remain complete JSON and preserve later material fields',async()=>{
 const activeFacts=[semanticFact('need.description','D'.repeat(6000)),semanticFact('need.access_notes','A'.repeat(2000)),semanticFact('need.people_needed',3)];
 const f=fixture({activeFacts});assert.equal((await f.invoke()).status,200);
 const held=JSON.parse(prompt(providerCall(f)).split('Aktuelne server-side činjenice: ')[1].split(' Sastavite lep, kratak')[0]);
 assert.equal(held.find(x=>x.key==='need.people_needed').value,3);
 assert.equal(held.find(x=>x.key==='need.description').value.length,6000);
});

test('an unchanged material proposal is not written as a new unconfirmed version',async()=>{
 const f=fixture({activeFacts:[semanticFact('need.people_needed',2)]});assert.equal((await f.invoke()).status,200);
 assert.deepEqual(materialWrites(f)[0].body.p_proposals,[]);
});

for(const [input,now,kind] of [['Treba mi sutra.','2026-09-20T22:59:00Z','TODAY_FLEXIBLE'],
 ['Треба ми сутра.','2026-09-20T22:59:00Z','TODAY_FLEXIBLE'],['Treba mi danas.','2026-12-31T23:30:00Z','TOMORROW_FLEXIBLE']])
 test('a contradictory relative day becomes clarification without material writes: '+input,async()=>{
  const f=fixture({now,providerOutput:{safety:'ALLOW',assistantMessage:'Zabeležio sam termin.',facts:[
   {key:'need.schedule_kind',valueJson:JSON.stringify(kind),displayValue:kind,evidence:input,confidence:0.99}]}});
  assert.equal((await f.invoke({text:input})).status,200);
  const completed=materialWrites(f)[0].body;assert.equal(completed.p_safety,'CLARIFY');assert.deepEqual(completed.p_proposals,[]);
  assert.match(completed.p_assistant_message,/termin/);assert.equal(providerCalls(f).length,1);
 });

test('negated and alternative days are not silently rewritten by a keyword rule',async()=>{
 const f=fixture({providerOutput:{safety:'CLARIFY',assistantMessage:'Koji od ta dva dana biraš?',facts:[]}});
 assert.equal((await f.invoke({text:'Ne danas, možda sutra ili prekosutra.'})).status,200);
 assert.equal(materialWrites(f)[0].body.p_assistant_message,'Koji od ta dva dana biraš?');
});


for(const [input,evidence,kind] of [
 ['Za sutra mi treba pomoć oko prenosa ormara.','sutra','TODAY_FLEXIBLE'],
 ['За сутра ми треба помоћ око преноса ормара.','сутра','TODAY_FLEXIBLE'],
 ['Ne sutra nego danas.','sutra','TODAY_FLEXIBLE'],
])test('PKG041 relative-day evidence cannot contradict the proposed day inside a full sentence',async()=>{
 const f=fixture({now:'2026-09-20T22:59:00Z',providerOutput:{safety:'ALLOW',assistantMessage:'Termin je unet.',facts:[
  {key:'need.schedule_kind',valueJson:JSON.stringify(kind),displayValue:kind,evidence,confidence:0.99}]}});
 assert.equal((await f.invoke({text:input})).status,200);
 const result=materialWrites(f)[0].body;assert.equal(result.p_safety,'CLARIFY');assert.deepEqual(result.p_proposals,[]);
 assert.equal(result.p_assistant_message,'Koji je tačan datum početka posla?');
});
test('PKG041 fixed start must agree with its literal relative-day evidence in Serbian local time',async()=>{
 const f=fixture({now:'2026-09-20T22:59:00Z',providerOutput:{safety:'ALLOW',assistantMessage:'Termin je unet.',facts:[
  {key:'need.starts_at',valueJson:'"2026-09-21T08:00:00+02:00"',displayValue:'21.09. u 8h',evidence:'sutra',confidence:1}]}});
 await f.invoke({text:'Treba mi radnik sutra od 8.'});assert.equal(materialWrites(f)[0].body.p_safety,'CLARIFY');
});
test('PKG041 negation with correct evidence is preserved, not converted to the first mentioned day',async()=>{
 const f=fixture({now:'2026-09-20T22:59:00Z',providerOutput:{safety:'ALLOW',assistantMessage:'Termin je unet.',facts:[
  {key:'need.schedule_kind',valueJson:'"TODAY_FLEXIBLE"',displayValue:'Danas',evidence:'danas',confidence:1}]}});
 await f.invoke({text:'Ne sutra nego danas.'});assert.equal(materialWrites(f)[0].body.p_proposals[0].value,'TODAY_FLEXIBLE');
});

test('finish-only task request cannot invent new terms or claim publication',async()=>{
 const f=fixture();assert.equal((await f.invoke({text:'Objavi zadatak.'})).status,200);
 const written=materialWrites(f)[0].body;assert.deepEqual(written.p_proposals,[]);
 assert.equal(written.p_assistant_message,'Otvori pregled zadatka. Tamo možeš da dopuniš podatke i potvrdiš objavu.');
});

const completionFacts=()=>[
 semanticFact('need.title','Nošenje kesa'),semanticFact('need.description','Prenošenje nekoliko kesa od ulaza do stana.'),
 semanticFact('need.category','Nošenje stvari'),semanticFact('need.people_needed',1),semanticFact('need.price_mode','OFFERS'),
 semanticFact('need.schedule_kind','TODAY_FLEXIBLE'),semanticFact('need.task_country_code','RS'),
 semanticFact('need.task_geography',{mode:'STATIONARY',start:{city:'Beograd'}}),
];
const proposed=(key,value,evidence='Prenošenje nekoliko kesa')=>({key,valueJson:JSON.stringify(value),displayValue:String(value),evidence,confidence:0.95});
for(const absent of ['need.title','need.category'])test('REVIEW cannot conceal missing internal completion: '+absent,async()=>{
 const f=fixture({activeFacts:completionFacts().filter(x=>x.fact_key!==absent),providerOutput:{safety:'ALLOW',facts:[],
  assistantMessage:'Sve je spremno.',dialogue:{...syntheticDialogue(),next:'REVIEW'}}});
 await f.invoke();const result=materialWrites(f)[0].body;
 assert.equal(result.p_assistant_message,'Pregled još nije dovršen. Možeš da dopuniš opis zadatka ili otvoriš pregled.');
 assert.deepEqual(result.p_proposals,[]);assert.equal(providerCalls(f).length,1);
});
test('REVIEW asks the missing material question and retains the last content proposal',async()=>{
 const f=fixture({activeFacts:completionFacts().filter(x=>!['need.category','need.price_mode'].includes(x.fact_key)),
  providerOutput:{safety:'ALLOW',facts:[proposed('need.category','Nošenje stvari')],assistantMessage:'Spremno.',
   dialogue:{...syntheticDialogue(),next:'REVIEW'}}});
 await f.invoke();const result=materialWrites(f)[0].body;
 assert.equal(result.p_assistant_message,'Želiš da navedeš cenu ili da dobiješ ponude?');
 assert.equal(result.p_proposals[0].key,'need.category');
});
test('the last classification completes the real task without dropping other proposals',async()=>{
 const f=fixture({activeFacts:completionFacts().filter(x=>!['need.category','need.people_needed'].includes(x.fact_key)),
  providerOutput:{safety:'ALLOW',facts:[proposed('need.category','Nošenje stvari'),proposed('need.people_needed',1,'jedna osoba')],
   assistantMessage:'Spremno.',dialogue:{...syntheticDialogue(),next:'REVIEW'}}});
 await f.invoke({text:'Jedna osoba za prenošenje nekoliko kesa.'});const result=materialWrites(f)[0].body;
 assert.equal(result.p_assistant_message,'Otvori pregled zadatka. Tamo proveri podatke pre objave.');
 assert.deepEqual(result.p_proposals.map(x=>x.key),['need.category','need.people_needed']);
});
test('finish-only can recover only missing presentation from the existing description',async()=>{
 const f=fixture({activeFacts:completionFacts().filter(x=>!['need.category','need.title'].includes(x.fact_key)),
  providerOutput:{safety:'ALLOW',facts:[proposed('need.category','Nošenje stvari'),proposed('need.title','Pomoć oko kesa'),
   proposed('need.people_needed',9),proposed('need.price_rsd',9000),proposed('need.description','Drugi zadatak')],
   assistantMessage:'Objavljeno.',dialogue:{...syntheticDialogue(),next:'REVIEW'}}});
 await f.invoke({text:'To je to.'});const result=materialWrites(f)[0].body;
 assert.deepEqual(result.p_proposals.map(x=>x.key),['need.category','need.title']);
 assert.ok(!result.p_assistant_message.includes('Objavljeno'));assert.equal(providerCalls(f).length,1);
 const instruction=providerCalls(f)[0].body.systemInstruction.parts[0].text;
 assert.match(instruction,/obavezno predložite nedostajuća polja u facts u ovoj istoj poruci/);
 assert.ok(instruction.includes(JSON.stringify({existingDescription:'Prenošenje nekoliko kesa od ulaza do stana.',missingPresentation:['need.title','need.category']})));
});
for(const variant of ['unknown-description','complete','normal-turn'])
test('explicit finish completion instruction is absent outside its narrow context: '+variant,async()=>{
 const activeFacts=completionFacts().filter(x=>variant==='complete'||x.fact_key!=='need.category');
 if(variant==='unknown-description')activeFacts.find(x=>x.fact_key==='need.description').status='UNKNOWN';
 const f=fixture({activeFacts});await f.invoke({text:variant==='normal-turn'?'Hvala na objašnjenju.':'To je to.'});
 assert.ok(!providerCalls(f)[0].body.systemInstruction.parts[0].text.includes('obavezno predložite nedostajuća polja u facts u ovoj istoj poruci'));
 assert.equal(providerCalls(f).length,1);
});
for(const variant of ['no-description','unknown-description','wrong-evidence','existing-category','different-task'])
 test('finish-only summary recovery stays bounded: '+variant,async()=>{
  const activeFacts=completionFacts().filter(x=>x.fact_key!=='need.category');
  if(variant==='no-description')activeFacts.splice(activeFacts.findIndex(x=>x.fact_key==='need.description'),1);
  if(variant==='unknown-description')activeFacts.find(x=>x.fact_key==='need.description').status='UNKNOWN';
  if(variant==='existing-category')activeFacts.push(semanticFact('need.category','Ranija vrsta zadatka'));
  const f=fixture({activeFacts,providerOutput:{safety:'ALLOW',facts:[proposed('need.category','Nošenje stvari',variant==='wrong-evidence'?'Uređivanje bašte':'Prenošenje nekoliko kesa')],
   assistantMessage:'Gotovo.',dialogue:{...syntheticDialogue(),next:'REVIEW',...(variant==='different-task'?{taskRelation:'DIFFERENT_TASK'}:{})}}});
  await f.invoke({text:'To je to.'});assert.deepEqual(materialWrites(f)[0].body.p_proposals,[]);
 });

test('a question about known headcount is replaced by one genuinely missing topic',async()=>{
 const f=fixture({activeFacts:[semanticFact('need.description','Prenos stvari'),semanticFact('need.people_needed',3)],
  providerOutput:{safety:'ALLOW',assistantMessage:'Koliko ljudi, kada, gde i koja cena?',facts:[],
   dialogue:{...syntheticDialogue(),next:'ASK',questionKey:'need.people_needed'}}});
 assert.equal((await f.invoke()).status,200);
 assert.equal(materialWrites(f)[0].body.p_assistant_message,'Želiš da navedeš cenu ili da dobiješ ponude?');
});

for(const [questionKey,message] of [
 ['need.task_geography','U kom gradu je mesto preuzimanja?'],
 ['need.task_geography','Do kog dela grada treba prevesti stvari?'],
 ['need.schedule_kind','Koji dan ti odgovara za prenos?'],
])test('a genuinely missing topic retains its contextual question: '+message,async()=>{
 const f=fixture({activeFacts:[semanticFact('need.description','Prenos stvari'),semanticFact('need.people_needed',2)],
  providerOutput:{safety:'ALLOW',assistantMessage:message,facts:[],
   dialogue:{...syntheticDialogue(),next:'ASK',questionKey}}});
 assert.equal((await f.invoke({text:'SYNTHETIC_PARTIAL_ROUTE_OR_TIME'})).status,200);
 assert.equal(materialWrites(f)[0].body.p_assistant_message,message);
 assert.deepEqual(materialWrites(f)[0].body.p_proposals,[]);
});

test('a direct explanation is preserved while location remains missing',async()=>{
 const message='Treba mi još grad preuzimanja; odredište već imamo.';
 const f=fixture({providerOutput:{safety:'ALLOW',assistantMessage:message,facts:[],
  dialogue:{...syntheticDialogue(),next:'ANSWER',questionKey:'NONE'}}});
 assert.equal((await f.invoke({text:'Zašto opet pitaš za mesto?'})).status,200);
 assert.equal(materialWrites(f)[0].body.p_assistant_message,message);
});

for(const interpretation of [{taskRelation:'DIFFERENT_TASK'},{taskRelation:'UNCLEAR'},
 {priceUnit:'PER_DAY'},{priceUnit:'PER_HOUR'},{schedulePattern:'REPEATED'}])
 test('material ambiguity cannot mix new work with old terms: '+JSON.stringify(interpretation),async()=>{
  const f=fixture({activeFacts:[semanticFact('need.price_rsd',5000),semanticFact('need.schedule_kind','TODAY_FLEXIBLE')],
   providerOutput:{safety:'ALLOW',assistantMessage:'Sve sam razumeo i uneo.',facts:[
    {key:'need.title',valueJson:'"Druga vrsta posla"',displayValue:'Druga vrsta posla',evidence:'novi posao',confidence:1}],
    dialogue:{...syntheticDialogue(),...interpretation}}});
  assert.equal((await f.invoke()).status,200);const written=materialWrites(f)[0].body;
  assert.equal(written.p_safety,'CLARIFY');assert.deepEqual(written.p_proposals,[]);
  assert.ok(!written.p_assistant_message.includes('Sve sam razumeo'));assert.equal(providerCalls(f).length,1);
 });

for(const dialogue of [null,{}, {...syntheticDialogue(),next:'ASK'}, {...syntheticDialogue(),hidden:'extra'},
 {...syntheticDialogue(),next:'ASK',questionKey:'need.resolved_location'}])
 test('missing or invalid dialogue plan is refused before materialization',async()=>{
  const f=fixture({providerOutput:{...providerResult,dialogue}});assert.equal((await f.invoke()).status,502);
  assert.deepEqual(materialWrites(f),[]);
 });

test('changed headcount remains accepted while acknowledgment contains no repeated summary',async()=>{
 const f=fixture({activeFacts:[semanticFact('need.people_needed',3)],
  providerOutput:{...providerResult,dialogue:{...syntheticDialogue(),next:'ACK'}}});
 assert.equal((await f.invoke()).status,200);const written=materialWrites(f)[0].body;
 assert.equal(written.p_proposals[0].value,2);assert.equal(written.p_assistant_message,'Podaci su ažurirani u pregledu.');
});
const hostFor={gemini:'generativelanguage.googleapis.com',openai:'api.openai.com'};

for(const selected of ['openai','gemini'])test(`explicit ${selected} cannot bypass approved Gemini admission when both pairs are present`,async()=>{
  const f=fixture();f.env.AI_PROVIDER=selected;
  const other=selected==='openai'?'gemini':'openai';
  assert.equal((await f.invoke({provider:other,AI_PROVIDER:other})).status,400);assert.equal(f.calls.length,0);
  const response=await f.invoke(),body=await response.json();
  if(selected==='openai'){
    assert.equal(response.status,503);assert.equal(body.code,'AI_PROVIDER_NOT_CONFIGURED');
    assert.deepEqual(providerCalls(f),[]);assert.deepEqual(materialWrites(f),[]);return;
  }
  assert.equal(response.status,200);assert.equal(body.state,'SUCCEEDED');
  const calls=providerCalls(f);assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).hostname,hostFor[selected]);
  if(selected==='openai'){
    assert.equal(calls[0].headers.authorization,`Bearer ${f.env.OPENAI_API_KEY}`);
    assert.equal(calls[0].body.model,f.env.OPENAI_MODEL);assert.equal(calls[0].body.store,false);
  }else{
    assert.equal(calls[0].headers['x-goog-api-key'],f.env.GEMINI_API_KEY);
    assert.ok(new URL(calls[0].url).pathname.includes(encodeURIComponent(f.env.GEMINI_MODEL)));
  }
  const persist=f.calls.find(call=>new URL(call.url).pathname==='/rest/v1/rpc/rpc_ai_complete_need_turn_v2_service');
  assert.ok(persist);assert.equal(persist.body.p_account_id,owner);
  assert.deepEqual(Object.keys(persist.body).sort(),[
    'p_account_id','p_assistant_message','p_attempt_id','p_client_request_id','p_conversation_id','p_proposals','p_safety','p_user_message',
  ]);
  assert.equal(persist.body.p_proposals[0].key,'need.people_needed');assert.equal(persist.body.p_proposals[0].value,2);
  assert.deepEqual(f.logs,[]);assert.ok(!JSON.stringify(body).includes('SYNTHETIC_'));
});

test('absent selector has no implicit OpenAI primary and rejects client provider fields',async()=>{
  const f=fixture();delete f.env.AI_PROVIDER;assert.equal(f.env.AI_PROVIDER,undefined);
  assert.equal((await f.invoke({provider:'openai',AI_PROVIDER:'openai'})).status,400);assert.equal(f.calls.length,0);
  const response=await f.invoke();assert.equal(response.status,503);assert.equal((await response.json()).code,'AI_PROVIDER_NOT_CONFIGURED');
  assert.deepEqual(providerCalls(f),[]);assert.deepEqual(materialWrites(f),[]);
});

for(const missing of ['GEMINI_API_KEY','GEMINI_MODEL'])test(`missing selector and ${missing} cannot fall back to OpenAI`,async()=>{
  const f=fixture();delete f.env.AI_PROVIDER;delete f.env[missing];
  const response=await f.invoke();assert.equal(response.status,503);assert.equal((await response.json()).code,'AI_PROVIDER_NOT_CONFIGURED');
  assert.deepEqual(providerCalls(f),[]);assert.deepEqual(materialWrites(f),[]);
});

for(const invalid of ['','OPENAI',' openai','anthropic','gemini,openai'])test(`invalid explicit selector ${JSON.stringify(invalid)} fails before provider or writer`,async()=>{
  const f=fixture();f.env.AI_PROVIDER=invalid;
  const response=await f.invoke();assert.equal(response.status,503);
  assert.equal((await response.json()).code,'AI_PROVIDER_NOT_CONFIGURED');
  assert.deepEqual(providerCalls(f),[]);assert.deepEqual(materialWrites(f),[]);
  assert.deepEqual(f.logs,[]);
});

for(const selected of ['openai','gemini'])for(const suffix of ['API_KEY','MODEL'])for(const missing of [undefined,'']){
  test(`explicit ${selected} with ${suffix} ${missing===undefined?'absent':'empty'} never falls back`,async()=>{
    const f=fixture();f.env.AI_PROVIDER=selected;f.env[`${selected.toUpperCase()}_${suffix}`]=missing;
    const response=await f.invoke();assert.equal(response.status,503);
    assert.equal((await response.json()).code,'AI_PROVIDER_NOT_CONFIGURED');assert.deepEqual(providerCalls(f),[]);
    assert.deepEqual(materialWrites(f),[]);assert.deepEqual(f.logs,[]);
  });
}

test('absent selector with neither complete pair retains the known pre-provider 503',async()=>{
  const f=fixture();delete f.env.AI_PROVIDER;delete f.env.GEMINI_MODEL;delete f.env.OPENAI_MODEL;
  const response=await f.invoke();assert.equal(response.status,503);
  assert.equal((await response.json()).code,'AI_PROVIDER_NOT_CONFIGURED');assert.deepEqual(providerCalls(f),[]);
  assert.deepEqual(materialWrites(f),[]);assert.deepEqual(f.logs,[]);
});

for(const selected of ['gemini'])for(const failure of ['network','http','json','output']){
  test(`explicit ${selected} ${failure} failure calls no alternate provider and no writer`,async()=>{
    const f=fixture({failure});f.env.AI_PROVIDER=selected;
    const response=await f.invoke();assert.equal(response.status,502);assert.equal((await response.json()).code,'AI_PROVIDER_FAILED');
    const calls=providerCalls(f);assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).hostname,hostFor[selected]);
    assert.deepEqual(materialWrites(f),[]);
    const httpCategory=selected==='openai'?'OPENAI_RESPONSES_FAILED':'GEMINI_GENERATE_FAILED';
    assert.deepEqual(f.logs,providerFailureLogs(failure,httpCategory));assertNothingRawLogged(f);
  });
}
