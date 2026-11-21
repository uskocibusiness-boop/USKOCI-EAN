'use strict';
// Owner 21.11.2026: "Objavi zadatak" must be instant. The publication check of the shown review runs in the
// background; the tap only accepts, settles the stored decision through the existing B06 path and publishes.
// SQL: the source-only candidate in a disposable PGlite fixture (stubbed accept/context with the live contract
// shape). Edge: the real handler with local HTTP/provider seams. Client: the real receipt service.
// No hosted, provider or paid call is made.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');

const ROOT = path.resolve(__dirname, '..');
const candidate = fs.readFileSync(path.join(__dirname, 'sql', 'publication_pre_evaluation_20261121.candidate.sql'), 'utf8');
const rollback = fs.readFileSync(path.join(__dirname, 'sql', 'rollback_publication_pre_evaluation_20261121.sql'), 'utf8');
const evaluator = fs.readFileSync(path.join(ROOT, 'supabase/functions/uskoci-publication-evaluate/index.ts'), 'utf8');
const blocks = [...candidate.matchAll(/DO \$([A-Za-z0-9_]+)\$[\s\S]*?END\s*\$\1\$;/g)];
const OWNER = '10000000-0000-4000-8000-000000000001', OTHER = '10000000-0000-4000-8000-000000000002';
const REVIEW = '20000000-0000-4000-8000-000000000001', CONVERSATION = '30000000-0000-4000-8000-000000000001';
const DIGEST = 'd'.repeat(64), INPUT = 'e'.repeat(64), POLICY = 'f'.repeat(64);

test('pre-evaluation SQL is source-only, additive and pinned to the reviewed DEV accept/context bodies', () => {
  assert.match(candidate, /SOURCE-ONLY CANDIDATE/);
  assert.deepEqual(blocks.map(b => b[1]), ['source_only', 'dependencies', 'postflight']);
  assert.match(blocks[0][0], /RAISE EXCEPTION 'PUBLICATION_PRE_EVALUATION_SOURCE_ONLY'/);
  assert.ok(candidate.indexOf('DO $source_only$') < candidate.indexOf('BEGIN;'));
  for (const md5 of ['535fa065c24b514423af8d04a8a58574', '47c471edbb45f07a71177b4fcfbeb617', '68a8373b9f7a1d668d60c8dcf6b84fc7'])
    assert.ok(blocks[1][0].includes(`IS DISTINCT FROM '${md5}'`), md5);
  assert.doesNotMatch(candidate, /CREATE OR REPLACE/i, 'no existing function is replaced');
  const code = candidate.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(code, /rpc_publish|rpc_record_need_publication_decision|UPDATE public\.needs|ai_task_review_commands\s+SET/i);
  assert.match(candidate, /GRANT EXECUTE ON FUNCTION public\.rpc_preview_ai_task_review_publication_context\(uuid,text\) TO authenticated;/);
  for (const name of ['claim', 'complete', 'read']) assert.match(candidate,
    new RegExp(`REVOKE ALL ON FUNCTION public\\.rpc_${name}_ai_task_review_pre_evaluation_service\\([^)]*\\) FROM PUBLIC, anon, authenticated;`));
  assert.match(candidate, /ENABLE ROW LEVEL SECURITY/);
  assert.match(rollback, /DROP TABLE IF EXISTS private\.ai_task_review_pre_evaluations;/);
});

