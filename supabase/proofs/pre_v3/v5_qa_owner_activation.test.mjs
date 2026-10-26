// Source admission only. Actual compile, rollback and Auth/RPC outcomes belong
// to the separately executed v5_qa_owner_activation_proof.mjs after146.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {readQaPolicyArtifact,renderQaPolicyCandidate} from '../qa_policy_fixture.mjs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8').replaceAll('\r\n','\n');
const source=read('../../migrations/20260913081242_clean_v5_qa_owner_product_activation.sql');
const {artifactBytes,artifact}=readQaPolicyArtifact();
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const embedded=text=>{const found=text.match(/a jsonb:='((?:[^']|'')*)'::jsonb;/);assert.ok(found);return JSON.parse(found[1].replaceAll("''","'"));};
const proof=read('./v5_qa_owner_activation_proof.mjs');
test('147 embeds the same approved five-rule artifact as the inactive candidate renderer, with its exact raw hash',()=>{
 assert.deepEqual(embedded(source),artifact);assert.deepEqual(embedded(renderQaPolicyCandidate()),artifact);
 assert.equal(sha256(artifactBytes),'2cab9bb4d551878a2071fff0fc7fc93383c9db2b370a13db3772b45209ab786a');
 assert.ok(source.includes("artifact_sha text:='"+sha256(artifactBytes)+"'"));
 assert.equal(artifact.policyId,'PRESELECTION_QA_V1');assert.equal(artifact.jurisdiction,'RS');assert.equal(artifact.version,1);
 assert.equal(artifact.activation,'NOT_ACTIVATED');assert.equal(artifact.requiredTaskPolicy,'RS_PUBLICATION_POLICY_MINIMUM');
 assert.deepEqual(artifact.document.rules.map(x=>x.ruleId).sort(),['QA-MATERIAL-CHANGE','QA-PRIVATE-DATA','QA-SAFE-CLARIFICATION','QA-UNCERTAIN','QA-UNSAFE-CONTENT']);
 assert.equal(new Set(artifact.sourceMapping.map(x=>x.ruleId)).size,5);
});
test('147 admits no reviewed candidate, stale effective window, extra metadata, changed document or other active version',()=>{
 const gate=source.slice(source.indexOf('if found then'),source.indexOf('v_bundle_id:=b.id;'));
 for(const condition of ['b.is_active','b.is_reviewed','not b.is_complete','b.reviewed_at is not null','b.activated_at is not null',
  'b.effective_from is not null','b.effective_until is not null','b.review_provenance is distinct from provenance','private.publication_policy_document(b.id) is distinct from doc'])
  assert.ok(gate.includes(condition),condition);
 assert.ok(gate.includes('QA_OWNER_EXISTING_CANDIDATE_DRIFT'));
 assert.match(source,/version<>1 and is_active/);assert.ok(source.includes('QA_OWNER_OTHER_ACTIVE_VERSION'));
 assert.ok(!source.includes('disposable135Fixture'));assert.ok(!source.includes("review_provenance-'"));
 assert.match(source,/r\.rule_provenance=jsonb_build_object\('evaluation',x-'ruleId'/);
 assert.match(source,/where r\.bundle_id=v_bundle_id\)<>5/);
});
test('activation is confined to the existing two policy tables and never expands provider, budget, function or grant authority',()=>{
 const executable=source.replace(/a jsonb:='(?:[^']|'')*'::jsonb;/,'a jsonb:=null;').replace(/^--.*$/gm,'');
 const targets=[...executable.matchAll(/\b(insert\s+into|update|delete\s+from)\s+([a-z_.]+)/gi)].map(x=>[x[1].toLowerCase().replace(/\s+/g,' '),x[2]]);
 assert.deepEqual(targets,[['insert into','private.publication_policy_bundles'],['insert into','private.publication_policy_rule_refs'],['update','private.publication_policy_bundles']]);
 for(const forbidden of [/\bcreate\s+(?:or\s+replace\s+)?function\b/i,/\b(?:create|alter|drop)\s+table\b/i,/\bgrant\s+(?:all|select|execute)\b/i,/\bdelete\s+from\b/i])assert.doesNotMatch(executable,forbidden);
 assert.match(source,/lock table private.publication_policy_bundles,private.publication_policy_rule_refs in share row exclusive mode/);
 assert.match(source,/task_bundle is null or private.publication_policy_document\(task_bundle\) is null/);
 assert.match(source,/source_before is distinct from private.closure_source_digest_v5\(\)/);
 assert.match(source,/budget_before is distinct from\(select to_jsonb\(x\) from private.ai_test_budget_v5 x where singleton\)/);
 for(const role of ['anon','authenticated','service_role'])assert.ok(source.includes("'"+role+"'"));
 assert.ok(source.includes('QA_OWNER_PRIVATE_POLICY_EXPOSED'));
 assert.ok(source.includes("'legal_certification',false"));assert.ok(source.includes('AF-D26 canonical DEV/ALPHA backend promotion'));
});
test('rolled-back branch tests preserve the entire migration body except its exact outer transaction',()=>{
 assert.equal(source.match(/^begin;$/gm)?.length,1);assert.equal(source.match(/^commit;$/gm)?.length,1);
 const body=source.replace(/^begin;\n/m,'').replace(/\ncommit;\s*$/,'\n');
 assert.ok(body.includes('do $activate$'));assert.ok(body.includes('end $activate$;'));
 assert.equal(body,source.slice(0,source.indexOf('\nbegin;')+1)+source.slice(source.indexOf('\nbegin;')+8,source.lastIndexOf('\ncommit;'))+'\n');
 assert.match(proof,/assert\.deepEqual\(before\.review_provenance,\{\.\.\.prepared,disposable135Fixture:true\}\)/);
 assert.match(proof,/assert\.deepEqual\(refs\(id\),expectedRefs\)/);
 assert.match(proof,/review_provenance=review_provenance-'disposable135Fixture'/);
 assert.match(proof,/assert\.notEqual\(freshResult\.id,id\)/);assert.match(proof,/historyBefore.length,146/);
 for(const code of ['QA_OWNER_EXISTING_CANDIDATE_DRIFT','QA_OWNER_RULE_CONTENT_DRIFT','QA_OWNER_OTHER_ACTIVE_VERSION','QA_OWNER_TASK_POLICY_NOT_READY','QA_OWNER_PRIVATE_POLICY_EXPOSED'])assert.ok(proof.includes(code));
 // The146 closure seal hashes every private/public table ACL, so the grant drift is refused by the seal guard first.
 assert.ok(proof.includes("report.privatePolicyGrantDeniedBy=sealSeesGrant?'QA_OWNER_SOURCE_NOT_READY':'QA_OWNER_PRIVATE_POLICY_EXPOSED'"));
 assert.equal([...proof.matchAll(/await apply\(report,file,146\)/g)].length,1);
});
test('actual147 proof uses current remote geography and canonical worker activation with no provider, dispatch or budget-reset path',()=>{
 assert.match(proof,/rpc_complete_worker_profile/);assert.match(proof,/select profile_status from public.app_profiles/);
 assert.match(proof,/'REMOTE','RS'/);assert.match(proof,/uskoci.need_region','CONFIRMED_REVIEW'/);
 for(const rpc of ['rpc_read_preselection_qa_context','rpc_claim_qa_classification_service','rpc_read_qa_classification','rpc_cancel_qa_classification'])assert.ok(proof.includes(rpc));
 assert.match(proof,/commandBefore\[0\].provider_dispatched,false/);assert.match(proof,/commandAfter\[0\].provider_dispatched,false/);
 assert.match(proof,/terminal.claim,null/);assert.match(proof,/terminal.status,cancelled/);
 for(const forbidden of ['rpc_dispatch_qa_classification_service','rpc_complete_qa_classification_service','rpc_ai_test_budget_reserve_service',
  'update private.ai_test_budget','insert into private.ai_test_accounts','fetch(','loadQaClassifierHandler','rpc_submit_classified_preselection_qa'])assert.ok(!proof.includes(forbidden),forbidden);
 assert.match(proof,/assert.deepEqual\(functions\(\),preserved.functions\)/);
 assert.match(proof,/assert.deepEqual\(nonQa\(\),preserved.nonQa\)/);
 assert.match(proof,/assert.deepEqual\(budget\(\),preserved.budget\)/);
});
