'use strict';
// Real captured matcher/activation/emitter SQL with synthetic data only. The
// optional native adapter adds real PostGIS. No network or push transport is
// installed. The PGlite adapter stores unused geography fields as text; tests
// never claim that its no-pin/city cases prove native geographic operators.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'sql',name),'utf8'));
const capture=read('r13_native_matcher_20261108.preimage.json');
const preimage=read('r09_worker_activation_20261108.preimage.json');
const exportSchema=read('r10_work_areas_projection_20261107.fixture-schema.json');
const exportFunctions=[...read('r10_work_areas_projection_20261107.preimage.json').functions,
 ...read('r10_work_areas_projection_20261107.dependencies.json').functions];
const source=fs.readFileSync(path.join(__dirname,'sql/r09_worker_activation_20261108.sql'),'utf8');
const candidate=source.slice(source.indexOf('-- R09_ISOLATED_TEST_MIGRATION_START'));
const cooperative=fs.readFileSync(path.join(__dirname,'sql/r13_dispatch_cooperative_candidate.sql'),'utf8');
const procedure=cooperative.slice(cooperative.indexOf('-- R13_ISOLATED_TEST_PROCEDURE_START'));
const id=(prefix,n)=>`${prefix}-0000-4000-8000-${String(n).padStart(12,'0')}`;
const REQUESTER=id('10000000',1),REQUESTER_PROFILE=id('20000000',1),CATEGORY=id('30000000',1);
const workerId=n=>id('50000000',n),profileId=n=>id('40000000',n),needId=n=>id('60000000',n);
const signature=f=>f.signature||`${f.name}(${f.arguments.split(', ').filter(Boolean).map(a=>a.slice(a.indexOf(' ')+1)).join(',')})`;
const qualify=n=>n.includes('.')?n:'public.'+n;
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const sqlLiteral=s=>"'"+s.replaceAll("'","''")+"'";
const bodyOf=f=>f.definition.split('AS $function$')[1].split('$function$')[0];
const value=async(db,q,a=[])=> (await db.query(q,a)).rows[0]?.value;

