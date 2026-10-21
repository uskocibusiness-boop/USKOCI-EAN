/** DEV ONLY. Creates exactly one new disposable account, then closes only it.
 * No global maintenance, policy edits, source admission, real account deletion,
 * provider call, or service credential logging. Main agent runs after final gate.
 */
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url=process.env.USKOCI_CLOSURE_PROOF_URL;
assert.equal(url,'https://leqcwgzvjsxugfgzdmth.supabase.co','DEV_PROJECT_REQUIRED');
assert.equal(process.env.USKOCI_CLOSURE_PROOF_APPROVED,'NEW_DISPOSABLE_ACCOUNT_ONLY');
const anon=process.env.USKOCI_CLOSURE_PROOF_ANON;
const secret=process.env.USKOCI_CLOSURE_PROOF_SERVICE;
assert.ok(anon&&secret,'SCOPED_ENV_KEYS_REQUIRED');
const reportPath=process.env.USKOCI_CLOSURE_PROOF_REPORT;
assert.ok(reportPath,'REPORT_PATH_REQUIRED');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const service=createClient(url,secret,options), user=createClient(url,anon,options);
const report={scope:'ONE_NEW_DISPOSABLE_DEV_ACCOUNT',startedAt:new Date().toISOString(),checks:[],complete:false};
const save=()=>writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
const ok=async promise=>{const result=await promise;if(result.error)throw new Error(result.error.code??'API_ERROR');return result.data;};
const pass=name=>{report.checks.push(name);save();};
const runId=randomUUID();const email=`closure-proof-${runId}@proof.invalid`;
const password=randomBytes(32).toString('base64url');
save();
try{
 // Admin create is always a NEW random email. There is no account ID input.
 const created=await ok(service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{qa:'closure-current-20261021'}}));
 const accountId=created.user?.id;assert.match(accountId,/^[0-9a-f-]{36}$/);
 report.accountId=accountId;report.fixtureEmail=email;save();
 const signed=await ok(user.auth.signInWithPassword({email,password}));assert.equal(signed.user.id,accountId);
 const oldSession=signed.session;assert.ok(oldSession?.access_token);pass('NEW_DISPOSABLE_AUTH_SESSION');
 // Valid tiny JPEG fixture; no real user image.
 const path=`${accountId}/closure-proof-${runId}.jpg`;
 await ok(service.storage.from('profile-media').upload(path,new Uint8Array([255,216,255,217]),{contentType:'image/jpeg',upsert:false}));
 report.objectPath=path;save();
 await ok(service.storage.from('profile-media').download(path));pass('ACTUAL_STORAGE_CREATED_READ_BACK');
 await ok(user.rpc('rpc_prepare_account_closure',{p_expected_user_id:accountId,p_expected_revision:0,p_client_request_id:randomUUID()}));
 const review=await ok(user.rpc('rpc_review_account_closure_execution',{p_expected_user_id:accountId}));
 assert.equal(review.accountId,accountId);assert.equal(review.ready,true,'FINAL_SOURCE_NOT_ADMITTED');
 assert.equal(review.adapterVersion,'OWNER_AF_D22_EVENT_ERASURE_V1');
 const key=randomUUID();report.clientRequestId=key;save();
 const args={p_expected_user_id:accountId,p_request_id:review.requestId,p_expected_revision:review.revision,p_client_request_id:key,p_policy_sha256:review.policySha256};
 const started=await ok(user.rpc('rpc_start_account_closure_execution',args));
 const generation=started.generation;assert.equal(started.accountId,accountId);assert.match(generation,/^[0-9a-f-]{36}$/);
 report.generation=generation;save();
 const replay=await ok(user.rpc('rpc_start_account_closure_execution',args));assert.equal(replay.generation,generation);assert.equal(replay.idempotentReplay,true);pass('REAL_OWNED_START_AND_REPLAY');
 const endpoint=url+'/functions/v1/uskoci-account-closure-worker';
 const invoke=async()=>{
  const response=await fetch(endpoint,{method:'POST',headers:{apikey:secret,'Content-Type':'application/json'},body:JSON.stringify({accountId,generation}),signal:AbortSignal.timeout(65000)});
  const body=await response.json();assert.equal(response.ok,true,body.code??'EDGE_HTTP_FAILED');
  assert.notEqual(body.kind,'DISABLED','EDGE_WORKER_DISABLED');
  assert.equal(body.accountId,accountId,'EDGE_FOREIGN_ACCOUNT');
  assert.equal(body.generation,generation,'EDGE_FOREIGN_GENERATION');
  return body;
 };
 let closed;
 for(let step=0;step<140;step++){
  const value=await invoke();report.edgeSteps=step+1;
  if(value.state==='CLOSED'){closed=value;break;}
  assert.ok(['STEP_VERIFIED','RELATIONAL_PROGRESS'].includes(value.kind),'UNSETTLED_EDGE_OUTCOME');
  save();
 }
 assert.equal(closed?.state,'CLOSED','EDGE_DID_NOT_CLOSE');
 assert.equal(closed.relationalOutcome,'ORDINARY_PERSONAL_CONTENT_ERASED');
 assert.equal(closed.authOutcome,'AUTH_IDENTITY_ERASED_SUBJECT_RETAINED');
 assert.equal(closed.mediaOutcome,'OWNED_OBJECTS_DELETED');
 assert.equal(closed.pseudonymousAuditRetained,true);assert.deepEqual(closed.exceptions,[]);pass('REAL_EDGE_ORDINARY_ERASURE_CLOSED');
 const missing=await service.storage.from('profile-media').download(path);assert.ok(missing.error,'STORAGE_STILL_PRESENT');
 const identity=await ok(service.auth.admin.getUserById(accountId));assert.equal(identity.user.id,accountId);assert.ok(identity.user.deleted_at);assert.deepEqual(identity.user.user_metadata,{});assert.deepEqual(identity.user.app_metadata,{});
 pass('ACTUAL_STORAGE_ABSENT_AUTH_SOFT_ERASED');
 const refresh=await createClient(url,anon,options).auth.refreshSession({refresh_token:oldSession.refresh_token});assert.ok(refresh.error,'OLD_REFRESH_STILL_VALID');
 const replayClosed=await invoke();assert.deepEqual(replayClosed,closed);pass('REFRESH_REVOKED_CLOSED_REPLAY');
 report.complete=true;report.finishedAt=new Date().toISOString();save();
 console.log(JSON.stringify({complete:true,accountId,generation,checks:report.checks,edgeSteps:report.edgeSteps}));
}catch(error){
 report.failure=error instanceof Error?error.message:'UNKNOWN';report.finishedAt=new Date().toISOString();save();
 // Retain exact fixture IDs for narrowly scoped diagnosis/retry. Never silently
 // hard-delete or sweep accounts to make a failed proof appear successful.
 console.error(JSON.stringify({complete:false,accountId:report.accountId??null,generation:report.generation??null,failure:report.failure}));
 process.exitCode=1;
}
