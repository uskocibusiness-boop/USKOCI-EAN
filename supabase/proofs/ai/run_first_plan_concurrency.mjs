// Native PG17 multi-session acceptance in a fresh socket-only container.
// Reuses the existing domain fixture; actual completion/capture/resolver and
// freshly captured closure lock owners run unchanged. Domain fact/calendar/
// location substitutes remain explicit: not full R01 parity or Auth/DEV proof.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {setupSql,fixture,complete,id,account,conversation,request,attempt,plan,decision,output,proposals} from './r06_first_plan_fixture.mjs';
const pins=JSON.parse(readFileSync(new URL('../privacy/runtime/pins.json',import.meta.url),'utf8'));
const dependencies=JSON.parse(readFileSync(new URL('../../operations/dev-alpha/r04-single-pass-20261103/lifecycle-dependencies.json',import.meta.url),'utf8'));
const literal=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+(typeof v==='object'?JSON.stringify(v):String(v)).replaceAll("'","''")+"'";
export const bind=(sql,args)=>sql.replace(/\$(\d+)\b/g,(_,n)=>literal(args[Number(n)-1]));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function collect(fn){const statements=[];await fn({query:async(sql,args)=>{statements.push(bind(sql,args));return {rows:[{result:null}]};}});return statements.join(';\n')+';';}
export const fixtureSql=kind=>collect(db=>fixture(db,kind));
export const completionSql=kind=>collect(db=>complete(db,kind,{items:novel}));
const peerSql=sql=>[1,2,3,4,5,6].reduce((text,n)=>text.replaceAll(id(n),id(n+100)),sql);
const novel={...plan,anchors:[],proposals:[{...decision,action:'CREATE_NEW_BRANCH',categoryId:'',proposedPath:['Technical services','Synthetic repair']}]};
export const nativeSchema=()=>setupSql()+"\nCREATE TABLE private.account_closure_requests(account_id uuid,state text);DROP FUNCTION private.closure_assert_open(uuid);\n"+
 ['private.closure_account_key','private.closure_account_restricted','private.closure_assert_open'].map(n=>dependencies.functions.find(f=>f.name===n).definition+';').join('\n');
