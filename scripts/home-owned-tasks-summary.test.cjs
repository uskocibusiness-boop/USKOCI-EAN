'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite'),{createHarness}=require('./ux-component-harness.cjs');
const sql=fs.readFileSync(path.join(__dirname,'sql/home_owned_tasks_summary_20261119.candidate.sql'),'utf8');
const fast=fs.readFileSync(path.join(__dirname,'sql/selectable_application_count_fast_path_20261119.candidate.sql'),'utf8');
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`,known=value=>({kind:'known',value});
async function fixture({apply=true}={}){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('fixture.actor',true),'')::uuid$$;
 create table public.needs(id uuid primary key,requester_account_id uuid not null,status text not null,created_at timestamptz not null,updated_at timestamptz,title text,required_slots int not null,covered_slots int not null default 0,selectable_count int not null default 0);
 create function public.rpc_storage_account_open() returns boolean language plpgsql security definer set search_path=pg_catalog as $$begin if auth.uid() is null then return false; end if; if current_setting('fixture.closed',true)='true' then raise exception 'ACCOUNT_CLOSING' using errcode='42501'; end if; return true; end$$;
 create function public.covered_slots(n public.needs) returns int language sql stable security definer set search_path=public,pg_temp as $$select n.covered_slots$$;
 create function private.need_candidate_states_v5(p_need_id uuid) returns table(candidate_state text) language sql stable as $$select 'SELECTABLE'::text where exists(select 1 from public.needs n where n.id=p_need_id and n.selectable_count>0)$$;
 create function public.selectable_application_count(n public.needs) returns int language sql stable security definer set search_path=pg_catalog as $$select n.selectable_count$$;
 create function public.rpc_read_task(p_need_id uuid) returns jsonb language sql stable set search_path=pg_catalog as $$select jsonb_build_object('id',n.id,'status',n.status,'title',n.title,'created_at',n.created_at,'updated_at',n.updated_at,'required_slots',n.required_slots,'covered_slots',public.covered_slots(n),'selectable_application_count',public.selectable_application_count(n)) from public.needs n where n.id=p_need_id$$;
 grant execute on function public.rpc_storage_account_open() to authenticated; grant execute on function public.covered_slots(public.needs) to authenticated;
 grant execute on function public.selectable_application_count(public.needs) to authenticated; grant execute on function public.rpc_read_task(uuid) to authenticated;
 alter table public.needs enable row level security;`);
 await db.exec(fast);await db.exec('grant execute on function public.selectable_application_count(public.needs) to authenticated');if(apply)await db.exec(sql);
 const add=async(n,owner,status,age,updated,title,covered=0,selectable=0)=>db.query(`insert into public.needs values($1,$2,$3,statement_timestamp()-($4||' days')::interval,case when $5::text is null then null else statement_timestamp()-($5::text||' days')::interval end,$6,2,$7,$8)`,[id(n),owner,status,age,updated,title,covered,selectable]);
 for(let n=1;n<=9;n++)await add(n,A,n===9?'SELECTION':'PUBLISHED',n<=2?1:n,0,`Eligible ${n}`,0,n===4?1:0);
 await add(10,A,'PUBLISHED',.2,0,'Preview without waiting',0,0);await add(11,A,'SELECTION',.3,0,'Partial',1);await add(12,A,'ACTIVE',.4,0,'Filled',2);
 await add(13,A,'DRAFT',10,0,'Fresh older');await add(20,A,'DRAFT',10,0,'Fresh tie winner');await add(14,A,'DRAFT',.1,0,'" "');await add(15,A,'DRAFT',.1,8,'Stale');
 await add(16,A,'COMPLETED',.1,0,'History',2);await add(17,B,'PUBLISHED',.01,0,'Foreign');await add(18,A,'DRAFT',.1,0,'\u00a0');await add(19,A,'DRAFT',.1,0,'\ufeff');
 const actor=async account=>{await db.exec('reset role');await db.query("select set_config('fixture.actor',$1,false)",[account??'']);await db.exec('set role authenticated');};
 const summary=async()=>(await db.query('select public.rpc_home_owned_tasks_summary_v1() value')).rows[0].value;
 return {db,actor,summary};
}

