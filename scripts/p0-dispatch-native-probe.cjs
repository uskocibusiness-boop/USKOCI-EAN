'use strict';
// Reuses the opt-in isolated PostgreSQL17/PostGIS runtime. No hosted connection.
// Native geographies/distance execute here; lineage, saved-area/taxonomy fixtures
// have the same explicit bounds as the R05 test and are not end-to-end matching.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {startFixture,stopFixture}=require('./p0-discovery-native-benchmark.cjs');
const sql=name=>fs.readFileSync(path.join(__dirname,'sql',name),'utf8');
const preimage=JSON.parse(sql('p0_dispatch_saved_areas_20261108.preimage.json'));
const WORKER='60000000-0000-4000-8000-000000000900',B='10000000-0000-4000-8000-000000000002';
const NEED='60000000-0000-4000-8000-000000000004',REMOTE='60000000-0000-4000-8000-000000000002';
async function main(){
 const {db,value}=await startFixture();
 await db.exec(`alter table public.worker_match_preferences add column worker_account_id uuid,
  add column approximate_geog extensions.geography generated always as (case when approximate_lat is null or approximate_lng is null then null
   else extensions.st_setsrid(extensions.st_makepoint(approximate_lng::double precision,approximate_lat::double precision),4326)::extensions.geography end) stored,
  add column proactive_notifications boolean default true;
  update public.worker_match_preferences pref set worker_account_id=p.account_id from public.app_profiles p where p.id=pref.worker_profile_id;
  create table public.opportunity_deliveries(need_id uuid,worker_account_id uuid,need_revision integer);
  create table private.fixture_notify_usage(account_id uuid primary key,used integer);
  create function private.worker_notify_room_v1b(uuid,integer) returns boolean language sql stable as $$
   select coalesce((select used from private.fixture_notify_usage where account_id=$1),0)<$2$$;`);
 for(const fn of preimage.functions)await db.exec(fn.definition);
 const candidate=(need=NEED,limit=10,cap=10)=>db.query('select * from private.candidate_profile_ids_v1b($1,$2,$3)',[need,limit,cap]).then(r=>r.rows.map(x=>x.worker_profile_id));
 const canonical=(need=NEED)=>db.query('select * from private.candidate_profile_ids($1,10)',[need]).then(r=>r.rows.map(x=>x.worker_profile_id));
 const checks=[];const check=async(name,run)=>{await run();checks.push({name,passed:true});};
 const distance=await value('select extensions.st_distance(n.approx_geog,pref.approximate_geog) as value from public.needs n join public.worker_match_preferences pref on pref.worker_profile_id=$2 where n.id=$1',[NEED,WORKER]);
 await check('native PostGIS far-pin exceeds300km, canonical matcher admits saved area',async()=>{
  assert.ok(distance>300000);assert.equal(await value('select private.worker_need_match_v1($1,$2) as value',[NEED,WORKER]),true);
  assert.deepEqual(await canonical(),[WORKER]);assert.deepEqual(await candidate(),[]);
 });
 await db.exec(sql('p0_dispatch_saved_areas_20261108.sql'));
 await check('capped reader now retains the same saved-area worker',async()=>assert.deepEqual(await candidate(),[WORKER]));
 await check('all physical execution modes retain parity',async()=>{
  for(const mode of ['STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED']){
   await db.query('update public.needs set execution_location_mode=$2 where id=$1',[NEED,mode]);assert.deepEqual(await candidate(),await canonical());
  }
  await db.query("update public.needs set execution_location_mode='STATIONARY' where id=$1",[NEED]);
 });
 await check('REMOTE retains the canonical reader result',async()=>assert.deepEqual(await candidate(REMOTE),await canonical(REMOTE)));
 await check('near and absent pins do not duplicate the saved-area worker',async()=>{
  for(const [lat,lng]of[[43.32,21.90],[null,null],[46.10,19.66]]){
   await db.query('update public.worker_match_preferences set approximate_lat=$2,approximate_lng=$3 where worker_profile_id=$1',[WORKER,lat,lng]);
   assert.deepEqual(await candidate(),[WORKER]);assert.deepEqual(await candidate(),await canonical());
  }
 });
 await check('daily cap still rejects and null cap still delegates',async()=>{
  await db.query('insert into private.fixture_notify_usage values($1,10)',[B]);assert.deepEqual(await candidate(),[]);
  assert.deepEqual(await candidate(NEED,10,null),[WORKER]);await db.exec('truncate private.fixture_notify_usage');
 });
 await check('revision-aware delivery deduplication is unchanged',async()=>{
  await db.query('insert into public.opportunity_deliveries values($1,$2,1)',[NEED,B]);assert.deepEqual(await candidate(),[]);
  await db.query('update public.needs set revision=2 where id=$1',[NEED]);assert.deepEqual(await candidate(),[WORKER]);
  await db.query('update public.needs set revision=1 where id=$1',[NEED]);await db.exec('truncate public.opportunity_deliveries');
 });
 await check('actual rollback restores the previous capped result',async()=>{
  await db.exec(sql('p0_dispatch_saved_areas_20261108.rollback.sql'));assert.deepEqual(await candidate(),[]);assert.deepEqual(await canonical(),[WORKER]);
 });
 const result={capturedAt:new Date().toISOString(),postgres:await value('select version() as value'),postgis:await value('select extensions.postgis_full_version() as value'),
  farPinDistanceMeters:distance,checks,limitations:['Isolated native PostgreSQL/PostGIS, synthetic accounts/tasks only; no hosted deployment, push delivery or concurrency test.',
   'Actual candidate bodies, cheap gate and canonical fit/match execute. Work-area geometry/taxonomy and account lineage remain the explicitly bounded R05 fixture; no claim of full matcher end-to-end or spatial index performance.']};
 const output=process.argv[2];if(!output)throw new Error('Pass a receipt path');
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(stopFixture);
