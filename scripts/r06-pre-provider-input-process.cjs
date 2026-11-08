'use strict';
// Isolated native proof process. Only localhost PostgreSQL; no HTTP/provider I/O.
const fs=require('node:fs');
const {Client}=require(process.env.USKOCI_PG_MODULE);
const crypto=require('node:crypto');
const [operation,purpose,identityText]=process.argv.slice(2),identity=JSON.parse(identityText);
const client=new Client({host:'127.0.0.1',port:Number(process.env.USKOCI_PG_FIXTURE_PORT||55434),user:'postgres',database:'postgres'});
(async()=>{
 await client.connect();await client.query("select set_config('request.jwt.claim.role','service_role',false)");
 if(operation==='prepare-crash'){
  const input=JSON.parse(fs.readFileSync(0,'utf8'));
  const r=await client.query('select public.rpc_ai_prepare_input_service($1,$2,$3,$4,$5,$6) as value',[...identity,purpose,input]);
  process.stdout.write(JSON.stringify(r.rows[0].value)+'\n');
  process.exit(73); // Commit acknowledged; terminate without preserving any RAM.
 }
 if(operation!=='resume')throw new Error('Unsupported isolated operation');
 const r=await client.query('select public.rpc_ai_read_prepared_input_service($1,$2,$3,$4) as value',[...identity.slice(0,3),purpose]);
 const result=r.rows[0].value;
 if(result.state!=='PREPARED'){process.stdout.write(JSON.stringify({state:result.state,send:false})+'\n');return;}
 const s=result.snapshot,owner=purpose==='NEED_SERVICE'?'rpc_ai_dispatch_need_turn_v2_service':'rpc_dispatch_worker_ai_turn_service';
 const d=(await client.query(`select public.${owner}($1,$2,$3,$4) as value`,[s.accountId,s.conversationId,s.clientRequestId,s.attemptId])).rows[0].value;
 const sent=purpose==='NEED_SERVICE'?d===true:d?.dispatched===true;
 if(sent)await client.query('insert into private.fixture_provider_sends values($1,$2,$3,$4)',[purpose,s.clientRequestId,s.attemptId,s.input.providerRequest]);
 process.stdout.write(JSON.stringify({state:'PREPARED',send:sent,inputSha256:result.inputSha256,
  providerBodySha256:crypto.createHash('sha256').update(JSON.stringify(s.input.providerRequest)).digest('hex')})+'\n');
})().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;}).finally(()=>client.end());
