'use strict';
// Transaction/order/argument wiring proof only. Maintenance effects are named
// boundary fixtures here; real non-idle captured owners run in the native suite.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const source=fs.readFileSync(path.join(__dirname,'sql/r13_marketplace_cooperative_candidate.sql'),'utf8');
const executable=source.slice(source.indexOf('-- R13_ISOLATED_TEST_MARKETPLACE_START'));
const dispatch=fs.readFileSync(path.join(__dirname,'sql/r13_dispatch_cooperative_candidate.sql'),'utf8');
const dispatchSql=dispatch.slice(dispatch.indexOf('-- R13_ISOLATED_TEST_PROCEDURE_START')).split('-- R13_ISOLATED_TEST_PROFILE_STEP_START')[0];
const AT='2026-11-08T15:00:00Z',phases=['EXPIRY','DISPATCH','COMPLETION','EXPORT','RETENTION','AI'];
const id=n=>'a0000000-0000-4000-8000-'+String(n).padStart(12,'0');
const rows=async(db,q,args=[])=> (await db.query(q,args)).rows;
async function fixture(){
 const db=new PGlite();
 await db.exec(`create schema private;create role anon;create role authenticated;create role service_role;
  create table public.needs(id uuid primary key);
  create table private.dispatch_schedule(need_id uuid primary key,next_run_at timestamptz,locked_until timestamptz,
   attempts integer not null default 0,last_status text,last_reason text,updated_at timestamptz);
  create table private.marketplace_config(key text primary key,value jsonb not null);
  insert into private.marketplace_config values('match_v1_dispatch','{"tickBudgetSeconds":40}');
  create table private.phase_probe(sequence bigint generated always as identity,phase text,batch integer,at_time timestamptz,txid xid8,path text);
  create table private.phase_effects(phase text primary key);
  create table private.wave_probe(need_id uuid primary key,txid xid8);
  create function private.phase_fixture(p_phase text,p_batch integer,p_at timestamptz) returns void language plpgsql as $$begin
   insert into private.phase_probe(phase,batch,at_time,txid,path) values(p_phase,p_batch,p_at,pg_current_xact_id(),current_setting('search_path'));
   insert into private.phase_effects values(p_phase) on conflict do nothing;
   if current_setting('r13_fixture.fail_phase',true)=p_phase then raise exception 'R13_TEST_PHASE_FAILURE:%',p_phase;end if;
  end$$;
  create function private.expire_lifecycle(p_at timestamptz) returns jsonb language plpgsql as $$begin perform private.phase_fixture('EXPIRY',null,p_at);return '{}'::jsonb;end$$;
  create function private.requeue_changed_worker_profile_candidate(p_at timestamptz) returns jsonb language plpgsql as $$begin perform private.phase_fixture('DISPATCH',null,p_at);return '{}'::jsonb;end$$;
  create function private.dispatch_next_wave(p_need uuid) returns jsonb language plpgsql as $$begin
   insert into private.wave_probe values(p_need,pg_current_xact_id());return '{"status":"STOPPED","reason":"NEED_NOT_OPEN"}'::jsonb;end$$;
  create function public.rpc_tick_auto_completion() returns integer language plpgsql as $$begin perform private.phase_fixture('COMPLETION',null,null);return 0;end$$;
  create function private.data_export_maintenance(p_batch integer) returns jsonb language plpgsql as $$begin perform private.phase_fixture('EXPORT',p_batch,null);return '{}'::jsonb;end$$;
  create function private.retention_maintenance(p_batch integer) returns jsonb language plpgsql as $$begin perform private.phase_fixture('RETENTION',p_batch,null);return '{"state":"NOT_READY","code":"POLICY_NOT_READY"}'::jsonb;end$$;
  create function private.ai_turn_sweep_v5(p_at timestamptz) returns jsonb language plpgsql as $$begin perform private.phase_fixture('AI',null,p_at);return '{}'::jsonb;end$$;
 `);
 await db.exec(dispatchSql);await db.exec(executable);return db;
}
async function seed(db,count){for(let n=1;n<=count;n++){await db.query('insert into public.needs values($1)',[id(n)]);await db.query('insert into private.dispatch_schedule(need_id,next_run_at) values($1,$2)',[id(n),AT]);}}
const call=(db,batch=25)=>db.query('call private.marketplace_cooperative_candidate($1,$2)',[batch,AT]);

