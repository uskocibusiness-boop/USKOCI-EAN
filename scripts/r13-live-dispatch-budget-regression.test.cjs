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


test('retired urgency UI has no activation, badges, timers or quiet-hours bypass',()=>{
 const urgency=fs.readFileSync(path.join(__dirname,'..','src/lib/needUrgency.ts'),'utf8');
 const activation=fs.readFileSync(path.join(__dirname,'..','src/ui/v2/UrgentActivationActions.tsx'),'utf8');
 const badge=fs.readFileSync(path.join(__dirname,'..','src/ui/v2/NeedUrgencyBadge.tsx'),'utf8');
 const push=fs.readFileSync(path.join(__dirname,'..','src/ui/notifications/PushPreferences.tsx'),'utf8');
 const profile=fs.readFileSync(path.join(__dirname,'..','src/ui/workerProfile/WorkerProfileSaved.tsx'),'utf8');
 assert.match(urgency,/urgentBuilt[\s\S]*return false/);
 assert.match(urgency,/displaysUrgent[\s\S]*return false/);
 assert.doesNotMatch(activation,/urgentActivationClientService|urgentActivationPreviewClientService|useConfirmSheet/);
 assert.match(activation,/export function UrgentActivationActions[\s\S]*return null/);
 assert.doesNotMatch(badge,/Lightning|setTimeout|accessibilityLabel="HITNO"/);
 assert.match(badge,/export function NeedUrgencyBadge[\s\S]*return null/);
 assert.doesNotMatch(push,/urgentBuilt|Hitno može i tokom tihih sati|Hitni događaji mogu da prođu/);
 assert.doesNotMatch(profile,/<SwitchRow[^>]*label="Mogu odmah"/);
});

test('urgency dispatch retirement candidate is source-only, guarded and preserves normal calendar matching',()=>{
 const candidate=fs.readFileSync(path.join(__dirname,'sql/dispatch_retire_urgency_20261119.candidate.sql'),'utf8');
 assert.ok(candidate.startsWith('-- USKOCI 2026-11-19: retire task urgency branches'));
 assert.ok(candidate.indexOf("RAISE EXCEPTION 'DISPATCH_URGENCY_RETIREMENT_SOURCE_ONLY'")<candidate.indexOf('BEGIN;'));
 assert.match(candidate,/bd1d2fd351d8273ddc0cce9e29514ca7/);
 assert.match(candidate,/2ba676d2f0fbd1456b48eb1ef36b468e/);
 assert.match(candidate,/private\.candidate_budget\(false,/);
 assert.match(candidate,/p_urgency => 'NORMAL'/);
 assert.match(candidate,/pace_minutes := wave_minutes/);
 assert.match(candidate,/order by \(s\.detail->>'score'\)::numeric desc, s\.pid/);
 assert.match(candidate,/DISPATCH_URGENCY_MAIN_PREIMAGE_DRIFT/);
 assert.match(candidate,/DISPATCH_URGENCY_REMOTE_PREIMAGE_DRIFT/);
 assert.doesNotMatch(candidate,/DROP\s+(TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM/i);
});
