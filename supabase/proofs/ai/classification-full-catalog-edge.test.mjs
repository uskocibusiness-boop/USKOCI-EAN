// Actual handler sources with synthetic provider/database transport only.
// No live call, persistence, paid model, or claimed natural-language accuracy.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadOwnedIntakeHandler} from './owned_intake_edge_runtime.mjs';
import {loadWorkerRecoveryHandler} from './worker_recovery_edge_runtime.mjs';

const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const account=id(1),conversation=id(2),request=id(3),turnId=id(4),attemptId=id(5);
const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const root={categoryId:id(999),parentId:null,label:'Specijalne usluge',aliases:[],path:['Specijalne usluge'],isLeaf:false};
const items=[root,...Array.from({length:130},(_,n)=>({categoryId:id(1000+n),parentId:root.categoryId,
  label:`Usluga broj ${n}`,aliases:Array.from({length:15},(_,a)=>`Sinonim ${n} broj ${a}`),
  path:[root.label,`Usluga broj ${n}`],isLeaf:true}))];
const service=items.at(-1).label,categoryId=items.at(-1).categoryId;
const proposal=(patch={})=>({service,mode:'REMOTE',action:'REUSE_EXISTING',categoryId,parentId:'',proposedPath:[],
  reason:'Exact synthetic service in the last page of the complete catalog.',catalogVersion:7,...patch});
const dialogue=(next='ANSWER')=>({next,questionKey:'NONE',taskRelation:'CONTINUE',priceUnit:'UNSPECIFIED',schedulePattern:'UNSPECIFIED'});
const activeFact=(fact_key,fact_value)=>({fact_key,fact_value,value_type:'TEXT',display_value:JSON.stringify(fact_value),
  fact_schema_version:'NEED_FACT_V2',status:'CONFIRMED',source:'USER_TEXT',created_at:'2026-10-19T12:00:00Z'});
const locationContext={version:1,promptToken:id(31),reviewRevision:'a'.repeat(64),slot:'start',phase:'PROPOSAL',
  question:'Da li je ovo mesto?',query:'PRIVATE_SYNTHETIC_QUERY',proposal:{id:id(32),label:'PRIVATE_SYNTHETIC_ADDRESS'},alternatives:[]};
