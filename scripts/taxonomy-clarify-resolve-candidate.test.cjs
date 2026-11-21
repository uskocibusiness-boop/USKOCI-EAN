'use strict';
// Owner decision 21.11.2026: a CLARIFY turn (an ordinary question such as "Za koji datum?")
// still lets the server place the service into the taxonomy tree. REVIEW/BLOCK stay deferred and
// private.taxonomy_risk_triage_v1 remains the per-label catalog safety gate.
// Functional fixture: the exact live DEV resolver preimage (rollback file) plus the captured helper
// functions, whose prosrc md5 equals the live DEV helpers on 2026-11-21.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');

const ROOT = path.resolve(__dirname, '..');
const candidate = fs.readFileSync(path.join(__dirname, 'sql', 'taxonomy_clarify_resolve_20261121.candidate.sql'), 'utf8');
const rollback = fs.readFileSync(path.join(__dirname, 'sql', 'rollback_taxonomy_clarify_resolve_preimage_20261121.sql'), 'utf8');
const capture = JSON.parse(fs.readFileSync(path.join(__dirname, 'sql', 'worker_catalog_conflict_20261109.preimage.json'), 'utf8'));
const blocks = [...candidate.matchAll(/DO \$([A-Za-z0-9_]+)\$[\s\S]*?END\s*\$\1\$;/g)];
const md5 = x => crypto.createHash('md5').update(x).digest('hex');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const SIG = 'private.taxonomy_resolve_turn_catalog_v1(uuid,text,jsonb,text)';
const PRE_SRC_MD5 = '639983846b4f6b51cfe62c91afe4b0d6';
const POST_SRC_MD5 = 'f468d6019b2586f62cc69809b54761af';
const LIVE_HELPERS = {
  'private.taxonomy_normalize_v1(text)': '8c360cb0a05699cdae25485a5efc77ba',
  'private.taxonomy_risk_triage_v1(text)': '93d94a6c7e21ce3ecb854cda239b546a',
  'private.taxonomy_turn_category_identity_v1(uuid)': 'b8ccc18825305df690c1b9b2546e03c9',
};
const account = '10000000-0000-4000-8000-000000000001';

const preimageDef = () => {
  const start = rollback.indexOf('CREATE OR REPLACE FUNCTION');
  return rollback.slice(start, rollback.indexOf('$function$\n;', start)) + '$function$\n';
};
const srcOf = def => def.split('AS $function$')[1].split('$function$')[0];

test('candidate is source-only, guarded and pinned to the live DEV preimage', () => {
  assert.match(candidate, /SOURCE-ONLY CANDIDATE/);
  assert.deepEqual(blocks.map(b => b[1]), ['source_only', 'resolve_clarify']);
  assert.match(blocks[0][0], /RAISE EXCEPTION 'TAXONOMY_CLARIFY_RESOLVE_SOURCE_ONLY'/);
  assert.ok(candidate.indexOf('DO $source_only$') < candidate.indexOf('BEGIN;'));
  const main = blocks[1][0];
  assert.ok(main.includes(`actual.body_md5 IS DISTINCT FROM '${PRE_SRC_MD5}'`));
  assert.ok(main.includes(`actual.body_md5 IS DISTINCT FROM '${POST_SRC_MD5}'`));
  assert.ok(main.includes("actual.acl IS DISTINCT FROM '{postgres=X/postgres}'"));
  assert.ok(main.includes('actual.prosecdef IS DISTINCT FROM false'));
  assert.ok(main.includes("actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]"));
  assert.match(main, /IN\('ALLOW','CLARIFY'\)/);
  assert.doesNotMatch(main.split('$new$')[1], /REVIEW'|'BLOCK/, 'REVIEW/BLOCK are never admitted');
});

test('rollback preimage is the exact live DEV definition (functiondef + prosrc md5)', () => {
  const def = preimageDef();
  assert.equal(md5(def), 'a17c1e66493c2ed1273aeca39679c9a0');
  assert.equal(md5(srcOf(def)), PRE_SRC_MD5);
  assert.match(rollback, /TAXONOMY_CLARIFY_RESOLVE_ROLLBACK_POSTIMAGE_DRIFT/);
  for (const fn of capture.functions.filter(f => LIVE_HELPERS[f.signature]))
    assert.equal(fn.body_md5, LIVE_HELPERS[fn.signature], `${fn.signature} capture equals live DEV`);
});

