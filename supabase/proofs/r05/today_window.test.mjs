// Pure synthetic PostgreSQL timezone/interval math; NOT real match/dispatch.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

test('TODAY local end, availability, blackout and DST matrix (11 cases)',async()=>{
 const db=new PGlite();
 try{
   const source=readFileSync(new URL('./today_window_synthetic.sql',import.meta.url),'utf8');
   const statements=await db.exec(source);
   const row=statements.flatMap(x=>x.rows??[]).find(r=>r.capture)?.capture;
   assert(row,'synthetic timeline capture required');
   assert.equal(row.unit,'R05_TODAY_FLEXIBLE_SYNTHETIC_DAY_MATRIX');
   assert.equal(row.cases,11);
   assert.deepEqual(row.mismatches,[]);
   const values=new Map(row.results.map(r=>[r.label,r]));
   assert.deepEqual([values.get('spring_DST_23h').tier,values.get('spring_DST_23h').hours],[2,23]);
   assert.deepEqual([values.get('fall_DST_25h').tier,values.get('fall_DST_25h').hours],[2,25]);
   assert.equal(values.get('expired_next_midnight').tier,null);
   assert.equal(values.get('later_today').tier,2);
   assert.equal(values.get('fully_blocked').tier,null);
 } finally {await db.close();}
});

// Execute the actual candidate function body and captured calendar helpers in
// an in-memory database with minimal synthetic tables. This is not the guarded
// DO application, current-schema/Auth admission, a matcher or a dispatch proof.
const bootstrap=readFileSync(new URL('../privacy/bootstrap/current-application.sql',import.meta.url),'utf8');
function capturedFunction(name,bodyMd5){
 const marker=`CREATE OR REPLACE FUNCTION private.${name}(`;
 assert.equal(bootstrap.split(marker).length,2,`one captured ${name}`);
 const start=bootstrap.indexOf(marker),end=bootstrap.indexOf('$function$;',start);
 assert(end>start,`complete captured ${name}`);
 const source=bootstrap.slice(start,end+'$function$;'.length).replaceAll('\r\n','\n');
 if(bodyMd5){
   const body=source.split('AS $function$')[1].split('$function$;')[0];
   assert.equal(createHash('md5').update(body).digest('hex'),bodyMd5,`${name} source pin`);
 }
 return source;
}
const candidateSource=readFileSync(new URL('../../candidates/r05_today_flexible_time_tier.sql',import.meta.url),'utf8');
const candidateBodies=[...candidateSource.matchAll(/target_body CONSTANT text := \$r05_body\$([\s\S]*?)\$r05_body\$;/g)];
assert.equal(candidateBodies.length,1,'one actual candidate body');
const candidateBody=candidateBodies[0][1];
const candidatePin=candidateSource.match(/IF md5\(target_body\) IS DISTINCT FROM '([a-f0-9]{32})'/)?.[1];
assert.equal(createHash('md5').update(candidateBody).digest('hex'),candidatePin,'candidate body pin');
const worker='11111111-1111-4111-8111-111111111111';
const need='22222222-2222-4222-8222-222222222222';

