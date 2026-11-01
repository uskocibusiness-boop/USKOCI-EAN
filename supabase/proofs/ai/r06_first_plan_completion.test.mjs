// Actual captured completion writers + new atomic enrollment in isolated PGlite.
// Fact/media/location validation, Worker patch/context and closure are explicit
// substitutes. This proves transaction/identity boundaries, not Auth HTTP or DEV.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const snapshot=readFileSync(new URL('../privacy/bootstrap/current-application.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const queue=readFileSync(new URL('./r06_first_plan_enqueue_candidate.sql',import.meta.url),'utf8');
const atomic=readFileSync(new URL('./r06_first_plan_completion_candidate.sql',import.meta.url),'utf8');
const id=n=>'00000000-6061-4606-8606-'+String(n).padStart(12,'0');
const account=id(1),conversation=id(2),request=id(3),turn=id(4),attempt=id(5),profile=id(6);
const targets=[{service:'Synthetic repair',mode:'ON_SITE'}];
const output={assistantMessage:'Predlog je spreman.',safety:'ALLOW',patch:{skills:['Synthetic repair']}};
const defs=[
 'public.rpc_ai_complete_need_turn_v2_service','public.rpc_ai_complete_need_location_turn_v1_service',
 'public.rpc_complete_worker_ai_turn_service','private.ai_need_turn_status','private.worker_ai_turn_document',
];
function functionSql(name){
 const start=snapshot.indexOf('CREATE OR REPLACE FUNCTION '+name+'(');
 const marker=snapshot.indexOf('AS $function$',start),end=snapshot.indexOf('$function$;',marker+13);
 assert.ok(start>=0&&marker>start&&end>marker,name);return snapshot.slice(start,end+11);
}
async function setup(t,{install=true}={}){
 const db=new PGlite({extensions:{pgcrypto}});t.after(()=>db.close());
 await db.exec(`
 CREATE SCHEMA private;CREATE SCHEMA auth;CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
 CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('role',current_setting('test.role',true)) $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('test.role',true) $$;
 CREATE FUNCTION private.closure_assert_open(uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF current_setting('test.closed',true)='true' THEN RAISE EXCEPTION 'ACCOUNT_CLOSED' USING errcode='42501';END IF;END $$;
 CREATE FUNCTION private.closure_account_restricted(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.closed',true)='true' $$;
 CREATE FUNCTION private.taxonomy_normalize_v1(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lower(btrim($1)) $$;
 CREATE FUNCTION private.taxonomy_handoff_valid_v1(jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT jsonb_typeof($1)='object' $$;
 CREATE TABLE public.ai_conversations(id uuid PRIMARY KEY,account_id uuid,purpose text,status text DEFAULT 'OPEN',fact_schema_version text DEFAULT 'NEED_FACT_V2');
 CREATE TABLE public.ai_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid,conversation_id uuid,role text,body text,safety text,sequence_no bigint GENERATED ALWAYS AS IDENTITY);
 CREATE TABLE public.ai_structured_facts(account_id uuid,conversation_id uuid,fact_key text,fact_value jsonb,status text DEFAULT 'PROPOSED',superseded_at timestamptz);
 CREATE UNIQUE INDEX current_fact ON public.ai_structured_facts(conversation_id,fact_key) WHERE superseded_at IS NULL;
 CREATE TABLE private.ai_need_turn_commands(account_id uuid,conversation_id uuid,client_request_id uuid,turn_id uuid PRIMARY KEY,attempt_id uuid,state text,cancelled_at timestamptz,receipt jsonb,updated_at timestamptz DEFAULT now(),request_hash text,context_hash text,provider_dispatched boolean,lease_expires_at timestamptz);
 CREATE TABLE private.worker_ai_sessions(account_id uuid,conversation_id uuid PRIMARY KEY,candidate jsonb,revision integer,base_hash text,profile_id uuid,safety text);
 CREATE TABLE private.worker_ai_turns(account_id uuid,conversation_id uuid,client_request_id uuid,turn_id uuid PRIMARY KEY,attempt_id uuid,state text,cancelled_at timestamptz,completion_hash text,source_revision integer,provider_dispatched boolean,lease_expires_at timestamptz);
 CREATE TABLE private.work_taxonomy_gemini_turn_hints_v1(purpose text,account_id uuid,conversation_id uuid,client_request_id uuid,turn_id uuid,attempt_id uuid,source_fingerprint text);
 CREATE FUNCTION private.ai_task_review_source(uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('conversation',$1,'facts',(SELECT jsonb_agg(fact_value ORDER BY fact_key) FROM public.ai_structured_facts WHERE conversation_id=$1 AND superseded_at IS NULL)) $$;
 CREATE FUNCTION private.ai_need_turn_context(uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('sha256','context') $$;
 CREATE FUNCTION private.worker_ai_patch(jsonb,jsonb,uuid,uuid,boolean) RETURNS jsonb LANGUAGE sql AS $$ SELECT $1||$2 $$;
 CREATE FUNCTION public.rpc_read_worker_ai_context_service(uuid,uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
 CREATE FUNCTION private.ai_location_context_valid(jsonb) RETURNS boolean LANGUAGE sql AS $$ SELECT $1->>'fixture'='valid' $$;
 CREATE FUNCTION private.ai_location_review_matches(uuid,jsonb) RETURNS boolean LANGUAGE sql AS $$ SELECT $2->>'fixture'='valid' $$;
 CREATE FUNCTION private.ai_location_request_hash(uuid,text,jsonb) RETURNS text LANGUAGE sql AS $$ SELECT 'location-request' $$;
 CREATE FUNCTION private.ai_location_turn_document(uuid,uuid,uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
 BEGIN RETURN jsonb_build_object('turn',private.ai_need_turn_status($1,$2,$3),'location',jsonb_build_object('action','CONTINUE')); END $$;
 CREATE FUNCTION public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
 DECLARE u uuid;a uuid;p jsonb;
 BEGIN
 INSERT INTO public.ai_messages(account_id,conversation_id,role,body,safety) VALUES($1,$2,'USER',$3,$5) RETURNING id INTO u;
 FOR p IN SELECT value FROM jsonb_array_elements($6) LOOP
 UPDATE public.ai_structured_facts SET superseded_at=clock_timestamp() WHERE conversation_id=$2 AND fact_key=p->>'key' AND superseded_at IS NULL;
 INSERT INTO public.ai_structured_facts(account_id,conversation_id,fact_key,fact_value) VALUES($1,$2,p->>'key',p->'value');
 END LOOP;
 INSERT INTO public.ai_messages(account_id,conversation_id,role,body,safety) VALUES($1,$2,'ASSISTANT',$4,$5) RETURNING id INTO a;
 RETURN jsonb_build_object('conversationId',$2,'userMessageId',u,'assistantMessageId',a,'proposedCount',jsonb_array_length($6),'safety',$5,'schemaVersion','NEED_FACT_V2','authoritative',true);
 END $$;
 SELECT set_config('test.role','service_role',false);SELECT set_config('uskoci.r06_first_plan.disposable','LOCAL_ONLY',false);
 `);
 // The location fixture resolves this exact captured receipt function at runtime.
 for(const name of defs.slice().reverse())await db.exec(functionSql(name));
 await db.exec(queue);
 if(install)await db.exec(atomic);
 await db.exec('UPDATE private.work_taxonomy_first_plan_control_v1 SET enabled=true');
 return db;
}
async function fixture(db,kind){
 await db.query('INSERT INTO public.ai_conversations(id,account_id,purpose) VALUES($1,$2,$3)',[conversation,account,kind==='WORKER'?'PROFILE':'NEED_INTAKE']);
 if(kind==='WORKER'){
  await db.query("INSERT INTO private.worker_ai_sessions VALUES($1,$2,$3,4,'base',$4,'ALLOW')",[account,conversation,{skills:[]},profile]);
  await db.query("INSERT INTO private.worker_ai_turns(account_id,conversation_id,client_request_id,turn_id,attempt_id,state,source_revision,provider_dispatched,lease_expires_at) VALUES($1,$2,$3,$4,$5,'PROCESSING',4,true,now()+interval '5 minutes')",[account,conversation,request,turn,attempt]);
 }else{
  await db.query("INSERT INTO private.ai_need_turn_commands(account_id,conversation_id,client_request_id,turn_id,attempt_id,state,request_hash,context_hash,provider_dispatched,lease_expires_at) VALUES($1,$2,$3,$4,$5,'PROCESSING',CASE WHEN $6='LOCATION' THEN 'location-request' ELSE encode(extensions.digest(convert_to(jsonb_build_object('conversationId',$2::uuid,'text','user')::text,'UTF8'),'sha256'),'hex') END,'context',true,now()+interval '5 minutes')",[account,conversation,request,turn,attempt,kind]);
 }
}
const proposals=[{key:'need.category',value:'Synthetic repair'},{key:'need.task_geography',value:{mode:'STATIONARY'}}];
async function complete(db,kind,{items=targets,aid=account,aidAttempt=attempt,workerOutput=output,safety='ALLOW'}={}){
 const base=[aid,conversation,request,aidAttempt];
 if(kind==='WORKER')return (await db.query('SELECT public.rpc_complete_worker_ai_turn_with_first_plan_service($1,$2,$3,$4,$5::jsonb,$6::jsonb) result',[...base,workerOutput,items])).rows[0].result;
 if(kind==='LOCATION')return (await db.query("SELECT public.rpc_ai_complete_need_location_turn_with_first_plan_service($1,$2,$3,$4,'user','assistant',$5,$6::jsonb,$7::jsonb,'CONTINUE',$8::jsonb) result",[...base,safety,proposals,{fixture:'valid'},items])).rows[0].result;
 return (await db.query("SELECT public.rpc_ai_complete_need_turn_with_first_plan_service($1,$2,$3,$4,'user','assistant',$5,$6::jsonb,$7::jsonb) result",[...base,safety,proposals,items])).rows[0].result;
}
const value=async(db,sql,args=[])=>(await db.query(sql,args)).rows[0];

