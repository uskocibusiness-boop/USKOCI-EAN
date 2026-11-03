// Run: node --test scripts/r07b-hourly-chain.test.mjs
// Actual PostgreSQL execution of the checked-in R07b candidate, including its
// source/target/metadata guards. This is not live Auth, RLS, PostGIS or native proof.
// Nine changing functions and eleven supporting functions are extracted verbatim
// from the pinned bootstrap (including CRLF in prosrc, required by its MD5 guard).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import {createHourlyFixture} from './r07b-hourly-fixture.mjs';


const candidate=readFileSync(new URL('../supabase/candidates/r07_hourly_pricing.sql',import.meta.url),'utf8');
let db,WORKER,REQUESTER,FOREIGN,PROFILE,REQUESTER_PROFILE,changedNames,bootstrap,
 rows,value,actor,fn,metadata,hashes,basisColumns,fails,need,submit,select,resolveStale,stale,immutableRows;
let oldMetadata,oldHashes,legacy,legacyNeed,legacyAgreement,legacySnapshot;
const legacySubmitKey='legacy-submit-key',legacySelectKey='legacy-select-key';
before(async()=>{
 ({db,WORKER,REQUESTER,FOREIGN,PROFILE,REQUESTER_PROFILE,changedNames,bootstrap,
 rows,value,actor,fn,metadata,hashes,basisColumns,fails,need,submit,select,resolveStale,stale,immutableRows}=await createHourlyFixture());
  oldMetadata = await metadata(); oldHashes = await hashes();
  await actor(WORKER);
  legacyNeed = await need(null);
  legacy = await submit(legacyNeed,1200,2,1,legacySubmitKey);
  await actor(REQUESTER);
  legacyAgreement = await select(legacyNeed,legacy,legacySelectKey);
  legacySnapshot = await immutableRows(legacy.responseId);
});
after(async () => { await db.close(); });

