// R01/F21 proof of EXACT current public nonrow-grant correction in PostgreSQL.
// Executes the real source-only SQL candidate in isolated PGlite, never DEV.
// These 21 names and per-role bits are independently frozen from the 2026-10-29
// DEV catalog read; this is NOT Auth/PostgREST, closure or rollout evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const candidate=readFileSync(new URL('../../candidates/r01_existing_public_nonrow_privileges.sql',import.meta.url),'utf8');
const tables=[
 'access_grants','agreement_change_proposals','agreement_execution',
 'agreement_messages','agreement_versions','agreements','ai_structured_facts',
 'app_accounts','app_profiles','dispatch_rounds','gemini_debug_log',
 'marketplace_response_versions','marketplace_responses','need_selections',
 'need_sensitive','needs','opportunity_deliveries','profile_availability_rules',
 'profile_availability_windows','user_activity_events','worker_match_preferences'
];
const anonSet=new Set([
 'access_grants','agreement_execution','agreement_messages','agreement_versions',
 'agreements','ai_structured_facts','app_accounts','dispatch_rounds','gemini_debug_log',
 'marketplace_response_versions','marketplace_responses','need_selections',
 'need_sensitive','needs','opportunity_deliveries','user_activity_events',
 'worker_match_preferences'
]);
const authSet=new Set(tables.filter(x=>!['access_grants','agreement_messages'].includes(x)));
const rights=['TRUNCATE','TRIGGER','REFERENCES'];
const mustRollback=async(db,promise,error)=>{
 try{await assert.rejects(promise,error);}
 catch(failure){
  // Only bounded PostgreSQL parser metadata from source-only synthetic tests.
  // Never emit a query, environment value, role secret or fixture data.
  const original=failure?.actual??failure;
  console.error('R01_NONROW_TEST_DIAG '+JSON.stringify({
   sqlstate:String(original?.code??'').slice(0,8),
   position:String(original?.position??'').slice(0,8),
   internalPosition:String(original?.internalPosition??'').slice(0,8),
   routine:String(original?.routine??'').slice(0,80),
   where:String(original?.where??'').slice(0,300),
   message:String(original?.message??'').slice(0,170),
  }));
  throw failure;
 }finally{await db.exec('ROLLBACK');}
};
const aclSnapshot=async(db)=> (await db.query(`select c.relname,c.relacl::text acl,
 c.relrowsecurity rls,pg_get_userbyid(c.relowner) owner
 from pg_class c where c.relnamespace='public'::regnamespace
 and c.relkind='r' order by c.relname`)).rows;

