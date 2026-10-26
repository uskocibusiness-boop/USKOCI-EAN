import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

// Uses the pinned development-only PGlite runtime (npm ci). An isolated external
// runtime may be selected with USKOCI_PGLITE_MODULE=/absolute/path/to/index.cjs.
// node --test supabase/proofs/taxonomy/published_need_category_gate.test.mjs
// The database is always ephemeral in memory. No URL, credentials or network are used.
const require = createRequire(import.meta.url);
const {PGlite} = require(process.env.USKOCI_PGLITE_MODULE || '@electric-sql/pglite');
const filename = '20261026214500_published_need_category_gate.sql';
const rejected = new URL(`../../../docs/ai-stabilization/rejected/${filename}`, import.meta.url);
const rejectedBytes = readFileSync(rejected);
const rejectedSql = rejectedBytes.toString('utf8');
const scopeSource = readFileSync(new URL(
  '../../candidates/dynamic-taxonomy-20261011/taxonomy-strict-worker-mode-v1.sql', import.meta.url), 'utf8');
const scopeStart = scopeSource.indexOf('CREATE OR REPLACE FUNCTION private.taxonomy_scope_eligible_v1(');
const scopeEnd = scopeSource.indexOf('END $eligible$;', scopeStart);
assert.ok(scopeStart >= 0 && scopeEnd > scopeStart, 'existing strict scope function must be present');
const scopeSql = scopeSource.slice(scopeStart, scopeEnd + 'END $eligible$;'.length);

const categoryId = '10000000-0000-4000-8000-000000000001';
const workerId = '20000000-0000-4000-8000-000000000001';
const legacyId = '30000000-0000-4000-8000-000000000001';
const draftId = '30000000-0000-4000-8000-000000000002';
const reviewId = '40000000-0000-4000-8000-000000000001';
const requestId = '50000000-0000-4000-8000-000000000001';