test('Edge callers already build and send the plan for ALLOW and CLARIFY (no Edge change needed)', () => {
  const need = fs.readFileSync(path.join(ROOT, 'supabase/functions/uskoci-ai-interview/index.ts'), 'utf8');
  const worker = fs.readFileSync(path.join(ROOT, 'supabase/functions/uskoci-worker-interview/index.ts'), 'utf8');
  const shared = fs.readFileSync(path.join(ROOT, 'supabase/functions/_shared/singlePassTaxonomy.mjs'), 'utf8');
  assert.match(need, /singlePassActive && aiTurn\.intentAllowsChanges && \['ALLOW','CLARIFY'\]\.includes\(aiTurn\.safety\)/);
  assert.match(need, /p_safety: aiTurn\.safety/);
  assert.match(worker, /singlePassActive && intentAllowsChanges && serviceChangesValid && \['ALLOW','CLARIFY'\]\.includes\(output\.safety\)/);
  // The receipt decoder still accepts both outcomes; SAFETY_UNRESOLVED remains valid for REVIEW/BLOCK replays.
  assert.match(shared, /'SAFETY_UNRESOLVED', 'CATALOG_CHANGED'/);
});

async function fixture() {
  const db = new PGlite();
  await db.exec(`create schema private;create schema auth;create schema extensions;
  create table private.work_taxonomy_gemini_turn_hints_v1(id uuid primary key,account_id uuid,purpose text,catalog_version bigint,proposals jsonb,catalog_resolution jsonb);
  create table private.work_taxonomy_control(singleton boolean primary key,catalog_version bigint,updated_at timestamptz);
  create table private.work_taxonomy_categories(id uuid primary key default gen_random_uuid(),label text,parent_id uuid,canonical_key text unique,state text,source text,catalog_version bigint);
  create table private.work_taxonomy_category_modes(category_id uuid,execution_scope text,source_ref text,primary key(category_id,execution_scope));
  create table private.work_taxonomy_aliases(category_id uuid,normalized_key text);
  create table private.work_taxonomy_risk_rules(pattern text,decision text,enabled boolean);
  create table private.work_taxonomy_audit(action text,category_id uuid,normalized_key text,catalog_version bigint,source_ref text);
  create function auth.jwt() returns jsonb language sql as $$select '{"role":"service_role"}'::jsonb$$;
  create function private.closure_assert_open(uuid) returns void language sql as $$select null::void$$;
  create function extensions.digest(text,text) returns bytea language sql immutable as $$select case when $2='sha256' then sha256(convert_to($1,'UTF8')) end$$;`);
  await db.query('insert into private.work_taxonomy_control values(true,$1,now())', [capture.catalog.catalogVersion]);
  for (const c of capture.catalog.categories) await db.query('insert into private.work_taxonomy_categories values($1,$2,$3,$4,$5,$6,$7)',
    [c.id, c.label, c.parent_id, c.canonical_key, c.state, c.source, c.catalog_version]);
  for (const m of capture.catalog.modes) await db.query('insert into private.work_taxonomy_category_modes values($1,$2,null)', [m.category_id, m.execution_scope]);
  for (const a of capture.catalog.aliases) await db.query('insert into private.work_taxonomy_aliases values($1,$2)', [a.category_id, a.normalized_key]);
  for (const r of capture.catalog.riskRules) await db.query('insert into private.work_taxonomy_risk_rules values($1,$2,$3)', [r.pattern, r.decision, r.enabled]);
  for (const fn of capture.functions.filter(f => LIVE_HELPERS[f.signature])) await db.exec(fn.definition);
  await db.exec(preimageDef());
  await db.exec(`revoke all on function ${SIG} from public;`);
  const value = async (sql, args = []) => (await db.query(sql, args)).rows[0].value;
  assert.equal(await value(`select md5(prosrc) as value from pg_proc where oid='${SIG}'::regprocedure`), PRE_SRC_MD5);
  return { db, value };
}

async function applyCandidate(db) {
  const body = candidate.slice(candidate.indexOf('BEGIN;'));
  await db.exec(body);
  const row = (await db.query(`select md5(prosrc) m, proacl::text acl from pg_proc where oid='${SIG}'::regprocedure`)).rows[0];
  assert.equal(row.m, POST_SRC_MD5); assert.equal(row.acl, '{postgres=X/postgres}');
}

const parents = new Set(capture.catalog.categories.map(c => c.parent_id).filter(Boolean));
const leaf = capture.catalog.categories.find(c => c.state === 'ESTABLISHED' && !parents.has(c.id) && c.parent_id
  && capture.catalog.modes.some(m => m.category_id === c.id && m.execution_scope === 'ON_SITE')
  && !capture.catalog.aliases.some(a => a.normalized_key === c.canonical_key && a.category_id !== c.id)
  && capture.catalog.categories.filter(x => x.canonical_key === c.canonical_key).length === 1
  && !/elektric|medicin|hemij|dron|baterij|licenc|opasn|gasn|plinsk|solarn|visinsk|vatren|pesticid|azbest|lekov|hirurg/i.test(c.label));
