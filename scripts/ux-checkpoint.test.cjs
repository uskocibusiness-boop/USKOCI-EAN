'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {insertCheckpoint,buildCheckpoint,recordCheckpoint,verifySourceForBuild}=require('./record-ux-checkpoint.cjs');
const env={GITHUB_REPOSITORY:'uskocibusiness-boop/USKOCI-EAN',GITHUB_REF:'refs/heads/work/uskoci-cist-proizvod-20261104',GITHUB_EVENT_NAME:'push',GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'123',GITHUB_RUN_NUMBER:'49',UX_CI_TESTS:'761',UX_APK_ARTIFACT:'456'};
const proof={schema:'USKOCI_UX_IMPLEMENTATION_20261107',sourceBase:'f9e13ed5020a786ba6e0963dfd5de87eba3e3245',expectedPlanBlob:'8850410ea6b41eb024955acf1153bb8c031f536f',minimumExpectedActiveTests:756,findings:[],sourceFileSha256:{}};
test('checkpoint preserves every previous master byte after its title and blank separator',()=>{const old='# USKOČI — naslov\n\nStara istorija\n\nĆirilica Љ\n';const out=insertCheckpoint(old,'NOVO');assert.ok(out.endsWith('Stara istorija\n\nĆirilica Љ\n'));assert.equal(out.split('NOVO').length,2);assert.throws(()=>insertCheckpoint(out,'OPET'),/MASTER_SHAPE/);});
test('checkpoint rejects a different repository, branch, source shape or missing evidence',()=>{for(const change of [{GITHUB_REPOSITORY:'other/repo'},{GITHUB_REF:'refs/heads/main'},{GITHUB_SHA:'bad'},{UX_CI_TESTS:'5'},{UX_APK_ARTIFACT:''}])assert.throws(()=>buildCheckpoint(proof,{...env,...change}),/CHECKPOINT_/);});
test('checkpoint CI receipt explicitly excludes native, DEV deploy and independent APK audit',()=>{const r=buildCheckpoint(proof,env);assert.equal(r.receipt.native,false);assert.equal(r.receipt.devDeploy,false);assert.equal(r.receipt.independentlyDownloadedApk,false);assert.equal(r.receipt.tests,761);assert.match(r.body,/UX03 potpun/);});
test('checkpoint never writes if another commit already moved the branch',async()=>{const calls=[];const result=await recordCheckpoint({env,readFile:()=>Buffer.from(JSON.stringify(proof)),api:async(method,p)=>{calls.push([method,p]);return{object:{sha:'b'.repeat(40)}}}});assert.equal(result.status,'SKIPPED_BRANCH_MOVED');assert.deepEqual(calls.map(c=>c[0]),['GET']);});
test('checkpoint never overwrites a separately changed master',async()=>{const calls=[];const result=await recordCheckpoint({env,readFile:()=>Buffer.from(JSON.stringify(proof)),api:async(method,p)=>{calls.push([method,p]);return p.includes('/git/ref/')?{object:{sha:env.GITHUB_SHA}}:p.includes('/git/commits/')?{tree:{sha:'c'.repeat(40)}}:{sha:'d'.repeat(40)}}});assert.equal(result.status,'SKIPPED_MASTER_CHANGED');assert.equal(calls.every(c=>c[0]==='GET'),true);});
function recordedFixture(){
 const prepared=buildCheckpoint(proof,env);
 const plan=insertCheckpoint('# USKOČI — naslov\n\nStari plan\n',prepared.body);
 const files={'docs/plan/CODEX_PLAN_RADA.md':plan,'docs/plan/proofs/ux-fixes-ci-20261107.json':JSON.stringify(prepared.receipt),
  'docs/plan/proofs/ux-fixes-20261107.json':JSON.stringify(proof)};
 return {files,receipt:prepared.receipt,readFile:p=>{assert.ok(p in files,p);return Buffer.from(files[p]);}};
}
test('a recorded historical checkpoint permits later source while keeping the original evidence',()=>{
 const f=recordedFixture(),before=JSON.stringify(f.files);
 assert.equal(verifySourceForBuild({...proof,sourceFileSha256:{'src/later.ts':'old-historical-hash'}},f.readFile),'HISTORICAL_CHECKPOINT_ALREADY_RECORDED');
 assert.equal(JSON.stringify(f.files),before,'does not rewrite historical hashes or CI evidence');
});
test('an unrecorded checkpoint still refuses changed source',()=>{
 assert.throws(()=>verifySourceForBuild({...proof,sourceFileSha256:{'src/later.ts':'old-hash'}},p=>Buffer.from(p.endsWith('.md')?'# USKOČI — plan\n':'changed')),/CHECKPOINT_SOURCE_DIGEST/);
});
test('a marker without matching source/run/test evidence never bypasses verification',()=>{
 for(const change of [{source:'b'.repeat(40)},{run:999},{tests:999},{native:true},{artifact:0},{proof:'other.json'}]){
  const f=recordedFixture();f.files['docs/plan/proofs/ux-fixes-ci-20261107.json']=JSON.stringify({...f.receipt,...change});
  assert.throws(()=>verifySourceForBuild(proof,f.readFile),/CHECKPOINT_RECORDED_EVIDENCE_INVALID/);
 }
 const f=recordedFixture();delete f.files['docs/plan/proofs/ux-fixes-ci-20261107.json'];
 assert.throws(()=>verifySourceForBuild(proof,f.readFile));
});
test('a later passing build cannot overwrite or relabel the completed historical checkpoint',async()=>{
 const f=recordedFixture();let calls=0;
 const result=await recordCheckpoint({env:{...env,GITHUB_SHA:'b'.repeat(40)},readFile:f.readFile,api:async()=>{calls++;throw Error('unexpected write');}});
 assert.equal(result.status,'SKIPPED_ALREADY_RECORDED');assert.equal(calls,0);
 assert.equal(JSON.parse(f.files['docs/plan/proofs/ux-fixes-ci-20261107.json']).source,env.GITHUB_SHA);
});
