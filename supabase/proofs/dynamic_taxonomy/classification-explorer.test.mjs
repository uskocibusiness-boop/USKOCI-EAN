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

test('direct reply eligibility requires every existing service in current server evidence',async()=>{
  assert.equal((await createClassificationExplorer(fixture().rpc)).canTryDirectReply(),false);
  for (const seed of [service.label,service.aliases[0]]) {
    const x=await createClassificationExplorer(fixture().rpc,{seedServices:[seed]});
    assert.equal(x.canTryDirectReply(),true);
  }
  const missing=await createClassificationExplorer(fixture().rpc,{seedServices:[service.label,'Druga nepoznata usluga']});
  assert.equal(missing.canTryDirectReply(),false);
  const duplicate=child(3,'Druga konkretna usluga',[service.label]);
  const ambiguous=await createClassificationExplorer(fixture({searchItems:[service,duplicate]}).rpc,{seedServices:[service.label]});
  assert.equal(ambiguous.canTryDirectReply(),false);
});

test('direct eligibility cannot replace fresh global identity validation',async()=>{
  const duplicate=child(3,'Druga konkretna usluga',[service.label]);
  const f=fixture({searchItems:[service],exact:[service,duplicate]});
  const x=await createClassificationExplorer(f.rpc,{seedServices:[service.label]});
  assert.equal(x.canTryDirectReply(),true);
  assert.equal(evaluate(await x.verify(raw(plan())),plan()).accepted,false);
  f.change();
  await assert.rejects(x.verify(raw(plan())),/STALE/);
  assert.throws(()=>x.canTryDirectReply(),/INCOMPLETE/);
});

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

const turn=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function controlled(f,shouldHold){
  const pending=[];let active=0,peak=0;
  const rpc=async(name,args)=>{
    const answer=await f.rpc(name,args),q=args.p_query;
    if(!shouldHold(q))return answer;
    const gate=deferred(),entry={q,answer,done:false,
      release(){if(!entry.done){entry.done=true;gate.resolve();}},
      reject(error){if(!entry.done){entry.done=true;gate.reject(error);}}};
    pending.push(entry);active++;peak=Math.max(peak,active);
    try{await gate.promise;return answer;}finally{active--;}
  };
  return {rpc,pending,get peak(){return peak;},releaseAll(){pending.forEach(p=>p.release());}};
}

test('META fences parallel bootstrap roots, saved IDs and seeds with stable prompt order and bounded concurrency',async()=>{
  const f=fixture(),c=controlled(f,q=>q.operation!=='META');
  const seeds=['3D štampa','Izrada maketa','Digitalni crteži','Izrada figurica','Modelovanje'];
  const opening=createClassificationExplorer(c.rpc,{seedServices:seeds,seedCategoryIds:[service.categoryId]});
  await turn();
  assert.equal(f.calls[0].operation,'META');
  assert.deepEqual(c.pending.map(p=>p.q.operation),['ROOTS','RESOLVE','SEARCH','SEARCH']);
  assert.ok(c.pending.every(p=>p.q.catalogVersion===7&&p.q.catalogFingerprint==='a'.repeat(32)));
  // A completed independent seed starts the next job without waiting for ROOTS.
  c.pending[3].release();await turn();
  assert.equal(c.pending.at(-1).q.text,seeds[2]);
  assert.equal(c.pending[0].done,false);
  for(let n=0;n<4;n++){c.releaseAll();await turn();}
  const x=await opening,pages=JSON.parse(x.prompt()).pages;
  assert.deepEqual(pages.map(p=>p.operation),['ROOTS',...seeds.map(()=> 'SEARCH'),'RESOLVE']);
  assert.equal(c.peak,4);
});

test('verification resolves IDs alongside paged EXACT and waits for every exact hit before fresh META',async()=>{
  const exact=Array.from({length:65},(_,n)=>child(n+10,`Radionička usluga ${n}`,['3D štampa']));
  const f=fixture({exact}),c=controlled(f,q=>['EXACT','RESOLVE'].includes(q.operation));
  const x=await createClassificationExplorer(c.rpc);
  const p=plan({service:'3D štampa',categoryId:exact.at(-1).categoryId,action:'REUSE_ALIAS'});
  const verifying=x.verify(raw(p));await turn();
  assert.deepEqual(c.pending.map(p=>p.q.operation),['RESOLVE','EXACT']);
  c.pending[0].release();await turn();
  assert.equal(f.calls.filter(q=>q.operation==='META').length,1);
  c.pending[1].release();await turn();
  assert.equal(c.pending.at(-1).q.cursor,'exact-32');
  assert.equal(f.calls.filter(q=>q.operation==='META').length,1);
  c.pending.at(-1).release();await turn();
  assert.equal(c.pending.at(-1).q.cursor,'exact-64');
  assert.equal(f.calls.filter(q=>q.operation==='META').length,1);
  c.pending.at(-1).release();
  const snapshot=await verifying;
  assert.equal(snapshot.navigation.identityChecks[0].categoryIds.length,65);
  assert.equal(evaluate(snapshot,p).status,'AMBIGUOUS_CANONICAL_IDENTITY');
  assert.equal(f.calls.at(-1).operation,'META');
});