for(const kind of ['NEED','LOCATION','WORKER']){
 test(kind+': real completion and first job commit together; lost ACK replay is one job',async t=>{
  const db=await setup(t);await fixture(db,kind);
  const one=await complete(db,kind),two=await complete(db,kind);
  assert.equal(one.firstPlan.state,'PENDING');assert.equal(one.firstPlan.jobId,two.firstPlan.jobId);
  assert.equal(one.firstPlan.authority,'NONE');
  assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_first_plan_jobs_v1')).n,1);
  assert.equal((await value(db,'SELECT count(*)::int n FROM public.ai_messages')).n,kind==='WORKER'?1:2);
  if(kind==='WORKER')assert.equal((await value(db,'SELECT revision FROM private.worker_ai_sessions')).revision,5);
 });
 test(kind+': enrollment error rolls back completion messages, facts and revision',async t=>{
  const db=await setup(t);await fixture(db,kind);
  await assert.rejects(complete(db,kind,{items:[{service:'Unrelated service',mode:'ON_SITE'}]}),/R06_FIRST_PLAN_(NEED_TARGET_MISMATCH|WORKER_SERVICE_NOT_OFFERED)/);
  assert.equal((await value(db,'SELECT count(*)::int n FROM public.ai_messages')).n,0);
  assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_first_plan_jobs_v1')).n,0);
  assert.equal((await value(db,'SELECT state FROM private.'+(kind==='WORKER'?'worker_ai_turns':'ai_need_turn_commands'))).state,'PROCESSING');
  if(kind==='WORKER')assert.equal((await value(db,'SELECT revision FROM private.worker_ai_sessions')).revision,4);
  else assert.equal((await value(db,'SELECT count(*)::int n FROM public.ai_structured_facts')).n,0);
 });
 test(kind+': disabled enrollment is explicit and cannot silently complete without its job',async t=>{
  const db=await setup(t);await fixture(db,kind);await db.exec('UPDATE private.work_taxonomy_first_plan_control_v1 SET enabled=false');
  await assert.rejects(complete(db,kind),/R06_FIRST_PLAN_DISABLED/);
  assert.equal((await value(db,'SELECT count(*)::int n FROM public.ai_messages')).n,0);
 });
 test(kind+': replay may not replace targets or the provider attempt',async t=>{
  const db=await setup(t);await fixture(db,kind);await complete(db,kind);
  await assert.rejects(complete(db,kind,{items:[{service:'Synthetic repair',mode:'REMOTE'}]}),/R06_FIRST_PLAN_REPLAY_CONFLICT/);
  await assert.rejects(complete(db,kind,{items:[]}),/R06_FIRST_PLAN_REPLAY_CONFLICT/);
  await assert.rejects(complete(db,kind,{aidAttempt:id(99)}),/R06_FIRST_PLAN_REPLAY_CONFLICT|WORKER_AI_DENIED/);
  assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_first_plan_jobs_v1')).n,1);
 });
 test(kind+': disabling new enrollment preserves the exact historical receipt',async t=>{
  const db=await setup(t);await fixture(db,kind);const original=await complete(db,kind);
  await db.exec('UPDATE private.work_taxonomy_first_plan_control_v1 SET enabled=false');
  const replay=await complete(db,kind);
  assert.deepEqual(replay.firstPlan,original.firstPlan);
  assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_first_plan_jobs_v1')).n,1);
 });
}

