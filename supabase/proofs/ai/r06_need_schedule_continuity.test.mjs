// Actual DEV completion/source/capture bodies; supporting fact writer, auth,
// media and closure are explicit isolated fixtures. No hosted or paid calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const pre=JSON.parse(readFileSync(new URL('./r06_need_schedule_continuity_preimage.json',import.meta.url),'utf8'));
const candidate=readFileSync(new URL('./r06_need_schedule_continuity_candidate.sql',import.meta.url),'utf8');
const id=n=>'00000000-6062-4606-8606-'+String(n).padStart(12,'0');
const aid=id(1),cid=id(2),category=id(3);
const plan=[{service:'Proofreading text',mode:'REMOTE',action:'REUSE_EXISTING',categoryId:category,parentId:'',proposedPath:[],reason:'The confirmed semantic service is the same existing leaf.',catalogVersion:11,handoff:{required:false}}];
const q=async(db,sql,args=[])=>(await db.query(sql,args)).rows[0];
test('guarded promotion and inverse package reproduce exactly from the pinned source',()=>{
 const output=execFileSync(process.execPath,['supabase/operations/dev-alpha/r06-need-schedule-continuity-20261102/build.mjs','--check'],{encoding:'utf8'});
 assert.match(output,/R06_NEED_CONTINUITY_PACKAGE_PASS/);
});
async function setup(t,install=true){
 const db=new PGlite({extensions:{pgcrypto}});t.after(()=>db.close());
 await db.exec(`
 CREATE SCHEMA private;CREATE SCHEMA auth;CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{"role":"service_role"}'::jsonb $$;
 CREATE FUNCTION private.closure_assert_open(uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF current_setting('test.closed',true)='true' THEN RAISE EXCEPTION 'ACCOUNT_CLOSED';END IF;END $$;
 CREATE FUNCTION private.taxonomy_normalize_v1(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lower(btrim($1)) $$;
 CREATE FUNCTION private.taxonomy_handoff_valid_v1(jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT $1='{"required":false}'::jsonb $$;
 CREATE TABLE public.ai_conversations(id uuid PRIMARY KEY,account_id uuid,purpose text DEFAULT 'NEED_INTAKE',status text DEFAULT 'OPEN',fact_schema_version text DEFAULT 'NEED_FACT_V2',bound_need_id uuid,need_edit_base_fingerprint text);
 CREATE TABLE public.needs(id uuid,revision int,status text);
 CREATE FUNCTION private.need_edit_base_marker(uuid) RETURNS text LANGUAGE sql AS $$ SELECT 'unused' $$;
 CREATE TABLE public.ai_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid,conversation_id uuid,role text,body text,safety text,sequence_no bigint GENERATED ALWAYS AS IDENTITY);
 CREATE TABLE public.ai_structured_facts(id uuid DEFAULT gen_random_uuid(),account_id uuid,conversation_id uuid,fact_key text,fact_value jsonb,status text DEFAULT 'NEEDS_CONFIRMATION',superseded_at timestamptz);
 CREATE TABLE private.ai_need_turn_commands(account_id uuid,conversation_id uuid,client_request_id uuid,turn_id uuid PRIMARY KEY,attempt_id uuid,state text,cancelled_at timestamptz,receipt jsonb,updated_at timestamptz DEFAULT clock_timestamp(),request_hash text,context_hash text,provider_dispatched boolean,lease_expires_at timestamptz);
 CREATE TABLE private.worker_ai_sessions(account_id uuid,conversation_id uuid,candidate jsonb,revision int,base_hash text);
 CREATE TABLE private.worker_ai_turns(account_id uuid,conversation_id uuid,client_request_id uuid,turn_id uuid,attempt_id uuid,state text,cancelled_at timestamptz,completion_hash text,source_revision int);
 CREATE TABLE private.work_taxonomy_control(singleton bool,catalog_version bigint);
 INSERT INTO private.work_taxonomy_control VALUES(true,11);
 CREATE TABLE private.work_taxonomy_gemini_turn_hints_v1(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),purpose text,account_id uuid,conversation_id uuid,client_request_id uuid,turn_id uuid,attempt_id uuid,source_fingerprint text,catalog_version bigint,proposals jsonb,payload_digest text,created_at timestamptz DEFAULT clock_timestamp(),UNIQUE(purpose,account_id,turn_id));
 CREATE FUNCTION private.ai_need_turn_context(uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{"sha256":"context"}'::jsonb $$;
 CREATE FUNCTION private.ai_need_turn_status(uuid,uuid,uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('state',state) FROM private.ai_need_turn_commands WHERE account_id=$1 AND conversation_id=$2 AND client_request_id=$3 $$;
 CREATE FUNCTION public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
 DECLARE u uuid;a uuid;p jsonb;
 BEGIN
 INSERT INTO public.ai_messages(account_id,conversation_id,role,body,safety) VALUES($1,$2,'USER',$3,$5) RETURNING id INTO u;
 IF $5 IN ('ALLOW','CLARIFY') THEN FOR p IN SELECT value FROM jsonb_array_elements($6) LOOP
 UPDATE public.ai_structured_facts SET superseded_at=clock_timestamp() WHERE conversation_id=$2 AND fact_key=p->>'key' AND superseded_at IS NULL;
 INSERT INTO public.ai_structured_facts(account_id,conversation_id,fact_key,fact_value) VALUES($1,$2,p->>'key',p->'value');END LOOP;END IF;
 INSERT INTO public.ai_messages(account_id,conversation_id,role,body,safety) VALUES($1,$2,'ASSISTANT',$4,$5) RETURNING id INTO a;
 RETURN jsonb_build_object('conversationId',$2,'userMessageId',u,'assistantMessageId',a,'proposedCount',jsonb_array_length($6),'safety',$5,'schemaVersion','NEED_FACT_V2','authoritative',true);
 END $$;
 SELECT set_config('uskoci.r06_continuity.disposable','LOCAL_ONLY',false);
 `);
 for(const f of pre.functions.filter(f=>f.proname==='ai_task_review_source_before_media'))await db.exec(f.definition);
 await db.exec(`CREATE FUNCTION private.ai_task_review_source(uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT private.ai_task_review_source_before_media($1)||'{"media":[]}'::jsonb $$;`);
 for(const f of pre.functions.filter(f=>f.proname!=='ai_task_review_source_before_media'))await db.exec(f.definition);
 if(install)await db.exec(candidate);
 await db.query('INSERT INTO public.ai_conversations(id,account_id) VALUES($1,$2)',[cid,aid]);
 await claim(db,1);await complete(db,1,[{key:'need.category',value:'Proofreading text'},{key:'need.description',value:'Five Serbian-language pages.'},{key:'need.task_geography',value:{mode:'REMOTE'}},{key:'need.handoff',value:{required:false}}]);
 await db.query("SELECT public.rpc_taxonomy_capture_gemini_turn_hints_service($1,$2,$3,$4,$5,'NEED_SERVICE',11,$6::jsonb)",[aid,cid,id(11),id(21),id(31),plan]);
 return db;
}
async function claim(db,n){await db.query(`INSERT INTO private.ai_need_turn_commands(account_id,conversation_id,client_request_id,turn_id,attempt_id,state,request_hash,context_hash,provider_dispatched,lease_expires_at) VALUES($1,$2,$3,$4,$5,'PROCESSING',encode(extensions.digest(convert_to(jsonb_build_object('conversationId',$2::uuid,'text','user')::text,'UTF8'),'sha256'),'hex'),'context',true,now()+interval '5 minutes')`,[aid,cid,id(10+n),id(20+n),id(30+n)]);}
async function complete(db,n,proposals=[{key:'need.starts_at',value:'2026-11-03T09:00:00+01:00'}],safety='ALLOW',owner=aid){return q(db,"SELECT public.rpc_ai_complete_need_turn_v2_service($1,$2,$3,$4,'user','assistant',$5,$6::jsonb) result",[owner,cid,id(10+n),id(30+n),safety,proposals]);}
async function status(db){return q(db,`SELECT count(*)::int total,count(*)FILTER(WHERE source_fingerprint=encode(extensions.digest(private.ai_task_review_source(conversation_id)::text,'sha256'),'hex'))::int current FROM private.work_taxonomy_gemini_turn_hints_v1`);}