async function fixture(options={}) {
 const Driver=options.Driver;
 const db=Driver?new Driver():new PGlite({extensions:{pgcrypto}});
 try {
  await db.exec(`create schema private;create schema extensions;create schema auth;create schema storage;
   create role anon;create role authenticated;create role service_role;
   grant usage on schema public,auth,extensions to anon,authenticated,service_role;
   create extension pgcrypto with schema extensions;
   set search_path=pg_catalog,public,extensions;set check_function_bodies=off;`);
  if(options.native)await db.exec('create extension postgis with schema extensions;');
  else await db.exec('create domain extensions.geography as text;');

  // Merge exact current algorithm relations with the existing export-only
  // projection fixture. Foreign keys and external lifecycle/wake triggers are
  // deliberately outside this isolated boundary; no user/account rows reused.
  const tables=new Map([...capture.relations,...(preimage.fixture_relations||[])].map(t=>[qualify(t.name),t]));
  for(const t of exportSchema.tables)if(!tables.has(qualify(t.name)))tables.set(qualify(t.name),{
   name:t.name,relkind:'r',columns:t.columns.map(c=>({name:c.name,type:c.type_schema==='pg_catalog'?c.data_type:'text',not_null:false,default:null,generated:''})),constraints:[]});
  const later=[];
  for(const [name,t]of tables) {
   if(t.relkind==='v')continue;
   const columns=t.columns.map(c=>{
    let type=c.type.startsWith('geography')?(options.native?'extensions.'+c.type:'text'):c.type;
    let def=c.default;
    if(c.generated) {
     if(c.type.startsWith('geography'))return `${quote(c.name)} ${type} generated always as (${options.native?def:'NULL::text'}) stored`;
     later.push({table:name,column:c});
     return null;
    }
    return `${quote(c.name)} ${type}${def?' default '+def:''}${c.not_null?' not null':''}`;
   }).filter(Boolean);
   await db.exec(`create table ${name} (${columns.join(',')});revoke all on ${name} from public,anon,authenticated,service_role;`);
  }
  // Captured functions remain unchanged. Creating them with deferred checking
  // only permits installation order; every exercised branch resolves for real.
  const functions=new Map();
  for(const f of [...exportFunctions,...capture.functions,...preimage.functions])functions.set(signature(f),f);
  for(const [sig,f]of functions) {
   assert.equal(crypto.createHash('md5').update(bodyOf(f)).digest('hex'),f.body_md5,sig);
   await db.exec(f.definition);
   await db.exec(`revoke all on function ${sig} from public,anon,authenticated,service_role;`);
   for(const role of ['anon','authenticated','service_role'])if(f.acl?.includes(role+'=X'))await db.exec(`grant execute on function ${sig} to ${role};`);
  }
  for(const {table,column:c}of later)await db.exec(`alter table ${table} add column ${quote(c.name)} ${c.type} generated always as (${c.default}) stored;`);
  for(const [name,t]of tables)if(t.relkind==='v')await db.exec(`create view ${name} as ${t.view_definition};`);
  for(const [name,t]of tables)for(const c of t.constraints||[])await db.exec(`alter table ${name} add constraint ${quote(c.name)} ${c.definition};`);
  await db.exec(`
   create index dispatch_schedule_due_idx on private.dispatch_schedule(next_run_at,locked_until);
   create index worker_match_preferences_geo_fixture on public.worker_match_preferences(worker_profile_id);
   create index activity_recipient_fixture on public.user_activity_events(recipient_user_id,recipient_role,created_at desc);
   create index opportunity_deliveries_need_fixture on public.opportunity_deliveries(need_id,need_revision);
   create index opportunity_worker_fixture on public.opportunity_deliveries(worker_account_id,created_at);
   set check_function_bodies=on;`);
  await db.exec(procedure);
  for(const row of capture.marketplace_config)await db.query('insert into private.marketplace_config(key,value) values($1,$2)',[row.key,row.value]);
  await db.exec(`insert into private.marketplace_config(key,value) values
   ('match_v1_profile_requeue',jsonb_build_object('after',statement_timestamp()-interval '1 day','afterAccount','00000000-0000-0000-0000-000000000000'));
   insert into private.taxonomy_match_scope_control_v1(singleton,enabled) values(true,true);`);
  await db.exec("insert into private.location_market_configs values('RS','BUILDING','RSD','sr-Latn','Europe/Belgrade')");
  await db.query(`insert into public.app_accounts(id,full_name) values($1,'Synthetic requester');
   `,[REQUESTER]);
  await db.query(`insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,operating_country_code)
   values($1,$2,'REQUESTER','Synthetic requester','Novi Sad','ACTIVE','{}','RS')`,[REQUESTER_PROFILE,REQUESTER]);
  await db.query(`insert into private.account_lineage_v5(account_id,lineage,reason,source_ref) values($1,'SYNTHETIC_ACCEPTANCE_FIXTURE','Isolated SQL proof','R09/R13 isolated fixture')`,[REQUESTER]);
  await db.query(`insert into private.work_taxonomy_categories(id,label,canonical_key,state,source,catalog_version) values($1,'Sintetička usluga',private.taxonomy_normalize_v1('Sintetička usluga'),'ESTABLISHED','SYSTEM',1)`,[CATEGORY]);
  await db.query(`insert into private.work_taxonomy_category_modes(category_id,execution_scope,source_ref) values($1,'ON_SITE','Isolated SQL proof'),($1,'REMOTE','Isolated SQL proof')`,[CATEGORY]);
  for(const fact of ['skills','tools','vehicles','licenses'])await db.query(`insert into private.need_fact_registry(fact_key,schema_version,value_type,privacy_class,target_owner)
   values($1,'NEED_FACT_V2','TEXT_ARRAY','PUBLIC','needs')`,['need.required_'+fact]);

  async function addWorker(number,opts={}) {
   const account=workerId(number),profile=profileId(number),review=id('70000000',number),request=id('80000000',number),conversation=id('90000000',number);
   await db.query(`insert into public.app_accounts(id,full_name) values($1,$2)`,[account,'Synthetic worker '+number]);
   await db.query(`with permission as materialized(select set_config('uskoci.profile_mutation','LOCATION_REVIEW',true))
    insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,operating_country_code)
    select $1,$2,'WORKER',$3,'Novi Sad',$4,'{"Sintetička usluga"}','RS' from permission`,[profile,account,'Synthetic worker '+number,opts.status||'ACTIVE']);
   await db.query(`insert into private.account_lineage_v5(account_id,lineage,reason,source_ref) values($1,$2,'Isolated SQL proof','R09/R13 isolated fixture')`,[account,opts.world==='OTHER'?'REAL_USER':'SYNTHETIC_ACCEPTANCE_FIXTURE']);
   await db.query(`insert into public.worker_match_preferences(worker_profile_id,worker_account_id,approximate_lat,approximate_lng,proactive_notifications)
    values($1,$2,$3,$4,$5)`,[profile,account,options.native?(opts.latitude??45.25):null,options.native?(opts.longitude??19.84):null,opts.proactive!==false]);
   await db.query(`insert into private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,expires_at)
    values($1,$2,$3,1,'synthetic-base',$4,statement_timestamp()+interval '1 day')`,[review,account,conversation,{profile:{workAreas:opts.areas||[]}}]);
   await db.query(`insert into private.worker_ai_saves(review_id,account_id,client_request_id,receipt) values($1,$2,$3,'{}')`,[review,account,request]);
   await db.query(`insert into private.work_taxonomy_worker_capabilities(worker_account_id,category_id,confirmed_at,origin,excluded)
    values($1,$2,statement_timestamp(),'WORKER_CONFIRMED',$3)`,[account,CATEGORY,opts.excluded===true]);
   await db.query(`insert into private.worker_execution_mode_choices(worker_profile_id,worker_account_id,modes,confirmed_at) values($1,$2,$3,statement_timestamp())`,[profile,account,opts.modes||['ON_SITE','REMOTE']]);
   for(const mode of opts.modes||['ON_SITE','REMOTE'])await db.query(`insert into private.taxonomy_confirmed_worker_modes_v1(worker_account_id,category_id,execution_scope,source_review_id,source_request_key)
    values($1,$2,$3,$4,$5)`,[account,CATEGORY,mode,review,request]);
   await db.query(`insert into public.notification_preferences(user_id,role_context,push_enabled,quiet_hours_enabled,quiet_start,quiet_end)
    values($1,'WORKER',$2,$3,$4,$5)`,[account,opts.push!==false,opts.quiet===true,opts.quiet?'00:00':null,opts.quiet?'23:59:59':null]);
   if((opts.status||'ACTIVE')==='ACTIVE')await activate(number);
   return {account,profile,review,request};
  }
  async function addNeed(number,opts={}) {
   const nid=needId(number),remote=opts.mode==='REMOTE';
   // Default synthetic tasks are published after all workers already set up.
   // PGlite can give consecutive statements the same millisecond timestamp;
   // express that ordering explicitly without relaxing the real strict gate.
   // to_jsonb also works before the activation-clock migration adds its column.
   await db.query(`insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,category_id,
    execution_location_mode,schedule_kind,published_at,approximate_city,approximate_lat,approximate_lng,task_country_code,task_timezone,mode)
    values($1,$2,$3,'PUBLISHED',$4,'Synthetic isolated SQL task','Sintetička usluga',$5,$6,$7,
    coalesce($8::timestamptz,greatest(clock_timestamp(),
     (select max((to_jsonb(p)->>'worker_dispatch_eligible_since')::timestamptz)+interval '1 microsecond' from public.app_profiles p))),
    $9,$10,$11,'RS','Europe/Belgrade','OFFERS')`,
    [nid,REQUESTER,REQUESTER_PROFILE,'Synthetic task '+number,CATEGORY,opts.mode||'STATIONARY',opts.schedule||'FLEXIBLE',opts.publishedAt||null,remote?'':'Novi Sad',!remote&&options.native?45.25:null,!remote&&options.native?19.84:null]);
   await db.query(`insert into private.work_taxonomy_need_snapshots(need_id,need_revision,category_id,catalog_version,reviewed_by_requester,source,classification_state)
    values($1,1,$2,1,true,'REQUESTER_CORRECTED','CONFIRMED')`,[nid,CATEGORY]);
   await db.query(`insert into private.dispatch_schedule(need_id,next_run_at) values($1,statement_timestamp()-interval '1 minute')`,[nid]);
   return nid;
  }
  const activate=async number=>{
   await db.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)`,[workerId(number)]);
   await db.query('select private.complete_worker_profile_v1($1,null,null)',[profileId(number)]);
   await db.exec("reset request.jwt.claim.sub;reset request.jwt.claim.role;");
  };
  const installProfileGuard=async()=>{
   const table=capture.relations.find(t=>qualify(t.name)==='public.app_profiles');
   for(const trigger of table.triggers.filter(t=>t.definition.includes(' BEFORE ')))await db.exec(trigger.definition);
  };
  const counts=()=>value(db,`select jsonb_build_object('opportunities',(select count(*) from public.opportunity_deliveries),
   'events',(select count(*) from public.user_activity_events where event_type='OPPORTUNITY_AVAILABLE'),
   'push',(select count(*) from public.notification_deliveries where channel='PUSH'),
   'inApp',(select count(*) from public.notification_deliveries where channel='IN_APP'),
   'duplicates',(select count(*) from (select worker_account_id,need_id,need_revision from public.opportunity_deliveries group by 1,2,3 having count(*)>1) x)) as value`);
  return {db,value:(q,a)=>value(db,q,a),addWorker,addNeed,activate,installProfileGuard,counts,
   installedFunctionCount:functions.size,isolatedRelationCount:tables.size};
 }catch(error){await db.close();throw error;}
}
module.exports={fixture,value,source,candidate,procedure,preimage,capture,id,workerId,profileId,needId,REQUESTER,CATEGORY,sqlLiteral};
