import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {compareRequestPath,requestPathObservation,validateRequestPathBaseline} from './request-call-graph.mjs';
const source=readFileSync(new URL('./request-call-graph.sql',import.meta.url));
const baseline=JSON.parse(readFileSync(new URL('./request-call-graph-expected.json',import.meta.url),'utf8'));
const sha=createHash('sha256').update(source).digest('hex');
const clone=()=>structuredClone(baseline.observation);
test('exact DEV source binding, 11 real roots, six RLS policies and closed bounded frontier',()=>{
 const data=validateRequestPathBaseline(baseline,sha);
 assert.equal(data.matched_roots,11);
 assert.equal(data.frontier_unvisited,0);
 assert.equal(data.policies.length,6);
 assert.throws(()=>validateRequestPathBaseline(baseline,'0'.repeat(64)),/FORMAT_REFUSED/);
});
test('identical captured graph has zero differences but is not HTTP authorization proof',()=>{
 const x=compareRequestPath(baseline,clone(),sha);
 assert.equal(x.qualified_source_equal,true);
 assert.equal(x.raw_metadata_equal,true);
 assert.match(x.limitations,/not proven absent/);
});
test('an invoker owner ACL drift remains visible even if lexical path sources still match',()=>{
 const x=clone();const target=x.nodes.find(n=>n.kind==='EXTENSION'&&!n.security_definer);
 assert(target,'expected real invoker extension');
 target.owner_md5='a'.repeat(32);target.acl_md5='b'.repeat(32);
 const result=compareRequestPath(baseline,x,sha);
 assert.equal(result.qualified_source_equal,true);
 assert.equal(result.raw_metadata_equal,false);
 assert.ok(result.administrative_difference_count>0);
});
test('SECURITY DEFINER owner, executable source, policy and graph drift cannot pass',()=>{
 const mutations=[
  x=>{const n=x.nodes.find(n=>n.security_definer);assert(n);n.owner_md5='c'.repeat(32);},
  x=>{x.nodes[0].body_md5='e'.repeat(32);},
  x=>{x.policies[0].using_md5='e'.repeat(32);},
  x=>{x.edges.pop();},
 ];
 for(const edit of mutations) {
  const x=clone();edit(x);
  assert.equal(compareRequestPath(baseline,x,sha).qualified_source_equal,false);
 }
});
test('unexpected role capability, missing node, new dynamic SQL or unvisited frontier fails closed',()=>{
 const mutations=[
  x=>{x.nodes[0].anon_execute='false';},
  x=>{x.nodes.splice(0,1);},
  x=>{x.dynamic_count=1;},
  x=>{x.frontier_unvisited=1;},
  x=>{x.nodes[0].private_literal='unsafe';},
  x=>{x.policies[0].role_md5='not_md5';},
 ];
 for(const edit of mutations) {
  const x=clone();edit(x);
  assert.throws(()=>compareRequestPath(baseline,x,sha),/FORMAT_REFUSED/);
 }
});
