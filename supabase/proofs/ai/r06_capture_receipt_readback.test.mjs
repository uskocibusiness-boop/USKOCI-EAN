// LOCAL CANDIDATE proof, not hosted/Auth/PostgREST/concurrency/deployment proof.
// The capture writer, source builders, hint table/defaults/checks and closure
// guards below are extracted unchanged from the current application snapshot.
// Auth claims, prerequisite tables and empty-media adapters are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const baseline = process.env.R06_CAPTURE_RECEIPT_BASELINE === '1';
const candidate = readFileSync(new URL('./r06_capture_receipt_readback_candidate.sql', import.meta.url), 'utf8');
const snapshot = readFileSync(new URL('../privacy/bootstrap/current-application.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const capture = 'rpc_taxonomy_capture_gemini_turn_hints_service';
const readback = 'rpc_taxonomy_read_gemini_turn_hint_receipt_service';
const signature = '(uuid,uuid,uuid,uuid,uuid,text,bigint,jsonb)';
const parameters = ['accountId', 'conversationId', 'clientRequestId', 'turnId', 'attemptId', 'purpose', 'catalogVersion', 'proposals'];
const id = n => `00000000-6060-4606-8606-${String(n).padStart(12, '0')}`;
const functionSql = name => {
  const start = snapshot.indexOf('CREATE OR REPLACE FUNCTION ' + name + '(');
  const end = snapshot.indexOf('$function$;', snapshot.indexOf('AS $function$', start) + 14);
  assert.ok(start >= 0 && end > start, 'captured function is required: ' + name);
  return snapshot.slice(start, end + '$function$;'.length);
};
const actualFunctions = [
  'private.closure_account_key', 'private.closure_account_restricted', 'private.closure_assert_open',
  'private.taxonomy_normalize_v1', 'private.taxonomy_handoff_valid_v1',
  'private.ai_task_review_source_before_media', 'private.ai_task_review_source', 'public.' + capture,
].map(functionSql).join('\n');
const actualTable = snapshot.match(/CREATE TABLE "private"\."work_taxonomy_gemini_turn_hints_v1" \([\s\S]*?\n\);/)[0];
const actualTableRules = snapshot.match(/^ALTER TABLE "private"\."work_taxonomy_gemini_turn_hints_v1" .*;$/gm).join('\n');

async function database(install = true) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`CREATE SCHEMA private; CREATE SCHEMA auth; CREATE SCHEMA extensions;
    CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE unrelated_api_role;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      'SELECT jsonb_build_object(''role'',current_setting(''test.jwt_role'',true))';
    CREATE TABLE private.account_closure_requests(account_id uuid,state text);
    CREATE TABLE public.ai_conversations(id uuid PRIMARY KEY,account_id uuid,purpose text,status text,
      bound_need_id uuid,fact_schema_version text,need_edit_base_fingerprint text);
    CREATE TABLE public.needs(id uuid,revision int,status text);
    CREATE TABLE public.ai_structured_facts(id uuid,conversation_id uuid,fact_key text,fact_value jsonb,superseded_at timestamptz);
    CREATE TABLE public.ai_messages(id uuid,conversation_id uuid,account_id uuid,role text,sequence_no bigint,safety text);
    CREATE TABLE private.ai_need_turn_commands(account_id uuid,conversation_id uuid,client_request_id uuid,
      turn_id uuid,attempt_id uuid,state text,cancelled_at timestamptz,receipt jsonb,updated_at timestamptz);
    CREATE TABLE private.worker_ai_sessions(account_id uuid,conversation_id uuid,candidate jsonb,revision int,base_hash text);
    CREATE TABLE private.worker_ai_turns(account_id uuid,conversation_id uuid,client_request_id uuid,
      turn_id uuid,attempt_id uuid,state text,cancelled_at timestamptz,completion_hash text,source_revision int);
    CREATE TABLE private.owned_media_assets(id uuid,conversation_id uuid,selected boolean,state text,
      storage_path text,sanitized_sha256 text,width int,height int,byte_size bigint);
    CREATE FUNCTION private.need_edit_base_marker(uuid) RETURNS jsonb LANGUAGE sql STABLE AS 'SELECT null::jsonb';
    CREATE FUNCTION private.media_task_refs(uuid) RETURNS text[] LANGUAGE sql STABLE AS 'SELECT ARRAY[]::text[]';
    CREATE FUNCTION private.media_refs_ready(uuid,text[]) RETURNS boolean LANGUAGE sql STABLE AS 'SELECT true';
    ${actualTable}\n${actualTableRules}\n${actualFunctions}
    SELECT set_config('test.jwt_role','service_role',false);
    SELECT set_config('uskoci.r06_capture_receipt.disposable','LOCAL_ONLY',false);`);
  if (install && !baseline) await db.exec(candidate);
  return db;
}
let db, nextCase = 100;
test.before(async () => { db = await database(); });
test.after(async () => { await db?.close(); });
const invoke = (name, value) => db.query(`SELECT public.${name}($1,$2,$3,$4,$5,$6,$7,$8::jsonb) AS value`,
  parameters.map(key => key === 'proposals' ? JSON.stringify(value[key]) : value[key])).then(result => result.rows[0].value);
