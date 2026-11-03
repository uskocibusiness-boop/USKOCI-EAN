// Current single-response path through the exact handlers; synthetic transports.
// Former tool paging/direct-reply tests are retained in fixtures/retired-*.
// No live model accuracy, DEV persistence, Publish or activation is claimed here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {singlePassFixture,id,decision,category,service,user} from './single_pass_edge_fixture.mjs';
const json=value=>Response.json(value);
const root={categoryId:id(999),parentId:null,label:'Specijalne usluge',aliases:[],modes:[],path:['Specijalne usluge'],isLeaf:false};
const items=[root,...Array.from({length:130},(_,n)=>({categoryId:id(1000+n),parentId:root.categoryId,
 label:n===129?service:`Usluga broj ${n}`,aliases:Array.from({length:15},(_,a)=>`Sinonim ${n} broj ${a}`),modes:['REMOTE','ON_SITE'],
 path:[root.label,n===129?service:`Usluga broj ${n}`],isLeaf:true}))];
const target=items.at(-1).categoryId;
const choice=patch=>({...decision(),categoryId:target,...patch});
function fixture(kind,options={}){
 return singlePassFixture(kind,{...options,decisions:options.decisions??[choice()],rpc:(name,body,init)=>{
  if(name==='rpc_taxonomy_fetch_snapshot_v1')return options.catalogUnavailable?new Response('{}',{status:503}):json({catalogVersion:7,
   catalogFingerprint:'a'.repeat(32),count:items.length,categories:items});
  if(name==='rpc_taxonomy_store_classification_turn_hint_service')return json({stored:true,draftRevision:body.p_draft_revision});
  return options.rpc?.(name,body,init);
 }});
}
const providers=f=>f.calls.filter(c=>c.url.includes('generativelanguage.googleapis.com'));
const atomic=f=>f.calls.filter(c=>c.name.includes('with_first_plan_service'));
const complete=f=>f.calls.find(c=>/rpc_(ai_complete_need_turn_v2|complete_worker_ai_turn)_service/.test(c.name));
const fact=(fact_key,fact_value)=>({fact_key,fact_value,value_type:typeof fact_value==='object'?'OBJECT':'TEXT',display_value:JSON.stringify(fact_value),
 fact_schema_version:'NEED_FACT_V2',status:'CONFIRMED',source:'USER_TEXT',created_at:'2026-11-03T00:00:00Z'});