const fixture = `
create role service_role; create role authenticated; create role anon;
create schema private; create schema extensions; create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role', true), '')$$;
create function extensions.gen_random_uuid() returns uuid language sql as $$select gen_random_uuid()$$;
create function private.closure_assert_open(uuid) returns void language sql as $$select null::void$$;
create table private.ai_task_reviews(id uuid primary key, account_id uuid, conversation_id uuid, envelope jsonb, expires_at timestamptz);
create table private.ai_task_review_commands(review_id uuid primary key, account_id uuid, client_request_id uuid unique, need_id uuid,
  need_revision integer, state text);
create table public.needs(id uuid primary key, requester_account_id uuid, status text, revision integer, title text);
create table private.confirmed_facts(conversation_id uuid);
create function private.ai_task_review_command_document(rid uuid) returns jsonb language sql as $$
  select jsonb_build_object('reviewId',c.review_id,'clientRequestId',c.client_request_id,'needId',c.need_id,'needRevision',c.need_revision,
   'state',c.state,'authoritative',true) from private.ai_task_review_commands c where c.review_id=rid$$;
-- Contract-shaped stand-in for the live accept: owner, digest, expiry, idempotency by review; writes a DRAFT and a command.
create function public.rpc_accept_ai_task_review(p_review_id uuid, p_displayed_content_digest text, p_client_request_id uuid)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $$
declare u uuid:=auth.uid(); r private.ai_task_reviews; nid uuid:=gen_random_uuid();
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select * into r from private.ai_task_reviews where id=p_review_id and account_id=u;
 if not found then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
 if r.envelope->>'displayedContentDigest'<>p_displayed_content_digest then raise exception 'TASK_REVIEW_DIGEST_MISMATCH' using errcode='PT409'; end if;
 if exists(select 1 from private.ai_task_review_commands where review_id=r.id) then return private.ai_task_review_command_document(r.id); end if;
 if r.expires_at<=clock_timestamp() then raise exception 'TASK_REVIEW_EXPIRED' using errcode='PT409'; end if;
 if r.envelope->>'canAccept'<>'true' then raise exception 'TASK_REVIEW_INCOMPLETE' using errcode='22023'; end if;
 insert into private.confirmed_facts values(r.conversation_id);
 insert into public.needs values(nid,u,'DRAFT',1,r.envelope->>'title');
 insert into private.ai_task_review_commands values(r.id,u,p_client_request_id,nid,1,'ACCEPTED');
 return private.ai_task_review_command_document(r.id);
end $$;
create function private.need_publication_context(p_need_id uuid, p_expected_revision integer, p_owner uuid)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $$
declare n public.needs;
begin
 select * into n from public.needs where id=p_need_id;
 if n.requester_account_id<>p_owner then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
 if n.status<>'DRAFT' then raise exception 'NEED_NOT_DRAFT' using errcode='P0001'; end if;
 return jsonb_build_object('kind','READY','needId',n.id,'needRevision',n.revision,'publicNeed',jsonb_build_object('title',n.title));
end $$;
`;
async function db() {
  const pg = new PGlite();
  await pg.exec(fixture);
  // The dependency guard pins live DEV bodies, which this fixture deliberately does not reproduce.
  const body = candidate.slice(candidate.indexOf('BEGIN;')).replace(blocks[1][0], '');
  await pg.exec(body);
  await pg.query(`insert into private.ai_task_reviews values($1,$2,$3,$4,clock_timestamp()+interval '15 minutes')`,
    [REVIEW, OWNER, CONVERSATION, JSON.stringify({ displayedContentDigest: DIGEST, canAccept: true, title: 'Lektura' })]);
  const as = async (sub, role) => {
    await pg.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)`, [sub ?? '', role ?? '']);
  };
  const value = async (sql, args = []) => (await pg.query(sql, args)).rows[0].v;
  return { pg, as, value };
}
const counts = f => f.value(`select jsonb_build_object('needs',(select count(*) from public.needs),'commands',(select count(*) from private.ai_task_review_commands),
  'facts',(select count(*) from private.confirmed_facts)) v`);

test('preview dry-runs the owner acceptance, returns the exact context and leaves nothing behind', async () => {
  const f = await db();
  try {
    await f.as(OWNER, 'authenticated');
    const preview = await f.value('select public.rpc_preview_ai_task_review_publication_context($1,$2) v', [REVIEW, DIGEST]);
    assert.equal(preview.kind, 'PREVIEW'); assert.equal(preview.authoritative, false);
    assert.equal(preview.context.kind, 'READY'); assert.equal(preview.context.publicNeed.title, 'Lektura');
    assert.deepEqual(await counts(f), { needs: 0, commands: 0, facts: 0 }, 'no draft, command or fact confirmation survives');
    // The owner's real tap still accepts normally afterwards.
    const accepted = await f.value(`select public.rpc_accept_ai_task_review($1,$2,'40000000-0000-4000-8000-000000000001') v`, [REVIEW, DIGEST]);
    assert.equal(accepted.state, 'ACCEPTED');
    assert.deepEqual(await f.value('select public.rpc_preview_ai_task_review_publication_context($1,$2) v', [REVIEW, DIGEST]),
      { kind: 'ACCEPTED', authoritative: false });
    assert.deepEqual(await counts(f), { needs: 1, commands: 1, facts: 1 }, 'an accepted review is never re-run');
  } finally { await f.pg.close(); }
});

test('preview keeps every accept refusal: other owner, changed digest, anonymous', async () => {
  const f = await db();
  try {
    await f.as(OTHER, 'authenticated');
    await assert.rejects(f.value('select public.rpc_preview_ai_task_review_publication_context($1,$2) v', [REVIEW, DIGEST]), /TASK_REVIEW_NOT_FOUND/);
    await f.as(OWNER, 'authenticated');
    await assert.rejects(f.value('select public.rpc_preview_ai_task_review_publication_context($1,$2) v', [REVIEW, 'a'.repeat(64)]), /TASK_REVIEW_DIGEST_MISMATCH/);
    await assert.rejects(f.value('select public.rpc_preview_ai_task_review_publication_context($1,$2) v', [REVIEW, 'nope']), /TASK_REVIEW_INPUT_INVALID/);
    await f.as(null, null);
    await assert.rejects(f.value('select public.rpc_preview_ai_task_review_publication_context($1,$2) v', [REVIEW, DIGEST]), /AUTH_REQUIRED/);
    assert.deepEqual(await counts(f), { needs: 0, commands: 0, facts: 0 });
    const acl = await f.value(`select jsonb_build_object(
      'anonPreview',has_function_privilege('anon','public.rpc_preview_ai_task_review_publication_context(uuid,text)','execute'),
      'userClaim',has_function_privilege('authenticated','public.rpc_claim_ai_task_review_pre_evaluation_service(uuid,uuid,text,text)','execute'),
      'userRead',has_function_privilege('authenticated','public.rpc_read_ai_task_review_pre_evaluation_service(uuid,text,text)','execute'),
      'serviceClaim',has_function_privilege('service_role','public.rpc_claim_ai_task_review_pre_evaluation_service(uuid,uuid,text,text)','execute'),
      'userTable',has_table_privilege('authenticated','private.ai_task_review_pre_evaluations','select')) v`);
    assert.deepEqual(acl, { anonPreview: false, userClaim: false, userRead: false, serviceClaim: true, userTable: false });
  } finally { await f.pg.close(); }
});

const claim = (f, account = OWNER, input = INPUT, policy = POLICY) =>
  f.value('select public.rpc_claim_ai_task_review_pre_evaluation_service($1,$2,$3,$4) v', [account, REVIEW, input, policy]);
const complete = (f, attempt, outcome, rules, model = 'gemini-3.8-flash', input = INPUT) =>
  f.value('select public.rpc_complete_ai_task_review_pre_evaluation_service($1,$2,$3,$4,$5::text[],$6::text[],$7) v',
    [OWNER, input, attempt, outcome, rules, [], outcome ? model : null]);
const read = (f, account = OWNER, policy = POLICY) =>
  f.value('select public.rpc_read_ai_task_review_pre_evaluation_service($1,$2,$3) v', [account, INPUT, policy]);

test('one attempt per owner and exact input; a stored REVIEW never changes and is read back only for the same policy', async () => {
  const f = await db();
  try {
    await f.as(OWNER, 'authenticated');
    await assert.rejects(claim(f), /SERVICE_ROLE_REQUIRED/);
    await f.as(null, 'service_role');
    const first = await claim(f); assert.equal(first.state, 'ACQUIRED');
    assert.deepEqual(await claim(f), { state: 'PENDING', attemptId: null }, 'a second request never starts another provider call');
    assert.deepEqual(await read(f), { state: 'NONE', authoritative: false });
    await assert.rejects(complete(f, '50000000-0000-4000-8000-000000000001', 'REVIEW', ['R_HOLD']), /TASK_REVIEW_ATTEMPT_STALE/);
    assert.deepEqual(await complete(f, first.attemptId, 'REVIEW', ['R_HOLD']), { state: 'DECIDED', authoritative: false });
    assert.deepEqual(await complete(f, first.attemptId, 'REVIEW', ['R_HOLD']), { state: 'DECIDED', authoritative: false }, 'exact replay');
    await assert.rejects(complete(f, first.attemptId, 'ALLOW', ['R_ALLOW']), /IDEMPOTENCY_KEY_REUSED/, 'REVIEW cannot be re-rolled');
    assert.deepEqual(await claim(f), { state: 'DECIDED', attemptId: null });
    assert.deepEqual(await read(f), { state: 'DECIDED', outcome: 'REVIEW', ruleIds: ['R_HOLD'], safeReasonCodes: [],
      modelRef: 'gemini-3.8-flash', authoritative: false });
    assert.equal((await read(f, OTHER)).state, 'NONE', 'owner-bound');
    assert.equal((await read(f, OWNER, '0'.repeat(64))).state, 'NONE', 'policy-bound');
    assert.equal((await claim(f, OWNER, INPUT, '0'.repeat(64))).state, 'UNAVAILABLE', 'a changed policy never re-uses or re-evaluates this row');
    await assert.rejects(complete(f, first.attemptId, 'REVIEW', []), /TASK_REVIEW_INPUT_INVALID/);
    await assert.rejects(claim(f, OTHER), /TASK_REVIEW_NOT_FOUND/, 'the review must belong to the account');
  } finally { await f.pg.close(); }
});

test('a failed or expired attempt is UNAVAILABLE and is never re-acquired for the same input', async () => {
  const f = await db();
  try {
    await f.as(null, 'service_role');
    const first = await claim(f);
    assert.deepEqual(await complete(f, first.attemptId, null, []), { state: 'UNAVAILABLE', authoritative: false });
    assert.equal((await claim(f)).state, 'UNAVAILABLE');
    const other = 'c'.repeat(64);
    const second = await claim(f, OWNER, other); assert.equal(second.state, 'ACQUIRED');
    await f.pg.query(`update private.ai_task_review_pre_evaluations set lease_expires_at=clock_timestamp()-interval '1 second' where input_digest=$1`, [other]);
    assert.equal((await claim(f, OWNER, other)).state, 'UNAVAILABLE');
    assert.equal(await f.value('select count(*)::int v from private.ai_task_review_pre_evaluations'), 2);
  } finally { await f.pg.close(); }
});

// ---------------------------------------------------------------- Edge handler
const harnessSource = fs.readFileSync(path.join(__dirname, 'supabase-key-compatibility.test.cjs'), 'utf8');
const harnessAst = ts.createSourceFile('h.cjs', harnessSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const H = new Function('require', '__dirname', harnessAst.statements.filter(node => ts.isVariableStatement(node) || ts.isFunctionDeclaration(node))
  .map(node => node.getText(harnessAst)).join('\n') + '\nreturn { interview, json, request, modernEnv, publicationContext, ACCOUNT, RECEIPT, GRANT, USER_JWT, ORIGIN };')(require, __dirname);
const REVIEW_ID = '66666666-6666-4666-8666-666666666666', ATTEMPT = '77777777-7777-4777-8777-777777777777', PRE_ATTEMPT = '88888888-8888-4888-8888-888888888888';
const ENV = { ...H.modernEnv, GEMINI_API_KEY: 'fixture', GEMINI_MODEL: 'gemini-3.8-flash', AI_PROVIDER: 'gemini',
  USKOCI_GEMINI_PAID_TEST_ENABLED: 'true', USKOCI_PUBLICATION_PRE_EVALUATION_ENABLED: 'true' };
function edge(env, respond) {
  let handler; const calls = [];
  const load = H.interview.sourceLoader({}, {
    Deno: { env: { get: name => ({ SUPABASE_URL: H.ORIGIN, ...env })[name] }, serve: value => { handler = value; } }, crypto: webcrypto,
    console: { warn() {}, error() {}, log() {}, info() {} },
    fetch: async (input, init = {}) => {
      const url = new URL(input);
      assert.ok(url.origin === H.ORIGIN || url.origin === 'https://generativelanguage.googleapis.com', 'no other network');
      const call = { origin: url.origin, path: url.pathname, args: typeof init.body === 'string' ? JSON.parse(init.body) : null };
      calls.push(call); return respond(call);
    },
  });
  load('supabase/functions/uskoci-publication-evaluate/index.ts');
  return { handler, calls, paths: () => calls.map(c => c.path.replace('/rest/v1/rpc/', '')) };
}
const provider = outcome => H.json({ candidates: [{ finishReason: 'STOP', content: { role: 'model',
  parts: [{ text: JSON.stringify({ outcome, ruleIds: ['TEST'], safeReasonCodes: [] }) }] } }] });
const preRequest = () => H.request({ preEvaluateReviewId: REVIEW_ID, displayedContentDigest: 'd'.repeat(64) }, { Authorization: H.USER_JWT });
const preview = () => H.json({ kind: 'PREVIEW', context: H.publicationContext(), authoritative: false });
function evaluationCommand(state = 'EVALUATING') {
  return { reviewId: REVIEW_ID, needId: H.RECEIPT, needRevision: 1, state, evaluation: null, authoritative: true };
}
function decisionReceipt(outcome = 'ALLOW') {
  const b = H.publicationContext().binding;
  return { decisionId: '99999999-9999-4999-8999-999999999999', decisionSequence: 7, needId: H.RECEIPT, needRevision: 1,
    canonicalFingerprint: b.canonicalFingerprint, policyBundleId: b.policyBundleId, policyVersion: b.policyVersion, jurisdiction: 'RS',
    outcome, decisionAt: '2026-11-21T10:00:00Z', ruleIds: ['TEST'], safeReasonCodes: [], publishable: outcome === 'ALLOW', authoritative: true };
}

test('Edge pre-evaluation: dry-run context, one deterministic budget operation, provider once, stored, nothing published', async () => {
  const stored = [], operations = [];
  const run = async () => {
    const h = edge(ENV, call => {
      if (call.path === '/auth/v1/user') return H.json({ id: H.ACCOUNT, role: 'authenticated' });
      if (call.path.endsWith('/rpc_preview_ai_task_review_publication_context')) {
        assert.deepEqual(call.args, { p_review_id: REVIEW_ID, p_displayed_content_digest: 'd'.repeat(64) }); return preview(); }
      if (call.path.endsWith('/rpc_claim_ai_task_review_pre_evaluation_service')) {
        assert.equal(call.args.p_account_id, H.ACCOUNT); assert.match(call.args.p_input_digest, /^[a-f0-9]{64}$/);
        assert.equal(call.args.p_policy_content_sha256, 'c'.repeat(64));
        return H.json(stored.length ? { state: 'DECIDED', attemptId: null } : { state: 'ACQUIRED', attemptId: PRE_ATTEMPT }); }
      if (call.path.endsWith('/rpc_ai_test_budget_reserve_service')) { operations.push(call.args.p_operation_id);
        return H.json({ admitted: true, reservationId: '55555555-5555-4555-8555-555555555555', replay: false, code: 'AI_TEST_RESERVED' }); }
      if (call.origin === 'https://generativelanguage.googleapis.com') return provider('ALLOW');
      if (call.path.endsWith('/rpc_complete_ai_task_review_pre_evaluation_service')) { stored.push(call.args); return H.json({ state: 'DECIDED', authoritative: false }); }
      assert.fail('unexpected call ' + call.path);
    });
    const r = await h.handler(preRequest()); return { h, body: await r.json() };
  };
  const first = await run();
  assert.deepEqual(first.body, { kind: 'PRE_EVALUATION', state: 'READY', authoritativeDecision: false });
  assert.deepEqual(stored.map(s => [s.p_attempt_id, s.p_outcome, s.p_model_ref]), [[PRE_ATTEMPT, 'ALLOW', 'gemini-3.8-flash']]);
  assert.match(operations[0], /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, 'deterministic v8 operation');
  assert.ok(!first.h.paths().some(p => /accept|publish|record_need_publication|complete_ai_task_review_evaluation/.test(p)));
  // Re-preparing the same content: the stored decision answers; no budget, no provider.
  const second = await run();
  assert.equal(second.body.state, 'READY'); assert.equal(operations.length, 1);
  assert.ok(!second.h.calls.some(c => c.origin !== H.ORIGIN));
});

test('Edge pre-evaluation is off unless explicitly enabled, skips photos and never fails the review', async () => {
  const off = edge({ ...ENV, USKOCI_PUBLICATION_PRE_EVALUATION_ENABLED: undefined }, call => call.path === '/auth/v1/user'
    ? H.json({ id: H.ACCOUNT, role: 'authenticated' }) : call.path.endsWith('/rpc_preview_ai_task_review_publication_context') ? preview()
    : assert.fail('no claim/budget/provider when disabled: ' + call.path));
  assert.equal((await (await off.handler(preRequest())).json()).state, 'SKIPPED');
  const photo = H.publicationContext(); photo.publicNeed.publicMediaRefs = [`${H.ACCOUNT}/v5/${REVIEW_ID}/${'a'.repeat(64)}.jpg`];
  const media = edge(ENV, call => call.path === '/auth/v1/user' ? H.json({ id: H.ACCOUNT, role: 'authenticated' })
    : call.path.endsWith('/rpc_preview_ai_task_review_publication_context') ? H.json({ kind: 'PREVIEW', context: photo, authoritative: false })
    : assert.fail('photos are evaluated on the tap: ' + call.path));
  assert.equal((await (await media.handler(preRequest())).json()).state, 'SKIPPED');
  const refused = edge(ENV, call => call.path === '/auth/v1/user' ? H.json({ id: H.ACCOUNT, role: 'authenticated' })
    : H.json({ message: 'TASK_REVIEW_EXPIRED' }, 409));
  assert.equal((await (await refused.handler(preRequest())).json()).state, 'SKIPPED');
  const mixed = edge(ENV, () => assert.fail('no call for an invalid request'));
  const r = await mixed.handler(H.request({ preEvaluateReviewId: REVIEW_ID, displayedContentDigest: 'd'.repeat(64), needId: H.RECEIPT }, { Authorization: H.USER_JWT }));
  assert.equal(r.status, 400);
});

async function preDigest() {
  let digest;
  const h = edge(ENV, call => {
    if (call.path === '/auth/v1/user') return H.json({ id: H.ACCOUNT, role: 'authenticated' });
    if (call.path.endsWith('/rpc_preview_ai_task_review_publication_context')) return preview();
    if (call.path.endsWith('/rpc_claim_ai_task_review_pre_evaluation_service')) { digest = call.args.p_input_digest; return H.json({ state: 'DECIDED', attemptId: null }); }
    assert.fail(call.path);
  });
  await h.handler(preRequest()); return digest;
}
function tapEdge(readReply, extra = () => assert.fail('unexpected')) {
  const seen = {};
  const h = edge(ENV, call => {
    if (call.path === '/auth/v1/user') return H.json({ id: H.ACCOUNT, role: 'authenticated' });
    if (call.path.endsWith('/rpc_get_need_publication_context')) return H.json(H.publicationContext());
    if (call.path.endsWith('/rpc_claim_ai_task_review_evaluation_service'))
      return H.json({ acquired: true, attemptId: ATTEMPT, command: evaluationCommand() });
    if (call.path.endsWith('/rpc_read_ai_task_review_pre_evaluation_service')) { seen.read = call.args; return readReply(call); }
    if (call.path.endsWith('/rpc_complete_ai_task_review_evaluation_service')) { seen.complete = call.args;
      return H.json({ kind: 'DECISION', decision: decisionReceipt(call.args.p_outcome) }); }
    return extra(call, seen);
  });
  return { h, seen, tap: () => h.handler(H.request({ needId: H.RECEIPT, expectedRevision: 1, acceptedReviewId: REVIEW_ID }, { Authorization: H.USER_JWT })) };
}

test('Edge tap reuses the stored decision for the identical input: no budget, no provider, settled through the claimed command', async () => {
  const digest = await preDigest();
  for (const outcome of ['ALLOW', 'BLOCK']) {
    let budget = 0;
    const t = tapEdge(() => H.json({ state: 'DECIDED', outcome, ruleIds: ['TEST'], safeReasonCodes: [], modelRef: 'gemini-3.8-flash', authoritative: false }),
      call => { assert.ok(call.path.endsWith('/rpc_ai_test_budget_reserve_service'), call.path); budget++;
        return H.json({ admitted: false, reservationId: null, replay: false, code: 'AI_TEST_BUDGET_EXHAUSTED' }); });
    if (outcome === 'BLOCK') {
      // BLOCK is not a permitted outcome of the fixture rule: a stored decision invalid under the current policy is never reused.
      await t.tap(); assert.equal(budget, 1); assert.equal(t.seen.complete.p_outcome, null); continue;
    }
    const body = await (await t.tap()).json();
    assert.equal(body.kind, 'DECISION'); assert.equal(body.decision.outcome, 'ALLOW');
    assert.equal(t.seen.read.p_input_digest, digest, 'the tap computes the same digest from the real accepted Need');
    assert.equal(t.seen.read.p_policy_content_sha256, 'c'.repeat(64));
    assert.deepEqual([t.seen.complete.p_attempt_id, t.seen.complete.p_outcome, t.seen.complete.p_model_ref], [ATTEMPT, 'ALLOW', 'gemini-3.8-flash']);
    assert.ok(!t.h.calls.some(c => c.origin !== H.ORIGIN || c.path.endsWith('/rpc_ai_test_budget_reserve_service')));
  }
});

test('Edge tap evaluates as before when no reusable decision exists or the model differs', async () => {
  for (const reply of [() => H.json({ state: 'NONE', authoritative: false }),
    () => H.json({ state: 'DECIDED', outcome: 'ALLOW', ruleIds: ['TEST'], safeReasonCodes: [], modelRef: 'other-model', authoritative: false }),
    () => H.json({ message: 'missing' }, 404)]) {
    let budget = 0;
    const t = tapEdge(reply, call => {
      if (call.path.endsWith('/rpc_ai_test_budget_reserve_service')) { budget++; assert.equal(call.args.p_operation_id, ATTEMPT);
        return H.json({ admitted: false, reservationId: null, replay: false, code: 'AI_TEST_BUDGET_EXHAUSTED' }); }
      assert.fail('unexpected ' + call.path);
    });
    const body = await (await t.tap()).json();
    assert.equal(budget, 1, 'falls through to the existing evaluation path');
    assert.equal(body.kind, 'NOT_READY'); assert.equal(t.seen.complete.p_not_ready_code, 'EVALUATOR_UNAVAILABLE');
  }
});

test('evaluator source keeps the review-less deterministic revision budget and the tap-only publisher', () => {
  assert.match(evaluator, /const providerOperationId=reviewAttemptId\?\?await revisionOperationId\(user\.id,needId,revision\);/);
  assert.doesNotMatch(evaluator, /rpc_publish|rpc_accept_ai_task_review['`]/, 'the evaluator never accepts or publishes');
  assert.match(evaluator, /reserve\('pre:' \+ user\.id\)/, 'a background check cannot rate-limit the owner tap');
});

