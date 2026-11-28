'use strict';
// Reproduces the DEV 20.11.2026 stuck-classification payload (conversation
// 1c4fa742-…) against the captured SQL turn resolver and catalog, then proves the
// Edge normalization makes the same decision resolvable. Diagnostic SQL fixture:
// the resolver body is the 2026-11-09 capture (live DEV md5 has since changed);
// its CREATE_* path walk is asserted below to be the code path that conflicts.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const ROOT = path.resolve(__dirname, '..');
const capture = JSON.parse(fs.readFileSync(path.join(__dirname, 'sql/worker_catalog_conflict_20261109.preimage.json'), 'utf8'));
const md5 = x => crypto.createHash('md5').update(x).digest('hex');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const account = '10000000-0000-4000-8000-000000000001';
const PARENT_ID = '00000000-0000-4000-8000-000000000017';
const SERVICE = 'Statiranje i pomoć na snimanju';

function loadTaxonomy() {
  const modules = new Map();
  const load = relative => {
    const file = path.resolve(ROOT, relative);
    if (modules.has(file)) return modules.get(file).exports;
    const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file.endsWith('.mjs') ? file + '.ts' : file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const mod = { exports: {} }; modules.set(file, mod);
    const req = name => name.startsWith('.') ? load(path.relative(ROOT, path.resolve(path.dirname(file), name))) : require(name);
    new Function('require', 'module', 'exports', out)(req, mod, mod.exports);
    return mod.exports;
  };
  return load('supabase/functions/_shared/backgroundTaxonomyArchitect.mjs');
}

