// Actual captured DEV writer/completion in PGlite. Auth, closure, turn context,
// and leaf value validation below are explicit fixtures, not hosted E2E/RLS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const folder=new URL('../../operations/dev-alpha/r06-need-complete-turn-20261102/',import.meta.url);
const pre=JSON.parse(readFileSync(new URL('preimage.json',folder),'utf8'));
const promotion=readFileSync(new URL('promotion.sql',folder),'utf8');
const after=pre.functions.map(f=>{
 const start=promotion.indexOf('CREATE OR REPLACE FUNCTION public.'+f.signature.split('(')[0]+'(');
 assert.ok(start>=0);const end=promotion.indexOf('$function$',promotion.indexOf('AS $function$',start)+13);
 return promotion.slice(start,end+10)+';';
});
const id=n=>'00000000-6063-4606-8606-'+String(n).padStart(12,'0'),owner=id(1),conversation=id(2),key=id(3),attempt=id(4);
const values={'need.title':'Lektura pet strana','need.description':'Lektura teksta od pet strana.','need.category':'Lektura teksta',
 'need.price_mode':'MY_PRICE','need.price_rsd':1500,'need.price_basis':'TOTAL','need.people_needed':1,
 'need.schedule_kind':'FIXED_WINDOW','need.starts_at':'2026-11-03T09:00:00+01:00','need.ends_at':'2026-11-06T17:00:00+01:00',
 'need.task_country_code':'RS','need.task_geography':{mode:'REMOTE'},'need.handoff':{required:false}};
