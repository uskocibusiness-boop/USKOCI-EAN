'use strict';
// A REVIEW/BLOCK publication decision is final for its Need revision (2026-11-21).
// Source-only candidate guard, PG17 parse, functional fixture against the exact DEV
// preimage, and the evaluator's deterministic revision budget operation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');

const root = path.join(__dirname, '..');
const candidate = fs.readFileSync(path.join(__dirname, 'sql', 'publication_decision_final_20261121.candidate.sql'), 'utf8');
const rollback = fs.readFileSync(path.join(__dirname, 'sql', 'rollback_publication_decision_preimage_20261121.sql'), 'utf8');
const evaluator = fs.readFileSync(path.join(root, 'supabase', 'functions', 'uskoci-publication-evaluate', 'index.ts'), 'utf8');
const blocks = [...candidate.matchAll(/DO \$([A-Za-z0-9_]+)\$[\s\S]*?END\s*\$\1\$;/g)];
const tags = blocks.map(match => match[1]);
const md5 = value => createHash('md5').update(value).digest('hex');
const definitions = [...rollback.matchAll(/CREATE OR REPLACE FUNCTION [\s\S]*?\nAS \$function\$([\s\S]*?)\$function\$\n;/g)];

test('publication decision finality SQL remains explicitly source-only and fail-closed', () => {
  assert.match(candidate, /SOURCE-ONLY CANDIDATE/);
  assert.deepEqual(tags, ['source_only', 'record_decision_final', 'publish_rejects_final']);
  assert.match(blocks[0][0], /PUBLICATION_DECISION_FINAL_SOURCE_ONLY/);
  assert.ok(candidate.indexOf('DO $source_only$') < candidate.indexOf('BEGIN;'));
  for (const block of blocks.slice(1)) {
    assert.match(block[0], /_PREIMAGE_DRIFT/); assert.match(block[0], /_ANCHOR_DRIFT/); assert.match(block[0], /_POSTIMAGE_DRIFT/);
    assert.match(block[0], /actual\.prosecdef IS DISTINCT FROM true/);
    assert.match(block[0], /actual\.proconfig IS DISTINCT FROM ARRAY\['search_path=pg_catalog'\]::text\[\]/);
    assert.match(block[0], /actual\.metadata IS DISTINCT FROM original_metadata/);
  }
  const record = blocks[1][0], publish = blocks[2][0];
  assert.match(record, /IS DISTINCT FROM 'f6c506b0d6f53d4c6c0ffdff0c9121c4'/);
  assert.match(record, /IS DISTINCT FROM '\{postgres=X\/postgres,service_role=X\/postgres\}'/);
  assert.match(publish, /IS DISTINCT FROM '9d20dbb6063d8025d7255b10affdd566'/);
  assert.match(publish, /IS DISTINCT FROM '\{postgres=X\/postgres,authenticated=X\/postgres,service_role=X\/postgres\}'/);
  assert.doesNotMatch(candidate, /\bgrant\b|\brevoke\b|security invoker|search_path TO 'public/i, 'no ACL or definer change');
});

test('rollback preimage holds the exact read-only DEV definitions', () => {
  assert.equal(definitions.length, 2);
  assert.equal(md5(definitions[0][1]), 'f6c506b0d6f53d4c6c0ffdff0c9121c4');
  assert.equal(md5(definitions[1][1]), '9d20dbb6063d8025d7255b10affdd566');
  assert.match(rollback, /functiondef_md5=a88ed8ac30a5a001e69ffe59999c1b61/);
  assert.match(rollback, /functiondef_md5=e49706bdd2653f54ef3d80497f6e3a73/);
  assert.match(rollback, /PUBLICATION_DECISION_ROLLBACK_POSTIMAGE_DRIFT/);
});

test('all guarded finality blocks parse as PostgreSQL 17 PL/pgSQL', async () => {
  const db = new PGlite();
  const syntaxError = /syntax error|unterminated dollar-quoted|invalid dollar-quoted|mismatched parentheses/i;
  try {
    for (const block of blocks.slice(1)) {
      await assert.rejects(db.exec(block[0]), error => {
        assert.doesNotMatch(String(error?.message || error), syntaxError, block[1]);
        return true;
      }, `${block[1]} must parse and stop safely on the absent DEV function`);
    }
  } finally { await db.close(); }
});

const NEED = '00000000-0000-4000-8000-0000000000a1', LEGACY_NEED = '00000000-0000-4000-8000-0000000000a0';
const OWNER = '00000000-0000-4000-8000-000000000001', BUNDLE = '00000000-0000-4000-8000-0000000000b1';
const fixture = `
create role service_role; create role authenticated; create role anon;
create schema private; create schema extensions; create schema auth;
create function extensions.digest(bytea, text) returns bytea language sql immutable as 'select sha256($1)';
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
create table public.needs(id uuid primary key, requester_account_id uuid not null, status text not null, revision integer not null,
  public_photo_paths text[] not null default '{}', schedule_kind text not null default 'REMOTE_ANYTIME', starts_at timestamptz,
  published_at timestamptz, response_deadline timestamptz);
create table public.need_geography(need_id uuid primary key, public_topology jsonb not null);
create table private.publication_policy_bundles(id uuid primary key, policy_id text, version integer, jurisdiction text);
create table private.publication_policy_rule_refs(bundle_id uuid, rule_id text, rule_provenance jsonb);
create table private.dispatch_schedule(need_id uuid primary key);
create table private.need_publication_decisions(id uuid primary key default gen_random_uuid(), decision_sequence bigserial unique,
  created_at timestamptz not null default clock_timestamp(), need_id uuid not null, need_revision integer not null,
  fingerprint_schema_version text, canonical_fingerprint text, private_materiality_marker text, public_geography_snapshot jsonb,
  public_media_refs text[], policy_bundle_id uuid, policy_id text, policy_version integer, jurisdiction text, rule_ids text[],
  rule_provenance_snapshot jsonb, outcome text not null, safe_reason_codes text[], decision_source text, provider_ref text, model_ref text,
  reviewer_provenance jsonb, service_provenance jsonb, decision_identity text not null unique);
create table private.need_publish_commands(requester_account_id uuid, client_request_id text, request_hash text, need_id uuid,
  expected_revision integer, decision_id uuid, decision_sequence bigint, canonical_fingerprint text, policy_bundle_id uuid,
  response_deadline timestamptz, result jsonb, primary key(requester_account_id, client_request_id));
insert into private.publication_policy_bundles values ('${BUNDLE}', 'TEST', 1, 'RS');
insert into private.publication_policy_rule_refs values ('${BUNDLE}', 'R_ALLOW', '{"r":1}'), ('${BUNDLE}', 'R_HOLD', '{"r":2}');
create function private.need_publication_context(p_need uuid, p_rev integer, p_actor uuid) returns jsonb language sql stable as $$
  select jsonb_build_object('kind', 'READY', 'binding', jsonb_build_object('needId', n.id, 'needRevision', n.revision, 'policyId', 'TEST',
      'jurisdiction', 'RS', 'policyBundleId', '${BUNDLE}'),
    'policy', jsonb_build_object('rules', jsonb_build_array(
      jsonb_build_object('ruleId', 'R_ALLOW', 'outcomes', jsonb_build_array('ALLOW'), 'safeReasonCodes', '[]'::jsonb),
      jsonb_build_object('ruleId', 'R_HOLD', 'outcomes', jsonb_build_array('REVIEW', 'BLOCK', 'CLARIFY'), 'safeReasonCodes', jsonb_build_array('UNSAFE')))))
  from public.needs n where n.id = p_need and n.revision = p_rev $$;
create function private.need_publication_fingerprint_snapshot(p_need uuid) returns jsonb language sql stable as $$
  select jsonb_build_object('needRevision', n.revision, 'canonicalFingerprint', 'fp-' || n.revision, 'privateMaterialityMarker', 'pm',
    'publicGeography', '{"mode":"REMOTE"}'::jsonb, 'publicMediaRefs', '[]'::jsonb) from public.needs n where n.id = p_need $$;
create function private.media_refs_ready(uuid, text[]) returns boolean language sql as 'select true';
create function private.current_publication_policy_bundle(text, text, timestamptz) returns uuid language sql as $$select '${BUNDLE}'::uuid$$;
create function private.publication_policy_bundle_ready(uuid, text, timestamptz) returns boolean language sql as 'select true';
create function private.finalize_task_replacement(uuid) returns void language sql as 'select';
`;
const RECORD = 'public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)';
const PUBLISH = 'public.rpc_publish_need_canonical(uuid,integer,bigint,timestamp with time zone,text)';

async function preimageDb() {
  const db = new PGlite();
  await db.exec(fixture);
  const statements = rollback.match(/CREATE OR REPLACE FUNCTION [\s\S]*?\$function\$\n;/g);
  for (const statement of statements) await db.exec(statement);
  await db.exec(`revoke all on function ${RECORD} from public; grant execute on function ${RECORD} to service_role;
    revoke all on function ${PUBLISH} from public; grant execute on function ${PUBLISH} to authenticated; grant execute on function ${PUBLISH} to service_role;`);
  return db;
}
async function addNeed(db, id) {
  await db.query(`insert into public.needs(id, requester_account_id, status, revision) values ($1, $2, 'DRAFT', 1)`, [id, OWNER]);
  await db.query(`insert into public.need_geography values ($1, '{"mode":"REMOTE"}')`, [id]);
  await db.query(`insert into private.dispatch_schedule values ($1)`, [id]);
}
async function decide(db, need, revision, outcome) {
  const rule = outcome === 'ALLOW' ? 'R_ALLOW' : 'R_HOLD', reasons = outcome === 'ALLOW' ? [] : ['UNSAFE'];
  const { rows } = await db.query(`select public.rpc_record_need_publication_decision_service($1, $2, 'TEST', 'RS', $3, $4::text[],
    'PUBLICATION_EVALUATOR_V1', $5::text[], 'gemini', 'gemini-3.8-flash', '{}'::jsonb,
    jsonb_build_object('evaluationContext', private.need_publication_context($1, $2, null)->'binding')) as d`, [need, revision, outcome, [rule], reasons]);
  return rows[0].d;
}
async function publish(db, need, revision, sequence, requestId) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [OWNER]);
  const { rows } = await db.query(`select public.rpc_publish_need_canonical($1, $2, $3, null, $4) as r`, [need, revision, sequence, requestId]);
  return rows[0].r;
}
const applyCandidate = db => db.exec(candidate.slice(candidate.indexOf('BEGIN;')));