test('SQL summary preserves exact counts, six-row global order, fresh draft, auth and non-overwrite guards',async()=>{
 const f=await fixture();try{
  await f.actor(A);const r=await f.summary();
  const ownedCte=sql.match(/with owned as materialized \\(([\\s\\S]*?)\\), classified as materialized/);
  assert.ok(ownedCte);assert.doesNotMatch(ownedCte[1],/public\\.(?:covered_slots|selectable_application_count)\\(/);
  assert.match(sql,/case when d\\.id is not null then coalesce\\(\\(d\\.document->>'covered_slots'\\)::int,0\\) else public\\.covered_slots\\(c\\.need_row\\) end/);
  assert.match(sql,/case when d\\.id is not null then coalesce\\(\\(d\\.document->>'selectable_application_count'\\)::int,0\\) else coalesce\\(public\\.selectable_application_count\\(c\\.need_row\\),0\\) end/);
  assert.deepEqual(r.counts,{total:19,active:12,drafts:6,history:1,waiting:1});assert.equal(r.items.length,6);
  assert.deepEqual(r.items.map(x=>x.id),[id(10),id(11),id(12),id(2),id(1),id(3)]);assert.equal(r.freshDraft.id,id(20));
  assert.equal(r.items.some(x=>[13,14,15,16,17,18,19,20].some(n=>x.id===id(n))),false);
  assert.equal(r.accountId,A);assert.equal(r.schemaVersion,1);
  await assert.rejects(f.db.exec(sql),/HOME_TASK_SUMMARY_ALREADY_EXISTS/);
  const grants=(await f.db.query(`select has_function_privilege('anon','public.rpc_home_owned_tasks_summary_v1()','execute') anon,has_function_privilege('authenticated','public.rpc_home_owned_tasks_summary_v1()','execute') auth`)).rows[0];
  assert.deepEqual(grants,{anon:false,auth:true});
  await f.actor(null);await assert.rejects(f.summary(),/AUTH_REQUIRED/);await f.actor(A);await f.db.exec("set fixture.closed='true'");await assert.rejects(f.summary(),/ACCOUNT_CLOSING/);
 }finally{await f.db.close();}
});

test('SQL preflight rejects a different selectable-count body without creating the Home RPC',async()=>{
 const f=await fixture({apply:false});try{
  await f.db.exec(`create or replace function public.selectable_application_count(n public.needs) returns int language sql stable security definer set search_path=pg_catalog as $$select 0$$`);
  await assert.rejects(f.db.exec(sql),/HOME_TASK_SUMMARY_SELECTABLE_COUNT_DRIFT/);
  assert.equal((await f.db.query("select to_regprocedure('public.rpc_home_owned_tasks_summary_v1()') is not null v")).rows[0].v,false);
 }finally{await f.db.close();}
});

test('decoder rejects wrong owner, broken counts, wrong order and stale drafts while retaining an older fresh draft',()=>{
 const h=createHarness({'src/data/supabaseClient.ts':{supabaseKlijent:()=>({})},'src/store/sesija.ts':{sesijaSada:()=>({})}});
 const {decodeHomeOwnedTasksSummary:decode}=h.load('src/data/homeOwnedTasksContract.ts'),asOf='2026-11-19T10:00:00Z';
 const doc=(n,status,title,created,updated=asOf)=>({id:id(n),status,title,created_at:created,sortAt:created,updated_at:updated});
 const map=d=>({id:d.id,stanje:d.status==='DRAFT'?'NACRT':'OBJAVLJENA',naslov:d.title,azurirano:d.updated_at});
 const a=doc(1,'PUBLISHED','Active','2026-11-18T10:00:00Z'),d=doc(2,'DRAFT','"Fresh"','2026-11-17T10:00:00Z');
 const base={schemaVersion:1,accountId:A,asOf,counts:{total:4,active:2,drafts:1,history:1,waiting:1},items:[a,d],freshDraft:d};
 assert.ok(decode(base,A,map));assert.equal(decode({...base,accountId:B},A,map),null);
 assert.equal(decode({...base,counts:{...base.counts,total:5}},A,map),null);assert.equal(decode({...base,items:[d,a]},A,map),null);
 assert.equal(decode({...base,freshDraft:null},A,map),null);
 const many=Array.from({length:6},(_,i)=>doc(i+10,'PUBLISHED','Task '+i,`2026-11-${String(18-i).padStart(2,'0')}T10:00:00Z`));
 const oldFresh=doc(30,'DRAFT','Older but fresh','2026-11-08T10:00:00Z');
 const bounded=decode({...base,counts:{total:12,active:10,drafts:1,history:1,waiting:0},items:many,freshDraft:oldFresh},A,map);
 assert.ok(bounded);assert.equal(bounded.freshDraft.id,id(30));
 const stale=doc(31,'DRAFT','Stale','2026-11-18T10:00:00Z','2026-11-10T10:00:00Z');
 assert.equal(decode({...base,items:[a,stale],freshDraft:stale},A,map),null);
});

test('Home composition, RPC transport and build gate preserve the staged rollout',async()=>{
 const stubs={'src/data/supabaseClient.ts':{supabaseKlijent:()=>({})},'src/store/sesija.ts':{sesijaSada:()=>({})}},h=createHarness(stubs);
 const {composeHome}=h.load('src/data/homeSnapshot.ts'),items=[{id:id(1),stanje:'OBJAVLJENA',naslov:'First'},{id:id(2),stanje:'OBJAVLJENA',naslov:'Second'}],draft={id:id(3),stanje:'NACRT',naslov:'Fresh',azurirano:'2026-11-19T09:00:00Z'};
 const summary={schemaVersion:1,accountId:A,asOf:'2026-11-19T10:00:00Z',counts:{total:9,active:5,drafts:2,history:2,waiting:1},items,freshDraft:draft};
 const home=composeHome({needs:known(summary),applications:known([]),agreements:known([])},known({rows:[],more:0,asOf:summary.asOf,ratings:{due:0,agreementId:null}}),Date.parse(summary.asOf),'Europe/Belgrade');
 assert.deepEqual(home.mine.tasks,known(summary.counts));assert.deepEqual(home.ownTaskItems,items);assert.equal(home.prompts[0].target.needId,draft.id);assert.equal(home.firstRun,false);
 const calls=[],session={user:{id:A},accountRevision:7},payload={schemaVersion:1,accountId:A,asOf:summary.asOf,counts:{total:0,active:0,drafts:0,history:0,waiting:0},items:[],freshDraft:null};
 const client=createHarness({'src/store/sesija.ts':{sesijaSada:()=>session},'src/data/supabaseClient.ts':{supabaseKlijent:()=>({rpc:(name,args)=>({abortSignal:async signal=>{calls.push({name,args,signal});return {data:payload,error:null};}})})},'src/data/needUrgencyClientService.ts':{readNeedUrgencies:async()=>new Map()}});
 const service=client.load('src/data/needClientService.ts').needClientService,controller=new AbortController(),read=await service.mojePotrebeZaPocetnu({signal:controller.signal});
 assert.equal(calls.length,1);assert.equal(calls[0].name,'rpc_home_owned_tasks_summary_v1');assert.deepEqual(calls[0].args,{});assert.equal(typeof calls[0].signal?.aborted,'boolean');assert.equal(calls[0].signal.aborted,false);assert.equal(read.counts.total,0);
 const gate=client.load('src/data/homeOwnedTasksSummaryGate.ts');assert.equal(gate.homeOwnedTasksSummaryBuilt(undefined),false);assert.equal(gate.homeOwnedTasksSummaryBuilt('true'),false);assert.equal(gate.homeOwnedTasksSummaryBuilt('1'),true);
 const route=fs.readFileSync(path.join(__dirname,'../src/app/(app)/index.tsx'),'utf8');assert.match(route,/homeOwnedTasksSummaryBuilt\(\)/);assert.match(route,/source\.mojePotrebeZaPocetnu\(/);assert.match(route,/source\.mojePotrebe\(\{ includeUrgency: false/);
});