const proposals=Object.entries(values).map(([key,value])=>({key,value,displayValue:JSON.stringify(value),evidence:'Synthetic complete task',confidence:0.95}));
const q=async(db,sql,args=[])=>(await db.query(sql,args)).rows[0];
async function setup(t){
 const db=new PGlite({extensions:{pgcrypto}});t.after(()=>db.close());
 await db.exec(`CREATE SCHEMA private;CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
 CREATE TABLE public.ai_conversations(id uuid PRIMARY KEY,account_id uuid,purpose text DEFAULT 'NEED_INTAKE',status text DEFAULT 'OPEN',fact_schema_version text DEFAULT 'NEED_FACT_V2',bound_need_id uuid);
 CREATE TABLE public.ai_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid,conversation_id uuid,role text,body text,safety text,proposed_fact_ids uuid[]);
 CREATE TABLE public.ai_structured_facts(id uuid PRIMARY KEY,account_id uuid,conversation_id uuid,subject_need_id uuid,fact_key text,fact_value jsonb,status text,source text,scope text,confidence numeric,evidence_excerpt text,fact_schema_version text,value_type text,display_value text,superseded_at timestamptz,superseded_by uuid);
 CREATE TABLE private.need_fact_registry(fact_key text PRIMARY KEY,value_type text);
 CREATE TABLE private.work_taxonomy_gemini_turn_hints_v1(id uuid,catalog_version bigint,proposals jsonb);
 CREATE TABLE private.ai_need_turn_commands(account_id uuid,conversation_id uuid,client_request_id uuid,turn_id uuid DEFAULT gen_random_uuid(),attempt_id uuid,state text,cancelled_at timestamptz,receipt jsonb,updated_at timestamptz,request_hash text,context_hash text,provider_dispatched bool,lease_expires_at timestamptz);
 CREATE FUNCTION private.closure_assert_open(uuid) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF current_setting('test.closed',true)='true' THEN RAISE EXCEPTION 'ACCOUNT_CLOSED';END IF;END$$;
 CREATE FUNCTION private.ai_need_turn_context(uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{"sha256":"context"}'::jsonb$$;
 CREATE FUNCTION private.ai_need_turn_status(uuid,uuid,uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('state',state,'receipt',receipt) FROM private.ai_need_turn_commands WHERE account_id=$1 AND conversation_id=$2 AND client_request_id=$3$$;
 CREATE FUNCTION private.validate_need_v2_fact(text,jsonb) RETURNS void LANGUAGE plpgsql AS $$BEGIN
 IF $1='need.people_needed' AND $2='0'::jsonb THEN RAISE EXCEPTION 'V2_PEOPLE_INVALID';END IF;
 END$$;`);
 for(const r of pre.registry)await db.query('INSERT INTO private.need_fact_registry VALUES($1,$2)',[r.fact_key,r.value_type]);
 for(const f of pre.functions)await db.exec(f.definition);
 await db.query('INSERT INTO public.ai_conversations(id,account_id) VALUES($1,$2)',[conversation,owner]);
 await db.query(`INSERT INTO private.ai_need_turn_commands(account_id,conversation_id,client_request_id,attempt_id,state,request_hash,context_hash,provider_dispatched,lease_expires_at)
 VALUES($1,$2,$3,$4,'PROCESSING',encode(extensions.digest(convert_to(jsonb_build_object('conversationId',$2::uuid,'text','user')::text,'UTF8'),'sha256'),'hex'),'context',true,now()+interval '5 minutes')`,[owner,conversation,key,attempt]);
 return db;
}
const complete=(db,p=proposals,safety='ALLOW',account=owner)=>q(db,'SELECT public.rpc_ai_complete_need_turn_v2_service($1,$2,$3,$4,\'user\',\'assistant\',$5,$6::jsonb) result',[account,conversation,key,attempt,safety,p]);
const snapshot=db=>q(db,`SELECT (SELECT count(*)::int FROM public.ai_messages) messages,(SELECT count(*)::int FROM public.ai_structured_facts) facts,(SELECT state FROM private.ai_need_turn_commands) state`);
test('generated guarded operation is exact and limited to the two captured bodies',()=>{
 assert.match(execFileSync(process.execPath,['supabase/operations/dev-alpha/r06-need-complete-turn-20261102/build.mjs','--check'],{encoding:'utf8'}),/R06_COMPLETE_TURN_PACKAGE_PASS/);
 assert.equal(after.length,2);
 assert.doesNotMatch(after.join('\n'),/\b(?:GRANT|REVOKE|CREATE TABLE|ALTER TABLE)\b/);
});
test('preimage reproduces the 13-fact rejection with no partial writes',async t=>{
 const db=await setup(t);await assert.rejects(complete(db),/PROPOSALS_INVALID/);
 assert.deepEqual(await snapshot(db),{messages:0,facts:0,state:'PROCESSING'});
});
test('raising only the writer still rolls all 13 facts back at the old completion boundary',async t=>{
 const db=await setup(t);await db.exec(after[0]);await assert.rejects(complete(db),/AI_TURN_RECEIPT_INVALID/);
 assert.deepEqual(await snapshot(db),{messages:0,facts:0,state:'PROCESSING'});
});
test('both bodies save all 13 facts once and preserve their exact receipt on replay and rollback',async t=>{
 const db=await setup(t);for(const sql of after)await db.exec(sql);
 const result=(await complete(db)).result;assert.equal(result.state,'SUCCEEDED');assert.equal(result.receipt.proposedCount,13);
 const rows=(await db.query('SELECT fact_key,fact_value,status FROM public.ai_structured_facts')).rows;
 assert.deepEqual(Object.fromEntries(rows.map(r=>[r.fact_key,r.fact_value])),values);
 assert.ok(rows.every(r=>r.status==='NEEDS_CONFIRMATION'));assert.deepEqual(await snapshot(db),{messages:2,facts:13,state:'SUCCEEDED'});
 assert.deepEqual((await complete(db)).result,result);assert.deepEqual(await snapshot(db),{messages:2,facts:13,state:'SUCCEEDED'});
 for(const f of pre.functions)await db.exec(f.definition);
 assert.deepEqual((await complete(db)).result,result,'a body rollback never rewrites an existing authoritative receipt');
 for(const f of pre.functions)assert.equal((await q(db,'SELECT md5(pg_get_functiondef($1::regprocedure)) hash',['public.'+f.signature])).hash,f.md5);
});
for(const [name,p,safety,error]of[
 ['oversize',Array.from({length:23},()=>proposals[0]),'ALLOW','PROPOSALS_INVALID'],
 ['blocked',proposals,'BLOCK','BLOCK_CANNOT_PERSIST_PROPOSALS'],
 ['invalid value after earlier valid facts',[...proposals.slice(0,12),{...proposals[6],value:0}],'ALLOW','V2_PEOPLE_INVALID'],
 ['manual location',[...proposals.slice(0,12),{...proposals[0],key:'need.resolved_location'}],'ALLOW','LOCATION_EDITOR_REQUIRED'],
 ['unknown fact',[...proposals.slice(0,12),{...proposals[0],key:'need.unknown'}],'ALLOW','V2_FACT_KEY_INVALID'],
])test('atomic refusal remains: '+name,async t=>{
 const db=await setup(t);for(const sql of after)await db.exec(sql);await assert.rejects(complete(db,p,safety),new RegExp(error));
 assert.deepEqual(await snapshot(db),{messages:0,facts:0,state:'PROCESSING'});
});
test('owner, account closure and expired lease remain authoritative',async t=>{
 const db=await setup(t);for(const sql of after)await db.exec(sql);
 await assert.rejects(complete(db,proposals,'ALLOW',id(99)),/CONVERSATION_NOT_FOUND/);
 await db.exec("SET test.closed='true'");await assert.rejects(complete(db),/ACCOUNT_CLOSED/);await db.exec("SET test.closed='false'");
 await db.exec("UPDATE private.ai_need_turn_commands SET lease_expires_at=now()-interval '1 second'");
 assert.equal((await complete(db)).result.state,'FAILED');assert.deepEqual(await snapshot(db),{messages:0,facts:0,state:'FAILED'});
});