// ---------------------------------------------------------------- Client service
function clientService(invokeReply) {
  const session = { user: { id: H.ACCOUNT }, accountRevision: 1 }, calls = [];
  const cache = new Map();
  const overrides = {
    'src/store/sesija.ts': { sesijaSada: () => session },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => ({
      auth: { getSession: async () => ({ data: { session: { user: { id: H.ACCOUNT }, access_token: 'jwt' } }, error: null }) },
      functions: { invoke: async (name, options) => { calls.push({ name, options }); return invokeReply(); } },
      rpc: async () => assert.fail('no RPC') }) },
  };
  function load(relative) {
    if (Object.hasOwn(overrides, relative)) return overrides[relative];
    const filename = ['', '.ts', '.tsx', '.mjs', '/index.ts'].map(ext => path.resolve(ROOT, relative + ext)).find(f => fs.existsSync(f) && fs.statSync(f).isFile());
    assert.ok(filename, relative); relative = path.relative(ROOT, filename).replaceAll(path.sep, '/');
    if (Object.hasOwn(overrides, relative)) return overrides[relative];
    if (cache.has(relative)) return cache.get(relative).exports;
    const out = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename.endsWith('.mjs') ? filename + '.ts' : filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const mod = { exports: {} }; cache.set(relative, mod);
    new Function('require', 'module', 'exports', out)(name => name.startsWith('.')
      ? load(path.relative(ROOT, path.resolve(path.dirname(filename), name)).replaceAll(path.sep, '/')) : require(name), mod, mod.exports);
    return mod.exports;
  }
  const module = load('src/data/aiTaskReviewClientService.ts');
  return { api: module.aiTaskReviewClientService, decode: module.decodeAiTaskReview, calls };
}
const reviewFixture = () => ({ reviewId: REVIEW_ID, accountId: H.ACCOUNT, conversationId: '34343434-3434-4434-8434-343434343434', schemaVersion: 'NEED_FACT_V2',
  draftId: null, draftRevision: 0, displayedContentDigest: 'a'.repeat(64), factsRevision: 'b'.repeat(64), sourceTurnRevision: 8,
  geographyRevision: 'c'.repeat(64), expiresAt: '2030-11-20T12:00:00Z', responseDeadline: null, publicProjection: [], ownerPrivateProjection: [],
  location: { taskCountryCode: 'RS', geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null, resolvedLocation: null },
  missingRequired: [], canAccept: true, safety: 'ALLOW' });