test('before the candidate a BLOCK can be re-rolled to ALLOW and published (reproduces the defect)', async () => {
  const db = await preimageDb();
  try {
    await addNeed(db, LEGACY_NEED);
    assert.equal((await decide(db, LEGACY_NEED, 1, 'BLOCK')).outcome, 'BLOCK');
    const allow = await decide(db, LEGACY_NEED, 1, 'ALLOW');
    assert.equal(allow.outcome, 'ALLOW');
    assert.equal((await publish(db, LEGACY_NEED, 1, allow.decisionSequence, 'legacy-reroll-1')).status, 'PUBLISHED');
  } finally { await db.close(); }
});

test('after the candidate REVIEW/BLOCK is final for the revision, publish is refused and a new revision is evaluated again', async () => {
  const db = await preimageDb();
  try {
    await addNeed(db, NEED); await addNeed(db, LEGACY_NEED);
    // Pre-existing re-rolled rows (written before the patch) must not stay publishable.
    await decide(db, LEGACY_NEED, 1, 'BLOCK');
    const legacyAllow = await decide(db, LEGACY_NEED, 1, 'ALLOW');
    await applyCandidate(db);
    const posted = await db.query(`select md5(prosrc) m, proacl::text acl, prosecdef, proconfig from pg_proc where oid = any(array[$1::regprocedure, $2::regprocedure]) order by proname desc`, [RECORD, PUBLISH]);
    assert.deepEqual(posted.rows.map(r => r.m), ['567d2d33a4b6f1cec57b1b99c0fc81d7', 'd4b1ebc37183c785dd48a4192ff6de79']);
    assert.deepEqual(posted.rows.map(r => r.acl), ['{postgres=X/postgres,service_role=X/postgres}', '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}']);
    assert.ok(posted.rows.every(r => r.prosecdef === true));

    await assert.rejects(publish(db, LEGACY_NEED, 1, legacyAllow.decisionSequence, 'legacy-after-1'), /PUBLICATION_DECISION_NOT_ALLOW/);

    const block = await decide(db, NEED, 1, 'BLOCK');
    assert.equal(block.outcome, 'BLOCK'); assert.equal(block.publishable, false);
    await assert.rejects(decide(db, NEED, 1, 'ALLOW'), /PUBLICATION_DECISION_FINAL/, 'second decision after BLOCK must be refused');
    await assert.rejects(decide(db, NEED, 1, 'REVIEW'), /PUBLICATION_DECISION_FINAL/);
    const replay = await decide(db, NEED, 1, 'BLOCK');
    assert.equal(replay.decisionSequence, block.decisionSequence, 'exact replay stays idempotent');
    await assert.rejects(publish(db, NEED, 1, block.decisionSequence, 'block-publish-1'), /PUBLICATION_DECISION_NOT_ALLOW/);
    const count = await db.query(`select count(*)::int c from private.need_publication_decisions where need_id = $1`, [NEED]);
    assert.equal(count.rows[0].c, 1);

    await db.query(`update public.needs set revision = 2 where id = $1`, [NEED]);
    const review = await decide(db, NEED, 2, 'REVIEW');
    await assert.rejects(decide(db, NEED, 2, 'ALLOW'), /PUBLICATION_DECISION_FINAL/, 'REVIEW is final as well');
    await assert.rejects(publish(db, NEED, 2, review.decisionSequence, 'review-publish-1'), /PUBLICATION_DECISION_NOT_ALLOW/);

    await db.query(`update public.needs set revision = 3 where id = $1`, [NEED]);
    const allow = await decide(db, NEED, 3, 'ALLOW');
    const published = await publish(db, NEED, 3, allow.decisionSequence, 'allow-publish-1');
    assert.equal(published.status, 'PUBLISHED'); assert.equal(published.idempotentReplay, false);
    assert.equal((await publish(db, NEED, 3, allow.decisionSequence, 'allow-publish-1')).idempotentReplay, true);
  } finally { await db.close(); }
});