const anchorsFor = proposals => {
  const out = [], seen = new Set();
  for (const p of proposals) {
    let at = ['REUSE_EXISTING', 'EXTEND_MODE'].includes(p.action) ? p.categoryId : p.parentId;
    while (at && !seen.has(at)) { const c = capture.catalog.categories.find(x => x.id === at); seen.add(at);
      out.push({ categoryId: c.id, label: c.label, parentId: c.parent_id }); at = c.parent_id; }
  }
  return out;
};
async function resolve(f, proposals, safety) {
  const id = crypto.randomUUID();
  await f.db.query('insert into private.work_taxonomy_gemini_turn_hints_v1 values($1,$2,$3,$4,$5,null)',
    [id, account, 'NEED_SERVICE', capture.catalog.catalogVersion, JSON.stringify(proposals)]);
  const args = [id, sha(JSON.stringify(proposals) + safety), JSON.stringify(anchorsFor(proposals)), safety];
  return { id, args, result: await f.value('select private.taxonomy_resolve_turn_catalog_v1($1,$2,$3,$4) as value', args) };
}
const reuse = () => [{ service: leaf.label, mode: 'ON_SITE', action: 'REUSE_EXISTING', categoryId: leaf.id, parentId: leaf.parent_id,
  proposedPath: [leaf.label], catalogVersion: capture.catalog.catalogVersion, reason: 'x' }];
const createUnder = label => [{ service: label, mode: 'ON_SITE', action: 'CREATE_CHILD', categoryId: '', parentId: leaf.parent_id,
  proposedPath: [label], catalogVersion: capture.catalog.catalogVersion, reason: 'x' }];

test('live preimage defers CLARIFY (the owner-reported behaviour this candidate removes)', async () => {
  assert.ok(leaf);
  const f = await fixture();
  try {
    const { result } = await resolve(f, reuse(), 'CLARIFY');
    assert.equal(result.state, 'DEFERRED'); assert.equal(result.code, 'SAFETY_UNRESOLVED');
  } finally { await f.db.close(); }
});

test('after the candidate: CLARIFY and ALLOW resolve; replay is idempotent', async () => {
  const f = await fixture();
  try {
    await applyCandidate(f.db);
    for (const safety of ['CLARIFY', 'ALLOW']) {
      const { result, args } = await resolve(f, reuse(), safety);
      assert.equal(result.state, 'RESOLVED', `${safety}: ${JSON.stringify(result)}`);
      assert.equal(result.items[0].categoryId, leaf.id);
      const again = await f.value('select private.taxonomy_resolve_turn_catalog_v1($1,$2,$3,$4) as value', args);
      assert.deepEqual(again, result);
    }
    // CLARIFY may also create a new low-risk child under an established parent.
    const { result } = await resolve(f, createUnder('Čuvanje mesta u redu ispred šaltera'), 'CLARIFY');
    assert.equal(result.state, 'RESOLVED', JSON.stringify(result));
    assert.equal(await f.value("select count(*)::int as value from private.work_taxonomy_audit where action='AUTO_CREATED'"), 1);
  } finally { await f.db.close(); }
});

test('after the candidate: REVIEW, BLOCK, NULL and unknown safety stay deferred without catalog writes', async () => {
  const f = await fixture();
  try {
    await applyCandidate(f.db);
    const version = await f.value('select catalog_version as value from private.work_taxonomy_control');
    for (const safety of ['REVIEW', 'BLOCK', null, 'clarify', 'ALLOW ']) {
      const { result } = await resolve(f, createUnder('Nova bezbedna usluga pomoći'), safety);
      assert.equal(result.state, 'DEFERRED', String(safety)); assert.equal(result.code, 'SAFETY_UNRESOLVED');
    }
    assert.equal(await f.value('select count(*)::int as value from private.work_taxonomy_audit'), 0);
    assert.equal(String(await f.value('select catalog_version as value from private.work_taxonomy_control')), String(version));
  } finally { await f.db.close(); }
});

test('after the candidate: a risky label under CLARIFY is still blocked by risk triage', async () => {
  const f = await fixture();
  try {
    await applyCandidate(f.db);
    for (const label of ['Popravka električnih instalacija', 'Prodaja oružja i municije']) {
      const { result } = await resolve(f, createUnder(label), 'CLARIFY');
      assert.equal(result.state, 'DEFERRED', label); assert.equal(result.code, 'CATALOG_SAFETY', label);
    }
    assert.equal(await f.value('select count(*)::int as value from private.work_taxonomy_audit'), 0);
    assert.equal(await f.value("select count(*)::int as value from private.work_taxonomy_categories where label ilike '%oružj%' or label ilike 'Popravka električnih%'"), 0);
  } finally { await f.db.close(); }
});

test('candidate refuses a drifted preimage', async () => {
  const f = await fixture();
  try {
    await f.db.exec(preimageDef().replace("'SAFETY_UNRESOLVED'", "'SAFETY_UNRESOLVED' "));
    await assert.rejects(f.db.exec(candidate.slice(candidate.indexOf('BEGIN;'))), /TAXONOMY_CLARIFY_RESOLVE_PREIMAGE_DRIFT/);
  } finally { await f.db.close(); }
});
