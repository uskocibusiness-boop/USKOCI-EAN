import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {preimage,helpers,acceptanceDependencies,localCatalog,captureFunctions,generate,wrap} from './build.mjs';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
const ddlOnly=(sql,before,after)=>sql.slice(sql.indexOf(before)+before.length,sql.indexOf(after));
const forwardDdl=()=>ddlOnly(read('forward.sql'),'END; $r08_pre$;','DO $r08_post$');
const rollbackDdl=()=>ddlOnly(read('rollback.sql'),'END; $r08_rollback_pre$;','DO $r08_rollback_post$');

test('generated files bind current candidate, exact fresh preimage and dependency captures',async()=>{
 const outputs=await generate();
 for(const[n,s]of Object.entries(outputs))assert.equal(read(n),s,n);
 const m=JSON.parse(outputs['manifest.json']);
 for(const[n,h]of Object.entries(m.files))assert.equal(sha(read(n)),h,n);
 assert.equal(m.changed_functions,7);assert.equal(m.new_functions,3);
 assert.equal(m.pinned_dependency_functions,44);assert.equal(m.pinned_relations,31);
 assert.equal(m.status,'PREPARED_NOT_APPLIED');
});

test('exact forward DDL equals candidate projection and rollback restores all seven bodies plus ACLs',async t=>{
 const db=await localCatalog();t.after(()=>db.close());
 const before=await captureFunctions(db,preimage.functions.map(f=>f.signature));
 for(const f of before)assert.equal(f.acl,preimage.functions.find(x=>x.signature===f.signature).acl);
 await db.exec('BEGIN;'+forwardDdl()+'COMMIT;');
 assert.deepEqual(await captureFunctions(db,[...preimage.functions.map(f=>f.signature),...helpers]),JSON.parse(read('postimage.json')));
 await db.exec('BEGIN;'+rollbackDdl()+'COMMIT;');
 assert.deepEqual(await captureFunctions(db,preimage.functions.map(f=>f.signature)),before);
 for(const signature of helpers)assert.equal((await db.query('SELECT to_regprocedure($1) AS p',[signature])).rows[0].p,null);
});

test('full DEV fragment refuses an unwrapped/local runtime instead of pretending PGlite is PG17 DEV',async t=>{
 const db=await localCatalog();t.after(()=>db.close());
 // Only fixture lock targets: no Auth/data rows or canonical table schema is simulated.
 await db.exec('CREATE TABLE public.app_profiles(id uuid);CREATE TABLE private.worker_ai_sessions(id uuid);'+
  'CREATE TABLE private.worker_ai_reviews(id uuid);CREATE TABLE private.worker_ai_saves(id uuid);');
 await assert.rejects(db.exec(wrap(read('forward.sql'))),/R08_DEV_CONTEXT_REFUSED/);
 await db.exec('ROLLBACK');
 for(const signature of helpers)assert.equal((await db.query('SELECT to_regprocedure($1) AS p',[signature])).rows[0].p,null);
});

test('actual rollback data gate refuses existing ACTIVE cityless worker; code rollback never erases it',async t=>{
 const db=await localCatalog();t.after(()=>db.close());
 await db.exec('CREATE TABLE public.app_profiles(kind text,profile_status text,city text);');
 const rollback=read('rollback.sql');
 const start=rollback.indexOf('IF EXISTS(SELECT 1 FROM public.app_profiles');
 const end=rollback.indexOf('END IF;',start)+7;
 const guard='DO $test$ BEGIN '+rollback.slice(start,end)+' END; $test$;';
 await db.exec(guard);
 await db.exec("INSERT INTO public.app_profiles VALUES('WORKER','ACTIVE','')");
 await assert.rejects(db.exec(guard),/R08_DEV_ACTIVE_CITYLESS_REQUIRES_FORWARD_RECOVERY/);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM public.app_profiles')).rows[0].n,1);
 await db.exec("UPDATE public.app_profiles SET profile_status='DRAFT'");await db.exec(guard);
 await db.exec("UPDATE public.app_profiles SET profile_status='ACTIVE',city='Beograd'");await db.exec(guard);
});

test('private helpers are inaccessible to API roles and function drift is rejected by actual postcondition',async t=>{
 const db=await localCatalog();t.after(()=>db.close());await db.exec(forwardDdl());
 for(const signature of helpers)for(const role of ['anon','authenticated','service_role']){
  assert.equal((await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS ok',[role,signature])).rows[0].ok,false);
 }
 const post=read('postflight.sql');
 const target="IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_save_worker_ai_review(uuid,text,uuid)')";
 const start=post.indexOf(target),end=post.indexOf('END IF;',start)+7;
 assert.ok(start>0);
 const guard='DO $test$ BEGIN '+post.slice(start,end)+' END; $test$;';
 await db.exec(guard);
 await db.exec('ALTER FUNCTION public.rpc_save_worker_ai_review(uuid,text,uuid) SET search_path=public');
 await assert.rejects(db.exec(guard),/R08_DEV_FUNCTION_DRIFT/);
});

test('dependency catalog guard is executable SQL and retains relation/trigger/policy drift gate',async t=>{
 const db=await localCatalog();t.after(()=>db.close());
 const f=read('preflight.sql');const start=f.indexOf(' IF (WITH names(name) AS');
 const end=f.indexOf('END IF;',start)+7;assert.ok(start>0);
 const guard='DO $test$ BEGIN '+f.slice(start,end)+' END; $test$;';
 await assert.rejects(db.exec(guard),/R08_DEV_RELATION_DRIFT/);
});

test('actual acceptance surface guard rejects an additional Auth trigger before fixture insertion',async t=>{
 const db=await localCatalog();t.after(()=>db.close());
 await db.exec('CREATE TABLE auth.users(id uuid,email text,phone text);');
 const auth=acceptanceDependencies.tables.find(t=>t.name==='auth.users');
 for(const tr of auth.triggers)await db.exec(tr.function+';'+tr.definition+';');
 const file=read('acceptance-guard.sql');const start=file.indexOf('IF (SELECT jsonb_build_object');
 const end=file.indexOf('END IF;',start)+7;
 const guard='DO $test$ BEGIN '+file.slice(start,end)+' END;$test$;';
 await db.exec(guard);
 await db.exec(`CREATE FUNCTION public.r08_unexpected_trigger() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW;END$$;
 CREATE TRIGGER r08_unexpected AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.r08_unexpected_trigger();`);
 await assert.rejects(db.exec(guard),/R08_ACCEPTANCE_TRIGGER_DRIFT/);
});
