import assert from 'node:assert/strict';
import test from 'node:test';
import {storageAclObservation,validateStorageAclBaseline,compareStorageOwnerAcl} from './storage-owner-acl.mjs';
const h=n=>'a'+n.toString(16).padStart(31,'0');
const roles=['anon','authenticated','authenticator','postgres','service_role','supabase_admin',
 'supabase_auth_admin','supabase_functions_admin','supabase_realtime_admin','supabase_storage_admin'];
const priv=['DELETE','INSERT','MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE'];
const acl=[];
for(let i=0;i<32;i++){acl.push({grantee_md5:h(Math.floor(i/8)+1),grantor_md5:h(9),
 privilege:priv[i%8],owner_entry:i>=24,grantable:i>=24});}
const effective=roles.flatMap(role=>priv.map(privilege=>({role,privilege,allowed:true,
 grantable:role==='supabase_storage_admin',owner:role==='supabase_storage_admin'})));
const dev={unit:'R01_STORAGE_OWNER_ACL_CAPTURE',format_version:1,read_only:'on',database:'postgres',
 server_version_num:170006,owner_md5:h(99),acl_null:false,acl,effective};
const expected={unit:'R01_STORAGE_ACL_DEV_BASELINE',format_version:1,query_sha256:'3'.repeat(64),observation:dev};
const native=()=>({...structuredClone(dev),acl:dev.acl.map(item=>({...item,grantable:item.owner_entry?false:item.grantable}))});
test('baseline has exact 32 ACL entries, 8 owner options and 80 effective checks',()=>{
 assert.equal(validateStorageAclBaseline(expected,expected.query_sha256).acl.length,32);
 assert.throws(()=>validateStorageAclBaseline(expected,'0'.repeat(64)),/FORMAT_REFUSED/);
});
test('only eight owner grant-option raw bits differ; effective privileges remain',()=>{
 const r=compareStorageOwnerAcl(expected,native(),expected.query_sha256);
 assert.equal(r.owner_grant_representation_verified,true);
 assert.equal(r.eight_owner_grant_bits_differ,true);
 assert.equal(r.effective_privileges_equal,true);
 assert.match(r.limitations,/Strict metadata/);
});
test('non-owner differences, owner identity or effective grant changes reject',()=>{
 for(const change of [x=>{x.acl[0].grantable=true;},
 x=>{x.acl[0].grantor_md5=h(10);},
 x=>{x.owner_md5=h(11);},
 x=>{x.acl[24].grantable=true;},
 x=>{x.effective[0].allowed=false;}]){
  const x=native();change(x);
  try { assert.equal(compareStorageOwnerAcl(expected,x,expected.query_sha256).owner_grant_representation_verified,false); }
  catch(e) { assert.match(e.message,/R01_STORAGE_ACL_FORMAT_REFUSED/); }
 }
});
test('malformed, missing or duplicate entries fail closed',()=>{
 for(const change of [x=>{x.acl.pop();},x=>{x.acl[0].unexpected='x';},
 x=>{x.effective[0].privilege='WRONG';},x=>{x.effective.pop();},
 x=>{x.acl[0].grantee_md5='invalid';},x=>{x.acl_null=true;}]){
  const x=native();change(x);
  assert.throws(()=>compareStorageOwnerAcl(expected,x,expected.query_sha256),/FORMAT_REFUSED/);
 }
});
