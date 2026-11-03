// C09: execute the current SQL projection used by signed owner review, rather
// than a separate JavaScript implementation with no production consumers.
// Exact bootstrap functions/tables, synthetic catalog rows, no SQL function
// stubs. This is isolated PostgreSQL evidence, NOT HTTP/Auth/Save/binder proof.
import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { inspectGeminiClassificationShadow } from '../../functions/_shared/classificationGeminiShadow.mjs';

const source = readFileSync(new URL('../privacy/bootstrap/current-application.sql', import.meta.url), 'utf8');
assert.equal(createHash('sha256').update(source).digest('hex'),
  '1702ea9a70a08265d74441557c04b6840a343493905a780c6b89fc4dc598f99f');
const functions = ['taxonomy_normalize_v1', 'taxonomy_admission_fingerprint_v1', 'taxonomy_review_exact_projection_v1'];
const tables = ['work_taxonomy_categories', 'work_taxonomy_category_modes', 'work_taxonomy_aliases', 'work_taxonomy_control'];
const db = new PGlite();
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const paint = 'Krečenje zidova', slide = 'Izrada prezentacija';
const lessons = 'Časovi umetničkog klizanja', rental = 'Iznajmljivanje klizaljki';
const catalog = [
  { id: id(1), label: paint, modes: ['ON_SITE'] },
  { id: id(2), label: slide, modes: ['ON_SITE', 'REMOTE'] },
  { id: id(3), label: lessons, modes: ['ON_SITE'] },
  { id: id(4), label: rental, modes: ['ON_SITE'] },
];
const pair = (service, mode = 'ON_SITE') => ({ service, mode });
const value = async (sql, args = []) => (await db.query(sql, args)).rows[0].value;
const project = (purpose = 'WORKER_CAPABILITY', services = [paint], modes = [pair(paint)]) =>
  value('select private.taxonomy_review_exact_projection_v1($1,$2::jsonb,$3::jsonb) as value',
    [purpose, JSON.stringify(services), JSON.stringify(modes)]);
function empty(result, status) {
  if (status) assert.equal(result.status, status);
  else assert.notEqual(result.status, 'READY');
  for (const name of ['classificationCandidates', 'reviewedServiceModes', 'visibleServices']) assert.deepEqual(result[name], []);
  assert.equal(result.classificationCatalogVersion, null);
  assert.equal(result.classificationCatalogFingerprint, null);
}
const snapshot = () => value(`select jsonb_build_array(${tables.map(table =>
  `(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from private.${table} t)`).join(',')}) as value`);
const hint = (service, categoryId, extra = {}) => ({ service, mode: 'ON_SITE', action: 'REUSE_EXISTING', categoryId,
  parentId: '', proposedPath: [], reason: 'Current exact catalog identity requires owner review.', catalogVersion: 9, ...extra });
const inspect = p => inspectGeminiClassificationShadow({ assistantMessage: 'Proveri nacrt.', safety: 'ALLOW',
  patch: {}, classificationShadowJson: JSON.stringify([p]) }, { catalogVersion: 9,
  catalogFingerprint: 'a'.repeat(32), categories: catalog }, 'WORKER_CAPABILITY');

before(async () => {
  await db.exec('create schema private');
  for (const name of functions) {
    const start = source.indexOf(`CREATE OR REPLACE FUNCTION private.${name}(`);
    assert(start >= 0, name);
    const body = source.indexOf('AS $function$', start);
    const end = source.indexOf('$function$;', body + 13);
    assert(end > body);
    // SQL function validation needs its referenced tables first.
    if (name !== 'taxonomy_normalize_v1') continue;
    await db.exec(source.slice(start, end + '$function$;'.length));
  }
  for (const table of tables) {
    const start = source.indexOf(`CREATE TABLE "private"."${table}" (`);
    assert(start >= 0, table);
    const end = source.indexOf('\n);', start);
    assert(end > start);
    await db.exec(source.slice(start, end + 3));
  }
  for (const name of functions.slice(1)) {
    const start = source.indexOf(`CREATE OR REPLACE FUNCTION private.${name}(`);
    const body = source.indexOf('AS $function$', start);
    const end = source.indexOf('$function$;', body + 13);
    await db.exec(source.slice(start, end + '$function$;'.length));
  }
});
beforeEach(async () => {
  await db.exec(`truncate ${tables.map(t => 'private.' + t).join(',')}`);
  await db.exec("insert into private.work_taxonomy_control values(true,false,10,9,now())");
  for (const c of catalog) {
    await db.query(`insert into private.work_taxonomy_categories
      (id,canonical_key,label,parent_id,state,source,catalog_version,created_at,updated_at)
      values($1,private.taxonomy_normalize_v1($2),$2,null,'ESTABLISHED','C09_SYNTHETIC',9,now(),now())`, [c.id, c.label]);
    for (const mode of c.modes) await db.query(`insert into private.work_taxonomy_category_modes
      values($1,$2,'C09_SYNTHETIC',now())`, [c.id, mode]);
  }
});
after(() => db.close());

