// Actual catalog SQL in PGlite 18. Stub hook/roles are fixtures, not Supabase 17.6.
// No hook execution, real extension creation, HTTP, Auth or DEV proof is claimed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {nativeNetInvokerObservation} from './native-net-invoker.mjs';
const sql=readFileSync(new URL('./native-net-invoker.sql',import.meta.url),'utf8');
async function fixture(t){
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE authenticator NOINHERIT;
 CREATE ROLE service_role;CREATE ROLE supabase_admin SUPERUSER;
 CREATE SCHEMA extensions;CREATE SCHEMA auth;
 REVOKE CREATE ON DATABASE postgres FROM PUBLIC;
 CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger LANGUAGE plpgsql
 AS $f$ BEGIN RETURN; END $f$;
 CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end WHEN TAG IN ('CREATE EXTENSION')
 EXECUTE FUNCTION extensions.grant_pg_net_access();
 SET ROLE supabase_admin;SET search_path=public,auth,extensions;`);
 return db;
}
async function capture(db){
 const result=await db.exec(sql);
 return result.find(r=>r.rows[0]?.capture)?.rows[0].capture;
}
test('collector resolves exact builtin names and restores caller path after empty helper override',async t=>{
 const db=await fixture(t);const before=await capture(db);
 assert.equal(before.read_only,'on');assert.equal(before.capture_role,'supabase_admin');
 assert.deepEqual(before.resolution,{catalog_first:true,ddl_commands_builtin:true,
  extension_builtin:true,roles_builtin:true,visible_shadow_routines:0});
 assert.equal(before.helper.config_kind,'INHERITED');
 assert.equal(before.event.create_extension_only,true);assert.equal(before.event.invokes_helper,true);
 assert.equal(before.principals.every(p=>p.present&&!p.database_create&&!p.superuser&&!p.createrole
   &&p.authority_usage_count===0&&p.authority_set_count===0),true);
 assert.deepEqual(await capture(db),before);
 await db.exec(`CREATE SCHEMA private_marker;SET search_path=private_marker,pg_catalog;
 CREATE TABLE private_marker.pg_roles(marker text);
 ALTER FUNCTION extensions.grant_pg_net_access() SET search_path TO '';`);
 const empty=await capture(db);
 assert.equal(empty.helper.config_kind,'EMPTY_SEARCH_PATH');
 assert.equal(empty.resolution.roles_builtin,true);
 assert.equal(JSON.stringify(empty).includes('private_marker'),false);
 assert.equal((await db.query('SHOW search_path')).rows[0].search_path,'private_marker, pg_catalog');
 assert.equal(empty.delegation.registered,false); // PGlite lacks real Supautils.
 assert.notEqual(empty.server_version_num,170006);
 assert.throws(()=>nativeNetInvokerObservation(empty),/FORMAT_REFUSED/);
});

test('actual temporary relation shadow and competing default-argument routine are visible',async t=>{
 const db=await fixture(t);
 await db.exec('CREATE TEMP TABLE pg_extension(marker text);');
 const temp=await capture(db);
 assert.equal(temp.resolution.extension_builtin,false);
 assert.equal(temp.resolution.catalog_first,false);
 await db.exec('DROP TABLE pg_temp.pg_extension;');
 await db.exec(`CREATE FUNCTION public.pg_event_trigger_ddl_commands(text DEFAULT '')
 RETURNS text LANGUAGE sql AS $f$SELECT 'fixture'$f$;`);
 const overloaded=await capture(db);
 // Exact zero-argument regprocedure lookup alone still looks safe.
 assert.equal(overloaded.resolution.ddl_commands_builtin,true);
 assert.equal(overloaded.resolution.visible_shadow_routines,1);
 await db.exec(`SET search_path=public,pg_catalog;
 CREATE FUNCTION public.pg_event_trigger_ddl_commands() RETURNS text LANGUAGE sql AS $f$SELECT 'fixture'$f$;`);
 const replaced=await capture(db);
 assert.equal(replaced.resolution.catalog_first,false);
 assert.equal(replaced.resolution.ddl_commands_builtin,false);
 assert.equal(replaced.resolution.visible_shadow_routines,2);
});

test('collector never invokes a user operator while inspecting a hostile inherited path',async t=>{
 const db=await fixture(t);
 await db.exec(`CREATE FUNCTION public.private_operator(oid,oid) RETURNS boolean LANGUAGE plpgsql
 AS $f$ BEGIN RAISE EXCEPTION 'PRIVATE_OPERATOR_EXECUTED'; END $f$;
 CREATE OPERATOR public.= (LEFTARG=oid, RIGHTARG=oid, FUNCTION=public.private_operator);
 SET search_path=public,pg_catalog;`);
 const result=await capture(db);
 assert.equal(result.resolution.catalog_first,false);
 assert.equal(result.helper.config_kind,'INHERITED');
 assert.equal(JSON.stringify(result).includes('PRIVATE_OPERATOR_EXECUTED'),false);
});

test('direct database CREATE, transitive SET without INHERIT, and missing roles stay distinct',async t=>{
 const db=await fixture(t);
 await db.exec(`GRANT CREATE ON DATABASE postgres TO authenticated;
 CREATE ROLE private_authority NOINHERIT;CREATE ROLE private_bridge NOINHERIT;
 GRANT CREATE ON DATABASE postgres TO private_authority;
 GRANT private_authority TO private_bridge WITH INHERIT FALSE, SET TRUE;
 GRANT private_bridge TO authenticator WITH INHERIT FALSE, SET TRUE;`);
 const result=await capture(db);
 assert.equal(result.principals.find(p=>p.principal==='authenticated').database_create,true);
 const indirect=result.principals.find(p=>p.principal==='authenticator');
 assert.equal(indirect.database_create,false);
 assert.equal(indirect.authority_usage_count,0);
 assert.equal(indirect.authority_set_count,1);
 assert.equal(JSON.stringify(result).includes('private_authority'),false);
 assert.equal(JSON.stringify(result).includes('private_bridge'),false);
 await db.exec('DROP ROLE anon;');
 const missing=(await capture(db)).principals[0];
 assert.equal(missing.present,false);assert.equal(missing.database_create,null);
 assert.equal(missing.superuser,null);
});
