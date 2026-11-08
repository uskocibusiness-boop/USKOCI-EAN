'use strict';
// Execute captured candidate enumerators + cheap gate + canonical fit/match.
// The R05 fixture bounds saved-area geometry/taxonomy and uses a geography domain;
// a deterministic latitude distance is sufficient for the >300km regression.
// This is not a PostGIS index/production load or concurrent dispatch proof.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'r05-discovery-contract.test.cjs'),'utf8');
const parsed=ts.createSourceFile('fixture.cjs',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
const firstTest=parsed.statements.find(n=>ts.isExpressionStatement(n)&&ts.isCallExpression(n.expression)&&n.expression.expression.getText(parsed)==='test');
const baseline=new Function('require','__dirname',source.slice(0,firstTest.getStart(parsed))+'\nreturn {fixture,WORKER,OTHER_WORKER,A,B,C,id};')(require,__dirname);
const {WORKER,OTHER_WORKER,A,B,C,id}=baseline;
const sql=name=>fs.readFileSync(path.join(__dirname,'sql',name),'utf8');
const preimage=JSON.parse(sql('p0_dispatch_saved_areas_20261108.preimage.json'));
const forward=sql('p0_dispatch_saved_areas_20261108.sql'),rollback=sql('p0_dispatch_saved_areas_20261108.rollback.sql');

test('P0 capped dispatch preserves saved work areas without weakening match/cap/deduplication',async t=>{
 const {db,value}=await baseline.fixture();
 try{
  await db.exec(`alter table public.worker_match_preferences add column worker_account_id uuid,
   add column approximate_geog extensions.geography generated always as (approximate_lat::text) stored,
   add column proactive_notifications boolean default true;
   update public.worker_match_preferences pref set worker_account_id=p.account_id from public.app_profiles p where p.id=pref.worker_profile_id;
   create function extensions.fixture_distance(extensions.geography,extensions.geography) returns double precision language sql immutable as
    $$select abs($1::numeric-$2::numeric)*111000.0$$;
   create function extensions.st_dwithin(extensions.geography,extensions.geography,double precision) returns boolean language sql immutable as
    $$select extensions.fixture_distance($1,$2)<=$3$$;
   create operator extensions.<->(leftarg=extensions.geography,rightarg=extensions.geography,function=extensions.fixture_distance);
   create table public.opportunity_deliveries(need_id uuid,worker_account_id uuid,need_revision integer);
   create table private.fixture_notify_usage(account_id uuid primary key,used integer);
   create function private.worker_notify_room_v1b(uuid,integer) returns boolean language sql stable as $$
    select coalesce((select used from private.fixture_notify_usage where account_id=$1),0)<$2$$;`);
  for(const fn of preimage.functions){await db.exec(fn.definition);await db.exec('revoke all on function private.'+fn.name+'('+fn.args.split(', ').map(a=>a.split(' ').slice(1).join(' ')).join(',')+') from public');}
  const candidate=(need=id(4),limit=10,cap=10)=>db.query('select * from private.candidate_profile_ids_v1b($1,$2,$3)',[need,limit,cap]).then(r=>r.rows.map(x=>x.worker_profile_id));
  const canonical=(need=id(4),limit=10)=>db.query('select * from private.candidate_profile_ids($1,$2)',[need,limit]).then(r=>r.rows.map(x=>x.worker_profile_id));
  const metadata=()=>value("select to_jsonb(p) as value from pg_proc p where oid='private.candidate_profile_ids_v1b(uuid,integer,integer)'::regprocedure");
  const before=await metadata();
  await t.test('reproduce active capped path omission despite canonical matcher admission and saved area',async()=>{
   assert.equal(await value('select private.worker_need_match_v1($1,$2) as value',[id(4),WORKER]),true);
   assert.ok(await value('select extensions.fixture_distance(n.approx_geog,p.approximate_geog)>300000 as value from public.needs n join public.worker_match_preferences p on p.worker_profile_id=$2 where n.id=$1',[id(4),WORKER]));
   assert.deepEqual(await canonical(),[WORKER]);assert.deepEqual(await candidate(),[]);
   assert.deepEqual(await candidate(id(4),10,null),[WORKER]);
  });
  await t.test('source drift stops the patch; exact forward and rollback preserve metadata and source',async()=>{
   for(const fn of preimage.functions){
    await db.exec('begin');await db.exec(fn.definition.replace('AS $function$','AS $function$\n-- fixture drift\n'));
    await assert.rejects(db.exec(forward),e=>e.message==='P0_DISPATCH_CANDIDATE_PREIMAGE_DRIFT');await db.exec('rollback');
   }
   await db.exec(forward);const after=await metadata();
   const {prosrc:oldBody,...oldMeta}=before,{prosrc:newBody,...newMeta}=after;
   assert.notEqual(oldBody,newBody);assert.deepEqual(newMeta,oldMeta);
   assert.deepEqual(await candidate(),[WORKER]);await db.exec(rollback);assert.deepEqual(await metadata(),before);
   assert.deepEqual(await candidate(),[]);await assert.rejects(db.exec(rollback),e=>e.message==='P0_DISPATCH_CANDIDATE_ROLLBACK_DRIFT');
   await db.exec(forward);
  });
  await t.test('all physical modes preserve canonical saved-area candidates and limit order',async()=>{
   for(const mode of ['STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED']){
    await db.query('update public.needs set execution_location_mode=$2 where id=$1',[id(4),mode]);
    assert.deepEqual(await candidate(),await canonical());assert.deepEqual(await candidate(id(4),1),[WORKER]);
   }
   await db.query("update public.needs set execution_location_mode='STATIONARY' where id=$1",[id(4)]);
  });
  await t.test('REMOTE and null-cap delegation keep their existing candidates',async()=>{
   assert.deepEqual(await candidate(id(2)),await canonical(id(2)));
   for(const need of [id(2),id(4),id(5)])assert.deepEqual(await candidate(need,10,null),await canonical(need));
  });
  await t.test('daily cap remains enforced before a candidate consumes the limit',async()=>{
   await db.query('insert into private.fixture_notify_usage values($1,10)',[B]);assert.deepEqual(await candidate(),[]);
   assert.deepEqual(await candidate(id(4),10,null),[WORKER]);
   await db.query('update private.fixture_notify_usage set used=9 where account_id=$1',[B]);assert.deepEqual(await candidate(),[WORKER]);
   assert.deepEqual(await candidate(id(4),10,0),[]);await db.exec('truncate private.fixture_notify_usage');
  });
  await t.test('a capped nearby worker does not consume the limit and hide the saved-area worker',async()=>{
   const account='70000000-0000-4000-8000-000000000001',profile='70000000-0000-4000-8000-000000000002';
   await db.exec('begin');
   try{
    await db.query("insert into private.account_lineage_v5 values($1,'TEST')",[account]);
    await db.query("insert into public.app_profiles(id,account_id,kind) values($1,$2,'WORKER')",[profile,account]);
    await db.query("insert into private.fixture_saved_areas values($1,'[{\"city\":\"Niš\"}]')",[account]);
    await db.query("insert into public.worker_match_preferences(worker_profile_id,worker_account_id,approximate_lat,approximate_lng,timezone) values($1,$2,43.32,21.90,'Europe/Belgrade')",[profile,account]);
    await db.query('insert into private.fixture_notify_usage values($1,10)',[account]);
    assert.deepEqual(await canonical(),[profile,WORKER]);assert.deepEqual(await candidate(id(4),1,10),[WORKER]);
    await db.query('update private.fixture_notify_usage set used=9 where account_id=$1',[account]);
    assert.deepEqual(await candidate(id(4),1,10),[profile]);assert.deepEqual(await candidate(id(4),2,10),[profile,WORKER]);
   }finally{await db.exec('rollback');}
  });
  await t.test('no saved area, inactive profile, notification opt-out, or other world still denies',async()=>{
   for(const [change,restore]of[
    ["update private.fixture_saved_areas set areas='[]' where account_id=$1","update private.fixture_saved_areas set areas='[{\"city\":\"Niš\"}]' where account_id=$1"],
    ["update public.app_profiles set profile_status='DRAFT' where account_id=$1","update public.app_profiles set profile_status='ACTIVE' where account_id=$1"],
    ["update public.worker_match_preferences set proactive_notifications=false where worker_account_id=$1","update public.worker_match_preferences set proactive_notifications=true where worker_account_id=$1"]]){
    await db.query(change,[B]);assert.deepEqual(await candidate(),[]);await db.query(restore,[B]);
   }
   assert.equal((await candidate()).includes(OTHER_WORKER),false);
  });
  await t.test('delivery deduplication remains revision-aware',async()=>{
   await db.query('insert into public.opportunity_deliveries values($1,$2,1)',[id(4),B]);assert.deepEqual(await candidate(),[]);
   await db.query('update public.needs set revision=2 where id=$1',[id(4)]);assert.deepEqual(await candidate(),[WORKER]);
   await db.query('update public.needs set revision=1 where id=$1',[id(4)]);await db.exec('truncate public.opportunity_deliveries');
  });
  await t.test('nearby and absent-pin paths do not duplicate candidates',async()=>{
   for(const lat of [43.32,null,46.10]){
    await db.query('update public.worker_match_preferences set approximate_lat=$2 where worker_profile_id=$1',[WORKER,lat]);
    assert.deepEqual(await candidate(),await canonical());assert.equal((await candidate()).length,1);
   }
  });
  await t.test('missing task and invalid limits return no candidates',async()=>{
   assert.deepEqual(await candidate(id(9999)),[]);
   for(const limit of [0,-1,null])assert.deepEqual(await candidate(id(4),limit),[]);
  });
 }finally{await db.close();}
});