for(const kind of ['NEED','LOCATION'])test(kind+': replay safety is bound to the persisted completion receipt',async t=>{
 const db=await setup(t);await fixture(db,kind);await complete(db,kind);
 await assert.rejects(complete(db,kind,{safety:'BLOCK'}),/R06_FIRST_PLAN_COMPLETION_RECEIPT_INVALID/);
 assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_first_plan_jobs_v1')).n,1);
});
test('current standalone completion reproduces the missing durable enrollment',async t=>{
 const db=await setup(t,{install:false});await fixture(db,'WORKER');
 const result=await value(db,'SELECT public.rpc_complete_worker_ai_turn_service($1,$2,$3,$4,$5::jsonb) result',[account,conversation,request,attempt,output]);
 assert.equal(result.result.state,'SUCCEEDED');
 assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_first_plan_jobs_v1')).n,0);
});
test('client roles and service role with a forged JWT role cannot call atomic writers',async t=>{
 const db=await setup(t);await fixture(db,'WORKER');
 for(const role of ['anon','authenticated']){
  await db.exec('SET ROLE '+role);
  await assert.rejects(complete(db,'WORKER'),e=>e.code==='42501');await db.exec('RESET ROLE');
 }
 await db.exec("SELECT set_config('test.role','authenticated',false)");
 await assert.rejects(complete(db,'WORKER'),e=>e.code==='42501');
 assert.equal((await value(db,'SELECT count(*)::int n FROM public.ai_messages')).n,0);
});
test('wrong account, closure and stale Worker completion never create a job',async t=>{
 const db=await setup(t);await fixture(db,'WORKER');
 await assert.rejects(complete(db,'WORKER',{aid:id(88)}),/WORKER_AI_DENIED/);
 await db.exec("SELECT set_config('test.closed','true',false)");
 await assert.rejects(complete(db,'WORKER'),/ACCOUNT_CLOSED/);
 await db.exec("SELECT set_config('test.closed','false',false);UPDATE private.worker_ai_sessions SET revision=8");
 await assert.rejects(complete(db,'WORKER'),/WORKER_AI_TURN_STALE/);
 assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_first_plan_jobs_v1')).n,0);
});
test('blocked completion is stored by the old writer but does not enroll a provider job',async t=>{
 const db=await setup(t);await fixture(db,'WORKER');
 const r=await complete(db,'WORKER',{workerOutput:{...output,safety:'BLOCK'}});
 assert.equal(r.completion.state,'SUCCEEDED');assert.equal(r.firstPlan.state,'NOT_ELIGIBLE');
 assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_first_plan_jobs_v1')).n,0);
});
