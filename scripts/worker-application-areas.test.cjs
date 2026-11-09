'use strict';
// Actual three current writer bodies + actual saved-area reader/validator.
// Synthetic review/Save rows; inherited Auth/world/matcher/remote/notifications
// are explicit fixture substitutes. This is not hosted Auth, signed AI or E2E.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createPriceFixture}=require('./r07-price-fixture.cjs');
const stem='worker_application_areas_20261109',read=ext=>fs.readFileSync(path.join(__dirname,'sql',stem+ext),'utf8');
const capture=JSON.parse(read('.preimage.json')),schema=JSON.parse(read('.fixture-schema.json')),source=read('.sql');
const writers=capture.functions.filter(f=>f.name.startsWith('public.'));
const CITY={kind:'CITY',countryCode:'RS',label:'Novi Sad',city:'Novi Sad',sourceRef:'osm:relation:9273976',latitude:45.26,longitude:19.85,radiusKm:null};
const COUNTRY={kind:'COUNTRY',countryCode:'RS',label:'Cela Srbija',city:null,sourceRef:null,latitude:null,longitude:null,radiusKm:null};
async function fixture(){
 const f=await createPriceFixture();try{
  await f.db.exec(f.candidate);
  for(const t of schema.tables)await f.db.exec('create table '+t.name+'('+t.columns.map(c=>'"'+c.name+'" '+c.type+(c.default?' default '+c.default:'')+(c.notNull?' not null':'')).join(',')+')');
  for(const fn of [...writers,...capture.functions.filter(f=>['private.worker_saved_areas_v1','private.validate_worker_areas_v1'].includes(f.name))])await f.db.exec(fn.definition);
  let areaOrdinal=0;
  const areas=async(value,account=f.WORKER,reviewAccount=account)=>{
   const id=crypto.randomUUID();
   await f.db.query("insert into private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,expires_at) values($1,$2,$1,1,'fixture-owned-save',$3,clock_timestamp()+interval '1 day')",[id,reviewAccount,JSON.stringify({profile:{workAreas:value}})]);
   await f.db.query("insert into private.worker_ai_saves(review_id,account_id,client_request_id,receipt,created_at) values($1,$2,$1,'{}',clock_timestamp()+$3::integer*interval '1 second')",[id,account,++areaOrdinal]);
  };
  const profile=patch=>f.db.query('update public.app_profiles p set (city,display_name,skills,profile_status)=(select city,display_name,skills,profile_status from jsonb_populate_record(p,$2)) where id=$1',[f.PROFILE,JSON.stringify(patch)]);
  const stale=async(id,r)=>{await f.db.query('update public.needs set revision=revision+1 where id=$1',[id]);await f.db.query("update public.marketplace_responses set status='STALE_REVIEW_REQUIRED' where id=$1",[r.responseId]);};
  const reset=async()=>{await f.db.exec("delete from private.worker_ai_saves;delete from private.worker_ai_reviews;set test.remote_ready='false';set test.eligible='true';set test.world_mismatch='false'");await profile({city:'',display_name:'Test radnik',skills:['Selidbe'],profile_status:'ACTIVE'});await f.actor(f.WORKER);};
  const need=(basis,amount=1200,required=2,mode='MY_PRICE')=>f.need(basis,amount,required,mode);
  const install=()=>f.db.exec(source);await reset();return {...f,need,areas,profile,stale,reset,install};
 }catch(e){await f.db.close();throw e}
}
let f;
test.before(async()=>{f=await fixture()});test.after(async()=>{if(f)await f.db.close()});
test('exact live preimage rejects valid saved areas at submit, selection and stale reconfirmation',async()=>{
 await f.areas([CITY]);const n=await f.need('TOTAL');
 await assert.rejects(f.submit(n),/WORKER_PROFILE_NOT_READY/);
 await f.profile({city:'Novi Sad'});const r=await f.submit(n);
 await f.profile({city:''});await f.actor(f.REQUESTER);await assert.rejects(f.select(n,r),/WORKER_PROFILE_NOT_READY/);
 await f.actor(f.WORKER);await f.stale(n,r);await assert.rejects(f.resolve(r,2,'KEEP'),/WORKER_PROFILE_NOT_READY/);
});
test('valid CITY, RADIUS and COUNTRY saved areas complete submit → select with immutable unit and replay',async()=>{
 await f.install();
 for(const a of [[CITY],[{...CITY,kind:'RADIUS',label:'Novi Sad · do 20 km',radiusKm:20}],[COUNTRY]]){
  await f.reset();await f.areas(a);const n=await f.need('TOTAL'),key=crypto.randomUUID(),r=await f.submit(n,1200,2,1,key);
  assert.equal(r.authoritative,true);assert.equal(r.applicationPriceBasis,'TOTAL');assert.equal(r.currency,'RSD');
  assert.deepEqual(await f.submit(n,1200,2,1,key),{...r,idempotentReplay:true});
  await f.actor(f.REQUESTER);const k=crypto.randomUUID(),agreement=await f.select(n,r,k);assert.ok(agreement);assert.equal(await f.select(n,r,k),agreement);
  assert.equal(await f.value('select worker_profile_id as value from public.agreements where id=$1',[agreement]),f.PROFILE);
  assert.equal(await f.value('select city as value from public.app_profiles where id=$1',[f.PROFILE]),'');
 }
});
test('saved-area KEEP/UPDATE preserves stale revision admission; WITHDRAW needs no ready profile',async()=>{
 await f.reset();await f.areas([CITY]);const n=await f.need('TOTAL'),r=await f.submit(n);await f.stale(n,r);
 const keep=await f.resolve(r,2,'KEEP');assert.equal(keep.version,2);assert.equal(keep.applicationPriceBasis,'TOTAL');
 await f.stale(n,keep);const update=await f.resolve(keep,3,'UPDATE',600,1);assert.equal(update.version,3);
 await f.stale(n,update);await f.profile({profile_status:'DRAFT',skills:[]});await f.db.exec("set test.world_mismatch='true'");
 assert.equal((await f.resolve(update,4,'WITHDRAW')).status,'WITHDRAWN');
});
test('legacy city and confirmed remote remain valid without saved areas across all three writers',async()=>{
 for(const remote of [false,true]){
  await f.reset();if(remote)await f.db.exec("set test.remote_ready='true'");else await f.profile({city:'Novi Sad'});
  const n=await f.need('TOTAL'),r=await f.submit(n);await f.stale(n,r);const updated=await f.resolve(r,2,'KEEP');
  await f.actor(f.REQUESTER);assert.ok(await f.select(n,updated));
 }
});
test('empty, null, malformed, foreign, obsolete and mismatched owned Save areas do not unlock readiness',async()=>{
 const invalid=[[],null,{},[{...CITY,sourceRef:'invented'}],[{...CITY,latitude:45.261}],[{...CITY,longitude:181}],[{...CITY,countryCode:'XX'}],
  [{...CITY,kind:'RADIUS',label:'Novi Sad · do 0 km',radiusKm:0}],[CITY,CITY],[COUNTRY,CITY],[{...CITY,unexpected:true}]];
 for(const a of invalid){await f.reset();await f.areas(a);await assert.rejects(f.submit(await f.need('TOTAL')),/WORKER_PROFILE_NOT_READY/);}
 await f.reset();await f.areas([CITY],f.FOREIGN);await assert.rejects(f.submit(await f.need('TOTAL')),/WORKER_PROFILE_NOT_READY/);
 await f.areas([CITY],f.WORKER,f.FOREIGN);await assert.rejects(f.submit(await f.need('TOTAL')),/WORKER_PROFILE_NOT_READY/);
 await f.reset();await f.areas([CITY]);await f.areas([]);await assert.rejects(f.submit(await f.need('TOTAL')),/WORKER_PROFILE_NOT_READY/);
});
test('valid areas never replace ACTIVE, name, skills, world, ownership or hard matcher guards',async()=>{
 for(const patch of [{profile_status:'DRAFT'},{profile_status:'SUSPENDED'},{display_name:' '},{skills:[]}]){
  await f.reset();await f.areas([CITY]);await f.profile(patch);await assert.rejects(f.submit(await f.need('TOTAL')),/WORKER_PROFILE_NOT_READY/);
 }
 await f.reset();await f.areas([CITY]);const n=await f.need('TOTAL');
 await f.db.exec("set test.world_mismatch='true'");await assert.rejects(f.submit(n),/NEED_NOT_FOUND/);
 await f.db.exec("set test.world_mismatch='false';set test.eligible='false'");await assert.rejects(f.submit(n),/WORKER_NOT_ELIGIBLE/);
 await f.db.exec("set test.eligible='true'");await assert.rejects(f.submit(n,1200,2,1,crypto.randomUUID(),f.REQUESTER_PROFILE),/PROFILE_NOT_OWNED/);
 const r=await f.submit(n);await f.actor(f.REQUESTER);await f.db.exec("set test.eligible='false'");await assert.rejects(f.select(n,r),/WORKER_NO_LONGER_ELIGIBLE/);
 await f.actor(f.WORKER);await f.stale(n,r);await assert.rejects(f.resolve(r,2,'KEEP'),/WORKER_NOT_ELIGIBLE/);
});
test('price, capacity, stale Need, version and content hash stay authoritative',async()=>{
 await f.reset();await f.areas([CITY]);const n=await f.need('TOTAL',1200,2);
 await assert.rejects(f.submit(n,2400),/PRICE|PRICE_MISMATCH/);
 await assert.rejects(f.submit(n,1200,3),/CAPACITY|SLOTS/);
 await assert.rejects(f.submit(n,1200,1,2),/REVISION|STALE/);
 const r=await f.submit(n,600,1);await f.actor(f.REQUESTER);
 await assert.rejects(f.select(n,{...r,contentHash:'wrong'}),/HASH|STALE/);
 await assert.rejects(f.select(n,{...r,version:r.version+1}),/VERSION|STALE/);
 await f.actor(f.WORKER);await f.stale(n,r);await assert.rejects(f.resolve(r,1,'KEEP'),/STALE/);
});
test('NULL city with valid saved areas works; missing selection profile preserves its readiness error',async()=>{
 await f.reset();await f.areas([CITY]);await f.db.exec('alter table public.app_profiles alter column city drop not null');
 try{await f.profile({city:null});const n=await f.need('TOTAL',3000,1),r=await f.submit(n,3000,1);
  await f.actor(f.REQUESTER);await f.db.exec('begin');
  try{await f.db.query('delete from public.app_profiles where id=$1',[f.PROFILE]);await assert.rejects(f.select(n,r),/WORKER_PROFILE_NOT_READY/);}
  finally{await f.db.exec('rollback')}
  assert.ok(await f.select(n,r));
 }finally{await f.profile({city:''});await f.db.exec('alter table public.app_profiles alter column city set not null')}
});
test('the packaged operation preserves function identity and rolls back all DDL on bad postflight',async()=>{
 const local=await fixture();try{
  const operation=JSON.parse(read('.operation-preimage.json')),{render}=require('./sql/'+stem+'.build.cjs');
  for(const name of ['closure_source_v5','closure_erasure_source_v5']){
   await local.db.exec('create table private.'+name+'(singleton boolean primary key,sha256 text)');
   await local.db.query('insert into private.'+name+' values(true,$1)',['fixture-stored-certificate']);
  }
  for(const[name,value]of [['closure_schema_digest_v5_139','fixture-schema'],['closure_source_digest_v5','fixture-source'],['closure_erasure_program_digest_v5','fixture-erasure']])
   await local.db.exec('create or replace function private.'+name+"() returns text language sql as $$select '"+value+"'::text$$");
  const functions=[];
  for(const fn of operation.functions){const metadata=await local.value(`select jsonb_build_object('signature',$1::text,'oid',p.oid::bigint,'body_md5',md5(p.prosrc),
   'definer',p.prosecdef,'volatility',p.provolatile,'is_strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,
   'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'config',p.proconfig,
   'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),'definition',pg_get_functiondef(p.oid),
   'kind',p.prokind,'language',l.lanname,'cost',p.procost,'rows',p.prorows,'support',p.prosupport::text,
   'argument_defaults',pg_get_expr(p.proargdefaults,0)) as value from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure($1)`,[fn.signature]);
   assert.ok(metadata,fn.signature);functions.push(metadata);
  }
  const preflight=read('.preflight.sql'),observer=preflight.slice(preflight.indexOf("select jsonb_build_object('relations'"),preflight.indexOf(' into observed;'));
  const environment=await local.value(observer+' as value'),snapshot={...operation,functions,...environment,closurePostimage:structuredClone(environment.closure)};
  const files=render(snapshot,source),bodies=()=>local.value("select jsonb_agg(jsonb_build_array(p.oid,md5(p.prosrc),p.proowner,p.proacl::text,p.proconfig) order by p.oid) as value from pg_proc p where p.oid=any(select to_regprocedure(x) from unnest($1::text[]) x)",[functions.map(x=>x.signature)]);
  const initial=await bodies();await local.db.exec(files[stem+'.preflight.sql']);
  const wrongOid=structuredClone(snapshot);wrongOid.functions[0].oid++;
  await assert.rejects(local.db.exec(render(wrongOid,source)[stem+'.promotion.sql']),/FUNCTION_DRIFT/);assert.deepEqual(await bodies(),initial);
  const wrongPost=structuredClone(snapshot);wrongPost.closurePostimage.sourceDigest='unexpected';
  await assert.rejects(local.db.exec(render(wrongPost,source)[stem+'.promotion.sql']),/POSTIMAGE_ENVIRONMENT_DRIFT/);assert.deepEqual(await bodies(),initial);
  await local.db.exec(files[stem+'.promotion.sql']);await local.db.exec(files[stem+'.postflight.sql']);const promoted=await bodies();assert.notDeepEqual(promoted,initial);
  await local.db.exec(files[stem+'.rollback.sql']);assert.deepEqual(await bodies(),initial);
  await local.areas([CITY]);await assert.rejects(local.submit(await local.need('TOTAL')),/WORKER_PROFILE_NOT_READY/);
  await local.db.exec(files[stem+'.promotion.sql']);assert.deepEqual(await bodies(),promoted);
  assert.ok(await local.submit(await local.need('TOTAL')));
 }finally{await local.db.close()}
});
