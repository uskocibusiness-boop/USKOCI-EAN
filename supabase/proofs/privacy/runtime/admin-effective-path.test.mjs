import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {adminPathObservation,validateAdminPathBaseline,compareAdminEffectivePath} from './admin-effective-path.mjs';
const expected=JSON.parse(readFileSync(new URL('./admin-effective-path-expected.json',import.meta.url)));
const sha=createHash('sha256').update(readFileSync(new URL('./admin-effective-path.sql',import.meta.url))).digest('hex');
const native=()=>({...structuredClone(expected.observation),session_role:'supabase_admin',effective_path:['public','auth','extensions']});

test('read-only DEV catalog baseline is bound to exact query bytes',()=>{
 assert.equal(validateAdminPathBaseline(expected,sha).role_path_entries,1);
 assert.throws(()=>validateAdminPathBaseline(expected,'0'.repeat(64)),/FORMAT_REFUSED/);
 assert.throws(()=>validateAdminPathBaseline({...expected,observation:{...expected.observation,shadow_namespace_count:1}},sha),/FORMAT_REFUSED/);
});
test('actual disposable admin session and effective namespace order pass only a narrow proof',()=>{
 const r=compareAdminEffectivePath(expected,native(),sha);
 assert.equal(r.effective_disposable_path_verified,true);
 assert.match(r.limitations,/not an actual hosted/);
});
test('wrong path, identity, privilege, settings or role overrides reject',()=>{
 const mutators=[
 x=>{x.session_role='postgres';},x=>{x.effective_path=['auth','public','extensions'];},
 x=>{x.effective_path=['public','auth','extensions','evil'];},
 x=>{x.effective_path=null;},x=>{x.role_config_entries=3;},
 x=>{x.role_path_has_ordered_schemas=false;},
 x=>{x.admin_usable_namespace_count=2;}, x=>{x.default_role_db_overrides=1;},
 x=>{x.shadow_namespace_count=1;},x=>{x.admin_superuser=false;},
 ];
 for(const m of mutators){const x=native();m(x);assert.equal(compareAdminEffectivePath(expected,x,sha).effective_disposable_path_verified,false);}
});
test('unexpected schema and malformed values fail closed',()=>{
 const mutators=[x=>{x.extra=true;},x=>{x.effective_path=[3];},
  x=>{x.expected_namespace_count='3';},x=>{x.read_only='off';},
  x=>{x.session_role='service_role';},x=>{x.server_version_num=160000;}];
 for(const m of mutators){const x=native();m(x);assert.throws(()=>compareAdminEffectivePath(expected,x,sha),/FORMAT_REFUSED/);}
});
