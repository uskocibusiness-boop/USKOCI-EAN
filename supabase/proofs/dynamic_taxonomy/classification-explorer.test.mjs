import test from 'node:test';
import assert from 'node:assert/strict';
import { createClassificationExplorer } from '../../functions/_shared/classificationExplorer.mjs';
import { reviewClassificationProposal } from '../../functions/_shared/classificationEngine.mjs';

const id = n => `${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const root={categoryId:id(1),label:'Digitalne usluge',parentId:null,aliases:[],modes:['REMOTE'],path:['Digitalne usluge'],pathIds:[id(1)],isLeaf:false};
const child=(n,label,aliases=[])=>({categoryId:id(n),label,parentId:root.categoryId,aliases,modes:['REMOTE'],
  path:[root.label,label],pathIds:[root.categoryId,id(n)],isLeaf:true});
const service=child(2,'3D printovanje',['3D štampa']);
const plan=(patch={})=>({service:service.label,mode:'REMOTE',action:'REUSE_EXISTING',categoryId:service.categoryId,parentId:'',proposedPath:[],
  reason:'Tačna postojeća usluga na aktuelnom katalogu.',catalogVersion:7,...patch});
const raw=p=>({classificationShadowJson:JSON.stringify([p])});
const evaluate=(snapshot,p)=>reviewClassificationProposal({purpose:'NEED_SERVICE',service:p.service,mode:p.mode},snapshot,p);
function fixture(options={}) {
  const calls=[];let version=7,digest='a'.repeat(32);
  const rpc=async(name,{p_query:q})=>{
    calls.push(q);assert.equal(name,'rpc_taxonomy_query_catalog_service');
    if(q.catalogVersion!==undefined && (q.catalogVersion!==version||q.catalogFingerprint!==digest))throw Error('STALE');
    let items=[],nextCursor=null;
    if(q.operation==='ROOTS')items=[root];
    if(q.operation==='SEARCH') { items=options.searchItems??[service]; nextCursor=options.searchMore&&!q.cursor?'search-next':null; }
    if(q.operation==='EXACT') {
      const all=(options.exact??[service]).filter(row=>row.label===q.text||row.aliases.includes(q.text));
      const start=q.cursor?Number(q.cursor.split('-').at(-1)):0;
      items=all.slice(start,start+q.limit);nextCursor=start+items.length<all.length?'exact-'+(start+items.length):null;
    }
    if(q.operation==='RESOLVE') {
      const all=[root,service,...(options.exact??[])].filter((row,index,rows)=>q.categoryIds.includes(row.categoryId)&&rows.findIndex(r=>r.categoryId===row.categoryId)===index);
      const start=q.cursor?Number(q.cursor.split('-').at(-1)):0;
      items=all.slice(start,start+q.limit);nextCursor=start+items.length<all.length?'resolve-'+(start+items.length):null;
    }
    const answer={schemaVersion:'TAXONOMY_CATALOG_QUERY_V1',action:'CATALOG_QUERY',operation:q.operation,scope:q.scope,
      catalogVersion:version,catalogFingerprint:digest,count:items.length,items,nextCursor,
      classificationAuthority:'NONE',capabilityAuthority:'NONE',notificationAuthority:'NONE'};
    return options.transform?options.transform(answer,q,calls):answer;
  };
  return {rpc,calls,change(){version++;digest='b'.repeat(32);},aliasChange(){digest='b'.repeat(32);}};
}

test('bootstrap is explicit partial context and exact identity is verified outside model pages',async()=>{
  const f=fixture(),x=await createClassificationExplorer(f.rpc);
  const prompt=JSON.parse(x.prompt());assert.equal(prompt.complete,false);assert.equal(prompt.pages[0].items.length,1);
  assert.ok(!x.prompt().includes(service.categoryId));
  const snapshot=await x.verify(raw(plan()));
  assert.equal(evaluate(snapshot,plan()).accepted,true);
  assert.ok(f.calls.some(q=>q.operation==='EXACT'));assert.equal(f.calls.at(-1).operation,'META');
  assert.ok(f.calls.slice(1).every(q=>q.catalogVersion===7&&q.catalogFingerprint==='a'.repeat(32)));
});

test('global alias collision beyond one hundred rows cannot be hidden by model selection',async()=>{
  const exact=Array.from({length:131},(_,n)=>child(n+10,`Radionička usluga ${n}`,['3D štampa']));
  const f=fixture({exact}),x=await createClassificationExplorer(f.rpc,{pageSize:32});
  const p=plan({service:'3D štampa',categoryId:exact.at(-1).categoryId,action:'REUSE_ALIAS'});
  const snapshot=await x.verify(raw(p));
  assert.equal(snapshot.navigation.identityChecks[0].categoryIds.length,131);
  assert.equal(evaluate(snapshot,p).status,'AMBIGUOUS_CANONICAL_IDENTITY');
  assert.equal(f.calls.filter(q=>q.operation==='EXACT').length,5);
});

test('a new branch requires completed global research, not only absent exact spelling',async()=>{
  const f=fixture({exact:[],searchItems:[],searchMore:true}),x=await createClassificationExplorer(f.rpc);
  const p=plan({service:'Izrada taktilnih karata',action:'CREATE_CHILD',categoryId:'',parentId:root.categoryId,proposedPath:['Izrada taktilnih karata']});
  assert.equal(evaluate(await x.verify(raw(p)),p).status,'CATALOG_RESEARCH_REQUIRED');
  const first=await x.execute({operation:'SEARCH',text:'taktiln',service:p.service});
  assert.equal(evaluate(await x.verify(raw(p)),p).status,'CATALOG_RESEARCH_REQUIRED');
  await x.execute({operation:'SEARCH',text:'taktiln',service:p.service,cursor:first.nextCursor});
  assert.equal(evaluate(await x.verify(raw(p)),p).status,'ADMISSION_REVIEW_REQUIRED');
});

test('novelty cannot bypass a global exact or registered-alias identity',async()=>{
  const f=fixture(),x=await createClassificationExplorer(f.rpc);
  await x.execute({operation:'SEARCH',text:'3D',service:service.label});
  const p=plan({action:'CREATE_CHILD',categoryId:'',parentId:root.categoryId,proposedPath:[service.label]});
  assert.equal(evaluate(await x.verify(raw(p)),p).status,'EXISTING_IDENTITY_REQUIRES_REVIEW');
});

for(const change of ['change','aliasChange'])test('catalog change after model inference invalidates verification: '+change,async()=>{
  const f=fixture(),x=await createClassificationExplorer(f.rpc);f[change]();
  await assert.rejects(x.verify(raw(plan())),/STALE/);
  await assert.rejects(x.execute({operation:'SEARCH',text:'3D'}),/INCOMPLETE/);
});

test('unknown cursors and write-shaped tools never reach the RPC',async()=>{
  const f=fixture(),x=await createClassificationExplorer(f.rpc);const count=f.calls.length;
  await assert.rejects(x.execute({operation:'SEARCH',text:'3D',cursor:'forged'}),/UNKNOWN_CURSOR/);
  await assert.rejects(x.execute({operation:'CREATE',text:'3D'}),/INVALID_TOOL/);
  await assert.rejects(x.execute({operation:'SEARCH',text:'3D',accountId:id(999)}),/INVALID_QUERY/);
  assert.equal(f.calls.length,count);
});

test('equivalent reordered tool arguments preserve cursor binding and completed search',async()=>{
  const f=fixture({exact:[],searchItems:[],searchMore:true}),x=await createClassificationExplorer(f.rpc);
  const service='Izrada taktilnih karata';
  const first=await x.execute({operation:'SEARCH',text:'taktiln',scope:'ALL',service});
  await x.execute({scope:'ALL',service,text:'taktiln',cursor:first.nextCursor,operation:'SEARCH'});
  assert.ok((await x.verify({})).navigation.searchedServices.includes('izrada taktilnih karata'));
});

test('canonical writer authority in a purported read response is rejected',async()=>{
  const f=fixture({transform:a=>({...a,notificationAuthority:'SEND'})});
  await assert.rejects(createClassificationExplorer(f.rpc),/INVALID_PAGE/);
});

test('budget failure is incomplete, never a successful empty search',async()=>{
  const f=fixture(),x=await createClassificationExplorer(f.rpc,{maxQueries:2});
  await assert.rejects(x.execute({operation:'SEARCH',text:'3D'}),/QUERY_BUDGET/);
  await assert.rejects(x.verify(raw(plan())),/INCOMPLETE/);
});

test('tool payload omits repeated ancestry but verified nodes retain full paths',async()=>{
  const f=fixture(),x=await createClassificationExplorer(f.rpc);
  const page=await x.execute({operation:'SEARCH',text:'3D'});
  assert.equal(page.items[0].path,undefined);assert.equal(page.items[0].pathIds,undefined);
  assert.deepEqual((await x.verify(raw(plan()))).categories.find(n=>n.id===service.categoryId).path,service.path);
});

test('navigation snapshot without global identity proof cannot reuse a real ID',()=>{
  const snapshot={catalogVersion:7,categories:[{id:service.categoryId,label:service.label,modes:service.modes,aliases:service.aliases}],
    navigation:{kind:'SERVER_QUERIES',identityChecks:[],searchedServices:[]}};
  assert.equal(evaluate(snapshot,plan()).status,'GLOBAL_IDENTITY_NOT_VERIFIED');
});

test('saved and proposed IDs beyond the first page are all resolved',async()=>{
  const exact=Array.from({length:65},(_,n)=>child(n+10,`Posebna usluga ${n}`));
  const ids=exact.map(n=>n.categoryId);
  const f=fixture({exact}),x=await createClassificationExplorer(f.rpc,{seedCategoryIds:ids});
  assert.equal(JSON.parse(x.prompt()).pages.filter(p=>p.operation==='RESOLVE').length,3);
  const snapshot=await x.verify({}, {categoryIds:ids});
  assert.ok(ids.every(id=>snapshot.categories.some(n=>n.id===id)));
  assert.equal(f.calls.filter(q=>q.operation==='RESOLVE').length,3,'verification reuses the same fenced pages');
});
