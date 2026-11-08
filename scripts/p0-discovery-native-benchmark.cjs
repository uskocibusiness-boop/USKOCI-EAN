'use strict';
// Opt-in, isolated native PostgreSQL benchmark. Never connects to hosted DEV.
// USKOCI_POSTGRES_ROOT points to an extracted PostgreSQL/PostGIS installation;
// USKOCI_PG_MODULE points to an independently installed node-postgres module.
// The child server and client intentionally live in the same process lifetime.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process'),{once}=require('node:events');
const ts=require('typescript');
const installation=process.env.USKOCI_POSTGRES_ROOT;
if(!installation||!process.env.USKOCI_PG_MODULE)throw new Error('Explicit isolated USKOCI_POSTGRES_ROOT and USKOCI_PG_MODULE are required');
const {Client}=require(process.env.USKOCI_PG_MODULE);
const bin=path.join(installation,'usr/lib/postgresql/17/bin'),lib=path.join(installation,'usr/lib/x86_64-linux-gnu');
const share=path.join(installation,'usr/share/postgresql/17');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'uskoci-discovery-pg-'));
const data=path.join(temporary,'data'),port=Number(process.env.USKOCI_PG_FIXTURE_PORT??55434);
assert.ok(Number.isInteger(port)&&port>=49152&&port<=65535,'isolated fixture port must be an integer in the local dynamic range');
const env={...process.env,LD_LIBRARY_PATH:lib};
const source=fs.readFileSync(path.join(__dirname,'r05-discovery-contract.test.cjs'),'utf8');
const parsed=ts.createSourceFile('fixture.cjs',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
const firstTest=parsed.statements.find(n=>ts.isExpressionStatement(n)&&ts.isCallExpression(n.expression)&&n.expression.expression.getText(parsed)==='test');
const sql=name=>fs.readFileSync(path.join(__dirname,'sql',name),'utf8');
const preimage=JSON.parse(sql('p0_discovery_materialization_20261108.preimage.json'));
const forward=sql('p0_discovery_materialization_20261108.sql');
const output=process.argv[2]||path.join(temporary,'benchmark.json');
const serverLog=path.join(temporary,'postgres.log');
let server,db;
function nestedPlans(log){
 const plans=[];const pattern=/\{\n\s*"Query Text"/g;let match;
 while((match=pattern.exec(log))){
  let depth=0,quoted=false,escaped=false;
  for(let i=match.index;i<log.length;i++){
   const ch=log[i];if(escaped){escaped=false;continue;}
   if(quoted){if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}
   if(ch==='"')quoted=true;else if(ch==='{')depth++;else if(ch==='}'&&--depth===0){
    const plan=JSON.parse(log.slice(match.index,i+1));
    if(/^with (?:base|unfiltered) as /i.test(plan['Query Text']?.trim()))plans.push(plan);
    pattern.lastIndex=i+1;break;
   }
  }
 }
 return plans;
}
class NativeFixture {
 constructor(){
  this.client=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres'});db=this;
  this.ready=this.client.connect().then(async()=>{
   const probe=await this.client.query("select current_setting('data_directory') as directory");
   assert.equal(probe.rows[0].directory,data,'refuse a pre-existing server on the local fixture port');
  });
 }
 async query(text,values=[]){await this.ready;return this.client.query(text,values);}
 async exec(text){
  // Only the fixture's geography stub is replaced. The deployed RPC, grants,
  // RLS policies and calendar functions run unchanged on PostgreSQL/PostGIS.
  text=text.replace('create domain extensions.geography as text;','create extension postgis with schema extensions;')
   .replace(/ create function extensions\.fixture_geography_overlap[\s\S]*?(?= create function auth\.uid)/,'')
   .replace('extensions.geography generated always as (case when approximate_lat is null then null else approximate_lat::text end) stored',
    'extensions.geography generated always as (case when approximate_lat is null or approximate_lng is null then null else extensions.st_setsrid(extensions.st_makepoint(approximate_lng::double precision,approximate_lat::double precision),4326)::extensions.geography end) stored');
  return this.query(text);
 }
 async close(){await this.client.end();}
}
const fixtureRequire=name=>name==='@electric-sql/pglite'?{PGlite:NativeFixture}:require(name);
const baseline=new Function('require','__dirname',source.slice(0,firstTest.getStart(parsed))+'\nreturn {fixture,filter,page,clean,N,B};')(fixtureRequire,__dirname);
const {filter,page,clean,N,B}=baseline;
const percentile=(sorted,p)=>sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)];
async function startFixture(factory=baseline.fixture,options={}){
 const maxConnections=options.maxConnections??30;
 assert.ok(Number.isInteger(maxConnections)&&maxConnections>=30&&maxConnections<=120,'bounded isolated connection count');
 const init=spawnSync(path.join(bin,'initdb'),['-D',data,'-L',share,'-U','postgres','-A','trust','--no-locale','-E','UTF8'],{env,encoding:'utf8'});
 if(init.status!==0)throw new Error('Isolated initdb failed: '+init.stderr);
 const log=fs.openSync(serverLog,'w');
 server=spawn(path.join(bin,'postgres'),['-D',data,'-p',String(port),'-c','unix_socket_directories=',
  '-c','listen_addresses=127.0.0.1','-c',`max_connections=${maxConnections}`,'-c','shared_buffers=128MB'],{env,stdio:['ignore',log,log]});
 fs.closeSync(log);
 for(let attempt=0;attempt<100;attempt++){
  if(server.exitCode!==null)throw new Error('Isolated postgres exited: '+fs.readFileSync(serverLog,'utf8'));
  const ready=spawnSync(path.join(bin,'pg_isready'),['-h','127.0.0.1','-p',String(port),'-U','postgres'],{env,stdio:'ignore'});
  if(ready.status===0)break;
  if(attempt===99)throw new Error('Isolated postgres did not become ready');
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 const fixture=await factory(NativeFixture);db=fixture.db;
 return fixture;
}
async function main(){
 const fixture=await startFixture();
 const {actor,value,raw}=fixture;
 const columns=JSON.parse(sql('r05_discovery_contract_20261107.preimage.json')).needsState.columns.map(c=>c.name).filter(n=>n!=='approx_geog');
 const template=await value('select to_jsonb(n) as value from public.needs n where id=$1',[N]);
 await db.query(`insert into public.needs(${columns.join(',')}) select ${columns.map(n=>'x.'+n).join(',')}
  from generate_series(1000,10999) g(i) cross join lateral jsonb_populate_record(null::public.needs,$1::jsonb||jsonb_build_object(
  'id',md5('discovery-scale-'||g.i)::uuid,'title','Synthetic capacity fixture '||g.i,
  'mode',case when g.i%500=0 then 'MY_PRICE' else 'OFFERS' end,
  'execution_location_mode',case when g.i%500=0 then 'STATIONARY' else 'REMOTE' end)) x`,[template]);
 await db.exec('analyze public.needs; analyze public.need_selections; analyze public.app_profiles;');
 const result={capturedAt:new Date().toISOString(),postgres:await value('select version() as value'),
  postgis:await value('select extensions.postgis_full_version() as value'),
  totalSyntheticRows:Number(await value('select count(*) as value from public.needs')),concurrentClients:1,samplesPerVariant:25,
  percentileMethod:'Nearest rank; with 25 samples p99 equals the maximum and has low statistical power.',
  limitations:['Isolated local synthetic data; no hosted DEV traffic or production capacity claim.',
   'Actual RPC, PostgreSQL ACL/RLS, calendar helpers and geography type; account lineage and canonical area/taxonomy eligibility use the existing bounded R05 fixture.',
   'No spatial filter change or spatial index-usage claim. Exact global counts/availability remain required by the existing API.'],scenarios:[]};
 const scenarios=[['selective PAGE',page({price:'MY_PRICE',where:'onsite',text:'Synthetic capacity'},{limit:50})],
  ['unfiltered PAGE',page({}, {limit:50})],
  ['selective MAP', {mode:'MAP',filter:filter({price:'MY_PRICE',where:'onsite',text:'Synthetic capacity'}),anchor:null,bounds:[19,45,20,46],grid:24}]];
 for(const [name,request]of scenarios){
  const record={name};let before;
  for(const optimized of [false,true]){
   await db.exec('reset role');await db.exec(preimage.definition);if(optimized)await db.exec(forward);await actor(B);
   const anchored={...request,anchor:before?.anchor||null};
   const first=await raw(anchored);if(!optimized)before=first;else assert.deepEqual(clean(first),clean(before));
   anchored.anchor=before.anchor;
   await raw(anchored);await raw(anchored);
   const elapsed=[];
   for(let i=0;i<25;i++){const start=process.hrtime.bigint();await raw(anchored);elapsed.push(Number(process.hrtime.bigint()-start)/1e6);}
   elapsed.sort((a,b)=>a-b);
   const plan=(await db.query('explain (analyze,buffers,format json) select public.rpc_discovery_v1($1)',[anchored])).rows[0]['QUERY PLAN'];
   // Separate probe after all 25 latency samples. Captures the inner WITH plan,
   // not merely the Result node returned by EXPLAIN SELECT the PL/pgSQL RPC.
   await db.exec('reset role');
   await db.exec(`load '${path.join(installation,'usr/lib/postgresql/17/lib/auto_explain').replaceAll("'","''")}';
    set auto_explain.log_nested_statements=on;set auto_explain.log_analyze=on;
    set auto_explain.log_buffers=on;set auto_explain.log_format=json;
    set auto_explain.log_timing=off;set auto_explain.log_min_duration='1ms';`);
   const logStart=fs.statSync(serverLog).size;await actor(B);await raw(anchored);
   await db.exec('reset role;set auto_explain.log_min_duration=-1');
   const nested=nestedPlans(fs.readFileSync(serverLog,'utf8').slice(logStart));
   assert.ok(nested.length>=1,'auto_explain must capture the actual nested Discovery WITH plan');
   record[optimized?'after':'before']={p50Ms:percentile(elapsed,0.5),p95Ms:percentile(elapsed,0.95),p99Ms:percentile(elapsed,0.99),samplesMs:elapsed,explain:plan,nestedPlans:nested};
  }
  record.fullResponseEqual=true;record.counts=before.counts;delete record.counts.observedAt;
  result.scenarios.push(record);process.stdout.write(JSON.stringify({name,before:record.before.p50Ms,after:record.after.p50Ms,fullResponseEqual:true})+'\n');
 }
 fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log('Evidence: '+path.resolve(output));
}
async function stopFixture(){
 if(db)await db.close();
 if(server&&server.exitCode===null){const stopped=once(server,'exit');server.kill('SIGTERM');await stopped;}
 fs.rmSync(temporary,{recursive:true,force:true});
}
async function connectFixtureClient(){
 const client=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres'});
 try{
  await client.connect();
  const probe=await client.query("select current_setting('data_directory') as directory");
  assert.equal(probe.rows[0].directory,data,'refuse a pre-existing server on the local fixture port');
  return client;
 }catch(error){await client.end();throw error;}
}
module.exports={startFixture,stopFixture,connectFixtureClient};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;}).finally(stopFixture);