function fixture(purpose,options={}){
  const worker=purpose==='WORKER_CAPABILITY',calls=[];
  const env={SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_PUBLIC',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE',
    AI_PROVIDER:'gemini',GEMINI_API_KEY:'SYNTHETIC_PROVIDER',GEMINI_MODEL:'gemini-3.8-flash',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',
    USKOCI_TAXONOMY_UNIFIED_SHADOW:'true',USKOCI_TAXONOMY_SHADOW_CAPTURE:'true'};
  const receipt={userMessageId:id(6),assistantMessageId:id(7),proposedCount:0,safety:'ALLOW',schemaVersion:'NEED_FACT_V2',authoritative:true};
  const turn=(state='SUCCEEDED')=>worker
    ? {turnId,conversationId:conversation,clientRequestId:request,attemptId,state,retryAllowed:false,authoritative:true}
    : {turnId,conversationId:conversation,clientRequestId:request,state,retryAllowed:false,receipt:state==='SUCCEEDED'?receipt:null};
  const skills=options.noServices?[]:[service];
  const context={schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:false,safety:'ALLOW',revision:2,
    candidate:{skills,bio:'Stari opis',availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},
    serviceModeContext:{schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:2,savedServices:options.saved?[{service,categoryId,mode:'REMOTE'}]:[],
      draftServices:[],unresolvedServices:options.saved?[]:skills},messages:[{role:'USER',body:options.text??'Dopuni samo opis profila.'}]};
  const output=worker
    ? {safety:'ALLOW',assistantMessage:'Opis je u nacrtu.',patch:{bio:'Dopunjen opis'},availabilityChange:{kind:'NONE',evidence:''},...options.output}
    : {safety:'ALLOW',assistantMessage:'Da, možemo razjasniti posao. Koji materijal želiš?',facts:[],dialogue:dialogue(),...options.output};
  if(!Object.hasOwn(output,'classificationShadowJson')&&!options.catalogFailure)output.classificationShadowJson=JSON.stringify([proposal()]);
  const fetch=async(url,init={})=>{
    url=String(url);const body=init.body?JSON.parse(init.body):null;calls.push({url,body});
    if(url.endsWith('/auth/v1/user'))return json({id:account});
    if(url.includes('/ai_conversations?'))return json([{id:conversation,account_id:account,status:'OPEN',fact_schema_version:'NEED_FACT_V2'}]);
    if(url.endsWith('/rpc_claim_worker_ai_turn_service'))return json({acquired:true,turn:turn('PROCESSING')});
    if(url.endsWith('/rpc_read_worker_ai_context_service'))return json(context);
    if(/\/rpc_ai_claim_need_(?:location_turn_v1|turn_v2)_service$/.test(url))return json({turn:turn('PROCESSING'),claim:{attemptId,
      leaseExpiresAt:new Date(Date.now()+90000).toISOString(),context:{schemaVersion:'NEED_FACT_V2',history:[],activeFacts:options.activeFacts??(options.noServices?[]:[activeFact('need.category',service)])}}});
    if(url.endsWith('/rpc_taxonomy_ai_catalog_context_service')){
      if(options.catalogFailure)return new Response('{}',{status:503});
      const scope=body.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE';
      const start=body.p_after_key===null?0:Number(body.p_after_key),eligible=scope==='REMOTE'||options.onSite?items:[];
      const page=eligible.slice(start,start+body.p_limit),next=start+page.length;
      return json({action:'CATALOG_CONTEXT',scope,catalogVersion:7,catalogFingerprint:'a'.repeat(32),items:page,
        nextAfter:next<eligible.length?String(next):null,classificationAuthority:'NONE',notificationAuthority:'NONE'});
    }
    if(url.endsWith('/rpc_ai_test_budget_reserve_service'))return json({admitted:true,reservationId:id(8),replay:false,code:'AI_TEST_RESERVED'});
    if(url.endsWith('/rpc_dispatch_worker_ai_turn_service'))return json({dispatched:true,turn:turn('PROCESSING')});
    if(url.endsWith('/rpc_ai_dispatch_need_turn_v2_service'))return json(true);
    if(url.startsWith('https://generativelanguage.googleapis.com/')){
      const data={candidates:[{content:{parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}]};
      return options.location?json(data):new Response('data: '+JSON.stringify(data)+'\n\n',{headers:{'Content-Type':'text/event-stream'}});
    }
    if(url.endsWith('/rpc_complete_worker_ai_turn_service'))return json(turn());
    if(url.endsWith('/rpc_ai_complete_need_turn_v2_service'))return json(turn());
    if(url.endsWith('/rpc_ai_complete_need_location_turn_v1_service'))return json({turn:turn(),location:{version:1,
      promptToken:locationContext.promptToken,reviewRevision:locationContext.reviewRevision,slot:'start',proposalId:locationContext.proposal.id,action:body.p_location_action}});
    if(url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'))return json({action:'HINT_CAPTURED',authority:'NONE'});
    if(url.endsWith('/rpc_taxonomy_ai_scoped_preview_service'))return json({action:'NEEDS_REVIEW'});
    if(url.endsWith('/rpc_ai_test_record_usage_service'))return json({recorded:true});
    if(/\/rpc_(?:ai_fail_need_turn_v2|fail_worker_ai_turn)_service$/.test(url))return json(turn('FAILED'));
    assert.fail('UNEXPECTED_NETWORK_OR_WRITER '+url);
  };
  const load=worker?loadWorkerRecoveryHandler:loadOwnedIntakeHandler;
  const {handler}=load({fetch,env:name=>env[name]});
  return {calls,output,invoke:async()=>{
    const response=await handler(new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer SYNTHETIC',
      Accept:options.location?'application/json':'text/event-stream','Content-Type':'application/json'},body:JSON.stringify({conversationId:conversation,
        clientRequestId:request,text:options.text??'Dopuni samo opis.',...(options.location?{mode:'locationReply',locationContext}:{})})}));
    const body=await response.text();assert.equal(response.status,200,body);
    if(!options.location)assert.equal(JSON.parse(body.trim().split('\n\n').at(-1).slice(6)).kind,'final',body);
    return body;
  }};
}
const provider=f=>f.calls.filter(c=>c.url.startsWith('https://generativelanguage.googleapis.com/'));
const complete=f=>f.calls.find(c=>/\/rpc_(?:complete_worker_ai_turn|ai_complete_need_(?:location_turn_v1|turn_v2))_service$/.test(c.url));
const capture=f=>f.calls.filter(c=>c.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'));
const writtenMessage=f=>complete(f).body.p_output?.assistantMessage??complete(f).body.p_assistant_message;

for(const purpose of ['WORKER_CAPABILITY','NEED_SERVICE'])test(purpose+' sends all 131 nodes and all aliases to the actual provider boundary',async()=>{
  const f=fixture(purpose);await f.invoke();assert.equal(provider(f).length,1);
  const body=provider(f)[0].body;
  const prompt=body.systemInstruction.parts.map(part=>{try{return JSON.parse(part.text);}catch{return null;}}).find(value=>value?.complete===true);
  assert.equal(prompt.totalCategories,131);assert.equal(prompt.shortlisted,false);assert.equal(prompt.categories.length,131);
  assert.deepEqual(prompt.categories.map(row=>row.id),items.map(row=>row.categoryId));
  assert.equal(prompt.categories.at(-1).parentId,root.categoryId);assert.deepEqual(prompt.categories.at(-1).aliases,items.at(-1).aliases);
  assert.ok(body.generationConfig.responseSchema.required.includes('classificationShadowJson'));
  assert.equal(capture(f).length,1);assert.equal(capture(f)[0].body.p_proposals[0].categoryId,categoryId);
  assert.ok(f.calls.indexOf(capture(f)[0])>f.calls.indexOf(complete(f)));
  assert.ok(!f.calls.some(c=>/save_worker|publish|commit_admission|ensure_path|push/.test(c.url)));
});

test('task map confirmation keeps the full metadata schema, candidate and explicit point decision',async()=>{
  const f=fixture('NEED_SERVICE',{location:true,onSite:true,text:'Da, to je mesto.',output:{assistantMessage:'Mesto je potvrđeno za pregled.',
    classificationShadowJson:JSON.stringify([proposal({mode:'ON_SITE'})]),
    locationDecision:{action:'CONFIRM_DISPLAYED',proposalId:locationContext.proposal.id,explicitConfirmation:true,hasCorrection:false,hasUncertainty:false}}});
  const result=await f.invoke();assert.ok(provider(f)[0].body.generationConfig.responseSchema.required.includes('classificationShadowJson'));
  assert.equal(complete(f).body.p_location_action,'CONFIRM_DISPLAYED');assert.equal(capture(f).length,1);
  assert.ok(!result.includes('PRIVATE_SYNTHETIC_ADDRESS'));assert.ok(!result.includes('PRIVATE_SYNTHETIC_QUERY'));
});

for(const shadow of ['[]',JSON.stringify([proposal({mode:'UNCONFIRMED'})])])
test('worker saved mode continuity clears resolved feedback on finish: '+shadow,async()=>{
  const f=fixture('WORKER_CAPABILITY',{saved:true,text:'To je to.',output:{classificationShadowJson:shadow}});await f.invoke();
  assert.deepEqual(capture(f)[0].body.p_proposals.map(p=>p.mode),['REMOTE']);
  assert.match(writtenMessage(f),/Otvori pregled profila/);
  assert.doesNotMatch(writtenMessage(f),/kod klijenta|još nije provereno|još treba razjasniti/);
  assert.deepEqual(complete(f).body.p_output.patch,{});assert.equal(provider(f).length,1);
});

test('an actual ambiguous worker service preserves useful prose and remains uncaptured',async()=>{
  const message='Oprema je sačuvana u nacrtu. Koji posao tačno podrazumevaš?';
  const f=fixture('WORKER_CAPABILITY',{output:{assistantMessage:message,classificationShadowJson:JSON.stringify([proposal({action:'ASK_CLARIFICATION',categoryId:''})])}});
  await f.invoke();assert.equal(writtenMessage(f),message);assert.equal(capture(f).length,0);assert.equal(provider(f).length,1);
});

for(const text of ['To je to.','To su delovi za ukras.'])test('task classification ambiguity stays a question through the actual finish guard: '+text,async()=>{
  const message='Razumem namenu. Da li treba izrada predmeta ili samo model za štampu?';
  const f=fixture('NEED_SERVICE',{text,output:{assistantMessage:message,
    dialogue:text==='To je to.'?dialogue('REVIEW'):{...dialogue('CLARIFY'),questionKey:'need.description'},
    classificationShadowJson:JSON.stringify([proposal({action:'ASK_CLARIFICATION',categoryId:''})])}});
  await f.invoke();assert.match(writtenMessage(f),/\?/);assert.doesNotMatch(writtenMessage(f),/Otvori pregled zadatka/);
  if(text!=='To je to.')assert.equal(writtenMessage(f),message,'ordinary semantic question is not replaced by generic classification copy');
  assert.deepEqual(complete(f).body.p_proposals,[]);assert.equal(capture(f).length,0);assert.equal(provider(f).length,1);
});

test('saved continuity does not conceal an unsatisfied explicit delivery change',async()=>{
  const text='Od sada ovu uslugu nudim samo kod klijenta.';
  const f=fixture('WORKER_CAPABILITY',{saved:true,text,output:{
    classificationShadowJson:JSON.stringify([proposal({mode:'UNCONFIRMED'})]),
    serviceModeChangesJson:JSON.stringify([{service,modes:['ON_SITE'],evidence:text}])}});
  await f.invoke();assert.deepEqual(capture(f)[0].body.p_proposals.map(p=>p.mode),['REMOTE']);
  assert.match(writtenMessage(f),/kod klijenta/);
  assert.ok(!f.calls.some(c=>/save_worker|set_worker_execution_modes/.test(c.url)));
});

test('restoring one saved service does not clear a new unresolved service',async()=>{
  const unresolved='Izrada posebnih maketa';
  const f=fixture('WORKER_CAPABILITY',{saved:true,output:{patch:{skills:[service,unresolved]},
    classificationShadowJson:JSON.stringify([proposal({service:unresolved,mode:'UNCONFIRMED',action:'NEEDS_REVIEW',categoryId:''})])}});
  await f.invoke();assert.deepEqual(capture(f)[0].body.p_proposals.map(p=>p.service),[service]);
  assert.match(writtenMessage(f),/Izrada posebnih maketa/);
  assert.ok(!writtenMessage(f).includes(`„${service}“ nudiš`));
  assert.deepEqual(complete(f).body.p_output.patch.skills,[service,unresolved]);
});

for(const purpose of ['WORKER_CAPABILITY','NEED_SERVICE'])for(const noServices of [false,true])
test(purpose+' unavailable catalog is explicit even at finish, noServices='+noServices,async()=>{
  const f=fixture(purpose,{catalogFailure:true,noServices,text:'To je to.',output:purpose==='NEED_SERVICE'?{dialogue:dialogue('REVIEW')}:undefined});
  await f.invoke();assert.match(writtenMessage(f),/nije provereno|čeka proveru|nije dostupan/);
  assert.equal(capture(f).length,0);assert.equal(provider(f).length,1);
});