test('original DEV completion loses a valid existing ID after only a schedule answer',async t=>{const db=await setup(t,false);assert.deepEqual(await status(db),{total:1,current:1});await claim(db,2);await complete(db,2);assert.deepEqual(await status(db),{total:1,current:0});});
test('schedule continuation creates one current capture with identical ID; replay does not duplicate',async t=>{const db=await setup(t);const old=await q(db,'SELECT source_fingerprint,payload_digest FROM private.work_taxonomy_gemini_turn_hints_v1');await claim(db,2);assert.equal((await complete(db,2)).result.state,'SUCCEEDED');assert.deepEqual(await status(db),{total:2,current:1});await complete(db,2);assert.deepEqual(await status(db),{total:2,current:1});assert.equal((await q(db,"SELECT count(DISTINCT proposals->0->>'categoryId')::int n FROM private.work_taxonomy_gemini_turn_hints_v1")).n,1);assert.deepEqual(await q(db,'SELECT source_fingerprint,payload_digest FROM private.work_taxonomy_gemini_turn_hints_v1 ORDER BY created_at LIMIT 1'),old);});
for(const key of ['need.category','need.description','need.task_geography','need.handoff'])test('semantic change never carries a prior hint: '+key,async t=>{const db=await setup(t);await claim(db,2);await complete(db,2,[{key,value:'different'}]);assert.deepEqual(await status(db),{total:1,current:0});});
for(const safety of ['REVIEW','BLOCK'])test('safety '+safety+' does not carry classification',async t=>{const db=await setup(t);await claim(db,2);await complete(db,2,undefined,safety);assert.equal((await status(db)).total,1);});
test('catalog change and tampered source refuse carry without rejecting the scheduling message',async t=>{const db=await setup(t);await db.exec('UPDATE private.work_taxonomy_control SET catalog_version=12');await claim(db,2);assert.equal((await complete(db,2)).result.state,'SUCCEEDED');assert.equal((await status(db)).total,1);});
test('unrelated stale history cannot be revived',async t=>{const db=await setup(t);await db.exec("UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET source_fingerprint=repeat('0',64)");await claim(db,2);await complete(db,2);assert.equal((await status(db)).total,1);});
test('wrong owner and expired attempt still cannot complete or carry',async t=>{const db=await setup(t);await claim(db,2);await assert.rejects(complete(db,2,undefined,'ALLOW',id(99)),/CONVERSATION_NOT_FOUND/);await db.exec("UPDATE private.ai_need_turn_commands SET lease_expires_at=now()-interval '1 second' WHERE state='PROCESSING'");assert.equal((await complete(db,2)).result.state,'FAILED');assert.equal((await status(db)).total,1);});

