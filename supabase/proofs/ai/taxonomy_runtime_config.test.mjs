// Production-safe, React-free, provider-free config admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import {taxonomyIntakeEnabled} from '../../functions/_shared/taxonomyRuntimeConfig.mjs';
const ref='leqcwgzvjsxugfgzdmth';
const project='https://'+ref+'.supabase.co';
const allowed={SUPABASE_URL:project,SUPABASE_ANON_KEY:'SYNTHETIC_PUBLIC',
  USKOCI_TAXONOMY_ROLLOUT_SCOPE:'DEV',USKOCI_TAXONOMY_ALLOWED_PROJECT_REF:ref,
  USKOCI_GEMINI_PAID_TEST_ENABLED:'true',USKOCI_TAXONOMY_DUAL_GEMINI:'true'};
const read=(value)=>key=>value[key];
test('retired strategy flags cannot enable intake or override its explicit switch',()=>{
 const retired=['USKOCI_TAXONOMY_DIRECT_REPLY','USKOCI_TAXONOMY_UNIFIED_SHADOW','USKOCI_TAXONOMY_SHADOW_CAPTURE'];
 for(const name of retired)for(const value of [undefined,'false','true','TRUE']){
  assert.equal(taxonomyIntakeEnabled(read({...allowed,[name]:value})),true,name);
  for(const gate of [undefined,'false'])
   assert.equal(taxonomyIntakeEnabled(read({...allowed,[name]:value,USKOCI_TAXONOMY_DUAL_GEMINI:gate})),false,name);
 }
 const all=Object.fromEntries(retired.map(name=>[name,'true']));
 assert.equal(taxonomyIntakeEnabled(read(all)),false);
 for(const get of [null,undefined,{},true])assert.equal(taxonomyIntakeEnabled(get),false);
});
test('single-pass intake starts only with explicit DEV project, paid budget admission and ON switch',()=>{
 assert.equal(taxonomyIntakeEnabled(read(allowed)),true);
 for(const name of ['USKOCI_TAXONOMY_DUAL_GEMINI','USKOCI_TAXONOMY_ROLLOUT_SCOPE',
  'USKOCI_TAXONOMY_ALLOWED_PROJECT_REF','USKOCI_GEMINI_PAID_TEST_ENABLED','SUPABASE_ANON_KEY','SUPABASE_URL']){
  const config={...allowed};delete config[name];
  assert.equal(taxonomyIntakeEnabled(read(config)),false,'missing '+name);
 }
 for(const v of ['false','TRUE','1','']){
  assert.equal(taxonomyIntakeEnabled(read({...allowed,USKOCI_TAXONOMY_DUAL_GEMINI:v})),false,'flag '+v);
 }
 assert.equal(taxonomyIntakeEnabled(read({...allowed,USKOCI_TAXONOMY_ROLLOUT_SCOPE:'PROD'})),false);
 assert.equal(taxonomyIntakeEnabled(read({...allowed,USKOCI_TAXONOMY_ALLOWED_PROJECT_REF:'not-verified'})),false);
 assert.equal(taxonomyIntakeEnabled(read({...allowed,USKOCI_GEMINI_PAID_TEST_ENABLED:'false'})),false);
});
test('single-pass admission rejects spoofed host, project, unsafe URL and any non-DEV endpoint',()=>{
 for(const url of ['http://'+ref+'.supabase.co', 'https://otherproject123456789.supabase.co',
  project+'.attacker.invalid',project+'/rpc',project+'/?x=1',project+'/#x',
  'https://name:secret@'+ref+'.supabase.co', 'https://'+ref+'.supabase.co:444',
  'https://db.invalid']){
  assert.equal(taxonomyIntakeEnabled(read({...allowed,SUPABASE_URL:url})),false,url);
 }
 assert.equal(taxonomyIntakeEnabled(read({...allowed,SUPABASE_URL:project+'/'})),true);
});
