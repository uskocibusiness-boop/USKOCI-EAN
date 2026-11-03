// Exact captured DEV lifecycle helpers and reviewed postimage projectors.
// Synthetic records/hold table: this is not full closure orchestration, Auth,
// Storage erasure, or permission to replace the real lifecycle certificate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const root=new URL('../../operations/dev-alpha/r04-single-pass-20261103/',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,root),'utf8'));
const pre=read('preimage.json').functions,post=read('postimage.json'),deps=read('lifecycle-dependencies.json').functions;
const owner='00000000-0010-4010-8010-000000000001',peer='00000000-0010-4010-8010-000000000002';
const conversation='00000000-0010-4010-8010-000000000003',category='00000000-0010-4010-8010-000000000004';
const relation='private.work_taxonomy_gemini_turn_hints_v1',archive='private.dev_worker_profile_reset_snapshots_v1';
const resolution={state:'RESOLVED',catalogVersion:18,inputDigest:'a'.repeat(64),completionDigest:'b'.repeat(64),
 items:[{categoryId:category,identity:'c'.repeat(64),secret:'MUST_NOT_EXPORT'}]};
const row={id:category,account_id:owner,conversation_id:conversation,proposals:[{service:'Lektura',mode:'REMOTE',secret:'MUST_NOT_EXPORT'}],
 catalog_resolution:resolution,source_fingerprint:'MUST_NOT_EXPORT',payload_digest:'MUST_NOT_EXPORT'};
const names=['private.closure_taxonomy_inventory_v1','private.closure_taxonomy_project_v1','private.closure_taxonomy_reset_sections_v1'];
async function setup(t){
 const db=new PGlite({extensions:{pgcrypto}});t.after(()=>db.close());
 await db.exec('CREATE SCHEMA private;CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;CREATE TABLE private.retention_holds(account_id uuid,conversation_id uuid,active boolean);');
 for(const name of names)await db.exec(pre.find(f=>f.name===name).definition+';');
 for(const name of ['private.closure_taxonomy_scope_v1','private.closure_taxonomy_semantic_keys_v1','private.closure_taxonomy_semantic_v1',
  'private.closure_taxonomy_held_v1','private.closure_taxonomy_patch_v1'])await db.exec(deps.find(f=>f.name===name).definition+';');
 return db;
}
async function promote(db){for(const name of names)await db.exec(post.find(f=>f.name===name).definition+';');}
const project=(db,r,t)=>db.query('SELECT private.closure_taxonomy_project_v1($1,$2,$3) AS value',[r,t,owner]).then(r=>r.rows[0].value);
const patch=(db,r,t)=>db.query('SELECT private.closure_taxonomy_patch_v1($1,$2,$3,$4) AS value',[r,t,owner,category]).then(r=>r.rows[0].value);

test('fresh lifecycle dependency bodies preserve exact definition hashes',()=>{
 for(const f of deps)assert.equal(createHash('md5').update(f.definition).digest('hex'),f.md5,f.name);
});
test('reviewed projector exports resolved IDs but never replay digests or internal identity',async t=>{
 const db=await setup(t);
 assert.equal((await project(db,relation,row)).catalog_resolution,undefined,'old projector omits the new data');
 await promote(db);
 const value=await project(db,relation,row);
 assert.deepEqual(value.catalog_resolution,{catalogVersion:18,items:[{categoryId:category}]});
 assert.deepEqual(value.proposals,[{service:'Lektura',mode:'REMOTE'}]);
 for(const secret of ['MUST_NOT_EXPORT','a'.repeat(64),'b'.repeat(64),'c'.repeat(64)])assert.ok(!JSON.stringify(value).includes(secret));
});
test('archive projection retains owned resolution and excludes foreign nested copies',async t=>{
 const db=await setup(t);await promote(db);
 const value=await project(db,archive,{backup_id:category,profile_id:category,payload:{worker_hints:[row,
  {...row,account_id:peer,catalog_resolution:{items:[{categoryId:'FOREIGN_SENTINEL'}]}}],unknown:[row]}});
 assert.equal(value.payload.worker_hints.length,1);
 assert.deepEqual(value.payload.worker_hints[0].catalog_resolution,{catalogVersion:18,items:[{categoryId:category}]});
 assert.ok(!JSON.stringify(value).includes('FOREIGN_SENTINEL'));
 assert.ok(!JSON.stringify(value).includes('MUST_NOT_EXPORT'));
 assert.equal(value.payload.unknown,undefined);
});
test('actual erasure planner removes the whole hint/archive row including new resolution',async t=>{
 const db=await setup(t);await promote(db);
 for(const [r,data] of [[relation,row],[archive,{account_id:owner,payload:{worker_hints:[row]}}]]){
  assert.deepEqual(await patch(db,r,data),{operation:'DELETE',patch:{}});
  assert.equal((await db.query('SELECT private.closure_taxonomy_scope_v1($1) AS scope',[r])).rows[0].scope,'t.account_id=$1');
 }
});
test('own active hold preserves hint; foreign or released hold does not block erasure',async t=>{
 const db=await setup(t);await promote(db);
 await db.query('INSERT INTO private.retention_holds VALUES($1,$2,true)',[peer,conversation]);
 assert.equal((await patch(db,relation,row)).operation,'DELETE');
 await db.query('INSERT INTO private.retention_holds VALUES($1,$2,true)',[owner,conversation]);
 assert.equal(await patch(db,relation,row),null);
 await db.query('UPDATE private.retention_holds SET active=false WHERE account_id=$1',[owner]);
 assert.equal((await patch(db,relation,row)).operation,'DELETE');
});
