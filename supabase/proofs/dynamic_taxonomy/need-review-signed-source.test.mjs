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
