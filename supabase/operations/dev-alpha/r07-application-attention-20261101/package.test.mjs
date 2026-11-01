// Exact captured/current SQL through the real application client and pager.
// Auth claims and calendar-conflict=false are explicit fixture substitutes;
// these isolated tests are not hosted Auth/RLS/native acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {loadModules} from '../../../proofs/ex04/ts_loader.mjs';
import {generate,preimage,originals,postimages,signatures,acceptance,catalogBefore,catalogAfter} from './build.mjs';
const uuid=n=>'00000000-0007-4007-8007-'+String(n).padStart(12,'0');
const owner=uuid(1),peer=uuid(2),empty=uuid(3),need=n=>uuid(100+n),response=n=>uuid(200+n),agreement=n=>uuid(300+n);
const plain=value=>JSON.parse(JSON.stringify(value));
const current=name=>preimage.functions.find(f=>f.signature===name);
const request=(scope='ALL',limit=30,cursor=null)=>({scope,limit,cursor});
const ddl=images=>Object.values(images).map(f=>f.definition+';').join('\n');
async function setup(){
 const db=new PGlite();
 await db.exec(`CREATE SCHEMA private;CREATE SCHEMA auth;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE FUNCTION private.application_calendar_conflict_v1(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
 CREATE TABLE public.needs(id uuid PRIMARY KEY,revision integer,status text,title text,description text,
  approximate_city text,approximate_area text,starts_at timestamptz,ends_at timestamptz,schedule_kind text,
  execution_location_mode text,task_timezone text,mode text,price_basis text,required_slots integer);
 CREATE TABLE public.marketplace_responses(id uuid PRIMARY KEY,worker_account_id uuid,need_id uuid,current_version integer,
  status text,price_rsd integer,covered_slots integer,scope_note text,submitted_against_need_revision integer,submitted_at timestamptz,created_at timestamptz);
 CREATE TABLE public.agreements(id uuid PRIMARY KEY,selected_response_id uuid,created_at timestamptz,status text);
 CREATE TABLE public.agreement_execution(agreement_id uuid PRIMARY KEY,state text,agreement_version integer,requester_deadline_at timestamptz);`);
 for(const c of preimage.status_constraints)await db.exec(`ALTER TABLE public.${c.table.split('.').pop()} ADD CONSTRAINT ${c.name} ${c.definition};`);
 await db.exec(current('private.my_application_state(text,integer,integer,text,boolean)').definition);
 await db.exec(ddl(originals));
 await db.exec(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public,private FROM PUBLIC,anon,authenticated,service_role;
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated,service_role;`);
 return db;
}
async function as(db,actor,run,role='authenticated'){
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[actor??'']);await db.exec(`SET ROLE ${role}`);
 try{return await run();}finally{await db.exec('RESET ROLE');}
}
async function fixture(db,n,{raw='SELECTED',needStatus='ACTIVE',agreementStatus='CONFIRMED',execution='CONFIRMED',stale=false,actor=owner,latest=true}={}){
 await db.query(`INSERT INTO public.needs VALUES($1,$2,$3,$4,'Synthetic description',null,null,null,null,
  'FLEXIBLE','REMOTE','Europe/Belgrade','OFFERS',null,1)`,[need(n),stale?2:1,needStatus,'Task '+n]);
 await db.query(`INSERT INTO public.marketplace_responses VALUES($1,$2,$3,1,$4,3500,1,'Synthetic note',1,
  $5::timestamptz,'2026-11-01T09:00:00Z')`,[response(n),actor,need(n),raw,'2026-11-01T10:00:00.'+(n%2?'000123':'000124')+'Z']);
 if(agreementStatus){
  await db.query("INSERT INTO public.agreements VALUES($1,$2,'2026-11-01T10:01:00Z',$3)",[agreement(n),response(n),agreementStatus]);
  if(execution)await db.query("INSERT INTO public.agreement_execution VALUES($1,$2,1,'2026-11-03T10:00:00Z')",[agreement(n),execution]);
 }
 if(!latest){
  await db.query("INSERT INTO public.agreements VALUES($1,$2,'2026-11-01T10:00:00Z','CONFIRMED')",[uuid(900+n),response(n)]);
  await db.query("INSERT INTO public.agreement_execution VALUES($1,'CONFIRMED',1,null)",[uuid(900+n)]);
 }
}
function client(db,actor){
 const transport={auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},rpc:async(name,args={})=>{
  try{
   const data=await as(db,actor,async()=>{
    const result=name==='rpc_list_my_applications'?await db.query('SELECT public.rpc_list_my_applications() value')
     :name==='rpc_list_my_applications_page'?await db.query('SELECT public.rpc_list_my_applications_page($1,$2,$3,$4,$5) value',
      [args.p_scope,args.p_limit,args.p_before_at??null,args.p_before_id??null,args.p_before_rank??null])
     :(()=>{throw Error('UNEXPECTED_TEST_RPC:'+name);})();return result.rows[0].value;
   });return {data,error:null};
  }catch(error){return {data:null,error:{message:error.message,code:error.code}};}
 }};
 const modules=loadModules({client:transport,accountId:actor});
 return {transport,modules,service:modules.load('data/applicationClientService').applicationClientService};
}
const cases=[
 [1,{agreementStatus:'COMPLETED',execution:'COMPLETED',needStatus:'COMPLETED'},'SELECTED',false],
 [2,{agreementStatus:'COMPLETED',execution:'COMPLETED',needStatus:'PUBLISHED'},'SELECTED',false],
 [3,{needStatus:'COMPLETED'},'SELECTED',true],
 [4,{execution:'AWAITING_REQUESTER'},'SELECTED',true],
 [5,{raw:'NOT_SELECTED',stale:true},'SELECTED',true],
 [6,{agreementStatus:'CANCELLED',execution:'CANCELLED'},'SELECTED',false],
 [7,{raw:'NOT_SELECTED',agreementStatus:'CANCELLED',execution:'CANCELLED'},'CLOSED',false],
 [8,{agreementStatus:'SUPERSEDED',execution:null},'SELECTED',false],
 [9,{agreementStatus:'SUPERSEDED'},'SELECTED',true],
 [10,{execution:null},'SELECTED',true],
 [11,{agreementStatus:null},'SELECTED',false],
 [12,{raw:'STALE_REVIEW_REQUIRED',agreementStatus:null,needStatus:'PUBLISHED'},'STALE_REVIEW_REQUIRED',true],
 [13,{raw:'SUBMITTED',agreementStatus:null,needStatus:'PUBLISHED'},'SUBMITTED',false],
 [14,{raw:'VIEWED',agreementStatus:null,needStatus:'PUBLISHED'},'VIEWED',false],
 [15,{raw:'WITHDRAWN',agreementStatus:null,needStatus:'PUBLISHED'},'WITHDRAWN',false],
 [16,{agreementStatus:'COMPLETED',execution:'COMPLETED',stale:true},'SELECTED',false],
 [17,{agreementStatus:'COMPLETED',execution:'CONFIRMED'},'SELECTED',false],
 [18,{execution:'COMPLETED'},'SELECTED',false],
 [19,{agreementStatus:'COMPLETED',execution:'COMPLETED',latest:false},'SELECTED',false],
];
const expectedAttention=[3,4,5,9,10,12],expectedActive=[13,14],expectedFinished=[1,2,6,7,8,11,15,16,17,18,19];
const expectedCounts={total:19,attention:6,active:2,finished:11};

test('frozen package preserves every signature, metadata and closure admission; changes three bodies only',()=>{
 const outputs=generate();for(const[name,s]of Object.entries(outputs))assert.equal(readFileSync(new URL(name,import.meta.url),'utf8'),s,name);
 assert.equal(preimage.closure.source_ready,false);assert.equal(preimage.closure.export_binding,null);assert.equal(preimage.closure.erasure_binding,null);
 for(const key of Object.keys(originals)){
  assert.deepEqual(postimages[key].attributes,originals[key].attributes);
  assert.equal(createHash('md5').update(postimages[key].definition).digest('hex'),postimages[key].definition_md5);
 }
 assert.equal((outputs['forward.sql'].match(/CREATE OR REPLACE FUNCTION /g)||[]).length,3);
 assert.match(outputs['forward.sql'],/R07_ATTENTION_DEV_CLOSURE_STATE_CHANGED/);
 assert.match(outputs['forward.sql'],/R07_ATTENTION_DEV_UNRELATED_FUNCTION_DELTA/);
 assert.doesNotMatch(outputs['forward.sql'],/^\s*(?:GRANT|REVOKE|UPDATE|INSERT|DELETE|ALTER|DROP)\s/im);
});

test('exact preimage reproduces completed selection as false attention through SQL and the actual client',async t=>{
 const db=await setup();t.after(()=>db.close());await fixture(db,1,cases[0][1]);
 const c=client(db,owner),page=await c.service.mojePrijaveStrana(request()),whole=await c.service.mojePrijave();
 const view=c.modules.load('data/myApplicationsView');
 assert.equal(view.applicationSection(page.items[0]),'attention');assert.equal(view.applicationSection(whole[0]),'attention');
 assert.deepEqual(plain(page.counts),{total:1,attention:1,active:0,finished:0});
 assert.equal((await c.service.mojePrijaveStrana(request('HISTORY'))).items.length,0);
});

test('corrected SQL separates lifecycle attention from selection and preserves exact Agreement links/terms',async t=>{
 const db=await setup();t.after(()=>db.close());for(const[n,options]of cases)await fixture(db,n,options);
 const c=client(db,owner),before=await c.service.mojePrijave();await db.exec(ddl(postimages));
 const whole=await c.service.mojePrijave(),page=await c.service.mojePrijaveStrana(request()),view=c.modules.load('data/myApplicationsView');
 assert.deepEqual(plain(page.counts),expectedCounts);assert.deepEqual(plain(view.applicationCounts(whole)),expectedCounts);
 for(const[n,options,state,attention]of cases){
  const row=whole.find(x=>x.prijavaId===response(n)),paged=page.items.find(x=>x.prijavaId===response(n));
  assert.equal(row.stanje,state,'state '+n);assert.equal(row.traziPaznju,attention,'attention '+n);
  assert.equal(paged.traziPaznju,attention,'paged attention '+n);
  assert.equal(row.dogovorId,options.agreementStatus===null?null:agreement(n));assert.equal(row.mozePovuci,before.find(x=>x.prijavaId===row.prijavaId).mozePovuci);
  const {traziPaznju,...remaining}=row,{traziPaznju:oldAttention,...old}=before.find(x=>x.prijavaId===row.prijavaId);
  assert.deepEqual(plain(remaining),plain(old),'all historical selection facts and terms unchanged '+n);
 }
 assert(c.modules.sources.some(s=>s.path==='src/data/applicationClientService.ts'));
 assert(c.modules.sources.some(s=>s.path==='src/data/ownApplicationsPage.ts'));
});

test('all scopes, counts, microsecond ties and keyset pages agree with the corrected whole-list order',async t=>{
 const db=await setup();t.after(()=>db.close());for(const[n,options]of cases)await fixture(db,n,options);await db.exec(ddl(postimages));
 const c=client(db,owner),whole=await c.service.mojePrijave();
 const sets={ALL:cases.map(x=>x[0]),ATTENTION:expectedAttention,ACTIVE:expectedActive,HISTORY:expectedFinished};
 for(const[scope,ids]of Object.entries(sets))for(const limit of[1,2,3,30]){
  const result=[];let cursor=null,pages=0;
  do{
   const page=await c.service.mojePrijaveStrana(request(scope,limit,cursor));
   assert.deepEqual(plain(page.counts),pages===0?expectedCounts:null);result.push(...page.items);pages++;
   if(!page.hasMore)break;assert(page.cursor);cursor=page.cursor;assert(pages<=20);
  }while(true);
  assert.deepEqual(result.map(r=>r.prijavaId),whole.filter(r=>ids.map(response).includes(r.prijavaId)).map(r=>r.prijavaId),scope+' limit '+limit);
  assert.equal(new Set(result.map(r=>r.prijavaId)).size,ids.length);
 }
});

test('ownership, empty results, no-Auth/anonymous denial and page input guards survive; NULL-owner acceptance executes',async t=>{
 const db=await setup();t.after(()=>db.close());await fixture(db,1,cases[0][1]);await fixture(db,20,{actor:peer});await db.exec(ddl(postimages));
 const own=await client(db,owner).service.mojePrijaveStrana(request('HISTORY'));
 assert.deepEqual(plain(own.items.map(r=>r.prijavaId)),[response(1)]);
 assert.deepEqual(plain((await client(db,peer).service.mojePrijaveStrana(request('ATTENTION'))).items.map(r=>r.prijavaId)),[response(20)]);
 assert.equal((await client(db,empty).service.mojePrijaveStrana(request())).counts.total,0);
 const read=(actor,scope='ALL',limit=30,at=null,id=null,rank=null,role)=>as(db,actor,
  ()=>db.query('SELECT public.rpc_list_my_applications_page($1,$2,$3,$4,$5) value',[scope,limit,at,id,rank]),role);
 await assert.rejects(read(null),e=>e.code==='42501'&&e.message==='AUTH_REQUIRED');
 await assert.rejects(read(owner,'ALL',30,null,null,null,'anon'),e=>e.code==='42501');
 for(const args of[[owner,'BAD'],[owner,'ALL',0],[owner,'ALL',101],[owner,'ALL',30,'2026-11-01',null,null],
  [owner,'HISTORY',30,'2026-11-01',response(1),0]])await assert.rejects(read(...args),e=>e.code==='22023');
 await db.exec('BEGIN;'+acceptance+'ROLLBACK;');
});

test('atomic rollback restores exact historical behavior and metadata; reapply moves completed selection to history',async t=>{
 const db=await setup();t.after(()=>db.close());await fixture(db,1,cases[0][1]);
 const meta=async()=>plain((await db.query(`SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p
 WHERE p.oid=ANY($1::regprocedure[]) ORDER BY p.oid`,[Object.values(signatures)])).rows);
 const before=await meta();await db.exec(ddl(postimages));
 assert.equal((await client(db,owner).service.mojePrijaveStrana(request('HISTORY'))).items.length,1);
 await db.exec(ddl(originals));assert.deepEqual(await meta(),before);
 assert.equal((await client(db,owner).service.mojePrijaveStrana(request('ATTENTION'))).items.length,1);
 await db.exec(ddl(postimages));assert.equal((await client(db,owner).service.mojePrijaveStrana(request('ATTENTION'))).items.length,0);
 assert.equal((await client(db,owner).service.mojePrijave()).at(0).dogovorId,agreement(1));
});

test('actual catalog assertion allows exactly three body changes and rejects unrelated changes atomically',async t=>{
 const db=await setup();t.after(()=>db.close());let delta=catalogAfter;
 const local=[];for(const f of Object.values(originals))local.push((await db.query('SELECT $1::regprocedure::oid oid',[f.signature])).rows[0].oid);
 delta=delta.replace(Object.values(originals).map(f=>f.oid).join(','),local.join(','));
 await db.exec('BEGIN;'+catalogBefore+ddl(postimages)+delta+'ROLLBACK;');
 await db.exec('BEGIN;'+catalogBefore+ddl(postimages));
 await db.exec("CREATE OR REPLACE FUNCTION private.application_calendar_conflict_v1(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT true$$;");
 await assert.rejects(db.exec(delta),/R07_ATTENTION_DEV_UNRELATED_FUNCTION_DELTA/);await db.exec('ROLLBACK');
 assert.equal((await client(db,owner).service.mojePrijaveStrana(request())).items.length,0);
 assert.equal((await db.query('SELECT private.application_calendar_conflict_v1(null) value')).rows[0].value,false);
});
