import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectGeminiClassificationShadow} from '../../functions/_shared/classificationGeminiShadow.mjs';
import {recoverWorkerExistingIdentity,preserveWorkerServiceModes,workerServiceModeInstruction} from '../../functions/_shared/workerServiceModeContext.mjs';
const parent='11111111-1111-4111-8111-111111111111',category='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const canonical='Izrada prezentacija',quote='Radim od kuće.';
function fixture(){
 const catalog={catalogVersion:7,catalogFingerprint:'a'.repeat(32),categories:[
  {id:parent,label:'Digitalne usluge',parentId:null,path:['Digitalne usluge'],isLeaf:false,modes:['ON_SITE'],aliases:[]},
  {id:category,label:canonical,parentId:parent,path:['Digitalne usluge',canonical],isLeaf:true,modes:['REMOTE'],aliases:[]}],
  navigation:{kind:'SERVER_QUERIES',identityChecks:[{service:'izrada prezentacija',categoryIds:[category]}],searchedServices:['izrada prezentacija']}};
 const proposal={service:canonical,mode:'REMOTE',action:'CREATE_CHILD',categoryId:'',parentId:parent,proposedPath:[canonical],
  reason:'The person explicitly offers presentation work from home.',catalogVersion:7,handoff:{required:false}};
 const raw={assistantMessage:'Podaci su u nacrtu.',safety:'ALLOW',patch:{skills:[canonical]},classificationShadowJson:JSON.stringify([proposal]),
  serviceModeChangesJson:JSON.stringify([{service:canonical,modes:['REMOTE'],evidence:quote,handoff:{required:false}}])};
 const context={revision:1,candidate:{skills:[]},messages:[{role:'USER',body:`Izrađujem prezentacije. ${quote}`}]};
 const modeContext={schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:1,savedServices:[],draftServices:[],unresolvedServices:[]};
 return {raw,catalog,context,modeContext};
}
function recover(f){
 const {serviceModeChangesJson:_metadata,...input}=f.raw;
 const inspection=inspectGeminiClassificationShadow(input,f.catalog,'WORKER_CAPABILITY');
 return recoverWorkerExistingIdentity({...f,inspection});
}
function planOf(f){return JSON.parse(f.raw.classificationShadowJson)[0];}
function setPlan(f,plan){f.raw.classificationShadowJson=JSON.stringify([plan]);}

test('observed existing presentation CREATE becomes same-ID REMOTE reuse without requiring ancestor REMOTE',()=>{
 const f=fixture(),before=structuredClone(f),r=recover(f);assert.equal(r.recoveredCount,1);assert.deepEqual(f,before);
 const plan=JSON.parse(r.output.classificationShadowJson)[0];assert.deepEqual(plan,{...planOf(f),action:'REUSE_EXISTING',categoryId:category,parentId:'',proposedPath:[]});
 const {serviceModeChangesJson:_metadata,...raw}=r.output;
 const inspected=inspectGeminiClassificationShadow(raw,f.catalog,'WORKER_CAPABILITY');assert.deepEqual(inspected.statuses,['REUSE_CANDIDATE']);
 const guarded=preserveWorkerServiceModes({...f,raw:r.output,hints:inspected.reviewProposals});
 assert.equal(guarded.hints.length,1);assert.equal(guarded.hints[0].categoryId,category);assert.equal(guarded.hints[0].mode,'REMOTE');
 assert.deepEqual(r.output.patch,before.raw.patch);assert.equal(r.output.assistantMessage,before.raw.assistantMessage);
});
test('registered alias preserves the offered label and server ID without adding an alias',()=>{
 const f=fixture(),alias='Prezentacije po narudžbini';f.catalog.categories[1].aliases=[alias];
 f.catalog.navigation.identityChecks=[{service:'prezentacije po narudžbini',categoryIds:[category]}];
 f.raw.patch.skills=[alias];setPlan(f,{...planOf(f),service:alias,proposedPath:[alias]});
 f.raw.serviceModeChangesJson=JSON.stringify([{service:alias,modes:['REMOTE'],evidence:quote,handoff:{required:false}}]);
 const r=recover(f);assert.equal(r.recoveredCount,1);assert.equal(JSON.parse(r.output.classificationShadowJson)[0].service,alias);
});
for(const mutation of ['duplicate_global_identity','alias_collision','stale_plan_version','stale_context_revision','missing_fingerprint','no_global_exact','unsupported_leaf_mode','unregistered_synonym','no_explicit_mode','wrong_requested_mode','invented_quote','handoff_mismatch','duplicate_proposal','unsafe','malformed'])
test('exact recovery fails closed: '+mutation,()=>{
 const f=fixture();
 if(mutation==='duplicate_global_identity')f.catalog.navigation.identityChecks[0].categoryIds.push(other);
 if(mutation==='alias_collision')f.catalog.categories.push({id:other,label:'Druga usluga',parentId:null,path:['Druga usluga'],isLeaf:true,modes:['REMOTE'],aliases:[canonical]});
 if(mutation==='stale_plan_version')setPlan(f,{...planOf(f),catalogVersion:6});
 if(mutation==='stale_context_revision')f.modeContext.revision=0;
 if(mutation==='missing_fingerprint')delete f.catalog.catalogFingerprint;
 if(mutation==='no_global_exact')f.catalog.navigation.identityChecks=[];
 if(mutation==='unsupported_leaf_mode')f.catalog.categories[1].modes=['ON_SITE'];
 if(mutation==='unregistered_synonym')f.catalog.categories[1].label='Slična ali druga usluga';
 if(mutation==='no_explicit_mode')f.raw.serviceModeChangesJson='[]';
 if(mutation==='wrong_requested_mode')f.raw.serviceModeChangesJson=JSON.stringify([{service:canonical,modes:['ON_SITE'],evidence:quote}]);
 if(mutation==='invented_quote')f.raw.serviceModeChangesJson=JSON.stringify([{service:canonical,modes:['REMOTE'],evidence:'PRIVATE_FAKE_QUOTE'}]);
 if(mutation==='handoff_mismatch')f.raw.serviceModeChangesJson=JSON.stringify([{service:canonical,modes:['REMOTE'],evidence:quote,handoff:{required:true,shippingCountries:['RS']}}]);
 if(mutation==='duplicate_proposal')f.raw.classificationShadowJson=JSON.stringify([planOf(f),planOf(f)]);
 if(mutation==='unsafe')f.raw.safety='REVIEW';
 if(mutation==='malformed')setPlan(f,{...planOf(f),invented:true});
 const r=recover(f);assert.equal(r.recoveredCount,0);assert.equal(r.output,f.raw);
});
test('existing source-bound same mode and handoff can establish choice without a new quote',()=>{
 const f=fixture();f.raw.serviceModeChangesJson='[]';f.context.candidate.skills=[canonical];
 f.modeContext.draftServices=[{service:canonical,categoryId:category,mode:'REMOTE',handoff:{required:false}}];
 assert.equal(recover(f).recoveredCount,1);
});
test('initial explicit mode for each new service is instructed as a quoted proposal, not consent',()=>{
 const prompt=workerServiceModeInstruction(fixture().modeContext);
 assert.ok(prompt.includes('INITIAL delivery mode'));assert.ok(prompt.includes('one declaration per service'));
 assert.ok(prompt.includes('All changes remain proposals for the signed profile review and explicit Save'));
});
