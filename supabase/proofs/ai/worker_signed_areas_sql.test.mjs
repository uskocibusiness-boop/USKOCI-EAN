// Source-level migration contract. Runtime SQL is separately exercised by the
// migration's transactional proof and DEV readback.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const sql=readFileSync('supabase/migrations/20261026145430_worker_ai_signed_work_areas.sql','utf8');
const continuity=readFileSync('supabase/migrations/20261026150020_worker_ai_area_source_continuity.sql','utf8');

test('resolved workAreas have one service-only writer and the canonical validator',()=>{
 assert.match(sql,/patch-array\[[^\]]*'workAreas'[^\]]*\]/s);
 assert.match(sql,/if manual and patch\?'workAreas' then raise exception 'WORKER_AI_PATCH_INVALID'/);
 assert.match(sql,/v:=private\.validate_worker_areas_v1\(patch->'workAreas'\)/);
 assert.match(sql,/jsonb_set\(result,'\{workAreas\}',v\)/);
});

test('a later profile conversation reloads signed areas and binds them into stale detection',()=>{
 assert.match(sql,/worker_ai_initial[\s\S]*'workAreas',private\.worker_saved_areas_v1\(aid\)/);
 assert.match(sql,/worker_ai_source[\s\S]*'workAreas',private\.worker_saved_areas_v1\(aid\)/);
 assert.match(sql,/WA01_CANONICAL_AREA_NOT_PRESERVED/);
 assert.match(sql,/WA01_MANUAL_AREA_ACCEPTED/);
 assert.match(sql,/WA01_UNROUNDED_AREA_ACCEPTED/);
});

test('private writer helpers remain unavailable to API roles',()=>{
 for(const signature of [
  'private.worker_ai_source(uuid)',
  'private.worker_ai_initial(uuid)',
  'private.worker_ai_patch(jsonb,jsonb,uuid,uuid,boolean)',
 ]) assert.ok(sql.includes(`REVOKE ALL ON FUNCTION ${signature} FROM public,anon,authenticated,service_role;`),signature);
});

test('compatible open sessions are upgraded without masking genuinely stale state',()=>{
 assert.match(continuity,/c\.status='OPEN'/);
 assert.match(continuity,/not\(s\.candidate\?'workAreas'\)/);
 assert.match(continuity,/worker_saved_areas_v1\(s\.account_id\)='\[\]'::jsonb/);
 assert.match(continuity,/s\.base_hash=encode\(extensions\.digest\(coalesce/);
});

test('a signed Save refreshes only its exact candidate while concurrent sessions stay stale',()=>{
 assert.match(continuity,/AFTER INSERT ON private\.worker_ai_saves/);
 assert.match(continuity,/s\.conversation_id=v_conversation_id and s\.account_id=new\.account_id/);
 assert.match(continuity,/coalesce\(s\.candidate->'workAreas','\[\]'::jsonb\)=v_areas/);
 assert.match(continuity,/WORKER_AI_SAVED_AREA_SOURCE_MISMATCH/);
 assert.match(continuity,/REVOKE ALL ON FUNCTION private\.worker_ai_area_source_continuity_v1\(\) FROM public,anon,authenticated,service_role/);
});
