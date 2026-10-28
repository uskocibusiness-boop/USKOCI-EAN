import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {extensionAclTupleObservation,validateExtensionAclTupleBaseline,compareExtensionAclTuples} from './extension-acl-tuples.mjs';
const md5=value=>createHash('md5').update(value).digest('hex');
const id=i=>md5('extension-function-'+i);
const roles=['anon','authenticated','authenticator','postgres','service_role','supabase_admin',
 'supabase_auth_admin','supabase_functions_admin','supabase_realtime_admin','supabase_storage_admin'];
const reach=present=>roles.map(principal=>({principal,usage:present&&principal==='supabase_admin',set:present&&principal==='supabase_admin'}));
const entry=(grantee,grantor,owner=false,dashboard=false)=>({grantee_md5:md5(grantee),grantor_md5:md5(grantor),
 privilege:'EXECUTE',grantable:owner,owner_entry:owner,dashboard_entry:dashboard});
const ordered=a=>a.sort((x,y)=>[x.grantee_md5,x.grantor_md5,x.privilege].join('|').localeCompare([y.grantee_md5,y.grantor_md5,y.privilege].join('|'),'en'));
const routines=[];let i=0;
for(const [extension,count] of [['pgcrypto',36],['uuid-ossp',10],['pg_stat_statements',3]]){
 for(let j=0;j<count;j++){
  i++;
  routines.push({extension,key_hash:id(i),owner_md5:md5('postgres'),acl_null:false,
   acl:ordered([entry('PUBLIC','postgres'),entry('dashboard_user','postgres',false,true),entry('postgres','postgres',true)])});
 }
}
routines.sort((a,b)=>a.key_hash.localeCompare(b.key_hash,'en'));
const dev={unit:'R01_EXTENSION_ACL_TUPLES_CAPTURE',format_version:1,read_only:'on',
 server_version_num:170006,database:'postgres',dashboard_role:{login:false,superuser:false,createrole:true,bypassrls:false,inherit:true},
 dashboard_reachability:reach(true),routines};
const expected={unit:'R01_EXTENSION_ACL_TUPLES_DEV_BASELINE',format_version:1,query_sha256:'1'.repeat(64),observation:dev};
const native=()=>({...structuredClone(dev),dashboard_role:null,dashboard_reachability:reach(false),
 routines:dev.routines.map(row=>({...structuredClone(row),owner_md5:md5('supabase_admin'),
 acl:ordered([entry('PUBLIC','supabase_admin'),entry('supabase_admin','supabase_admin',true)])}))});
const scope={unit:'R01_EXTENSION_ACL_SCOPE_COMPARISON',caller_mismatch_count:0,full_acl_count_drift:true,owner_acl_metadata_delta_count:49};
test('exact DEV catalog baseline has 49 unique routine hashes, one dashboard entry each and pinned query',()=>{
 assert.equal(validateExtensionAclTupleBaseline(expected,expected.query_sha256).routines.length,49);
 assert.throws(()=>validateExtensionAclTupleBaseline(expected,'0'.repeat(64)),/FORMAT_REFUSED/);
});
test('diagnostics preserve each missing dashboard entry and owner change, never call them admitted',()=>{
 const v=compareExtensionAclTuples(expected,native(),expected.query_sha256,scope);
 assert.equal(v.changed_routines,49);
 assert.equal(v.exact_acl_equal,false);
 assert.equal(v.counts.dev_dashboard_only,49);
 assert.equal(v.counts.owner_changed,49);
 assert.equal(v.request_scope_match,true);
 assert.match(v.limitations,/Does not waive/);
});
test('changed grant-option, extra grantee, unknown original, or absent role mark exact metadata mismatch',()=>{
 const m=native();m.routines[2].acl[0].grantable=true;
 const result=compareExtensionAclTuples(expected,m,expected.query_sha256,scope);
 assert.equal(result.exact_acl_equal,false);
 assert.equal(result.counts.dev_only>0,true);
 assert.equal(result.counts.native_only>0,true);
});
test('reject malformed, duplicated, moved and unauthorized ACL rows and wrong scope',()=>{
 const mutators=[x=>{x.routines[0].acl[0].dashboard_entry=true;},
 x=>{x.routines[0].acl[0].privilege='UPDATE';},
 x=>{x.routines[0].acl[0].grantor_md5='raw_name';},
 x=>{x.routines[0].acl.reverse();},
 x=>{x.routines[0].acl.push(x.routines[0].acl[0]);},
 x=>{x.routines.pop();},
 x=>{x.dashboard_role={login:true};},
 x=>{x.dashboard_reachability[0].set=true;},
 x=>{x.routines[1].extra=true;}];
 for(const mutation of mutators){const x=native();mutation(x);
  assert.throws(()=>compareExtensionAclTuples(expected,x,expected.query_sha256,scope),/FORMAT_REFUSED/);}
 assert.throws(()=>compareExtensionAclTuples(expected,native(),expected.query_sha256,{...scope,caller_mismatch_count:1}),/FORMAT_REFUSED/);
});
