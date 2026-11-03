import assert from 'node:assert/strict';
import test from 'node:test';
import {effectiveManifest,compareEffective} from './platform-effective.mjs';
const query='a'.repeat(64);
function fixture() {
  return {unit:'R01_PLATFORM_EFFECTIVE_CAPTURE',format_version:1,captured_at:'2026-10-28T10:43:46Z',
    read_only:'on',server_version_num:170006,search_path:'pg_catalog',database:'postgres',
    principals:['anon','authenticated','authenticator','postgres','service_role','supabase_admin',
      'supabase_auth_admin','supabase_functions_admin','supabase_realtime_admin','supabase_storage_admin'],
    targets:['anon','authenticated','postgres','service_role','supabase_admin','supabase_auth_admin',
      'supabase_functions_admin','supabase_privileged_role','supabase_realtime_admin','supabase_storage_admin'],
    groups:{storage_access:[{key:['owner','SELECT'],allowed:true,grantable:true,is_owner:true}],
      role_reachability:[{key:['postgres','platform_role'],usage:false,set_role:false}],
      schema_access:[{key:['anon','platform_schema'],usage:true,create:false}],
      namespace_presence:[{key:['admin_schema'],present:false}],
      extension_routines:[{key:['extension','schema','PRIVATE_ROUTINE_MARKER','argument'],owner:'PRIVATE_OWNER_MARKER',
        language:'sql',security_definer:false,strict:false,leakproof:false,volatility:'v',parallel:'u',
        definition_md5:'b'.repeat(32),body_md5:'c'.repeat(32),binary_md5:null,config_md5:null,acl_md5:null,
        anon_execute:false,authenticated_execute:true,service_execute:true,postgres_execute:true}]}};
}
test('effective diagnostics compare unchanged captures without publishing raw identities',()=>{
  const data=fixture(), manifest=effectiveManifest(data,query);
  assert.equal(compareEffective(manifest,data,query).equal,true);
  assert.equal(JSON.stringify(manifest).includes('PRIVATE_'),false);
});
test('owner options, inherited privileges, definer mode and execution rights remain significant',()=>{
  for(const mutate of [d=>{d.groups.storage_access[0].grantable=false;},
    d=>{d.groups.role_reachability[0].usage=true;},
    d=>{d.groups.extension_routines[0].security_definer=true;},
    d=>{d.groups.extension_routines[0].anon_execute=true;},
    d=>{d.groups.extension_routines[0].body_md5='d'.repeat(32);},
    d=>{d.groups.extension_routines[0].acl_md5='e'.repeat(32);},
    d=>{d.groups.extension_routines[0].owner='OTHER_PRIVATE_OWNER';}]){
    const baseline=fixture(), data=structuredClone(baseline);mutate(data);
    const result=compareEffective(effectiveManifest(baseline,query),data,query);
    assert.equal(result.equal,false);assert.equal(result.difference_count,1);
    assert.equal(JSON.stringify(result).includes('PRIVATE_'),false);
  }
});
test('capture refuses untrusted shapes, missing principals, duplicate identities and runtime drift',()=>{
  for(const mutate of [d=>{d.read_only='off';},d=>{d.server_version_num=180000;},
    d=>{d.principals.pop();},d=>{d.groups.storage_access.push(d.groups.storage_access[0]);},
    d=>{d.groups.extension_routines[0].private_extra='secret';},
    d=>{d.groups.storage_access[0].grantable='true';},
    d=>{d.groups.extension_routines[0].body_md5='secret';},
    d=>{d.groups.schema_access=[];}]){
    const data=fixture();mutate(data);assert.throws(()=>effectiveManifest(data,query),/REFUSED/);
  }
});
test('manifest refuses query drift and extra fields; additions and tampered fingerprints cannot pass',()=>{
  const data=fixture(), manifest=effectiveManifest(data,query);
  assert.throws(()=>compareEffective(manifest,data,'b'.repeat(64)),/REFUSED/);
  assert.throws(()=>compareEffective({...manifest,secret:'PRIVATE_MARKER'},data,query),/REFUSED/);
  const added=structuredClone(data);added.groups.schema_access.push({key:['other','schema'],usage:true,create:false});
  assert.equal(compareEffective(manifest,added,query).differences[0].kind,'added');
  const tampered=structuredClone(manifest);tampered.groups.extension_routines[0].fields.owner='f'.repeat(64);
  assert.equal(compareEffective(tampered,data,query).equal,false);
});
