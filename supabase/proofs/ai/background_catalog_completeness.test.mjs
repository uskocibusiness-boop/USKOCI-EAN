// R04: the actual background loader with synthetic catalog RPC pages only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadFullCatalogTree} from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const cat=(n,parentId=null,isLeaf=true)=>({
  categoryId:id(n),parentId,isLeaf,label:'Usluga '+n,
  aliases:[],modes:['REMOTE'],path:['Usluga '+n],pathIds:[id(n)]
});
const snapshot=(version,items)=>({catalogVersion:version,catalogFingerprint:'a'.repeat(32),
  count:items.length,categories:items});
function paged(version,roots,children={},overrides={}){
 const calls=[];
 const rpc=async(name,args)=>{
   calls.push({name,args});
   if(name==='rpc_taxonomy_fetch_snapshot_v1')throw new Error('SYNTHETIC_SNAPSHOT_NOT_DEPLOYED');
   assert.equal(name,'rpc_taxonomy_query_catalog_service');
   const q=args.p_query;
   if(q.operation==='META')return {catalogVersion:version,catalogFingerprint:'a'.repeat(32)};
   const list=q.operation==='ROOTS'?roots:children[q.categoryId]??[];
   const start=q.cursor?Number(q.cursor.split(':').at(-1)):0;
   const items=list.slice(start,start+q.limit),next=start+items.length;
   const result={operation:q.operation,scope:'ALL',catalogVersion:version,
     catalogFingerprint:'a'.repeat(32),count:items.length,items,
     nextCursor:next<list.length?q.operation+':'+next:null};
   return overrides.page?.(result,q,calls)??result;
 };
 return {rpc,calls};
}
test('authoritative complete snapshots replace a prior same-version cached tree',async()=>{
 const version=9100001,first=[cat(1)],second=[cat(1),cat(2)];
 let current=first;
 const rpc=async name=>{
   assert.equal(name,'rpc_taxonomy_fetch_snapshot_v1');
   return {ok:true,data:snapshot(version,current)};
 };
 assert.equal((await loadFullCatalogTree(rpc)).categories.length,1);
 current=second;
 assert.equal((await loadFullCatalogTree(rpc)).categories.length,2);
});
test('drains ROOTS and CHILDREN nextCursor rather than returning 100 of 130',async()=>{
 const version=9100002,root=cat(1,null,false);
 const roots=[root,...Array.from({length:120},(_,n)=>cat(300+n))];
 const children=Array.from({length:130},(_,n)=>cat(1000+n,root.categoryId));
 const f=paged(version,roots,{[root.categoryId]:children});
 const result=await loadFullCatalogTree(f.rpc);
 assert.equal(result.categories.length,251);
 assert.equal(f.calls.filter(c=>c.args?.p_query?.operation==='ROOTS').length,2);
 assert.equal(f.calls.filter(c=>c.args?.p_query?.operation==='CHILDREN').length,2);
 assert.equal(result.verifiedComplete,true);
});
test('more than six child batches complete instead of being silently truncated',async()=>{
 const version=9100003,root=cat(1,null,false),branch=Array.from({length:210},(_,n)=>cat(1000+n,root.categoryId,false));
 const links={[root.categoryId]:branch};
 for(let i=0;i<branch.length;i++)links[branch[i].categoryId]=[cat(2000+i,branch[i].categoryId)];
 const f=paged(version,[root],links);
 const tree=await loadFullCatalogTree(f.rpc);
 assert.equal(tree.categories.length,421);
 assert.equal(f.calls.filter(x=>x.args?.p_query?.operation==='CHILDREN').length,213);
});
test('repeated nextCursor, wrong version, unreadable page or too many items refuse partial cache',async()=>{
 let calls=0;const root=cat(1,null,false),leaf=cat(2,root.categoryId);
 const failing=paged(9100004,[root],{[root.categoryId]:[leaf]},{
  page(page,q){
    if(q.operation==='CHILDREN'){calls++;if(calls===1)return {...page,nextCursor:'repeat'};
      return {...page,nextCursor:'repeat'};}
    return page;
  }
 });
 await assert.rejects(loadFullCatalogTree(failing.rpc),/FULL_CATALOG_CURSOR_STALLED/);
 const versionDrift=paged(9100005,[root],{[root.categoryId]:[leaf]},{
  page(page,q){return q.operation==='CHILDREN'?{...page,catalogVersion:9100006}:page;}
 });
 await assert.rejects(loadFullCatalogTree(versionDrift.rpc),/FULL_CATALOG_VERSION_CHANGED/);
 const missing=paged(9100007,[root],{[root.categoryId]:[leaf]},{
  page(page,q){return q.operation==='CHILDREN'?{...page,nextCursor:undefined}:page;}
 });
 await assert.rejects(loadFullCatalogTree(missing.rpc),/FULL_CATALOG_PAGE_INVALID/);
 const current=paged(9100004,[root],{[root.categoryId]:[leaf]});
 assert.equal((await loadFullCatalogTree(current.rpc)).categories.length,2,
   'previous failed run must not cache a partial tree with the same metadata');
});
test('invalid snapshot count cannot warm the complete cache and requires a working fallback',async()=>{
 const version=9100008;
 const rpc=async(name,args)=>{
   if(name==='rpc_taxonomy_fetch_snapshot_v1')return {ok:true,data:{...snapshot(version,[cat(1)]),count:2}};
   if(args?.p_query?.operation==='META')return {catalogVersion:version,catalogFingerprint:'a'.repeat(32)};
   throw new Error('SYNTHETIC_FALLBACK_UNAVAILABLE');
 };
 await assert.rejects(loadFullCatalogTree(rpc),/SYNTHETIC_FALLBACK_UNAVAILABLE/);
});
