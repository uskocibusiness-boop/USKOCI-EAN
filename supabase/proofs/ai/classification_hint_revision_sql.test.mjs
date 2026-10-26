import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const sql=readFileSync('supabase/migrations/20261026150523_classification_hint_revision_fence.sql','utf8');
const architect=readFileSync('supabase/functions/_shared/backgroundTaxonomyArchitect.mjs','utf8');
const task=readFileSync('supabase/functions/uskoci-ai-interview/index.ts','utf8');
const worker=readFileSync('supabase/functions/uskoci-worker-interview/index.ts','utf8');

test('database stores and reads a hint only at the live durable conversation revision',()=>{
 assert.match(sql,/classification_conversation_revision_v1\(p_conversation_id\)/g);
 assert.match(sql,/if v_current<>p_draft_revision then return jsonb_build_object\('stored',false,'reason','STALE_REVISION'/);
 assert.match(sql,/where conversation_id=p_conversation_id and draft_revision=p_draft_revision\s+and consumed_at is null/s);
 assert.match(sql,/classification_turn_hints_revision_open_idx/);
});

test('consumption is revision-scoped and the old cross-revision endpoint loses service access',()=>{
 assert.match(sql,/rpc_taxonomy_consume_turn_hint_revision_service/);
 assert.match(sql,/conversation_id=p_conversation_id and draft_revision=p_draft_revision and consumed_at is null/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.rpc_taxonomy_consume_turn_hint_service\(uuid,text\) FROM public,anon,authenticated,service_role/);
 assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION public\.rpc_taxonomy_consume_turn_hint_service\(uuid,text\)/);
});

test('architect cannot publish a hint before the owner turn succeeds',()=>{
 assert.doesNotMatch(architect,/void persistClarificationHint\(rpc, clarification\)/);
 assert.match(task,/completed\.state === 'SUCCEEDED' && dualArchitectPromise/);
 assert.match(worker,/if \(dualWorkerArchitectPromise\)/);
 for(const source of [task,worker]){
  assert.match(source,/built\.clarifications\.slice\(0,1\)/);
  assert.match(source,/runInBackground\(\(async \(\) =>/);
 }
});

test('task and worker target the revision produced by their successful completion',()=>{
 assert.match(task,/const taskDraftRevision = history\.reduce/);
 assert.match(task,/draftRevision: taskDraftRevision \+ 2/);
 assert.match(task,/conversationId, taskDraftRevision, pendingClarificationHint\.service/);
 assert.match(worker,/draftRevision: context\.revision \+ 1/);
 assert.match(worker,/input\.conversationId, context\.revision, pendingWorkerClarificationHint\.service/);
});
