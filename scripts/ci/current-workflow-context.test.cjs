'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const yaml=require('yaml');
const root=path.resolve(__dirname,'../..');
// GitHub context availability: jobs.<job_id>.env has no runner context.
// https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability
function validateJobEnvironment(workflow){
 for(const [name,job] of Object.entries(workflow.jobs??{})){
  for(const [key,value] of Object.entries(job.env??{})){
   for(const expression of String(value).matchAll(/\$\{\{([\s\S]*?)\}\}/g))
    assert.doesNotMatch(expression[1],/\brunner\s*\./,`${name}.env.${key}: runner context is unavailable before scheduling`);
  }
 }
}
test('active APK and bounded Home workflows avoid runner expressions in job-level env',()=>{
 const baseline=JSON.parse(fs.readFileSync(path.join(root,'docs/current/CURRENT_BASELINE_20261018.json'),'utf8'));
 for(const file of [baseline.activeOwners.integratedApkBuild,'.github/workflows/pkg042-home-read-parity-proof.yml']){
  const parsed=yaml.parse(fs.readFileSync(path.join(root,file),'utf8'));
  assert.ok(parsed.on&&parsed.jobs,`Invalid workflow ${file}`);
  validateJobEnvironment(parsed);
 }
});
test('the real invalid runner.temp mutant is refused, while step-local shell variables need no context',()=>{
 assert.throws(()=>validateJobEnvironment({jobs:{probe:{env:{PGLITE_MODULE:'${{ runner.temp }}/proof'}}}}),/runner context is unavailable/);
 assert.doesNotThrow(()=>validateJobEnvironment({jobs:{probe:{env:{CI:'1'},steps:[{run:'PGLITE_MODULE="$RUNNER_TEMP/proof" node --test'}]}}}));
});
