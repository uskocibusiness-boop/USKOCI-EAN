import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../candidates/dynamic-taxonomy-20261011/need-review-signed-classification-v1.sql',import.meta.url),'utf8');
const client=readFileSync(new URL('../../../src/data/aiTaskReviewClientService.ts',import.meta.url),'utf8');
test('Need review signs classification before its existing digest',()=>{
 const projection=sql.indexOf('v_projection:=private.taxonomy_review_exact_projection_v1(');
 const signed=sql.indexOf("envelope:=envelope||jsonb_build_object('classificationState'");
 const digest=sql.indexOf("envelope:=envelope||jsonb_build_object('displayedContentDigest'");
 assert.ok(projection>=0&&signed>projection&&digest>signed);
 assert.ok(sql.includes("v_scope:=location#>>'{geography,mode}'"));
});
test('client requires signed service and mode to equal what user sees',()=>{
 assert.ok(client.includes('candidate.service !== category?.value'));
 assert.ok(client.includes('candidate.mode !== mode'));
 assert.ok(client.includes('candidate.catalogVersion !== r.classificationCatalogVersion'));
});

const versionedSql=readFileSync(new URL('../../candidates/dynamic-taxonomy-20261011/need-review-versioned-optin-dev-20261016.sql',import.meta.url),'utf8');
test('versioned DEV Need taxonomy review is additive, authenticated-only and legacy-default',()=>{
 assert.match(versionedSql,/CREATE OR REPLACE FUNCTION public\.rpc_prepare_ai_task_review_taxonomy\(/);
 assert.doesNotMatch(versionedSql,/CREATE OR REPLACE FUNCTION public\.rpc_prepare_ai_task_review\(/);
 assert.match(versionedSql,/REVOKE ALL ON FUNCTION public\.rpc_prepare_ai_task_review_taxonomy\(uuid,timestamptz,jsonb\) FROM PUBLIC/);
 assert.match(versionedSql,/GRANT EXECUTE ON FUNCTION public\.rpc_prepare_ai_task_review_taxonomy\(uuid,timestamptz,jsonb\) TO authenticated/);
 const candidate=versionedSql.indexOf("envelope:=envelope||jsonb_build_object('classificationState'");
 const digest=versionedSql.indexOf("envelope:=envelope||jsonb_build_object('displayedContentDigest'");
 assert.ok(candidate>=0&&digest>candidate,'classification must be part of signed digest');
 assert.match(client,/EXPO_PUBLIC_USKOCI_NEED_SIGNED_REVIEW==='true'/);
 assert.match(client,/signedNeedReviewEnabled\(\)\?'rpc_prepare_ai_task_review_taxonomy':'rpc_prepare_ai_task_review'/);
});
