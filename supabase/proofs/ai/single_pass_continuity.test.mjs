// Current pure builder: a single supplied model response and a verified server
// catalog. No provider mock can accidentally hide a second network request.
import test from 'node:test';
import assert from 'node:assert/strict';
import {indexFullCatalog,buildWorkerFullTreeTaxonomyProposals,buildFullTreeTaxonomyProposals}
 from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';
import {singlePassCapturePlan,takeSinglePassTaxonomy} from '../../functions/_shared/singlePassTaxonomy.mjs';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const service='Lektura prirodno opisana',other='Prevod teksta',quote='Lekturu i prevod radim samo online.';
const row=(n,label,extra={})=>({categoryId:id(n),parentId:null,label,aliases:[],modes:['REMOTE','ON_SITE'],isLeaf:true,...extra});
const tree=(rows=[row(1,'Lektura tekstova'),row(2,other)])=>indexFullCatalog(7,'a'.repeat(32),rows,true);
const choice=(label=service,mode='REMOTE',categoryId=id(1))=>({service:label,mode,categoryId});
const decision=(label=service,mode='REMOTE',categoryId=id(1))=>({service:label,mode,action:'REUSE_EXISTING',categoryId,parentId:'',
 proposedPath:[],ambiguityPrompt:'',reason:'Isti smisao posla iz korisničkog razgovora.'});
const change=(label=service,modes=['REMOTE'],extra={})=>({service:label,modes,evidence:quote,...extra});
const build=options=>buildWorkerFullTreeTaxonomyProposals({skills:[service],messages:[{role:'USER',body:quote}],
 serviceModeContext:{savedServices:[choice()],draftServices:[]},conversationId:id(9),draftRevision:3,
 suppliedCatalog:tree(),suppliedDecisions:[],...options});
const projections=result=>result.proposals.map(p=>[p.service,p.categoryId,p.mode]);
for(const scope of ['savedServices','draftServices'])test(scope+' retains a natural service label and exact ID without a synonym or new decision',async()=>{
 const result=await build({serviceModeContext:{savedServices:[],draftServices:[],[scope]:[choice()]}});
 assert.deepEqual(projections(result),[[service,id(1),'REMOTE']]);assert.deepEqual(result.unresolvedServices,[]);
});
test('current resolved draft removes one half of saved BOTH rather than restoring it',async()=>{
 const result=await build({serviceModeContext:{savedServices:[choice(),choice(service,'ON_SITE')],draftServices:[choice()]}});
 assert.deepEqual(projections(result),[[service,id(1),'REMOTE']]);
});
test('service removal cannot be resurrected by saved context or unsolicited model metadata',async()=>{
 const result=await build({skills:[other],serviceModeContext:{savedServices:[choice(),choice(other,'REMOTE',id(2))],draftServices:[]},
 suppliedDecisions:[decision()]});
 assert.deepEqual(projections(result),[[other,id(2),'REMOTE']]);
});
test('multiple offered services keep independent modes, identities and physical handoff',async()=>{
 const handoff={required:true,shippingCountries:['RS']};
 const result=await build({skills:[service,other],serviceModeContext:{savedServices:[{...choice(),handoff},choice(other,'ON_SITE',id(2))],draftServices:[]}});
 assert.deepEqual(projections(result),[[service,id(1),'REMOTE'],[other,id(2),'ON_SITE']]);
 assert.deepEqual(result.proposals[0].handoff,handoff);assert.ok(!Object.hasOwn(result.proposals[1],'handoff'));
});
test('explicit mode correction preserves category identity even if model proposes a different one',async()=>{
 const result=await build({serviceModeChangesJson:JSON.stringify([change(service,['ON_SITE'])]),suppliedDecisions:[decision(service,'ON_SITE',id(2))]});
 assert.deepEqual(result.proposals,[]);assert.ok(result.unresolvedServices.includes(service));
});
test('an owned REMOTE handoff correction keeps the saved category ID',async()=>{
 const handoff={required:true,shippingCountries:['RS']};
 const result=await build({serviceModeChangesJson:JSON.stringify([change(service,['REMOTE'],{handoff})]),suppliedDecisions:[decision()]});
 assert.deepEqual(projections(result),[[service,id(1),'REMOTE']]);assert.deepEqual(result.proposals[0].handoff,handoff);
});
for(const changes of [
 [{...change(),evidence:'Neizgovorena korisnička saglasnost.'}],
 [change(),change(service,['ON_SITE'])],
 [{...change(),modes:['UNKNOWN']}],
])test('invalid fresh mode declaration cannot silently restore saved consent: '+JSON.stringify(changes),async()=>{
 const result=await build({serviceModeChangesJson:JSON.stringify(changes),suppliedDecisions:[decision()]});
 assert.deepEqual(result.proposals,[]);assert.ok(result.unresolvedServices.includes(service));
});
for(const catalog of [tree([row(1,'Lektura tekstova',{modes:['ON_SITE']})]),tree([row(2,other)]),
 tree([row(1,'Lektura tekstova',{isLeaf:false}),row(2,other,{parentId:id(1)})])])
 test('removed mode or missing/non-leaf saved category cannot become a current service',async()=>{
 const result=await build({suppliedCatalog:catalog});assert.deepEqual(result.proposals,[]);assert.ok(result.unresolvedServices.includes(service));
 });
