'use strict';
// File-backed PGlite process-loss proof only. No HTTP, provider, hosted database
// or native PostgreSQL concurrency claim. Each process owns the fixture alone.
const fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const [operation,purpose,identityText]=process.argv.slice(2),identity=JSON.parse(identityText);
const directory=process.env.USKOCI_R06_PGLITE_DIR;
if(!directory||!path.isAbsolute(directory)||!path.basename(directory).startsWith('uskoci-r06-cold-'))throw new Error('Explicit isolated fixture directory required');
let db;
(async()=>{
 if(operation==='prepare-crash'){
  const {fixture,candidate}=require('./r06-pre-provider-input-fixture.cjs');
  class PersistentFixture extends PGlite{constructor(){super({dataDir:directory,extensions:{pgcrypto},relaxedDurability:false});}}
  const f=await fixture({Driver:PersistentFixture});db=f.db;
  await db.exec(candidate);await f.seed(purpose);
  const input=JSON.parse(fs.readFileSync(0,'utf8'));
  const result=(await db.query('select public.rpc_ai_prepare_input_service($1,$2,$3,$4,$5,$6) as value',[...identity,purpose,input])).rows[0].value;
  fs.writeSync(1,JSON.stringify(result)+'\n');
  process.exit(73); // Durable COMMIT acknowledged; no graceful DB close or RAM handoff.
 }
 if(!['resume','dispatch-crash','count'].includes(operation))throw new Error('Unsupported isolated operation');
 db=new PGlite({dataDir:directory,extensions:{pgcrypto},relaxedDurability:false});
 await db.query("select set_config('request.jwt.claim.role','service_role',false)");
 if(operation==='count'){
  const result=(await db.query(`select (select count(*)::int from private.fixture_provider_sends) as sends,
   (select count(*)::int from private.ai_test_reservations_v5) as reservations,
   (select reserved_microusd::int from private.ai_test_budget_v5) as reserved`)).rows[0];
  fs.writeSync(1,JSON.stringify(result)+'\n');return;
 }
 const prepared=(await db.query('select public.rpc_ai_read_prepared_input_service($1,$2,$3,$4) as value',[...identity,purpose])).rows[0].value;
 if(prepared.state!=='PREPARED'){fs.writeSync(1,JSON.stringify({state:prepared.state,send:false})+'\n');return;}
 const s=prepared.snapshot;
 const dispatched=(await db.query('select public.rpc_ai_dispatch_prepared_input_service($1,$2,$3,$4,$5,$6) as value',
  [s.accountId,s.conversationId,s.clientRequestId,s.attemptId,purpose,prepared.inputSha256])).rows[0].value;
 const sent=dispatched.state==='DISPATCHED'&&dispatched.dispatched===true;
 if(operation==='dispatch-crash'){
  fs.writeSync(1,JSON.stringify({state:dispatched.state,permission:sent})+'\n');process.exit(74);
 }
 if(sent)await db.query('insert into private.fixture_provider_sends values($1,$2,$3,$4)',[purpose,s.clientRequestId,s.attemptId,dispatched.snapshot.input.providerRequest]);
 fs.writeSync(1,JSON.stringify({state:dispatched.state,send:sent,inputSha256:dispatched.inputSha256,userText:sent?dispatched.snapshot.input.userText:null})+'\n');
})().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;}).finally(()=>db?.close());
