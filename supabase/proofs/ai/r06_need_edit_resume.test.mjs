// Actual captured DEV opener and proposed body, isolated PostgreSQL execution.
// Auth and publication fingerprint dependencies are explicit substitutes;
// no hosted RLS, concurrent transaction, native or publication acceptance claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const pre=JSON.parse(readFileSync(new URL('./r06_need_edit_resume_preimage.json',import.meta.url),'utf8'));
const candidate=readFileSync(new URL('./r06_need_edit_resume_candidate.sql',import.meta.url),'utf8');
const snapshot=readFileSync(new URL('../privacy/bootstrap/current-application.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const id=n=>'00000000-6063-4606-8606-'+String(n).padStart(12,'0');
const owner=id(1),other=id(2),need=id(3);
const one=async(db,sql,args=[])=>(await db.query(sql,args)).rows[0];
const open=async db=>(await one(db,'SELECT public.rpc_ai_open_need_edit_conversation_v2($1) result',[need])).result;
test('guarded promotion and inverse regenerate from the captured source',()=>{
 assert.match(execFileSync(process.execPath,['supabase/operations/dev-alpha/r06-need-edit-resume-20261102/build.mjs','--check'],{encoding:'utf8'}),/R06_EDIT_RESUME_PACKAGE_PASS/);
});
test('raw candidate refuses an unmarked database before creating a function',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await assert.rejects(db.exec(candidate),/R06_EDIT_RESUME_LOCAL_ONLY/);
 assert.equal((await one(db,"SELECT to_regprocedure('public.rpc_ai_open_need_edit_conversation_v2(uuid)') target")).target,null);
});
function table(name){
 const q=name.split('.').map(x=>'"'+x+'"').join('.');
 const start=snapshot.indexOf('CREATE TABLE '+q+' ('),end=snapshot.indexOf('\n);',start);
 assert.ok(start>=0&&end>start,name);
 return snapshot.slice(start,end+3)+'\n'+snapshot.split('\n').filter(l=>l.startsWith('ALTER TABLE '+q+' ')
 &&(l.includes(' SET DEFAULT ')||/ ADD CONSTRAINT .* (PRIMARY KEY|UNIQUE) /.test(l))).join('\n');
}
async function setup(t,patched=true){
 const db=new PGlite({extensions:{pgcrypto}});t.after(()=>db.close());
 await db.exec(`CREATE SCHEMA auth;CREATE SCHEMA private;CREATE SCHEMA extensions;
 CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text $$;
 CREATE FUNCTION private.closure_assert_open(uuid,uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
 BEGIN IF current_setting('test.closed',true)='true' THEN RAISE EXCEPTION 'ACCOUNT_CLOSING';END IF;END $$;
`);
 let needs=table('public.needs');
 needs=needs.replace(/  "approx_geog" extensions\.geography\(Point,4326\) GENERATED ALWAYS AS \([\s\S]*?\) STORED,/,
 '  "approx_geog" jsonb CHECK (approx_geog IS NULL),');
 await db.exec(needs);
 for(const name of ['public.ai_conversations','public.ai_messages','public.ai_structured_facts','public.need_sensitive',
 'public.need_geography','public.need_requirement_details','private.need_fact_registry','private.ai_task_reviews','private.ai_task_review_commands'])
 await db.exec(table(name));
 await db.exec(`CREATE TABLE public.agreements(need_id uuid);CREATE TABLE public.need_selections(need_id uuid);
 CREATE TABLE public.marketplace_responses(need_id uuid,status text);
 CREATE FUNCTION private.need_edit_base_marker(uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT revision::text FROM public.needs WHERE id=$1 $$;
 CREATE FUNCTION private.validate_need_v2_fact(text,jsonb) RETURNS void LANGUAGE plpgsql AS $$ BEGIN END $$;
 CREATE FUNCTION private.taxonomy_handoff_display_v1(jsonb) RETURNS text LANGUAGE sql AS $$ SELECT 'No handoff'::text $$;
 CREATE FUNCTION private.resolved_location_record_valid(jsonb,text,jsonb,text,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 SELECT set_config('uskoci.r06_edit_resume.disposable','LOCAL_ONLY',false);`);
 await db.exec(pre.dependencies.find(x=>x.signature==='private.guard_need_edit_base_marker()').definition);
 await db.exec(`CREATE TRIGGER guard_need_edit_base_marker_trg BEFORE INSERT OR UPDATE ON public.ai_conversations
 FOR EACH ROW EXECUTE FUNCTION private.guard_need_edit_base_marker();
 INSERT INTO private.need_fact_registry VALUES('need.description','NEED_FACT_V2','TEXT',true,'PUBLIC',true,'NEED');
 CREATE FUNCTION private.test_closure_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM private.closure_assert_open(NEW.account_id);RETURN NEW;END $$;
 CREATE TRIGGER test_closure BEFORE INSERT ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION private.test_closure_guard();`);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.query(`INSERT INTO public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,execution_location_mode)
 VALUES($1,$2,$3,'PUBLISHED','Test title','Original description','Proofreading','MY_PRICE','REMOTE')`,[need,owner,id(4)]);
 await db.exec(patched?candidate:pre.function.definition);
 return db;
}
async function message(db,cid,body='Keep my changes'){
 await db.query("INSERT INTO public.ai_messages(account_id,conversation_id,role,body) VALUES($1,$2,'USER',$3)",[owner,cid,body]);
}
test('preimage reproduces a second conversation and facts on the same edit action',async t=>{
 const db=await setup(t,false),a=await open(db),b=await open(db);assert.notEqual(a.conversationId,b.conversationId);
});
test('reopen returns the same compatible edit and preserves facts/messages byte for byte',async t=>{
 const db=await setup(t),a=await open(db);await message(db,a.conversationId);
 await db.exec("UPDATE public.ai_structured_facts SET fact_value=to_jsonb('Changed description'::text)");
 const before=await one(db,'SELECT (SELECT jsonb_agg(to_jsonb(f)) FROM public.ai_structured_facts f) facts,(SELECT jsonb_agg(to_jsonb(m)) FROM public.ai_messages m) messages');
 assert.deepEqual(await open(db),a);
 assert.deepEqual(await one(db,'SELECT (SELECT jsonb_agg(to_jsonb(f)) FROM public.ai_structured_facts f) facts,(SELECT jsonb_agg(to_jsonb(m)) FROM public.ai_messages m) messages'),before);
});
test('legacy duplicate with no messages cannot hide an earlier real conversation',async t=>{
 const db=await setup(t,false),a=await open(db);await message(db,a.conversationId);const b=await open(db);
 await db.exec(candidate);assert.equal((await open(db)).conversationId,a.conversationId);
 await message(db,b.conversationId,'Newer actual change');assert.equal((await open(db)).conversationId,b.conversationId);
});
for(const state of ['COMPLETED','ABANDONED'])test('does not reopen '+state+' conversation',async t=>{
 const db=await setup(t),a=await open(db);await db.query('UPDATE public.ai_conversations SET status=$1',[state]);
 assert.notEqual((await open(db)).conversationId,a.conversationId);
});
test('stale base remains untouched and a fresh conversation uses the current revision',async t=>{
 const db=await setup(t),a=await open(db);await message(db,a.conversationId);
 await db.exec('UPDATE public.needs SET revision=2');const b=await open(db);
 assert.notEqual(b.conversationId,a.conversationId);assert.equal(b.revision,2);
 assert.equal((await one(db,'SELECT count(*)::int n FROM public.ai_messages')).n,1);
 assert.equal((await open(db)).conversationId,b.conversationId);
});
test('another account and a closing account cannot resume a compatible conversation',async t=>{
 const db=await setup(t);await open(db);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);await assert.rejects(open(db),/NEED_NOT_OWNED/);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.exec("SELECT set_config('test.closed','true',false)");await assert.rejects(open(db),/ACCOUNT_CLOSING/);
});
test('consumed review command never resumes even if conversation state is inconsistent',async t=>{
 const db=await setup(t),a=await open(db);
 await db.query(`INSERT INTO private.ai_task_reviews(id,account_id,conversation_id,requester_profile_id,source_hash,policy_binding,envelope,expires_at)
 VALUES($1,$2,$3,$4,'synthetic','{}','{}',now()+interval '10 minutes')`,[id(10),owner,a.conversationId,id(4)]);
 await db.query(`INSERT INTO private.ai_task_review_commands(review_id,account_id,client_request_id,need_id,need_revision,state)
 VALUES($1,$2,$3,$4,1,'ACCEPTED')`,[id(10),owner,id(11),need]);
 assert.notEqual((await open(db)).conversationId,a.conversationId);
});
test('cancelled task and first Agreement still prevent any edit recovery',async t=>{
 const db=await setup(t);await open(db);
 await db.exec("UPDATE public.needs SET status='CANCELLED'");await assert.rejects(open(db),/NEED_NOT_EDITABLE_PUBLIC_STATE/);
 await db.exec("UPDATE public.needs SET status='PUBLISHED'");await db.query('INSERT INTO public.agreements VALUES($1)',[need]);
 await assert.rejects(open(db),/NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR/);
});
test('missing login, wrong schema and absent base marker cannot reuse old content',async t=>{
 const db=await setup(t),a=await open(db);
 await db.exec("SELECT set_config('request.jwt.claim.sub','',false)");await assert.rejects(open(db),/AUTH_REQUIRED/);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
 // Corrupt historical fixture only; the real immutable trigger forbids this.
 await db.exec("ALTER TABLE public.ai_conversations DISABLE TRIGGER guard_need_edit_base_marker_trg;UPDATE public.ai_conversations SET fact_schema_version='LEGACY',need_edit_base_fingerprint=null;ALTER TABLE public.ai_conversations ENABLE TRIGGER guard_need_edit_base_marker_trg");
 assert.notEqual((await open(db)).conversationId,a.conversationId);
});
test('rollback restores exact original body and reapply restores resume',async t=>{
 const db=await setup(t),a=await open(db);
 const attrs=await one(db,"SELECT to_jsonb(p)-'prosrc' attrs FROM pg_proc p WHERE oid='public.rpc_ai_open_need_edit_conversation_v2(uuid)'::regprocedure");
 await db.exec(pre.function.definition);
 assert.equal((await one(db,"SELECT md5(pg_get_functiondef('public.rpc_ai_open_need_edit_conversation_v2(uuid)'::regprocedure)) hash")).hash,pre.function.md5);
 assert.deepEqual(await one(db,"SELECT to_jsonb(p)-'prosrc' attrs FROM pg_proc p WHERE oid='public.rpc_ai_open_need_edit_conversation_v2(uuid)'::regprocedure"),attrs);
 await db.exec(candidate);assert.equal((await open(db)).conversationId,a.conversationId);
});

