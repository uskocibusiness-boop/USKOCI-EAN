'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {areaOf,checkSource,reviewFlags}=require('./cleanroom-file-ledger.cjs');

test('areas reflect actual feature and shared-runtime responsibilities',()=>{
  assert.equal(areaOf('src/features/ai/intake/turnIntentJournal.ts'),'AI_INTERVIEW');
  assert.equal(areaOf('src/ui/aiFirst/AiConversationShell.tsx'),'AI_INTERVIEW');
  assert.equal(areaOf('src/app/(app)/nova.tsx'),'NAVIGATION');
  assert.equal(areaOf('src/ui/system/FactArt.tsx'),'DESIGN_ASSETS');
  assert.equal(areaOf('src/data/agreementCancellationClientService.ts'),'AGREEMENTS');
  assert.equal(areaOf('supabase/functions/uskoci-ai-interview/index.ts'),'BACKEND_AND_PROOFS');
  assert.equal(areaOf('docs/plan/CODEX_PLAN_RADA.md'),'DOCUMENTATION');
});
test('static checking does not claim SQL or SVG is executed/rendered',()=>{
  assert.equal(checkSource('database.sql',Buffer.from('broken sql')),'SQL_NOT_PARSED_WITH_DATABASE');
  assert.equal(checkSource('icon.svg',Buffer.from('<svg/>')),'SVG_SOURCE_PRESENT_NOT_RENDERED');
  assert.equal(checkSource('docs/a.md',Buffer.from('text')),'DOC_SOURCE_PRESENT');
});
test('safe image header and JSON checks distinguish real errors',()=>{
  assert.equal(checkSource('ok.json',Buffer.from('{"ok":true}')),'JSON_PARSED');
  assert.equal(checkSource('bad.json',Buffer.from('{broken')),'INVALID_JSON');
  assert.equal(checkSource('icon.png',Buffer.from([137,80,78,71,13,10,26,10,0])),'PNG_SIGNATURE_OK');
  assert.equal(checkSource('icon.png',Buffer.from('not an image')),'INVALID_PNG_SIGNATURE');
  assert.equal(checkSource('pic.webp',Buffer.from('RIFF0000WEBP')),'WEBP_SIGNATURE_OK');
});
test('unreferenced modules and duplicate assets are NEVER deletion approvals',()=>{
  const row={path:'src/data/unused.ts',role:'mobile_runtime_or_contract',
    staticIncoming:0,staticOutgoing:0,implicitRouteEntry:false,bytes:999,
    present:true,matchesRecordedBlob:true,parseDiagnostics:[]};
  assert.ok(reviewFlags(row,0,0).some(s=>s.startsWith('ZERO_DIRECT_STATIC')));
  assert.ok(reviewFlags({...row,path:'src/app/(app)/nova.tsx',implicitRouteEntry:true},0,0).includes('EXPO_ROUTE_IS_ENTRY_WITHOUT_IMPORT'));
  assert.ok(reviewFlags({...row,path:'supabase/migrations/01.sql',role:'migration_history_and_checks'},0,0).includes('HISTORIC_DB_MIGRATION_DO_NOT_REMOVE'));
});
test('the ledger highlights unresolved and dynamic dependencies and large files',()=>{
  const r={path:'src/ui/aiFirst/AiConversationShell.tsx',bytes:51000,
    staticIncoming:2,parseDiagnostics:[],role:'mobile_runtime_or_contract',
    present:true,matchesRecordedBlob:true,implicitRouteEntry:false};
  const flags=reviewFlags(r,1,1);
  assert.ok(flags.includes('UNRESOLVED_LOCAL_REFERENCE'));
  assert.ok(flags.includes('DYNAMIC_REFERENCE_REQUIRES_MANUAL_CHECK'));
  assert.ok(flags.includes('LARGE_SOURCE_REVIEW_PERFORMANCE_AND_OWNERSHIP'));
});
