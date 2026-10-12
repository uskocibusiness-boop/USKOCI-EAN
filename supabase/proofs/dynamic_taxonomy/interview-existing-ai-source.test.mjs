import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source-only integrity guard. Does NOT invoke Gemini, deploy an Edge function,
// create a category or prove end-to-end dispatch.
const edge = readFileSync('supabase/functions/uskoci-ai-interview/index.ts', 'utf8');
const facts = readFileSync('src/contracts/needFactsV2.ts', 'utf8');
const bridge = readFileSync('supabase/candidates/dynamic-taxonomy-20261011/existing-ai-category-bridge.sql', 'utf8');

test('retain real server Gemini conversation, not a template-only replacement', () => {
  assert.match(edge, /async function callGemini\(/);
  assert.match(edge, /streamGeminiTask\(/);
  assert.match(edge, /const \[messages, facts\] = await Promise\.all\(/);
  assert.match(edge, /function v2Instruction\(/);
  assert.match(edge, /NEED_FACT_SCHEMA_V2/);
});
test('existing model proposes need.category from work meaning, not room or total size', () => {
  assert.match(edge, /Za need\.category izdvojite stvarnu VRSTU USLUGE/);
  assert.match(edge, /Ne ograničavajte legitimne nove vrste usluga na jedanaest starih grupa/);
  assert.match(facts, /'need\.category': \{ valueType: 'TEXT'/);
  assert.match(facts, /'need\.required_skills': \{ valueType: 'TEXT_ARRAY'/);
});
test('new bridge consumes old text interface and grants no job or send rights', () => {
  assert.match(bridge, /p_ai_category text, p_public_description text, p_explicit_required_skills text\[\]/);
  assert.match(bridge, /private\.taxonomy_preview_v1\(v_label\)/);
  assert.match(bridge, /'action','SUGGEST_EXISTING_SERVICE'/);
  assert.match(bridge, /'action','NOVEL_SERVICE_REVIEW'/);
  assert.match(bridge, /'descriptionSemanticallyVerified',false/);
  assert.match(bridge, /'classificationAuthority','NONE'/);
  assert.match(bridge, /'notificationAuthority','NONE'/);
  assert.doesNotMatch(bridge, /\b(?:INSERT INTO|UPDATE public\.needs|DELETE FROM public\.needs)\b/i);
});

test('the existing task AI keeps two execution roots and never guesses online from service label', () => {
  assert.match(edge, /USKOČI ima DVE glavne grane zadataka: NA LOKACIJI ili NA DALJINU/);
  assert.match(edge, /ne zaključuj režim samo iz need\.category/);
  assert.match(edge, /predloži need\.task_geography\.mode=REMOTE bez polazišta/);
  assert.match(edge, /ne prebacuj ga neprimetno u drugu granu/);
});
