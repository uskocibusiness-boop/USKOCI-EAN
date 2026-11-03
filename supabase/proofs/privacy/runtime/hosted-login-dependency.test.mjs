import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {hostedLoginObservation, validateHostedLoginBaseline,
  compareHostedLoginDependency} from './hosted-login-dependency.mjs';
const expected=JSON.parse(readFileSync(new URL('./hosted-login-dependency-expected.json',import.meta.url)));
const source=readFileSync(new URL('./hosted-login-dependency.sql',import.meta.url));
const hash=createHash('sha256').update(source).digest('hex');
const native=()=>({...structuredClone(expected.observation),hosted_role:null,membership:[],
  reachability:expected.observation.reachability.map(r=>({...r,usage:false,set:false}))});

test('read-only DEV baseline and SQL content are pinned',()=>{
  assert.equal(validateHostedLoginBaseline(expected,hash).database,'postgres');
  assert.throws(()=>validateHostedLoginBaseline(expected,'0'.repeat(64)),/FORMAT_REFUSED/);
  for(const mutate of [
    x=>{x.observation.read_only='off';},
    x=>{x.observation.reachability.find(r=>r.principal==='supabase_admin').set=false;},
    x=>{x.observation.hosted_role.login=false;},
    x=>{x.observation.membership[0].inherit=true;},
    x=>{x.observation.shared_dependency_count=1;},
  ]) {
    const x=structuredClone(expected);mutate(x);
    assert.throws(()=>validateHostedLoginBaseline(x,hash),/FORMAT_REFUSED/);
  }
});

test('disposable role absent and all principals unable to SET is a separate narrow PASS',()=>{
  const result=compareHostedLoginDependency(expected,native(),hash);
  assert.equal(result.provenance_verified,true);
  assert.equal(result.difference_count,0);
  assert.match(result.limitations,/dynamic SQL/);
});

test('Postgres JSONB key order is immaterial but principal array order is not',()=>{
  const result=native();
  result.reachability=result.reachability.map(row=>({set:row.set,usage:row.usage,principal:row.principal}));
  assert.equal(compareHostedLoginDependency(expected,result,hash).provenance_verified,true);
});

test('privilege, membership, routine reference and role settings differences are rejected',()=>{
  const mutations=[
    x=>{x.hosted_role={...expected.observation.hosted_role};},
    x=>{x.membership=[...expected.observation.membership];},
    x=>{x.reachability[1].set=true;},
    x=>{x.reachability[5].usage=true;},
    x=>{x.shared_dependency_count=1;},
    x=>{x.role_settings_count=1;},
    x=>{x.routine_literal_mentions=1;},
  ];
  for(const mutate of mutations) {
    const x=native();mutate(x);
    assert.equal(compareHostedLoginDependency(expected,x,hash).provenance_verified,false);
  }
});

test('missing or extra schema fields, missing principals and bad versions fail closed',()=>{
  const mutations=[
    x=>{x.reachability.pop();},
    x=>{x.reachability[0].principal='wrong';},
    x=>{x.principals.pop();},
    x=>{x.read_only='off';},
    x=>{x.server_version_num=180000;},
    x=>{x.hosted_role={login:false};},
    x=>{x.membership=[{member:'unknown'}];},
    x=>{x.extra='unreviewed';},
  ];
  for(const mutate of mutations) {
    const x=native();mutate(x);
    assert.throws(()=>compareHostedLoginDependency(expected,x,hash),/FORMAT_REFUSED/);
  }
});
