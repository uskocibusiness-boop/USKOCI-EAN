'use strict';
// Actual current submit/select + both state overloads/public readers/count + saved-area validator.
// Synthetic owned Save/review rows. Inherited Auth/world/matcher/calendar/notifications are
// explicit fixture substitutes: this proves SQL behavior, not hosted Auth/RLS/native acceptance.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createPriceFixture}=require('./r07-price-fixture.cjs');
const stem='worker_candidate_areas_20261109',read=ext=>fs.readFileSync(path.join(__dirname,'sql',stem+ext),'utf8');
const operation=JSON.parse(read('.operation-preimage.json')),source=read('.sql');
const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'sql/worker_application_areas_20261109.fixture-schema.json'),'utf8'));
const CITY={kind:'CITY',countryCode:'RS',label:'Novi Sad',city:'Novi Sad',sourceRef:'osm:relation:9273976',latitude:45.26,longitude:19.85,radiusKm:null};
async function fixture(){
 const f=await createPriceFixture();try{
  await f.db.exec(f.candidate);
  for(const t of schema.tables)await f.db.exec('create table '+t.name+'('+t.columns.map(c=>'"'+c.name+'" '+c.type+(c.default?' default '+c.default:'')+(c.notNull?' not null':'')).join(',')+')');
  for(const fn of operation.functions.filter(f=>!f.signature.startsWith('private.closure_')&&!f.signature.startsWith('private.worker_remote_only_')))await f.db.exec(fn.definition);
  await f.db.exec(`create or replace function public.rpc_storage_account_open() returns boolean language sql stable as $$select true$$;
   create or replace function private.need_search_time_admitted_v1(uuid,timestamptz) returns boolean language sql stable as $$select current_setting('test.search_closed',true) is distinct from 'true'$$;
   create or replace function private.application_calendar_conflict_v1(uuid) returns boolean language sql stable as $$select current_setting('test.calendar_conflict',true)='true'$$;`);
  let ordinal=0;
  const areas=async(value,account=f.WORKER,reviewAccount=account)=>{
   const id=crypto.randomUUID();
   await f.db.query("insert into private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,expires_at) values($1,$2,$1,1,'fixture-owned-save',$3,clock_timestamp()+interval '1 day')",[id,reviewAccount,JSON.stringify({profile:{workAreas:value}})]);
   await f.db.query("insert into private.worker_ai_saves(review_id,account_id,client_request_id,receipt,created_at) values($1,$2,$1,'{}',clock_timestamp()+$3::integer*interval '1 second')",[id,account,++ordinal]);
  };
  const profile=patch=>f.db.query('update public.app_profiles p set (city,display_name,skills,profile_status,account_id,kind)=(select city,display_name,skills,profile_status,account_id,kind from jsonb_populate_record(p,$2)) where id=$1',[f.PROFILE,JSON.stringify(patch)]);
  const reset=async()=>{await f.db.exec("delete from private.worker_ai_saves;delete from private.worker_ai_reviews;set test.remote_ready='false';set test.eligible='true';set test.world_mismatch='false';set test.search_closed='false';set test.calendar_conflict='false'");await profile({city:'',display_name:'Test radnik',skills:['Selidbe'],profile_status:'ACTIVE',account_id:f.WORKER,kind:'WORKER'});await f.actor(f.WORKER);};
  const need=async()=>{const id=await f.need('TOTAL',1200,1);await f.db.query("update public.needs set execution_location_mode='REMOTE',schedule_kind='FLEXIBLE' where id=$1",[id]);return id};
  const submit=id=>f.submit(id,1200,1);
  const states=async(id,r)=>({all:await f.rows('select * from private.need_candidate_states_v5($1)',[id]),page:await f.rows('select * from private.need_candidate_states_v5($1,$2)',[id,[r.responseId]])});
  const documents=async(id)=>{await f.actor(f.REQUESTER);return {all:await f.value('select public.rpc_list_need_candidates($1) as value',[id]),page:await f.value('select public.rpc_list_need_candidates_page($1,30,null,null) as value',[id]),count:await f.value('select public.selectable_application_count(n) as value from public.needs n where id=$1',[id])}};
  const expectState=async(id,r,state)=>{const got=await states(id,r);assert.deepEqual(got.all,[{response_id:r.responseId,candidate_state:state}]);assert.deepEqual(got.page,got.all)};
  await reset();return {...f,areas,profile,reset,need,submit,states,documents,expectState,install:()=>f.db.exec(source)};
 }catch(e){await f.db.close();throw e}
}
let f;test.before(async()=>{f=await fixture()});test.after(async()=>{if(f)await f.db.close()});
test('exact live reader preimages reject the already-admitted saved-area application in both lists/count',async()=>{
 await f.areas([CITY]);const n=await f.need(),r=await f.submit(n);assert.equal(r.authoritative,true);
 await f.expectState(n,r,'STALE');const d=await f.documents(n);
 assert.equal(d.all[0].canSelect,false);assert.equal(d.page.items[0].canSelect,false);assert.equal(d.count,0);
});
test('CITY/RADIUS/COUNTRY complete actual submit → both public readers/count → select and immutable replay',async()=>{
 await f.install();for(const areas of [[CITY],[{...CITY,kind:'RADIUS',label:'Novi Sad · do 20 km',radiusKm:20}],[{kind:'COUNTRY',countryCode:'RS',label:'Cela Srbija',city:null,sourceRef:null,latitude:null,longitude:null,radiusKm:null}]]){
  await f.reset();await f.areas(areas);const n=await f.need(),r=await f.submit(n);await f.expectState(n,r,'SELECTABLE');
  const d=await f.documents(n);assert.equal(d.count,1);assert.equal(d.all[0].canSelect,true);assert.equal(d.page.items[0].canSelect,true);
  assert.equal(d.page.items[0].contentHash,r.contentHash);assert.equal(d.all[0].priceRsd,1200);assert.equal(d.all[0].applicationPriceBasis,'TOTAL');
  const key=crypto.randomUUID(),agreement=await f.select(n,r,key);assert.ok(agreement);assert.equal(await f.select(n,r,key),agreement);
  await f.expectState(n,r,'SELECTED');assert.equal((await f.documents(n)).count,0);
  assert.equal(await f.value('select city as value from public.app_profiles where id=$1',[f.PROFILE]),'');
 }
});
test('legacy city and independently confirmed remote-only remain accepted without saved areas',async()=>{
 for(const remote of [false,true]){await f.reset();if(remote)await f.db.exec("set test.remote_ready='true'");else await f.profile({city:'Novi Sad'});
  const n=await f.need(),r=await f.submit(n);await f.expectState(n,r,'SELECTABLE');assert.equal((await f.documents(n)).count,1);
  if(remote){await f.db.query("update public.needs set execution_location_mode='STATIONARY' where id=$1",[n]);await f.expectState(n,r,'STALE');}
 }
});
test('missing/malformed/foreign/obsolete areas do not admit an existing application',async()=>{
 const invalid=[[],null,{},[{...CITY,sourceRef:'invented'}],[{...CITY,latitude:45.261}],[{...CITY,longitude:181}],[{...CITY,countryCode:'XX'}],[{...CITY,kind:'RADIUS',radiusKm:0}],[CITY,CITY],[{...CITY,unexpected:true}]];
 for(const area of invalid){await f.reset();await f.areas([CITY]);const n=await f.need(),r=await f.submit(n);await f.areas(area);await f.expectState(n,r,'STALE');assert.equal((await f.documents(n)).count,0);}
 for(const kind of ['foreign','mismatched','missing']){await f.reset();await f.areas([CITY]);const n=await f.need(),r=await f.submit(n);await f.db.exec('delete from private.worker_ai_saves;delete from private.worker_ai_reviews');
  if(kind==='foreign')await f.areas([CITY],f.FOREIGN);if(kind==='mismatched')await f.areas([CITY],f.WORKER,f.FOREIGN);await f.expectState(n,r,'STALE');}
});
test('owned ACTIVE/name/skills and actual revision/price/capacity/status boundaries remain enforced',async()=>{
 for(const patch of [{profile_status:'DRAFT'},{profile_status:'SUSPENDED'},{display_name:' '},{skills:[]},{account_id:f.FOREIGN},{kind:'REQUESTER'}]){
  await f.reset();await f.areas([CITY]);const n=await f.need(),r=await f.submit(n);await f.profile(patch);await f.expectState(n,r,'STALE');
 }
 for(const [change,state]of [["update public.needs set revision=2 where id=$1",'STALE'],["update public.marketplace_response_versions set price_rsd=999 where response_id=$1",'STALE'],["update public.marketplace_response_versions set covered_slots=2 where response_id=$1",'OVERFILL'],["update public.marketplace_responses set status='WITHDRAWN' where id=$1",'WITHDRAWN'],["update public.needs set status='CANCELLED' where id=$1",'CLOSED']]){
  await f.reset();await f.areas([CITY]);const n=await f.need(),r=await f.submit(n);await f.db.query(change,[change.includes('public.needs')?n:r.responseId]);await f.expectState(n,r,state);
 }
});
test('hard matcher, search time, calendar and price-unit review still prevent selection display',async()=>{
 for(const [setting,state]of [["set test.eligible='false'",'STALE'],["set test.search_closed='true'",'CLOSED'],["set test.calendar_conflict='true'",'SELECTABLE']]){
  await f.reset();await f.areas([CITY]);const n=await f.need(),r=await f.submit(n);await f.db.exec(setting);await f.expectState(n,r,state);
  const d=await f.documents(n);assert.equal(d.all[0].canSelect,false);assert.equal(d.page.items[0].canSelect,false);
 }
 await f.reset();await f.areas([CITY]);const n=await f.need(),r=await f.submit(n);await f.db.query("update public.marketplace_response_versions set price_basis='HOURLY' where response_id=$1",[r.responseId]);
 const d=await f.documents(n);assert.equal(d.all[0].canSelect,false);assert.equal(d.page.items[0].priceReviewRequired,true);
});
test('owner-scoped readers and bounded overload keep identity, page and subset restrictions',async()=>{
 await f.reset();await f.areas([CITY]);const n=await f.need(),r=await f.submit(n);
 assert.deepEqual(await f.rows('select * from private.need_candidate_states_v5($1,$2)',[n,[]]),[]);
 assert.deepEqual(await f.rows('select * from private.need_candidate_states_v5($1,$2)',[n,[crypto.randomUUID()]]),[]);
 await f.actor(f.FOREIGN);await assert.rejects(f.value('select public.rpc_list_need_candidates($1) as value',[n]),/NOT_REQUESTER/);
 await assert.rejects(f.value('select public.rpc_list_need_candidates_page($1,30,null,null) as value',[n]),/NOT_REQUESTER/);
 assert.equal(await f.value('select public.selectable_application_count(n) as value from public.needs n where id=$1',[n]),null);
 await f.actor(null);await assert.rejects(f.value('select public.rpc_list_need_candidates($1) as value',[n]),/AUTH_REQUIRED/);
 await f.actor(f.REQUESTER);await assert.rejects(f.value('select public.rpc_list_need_candidates_page($1,101,null,null) as value',[n]),/INVALID_PAGE/);
 assert.equal((await f.documents(n)).all[0].responseId,r.responseId);
});

test('the packaged operation preserves function identity and rolls back all DDL on bad postflight',async()=>{
 const local=await fixture();try{
  const {render}=require('./sql/'+stem+'.build.cjs');
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
  await local.areas([CITY]);const n=await local.need(),r=await local.submit(n);await local.expectState(n,r,'STALE');
  await local.db.exec(files[stem+'.promotion.sql']);assert.deepEqual(await bodies(),promoted);
  await local.expectState(n,r,'SELECTABLE');
 }finally{await local.db.close()}
});