test('evaluator binds a review-less call to a deterministic owner/need/revision budget operation', async () => {
  assert.doesNotMatch(evaluator, /reviewAttemptId\?\?crypto\.randomUUID\(\)/, 'a fresh random operation would let an owner re-roll');
  assert.match(evaluator, /const providerOperationId=reviewAttemptId\?\?await revisionOperationId\(user\.id,needId,revision\);/);
  const source = evaluator.match(/async function revisionOperationId[\s\S]*?\n}\n/)[0];
  const ts = require('typescript');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const revisionOperationId = new Function('crypto', 'TextEncoder', js + '\nreturn revisionOperationId;')(globalThis.crypto, TextEncoder);
  const first = await revisionOperationId(OWNER, NEED, 1);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(await revisionOperationId(OWNER, NEED, 1), first, 'repeat calls replay the same budget operation');
  assert.notEqual(await revisionOperationId(OWNER, NEED, 2), first, 'a new revision may be evaluated again');
  assert.notEqual(await revisionOperationId(LEGACY_NEED, NEED, 1), first);
});

test('evaluator repeat without acceptedReviewId reaches only a budget replay, never a provider', async () => {
  const harness = fs.readFileSync(path.join(__dirname, 'supabase-key-compatibility.test.cjs'), 'utf8');
  const ts = require('typescript');
  const ast = ts.createSourceFile('h.cjs', harness, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const declarations = ast.statements.filter(node => ts.isVariableStatement(node) || ts.isFunctionDeclaration(node)).map(node => node.getText(ast)).join('\n');
  const h = new Function('require', '__dirname', declarations + '\nreturn { edge, json, request, modernEnv, publicationContext, ACCOUNT, RECEIPT, USER_JWT };')(require, __dirname);
  const operations = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const edge = h.edge('uskoci-publication-evaluate', { ...h.modernEnv, GEMINI_API_KEY: 'fixture', GEMINI_MODEL: 'gemini-3.8-flash',
      AI_PROVIDER: 'gemini', USKOCI_GEMINI_PAID_TEST_ENABLED: 'true' }, call => {
      if (call.path === '/auth/v1/user') return h.json({ id: h.ACCOUNT, role: 'authenticated' });
      if (call.path.endsWith('/rpc_get_need_publication_context')) return h.json(h.publicationContext());
      assert.ok(call.path.endsWith('/rpc_ai_test_budget_reserve_service'), 'no provider or decision write after a replay: ' + call.path);
      operations.push(call.args.p_operation_id);
      return h.json(attempt === 0 ? { admitted: false, reservationId: null, replay: false, code: 'AI_TEST_BUDGET_EXHAUSTED' }
        : { admitted: false, reservationId: '55555555-5555-4555-8555-555555555555', replay: true, code: 'AI_TEST_OPERATION_REPLAY' });
    });
    const r = await edge.handler(h.request({ needId: h.RECEIPT, expectedRevision: 1 }, { Authorization: h.USER_JWT }));
    const body = await r.json();
    assert.equal(body.kind, 'NOT_READY'); assert.equal(body.authoritativeDecision, false); assert.equal(edge.calls.length, 3);
  }
  assert.equal(operations.length, 2); assert.equal(operations[0], operations[1]);
});
