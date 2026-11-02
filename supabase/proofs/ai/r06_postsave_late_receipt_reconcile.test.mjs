// Actual reconciler/finalizer/claim/binding-tick SQL + actual JS driver in PGlite.
// Real pgcrypto and closure guards. Save/review data, auth.jwt and underlying
// binders are synthetic: routing proof, not eligibility/DEV/provider/concurrency.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { processTaxonomyPostSaveTick } from '../../functions/_shared/taxonomyPostSaveWorker.mjs';

const baseline = process.env.R06_POSTSAVE_LATE_RECEIPT_BASELINE === '1';
const candidate = readFileSync(new URL('./r06_postsave_late_receipt_reconcile_candidate.sql', import.meta.url), 'utf8');
const finalizerCandidate = readFileSync(new URL('./r06_postsave_receipt_finalization_candidate.sql', import.meta.url), 'utf8');
const snapshot = readFileSync(new URL('../privacy/bootstrap/current-application.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const reconcileName = 'public.rpc_taxonomy_reconcile_reviewed_outbox_service';
const signature = reconcileName + '(integer)';
const functionSql = name => {
  const start = snapshot.indexOf('CREATE OR REPLACE FUNCTION ' + name + '(');
  const end = snapshot.indexOf('$function$;', snapshot.indexOf('AS $function$', start) + 14);
  assert.ok(start >= 0 && end > start, 'captured function required: ' + name);
  return snapshot.slice(start, end + '$function$;'.length);
};
const predecessor = functionSql(reconcileName);
assert.equal(createHash('md5').update(predecessor.split('AS $function$')[1].split('$function$;')[0]).digest('hex'),
  '41747bdfdba0af1d941bf4fb91f1a887');
const actualTables = ['work_taxonomy_review_outbox_v1', 'work_taxonomy_review_batches_v1'].map(name =>
  snapshot.match(new RegExp(`CREATE TABLE "private"\\."${name}" \\([\\s\\S]*?\\n\\);`))[0] + '\n' +
  snapshot.match(new RegExp(`^ALTER TABLE "private"\\."${name}" .*;$`, 'gm')).join('\n')).join('\n');
const actualFunctions = ['private.closure_account_key', 'private.closure_account_restricted', 'private.closure_assert_open',
  'private.closure_taxonomy_try_owner_v1', 'public.rpc_taxonomy_finalize_reviewed_batch_service',
  'public.rpc_taxonomy_claim_reviewed_batches_service', 'public.rpc_taxonomy_bind_ready_reviews_service', reconcileName]
  .map(functionSql).join('\n');
const id = n => `00000000-6060-4606-8606-${String(n).padStart(12, '0')}`;
let db, next = 100;
async function database(install = true) {
  const d = new PGlite({ extensions: { pgcrypto } });
  await d.exec(`CREATE SCHEMA private; CREATE SCHEMA extensions; CREATE SCHEMA auth;
    CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE private.account_closure_requests(account_id uuid,state text);
    CREATE TABLE private.work_taxonomy_review_outbox_control_v1(singleton boolean,enabled boolean);
    INSERT INTO private.work_taxonomy_review_outbox_control_v1 VALUES(true,true);
    CREATE TABLE private.work_taxonomy_binding_control_v1(singleton boolean,enabled boolean);
    INSERT INTO private.work_taxonomy_binding_control_v1 VALUES(true,true);
    CREATE TABLE private.worker_ai_saves(account_id uuid,client_request_id uuid,review_id uuid,created_at timestamptz);
    CREATE TABLE private.worker_ai_reviews(id uuid,account_id uuid,envelope jsonb);
    CREATE TABLE private.ai_task_review_commands(account_id uuid,client_request_id uuid,review_id uuid,state text,created_at timestamptz,need_id uuid,need_revision integer);
    CREATE TABLE private.ai_task_reviews(id uuid,account_id uuid,envelope jsonb);
    CREATE TABLE private.synthetic_binder_calls(owner_id uuid,request_key uuid,review_id uuid,purpose text);
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT '{"role":"service_role"}'::jsonb$$;
    CREATE FUNCTION public.rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid) RETURNS jsonb LANGUAGE plpgsql AS $$BEGIN
      INSERT INTO private.synthetic_binder_calls VALUES($1,$2,$3,'WORKER_CAPABILITY');
      RETURN '{"status":"BOUND_WORKER_SERVICES","dispatchAuthority":"NONE","notificationAuthority":"NONE"}'::jsonb;END;$$;
    CREATE FUNCTION public.rpc_taxonomy_bind_reviewed_need_service(uuid,uuid,uuid,uuid,integer) RETURNS jsonb LANGUAGE plpgsql AS $$BEGIN
      INSERT INTO private.synthetic_binder_calls VALUES($1,$2,$3,'NEED_SERVICE');
      RETURN '{"status":"BOUND_NEED_REVISION","dispatchAuthority":"NONE","notificationAuthority":"NONE"}'::jsonb;END;$$;
    ${actualTables}\n${actualFunctions}
    REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION ${signature} TO service_role;
    REVOKE ALL ON FUNCTION public.rpc_taxonomy_finalize_reviewed_batch_service(uuid,uuid,text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_finalize_reviewed_batch_service(uuid,uuid,text) TO service_role;
    SELECT set_config('uskoci.r06_postsave_receipt.disposable','LOCAL_ONLY',false);
    SELECT set_config('uskoci.r06_postsave_late_receipt.disposable','LOCAL_ONLY',false);`);
  await d.exec(finalizerCandidate);
  if (install && !baseline) await d.exec(candidate);
  return d;
}
test.before(async () => { db = await database(); });
test.after(async () => { await db?.close(); });
test.beforeEach(async () => {
  await db.exec(`TRUNCATE private.work_taxonomy_review_outbox_v1,private.work_taxonomy_review_batches_v1,
    private.worker_ai_saves,private.worker_ai_reviews,private.ai_task_review_commands,private.ai_task_reviews,
    private.account_closure_requests,private.synthetic_binder_calls;
    UPDATE private.work_taxonomy_review_outbox_control_v1 SET enabled=true;`);
});
const reconcile = (limit = 25, d = db) => d.query(`SELECT ${reconcileName}($1) value`, [limit]).then(r => r.rows[0].value);
const claim = () => db.query('SELECT public.rpc_taxonomy_claim_reviewed_batches_service(3) value').then(r => r.rows[0].value);
const bind = () => db.query('SELECT public.rpc_taxonomy_bind_ready_reviews_service(3) value').then(r => r.rows[0].value);
const row = job => db.query('SELECT * FROM private.work_taxonomy_review_outbox_v1 WHERE owner_account_id=$1 AND request_key=$2',
  [job.owner, job.request]).then(r => r.rows[0]);
const allRows = () => db.query(`SELECT
  (SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY id),'[]') FROM private.work_taxonomy_review_outbox_v1 q) outbox,
  (SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY id),'[]') FROM private.work_taxonomy_review_batches_v1 b) batches,
  (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY owner_id),'[]') FROM private.synthetic_binder_calls c) bindings`).then(r => r.rows[0]);
async function lateReceipt(job, mismatch = null) {
  const j = { ...job, plans: structuredClone(job.plans) };
  if (['owner', 'request', 'review'].includes(mismatch)) j[mismatch] = id(999999);
  if (mismatch === 'purpose') j.purpose = j.purpose === 'WORKER_CAPABILITY' ? 'NEED_SERVICE' : 'WORKER_CAPABILITY';
  if (mismatch === 'plans') j.plans[0].mode = 'ON_SITE';
  const result = { status: 'COMMITTED', catalogVersion: 3, items: [{ categoryId: id(999), mode: 'REMOTE' }],
    capabilityAuthority: 'NONE', needRevisionAuthority: 'NONE', notificationAuthority: 'NONE', requiresBinding: true };
  if (mismatch === 'status') result.status = 'PENDING';
  if (mismatch === 'missingStatus') delete result.status;
  await db.query(`INSERT INTO private.work_taxonomy_review_batches_v1
    (owner_account_id,request_key,source_review_id,purpose,plans,review_digest,plans_digest,catalog_version,result)
    VALUES($1,$2,$3,$4,$5::jsonb,repeat('a',64),CASE WHEN $7 THEN repeat('0',64)
      ELSE encode(extensions.digest(convert_to(($5::jsonb)::text,'UTF8'),'sha256'),'hex') END,3,$6::jsonb)`,
  [j.owner, j.request, j.review, j.purpose, JSON.stringify(j.plans), JSON.stringify(result), mismatch === 'hash']);
  return result;
}
async function fixture({ purpose = 'WORKER_CAPABILITY', error = 'TEMPORARY_UNAVAILABLE', missing = false,
  receipt = false, mismatch = null } = {}) {
  const n = next++ * 10;
  const j = { id: id(n), owner: id(n + 1), request: id(n + 2), review: id(n + 3), lease: id(n + 4), purpose,
    plans: [{ action: 'REUSE_EXISTING', service: 'Synthetic service', mode: 'REMOTE', categoryId: id(999) }] };
  const envelope = { canAccept: true, classificationState: 'READY', classificationCatalogFingerprint: 'synthetic',
    classificationCandidates: j.plans, profileId: id(n + 6) };
  if (purpose === 'WORKER_CAPABILITY') {
    await db.query('INSERT INTO private.worker_ai_reviews VALUES($1,$2,$3::jsonb)', [j.review, j.owner, JSON.stringify(envelope)]);
    await db.query('INSERT INTO private.worker_ai_saves VALUES($1,$2,$3,statement_timestamp())', [j.owner, j.request, j.review]);
  } else {
    await db.query('INSERT INTO private.ai_task_reviews VALUES($1,$2,$3::jsonb)', [j.review, j.owner, JSON.stringify(envelope)]);
    await db.query("INSERT INTO private.ai_task_review_commands VALUES($1,$2,$3,'ACCEPTED',statement_timestamp(),$4,1)", [j.owner, j.request, j.review, id(n + 6)]);
  }
  if (!missing) {
    await db.query(`INSERT INTO private.work_taxonomy_review_outbox_v1
      (id,owner_account_id,request_key,source_review_id,purpose,plans,state,attempts,lease_token,lease_until)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,'CLAIMED',5,$7,statement_timestamp()+interval '2 minutes')`,
    [j.id, j.owner, j.request, j.review, purpose, JSON.stringify(j.plans), j.lease]);
    const finalized = (await db.query('SELECT public.rpc_taxonomy_finalize_reviewed_batch_service($1,$2,$3) value',
      [j.id, j.lease, error])).rows[0].value;
    assert.equal(finalized.status, 'REVIEW_REQUIRED', 'no receipt is visible at finalization');
  }
  if (receipt) await lateReceipt(j, mismatch);
  return j;
}

for (const purpose of ['WORKER_CAPABILITY', 'NEED_SERVICE']) {
  test(`${purpose}: receipt arrives after terminal finalize; actual next driver tick recovers without another commit`, async () => {
    const job = await fixture({ purpose });
    assert.equal((await row(job)).state, 'REVIEW_REQUIRED');
    const receipt = await lateReceipt(job), before = await allRows(), calls = [];
    const out = await processTaxonomyPostSaveTick(async (name, args) => {
      calls.push(name);
      if (name === 'rpc_taxonomy_reconcile_reviewed_outbox_service') return reconcile(args.p_limit);
      if (name === 'rpc_taxonomy_claim_reviewed_batches_service') return claim();
      assert.fail('late receipt must not dispatch commit/finalize/provider: ' + name);
    });
    assert.equal(out.reconciled, 1); assert.equal(out.claimed, 0); assert.equal(out.admitted, 0);
    assert.equal(out.capabilityAuthority, 'NONE'); assert.equal(out.needRevisionAuthority, 'NONE'); assert.equal(out.notificationAuthority, 'NONE');
    assert.deepEqual(calls, ['rpc_taxonomy_reconcile_reviewed_outbox_service', 'rpc_taxonomy_claim_reviewed_batches_service']);
    const repaired = await row(job);
    assert.equal(repaired.state, 'COMMITTED'); assert.deepEqual(repaired.result, receipt); assert.equal(repaired.error_code, null);
    assert.equal(repaired.attempts, 5); assert.equal(repaired.lease_token, null); assert.equal(repaired.lease_until, null);
    assert.equal(repaired.binding_state, 'PENDING'); assert.deepEqual((await allRows()).batches, before.batches);
    assert.equal(await reconcile(), 0, 'a later tick cannot repair the same row twice');
    const routed = await bind();
    assert.equal(routed.claimed, 1); assert.equal(routed.bound, 1);
    assert.equal(routed.notificationAuthority, 'NONE'); assert.equal(routed.dispatchAuthority, 'NONE');
    assert.deepEqual((await allRows()).bindings, [{ owner_id: job.owner, request_key: job.request, review_id: job.review, purpose }]);
    assert.equal((await bind()).claimed, 0, 'binding orchestrator routing is one-time; underlying binder is synthetic');
  });
}

for (const mismatch of ['owner', 'request', 'review', 'purpose', 'plans', 'hash', 'status', 'missingStatus']) {
  test(`late ${mismatch} mismatch does not repair an unrelated operation`, async () => {
    await fixture({ receipt: true, mismatch });
    const before = await allRows();
    assert.equal(await reconcile(), 0); assert.deepEqual(await allRows(), before);
    assert.deepEqual(await claim(), []); assert.equal((await bind()).claimed, 0);
  });
}

test('no receipt and exact receipt on a permanent refusal remain terminal without reprocessing', async () => {
  await fixture(); await fixture({ receipt: true, error: 'BATCH_REVIEW_REQUIRED' });
  const before = await allRows();
  assert.equal(await reconcile(), 0); assert.deepEqual(await allRows(), before);
  assert.deepEqual(await claim(), []); assert.equal((await bind()).claimed, 0);
});

for (const error of ['TIMEOUT', 'NETWORK_UNAVAILABLE', 'TEMPORARY_UNAVAILABLE']) {
  test(`${error} plus the exact late receipt is recoverable`, async () => {
    const job = await fixture({ error, receipt: true });
    assert.equal(await reconcile(), 1); assert.equal((await row(job)).state, 'COMMITTED');
  });
}

test('shared limit drains exact receipts and missing saves; older unmatched terminal rows cannot consume it', async () => {
  await fixture(); await fixture({ receipt: true, mismatch: 'hash' });
  await fixture({ receipt: true, error: 'BATCH_REVIEW_REQUIRED' });
  const first = await fixture({ receipt: true }), second = await fixture({ receipt: true });
  const missing = await fixture({ missing: true, purpose: 'NEED_SERVICE' });
  const counts = [];
  for (let n = 0; n < 4; n++) counts.push(await reconcile(1));
  assert.deepEqual(counts, [1, 1, 1, 0]);
  for (const j of [first, second]) assert.equal((await row(j)).state, 'COMMITTED');
  assert.equal((await row(missing)).state, 'PENDING');
  const third = await fixture({ receipt: true });
  const missing2 = await fixture({ missing: true });
  assert.equal(await reconcile(2), 2, 'repaired plus inserted share one limit');
  assert.equal((await row(third)).state, 'COMMITTED'); assert.equal((await row(missing2)).state, 'PENDING');
});

test('closure guards skip every restricted owner for both late repair and missing-save recovery', async () => {
  for (const state of ['READY', 'EXECUTING', 'FAILED', 'CLOSED']) {
    for (const missing of [false, true]) {
      const j = await fixture({ missing, receipt: !missing });
      await db.query('INSERT INTO private.account_closure_requests VALUES($1,$2)', [j.owner, state]);
    }
  }
  const before = await allRows(); assert.equal(await reconcile(), 0); assert.deepEqual(await allRows(), before);
});

test('catalog repair never resets an independent terminal binding refusal or its attempt history', async () => {
  const j = await fixture({ receipt: true });
  await db.query(`UPDATE private.work_taxonomy_review_outbox_v1 SET binding_state='REVIEW_REQUIRED',binding_attempts=5,
    binding_error_code='BINDING_REVIEW_REQUIRED',binding_result='{"synthetic":"prior refusal"}' WHERE id=$1`, [j.id]);
  const before = await row(j);
  assert.equal(await reconcile(), 1);
  const after = await row(j);
  for (const key of ['binding_state', 'binding_attempts', 'binding_error_code', 'binding_retry_after', 'binding_result',
    'attempts', 'lease_token', 'lease_until', 'retry_after', 'created_at']) assert.deepEqual(after[key], before[key], key);
  assert.equal((await bind()).claimed, 0);
});

test('late recovery does not steal active leases or change other queue states', async () => {
  for (const state of ['PENDING', 'RETRY', 'CLAIMED', 'COMMITTED']) {
    const j = await fixture({ receipt: true });
    await db.query(`UPDATE private.work_taxonomy_review_outbox_v1 SET state=$2,
      lease_token=CASE WHEN $2='CLAIMED' THEN $3::uuid ELSE NULL END,
      lease_until=CASE WHEN $2='CLAIMED' THEN statement_timestamp()+interval '2 minutes' ELSE NULL END WHERE id=$1`, [j.id, state, j.lease]);
  }
  const before = await allRows(); assert.equal(await reconcile(), 0); assert.deepEqual(await allRows(), before);
});

test('disabled recovery and invalid/null bounds cannot mutate even a known exact receipt', async () => {
  await fixture({ receipt: true });
  const before = await allRows();
  await db.exec('UPDATE private.work_taxonomy_review_outbox_control_v1 SET enabled=false');
  assert.equal(await reconcile(), 0); assert.deepEqual(await allRows(), before);
  await db.exec('UPDATE private.work_taxonomy_review_outbox_control_v1 SET enabled=true');
  for (const limit of [null, 0, -1, 201]) {
    await assert.rejects(reconcile(limit), /OUTBOX_RECOVERY_LIMIT_INVALID/);
    assert.deepEqual(await allRows(), before);
  }
});

test('same function/ACL is preserved; absent LOCAL_ONLY, changed body or broadened grants fail atomically', async t => {
  const d = await database(false); t.after(() => d.close());
  const metadata = () => d.query(`SELECT proowner::regrole::text owner,proacl::text acl,prosecdef,proconfig,
    proname,proargtypes::text,prorettype::regtype::text FROM pg_proc WHERE oid=$1::regprocedure`, [signature]).then(r => r.rows[0]);
  const before = await metadata();
  await d.exec("SELECT set_config('uskoci.r06_postsave_late_receipt.disposable','',false)");
  await assert.rejects(d.exec(candidate), /R06_POSTSAVE_LATE_RECEIPT_LOCAL_ONLY/); await d.exec('ROLLBACK');
  assert.deepEqual(await metadata(), before);
  await d.exec("SELECT set_config('uskoci.r06_postsave_late_receipt.disposable','LOCAL_ONLY',false)");
  await d.exec(candidate); assert.deepEqual(await metadata(), before);
  for (const role of ['anon', 'authenticated']) {
    await d.exec(`SET ROLE ${role}`);
    await assert.rejects(reconcile(1, d), /permission denied for function rpc_taxonomy_reconcile_reviewed_outbox_service/);
    await d.exec('RESET ROLE');
  }
  await assert.rejects(d.exec(candidate), /R06_POSTSAVE_LATE_RECEIPT_PREIMAGE_DRIFT/); await d.exec('ROLLBACK');
  await d.exec(predecessor); await d.exec(`GRANT EXECUTE ON FUNCTION ${signature} TO authenticated`);
  await assert.rejects(d.exec(candidate), /R06_POSTSAVE_LATE_RECEIPT_PREIMAGE_DRIFT/); await d.exec('ROLLBACK');
});