test('candidate refuses an unmarked database without changing schema or functions', async () => {
  await fails(() => db.exec(candidate), 'R07B_DISPOSABLE_TARGET_REQUIRED');
  assert.equal(await basisColumns(),0); assert.deepEqual(await hashes(),oldHashes);
});
for (const name of ['private.assert_application_price_v5','public.rpc_ai_open_need_edit_conversation_v2'])
test(`candidate refuses source drift in ${name} and rollback restores its exact preimage`, async () => {
  await db.exec('begin');
  await db.exec("set local uskoci.r07b.disposable='LOCAL_ONLY'");
  await db.exec(fn(name).replace('begin', 'begin -- simulated drift'));
  await fails(() => db.exec(candidate), 'R07B_SOURCE_DRIFT');
  await db.exec('rollback');
  assert.equal(await basisColumns(),0); assert.deepEqual(await hashes(),oldHashes);
});
test('candidate changes and both additive columns roll back atomically', async () => {
  await db.exec("begin; set local uskoci.r07b.disposable='LOCAL_ONLY'");
  await db.exec(candidate); assert.equal(await basisColumns(),2);
  await db.exec('rollback');
  assert.equal(await basisColumns(),0); assert.deepEqual(await hashes(),oldHashes);
  assert.deepEqual(await immutableRows(legacy.responseId),legacySnapshot);
});
test('exact candidate applies with unchanged function identity/ACL/config and untouched old receipts/rows', async () => {
  await db.exec("set uskoci.r07b.disposable='LOCAL_ONLY'");
  await db.exec(candidate);
  assert.equal(await basisColumns(),2); assert.deepEqual(await metadata(),oldMetadata);
  assert.deepEqual(await immutableRows(legacy.responseId),legacySnapshot);
  assert.equal(await value('select price_basis as value from public.marketplace_responses where id=$1',[legacy.responseId]),null);
});
test('legacy committed submit/selection replay remains unchanged after the additive upgrade', async () => {
  await actor(WORKER);
  assert.deepEqual(await submit(legacyNeed,1200,2,1,legacySubmitKey),{...legacy,idempotentReplay:true});
  const list=await value('select public.rpc_list_my_applications() as value');
  assert.equal(list.find(r=>r.applicationId===legacy.responseId).applicationPriceBasis,'TOTAL');
  await actor(REQUESTER);
  assert.equal(await select(legacyNeed,legacy,legacySelectKey),legacyAgreement);
  assert.deepEqual(await immutableRows(legacy.responseId),legacySnapshot);
});
for (const scenario of [
  {basis:'HOURLY',amount:1200,price:1200,unit:'HOURLY'},
  {basis:'TOTAL',amount:1200,price:600,unit:'TOTAL'},
  {basis:'PER_PERSON',amount:1200,price:2400,unit:'TOTAL'},
  {basis:null,amount:1200,price:1200,unit:'TOTAL'},
  {basis:null,amount:null,price:1500,unit:'TOTAL',mode:'OFFERS'},
]) test(`${scenario.basis??scenario.mode??'legacy null'}: submit -> both read variants -> select -> Agreement -> replay`, async () => {
  await actor(WORKER);
  const id=await need(scenario.basis,scenario.amount,4,scenario.mode);
  const key=randomUUID(), receipt=await submit(id,scenario.price,2,1,key);
  assert.equal(receipt.applicationPriceBasis,scenario.unit);
  const version=(await rows('select price_rsd,covered_slots,price_basis from public.marketplace_response_versions where response_id=$1',[receipt.responseId]))[0];
  assert.deepEqual(version,{price_rsd:scenario.price,covered_slots:2,price_basis:scenario.unit});
  for(const sql of ['select public.rpc_list_my_applications() as value',"select public.rpc_list_my_applications_page('ALL',100) as value"]) {
    const result=await value(sql), entry=(Array.isArray(result)?result:result.items).find(r=>r.applicationId===receipt.responseId);
    assert.equal(entry.applicationPriceBasis,scenario.unit); assert.equal(entry.priceRsd,scenario.price);
  }
  await actor(REQUESTER);
  for(const sql of ['select public.rpc_list_need_candidates($1) as value','select public.rpc_list_need_candidates_page($1) as value']) {
    const result=await value(sql,[id]),entry=(Array.isArray(result)?result:result.items)[0];
    assert.equal(entry.applicationPriceBasis,scenario.unit); assert.equal(entry.priceRsd,scenario.price); assert.equal(entry.canSelect,true);
  }
  const selectKey=randomUUID(), agreement=await select(id,receipt,selectKey);
  const terms=await value('select terms as value from public.agreement_versions where agreement_id=$1',[agreement]);
  assert.equal(terms.priceBasis,scenario.unit); assert.equal(terms.price_rsd,scenario.price); assert.equal(terms.covered_slots,2);
  assert.equal(await select(id,receipt,selectKey),agreement);
  assert.equal(await value('select count(*)::integer as value from private.connection_activations where agreement_id=$1',[agreement]),1);
  await actor(WORKER); assert.deepEqual(await submit(id,scenario.price,2,1,key),{...receipt,idempotentReplay:true});
});
test('HOURLY rejects multiplied team amount and bad price/slots/revision without writes', async () => {
  await actor(WORKER); const id=await need('HOURLY');
  for(const [price,covered,revision,error] of [[2400,2,1,'FIXED_PRICE_MISMATCH'],[0,2,1,'INVALID_PRICE'],[-1,2,1,'INVALID_PRICE'],[null,2,1,'INVALID_PRICE'],[1200,0,1,'INVALID_COVERED_SLOTS'],[1200,5,1,'NEED_REMAINING_CAPACITY_EXCEEDED'],[1200,2,2,'STALE_REVIEW_REQUIRED']])
    await fails(()=>submit(id,price,covered,revision),error);
  assert.equal(await value('select count(*)::integer as value from public.marketplace_responses where need_id=$1',[id]),0);
});
test('known three-hour interval preserves the 1200 hourly rate for two people through selection', async () => {
  const starts='2099-05-01T09:00:00Z',ends='2099-05-01T12:00:00Z';
  await actor(WORKER); const id=await need('HOURLY');
  const receipt=await value(`select public.rpc_submit_response($1,1,$2,2,1200,$3,$4,'',$5) as value`,
    [id,PROFILE,starts,ends,randomUUID()]);
  assert.equal(receipt.applicationPriceBasis,'HOURLY');
  const version=await value(`select jsonb_build_object('price',price_rsd,'basis',price_basis,
    'people',covered_slots,'start',proposed_start_at,'end',proposed_end_at) as value
    from public.marketplace_response_versions where response_id=$1 and version=1`,[receipt.responseId]);
  assert.equal(version.price,1200); assert.equal(version.basis,'HOURLY'); assert.equal(version.people,2);
  assert.equal(Date.parse(version.start),Date.parse(starts)); assert.equal(Date.parse(version.end),Date.parse(ends));
  await actor(REQUESTER); const agreement=await select(id,receipt);
  const terms=await value('select terms as value from public.agreement_versions where agreement_id=$1',[agreement]);
  assert.equal(terms.price_rsd,1200); assert.equal(terms.priceBasis,'HOURLY'); assert.equal(terms.covered_slots,2);
  assert.equal(terms.schedule_source,'APPLICATION_PROPOSAL');
  assert.equal(Date.parse(terms.proposed_start_at),Date.parse(starts));
  assert.equal(Date.parse(terms.proposed_end_at),Date.parse(ends));
  const hours=(Date.parse(terms.proposed_end_at)-Date.parse(terms.proposed_start_at))/3_600_000;
  assert.equal(hours,3);
  // 7200 is the arithmetic meaning of this agreed rate/headcount/interval;
  // neither the application nor Agreement replaces the stored rate with it.
  assert.equal(terms.price_rsd*terms.covered_slots*hours,7200);
});
test('auth/profile/ownership and idempotency mismatches remain guarded', async () => {
  const id=await need('HOURLY'); await actor(null);
  await fails(()=>submit(id),'AUTH_REQUIRED');
  await actor(REQUESTER); await fails(()=>submit(id),'OWN_NEED');
  await actor(FOREIGN); await fails(()=>submit(id),'PROFILE_NOT_OWNED_BY_ACCOUNT');
  await actor(WORKER); const key=randomUUID(),receipt=await submit(id,1200,2,1,key);
  await fails(()=>submit(id,1200,1,1,key),'IDEMPOTENCY_KEY_REUSED');
  await fails(()=>select(id,receipt),'NOT_REQUESTER');
  await actor(REQUESTER); await fails(()=>select(id,{...receipt,contentHash:'0'.repeat(64)}),'STALE_REVIEW_REQUIRED');
  await fails(()=>select(id,receipt,randomUUID(),2),'STALE_REVIEW_REQUIRED');
  assert.equal(await value('select count(*)::integer as value from public.agreements where need_id=$1',[id]),0);
});
test('stale KEEP cannot reinterpret TOTAL as HOURLY; explicit UPDATE persists a new unit and replays', async () => {
  await actor(WORKER);
  const id=await need(null),receipt=await submit(id); await stale(id,receipt,'HOURLY');
  await fails(()=>resolveStale(receipt,2,'KEEP'),'STALE_REVIEW_REQUIRED','PT409');
  const key=randomUUID(),updated=await resolveStale(receipt,2,'UPDATE',1200,2,key);
  assert.equal(updated.applicationPriceBasis,'HOURLY'); assert.equal(updated.version,2);
  assert.deepEqual(await rows('select version,price_basis from public.marketplace_response_versions where response_id=$1 order by version',[receipt.responseId]),[{version:1,price_basis:'TOTAL'},{version:2,price_basis:'HOURLY'}]);
  assert.deepEqual(await resolveStale(receipt,2,'UPDATE',1200,2,key),{...updated,idempotentReplay:true});
  await actor(REQUESTER); const agreement=await select(id,{...updated,needRevision:2});
  assert.equal((await value('select terms as value from public.agreement_versions where agreement_id=$1',[agreement])).priceBasis,'HOURLY');
});
test('same-unit stale KEEP remains valid and preserves the hourly amount', async () => {
  await actor(WORKER); const id=await need('HOURLY'),receipt=await submit(id); await stale(id,receipt,'HOURLY');
  const updated=await resolveStale(receipt,2,'KEEP');
  assert.equal(updated.applicationPriceBasis,'HOURLY');
  assert.equal(await value('select price_rsd as value from public.marketplace_response_versions where response_id=$1 and version=2',[receipt.responseId]),1200);
});
test('selection refuses same numeric amount with a changed meaning even if revision is unchanged', async () => {
  await actor(WORKER); const id=await need(null),receipt=await submit(id);
  await db.query("update public.needs set price_basis='HOURLY' where id=$1",[id]);
  await actor(REQUESTER); await fails(()=>select(id,receipt),'STALE_REVIEW_REQUIRED','PT409');
  assert.equal(await value('select count(*)::integer as value from public.agreements where need_id=$1',[id]),0);
});
test('unit alone changes application content identity while retaining the older version and submit receipt', async () => {
  await actor(WORKER); const id=await need(null),key=randomUUID(),first=await submit(id,1200,2,1,key);
  const oldVersion=await value('select to_jsonb(v) as value from public.marketplace_response_versions v where response_id=$1 and version=1',[first.responseId]);
  // Deliberately hold every other hash input constant to isolate the amount unit.
  await db.query("update public.needs set price_basis='HOURLY' where id=$1",[id]);
  const second=await submit(id);
  assert.equal(second.responseId,first.responseId); assert.equal(second.version,2);
  assert.notEqual(second.contentHash,first.contentHash);
  assert.equal(first.applicationPriceBasis,'TOTAL'); assert.equal(second.applicationPriceBasis,'HOURLY');
  assert.deepEqual(await value('select to_jsonb(v) as value from public.marketplace_response_versions v where response_id=$1 and version=1',[first.responseId]),oldVersion);
  assert.deepEqual(await submit(id,1200,2,1,key),{...first,idempotentReplay:true});
});
test('HOURLY to TOTAL also requires explicit stale UPDATE and retains the first hourly version', async () => {
  await actor(WORKER); const id=await need('HOURLY'),first=await submit(id); await stale(id,first,'TOTAL');
  await fails(()=>resolveStale(first,2,'KEEP'),'STALE_REVIEW_REQUIRED','PT409');
  const updated=await resolveStale(first,2,'UPDATE',600,2);
  assert.equal(updated.applicationPriceBasis,'TOTAL');
  assert.deepEqual(await rows('select version,price_rsd,price_basis from public.marketplace_response_versions where response_id=$1 order by version',[first.responseId]),
    [{version:1,price_rsd:1200,price_basis:'HOURLY'},{version:2,price_rsd:600,price_basis:'TOTAL'}]);
  await actor(REQUESTER); const agreement=await select(id,{...updated,needRevision:2});
  const terms=await value('select terms as value from public.agreement_versions where agreement_id=$1',[agreement]);
  assert.equal(terms.priceBasis,'TOTAL'); assert.equal(terms.price_rsd,600);
});
test('TOTAL/PER_PERSON fixed-price mismatch and additive unit CHECK constraints remain enforced', async () => {
  await actor(WORKER);
  for(const [basis,wrong] of [['TOTAL',1200],['PER_PERSON',1200]]) {
    const id=await need(basis); await fails(()=>submit(id,wrong),'FIXED_PRICE_MISMATCH','22023');
  }
  const id=await need('HOURLY'),receipt=await submit(id);
  for(const table of ['marketplace_responses','marketplace_response_versions']) {
    const column=table==='marketplace_responses'?'id':'response_id';
    await fails(()=>db.query(`update public.${table} set price_basis='PER_PERSON' where ${column}=$1`,[receipt.responseId]),`${table}_price_basis_check`,'23514');
  }
});
for (const [basis,label] of [['HOURLY','Po osobi po satu'],['TOTAL','Ukupno'],['PER_PERSON','Po osobi']])
  test(`${basis}: edit conversation seeds the actual unit/display/price and does not modify the saved task`, async () => {
    const id=await need(basis);
    await db.query("update public.needs set execution_location_mode='REMOTE' where id=$1",[id]);
    const original=await value('select to_jsonb(n) as value from public.needs n where id=$1',[id]);
    await actor(REQUESTER);
    const receipt=await value('select public.rpc_ai_open_need_edit_conversation_v2($1) as value',[id]);
    assert.equal(receipt.needId,id); assert.equal(receipt.revision,1); assert.equal(receipt.authoritative,true);
    const facts=await rows('select fact_key,fact_value,display_value,status,source,account_id,subject_need_id from public.ai_structured_facts where conversation_id=$1 order by fact_key',[receipt.conversationId]);
    const unit=facts.find(f=>f.fact_key==='need.price_basis'), amount=facts.find(f=>f.fact_key==='need.price_rsd');
    assert.equal(unit.fact_value,basis); assert.equal(unit.display_value,label);
    assert.equal(amount.fact_value,1200); assert.equal(amount.display_value,'1200 RSD');
    assert.equal(facts.find(f=>f.fact_key==='need.people_needed').fact_value,4);
    assert.equal(facts.length,5);
    for(const fact of facts) {
      assert.equal(fact.status,'CONFIRMED'); assert.equal(fact.source,'SYSTEM_DERIVED');
      assert.equal(fact.account_id,REQUESTER); assert.equal(fact.subject_need_id,id);
    }
    assert.deepEqual(await value('select to_jsonb(n) as value from public.needs n where id=$1',[id]),original);
  });
