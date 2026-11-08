'use strict';
// Exact captured DEV dispatch_next_wave + dispatch_config_v1b bodies; only
// external worker admission/detail and event sink are synthetic. Nothing hosted.
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const root=path.join(__dirname,'..');
const capture=name=>JSON.parse(fs.readFileSync(path.join(root,'docs/plan/proofs/dispatch-boundary-20261108/recovered',name),'utf8'));
const dispatch=capture('capacity3_dispatch_dependencies_20261108.preimage.json').functions.find(x=>x.signature==='private.dispatch_next_wave(uuid)');
const config=capture('capacity4_dispatch_wave_dependencies_20261108.preimage.json').functions.find(x=>x.signature==='private.dispatch_config_v1b(jsonb)');
const candidate=fs.readFileSync(path.join(__dirname,'sql/r13_dispatch_cooperative_candidate.sql'),'utf8');
// Real wave/budget suite with the profile step stubbed at its named boundary.
// Non-idle profile/cursor transactions have their own captured-SQL/native suite.
const isolated=candidate.slice(candidate.indexOf('-- R13_ISOLATED_TEST_PROCEDURE_START')).split('-- R13_ISOLATED_TEST_PROFILE_STEP_START')[0];
const uuid=(prefix,n)=>`${prefix}-0000-4000-8000-${String(n).padStart(12,'0')}`;
const NEED_1=uuid('90000000',1),NEED_2=uuid('90000000',2);
const row=async(db,q)=> (await db.query(q)).rows;
const count=async(db,q)=>Number((await db.query(q)).rows[0].n);
function sourceVerified(){
 assert.equal(dispatch.bodyMd5,'d3cdfe2bdd6e5d40a74e6029793c89c5');
 assert.equal(config.bodyMd5,'7aa34ff0b5f4a3637c433bec317c1c13');
 assert.equal(crypto.createHash('md5').update(dispatch.definition.split('AS $function$')[1].split('$function$')[0]).digest('hex'),dispatch.bodyMd5);
 assert.ok(candidate.includes('R13_COOPERATIVE_DISPATCH_SOURCE_ONLY'));
}
async function fixture(){
 sourceVerified();
 const db=new PGlite();
 await db.exec(`
 create schema private;
 create role anon;create role authenticated;create role service_role;
 create table public.needs(id uuid primary key,revision integer not null default 1,status text not null default 'PUBLISHED',
  remaining_search_closed_at timestamptz, required_slots integer not null default 1,urgent boolean not null default false,
  urgent_expires_at timestamptz,execution_location_mode text not null default 'STATIONARY',
  approx_geog text default 'approx-location',title text not null default 'Pomoć');
 create table public.need_selections(need_id uuid,status text,covered_slots integer);
 create table public.marketplace_responses(need_id uuid,submitted_against_need_revision integer,status text,covered_slots integer);
 create table public.app_profiles(id uuid primary key,account_id uuid unique not null);
 create table public.dispatch_rounds(id uuid primary key,need_id uuid,need_revision integer,round_no integer,
  urgency text,batch_size integer,target_responses integer,candidate_limit_used integer,budget_source text,
  status text,deadline_at timestamptz,stop_reason text);
 create table public.opportunity_deliveries(worker_account_id uuid not null,worker_profile_id uuid not null,
  need_id uuid not null,need_revision integer not null,dispatch_round_id uuid,match_score numeric,
  score_components jsonb,reason_codes text[],status text,expires_at timestamptz,
  unique(worker_account_id,need_id,need_revision));
 create table private.probe_push(recipient uuid,need_id uuid,need_revision integer,dedupe text unique,txid xid8);
 create table private.probe_events(event text,need_id uuid,txid xid8);
 create table private.marketplace_config(key text primary key,value jsonb not null);
 insert into private.marketplace_config values('dispatch_normal',
   '{"waveSizes":[25],"targetResponses":1,"windowMinutes":15}'::jsonb),
  ('match_v1_dispatch',
   '{"mode":"ALL","ceiling":60,"validMinutes":1440,"workerDailyCap":1000,"workerNotifyPerTransaction":50,"remoteWaves":false,"tickBudgetSeconds":40}'::jsonb);
 create table private.dispatch_schedule(need_id uuid primary key references public.needs(id),
  next_run_at timestamptz not null,locked_until timestamptz,attempts integer not null default 0,
  last_status text,last_reason text,updated_at timestamptz);
 create function private.requeue_changed_worker_profile_candidate(p_at timestamptz) returns jsonb language plpgsql as $$
 begin insert into private.probe_events values('SWEEP',NULL,pg_current_xact_id());return '{}'::jsonb;end $$;
 create function private.need_search_time_admitted_v1(uuid,timestamptz) returns boolean language sql stable as $$select true$$;
 create function private.candidate_profile_ids_v1b(nid uuid,lim integer,cap integer) returns setof uuid
 language sql stable as $$select p.id from public.app_profiles p where not exists(
  select 1 from public.opportunity_deliveries d where d.need_id=nid and d.need_revision=1
  and d.worker_profile_id=p.id) order by p.id limit lim$$;
 create function private.match_detail(uuid,uuid) returns jsonb language sql stable as $$
  select jsonb_build_object('dispatchEligible',true,'score',100,'timeTier',1,'reasonCodes','["TEST_ELIGIBLE"]'::jsonb,
    'distanceToStartKm',null,'effectiveRadiusKm',50,'distanceSource','TEST','taskLocationMode','STATIONARY')$$;
 create function private.emit_event(p_recipient uuid,p_role text,p_event_type text,p_entity_type text,p_entity_id uuid,
  p_entity_version integer,p_title text,p_body text,p_dedupe_key text,p_urgency text,p_payload jsonb,
  p_expires_at timestamptz) returns void language plpgsql as $$
 begin insert into private.probe_push values(p_recipient,p_entity_id,p_entity_version,p_dedupe_key,pg_current_xact_id())
 on conflict do nothing;end $$;
 `);
 await db.exec(config.definition);
 await db.exec(dispatch.definition);
 await db.exec(isolated);
 for(const need of [NEED_1,NEED_2]){
  await db.query('insert into public.needs(id) values($1)',[need]);
  await db.query('insert into private.dispatch_schedule(need_id,next_run_at) values($1,now()-interval \'1 minute\')',[need]);
 }
 for(let i=1;i<=60;i++)await db.query('insert into public.app_profiles(id,account_id) values($1,$2)',[uuid('80000000',i),uuid('70000000',i)]);
 return db;
}

