import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClassificationCatalog, reviewClassificationProposal, catalogPromptContext } from '../../functions/_shared/classificationEngine.mjs';

const lesson = '11111111-1111-4111-8111-111111111111';
const rental = '22222222-2222-4222-8222-222222222222';
const repair = '33333333-3333-4333-8333-333333333333';
const nodes = [
  { id:lesson,label:'Časovi umetničkog klizanja',path:['Sport','Umetničko klizanje','Časovi umetničkog klizanja'],modes:['ON_SITE'],parentId:null },
  { id:rental,label:'Iznajmljivanje klizaljki',path:['Iznajmljivanje','Iznajmljivanje klizaljki'],modes:['ON_SITE'],parentId:null },
  { id:repair,label:'Oštrenje klizaljki',path:['Servis opreme','Oštrenje klizaljki'],modes:['ON_SITE'],parentId:null },
];
const snapshot={catalogVersion:7,categories:nodes};
const input=(purpose,mode='ON_SITE')=>({purpose,mode,service:'Časovi umetničkog klizanja'});
const proposal=(action,overrides={})=>({action,catalogVersion:7,reason:'Clear semantic match',categoryId:lesson,...overrides});
const row=node=>({categoryId:node.id,parentId:node.parentId,label:node.label,path:node.path,isLeaf:true});
const page=(scope,items,nextAfter=null,catalogVersion=7)=>({action:'CATALOG_CONTEXT',scope,items:items.map(row),nextAfter,catalogVersion,classificationAuthority:'NONE',notificationAuthority:'NONE'});
const rpc=async(name,args)=>{
  assert.equal(name,'rpc_taxonomy_ai_catalog_context_service');
  if(args.p_execution_location_mode==='STATIONARY')return page('ON_SITE',nodes);
  if(args.p_execution_location_mode==='REMOTE')return page('REMOTE',[]);
  throw new Error('unexpected mode');
};

test('A/B: worker and need share the exact same existing canonical ID', async()=>{
  const catalog=await loadClassificationCatalog(rpc);
  for(const purpose of ['WORKER_CAPABILITY','NEED_SERVICE']){
    const p=reviewClassificationProposal(input(purpose),catalog,proposal('REUSE_EXISTING'));
    assert.equal(p.accepted,true); assert.equal(p.categoryId,lesson);
    assert.equal(p.requiresOwnerReview,true);
    assert.equal(p.notificationAuthority,'NONE');
  }
});
test('C/D: order independent: same service identity for both directions',()=>{
  const worker=reviewClassificationProposal(input('WORKER_CAPABILITY'),snapshot,proposal('REUSE_EXISTING'));
  const need=reviewClassificationProposal(input('NEED_SERVICE'),snapshot,proposal('REUSE_ALIAS'));
  assert.equal(worker.categoryId,need.categoryId);
});
test('E: synonym path can reuse ID; it is never a second category',()=>{
  assert.equal(reviewClassificationProposal({...input('WORKER_CAPABILITY'),service:'Individualne instrukcije umetničkog klizanja'},snapshot,proposal('REUSE_ALIAS')).categoryId,lesson);
});
test('F: lessons, rental and sharpening are not conflated by common wording',()=>{
  assert.equal(new Set(snapshot.categories.map(x=>x.id)).size,3);
  const ids=[lesson,rental,repair].map(id=>reviewClassificationProposal(input('WORKER_CAPABILITY'),snapshot,proposal('REUSE_EXISTING',{categoryId:id})).categoryId);
  assert.equal(new Set(ids).size,3);
});
test('H: a remote-only request cannot gain on-site competence',()=>{
  const answer=reviewClassificationProposal(input('NEED_SERVICE','REMOTE'),snapshot,proposal('REUSE_EXISTING'));
  assert.equal(answer.accepted,false);assert.equal(answer.status,'MODE_NOT_SUPPORTED');
});
test('novel services: no AI-only auto-creation and no invented parent',()=>{
  assert.equal(reviewClassificationProposal(input('NEED_SERVICE'),snapshot,proposal('CREATE_CHILD',{parentId:'44444444-4444-4444-8444-444444444444',proposedPath:['Sport','Retka usluga']})).status,'UNKNOWN_PARENT_ID');
  const plan=reviewClassificationProposal(input('NEED_SERVICE'),snapshot,proposal('CREATE_NEW_BRANCH',{parentId:null,proposedPath:['Nova legitimna oblast','Retka usluga']}));
  assert.equal(plan.accepted,false);assert.equal(plan.status,'ADMISSION_REVIEW_REQUIRED');
});
test('catalog version must be fresh',()=>{
  assert.equal(reviewClassificationProposal(input('NEED_SERVICE'),snapshot,proposal('REUSE_EXISTING',{catalogVersion:6})).status,'STALE_CATALOG');
});
test('no final category may be a forged UUID',()=>{
  assert.equal(reviewClassificationProposal(input('NEED_SERVICE'),snapshot,proposal('REUSE_EXISTING',{categoryId:'44444444-4444-4444-8444-444444444444'})).status,'UNKNOWN_CANONICAL_ID');
});
test('catalog context is server-only, identity and path, without addresses or owner data',async()=>{
  const result=await loadClassificationCatalog(rpc); const prompt=catalogPromptContext(result);
  assert.match(prompt,/classificationAuthority/);assert.match(prompt,/Časovi umetničkog klizanja/);
  assert.doesNotMatch(prompt,/address|accountId|lat|lng|email/);
});
test('pagination with changing version fails before any plan authority',async()=>{
  await assert.rejects(loadClassificationCatalog(async(_name,args)=>{
    if(args.p_execution_location_mode==='STATIONARY'){
      if(args.p_after_key===null)return page('ON_SITE',nodes.slice(0,1),'next',7);
      return page('ON_SITE',nodes.slice(1),null,8);
    }
    return page('REMOTE',[],null,7);
  }),/STALE_VERSION/);
});
test('incomplete catalog pagination must fail closed',async()=>{
  await assert.rejects(loadClassificationCatalog(async(_name,args)=>page(args.p_execution_location_mode==='STATIONARY'?'ON_SITE':'REMOTE',nodes.slice(0,1),'repeat',7),{maxPages:2}),/INVALID_CURSOR|INCOMPLETE_PAGING/);
});
test('restructure is never silently applied',()=>{
  const p=reviewClassificationProposal(input('NEED_SERVICE'),snapshot,proposal('PROPOSE_RESTRUCTURE',{proposedPath:['Sport','Novi raspored']}));
  assert.equal(p.status,'ADMISSION_REVIEW_REQUIRED');assert.equal(p.accepted,false);
});
