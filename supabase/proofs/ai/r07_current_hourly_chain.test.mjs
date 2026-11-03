// Current captured pricing owners in the shared bounded PGlite 18 fixture.
// Real pricing/receipt/version/read/change SQL; Auth, world, matching, events,
// remote readiness and publication fingerprints are explicit substitutes.
// No hosted PG17, HTTP/RLS, complete export/erasure or native proof is claimed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {data,candidate,body,md5,setup} from './r07_current_hourly_fixture.mjs';

const propose=(f,id,price,key=randomUUID(),patch={price_rsd:price},version=1)=>f.value(
 'SELECT public.rpc_propose_agreement_change_v2($1,$2,$3,$4,$5) AS value',[id,version,patch,'Dogovorena promena',key]);
const respond=(f,id,accept=true)=>f.value('SELECT public.rpc_respond_agreement_change($1,$2) AS value',[id,accept]);

// Source derivation is hash-bound to fresh live metadata, not an older label.
test('nine current definitions regenerate exactly and retain all captured security metadata',()=>{
 assert.match(execFileSync('python',['supabase/proofs/ai/build_current_hourly_candidate.py','--check'],{encoding:'utf8'}),/R07_CURRENT_SOURCE_PASS/);
 for(const [n,f] of Object.entries(data.before)) assert.equal(md5(body(f.definition)),f.body_md5,n);
 for(const [n,f] of Object.entries(data.after)) assert.equal(md5(body(f.definition)),f.body_md5,n);
 assert.equal(Object.keys(data.after).length,9);
 assert.ok(!candidate.includes('ALTER TABLE'));
});
test('actual current expanded schema still reproduces HOURLY refusal before this source correction',async t=>{
 const f=await setup(t,{apply:false});await f.actor(f.WORKER);const id=await f.need('HOURLY');
 await f.fails(()=>f.submit(id),'UNKNOWN_PRICE_BASIS');
 assert.equal(await f.value('SELECT count(*)::int AS value FROM public.marketplace_responses'),0);
});
test('unmarked target, stale body, ACL drift and incompatible column are rejected atomically',async t=>{
 const f=await setup(t,{apply:false}),before=await f.hashes(),attrs=await f.metadata();
 await f.fails(()=>f.db.exec(candidate),'R07_CURRENT_DISPOSABLE_REQUIRED');
 const changes=[
  data.before['private.assert_application_price_v5'].definition.replace('\nbegin','\nbegin -- deliberate source drift'),
  `GRANT EXECUTE ON FUNCTION public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text) TO anon;`,
  `ALTER TABLE public.marketplace_responses ALTER COLUMN price_basis SET DEFAULT 'TOTAL';`,
 ];
 for(const [i,sql] of changes.entries()) {
  await f.db.exec("BEGIN;SET LOCAL uskoci.r07_current.disposable='LOCAL_ONLY';"+sql);
  await f.fails(()=>f.db.exec(candidate),i===2?'R07_CURRENT_SCHEMA_DRIFT':'R07_CURRENT_SOURCE_OR_ACL_DRIFT');
  await f.db.exec('ROLLBACK');assert.deepEqual(await f.hashes(),before);assert.deepEqual(await f.metadata(),attrs);
 }
});
test('current-source change rolls back, then applies without touching old rows, receipts, privileges or identities',async t=>{
 const f=await setup(t,{apply:false});await f.actor(f.WORKER);const id=await f.need(null),key=randomUUID(),r=await f.submit(id,1200,2,1,key);
 await f.actor(f.REQUESTER);const sk=randomUUID(),ag=await f.select(id,r,sk);
 const before=await f.immutableRows(r.responseId),attrs=await f.metadata(),hashes=await f.hashes();
 await f.db.exec("BEGIN;SET LOCAL uskoci.r07_current.disposable='LOCAL_ONLY';"+candidate+'ROLLBACK;');
 assert.deepEqual(await f.hashes(),hashes);assert.deepEqual(await f.immutableRows(r.responseId),before);
 await f.db.exec("SET uskoci.r07_current.disposable='LOCAL_ONLY';"+candidate);
 assert.deepEqual(await f.metadata(),attrs);assert.deepEqual(await f.immutableRows(r.responseId),before);
 assert.equal(await f.select(id,r,sk),ag);await f.actor(f.WORKER);
 assert.deepEqual(await f.submit(id,1200,2,1,key),{...r,idempotentReplay:true});
 assert.equal((await f.value('SELECT public.rpc_list_my_applications() AS value'))[0].applicationPriceBasis,'TOTAL');
 assert.equal(await f.value('SELECT price_basis AS value FROM public.marketplace_responses WHERE id=$1',[r.responseId]),null);
});
for(const [basis,amount,price,unit,mode] of [
 ['HOURLY',1200,1200,'HOURLY','MY_PRICE'],['TOTAL',1200,600,'TOTAL','MY_PRICE'],
 ['PER_PERSON',1200,2400,'TOTAL','MY_PRICE'],[null,1200,1200,'TOTAL','MY_PRICE'],[null,null,1500,'TOTAL','OFFERS'],
])test(`${basis??mode}: current submit, four readers, selection, immutable Agreement and replay preserve amount/unit`,async t=>{
 const f=await setup(t);await f.actor(f.WORKER);const id=await f.need(basis,amount,4,mode),key=randomUUID();
 const r=await f.submit(id,price,2,1,key);assert.equal(r.applicationPriceBasis,unit);
 for(const sql of ['SELECT public.rpc_list_my_applications() AS value',"SELECT public.rpc_list_my_applications_page('ALL',100) AS value"]) {
  const result=await f.value(sql),row=(Array.isArray(result)?result:result.items)[0];assert.equal(row.applicationPriceBasis,unit);assert.equal(row.priceRsd,price);
 }
 await f.actor(f.REQUESTER);
 for(const sql of ['SELECT public.rpc_list_need_candidates($1) AS value','SELECT public.rpc_list_need_candidates_page($1) AS value']) {
  const result=await f.value(sql,[id]),row=(Array.isArray(result)?result:result.items)[0];assert.equal(row.applicationPriceBasis,unit);assert.equal(row.priceRsd,price);assert.equal(row.canSelect,true);
 }
 const sk=randomUUID(),ag=await f.select(id,r,sk),terms=await f.value('SELECT terms AS value FROM public.agreement_versions WHERE agreement_id=$1',[ag]);
 assert.equal(terms.priceBasis,unit);assert.equal(terms.price_rsd,price);assert.equal(terms.covered_slots,2);
 assert.equal(await f.select(id,r,sk),ag);await f.actor(f.WORKER);assert.deepEqual(await f.submit(id,price,2,1,key),{...r,idempotentReplay:true});
});
test('same numeric value cannot silently switch units through stale KEEP or selection',async t=>{
 const f=await setup(t);await f.actor(f.WORKER);const id=await f.need(null),first=await f.submit(id);await f.stale(id,first,'HOURLY');
 await f.fails(()=>f.resolveStale(first,2,'KEEP'),'STALE_REVIEW_REQUIRED');
 const r=await f.resolveStale(first,2,'UPDATE',1200,2);assert.equal(r.applicationPriceBasis,'HOURLY');
 assert.deepEqual(await f.rows('SELECT version,price_basis FROM public.marketplace_response_versions WHERE response_id=$1 ORDER BY version',[r.responseId]),[{version:1,price_basis:'TOTAL'},{version:2,price_basis:'HOURLY'}]);
 await f.db.query("UPDATE public.needs SET price_basis='PER_PERSON' WHERE id=$1",[id]);await f.actor(f.REQUESTER);
 await assert.rejects(f.select(id,{...r,needRevision:2}),/FIXED_PRICE_MISMATCH|STALE_REVIEW_REQUIRED/);
 assert.equal(await f.value('SELECT count(*)::int AS value FROM public.agreements'),0);
});
test('current application attention follows Agreement completion instead of regressing to SELECTED forever',async t=>{
 const f=await setup(t);await f.actor(f.WORKER);const id=await f.need('HOURLY'),r=await f.submit(id);
 await f.actor(f.REQUESTER);const ag=await f.select(id,r);await f.actor(f.WORKER);
 for(const state of ['CONFIRMED','AWAITING_REQUESTER','COMPLETED']) {
  await f.db.query("UPDATE public.agreement_execution SET state=$2,requester_deadline_at=now()+interval '2 days' WHERE agreement_id=$1",[ag,state]);
  for(const sql of ['SELECT public.rpc_list_my_applications() AS value',"SELECT public.rpc_list_my_applications_page('ALL',100) AS value"]) {
   const v=await f.value(sql),row=(Array.isArray(v)?v:v.items)[0];
   assert.equal(row.attentionRequired,state!=='COMPLETED');assert.equal(row.applicationPriceBasis,'HOURLY');
  }
 }
});
test('cityless readiness decision remains delegated to the current REMOTE owner, never unconditional',async t=>{
 const f=await setup(t);await f.actor(f.WORKER);await f.db.exec("UPDATE public.app_profiles SET city='' WHERE kind='WORKER';SET test.remote_ready='false';");
 const id=await f.need('HOURLY');await f.fails(()=>f.submit(id),'WORKER_PROFILE_NOT_READY');
 await f.db.exec("SET test.remote_ready='true'");const r=await f.submit(id);
 await f.actor(f.REQUESTER);await f.db.exec("SET test.remote_ready='false'");await f.fails(()=>f.select(id,r),'WORKER_PROFILE_NOT_READY');
 await f.db.exec("SET test.remote_ready='true'");assert.ok(await f.select(id,r));
});
test('foreign owner, missing Auth, world mismatch, bad amount and duplicate-key changes still refuse',async t=>{
 const f=await setup(t);const id=await f.need('HOURLY');
 await f.actor(null);await f.fails(()=>f.submit(id),'AUTH_REQUIRED');
 await f.actor(f.FOREIGN);await f.fails(()=>f.submit(id),'PROFILE_NOT_OWNED_BY_ACCOUNT');
 await f.actor(f.WORKER);await f.db.exec("SET test.world_mismatch='true'");await f.fails(()=>f.submit(id),'NEED_NOT_FOUND','P0002');
 await f.db.exec("SET test.world_mismatch='false'");await f.fails(()=>f.submit(id,2400),'FIXED_PRICE_MISMATCH');
 const key=randomUUID(),r=await f.submit(id,1200,2,1,key);await f.fails(()=>f.submit(id,1200,1,1,key),'IDEMPOTENCY_KEY_REUSED');
 await f.actor(f.FOREIGN);await f.fails(()=>f.select(id,r),'NOT_REQUESTER');
 assert.equal(await f.value('SELECT count(*)::int AS value FROM public.agreements'),0);
});
test('current edit resume keeps the same conversation and correct hourly label without reverting deadline/closure logic',async t=>{
 const f=await setup(t);await f.actor(f.REQUESTER);const id=await f.need('HOURLY');
 await f.db.query("UPDATE public.needs SET execution_location_mode='REMOTE' WHERE id=$1",[id]);
 const open=()=>f.value('SELECT public.rpc_ai_open_need_edit_conversation_v2($1) AS value',[id]);
 const a=await open(),b=await open();assert.deepEqual(b,a);
 const fact=await f.value("SELECT jsonb_build_object('value',fact_value,'display',display_value) AS value FROM public.ai_structured_facts WHERE conversation_id=$1 AND fact_key='need.price_basis'",[a.conversationId]);
 assert.deepEqual(fact,{value:'HOURLY',display:'Po osobi po satu'});
 await f.db.exec("SET test.closed='true'");await f.fails(open,'ACCOUNT_CLOSING');
 const n='public.rpc_ai_open_need_edit_conversation_v2';
 assert.equal(data.after[n].definition.replace("when 'HOURLY' then 'Po osobi po satu' ",''),data.before[n].definition);
 assert.match(data.after[n].definition,/when 'need\.response_deadline'/);
});
test('existing Agreement change preserves the immutable hourly unit, headcount and previous accepted version',async t=>{
 const f=await setup(t);await f.actor(f.WORKER);const id=await f.need('HOURLY'),r=await f.submit(id);
 await f.actor(f.REQUESTER);const ag=await f.select(id,r);
 const key=randomUUID(),proposal=await propose(f,ag,1400,key);
 assert.equal(await propose(f,ag,1400,key),proposal);
 await f.actor(f.WORKER);const ack=await respond(f,proposal);assert.equal(ack.agreementVersion,2);assert.deepEqual(await respond(f,proposal),ack);
 const versions=await f.rows('SELECT version,terms FROM public.agreement_versions WHERE agreement_id=$1 ORDER BY version',[ag]);
 assert.equal(versions.length,2);assert.equal(versions[0].terms.price_rsd,1200);assert.equal(versions[1].terms.price_rsd,1400);
 for(const row of versions) {assert.equal(row.terms.priceBasis,'HOURLY');assert.equal(row.terms.covered_slots,2);}
 await f.actor(f.REQUESTER);assert.equal(await propose(f,ag,1400,key),proposal);
 for(const patch of [{priceBasis:'TOTAL'},{covered_slots:1},{price_rsd:0},{currency:'EUR'}]) await assert.rejects(propose(f,ag,null,randomUUID(),patch,2),/UNSUPPORTED_CHANGE_FIELD|INVALID_PRICE|CHANGE_CURRENCY_INVALID/);
});
test('accepting a tampered pending proposal cannot rewrite the hourly unit even with a recomputed hash',async t=>{
 const f=await setup(t);await f.actor(f.WORKER);const id=await f.need('HOURLY'),r=await f.submit(id);
 await f.actor(f.REQUESTER);const ag=await f.select(id,r),proposal=await propose(f,ag,1400);
 await f.db.query("UPDATE public.agreement_change_proposals SET proposed_terms=jsonb_set(proposed_terms,'{priceBasis}','\"TOTAL\"') WHERE id=$1",[proposal]);
 await f.db.query("UPDATE public.agreement_change_proposals SET content_hash=encode(extensions.digest(convert_to(proposed_terms::text,'UTF8'),'sha256'),'hex') WHERE id=$1",[proposal]);
 await f.actor(f.WORKER);await f.fails(()=>respond(f,proposal),'CHANGE_TERMS_INVALID');
 assert.equal(await f.value('SELECT current_version AS value FROM public.agreements WHERE id=$1',[ag]),1);
 assert.equal((await respond(f,proposal,false)).accepted,false);
});
