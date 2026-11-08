'use strict';
// Captured live dispatch_tick, real PL/pgSQL on PGlite. Synthetic wave/profile
// only; this does not establish native concurrent PG17 or provider delivery.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const snapshot=JSON.parse(fs.readFileSync(path.join(__dirname,'sql/capacity2_dispatch_transaction_20261108.preimage.json'),'utf8'));
const live=snapshot.functions.find(f=>f.signature==='private.dispatch_tick(integer,timestamp with time zone)');
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const AT='2026-11-08T15:00:00Z';
async function fixture(){
 assert.equal(live.bodyMd5,'76280b0ad653d2fc10199bca2c3971a8');
 const db=new PGlite();
 await db.exec([
  'create schema private;',
  'create table public.needs(id uuid primary key,status text default \'PUBLISHED\');',
  'create table private.dispatch_schedule(need_id uuid primary key references public.needs(id),next_run_at timestamptz not null,locked_until timestamptz,attempts int not null default 0,last_status text,last_reason text,updated_at timestamptz default now());',
  'create table private.marketplace_config(key text primary key,value jsonb not null);',
  'insert into private.marketplace_config values(\'match_v1_dispatch\',\'{"tickBudgetSeconds":40}\'::jsonb);',
  'create table private.profile_sweeps(value integer not null);insert into private.profile_sweeps values(0);',
  'create table private.delivered(need_id uuid primary key);',
  "create function private.requeue_changed_worker_profiles_v1(timestamptz) returns jsonb language plpgsql as $f$ begin update private.profile_sweeps set value=value+1;return '{}'::jsonb;end $f$;",
  "create function private.dispatch_next_wave(nid uuid) returns jsonb language plpgsql as $f$ declare v integer;begin v:=coalesce(nullif(current_setting('v1b.notified',true),'')::int,0);if v>=2 then return jsonb_build_object('status','SENT','waiting',true,'deadlineAt',statement_timestamp());end if;insert into private.delivered values(nid);perform set_config('v1b.notified',(v+1)::text,true);return jsonb_build_object('status','SENT','deadlineAt',statement_timestamp()+interval '15 minutes');end $f$;"
 ].join('\n'));
 await db.exec(live.definition);
 for(let n=1;n<=3;n++){
  await db.query('insert into public.needs(id) values($1)',[id(n)]);
  await db.query('insert into private.dispatch_schedule(need_id,next_run_at) values($1,$2)',[id(n),AT]);
 }
 const count=async()=> (await db.query('select count(*)::int as n from private.delivered')).rows[0].n;
 const sweep=async()=> (await db.query('select value from private.profile_sweeps')).rows[0].value;
 const tick=async batch=>(await db.query('select private.dispatch_tick($1,$2::timestamptz) as value',[batch,AT])).rows[0].value;
 return {db,count,sweep,tick};
}
test('captured live batch retains one per-cycle notification cap and one sweep; later rollback cancels all',async()=>{
 const f=await fixture();try{
  await f.db.exec('begin');const out=await f.tick(3);
  assert.equal(out.processed,3);assert.equal(await f.count(),2);assert.equal(await f.sweep(),1);
  await f.db.exec('rollback');assert.equal(await f.count(),0);assert.equal(await f.sweep(),0);
 }finally{await f.db.close();}
});
test('unsafe one-Need-per-transaction split demonstrably violates original cycle cap and repeats profile sweep',async()=>{
 const f=await fixture();try{
  for(let n=1;n<=3;n++)assert.equal((await f.tick(1)).processed,1);
  assert.equal(await f.count(),3,'without carried cycle GUC, 3 sends bypass the 2-recipient test cap');
  assert.equal(await f.sweep(),3,'without separation, profile sweep repeats 3 times');
 }finally{await f.db.close();}
});
