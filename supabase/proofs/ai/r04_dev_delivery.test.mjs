import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {derive} from '../../operations/dev-alpha/r04-single-pass-20261103/build.mjs';
import {deriveClosure} from '../../operations/dev-alpha/r04-single-pass-20261103/closure-postimage.mjs';
import {check,payload,verifyLive} from '../../operations/dev-alpha/r04-single-pass-20261103/edge-package.mjs';
const root=new URL('../../operations/dev-alpha/r04-single-pass-20261103/',import.meta.url);
const read=n=>JSON.parse(readFileSync(new URL(n,root),'utf8'));
test('closure postimage preserves readiness but accounts for both new storage and changed erasure code',async()=>{
 const captured=read('closure-input.json'),derived=await derive(),after=await deriveClosure(captured,derived);
 assert.notEqual(after.schema,captured.actual.schema);assert.notEqual(after.erasure,captured.actual.erasure);assert.notEqual(after.source,captured.actual.source);
 for(const key of ['certificate','source_ready','export_binding','erasure_binding'])assert.deepEqual(after[key],captured.actual[key]);
 assert.deepEqual(after,read('closure-postimage.json'));
 const corrupt=structuredClone(captured);corrupt.source_input+='\n';
 await assert.rejects(deriveClosure(corrupt,derived),/capture integrity/);
 const wrong=structuredClone(derived);wrong.before.find(f=>f.name==='private.closure_taxonomy_project_v1').definition+='\n';
 // Alter the body, not a harmless trailing newline.
 const f=wrong.before.find(f=>f.name==='private.closure_taxonomy_project_v1');f.definition=f.definition.replace('AS $function$','AS $function$ ');
 await assert.rejects(deriveClosure(captured,wrong),/preimage/);
});
test('paired Edge package retains complete rollback and rejects an omitted dependency',()=>{
 check();
 for(const slug of ['uskoci-ai-interview','uskoci-worker-interview']){
  const before=read('edge-before.'+(slug==='uskoci-ai-interview'?'need':'worker')+'.json');
  const candidate=payload(slug);assert.ok(candidate.files.length>10);
  assert.deepEqual(payload(slug,true).files,before.files);
  const live={...before,version:before.version+1,files:candidate.files};assert.equal(verifyLive(slug,live).source_exact,true);
  assert.throws(()=>verifyLive(slug,{...live,files:live.files.slice(1)}));
 }
});
