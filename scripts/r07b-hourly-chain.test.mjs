// Run: node --test scripts/r07b-hourly-chain.test.mjs
// Actual PostgreSQL execution of the checked-in R07b candidate, including its
// source/target/metadata guards. This is not live Auth, RLS, PostGIS or native proof.
// Nine changing functions and eleven supporting functions are extracted verbatim
// from the pinned bootstrap (including CRLF in prosrc, required by its MD5 guard).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const bootstrap = readFileSync(new URL('../supabase/proofs/privacy/bootstrap/current-application.sql', import.meta.url), 'utf8');
const candidate = readFileSync(new URL('../supabase/candidates/r07_hourly_pricing.sql', import.meta.url), 'utf8');
assert.equal(createHash('sha256').update(bootstrap).digest('hex'), '1702ea9a70a08265d74441557c04b6840a343493905a780c6b89fc4dc598f99f');
const db = new PGlite({ extensions: { pgcrypto } });
const WORKER = '11111111-1111-4111-8111-111111111111';
const REQUESTER = '22222222-2222-4222-8222-222222222222';
const FOREIGN = '33333333-3333-4333-8333-333333333333';
const PROFILE = '44444444-4444-4444-8444-444444444444';
const REQUESTER_PROFILE = '55555555-5555-4555-8555-555555555555';
const changedNames = ['private.assert_application_price_v5', 'public.rpc_submit_response',
  'public.rpc_resolve_stale_response_after_need_edit', 'public.rpc_select_response',
  'public.rpc_list_need_candidates', 'public.rpc_list_need_candidates_page',
  'public.rpc_list_my_applications', 'public.rpc_list_my_applications_page',
  'public.rpc_ai_open_need_edit_conversation_v2'];
const tables = [
  'public.app_profiles', 'public.needs', 'public.marketplace_responses', 'public.marketplace_response_versions',
  'public.need_selections', 'public.agreements', 'public.agreement_versions', 'public.agreement_execution',
  'public.opportunity_deliveries', 'public.notification_deliveries', 'public.user_activity_events',
  'private.response_application_snapshots', 'private.response_submit_commands',
  'private.response_revision_resolution_commands', 'private.selection_commands',
  'private.connection_activations', 'private.connection_policy_versions',
  'public.need_sensitive', 'public.need_geography', 'public.need_requirement_details',
  'public.ai_conversations', 'public.ai_structured_facts', 'private.need_fact_registry',
];
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const value = async (sql, args = []) => (await rows(sql, args))[0]?.value;
const actor = id => value("select set_config('request.jwt.claim.sub',$1,false) as value", [id ?? '']);
const fn = (name, args = '') => {
  const marker = `CREATE OR REPLACE FUNCTION ${name}(${args}`;
  const start = bootstrap.indexOf(marker);
  assert(start >= 0, `missing function ${name}`);
  const body = bootstrap.indexOf('AS $function$', start);
  const end = bootstrap.indexOf('$function$;', body + 13);
  assert(end > body);
  return bootstrap.slice(start, end + '$function$;'.length);
};
const metadata = () => rows(`select n.nspname||'.'||p.proname as name, p.oid, p.proowner, p.proacl,
  p.prosecdef,p.proconfig,p.provolatile,p.prorettype from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname||'.'||p.proname=any($1::text[]) order by 1`, [changedNames]);
const hashes = () => rows(`select n.nspname||'.'||p.proname as name,md5(p.prosrc) as hash
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname||'.'||p.proname=any($1::text[]) order by 1`, [changedNames]);
const basisColumns = () => value(`select count(*)::integer as value from information_schema.columns
  where table_schema='public' and table_name in ('marketplace_responses','marketplace_response_versions') and column_name='price_basis'`);
