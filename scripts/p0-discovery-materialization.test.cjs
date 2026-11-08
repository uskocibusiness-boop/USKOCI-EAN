'use strict';
// Execute the actual captured DEV function before/after the exact guarded patch.
// Reuse the real PostgreSQL ACL/RLS and matcher fixture from R05. Geography is a
// bounded fixture here: these tests do not prove PostGIS plans or hosted capacity.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const sql=name=>fs.readFileSync(path.join(__dirname,'sql',name),'utf8');
const preimage=JSON.parse(sql('p0_discovery_materialization_20261108.preimage.json'));
const forward=sql('p0_discovery_materialization_20261108.sql');
const rollback=sql('p0_discovery_materialization_20261108.rollback.sql');
const source=fs.readFileSync(path.join(__dirname,'r05-discovery-contract.test.cjs'),'utf8');
const parsed=ts.createSourceFile('fixture.cjs',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
const firstTest=parsed.statements.find(n=>ts.isExpressionStatement(n)&&ts.isCallExpression(n.expression)&&n.expression.expression.getText(parsed)==='test');
assert.ok(firstTest);
const baseline=new Function('require','__dirname',source.slice(0,firstTest.getStart(parsed))+'\nreturn {fixture,filter,page,clean,id,A,B,C,N,D,OTHER,CLOSED};')(require,__dirname);
const {filter,page,clean,id,A,B,C,N,D,OTHER,CLOSED}=baseline;

test('P0 Discovery executes filter pushdown with full wire/authority parity',async t=>{
 const f=await baseline.fixture(),{db,actor,value,raw,add}=f;
 try {
  await db.exec(preimage.definition);
  const metadata=()=>value(`select to_jsonb(p) as value from pg_proc p where oid='public.rpc_discovery_v1(jsonb)'::regprocedure`);
  const original=await metadata();
  await t.test('guard rejects unexpected body and restores transaction atomically',async()=>{
   await db.exec('begin');await db.exec(preimage.definition.replace('declare','declare /* changed */'));
   await assert.rejects(db.exec(forward),e=>e.message==='P0_DISCOVERY_PREIMAGE_DRIFT');
   await db.exec('rollback');assert.deepEqual(await metadata(),original);
  });
  await t.test('forward/rollback preserve every metadata field, ACL and data row',async()=>{
   const rows=await value('select jsonb_agg(to_jsonb(n) order by id) as value from public.needs n');
   await db.exec(forward);const after=await metadata();
   const {prosrc:oldBody,...oldMeta}=original,{prosrc:newBody,...newMeta}=after;
   assert.notEqual(oldBody,newBody);assert.deepEqual(newMeta,oldMeta);
   assert.deepEqual(await value('select jsonb_agg(to_jsonb(n) order by id) as value from public.needs n'),rows);
   await db.exec(rollback);assert.deepEqual(await metadata(),original);
   await assert.rejects(db.exec(rollback),e=>e.message==='P0_DISCOVERY_ROLLBACK_DRIFT');
  });
  const compare=async(request,who=B)=>{
   await db.exec('reset role');await db.exec(preimage.definition);await actor(who);
   const before=await raw(request);
   await db.exec('reset role');await db.exec(forward);await actor(who);
   const after=await raw(before.anchor?{...request,anchor:before.anchor}:request);
   assert.deepEqual(clean(after),clean(before));
   return {before,after};
  };
  await t.test('PAGE keeps WHAT WHERE PRICE PEOPLE ForMe filtering and global availability',async()=>{
   for(const change of [{},{where:'remote'},{where:'onsite'}, {price:'OFFERS'}, {price:'MY_PRICE',minBudgetRsd:1100},
    {text:'Lektura'}, {text:'НИШ'}, {place:'Nis'}, {places:3}, {forMe:true},
    {forMe:true,where:'onsite',places:2,minBudgetRsd:1000}, {text:'absent-result',where:'remote'}]){
    const {after}=await compare(page(change,{limit:2}));
    assert.deepEqual(after.availability.priceModes,['MY_PRICE','OFFERS']);
    assert.equal(after.availability.hasKnownWorkMode,true);
   }
  });
  await t.test('WHEN preserves undated rows and anchored civil day boundaries',async()=>{
   for(const when of ['today','tomorrow','week','weekend','next7'])await compare(page({when}));
   await compare(page({dates:{from:'2099-01-01',to:'2099-01-02'}}));
  });
  await t.test('AREA/POINT page scopes preserve global totals and unlocated tail',async()=>{
   const scopes=[{kind:'AREA',bounds:[21,43,22,44]},{kind:'AREA',bounds:[170,-90,-170,90]},
    {kind:'POINT_LIST',point:{lat:43.32,lng:21.9}},{kind:'POINT_MEMBERS',point:{lat:43.32,lng:21.9}}];
   for(const scope of scopes)await compare(page({}, {scope,limit:2}));
  });
  await t.test('stable keyset pagination has no duplicates or omissions including equal timestamps',async()=>{
   await db.exec('reset role');await db.query('update public.needs set published_at=statement_timestamp()-interval \'1 hour\' where id=any($1::uuid[])',[[id(2),id(3),id(4)]]);
   const first=(await compare(page({}, {limit:2}))).before;
   const ids=first.items.map(x=>x.id);let prev=first;
   while(prev.hasMore){prev=(await compare(page({}, {limit:2,anchor:first.anchor,after:prev.nextCursor}))).before;ids.push(...prev.items.map(x=>x.id));}
   assert.equal(new Set(ids).size,ids.length);
   assert.deepEqual(ids,(await compare(page())).before.items.map(x=>x.id));
  });
  await t.test('MAP keeps wholeBounds and global counts even for tiny or antimeridian viewport',async()=>{
   for(const bounds of [[-180,-90,180,90],[21,43,22,44],[0,0,0.1,0.1],[170,-90,-170,90]]){
    for(const change of [{},{forMe:true,minBudgetRsd:1000},{where:'remote'}])
     await compare({mode:'MAP',filter:filter(change),anchor:null,bounds,grid:24});
   }
  });
  await t.test('PLACES preserves CITY/AREA facets, Serbian folding and prefix',async()=>{
   for(const groupBy of ['CITY','AREA'])for(const prefix of ['','Nis','НИШ'])
    await compare({mode:'PLACES',filter:filter({forMe:true,minBudgetRsd:1000}),anchor:null,prefix,facetArea:null,limit:1,after:null,groupBy});
  });
  await t.test('MAP and PLACES with selective filters and any-time do not expose PAGE availability',async()=>{
   for(const change of [{where:'remote'},{where:'onsite'},{price:'MY_PRICE'},{price:'OFFERS'},{minBudgetRsd:1000}]){
    const map=await compare({mode:'MAP',filter:filter(change),anchor:null,bounds:[-180,-90,180,90],grid:24});
    const places=await compare({mode:'PLACES',filter:filter(change),anchor:null,prefix:'',facetArea:null,limit:30,after:null});
    assert.equal(Object.hasOwn(map.before,'availability'),false);assert.equal(Object.hasOwn(map.after,'availability'),false);
    assert.equal(Object.hasOwn(places.before,'availability'),false);assert.equal(Object.hasOwn(places.after,'availability'),false);
   }
  });
  await t.test('EXACT_PUBLIC still denies draft, closed and other-world tasks; anon and closed account fail',async()=>{
   for(const needId of [N,id(2),D,OTHER,CLOSED])await compare({mode:'EXACT_PUBLIC',needId});
   for(const who of [A,B,C])await compare(page(),who);
   await actor(B);
   for(const query of ['select * from public.needs','select remaining_search_close_reason from public.needs'])
    await assert.rejects(db.query(query),e=>e.code==='42501');
   await db.exec("set fixture.closed='true'");await assert.rejects(raw(page()),e=>e.message==='ACCOUNT_CLOSING');
   await db.exec("set fixture.closed='false'");await actor(null,'anon');await assert.rejects(raw(page()),e=>e.code==='42501');
   await actor(null);await assert.rejects(raw(page()),e=>e.message==='AUTH_REQUIRED');
  });
  await t.test('selective query computes schedule projections only for candidates, with equal full response',async()=>{
   await db.exec('reset role');
   const columns=JSON.parse(sql('r05_discovery_contract_20261107.preimage.json')).needsState.columns.map(c=>c.name).filter(n=>n!=='approx_geog');
   const template=await value('select to_jsonb(n) as value from public.needs n where id=$1',[N]);
   await db.query(`insert into public.needs(${columns.join(',')}) select ${columns.map(n=>'x.'+n).join(',')}
    from generate_series(1000,10999) g(i) cross join lateral jsonb_populate_record(null::public.needs,$1::jsonb||jsonb_build_object(
    'id',md5('discovery-scale-'||g.i)::uuid,'title','Synthetic capacity fixture '||g.i,
    'mode',case when g.i%500=0 then 'MY_PRICE' else 'OFFERS' end,
    'execution_location_mode',case when g.i%500=0 then 'STATIONARY' else 'REMOTE' end)) x`,[template]);
   const days=await value("select pg_get_functiondef('public.p6_discovery_days(text,timestamptz,timestamptz,text,timestamptz)'::regprocedure) as value");
   await db.exec(days.replace('public.p6_discovery_days(','public.p0_original_discovery_days('));
   await db.exec(`create sequence public.p0_discovery_days_calls minvalue 0 start 0;
    grant usage,select on sequence public.p0_discovery_days_calls to authenticated;
    create or replace function public.p6_discovery_days(kind text,starts timestamptz,ends timestamptz,zone text,anchor_at timestamptz)
    returns text[] language plpgsql stable set search_path=pg_catalog as $$begin
     perform nextval('public.p0_discovery_days_calls');
     return public.p0_original_discovery_days(kind,starts,ends,zone,anchor_at);end$$;`);
   const request=page({price:'MY_PRICE',where:'onsite',text:'Synthetic capacity'},{limit:50});
   const measure=async(optimized,anchor=null,query=request)=>{
    await db.exec('reset role');await db.exec(preimage.definition);if(optimized)await db.exec(forward);
    await db.exec('alter sequence public.p0_discovery_days_calls restart with 0');await actor(B);
    const result=await raw({...query,anchor});
    const calls=await value('select case when is_called then last_value+1 else 0 end::int as value from public.p0_discovery_days_calls');
    return {result,calls};
   };
   const before=await measure(false),after=await measure(true,before.result.anchor);
   assert.deepEqual(clean(after.result),clean(before.result));
   assert.equal(after.result.items.length,20);
   assert.ok(before.calls>=10000,`baseline must execute all projections, got ${before.calls}`);
   assert.ok(after.calls<=50,`pushdown must only project candidates plus global availability, got ${after.calls}`);
   const allBefore=await measure(false,null,page()),allAfter=await measure(true,allBefore.result.anchor,page());
   assert.deepEqual(clean(allAfter.result),clean(allBefore.result));
   assert.equal(allAfter.calls,allBefore.calls,'unfiltered PAGE must reuse base, not compute another global schedule traversal');
   for(const query of [
    {mode:'MAP',filter:filter({price:'MY_PRICE',where:'onsite'}),anchor:null,bounds:[-180,-90,180,90],grid:24},
    {mode:'PLACES',filter:filter({price:'MY_PRICE',where:'onsite'}),anchor:null,prefix:'',facetArea:null,limit:30,after:null}]){
    const modeBefore=await measure(false,null,query),modeAfter=await measure(true,modeBefore.result.anchor,query);
    assert.deepEqual(clean(modeAfter.result),clean(modeBefore.result));
    assert.equal(modeBefore.calls,0);assert.equal(modeAfter.calls,0,'any-time MAP/PLACES must not evaluate schedule availability');
   }
   await db.exec('reset role');
   const fixtureRows=Number(await value('select count(*) as value from public.needs'));
   t.diagnostic(JSON.stringify({fixtureRows,matched:20,scheduleHelperCalls:{before:before.calls,after:after.calls},
    note:'Isolated PostgreSQL WASM fixture; real RPC/filter/RLS, no PostGIS or hosted latency claim.'}));
  });
 }finally{await db.close();}
});
