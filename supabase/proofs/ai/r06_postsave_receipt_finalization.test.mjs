// Actual predecessor/candidate SQL -> actual post-save driver, synthetic PGlite.
// Real pgcrypto and closure guard bodies; prerequisite closure rows are synthetic.
// No DEV/Auth/HTTP/provider, concurrent transaction or late-after-finalize proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { processTaxonomyPostSaveTick } from '../../functions/_shared/taxonomyPostSaveWorker.mjs';

const baseline = process.env.R06_POSTSAVE_RECEIPT_BASELINE === '1';
const candidate = readFileSync(new URL('./r06_postsave_receipt_finalization_candidate.sql', import.meta.url), 'utf8');
const snapshot = readFileSync(new URL('../privacy/bootstrap/current-application.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const finalizer = 'public.rpc_taxonomy_finalize_reviewed_batch_service';
const signature = finalizer + '(uuid,uuid,text)';
const functionSql = name => {
  const start = snapshot.indexOf('CREATE OR REPLACE FUNCTION ' + name + '(');
  const end = snapshot.indexOf('$function$;', snapshot.indexOf('AS $function$', start) + 14);
  assert.ok(start >= 0 && end > start, 'actual captured function required: ' + name);
  return snapshot.slice(start, end + '$function$;'.length);
};
const predecessor = functionSql(finalizer);
const body = predecessor.split('AS $function$')[1].split('$function$;')[0];
assert.equal(createHash('md5').update(body).digest('hex'), 'af9cd22b779037a8c9f7fad5c8543cfe');
const actualTables = ['work_taxonomy_review_outbox_v1', 'work_taxonomy_review_batches_v1'].map(name => {
  const table = snapshot.match(new RegExp(`CREATE TABLE "private"\\."${name}" \\([\\s\\S]*?\\n\\);`))[0];
  const rules = snapshot.match(new RegExp(`^ALTER TABLE "private"\\."${name}" .*;$`, 'gm')).join('\n');
  return table + '\n' + rules;
}).join('\n');
const closureFunctions = ['private.closure_account_key', 'private.closure_account_restricted', 'private.closure_assert_open']
  .map(functionSql).join('\n');
const id = n => `00000000-6060-4606-8606-${String(n).padStart(12, '0')}`;
let next = 100, db;
async function database(install = true) {
  const d = new PGlite({ extensions: { pgcrypto } });
  await d.exec(`CREATE SCHEMA private; CREATE SCHEMA extensions;
    CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE private.account_closure_requests(account_id uuid,state text);
    ${actualTables}\n${closureFunctions}\n${predecessor}
    REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION ${signature} TO service_role;
    SELECT set_config('uskoci.r06_postsave_receipt.disposable','LOCAL_ONLY',false);`);
  if (install && !baseline) await d.exec(candidate);
  return d;
}
test.before(async () => { db = await database(); });
test.after(async () => { await db?.close(); });
async function fixture({ attempts = 5, receipt = true, mismatch = null } = {}, d = db) {
  const n = next++ * 10;
  const job = { id: id(n), ownerAccountId: id(n + 1), requestKey: id(n + 2), sourceReviewId: id(n + 3),
    purpose: 'WORKER_CAPABILITY', plans: [{ action: 'REUSE_EXISTING', service: 'Synthetic service', mode: 'REMOTE', categoryId: id(n + 5) }],
    leaseToken: id(n + 4), attempts };
  await d.query(`INSERT INTO private.work_taxonomy_review_outbox_v1
    (id,owner_account_id,request_key,source_review_id,purpose,plans,state,attempts,lease_token,lease_until)
    VALUES($1,$2,$3,$4,$5,$6::jsonb,'CLAIMED',$7,$8,statement_timestamp()+interval '3 minutes')`,
  [job.id, job.ownerAccountId, job.requestKey, job.sourceReviewId, job.purpose, JSON.stringify(job.plans), attempts, job.leaseToken]);
  const result = { status: 'COMMITTED', catalogVersion: 3, items: [{ categoryId: id(n + 5), mode: 'REMOTE' }],
    capabilityAuthority: 'NONE', needRevisionAuthority: 'NONE', notificationAuthority: 'NONE', requiresBinding: true };
  if (receipt) {
    const values = { ...job, plans: structuredClone(job.plans) };
    if (['ownerAccountId', 'requestKey', 'sourceReviewId'].includes(mismatch)) values[mismatch] = id(n + 9);
    if (mismatch === 'purpose') values.purpose = 'NEED_SERVICE';
    if (mismatch === 'plans') values.plans[0].mode = 'ON_SITE';
    if (mismatch === 'status') result.status = 'PENDING';
    if (mismatch === 'missingStatus') delete result.status;
    await d.query(`INSERT INTO private.work_taxonomy_review_batches_v1
      (owner_account_id,request_key,source_review_id,purpose,plans,review_digest,plans_digest,catalog_version,result)
      VALUES($1,$2,$3,$4,$5::jsonb,repeat('a',64),
        CASE WHEN $7 THEN repeat('0',64) ELSE encode(extensions.digest(convert_to(($5::jsonb)::text,'UTF8'),'sha256'),'hex') END,3,$6::jsonb)`,
    [values.ownerAccountId, values.requestKey, values.sourceReviewId, values.purpose, JSON.stringify(values.plans), JSON.stringify(result), mismatch === 'hash']);
  }
  return { job, result };
}
const finalize = (job, error = 'TEMPORARY_UNAVAILABLE', d = db) => d.query(`SELECT ${finalizer}($1,$2,$3) AS value`,
  [job.id, job.leaseToken, error]).then(r => r.rows[0].value);
const row = (job, d = db) => d.query('SELECT * FROM private.work_taxonomy_review_outbox_v1 WHERE id=$1', [job.id]).then(r => r.rows[0]);
const batches = (d = db) => d.query('SELECT * FROM private.work_taxonomy_review_batches_v1 ORDER BY id').then(r => r.rows);

test('last-attempt lost ACK finalizes the exact durable commit in actual SQL and worker', async () => {
  const { job, result } = await fixture();
  const beforeBatches = await batches();
  const calls = [];
  const out = await processTaxonomyPostSaveTick(async (name, args) => {
    calls.push({ name, args });
    if (name === 'rpc_taxonomy_reconcile_reviewed_outbox_service') return 0;
    if (name === 'rpc_taxonomy_claim_reviewed_batches_service') return [job];
    if (name === 'rpc_taxonomy_commit_reviewed_batch_service') throw Error('synthetic response lost after DB committed');
    if (name === 'rpc_taxonomy_finalize_reviewed_batch_service') return finalize(job, args.p_error_code);
    assert.fail('No other RPC/provider/binder allowed');
  });
  assert.equal(out.admitted, 1); assert.equal(out.reviewRequired, 0); assert.equal(out.retry, 0);
  const saved = await row(job);
  assert.equal(saved.state, 'COMMITTED'); assert.deepEqual(saved.result, result);
  assert.equal(saved.error_code, null); assert.equal(saved.lease_token, null); assert.equal(saved.lease_until, null);
  assert.equal(saved.attempts, 5); assert.equal(saved.binding_state, 'PENDING');
  assert.equal(out.capabilityAuthority, 'NONE'); assert.equal(out.needRevisionAuthority, 'NONE'); assert.equal(out.notificationAuthority, 'NONE');
  assert.equal(calls.filter(x => x.name === 'rpc_taxonomy_commit_reviewed_batch_service').length, 1);
  assert.equal(calls[2].args.p_request_key, job.requestKey);
  assert.deepEqual(await batches(), beforeBatches, 'receipt lookup does not rewrite the admission');
});

test('exact receipt wins on first attempt and after explicit replay refusal, normal ACK remains valid', async () => {
  for (const error of [null, 'TIMEOUT', 'NETWORK_UNAVAILABLE', 'TEMPORARY_UNAVAILABLE', 'BATCH_REVIEW_REQUIRED']) {
    const { job, result } = await fixture({ attempts: 1 });
    assert.deepEqual(await finalize(job, error), { status: 'COMMITTED', outboxId: job.id });
    assert.deepEqual((await row(job)).result, result);
    assert.equal((await row(job)).error_code, null);
  }
});

for (const mismatch of ['ownerAccountId', 'requestKey', 'sourceReviewId', 'purpose', 'plans', 'hash', 'status', 'missingStatus']) {
  test(`different ${mismatch} never acts as the saved operation receipt`, async () => {
    const { job } = await fixture({ mismatch });
    const before = await row(job), beforeBatches = await batches();
    await assert.rejects(finalize(job, null), /OUTBOX_COMMIT_RECEIPT_MISSING/);
    assert.deepEqual(await row(job), before, 'failed read must preserve the claimed lease');
    assert.equal((await finalize(job)).status, 'REVIEW_REQUIRED');
    assert.equal((await row(job)).result, null); assert.deepEqual(await batches(), beforeBatches);
  });
}

test('without a receipt preserve retry backoff, max-attempt and permanent denial distinction', async () => {
  for (const [attempts, error, expected] of [[1, 'TEMPORARY_UNAVAILABLE', 'RETRY'], [4, 'TIMEOUT', 'RETRY'],
    [5, 'TEMPORARY_UNAVAILABLE', 'REVIEW_REQUIRED'], [1, 'BATCH_REVIEW_REQUIRED', 'REVIEW_REQUIRED']]) {
    const { job } = await fixture({ attempts, receipt: false });
    assert.equal((await finalize(job, error)).status, expected);
    const saved = await row(job);
    assert.equal(saved.result, null); assert.equal(saved.error_code, error); assert.equal(saved.attempts, attempts);
    if (expected === 'RETRY') assert.ok(new Date(saved.retry_after) > new Date(saved.updated_at));
  }
});

test('a receipt does not bypass stale/wrong/null lease, completed state or invalid error input', async () => {
  for (const kind of ['wrong', 'null', 'expired', 'completed', 'invalidError']) {
    const { job } = await fixture();
    if (kind === 'expired') await db.query("UPDATE private.work_taxonomy_review_outbox_v1 SET lease_until=statement_timestamp()-interval '1 second' WHERE id=$1", [job.id]);
    if (kind === 'completed') await db.query("UPDATE private.work_taxonomy_review_outbox_v1 SET state='COMMITTED',lease_token=NULL,lease_until=NULL WHERE id=$1", [job.id]);
    const before = await row(job);
    const call = { ...job, leaseToken: kind === 'wrong' ? id(1) : kind === 'null' ? null : job.leaseToken };
    await assert.rejects(finalize(call, kind === 'invalidError' ? 'bad transport text' : 'TEMPORARY_UNAVAILABLE'),
      kind === 'invalidError' ? /OUTBOX_ERROR_CODE_INVALID/ : /OUTBOX_STALE_LEASE/);
    assert.deepEqual(await row(job), before);
  }
});

test('actual closure guard still refuses all restricted owners even with a committed receipt', async () => {
  for (const state of ['READY', 'EXECUTING', 'FAILED', 'CLOSED']) {
    const { job } = await fixture();
    await db.query('INSERT INTO private.account_closure_requests(account_id,state) VALUES($1,$2)', [job.ownerAccountId, state]);
    const before = await row(job);
    await assert.rejects(finalize(job), /ACCOUNT_CLOSING/);
    assert.deepEqual(await row(job), before);
  }
});

test('replacement preserves metadata/service-only ACL and candidate refuses missing local admission or preimage drift', async t => {
  const d = await database(false); t.after(() => d.close());
  const metadata = () => d.query(`SELECT proowner::regrole::text owner,proacl::text acl,prosecdef,proconfig,proname,proargtypes::text,prorettype::regtype::text FROM pg_proc WHERE oid=$1::regprocedure`, [signature]).then(r => r.rows[0]);
  const before = await metadata();
  await d.exec("SELECT set_config('uskoci.r06_postsave_receipt.disposable','',false)");
  await assert.rejects(d.exec(candidate), /R06_POSTSAVE_RECEIPT_LOCAL_ONLY/); await d.exec('ROLLBACK');
  await d.exec("SELECT set_config('uskoci.r06_postsave_receipt.disposable','LOCAL_ONLY',false)");
  await d.exec(candidate); assert.deepEqual(await metadata(), before);
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await d.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') allowed', [role, signature])).rows[0].allowed, false);
  }
  await assert.rejects(d.exec(candidate), /R06_POSTSAVE_RECEIPT_PREIMAGE_DRIFT/); await d.exec('ROLLBACK');
  await d.exec(predecessor); await d.exec(`GRANT EXECUTE ON FUNCTION ${signature} TO authenticated`);
  await assert.rejects(d.exec(candidate), /R06_POSTSAVE_RECEIPT_PREIMAGE_DRIFT/); await d.exec('ROLLBACK');
});
