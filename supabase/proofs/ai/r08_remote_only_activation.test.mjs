// R08/S14 isolated PGlite helper proof only. Candidate is LOCAL_ONLY; no DEV/Auth/HTTP/activation acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const source=readFileSync(new URL('../../candidates/r08_remote_only_activation.sql',import.meta.url),'utf8');
const functionOnly=source.split('-- TESTABLE FUNCTION BEGINS.')[1]?.split('-- TESTABLE FUNCTION ENDS.')[0];
const id=n=>'00000000-0038-4338-8338-'+String(n).padStart(12,'0');
const owner=id(1),other=id(2),remote=id(3),local=id(4);
async function dbWithConfirmedRemote(){
 const db=new PGlite();
 await db.exec([
  'CREATE SCHEMA private; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;',
  'CREATE TABLE private.work_taxonomy_categories(id uuid PRIMARY KEY,canonical_key text,state text);',
  'CREATE TABLE private.work_taxonomy_aliases(category_id uuid,normalized_key text);',
  'CREATE TABLE private.work_taxonomy_worker_capabilities(worker_account_id uuid,category_id uuid,excluded boolean);',
  'CREATE TABLE private.taxonomy_confirmed_worker_modes_v1(worker_account_id uuid,category_id uuid,active boolean,execution_scope text,confirmed_at timestamptz);',
  "CREATE FUNCTION private.taxonomy_normalize_v1(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT lower(btrim(t)); $f$;",
  functionOnly,
 ].join('\n'));
 await db.query("INSERT INTO private.work_taxonomy_categories VALUES($1,'logotip','ESTABLISHED'),($2,'krečenje','ESTABLISHED')",[remote,local]);
 await db.query('INSERT INTO private.work_taxonomy_worker_capabilities VALUES($1,$2,false)',[owner,remote]);
 await db.query("INSERT INTO private.taxonomy_confirmed_worker_modes_v1 VALUES($1,$2,true,'REMOTE',now())",[owner,remote]);
 return db;
}
const eligible=(db,account=owner,skills=['Logotip'])=>db.query(
 'SELECT private.worker_remote_only_activation_ready_v1($1::uuid,$2::text[]) AS eligible',[account,skills]).then(r=>r.rows[0].eligible);
test('candidate pins exact current worker activation owner and is not a deploy/migration',()=>{
 assert.match(source,/R08_REMOTE_LOCAL_ONLY/);
 assert.match(source,/ba85aa79219961646c387ab64156a073/);
 assert.match(source,/v_profile\.city/);
 assert.match(source,/private\.worker_remote_only_activation_ready_v1\(v_uid,v_profile\.skills\) IS NOT TRUE/);
 assert.match(source,/REVOKE ALL ON FUNCTION private\.worker_remote_only_activation_ready_v1/);
 assert.ok(functionOnly?.includes('SECURITY INVOKER'));
 assert.match(functionOnly, /END; \$f\$;/);
});
test('only a saved, uniquely mapped and confirmed REMOTE capability permits an absent city',async t=>{
 const db=await dbWithConfirmedRemote();t.after(()=>db.close());
 assert.equal(await eligible(db),true);
 assert.equal(await eligible(db,other),false);
 assert.equal(await eligible(db,owner,[]),false);
 assert.equal(await eligible(db,owner,['Unknown service']),false);
 assert.equal(await eligible(db,owner,['Logotip','Krečenje']),false);
 assert.equal(await eligible(db,owner,['Logotip',null]),false);
});
test('live ON_SITE or BOTH mode fails closed, without inventing remote-only from preferences',async t=>{
 const db=await dbWithConfirmedRemote();t.after(()=>db.close());
 await db.query('INSERT INTO private.work_taxonomy_worker_capabilities VALUES($1,$2,false)',[owner,local]);
 await db.query("INSERT INTO private.taxonomy_confirmed_worker_modes_v1 VALUES($1,$2,true,'ON_SITE',now())",[owner,local]);
 assert.equal(await eligible(db),false);
 // Removing the old on-site capability must not indefinitely block a now remote-only worker.
 await db.query('UPDATE private.work_taxonomy_worker_capabilities SET excluded=true WHERE category_id=$1',[local]);
 assert.equal(await eligible(db),true);
 await db.query('UPDATE private.work_taxonomy_worker_capabilities SET excluded=false WHERE category_id=$1',[local]);
 await db.query("UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false WHERE category_id=$1",[local]);
 assert.equal(await eligible(db),true);
 await db.query("UPDATE private.taxonomy_confirmed_worker_modes_v1 SET execution_scope='ON_SITE' WHERE category_id=$1",[remote]);
 assert.equal(await eligible(db),false);
});
test('stale, excluded, ambiguous, unconfirmed or foreign category never grants activation',async t=>{
 const db=await dbWithConfirmedRemote();t.after(()=>db.close());
 await db.query('UPDATE private.work_taxonomy_worker_capabilities SET excluded=true WHERE category_id=$1',[remote]);
 assert.equal(await eligible(db),false);
 await db.query('UPDATE private.work_taxonomy_worker_capabilities SET excluded=false WHERE category_id=$1',[remote]);
 await db.query('UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false WHERE category_id=$1',[remote]);
 assert.equal(await eligible(db),false);
 await db.query('UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=true,confirmed_at=null WHERE category_id=$1',[remote]);
 assert.equal(await eligible(db),false);
 await db.query('UPDATE private.taxonomy_confirmed_worker_modes_v1 SET confirmed_at=now() WHERE category_id=$1',[remote]);
 await db.query('INSERT INTO private.work_taxonomy_aliases VALUES($1,$2)',[local,'logotip']);
 assert.equal(await eligible(db),false);
 await db.query('DELETE FROM private.work_taxonomy_aliases WHERE category_id=$1',[local]);
 assert.equal(await eligible(db),true);
 await db.query("UPDATE private.work_taxonomy_categories SET state='PENDING' WHERE id=$1",[remote]);
 assert.equal(await eligible(db),false);
});
test('registered alias maps to exactly one confirmed remote category',async t=>{
 const db=await dbWithConfirmedRemote();t.after(()=>db.close());
 await db.query("INSERT INTO private.work_taxonomy_aliases VALUES($1,'grafički logo')",[remote]);
 assert.equal(await eligible(db,owner,['Grafički logo']),true);
});
