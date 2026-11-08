'use strict';
// R09/F20: captured real matcher, dispatch, submit and push transport owners.
// Synthetic SQL only. No hosted access, real Auth session, Expo or device call.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const base=require('./r09-worker-activation-fixture.cjs');
const read=name=>fs.readFileSync(path.join(__dirname,'sql',name),'utf8');
const dependencies=JSON.parse(read('r09_applicant_suppression_20261108.dependencies.json'));
const preimage=JSON.parse(read('r09_applicant_suppression_20261108.preimage.json'));
const source=read('r09_applicant_suppression_20261108.sql');
const candidate=source.slice(source.indexOf('-- R09_APPLICANT_ISOLATED_MIGRATION_START'));
const rollbackSource=read('r09_applicant_suppression_20261108.rollback.sql');
const rollback=rollbackSource.slice(rollbackSource.indexOf('-- R09_APPLICANT_ROLLBACK_ISOLATED_MIGRATION_START'));
const qualify=name=>name.includes('.')?name:'public.'+name;
const signature=name=>qualify(name).replace('(notification_deliveries)','(public.notification_deliveries)')
 .replace('(user_activity_events)','(public.user_activity_events)').replace('(needs,','(public.needs,');
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const md5=s=>crypto.createHash('md5').update(s).digest('hex');

