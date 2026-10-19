import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const worker=readFileSync(new URL('../../functions/uskoci-worker-interview/index.ts',import.meta.url),'utf8');
const need=readFileSync(new URL('../../functions/uskoci-ai-interview/index.ts',import.meta.url),'utf8');
test('two Gemini handlers use the same read-only catalog explorer and bounded tool transport behind one flag',()=>{
  for(const source of [worker,need]){
    assert.match(source,/classificationExplorer\.mjs/);
    assert.match(source,/geminiToolConversation\.ts/);
    assert.match(source,/USKOCI_TAXONOMY_UNIFIED_SHADOW/);
    assert.doesNotMatch(source,/catalogPromptContext/);
  }
});
test('requester AI cannot create ESTABLISHED taxonomy nodes mid-turn',()=>{
  assert.doesNotMatch(need,/await\s+rpc\(\s*['"]rpc_taxonomy_ensure_path_service['"]/);
  assert.match(need,/rpc_taxonomy_ai_scoped_preview_service/);
  assert.match(need,/rpc_ai_complete_need_turn_v2_service/);
});
test('worker still has owner-reviewed save authority, not interview activation',()=>{
  assert.doesNotMatch(worker,/await\s+rpc\(\s*['"]rpc_taxonomy_ensure_path_service['"]/);
  assert.match(worker,/WORKER_PROFILE_V1/);
});
