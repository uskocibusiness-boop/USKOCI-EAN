'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const source=fs.readFileSync(path.join(__dirname,'sql/r13_dispatch_cooperative_candidate.sql'),'utf8');
const anchor='-- R13_ISOLATED_TEST_PROCEDURE_START';
// This suite isolates per-Need transaction handling; the one-profile step is
// a fixture boundary here and is exercised with real captured SQL separately.
const executable=source.slice(source.indexOf(anchor)).split('-- R13_ISOLATED_TEST_PROFILE_STEP_START')[0];
const B='2026-11-08T15:00:00Z';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
async function fixture(){
 const db=new PGlite();
 await db.exec(`
 create schema private;
 create role anon;create role authenticated;create role service_role;
 create table public.needs(id uuid primary key,probe_kind text not null);
 create table private.marketplace_config(key text primary key,value jsonb not null);
 insert into private.marketplace_config values('match_v1_dispatch','{"tickBudgetSeconds":40}'::jsonb);
 create table private.dispatch_schedule(need_id uuid primary key references public.needs(id),
 next_run_at timestamptz not null,locked_until timestamptz,attempts integer not null default 0,
 last_status text,last_reason text,updated_at timestamptz);
 create table private.probe_events(event text not null,need_id uuid,transaction_id xid8 not null);
 create function private.requeue_changed_worker_profile_candidate(p_at timestamptz) returns jsonb language plpgsql as $$
 begin
 insert into private.probe_events values ('SWEEP',NULL,pg_current_xact_id());
 return '{}'::jsonb;
 end $$;
 create function private.dispatch_next_wave(nid uuid) returns jsonb language plpgsql as $wave_fixture$
 declare k text; v_used integer;
 begin
 select probe_kind into strict k from public.needs where id=nid;
 if k in ('LIMITED','LIMITED_FAIL') then
   v_used:=coalesce(nullif(current_setting('v1b.notified',true),'')::integer,0);
   if v_used>=2 then return jsonb_build_object('status','SENT','waiting',true,'deadlineAt',statement_timestamp()); end if;
   perform set_config('v1b.notified',(v_used+1)::text,true);
 end if;
 insert into private.probe_events values ('WAVE',nid,pg_current_xact_id());
 if k in ('FAIL','LIMITED_FAIL') then raise exception 'PROBE_FAIL'; end if;
 if k in ('SENT','LIMITED') then return jsonb_build_object('status','SENT','deadlineAt','2026-11-08T15:15:00Z'); end if;
 if k='FILLED' then return jsonb_build_object('status','STOPPED','reason','SLOTS_FILLED'); end if;
 return jsonb_build_object('status','STOPPED','reason','NO_ELIGIBLE_CANDIDATES');
 end $wave_fixture$;
 `);
 return db;
}
async function seed(db,kinds){
 for(let i=0;i<kinds.length;i++){
  await db.query('insert into public.needs(id,probe_kind) values($1,$2)',[id(i+1),kinds[i]]);
  await db.query("insert into private.dispatch_schedule(need_id,next_run_at) values($1,$2)",[id(i+1),B]);
 }
}
const rows=(db,q)=>db.query(q).then(r=>r.rows);

test('retired R13 cooperative draft cannot be applied accidentally',async()=>{
 const db=await fixture();try{
  assert.ok(source.startsWith('-- R13 source-only architectural candidate'));
  assert.ok(source.indexOf('R13_COOPERATIVE_DISPATCH_SOURCE_ONLY')<source.indexOf('CREATE OR REPLACE PROCEDURE'));
  await assert.rejects(db.exec(source),/R13_COOPERATIVE_DISPATCH_SOURCE_ONLY/);
  assert.deepEqual(await rows(db,"select to_regprocedure('private.dispatch_cooperative_candidate(integer,timestamptz)') as proc"),[{proc:null}]);
 }finally{await db.close();}
});

