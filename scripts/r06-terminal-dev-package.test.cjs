'use strict';

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture,A,R,TEXT}=require('./r06-terminal-fixture.cjs');
const dormant=require('./r06-prepared-dev-package.cjs');
const {buildPackage}=require('./r06-terminal-dev-package.cjs');
const native=process.env.USKOCI_R06_TERMINAL_PACKAGE_NATIVE==='1';
const runtime=native?require('./p0-discovery-native-benchmark.cjs'):null;
const quote=value=>"'"+value.replaceAll("'","''")+"'";

async function captureFixture(f){
 // The same reduced fixture boundary as the original dormant operation test:
 // these dependencies model enabled RLS, not the complete hosted policy graph.
 await f.db.exec('alter table private.retention_holds enable row level security; alter table public.ai_messages enable row level security; set search_path=pg_catalog');
 const system_identifier=await f.value('select system_identifier::text as value from pg_control_system()');
 const tables=[],functions=[];
 for(const relation of dormant.GUARDED_TABLES)tables.push((await f.db.query(dormant.tableSql(quote(relation)))).rows[0].jsonb_build_object);
 for(const {signature}of dormant.sourceContract().pins)functions.push((await f.db.query(dormant.functionSql(quote(signature)))).rows[0].jsonb_build_object);
 return {projectRef:dormant.PROJECT,database:'postgres',system_identifier,tables,functions};
}

