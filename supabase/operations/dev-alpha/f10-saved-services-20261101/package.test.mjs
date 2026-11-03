import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {preimage,original,generate,localCatalog,captureReader,wrap} from './build.mjs';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
const forwardDdl=()=>read('forward.sql').split('END; $f10_pre$;')[1].split('-- F10 no-row acceptance')[0];
const rollbackDdl=()=>read('rollback.sql').split('END; $f10_rollback_pre$;')[1].split('DO $f10_rollback_post$')[0];

test('packet deterministically binds the unchanged candidate, fresh preimage and every output',async()=>{
 const outputs=await generate();for(const[n,s]of Object.entries(outputs))assert.equal(read(n),s,n);
 const m=JSON.parse(outputs['manifest.json']);for(const[n,h]of Object.entries(m.files))assert.equal(sha(read(n)),h,n);
 assert.equal(m.changed_functions,1);assert.equal(m.new_functions,0);assert.equal(m.new_tables,0);
 assert.equal(m.pinned_dependency_functions,3);assert.equal(m.pinned_relations,11);assert.equal(m.status,'PREPARED_NOT_APPLIED');
 assert.ok(!read('forward.sql').includes('uskoci.f10.disposable'));assert.ok(!read('forward.sql').includes('GRANT '));
 assert.equal(read('forward.sql').includes(read('acceptance.sql')),true);
});
test('exact derived forward and rollback preserve the owned reader ACL and restore its original bytes',async t=>{
 const db=await localCatalog();t.after(()=>db.close());const before=await captureReader(db);
 assert.equal(before.definition_md5,original.definition_md5);assert.equal(before.acl,original.acl);
 await db.exec(forwardDdl());const after=await captureReader(db),post=JSON.parse(read('postimage.json'));
 for(const[key,value]of Object.entries(after))assert.equal(value,post[key],key);
 await db.exec(rollbackDdl());assert.deepEqual(await captureReader(db),before);
});
test('full promotion fragment refuses a local context instead of pretending it is hosted PG17 DEV',async t=>{
 const db=await localCatalog();t.after(()=>db.close());
 await assert.rejects(db.exec(wrap(read('forward.sql'),true)),/F10_DEV_CONTEXT_REFUSED/);await db.exec('ROLLBACK');
 assert.equal((await captureReader(db)).definition_md5,original.definition_md5);
});
test('exact no-row acceptance executes on captured empty relation shapes without creating user rows',async t=>{
 const db=await localCatalog();t.after(()=>db.close());
 const snapshot=readFileSync(new URL('../../../proofs/privacy/bootstrap/current-application.sql',import.meta.url),'utf8');
 for(const{name}of preimage.tables){
  const quoted=name.split('.').map(x=>'"'+x+'"').join('.'),start=snapshot.indexOf('CREATE TABLE '+quoted+' ('),end=snapshot.indexOf('\n);',start);
  assert.ok(start>=0&&end>start,name);await db.exec(snapshot.slice(start,end+3));
 }
 await db.exec(`CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $f$;
 GRANT USAGE ON SCHEMA public,auth TO authenticated;`);
 await db.exec(forwardDdl());await db.exec('BEGIN;'+read('acceptance.sql')+'ROLLBACK;');
 for(const{name}of preimage.tables)assert.equal((await db.query('SELECT count(*)::int AS n FROM '+name)).rows[0].n,0,name);
});
test('the actual postcondition rejects a body/config drift and keeps definition/owner/ACL/OID checks',async t=>{
 const db=await localCatalog();t.after(()=>db.close());await db.exec(forwardDdl());
 const source=read('postflight.sql'),start=source.indexOf("IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_get_worker_execution_modes(uuid)')");
 const end=source.indexOf('END IF;',start)+7;assert.ok(start>0);
 const localOid=(await db.query('SELECT to_regprocedure($1)::oid AS oid',[original.signature])).rows[0].oid;
 const guard=source.slice(start,end).replace('AND p.oid='+original.oid,'AND p.oid='+localOid);
 assert.match(guard,/pg_get_userbyid/);assert.match(guard,/p.proacl::text/);assert.match(guard,/md5\(pg_get_functiondef/);
 await db.exec('DO $test$ BEGIN '+guard+' END; $test$;');
 await db.exec('ALTER FUNCTION public.rpc_get_worker_execution_modes(uuid) SET search_path=public');
 await assert.rejects(db.exec('DO $test$ BEGIN '+guard+' END; $test$;'),/F10_DEV_FUNCTION_DRIFT/);
});
