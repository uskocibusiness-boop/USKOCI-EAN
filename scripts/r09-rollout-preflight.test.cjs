'use strict';
// The DEV wrapper protects the conservative observation backfill from suppressing
// any already-admitted pending worker/task pair. No hosted connection or sender.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {fixture,profileId,needId}=require('./r09-worker-activation-fixture.cjs');
const directory=path.join(__dirname,'../supabase/migrations');
const files=fs.readdirSync(directory).filter(name=>/^\d{14}_r09_worker_activation_clock_20261108\.sql$/.test(name));
assert.equal(files.length,1,'One reviewed canonical DEV migration is required');
const migration=fs.readFileSync(path.join(directory,files[0]),'utf8');

test('R09 DEV rollout refuses a pending admitted pair atomically, without a clock or changed data',async()=>{
 const f=await fixture();
 try{
  await f.addWorker(1);await f.addNeed(1,{publishedAt:'2026-11-01T00:00:00Z'});await f.installProfileGuard();
  assert.equal(await f.value('select private.dispatch_cheap_candidate_admitted($1,$2) as value',[needId(1),profileId(1)]),true);
  const profile=await f.value('select to_jsonb(p) as value from public.app_profiles p where id=$1',[profileId(1)]);
  await assert.rejects(f.db.exec(migration),/R09_ROLLOUT_PENDING_OPPORTUNITIES_REQUIRE_REVIEW/);
  await f.db.exec('rollback');
  assert.equal(await f.value("select count(*)::int as value from pg_attribute where attrelid='public.app_profiles'::regclass and attname='worker_dispatch_eligible_since' and not attisdropped"),0);
  assert.deepEqual(await f.value('select to_jsonb(p) as value from public.app_profiles p where id=$1',[profileId(1)]),profile);
  assert.equal((await f.counts()).opportunities,0);
 }finally{await f.db.close();}
});

test('R09 DEV rollout applies with zero pending pairs, keeps old source hash and admits a later publication',async()=>{
 const f=await fixture();
 try{
  await f.addWorker(1);await f.installProfileGuard();
  const before=await f.value('select private.worker_ai_source_hash(account_id) as value from public.app_profiles where id=$1',[profileId(1)]);
  await f.db.exec(migration);
  assert.equal(await f.value('select private.worker_ai_source_hash(account_id) as value from public.app_profiles where id=$1',[profileId(1)]),before);
  assert.equal(await f.value('select worker_dispatch_clock_source as value from public.app_profiles where id=$1',[profileId(1)]),'ROLLOUT_ACTIVE_OBSERVED');
  await f.addNeed(1);
  assert.equal(await f.value('select private.dispatch_cheap_candidate_admitted($1,$2) as value',[needId(1),profileId(1)]),true);
 }finally{await f.db.close();}
});
