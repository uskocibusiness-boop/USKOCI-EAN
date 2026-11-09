'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const base=require('./r09-worker-activation-fixture.cjs');
const preimage=JSON.parse(fs.readFileSync(path.join(__dirname,'sql/r06_pre_provider_input_20261108.preimage.json'),'utf8'));
const source=fs.readFileSync(path.join(__dirname,'sql/r06_pre_provider_input_20261108.sql'),'utf8');
const candidate=source.slice(source.indexOf('-- R06_PRE_PROVIDER_ISOLATED_START'));
const sig=x=>x.identity.includes('.')?x.identity:'public.'+x.identity;
const q=s=>'"'+s.replaceAll('"','""')+'"';
const A='a1000000-0000-4000-8000-000000000001',C='a2000000-0000-4000-8000-000000000001',R='a3000000-0000-4000-8000-000000000001',ATT='a4000000-0000-4000-8000-000000000001',T='a5000000-0000-4000-8000-000000000001',P='a6000000-0000-4000-8000-000000000001';
const TEXT='Synthetic authorized current text';
const input=(purpose='NEED_SERVICE')=>({schemaVersion:'R06_TEXT_INPUT_V1',model:'gemini-3.8-flash',userText:TEXT,catalog:null,runtime:{decoder:'ISOLATED_TEXT_CONTRACT_V1',clock:'2026-11-08T00:00:00Z',
 sourceContext:purpose==='NEED_SERVICE'?{schemaVersion:'NEED_FACT_V2',history:[],activeFacts:[]}:
  {schemaVersion:'WORKER_PROFILE_V1',accountId:A,conversationId:C,status:'OPEN',safety:'ALLOW',stale:false,revision:1,
   candidate:{skills:[],bio:'Synthetic current biography'},messages:[{id:T,role:'USER',body:TEXT,sequence:1}],
   serviceModeContext:{savedServices:[],draftServices:[],unresolvedServices:[]}}},
 providerRequest:{systemInstruction:{parts:[{text:'Synthetic fixed instruction, no secret'}]},contents:[{role:'user',parts:[{text:TEXT}]}],
 generationConfig:{temperature:0.2,maxOutputTokens:2048,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{answer:{type:'STRING'}}},thinkingConfig:{thinkingBudget:0}}}});
