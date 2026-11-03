import assert from 'node:assert/strict';
import test from 'node:test';
import {extensionAclObservation,validateExtensionAclBaseline,compareExtensionAclScope} from './extension-acl-scope.mjs';
const h=n=>'f'+n.toString(16).padStart(31,'0');
const counts=[['pg_stat_statements',3],['pgcrypto',36],['uuid-ossp',10]];
const rows=[];let i=0;
for(const [extension,count] of counts)for(let j=0;j<count;j++){
 i++;
 rows.push({key_hash:h(i),extension,owner_md5:h(50),null_acl:false,
  full_acl_md5:h(51),request_acl_md5:h(52),full_acl_count:3,request_acl_count:1,
  security_definer:false,strict:true,volatility:'i',parallel:'s',leakproof:false,
  language:'c',body_md5:h(53),binary_md5:h(54),config_md5:null,definition_md5:h(55),
  anon_exec:true,authenticated_exec:true,authenticator_exec:true,service_exec:true});
}
const baseline={unit:'R01_EXTENSION_ACL_DEV_BASELINE',format_version:1,
 query_sha256:'1'.repeat(64),observation:{unit:'R01_EXTENSION_ACL_SCOPE_CAPTURE',format_version:1,
 read_only:'on',database:'postgres',server_version_num:170006,routines:rows}};
const mutate=()=>structuredClone(baseline.observation);
test('49 unique, ordered extension routines cover exactly three extensions',()=>{
 assert.equal(extensionAclObservation(baseline.observation).routines.length,49);
 assert.throws(()=>extensionAclObservation({...mutate(),routines:rows.slice(1)}),/FORMAT_REFUSED/);
 assert.throws(()=>extensionAclObservation({...mutate(),routines:[...rows].reverse()}),/FORMAT_REFUSED/);
 assert.throws(()=>validateExtensionAclBaseline(baseline,'0'.repeat(64)),/FORMAT_REFUSED/);
});
test('same caller grants/body with changed owner and full ACL is separate from strict equality',()=>{
 const x=mutate();x.routines[0].owner_md5=h(99);x.routines[0].full_acl_md5=h(100);
 const r=compareExtensionAclScope(baseline,x,baseline.query_sha256);
 assert.equal(r.caller_scope_verified,true);
 assert.equal(r.owner_acl_metadata_equal,false);
 assert.equal(r.owner_acl_metadata_delta_count,1);
 assert.match(r.limitations,/strict catalog mismatches/);
});
test('request grant hash, effective execute, function body or routine changes block caller-scope',()=>{
 for(const change of [
   x=>{x.routines[0].request_acl_md5=h(99);},
   x=>{x.routines[0].anon_exec=false;},
   x=>{x.routines[0].body_md5=h(99);},
   x=>{x.routines[0].definition_md5=h(99);},
   x=>{x.routines[0].full_acl_count=2;},
 ]){
  const x=mutate();change(x);
  assert.equal(compareExtensionAclScope(baseline,x,baseline.query_sha256).caller_scope_verified,false);
 }
});
test('unknown fields, unexpected owner/ACL types and SECURITY DEFINER fail closed',()=>{
 for(const change of [
  x=>{x.routines[0].extra=true;},
  x=>{x.routines[0].owner_md5='oops';},
  x=>{x.routines[0].security_definer=true;},
  x=>{x.routines[0].extension='pg_net';},
  x=>{x.routines[0].request_acl_count=4;},
  x=>{x.server_version_num=180000;},
 ]){
  const x=mutate();change(x);
  assert.throws(()=>compareExtensionAclScope(baseline,x,baseline.query_sha256),/FORMAT_REFUSED/);
 }
});