test('actual R05 body admits the free remainder of started TODAY without weakening fixed windows',async t=>{
 const db=new PGlite();
 try{
   await db.exec(`SET TIME ZONE 'UTC'; CREATE SCHEMA private;
     CREATE TABLE public.needs(id uuid,schedule_kind text,starts_at timestamptz,ends_at timestamptz,published_at timestamptz,task_timezone text);
     CREATE TABLE public.app_profiles(id uuid,kind text,profile_status text,available_now boolean);
     CREATE TABLE public.worker_match_preferences(worker_profile_id uuid,timezone text);
     CREATE TABLE public.profile_availability_rules(profile_id uuid,active boolean,weekdays integer[],start_time time,end_time time,starts_on date,ends_on date);
     CREATE TABLE public.profile_availability_windows(profile_id uuid,availability_state text,starts_at timestamptz,ends_at timestamptz);
     CREATE TABLE private.worker_calendar_events(worker_profile_id uuid,state text,starts_at timestamptz,ends_at timestamptz,agreement_id uuid);
     ${capturedFunction('availability_timezone_valid')}
     ${capturedFunction('availability_is_future','3a1aee763e9fe3d0f06d6ba04ef21aac')}
     ${capturedFunction('worker_available_periods','5107af3020a3beb7bb45e6e90e7a203b')}
     ${capturedFunction('worker_calendar_conflict')}
     ${capturedFunction('schedule_fit')}
     CREATE FUNCTION private.worker_need_time_tier_v1(nid uuid,pid uuid)
       RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
       AS $actual_body$${candidateBody}$actual_body$;`);
   const scenarios=[
     {name:'started TODAY, explicit availability later',expected:2},
     {name:'started TODAY, partly unavailable but remainder free',expected:2,unavailable:[25,45]},
     {name:'started TODAY, current calendar block ends before later availability',expected:2,live:true,blocking:[-5,10]},
     {name:'started TODAY, all availability unavailable',expected:null,unavailable:[10,40]},
     {name:'started TODAY, all availability blocked by Agreement',expected:null,blocking:[10,40]},
     {name:'started TODAY, availability only before now',expected:null,available:[-40,-20]},
     {name:'started TODAY, no saved availability',expected:null,available:null},
     {name:'started TODAY, live worker without a current block',expected:1,live:true,available:null},
     {name:'expired TODAY is rejected even for live worker',expected:null,end:-1,live:true},
     {name:'future TODAY still admits partial availability',expected:2,start:10},
     {name:'started FIXED requires full remaining coverage',expected:null,kind:'FIXED_WINDOW'},
     {name:'future FIXED requires full interval coverage',expected:null,kind:'FIXED_WINDOW',start:10},
     {name:'future FIXED full coverage remains admitted',expected:2,kind:'FIXED_WINDOW',start:10,available:[5,70]},
     {name:'inactive worker never admitted',expected:null,status:'DRAFT'},
     {name:'invalid worker timezone never admitted',expected:null,zone:'not/a-zone'},
     {name:'nonfinite started TODAY is rejected even for live worker',expected:null,start:'-infinity',live:true},
     {name:'nonfinite TODAY end is rejected even for live worker',expected:null,end:'infinity',live:true},
   ];
   for(const scenario of scenarios) await t.test(scenario.name,async()=>{
     await db.exec(`TRUNCATE public.needs,public.app_profiles,public.worker_match_preferences,
       public.profile_availability_rules,public.profile_availability_windows,private.worker_calendar_events;`);
     const {rows:[{now}]}=await db.query('SELECT statement_timestamp() AS now');
     const stamp=minutes=>typeof minutes==='string'?minutes:new Date(new Date(now).getTime()+minutes*60_000).toISOString();
     await db.query('INSERT INTO public.needs VALUES($1,$2,$3,$4,$5,$6)',
       [need,scenario.kind??'TODAY_FLEXIBLE',stamp(scenario.start??-60),stamp(scenario.end??60),stamp(-120),'UTC']);
     await db.query('INSERT INTO public.app_profiles VALUES($1,$2,$3,$4)',[worker,'WORKER',scenario.status??'ACTIVE',scenario.live??false]);
     await db.query('INSERT INTO public.worker_match_preferences VALUES($1,$2)',[worker,scenario.zone??'UTC']);
     const available=scenario.available===undefined?[20,30]:scenario.available;
     for(const [kind,bounds] of [['AVAILABLE',available],['UNAVAILABLE',scenario.unavailable]]) if(bounds){
       await db.query('INSERT INTO public.profile_availability_windows VALUES($1,$2,$3,$4)',[worker,kind,...bounds.map(stamp)]);
     }
     if(scenario.blocking) await db.query('INSERT INTO private.worker_calendar_events VALUES($1,$2,$3,$4,$5)',
       [worker,'BLOCKING',...scenario.blocking.map(stamp),'33333333-3333-4333-8333-333333333333']);
     const {rows:[result]}=await db.query('SELECT private.worker_need_time_tier_v1($1,$2) AS tier',[need,worker]);
     assert.equal(result.tier,scenario.expected);
   });
   await t.test('original null-bound TODAY branch uses the actual saved calendar and expires',async()=>{
     await db.exec(`TRUNCATE public.profile_availability_windows,private.worker_calendar_events;
       UPDATE public.app_profiles SET available_now=false;
       UPDATE public.needs SET schedule_kind='TODAY_FLEXIBLE',starts_at=NULL,ends_at=NULL,
         published_at=statement_timestamp(),task_timezone='UTC';
       INSERT INTO public.profile_availability_windows
       SELECT '${worker}','AVAILABLE',statement_timestamp()+remaining/4,statement_timestamp()+remaining/2
       FROM (SELECT date_trunc('day',statement_timestamp())+interval '1 day'-statement_timestamp() AS remaining) x;`);
     assert.equal((await db.query('SELECT private.worker_need_time_tier_v1($1,$2) AS tier',[need,worker])).rows[0].tier,2);
     await db.exec(`UPDATE public.needs SET published_at=statement_timestamp()-interval '1 day';`);
     assert.equal((await db.query('SELECT private.worker_need_time_tier_v1($1,$2) AS tier',[need,worker])).rows[0].tier,null);
   });
 }finally{await db.close();}
});
