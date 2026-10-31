// R01/F21: real PostgreSQL default-ACL operations against a disposable
// in-memory PGlite instance. NOT current hosted/DEV Auth, HTTP or rollout proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const candidate=readFileSync(new URL('../../candidates/r01_future_public_default_grants.sql',import.meta.url),'utf8');
const owners=['postgres','supabase_admin'];
const unsafe=['anon','authenticated'];
const baseSetup=`
 CREATE ROLE supabase_admin SUPERUSER;
 CREATE ROLE anon;
 CREATE ROLE authenticated;
 CREATE ROLE service_role;
 CREATE ROLE unexpected_public_reader;
 GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role,unexpected_public_reader;
 ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
   GRANT ALL ON TABLES TO postgres,anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
   GRANT ALL ON SEQUENCES TO postgres,anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
   GRANT EXECUTE ON FUNCTIONS TO postgres,anon,authenticated,service_role;
 SET ROLE supabase_admin;
 ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
   GRANT ALL ON TABLES TO postgres,anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
   GRANT ALL ON SEQUENCES TO postgres,anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
   GRANT EXECUTE ON FUNCTIONS TO postgres,anon,authenticated,service_role;
 RESET ROLE;
 CREATE TABLE public.preexisting_need (id int);
 GRANT SELECT ON public.preexisting_need TO authenticated,service_role;
`;
const rowSql=`SELECT pg_get_userbyid(defaclrole) owner,defaclobjtype kind,
  defaclacl::text acl
  FROM pg_default_acl WHERE defaclnamespace='public'::regnamespace
  AND pg_get_userbyid(defaclrole) IN ('postgres','supabase_admin')
  ORDER BY pg_get_userbyid(defaclrole),defaclobjtype`;
const effectiveDefaultSql=`SELECT pg_get_userbyid(d.defaclrole) owner,d.defaclobjtype kind,
  r.rolname role,a.privilege_type privilege
  FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  JOIN pg_roles r ON r.oid=a.grantee
  WHERE d.defaclnamespace='public'::regnamespace
    AND pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin')
  ORDER BY 1,2,3,4`;

test('R01/F21 future-public ACL: explicit platform owner, atomic refusal, both creator roles',async()=>{
 const db=new PGlite();
 try{
  assert.match(candidate,/current_user<>'supabase_admin'/);
  assert.match(candidate,/current_setting\('uskoci\.r01\.disposable',true\)/);
  assert.doesNotMatch(candidate,/\bDROP\s+(TABLE|SCHEMA|ROLE)\b|\bGRANT\s+(ALL|SELECT)\s+ON\s+(TABLE|SCHEMA)/i);
  await db.exec(baseSetup);
  const query=async(sql)=>(await db.query(sql)).rows;
  const baseline=await query(rowSql);
  assert.equal(baseline.length,6,'both owner defaults: tables, sequences, functions');

  // Without operator role or an explicit disposable marker, refuse and
  // preserve all actual default ACLs. A caller cannot self-authorize by
  // merely setting an arbitrary custom GUC.
  await assert.rejects(db.exec(candidate),/R01_DEFAULTS_DISPOSABLE_PLATFORM_OWNER_REQUIRED/);
  // A rejected BEGIN/DO leaves PostgreSQL in aborted transaction state until
  // the caller rolls back. This is part of the fail-closed regression proof.
  await db.exec('ROLLBACK');
  assert.deepEqual(await query(rowSql),baseline);
  await db.exec("SET uskoci.r01.disposable='LOCAL_ONLY'");
  await assert.rejects(db.exec(candidate),/R01_DEFAULTS_DISPOSABLE_PLATFORM_OWNER_REQUIRED/);
  // A rejected BEGIN/DO leaves PostgreSQL in aborted transaction state until
  // the caller rolls back. This is part of the fail-closed regression proof.
  await db.exec('ROLLBACK');
  assert.deepEqual(await query(rowSql),baseline);

  await db.exec('SET ROLE supabase_admin');
  try{
   // An unknown future grantee must not be deleted through a blind REVOKE.
   await db.exec('ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT ON TABLES TO unexpected_public_reader');
   const tampered=await query(rowSql);
   await assert.rejects(db.exec(candidate),/R01_DEFAULTS_ACL_PREDECESSOR_DRIFT/);
   await db.exec('ROLLBACK');
   assert.deepEqual(await query(rowSql),tampered,'disallowed extra grant is not swept under the rug');
   await db.exec('ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM unexpected_public_reader');

   await db.exec(candidate);
  }finally{await db.exec('RESET ROLE');}

  const after=await query(rowSql);
  assert.equal(after.length,6,'only the four public table/sequence default ACLs change');
  const unchangedKinds=baseline.filter(x=>x.kind==='f');
  assert.deepEqual(after.filter(x=>x.kind==='f'),unchangedKinds,'existing future function grants stay unchanged');
  for(const owner of owners){
   const before=baseline.filter(x=>x.owner===owner);
   const now=after.filter(x=>x.owner===owner);
   assert.equal(before.length,3);assert.equal(now.length,3);
   assert.notDeepEqual(now.filter(x=>x.kind!=='f'),before.filter(x=>x.kind!=='f'));
  }
  const effective=await query(effectiveDefaultSql);
  for(const owner of owners){
   for(const kind of ['r','S']){
    assert(!effective.some(x=>x.owner===owner&&x.kind===kind&&unsafe.includes(x.role)),
      'no future public table/sequence grants to anon or authenticated');
    assert(effective.some(x=>x.owner===owner&&x.kind===kind&&x.role==='service_role'),
      'retains service-role default grants');
   }
  }
  // The prior table is not modified. Test new objects under EACH default-ACL
  // owner, not merely the metadata rows that happen to look correct.
  assert.deepEqual(await query('select has_table_privilege(\'authenticated\',\'public.preexisting_need\',\'SELECT\') allowed'),[{allowed:true}]);
  for(const role of owners){
   const object=role==='postgres'?'r01_new_pg':'r01_new_admin';
   await db.exec('SET ROLE '+role);
   try{
    await db.exec('CREATE TABLE public.'+object+' (id integer); CREATE SEQUENCE public.'+object+'_seq');
   }finally{await db.exec('RESET ROLE');}
   for(const principal of unsafe){
    const {rows}=await db.query(`SELECT has_table_privilege($1::name,$2::regclass,'SELECT') tbl,
      has_table_privilege($1::name,$2::regclass,'TRUNCATE') truncate,
      has_sequence_privilege($1::name,$3::regclass,'USAGE') seq`,
      [principal,'public.'+object,'public.'+object+'_seq']);
    assert.deepEqual(rows,[{tbl:false,truncate:false,seq:false}],
      'no accidental future private access for '+principal+'/'+role);
   }
   assert.deepEqual((await db.query(`SELECT has_table_privilege('service_role',$1::regclass,'SELECT') tbl,
     has_sequence_privilege('service_role',$2::regclass,'USAGE') seq`,
     ['public.'+object,'public.'+object+'_seq'])).rows,[{tbl:true,seq:true}]);
  }
 }finally{await db.close();}
});
