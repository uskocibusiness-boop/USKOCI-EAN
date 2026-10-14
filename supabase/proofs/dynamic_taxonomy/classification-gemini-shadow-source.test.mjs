import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../../functions/uskoci-worker-interview/index.ts',import.meta.url),'utf8');
const need=readFileSync(new URL('../../functions/uskoci-ai-interview/index.ts',import.meta.url),'utf8');
test('both worker and need use one shadow schema/inspection module',()=>{
 for(const source of [worker,need]){
  assert.match(source,/classificationGeminiShadow\.mjs/);
  assert.match(source,/withGeminiClassificationShadowSchema/);
  assert.match(source,/inspectGeminiClassificationShadow/);
  assert.match(source,/geminiClassificationShadowInstruction/);
  assert.match(source,/USKOCI_TAXONOMY_UNIFIED_SHADOW/);
 }
});
test('worker strips new fields before existing authoritative RPC completion',()=>{
 const stripped=worker.indexOf('inspectGeminiClassificationShadow(parsed');
 const parsed=worker.indexOf('output=parseWorkerOutput(checked.output)');
 const commit=worker.indexOf("rpc('rpc_complete_worker_ai_turn_service'");
 assert.ok(stripped>0&&parsed>stripped&&commit>parsed);
 assert.doesNotMatch(worker,/rpc_taxonomy_commit_admission_service/);
});
test('need strips new fields before strict facts parser and owner-bound completion',()=>{
 const checked=need.indexOf('inspectGeminiClassificationShadow(value');
 const strict=need.indexOf('parseV2Output(checked.output)');
 const completion=need.indexOf("'rpc_ai_complete_need_turn_v2_service'");
 assert.ok(checked>0&&strict>checked&&completion>strict);
 assert.doesNotMatch(need,/rpc_taxonomy_commit_admission_service/);
});
