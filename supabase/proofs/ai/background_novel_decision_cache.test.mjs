// The removed second-provider decision cache is historical (fixtures/retired-*).
// These are the retained requirements: no stale decision, implicit authority,
// inherited handoff or cross-service reuse. Catalog anchors protect SQL completion.
import test from 'node:test';
import assert from 'node:assert/strict';
import {indexFullCatalog,buildFullTreeTaxonomyProposals as build} from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';
import {singlePassCapturePlan} from '../../functions/_shared/singlePassTaxonomy.mjs';
const ROOT='11111111-1111-4111-8111-111111111111',LEAF='22222222-2222-4222-8222-222222222222';
const service='Izrada drvenog ukrasa';
const nodes=[{categoryId:ROOT,parentId:null,label:'Ručni rad',isLeaf:false,modes:[],aliases:[]},
 {categoryId:LEAF,parentId:ROOT,label:'Ukrasi od drveta',isLeaf:true,modes:['ON_SITE','REMOTE'],aliases:[]}];
const choice={service,mode:'ON_SITE',action:'REUSE_EXISTING',categoryId:LEAF,parentId:'',proposedPath:[],ambiguityPrompt:'',reason:'Isti opisani posao izrade ukrasa.'};
function fixture(t){
 t.mock.method(globalThis,'fetch',()=>assert.fail('Pure decisions never invoke a provider'));
 t.mock.method(console,'warn',()=>{});
 const rows=structuredClone(nodes);
 const catalog=()=>indexFullCatalog(7,'catalog-fingerprint',rows,true);
 const request=(overrides={})=>build({suppliedCatalog:catalog(),suppliedDecisions:[choice],items:[{service,mode:'ON_SITE'}],...overrides});
 return {rows,catalog,request};
}
for(const change of [{},{conversationId:'another-owned-turn',draftRevision:9},{scopeSummary:'Sada tražim drugačiji predmet.'},
 {items:[{service,mode:'REMOTE'}]},{items:[{service:'Drugi posao',mode:'ON_SITE'}]}])
 test('missing current decision cannot reuse a preceding answer: '+JSON.stringify(change),async t=>{
  const f=fixture(t);assert.equal((await f.request()).proposals.length,1);
  const second=await f.request({...change,suppliedDecisions:[]});assert.deepEqual(second.proposals,[]);
  assert.deepEqual(second.clarifications,[],'missing metadata is not a question for the user');
 });
for(const mutate of [rows=>rows.pop(),rows=>{rows[1].isLeaf=false;},rows=>{rows[1].modes=['REMOTE'];}])
 test('removed target, nonleaf target or removed mode cannot retain previous authority '+String(mutate),async t=>{
  const f=fixture(t);await f.request();mutate(f.rows);assert.deepEqual((await f.request()).proposals,[]);
 });
test('changed label and parent are anchored from the current tree, never a previous response',async t=>{
 const f=fixture(t);const first=singlePassCapturePlan(await f.request(),f.catalog());
 f.rows[1].label='Novi naziv iste usluge';f.rows[1].parentId=null;
 const second=singlePassCapturePlan(await f.request(),f.catalog());
 assert.deepEqual(first.anchors,[{categoryId:LEAF,label:'Ukrasi od drveta',parentId:ROOT},{categoryId:ROOT,label:'Ručni rad',parentId:null}]);
 assert.deepEqual(second.anchors,[{categoryId:LEAF,label:'Novi naziv iste usluge',parentId:null}]);
});
test('physical handoff is only the current owned fact, never a model annotation or cached consent',async t=>{
 const f=fixture(t);for(const handoff of [{required:true,shippingCountries:['RS']},undefined,{required:false}]){
  const result=await f.request({items:[{service,mode:'REMOTE',...(handoff?{handoff}:{})}],suppliedDecisions:[{...choice,mode:'REMOTE'}]});
  assert.deepEqual(result.proposals[0].handoff,handoff);
 }
});
test('multi-service decisions never fill in an omitted service on the next turn',async t=>{
 const f=fixture(t),other='Izrada drvenog kalupa';
 const items=[{service,mode:'ON_SITE'},{service:other,mode:'ON_SITE'}];
 assert.equal((await f.request({items,suppliedDecisions:[choice,{...choice,service:other}]})).proposals.length,2);
 const next=await f.request({items,suppliedDecisions:[{...choice,service:other}]});
 assert.deepEqual(next.proposals.map(p=>p.service),[other]);
});
test('new child requires its current real parent and a supplied decision on every turn',async t=>{
 const f=fixture(t),fresh={...choice,action:'CREATE_CHILD',categoryId:'',parentId:ROOT,proposedPath:[service]};
 assert.equal((await f.request({suppliedDecisions:[fresh]})).proposals[0].action,'CREATE_CHILD');
 f.rows.shift();assert.deepEqual((await f.request({suppliedDecisions:[fresh]})).proposals,[]);
});