async function fixture(options={}){
 const f=await base.fixture(options),db=f.db;
 try{
  await f.installProfileGuard();await db.exec(base.candidate);
  await db.exec(`create table if not exists auth.users(id uuid primary key,deleted_at timestamptz);
   create or replace function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
   create table private.fixture_provider_sends(purpose text,request_id uuid,attempt_id uuid,body jsonb);`);
  for(const table of [...preimage.tables,...JSON.parse(fs.readFileSync(path.join(__dirname,'sql/r06_pre_provider_input_20261108.budget-schema.json'),'utf8'))]){
   if(!await f.value('select to_regclass($1) is not null as value',[table.identity]))
    await db.exec(`create table ${table.identity} (${table.columns.map(c=>q(c.name)+' '+c.type).join(',')})`);
   for(const c of table.columns){
    if(c.default)await db.exec(`alter table ${table.identity} alter column ${q(c.name)} set default ${c.default}`);
    if(c.not_null)await db.exec(`alter table ${table.identity} alter column ${q(c.name)} set not null`);
   }
   for(const c of table.constraints||[])if(!c.definition.startsWith('FOREIGN KEY')){
    const existing=await f.value('select pg_get_constraintdef(oid) as value from pg_constraint where conrelid=to_regclass($1) and conname=$2',[table.identity,c.name]);
    if(existing)assert.equal(existing,c.definition);else await db.exec(`alter table ${table.identity} add constraint ${q(c.name)} ${c.definition}`);
   }
   await db.exec(`alter table ${table.identity} enable row level security;revoke all on ${table.identity} from public,anon,authenticated,service_role;`);
  }
  await db.exec('set check_function_bodies=off');
  for(const fn of preimage.functions){
   assert.equal(crypto.createHash('md5').update(fn.definition.split('AS $function$')[1].split('$function$')[0]).digest('hex'),fn.body_md5);
   await db.exec(fn.definition);await db.exec(`revoke all on function ${sig(fn)} from public,anon,authenticated,service_role`);
   for(const grant of (fn.acl||'').matchAll(/[,{](anon|authenticated|service_role)=X\//g))await db.exec(`grant execute on function ${sig(fn)} to ${grant[1]}`);
  }
  // Complete the earlier R10 work-area fixture with the exact source adapter
  // and projector. The subsequent full migration validates their joined digest.
  const workAreas=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261107165752_r10_work_areas_projection_20261107.sql'),'utf8');
  await db.exec(workAreas.slice(workAreas.indexOf('CREATE FUNCTION private.data_export_worker_areas_v5'),workAreas.indexOf('-- Every existing dependency')));
  // Execute the canonical later R10 migration, including its original guards,
  // rather than testing R06 against the obsolete captured export definitions.
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261108225909_r10_owned_usage_projection_post_r09_20261108.sql'),'utf8'));
  // Narrow Worker context seams: profile projection/mode assembly are not the
  // unit under test. The captured read-context and both dispatch bodies execute
  // unchanged. Need context and all privacy projections execute real SQL.
  await db.exec(`create or replace function private.worker_ai_source_hash(aid uuid) returns text language sql stable security definer set search_path=pg_catalog as $$select repeat('a',64)$$;
   create or replace function private.worker_ai_document(cid uuid) returns jsonb language sql stable security definer set search_path=pg_catalog as $$
    select jsonb_build_object('schemaVersion','WORKER_PROFILE_V1','accountId',s.account_id,'conversationId',s.conversation_id,
    'status',c.status,'safety',s.safety,'stale',s.base_hash<>repeat('a',64),'revision',s.revision,'candidate',s.candidate,
    'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'role',m.role,'body',m.body,'sequence',m.sequence_no) order by m.sequence_no)
      from public.ai_messages m where m.conversation_id=cid),'[]'::jsonb))
    from private.worker_ai_sessions s join public.ai_conversations c on c.id=s.conversation_id where s.conversation_id=cid $$;
   create or replace function private.worker_ai_service_mode_context_v1(p_account_id uuid,p_conversation_id uuid) returns jsonb language sql stable security definer set search_path=pg_catalog as $$
    select jsonb_build_object('savedServices','[]'::jsonb,'draftServices','[]'::jsonb,'unresolvedServices','[]'::jsonb)$$;
   set check_function_bodies=on;`);
  const service=async()=>db.query("select set_config('request.jwt.claim.role','service_role',false)");
  const seed=async(purpose='NEED_SERVICE')=>{
   await db.exec(`reset role;truncate private.ai_need_turn_commands,private.worker_ai_turns,private.worker_ai_sessions,
    private.ai_test_reservations_v5,private.ai_test_budget_v5,private.ai_test_accounts_v5,private.ai_test_usage_v5,
    public.ai_conversations,public.ai_messages,public.ai_structured_facts,private.retention_holds,
    private.account_closure_requests,auth.users,private.fixture_provider_sends;`);
   await service();
   await db.query("insert into public.app_accounts(id,full_name) select $1,'R06 synthetic owner' where not exists(select 1 from public.app_accounts where id=$1)",[A]);
   await db.query('insert into auth.users(id) values($1)',[A]);
   await db.query('insert into private.ai_test_accounts_v5(account_id) values($1)',[A]);
   await db.exec('insert into private.ai_test_budget_v5(singleton,enabled) values(true,true)');
   await db.query(`insert into public.ai_conversations(id,account_id,purpose,fact_schema_version,status,created_at)
    values($1,$2,$3,'NEED_FACT_V2','OPEN',clock_timestamp())`,[C,A,purpose==='NEED_SERVICE'?'NEED_INTAKE':'PROFILE']);
   if(purpose==='NEED_SERVICE')await db.query(`insert into private.ai_need_turn_commands(account_id,client_request_id,conversation_id,
    turn_id,request_hash,state,context_hash,attempt_id,lease_expires_at)
    values($1,$2,$3,$4,private.ai_location_request_hash($3,$6,null),'PROCESSING',private.ai_need_turn_context($3)->>'sha256',$5,clock_timestamp()+interval '90 seconds')`,[A,R,C,T,ATT,TEXT]);
   else{
    await db.query(`insert into private.worker_ai_sessions(conversation_id,account_id,open_request_id,profile_id,base_hash,candidate,revision)
     values($1,$2,$3,$4,repeat('a',64),'{"skills":[],"bio":"Synthetic current biography"}',1)`,[C,A,R,P]);
    await db.query(`insert into private.worker_ai_turns(turn_id,account_id,conversation_id,client_request_id,body_hash,source_revision,attempt_id,state,lease_expires_at)
     values($1,$2,$3,$4,encode(extensions.digest($6,'sha256'),'hex'),1,$5,'PROCESSING',clock_timestamp()+interval '60 seconds')`,[T,A,C,R,ATT,TEXT]);
    await db.query(`insert into public.ai_messages(id,account_id,conversation_id,role,body,sequence_no) values($4,$1,$2,'USER',$3,1)`,[A,C,TEXT,T]);
   }
  };
  const prepare=(purpose='NEED_SERVICE',data=input(purpose),over={})=>f.value('select public.rpc_ai_prepare_input_service($1,$2,$3,$4,$5,$6) as value',
   [over.account||A,over.conversation||C,over.request||R,over.attempt||ATT,purpose,data]);
  const read=(purpose='NEED_SERVICE',over={})=>f.value('select public.rpc_ai_read_prepared_input_service($1,$2,$3,$4) as value',[over.account||A,over.conversation||C,over.request||R,purpose]);
  const dispatch=(purpose='NEED_SERVICE')=>f.value(`select public.${purpose==='NEED_SERVICE'?'rpc_ai_dispatch_need_turn_v2_service':'rpc_dispatch_worker_ai_turn_service'}($1,$2,$3,$4) as value`,[A,C,R,ATT]);
  const dispatchPrepared=(purpose='NEED_SERVICE',digest,over={})=>f.value('select public.rpc_ai_dispatch_prepared_input_service($1,$2,$3,$4,$5,$6) as value',
   [over.account||A,over.conversation||C,over.request||R,over.attempt||ATT,purpose,digest]);
  const snapshot=async(account=A)=>{
   const catalog=await f.value('select private.data_export_dataset_catalog() as value');
   const binding={policyId:'ISOLATED_NOT_APPROVED',policyVersion:'TEST',delivery:{datasets:catalog.map(x=>({key:x.key,mode:'INCLUDE',fields:x.fields}))}};
   return JSON.parse(await f.value('select private.data_export_snapshot($1,$2,$3,clock_timestamp()) as value',[account,T,binding]));
  };
  return {...f,seed,service,prepare,read,dispatch,dispatchPrepared,snapshot};
 }catch(e){await db.close();throw e;}
}
module.exports={fixture,source,candidate,preimage,input,A,C,R,ATT,T,P,TEXT};
