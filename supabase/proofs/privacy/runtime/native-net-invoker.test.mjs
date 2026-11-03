// Synthetic fixtures test the evaluator; the separately recorded baseline is also bound below.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {compareNativeNetInvoker,nativeNetInvokerObservation,parseNativeNetInvokerOutput,
 validateNativeNetInvokerBaseline} from './native-net-invoker.mjs';
const sql=readFileSync(new URL('./native-net-invoker.sql',import.meta.url));
const sha=createHash('sha256').update(sql).digest('hex');
const old=JSON.parse(readFileSync(new URL('./native-net-provenance-expected.json',import.meta.url)));
const observed=side=>({unit:'R01_NATIVE_NET_INVOKER_CAPTURE',format_version:1,read_only:'on',
 server_version_num:170006,database:'postgres',extension_version:'0.20.4',capture_role:side==='hosted'?'postgres':'supabase_admin',
 helper:{source_sha256:old.observation.helper[side==='hosted'?'source_sha256':'normalized_sha256'],
  config_kind:side==='hosted'?'EMPTY_SEARCH_PATH':'INHERITED',invoker:true,event_return:true,plpgsql:true},
 event:{create_extension_only:true,invokes_helper:true},
 resolution:{catalog_first:true,ddl_commands_builtin:true,extension_builtin:true,roles_builtin:true,visible_shadow_routines:0},
 delegation:{registered:true,role_sha256:createHash('sha256').update('supabase_privileged_role').digest('hex')},
 principals:['anon','authenticated','authenticator','service_role'].map(principal=>({principal,present:true,
  superuser:false,createrole:false,database_create:false,authority_usage_count:0,authority_set_count:0}))});
const baseline=()=>({unit:'R01_NATIVE_NET_INVOKER_DEV_BASELINE',format_version:1,
 query_sha256:sha,observation:observed('hosted')});

test('recorded hosted observation is bound to the exact collector bytes and pinned context',()=>{
 const live=JSON.parse(readFileSync(new URL('./native-net-invoker-expected.json',import.meta.url)));
 assert.deepEqual(validateNativeNetInvokerBaseline(live,sha),observed('hosted'));
 assert.throws(()=>validateNativeNetInvokerBaseline(live,createHash('sha256').update(sql).update('\n').digest('hex')),
  /FORMAT_REFUSED/);
 const changed=structuredClone(live);changed.observation.principals[1].authority_set_count=1;
 assert.throws(()=>validateNativeNetInvokerBaseline(changed,sha),/FORMAT_REFUSED/);
});

test('psql receipt requires exact path acknowledgement and one validated catalog row',()=>{
 const row=JSON.stringify(observed('native'));
 assert.deepEqual(parseNativeNetInvokerOutput('t\n'+row),observed('native'));
 assert.deepEqual(parseNativeNetInvokerOutput('t\r\n'+row+'\r\n'),observed('native'));
 for(const value of [row,'f\n'+row,'t\n','t\n'+row+'\n'+row,'t\nPRIVATE_MARKER',
  't\n'+JSON.stringify({...observed('native'),raw:'PRIVATE_MARKER'}),' '.repeat(32769),null]){
  assert.throws(()=>parseNativeNetInvokerOutput(value),/^Error: R01_NATIVE_NET_INVOKER_FORMAT_REFUSED$/);
 }
});

test('paired exact observed contexts verify only this prerequisite, never R01 admission',()=>{
 const result=compareNativeNetInvoker(baseline(),observed('native'),sha);
 assert.equal(result.observed_context_prerequisite_verified,true);
 assert.equal(result.r01_boundary_admitted,false);
 assert.equal(result.difference_count,0);
 assert.match(result.limitations,/indirect SECURITY DEFINER/);
 assert.match(result.limitations,/arbitrary future search_path/);
 assert.match(result.limitations,/ADMIN OPTION-mediated grants/);
});

test('native observation cannot substitute for hosted evidence or a different query',()=>{
 assert.throws(()=>compareNativeNetInvoker(null,observed('native'),sha),/FORMAT_REFUSED/);
 assert.throws(()=>compareNativeNetInvoker(baseline(),observed('native'),'0'.repeat(64)),/FORMAT_REFUSED/);
 const replaced=baseline();replaced.observation=observed('native');
 assert.throws(()=>compareNativeNetInvoker(replaced,observed('native'),sha),/FORMAT_REFUSED/);
});

test('both sides reject source, event, name shadowing, missing role and privilege routes',()=>{
 const mutations=[
  x=>{x.extension_version='0.8.0';},x=>{x.extension_version=null;},
  x=>{x.helper.source_sha256='0'.repeat(64);},x=>{x.helper.config_kind='OTHER';},
  x=>{x.helper.invoker=false;},x=>{x.helper.event_return=false;},x=>{x.helper.plpgsql=false;},
  x=>{x.helper=null;},x=>{x.event=null;},x=>{x.event.create_extension_only=false;},
  x=>{x.event.invokes_helper=false;},x=>{x.resolution.catalog_first=false;},
  x=>{x.resolution.ddl_commands_builtin=false;},x=>{x.resolution.extension_builtin=false;},
  x=>{x.resolution.roles_builtin=false;},x=>{x.resolution.visible_shadow_routines=1;},
  x=>{x.delegation.registered=false;},x=>{x.delegation.role_sha256=null;},
  x=>{x.principals[0].present=false;},x=>{x.principals[0].superuser=true;},
  x=>{x.principals[1].createrole=true;},x=>{x.principals[2].database_create=true;},
  x=>{x.principals[3].authority_usage_count=1;},x=>{x.principals[3].authority_set_count=1;},
 ];
 for(const mutate of mutations){
  const native=observed('native');mutate(native);
  assert.equal(compareNativeNetInvoker(baseline(),native,sha).observed_context_prerequisite_verified,false);
  const dev=baseline();mutate(dev.observation);
  assert.throws(()=>compareNativeNetInvoker(dev,observed('native'),sha),/FORMAT_REFUSED/);
 }
});

test('changed platform, extra raw fields, malformed/null values and missing principals fail closed',()=>{
 for(const mutate of [x=>{x.server_version_num=180000;},x=>{x.read_only='off';},
  x=>{x.raw_path='PRIVATE_MARKER';},x=>{x.helper.source_sha256='PRIVATE_MARKER';},
  x=>{x.delegation.registered=null;},x=>{x.resolution.visible_shadow_routines=-1;},
  x=>{x.principals.pop();},x=>{x.principals[0].database_create='false';},
  x=>{x.principals.reverse();},x=>{x.principals[0].authority_set_count=Number.MAX_SAFE_INTEGER+1;}]){
  const native=observed('native');mutate(native);
  assert.throws(()=>nativeNetInvokerObservation(native),/FORMAT_REFUSED/);
 }
});
