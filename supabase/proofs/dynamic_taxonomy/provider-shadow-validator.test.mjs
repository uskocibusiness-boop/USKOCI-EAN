import test from 'node:test';
import assert from 'node:assert/strict';
import { assertProviderClassificationShadow as verify } from './providerShadowValidator.mjs';

for (const purpose of ['need','worker']) {
  test(purpose+' requires the existing provider shadow field even when facts/patch look valid',()=>{
    const envelope={assistantMessage:'OK',safety:'ALLOW',facts:[],patch:{},dialogue:{next:'ACK'}};
    assert.throws(()=>verify(purpose,envelope),new RegExp(purpose.toUpperCase()+'_SHADOW_JSON_MISSING'));
    assert.throws(()=>verify(purpose,{...envelope,classificationShadowJson:undefined}),
      new RegExp(purpose.toUpperCase()+'_SHADOW_JSON_INVALID'));
    assert.throws(()=>verify(purpose,{...envelope,classificationShadowJson:null}),
      new RegExp(purpose.toUpperCase()+'_SHADOW_JSON_INVALID'));
    assert.deepEqual(verify(purpose,{...envelope,classificationShadowJson:'[]'}),[]);
  });
  test(purpose+' fails closed on non-array, invalid JSON, oversized or invalid members',()=>{
    for(const value of ['{','null','{}','"[]"','[null]','[5]',JSON.stringify([{}].concat(
      Array.from({length:purpose==='worker'?24:6},()=>({})))),'['+' '.repeat(24577)+']']){
      assert.throws(()=>verify(purpose,{classificationShadowJson:value}),
        new RegExp(purpose.toUpperCase()+'_SHADOW_JSON_INVALID'));
    }
    const valid={service:'3D printovanje',mode:'REMOTE',action:'NEEDS_REVIEW',categoryId:'',parentId:'',
      proposedPath:[],reason:'This exact work still needs a classification review.',catalogVersion:9};
    assert.deepEqual(verify(purpose,{classificationShadowJson:JSON.stringify([valid])}),[valid]);
    for(const item of [{...valid,mode:'BOTH'},{...valid,reason:'x'}, {...valid,unknown:'private'},
      {...valid,categoryId:'22222222-2222-4222-8222-222222222222'},
      {...valid,proposedPath:['Not accepted']}]) {
      assert.throws(()=>verify(purpose,{classificationShadowJson:JSON.stringify([item])}),
        new RegExp(purpose.toUpperCase()+'_SHADOW_JSON_INVALID'));
    }
  });
}