test('captured real ON_SITE dispatch with 60 workers respects cross-Need 50 notification limit and durable deduplication',async()=>{
 const db=await fixture();try{
  const call=()=>db.exec('CALL private.dispatch_cooperative_candidate(2, statement_timestamp())');
  await call();
  assert.equal(await count(db,'select count(*)::int as n from public.opportunity_deliveries'),50);
  assert.equal(await count(db,'select count(*)::int as n from private.probe_push'),50);
  const pushes=await row(db,'select need_id,count(*)::int as n from private.probe_push group by 1');
  assert.deepEqual(pushes,[{need_id:NEED_1,n:50}]);
  const waves=await row(db,"select event,txid::text as xid from private.probe_events where event='SWEEP'");
  assert.equal(waves.length,1);
  await call();
  assert.equal(await count(db,'select count(*)::int as n from public.opportunity_deliveries'),100);
  assert.equal(await count(db,'select count(*)::int as n from private.probe_push'),100);
  await call();
  assert.equal(await count(db,'select count(*)::int as n from public.opportunity_deliveries'),120);
  assert.equal(await count(db,'select count(*)::int as n from private.probe_push'),120);
  assert.equal(await count(db,'select count(distinct dedupe)::int as n from private.probe_push'),120);
  await call();
  assert.equal(await count(db,'select count(*)::int as n from private.probe_push'),120);
  const grouped=await row(db,'select need_id,count(*)::int as n from public.opportunity_deliveries group by 1 order by need_id');
  assert.deepEqual(grouped,[{need_id:NEED_1,n:60},{need_id:NEED_2,n:60}]);
 } finally { await db.close(); }
});

test('captured real wave survives crash after first 50 deliveries; restart sends remaining without duplicates',async()=>{
 const db=await fixture();try{
  const marker='    COMMIT;\n  END LOOP;';
  assert.ok(isolated.includes(marker),'must inject failure only after confirmed per-Need COMMIT');
  await db.exec(isolated.replace(marker,`    COMMIT;\n    IF v_processed=1 THEN RAISE EXCEPTION 'TEST_CRASH_AFTER_REAL_WAVE_COMMIT'; END IF;\n  END LOOP;`));
  const call=()=>db.exec('CALL private.dispatch_cooperative_candidate(2,statement_timestamp())');
  await assert.rejects(call(),/TEST_CRASH_AFTER_REAL_WAVE_COMMIT/);
  assert.equal(await count(db,'select count(*)::int as n from public.opportunity_deliveries'),50);
  assert.equal(await count(db,'select count(*)::int as n from private.probe_push'),50);
  assert.equal(await count(db,"select count(*)::int as n from private.dispatch_schedule where last_status='SENT'"),1);
  await db.exec(isolated);
  for(let i=0;i<3;i++)await call();
  assert.equal(await count(db,'select count(*)::int as n from public.opportunity_deliveries'),120);
  assert.equal(await count(db,'select count(*)::int as n from private.probe_push'),120);
  assert.equal(await count(db,'select count(distinct dedupe)::int as n from private.probe_push'),120);
  const after=await row(db,'select need_id,count(*)::int as n from public.opportunity_deliveries group by 1 order by need_id');
  assert.deepEqual(after,[{need_id:NEED_1,n:60},{need_id:NEED_2,n:60}]);
 }finally{await db.close();}
});
