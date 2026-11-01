// Execute the exact acceptance fragment using the existing explicitly limited
// R08 PGlite fixture. Hosted PG17/RLS/trigger acceptance remains promotion's gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('./',import.meta.url);
const proof=new URL('../../../proofs/ai/r08_remote_only_activation.test.mjs',import.meta.url);
const text=readFileSync(proof,'utf8');
const marker="test('baseline reproduces both first-save blockers;";
assert.ok(text.includes(marker));
// Reuse the already documented fixture without copying its schema or changing
// production tests. No test declarations from that module are imported.
const fixture=text.slice(0,text.indexOf(marker)).replaceAll('import.meta.url',JSON.stringify(proof.href))
 .replaceAll("from '@electric-sql/pglite'",'from '+JSON.stringify(import.meta.resolve('@electric-sql/pglite')))
 .replaceAll("from '@electric-sql/pglite/contrib/pgcrypto'",'from '+JSON.stringify(import.meta.resolve('@electric-sql/pglite/contrib/pgcrypto')))
 .replaceAll("from 'typescript'",'from '+JSON.stringify(import.meta.resolve('typescript')))+
 '\nexport {setup,tableSql,sqlFunction};';
const {setup,tableSql,sqlFunction}=await import('data:text/javascript;base64,'+Buffer.from(fixture).toString('base64'));
const audit=JSON.parse(readFileSync(new URL('acceptance-dependencies.json',root),'utf8'));
const acceptance=readFileSync(new URL('acceptance.sql',root),'utf8');
async function seed(t){
 const db=await setup(t);
 await db.exec(`CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb,email text,phone text);
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('request.jwt.claim.role',true)$$;
 CREATE TABLE private.account_lineage_v5(account_id uuid PRIMARY KEY,lineage text,reason text,source_ref text);
 GRANT USAGE ON SCHEMA auth TO service_role;`);
 await db.exec(tableSql('public.app_accounts'));
 await db.exec(tableSql('public.ai_messages'));
 for(const name of ['private.account_lineage(uuid)','private.account_visibility_world(uuid)',
  'public.metadata_text_array(jsonb)','private.worker_ai_document(uuid)','public.rpc_read_worker_ai_taxonomy(uuid)']){
  const f=audit.functions.find(f=>f.signature===name);assert.ok(f,name);
  await db.exec('SET check_function_bodies=off;'+f.definition+';');
 }
 await db.exec(sqlFunction('private.worker_ai_turn_document'));
 const trigger=audit.tables.find(t=>t.name==='auth.users').triggers.find(t=>t.signature==='public.handle_uskoci_auth_user_created()');
 await db.exec(trigger.function+';'+trigger.definition+';');
 await db.exec(`INSERT INTO private.work_taxonomy_categories(id,canonical_key,label,state,source,catalog_version)
 VALUES('065e7a4e-7956-4fc6-9d42-2d10b3a3aafb','izrada jednostavnog sajta','Izrada jednostavnog sajta','ESTABLISHED','CURATED',1);
 INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
 VALUES('065e7a4e-7956-4fc6-9d42-2d10b3a3aafb','REMOTE','local-fixture');`);
 return db;
}
test('exact role/claims acceptance passes real prepare/save/readback/batch/binder and fixture rollback',async t=>{
 const db=await seed(t);
 await db.exec('BEGIN;SAVEPOINT r08_acceptance;'+acceptance);
 assert.equal((await db.query("SELECT profile_status,city FROM public.app_profiles WHERE account_id='af081101-0000-4000-8000-000000000001' AND kind='WORKER'")).rows[0].profile_status,'ACTIVE');
 await db.exec('ROLLBACK TO SAVEPOINT r08_acceptance;RELEASE SAVEPOINT r08_acceptance;COMMIT;');
 assert.equal((await db.query("SELECT count(*)::int n FROM auth.users WHERE id='af081101-0000-4000-8000-000000000001'")).rows[0].n,0);
 assert.equal((await db.query("SELECT count(*)::int n FROM private.worker_ai_saves WHERE account_id='af081101-0000-4000-8000-000000000001'")).rows[0].n,0);
});
test('acceptance failure aborts enclosing code change as well as fixture rows',async t=>{
 const db=await seed(t);
 await db.exec("DELETE FROM private.work_taxonomy_category_modes WHERE category_id='065e7a4e-7956-4fc6-9d42-2d10b3a3aafb';");
 await assert.rejects(db.exec('BEGIN;CREATE TABLE public.r08_abort_marker(id int);SAVEPOINT r08_acceptance;'+acceptance),/R08_ACCEPTANCE_EXISTING_REMOTE_SERVICE_MISSING/);
 await db.exec('ROLLBACK');
 assert.equal((await db.query("SELECT to_regclass('public.r08_abort_marker') AS marker")).rows[0].marker,null);
});
