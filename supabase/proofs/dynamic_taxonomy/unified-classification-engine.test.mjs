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
  const plan=reviewClassificationProposal(input('NEED_SERVICE'),snapshot,proposal('CREATE_NEW_BRANCH',{parentId:null,proposedPath:['Nova legitimna oblast','Časovi umetničkog klizanja']}));
  assert.equal(plan.accepted,false);assert.equal(plan.status,'ADMISSION_REVIEW_REQUIRED');
});
test('new path must end in the service and may contain more than six new nodes',()=>{
  const base={...input('NEED_SERVICE'),service:'Izrada figurica'};
  assert.equal(reviewClassificationProposal(base,snapshot,proposal('CREATE_NEW_BRANCH',
    {parentId:null,proposedPath:['Nove usluge','Drugi zadatak']})).status,'SERVICE_LEAF_MISMATCH');
  assert.equal(reviewClassificationProposal(base,snapshot,proposal('CREATE_NEW_BRANCH',
    {parentId:null,proposedPath:['Jedan','Dva','Tri','Četiri','Pet','Šest','Izrada figurica']})).status,'ADMISSION_REVIEW_REQUIRED');
});
test('parent organizes a new service without conferring or blocking its execution mode',()=>{
  const before=JSON.stringify(snapshot);
  const answer=reviewClassificationProposal({...input('NEED_SERVICE','REMOTE'),service:'Popravka poslate muzičke kutije'},snapshot,
    proposal('CREATE_CHILD',{parentId:repair,proposedPath:['Popravka poslate muzičke kutije']}));
  assert.equal(answer.accepted,false);
  assert.equal(answer.status,'ADMISSION_REVIEW_REQUIRED');
  assert.equal(JSON.stringify(snapshot),before);
  assert.equal(reviewClassificationProposal({...input('NEED_SERVICE','REMOTE'),service:nodes[2].label},snapshot,
    proposal('REUSE_EXISTING',{categoryId:repair})).status,'MODE_NOT_SUPPORTED');
});

test('extending an exact service mode is only a signed admission candidate with the same ID',()=>{
  for (const purpose of ['WORKER_CAPABILITY','NEED_SERVICE']) {
    const before=JSON.stringify(snapshot);
    const answer=reviewClassificationProposal({...input(purpose,'REMOTE'),service:nodes[2].label},snapshot,
      proposal('EXTEND_MODE',{categoryId:repair,reason:'The customer sends the removable skates to the provider for sharpening and return shipment.'}));
    assert.equal(answer.accepted,false);
    assert.equal(answer.status,'ADMISSION_REVIEW_REQUIRED');
    assert.equal(answer.categoryId,repair);
    assert.equal(answer.notificationAuthority,'NONE');
    assert.equal(JSON.stringify(snapshot),before);
  }
});

test('extension cannot bypass identity, current catalog, or mode confirmation',()=>{
  assert.equal(reviewClassificationProposal(input('NEED_SERVICE','REMOTE'),snapshot,
    proposal('EXTEND_MODE',{categoryId:repair})).status,'SEMANTIC_IDENTITY_REVIEW_REQUIRED');
  assert.equal(reviewClassificationProposal(input('NEED_SERVICE'),snapshot,
    proposal('EXTEND_MODE')).status,'MODE_ALREADY_SUPPORTED');
  assert.equal(reviewClassificationProposal({...input('NEED_SERVICE'),mode:null},snapshot,
    proposal('EXTEND_MODE')).status,'MODE_CONFIRMATION_REQUIRED');
  assert.equal(reviewClassificationProposal(input('NEED_SERVICE','REMOTE'),snapshot,
    proposal('EXTEND_MODE',{catalogVersion:6})).status,'STALE_CATALOG');
  const navigated={...snapshot,navigation:{kind:'SERVER_QUERIES',identityChecks:[],searchedServices:[]}};
  assert.equal(reviewClassificationProposal(input('NEED_SERVICE','REMOTE'),navigated,
    proposal('EXTEND_MODE')).status,'GLOBAL_IDENTITY_NOT_VERIFIED');
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
  const data=JSON.parse(prompt);
  for(const node of data.categories) assert.deepEqual(Object.keys(node).sort(),['id','label','modes','parentId']);
});