async function fails(operation, message, code) {
  await assert.rejects(operation, error => {
    assert.match(error.message, new RegExp(message));
    if (code) assert.equal(error.code, code);
    return true;
  });
}
async function need(basis, amount = 1200, required = 4, mode = 'MY_PRICE') {
  const id = randomUUID();
  await db.query(`insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
    required_slots,mode,requester_price_rsd,price_basis) values($1,$2,$3,'PUBLISHED','Posao','Opis posla','Selidbe',$4,$5,$6,$7)`,
  [id, REQUESTER, REQUESTER_PROFILE, required, mode, amount, basis]);
  return id;
}
async function submit(id, price = 1200, covered = 2, revision = 1, key = randomUUID(), profile = PROFILE) {
  return value(`select public.rpc_submit_response($1,$2,$3,$4,$5,null,null,'',$6) as value`,
    [id, revision, profile, covered, price, key]);
}
async function select(id, receipt, key = randomUUID(), revision = receipt.needRevision) {
  return value(`select public.rpc_select_response($1,$2,$3,$4,$5,$6) as value`,
    [id, revision, receipt.responseId, receipt.version, receipt.contentHash, key]);
}
async function resolveStale(receipt, revision, action, price = null, covered = null, key = randomUUID()) {
  return value(`select public.rpc_resolve_stale_response_after_need_edit($1,$2,$3,$4,$5,$6,$7,null,null,'') as value`,
    [receipt.responseId, receipt.version, revision, key, action, covered, price]);
}
async function stale(id, receipt, basis, amount = 1200) {
  await db.query(`update public.needs set revision=revision+1,price_basis=$2,requester_price_rsd=$3 where id=$1`, [id, basis, amount]);
  await db.query(`update public.marketplace_responses set status='STALE_REVIEW_REQUIRED' where id=$1`, [receipt.responseId]);
}
async function immutableRows(responseId) {
  return value(`select jsonb_build_object(
    'response',(select to_jsonb(r)-'price_basis' from public.marketplace_responses r where id=$1),
    'versions',(select jsonb_agg(to_jsonb(v)-'price_basis' order by version) from public.marketplace_response_versions v where response_id=$1),
    'submit',(select jsonb_agg(to_jsonb(c) order by client_request_id) from private.response_submit_commands c where response_id=$1),
    'selections',(select jsonb_agg(to_jsonb(c) order by client_request_id) from private.selection_commands c where response_id=$1),
    'agreement',(select jsonb_agg(to_jsonb(v) order by v.version) from public.agreement_versions v join public.agreements a on a.id=v.agreement_id where a.selected_response_id=$1)
  ) as value`, [responseId]);
}
let oldMetadata, oldHashes, legacy, legacyNeed, legacyAgreement, legacySnapshot;
const legacySubmitKey = 'legacy-submit-key', legacySelectKey = 'legacy-select-key';