const allRows = async () => (await db.query(`SELECT
  (SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.id),'[]') FROM private.work_taxonomy_gemini_turn_hints_v1 h) hints,
  (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.turn_id),'[]') FROM private.ai_need_turn_commands t) need_turns,
  (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.turn_id),'[]') FROM private.worker_ai_turns t) worker_turns,
  (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') FROM public.ai_conversations c) conversations,
  (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.account_id),'[]') FROM private.account_closure_requests c) closure`)).rows[0];
async function read(value) {
  const before = await allRows();
  await db.exec('BEGIN READ ONLY');
  try {
    const result = await invoke(readback, value);
    await db.exec('COMMIT');
    assert.deepEqual(await allRows(), before, 'receipt read cannot mutate durable records');
    return result;
  } catch (error) { await db.exec('ROLLBACK'); throw error; }
}
async function fixture(kind, committed = true) {
  const n = nextCase++ * 10;
  const value = { accountId: id(n), conversationId: id(n + 1), clientRequestId: id(n + 2),
    turnId: id(n + 3), attemptId: id(n + 4), purpose: kind === 'NEED' ? 'NEED_SERVICE' : 'WORKER_CAPABILITY',
    catalogVersion: 7, proposals: [{ service: 'SYNTHETIC_PRIVATE_SERVICE', mode: 'ON_SITE', action: 'CREATE_CHILD',
      categoryId: '', parentId: id(9), proposedPath: ['SYNTHETIC_PRIVATE_SERVICE'],
      reason: 'SYNTHETIC_PRIVATE_REASON', catalogVersion: 7 }] };
  await db.query(`INSERT INTO public.ai_conversations VALUES($1,$2,$3,'OPEN',null,'NEED_FACT_V2',null)`,
    [value.conversationId, value.accountId, kind === 'NEED' ? 'NEED_INTAKE' : 'PROFILE']);
  if (kind === 'NEED') {
    await db.query(`INSERT INTO public.ai_messages VALUES($1,$2,$3,'ASSISTANT',2,'ALLOW')`,
      [id(n + 5), value.conversationId, value.accountId]);
    await db.query(`INSERT INTO private.ai_need_turn_commands VALUES($1,$2,$3,$4,$5,'SUCCEEDED',null,$6,clock_timestamp())`,
      [value.accountId, value.conversationId, value.clientRequestId, value.turnId, value.attemptId,
        { authoritative: true, schemaVersion: 'NEED_FACT_V2', assistantMessageId: id(n + 5) }]);
  } else {
    await db.query(`INSERT INTO private.worker_ai_sessions VALUES($1,$2,$3,5,'owned-base')`,
      [value.accountId, value.conversationId, { skills: ['SYNTHETIC_PRIVATE_SERVICE'] }]);
    await db.query(`INSERT INTO private.worker_ai_turns VALUES($1,$2,$3,$4,$5,'SUCCEEDED',null,$6,4)`,
      [value.accountId, value.conversationId, value.clientRequestId, value.turnId, value.attemptId, 'a'.repeat(64)]);
  }
  if (committed) assert.deepEqual(await invoke(capture, value), { action: 'HINT_CAPTURED', authority: 'NONE' });
  return value;
}
const unconfirmed = { schemaVersion: 'TAXONOMY_CAPTURE_RECEIPT_V1', state: 'CAPTURE_UNCONFIRMED',
  authority: 'NONE', applicability: 'NOT_EVALUATED', retryAllowed: false };
