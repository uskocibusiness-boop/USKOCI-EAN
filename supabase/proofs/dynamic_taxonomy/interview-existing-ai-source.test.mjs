import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { serviceExecutionInstruction } from '../../functions/_shared/serviceExecutionInstruction.mjs';

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
  // Rules moved to the canonical V2 instruction, not to a literal legacy sentence.
  assert.match(edge, /need\.category je konkretna VRSTA USLUGE iz celog razgovora/);
  assert.match(edge, /nezavisna od prostorije, kvadrature, komada, adrese, cene i datuma/);
  assert.match(edge, /vrste usluga nisu zatvoren spisak starih grupa/);
  assert.match(edge, /klasifikacije/i);
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
  // Execution-mode authority now lives in one imported shared instruction.
  assert.match(edge, /serviceExecutionInstruction\('NEED_SERVICE'\)/);
  const modeContract = serviceExecutionInstruction('NEED_SERVICE');
  assert.match(modeContract, /only ON_SITE and REMOTE are execution modes/);
  assert.match(modeContract, /A profession name, tools, vehicle, administrative city or catalog modes alone do not establish the execution/);
  assert.match(modeContract, /Do not silently replace physical work with advice/);
  assert.match(modeContract, /REMOTE has no work pin or route/);
  assert.match(modeContract, /Unknown handoff is a missing fact/);
});