export function validateRuntime(env){
 for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','PGHOST','PGSERVICE','DATABASE_URL','SUPABASE_DB_URL'])assert.ok(!env[key],'R04_EXTERNAL_RUNTIME_REFUSED:'+key);
 assert.equal(pins.images.db,'supabase/postgres:17.6.1.165');assert.equal(pins.postgres_version_num,170006);
}
export function dockerStartArgs(name){
 assert.match(name,/^uskoci-r04-[a-f0-9-]{36}$/);
 return ['run','--detach','--rm','--name',name,'--label','uskoci.proof=r04-first-plan','--network','none','--user','postgres','--entrypoint','/bin/sh',pins.images.db,'-c',
  "initdb -D /tmp/uskoci-r04-pg -U postgres --auth=trust --locale=C.UTF-8 -E UTF8 >/tmp/r04-init.log && exec postgres -D /tmp/uskoci-r04-pg -k /tmp -c listen_addresses='' -c max_connections=20 -c shared_buffers=128MB"];
}
export async function runProof(){
 validateRuntime(process.env);assert.equal(process.argv.length,2,'R04_UNKNOWN_ARGUMENT');
 const out=fileURLToPath(new URL('../../../artifacts/r04-first-plan-native/',import.meta.url));mkdirSync(out,{recursive:true});
 const name='uskoci-r04-'+randomUUID(),observations=[],sessions=[];
 let created=false,success=false,cleanup=false;
 const command=(args,{input,timeout=60000,check=true}={})=>{
  const r=spawnSync('docker',args,{input,encoding:'utf8',timeout,maxBuffer:16*1024*1024,windowsHide:true});
  if(check&&(r.error||r.status!==0))throw new Error('R04_DOCKER_FAILED:'+args[0]+':'+(r.error?.message??r.stderr?.slice(-4000)));
  return r;
 };
 const psql=['exec','-i',name,'psql','-X','-qAt','-h','/tmp','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-f','-'];
 const prefix="SET statement_timeout='12s';SET lock_timeout='10s';SET test.role='service_role';";
 const sql=(text,check=true)=>command(psql,{input:prefix+text,timeout:16000,check});
 const json=text=>JSON.parse(sql(text).stdout.trim().split('\n').findLast(line=>line.startsWith('{')));
 function session(label,text,{hold=false}={}){
  const child=spawn('docker',psql,{stdio:['pipe','pipe','pipe'],windowsHide:true});let stdout='',stderr='';
  child.stdout.setEncoding('utf8').on('data',s=>stdout+=s);child.stderr.setEncoding('utf8').on('data',s=>stderr+=s);
  const done=new Promise(resolve=>{child.on('error',error=>resolve({status:-1,stdout,stderr:String(error)}));child.on('close',status=>resolve({status,stdout,stderr}));});
  child.stdin.on('error',()=>{});
  child.stdin.write(prefix+'SET application_name='+literal(label)+';'+text+'\n');
  if(!hold)child.stdin.end('\\q\n');
  const s={label,done,release:verb=>child.stdin.end(verb+';\n\\q\n')};sessions.push(s);return s;
 }
 async function waitState(s,waiting){
  for(let i=0;i<70;i++){
   const result=sql('SELECT count(*) FROM pg_stat_activity WHERE application_name='+literal(s.label)+
    (waiting?" AND wait_event_type='Lock';":" AND state='idle in transaction';")).stdout.trim();
   if(result==='1')return;
   await pause(75);
  }
  throw new Error('R04_SESSION_STATE_NOT_REACHED:'+s.label+':'+waiting);
 }
 async function finished(s,expectedError){
  const r=await s.done;writeFileSync(resolve(out,s.label+'.log'),r.stdout+r.stderr);
  if(expectedError){assert.notEqual(r.status,0);assert.match(r.stderr,expectedError);return;}
  assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout.trim().split('\n').findLast(line=>line.startsWith('{'))??'null');
 }
 const schema=nativeSchema();
 writeFileSync(resolve(out,'schema.sql'),schema);
 let initialized=false;
 async function reset(kind){
  if(initialized)sql('DROP SCHEMA public CASCADE;CREATE SCHEMA public;DROP SCHEMA private CASCADE;DROP SCHEMA auth CASCADE;DROP SCHEMA extensions CASCADE;DROP ROLE anon;DROP ROLE authenticated;DROP ROLE service_role;');
  sql(`DO $f$ BEGIN IF inet_server_addr() IS NOT NULL OR current_setting('server_version_num')<>'170006' OR current_user<>'postgres'
   OR to_regnamespace('private') IS NOT NULL OR to_regrole('cli_login_postgres') IS NOT NULL THEN RAISE EXCEPTION 'R04_EMPTY_SOCKET_DATABASE_REQUIRED';END IF;END;$f$;`);
  sql(schema);initialized=true;sql(await collect(db=>fixture(db,kind)));
 }
 function readback(kind){
  const writer=kind==='WORKER'?'rpc_complete_worker_ai_turn_with_first_plan_service':kind==='LOCATION'?'rpc_ai_complete_need_location_turn_with_first_plan_service':'rpc_ai_complete_need_turn_with_first_plan_service';
  const args={p_account_id:account,p_conversation_id:conversation,p_client_request_id:request,p_attempt_id:attempt,p_taxonomy_plan:novel,
   ...(kind==='WORKER'?{p_output:output}:{p_user_message:'user',p_assistant_message:'assistant',p_safety:'ALLOW',p_proposals:proposals}),
   ...(kind==='LOCATION'?{p_location_context:{fixture:'valid'},p_location_action:'CONTINUE'}:{})};
  return 'SELECT public.rpc_ai_read_first_plan_completion_service('+literal(writer)+','+literal(args)+'::jsonb);';
 }
 const counts=()=>json("SELECT jsonb_build_object('messages',(SELECT count(*) FROM public.ai_messages),'hints',(SELECT count(*) FROM private.work_taxonomy_gemini_turn_hints_v1),'categories',(SELECT count(*) FROM private.work_taxonomy_categories),'audit',(SELECT count(*) FROM private.work_taxonomy_audit));");
 try{
  assert.equal(command(['version','--format','{{.Server.Os}}']).stdout.trim(),'linux');
  command(['pull',pins.images.db],{timeout:300000});created=true;command(dockerStartArgs(name));
  let ready=false;for(let i=0;i<60;i++){if(command(['exec',name,'pg_isready','-h','/tmp','-U','postgres','-d','postgres'],{check:false,timeout:3000}).status===0){ready=true;break;}await pause(500);}assert.ok(ready,'R04_POSTGRES_NOT_READY');
  for(const kind of ['NEED','LOCATION','WORKER']){
   await reset(kind);const call=await collect(db=>complete(db,kind,{items:novel}));
   const a=session(kind+'-writer','BEGIN;'+call,{hold:true});await waitState(a,false);
   const b=session(kind+'-retry',call);await waitState(b,true);
   const read=session(kind+'-readback',readback(kind));await waitState(read,true);
   a.release('COMMIT');const [one,two,seen]=await Promise.all([finished(a),finished(b),finished(read)]);
   assert.equal(one.firstPlan.state,'RESOLVED');assert.deepEqual(two,one);assert.deepEqual(seen,{state:'COMPLETED',envelope:one});
   assert.deepEqual(counts(),{messages:kind==='WORKER'?1:2,hints:1,categories:3,audit:2});
   observations.push(kind+': concurrent same completion and lost-ACK readback wait, then return one immutable result');
  }
  await reset('NEED');const call=await collect(db=>complete(db,'NEED',{items:novel}));
  const aborted=session('rollback-writer','BEGIN;'+call,{hold:true});await waitState(aborted,false);
  const retry=session('rollback-retry',call);await waitState(retry,true);aborted.release('ROLLBACK');await finished(aborted);
  assert.equal((await finished(retry)).firstPlan.state,'RESOLVED');assert.deepEqual(counts(),{messages:2,hints:1,categories:3,audit:2});
  observations.push('Rollback releases a waiting duplicate; exactly one completion and branch survives');
  await reset('NEED');sql(peerSql(await collect(db=>fixture(db,'NEED'))));
  const first=session('branch-owner-a','BEGIN;'+call,{hold:true});await waitState(first,false);
  const second=session('branch-owner-b',peerSql(call));await waitState(second,true);first.release('COMMIT');
  for(const result of await Promise.all([finished(first),finished(second)]))assert.equal(result.firstPlan.state,'RESOLVED');
  assert.deepEqual(counts(),{messages:4,hints:2,categories:3,audit:2});
  assert.equal(sql("SELECT count(DISTINCT catalog_resolution#>>'{items,0,categoryId}') FROM private.work_taxonomy_gemini_turn_hints_v1;").stdout.trim(),'1');
  observations.push('Two owners concurrently creating the same branch receive the same real category ID');
  await reset('NEED');
  const closure=session('closure-first',"BEGIN;SELECT pg_advisory_xact_lock(private.closure_account_key('"+account+"'));INSERT INTO private.account_closure_requests VALUES('"+account+"','READY');",{hold:true});await waitState(closure,false);
  const blocked=session('closed-writer',call);await waitState(blocked,true);closure.release('COMMIT');await finished(closure);await finished(blocked,/ACCOUNT_CLOSING/);
  assert.deepEqual(counts(),{messages:0,hints:0,categories:1,audit:0});observations.push('Closure committed first prevents the waiting completion and catalog mutation');
  await reset('NEED');const writer=session('completion-first','BEGIN;'+call,{hold:true});await waitState(writer,false);
  const closing=session('closure-second',"BEGIN;SELECT pg_advisory_xact_lock(private.closure_account_key('"+account+"'));INSERT INTO private.account_closure_requests VALUES('"+account+"','READY');COMMIT;");await waitState(closing,true);
  writer.release('COMMIT');await finished(writer);await finished(closing);
  const refused=sql(readback('NEED'),false);assert.notEqual(refused.status,0);assert.match(refused.stderr,/ACCOUNT_CLOSING/);
  assert.deepEqual(counts(),{messages:2,hints:1,categories:3,audit:2});observations.push('Completion committed first releases closure; subsequent readback is denied for the closing account');
  success=true;
 }finally{
  if(created){const removed=command(['rm','--force',name],{check:false});cleanup=removed.status===0;
   if(!cleanup){const found=command(['ps','--all','--filter',`name=^/${name}$`,'--format','{{.Names}}'],{check:false});cleanup=found.status===0&&found.stdout.trim()==='';}}
  else cleanup=true;
  await Promise.all(sessions.map(s=>s.done));
  writeFileSync(resolve(out,'receipt.json'),JSON.stringify({unit:'R04_FIRST_PLAN_NATIVE_CONCURRENCY',image:pins.images.db,postgresVersion:pins.postgres_version_num,
   schemaSha256:createHash('sha256').update(schema).digest('hex'),success,cleanup,observations,devWrites:false,realAuth:false,fullSchemaParity:false,
   limitations:['Synthetic domain fixture retains fact/media/location/Worker-patch substitutes; actual completion/capture/resolver/closure-lock bodies execute.','No full export/erasure orchestration, platform parity, paid model, device or deployment approval.']},null,2)+'\n');
  assert.ok(cleanup,'R04_DISPOSABLE_CLEANUP_FAILED');
 }
 console.log('R04 first-plan native concurrency PASS: '+observations.length+' scenarios');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)runProof().catch(error=>{console.error(error.stack);process.exitCode=1;});