async function assertConfirmed(value) {
  const result = await read(value);
  const expectedDigest = (await db.query("SELECT $1::jsonb::text AS canonical", [JSON.stringify(value.proposals)])).rows[0].canonical;
  assert.deepEqual(result, { ...unconfirmed, state: 'CAPTURE_PRESENT',
    ...Object.fromEntries(parameters.filter(key => key !== 'proposals').map(key => [key, value[key]])),
    payloadDigest: createHash('sha256').update(expectedDigest).digest('hex') });
  assert.ok(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE'), 'receipt contains no service, reason or proposed path');
}

for (const kind of ['NEED', 'WORKER']) {
  test(`${kind}: actual committed capture with dropped ACK is readable without a second writer`, async () => {
    const value = await fixture(kind); // Deliberately do not use the writer receipt as readback evidence.
    await assertConfirmed(value);
    const count = (await db.query('SELECT count(*)::int AS n FROM private.work_taxonomy_gemini_turn_hints_v1 WHERE turn_id=$1', [value.turnId])).rows[0].n;
    assert.equal(count, 1);
  });
  test(`${kind}: later turn rejects old writer replay but preserves exact historical capture receipt`, async () => {
    const value = await fixture(kind);
    if (kind === 'NEED') await db.query(`INSERT INTO public.ai_messages VALUES($1,$2,$3,'USER',3,'ALLOW')`,
      [id(nextCase++ * 10), value.conversationId, value.accountId]);
    else await db.query('UPDATE private.worker_ai_sessions SET revision=6 WHERE conversation_id=$1', [value.conversationId]);
    await assert.rejects(invoke(capture, value), error => error.message.includes('TAXONOMY_CAPTURE_TURN_UNCONFIRMED'));
    await assertConfirmed(value);
  });
  test(`${kind}: missing capture is unconfirmed, never permission to re-run the provider`, async () => {
    assert.deepEqual(await read(await fixture(kind, false)), unconfirmed);
  });
}

for (const field of ['accountId', 'conversationId', 'clientRequestId', 'turnId', 'attemptId', 'purpose', 'catalogVersion', 'proposals']) {
  test(`forged ${field} cannot identify a committed operation`, async () => {
    const value = await fixture('WORKER');
    const forged = { ...value, [field]: field === 'purpose' ? 'NEED_SERVICE' : field === 'catalogVersion' ? 8
      : field === 'proposals' ? value.proposals.map(p => ({ ...p, reason: 'Different private meaning.' })) : id(999999) };
    assert.deepEqual(await read(forged), unconfirmed);
  });
}
test('JSON object key order is not a different payload, while complete BOTH content is exact', async () => {
  const value = await fixture('WORKER', false);
  value.proposals.push({ ...value.proposals[0], mode: 'REMOTE', handoff: { required: false } });
  await invoke(capture, value);
  const reordered = { ...value, proposals: value.proposals.map(p => Object.fromEntries(Object.entries(p).reverse())) };
  await assertConfirmed(reordered);
  assert.deepEqual(await read({ ...value, proposals: [value.proposals[0]] }), unconfirmed);
});
test('stored digest corruption cannot be treated as a matching receipt', async () => {
  const value = await fixture('NEED');
  await db.query('UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET payload_digest=$1 WHERE turn_id=$2', ['b'.repeat(64), value.turnId]);
  assert.deepEqual(await read(value), unconfirmed);
});

for (const state of ['READY', 'EXECUTING', 'FAILED', 'CLOSED']) {
  test(`actual closure guard denies receipt access in ${state}`, async () => {
    const value = await fixture('NEED');
    await db.query('INSERT INTO private.account_closure_requests VALUES($1,$2)', [value.accountId, state]);
    await assert.rejects(read(value), error => error.code === '42501' && error.message.includes('ACCOUNT_CLOSING'));
  });
}
for (const role of ['anon', 'authenticated', 'unrelated_api_role']) {
  test(`${role} has neither direct execute nor inherited PUBLIC permission`, async () => {
    const value = await fixture('WORKER');
    await db.exec('SET ROLE ' + role);
    try { await assert.rejects(invoke(readback, value), error => error.code === '42501'); }
    finally { await db.exec('RESET ROLE'); }
  });
}
for (const jwt of ['anon', 'authenticated', '']) {
  test(`service SQL role still rejects ${jwt || 'missing'} JWT role`, async () => {
    const value = await fixture('NEED');
    await db.query("SELECT set_config('test.jwt_role',$1,false)", [jwt]);
    await db.exec('SET ROLE service_role');
    try { await assert.rejects(invoke(readback, value), error => error.code === '42501'); }
    finally { await db.exec("RESET ROLE; SELECT set_config('test.jwt_role','service_role',false)"); }
  });
}
test('service role can read only the prose-free receipt, not its private source table', async () => {
  const value = await fixture('WORKER');
  await db.exec('SET ROLE service_role');
  try {
    assert.equal((await invoke(readback, value)).state, 'CAPTURE_PRESENT');
    await assert.rejects(db.query('SELECT proposals FROM private.work_taxonomy_gemini_turn_hints_v1'), error => error.code === '42501');
  } finally { await db.exec('RESET ROLE'); }
});
test('candidate metadata locks down owner/search_path and all API permissions', async () => {
  const result = (await db.query(`SELECT proowner::regrole::text AS owner,prosecdef,proconfig,
    has_function_privilege('service_role',oid,'EXECUTE') service,
    has_function_privilege('anon',oid,'EXECUTE') anon,
    has_function_privilege('authenticated',oid,'EXECUTE') authenticated,
    EXISTS(SELECT 1 FROM aclexplode(proacl) WHERE grantee=0) public
    FROM pg_proc WHERE oid=to_regprocedure($1)`, ['public.' + readback + signature])).rows[0];
  assert.deepEqual(result, { owner: 'postgres', prosecdef: true, proconfig: ['search_path=pg_catalog'],
    service: true, anon: false, authenticated: false, public: false });
});
for (const [label, mutate] of [
  ['null account', v => ({ ...v, accountId: null })], ['null purpose', v => ({ ...v, purpose: null })],
  ['unknown purpose', v => ({ ...v, purpose: 'OTHER' })], ['zero version', v => ({ ...v, catalogVersion: 0 })],
  ['empty proposals', v => ({ ...v, proposals: [] })], ['object proposals', v => ({ ...v, proposals: {} })],
  ['oversized payload', v => ({ ...v, proposals: [{ reason: 'x'.repeat(18001) }] })],
]) {
  test(`receipt lookup rejects ${label} rather than querying a broader identity`, async () => {
    const value = await fixture('NEED');
    await assert.rejects(read(mutate(value)), error => error.code === '22023');
  });
}

test('candidate cannot install without explicit local-only scope and leaves no partial RPC', async t => {
  const isolated = await database(false); t.after(() => isolated.close());
  await isolated.exec("SELECT set_config('uskoci.r06_capture_receipt.disposable','',false)");
  await assert.rejects(isolated.exec(candidate), error => error.message.includes('R06_CAPTURE_RECEIPT_DISPOSABLE_ONLY'));
  await isolated.exec('ROLLBACK');
  assert.equal((await isolated.query('SELECT to_regprocedure($1) AS rpc', ['public.' + readback + signature])).rows[0].rpc, null);
});
for (const name of ['public.' + capture, 'private.closure_assert_open', 'private.closure_account_key', 'private.closure_account_restricted']) {
  test(`candidate refuses source drift in ${name}`, async t => {
    const isolated = await database(false); t.after(() => isolated.close());
    await isolated.exec(functionSql(name).replace('AS $function$', 'AS $function$\n-- synthetic source drift\n'));
    await assert.rejects(isolated.exec(candidate), error => error.message.includes('R06_CAPTURE_RECEIPT_SOURCE_DRIFT'));
    await isolated.exec('ROLLBACK');
    assert.equal((await isolated.query('SELECT to_regprocedure($1) AS rpc', ['public.' + readback + signature])).rows[0].rpc, null);
  });
}
test('additive install preserves captured writer/closure bodies and cannot overwrite an existing receipt RPC', async t => {
  const isolated = await database(false); t.after(() => isolated.close());
  const names = [capture, 'closure_assert_open', 'closure_account_key', 'closure_account_restricted'];
  const metadata = async () => (await isolated.query(`SELECT proname,md5(prosrc) body,prosecdef,proconfig,proacl::text
    FROM pg_proc WHERE proname=ANY($1::text[]) ORDER BY proname`, [names])).rows;
  const before = await metadata();
  await isolated.exec(candidate);
  assert.deepEqual(await metadata(), before);
  await assert.rejects(isolated.exec(candidate), error => error.message.includes('R06_CAPTURE_RECEIPT_ALREADY_EXISTS'));
  await isolated.exec('ROLLBACK');
  assert.deepEqual(await metadata(), before);
});
test('unexpected default EXECUTE grantee aborts installation without changing defaults', async t => {
  const isolated = await database(false); t.after(() => isolated.close());
  await isolated.exec('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO unrelated_api_role');
  const defaults = async () => (await isolated.query('SELECT oid::text,defaclacl::text FROM pg_default_acl ORDER BY oid')).rows;
  const before = await defaults();
  await assert.rejects(isolated.exec(candidate), error => error.message.includes('R06_CAPTURE_RECEIPT_ACL_INVALID'));
  await isolated.exec('ROLLBACK');
  assert.equal((await isolated.query('SELECT to_regprocedure($1) AS rpc', ['public.' + readback + signature])).rows[0].rpc, null);
  assert.deepEqual(await defaults(), before);
});