test('SQL owner projection reuses exact UUID and leaves the catalog unchanged', async () => {
  const before = await snapshot(), result = await project();
  assert.equal(result.status, 'READY');
  assert.deepEqual(result.reviewedServiceModes, [pair(paint)]);
  assert.equal(result.classificationCandidates[0].categoryId, id(1));
  assert.deepEqual(Object.keys(result.classificationCandidates[0]).sort(),
    ['action','catalogVersion','categoryId','mode','reason','service'].sort());
  assert.equal(Object.hasOwn(result, 'capabilityAuthority'), false);
  assert.deepEqual(await snapshot(), before);
});
test('Need uses its explicit mode and returns no worker mode authority', async () => {
  const result = await project('NEED_SERVICE', [slide], [pair(slide, 'REMOTE')]);
  assert.equal(result.status, 'READY');
  assert.deepEqual(result.reviewedServiceModes, []);
  assert.equal(result.classificationCandidates[0].mode, 'REMOTE');
  empty(await project('NEED_SERVICE', [slide], [pair(slide), pair(slide, 'REMOTE')]));
});
test('both caller orders reuse the same existing identity without creating categories', async () => {
  const before = await snapshot();
  for (const order of [['WORKER_CAPABILITY','NEED_SERVICE'], ['NEED_SERVICE','WORKER_CAPABILITY']]) {
    const results = [];
    for (const purpose of order) results.push(await project(purpose));
    assert.deepEqual(results.map(r => r.classificationCandidates[0].categoryId), [id(1),id(1)]);
  }
  assert.deepEqual(await snapshot(), before);
});
test('independent services retain their own explicit modes', async () => {
  const selected = [pair(paint), pair(slide, 'REMOTE')];
  const result = await project('WORKER_CAPABILITY', [paint, slide], selected);
  assert.equal(result.status, 'READY');
  assert.deepEqual(result.reviewedServiceModes, selected);
  assert.deepEqual(result.classificationCandidates.map(p => [p.categoryId,p.mode]), [[id(1),'ON_SITE'],[id(2),'REMOTE']]);
});
test('absent or partial modes never default missing service to ON_SITE', async () => {
  empty(await project('WORKER_CAPABILITY', [paint], []));
  empty(await project('WORKER_CAPABILITY', [paint,slide], [pair(paint)]), 'SERVICE_MODE_CONFIRMATION_REQUIRED');
});
test('foreign service, unsupported mode and duplicate mode cannot yield a partial projection', async () => {
  for (const selected of [[pair(lessons)], [pair(paint,'REMOTE')], [pair(paint),pair(paint)]]) {
    empty(await project('WORKER_CAPABILITY', [paint], selected));
  }
});
test('actual Edge validator cannot replace skate rental with skating lessons UUID', async () => {
  assert.deepEqual(inspect(hint(rental,id(3))).reviewProposals, []);
  const result = await project('WORKER_CAPABILITY', [rental], [pair(rental)]);
  assert.equal(result.classificationCandidates[0].categoryId,id(4));
});
test('unknown service stays unresolved and cannot leak a ready subset', async () => {
  const unknown = 'Restauracija antičkih globusa', before = await snapshot();
  empty(await project('NEED_SERVICE', [unknown], [pair(unknown)]), 'PENDING_CLASSIFICATION');
  empty(await project('WORKER_CAPABILITY', [paint,unknown], [pair(paint),pair(unknown)]), 'PENDING_CLASSIFICATION');
  assert.deepEqual(await snapshot(),before);
});
test('parent-only proposal grants no capability and cannot invent an existing SQL identity', async () => {
  const service = 'Restauracija antičkih globusa';
  const result = inspect(hint(service,'',{ action:'CREATE_CHILD',parentId:id(1),proposedPath:[service] }));
  assert(result.statuses.every(s => s !== 'REUSE_CANDIDATE'));
  assert.equal(Object.hasOwn(result.output,'classificationShadowJson'), false);
  empty(await project('NEED_SERVICE',[service],[pair(service)]), 'PENDING_CLASSIFICATION');
  // Valid novel proposals may continue through separate admission and Save;
  // C09 deliberately does not restore the retired builder's blanket ban.
});
test('stored alias is accepted but collision is unresolved by actual SQL identity lookup', async () => {
  const alias = 'Bojenje zidova';
  await db.query("insert into private.work_taxonomy_aliases(category_id,locale,label,created_at) values($1,'sr',$2,now())",[id(1),alias]);
  const good = await project('NEED_SERVICE',[alias],[pair(alias)]);
  assert.equal(good.classificationCandidates[0].categoryId,id(1));
  await db.query("insert into private.work_taxonomy_aliases(category_id,locale,label,created_at) values($1,'sr',$2,now())",[id(3),alias]);
  empty(await project('NEED_SERVICE',[alias],[pair(alias)]),'PENDING_CLASSIFICATION');
});
test('duplicate Cyrillic/Latin services fail closed and single transcription retains UUID', async () => {
  const cyrillic = 'Кречење зидова';
  empty(await project('WORKER_CAPABILITY',[paint,cyrillic],[pair(paint)]));
  const result = await project('NEED_SERVICE',[cyrillic],[pair(cyrillic)]);
  assert.equal(result.classificationCandidates[0].categoryId,id(1));
  assert.equal(result.classificationCandidates[0].service,cyrillic);
});
test('explicit BOTH projection includes both service-mode pairs with one canonical UUID', async () => {
  const selected = [pair(slide),pair(slide,'REMOTE')];
  const result = await project('WORKER_CAPABILITY',[slide],selected);
  assert.equal(result.status,'READY');
  assert.deepEqual(result.reviewedServiceModes,selected);
  assert.deepEqual(result.classificationCandidates.map(p => [p.categoryId,p.mode]),[[id(2),'ON_SITE'],[id(2),'REMOTE']]);
});
test('server fingerprint changes with catalog identity while missing control blocks review', async () => {
  const before = await project();
  await db.query("insert into private.work_taxonomy_aliases(category_id,locale,label,created_at) values($1,'sr','Bojenje zidova',now())",[id(1)]);
  const changed = await project();
  assert.equal(changed.classificationCatalogVersion,before.classificationCatalogVersion);
  assert.notEqual(changed.classificationCatalogFingerprint,before.classificationCatalogFingerprint);
  await db.exec('delete from private.work_taxonomy_control');
  empty(await project(),'CATALOG_UNAVAILABLE');
});