test('semantic reuse accepts an actual catalog ID without a registered natural synonym',async()=>{
 const result=await build({serviceModeContext:{savedServices:[],draftServices:[]},serviceModeChangesJson:JSON.stringify([change()]),suppliedDecisions:[decision()]});
 assert.deepEqual(projections(result),[[service,id(1),'REMOTE']]);
});
test('BOTH with inconsistent category IDs cannot be captured as a complete service',async()=>{
 const catalog=tree();const result=await build({serviceModeContext:{savedServices:[],draftServices:[]},
  serviceModeChangesJson:JSON.stringify([change(service,['REMOTE','ON_SITE'])]),
  suppliedDecisions:[decision(),decision(service,'ON_SITE',id(2))],suppliedCatalog:catalog});
 assert.ok(result.unresolvedServices.includes(service)||!result.proposals.length);
});
test('new nested branch remains a bounded proposal until the owned SQL resolver runs',async()=>{
 const catalog=tree();
 const result=await buildFullTreeTaxonomyProposals({items:[{service:'Digitalna obrada arhiva',mode:'REMOTE'}],suppliedCatalog:catalog,
  suppliedDecisions:[{...decision('Digitalna obrada arhiva'),action:'CREATE_NEW_BRANCH',categoryId:'',proposedPath:['Arhiviranje','Digitalna obrada arhiva']}]});
 assert.equal(result.proposals.length,1);const plan=singlePassCapturePlan(result,catalog);
 assert.deepEqual(plan.proposals[0].proposedPath,['Arhiviranje','Digitalna obrada arhiva']);assert.deepEqual(plan.anchors,[]);
});
for(const entry of [ {...decision(),categoryId:id(999)}, {...decision(),proposedPath:['Izmišljena grana']},
 {...decision(),parentId:id(2)}, {...decision(),mode:'UNKNOWN'}])
 test('invalid reuse metadata cannot become a catalog proposal: '+JSON.stringify(entry),async()=>{
 const result=await build({serviceModeContext:{savedServices:[],draftServices:[]},serviceModeChangesJson:JSON.stringify([change()]),suppliedDecisions:[entry]});
 assert.deepEqual(result.proposals,[]);
 });
test('malformed duplicate metadata is removed as a whole while useful dialogue facts survive',()=>{
 const facts=[{key:'need.category',valueJson:'"Lektura"'}];
 const result=takeSinglePassTaxonomy({assistantMessage:'Razumem.',facts,taxonomyDecisions:[decision(),{...decision(),extra:'INVALID'}]});
 assert.deepEqual(result.decisions,[]);assert.deepEqual(result.output.facts,facts);assert.equal(result.output.taxonomyDecisions,undefined);
});