async function fixture(options={}) {
 const f=await base.fixture(options),db=f.db;
 try {
  await f.installProfileGuard();
  await db.exec(base.candidate);
  // The narrow Auth schema is a shape seam; push_session_valid itself is the
  // exact captured owner. No signed user session or API behavior is claimed.
  await db.exec(`create table auth.users(id uuid primary key,deleted_at timestamptz,banned_until timestamptz);
   create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);`);
  for(const t of dependencies.tables) {
   const name=qualify(t.name);
   if(!await f.value('select to_regclass($1) is not null as value',[name])) {
    await db.exec(`create table ${name} (${t.columns.map(c=>`${quote(c.name)} ${c.type}${c.default?' default '+c.default:''}${c.not_null?' not null':''}`).join(',')});
     revoke all on ${name} from public,anon,authenticated,service_role;`);
    for(const c of t.constraints||[])await db.exec(`alter table ${name} add constraint ${quote(c.name)} ${c.definition};`);
   }
   for(const index of t.indexes||[]) {
    const name=index.match(/INDEX (\S+)/)[1],schema=qualify(t.name).split('.')[0];
    if(!await f.value('select to_regclass($1) is not null as value',[schema+'.'+name]))await db.exec(index);
   }
  }
  await db.exec('set check_function_bodies=off;');
  for(const fn of dependencies.functions) {
   const sig=signature(fn.identity);
   assert.equal(md5(fn.definition.split('AS $function$')[1].split('$function$')[0]),fn.body_md5,sig);
   await db.exec(fn.definition);
   // Reproduce the captured permissions exactly for the exercised roles.
   await db.exec(`revoke all on function ${sig} from public,anon,authenticated,service_role;`);
   for(const grant of (fn.acl||'').matchAll(/[,{](anon|authenticated|service_role)=X\//g))
    await db.exec(`grant execute on function ${sig} to ${grant[1]};`);
  }
  await db.exec('set check_function_bodies=on;');
  for(const fn of dependencies.consumer_freshness)assert.equal(await f.value(
   'select md5(prosrc) as value from pg_proc where oid=to_regprocedure($1)',[signature(fn.identity)]),fn.body_md5,fn.identity);
  let serial=0,deviceSerial=0;
  const actor=async(user,role='authenticated',client=db)=>client.query(
   "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[user||'',role]);
  const reset=async()=>{
   await db.exec(`reset role;reset request.jwt.claim.sub;reset request.jwt.claim.role;
    truncate public.notification_push_attempts,public.notification_push_devices,auth.sessions,auth.users,
     public.marketplace_response_versions,public.marketplace_responses,private.response_application_snapshots,private.response_submit_commands,
     public.user_activity_events,public.notification_deliveries,public.opportunity_deliveries,public.dispatch_rounds,private.dispatch_schedule;
    update public.needs set status='DRAFT';update public.worker_match_preferences set proactive_notifications=false;`);
  };
  const addPair=async(opts={})=>{
   const number=++serial;
   await f.addWorker(number,opts.worker||{});
   await f.addNeed(number,opts.need||{});
   return {number,user:base.workerId(number),profile:base.profileId(number),need:base.needId(number)};
  };
  const device=async(pair,opts={})=>{
   const number=++deviceSerial,id=base.id('d0000000',number),session=base.id('e0000000',number);
   await db.query('insert into auth.users(id) values($1) on conflict do nothing',[pair.user]);
   await db.query('insert into auth.sessions(id,user_id,not_after) values($1,$2,$3)',[session,pair.user,opts.expired?'2020-01-01T00:00:00Z':null]);
   await db.query(`insert into public.notification_push_devices(id,user_id,expo_push_token,platform,revision,bound_session_id,bound_revision)
    values($1,$2,$3,'ANDROID',0,$4,0)`,[id,pair.user,'ExpoPushToken[fixture'+String(number).padStart(20,'0')+']',session]);
   return {id,session};
  };
  const wave=async(pair,client=db)=>(await client.query('select private.dispatch_next_wave($1) as value',[pair.need])).rows[0].value;
  const gate=pair=>f.value('select private.dispatch_cheap_candidate_admitted($1,$2) as value',[pair.need,pair.profile]);
  const match=pair=>f.value('select private.worker_need_match_v1($1,$2) as value',[pair.need,pair.profile]);
  const responseAllowed=pair=>f.value("select (private.match_detail($1,$2)->>'responseAllowed')::boolean as value",[pair.need,pair.profile]);
  const submit=async(pair,opts={},client=db)=>{
   await actor(pair.user,'authenticated',client);
   return (await client.query('select public.rpc_submit_response($1,$2,$3,1,1200,null,null,$4,$5) as value',
    [pair.need,opts.revision||1,pair.profile,opts.scope||'Synthetic offer',opts.key||'f20-submit-'+pair.number])).rows[0].value;
  };
  const response=async(pair,opts={})=>(await db.query(`insert into public.marketplace_responses
   (need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,price_rsd,price_basis)
   values($1,$2,$3,$4,$5,$6,1200,'TOTAL') returning id`,
   [opts.need||pair.need,opts.user||pair.user,opts.profile||pair.profile,opts.kind||'OFFER',opts.status||'SUBMITTED',opts.revision||1])).rows[0].id;
  const pushDelivery=pair=>f.value("select id as value from public.notification_deliveries where recipient_user_id=$1 and channel='PUSH' order by created_at,id limit 1",[pair.user]);
  const suppression=id=>f.value('select private.push_suppression(d) as value from public.notification_deliveries d where d.id=$1',[id]);
  const claim=async(kind='SEND',client=db)=>{await actor(null,'service_role',client);return (await client.query('select public.rpc_claim_push_transport($1) as value',[kind])).rows[0].value;};
  const begin=async(a,client=db)=>{await actor(null,'service_role',client);return (await client.query('select public.rpc_begin_push_send($1,$2) as value',[a.attemptId,a.leaseId])).rows[0].value;};
  const complete=async(a,result,ticket=null,client=db)=>{await actor(null,'service_role',client);return (await client.query('select public.rpc_complete_push_transport($1,$2,$3,$4) as value',[a.attemptId,a.leaseId,result,ticket])).rows[0].value;};
  const ledger=()=>f.value(`select jsonb_build_object(
   'opportunities',(select count(*) from public.opportunity_deliveries),
   'events',(select count(*) from public.user_activity_events where event_type='OPPORTUNITY_AVAILABLE'),
   'push',(select count(*) from public.notification_deliveries where channel='PUSH'),
   'attempts',(select count(*) from public.notification_push_attempts),
   'sendCount',(select coalesce(sum(send_count),0) from public.notification_push_attempts),
   'duplicates',(select count(*) from (select worker_account_id,need_id,need_revision from public.opportunity_deliveries group by 1,2,3 having count(*)>1) x)) as value`);
  return {...f,actor,reset,addPair,device,wave,gate,match,responseAllowed,submit,response,pushDelivery,suppression,claim,begin,complete,ledger};
 } catch(error){await db.close();throw error;}
}
module.exports={fixture,source,candidate,rollbackSource,rollback,dependencies,preimage,signature,...Object.fromEntries(['id','needId','profileId','workerId'].map(k=>[k,base[k]]))};
