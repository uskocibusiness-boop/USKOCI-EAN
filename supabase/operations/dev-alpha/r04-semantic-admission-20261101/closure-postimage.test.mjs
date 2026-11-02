import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { originals, postimages, postClosure, preimage,promotionPostimages,promotionPostClosure } from './build.mjs';
import { deriveClosurePostimage } from './closure-postimage.mjs';

const evidence = JSON.parse(readFileSync(new URL('./closure-postimage-offline-evidence-20261102.json', import.meta.url), 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const derive = overrides => deriveClosurePostimage({ evidence, originals, postimages, preimageClosure: preimage.closure, ...overrides });

test('captured canonical catalog inputs reproduce both actual DEV preimage digests', () => {
  assert.equal(sha256(evidence.capture.source_input), evidence.capture.actual.source);
  assert.equal(sha256(evidence.capture.erasure_input), evidence.capture.actual.erasure);
});

test('generated closure postimage matches the independently reproduced DEV catalog projection', () => {
  assert.equal(postClosure.source, evidence.result.expected_postimage.source);
  assert.equal(postClosure.erasure, evidence.result.expected_postimage.erasure);
});

test('independent PostgreSQL JSONB and SHA-256 reproduce the connected fourteen-body closure postimage', async t => {
  const db = new PGlite(); t.after(() => db.close());
  const patches = Object.fromEntries(Object.values(promotionPostimages).map(f => [f.signature, f.body_md5]));
  // Keep the captured PostgreSQL text and roster order. Expected hashes are
  // calculated here by PostgreSQL, without deriveClosurePostimage or JS replace.
  const { rows: [result] } = await db.query(`WITH before AS (
    SELECT $1::jsonb erasure,$2::jsonb patches,$3::text source_input,$4::jsonb roster
  ), updated AS (
    SELECT erasure::text canonical_before,source_input,patches,roster,
      jsonb_set(erasure,'{functions}',(SELECT jsonb_agg(
        CASE WHEN patches ? (entry->>'signature')
          THEN jsonb_set(entry,'{source}',patches->(entry->>'signature'))
          ELSE entry END ORDER BY ordinal)
        FROM jsonb_array_elements(erasure->'functions') WITH ORDINALITY x(entry,ordinal)))::text canonical_after
    FROM before
  ), digests AS (
    SELECT *,encode(sha256(convert_to(canonical_after,'UTF8')),'hex') erasure_after FROM updated
  ), projected AS (
    SELECT *,split_part(source_input,':',1)||':'||erasure_after||':'||
      split_part(source_input,':',3)||':'||split_part(source_input,':',4)||':'||
      (SELECT string_agg((entry->>'signature')||':'||
        coalesce(patches->>(entry->>'signature'),entry->>'body_md5'),E'\\n' ORDER BY ordinal)
        FROM jsonb_array_elements(roster) WITH ORDINALITY x(entry,ordinal)) source_after
    FROM digests
  ) SELECT canonical_before,
    encode(sha256(convert_to(canonical_before,'UTF8')),'hex') erasure_before,
    encode(sha256(convert_to(source_input,'UTF8')),'hex') source_before,
    erasure_after,encode(sha256(convert_to(source_after,'UTF8')),'hex') source_after
    FROM projected`, [evidence.capture.erasure_input, JSON.stringify(patches),
    evidence.capture.source_input, JSON.stringify(evidence.capture.source_roster)]);
  assert.equal(result.canonical_before, evidence.capture.erasure_input);
  assert.equal(result.erasure_before, evidence.capture.actual.erasure);
  assert.equal(result.source_before, evidence.capture.actual.source);
  assert.equal(result.erasure_after, promotionPostClosure.erasure);
  assert.equal(result.source_after, promotionPostClosure.source);
  for (const preserved of ['schema', 'certificate', 'source_ready', 'export_binding', 'erasure_binding']) {
    assert.equal(promotionPostClosure[preserved], preimage.closure[preserved]);
  }
  assert.equal(postClosure.source_ready, false);
  assert.equal(postClosure.export_binding, null);
  assert.equal(postClosure.erasure_binding, null);
});

test('a no-op body projection exactly preserves both live preimage digests and closure state', () => {
  assert.deepEqual(derive({ postimages: originals }), preimage.closure);
});

for (const key of ['commit', 'trigger']) {
  test(`a changed ${key} body changes both output digests without changing the certificate`, () => {
    const changed = structuredClone(postimages);
    const definition = changed[key].definition;
    const end = definition.lastIndexOf('$function$');
    changed[key].definition = definition.slice(0, end) + '\n-- regression probe\n' + definition.slice(end);
    const start = changed[key].definition.indexOf('AS $function$') + 'AS $function$'.length;
    changed[key].body_md5 = createHash('md5').update(changed[key].definition.slice(start, changed[key].definition.lastIndexOf('$function$'))).digest('hex');
    const next = derive({ postimages: changed });
    assert.notEqual(next.source, postClosure.source);
    assert.notEqual(next.erasure, postClosure.erasure);
    for (const preserved of ['schema', 'certificate', 'source_ready', 'export_binding', 'erasure_binding']) {
      assert.equal(next[preserved], preimage.closure[preserved]);
    }
  });
}

for (const key of ['source', 'erasure']) {
  test(`a damaged ${key} canonical preimage is rejected before projection`, () => {
    const changed = structuredClone(evidence);
    changed.capture[key + '_input'] += ' ';
    assert.throws(() => derive({ evidence: changed }), /R04_CLOSURE_INPUT_DIGEST_MISMATCH/);
  });
}

test('a capture from another closure preimage is rejected even if internally self-consistent', () => {
  const changed = structuredClone(evidence);
  changed.capture.erasure_input += ' ';
  changed.capture.actual.erasure = sha256(changed.capture.erasure_input);
  assert.throws(() => derive({ evidence: changed }), /R04_CLOSURE_PREIMAGE_CHANGED/);
});

test('a claimed body hash that does not match the replacement SQL is rejected', () => {
  const changed = structuredClone(postimages);
  changed.commit.body_md5 = '0'.repeat(32);
  assert.throws(() => derive({ postimages: changed }), /R04_CLOSURE_POSTIMAGE_BODY_MISMATCH/);
});

test('a stale original function body is rejected against the captured live preimage', () => {
  const changed = structuredClone(originals);
  changed.commit.body_md5 = '0'.repeat(32);
  assert.throws(() => derive({ originals: changed }), /R04_CLOSURE_FUNCTION_PREIMAGE_CHANGED/);
});