test('exact body rollback and reapply preserve attributes and restore the observed behavior',async t=>{
 const db=await setup(t);const signature='public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)';
 const attrs=await q(db,"SELECT to_jsonb(p)-'prosrc' attributes FROM pg_proc p WHERE oid=$1::regprocedure",[signature]);
 const original=pre.functions.find(f=>f.proname==='rpc_ai_complete_need_turn_v2_service');await db.exec(original.definition);
 assert.equal((await q(db,'SELECT md5(pg_get_functiondef($1::regprocedure)) hash',[signature])).hash,original.md5);
 assert.deepEqual(await q(db,"SELECT to_jsonb(p)-'prosrc' attributes FROM pg_proc p WHERE oid=$1::regprocedure",[signature]),attrs);
 await db.exec(candidate);await claim(db,2);await complete(db,2);assert.deepEqual(await status(db),{total:2,current:1});
});
test('capture failure rolls the new completion back atomically',async t=>{
 const db=await setup(t);await claim(db,2);
 const original=pre.functions.find(f=>f.proname==='rpc_taxonomy_capture_gemini_turn_hints_service').definition;
 const start=original.indexOf('AS $function$')+13,end=original.lastIndexOf('$function$');
 await db.exec(original.slice(0,start)+"\nBEGIN RAISE EXCEPTION 'INJECTED_CAPTURE_FAILURE';END\n"+original.slice(end));
 const before=await q(db,'SELECT count(*)::int messages FROM public.ai_messages');
 await assert.rejects(complete(db,2),/INJECTED_CAPTURE_FAILURE/);
 assert.deepEqual(await q(db,'SELECT count(*)::int messages FROM public.ai_messages'),before);
 assert.equal((await q(db,'SELECT state FROM private.ai_need_turn_commands WHERE turn_id=$1',[id(22)])).state,'PROCESSING');
 assert.equal((await status(db)).total,1);
});