test('catalog reads beyond the old twenty-page boundary and preserves every alias',async()=>{
  const aliases=Array.from({length:18},(_,i)=>'Registrovani naziv '+i);
  const categories=Array.from({length:2105},(_,i)=>({
    id:`${String(i+1).padStart(8,'0')}-1111-4111-8111-111111111111`,
    label:'Poseban posao '+i,parentId:null,path:['Poseban posao '+i],aliases,
  }));
  const catalog=await loadClassificationCatalog(async(_name,args)=>{
    const offset=Number(args.p_after_key??0);
    const end=Math.min(offset+args.p_limit,categories.length);
    const part=args.p_execution_location_mode==='REMOTE'?[]:categories.slice(offset,end);
    return {...page(args.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',[],null),
      catalogFingerprint:'a'.repeat(32),items:part.map(n=>({...row(n),aliases:n.aliases})),
      nextAfter:part.length&&end<categories.length?String(end):null};
  });
  const prompt=JSON.parse(catalogPromptContext(catalog));
  assert.equal(prompt.complete,true);assert.equal(prompt.shortlisted,false);
  assert.equal(prompt.categories.length,2105);
  assert.deepEqual(prompt.categories.at(-1).aliases,aliases);
});

test('resource exhaustion cannot return a truncated catalog as complete',async()=>{
  await assert.rejects(loadClassificationCatalog(async()=>page('ON_SITE',
    Array.from({length:20},()=>nodes[0])),{maxBytes:1024}),/READ_TOO_LARGE/);
});

test('orphaned or cyclic parents cannot be presented as a complete tree',()=>{
  assert.throws(()=>catalogPromptContext({catalogVersion:7,categories:[
    {...nodes[0],parentId:rental}]}),/INCOMPLETE_ANCESTRY/);
  assert.throws(()=>catalogPromptContext({catalogVersion:7,categories:[
    {...nodes[0],parentId:rental},{...nodes[1],parentId:lesson}]}),/CYCLIC_ANCESTRY/);
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
  await assert.rejects(loadClassificationCatalog(async(_name,args)=>page(args.p_execution_location_mode==='STATIONARY'?'ON_SITE':'REMOTE',nodes.slice(0,1),'repeat',7)),/INVALID_CURSOR|INCOMPLETE_PAGING/);
});
test('default pagination reads beyond 800 categories without silently dropping deep branches',async()=>{
  const deep=Array.from({length:805},(_,index)=>({
    id:`${String(index+1).padStart(8,'0')}-1111-4111-8111-111111111111`,
    label:`Usluga ${index+1}`,parentId:null,path:['Korenski nivo',`Usluga ${index+1}`],
  }));
  let reads=0;
  const catalog=await loadClassificationCatalog(async(_name,args)=>{
    reads++;
    if(args.p_execution_location_mode==='REMOTE')return page('REMOTE',[]);
    const start=args.p_after_key===null?0:Number(args.p_after_key);
    const end=Math.min(start+args.p_limit,deep.length);
    return page('ON_SITE',deep.slice(start,end),end<deep.length?String(end):null);
  });
  assert.equal(catalog.categories.length,805);
  assert.equal(reads,10);
  assert.equal(catalog.categories.at(-1).path.at(-1),'Usluga 805');
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

test('catalog growth beyond 220 exposes every service without word-overlap filtering',()=>{
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
  const prompt=JSON.parse(catalogPromptContext(big));
  assert.equal(prompt.shortlisted,false);
  assert.equal(prompt.totalCategories,341);
  assert.equal(prompt.catalogVersion,91);
  assert.equal(prompt.classificationAuthority,'NONE');
  assert.equal(prompt.categories.length,341);
  assert.ok(prompt.categories.some(x=>x.label==='Izrada unikatnih rukavica'));
  assert.ok(prompt.categories.some(x=>x.id===parent));
  assert.match(prompt.instructions,/COMPLETE current eligible catalog/);
  assert.doesNotMatch(JSON.stringify(prompt),/po meri\./);
});
test('all top-level branches and the deep service remain visible together',()=>{
  const rootId='77777777-7777-4777-8777-777777777777';
  const childId='88888888-8888-4888-8888-888888888888';
  const roots=Array.from({length:240},(_,i)=>({
    id:'aaaaaaaa-aaaa-4aaa-8aaa-'+(i+1).toString(16).padStart(12,'0'),
    label:'Opšta oblast '+String(i).padStart(3,'0'),parentId:null,
    path:['Opšta oblast '+String(i).padStart(3,'0')],modes:['REMOTE'],
  }));
  const catalog={catalogVersion:12,categories:[...roots,
    {id:rootId,label:'Digitalna izrada',parentId:null,path:['Digitalna izrada'],modes:['REMOTE']},
    {id:childId,label:'Izrada 3D figurica',parentId:rootId,
      path:['Digitalna izrada','Izrada 3D figurica'],modes:['REMOTE']},
  ]};
  const prompt=JSON.parse(catalogPromptContext(catalog));
  assert.equal(prompt.shortlisted,false);
  assert.equal(prompt.totalCategories,242);
  assert.equal(prompt.categories.length,242);
  assert.ok(prompt.categories.some(x=>x.id===rootId));
  assert.ok(prompt.categories.some(x=>x.id===childId));
  assert.match(prompt.instructions,/COMPLETE current eligible catalog/);
});
test('full catalog keeps a technical service even when the description has no shared token',()=>{
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
  const prompt=JSON.parse(catalogPromptContext(many));
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
  const prompt=JSON.parse(catalogPromptContext(loaded));
  assert.ok(prompt.categories.some(x=>x.id===deep[39].id));
});
test('full catalog has no unshown category or truncated aliases',()=>{
  const parent='77777777-7777-4777-8777-777777777777';
  const many={catalogVersion:5,categories:[
    {id:parent,label:'Radionica',parentId:null,path:['Radionica'],modes:['ON_SITE']},
    ...Array.from({length:250},(_,i)=>({
      id:'88888888-8888-4888-8888-'+(i+1).toString(16).padStart(12,'0'),
      label:'Usluga '+i,parentId:parent,path:['Radionica','Usluga '+i],modes:['ON_SITE'],
    })),
  ]};
  const result=JSON.parse(catalogPromptContext(many));
  assert.equal(result.categories.length,251);
  assert.equal(result.shortlisted,false);
  assert.match(result.instructions,/missing exact phrase is not proof/);
  assert.ok(result.categories.every(item=>many.categories.some(x=>x.id===item.id)));
});

test('both AI contexts receive every node without enabling category writes',()=>{
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
   const prompt=JSON.parse(catalogPromptContext(big));
   assert.equal(prompt.classificationAuthority,'NONE');
   assert.equal(prompt.categories.length,301);
   assert.ok(prompt.categories.some(x=>x.label==='Izrada pletenih rukavica'));
 }
});