test('one profile sweep and each Need in an independent committed transaction; retry/state preserved',async()=>{
 const db=await fixture();try{
  await seed(db,['SENT','FILLED','NO','FAIL']);
  await db.exec(executable);
  const perms=await rows(db,`select has_function_privilege('anon','private.dispatch_cooperative_candidate(integer,timestamptz)','EXECUTE') as anon,
 has_function_privilege('authenticated','private.dispatch_cooperative_candidate(integer,timestamptz)','EXECUTE') as auth,
 has_function_privilege('service_role','private.dispatch_cooperative_candidate(integer,timestamptz)','EXECUTE') as svc`);
  assert.deepEqual(perms,[{anon:false,auth:false,svc:false}]);
  await db.exec(`CALL private.dispatch_cooperative_candidate(4,'${B}'::timestamptz);`);
  const event=await rows(db,'select event,need_id,transaction_id::text as txid from private.probe_events');
  assert.equal(event.filter(e=>e.event==='SWEEP').length,1);
  assert.deepEqual(event.filter(e=>e.event==='WAVE').map(e=>e.need_id),[id(1),id(2),id(3)]);
  assert.equal(new Set(event.map(e=>e.txid)).size,4,'sweep and three successful Need waves require separate transactions');
  assert.deepEqual(await rows(db,`select need_id,last_status,attempts,last_reason from private.dispatch_schedule order by need_id`),[
   {need_id:id(1),last_status:'SENT',attempts:0,last_reason:null},
   {need_id:id(3),last_status:'STOPPED',attempts:1,last_reason:'NO_ELIGIBLE_CANDIDATES'},
   {need_id:id(4),last_status:'ERROR',attempts:1,last_reason:'PROBE_FAIL'},
  ]);
  assert.equal((await rows(db,'select count(*)::int as n from private.probe_events where event=\'WAVE\''))[0].n,3);
 }finally{await db.close();}
});

test('injected scheduler crash after first commit cannot undo completed Need; restart respects queue cursor',async()=>{
 const db=await fixture();try{
  await seed(db,['SENT','SENT']);
  const needle='    v_processed := v_processed + 1;\n    -- Core property:';
  assert.ok(executable.includes(needle));
  const injected=executable.replace(needle,`    v_processed := v_processed + 1;\n    -- Core property:`);
  // Insert a failpoint only in this synthetic test, AFTER its first task COMMIT.
  const marker='    COMMIT;\n  END LOOP;';
  assert.ok(injected.includes(marker));
  await db.exec(injected.replace(marker,`    COMMIT;\n    IF v_processed=1 THEN RAISE EXCEPTION 'SYNTHETIC_CRASH_AFTER_COMMIT'; END IF;\n  END LOOP;`));
  await assert.rejects(db.exec(`CALL private.dispatch_cooperative_candidate(2,'${B}'::timestamptz)`),/SYNTHETIC_CRASH_AFTER_COMMIT/);
  assert.equal((await rows(db,"select count(*)::int as n from private.dispatch_schedule where last_status='SENT'"))[0].n,1);
  const firstTx=await rows(db,"select transaction_id::text as txid from private.probe_events where event='WAVE'");
  assert.equal(firstTx.length,1);
  // Reinstall the candidate and retry. First Need must not be sent again.
  await db.exec(executable);
  await db.exec(`CALL private.dispatch_cooperative_candidate(2,'${B}'::timestamptz)`);
  const events=await rows(db,"select need_id from private.probe_events where event='WAVE' order by need_id");
  assert.deepEqual(events.map(x=>x.need_id),[id(1),id(2)]);
 }finally{await db.close();}
});