test('client preEvaluate sends only the review identity and accepts only a non-authoritative state', async () => {
  const ok = clientService(() => ({ data: { kind: 'PRE_EVALUATION', state: 'READY', authoritativeDecision: false }, error: null }));
  const review = ok.decode(reviewFixture(), H.ACCOUNT); assert.ok(review, 'fixture is a valid review');
  const result = await ok.api.preEvaluate(review);
  assert.deepEqual(result, { ok: true, podatak: { state: 'READY' } });
  assert.deepEqual(ok.calls.map(c => [c.name, c.options.body]), [['uskoci-publication-evaluate',
    { preEvaluateReviewId: REVIEW_ID, displayedContentDigest: 'a'.repeat(64) }]]);
  const forged = clientService(() => ({ data: { kind: 'PRE_EVALUATION', state: 'READY', authoritativeDecision: true }, error: null }));
  assert.equal((await forged.api.preEvaluate(review)).ok, false);
  const decision = clientService(() => ({ data: { kind: 'DECISION', decision: decisionReceipt() }, error: null }));
  assert.equal((await decision.api.preEvaluate(review)).ok, false);
  const blocked = clientService(() => assert.fail('no request for a review that cannot be accepted'));
  assert.equal((await blocked.api.preEvaluate({ ...review, canAccept: false })).ok, false);
});
