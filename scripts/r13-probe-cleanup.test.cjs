'use strict';
// Isolated SQL acceptance for removal of two synthetic diagnostic objects.
// cron.job is a local catalog fixture; no hosted database or provider is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const root = path.join(__dirname, '..');
const setup = fs.readFileSync(path.join(root, 'supabase/migrations/20261108230512_r13_hosted_transaction_probe_20261108.sql'), 'utf8');
const cleanup = fs.readFileSync(path.join(__dirname, 'sql/r13_transaction_probe_cleanup_20261109.sql'), 'utf8');
const rollback = fs.readFileSync(path.join(__dirname, 'sql/r13_transaction_probe_cleanup_20261109.rollback.sql'), 'utf8');
const observations = `insert into private.capacity4_transaction_probe values
 ('before',203348825,'2026-11-08 23:06:00.153974+00'),
 ('after',203348826,'2026-11-08 23:06:00.164508+00');`;
let createDatabase = async () => new PGlite();
async function fixture() {
  const db = await createDatabase();
  await db.exec(`create schema private;create schema cron;create role anon;create role authenticated;create role service_role;
    create table cron.job(jobname text primary key,command text);
    insert into cron.job values('uskoci_marketplace_tick','select private.marketplace_tick(25);'),
      ('uskoci_edge_workers','select 1'),('uskoci_taxonomy_postsave_tick_dev','select 2');
    create table public.business_sentinel(id integer primary key,content text not null);
    insert into public.business_sentinel values(1,'unchanged');`);
  await db.exec(setup);
  await db.exec(observations);
  return db;
}
async function run(db, sql=cleanup) {
  try { return await db.exec(sql); }
  catch (error) { await db.exec('rollback'); throw error; }
}
const exists = async db => (await db.query(`select
  to_regclass('private.capacity4_transaction_probe') is not null as relation,
  to_regprocedure('private.capacity4_transaction_probe_v1()') is not null as routine`)).rows[0];
async function unchanged(db) {
  assert.deepEqual((await db.query('select * from public.business_sentinel')).rows,[{id:1,content:'unchanged'}]);
  assert.equal((await db.query('select count(*)::int as n from cron.job')).rows[0].n,3);
}

function registerProbeCleanupTests(factory) {
if (factory) createDatabase = factory;
test('R13 cleanup removes only the two completed probe objects; recreation retains the exact archived evidence',async()=>{
  const db=await fixture();try {
    await run(db);assert.deepEqual(await exists(db),{relation:false,routine:false});await unchanged(db);
    await db.exec(rollback);
    assert.deepEqual(await exists(db),{relation:true,routine:true});
    assert.equal((await db.query("select md5(prosrc) as value from pg_proc where oid='private.capacity4_transaction_probe_v1()'::regprocedure")).rows[0].value,'62051bf43e88a090ab14e98ab453f245');
    assert.deepEqual((await db.query(`select phase,transaction_id::text as xid,
      to_char(observed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at
      from private.capacity4_transaction_probe order by phase`)).rows,[
      {phase:'after',xid:'203348826',at:'2026-11-08T23:06:00.164508Z'},
      {phase:'before',xid:'203348825',at:'2026-11-08T23:06:00.153974Z'},
    ]);
    assert.deepEqual((await db.query(`select pg_get_userbyid(c.relowner) as owner,c.relacl::text as acl,
      c.relrowsecurity as rls,c.relforcerowsecurity as forced,obj_description(c.oid,'pg_class') as comment
      from pg_class c where c.oid='private.capacity4_transaction_probe'::regclass`)).rows,[{
      owner:'postgres',acl:'{postgres=arwdDxtm/postgres}',rls:true,forced:false,
      comment:'USKOCI disposable transaction CALL probe 20261108; synthetic diagnostic rows only',
    }]);
    assert.deepEqual((await db.query(`select pg_get_userbyid(proowner) as owner,proacl::text as acl,
      prosecdef as definer,proconfig as config,prokind as kind from pg_proc
      where oid='private.capacity4_transaction_probe_v1()'::regprocedure`)).rows,[{
      owner:'postgres',acl:'{postgres=X/postgres}',definer:false,config:null,kind:'p',
    }]);
    await unchanged(db);
  }finally{await db.close();}
});
test('R13 cleanup dry-run rollback preserves both diagnostic rows and every original Cron',async()=>{
  const db=await fixture();try {
    await run(db,cleanup.replace(/COMMIT;\s*$/,'ROLLBACK;'));
    assert.deepEqual(await exists(db),{relation:true,routine:true});
    assert.equal((await db.query('select count(*)::int as n from private.capacity4_transaction_probe')).rows[0].n,2);
    await unchanged(db);
  }finally{await db.close();}
});
for(const [label,change,error] of [
  ['changed procedure body',"create or replace procedure private.capacity4_transaction_probe_v1() language plpgsql as $$begin null;end$$",/PROCEDURE_DRIFT/],
  ['unexpected procedure grant','grant execute on procedure private.capacity4_transaction_probe_v1() to authenticated',/PROCEDURE_DRIFT/],
  ['changed diagnostic table comment',"comment on table private.capacity4_transaction_probe is 'different object'",/TABLE_DRIFT/],
  ['unexpected table grant','grant select on private.capacity4_transaction_probe to authenticated',/TABLE_DRIFT/],
  ['new data column','alter table private.capacity4_transaction_probe add column payload text',/SCHEMA_DRIFT/],
  ['changed diagnostic row',"update private.capacity4_transaction_probe set transaction_id=42 where phase='after'",/ROWS_DRIFT/],
  ['missing diagnostic observation',"delete from private.capacity4_transaction_probe where phase='after'",/ROWS_DRIFT/],
  ['scheduled original probe',"insert into cron.job values('uskoci_dispatch_call_probe_20261108','call private.capacity4_transaction_probe_v1();')",/JOB_PRESENT/],
  ['renamed Cron still calling probe',"insert into cron.job values('other_probe_name','call private.capacity4_transaction_probe_v1();')",/JOB_PRESENT/],
  ['new dependent view','create view public.dependent_probe as select phase from private.capacity4_transaction_probe',/depend/],
  ['new PLpgSQL textual dependency',"create function public.other_probe_reader() returns bigint language plpgsql as $$begin return (select count(*) from private.capacity4_transaction_probe);end$$",/ROUTINE_REFERENCE/],
]) test('R13 cleanup refuses '+label+' without partially dropping the other object',async()=>{
  const db=await fixture();try {
    await db.exec(change);await assert.rejects(run(db),error);
    assert.deepEqual(await exists(db),{relation:true,routine:true});
    assert.deepEqual((await db.query('select * from public.business_sentinel')).rows,[{id:1,content:'unchanged'}]);
  }finally{await db.close();}
});
test('R13 cleanup refuses an ordinary application role before touching a probe object',async()=>{
  const db=await fixture();try {
    await db.exec('set role authenticated');await assert.rejects(run(db),/OWNER_REQUIRED/);
    await db.exec('reset role');assert.deepEqual(await exists(db),{relation:true,routine:true});await unchanged(db);
  }finally{await db.close();}
});
}
module.exports = { registerProbeCleanupTests };
if (require.main === module) registerProbeCleanupTests();
