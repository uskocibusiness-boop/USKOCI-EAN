import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeClosureRoster,validateClosureRosterCapture} from './r03-closure-roster.mjs';
const h=n=>'a'+n.toString(16).padStart(31,'0');
const row=n=>({signature:'private.source_roster_proof_'+String(n).padStart(3,'0')+'(uuid)',
 body_md5:h(100+n),config_md5:h(5),acl_md5:h(8),owner_md5:h(1),
 security_definer:n%2===0});
const make=()=>({unit:'R10_R12_CLOSURE_ROSTER_READONLY',format_version:1,read_only:'on',
 database:'postgres',server_version_num:170006,
 digester_source_pinned:true,retention_source_pinned:true,
 roster_count:148,roster_unique:true,resolved_count:148,definer_count:74,
 schema_relation_count:168,roster_md5:h(5),source_digest:'b'.repeat(64),
 source_certificate:'c'.repeat(64),source_ready:false,
 schema_digest:'d'.repeat(64),erasure_program_digest:'e'.repeat(64),
 source_roster:Array.from({length:148},(_,i)=>row(i+1))});
test('the exact read-only source query is pinned to the current closure owners',()=>{
 const sql=readFileSync(new URL('./r03-closure-roster.sql',import.meta.url),'utf8');
 assert.match(sql,/BEGIN TRANSACTION READ ONLY;/);
 assert.match(sql,/ROLLBACK;/);
 assert.match(sql,/41e54d223122b58decd25cf66191470a/);
 assert.match(sql,/b89891cd3eb5f327bd642a160e5a2e81/);
 assert.match(sql,/private\.closure_source_digest_v5\(\)/);
 assert.match(sql,/FROM body_inventory/);
 assert.doesNotMatch(sql,/^\s*(?:CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|TRUNCATE|COPY)\s+/im);
});
test('valid 148/148 catalog observation explicitly leaves stale certificate blocked',()=>{
 const v=summarizeClosureRoster(make());
 assert.equal(v.result,'BLOCKED_NOT_ADMITTED');
 assert.equal(v.external_authorization_admitted,false);
 assert.deepEqual(v.blockers,['RETENTION_SOURCE_NOT_READY','SOURCE_CERTIFICATE_DIFFERENT']);
});
test('even a matching source certificate never licenses Auth/Storage or R03 deployment',()=>{
 const x=make();x.source_digest=x.source_certificate;x.source_ready=true;
 const y=summarizeClosureRoster(x);
 assert.equal(y.result,'CATALOG_ONLY_NEEDS_EXTERNAL_PROOF');
 assert.equal(y.external_authorization_admitted,false);
});
test('missing/extra catalog fields, changed source, duplicate signatures or owner metadata fail closed',()=>{
 for(const change of [
   x=>{x.read_only='off';},x=>{x.digester_source_pinned=false;},
   x=>{x.retention_source_pinned=false;},x=>{x.resolved_count=147;},
   x=>{x.schema_relation_count=0;},x=>{x.source_roster.pop();},
   x=>{x.source_roster[1].signature=x.source_roster[0].signature;},
   x=>{x.source_roster[1].body_md5='bad';},
   x=>{x.source_roster[0].secret='unsafe';},
 ]){
  const x=make();change(x);
  assert.throws(()=>validateClosureRosterCapture(x),/R10_CLOSURE_ROSTER_CAPTURE_REFUSED/);
 }
});
