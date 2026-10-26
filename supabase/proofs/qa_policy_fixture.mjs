// Proof-only policy fixture. The retained migration is the sole content source;
// importing this module does not execute SQL or contact a database/provider.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const QA_POLICY_ARTIFACT_SHA256='2cab9bb4d551878a2071fff0fc7fc93383c9db2b370a13db3772b45209ab786a';
const migration=new URL('../migrations/20260913081242_clean_v5_qa_owner_product_activation.sql',import.meta.url);
const ruleIds=['QA-MATERIAL-CHANGE','QA-PRIVATE-DATA','QA-SAFE-CLARIFICATION','QA-UNCERTAIN','QA-UNSAFE-CONTENT'];

export function parseQaPolicyArtifact(source){
 const embedded=[...source.matchAll(/\ba jsonb:='((?:[^']|'')*)'::jsonb;/g)];
 const hashes=[...source.matchAll(/\bartifact_sha text:='([a-f0-9]{64})'/g)];
 assert.equal(embedded.length,1,'QA_POLICY_SINGLE_ARTIFACT_REQUIRED');
 assert.equal(hashes.length,1,'QA_POLICY_SINGLE_HASH_REQUIRED');
 assert.equal(hashes[0][1],QA_POLICY_ARTIFACT_SHA256,'QA_POLICY_APPROVED_HASH_REQUIRED');
 const artifact=JSON.parse(embedded[0][1].replaceAll("''","'"));
 assert.equal(artifact.policyId,'PRESELECTION_QA_V1');
 assert.equal(artifact.jurisdiction,'RS');
 assert.equal(artifact.version,1);
 assert.equal(artifact.activation,'NOT_ACTIVATED');
 assert.equal(artifact.requiredTaskPolicy,'RS_PUBLICATION_POLICY_MINIMUM');
 assert.equal(artifact.document.schemaVersion,'USKOCI_PUBLICATION_POLICY_V1');
 assert.deepEqual(artifact.document.rules.map(rule=>rule.ruleId).sort(),ruleIds);
 assert.deepEqual(artifact.sourceMapping.map(rule=>rule.ruleId).sort(),ruleIds);
 // This exact serialization was byte-compared with the historical approved
 // artifact (20dc6c55^); the pinned hash guards all content, not just rule IDs.
 const artifactBytes=Buffer.from(JSON.stringify(artifact,null,2)+'\n','utf8');
 const artifactSha256=createHash('sha256').update(artifactBytes).digest('hex');
 assert.equal(artifactSha256,QA_POLICY_ARTIFACT_SHA256,'QA_POLICY_CONTENT_DRIFT');
 return {artifact,artifactBytes,artifactSha256};
}

export function readQaPolicyArtifact(){
 return parseQaPolicyArtifact(readFileSync(migration,'utf8'));
}

// Retained historical proof renderer: returns only an inactive, unreviewed
// candidate string. There is deliberately no CLI, connection or SQL execution.
export function renderQaPolicyCandidate(){
 const {artifact:a,artifactSha256:hash}=readQaPolicyArtifact();
 const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
 return `-- Prepared Q&A policy candidate SHA256 ${hash}.
-- REVIEW REQUIRED: this creates no active or reviewed production authority.
begin;
do $candidate$
declare a jsonb:=${literal(a)};b uuid;item jsonb;doc jsonb;provenance jsonb;
begin
 if exists(select 1 from private.publication_policy_bundles where policy_id='PRESELECTION_QA_V1' and jurisdiction='RS' and version=1) then raise exception 'QA_POLICY_CANDIDATE_EXISTS';end if;
 provenance:=jsonb_build_object('candidateArtifactSha256','${hash}','sourceMapping',a->'sourceMapping','processingAuthority',a->>'processingAuthority','numericAuthority',a->>'numericAuthority','reviewState','PREPARED_AWAITING_REVIEW','evaluatorPolicy',(a->'document')-'rules');
 insert into private.publication_policy_bundles(policy_id,version,jurisdiction,is_reviewed,is_complete,is_active,review_provenance)
 values('PRESELECTION_QA_V1',1,'RS',false,true,false,provenance) returning id into b;
 for item in select value from jsonb_array_elements(a#>'{document,rules}') loop
  insert into private.publication_policy_rule_refs(bundle_id,rule_id,rule_provenance) values(b,item->>'ruleId',jsonb_build_object('evaluation',item-'ruleId','sourceMapping',(select x from jsonb_array_elements(a->'sourceMapping')x where x->>'ruleId'=item->>'ruleId')));
 end loop;
 select ((a->'document')-'rules')||jsonb_build_object('rules',jsonb_agg(value order by value->>'ruleId')) into doc from jsonb_array_elements(a#>'{document,rules}');
 update private.publication_policy_bundles set review_provenance=provenance||jsonb_build_object('evaluatorContentSha256',encode(extensions.digest(convert_to(doc::text,'UTF8'),'sha256'),'hex')) where id=b;
 if private.publication_policy_document(b) is distinct from doc then raise exception 'QA_EXECUTABLE_DOCUMENT_INVALID';end if;
 if private.publication_policy_bundle_ready(b,'RS',statement_timestamp()) then raise exception 'QA_CANDIDATE_MUST_REMAIN_INACTIVE';end if;
end $candidate$;
commit;
`;
}