const remote=fact('need.task_geography',{mode:'REMOTE'});
const pickup={required:true,localExchange:{countryCode:'RS',city:'Novi Sad'}};
for(const kind of ['NEED','WORKER']){
 test(kind+' sees all 131 nodes including last alias in one response and sends exact ID only to server',async()=>{
  const f=fixture(kind),events=await f.invoke();assert.equal(events.at(-1).kind,'final');
  const model=providers(f)[0].body,tree=JSON.stringify(model.systemInstruction);
  assert.ok(tree.includes(target));assert.ok(tree.includes(items.at(-1).aliases.at(-1)));assert.ok(tree.includes(root.categoryId));
  assert.equal(model.tools,undefined);assert.equal(providers(f).length,1);
  assert.equal(f.calls.filter(c=>c.name==='rpc_taxonomy_fetch_snapshot_v1').length,1);
  assert.equal(f.calls.filter(c=>c.name==='rpc_ai_test_budget_reserve_service').length,1);
  assert.equal(f.calls.filter(c=>c.name==='rpc_ai_test_record_usage_service').length,1);
  assert.equal(atomic(f).length,1);assert.equal(atomic(f)[0].body.p_taxonomy_plan.proposals[0].categoryId,target);
  assert.deepEqual(atomic(f)[0].body.p_taxonomy_plan.anchors,[{categoryId:target,label:service,parentId:root.categoryId},
   {categoryId:root.categoryId,label:root.label,parentId:null}]);
  assert.ok(!JSON.stringify(events).includes(target));assert.ok(!JSON.stringify(events).includes('taxonomyDecisions'));
  assert.ok(!f.calls.some(c=>/query_catalog|capture_gemini|publish|save_worker|push/.test(c.name)));
 });
 for(const action of ['CREATE_CHILD','CREATE_NEW_BRANCH'])test(kind+' '+action+' sends complete anchored plan without user taxonomy administration',async()=>{
  const f=fixture(kind,{decisions:[choice({action,categoryId:'',parentId:action==='CREATE_CHILD'?root.categoryId:'',proposedPath:[service]})]});
  const events=await f.invoke();assert.equal(events.at(-1).kind,'final');assert.equal(atomic(f).length,1);
  const plan=atomic(f)[0].body.p_taxonomy_plan;assert.equal(plan.proposals[0].action,action);
  assert.deepEqual(plan.proposals[0].proposedPath,[service]);assert.equal(plan.anchors.length,action==='CREATE_CHILD'?1:0);
  assert.ok(!JSON.stringify(events).includes(action));assert.equal(providers(f).length,1);
 });
 for(const [label,decisions] of [['missing',[]],['invented ID',[choice({categoryId:id(888)})]],
  ['nonleaf ID',[choice({categoryId:root.categoryId})]],['duplicate',[choice(),choice()]],
  ['unsolicited metadata',[{...choice(),handoff:{required:false}}]]])
 test(kind+' '+label+' cannot bind or promise a completed review, useful facts remain',async()=>{
  const f=fixture(kind,{decisions,output:kind==='WORKER'?{assistantMessage:'Otvorite pregled profila.'}:{assistantMessage:'Otvorite pregled zadatka.'}});
  const events=await f.invoke();assert.equal(events.at(-1).kind,'final');assert.equal(atomic(f).length,0);assert.ok(complete(f));
  assert.equal(providers(f).length,1);assert.ok(!events.filter(e=>e.kind==='text_delta').some(e=>/^Otvorite pregled/.test(e.text)));
 });
 test(kind+' unavailable tree preserves useful dialogue but cannot authorize a new branch',async()=>{
  const f=fixture(kind,{catalogUnavailable:true,decisions:[choice({action:'CREATE_NEW_BRANCH',categoryId:'',proposedPath:[service]})]});
  const events=await f.invoke();assert.equal(events.at(-1).kind,'final');assert.equal(atomic(f).length,0);assert.ok(complete(f));
  assert.equal(providers(f).length,1);
 });
 test(kind+' real work ambiguity keeps a question and no classification authority',async()=>{
  const question='Da li želite lekturu ili prevođenje teksta?';
  const f=fixture(kind,{output:{assistantMessage:question},decisions:[choice({action:'NEEDS_CLARIFICATION',categoryId:'',ambiguityPrompt:question})]});
  const events=await f.invoke();assert.equal(events.at(-1).kind,'final');assert.equal(atomic(f).length,0);
  assert.match(events.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),/\?/);assert.equal(providers(f).length,1);
 });
}
for(const handoff of [undefined,{required:false},pickup])test('NEED physical delivery is the owned typed fact: '+JSON.stringify(handoff),async()=>{
 const f=fixture('NEED',{activeFacts:[remote,...(handoff?[fact('need.handoff',handoff)]:[])]});
 await f.invoke();assert.equal(atomic(f).length,1);assert.deepEqual(atomic(f)[0].body.p_taxonomy_plan.proposals[0].handoff,handoff);
});
test('NEED missing mode keeps independent price/description without inventing on-site consent',async()=>{
 const facts=[['need.category',service],['need.description','Lektura teksta od deset strana.'],['need.price_mode','MY_PRICE'],['need.price_rsd',8000]];
 const f=fixture('NEED',{activeFacts:[],output:{assistantMessage:'Da li se posao obavlja na daljinu ili na lokaciji?',
  facts:facts.map(([key,value])=>({key,valueJson:JSON.stringify(value),displayValue:String(value),evidence:user,confidence:1}))}});
 const events=await f.invoke();assert.equal(events.at(-1).kind,'final');assert.equal(atomic(f).length,0);
 assert.deepEqual(complete(f).body.p_proposals.map(p=>[p.key,p.value]),facts);
});
for(const relation of ['DIFFERENT_TASK','UNCLEAR'])test('NEED '+relation+' cannot attach a new category to the retained task',async()=>{
 const f=fixture('NEED',{activeFacts:[remote,fact('need.category','Prethodni posao')],output:{dialogue:{next:'ANSWER',questionKey:'NONE',taskRelation:relation,priceUnit:'UNSPECIFIED',schedulePattern:'UNSPECIFIED'}}});
 await f.invoke();assert.equal(atomic(f).length,0);assert.deepEqual(complete(f).body.p_proposals,[]);
});
test('WORKER saved natural service identity survives a bio edit without a new model classification',async()=>{
 const saved={service,categoryId:target,mode:'REMOTE',handoff:pickup};
 const f=fixture('WORKER',{decisions:[],output:{patch:{bio:'Dopunjen profesionalni opis.'},serviceModeChangesJson:'[]'},workerContext:{
  candidate:{skills:[service],availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},
  serviceModeContext:{schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:0,savedServices:[saved],draftServices:[],unresolvedServices:[]}}});
 await f.invoke();assert.equal(atomic(f).length,1);assert.equal(atomic(f)[0].body.p_taxonomy_plan.proposals[0].categoryId,target);
 assert.deepEqual(atomic(f)[0].body.p_taxonomy_plan.proposals[0].handoff,pickup);
 assert.equal(atomic(f)[0].body.p_output.patch.bio,'Dopunjen profesionalni opis.');
});
test('WORKER explicit handoff edit keeps the confirmed ID and exact user consent',async()=>{
 const text='Od sada lekturu šaljem poštom u Srbiji.',handoff={required:true,shippingCountries:['RS']};
 const f=fixture('WORKER',{user:text,output:{serviceModeChangesJson:JSON.stringify([{service,modes:['REMOTE'],handoff,evidence:text}])},workerContext:{
  candidate:{skills:[service],availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},
  serviceModeContext:{schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:0,savedServices:[{service,categoryId:target,mode:'REMOTE',handoff:pickup}],draftServices:[],unresolvedServices:[]}}});
 await f.invoke();assert.equal(atomic(f).length,1);const plan=atomic(f)[0].body.p_taxonomy_plan;
 assert.equal(plan.proposals[0].categoryId,target);assert.deepEqual(plan.proposals[0].handoff,handoff);
});
