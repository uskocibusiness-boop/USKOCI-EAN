// Captured DEV completion/capture + actual atomic catalog SQL in isolated PGlite.
// Fact/media/location validation, Worker patch/context and closure are explicit
// substitutes. This proves transaction/identity boundaries, not Auth HTTP or DEV.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const snapshot=readFileSync(new URL('../privacy/bootstrap/current-application.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const preimage=JSON.parse(readFileSync(new URL('../../operations/dev-alpha/r04-single-pass-20261103/preimage.json',import.meta.url),'utf8'));
const catalog=readFileSync(new URL('./r04_turn_catalog_resolution_candidate.sql',import.meta.url),'utf8').split('-- Recorded deployed R04 definitions.')[0]+'COMMIT;';
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
 const current=preimage.functions.find(f=>f.name===name);if(current)return current.definition+';';
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
 CREATE TABLE private.work_taxonomy_gemini_turn_hints_v1(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),purpose text,account_id uuid,conversation_id uuid,client_request_id uuid,turn_id uuid,attempt_id uuid,source_fingerprint text,catalog_version bigint,proposals jsonb,payload_digest text,created_at timestamptz DEFAULT now(),UNIQUE(purpose,account_id,turn_id));
 CREATE TABLE private.work_taxonomy_control(singleton boolean PRIMARY KEY,catalog_version bigint,updated_at timestamptz DEFAULT now());
 INSERT INTO private.work_taxonomy_control VALUES(true,17,now());
 CREATE TABLE private.work_taxonomy_categories(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),parent_id uuid,label text,canonical_key text UNIQUE,state text,source text,catalog_version bigint DEFAULT 17);
 CREATE TABLE private.work_taxonomy_category_modes(category_id uuid,execution_scope text,source_ref text,UNIQUE(category_id,execution_scope));
 CREATE TABLE private.work_taxonomy_aliases(category_id uuid,normalized_key text);
 CREATE TABLE private.work_taxonomy_audit(action text CHECK(action IN ('AUTO_CREATED','CORRECTED','RETIRED','EXISTING_REUSED')),category_id uuid,normalized_key text,catalog_version bigint,source_ref text);
 CREATE TABLE private.work_taxonomy_risk_rules(pattern text,decision text,enabled boolean);
 INSERT INTO private.work_taxonomy_risk_rules VALUES('weapons','BLOCKED',true);
 INSERT INTO private.work_taxonomy_categories VALUES('${id(10)}',NULL,'Canonical repair','canonical repair','ESTABLISHED','CURATED',17);
 INSERT INTO private.work_taxonomy_category_modes VALUES('${id(10)}','ON_SITE','fixture');
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
 await db.exec(functionSql('private.taxonomy_risk_triage_v1'));
 await db.exec(functionSql('public.rpc_taxonomy_capture_gemini_turn_hints_service'));
 await db.exec(catalog);
 if(install)await db.exec(atomic);
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
const decision={service:'Synthetic repair',mode:'ON_SITE',action:'REUSE_EXISTING',categoryId:id(10),parentId:'',proposedPath:[],reason:'Equivalent work in the complete catalog',catalogVersion:17};
const plan={catalogVersion:17,proposals:[decision],anchors:[{categoryId:id(10),label:'Canonical repair',parentId:null}]};
async function complete(db,kind,{items=plan,aid=account,aidAttempt=attempt,workerOutput=output,safety='ALLOW'}={}){
 const base=[aid,conversation,request,aidAttempt];
 if(kind==='WORKER')return (await db.query('SELECT public.rpc_complete_worker_ai_turn_with_first_plan_service($1,$2,$3,$4,$5::jsonb,$6::jsonb) result',[...base,workerOutput,items])).rows[0].result;
 if(kind==='LOCATION')return (await db.query("SELECT public.rpc_ai_complete_need_location_turn_with_first_plan_service($1,$2,$3,$4,'user','assistant',$5,$6::jsonb,$7::jsonb,'CONTINUE',$8::jsonb) result",[...base,safety,proposals,{fixture:'valid'},items])).rows[0].result;
 return (await db.query("SELECT public.rpc_ai_complete_need_turn_with_first_plan_service($1,$2,$3,$4,'user','assistant',$5,$6::jsonb,$7::jsonb) result",[...base,safety,proposals,items])).rows[0].result;
}
const value=async(db,sql,args=[])=>(await db.query(sql,args)).rows[0];