before(async () => {
  await db.exec(`create schema private; create schema auth; create schema extensions;
    create extension pgcrypto with schema extensions;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    set check_function_bodies=off;`);
  await db.exec(fn('private.taxonomy_handoff_valid_v1'));
  for (const name of tables) {
    const quoted = name.split('.').map(p => `"${p}"`).join('.');
    const marker = `CREATE TABLE ${quoted} (`;
    const start = bootstrap.indexOf(marker);
    assert(start >= 0, `missing table ${name}`);
    const end = bootstrap.indexOf('\n);', start);
    let ddl = bootstrap.slice(start, end + 3);
    // The sole schema substitution is a non-participating generated PostGIS
    // projection. No tested price/identity/version column is replaced or omitted.
    if (name === 'public.needs') ddl = ddl.replace(/"approx_geog" extensions\.geography\(Point,4326\) GENERATED ALWAYS AS \([\s\S]*?END\) STORED/, '"approx_geog" text');
    await db.exec(ddl);
    const escaped = quoted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const statements = [...bootstrap.matchAll(new RegExp(`ALTER TABLE ${escaped} (?:ALTER COLUMN [^;]* SET DEFAULT [^;]*|ADD CONSTRAINT [^;]*(?:PRIMARY KEY|UNIQUE|CHECK)[^;]*);`, 'g'))].map(m => m[0]);
    for (const sql of statements) await db.exec(sql);
  }
  // Explicit environmental stubs: Auth identity is a local session setting;
  // world/location/time/matching/calendar admit fixtures; public-profile content
  // is irrelevant to price propagation; notification/dispatch/audit are inert.
  // Edit-conversation geography normalization admits ONLY the exact null/REMOTE
  // fixture; this does not prove physical locations. The price validator chain,
  // geography shape validator, price labels and all fact inserts are real SQL.
  // None of the 9 changing functions, state builders, counts, receipts or hashes
  // is stubbed. FK/RLS/production triggers are outside this isolated proof.
  await db.exec(`
    create function private.accounts_same_world(uuid,uuid) returns boolean language sql stable as $$select true$$;
    create function private.need_search_time_admitted_v1(uuid,timestamptz) returns boolean language sql stable as $$select true$$;
    create function private.match_detail_for_calendar_interval(uuid,uuid,timestamptz,timestamptz) returns jsonb language sql stable as $$select '{"responseAllowed":true,"hardBlockers":[]}'::jsonb$$;
    create function private.worker_calendar_conflict(uuid,timestamptz,timestamptz,uuid) returns boolean language sql stable as $$select false$$;
    create function private.application_calendar_conflict_v1(uuid) returns boolean language sql stable as $$select false$$;
    create function public.rpc_get_public_profile(uuid) returns jsonb language sql stable as $$select '{}'::jsonb$$;
    create function private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text default 'NORMAL',jsonb default '{}',timestamptz default null) returns void language plpgsql as $$begin end$$;
    create function private.enqueue_dispatch(uuid,timestamptz) returns void language plpgsql as $$begin end$$;
    create function private.audit_marketplace(uuid,text,text,uuid,integer,jsonb) returns void language plpgsql as $$begin end$$;
    create function private.normalize_task_geography(p_value jsonb) returns jsonb language plpgsql immutable as $$
      begin
        if p_value is distinct from '{"mode":"REMOTE","start":null,"end":null,"waypoints":[],"serviceArea":null}'::jsonb then
          raise exception 'R07B_REMOTE_GEOGRAPHY_FIXTURE_ONLY' using errcode='22023';
        end if;
        return p_value;
      end $$;
  `);
  for (const name of [...changedNames, 'private.my_application_state', 'private.own_application_rows', 'public.fn_need_covered_slots']) await db.exec(fn(name));
  await db.exec(fn('private.need_candidate_states_v5', 'p_need_id uuid)'));
  await db.exec(fn('private.need_candidate_states_v5', 'p_need_id uuid, p_response_ids'));
  for (const name of ['private.validate_need_v2_fact', 'private.validate_need_v2_fact_pre_country',
    'private.validate_need_v2_fact_pre_location', 'private.validate_need_v2_fact_pre_fastest_retirement',
    'private.need_v2_location_ref_valid']) await db.exec(fn(name));
  // A declared narrow registry fixture, not a replacement implementation: each
  // value still traverses the unmodified production validation chain.
  await db.exec(`insert into private.need_fact_registry(fact_key,schema_version,value_type,required_for_draft,privacy_class,material,target_owner)
    values ('need.price_mode','NEED_FACT_V2','ENUM',true,'PUBLIC',true,'needs'),
      ('need.price_basis','NEED_FACT_V2','ENUM',false,'PUBLIC',true,'needs'),
      ('need.price_rsd','NEED_FACT_V2','INTEGER',false,'PUBLIC',true,'needs'),
      ('need.people_needed','NEED_FACT_V2','INTEGER',true,'PUBLIC',true,'needs'),
      ('need.task_geography','NEED_FACT_V2','OBJECT',true,'PUBLIC',true,'need_geography');`);
  await db.query(`insert into public.app_profiles(id,account_id,kind,display_name,city,skills,profile_status)
    values($1,$2,'WORKER','Radnik','Beograd',array['Selidbe'],'ACTIVE'),($3,$4,'REQUESTER','Naručilac','Beograd','{}','ACTIVE')`,
  [PROFILE,WORKER,REQUESTER_PROFILE,REQUESTER]);
  await db.exec(`insert into private.connection_policy_versions(policy_key,version,beneficiary_role,activation_reason,charge_mode,unit_basis,platform_cost_rsd,policy_snapshot)
    values('REQUESTER_SELECTION_V1',1,'REQUESTER','SELECTION','PROMOTIONAL_FREE','HEADCOUNT',0,
    '{"schema":"CONNECTION_POLICY_V1","policyKey":"REQUESTER_SELECTION_V1","version":1,"beneficiaryRole":"REQUESTER","activationReason":"SELECTION","chargeMode":"PROMOTIONAL_FREE","unitBasis":"HEADCOUNT","platformCostRsd":0}');`);
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