test('cooperative budget is carried across commits, without exceeding the old per-cycle ceiling',async()=>{
 const db=await fixture();try{
  await seed(db,['LIMITED','LIMITED','LIMITED']);
  await db.exec(executable);
  await db.exec("CALL private.dispatch_cooperative_candidate(3,'"+B+"'::timestamptz)");
  const events=await rows(db,"select need_id,transaction_id::text as tx from private.probe_events where event='WAVE' order by need_id");
  assert.deepEqual(events.map(x=>x.need_id),[id(1),id(2)],'third wave must wait after cycle allowance 2');
  assert.equal(new Set(events.map(x=>x.tx)).size,2,'successful waves still commit independently');
  const states=await rows(db,"select need_id,last_status from private.dispatch_schedule order by need_id");
  assert.ok(states.every(x=>x.last_status==='SENT'),'deferred entry remains queued with exact next_run_at');
 }finally{await db.close();}
});

test('cooperative budget ignores an exception-rolled-back reservation and admits next two workers',async()=>{
 const db=await fixture();try{
  await seed(db,['LIMITED_FAIL','LIMITED','LIMITED','LIMITED']);
  await db.exec(executable);
  await db.exec("CALL private.dispatch_cooperative_candidate(4,'"+B+"'::timestamptz)");
  const events=await rows(db,"select need_id from private.probe_events where event='WAVE' order by need_id");
  assert.deepEqual(events.map(x=>x.need_id),[id(2),id(3)]);
  const first=(await rows(db,"select attempts,last_status from private.dispatch_schedule where need_id='"+id(1)+"'"))[0];
  assert.deepEqual(first,{attempts:1,last_status:'ERROR'});
 }finally{await db.close();}
});

test('cooperative dispatch refuses ordinary authenticated caller even with schema visibility',async()=>{
 const db=await fixture();try{
  await seed(db,['SENT']);
  await db.exec(executable);
  await db.exec('GRANT USAGE ON SCHEMA private TO authenticated');
  await db.exec('SET ROLE authenticated');
  try {
   await assert.rejects(db.exec(`CALL private.dispatch_cooperative_candidate(1,'${B}'::timestamptz)`),
    /permission denied for procedure|R13_SCHEDULER_ROLE_REQUIRED/);
  } finally { await db.exec('RESET ROLE'); }
  assert.equal((await rows(db,"select count(*)::int as n from private.probe_events"))[0].n,0);
 }finally{await db.close();}
});

test('cooperative dispatch must be top-level CALL, not nested in an existing transaction',async()=>{
 const db=await fixture();try{
  await seed(db,['SENT']);
  await db.exec(executable);
  await db.exec('BEGIN');
  try {
   await assert.rejects(db.exec(`CALL private.dispatch_cooperative_candidate(1,'${B}'::timestamptz)`),
    /invalid transaction termination|transaction control is not allowed|cannot commit while a subtransaction is active/i);
  } finally { await db.exec('ROLLBACK'); }
  assert.equal((await rows(db,"select count(*)::int as n from private.probe_events"))[0].n,0);
  assert.deepEqual((await rows(db,'select last_status,attempts from private.dispatch_schedule')),
   [{last_status:null,attempts:0}]);
 }finally{await db.close();}
});

test('cooperative dispatch skips leased and future-due Needs without changing their retry state',async()=>{
 const db=await fixture();try{
  await seed(db,['SENT','SENT','SENT']);
  await db.exec(executable);
  await db.query("update private.dispatch_schedule set locked_until=$1 where need_id=$2",
   ['2026-11-08T15:05:00Z',id(1)]);
  await db.query("update private.dispatch_schedule set next_run_at=$1 where need_id=$2",
   ['2026-11-08T15:10:00Z',id(2)]);
  await db.exec(`CALL private.dispatch_cooperative_candidate(3,'${B}'::timestamptz)`);
  const events=await rows(db,"select need_id from private.probe_events where event='WAVE'");
  assert.deepEqual(events,[{need_id:id(3)}]);
  const queue=await rows(db,'select need_id,last_status,attempts from private.dispatch_schedule order by need_id');
  assert.deepEqual(queue,[
   {need_id:id(1),last_status:null,attempts:0},
   {need_id:id(2),last_status:null,attempts:0},
   {need_id:id(3),last_status:'SENT',attempts:0},
  ]);
 }finally{await db.close();}
});
