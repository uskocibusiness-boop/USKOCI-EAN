'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const r13=read('scripts/sql/r13_instant_push_and_capacity_dispatch_20261108.sql');
const forward=read('supabase/migrations/20261108141444_r13_short_publication_transaction_20261108.sql');
test('R13 publication is queue-only, without heavy in-transaction matching',()=>{
 const part=r13.slice(r13.indexOf('CREATE OR REPLACE FUNCTION private.enqueue_on_need_change()'),r13.indexOf('-- 4. Worker default availability'));
 assert.ok(part.length>450);
 assert.ok(part.includes('perform private.enqueue_dispatch(new.id, statement_timestamp());'));
 assert.ok(!part.includes('perform private.dispatch_next_wave(new.id);'));
});
test('R13 repair guards source fingerprint and unchanged privileges',()=>{
 for(const key of ['ea56b40af1ebd687d1713f75e619392c','3f7d263b9e1724e683c9c920ed782550','R13_SHORT_PUBLICATION_PREIMAGE_DRIFT','R13_SHORT_PUBLICATION_POSTIMAGE_DRIFT','v_acl','v_owner','v_privileged','v_settings','execute v_new_definition'])assert.ok(forward.includes(key),key);
 assert.ok(forward.includes("set local statement_timeout='10s'"));
});

// A historical draft still contains larger wave settings and a pre-coalescing
// push wake definition. Prove that accidentally executing it cannot change
// even the first marketplace row, or recreate the trigger.
test('R13 unapproved 300k/old-push draft fails before its first side effect', async()=>{
 const {PGlite}=require('@electric-sql/pglite');
 const db=new PGlite();
 try {
  await db.exec(`create schema private;
   create table private.marketplace_config(key text primary key,value jsonb not null,updated_at timestamptz);
   insert into private.marketplace_config values ('dispatch_normal', '{"waveSizes":[1],"candidateLimit":3}'::jsonb,now());`);
  assert.match(r13,/^-- RETIRED \/ QUARANTINED historical candidate/);
  assert.ok(r13.indexOf('R13_HISTORICAL_CAPACITY_CANDIDATE_DISABLED') < r13.indexOf('UPDATE private.marketplace_config'));
  await assert.rejects(db.exec(r13),/R13_HISTORICAL_CAPACITY_CANDIDATE_DISABLED/);
  assert.deepEqual((await db.query('select value from private.marketplace_config where key=$1',['dispatch_normal'])).rows[0].value,
   {waveSizes:[1],candidateLimit:3});
  assert.deepEqual((await db.query("select to_regprocedure('private.wake_push_worker()') as fn")).rows,[{fn:null}]);
  assert.deepEqual((await db.query("select to_regclass('public.notification_deliveries') as tab")).rows,[{tab:null}]);
 }finally{await db.close();}
});