async function fixture() {
  const db = new PGlite();
  await db.exec(`create schema private;create schema auth;create schema extensions;
  create table private.work_taxonomy_gemini_turn_hints_v1(id uuid primary key,account_id uuid,catalog_version bigint,proposals jsonb,catalog_resolution jsonb);
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
  for (const fn of [...capture.functions].sort((a, b) => Number(a.signature.includes('resolve_turn')) - Number(b.signature.includes('resolve_turn')))) {
    assert.equal(md5(fn.definition.split('AS $function$')[1].split('$function$')[0]), fn.body_md5);
    await db.exec(fn.definition);
  }
  const value = async (sql, args = []) => (await db.query(sql, args)).rows[0].value;
  return { db, value, async resolve(proposals) {
    const id = crypto.randomUUID(), anchors = [], seen = new Set();
    for (const p of proposals) {
      let at = ['REUSE_EXISTING', 'EXTEND_MODE'].includes(p.action) ? p.categoryId : p.parentId;
      while (at && !seen.has(at)) { const c = capture.catalog.categories.find(x => x.id === at); assert.ok(c); seen.add(at);
        anchors.push({ categoryId: c.id, label: c.label, parentId: c.parent_id }); at = c.parent_id; }
    }
    await db.query('insert into private.work_taxonomy_gemini_turn_hints_v1 values($1,$2,$3,$4,null)',
      [id, account, capture.catalog.catalogVersion, JSON.stringify(proposals)]);
    return value("select private.taxonomy_resolve_turn_catalog_v1($1,$2,$3,'ALLOW') as value", [id, sha(JSON.stringify(proposals)), JSON.stringify(anchors)]);
  } };
}

function edgeCatalog(taxonomy) {
  const parents = new Set(capture.catalog.categories.map(c => c.parent_id).filter(Boolean));
  return taxonomy.indexFullCatalog(capture.catalog.catalogVersion, 'a'.repeat(32), capture.catalog.categories
    .filter(c => c.state === 'ESTABLISHED').map(c => ({ categoryId: c.id, label: c.label, parentId: c.parent_id,
      isLeaf: !parents.has(c.id), aliases: [], modes: capture.catalog.modes.filter(m => m.category_id === c.id).map(m => m.execution_scope) })), true);
}

const observed = { service: SERVICE, mode: 'ON_SITE', action: 'CREATE_CHILD', categoryId: '', parentId: PARENT_ID,
  proposedPath: ['Potrčko, svakodnevna pomoć i briga', SERVICE], catalogVersion: capture.catalog.catalogVersion,
  reason: 'Statiranje i asistencija na snimanju spota je fizička/praktična ispomoć na terenu.' };

test('captured resolver: CREATE_CHILD repeating its parent label is CATALOG_CONFLICT (the stuck DEV review)', async () => {
  assert.ok(capture.functions[0].definition.includes('c.parent_id IS DISTINCT FROM parent'), 'the CREATE path walk under test');
  const f = await fixture();
  try {
    const result = await f.resolve([observed]);
    assert.equal(result.state, 'DEFERRED'); assert.equal(result.code, 'CATALOG_CONFLICT');
    assert.equal(await f.value('select count(*)::int as value from private.work_taxonomy_audit'), 0);
  } finally { await f.db.close(); }
});

test('Edge-normalized decision resolves: the server creates the new child under the decided parent', async () => {
  const taxonomy = loadTaxonomy(), catalog = edgeCatalog(taxonomy);
  const built = await taxonomy.buildFullTreeTaxonomyProposals({ suppliedCatalog: catalog, suppliedDecisions: [{ ...observed, ambiguityPrompt: '' }],
    items: [{ service: SERVICE, mode: 'ON_SITE' }], conversationId: '20000000-0000-4000-8000-000000000001', draftRevision: 2 });
  assert.equal(built.proposals.length, 1);
  assert.deepEqual(built.proposals[0].proposedPath, [SERVICE]);
  const f = await fixture();
  try {
    const result = await f.resolve(built.proposals);
    assert.equal(result.state, 'RESOLVED', JSON.stringify(result));
    const created = await f.value('select row_to_json(c) as value from private.work_taxonomy_categories c where c.id=$1', [result.items[0].categoryId]);
    assert.equal(created.label, SERVICE); assert.equal(created.parent_id, PARENT_ID);
    // A later turn repeating the same decision reuses the created node (no conflict, no duplicate).
    const again = await f.resolve(built.proposals);
    assert.equal(again.state, 'RESOLVED'); assert.equal(again.items[0].categoryId, result.items[0].categoryId);
  } finally { await f.db.close(); }
});

test('Edge repair turns a "new" service that already exists into reuse/extension, which the resolver accepts', async () => {
  const taxonomy = loadTaxonomy(), catalog = edgeCatalog(taxonomy);
  const parents = new Set(capture.catalog.categories.map(c => c.parent_id).filter(Boolean));
  const leaf = capture.catalog.categories.find(c => c.state === 'ESTABLISHED' && !parents.has(c.id) && c.parent_id
    && capture.catalog.modes.some(m => m.category_id === c.id && m.execution_scope === 'ON_SITE')
    && !capture.catalog.aliases.some(a => a.normalized_key === c.canonical_key && a.category_id !== c.id)
    && capture.catalog.categories.filter(x => x.canonical_key === c.canonical_key).length === 1);
  assert.ok(leaf);
  // Anchored under the wrong parent the resolver would conflict; reuse needs no path at all.
  const decision = { ...observed, service: leaf.label, parentId: PARENT_ID, proposedPath: [leaf.label] };
  const f = await fixture();
  try {
    const repaired = taxonomy.normalizeTaxonomyDecision(decision, catalog);
    assert.equal(repaired.action, 'REUSE_EXISTING'); assert.equal(repaired.categoryId, leaf.id);
    const result = await f.resolve([{ ...repaired, catalogVersion: capture.catalog.catalogVersion }]);
    assert.equal(result.state, 'RESOLVED', JSON.stringify(result)); assert.equal(result.items[0].categoryId, leaf.id);
  } finally { await f.db.close(); }
});

test('language family is not an executable capability, even before any child exists', async () => {
  const taxonomy = loadTaxonomy();
  const parentId = '00000000-0000-4000-8000-000000000802';
  const family = { categoryId: parentId, label: 'Časovi stranih jezika', parentId: null,
    isLeaf: true, aliases: [], modes: ['ON_SITE','REMOTE'] };
  const english = { categoryId: '10000000-0000-4000-8000-000000000802',
    label: 'Časovi engleskog jezika', parentId, isLeaf: true, aliases: ['Časovi engleskog'], modes: ['REMOTE'] };
  const build = (categories, service, action, categoryId, childParent, proposedPath) => {
    const catalog = taxonomy.indexFullCatalog(24, 'a'.repeat(32), categories, true);
    return taxonomy.buildFullTreeTaxonomyProposals({ suppliedCatalog: catalog,
      suppliedDecisions: [{ service, mode: 'REMOTE', action, categoryId, parentId: childParent,
        proposedPath, ambiguityPrompt: '', reason: 'Specifična potvrđena usluga iz razgovora.' }],
      items: [{ service, mode: 'REMOTE' }], draftRevision: 2 });
  };
  const broad = await build([family], family.label, 'REUSE_EXISTING', parentId, '', []);
  assert.equal(broad.proposals.length, 0);
  const wrong = await build([family], english.label, 'REUSE_EXISTING', parentId, '', []);
  assert.equal(wrong.proposals.length, 0);
  const specific = await build([family], english.label, 'CREATE_CHILD', '', parentId, [english.label]);
  assert.equal(specific.proposals.length, 1);
  assert.equal(specific.proposals[0].parentId, parentId);
  const expanded = [{ ...family, isLeaf: false }, english];
  const reused = await build(expanded, english.label, 'REUSE_EXISTING', english.categoryId, '', []);
  assert.equal(reused.proposals.length, 1);
  assert.equal(reused.proposals[0].categoryId, english.categoryId);
  const chinese = await build(expanded, 'Časovi kineskog jezika', 'CREATE_CHILD', '', parentId, ['Časovi kineskog jezika']);
  assert.equal(chinese.proposals.length, 1);
  assert.notEqual(chinese.proposals[0].categoryId, english.categoryId);
  const alias = await build(expanded, 'Časovi engleskog', 'CREATE_CHILD', '', parentId, ['Časovi engleskog']);
  assert.equal(alias.proposals[0].categoryId, english.categoryId);
});