test('R01/F21: direct nonrow grant correction preserves legal reads/writes and server authority',async()=>{
 const db=new PGlite();
 try{
  assert.equal(tables.length,21);
  assert.equal(anonSet.size,17);
  assert.equal(authSet.size,19);
  assert.match(candidate,/R01_NONROW_UNRELATED_AUTHORITY_CHANGED/);
  assert.doesNotMatch(candidate,/\b(DROP TABLE|ALTER TABLE|CREATE TABLE|GRANT SELECT|REVOKE SELECT|REVOKE INSERT|REVOKE UPDATE|REVOKE DELETE)\b/i);
  await db.exec(`CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;`);
  for(const name of tables){
   assert.match(name,/^[a-z_]+$/);
   await db.exec(`CREATE TABLE public.${name}(id integer primary key, public_value text);
     ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY;
     GRANT TRUNCATE,TRIGGER,REFERENCES ON public.${name} TO service_role;
     GRANT SELECT(id,public_value),INSERT(id,public_value),UPDATE(public_value),DELETE ON public.${name} TO authenticated;
     ${anonSet.has(name)?`GRANT TRUNCATE,TRIGGER,REFERENCES ON public.${name} TO anon;`:''}
     ${authSet.has(name)?`GRANT TRUNCATE,TRIGGER,REFERENCES ON public.${name} TO authenticated;`:''}`);
  }
  await db.exec(`CREATE POLICY r01_needs_reader ON public.needs
    FOR SELECT TO authenticated USING (true);
    INSERT INTO public.needs(id,public_value) VALUES(1,'VISIBLE');`);
  const initial=await aclSnapshot(db);
  assert.equal(initial.length,21);
  // With RLS enabled, a role that has TRUNCATE can still empty another
  // user's table; this is why ordinary row policies cannot be our fix.
  await db.exec('INSERT INTO public.access_grants(id) VALUES(1)');
  await db.exec('SET ROLE anon');
  try{await db.exec('TRUNCATE TABLE public.access_grants');}finally{await db.exec('RESET ROLE')}
  assert.equal((await db.query('SELECT count(*)::integer n FROM public.access_grants')).rows[0].n,0);

  // Denials are deliberately attempted first and MUST roll back, without a
  // partial revoke or poisoned session leaking into the positive test.
  await mustRollback(db,db.exec(candidate),/R01_NONROW_DISPOSABLE_ONLY/);
  assert.deepEqual(await aclSnapshot(db),initial);
  await db.exec("SET uskoci.r01.disposable='LOCAL_ONLY'");
  await db.exec('SET ROLE authenticated');
  try{await mustRollback(db,db.exec(candidate),/R01_NONROW_DISPOSABLE_ONLY/);}
  finally{await db.exec('RESET ROLE');}
  assert.deepEqual(await aclSnapshot(db),initial);

  // The exact 21-target list is a prerequisite, not a sweep of unknown
  // future/public tables that may have a different permission owner.
  await db.exec(`CREATE TABLE public.surprise_table(id integer);
   GRANT TRUNCATE TO anon ON TABLE public.surprise_table;`);
  const beforeSurprise=await aclSnapshot(db);
  await mustRollback(db,db.exec(candidate),/R01_NONROW_UNREVIEWED_PUBLIC_GRANTS/);
  assert.deepEqual(await aclSnapshot(db),beforeSurprise);
  await db.exec('DROP TABLE public.surprise_table');

  // A partial unexpected grant modification on a reviewed table must not
  // silently redefine the baseline.
  await db.exec('REVOKE TRIGGER ON TABLE public.agreement_messages FROM anon');
  const drift=await aclSnapshot(db);
  await mustRollback(db,db.exec(candidate),/R01_NONROW_TARGET_PREDECESSOR_DRIFT/);
  assert.deepEqual(await aclSnapshot(db),drift);
  await db.exec('GRANT TRIGGER ON TABLE public.agreement_messages TO anon');
  assert.deepEqual(await aclSnapshot(db),initial);

  const policyBefore=(await db.query("SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) v FROM pg_policy p")).rows[0].v;
  await db.exec(candidate);
  const after=await aclSnapshot(db);
  assert.equal(after.length,21);
  for(const name of tables){
   const x=after.find(z=>z.relname===name),b=initial.find(z=>z.relname===name);
   assert.equal(x.rls,true,name);
   assert.equal(x.owner,'postgres',name);
   assert.notEqual(x.acl,b.acl,name);
   for(const role of ['anon','authenticated']){
    for(const right of rights){
     assert.equal((await db.query("SELECT has_table_privilege($1::name,$2::regclass,$3::text) ok",
       [role,'public.'+name,right])).rows[0].ok,false,`${name}/${role}/${right}`);
    }
   }
   for(const right of rights){
    assert.equal((await db.query("SELECT has_table_privilege('service_role',$1::regclass,$2::text) ok",
      ['public.'+name,right])).rows[0].ok,true,`server/${name}/${right}`);
   }
   assert.equal((await db.query("SELECT has_table_privilege('authenticated',$1::regclass,'INSERT') ok",['public.'+name])).rows[0].ok,true);
  }
  const policyAfter=(await db.query("SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) v FROM pg_policy p")).rows[0].v;
  assert.deepEqual(policyAfter,policyBefore,'RLS policy rows unmodified');

  // RLS continues to allow intentional public-column reads for authenticated.
  await db.exec('SET ROLE authenticated');
  try{
   assert.deepEqual((await db.query('SELECT id,public_value FROM public.needs')).rows,
     [{id:1,public_value:'VISIBLE'}]);
   await assert.rejects(db.exec('TRUNCATE TABLE public.needs'),
     e=>e.code==='42501'||/permission denied/i.test(String(e.message)));
  }finally{await db.exec('RESET ROLE');}
  assert.deepEqual((await db.query('SELECT id,public_value FROM public.needs')).rows,
    [{id:1,public_value:'VISIBLE'}]);

  // Inheritance must not reintroduce a forbidden ability: the next source
  // run must reject any unreviewed parent role instead of re-granting blind.
  await db.exec('CREATE ROLE r01_privileged_parent');
  await db.exec('GRANT r01_privileged_parent TO authenticated');
  await db.exec('GRANT TRUNCATE ON public.needs TO r01_privileged_parent');
  assert.equal((await db.query("SELECT has_table_privilege('authenticated','public.needs','TRUNCATE') ok")).rows[0].ok,true);
  const inherited=await aclSnapshot(db);
  await mustRollback(db,db.exec(candidate),/R01_NONROW_UNREVIEWED_PUBLIC_GRANTS|R01_NONROW_TARGET_PREDECESSOR_DRIFT/);
  assert.deepEqual(await aclSnapshot(db),inherited);
  await db.exec(`REVOKE r01_privileged_parent FROM authenticated;
    REVOKE TRUNCATE ON public.needs FROM r01_privileged_parent;
    DROP ROLE r01_privileged_parent;`);
 }finally{await db.close()}
});
