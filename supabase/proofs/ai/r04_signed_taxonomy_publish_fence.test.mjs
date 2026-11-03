// Execute the EXACT guarded candidate FUNCTION in synthetic PostgreSQL.
// Not a real Auth/PostgREST or DEV deployment. No business rows are accessed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const file=readFileSync('supabase/candidates/r04_signed_taxonomy_publish_fence.sql','utf8');
const source=file.match(/CREATE OR REPLACE FUNCTION public\.rpc_publish_accepted_ai_task_review\([\s\S]*?end \$function\$;/)?.[0];
if(!source) throw new Error('R04_PUBLISH_FENCE_SOURCE_MISSING');
const OWNER='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const REVIEW='33333333-3333-4333-8333-333333333333';
const KEY='44444444-4444-4444-8444-444444444444';
const NEED='55555555-5555-4555-8555-555555555555';
const fixture=`
CREATE SCHEMA private;CREATE SCHEMA auth;
CREATE TABLE private.publication_policy_bundles(id integer);
CREATE TABLE private.publication_policy_rule_refs(id integer);
CREATE TABLE private.location_market_configs(id integer);
CREATE TABLE private.ai_task_reviews(id uuid,account_id uuid,policy_binding jsonb,envelope jsonb);
CREATE TABLE private.ai_task_review_commands(review_id uuid,account_id uuid,
 client_request_id uuid,state text,evaluation jsonb,need_id uuid,need_revision int,published jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS 'SELECT nullif(current_setting(''test.uid'',true),'''')::uuid';
CREATE FUNCTION private.closure_assert_open(uuid) RETURNS void LANGUAGE plpgsql AS $cl$
BEGIN RETURN; END $cl$;
CREATE FUNCTION private.ai_task_review_policy(text) RETURNS jsonb LANGUAGE sql STABLE
 AS 'SELECT ''{"policy":"RS"}''::jsonb';
CREATE FUNCTION private.ai_task_review_command_document(uuid) RETURNS jsonb LANGUAGE sql STABLE AS $doc$
 SELECT jsonb_build_object('reviewId',review_id,'state',state) FROM private.ai_task_review_commands
 WHERE review_id=$1 LIMIT 1
$doc$;
CREATE FUNCTION public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)
RETURNS jsonb LANGUAGE sql VOLATILE AS $publish$
 SELECT jsonb_build_object('status','PUBLISHED','needId',$1)
$publish$;
INSERT INTO private.ai_task_reviews VALUES
 ('33333333-3333-4333-8333-333333333333',
 '11111111-1111-4111-8111-111111111111','{"policy":"RS"}'::jsonb,
 '{"location":{"taskCountryCode":"RS"},"responseDeadline":null,"classificationState":"REVIEW_REQUIRED"}'::jsonb);
INSERT INTO private.ai_task_review_commands VALUES
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',
 '44444444-4444-4444-8444-444444444444','EVALUATED',
 '{"decision":{"outcome":"ALLOW","decisionSequence":1}}'::jsonb,
 '55555555-5555-4555-8555-555555555555',1,null);
SELECT set_config('test.uid','11111111-1111-4111-8111-111111111111',false);
`;
test('R04/F05: signed pending classification can never publish via direct server RPC',async()=>{
 const db=new PGlite();
 try{
  await db.exec(fixture);
  await db.exec(source);
  const read=async()=>((await db.query('SELECT state FROM private.ai_task_review_commands')).rows[0].state);
  const publish=()=>db.query(
    'SELECT public.rpc_publish_accepted_ai_task_review($1::uuid,$2::uuid) result',[REVIEW,KEY]);
  await assert.rejects(publish(),/TASK_CLASSIFICATION_NOT_READY/);
  assert.equal(await read(),'EVALUATED','not READY must not modify the durable command');

  // The approved compatibility contract is explicit: old signed reviews
  // without the optional taxonomy field are not retroactively reinterpreted.
  await db.query("UPDATE private.ai_task_reviews SET envelope=envelope-'classificationState'");
  assert.equal((await publish()).rows[0].result.state,'PUBLISHED');
  assert.equal(await read(),'PUBLISHED');

  // An idempotent replay of a PUBLISHED command must not issue a new write
  // merely because its review later becomes unready.
  await db.query("UPDATE private.ai_task_reviews SET envelope=envelope||jsonb_build_object('classificationState','STALE_CATALOG')");
  assert.equal((await publish()).rows[0].result.state,'PUBLISHED');

  await db.query("UPDATE private.ai_task_review_commands SET state='EVALUATED',published=null");
  await assert.rejects(publish(),/TASK_CLASSIFICATION_NOT_READY/);

  await db.query("UPDATE private.ai_task_reviews SET envelope=envelope||jsonb_build_object('classificationState','READY')");
  assert.equal((await publish()).rows[0].result.state,'PUBLISHED');
  await db.query("UPDATE private.ai_task_review_commands SET state='EVALUATED',published=null");
  await db.query('SELECT set_config($1,$2,false)',['test.uid',OTHER]);
  await assert.rejects(publish(),/TASK_REVIEW_NOT_FOUND/);
  await db.query('SELECT set_config($1,$2,false)',['test.uid',OWNER]);
  await assert.rejects(db.query('SELECT public.rpc_publish_accepted_ai_task_review($1::uuid,$2::uuid)',[REVIEW,OTHER]),
    /TASK_REVIEW_COMMAND_MISMATCH/);
 }finally{await db.close();}
});
