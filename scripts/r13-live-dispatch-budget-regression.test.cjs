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
 const workerAi=fs.readFileSync(path.join(__dirname,'..','src/ui/workerProfile/WorkerAiPresentation.tsx'),'utf8');
 const home=fs.readFileSync(path.join(__dirname,'..','src/ui/home/HomePresentation.tsx'),'utf8');
 const facts=fs.readFileSync(path.join(__dirname,'..','src/ui/workerProfile/workerProfileFacts.ts'),'utf8');
 assert.match(urgency,/urgentBuilt[\s\S]*return false/);
 assert.match(urgency,/displaysUrgent[\s\S]*return false/);
 assert.doesNotMatch(activation,/urgentActivationClientService|urgentActivationPreviewClientService|useConfirmSheet/);
 assert.match(activation,/export function UrgentActivationActions[\s\S]*return null/);
 assert.doesNotMatch(badge,/Lightning|setTimeout|accessibilityLabel="HITNO"/);
 assert.match(badge,/export function NeedUrgencyBadge[\s\S]*return null/);
 assert.doesNotMatch(push,/urgentBuilt|Hitno može i tokom tihih sati|Hitni događaji mogu da prođu/);
 assert.doesNotMatch(profile,/<SwitchRow[^>]*label="Mogu odmah"/);
 assert.doesNotMatch(workerAi,/Mogu odmah|WORKER_AVAILABLE_NOW_ENABLED/);
 assert.doesNotMatch(home,/Mogu odmah|availableNow|WORKER_AVAILABLE_NOW_ENABLED/);
 assert.doesNotMatch(facts,/Mogu odmah|availableNow|WORKER_AVAILABLE_NOW_ENABLED/);
 assert.equal(fs.existsSync(path.join(__dirname,'..','src/data/urgentActivationClientService.ts')),false);
 assert.equal(fs.existsSync(path.join(__dirname,'..','src/data/urgentActivationPreviewClientService.ts')),false);
});