test('R13 marketplace candidate cannot apply and every app role lacks the scheduler entrypoint',async()=>{
 const db=await fixture();try{
  await assert.rejects(db.exec(source),/R13_MARKETPLACE_COOPERATIVE_SOURCE_ONLY/);
  for(const role of ['anon','authenticated','service_role'])assert.deepEqual(await rows(db,"select has_function_privilege($1,'private.marketplace_cooperative_candidate(integer,timestamptz)','EXECUTE') as permitted",[role]),[{permitted:false}]);
  await db.exec('grant usage on schema private to authenticated;grant execute on procedure private.marketplace_cooperative_candidate(integer,timestamptz) to authenticated;set role authenticated');
  try{await assert.rejects(call(db),e=>e.code==='42501'&&/R13_SCHEDULER_ROLE_REQUIRED/.test(e.message));}finally{await db.exec('reset role');}
  assert.deepEqual(await rows(db,'select*from private.phase_probe'),[]);
 }finally{await db.close();}
});

test('R13 wrapper runs all six phases in order with separated transactions and preserves p_at across nested CALL commits',async()=>{
 const db=await fixture();try{
  await seed(db,3);await db.exec('set search_path=public');await call(db);
  const observed=await rows(db,'select phase,txid::text as txid,path,at_time from private.phase_probe order by sequence');
  assert.deepEqual(observed.map(x=>x.phase),phases);assert.equal(new Set(observed.map(x=>x.txid)).size,6);assert.ok(observed.every(x=>x.path==='pg_catalog'));
  assert.ok(observed.filter(x=>['EXPIRY','DISPATCH','AI'].includes(x.phase)).every(x=>new Date(x.at_time).toISOString()===AT.replace('Z','.000Z')));
  const waves=await rows(db,'select txid::text as txid from private.wave_probe');assert.equal(waves.length,3);assert.equal(new Set(waves.map(x=>x.txid)).size,3);
  const ids=observed.map(x=>BigInt(x.txid));assert.ok(waves.every(x=>BigInt(x.txid)>ids[1]&&BigInt(x.txid)<ids[2]));
  assert.deepEqual(await rows(db,'select need_id from private.dispatch_schedule'),[]);
 }finally{await db.close();}
});

test('R13 raw batch is forwarded independently; actual dispatch applies its own 1–200/default25 contract',async()=>{
 const db=await fixture();try{
  for(const [input,expected]of [[1,1],[200,200],[201,25],[0,25],[null,25]]){
   await db.exec('truncate private.dispatch_schedule,public.needs,private.phase_probe,private.phase_effects,private.wave_probe');await seed(db,205);await call(db,input);
   assert.equal((await rows(db,'select count(*)::int as n from private.wave_probe'))[0].n,expected);
   assert.deepEqual(await rows(db,"select phase,batch from private.phase_probe where phase in ('EXPORT','RETENTION') order by sequence"),[{phase:'EXPORT',batch:input},{phase:'RETENTION',batch:input}]);
  }
 }finally{await db.close();}
});

test('R13 later-phase failure preserves previous commits, stops later phases and retries the same durable queue state',async()=>{
 const db=await fixture();try{
  await seed(db,2);await db.exec("set r13_fixture.fail_phase='COMPLETION'");await assert.rejects(call(db),/R13_TEST_PHASE_FAILURE:COMPLETION/);
  assert.deepEqual((await rows(db,'select phase from private.phase_probe order by sequence')).map(x=>x.phase),['EXPIRY','DISPATCH']);
  assert.equal((await rows(db,'select count(*)::int as n from private.wave_probe'))[0].n,2);assert.deepEqual(await rows(db,'select need_id from private.dispatch_schedule'),[]);
  await db.exec('reset r13_fixture.fail_phase');await call(db);
  assert.deepEqual((await rows(db,'select phase from private.phase_probe order by sequence')).map(x=>x.phase),['EXPIRY','DISPATCH',...phases]);
  assert.equal((await rows(db,'select count(*)::int as n from private.wave_probe'))[0].n,2);assert.equal((await rows(db,'select count(*)::int as n from private.phase_effects'))[0].n,6);
  // A first-phase exception has no prior commit to preserve.
  await db.exec("truncate private.phase_probe,private.phase_effects;set r13_fixture.fail_phase='EXPIRY'");await assert.rejects(call(db),/R13_TEST_PHASE_FAILURE:EXPIRY/);
  assert.deepEqual(await rows(db,'select*from private.phase_probe'),[]);assert.deepEqual(await rows(db,'select*from private.phase_effects'),[]);
 }finally{await db.close();}
});

test('R13 explicit outer transaction fails before any phase can commit',async()=>{
 const db=await fixture();try{
  await db.exec('begin');try{await assert.rejects(call(db),e=>e.code==='2D000');}finally{await db.exec('rollback');}
  assert.deepEqual(await rows(db,'select*from private.phase_probe'),[]);
 }finally{await db.close();}
});