test('edit conversation still refuses missing/foreign auth and an already selected task without creating facts', async () => {
  const id=await need('HOURLY');
  const count=await value('select count(*)::integer as value from public.ai_structured_facts');
  await actor(null); await fails(()=>value('select public.rpc_ai_open_need_edit_conversation_v2($1) as value',[id]),'AUTH_REQUIRED','28000');
  await actor(FOREIGN); await fails(()=>value('select public.rpc_ai_open_need_edit_conversation_v2($1) as value',[id]),'NEED_NOT_OWNED','42501');
  await actor(REQUESTER); await fails(()=>value('select public.rpc_ai_open_need_edit_conversation_v2($1) as value',[legacyNeed]),'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR');
  assert.equal(await value('select count(*)::integer as value from public.ai_structured_facts'),count);
});
test('edit fact price validation uses the real validators, with no permissive price stub', async () => {
  await value(`select private.validate_need_v2_fact('need.price_basis','"HOURLY"') as value`);
  await fails(()=>value(`select private.validate_need_v2_fact('need.price_basis','"DAY"') as value`),'V2_PRICE_BASIS_INVALID','22023');
  await fails(()=>value(`select private.validate_need_v2_fact('need.price_basis','1200') as value`),'V2_FACT_TYPE_INVALID','22023');
  await fails(()=>value(`select private.validate_need_v2_fact('need.price_rsd','0') as value`),'V2_PRICE_INVALID','22023');
  await fails(()=>value(`select private.validate_need_v2_fact('need.price_rsd','12.5') as value`),'V2_FACT_INTEGER_REQUIRED','22023');
});