test('R06 incremental DEV package changes only the reviewed installed sweep',async t=>{
 const f=native?await runtime.startFixture(Driver=>fixture({Driver,native:true})):await fixture();
 const reject=async(sql,pattern)=>{await assert.rejects(f.db.exec(sql),pattern);await f.db.exec('rollback');};
 const row=()=>f.value('select to_jsonb(t) as value from private.ai_need_turn_commands t where account_id=$1 and client_request_id=$2',[A,R]);
 const sweepHash=()=>f.value("select md5(prosrc) as value from pg_proc where oid='private.ai_turn_sweep_v5(timestamp with time zone)'::regprocedure");
 try{
  const capture=await captureFixture(f),base=dormant.buildPackage(capture),operation=buildPackage(capture,f.terminalDependencies);
  await t.test('uninstalled or foreign databases are refused without creating prepared columns',async()=>{
   await reject(operation.preflight,/R06_DEV_PREIMAGE_FUNCTION_DRIFT|R06_DEV_POSTIMAGE_FUNCTION_DRIFT|R06_DEV_ADDED_COLUMN_DRIFT/);
   const other=buildPackage({...capture,system_identifier:String(BigInt(capture.system_identifier)+1n)},f.terminalDependencies);
   await reject(other.install,/R06_DEV_PROJECT_MISMATCH/);
   assert.equal(await f.value("select count(*)::int as value from pg_attribute where attrelid='private.ai_need_turn_commands'::regclass and attname='prepared_input' and not attisdropped"),0);
   await f.db.exec(base.install);
  });
  await t.test('read-only incremental preflight accepts the exact installed dormant contract',async()=>{
   const before=await sweepHash();await f.db.exec(operation.preflight);
   assert.equal(await sweepHash(),before);
   assert.equal(before,operation.manifest.beforeHash);
  });
  await t.test('input and privacy dependency drift blocks the increment without replacing the sweep',async()=>{
   await f.db.exec('alter table private.retention_holds add column drift_probe boolean');
   await reject(operation.install,/R06_DEV_TABLE_DRIFT:private.retention_holds/);
   await f.db.exec('alter table private.retention_holds drop column drift_probe');
   await f.db.exec('grant execute on function private.closure_redaction_patch_v5(text,jsonb,uuid,uuid) to service_role');
   await reject(operation.install,/R06_DEV_POSTIMAGE_FUNCTION_DRIFT:private.closure_redaction_patch/);
   await f.db.exec('revoke execute on function private.closure_redaction_patch_v5(text,jsonb,uuid,uuid) from service_role');
   await f.db.exec('alter table private.qa_ai_commands disable trigger qa_ai_closure_guard');
   await reject(operation.install,/R06_TERMINAL_DEV_QA_DEPENDENCY_DRIFT/);
   await f.db.exec('alter table private.qa_ai_commands enable trigger qa_ai_closure_guard');
   assert.equal(await sweepHash(),operation.manifest.beforeHash);
  });
  await t.test('an active original attempt prevents rollout without cancelling or releasing it',async()=>{
   await f.seed('NEED_SERVICE');await f.prepare('NEED_SERVICE');
   const before=await row(),budget=await f.value('select to_jsonb(b) as value from private.ai_test_budget_v5 b');
   await reject(operation.install,/R06_TERMINAL_DEV_ACTIVE_TURN_DRAIN_REQUIRED/);
   assert.deepEqual(await row(),before);
   assert.deepEqual(await f.value('select to_jsonb(b) as value from private.ai_test_budget_v5 b'),budget);
   await f.db.exec("update private.ai_need_turn_commands set state='FAILED'");
  });
  await t.test('install preserves data, budget, privacy projection and owner metadata',async()=>{
   const before=await row(),budget=await f.value('select to_jsonb(b) as value from private.ai_test_budget_v5 b');
   const projection=await f.value('select private.data_export_projection_sha_v5() as value');
   const metadata=await f.value("select to_jsonb(p)-'prosrc' as value from pg_proc p where oid='private.ai_turn_sweep_v5(timestamp with time zone)'::regprocedure");
   await f.db.exec(operation.install);await f.db.exec(operation.postflight);
   assert.equal(await sweepHash(),operation.manifest.afterHash);
   assert.deepEqual(await row(),before);
   assert.deepEqual(await f.value('select to_jsonb(b) as value from private.ai_test_budget_v5 b'),budget);
   assert.equal(await f.value('select private.data_export_projection_sha_v5() as value'),projection);
   assert.deepEqual(await f.value("select to_jsonb(p)-'prosrc' as value from pg_proc p where oid='private.ai_turn_sweep_v5(timestamp with time zone)'::regprocedure"),metadata);
   await reject(operation.install,/R06_DEV_POSTIMAGE_FUNCTION_DRIFT/);
  });
  await t.test('real sweep minimizes only the unusable snapshot and code rollback keeps the sole text',async()=>{
   const original=await row();
   assert.deepEqual((await f.value('select private.ai_turn_sweep_v5() as value')).errors,[]);
   const retained=await row();
   assert.deepEqual(retained.prepared_input,{schemaVersion:'R06_RETAINED_TEXT_V1',input:{userText:TEXT},originalInputSha256:original.prepared_input_sha256});
   assert.deepEqual((await f.snapshot()).datasets.taskAiTurns[0].preparedInput,{userText:TEXT});
   await f.db.exec(operation.rollback);await f.db.exec(operation.preflight);
   assert.deepEqual(await row(),retained);
   assert.equal(await sweepHash(),operation.manifest.beforeHash);
   assert.deepEqual(await f.dispatchPrepared('NEED_SERVICE',original.prepared_input_sha256),{state:'EXPIRED',dispatched:false});
   assert.equal(await f.value('select count(*)::int as value from private.ai_test_reservations_v5'),1);
   assert.equal(await f.value('select settled_microusd is null as value from private.ai_test_reservations_v5'),true);
   await reject(operation.rollback,/R06_DEV_POSTIMAGE_FUNCTION_DRIFT/);
  });
 }finally{if(native)await runtime.stopFixture();else await f.db.close();}
});

test('R06 incremental checked-in operation is reproducible from the reviewed original capture',()=>{
 const capture=JSON.parse(fs.readFileSync(path.join(__dirname,'sql/r06_prepared_dev_20261110.preimage.json'),'utf8'));
 const generated=buildPackage(capture),prefix=path.join(__dirname,'sql/r06_terminal_dev_20261110');
 for(const phase of ['preflight','install','postflight','rollback'])assert.equal(fs.readFileSync(prefix+'.'+phase+'.sql','utf8'),generated[phase]);
 assert.deepEqual(JSON.parse(fs.readFileSync(prefix+'.manifest.json','utf8')),generated.manifest);
 assert.throws(()=>buildPackage({...capture,projectRef:'fvyqqudqvizjrxaflhex'}),/Expected values/);
});