test('identical in-flight searches spend one query and one response budget but retain each service research tag',async()=>{
  const f=fixture(),c=controlled(f,q=>q.operation==='SEARCH');
  const x=await createClassificationExplorer(c.rpc,{maxQueries:4});
  const before=x.evidenceBytes;
  const a=x.execute({operation:'SEARCH',text:'3D',service:'Izrada maketa'});
  const b=x.execute({service:'Izrada figurica',text:'3D',operation:'SEARCH'});
  await turn();assert.equal(c.pending.length,1);assert.equal(x.queryCount,3);
  c.releaseAll();await Promise.all([a,b]);
  assert.equal(x.evidenceBytes-before,new TextEncoder().encode(JSON.stringify(c.pending[0].answer)).byteLength);
  const snapshot=await x.verify({});
  assert.ok(snapshot.navigation.searchedServices.includes('izrada maketa'));
  assert.ok(snapshot.navigation.searchedServices.includes('izrada figurica'));
  assert.equal(x.queryCount,4);
});

test('overlapping verifications share exact/resolve reads but never share their final fresh META',async()=>{
  const f=fixture();let hold=false;
  const c=controlled(f,()=>hold),x=await createClassificationExplorer(c.rpc,{maxQueries:6});hold=true;
  const a=x.verify(raw(plan())),b=x.verify(raw(plan()));await turn();
  assert.equal(c.pending.length,2);
  assert.equal(f.calls.filter(q=>q.operation==='EXACT').length,1);
  assert.equal(f.calls.filter(q=>q.operation==='RESOLVE').length,1);
  c.releaseAll();await turn();
  assert.equal(c.pending.filter(p=>p.q.operation==='META').length,2);
  assert.equal(x.queryCount,6);
  c.releaseAll();
  for(const snapshot of await Promise.all([a,b]))assert.equal(evaluate(snapshot,plan()).accepted,true);
});

test('a stale peer invalidates verification and late valid pages cannot restore a successful snapshot',async()=>{
  const f=fixture({transform:(a,q)=>q.operation==='RESOLVE'?{...a,catalogFingerprint:'b'.repeat(32)}:a});
  const c=controlled(f,q=>['EXACT','RESOLVE'].includes(q.operation)),x=await createClassificationExplorer(c.rpc);
  const rejected=assert.rejects(x.verify(raw(plan())),/STALE/);await turn();
  c.pending.find(p=>p.q.operation==='RESOLVE').release();await rejected;
  c.releaseAll();await turn();
  assert.equal(f.calls.filter(q=>q.operation==='META').length,1);
  await assert.rejects(x.verify(raw(plan())),/INCOMPLETE/);
});

test('alias-only change at final META rejects completed parallel identity evidence',async()=>{
  const f=fixture({transform:(a,q,calls)=>q.operation==='META'&&calls.filter(c=>c.operation==='META').length>1
    ?{...a,catalogFingerprint:'b'.repeat(32)}:a});
  const x=await createClassificationExplorer(f.rpc);
  await assert.rejects(x.verify(raw(plan())),/STALE/);
  assert.ok(f.calls.some(q=>q.operation==='EXACT'));assert.ok(f.calls.some(q=>q.operation==='RESOLVE'));
  assert.equal(f.calls.at(-1).operation,'META');
  await assert.rejects(x.execute({operation:'SEARCH',text:'3D'}),/INCOMPLETE/);
});

test('RPC timeout stops queued research jobs and late siblings cannot authorize a retry snapshot',async()=>{
  const f=fixture(),c=controlled(f,q=>['EXACT','RESOLVE'].includes(q.operation));
  const x=await createClassificationExplorer(c.rpc);
  const rejected=assert.rejects(x.verify(raw(plan()),{services:Array.from({length:8},(_,n)=>`Nova usluga ${n}`)}),/RPC_TIMEOUT/);
  await turn();assert.equal(c.pending.length,4);const calls=f.calls.length;
  c.pending[0].reject(new Error('RPC_TIMEOUT'));await rejected;
  c.releaseAll();await turn();
  assert.equal(f.calls.length,calls,'no queued job or final META starts after timeout');
  await assert.rejects(x.verify(raw(plan())),/INCOMPLETE/);
});

test('research cancellation rejects all late parallel responses and starts no remaining work',async()=>{
  const f=fixture(),controller=new AbortController(),c=controlled(f,q=>['EXACT','RESOLVE'].includes(q.operation));
  const x=await createClassificationExplorer(c.rpc,{signal:controller.signal});
  const rejected=assert.rejects(x.verify(raw(plan())),/CANCELLED/);await turn();
  controller.abort();c.releaseAll();await rejected;await turn();
  assert.equal(f.calls.filter(q=>q.operation==='META').length,1);
  await assert.rejects(x.execute({operation:'SEARCH',text:'3D'}),/CANCELLED/);
});

test('conflicting same-ID nodes from parallel responses still invalidate the entire explorer',async()=>{
  const f=fixture({transform:(a,q)=>q.operation==='RESOLVE'?{...a,items:a.items.map(n=>({...n,label:'Promenjena usluga',path:[root.label,'Promenjena usluga']}))}:a});
  const c=controlled(f,q=>['EXACT','RESOLVE'].includes(q.operation)),x=await createClassificationExplorer(c.rpc);
  const rejected=assert.rejects(x.verify(raw(plan())),/CONFLICTING_NODE/);await turn();
  c.pending.find(p=>p.q.operation==='EXACT').release();await turn();
  c.pending.find(p=>p.q.operation==='RESOLVE').release();await rejected;
  await assert.rejects(x.verify(raw(plan())),/INCOMPLETE/);
});