for(const kind of ['NEED','LOCATION','WORKER']){
 test(kind+': one atomic completion captures synonym and resolves exact category without aliases',async t=>{
  const db=await setup(t);await fixture(db,kind);
  const one=await complete(db,kind),two=await complete(db,kind);
  assert.deepEqual(one,two);assert.deepEqual(one.firstPlan,{state:'RESOLVED',authority:'CATALOG_ONLY',applicability:'NOT_EVALUATED'});
  const hints=(await db.query('SELECT * FROM private.work_taxonomy_gemini_turn_hints_v1')).rows;
  assert.equal(hints.length,1);assert.equal(hints[0].catalog_resolution.items[0].categoryId,id(10));
  assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_aliases')).n,0);
  assert.equal((await value(db,'SELECT count(*)::int n FROM public.ai_messages')).n,kind==='WORKER'?1:2);
 });
 test(kind+': invalid classification rolls the conversation back; no false saved reply',async t=>{
  const db=await setup(t);await fixture(db,kind);
  await assert.rejects(complete(db,kind,{items:{...plan,proposals:[{...decision,service:'Different unoffered work'}]}}),/TARGET_MISMATCH|SERVICE_NOT_OFFERED/);
  assert.equal((await value(db,'SELECT count(*)::int n FROM public.ai_messages')).n,0);
  assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_gemini_turn_hints_v1')).n,0);
 });
 test(kind+': duplicate payload is stable; altered plan or attempt is refused',async t=>{
  const db=await setup(t);await fixture(db,kind);await complete(db,kind);
  await assert.rejects(complete(db,kind,{items:{...plan,anchors:[]}}),/REPLAY_CONFLICT/);
  await assert.rejects(complete(db,kind,{aidAttempt:id(99)}),/DENIED|REPLAY_CONFLICT/);
 });
}
test('new branch resolves once and never publishes a task or activates a worker',async t=>{
 const db=await setup(t);await fixture(db,'NEED');
 const next={...plan,anchors:[],proposals:[{...decision,action:'CREATE_NEW_BRANCH',categoryId:'',proposedPath:['Technical services','Synthetic repair']}]};
 const one=await complete(db,'NEED',{items:next});assert.equal(one.firstPlan.state,'RESOLVED');
 await complete(db,'NEED',{items:next});
 assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_categories')).n,3);
 assert.equal((await value(db,'SELECT count(*)::int n FROM private.work_taxonomy_audit')).n,2);
});
test('changed catalog records deferred result, preserves conversation and creates no category',async t=>{
 const db=await setup(t);await fixture(db,'NEED');
 await db.exec("UPDATE private.work_taxonomy_categories SET label='Changed identity'");
 const one=await complete(db,'NEED');assert.equal(one.firstPlan.state,'DEFERRED');assert.equal(one.firstPlan.code,'CATALOG_CHANGED');
 assert.equal((await value(db,'SELECT count(*)::int n FROM public.ai_messages')).n,2);
 assert.deepEqual(await complete(db,'NEED'),one);
});
test('client roles cannot execute service completion even with forged service JWT claim',async t=>{
 const db=await setup(t);await fixture(db,'NEED');
 await db.exec('SET ROLE authenticated');await assert.rejects(complete(db,'NEED'),/permission denied/);
 await db.exec('RESET ROLE');await db.exec("SELECT set_config('test.role','authenticated',false)");
 await assert.rejects(complete(db,'NEED'),/DENIED/);
});
test('closed account and wrong owner cannot complete or mutate the catalog',async t=>{
 const db=await setup(t);await fixture(db,'NEED');
 await assert.rejects(complete(db,'NEED',{aid:id(99)}),/DENIED/);
 await db.exec("SELECT set_config('test.closed','true',false)");await assert.rejects(complete(db,'NEED'),/ACCOUNT_CLOSED/);
 assert.equal((await value(db,'SELECT count(*)::int n FROM public.ai_messages')).n,0);
});
