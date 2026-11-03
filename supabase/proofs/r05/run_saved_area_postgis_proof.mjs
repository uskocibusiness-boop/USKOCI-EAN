// Narrow disposable PostGIS proof. No project link, DB URL, host port, volume,
// application secret, schema-parity waiver, or live deployment is accepted.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {buildPostgisProof,pins} from './saved_area_postgis_proof.mjs';

export function validateRuntime(env){
 for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','PGHOST','PGSERVICE','DATABASE_URL','SUPABASE_DB_URL'])
  assert.ok(!env[key],`R05_EXTERNAL_RUNTIME_REFUSED:${key}`);
 assert.equal(pins.images.db,'supabase/postgres:17.6.1.165');
 assert.equal(pins.postgres_version_num,170006);
}
export function dockerStartArgs(name){
 assert.match(name,/^uskoci-r05-[a-f0-9-]{36}$/);
 return ['run','--detach','--rm','--name',name,'--label','uskoci.proof=r05-saved-area','--network','none',
  '--user','postgres','--entrypoint','/bin/sh',pins.images.db,'-c',
  "initdb -D /tmp/uskoci-r05-pg -U postgres --auth=trust --locale=C.UTF-8 -E UTF8 >/tmp/r05-init.log && exec postgres -D /tmp/uskoci-r05-pg -k /tmp -c listen_addresses='' -c max_connections=20 -c shared_buffers=128MB"];
}
export async function runProof(){
 validateRuntime(process.env);
 const out=resolve(dirname(fileURLToPath(import.meta.url)),'../../../artifacts/r05-postgis');
 mkdirSync(out,{recursive:true});
 const proof=buildPostgisProof();writeFileSync(resolve(out,'proof.sql'),proof);
 if(process.argv.includes('--write-sql')){console.log(resolve(out,'proof.sql'));return;}
 assert.equal(process.argv.length,2,'R05_UNKNOWN_ARGUMENT');
 const name=`uskoci-r05-${randomUUID()}`;
 let created=false,success=false,cleanup=false;
 const command=(args,{input,timeout=60000,check=true}={})=>{
  const result=spawnSync('docker',args,{input,encoding:'utf8',timeout,maxBuffer:16*1024*1024,windowsHide:true});
  if(check&&(result.error||result.status!==0)) throw new Error(`R05_DOCKER_COMMAND_FAILED:${args[0]}:${result.error?.message??result.stderr?.slice(-4000)}`);
  return result;
 };
 try{
  assert.equal(command(['version','--format','{{.Server.Os}}']).stdout.trim(),'linux','R05_LINUX_DOCKER_REQUIRED');
  console.log(`R05 pulling pinned ${pins.images.db}`);
  command(['pull',pins.images.db],{timeout:300000});
  created=true;command(dockerStartArgs(name));
  let ready=false;
  for(let attempt=0;attempt<60;attempt++){
   const result=command(['exec',name,'pg_isready','-h','/tmp','-U','postgres','-d','postgres'],{check:false,timeout:3000});
   if(result.status===0){ready=true;break;}
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(ready,'R05_POSTGRES_NOT_READY');
  console.log('R05 executing real PostGIS fixture and EXPLAIN ANALYZE');
  const result=command(['exec','-i',name,'psql','-X','-qAt','-h','/tmp','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-f','-'],{input:proof,timeout:240000,check:false});
  writeFileSync(resolve(out,'psql.stdout.log'),result.stdout??'');
  writeFileSync(resolve(out,'psql.stderr.log'),result.stderr??'');
  assert.equal(result.status,0,`R05_POSTGIS_PROOF_FAILED:${result.error?.message??result.stderr?.slice(-4000)}`);
  const observation=JSON.parse(result.stdout.trim().split('\n').findLast(line=>line.startsWith('{'))??'null');
  assert.equal(observation?.unit,'R05_POSTGIS_INDEXED_SAVED_AREA_PROOF');
  assert.equal(observation.postgresVersion,pins.postgres_version_num);
  assert.equal(observation.postgisVersion,pins.extensions.find(e=>e.name==='postgis').version);
  writeFileSync(resolve(out,'observation.json'),JSON.stringify(observation,null,2)+'\n');success=true;
 }finally{
  if(created){
   const result=command(['rm','--force',name],{check:false});cleanup=result.status===0;
   // A stopped --rm container may already be removed. A daemon error alone
   // is not proof of cleanup: require a successful empty inventory response.
   if(!cleanup){
    const inventory=command(['ps','--all','--filter',`name=^/${name}$`,'--format','{{.Names}}'],{check:false});
    cleanup=inventory.status===0&&inventory.stdout.trim()==='';
   }
  }else cleanup=true;
  writeFileSync(resolve(out,'receipt.json'),JSON.stringify({unit:'R05_POSTGIS_PROOF_RECEIPT',image:pins.images.db,proofSha256:createHash('sha256').update(proof).digest('hex'),success,cleanup,devWrites:false,fullSchemaParity:false,realAuth:false,dispatchAcceptance:false},null,2)+'\n');
  assert.ok(cleanup,'R05_DISPOSABLE_CLEANUP_FAILED');
 }
 console.log(`R05 PostGIS PASS; evidence ${out}`);
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
 runProof().catch(error=>{console.error(error.message);process.exitCode=1;});
