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
  assert.equal(worker.categoryId,lesson);
  assert.equal(need.accepted,false);
  assert.equal(need.status,'ALIAS_EVIDENCE_REQUIRED');
});
test('E: synonym path can reuse ID; it is never a second category',()=>{
  const candidate=reviewClassificationProposal({...input('WORKER_CAPABILITY'),service:'Individualne instrukcije umetničkog klizanja'},snapshot,proposal('REUSE_ALIAS'));
  assert.equal(candidate.accepted,false);
  assert.equal(candidate.status,'ALIAS_EVIDENCE_REQUIRED');
});
test('F: lessons, rental and sharpening are not conflated by common wording',()=>{
  assert.equal(new Set(snapshot.categories.map(x=>x.id)).size,3);
  const ids=nodes.map(node=>reviewClassificationProposal({...input('WORKER_CAPABILITY'),service:node.label},snapshot,proposal('REUSE_EXISTING',{categoryId:node.id})).categoryId);
  assert.equal(new Set(ids).size,3);
  for (const wrongId of [rental,repair]) {
    const result=reviewClassificationProposal(input('WORKER_CAPABILITY'),snapshot,proposal('REUSE_EXISTING',{categoryId:wrongId}));
    assert.equal(result.accepted,false);
    assert.equal(result.status,'SEMANTIC_IDENTITY_REVIEW_REQUIRED');
    assert.equal(result.categoryId,undefined);
  }
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
test('new child cannot inherit a parent from the wrong execution mode',()=>{
  const answer=reviewClassificationProposal(input('NEED_SERVICE','REMOTE'),snapshot,
    proposal('CREATE_CHILD',{parentId:lesson,proposedPath:['Onlajn časovi klizanja']}));
  assert.equal(answer.accepted,false);
  assert.equal(answer.status,'PARENT_MODE_NOT_SUPPORTED');
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

// A model cannot map a superficially similar service to the wrong canonical ID.
test('Latin/Cyrillic representation is the same identity for both AI purposes',()=>{
  for (const purpose of ['WORKER_CAPABILITY','NEED_SERVICE']) {
    const answer=reviewClassificationProposal({purpose,service:'Часови уметничког клизања',mode:'ON_SITE'},snapshot,proposal('REUSE_EXISTING'));
    assert.equal(answer.accepted,true);
    assert.equal(answer.categoryId,lesson);
  }
});
test('unverified synonyms and broad parent words never confer canonical identity',()=>{
  for (const service of ['Privatna nastava klizanja','Klizaljke','Oštrenje klizaljki']) {
    const answer=reviewClassificationProposal({...input('NEED_SERVICE'),service},snapshot,proposal('REUSE_EXISTING'));
    assert.equal(answer.accepted,false);
    assert.equal(answer.status,'SEMANTIC_IDENTITY_REVIEW_REQUIRED');
  }
});

test('catalog growth beyond 220 chooses bounded relevant services without fabricating absence',()=>{
  const parent='77777777-7777-4777-8777-777777777777';
  const services=Array.from({length:340},(_,i)=>{
    const label=i===337?'Izrada unikatnih rukavica':'Usluga iz oblasti '+String(i).padStart(3,'0');
    return {
      id:'88888888-8888-4888-8888-'+(i+1).toString(16).padStart(12,'0'),
      label,parentId:parent,path:['Ručni rad',label],modes:['ON_SITE'],
    };
  });
  const big={catalogVersion:91,categories:[
    {id:parent,label:'Ručni rad',parentId:null,path:['Ručni rad'],modes:['ON_SITE']},
    ...services,
  ]};
  const prompt=JSON.parse(catalogPromptContext(big,{
    maxItems:30,services:['Желим израду уникатних рукавица, по мери.'],
  }));
  assert.equal(prompt.shortlisted,true);
  assert.equal(prompt.totalCategories,341);
  assert.equal(prompt.catalogVersion,91);
  assert.equal(prompt.classificationAuthority,'NONE');
  assert.ok(prompt.categories.length<=30);
  assert.ok(prompt.categories.some(x=>x.label==='Izrada unikatnih rukavica'));
  assert.ok(prompt.categories.some(x=>x.id===parent));
  assert.match(prompt.instructions,/partial relevance shortlist/);
  assert.doesNotMatch(JSON.stringify(prompt),/po meri\./);
});
test('shortlist preserves the technical 3D token when choosing a parent branch',()=>{
  const root='77777777-7777-4777-8777-777777777777';
  const threeD='88888888-8888-4888-8888-888888888888';
  const many={catalogVersion:8,categories:[
    {id:root,label:'Digitalne usluge',parentId:null,path:['Digitalne usluge'],modes:['REMOTE']},
    ...Array.from({length:45},(_,i)=>({
      id:'99999999-9999-4999-8999-'+(i+1).toString(16).padStart(12,'0'),
      label:'Usluga '+String(i).padStart(3,'0'),parentId:root,
      path:['Digitalne usluge','Usluga '+String(i).padStart(3,'0')],modes:['REMOTE'],
    })),
    {id:threeD,label:'3D modelovanje',parentId:root,
      path:['Digitalne usluge','3D modelovanje'],modes:['REMOTE']},
  ]};
  const prompt=JSON.parse(catalogPromptContext(many,{maxItems:25,
    services:['Izrada 3D figurica po narudžbini']}));
  assert.ok(prompt.categories.some(x=>x.id===threeD));
});
test('existing branches deeper than 32 levels remain eligible for AI context',async()=>{
  const deep=Array.from({length:40},(_,i)=>({
    id:'aaaaaaaa-aaaa-4aaa-8aaa-'+(i+1).toString(16).padStart(12,'0'),
    label:i===39?'Izrada posebnih figurica':'Nivo '+String(i+1),
    parentId:i===0?null:'aaaaaaaa-aaaa-4aaa-8aaa-'+i.toString(16).padStart(12,'0'),
    path:Array.from({length:i+1},(_,j)=>j===39?'Izrada posebnih figurica':'Nivo '+String(j+1)),
    modes:['REMOTE'],
  }));
  const loaded=await loadClassificationCatalog(async(_name,args)=>
    page(args.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',
      args.p_execution_location_mode==='REMOTE'?deep:[]));
  assert.equal(loaded.categories.length,40);
  const prompt=JSON.parse(catalogPromptContext(loaded,{maxItems:50,
    services:['Izrada posebnih figurica']}));
  assert.ok(prompt.categories.some(x=>x.id===deep[39].id));
});
test('catalog shortlist never falsely identifies an unshown category as absent',()=>{
  const parent='77777777-7777-4777-8777-777777777777';
  const many={catalogVersion:5,categories:[
    {id:parent,label:'Radionica',parentId:null,path:['Radionica'],modes:['ON_SITE']},
    ...Array.from({length:250},(_,i)=>({
      id:'88888888-8888-4888-8888-'+(i+1).toString(16).padStart(12,'0'),
      label:'Usluga '+i,parentId:parent,path:['Radionica','Usluga '+i],modes:['ON_SITE'],
    })),
  ]};
  const result=JSON.parse(catalogPromptContext(many,{maxItems:25,services:['Sasvim nova usluga']}));
  assert.ok(result.categories.length<=25);
  assert.equal(result.shortlisted,true);
  assert.match(result.instructions,/Never assume absence implies novelty/);
  assert.ok(result.categories.every(item=>many.categories.some(x=>x.id===item.id)));
});

test('the two existing AI contexts may both shortlist without enabling category writes',()=>{
 const big={catalogVersion:15,categories:[
   {id:'11111111-1111-4111-8111-111111111111',
    label:'Ručni rad',parentId:null,path:['Ručni rad'],modes:['ON_SITE']},
   ...Array.from({length:300},(_,i)=>({
    id:'aaaa1111-aaaa-4aaa-8aaa-'+(i+1).toString(16).padStart(12,'0'),
    parentId:'11111111-1111-4111-8111-111111111111',
    label:i===298?'Izrada pletenih rukavica':'Druga usluga '+i,
    path:['Ručni rad',i===298?'Izrada pletenih rukavica':'Druga usluga '+i],
    modes:['ON_SITE'],
   })),
 ]};
 for (const hint of ['Израда плетених рукавица','Izrada pletenih rukavica']) {
   const prompt=JSON.parse(catalogPromptContext(big,{maxItems:96,services:[hint]}));
   assert.equal(prompt.classificationAuthority,'NONE');
   assert.ok(prompt.categories.length<=96);
   assert.ok(prompt.categories.some(x=>x.label==='Izrada pletenih rukavica'));
 }
});
