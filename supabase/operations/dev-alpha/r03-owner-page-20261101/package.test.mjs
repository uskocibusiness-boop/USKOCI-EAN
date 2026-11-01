// Isolated current SQL + real client mapper. Auth claims, closure-open state and
// final candidate states are explicit fixture substitutes; no hosted acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {snapshot} from '../../../proofs/privacy/r01_fixture.mjs';
import {loadModules} from '../../../proofs/ex04/ts_loader.mjs';
import {generate,preimage,original,postimage,signature,acceptance} from './build.mjs';
const uuid=n=>'00000000-0003-4003-8003-'+String(n).padStart(12,'0');
const owner=uuid(1),peer=uuid(2),closed=uuid(3),empty=uuid(4),id=n=>uuid(100+n);
const plain=value=>JSON.parse(JSON.stringify(value));
const md5=value=>createHash('md5').update(value).digest('hex');
const current=name=>preimage.functions.find(f=>f.signature===name);
async function setup(){
 const db=new PGlite();
 await db.exec(`CREATE SCHEMA private;CREATE SCHEMA auth;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE FUNCTION private.closure_assert_open(actor uuid) RETURNS void LANGUAGE plpgsql AS $$BEGIN
  IF actor='${closed}' THEN RAISE EXCEPTION 'ACCOUNT_NOT_OPEN' USING errcode='42501';END IF;END$$;
 CREATE TABLE public.agreements(id uuid,need_id uuid,worker_account_id uuid,status text);
 CREATE TABLE public.need_selections(need_id uuid,worker_account_id uuid,status text,covered_slots integer);
 CREATE TABLE public.marketplace_responses(id uuid,need_id uuid,worker_account_id uuid,status text);
 CREATE TABLE public.need_geography(need_id uuid,public_topology jsonb);
 CREATE TABLE public.need_requirement_details(need_id uuid,critical_conditions text[]);
 CREATE TABLE private.fixture_candidates(need_id uuid,candidate_state text);
 CREATE FUNCTION private.need_candidate_states_v5(nid uuid) RETURNS TABLE(candidate_state text)
 LANGUAGE sql STABLE AS $$SELECT candidate_state FROM private.fixture_candidates WHERE need_id=nid$$;`);
 await db.exec('CREATE TABLE public.needs('+snapshot.columns.map(c=>`${c.name} ${c.name==='approx_geog'?'text':c.type}`).join(',')+',PRIMARY KEY(id));');
 for(const name of ['public.is_my_task(uuid)']) {
  const f=snapshot.functions.find(f=>f.signature.replaceAll('public.','')===name.replaceAll('public.',''));
  await db.exec(f.definition);
 }
 for(const name of ['public.rpc_storage_account_open()','public.covered_slots(public.needs)',
  'public.selectable_application_count(public.needs)','public.rpc_read_task(uuid)','public.rpc_list_my_tasks()',
  'private.own_task_counts(uuid)',signature]) await db.exec(current(name).definition);
 await db.exec(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public,private FROM PUBLIC,anon,authenticated,service_role;
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated,service_role;`);
 return db;
}
async function as(db,actor,run,role='authenticated'){
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[actor??'']);
 await db.exec(`SET ROLE ${role}`);
 try{return await run();}finally{await db.exec('RESET ROLE');}
}
async function seed(db){
 const statuses=['DRAFT','PUBLISHED','SELECTION','ACTIVE','COMPLETED','CANCELLED','EXPIRED','ARCHIVED'];
 for(let i=0;i<statuses.length;i++)await db.query(`INSERT INTO public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
  schedule_kind,required_slots,mode,required_skills,required_tools,required_vehicles,required_licenses,public_photo_paths,
  verified_identity_required,urgent,revision,execution_location_mode,task_country_code,task_timezone,price_basis,
  created_at,updated_at,published_at,minimum_experience_years)
  VALUES($1,$2,$3,$4,$5,'Synthetic public description','Cleaning','FLEXIBLE',3,'OFFERS','{}','{}','{}','{}','{}',false,false,1,
  'REMOTE','RS','Europe/Belgrade','PER_PERSON','2026-11-01T10:00:00.000123Z','2026-11-01T10:00:00Z',
  '2026-11-01T10:00:00Z',null)`,[id(i),owner,uuid(11),statuses[i],'Task '+i]);
 await db.query(`INSERT INTO public.needs SELECT $1,$2,$3,status,title,description,category,approximate_city,approximate_area,approximate_lat,approximate_lng,
  schedule_kind,starts_at,ends_at,required_slots,mode,requester_price_rsd,required_skills,required_tools,required_vehicles,verified_identity_required,urgent,
  public_photo_paths,revision,published_at,created_at,updated_at,response_deadline,urgent_activated_at,urgent_expires_at,urgent_policy_version,
  minimum_experience_years,execution_location_mode,approx_geog,required_licenses,remaining_search_closed_at,remaining_search_closed_by_account_id,
  remaining_search_close_reason,task_country_code,task_timezone,price_basis,category_id FROM public.needs WHERE id=$4`,[id(20),peer,uuid(12),id(1)]);
 await db.query("INSERT INTO private.fixture_candidates VALUES($1,'SELECTABLE')",[id(1)]);
 await db.query("INSERT INTO public.marketplace_responses VALUES($1,$2,$3,'SUBMITTED')",[uuid(50),id(1),peer]);
}
function client(db,actor){
 const transport={auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},
  rpc:async(name,args={})=>{
   try {
    const data=await as(db,actor,async()=>{
     const q=name==='rpc_list_my_needs_page'
      ?await db.query('SELECT public.rpc_list_my_needs_page($1,$2,$3,$4) value',[args.p_scope,args.p_limit,args.p_before_at??null,args.p_before_id??null])
      :name==='rpc_list_my_tasks'?await db.query('SELECT public.rpc_list_my_tasks() value')
      :(()=>{throw Error('UNEXPECTED_TEST_RPC:'+name);})();
     return q.rows[0].value;
    });return {data,error:null};
   }catch(error){return {data:null,error:{message:error.message,code:error.code}};}
  }};
 const modules=loadModules({client:transport,accountId:actor});
 return {transport,modules,service:modules.load('data/needClientService').needClientService};
}
const request=(scope='ALL',limit=30,cursor=null)=>({scope,limit,cursor});

test('frozen package changes exactly the existing page body, not closure or authority',()=>{
 const outputs=generate();
 for(const[name,s]of Object.entries(outputs))assert.equal(readFileSync(new URL(name,import.meta.url),'utf8'),s,name);
 assert.equal(md5(postimage.definition),postimage.definition_md5);
 assert.deepEqual(postimage.attributes,original.attributes);
 assert.deepEqual(preimage.closure.source_ready,false);assert.equal(preimage.closure.export_binding,null);
 assert.match(outputs['forward.sql'],/R03_DEV_CLOSURE_STATE_CHANGED/);
 assert.match(outputs['forward.sql'],/R03_DEV_UNRELATED_FUNCTION_DELTA/);
 assert.doesNotMatch(outputs['forward.sql'],/^\s*(?:GRANT|REVOKE|UPDATE|INSERT|DELETE|ALTER|DROP)\s/im);
 assert.equal((outputs['forward.sql'].match(/CREATE OR REPLACE FUNCTION /g)||[]).length,1);
});

test('exact current SQL reproduces empty and nonempty OWN_TASKS_PAGE_INVALID in the real service',async t=>{
 const db=await setup();t.after(()=>db.close());
 await assert.rejects(client(db,owner).service.mojePotrebeStrana(request(),{includeUrgency:false}),/OWN_TASKS_PAGE_INVALID/);
 await seed(db);
 const c=client(db,owner);
 assert.equal((await c.service.mojePotrebe({includeUrgency:false})).length,8,'the same SQL-backed whole-list read succeeds');
 await assert.rejects(c.service.mojePotrebeStrana(request('ACTIVE'),{includeUrgency:false}),/OWN_TASKS_PAGE_INVALID/);
});

test('new actual SQL maps every scope and cursor through current client; whole-list documents and counts agree',async t=>{
 const db=await setup();t.after(()=>db.close());await seed(db);await db.exec(postimage.definition);
 const c=client(db,owner),whole=plain(await c.service.mojePotrebe({includeUrgency:false}));
 const view=c.modules.load('data/marketplaceView');
 const expectedCounts=plain(view.ownedTaskCounts(whole));
 assert.deepEqual(expectedCounts,{total:8,active:3,drafts:1,history:4,waiting:1});
 const scopes={ALL:[7,6,5,4,3,2,1,0],ACTIVE:[3,2,1],DRAFTS:[0],HISTORY:[7,6,5,4],WAITING:[1]};
 for(const[scope,expected]of Object.entries(scopes))for(const limit of [1,2,30]){
  let cursor=null;const items=[];let pages=0;
  do {
   const page=await c.service.mojePotrebeStrana(request(scope,limit,cursor),{includeUrgency:false});
   assert.deepEqual(plain(page.counts),pages===0?expectedCounts:null);
   items.push(...plain(page.items));pages++;
   if(!page.hasMore)break;
   assert(page.cursor);cursor=page.cursor;assert(pages<10);
  }while(true);
  assert.deepEqual(items.map(x=>x.id),expected.map(id));
  assert.deepEqual(items,whole.filter(x=>expected.map(id).includes(x.id)));
 }
 assert(c.modules.sources.some(s=>s.path==='src/data/ownTasksPage.ts'));
 assert(c.modules.sources.some(s=>s.path==='src/data/needClientService.ts'));
 const peerPage=await client(db,peer).service.mojePotrebeStrana(request(),{includeUrgency:false});
 assert.deepEqual(plain(peerPage.items.map(x=>x.id)),[id(20)]);assert.equal(peerPage.counts.total,1);
 const emptyPage=await client(db,empty).service.mojePotrebeStrana(request(),{includeUrgency:false});
 assert.equal(emptyPage.items.length,0);assert.equal(emptyPage.counts.total,0);
});

test('new reader denies missing/closed/anonymous callers and invalid input; preserves no-private-field document',async t=>{
 const db=await setup();t.after(()=>db.close());await seed(db);await db.exec(postimage.definition);
 const read=(actor,scope='ALL',limit=30,at=null,key=null,role)=>as(db,actor,
  ()=>db.query('SELECT public.rpc_list_my_needs_page($1,$2,$3,$4) value',[scope,limit,at,key]),role);
 await assert.rejects(read(null),e=>e.code==='28000');
 await assert.rejects(read(closed),e=>e.code==='42501');
 await assert.rejects(read(owner,'ALL',30,null,null,'anon'),e=>e.code==='42501');
 for(const args of [[owner,'BOGUS'],[owner,'ALL',0],[owner,'ALL',101],[owner,'ALL',30,'2026-11-01',null]])
  await assert.rejects(read(...args),e=>e.code==='22023');
 const value=(await read(owner)).rows[0].value;
 for(const row of value.items)for(const key of ['requester_account_id','category_id','remaining_search_close_reason','remaining_search_closed_by_account_id'])
  assert.equal(Object.hasOwn(row,key),false);
 await db.exec(acceptance);
});

test('one-body rollback restores the captured failure without changing helper/ACL; reapply succeeds',async t=>{
 const db=await setup();t.after(()=>db.close());await seed(db);
 const meta=async()=>plain((await db.query("SELECT oid,prosrc,proacl::text,proowner,proconfig,prosecdef FROM pg_proc WHERE oid IN ('private.own_task_counts(uuid)'::regprocedure,'public.rpc_list_my_needs_page(text,integer,timestamptz,uuid)'::regprocedure) ORDER BY oid")).rows);
 const before=await meta();await db.exec(postimage.definition);
 const after=await meta();assert.equal(after[0].prosrc,before[0].prosrc);
 await db.exec(original.definition);assert.deepEqual(await meta(),before);
 await assert.rejects(client(db,owner).service.mojePotrebeStrana(request(),{includeUrgency:false}),/OWN_TASKS_PAGE_INVALID/);
 await db.exec(postimage.definition);
 assert.equal((await client(db,owner).service.mojePotrebeStrana(request(),{includeUrgency:false})).items.length,8);
});

test('actual catalog delta assertion accepts one body only and rejects an unrelated helper change',async t=>{
 const db=await setup();t.after(()=>db.close());
 const forward=generate()['forward.sql'];
 const snapshotSql=forward.slice(forward.indexOf('CREATE TEMP TABLE r03_reader_prior_functions'),
  forward.indexOf('CREATE OR REPLACE FUNCTION public.rpc_list_my_needs_page'));
 const localOid=(await db.query('SELECT $1::regprocedure::oid AS oid',[signature])).rows[0].oid;
 const delta=forward.slice(forward.indexOf('DO $delta$'),forward.indexOf('END; $delta$;')+'END; $delta$;'.length)
  .replace(`before.oid=${original.oid}`,`before.oid=${localOid}`);
 // Only the captured DEV OID is translated for this disposable catalog. The
 // assertion SQL itself executes unchanged; no full target admission is claimed.
 await db.exec('BEGIN;'+snapshotSql+postimage.definition+';'+delta);
 await db.exec("CREATE OR REPLACE FUNCTION private.own_task_counts(a uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$SELECT '{}'::jsonb$$;");
 await assert.rejects(db.exec(delta),/R03_DEV_UNRELATED_FUNCTION_DELTA/);
 await db.exec('ROLLBACK');
});
