import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {check,sourceCommit,slugs,candidatePayload,rollbackPayload,verifyLive,verifyClosure,scanSecrets,rpcPreflight,snapshotSourceReader,deploymentBaseline} from './build.mjs';
const load=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));

test('complete pinned source and original rollback files regenerate without drift',()=>{
 check();
 const source=load('source-files.json'),manifest=load('manifest.json');
 assert.equal(source.files.length,26);assert.deepEqual(manifest.candidate.map(x=>x.files.length),[23,21]);
 assert.deepEqual(manifest.before.map(x=>x.version),[151,104]);
 for(const [i,slug]of slugs.entries()){
  const before=load(['before.need.json','before.worker.json'][i]),rollback=rollbackPayload(slug);
  assert.deepEqual(rollback.files,before.files);assert.equal(rollback.verify_jwt,false);
  assert.equal(verifyLive(slug,'before-config',before).source_exact,true);
  assert.throws(()=>verifyLive(slug,'before',before),'Original versions are not the current predeploy baseline');
  assert.equal(verifyLive(slug,'before',deploymentBaseline(slug)).source_exact,true);
 }
});

test('bundle closure refuses missing shared module, unrelated file and computed import',()=>{
 const bundle=candidatePayload(slugs[0]);
 assert.throws(()=>verifyClosure(bundle.entrypoint_path,bundle.files.filter(f=>!f.name.endsWith('/taxonomyRuntimeConfig.mjs'))),/Missing bundle dependency/);
 assert.throws(()=>verifyClosure(bundle.entrypoint_path,[...bundle.files,{name:'unused.ts',content:'export {};'}]),/Unrelated file/);
 const altered=structuredClone(bundle.files);altered.find(f=>f.name===bundle.entrypoint_path).content+='\nvoid import(somePath);';
 assert.throws(()=>verifyClosure(bundle.entrypoint_path,altered),/Unreviewed dynamic dependency/);
});

test('fresh exact preflight rejects changed identity, JWT mode, bundle hash or version',()=>{
 const before=deploymentBaseline(slugs[0]);
 for(const changed of [{...before,id:'foreign'},{...before,verify_jwt:true},{...before,version:before.version+1},
  {...before,ezbr_sha256:'a'.repeat(64)}])assert.throws(()=>verifyLive(slugs[0],'before',changed));
});

test('postflight requires every candidate byte and a new active version',()=>{
 const before=deploymentBaseline(slugs[1]),candidate=candidatePayload(slugs[1]);
 const observed={...before,version:before.version+1,ezbr_sha256:'a'.repeat(64),files:candidate.files};
 assert.equal(verifyLive(slugs[1],'candidate',observed).files,21);
 assert.throws(()=>verifyLive(slugs[1],'candidate',{...observed,version:before.version}));
 const changed=structuredClone(observed);changed.files[0].content+='\n// drift';
 assert.throws(()=>verifyLive(slugs[1],'candidate',changed),/source mismatch/);
 assert.throws(()=>verifyLive(slugs[1],'candidate',{...observed,status:'FAILED'}));
 // A source rollback also creates a newer version; old metadata is not rollback proof.
 assert.throws(()=>verifyLive(slugs[1],'rollback',before),/new version/);
 assert.equal(verifyLive(slugs[1],'rollback',{...before,version:before.version+2}).source_exact,true);
});

test('literal credential scan refuses embedded key without treating environment names as credentials',()=>{
 scanSecrets([{name:'safe.ts',content:"const key=Deno.env.get('GEMINI_API_KEY');"}]);
 assert.throws(()=>scanSecrets([{name:'unsafe.ts',content:'const key="'+'AIza'+'A'.repeat(35)+'";'}]),/Possible embedded credential/);
});

test('shallow-checkout fallback requires the exact frozen revision and current source bytes',()=>{
 const frozen={source_commit:sourceCommit,files:[{name:'entry.ts',content:'export const value=1;'}]};
 assert.equal(snapshotSourceReader(frozen,()=>frozen.files[0].content)('entry.ts'),frozen.files[0].content);
 assert.throws(()=>snapshotSourceReader({...frozen,source_commit:'foreign'},()=>''),/Wrong frozen source revision/);
 assert.throws(()=>snapshotSourceReader(frozen,()=>'export const value=2;')('entry.ts'),/current source differs/);
 assert.throws(()=>snapshotSourceReader(frozen,()=>'' )('missing.ts'),/Missing frozen source/);
});

test('25 RPC preflight is read-only, schema-qualified and refuses a newly deployed receipt ABI',()=>{
 const sql=rpcPreflight(load('rpc-preimage.json'));
 assert.equal((sql.match(/IF NOT EXISTS\(SELECT 1 FROM pg_proc/g)||[]).length,25);
 assert.equal((sql.match(/to_regprocedure\('public\./g)||[]).length,26);
 assert.match(sql,/BEGIN TRANSACTION READ ONLY/);assert.match(sql,/ROLLBACK;\s*$/);
 assert.match(sql,/EDGE_AI_RECEIPT_RPC_RECAPTURE_REQUIRED/);
 const changed=load('rpc-preimage.json');changed.functions[0].authenticated=true;
 assert.throws(()=>rpcPreflight(changed));
 assert.doesNotMatch(sql,/CREATE |ALTER |DROP |INSERT |UPDATE |DELETE /i);
});
