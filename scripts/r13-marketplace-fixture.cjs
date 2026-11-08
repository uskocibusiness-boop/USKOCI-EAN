'use strict';
// Real captured maintenance owners on the current R09/F20 fixture. All rows are
// synthetic. The isolated graph excludes external triggers and foreign keys;
// this is a transaction/lifecycle proof, not hosted promotion or legal approval.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const base=require('./r09-applicant-suppression-fixture.cjs');
const matcher=require('./r09-worker-activation-fixture.cjs');
const preimage=JSON.parse(fs.readFileSync(path.join(__dirname,'sql/r13_marketplace_20261108.preimage.json'),'utf8'));
const source=fs.readFileSync(path.join(__dirname,'sql/r13_marketplace_cooperative_candidate.sql'),'utf8');
const executable=source.slice(source.indexOf('-- R13_ISOLATED_TEST_MARKETPLACE_START'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const md5=x=>crypto.createHash('md5').update(x).digest('hex');
const qualify=x=>x.includes('.')?x:'public.'+x;
const quote=x=>'"'+x.replaceAll('"','""')+'"';
const uuid=()=>crypto.randomUUID(), HASH='a'.repeat(64);
const selectedTriggers={
 needs:['needs_guard_write','needs_guard_urgent','needs_enqueue_dispatch','needs_after_revision','needs_set_updated_at'],
 marketplace_responses:['guard_closed_remaining_search_response_trg','marketplace_responses_set_updated_at'],
 agreements:['agreements_set_updated_at'],agreement_execution:['agreement_execution_set_updated_at'],
 need_selections:['need_selections_set_updated_at']
};
async function fixture(options={}){
 const f=await base.fixture(options),db=f.db;
 try{
  await db.exec(base.candidate);
  assert.equal(await f.value("select md5(prosrc) as value from pg_proc where oid='private.dispatch_cheap_candidate_admitted(uuid,uuid)'::regprocedure"),'34dcf47d654d5960fbf7254c28745a04');
  await db.exec('set search_path=pg_catalog,public,extensions;set check_function_bodies=off');
  for(const t of preimage.relations){
   const name=qualify(t.name);
   if(!await f.value('select to_regclass($1) is not null as value',[name]))await db.exec('create table '+name+' ()');
   for(const c of t.columns){
    const old=(await db.query('select attidentity from pg_attribute where attrelid=$1::regclass and attname=$2 and not attisdropped',[name,c.name])).rows[0];
    if(!old)await db.exec('alter table '+name+' add column '+quote(c.name)+' '+c.type);
    if(c.not_null)await db.exec('alter table '+name+' alter column '+quote(c.name)+' set not null');
    if(c.identity&&!old?.attidentity)await db.exec('alter table '+name+' alter column '+quote(c.name)+' add generated '+(c.identity==='a'?'always':'by default')+' as identity');
    else if(c.default)await db.exec('alter table '+name+' alter column '+quote(c.name)+' set default '+c.default);
   }
   for(const c of t.constraints.filter(x=>x.type!=='f')){
    const exists=await f.value('select exists(select 1 from pg_constraint where conrelid=$1::regclass and (conname=$2 or ($3=\'p\' and contype=\'p\'))) as value',[name,c.name,c.type]);
    if(!exists)await db.exec('alter table '+name+' add constraint '+quote(c.name)+' '+c.definition);
   }
   await db.exec('revoke all on '+name+' from public,anon,authenticated,service_role');
  }
  for(const fn of preimage.functions){
   assert.equal(md5(fn.definition.split('AS $function$')[1].split('$function$')[0]),fn.body_md5,fn.signature);
   await db.exec(fn.definition);
   const sig=qualify(fn.signature);
   await db.exec('revoke all on function '+sig+' from public,anon,authenticated,service_role');
   for(const role of ['anon','authenticated','service_role'])if(fn.acl?.includes(role+'=X'))await db.exec('grant execute on function '+sig+' to '+role);
  }
  for(const index of preimage.supplemental_indexes){
   const existing=await f.value('select pg_get_indexdef(to_regclass($1)) as value',[index.schema+'.'+index.name]);
   if(existing)assert.equal(existing,index.definition,'captured index drift: '+index.name);
   else await db.exec(index.definition);
  }
  await db.exec('set check_function_bodies=on');
  await db.exec(executable);
  const installed=[];
  f.installLifecycleGuards=async()=>{
   for(const [table,names]of Object.entries(selectedTriggers)){
    const captured=matcher.capture.relations.find(t=>qualify(t.name)==='public.'+table);
    for(const name of names){
     const trigger=captured.triggers.find(x=>x.name===name);assert.ok(trigger,'captured selected trigger '+name);
     await db.exec(trigger.definition);installed.push({table,name});
    }
   }
  };
  f.dropLifecycleGuards=async()=>{
   for(const {table,name}of installed.splice(0))await db.exec('drop trigger '+name+' on public.'+table);
  };
  await db.exec("create table private.r13_marketplace_probe(sequence bigint generated always as identity,phase text,entity_id uuid,txid xid8);" +
   "create function private.r13_marketplace_probe() returns trigger language plpgsql as $$begin " +
   "insert into private.r13_marketplace_probe(phase,entity_id,txid) values(TG_ARGV[0],(to_jsonb(NEW)->>TG_ARGV[1])::uuid,pg_current_xact_id());return NEW;end$$;" +
   "create trigger r13_probe_expiry after update on public.needs for each row when (old.status is distinct from new.status and new.status='EXPIRED') execute function private.r13_marketplace_probe('EXPIRY','id');" +
   "create trigger r13_probe_dispatch after insert on public.opportunity_deliveries for each row execute function private.r13_marketplace_probe('DISPATCH','need_id');" +
   "create trigger r13_probe_completion after update on public.agreements for each row when (old.status is distinct from new.status and new.status='COMPLETED') execute function private.r13_marketplace_probe('COMPLETION','id');" +
   "create trigger r13_probe_export after update on public.data_export_requests for each row when (old.status is distinct from new.status and new.status='EXPIRED') execute function private.r13_marketplace_probe('EXPORT','id');" +
   "create trigger r13_probe_ai after update on private.ai_need_turn_commands for each row when (old.state is distinct from new.state) execute function private.r13_marketplace_probe('AI','turn_id');");
  const inheritedReset=f.reset;
  f.reset=async()=>{
   await f.dropLifecycleGuards();
   await db.exec('truncate public.agreement_execution,public.agreements,public.need_selections,public.agreement_change_proposals,'+
    'public.data_export_requests,private.data_export_artifacts,private.marketplace_audit_log,'+
    'private.ai_need_turn_commands,private.worker_ai_turns,private.qa_ai_commands,private.ai_task_review_commands,'+
    'public.ai_conversations,private.retention_jobs,private.retention_scan_cursors,private.retention_policy_sets,private.r13_marketplace_probe');
   await inheritedReset();
   await db.exec("update private.marketplace_config set value=jsonb_set(value,'{tickBudgetSeconds}','40') where key='match_v1_dispatch'");
  };
  f.call=(batch=25,client=db)=>client.query('call private.marketplace_cooperative_candidate($1,statement_timestamp())',[batch]);
  f.probes=()=>db.query('select phase,entity_id,txid::text as txid from private.r13_marketplace_probe order by sequence').then(r=>r.rows);
  f.seedCompletion=async(pair)=>{
   await db.query("update public.needs set status='ACTIVE' where id=$1",[pair.need]);
   const response=await f.response(pair,{status:'SELECTED'});
   const owner=(await db.query('select requester_account_id,requester_profile_id from public.needs where id=$1',[pair.need])).rows[0];
   const selection=await f.value("insert into public.need_selections(need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,response_id,worker_account_id,worker_profile_id,selection_mode) values($1,1,$2,$3,1,$4,$5,$6,'REQUESTER_SELECTS') returning id as value",[pair.need,owner.requester_account_id,'r13-complete-'+pair.number,response,pair.user,pair.profile]);
   const agreement=await f.value('insert into public.agreements(need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,worker_account_id,worker_profile_id) values($1,$2,$3,$4,$5,$6,$7) returning id as value',[pair.need,selection,response,owner.requester_account_id,owner.requester_profile_id,pair.user,pair.profile]);
   await db.query("insert into public.agreement_execution(agreement_id,agreement_version,state,requester_deadline_at) values($1,1,'AWAITING_REQUESTER',statement_timestamp()-interval '1 minute')",[agreement]);
   return agreement;
  };
  f.seedExport=async(account,opts={})=>{
   const receipt=uuid(),artifact=uuid(),snapshot='{"synthetic":"r13 local transaction proof"}';
   // No policy publication/certificate is fabricated: retention_execution is
   // NULL and the actual binding owner must continue returning NULL.
   let policy=await f.value('select id as value from private.retention_policy_sets where retired_at is null');
   if(!policy){policy=uuid();await db.query("insert into private.retention_policy_sets(id,policy_version,counsel_reference,effective_at) values($1,$2,'ISOLATED_TEST_NO_LEGAL_APPROVAL',statement_timestamp()-interval '1 day')",[policy,'r13-'+policy]);}
   await db.query("insert into public.data_export_requests(id,account_id,client_request_id,status,completed_at,active_export_attempt_id) values($1,$2,$3,'READY',statement_timestamp()-interval '2 hours',$4)",[receipt,account,'r13_export_'+receipt.replaceAll('-',''),artifact]);
   await db.query("insert into private.data_export_artifacts(id,receipt_id,account_id,attempt_number,policy_id,policy_sha256,policy_binding,snapshot_text,byte_length,sha256,md5,object_path,lease_until,artifact_expires_at,snapshot_expires_at,download_grant_id,download_grant_expires_at,cleanup_not_before) "+
    "values($1,$2,$3,1,$4,$5,'{}',$6,$7,$8,$9,$10,statement_timestamp()+$11::interval,statement_timestamp()-interval '1 hour',statement_timestamp()-interval '1 hour',$12,statement_timestamp()+interval '1 hour',statement_timestamp()+interval '1 day')",
    [artifact,receipt,account,policy,HASH,snapshot,Buffer.byteLength(snapshot),sha(snapshot),md5(snapshot),account+'/'+receipt+'/'+artifact+'.json',opts.activeLease?'1 hour':'-1 hour',uuid()]);
   return {receipt,artifact};
  };
  f.seedAI=async(pair,{reviews=1}={})=>{
   const conversation=await f.value("insert into public.ai_conversations(account_id,purpose,status,retention_unbound_origin,retention_abandoned_at) values($1,'NEED_INTAKE','ABANDONED',true,statement_timestamp()-interval '30 days') returning id as value",[pair.user]);
   const ids={conversation,stale:uuid(),fresh:uuid(),workerStale:uuid(),workerFresh:uuid(),qaStale:uuid(),qaFresh:uuid()};
   for(const [key,lease]of [['stale','-20 minutes'],['fresh','1 minute']])await db.query("insert into private.ai_need_turn_commands(account_id,client_request_id,conversation_id,turn_id,request_hash,state,context_hash,attempt_id,lease_expires_at,provider_dispatched) values($1,$2,$3,$4,$5,'PROCESSING',$5,$6,statement_timestamp()+$7::interval,true)",[pair.user,uuid(),conversation,ids[key],HASH,uuid(),lease]);
   for(const [key,lease]of [['workerStale','-20 minutes'],['workerFresh','1 minute']])await db.query("insert into private.worker_ai_turns(turn_id,account_id,conversation_id,client_request_id,body_hash,source_revision,state,lease_expires_at,provider_dispatched) values($1,$2,$3,$4,$5,1,'PROCESSING',statement_timestamp()+$6::interval,true)",[ids[key],pair.user,conversation,uuid(),HASH,lease]);
   for(const [key,lease]of [['qaStale','-20 minutes'],['qaFresh','1 minute']])await db.query("insert into private.qa_ai_commands(id,account_id,client_request_id,command_type,need_id,need_revision,text_sha256,request_hash,state,attempt_id,lease_expires_at,provider_dispatched) values($1,$2,$3,'ASK',$4,1,$5,$5,'PROCESSING',$6,statement_timestamp()+$7::interval,true)",[ids[key],pair.user,uuid(),pair.need,HASH,uuid(),lease]);
   for(let n=0;n<reviews;n++)await db.query("insert into private.ai_task_review_commands(review_id,account_id,client_request_id,need_id,need_revision,state,attempt_id,lease_expires_at,evaluation_binding) values($1,$2,$3,$4,1,'EVALUATING',$5,statement_timestamp()-interval '1 minute','{}')",[uuid(),pair.user,uuid(),pair.need,uuid()]);
   return ids;
  };
  f.businessSnapshot=()=>f.value("select jsonb_build_object("+
   "'needs',(select jsonb_agg(jsonb_build_object('id',id,'status',status) order by id) from public.needs where status<>'DRAFT'),"+
   "'responses',(select jsonb_agg(jsonb_build_object('id',id,'status',status) order by id) from public.marketplace_responses),"+
   "'opportunities',(select count(*) from public.opportunity_deliveries),"+
   "'events',(select count(*) from public.user_activity_events),"+
   "'agreements',(select jsonb_agg(jsonb_build_object('id',id,'status',status) order by id) from public.agreements),"+
   "'exports',(select jsonb_agg(jsonb_build_object('id',id,'status',status) order by id) from public.data_export_requests),"+
   "'audit',(select count(*) from private.marketplace_audit_log),"+
   "'needStates',(select jsonb_agg(state order by turn_id) from private.ai_need_turn_commands),"+
   "'workerStates',(select jsonb_agg(state order by turn_id) from private.worker_ai_turns),"+
   "'qaStates',(select jsonb_agg(state order by id) from private.qa_ai_commands),"+
   "'reviewStates',(select jsonb_agg(state order by review_id) from private.ai_task_review_commands)) as value");
  await f.reset();return f;
 }catch(error){await db.close();throw error;}
}
module.exports={fixture,source,executable,preimage,sha,selectedTriggers};

