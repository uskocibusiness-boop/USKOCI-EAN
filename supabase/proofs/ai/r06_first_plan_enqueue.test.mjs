// R06 first-plan enrollment candidate. Synthetic PGlite/pgcrypto only:
 // no hosted database, API keys, provider calls or business writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

const candidate=readFileSync(new URL('./r06_first_plan_enqueue_candidate.sql',import.meta.url),'utf8');
const id=n=>'00000000-6060-4606-8606-'+String(n).padStart(12,'0');
const a=id(1),c=id(2),k=id(3),t=id(4),attempt=id(5),msg=id(6);
const need=[a,c,k,t,attempt,'NEED_SERVICE',JSON.stringify([{service:'Synthetic repair',mode:'ON_SITE'}])];
const worker=[a,c,k,t,attempt,'WORKER_CAPABILITY',need[6]];
const callSql='SELECT public.rpc_taxonomy_first_plan_enqueue_service($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::text,$7::jsonb) result';
async function setup(install=true){
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec([
  'CREATE SCHEMA private; CREATE SCHEMA auth; CREATE SCHEMA extensions;',
  'CREATE EXTENSION pgcrypto WITH SCHEMA extensions;',
  'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE unrelated_api_role;',
  "CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('role',current_setting('test.jwt_role',true)) $$;",
  'CREATE TABLE private.account_closure_requests(account_id uuid,state text);',
  "CREATE FUNCTION private.closure_assert_open(uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM private.account_closure_requests WHERE account_id=$1 AND state IN('READY','EXECUTING','FAILED','CLOSED')) THEN RAISE EXCEPTION 'ACCOUNT_CLOSING' USING errcode='42501'; END IF; END $$;",
  "CREATE FUNCTION private.taxonomy_normalize_v1(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lower(btrim($1)) $$;",
  "CREATE FUNCTION private.taxonomy_handoff_valid_v1(jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT jsonb_typeof($1)='object' $$;",
  'CREATE TABLE public.ai_conversations(id uuid PRIMARY KEY,account_id uuid,purpose text);',
  'CREATE TABLE public.ai_messages(id uuid PRIMARY KEY,conversation_id uuid,account_id uuid,role text,sequence_no bigint);',
  'CREATE TABLE private.ai_need_turn_commands(account_id uuid,conversation_id uuid,client_request_id uuid,turn_id uuid,attempt_id uuid,state text,cancelled_at timestamptz,receipt jsonb,updated_at timestamptz);',
  "CREATE FUNCTION private.ai_task_review_source(uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('conversation',$1::text) $$;",
  'CREATE TABLE private.worker_ai_sessions(account_id uuid,conversation_id uuid,candidate jsonb,revision integer,base_hash text);',
  'CREATE TABLE private.worker_ai_turns(account_id uuid,conversation_id uuid,client_request_id uuid,turn_id uuid,attempt_id uuid,state text,cancelled_at timestamptz,completion_hash text,source_revision integer);',
  "SELECT set_config('test.jwt_role','service_role',false);",
  "SELECT set_config('uskoci.r06_first_plan.disposable','LOCAL_ONLY',false);"
 ].join('\n'));
 if(install)await db.exec(candidate);
 return db;
}
const enqueue=(db,x)=>db.query(callSql,x).then(r=>r.rows[0].result);
async function needFixture(db){
 await db.query("INSERT INTO public.ai_conversations VALUES($1,$2,'NEED_INTAKE')",[c,a]);
 await db.query("INSERT INTO public.ai_messages VALUES($1,$2,$3,'ASSISTANT',2)",[msg,c,a]);
 await db.query("INSERT INTO private.ai_need_turn_commands VALUES($1,$2,$3,$4,$5,'SUCCEEDED',null,$6,clock_timestamp())",
  [a,c,k,t,attempt,{authoritative:true,schemaVersion:'NEED_FACT_V2',assistantMessageId:msg}]);
}
async function workerFixture(db){
 await db.query("INSERT INTO private.worker_ai_sessions VALUES($1,$2,$3,5,'base')",[a,c,{skills:['Synthetic repair']}]);
 await db.query("INSERT INTO private.worker_ai_turns VALUES($1,$2,$3,$4,$5,'SUCCEEDED',null,$6,4)",
  [a,c,k,t,attempt,'a'.repeat(64)]);
}
test('no default enablement and no job until explicitly admitted',async t=>{
 const db=await setup();t.after(()=>db.close());await needFixture(db);
 assert.deepEqual(await enqueue(db,need),{state:'DISABLED',authority:'NONE'});
 assert.equal((await db.query('SELECT count(*)::int n FROM private.work_taxonomy_first_plan_jobs_v1')).rows[0].n,0);
});
test('Need exact completed turn creates one durable identity, replay returns identical receipt',async t=>{
 const db=await setup();t.after(()=>db.close());await needFixture(db);
 await db.exec('UPDATE private.work_taxonomy_first_plan_control_v1 SET enabled=true');
 const one=await enqueue(db,need),two=await enqueue(db,need);
 assert.equal(one.state,'PENDING');assert.equal(one.jobId,two.jobId);
 assert.equal(one.providerAuthority,'NONE');assert.equal(one.attempts,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM private.work_taxonomy_first_plan_jobs_v1')).rows[0].n,1);
 await assert.rejects(enqueue(db,[...need.slice(0,6),JSON.stringify([{service:'Another repair',mode:'ON_SITE'}])]),/R06_FIRST_PLAN_REPLAY_CONFLICT/);
 const receipt=(await db.query('SELECT public.rpc_taxonomy_first_plan_receipt_service($1::uuid) result',[one.jobId])).rows[0].result;
 assert.equal(receipt.state,'PENDING');assert.equal(receipt.retryAllowed,false);
 assert.equal(JSON.stringify(receipt).includes('Synthetic repair'),false);
});
test('Need later message, wrong account and unconfirmed completion cannot enqueue',async t=>{
 const db=await setup();t.after(()=>db.close());await needFixture(db);
 await db.exec('UPDATE private.work_taxonomy_first_plan_control_v1 SET enabled=true');
 await db.query("INSERT INTO public.ai_messages VALUES($1,$2,$3,'USER',3)",[id(40),c,a]);
 await assert.rejects(enqueue(db,need),/R06_FIRST_PLAN_SOURCE_UNCONFIRMED/);
 await db.query('DELETE FROM public.ai_messages WHERE id=$1',[id(40)]);
 await assert.rejects(enqueue(db,[id(999),...need.slice(1)]),/R06_FIRST_PLAN_SOURCE_UNCONFIRMED/);
 await db.query("UPDATE private.ai_need_turn_commands SET state='FAILED'");
 await assert.rejects(enqueue(db,need),/R06_FIRST_PLAN_SOURCE_UNCONFIRMED/);
});
test('Worker current confirmed revision and offered service are required',async t=>{
 const db=await setup();t.after(()=>db.close());await workerFixture(db);
 await db.exec('UPDATE private.work_taxonomy_first_plan_control_v1 SET enabled=true');
 const first=await enqueue(db,worker);assert.equal(first.state,'PENDING');
 await assert.rejects(enqueue(db,[...worker.slice(0,6),
  JSON.stringify([{service:'Unapproved skill',mode:'ON_SITE'}])]),/R06_FIRST_PLAN_WORKER_SERVICE_NOT_OFFERED/);
 await db.query('UPDATE private.worker_ai_sessions SET revision=6 WHERE account_id=$1',[a]);
 await assert.rejects(enqueue(db,worker),/R06_FIRST_PLAN_SOURCE_UNCONFIRMED/);
});
test('untrusted roles cannot invoke definer or directly read private targets',async t=>{
 const db=await setup();t.after(()=>db.close());await needFixture(db);
 await db.exec('UPDATE private.work_taxonomy_first_plan_control_v1 SET enabled=true');
 await enqueue(db,need);
 for(const role of ['anon','authenticated','unrelated_api_role']){
  await db.exec('SET ROLE '+role);
  try{
   await assert.rejects(enqueue(db,need),e=>e.code==='42501');
   await assert.rejects(db.query('SELECT targets FROM private.work_taxonomy_first_plan_jobs_v1'),e=>e.code==='42501');
  }finally{await db.exec('RESET ROLE');}
 }
});
test('account closure prevents enrollment without leaking private prose',async t=>{
 const db=await setup();t.after(()=>db.close());await needFixture(db);
 await db.exec('UPDATE private.work_taxonomy_first_plan_control_v1 SET enabled=true');
 await db.query('INSERT INTO private.account_closure_requests VALUES($1,$2)',[a,'READY']);
 await assert.rejects(enqueue(db,need),e=>e.code==='42501');
 assert.equal((await db.query('SELECT count(*)::int n FROM private.work_taxonomy_first_plan_jobs_v1')).rows[0].n,0);
});
test('local-only guard fails atomically before any schema change when flag is absent',async t=>{
 const db=await setup(false);t.after(()=>db.close());
 await db.exec("SELECT set_config('uskoci.r06_first_plan.disposable','',false)");
 await assert.rejects(db.exec(candidate),/R06_FIRST_PLAN_LOCAL_ONLY/);
 await db.exec('ROLLBACK');
 const r=await db.query("SELECT to_regclass('private.work_taxonomy_first_plan_jobs_v1') t");
 assert.equal(r.rows[0].t,null);
});
