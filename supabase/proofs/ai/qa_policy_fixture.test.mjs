import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseQaPolicyArtifact,readQaPolicyArtifact,renderQaPolicyCandidate,QA_POLICY_ARTIFACT_SHA256} from '../qa_policy_fixture.mjs';

const source=readFileSync(new URL('../../migrations/20260913081242_clean_v5_qa_owner_product_activation.sql',import.meta.url),'utf8');
const replaceArtifact=mutate=>source.replace(/a jsonb:='((?:[^']|'')*)'::jsonb;/,(_match,json)=>{
 const artifact=JSON.parse(json.replaceAll("''","'"));mutate(artifact);
 return "a jsonb:='"+JSON.stringify(artifact).replaceAll("'","''")+"'::jsonb;";
});

test('retained migration reconstructs the exact approved historical policy bytes without legacy docs',()=>{
 const {artifact,artifactBytes,artifactSha256}=readQaPolicyArtifact();
 assert.equal(artifactBytes.length,4771);
 assert.equal(createHash('sha256').update(artifactBytes).digest('hex'),QA_POLICY_ARTIFACT_SHA256);
 assert.equal(artifactSha256,QA_POLICY_ARTIFACT_SHA256);
 assert.deepEqual(JSON.parse(artifactBytes),artifact);
 assert.deepEqual(parseQaPolicyArtifact(source),readQaPolicyArtifact());
});

for(const [label,mutate] of [
 ['policy identity',a=>a.policyId='OTHER_POLICY'],
 ['version',a=>a.version=2],
 ['activation',a=>a.activation='ACTIVATED'],
 ['required task policy',a=>a.requiredTaskPolicy='OTHER_POLICY'],
 ['schema',a=>a.document.schemaVersion='OTHER_SCHEMA'],
 ['rule content',a=>a.document.rules[0].instructions='Unapproved changed instructions'],
 ['source mapping',a=>a.sourceMapping[0].ruleId=a.sourceMapping[1].ruleId],
])test(`policy fixture rejects ${label} drift`,()=>{
 assert.throws(()=>parseQaPolicyArtifact(replaceArtifact(mutate)));
});

test('policy fixture rejects missing/duplicate artifact and changed/missing approved hash',()=>{
 const embedded=source.match(/a jsonb:='((?:[^']|'')*)'::jsonb;/)[0];
 for(const text of [source.replace(embedded,''),source+'\n'+embedded,
  source.replace(QA_POLICY_ARTIFACT_SHA256,'0'.repeat(64)),
  source.replace(/artifact_sha text:='[a-f0-9]{64}'/,'artifact_sha text:=null')]){
  assert.throws(()=>parseQaPolicyArtifact(text));
 }
});

test('proof-only renderer preserves exact historical inactive, unreviewed candidate output',()=>{
 const sql=renderQaPolicyCandidate();
 // Independently byte-compared against the former renderer at20dc6c55^.
 assert.equal(Buffer.byteLength(sql),6006);
 assert.equal(createHash('sha256').update(sql).digest('hex'),'13c61e82e95c9656d487b3552a6c836850d7c5b24710ed986b88c462cb636bba');
 assert.match(sql,/values\('PRESELECTION_QA_V1',1,'RS',false,true,false,provenance\)/);
 assert.match(sql,/QA_CANDIDATE_MUST_REMAIN_INACTIVE/);
 assert.match(sql,/PREPARED_AWAITING_REVIEW/);
 assert.deepEqual(JSON.parse(sql.match(/a jsonb:='((?:[^']|'')*)'::jsonb;/)[1].replaceAll("''","'")),readQaPolicyArtifact().artifact);
});
