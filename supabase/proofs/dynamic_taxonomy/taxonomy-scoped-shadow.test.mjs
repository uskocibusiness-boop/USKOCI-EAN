import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scopedNeedPreviewArgs,scopedNeedPreviewSafeAction} from '../../functions/_shared/taxonomyScopedShadow.mjs';
const edge=readFileSync('supabase/functions/uskoci-ai-interview/index.ts','utf8');
const fields=(key,value)=>({key,value});
const active=(key,value,status='CONFIRMED')=>({fact_key:key,fact_value:value,status});

test('remote job suggested in the same V2 turn never infers geographic pin',()=>{
  const res=scopedNeedPreviewArgs([],[fields('need.category','Izrada logotipa'),fields('need.task_geography',{mode:'REMOTE'}),fields('need.description','Izrada digitalnog logotipa')]);
  assert.equal(res?.p_execution_location_mode,'REMOTE');
  assert.equal(res?.p_ai_category,'Izrada logotipa');
  assert.equal(res?.p_public_description,'Izrada digitalnog logotipa');
  assert.equal(res?.p_explicit_required_skills,null);
  assert.deepEqual(Object.keys(res).sort(),['p_ai_category','p_execution_location_mode','p_explicit_required_skills','p_public_description'].sort());
});
test('ON_SITE work with saved location and explicit requirements retains its actual mode',()=>{
  const res=scopedNeedPreviewArgs([active('need.category','Krečenje zidova'),active('need.task_geography',{mode:'STATIONARY',start:{city:'Novi Sad'}}),active('need.required_skills',['Iskustvo u krečenju'])],
    [fields('need.description','Soba u stanu')]);
  assert.equal(res?.p_execution_location_mode,'STATIONARY');
  assert.deepEqual(res?.p_explicit_required_skills,['Iskustvo u krečenju']);
});
test('do not classify based on mere skill label or absent execution mode',()=>{
  assert.equal(scopedNeedPreviewArgs([],[fields('need.category','Onlajn časovi')]),null);
  assert.equal(scopedNeedPreviewArgs([active('need.category','Onlajn časovi')],[]),null);
  assert.equal(scopedNeedPreviewArgs([active('need.category','Onlajn časovi')],[fields('need.task_geography',{mode:'UNSUPPORTED'})]),null);
  assert.equal(scopedNeedPreviewArgs([active('need.task_geography',{mode:'REMOTE'})],[fields('need.category','  ')]),null);
});
test('unknown old facts cannot override fresh proposals and matching controls remain null until stated',()=>{
 const res=scopedNeedPreviewArgs([active('need.category','Star posao'),active('need.task_geography',{mode:'STATIONARY'},'UNKNOWN')],
 [fields('need.category','Dresiranje pasa'),fields('need.task_geography',{mode:'REMOTE'})]);
 assert.equal(res?.p_ai_category,'Dresiranje pasa');
 assert.equal(res?.p_execution_location_mode,'REMOTE');
});
test('close taxonomy actions and refuse all notification or classification authority',()=>{
 assert.equal(scopedNeedPreviewSafeAction({action:'NOVEL_SERVICE_REVIEW',classificationAuthority:'NONE',notificationAuthority:'NONE'}),'NOVEL_SERVICE_REVIEW');
 assert.equal(scopedNeedPreviewSafeAction({action:'SUGGEST_EXISTING_SERVICE',classificationAuthority:'NONE',notificationAuthority:'NONE'}),'SUGGEST_EXISTING_SERVICE');
 assert.equal(scopedNeedPreviewSafeAction({action:'ALLOW_PUSH',classificationAuthority:'OWNER',notificationAuthority:'SEND'}),'NOT_AUTHORITATIVE');
 assert.equal(scopedNeedPreviewSafeAction({action:'UNKNOWN',classificationAuthority:'NONE',notificationAuthority:'NONE'}),'OTHER_REVIEW');
});
test('live Edge invokes service-only RPC but never uses shadow result as matcher or publication input',()=>{
 assert.match(edge,/await rpc\('rpc_taxonomy_ai_scoped_preview_service', taxonomyArgs, signal, 2200\)/);
 assert.match(edge,/const taxonomyArgs = scopedNeedPreviewArgs\(activeFacts, aiTurn\.proposals\)/);
 assert.match(edge,/TAXONOMY_SCOPED_SHADOW/);
 assert.match(edge,/await rpc\(locationContext \? 'rpc_ai_complete_need_location_turn_v1_service' : 'rpc_ai_complete_need_turn_v2_service'/);
 assert.doesNotMatch(edge,/p_taxonomy_category_id:/);
});