test('urgency dispatch retirement candidate is source-only, guarded and preserves normal calendar matching',()=>{
 const candidate=fs.readFileSync(path.join(__dirname,'sql/dispatch_retire_urgency_20261119.candidate.sql'),'utf8');
 assert.ok(candidate.startsWith('-- USKOCI 2026-11-19: retire task urgency branches'));
 assert.ok(candidate.indexOf("RAISE EXCEPTION 'DISPATCH_URGENCY_RETIREMENT_SOURCE_ONLY'")<candidate.indexOf('BEGIN;\nSET LOCAL lock_timeout'));
 assert.match(candidate,/bd1d2fd351d8273ddc0cce9e29514ca7/);
 assert.match(candidate,/2ba676d2f0fbd1456b48eb1ef36b468e/);
 assert.match(candidate,/693aef615d4184abe4cb4809a2783c93/);
 assert.match(candidate,/8227474bb353238ee09816ea5085666e/);
 assert.match(candidate,/private\.candidate_budget\(false,/);
 assert.match(candidate,/p_urgency => 'NORMAL'/);
 assert.match(candidate,/pace_minutes := wave_minutes/);
 assert.match(candidate,/order by \(s\.detail->>'score'\)::numeric desc, s\.pid/);
 assert.match(candidate,/DISPATCH_URGENCY_MAIN_PREIMAGE_DRIFT/);
 assert.match(candidate,/DISPATCH_URGENCY_REMOTE_PREIMAGE_DRIFT/);
 assert.doesNotMatch(candidate,/DROP\s+(TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM/i);
});

test('urgency retirement candidate covers dispatch, matching gates, push and read projections without deleting history',()=>{
 const read=require('node:fs').readFileSync,join=require('node:path').join;
 const sql=read(join(__dirname,'sql/dispatch_retire_urgency_20261119.candidate.sql'),'utf8');
 const expected=[
 ['private.dispatch_next_wave','bd1d2fd351d8273ddc0cce9e29514ca7','693aef615d4184abe4cb4809a2783c93'],
 ['private.dispatch_remote_wave_v1b','2ba676d2f0fbd1456b48eb1ef36b468e','8227474bb353238ee09816ea5085666e'],
 ['private.worker_notify_room_v1b','9aac9da0479327fdf82b2f9298e47719','e3e40bcc507bb0a99817d8cdd555dbcc'],
 ['private.push_suppression','ebd9c03035630bde62bf9fd8a27378c2','e9f104bc1a62aefd73d52fee8294c52d'],
 ['private.match_detail_without_calendar','41b54908d3f461420c3826ad8b723880','2f9e140d4e938f6c7dda8829d41dd04a'],
 ['private.emit_event','586c40786332a9863922585503f083f6','60ae03c2d6acf0f01b86a8470881f6e4'],
 ['public.rpc_claim_push_transport','7c9145f1b9696f9ed6e4a29949228b58','60d39927470ef866f7757212ea1ddfe1'],
 ['public.rpc_begin_push_send','e693b140450a9bb1cf6d3178b0ad80c1','c6b35e8fa0069acdc96a7be851a5ef5f'],
 ['public.rpc_list_open_tasks_v3','7c1d9a979585deae6c2bc2c1b9d597b1','8e8ee643e72c9efab746b6a9e7f6ec08'],
 ['public.rpc_discovery_v1','c75535d3f77b2216ed424843ef57ef04','dc53bf4f14b1e35fdb1e12ff883d1edb'],
 ['public.rpc_read_task','1e01db5140248f27ab374187f01fded3','6989659ffc9d6445333ab06e6df9c597'],
 ['public.rpc_get_worker_profile_for_edit','0b081654ef574b197d978d31db362d68','fbb1c121f266200dc2d456e17ceac35f'],
 ['public.fn_need_urgency','8845c7ad50ab5e64aa853043c113a15a','1b59a466661a3c7400fcced26ad17f7d'],
 ['public.rpc_activate_urgent','e3d13df0b0cf181334a30efa7576a312','fd0cfe668f4ee12451ab316ac46a6215']
 ];
 for(const [name,pre,post] of expected){assert.ok(sql.includes(name),'missing '+name);assert.ok(sql.includes(pre),'missing preimage '+name);assert.ok(sql.includes(post),'missing postimage '+name);}
 assert.match(sql,/DISPATCH_URGENCY_RETIREMENT_SOURCE_ONLY/);assert.match(sql,/order by x\.created_at,x\.id/);
 assert.match(sql,/'priority','NORMAL'/);assert.match(sql,/p_urgency := 'NORMAL'/);assert.match(sql,/URGENCY_RETIRED/);assert.match(sql,/URGENT_FEATURE_RETIRED/);
 assert.doesNotMatch(sql,/\bDROP\s+(?:TABLE|COLUMN)\b|\bTRUNCATE\b/i);
 assert.doesNotMatch(sql,/DELETE\s+FROM\s+(?:public\.)?(?:needs|agreements|worker_profiles|worker_availability)/i);
});
test('canonical matcher is service, geography and calendar based; resources, price, device status and immediate availability never gate candidates',()=>{
 const read=require('node:fs').readFileSync,join=require('node:path').join;
 const snap=JSON.parse(read(join(__dirname,'sql/r13_native_matcher_20261108.preimage.json'),'utf8'));
 const fn=p=>snap.functions.find(f=>f.signature.startsWith(p+'('));
 const fit=fn('private.worker_need_fit_v1'),time=fn('private.worker_need_time_tier_v1'),periods=fn('private.worker_available_periods'),conflict=fn('private.worker_calendar_conflict'),interval=fn('private.match_detail_for_calendar_interval');
 assert.ok(fit&&time&&periods&&conflict&&interval);
 assert.equal(fit.body_md5,'fd81bdd1a86946a43399e136d5534e99');
 assert.equal(time.body_md5,'4b5cad712fb749d4009d55fd2ecf5c3b');
 assert.equal(periods.body_md5,'5107af3020a3beb7bb45e6e90e7a203b');
 assert.equal(conflict.body_md5,'417c9db16bbe70ed9ad652380790900c');
 assert.equal(interval.body_md5,'781956cab666befab216b3ce2334ca1d');
 assert.match(fit.definition,/taxonomy_handoff_fit_v1/);assert.match(fit.definition,/worker_area_fit_v1/);assert.match(fit.definition,/worker_need_time_tier_v1/);
 assert.doesNotMatch(fit.definition,/available_now|availableNow|\bvehicles?\b|\btools?\b|\bexperience\b|\bonline\b|\boffline\b|\bprice\b|\bbudget\b/i);
 assert.match(time.definition,/worker_available_periods/);assert.match(time.definition,/profile_availability_rules/);assert.match(time.definition,/profile_availability_windows/);assert.match(time.definition,/at time zone/i);
 assert.doesNotMatch(time.definition,/available_now|availableNow/i);
 assert.match(periods.definition,/worker_calendar_events/);assert.match(periods.definition,/profile_availability_rules/);assert.match(periods.definition,/profile_availability_windows/);
 assert.match(conflict.definition,/worker_calendar_events/);assert.match(conflict.definition,/BLOCKING/);assert.match(conflict.definition,/agreement_id/);
 assert.match(interval.definition,/worker_calendar_conflict/);assert.match(interval.definition,/CALENDAR_CONFLICT/);assert.match(interval.definition,/dispatchEligible/);
});
test('retired urgency client adapters and badges cannot issue urgency reads or display an urgency state',()=>{
 const read=require('node:fs').readFileSync,join=require('node:path').join;
 const client=read(join(__dirname,'../src/data/needUrgencyClientService.ts'),'utf8');
 const badge=read(join(__dirname,'../src/ui/v2/NeedUrgencyBadge.tsx'),'utf8');
 const activation=read(join(__dirname,'../src/ui/v2/UrgentActivationActions.tsx'),'utf8');
 assert.match(client,/return new Map\(\)/);assert.doesNotMatch(client,/supabaseKlijent|fn_need_urgency|readOwnedResult/);
 assert.match(badge,/return null/);assert.match(activation,/return null/);
});
