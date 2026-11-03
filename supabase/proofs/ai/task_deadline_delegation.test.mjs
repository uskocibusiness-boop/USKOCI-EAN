// Actual deadline validator/helper/wrappers; canonical prepare is a recording
// substitute here. Existing canonical prepare suites cover signing/publication.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../../../docs/candidates/task-ai-deadline-20261021/forward_candidate.sql',import.meta.url),'utf8');
const owner='00000000-0000-4000-8000-000000000001',cid='00000000-0000-4000-8000-000000000002';
const definition=name=>sql.match(new RegExp('CREATE (?:OR REPLACE )?FUNCTION '+name.replaceAll('.','\\.')+'\\([\\s\\S]*?\\$function\\$;'))[0];
async function setup(t){
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`CREATE SCHEMA auth;CREATE SCHEMA private;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
 CREATE FUNCTION private.closure_assert_open(uuid) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF current_setting('test.closed',true)='true' THEN RAISE EXCEPTION 'ACCOUNT_CLOSING';END IF;END$$;
 CREATE TABLE public.ai_conversations(id uuid,account_id uuid,status text,purpose text,fact_schema_version text);
 CREATE TABLE private.publication_policy_bundles(id int);CREATE TABLE private.publication_policy_rule_refs(id int);CREATE TABLE private.location_market_configs(id int);
 CREATE FUNCTION public.rpc_ai_need_review_v2(uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('facts',current_setting('test.facts')::jsonb)$$;
 CREATE FUNCTION public.rpc_prepare_ai_task_review(uuid,timestamptz,jsonb) RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('canonical','plain','conversationId',$1,'responseDeadline',$2,'location',$3)$$;
 CREATE FUNCTION public.rpc_prepare_ai_task_review_taxonomy(uuid,timestamptz,jsonb) RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('canonical','taxonomy','conversationId',$1,'responseDeadline',$2,'location',$3)$$;
 INSERT INTO public.ai_conversations VALUES('${cid}','${owner}','OPEN','NEED_INTAKE','NEED_FACT_V2');
 SELECT set_config('test.uid','${owner}',false);SELECT set_config('test.facts','[]',false);`);
 for(const name of ['private.validate_need_v2_fact','private.ai_task_response_deadline_v1','public.rpc_prepare_ai_task_review_deadline','public.rpc_prepare_ai_task_review_deadline_taxonomy'])await db.exec(definition(name));
 return db;
}
const facts=(db,value,status='NEEDS_CONFIRMATION')=>db.query("SELECT set_config('test.facts',$1,false)",[JSON.stringify([{key:'need.response_deadline',value,status}])]);
const run=(db,taxonomy=false)=>db.query('SELECT public.rpc_prepare_ai_task_review_deadline'+(taxonomy?'_taxonomy':'')+'($1,$2) result',[cid,{expectedRevision:'current',value:{geography:{mode:'REMOTE'}}}]).then(r=>r.rows[0].result);
test('both wrappers pass the exact optional deadline/location to canonical prepare',async t=>{
 const db=await setup(t);
 for(const taxonomy of [false,true]){
  assert.equal((await run(db,taxonomy)).responseDeadline,null);
  await facts(db,{kind:'AT',at:'2099-10-10T16:00:00+01:00'});
  const result=await run(db,taxonomy);assert.equal(result.canonical,taxonomy?'taxonomy':'plain');
  assert.equal(Date.parse(result.responseDeadline),Date.parse('2099-10-10T15:00:00Z'));
  assert.equal(result.location.expectedRevision,'current');
  await facts(db,{kind:'NONE'});assert.equal((await run(db,taxonomy)).responseDeadline,null);
  await facts(db,{kind:'AT',at:'2099-10-10T15:00:00Z'},'UNKNOWN');assert.equal((await run(db,taxonomy)).responseDeadline,null);
 }
});
test('past/malformed deadline, changed owner, closed account and closed conversation are refused before prepare',async t=>{
 const db=await setup(t);
 for(const value of [{kind:'AT',at:'2020-01-01T00:00:00Z'},{kind:'AT',at:'2099-02-30T00:00:00Z'},{kind:'NONE',at:'2099-01-01T00:00:00Z'},{}]){
  await facts(db,value);await assert.rejects(run(db),/RESPONSE_DEADLINE_/);
 }
 await facts(db,{kind:'NONE'});
 await db.exec("SELECT set_config('test.uid','00000000-0000-4000-8000-000000000099',false)");await assert.rejects(run(db),/TASK_REVIEW_NOT_FOUND/);
 await db.exec(`SELECT set_config('test.uid','${owner}',false);SELECT set_config('test.closed','true',false)`);await assert.rejects(run(db),/ACCOUNT_CLOSING/);
 await db.exec("SELECT set_config('test.closed','false',false);UPDATE public.ai_conversations SET status='COMPLETED'");await assert.rejects(run(db),/TASK_REVIEW_NOT_EDITABLE/);
});
