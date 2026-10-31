// Production-safe, React-free, provider-free config admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import {taxonomyOptionalEnabled, taxonomyDualGeminiEnabled} from '../../functions/_shared/taxonomyRuntimeConfig.mjs';
const ref='leqcwgzvjsxugfgzdmth';
const project='https://'+ref+'.supabase.co';
const allowed={SUPABASE_URL:project,SUPABASE_ANON_KEY:'SYNTHETIC_PUBLIC',
  USKOCI_TAXONOMY_ROLLOUT_SCOPE:'DEV',USKOCI_TAXONOMY_ALLOWED_PROJECT_REF:ref,
  USKOCI_GEMINI_PAID_TEST_ENABLED:'true',USKOCI_TAXONOMY_DUAL_GEMINI:'true'};
const read=(value)=>key=>value[key];
test('new optional taxonomy flags are OFF for absent/false values, even on canonical DEV',()=>{
 const env=read({...allowed,USKOCI_TAXONOMY_DUAL_GEMINI:undefined});
 for(const name of ['USKOCI_TAXONOMY_DIRECT_REPLY','USKOCI_TAXONOMY_UNIFIED_SHADOW','USKOCI_TAXONOMY_SHADOW_CAPTURE']){
  assert.equal(taxonomyOptionalEnabled(env,name),false,name);
  assert.equal(taxonomyOptionalEnabled(read({...allowed,[name]:'false'}),name),false,name);
  assert.equal(taxonomyOptionalEnabled(read({...allowed,[name]:'true'}),name),true,name);
  assert.equal(taxonomyOptionalEnabled(read({...allowed,[name]:'TRUE'}),name),false,name);
 }
 assert.equal(taxonomyOptionalEnabled(read({...allowed,USKOCI_TAXONOMY_DUAL_GEMINI:'true'}),'USKOCI_TAXONOMY_DUAL_GEMINI'),false);
 assert.equal(taxonomyOptionalEnabled(read({...allowed,USKOCI_TAXONOMY_CUSTOM:'true'}),'USKOCI_TAXONOMY_CUSTOM'),false);
});
test('paid dual Gemini starts only with explicit DEV project, paid budget admission and ON switch',()=>{
 assert.equal(taxonomyDualGeminiEnabled(read(allowed)),true);
 for(const name of ['USKOCI_TAXONOMY_DUAL_GEMINI','USKOCI_TAXONOMY_ROLLOUT_SCOPE',
  'USKOCI_TAXONOMY_ALLOWED_PROJECT_REF','USKOCI_GEMINI_PAID_TEST_ENABLED','SUPABASE_ANON_KEY','SUPABASE_URL']){
  const config={...allowed};delete config[name];
  assert.equal(taxonomyDualGeminiEnabled(read(config)),false,'missing '+name);
 }
 for(const v of ['false','TRUE','1','']){
  assert.equal(taxonomyDualGeminiEnabled(read({...allowed,USKOCI_TAXONOMY_DUAL_GEMINI:v})),false,'flag '+v);
 }
 assert.equal(taxonomyDualGeminiEnabled(read({...allowed,USKOCI_TAXONOMY_ROLLOUT_SCOPE:'PROD'})),false);
 assert.equal(taxonomyDualGeminiEnabled(read({...allowed,USKOCI_TAXONOMY_ALLOWED_PROJECT_REF:'not-verified'})),false);
 assert.equal(taxonomyDualGeminiEnabled(read({...allowed,USKOCI_GEMINI_PAID_TEST_ENABLED:'false'})),false);
});
test('paid dual rejects spoofed host, project, unsafe URL and any non-DEV endpoint',()=>{
 for(const url of ['http://'+ref+'.supabase.co', 'https://otherproject123456789.supabase.co',
  project+'.attacker.invalid',project+'/rpc',project+'/?x=1',project+'/#x',
  'https://name:secret@'+ref+'.supabase.co', 'https://'+ref+'.supabase.co:444',
  'https://db.invalid','https://'+ref.toUpperCase()+'.supabase.co']){
  assert.equal(taxonomyDualGeminiEnabled(read({...allowed,SUPABASE_URL:url})),false,url);
 }
 assert.equal(taxonomyDualGeminiEnabled(read({...allowed,SUPABASE_URL:project+'/'})),true);
});