async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create schema private;
    create table private.work_taxonomy_categories (id uuid primary key, state text);
    create table public.needs (
      id uuid primary key, status text not null, category_id uuid,
      revision integer not null default 1, execution_location_mode text default 'REMOTE',
      title text not null,
      constraint needs_category_id_fkey foreign key (category_id)
        references private.work_taxonomy_categories(id)
    );
    insert into private.work_taxonomy_categories values ('${categoryId}', 'ESTABLISHED');
    insert into public.needs(id, status, title) values
      ('${legacyId}', 'PUBLISHED', 'Synthetic legacy task'),
      ('${draftId}', 'DRAFT', 'Synthetic pending task');
  `);
  return db;
}

async function installExistingScopeGuard(db) {
  // Only the columns used by the unchanged source function are modeled. This
  // proves the matching boundary, not the full publication/binder RPC or DEV E2E.
  await db.exec(`
    create table private.work_taxonomy_need_snapshots (
      need_id uuid, need_revision integer, category_id uuid,
      reviewed_by_requester boolean, classification_state text);
    create table private.work_taxonomy_category_modes (category_id uuid, execution_scope text);
    create table private.worker_execution_mode_choices (
      worker_account_id uuid, modes text[], confirmed_at timestamptz);
    create table private.work_taxonomy_worker_capabilities (
      worker_account_id uuid, category_id uuid, excluded boolean);
    create table private.worker_ai_saves (account_id uuid, review_id uuid, client_request_id uuid);
    create table private.taxonomy_confirmed_worker_modes_v1 (
      worker_account_id uuid, category_id uuid, execution_scope text, active boolean,
      source_review_id uuid, source_request_key uuid);
  `);
  await db.exec(scopeSql);
}

async function eligible(db, needId = draftId) {
  const result = await db.query(
    'select private.taxonomy_scope_eligible_v1($1::uuid, $2::uuid) as eligible', [needId, workerId]);
  return result.rows[0].eligible;
}

test('rejected unshipped gate is byte-preserved outside the migration inventory', () => {
  assert.equal(createHash('sha256').update(rejectedBytes).digest('hex'),
    '6083ff11335e90cda3a59c4f01f621b1e1a4a64187b7d863bf82b96cc5397ada');
  assert.equal(existsSync(new URL(`../../migrations/${filename}`, import.meta.url)), false);
  for (const inventory of ['MD5_MANIFEST.txt', 'MIGRATION_PROVENANCE.json']) {
    assert.equal(readFileSync(new URL(`../../migrations/${inventory}`, import.meta.url), 'utf8')
      .includes(filename), false);
  }
});

test('original NOT VALID gate rejects pending publication before a later binder can run', async t => {
  const db = await fixture(t);
  await db.exec(rejectedSql);
  await assert.rejects(db.query('update public.needs set status = $1 where id = $2',
    ['PUBLISHED', draftId]), error => error.code === '23514'
      && error.constraint === 'needs_published_category_required');
  const result = await db.query('select status, category_id from public.needs where id = $1', [draftId]);
  assert.deepEqual(result.rows, [{status: 'DRAFT', category_id: null}]);
});

test('original NOT VALID gate also rejects unrelated edits of existing published rows', async t => {
  const db = await fixture(t);
  await db.exec(rejectedSql);
  const constraint = await db.query(`select convalidated from pg_constraint
    where conname = 'needs_published_category_required'`);
  assert.equal(constraint.rows[0].convalidated, false);
  await assert.rejects(db.query('update public.needs set title = $1 where id = $2',
    ['Synthetic corrected title', legacyId]), error => error.code === '23514'
      && error.constraint === 'needs_published_category_required');
});

test('withdrawal preserves pending publication and legacy edits while strict matching rejects both', async t => {
  const db = await fixture(t);
  await installExistingScopeGuard(db);
  await db.query('update public.needs set status = $1 where id = $2', ['PUBLISHED', draftId]);
  await db.query('update public.needs set title = $1 where id = $2', ['Synthetic corrected title', legacyId]);
  const result = await db.query('select status, category_id from public.needs where id = $1', [draftId]);
  assert.deepEqual(result.rows, [{status: 'PUBLISHED', category_id: null}]);
  assert.equal(await eligible(db, legacyId), false);
  assert.equal(await eligible(db), false);
});

test('existing scope guard requires signed current category, mode and saved worker consent', async t => {
  const db = await fixture(t);
  await installExistingScopeGuard(db);
  await db.query('update public.needs set status = $1, category_id = $2 where id = $3',
    ['PUBLISHED', categoryId, draftId]);
  assert.equal(await eligible(db), false, 'a non-null category alone is not matching authority');
  await db.exec(`
    insert into private.work_taxonomy_need_snapshots values
      ('${draftId}', 1, '${categoryId}', true, 'CONFIRMED');
    insert into private.work_taxonomy_category_modes values ('${categoryId}', 'REMOTE');
    insert into private.worker_execution_mode_choices values ('${workerId}', array['REMOTE'], now());
    insert into private.work_taxonomy_worker_capabilities values ('${workerId}', '${categoryId}', false);
    insert into private.taxonomy_confirmed_worker_modes_v1 values
      ('${workerId}', '${categoryId}', 'REMOTE', true, '${reviewId}', '${requestId}');
  `);
  assert.equal(await eligible(db), false, 'unsaved consent must not activate matching');
  await db.exec(`insert into private.worker_ai_saves values ('${workerId}', '${reviewId}', '${requestId}')`);
  assert.equal(await eligible(db), true, 'signed current compatible scope must remain eligible');
  await db.query('update public.needs set revision = 2 where id = $1', [draftId]);
  assert.equal(await eligible(db), false, 'stale signed revision must not authorize matching');
  await db.query('update public.needs set revision = 1, execution_location_mode = $1 where id = $2',
    ['STATIONARY', draftId]);
  assert.equal(await eligible(db), false, 'REMOTE confirmation must not authorize ON_SITE');
  await db.query('update public.needs set execution_location_mode = $1 where id = $2', ['REMOTE', draftId]);
  await db.exec('update private.work_taxonomy_worker_capabilities set excluded = true');
  assert.equal(await eligible(db), false, 'explicit exclusion must remain authoritative');
});

test('withdrawal does not weaken the existing canonical category foreign key', async t => {
  const db = await fixture(t);
  await assert.rejects(db.query('update public.needs set category_id = $1 where id = $2',
    ['10000000-0000-4000-8000-000000000099', draftId]), error => error.code === '23503'
      && error.constraint === 'needs_category_id_fkey');
});
